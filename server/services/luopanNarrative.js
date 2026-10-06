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
- Address the client by name in the opening line. Keep each room's text to 2–5 sentences. Whole report 500–900 words.
- "classicalPassages" are numbered excerpts from classical texts and practitioner notes retrieved for this audit. When one genuinely supports a statement, mark it inline as [n] and list it in "citations". Cite only passages given; never invent a source. Passages of type "note" are modern commentary, say so if you lean on them.`;

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
    citations: { type: 'array', items: { type: 'object', properties: { n: { type: 'integer' }, usedFor: { type: 'string' } }, required: ['n', 'usedFor'], additionalProperties: false }, description: 'Passages actually cited with [n] in the text' },
  },
  required: ['title', 'summary', 'priorities', 'rooms', 'household', 'closing', 'citations'],
  additionalProperties: false,
};

function isConfigured() { return !!process.env.ANTHROPIC_API_KEY; }

/**
 * @returns {{narrative: object, model: string}|null}
 */
async function generateNarrative({ clientName, address, houseType }, report, passages = []) {
  const c = getClient();
  if (!c) return null;

  const classicalPassages = passages.map((p, i) => ({ n: i + 1, source: p.source, section: p.section, type: p.type, text: p.text }));
  const payload = { clientName, address, houseType, audit: report, classicalPassages };
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
  const cited = new Set((narrative.citations || []).map(x => String(x.n)));
  const foreign = mentioned.filter(n => !allowed.has(n) && !cited.has(n) && Number(n) > classicalPassages.length);
  if (foreign.length) narrative.flags = [`Numbers not in the audit: ${[...new Set(foreign)].join(', ')} — check before sending.`];
  narrative.citations = (narrative.citations || []).filter(x => classicalPassages[x.n - 1]).map(x => ({ ...x, ...classicalPassages[x.n - 1] }));

  return { narrative, model: response.model || MODEL };
}

const ASK_SYSTEM = `You are the senior feng shui consultant behind Smart Luopan, answering a junior consultant's question about one specific house audit. You receive the audit as verified JSON plus numbered classical passages retrieved for the question.

Answer in plain English, 80–200 words, teaching the reasoning. Use ONLY facts in the audit; do not recompute stars, bearings or gua. Cite passages inline as [n] only when they genuinely support the point; never invent sources; say when a passage is a modern note rather than a classical text. If the audit does not contain what is needed to answer, say so and name what reading or input would settle it. Never predict illness, death or specific money outcomes.`;

const ASK_SCHEMA = {
  type: 'object',
  properties: {
    answer: { type: 'string' },
    citations: { type: 'array', items: { type: 'object', properties: { n: { type: 'integer' }, usedFor: { type: 'string' } }, required: ['n', 'usedFor'], additionalProperties: false } },
  },
  required: ['answer', 'citations'], additionalProperties: false,
};

async function ask(question, report, passages = []) {
  const c = getClient();
  if (!c) return null;
  const classicalPassages = passages.map((p, i) => ({ n: i + 1, source: p.source, section: p.section, type: p.type, text: p.text }));
  const response = await c.beta.messages.create({
    model: MODEL, max_tokens: 2000,
    betas: ['server-side-fallback-2026-06-01'], fallbacks: [{ model: FALLBACK }],
    system: ASK_SYSTEM,
    output_config: { format: { type: 'json_schema', schema: ASK_SCHEMA } },
    messages: [{ role: 'user', content: JSON.stringify({ question, audit: report, classicalPassages }) }],
  });
  if (response.stop_reason === 'refusal') throw new Error('The model declined this question');
  const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
  const out = JSON.parse(text);
  out.citations = (out.citations || []).filter(x => classicalPassages[x.n - 1]).map(x => ({ ...x, ...classicalPassages[x.n - 1] }));
  return { ...out, model: response.model || MODEL };
}

const CHAT_SYSTEM = `You are the senior feng shui consultant behind Smart Luopan, talking with a junior consultant who is standing in the client's home right now, phone in hand. The audit for this house is given as verified JSON after these instructions; numbered classical passages retrieved for the latest question follow in the user turn.

Style: short, practical, spoken-English answers (40–150 words). Answer the question first, then one line of reasoning. Suggest a concrete next step on site when useful (re-measure, check a wall, move the bed). Teach a little, never lecture.

Hard rules: use ONLY facts in the audit; never recompute stars, bearings, gua or favourable elements, and never invent a product or ritual. If the audit cannot answer, say what input or reading would settle it. Cite passages inline as [n] only when one genuinely supports the point; say when a passage is a modern note. Never predict illness, death or specific money outcomes. The house motto: "The stars incline, they do not compel."`;

/** Keep the last `limit` turns, always starting with a user turn, as plain-text API messages. */
function buildMessages(history, limit = 12) {
  let turns = history.slice(-limit);
  while (turns.length && turns[0].role !== 'user') turns = turns.slice(1);
  return turns.map(t => ({ role: t.role, content: t.content }));
}

/**
 * One chat turn. `history` is prior turns [{role, content}] (oldest first);
 * `message` is the new user message. Returns { answer, citations, model }.
 */
async function chat(message, history, report, passages = []) {
  const c = getClient();
  if (!c) return null;
  const classicalPassages = passages.map((p, i) => ({ n: i + 1, source: p.source, section: p.section, type: p.type, text: p.text }));
  const messages = buildMessages(history);
  messages.push({ role: 'user', content: JSON.stringify({ message, classicalPassages }) });
  const response = await c.beta.messages.create({
    model: MODEL, max_tokens: 1500,
    betas: ['server-side-fallback-2026-06-01'], fallbacks: [{ model: FALLBACK }],
    // Stable prefix (instructions + audit) cached across turns of the same consult.
    system: [
      { type: 'text', text: CHAT_SYSTEM },
      { type: 'text', text: 'AUDIT JSON:\n' + JSON.stringify(report), cache_control: { type: 'ephemeral' } },
    ],
    output_config: { format: { type: 'json_schema', schema: ASK_SCHEMA } },
    messages,
  });
  if (response.stop_reason === 'refusal') throw new Error('The model declined this question');
  const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
  const out = JSON.parse(text);
  out.citations = (out.citations || []).filter(x => classicalPassages[x.n - 1]).map(x => ({ ...x, ...classicalPassages[x.n - 1] }));
  return { ...out, model: response.model || MODEL };
}

module.exports = { isConfigured, generateNarrative, ask, chat, buildMessages };
