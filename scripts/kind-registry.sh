for node in argocd-project-control-plane argocd-project-worker; do
  docker exec "$node" mkdir -p /etc/containerd/certs.d/registry:5000

  docker exec "$node" sh -c 'cat > /etc/containerd/certs.d/registry:5000/hosts.toml <<EOF
server = "http://registry:5000"

[host."http://registry:5000"]
  capabilities = ["pull", "resolve"]
EOF'
done

docker exec argocd-project-control-plane \
  cat /etc/containerd/certs.d/registry:5000/hosts.toml
docker exec argocd-project-worker \
  cat /etc/containerd/certs.d/registry:5000/hosts.toml