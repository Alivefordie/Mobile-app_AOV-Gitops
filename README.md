# test-ci-cd

TaskFlow backend (NestJS + PostgreSQL) ที่ deploy ขึ้น Kubernetes ด้วย Helm ผ่าน Jenkins

```
backend/          NestJS API + Dockerfile + docker-compose (สำหรับรันในเครื่อง)
taskflow-chart/   Helm chart: backend Deployment + PostgreSQL StatefulSet
elk-chart/        Helm chart: Filebeat -> Logstash -> Elasticsearch -> Kibana (เก็บ log ทุก pod)
jenkins/          Jenkins สำหรับ CI/CD (docker compose)
Jenkinsfile       pipeline: test -> lint charts -> build image -> kind load -> deploy app -> smoke test -> deploy ELK
```

## รันในเครื่องด้วย docker compose

```sh
cd backend
JWT_SECRET=some-secret docker compose up -d --build
curl http://localhost:3000   # Hello World!
```

## Deploy ขึ้น kind ด้วยมือ

```sh
kind create cluster --name aohelm-test
docker build -t taskflow-backend:dev backend
kind load docker-image taskflow-backend:dev --name aohelm-test
helm upgrade --install taskflow ./taskflow-chart --kube-context kind-aohelm-test \
  -n taskflow --create-namespace \
  --set image.tag=dev --set secrets.jwtSecret=some-secret --wait
kubectl --context kind-aohelm-test -n taskflow port-forward svc/taskflow-taskflow-chart 8080:80
```

## CI/CD ด้วย Jenkins

1. ต้องมี kind cluster `aohelm-test` ก่อน (Jenkins ต่อเข้า Docker network `kind`)
2. `cp jenkins/.env.example jenkins/.env` แล้วตั้งรหัสผ่าน admin และ JWT secret
3. `cd jenkins && docker compose up -d --build`
4. เข้า http://localhost:8090 (user `admin`) จะมี job `taskflow` สร้างไว้แล้ว
5. job จะเช็ค branch `main` ของ repo นี้ในเครื่องทุก 1 นาที มี commit ใหม่เมื่อไรจะ build และ deploy ให้เอง หรือกด **Build Now** ก็ได้

> Jenkins อ่านจาก commit ใน git ไม่ใช่ไฟล์ที่ยังไม่ commit

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
  elk-chart/scripts/create-certs.sh elk logging kind-aohelm-test

  # รหัสผ่าน: elk-es-credentials (kibana-encryption-key ต้องยาวอย่างน้อย 32 ตัว)
  kubectl --context kind-aohelm-test -n logging create secret generic elk-es-credentials \
    --from-literal=elastic-password="$(openssl rand -hex 16)" \
    --from-literal=kibana-system-password="$(openssl rand -hex 16)" \
    --from-literal=logstash-password="$(openssl rand -hex 16)" \
    --from-literal=kibana-encryption-key="$(openssl rand -hex 32)"
  ```
- ติดตั้งอยู่ใน namespace `logging` ผ่าน ArgoCD (`argocd/elk-app.yaml`) หรือ stage **Deploy ELK** ใน Jenkins หรือจะติดตั้งด้วยมือก็ได้:
  ```sh
  helm upgrade --install elk ./elk-chart --kube-context kind-aohelm-test -n logging --create-namespace --wait --timeout 15m
  ```
- เปิด security: ต้องใช้รหัสผ่าน และ Elasticsearch ใช้ TLS
- Logstash แยก log ของ NestJS ออกเป็น field `log.level`, `nest.context`, `nest.message`
- index รายวันชื่อ `k8s-logs-YYYY.MM.dd` ไม่เก็บ log ของ namespace `logging` เอง

เปิด Kibana:
```sh
# รหัสผ่านของ user elastic
kubectl --context kind-aohelm-test -n logging get secret elk-es-credentials -o jsonpath="{.data.elastic-password}" | base64 -d
kubectl --context kind-aohelm-test -n logging port-forward svc/elk-kibana 5601:5601
```
เข้า http://localhost:5601 → login `elastic` → **Analytics → Discover** → data view **Kubernetes logs**

ตัวอย่าง query: `kubernetes.namespace : "taskflow" and log.level : "error"`

> ELK ใช้ RAM ประมาณ 3 GB (ES 1.5 GB, Kibana 1 GB, Logstash 768 MB) ปรับได้ใน `elk-chart/values.yaml`
