const express = require('express');
const router = express.Router();
const { getDb } = require('../db/init');
const { isTokenValid } = require('../services/token');

// ─── Auth middleware: resolve session token → req.user ──────
function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Not logged in' });
    }

    const token = authHeader.slice(7);
    const db = getDb();

    const user = db.prepare(
      'SELECT id, name, email, session_expires_at FROM users WHERE session_token = ? AND email_verified = 1'
    ).get(token);

    if (!user) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    if (!isTokenValid(user.session_expires_at)) {
      db.prepare('UPDATE users SET session_token = NULL, session_expires_at = NULL WHERE id = ?').run(user.id);
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('[CHARTS AUTH] Error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
}

// ─── POST /api/chart ─────────────────────────────────────────
// Save (upsert) the user's primary birth chart
router.post('/chart', requireAuth, (req, res) => {
  try {
    const { birthYear, birthMonth, birthDay, hourBranch, gender } = req.body;

    const y = parseInt(birthYear, 10);
    const m = parseInt(birthMonth, 10);
    const d = parseInt(birthDay, 10);
    const h = parseInt(hourBranch, 10);

    const currentYear = new Date().getFullYear();
    if (!Number.isInteger(y) || y < 1900 || y > currentYear + 10) {
      return res.status(400).json({ error: 'Invalid birth year.' });
    }
    if (!Number.isInteger(m) || m < 1 || m > 12) {
      return res.status(400).json({ error: 'Invalid birth month.' });
    }
    if (!Number.isInteger(d) || d < 1 || d > 31) {
      return res.status(400).json({ error: 'Invalid birth day.' });
    }
    if (!Number.isInteger(h) || h < -1 || h > 11) {
      return res.status(400).json({ error: 'Invalid birth hour.' });
    }
    if (gender !== 'male' && gender !== 'female') {
      return res.status(400).json({ error: 'Invalid gender.' });
    }

    const db = getDb();
    db.prepare(`
      INSERT INTO charts (user_id, label, birth_year, birth_month, birth_day, hour_branch, gender)
      VALUES (?, 'self', ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, label) DO UPDATE SET
        birth_year = excluded.birth_year,
        birth_month = excluded.birth_month,
        birth_day = excluded.birth_day,
        hour_branch = excluded.hour_branch,
        gender = excluded.gender,
        updated_at = datetime('now')
    `).run(req.user.id, y, m, d, h, gender);

    res.json({ message: 'Chart saved.' });
  } catch (err) {
    console.error('[CHART SAVE] Error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ─── GET /api/chart ──────────────────────────────────────────
// Load the user's primary birth chart
router.get('/chart', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare(
      "SELECT birth_year, birth_month, birth_day, hour_branch, gender, updated_at FROM charts WHERE user_id = ? AND label = 'self'"
    ).get(req.user.id);

    if (!row) {
      return res.json({ chart: null });
    }

    res.json({
      chart: {
        birthYear: row.birth_year,
        birthMonth: row.birth_month,
        birthDay: row.birth_day,
        hourBranch: row.hour_branch,
        gender: row.gender,
        updatedAt: row.updated_at,
      },
    });
  } catch (err) {
    console.error('[CHART LOAD] Error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

module.exports = router;
