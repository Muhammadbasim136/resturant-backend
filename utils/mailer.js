const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

function buildItemsTable(items) {
  const rows = (items || [])
    .map(
      (item) => `
      <tr>
        <td style="padding:8px;border:1px solid #ddd;">${item.name}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:center;">${item.qty}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:right;">Rs. ${item.price}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:right;">Rs. ${item.price * item.qty}</td>
      </tr>`
    )
    .join('');

  return `
    <table style="width:100%;border-collapse:collapse;margin-top:12px;">
      <thead>
        <tr style="background:#f97316;color:#ffffff;">
          <th style="padding:8px;border:1px solid #ddd;text-align:left;">Item</th>
          <th style="padding:8px;border:1px solid #ddd;">Qty</th>
          <th style="padding:8px;border:1px solid #ddd;">Price</th>
          <th style="padding:8px;border:1px solid #ddd;">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function buildOtpHtml({ heading, intro, code, footer }) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#1f2937;">
      <h2 style="color:#f97316;">${heading}</h2>
      <p>${intro}</p>
      <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:20px;text-align:center;margin:20px 0;">
        <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#1f2937;">${code}</span>
      </div>
      <p style="color:#6b7280;font-size:14px;">${footer}</p>
    </div>
  `;
}

function buildOrderHtml(order, heading) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1f2937;">
      <h2 style="color:#f97316;">${heading}</h2>
      <p><strong>Order ID:</strong> ${order.id}</p>
      <p><strong>Customer:</strong> ${order.userName || ''} (${order.userEmail || ''})</p>
      <p><strong>Phone:</strong> ${order.phone || ''}</p>
      <p><strong>Delivery Address:</strong> ${order.deliveryAddress || ''}</p>
      ${order.note ? `<p><strong>Note:</strong> ${order.note}</p>` : ''}
      ${buildItemsTable(order.items)}
      <h3 style="text-align:right;margin-top:16px;">Total: Rs. ${order.total}</h3>
    </div>
  `;
}

/**
 * Sends an order confirmation email to the customer.
 * @param {string} userEmail
 * @param {string} userName
 * @param {object} order - order object including id
 */
async function sendOrderConfirmation(userEmail, userName, order) {
  const html = buildOrderHtml(order, `Hi ${userName}, your order is confirmed!`);

  await transporter.sendMail({
    from: `"Centraa" <${process.env.MAIL_USER}>`,
    to: userEmail,
    subject: `Your Centraa order #${order.id} is confirmed! 🍔`,
    html,
  });
}

/**
 * Sends a new-order alert email to the restaurant admin.
 * @param {object} order - order object including id
 */
async function sendAdminOrderAlert(order) {
  const html = buildOrderHtml(order, 'New order received');

  await transporter.sendMail({
    from: `"Centraa" <${process.env.MAIL_USER}>`,
    to: process.env.ADMIN_EMAIL,
    subject: `New Order Received — #${order.id}`,
    html,
  });
}

/**
 * Sends the 6-digit email verification code after registration.
 * @param {string} userEmail
 * @param {string} userName
 * @param {string} code
 */
async function sendVerificationCode(userEmail, userName, code) {
  const html = buildOtpHtml({
    heading: `Welcome to Centraa, ${userName}! 🍔`,
    intro: 'Use this code to verify your email and activate your account:',
    code,
    footer: 'This code expires in 10 minutes. If you did not create a Centraa account, you can ignore this email.',
  });

  await transporter.sendMail({
    from: `"Centraa" <${process.env.MAIL_USER}>`,
    to: userEmail,
    subject: 'Verify your Centraa account',
    html,
  });
}

/**
 * Sends the 6-digit password reset PIN.
 * @param {string} userEmail
 * @param {string} userName
 * @param {string} code
 */
async function sendPasswordResetCode(userEmail, userName, code) {
  const html = buildOtpHtml({
    heading: `Reset your password, ${userName}`,
    intro: 'Use this PIN to set a new password for your Centraa account:',
    code,
    footer: 'This PIN expires in 10 minutes. If you did not request a password reset, you can safely ignore this email — your password will not change.',
  });

  await transporter.sendMail({
    from: `"Centraa" <${process.env.MAIL_USER}>`,
    to: userEmail,
    subject: 'Your Centraa password reset PIN',
    html,
  });
}

module.exports = {
  sendOrderConfirmation,
  sendAdminOrderAlert,
  sendVerificationCode,
  sendPasswordResetCode,
};