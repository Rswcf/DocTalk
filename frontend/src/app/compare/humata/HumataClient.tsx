"use client";

import React from 'react';
import Link from 'next/link';
import { useLocale } from '../../../i18n';
import MarketingShell from '../../../components/marketing/MarketingShell';
import EdPageHero from '../../../components/marketing/EdPageHero';
import EdSection from '../../../components/marketing/EdSection';
import EdProse from '../../../components/marketing/EdProse';
import EdComparisonTable from '../../../components/marketing/EdComparisonTable';
import EdFaqList from '../../../components/marketing/EdFaqList';
import EdRelatedLinks from '../../../components/marketing/EdRelatedLinks';
import EdCtaBanner from '../../../components/marketing/EdCtaBanner';

export default function HumataClient() {
  const { t } = useLocale();

  const features = [
    { name: t('compareHumata.featureSupportedFormats'), doctalk: t('compareHumata.featureSupportedFormatsDocTalk'), competitor: t('compareHumata.featureSupportedFormatsCompetitor') },
    { name: t('compareHumata.featureCitationHighlighting'), doctalk: true, competitor: false },
    { name: t('compareHumata.featureVideoSupport'), doctalk: false, competitor: true },
    { name: t('compareHumata.featureTeamCollaboration'), doctalk: false, competitor: true },
    { name: t('compareHumata.featureInterfaceLanguages'), doctalk: t('compareHumata.featureInterfaceLanguagesDocTalk'), competitor: t('compareHumata.featureInterfaceLanguagesCompetitor') },
    { name: t('compareHumata.featureNoSignupDemo'), doctalk: true, competitor: false },
    { name: t('compareHumata.featureFreeTier'), doctalk: t('compareHumata.featureFreeTierDocTalk'), competitor: t('compareHumata.featureFreeTierCompetitor') },
    { name: t('compareHumata.featureMultipleAIModes'), doctalk: t('compareHumata.featureMultipleAIModesDocTalk'), competitor: t('compareHumata.featureMultipleAIModesCompetitor') },
    { name: t('compareHumata.featureStartingPrice'), doctalk: t('compareHumata.featureStartingPriceDocTalk'), competitor: t('compareHumata.featureStartingPriceCompetitor') },
    { name: t('compareHumata.featureDarkMode'), doctalk: true, competitor: false },
  ];

  const faqItems = [
    {
      question: t('compareHumata.faq1Question'),
      answer: t('compareHumata.faq1Answer'),
    },
    {
      question: t('compareHumata.faq2Question'),
      answer: t('compareHumata.faq2Answer'),
    },
    {
      question: t('compareHumata.faq3Question'),
      answer: t('compareHumata.faq3Answer'),
    },
    {
      question: t('compareHumata.faq4Question'),
      answer: t('compareHumata.faq4Answer'),
    },
  ];

  return (
    <MarketingShell
      breadcrumb={[
        { label: t('compareHumata.breadcrumbHome'), href: '/' },
        { label: t('compareHumata.breadcrumbCompare'), href: '/compare' },
        { label: t('compareHumata.breadcrumbCurrent') },
      ]}
    >
      <EdPageHero
        title={t('compareHumata.heroTitle')}
        lede={t('compareHumata.heroDescription')}
        primaryCta={{ label: t('compareHumata.linkFreeDemo'), href: '/demo' }}
      />

      <EdSection title={t('compareHumata.quickComparison')}>
        <EdComparisonTable features={features} competitorName="Humata" />
      </EdSection>

      <EdSection alt title={t('compareHumata.whatIsDocTalkTitle')}>
        <EdProse>
          <p>{t('compareHumata.whatIsDocTalkDescription')}</p>
        </EdProse>
      </EdSection>

      <EdSection title={t('compareHumata.whatIsHumataTitle')}>
        <EdProse>
          <p>
            <a href="https://www.humata.ai" target="_blank" rel="noopener noreferrer">Humata</a>{' '}
            {t('compareHumata.whatIsHumataDescription')}{' '}
            It uses a <a href="https://arxiv.org/abs/2005.11401" target="_blank" rel="noopener noreferrer">RAG-based approach</a> to generate answers from uploaded documents.
          </p>
        </EdProse>
      </EdSection>

      <EdSection alt title={t('compareHumata.featureByFeatureTitle')}>
        <h3 className="ed-h3">{t('compareHumata.documentFormatTitle')}</h3>
        <EdProse className="mt-3">
          <p>{t('compareHumata.documentFormatCompetitor')}</p>
          <p>
            {t('compareHumata.documentFormatDocTalk')}{' '}
            <Link href="/features/multi-format">
              {t('compareHumata.multiFormatLink')}
            </Link>.
          </p>
        </EdProse>

        <h3 className="ed-h3" style={{ marginTop: '40px' }}>{t('compareHumata.citationsTitle')}</h3>
        <EdProse className="mt-3">
          <p>{t('compareHumata.citationsCompetitor')}</p>
          <p>
            {t('compareHumata.citationsDocTalk')}{' '}
            <Link href="/features/citations">
              {t('compareHumata.citationHighlightingLink')}
            </Link>.
          </p>
        </EdProse>

        <h3 className="ed-h3" style={{ marginTop: '40px' }}>{t('compareHumata.languageSupportTitle')}</h3>
        <EdProse className="mt-3">
          <p>{t('compareHumata.languageSupportCompetitor')}</p>
          <p>
            {t('compareHumata.languageSupportDocTalk')}{' '}
            <Link href="/features/multilingual">
              {t('compareHumata.multilingualLink')}
            </Link>.
          </p>
        </EdProse>

        <h3 className="ed-h3" style={{ marginTop: '40px' }}>{t('compareHumata.pricingTitle')}</h3>
        <EdProse className="mt-3">
          <p>{t('compareHumata.pricingCompetitor')}</p>
          <p>
            {t('compareHumata.pricingDocTalkPart1')}{' '}
            <Link href="/demo">{t('compareHumata.noSignupDemoLink')}</Link>.
            {' '}{t('compareHumata.pricingDocTalkPart2')}{' '}
            <Link href="/pricing">
              {t('compareHumata.pricingDetailsLink')}
            </Link>.
          </p>
        </EdProse>

        <h3 className="ed-h3" style={{ marginTop: '40px' }}>{t('compareHumata.performanceTitle')}</h3>
        <EdProse className="mt-3">
          <p>{t('compareHumata.performanceCompetitor')}</p>
          <p>{t('compareHumata.performanceDocTalk')}</p>
        </EdProse>

        <h3 className="ed-h3" style={{ marginTop: '40px' }}>{t('compareHumata.securityTitle')}</h3>
        <EdProse className="mt-3">
          <p>{t('compareHumata.securityCompetitor')}</p>
          <p>{t('compareHumata.securityDocTalk')}</p>
        </EdProse>
      </EdSection>

      <EdSection title={t('compareHumata.whoDocTalkTitle')}>
        <EdProse>
          <ul>
            <li>{t('compareHumata.whoDocTalk1')}</li>
            <li>{t('compareHumata.whoDocTalk2')}</li>
            <li>{t('compareHumata.whoDocTalk3')}</li>
            <li>{t('compareHumata.whoDocTalk4')}</li>
            <li>{t('compareHumata.whoDocTalk5')}</li>
          </ul>
        </EdProse>
      </EdSection>

      <EdSection alt title={t('compareHumata.whoHumataTitle')}>
        <EdProse>
          <ul>
            <li>{t('compareHumata.whoHumata1')}</li>
            <li>{t('compareHumata.whoHumata2')}</li>
            <li>{t('compareHumata.whoHumata3')}</li>
            <li>{t('compareHumata.whoHumata4')}</li>
          </ul>
        </EdProse>
      </EdSection>

      <EdSection title={t('compareHumata.verdictTitle')}>
        <EdProse>
          <p>{t('compareHumata.verdictParagraph1')}</p>
          <p>{t('compareHumata.verdictParagraph2')}</p>
          <p>
            {t('compareHumata.verdictParagraph3')}{' '}
            <Link href="/demo">
              {t('compareHumata.tryDocTalkLink')}
            </Link>{' '}
            {t('compareHumata.verdictParagraph3End')}
          </p>
        </EdProse>
      </EdSection>

      <EdSection alt title={t('compareHumata.faqTitle')}>
        <EdFaqList items={faqItems} />
      </EdSection>

      <EdSection>
        <EdRelatedLinks
          title={t('compareHumata.relatedPages')}
          links={[
            { href: '/features/citations', label: t('compareHumata.linkCitationHighlighting') },
            { href: '/features/multilingual', label: t('compareHumata.linkMultilingual') },
            { href: '/demo', label: t('compareHumata.linkFreeDemo') },
            { href: '/pricing', label: t('compareHumata.linkPricing') },
            { href: '/alternatives/humata', label: t('compareHumata.linkHumataAlternatives') },
          ]}
        />
      </EdSection>

      <EdCtaBanner
        title={t('compareHumata.ctaTitle')}
        description={t('compareHumata.ctaDescription')}
        primary={{ label: t('compareHumata.ctaButton'), href: '/demo' }}
      />
    </MarketingShell>
  );
}
