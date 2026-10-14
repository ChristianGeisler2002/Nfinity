const crypto = require('crypto');
const path = require('path');
const bcrypt = require('bcryptjs');
const { readArray, writeArray } = require('../storage/jsonStore');

// ── Databaseless build ───────────────────────────────────────────────────────
// Users are stored in a local JSON file. (The full production build swaps this
// module's storage for PostgreSQL.) The public function signatures are kept
// async so the API/route layer is identical across both builds.
const USERS_FILE = process.env.USERS_FILE || path.join(__dirname, '..', '..', 'data', 'users.json');
const HASH_ITERATIONS = 210000;
const HASH_KEYLEN = 32;
const HASH_DIGEST = 'sha256';
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);

function readUsers() { return readArray(USERS_FILE); }
function writeUsers(users) { writeArray(USERS_FILE, users); }

function hashPassword(password) {
  return bcrypt.hashSync(String(password), BCRYPT_ROUNDS);
}

function verifyLegacyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== 'string') return false;
  const [alg, iterRaw, salt, expected] = storedHash.split('$');
  if (alg !== `pbkdf2_${HASH_DIGEST}` || !iterRaw || !salt || !expected) return false;
  const iterations = Number(iterRaw);
  if (!Number.isSafeInteger(iterations) || iterations < 100000) return false;
  const actual = crypto
    .pbkdf2Sync(String(password), salt, iterations, Buffer.from(expected, 'hex').length, HASH_DIGEST)
    .toString('hex');
  return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}

function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== 'string') return false;
  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
    return bcrypt.compareSync(String(password), storedHash);
  }
  return verifyLegacyPassword(password, storedHash);
}

function normalizeUser(user) {
  if (!user) return null;
  return {
    ...user,
    client_id: user.client_id || user.company_id,
    company_name: user.company_name || user.company || 'NFINITY HQ',
  };
}

function safeUser(user) {
  if (!user) return null;
  const { password_hash, reset_token_hash, ...safe } = user;
  return normalizeUser(safe);
}

async function findUserByEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return null;
  const user = readUsers().find((u) => String(u.email).toLowerCase() === normalized) || null;
  return normalizeUser(user);
}

async function findUserById(userId) {
  if (!userId) return null;
  const user = readUsers().find((u) => u.id === userId) || null;
  return normalizeUser(user);
}

async function authenticate(email, password) {
  const user = await findUserByEmail(email);
  if (!user || !verifyPassword(password, user.password_hash)) return null;

  // Disabled accounts can never sign in.
  if (user.status === 'disabled') return null;

  // Best-effort last-login stamp (never blocks login).
  try {
    const users = readUsers();
    const index = users.findIndex((u) => u.id === user.id);
    if (index !== -1) {
      users[index].last_login_at = new Date().toISOString();
      writeUsers(users);
    }
  } catch { /* ignore */ }

  return safeUser(user);
}

// opts.resetByAdmin: when true (admin/platform reset) the user must change the
// password on next login (must_change_password=true). When false (the user is
// setting their own password) the flag is cleared.
async function updatePassword(userId, password, opts = {}) {
  const mustChange = opts.resetByAdmin === true;
  const passwordHash = hashPassword(password);
  const users = readUsers();
  const index = users.findIndex((user) => user.id === userId);
  if (index === -1) return null;
  users[index].password_hash = passwordHash;
  users[index].must_change_password = mustChange;
  users[index].updated_at = new Date().toISOString();
  users[index].email_verified = users[index].email_verified !== false;
  users[index].company_id = users[index].company_id || users[index].client_id;
  writeUsers(users);
  return safeUser(users[index]);
}

/* ── Team-management helpers (JSON-backed) ───────────────────────────────── */

function emailExists(email) {
  const normalized = String(email || '').trim().toLowerCase();
  return readUsers().some((u) => String(u.email).toLowerCase() === normalized);
}

function listUsersByCompany(companyId) {
  return readUsers()
    .filter((u) => String(u.company_id) === String(companyId))
    .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
}

function createUser(fields) {
  const users = readUsers();
  const now = new Date().toISOString();
  const user = {
    id: fields.id || `user-${crypto.randomUUID()}`,
    company_id: fields.company_id,
    company_name: fields.company_name || 'NFINITY HQ',
    email: String(fields.email).trim().toLowerCase(),
    email_verified: fields.email_verified !== false,
    password_hash: fields.password_hash,
    role: fields.role,
    display_name: fields.display_name,
    avatar_initials: fields.avatar_initials || null,
    status: fields.status || 'active',
    must_change_password: fields.must_change_password !== false,
    created_by: fields.created_by || null,
    phone: fields.phone || null,
    department: fields.department || null,
    last_login_at: null,
    disabled_at: null,
    created_at: now,
    updated_at: now,
  };
  users.push(user);
  writeUsers(users);
  return normalizeUser(user);
}

function updateUserFields(userId, patch) {
  const users = readUsers();
  const index = users.findIndex((u) => u.id === userId);
  if (index === -1) return null;
  users[index] = { ...users[index], ...patch, updated_at: new Date().toISOString() };
  writeUsers(users);
  return normalizeUser(users[index]);
}

function canManageUser(actor, targetUser) {
  if (!actor || actor.status === 'disabled') return false;
  const target = typeof targetUser === 'object' ? targetUser : null;
  const sameCompany = !target || Boolean(actor.company_id && target.company_id && actor.company_id === target.company_id);
  if (!sameCompany) return false;
  if (actor.role === 'platform_owner') return true;
  if (target?.role === 'platform_owner') return actor.id === target.id;
  if (actor.role === 'owner') return true;
  if (actor.role === 'admin') return !target || target.role !== 'owner';
  return target && actor.id === target.id;
}

function canEditCompanyConfig(actor) {
  return Boolean(actor && (actor.role === 'owner' || actor.role === 'admin'));
}

function canCreateOrDeleteUsers(actor) {
  return Boolean(actor && (actor.role === 'owner' || actor.role === 'admin'));
}

module.exports = {
  authenticate,
  canCreateOrDeleteUsers,
  canEditCompanyConfig,
  canManageUser,
  createUser,
  emailExists,
  findUserByEmail,
  findUserById,
  hashPassword,
  listUsersByCompany,
  readUsers,
  safeUser,
  updatePassword,
  updateUserFields,
  verifyPassword,
};
