module.exports = {
  apps: [
    {
      name: 'bbank-app',
      script: 'dist/src/main.js',
      instances: 1, // ou 'max' pour mode cluster selon CPU du VPS
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
