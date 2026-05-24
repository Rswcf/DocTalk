import React from 'react';
import Link from 'next/link';
import {
  Scale,
  Search,
  FileText,
  Shield,
  Clock,
  Quote,
  Upload,
  MessageSquare,
  CheckCircle,
  Lock,
  AlertTriangle,
} from 'lucide-react';
import MarketingShell from '../../../components/marketing/MarketingShell';
import EdPageHero from '../../../components/marketing/EdPageHero';
import EdSection from '../../../components/marketing/EdSection';
import EdProse from '../../../components/marketing/EdProse';
import EdFeatureList from '../../../components/marketing/EdFeatureList';
import EdCardGrid from '../../../components/marketing/EdCardGrid';
import EdStepRow from '../../../components/marketing/EdStepRow';
import EdFaqList from '../../../components/marketing/EdFaqList';
import EdCtaBanner from '../../../components/marketing/EdCtaBanner';
import MarketingLocaleLinks from '../../../components/marketing/MarketingLocaleLinks';
import { getServerT } from '../../../i18n/server';
import { getChromeStrings } from '../../../i18n/chrome';
import { localizedHrefIfAvailable } from '../../../i18n/routing';

const featureIcons = [Search, Clock, FileText, AlertTriangle, Quote];
const featureKeys = ['clauseExtraction', 'dueDiligence', 'filingSummarization', 'riskAssessment', 'keyTerms'];
const docTypeKeys = ['pdfContracts', 'docxBriefs', 'courtFilings', 'regulatory'];
const useCaseKeys = ['contractReview', 'dueDiligenceCase', 'courtFiling', 'patentReview'];
const securityIcons = [Lock, Shield, FileText, CheckCircle];
const securityKeys = ['encryption', 'noTraining', 'gdpr', 'dataExport'];
const stepIcons = [Upload, MessageSquare, CheckCircle];
const stepKeys = ['upload', 'ask', 'verify'];

/**
 * Server-rendered use-case page. Translations are resolved on the server via
 * `getServerT(locale)` so the initial HTML at `/{locale}/use-cases/lawyers` is
 * in the target language (indexable without JS). Internal links are prefixed
 * with the locale so in-language navigation is preserved. The icon-bearing kit
 * components (EdFeatureList/EdCardGrid/EdStepRow/EdPageHero) are server
 * components, so the icon refs never cross a client boundary; only string props
 * pass into the client islands (EdFaqList, MarketingShell).
 */
