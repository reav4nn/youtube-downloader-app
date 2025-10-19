const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const db = require('./db');
const { runYtDlp } = require('./yt-dlp-runner');
const fs = require('fs');

const app = express();

// Trust proxy for correct protocol when behind Render/other proxies
app.set('trust proxy', 1);

// CORS with credentials for frontend on Vercel and local dev
const FRONTEND_ORIGIN = 'https://youtube-downloader-app-nk79.vercel.app';
const allowedOrigins = new Set([
  FRONTEND_ORIGIN,
  'http://localhost:5173',
  'http://127.0.0.1:5173'
]);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.has(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json());

// Sessions for Passport (Google OAuth)
const prod = process.env.NODE_ENV === 'production';
const sessionCookieConfig = {
  httpOnly: true,
  sameSite: prod ? 'none' : 'lax',
  secure: prod,
};
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-me',
  resave: false,
  saveUninitialized: false,
  cookie: sessionCookieConfig,
}));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
  // store minimal fields in session
  done(null, user);
});
passport.deserializeUser((obj, done) => {
  done(null, obj);
});

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/api/auth/google/callback',
  proxy: true,
}, (accessToken, refreshToken, profile, done) => {
  try {
    const user = {
      id: profile.id,
      displayName: profile.displayName,
      email: Array.isArray(profile.emails) && profile.emails[0] ? profile.emails[0].value : null,
      photo: Array.isArray(profile.photos) && profile.photos[0] ? profile.photos[0].value : null,
    };
    return done(null, user);
  } catch (e) {
    return done(e);
  }
}));

// Upload YouTube cookies.txt
// Must be before other routes; accepts raw text
app.post('/api/upload-cookies', express.text({ type: '*/*', limit: '2mb' }), (req, res) => {
  try {
    const expected = process.env.COOKIE_UPLOAD_TOKEN;
    if (expected) {
      const provided = req.header('X-UPLOAD-TOKEN');
      if (!provided || provided !== expected) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    const cookiesPath = path.join(__dirname, 'cookies.txt');
    const body = typeof req.body === 'string' ? req.body : '';
    fs.writeFile(cookiesPath, body, { mode: 0o600 }, (err) => {
      if (err) {
        console.error('[server] cookies upload write error:', err.message);
        return res.status(500).json({ error: err.message });
      }
      try { fs.chmodSync(cookiesPath, 0o600); } catch (_) {}
      console.log('[server] cookies uploaded to', cookiesPath, 'bytes=', Buffer.byteLength(body));
      res.json({ ok: true, path: cookiesPath, bytes: Buffer.byteLength(body) });
    });
  } catch (e) {
    console.error('[server] cookies upload error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Auth routes
app.get('/api/auth/google', (req, res, next) => {
  const authenticator = passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account',
  });
  authenticator(req, res, next);
});

app.get('/api/auth/google/callback', (req, res, next) => {
  const FRONTEND_URL = (process.env.NODE_ENV === 'production')
    ? 'https://youtube-downloader-app-nk79.vercel.app'
    : 'http://localhost:5173';
  passport.authenticate('google', {
    failureRedirect: `${FRONTEND_URL}?login=failed`,
    session: true,
  })(req, res, () => {
    res.redirect(FRONTEND_URL);
  });
});

app.get('/api/auth/user', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return res.json({ user: req.user });
  }
  res.status(401).json({ user: null });
});

app.get('/api/auth/logout', (req, res) => {
  try {
    if (typeof req.logout === 'function') {
      // Passport 0.6+ requires callback
      req.logout(() => {});
    }
  } catch (e) {}
  try {
    req.session && req.session.destroy && req.session.destroy(() => {});
  } catch (e) {}
  res.json({ ok: true });
});

// Health check endpoint (must be before any static or other routes)
app.get('/api/healthz', (req, res) => {
  res.json({ ok: true });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'API is running',
    endpoints: ['/api/healthz', '/api/downloads']
  });
});

// Ensure local bin is in PATH for Render
try {
  const binPath = path.resolve(__dirname, 'bin');
  process.env.PATH = `${binPath}${path.delimiter}${process.env.PATH || ''}`;
} catch (e) {}

