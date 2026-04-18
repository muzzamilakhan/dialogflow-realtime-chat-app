import { useState } from "react";
import axios from "axios";

function App() {
  const [token, setToken] = useState("");
  const [email] = useState("admin@test.com");
  const [password] = useState("password");
  const [text, setText] = useState("");
  const [messages, setMessages] = useState([]);

  const api = axios.create({
    baseURL: "http://127.0.0.1:8000/api",
  });

  const login = async () => {
    const res = await api.post("/login", { email, password });
    setToken(res.data.token);
  };

  const send = async () => {
    const res = await api.post(
      "/send",
      { message: text },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    setMessages([...messages, { me: text }, { bot: res.data.reply }]);
    setText("");
  };

  if (!token) {
    return <button onClick={login}>Login</button>;
  }

  return (
    <div>
      <h1>Chat App</h1>

      {messages.map((m, i) => (
        <div key={i}>
          {m.me && <p>You: {m.me}</p>}
          {m.bot && <p>Bot: {m.bot}</p>}
        </div>
      ))}

      <input value={text} onChange={(e) => setText(e.target.value)} />

      <button onClick={send}>Send</button>
    </div>
  );
}

export default App;
