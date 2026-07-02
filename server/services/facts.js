'use strict';

// ============================================================
// Chart facts for interpretation — built on the validated engine.
//
// Produces the deterministic facts a reading is keyed on:
//   - day master + strength (ported from the client's analyzeStrength,
//     including void-branch and bound-stem modifiers, so both surfaces
//     agree on favorable/unfavorable elements)
//   - today's pillar + its ten god vs the day master
//   - branch relations between today and the natal chart (clash/combo)
//   - current luck pillar ten god + position within the decade
//   - annual (current year) pillar ten god
//
// computeDailyFacts() also returns a cache key: every field that can
// change the generated text is either in the key or derivable from it,
// so one generation per key serves every matching user.
// ============================================================

const engine = require('../engine');
const A = require('../engine/astro');
const T = require('../engine/tables');

const DEFAULT_TZ_OFFSET_MIN = 480; // Asia/Singapore

const PRODUCED_BY = invert(T.PRODUCES);
const CONTROLLED_BY = invert(T.CONTROLS);
function invert(map) {
  const out = {};
  for (const [k, v] of Object.entries(map)) out[v] = k;
  return out;
}

const SIX_COMBOS = [
  { a: 0, b: 1 }, { a: 2, b: 11 }, { a: 3, b: 10 },
  { a: 4, b: 9 }, { a: 5, b: 8 }, { a: 6, b: 7 },
];
const SIX_CLASHES = [[0, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11]];
const STEM_COMBOS = [
  { a: 0, b: 5, result: 'earth' }, { a: 1, b: 6, result: 'metal' },
  { a: 2, b: 7, result: 'water' }, { a: 3, b: 8, result: 'wood' },
  { a: 4, b: 9, result: 'fire' },
];

const EL_EN = { wood: 'Wood', fire: 'Fire', earth: 'Earth', metal: 'Metal', water: 'Water' };

function getVoidBranches(daySexIdx) {
  const startBranch = (Math.floor(daySexIdx / 10) * 10) % 12;
  return [(startBranch + 10) % 12, (startBranch + 11) % 12];
}

function clashPartner(branchIdx) {
  return (branchIdx + 6) % 12;
}

function comboPartner(branchIdx) {
  for (const c of SIX_COMBOS) {
    if (c.a === branchIdx) return c.b;
    if (c.b === branchIdx) return c.a;
  }
  return null;
}

// ─── Chart computation (engine) ─────────────────────────────

/**
 * Compute the natal chart via the validated engine.
 * hourBranch: -1 for unknown, else 0-11 (子..亥). The client convention is
 * that 子时 (branch 0) means the early zi hour (00:xx) with no day advance,
 * so branch b maps to clock hour 2b.
 */
function computeNatalChart({ birthYear, birthMonth, birthDay, hourBranch, gender }) {
  const hour = hourBranch == null || hourBranch < 0 ? null : hourBranch * 2;
  return engine.computeChart({
    year: birthYear, month: birthMonth, day: birthDay,
    hour, minute: 0,
    utcOffsetMinutes: DEFAULT_TZ_OFFSET_MIN,
    gender: gender === 'male' || gender === 'female' ? gender : undefined,
  });
}

// ─── Day master strength (port of client BZ.analyzeStrength) ─

function findStemCombinations(pillars) {
  const stems = [
    { stemIdx: pillars.year.stem.index, pillar: 'Year' },
    { stemIdx: pillars.month.stem.index, pillar: 'Month' },
    { stemIdx: pillars.day.stem.index, pillar: 'Day' },
  ];
  if (pillars.hour) stems.push({ stemIdx: pillars.hour.stem.index, pillar: 'Hour' });

  const adjacentPairs = [['Year', 'Month'], ['Month', 'Day'], ['Day', 'Hour']];
  const results = [];
  for (let i = 0; i < stems.length; i++) {
    for (let j = i + 1; j < stems.length; j++) {
      const a = stems[i], b = stems[j];
      for (const combo of STEM_COMBOS) {
        if ((a.stemIdx === combo.a && b.stemIdx === combo.b) ||
            (a.stemIdx === combo.b && b.stemIdx === combo.a)) {
          const adjacent = adjacentPairs.some(p =>
            (p[0] === a.pillar && p[1] === b.pillar) ||
            (p[0] === b.pillar && p[1] === a.pillar));
          results.push({ stemA: a.stemIdx, stemB: b.stemIdx, pillarA: a.pillar, pillarB: b.pillar, adjacent });
        }
      }
    }
  }
  return results;
}

