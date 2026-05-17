"use client";
import Link from 'next/link';
import { ArrowRight, Check, FileText, MessageSquare, ShieldCheck } from 'lucide-react';
import { useLocale } from '../../i18n';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { billingHref } from '../../lib/billingLinks';
import { trackEvent } from '../../lib/analytics';

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
    fitKey: 'pricing.free.fit',
    fitFallback: 'Evaluate citations on a few documents before committing.',
    meterKey: 'pricing.free.meter',
    meterFallback: 'Starter volume',
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
    ctaHref: billingHref({ plan: 'plus', source: 'pricing' }),
    ctaKey: 'pricing.plus.cta',
    intentPlan: 'plus',
    featured: true,
    fitKey: 'pricing.plus.fit',
    fitFallback: 'Weekly document work, research, contract review, and exports.',
    meterKey: 'pricing.plus.meter',
    meterFallback: 'Active workflow',
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
    ctaHref: billingHref({ plan: 'pro', source: 'pricing' }),
    ctaKey: 'pricing.pro.cta',
    intentPlan: 'pro',
    fitKey: 'pricing.pro.fit',
    fitFallback: 'Large files, repeated analysis, custom prompts, and high volume.',
    meterKey: 'pricing.pro.meter',
    meterFallback: 'Power usage',
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
  const { t, tOr } = useLocale();
  const creditGuide = [
    {
      icon: MessageSquare,
      title: tOr('pricing.creditGuide.flash.title', 'Flash questions'),
      body: tOr('pricing.creditGuide.flash.body', 'Use fast cited answers for everyday summaries, lookups, and follow-ups.'),
    },
    {
      icon: FileText,
      title: tOr('pricing.creditGuide.parse.title', 'Document parsing'),
      body: tOr('pricing.creditGuide.parse.body', 'Credits also cover parsing, OCR, and indexing so citations can jump to the source.'),
    },
    {
      icon: ShieldCheck,
      title: tOr('pricing.creditGuide.pro.title', 'Pro analysis'),
      body: tOr('pricing.creditGuide.pro.body', 'Spend more credits when deeper reasoning is worth the extra latency and context.'),
    },
  ];

  return (
    <div className="dt-stitch-theme min-h-screen flex flex-col">
      <Header variant="minimal" />
      <main id="main-content" className="flex-1 px-6 py-14 sm:py-16">
        <div className="mx-auto max-w-6xl space-y-14">
          <section className="grid gap-8 lg:grid-cols-[1fr_0.88fr] lg:items-center">
            <div>
              <p className="mb-4 text-sm font-medium tracking-[0.18em] uppercase text-zinc-500 dark:text-zinc-400">
                {t('pricing.eyebrow')}
              </p>
              <h1 className="font-serif text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
                {t('pricing.headline')}
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
                {t('pricing.description')}
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  href={billingHref({ plan: 'plus', source: 'pricing_hero' })}
                  onClick={() => trackEvent('upgrade_click', { plan: 'plus', period: 'monthly', source: 'pricing_hero' })}
                  className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950"
                >
                  {t('pricing.plus.cta')}
                  <ArrowRight aria-hidden="true" size={16} />
                </Link>
                <Link
                  href="/demo"
                  className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-6 py-3 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950"
                >
                  {t('pricing.tryDemo')}
                </Link>
              </div>
              <div className="mt-5 inline-flex max-w-2xl items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
                <ShieldCheck aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                <p className="leading-6">
                  <strong>{tOr('pricing.refundPolicy.title', '7-day fair-use refund.')}</strong>{' '}
                  {tOr('pricing.refundPolicy.body', 'If DocTalk is not a fit and usage is low, cancel within 7 days and request a refund review.')}
                </p>
              </div>
            </div>

            <aside className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {tOr('pricing.creditGuide.title', 'Credits map to real work')}
                </h2>
                <span className="rounded-md bg-accent-light px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-accent">
                  {tOr('pricing.creditGuide.badge', 'No vague caps')}
                </span>
              </div>
              <div className="space-y-3">
                {creditGuide.map(({ icon: Icon, title, body }) => (
                  <div key={title} className="flex gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white text-accent shadow-sm dark:bg-zinc-900">
                      <Icon aria-hidden="true" size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
                      <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-300">{body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          </section>

          <section className="grid gap-5 lg:grid-cols-3">
            {plans.map((plan) => (
              <article
                key={plan.nameKey}
                className={`relative flex flex-col overflow-hidden rounded-xl border p-6 shadow-sm ${
                  plan.featured
                    ? 'border-accent bg-white ring-1 ring-accent/20 dark:border-accent dark:bg-zinc-900'
                    : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'
                }`}
              >
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div>
                    <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                      {tOr(plan.meterKey, plan.meterFallback)}
                    </p>
                    <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{t(plan.nameKey)}</h2>
                  </div>
                  {plan.featured && (
                    <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
                      {t('pricing.mostPopular')}
                    </span>
                  )}
                </div>
                <p className="text-sm leading-7 text-zinc-600 dark:text-zinc-300">{t(plan.summaryKey)}</p>
                <p className="mt-3 rounded-lg bg-zinc-50 px-3 py-2 text-xs font-medium leading-5 text-zinc-600 dark:bg-zinc-950 dark:text-zinc-300">
                  {tOr(plan.fitKey, plan.fitFallback)}
                </p>
                <div className="mt-6 flex items-end gap-1">
                  <span className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                    {t(plan.priceKey)}
                  </span>
                  <span className="pb-1 text-sm text-zinc-500 dark:text-zinc-300">{t(plan.cadenceKey)}</span>
                </div>
                <ul className="mt-6 space-y-3 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                  {plan.featureKeys.map((featureKey) => (
                    <li key={featureKey} className="flex gap-3">
                      <span className="mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-light text-accent">
                        <Check aria-hidden="true" size={13} />
                      </span>
                      <span>{t(featureKey)}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.ctaHref}
                  onClick={() => {
                    if (plan.intentPlan) {
                      trackEvent('upgrade_click', { plan: plan.intentPlan, period: 'monthly', source: 'pricing' });
                    }
                  }}
                  className={`mt-8 inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-medium transition-colors ${
                    plan.featured
                      ? 'bg-accent text-accent-foreground hover:bg-accent-hover'
                      : 'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200'
                  } focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950`}
                >
                  {t(plan.ctaKey)}
                  <ArrowRight aria-hidden="true" size={15} />
                </Link>
              </article>
            ))}
          </section>

          <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-xl border border-zinc-200 p-8 dark:border-zinc-800">
              <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                {t('pricing.comparison.title')}
              </h2>
              <p className="mt-4 text-base leading-8 text-zinc-600 dark:text-zinc-300">
                {t('pricing.comparison.description')}
              </p>
              <div className="mt-8 overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800">
                      <th scope="col" className="py-3 pr-4 font-medium text-zinc-500 dark:text-zinc-300">{t('pricing.comparison.feature')}</th>
                      <th scope="col" className="py-3 px-4 font-medium text-zinc-500 dark:text-zinc-300">{t('pricing.comparison.free')}</th>
                      <th scope="col" className="py-3 px-4 font-medium text-zinc-500 dark:text-zinc-300">{t('pricing.comparison.plus')}</th>
                      <th scope="col" className="py-3 pl-4 font-medium text-zinc-500 dark:text-zinc-300">{t('pricing.comparison.pro')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonRows.map((row) => (
                      <tr key={row.labelKey} className="border-b border-zinc-100 dark:border-zinc-900">
                        <th scope="row" className="py-3 pr-4 font-medium text-zinc-700 dark:text-zinc-300">{t(row.labelKey)}</th>
                        <td className="py-3 px-4 text-zinc-600 dark:text-zinc-300">{t(row.freeKey)}</td>
                        <td className="py-3 px-4 text-zinc-600 dark:text-zinc-300">{t(row.plusKey)}</td>
                        <td className="py-3 pl-4 text-zinc-600 dark:text-zinc-300">{t(row.proKey)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <aside className="rounded-xl bg-zinc-50 p-8 dark:bg-zinc-900/60">
              <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                {t('pricing.bestFit.title')}
              </h2>
              <ul className="mt-5 space-y-4 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
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
              <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
                <p className="text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                  {t('pricing.bestFit.contextNote')}{' '}
                  <Link href="/demo" className="text-blue-600 hover:underline dark:text-blue-400">
                    {t('pricing.bestFit.publicDemo')}
                  </Link>
                  {t('pricing.bestFit.readThe')}{' '}
                  <Link href="/features" className="text-blue-600 hover:underline dark:text-blue-400">
                    {t('pricing.bestFit.featureOverview')}
                  </Link>
                  {t('pricing.bestFit.orCompare')}{' '}
                  <Link href="/compare" className="text-blue-600 hover:underline dark:text-blue-400">
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
