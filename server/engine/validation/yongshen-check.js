'use strict';

// Runs the 用神 analyser over engine/validation/yongshen.json (classical
// worked examples with the element each commentary says the chart likes
// or dislikes) and reports agreement. Usage: node engine/validation/yongshen-check.js [-v]
//
// Agreement rules (per chart):
//   like-hit:    at least one of the commentary's liked elements is in the engine's favourable set
//   dislike-hit: none of the commentary's disliked elements is in the engine's favourable set
//   agree:       both hold (or whichever side the row provides)

const path = require('path');
const Y = require('../yongshen');

function check(rows) {
  const results = rows.map(r => {
    const a = Y.analyse(Y.pillarsFromGanZhi(r.pillars));
    const fav = new Set(a.favourable);
    const likeHit = r.like && r.like.length ? r.like.some(e => fav.has(e)) : null;
    const dislikeHit = r.dislike && r.dislike.length ? !r.dislike.some(e => fav.has(e)) : null;
    const agree = (likeHit ?? true) && (dislikeHit ?? true);
    const strengthHit = r.strengthText ? ((r.strengthText === 'strong') === (a.strength.ratio > 0)) : null;
    return { id: r.id, pillars: r.pillars.join(' '), source: r.source, like: r.like, dislike: r.dislike, method: r.method, strengthText: r.strengthText, strengthHit, engine: { yong: a.yongShen, xi: a.xiShen, ji: a.jiShen, label: a.strength.label, ratio: a.strength.ratio, method: a.method, confidence: a.confidence }, likeHit, dislikeHit, agree };
  });
  const n = results.length, agreed = results.filter(r => r.agree).length;
  const likeRows = results.filter(r => r.likeHit !== null), dislikeRows = results.filter(r => r.dislikeHit !== null);
  return {
    n, agreed, rate: n ? agreed / n : 0,
    likeRate: likeRows.length ? likeRows.filter(r => r.likeHit).length / likeRows.length : null,
    dislikeRate: dislikeRows.length ? dislikeRows.filter(r => r.dislikeHit).length / dislikeRows.length : null,
    strengthRate: (() => { const h = results.filter(r => r.strengthHit !== null); return h.length ? h.filter(r => r.strengthHit).length / h.length : null; })(),
    strengthMethodRate: (() => { const h = results.filter(r => r.method === 'strength'); return h.length ? h.filter(r => r.agree).length / h.length : null; })(),
    highConfRate: (() => { const h = results.filter(r => r.engine.confidence === 'high'); return h.length ? h.filter(r => r.agree).length / h.length : null; })(),
    results,
  };
}

const SETS = { 'yongshen.json': '神峰通考 (hand-labelled)', 'yongshen-dtscw.json': '滴天髓闡微 (machine-labelled)' };

if (require.main === module) {
  const pct = x => x == null ? '—' : (x * 100).toFixed(0) + '%';
  const verbose = process.argv.includes('-v');
  for (const [file, name] of Object.entries(SETS)) {
    const out = check(require(path.join(__dirname, file)));
    const byConf = {};
    for (const r of out.results) { const k = r.engine.confidence; byConf[k] = byConf[k] || { n: 0, ok: 0 }; byConf[k].n++; if (r.agree) byConf[k].ok++; }
    console.log(`${name}: ${out.agreed}/${out.n} agree (${pct(out.rate)}); like ${pct(out.likeRate)}, dislike ${pct(out.dislikeRate)}; strength sign ${pct(out.strengthRate)}; by confidence ${Object.entries(byConf).map(([k, v]) => `${k} ${v.ok}/${v.n}`).join(', ')}`);
    if (verbose) for (const r of out.results) if (!r.agree || r.strengthHit === false) console.log(`${r.agree ? '✔' : '✖'}${r.strengthHit === false ? ' S!' : ''} ${r.id} [${r.method}${r.strengthText ? ' text:' + r.strengthText : ''}] ${r.pillars} | text likes ${JSON.stringify(r.like || [])} dislikes ${JSON.stringify(r.dislike || [])} | engine 用${r.engine.yong} 喜${r.engine.xi} 忌${JSON.stringify(r.engine.ji)} (${r.engine.label} ${r.engine.ratio}, ${r.engine.method}, ${r.engine.confidence})`);
  }
}

module.exports = { check, SETS };
