const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin SDK exactly once (Vercel may reuse the same
// serverless function instance across invocations, so guard against
// re-initializing on every request).
//
// NOTE: firebase-admin v12+ moved to a modular API — the old
// `admin.apps`, `admin.credential.cert()`, `admin.firestore()` style
// (top-level `require('firebase-admin')` namespace) no longer exists.
// We now import directly from `firebase-admin/app` and
// `firebase-admin/firestore` instead.
if (!getApps().length) {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is not set');
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch (err) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON: ' + err.message);
  }

  initializeApp({
    credential: cert(serviceAccount),
  });
}

// NOTE: we only use Firestore here. Image storage moved to Cloudinary
// (see utils/cloudinary.js) because Firebase Storage now requires the
// paid Blaze plan even for tiny usage — Firestore itself is unaffected
// and stays on the free Spark plan.
const db = getFirestore();

module.exports = { db };