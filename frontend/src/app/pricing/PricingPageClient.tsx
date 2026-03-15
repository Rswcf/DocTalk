"use client";
import Link from 'next/link';
import { useLocale } from '../../i18n';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

const plans = [
  {
    nameKey: 'pricing.free.name',
    priceKey: 'pricing.free.price',
    cadenceKey: 'pricing.free.cadence',
    summaryKey: 'pricing.free.summary',
    featureKeys: [
      'pricing.free.feature1',
      'pricing.free.feature2',
      'pricing.free.feature3',
      'pricing.free.feature4',
      'pricing.free.feature5',
    ],
    ctaHref: '/auth',
    ctaKey: 'pricing.free.cta',
  },
  {
    nameKey: 'pricing.plus.name',
    priceKey: 'pricing.plus.price',
    cadenceKey: 'pricing.plus.cadence',
    summaryKey: 'pricing.plus.summary',
    featureKeys: [
      'pricing.plus.feature1',
      'pricing.plus.feature2',
      'pricing.plus.feature3',
      'pricing.plus.feature4',
      'pricing.plus.feature5',
    ],
    ctaHref: '/auth?callbackUrl=%2Fbilling',
    ctaKey: 'pricing.plus.cta',
    featured: true,
  },
  {
    nameKey: 'pricing.pro.name',
    priceKey: 'pricing.pro.price',
    cadenceKey: 'pricing.pro.cadence',
    summaryKey: 'pricing.pro.summary',
    featureKeys: [
      'pricing.pro.feature1',
      'pricing.pro.feature2',
      'pricing.pro.feature3',
      'pricing.pro.feature4',
      'pricing.pro.feature5',
    ],
    ctaHref: '/auth?callbackUrl=%2Fbilling',
    ctaKey: 'pricing.pro.cta',
  },
];

const comparisonRows = [
  {
    labelKey: 'pricing.comparison.monthlyCredits',
    freeKey: 'pricing.comparison.credits500',
    plusKey: 'pricing.comparison.credits3000',
    proKey: 'pricing.comparison.credits9000',
  },
  {
    labelKey: 'pricing.comparison.uploadLimit',
    freeKey: 'pricing.comparison.upload25',
    plusKey: 'pricing.comparison.upload50',
    proKey: 'pricing.comparison.upload100',
  },
  {
    labelKey: 'pricing.comparison.documentLimit',
    freeKey: 'pricing.comparison.docs3',
    plusKey: 'pricing.comparison.docs20',
    proKey: 'pricing.comparison.docsUnlimited',
  },
  {
    labelKey: 'pricing.comparison.aiModes',
    freeKey: 'pricing.comparison.modesQuickBalanced',
    plusKey: 'pricing.comparison.modesAll',
    proKey: 'pricing.comparison.modesAll',
  },
  {
    labelKey: 'pricing.comparison.export',
    freeKey: 'pricing.comparison.exportNo',
    plusKey: 'pricing.comparison.exportMarkdown',
    proKey: 'pricing.comparison.exportCustom',
  },
];

