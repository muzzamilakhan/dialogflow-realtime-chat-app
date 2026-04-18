import { useEffect, useState } from 'react';
import './App.css';
import { LoginForm } from './components/LoginForm';
import { ChatPage } from './pages/ChatPage';
import { loginUser, logoutUser, setAuthToken } from './services/api';

const STORAGE_KEY = 'dialogflow-chat-auth';

function App() {
  const [auth, setAuth] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return { token: '', user: null };
    }

    try {
      return JSON.parse(saved);
    } catch {
      return { token: '', user: null };
    }
  });
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    setAuthToken(auth.token);

    if (auth.token) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
      return;
    }

    localStorage.removeItem(STORAGE_KEY);
  }, [auth]);

  const handleLogin = async (credentials) => {
    setIsLoggingIn(true);
    setLoginError('');

    try {
      const response = await loginUser(credentials);
      setAuth({
        token: response.token,
        user: response.user,
      });
    } catch (error) {
      setLoginError(
        error?.response?.data?.message ||
          'Unable to sign in right now. Please verify the demo credentials and try again.',
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (auth.token) {
        await logoutUser();
      }
    } catch {
      // Clearing local auth is enough for demo logout.
    } finally {
      setAuth({ token: '', user: null });
      setLoginError('');
    }
  };

  return auth.token ? (
    <ChatPage auth={auth} onLogout={handleLogout} />
  ) : (
    <LoginForm
      error={loginError}
      isLoading={isLoggingIn}
      onSubmit={handleLogin}
    />
  );
}

export default App;
