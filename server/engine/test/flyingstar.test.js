'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const FS = require('../flyingstar');
const F = require('../fengshui');

test('period from construction year', () => {
  assert.equal(FS.periodOf(1975), 6);
  assert.equal(FS.periodOf(1990), 7);
  assert.equal(FS.periodOf(2010), 8);
  assert.equal(FS.periodOf(2024), 9);
  assert.equal(FS.periodOf(2043), 9);
});

test('Period 8 子山午向 is 雙星到向 with 8-8 at the facing', () => {
  const c = FS.chart(8, F.mountainFor(180).mountainIndex);
  assert.equal(c.facingDir, 'S'); assert.equal(c.sittingDir, 'N'); assert.equal(c.sub, 2);
  assert.deepEqual(c.palaces.S, { mountain: 8, water: 8, period: 3 });
  assert.deepEqual(c.palaces.N, { mountain: 9, water: 7, period: 4 });
  assert.equal(c.structure, 'double-facing');
});

test('Period 8 乾山巽向 is 旺山旺向', () => {
  const c = FS.chart(8, F.mountainFor(135).mountainIndex); // facing 巽 SE2
  assert.equal(c.palaces.SE.water, 8);
  assert.equal(c.palaces.NW.mountain, 8);
  assert.equal(c.structure, 'prosperous-mountain-prosperous-water');
});

test('Period 9 子山午向 is 雙星到坐 (9-9 at the sitting)', () => {
  const c = FS.chart(9, F.mountainFor(180).mountainIndex);
  assert.deepEqual(c.palaces.N, { mountain: 9, water: 9, period: 5 });
  assert.equal(c.structure, 'double-sitting');
});

test('all 24 facings × periods 6–9 produce complete 1–9 plates', () => {
  for (let p = 6; p <= 9; p++) for (let mi = 0; mi < 24; mi++) {
    const c = FS.chart(p, mi);
    for (const plate of ['mountain', 'water', 'period']) {
      const set = new Set(Object.values(c.palaces).map(x => x[plate]));
      assert.equal(set.size, 9, `period ${p} mountain ${mi} ${plate}`);
    }
  }
});

test('palace assessment: 2-5 is hard, 1-4 boosts a study, annual 5 stacks', () => {
  const bad = FS.assessPalace({ mountain: 2, water: 5, period: 3 }, 9, 5, 'bedroom');
  assert.equal(bad.verdict, 'poor');
  assert.ok(bad.why.includes('FS-25') && bad.why.includes('FS-ANNUAL-STACK'));
  assert.ok(bad.cures.some(c => c.element === 'metal'));
  const good = FS.assessPalace({ mountain: 1, water: 4, period: 7 }, 9, 8, 'study');
  assert.equal(good.verdict, 'good');
  assert.ok(good.why.includes('FS-14'));
  assert.equal(good.fit, 'good');
  const nine = FS.assessPalace({ mountain: 9, water: 9, period: 5 }, 9, 6, 'living');
  assert.equal(nine.verdict, 'good');
  assert.equal(nine.mountainStar.timeliness, 'current');
});
