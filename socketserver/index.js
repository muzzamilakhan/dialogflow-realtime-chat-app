import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';

const port = Number(process.env.PORT || 3001);
const backendApiUrl = (
  process.env.BACKEND_API_URL ||
  'http://localhost/dialogflow-realtime-chat-app/backend/public/api'
).replace(/\/$/, '');

const server = createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(
      JSON.stringify({
        ok: true,
        service: 'dialogflow-chat-socketserver',
      }),
    );
    return;
  }

  response.writeHead(404, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify({ message: 'Not found' }));
});

const wss = new WebSocketServer({ server });

function send(socket, payload) {
  if (socket.readyState === 1) {
    socket.send(JSON.stringify(payload));
  }
}

async function requestBackend(path, options = {}) {
  const response = await fetch(`${backendApiUrl}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  });

  let payload = {};

  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  return {
    ok: response.ok,
    status: response.status,
    payload,
  };
}

function socketState() {
  return {
    authenticated: false,
    sessionId: null,
    token: '',
  };
}

wss.on('connection', (socket) => {
  socket.state = socketState();

  socket.on('message', async (rawData) => {
    let event;

    try {
      event = JSON.parse(rawData.toString());
    } catch {
      send(socket, {
        type: 'error',
        code: 'BAD_REQUEST',
        message: 'Socket payload must be valid JSON.',
      });
      return;
    }

    if (event.type === 'auth') {
      if (!event.token || !event.sessionId) {
        send(socket, {
          type: 'error',
          code: 'AUTH_FAILED',
          message: 'A token and sessionId are required to open the socket stream.',
        });
        return;
      }

      const historyResponse = await requestBackend(
        `/chat/sessions/${event.sessionId}/messages`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${event.token}`,
          },
        },
      );

      if (!historyResponse.ok) {
        send(socket, {
          type: 'error',
          code: historyResponse.status === 401 ? 'AUTH_FAILED' : 'UPSTREAM_ERROR',
          message:
            historyResponse.payload.message ||
            'Unable to verify this session with Laravel.',
          sessionId: event.sessionId,
        });
        return;
      }

      socket.state = {
        authenticated: true,
        sessionId: event.sessionId,
        token: event.token,
      };

      send(socket, {
        type: 'chat:history',
        sessionId: event.sessionId,
        session: historyResponse.payload.session,
        messages: historyResponse.payload.messages || [],
      });
      return;
    }

    if (!socket.state.authenticated) {
      send(socket, {
        type: 'error',
        code: 'AUTH_REQUIRED',
        message: 'Authenticate this socket before sending chat messages.',
      });
      return;
    }

    if (event.type === 'chat:send') {
      if (!event.message || !String(event.message).trim()) {
        send(socket, {
          type: 'error',
          code: 'VALIDATION_FAILED',
          message: 'Message text is required.',
          sessionId: socket.state.sessionId,
        });
        return;
      }

      const upstreamResponse = await requestBackend(
        `/chat/sessions/${socket.state.sessionId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${socket.state.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: String(event.message).trim(),
          }),
        },
      );

      if (!upstreamResponse.ok) {
        send(socket, {
          type: 'error',
          code:
            upstreamResponse.status === 422
              ? 'VALIDATION_FAILED'
              : upstreamResponse.status === 401
                ? 'AUTH_FAILED'
                : 'UPSTREAM_ERROR',
          message:
            upstreamResponse.payload.message ||
            'Laravel could not process the message request.',
          sessionId: socket.state.sessionId,
        });
        return;
      }

      send(socket, {
        type: 'chat:message',
        sessionId: socket.state.sessionId,
        session: upstreamResponse.payload.session,
        messages: [
          upstreamResponse.payload.user_message,
          upstreamResponse.payload.bot_message,
        ],
      });
      return;
    }

    send(socket, {
      type: 'error',
      code: 'BAD_REQUEST',
      message: `Unsupported socket event type: ${event.type}.`,
      sessionId: socket.state.sessionId,
    });
  });
});

server.listen(port, () => {
  console.log(
    `Socket server listening on http://localhost:${port} and proxying ${backendApiUrl}`,
  );
});
