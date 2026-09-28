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
        // Docker / Registry
        // =========================================================

        // Jenkins / Docker daemon ใช้ push ไปที่ registry container
        PUSH_REGISTRY = 'registry:5000'

        // kind local registry ที่ expose ออกมาทาง host port 5001
        DEPLOY_REGISTRY = 'localhost:5001'

        IMAGE = 'taskflow-backend'

        // =========================================================
        // GitOps
        // =========================================================

        GITOPS_REPO =
            'https://github.com/Alivefordie/test-ci-cd-gitops.git'

        GITOPS_BRANCH = 'main'
        GITOPS_DIR    = 'gitops'

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

        KIND_CLUSTER =
            "${params.KIND_CLUSTER ?: 'argocd-lab'}"

        NAMESPACE =
            "${params.NAMESPACE ?: 'taskflow'}"

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

                    env.TAG =
                        "${env.BUILD_NUMBER}-${commit}"

                    env.FULL_IMAGE =
                        "${env.PUSH_REGISTRY}/${env.IMAGE}:${env.TAG}"

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
                    sh '''
                        npm ci --no-audit --no-fund
                        npm test
                    '''
                }
            }
        }

        // =========================================================
        // BUILD
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

        // =========================================================
        // PUBLISH
        // =========================================================

        stage('Push image') {
            steps {
                sh '''
                    echo "Pushing image:"
                    echo "$FULL_IMAGE"

                    docker push $FULL_IMAGE
                '''
            }
        }

        // =========================================================
        // GITOPS
        // =========================================================

        stage('Checkout GitOps repo') {
            steps {
                dir("${GITOPS_DIR}") {
                    deleteDir()

                    git(
                        branch: "${GITOPS_BRANCH}",
                        credentialsId: 'github-jenkins',
                        url: "${GITOPS_REPO}"
                    )

                    sh '''
                        echo "=============================="
                        echo "GitOps repository"
                        echo "=============================="

                        git remote -v

                        echo
                        echo "Branch:"
                        git branch --show-current

                        echo
                        echo "Commit:"
                        git log -1 --oneline
                    '''
                }
            }
        }

        stage('Lint Helm charts') {
            steps {
                dir("${GITOPS_DIR}") {
                    sh '''
                        echo "Lint Taskflow chart..."
                        helm lint $TASKFLOW_CHART

                        echo
                        echo "Lint ELK chart..."
                        helm lint $ELK_CHART
                    '''
                }
            }
        }

        stage('Update GitOps manifest') {
            steps {
                dir("${GITOPS_DIR}") {
                    sh '''
                        echo "=============================="
                        echo "Updating Taskflow image"
                        echo "=============================="

                        echo "Repository:"
                        echo "$DEPLOY_REGISTRY/$IMAGE"

                        echo
                        echo "Tag:"
                        echo "$TAG"

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
                                echo "=============================="
                                echo "GitOps staged diff"
                                echo "=============================="

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
                        usernamePassword(
                            credentialsId: 'github-jenkins',
                            usernameVariable: 'GIT_USERNAME',
                            passwordVariable: 'GIT_TOKEN'
                        )
                    ]) {
                        sh '''
                            echo "Pushing GitOps commit..."

                            git push \
                              https://$GIT_USERNAME:$GIT_TOKEN@github.com/Alivefordie/test-ci-cd-gitops.git \
                              HEAD:$GITOPS_BRANCH
                        '''
                    }

                    echo "GitOps repo updated with tag: ${env.TAG}"
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

                    echo "=============================="
                    echo "Cluster"
                    echo "=============================="

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
        // VERIFY
        // =========================================================

        stage('Verify deployment') {
            steps {
                sh '''
                    echo "=============================="
                    echo "Taskflow"
                    echo "=============================="

                    kubectl -n $NAMESPACE get pods

                    echo
                    kubectl -n $NAMESPACE get svc

                    echo
                    echo "=============================="
                    echo "Deployment images"
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

Push image:
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

Rollback by reverting the GitOps commit
or restoring the previous image tag.

Do not use helm rollback.
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
