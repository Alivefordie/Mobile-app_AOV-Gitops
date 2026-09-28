# test-ci-cd

TaskFlow backend (NestJS + PostgreSQL) ใช้ flow Jenkins -> GitOps repo -> Argo CD -> kind

```text
backend/          NestJS API + Dockerfile + docker-compose (สำหรับรันในเครื่อง)
taskflow-chart/   Helm chart: backend Deployment + PostgreSQL StatefulSet
elk-chart/        Helm chart: Filebeat -> Logstash -> Elasticsearch -> Kibana
jenkins/          Jenkins configuration ตัวอย่างสำหรับ host Docker socket
Jenkinsfile       test -> build/push -> update GitOps values -> wait for Argo CD -> verify
scripts/          kind cluster และ local registry
```

## รัน backend ในเครื่องด้วย docker compose

```sh
cd backend
JWT_SECRET=some-secret docker compose up -d --build
curl http://localhost:3000
```

## kind local registry: host port 5001

| ผู้ใช้ registry | Endpoint | วิธีเชื่อมต่อ |
| --- | --- | --- |
| Docker บน host | `localhost:5001` | host `5001` -> registry container `5000` |
| Jenkins agent ที่ใช้ DinD | `registry:5000` | เครือข่าย Docker `jenkins` |
| image ใน GitOps values/Pod | `localhost:5001/taskflow-backend:<tag>` | containerd -> `http://registry:5000` |