export default function PricingPageClient() {
  const { t } = useLocale();

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
      <Header variant="minimal" />
      <main id="main-content" className="flex-1 px-6 py-16">
        <div className="mx-auto max-w-6xl space-y-16">
          <section className="mx-auto max-w-3xl text-center space-y-5">
            <p className="text-sm font-medium tracking-[0.18em] uppercase text-zinc-500 dark:text-zinc-400">
              {t('pricing.eyebrow')}
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
              {t('pricing.headline')}
            </h1>
            <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
              {t('pricing.description')}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/auth?callbackUrl=%2Fbilling"
                className="inline-flex items-center rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {t('pricing.startFree')}
              </Link>
              <Link
                href="/demo"
                className="inline-flex items-center rounded-lg border border-zinc-300 px-6 py-3 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:text-zinc-100"
              >
                {t('pricing.tryDemo')}
              </Link>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-3">
            {plans.map((plan) => (
              <article
                key={plan.nameKey}
                className={`rounded-3xl border p-8 shadow-sm ${
                  plan.featured
                    ? 'border-indigo-500 bg-indigo-50/50 dark:border-indigo-400 dark:bg-indigo-950/20'
                    : 'border-zinc-200 dark:border-zinc-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{t(plan.nameKey)}</h2>
                  {plan.featured && (
                    <span className="rounded-full bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white dark:bg-indigo-500">
                      {t('pricing.mostPopular')}
                    </span>
                  )}
                </div>
                <p className="mt-4 text-sm leading-7 text-zinc-600 dark:text-zinc-400">{t(plan.summaryKey)}</p>
                <div className="mt-6 flex items-end gap-1">
                  <span className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                    {t(plan.priceKey)}
                  </span>
                  <span className="pb-1 text-sm text-zinc-500 dark:text-zinc-400">{t(plan.cadenceKey)}</span>
                </div>
                <ul className="mt-6 space-y-3 text-sm leading-7 text-zinc-600 dark:text-zinc-400">
                  {plan.featureKeys.map((featureKey) => (
                    <li key={featureKey} className="flex gap-3">
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-indigo-500 dark:bg-indigo-400" />
                      <span>{t(featureKey)}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.ctaHref}
                  className={`mt-8 inline-flex w-full items-center justify-center rounded-lg px-5 py-3 text-sm font-medium transition-colors ${
                    plan.featured
                      ? 'bg-indigo-600 text-white hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400'
                      : 'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200'
                  }`}
                >
                  {t(plan.ctaKey)}
                </Link>
              </article>
            ))}
          </section>

          <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-3xl border border-zinc-200 p-8 dark:border-zinc-800">
              <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                {t('pricing.comparison.title')}
              </h2>
              <p className="mt-4 text-base leading-8 text-zinc-600 dark:text-zinc-400">
                {t('pricing.comparison.description')}
              </p>
              <div className="mt-8 overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800">
                      <th scope="col" className="py-3 pr-4 font-medium text-zinc-500 dark:text-zinc-400">{t('pricing.comparison.feature')}</th>
                      <th scope="col" className="py-3 px-4 font-medium text-zinc-500 dark:text-zinc-400">{t('pricing.comparison.free')}</th>
                      <th scope="col" className="py-3 px-4 font-medium text-zinc-500 dark:text-zinc-400">{t('pricing.comparison.plus')}</th>
                      <th scope="col" className="py-3 pl-4 font-medium text-zinc-500 dark:text-zinc-400">{t('pricing.comparison.pro')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonRows.map((row) => (
                      <tr key={row.labelKey} className="border-b border-zinc-100 dark:border-zinc-900">
                        <th scope="row" className="py-3 pr-4 font-medium text-zinc-700 dark:text-zinc-300">{t(row.labelKey)}</th>
                        <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">{t(row.freeKey)}</td>
                        <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">{t(row.plusKey)}</td>
                        <td className="py-3 pl-4 text-zinc-600 dark:text-zinc-400">{t(row.proKey)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <aside className="rounded-3xl bg-zinc-50 p-8 dark:bg-zinc-900/60">
              <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                {t('pricing.bestFit.title')}
              </h2>
              <ul className="mt-5 space-y-4 text-sm leading-7 text-zinc-600 dark:text-zinc-400">
                <li>
                  <strong className="text-zinc-900 dark:text-zinc-100">{t('pricing.bestFit.freeLabel')}</strong>{' '}
                  {t('pricing.bestFit.freeDesc')}
                </li>
                <li>
                  <strong className="text-zinc-900 dark:text-zinc-100">{t('pricing.bestFit.plusLabel')}</strong>{' '}
                  {t('pricing.bestFit.plusDesc')}
                </li>
                <li>
                  <strong className="text-zinc-900 dark:text-zinc-100">{t('pricing.bestFit.proLabel')}</strong>{' '}
                  {t('pricing.bestFit.proDesc')}
                </li>
              </ul>
              <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
                <p className="text-sm leading-7 text-zinc-600 dark:text-zinc-400">
                  {t('pricing.bestFit.contextNote')}{' '}
                  <Link href="/demo" className="text-indigo-600 hover:underline dark:text-indigo-400">
                    {t('pricing.bestFit.publicDemo')}
                  </Link>
                  {t('pricing.bestFit.readThe')}{' '}
                  <Link href="/features" className="text-indigo-600 hover:underline dark:text-indigo-400">
                    {t('pricing.bestFit.featureOverview')}
                  </Link>
                  {t('pricing.bestFit.orCompare')}{' '}
                  <Link href="/compare" className="text-indigo-600 hover:underline dark:text-indigo-400">
                    {t('pricing.bestFit.comparisonHub')}
                  </Link>
                  .
                </p>
              </div>
            </aside>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
