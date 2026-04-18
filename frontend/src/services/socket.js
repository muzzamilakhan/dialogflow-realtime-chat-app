export class ChatSocketClient {
  constructor(url, { onEvent, onStatusChange } = {}) {
    this.url = url;
    this.onEvent = onEvent;
    this.onStatusChange = onStatusChange;
    this.socket = null;
    this.reconnectTimer = null;
    this.manuallyClosed = false;
    this.authPayload = null;
    this.backoff = 1000;
  }

  authenticate(payload) {
    this.authPayload = payload;
    this.manuallyClosed = false;

    if (!this.socket || this.socket.readyState === WebSocket.CLOSED) {
      this.connect();
      return;
    }

    if (this.socket.readyState === WebSocket.OPEN) {
      this.sendRaw({
        type: 'auth',
        ...payload,
      });
    }
  }

  connect() {
    if (!this.authPayload) {
      return;
    }

    this.setStatus(this.socket ? 'reconnecting' : 'connecting');

    this.socket = new WebSocket(this.url);

    this.socket.addEventListener('open', () => {
      this.backoff = 1000;
      this.setStatus('connected');
      this.sendRaw({
        type: 'auth',
        ...this.authPayload,
      });
    });

    this.socket.addEventListener('message', (event) => {
      try {
        const payload = JSON.parse(event.data);
        this.onEvent?.(payload);
      } catch {
        this.onEvent?.({
          type: 'error',
          code: 'BAD_PAYLOAD',
          message: 'Received an unreadable response from the socket server.',
        });
      }
    });

    this.socket.addEventListener('close', () => {
      this.setStatus('disconnected');

      if (this.manuallyClosed || !this.authPayload) {
        return;
      }

      this.setStatus('reconnecting');
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = window.setTimeout(() => {
        this.connect();
      }, this.backoff);
      this.backoff = Math.min(this.backoff * 1.5, 5000);
    });

    this.socket.addEventListener('error', () => {
      this.setStatus('error');
    });
  }

  sendMessage(message) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.onEvent?.({
        type: 'error',
        code: 'SOCKET_OFFLINE',
        message: 'The realtime connection is offline. Please wait for reconnect.',
      });
      return;
    }

    this.sendRaw({
      type: 'chat:send',
      message,
    });
  }

  disconnect() {
    this.manuallyClosed = true;
    clearTimeout(this.reconnectTimer);

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    this.setStatus('disconnected');
  }

  sendRaw(payload) {
    this.socket?.send(JSON.stringify(payload));
  }

  setStatus(status) {
    this.onStatusChange?.(status);
  }
}