พอร์ต `5000` ภายใน container ยังคงเดิม เพื่อให้ตรงกับ registry:2 และ DinD ที่ตั้ง
`--insecure-registry=registry:5000` อยู่แล้ว ส่วนพอร์ตที่เผยแพร่บน host ใช้ `5001`
ตาม [kind local registry](https://kind.sigs.k8s.io/docs/user/local-registry/)

```sh
bash scripts/kind-registry.sh
curl http://localhost:5001/v2/
```

สคริปต์ใช้ `kind-config.yaml` สร้างหรือใช้ cluster `argocd-lab` เดิม เชื่อม registry
กับ network `kind` และ `jenkins` (ถ้ามี) แล้วเขียน mapping `localhost:5001` ให้ทุก node
หากใช้ชื่อ network อื่น ให้ตั้ง `JENKINS_NETWORK=<network>` ตอนเรียกสคริปต์

ถ้า container `registry` เดิมเผยแพร่ host port `5000` สคริปต์จะหยุดก่อนแก้ระบบ
ต้องสำรอง image data และสร้าง container ใหม่ด้วย mapping `127.0.0.1:5001:5000` ก่อน
Docker เปลี่ยน published port ของ container ที่สร้างแล้วไม่ได้ ห้ามลบ container เดิม
ก่อนสำรอง `/var/lib/registry`; container เดิมอาจไม่ได้ mount volume

## CI/CD ด้วย Jenkins และ Argo CD

1. Jenkins job ใช้ `Jenkinsfile` จาก **app repo** และ agent label `linux-build-back`
   พร้อม NodeJS tool `node26`, Docker/buildx, Git, yq v4, Helm, kind และ kubectl
2. ค่า `PUSH_REGISTRY` เริ่มต้นเป็น `registry:5000` สำหรับ DinD ที่อยู่บน network
   `jenkins` และอนุญาต HTTP registry ด้วย `--insecure-registry=registry:5000`
   ถ้าใช้ host Docker socket ตาม `jenkins/docker-compose.yaml` ให้เลือก `localhost:5001`
   และจัด agent label/tool ให้ตรงกับ Jenkins ที่ใช้งาน
3. ตั้ง credential `github-ssh` ให้ Jenkins clone/push
   `git@github.com:Alivefordie/test-ci-cd-gitops.git` branch `main` ได้
4. ใน GitOps repo ตรวจ `taskflow-chart/values.yaml`: repository คือ
   `localhost:5001/taskflow-backend`; Jenkins จะเขียน repository และ tag ของ build ลงไฟล์นี้
5. Argo CD ต้องเข้าถึง GitOps repo ได้ และ Application ทั้งสองใช้ repo เดียวกัน branch `main`
   โดยใช้ path `taskflow-chart` และ `elk-chart` ตามลำดับ หลังนำ manifest ที่แก้ไปใช้:

   ```sh
   kubectl --context kind-argocd-lab apply -f argocd/taskflow-app.yaml -f argocd/elk-app.yaml
   ```

6. Jenkins build/push image ไป registry แล้ว commit/push เฉพาะ values ใน GitOps repo
   Argo CD auto-sync จาก GitOps repo ลง kind; Jenkins รอและตรวจผล deployment

`DEPLOY_REGISTRY` คงเป็น `localhost:5001` แม้ `PUSH_REGISTRY` จะเป็น `registry:5000`
เพราะทั้งสอง endpoint ชี้ image data ใน registry ตัวเดียวกัน Jenkins ไม่ใช้ `kind load`
หรือ `helm upgrade` เพื่อ deploy ใน flow นี้ การ rollback ใช้ revert commit/image tag ใน GitOps

> Jenkins อ่านจาก commit ใน git ไม่ใช่ไฟล์ที่ยังไม่ commit ต้อง commit/push configuration
> ไป repo ที่เกี่ยวข้องก่อนให้ Jenkins/Argo CD ใช้งานจริง

## Secrets

ค่า R2 และ JWT ห้าม commit ให้ส่งผ่าน `--set secrets.*` หรือสร้าง Secret เองแล้วใช้ `--set secrets.existingSecret=<name>`

## Log monitoring (ELK)

```
pod logs (/var/log/containers) -> Filebeat (DaemonSet) -> Logstash :5044 -> Elasticsearch :9200 (HTTPS) -> Kibana :5601
```

- ก่อนติดตั้งครั้งแรก ต้องสร้าง Secret 2 ตัวเองใน namespace `logging` เพราะ chart ไม่สุ่มรหัสผ่านหรือ cert ให้
  (ArgoCD render ด้วย `helm template` ซึ่งใช้ `lookup` ไม่ได้ ถ้าให้ chart สุ่ม ค่าจะเปลี่ยนทุกครั้งที่ sync แล้ว login ไม่ได้):
  ```sh
  # TLS: elk-tls (ca.crt, tls.crt, tls.key)
  elk-chart/scripts/create-certs.sh elk logging kind-argocd-lab

  # รหัสผ่าน: elk-es-credentials (kibana-encryption-key ต้องยาวอย่างน้อย 32 ตัว)
  kubectl --context kind-argocd-lab -n logging create secret generic elk-es-credentials \
    --from-literal=elastic-password="$(openssl rand -hex 16)" \
    --from-literal=kibana-system-password="$(openssl rand -hex 16)" \
    --from-literal=logstash-password="$(openssl rand -hex 16)" \
    --from-literal=kibana-encryption-key="$(openssl rand -hex 32)"
  ```
- ติดตั้งใน namespace `logging` ผ่าน Argo CD (`argocd/elk-app.yaml`); ใช้ GitOps repo เป็นแหล่ง configuration:
  แก้ `elk-chart/values.yaml` ใน GitOps repo แล้ว commit/push เพื่อให้ Argo CD sync
- เปิด security: ต้องใช้รหัสผ่าน และ Elasticsearch ใช้ TLS
- Logstash แยก log ของ NestJS ออกเป็น field `log.level`, `nest.context`, `nest.message`
- index รายวันชื่อ `k8s-logs-YYYY.MM.dd` ไม่เก็บ log ของ namespace `logging` เอง

เปิด Kibana:
```sh
# รหัสผ่านของ user elastic
kubectl --context kind-argocd-lab -n logging get secret elk-es-credentials -o jsonpath="{.data.elastic-password}" | base64 -d
kubectl --context kind-argocd-lab -n logging port-forward svc/elk-kibana 5601:5601
```
เข้า http://localhost:5601 → login `elastic` → **Analytics → Discover** → data view **Kubernetes logs**

ตัวอย่าง query: `kubernetes.namespace : "taskflow" and log.level : "error"`

> ELK ใช้ RAM ประมาณ 3 GB (ES 1.5 GB, Kibana 1 GB, Logstash 768 MB) ปรับได้ใน `elk-chart/values.yaml`
