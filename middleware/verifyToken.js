const { db } = require('../utils/firebaseAdmin');
const { verifyJwt } = require('../utils/jwt');

/**
 * Auth middleware — now backed by a real signed JWT instead of a raw
 * Firestore document ID in the Authorization header. The frontend gets
 * this JWT from POST /api/auth/login (or /api/auth/verify-email right
 * after registering) and must send it as:
 *   Authorization: Bearer <jwt>
 *
 * The JWT itself only proves "this uid logged in and the token hasn't
 * been tampered with or expired" — it does NOT carry role/blocked status,
 * since those can change after the token was issued. So we always look
 * the user back up in Firestore on every request to get fresh data.
 */
module.exports = async function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const parts = authHeader.split(' ');
    const scheme = parts[0];
    const token = parts[1];

    if (!scheme || scheme !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'Unauthorized — no token provided' });
    }

    let payload;
    try {
      payload = verifyJwt(token);
    } catch (err) {
      return res.status(401).json({ error: 'Session expired or invalid, please log in again' });
    }

    const uid = payload.uid;
    const userDoc = await db.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userData = userDoc.data();

    if (userData.blocked === true) {
      return res.status(403).json({ error: 'Your account has been blocked. Contact support.' });
    }

    if (userData.emailVerified !== true) {
      return res.status(403).json({ error: 'Please verify your email before continuing' });
    }

    req.user = {
      uid,
      name: userData.name || '',
      email: userData.email || '',
      phone: userData.phone || '',
      role: userData.role || 'user',
    };

    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
};