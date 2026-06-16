pipeline {
    agent any

    environment {
        REGISTRY = '192.168.7.38:5000'
        SERVICE = 'gateway'          
        IMAGE_TAG = 'latest'
        SERVER_IP = '192.168.7.38'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    echo "Build de l'image ${SERVICE}..."
                    sh """
                        docker build -t ${REGISTRY}/${SERVICE}:${IMAGE_TAG} .
                    """
                }
            }
        }

        stage('Push to Registry') {
            steps {
                script {
                    echo "Push vers le registry interne..."
                    sh """
                        docker push ${REGISTRY}/${SERVICE}:${IMAGE_TAG}
                    """
                }
            }
        }

        stage('Deploy') {
            steps {
                script {
                    echo "Déploiement via SSH vers deploy@${SERVER_IP}..."
                    sshagent(credentials: ['chu-deploy-ssh']) {
                        sh """
                            ssh -o StrictHostKeyChecking=no deploy@${SERVER_IP} '
                                cd /opt/chu-app &&
                                ./deploy.sh ${SERVICE}
                            '
                        """
                    }
                }
            }
        }
    }

    post {
        success {
            echo "Déploiement réussi du service ${SERVICE}"
        }
        failure {
            echo "Échec du pipeline pour ${SERVICE}"
        }
    }
}