"use client";

import React from 'react';
import Link from 'next/link';
import { useLocale } from '../../../i18n';
import {
  TrendingUp,
  Search,
  FileText,
  BarChart3,
} from 'lucide-react';
import MarketingShell from '../../../components/marketing/MarketingShell';
import EdPageHero from '../../../components/marketing/EdPageHero';
import EdSection from '../../../components/marketing/EdSection';
import EdProse from '../../../components/marketing/EdProse';
import EdFeatureList from '../../../components/marketing/EdFeatureList';
import EdCardGrid from '../../../components/marketing/EdCardGrid';
import EdFaqList from '../../../components/marketing/EdFaqList';
import EdCtaBanner from '../../../components/marketing/EdCtaBanner';

const featureIcons = [BarChart3, TrendingUp, Search, FileText];
const featureKeys = ['extractMetrics', 'comparePeriods', 'summarizeRisks', 'findDisclosures'];
const docTypeKeys = ['pdf10K', 'xlsxModels', 'docxReports', 'pptxPresentations'];
const useCaseKeys = ['annualReport', 'earningsCall', 'quarterlyComparison', 'dueDiligence'];

export default function FinanceClient() {
  const { t } = useLocale();

  const faqItems = [
    { question: t('useCasesFinance.faq.q1.question'), answer: t('useCasesFinance.faq.q1.answer') },
    { question: t('useCasesFinance.faq.q2.question'), answer: t('useCasesFinance.faq.q2.answer') },
    { question: t('useCasesFinance.faq.q3.question'), answer: t('useCasesFinance.faq.q3.answer') },
    { question: t('useCasesFinance.faq.q4.question'), answer: t('useCasesFinance.faq.q4.answer') },
    { question: t('useCasesFinance.faq.q5.question'), answer: t('useCasesFinance.faq.q5.answer') },
  ];

  const features = featureKeys.map((key, i) => ({
    icon: featureIcons[i],
    title: t(`useCasesFinance.features.${key}.title`),
    description: t(`useCasesFinance.features.${key}.description`),
  }));

  const docTypes = docTypeKeys.map((key) => ({
    format: t(`useCasesFinance.docTypes.${key}.format`),
    detail: t(`useCasesFinance.docTypes.${key}.detail`),
  }));

  return (
    <MarketingShell
      breadcrumb={[
        { label: t('useCasesFinance.breadcrumb.home'), href: '/' },
        { label: t('useCasesFinance.breadcrumb.useCases'), href: '/use-cases' },
        { label: t('useCasesFinance.breadcrumb.current') },
      ]}
    >
      <EdPageHero
        icon={TrendingUp}
        title={t('useCasesFinance.heroTitle')}
        lede={t('useCasesFinance.heroDescription')}
        primaryCta={{ label: t('useCasesFinance.heroCta'), href: '/demo' }}
      />

      <EdSection title={t('useCasesFinance.challenge.title')}>
        <EdProse>
          <p>{t('useCasesFinance.challenge.p1')}</p>
          <p>
            {t('useCasesFinance.challenge.p2')}{' '}
            Public filings on <a href="https://www.sec.gov/edgar/searchedgar/companysearch" target="_blank" rel="noopener noreferrer">SEC EDGAR</a> can run hundreds of pages.
          </p>
          <p>
            {t('useCasesFinance.challenge.p3')}{' '}
            Understanding <a href="https://www.sec.gov/answers/reada10k.htm" target="_blank" rel="noopener noreferrer">annual reports and 10-K filings</a> is critical for investment decisions.
          </p>
          <p>{t('useCasesFinance.challenge.p4')}</p>
        </EdProse>
      </EdSection>

      <EdSection alt title={t('useCasesFinance.howItHelps.title')}>
        <EdFeatureList
          items={features.map((f) => ({ title: f.title, body: f.description, icon: f.icon }))}
        />
      </EdSection>

      <EdSection title={t('useCasesFinance.docTypes.title')}>
        <p className="ed-body" style={{ marginBottom: '24px' }}>
          {t('useCasesFinance.docTypes.description')}{' '}
          <Link href="/features/multi-format" className="ed-inline">
            {t('useCasesFinance.docTypes.formatsLink')}
          </Link>
          {t('useCasesFinance.docTypes.descriptionSuffix')}
        </p>
        <EdCardGrid
          columns={2}
          items={docTypes.map((d) => ({ title: d.format, body: d.detail }))}
        />
      </EdSection>

      <EdSection alt title={t('useCasesFinance.realWorld.title')}>
        {useCaseKeys.map((key, i) => {
          const p2 = t(`useCasesFinance.realWorld.${key}.p2`);
          return (
            <div key={key} style={i > 0 ? { marginTop: '40px' } : undefined}>
              <h3 className="ed-h3">{t(`useCasesFinance.realWorld.${key}.title`)}</h3>
              <EdProse className="mt-3">
                <p>{t(`useCasesFinance.realWorld.${key}.p1`)}</p>
                {p2 && <p>{p2}</p>}
              </EdProse>
            </div>
          );
        })}
      </EdSection>

      <EdSection title={t('useCasesFinance.whyCitations.title')}>
        <EdProse>
          <p>{t('useCasesFinance.whyCitations.p1')}</p>
          <p>
            {t('useCasesFinance.whyCitations.p2pre')}
            <Link href="/features/citations" className="ed-inline">{t('useCasesFinance.whyCitations.p2link')}</Link>
            {t('useCasesFinance.whyCitations.p2post')}
          </p>
          <p>{t('useCasesFinance.whyCitations.p3')}</p>
        </EdProse>
      </EdSection>

      <EdSection alt title={t('useCasesFinance.excel.title')}>
        <EdProse>
          <p>{t('useCasesFinance.excel.p1')}</p>
          <p>{t('useCasesFinance.excel.p2')}</p>
          <p>{t('useCasesFinance.excel.p3')}</p>
        </EdProse>
      </EdSection>

      <EdSection title={t('useCasesFinance.faq.title')}>
        <EdFaqList items={faqItems} />
      </EdSection>

      <EdCtaBanner
        title={t('useCasesFinance.cta.title')}
        description={t('useCasesFinance.cta.description')}
        primary={{ label: t('useCasesFinance.cta.tryFreeDemo'), href: '/demo' }}
        secondary={{ label: t('useCasesFinance.cta.viewPricing'), href: '/pricing' }}
      />
    </MarketingShell>
  );
}
