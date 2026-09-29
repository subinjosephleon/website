// ============================================================
//  Route: POST /api/paper
//  Handles Paper Submission — upload PDF + save metadata
// ============================================================

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { sendEmail } = require('../utils/mailer');

// Rate limiter — 3 paper submissions per hour per IP
const paperLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: 'Too many submissions from this IP. Please try again in an hour.' }
});

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads/papers');
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, `VISCOM2027_${timestamp}_${sanitized}`);
  }
});

// File filter — only allow PDF
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024 // Default: 10MB
  }
});

// Validation rules for paper submission form
const validatePaper = [
  body('title').trim().notEmpty().withMessage('Paper title is required').isLength({ max: 300 }),
  body('abstract').trim().notEmpty().withMessage('Abstract is required').isLength({ max: 2000 }),
  body('authors').trim().notEmpty().withMessage('Author names are required'),
  body('email').isEmail().normalizeEmail().withMessage('Corresponding author email is required'),
  body('phone').optional().isMobilePhone().withMessage('Invalid phone number'),
  body('track').trim().notEmpty().withMessage('Please select a track'),
  body('keywords').trim().notEmpty().withMessage('Keywords are required')
];

router.post('/', paperLimiter, upload.single('paper'), validatePaper, async (req, res) => {
  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Delete uploaded file if validation fails
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(400).json({ errors: errors.array() });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'PDF file is required.' });
  }

  const { title, abstract, authors, email, phone, track, keywords, institution } = req.body;
  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const submissionId = `VISCOM2027-${Date.now()}`;

  // Save submission record to a JSON log
  const submissionData = {
    submissionId,
    title,
    authors,
    email,
    phone: phone || 'N/A',
    institution: institution || 'N/A',
    track,
    keywords,
    abstract,
    file: req.file.filename,
    submittedAt: new Date().toISOString()
  };

  const logPath = './uploads/papers/submissions.json';
  let submissions = [];
  if (fs.existsSync(logPath)) {
    submissions = JSON.parse(fs.readFileSync(logPath));
  }
  submissions.push(submissionData);
  fs.writeFileSync(logPath, JSON.stringify(submissions, null, 2));

  try {
    // 1. Notify organizer with paper details
    await sendEmail({
      to: process.env.EMAIL_RECIPIENT,
      subject: `[VISCOM 2027 Paper] New Submission: ${title.substring(0, 60)}...`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
          <div style="background: #1a3a6b; color: white; padding: 20px;">
            <h2 style="margin: 0;">📄 New Paper Submission</h2>
            <p style="margin: 5px 0 0; opacity: 0.8;">VISCOM 2027 | Submission ID: ${submissionId}</p>
          </div>
          <div style="padding: 24px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr style="background: #f8f9fa;"><td style="padding: 10px; color: #666; width: 160px;"><strong>Submission ID:</strong></td><td style="padding: 10px; font-family: monospace; color: #c0392b;">${submissionId}</td></tr>
              <tr><td style="padding: 10px; color: #666;"><strong>Paper Title:</strong></td><td style="padding: 10px;">${title}</td></tr>
              <tr style="background: #f8f9fa;"><td style="padding: 10px; color: #666;"><strong>Author(s):</strong></td><td style="padding: 10px;">${authors}</td></tr>
              <tr><td style="padding: 10px; color: #666;"><strong>Institution:</strong></td><td style="padding: 10px;">${institution || 'N/A'}</td></tr>
              <tr style="background: #f8f9fa;"><td style="padding: 10px; color: #666;"><strong>Corresponding Email:</strong></td><td style="padding: 10px;"><a href="mailto:${email}">${email}</a></td></tr>
              <tr><td style="padding: 10px; color: #666;"><strong>Phone:</strong></td><td style="padding: 10px;">${phone || 'N/A'}</td></tr>
              <tr style="background: #f8f9fa;"><td style="padding: 10px; color: #666;"><strong>Track:</strong></td><td style="padding: 10px;"><span style="background: #e8a020; color: white; padding: 2px 10px; border-radius: 12px; font-size: 12px;">${track}</span></td></tr>
              <tr><td style="padding: 10px; color: #666;"><strong>Keywords:</strong></td><td style="padding: 10px;">${keywords}</td></tr>
              <tr style="background: #f8f9fa;"><td style="padding: 10px; color: #666;"><strong>Uploaded File:</strong></td><td style="padding: 10px; font-family: monospace; font-size: 12px;">${req.file.filename}</td></tr>
              <tr><td style="padding: 10px; color: #666;"><strong>Submitted At:</strong></td><td style="padding: 10px;">${timestamp} IST</td></tr>
            </table>
            <hr style="margin: 16px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 14px; margin-bottom: 8px;"><strong>Abstract:</strong></p>
            <div style="background: #f8f9fa; padding: 16px; border-radius: 6px; line-height: 1.6; font-size: 14px;">${abstract}</div>
            <p style="font-size: 12px; color: #999; margin-top: 16px;">📎 The uploaded PDF is saved at: uploads/papers/${req.file.filename}</p>
          </div>
        </div>
      `
    });

    // 2. Confirmation to author
    await sendEmail({
      to: email,
      subject: `VISCOM 2027 — Paper Submission Received [${submissionId}]`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
          <div style="background: #1a3a6b; color: white; padding: 20px;">
            <h2 style="margin: 0;">✅ Submission Received</h2>
            <p style="margin: 5px 0 0; opacity: 0.8;">VISCOM 2027 — Thiagarajar College of Engineering</p>
          </div>
          <div style="padding: 24px;">
            <p>Dear Author(s),</p>
            <p>Your paper has been successfully submitted to <strong>VISCOM 2027</strong>. Please save your Submission ID for future reference.</p>
            <div style="background: #f0f4ff; border: 2px solid #1a3a6b; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
              <p style="margin: 0; color: #666; font-size: 14px;">Submission ID</p>
              <p style="margin: 8px 0 0; font-size: 24px; font-weight: bold; color: #1a3a6b; font-family: monospace;">${submissionId}</p>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 16px;">
              <tr><td style="padding: 8px 0; color: #666; width: 140px;"><strong>Paper Title:</strong></td><td style="padding: 8px 0;">${title}</td></tr>
              <tr><td style="padding: 8px 0; color: #666;"><strong>Track:</strong></td><td style="padding: 8px 0;">${track}</td></tr>
              <tr><td style="padding: 8px 0; color: #666;"><strong>Submitted At:</strong></td><td style="padding: 8px 0;">${timestamp} IST</td></tr>
            </table>
            <div style="background: #fff3cd; border-left: 4px solid #e8a020; padding: 12px 16px; border-radius: 0 6px 6px 0; margin-bottom: 16px;">
              <p style="margin: 0; font-size: 14px;"><strong>📅 Next Steps:</strong><br>
              Acceptance notification will be sent by <strong>May 2027</strong>.<br>
              Keep an eye on your inbox at <strong>${email}</strong>.</p>
            </div>
            <p style="color: #666; font-size: 14px;">For any queries, contact us at <a href="mailto:viscom2027@tce.edu">viscom2027@tce.edu</a></p>
          </div>
          <div style="background: #1a3a6b; color: white; padding: 16px 24px; font-size: 12px;">
            <p style="margin: 0;">VISCOM 2027 | November 25–27, 2027 | TCE, Madurai, Tamil Nadu, India</p>
          </div>
        </div>
      `
    });

    res.status(200).json({
      success: true,
      submissionId,
      message: 'Paper submitted successfully! A confirmation has been sent to your email.'
    });

  } catch (err) {
    console.error('Paper submission email error:', err.message);
    // File is saved even if email fails
    res.status(200).json({
      success: true,
      submissionId,
      message: 'Paper submitted successfully (email notification may be delayed). Your Submission ID is: ' + submissionId
    });
  }
});

// Handle Multer errors (file size, wrong type)
router.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: `File too large. Maximum size is ${process.env.MAX_FILE_SIZE_MB || 10}MB.` });
  }
  if (err.message === 'Only PDF files are allowed.') {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

module.exports = router;
