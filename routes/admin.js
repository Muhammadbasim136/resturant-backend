const express = require('express');
const router = express.Router();
const { db } = require('../utils/firebaseAdmin');
const { comparePassword } = require('../utils/password');
const { signToken } = require('../utils/jwt');
const isAdmin = require('../middleware/isAdmin');

/**
 * Admin is just a normal Firestore user document whose `role` field is
 * "admin" — there is no separate admin account system anymore. This
 * route exists purely as a convenience: it's the same email+password
 * check as POST /api/auth/login, plus a role guard, so the admin panel
 * has a dedicated endpoint to call instead of relying on customer login
 * and checking the role client-side.
 *
 * On success it returns a signed JWT exactly like /api/auth/login does —
 * send it back on every subsequent admin request as:
 *   Authorization: Bearer <jwt>
 */

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function publicUser(uid, data) {
  return {
    uid,
    name: data.name || '',
    email: data.email || '',
    phone: data.phone || '',
    role: data.role || 'user',
  };
}

// POST /api/admin/login
router.post('/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const snapshot = await db.collection('users').where('email', '==', email).limit(1).get();

    if (snapshot.empty) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    const passwordMatches = await comparePassword(password, data.password);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (data.blocked === true) {
      return res.status(403).json({ error: 'Your account has been blocked.' });
    }

    if (data.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied — admin accounts only.' });
    }

    const token = signToken(doc.id);

   res.cookie('auth_token', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'none',
  maxAge: 7 * 24 * 60 * 60 * 1000
});

res.json({
  success: true,
  user: publicUser(doc.id, data),
});
  } catch (err) {
    res.status(500).json({ error: 'Admin login failed: ' + err.message });
  }
});

// GET /api/admin/verify — re-checks the JWT + role on app load/refresh
router.get('/verify', isAdmin, (req, res) => {
  res.json({ success: true, isAdmin: true, user: req.user });
});

module.exports = router;