/**
 * GIO Spark — form handler for Vercel (POST /api/send).
 * Emails Enquiry and Contact form submissions through the Resend API.
 *
 * Environment variables (Vercel → Project → Settings → Environment Variables, then redeploy):
 *   RESEND_API_KEY  required. Create one at resend.com/api-keys.
 *   MAIL_TO         optional. Defaults to info@giospark.com (comma-separate several addresses).
 *   MAIL_FROM       optional. Defaults to "GIO Spark Website <onboarding@resend.dev>", which Resend
 *                   only delivers to the email you signed up to Resend with. After verifying
 *                   giospark.com in Resend, use e.g. "GIO Spark Website <website@giospark.com>".
 *
 * Replies with JSON { ok: true } on success. The site falls back to WhatsApp / email buttons
 * whenever the reply is not ok. Plain HTML form posts (no JavaScript) get a small HTML page.
 */
'use strict';

const LABELS = {
  type: 'Enquiry type',
  territory: 'Territory',
  distribution_experience: 'Distribution experience',
  storage: 'Storage space',
  sizes: 'Bottle sizes',
  requirement: 'Requirement',
  quantity: 'Quantity',
  city: 'City',
  required_by: 'Required by',
  name: 'Name',
  business: 'Business',
  phone: 'Phone',
  email: 'Email',
  state: 'State',
  preferred_contact: 'Preferred contact',
  subject: 'Subject',
  message: 'Message'
};

const PHONE_RE = /^[6-9]\d{9}$/;
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;

// Soft per-instance limit against bursts of junk (instances are reused, but not shared).
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map();

function clean(value, max) {
  if (Array.isArray(value)) value = value.join(', ');
  if (value === undefined || value === null || typeof value === 'object') return '';
  return String(value)
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max || 2000);
}

function cleanPhone(value) {
  let d = String(value || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.charAt(0) === '0') d = d.slice(1);
  return d;
}

function header(req, name) {
  const v = req.headers[name];
  return Array.isArray(v) ? v[0] : v;
}

// Browsers always send Origin on cross-site POSTs; reject posts from other sites.
function sameOrigin(req) {
  const origin = header(req, 'origin');
  if (!origin) return true;
  try {
    const host = header(req, 'x-forwarded-host') || header(req, 'host');
    return new URL(origin).host === host;
  } catch (e) {
    return false;
  }
}

function clientIp(req) {
  const forwarded = header(req, 'x-forwarded-for');
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return header(req, 'x-real-ip') || 'unknown';
}

function rateLimited(ip) {
  const now = Date.now();
  for (const [key, entry] of hits) {
    if (now - entry.start > WINDOW_MS) hits.delete(key);
  }
  const entry = hits.get(ip);
  if (!entry) {
    hits.set(ip, { start: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

// Vercel parses JSON / urlencoded bodies into req.body and throws on malformed JSON.
function readBody(req) {
  try {
    const body = req.body;
    if (body && typeof body === 'object' && !Buffer.isBuffer(body)) return body;
    if (Buffer.isBuffer(body)) return JSON.parse(body.toString('utf8') || '{}');
    if (typeof body === 'string') return body.trim() ? JSON.parse(body) : {};
    return {};
  } catch (e) {
    return null;
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function htmlPage(ok) {
  const title = ok ? 'Thank you!' : 'Sorry, your message could not be sent';
  const text = ok
    ? 'Your message has reached the GIO Spark team. We will get in touch with you soon.'
    : 'Please call or WhatsApp us on +91 78188 64533, or email info@giospark.com.';
  return '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>' + escapeHtml(title) + ' | GIO Spark</title>' +
    '<link rel="stylesheet" href="/assets/css/style.css"></head><body>' +
    '<main style="min-height:100vh;display:grid;place-items:center;padding:40px 16px;text-align:center">' +
    '<div><h1 class="h2">' + escapeHtml(title) + '</h1>' +
    '<p style="margin:16px auto 28px;max-width:440px">' + escapeHtml(text) + '</p>' +
    '<a class="btn btn--primary" href="/">Back to GIO Spark</a></div></main></body></html>';
}

function reply(res, status, data, asHtml) {
  res.statusCode = status;
  res.setHeader('Cache-Control', 'no-store');
  if (asHtml) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(htmlPage(data.ok === true));
  } else {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(data));
  }
}

module.exports = async function handler(req, res) {
  const asHtml = /application\/x-www-form-urlencoded/i.test(header(req, 'content-type') || '');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return reply(res, 405, { ok: false, error: 'method' }, asHtml);
  }
  if (!sameOrigin(req)) return reply(res, 403, { ok: false, error: 'origin' }, asHtml);

  const body = readBody(req);
  if (!body) return reply(res, 400, { ok: false, error: 'bad-request' }, asHtml);

  // honeypot: real visitors never fill this hidden field
  if (clean(body.company_website, 200)) return reply(res, 200, { ok: true }, asHtml);

  const name = clean(body.name, 120);
  const phone = cleanPhone(body.phone);
  if (!name || !PHONE_RE.test(phone)) return reply(res, 422, { ok: false, error: 'invalid' }, asHtml);

  const ip = clientIp(req);
  if (rateLimited(ip)) return reply(res, 429, { ok: false, error: 'rate-limited' }, asHtml);

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return reply(res, 503, { ok: false, error: 'not-configured' }, asHtml);

  const rawEmail = clean(body.email, 200);
  const email = EMAIL_RE.test(rawEmail) ? rawEmail : '';
  const formName = body.form === 'contact' ? 'Contact message' : 'New enquiry';

  const lines = [];
  for (const key of Object.keys(LABELS)) {
    if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
    let value;
    if (key === 'phone') value = '+91 ' + phone;
    else if (key === 'email') value = email;
    else if (key === 'name') value = name;
    else value = clean(body[key]);
    if (value) lines.push((LABELS[key] + ':').padEnd(26) + value);
  }

  const when = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
  const text = [
    formName + ' from the GIO Spark website',
    '-'.repeat(48),
    '',
    ...lines,
    '',
    '-'.repeat(48),
    'Sent ' + when + ' IST · IP ' + ip
  ].join('\n');

  const payload = {
    from: process.env.MAIL_FROM || 'GIO Spark Website <onboarding@resend.dev>',
    to: (process.env.MAIL_TO || 'info@giospark.com').split(',').map((s) => s.trim()).filter(Boolean),
    subject: (formName + ' — ' + name).replace(/[\r\n]+/g, ' '),
    text: text
  };
  if (email) payload.reply_to = email;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'giospark-site/1.0'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error('Resend rejected the email:', response.status, detail.slice(0, 300));
      return reply(res, 502, { ok: false, error: 'mail' }, asHtml);
    }
    return reply(res, 200, { ok: true }, asHtml);
  } catch (err) {
    console.error('Resend request failed:', err && err.message);
    return reply(res, 502, { ok: false, error: 'mail' }, asHtml);
  }
};
