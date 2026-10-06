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

const DIR_OF = { wood: ['E', 'SE'], fire: ['S'], earth: ['NE', 'SW'], metal: ['W', 'NW'], water: ['N'] };
const COLOURS = { wood: 'green, teal', fire: 'red, purple, orange', earth: 'yellow, beige, brown', metal: 'white, gold, silver, grey', water: 'black, navy, deep blue' };
const ZH = { wood: '木', fire: '火', earth: '土', metal: '金', water: '水' };

function analyse(pillars) {
  const dm = pillars.day.stem.element;
  const cls = el => el === dm ? 'bijie' : el === PRODUCED_BY[dm] ? 'yin' : el === T.PRODUCES[dm] ? 'shishang' : el === T.CONTROLS[dm] ? 'cai' : 'guansha';
  const points = { bijie: 0, yin: 0, shishang: 0, cai: 0, guansha: 0 };
  const byElement = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  const rooted = new Set();   // elements with a principal/middle root in any branch
  const principal = new Set(); // elements with a principal (本气) root
  const branchIdx = [];
  const add = (el, pts) => { points[cls(el)] += pts; byElement[el] += pts; };

  const monthBranch = pillars.month.branch.index;
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
      add(el, 5 + (rooted.has(el) ? 2 : 0));
    }
    const hs = T.HIDDEN_STEMS[p.branch.index];
    const pts = hiddenPoints(hs.length);
    const mult = key === 'month' ? (monthClashed ? 1 : 2) : key === 'day' ? 1.2 : 1;
    hs.forEach((si, i) => add(T.STEMS[si].element, pts[i] * mult));
  }
  for (const [a, b, c, el] of TRIADS) {
    if ([a, b, c].every(x => branchIdx.includes(x))) add(el, 5);
  }

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
  // 从格 gate: a class blocks 'following' only when it has a principal root or real weight.
  const diffRooted = ['shishang', 'cai', 'guansha'].some(k => principal.has(E[k]) || points[k] >= 8);
  const sameRooted = ['bijie', 'yin'].some(k => principal.has(E[k]) || points[k] >= 8);

  if (ratio > 0.65 && !diffRooted) {
    method = 'cong-qiang'; label = 'follow-strong (從強)';
    yong = dm; xi = tiaoHouOverride ? tiaoHou : E.yin; ji = [E.guansha, E.cai].filter(e => e !== xi);
  } else if (ratio < -0.65 && !sameRooted) {
    method = 'cong-ruo'; label = 'follow-weak (從弱)';
    const h = heaviest(['shishang', 'cai', 'guansha']);
    yong = E[h]; xi = PRODUCED_BY[yong]; ji = [dm, E.yin];
  } else if (ratio > 0.10) {
    label = ratio > 0.4 ? 'strong' : 'moderately strong';
    if (points.bijie >= points.yin) {
      if (rooted.has(E.guansha) && points.guansha >= 5) { yong = E.guansha; xi = E.cai; }
      else { yong = E.shishang; xi = E.cai; }
    } else { yong = E.cai; xi = E.guansha; }
    ji = [dm, E.yin];
  } else if (ratio < -0.10) {
    label = ratio < -0.4 ? 'weak' : 'moderately weak';
    const h = heaviest(['shishang', 'cai', 'guansha']);
    if (h === 'cai') { yong = dm; xi = E.yin; } else { yong = E.yin; xi = dm; }
    ji = [E[h]];
    if (h !== 'cai' && points.cai > 0) ji.push(E.cai);
  } else {
    label = 'balanced'; method = 'balanced';
    // Lightest element restores balance; 调候 wins if present.
    yong = tiaoHou || ELEMENTS.slice().sort((a, b) => byElement[a] - byElement[b])[0];
    xi = PRODUCED_BY[yong];
    ji = [heaviest(['bijie', 'yin', 'shishang', 'cai', 'guansha'])].map(k => E[k]);
  }

  // --- 调候 override / mediation ---
  let disagreement = false;
  if (tiaoHouOverride && !peak && ratio < -0.10) tiaoHouOverride = false;
  if (tiaoHouOverride && method !== 'cong-qiang' && method !== 'cong-ruo') {
    if (yong !== tiaoHou) { disagreement = !ji.includes(tiaoHou) ? false : true; xi = yong; yong = tiaoHou; ji = ji.filter(e => e !== tiaoHou); }
    method = 'tiaohou';
  } else if (tiaoHou && tiaoHou !== yong && !ji.includes(tiaoHou) && xi !== tiaoHou) {
    xi = tiaoHou; // seasonal element as secondary favourite
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

function elementOfDirection(dir) {
  return dir === 'C' ? 'earth' : Object.keys(DIR_OF).find(e => DIR_OF[e].includes(dir));
}

module.exports = { analyse, elementOfDirection, DIR_OF, COLOURS, ZH, PRODUCED_BY, CONTROLLED_BY };
