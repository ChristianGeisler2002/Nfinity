const crypto = require('crypto');

// Character set excludes ambiguous chars (0/O, 1/l/I) for clean manual delivery,
// while still spanning upper, lower, digit, and symbol classes.
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const DIGIT = '23456789';
const SYMBOL = '!@#$%^&*?-_';
const ALL = UPPER + LOWER + DIGIT + SYMBOL;

function pick(charset) {
  return charset[crypto.randomInt(charset.length)];
}

/**
 * Generate a cryptographically-random temporary password.
 * Guarantees at least one char from each class, then fills + shuffles.
 * @param {number} length - total length (default 16, min 12)
 */
function generateTempPassword(length = 16) {
  const len = Math.max(12, Number(length) || 16);
  const required = [pick(UPPER), pick(LOWER), pick(DIGIT), pick(SYMBOL)];
  const rest = Array.from({ length: len - required.length }, () => pick(ALL));
  const chars = [...required, ...rest];
  // Fisher–Yates shuffle with crypto randomness so required chars aren't front-loaded.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

module.exports = { generateTempPassword };