export default async function LawyersContent({ locale }: { locale: string }) {
  const { t, tOr } = await getServerT(locale);
  const chrome = await getChromeStrings(locale);
  const href = (path: string) => localizedHrefIfAvailable(locale, path);

  const faqItems = [
    { question: t('useCasesLawyers.faq.q1.question'), answer: t('useCasesLawyers.faq.q1.answer') },
    { question: t('useCasesLawyers.faq.q2.question'), answer: t('useCasesLawyers.faq.q2.answer') },
    { question: t('useCasesLawyers.faq.q3.question'), answer: t('useCasesLawyers.faq.q3.answer') },
    { question: t('useCasesLawyers.faq.q4.question'), answer: t('useCasesLawyers.faq.q4.answer') },
    { question: t('useCasesLawyers.faq.q5.question'), answer: t('useCasesLawyers.faq.q5.answer') },
  ];

  const features = featureKeys.map((key, i) => ({
    icon: featureIcons[i],
    title: t(`useCasesLawyers.features.${key}.title`),
    description: t(`useCasesLawyers.features.${key}.description`),
  }));

  const docTypes = docTypeKeys.map((key) => ({
    format: t(`useCasesLawyers.docTypes.${key}.format`),
    detail: t(`useCasesLawyers.docTypes.${key}.detail`),
  }));

  const securityItems = securityKeys.map((key, i) => ({
    icon: securityIcons[i],
    title: t(`useCasesLawyers.security.items.${key}.title`),
    detail: t(`useCasesLawyers.security.items.${key}.detail`),
  }));

  const steps = stepKeys.map((key, i) => ({
    icon: stepIcons[i],
    step: String(i + 1),
    title: t(`useCasesLawyers.steps.${key}.title`),
    description: t(`useCasesLawyers.steps.${key}.description`),
  }));

  return (
    <MarketingShell
      chrome={chrome}
      breadcrumb={[
        { label: t('useCasesLawyers.breadcrumb.home'), href: href('/') },
        { label: t('useCasesLawyers.breadcrumb.useCases'), href: href('/use-cases') },
        { label: t('useCasesLawyers.breadcrumb.current') },
      ]}
    >
      <EdPageHero
        icon={Scale}
        title={t('useCasesLawyers.heroTitle')}
        lede={t('useCasesLawyers.heroDescription')}
        primaryCta={{ label: t('useCasesLawyers.heroCta'), href: href('/demo') }}
      />

      <EdSection title={t('useCasesLawyers.challenge.title')}>
        <EdProse>
          <p>{t('useCasesLawyers.challenge.p1')}</p>
          <p>{t('useCasesLawyers.challenge.p2')}</p>
          <p>{t('useCasesLawyers.challenge.p3')}</p>
          <p>{t('useCasesLawyers.challenge.p4')}</p>
        </EdProse>
      </EdSection>

      <EdSection alt title={t('useCasesLawyers.howItHelps.title')}>
        <EdFeatureList
          items={features.map((f) => ({ title: f.title, body: f.description, icon: f.icon }))}
        />
      </EdSection>

      <EdSection title={t('useCasesLawyers.docTypes.title')}>
        <p className="ed-body" style={{ marginBottom: '24px' }}>
          {t('useCasesLawyers.docTypes.description')}{' '}
          <Link href={href('/features/multi-format')} className="ed-inline">
            {t('useCasesLawyers.docTypes.formatsLink')}
          </Link>
          {t('useCasesLawyers.docTypes.descriptionSuffix')}
        </p>
        <EdCardGrid
          columns={2}
          items={docTypes.map((d) => ({ title: d.format, body: d.detail }))}
        />
      </EdSection>

      <EdSection alt title={t('useCasesLawyers.realWorld.title')}>
        {useCaseKeys.map((key, i) => {
          const p2 = t(`useCasesLawyers.realWorld.${key}.p2`);
          return (
            <div key={key} style={i > 0 ? { marginTop: '40px' } : undefined}>
              <h3 className="ed-h3">{t(`useCasesLawyers.realWorld.${key}.title`)}</h3>
              <EdProse className="mt-3">
                <p>{t(`useCasesLawyers.realWorld.${key}.p1`)}</p>
                {p2 && <p>{p2}</p>}
              </EdProse>
            </div>
          );
        })}
      </EdSection>

      <EdSection title={t('useCasesLawyers.whyCitations.title')}>
        <EdProse>
          <p>{t('useCasesLawyers.whyCitations.p1')}</p>
          <p>{t('useCasesLawyers.whyCitations.p2')}</p>
          <p>
            {t('useCasesLawyers.whyCitations.p3pre')}
            <Link href={href('/features/citations')} className="ed-inline">{t('useCasesLawyers.whyCitations.p3link')}</Link>
            {t('useCasesLawyers.whyCitations.p3post')}
          </p>
          <p>{t('useCasesLawyers.whyCitations.p4')}</p>
        </EdProse>
      </EdSection>

      <EdSection alt title={t('useCasesLawyers.security.title')}>
        <p className="ed-body" style={{ marginBottom: '24px' }}>
          {t('useCasesLawyers.security.description')}
        </p>
        <EdCardGrid
          columns={2}
          items={securityItems.map((s) => ({ title: s.title, body: s.detail, icon: s.icon }))}
        />
      </EdSection>

      <EdSection title={t('useCasesLawyers.steps.title')}>
        <EdStepRow
          steps={steps.map((s) => ({ title: s.title, body: s.description, icon: s.icon }))}
        />
      </EdSection>

      <EdSection alt title={t('useCasesLawyers.faq.title')}>
        <EdFaqList items={faqItems} />
      </EdSection>

      <EdCtaBanner
        title={t('useCasesLawyers.cta.title')}
        description={t('useCasesLawyers.cta.description')}
        primary={{ label: t('useCasesLawyers.cta.tryFreeDemo'), href: href('/demo') }}
        secondary={{ label: t('useCasesLawyers.cta.viewPricing'), href: href('/pricing') }}
      />

      <MarketingLocaleLinks path="/use-cases/lawyers" label={chrome.language} />
    </MarketingShell>
  );
}
