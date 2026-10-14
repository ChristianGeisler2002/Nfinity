/**
 * api/team.js — client-side Team Members management (databaseless build).
 *
 * Lets a logged-in client owner/admin manage employees WITHIN THEIR OWN COMPANY.
 * This is NOT public registration:
 *   - company_id is ALWAYS taken from the authenticated user, never from the body.
 *   - One company can never see or modify another company's users.
 *   - Client admins can never create/assign `platform_owner`.
 *   - Users cannot escalate their own role.
 *
 * Storage is the local JSON user store (core/auth/userStore). The full
 * production build swaps that store for PostgreSQL with no route changes here.
 *
 * Routes (mounted at /api/team):
 *   GET    /api/team                    list company users (manager+ read)
 *   POST   /api/team                    create employee (owner/admin)
 *   PATCH  /api/team/:id                update role/name/phone/dept/status
 *   POST   /api/team/:id/reset-password issue new temp password
 *   POST   /api/team/:id/disable        disable (soft) a user
 */
const express = require('express');
const { Resend } = require('resend');
const {
  findUserById,
  canManageUser,
  hashPassword,
  createUser,
  emailExists,
  listUsersByCompany,
  updateUserFields,
} = require('../core/auth/userStore');
const { verifySessionToken } = require('../core/auth/sessionToken');
const { generateTempPassword } = require('../core/auth/tempPassword');
const { writeAudit } = require('../core/auth/auditLog');

const router = express.Router();

// Roles a client owner/admin may assign. platform_owner is intentionally excluded.
const ASSIGNABLE_ROLES = ['owner', 'admin', 'manager', 'dispatcher', 'driver', 'employee', 'viewer'];
// Roles allowed to WRITE (create/update/disable/reset).
const MANAGER_ROLES = ['platform_owner', 'owner', 'admin'];
// Roles allowed to READ the team list (managers can view but not write).
const READ_ROLES = [...MANAGER_ROLES, 'manager'];
const VALID_STATUSES = ['active', 'disabled'];

const asyncRoute = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

/* ── helpers ─────────────────────────────────────────────────── */

function isEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function initialsFrom(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'NA';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Shape a user record for the client. Never includes password_hash.
function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    company_id: row.company_id,
    email: row.email,
    display_name: row.display_name,
    avatar_initials: row.avatar_initials,
    role: row.role,
    status: row.status,
    phone: row.phone,
    department: row.department,
    email_verified: row.email_verified,
    must_change_password: row.must_change_password,
    last_login_at: row.last_login_at,
    disabled_at: row.disabled_at,
    created_at: row.created_at,
  };
}

let resendClient;
function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}
function fromEmail() {
  return process.env.RESEND_FROM_EMAIL || process.env.FROM_EMAIL || 'NFINITY HQ <onboarding@resend.dev>';
}
function loginUrl() {
  const base = (process.env.APP_URL || process.env.APP_BASE_URL || '').replace(/\/+$/, '');
  return base ? `${base}/login.html` : '/login.html';
}

// Best-effort invite/credential email. Never blocks or throws into the request.
async function sendCredentialEmail({ to, displayName, tempPassword, kind }) {
  const resend = getResend();
  if (!resend) {
    console.warn(`[team] ${kind} email skipped: RESEND_API_KEY missing.`);
    return 'skipped';
  }
  const subject = kind === 'invite'
    ? 'Your NFINITY HQ account is ready'
    : 'Your NFINITY HQ password was reset';
  try {
    const result = await resend.emails.send({
      from: fromEmail(),
      to,
      subject,
      html: credentialEmailHtml({ displayName, tempPassword, kind }),
    });
    if (result?.error) {
      throw new Error(result.error.message || 'Resend rejected the credential email.');
    }
    return 'sent';
  } catch (err) {
    console.error(`[team] ${kind} email failed:`, err?.message || err);
    return 'failed';
  }
}

