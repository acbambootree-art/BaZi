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

module.exports = { sendVerificationEmail };
