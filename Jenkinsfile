// RepoRadar CI (Jenkins is the house CI/CD convention, not GitHub Actions).
// Zero-dependency Node tool: no install step, just run the built-in test runner.
pipeline {
  agent { label 'linux' }

  options {
    timestamps()
    timeout(time: 10, unit: 'MINUTES')
    disableConcurrentBuilds()
  }

  stages {
    stage('Node version') {
      steps {
        sh 'node --version'
      }
    }
    stage('Test') {
      steps {
        // RepoRadar has no npm dependencies; run Node's built-in test runner.
        sh 'node --test'
      }
    }
    stage('Smoke (self-scan)') {
      steps {
        // Sanity-check the CLI runs end to end against the bundled demo fixture.
        // The demo is intentionally red, so exit 2 is the PASS condition — assert it
        // explicitly instead of `|| true`, which would also swallow a CLI crash (exit 1).
        sh 'node bin/reporadar.js scan demo/sample-repo --json out/ci-scan.json; rc=$?; [ "$rc" -eq 2 ]'
      }
    }
  }

  post {
    always {
      cleanWs()
    }
  }
}
