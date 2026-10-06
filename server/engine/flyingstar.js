'use strict';

// ============================================================
// 玄空飛星 Xuan Kong Flying Star — natal chart + palace assessment.
// Shen school (沈氏玄空) conventions; no 替卦 replacement stars (v1).
// ============================================================

const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
// Lo Shu forward flight from the centre.
const FLIGHT = ['NW', 'W', 'NE', 'S', 'N', 'SW', 'E', 'SE'];
// Star number -> its home direction (5 has none).
const STAR_DIR = { 1: 'N', 2: 'SW', 3: 'E', 4: 'SE', 6: 'NW', 7: 'W', 8: 'NE', 9: 'S' };
// Polarity of the three mountains in each direction, sub-position 1..3.
// Cardinal: yang, yin, yin.  Corner: yin, yang, yang.
const CARDINAL = new Set(['N', 'E', 'S', 'W']);
function yangAt(dir, sub) { return CARDINAL.has(dir) ? sub === 1 : sub !== 1; }

function periodOf(year) {
  if (year >= 2044) return 1;
  if (year >= 2024) return 9;
  if (year >= 2004) return 8;
  if (year >= 1984) return 7;
  if (year >= 1964) return 6;
  if (year >= 1944) return 5;
  if (year >= 1924) return 4;
  if (year >= 1904) return 3;
  return 2;
}

const s9 = n => ((n - 1) % 9 + 9) % 9 + 1;

function fly(centre, forward) {
  const out = { C: centre };
  FLIGHT.forEach((d, i) => { out[d] = s9(centre + (forward ? i + 1 : -(i + 1))); });
  return out;
}

/**
 * @param {number} period 1..9
 * @param {number} mountainIndex 0..23, 0 = 子 (same indexing as fengshui.js)
 */
function chart(period, mountainIndex) {
  const facingDir = DIRS[Math.floor(((mountainIndex * 15 + 22.5) % 360) / 45)];
  const sub = (mountainIndex + 1) % 3 + 1;
  const sittingDir = DIRS[(DIRS.indexOf(facingDir) + 4) % 8];
  const periodStars = fly(period, true);

  const plate = (originDir, originMountainDir) => {
    const star = periodStars[originDir];
    // Polarity from the star's home direction at this facing's sub-position;
    // star 5 borrows the polarity of the mountain it came from.
    const dir = star === 5 ? originMountainDir : STAR_DIR[star];
    return fly(star, yangAt(dir, sub));
  };
  const water = plate(facingDir, facingDir);
  const mountain = plate(sittingDir, sittingDir);

  const palaces = {};
  for (const d of [...DIRS, 'C']) palaces[d] = { mountain: mountain[d], water: water[d], period: periodStars[d] };

  const wF = water[facingDir] === period, wS = water[sittingDir] === period;
  const mF = mountain[facingDir] === period, mS = mountain[sittingDir] === period;
  let structure, structureZh;
  if (mS && wF) { structure = 'prosperous-mountain-prosperous-water'; structureZh = '旺山旺向'; }
  else if (mF && wF) { structure = 'double-facing'; structureZh = '雙星到向'; }
  else if (mS && wS) { structure = 'double-sitting'; structureZh = '雙星到坐'; }
  else if (mF && wS) { structure = 'reversed'; structureZh = '上山下水'; }
  else { structure = 'other'; structureZh = '其他'; }

  return { period, facingDir, sittingDir, sub, palaces, structure, structureZh };
}

