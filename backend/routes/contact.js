// ============================================================
//  Route: POST /api/contact
//  Handles the Contact Form — sends email to organizer
// ============================================================

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { sendEmail } = require('../utils/mailer');

// Strict rate limiter for contact form — 5 per hour per IP
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many contact form submissions. Please try again in an hour.' }
});

// Validation rules
const validateContact = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('subject').trim().notEmpty().withMessage('Subject is required').isLength({ max: 200 }),
  body('message').trim().notEmpty().withMessage('Message is required').isLength({ max: 2000 })
];

router.post('/', contactLimiter, validateContact, async (req, res) => {
  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, email, subject, message } = req.body;
  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  try {
    // 1. Notify the organizer
    await sendEmail({
      to: process.env.EMAIL_RECIPIENT,
      subject: `[VISCOM 2027 Contact] ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
          <div style="background: #1a3a6b; color: white; padding: 20px;">
            <h2 style="margin: 0;">📬 New Contact Form Submission</h2>
            <p style="margin: 5px 0 0; opacity: 0.8;">VISCOM 2027 — Conference Website</p>
          </div>
          <div style="padding: 24px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #666; width: 120px;"><strong>Name:</strong></td><td style="padding: 8px 0;">${name}</td></tr>
              <tr><td style="padding: 8px 0; color: #666;"><strong>Email:</strong></td><td style="padding: 8px 0;"><a href="mailto:${email}">${email}</a></td></tr>
              <tr><td style="padding: 8px 0; color: #666;"><strong>Subject:</strong></td><td style="padding: 8px 0;">${subject}</td></tr>
              <tr><td style="padding: 8px 0; color: #666;"><strong>Time:</strong></td><td style="padding: 8px 0;">${timestamp} IST</td></tr>
            </table>
            <hr style="margin: 16px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 14px; margin-bottom: 8px;"><strong>Message:</strong></p>
            <div style="background: #f8f9fa; padding: 16px; border-radius: 6px; white-space: pre-wrap; line-height: 1.6;">${message}</div>
          </div>
          <div style="background: #f1f3f4; padding: 12px 24px; font-size: 12px; color: #888;">
            Reply directly to this email to respond to ${name}.
          </div>
        </div>
      `
    });

    // 2. Auto-reply to the sender
    await sendEmail({
      to: email,
      subject: 'VISCOM 2027 — We received your message',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
          <div style="background: #1a3a6b; color: white; padding: 20px;">
            <h2 style="margin: 0;">VISCOM 2027</h2>
            <p style="margin: 5px 0 0; opacity: 0.8;">Thiagarajar College of Engineering, Madurai</p>
          </div>
          <div style="padding: 24px;">
            <p>Dear <strong>${name}</strong>,</p>
            <p>Thank you for contacting us! We have received your message and our team will get back to you within <strong>2–3 working days</strong>.</p>
            <div style="background: #f0f4ff; border-left: 4px solid #1a3a6b; padding: 12px 16px; margin: 16px 0; border-radius: 0 6px 6px 0;">
              <p style="margin: 0; font-size: 14px; color: #555;"><strong>Your Subject:</strong> ${subject}</p>
            </div>
            <p style="color: #666; font-size: 14px;">For urgent queries, please email us directly at <a href="mailto:viscom2027@tce.edu">viscom2027@tce.edu</a></p>
          </div>
          <div style="background: #1a3a6b; color: white; padding: 16px 24px; font-size: 12px;">
            <p style="margin: 0;">VISCOM 2027 | November 25–27, 2027 | TCE, Madurai</p>
          </div>
        </div>
      `
    });

    res.status(200).json({
      success: true,
      message: 'Your message has been sent successfully! We will get back to you soon.'
    });

  } catch (err) {
    console.error('Contact form email error:', err.message);
    res.status(500).json({ error: 'Failed to send message. Please try again or email us directly.' });
  }
});

module.exports = router;
