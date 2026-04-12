import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import type { Metadata } from 'next';

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_BASE || '';
const AUTH_SECRET = process.env.AUTH_SECRET;

async function fetchShared(token: string) {
  const headersList = await headers();
  const xff = headersList.get('x-forwarded-for') || '';
  const clientIp = xff.split(',')[0]?.trim() || headersList.get('x-real-ip') || '';

  const backendHeaders: Record<string, string> = {};
  // Pass the real client IP with HMAC proxy-secret proof so backend rate
  // limiting on /api/shared/{token} counts per real visitor, not per Vercel
  // egress IP. Same trust model as /api/proxy.
  if (clientIp && AUTH_SECRET) {
    backendHeaders['X-Real-Client-IP'] = clientIp;
    backendHeaders['X-Proxy-IP-Secret'] = AUTH_SECRET;
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
  const preview = data.messages?.find((m: { role: string }) => m.role === 'assistant')?.content?.slice(0, 150) || '';
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
          {data.messages.map((msg: { role: string; content: string; citations?: { text_snippet: string; page: number; document_filename: string }[] }, i: number) => (
            <div key={i} className={msg.role === 'user' ? 'flex justify-end' : ''}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
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
