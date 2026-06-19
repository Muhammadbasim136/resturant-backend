// api/health.js
// Standalone health-check endpoint. Confirms the deployed function can
// reach Firestore using the SAME connection (utils/firebaseAdmin.js) that
// every other route in this app uses — so a green result here means the
// real app's Firestore connection is actually working, not just a
// separate test config.

const { db } = require('../utils/firebaseAdmin');

module.exports = async function handler(req, res) {
  // Minimal CORS so this can be hit directly from a browser during setup.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    // Cheap read: just touch a doc reference, doesn't matter if it exists.
    await db.collection('_health').doc('check').get();

    return res.status(200).json({
      ok: true,
      message: 'Centraa backend is alive and Firestore is connected ✅',
      firestoreProjectId: db.app.options.credential?.projectId || 'unknown',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      message: 'Backend is running but Firestore connection failed ❌',
      error: err.message,
    });
  }
};
