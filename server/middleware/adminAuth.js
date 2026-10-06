'use strict';

// Shared ADMIN_KEY gate for staff-only endpoints (orders dashboard, Smart Luopan).
function requireAdmin(req, res, next) {
  const key = process.env.ADMIN_KEY;
  if (!key) return res.status(503).json({ error: 'Admin is not configured. Set ADMIN_KEY in the environment.' });
  const provided = req.headers['x-admin-key'] || req.query.key;
  if (!provided || provided !== key) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

module.exports = { requireAdmin };
