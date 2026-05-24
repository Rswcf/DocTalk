
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

export default async function PdfAiAltsContent({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);
  const chrome = await getChromeStrings(locale);
  const href = (p: string) => localizedHrefIfAvailable(locale, p);

  const quickCompare = [
    { name: t('altsPdfai.tableFileFormats'), doctalk: t('altsPdfai.table7Formats'), competitor: t('altsPdfai.tablePdfOnly') },
    { name: t('altsPdfai.tableCitationHighlighting'), doctalk: true, competitor: false },
    { name: t('altsPdfai.tableLanguages'), doctalk: '11', competitor: '1' },
    { name: t('altsPdfai.tableFreeTier'), doctalk: t('altsPdfai.tableFreeTierDoctalk'), competitor: t('altsPdfai.tableFreeTierCompetitor') },
    { name: t('altsPdfai.tableStartingPrice'), doctalk: '$9.99/mo', competitor: '$15/mo' },
  ];

  const faqItems = [
    {
      question: t('altsPdfai.faq1Question'),
      answer: t('altsPdfai.faq1Answer'),
    },
    {
      question: t('altsPdfai.faq2Question'),
      answer: t('altsPdfai.faq2Answer'),
    },
    {
      question: t('altsPdfai.faq3Question'),
      answer: t('altsPdfai.faq3Answer'),
    },
    {
      question: t('altsPdfai.faq4Question'),
      answer: t('altsPdfai.faq4Answer'),
    },
    {
      question: t('altsPdfai.faq5Question'),
      answer: t('altsPdfai.faq5Answer'),
    },
  ];

  const chooseItems = [
    { need: t('altsPdfai.chooseNeed1'), pick: { label: 'DocTalk', href: href('/demo') } },
    { need: t('altsPdfai.chooseNeed2'), pick: { label: 'ChatPDF', href: href('/compare/chatpdf') } },
    { need: t('altsPdfai.chooseNeed3'), pick: { label: 'AskYourPDF', href: href('/compare/askyourpdf') } },
    { need: t('altsPdfai.chooseNeed4'), pick: { label: 'Humata', href: href('/compare/humata') } },
    { need: t('altsPdfai.chooseNeed5'), pick: { label: 'NotebookLM', href: href('/compare/notebooklm') } },
    { need: t('altsPdfai.chooseNeed6'), pick: { label: 'ChatDOC', href: href('/alternatives') } },
    { need: t('altsPdfai.chooseNeed7'), pick: { label: 'Sharly', href: href('/alternatives') } },
  ];

  return (
    <MarketingShell
      chrome={chrome}
      breadcrumb={[
        { label: t('altsPdfai.breadcrumbHome'), href: href('/') },
        { label: t('altsPdfai.breadcrumbAlternatives'), href: href('/alternatives') },
        { label: t('altsPdfai.breadcrumbPdfai') },
      ]}
    >
      <EdPageHero
        title={t('altsPdfai.heroTitle')}
        lede={t('altsPdfai.heroDescription')}
        primaryCta={{ label: t('altsPdfai.linkFreeDemo'), href: href('/demo') }}
      />

      <EdSection title={t('altsPdfai.compareTitle')}>
        <EdComparisonTable features={quickCompare} competitorName="PDF.ai" />
      </EdSection>

      <EdSection alt title={t('altsPdfai.whyTitle')}>
        <EdProse>
          <p>{t('altsPdfai.whyIntro')}</p>
          <ul>
            <li>{t('altsPdfai.whyReason1')}</li>
            <li>{t('altsPdfai.whyReason2')}</li>
            <li>{t('altsPdfai.whyReason3')}</li>
            <li>{t('altsPdfai.whyReason4')}</li>
          </ul>
        </EdProse>
      </EdSection>

      {/* #1 DocTalk */}
      <EdSection num="01" title={t('altsPdfai.alt1Title')}>
        <div className="ed-label" style={{ color: 'var(--ed-signal)' }}>
          {t('altsPdfai.bestOverall')}
        </div>
        <EdProse className="mt-3">
          <p>{t('altsPdfai.alt1Desc1')}</p>
          <p>{t('altsPdfai.alt1Desc2')}</p>
          <p>
            {t('altsPdfai.alt1Desc3Pre')}{' '}
            <Link href={href("/compare/pdf-ai")}>{t('altsPdfai.alt1CompareLink')}</Link>{' '}
            {t('altsPdfai.alt1Desc3Post')}
          </p>
        </EdProse>
        <div className="ed-label" style={{ marginTop: '32px' }}>
          {t('altsPdfai.keyAdvantages')}
        </div>
        <div className="mt-3">
          <EdCheckList
            items={[
              t('altsPdfai.adv1'),
              t('altsPdfai.adv2'),
              t('altsPdfai.adv3'),
              t('altsPdfai.adv4'),
              t('altsPdfai.adv5'),
              t('altsPdfai.adv6'),
            ]}
          />
        </div>
      </EdSection>

      {/* #2 ChatPDF */}
      <EdSection alt num="02" title={t('altsPdfai.alt2Title')}>
        <EdProse>
          <p>{t('altsPdfai.alt2Desc1')}</p>
          <p>
            {t('altsPdfai.alt2Desc2Pre')}{' '}
            <Link href={href("/compare/chatpdf")}>{t('altsPdfai.alt2CompareLink')}</Link>.
          </p>
        </EdProse>
        <p className="ed-body" style={{ marginTop: '16px' }}>
          <strong>{t('altsPdfai.bestFor')}</strong> {t('altsPdfai.alt2BestFor')}
        </p>
      </EdSection>

      {/* #3 AskYourPDF */}
      <EdSection num="03" title={t('altsPdfai.alt3Title')}>
        <EdProse>
          <p>{t('altsPdfai.alt3Desc1')}</p>
          <p>
            {t('altsPdfai.alt3Desc2Pre')}{' '}
            <Link href={href("/compare/askyourpdf")}>{t('altsPdfai.alt3CompareLink')}</Link>.
          </p>
        </EdProse>
        <p className="ed-body" style={{ marginTop: '16px' }}>
          <strong>{t('altsPdfai.bestFor')}</strong> {t('altsPdfai.alt3BestFor')}
        </p>
      </EdSection>

      {/* #4 Humata */}
      <EdSection alt num="04" title={t('altsPdfai.alt4Title')}>
        <EdProse>
          <p>{t('altsPdfai.alt4Desc1')}</p>
          <p>
            {t('altsPdfai.alt4Desc2Pre')}{' '}
            <Link href={href("/compare/humata")}>{t('altsPdfai.alt4CompareLink')}</Link>.
          </p>
        </EdProse>
        <p className="ed-body" style={{ marginTop: '16px' }}>
          <strong>{t('altsPdfai.bestFor')}</strong> {t('altsPdfai.alt4BestFor')}
        </p>
      </EdSection>

      {/* #5 NotebookLM */}
      <EdSection num="05" title={t('altsPdfai.alt5Title')}>
        <EdProse>
          <p>{t('altsPdfai.alt5Desc1')}</p>
          <p>
            {t('altsPdfai.alt5Desc2Pre')}{' '}
            <Link href={href("/compare/notebooklm")}>{t('altsPdfai.alt5CompareLink')}</Link>.
          </p>
        </EdProse>
        <p className="ed-body" style={{ marginTop: '16px' }}>
          <strong>{t('altsPdfai.bestFor')}</strong> {t('altsPdfai.alt5BestFor')}
        </p>
      </EdSection>

      {/* #6 ChatDOC */}
      <EdSection alt num="06" title={t('altsPdfai.alt6Title')}>
        <EdProse>
          <p>{t('altsPdfai.alt6Desc1')}</p>
          <p>{t('altsPdfai.alt6Desc2')}</p>
        </EdProse>
        <p className="ed-body" style={{ marginTop: '16px' }}>
          <strong>{t('altsPdfai.bestFor')}</strong> {t('altsPdfai.alt6BestFor')}
        </p>
      </EdSection>

      {/* #7 Sharly */}
      <EdSection num="07" title={t('altsPdfai.alt7Title')}>
        <EdProse>
          <p>{t('altsPdfai.alt7Desc1')}</p>
          <p>{t('altsPdfai.alt7Desc2')}</p>
        </EdProse>
        <p className="ed-body" style={{ marginTop: '16px' }}>
          <strong>{t('altsPdfai.bestFor')}</strong> {t('altsPdfai.alt7BestFor')}
        </p>
      </EdSection>

      <EdSection alt title={t('altsPdfai.chooseTitle')}>
        <p className="ed-body">{t('altsPdfai.chooseDescription')}</p>
        <div style={{ marginTop: '24px' }}>
          <EdChoiceList items={chooseItems} />
        </div>
      </EdSection>

      <EdSection title={t('altsPdfai.faqTitle')}>
        <EdFaqList items={faqItems} />
      </EdSection>

      <EdSection alt>
        <EdRelatedLinks
          title={t('altsPdfai.relatedPages')}
          links={[
            { href: href('/compare/pdf-ai'), label: t('altsPdfai.linkVsPdfai') },
            { href: href('/compare/chatpdf'), label: t('altsPdfai.linkVsChatpdf') },
            { href: href('/alternatives/chatpdf'), label: t('altsPdfai.linkChatpdfAlts') },
            { href: href('/alternatives/askyourpdf'), label: t('altsPdfai.linkAskyourpdfAlts') },
            { href: href('/features/citations'), label: t('altsPdfai.linkCitations') },
            { href: href('/features/multi-format'), label: t('altsPdfai.linkMultiFormat') },
            { href: href('/demo'), label: t('altsPdfai.linkFreeDemo') },
            { href: href('/pricing'), label: t('altsPdfai.linkPricing') },
          ]}
        />
      </EdSection>

      <EdCtaBanner
        title={t('altsPdfai.ctaTitle')}
        description={t('altsPdfai.ctaDescription')}
        primary={{ label: t('altsPdfai.ctaButton'), href: href('/demo') }}
      />
    
      <MarketingLocaleLinks path="/alternatives/pdf-ai" label={chrome.language} />
    </MarketingShell>
  );
}
