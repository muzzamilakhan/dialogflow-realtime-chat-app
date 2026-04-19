module.exports = {
  apps: [
    {
      name: 'dialogflow-chat-socketserver',
      script: './index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 3000,
      time: true,
      out_file: './logs/output.log',
      error_file: './logs/error.log',
      log_file: './logs/combined.log',
      merge_logs: true,
      env: {
        NODE_ENV: 'development',
        PORT: 3001,
        BACKEND_API_URL:
          'http://localhost/dialogflow-realtime-chat-app/backend/public/api',
      },
    },
  ],
};
