// Integration note: Configure base URL + auth headers for real backend.
//
// SECURITY:
//   - BASE_URL comes from the validated Amplify runtime config.
//   - Cross-origin API requests omit cookies; authenticated calls use the
//     explicit Authorization header until HttpOnly cookie auth is introduced.
//   - The session token is read from localStorage to retain the current
//     demo behaviour, but production should switch to an HttpOnly cookie
//     and drop the Authorization header entirely.
//   - We refuse to send the token to URLs that escape the API root.
//   - 15-second timeout via AbortController prevents hung requests from
//     pinning resources.
const BASE_URL = (window.NFINITY_API_BASE_URL || '').replace(/\/+$/, '') + '/api';
const REQUEST_TIMEOUT_MS = 15_000;

function readSessionToken() {
  try {
    const session = JSON.parse(localStorage.getItem('nfinity_auth_session') || '{}');
    // Login stores the JWT under `sessionToken`; accept legacy `token` too.
    const raw = session && (session.sessionToken || session.token);
    const token = typeof raw === 'string' ? raw : '';
    // Bearer tokens are opaque but should look like a JWT or a long string.
    // Reject obviously bogus values to avoid sending header garbage.
    if (!token || token.length > 4096) return '';
    if (/[\r\n]/.test(token)) return '';
    return token;
  } catch {
    return '';
  }
}

async function request(method, path, body) {
  if (typeof path !== 'string' || !path.startsWith('/')) {
    throw new Error('Invalid path');
  }

  const destination = new URL(`${BASE_URL}${path}`, window.location.origin);
  const apiRoot = new URL(`${BASE_URL}/`, window.location.origin);
  if (destination.origin !== apiRoot.origin || !destination.pathname.startsWith(apiRoot.pathname)) {
    throw new Error('Invalid API path');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
  const token = readSessionToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(destination.href, {
      method,
      headers,
      credentials: BASE_URL.startsWith('http') ? 'omit' : 'same-origin',
      redirect: 'error',
      cache: 'no-store',
      signal: controller.signal,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    if (!res.ok) {
      // Strip any server-supplied detail strings from the thrown error so we
      // don't surface backend implementation details in the console.
      throw new Error(`${method} ${path} → ${res.status}`);
    }
    // 204 No Content
    if (res.status === 204) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      throw new Error(`${method} ${path} → unexpected content-type`);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  get:    (path)        => request('GET',    path),
  post:   (path, body)  => request('POST',   path, body),
  put:    (path, body)  => request('PUT',    path, body),
  patch:  (path, body)  => request('PATCH',  path, body),
  delete: (path)        => request('DELETE', path),
};
