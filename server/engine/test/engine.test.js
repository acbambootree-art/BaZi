'use strict';

// Unit tests for the engine's rule layer and astronomy, independent of
// the oracle-derived dataset (validation.test.js covers that).

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const { computeChart, DEFAULT_OPTIONS, _internal } = require('..');
const A = require('../astro');
const T = require('../tables');

// ---------------------------------------------------------------
// Classical derivation rules
// ---------------------------------------------------------------

test('五虎遁: month stem of the 寅 month for each year stem', () => {
  // 甲己之年丙作首, 乙庚之岁戊为头, 丙辛必定寻庚起, 丁壬壬位顺行流, 戊癸何方发, 甲寅之上好追求.
  const firstMonthStem = { 0: 2, 5: 2, 1: 4, 6: 4, 2: 6, 7: 6, 3: 8, 8: 8, 4: 0, 9: 0 };
  for (const [yearStem, want] of Object.entries(firstMonthStem)) {
    const got = ((Number(yearStem) % 5) * 2 + 2) % 10;
    assert.equal(got, want, `year stem ${T.STEMS[yearStem].zh}`);
  }
});

test('五鼠遁: zi-hour stem for each day stem', () => {
  // 甲己还加甲, 乙庚丙作初, 丙辛从戊起, 丁壬庚子居, 戊癸起壬子.
  const ziStem = { 0: 0, 5: 0, 1: 2, 6: 2, 2: 4, 7: 4, 3: 6, 8: 6, 4: 8, 9: 8 };
  for (const [dayStem, want] of Object.entries(ziStem)) {
    const got = ((Number(dayStem) % 5) * 2) % 10;
    assert.equal(got, want, `day stem ${T.STEMS[dayStem].zh}`);
  }
});

test('ten gods: complete and self-consistent for every day master', () => {
  for (let dm = 0; dm < 10; dm++) {
    assert.equal(T.tenGod(dm, dm), '比肩', 'same stem is always 比肩');
    const gods = new Set();
    for (let other = 0; other < 10; other++) gods.add(T.tenGod(dm, other));
    assert.equal(gods.size, 10, `day master ${T.STEMS[dm].zh} must map the 10 stems onto all 10 gods`);
  }
});

test('ten gods: textbook spot checks for 甲 day master', () => {
  const zh = (i) => T.tenGod(0, i);
  assert.equal(zh(1), '劫财'); // 乙
  assert.equal(zh(2), '食神'); // 丙
  assert.equal(zh(3), '伤官'); // 丁
  assert.equal(zh(4), '偏财'); // 戊
  assert.equal(zh(5), '正财'); // 己
  assert.equal(zh(6), '七杀'); // 庚
  assert.equal(zh(7), '正官'); // 辛
  assert.equal(zh(8), '偏印'); // 壬
  assert.equal(zh(9), '正印'); // 癸
});

test('hidden stems: main qi element equals the branch element', () => {
  for (let b = 0; b < 12; b++) {
    const main = T.HIDDEN_STEMS[b][0];
    assert.equal(T.STEMS[main].element, T.BRANCHES[b].element, `branch ${T.BRANCHES[b].zh}`);
  }
});

test('sexagenary cycle: 60 unique stem-branch pairs, 甲子 at 0', () => {
  assert.equal(T.ganZhi(0), '甲子');
  assert.equal(T.ganZhi(59), '癸亥');
  const seen = new Set();
  for (let i = 0; i < 60; i++) seen.add(T.ganZhi(i));
  assert.equal(seen.size, 60);
});

// ---------------------------------------------------------------
// Astronomy: term instants pinned to an independent ephemeris
// ---------------------------------------------------------------

