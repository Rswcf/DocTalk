
import React from 'react';
import Link from 'next/link';
import { getServerT } from '../../../i18n/server';
import { getChromeStrings } from '../../../i18n/chrome';
import { localizedHrefIfAvailable } from '../../../i18n/routing';
import MarketingLocaleLinks from '../../../components/marketing/MarketingLocaleLinks';
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
const footnoteReviewItems = [
  {
    title: 'Revenue recognition and contract balances',
    body: 'Summarize how the company recognizes revenue, whether deferred revenue changed, and where the filing explains remaining performance obligations.',
  },
  {
    title: 'Debt, leases, and commitments',
    body: 'Find maturity schedules, lease obligations, credit facility terms, covenants, and other off-balance-sheet commitments that can change risk assumptions.',
  },
  {
    title: 'Contingencies and legal proceedings',
    body: 'Surface litigation, regulatory matters, warranty reserves, and loss contingencies that may be material but easy to miss in dense notes.',
  },
  {
    title: 'Accounting policy changes',
    body: 'Identify new standards, estimate changes, impairment charges, and policy language that could affect comparability across reporting periods.',
  },
];

const footnotePromptItems = [
  {
    title: 'Footnote summary prompt',
    body: 'Summarize the financial statement footnotes in this 10-K. Group the answer by revenue recognition, debt, leases, contingencies, tax, segments, and related-party transactions. Cite each source passage.',
  },
  {
    title: 'Change-detection prompt',
    body: 'Which footnotes describe material changes from the prior year? Focus on accounting policies, deferred revenue, debt obligations, legal contingencies, and lease commitments.',
  },
  {
    title: 'Investor memo prompt',
    body: 'Create a diligence-ready memo of the five most important footnote disclosures. For each item, explain why it matters and link the citation to the exact note.',
  },
];

export default async function FinanceContent({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);
  const chrome = await getChromeStrings(locale);
  const href = (p: string) => localizedHrefIfAvailable(locale, p);
  const isEnglish = locale === 'en';

  const faqItems = [
    { question: t('useCasesFinance.faq.q1.question'), answer: t('useCasesFinance.faq.q1.answer') },
    { question: t('useCasesFinance.faq.q2.question'), answer: t('useCasesFinance.faq.q2.answer') },
    { question: t('useCasesFinance.faq.q3.question'), answer: t('useCasesFinance.faq.q3.answer') },
    { question: t('useCasesFinance.faq.q4.question'), answer: t('useCasesFinance.faq.q4.answer') },
    { question: t('useCasesFinance.faq.q5.question'), answer: t('useCasesFinance.faq.q5.answer') },
    ...(isEnglish
      ? [{ question: t('useCasesFinance.faq.q6.question'), answer: t('useCasesFinance.faq.q6.answer') }]
      : []),
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
      chrome={chrome}
      breadcrumb={[
        { label: t('useCasesFinance.breadcrumb.home'), href: href('/') },
        { label: t('useCasesFinance.breadcrumb.useCases'), href: href('/use-cases') },
        { label: t('useCasesFinance.breadcrumb.current') },
      ]}
    >
      <EdPageHero
        icon={TrendingUp}
        title={t('useCasesFinance.heroTitle')}
        lede={t('useCasesFinance.heroDescription')}
        primaryCta={{ label: t('useCasesFinance.heroCta'), href: href('/demo') }}
      />

      <EdSection title={t('useCasesFinance.challenge.title')}>
        <EdProse>
          <p>{t('useCasesFinance.challenge.p1')}</p>
          <p>{t('useCasesFinance.challenge.p2')}</p>
          <p>{t('useCasesFinance.challenge.p3')}</p>
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
          <Link href={href("/features/multi-format")} className="ed-inline">
            {t('useCasesFinance.docTypes.formatsLink')}
          </Link>
          {t('useCasesFinance.docTypes.descriptionSuffix')}
        </p>
        <EdCardGrid
          columns={2}
          items={docTypes.map((d) => ({ title: d.format, body: d.detail }))}
        />
      </EdSection>

      {isEnglish && (
        <EdSection
          alt
          id="summarize-10-k-footnotes"
          title="Summarize 10-K Footnotes and SEC Filings with AI"
        >
          <EdProse>
            <p>
              Financial statement footnotes are one of the highest-value parts of a 10-K because they explain the accounting policies,
              estimates, commitments, and contingencies behind the headline numbers. DocTalk lets analysts upload a filing, ask direct
              questions about the notes, and verify each summary against the cited source passage before it enters a model or memo.
            </p>
            <p>
              Start from a company filing found in{' '}
              <Link href="https://www.sec.gov/search-filings" className="ed-inline" target="_blank" rel="noreferrer">
                SEC EDGAR
              </Link>{' '}
              or an investor relations PDF. The SEC&apos;s Investor.gov describes{' '}
              <Link
                href="https://www.investor.gov/introduction-investing/investing-basics/glossary/form-10-k"
                className="ed-inline"
                target="_blank"
                rel="noreferrer"
              >
                Form 10-K
              </Link>{' '}
              as a comprehensive overview of a company&apos;s business and financial condition, including audited financial statements;
              DocTalk is useful when that overview is too long to review manually and the footnotes need source-level traceability.
            </p>
          </EdProse>

          <div style={{ marginTop: '32px' }}>
            <h3 className="ed-h3">What to ask about 10-K footnotes</h3>
            <div style={{ marginTop: '16px' }}>
              <EdCardGrid columns={2} items={footnoteReviewItems} />
            </div>
          </div>

          <div style={{ marginTop: '36px' }}>
            <h3 className="ed-h3">Example prompts for financial statement footnotes</h3>
            <p className="ed-body" style={{ marginTop: '10px', marginBottom: '16px' }}>
              These prompts target the sections that appear in SEC filing analysis workflows: MD&amp;A, core statements, footnotes,
              risk factors, and cross-period disclosure changes.
            </p>
            <EdCardGrid columns={3} items={footnotePromptItems} />
          </div>

          <EdProse className="mt-8">
            <p>
              The practical advantage is not just speed. A generic chatbot may produce a plausible summary with no audit trail. DocTalk
              keeps each answer tied to the original note, table, or paragraph through{' '}
              <Link href={href('/features/citations')} className="ed-inline">
                citation highlighting
              </Link>
              , so the analyst can inspect the source before relying on the output.
            </p>
          </EdProse>
        </EdSection>
      )}

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
            <Link href={href("/features/citations")} className="ed-inline">{t('useCasesFinance.whyCitations.p2link')}</Link>
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
        primary={{ label: t('useCasesFinance.cta.tryFreeDemo'), href: href('/demo') }}
        secondary={{ label: t('useCasesFinance.cta.viewPricing'), href: href('/pricing') }}
      />
    
      <MarketingLocaleLinks path="/use-cases/finance" label={chrome.language} />
    </MarketingShell>
  );
}
