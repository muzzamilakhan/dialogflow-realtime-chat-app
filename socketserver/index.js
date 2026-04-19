import { mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

mkdirSync(path.join(__dirname, 'logs'), { recursive: true });

const port = Number(process.env.PORT || 3001);
const backendApiUrl = (
  process.env.BACKEND_API_URL ||
  'http://localhost/dialogflow-realtime-chat-app/backend/public/api'
).replace(/\/$/, '');

let nextConnectionId = 1;
const activeConnections = new Map();

function now() {
  return new Date().toISOString();
}

function maskToken(token) {
  if (!token || typeof token !== 'string') {
    return '';
  }

  if (token.length <= 10) {
    return '***';
  }

  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

function summarizeMessages(messages = []) {
  return messages.map((message) => ({
    id: message?.id,
    sender_type: message?.sender_type,
    intent_name: message?.intent_name || null,
    preview: String(message?.message || '').slice(0, 80),
  }));
}

function log(level, event, details = {}) {
  const payload = {
    ts: now(),
    level,
    event,
    ...details,
  };

  const line = JSON.stringify(payload);

  if (level === 'error') {
    console.error(line);
    return;
  }

  console.log(line);
}

function socketState() {
  return {
    authenticated: false,
    sessionId: null,
    token: '',
    connectionId: nextConnectionId++,
    connectedAt: now(),
    remoteAddress: null,
  };
}

function send(socket, payload, meta = {}) {
  if (socket.readyState !== 1) {
    log('warn', 'socket.send.skipped', {
      connectionId: socket.state?.connectionId,
      reason: 'socket_not_open',
      payloadType: payload?.type,
    });
    return false;
  }

  socket.send(JSON.stringify(payload));

  log('info', 'socket.send', {
    connectionId: socket.state?.connectionId,
    sessionId: socket.state?.sessionId,
    payloadType: payload?.type,
    meta,
  });

  return true;
}

async function requestBackend(connectionId, pathName, options = {}) {
  const startedAt = Date.now();

  log('info', 'backend.request.start', {
    connectionId,
    url: `${backendApiUrl}${pathName}`,
    method: options.method || 'GET',
  });

  try {
    const response = await fetch(`${backendApiUrl}${pathName}`, {
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

    log(response.ok ? 'info' : 'warn', 'backend.request.finish', {
      connectionId,
      url: `${backendApiUrl}${pathName}`,
      method: options.method || 'GET',
      status: response.status,
      durationMs: Date.now() - startedAt,
      ok: response.ok,
    });

    return {
      ok: response.ok,
      status: response.status,
      payload,
    };
  } catch (error) {
    log('error', 'backend.request.error', {
      connectionId,
      url: `${backendApiUrl}${pathName}`,
      method: options.method || 'GET',
      durationMs: Date.now() - startedAt,
      message: error.message,
    });

    throw error;
  }
}

function createHealthPayload() {
  return {
    ok: true,
    service: 'dialogflow-chat-socketserver',
    connectedClients: activeConnections.size,
    backendApiUrl,
    uptimeSeconds: Math.round(process.uptime()),
  };
}

const server = createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(createHealthPayload()));
    return;
  }

  response.writeHead(404, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify({ message: 'Not found' }));
});

const wss = new WebSocketServer({ server });

process.on('uncaughtException', (error) => {
  log('error', 'process.uncaughtException', {
    message: error.message,
    stack: error.stack,
  });
});

process.on('unhandledRejection', (reason) => {
  log('error', 'process.unhandledRejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
  });
});

