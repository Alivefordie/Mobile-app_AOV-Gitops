{{/*
Resource name for a component, e.g. "elk-elasticsearch"
*/}}
{{- define "elk.name" -}}
{{- printf "%s-%s" .root.Release.Name .component | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "elk.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .root.Chart.Name .root.Chart.Version }}
app.kubernetes.io/managed-by: {{ .root.Release.Service }}
app.kubernetes.io/part-of: elk
{{ include "elk.selectorLabels" . }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "elk.selectorLabels" -}}
app.kubernetes.io/name: {{ .component }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
{{- end }}

{{/*
Elasticsearch HTTPS URL inside the cluster
*/}}
{{- define "elk.esUrl" -}}
{{- printf "https://%s-elasticsearch:9200" .Release.Name }}
{{- end }}

{{- define "elk.credentialsSecret" -}}
{{- .Values.credentials.existingSecret | default (printf "%s-credentials" .Release.Name) }}
{{- end }}

{{/*
Created outside the chart, so ArgoCD never regenerates it. The default name
differs from the old chart-managed "<release>-certs" so pruning that one
does not delete this one.
*/}}
{{- define "elk.certsSecret" -}}
{{- .Values.certs.secretName | default (printf "%s-tls" .Release.Name) }}
{{- end }}

{{/*
Env vars carrying the passwords, for any container that needs them
*/}}
{{- define "elk.passwordEnv" -}}
- name: ELASTIC_PASSWORD
  valueFrom:
    secretKeyRef:
      name: {{ include "elk.credentialsSecret" . }}
      key: elastic-password
- name: KIBANA_SYSTEM_PASSWORD
  valueFrom:
    secretKeyRef:
      name: {{ include "elk.credentialsSecret" . }}
      key: kibana-system-password
- name: LOGSTASH_PASSWORD
  valueFrom:
    secretKeyRef:
      name: {{ include "elk.credentialsSecret" . }}
      key: logstash-password
{{- end }}

{{/*
Init container: wait for Elasticsearch, then (idempotently) set the
kibana_system password and create the Logstash writer role and user.
*/}}
{{- define "elk.setupInitContainer" -}}
- name: elk-setup
  image: "{{ .Values.setupImage }}:{{ .Values.elasticVersion }}"
  command: ["bash", "/scripts/setup.sh"]
  env:
    - name: ES_URL
      value: {{ include "elk.esUrl" . | quote }}
    {{- include "elk.passwordEnv" . | nindent 4 }}
  volumeMounts:
    - name: certs
      mountPath: /certs
      readOnly: true
    - name: setup-script
      mountPath: /scripts
      readOnly: true
{{- end }}