// --- Assessment -----------------------------------------------------------
// Timeliness in the current period: current and next are prosperous.
function timeliness(star, period) {
  if (star === period) return 'current';
  if (star === s9(period + 1) || star === s9(period + 2)) return 'future';
  if (star === s9(period - 1)) return 'fading';
  return 'retired';
}
const STAR_INFO = {
  1: { zh: '一白', element: 'water', good: true,  theme: 'career, wisdom, romance' },
  2: { zh: '二黑', element: 'earth', good: false, theme: 'illness' },
  3: { zh: '三碧', element: 'wood',  good: false, theme: 'quarrels, lawsuits' },
  4: { zh: '四綠', element: 'wood',  good: true,  theme: 'study, romance, creativity' },
  5: { zh: '五黃', element: 'earth', good: false, theme: 'misfortune, severe illness' },
  6: { zh: '六白', element: 'metal', good: true,  theme: 'authority, status' },
  7: { zh: '七赤', element: 'metal', good: false, theme: 'robbery, injury, gossip' },
  8: { zh: '八白', element: 'earth', good: true,  theme: 'wealth, property' },
  9: { zh: '九紫', element: 'fire',  good: true,  theme: 'celebration, future prosperity' },
};
// Named combinations (either order). cure = element to add.
const COMBOS = {
  '2-5': { id: 'FS-25', severity: 'hard',   text: 'Illness and misfortune stars together: do not sleep here or cook here; use as storage. Keep quiet and still.', cure: 'metal', avoid: ['bedroom', 'kitchen', 'study'] },
  '2-3': { id: 'FS-23', severity: 'medium', text: '鬥牛煞 Bull-fight: quarrels, lawsuits, stomach trouble. Not for a study, office or meetings; keep calm colours.', cure: 'metal', avoid: ['study', 'living'] },
  '6-7': { id: 'FS-67', severity: 'medium', text: 'Two metal stars clash: theft, cuts, surgery. No sharp or metal décor; soften with water.', cure: 'water', avoid: [] },
  '7-9': { id: 'FS-79', severity: 'medium', text: 'Fire feeds metal-robbery: fire hazard, mouth and throat issues. No stove, candles or red here.', cure: 'water', avoid: ['kitchen'] },
  '5-9': { id: 'FS-59', severity: 'hard',   text: 'Fire feeds the misfortune star: remove red, lamps and candles; add metal.', cure: 'metal', avoid: ['bedroom', 'kitchen'] },
  '2-9': { id: 'FS-29', severity: 'low',    text: 'Fire feeds the illness star: avoid red décor; keep well ventilated.', cure: 'metal', avoid: ['bedroom'] },
  '3-7': { id: 'FS-37', severity: 'medium', text: 'Wood and metal clash: disputes and injury. Keep this room calm; no sharp objects.', cure: 'water', avoid: ['study'] },
  '1-4': { id: 'FS-14', severity: 'boost',  text: '一四同宮: study, exams, creativity and romance. Ideal for a study or a child\'s room.', cure: null, prefer: ['study', 'bedroom'] },
  '1-6': { id: 'FS-16', severity: 'boost',  text: 'Water and authority: career and recognition. Good for an office or main door.', cure: null, prefer: ['study', 'main door', 'living'] },
  '6-8': { id: 'FS-68', severity: 'boost',  text: 'Metal and earth prosperity: wealth through position. Good for living room or office.', cure: null, prefer: ['living', 'study'] },
  '8-9': { id: 'FS-89', severity: 'boost',  text: 'Current and future wealth together: the strongest sector of the house. Keep it open, bright and used.', cure: null, prefer: ['living', 'main door', 'study'] },
  '9-9': { id: 'FS-99', severity: 'boost',  text: 'Double 9 in Period 9: peak prosperity. Keep active and bright; good for the main door or living room.', cure: null, prefer: ['living', 'main door'] },
  '8-8': { id: 'FS-88', severity: 'low',    text: 'Double 8: wealth star now fading in Period 9 but still supportive. Keep used and tidy.', cure: null, prefer: ['living'] },
  '1-1': { id: 'FS-11', severity: 'boost',  text: 'Double 1: future prosperity, career and clarity. Good for a study or main door.', cure: null, prefer: ['study', 'main door'] },
};
const key = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);

/**
 * Assess one palace for the current period (and optional annual star).
 * Returns verdict, warnings/cures with rule ids, and the best room use.
 */
