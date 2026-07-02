'use strict';

// ============================================================
// Anthropic API wrappers.
//
// Two generators:
//   - generateDailyForecast: Haiku 4.5, structured JSON, one call per
//     interpretation key per day (cached by the forecast route).
//   - generateDecisionReading: Opus 4.8, bespoke per paid order.
//
// Both return null when no ANTHROPIC_API_KEY is configured so callers
// can fall back to template copy.
// ============================================================

const Anthropic = require('@anthropic-ai/sdk');

const DAILY_MODEL = 'claude-haiku-4-5';
const READING_MODEL = 'claude-opus-4-8';

let client;
function getClient() {
  if (!client && process.env.ANTHROPIC_API_KEY) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

function isConfigured() {
  return !!process.env.ANTHROPIC_API_KEY;
}

function firstText(response) {
  const block = response.content.find(b => b.type === 'text');
  return block ? block.text : '';
}

// ─── Daily forecast (Haiku, cached per key) ─────────────────

const DAILY_SYSTEM = `You write the "Today for You" daily guidance card for Purpose-Star Astrology, a BaZi (Four Pillars) site. You receive the day's verified chart facts as JSON and write short, grounded guidance.

Voice: warm, plain-spoken, practical — a wise friend who knows BaZi, not a mystic. British/Singapore English. The site's motto is "The stars incline, they do not compel": frame everything as tendencies and smart timing, never as fixed fate, and never predict specific events, health outcomes, or financial results.

Rules:
- Use ONLY the facts provided. Never invent pillars, elements, ten gods, or relations.
- Weave in the concrete BaZi facts naturally (element names, the ten god of the day, clash/combination branches with their Chinese characters) so the reading feels tied to this exact chart.
- "lean" = what today's qi supports doing (2 sentences max). "care" = what to watch for (2 sentences max). "headline" = one short phrase capturing the day's theme.
- If a personal clash (day-branch clash) is present, the care line must lead with it: keep plans flexible, avoid locking major commitments.
- If a six-combination harmony is present, the lean line should mention that cooperation and agreements flow well.
- Match the tone of the rating: Favorable = confident, Steady = even-keeled, "Handle with care" = calm and steadying, never alarming.`;

const DAILY_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string', description: "The day's theme in at most 8 words" },
    lean: { type: 'string', description: 'What to lean into today, 1-2 sentences' },
    care: { type: 'string', description: 'What to take care with today, 1-2 sentences' },
  },
  required: ['headline', 'lean', 'care'],
  additionalProperties: false,
};

/**
 * Generate the daily forecast copy for one interpretation key.
 * `facts` is the payload from facts.computeDailyFacts (chart object excluded).
 * Returns { headline, lean, care } or null when unconfigured.
 */
