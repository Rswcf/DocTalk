
import React from 'react';
import Link from 'next/link';
import { getServerT } from '../../../i18n/server';
import { getChromeStrings } from '../../../i18n/chrome';
import { localizedHrefIfAvailable } from '../../../i18n/routing';
import MarketingLocaleLinks from '../../../components/marketing/MarketingLocaleLinks';
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

export default async function ChatpdfAltsContent({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);
  const chrome = await getChromeStrings(locale);
  const href = (p: string) => localizedHrefIfAvailable(locale, p);

  const quickCompare = [
    { name: t('altsChatpdf.tableFileFormats'), doctalk: t('altsChatpdf.table7Formats'), competitor: t('altsChatpdf.tablePdfOnly') },
    { name: t('altsChatpdf.tableCitationHighlighting'), doctalk: true, competitor: false },
    { name: t('altsChatpdf.tableLanguages'), doctalk: '11', competitor: '1' },
    { name: t('altsChatpdf.tableFreeTier'), doctalk: t('altsChatpdf.tableFreeTierDoctalk'), competitor: t('altsChatpdf.tableFreeTierChatpdf') },
    { name: t('altsChatpdf.tableStartingPrice'), doctalk: '$9.99/mo', competitor: '$19.99/mo' },
  ];

  const faqItems = [
    {
      question: t('altsChatpdf.faq1Question'),
      answer: t('altsChatpdf.faq1Answer'),
    },
    {
      question: t('altsChatpdf.faq2Question'),
      answer: t('altsChatpdf.faq2Answer'),
    },
    {
      question: t('altsChatpdf.faq3Question'),
      answer: t('altsChatpdf.faq3Answer'),
    },
    {
      question: t('altsChatpdf.faq4Question'),
      answer: t('altsChatpdf.faq4Answer'),
    },
    {
      question: t('altsChatpdf.faq5Question'),
      answer: t('altsChatpdf.faq5Answer'),
    },
  ];

  const chooseItems = [
    { need: t('altsChatpdf.chooseNeed1'), pick: { label: 'DocTalk', href: href('/demo') } },
    { need: t('altsChatpdf.chooseNeed2'), pick: { label: 'AskYourPDF', href: href('/compare/askyourpdf') } },
    { need: t('altsChatpdf.chooseNeed3'), pick: { label: 'Humata', href: href('/compare/humata') } },
    { need: t('altsChatpdf.chooseNeed4'), pick: { label: 'NotebookLM', href: href('/compare/notebooklm') } },
    { need: t('altsChatpdf.chooseNeed5'), pick: { label: 'PDF.ai', href: href('/compare/pdf-ai') } },
    { need: t('altsChatpdf.chooseNeed6'), pick: { label: 'ChatDOC', href: href('/alternatives') } },
    { need: t('altsChatpdf.chooseNeed7'), pick: { label: 'Sharly', href: href('/alternatives') } },
  ];

  return (
    <MarketingShell
      chrome={chrome}
      breadcrumb={[
        { label: t('altsChatpdf.breadcrumbHome'), href: href('/') },
        { label: t('altsChatpdf.breadcrumbAlternatives'), href: href('/alternatives') },
        { label: t('altsChatpdf.breadcrumbChatpdf') },
      ]}
    >
      <EdPageHero
        title={t('altsChatpdf.heroTitle')}
        lede={t('altsChatpdf.heroDescription')}
        primaryCta={{ label: t('altsChatpdf.linkFreeDemo'), href: href('/demo') }}
      />

      <EdSection title={t('altsChatpdf.compareTitle')}>
        <EdComparisonTable features={quickCompare} competitorName="ChatPDF" />
      </EdSection>

      {/* #1 DocTalk */}
      <EdSection alt num="01" title={t('altsChatpdf.alt1Title')}>
        <div className="ed-label" style={{ color: 'var(--ed-signal)' }}>
          {t('altsChatpdf.bestOverall')}
        </div>
        <EdProse className="mt-3">
          <p>{t('altsChatpdf.alt1Desc1')}</p>
          <p>{t('altsChatpdf.alt1Desc2')}</p>
          <p>
            {t('altsChatpdf.alt1Desc3Pre')}{' '}
            <Link href={href("/compare/chatpdf")}>{t('altsChatpdf.alt1CompareLink')}</Link>{' '}
            {t('altsChatpdf.alt1Desc3Post')}
          </p>
        </EdProse>
        <div className="ed-label" style={{ marginTop: '32px' }}>
          {t('altsChatpdf.keyAdvantages')}
        </div>
        <div className="mt-3">
          <EdCheckList
            items={[
              t('altsChatpdf.adv1'),
              t('altsChatpdf.adv2'),
              t('altsChatpdf.adv3'),
              t('altsChatpdf.adv4'),
              t('altsChatpdf.adv5'),
              t('altsChatpdf.adv6'),
            ]}
          />
        </div>
      </EdSection>

      {/* #2 AskYourPDF */}
      <EdSection num="02" title={t('altsChatpdf.alt2Title')}>
        <EdProse>
          <p>{t('altsChatpdf.alt2Desc1')}</p>
          <p>
            {t('altsChatpdf.alt2Desc2Pre')}{' '}
            <Link href={href("/compare/askyourpdf")}>{t('altsChatpdf.alt2CompareLink')}</Link>.
          </p>
        </EdProse>
        <p className="ed-body" style={{ marginTop: '16px' }}>
          <strong>{t('altsChatpdf.bestFor')}</strong> {t('altsChatpdf.alt2BestFor')}
        </p>
      </EdSection>

      {/* #3 Humata */}
      <EdSection alt num="03" title={t('altsChatpdf.alt3Title')}>
        <EdProse>
          <p>{t('altsChatpdf.alt3Desc1')}</p>
          <p>{t('altsChatpdf.alt3Desc2')}</p>
        </EdProse>
        <p className="ed-body" style={{ marginTop: '16px' }}>
          <strong>{t('altsChatpdf.bestFor')}</strong> {t('altsChatpdf.alt3BestFor')}
        </p>
      </EdSection>

      {/* #4 NotebookLM */}
      <EdSection num="04" title={t('altsChatpdf.alt4Title')}>
        <EdProse>
          <p>{t('altsChatpdf.alt4Desc1')}</p>
          <p>{t('altsChatpdf.alt4Desc2')}</p>
        </EdProse>
        <p className="ed-body" style={{ marginTop: '16px' }}>
          <strong>{t('altsChatpdf.bestFor')}</strong> {t('altsChatpdf.alt4BestFor')}
        </p>
      </EdSection>

      {/* #5 PDF.ai */}
      <EdSection alt num="05" title={t('altsChatpdf.alt5Title')}>
        <EdProse>
          <p>{t('altsChatpdf.alt5Desc1')}</p>
          <p>{t('altsChatpdf.alt5Desc2')}</p>
        </EdProse>
        <p className="ed-body" style={{ marginTop: '16px' }}>
          <strong>{t('altsChatpdf.bestFor')}</strong> {t('altsChatpdf.alt5BestFor')}
        </p>
      </EdSection>

      {/* #6 ChatDOC */}
      <EdSection num="06" title={t('altsChatpdf.alt6Title')}>
        <EdProse>
          <p>{t('altsChatpdf.alt6Desc1')}</p>
          <p>{t('altsChatpdf.alt6Desc2')}</p>
        </EdProse>
        <p className="ed-body" style={{ marginTop: '16px' }}>
          <strong>{t('altsChatpdf.bestFor')}</strong> {t('altsChatpdf.alt6BestFor')}
        </p>
      </EdSection>

      {/* #7 Sharly */}
      <EdSection alt num="07" title={t('altsChatpdf.alt7Title')}>
        <EdProse>
          <p>{t('altsChatpdf.alt7Desc1')}</p>
          <p>{t('altsChatpdf.alt7Desc2')}</p>
        </EdProse>
        <p className="ed-body" style={{ marginTop: '16px' }}>
          <strong>{t('altsChatpdf.bestFor')}</strong> {t('altsChatpdf.alt7BestFor')}
        </p>
      </EdSection>

      <EdSection title={t('altsChatpdf.chooseTitle')}>
        <p className="ed-body">{t('altsChatpdf.chooseDescription')}</p>
        <div style={{ marginTop: '24px' }}>
          <EdChoiceList items={chooseItems} />
        </div>
      </EdSection>

      <EdSection alt title={t('altsChatpdf.faqTitle')}>
        <EdFaqList items={faqItems} />
      </EdSection>

      <EdSection>
        <EdRelatedLinks
          title={t('altsChatpdf.relatedPages')}
          links={[
            { href: href('/compare/chatpdf'), label: t('altsChatpdf.linkVsChatpdf') },
            { href: href('/compare/askyourpdf'), label: t('altsChatpdf.linkVsAskyourpdf') },
            { href: href('/features/citations'), label: t('altsChatpdf.linkCitations') },
            { href: href('/features/multi-format'), label: t('altsChatpdf.linkMultiFormat') },
            { href: href('/demo'), label: t('altsChatpdf.linkFreeDemo') },
            { href: href('/pricing'), label: t('altsChatpdf.linkPricing') },
          ]}
        />
      </EdSection>

      <EdCtaBanner
        title={t('altsChatpdf.ctaTitle')}
        description={t('altsChatpdf.ctaDescription')}
        primary={{ label: t('altsChatpdf.ctaButton'), href: href('/demo') }}
      />
    
      <MarketingLocaleLinks path="/alternatives/chatpdf" label={chrome.language} />
    </MarketingShell>
  );
}
