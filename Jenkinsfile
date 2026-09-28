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
        // =========================================================
        // Docker
        // =========================================================

        // Jenkins / DinD ใช้ push เข้า registry container
        PUSH_REGISTRY = 'registry:5000'

        // image name ที่เขียนลง GitOps repo
        // ปรับตาม kind local-registry configuration ของคุณ
        DEPLOY_REGISTRY = 'localhost:5000'

        IMAGE = 'taskflow-backend'

        // =========================================================
        // GitOps
        // =========================================================

        GITOPS_REPO   = 'git@github.com:Alivefordie/test-ci-cd-gitops.git'
        GITOPS_BRANCH = 'main'

        GITOPS_DIR = 'gitops'

        TASKFLOW_CHART = 'taskflow-chart'
        ELK_CHART      = 'elk-chart'

        // =========================================================
        // Argo CD
        // =========================================================

        ARGOCD_NAMESPACE = 'argocd'
        TASKFLOW_APP     = 'taskflow'
        ELK_APP          = 'elk'

        // =========================================================
        // Kubernetes
        // =========================================================

        KUBECONFIG = "${WORKSPACE}/.kubeconfig"

        KIND_CLUSTER = "${params.KIND_CLUSTER ?: 'argocd-lab'}"
        NAMESPACE    = "${params.NAMESPACE ?: 'taskflow'}"

        ELK_NAMESPACE = 'logging'
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

                    // image ที่ Jenkins build + push
                    env.FULL_IMAGE =
                        "${env.PUSH_REGISTRY}/${env.IMAGE}:${env.TAG}"

                    // image ที่ Kubernetes จะ deploy
                    env.DEPLOY_IMAGE =
                        "${env.DEPLOY_REGISTRY}/${env.IMAGE}:${env.TAG}"
                }

                echo "Commit       : ${env.GIT_COMMIT}"
                echo "Image tag    : ${env.TAG}"
                echo "Push image   : ${env.FULL_IMAGE}"
                echo "Deploy image : ${env.DEPLOY_IMAGE}"
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

        // =========================================================
        // Build
        // =========================================================

        stage('Build image') {
            steps {
                sh '''
                    docker buildx build \
                      --load \
                      -t $FULL_IMAGE \
                      backend
                '''
            }
        }

        stage('Push image') {
            steps {
                sh '''
                    echo "Pushing $FULL_IMAGE"

                    docker push $FULL_IMAGE
                '''
            }
        }

        // =========================================================
        // GitOps
        // =========================================================

        stage('Checkout GitOps repo') {
            steps {
                dir("${GITOPS_DIR}") {
                    deleteDir()

                    git(
                        branch: "${GITOPS_BRANCH}",
                        credentialsId: 'github-ssh',
                        url: "${GITOPS_REPO}"
                    )

                    sh '''
                        echo "GitOps repository:"
                        git remote -v

                        echo
                        echo "Current branch:"
                        git branch --show-current

                        echo
                        echo "Current commit:"
                        git log -1 --oneline
                    '''
                }
            }
        }

        stage('Lint Helm charts') {
            steps {
                dir("${GITOPS_DIR}") {
                    sh '''
                        helm lint $TASKFLOW_CHART
                        helm lint $ELK_CHART
                    '''
                }
            }
        }

        stage('Update GitOps manifest') {
            steps {
                dir("${GITOPS_DIR}") {
                    sh '''
                        echo "Updating Taskflow image..."
                        echo "Image: $DEPLOY_IMAGE"

                        yq -i \
                          '.image.repository = strenv(DEPLOY_REGISTRY) + "/" + strenv(IMAGE) |
                           .image.tag = strenv(TAG)' \
                          $TASKFLOW_CHART/values.yaml

                        echo
                        echo "Updated image values:"
                        yq '.image' $TASKFLOW_CHART/values.yaml

                        echo
                        echo "Git diff:"
                        git diff -- $TASKFLOW_CHART/values.yaml
                    '''
                }
            }
        }

        stage('Commit GitOps change') {
            steps {
                dir("${GITOPS_DIR}") {
                    script {
                        sh '''
                            git config user.name "jenkins"
                            git config user.email "jenkins@taskflow.local"

                            git add $TASKFLOW_CHART/values.yaml
                        '''

                        def hasChanges = sh(
                            script: 'git diff --cached --quiet',
                            returnStatus: true
                        )

                        if (hasChanges == 0) {
                            env.GITOPS_CHANGED = 'false'
                            echo 'No GitOps changes'
                        } else {
                            env.GITOPS_CHANGED = 'true'

                            sh '''
                                git diff --cached

                                git commit \
                                  -m "deploy: taskflow $TAG"
                            '''
                        }
                    }
                }
            }
        }

        stage('Push GitOps change') {
            when {
                expression {
                    env.GITOPS_CHANGED == 'true'
                }
            }

            steps {
                dir("${GITOPS_DIR}") {
                    withCredentials([
                        sshUserPrivateKey(
                            credentialsId: 'github-ssh',
                            keyFileVariable: 'SSH_KEY',
                            usernameVariable: 'SSH_USER'
                        )
                    ]) {
                        sh '''
                            export GIT_SSH_COMMAND="ssh \
                              -i $SSH_KEY \
                              -o StrictHostKeyChecking=no"

                            git push origin HEAD:$GITOPS_BRANCH
                        '''
                    }

                    echo "GitOps repo updated: ${env.TAG}"
                }
            }
        }

        // =========================================================
        // Argo CD
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
                        echo "Waiting for Argo CD..."

                        while true; do

                          SYNC=$(kubectl \
                            -n $ARGOCD_NAMESPACE \
                            get application $TASKFLOW_APP \
                            -o jsonpath='{.status.sync.status}')

                          HEALTH=$(kubectl \
                            -n $ARGOCD_NAMESPACE \
                            get application $TASKFLOW_APP \
                            -o jsonpath='{.status.health.status}')

                          REVISION=$(kubectl \
                            -n $ARGOCD_NAMESPACE \
                            get application $TASKFLOW_APP \
                            -o jsonpath='{.status.sync.revision}')

                          echo "sync=$SYNC health=$HEALTH revision=$REVISION"

                          if [ "$SYNC" = "Synced" ] && \
                             [ "$HEALTH" = "Healthy" ]; then

                            echo "Argo CD synchronization completed"
                            break
                          fi

                          sleep 5

                        done
                    '''
                }
            }
        }

        // =========================================================
        // Verify
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
                    echo "Deployment image"
                    echo "=============================="

                    kubectl -n $NAMESPACE \
                      get deployment \
                      -o custom-columns=NAME:.metadata.name,IMAGE:.spec.template.spec.containers[*].image

                    echo
                    echo "=============================="
                    echo "ELK"
                    echo "=============================="

                    kubectl -n $ELK_NAMESPACE get pods
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

			Build image:
			${env.FULL_IMAGE}

			Deploy image:
			${env.DEPLOY_IMAGE}

			GitOps repo:
			${env.GITOPS_REPO}

			Argo CD application:
			${env.TASKFLOW_APP}
			=============================================
		"""
        }

        failure {
            echo '''
=============================================
Pipeline failed

Deployment is managed by Argo CD.

Rollback:
revert the GitOps commit or restore the
previous image tag in Git.

Do not use helm rollback for this deployment.
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
