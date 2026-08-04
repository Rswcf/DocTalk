import { createHmac } from 'node:crypto';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import MarketingShell from '../../../components/marketing/MarketingShell';

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_BASE || '';
// C1: ADAPTER_SECRET signs the X-Proxy-IP claim. Must match the backend's
// settings.ADAPTER_SECRET. NOT AUTH_SECRET — AUTH_SECRET stays inside Auth.js.
const ADAPTER_SECRET = process.env.ADAPTER_SECRET;

interface SharedCitation {
  text_snippet: string;
  page: number;
  document_filename: string;
}

interface SharedMessage {
  id: string;
  role: string;
  content: string;
  citations?: SharedCitation[];
}

async function fetchShared(token: string) {
  const headersList = await headers();
  const xff = headersList.get('x-forwarded-for') || '';
  const clientIp = xff.split(',')[0]?.trim() || headersList.get('x-real-ip') || '';

  const backendHeaders: Record<string, string> = {};
  // C1: triple-header HMAC contract. Backend rate-limits /api/shared/{token}
  // per real visitor; this proves the IP claim came from our SSR origin and
  // not a direct attacker who can set arbitrary headers. Same trust model as
  // /api/proxy. Per-request timestamp + 60s skew window blocks replay.
  if (clientIp && ADAPTER_SECRET) {
    const ts = Math.floor(Date.now() / 1000).toString();
    const sig = createHmac('sha256', ADAPTER_SECRET)
      .update(`${clientIp}:${ts}`)
      .digest('hex');
    backendHeaders['X-Proxy-IP'] = clientIp;
    backendHeaders['X-Proxy-IP-Ts'] = ts;
    backendHeaders['X-Proxy-IP-Sig'] = sig;
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/shared/${token}`, {
      headers: backendHeaders,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const data = await fetchShared(token);
  if (!data) return { title: 'Not Found' };
  const preview = data.messages?.find((m: SharedMessage) => m.role === 'assistant')?.content?.slice(0, 150) || '';
  return {
    title: data.session_title,
    description: preview,
    robots: { index: false, follow: false },
    openGraph: { title: data.session_title, description: preview },
  };
}

export default async function SharedPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await fetchShared(token);
  if (!data) notFound();

  return (
    <MarketingShell>
      <div className="ed-shell" style={{ maxWidth: '760px', paddingTop: '48px', paddingBottom: '64px' }}>
        <h1 className="ed-h1">{data.session_title}</h1>
        <p className="ed-caption" style={{ marginTop: '8px', marginBottom: '32px' }}>
          Document: {data.document_name}
        </p>

        <div className="flex flex-col" style={{ gap: '16px' }}>
          {data.messages.map((msg: SharedMessage, i: number) => (
            <div
              key={msg.id || i}
              id={msg.id}
              className={`scroll-mt-6 target:bg-[var(--ed-paper-2)] ${msg.role === 'user' ? 'flex justify-end' : ''}`}
              style={{ transition: 'background-color 300ms ease' }}
            >
              <div
                className="ed-card"
                style={{
                  maxWidth: '85%',
                  ...(msg.role === 'user'
                    ? { background: 'var(--ed-ink)', color: '#ffffff', border: '1px solid var(--ed-ink)' }
                    : {}),
                }}
              >
                <p className="ed-body" style={msg.role === 'user' ? { color: '#ffffff' } : undefined}>
                  {msg.content}
                </p>
                {msg.citations && msg.citations.length > 0 && (
                  <div className="flex flex-col" style={{ marginTop: '10px', gap: '6px' }}>
                    {msg.citations.map((c, j: number) => (
                      <div
                        key={j}
                        className="ed-caption"
                        style={{
                          border: '1px solid var(--ed-rule)',
                          background: 'var(--ed-paper-2)',
                          padding: '4px 8px',
                          borderRadius: '3px',
                        }}
                      >
                        p. {c.page}{c.document_filename ? ` — ${c.document_filename}` : ''}: &ldquo;{c.text_snippet}&rdquo;
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '48px', textAlign: 'center', borderTop: '1px solid var(--ed-rule)', paddingTop: '24px' }}>
          <p className="ed-caption" style={{ marginBottom: '12px' }}>Powered by DocTalk</p>
          <a href="https://www.doctalk.site" className="ed-cta">
            Try DocTalk Free
          </a>
        </div>
      </div>
    </MarketingShell>
  );
}
