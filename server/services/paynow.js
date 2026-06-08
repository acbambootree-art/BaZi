const QRCode = require('qrcode');

// ─── EMVCo / SGQR PayNow payload builder ─────────────────────
// Builds a Singapore PayNow QR string per the EMVCo QR Code spec, then
// renders it to a PNG data URL. Amount and reference are baked in so the
// payer's bank app pre-fills everything — they just confirm.

function tlv(id, value) {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

// CRC16-CCITT (0xFFFF init, poly 0x1021) — required as the final field (63).
function crc16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function buildPayNowPayload({ mobile, amount, reference, editable = false, merchantName = 'PURPOSE STAR ASTRO' }) {
  // Merchant Account Information for PayNow (field 26)
  const merchantAccount =
    tlv('00', 'SG.PAYNOW') +        // globally unique identifier
    tlv('01', '0') +                // proxy type: 0 = mobile, 2 = UEN
    tlv('02', mobile) +             // proxy value, e.g. +6580108950
    tlv('03', editable ? '1' : '0'); // amount editable indicator

  let payload =
    tlv('00', '01') +                          // payload format indicator
    tlv('01', '12') +                          // point of initiation: 12 = dynamic
    tlv('26', merchantAccount) +
    tlv('52', '0000') +                        // merchant category code
    tlv('53', '702') +                         // currency: SGD
    tlv('54', Number(amount).toFixed(2)) +     // transaction amount
    tlv('58', 'SG') +                          // country
    tlv('59', merchantName.slice(0, 25)) +     // merchant name
    tlv('60', 'Singapore') +                   // merchant city
    tlv('62', tlv('01', reference));           // additional data: bill/reference number

  payload += '6304';                           // CRC field id + length
  payload += crc16(payload);
  return payload;
}

async function generatePayNowQR({ mobile, amount, reference, merchantName }) {
  const payload = buildPayNowPayload({ mobile, amount, reference, merchantName });
  const dataUrl = await QRCode.toDataURL(payload, { width: 300, margin: 1, errorCorrectionLevel: 'M' });
  return { payload, dataUrl };
}

module.exports = { generatePayNowQR, buildPayNowPayload };
