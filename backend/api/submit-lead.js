const { Resend } = require('resend');
const https = require('https');
const { createLead } = require('../core/storage/leadsStore');

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const recentByIp = new Map();
const RATE_LIMIT_MS = Number(process.env.LEAD_RATE_LIMIT_MS || 10_000);
const cap = (value, max) => (value == null ? '' : String(value).slice(0, max));

let resendClient;

function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

function fromEmail() {
  return process.env.RESEND_FROM_EMAIL || process.env.FROM_EMAIL || 'NFINITY HQ <onboarding@resend.dev>';
}

async function sendEmail(resend, payload) {
  const result = await resend.emails.send(payload);
  if (result?.error) {
    throw new Error(result.error.message || 'Resend rejected the email request.');
  }
  return result;
}

module.exports = async function submitLead(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    name,
    email,
    company,
    phone,
    state,
    timezone,
    preferred_hours,
    contact_preference,
    botcheck,
  } = req.body || {};

  if (botcheck) return res.status(200).json({ success: true });

  const ip = req.ip
    || String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.socket?.remoteAddress
    || 'unknown';
  const now = Date.now();
  const lastSeen = recentByIp.get(ip);
  if (lastSeen && now - lastSeen < RATE_LIMIT_MS) {
    return res.status(429).json({ error: 'Please wait a moment before submitting again.' });
  }

  const lead = {
    name: cap(String(name).trim(), 120),
    email: cap(String(email).trim().toLowerCase(), 254),
    company: cap(String(company).trim(), 120),
    phone: cap(String(phone).trim(), 40),
    state: cap(state, 60),
    timezone: cap(timezone, 80),
    preferred_hours: cap(preferred_hours, 60),
    contact_preference: ['Call', 'Text'].includes(contact_preference) ? contact_preference : 'Call',
    submitted_at: new Date().toISOString(),
  };

  if (!lead.name || !lead.email || !lead.company || !lead.phone || !lead.state || !lead.timezone || !lead.preferred_hours) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  let savedLead;
  try {
    savedLead = await createLead(lead);
    recentByIp.set(ip, now);
    pruneRateLimit(now);
    console.log(`[submit-lead] lead saved: ${savedLead.email}`);
  } catch (error) {
    console.error('[submit-lead] JSON save error:', error?.message || error);
    return res.status(500).json({ error: 'Could not save lead.' });
  }

  const notifications = await Promise.allSettled([
    sendTelegramAlert(savedLead),
    sendCustomerConfirmation(savedLead),
    sendAdminNotification(savedLead),
  ]);

  return res.status(200).json({
    success: true,
    leadId: savedLead.id,
    notifications: summarizeNotifications(notifications),
  });
};

function pruneRateLimit(now) {
  if (recentByIp.size <= 2000) return;
  for (const [key, seenAt] of recentByIp) {
    if (now - seenAt > RATE_LIMIT_MS) recentByIp.delete(key);
  }
}

async function sendTelegramAlert(lead) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.warn('[submit-lead] Telegram skipped: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing.');
    return { channel: 'telegram', status: 'skipped' };
  }

  const ts = new Date(lead.submitted_at).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/New_York',
  });

  const text = [
    '<b>NEW NFINITYHQ LEAD</b>',
    '',
    `<b>Name:</b> ${escHtml(lead.name)}`,
    `<b>Company:</b> ${escHtml(lead.company)}`,
    `<b>Phone:</b> ${escHtml(lead.phone)}`,
    `<b>Email:</b> ${escHtml(lead.email)}`,
    `<b>State/Province:</b> ${escHtml(lead.state)}`,
    `<b>Time Zone:</b> ${escHtml(lead.timezone)}`,
    `<b>Preferred Hours:</b> ${escHtml(lead.preferred_hours)}`,
    `<b>Contact Method:</b> ${escHtml(lead.contact_preference)}`,
    '',
    `<i>${escHtml(ts)} ET</i>`,
  ].join('\n');

  await postTelegram(token, { chat_id: chatId, text, parse_mode: 'HTML' });

  console.log('[submit-lead] Telegram alert sent.');
  return { channel: 'telegram', status: 'sent' };
}

function postTelegram(token, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${token}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) return resolve(responseBody);
        reject(new Error(`Telegram API ${res.statusCode}: ${responseBody}`));
      });
    });
    req.on('error', reject);
    req.end(body);
  });
}

