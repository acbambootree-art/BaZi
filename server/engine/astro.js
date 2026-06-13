'use strict';

// ============================================================
// Astronomical core for the BaZi engine.
//
// Solar terms are instants when the sun's APPARENT geocentric
// longitude is a multiple of 15 degrees. Apparent longitude is computed
// from a truncated VSOP87D Earth series (vsop87d-earth.js, see header
// there for provenance) plus nutation (4 principal terms, IAU 1980) and
// annual aberration, with Delta-T applied so inputs are civil (UTC)
// times. Calibrated accuracy of term instants: well under one minute
// over 1900-2100 (measured against two independent ephemerides; see
// validation/SOURCES.md).
// ============================================================

const VSOP = require('./vsop87d-earth');

const DEG = Math.PI / 180;

// --- Calendar <-> Julian Day -------------------------------------------------

// Julian Day at 00:00 (midnight) of a Gregorian calendar date. Meeus ch. 7.
function jdAtMidnight(year, month, day) {
  let y = year, m = month;
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + B - 1524.5;
}

// Integer day number for a civil date (the JDN of that date's noon).
// Consecutive civil dates differ by exactly 1.
function civilDayNumber(year, month, day) {
  return Math.round(jdAtMidnight(year, month, day) + 0.5);
}

// Inverse of jdAtMidnight for arbitrary JD (Gregorian). Meeus ch. 7.
function jdToGregorian(jd) {
  const z = Math.floor(jd + 0.5);
  const f = jd + 0.5 - z;
  const alpha = Math.floor((z - 1867216.25) / 36524.25);
  const A = z + 1 + alpha - Math.floor(alpha / 4);
  const B = A + 1524;
  const C = Math.floor((B - 122.1) / 365.25);
  const D = Math.floor(365.25 * C);
  const E = Math.floor((B - D) / 30.6001);
  const day = B - D - Math.floor(30.6001 * E);
  const month = E < 14 ? E - 1 : E - 13;
  const year = month > 2 ? C - 4716 : C - 4715;
  const dayFrac = f * 24;
  const hour = Math.floor(dayFrac);
  const minFrac = (dayFrac - hour) * 60;
  const minute = Math.floor(minFrac);
  const second = (minFrac - minute) * 60;
  return { year, month, day, hour, minute, second };
}

// --- Delta-T (TT - UT), seconds ----------------------------------------------
// Polynomial expressions by Espenak & Meeus (NASA eclipse site,
// "Polynomial Expressions for Delta T"). Good to a few seconds over
// 1800-2150, which is far below the engine's stated precision.
function deltaTSeconds(decimalYear) {
  const y = decimalYear;
  let t;
  if (y >= 2050 && y < 2150) {
    const u = (y - 1820) / 100;
    return -20 + 32 * u * u - 0.5628 * (2150 - y);
  }
  if (y >= 2005 && y < 2050) {
    t = y - 2000;
    return 62.92 + 0.32217 * t + 0.005589 * t * t;
  }
  if (y >= 1986 && y < 2005) {
    t = y - 2000;
    return 63.86 + 0.3345 * t - 0.060374 * t * t + 0.0017275 * t * t * t
      + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5;
  }
  if (y >= 1961 && y < 1986) {
    t = y - 1975;
    return 45.45 + 1.067 * t - t * t / 260 - t * t * t / 718;
  }
  if (y >= 1941 && y < 1961) {
    t = y - 1950;
    return 29.07 + 0.407 * t - t * t / 233 + t * t * t / 2547;
  }
  if (y >= 1920 && y < 1941) {
    t = y - 1920;
    return 21.20 + 0.84493 * t - 0.076100 * t * t + 0.0020936 * t * t * t;
  }
  if (y >= 1900 && y < 1920) {
    t = y - 1900;
    return -2.79 + 1.494119 * t - 0.0598939 * t * t + 0.0061966 * t * t * t - 0.000197 * t ** 4;
  }
  if (y >= 1860 && y < 1900) {
    t = y - 1860;
    return 7.62 + 0.5737 * t - 0.251754 * t * t + 0.01680668 * t * t * t
      - 0.0004473624 * t ** 4 + t ** 5 / 233174;
  }
  if (y >= 1800 && y < 1860) {
    t = y - 1800;
    return 13.72 - 0.332447 * t + 0.0068612 * t * t + 0.0041116 * t * t * t
      - 0.00037436 * t ** 4 + 0.0000121272 * t ** 5 - 0.0000001699 * t ** 6
      + 0.000000000875 * t ** 7;
  }
  // Fallback outside 1800-2150 (parabolic long-term fit).
  const u = (y - 1820) / 100;
  return -20 + 32 * u * u;
}

// Convert a UTC Julian Day to Terrestrial Time (TT) Julian Day.
function utcToTT(jdUtc) {
  const { year, month } = jdToGregorian(jdUtc);
  const decimalYear = year + (month - 0.5) / 12;
  return jdUtc + deltaTSeconds(decimalYear) / 86400;
}

// --- Apparent solar longitude (degrees) ---------------------------------------

// Evaluate a VSOP87 series at t (Julian millennia from J2000).
function vsopSeries(series, t) {
  let total = 0;
  let tk = 1;
  for (let k = 0; k < series.length; k++) {
    let sum = 0;
    const terms = series[k];
    for (let i = 0; i < terms.length; i++) {
      sum += terms[i][0] * Math.cos(terms[i][1] + terms[i][2] * t);
    }
    total += sum * tk;
    tk *= t;
  }
  return total;
}

