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

export default function NotebooklmClient() {
  const { t } = useLocale();

  const features = [
    { name: t('compareNotebooklm.table.supportedFormats'), doctalk: t('compareNotebooklm.table.doctalk.supportedFormats'), competitor: t('compareNotebooklm.table.competitor.supportedFormats') },
    { name: t('compareNotebooklm.table.citationHighlighting'), doctalk: t('compareNotebooklm.table.doctalk.citationHighlighting'), competitor: t('compareNotebooklm.table.competitor.citationHighlighting') },
    { name: t('compareNotebooklm.table.multiSourceNotebooks'), doctalk: false, competitor: true },
    { name: t('compareNotebooklm.table.audioPodcast'), doctalk: false, competitor: true },
    { name: t('compareNotebooklm.table.interfaceLanguages'), doctalk: t('compareNotebooklm.table.doctalk.interfaceLanguages'), competitor: t('compareNotebooklm.table.competitor.interfaceLanguages') },
    { name: t('compareNotebooklm.table.requiresGoogle'), doctalk: false, competitor: true },
    { name: t('compareNotebooklm.table.noSignupDemo'), doctalk: true, competitor: false },
    { name: t('compareNotebooklm.table.freeTier'), doctalk: t('compareNotebooklm.table.doctalk.freeTier'), competitor: t('compareNotebooklm.table.competitor.freeTier') },
    { name: t('compareNotebooklm.table.multipleAiModes'), doctalk: t('compareNotebooklm.table.doctalk.multipleAiModes'), competitor: t('compareNotebooklm.table.competitor.multipleAiModes') },
    { name: t('compareNotebooklm.table.dataEncryption'), doctalk: t('compareNotebooklm.table.doctalk.dataEncryption'), competitor: t('compareNotebooklm.table.competitor.dataEncryption') },
  ];

  const faqItems = [
    {
      question: t('compareNotebooklm.faq.q1'),
      answer: t('compareNotebooklm.faq.a1'),
    },
    {
      question: t('compareNotebooklm.faq.q2'),
      answer: t('compareNotebooklm.faq.a2'),
    },
    {
      question: t('compareNotebooklm.faq.q3'),
      answer: t('compareNotebooklm.faq.a3'),
    },
    {
      question: t('compareNotebooklm.faq.q4'),
      answer: t('compareNotebooklm.faq.a4'),
    },
    {
      question: t('compareNotebooklm.faq.q5'),
      answer: t('compareNotebooklm.faq.a5'),
    },
  ];

  return (
    <MarketingShell
      breadcrumb={[
        { label: t('compareNotebooklm.breadcrumb.home'), href: '/' },
        { label: t('compareNotebooklm.breadcrumb.compare'), href: '/compare' },
        { label: t('compareNotebooklm.breadcrumb.current') },
      ]}
    >
      <EdPageHero
        title={t('compareNotebooklm.heroTitle')}
        lede={t('compareNotebooklm.heroDescription')}
        primaryCta={{ label: t('compareNotebooklm.related.freeDemo'), href: '/demo' }}
      />

      <EdSection title={t('compareNotebooklm.quickComparison')}>
        <EdComparisonTable features={features} competitorName="NotebookLM" />
      </EdSection>

      <EdSection alt title={t('compareNotebooklm.whatIsDocTalk')}>
        <EdProse>
          <p>{t('compareNotebooklm.whatIsDocTalkDescription')}</p>
        </EdProse>
      </EdSection>

      <EdSection title={t('compareNotebooklm.whatIsNotebookLM')}>
        <EdProse>
          <p>
            <a href="https://notebooklm.google.com" target="_blank" rel="noopener noreferrer">NotebookLM</a>{' '}
            {t('compareNotebooklm.whatIsNotebookLMDescription')}{' '}
            Learn more about <a href="https://blog.google/technology/ai/notebooklm-google-ai/" target="_blank" rel="noopener noreferrer">{"Google's AI notebook"}</a>.
          </p>
        </EdProse>
      </EdSection>

      <EdSection alt title={t('compareNotebooklm.featureByFeature')}>
        <h3 className="ed-h3">{t('compareNotebooklm.feature.formatSupport')}</h3>
        <EdProse className="mt-3">
          <p>{t('compareNotebooklm.feature.formatSupportP1')}</p>
          <p>
            {t('compareNotebooklm.feature.formatSupportP2Pre')}
            <Link href="/features/multi-format">
              {t('compareNotebooklm.feature.formatSupportLink')}
            </Link>.
          </p>
        </EdProse>

        <h3 className="ed-h3" style={{ marginTop: '40px' }}>{t('compareNotebooklm.feature.citations')}</h3>
        <EdProse className="mt-3">
          <p>{t('compareNotebooklm.feature.citationsP1')}</p>
          <p>
            {t('compareNotebooklm.feature.citationsP2Pre')}
            <Link href="/features/citations">
              {t('compareNotebooklm.feature.citationsLink')}
            </Link>.
          </p>
        </EdProse>

        <h3 className="ed-h3" style={{ marginTop: '40px' }}>{t('compareNotebooklm.feature.languages')}</h3>
        <EdProse className="mt-3">
          <p>{t('compareNotebooklm.feature.languagesP1')}</p>
          <p>
            {t('compareNotebooklm.feature.languagesP2Pre')}
            <Link href="/features/multilingual">
              {t('compareNotebooklm.feature.languagesLink')}
            </Link>.
          </p>
        </EdProse>

        <h3 className="ed-h3" style={{ marginTop: '40px' }}>{t('compareNotebooklm.feature.pricing')}</h3>
        <EdProse className="mt-3">
          <p>{t('compareNotebooklm.feature.pricingP1')}</p>
          <p>
            {t('compareNotebooklm.feature.pricingP2Pre')}
            <Link href="/demo">{t('compareNotebooklm.feature.pricingDemoLink')}</Link>
            {t('compareNotebooklm.feature.pricingP2Mid')}
            <Link href="/pricing">{t('compareNotebooklm.feature.pricingPricingLink')}</Link>.
          </p>
        </EdProse>

        <h3 className="ed-h3" style={{ marginTop: '40px' }}>{t('compareNotebooklm.feature.performance')}</h3>
        <EdProse className="mt-3">
          <p>{t('compareNotebooklm.feature.performanceP1')}</p>
          <p>{t('compareNotebooklm.feature.performanceP2')}</p>
        </EdProse>

        <h3 className="ed-h3" style={{ marginTop: '40px' }}>{t('compareNotebooklm.feature.security')}</h3>
        <EdProse className="mt-3">
          <p>{t('compareNotebooklm.feature.securityP1')}</p>
          <p>{t('compareNotebooklm.feature.securityP2')}</p>
        </EdProse>
      </EdSection>

      <EdSection title={t('compareNotebooklm.whoDocTalk')}>
        <EdProse>
          <ul>
            <li>{t('compareNotebooklm.whoDocTalk.item1')}</li>
            <li>{t('compareNotebooklm.whoDocTalk.item2')}</li>
            <li>{t('compareNotebooklm.whoDocTalk.item3')}</li>
            <li>{t('compareNotebooklm.whoDocTalk.item4')}</li>
            <li>{t('compareNotebooklm.whoDocTalk.item5')}</li>
          </ul>
        </EdProse>
      </EdSection>

      <EdSection alt title={t('compareNotebooklm.whoNotebookLM')}>
        <EdProse>
          <ul>
            <li>{t('compareNotebooklm.whoNotebookLM.item1')}</li>
            <li>{t('compareNotebooklm.whoNotebookLM.item2')}</li>
            <li>{t('compareNotebooklm.whoNotebookLM.item3')}</li>
            <li>{t('compareNotebooklm.whoNotebookLM.item4')}</li>
            <li>{t('compareNotebooklm.whoNotebookLM.item5')}</li>
          </ul>
        </EdProse>
      </EdSection>

      <EdSection title={t('compareNotebooklm.verdict')}>
        <EdProse>
          <p>{t('compareNotebooklm.verdictP1')}</p>
          <p>{t('compareNotebooklm.verdictP2')}</p>
          <p>
            {t('compareNotebooklm.verdictP3Pre')}
            <Link href="/demo">
              {t('compareNotebooklm.verdictDemoLink')}
            </Link>
            {t('compareNotebooklm.verdictP3Post')}
          </p>
        </EdProse>
      </EdSection>

      <EdSection alt title={t('compareNotebooklm.faqTitle')}>
        <EdFaqList items={faqItems} />
      </EdSection>

      <EdSection>
        <EdRelatedLinks
          title={t('compareNotebooklm.relatedPages')}
          links={[
            { href: '/features/citations', label: t('compareNotebooklm.related.citations') },
            { href: '/features/multi-format', label: t('compareNotebooklm.related.multiFormat') },
            { href: '/features/multilingual', label: t('compareNotebooklm.related.multilingual') },
            { href: '/demo', label: t('compareNotebooklm.related.freeDemo') },
            { href: '/alternatives/notebooklm', label: t('compareNotebooklm.related.notebooklmAlternatives') },
          ]}
        />
      </EdSection>

      <EdCtaBanner
        title={t('compareNotebooklm.ctaTitle')}
        description={t('compareNotebooklm.ctaDescription')}
        primary={{ label: t('compareNotebooklm.ctaButton'), href: '/demo' }}
      />
    </MarketingShell>
  );
}
