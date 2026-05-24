
import React from 'react';
import Link from 'next/link';
import { getServerT } from '../../../i18n/server';
import { getChromeStrings } from '../../../i18n/chrome';
import { localizedHrefIfAvailable } from '../../../i18n/routing';
import MarketingLocaleLinks from '../../../components/marketing/MarketingLocaleLinks';
import {
  Apple,
  BookOpen,
  FileText,
  ClipboardCheck,
  Search,
  Upload,
  MessageSquare,
  CheckCircle,
  GraduationCap,
  PenTool,
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

export default async function TeachersContent({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);
  const chrome = await getChromeStrings(locale);
  const href = (p: string) => localizedHrefIfAvailable(locale, p);

  const features = [
    {
      icon: PenTool,
      title: t('useCasesTeachers.features.gradeEssays.title'),
      description: t('useCasesTeachers.features.gradeEssays.description'),
    },
    {
      icon: BookOpen,
      title: t('useCasesTeachers.features.curriculum.title'),
      description: t('useCasesTeachers.features.curriculum.description'),
    },
    {
      icon: Search,
      title: t('useCasesTeachers.features.research.title'),
      description: t('useCasesTeachers.features.research.description'),
    },
    {
      icon: ClipboardCheck,
      title: t('useCasesTeachers.features.compare.title'),
      description: t('useCasesTeachers.features.compare.description'),
    },
  ];

  const exampleQuestions = [
    t('useCasesTeachers.exampleQuestions.q1'),
    t('useCasesTeachers.exampleQuestions.q2'),
    t('useCasesTeachers.exampleQuestions.q3'),
    t('useCasesTeachers.exampleQuestions.q4'),
    t('useCasesTeachers.exampleQuestions.q5'),
    t('useCasesTeachers.exampleQuestions.q6'),
  ];

  const docTypes = [
    { format: t('useCasesTeachers.docTypes.pdf.format'), detail: t('useCasesTeachers.docTypes.pdf.detail') },
    { format: t('useCasesTeachers.docTypes.docx.format'), detail: t('useCasesTeachers.docTypes.docx.detail') },
    { format: t('useCasesTeachers.docTypes.pptx.format'), detail: t('useCasesTeachers.docTypes.pptx.detail') },
    { format: t('useCasesTeachers.docTypes.xlsx.format'), detail: t('useCasesTeachers.docTypes.xlsx.detail') },
  ];

  const steps = [
    { icon: Upload, step: '1', title: t('useCasesTeachers.steps.upload.title'), description: t('useCasesTeachers.steps.upload.description') },
    { icon: MessageSquare, step: '2', title: t('useCasesTeachers.steps.ask.title'), description: t('useCasesTeachers.steps.ask.description') },
    { icon: CheckCircle, step: '3', title: t('useCasesTeachers.steps.cited.title'), description: t('useCasesTeachers.steps.cited.description') },
  ];

  const faqItems = [
    {
      question: t('useCasesTeachers.faq.q1.question'),
      answer: t('useCasesTeachers.faq.q1.answer'),
    },
    {
      question: t('useCasesTeachers.faq.q2.question'),
      answer: t('useCasesTeachers.faq.q2.answer'),
    },
    {
      question: t('useCasesTeachers.faq.q3.question'),
      answer: t('useCasesTeachers.faq.q3.answer'),
    },
    {
      question: t('useCasesTeachers.faq.q4.question'),
      answer: t('useCasesTeachers.faq.q4.answer'),
    },
    {
      question: t('useCasesTeachers.faq.q5.question'),
      answer: t('useCasesTeachers.faq.q5.answer'),
    },
  ];

  const relatedUseCases = [
    {
      href: href('/use-cases/students'),
      icon: GraduationCap,
      title: t('useCasesTeachers.related.students.title'),
      description: t('useCasesTeachers.related.students.description'),
    },
    {
      href: href('/use-cases/healthcare'),
      icon: FileText,
      title: t('useCasesTeachers.related.healthcare.title'),
      description: t('useCasesTeachers.related.healthcare.description'),
    },
    {
      href: href('/use-cases/compliance'),
      icon: ClipboardCheck,
      title: t('useCasesTeachers.related.compliance.title'),
      description: t('useCasesTeachers.related.compliance.description'),
    },
  ];

  return (
    <MarketingShell
      chrome={chrome}
      breadcrumb={[
        { label: t('useCasesTeachers.breadcrumb.home'), href: href('/') },
        { label: t('useCasesTeachers.breadcrumb.useCases'), href: href('/use-cases') },
        { label: t('useCasesTeachers.breadcrumb.current') },
      ]}
    >
      <EdPageHero
        icon={Apple}
        title={t('useCasesTeachers.heroTitle')}
        lede={t('useCasesTeachers.heroDescription')}
        primaryCta={{ label: t('useCasesTeachers.heroCta'), href: href('/demo') }}
      />

      <EdSection title={t('useCasesTeachers.challenge.title')}>
        <EdProse>
          <p>{t('useCasesTeachers.challenge.p1')}</p>
          <p>{t('useCasesTeachers.challenge.p2')}</p>
          <p>{t('useCasesTeachers.challenge.p3pre')}</p>
          <p>{t('useCasesTeachers.challenge.p4')}</p>
        </EdProse>
      </EdSection>

      <EdSection alt title={t('useCasesTeachers.howItHelps.title')}>
        <EdFeatureList
          items={features.map((f) => ({ title: f.title, body: f.description, icon: f.icon }))}
        />
      </EdSection>

      <EdSection title={t('useCasesTeachers.docTypes.title')}>
        <p className="ed-body" style={{ marginBottom: '24px' }}>
          {t('useCasesTeachers.docTypes.descriptionPre')}{' '}
          <Link href={href("/features/multi-format")} className="ed-inline">
            {t('useCasesTeachers.docTypes.formatsLink')}
          </Link>
          {' '}{t('useCasesTeachers.docTypes.descriptionPost')}
        </p>
        <EdCardGrid
          columns={2}
          items={docTypes.map((d) => ({ title: d.format, body: d.detail }))}
        />
      </EdSection>

      <EdSection alt title={t('useCasesTeachers.examples.title')}>
        <p className="ed-body" style={{ marginBottom: '24px' }}>
          {t('useCasesTeachers.examples.description')}
        </p>
        <EdCardGrid
          columns={2}
          items={exampleQuestions.map((q) => ({ title: q }))}
        />
      </EdSection>

      <EdSection title={t('useCasesTeachers.whyCitations.title')}>
        <EdProse>
          <p>{t('useCasesTeachers.whyCitations.p1')}</p>
          <p>{t('useCasesTeachers.whyCitations.p2')}</p>
          <p>
            {t('useCasesTeachers.whyCitations.p3pre')}{' '}
            <Link href={href("/features/citations")} className="ed-inline">{t('useCasesTeachers.whyCitations.p3link')}</Link>
            {' '}{t('useCasesTeachers.whyCitations.p3post')}
          </p>
        </EdProse>
      </EdSection>

      <EdSection alt title={t('useCasesTeachers.steps.title')}>
        <EdStepRow
          steps={steps.map((s) => ({ title: s.title, body: s.description, icon: s.icon }))}
        />
      </EdSection>

      <EdSection title={t('useCasesTeachers.related.title')}>
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
                  {item.description}
                </p>
              </Link>
            );
          })}
        </div>
      </EdSection>

      <EdSection alt title={t('useCasesTeachers.faq.title')}>
        <EdFaqList items={faqItems} />
      </EdSection>

      <EdCtaBanner
        title={t('useCasesTeachers.cta.title')}
        description={t('useCasesTeachers.cta.description')}
        primary={{ label: t('useCasesTeachers.cta.tryFreeDemo'), href: href('/demo') }}
      />
    
      <MarketingLocaleLinks path="/use-cases/teachers" label={chrome.language} />
    </MarketingShell>
  );
}
