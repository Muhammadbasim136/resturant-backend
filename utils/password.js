const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

/**
 * Hashes a plain-text password for storage. Never store req.body.password
 * directly — always pass it through this first.
 * @param {string} plainPassword
 * @returns {Promise<string>}
 */
async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/**
 * Compares a plain-text password against a stored bcrypt hash.
 * Safe to call even if `hash` is missing/undefined — returns false instead
 * of throwing.
 * @param {string} plainPassword
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
async function comparePassword(plainPassword, hash) {
  if (!hash) return false;
  return bcrypt.compare(plainPassword, hash);
}

module.exports = { hashPassword, comparePassword };