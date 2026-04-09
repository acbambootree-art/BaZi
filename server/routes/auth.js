const express = require('express');
const router = express.Router();
const { getDb } = require('../db/init');
const { generateToken, generateSessionToken, isTokenValid } = require('../services/token');
const { sendVerificationEmail } = require('../services/email');
const { registerRules, resendRules, loginRules, validate } = require('../middleware/validator');
const { registerLimiter, resendLimiter, verifyLimiter, loginLimiter } = require('../middleware/rateLimiter');

// ─── POST /api/register ─────────────────────────────────────
router.post('/register', registerLimiter, registerRules, validate, async (req, res) => {
  try {
    const { name, email, phone, dateOfBirth } = req.body;
    const db = getDb();

    // Check if user already exists
    const existing = db.prepare('SELECT id, email_verified FROM users WHERE email = ?').get(email);

    if (existing && existing.email_verified) {
      return res.status(409).json({ error: 'This email is already registered and verified.' });
    }

    const { token, expiresAt } = generateToken();

    if (existing && !existing.email_verified) {
      // Update existing unverified user with fresh token
      db.prepare(`
        UPDATE users SET name = ?, phone = ?, date_of_birth = ?,
          verification_token = ?, token_expires_at = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(name, phone, dateOfBirth, token, expiresAt, existing.id);
    } else {
      // Insert new user
      db.prepare(`
        INSERT INTO users (name, email, phone, date_of_birth, verification_token, token_expires_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(name, email, phone, dateOfBirth, token, expiresAt);
    }

    // Send verification email
    const emailResult = await sendVerificationEmail({ to: email, name, token });

    if (!emailResult.success) {
      console.error('[REGISTER] Email send failed but user saved:', emailResult.error);
    }

    res.status(201).json({
      message: 'Registration successful! Please check your email to verify your account.',
    });
  } catch (err) {
    console.error('[REGISTER] Error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again later.' });
  }
});

// ─── GET /api/verify ─────────────────────────────────────────
router.get('/verify', verifyLimiter, (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).send(verificationPage('error', 'No verification token provided.'));
    }

    const db = getDb();
    const user = db.prepare('SELECT id, name, token_expires_at, email_verified FROM users WHERE verification_token = ?').get(token);

    if (!user) {
      return res.status(400).send(verificationPage('error', 'Invalid verification link. It may have already been used.'));
    }

    if (user.email_verified) {
      return res.send(verificationPage('already', 'Your email is already verified!'));
    }

    if (!isTokenValid(user.token_expires_at)) {
      return res.status(400).send(verificationPage('expired', 'This verification link has expired. Please register again to receive a new link.'));
    }

    // Verify the user
    db.prepare(`
      UPDATE users SET email_verified = 1, verification_token = NULL,
        token_expires_at = NULL, updated_at = datetime('now')
      WHERE id = ?
    `).run(user.id);

    res.send(verificationPage('success', `Welcome, ${user.name}! Your email has been verified successfully.`));
  } catch (err) {
    console.error('[VERIFY] Error:', err);
    res.status(500).send(verificationPage('error', 'Something went wrong. Please try again later.'));
  }
});