test('solar-term instants match sxtwl sample to within 90 seconds', () => {
  const sample = require(path.join('..', 'validation', 'term-instants-sample.json'));
  const TOL_DAYS = 90 / 86400;
  let checked = 0;
  for (const [year, instants] of Object.entries(sample.years)) {
    const sampleJds = instants.map((iso) => {
      const d = new Date(iso);
      return A.jdAtMidnight(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
        + (d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds()) / 86400;
    });
    for (let k = 0; k < 12; k++) {
      const engineJd = A.jieInstantUtc(Number(year), k);
      const best = Math.min(...sampleJds.map((jd) => Math.abs(jd - engineJd)));
      assert.ok(best < TOL_DAYS,
        `${year} jie #${k}: engine differs from sxtwl by ${(best * 86400).toFixed(0)}s`);
      checked++;
    }
  }
  assert.ok(checked >= 12 * 10, `checked ${checked} term instants`);
});

test('solar terms are strictly ordered and ~year-periodic', () => {
  for (const y of [1900, 2000, 2100]) {
    // Within a calendar year the jie sequence 立春..大雪 (k=0..10) is ordered;
    // 小寒 (k=11) belongs to the following January.
    let prev = -Infinity;
    for (let k = 0; k <= 10; k++) {
      const jd = A.jieInstantUtc(y, k);
      assert.ok(jd > prev, `${y} jie #${k} out of order`);
      prev = jd;
    }
    assert.ok(A.jieInstantUtc(y, 11) < A.jieInstantUtc(y, 0), '小寒 of a year precedes its 立春');
    // 立春 spacing between consecutive years ~365.24 days.
    const a = A.jieInstantUtc(y, 0);
    const b = A.jieInstantUtc(y + 1, 0);
    assert.ok(Math.abs(b - a - 365.2422) < 0.05, `立春 spacing ${y}: ${(b - a).toFixed(4)}`);
  }
});

// ---------------------------------------------------------------
// Convention flags
// ---------------------------------------------------------------

const BASE = { year: 1990, month: 6, day: 15, utcOffsetMinutes: 480, gender: 'male' };

test('zi-hour 23:30: rollover advances the day pillar, split keeps it', () => {
  const roll = computeChart({ ...BASE, hour: 23, minute: 30, options: { ziHourMode: 'rollover' } });
  const split = computeChart({ ...BASE, hour: 23, minute: 30, options: { ziHourMode: 'split' } });
  const next = computeChart({ ...BASE, day: 16, hour: 1, minute: 0 });
  const same = computeChart({ ...BASE, hour: 12, minute: 0 });

  assert.equal(roll.pillars.day.ganZhi, next.pillars.day.ganZhi, 'rollover: next civil day pillar');
  assert.equal(split.pillars.day.ganZhi, same.pillars.day.ganZhi, 'split: current civil day pillar');
  // Both schools agree the late-zi hour STEM comes from the next day's sequence.
  assert.equal(roll.pillars.hour.ganZhi, split.pillars.hour.ganZhi, 'hour pillar identical in both modes');
  assert.equal(roll.pillars.hour.branch.zh, '子');
});

test('early zi (00:30) is identical in both modes', () => {
  const roll = computeChart({ ...BASE, hour: 0, minute: 30, options: { ziHourMode: 'rollover' } });
  const split = computeChart({ ...BASE, hour: 0, minute: 30, options: { ziHourMode: 'split' } });
  assert.equal(roll.pillars.day.ganZhi, split.pillars.day.ganZhi);
  assert.equal(roll.pillars.hour.ganZhi, split.pillars.hour.ganZhi);
});

test('true solar time: Urumqi clock noon is mid-morning sun time', () => {
  const clock = computeChart({ year: 2006, month: 3, day: 14, hour: 13, minute: 0, utcOffsetMinutes: 480, longitude: 87.62 });
  const tst = computeChart({
    year: 2006, month: 3, day: 14, hour: 13, minute: 0, utcOffsetMinutes: 480, longitude: 87.62,
    options: { trueSolarTime: true },
  });
  // (87.62 - 120) * 4 = -129.5 minutes: 13:00 clock -> ~10:50 true solar.
  assert.equal(tst.time.corrections.longitudeMinutes, -129.52);
  assert.equal(clock.pillars.hour.branch.zh, '未'); // 13:00
  assert.equal(tst.pillars.hour.branch.zh, '巳');   // ~10:50
  // Year/month pillars must NOT be affected by the correction.
  assert.equal(tst.pillars.year.ganZhi, clock.pillars.year.ganZhi);
  assert.equal(tst.pillars.month.ganZhi, clock.pillars.month.ganZhi);
});

test('true solar time can roll the day pillar back across midnight', () => {
  const clock = computeChart({ year: 1992, month: 10, day: 8, hour: 0, minute: 40, utcOffsetMinutes: 480, longitude: 87.62 });
  const tst = computeChart({
    year: 1992, month: 10, day: 8, hour: 0, minute: 40, utcOffsetMinutes: 480, longitude: 87.62,
    options: { trueSolarTime: true },
  });
  // 00:40 clock - 129.5 min -> ~22:30 the previous evening.
  assert.notEqual(tst.pillars.day.ganZhi, clock.pillars.day.ganZhi);
  assert.equal(tst.pillars.hour.branch.zh, '亥');
});

test('equation of time flag adds a sub-17-minute correction', () => {
  const c = computeChart({
    ...BASE, hour: 12, minute: 0, longitude: 120,
    options: { trueSolarTime: true, equationOfTime: true },
  });
  assert.ok(Math.abs(c.time.corrections.equationOfTimeMinutes) < 17);
  assert.notEqual(c.time.corrections.equationOfTimeMinutes, 0);
});

test('date line: same instant, different zones -> same year/month, different day', () => {
  // 1995-06-10T01:30Z = Kiritimati (UTC+14) 15:30 Jun 10 / Honolulu (UTC-10) 15:30 Jun 9.
  const east = computeChart({ year: 1995, month: 6, day: 10, hour: 15, minute: 30, timeZone: 'Pacific/Kiritimati' });
  const west = computeChart({ year: 1995, month: 6, day: 9, hour: 15, minute: 30, timeZone: 'Pacific/Honolulu' });
  assert.equal(east.time.birthUtc, west.time.birthUtc, 'same absolute instant');
  assert.equal(east.pillars.year.ganZhi, west.pillars.year.ganZhi);
  assert.equal(east.pillars.month.ganZhi, west.pillars.month.ganZhi);
  assert.notEqual(east.pillars.day.ganZhi, west.pillars.day.ganZhi, 'day pillars differ across the date line');
});

test('timeZone and equivalent utcOffsetMinutes agree (post-1982 Singapore)', () => {
  const a = computeChart({ year: 1990, month: 6, day: 15, hour: 14, minute: 30, timeZone: 'Asia/Singapore' });
  const b = computeChart({ year: 1990, month: 6, day: 15, hour: 14, minute: 30, utcOffsetMinutes: 480 });
  assert.deepEqual(
    [a.pillars.year.ganZhi, a.pillars.month.ganZhi, a.pillars.day.ganZhi, a.pillars.hour.ganZhi],
    [b.pillars.year.ganZhi, b.pillars.month.ganZhi, b.pillars.day.ganZhi, b.pillars.hour.ganZhi],
  );
});

// ---------------------------------------------------------------
// Luck pillars
// ---------------------------------------------------------------

test('luck direction: yang-year male / yin-year female run forward', () => {
  // 1990 = 庚午 (yang stem); 1991 = 辛未 (yin stem).
  const yangMale = computeChart({ ...BASE, hour: 10, gender: 'male' });
  const yangFemale = computeChart({ ...BASE, hour: 10, gender: 'female' });
  const yinMale = computeChart({ ...BASE, year: 1991, hour: 10, gender: 'male' });
  const yinFemale = computeChart({ ...BASE, year: 1991, hour: 10, gender: 'female' });
  assert.equal(yangMale.luckPillars.direction, 'forward');
  assert.equal(yangFemale.luckPillars.direction, 'backward');
  assert.equal(yinMale.luckPillars.direction, 'backward');
  assert.equal(yinFemale.luckPillars.direction, 'forward');
});

test('luck pillars walk the sexagenary cycle from the month pillar', () => {
  const c = computeChart({ ...BASE, hour: 10 });
  const monthIdx = c.pillars.month.sexagenaryIndex;
  c.luckPillars.pillars.forEach((p, i) => {
    assert.equal(p.sexagenaryIndex, (monthIdx + i + 1) % 60);
    assert.ok(Math.abs(p.ageEnd - p.ageStart - 10) < 1e-9);
  });
  assert.equal(c.luckPillars.pillars.length, DEFAULT_OPTIONS.luckPillarCount);
});

test('luck start age: 3 days = 1 year exactly', () => {
  const c = computeChart({ ...BASE, hour: 10 });
  const next = new Date(c.solarTerms.nextTerm.utc).getTime();
  const birth = new Date(c.time.birthUtc).getTime();
  const days = (next - birth) / 86400000;
  assert.ok(Math.abs(c.luckPillars.startAge.decimalYears - days / 3) < 0.01);
});

test('no gender -> no luck pillars', () => {
  const c = computeChart({ year: 1990, month: 6, day: 15, hour: 10, utcOffsetMinutes: 480 });
  assert.equal(c.luckPillars, null);
});

// ---------------------------------------------------------------
// Output shape, warnings, validation
// ---------------------------------------------------------------

test('unknown hour: hour pillar null, others present', () => {
  const c = computeChart({ year: 1990, month: 6, day: 15, hour: null, utcOffsetMinutes: 480, gender: 'male' });
  assert.equal(c.pillars.hour, null);
  assert.equal(c.tenGods.stems.hour, null);
  assert.ok(c.pillars.day.ganZhi);
  assert.ok(c.luckPillars);
  assert.equal(c.fiveElements.visible.wood + c.fiveElements.visible.fire + c.fiveElements.visible.earth
    + c.fiveElements.visible.metal + c.fiveElements.visible.water, 6, '6 visible characters without hour');
});

test('five element counts: 8 visible characters with hour known', () => {
  const c = computeChart({ ...BASE, hour: 10 });
  const total = Object.values(c.fiveElements.visible).reduce((s, v) => s + v, 0);
  assert.equal(total, 8);
});

test('warning emitted within 30 minutes of a solar term', () => {
  // 立春 2000: 2000-02-04 20:40:23 CST.
  const c = computeChart({ year: 2000, month: 2, day: 4, hour: 20, minute: 50, utcOffsetMinutes: 480 });
  assert.ok(c.warnings.some((w) => w.code === 'solar-term-boundary'));
  const far = computeChart({ year: 2000, month: 6, day: 15, hour: 12, utcOffsetMinutes: 480 });
  assert.ok(!far.warnings.some((w) => w.code === 'solar-term-boundary'));
});

test('stable API: top-level output shape', () => {
  const c = computeChart({ ...BASE, hour: 10 });
  assert.deepEqual(Object.keys(c).sort(), [
    'dayMaster', 'engineVersion', 'fiveElements', 'input', 'luckPillars',
    'options', 'pillars', 'solarTerms', 'tenGods', 'time', 'warnings',
  ]);
  for (const key of ['year', 'month', 'day', 'hour']) {
    const p = c.pillars[key];
    assert.deepEqual(Object.keys(p).sort(), ['branch', 'ganZhi', 'hiddenStems', 'naYin', 'sexagenaryIndex', 'stem']);
  }
});

test('input validation rejects bad values', () => {
  assert.throws(() => computeChart({ year: 1600, month: 1, day: 1, utcOffsetMinutes: 480 }), RangeError);
  assert.throws(() => computeChart({ year: 1990, month: 13, day: 1, utcOffsetMinutes: 480 }), RangeError);
  assert.throws(() => computeChart({ year: 1990, month: 2, day: 30, utcOffsetMinutes: 480 }), RangeError);
  assert.throws(() => computeChart({ year: 1990, month: 6, day: 15, hour: 24, utcOffsetMinutes: 480 }), RangeError);
  assert.throws(() => computeChart({ year: 1990, month: 6, day: 15, hour: 10 }), TypeError, 'missing zone');
  assert.throws(() => computeChart({ year: 1990, month: 6, day: 15, hour: 10, utcOffsetMinutes: 480, gender: 'x' }), TypeError);
  assert.throws(() => computeChart({ year: 1990, month: 6, day: 15, hour: 10, utcOffsetMinutes: 480, options: { trueSolarTime: true } }), TypeError, 'TST without longitude');
  assert.throws(() => computeChart({ year: 1990, month: 6, day: 15, hour: 10, utcOffsetMinutes: 480, options: { ziHourMode: 'bogus' } }), TypeError);
});

test('day pillar anchor: 1949-10-01 is 甲子', () => {
  const c = computeChart({ year: 1949, month: 10, day: 1, hour: 12, utcOffsetMinutes: 480 });
  assert.equal(c.pillars.day.ganZhi, '甲子');
});

test('leap month has no effect: pillars continuous across 闰四月 2020', () => {
  // 2020 lunar 四月 ended Jun 20; 闰四月 ran Jun 21 - Jul 20. No jie term
  // falls between Jun 21 and Jul 5 (小暑 was Jul 6), so the month pillar
  // must be identical on both sides of the leap-month start.
  const before = computeChart({ year: 2020, month: 6, day: 20, hour: 12, utcOffsetMinutes: 480 });
  const inside = computeChart({ year: 2020, month: 6, day: 22, hour: 12, utcOffsetMinutes: 480 });
  assert.equal(before.pillars.month.ganZhi, inside.pillars.month.ganZhi);
  assert.equal(before.pillars.year.ganZhi, inside.pillars.year.ganZhi);
});
