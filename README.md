# Dialogflow Realtime Chat App

React frontend, Laravel backend, and a separate Node.js WebSocket server for a full evaluation-ready Dialogflow ES chat flow.

## Architecture

1. React sends live chat events over WebSocket.
2. `socketserver` validates the bearer token and active session against Laravel.
3. Laravel stores the message, calls Dialogflow ES through the REST API, stores the bot reply, and returns both message records.
4. `socketserver` pushes the response back to the browser instantly.

## Project structure

```text
dialogflow-realtime-chat-app/
├── backend/
├── frontend/
└── socketserver/
```

## Demo credentials

- Email: `test@example.com`
- Password: `password`

## Required environment values

Set these in [backend/.env](/C:/wamp64/www/dialogflow-realtime-chat-app/backend/.env):

- `APP_URL=http://localhost/dialogflow-realtime-chat-app/backend/public`
- `DB_CONNECTION=mysql`
- `DB_DATABASE=chat_app`
- `DB_USERNAME=root`
- `DB_PASSWORD=`
- `DIALOGFLOW_PROJECT_ID=...`
- `DIALOGFLOW_CLIENT_EMAIL=...`
- `DIALOGFLOW_CREDENTIALS_PATH=D:/chat-bot-project-493715-37aeae167785.json`
- `DIALOGFLOW_CA_BUNDLE_PATH=C:/wamp64/bin/php/php8.3.14/cacert.pem`
- `DIALOGFLOW_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"`
- `DIALOGFLOW_LANGUAGE=en`
- `CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:3001,http://127.0.0.1:3001`

Optional frontend overrides:

- `frontend/.env` -> `VITE_API_BASE_URL=http://localhost/dialogflow-realtime-chat-app/backend/public/api`
- `frontend/.env` -> `VITE_SOCKET_URL=ws://localhost:3001`

Optional socket server override:

- `socketserver/.env` or shell env -> `BACKEND_API_URL=http://localhost/dialogflow-realtime-chat-app/backend/public/api`

For the most reliable Google auth setup, prefer `DIALOGFLOW_CREDENTIALS_PATH` and keep the full service-account JSON outside the repo.

## Setup

### 1. Backend

```bash
cd backend
composer install
php artisan migrate --seed
```

If you prefer `php artisan serve`, update `APP_URL` and the frontend/socket URLs to match `http://127.0.0.1:8000/api`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

### 3. Socket server

```bash
cd socketserver
npm install
npm run dev
```

Run with PM2:

```bash
cd socketserver
npm install -g pm2
npm run pm2:start
```

PM2 log files:

- `socketserver/logs/output.log`
- `socketserver/logs/error.log`
- `socketserver/logs/combined.log`

## API summary

- `POST /api/login`
- `POST /api/logout`
- `GET /api/chat/sessions`
- `POST /api/chat/sessions`
- `GET /api/chat/sessions/{session}/messages`
- `POST /api/chat/sessions/{session}/messages`

## WebSocket event summary

Client to server:

- `{ "type": "auth", "token": "...", "sessionId": 1 }`
- `{ "type": "chat:send", "message": "Hello" }`

Server to client:

- `{ "type": "chat:history", "sessionId": 1, "messages": [...] }`
- `{ "type": "chat:message", "sessionId": 1, "messages": [userMessage, botMessage] }`
- `{ "type": "error", "code": "AUTH_FAILED", "message": "..." }`

## Socket observability

The socket server now logs:

- server start and fatal process errors
- websocket connect / disconnect / socket errors
- raw incoming client messages
- parsed event types like `auth` and `chat:send`
- Laravel upstream request start / finish / failure
- message transfer summaries from client to backend and back to client
- active connected client counts in `GET /health`

## Demo checklist

- Show the three-folder architecture.
- Log in with the seeded demo user.
- Create a new chat session and send a message.
- Show MySQL `chat_sessions` and `chat_messages`.
- Show Dialogflow intent names returning with bot messages.
- Stop the socket server briefly to show reconnect/error handling.
