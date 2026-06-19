const { db } = require('../utils/firebaseAdmin');
const { verifyJwt } = require('../utils/jwt');

/**
 * Admin auth middleware.
 *
 * This used to check static x-admin-email / x-admin-password headers
 * against ADMIN_EMAIL / ADMIN_PASSWORD env vars. That never matched what
 * the frontend actually sends, and meant "admin" wasn't a real account.
 *
 * Now an admin is just a normal user document in Firestore whose `role`
 * field is "admin" (set manually in the Firestore console after they
 * register and verify their email normally through /api/auth/register).
 * They log in the same way as any customer — see POST /api/admin/login,
 * which is the same check as /api/auth/login plus a role guard — and then
 * send the JWT they get back on every admin request as:
 *   Authorization: Bearer <jwt>
 */
module.exports = async function isAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
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
      return res.status(403).json({ error: 'Your account has been blocked.' });
    }

    if (userData.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access only' });
    }

    req.user = {
      uid,
      name: userData.name || '',
      email: userData.email || '',
      phone: userData.phone || '',
      role: userData.role,
    };
    req.isAdmin = true;

    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
};