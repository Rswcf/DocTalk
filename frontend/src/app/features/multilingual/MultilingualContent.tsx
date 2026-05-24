
import React from 'react';
import { getServerT } from '../../../i18n/server';
import { getChromeStrings } from '../../../i18n/chrome';
import { localizedHrefIfAvailable } from '../../../i18n/routing';
import MarketingLocaleLinks from '../../../components/marketing/MarketingLocaleLinks';
import MarketingShell from '../../../components/marketing/MarketingShell';
import EdPageHero from '../../../components/marketing/EdPageHero';
import EdSection from '../../../components/marketing/EdSection';
import EdProse from '../../../components/marketing/EdProse';
import EdCardGrid from '../../../components/marketing/EdCardGrid';
import EdFaqList from '../../../components/marketing/EdFaqList';
import EdCtaBanner from '../../../components/marketing/EdCtaBanner';
import EdRelatedLinks from '../../../components/marketing/EdRelatedLinks';
import EdInlineCell from '../../../components/marketing/EdInlineCell';

const languageData = [
  { flag: '\u{1F1FA}\u{1F1F8}', native: 'English', englishKey: 'featuresMultilingual.lang.english', code: 'en' },
  { flag: '\u{1F1E8}\u{1F1F3}', native: '中文', englishKey: 'featuresMultilingual.lang.chinese', code: 'zh' },
  { flag: '\u{1F1EF}\u{1F1F5}', native: '日本語', englishKey: 'featuresMultilingual.lang.japanese', code: 'ja' },
  { flag: '\u{1F1EA}\u{1F1F8}', native: 'Español', englishKey: 'featuresMultilingual.lang.spanish', code: 'es' },
  { flag: '\u{1F1E9}\u{1F1EA}', native: 'Deutsch', englishKey: 'featuresMultilingual.lang.german', code: 'de' },
  { flag: '\u{1F1EB}\u{1F1F7}', native: 'Français', englishKey: 'featuresMultilingual.lang.french', code: 'fr' },
  { flag: '\u{1F1F0}\u{1F1F7}', native: '한국어', englishKey: 'featuresMultilingual.lang.korean', code: 'ko' },
  { flag: '\u{1F1E7}\u{1F1F7}', native: 'Português', englishKey: 'featuresMultilingual.lang.portuguese', code: 'pt' },
  { flag: '\u{1F1EE}\u{1F1F9}', native: 'Italiano', englishKey: 'featuresMultilingual.lang.italian', code: 'it' },
  { flag: '\u{1F1F8}\u{1F1E6}', native: 'العربية', englishKey: 'featuresMultilingual.lang.arabic', code: 'ar' },
  { flag: '\u{1F1EE}\u{1F1F3}', native: 'हिन्दी', englishKey: 'featuresMultilingual.lang.hindi', code: 'hi' },
];

