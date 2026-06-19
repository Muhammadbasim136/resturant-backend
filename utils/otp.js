const crypto = require('crypto');

const CODE_LENGTH = 6;
const EXPIRY_MINUTES = 10;

/**
 * Generates a random 6-digit numeric code, e.g. "048213".
 * @returns {string}
 */
function generateCode() {
  const num = crypto.randomInt(0, 10 ** CODE_LENGTH);
  return num.toString().padStart(CODE_LENGTH, '0');
}

/**
 * One-way hash of a code, so the real code is never stored in Firestore
 * (same reasoning as not storing plain-text passwords).
 * @param {string} code
 * @returns {string}
 */
function hashCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

/**
 * ISO timestamp EXPIRY_MINUTES from now, to store alongside the hash.
 * @returns {string}
 */
function buildExpiry() {
  return new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000).toISOString();
}

function isExpired(expiresAtIso) {
  if (!expiresAtIso) return true;
  return new Date(expiresAtIso).getTime() < Date.now();
}

/**
 * Verifies a user-submitted code against the stored hash + expiry.
 * @param {string} submittedCode
 * @param {string} storedHash
 * @param {string} expiresAtIso
 * @returns {boolean}
 */
function verifyCode(submittedCode, storedHash, expiresAtIso) {
  if (!storedHash || !submittedCode) return false;
  if (isExpired(expiresAtIso)) return false;
  return hashCode(String(submittedCode).trim()) === storedHash;
}

module.exports = {
  generateCode,
  hashCode,
  buildExpiry,
  isExpired,
  verifyCode,
  EXPIRY_MINUTES,
};