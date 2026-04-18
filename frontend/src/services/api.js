import axios from 'axios';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost/dialogflow-realtime-chat-app/backend/public/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    Accept: 'application/json',
  },
});

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    return;
  }

  delete api.defaults.headers.common.Authorization;
}

export async function loginUser(credentials) {
  const { data } = await api.post('/login', credentials);
  setAuthToken(data.token);
  return data;
}

export async function logoutUser() {
  const { data } = await api.post('/logout');
  return data;
}

export async function getSessions() {
  const { data } = await api.get('/chat/sessions');
  return data;
}

export async function createSession(payload = {}) {
  const { data } = await api.post('/chat/sessions', payload);
  return data;
}

export async function getSessionMessages(sessionId) {
  const { data } = await api.get(`/chat/sessions/${sessionId}/messages`);
  return data;
}