function analyzeStrength(chart) {
  const pillars = chart.pillars;
  const dmIdx = pillars.day.stem.index;
  const dmEl = pillars.day.stem.element;
  const monthBrEl = pillars.month.branch.element;

  let seasonal = 0;
  if (monthBrEl === dmEl) seasonal = 3;
  else if (PRODUCED_BY[dmEl] === monthBrEl) seasonal = 2;
  else if (T.PRODUCES[dmEl] === monthBrEl) seasonal = -1;
  else if (T.CONTROLS[dmEl] === monthBrEl) seasonal = -0.5;
  else if (CONTROLLED_BY[dmEl] === monthBrEl) seasonal = -2;

  // Stems bound by non-transforming adjacent combinations have halved influence.
  // The client treats a combo as transforming when the month branch element
  // matches or produces the result element; only non-transforming binds count.
  const monthEl = pillars.month.branch.element;
  const boundStems = new Set();
  for (const sc of findStemCombinations(pillars)) {
    if (!sc.adjacent) continue;
    const result = STEM_COMBOS.find(c =>
      (c.a === sc.stemA && c.b === sc.stemB) || (c.b === sc.stemA && c.a === sc.stemB)).result;
    const transforms = monthEl === result || T.PRODUCES[monthEl] === result;
    if (transforms) continue;
    if (sc.stemA !== dmIdx) boundStems.add(sc.pillarA);
    if (sc.stemB !== dmIdx) boundStems.add(sc.pillarB);
  }

  const voidBranches = getVoidBranches(pillars.day.sexagenaryIndex);
  const isVoid = p => voidBranches.includes(p.branch.index);

  let support = 0, drain = 0;

  const stemPillars = [
    { idx: pillars.year.stem.index, pillar: 'Year' },
    { idx: pillars.month.stem.index, pillar: 'Month' },
  ];
  if (pillars.hour) stemPillars.push({ idx: pillars.hour.stem.index, pillar: 'Hour' });
  for (const sp of stemPillars) {
    const el = T.STEMS[sp.idx].element;
    const weight = boundStems.has(sp.pillar) ? 0.5 : 1;
    if (el === dmEl) support += 1 * weight;
    else if (PRODUCED_BY[dmEl] === el) support += 1 * weight;
    else drain += 1 * weight;
  }

  const branchPillars = [pillars.year, pillars.month, pillars.day];
  if (pillars.hour) branchPillars.push(pillars.hour);
  for (const bp of branchPillars) {
    const voidMult = isVoid(bp) ? 0.5 : 1;
    const hs = T.HIDDEN_STEMS[bp.branch.index];
    const mainEl = T.STEMS[hs[0]].element;
    if (mainEl === dmEl) support += 1.5 * voidMult;
    else if (PRODUCED_BY[dmEl] === mainEl) support += 1 * voidMult;
    else drain += 0.5 * voidMult;
    for (let i = 1; i < hs.length; i++) {
      const el = T.STEMS[hs[i]].element;
      if (el === dmEl) support += 0.5 * voidMult;
      else if (PRODUCED_BY[dmEl] === el) support += 0.3 * voidMult;
    }
  }

  // Floating day master penalty (no root in any non-void branch)
  let hasRoot = false;
  for (const bp of branchPillars) {
    if (isVoid(bp)) continue;
    if (T.HIDDEN_STEMS[bp.branch.index].some(h => T.STEMS[h].element === dmEl)) { hasRoot = true; break; }
  }
  if (!hasRoot) drain += 1.5;

  const score = seasonal * 2 + support - drain;
  let strength, level;
  if (score >= 6) { strength = 'Very Strong'; level = 5; }
  else if (score >= 3) { strength = 'Strong'; level = 4; }
  else if (score >= 0) { strength = 'Moderate'; level = 3; }
  else if (score >= -3) { strength = 'Weak'; level = 2; }
  else { strength = 'Very Weak'; level = 1; }

  let favorable, unfavorable;
  if (level >= 3) {
    favorable = [...new Set([T.PRODUCES[dmEl], T.CONTROLS[dmEl], CONTROLLED_BY[dmEl]])];
    unfavorable = [...new Set([dmEl, PRODUCED_BY[dmEl]])];
  } else {
    favorable = [...new Set([dmEl, PRODUCED_BY[dmEl]])];
    unfavorable = [...new Set([T.PRODUCES[dmEl], T.CONTROLS[dmEl], CONTROLLED_BY[dmEl]])];
  }

  return { strength, level, score: Math.round(score * 10) / 10, favorable, unfavorable, seasonal };
}

