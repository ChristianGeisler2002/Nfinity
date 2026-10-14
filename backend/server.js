// Load env vars BEFORE any module that reads process.env at init time
require('dotenv').config();

const express = require('express');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const HOST = process.env.HOST || (IS_PROD ? '0.0.0.0' : '127.0.0.1');
const frontendRoot = path.resolve(__dirname, '..', 'frontend');
const { validateSessionConfig } = require('./core/auth/sessionToken');
validateSessionConfig();

/* ─────────────────────────────────────────────────────────────
   PLATFORM HARDENING
───────────────────────────────────────────────────────────── */
// Behind AWS ALB / CloudFront / nginx — trust the first proxy hop so req.ip
// reflects the real client (used for rate limiting) and HTTPS is detected.
app.set('trust proxy', IS_PROD ? 1 : false);

// Don't advertise the framework.
app.disable('x-powered-by');

// CORS for split frontend/backend hosting. Keep ALLOWED_ORIGINS tight in production.
const DEFAULT_ALLOWED_ORIGINS = [
  'https://nfinityhq.com',
  'https://www.nfinityhq.com',
];
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS.join(','))
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin ? String(req.headers.origin).replace(/\/+$/, '') : '';
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// Fail loudly in the logs if the core integrations aren't configured.
['RESEND_API_KEY', 'ADMIN_EMAIL'].forEach((key) => {
  if (!process.env[key]) console.warn(`[startup] WARNING: ${key} is not set — lead emails will fail.`);
});

// Log Telegram config status so you can verify the right token loaded.
const _tgToken = process.env.TELEGRAM_BOT_TOKEN;
const _tgChat  = process.env.TELEGRAM_CHAT_ID;
if (!_tgToken || !_tgChat) {
  console.warn('[startup] WARNING: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set — Telegram alerts disabled.');
} else {
  console.log('[startup] Telegram integration configured.');
}

/* ─────────────────────────────────────────────────────────────
   SECURITY HEADERS (applied to every response)
   Per-page Content-Security-Policy lives in the HTML <meta> tags so the
   marketing pages and the inline-heavy demo can each scope their own policy.
───────────────────────────────────────────────────────────── */
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), interest-cohort=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (IS_PROD) {
    // Only meaningful over HTTPS; harmless otherwise. 2 years + preload.
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }
  next();
});

// Parse JSON request bodies. Lead payloads are tiny — cap hard to blunt abuse.
app.use(express.json({ limit: '16kb' }));

/* ─────────────────────────────────────────────────────────────
   API ROUTES
───────────────────────────────────────────────────────────── */
app.post('/api/submit-lead', require('./api/submit-lead'));
app.post('/api/uploads', require('./api/uploads'));
app.use('/api/auth', require('./api/auth'));
app.use('/api/team', require('./api/team'));

// Load-balancer / container health probe.
app.get('/healthz', (_req, res) => res.status(200).json({ status: 'ok' }));

// Telegram connectivity test — hit /api/test-telegram in the browser to verify the bot works.
// Diagnostic only: never exposed in production (returns 404 like any unknown route).
app.get('/api/test-telegram', async (_req, res) => {
  if (IS_PROD || process.env.ENABLE_DIAGNOSTICS !== '1') return res.status(404).send('Not found');
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set' });
  }
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chat_id: chatId, text: '✅ NfinityHQ Telegram test — bot is connected!' }),
    });
    const body = await r.json();
    if (!r.ok) return res.status(500).json({ error: 'Telegram API error', detail: body });
    res.json({ success: true, detail: body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────────────────────
   STATIC FILES — ONLY the public-facing directories are served.
   Everything else (api/, data/, .env*, server.js, package.json, …) stays
   off the web entirely. dotfiles denied; no directory listings.
───────────────────────────────────────────────────────────── */
// Note: express.static never produces directory *listings* (that needs the
// separate serve-index middleware). `index: 'index.html'` only means a
// directory URL like /apps/demo serves its index.html — required because the
// demo SPA rewrites its URL to /apps/demo (without the filename).
const staticOpts = {
  extensions: ['html'],       // /public/contact → contact.html
  dotfiles: 'deny',           // 403 on .env, .git, etc.
  index: 'index.html',        // /apps/demo/ → apps/demo/index.html
  redirect: true,             // /apps/demo → 301 /apps/demo/ (demo SPA needs this)
  setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
};
app.use('/public', express.static(path.join(frontendRoot, 'public'), staticOpts));
app.use('/apps',   express.static(path.join(frontendRoot, 'apps'),   staticOpts));
// Only the browser-needed core directories are served. Backend-only modules
// (auth, uploads, tasks, notifications, analytics) are never exposed: any other
// /core/* path falls through to the 404 below.
app.use('/core/scenarios',  express.static(path.join(frontendRoot, 'core', 'scenarios'),  staticOpts));
app.use('/core/automation', express.static(path.join(frontendRoot, 'core', 'automation'), staticOpts));
app.use('/core/api',        express.static(path.join(frontendRoot, 'core', 'api'),        staticOpts));
app.use('/core', (_req, res) => res.status(404).send('Not found'));

// Bare root → homepage
app.get('/', (_req, res) => res.redirect('/public/index.html'));
app.get('/login.html', (_req, res) => res.redirect('/public/login.html'));
app.get('/reset.html', (_req, res) => res.sendFile(path.join(frontendRoot, 'public', 'reset.html')));
app.get('/reset', (_req, res) => res.sendFile(path.join(frontendRoot, 'public', 'reset.html')));

// Anything else: a clean 404 (no stack traces, no path echo).
app.use((_req, res) => res.status(404).send('Not found'));

// Centralized error handler — never leak internals to the client.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large' });
  console.error('[server] request failed:', err.name || 'Error');
  res.status(500).json({ error: 'Internal server error' });
});

/* ─────────────────────────────────────────────────────────────
   START + GRACEFUL SHUTDOWN
───────────────────────────────────────────────────────────── */
function startServer(port = PORT) {
  const server = app.listen(port, HOST, () => {
    console.log(`NfinityHQ listening on http://${HOST}:${server.address().port}`);
  });
  server.on('error', (error) => {
    console.error(`[server] Could not start: ${error.code || 'unknown error'}`);
    process.exitCode = 1;
  });
  ['SIGTERM', 'SIGINT'].forEach((signal) => {
    process.once(signal, () => {
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(1), 10000).unref();
    });
  });
  return server;
}

if (require.main === module) startServer();
module.exports = { app, startServer };