// Nutation in longitude (arcseconds), 4 principal IAU-1980 terms
// (Meeus ch. 22 abridged; remaining terms < 0.3").
function nutationLongitudeArcsec(T) {
  const omega = (125.04452 - 1934.136261 * T + 0.0020708 * T * T) * DEG;
  const Ls = (280.4665 + 36000.7698 * T) * DEG;     // mean longitude, Sun
  const Lm = (218.3165 + 481267.8813 * T) * DEG;    // mean longitude, Moon
  return -17.20 * Math.sin(omega)
    - 1.32 * Math.sin(2 * Ls)
    - 0.23 * Math.sin(2 * Lm)
    + 0.21 * Math.sin(2 * omega);
}

function solarApparentLongitude(jdTT) {
  const t = (jdTT - 2451545.0) / 365250.0;  // Julian millennia
  const T = t * 10;                          // Julian centuries
  // Heliocentric Earth longitude -> geocentric solar longitude.
  const lonGeo = vsopSeries(VSOP.L, t) / DEG + 180;
  const R = vsopSeries(VSOP.R, t);           // AU
  const nutation = nutationLongitudeArcsec(T);
  const aberration = -20.4898 / R;
  return norm360(lonGeo + (nutation + aberration) / 3600);
}

function norm360(deg) {
  return ((deg % 360) + 360) % 360;
}

// Signed angular difference a-b wrapped to (-180, 180].
function wrap180(deg) {
  let d = norm360(deg);
  if (d > 180) d -= 360;
  return d;
}

// Apparent solar longitude at a UTC Julian Day.
function solarLongitudeAtUtc(jdUtc) {
  return solarApparentLongitude(utcToTT(jdUtc));
}

// --- Solar term instants ------------------------------------------------------

// Find the UTC Julian Day at which apparent solar longitude crosses
// `targetDeg`, searching near `jdGuessUtc` (must be within ~25 days and
// on the correct side or bracket of the crossing is found by scanning).
function findTermInstantNear(targetDeg, jdGuessUtc) {
  // Walk to bracket the crossing: f goes negative -> positive at crossing.
  let lo = jdGuessUtc, hi = jdGuessUtc;
  let fLo = wrap180(solarLongitudeAtUtc(lo) - targetDeg);
  // Sun moves ~1 deg/day; step out until bracketed (cap 40 days each way).
  let steps = 0;
  while (fLo > 0 && steps < 40) { lo -= 1; fLo = wrap180(solarLongitudeAtUtc(lo) - targetDeg); steps++; }
  hi = lo + 1;
  let fHi = wrap180(solarLongitudeAtUtc(hi) - targetDeg);
  steps = 0;
  while (fHi < 0 && steps < 80) { hi += 1; fHi = wrap180(solarLongitudeAtUtc(hi) - targetDeg); steps++; }
  if (!(fLo <= 0 && fHi >= 0)) {
    throw new Error(`findTermInstantNear failed to bracket target ${targetDeg} near JD ${jdGuessUtc}`);
  }
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const f = wrap180(solarLongitudeAtUtc(mid) - targetDeg);
    if (f < 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// Approximate Gregorian [month, day] when the sun reaches longitude
// (315 + 30*k) — i.e. the k-th jie term, k = 0 (立春) .. 11 (小寒).
const JIE_APPROX = [
  [2, 4], [3, 6], [4, 5], [5, 6], [6, 6], [7, 7],
  [8, 8], [9, 8], [10, 8], [11, 7], [12, 7], [1, 6],
];

const _jieCache = new Map();

// UTC instant (Julian Day) of the k-th jie term whose calendar date falls
// in `gregorianYear` (note: 小寒 k=11 falls in January).
function jieInstantUtc(gregorianYear, k) {
  const key = gregorianYear * 12 + k;
  if (_jieCache.has(key)) return _jieCache.get(key);
  const [m, d] = JIE_APPROX[k];
  const guess = jdAtMidnight(gregorianYear, m, d);
  const target = (315 + 30 * k) % 360;
  const jd = findTermInstantNear(target, guess);
  _jieCache.set(key, jd);
  return jd;
}

// --- Equation of time ----------------------------------------------------------
// NOAA / Meeus ch. 28 approximation. Returns (apparent - mean) solar time
// in minutes. Positive: sundial ahead of clock.
function equationOfTimeMinutes(jdUtc) {
  const T = (utcToTT(jdUtc) - 2451545.0) / 36525.0;
  const L0 = norm360(280.46646 + 36000.76983 * T + 0.0003032 * T * T) * DEG;
  const M = norm360(357.52911 + 35999.05029 * T - 0.0001537 * T * T) * DEG;
  const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;
  const eps0 = 23 + 26 / 60 + 21.448 / 3600
    - (46.8150 * T + 0.00059 * T * T - 0.001813 * T * T * T) / 3600;
  const y = Math.tan((eps0 * DEG) / 2) ** 2;
  const E = y * Math.sin(2 * L0)
    - 2 * e * Math.sin(M)
    + 4 * e * y * Math.sin(M) * Math.cos(2 * L0)
    - 0.5 * y * y * Math.sin(4 * L0)
    - 1.25 * e * e * Math.sin(2 * M);
  return (E / DEG) * 4; // radians -> degrees -> minutes (4 min per degree)
}

module.exports = {
  jdAtMidnight, civilDayNumber, jdToGregorian,
  deltaTSeconds, utcToTT,
  solarApparentLongitude, solarLongitudeAtUtc,
  norm360, wrap180,
  findTermInstantNear, jieInstantUtc,
  equationOfTimeMinutes,
};
