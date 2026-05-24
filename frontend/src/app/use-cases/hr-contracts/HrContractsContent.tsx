
import React from 'react';
import Link from 'next/link';
import { getServerT } from '../../../i18n/server';
import { getChromeStrings } from '../../../i18n/chrome';
import { localizedHrefIfAvailable } from '../../../i18n/routing';
import MarketingLocaleLinks from '../../../components/marketing/MarketingLocaleLinks';
import {
  FileText,
  Users,
  Search,
  Shield,
  BookOpen,
  CheckCircle,
  Lock,
  ClipboardList,
} from 'lucide-react';
import MarketingShell from '../../../components/marketing/MarketingShell';
import EdPageHero from '../../../components/marketing/EdPageHero';
import EdSection from '../../../components/marketing/EdSection';
import EdProse from '../../../components/marketing/EdProse';
import EdFeatureList from '../../../components/marketing/EdFeatureList';
import EdCardGrid from '../../../components/marketing/EdCardGrid';
import EdFaqList from '../../../components/marketing/EdFaqList';
import EdCtaBanner from '../../../components/marketing/EdCtaBanner';

export default async function HrContractsContent({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);
  const chrome = await getChromeStrings(locale);
  const href = (p: string) => localizedHrefIfAvailable(locale, p);

  const faqItems = [
    {
      question: t('useCasesHr.faq.q1'),
      answer: t('useCasesHr.faq.a1'),
    },
    {
      question: t('useCasesHr.faq.q2'),
      answer: t('useCasesHr.faq.a2'),
    },
    {
      question: t('useCasesHr.faq.q3'),
      answer: t('useCasesHr.faq.a3'),
    },
    {
      question: t('useCasesHr.faq.q4'),
      answer: t('useCasesHr.faq.a4'),
    },
  ];

  const features = [
    {
      icon: Search,
      title: t('useCasesHr.helps.policyQA.title'),
      body: t('useCasesHr.helps.policyQA.description'),
    },
    {
      icon: ClipboardList,
      title: t('useCasesHr.helps.contractClause.title'),
      body: t('useCasesHr.helps.contractClause.description'),
    },
    {
      icon: BookOpen,
      title: t('useCasesHr.helps.handbook.title'),
      body: t('useCasesHr.helps.handbook.description'),
    },
    {
      icon: Users,
      title: t('useCasesHr.helps.onboarding.title'),
      body: t('useCasesHr.helps.onboarding.description'),
    },
  ];

  const docTypes = [
    { title: t('useCasesHr.docTypes.docx.format'), body: t('useCasesHr.docTypes.docx.detail') },
    { title: t('useCasesHr.docTypes.pdf.format'), body: t('useCasesHr.docTypes.pdf.detail') },
    { title: t('useCasesHr.docTypes.pptx.format'), body: t('useCasesHr.docTypes.pptx.detail') },
    { title: t('useCasesHr.docTypes.xlsx.format'), body: t('useCasesHr.docTypes.xlsx.detail') },
  ];

  const securityItems = [
    { icon: Lock, title: t('useCasesHr.security.encryption.title'), body: t('useCasesHr.security.encryption.detail') },
    { icon: Shield, title: t('useCasesHr.security.noTraining.title'), body: t('useCasesHr.security.noTraining.detail') },
    { icon: FileText, title: t('useCasesHr.security.gdpr.title'), body: t('useCasesHr.security.gdpr.detail') },
    { icon: CheckCircle, title: t('useCasesHr.security.dataControl.title'), body: t('useCasesHr.security.dataControl.detail') },
  ];

  return (
    <MarketingShell
      chrome={chrome}
      breadcrumb={[
        { label: t('useCasesHr.breadcrumb.home'), href: href('/') },
        { label: t('useCasesHr.breadcrumb.useCases'), href: href('/use-cases') },
        { label: t('useCasesHr.breadcrumb.current') },
      ]}
    >
      <EdPageHero
        icon={FileText}
        title={t('useCasesHr.hero.title')}
        lede={t('useCasesHr.hero.subtitle')}
        primaryCta={{ label: t('useCasesHr.hero.cta'), href: href('/demo') }}
      />

      <EdSection title={t('useCasesHr.challenge.title')}>
        <EdProse>
          <p>{t('useCasesHr.challenge.p1')}</p>
          <p>
            {t('useCasesHr.challenge.p2')}{' '}
            Organizations like <a href="https://www.shrm.org" target="_blank" rel="noopener noreferrer">SHRM</a> provide guidance on best practices for policy management.
          </p>
          <p>
            {t('useCasesHr.challenge.p3')}{' '}
            Compliance with regulations from the <a href="https://www.dol.gov" target="_blank" rel="noopener noreferrer">U.S. Department of Labor</a> adds additional complexity.
          </p>
          <p>{t('useCasesHr.challenge.p4')}</p>
        </EdProse>
      </EdSection>

      <EdSection alt title={t('useCasesHr.helps.title')}>
        <EdFeatureList items={features} />
      </EdSection>

      <EdSection title={t('useCasesHr.docTypes.title')}>
        <p className="ed-body" style={{ marginBottom: '24px' }}>
          {t('useCasesHr.docTypes.intro')}{' '}
          <Link href={href("/features/multi-format")} className="ed-inline">
            {t('useCasesHr.docTypes.formatLink')}
          </Link>
          {t('useCasesHr.docTypes.introSuffix')}
        </p>
        <EdCardGrid columns={2} items={docTypes} />
      </EdSection>

      <EdSection alt title={t('useCasesHr.realWorld.title')}>
        <div>
          <h3 className="ed-h3">{t('useCasesHr.realWorld.pto.title')}</h3>
          <EdProse className="mt-3">
            <p>{t('useCasesHr.realWorld.pto.description')}</p>
          </EdProse>
        </div>

        <div style={{ marginTop: '40px' }}>
          <h3 className="ed-h3">{t('useCasesHr.realWorld.nonCompete.title')}</h3>
          <EdProse className="mt-3">
            <p>
              {t('useCasesHr.realWorld.nonCompete.p1')}
              <Link href={href("/use-cases/lawyers")} className="ed-inline">
                {t('useCasesHr.realWorld.nonCompete.link')}
              </Link>{' '}
              {t('useCasesHr.realWorld.nonCompete.p2')}
            </p>
          </EdProse>
        </div>

        <div style={{ marginTop: '40px' }}>
          <h3 className="ed-h3">{t('useCasesHr.realWorld.benefits.title')}</h3>
          <EdProse className="mt-3">
            <p>{t('useCasesHr.realWorld.benefits.description')}</p>
          </EdProse>
        </div>

        <div style={{ marginTop: '40px' }}>
          <h3 className="ed-h3">{t('useCasesHr.realWorld.onboarding.title')}</h3>
          <EdProse className="mt-3">
            <p>{t('useCasesHr.realWorld.onboarding.description')}</p>
          </EdProse>
        </div>
      </EdSection>

      <EdSection title={t('useCasesHr.security.title')}>
        <p className="ed-body" style={{ marginBottom: '24px' }}>
          {t('useCasesHr.security.description')}
        </p>
        <EdCardGrid columns={2} items={securityItems} />
      </EdSection>

      <EdSection alt title={t('useCasesHr.faqTitle')}>
        <EdFaqList items={faqItems} />
      </EdSection>

      <EdCtaBanner
        title={t('useCasesHr.cta.title')}
        description={t('useCasesHr.cta.description')}
        primary={{ label: t('useCasesHr.cta.tryDemo'), href: href('/demo') }}
        secondary={{ label: t('useCasesHr.cta.viewPricing'), href: href('/pricing') }}
      />
    
      <MarketingLocaleLinks path="/use-cases/hr-contracts" label={chrome.language} />
    </MarketingShell>
  );
}
