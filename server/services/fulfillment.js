'use strict';

// ============================================================
// Automated Decision Reading fulfillment.
//
// Triggered when an order's payment is verified (Stripe webhook, or the
// admin marking a PayNow order as paid). Generates the written reading
// with Opus from the engine's chart facts + the customer's question,
// emails it to the customer (owner BCC'd for spot-checking), and
// archives the text on the order row.
//
// Never fulfills unverified payments: the caller only invokes this for
// payment_status = 'paid'. If birth data is missing or generation fails,
// the owner is notified to fulfill manually — an order is never left
// silently unhandled.
// ============================================================

const { getDb } = require('../db/init');
const facts = require('./facts');
const llm = require('./llm');
const { sendReadingDelivery, sendFulfillmentAlert } = require('./email');

function sgToday() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

// Minimal markdown-to-HTML for the model's output: ## headings, ---, **bold**,
// blank-line paragraphs. Input is escaped before any tags are introduced.
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function readingToHtml(text) {
  const blocks = esc(text).split(/\n{2,}/);
  return blocks.map(block => {
    const b = block.trim();
    if (!b) return '';
    if (/^-{3,}$/.test(b)) return '<hr style="border:none;border-top:1px solid rgba(201,164,74,0.3);margin:26px 0">';
    if (b.startsWith('## ')) {
      return `<h3 style="color:#c9a44a;margin:26px 0 10px;font-size:17px">${b.slice(3)}</h3>`;
    }
    const withBold = b.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    return `<p style="margin:0 0 14px;font-size:15px;line-height:1.75;color:#e8e6f0">${withBold.replace(/\n/g, '<br>')}</p>`;
  }).join('\n');
}

/**
 * Fulfill a paid order by reference. Safe to call more than once:
 * already-delivered orders are skipped, and an order with a generated but
 * unsent reading is just re-sent.
 */
async function fulfillOrder(reference) {
  const db = getDb();
  const order = db.prepare('SELECT * FROM decision_readings WHERE reference = ?').get(reference);
  if (!order) throw new Error(`Order not found: ${reference}`);
  if (order.payment_status !== 'paid') {
    console.warn(`[FULFILL] ${reference}: payment_status is '${order.payment_status}', not fulfilling`);
    return { skipped: 'not_paid' };
  }
  if (order.delivered_at) return { skipped: 'already_delivered' };

  if (!llm.isConfigured()) {
    console.warn(`[FULFILL] ${reference}: ANTHROPIC_API_KEY not set — owner will fulfill manually`);
    return { skipped: 'llm_unconfigured' };
  }

  try {
    let readingText = order.reading_text;

    if (!readingText) {
      if (!order.birth_year || !order.birth_month || !order.birth_day) {
        await sendFulfillmentAlert(order, 'The order has no birth data, so the reading could not be auto-generated. Please write it manually.');
        return { skipped: 'no_birth_data' };
      }

      const readingFacts = facts.computeReadingFacts({
        birthYear: order.birth_year,
        birthMonth: order.birth_month,
        birthDay: order.birth_day,
        hourBranch: order.birth_hour == null ? -1 : order.birth_hour,
        gender: order.gender || undefined,
      }, sgToday());
      readingFacts.today = sgToday();

      const generated = await llm.generateDecisionReading({
        name: order.name,
        question: order.question,
        language: order.language,
      }, readingFacts);

      readingText = generated.text;
      db.prepare(`
        UPDATE decision_readings
        SET reading_text = ?, reading_model = ?, reading_generated_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).run(readingText, generated.model, order.id);
    }

    const sent = await sendReadingDelivery(order, readingToHtml(readingText));
    if (!sent.success) throw new Error(sent.error || 'email send failed');

    db.prepare("UPDATE decision_readings SET delivered_at = datetime('now'), updated_at = datetime('now') WHERE id = ?")
      .run(order.id);
    console.log(`[FULFILL] ${reference}: reading delivered to ${order.email}`);
    return { delivered: true };
  } catch (err) {
    console.error(`[FULFILL] ${reference}: failed —`, err.message);
    sendFulfillmentAlert(order, `Automatic fulfillment failed (${err.message}). Please write and send the reading manually.`)
      .catch(e => console.error('[FULFILL] alert email failed:', e.message));
    return { error: err.message };
  }
}

module.exports = { fulfillOrder, _internal: { readingToHtml } };
