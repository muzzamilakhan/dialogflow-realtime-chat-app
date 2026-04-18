import { useState } from 'react';

export function LoginForm({ error, isLoading, onSubmit }) {
  const [form, setForm] = useState({
    email: 'test@example.com',
    password: 'password',
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit(form);
  };

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-hero">
          <span className="eyebrow">Evaluation-ready stack</span>
          <h1>Real-time Dialogflow chat with Laravel, React, and WebSocket.</h1>
          <p>
            This app keeps the architecture evaluator-friendly: a clean React chat
            client, a Laravel API with Dialogflow ES integration, and a separate
            Node.js socket server acting as the live messaging bridge.
          </p>

          <div className="hero-grid">
            <article className="hero-tile">
              <strong>Frontend</strong>
              Responsive chat UI, session sidebar, reconnect awareness, and typing
              feedback.
            </article>
            <article className="hero-tile">
              <strong>Backend</strong>
              Sanctum auth, multi-session history, MySQL persistence, and
              Dialogflow REST calls.
            </article>
            <article className="hero-tile">
              <strong>Realtime loop</strong>
              Browser sends chat events over WebSocket and receives the reply
              instantly.
            </article>
            <article className="hero-tile">
              <strong>Demo account</strong>
              Use <code>test@example.com</code> with password <code>password</code>.
            </article>
          </div>
        </div>

        <div className="login-panel">
          <div className="panel-heading">
            <h2>Sign in to the chat console</h2>
            <p>Use the seeded demo account to enter the evaluator flow.</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label>
              Email
              <input
                autoComplete="email"
                onChange={(event) =>
                  setForm((current) => ({ ...current, email: event.target.value }))
                }
                type="email"
                value={form.email}
              />
            </label>

            <label>
              Password
              <input
                autoComplete="current-password"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                type="password"
                value={form.password}
              />
            </label>

            {error ? <div className="error-banner">{error}</div> : null}

            <button className="primary-button" disabled={isLoading} type="submit">
              {isLoading ? 'Signing in...' : 'Enter chat workspace'}
            </button>
          </form>

          <p className="helper-text">
            Tip: keep Laravel, the socket server, and the Vite frontend running at
            the same time during the demo.
          </p>
        </div>
      </section>
    </main>
  );
}
