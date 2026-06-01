module.exports = {
  apps: [
    {
      name: 'hsm-landing-4000',
      cwd: './frontend-landing',
      script: 'node_modules/next/dist/bin/next',
      args: 'dev -p 4000',
      interpreter: 'node',
      env: { NODE_ENV: 'development' }
    }
  ]
}
