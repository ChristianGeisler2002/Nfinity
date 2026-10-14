const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');

const isProduction = process.env.NODE_ENV === 'production';
const SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET;
const developmentSecret = crypto.randomBytes(48).toString('base64url');
const TTL = process.env.SESSION_TTL || '12h';

function validateSessionConfig() {
  if (isProduction && (!SECRET || SECRET.length < 32)) {
    throw new Error('Set JWT_SECRET to a random value of at least 32 characters before starting production');
  }
}

function getSecret() {
  validateSessionConfig();
  if (!SECRET && isProduction) {
    throw new Error('JWT_SECRET or SESSION_SECRET is required in production');
  }
  return SECRET || developmentSecret;
}

function createSessionToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      company_id: user.company_id || user.client_id,
      role: user.role,
    },
    getSecret(),
    { expiresIn: TTL }
  );
}

function verifySessionToken(token) {
  if (typeof token !== 'string' || !token) return null;
  try {
    const body = jwt.verify(token, getSecret());
    return body.sub || null;
  } catch {
    return null;
  }
}

module.exports = {
  validateSessionConfig,
  createSessionToken,
  verifySessionToken,
};
