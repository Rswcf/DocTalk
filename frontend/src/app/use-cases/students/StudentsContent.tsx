
import React from 'react';
import Link from 'next/link';
import { getServerT } from '../../../i18n/server';
import { getChromeStrings } from '../../../i18n/chrome';
import { localizedHrefIfAvailable } from '../../../i18n/routing';
import MarketingLocaleLinks from '../../../components/marketing/MarketingLocaleLinks';
import {
  GraduationCap,
  BookOpen,
  FileText,
  Search,
  Quote,
  Upload,
  MessageSquare,
  CheckCircle,
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

const realWorldKeys = ['thesis', 'litReview', 'methodology', 'examPrep'];

export default async function StudentsContent({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);
  const chrome = await getChromeStrings(locale);
  const href = (p: string) => localizedHrefIfAvailable(locale, p);

  const faqItems = [
    {
      question: t('useCasesStudents.faq.q1'),
      answer: t('useCasesStudents.faq.a1'),
    },
    {
      question: t('useCasesStudents.faq.q2'),
      answer: t('useCasesStudents.faq.a2'),
    },
    {
      question: t('useCasesStudents.faq.q3'),
      answer: t('useCasesStudents.faq.a3'),
    },
    {
      question: t('useCasesStudents.faq.q4'),
      answer: t('useCasesStudents.faq.a4'),
    },
    {
      question: t('useCasesStudents.faq.q5'),
      answer: t('useCasesStudents.faq.a5'),
    },
  ];

  const helps = [
    {
      icon: Search,
      title: t('useCasesStudents.helps.summarize.title'),
      description: t('useCasesStudents.helps.summarize.description'),
    },
    {
      icon: BookOpen,
      title: t('useCasesStudents.helps.methodologies.title'),
      description: t('useCasesStudents.helps.methodologies.description'),
    },
    {
      icon: FileText,
      title: t('useCasesStudents.helps.literature.title'),
      description: t('useCasesStudents.helps.literature.description'),
    },
    {
      icon: GraduationCap,
      title: t('useCasesStudents.helps.exams.title'),
      description: t('useCasesStudents.helps.exams.description'),
    },
    {
      icon: Quote,
      title: t('useCasesStudents.helps.quotes.title'),
      description: t('useCasesStudents.helps.quotes.description'),
    },
  ];

  const docTypes = [
    { format: t('useCasesStudents.docTypes.pdf.format'), detail: t('useCasesStudents.docTypes.pdf.detail') },
    { format: t('useCasesStudents.docTypes.docx.format'), detail: t('useCasesStudents.docTypes.docx.detail') },
    { format: t('useCasesStudents.docTypes.pptx.format'), detail: t('useCasesStudents.docTypes.pptx.detail') },
    { format: t('useCasesStudents.docTypes.url.format'), detail: t('useCasesStudents.docTypes.url.detail') },
  ];

  const steps = [
    {
      icon: Upload,
      title: t('useCasesStudents.getStarted.step1.title'),
      description: t('useCasesStudents.getStarted.step1.description'),
    },
    {
      icon: MessageSquare,
      title: t('useCasesStudents.getStarted.step2.title'),
      description: t('useCasesStudents.getStarted.step2.description'),
    },
    {
      icon: CheckCircle,
      title: t('useCasesStudents.getStarted.step3.title'),
      description: t('useCasesStudents.getStarted.step3.description'),
    },
  ];

  return (
    <MarketingShell
      chrome={chrome}
      breadcrumb={[
        { label: t('useCasesStudents.breadcrumb.home'), href: href('/') },
        { label: t('useCasesStudents.breadcrumb.useCases'), href: href('/use-cases') },
        { label: t('useCasesStudents.breadcrumb.current') },
      ]}
    >
      <EdPageHero
        icon={GraduationCap}
        title={t('useCasesStudents.hero.title')}
        lede={t('useCasesStudents.hero.subtitle')}
        primaryCta={{ label: t('useCasesStudents.hero.cta'), href: href('/demo') }}
      />

      <EdSection title={t('useCasesStudents.challenge.title')}>
        <EdProse>
          <p>{t('useCasesStudents.challenge.p1')}</p>
          <p>
            {t('useCasesStudents.challenge.p2')}{' '}
            Tools like <a href="https://scholar.google.com" target="_blank" rel="noopener noreferrer">Google Scholar</a> and reference managers like <a href="https://www.zotero.org" target="_blank" rel="noopener noreferrer">Zotero</a> help find papers, but understanding them still takes time.
          </p>
          <p>{t('useCasesStudents.challenge.p3')}</p>
          <p>{t('useCasesStudents.challenge.p4')}</p>
        </EdProse>
      </EdSection>

      <EdSection alt title={t('useCasesStudents.helps.title')}>
        <EdFeatureList
          items={helps.map((h) => ({ title: h.title, body: h.description, icon: h.icon }))}
        />
      </EdSection>

      <EdSection title={t('useCasesStudents.docTypes.title')}>
        <p className="ed-body" style={{ marginBottom: '24px' }}>
          {t('useCasesStudents.docTypes.intro')}{' '}
          <Link href={href("/features/multi-format")} className="ed-inline">
            {t('useCasesStudents.docTypes.formatLink')}
          </Link>
          {t('useCasesStudents.docTypes.introSuffix')}
        </p>
        <EdCardGrid
          columns={2}
          items={docTypes.map((d) => ({ title: d.format, body: d.detail }))}
        />
      </EdSection>

      <EdSection alt title={t('useCasesStudents.realWorld.title')}>
        {realWorldKeys.map((key, i) => {
          const p2 = t(`useCasesStudents.realWorld.${key}.p2`);
          return (
            <div key={key} style={i > 0 ? { marginTop: '40px' } : undefined}>
              <h3 className="ed-h3">{t(`useCasesStudents.realWorld.${key}.title`)}</h3>
              <EdProse className="mt-3">
                <p>{t(`useCasesStudents.realWorld.${key}.p1`)}</p>
                {p2 && <p>{p2}</p>}
              </EdProse>
            </div>
          );
        })}
      </EdSection>

      <EdSection title={t('useCasesStudents.citations.title')}>
        <EdProse>
          <p>{t('useCasesStudents.citations.p1')}</p>
          <p>
            {t('useCasesStudents.citations.p2a')}
            <Link href={href("/features/citations")} className="ed-inline">{t('useCasesStudents.citations.link')}</Link>{' '}
            {t('useCasesStudents.citations.p2b')}
          </p>
          <p>{t('useCasesStudents.citations.p3')}</p>
          <p>{t('useCasesStudents.citations.p4')}</p>
        </EdProse>
      </EdSection>

      <EdSection alt title={t('useCasesStudents.multilingual.title')}>
        <EdProse>
          <p>{t('useCasesStudents.multilingual.p1')}</p>
          <p>
            {t('useCasesStudents.multilingual.p2a')}
            <Link href={href("/features/multilingual")} className="ed-inline">{t('useCasesStudents.multilingual.link')}</Link>{' '}
            {t('useCasesStudents.multilingual.p2b')}
          </p>
          <p>{t('useCasesStudents.multilingual.p3')}</p>
        </EdProse>
      </EdSection>

      <EdSection title={t('useCasesStudents.getStarted.title')}>
        <EdStepRow
          steps={steps.map((s) => ({ title: s.title, body: s.description, icon: s.icon }))}
        />
      </EdSection>

      <EdSection alt title={t('useCasesStudents.faqTitle')}>
        <EdFaqList items={faqItems} />
      </EdSection>

      <EdCtaBanner
        title={t('useCasesStudents.cta.title')}
        description={t('useCasesStudents.cta.description')}
        primary={{ label: t('useCasesStudents.cta.tryDemo'), href: href('/demo') }}
        secondary={{ label: t('useCasesStudents.cta.viewPricing'), href: href('/pricing') }}
      />
    
      <MarketingLocaleLinks path="/use-cases/students" label={chrome.language} />
    </MarketingShell>
  );
}