export default async function MultilingualContent({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);
  const chrome = await getChromeStrings(locale);
  const href = (p: string) => localizedHrefIfAvailable(locale, p);

  const crossLanguageItems = [
    {
      from: t('featuresMultilingual.cross.item1.from'),
      to: t('featuresMultilingual.cross.item1.to'),
      example: t('featuresMultilingual.cross.item1.example'),
    },
    {
      from: t('featuresMultilingual.cross.item2.from'),
      to: t('featuresMultilingual.cross.item2.to'),
      example: t('featuresMultilingual.cross.item2.example'),
    },
    {
      from: t('featuresMultilingual.cross.item3.from'),
      to: t('featuresMultilingual.cross.item3.to'),
      example: t('featuresMultilingual.cross.item3.example'),
    },
    {
      from: t('featuresMultilingual.cross.item4.from'),
      to: t('featuresMultilingual.cross.item4.to'),
      example: t('featuresMultilingual.cross.item4.example'),
    },
  ];

  const comparisonRows = [
    { feature: t('featuresMultilingual.compare.interfaceLangs'), doctalk: t('featuresMultilingual.compare.eleven'), chatpdf: t('featuresMultilingual.compare.englishOnly'), askyourpdf: t('featuresMultilingual.compare.englishOnly'), notebooklm: t('featuresMultilingual.compare.englishOnly') },
    { feature: t('featuresMultilingual.compare.aiChatLangs'), doctalk: t('featuresMultilingual.compare.elevenPlus'), chatpdf: t('featuresMultilingual.compare.limited'), askyourpdf: t('featuresMultilingual.compare.limited'), notebooklm: t('featuresMultilingual.compare.limited') },
    { feature: t('featuresMultilingual.compare.crossLangQueries'), doctalk: true, chatpdf: false, askyourpdf: false, notebooklm: false },
    { feature: t('featuresMultilingual.compare.cjkRendering'), doctalk: true, chatpdf: true, askyourpdf: false, notebooklm: false },
    { feature: t('featuresMultilingual.compare.rtlSupport'), doctalk: true, chatpdf: false, askyourpdf: false, notebooklm: false },
  ];

  const faqItems = [
    {
      q: t('featuresMultilingual.faq.q1'),
      a: t('featuresMultilingual.faq.a1'),
    },
    {
      q: t('featuresMultilingual.faq.q2'),
      a: t('featuresMultilingual.faq.a2'),
    },
    {
      q: t('featuresMultilingual.faq.q3'),
      a: t('featuresMultilingual.faq.a3'),
    },
    {
      q: t('featuresMultilingual.faq.q4'),
      a: t('featuresMultilingual.faq.a4'),
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
        { label: t('featuresMultilingual.hero.title') },
      ]}
    >
      <EdPageHero
        eyebrow={t('featuresMultilingual.badge')}
        title={t('featuresMultilingual.hero.title')}
        lede={t('featuresMultilingual.hero.subtitle')}
        primaryCta={{ label: t('featuresMultilingual.hero.cta'), href: href('/demo') }}
      />

      <EdSection title={t('featuresMultilingual.supported.title')}>
        <p className="ed-lede">{t('featuresMultilingual.supported.subtitle')}</p>
        <div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
          style={{ gap: '16px', marginTop: '32px' }}
        >
          {languageData.map((lang) => (
            <div key={lang.code} className="ed-card" style={{ textAlign: 'center' }}>
              <span
                role="img"
                aria-label={t(lang.englishKey) + ' flag'}
                style={{ fontSize: '24px', display: 'block', marginBottom: '8px' }}
              >
                {lang.flag}
              </span>
              <h3 className="ed-h3">{lang.native}</h3>
              <p className="ed-caption" style={{ marginTop: '4px' }}>
                {t(lang.englishKey)}
              </p>
            </div>
          ))}
        </div>
      </EdSection>

      <EdSection alt title={t('featuresMultilingual.howItWorks.title')}>
        <EdProse>
          <p>{t('featuresMultilingual.howItWorks.p1')}</p>
          <p>{t('featuresMultilingual.howItWorks.p2')}</p>
          <p>{t('featuresMultilingual.howItWorks.p3')}</p>
        </EdProse>
      </EdSection>

      <EdSection title={t('featuresMultilingual.cross.title')}>
        <p className="ed-lede">{t('featuresMultilingual.cross.subtitle')}</p>
        <div style={{ marginTop: '32px' }}>
          <EdCardGrid
            columns={2}
            items={crossLanguageItems.map((item) => ({
              label: `${item.from} → ${item.to}`,
              title: item.example,
            }))}
          />
        </div>
      </EdSection>

      <EdSection alt title={t('featuresMultilingual.compare.title')}>
        <p className="ed-lede">{t('featuresMultilingual.compare.subtitle')}</p>
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
                  {t('featuresMultilingual.compare.featureCol')}
                </th>
                <th
                  scope="col"
                  className="ed-label"
                  style={{ ...headStyle, background: 'var(--ed-paper-2)', color: 'var(--ed-signal)' }}
                >
                  DocTalk
                </th>
                <th scope="col" className="ed-label" style={headStyle}>
                  ChatPDF
                </th>
                <th scope="col" className="ed-label" style={headStyle}>
                  AskYourPDF
                </th>
                <th scope="col" className="ed-label" style={headStyle}>
                  NotebookLM
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
                  <td style={{ ...cellStyle, background: 'var(--ed-paper-2)' }}>
                    <EdInlineCell value={row.doctalk} />
                  </td>
                  <td style={cellStyle}>
                    <EdInlineCell value={row.chatpdf} />
                  </td>
                  <td style={cellStyle}>
                    <EdInlineCell value={row.askyourpdf} />
                  </td>
                  <td style={cellStyle}>
                    <EdInlineCell value={row.notebooklm} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </EdSection>

      <EdSection title={t('featuresMultilingual.cjk.title')}>
        <EdProse>
          <p>{t('featuresMultilingual.cjk.p1')}</p>
          <p>{t('featuresMultilingual.cjk.p2')}</p>
          <p>{t('featuresMultilingual.cjk.p3')}</p>
        </EdProse>
      </EdSection>

      <EdSection alt title={t('featuresMultilingual.faq.title')}>
        <EdFaqList items={faqItems.map((f) => ({ question: f.q, answer: f.a }))} />
      </EdSection>

      <EdSection>
        <EdRelatedLinks
          links={[
            { href: href('/features/multi-format'), label: t('featuresMultilingual.cta.linkMultiFormat') },
            { href: href('/compare/chatpdf'), label: t('featuresMultilingual.cta.linkVsChatPDF') },
            { href: href('/compare/notebooklm'), label: t('featuresMultilingual.cta.linkVsNotebookLM') },
          ]}
        />
      </EdSection>

      <EdCtaBanner
        title={t('featuresMultilingual.cta.title')}
        description={t('featuresMultilingual.cta.subtitle')}
        primary={{ label: t('featuresMultilingual.cta.button'), href: href('/demo') }}
      />
    
      <MarketingLocaleLinks path="/features/multilingual" label={chrome.language} />
    </MarketingShell>
  );
}
