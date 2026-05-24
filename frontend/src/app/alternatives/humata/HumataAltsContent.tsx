
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

export default async function HumataAltsContent({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);
  const chrome = await getChromeStrings(locale);
  const href = (p: string) => localizedHrefIfAvailable(locale, p);

  const faqItems = [
    {
      question: t('altsHumata.faq1Question'),
      answer: t('altsHumata.faq1Answer'),
    },
    {
      question: t('altsHumata.faq2Question'),
      answer: t('altsHumata.faq2Answer'),
    },
    {
      question: t('altsHumata.faq3Question'),
      answer: t('altsHumata.faq3Answer'),
    },
    {
      question: t('altsHumata.faq4Question'),
      answer: t('altsHumata.faq4Answer'),
    },
    {
      question: t('altsHumata.faq5Question'),
      answer: t('altsHumata.faq5Answer'),
    },
  ];

  const chooseItems = [
    { need: t('altsHumata.chooseNeed1'), pick: { label: 'DocTalk', href: href('/demo') } },
    { need: t('altsHumata.chooseNeed2'), pick: { label: 'ChatPDF', href: href('/compare/chatpdf') } },
    { need: t('altsHumata.chooseNeed3'), pick: { label: 'AskYourPDF', href: href('/compare/askyourpdf') } },
    { need: t('altsHumata.chooseNeed4'), pick: { label: 'NotebookLM', href: href('/compare/notebooklm') } },
    { need: t('altsHumata.chooseNeed5'), pick: { label: 'PDF.ai', href: href('/compare/pdf-ai') } },
  ];

  return (
    <MarketingShell
      chrome={chrome}
      breadcrumb={[
        { label: t('altsHumata.breadcrumbHome'), href: href('/') },
        { label: t('altsHumata.breadcrumbAlternatives'), href: href('/alternatives') },
        { label: t('altsHumata.breadcrumbHumata') },
      ]}
    >
      <EdPageHero
        title={t('altsHumata.heroTitle')}
        lede={t('altsHumata.heroDescription')}
        primaryCta={{ label: t('altsHumata.linkFreeDemo'), href: href('/demo') }}
      />

      {/* #1 DocTalk */}
      <EdSection num="01" title={t('altsHumata.alt1Title')}>
        <div className="ed-label" style={{ color: 'var(--ed-signal)' }}>
          {t('altsHumata.bestOverall')}
        </div>
        <EdProse className="mt-3">
          <p>{t('altsHumata.alt1Desc1')}</p>
          <p>{t('altsHumata.alt1Desc2')}</p>
          <p>
            {t('altsHumata.alt1Desc3Pre')}{' '}
            <Link href={href("/compare/humata")}>{t('altsHumata.alt1CompareLink')}</Link>.
          </p>
        </EdProse>
        <div className="ed-label" style={{ marginTop: '32px' }}>
          {t('altsHumata.keyAdvantages')}
        </div>
        <div className="mt-3">
          <EdCheckList
            items={[
              t('altsHumata.adv1'),
              t('altsHumata.adv2'),
              t('altsHumata.adv3'),
              t('altsHumata.adv4'),
              t('altsHumata.adv5'),
              t('altsHumata.adv6'),
            ]}
          />
        </div>
      </EdSection>

      {/* #2 ChatPDF */}
      <EdSection alt num="02" title={t('altsHumata.alt2Title')}>
        <EdProse>
          <p>{t('altsHumata.alt2Desc1')}</p>
          <p>{t('altsHumata.alt2Desc2')}</p>
        </EdProse>
        <p className="ed-body" style={{ marginTop: '16px' }}>
          <strong>{t('altsHumata.bestFor')}</strong> {t('altsHumata.alt2BestFor')}
        </p>
      </EdSection>

      {/* #3 AskYourPDF */}
      <EdSection num="03" title={t('altsHumata.alt3Title')}>
        <EdProse>
          <p>{t('altsHumata.alt3Desc1')}</p>
          <p>{t('altsHumata.alt3Desc2')}</p>
        </EdProse>
        <p className="ed-body" style={{ marginTop: '16px' }}>
          <strong>{t('altsHumata.bestFor')}</strong> {t('altsHumata.alt3BestFor')}
        </p>
      </EdSection>

      {/* #4 NotebookLM */}
      <EdSection alt num="04" title={t('altsHumata.alt4Title')}>
        <EdProse>
          <p>{t('altsHumata.alt4Desc1')}</p>
          <p>{t('altsHumata.alt4Desc2')}</p>
        </EdProse>
        <p className="ed-body" style={{ marginTop: '16px' }}>
          <strong>{t('altsHumata.bestFor')}</strong> {t('altsHumata.alt4BestFor')}
        </p>
      </EdSection>

      {/* #5 PDF.ai */}
      <EdSection num="05" title={t('altsHumata.alt5Title')}>
        <EdProse>
          <p>{t('altsHumata.alt5Desc1')}</p>
          <p>{t('altsHumata.alt5Desc2')}</p>
        </EdProse>
        <p className="ed-body" style={{ marginTop: '16px' }}>
          <strong>{t('altsHumata.bestFor')}</strong> {t('altsHumata.alt5BestFor')}
        </p>
      </EdSection>

      <EdSection alt title={t('altsHumata.chooseTitle')}>
        <p className="ed-body">{t('altsHumata.chooseDescription')}</p>
        <div style={{ marginTop: '24px' }}>
          <EdChoiceList items={chooseItems} />
        </div>
        <p className="ed-body" style={{ marginTop: '24px' }}>
          <strong>{t('altsHumata.noteLabel')}</strong> {t('altsHumata.noteText')}
        </p>
      </EdSection>

      <EdSection title={t('altsHumata.faqTitle')}>
        <EdFaqList items={faqItems} />
      </EdSection>

      <EdSection alt>
        <EdRelatedLinks
          title={t('altsHumata.relatedPages')}
          links={[
            { href: href('/compare/humata'), label: t('altsHumata.linkVsHumata') },
            { href: href('/features/citations'), label: t('altsHumata.linkCitations') },
            { href: href('/features/multi-format'), label: t('altsHumata.linkMultiFormat') },
            { href: href('/demo'), label: t('altsHumata.linkFreeDemo') },
          ]}
        />
      </EdSection>

      <EdCtaBanner
        title={t('altsHumata.ctaTitle')}
        description={t('altsHumata.ctaDescription')}
        primary={{ label: t('altsHumata.ctaButton'), href: href('/demo') }}
      />
    
      <MarketingLocaleLinks path="/alternatives/humata" label={chrome.language} />
    </MarketingShell>
  );
}
