'use strict';

// ============================================================
// BaZi (Four Pillars) chart calculation engine.
//
// Standalone module: no runtime dependencies. See REPORT.md for the
// conventions implemented, the config flags that switch between
// schools, and validation methodology.
//
// Public API:
//   computeChart(input) -> chart object   (see JSDoc below)
//
// Pillar logic summary:
//   - Year pillar changes at 立春 (Start of Spring), an astronomical
//     instant, NOT Jan 1 and NOT Chinese New Year.
//   - Month pillar changes at the 12 "jie" solar terms (astronomical
//     instants when apparent solar longitude = 315 + 30k degrees).
//   - Year/month boundaries are compared as absolute instants (UTC),
//     so they are independent of birth timezone.
//   - Day/hour pillars are computed from local civil time, optionally
//     corrected to true solar time (longitude + equation of time).
//   - Lunar leap months are irrelevant by construction: pillars are
//     defined by solar terms only.
// ============================================================

const A = require('./astro');
const T = require('./tables');

const ENGINE_VERSION = '1.0.0';

const DEFAULT_OPTIONS = Object.freeze({
  // 'rollover': the day pillar advances at 23:00 local — births in
  //   23:00-23:59 take the NEXT civil day's day pillar (子初换日).
  // 'split': 夜子时 school — the day pillar keeps the current civil
  //   day until midnight, but the 23:00-23:59 hour pillar takes the
  //   next day's zi-hour stem.
  ziHourMode: 'rollover',
  // Apply longitude-based mean solar time correction to day/hour
  // pillars: (longitude - zoneMeridian) * 4 minutes. Requires `longitude`.
  trueSolarTime: false,
  // Additionally apply the equation of time (apparent solar time).
  // Only used when trueSolarTime is true.
  equationOfTime: false,
  // Number of 10-year luck pillars to generate.
  luckPillarCount: 10,
});

// --- timezone helpers ---------------------------------------------------------

const _dtfCache = new Map();
function _dtf(timeZone) {
  if (!_dtfCache.has(timeZone)) {
    _dtfCache.set(timeZone, new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'longOffset',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }));
  }
  return _dtfCache.get(timeZone);
}

// UTC offset (minutes east of Greenwich) of an IANA zone at a UTC instant.
function tzOffsetAtInstant(timeZone, utcMillis) {
  const parts = _dtf(timeZone).formatToParts(new Date(utcMillis));
  const name = parts.find((p) => p.type === 'timeZoneName').value; // e.g. "GMT+08:00", "GMT-09:30", "GMT"
  const m = name.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!m) return 0; // plain "GMT"
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3]));
}

// Resolve the UTC offset (minutes) for a local wall-clock time in an IANA
// zone. Iterates to a fixed point; for nonexistent wall times (DST gap)
// the post-transition offset is used.
function resolveOffsetMinutes(input) {
  if (typeof input.utcOffsetMinutes === 'number') return input.utcOffsetMinutes;
  if (typeof input.timeZone !== 'string') {
    throw new TypeError('Provide either timeZone (IANA string) or utcOffsetMinutes (number).');
  }
  if (input.year < 100) throw new RangeError('Years before 100 CE are not supported with timeZone input.');
  const wallAsUtc = Date.UTC(input.year, input.month - 1, input.day, input.hour ?? 0, input.minute ?? 0);
  let offset = tzOffsetAtInstant(input.timeZone, wallAsUtc);
  for (let i = 0; i < 3; i++) {
    const next = tzOffsetAtInstant(input.timeZone, wallAsUtc - offset * 60000);
    if (next === offset) break;
    offset = next;
  }
  return offset;
}

// --- formatting helpers --------------------------------------------------------

function stemInfo(idx) {
  const s = T.STEMS[idx];
  return { index: idx, zh: s.zh, pinyin: s.pinyin, element: s.element, polarity: s.polarity };
}

