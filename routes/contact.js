const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

// Lazy-init transporter (same pattern as mailer.js)
function getTransporter() {
  return nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });
}

// POST /api/contact (public — no auth required)
// Body: { name, email, subject, message }
router.post('/', async (req, res) => {
  try {
    const name    = String(req.body.name    || '').trim();
    const email   = String(req.body.email   || '').trim().toLowerCase();
    const subject = String(req.body.subject || 'General Inquiry').trim();
    const message = String(req.body.message || '').trim();

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'name, email, and message are required' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    if (message.length < 10) {
      return res.status(400).json({ error: 'Message is too short' });
    }

    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      console.error('ADMIN_EMAIL env var not set — contact email not sent');
      // Still return success to user (don't expose config issues)
      return res.json({ success: true });
    }

    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0f0f0f;color:#f0ede8;border-radius:10px;overflow:hidden;">
        <div style="background:#C9A84C;padding:20px 28px;">
          <h1 style="margin:0;font-size:1.3rem;color:#0a0a0a;letter-spacing:0.1em;">CENTRAA — New Contact Form Message</h1>
        </div>
        <div style="padding:28px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:10px 0;color:#888;font-size:0.85rem;width:120px;">Subject</td>
              <td style="padding:10px 0;font-weight:600;color:#C9A84C;">${escHtml(subject)}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:#888;font-size:0.85rem;">Name</td>
              <td style="padding:10px 0;">${escHtml(name)}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:#888;font-size:0.85rem;">Email</td>
              <td style="padding:10px 0;"><a href="mailto:${escHtml(email)}" style="color:#C9A84C;">${escHtml(email)}</a></td>
            </tr>
          </table>
          <hr style="border:none;border-top:1px solid #2a2a2a;margin:18px 0;" />
          <h3 style="color:#C9A84C;margin:0 0 12px;font-size:0.9rem;text-transform:uppercase;letter-spacing:0.08em;">Message</h3>
          <p style="line-height:1.7;color:#d0cdc8;white-space:pre-wrap;">${escHtml(message)}</p>
          <hr style="border:none;border-top:1px solid #2a2a2a;margin:18px 0;" />
          <p style="font-size:0.78rem;color:#555;">
            Reply directly to this email to respond to ${escHtml(name)}.
          </p>
        </div>
      </div>
    `;

    await getTransporter().sendMail({
      from:     `"Centraa Website" <${process.env.MAIL_USER}>`,
      to:       adminEmail,
      replyTo:  email,          // admin can hit Reply to respond directly
      subject:  `New Contact Form: ${subject}`,
      html,
    });

    res.json({ success: true });

  } catch (err) {
    console.error('Contact email error:', err.message);
    res.status(500).json({ error: 'Failed to send message. Please try again.' });
  }
});

// Simple HTML escape — no external deps needed for this
function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = router;