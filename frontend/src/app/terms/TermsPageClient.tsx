"use client";

import { useLocale } from '../../i18n';
import { usePageTitle } from '../../lib/usePageTitle';
import MarketingShell from '../../components/marketing/MarketingShell';
import EdPageHero from '../../components/marketing/EdPageHero';
import EdSection from '../../components/marketing/EdSection';
import EdProse from '../../components/marketing/EdProse';

export default function TermsPageClient() {
  const { t, tOr } = useLocale();
  usePageTitle(t('terms.title'));

  const sections = [
    { num: '01', title: t('terms.section1.title'), content: t('terms.section1.content') },
    { num: '02', title: t('terms.section2.title'), content: t('terms.section2.content') },
    { num: '03', title: t('terms.section3.title'), content: t('terms.section3.content') },
    { num: '04', title: t('terms.section4.title'), content: t('terms.section4.content') },
    {
      num: '05',
      title: tOr('terms.section5.title', 'User-Uploaded Content and Intellectual Property'),
      content: tOr(
        'terms.section5.content',
        'You retain all rights to documents you upload. You confirm that you have the legal right to upload, store, and process each document via DocTalk — whether you own it, authored it, or have a valid licence or permission from the rights holder. Do not upload copyrighted material you do not have permission to use, trade secrets of third parties, or content that violates privacy or confidentiality obligations. DocTalk does not host or publish your documents to third parties; the service is limited to processing your own content to answer your questions. We may remove content that we believe in good faith to infringe intellectual property rights under our notice-and-takedown procedure.'
      ),
    },
  ];

  return (
    <MarketingShell
      breadcrumb={[
        { label: t('useCasesHub.breadcrumb.home'), href: '/' },
        { label: t('terms.title') },
      ]}
    >
      <EdPageHero
        eyebrow={t('terms.title')}
        title={t('terms.title')}
        meta={
          <p className="ed-caption">
            {t('terms.lastUpdated')}: 2026-02-05
          </p>
        }
      />

      {sections.map((section, index) => (
        <EdSection
          key={section.num}
          alt={index % 2 === 0}
          num={section.num}
          title={section.title}
        >
          <EdProse>
            <p>{section.content}</p>
          </EdProse>
        </EdSection>
      ))}
    </MarketingShell>
  );
}