function branchInfo(idx) {
  const b = T.BRANCHES[idx];
  return { index: idx, zh: b.zh, pinyin: b.pinyin, element: b.element, polarity: b.polarity, animal: b.animal };
}

function pillarInfo(sexIdx) {
  const stemIdx = sexIdx % 10;
  const branchIdx = sexIdx % 12;
  return {
    sexagenaryIndex: sexIdx,
    ganZhi: T.ganZhi(sexIdx),
    stem: stemInfo(stemIdx),
    branch: branchInfo(branchIdx),
    naYin: T.NAYIN[Math.floor(sexIdx / 2)].zh,
    hiddenStems: T.HIDDEN_STEMS[branchIdx].map((si, i) => ({
      ...stemInfo(si),
      role: T.HIDDEN_ROLES[i],
    })),
  };
}

function jdToIsoUtc(jd) {
  const g = A.jdToGregorian(jd);
  const pad = (n) => String(n).padStart(2, '0');
  const sec = Math.round(g.second);
  return `${String(g.year).padStart(4, '0')}-${pad(g.month)}-${pad(g.day)}T${pad(g.hour)}:${pad(g.minute)}:${pad(Math.min(sec, 59))}Z`;
}

function mod(n, m) { return ((n % m) + m) % m; }

// Day-pillar sexagenary index for a civil date, anchored so that
// 1949-10-01 is 甲子 (index 0) — a widely documented anchor (the day of
// the PRC founding ceremony was a JiaZi day). Equivalent to (JDN + 49) % 60.
function dayIndexForCivilDayNumber(cdn) {
  return mod(cdn + 49, 60);
}

// --- core ----------------------------------------------------------------------

/**
 * Compute a full BaZi chart.
 *
 * @param {object} input
 * @param {number} input.year    Gregorian birth year (e.g. 1990)
 * @param {number} input.month   1-12
 * @param {number} input.day     1-31
 * @param {number|null} [input.hour]   0-23 local clock; null/undefined = unknown hour
 * @param {number} [input.minute=0]
 * @param {string} [input.timeZone]          IANA zone, e.g. 'Asia/Singapore'
 * @param {number} [input.utcOffsetMinutes]  Alternative to timeZone, e.g. 480
 * @param {number} [input.longitude]  Degrees east (negative = west). Needed for trueSolarTime.
 * @param {number} [input.latitude]   Accepted for completeness; not used in pillar math.
 * @param {('male'|'female')} [input.gender]  Needed for luck pillars.
 * @param {object} [input.options]   See DEFAULT_OPTIONS.
 * @returns {object} chart
 */
