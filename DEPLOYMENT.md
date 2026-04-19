# Deployment Guide

This project is deployment-ready for this free-tier split:

- Frontend: Vercel
- Backend: Koyeb
- Socket server: Render
- MySQL: Aiven

## 1. Database on Aiven

1. Create a free MySQL service on Aiven.
2. Create a database named `chat_app` if it is not created automatically.
3. Copy:
   - host
   - port
   - database name
   - username
   - password
   - CA certificate settings if Aiven requires SSL in your chosen connection mode

## 2. Backend on Koyeb

Deploy the `backend` folder as a Docker-based service from GitHub.

### Koyeb app settings

- Root directory: `backend`
- Dockerfile path: `Dockerfile`
- Exposed port: Koyeb will inject `PORT`

### Required environment variables

- `APP_NAME=ChatAPP`
- `APP_ENV=production`
- `APP_DEBUG=false`
- `APP_URL=https://YOUR-KOYEB-BACKEND-DOMAIN`
- `APP_KEY=base64:...`
- `LOG_CHANNEL=stack`
- `LOG_LEVEL=info`
- `DB_CONNECTION=mysql`
- `DB_HOST=...`
- `DB_PORT=...`
- `DB_DATABASE=chat_app`
- `DB_USERNAME=...`
- `DB_PASSWORD=...`
- `SESSION_DRIVER=database`
- `CACHE_STORE=database`
- `QUEUE_CONNECTION=database`
- `RUN_MIGRATIONS=true`
- `DIALOGFLOW_PROJECT_ID=chat-bot-project-493715`
- `DIALOGFLOW_LANGUAGE=en`
- `CORS_ALLOWED_ORIGINS=https://YOUR-FRONTEND-DOMAIN,https://YOUR-RENDER-SOCKET-DOMAIN`

### Dialogflow secret on Koyeb

Use one of these options:

- Recommended: `DIALOGFLOW_CREDENTIALS_BASE64`
- Alternative: `DIALOGFLOW_CREDENTIALS_JSON`

To generate base64 from the JSON file on Windows PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("D:\chat-bot-project-493715-37aeae167785.json"))
```

Paste the resulting string into `DIALOGFLOW_CREDENTIALS_BASE64`.

### Generate APP_KEY locally

From the `backend` folder:

```bash
php artisan key:generate --show
```

## 3. Socket server on Render

Use the root-level [render.yaml](/C:/wamp64/www/dialogflow-realtime-chat-app/render.yaml) blueprint or create the service manually.

### Manual Render settings

- Service type: Web Service
- Environment: Node
- Root directory: `socketserver`
- Build command: `npm install`
- Start command: `npm start`
- Health check path: `/health`

### Required env vars

- `NODE_ENV=production`
- `BACKEND_API_URL=https://YOUR-KOYEB-BACKEND-DOMAIN/api`

### Logs

Render dashboard logs will show the structured JSON lines emitted by the socket server.

## 4. Frontend on Vercel

Create a Vercel project from the same GitHub repository.

### Vercel project settings

- Root Directory: `frontend`
- Framework Preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`

### Required env vars

- `VITE_API_BASE_URL=https://YOUR-KOYEB-BACKEND-DOMAIN/api`
- `VITE_SOCKET_URL=wss://YOUR-RENDER-SOCKET-DOMAIN`

The [frontend/vercel.json](/C:/wamp64/www/dialogflow-realtime-chat-app/frontend/vercel.json) file handles SPA rewrites.

## 5. Post-deploy checks

1. Open the frontend URL.
2. Log in with:
   - `test@example.com`
   - `password`
3. Create a session.
4. Send a message.
5. Confirm:
   - session creation works
   - socket auth succeeds
   - backend receives the message
   - Dialogflow returns a response
   - MySQL stores `chat_sessions` and `chat_messages`

## 6. Troubleshooting

### If backend deploys but returns 500

- Verify `APP_KEY`
- Verify all DB variables
- Verify `SESSION_DRIVER=database`
- Verify migrations completed successfully

### If Dialogflow fails in cloud

- Prefer `DIALOGFLOW_CREDENTIALS_BASE64` instead of file paths
- Confirm the service account key is still active in Google Cloud
- Confirm Dialogflow ES API is enabled on the same project

### If socket connects but no reply returns

- Check Render logs for:
  - `socket.auth.success`
  - `backend.request.start`
  - `backend.request.finish`
  - `socket.chat.forward.success`

### If frontend opens but API fails

- Verify exact frontend domain is included in backend `CORS_ALLOWED_ORIGINS`
- Verify `VITE_API_BASE_URL` points to `/api`
- Verify `VITE_SOCKET_URL` uses `wss://` in production
