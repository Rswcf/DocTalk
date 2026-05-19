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

export default function ChatpdfClient() {
  const { t } = useLocale();

  const features = [
    { name: t('compareChatpdf.table.supportedFormats'), doctalk: t('compareChatpdf.table.doctalk.supportedFormats'), competitor: t('compareChatpdf.table.competitor.supportedFormats') },
    { name: t('compareChatpdf.table.citationHighlighting'), doctalk: true, competitor: false },
    { name: t('compareChatpdf.table.interfaceLanguages'), doctalk: t('compareChatpdf.table.doctalk.interfaceLanguages'), competitor: t('compareChatpdf.table.competitor.interfaceLanguages') },
    { name: t('compareChatpdf.table.freeTier'), doctalk: t('compareChatpdf.table.doctalk.freeTier'), competitor: t('compareChatpdf.table.competitor.freeTier') },
    { name: t('compareChatpdf.table.noSignupDemo'), doctalk: true, competitor: false },
    { name: t('compareChatpdf.table.multipleAiModels'), doctalk: t('compareChatpdf.table.doctalk.multipleAiModels'), competitor: t('compareChatpdf.table.competitor.multipleAiModels') },
    { name: t('compareChatpdf.table.docSizeLimit'), doctalk: t('compareChatpdf.table.doctalk.docSizeLimit'), competitor: t('compareChatpdf.table.competitor.docSizeLimit') },
    { name: t('compareChatpdf.table.darkMode'), doctalk: true, competitor: false },
    { name: t('compareChatpdf.table.webUrlIngestion'), doctalk: true, competitor: false },
    { name: t('compareChatpdf.table.customInstructions'), doctalk: t('compareChatpdf.table.doctalk.customInstructions'), competitor: false },
  ];

  const faqItems = [
    {
      question: t('compareChatpdf.faq.q1'),
      answer: t('compareChatpdf.faq.a1'),
    },
    {
      question: t('compareChatpdf.faq.q2'),
      answer: t('compareChatpdf.faq.a2'),
    },
    {
      question: t('compareChatpdf.faq.q3'),
      answer: t('compareChatpdf.faq.a3'),
    },
    {
      question: t('compareChatpdf.faq.q4'),
      answer: t('compareChatpdf.faq.a4'),
    },
    {
      question: t('compareChatpdf.faq.q5'),
      answer: t('compareChatpdf.faq.a5'),
    },
  ];

  return (
    <MarketingShell
      breadcrumb={[
        { label: t('compareChatpdf.breadcrumb.home'), href: '/' },
        { label: t('compareChatpdf.breadcrumb.compare'), href: '/compare' },
        { label: t('compareChatpdf.breadcrumb.current') },
      ]}
    >
      <EdPageHero
        title={t('compareChatpdf.heroTitle')}
        lede={t('compareChatpdf.heroDescription')}
        primaryCta={{ label: t('compareChatpdf.related.freeDemo'), href: '/demo' }}
      />

      <EdSection title={t('compareChatpdf.quickComparison')}>
        <EdComparisonTable features={features} competitorName="ChatPDF" />
      </EdSection>

      <EdSection alt title={t('compareChatpdf.whatIsDocTalk')}>
        <EdProse>
          <p>
            {t('compareChatpdf.whatIsDocTalkDescription')}{' '}
            DocTalk uses a <a href="https://arxiv.org/abs/2005.11401" target="_blank" rel="noopener noreferrer">Retrieval-Augmented Generation (RAG)</a> architecture to deliver accurate, cited answers.
          </p>
        </EdProse>
      </EdSection>

      <EdSection title={t('compareChatpdf.whatIsChatPDF')}>
        <EdProse>
          <p>
            <a href="https://chatpdf.com" target="_blank" rel="noopener noreferrer">ChatPDF</a>{' '}
            {t('compareChatpdf.whatIsChatPDFDescription')}
          </p>
        </EdProse>
      </EdSection>

      <EdSection alt title={t('compareChatpdf.featureByFeature')}>
        <h3 className="ed-h3">{t('compareChatpdf.feature.formatSupport')}</h3>
        <EdProse className="mt-3">
          <p>{t('compareChatpdf.feature.formatSupportP1')}</p>
          <p>
            {t('compareChatpdf.feature.formatSupportP2Pre')}
            <Link href="/features/multi-format">
              {t('compareChatpdf.feature.formatSupportLink')}
            </Link>
            {t('compareChatpdf.feature.formatSupportP2Post')}
          </p>
        </EdProse>

        <h3 className="ed-h3" style={{ marginTop: '40px' }}>{t('compareChatpdf.feature.citations')}</h3>
        <EdProse className="mt-3">
          <p>{t('compareChatpdf.feature.citationsP1')}</p>
          <p>
            {t('compareChatpdf.feature.citationsP2Pre')}
            <Link href="/features/citations">
              {t('compareChatpdf.feature.citationsLink')}
            </Link>.
          </p>
        </EdProse>

        <h3 className="ed-h3" style={{ marginTop: '40px' }}>{t('compareChatpdf.feature.languages')}</h3>
        <EdProse className="mt-3">
          <p>{t('compareChatpdf.feature.languagesP1')}</p>
          <p>
            {t('compareChatpdf.feature.languagesP2Pre')}
            <Link href="/features/multilingual">
              {t('compareChatpdf.feature.languagesLink')}
            </Link>
            {t('compareChatpdf.feature.languagesP2Post')}
          </p>
        </EdProse>

        <h3 className="ed-h3" style={{ marginTop: '40px' }}>{t('compareChatpdf.feature.pricing')}</h3>
        <EdProse className="mt-3">
          <p>{t('compareChatpdf.feature.pricingP1')}</p>
          <p>
            {t('compareChatpdf.feature.pricingP2Pre')}
            <Link href="/demo">{t('compareChatpdf.feature.pricingDemoLink')}</Link>
            {t('compareChatpdf.feature.pricingP2Mid')}
            <Link href="/pricing">
              {t('compareChatpdf.feature.pricingLink')}
            </Link>.
          </p>
        </EdProse>

        <h3 className="ed-h3" style={{ marginTop: '40px' }}>{t('compareChatpdf.feature.performance')}</h3>
        <EdProse className="mt-3">
          <p>{t('compareChatpdf.feature.performanceP1')}</p>
          <p>{t('compareChatpdf.feature.performanceP2')}</p>
        </EdProse>

        <h3 className="ed-h3" style={{ marginTop: '40px' }}>{t('compareChatpdf.feature.security')}</h3>
        <EdProse className="mt-3">
          <p>{t('compareChatpdf.feature.securityP1')}</p>
          <p>{t('compareChatpdf.feature.securityP2')}</p>
        </EdProse>
      </EdSection>

      <EdSection title={t('compareChatpdf.whoDocTalk')}>
        <EdProse>
          <ul>
            <li>{t('compareChatpdf.whoDocTalk.item1')}</li>
            <li>{t('compareChatpdf.whoDocTalk.item2')}</li>
            <li>{t('compareChatpdf.whoDocTalk.item3')}</li>
            <li>{t('compareChatpdf.whoDocTalk.item4')}</li>
            <li>{t('compareChatpdf.whoDocTalk.item5')}</li>
          </ul>
        </EdProse>
      </EdSection>

      <EdSection alt title={t('compareChatpdf.whoChatPDF')}>
        <EdProse>
          <ul>
            <li>{t('compareChatpdf.whoChatPDF.item1')}</li>
            <li>{t('compareChatpdf.whoChatPDF.item2')}</li>
            <li>{t('compareChatpdf.whoChatPDF.item3')}</li>
            <li>{t('compareChatpdf.whoChatPDF.item4')}</li>
          </ul>
        </EdProse>
      </EdSection>

      <EdSection title={t('compareChatpdf.verdict')}>
        <EdProse>
          <p>{t('compareChatpdf.verdictP1')}</p>
          <p>{t('compareChatpdf.verdictP2')}</p>
          <p>
            {t('compareChatpdf.verdictP3Pre')}
            <Link href="/demo">
              {t('compareChatpdf.verdictDemoLink')}
            </Link>
            {t('compareChatpdf.verdictP3Post')}
          </p>
        </EdProse>
      </EdSection>

      <EdSection alt title={t('compareChatpdf.faqTitle')}>
        <EdFaqList items={faqItems} />
      </EdSection>

      <EdSection>
        <EdRelatedLinks
          title={t('compareChatpdf.relatedPages')}
          links={[
            { href: '/features/citations', label: t('compareChatpdf.related.citations') },
            { href: '/features/multi-format', label: t('compareChatpdf.related.multiFormat') },
            { href: '/features/multilingual', label: t('compareChatpdf.related.multilingual') },
            { href: '/demo', label: t('compareChatpdf.related.freeDemo') },
            { href: '/pricing', label: t('compareChatpdf.related.pricing') },
            { href: '/alternatives/chatpdf', label: t('compareChatpdf.related.chatpdfAlternatives') },
          ]}
        />
      </EdSection>

      <EdCtaBanner
        title={t('compareChatpdf.ctaTitle')}
        description={t('compareChatpdf.ctaDescription')}
        primary={{ label: t('compareChatpdf.ctaButton'), href: '/demo' }}
      />
    </MarketingShell>
  );
}
