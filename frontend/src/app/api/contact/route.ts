import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Simple in-memory per-IP rate limit. Vercel serverless recycles instances
// frequently, so this is best-effort — the honeypot is the primary spam
// defence. A distributed limiter (Upstash) would be the next step if abuse
// shows up in logs.
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;  // 1 hour
const RATE_LIMIT_MAX = 3;
const ipHits = new Map<string, number[]>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const hits = (ipHits.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (hits.length >= RATE_LIMIT_MAX) {
    ipHits.set(ip, hits);
    return false;
  }
  hits.push(now);
  ipHits.set(ip, hits);
  return true;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function POST(req: NextRequest) {
  let body: {
    name?: unknown;
    email?: unknown;
    message?: unknown;
    website?: unknown;  // honeypot
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  // Honeypot: a hidden "website" field bots fill in but humans can't see.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    // Silently 200 to not tip off bots.
    return NextResponse.json({ ok: true });
  }

  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
  const email = typeof body.email === 'string' ? body.email.trim().slice(0, 254) : '';
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 5000) : '';

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
  }
  if (message.length < 10) {
    return NextResponse.json({ error: 'Message is too short.' }, { status: 400 });
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many submissions. Please try again later.' },
      { status: 429 },
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Contact endpoint not configured.' },
      { status: 503 },
    );
  }

  const from = process.env.EMAIL_FROM || 'DocTalk <auth@doctalk.site>';
  const to = process.env.CONTACT_TO || 'support@doctalk.site';
  const subject = `[doctalk.site contact] ${name || 'Anonymous'} <${email}>`;

  const safeName = escapeHtml(name || '—');
  const safeEmail = escapeHtml(email);
  const safeMessage = escapeHtml(message).replace(/\n/g, '<br>');
  const html = `<p><strong>From:</strong> ${safeName} &lt;${safeEmail}&gt;</p>
<p><strong>IP:</strong> ${escapeHtml(ip)}</p>
<hr>
<p>${safeMessage}</p>`;
  const text = `From: ${name || '—'} <${email}>\nIP: ${ip}\n\n${message}`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
      text,
      headers: {
        'Reply-To': email,
        'X-Entity-Ref-ID': crypto.randomUUID(),
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('Contact form Resend error:', res.status, detail);
    return NextResponse.json(
      { error: 'Could not send message. Please email support@doctalk.site directly.' },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
