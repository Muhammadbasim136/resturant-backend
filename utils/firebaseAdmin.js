const admin = require('firebase-admin');

// Initialize Firebase Admin SDK exactly once (Vercel may reuse the same
// serverless function instance across invocations, so guard against
// re-initializing on every request).
if (!admin.apps.length) {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is not set');
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch (err) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON: ' + err.message);
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// NOTE: we only use Firestore here. Image storage moved to Cloudinary
// (see utils/cloudinary.js) because Firebase Storage now requires the
// paid Blaze plan even for tiny usage — Firestore itself is unaffected
// and stays on the free Spark plan.
const db = admin.firestore();

module.exports = { admin, db };