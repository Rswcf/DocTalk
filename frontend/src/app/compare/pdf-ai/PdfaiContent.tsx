
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

export default async function PdfaiContent({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);
  const chrome = await getChromeStrings(locale);
  const href = (p: string) => localizedHrefIfAvailable(locale, p);

  const features = [
    { name: t('comparePdfai.featureSupportedFormats'), doctalk: t('comparePdfai.featureSupportedFormatsDocTalk'), competitor: t('comparePdfai.featureSupportedFormatsCompetitor') },
    { name: t('comparePdfai.featureCitationHighlighting'), doctalk: true, competitor: false },
    { name: t('comparePdfai.featureInterfaceLanguages'), doctalk: t('comparePdfai.featureInterfaceLanguagesDocTalk'), competitor: t('comparePdfai.featureInterfaceLanguagesCompetitor') },
    { name: t('comparePdfai.featureNoSignupDemo'), doctalk: true, competitor: false },
    { name: t('comparePdfai.featureMultipleAIModes'), doctalk: t('comparePdfai.featureMultipleAIModesDocTalk'), competitor: t('comparePdfai.featureMultipleAIModesCompetitor') },
    { name: t('comparePdfai.featureFreeTier'), doctalk: t('comparePdfai.featureFreeTierDocTalk'), competitor: t('comparePdfai.featureFreeTierCompetitor') },
    { name: t('comparePdfai.featureWebUrlIngestion'), doctalk: true, competitor: false },
    { name: t('comparePdfai.featureDarkMode'), doctalk: true, competitor: false },
    { name: t('comparePdfai.featureDataEncryption'), doctalk: t('comparePdfai.featureDataEncryptionDocTalk'), competitor: t('comparePdfai.featureDataEncryptionCompetitor') },
    { name: t('comparePdfai.featureActiveDevelopment'), doctalk: t('comparePdfai.featureActiveDevelopmentDocTalk'), competitor: t('comparePdfai.featureActiveDevelopmentCompetitor') },
  ];

  const faqItems = [
    {
      question: t('comparePdfai.faq1Question'),
      answer: t('comparePdfai.faq1Answer'),
    },
    {
      question: t('comparePdfai.faq2Question'),
      answer: t('comparePdfai.faq2Answer'),
    },
    {
      question: t('comparePdfai.faq3Question'),
      answer: t('comparePdfai.faq3Answer'),
    },
    {
      question: t('comparePdfai.faq4Question'),
      answer: t('comparePdfai.faq4Answer'),
    },
  ];

  return (
    <MarketingShell
      chrome={chrome}
      breadcrumb={[
        { label: t('comparePdfai.breadcrumbHome'), href: href('/') },
        { label: t('comparePdfai.breadcrumbCompare'), href: href('/compare') },
        { label: t('comparePdfai.breadcrumbCurrent') },
      ]}
    >
      <EdPageHero
        title={t('comparePdfai.heroTitle')}
        lede={t('comparePdfai.heroDescription')}
        primaryCta={{ label: t('comparePdfai.linkFreeDemo'), href: href('/demo') }}
      />

      <EdSection title={t('comparePdfai.quickComparison')}>
        <EdComparisonTable features={features} competitorName="PDF.ai" />
      </EdSection>

      <EdSection alt title={t('comparePdfai.whatIsDocTalkTitle')}>
        <EdProse>
          <p>{t('comparePdfai.whatIsDocTalkDescription')}</p>
        </EdProse>
      </EdSection>

      <EdSection title={t('comparePdfai.whatIsPdfaiTitle')}>
        <EdProse>
          <p>
            <a href="https://pdf.ai" target="_blank" rel="noopener noreferrer">PDF.ai</a>{' '}
            {t('comparePdfai.whatIsPdfaiDescription')}
          </p>
        </EdProse>
      </EdSection>

      <EdSection alt title={t('comparePdfai.featureByFeatureTitle')}>
        <h3 className="ed-h3">{t('comparePdfai.documentFormatTitle')}</h3>
        <EdProse className="mt-3">
          <p>{t('comparePdfai.documentFormatCompetitor')}</p>
          <p>
            {t('comparePdfai.documentFormatDocTalk')}{' '}
            <Link href={href("/features/multi-format")}>
              {t('comparePdfai.multiFormatLink')}
            </Link>.
          </p>
        </EdProse>

        <h3 className="ed-h3" style={{ marginTop: '40px' }}>{t('comparePdfai.citationsTitle')}</h3>
        <EdProse className="mt-3">
          <p>{t('comparePdfai.citationsCompetitor')}</p>
          <p>
            {t('comparePdfai.citationsDocTalk')}{' '}
            <Link href={href("/features/citations")}>
              {t('comparePdfai.citationHighlightingLink')}
            </Link>.
          </p>
        </EdProse>

        <h3 className="ed-h3" style={{ marginTop: '40px' }}>{t('comparePdfai.languageSupportTitle')}</h3>
        <EdProse className="mt-3">
          <p>{t('comparePdfai.languageSupportCompetitor')}</p>
          <p>{t('comparePdfai.languageSupportDocTalk')}</p>
        </EdProse>

        <h3 className="ed-h3" style={{ marginTop: '40px' }}>{t('comparePdfai.pricingTitle')}</h3>
        <EdProse className="mt-3">
          <p>{t('comparePdfai.pricingCompetitor')}</p>
          <p>
            {t('comparePdfai.pricingDocTalkPart1')}{' '}
            <Link href={href("/demo")}>
              {t('comparePdfai.noSignupDemoLink')}
            </Link>. {t('comparePdfai.pricingDocTalkPart2')}{' '}
            <Link href={href("/pricing")}>
              {t('comparePdfai.fullPricingLink')}
            </Link>.
          </p>
        </EdProse>

        <h3 className="ed-h3" style={{ marginTop: '40px' }}>{t('comparePdfai.performanceTitle')}</h3>
        <EdProse className="mt-3">
          <p>{t('comparePdfai.performanceCompetitor')}</p>
          <p>{t('comparePdfai.performanceDocTalk')}</p>
        </EdProse>

        <h3 className="ed-h3" style={{ marginTop: '40px' }}>{t('comparePdfai.securityTitle')}</h3>
        <EdProse className="mt-3">
          <p>{t('comparePdfai.securityCompetitor')}</p>
          <p>{t('comparePdfai.securityDocTalk')}</p>
        </EdProse>
      </EdSection>

      <EdSection title={t('comparePdfai.whoDocTalkTitle')}>
        <EdProse>
          <ul>
            <li>{t('comparePdfai.whoDocTalk1')}</li>
            <li>{t('comparePdfai.whoDocTalk2')}</li>
            <li>{t('comparePdfai.whoDocTalk3')}</li>
            <li>{t('comparePdfai.whoDocTalk4')}</li>
            <li>{t('comparePdfai.whoDocTalk5')}</li>
          </ul>
        </EdProse>
      </EdSection>

      <EdSection alt title={t('comparePdfai.whoPdfaiTitle')}>
        <EdProse>
          <ul>
            <li>{t('comparePdfai.whoPdfai1')}</li>
            <li>{t('comparePdfai.whoPdfai2')}</li>
            <li>{t('comparePdfai.whoPdfai3')}</li>
          </ul>
        </EdProse>
      </EdSection>

      <EdSection title={t('comparePdfai.verdictTitle')}>
        <EdProse>
          <p>{t('comparePdfai.verdictParagraph1')}</p>
          <p>{t('comparePdfai.verdictParagraph2')}</p>
          <p>
            {t('comparePdfai.verdictParagraph3')}{' '}
            <Link href={href("/demo")}>
              {t('comparePdfai.tryFreeDemoLink')}
            </Link>{' '}
            {t('comparePdfai.verdictParagraph3End')}
          </p>
        </EdProse>
      </EdSection>

      <EdSection alt title={t('comparePdfai.faqTitle')}>
        <EdFaqList items={faqItems} />
      </EdSection>

      <EdSection>
        <EdRelatedLinks
          title={t('comparePdfai.relatedPages')}
          links={[
            { href: href('/features/citations'), label: t('comparePdfai.linkCitationHighlighting') },
            { href: href('/features/multi-format'), label: t('comparePdfai.linkMultiFormat') },
            { href: href('/demo'), label: t('comparePdfai.linkFreeDemo') },
            { href: href('/pricing'), label: t('comparePdfai.linkPricing') },
          ]}
        />
      </EdSection>

      <EdCtaBanner
        title={t('comparePdfai.ctaTitle')}
        description={t('comparePdfai.ctaDescription')}
        primary={{ label: t('comparePdfai.ctaButton'), href: href('/demo') }}
      />
    
      <MarketingLocaleLinks path="/compare/pdf-ai" label={chrome.language} />
    </MarketingShell>
  );
}