const PORT = process.env.PORT || 3000;
// Project-local downloads directory only
const DOWNLOAD_DIR = process.env.DOWNLOAD_PATH || path.resolve(__dirname, '..', 'downloads');
if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
try {
  fs.accessSync(DOWNLOAD_DIR, fs.constants.W_OK);
  console.log(`[server] DOWNLOAD_DIR ready: ${DOWNLOAD_DIR}`);
} catch (e) {
  console.error('[server] DOWNLOAD_DIR not writable:', DOWNLOAD_DIR, e.message);
}

// in-memory progress cache: id -> { percent, status }
const progressMap = new Map();

// SSE clients: id -> Set of response objects (plain object mapping)
const sseClients = Object.create(null);

function pruneClients(id) {
  const clients = sseClients[id];
  if (!clients) return;
  for (const res of Array.from(clients)) {
    if (res.writableEnded || res.destroyed) {
      try { clearInterval(res._sseHeartbeat); } catch (e) {}
      clients.delete(res);
    }
  }
  if (clients.size === 0) delete sseClients[id];
}

function broadcastProgress(id, payload) {
  // update progressMap
  progressMap.set(id, payload);
  const clients = sseClients[id];
  if (!clients) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  const toRemove = [];
  for (const res of clients) {
    try {
      res.write(data);
    } catch (err) {
      toRemove.push(res);
    }
  }
  if (toRemove.length) {
    for (const res of toRemove) {
      try { clearInterval(res._sseHeartbeat); } catch (e) {}
      clients.delete(res);
    }
    if (clients.size === 0) delete sseClients[id];
  }
}

// Simple background worker queue
const CONCURRENCY = Math.max(1, parseInt(process.env.CONCURRENCY || '1', 10));
let activeCount = 0;
const queue = [];

function startNext() {
  if (activeCount >= CONCURRENCY) return;
  const job = queue.shift();
  if (!job) return;
  activeCount++;
  job(() => {
    activeCount = Math.max(0, activeCount - 1);
    startNext();
  });
}

app.post('/api/download', (req, res) => {
  const { url, format, quality } = req.body;
  if (!url) return res.status(400).json({ error: 'Missing url' });

  const id = uuidv4();
  progressMap.set(id, { percent: 0, status: 'queued' });
  console.log(`[server] Received download request id=${id} url=${url} format=${format} quality=${quality}`);

  // insert metadata into DB
  const audioFormats = new Set(['mp3','m4a','opus']);
  const isAudio = audioFormats.has(String(format || '').toLowerCase());
  const insert = db.prepare('INSERT INTO downloads (id, url, format, quality, audio_only, status) VALUES (?, ?, ?, ?, ?, ?)');
  insert.run(id, url, format || null, quality || null, isAudio ? 1 : 0, 'queued');

  res.json({ id });
  console.log(`[server] Queued job id=${id}`);

  // enqueue download job
  queue.push((done) => {
    progressMap.set(id, { percent: 0, status: 'downloading' });
    const proc = runYtDlp(
      url,
      { format: format, audioOnly: isAudio, quality: quality },
      (p) => {
        // update progress and broadcast via SSE
        if (p.percent !== undefined) {
          const payload = { percent: p.percent, status: 'downloading' };
          console.log(`[server] id=${id} progress=${p.percent}%`);
          broadcastProgress(id, payload);
        } else if (p.filename) {
          try {
            const base = path.basename(p.filename);
            const updateMeta = db.prepare('UPDATE downloads SET filename = ?, filepath = ? WHERE id = ?');
            updateMeta.run(base, p.filename, id);
            const payload = { ...(progressMap.get(id) || {}), filename: base };
            console.log(`[server] id=${id} filename detected=${base}`);
            broadcastProgress(id, payload);
          } catch (e) {
            const payload = { ...(progressMap.get(id) || {}), last: p.raw };
            console.warn(`[server] id=${id} filename update failed: ${e.message}`);
            broadcastProgress(id, payload);
          }
        } else if (p.raw) {
          // Log a trimmed line to avoid log flooding
          const line = String(p.raw).trim();
          if (line) console.log(`[server] id=${id} yt-dlp: ${line}`);
          const payload = { ...(progressMap.get(id) || {}), last: p.raw };
          broadcastProgress(id, payload);
        }
      },
      (finalPath) => {
        const base = finalPath ? path.basename(finalPath) : (progressMap.get(id)?.filename || null);
        const payload = { percent: 100, status: 'completed', filename: base || undefined };
        console.log(`[server] id=${id} completed file=${finalPath || base}`);
        broadcastProgress(id, payload);
        const update = db.prepare('UPDATE downloads SET status = ?, filename = COALESCE(?, filename), filepath = COALESCE(?, filepath) WHERE id = ?');
        update.run('completed', base || null, finalPath || null, id);
        done();
      },
      (err) => {
        const payload = { percent: 0, status: 'error', error: err.message };
        console.error(`[server] id=${id} error: ${err.message}`);
        broadcastProgress(id, payload);
        const update = db.prepare('UPDATE downloads SET status = ? WHERE id = ?');
        update.run('error', id);
        done();
      }
    );
  });
  startNext();
});

