'use strict';

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { getDb } = require('../db/init');
const { requireAdmin } = require('../middleware/adminAuth');
const { adminLimiter } = require('../middleware/rateLimiter');
const F = require('../engine/fengshui');
const FS = require('../engine/flyingstar');
const narrative = require('../services/luopanNarrative');
const corpus = require('../services/corpus');

// Floor-plan photos ride inside the consult JSON, so this router takes a
// larger body than the global 10kb limit.
router.use('/luopan', express.json({ limit: '6mb' }), adminLimiter, requireAdmin);

function validConsult(b) {
  if (!b || typeof b !== 'object') return 'Body must be an object.';
  if (!b.facing || typeof b.facing.bearing !== 'number' || !isFinite(b.facing.bearing)) return 'facing.bearing (degrees) is required.';
  if (!Array.isArray(b.people) || b.people.length === 0) return 'At least one person is required.';
  for (const p of b.people) {
    if (!p.id || !p.name) return 'Each person needs id and name.';
    if (!Number.isInteger(p.birthYear) || p.birthYear < 1900 || p.birthYear > 2099) return `Birth year for ${p.name} must be 1900–2099.`;
    if (!Number.isInteger(p.birthMonth) || p.birthMonth < 1 || p.birthMonth > 12) return `Birth month for ${p.name} is invalid.`;
    if (!Number.isInteger(p.birthDay) || p.birthDay < 1 || p.birthDay > 31) return `Birth day for ${p.name} is invalid.`;
    if (p.gender !== 'male' && p.gender !== 'female') return `Gender for ${p.name} must be male or female.`;
    if (p.birthHour != null && (!Number.isInteger(p.birthHour) || p.birthHour < 0 || p.birthHour > 23)) return `Birth hour for ${p.name} must be 0–23.`;
  }
  if (!Array.isArray(b.rooms)) return 'rooms must be an array.';
  for (const r of b.rooms) {
    if (!r.id || !r.name) return 'Each room needs id and name.';
    if (r.sector !== 'C' && !F.DIRS.includes(r.sector)) return `Room ${r.name} has an invalid sector.`;
  }
  if (b.year != null && (!Number.isInteger(b.year) || b.year < 1900 || b.year > 2099)) return 'year is invalid.';
  for (const k of ['topYear', 'renoYear']) if (b[k] != null && b[k] !== '' && (!Number.isInteger(b[k]) || b[k] < 1900 || b[k] > 2099)) return `${k} is invalid.`;
  return null;
}

function analyse(b) {
  const built = b.renoYear || b.topYear;
  const period = built ? FS.periodOf(built) : null;
  const report = F.analyseConsult({ year: b.year, period, facing: b.facing, people: b.people, rooms: b.rooms });
  // Classical references retrieved for the rules that fired (shown on the report, fed to the AI writer).
  report.references = corpus.search(corpus.termsForReport(report), 10).map(({ score, ...r }) => r);
  return report;
}

router.post('/luopan/analyse', (req, res) => {
  const err = validConsult(req.body);
  if (err) return res.status(400).json({ error: err });
  try { res.json({ report: analyse(req.body) }); }
  catch (e) { console.error('[LUOPAN] analyse error:', e); res.status(500).json({ error: 'Analysis failed.' }); }
});

router.post('/luopan/consults', (req, res) => {
  const b = req.body;
  const err = validConsult(b);
  if (err) return res.status(400).json({ error: err });
  try {
    const report = analyse(b);
    const reference = 'LP-' + crypto.randomBytes(3).toString('hex').toUpperCase();
    const db = getDb();
    db.prepare(`INSERT INTO luopan_consults (reference, client_name, address, house_type, payload, report)
                VALUES (?, ?, ?, ?, ?, ?)`)
      .run(reference, String(b.clientName || '').slice(0, 120), String(b.address || '').slice(0, 300),
           String(b.houseType || '').slice(0, 40), JSON.stringify(b), JSON.stringify(report));
    res.json({ reference, report });
  } catch (e) { console.error('[LUOPAN] save error:', e); res.status(500).json({ error: 'Could not save consult.' }); }
});

router.get('/luopan/consults', (req, res) => {
  try {
    const rows = getDb().prepare(`SELECT id, reference, client_name, address, house_type, created_at, reviewed_at
                                  FROM luopan_consults ORDER BY id DESC LIMIT 200`).all();
    res.json({ consults: rows });
  } catch (e) { console.error('[LUOPAN] list error:', e); res.status(500).json({ error: 'Could not list consults.' }); }
});

router.get('/luopan/consults/:ref', (req, res) => {
  try {
    const row = getDb().prepare('SELECT * FROM luopan_consults WHERE reference = ?').get(req.params.ref);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json({ ...row, payload: JSON.parse(row.payload), report: JSON.parse(row.report), narrative: row.narrative ? JSON.parse(row.narrative) : null });
  } catch (e) { console.error('[LUOPAN] get error:', e); res.status(500).json({ error: 'Could not load consult.' }); }
});

router.post('/luopan/consults/:ref/narrative', async (req, res) => {
  if (!narrative.isConfigured()) return res.status(503).json({ error: 'AI writer is not configured (ANTHROPIC_API_KEY).' });
  try {
    const db = getDb();
    const row = db.prepare('SELECT * FROM luopan_consults WHERE reference = ?').get(req.params.ref);
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (row.narrative && !req.body?.regenerate) return res.json({ narrative: JSON.parse(row.narrative), model: row.narrative_model, cached: true });
    const payload = JSON.parse(row.payload);
    const report = analyse(payload); // always from the current engine
    const { references, ...audit } = report;
    const out = await narrative.generateNarrative({ clientName: row.client_name, address: row.address, houseType: row.house_type }, audit, references);
    db.prepare(`UPDATE luopan_consults SET narrative = ?, narrative_model = ?, report = ? WHERE reference = ?`)
      .run(JSON.stringify(out.narrative), out.model, JSON.stringify(report), req.params.ref);
    res.json({ narrative: out.narrative, model: out.model, cached: false });
  } catch (e) { console.error('[LUOPAN] narrative error:', e); res.status(500).json({ error: e.message || 'Could not write the narrative.' }); }
});

router.post('/luopan/consults/:ref/ask', async (req, res) => {
  if (!narrative.isConfigured()) return res.status(503).json({ error: 'AI assistant is not configured (ANTHROPIC_API_KEY).' });
  const question = String((req.body && req.body.question) || '').trim().slice(0, 500);
  if (question.length < 3) return res.status(400).json({ error: 'Ask a question.' });
  try {
    const row = getDb().prepare('SELECT * FROM luopan_consults WHERE reference = ?').get(req.params.ref);
    if (!row) return res.status(404).json({ error: 'Not found' });
    const { references, ...audit } = analyse(JSON.parse(row.payload));
    const passages = corpus.search([...corpus.termsForQuestion(question), ...corpus.termsForReport(audit)], 8);
    const out = await narrative.ask(question, audit, passages);
    res.json(out);
  } catch (e) { console.error('[LUOPAN] ask error:', e); res.status(500).json({ error: e.message || 'Could not answer.' }); }
});

router.post('/luopan/consults/:ref/review', (req, res) => {
  try {
    const note = String((req.body && req.body.note) || '').slice(0, 2000);
    const r = getDb().prepare(`UPDATE luopan_consults SET reviewed_at = datetime('now'), review_note = ? WHERE reference = ?`)
      .run(note, req.params.ref);
    if (!r.changes) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) { console.error('[LUOPAN] review error:', e); res.status(500).json({ error: 'Could not save review.' }); }
});

module.exports = { router };
