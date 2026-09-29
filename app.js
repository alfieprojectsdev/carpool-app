// app.js
// Carpool board: Express API + static page in public/.
//
// Vercel runs this file as one function (zero-config Express: it looks for
// app.js exporting the app) and serves public/ from its CDN. Locally,
// `npm run dev` starts scripts/dev-server.js, which listens on PORT.

const path = require('path');
const express = require('express');
const membership = require('./lib/membership');
const { allow, clientIp, limit } = require('./lib/rate-limit');
const { ValidationError } = require('./lib/validation');
const { parseFeedback, notifyFeedback } = require('./lib/feedback');
const ridesRouter = require('./routes/rides');
const locationsRouter = require('./routes/locations');

// Same list is in vercel.json for files Vercel serves from its CDN.
const SECURITY_HEADERS = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self' https://gc.zgo.at; style-src 'self'; " +
    "img-src 'self' data: https://*.goatcounter.com; connect-src 'self' https://*.goatcounter.com; " +
    "frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

/** Express 4 does not catch rejected promises; route them to the error handler. */
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function createApp(pool) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use((req, res, next) => {
    res.set(SECURITY_HEADERS);
    next();
  });
  app.use(express.json({ limit: '20kb' }));

  // --- membership -------------------------------------------------------
  app.get('/api/session', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ member: membership.isMember(req), gate: membership.gateEnabled() });
  });

  app.post(
    '/api/join',
    limit(pool, 'join', 10, 15 * 60 * 1000, 'Too many attempts. Wait 15 minutes and try again.'),
    (req, res) => {
      if (!membership.gateEnabled()) return res.json({ member: true });
      if (!membership.passcodeMatches(req.body && req.body.passcode)) {
        return res.status(401).json({ error: 'That passcode is not right. Check the pinned post in the group chat.' });
      }
      membership.setMemberCookie(res);
      res.json({ member: true });
    }
  );

  app.post('/api/leave', (req, res) => {
    membership.clearMemberCookie(res);
    res.json({ member: false });
  });

  // --- board --------------------------------------------------------------
  app.use('/api/rides', ridesRouter(pool, wrap));
  app.use('/api/locations', locationsRouter(pool, wrap));

  // --- feedback (open to everyone, including people without the passcode) --
  app.post(
    '/api/feedback',
    wrap(async (req, res) => {
      if (req.body && req.body.website) return res.status(201).json({ ok: true }); // honeypot
      const parsed = parseFeedback(req.body);
      if (parsed.error) return res.status(400).json({ error: parsed.error });
      if (!(await allow(pool, `feedback:${clientIp(req)}`, 5, 60 * 60 * 1000))) {
        return res.status(429).json({ error: 'Thanks! Please try again in an hour.' });
      }
      const f = parsed.value;
      await pool.query(
        'INSERT INTO feedback (kind, message, contact, page, user_agent) VALUES ($1, $2, $3, $4, $5)',
        [f.kind, f.message, f.contact, f.page, (req.get('user-agent') || '').slice(0, 300) || null]
      );
      await notifyFeedback(f);
      res.status(201).json({ ok: true });
    })
  );

  // --- health: plain check does not wake the database ----------------------
  app.get(
    '/api/health',
    wrap(async (req, res) => {
      res.set('Cache-Control', 'no-store');
      if (req.query.db !== '1') return res.json({ ok: true });
      try {
        await pool.query('SELECT 1');
        res.json({ ok: true, db: 'ok' });
      } catch {
        res.status(503).json({ ok: false, db: 'unreachable' });
      }
    })
  );

  // --- page ---------------------------------------------------------------
  // On Vercel the CDN serves public/; these cover local dev and act as a
  // fallback if "/" ever reaches the function.
  const publicDir = path.join(__dirname, 'public');
  app.use(express.static(publicDir));
  app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

  app.use('/api', (req, res) => res.status(404).json({ error: 'Route not found' }));
  app.use((req, res) => res.status(404).send('Not found'));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof ValidationError) return res.status(400).json({ error: err.message });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large' });
    console.error(`${req.method} ${req.path} failed:`, err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  });

  return app;
}

module.exports = createApp(require('./db/connection'));
module.exports.createApp = createApp;
module.exports.SECURITY_HEADERS = SECURITY_HEADERS;