// ─── Daily facts + cache key ────────────────────────────────

function tenGodInfo(dmIdx, otherIdx) {
  const zh = T.tenGod(dmIdx, otherIdx);
  return { zh, en: T.TEN_GOD_NAMES[zh].en, abbr: T.TEN_GOD_NAMES[zh].abbr };
}

// Age in decimal years on a given date.
function decimalAge(birth, onDate) {
  const days = A.civilDayNumber(onDate.year, onDate.month, onDate.day) -
               A.civilDayNumber(birth.year, birth.month, birth.day);
  return days / 365.2425;
}

function currentLuckPillar(chart, onDate) {
  if (!chart.luckPillars) return null;
  const age = decimalAge(
    { year: chart.input.year, month: chart.input.month, day: chart.input.day }, onDate);
  for (const lp of chart.luckPillars.pillars) {
    if (age >= lp.ageStart && age < lp.ageEnd) {
      const offset = age - lp.ageStart;
      const position = offset < 10 / 3 ? 'early' : offset < 20 / 3 ? 'mid' : 'late';
      return { ...lp, age: Math.round(age * 10) / 10, position };
    }
  }
  return null; // before first pillar starts, or past the computed pillars
}

/**
 * Compute everything the daily forecast needs, plus a cache key such that
 * all users sharing the key can share the same generated text.
 *
 * dateStr: 'YYYY-MM-DD' — the user's local calendar date.
 */
function computeDailyFacts(input, dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) throw new RangeError(`dateStr must be YYYY-MM-DD, got ${dateStr}`);
  const onDate = { year: +m[1], month: +m[2], day: +m[3] };

  const chart = computeNatalChart(input);
  const strength = analyzeStrength(chart);

  // Today's pillars via the engine (noon avoids zi-hour edge cases; we only
  // need the day + year pillar of the current date).
  const todayChart = engine.computeChart({
    year: onDate.year, month: onDate.month, day: onDate.day,
    hour: 12, minute: 0, utcOffsetMinutes: DEFAULT_TZ_OFFSET_MIN,
  });
  const today = todayChart.pillars.day;
  const annual = todayChart.pillars.year;

  const dmIdx = chart.pillars.day.stem.index;
  const natalDayBr = chart.pillars.day.branch.index;
  const natalYearBr = chart.pillars.year.branch.index;
  const todayBr = today.branch.index;

  const personalClash = clashPartner(todayBr) === natalDayBr;
  const zodiacClash = !personalClash && clashPartner(todayBr) === natalYearBr;
  const harmony = comboPartner(todayBr) === natalDayBr;

  // Same scoring as the client's todayForecast, so ratings agree.
  let score = 0;
  if (strength.favorable.includes(today.stem.element)) score++;
  if (strength.unfavorable.includes(today.stem.element)) score--;
  if (strength.favorable.includes(today.branch.element)) score++;
  if (strength.unfavorable.includes(today.branch.element)) score--;
  if (personalClash) score -= 2;
  else if (zodiacClash) score -= 1;
  if (harmony) score += 1;

  const rating = score >= 2 ? 'Favorable' : score <= -2 ? 'Handle with care' : 'Steady';

  const luck = currentLuckPillar(chart, onDate);
  const luckTenGod = luck ? tenGodInfo(dmIdx, luck.stem.index) : null;
  const annualTenGod = tenGodInfo(dmIdx, annual.stem.index);
  const todayTenGod = tenGodInfo(dmIdx, today.stem.index);

  // Every fact fed to the generator is derivable from this key: the date fixes
  // today's + the annual pillar; dm + strength level fix the favorable
  // elements and all ten gods; clash/combo partners of today's branch are
  // unique, so the relation bits fix the natal branches that appear in copy.
  const key = [
    'v1', dateStr,
    `dm${dmIdx}`, `s${strength.level}`,
    `r${personalClash ? 'P' : zodiacClash ? 'Z' : '-'}${harmony ? 'H' : '-'}`,
    `l${luckTenGod ? luckTenGod.abbr + luck.position[0] : '--'}`,
  ].join('|');

  return {
    key,
    date: dateStr,
    rating,
    score,
    relations: { personalClash, zodiacClash, harmony },
    dayMaster: {
      stem: chart.pillars.day.stem,
      strength: strength.strength,
      level: strength.level,
      favorable: strength.favorable,
      unfavorable: strength.unfavorable,
    },
    natal: {
      dayBranch: chart.pillars.day.branch,
      yearBranch: chart.pillars.year.branch,
    },
    today: {
      ganZhi: today.ganZhi,
      stem: today.stem,
      branch: today.branch,
      tenGod: todayTenGod,
    },
    annual: { ganZhi: annual.ganZhi, stem: annual.stem, tenGod: annualTenGod },
    luck: luck ? {
      ganZhi: luck.ganZhi,
      ageStart: luck.ageStart,
      ageEnd: luck.ageEnd,
      position: luck.position,
      tenGod: luckTenGod,
    } : null,
    chart,
    strength,
  };
}

