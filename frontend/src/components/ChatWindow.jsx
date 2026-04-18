function formatMessageTime(timestamp) {
  if (!timestamp) {
    return 'Now';
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

function TypingBubble() {
  return (
    <div className="message-group bot">
      <div className="message-bubble">
        <div className="message-meta">
          <span>Dialogflow Assistant</span>
          <span>typing</span>
        </div>
        <div className="typing-indicator" aria-label="Assistant is typing">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}

function PendingBubble({ message }) {
  return (
    <div className="message-group pending">
      <div className="message-bubble">
        <div className="message-meta">
          <span>You</span>
          <span>sending...</span>
        </div>
        <div className="message-text">{message}</div>
      </div>
    </div>
  );
}

export function ChatWindow({
  activeSession,
  composerText,
  isSending,
  isLoadingHistory,
  messages,
  onComposerChange,
  onSendMessage,
  pendingMessage,
  socketError,
}) {
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onSendMessage();
    }
  };

  return (
    <>
      <section className="messages-panel">
        {!activeSession ? (
          <div className="empty-state">
            <h3>Create your first session</h3>
            <p>
              Start a new conversation from the sidebar, then send a message to
              trigger the full frontend → socketserver → Laravel → Dialogflow loop.
            </p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                className={`message-group ${message.sender_type}`}
                key={`${message.id}-${message.created_at}`}
              >
                <article className="message-bubble">
                  <div className="message-meta">
                    <span>
                      {message.sender_type === 'user' ? 'You' : 'Dialogflow Assistant'}
                    </span>
                    <span>{formatMessageTime(message.created_at)}</span>
                  </div>

                  <div className="message-text">{message.message}</div>

                  {message.intent_name &&
                  message.sender_type === 'bot' &&
                  message.intent_name !== 'fallback_error' ? (
                    <span className="intent-chip">
                      Intent: {message.intent_name}
                    </span>
                  ) : null}
                </article>
              </div>
            ))}

            {pendingMessage ? <PendingBubble message={pendingMessage} /> : null}
            {isSending ? <TypingBubble /> : null}
          </>
        )}
      </section>

      <footer className="composer-shell">
        {socketError ? <div className="error-banner">{socketError}</div> : null}

        <div className="composer">
          <textarea
            disabled={!activeSession || isSending || isLoadingHistory}
            onChange={(event) => onComposerChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message and press Enter..."
            value={composerText}
          />

          <button
            className="send-button"
            disabled={
              !activeSession ||
              !composerText.trim() ||
              isSending ||
              isLoadingHistory
            }
            onClick={onSendMessage}
            type="button"
          >
            {isSending ? 'Waiting...' : 'Send message'}
          </button>
        </div>
      </footer>
    </>
  );
}
