const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'nfinity-api-'));
for (const [key, file] of Object.entries({ USERS_FILE: 'users', LEADS_FILE: 'leads', FILES_FILE: 'files', RESET_TOKENS_FILE: 'resets', AUDIT_FILE: 'audit' })) process.env[key] = path.join(temporary, `${file}.json`);
process.env.UPLOAD_DIR = path.join(temporary, 'uploads');
process.env.NODE_ENV = 'test';
process.env.BCRYPT_ROUNDS = '4';
process.env.JWT_SECRET = 'local-test-secret-for-disposable-test-users';
delete process.env.RESEND_API_KEY;
delete process.env.TELEGRAM_BOT_TOKEN;
const users = require('../backend/core/auth/userStore');
const { createSessionToken } = require('../backend/core/auth/sessionToken');
const { app } = require('../backend/server');
let server, base, owner, other, token;
before(async () => {
  owner = users.createUser({ company_id: 'test-a', email: 'owner@example.test', display_name: 'Test Owner', role: 'owner', password_hash: users.hashPassword('local-test-password'), must_change_password: false });
  other = users.createUser({ company_id: 'test-b', email: 'other@example.test', display_name: 'Other Company', role: 'owner', password_hash: users.hashPassword('local-test-password'), must_change_password: false });
  token = createSessionToken(owner);
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise(resolve => server.close(resolve));
  fs.rmSync(temporary, { recursive: true, force: true });
});
function request(route, method = 'GET', body, bearer = token) {
  return fetch(base + route, { method, headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}

test('serves frontend pages while keeping backend files private', async () => {
  for (const route of ['/healthz', '/public/index.html', '/public/login.html', '/apps/demo/', '/public/runtime-config.js', '/core/scenarios/invoiceService.js', '/reset.html']) assert.equal((await request(route)).status, 200, route);
  for (const route of ['/.env', '/data/users.json', '/core/auth/userStore.js', '/api/test-telegram']) assert.equal((await request(route)).status, 404, route);
});

test('login authenticates stored accounts and hides password fields', async () => {
  const result = await request('/api/auth/login', 'POST', { email: owner.email, password: 'local-test-password' });
  assert.equal(result.status, 200);
  const payload = await result.json();
  assert.ok(payload.sessionToken);
  assert.equal(payload.user.password_hash, undefined);
  assert.equal((await request('/api/auth/login', 'POST', { email: owner.email, password: 'wrong' })).status, 401);
  assert.equal((await request('/api/auth/register', 'POST', {})).status, 404);
});

test('team changes remain inside the authenticated company', async () => {
  const result = await request('/api/team');
  const body = await result.json();
  assert.ok(body.users.every(user => user.company_id === 'test-a'));
  assert.equal((await request(`/api/team/${other.id}`, 'PATCH', { display_name: 'Denied' })).status, 404);
  const created = await request('/api/team', 'POST', { display_name: 'Employee Example', email: 'employee@example.test', role: 'employee', company_id: 'test-b' });
  assert.equal(created.status, 201);
  const employee = await created.json();
  assert.equal(employee.user.company_id, 'test-a');
  assert.equal(employee.user.password_hash, undefined);
  assert.equal((await request('/api/team', 'GET', undefined, null)).status, 401);
});

test('disabled sessions cannot upload or change passwords', async () => {
  const disabled = users.createUser({ company_id: 'test-a', email: 'disabled@example.test', role: 'employee', status: 'disabled', password_hash: users.hashPassword('local-test-password') });
  const disabledToken = createSessionToken(disabled);
  assert.equal((await request(`/api/auth/users/${disabled.id}/password`, 'PATCH', { password: 'replacement-password' }, disabledToken)).status, 403);
  const form = new FormData();
  form.append('file', new Blob(['test'], { type: 'text/csv' }), 'example.csv');
  const result = await fetch(base + '/api/uploads', { method: 'POST', body: form, headers: { Authorization: `Bearer ${disabledToken}` } });
  assert.equal(result.status, 403);
});

test('malformed bodies produce useful client errors', async () => {
  const result = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken' });
  assert.equal(result.status, 400);
});

test('local upload writes bytes and records metadata', async () => {
  const form = new FormData();
  form.append('file', new Blob(['a,b\n1,2'], { type: 'text/csv' }), '../sample.csv');
  const result = await fetch(base + '/api/uploads', { method: 'POST', body: form, headers: { Authorization: `Bearer ${token}` } });
  assert.equal(result.status, 201);
  const body = await result.json();
  assert.equal(body.file.company_id, 'test-a');
  assert.equal(body.file.storage_provider, 'local');
  assert.ok(!body.file.original_name.includes('/'));
});
