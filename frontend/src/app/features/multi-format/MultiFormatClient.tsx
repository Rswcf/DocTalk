"use client";

import React from 'react';
import { useLocale } from '../../../i18n';
import {
  FileText,
  FileSpreadsheet,
  Presentation,
  FileType,
  Globe,
  Code2,
  Upload,
  MessageSquare,
  Zap,
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

export default function MultiFormatClient() {
  const { t } = useLocale();

  const formats = [
    {
      icon: FileText,
      name: t('featuresMultiFormat.formatPdfName'),
      ext: t('featuresMultiFormat.formatPdfExt'),
      description: t('featuresMultiFormat.formatPdfDesc'),
    },
    {
      icon: FileType,
      name: t('featuresMultiFormat.formatDocxName'),
      ext: t('featuresMultiFormat.formatDocxExt'),
      description: t('featuresMultiFormat.formatDocxDesc'),
    },
    {
      icon: Presentation,
      name: t('featuresMultiFormat.formatPptxName'),
      ext: t('featuresMultiFormat.formatPptxExt'),
      description: t('featuresMultiFormat.formatPptxDesc'),
    },
    {
      icon: FileSpreadsheet,
      name: t('featuresMultiFormat.formatXlsxName'),
      ext: t('featuresMultiFormat.formatXlsxExt'),
      description: t('featuresMultiFormat.formatXlsxDesc'),
    },
    {
      icon: Code2,
      name: t('featuresMultiFormat.formatTxtName'),
      ext: t('featuresMultiFormat.formatTxtExt'),
      description: t('featuresMultiFormat.formatTxtDesc'),
    },
    {
      icon: Globe,
      name: t('featuresMultiFormat.formatUrlName'),
      ext: t('featuresMultiFormat.formatUrlExt'),
      description: t('featuresMultiFormat.formatUrlDesc'),
    },
  ];

  const howSteps = [
    {
      step: '1',
      icon: Upload,
      title: t('featuresMultiFormat.howStep1Title'),
      description: t('featuresMultiFormat.howStep1Desc'),
    },
    {
      step: '2',
      icon: Zap,
      title: t('featuresMultiFormat.howStep2Title'),
      description: t('featuresMultiFormat.howStep2Desc'),
    },
    {
      step: '3',
      icon: MessageSquare,
      title: t('featuresMultiFormat.howStep3Title'),
      description: t('featuresMultiFormat.howStep3Desc'),
    },
  ];

  const formatDetails = [
    { format: t('featuresMultiFormat.detailPdfFormat'), detail: t('featuresMultiFormat.detailPdfText') },
    { format: t('featuresMultiFormat.detailDocxFormat'), detail: t('featuresMultiFormat.detailDocxText') },
    { format: t('featuresMultiFormat.detailPptxFormat'), detail: t('featuresMultiFormat.detailPptxText') },
    { format: t('featuresMultiFormat.detailXlsxFormat'), detail: t('featuresMultiFormat.detailXlsxText') },
    { format: t('featuresMultiFormat.detailTxtFormat'), detail: t('featuresMultiFormat.detailTxtText') },
    { format: t('featuresMultiFormat.detailUrlFormat'), detail: t('featuresMultiFormat.detailUrlText') },
  ];

  const comparisonRows = [
    { format: t('featuresMultiFormat.compPdf'), doctalk: true, chatpdf: true, askyourpdf: true, notebooklm: true },
    { format: t('featuresMultiFormat.compDocx'), doctalk: true, chatpdf: false, askyourpdf: false, notebooklm: false },
    { format: t('featuresMultiFormat.compPptx'), doctalk: true, chatpdf: false, askyourpdf: false, notebooklm: false },
    { format: t('featuresMultiFormat.compXlsx'), doctalk: true, chatpdf: false, askyourpdf: false, notebooklm: false },
    { format: t('featuresMultiFormat.compTxtMd'), doctalk: true, chatpdf: false, askyourpdf: false, notebooklm: true },
    { format: t('featuresMultiFormat.compUrl'), doctalk: true, chatpdf: false, askyourpdf: false, notebooklm: true },
    { format: t('featuresMultiFormat.compCitationHighlight'), doctalk: true, chatpdf: false, askyourpdf: false, notebooklm: false },
  ];

  const faqItems = [
    { q: t('featuresMultiFormat.faq1Q'), a: t('featuresMultiFormat.faq1A') },
    { q: t('featuresMultiFormat.faq2Q'), a: t('featuresMultiFormat.faq2A') },
    { q: t('featuresMultiFormat.faq3Q'), a: t('featuresMultiFormat.faq3A') },
    { q: t('featuresMultiFormat.faq4Q'), a: t('featuresMultiFormat.faq4A') },
    { q: t('featuresMultiFormat.faq5Q'), a: t('featuresMultiFormat.faq5A') },
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
      breadcrumb={[
        { label: t('useCasesHub.breadcrumb.home'), href: '/' },
        { label: t('footer.links.features'), href: '/features' },
        { label: t('featuresMultiFormat.heroTitle') },
      ]}
    >
      <EdPageHero
        eyebrow={t('featuresMultiFormat.heroBadge')}
        title={t('featuresMultiFormat.heroTitle')}
        lede={t('featuresMultiFormat.heroSubtitle')}
        primaryCta={{ label: t('featuresMultiFormat.heroCta'), href: '/demo' }}
      />

      <EdSection title={t('featuresMultiFormat.formatsTitle')}>
        <p className="ed-lede">{t('featuresMultiFormat.formatsSubtitle')}</p>
        <div style={{ marginTop: '32px' }}>
          <EdCardGrid
            columns={3}
            items={formats.map((f) => ({
              label: f.ext,
              title: f.name,
              body: f.description,
              icon: f.icon,
            }))}
          />
        </div>
      </EdSection>

      <EdSection alt title={t('featuresMultiFormat.whyTitle')}>
        <EdProse>
          <p>{t('featuresMultiFormat.whyPara1')}</p>
          <p>{t('featuresMultiFormat.whyPara2')}</p>
          <p>{t('featuresMultiFormat.whyPara3')}</p>
        </EdProse>
      </EdSection>

      <EdSection title={t('featuresMultiFormat.howTitle')}>
        <EdStepRow
          steps={howSteps.map((s) => ({ title: s.title, body: s.description, icon: s.icon }))}
        />
      </EdSection>

      <EdSection alt title={t('featuresMultiFormat.detailsTitle')}>
        <EdFeatureList
          items={formatDetails.map((d) => ({ title: d.format, body: d.detail }))}
        />
      </EdSection>

      <EdSection title={t('featuresMultiFormat.compTitle')}>
        <p className="ed-lede">{t('featuresMultiFormat.compSubtitle')}</p>
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
                  {t('featuresMultiFormat.compHeaderFormat')}
                </th>
                <th
                  scope="col"
                  className="ed-label"
                  style={{ ...headStyle, background: 'var(--ed-paper-2)', color: 'var(--ed-signal)' }}
                >
                  {t('featuresMultiFormat.compHeaderDocTalk')}
                </th>
                <th scope="col" className="ed-label" style={headStyle}>
                  {t('featuresMultiFormat.compHeaderChatPDF')}
                </th>
                <th scope="col" className="ed-label" style={headStyle}>
                  {t('featuresMultiFormat.compHeaderAskYourPDF')}
                </th>
                <th scope="col" className="ed-label" style={headStyle}>
                  {t('featuresMultiFormat.compHeaderNotebookLM')}
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
                    {row.format}
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
        <p className="ed-caption" style={{ marginTop: '16px' }}>
          {t('featuresMultiFormat.compDisclaimer')}
        </p>
      </EdSection>

      <EdSection alt title={t('featuresMultiFormat.faqTitle')}>
        <EdFaqList items={faqItems.map((f) => ({ question: f.q, answer: f.a }))} />
      </EdSection>

      <EdSection>
        <EdRelatedLinks
          links={[
            { href: '/features/citations', label: t('featuresMultiFormat.linkCitations') },
            { href: '/compare/chatpdf', label: t('featuresMultiFormat.linkVsChatPDF') },
            { href: '/features/multilingual', label: t('featuresMultiFormat.linkMultilingual') },
          ]}
        />
      </EdSection>

      <EdCtaBanner
        title={t('featuresMultiFormat.ctaTitle')}
        description={t('featuresMultiFormat.ctaSubtitle')}
        primary={{ label: t('featuresMultiFormat.ctaDemoButton'), href: '/demo' }}
        secondary={{ label: t('featuresMultiFormat.ctaPricingButton'), href: '/pricing' }}
      />
    </MarketingShell>
  );
}
