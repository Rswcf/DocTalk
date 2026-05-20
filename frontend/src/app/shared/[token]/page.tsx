import { createHmac } from 'node:crypto';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import type { Metadata } from 'next';

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
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-1">{data.session_title}</h1>
        <p className="text-sm text-zinc-500 mb-6">Document: {data.document_name}</p>

        <div className="space-y-4">
          {data.messages.map((msg: SharedMessage, i: number) => (
            <div
              key={msg.id || i}
              id={msg.id}
              className={`scroll-mt-6 rounded-2xl transition-[background-color,box-shadow] target:bg-blue-50 target:ring-2 target:ring-blue-300 target:ring-offset-4 target:ring-offset-white dark:target:bg-blue-950/30 dark:target:ring-blue-700 dark:target:ring-offset-zinc-950 ${
                msg.role === 'user' ? 'flex justify-end' : ''
              }`}
            >
              <div className={`max-w-[85%] rounded-xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
              }`}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {msg.citations.map((c, j: number) => (
                      <div key={j} className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-700 rounded px-2 py-1">
                        p. {c.page}{c.document_filename ? ` — ${c.document_filename}` : ''}: &ldquo;{c.text_snippet}&rdquo;
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center border-t border-zinc-200 dark:border-zinc-800 pt-6">
          <p className="text-sm text-zinc-500 mb-3">Powered by DocTalk</p>
          <a
            href="https://www.doctalk.site"
            className="inline-block px-6 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Try DocTalk Free
          </a>
        </div>
      </div>
    </div>
  );
}
