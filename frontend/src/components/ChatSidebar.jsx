function formatPreview(session) {
  if (!session.latest_message?.message) {
    return 'No messages yet. Start the conversation to generate a Dialogflow response.';
  }

  return session.latest_message.message;
}

function formatTimestamp(timestamp) {
  if (!timestamp) {
    return 'Just now';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp));
}

export function ChatSidebar({
  activeSessionId,
  isCreatingSession,
  onCreateSession,
  onSelectSession,
  sessions,
  socketStatus,
  user,
}) {
  return (
    <aside className="chat-sidebar">
      <header className="sidebar-header">
        <div>
          <span className="eyebrow">Live workspace</span>
          <h2>Realtime Chat</h2>
          <p>{user?.name || 'Demo User'}</p>
        </div>

        <button
          className="ghost-button"
          disabled={isCreatingSession}
          onClick={onCreateSession}
          type="button"
        >
          {isCreatingSession ? 'Creating...' : 'New chat'}
        </button>
      </header>

      <section className="sidebar-section">
        <span className={`connection-pill ${socketStatus}`}>{socketStatus}</span>
      </section>

      <section className="sidebar-section">
        <span className="sidebar-label">Conversation history</span>

        <div className="session-list">
          {sessions.map((session) => (
            <button
              className={`session-card ${
                session.id === activeSessionId ? 'active' : ''
              }`}
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              type="button"
            >
              <span className="session-title">{session.title}</span>
              <span className="session-preview">{formatPreview(session)}</span>
              <span className="session-meta">
                Updated {formatTimestamp(session.updated_at)}
              </span>
            </button>
          ))}
        </div>
      </section>

      <p className="sidebar-footnote">
        Each session is stored in MySQL and replayed whenever the socket
        reconnects.
      </p>
    </aside>
  );
}
