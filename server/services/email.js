const { Resend } = require('resend');
const fs = require('fs');
const path = require('path');

let resend;

function getResend() {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

/**
 * Send verification email to the user.
 * Falls back to console logging if no Resend API key is configured.
 */
async function sendVerificationEmail({ to, name, token }) {
  const baseUrl = process.env.VERIFICATION_BASE_URL || 'http://localhost:3000';
  const verifyUrl = `${baseUrl}/api/verify?token=${token}`;

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

  // Load and populate HTML template
  let html = fs.readFileSync(
    path.join(__dirname, '..', 'templates', 'verification-email.html'),
    'utf8'
  );
  html = html
    .replace(/{{NAME}}/g, name)
    .replace(/{{VERIFY_URL}}/g, verifyUrl);

  const client = getResend();

  if (!client) {
    console.log('\n[EMAIL] No RESEND_API_KEY set — logging email to console:');
    console.log(`  To: ${to}`);
    console.log(`  Subject: Verify your Purpose-Star Astrology account`);
    console.log(`  Verify URL: ${verifyUrl}`);
    console.log('');
    return { success: true, dev: true };
  }

  try {
    const result = await client.emails.send({
      from: `BaZi Calculator <${fromEmail}>`,
      to: [to],
      subject: 'Verify your Purpose-Star Astrology account',
      html: html,
    });

    console.log(`[EMAIL] Sent verification email to ${to}`, result);
    return { success: true, id: result.data?.id };
  } catch (err) {
    console.error(`[EMAIL] Failed to send to ${to}:`, err.message);
    return { success: false, error: err.message };
  }
}

// ─── Generic send helper (used by Focused Decision Reading) ──
async function sendEmail({ to, subject, html, replyTo }) {
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  const client = getResend();

  if (!client) {
    console.log('\n[EMAIL] No RESEND_API_KEY set — logging email to console:');
    console.log(`  To: ${to}`);
    console.log(`  Subject: ${subject}`);
    console.log('');
    return { success: true, dev: true };
  }

  try {
    const result = await client.emails.send({
      from: `Purpose-Star Astrology <${fromEmail}>`,
      to: [to],
      subject,
      html,
      ...(replyTo ? { replyTo } : {}),
    });
    console.log(`[EMAIL] Sent "${subject}" to ${to}`, result?.data?.id || '');
    return { success: true, id: result.data?.id };
  } catch (err) {
    console.error(`[EMAIL] Failed to send "${subject}" to ${to}:`, err.message);
    return { success: false, error: err.message };
  }
}

const LANG_LABEL = { both: 'Bilingual (English + 中文)', en: 'English', zh: '中文' };
const STATUS_LABEL = {
  paid: 'PAID (Stripe)',
  paynow_claimed: 'PayNow — customer marked as paid (VERIFY before writing)',
  pending: 'Pending',
};

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

/**
 * Notify the business owner of a new Focused Decision Reading order,
 * with everything needed to write the report.
 */
async function sendOrderNotification(order) {
  const to = process.env.ORDER_NOTIFY_EMAIL || 'cj@360nightnday.com';
  const birth = order.birth_year
    ? `${order.birth_year}-${String(order.birth_month).padStart(2, '0')}-${String(order.birth_day).padStart(2, '0')}`
      + (order.birth_hour >= 0 && order.birth_hour != null ? `, hour branch #${order.birth_hour}` : ', hour unknown')
      + (order.gender ? `, ${order.gender}` : '')
    : 'Not provided';
  const amount = `${order.currency} ${(order.amount_cents / 100).toFixed(2)}`;

  const html = `
  <div style="font-family:'Segoe UI',Tahoma,sans-serif;max-width:560px;margin:0 auto;background:#0a0a0f;color:#e8e6f0;padding:32px;border-radius:14px">
    <h2 style="color:#c9a44a;margin:0 0 4px">New Focused Decision Reading</h2>
    <p style="color:#9a9590;margin:0 0 20px;font-size:13px">Order <strong style="color:#c9a44a">${esc(order.reference)}</strong> · ${esc(amount)} · ${esc(STATUS_LABEL[order.payment_status] || order.payment_status)}</p>

    <div style="background:rgba(201,164,74,0.06);border:1px solid rgba(201,164,74,0.2);border-radius:10px;padding:18px;margin-bottom:18px">
      <div style="color:#c9a44a;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px">Their question</div>
      <div style="font-size:15px;line-height:1.6;white-space:pre-wrap">${esc(order.question)}</div>
    </div>

    <table style="width:100%;font-size:13px;line-height:1.9;color:#cfcadf">
      <tr><td style="color:#9a9590;width:120px">Name</td><td>${esc(order.name)}</td></tr>
      <tr><td style="color:#9a9590">Email</td><td>${esc(order.email)}</td></tr>
      <tr><td style="color:#9a9590">Phone</td><td>${esc(order.phone) || '—'}</td></tr>
      <tr><td style="color:#9a9590">Language</td><td>${esc(LANG_LABEL[order.language] || order.language)}</td></tr>
      <tr><td style="color:#9a9590">Birth</td><td>${esc(birth)}</td></tr>
      <tr><td style="color:#9a9590">Payment</td><td>${esc(order.payment_method)}${order.paynow_reference ? ` · ref: ${esc(order.paynow_reference)}` : ''}</td></tr>
    </table>

    ${order.chart_summary ? `
    <div style="margin-top:18px;background:rgba(255,255,255,0.03);border-radius:10px;padding:16px">
      <div style="color:#c9a44a;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px">Chart summary (from their free reading)</div>
      <pre style="font-family:'Segoe UI',sans-serif;font-size:13px;line-height:1.7;color:#cfcadf;white-space:pre-wrap;margin:0">${esc(order.chart_summary)}</pre>
    </div>` : ''}

    <p style="margin-top:22px;color:#9a9590;font-size:12px">Reply to this email to reach ${esc(order.name)} directly. Deliver the report within 24–48h.</p>
  </div>`;

  return sendEmail({
    to,
    subject: `New Decision Reading — ${order.reference} (${STATUS_LABEL[order.payment_status] || order.payment_status})`,
    html,
    replyTo: order.email,
  });
}

/**
 * Confirm to the customer that their order was received.
 */
async function sendOrderConfirmation(order) {
  const paidLine = order.payment_status === 'paid'
    ? 'Your payment has been received in full.'
    : 'We\'ll verify your PayNow payment shortly.';

  const html = `
  <div style="font-family:'Segoe UI',Tahoma,sans-serif;max-width:520px;margin:0 auto;background:#0a0a0f;color:#e8e6f0;padding:36px;border-radius:14px;text-align:center">
    <div style="color:#c9a44a;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:10px">Purpose-Star Astrology · 命星指引</div>
    <h2 style="color:#c9a44a;margin:0 0 14px">We've received your reading</h2>
    <p style="color:#cfcadf;font-size:15px;line-height:1.7;margin:0 0 18px">
      Thank you, ${esc(order.name)}. ${paidLine} Your <strong>Focused Decision Reading</strong> is in our queue.
    </p>
    <div style="background:rgba(201,164,74,0.06);border:1px solid rgba(201,164,74,0.2);border-radius:10px;padding:18px;margin:0 0 18px;text-align:left">
      <div style="color:#9a9590;font-size:12px;margin-bottom:6px">Your question</div>
      <div style="font-size:14px;line-height:1.6;color:#e8e6f0;white-space:pre-wrap">${esc(order.question)}</div>
    </div>
    <p style="color:#cfcadf;font-size:14px;line-height:1.7;margin:0 0 8px">
      You'll receive a written ${esc(LANG_LABEL[order.language] || 'bilingual')} report (600–1,000 words), tied entirely to your question, within <strong style="color:#c9a44a">24–48 hours</strong>.
    </p>
    <p style="color:#5c5856;font-size:12px;margin-top:22px">Order reference: ${esc(order.reference)}</p>
    <p style="color:#5c5856;font-size:11px;font-style:italic;margin-top:18px">The stars incline, they do not compel.</p>
  </div>`;

  return sendEmail({
    to: order.email,
    subject: `Your Focused Decision Reading is confirmed — ${order.reference}`,
    html,
  });
}

module.exports = { sendVerificationEmail, sendOrderNotification, sendOrderConfirmation };