function credentialEmailHtml({ displayName, tempPassword, kind }) {
  const intro = kind === 'invite'
    ? 'An account has been created for you on NFINITY HQ.'
    : 'Your NFINITY HQ password has been reset by an administrator.';
  return `<!DOCTYPE html><html lang="en"><body style="margin:0;padding:32px;background:#0a0a0f;font-family:Arial,sans-serif;color:#d4d4e8;">
  <div style="max-width:560px;margin:0 auto;background:#13131a;border:1px solid #1e1e2e;border-radius:16px;padding:32px;">
    <h1 style="margin:0 0 16px;color:#fff;font-size:22px;">${escHtml(kind === 'invite' ? 'Welcome to NFINITY HQ' : 'Password Reset')}</h1>
    <p style="line-height:1.6;">Hi ${escHtml(displayName || 'there')}, ${escHtml(intro)}</p>
    <p style="line-height:1.6;">Temporary password:</p>
    <p style="font-size:18px;font-weight:700;letter-spacing:.04em;background:#1e1e2e;border-radius:8px;padding:14px 18px;color:#fff;">${escHtml(tempPassword)}</p>
    <p style="line-height:1.6;color:#8b8b9e;">For your security, you'll be required to choose a new password the first time you sign in.</p>
    <p style="margin-top:22px;"><a href="${escAttr(loginUrl())}" style="background:#7c6af7;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700;">Sign in</a></p>
  </div></body></html>`;
}

function escHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function escAttr(value) {
  return escHtml(value).replace(/`/g, '&#96;');
}

/* ── auth guards ─────────────────────────────────────────────── */

// Re-loads the user from the store so role/company_id are authoritative (the JWT
// only carries the subject id; we never trust client-supplied role/company).
const requireUser = asyncRoute(async (req, res, next) => {
  const auth = req.get('authorization') || '';
  const userId = verifySessionToken(auth.replace(/^Bearer\s+/i, ''));
  const user = userId ? await findUserById(userId) : null;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (user.status === 'disabled') return res.status(403).json({ error: 'Account disabled' });
  req.user = user;
  next();
});

function requireRole(allowed) {
  return (req, res, next) => {
    if (!allowed.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

// Load a target user and enforce same-company isolation + manage permission.
async function loadManageableTarget(req, res) {
  const target = await findUserById(req.params.id);
  if (!target || String(target.company_id) !== String(req.user.company_id)) {
    res.status(404).json({ error: 'User not found' });
    return null;
  }
  if (!canManageUser(req.user, target)) {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }
  return target;
}

/* ── routes ──────────────────────────────────────────────────── */

router.use(requireUser);

// GET /api/team — list users in the caller's company only.
router.get('/', requireRole(READ_ROLES), asyncRoute(async (req, res) => {
  const users = listUsersByCompany(req.user.company_id);
  res.json({ users: users.map(publicUser) });
}));

// POST /api/team — create an employee inside the caller's company.
router.post('/', requireRole(MANAGER_ROLES), asyncRoute(async (req, res) => {
  const { display_name, email, role, phone, department } = req.body || {};

  if (!display_name || typeof display_name !== 'string') {
    return res.status(400).json({ error: 'display_name is required.' });
  }
  if (!isEmail(email)) {
    return res.status(400).json({ error: 'A valid email is required.' });
  }
  if (!ASSIGNABLE_ROLES.includes(role)) {
    return res.status(400).json({ error: 'Invalid role.' });
  }
  // Admins cannot create owners; nobody here can create platform_owner.
  if (req.user.role === 'admin' && role === 'owner') {
    return res.status(403).json({ error: 'Admins cannot create owner accounts.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  if (emailExists(normalizedEmail)) {
    return res.status(409).json({ error: 'A user with that email already exists.' });
  }

  const tempPassword = generateTempPassword(16);
  const passwordHash = hashPassword(tempPassword);

  const created = createUser({
    company_id: req.user.company_id,
    company_name: req.user.company_name,
    email: normalizedEmail,
    email_verified: true,
    password_hash: passwordHash,
    role,
    display_name: String(display_name).trim(),
    avatar_initials: initialsFrom(display_name),
    status: 'active',
    must_change_password: true,
    created_by: req.user.id,
    phone: phone ? String(phone).slice(0, 50) : null,
    department: department ? String(department).slice(0, 100) : null,
  });

  await writeAudit({
    company_id: req.user.company_id,
    actor_user_id: req.user.id,
    target_user_id: created.id,
    action: 'user.create',
    detail: { email: normalizedEmail, role },
  });

  const emailStatus = await sendCredentialEmail({
    to: normalizedEmail,
    displayName: created.display_name,
    tempPassword,
    kind: 'invite',
  });

  // Temp password returned ONCE for manual delivery; never stored in plaintext.
  res.status(201).json({ user: publicUser(created), tempPassword, emailStatus });
}));

// PATCH /api/team/:id — update role / display_name / phone / department / status.
router.patch('/:id', requireRole(MANAGER_ROLES), asyncRoute(async (req, res) => {
  const target = await loadManageableTarget(req, res);
  if (!target) return;

  const { role, display_name, phone, department, status } = req.body || {};
  const patch = {};
  let roleChanged = false;

  if (role !== undefined) {
    if (!ASSIGNABLE_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Invalid role.' });
    }
    if (String(target.id) === String(req.user.id)) {
      return res.status(403).json({ error: 'You cannot change your own role.' });
    }
    if (req.user.role === 'admin' && role === 'owner') {
      return res.status(403).json({ error: 'Admins cannot assign the owner role.' });
    }
    if (role !== target.role) {
      patch.role = role;
      roleChanged = true;
    }
  }
  if (display_name !== undefined) {
    if (!display_name || typeof display_name !== 'string') {
      return res.status(400).json({ error: 'display_name cannot be empty.' });
    }
    patch.display_name = String(display_name).trim();
  }
  if (phone !== undefined) {
    patch.phone = phone ? String(phone).slice(0, 50) : null;
  }
  if (department !== undefined) {
    patch.department = department ? String(department).slice(0, 100) : null;
  }
  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }
    patch.status = status;
    patch.disabled_at = status === 'disabled' ? new Date().toISOString() : null;
  }

  if (!Object.keys(patch).length) {
    return res.status(400).json({ error: 'No valid fields to update.' });
  }

  const updated = updateUserFields(target.id, patch);

  if (roleChanged) {
    await writeAudit({
      company_id: req.user.company_id,
      actor_user_id: req.user.id,
      target_user_id: target.id,
      action: 'user.role_change',
      detail: { from: target.role, to: role },
    });
  }

  res.json({ user: publicUser(updated) });
}));

// POST /api/team/:id/reset-password — issue a fresh temporary password.
router.post('/:id/reset-password', requireRole(MANAGER_ROLES), asyncRoute(async (req, res) => {
  const target = await loadManageableTarget(req, res);
  if (!target) return;

  const tempPassword = generateTempPassword(16);
  const passwordHash = hashPassword(tempPassword);
  updateUserFields(target.id, { password_hash: passwordHash, must_change_password: true });

  await writeAudit({
    company_id: req.user.company_id,
    actor_user_id: req.user.id,
    target_user_id: target.id,
    action: 'user.password_reset',
    detail: {},
  });

  const emailStatus = await sendCredentialEmail({
    to: target.email,
    displayName: target.display_name,
    tempPassword,
    kind: 'reset',
  });

  res.json({ tempPassword, emailStatus });
}));

// POST /api/team/:id/disable — soft-disable (never deletes).
router.post('/:id/disable', requireRole(MANAGER_ROLES), asyncRoute(async (req, res) => {
  const target = await loadManageableTarget(req, res);
  if (!target) return;
  if (String(target.id) === String(req.user.id)) {
    return res.status(403).json({ error: 'You cannot disable your own account.' });
  }

  const updated = updateUserFields(target.id, { status: 'disabled', disabled_at: new Date().toISOString() });

  await writeAudit({
    company_id: req.user.company_id,
    actor_user_id: req.user.id,
    target_user_id: target.id,
    action: 'user.disable',
    detail: {},
  });

  res.json({ user: publicUser(updated) });
}));

module.exports = router;
