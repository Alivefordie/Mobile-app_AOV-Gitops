#!/bin/bash
# Creates the kind cluster from kind-config.yaml wired to the local registry,
# following https://kind.sigs.k8s.io/docs/user/local-registry/
#
#   push:  docker push localhost:5001/<image>:<tag>     (from the host)
#   DinD:  docker push registry:5000/<image>:<tag>      (internal container port)
#   pods:  image: localhost:5001/<image>:<tag>          (containerd maps it to registry:5000)
#
# Safe to re-run: existing registry and cluster are reused.
set -euo pipefail
export MSYS_NO_PATHCONV=1

# pwd -W gives D:/... on Git Bash, where MSYS_NO_PATHCONV stops /d/... being converted.
ROOT="$(cd "$(dirname "$0")/.." && (pwd -W 2>/dev/null || pwd))"
CONFIG="$ROOT/kind-config.yaml"
CLUSTER="$(sed -n 's/^name: *//p' "$CONFIG" | tr -d '\r')"
REG_NAME="${REG_NAME:-registry}"
REG_PORT=5001
JENKINS_NETWORK="${JENKINS_NETWORK:-jenkins}"

# 1. Registry on 127.0.0.1:5001, images kept in a named volume.
case "$(docker inspect -f '{{.State.Running}}' "$REG_NAME" 2>/dev/null || echo missing)" in
  true|false)
    # Reusing a container with the old host port would leave push/pull inconsistent.
    # Never remove it automatically: existing image data may be in its writable layer.
    if ! docker inspect -f '{{range (index .HostConfig.PortBindings "5000/tcp")}}{{println .HostPort}}{{end}}' "$REG_NAME" \
      | grep -Fxq "$REG_PORT"; then
      echo "Registry $REG_NAME must publish host port ${REG_PORT} to container port 5000." >&2
      echo "Back up its images before recreating its port mapping; no container was changed." >&2
      exit 1
    fi
    if [ "$(docker inspect -f '{{.State.Running}}' "$REG_NAME")" != true ]; then
      docker start "$REG_NAME" >/dev/null
    fi ;;
  missing)
    docker run -d --restart=always --name "$REG_NAME" \
      -p "127.0.0.1:${REG_PORT}:5000" -v kind-registry-data:/var/lib/registry \
      registry:2 >/dev/null ;;
esac

# 2. Cluster (config_path for containerd comes from kind-config.yaml).
if ! kind get clusters | grep -qx "$CLUSTER"; then
  kind create cluster --config "$CONFIG"
fi

# 3. Tell containerd on every node that localhost:5001 is registry:5000 over HTTP.
for node in $(kind get nodes --name "$CLUSTER"); do
  docker exec "$node" mkdir -p "/etc/containerd/certs.d/localhost:${REG_PORT}"
  printf '[host."http://%s:5000"]\n' "$REG_NAME" \
    | docker exec -i "$node" cp /dev/stdin "/etc/containerd/certs.d/localhost:${REG_PORT}/hosts.toml"
done

# 4. Put the registry on the kind network so nodes can resolve it.
if [ "$(docker inspect -f '{{json .NetworkSettings.Networks.kind}}' "$REG_NAME")" = "null" ]; then
  docker network connect kind "$REG_NAME"
fi

# DinD uses registry:5000 through the Jenkins network, with --insecure-registry=registry:5000.
# The host-socket setup does not need this network and pushes to localhost:5001 instead.
if docker network inspect "$JENKINS_NETWORK" >/dev/null 2>&1; then
  if ! docker network inspect -f '{{range .Containers}}{{println .Name}}{{end}}' "$JENKINS_NETWORK" \
    | grep -Fxq "$REG_NAME"; then
    docker network connect "$JENKINS_NETWORK" "$REG_NAME"
  fi
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
