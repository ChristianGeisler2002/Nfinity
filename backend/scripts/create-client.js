#!/usr/bin/env node
/**
 * create-client.js — platform-owner client onboarding (databaseless build).
 *
 * Creates a real client OWNER/ADMIN login in the local JSON user store. This is
 * the ONLY supported way to onboard a client — there is no public self-
 * registration. Employees are added later by the client owner/admin from the
 * in-app Team Members page (POST /api/team).
 *
 * Usage (interactive):
 *   npm run client:create
 *
 * Usage (non-interactive, CLI flags):
 *   node scripts/create-client.js \
 *     --company "Acme Logistics" --slug acme-logistics \
 *     --owner-email owner@acme.com --owner-name "Jane Doe" --role owner
 *
 * Behavior:
 *   - Generates a secure 16-char temp password, hashes it with bcryptjs.
 *   - Sets email_verified=true, must_change_password=true, status='active'.
 *   - Refuses to create a duplicate user email.
 *   - Prints the temp password ONCE; never stores plaintext.
 *
 * NOTE (databaseless build): users live in data/users.json on the server's
 * filesystem. On a single Elastic Beanstalk instance this persists between
 * requests but is wiped on redeploy/scale — fine for an interim launch. Switch
 * to the full PostgreSQL build for durable, multi-instance accounts.
 */
require('dotenv').config();

const readline = require('readline');
const { createUser, emailExists, hashPassword } = require('../core/auth/userStore');
const { generateTempPassword } = require('../core/auth/tempPassword');

const VALID_FIRST_ROLES = ['owner', 'admin'];

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

function slugify(input) {
  return String(input)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function isEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function initialsFrom(name) {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'NA';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function prompt(rl, question, fallback) {
  const suffix = fallback ? ` [${fallback}]` : '';
  return new Promise((resolve) => {
    rl.question(`${question}${suffix}: `, (answer) => {
      const trimmed = (answer || '').trim();
      resolve(trimmed || fallback || '');
    });
  });
}

async function gather(flags) {
  const haveCore = flags.company && flags['owner-email'] && flags['owner-name'];
  if (haveCore) {
    return {
      companyName: String(flags.company).trim(),
      slug: slugify(flags.slug || flags.company),
      ownerEmail: String(flags['owner-email']).trim().toLowerCase(),
      ownerName: String(flags['owner-name']).trim(),
      role: VALID_FIRST_ROLES.includes(flags.role) ? flags.role : 'owner',
      interactive: false,
    };
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const companyName = await prompt(rl, 'Company name', flags.company);
    const slug = slugify(await prompt(rl, 'Company slug', flags.slug || slugify(companyName)));
    const ownerEmail = (await prompt(rl, 'Owner/admin email', flags['owner-email'])).toLowerCase();
    const ownerName = await prompt(rl, 'Owner/admin display name', flags['owner-name']);
    let role = (await prompt(rl, 'Owner role (owner/admin)', flags.role || 'owner')).toLowerCase();
    if (!VALID_FIRST_ROLES.includes(role)) role = 'owner';
    return { companyName, slug, ownerEmail, ownerName, role, interactive: true };
  } finally {
    rl.close();
  }
}

function validate(input) {
  const errors = [];
  if (!input.companyName) errors.push('Company name is required.');
  if (!input.slug) errors.push('Company slug is required.');
  if (!isEmail(input.ownerEmail)) errors.push('A valid owner/admin email is required.');
  if (!input.ownerName) errors.push('Owner/admin display name is required.');
  return errors;
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  const input = await gather(flags);
  const errors = validate(input);
  if (errors.length) {
    console.error('\n[client:create] Cannot proceed:');
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  if (emailExists(input.ownerEmail)) {
    console.error(`\n[client:create] ❌ A user with email "${input.ownerEmail}" already exists.\n`);
    process.exit(1);
  }

  const tempPassword = generateTempPassword(16);
  const passwordHash = hashPassword(tempPassword);

  createUser({
    company_id: input.slug,
    company_name: input.companyName,
    email: input.ownerEmail,
    email_verified: true,
    password_hash: passwordHash,
    role: input.role,
    display_name: input.ownerName,
    avatar_initials: initialsFrom(input.ownerName),
    status: 'active',
    must_change_password: true,
  });

  console.log('\n========================================');
  console.log('  ✅ Client created successfully');
  console.log('========================================');
  console.log(`  Company:   ${input.companyName} (id: ${input.slug})`);
  console.log(`  Owner:     ${input.ownerName} <${input.ownerEmail}>  [role: ${input.role}]`);
  console.log('----------------------------------------');
  console.log(`  TEMP PASSWORD (shown once): ${tempPassword}`);
  console.log('----------------------------------------');
  console.log('  Deliver these credentials securely. The user must change');
  console.log('  this password on first login (must_change_password = true).');
  console.log('========================================\n');
}

main().catch((err) => {
  console.error(`[client:create] ❌ Unexpected error: ${err.message}`);
  process.exit(1);
});
