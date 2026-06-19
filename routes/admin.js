const express = require('express');
const router = express.Router();
const isAdmin = require('../middleware/isAdmin');

/**
 * The other routes' admin checks happen via the x-admin-email /
 * x-admin-password headers on every request (see middleware/isAdmin.js).
 * These two endpoints exist so the admin frontend has something to call:
 *  - POST /login: verify credentials once at login time, before storing
 *    them locally for use as headers on subsequent admin requests.
 *  - GET /verify: re-check stored credentials are still valid (e.g. on
 *    app load) using the exact same header-based check as every other
 *    admin route.
 */

// POST /api/admin/login
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
      return res.json({ success: true, message: 'Admin login successful' });
    }

    return res.status(403).json({ error: 'Admin access denied' });
  } catch (err) {
    res.status(500).json({ error: 'Admin login failed: ' + err.message });
  }
});

// GET /api/admin/verify
router.get('/verify', isAdmin, (req, res) => {
  res.json({ success: true, isAdmin: true });
});

module.exports = router;
