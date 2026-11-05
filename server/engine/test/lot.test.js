'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { computeLotFacts } = require('../../services/facts');

test('a fortune lot is read against the chart: ten god, elements, relations, stable key', () => {
  const input = { birthYear: 1990, birthMonth: 6, birthDay: 15, hourBranch: 6, gender: 'female' };
  const f = computeLotFacts(input, { n: 1, gz: '甲子' });
  assert.equal(f.lot.stem.zh, '甲');
  assert.equal(f.lot.branch.animal, 'Rat');
  assert.ok(f.tenGod.en, 'lot stem has a ten god toward the day master');
  assert.ok(['in tune', 'mixed', 'testing'].includes(f.resonance));
  assert.match(f.key, /^lot1\|n1\|dm\d\|s\d\|r[DY-][dy-][S-]$/);
  // the same chart and lot always give the same key; another lot gives another
  assert.equal(computeLotFacts(input, { n: 1, gz: '甲子' }).key, f.key);
  assert.notEqual(computeLotFacts(input, { n: 2, gz: '乙丑' }).key, f.key);
  // a lot whose branch clashes the day branch is flagged and lowers the score
  const dayBr = '子丑寅卯辰巳午未申酉戌亥';
  const natal = require('../../services/facts').computeNatalChart(input).pillars.day.branch.index;
  const clashBranch = dayBr[(natal + 6) % 12];
  const c = computeLotFacts(input, { n: 99, gz: '甲' + clashBranch });
  assert.ok(c.relations.dayClash);
  assert.throws(() => computeLotFacts(input, { n: 1, gz: 'XX' }));
});
