SHELL := /bin/bash

CLUSTER_NAME ?= argocd-project
KIND_CONFIG ?= kind-config.yaml

ARGOCD_NAMESPACE ?= argocd
ARGOCD_PORT ?= 8081

STAGING_APP ?= taskflow-staging
PRODUCTION_APP ?= taskflow-production

STAGING_NAMESPACE ?= argocd
PRODUCTION_NAMESPACE ?= argocd

REGISTRY ?= registry
REGISTRY_PORT ?= 5000


.PHONY: \
	app-all \
	cluster-create \
	cluster-list \
	cluster-nodes \
	registry-inspect \
	registry-connect \
	registry-setup \
	argocd-namespace \
	argocd-install \
	argocd-wait \
	argocd-pods \
	argocd-setup \
	argocd-port-forward \
	argocd-password \
	apps \
	app-staging \
	app-repo-info \
	namespaces \
	workloads \
	registry-catalog \
	registry-tags \
	notifications-info \
	notifications-triggers \
	notifications-templates \
	notify-success \
	notify-failed \
	notify-degraded \
	status


# ==================================================
# Kind
# ==================================================

cluster-create:
	kind create cluster \
		--name $(CLUSTER_NAME) \
		--config $(KIND_CONFIG)


cluster-list:
	kind get clusters


cluster-nodes:
	kubectl get nodes -o wide


# ==================================================
# Local Registry
# ==================================================

registry-inspect:
	docker inspect $(REGISTRY) \
		--format '{{json .NetworkSettings.Networks}}' | jq


registry-connect:
	@docker network inspect kind \
		--format '{{json .Containers}}' | \
		grep -q '"$(REGISTRY)"' || \
		docker network connect kind $(REGISTRY)


registry-setup:
	bash scripts/kind-registry.sh


registry-catalog:
	curl http://localhost:$(REGISTRY_PORT)/v2/_catalog


registry-tags:
	curl http://localhost:$(REGISTRY_PORT)/v2/taskflow-api/tags/list


# ==================================================
# Argo CD Install
# ==================================================

argocd-namespace:
	kubectl create namespace $(ARGOCD_NAMESPACE) \
		--dry-run=client \
		-o yaml | kubectl apply -f -


argocd-install: argocd-namespace
	kubectl apply \
		-n $(ARGOCD_NAMESPACE) \
		--server-side \
		--force-conflicts \
		-f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml


argocd-wait:
	kubectl wait \
		--for=condition=Available \
		deployment \
		--all \
		-n $(ARGOCD_NAMESPACE) \
		--timeout=300s


argocd-pods:
	kubectl get pods \
		-n $(ARGOCD_NAMESPACE)


argocd-setup: argocd-install argocd-wait argocd-pods


# ==================================================
# Argo CD Access
# ==================================================

argocd-port-forward:
	kubectl port-forward \
		svc/argocd-server \
		-n $(ARGOCD_NAMESPACE) \
		$(ARGOCD_PORT):443


# user: admin
argocd-password:
	@kubectl \
		-n $(ARGOCD_NAMESPACE) \
		get secret argocd-initial-admin-secret \
		-o jsonpath='{.data.password}' | base64 -d
	@echo


# ==================================================
# Argo CD Applications
# ==================================================

apps:
	kubectl get applications \
		-n $(ARGOCD_NAMESPACE)


app-staging:
	kubectl get application $(STAGING_APP) \
		-n $(ARGOCD_NAMESPACE) \
		-o yaml


app-repo-info:
	kubectl get application $(STAGING_APP) \
		-n $(ARGOCD_NAMESPACE) \
		-o jsonpath='{.spec.source.repoURL}{"\n"}{.spec.source.targetRevision}{"\n"}{.spec.source.path}{"\n"}{.spec.source.helm.valueFiles}{"\n"}'


# ==================================================
# Taskflow
# ==================================================

namespaces:
	kubectl get ns | grep taskflow


workloads:
	@echo "========================================"
	@echo "Staging"
	@echo "========================================"
	kubectl get all -n $(STAGING_NAMESPACE)

	@echo
	@echo "========================================"
	@echo "Production"
	@echo "========================================"
	kubectl get all -n $(PRODUCTION_NAMESPACE)


# ==================================================
# Argo CD Notifications
# ==================================================

