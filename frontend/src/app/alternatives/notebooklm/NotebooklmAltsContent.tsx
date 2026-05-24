
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
import EdFaqList from '../../../components/marketing/EdFaqList';
import EdRelatedLinks from '../../../components/marketing/EdRelatedLinks';
import EdCtaBanner from '../../../components/marketing/EdCtaBanner';
import EdCheckList from '../../../components/marketing/EdCheckList';
import EdChoiceList from '../../../components/marketing/EdChoiceList';

export default async function NotebooklmAltsContent({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);
  const chrome = await getChromeStrings(locale);
  const href = (p: string) => localizedHrefIfAvailable(locale, p);

  const faqItems = [
    {
      question: t('altsNotebooklm.faq1Question'),
      answer: t('altsNotebooklm.faq1Answer'),
    },
    {
      question: t('altsNotebooklm.faq2Question'),
      answer: t('altsNotebooklm.faq2Answer'),
    },
    {
      question: t('altsNotebooklm.faq3Question'),
      answer: t('altsNotebooklm.faq3Answer'),
    },
    {
      question: t('altsNotebooklm.faq4Question'),
      answer: t('altsNotebooklm.faq4Answer'),
    },
    {
      question: t('altsNotebooklm.faq5Question'),
      answer: t('altsNotebooklm.faq5Answer'),
    },
  ];

  const chooseItems = [
    { need: t('altsNotebooklm.chooseNeed1'), pick: { label: 'DocTalk', href: href('/demo') } },
    { need: t('altsNotebooklm.chooseNeed2'), pick: { label: 'ChatPDF', href: href('/compare/chatpdf') } },
    { need: t('altsNotebooklm.chooseNeed3'), pick: { label: 'AskYourPDF', href: href('/compare/askyourpdf') } },
    { need: t('altsNotebooklm.chooseNeed4'), pick: { label: 'Humata', href: href('/compare/humata') } },
    { need: t('altsNotebooklm.chooseNeed5'), pick: { label: 'Consensus', href: href('/alternatives') } },
    { need: t('altsNotebooklm.chooseNeed6'), pick: { label: 'Elicit', href: href('/alternatives') } },
  ];

  return (
    <MarketingShell
      chrome={chrome}
      breadcrumb={[
        { label: t('altsNotebooklm.breadcrumbHome'), href: href('/') },
        { label: t('altsNotebooklm.breadcrumbAlternatives'), href: href('/alternatives') },
        { label: t('altsNotebooklm.breadcrumbNotebooklm') },
      ]}
    >
      <EdPageHero
        title={t('altsNotebooklm.heroTitle')}
        lede={t('altsNotebooklm.heroDescription')}
        primaryCta={{ label: t('altsNotebooklm.linkFreeDemo'), href: href('/demo') }}
      />

      {/* #1 DocTalk */}
      <EdSection num="01" title={t('altsNotebooklm.alt1Title')}>
        <div className="ed-label" style={{ color: 'var(--ed-signal)' }}>
          {t('altsNotebooklm.bestOverall')}
        </div>
        <EdProse className="mt-3">
          <p>{t('altsNotebooklm.alt1Desc1')}</p>
          <p>{t('altsNotebooklm.alt1Desc2')}</p>
          <p>
            {t('altsNotebooklm.alt1Desc3Pre')}{' '}
            <Link href={href("/compare/notebooklm")}>{t('altsNotebooklm.alt1CompareLink')}</Link>.
          </p>
        </EdProse>
        <div className="ed-label" style={{ marginTop: '32px' }}>
          {t('altsNotebooklm.keyAdvantages')}
        </div>
        <div className="mt-3">
          <EdCheckList
            items={[
              t('altsNotebooklm.adv1'),
              t('altsNotebooklm.adv2'),
              t('altsNotebooklm.adv3'),
              t('altsNotebooklm.adv4'),
              t('altsNotebooklm.adv5'),
              t('altsNotebooklm.adv6'),
            ]}
          />
        </div>
      </EdSection>

      {/* #2 ChatPDF */}
      <EdSection alt num="02" title={t('altsNotebooklm.alt2Title')}>
        <EdProse>
          <p>{t('altsNotebooklm.alt2Desc1')}</p>
          <p>{t('altsNotebooklm.alt2Desc2')}</p>
        </EdProse>
        <p className="ed-body" style={{ marginTop: '16px' }}>
          <strong>{t('altsNotebooklm.bestFor')}</strong> {t('altsNotebooklm.alt2BestFor')}
        </p>
      </EdSection>

      {/* #3 AskYourPDF */}
      <EdSection num="03" title={t('altsNotebooklm.alt3Title')}>
        <EdProse>
          <p>{t('altsNotebooklm.alt3Desc1')}</p>
          <p>{t('altsNotebooklm.alt3Desc2')}</p>
        </EdProse>
        <p className="ed-body" style={{ marginTop: '16px' }}>
          <strong>{t('altsNotebooklm.bestFor')}</strong> {t('altsNotebooklm.alt3BestFor')}
        </p>
      </EdSection>

      {/* #4 Humata */}
      <EdSection alt num="04" title={t('altsNotebooklm.alt4Title')}>
        <EdProse>
          <p>{t('altsNotebooklm.alt4Desc1')}</p>
          <p>{t('altsNotebooklm.alt4Desc2')}</p>
        </EdProse>
        <p className="ed-body" style={{ marginTop: '16px' }}>
          <strong>{t('altsNotebooklm.bestFor')}</strong> {t('altsNotebooklm.alt4BestFor')}
        </p>
      </EdSection>

      {/* #5 Consensus */}
      <EdSection num="05" title={t('altsNotebooklm.alt5Title')}>
        <EdProse>
          <p>{t('altsNotebooklm.alt5Desc1')}</p>
          <p>{t('altsNotebooklm.alt5Desc2')}</p>
        </EdProse>
        <p className="ed-body" style={{ marginTop: '16px' }}>
          <strong>{t('altsNotebooklm.bestFor')}</strong> {t('altsNotebooklm.alt5BestFor')}
        </p>
      </EdSection>

      {/* #6 Elicit */}
      <EdSection alt num="06" title={t('altsNotebooklm.alt6Title')}>
        <EdProse>
          <p>{t('altsNotebooklm.alt6Desc1')}</p>
          <p>{t('altsNotebooklm.alt6Desc2')}</p>
        </EdProse>
        <p className="ed-body" style={{ marginTop: '16px' }}>
          <strong>{t('altsNotebooklm.bestFor')}</strong> {t('altsNotebooklm.alt6BestFor')}
        </p>
      </EdSection>

      <EdSection title={t('altsNotebooklm.chooseTitle')}>
        <p className="ed-body">{t('altsNotebooklm.chooseDescription')}</p>
        <div style={{ marginTop: '24px' }}>
          <EdChoiceList items={chooseItems} />
        </div>
      </EdSection>

      <EdSection alt title={t('altsNotebooklm.faqTitle')}>
        <EdFaqList items={faqItems} />
      </EdSection>

      <EdSection>
        <EdRelatedLinks
          title={t('altsNotebooklm.relatedPages')}
          links={[
            { href: href('/compare/notebooklm'), label: t('altsNotebooklm.linkVsNotebooklm') },
            { href: href('/features/citations'), label: t('altsNotebooklm.linkCitations') },
            { href: href('/features/multilingual'), label: t('altsNotebooklm.linkMultilingual') },
            { href: href('/demo'), label: t('altsNotebooklm.linkFreeDemo') },
          ]}
        />
      </EdSection>

      <EdCtaBanner
        title={t('altsNotebooklm.ctaTitle')}
        description={t('altsNotebooklm.ctaDescription')}
        primary={{ label: t('altsNotebooklm.ctaButton'), href: href('/demo') }}
      />
    
      <MarketingLocaleLinks path="/alternatives/notebooklm" label={chrome.language} />
    </MarketingShell>
  );
}
