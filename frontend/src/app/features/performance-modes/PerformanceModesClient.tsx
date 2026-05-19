"use client";

import React from 'react';
import { useLocale } from '../../../i18n';
import {
  Zap,
  Scale,
} from 'lucide-react';
import MarketingShell from '../../../components/marketing/MarketingShell';
import EdPageHero from '../../../components/marketing/EdPageHero';
import EdSection from '../../../components/marketing/EdSection';
import EdProse from '../../../components/marketing/EdProse';
import EdFaqList from '../../../components/marketing/EdFaqList';
import EdCtaBanner from '../../../components/marketing/EdCtaBanner';
import EdRelatedLinks from '../../../components/marketing/EdRelatedLinks';

export default function PerformanceModesClient() {
  const { t } = useLocale();

  const modes = [
    {
      icon: Zap,
      name: t('featuresPerformance.mode.quick.name'),
      model: 'DeepSeek V4 Flash',
      credits: 3,
      speed: t('featuresPerformance.mode.quick.speed'),
      description: t('featuresPerformance.mode.quick.description'),
      bestFor: [
        t('featuresPerformance.mode.quick.bestFor1'),
        t('featuresPerformance.mode.quick.bestFor2'),
        t('featuresPerformance.mode.quick.bestFor3'),
        t('featuresPerformance.mode.quick.bestFor4'),
      ],
      availability: t('featuresPerformance.mode.quick.availability'),
    },
    {
      icon: Scale,
      name: t('featuresPerformance.mode.balanced.name'),
      model: 'DeepSeek V4 Pro',
      credits: 8,
      speed: t('featuresPerformance.mode.balanced.speed'),
      description: t('featuresPerformance.mode.balanced.description'),
      bestFor: [
        t('featuresPerformance.mode.balanced.bestFor1'),
        t('featuresPerformance.mode.balanced.bestFor2'),
        t('featuresPerformance.mode.balanced.bestFor3'),
        t('featuresPerformance.mode.balanced.bestFor4'),
      ],
      availability: t('featuresPerformance.mode.balanced.availability'),
    },
  ];

  const faqItems = [
    {
      q: t('featuresPerformance.faq.q1'),
      a: t('featuresPerformance.faq.a1'),
    },
    {
      q: t('featuresPerformance.faq.q2'),
      a: t('featuresPerformance.faq.a2'),
    },
    {
      q: t('featuresPerformance.faq.q3'),
      a: t('featuresPerformance.faq.a3'),
    },
    {
      q: t('featuresPerformance.faq.q4'),
      a: t('featuresPerformance.faq.a4'),
    },
  ];

  return (
    <MarketingShell
      breadcrumb={[
        { label: t('useCasesHub.breadcrumb.home'), href: '/' },
        { label: t('footer.links.features'), href: '/features' },
        { label: t('featuresPerformance.hero.title') },
      ]}
    >
      <EdPageHero
        eyebrow={t('featuresPerformance.badge')}
        title={t('featuresPerformance.hero.title')}
        lede={t('featuresPerformance.hero.subtitle')}
        primaryCta={{ label: t('featuresPerformance.hero.cta'), href: '/demo' }}
      />

      <EdSection title={t('featuresPerformance.modes.title')}>
        <div
          className="grid grid-cols-1 md:grid-cols-2"
          style={{ gap: '16px', marginTop: '32px', gridAutoRows: '1fr' }}
        >
          {modes.map((mode) => {
            const Icon = mode.icon;
            return (
              <div
                key={mode.name}
                className="ed-card h-full"
                style={{ display: 'flex', flexDirection: 'column' }}
              >
                <div style={{ marginBottom: '10px', color: 'var(--ed-ink-3)' }}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="ed-label" style={{ marginBottom: '8px' }}>
                  {mode.model}
                </div>
                <h3 className="ed-h3">{mode.name}</h3>
                <div
                  className="ed-caption"
                  style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '14px' }}
                >
                  <span>{mode.credits} {t('featuresPerformance.credits')}</span>
                  <span>{mode.speed}</span>
                </div>
                <p className="ed-body" style={{ marginTop: '12px' }}>
                  {mode.description}
                </p>
                <div
                  style={{
                    marginTop: '16px',
                    paddingTop: '16px',
                    borderTop: '1px solid var(--ed-rule)',
                  }}
                >
                  <div className="ed-label">{t('featuresPerformance.bestFor')}</div>
                  <ul className="ed-body" style={{ marginTop: '10px', paddingLeft: '18px', listStyleType: 'disc' }}>
                    {mode.bestFor.map((item, j) => (
                      <li key={item} style={{ marginTop: j === 0 ? 0 : '4px' }}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="ed-caption" style={{ marginTop: '16px' }}>
                  {mode.availability}
                </p>
              </div>
            );
          })}
        </div>
      </EdSection>

      <EdSection alt title={t('featuresPerformance.whenToUse.title')}>
        <EdProse>
          <p>
            <strong>{t('featuresPerformance.mode.quick.name')}</strong>{' '}
            {t('featuresPerformance.whenToUse.quick')}
          </p>
          <p>
            <strong>{t('featuresPerformance.mode.balanced.name')}</strong>{' '}
            {t('featuresPerformance.whenToUse.balanced')}
          </p>
          <p>{t('featuresPerformance.whenToUse.switching')}</p>
        </EdProse>
      </EdSection>

      <EdSection title={t('featuresPerformance.faq.title')}>
        <EdFaqList items={faqItems.map((f) => ({ question: f.q, answer: f.a }))} />
      </EdSection>

      <EdSection alt>
        <EdRelatedLinks
          links={[
            { href: '/pricing', label: t('featuresPerformance.cta.linkPricing') },
            { href: '/features/citations', label: t('featuresPerformance.cta.linkCitations') },
            { href: '/demo', label: t('featuresPerformance.cta.linkDemo') },
          ]}
        />
      </EdSection>

      <EdCtaBanner
        title={t('featuresPerformance.cta.title')}
        description={t('featuresPerformance.cta.subtitle')}
        primary={{ label: t('featuresPerformance.cta.demoButton'), href: '/demo' }}
        secondary={{ label: t('featuresPerformance.cta.pricingButton'), href: '/pricing' }}
      />
    </MarketingShell>
  );
}
