// ============================================================
//  Nodemailer email transporter — shared across all routes
// ============================================================

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS   // Gmail App Password
  }
});

/**
 * Send an email.
 * @param {Object} options - { to, subject, html }
 */
async function sendEmail({ to, subject, html }) {
  const mailOptions = {
    from: `"VISCOM 2027" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html
  };
  return transporter.sendMail(mailOptions);
}

module.exports = { sendEmail };
