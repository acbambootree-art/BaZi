'use strict';

// ============================================================
// 用神 — day-master strength and favourable elements.
// Method: docs/smart-luopan-rulebook.md section B (子平 扶抑 default,
// 调候 override for extreme seasons, 通关 mediation, 从格 for extremes).
// Input: the `pillars` object from computeChart (index.js).
// ============================================================

const T = require('./tables');

const ELEMENTS = ['wood', 'fire', 'earth', 'metal', 'water'];
const PRODUCED_BY = Object.fromEntries(Object.entries(T.PRODUCES).map(([a, b]) => [b, a]));
const CONTROLLED_BY = Object.fromEntries(Object.entries(T.CONTROLS).map(([a, b]) => [b, a]));

// Hidden-stem points: principal 5, middle 2, residual 1; pure branches 8;
// two-stem branches 5 + 3.
function hiddenPoints(n) { return n === 1 ? [8] : n === 2 ? [5, 3] : [5, 2, 1]; }

const CLASH = { 0: 6, 6: 0, 1: 7, 7: 1, 2: 8, 8: 2, 3: 9, 9: 3, 4: 10, 10: 4, 5: 11, 11: 5 };
const TRIADS = [[8, 0, 4, 'water'], [2, 6, 10, 'fire'], [5, 9, 1, 'metal'], [11, 3, 7, 'wood']]; // 三合

// 旺相休囚死 by month-branch season: multiplier applied to every stem and
// hidden-stem point outside the month branch itself (which carries the season).
const SEASON = { wood: ['wood', 'fire', 'water', 'metal', 'earth'], fire: ['fire', 'earth', 'wood', 'water', 'metal'],
  metal: ['metal', 'water', 'earth', 'fire', 'wood'], water: ['water', 'wood', 'metal', 'earth', 'fire'], earth: ['earth', 'metal', 'fire', 'wood', 'water'] };
const STATE_MULT = [1.0, 0.8, 0.55, 0.35, 0.2]; // 旺 相 休 囚 死
function seasonMult(el, monthBranchEl) { return STATE_MULT[SEASON[monthBranchEl].indexOf(el)]; }

const DIR_OF = { wood: ['E', 'SE'], fire: ['S'], earth: ['NE', 'SW'], metal: ['W', 'NW'], water: ['N'] };
const COLOURS = { wood: 'green, teal', fire: 'red, purple, orange', earth: 'yellow, beige, brown', metal: 'white, gold, silver, grey', water: 'black, navy, deep blue' };
const ZH = { wood: '木', fire: '火', earth: '土', metal: '金', water: '水' };

const DEFAULT_WEIGHTS = { monthMult: 1.5, dayMult: 1.2, seasonBlend: 0, lingBonus: 8, strongAt: 0.10, weakAt: -0.25 };

