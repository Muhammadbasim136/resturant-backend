const jwt = require('jsonwebtoken');

const EXPIRES_IN = '30d';

/**
 * Signs a JWT for a logged-in user. Keep the payload minimal — just
 * enough to identify the user (uid). Role/blocked/verified status are
 * always re-checked against Firestore on every request rather than
 * trusted from the token, since those can change after issuance.
 * @param {{ uid: string }} payload
 * @returns {string}
 */
function signJwt(payload) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: EXPIRES_IN });
}

/**
 * Verifies and decodes a JWT. Throws if invalid/expired — callers should
 * wrap this in try/catch.
 * @param {string} token
 * @returns {{ uid: string, iat: number, exp: number }}
 */
function verifyJwt(token) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { signJwt, verifyJwt };