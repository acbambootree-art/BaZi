'use strict';

// Build-time tool: extracts a truncated VSOP87D Earth series from the
// `astronomia` package (devDependency) into engine/vsop87d-earth.js so the
// engine itself has zero runtime dependencies.
//
// Truncation: keep every term whose maximum possible contribution over
// 1800-2200 (|t| <= 0.2 Julian millennia) is >= MIN_RAD radians. The
// dropped remainder is bounded and printed for the record.
//
// Run: node engine/validation/extract-vsop.js   (from server/)

const fs = require('fs');
const path = require('path');
const data = require('astronomia/data/vsop87Dearth').default;

const T_MAX = 0.2;       // |Julian millennia from J2000| covering 1800-2200
const MIN_RAD = 2e-8;    // ~0.004 arcsec per dropped term

function truncateSeries(series, minRad) {
  const kept = {};
  const dropped = {};
  for (const power of Object.keys(series)) {
    const k = Number(power);
    const scale = Math.pow(T_MAX, k);
    kept[power] = [];
    dropped[power] = 0;
    for (const [Aa, Bb, Cc] of series[power]) {
      if (Aa * scale >= minRad) kept[power].push([Aa, Bb, Cc]);
      else dropped[power] += Aa * scale; // worst-case linear sum bound
    }
  }
  return { kept, dropped };
}

const L = truncateSeries(data.L, MIN_RAD);
const R = truncateSeries(data.R, 1e-7); // R only feeds aberration (20.5"/R)

let totalDroppedL = 0;
for (const p of Object.keys(L.dropped)) totalDroppedL += L.dropped[p];

const counts = (s) => Object.keys(s.kept).map((p) => `${p}:${s.kept[p].length}`).join(' ');
console.log(`L terms kept  ${counts(L)}  (dropped worst-case ${(totalDroppedL * 206264.8).toFixed(3)}")`);
console.log(`R terms kept  ${counts(R)}`);

const header = `'use strict';

// Truncated VSOP87D heliocentric Earth series (equinox of date).
// Source: VSOP87 by Bretagnon & Francou (1988), Bureau des Longitudes,
// extracted from the astronomia npm package by validation/extract-vsop.js.
// Terms kept where max contribution over 1800-2200 >= ${MIN_RAD} rad (L)
// / 1e-7 rad (R). Worst-case truncation in L: ${(totalDroppedL * 206264.8).toFixed(3)} arcsec.
// DO NOT EDIT BY HAND - regenerate with the extractor.
`;

const ser = (s) => {
  const arrs = Object.keys(s.kept).sort().map((p) => {
    if (s.kept[p].length === 0) return '  []';
    return '  [\n' + s.kept[p].map((t) => `    [${t[0]}, ${t[1]}, ${t[2]}]`).join(',\n') + ',\n  ]';
  });
  return '[\n' + arrs.join(',\n') + ',\n]';
};

const out = `${header}
const L = ${ser(L)};

const R = ${ser(R)};

module.exports = { L, R };
`;

const dest = path.join(__dirname, '..', 'vsop87d-earth.js');
fs.writeFileSync(dest, out);
console.log('wrote', dest);
