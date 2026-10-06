'use strict';

// ============================================================
// Classical corpus for Smart Luopan: ingest markdown files from
// server/corpus into SQLite, retrieve passages by rule id / key term.
// Retrieval is substring matching over tags and text (the corpus is a
// few thousand short passages at most; no index needed).
// ponytail: LIKE scan; move to FTS5 trigram if the corpus passes ~50k chunks.
// ============================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getDb } = require('../db/init');

const CORPUS_DIR = path.join(__dirname, '..', 'corpus');

function parseFile(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const lines = raw.split(/\r?\n/);
  let source = path.basename(file, '.md'), era = '';
  const chunks = [];
  let cur = null;
  const flush = () => { if (cur && cur.text.trim()) chunks.push({ ...cur, text: cur.text.trim() }); cur = null; };
  for (const line of lines) {
    const m1 = line.match(/^#\s+source:\s*(.+)$/); if (m1) { source = m1[1].trim(); continue; }
    const m2 = line.match(/^#\s+era:\s*(.+)$/);    if (m2) { era = m2[1].trim(); continue; }
    if (/^#\s+note:/.test(line) || /^#\s+\S/.test(line) && !line.startsWith('##')) continue;
    const h = line.match(/^##\s+(.+)$/);
    if (h) {
      flush();
      const parts = h[1].split('|').map(s => s.trim());
      const section = parts[0];
      const tags = (parts.find(p => p.startsWith('tags:')) || 'tags:').slice(5).trim();
      const type = (parts.find(p => p.startsWith('type:')) || 'type: note').slice(5).trim();
      cur = { source, era, section, tags, type, text: '' };
      continue;
    }
    if (cur) cur.text += line + '\n';
  }
  flush();
  return chunks;
}

function fileSetHash() {
  if (!fs.existsSync(CORPUS_DIR)) return 'none';
  const h = crypto.createHash('sha1');
  for (const f of fs.readdirSync(CORPUS_DIR).filter(f => f.endsWith('.md') && f !== 'README.md').sort()) {
    const st = fs.statSync(path.join(CORPUS_DIR, f));
    h.update(f + st.size + st.mtimeMs);
  }
  return h.digest('hex');
}

/** Rebuild corpus_chunks when the corpus files changed. Returns chunk count. */
function ensureIngested() {
  const db = getDb();
  const hash = fileSetHash();
  const meta = db.prepare("SELECT value FROM corpus_meta WHERE key = 'hash'").get();
  if (meta && meta.value === hash) return db.prepare('SELECT COUNT(*) AS n FROM corpus_chunks').get().n;
  const files = fs.existsSync(CORPUS_DIR) ? fs.readdirSync(CORPUS_DIR).filter(f => f.endsWith('.md') && f !== 'README.md') : [];
  const ins = db.prepare('INSERT INTO corpus_chunks (source, era, section, tags, type, text) VALUES (?, ?, ?, ?, ?, ?)');
  const tx = db.transaction(() => {
    db.exec('DELETE FROM corpus_chunks');
    for (const f of files) for (const c of parseFile(path.join(CORPUS_DIR, f))) ins.run(c.source, c.era, c.section, c.tags, c.type, c.text);
    db.prepare("INSERT INTO corpus_meta (key, value) VALUES ('hash', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(hash);
  });
  tx();
  rowCache = null;
  const n = db.prepare('SELECT COUNT(*) AS n FROM corpus_chunks').get().n;
  console.log(`[CORPUS] ingested ${n} passages from ${files.length} files`);
  return n;
}

/**
 * Retrieve passages for a list of terms (rule ids or Chinese/English key words).
 * Tag hits score 3, text hits 1 per term. Returns top `limit`.
 */
let rowCache = null;
function rows() {
  if (!rowCache) rowCache = getDb().prepare('SELECT id, source, era, section, tags, type, text FROM corpus_chunks').all();
  return rowCache;
}

function search(terms, limit = 8) {
  const clean = [...new Set(terms.map(t => String(t || '').trim()).filter(t => t.length >= 2))];
  if (!clean.length) return [];
  const all = rows();
  const scored = all.map(r => {
    let score = 0;
    const tagSet = r.tags.split(/\s+/);
    for (const t of clean) {
      if (tagSet.includes(t)) score += 3;
      else if (r.tags.includes(t)) score += 2;
      if (r.text.includes(t) || r.section.includes(t)) score += 1;
    }
    if (score && r.type === 'quote') score += 0.5;
    if (score) score += 0.5 * (1 - Math.min(r.text.length, 1000) / 1000); // shorter, more precise passages win ties
    return { ...r, score };
  }).filter(r => r.score > 0).sort((a, b) => b.score - a.score || a.id - b.id);
  return scored.slice(0, limit);
}

/** Terms to retrieve for a structured report: rule ids, chart structure, star pairs. */
function termsForReport(report) {
  const terms = new Set();
  for (const room of report.rooms || []) for (const id of room.why || []) terms.add(id);
  for (const n of report.notes || []) terms.add(n.id);
  if (report.flyingStar) { terms.add(report.flyingStar.structure); terms.add(report.flyingStar.structureZh); }
  for (const p of report.people || []) if (p.bazi) { terms.add('BZ-RANK'); if (p.bazi.method === 'tiaohou') terms.add('調候'); if (p.bazi.method.startsWith('cong')) terms.add('從格'); }
  return [...terms];
}

/** Chinese 2-grams + ASCII words + rule ids from a free-text question. */
function termsForQuestion(q) {
  const terms = new Set();
  for (const m of String(q).match(/[A-Z]{2}-[A-Z0-9-]+/g) || []) terms.add(m);
  for (const m of String(q).match(/[一-鿿]{2,}/g) || []) {
    for (let i = 0; i + 2 <= m.length; i++) terms.add(m.slice(i, i + 2));
    if (m.length <= 4) terms.add(m);
  }
  const en = { 'five yellow': '五黃', 'tai sui': '太歲', 'three killings': '三煞', 'bull': '鬥牛煞', 'facing': 'FS-STRUCTURE', 'sitting': 'FS-STRUCTURE', 'beam': '橫樑', 'mirror': '鏡', 'corridor': '穿堂煞', 'toilet': '廁所', 'stove': '灶', 'kitchen': '灶', 'bed': '床', 'study': '文昌', 'wealth': '財', 'career': '官星', 'useful god': '用神', 'favourable': '用神', 'favorable': '用神', 'element': '用神', 'period': '八白', 'cure': '五黃', 'sha': '煞', 'gua': 'EM-ROOM', 'mansion': 'EM-ROOM', 'door': 'EM-DOOR', 'annual': '流年', 'year': '流年' };
  const lower = String(q).toLowerCase();
  for (const [k, v] of Object.entries(en)) if (lower.includes(k)) terms.add(v);
  return [...terms];
}

module.exports = { ensureIngested, search, termsForReport, termsForQuestion, parseFile, CORPUS_DIR };