wss.on('connection', (socket, request) => {
  socket.state = socketState();
  socket.state.remoteAddress = request.socket.remoteAddress;

  activeConnections.set(socket.state.connectionId, {
    connectedAt: socket.state.connectedAt,
    remoteAddress: socket.state.remoteAddress,
  });

  log('info', 'socket.connection.open', {
    connectionId: socket.state.connectionId,
    remoteAddress: socket.state.remoteAddress,
    connectedClients: activeConnections.size,
  });

  socket.on('message', async (rawData) => {
    const rawText = rawData.toString();

    log('info', 'socket.message.received.raw', {
      connectionId: socket.state.connectionId,
      authenticated: socket.state.authenticated,
      sessionId: socket.state.sessionId,
      rawPreview: rawText.slice(0, 250),
    });

    let event;

    try {
      event = JSON.parse(rawText);
    } catch {
      send(
        socket,
        {
          type: 'error',
          code: 'BAD_REQUEST',
          message: 'Socket payload must be valid JSON.',
        },
        { reason: 'json_parse_failed' },
      );
      return;
    }

    log('info', 'socket.message.received.parsed', {
      connectionId: socket.state.connectionId,
      authenticated: socket.state.authenticated,
      sessionId: socket.state.sessionId,
      eventType: event.type,
      token: event.token ? maskToken(event.token) : undefined,
      messagePreview: event.message ? String(event.message).slice(0, 120) : undefined,
    });

    try {
      if (event.type === 'auth') {
        if (!event.token || !event.sessionId) {
          log('warn', 'socket.auth.invalid_payload', {
            connectionId: socket.state.connectionId,
            sessionId: event.sessionId || null,
          });

          send(
            socket,
            {
              type: 'error',
              code: 'AUTH_FAILED',
              message: 'A token and sessionId are required to open the socket stream.',
            },
            { reason: 'missing_token_or_session' },
          );
          return;
        }

        const historyResponse = await requestBackend(
          socket.state.connectionId,
          `/chat/sessions/${event.sessionId}/messages`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${event.token}`,
            },
          },
        );

        if (!historyResponse.ok) {
          log('warn', 'socket.auth.failed', {
            connectionId: socket.state.connectionId,
            sessionId: event.sessionId,
            status: historyResponse.status,
          });

          send(
            socket,
            {
              type: 'error',
              code: historyResponse.status === 401 ? 'AUTH_FAILED' : 'UPSTREAM_ERROR',
              message:
                historyResponse.payload.message ||
                'Unable to verify this session with Laravel.',
              sessionId: event.sessionId,
            },
            { reason: 'history_fetch_failed' },
          );
          return;
        }

        socket.state = {
          ...socket.state,
          authenticated: true,
          sessionId: event.sessionId,
          token: event.token,
        };

        log('info', 'socket.auth.success', {
          connectionId: socket.state.connectionId,
          sessionId: socket.state.sessionId,
          token: maskToken(socket.state.token),
          historyCount: (historyResponse.payload.messages || []).length,
        });

        send(
          socket,
          {
            type: 'chat:history',
            sessionId: event.sessionId,
            session: historyResponse.payload.session,
            messages: historyResponse.payload.messages || [],
          },
          {
            historyCount: (historyResponse.payload.messages || []).length,
          },
        );
        return;
      }

      if (!socket.state.authenticated) {
        log('warn', 'socket.message.rejected_unauthenticated', {
          connectionId: socket.state.connectionId,
          eventType: event.type,
        });

        send(
          socket,
          {
            type: 'error',
            code: 'AUTH_REQUIRED',
            message: 'Authenticate this socket before sending chat messages.',
          },
          { reason: 'auth_required' },
        );
        return;
      }

      if (event.type === 'chat:send') {
        if (!event.message || !String(event.message).trim()) {
          log('warn', 'socket.chat.invalid_payload', {
            connectionId: socket.state.connectionId,
            sessionId: socket.state.sessionId,
          });

          send(
            socket,
            {
              type: 'error',
              code: 'VALIDATION_FAILED',
              message: 'Message text is required.',
              sessionId: socket.state.sessionId,
            },
            { reason: 'empty_message' },
          );
          return;
        }

        const outgoingMessage = String(event.message).trim();

        log('info', 'socket.chat.forward.start', {
          connectionId: socket.state.connectionId,
          sessionId: socket.state.sessionId,
          messagePreview: outgoingMessage.slice(0, 120),
        });

        const upstreamResponse = await requestBackend(
          socket.state.connectionId,
          `/chat/sessions/${socket.state.sessionId}/messages`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${socket.state.token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: outgoingMessage,
            }),
          },
        );

        if (!upstreamResponse.ok) {
          log('warn', 'socket.chat.forward.failed', {
            connectionId: socket.state.connectionId,
            sessionId: socket.state.sessionId,
            status: upstreamResponse.status,
            messagePreview: outgoingMessage.slice(0, 120),
          });

          send(
            socket,
            {
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
            },
            { reason: 'upstream_message_failed' },
          );
          return;
        }

        const messages = [
          upstreamResponse.payload.user_message,
          upstreamResponse.payload.bot_message,
        ];

        log('info', 'socket.chat.forward.success', {
          connectionId: socket.state.connectionId,
          sessionId: socket.state.sessionId,
          transferredMessages: summarizeMessages(messages),
        });

        send(
          socket,
          {
            type: 'chat:message',
            sessionId: socket.state.sessionId,
            session: upstreamResponse.payload.session,
            messages,
          },
          {
            transferredMessages: summarizeMessages(messages),
          },
        );
        return;
      }

      log('warn', 'socket.message.unsupported', {
        connectionId: socket.state.connectionId,
        sessionId: socket.state.sessionId,
        eventType: event.type,
      });

      send(
        socket,
        {
          type: 'error',
          code: 'BAD_REQUEST',
          message: `Unsupported socket event type: ${event.type}.`,
          sessionId: socket.state.sessionId,
        },
        { reason: 'unsupported_event' },
      );
    } catch (error) {
      log('error', 'socket.message.handler_error', {
        connectionId: socket.state.connectionId,
        sessionId: socket.state.sessionId,
        eventType: event?.type,
        message: error.message,
        stack: error.stack,
      });

      send(
        socket,
        {
          type: 'error',
          code: 'SERVER_ERROR',
          message: 'The socket server hit an unexpected error while processing the event.',
          sessionId: socket.state.sessionId,
        },
        { reason: 'handler_exception' },
      );
    }
  });

  socket.on('close', (code, reasonBuffer) => {
    const reason = reasonBuffer?.toString() || '';
    activeConnections.delete(socket.state.connectionId);

    log('info', 'socket.connection.close', {
      connectionId: socket.state.connectionId,
      sessionId: socket.state.sessionId,
      authenticated: socket.state.authenticated,
      code,
      reason,
      connectedClients: activeConnections.size,
    });
  });

  socket.on('error', (error) => {
    log('error', 'socket.connection.error', {
      connectionId: socket.state.connectionId,
      sessionId: socket.state.sessionId,
      authenticated: socket.state.authenticated,
      message: error.message,
      stack: error.stack,
    });
  });
});

server.on('error', (error) => {
  log('error', 'server.error', {
    message: error.message,
    stack: error.stack,
  });
});

server.listen(port, () => {
  log('info', 'server.started', {
    port,
    backendApiUrl,
  });
});
