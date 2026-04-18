import { useState, useEffect, useRef } from "react";
import axios from "axios";

export default function App() {
  const [token, setToken] = useState("");
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const endRef = useRef();

  const api = axios.create({
    baseURL: "http://localhost/dialogflow-realtime-chat-app/backend/public/api",
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, loading]);

  const login = async () => {
    const res = await api.post("/login", {
      email: "admin@chatapp.com",
      password: "password",
    });

    setToken(res.data.token);
  };

  const send = async () => {
    if (!text.trim()) return;

    const userText = text;

    setMessages((prev) => [...prev, { sender: "user", text: userText }]);

    setText("");
    setLoading(true);

    const res = await api.post(
      "/send",
      { message: userText },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    setLoading(false);

    setMessages((prev) => [...prev, { sender: "bot", text: res.data.reply }]);
  };

  if (!token) {
    return (
      <div className="h-screen bg-gray-100 flex items-center justify-center">
        <button
          onClick={login}
          className="bg-black text-white px-8 py-4 rounded-xl"
        >
          Login to Chat
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-gray-100">
      {/* Sidebar */}
      <div className="hidden md:flex w-64 bg-black text-white p-5 flex-col">
        <h1 className="text-xl font-bold mb-6">Chat Bot</h1>

        <button className="border border-gray-600 rounded-xl p-3">
          + New Chat
        </button>

        <div className="mt-auto text-sm text-gray-400">Laravel + React</div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white shadow px-6 py-4 font-semibold">
          AI Assistant
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${
                msg.sender === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-xl px-5 py-3 rounded-2xl ${
                  msg.sender === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-white shadow"
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-white shadow px-5 py-3 rounded-2xl">
                Typing...
              </div>
            </div>
          )}

          <div ref={endRef}></div>
        </div>

        {/* Input */}
        <div className="bg-white border-t p-4 flex gap-3">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Type your message..."
            className="flex-1 border rounded-xl px-4 py-3 outline-none"
          />

          <button
            onClick={send}
            className="bg-black text-white px-6 rounded-xl"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
