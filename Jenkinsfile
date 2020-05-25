pipeline {
    agent any

    stages {
        stage('Install Dependencies') {
            steps {
                sh 'npm i'
            }
        }
        stage('Verification') {
            steps {
                parallel(
                    "testing": {
                        sh 'npm run test-cov'
                    },
                    "linting": {
                        sh 'npm run lint'
                    }
                )
            }
        }
        stage('Publish') {
            when { branch 'master' }
            steps {
                sh 'docker build -t elite-dangerous-copilot-daemon:latest .'
                sh 'docker push elite-dangerous-copilot-daemon:latest'
            }
        }
    }

    post {
        always {
            archiveArtifacts artifacts: 'coverage/lcov-report/**/*', fingerprint: true
        }
    }
}