function analyse(pillars, weights = {}) {
  const W = { ...DEFAULT_WEIGHTS, ...weights };
  const dm = pillars.day.stem.element;
  const cls = el => el === dm ? 'bijie' : el === PRODUCED_BY[dm] ? 'yin' : el === T.PRODUCES[dm] ? 'shishang' : el === T.CONTROLS[dm] ? 'cai' : 'guansha';
  const points = { bijie: 0, yin: 0, shishang: 0, cai: 0, guansha: 0 };
  const byElement = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  const rooted = new Set();   // elements with a principal/middle root in any branch
  const principal = new Set(); // elements with a principal (本气) root
  const branchIdx = [];
  const add = (el, pts) => { points[cls(el)] += pts; byElement[el] += pts; };

  const monthBranch = pillars.month.branch.index;
  const seasonEl = T.BRANCHES[monthBranch].element;
  const sm = el => 1 + (seasonMult(el, seasonEl) - 1) * W.seasonBlend; // blend 0 = flat, 1 = full 旺相休囚死
  for (const key of ['year', 'month', 'day', 'hour']) {
    const p = pillars[key]; if (!p) continue;
    branchIdx.push(p.branch.index);
    const hs = T.HIDDEN_STEMS[p.branch.index];
    const pts = hiddenPoints(hs.length);
    hs.forEach((si, i) => { if (i < 2) rooted.add(T.STEMS[si].element); if (i === 0) principal.add(T.STEMS[si].element); });
  }
  // 六冲 on the month branch halves its weight.
  const monthClashed = branchIdx.some(b => b !== monthBranch && CLASH[b] === monthBranch);

  for (const key of ['year', 'month', 'day', 'hour']) {
    const p = pillars[key]; if (!p) continue;
    if (key !== 'day') {
      const el = p.stem.element;
      add(el, (5 + (rooted.has(el) ? 2 : 0)) * sm(el));
    }
    const hs = T.HIDDEN_STEMS[p.branch.index];
    const pts = hiddenPoints(hs.length);
    const ownSeat = key !== 'month' && T.STEMS[hs[0]].element === dm; // 坐祿 / 坐刃 / 通根本氣
    const mult = key === 'month' ? (monthClashed ? W.monthMult / 2 : W.monthMult) : key === 'day' ? (ownSeat ? W.dayMult + 0.6 : W.dayMult) : (ownSeat ? 1.4 : 1);
    hs.forEach((si, i) => { const el = T.STEMS[si].element; add(el, pts[i] * mult * (key === 'month' ? 1 : sm(el))); });
  }
  for (const [a, b, c, el] of TRIADS) {
    if ([a, b, c].every(x => branchIdx.includes(x))) add(el, 5);
  }

  // 得令 bonus: the day master's own seasonal state (旺/相 helps, 囚/死 hurts).
  const dmState = SEASON[seasonEl].indexOf(dm);
  const ling = W.lingBonus * [1, 0.6, 0, -0.4, -0.8][dmState] * (dm === 'earth' && [1, 4, 7, 10].includes(monthBranch) ? 0.5 : 1);
  if (ling > 0) points.bijie += ling; else points.cai += -ling;
  const same = points.bijie + points.yin;
  const diff = points.shishang + points.cai + points.guansha;
  const total = same + diff;
  const ratio = total ? (same - diff) / total : 0;

  // --- 调候 ---
  const winter = [11, 0, 1].includes(monthBranch), summer = [5, 6, 7].includes(monthBranch);
  const hasStemOrPrincipal = el => ['year', 'month', 'day', 'hour'].some(k => pillars[k] && (pillars[k].stem.element === el || T.STEMS[T.HIDDEN_STEMS[pillars[k].branch.index][0]].element === el));
  let tiaoHou = null, tiaoHouOverride = false;
  if (winter) { tiaoHou = 'fire'; tiaoHouOverride = !hasStemOrPrincipal('fire'); }
  if (summer) { tiaoHou = 'water'; tiaoHouOverride = !hasStemOrPrincipal('water'); }
  // At the start of a season (亥, 巳) the climate is mild: 调候 only overrides at peak months,
  // or when the day master is not weak (a weak DM cannot afford a draining 调候 element).
  const peak = [0, 1, 6, 7].includes(monthBranch);

  // --- 扶抑 / 从格 ---
  const E = { bijie: dm, yin: PRODUCED_BY[dm], shishang: T.PRODUCES[dm], cai: T.CONTROLS[dm], guansha: CONTROLLED_BY[dm] };
  const heaviest = keys => keys.slice().sort((a, b) => points[b] - points[a])[0];
  let method = 'fuyi', yong, xi, ji = [], label;
  // 从格 gate. 從弱 needs a rootless day master with no transparent 比劫/印 and no principal 印 root;
  // 從強 needs no principal different-class root and no transparent different-class stem of weight.
  // Branches inside a complete 三會/三合 frame of another element have their minor hidden stems absorbed.
  const FRAMES = [[2, 3, 4, 'wood'], [5, 6, 7, 'fire'], [8, 9, 10, 'metal'], [11, 0, 1, 'water'], ...TRIADS];
  const absorbed = new Set();
  for (const [a, b, c2, el] of FRAMES) if ([a, b, c2].every(x => branchIdx.includes(x)) && el !== dm) [a, b, c2].forEach(x => absorbed.add(x));
  const liveRoot = new Set(); // DM-class roots that count: principal or middle, outside absorbed frames
  for (const key of ['year', 'month', 'day', 'hour']) if (pillars[key]) {
    const bi = pillars[key].branch.index;
    T.HIDDEN_STEMS[bi].forEach((si, i) => { if (i < 2 && !absorbed.has(bi)) liveRoot.add(T.STEMS[si].element); });
  }
  const stemEls = ['year', 'month', 'hour'].filter(k => pillars[k]).map(k => pillars[k].stem.element);
  const diffRooted = ['shishang', 'cai', 'guansha'].some(k => principal.has(E[k]) || points[k] >= 12);
  const sameRooted = liveRoot.has(dm) || stemEls.includes(dm) || (stemEls.includes(E.yin) && liveRoot.has(E.yin)) || points.bijie + points.yin >= 12;

  if (ratio > 0.55 && !diffRooted) {
    method = 'cong-qiang'; label = 'follow-strong (從強)';
    yong = dm; xi = tiaoHouOverride ? tiaoHou : E.yin; ji = [E.guansha, E.cai].filter(e => e !== xi);
  } else if (ratio < -0.65 && !sameRooted) {
    method = 'cong-ruo'; label = 'follow-weak (從弱)';
    const h = heaviest(['shishang', 'cai', 'guansha']);
    yong = E[h]; xi = PRODUCED_BY[yong]; ji = [dm, E.yin];
  } else if (byElement[dm] + byElement[T.PRODUCES[dm]] >= 0.9 * total && byElement[T.PRODUCES[dm]] >= 0.3 * total) {
    label = 'two-element (兩氣成象)'; method = 'liangqi';
    yong = T.PRODUCES[dm]; xi = dm; ji = [CONTROLLED_BY[yong]];
  } else if (ratio > W.strongAt) {
    label = ratio > 0.4 ? 'strong' : 'moderately strong';
    if (points.bijie >= points.yin) {
      if ((principal.has(E.guansha) || stemEls.includes(E.guansha)) && points.guansha >= 10) { yong = E.guansha; xi = E.cai; }
      else { yong = E.shishang; xi = E.cai; }
    } else { yong = E.cai; xi = E.guansha; }
    ji = [dm, E.yin];
  } else if (ratio < W.weakAt) {
    label = ratio < -0.4 ? 'weak' : 'moderately weak';
    const h = heaviest(['shishang', 'cai', 'guansha']);
    if (h === 'cai') { yong = dm; xi = E.yin; } else { yong = E.yin; xi = dm; }
    ji = [E[h]];
    if (h !== 'cai' && points.cai > 0) ji.push(E.cai);
  } else {
    label = 'balanced'; method = 'balanced';
    // Balanced: let the qi flow — drain into 食傷 if present, else 財; 调候 wins if the chart lacks it.
    yong = (tiaoHou && byElement[tiaoHou] === 0) ? tiaoHou : points.shishang > 0 ? E.shishang : points.cai > 0 ? E.cai : E.guansha;
    xi = yong === E.shishang ? E.cai : yong === E.cai ? E.shishang : E.yin;
    ji = [CONTROLLED_BY[yong]].filter(e => e !== dm);
  }

  // --- 调候 override / mediation ---
  let disagreement = false;
  if (tiaoHouOverride && (!peak || byElement[tiaoHou] > 0 || Math.abs(ratio) > 0.4)) tiaoHouOverride = false;
  if (tiaoHouOverride && method !== 'cong-qiang' && method !== 'cong-ruo') {
    if (yong !== tiaoHou) { disagreement = !ji.includes(tiaoHou) ? false : true; xi = yong; yong = tiaoHou; ji = ji.filter(e => e !== tiaoHou); }
    method = 'tiaohou';
  } else if (tiaoHou && tiaoHou !== yong && !ji.includes(tiaoHou) && xi !== tiaoHou && byElement[tiaoHou] < 3) {
    xi = tiaoHou; // seasonal element as secondary favourite only when the chart has almost none of it
  }
  // 通关: two heaviest classes in a controlling pair with the mediator present
  const order = Object.keys(points).sort((a, b) => points[b] - points[a]);
  const e1 = E[order[0]], e2 = E[order[1]];
  if (T.CONTROLS[e1] === e2 || T.CONTROLS[e2] === e1) {
    const ctrl = T.CONTROLS[e1] === e2 ? e1 : e2, victim = ctrl === e1 ? e2 : e1;
    const mediator = T.PRODUCES[ctrl]; // ctrl -> mediator -> victim
    if (byElement[mediator] > 0 && mediator !== yong && !ji.includes(mediator)) xi = mediator;
  }

  const abs = Math.abs(ratio);
  const confidence = (method === 'balanced' || (abs > 0.6 && abs < 0.75) || disagreement) ? 'low' : abs < 0.3 ? 'medium' : 'high';

  const fav = [yong, xi].filter((v, i, a) => v && a.indexOf(v) === i);
  return {
    dayMaster: { element: dm, zh: ZH[dm], stem: pillars.day.stem.zh },
    strength: { label, ratio: Math.round(ratio * 100) / 100, same: Math.round(same * 10) / 10, different: Math.round(diff * 10) / 10, points },
    yongShen: yong, xiShen: xi, jiShen: ji, tiaoHou, method, confidence,
    favourable: fav, avoid: ji,
    directions: { favourable: fav.flatMap(e => DIR_OF[e]), avoid: ji.flatMap(e => DIR_OF[e]) },
    colours: { favourable: fav.map(e => COLOURS[e]).join('; '), avoid: ji.map(e => COLOURS[e]).join('; ') },
    zh: { yongShen: ZH[yong], xiShen: ZH[xi], jiShen: ji.map(e => ZH[e]).join('') },
  };
}

