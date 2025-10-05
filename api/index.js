const express = require('express');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const KEYS_FILE = path.join(__dirname, 'keys.json');
const USAGE_FILE = path.join(__dirname, 'usage.json');
const SUGGESTION_WEBHOOK = 'YOUR_DISCORD_WEBHOOK_URL'; // SET THIS

const app = express();
app.use(cors());
app.use(express.json());

function loadJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}
function saveJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
function randomPart() {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  let part = '';
  for (let i = 0; i < 5; i++) part += letters[Math.floor(Math.random() * letters.length)];
  for (let i = 0; i < 3; i++) part += digits[Math.floor(Math.random() * digits.length)];
  return part.split('').sort(() => Math.random() - 0.5).join('');
}
function newKey(owner, quota) {
  return {
    key: `apex-${randomPart()}-${randomPart()}-${randomPart()}`,
    owner,
    quota,
    used: 0,
    lastRequest: 0,
    profile: { name: owner }
  };
}

// Bypass endpoint
app.get('/apex/bypass', async (req, res) => {
  const key = req.headers['registered-key'];
  const url = req.query.url;
  if (!key || !url) return res.status(400).json({ status: 'failed', result: 'Missing key or url.' });

  let keys = loadJson(KEYS_FILE, {});
  let usage = loadJson(USAGE_FILE, { success: 0, fail: 0, last: '' });
  const user = keys[key];
  if (!user) return res.status(401).json({ status: 'failed', result: 'Invalid API key.' });

  // Cooldown
  if (Date.now() - (user.lastRequest || 0) < 10000)
    return res.status(429).json({ status: 'failed', result: 'Cooldown: Wait 10s between requests.' });

  // Quota check unless perm
  if (user.quota !== 'perm' && user.used >= user.quota)
    return res.status(403).json({ status: 'failed', result: 'Quota exceeded.' });

  const start = Date.now();
  try {
    const apiRes = await fetch(`https://lucy-api.vercel.app/api/bypass?apikey=kevinehub&url=${encodeURIComponent(url)}`);
    const apiJson = await apiRes.json();
    const response_time = ((Date.now() - start) / 1000).toFixed(2);

    // Update stats
    user.used++;
    user.lastRequest = Date.now();
    keys[key] = user;
    if (apiJson.status === 'success') {
      usage.success++;
      usage.last = url;
    } else {
      usage.fail++;
    }
    saveJson(KEYS_FILE, keys);
    saveJson(USAGE_FILE, usage);

    res.json({
      status: apiJson.status,
      result: apiJson.result,
      response_time
    });
  } catch (err) {
    res.status(500).json({ status: 'failed', result: 'Internal error.' });
  }
});

// Generate key endpoint
app.get('/apex/qKey=:quota&owner=:owner', (req, res) => {
  const { quota, owner } = req.params;
  let keys = loadJson(KEYS_FILE, {});
  const keyObj = newKey(owner, quota);
  keys[keyObj.key] = keyObj;
  saveJson(KEYS_FILE, keys);
  res.json({ key: keyObj.key, quota, owner });
});

// Profile endpoints
app.post('/apex/profile', (req, res) => {
  const { key, name } = req.body;
  let keys = loadJson(KEYS_FILE, {});
  if (!keys[key]) return res.status(404).json({ ok: false, error: 'Key not found.' });
  keys[key].profile.name = name;
  saveJson(KEYS_FILE, keys);
  res.json({ ok: true });
});
app.get('/apex/me', (req, res) => {
  const key = req.headers['registered-key'];
  let keys = loadJson(KEYS_FILE, {});
  const user = keys[key];
  if (!user) return res.status(404).json({ ok: false });
  res.json({
    profile: user.profile,
    owner: user.owner,
    quota: user.quota,
    used: user.used,
    remaining: user.quota === 'perm' ? '∞' : user.quota - user.used
  });
});

// Status endpoint
app.get('/apex/status', (req, res) => {
  const usage = loadJson(USAGE_FILE, { success: 0, fail: 0, last: '' });
  res.json(usage);
});

// Suggestion via Discord webhook
app.post('/apex/suggest', async (req, res) => {
  const { suggestion, key } = req.body;
  if (!suggestion) return res.status(400).json({ ok: false, error: 'No suggestion.' });
  try {
    await fetch(SUGGESTION_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: `Key: ${key || 'unknown'}\nSuggestion: ${suggestion}` })
    });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false });
  }
});

module.exports = app;
