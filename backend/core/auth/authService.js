// AUTH SERVICE — Core authentication & user session management

import { authenticateUser, getUserById } from './demoUsers.js';

const STORAGE_KEY = 'nfinity_auth_session';
const CLIENT_CONFIG_KEY = 'nfinity_client_config';

/**
 * Login user with email & password.
 * Returns: { success: boolean, user: object, error: string }
 *
 * SECURITY: Returns a generic error for any failure so we don't leak whether
 * the email exists. The real backend must do the same.
 */
export async function login(email, password) {
  try {
    const user = await authenticateUser(email, password);

    if (!user) {
      return { success: false, error: 'Invalid email or password' };
    }

    const now = Date.now();
    const session = {
      userId: user.id,
      email: user.email,
      clientId: user.client_id,
      role: user.role,
      displayName: user.display_name,
      companyName: user.company_name,
      avatarInitials: user.avatar_initials,
      loginTime: now,
      lastActivity: now,
      timestamp: now
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    return { success: true, user: session };
  } catch (_error) {
    return { success: false, error: 'Invalid email or password' };
  }
}

/**
 * Logout — clear session
 */
export function logout() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(CLIENT_CONFIG_KEY);
  window.location.href = '/public/index.html';
}

// Auto-logout after this many minutes of inactivity.
const SESSION_MAX_INACTIVE_MINUTES = 60;
// Hard cap on session lifetime — re-auth required after this many hours.
const SESSION_MAX_LIFETIME_HOURS = 12;

/**
 * Check if user is authenticated and the session is still valid.
 * Returning false here causes protectRoute() to redirect to login.
 */
export function isAuthenticated() {
  const user = getCurrentUser();
  return !!user;
}

/**
 * Get current user (from session). Returns null and clears the session if it
 * is malformed or expired.
 */
export function getCurrentUser() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  let session;
  try {
    session = JSON.parse(raw);
  } catch (_error) {
    // Don't log the session blob — it may contain identifying data.
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(CLIENT_CONFIG_KEY);
    return null;
  }

  if (!session || typeof session !== 'object') {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }

  const now = Date.now();
  const loginTime = Number(session.loginTime || session.timestamp || 0);
  const lastActivity = Number(session.lastActivity || session.timestamp || loginTime);

  // Hard lifetime cap.
  if (loginTime && now - loginTime > SESSION_MAX_LIFETIME_HOURS * 60 * 60 * 1000) {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(CLIENT_CONFIG_KEY);
    return null;
  }

  // Idle timeout.
  if (lastActivity && now - lastActivity > SESSION_MAX_INACTIVE_MINUTES * 60 * 1000) {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(CLIENT_CONFIG_KEY);
    return null;
  }

  return session;
}

/**
 * Get current client ID
 */
export function getClientId() {
  const user = getCurrentUser();
  return user?.clientId || null;
}

/**
 * Get current user role
 */
export function getUserRole() {
  const user = getCurrentUser();
  return user?.role || null;
}

/**
 * Validate if user has required role
 */
export function hasRole(requiredRole) {
  const userRole = getUserRole();

  // Admin has access to everything
  if (userRole === 'admin') return true;

  // Manager has access to manager + viewer content
  if (userRole === 'manager' && requiredRole !== 'admin') return true;

  // Viewer has access only to viewer content
  if (userRole === 'viewer' && requiredRole === 'viewer') return true;

  return false;
}

/**
 * Store client config in session
 */
export function setClientConfig(config) {
  localStorage.setItem(CLIENT_CONFIG_KEY, JSON.stringify(config));
}

/**
 * Get stored client config
 */
export function getClientConfig() {
  const config = localStorage.getItem(CLIENT_CONFIG_KEY);
  if (!config) return null;

  try {
    return JSON.parse(config);
  } catch (error) {
    console.error('Error parsing client config:', error);
    return null;
  }
}

/**
 * Refresh session — call on user activity to push out the idle timeout.
 * Keeps the original loginTime so the hard lifetime cap still applies.
 */
export function refreshSession() {
  const user = getCurrentUser();
  if (!user) return null;
  user.lastActivity = Date.now();
  user.timestamp = user.lastActivity;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  return user;
}

/**
 * Check whether the session has expired. Kept for callers that need an
 * explicit predicate; getCurrentUser already enforces this.
 */
export function isSessionExpired(maxInactiveMinutes = SESSION_MAX_INACTIVE_MINUTES) {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return true;
  try {
    const s = JSON.parse(raw);
    const lastActivity = Number(s.lastActivity || s.timestamp || 0);
    if (!lastActivity) return true;
    return (Date.now() - lastActivity) > maxInactiveMinutes * 60 * 1000;
  } catch {
    return true;
  }
}
