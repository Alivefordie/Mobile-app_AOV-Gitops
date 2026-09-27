pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        timeout(time: 45, unit: 'MINUTES')
    }

    parameters {
        string(
      name: 'KIND_CLUSTER',
      defaultValue: 'argocd-lab',
      description: 'kind cluster used by Argo CD'
    )

        string(
      name: 'NAMESPACE',
      defaultValue: 'taskflow',
      description: 'Taskflow Kubernetes namespace'
    )
    }

    environment {
        // Docker Registry
        REGISTRY = 'localhost:5000'
        IMAGE    = 'taskflow-backend'

        // Helm charts
        CHART     = './taskflow-chart'
        ELK_CHART = './elk-chart'

        // Argo CD Applications
        ARGOCD_NAMESPACE = 'argocd'
        TASKFLOW_APP     = 'taskflow'
        ELK_APP          = 'elk'

        // Kubernetes
        KUBECONFIG = "${WORKSPACE}/.kubeconfig"

        KIND_CLUSTER = "${params.KIND_CLUSTER ?: 'argocd-lab'}"
        NAMESPACE    = "${params.NAMESPACE ?: 'taskflow'}"

        ELK_NAMESPACE = 'logging'

        // Branch watched by Argo CD
        GITOPS_BRANCH = 'main'
    }

    stages {
    // =========================================================
    // CI
    // =========================================================

        stage('Prepare') {
            steps {
                script {
                    def commit = sh(
            script: 'git rev-parse --short=7 HEAD',
            returnStdout: true
          ).trim()

                    env.TAG = "${env.BUILD_NUMBER}-${commit}"
                    env.FULL_IMAGE = "${env.REGISTRY}/${env.IMAGE}:${env.TAG}"
                }

                echo "Commit     : ${env.GIT_COMMIT}"
                echo "Image tag  : ${env.TAG}"
                echo "Docker image: ${env.FULL_IMAGE}"
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

        stage('Lint Helm charts') {
            steps {
                sh '''
          helm lint $CHART
          helm lint $ELK_CHART
        '''
            }
        }

    // =========================================================
    // BUILD
    // =========================================================

        stage('Build image') {
            steps {
                sh '''
          docker build \
            -t $FULL_IMAGE \
            backend
        '''
            }
        }

    // =========================================================
    // PUBLISH
    // =========================================================

        stage('Push image') {
            steps {
                sh '''
          docker push $FULL_IMAGE
        '''
            }
        }

    // =========================================================
    // GITOPS
    // =========================================================

        stage('Update GitOps manifest') {
            steps {
                sh '''
          echo "Updating Taskflow Helm values"

          yq -i \
            '.image.repository = strenv(REGISTRY) + "/" + strenv(IMAGE) |
             .image.tag = strenv(TAG)' \
            $CHART/values.yaml

          echo "Updated image:"
          yq '.image' $CHART/values.yaml
        '''
            }
        }

        stage('Commit GitOps change') {
            steps {
                sh '''
          git config user.name "jenkins"
          git config user.email "jenkins@taskflow.local"

          git add taskflow-chart/values.yaml

          if git diff --cached --quiet; then
            echo "No GitOps changes"
            exit 0
          fi

          git commit -m "deploy: taskflow $TAG"
        '''

                // เปลี่ยน github-ssh เป็น Jenkins credential ID ของคุณ
                sshagent(credentials: ['github-ssh']) {
                    sh '''
            git push origin HEAD:$GITOPS_BRANCH
          '''
                }
            }
        }

    // =========================================================
    // ARGO CD
    // =========================================================

        stage('Connect to cluster') {
            steps {
                sh '''
          kind get kubeconfig \
            --name $KIND_CLUSTER \
            --internal > $KUBECONFIG

          kubectl cluster-info
        '''
            }
        }

        stage('Wait for Argo CD') {
            steps {
                timeout(time: 10, unit: 'MINUTES') {
                    sh '''
            echo "Waiting for Argo CD to synchronize Taskflow..."

            while true; do

              SYNC=$(kubectl -n $ARGOCD_NAMESPACE \
                get application $TASKFLOW_APP \
                -o jsonpath='{.status.sync.status}')

              HEALTH=$(kubectl -n $ARGOCD_NAMESPACE \
                get application $TASKFLOW_APP \
                -o jsonpath='{.status.health.status}')

              echo "Taskflow: sync=$SYNC health=$HEALTH"

              if [ "$SYNC" = "Synced" ] && [ "$HEALTH" = "Healthy" ]; then
                break
              fi

              sleep 5

            done
          '''
                }
            }
        }

    // =========================================================
    // VERIFY
    // =========================================================

        stage('Verify deployment') {
            steps {
                sh '''
          echo "=============================="
          echo "Taskflow"
          echo "=============================="

          kubectl -n $NAMESPACE get pods
          kubectl -n $NAMESPACE get svc

          echo
          echo "=============================="
          echo "ELK"
          echo "=============================="

          kubectl -n $ELK_NAMESPACE get pods
          kubectl -n $ELK_NAMESPACE get svc
        '''
            }
        }

        stage('Smoke test') {
            steps {
                sh '''
          echo "Waiting for Taskflow pods..."

          kubectl -n $NAMESPACE wait \
            --for=condition=Ready \
            pod \
            -l app.kubernetes.io/instance=$TASKFLOW_APP \
            --timeout=300s
        '''
            }
        }
    }

    post {
        success {
            echo """
      =============================================
      GitOps deployment completed
      Image : ${env.FULL_IMAGE}
      ArgoCD: ${env.TASKFLOW_APP}
      =============================================
      """
        }

        failure {
            echo '''
      =============================================
      Pipeline failed

      IMPORTANT:
      Deployment is managed by Argo CD.

      Do NOT run:
        helm rollback

      Rollback should be done by reverting
      the GitOps commit / image tag in Git.
      =============================================
      '''
        }

        always {
            sh '''
        rm -f $KUBECONFIG
      '''
        }
    }
}