function computeChart(input) {
  validateInput(input);
  const opts = { ...DEFAULT_OPTIONS, ...(input.options || {}) };
  if (opts.ziHourMode !== 'rollover' && opts.ziHourMode !== 'split') {
    throw new TypeError(`options.ziHourMode must be 'rollover' or 'split', got ${JSON.stringify(opts.ziHourMode)}`);
  }
  if (opts.trueSolarTime && typeof input.longitude !== 'number') {
    throw new TypeError('options.trueSolarTime requires input.longitude.');
  }

  const hourKnown = input.hour !== null && input.hour !== undefined;
  const minute = input.minute ?? 0;
  const offsetMin = resolveOffsetMinutes(input);

  // Absolute birth instant (UTC Julian Day). Unknown hour -> noon is used
  // ONLY for the year/month boundary comparison; this is safe except for
  // births on the very day of a term change, where the hour matters anyway.
  const wallMinutes = hourKnown ? input.hour * 60 + minute : 720;
  const jdUtc = A.jdAtMidnight(input.year, input.month, input.day) + (wallMinutes - offsetMin) / 1440;

  // --- true solar time correction (affects day + hour pillars only) ---
  let correctionMinutes = 0;
  const corrections = { longitudeMinutes: 0, equationOfTimeMinutes: 0 };
  if (opts.trueSolarTime && hourKnown) {
    const zoneMeridian = (offsetMin / 60) * 15;
    corrections.longitudeMinutes = round2((input.longitude - zoneMeridian) * 4);
    correctionMinutes += corrections.longitudeMinutes;
    if (opts.equationOfTime) {
      corrections.equationOfTimeMinutes = round2(A.equationOfTimeMinutes(jdUtc));
      correctionMinutes += corrections.equationOfTimeMinutes;
    }
  }

  // Effective local date/time used for day + hour pillars.
  let effCdn = A.civilDayNumber(input.year, input.month, input.day);
  let effMinutes = wallMinutes + correctionMinutes;
  while (effMinutes < 0) { effMinutes += 1440; effCdn -= 1; }
  while (effMinutes >= 1440) { effMinutes -= 1440; effCdn += 1; }

  // --- year + month pillars (absolute solar-term comparison) ---
  const lon = A.solarLongitudeAtUtc(jdUtc);
  const m0 = Math.floor(A.norm360(lon - 315) / 30); // 0 = 寅月 .. 11 = 丑月
  const liChunJd = A.jieInstantUtc(input.year, 0);
  const baziYear = jdUtc >= liChunJd ? input.year : input.year - 1;
  const yearIdx = mod(baziYear - 4, 60);
  const yearStemIdx = yearIdx % 10;
  const monthStemIdx = mod((yearStemIdx % 5) * 2 + 2 + m0, 10);
  const monthBranchIdx = mod(m0 + 2, 12);
  const monthIdx = T.sexagenaryIndex(monthStemIdx, monthBranchIdx);

  // --- day pillar ---
  const isLateZi = hourKnown && effMinutes >= 23 * 60;
  let dayCdn = effCdn;
  if (isLateZi && opts.ziHourMode === 'rollover') dayCdn += 1;
  const dayIdx = dayIndexForCivilDayNumber(dayCdn);
  const dayStemIdx = dayIdx % 10;

  // --- hour pillar ---
  let hourPillar = null;
  if (hourKnown) {
    const hourBranchIdx = Math.floor((effMinutes + 60) / 120) % 12;
    let hourStemIdx;
    if (isLateZi && opts.ziHourMode === 'split') {
      // 夜子时: hour is position 12 of the current day's sequence, which
      // equals the zi-hour stem of the following day.
      hourStemIdx = mod((dayStemIdx % 5) * 2 + 12, 10);
    } else {
      hourStemIdx = mod((dayStemIdx % 5) * 2 + hourBranchIdx, 10);
    }
    hourPillar = pillarInfo(T.sexagenaryIndex(hourStemIdx, hourBranchIdx));
  }

  const pillars = {
    year: pillarInfo(yearIdx),
    month: pillarInfo(monthIdx),
    day: pillarInfo(dayIdx),
    hour: hourPillar,
  };

  // --- ten gods ---
  const tenGods = computeTenGods(pillars, dayStemIdx);

  // --- five element balance ---
  const fiveElements = computeFiveElements(pillars);

  // --- luck pillars (大运) ---
  let luckPillars = null;
  if (input.gender === 'male' || input.gender === 'female') {
    luckPillars = computeLuckPillars({
      jdUtc, m0, monthIdx, yearStemIdx,
      gender: input.gender, count: opts.luckPillarCount,
    });
  }

  // --- solar term context + warnings ---
  const prevJieJd = findAdjacentJie(jdUtc, m0, 'prev');
  const nextJieJd = findAdjacentJie(jdUtc, m0, 'next');
  const warnings = [];
  const minutesFromTerm = Math.min(jdUtc - prevJieJd, nextJieJd - jdUtc) * 1440;
  if (minutesFromTerm < 30) {
    warnings.push({
      code: 'solar-term-boundary',
      message: `Birth is within ${Math.ceil(minutesFromTerm)} minute(s) of a solar term; the month (and possibly year) pillar is sensitive to clock accuracy.`,
    });
  }
  if (hourKnown) {
    const distToZi = Math.min(Math.abs(effMinutes - 1380), Math.abs(effMinutes - 60), effMinutes, 1440 - effMinutes);
    if (distToZi < 10) {
      warnings.push({
        code: 'hour-boundary',
        message: 'Birth is within 10 minutes of an hour-pillar boundary; the hour (and possibly day) pillar is sensitive to clock accuracy.',
      });
    }
  }

  const effG = A.jdToGregorian(effCdn); // noon-anchored: gives the civil date
  return {
    engineVersion: ENGINE_VERSION,
    input: {
      year: input.year, month: input.month, day: input.day,
      hour: hourKnown ? input.hour : null, minute: hourKnown ? minute : null,
      timeZone: input.timeZone ?? null,
      utcOffsetMinutes: offsetMin,
      longitude: input.longitude ?? null,
      latitude: input.latitude ?? null,
      gender: input.gender ?? null,
    },
    options: { ...opts },
    time: {
      birthUtc: jdToIsoUtc(jdUtc),
      corrections,
      effectiveLocal: hourKnown
        ? {
            year: effG.year, month: effG.month, day: effG.day,
            minutesOfDay: round2(effMinutes),
          }
        : { year: effG.year, month: effG.month, day: effG.day, minutesOfDay: null },
    },
    pillars,
    dayMaster: { ...stemInfo(dayStemIdx) },
    tenGods,
    fiveElements,
    luckPillars,
    solarTerms: {
      monthTerm: { ...T.JIE_TERMS[m0], utc: jdToIsoUtc(prevJieJd) },
      nextTerm: { ...T.JIE_TERMS[mod(m0 + 1, 12)], utc: jdToIsoUtc(nextJieJd) },
    },
    warnings,
  };
}

