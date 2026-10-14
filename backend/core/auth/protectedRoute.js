// PROTECTED ROUTE — Redirect unauthenticated users to login
//
// SECURITY:
//   - Role hierarchy is enforced here, but client-side guards are advisory.
//     The backend MUST re-check role on every privileged request — never trust
//     this file as the only access control.
//   - Redirects are hard-coded to same-origin relative paths so a stale
//     query/fragment can't redirect users off-site (open redirect).
//   - We never call alert()/history.back() on denial; a hostile page could
//     have manipulated history and that pattern is confusing to users.

import { isAuthenticated, getCurrentUser } from './authService.js';

const LOGIN_URL = '/public/login.html';
const FORBIDDEN_URL = '/public/index.html';

const ROLE_HIERARCHY = Object.freeze({ admin: 3, manager: 2, viewer: 1 });

function safeRedirect(target) {
  // Only same-origin absolute paths are allowed.
  if (typeof target !== 'string' || !target.startsWith('/')) {
    target = LOGIN_URL;
  }
  window.location.replace(target);
}

/**
 * Protect a route — redirect to login if not authenticated.
 * Call this at the start of any protected page.
 */
export function protectRoute() {
  if (!isAuthenticated()) {
    safeRedirect(LOGIN_URL);
    return false;
  }
  return true;
}

/**
 * Protect specific role — only allow certain roles.
 * @param {string} requiredRole - 'admin', 'manager', 'viewer'
 */
export function protectRoleRoute(requiredRole) {
  if (!isAuthenticated()) {
    safeRedirect(LOGIN_URL);
    return false;
  }

  const user = getCurrentUser();
  const userLevel = ROLE_HIERARCHY[user && user.role] || 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;

  if (userLevel >= requiredLevel) return true;

  safeRedirect(FORBIDDEN_URL);
  return false;
}

/**
 * Initialize route protection on page load.
 * Call this on any protected page (like /apps/demo/index.html).
 */
export function initializeProtection() {
  if (!isAuthenticated()) {
    safeRedirect(LOGIN_URL);
    return false;
  }
  return true;
}

/**
 * Add to HTML: Check on page load
 * <script>
 *   import { initializeProtection } from './core/auth/protectedRoute.js';
 *   initializeProtection();
 * </script>
 */
