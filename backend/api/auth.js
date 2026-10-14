/**
 * api/auth.js
 *
 * PUBLIC SELF-REGISTRATION IS INTENTIONALLY NOT IMPLEMENTED.
 * NfinityHQ is a closed, manually-onboarded platform:
 *   - New client companies + their first owner/admin are created by the
 *     platform owner via `npm run client:create` (scripts/create-client.js).
 *   - Employees are added by a client owner/admin from the in-app Team Members
 *     page (POST /api/team).
 * Login only succeeds for users that already exist in the database. Any
 * /register or /signup request is explicitly rejected below.
 */
const express = require('express');
const {
  authenticate,
  canManageUser,
  findUserById,
  safeUser,
  updatePassword,
} = require('../core/auth/userStore');
const {
  consumeResetToken,
  requestPasswordReset,
  verifyResetToken,
} = require('../core/auth/passwordResetService');
const { createSessionToken, verifySessionToken } = require('../core/auth/sessionToken');

const router = express.Router();
const RESET_SENT_MESSAGE = 'If an account exists, reset instructions have been sent.';

const asyncRoute = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

// Explicitly reject self-registration on every method. There is no public signup.
router.all('/register', (_req, res) => res.status(404).json({ error: 'Not found' }));
router.all('/signup', (_req, res) => res.status(404).json({ error: 'Not found' }));

const loginAttempts = new Map();
router.use('/login', (req, res, next) => {
  const now = Date.now();
  for (const [ip, entry] of loginAttempts) if (entry.until <= now) loginAttempts.delete(ip);
  if (loginAttempts.size >= 10000 && !loginAttempts.has(req.ip)) return res.status(429).json({ error: 'Please try again later.' });
  const entry = loginAttempts.get(req.ip) || { count: 0, until: now + 60000 };
  entry.count += 1;
  loginAttempts.set(req.ip, entry);
  if (entry.count > 20) return res.status(429).json({ error: 'Too many attempts. Try again in a minute.' });
  next();
});

router.post('/login', asyncRoute(async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string' || email.length > 254 || password.length > 256) {
    return res.status(400).json({ error: 'Invalid email or password' });
  }
  const user = await authenticate(email, password);
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });
  res.json({
    user,
    sessionToken: createSessionToken(user),
    redirectUrl: '/apps/demo/index.html#/dashboard',
  });
}));

router.post('/forgot-password', asyncRoute(async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
  if (email && email.length <= 254) {
    requestPasswordReset(email).catch((err) => {
      console.error('[auth] reset request failed:', err?.message || err);
    });
  }
  res.status(200).json({ message: RESET_SENT_MESSAGE });
}));

router.get('/reset-password', asyncRoute(async (req, res) => {
  const token = typeof req.query?.token === 'string' ? req.query.token : '';
  const result = token ? await verifyResetToken(token) : { valid: false };
  res.json({ valid: !!token && result.valid });
}));

router.post('/reset-password', asyncRoute(async (req, res) => {
  const { token, password } = req.body || {};
  if (typeof token !== 'string' || typeof password !== 'string' || password.length < 8 || password.length > 256) {
    return res.status(400).json({ error: 'Invalid reset request.' });
  }
  const result = await consumeResetToken(token, password);
  if (!result.success) return res.status(400).json({ error: 'Reset link is invalid or expired.' });
  res.json({ success: true });
}));

router.patch('/users/:userId/password', asyncRoute(async (req, res) => {
  const auth = req.get('authorization') || '';
  const actorUserId = verifySessionToken(auth.replace(/^Bearer\s+/i, ''));
  const actor = await findUserById(actorUserId);
  const targetUserId = req.params.userId;
  const target = await findUserById(targetUserId);

  if (!target || !canManageUser(actor, target)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const password = req.body?.password;
  if (typeof password !== 'string' || password.length < 8 || password.length > 256) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  // Self-change (e.g. first-login forced change) clears must_change_password.
  // An admin resetting someone else's password re-sets the flag.
  const isSelf = String(actorUserId) === String(targetUserId);
  const updated = await updatePassword(targetUserId, password, { resetByAdmin: !isSelf });
  if (!updated) return res.status(404).json({ error: 'User not found.' });
  res.json({ user: safeUser(updated) });
}));

module.exports = router;
