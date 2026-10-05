{{/*
Expand the name of the chart.
*/}}
{{- define "taskflow-chart.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "taskflow-chart.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "taskflow-chart.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "taskflow-chart.labels" -}}
helm.sh/chart: {{ include "taskflow-chart.chart" . }}
{{ include "taskflow-chart.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "taskflow-chart.selectorLabels" -}}
app.kubernetes.io/name: {{ include "taskflow-chart.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "taskflow-chart.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "taskflow-chart.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
PostgreSQL resource name
*/}}
{{- define "taskflow-chart.postgresql.fullname" -}}
{{- printf "%s-postgresql" (include "taskflow-chart.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
PostgreSQL selector labels
*/}}
{{- define "taskflow-chart.postgresql.selectorLabels" -}}
app.kubernetes.io/name: {{ include "taskflow-chart.name" . }}-postgresql
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Database host the app connects to
*/}}
{{- define "taskflow-chart.databaseHost" -}}
{{- if .Values.postgresql.enabled }}
{{- include "taskflow-chart.postgresql.fullname" . }}
{{- else }}
{{- required "postgresql.externalHost is required when postgresql.enabled=false" .Values.postgresql.externalHost }}
{{- end }}
{{- end }}

{{/*
Redis resource name
*/}}
{{- define "taskflow-chart.redis.fullname" -}}
{{- printf "%s-redis" (include "taskflow-chart.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Redis selector labels
*/}}
{{- define "taskflow-chart.redis.selectorLabels" -}}
app.kubernetes.io/name: {{ include "taskflow-chart.name" . }}-redis
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Redis URL the app connects to
*/}}
{{- define "taskflow-chart.redisUrl" -}}
{{- if .Values.redis.enabled }}
{{- printf "redis://%s:%v" (include "taskflow-chart.redis.fullname" .) .Values.redis.port }}
{{- else }}
{{- required "redis.externalUrl is required when redis.enabled=false" .Values.redis.externalUrl }}
{{- end }}
{{- end }}

{{/*
Name of the Secret holding app credentials
*/}}
{{- define "taskflow-chart.secretName" -}}
{{- default (include "taskflow-chart.fullname" .) .Values.secrets.existingSecret }}
{{- end }}
