'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
process.env.DB_PATH = ':memory:';
const corpus = require('../../services/corpus');

test('corpus ingests seed files and retrieves by rule id and Chinese term', () => {
  const n = corpus.ensureIngested();
  assert.ok(n >= 30, `only ${n} passages`);
  const hits = corpus.search(['FS-25'], 3);
  assert.equal(hits[0].section, '二五交加');
  assert.equal(hits[0].type, 'quote');
  const q = corpus.termsForQuestion('Why is the five yellow bad for the 臥室?');
  assert.ok(q.includes('五黃') && q.includes('臥室'));
  assert.ok(corpus.search(q, 3).some(h => h.tags.includes('AF-5Y')));
  assert.deepEqual(corpus.search([''], 3), []);
});

test('termsForReport collects rule ids, structure and BaZi method', () => {
  const t = corpus.termsForReport({ rooms: [{ why: ['AF-5Y', 'FS-25'] }], notes: [{ id: 'EM-DOOR' }], flyingStar: { structure: 'double-facing', structureZh: '雙星到向' }, people: [{ bazi: { method: 'tiaohou' } }] });
  for (const x of ['AF-5Y', 'FS-25', 'EM-DOOR', 'double-facing', '雙星到向', 'BZ-RANK', '調候']) assert.ok(t.includes(x), x);
});