function assessPalace(p, period, annualStar, roomUse) {
  const warnings = [], cures = [], why = [];
  const m = STAR_INFO[p.mountain], w = STAR_INFO[p.water];
  const tm = timeliness(p.mountain, period), tw = timeliness(p.water, period);
  const mGood = tm === 'current' || tm === 'future' || (m.good && tm !== 'retired');
  const wGood = tw === 'current' || tw === 'future' || (w.good && tw !== 'retired');

  const combo = COMBOS[key(p.mountain, p.water)];
  if (combo) {
    why.push(combo.id);
    if (combo.severity === 'boost') {
      warnings.push({ id: combo.id, severity: 'boost', text: combo.text });
      if (roomUse && combo.prefer && !combo.prefer.includes(roomUse) && !['toilet', 'store'].includes(roomUse)) {
        warnings.push({ id: combo.id + '-USE', severity: 'low', text: `This sector is best used as ${combo.prefer.join(' or ')}; it is currently a ${roomUse}.` });
      }
    } else {
      warnings.push({ id: combo.id, severity: combo.severity, text: combo.text });
      if (combo.cure) cures.push({ id: combo.id, element: combo.cure, reason: `${m.zh}${p.mountain}-${w.zh}${p.water} combination` });
      if (roomUse && (combo.avoid || []).includes(roomUse)) warnings.push({ id: combo.id + '-USE', severity: 'medium', text: `A ${roomUse} should not sit in this sector if another room is possible.` });
    }
  }
  // Individual untimely bad stars not already covered by a combo
  for (const [plate, star, t] of [['mountain', p.mountain, tm], ['water', p.water, tw]]) {
    if (!STAR_INFO[star].good && t === 'retired' && !combo) {
      const info = STAR_INFO[star];
      const drain = { earth: 'metal', wood: 'fire', metal: 'water' }[info.element];
      warnings.push({ id: `FS-${star}${plate === 'mountain' ? 'M' : 'W'}`, severity: star === 5 ? 'hard' : 'low',
        text: `${info.zh} ${star} ${plate} star (${info.theme}) in this sector${plate === 'mountain' ? ': affects health and people' : ': affects money and activity'}. ${star === 5 ? 'Keep still, no works.' : ''}`.trim() });
      cures.push({ id: `FS-${star}`, element: drain, reason: `${info.zh} (${info.element}) drained by ${drain}` });
      why.push(`FS-${star}${plate === 'mountain' ? 'M' : 'W'}`);
    }
  }
  if (annualStar != null && (annualStar === 5 || annualStar === 2) && (p.mountain === 5 || p.water === 5 || p.mountain === 2 || p.water === 2)) {
    warnings.push({ id: 'FS-ANNUAL-STACK', severity: 'hard', text: `Annual ${annualStar} lands on a natal ${p.mountain}-${p.water}: this is the most afflicted sector of the house this year. No works, minimal use, metal cure.` });
    if (!cures.some(c => c.element === 'metal')) cures.push({ id: 'FS-ANNUAL-STACK', element: 'metal', reason: 'annual earth affliction stacked on natal illness/misfortune star' });
    why.push('FS-ANNUAL-STACK');
  }

  // Room-use fit from plates: mountain plate governs rest/people, water plate governs activity/money.
  const fit = { bedroom: mGood ? 'good' : wGood ? 'fair' : 'poor', study: wGood ? 'good' : mGood ? 'fair' : 'poor',
    living: wGood ? 'good' : 'fair', kitchen: (p.mountain === 2 || p.water === 2 || p.mountain === 5 || p.water === 5) ? 'poor' : 'fair',
    'main door': wGood ? 'good' : 'poor', dining: wGood ? 'good' : 'fair', toilet: (!mGood && !wGood) ? 'good' : 'fair', store: (!mGood && !wGood) ? 'good' : 'fair', balcony: 'fair' };
  const bestUse = mGood && wGood ? 'living, study or master bedroom' : wGood ? 'living, study, main door or dining' : mGood ? 'bedroom or rest' : 'storage, toilet or low-use';
  const boost = combo && combo.severity === 'boost' ? 1 : 0;
  if (combo && combo.prefer && roomUse && combo.prefer.includes(roomUse)) fit[roomUse] = 'good';
  const score = (mGood ? 1 : 0) + (wGood ? 1 : 0) + boost - warnings.filter(x => x.severity === 'hard').length * 2 - warnings.filter(x => x.severity === 'medium').length;
  const verdict = score >= 2 ? 'good' : score >= 0 ? 'fair' : 'poor';

  return {
    stars: { mountain: p.mountain, water: p.water, period: p.period, annual: annualStar ?? null },
    mountainStar: { n: p.mountain, zh: m.zh, timeliness: tm, good: mGood, theme: m.theme },
    waterStar: { n: p.water, zh: w.zh, timeliness: tw, good: wGood, theme: w.theme },
    verdict, bestUse, fit: roomUse ? fit[roomUse] || 'fair' : null, warnings, cures, why,
  };
}

module.exports = { periodOf, chart, assessPalace, timeliness, STAR_INFO, COMBOS, DIRS };