notifications-info:
	@echo "========================================"
	@echo "ConfigMap"
	@echo "========================================"
	kubectl get configmap argocd-notifications-cm \
		-n $(ARGOCD_NAMESPACE)

	@echo
	@echo "========================================"
	@echo "Secret"
	@echo "========================================"
	kubectl get secret argocd-notifications-secret \
		-n $(ARGOCD_NAMESPACE)


notifications-triggers:
	kubectl exec \
		-n $(ARGOCD_NAMESPACE) \
		deploy/argocd-notifications-controller \
		-- argocd admin notifications trigger get


notifications-templates:
	kubectl exec \
		-n $(ARGOCD_NAMESPACE) \
		deploy/argocd-notifications-controller \
		-- argocd admin notifications template get


# ==================================================
# Apply Local Argo CD Config
# ==================================================

app-all:
	kubectl apply -f argocd


# ==================================================
# Test Discord Notifications
# ==================================================

notify-success:
	kubectl exec \
		-n $(ARGOCD_NAMESPACE) \
		deploy/argocd-notifications-controller \
		-- argocd admin notifications template notify \
		app-sync-succeeded \
		$(STAGING_APP) \
		--recipient discord:test


notify-failed:
	kubectl exec \
		-n $(ARGOCD_NAMESPACE) \
		deploy/argocd-notifications-controller \
		-- argocd admin notifications template notify \
		app-sync-failed \
		$(STAGING_APP) \
		--recipient discord:test


notify-degraded:
	kubectl exec \
		-n $(ARGOCD_NAMESPACE) \
		deploy/argocd-notifications-controller \
		-- argocd admin notifications template notify \
		app-health-degraded \
		$(STAGING_APP) \
		--recipient discord:test


# ==================================================
# Status
# ==================================================

status:
	@echo "========================================"
	@echo "Nodes"
	@echo "========================================"
	kubectl get nodes

	@echo
	@echo "========================================"
	@echo "Argo CD"
	@echo "========================================"
	kubectl get pods -n $(ARGOCD_NAMESPACE)

	@echo
	@echo "========================================"
	@echo "Applications"
	@echo "========================================"
	kubectl get applications -n $(ARGOCD_NAMESPACE)

	@echo
	@echo "========================================"
	@echo "Taskflow namespaces"
	@echo "========================================"
	kubectl get ns | grep taskflow || true

change-cluster-namespace:
	@echo "Current context:"
	@kubectl config current-context
	@echo
	@echo "Available contexts:"
	@kubectl config get-contexts
	@echo
	@read -p "Context [$(CLUSTER_NAME)]: " context; \
	context=$${context:-$(CLUSTER_NAME)}; \
	read -p "Namespace [$(STAGING_NAMESPACE)]: " namespace; \
	namespace=$${namespace:-$(STAGING_NAMESPACE)}; \
	echo; \
	echo "Switching to context: $$context"; \
	kubectl config use-context "$$context" || exit 1; \
	echo; \
	echo "Nodes:"; \
	kubectl get nodes || exit 1; \
	echo; \
	echo "Namespaces:"; \
	kubectl get ns || exit 1; \
	echo; \
	echo "Changing namespace to: $$namespace"; \
	kubectl get namespace "$$namespace" >/dev/null 2>&1 || { \
		echo "ERROR: Namespace '$$namespace' does not exist"; \
		exit 1; \
	}; \
	kubectl config set-context --current --namespace="$$namespace"; \
	echo; \
	echo "Current context / namespace:"; \
	kubectl config view --minify \
		-o jsonpath='{.current-context}{" -> "}{..namespace}{"\n"}'
# make change-cluster-namespace STAGING_NAMESPACE=taskflow-staging
# kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/latest/download/controller.yaml
secret-seal:
	@read -p "Save as name: " FILE_NAME; \
	case "$$FILE_NAME" in \
		*.*) ;; \
		*) FILE_NAME="$$FILE_NAME.yaml" ;; \
	esac; \
	kubeseal \
		--controller-name sealed-secrets-controller \
		--controller-namespace kube-system \
		--format yaml \
		< secret-temp.yaml \
		> argocd/secrets/$$FILE_NAME; \
	echo "Sealed secret created: argocd/secrets/$$FILE_NAME"

# 	secret-temp.yaml