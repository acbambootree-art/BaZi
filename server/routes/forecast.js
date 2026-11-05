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

// ─── A temple fortune lot, read with the visitor's chart ─────
// The temple (/temple) posts the lot it drew plus birth data; the lot's sexagenary pillar is set
// against the chart (facts.computeLotFacts) and written up by Haiku, cached per fact key + language,
// sharing the forecast's daily generation cap. Without an API key it falls back to template text.
const path = require('path');
const fs = require('fs');
const readLots = (f) => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'temple', f), 'utf8')); } catch { return null; } };
const LOTS = readLots('lots.json'), LOTS_EN = readLots('lots_en.json');

const EL = { wood: ['Wood', '木'], fire: ['Fire', '火'], earth: ['Earth', '土'], metal: ['Metal', '金'], water: ['Water', '水'] };
function lotTemplate(f, lang) {
  const zh = lang === 'zh', el = (e) => EL[e][zh ? 1 : 0];
  const help = (v) => (zh ? ['偏耗', '平和', '有助'] : ['strains', 'sits neutrally with', 'helps'])[v + 1];
  const r = f.relations;
  if (zh) {
    const rel = r.dayClash ? `籤支${r.dayClash.lot}沖你的日支${r.dayClash.natal}，事情會有變動，宜保持彈性。`
      : r.dayCombo ? `籤支${r.dayCombo.lot}與你的日支${r.dayCombo.natal}六合，人和事順，適合合作。`
      : r.yearClash ? `籤支${r.yearClash.lot}沖你的年支${r.yearClash.natal}，外在環境多變，穩住腳步。`
      : r.yearCombo ? `籤支${r.yearCombo.lot}與你的年支${r.yearCombo.natal}相合，貴人與環境相助。` : '';
    return {
      headline: { 'in tune': '這支籤與你的八字相應', mixed: '這支籤有助力也有功課', testing: '這支籤提醒你放慢腳步' }[f.resonance],
      reading: `第${f.lot.n}籤屬${f.lot.gz}。籤干${f.lot.stem.zh}${el(f.lot.stem.element)}對你的日主${f.dayMaster.zh}${el(f.dayMaster.element)}是「${f.tenGod.zh}」，${f.lot.stem.zh}${el(f.lot.stem.element)}對你的命盤${help(f.elements.stem)}，${f.lot.branch.zh}${el(f.lot.branch.element)}則${help(f.elements.branch)}。${rel}`,
      advice: { 'in tune': '順著籤意往前走，把握眼前的機會。', mixed: '取籤中好的一面，其餘慢慢來，不必急。', testing: '先穩住、多準備，時機成熟再行動。' }[f.resonance],
    };
  }
  const rel = r.dayClash ? ` The lot's branch ${r.dayClash.lot} clashes your day branch ${r.dayClash.natal}, so expect movement and keep plans flexible.`
    : r.dayCombo ? ` The lot's branch ${r.dayCombo.lot} combines with your day branch ${r.dayCombo.natal}: people and agreements flow well.`
    : r.yearClash ? ` The lot's branch ${r.yearClash.lot} clashes your year branch ${r.yearClash.natal}; outside conditions may shift, so steady your footing.`
    : r.yearCombo ? ` The lot's branch ${r.yearCombo.lot} combines with your year branch ${r.yearCombo.natal}: help from your circle is near.` : '';
  return {
    headline: { 'in tune': 'This lot sits well with your chart', mixed: 'A lot with gifts and lessons for you', testing: 'A lot that asks you to go gently' }[f.resonance],
    reading: `Lot ${f.lot.n} carries the ${f.lot.gz} pillar. Its stem ${f.lot.stem.zh} (${el(f.lot.stem.element)}) is your ${f.tenGod.en} (${f.tenGod.zh}) to a ${f.dayMaster.zh} ${el(f.dayMaster.element)} Day Master; its ${el(f.lot.stem.element)} ${help(f.elements.stem)} your chart, and its branch ${f.lot.branch.zh} (${el(f.lot.branch.element)}) ${help(f.elements.branch)} it.${rel}`,
    advice: { 'in tune': 'Move with the poem and take the opening in front of you.', mixed: 'Take the good in the poem now and let the rest come in its own time.', testing: 'Steady yourself and prepare; act when the timing turns.' }[f.resonance],
  };
}

router.post('/lot-reading', forecastLimiter, async (req, res) => {
  const input = validBody(req.body);
  const n = parseInt(req.body?.lot, 10), lang = req.body?.lang === 'zh' ? 'zh' : 'en';
  const lot = LOTS && Number.isInteger(n) && n >= 1 && n <= LOTS.length ? LOTS[n - 1] : null;
  if (!input || !lot) return res.status(400).json({ error: 'Invalid birth data or lot.' });

  let f;
  try { f = facts.computeLotFacts(input, lot); f.tenGod = { ...f.tenGod, zh: f.tenGod.zh.replace(/财/g, '財').replace(/伤/g, '傷').replace(/杀/g, '殺') };   // the temple writes traditional characters
  } catch (err) {
    console.error('[LOT] facts error:', err.message);
    return res.status(400).json({ error: 'Could not compute chart for that birth data.' });
  }
  const base = {
    lot: f.lot, resonance: f.resonance, tenGod: f.tenGod, elements: f.elements, relations: f.relations,
    dayMaster: { zh: f.dayMaster.zh, element: f.dayMaster.element, strength: f.dayMaster.strength },
  };
  const template = () => res.json({ source: 'template', ...base, ...lotTemplate(f, lang) });
  const key = `${f.key}|${lang}`;
  try {
    const db = getDb();
    const cached = db.prepare('SELECT payload FROM daily_forecasts WHERE cache_key = ?').get(key);
    if (cached) return res.json({ source: 'ai', ...base, ...JSON.parse(cached.payload) });
    if (!llm.isConfigured()) return template();
    const today = sgToday();
    if (db.prepare('SELECT COUNT(*) AS n FROM daily_forecasts WHERE date = ?').get(today).n >= DAILY_GENERATION_CAP) return template();
    let promise = inFlight.get(key);
    if (!promise) {
      const en = LOTS_EN?.[n - 1];
      promise = llm.generateLotReading(f, { ...lot, poemEn: en?.poem }, lang).finally(() => inFlight.delete(key));
      inFlight.set(key, promise);
    }
    const g = await promise;
    if (!g) return template();
    const payload = { headline: g.headline, reading: g.reading, advice: g.advice };
    db.prepare('INSERT INTO daily_forecasts (cache_key, date, payload, model) VALUES (?, ?, ?, ?) ON CONFLICT(cache_key) DO NOTHING')
      .run(key, today, JSON.stringify(payload), g.model);
    return res.json({ source: 'ai', ...base, ...payload });
  } catch (err) {
    console.error('[LOT] generation error:', err.message);
    return template();
  }
});

module.exports = { router };
