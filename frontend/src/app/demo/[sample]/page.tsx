"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { SendHorizontal, ArrowLeft } from 'lucide-react';
import { useLocale } from '../../../i18n';

const DEMO_MESSAGE_LIMIT = 5;

// Placeholder: In P1, these will be real PDFs
const SAMPLE_PDFS: Record<string, string> = {
  '10k': '/samples/placeholder.pdf',
  'paper': '/samples/placeholder.pdf',
  'contract': '/samples/placeholder.pdf',
};

interface DemoMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

export default function DemoReadPage() {
  const { sample } = useParams<{ sample: string }>();
  const { status } = useSession();
  const router = useRouter();
  const { t } = useLocale();

  const [messages, setMessages] = useState<DemoMessage[]>([]);
  const [input, setInput] = useState('');
  const [remaining, setRemaining] = useState(DEMO_MESSAGE_LIMIT);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isLoggedIn = status === 'authenticated';
  const pdfUrl = SAMPLE_PDFS[sample] || SAMPLE_PDFS['10k'];

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    if (remaining <= 0) {
      router.push('?auth=1', { scroll: false });
      return;
    }

    const userMsg: DemoMessage = {
      id: `demo_${Date.now()}_u`,
      role: 'user',
      text: text.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setRemaining((r) => r - 1);
    setIsLoading(true);

    // Simulate AI response (placeholder for P1 real integration)
    setTimeout(() => {
      const assistantMsg: DemoMessage = {
        id: `demo_${Date.now()}_a`,
        role: 'assistant',
        text: t('demo.placeholderResponse'),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsLoading(false);
    }, 1000);
  }, [remaining, isLoading, router, t]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top Banner */}
      <div className="bg-blue-50 dark:bg-blue-900/30 border-b dark:border-gray-700 px-4 py-2 
                      flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Link href="/demo" className="text-gray-600 dark:text-gray-400 hover:text-gray-800">
            <ArrowLeft size={18} />
          </Link>
          <span className="text-gray-600 dark:text-gray-400">
            {t('demo.viewing')}: {t(`demo.sample.${sample}.title`)}
          </span>
        </div>
        {!isLoggedIn ? (
          <button
            onClick={() => router.push('?auth=1', { scroll: false })}
            className="text-blue-600 dark:text-blue-400 font-medium hover:underline"
          >
            {t('demo.loginToSave')}
          </button>
        ) : (
          <span className="text-green-600 dark:text-green-400">✓ {t('demo.loggedIn')}</span>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Panel */}
        <div className="w-1/2 flex flex-col border-r dark:border-gray-700">
          {/* Messages */}
          <div className="flex-1 overflow-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
                <p>{t('demo.emptyState')}</p>
                <p className="text-sm mt-2">{t(`demo.sample.${sample}.question`)}</p>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`p-3 rounded-lg max-w-[85%] ${
                    m.role === 'user'
                      ? 'bg-blue-600 text-white ml-auto'
                      : 'bg-white dark:bg-gray-800 border dark:border-gray-700'
                  }`}
                >
                  {m.text}
                </div>
              ))
            )}
            {isLoading && (
              <div className="p-3 rounded-lg bg-white dark:bg-gray-800 border dark:border-gray-700 max-w-[85%]">
                <span className="animate-pulse">...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Remaining Counter */}
          <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-400">
            {t('demo.remaining', { count: remaining, total: DEMO_MESSAGE_LIMIT })}
            {!isLoggedIn && remaining < DEMO_MESSAGE_LIMIT && (
              <span> · {t('demo.loginForMore')}</span>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-3 border-t dark:border-gray-700">
            <div className="flex items-end gap-2">
              <textarea
                className="flex-1 border rounded-xl px-3 py-2 text-sm resize-none 
                           focus:outline-none focus:ring-2 focus:ring-blue-500 
                           dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                style={{ minHeight: '40px', maxHeight: '120px' }}
                placeholder={remaining <= 0 ? t('demo.limitReached') : t('chat.placeholder')}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading || remaining <= 0}
                rows={1}
              />
              <button
                type="submit"
                className="p-2 bg-blue-600 text-white rounded-xl disabled:opacity-60 
                           hover:bg-blue-700 transition shrink-0"
                disabled={isLoading || !input.trim() || remaining <= 0}
              >
                <SendHorizontal size={18} />
              </button>
            </div>
          </form>
        </div>

        {/* PDF Placeholder */}
        <div className="w-1/2 flex items-center justify-center bg-white dark:bg-gray-800">
          <div className="text-center text-gray-500 dark:text-gray-400 p-8">
            <p className="text-lg mb-2">{t('demo.pdfPlaceholder')}</p>
            <p className="text-sm">{t('demo.pdfPlaceholderHint')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

