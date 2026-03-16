"use client";

import { useLocale } from '../../i18n';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

export default function AboutPageClient() {
  const { t } = useLocale();

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
      <Header variant="minimal" />
      <main id="main-content" className="flex-1 px-6 py-16">
        <div className="max-w-3xl mx-auto space-y-12">
          <section className="space-y-4">
            <p className="text-sm font-medium tracking-[0.18em] uppercase text-zinc-500 dark:text-zinc-300">
              {t('about.eyebrow')}
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              {t('about.headline')}
            </h1>
            <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-300">
              {t('about.description')}
            </p>
          </section>

          <section className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{t('about.optimizeFor.title')}</h2>
              <ul className="mt-4 space-y-3 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                <li>{t('about.optimizeFor.item1')}</li>
                <li>{t('about.optimizeFor.item2')}</li>
                <li>{t('about.optimizeFor.item3')}</li>
                <li>{t('about.optimizeFor.item4')}</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{t('about.whoUses.title')}</h2>
              <ul className="mt-4 space-y-3 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                <li>{t('about.whoUses.item1')}</li>
                <li>{t('about.whoUses.item2')}</li>
                <li>{t('about.whoUses.item3')}</li>
                <li>{t('about.whoUses.item4')}</li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              {t('about.trust.title')}
            </h2>
            <p className="text-base leading-8 text-zinc-600 dark:text-zinc-300">
              {t('about.trust.paragraph1')}
            </p>
            <p className="text-base leading-8 text-zinc-600 dark:text-zinc-300">
              {t('about.trust.paragraph2')}
            </p>
          </section>

          <section className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{t('about.howItWorks.title')}</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                {t('about.howItWorks.description')}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{t('about.whatWePublish.title')}</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                {t('about.whatWePublish.description')}
              </p>
            </div>
          </section>

          <section className="rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 p-6">
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{t('about.contact.title')}</h2>
            <p className="mt-3 text-base leading-8 text-zinc-600 dark:text-zinc-300">
              {t('about.contact.description1')}{' '}
              <a
                href="mailto:support@doctalk.site"
                className="text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                support@doctalk.site
              </a>
              {t('about.contact.description2')}{' '}
              <a
                href="https://github.com/Rswcf/DocTalk"
                className="text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                GitHub
              </a>
              .
            </p>
            <p className="mt-3 text-sm leading-7 text-zinc-500 dark:text-zinc-300">
              {t('about.contact.evaluationHint')}
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
