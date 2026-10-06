'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildMessages } = require('../../services/luopanNarrative');

test('chat history window keeps the last turns and starts with a user turn', () => {
  const h = [];
  for (let i = 0; i < 10; i++) h.push({ role: i % 2 ? 'assistant' : 'user', content: 'm' + i });
  const m = buildMessages(h, 5);          // last 5 start with an assistant turn -> dropped
  assert.equal(m.length, 4);
  assert.equal(m[0].role, 'user');
  assert.equal(m[m.length - 1].role, 'assistant');
  assert.deepEqual(buildMessages([], 5), []);
  assert.deepEqual(buildMessages([{ role: 'assistant', content: 'x' }], 5), []);
});
