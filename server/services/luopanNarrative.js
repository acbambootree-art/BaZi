'use strict';

// ============================================================
// Smart Luopan: client-facing narrative written by Claude from the
// engine's structured report. The model explains and prioritises; it
// never computes. Every number in its text must already exist in the
// report, which the caller checks before showing the narrative.
// ============================================================

const Anthropic = require('@anthropic-ai/sdk');

const MODEL = 'claude-opus-5-5';
const FALLBACK = 'claude-opus-4-8';

let client;
function getClient() {
  if (!client && process.env.ANTHROPIC_API_KEY) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

const SYSTEM = `You are the senior feng shui consultant behind Smart Luopan, writing the client-facing report for a home audit done by a junior consultant. You receive the audit as verified JSON: the measured facing, the Flying Star chart, annual afflictions, each household member's Life Gua and BaZi favourable elements, and every room's computed verdicts, warnings, cures and the rule ids that produced them.

Voice: calm, precise, kind. British/Singapore English. Explain the reasoning in plain words so the client understands why, teaching a little, but never lecture. The house motto applies: "The stars incline, they do not compel" — feng shui supports a life, it does not decide it. Never predict illness, death, accidents or specific money outcomes; speak of support and caution.

Hard rules:
- Use ONLY the facts in the JSON. Do not add stars, directions, bearings, dates, products or rituals that are not there. Do not recompute anything.
- Structural and placement fixes always come before any object or item. Items are described as element carriers, exactly as the JSON lists them.
- Lead with what matters most this year (the annual afflictions and any "hard" warnings), then the two or three highest-value changes, then room by room.
- Where the JSON says a reading is borderline or confidence is low, say so once, plainly.
- Address the client by name in the opening line. Keep each room's text to 2–5 sentences. Whole report 500–900 words.`;

const SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Short report title, at most 10 words' },
    summary: { type: 'string', description: 'Opening paragraph: the house in one view, 3–5 sentences' },
    priorities: { type: 'array', items: { type: 'string' }, description: 'The 3–5 most valuable actions, each one sentence, most important first' },
    rooms: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'string' }, name: { type: 'string' }, text: { type: 'string' } },
        required: ['id', 'name', 'text'], additionalProperties: false,
      },
    },
    household: { type: 'string', description: 'One paragraph on who should use which room and which directions suit each person' },
    closing: { type: 'string', description: 'Two or three sentences: what to re-check after 立春 next year and the limits of this audit' },
  },
  required: ['title', 'summary', 'priorities', 'rooms', 'household', 'closing'],
  additionalProperties: false,
};

function isConfigured() { return !!process.env.ANTHROPIC_API_KEY; }

/**
 * @returns {{narrative: object, model: string}|null}
 */
async function generateNarrative({ clientName, address, houseType }, report) {
  const c = getClient();
  if (!c) return null;

  const payload = { clientName, address, houseType, audit: report };
  const response = await c.beta.messages.create({
    model: MODEL,
    max_tokens: 8000,
    betas: ['server-side-fallback-2026-06-01'],
    fallbacks: [{ model: FALLBACK }],
    system: SYSTEM,
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content: JSON.stringify(payload) }],
  });
  if (response.stop_reason === 'refusal') throw new Error('Narrative generation was declined by the model');
  const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
  if (!text) throw new Error('Empty narrative generated');
  const narrative = JSON.parse(text);

  // Guardrail: every bearing or star number the model mentions must exist in the report.
  const allowed = new Set(JSON.stringify(report).match(/\d+(\.\d+)?/g) || []);
  const mentioned = JSON.stringify(narrative).match(/\d+(\.\d+)?/g) || [];
  const foreign = mentioned.filter(n => !allowed.has(n) && !['1', '2', '3', '4', '5'].includes(n));
  if (foreign.length) narrative.flags = [`Numbers not in the audit: ${[...new Set(foreign)].join(', ')} — check before sending.`];

  return { narrative, model: response.model || MODEL };
}

module.exports = { isConfigured, generateNarrative };
