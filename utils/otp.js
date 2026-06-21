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

/**
 * High-level helper used by routes/auth.js — generates everything needed
 * to issue a fresh verification/reset code in one call.
 * @returns {Promise<{ code: string, codeHash: string, expiresAt: string }>}
 */
async function generateOtp() {
  const code = generateCode();
  const codeHash = hashCode(code);
  const expiresAt = buildExpiry();
  return { code, codeHash, expiresAt };
}

/**
 * High-level helper used by routes/auth.js — verifies a submitted code
 * and returns a result object with a human-readable reason on failure,
 * so the route can pass it straight through to the client.
 * @param {string} submittedCode
 * @param {string} storedHash
 * @param {string} expiresAtIso
 * @returns {Promise<{ valid: boolean, reason: string|null }>}
 */
async function verifyOtp(submittedCode, storedHash, expiresAtIso) {
  if (!storedHash || !submittedCode) {
    return { valid: false, reason: 'No verification code found. Please request a new one.' };
  }
  if (isExpired(expiresAtIso)) {
    return { valid: false, reason: 'This code has expired. Please request a new one.' };
  }
  if (hashCode(String(submittedCode).trim()) !== storedHash) {
    return { valid: false, reason: 'Incorrect code. Please check and try again.' };
  }
  return { valid: true, reason: null };
}

module.exports = {
  generateCode,
  hashCode,
  buildExpiry,
  isExpired,
  verifyCode,
  generateOtp,
  verifyOtp,
  EXPIRY_MINUTES,
};