app.get('/api/status/:id', (req, res) => {
  const id = req.params.id;
  if (!progressMap.has(id)) return res.status(404).json({ error: 'Not found' });
  res.json(progressMap.get(id));
});

// SSE endpoint for streaming progress updates for a download id
app.get('/api/stream/:id', (req, res) => {
  const id = req.params.id;
  // set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders && res.flushHeaders();

  // send initial comment to establish stream
  res.write(': connected\n\n');

  // prune any dead clients first, then ensure set exists and add
  pruneClients(id);
  if (!sseClients[id]) sseClients[id] = new Set();
  sseClients[id].add(res);

  // heartbeat to keep connection alive
  try { clearInterval(res._sseHeartbeat); } catch (e) {}
  res._sseHeartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch (e) {
      // On write error, cleanup this client
      const clients = sseClients[id];
      if (clients) {
        try { clearInterval(res._sseHeartbeat); } catch (_) {}
        clients.delete(res);
        if (clients.size === 0) delete sseClients[id];
      }
    }
  }, 20000);

  // send current progress immediately if exists
  if (progressMap.has(id)) {
    const payload = progressMap.get(id);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }

  req.on('close', () => {
    const clients = sseClients[id];
    if (clients) {
      try { clearInterval(res._sseHeartbeat); } catch (e) {}
      clients.delete(res);
      if (clients.size === 0) delete sseClients[id];
    }
  });
});

app.get('/api/files', (req, res) => {
  // list files in downloadDir
  fs.readdir(DOWNLOAD_DIR, (err, files) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(files);
  });
});

app.use('/files', express.static(DOWNLOAD_DIR));

// Force browser download with Content-Disposition: attachment
app.get('/files/download/:filename', (req, res) => {
  try {
    const safeName = path.basename(req.params.filename || '');
    if (!safeName) return res.status(400).json({ error: 'Invalid filename' });
    const full = path.join(DOWNLOAD_DIR, safeName);
    if (!fs.existsSync(full)) return res.status(404).json({ error: 'File not found' });
    res.download(full, safeName);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Return list of downloads from DB including file_url when available
app.get('/api/downloads', (req, res) => {
  try {
    const rows = db.prepare('SELECT id, url, format, quality, audio_only, status, filename, filepath, created_at FROM downloads ORDER BY created_at DESC').all();
    const withUrls = rows.map(r => ({
      ...r,
      file_url: r.filename ? (`/files/${encodeURIComponent(r.filename)}`) : null,
    }));
    res.json(withUrls);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
// Delete a download record and its file (if present)
app.delete('/api/downloads/:id', (req, res) => {
  const { id } = req.params;
  try {
    const row = db.prepare('SELECT filename, filepath FROM downloads WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'Not found' });

    let removedFile = false;
    try {
      // Prefer DB filename inside downloadDir to avoid deleting outside paths
      if (row.filename) {
        const full = path.join(DOWNLOAD_DIR, path.basename(row.filename));
        if (fs.existsSync(full)) {
          fs.unlinkSync(full);
          removedFile = true;
        }
      } else if (row.filepath) {
        // Fallback to filepath but still guard with basename into downloadDir
        const full = path.join(DOWNLOAD_DIR, path.basename(row.filepath));
        if (fs.existsSync(full)) {
          fs.unlinkSync(full);
          removedFile = true;
        }
      }
    } catch (e) {
      // Ignore unlink errors; continue to delete DB row
    }

    const info = db.prepare('DELETE FROM downloads WHERE id = ?').run(id);
    res.json({ ok: true, deleted: info.changes > 0, removed_file: removedFile });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
