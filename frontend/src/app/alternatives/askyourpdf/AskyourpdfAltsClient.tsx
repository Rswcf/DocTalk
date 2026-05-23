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
import EdCheckList from '../../../components/marketing/EdCheckList';
import EdChoiceList from '../../../components/marketing/EdChoiceList';

export default function AskyourpdfAltsClient() {
  const { t } = useLocale();

  const quickCompare = [
    { name: t('altsAskyourpdf.tableFileFormats'), doctalk: t('altsAskyourpdf.table7Formats'), competitor: t('altsAskyourpdf.tablePdfOnly') },
    { name: t('altsAskyourpdf.tableCitationHighlighting'), doctalk: true, competitor: false },
    { name: t('altsAskyourpdf.tableLanguages'), doctalk: '11', competitor: '1' },
    { name: t('altsAskyourpdf.tableFreeTier'), doctalk: t('altsAskyourpdf.tableFreeTierDoctalk'), competitor: t('altsAskyourpdf.tableFreeTierCompetitor') },
    { name: t('altsAskyourpdf.tableStartingPrice'), doctalk: '$9.99/mo', competitor: '$14.99/mo' },
  ];

  const faqItems = [
    {
      question: t('altsAskyourpdf.faq1Question'),
      answer: t('altsAskyourpdf.faq1Answer'),
    },
    {
      question: t('altsAskyourpdf.faq2Question'),
      answer: t('altsAskyourpdf.faq2Answer'),
    },
    {
      question: t('altsAskyourpdf.faq3Question'),
      answer: t('altsAskyourpdf.faq3Answer'),
    },
    {
      question: t('altsAskyourpdf.faq4Question'),
      answer: t('altsAskyourpdf.faq4Answer'),
    },
    {
      question: t('altsAskyourpdf.faq5Question'),
      answer: t('altsAskyourpdf.faq5Answer'),
    },
  ];

  const chooseItems = [
    { need: t('altsAskyourpdf.chooseNeed1'), pick: { label: 'DocTalk', href: '/demo' } },
    { need: t('altsAskyourpdf.chooseNeed2'), pick: { label: 'ChatPDF', href: '/compare/chatpdf' } },
    { need: t('altsAskyourpdf.chooseNeed3'), pick: { label: 'PDF.ai', href: '/compare/pdf-ai' } },
    { need: t('altsAskyourpdf.chooseNeed4'), pick: { label: 'Humata', href: '/compare/humata' } },
    { need: t('altsAskyourpdf.chooseNeed5'), pick: { label: 'NotebookLM', href: '/compare/notebooklm' } },
    { need: t('altsAskyourpdf.chooseNeed6'), pick: { label: 'ChatDOC', href: '/alternatives' } },
    { need: t('altsAskyourpdf.chooseNeed7'), pick: { label: 'Consensus', href: '/alternatives' } },
  ];

  return (
    <MarketingShell
      breadcrumb={[
        { label: t('altsAskyourpdf.breadcrumbHome'), href: '/' },
        { label: t('altsAskyourpdf.breadcrumbAlternatives'), href: '/alternatives' },
        { label: t('altsAskyourpdf.breadcrumbAskyourpdf') },
      ]}
    >
      <EdPageHero
        title={t('altsAskyourpdf.heroTitle')}
        lede={t('altsAskyourpdf.heroDescription')}
        primaryCta={{ label: t('altsAskyourpdf.linkFreeDemo'), href: '/demo' }}
      />

      <EdSection title={t('altsAskyourpdf.compareTitle')}>
        <EdComparisonTable features={quickCompare} competitorName="AskYourPDF" />
      </EdSection>

      <EdSection alt title={t('altsAskyourpdf.whyTitle')}>
        <EdProse>
          <p>{t('altsAskyourpdf.whyIntro')}</p>
          <ul>
            <li>{t('altsAskyourpdf.whyReason1')}</li>
            <li>{t('altsAskyourpdf.whyReason2')}</li>
            <li>{t('altsAskyourpdf.whyReason3')}</li>
            <li>{t('altsAskyourpdf.whyReason4')}</li>
          </ul>
        </EdProse>
      </EdSection>

      {/* #1 DocTalk */}
      <EdSection num="01" title={t('altsAskyourpdf.alt1Title')}>
        <div className="ed-label" style={{ color: 'var(--ed-signal)' }}>
          {t('altsAskyourpdf.bestOverall')}
        </div>
        <EdProse className="mt-3">
          <p>{t('altsAskyourpdf.alt1Desc1')}</p>
          <p>{t('altsAskyourpdf.alt1Desc2')}</p>
          <p>
            {t('altsAskyourpdf.alt1Desc3Pre')}{' '}
            <Link href="/compare/askyourpdf">{t('altsAskyourpdf.alt1CompareLink')}</Link>{' '}
            {t('altsAskyourpdf.alt1Desc3Post')}
          </p>
        </EdProse>
        <div className="ed-label" style={{ marginTop: '32px' }}>
          {t('altsAskyourpdf.keyAdvantages')}
        </div>
        <div className="mt-3">
          <EdCheckList
            items={[
              t('altsAskyourpdf.adv1'),
              t('altsAskyourpdf.adv2'),
              t('altsAskyourpdf.adv3'),
              t('altsAskyourpdf.adv4'),
              t('altsAskyourpdf.adv5'),
              t('altsAskyourpdf.adv6'),
            ]}
          />
        </div>
      </EdSection>

      {/* #2 ChatPDF */}
      <EdSection alt num="02" title={t('altsAskyourpdf.alt2Title')}>
        <EdProse>
          <p>{t('altsAskyourpdf.alt2Desc1')}</p>
          <p>
            {t('altsAskyourpdf.alt2Desc2Pre')}{' '}
            <Link href="/compare/chatpdf">{t('altsAskyourpdf.alt2CompareLink')}</Link>.
          </p>
        </EdProse>
        <p className="ed-body" style={{ marginTop: '16px' }}>
          <strong>{t('altsAskyourpdf.bestFor')}</strong> {t('altsAskyourpdf.alt2BestFor')}
        </p>
      </EdSection>

      {/* #3 PDF.ai */}
      <EdSection num="03" title={t('altsAskyourpdf.alt3Title')}>
        <EdProse>
          <p>{t('altsAskyourpdf.alt3Desc1')}</p>
          <p>
            {t('altsAskyourpdf.alt3Desc2Pre')}{' '}
            <Link href="/compare/pdf-ai">{t('altsAskyourpdf.alt3CompareLink')}</Link>.
          </p>
        </EdProse>
        <p className="ed-body" style={{ marginTop: '16px' }}>
          <strong>{t('altsAskyourpdf.bestFor')}</strong> {t('altsAskyourpdf.alt3BestFor')}
        </p>
      </EdSection>

      {/* #4 Humata */}
      <EdSection alt num="04" title={t('altsAskyourpdf.alt4Title')}>
        <EdProse>
          <p>{t('altsAskyourpdf.alt4Desc1')}</p>
          <p>
            {t('altsAskyourpdf.alt4Desc2Pre')}{' '}
            <Link href="/compare/humata">{t('altsAskyourpdf.alt4CompareLink')}</Link>.
          </p>
        </EdProse>
        <p className="ed-body" style={{ marginTop: '16px' }}>
          <strong>{t('altsAskyourpdf.bestFor')}</strong> {t('altsAskyourpdf.alt4BestFor')}
        </p>
      </EdSection>

      {/* #5 NotebookLM */}
      <EdSection num="05" title={t('altsAskyourpdf.alt5Title')}>
        <EdProse>
          <p>{t('altsAskyourpdf.alt5Desc1')}</p>
          <p>
            {t('altsAskyourpdf.alt5Desc2Pre')}{' '}
            <Link href="/compare/notebooklm">{t('altsAskyourpdf.alt5CompareLink')}</Link>.
          </p>
        </EdProse>
        <p className="ed-body" style={{ marginTop: '16px' }}>
          <strong>{t('altsAskyourpdf.bestFor')}</strong> {t('altsAskyourpdf.alt5BestFor')}
        </p>
      </EdSection>

      {/* #6 ChatDOC */}
      <EdSection alt num="06" title={t('altsAskyourpdf.alt6Title')}>
        <EdProse>
          <p>{t('altsAskyourpdf.alt6Desc1')}</p>
          <p>{t('altsAskyourpdf.alt6Desc2')}</p>
        </EdProse>
        <p className="ed-body" style={{ marginTop: '16px' }}>
          <strong>{t('altsAskyourpdf.bestFor')}</strong> {t('altsAskyourpdf.alt6BestFor')}
        </p>
      </EdSection>

      {/* #7 Consensus */}
      <EdSection num="07" title={t('altsAskyourpdf.alt7Title')}>
        <EdProse>
          <p>{t('altsAskyourpdf.alt7Desc1')}</p>
          <p>{t('altsAskyourpdf.alt7Desc2')}</p>
        </EdProse>
        <p className="ed-body" style={{ marginTop: '16px' }}>
          <strong>{t('altsAskyourpdf.bestFor')}</strong> {t('altsAskyourpdf.alt7BestFor')}
        </p>
      </EdSection>

      <EdSection alt title={t('altsAskyourpdf.chooseTitle')}>
        <p className="ed-body">{t('altsAskyourpdf.chooseDescription')}</p>
        <div style={{ marginTop: '24px' }}>
          <EdChoiceList items={chooseItems} />
        </div>
      </EdSection>

      <EdSection title={t('altsAskyourpdf.faqTitle')}>
        <EdFaqList items={faqItems} />
      </EdSection>

      <EdSection alt>
        <EdRelatedLinks
          title={t('altsAskyourpdf.relatedPages')}
          links={[
            { href: '/compare/askyourpdf', label: t('altsAskyourpdf.linkVsAskyourpdf') },
            { href: '/compare/chatpdf', label: t('altsAskyourpdf.linkVsChatpdf') },
            { href: '/alternatives/chatpdf', label: t('altsAskyourpdf.linkChatpdfAlts') },
            { href: '/features/citations', label: t('altsAskyourpdf.linkCitations') },
            { href: '/features/multi-format', label: t('altsAskyourpdf.linkMultiFormat') },
            { href: '/demo', label: t('altsAskyourpdf.linkFreeDemo') },
            { href: '/pricing', label: t('altsAskyourpdf.linkPricing') },
          ]}
        />
      </EdSection>

      <EdCtaBanner
        title={t('altsAskyourpdf.ctaTitle')}
        description={t('altsAskyourpdf.ctaDescription')}
        primary={{ label: t('altsAskyourpdf.ctaButton'), href: '/demo' }}
      />
    </MarketingShell>
  );
}
