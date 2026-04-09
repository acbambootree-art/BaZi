const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { getDb } = require('./db/init');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Initialize database ────────────────────────────────────
getDb();

// ─── Middleware ──────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // Allow inline scripts in index.html
  crossOriginEmbedderPolicy: false, // Allow video loading
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST'],
}));

app.use(express.json({ limit: '10kb' }));

// ─── API Routes ─────────────────────────────────────────────
app.use('/api', authRoutes);

// ─── Serve static frontend files ────────────────────────────
// Serve from parent directory where index.html, hero.mp4, Background2.mp4 live
const staticDir = path.join(__dirname, '..');
app.use(express.static(staticDir, {
  extensions: ['html'],
  index: 'index.html',
}));

// Fallback to index.html for SPA-style routing
app.get('*', (req, res) => {
  res.sendFile(path.join(staticDir, 'index.html'));
});

// ─── Start server ───────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  ✦ BaZi Server running at http://localhost:${PORT}`);
  console.log(`  ✦ API endpoints: /api/register, /api/verify, /api/resend-verification\n`);
});
