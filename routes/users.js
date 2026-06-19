const express = require('express');
const router = express.Router();
const { db } = require('../utils/firebaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const isAdmin = require('../middleware/isAdmin');
const { hashPassword } = require('../utils/password');

// GET /api/users/me (user)
router.get('/me', verifyToken, (req, res) => {
  res.json(req.user);
});

// PATCH /api/users/me (user) - only name and phone are editable, not email/role
router.patch('/me', verifyToken, async (req, res) => {
  try {
    const { name, phone } = req.body;
    const updates = {};

    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Provide name and/or phone to update' });
    }

    updates.updatedAt = new Date().toISOString();

    await db.collection('users').doc(req.user.uid).update(updates);

    res.json({ success: true, message: 'Profile updated', ...updates });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile: ' + err.message });
  }
});

// GET /api/users/admin/all (admin)
router.get('/admin/all', isAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection('users').get();
    const users = snapshot.docs.map((doc) => {
      const data = doc.data();
      delete data.password; // never expose stored passwords in list responses
      return { id: doc.id, ...data };
    });

    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users: ' + err.message });
  }
});

// PATCH /api/users/admin/:uid/block (admin) - toggles blocked field
router.patch('/admin/:uid/block', isAdmin, async (req, res) => {
  try {
    const docRef = db.collection('users').doc(req.params.uid);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const newBlockedState = !(doc.data().blocked === true);
    await docRef.update({ blocked: newBlockedState, updatedAt: new Date().toISOString() });

    res.json({ success: true, blocked: newBlockedState });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update block status: ' + err.message });
  }
});

// PATCH /api/users/admin/:uid/password (admin)
router.patch('/admin/:uid/password', isAdmin, async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'password is required' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const docRef = db.collection('users').doc(req.params.uid);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const hashedPassword = await hashPassword(password);
    await docRef.update({ password: hashedPassword, updatedAt: new Date().toISOString() });

    res.json({ success: true, message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update password: ' + err.message });
  }
});

// DELETE /api/users/admin/:uid (admin)
router.delete('/admin/:uid', isAdmin, async (req, res) => {
  try {
    const docRef = db.collection('users').doc(req.params.uid);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    await docRef.delete();

    res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user: ' + err.message });
  }
});

module.exports = router;