// DEMO USERS — Temporary client-side account for the public marketing demo.
// SECURITY NOTE:
//   - This file ships to the browser. Never put production credentials or
//     real password hashes here. A real backend (POST /api/auth/login) must
//     authenticate against the `users` table in Postgres/Supabase and return
//     a session via an HttpOnly + Secure + SameSite=Lax cookie.
//   - The hash below is sha-256("demo123") — not a real password protection,
//     just enough to keep the demo password out of plain source.
//   - The only seeded account is a low-privilege "viewer" so a leaked demo
//     session cannot be used to invoke admin-only API paths once wired up.

const DEMO_USER = Object.freeze({
  id: 'user-demo-001',
  email: 'demo@nfinityhq.com',
  password_hash_sha256: 'd3ad9315b7be5dd53b31a273b3b3aba5defe700808305aa16a3062b76658a791',
  client_id: 'demo',
  role: 'viewer',
  display_name: 'Demo User',
  company_name: 'NFINITY HQ',
  avatar_initials: 'DU'
});

export const DEMO_USERS = [DEMO_USER];

async function sha256Hex(str) {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    return null;
  }
  const enc = new TextEncoder().encode(String(str));
  const buf = await window.crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Authenticate the demo user.
 * Integration note: Replace with POST /api/auth/login
 */
export async function authenticateUser(email, password) {
  if (typeof email !== 'string' || typeof password !== 'string') return null;
  if (email.length > 254 || password.length > 256) return null;
  if (email.toLowerCase() !== DEMO_USER.email) return null;
  const hash = await sha256Hex(password);
  if (!hash || hash !== DEMO_USER.password_hash_sha256) return null;
  const { password_hash_sha256, ...safe } = DEMO_USER;
  return safe;
}

/**
 * Find user by ID
 * Integration note: Replace with GET /api/auth/session
 */
export function getUserById(userId) {
  return DEMO_USERS.find(u => u.id === userId) || null;
}

/**
 * Get all users for a specific client
 * Integration note: Replace with GET /api/client/users
 */
export function getUsersByClient(clientId) {
  return DEMO_USERS.filter(u => u.client_id === clientId);
}

/**
 * Get all available demo clients
 * Integration note: Replace with GET /api/client/list
 */
export function getAvailableClients() {
  const clientIds = [...new Set(DEMO_USERS.map(u => u.client_id))];
  return clientIds.map(clientId => ({
    clientId,
    company: DEMO_USERS.find(u => u.client_id === clientId)?.company_name,
    userCount: DEMO_USERS.filter(u => u.client_id === clientId).length
  }));
}
