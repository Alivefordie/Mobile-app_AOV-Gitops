pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    timeout(time: 30, unit: 'MINUTES')
  }

  parameters {
    string(name: 'KIND_CLUSTER', defaultValue: 'aohelm-test', description: 'kind cluster to deploy to')
    string(name: 'NAMESPACE', defaultValue: 'taskflow', description: 'Kubernetes namespace')
  }

  environment {
    IMAGE      = 'taskflow-backend'
    RELEASE    = 'taskflow'
    CHART      = './taskflow-chart'
    KUBECONFIG = "${WORKSPACE}/.kubeconfig"
    // params are empty on the very first run, before Jenkins has read this file
    KIND_CLUSTER = "${params.KIND_CLUSTER ?: 'aohelm-test'}"
    NAMESPACE    = "${params.NAMESPACE ?: 'taskflow'}"
  }

  stages {
    stage('Prepare') {
      steps {
        script {
          env.TAG = "${env.BUILD_NUMBER}-${env.GIT_COMMIT.take(7)}"
        }
        echo "Image tag: ${env.TAG}"
      }
    }

    stage('Test backend') {
      steps {
        dir('backend') {
          sh 'npm ci --no-audit --no-fund'
          sh 'npm test'
        }
      }
    }

    stage('Lint chart') {
      steps {
        sh 'helm lint $CHART'
      }
    }

    stage('Build image') {
      steps {
        sh 'docker build -t $IMAGE:$TAG backend'
      }
    }

    stage('Load image into kind') {
      steps {
        sh 'kind load docker-image $IMAGE:$TAG --name $KIND_CLUSTER'
      }
    }

    stage('Deploy') {
      steps {
        // --internal: reach the API server over the kind Docker network
        sh 'kind get kubeconfig --name $KIND_CLUSTER --internal > $KUBECONFIG'
        withCredentials([string(credentialsId: 'taskflow-jwt-secret', variable: 'JWT_SECRET')]) {
          sh '''
            helm upgrade --install $RELEASE $CHART \
              --namespace $NAMESPACE --create-namespace \
              --set image.repository=$IMAGE \
              --set image.tag=$TAG \
              --set secrets.jwtSecret=$JWT_SECRET \
              --wait --timeout 5m
          '''
        }
      }
    }

    stage('Smoke test') {
      steps {
        sh 'helm test $RELEASE --namespace $NAMESPACE --logs'
        sh 'kubectl -n $NAMESPACE get pods'
      }
    }
  }

  post {
    failure {
      echo "Deploy failed. Roll back with: helm rollback ${env.RELEASE} -n ${env.NAMESPACE}"
    }
    always {
      sh 'rm -f $KUBECONFIG'
    }
  }
}
