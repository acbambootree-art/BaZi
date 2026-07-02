'use strict';

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/init');
const facts = require('../services/facts');
const llm = require('../services/llm');
const { forecastLimiter } = require('../middleware/rateLimiter');

// Hard ceiling on generations per calendar day — bounds token spend even if
// something floods the endpoint with unique keys. Cached hits are unlimited.
const DAILY_GENERATION_CAP = parseInt(process.env.FORECAST_DAILY_CAP || '400', 10);

// Dedupe concurrent generations of the same key within this process.
const inFlight = new Map();

function sgToday() {
  // Server date in Asia/Singapore (the site's home timezone).
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

function validBody(b) {
  if (!b || typeof b !== 'object') return null;
  const year = parseInt(b.birthYear, 10);
  const month = parseInt(b.birthMonth, 10);
  const day = parseInt(b.birthDay, 10);
  const hourBranch = b.hourBranch == null || b.hourBranch === '' ? -1 : parseInt(b.hourBranch, 10);
  const gender = b.gender === 'male' || b.gender === 'female' ? b.gender : undefined;
  if (!Number.isInteger(year) || year < 1900 || year > 2100) return null;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(day) || day < 1 || day > 31) return null;
  if (!Number.isInteger(hourBranch) || hourBranch < -1 || hourBranch > 11) return null;

  // The client sends its local calendar date so its card and ours agree.
  // Accept only today ±1 day; otherwise use the server's date.
  let date = typeof b.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : null;
  const today = sgToday();
  if (date) {
    const diff = Math.abs(new Date(date + 'T00:00Z') - new Date(today + 'T00:00Z'));
    if (diff > 36 * 3600 * 1000) date = null;
  }
  return { birthYear: year, birthMonth: month, birthDay: day, hourBranch, gender, date: date || today };
}

router.post('/forecast/today', forecastLimiter, async (req, res) => {
  const input = validBody(req.body);
  if (!input) return res.status(400).json({ error: 'Invalid birth data.' });

  let f;
  try {
    f = facts.computeDailyFacts(input, input.date);
  } catch (err) {
    console.error('[FORECAST] facts error:', err.message);
    return res.status(400).json({ error: 'Could not compute chart for that birth data.' });
  }

  const base = { date: f.date, rating: f.rating, key: f.key };

  try {
    const db = getDb();
    const cached = db.prepare('SELECT payload FROM daily_forecasts WHERE cache_key = ?').get(f.key);
    if (cached) {
      return res.json({ source: 'ai', ...base, ...JSON.parse(cached.payload) });
    }

    if (!llm.isConfigured()) {
      return res.json({ source: 'template', ...base });
    }

    const generatedToday = db.prepare('SELECT COUNT(*) AS n FROM daily_forecasts WHERE date = ?').get(f.date).n;
    if (generatedToday >= DAILY_GENERATION_CAP) {
      console.warn(`[FORECAST] daily generation cap reached (${DAILY_GENERATION_CAP})`);
      return res.json({ source: 'template', ...base });
    }

    let promise = inFlight.get(f.key);
    if (!promise) {
      promise = llm.generateDailyForecast(f).finally(() => inFlight.delete(f.key));
      inFlight.set(f.key, promise);
    }
    const generated = await promise;
    if (!generated) return res.json({ source: 'template', ...base });

    const payload = { headline: generated.headline, lean: generated.lean, care: generated.care };
    db.prepare(`
      INSERT INTO daily_forecasts (cache_key, date, payload, model)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(cache_key) DO NOTHING
    `).run(f.key, f.date, JSON.stringify(payload), generated.model);

    // Opportunistic cleanup of stale cache rows.
    db.prepare("DELETE FROM daily_forecasts WHERE date < date('now', '-7 day')").run();

    return res.json({ source: 'ai', ...base, ...payload });
  } catch (err) {
    console.error('[FORECAST] generation error:', err.message);
    return res.json({ source: 'template', ...base });
  }
});

module.exports = { router };
