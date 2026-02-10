"use client";

import Link from 'next/link';
import { useLocale } from '../../i18n';

export default function TermsPage() {
  const { t } = useLocale();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white dark:bg-zinc-800 rounded-xl p-8 shadow-sm">
        <h1 className="text-2xl font-bold mb-6 dark:text-white">{t('terms.title')}</h1>
        
        <div className="prose dark:prose-invert max-w-none space-y-6 text-zinc-700 dark:text-zinc-300">
          <section>
            <h2 className="text-lg font-semibold mb-2 dark:text-white">{t('terms.section1.title')}</h2>
            <p>{t('terms.section1.content')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2 dark:text-white">{t('terms.section2.title')}</h2>
            <p>{t('terms.section2.content')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2 dark:text-white">{t('terms.section3.title')}</h2>
            <p>{t('terms.section3.content')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2 dark:text-white">{t('terms.section4.title')}</h2>
            <p>{t('terms.section4.content')}</p>
          </section>
        </div>

        <div className="mt-8 pt-6 border-t dark:border-zinc-700 text-sm text-zinc-500">
          <p>{t('terms.lastUpdated')}: 2026-02-05</p>
        </div>

        <Link href="/" className="inline-block mt-6 text-zinc-600 hover:underline focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm">
          ← {t('common.backToHome')}
        </Link>
      </div>
    </div>
  );
}

