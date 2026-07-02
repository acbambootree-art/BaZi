const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { getDb } = require('../db/init');
const { generatePayNowQR } = require('../services/paynow');
const { sendOrderNotification, sendOrderConfirmation } = require('../services/email');
const { fulfillOrder } = require('../services/fulfillment');
const { decisionReadingRules, validate } = require('../middleware/validator');
const { orderLimiter, adminLimiter } = require('../middleware/rateLimiter');

const PRICE_CENTS = 4800;
const CURRENCY = 'SGD';

// ─── Lazy Stripe client (only if configured) ────────────────
let stripeClient;
function getStripe() {
  if (!stripeClient && process.env.STRIPE_SECRET_KEY) {
    stripeClient = require('stripe')(process.env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
}

function payNowMobile() {
  return process.env.PAYNOW_MOBILE || '+6580108950';
}

function baseUrl(req) {
  return process.env.PUBLIC_BASE_URL
    || process.env.VERIFICATION_BASE_URL
    || `${req.protocol}://${req.get('host')}`;
}

function newReference() {
  return 'FDR-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

// ─── GET /api/payment-config ─────────────────────────────────
// Lets the frontend know which payment methods to show.
router.get('/payment-config', (req, res) => {
  res.json({
    stripeEnabled: !!process.env.STRIPE_SECRET_KEY,
    payNowMobile: payNowMobile(),
    price: PRICE_CENTS / 100,
    currency: CURRENCY,
  });
});

// ─── POST /api/decision-reading ──────────────────────────────
// Create an order; return a Stripe Checkout URL or a PayNow QR.
router.post('/decision-reading', orderLimiter, decisionReadingRules, validate, async (req, res) => {
  try {
    const {
      name, email, phone, question,
      language = 'both', paymentMethod,
      birthYear, birthMonth, birthDay, birthHour, gender, chartSummary,
    } = req.body;

    if (paymentMethod === 'stripe' && !getStripe()) {
      return res.status(400).json({ error: 'Card payment is unavailable right now. Please use PayNow.' });
    }

    const db = getDb();
    const reference = newReference();

    const toInt = v => (v === '' || v == null ? null : parseInt(v, 10));

    db.prepare(`
      INSERT INTO decision_readings
        (reference, name, email, phone, question, language,
         birth_year, birth_month, birth_day, birth_hour, gender, chart_summary,
         amount_cents, currency, payment_method, payment_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      reference, name, email, phone || null, question, language,
      toInt(birthYear), toInt(birthMonth), toInt(birthDay), toInt(birthHour), gender || null, chartSummary || null,
      PRICE_CENTS, CURRENCY, paymentMethod
    );

    if (paymentMethod === 'stripe') {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: CURRENCY.toLowerCase(),
            product_data: {
              name: 'Focused Decision Reading',
              description: 'One question, one decision — a written bilingual report within 24–48h.',
            },
            unit_amount: PRICE_CENTS,
          },
          quantity: 1,
        }],
        customer_email: email,
        client_reference_id: reference,
        metadata: { reference },
        success_url: `${baseUrl(req)}/?order=${reference}&paid=1`,
        cancel_url: `${baseUrl(req)}/?order=${reference}&cancelled=1`,
      });

      db.prepare("UPDATE decision_readings SET stripe_session_id = ?, updated_at = datetime('now') WHERE reference = ?")
        .run(session.id, reference);

      return res.json({ method: 'stripe', reference, checkoutUrl: session.url });
    }

    // PayNow: return a QR with amount + reference baked in.
    const { dataUrl } = await generatePayNowQR({
      mobile: payNowMobile(),
      amount: PRICE_CENTS / 100,
      reference,
    });

    return res.json({
      method: 'paynow',
      reference,
      qr: dataUrl,
      payNowMobile: payNowMobile(),
      amount: (PRICE_CENTS / 100).toFixed(2),
      currency: CURRENCY,
    });
  } catch (err) {
    console.error('[DECISION-READING] Error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ─── POST /api/decision-reading/:ref/paynow-confirm ──────────
// Customer indicates they've paid via PayNow. Notify owner to verify + write.
router.post('/decision-reading/:ref/paynow-confirm', orderLimiter, async (req, res) => {
  try {
    const { ref } = req.params;
    const bankReference = (req.body && req.body.bankReference || '').toString().trim().slice(0, 120) || null;

    const db = getDb();
    const order = db.prepare('SELECT * FROM decision_readings WHERE reference = ?').get(ref);

    if (!order) return res.status(404).json({ error: 'Order not found.' });

    if (order.payment_status === 'pending') {
      db.prepare("UPDATE decision_readings SET payment_status = 'paynow_claimed', paynow_reference = ?, updated_at = datetime('now') WHERE id = ?")
        .run(bankReference, order.id);
      const updated = { ...order, payment_status: 'paynow_claimed', paynow_reference: bankReference };
      sendOrderNotification(updated).catch(e => console.error('[DR] notify failed:', e.message));
      sendOrderConfirmation(updated).catch(e => console.error('[DR] confirm failed:', e.message));
    }

    res.json({ message: 'Thank you! We\'ll verify your PayNow payment and begin your reading.' });
  } catch (err) {
    console.error('[DECISION-READING] paynow-confirm error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ─── Admin: list + manage orders (protected by ADMIN_KEY) ───
function requireAdmin(req, res, next) {
  const key = process.env.ADMIN_KEY;
  if (!key) return res.status(503).json({ error: 'Admin is not configured. Set ADMIN_KEY in the environment.' });
  const provided = req.headers['x-admin-key'] || req.query.key;
  if (!provided || provided !== key) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

const VALID_STATUSES = ['pending', 'paynow_claimed', 'paid', 'refunded'];

router.get('/admin/orders', adminLimiter, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const orders = db.prepare('SELECT * FROM decision_readings ORDER BY id DESC LIMIT 300').all();
    res.json({ orders });
  } catch (err) {
    console.error('[ADMIN] list error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

router.post('/admin/orders/:ref/status', adminLimiter, requireAdmin, (req, res) => {
  try {
    const { ref } = req.params;
    const { paymentStatus, delivered } = req.body || {};
    const db = getDb();
    const order = db.prepare('SELECT id FROM decision_readings WHERE reference = ?').get(ref);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    if (paymentStatus) {
      if (!VALID_STATUSES.includes(paymentStatus)) return res.status(400).json({ error: 'Invalid status.' });
      db.prepare("UPDATE decision_readings SET payment_status = ?, updated_at = datetime('now') WHERE id = ?").run(paymentStatus, order.id);
      // PayNow flow: once the admin verifies the transfer and marks the order
      // paid, generate and deliver the reading automatically.
      if (paymentStatus === 'paid') {
        fulfillOrder(ref).catch(e => console.error('[ADMIN] fulfill failed:', e.message));
      }
    }
    if (delivered === true) {
      db.prepare("UPDATE decision_readings SET delivered_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(order.id);
    } else if (delivered === false) {
      db.prepare("UPDATE decision_readings SET delivered_at = NULL, updated_at = datetime('now') WHERE id = ?").run(order.id);
    }

    const updated = db.prepare('SELECT * FROM decision_readings WHERE id = ?').get(order.id);
    res.json({ order: updated });
  } catch (err) {
    console.error('[ADMIN] status update error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ─── Stripe webhook (raw body — mounted in server.js before json) ──
function stripeWebhook(req, res) {
  const stripe = getStripe();
  if (!stripe) return res.status(400).send('Stripe not configured');

  const sig = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    console.error('[STRIPE] Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const reference = session.client_reference_id || (session.metadata && session.metadata.reference);
    try {
      const db = getDb();
      const order = db.prepare('SELECT * FROM decision_readings WHERE reference = ?').get(reference);
      if (order && order.payment_status !== 'paid') {
        db.prepare("UPDATE decision_readings SET payment_status = 'paid', updated_at = datetime('now') WHERE id = ?").run(order.id);
        const paid = { ...order, payment_status: 'paid' };
        sendOrderNotification(paid).catch(e => console.error('[DR] notify failed:', e.message));
        sendOrderConfirmation(paid).catch(e => console.error('[DR] confirm failed:', e.message));
        // Payment verified — generate and deliver the reading automatically.
        fulfillOrder(order.reference).catch(e => console.error('[DR] fulfill failed:', e.message));
      }
    } catch (e) {
      console.error('[STRIPE] Failed to process completed session:', e.message);
    }
  }

  res.json({ received: true });
}

module.exports = { router, stripeWebhook };
