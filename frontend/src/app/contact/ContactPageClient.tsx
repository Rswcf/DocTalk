"use client";

import { useLocale } from '../../i18n';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

export default function ContactPageClient() {
  const { t } = useLocale();

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
      <Header variant="minimal" />
      <main id="main-content" className="flex-1 px-6 py-16">
        <div className="max-w-3xl mx-auto space-y-10">
          <section className="space-y-4">
            <p className="text-sm font-medium tracking-[0.18em] uppercase text-zinc-500 dark:text-zinc-300">
              {t('contact.eyebrow')}
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              {t('contact.headline')}
            </h1>
            <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-300">
              {t('contact.description')}
            </p>
          </section>

          <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4">
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              {t('contact.primary.title')}
            </h2>
            <p className="text-base leading-8 text-zinc-600 dark:text-zinc-300">
              {t('contact.primary.emailLabel')}{' '}
              <a
                href="mailto:support@doctalk.site"
                className="text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                support@doctalk.site
              </a>
            </p>
            <p className="text-sm leading-7 text-zinc-500 dark:text-zinc-300">
              {t('contact.primary.useFor')}
            </p>
            <p className="text-sm leading-7 text-zinc-500 dark:text-zinc-300">
              {t('contact.primary.usefulMessages')}
            </p>
          </section>

          <section className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 p-6">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{t('contact.support.title')}</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                {t('contact.support.description')}
              </p>
            </div>
            <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 p-6">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{t('contact.privacy.title')}</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                {t('contact.privacy.description')}
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              {t('contact.when.title')}
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-300">
                  {t('contact.when.goodReasons.title')}
                </h3>
                <ul className="mt-3 space-y-2 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                  <li>{t('contact.when.goodReasons.item1')}</li>
                  <li>{t('contact.when.goodReasons.item2')}</li>
                  <li>{t('contact.when.goodReasons.item3')}</li>
                  <li>{t('contact.when.goodReasons.item4')}</li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-300">
                  {t('contact.when.beforeYouSend.title')}
                </h3>
                <ul className="mt-3 space-y-2 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                  <li>{t('contact.when.beforeYouSend.item1')}</li>
                  <li>{t('contact.when.beforeYouSend.item2')}</li>
                  <li>{t('contact.when.beforeYouSend.item3')}</li>
                  <li>{t('contact.when.beforeYouSend.item4')}</li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
