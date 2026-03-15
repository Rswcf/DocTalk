"use client";

import React from 'react';
import Link from 'next/link';
import { useLocale } from '../i18n';
import ScrollReveal from './landing/ScrollReveal';
import DocTalkLogo from './DocTalkLogo';
import { getReleaseLabel, getShortBuildSha } from '../lib/version';

export default function Footer() {
  const { t } = useLocale();
  const releaseLabel = getReleaseLabel();
  const buildSha = getShortBuildSha();
  const productLinks = [
    { href: '/demo', label: t('footer.demo') },
    { href: '/pricing', label: t('footer.pricing') },
    { href: '/features', label: t('footer.links.features') },
    { href: '/features/free-demo', label: t('footer.links.noSignupDemo') },
    { href: '/features/citations', label: t('footer.links.citationHighlighting') },
    { href: '/features/performance-modes', label: t('footer.links.performanceModes') },
  ];
  const useCaseLinks = [
    { href: '/use-cases', label: t('footer.links.useCases') },
    { href: '/use-cases/students', label: t('footer.links.students') },
    { href: '/use-cases/lawyers', label: t('footer.links.lawyers') },
    { href: '/use-cases/finance', label: t('footer.links.finance') },
    { href: '/use-cases/hr-contracts', label: t('footer.links.hrContracts') },
  ];
  const resourceLinks = [
    { href: '/compare', label: t('footer.links.compareTools') },
    { href: '/alternatives', label: t('footer.links.alternatives') },
    { href: '/blog', label: t('footer.links.blog') },
    { href: '/blog/category/comparisons', label: t('footer.links.comparisonGuides') },
    { href: '/features/multi-format', label: t('footer.links.multiFormatSupport') },
  ];
  const companyLinks = [
    { href: '/about', label: t('footer.links.about') },
    { href: '/contact', label: t('footer.contact') },
    { href: '/privacy', label: t('privacy.policyLink') },
    { href: '/terms', label: t('terms.title') },
    { href: '/privacy#ccpa', label: t('footer.doNotSell') },
  ];

  return (
    <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <ScrollReveal>
          {/* Logo / brand anchor */}
          <div className="mb-10">
            <Link href="/" className="inline-flex items-center gap-2.5 hover:opacity-80 transition-opacity">
              <DocTalkLogo size={28} />
              <span className="font-logo font-semibold text-xl text-zinc-900 dark:text-zinc-50">DocTalk</span>
            </Link>
          </div>

          <p className="max-w-2xl text-sm text-zinc-500 dark:text-zinc-400 mb-10 leading-relaxed">
            {t('footer.description')}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                {t('footer.product')}
              </h3>
              <ul className="space-y-3">
                {productLinks.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-accent transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:rounded-sm">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                {t('footer.useCases')}
              </h3>
              <ul className="space-y-3">
                {useCaseLinks.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-accent transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:rounded-sm">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                {t('footer.resources')}
              </h3>
              <ul className="space-y-3">
                {resourceLinks.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-accent transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:rounded-sm">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                {t('footer.company')}
              </h3>
              <ul className="space-y-3">
                {companyLinks.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-accent transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:rounded-sm">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom row */}
          <div className="mt-12 pt-8 border-t border-zinc-200 dark:border-zinc-800 text-center text-sm text-zinc-400 dark:text-zinc-500">
            <p>{t('footer.copyright')}</p>
            <p className="mt-2">
              {releaseLabel}
              {buildSha ? ` · ${buildSha}` : ''}
            </p>
          </div>
        </ScrollReveal>
      </div>
    </footer>
  );
}