/** Build computeChart-shaped pillars from four 干支 strings (year, month, day, hour; hour may be null). */
function pillarsFromGanZhi(gz) {
  const STEM_ZH = '甲乙丙丁戊己庚辛壬癸', BRANCH_ZH = '子丑寅卯辰巳午未申酉戌亥';
  const mk = s => {
    if (!s) return null;
    const si = STEM_ZH.indexOf(s[0]), bi = BRANCH_ZH.indexOf(s[1]);
    if (si < 0 || bi < 0) throw new RangeError(`bad 干支 ${s}`);
    return { stem: { index: si, zh: s[0], element: T.STEMS[si].element }, branch: { index: bi, zh: s[1], element: T.BRANCHES[bi].element },
      hiddenStems: T.HIDDEN_STEMS[bi].map(i => ({ index: i, element: T.STEMS[i].element })), ganZhi: s };
  };
  return { year: mk(gz[0]), month: mk(gz[1]), day: mk(gz[2]), hour: mk(gz[3]) };
}

function elementOfDirection(dir) {
  return dir === 'C' ? 'earth' : Object.keys(DIR_OF).find(e => DIR_OF[e].includes(dir));
}

module.exports = { analyse, DEFAULT_WEIGHTS, elementOfDirection, pillarsFromGanZhi, DIR_OF, COLOURS, ZH, PRODUCED_BY, CONTROLLED_BY };