async function generateDailyForecast(facts) {
  const c = getClient();
  if (!c) return null;

  const payload = {
    date: facts.date,
    rating: facts.rating,
    todayPillar: {
      ganZhi: facts.today.ganZhi,
      stem: `${facts.today.stem.zh} ${facts.today.stem.polarity} ${facts.today.stem.element}`,
      branch: `${facts.today.branch.zh} ${facts.today.branch.element} (${facts.today.branch.animal})`,
      tenGodTowardThisChart: `${facts.today.tenGod.zh} ${facts.today.tenGod.en}`,
    },
    dayMaster: {
      stem: `${facts.dayMaster.stem.zh} ${facts.dayMaster.stem.polarity} ${facts.dayMaster.stem.element}`,
      strength: facts.dayMaster.strength,
      favorableElements: facts.dayMaster.favorable,
      unfavorableElements: facts.dayMaster.unfavorable,
    },
    relations: {
      personalClash: facts.relations.personalClash
        ? `Today's branch ${facts.today.branch.zh} clashes the natal day branch ${facts.natal.dayBranch.zh} (相冲)` : null,
      zodiacClash: facts.relations.zodiacClash
        ? `Today's branch ${facts.today.branch.zh} clashes the natal year branch ${facts.natal.yearBranch.zh} — the classic clash-zodiac day for the ${facts.natal.yearBranch.animal}` : null,
      harmony: facts.relations.harmony
        ? `Today's branch ${facts.today.branch.zh} combines with the natal day branch ${facts.natal.dayBranch.zh} (六合)` : null,
    },
    annualYear: {
      ganZhi: facts.annual.ganZhi,
      tenGodTowardThisChart: `${facts.annual.tenGod.zh} ${facts.annual.tenGod.en}`,
    },
    luckDecade: facts.luck ? {
      ganZhi: facts.luck.ganZhi,
      tenGodTowardThisChart: `${facts.luck.tenGod.zh} ${facts.luck.tenGod.en}`,
      position: `${facts.luck.position} portion of the 10-year luck pillar`,
    } : null,
  };

  const response = await c.messages.create({
    model: DAILY_MODEL,
    max_tokens: 1024,
    system: DAILY_SYSTEM,
    output_config: { format: { type: 'json_schema', schema: DAILY_SCHEMA } },
    messages: [{ role: 'user', content: JSON.stringify(payload) }],
  });

  const parsed = JSON.parse(firstText(response));
  return {
    headline: String(parsed.headline || '').slice(0, 120),
    lean: String(parsed.lean || ''),
    care: String(parsed.care || ''),
    model: DAILY_MODEL,
  };
}

// ─── Decision Reading (Opus, per paid order) ────────────────

const READING_SYSTEM = `You are the reader behind Purpose-Star Astrology's Focused Decision Reading — a paid, one-question written BaZi consultation (S$48). A customer has asked one real question about a decision; you answer it against their full Four Pillars chart, which is provided as verified JSON facts.

Voice: an experienced, kind BaZi consultant. Direct and specific, never hedging everything into mush, but honest about uncertainty. The house motto is "The stars incline, they do not compel" — the chart shows tendencies and timing, the person decides. Never predict specific dates of death/illness, guaranteed money outcomes, or third parties' private behavior. No medical, legal, or licensed-financial advice; where the question brushes those, note that a professional should confirm the practical side.

Structure the report with these markdown "## " section headings:
## Your Question, Read Against Your Chart — restate what they're really deciding, then the short answer up front.
## What Your Chart Shows — the 2-4 chart features that actually bear on this question (day master strength, the relevant ten gods, favorable elements). Explain each in plain language; teach a little.
## Timing — what the current luck pillar and this year's pillar suggest about acting now vs later. Be concrete about which windows are supportive.
## Our Guidance — a clear recommendation with the reasoning, plus one or two practical actions aligned with their favorable elements.

Length: 600-1,000 words total (per language if bilingual).
Language: follow the "language" field — "en" = English only; "zh" = Simplified Chinese only; "both" = full English report first, then a horizontal rule (---), then the full Chinese version (not a translation note — a complete report in Chinese).

Use ONLY the chart facts provided. If the birth hour is unknown, acknowledge once that the hour pillar is unavailable and slightly widens the uncertainty, then work with the three pillars you have. Address the customer by name, warmly, in the opening line.`;

/**
 * Generate a Decision Reading. Returns { text, model } (markdown-ish text
 * with ## headings) or null when unconfigured.
 */
async function generateDecisionReading({ name, question, language }, readingFacts) {
  const c = getClient();
  if (!c) return null;

  const payload = {
    customerName: name,
    question,
    language: language || 'both',
    todayDate: readingFacts.today || undefined,
    chartFacts: readingFacts,
  };

  const response = await c.messages.create({
    model: READING_MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    system: READING_SYSTEM,
    messages: [{ role: 'user', content: JSON.stringify(payload) }],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('Reading generation was declined by the model');
  }
  const text = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n')
    .trim();
  if (!text) throw new Error('Empty reading generated');
  return { text, model: READING_MODEL };
}

module.exports = { isConfigured, generateDailyForecast, generateDecisionReading };
