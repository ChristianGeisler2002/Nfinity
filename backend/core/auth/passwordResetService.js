const crypto = require('crypto');
const path = require('path');
const { readArray, writeArray } = require('../storage/jsonStore');
const { Resend } = require('resend');
const { findUserByEmail, updatePassword } = require('./userStore');

// ── Databaseless build ───────────────────────────────────────────────────────
// Reset tokens are stored hashed in a local JSON file with a 15-minute TTL and
// are single-use. (The full production build stores these in PostgreSQL.)
const TOKENS_FILE = process.env.RESET_TOKENS_FILE || path.join(__dirname, '..', '..', 'data', 'password-resets.json');
const RESET_TTL_MS = 15 * 60 * 1000;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || process.env.FROM_EMAIL || 'NFINITY HQ <onboarding@resend.dev>';
const APP_URL = (process.env.APP_BASE_URL || process.env.APP_URL || 'https://nfinityhq.com').replace(/\/+$/, '');

function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function readTokens() { return readArray(TOKENS_FILE); }
function writeTokens(tokens) { writeArray(TOKENS_FILE, tokens); }

async function requestPasswordReset(email) {
  const user = await findUserByEmail(email);
  if (!user || user.email_verified === false) return;

  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  const tokens = readTokens().filter((entry) => entry.user_id !== user.id || entry.used_at);
  tokens.push({
    id: crypto.randomUUID(),
    user_id: user.id,
    token_hash: tokenHash(token),
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + RESET_TTL_MS).toISOString(),
    used_at: null,
  });
  writeTokens(tokens);

  const resetUrl = `${APP_URL}/reset.html?token=${encodeURIComponent(token)}`;
  await sendResetEmail(user.email, resetUrl);
}

async function verifyResetToken(token) {
  const hash = tokenHash(token);
  const match = readTokens().find((entry) => entry.token_hash === hash);
  if (!match || match.used_at) return { valid: false };
  if (new Date(match.expires_at).getTime() <= Date.now()) return { valid: false };
  return { valid: true, userId: match.user_id };
}

async function consumeResetToken(token, password) {
  const hash = tokenHash(token);
  const tokens = readTokens();
  const index = tokens.findIndex((entry) => entry.token_hash === hash);
  if (index === -1 || tokens[index].used_at) return { success: false };
  if (new Date(tokens[index].expires_at).getTime() <= Date.now()) return { success: false };

  const user = await updatePassword(tokens[index].user_id, password);
  if (!user) return { success: false };

  tokens[index].used_at = new Date().toISOString();
  writeTokens(tokens);
  return { success: true };
}

async function sendResetEmail(to, resetUrl) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[password-reset] RESEND_API_KEY missing; reset email not sent.');
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const result = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: 'Reset Password',
    html: `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:32px;background:#0a0a0f;font-family:Arial,sans-serif;color:#d4d4e8;">
  <div style="max-width:560px;margin:0 auto;background:#13131a;border:1px solid #1e1e2e;border-radius:14px;padding:32px;">
    <h1 style="margin:0 0 16px;color:#ffffff;font-size:22px;">Reset Password</h1>
    <p style="line-height:1.6;">Click below to reset your NFINITYHQ password. This link expires in 15 minutes and can only be used once.</p>
    <p style="margin:28px 0;"><a href="${escapeHtml(resetUrl)}" style="background:#7c6af7;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700;">Reset Password</a></p>
    <p style="font-size:13px;color:#8b8b9e;word-break:break-all;">${escapeHtml(resetUrl)}</p>
  </div>
</body>
</html>`,
  });
  if (result?.error) {
    throw new Error(result.error.message || 'Resend rejected the password reset email.');
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = {
  consumeResetToken,
  requestPasswordReset,
  verifyResetToken,
};