/**
 * Full chart facts for a Decision Reading — everything Opus needs to write
 * a bespoke report, serialized compactly.
 */
function computeReadingFacts(input, dateStr) {
  const daily = computeDailyFacts(input, dateStr);
  const { chart, strength } = daily;
  const p = chart.pillars;

  const pillarLine = (name, pillar) => pillar ? {
    name,
    ganZhi: pillar.ganZhi,
    stem: { zh: pillar.stem.zh, element: pillar.stem.element, polarity: pillar.stem.polarity },
    branch: { zh: pillar.branch.zh, element: pillar.branch.element, animal: pillar.branch.animal },
    naYin: pillar.naYin,
    tenGod: name === 'day' ? 'Day Master' : tenGodInfo(p.day.stem.index, pillar.stem.index).en,
    hiddenStems: pillar.hiddenStems.map(h => `${h.zh} (${tenGodInfo(p.day.stem.index, h.index).en})`),
  } : null;

  return {
    birth: {
      date: `${chart.input.year}-${chart.input.month}-${chart.input.day}`,
      hourKnown: chart.input.hour != null,
      gender: chart.input.gender,
    },
    pillars: {
      year: pillarLine('year', p.year),
      month: pillarLine('month', p.month),
      day: pillarLine('day', p.day),
      hour: pillarLine('hour', p.hour),
    },
    dayMaster: {
      stem: p.day.stem.zh,
      element: p.day.stem.element,
      polarity: p.day.stem.polarity,
      strength: strength.strength,
      favorableElements: strength.favorable.map(e => EL_EN[e]),
      unfavorableElements: strength.unfavorable.map(e => EL_EN[e]),
    },
    fiveElements: chart.fiveElements.weighted,
    currentLuckPillar: daily.luck ? {
      ganZhi: daily.luck.ganZhi,
      ages: `${Math.floor(daily.luck.ageStart)}-${Math.floor(daily.luck.ageEnd)}`,
      position: daily.luck.position + ' decade',
      tenGod: daily.luck.tenGod.en,
    } : null,
    annualPillar: { ganZhi: daily.annual.ganZhi, tenGod: daily.annual.tenGod.en },
    warnings: chart.warnings.map(w => w.message),
  };
}

module.exports = {
  computeNatalChart,
  analyzeStrength,
  computeDailyFacts,
  computeReadingFacts,
  _internal: { getVoidBranches, currentLuckPillar, findStemCombinations },
};
