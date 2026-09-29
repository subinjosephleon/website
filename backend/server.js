// ============================================================
//  VISCOM 2027 — Backend Server
//  Features:
//    1. Serve static frontend files
//    2. Contact Form → sends email notification
//    3. Paper Submission → save PDF + send confirmation email
//    4. Registration Form → save registration + send confirmation email
// ============================================================

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

const contactRoutes = require('./routes/contact');
const paperRoutes = require('./routes/paper-submission');
const registrationRoutes = require('./routes/registration');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Ensure upload directories exist ─────────────────────────
const uploadDirs = ['./uploads/papers', './uploads/registrations'];
uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created directory: ${dir}`);
  }
});

// ─── Middleware ───────────────────────────────────────────────

// CORS — allow your frontend (Live Server / GitHub Pages)
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5500',
    'https://subinjosephleon.github.io',
    'http://127.0.0.1:5500'
  ],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

// Parse JSON & URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve the static frontend (index.html, css/, images/)
app.use(express.static(path.join(__dirname, '..')));

// Global rate limiter — max 100 requests per 15 minutes per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests. Please try again later.' }
});
app.use('/api/', globalLimiter);

// ─── API Routes ───────────────────────────────────────────────
app.use('/api/contact', contactRoutes);
app.use('/api/paper', paperRoutes);
app.use('/api/registration', registrationRoutes);

// ─── Health Check ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    conference: 'VISCOM 2027',
    timestamp: new Date().toISOString()
  });
});

// ─── Catch-all: serve index.html for any unknown GET route ────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ─── Global Error Handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err.message);
  res.status(500).json({ error: 'Internal server error. Please try again.' });
});

// ─── Start Server ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║     VISCOM 2027 — Server Running         ║');
  console.log(`║     http://localhost:${PORT}                ║`);
  console.log('╠══════════════════════════════════════════╣');
  console.log('║  Endpoints:                              ║');
  console.log('║   GET  /                → Frontend       ║');
  console.log('║   POST /api/contact     → Contact Form   ║');
  console.log('║   POST /api/paper       → Paper Submit   ║');
  console.log('║   POST /api/registration→ Registration   ║');
  console.log('║   GET  /api/health      → Health Check   ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
});
