"use client";

import Link from 'next/link';
import { useLocale } from '../../i18n';
import { usePageTitle } from '../../lib/usePageTitle';

export default function PrivacyPageClient() {
  const { t, tOr } = useLocale();
  usePageTitle(t('privacy.title'));

  return (
    <main id="main-content" className="min-h-screen bg-zinc-50 dark:bg-zinc-900 py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white dark:bg-zinc-800 rounded-xl p-8 shadow-sm">
        <h1 className="text-2xl font-semibold mb-6 dark:text-white">{t('privacy.title')}</h1>

        <div className="prose dark:prose-invert max-w-none space-y-6 text-zinc-700 dark:text-zinc-300">
          <section className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/40 p-4">
            <h2 className="text-lg font-semibold mb-2 dark:text-white">
              {tOr('privacy.controller.title', 'Data Controller (GDPR Art. 4(7))')}
            </h2>
            <p className="mb-2">
              {tOr(
                'privacy.controller.intro',
                'The controller responsible for the processing of personal data on this website is:'
              )}
            </p>
            <address className="not-italic leading-7">
              <strong className="text-zinc-900 dark:text-zinc-100">Yijie Ma</strong><br />
              [BUSINESS_ADDRESS_LINE1]<br />
              [PLZ] [CITY]<br />
              Germany<br />
              <a href="mailto:privacy@doctalk.site" className="text-blue-600 dark:text-blue-400 hover:underline">
                privacy@doctalk.site
              </a>
            </address>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2 dark:text-white">{t('privacy.section1.title')}</h2>
            <p>{t('privacy.section1.content')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2 dark:text-white">{t('privacy.section2.title')}</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>{t('privacy.section2.item1')}</li>
              <li>{t('privacy.section2.item2')}</li>
              <li>{t('privacy.section2.item3')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2 dark:text-white">{t('privacy.section3.title')}</h2>
            <p>{t('privacy.section3.content')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2 dark:text-white">{t('privacy.section4.title')}</h2>
            <p>{t('privacy.section4.content')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2 dark:text-white">{t('privacy.section5.title')}</h2>
            <p>{t('privacy.section5.content')}</p>
          </section>
        </div>

        <div className="mt-8 pt-6 border-t dark:border-zinc-700 text-sm text-zinc-500">
          <p>{t('privacy.lastUpdated')}: 2026-02-05</p>
        </div>

        <Link href="/" className="inline-block mt-6 text-zinc-600 hover:underline focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm">
          ← {t('common.backToHome')}
        </Link>
      </div>
    </main>
  );
}
