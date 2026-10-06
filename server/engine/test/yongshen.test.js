'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Y = require('../yongshen');
const T = require('../tables');
const { computeChart } = require('..');

// Build a pillar from stem/branch indices the way index.js does.
function P(stemIdx, branchIdx) {
  return {
    stem: { index: stemIdx, zh: T.STEMS[stemIdx].zh, element: T.STEMS[stemIdx].element },
    branch: { index: branchIdx, zh: T.BRANCHES[branchIdx].zh, element: T.BRANCHES[branchIdx].element },
    hiddenStems: T.HIDDEN_STEMS[branchIdx].map(i => ({ index: i, element: T.STEMS[i].element })),
  };
}
// stems: 甲0 乙1 丙2 丁3 戊4 己5 庚6 辛7 壬8 癸9; branches: 子0 丑1 寅2 卯3 辰4 巳5 午6 未7 申8 酉9 戌10 亥11

test('甲 born in 寅 month with wood everywhere is strong: drain with Fire', () => {
  const r = Y.analyse({ year: P(0, 2), month: P(2, 2), day: P(0, 3), hour: P(1, 11) }); // 甲寅 丙寅 甲卯 乙亥
  assert.ok(r.strength.ratio > 0.1, `ratio ${r.strength.ratio}`);
  assert.equal(r.yongShen, 'fire');     // 食伤 drains a 比劫-heavy day master
  assert.ok(r.jiShen.includes('wood') && r.jiShen.includes('water'));
  assert.ok(r.directions.favourable.includes('S'));
});

test('甲 born in 子 month with no fire at all: 调候 override to Fire', () => {
  const r = Y.analyse({ year: P(4, 0), month: P(0, 0), day: P(0, 4), hour: P(9, 9) }); // 戊子 甲子 甲辰 癸酉
  assert.equal(r.tiaoHou, 'fire');
  assert.equal(r.yongShen, 'fire');
  assert.equal(r.method, 'tiaohou');
});

test('weak 丙 fire buried under metal and water: 用神 is Resource (Wood)', () => {
  const r = Y.analyse({ year: P(8, 8), month: P(6, 10), day: P(2, 0), hour: P(9, 5) }); // 壬申 庚戌 丙子 癸巳 (rooted in 巳)
  assert.ok(r.strength.ratio < -0.1, `ratio ${r.strength.ratio}`);
  assert.equal(r.yongShen, 'wood');
  assert.equal(r.xiShen, 'fire');
  assert.ok(r.jiShen.includes('water') || r.jiShen.includes('metal'));
  assert.ok(r.directions.favourable.includes('E'));
});

test('water-flooded 甲 in winter follows the strong side, with Fire as 喜神 for warmth', () => {
  const r = Y.analyse({ year: P(8, 0), month: P(4, 0), day: P(0, 0), hour: P(9, 11) }); // 壬子 戊子 甲子 癸亥
  assert.equal(r.method, 'cong-qiang');
  assert.equal(r.yongShen, 'wood');
  assert.equal(r.xiShen, 'fire');
});

test('follow-weak (從弱) when the day master has no root at all', () => {
  const r = Y.analyse({ year: P(6, 9), month: P(7, 9), day: P(0, 8), hour: P(6, 8) }); // 庚酉 辛酉 甲申 庚申
  assert.equal(r.method, 'cong-ruo');
  assert.equal(r.yongShen, 'metal');
  assert.ok(r.jiShen.includes('wood'));
});

test('weak 戊 born in 巳 (season start) keeps Resource Fire as 用神; water is only 喜神', () => {
  const chart = computeChart({ year: 1975, month: 6, day: 1, hour: null, timeZone: 'Asia/Singapore', gender: 'male' }); // 乙卯 辛巳 戊寅
  const r = Y.analyse(chart.pillars);
  assert.equal(r.yongShen, 'fire');
  assert.equal(r.xiShen, 'water');
  assert.equal(r.tiaoHou, 'water');
});

test('month-branch clash halves the month weight', () => {
  const a = Y.analyse({ year: P(0, 2), month: P(2, 2), day: P(0, 3), hour: P(1, 11) });
  const b = Y.analyse({ year: P(0, 8), month: P(2, 2), day: P(0, 3), hour: P(1, 11) }); // 申 clashes 寅
  assert.ok(b.strength.same < a.strength.same);
});

test('runs on a real chart from the engine and maps to directions', () => {
  const chart = computeChart({ year: 1975, month: 6, day: 1, hour: 10, minute: 0, timeZone: 'Asia/Singapore', gender: 'male' });
  const r = Y.analyse(chart.pillars);
  assert.ok(['high', 'medium', 'low'].includes(r.confidence));
  assert.ok(r.directions.favourable.length >= 1);
  assert.equal(Y.elementOfDirection('N'), 'water');
  assert.equal(Y.elementOfDirection('SW'), 'earth');
});
