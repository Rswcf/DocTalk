"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, BookOpen, FileSignature, Loader2 } from 'lucide-react';
import { useLocale } from '../../i18n';
import Header from '../../components/Header';
import { getDemoDocuments, type DemoDocument } from '../../lib/api';
import { usePageTitle } from '../../lib/usePageTitle';

const SAMPLE_CONFIG: Record<string, { icon: typeof FileText; titleKey: string; descKey: string; questionKey: string }> = {
  'alphabet-earnings': {
    icon: FileText,
    titleKey: 'demo.sample.earnings.title',
    descKey: 'demo.sample.earnings.desc',
    questionKey: 'demo.sample.earnings.question',
  },
  'attention-paper': {
    icon: BookOpen,
    titleKey: 'demo.sample.paper.title',
    descKey: 'demo.sample.paper.desc',
    questionKey: 'demo.sample.paper.question',
  },
  'court-filing': {
    icon: FileSignature,
    titleKey: 'demo.sample.court.title',
    descKey: 'demo.sample.court.desc',
    questionKey: 'demo.sample.court.question',
  },
};

export default function DemoPageClient() {
  usePageTitle('Demo');

  const { t } = useLocale();
  const [docs, setDocs] = useState<DemoDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchDocs = () => {
    setLoading(true);
    setError(false);
    getDemoDocuments()
      .then(setDocs)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
      <Header variant="minimal" />
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <h1 className="text-3xl font-bold mb-2 text-zinc-900 dark:text-zinc-50">{t('demo.title')}</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mb-3 text-center max-w-md">
          {t('demo.subtitle')}
        </p>
        <p className="text-sm text-zinc-400 dark:text-zinc-500 mb-10 text-center">
          {t('demo.freeMessages')}
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-zinc-500">
            <Loader2 aria-hidden="true" className="animate-spin" size={20} />
            <span>{t('common.loading')}</span>
          </div>
        ) : error ? (
          <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
            <p>{t('common.error') || 'Failed to load demo documents'}</p>
            <button
              onClick={fetchDocs}
              className="mt-2 text-sm underline hover:text-zinc-700 dark:hover:text-zinc-300 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm"
            >
              {t('common.retry') || 'Retry'}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full">
            {docs.map((doc) => {
              const config = SAMPLE_CONFIG[doc.slug];
              if (!config) return null;
              const Icon = config.icon;
              const isReady = doc.status === 'ready';
              const cardContent = (
                <>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-100 dark:border-zinc-800 shrink-0">
                      <Icon aria-hidden="true" size={24} className="text-zinc-600 dark:text-zinc-400" />
                    </div>
                    <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-600
                                   dark:group-hover:text-zinc-300 transition-colors min-w-0 break-words">
                      {t(config.titleKey)}
                    </h2>
                    {!isReady && (
                      <span className="ml-auto text-xs bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 px-2 py-0.5 rounded-full">
                        {t('demo.processing')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                    {t(config.descKey)}
                  </p>
                  <div className="mt-auto pt-3 border-t border-zinc-200 dark:border-zinc-800">
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">
                      &ldquo;{t(config.questionKey)}&rdquo;
                    </p>
                  </div>
                </>
              );
              return isReady ? (
                <Link
                  key={doc.slug}
                  href={`/d/${doc.document_id}`}
                  className="flex flex-col p-6 bg-white dark:bg-zinc-950 rounded-xl border
                             border-zinc-100 dark:border-zinc-800 shadow-sm hover:shadow-md
                             hover:-translate-y-1 transition-[box-shadow,transform] duration-150 group focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
                >
                  {cardContent}
                </Link>
              ) : (
                <div
                  key={doc.slug}
                  className="flex flex-col p-6 bg-white dark:bg-zinc-950 rounded-xl border
                             border-zinc-100 dark:border-zinc-800 shadow-sm opacity-60 cursor-not-allowed"
                >
                  {cardContent}
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-10 text-sm text-zinc-500 dark:text-zinc-400">
          {t('demo.hint')}
        </p>

        <Link href="/" className="mt-4 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm">
          &larr; {t('demo.backToHome')}
        </Link>
      </div>
    </div>
  );
}
