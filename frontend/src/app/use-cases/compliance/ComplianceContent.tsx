
import React from 'react';
import Link from 'next/link';
import { getServerT } from '../../../i18n/server';
import { getChromeStrings } from '../../../i18n/chrome';
import { localizedHrefIfAvailable } from '../../../i18n/routing';
import MarketingLocaleLinks from '../../../components/marketing/MarketingLocaleLinks';
import {
  Shield,
  FileText,
  Search,
  ClipboardCheck,
  Upload,
  MessageSquare,
  CheckCircle,
  Lock,
  AlertTriangle,
  GitCompare,
  Scale,
  Heart,
  TrendingUp,
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

export default async function ComplianceContent({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);
  const chrome = await getChromeStrings(locale);
  const href = (p: string) => localizedHrefIfAvailable(locale, p);

  const features = [
    {
      icon: Search,
      title: t('useCasesCompliance.feature1Title'),
      description: t('useCasesCompliance.feature1Description'),
    },
    {
      icon: AlertTriangle,
      title: t('useCasesCompliance.feature2Title'),
      description: t('useCasesCompliance.feature2Description'),
    },
    {
      icon: ClipboardCheck,
      title: t('useCasesCompliance.feature3Title'),
      description: t('useCasesCompliance.feature3Description'),
    },
    {
      icon: GitCompare,
      title: t('useCasesCompliance.feature4Title'),
      description: t('useCasesCompliance.feature4Description'),
    },
  ];

  const exampleQuestions = [
    t('useCasesCompliance.exampleQuestion1'),
    t('useCasesCompliance.exampleQuestion2'),
    t('useCasesCompliance.exampleQuestion3'),
    t('useCasesCompliance.exampleQuestion4'),
    t('useCasesCompliance.exampleQuestion5'),
    t('useCasesCompliance.exampleQuestion6'),
  ];

  const docTypes = [
    { format: t('useCasesCompliance.docType1Format'), detail: t('useCasesCompliance.docType1Detail') },
    { format: t('useCasesCompliance.docType2Format'), detail: t('useCasesCompliance.docType2Detail') },
    { format: t('useCasesCompliance.docType3Format'), detail: t('useCasesCompliance.docType3Detail') },
    { format: t('useCasesCompliance.docType4Format'), detail: t('useCasesCompliance.docType4Detail') },
  ];

  const realWorldCases = [
    {
      title: t('useCasesCompliance.realWorld1Title'),
      description: t('useCasesCompliance.realWorld1Description'),
    },
    {
      title: t('useCasesCompliance.realWorld2Title'),
      description: t('useCasesCompliance.realWorld2Description'),
    },
    {
      title: t('useCasesCompliance.realWorld3Title'),
      description: t('useCasesCompliance.realWorld3Description'),
    },
  ];

  const securityItems = [
    { icon: Lock, title: t('useCasesCompliance.security1Title'), detail: t('useCasesCompliance.security1Detail') },
    { icon: Shield, title: t('useCasesCompliance.security2Title'), detail: t('useCasesCompliance.security2Detail') },
    { icon: FileText, title: t('useCasesCompliance.security3Title'), detail: t('useCasesCompliance.security3Detail') },
    { icon: CheckCircle, title: t('useCasesCompliance.security4Title'), detail: t('useCasesCompliance.security4Detail') },
  ];

  const steps = [
    { icon: Upload, step: '1', title: t('useCasesCompliance.step1Title'), description: t('useCasesCompliance.step1Description') },
    { icon: MessageSquare, step: '2', title: t('useCasesCompliance.step2Title'), description: t('useCasesCompliance.step2Description') },
    { icon: CheckCircle, step: '3', title: t('useCasesCompliance.step3Title'), description: t('useCasesCompliance.step3Description') },
  ];

  const relatedUseCases = [
    { href: href('/use-cases/lawyers'), icon: Scale, title: t('useCasesCompliance.related1Title'), body: t('useCasesCompliance.related1Body') },
    { href: href('/use-cases/finance'), icon: TrendingUp, title: t('useCasesCompliance.related2Title'), body: t('useCasesCompliance.related2Body') },
    { href: href('/use-cases/healthcare'), icon: Heart, title: t('useCasesCompliance.related3Title'), body: t('useCasesCompliance.related3Body') },
  ];

  const faqItems = [
    {
      question: t('useCasesCompliance.faq1Q'),
      answer: t('useCasesCompliance.faq1A'),
    },
    {
      question: t('useCasesCompliance.faq2Q'),
      answer: t('useCasesCompliance.faq2A'),
    },
    {
      question: t('useCasesCompliance.faq3Q'),
      answer: t('useCasesCompliance.faq3A'),
    },
    {
      question: t('useCasesCompliance.faq4Q'),
      answer: t('useCasesCompliance.faq4A'),
    },
    {
      question: t('useCasesCompliance.faq5Q'),
      answer: t('useCasesCompliance.faq5A'),
    },
  ];

  return (
    <MarketingShell
      chrome={chrome}
      breadcrumb={[
        { label: t('useCasesCompliance.breadcrumbHome'), href: href('/') },
        { label: t('useCasesCompliance.breadcrumbUseCases'), href: href('/use-cases') },
        { label: t('useCasesCompliance.breadcrumbCurrent') },
      ]}
    >
      <EdPageHero
        icon={Shield}
        title={t('useCasesCompliance.heroTitle')}
        lede={t('useCasesCompliance.heroLede')}
        primaryCta={{ label: t('useCasesCompliance.heroCta'), href: href('/demo') }}
      />

      <EdSection title={t('useCasesCompliance.challengeTitle')}>
        <EdProse>
          <p>
            {t('useCasesCompliance.challengeP1')}
          </p>
          <p>
            {t('useCasesCompliance.challengeP2')}
          </p>
          <p>
            {t('useCasesCompliance.challengeP3Pre')}{' '}
            <a href="https://www.complianceweek.com/" target="_blank" rel="noopener noreferrer">{t('useCasesCompliance.challengeP3Link')}</a>
            {' '}{t('useCasesCompliance.challengeP3Post')}
          </p>
          <p>
            {t('useCasesCompliance.challengeP4')}
          </p>
        </EdProse>
      </EdSection>

      <EdSection alt title={t('useCasesCompliance.howItHelpsTitle')}>
        <EdFeatureList
          items={features.map((f) => ({ title: f.title, body: f.description, icon: f.icon }))}
        />
      </EdSection>

      <EdSection title={t('useCasesCompliance.docTypesTitle')}>
        <p className="ed-body" style={{ marginBottom: '24px' }}>
          {t('useCasesCompliance.docTypesDescription')}{' '}
          <Link href={href("/features/multi-format")} className="ed-inline">
            {t('useCasesCompliance.docTypesFormatsLink')}
          </Link>
          {' '}{t('useCasesCompliance.docTypesDescriptionSuffix')}
        </p>
        <EdCardGrid
          columns={2}
          items={docTypes.map((d) => ({ title: d.format, body: d.detail }))}
        />
      </EdSection>

      <EdSection alt title={t('useCasesCompliance.realWorldTitle')}>
        {realWorldCases.map((item, i) => (
          <div key={item.title} style={i > 0 ? { marginTop: '40px' } : undefined}>
            <h3 className="ed-h3">{item.title}</h3>
            <EdProse className="mt-3">
              <p>{item.description}</p>
            </EdProse>
          </div>
        ))}
      </EdSection>

      <EdSection title={t('useCasesCompliance.exampleQuestionsTitle')}>
        <p className="ed-body" style={{ marginBottom: '24px' }}>
          {t('useCasesCompliance.exampleQuestionsDescription')}
        </p>
        <EdCardGrid
          columns={2}
          items={exampleQuestions.map((q) => ({ title: q }))}
        />
      </EdSection>

      <EdSection alt title={t('useCasesCompliance.securityTitle')}>
        <p className="ed-body" style={{ marginBottom: '24px' }}>
          {t('useCasesCompliance.securityDescription')}
        </p>
        <EdCardGrid
          columns={2}
          items={securityItems.map((s) => ({ title: s.title, body: s.detail, icon: s.icon }))}
        />
      </EdSection>

      <EdSection title={t('useCasesCompliance.stepsTitle')}>
        <EdStepRow
          steps={steps.map((s) => ({ title: s.title, body: s.description, icon: s.icon }))}
        />
      </EdSection>

      <EdSection alt title={t('useCasesCompliance.relatedTitle')}>
        <div
          className="grid grid-cols-1 sm:grid-cols-3"
          style={{ gap: '16px', gridAutoRows: '1fr' }}
        >
          {relatedUseCases.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="ed-card h-full"
                style={{ display: 'flex', flexDirection: 'column' }}
              >
                <div style={{ marginBottom: '10px', color: 'var(--ed-ink-3)' }}>
                  <Icon className="w-4 h-4" />
                </div>
                <h3 className="ed-h3">{item.title}</h3>
                <p className="ed-body" style={{ marginTop: '8px' }}>
                  {item.body}
                </p>
              </Link>
            );
          })}
        </div>
      </EdSection>

      <EdSection title={t('useCasesCompliance.faqTitle')}>
        <EdFaqList items={faqItems} />
      </EdSection>

      <EdCtaBanner
        title={t('useCasesCompliance.ctaTitle')}
        description={t('useCasesCompliance.ctaDescription')}
        primary={{ label: t('useCasesCompliance.ctaPrimary'), href: href('/demo') }}
      />
    
      <MarketingLocaleLinks path="/use-cases/compliance" label={chrome.language} />
    </MarketingShell>
  );
}
