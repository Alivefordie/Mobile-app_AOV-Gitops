#!/bin/bash
# Creates the Elasticsearch TLS Secret (ca.crt, tls.crt, tls.key) that the
# chart mounts but does not generate. Run once per cluster, before the first
# install. Refuses to replace an existing Secret: new certs need every ELK pod
# restarted, since clients trust only the CA they were started with.
#
#   elk-chart/scripts/create-certs.sh [release] [namespace] [kube-context]
set -euo pipefail

RELEASE="${1:-elk}"
NAMESPACE="${2:-logging}"
CONTEXT="${3:-$(kubectl config current-context)}"
SECRET="${RELEASE}-tls"
ES="${RELEASE}-elasticsearch"
kc() { kubectl --context "$CONTEXT" -n "$NAMESPACE" "$@"; }

if kc get secret "$SECRET" >/dev/null 2>&1; then
  echo "Secret $NAMESPACE/$SECRET already exists in $CONTEXT; not replacing it." >&2
  exit 1
fi

dir="$(mktemp -d)"
trap 'rm -rf "$dir"' EXIT
# Relative paths only: MSYS_NO_PATHCONV keeps Git Bash on Windows from
# rewriting "/CN=..." into a path, but also stops it converting real paths.
cd "$dir"
export MSYS_NO_PATHCONV=1

openssl req -x509 -newkey rsa:2048 -nodes -days 3650 -subj "/CN=elk-ca" \
  -keyout ca.key -out ca.crt 2>/dev/null

openssl req -newkey rsa:2048 -nodes -subj "/CN=$ES" \
  -keyout tls.key -out tls.csr 2>/dev/null
printf 'subjectAltName=DNS:%s,DNS:%s.%s,DNS:%s.%s.svc,DNS:%s.%s.svc.cluster.local,DNS:localhost,IP:127.0.0.1\n' \
  "$ES" "$ES" "$NAMESPACE" "$ES" "$NAMESPACE" "$ES" "$NAMESPACE" > ext.cnf
openssl x509 -req -in tls.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -days 3650 -extfile ext.cnf -out tls.crt 2>/dev/null

kubectl --context "$CONTEXT" create namespace "$NAMESPACE" --dry-run=client -o yaml \
  | kubectl --context "$CONTEXT" apply -f - >/dev/null
kc create secret generic "$SECRET" \
  --from-file=ca.crt --from-file=tls.crt --from-file=tls.key
