
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

export default async function AskyourpdfContent({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);
  const chrome = await getChromeStrings(locale);
  const href = (p: string) => localizedHrefIfAvailable(locale, p);

  const features = [
    { name: t('compareAskyourpdf.featureSupportedFormats'), doctalk: t('compareAskyourpdf.featureSupportedFormatsDocTalk'), competitor: t('compareAskyourpdf.featureSupportedFormatsCompetitor') },
    { name: t('compareAskyourpdf.featureCitationHighlighting'), doctalk: true, competitor: false },
    { name: t('compareAskyourpdf.featureChromeExtension'), doctalk: false, competitor: true },
    { name: t('compareAskyourpdf.featureZoteroPlugin'), doctalk: false, competitor: true },
    { name: t('compareAskyourpdf.featureApiAccess'), doctalk: false, competitor: true },
    { name: t('compareAskyourpdf.featureInterfaceLanguages'), doctalk: t('compareAskyourpdf.featureInterfaceLanguagesDocTalk'), competitor: t('compareAskyourpdf.featureInterfaceLanguagesCompetitor') },
    { name: t('compareAskyourpdf.featureNoSignupDemo'), doctalk: true, competitor: false },
    { name: t('compareAskyourpdf.featureMultipleAIModes'), doctalk: t('compareAskyourpdf.featureMultipleAIModesDocTalk'), competitor: t('compareAskyourpdf.featureMultipleAIModesCompetitor') },
    { name: t('compareAskyourpdf.featureFreeTier'), doctalk: t('compareAskyourpdf.featureFreeTierDocTalk'), competitor: t('compareAskyourpdf.featureFreeTierCompetitor') },
    { name: t('compareAskyourpdf.featureDarkMode'), doctalk: true, competitor: false },
  ];

  const faqItems = [
    {
      question: t('compareAskyourpdf.faq1Question'),
      answer: t('compareAskyourpdf.faq1Answer'),
    },
    {
      question: t('compareAskyourpdf.faq2Question'),
      answer: t('compareAskyourpdf.faq2Answer'),
    },
    {
      question: t('compareAskyourpdf.faq3Question'),
      answer: t('compareAskyourpdf.faq3Answer'),
    },
    {
      question: t('compareAskyourpdf.faq4Question'),
      answer: t('compareAskyourpdf.faq4Answer'),
    },
  ];

  return (
    <MarketingShell
      chrome={chrome}
      breadcrumb={[
        { label: t('compareAskyourpdf.breadcrumbHome'), href: href('/') },
        { label: t('compareAskyourpdf.breadcrumbCompare'), href: href('/compare') },
        { label: t('compareAskyourpdf.breadcrumbCurrent') },
      ]}
    >
      <EdPageHero
        title={t('compareAskyourpdf.heroTitle')}
        lede={t('compareAskyourpdf.heroDescription')}
        primaryCta={{ label: t('compareAskyourpdf.linkFreeDemo'), href: href('/demo') }}
      />

      <EdSection title={t('compareAskyourpdf.quickComparison')}>
        <EdComparisonTable features={features} competitorName="AskYourPDF" />
      </EdSection>

      <EdSection alt title={t('compareAskyourpdf.whatIsDocTalkTitle')}>
        <EdProse>
          <p>
            {t('compareAskyourpdf.whatIsDocTalkDescription')}{' '}
            It is built on a <a href="https://arxiv.org/abs/2005.11401" target="_blank" rel="noopener noreferrer">RAG architecture</a> for grounded, cited answers.
          </p>
        </EdProse>
      </EdSection>

      <EdSection title={t('compareAskyourpdf.whatIsAskyourpdfTitle')}>
        <EdProse>
          <p>
            <a href="https://askyourpdf.com" target="_blank" rel="noopener noreferrer">AskYourPDF</a>{' '}
            {t('compareAskyourpdf.whatIsAskyourpdfDescription')}
          </p>
        </EdProse>
      </EdSection>

      <EdSection alt title={t('compareAskyourpdf.featureByFeatureTitle')}>
        <h3 className="ed-h3">{t('compareAskyourpdf.documentFormatTitle')}</h3>
        <EdProse className="mt-3">
          <p>{t('compareAskyourpdf.documentFormatCompetitor')}</p>
          <p>
            {t('compareAskyourpdf.documentFormatDocTalk')}{' '}
            <Link href={href("/features/multi-format")}>
              {t('compareAskyourpdf.multiFormatLink')}
            </Link>{' '}
            {t('compareAskyourpdf.forDetails')}
          </p>
        </EdProse>

        <h3 className="ed-h3" style={{ marginTop: '40px' }}>{t('compareAskyourpdf.citationsTitle')}</h3>
        <EdProse className="mt-3">
          <p>{t('compareAskyourpdf.citationsCompetitor')}</p>
          <p>
            {t('compareAskyourpdf.citationsDocTalk')}{' '}
            <Link href={href("/features/citations")}>
              {t('compareAskyourpdf.citationHighlightingLink')}
            </Link>.
          </p>
        </EdProse>

        <h3 className="ed-h3" style={{ marginTop: '40px' }}>{t('compareAskyourpdf.languageSupportTitle')}</h3>
        <EdProse className="mt-3">
          <p>{t('compareAskyourpdf.languageSupportCompetitor')}</p>
          <p>{t('compareAskyourpdf.languageSupportDocTalk')}</p>
        </EdProse>

        <h3 className="ed-h3" style={{ marginTop: '40px' }}>{t('compareAskyourpdf.pricingTitle')}</h3>
        <EdProse className="mt-3">
          <p>{t('compareAskyourpdf.pricingCompetitor')}</p>
          <p>
            {t('compareAskyourpdf.pricingDocTalkPart1')}{' '}
            <Link href={href("/demo")}>{t('compareAskyourpdf.noSignupDemoLink')}</Link>{' '}
            {t('compareAskyourpdf.pricingDocTalkPart2')}{' '}
            <Link href={href("/pricing")}>
              {t('compareAskyourpdf.fullPricingLink')}
            </Link>.
          </p>
        </EdProse>

        <h3 className="ed-h3" style={{ marginTop: '40px' }}>{t('compareAskyourpdf.performanceTitle')}</h3>
        <EdProse className="mt-3">
          <p>{t('compareAskyourpdf.performanceCompetitor')}</p>
          <p>{t('compareAskyourpdf.performanceDocTalk')}</p>
        </EdProse>

        <h3 className="ed-h3" style={{ marginTop: '40px' }}>{t('compareAskyourpdf.securityTitle')}</h3>
        <EdProse className="mt-3">
          <p>{t('compareAskyourpdf.securityCompetitor')}</p>
          <p>{t('compareAskyourpdf.securityDocTalk')}</p>
        </EdProse>
      </EdSection>

      <EdSection title={t('compareAskyourpdf.whoDocTalkTitle')}>
        <EdProse>
          <ul>
            <li>{t('compareAskyourpdf.whoDocTalk1')}</li>
            <li>{t('compareAskyourpdf.whoDocTalk2')}</li>
            <li>{t('compareAskyourpdf.whoDocTalk3')}</li>
            <li>{t('compareAskyourpdf.whoDocTalk4')}</li>
            <li>{t('compareAskyourpdf.whoDocTalk5')}</li>
          </ul>
        </EdProse>
      </EdSection>

      <EdSection alt title={t('compareAskyourpdf.whoAskyourpdfTitle')}>
        <EdProse>
          <ul>
            <li>{t('compareAskyourpdf.whoAskyourpdf1')}</li>
            <li>{t('compareAskyourpdf.whoAskyourpdf2')}</li>
            <li>{t('compareAskyourpdf.whoAskyourpdf3')}</li>
            <li>{t('compareAskyourpdf.whoAskyourpdf4')}</li>
          </ul>
        </EdProse>
      </EdSection>

      <EdSection title={t('compareAskyourpdf.verdictTitle')}>
        <EdProse>
          <p>{t('compareAskyourpdf.verdictParagraph1')}</p>
          <p>{t('compareAskyourpdf.verdictParagraph2')}</p>
          <p>
            {t('compareAskyourpdf.verdictParagraph3')}{' '}
            <Link href={href("/demo")}>
              {t('compareAskyourpdf.tryDocTalkLink')}
            </Link>{' '}
            {t('compareAskyourpdf.verdictParagraph3Mid')}{' '}
            <Link href={href("/compare/chatpdf")}>
              {t('compareAskyourpdf.chatpdfComparisonLink')}
            </Link>{' '}
            {t('compareAskyourpdf.verdictParagraph3End')}
          </p>
        </EdProse>
      </EdSection>

      <EdSection alt title={t('compareAskyourpdf.faqTitle')}>
        <EdFaqList items={faqItems} />
      </EdSection>

      <EdSection>
        <EdRelatedLinks
          title={t('compareAskyourpdf.relatedPages')}
          links={[
            { href: href('/features/citations'), label: t('compareAskyourpdf.linkCitationHighlighting') },
            { href: href('/features/multi-format'), label: t('compareAskyourpdf.linkMultiFormat') },
            { href: href('/demo'), label: t('compareAskyourpdf.linkFreeDemo') },
            { href: href('/pricing'), label: t('compareAskyourpdf.linkPricing') },
            { href: href('/compare/chatpdf'), label: t('compareAskyourpdf.linkChatpdfComparison') },
          ]}
        />
      </EdSection>

      <EdCtaBanner
        title={t('compareAskyourpdf.ctaTitle')}
        description={t('compareAskyourpdf.ctaDescription')}
        primary={{ label: t('compareAskyourpdf.ctaButton'), href: href('/demo') }}
      />
    
      <MarketingLocaleLinks path="/compare/askyourpdf" label={chrome.language} />
    </MarketingShell>
  );
}
