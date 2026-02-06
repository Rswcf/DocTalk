"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, BookOpen, FileSignature, Loader2 } from 'lucide-react';
import { useLocale } from '../../i18n';
import Header from '../../components/Header';
import { getDemoDocuments, type DemoDocument } from '../../lib/api';

const SAMPLE_CONFIG: Record<string, { icon: typeof FileText; titleKey: string; descKey: string; questionKey: string }> = {
  'nvidia-10k': {
    icon: FileText,
    titleKey: 'demo.sample.10k.title',
    descKey: 'demo.sample.10k.desc',
    questionKey: 'demo.sample.10k.question',
  },
  'attention-paper': {
    icon: BookOpen,
    titleKey: 'demo.sample.paper.title',
    descKey: 'demo.sample.paper.desc',
    questionKey: 'demo.sample.paper.question',
  },
  'nda-contract': {
    icon: FileSignature,
    titleKey: 'demo.sample.contract.title',
    descKey: 'demo.sample.contract.desc',
    questionKey: 'demo.sample.contract.question',
  },
};

export default function DemoPage() {
  const { t } = useLocale();
  const [docs, setDocs] = useState<DemoDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDemoDocuments()
      .then(setDocs)
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <Header />
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <h1 className="text-2xl font-bold mb-2 dark:text-white">{t('demo.title')}</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8 text-center max-w-md">
          {t('demo.subtitle')}
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="animate-spin" size={20} />
            <span>{t('common.loading')}</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl w-full">
            {docs.map((doc) => {
              const config = SAMPLE_CONFIG[doc.slug];
              if (!config) return null;
              const Icon = config.icon;
              const isReady = doc.status === 'ready';
              return (
                <Link
                  key={doc.slug}
                  href={`/d/${doc.document_id}`}
                  className="flex flex-col p-6 bg-white dark:bg-gray-800 rounded-xl border
                             border-gray-200 dark:border-gray-700 hover:border-blue-500
                             dark:hover:border-blue-400 hover:shadow-lg transition group"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                      <Icon size={24} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <h2 className="font-semibold dark:text-white group-hover:text-blue-600
                                   dark:group-hover:text-blue-400 transition">
                      {t(config.titleKey)}
                    </h2>
                    {!isReady && (
                      <span className="ml-auto text-xs bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 px-2 py-0.5 rounded-full">
                        {t('demo.processing')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    {t(config.descKey)}
                  </p>
                  <div className="mt-auto pt-3 border-t dark:border-gray-700">
                    <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                      &ldquo;{t(config.questionKey)}&rdquo;
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <p className="mt-8 text-sm text-gray-500 dark:text-gray-400">
          {t('demo.hint')}
        </p>

        <Link href="/" className="mt-4 text-blue-600 hover:underline text-sm">
          &larr; {t('demo.backToHome')}
        </Link>
      </div>
    </div>
  );
}