function validateInput(input) {
  if (!input || typeof input !== 'object') throw new TypeError('computeChart requires an input object.');
  const { year, month, day, hour, minute } = input;
  if (!Number.isInteger(year) || year < 1700 || year > 2200) {
    throw new RangeError(`year must be an integer in 1700-2200, got ${year}`);
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError(`month must be 1-12, got ${month}`);
  }
  const dim = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (!Number.isInteger(day) || day < 1 || day > dim) {
    throw new RangeError(`day must be 1-${dim} for ${year}-${month}, got ${day}`);
  }
  if (hour !== null && hour !== undefined && (!Number.isInteger(hour) || hour < 0 || hour > 23)) {
    throw new RangeError(`hour must be 0-23 or null for unknown, got ${hour}`);
  }
  if (minute !== undefined && minute !== null && (!Number.isInteger(minute) || minute < 0 || minute > 59)) {
    throw new RangeError(`minute must be 0-59, got ${minute}`);
  }
  if (input.gender !== undefined && input.gender !== 'male' && input.gender !== 'female') {
    throw new TypeError(`gender must be 'male' or 'female', got ${JSON.stringify(input.gender)}`);
  }
  if (input.longitude !== undefined && (typeof input.longitude !== 'number' || input.longitude < -180 || input.longitude > 180)) {
    throw new RangeError(`longitude must be a number in [-180, 180], got ${input.longitude}`);
  }
}

// The jie instant immediately before/after the birth instant, given the
// engine's month index m0 (0 = 寅月).
function findAdjacentJie(jdUtc, m0, which) {
  if (which === 'prev') {
    const target = (315 + 30 * m0) % 360;
    return A.findTermInstantNear(target, jdUtc - 16);
  }
  const target = (315 + 30 * (m0 + 1)) % 360;
  return A.findTermInstantNear(target, jdUtc + 16);
}

