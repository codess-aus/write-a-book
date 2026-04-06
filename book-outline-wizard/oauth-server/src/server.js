const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

const PORT = Number(process.env.PORT || 8787);
const OAUTH_BASE_URL = process.env.OAUTH_BASE_URL || `http://localhost:${PORT}`;
const FRONTEND_RETURN_URL = process.env.FRONTEND_RETURN_URL || 'http://127.0.0.1:8000/wizard/';
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://127.0.0.1:8000';
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const GITHUB_SCOPE = process.env.GITHUB_SCOPE || 'repo read:user';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-session-secret-change-me';

if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
  console.warn('Missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET. OAuth flow will not work until these are set.');
}

// Trust Azure App Service / reverse proxy so secure cookies work behind HTTPS termination
app.set('trust proxy', 1);

app.use(express.json({ limit: '2mb' }));
app.use(cors({
  origin: [FRONTEND_ORIGIN],
  methods: ['GET', 'POST'],
  credentials: true
}));

const isProd = process.env.NODE_ENV === 'production';

app.use(session({
  name: 'book_outline_oauth',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: isProd ? 'none' : 'lax',
    secure: isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

function randomToken(size = 24) {
  return crypto.randomBytes(size).toString('hex');
}

function encodeBase64Utf8(text) {
  return Buffer.from(String(text || ''), 'utf8').toString('base64');
}

function sanitizePath(path) {
  return String(path || '')
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function getCallbackUrl() {
  return `${OAUTH_BASE_URL.replace(/\/$/, '')}/auth/github/callback`;
}

function assertAllowedReturnTo(returnTo) {
  try {
    const parsed = new URL(returnTo);
    const allowed = new URL(FRONTEND_ORIGIN);
    if (parsed.origin !== allowed.origin) {
      return false;
    }
    return true;
  } catch (err) {
    return false;
  }
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'book-outline-oauth-server' });
});

app.get('/auth/github/start', (req, res) => {
  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    return res.status(500).json({ error: 'OAuth server is not configured.' });
  }

  const returnTo = String(req.query.return_to || FRONTEND_RETURN_URL);
  if (!assertAllowedReturnTo(returnTo)) {
    return res.status(400).json({ error: 'Invalid return_to origin.' });
  }

  const state = randomToken(18);
  req.session.oauthState = state;
  req.session.returnTo = returnTo;

  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: getCallbackUrl(),
    scope: GITHUB_SCOPE,
    state
  });

  return res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
});

app.get('/auth/github/callback', async (req, res) => {
  try {
    const incomingState = String(req.query.state || '');
    const expectedState = req.session.oauthState;
    const returnTo = req.session.returnTo || FRONTEND_RETURN_URL;

    if (!expectedState || incomingState !== expectedState) {
      return res.status(400).send('Invalid OAuth state.');
    }

    const code = String(req.query.code || '');
    if (!code) {
      return res.status(400).send('Missing OAuth code.');
    }

    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: getCallbackUrl(),
        state: incomingState
      })
    });

    const tokenPayload = await tokenRes.json();
    if (!tokenRes.ok || !tokenPayload.access_token) {
      const reason = tokenPayload.error_description || tokenPayload.error || 'OAuth exchange failed';
      return res.status(400).send(reason);
    }

    const userRes = await fetch('https://api.github.com/user', {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${tokenPayload.access_token}`
      }
    });
    const userPayload = await userRes.json();
    if (!userRes.ok || !userPayload.login) {
      return res.status(400).send('Failed to load GitHub user profile.');
    }

    req.session.github = {
      accessToken: tokenPayload.access_token,
      login: userPayload.login,
      id: userPayload.id
    };

    req.session.oauthState = null;
    req.session.returnTo = null;

    const redirectBack = new URL(returnTo);
    redirectBack.searchParams.set('oauth', '1');
    return res.redirect(redirectBack.toString());
  } catch (err) {
    return res.status(500).send('OAuth callback failed.');
  }
});

app.get('/auth/github/session', (req, res) => {
  const gh = req.session.github;
  if (!gh || !gh.accessToken) {
    return res.json({ authenticated: false });
  }
  return res.json({
    authenticated: true,
    user: {
      login: gh.login,
      id: gh.id
    }
  });
});

app.post('/auth/github/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

function requireGitHubSession(req, res, next) {
  const gh = req.session.github;
  if (!gh || !gh.accessToken) {
    return res.status(401).json({ error: 'Not authenticated with GitHub.' });
  }
  return next();
}

async function githubApi(method, path, token, body, accept404) {
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`
  };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  if (accept404 && response.status === 404) {
    return null;
  }

  const text = await response.text();
  let payload = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (err) {
      payload = { message: text };
    }
  }

  if (!response.ok) {
    const error = new Error(payload.message || `GitHub API error (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function getFile(token, owner, repo, filePath) {
  return githubApi(
    'GET',
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${sanitizePath(filePath)}`,
    token,
    undefined,
    true
  );
}

async function upsertFile(token, owner, repo, filePath, value, commitMessage) {
  const existing = await getFile(token, owner, repo, filePath);

  let content = value;
  let rawBase64 = false;
  if (value && typeof value === 'object' && value.content) {
    content = value.content;
    rawBase64 = !!value.rawBase64;
  }

  const payload = {
    message: commitMessage,
    content: rawBase64 ? content : encodeBase64Utf8(content)
  };

  if (existing && existing.sha) {
    payload.sha = existing.sha;
  }

  return githubApi(
    'PUT',
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${sanitizePath(filePath)}`,
    token,
    payload,
    false
  );
}

app.get('/api/github/repos/:owner/:repo', requireGitHubSession, async (req, res) => {
  try {
    const gh = req.session.github;
    const result = await githubApi(
      'GET',
      `/repos/${encodeURIComponent(req.params.owner)}/${encodeURIComponent(req.params.repo)}`,
      gh.accessToken,
      undefined,
      true
    );
    if (!result) {
      return res.status(404).json({ error: 'Repository not found.' });
    }
    return res.json(result);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message || 'Failed to load repository.' });
  }
});

app.post('/api/github/repos', requireGitHubSession, async (req, res) => {
  try {
    const gh = req.session.github;
    const { name, description, private: isPrivate } = req.body || {};
    const result = await githubApi('POST', '/user/repos', gh.accessToken, {
      name,
      description: description || '',
      homepage: '',
      private: !!isPrivate,
      auto_init: true
    });
    return res.json(result);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message || 'Failed to create repository.' });
  }
});

app.post('/api/github/upsert-files', requireGitHubSession, async (req, res) => {
  try {
    const gh = req.session.github;
    const { owner, repo, fileMap, commitMessage } = req.body || {};
    if (!owner || !repo || !fileMap || typeof fileMap !== 'object') {
      return res.status(400).json({ error: 'Missing owner, repo, or fileMap.' });
    }

    const paths = Object.keys(fileMap);
    const results = [];
    for (const filePath of paths) {
      const result = await upsertFile(gh.accessToken, owner, repo, filePath, fileMap[filePath], commitMessage || 'Update files');
      results.push({ filePath, result });
    }

    return res.json({ ok: true, results });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message || 'Failed to upsert files.' });
  }
});

app.listen(PORT, () => {
  console.log(`OAuth server listening on ${PORT}`);
});
