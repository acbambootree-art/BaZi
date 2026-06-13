'use strict';

// Replays every chart in validation/charts.json through the engine and
// asserts exact pillar agreement (plus luck pillars, ten gods and hidden
// stems where the row carries expectations).
//
// The expected values are oracle-derived (lunar-javascript / lunisolar /
// sxtwl) — never engine-derived. See validation/SOURCES.md.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const { computeChart } = require('..');
const dataset = require(path.join('..', 'validation', 'charts.json'));

const LUCK_AGE_TOLERANCE_YEARS = 0.1;

assert.ok(dataset.charts.length >= 200, `dataset must hold at least 200 charts, has ${dataset.charts.length}`);

for (const row of dataset.charts) {
  test(`[${row.category}] ${row.id}`, () => {
    const chart = computeChart({ ...row.input, options: row.options });

    assert.equal(chart.pillars.year.ganZhi, row.expected.year, 'year pillar');
    assert.equal(chart.pillars.month.ganZhi, row.expected.month, 'month pillar');
    assert.equal(chart.pillars.day.ganZhi, row.expected.day, 'day pillar');
    if (row.input.hour == null) {
      assert.equal(chart.pillars.hour, null, 'hour pillar must be null for unknown hour');
    } else {
      assert.equal(chart.pillars.hour.ganZhi, row.expected.hour, 'hour pillar');
    }

    // Day master is the day stem by definition.
    assert.equal(chart.dayMaster.zh, row.expected.day[0], 'day master');

    if (row.expected.luck) {
      assert.ok(chart.luckPillars, 'luck pillars expected');
      assert.equal(chart.luckPillars.direction, row.expected.luck.direction, 'luck direction');
      const ageDiff = Math.abs(chart.luckPillars.startAge.decimalYears - row.expected.luck.startAgeYears);
      assert.ok(ageDiff <= LUCK_AGE_TOLERANCE_YEARS,
        `luck start age: engine ${chart.luckPillars.startAge.decimalYears} vs oracle ${row.expected.luck.startAgeYears}`);
      const got = chart.luckPillars.pillars.slice(0, row.expected.luck.pillars.length).map((p) => p.ganZhi);
      assert.deepEqual(got, row.expected.luck.pillars, 'luck pillar sequence');
    }

    if (row.expected.tenGodsStems) {
      for (const key of ['year', 'month', 'hour']) {
        const want = row.expected.tenGodsStems[key];
        if (want == null) continue;
        assert.equal(chart.tenGods.stems[key].zh, want, `ten god of ${key} stem`);
      }
    }

    if (row.expected.hiddenStems) {
      for (const key of ['year', 'month', 'day', 'hour']) {
        const want = row.expected.hiddenStems[key];
        if (want == null) continue;
        const got = chart.pillars[key].hiddenStems.map((h) => h.zh);
        assert.deepEqual(got, want, `hidden stems of ${key} branch`);
      }
    }
  });
}
