import { useEffect, useMemo, useRef, useState } from 'react';
import { ChatSidebar } from '../components/ChatSidebar';
import { ChatWindow } from '../components/ChatWindow';
import {
  createSession,
  getSessionMessages,
  getSessions,
} from '../services/api';
import { ChatSocketClient } from '../services/socket';

function sortSessions(sessions) {
  return [...sessions].sort((left, right) => {
    return new Date(right.updated_at || 0) - new Date(left.updated_at || 0);
  });
}

function mergeMessages(existingMessages = [], incomingMessages = []) {
  const unique = new Map(
    [...existingMessages, ...incomingMessages].map((message) => [
      message.id ?? `${message.sender_type}-${message.created_at}-${message.message}`,
      message,
    ]),
  );

  return [...unique.values()].sort((left, right) => {
    return new Date(left.created_at || 0) - new Date(right.created_at || 0);
  });
}

export function ChatPage({ auth, onLogout }) {
  const socketClientRef = useRef(null);
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messagesBySession, setMessagesBySession] = useState({});
  const [socketStatus, setSocketStatus] = useState('disconnected');
  const [socketError, setSocketError] = useState('');
  const [composerText, setComposerText] = useState('');
  const [pendingMessages, setPendingMessages] = useState({});
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) || null,
    [activeSessionId, sessions],
  );

  useEffect(() => {
    const client = new ChatSocketClient(
      import.meta.env.VITE_SOCKET_URL || 'ws://localhost:3001',
      {
        onStatusChange: setSocketStatus,
        onEvent: (event) => {
          if (event.type === 'chat:history') {
            setMessagesBySession((current) => ({
              ...current,
              [event.sessionId]: event.messages || [],
            }));

            if (event.session) {
              setSessions((current) =>
                sortSessions(
                  current.map((session) =>
                    session.id === event.session.id
                      ? { ...session, ...event.session }
                      : session,
                  ),
                ),
              );
            }

            return;
          }

          if (event.type === 'chat:message') {
            const latestMessage = event.messages?.[event.messages.length - 1] || null;

            setPendingMessages((current) => ({
              ...current,
              [event.sessionId]: '',
            }));

            setMessagesBySession((current) => ({
              ...current,
              [event.sessionId]: mergeMessages(
                current[event.sessionId],
                event.messages || [],
              ),
            }));

            if (event.session) {
              setSessions((current) => {
                const withoutCurrent = current.filter(
                  (session) => session.id !== event.session.id,
                );

                return sortSessions([
                  { ...event.session, latest_message: latestMessage },
                  ...withoutCurrent,
                ]);
              });
            }

            setSocketError('');
            return;
          }

          if (event.type === 'error') {
            setPendingMessages((current) => ({
              ...current,
              [event.sessionId || activeSessionId]: '',
            }));

            setSocketError(
              event.message || 'The socket server returned an unexpected error.',
            );

            if (event.code === 'AUTH_FAILED') {
              onLogout();
            }
          }
        },
      },
    );

    socketClientRef.current = client;

    return () => {
      client.disconnect();
      socketClientRef.current = null;
    };
  }, [onLogout]);

  useEffect(() => {
    let ignore = false;

    async function bootstrap() {
      try {
        const response = await getSessions();
        if (ignore) {
          return;
        }

        const nextSessions = sortSessions(response.sessions || []);
        setSessions(nextSessions);

        if (nextSessions[0]) {
          setActiveSessionId((current) => current || nextSessions[0].id);
        } else {
          const created = await createSession();
          if (ignore) {
            return;
          }

          setSessions([created.session]);
          setActiveSessionId(created.session.id);
        }
      } catch (error) {
        setSocketError(
          error?.response?.data?.message ||
            'Unable to load chat sessions. Please refresh the page.',
        );
      }
    }

    bootstrap();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!activeSessionId) {
      return;
    }

    let ignore = false;

    async function hydrateMessages() {
      setLoadingHistory(true);

      try {
        const response = await getSessionMessages(activeSessionId);

        if (ignore) {
          return;
        }

        setMessagesBySession((current) => ({
          ...current,
          [activeSessionId]: response.messages || [],
        }));

        setSessions((current) =>
          sortSessions(
            current.map((session) =>
              session.id === activeSessionId
                ? {
                    ...session,
                    ...response.session,
                    latest_message:
                      response.messages?.[response.messages.length - 1] || null,
                  }
                : session,
            ),
          ),
        );
      } catch (error) {
        if (!ignore) {
          setSocketError(
            error?.response?.data?.message ||
              'Unable to load conversation history.',
          );
        }
      } finally {
        if (!ignore) {
          setLoadingHistory(false);
        }
      }
    }

    hydrateMessages();

    socketClientRef.current?.authenticate({
      sessionId: activeSessionId,
      token: auth.token,
    });

    return () => {
      ignore = true;
    };
  }, [activeSessionId, auth.token]);

  const handleCreateSession = async () => {
    setIsCreatingSession(true);
    setSocketError('');

    try {
      const response = await createSession();
      setSessions((current) => sortSessions([response.session, ...current]));
      setActiveSessionId(response.session.id);
      setComposerText('');
    } catch (error) {
      setSocketError(
        error?.response?.data?.message ||
          'Unable to create a new chat session right now.',
      );
    } finally {
      setIsCreatingSession(false);
    }
  };

  const handleSendMessage = () => {
    const message = composerText.trim();

    if (!message || !activeSessionId) {
      return;
    }

    setPendingMessages((current) => ({
      ...current,
      [activeSessionId]: message,
    }));
    setComposerText('');
    setSocketError('');

    socketClientRef.current?.sendMessage(message);
  };

  const sessionMessages = activeSessionId
    ? messagesBySession[activeSessionId] || []
    : [];

  const pendingMessage = activeSessionId ? pendingMessages[activeSessionId] : '';
  const isSending = Boolean(pendingMessage);

  return (
    <main className="chat-shell">
      <ChatSidebar
        activeSessionId={activeSessionId}
        isCreatingSession={isCreatingSession}
        onCreateSession={handleCreateSession}
        onSelectSession={setActiveSessionId}
        sessions={sessions}
        socketStatus={socketStatus}
        user={auth.user}
      />

      <section className="chat-main">
        <header className="chat-topbar">
          <div>
            <h1>{activeSession?.title || 'Realtime Chat Console'}</h1>
            <p>
              Signed in as {auth.user?.email}. Messages stream through Node ws and
              Laravel before reaching Dialogflow ES.
            </p>
          </div>

          <div className="topbar-actions">
            <button className="secondary-button" onClick={handleCreateSession} type="button">
              New conversation
            </button>
            <button className="secondary-button" onClick={onLogout} type="button">
              Logout
            </button>
          </div>
        </header>

        <ChatWindow
          activeSession={activeSession}
          composerText={composerText}
          isSending={isSending}
          isLoadingHistory={loadingHistory}
          messages={sessionMessages}
          onComposerChange={setComposerText}
          onSendMessage={handleSendMessage}
          pendingMessage={pendingMessage}
          socketError={socketError}
        />
      </section>
    </main>
  );
}
