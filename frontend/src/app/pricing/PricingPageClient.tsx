"use client";
import React from 'react';
import Link from 'next/link';
import { FileText, MessageSquare, ShieldCheck } from 'lucide-react';
import { useLocale } from '../../i18n';
import MarketingShell from '../../components/marketing/MarketingShell';
import EdPageHero from '../../components/marketing/EdPageHero';
import EdSection from '../../components/marketing/EdSection';
import EdProse from '../../components/marketing/EdProse';
import EdCardGrid from '../../components/marketing/EdCardGrid';
import EdCheckList from '../../components/marketing/EdCheckList';
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

  const headStyle: React.CSSProperties = {
    padding: '14px 18px',
    textAlign: 'left',
  };
  const cellStyle: React.CSSProperties = {
    padding: '13px 18px',
    textAlign: 'left',
  };

  const heroMeta = (
    <div>
      <div className="flex gap-4 flex-wrap items-center">
        <Link
          href={billingHref({ plan: 'plus', source: 'pricing_hero' })}
          onClick={() => trackEvent('upgrade_click', { plan: 'plus', period: 'monthly', source: 'pricing_hero' })}
          className="ed-cta"
        >
          {t('pricing.plus.cta')}
        </Link>
        <Link href="/demo" className="ed-link">
          {t('pricing.tryDemo')} <span aria-hidden="true">→</span>
        </Link>
      </div>
      <div
        style={{
          marginTop: '20px',
          maxWidth: '620px',
          border: '1px solid var(--ed-rule)',
          padding: '12px 16px',
        }}
      >
        <p className="ed-body">
          <strong>{tOr('pricing.refundPolicy.title', '7-day fair-use refund.')}</strong>{' '}
          {tOr('pricing.refundPolicy.body', 'If DocTalk is not a fit and usage is low, cancel within 7 days and request a refund review.')}
        </p>
      </div>
    </div>
  );

  return (
    <MarketingShell
      breadcrumb={[
        { label: t('useCasesHub.breadcrumb.home'), href: '/' },
        { label: t('pricing.eyebrow') },
      ]}
    >
      <EdPageHero
        eyebrow={t('pricing.eyebrow')}
        title={t('pricing.headline')}
        lede={t('pricing.description')}
        meta={heroMeta}
      />

      <EdSection alt title={tOr('pricing.creditGuide.title', 'Credits map to real work')}>
        <EdCardGrid
          columns={3}
          items={creditGuide.map((c) => ({ title: c.title, body: c.body, icon: c.icon }))}
        />
      </EdSection>

      <EdSection>
        <div
          className="grid grid-cols-1 lg:grid-cols-3"
          style={{ gap: '20px', gridAutoRows: '1fr' }}
        >
          {plans.map((plan) => (
            <div
              key={plan.nameKey}
              className="ed-card h-full"
              style={{
                display: 'flex',
                flexDirection: 'column',
                ...(plan.featured ? { borderTop: '3px solid var(--ed-signal)' } : {}),
              }}
            >
              <div className="ed-label">{tOr(plan.meterKey, plan.meterFallback)}</div>
              <div
                style={{
                  marginTop: '10px',
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '10px',
                  flexWrap: 'wrap',
                }}
              >
                <h3 className="ed-h3">{t(plan.nameKey)}</h3>
                {plan.featured && (
                  <span className="ed-label" style={{ color: 'var(--ed-signal)' }}>
                    {t('pricing.mostPopular')}
                  </span>
                )}
              </div>
              <p className="ed-body" style={{ marginTop: '10px' }}>
                {t(plan.summaryKey)}
              </p>
              <p
                className="ed-caption"
                style={{
                  marginTop: '12px',
                  border: '1px solid var(--ed-rule)',
                  padding: '8px 12px',
                }}
              >
                {tOr(plan.fitKey, plan.fitFallback)}
              </p>
              <div
                style={{
                  marginTop: '18px',
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '6px',
                }}
              >
                <span className="ed-num">{t(plan.priceKey)}</span>
                <span className="ed-caption">{t(plan.cadenceKey)}</span>
              </div>
              <div style={{ flex: 1, marginTop: '18px' }}>
                <EdCheckList items={plan.featureKeys.map((k) => t(k))} />
              </div>
              <Link
                href={plan.ctaHref}
                onClick={() => {
                  if (plan.intentPlan) {
                    trackEvent('upgrade_click', { plan: plan.intentPlan, period: 'monthly', source: 'pricing' });
                  }
                }}
                className="ed-cta"
                style={{ display: 'flex', width: '100%', justifyContent: 'center', marginTop: '24px' }}
              >
                {t(plan.ctaKey)}
              </Link>
            </div>
          ))}
        </div>
      </EdSection>

      <EdSection alt title={t('pricing.comparison.title')}>
        <p className="ed-lede">{t('pricing.comparison.description')}</p>
        <div style={{ overflowX: 'auto', marginTop: '32px' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              minWidth: '600px',
              border: '1px solid var(--ed-rule)',
            }}
          >
            <thead>
              <tr style={{ borderBottom: '1px solid var(--ed-rule)' }}>
                <th scope="col" className="ed-label" style={headStyle}>
                  {t('pricing.comparison.feature')}
                </th>
                <th scope="col" className="ed-label" style={headStyle}>
                  {t('pricing.comparison.free')}
                </th>
                <th
                  scope="col"
                  className="ed-label"
                  style={{ ...headStyle, background: 'var(--ed-paper-2)', color: 'var(--ed-signal)' }}
                >
                  {t('pricing.comparison.plus')}
                </th>
                <th scope="col" className="ed-label" style={headStyle}>
                  {t('pricing.comparison.pro')}
                </th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr key={row.labelKey} style={{ borderTop: '1px solid var(--ed-rule)' }}>
                  <th
                    scope="row"
                    className="ed-body"
                    style={{
                      padding: '13px 18px',
                      fontWeight: 500,
                      color: 'var(--ed-ink)',
                      textAlign: 'left',
                    }}
                  >
                    {t(row.labelKey)}
                  </th>
                  <td className="ed-body" style={cellStyle}>
                    {t(row.freeKey)}
                  </td>
                  <td
                    className="ed-body"
                    style={{ ...cellStyle, background: 'var(--ed-paper-2)' }}
                  >
                    {t(row.plusKey)}
                  </td>
                  <td className="ed-body" style={cellStyle}>
                    {t(row.proKey)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </EdSection>

      <EdSection title={t('pricing.bestFit.title')}>
        <EdProse>
          <ul>
            <li>
              <strong>{t('pricing.bestFit.freeLabel')}</strong> {t('pricing.bestFit.freeDesc')}
            </li>
            <li>
              <strong>{t('pricing.bestFit.plusLabel')}</strong> {t('pricing.bestFit.plusDesc')}
            </li>
            <li>
              <strong>{t('pricing.bestFit.proLabel')}</strong> {t('pricing.bestFit.proDesc')}
            </li>
          </ul>
          <p>
            {t('pricing.bestFit.contextNote')}{' '}
            <Link href="/demo" className="ed-inline">
              {t('pricing.bestFit.publicDemo')}
            </Link>
            {t('pricing.bestFit.readThe')}{' '}
            <Link href="/features" className="ed-inline">
              {t('pricing.bestFit.featureOverview')}
            </Link>
            {t('pricing.bestFit.orCompare')}{' '}
            <Link href="/compare" className="ed-inline">
              {t('pricing.bestFit.comparisonHub')}
            </Link>
            .
          </p>
        </EdProse>
      </EdSection>
    </MarketingShell>
  );
}
