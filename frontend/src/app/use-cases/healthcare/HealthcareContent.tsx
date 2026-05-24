
import React from 'react';
import Link from 'next/link';
import { getServerT } from '../../../i18n/server';
import { getChromeStrings } from '../../../i18n/chrome';
import { localizedHrefIfAvailable } from '../../../i18n/routing';
import MarketingLocaleLinks from '../../../components/marketing/MarketingLocaleLinks';
import {
  Heart,
  FileText,
  Search,
  ClipboardCheck,
  Upload,
  MessageSquare,
  CheckCircle,
  AlertTriangle,
  BookOpen,
  Scale,
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

export default async function HealthcareContent({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);
  const chrome = await getChromeStrings(locale);
  const href = (p: string) => localizedHrefIfAvailable(locale, p);

  const features = [
    {
      icon: Search,
      title: t('useCasesHealthcare.features.clinicalResearch.title'),
      description: t('useCasesHealthcare.features.clinicalResearch.description'),
    },
    {
      icon: ClipboardCheck,
      title: t('useCasesHealthcare.features.compliance.title'),
      description: t('useCasesHealthcare.features.compliance.description'),
    },
    {
      icon: BookOpen,
      title: t('useCasesHealthcare.features.protocol.title'),
      description: t('useCasesHealthcare.features.protocol.description'),
    },
    {
      icon: FileText,
      title: t('useCasesHealthcare.features.insurance.title'),
      description: t('useCasesHealthcare.features.insurance.description'),
    },
  ];

  const exampleQuestions = [
    t('useCasesHealthcare.exampleQuestions.q1'),
    t('useCasesHealthcare.exampleQuestions.q2'),
    t('useCasesHealthcare.exampleQuestions.q3'),
    t('useCasesHealthcare.exampleQuestions.q4'),
    t('useCasesHealthcare.exampleQuestions.q5'),
    t('useCasesHealthcare.exampleQuestions.q6'),
  ];

  const docTypes = [
    { format: t('useCasesHealthcare.docTypes.studies.format'), detail: t('useCasesHealthcare.docTypes.studies.detail') },
    { format: t('useCasesHealthcare.docTypes.compliance.format'), detail: t('useCasesHealthcare.docTypes.compliance.detail') },
    { format: t('useCasesHealthcare.docTypes.protocols.format'), detail: t('useCasesHealthcare.docTypes.protocols.detail') },
    { format: t('useCasesHealthcare.docTypes.insurance.format'), detail: t('useCasesHealthcare.docTypes.insurance.detail') },
  ];

  const steps = [
    { icon: Upload, step: '1', title: t('useCasesHealthcare.steps.upload.title'), description: t('useCasesHealthcare.steps.upload.description') },
    { icon: MessageSquare, step: '2', title: t('useCasesHealthcare.steps.ask.title'), description: t('useCasesHealthcare.steps.ask.description') },
    { icon: CheckCircle, step: '3', title: t('useCasesHealthcare.steps.cited.title'), description: t('useCasesHealthcare.steps.cited.description') },
  ];

  const relatedUseCases = [
    { href: href('/use-cases/compliance'), icon: Shield, title: t('useCasesHealthcare.related.compliance.title'), body: t('useCasesHealthcare.related.compliance.body') },
    { href: href('/use-cases/teachers'), icon: BookOpen, title: t('useCasesHealthcare.related.teachers.title'), body: t('useCasesHealthcare.related.teachers.body') },
    { href: href('/use-cases/lawyers'), icon: Scale, title: t('useCasesHealthcare.related.legal.title'), body: t('useCasesHealthcare.related.legal.body') },
  ];

  const faqItems = [
    {
      question: t('useCasesHealthcare.faq.q1.question'),
      answer: t('useCasesHealthcare.faq.q1.answer'),
    },
    {
      question: t('useCasesHealthcare.faq.q2.question'),
      answer: t('useCasesHealthcare.faq.q2.answer'),
    },
    {
      question: t('useCasesHealthcare.faq.q3.question'),
      answer: t('useCasesHealthcare.faq.q3.answer'),
    },
    {
      question: t('useCasesHealthcare.faq.q4.question'),
      answer: t('useCasesHealthcare.faq.q4.answer'),
    },
    {
      question: t('useCasesHealthcare.faq.q5.question'),
      answer: t('useCasesHealthcare.faq.q5.answer'),
    },
  ];

  return (
    <MarketingShell
      chrome={chrome}
      breadcrumb={[
        { label: t('useCasesHealthcare.breadcrumb.home'), href: href('/') },
        { label: t('useCasesHealthcare.breadcrumb.useCases'), href: href('/use-cases') },
        { label: t('useCasesHealthcare.breadcrumb.current') },
      ]}
    >
      <EdPageHero
        icon={Heart}
        title={t('useCasesHealthcare.heroTitle')}
        lede={t('useCasesHealthcare.heroDescription')}
        primaryCta={{ label: t('useCasesHealthcare.heroCta'), href: href('/demo') }}
      />

      <EdSection title={t('useCasesHealthcare.notHipaa.title')}>
        <EdProse>
          <p>{t('useCasesHealthcare.notHipaa.p1')}</p>
        </EdProse>
      </EdSection>

      <EdSection alt title={t('useCasesHealthcare.challenge.title')}>
        <EdProse>
          <p>{t('useCasesHealthcare.challenge.p1')}</p>
          <p>{t('useCasesHealthcare.challenge.p2')}</p>
          <p>{t('useCasesHealthcare.challenge.p3pre')}</p>
          <p>{t('useCasesHealthcare.challenge.p4')}</p>
        </EdProse>
      </EdSection>

      <EdSection title={t('useCasesHealthcare.howItHelps.title')}>
        <EdFeatureList
          items={features.map((f) => ({ title: f.title, body: f.description, icon: f.icon }))}
        />
      </EdSection>

      <EdSection alt title={t('useCasesHealthcare.docTypes.title')}>
        <p className="ed-body" style={{ marginBottom: '24px' }}>
          {t('useCasesHealthcare.docTypes.descriptionPre')}{' '}
          <Link href={href("/features/multi-format")} className="ed-inline">
            {t('useCasesHealthcare.docTypes.formatsLink')}
          </Link>
          {' '}{t('useCasesHealthcare.docTypes.descriptionPost')}
        </p>
        <EdCardGrid
          columns={2}
          items={docTypes.map((d) => ({ title: d.format, body: d.detail }))}
        />
      </EdSection>

      <EdSection title={t('useCasesHealthcare.examples.title')}>
        <p className="ed-body" style={{ marginBottom: '24px' }}>
          {t('useCasesHealthcare.examples.description')}
        </p>
        <EdCardGrid
          columns={2}
          items={exampleQuestions.map((q) => ({ title: q }))}
        />
      </EdSection>

      <EdSection alt title={t('useCasesHealthcare.whyCitations.title')}>
        <EdProse>
          <p>{t('useCasesHealthcare.whyCitations.p1')}</p>
          <p>{t('useCasesHealthcare.whyCitations.p2')}</p>
          <p>{t('useCasesHealthcare.whyCitations.p3')}</p>
          <p>
            {t('useCasesHealthcare.whyCitations.p4pre')}{' '}
            <Link href={href("/features/citations")} className="ed-inline">
              {t('useCasesHealthcare.whyCitations.p4link1')}
            </Link>
            {' '}{t('useCasesHealthcare.whyCitations.p4mid')}{' '}
            <Link href={href("/features/performance-modes")} className="ed-inline">
              {t('useCasesHealthcare.whyCitations.p4link2')}
            </Link>
            {' '}{t('useCasesHealthcare.whyCitations.p4post')}
          </p>
        </EdProse>
      </EdSection>

      <EdSection title={t('useCasesHealthcare.security.title')}>
        <EdProse>
          <p>{t('useCasesHealthcare.security.p1')}</p>
          <p>{t('useCasesHealthcare.security.p2')}</p>
        </EdProse>
      </EdSection>

      <EdSection alt title={t('useCasesHealthcare.steps.title')}>
        <EdStepRow
          steps={steps.map((s) => ({ title: s.title, body: s.description, icon: s.icon }))}
        />
      </EdSection>

      <EdSection title={t('useCasesHealthcare.related.title')}>
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

      <EdSection alt title={t('useCasesHealthcare.faq.title')}>
        <EdFaqList items={faqItems} />
      </EdSection>

      <EdCtaBanner
        title={t('useCasesHealthcare.cta.title')}
        description={t('useCasesHealthcare.cta.description')}
        primary={{ label: t('useCasesHealthcare.cta.tryFreeDemo'), href: href('/demo') }}
      />
    
      <MarketingLocaleLinks path="/use-cases/healthcare" label={chrome.language} />
    </MarketingShell>
  );
}
