// ============================================================
//  Route: POST /api/registration
//  Handles Attendee Registration — save info + send confirmation
// ============================================================

const express = require('express');
const router = express.Router();
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { sendEmail } = require('../utils/mailer');

// Rate limiter — 5 registrations per hour per IP
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many registration attempts. Please try again later.' }
});

// Validation rules
const validateRegistration = [
  body('fullName').trim().notEmpty().withMessage('Full name is required').isLength({ max: 150 }),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('institution').trim().notEmpty().withMessage('Institution/Organization is required'),
  body('designation').trim().notEmpty().withMessage('Designation is required'),
  body('category').trim().notEmpty().withMessage('Registration category is required'),
  body('country').trim().notEmpty().withMessage('Country is required')
];

router.post('/', registrationLimiter, validateRegistration, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    fullName, email, phone, institution, designation,
    category, country, dietary, paperSubmissionId
  } = req.body;

  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const registrationId = `REG-VISCOM2027-${Date.now()}`;

  // Define registration fee structure
  const fees = {
    'student-early': { label: 'Student (Early Bird)', fee: '₹3,000' },
    'student-regular': { label: 'Student (Regular)', fee: '₹4,000' },
    'academic-early': { label: 'Academic (Early Bird)', fee: '₹5,000' },
    'academic-regular': { label: 'Academic (Regular)', fee: '₹6,500' },
    'industry-early': { label: 'Industry (Early Bird)', fee: '₹8,000' },
    'industry-regular': { label: 'Industry (Regular)', fee: '₹10,000' },
    'international': { label: 'International', fee: 'USD 200' }
  };
  const categoryInfo = fees[category] || { label: category, fee: 'TBD' };

  // Save registration data to JSON log
  const registrationData = {
    registrationId,
    fullName,
    email,
    phone,
    institution,
    designation,
    category: categoryInfo.label,
    fee: categoryInfo.fee,
    country,
    dietary: dietary || 'None',
    paperSubmissionId: paperSubmissionId || 'N/A',
    registeredAt: new Date().toISOString()
  };

  const logPath = './uploads/registrations/registrations.json';
  let registrations = [];
  if (fs.existsSync(logPath)) {
    registrations = JSON.parse(fs.readFileSync(logPath));
  }
  registrations.push(registrationData);
  fs.writeFileSync(logPath, JSON.stringify(registrations, null, 2));

  try {
    // 1. Notify the organizer
    await sendEmail({
      to: process.env.EMAIL_RECIPIENT,
      subject: `[VISCOM 2027 Registration] ${fullName} — ${categoryInfo.label}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
          <div style="background: #1a3a6b; color: white; padding: 20px;">
            <h2 style="margin: 0;">🎟️ New Registration</h2>
            <p style="margin: 5px 0 0; opacity: 0.8;">VISCOM 2027 | ID: ${registrationId}</p>
          </div>
          <div style="padding: 24px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr style="background: #f8f9fa;"><td style="padding: 10px; color: #666; width: 180px;"><strong>Registration ID:</strong></td><td style="padding: 10px; font-family: monospace; color: #c0392b;">${registrationId}</td></tr>
              <tr><td style="padding: 10px; color: #666;"><strong>Full Name:</strong></td><td style="padding: 10px;">${fullName}</td></tr>
              <tr style="background: #f8f9fa;"><td style="padding: 10px; color: #666;"><strong>Email:</strong></td><td style="padding: 10px;"><a href="mailto:${email}">${email}</a></td></tr>
              <tr><td style="padding: 10px; color: #666;"><strong>Phone:</strong></td><td style="padding: 10px;">${phone}</td></tr>
              <tr style="background: #f8f9fa;"><td style="padding: 10px; color: #666;"><strong>Institution:</strong></td><td style="padding: 10px;">${institution}</td></tr>
              <tr><td style="padding: 10px; color: #666;"><strong>Designation:</strong></td><td style="padding: 10px;">${designation}</td></tr>
              <tr style="background: #f8f9fa;"><td style="padding: 10px; color: #666;"><strong>Category:</strong></td><td style="padding: 10px;"><span style="background: #e8a020; color: white; padding: 2px 10px; border-radius: 12px; font-size: 12px;">${categoryInfo.label}</span></td></tr>
              <tr><td style="padding: 10px; color: #666;"><strong>Fee:</strong></td><td style="padding: 10px; font-weight: bold; color: #1a3a6b;">${categoryInfo.fee}</td></tr>
              <tr style="background: #f8f9fa;"><td style="padding: 10px; color: #666;"><strong>Country:</strong></td><td style="padding: 10px;">${country}</td></tr>
              <tr><td style="padding: 10px; color: #666;"><strong>Dietary Requirements:</strong></td><td style="padding: 10px;">${dietary || 'None'}</td></tr>
              <tr style="background: #f8f9fa;"><td style="padding: 10px; color: #666;"><strong>Paper Submission ID:</strong></td><td style="padding: 10px;">${paperSubmissionId || 'N/A'}</td></tr>
              <tr><td style="padding: 10px; color: #666;"><strong>Registered At:</strong></td><td style="padding: 10px;">${timestamp} IST</td></tr>
            </table>
          </div>
          <div style="background: #f1f3f4; padding: 12px 24px; font-size: 12px; color: #888;">
            Total registrations so far: ${registrations.length}
          </div>
        </div>
      `
    });

    // 2. Send confirmation to registrant
    await sendEmail({
      to: email,
      subject: `VISCOM 2027 — Registration Confirmed [${registrationId}]`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
          <div style="background: #1a3a6b; color: white; padding: 20px;">
            <h2 style="margin: 0;">🎉 Registration Confirmed!</h2>
            <p style="margin: 5px 0 0; opacity: 0.8;">VISCOM 2027 — Thiagarajar College of Engineering</p>
          </div>
          <div style="padding: 24px;">
            <p>Dear <strong>${fullName}</strong>,</p>
            <p>Your registration for <strong>VISCOM 2027</strong> has been received. Please save your Registration ID for all future correspondence.</p>
            
            <div style="background: #f0f4ff; border: 2px solid #1a3a6b; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
              <p style="margin: 0; color: #666; font-size: 14px;">Registration ID</p>
              <p style="margin: 8px 0 0; font-size: 20px; font-weight: bold; color: #1a3a6b; font-family: monospace;">${registrationId}</p>
            </div>

            <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 16px;">
              <tr><td style="padding: 8px 0; color: #666; width: 160px;"><strong>Category:</strong></td><td style="padding: 8px 0;">${categoryInfo.label}</td></tr>
              <tr><td style="padding: 8px 0; color: #666;"><strong>Registration Fee:</strong></td><td style="padding: 8px 0; font-weight: bold; color: #1a3a6b;">${categoryInfo.fee}</td></tr>
              <tr><td style="padding: 8px 0; color: #666;"><strong>Conference Dates:</strong></td><td style="padding: 8px 0;">November 25–27, 2027</td></tr>
              <tr><td style="padding: 8px 0; color: #666;"><strong>Venue:</strong></td><td style="padding: 8px 0;">TCE, Madurai, Tamil Nadu, India</td></tr>
            </table>

            <div style="background: #fff3cd; border-left: 4px solid #e8a020; padding: 12px 16px; border-radius: 0 6px 6px 0; margin-bottom: 16px;">
              <p style="margin: 0; font-size: 14px;"><strong>⚠️ Payment Instructions:</strong><br>
              Payment details will be sent to your email within 24–48 hours.<br>
              Early Bird deadline: <strong>September 2027</strong>. Please complete payment before the deadline to avail the early bird discount.</p>
            </div>

            <p style="color: #666; font-size: 14px;">For queries: <a href="mailto:viscom2027@tce.edu">viscom2027@tce.edu</a></p>
          </div>
          <div style="background: #1a3a6b; color: white; padding: 16px 24px; font-size: 12px;">
            <p style="margin: 0;">VISCOM 2027 | November 25–27, 2027 | TCE, Madurai, Tamil Nadu, India</p>
          </div>
        </div>
      `
    });

    res.status(200).json({
      success: true,
      registrationId,
      fee: categoryInfo.fee,
      message: `Registration successful! Your Registration ID is ${registrationId}. A confirmation has been sent to ${email}.`
    });

  } catch (err) {
    console.error('Registration email error:', err.message);
    res.status(200).json({
      success: true,
      registrationId,
      fee: categoryInfo.fee,
      message: `Registration recorded (email notification may be delayed). Your Registration ID is: ${registrationId}`
    });
  }
});

module.exports = router;
