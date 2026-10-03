kind create cluster --config kind-config.yaml
kind get clusters
kubectl get nodes
docker inspect registry --format "{{json .NetworkSettings.Networks}}"  | jq
docker network connect kind registry

bash scripts/kind-registry.sh

kubectl create namespace argocd

kubectl apply \
  -n argocd \
  --server-side \
  --force-conflicts \
  -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

kubectl wait \
  --for=condition=Available \
  deployment \
  --all \
  -n argocd \
  --timeout=300s

kubectl get pods -n argocd

kubectl port-forward \
  svc/argocd-server \
  -n argocd \
  8081:443
# user: admin
kubectl \
  -n argocd \
  get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" |
base64 -d

kubectl get applications -n argocd

kubectl get application taskflow-staging -n argocd -o yaml

kubectl get application taskflow-staging -n argocd \
  -o jsonpath='{.spec.source.repoURL}{"\n"}{.spec.source.targetRevision}{"\n"}{.spec.source.path}{"\n"}{.spec.source.helm.valueFiles}{"\n"}'