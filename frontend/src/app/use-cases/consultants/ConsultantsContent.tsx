
import React from 'react';
import Link from 'next/link';
import { getServerT } from '../../../i18n/server';
import { getChromeStrings } from '../../../i18n/chrome';
import { localizedHrefIfAvailable } from '../../../i18n/routing';
import MarketingLocaleLinks from '../../../components/marketing/MarketingLocaleLinks';
import {
  Briefcase,
  FileText,
  Search,
  BarChart3,
  ClipboardCheck,
  Upload,
  MessageSquare,
  CheckCircle,
  TrendingUp,
  Scale,
  Lock,
  Shield,
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

export default async function ConsultantsContent({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);
  const chrome = await getChromeStrings(locale);
  const href = (p: string) => localizedHrefIfAvailable(locale, p);

  const features = [
    {
      icon: Search,
      title: t('useCasesConsultants.features.rfp.title'),
      description: t('useCasesConsultants.features.rfp.description'),
    },
    {
      icon: BarChart3,
      title: t('useCasesConsultants.features.marketResearch.title'),
      description: t('useCasesConsultants.features.marketResearch.description'),
    },
    {
      icon: TrendingUp,
      title: t('useCasesConsultants.features.financials.title'),
      description: t('useCasesConsultants.features.financials.description'),
    },
    {
      icon: ClipboardCheck,
      title: t('useCasesConsultants.features.dueDiligence.title'),
      description: t('useCasesConsultants.features.dueDiligence.description'),
    },
  ];

  const exampleQuestions = [
    t('useCasesConsultants.exampleQuestions.q1'),
    t('useCasesConsultants.exampleQuestions.q2'),
    t('useCasesConsultants.exampleQuestions.q3'),
    t('useCasesConsultants.exampleQuestions.q4'),
    t('useCasesConsultants.exampleQuestions.q5'),
    t('useCasesConsultants.exampleQuestions.q6'),
  ];

  const docTypes = [
    { format: t('useCasesConsultants.docTypes.reports.format'), detail: t('useCasesConsultants.docTypes.reports.detail') },
    { format: t('useCasesConsultants.docTypes.proposals.format'), detail: t('useCasesConsultants.docTypes.proposals.detail') },
    { format: t('useCasesConsultants.docTypes.decks.format'), detail: t('useCasesConsultants.docTypes.decks.detail') },
    { format: t('useCasesConsultants.docTypes.spreadsheets.format'), detail: t('useCasesConsultants.docTypes.spreadsheets.detail') },
  ];

  const securityItems = [
    { icon: Lock, title: t('useCasesConsultants.security.items.encryption.title'), detail: t('useCasesConsultants.security.items.encryption.detail') },
    { icon: Shield, title: t('useCasesConsultants.security.items.noTraining.title'), detail: t('useCasesConsultants.security.items.noTraining.detail') },
    { icon: FileText, title: t('useCasesConsultants.security.items.gdpr.title'), detail: t('useCasesConsultants.security.items.gdpr.detail') },
    { icon: CheckCircle, title: t('useCasesConsultants.security.items.isolation.title'), detail: t('useCasesConsultants.security.items.isolation.detail') },
  ];

  const steps = [
    { icon: Upload, step: '1', title: t('useCasesConsultants.steps.upload.title'), description: t('useCasesConsultants.steps.upload.description') },
    { icon: MessageSquare, step: '2', title: t('useCasesConsultants.steps.ask.title'), description: t('useCasesConsultants.steps.ask.description') },
    { icon: CheckCircle, step: '3', title: t('useCasesConsultants.steps.cited.title'), description: t('useCasesConsultants.steps.cited.description') },
  ];

  const relatedUseCases = [
    { href: href('/use-cases/finance'), icon: TrendingUp, title: t('useCasesConsultants.related.finance.title'), body: t('useCasesConsultants.related.finance.body') },
    { href: href('/use-cases/lawyers'), icon: Scale, title: t('useCasesConsultants.related.legal.title'), body: t('useCasesConsultants.related.legal.body') },
    { href: href('/use-cases/compliance'), icon: Shield, title: t('useCasesConsultants.related.compliance.title'), body: t('useCasesConsultants.related.compliance.body') },
  ];

  const faqItems = [
    {
      question: t('useCasesConsultants.faq.q1.question'),
      answer: t('useCasesConsultants.faq.q1.answer'),
    },
    {
      question: t('useCasesConsultants.faq.q2.question'),
      answer: t('useCasesConsultants.faq.q2.answer'),
    },
    {
      question: t('useCasesConsultants.faq.q3.question'),
      answer: t('useCasesConsultants.faq.q3.answer'),
    },
    {
      question: t('useCasesConsultants.faq.q4.question'),
      answer: t('useCasesConsultants.faq.q4.answer'),
    },
    {
      question: t('useCasesConsultants.faq.q5.question'),
      answer: t('useCasesConsultants.faq.q5.answer'),
    },
  ];

  return (
    <MarketingShell
      chrome={chrome}
      breadcrumb={[
        { label: t('useCasesConsultants.breadcrumb.home'), href: href('/') },
        { label: t('useCasesConsultants.breadcrumb.useCases'), href: href('/use-cases') },
        { label: t('useCasesConsultants.breadcrumb.current') },
      ]}
    >
      <EdPageHero
        icon={Briefcase}
        title={t('useCasesConsultants.heroTitle')}
        lede={t('useCasesConsultants.heroDescription')}
        primaryCta={{ label: t('useCasesConsultants.heroCta'), href: href('/demo') }}
      />

      <EdSection title={t('useCasesConsultants.challenge.title')}>
        <EdProse>
          <p>{t('useCasesConsultants.challenge.p1')}</p>
          <p>{t('useCasesConsultants.challenge.p2')}</p>
          <p>{t('useCasesConsultants.challenge.p3pre')}</p>
          <p>{t('useCasesConsultants.challenge.p4')}</p>
        </EdProse>
      </EdSection>

      <EdSection alt title={t('useCasesConsultants.howItHelps.title')}>
        <EdFeatureList
          items={features.map((f) => ({ title: f.title, body: f.description, icon: f.icon }))}
        />
      </EdSection>

      <EdSection title={t('useCasesConsultants.docTypes.title')}>
        <p className="ed-body" style={{ marginBottom: '24px' }}>
          {t('useCasesConsultants.docTypes.descriptionPre')}{' '}
          <Link href={href("/features/multi-format")} className="ed-inline">
            {t('useCasesConsultants.docTypes.formatsLink')}
          </Link>
          {' '}{t('useCasesConsultants.docTypes.descriptionPost')}
        </p>
        <EdCardGrid
          columns={2}
          items={docTypes.map((d) => ({ title: d.format, body: d.detail }))}
        />
      </EdSection>

      <EdSection alt title={t('useCasesConsultants.examples.title')}>
        <p className="ed-body" style={{ marginBottom: '24px' }}>
          {t('useCasesConsultants.examples.description')}
        </p>
        <EdCardGrid
          columns={2}
          items={exampleQuestions.map((q) => ({ title: q }))}
        />
      </EdSection>

      <EdSection title={t('useCasesConsultants.security.title')}>
        <p className="ed-body" style={{ marginBottom: '24px' }}>
          {t('useCasesConsultants.security.description')}
        </p>
        <EdCardGrid
          columns={2}
          items={securityItems.map((s) => ({ title: s.title, body: s.detail, icon: s.icon }))}
        />
      </EdSection>

      <EdSection alt title={t('useCasesConsultants.steps.title')}>
        <EdStepRow
          steps={steps.map((s) => ({ title: s.title, body: s.description, icon: s.icon }))}
        />
      </EdSection>

      <EdSection title={t('useCasesConsultants.related.title')}>
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

      <EdSection alt title={t('useCasesConsultants.faq.title')}>
        <EdFaqList items={faqItems} />
      </EdSection>

      <EdCtaBanner
        title={t('useCasesConsultants.cta.title')}
        description={t('useCasesConsultants.cta.description')}
        primary={{ label: t('useCasesConsultants.cta.tryFreeDemo'), href: href('/demo') }}
      />
    
      <MarketingLocaleLinks path="/use-cases/consultants" label={chrome.language} />
    </MarketingShell>
  );
}
