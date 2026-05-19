"use client";

import React from 'react';
import Link from 'next/link';
import { useLocale } from '../../i18n';
import {
  GraduationCap,
  Scale,
  TrendingUp,
  FileText,
  Briefcase,
  BookOpen,
  Users,
  Home,
  HeartPulse,
  ShieldCheck,
} from 'lucide-react';
import MarketingShell from '../../components/marketing/MarketingShell';
import EdPageHero from '../../components/marketing/EdPageHero';
import EdSection from '../../components/marketing/EdSection';
import EdCtaBanner from '../../components/marketing/EdCtaBanner';

const useCaseIcons = [GraduationCap, Scale, TrendingUp, FileText, BookOpen, Users, Home, HeartPulse, ShieldCheck];
const useCaseSlugs = ['students', 'lawyers', 'finance', 'hr-contracts', 'teachers', 'consultants', 'real-estate', 'healthcare', 'compliance'];

export default function UseCasesHubClient() {
  const { t } = useLocale();

  const useCases = useCaseSlugs.map((slug, i) => ({
    slug,
    icon: useCaseIcons[i],
    title: t(`useCasesHub.cases.${slug}.title`),
    description: t(`useCasesHub.cases.${slug}.description`),
  }));

  return (
    <MarketingShell
      breadcrumb={[
        { label: t('useCasesHub.breadcrumb.home'), href: '/' },
        { label: t('footer.links.useCases') },
      ]}
    >
      <EdPageHero
        icon={Briefcase}
        title={t('useCasesHub.heroTitle')}
        lede={t('useCasesHub.heroDescription')}
      />

      <EdSection>
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          style={{ gridAutoRows: '1fr' }}
        >
          {useCases.map((uc) => {
            const Icon = uc.icon;
            return (
              <Link
                key={uc.slug}
                href={`/use-cases/${uc.slug}`}
                className="ed-card h-full"
                style={{ display: 'flex', flexDirection: 'column' }}
              >
                {Icon && (
                  <div style={{ marginBottom: '10px', color: 'var(--ed-ink-3)' }}>
                    <Icon className="w-4 h-4" />
                  </div>
                )}
                <h3 className="ed-h3">{uc.title}</h3>
                <p className="ed-body" style={{ marginTop: '8px' }}>
                  {uc.description}
                </p>
              </Link>
            );
          })}
        </div>
      </EdSection>

      <EdSection alt title={t('useCasesHub.crossLinks.title')}>
        <p className="ed-body" style={{ marginBottom: '20px' }}>
          {t('useCasesHub.crossLinks.description')}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href="/features/citations" className="ed-link">
            {t('useCasesHub.crossLinks.citationHighlighting')}
          </Link>
          <Link href="/features/multi-format" className="ed-link">
            {t('useCasesHub.crossLinks.multiFormatSupport')}
          </Link>
          <Link href="/features/performance-modes" className="ed-link">
            {t('useCasesHub.crossLinks.performanceModes')}
          </Link>
          <Link href="/compare/notebooklm" className="ed-link">
            {t('useCasesHub.crossLinks.notebookLMComparison')}
          </Link>
          <Link href="/compare/humata" className="ed-link">
            {t('useCasesHub.crossLinks.humataComparison')}
          </Link>
        </div>
      </EdSection>

      <EdCtaBanner
        description={t('useCasesHub.cta.description')}
        primary={{ label: t('useCasesHub.cta.tryFreeDemo'), href: '/demo' }}
      />
    </MarketingShell>
  );
}
