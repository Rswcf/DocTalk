"use client";

import React from 'react';
import { useLocale } from '../../../i18n';
import {
  MousePointerClick,
  Search,
  FileText,
  Scale,
  BarChart3,
  GraduationCap,
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

export default function CitationsClient() {
  const { t } = useLocale();

  const howSteps = [
    {
      step: '1',
      icon: Search,
      title: t('featuresCitations.howStep1Title'),
      description: t('featuresCitations.howStep1Desc'),
    },
    {
      step: '2',
      icon: FileText,
      title: t('featuresCitations.howStep2Title'),
      description: t('featuresCitations.howStep2Desc'),
    },
    {
      step: '3',
      icon: MousePointerClick,
      title: t('featuresCitations.howStep3Title'),
      description: t('featuresCitations.howStep3Desc'),
    },
  ];

  const layers = [
    {
      icon: Search,
      title: t('featuresCitations.layer1Title'),
      description: t('featuresCitations.layer1Desc'),
    },
    {
      icon: FileText,
      title: t('featuresCitations.layer2Title'),
      description: t('featuresCitations.layer2Desc'),
    },
    {
      icon: MousePointerClick,
      title: t('featuresCitations.layer3Title'),
      description: t('featuresCitations.layer3Desc'),
    },
  ];

  const comparisonRows = [
    { feature: t('featuresCitations.compNumberedCitations'), doctalk: true, chatpdf: false, askyourpdf: false, humata: false },
    { feature: t('featuresCitations.compClickHighlight'), doctalk: true, chatpdf: false, askyourpdf: false, humata: false },
    { feature: t('featuresCitations.compPageAttribution'), doctalk: true, chatpdf: true, askyourpdf: 'partial' as const, humata: 'partial' as const },
    { feature: t('featuresCitations.compBboxHighlight'), doctalk: true, chatpdf: false, askyourpdf: false, humata: false },
    { feature: t('featuresCitations.compTextSnippet'), doctalk: true, chatpdf: false, askyourpdf: false, humata: false },
    { feature: t('featuresCitations.compMultiFormat'), doctalk: true, chatpdf: false, askyourpdf: false, humata: false },
  ];

  const useCases = [
    {
      icon: GraduationCap,
      title: t('featuresCitations.useCaseAcademicTitle'),
      description: t('featuresCitations.useCaseAcademicDesc'),
      link: '/use-cases/students',
      linkText: t('featuresCitations.useCaseAcademicLink'),
    },
    {
      icon: Scale,
      title: t('featuresCitations.useCaseLegalTitle'),
      description: t('featuresCitations.useCaseLegalDesc'),
      link: '/use-cases/lawyers',
      linkText: t('featuresCitations.useCaseLegalLink'),
    },
    {
      icon: BarChart3,
      title: t('featuresCitations.useCaseFinanceTitle'),
      description: t('featuresCitations.useCaseFinanceDesc'),
      link: '/demo',
      linkText: t('featuresCitations.useCaseFinanceLink'),
    },
  ];

  const faqItems = [
    {
      q: t('featuresCitations.faq1Q'),
      a: t('featuresCitations.faq1A'),
    },
    {
      q: t('featuresCitations.faq2Q'),
      a: t('featuresCitations.faq2A'),
    },
    {
      q: t('featuresCitations.faq3Q'),
      a: t('featuresCitations.faq3A'),
    },
    {
      q: t('featuresCitations.faq4Q'),
      a: t('featuresCitations.faq4A'),
    },
    {
      q: t('featuresCitations.faq5Q'),
      a: t('featuresCitations.faq5A'),
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
      breadcrumb={[
        { label: t('useCasesHub.breadcrumb.home'), href: '/' },
        { label: t('footer.links.features'), href: '/features' },
        { label: t('featuresCitations.heroTitle') },
      ]}
    >
      <EdPageHero
        eyebrow={t('featuresCitations.heroBadge')}
        title={t('featuresCitations.heroTitle')}
        lede={t('featuresCitations.heroSubtitle')}
        primaryCta={{ label: t('featuresCitations.heroCta'), href: '/demo' }}
      />

      <EdSection title={t('featuresCitations.howTitle')}>
        <p className="ed-lede">{t('featuresCitations.howSubtitle')}</p>
        <EdStepRow
          steps={howSteps.map((s) => ({ title: s.title, body: s.description, icon: s.icon }))}
        />
      </EdSection>

      <EdSection alt title={t('featuresCitations.whyTitle')}>
        <EdProse>
          <p>{t('featuresCitations.whyPara1')}</p>
          <p>{t('featuresCitations.whyPara2')}</p>
          <p>{t('featuresCitations.whyPara3')}</p>
          <p>{t('featuresCitations.whyPara4')}</p>
        </EdProse>
      </EdSection>

      <EdSection title={t('featuresCitations.layersTitle')}>
        <p className="ed-lede">{t('featuresCitations.layersSubtitle')}</p>
        <EdFeatureList
          items={layers.map((l) => ({ title: l.title, body: l.description, icon: l.icon }))}
        />
      </EdSection>

      <EdSection alt title={t('featuresCitations.compTitle')}>
        <p className="ed-lede">{t('featuresCitations.compSubtitle')}</p>
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
                <th
                  scope="col"
                  className="ed-label"
                  style={{ ...headStyle, textAlign: 'left' }}
                >
                  {t('featuresCitations.compHeaderFeature')}
                </th>
                <th
                  scope="col"
                  className="ed-label"
                  style={{
                    ...headStyle,
                    background: 'var(--ed-paper-2)',
                    color: 'var(--ed-signal)',
                  }}
                >
                  {t('featuresCitations.compHeaderDocTalk')}
                </th>
                <th scope="col" className="ed-label" style={headStyle}>
                  {t('featuresCitations.compHeaderChatPDF')}
                </th>
                <th scope="col" className="ed-label" style={headStyle}>
                  {t('featuresCitations.compHeaderAskYourPDF')}
                </th>
                <th scope="col" className="ed-label" style={headStyle}>
                  {t('featuresCitations.compHeaderHumata')}
                </th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--ed-rule)' }}>
                  <th
                    scope="row"
                    className="ed-body"
                    style={{
                      padding: '13px 18px',
                      fontWeight: 500,
                      color: 'var(--ed-ink)',
                      textAlign: 'left',
                    }}
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
                    <EdInlineCell value={row.humata} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="ed-caption" style={{ marginTop: '16px' }}>
          {t('featuresCitations.compDisclaimer')}
        </p>
      </EdSection>

      <EdSection title={t('featuresCitations.useCasesTitle')}>
        <p className="ed-lede">{t('featuresCitations.useCasesSubtitle')}</p>
        <EdCardGrid
          columns={3}
          items={useCases.map((u) => ({
            title: u.title,
            body: u.description,
            icon: u.icon,
            href: u.link,
          }))}
        />
      </EdSection>

      <EdSection alt title={t('featuresCitations.faqTitle')}>
        <EdFaqList items={faqItems.map((f) => ({ question: f.q, answer: f.a }))} />
      </EdSection>

      <EdSection>
        <EdRelatedLinks
          links={[
            { href: '/features/multi-format', label: t('featuresCitations.linkMultiFormat') },
            { href: '/compare/chatpdf', label: t('featuresCitations.linkVsChatPDF') },
            { href: '/use-cases/students', label: t('featuresCitations.linkStudents') },
            { href: '/use-cases/lawyers', label: t('featuresCitations.linkLawyers') },
          ]}
        />
      </EdSection>

      <EdCtaBanner
        title={t('featuresCitations.ctaTitle')}
        description={t('featuresCitations.ctaSubtitle')}
        primary={{ label: t('featuresCitations.ctaDemoButton'), href: '/demo' }}
        secondary={{ label: t('featuresCitations.ctaFormatsButton'), href: '/features/multi-format' }}
      />
    </MarketingShell>
  );
}
