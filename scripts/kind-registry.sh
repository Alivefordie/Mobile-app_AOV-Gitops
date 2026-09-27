#!/bin/bash
# Creates the kind cluster from kind-config.yaml wired to the local registry,
# following https://kind.sigs.k8s.io/docs/user/local-registry/
#
#   push:  docker push localhost:5001/<image>:<tag>     (from the host)
#   pods:  image: localhost:5001/<image>:<tag>          (containerd maps it to kind-registry:5000)
#
# Safe to re-run: existing registry and cluster are reused.
set -euo pipefail
export MSYS_NO_PATHCONV=1

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="$ROOT/kind-config.yaml"
CLUSTER="$(sed -n 's/^name: *//p' "$CONFIG")"
REG_NAME=kind-registry
REG_PORT=5001

# 1. Registry on 127.0.0.1:5001, images kept in a named volume.
case "$(docker inspect -f '{{.State.Running}}' "$REG_NAME" 2>/dev/null || echo missing)" in
  true) ;;
  false) docker start "$REG_NAME" >/dev/null ;;
  missing)
    docker run -d --restart=always --name "$REG_NAME" \
      -p "127.0.0.1:${REG_PORT}:5000" -v kind-registry-data:/var/lib/registry \
      registry:2 >/dev/null ;;
esac

# 2. Cluster (config_path for containerd comes from kind-config.yaml).
if ! kind get clusters | grep -qx "$CLUSTER"; then
  kind create cluster --config "$CONFIG"
fi

# 3. Tell containerd on every node that localhost:5001 is kind-registry:5000 over HTTP.
for node in $(kind get nodes --name "$CLUSTER"); do
  docker exec "$node" mkdir -p "/etc/containerd/certs.d/localhost:${REG_PORT}"
  printf '[host."http://%s:5000"]\n' "$REG_NAME" \
    | docker exec -i "$node" cp /dev/stdin "/etc/containerd/certs.d/localhost:${REG_PORT}/hosts.toml"
done

# 4. Put the registry on the kind network so nodes can resolve it.
if [ "$(docker inspect -f '{{json .NetworkSettings.Networks.kind}}' "$REG_NAME")" = "null" ]; then
  docker network connect kind "$REG_NAME"
fi

# 5. Advertise the registry (KEP-1755).
kubectl --context "kind-${CLUSTER}" apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: local-registry-hosting
  namespace: kube-public
data:
  localRegistryHosting.v1: |
    host: "localhost:${REG_PORT}"
    help: "https://kind.sigs.k8s.io/docs/user/local-registry/"
EOF

echo "cluster kind-${CLUSTER} pulls localhost:${REG_PORT}/* from ${REG_NAME}"
