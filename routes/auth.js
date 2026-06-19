const express = require('express');
const router = express.Router();
const { db } = require('../utils/firebaseAdmin');
const { hashPassword, comparePassword } = require('../utils/password');
const { generateOtp, verifyOtp } = require('../utils/otp');
const { signToken } = require('../utils/jwt');
const { sendVerificationCode, sendPasswordResetCode } = require('../utils/mailer');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

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

async function findUserByEmail(email) {
  const snapshot = await db.collection('users').where('email', '==', email).limit(1).get();
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ref: doc.ref, data: doc.data() };
}

// ─────────────────────────────────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const phone = String(req.body.phone || '').trim();
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');

    if (!name || !phone || !email || !password) {
      return res.status(400).json({ error: 'name, phone, email, and password are required' });
    }
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const hashedPassword = await hashPassword(password);
    const { code, codeHash, expiresAt } = await generateOtp();

    const newUser = {
      name,
      phone,
      email,
      password: hashedPassword,
      role: 'user',
      blocked: false,
      emailVerified: false,
      verificationCodeHash: codeHash,
      verificationCodeExpiresAt: expiresAt,
      createdAt: new Date().toISOString(),
    };

    const docRef = await db.collection('users').add(newUser);

    let emailSent = true;
    try {
      await sendVerificationCode(email, name, code);
    } catch (mailErr) {
      emailSent = false;
      console.error('Failed to send verification email:', mailErr.message);
    }

    res.status(201).json({
      success: true,
      message: emailSent
        ? 'Account created! Check your email for the 6-digit verification code.'
        : 'Account created, but the verification email failed to send. Use "resend code".',
      uid: docRef.id,
      emailSent,
    });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed: ' + err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /api/auth/verify-email
// ─────────────────────────────────────────────────────────────────────────
router.post('/verify-email', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const code = String(req.body.code || '').trim();

    if (!email || !code) {
      return res.status(400).json({ error: 'email and code are required' });
    }

    const found = await findUserByEmail(email);
    if (!found) {
      return res.status(404).json({ error: 'No account found with that email' });
    }

    if (found.data.emailVerified === true) {
      return res.status(400).json({ error: 'This account is already verified, please log in' });
    }

    const result = await verifyOtp(code, found.data.verificationCodeHash, found.data.verificationCodeExpiresAt);
    if (!result.valid) {
      return res.status(400).json({ error: result.reason });
    }

    await found.ref.update({
      emailVerified: true,
      verificationCodeHash: null,
      verificationCodeExpiresAt: null,
      updatedAt: new Date().toISOString(),
    });

    const token = signToken(found.id);

    res.json({
      success: true,
      message: 'Email verified! You are now logged in.',
      token,
      user: publicUser(found.id, { ...found.data, emailVerified: true }),
    });
  } catch (err) {
    res.status(500).json({ error: 'Verification failed: ' + err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /api/auth/resend-verification
// ─────────────────────────────────────────────────────────────────────────
router.post('/resend-verification', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }

    const found = await findUserByEmail(email);
    if (!found) {
      return res.status(404).json({ error: 'No account found with that email' });
    }
    if (found.data.emailVerified === true) {
      return res.status(400).json({ error: 'This account is already verified, please log in' });
    }

    const { code, codeHash, expiresAt } = await generateOtp();
    await found.ref.update({ verificationCodeHash: codeHash, verificationCodeExpiresAt: expiresAt });

    await sendVerificationCode(email, found.data.name, code);

    res.json({ success: true, message: 'A new verification code has been sent to your email.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to resend code: ' + err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const found = await findUserByEmail(email);
    if (!found) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const passwordMatches = await comparePassword(password, found.data.password);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (found.data.blocked === true) {
      return res.status(403).json({ error: 'Your account has been blocked. Contact support.' });
    }

    if (found.data.emailVerified !== true) {
      return res.status(403).json({
        error: 'Please verify your email before logging in',
        needsVerification: true,
      });
    }

    const token = signToken(found.id);

    res.json({
      success: true,
      token,
      user: publicUser(found.id, found.data),
    });
  } catch (err) {
    res.status(500).json({ error: 'Login failed: ' + err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /api/auth/forgot-password
// Always returns the same generic message whether or not the email exists,
// so an attacker can't use this endpoint to discover registered emails.
// ─────────────────────────────────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  const GENERIC_RESPONSE = {
    success: true,
    message: 'If an account exists with that email, a reset PIN has been sent.',
  };

  try {
    const email = normalizeEmail(req.body.email);
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }

    const found = await findUserByEmail(email);
    if (!found) {
      return res.json(GENERIC_RESPONSE);
    }

    const { code, codeHash, expiresAt } = await generateOtp();
    await found.ref.update({ resetCodeHash: codeHash, resetCodeExpiresAt: expiresAt });

    try {
      await sendPasswordResetCode(email, found.data.name, code);
    } catch (mailErr) {
      console.error('Failed to send password reset email:', mailErr.message);
    }

    res.json(GENERIC_RESPONSE);
  } catch (err) {
    res.status(500).json({ error: 'Something went wrong: ' + err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /api/auth/reset-password
// ─────────────────────────────────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const code = String(req.body.code || '').trim();
    const newPassword = String(req.body.newPassword || '');

    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'email, code, and newPassword are required' });
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }

    const found = await findUserByEmail(email);
    if (!found) {
      return res.status(400).json({ error: 'Invalid code or email' });
    }

    const result = await verifyOtp(code, found.data.resetCodeHash, found.data.resetCodeExpiresAt);
    if (!result.valid) {
      return res.status(400).json({ error: result.reason });
    }

    const hashedPassword = await hashPassword(newPassword);

    await found.ref.update({
      password: hashedPassword,
      resetCodeHash: null,
      resetCodeExpiresAt: null,
      updatedAt: new Date().toISOString(),
    });

    const token = signToken(found.id);

    res.json({
      success: true,
      message: 'Password reset successful. You are now logged in.',
      token,
      user: publicUser(found.id, found.data),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset password: ' + err.message });
  }
});

module.exports = router;