async function sendCustomerConfirmation(lead) {
  const resend = getResend();
  if (!resend) {
    console.warn('[submit-lead] customer email skipped: RESEND_API_KEY missing.');
    return { channel: 'customerEmail', status: 'skipped' };
  }

  await sendEmail(resend, {
    from: fromEmail(),
    to: lead.email,
    subject: 'NFINITYHQ Request Received',
    html: customerEmailHtml(lead),
  });

  console.log('[submit-lead] customer confirmation email sent.');
  return { channel: 'customerEmail', status: 'sent' };
}

async function sendAdminNotification(lead) {
  const resend = getResend();
  if (!resend) {
    console.warn('[submit-lead] admin email skipped: RESEND_API_KEY missing.');
    return { channel: 'adminEmail', status: 'skipped' };
  }
  if (!process.env.ADMIN_EMAIL) {
    console.warn('[submit-lead] admin email skipped: ADMIN_EMAIL missing.');
    return { channel: 'adminEmail', status: 'skipped' };
  }

  await sendEmail(resend, {
    from: fromEmail(),
    to: process.env.ADMIN_EMAIL,
    subject: 'NEW NFINITYHQ LEAD',
    html: adminEmailHtml(lead),
  });

  console.log('[submit-lead] admin notification email sent.');
  return { channel: 'adminEmail', status: 'sent' };
}

function summarizeNotifications(results) {
  const channels = ['telegram', 'customerEmail', 'adminEmail'];
  return results.map((result, index) => {
    if (result.status === 'fulfilled') return result.value;
    const channel = channels[index] || 'unknown';
    console.error(`[submit-lead] ${channel} failed:`, result.reason?.message || result.reason);
    return { channel, status: 'failed' };
  });
}

function customerEmailHtml(lead) {
  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:32px;background:#0a0a0f;font-family:Arial,sans-serif;color:#d4d4e8;">
  <div style="max-width:560px;margin:0 auto;background:#13131a;border:1px solid #1e1e2e;border-radius:16px;padding:32px;">
    <h1 style="margin:0 0 16px;color:#ffffff;font-size:22px;">Request Received</h1>
    <p style="line-height:1.6;">We received your request and will contact you shortly. Thank you for your interest in NFINITYHQ.</p>
    ${leadSummaryHtml(lead)}
  </div>
</body>
</html>`;
}

function adminEmailHtml(lead) {
  const ts = new Date(lead.submitted_at).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/New_York',
  }) + ' ET';

  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:32px;background:#0a0a0f;font-family:Arial,sans-serif;color:#d4d4e8;">
  <div style="max-width:560px;margin:0 auto;background:#13131a;border:1px solid #1e1e2e;border-radius:16px;padding:32px;">
    <p style="margin:0 0 10px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#a89cf7;">New Build Request</p>
    <h1 style="margin:0 0 4px;color:#ffffff;font-size:22px;">${escHtml(lead.name)}</h1>
    <p style="margin:0 0 20px;color:#8b8b9e;">${escHtml(lead.company)} - ${escHtml(ts)}</p>
    ${leadSummaryHtml(lead)}
    <p style="margin:24px 0 0;"><a href="mailto:${escAttr(lead.email)}" style="background:#7c6af7;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700;">Reply to Lead</a></p>
  </div>
</body>
</html>`;
}

function leadSummaryHtml(lead) {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;">
    ${summaryRow('Name', lead.name)}
    ${summaryRow('Company', lead.company)}
    ${summaryRow('Phone', lead.phone)}
    ${summaryRow('Email', lead.email)}
    ${summaryRow('State/Province', lead.state)}
    ${summaryRow('Time Zone', lead.timezone)}
    ${summaryRow('Preferred Hours', lead.preferred_hours)}
    ${summaryRow('Contact Method', lead.contact_preference)}
  </table>`;
}

function summaryRow(label, value) {
  return `<tr>
    <td style="padding:7px 0;font-size:13px;color:#5a5a72;white-space:nowrap;width:150px;">${escHtml(label)}</td>
    <td style="padding:7px 0;font-size:13px;color:#d4d4e8;">${escHtml(value)}</td>
  </tr>`;
}

function escAttr(value) {
  return escHtml(value).replace(/`/g, '&#96;');
}

function escHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
