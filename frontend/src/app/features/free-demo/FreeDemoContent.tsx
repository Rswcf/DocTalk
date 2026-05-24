
import React from 'react';
import { getServerT } from '../../../i18n/server';
import { getChromeStrings } from '../../../i18n/chrome';
import { localizedHrefIfAvailable } from '../../../i18n/routing';
import MarketingLocaleLinks from '../../../components/marketing/MarketingLocaleLinks';
import {
  PlayCircle,
  FileText,
  MessageSquare,
  Quote,
} from 'lucide-react';
import MarketingShell from '../../../components/marketing/MarketingShell';
import EdPageHero from '../../../components/marketing/EdPageHero';
import EdSection from '../../../components/marketing/EdSection';
import EdProse from '../../../components/marketing/EdProse';
import EdStepRow from '../../../components/marketing/EdStepRow';
import EdFeatureList from '../../../components/marketing/EdFeatureList';
import EdCardGrid from '../../../components/marketing/EdCardGrid';
import EdFaqList from '../../../components/marketing/EdFaqList';
import EdCtaBanner from '../../../components/marketing/EdCtaBanner';
import EdRelatedLinks from '../../../components/marketing/EdRelatedLinks';
import EdInlineCell from '../../../components/marketing/EdInlineCell';

export default async function FreeDemoContent({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);
  const chrome = await getChromeStrings(locale);
  const href = (p: string) => localizedHrefIfAvailable(locale, p);

  const demoDocs = [
    {
      title: t('featuresDemo.docs.doc1.title'),
      description: t('featuresDemo.docs.doc1.description'),
    },
    {
      title: t('featuresDemo.docs.doc2.title'),
      description: t('featuresDemo.docs.doc2.description'),
    },
    {
      title: t('featuresDemo.docs.doc3.title'),
      description: t('featuresDemo.docs.doc3.description'),
    },
  ];

  const whatYouGet = [
    { label: t('featuresDemo.whatYouGet.item1.label'), description: t('featuresDemo.whatYouGet.item1.description') },
    { label: t('featuresDemo.whatYouGet.item2.label'), description: t('featuresDemo.whatYouGet.item2.description') },
    { label: t('featuresDemo.whatYouGet.item3.label'), description: t('featuresDemo.whatYouGet.item3.description') },
    { label: t('featuresDemo.whatYouGet.item4.label'), description: t('featuresDemo.whatYouGet.item4.description') },
  ];

  const comparisonRows = [
    { feature: t('featuresDemo.compare.monthlyCredits'), demo: t('featuresDemo.compare.fiveMsgs'), free: '300', plus: '3,000', pro: '9,000' },
    { feature: t('featuresDemo.compare.uploadOwn'), demo: false, free: true, plus: true, pro: true },
    { feature: t('featuresDemo.compare.citationHighlighting'), demo: true, free: true, plus: true, pro: true },
    { feature: t('featuresDemo.compare.quickBalanced'), demo: t('featuresDemo.compare.quickOnly'), free: true, plus: true, pro: true },
    { feature: t('featuresDemo.compare.thoroughMode'), demo: false, free: false, plus: true, pro: true },
    { feature: t('featuresDemo.compare.export'), demo: false, free: false, plus: true, pro: true },
    { feature: t('featuresDemo.compare.customInstructions'), demo: false, free: false, plus: false, pro: true },
    { feature: t('featuresDemo.compare.signupRequired'), demo: false, free: true, plus: true, pro: true },
  ];

  const steps = [
    {
      step: '1',
      icon: PlayCircle,
      title: t('featuresDemo.steps.step1.title'),
      description: t('featuresDemo.steps.step1.description'),
    },
    {
      step: '2',
      icon: FileText,
      title: t('featuresDemo.steps.step2.title'),
      description: t('featuresDemo.steps.step2.description'),
    },
    {
      step: '3',
      icon: MessageSquare,
      title: t('featuresDemo.steps.step3.title'),
      description: t('featuresDemo.steps.step3.description'),
    },
    {
      step: '4',
      icon: Quote,
      title: t('featuresDemo.steps.step4.title'),
      description: t('featuresDemo.steps.step4.description'),
    },
  ];

  const faqItems = [
    {
      q: t('featuresDemo.faq.q1'),
      a: t('featuresDemo.faq.a1'),
    },
    {
      q: t('featuresDemo.faq.q2'),
      a: t('featuresDemo.faq.a2'),
    },
    {
      q: t('featuresDemo.faq.q3'),
      a: t('featuresDemo.faq.a3'),
    },
    {
      q: t('featuresDemo.faq.q4'),
      a: t('featuresDemo.faq.a4'),
    },
    {
      q: t('featuresDemo.faq.q5'),
      a: t('featuresDemo.faq.a5'),
    },
  ];

  const headStyle: React.CSSProperties = {
    padding: '14px 18px',
    textAlign: 'center',
  };
  const cellStyle: React.CSSProperties = {
    padding: '13px 18px',
    textAlign: 'center',
  };

  return (
    <MarketingShell
      chrome={chrome}
      breadcrumb={[
        { label: t('useCasesHub.breadcrumb.home'), href: href('/') },
        { label: t('footer.links.features'), href: href('/features') },
        { label: t('featuresDemo.hero.title') },
      ]}
    >
      <EdPageHero
        eyebrow={t('featuresDemo.badge')}
        title={t('featuresDemo.hero.title')}
        lede={t('featuresDemo.hero.subtitle')}
        primaryCta={{ label: t('featuresDemo.hero.cta'), href: href('/demo') }}
      />

      <EdSection title={t('featuresDemo.instant.title')}>
        <p className="ed-lede">{t('featuresDemo.instant.subtitle')}</p>
        <div style={{ marginTop: '32px' }}>
          <EdCardGrid
            columns={3}
            items={demoDocs.map((doc) => ({
              title: doc.title,
              body: doc.description,
              icon: FileText,
            }))}
          />
        </div>
      </EdSection>

      <EdSection alt title={t('featuresDemo.whatYouGet.title')}>
        <EdFeatureList
          items={whatYouGet.map((item) => ({ title: item.label, body: item.description }))}
        />
      </EdSection>

      <EdSection title={t('featuresDemo.compare.title')}>
        <p className="ed-lede">{t('featuresDemo.compare.subtitle')}</p>
        <div style={{ overflowX: 'auto', marginTop: '32px' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              minWidth: '600px',
              border: '1px solid var(--ed-rule)',
            }}
          >
            <thead>
              <tr style={{ borderBottom: '1px solid var(--ed-rule)' }}>
                <th scope="col" className="ed-label" style={{ ...headStyle, textAlign: 'left' }}>
                  {t('featuresDemo.compare.featureCol')}
                </th>
                <th scope="col" className="ed-label" style={headStyle}>
                  {t('featuresDemo.compare.demoCol')}
                </th>
                <th
                  scope="col"
                  className="ed-label"
                  style={{ ...headStyle, background: 'var(--ed-paper-2)', color: 'var(--ed-signal)' }}
                >
                  {t('featuresDemo.compare.freeCol')}
                </th>
                <th scope="col" className="ed-label" style={headStyle}>
                  {t('featuresDemo.compare.plusCol')}
                </th>
                <th scope="col" className="ed-label" style={headStyle}>
                  {t('featuresDemo.compare.proCol')}
                </th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--ed-rule)' }}>
                  <th
                    scope="row"
                    className="ed-body"
                    style={{ padding: '13px 18px', fontWeight: 500, color: 'var(--ed-ink)', textAlign: 'left' }}
                  >
                    {row.feature}
                  </th>
                  <td style={cellStyle}>
                    <EdInlineCell value={row.demo} />
                  </td>
                  <td style={{ ...cellStyle, background: 'var(--ed-paper-2)' }}>
                    <EdInlineCell value={row.free} />
                  </td>
                  <td style={cellStyle}>
                    <EdInlineCell value={row.plus} />
                  </td>
                  <td style={cellStyle}>
                    <EdInlineCell value={row.pro} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </EdSection>

      <EdSection alt title={t('featuresDemo.steps.title')}>
        <EdStepRow
          steps={steps.map((s) => ({ title: s.title, body: s.description, icon: s.icon }))}
        />
      </EdSection>

      <EdSection title={t('featuresDemo.faq.title')}>
        <EdFaqList items={faqItems.map((f) => ({ question: f.q, answer: f.a }))} />
      </EdSection>

      <EdSection alt>
        <EdRelatedLinks
          links={[
            { href: href('/pricing'), label: t('featuresDemo.cta.linkPricing') },
            { href: href('/features/citations'), label: t('featuresDemo.cta.linkCitations') },
            { href: href('/features/multi-format'), label: t('featuresDemo.cta.linkMultiFormat') },
          ]}
        />
      </EdSection>

      <EdCtaBanner
        title={t('featuresDemo.cta.title')}
        description={t('featuresDemo.cta.subtitle')}
        primary={{ label: t('featuresDemo.cta.button'), href: href('/demo') }}
      />
    
      <MarketingLocaleLinks path="/features/free-demo" label={chrome.language} />
    </MarketingShell>
  );
}
