"use client";

import React from 'react';
import Link from 'next/link';
import { useLocale } from '../../../i18n';
import {
  Home,
  FileText,
  Search,
  ClipboardCheck,
  Upload,
  MessageSquare,
  CheckCircle,
  Lock,
  Shield,
  Scale,
  Briefcase,
  DollarSign,
} from 'lucide-react';
import MarketingShell from '../../../components/marketing/MarketingShell';
import EdPageHero from '../../../components/marketing/EdPageHero';
import EdSection from '../../../components/marketing/EdSection';
import EdProse from '../../../components/marketing/EdProse';
import EdFeatureList from '../../../components/marketing/EdFeatureList';
import EdCardGrid from '../../../components/marketing/EdCardGrid';
import EdStepRow from '../../../components/marketing/EdStepRow';
import EdFaqList from '../../../components/marketing/EdFaqList';
import EdCtaBanner from '../../../components/marketing/EdCtaBanner';

export default function RealEstateClient() {
  const { t } = useLocale();

  const features = [
    {
      icon: FileText,
      title: t('useCasesRealEstate.feature1Title'),
      description: t('useCasesRealEstate.feature1Description'),
    },
    {
      icon: Search,
      title: t('useCasesRealEstate.feature2Title'),
      description: t('useCasesRealEstate.feature2Description'),
    },
    {
      icon: DollarSign,
      title: t('useCasesRealEstate.feature3Title'),
      description: t('useCasesRealEstate.feature3Description'),
    },
    {
      icon: ClipboardCheck,
      title: t('useCasesRealEstate.feature4Title'),
      description: t('useCasesRealEstate.feature4Description'),
    },
  ];

  const exampleQuestions = [
    t('useCasesRealEstate.exampleQuestion1'),
    t('useCasesRealEstate.exampleQuestion2'),
    t('useCasesRealEstate.exampleQuestion3'),
    t('useCasesRealEstate.exampleQuestion4'),
    t('useCasesRealEstate.exampleQuestion5'),
    t('useCasesRealEstate.exampleQuestion6'),
  ];

  const docTypes = [
    { format: t('useCasesRealEstate.docType1Format'), detail: t('useCasesRealEstate.docType1Detail') },
    { format: t('useCasesRealEstate.docType2Format'), detail: t('useCasesRealEstate.docType2Detail') },
    { format: t('useCasesRealEstate.docType3Format'), detail: t('useCasesRealEstate.docType3Detail') },
    { format: t('useCasesRealEstate.docType4Format'), detail: t('useCasesRealEstate.docType4Detail') },
  ];

  const securityItems = [
    { icon: Lock, title: t('useCasesRealEstate.security1Title'), detail: t('useCasesRealEstate.security1Detail') },
    { icon: Shield, title: t('useCasesRealEstate.security2Title'), detail: t('useCasesRealEstate.security2Detail') },
    { icon: FileText, title: t('useCasesRealEstate.security3Title'), detail: t('useCasesRealEstate.security3Detail') },
    { icon: CheckCircle, title: t('useCasesRealEstate.security4Title'), detail: t('useCasesRealEstate.security4Detail') },
  ];

  const steps = [
    { icon: Upload, step: '1', title: t('useCasesRealEstate.step1Title'), description: t('useCasesRealEstate.step1Description') },
    { icon: MessageSquare, step: '2', title: t('useCasesRealEstate.step2Title'), description: t('useCasesRealEstate.step2Description') },
    { icon: CheckCircle, step: '3', title: t('useCasesRealEstate.step3Title'), description: t('useCasesRealEstate.step3Description') },
  ];

  const faqItems = [
    {
      question: t('useCasesRealEstate.faq1Q'),
      answer: t('useCasesRealEstate.faq1A'),
    },
    {
      question: t('useCasesRealEstate.faq2Q'),
      answer: t('useCasesRealEstate.faq2A'),
    },
    {
      question: t('useCasesRealEstate.faq3Q'),
      answer: t('useCasesRealEstate.faq3A'),
    },
    {
      question: t('useCasesRealEstate.faq4Q'),
      answer: t('useCasesRealEstate.faq4A'),
    },
    {
      question: t('useCasesRealEstate.faq5Q'),
      answer: t('useCasesRealEstate.faq5A'),
    },
  ];

  const relatedUseCases = [
    {
      href: '/use-cases/lawyers',
      icon: Scale,
      title: t('useCasesRealEstate.related1Title'),
      description: t('useCasesRealEstate.related1Description'),
    },
    {
      href: '/use-cases/finance',
      icon: DollarSign,
      title: t('useCasesRealEstate.related2Title'),
      description: t('useCasesRealEstate.related2Description'),
    },
    {
      href: '/use-cases/consultants',
      icon: Briefcase,
      title: t('useCasesRealEstate.related3Title'),
      description: t('useCasesRealEstate.related3Description'),
    },
  ];

  return (
    <MarketingShell
      breadcrumb={[
        { label: t('useCasesRealEstate.breadcrumbHome'), href: '/' },
        { label: t('useCasesRealEstate.breadcrumbUseCases'), href: '/use-cases' },
        { label: t('useCasesRealEstate.breadcrumbCurrent') },
      ]}
    >
      <EdPageHero
        icon={Home}
        title={t('useCasesRealEstate.heroTitle')}
        lede={t('useCasesRealEstate.heroLede')}
        primaryCta={{ label: t('useCasesRealEstate.heroCta'), href: '/demo' }}
      />

      <EdSection title={t('useCasesRealEstate.challengeTitle')}>
        <EdProse>
          <p>
            {t('useCasesRealEstate.challengeP1')}
          </p>
          <p>
            {t('useCasesRealEstate.challengeP2')}
          </p>
          <p>
            {t('useCasesRealEstate.challengeP3Pre')}{' '}
            <a href="https://www.nar.realtor/technology" target="_blank" rel="noopener noreferrer">{t('useCasesRealEstate.challengeP3Link')}</a>
            {' '}{t('useCasesRealEstate.challengeP3Post')}
          </p>
          <p>
            {t('useCasesRealEstate.challengeP4')}
          </p>
        </EdProse>
      </EdSection>

      <EdSection alt title={t('useCasesRealEstate.howItHelpsTitle')}>
        <EdFeatureList
          items={features.map((f) => ({ title: f.title, body: f.description, icon: f.icon }))}
        />
      </EdSection>

      <EdSection title={t('useCasesRealEstate.docTypesTitle')}>
        <p className="ed-body" style={{ marginBottom: '24px' }}>
          {t('useCasesRealEstate.docTypesDescription')}{' '}
          <Link href="/features/multi-format" className="ed-inline">
            {t('useCasesRealEstate.docTypesFormatsLink')}
          </Link>
          {' '}{t('useCasesRealEstate.docTypesDescriptionSuffix')}
        </p>
        <EdCardGrid
          columns={2}
          items={docTypes.map((d) => ({ title: d.format, body: d.detail }))}
        />
      </EdSection>

      <EdSection alt title={t('useCasesRealEstate.exampleQuestionsTitle')}>
        <p className="ed-body" style={{ marginBottom: '24px' }}>
          {t('useCasesRealEstate.exampleQuestionsDescription')}
        </p>
        <EdCardGrid
          columns={2}
          items={exampleQuestions.map((q) => ({ title: q }))}
        />
      </EdSection>

      <EdSection title={t('useCasesRealEstate.securityTitle')}>
        <p className="ed-body" style={{ marginBottom: '24px' }}>
          {t('useCasesRealEstate.securityDescription')}
        </p>
        <EdCardGrid
          columns={2}
          items={securityItems.map((s) => ({ title: s.title, body: s.detail, icon: s.icon }))}
        />
      </EdSection>

      <EdSection alt title={t('useCasesRealEstate.stepsTitle')}>
        <EdStepRow
          steps={steps.map((s) => ({ title: s.title, body: s.description, icon: s.icon }))}
        />
      </EdSection>

      <EdSection title={t('useCasesRealEstate.relatedTitle')}>
        <div
          className="grid grid-cols-1 sm:grid-cols-3"
          style={{ gap: '16px', gridAutoRows: '1fr' }}
        >
          {relatedUseCases.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="ed-card h-full"
                style={{ display: 'flex', flexDirection: 'column' }}
              >
                <div style={{ marginBottom: '10px', color: 'var(--ed-ink-3)' }}>
                  <Icon className="w-4 h-4" />
                </div>
                <h3 className="ed-h3">{item.title}</h3>
                <p className="ed-body" style={{ marginTop: '8px' }}>
                  {item.description}
                </p>
              </Link>
            );
          })}
        </div>
      </EdSection>

      <EdSection alt title={t('useCasesRealEstate.faqTitle')}>
        <EdFaqList items={faqItems} />
      </EdSection>

      <EdCtaBanner
        title={t('useCasesRealEstate.ctaTitle')}
        description={t('useCasesRealEstate.ctaDescription')}
        primary={{ label: t('useCasesRealEstate.ctaPrimary'), href: '/demo' }}
      />
    </MarketingShell>
  );
}