function computeTenGods(pillars, dayStemIdx) {
  const stems = {};
  for (const key of ['year', 'month', 'hour']) {
    const p = pillars[key];
    stems[key] = p ? withGodName(T.tenGod(dayStemIdx, p.stem.index)) : null;
  }
  stems.day = { zh: '日主', en: 'Day Master', abbr: 'DM' };
  const hidden = {};
  for (const key of ['year', 'month', 'day', 'hour']) {
    const p = pillars[key];
    hidden[key] = p
      ? p.hiddenStems.map((hs) => ({
          stem: hs.zh, pinyin: hs.pinyin, role: hs.role,
          ...withGodName(T.tenGod(dayStemIdx, hs.index)),
        }))
      : null;
  }
  return { stems, hidden };
}

function withGodName(zh) {
  return { zh, en: T.TEN_GOD_NAMES[zh].en, abbr: T.TEN_GOD_NAMES[zh].abbr };
}

// Hidden-stem weights by role position: main / middle / residual.
const HIDDEN_WEIGHTS = [0.6, 0.3, 0.1];

function computeFiveElements(pillars) {
  const zero = () => ({ wood: 0, fire: 0, earth: 0, metal: 0, water: 0 });
  const visible = zero();   // 8 visible characters (branch = its own element)
  const weighted = zero();  // stems 1.0 each + hidden stems 0.6/0.3/0.1 per branch
  for (const key of ['year', 'month', 'day', 'hour']) {
    const p = pillars[key];
    if (!p) continue;
    visible[p.stem.element] += 1;
    visible[p.branch.element] += 1;
    weighted[p.stem.element] += 1;
    // Single-hidden-stem branches put full weight on the main qi.
    const n = p.hiddenStems.length;
    p.hiddenStems.forEach((hs, i) => {
      const w = n === 1 ? 1.0 : n === 2 ? [0.7, 0.3][i] : HIDDEN_WEIGHTS[i];
      weighted[hs.element] += w;
    });
  }
  for (const el of T.ELEMENTS) weighted[el] = round2(weighted[el]);
  return { visible, weighted };
}

function computeLuckPillars({ jdUtc, m0, monthIdx, yearStemIdx, gender, count }) {
  const yearIsYang = yearStemIdx % 2 === 0;
  const forward = (yearIsYang && gender === 'male') || (!yearIsYang && gender === 'female');
  const termJd = forward ? findAdjacentJie(jdUtc, m0, 'next') : findAdjacentJie(jdUtc, m0, 'prev');
  const days = Math.abs(termJd - jdUtc);
  // Classical conversion: 3 days = 1 year, 1 day = 4 months, 1 shichen = 10 days.
  const decimalYears = days / 3;
  const years = Math.floor(decimalYears);
  const remMonthsFloat = (decimalYears - years) * 12;
  let months = Math.floor(remMonthsFloat);
  let extraDays = Math.round((remMonthsFloat - months) * 30);
  if (extraDays === 30) { extraDays = 0; months += 1; }
  let yearsAdj = years;
  if (months === 12) { months = 0; yearsAdj += 1; }

  const pillarList = [];
  for (let i = 1; i <= count; i++) {
    const idx = mod(monthIdx + (forward ? i : -i), 60);
    const ageStart = decimalYears + (i - 1) * 10;
    pillarList.push({
      ...pillarInfo(idx),
      ageStart: round2(ageStart),
      ageEnd: round2(ageStart + 10),
    });
  }
  return {
    direction: forward ? 'forward' : 'backward',
    startAge: {
      decimalYears: round2(decimalYears),
      years: yearsAdj, months, days: extraDays,
    },
    pillars: pillarList,
  };
}

function round2(n) { return Math.round(n * 100) / 100; }

module.exports = {
  computeChart,
  ENGINE_VERSION,
  DEFAULT_OPTIONS,
  // exported for tests / tooling
  _internal: {
    resolveOffsetMinutes, tzOffsetAtInstant, dayIndexForCivilDayNumber,
    findAdjacentJie, jdToIsoUtc,
  },
};
