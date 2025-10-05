import React, { useState, useEffect } from "react";

const API_BASE = "/apex";

function fetchWithKey(url, key, opts = {}) {
  return fetch(url, {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      "registered-key": key
    }
  });
}

function Login({ setApiKey, setProfile }) {
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);

  function handleSubmit(e) {
    e.preventDefault();
    fetchWithKey(`${API_BASE}/me`, key)
      .then(r => r.json())
      .then(data => {
        if (!data.profile) {
          setError("Invalid key");
        } else if (!data.profile.name) {
          setStep(2);
        } else {
          setApiKey(key);
          setProfile(data);
        }
      });
  }

  function handleNameSubmit(e) {
    e.preventDefault();
    fetch(`${API_BASE}/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, name })
    }).then(() => {
      setApiKey(key);
      setProfile({ profile: { name }, owner: "", quota: "", used: 0, remaining: "" });
    });
  }

  if (step === 2) {
    return (
      <form onSubmit={handleNameSubmit} className="panel">
        <h2>Set Your Name</h2>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Your Name" required />
        <button type="submit">Save Name</button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="panel">
      <h2>API Key Login</h2>
      <input
        value={key}
        onChange={e => setKey(e.target.value)}
        placeholder="Enter your API key"
        required
      />
      <button type="submit">Login</button>
      {error && <div className="error">{error}</div>}
    </form>
  );
}

function Home({ apiKey, profile }) {
  const [me, setMe] = useState(profile);
  useEffect(() => {
    fetchWithKey(`${API_BASE}/me`, apiKey)
      .then(r => r.json())
      .then(setMe);
  }, [apiKey]);
  return (
    <div className="panel">
      <h2>Welcome, {me?.profile?.name || "User"}!</h2>
      <div>
        <b>Owner:</b> {me.owner}<br />
        <b>Quota:</b> {me.quota}<br />
        <b>Used:</b> {me.used}<br />
        <b>Remaining:</b> {me.remaining}
      </div>
    </div>
  );
}

function Endpoints({ apiKey }) {
  const [testUrl, setTestUrl] = useState("");
  const [result, setResult] = useState(null);

  function handleTest(e) {
    e.preventDefault();
    setResult("Loading...");
    fetchWithKey(`${API_BASE}/bypass?url=${encodeURIComponent(testUrl)}`, apiKey)
      .then(r => r.json())
      .then(setResult);
  }

  return (
    <div className="panel">
      <h2>Bypass Endpoint</h2>
      <p>
        <b>Endpoint:</b><br />
        <code>GET /apex/bypass?url=&#123;url_here&#125;</code><br />
        <b>Header:</b><br />
        <code>registered-key: &#123;your_key&#125;</code>
      </p>
      <form onSubmit={handleTest}>
        <input
          value={testUrl}
          onChange={e => setTestUrl(e.target.value)}
          placeholder="Test a link..."
          required
        />
        <button type="submit">Test</button>
      </form>
      {result && (
        <pre style={{ marginTop: 10, textAlign: "left" }}>{JSON.stringify(result, null, 2)}</pre>
      )}
    </div>
  );
}

function Suggestion({ apiKey }) {
  const [suggestion, setSuggestion] = useState("");
  const [msg, setMsg] = useState("");
  function handleSubmit(e) {
    e.preventDefault();
    fetch(`${API_BASE}/suggest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suggestion, key: apiKey })
    })
      .then(r => r.json())
      .then(data => {
        setMsg(data.ok ? "Sent!" : "Error sending");
        setSuggestion("");
      });
  }
  return (
    <div className="panel">
      <h2>Suggestion</h2>
      <form onSubmit={handleSubmit}>
        <input
          value={suggestion}
          onChange={e => setSuggestion(e.target.value)}
          placeholder="Your suggestion..."
          required
        />
        <button type="submit">Send</button>
      </form>
      {msg}
    </div>
  );
}

function Status() {
  const [status, setStatus] = useState({});
  useEffect(() => {
    fetch(`${API_BASE}/status`).then(r => r.json()).then(setStatus);
    const i = setInterval(() => fetch(`${API_BASE}/status`).then(r => r.json()).then(setStatus), 10000);
    return () => clearInterval(i);
  }, []);
  return (
    <div className="panel">
      <h2>Status</h2>
      <div>
        <b>Successful bypasses:</b> {status.success || 0}<br />
        <b>Failed bypasses:</b> {status.fail || 0}<br />
        <b>Last bypassed link:</b><br />
        <code>{status.last || "None"}</code>
      </div>
    </div>
  );
}

function Profile({ apiKey, profile, setProfile }) {
  const [name, setName] = useState(profile.profile?.name || "");
  const [msg, setMsg] = useState("");
  function handleSubmit(e) {
    e.preventDefault();
    fetch(`${API_BASE}/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: apiKey, name })
    }).then(() => {
      setProfile({ ...profile, profile: { name } });
      setMsg("Saved!");
    });
  }
  return (
    <div className="panel">
      <h2>Edit Profile</h2>
      <form onSubmit={handleSubmit}>
        <input value={name} onChange={e => setName(e.target.value)} required />
        <button type="submit">Save</button>
      </form>
      {msg}
    </div>
  );
}

export default function App() {
  const [apiKey, setApiKey] = useState(localStorage.getItem("apex-key") || "");
  const [profile, setProfile] = useState(null);
  const [page, setPage] = useState("home");

  useEffect(() => {
    if (apiKey) localStorage.setItem("apex-key", apiKey);
  }, [apiKey]);

  if (!apiKey || !profile)
    return <Login setApiKey={setApiKey} setProfile={setProfile} />;

  return (
    <div className="app">
      <nav>
        <button onClick={() => setPage("home")}>Home</button>
        <button onClick={() => setPage("endpoints")}>Endpoints</button>
        <button onClick={() => setPage("suggest")}>Suggestion</button>
        <button onClick={() => setPage("status")}>Status</button>
        <button onClick={() => setPage("profile")}>Profile</button>
        <button onClick={() => { setApiKey(""); setProfile(null); localStorage.removeItem("apex-key"); }}>Logout</button>
      </nav>
      {page === "home" && <Home apiKey={apiKey} profile={profile} />}
      {page === "endpoints" && <Endpoints apiKey={apiKey} />}
      {page === "suggest" && <Suggestion apiKey={apiKey} />}
      {page === "status" && <Status />}
      {page === "profile" && <Profile apiKey={apiKey} profile={profile} setProfile={setProfile} />}
    </div>
  );
}