// ─── POST /api/resend-verification ───────────────────────────
router.post('/resend-verification', resendLimiter, resendRules, validate, async (req, res) => {
  try {
    const { email } = req.body;
    const db = getDb();

    const user = db.prepare('SELECT id, name, email_verified FROM users WHERE email = ?').get(email);

    // Always return 200 to prevent email enumeration
    if (!user || user.email_verified) {
      return res.json({ message: 'If that email is registered, a new verification link has been sent.' });
    }

    const { token, expiresAt } = generateToken();

    db.prepare(`
      UPDATE users SET verification_token = ?, token_expires_at = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(token, expiresAt, user.id);

    await sendVerificationEmail({ to: email, name: user.name, token });

    res.json({ message: 'If that email is registered, a new verification link has been sent.' });
  } catch (err) {
    console.error('[RESEND] Error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again later.' });
  }
});

// ─── POST /api/login ─────────────────────────────────────────
router.post('/login', loginLimiter, loginRules, validate, (req, res) => {
  try {
    const { email } = req.body;
    const db = getDb();

    const user = db.prepare('SELECT id, name, email, email_verified FROM users WHERE email = ?').get(email);

    if (!user) {
      return res.status(401).json({ error: 'No account found with this email. Please register first.' });
    }

    if (!user.email_verified) {
      return res.status(403).json({
        error: 'Your email has not been verified yet. Please check your inbox for the verification link.',
        unverified: true,
      });
    }

    // Generate session token (30-day validity)
    const { token, expiresAt } = generateSessionToken();

    db.prepare(`
      UPDATE users SET session_token = ?, session_expires_at = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(token, expiresAt, user.id);

    res.json({
      message: 'Login successful!',
      sessionToken: token,
      user: { name: user.name, email: user.email },
    });
  } catch (err) {
    console.error('[LOGIN] Error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again later.' });
  }
});

// ─── GET /api/me ─────────────────────────────────────────────
// Check session validity and return user profile
router.get('/me', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Not logged in' });
    }

    const token = authHeader.slice(7);
    const db = getDb();

    const user = db.prepare(
      'SELECT id, name, email, date_of_birth, session_expires_at FROM users WHERE session_token = ? AND email_verified = 1'
    ).get(token);

    if (!user) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    if (!isTokenValid(user.session_expires_at)) {
      // Clean up expired session
      db.prepare('UPDATE users SET session_token = NULL, session_expires_at = NULL WHERE id = ?').run(user.id);
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }

    res.json({
      user: { name: user.name, email: user.email, dateOfBirth: user.date_of_birth },
    });
  } catch (err) {
    console.error('[ME] Error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ─── POST /api/logout ────────────────────────────────────────
router.post('/logout', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const db = getDb();
      db.prepare('UPDATE users SET session_token = NULL, session_expires_at = NULL WHERE session_token = ?').run(token);
    }
    res.json({ message: 'Logged out successfully.' });
  } catch (err) {
    console.error('[LOGOUT] Error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ─── Helper: styled verification result page ────────────────
function verificationPage(status, message) {
  const colors = {
    success: '#c9a44a',
    already: '#c9a44a',
    error: '#e74c3c',
    expired: '#e67e22',
  };
  const icons = {
    success: '&#10003;',
    already: '&#10003;',
    error: '&#10007;',
    expired: '&#9201;',
  };
  const color = colors[status] || '#c9a44a';
  const icon = icons[status] || '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Verification - BaZi Calculator</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: #0a0a0f; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #e8e6f0; padding: 20px;
    }
    .card {
      max-width: 480px; width: 100%; padding: 48px 40px; text-align: center;
      background: rgba(18,18,28,0.92); border: 1px solid rgba(201,164,74,0.2);
      border-radius: 16px; backdrop-filter: blur(16px);
    }
    .icon { font-size: 48px; color: ${color}; margin-bottom: 20px; }
    h1 { font-size: 20px; color: ${color}; margin-bottom: 12px; letter-spacing: 0.04em; }
    p { font-size: 14px; color: #b0aec0; line-height: 1.7; margin-bottom: 28px; }
    .btn {
      display: inline-block; padding: 12px 36px; border-radius: 8px;
      text-decoration: none; font-size: 14px; font-weight: 600;
      background: linear-gradient(135deg, #c9a44a, #a07d30);
      color: #0a0a0f; letter-spacing: 0.06em; text-transform: uppercase;
    }
    .btn:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${status === 'success' ? 'Email Verified!' : status === 'already' ? 'Already Verified' : status === 'expired' ? 'Link Expired' : 'Verification Failed'}</h1>
    <p>${message}</p>
    <a href="/" class="btn">Go to BaZi Calculator</a>
  </div>
</body>
</html>`;
}

module.exports = router;
