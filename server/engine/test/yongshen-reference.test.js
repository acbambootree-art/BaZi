'use strict';

// Regression floor for the 用神 engine against the classical reference sets.
// These are floors, not targets: see docs/smart-luopan-rulebook.md B5 for the measured numbers.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { check } = require('../validation/yongshen-check');

test('滴天髓闡微 machine-labelled set: agreement and strength-sign floors', () => {
  const out = check(require(path.join(__dirname, '..', 'validation', 'yongshen-dtscw.json')));
  assert.ok(out.n >= 40, `only ${out.n} rows`);
  assert.ok(out.rate >= 0.40, `agreement ${out.rate}`);
  assert.ok(out.strengthRate >= 0.60, `strength sign ${out.strengthRate}`);
});

test('神峰通考 hand-labelled set: agreement floor', () => {
  const out = check(require(path.join(__dirname, '..', 'validation', 'yongshen.json')));
  assert.ok(out.n >= 60, `only ${out.n} rows`);
  assert.ok(out.rate >= 0.50, `agreement ${out.rate}`);
});
