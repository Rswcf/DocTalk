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
    { href: '/trust', label: t('footer.links.trust') },
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

          <p className="max-w-2xl text-sm text-zinc-500 dark:text-zinc-300 mb-10 leading-relaxed">
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
                    <Link href={item.href} className="text-sm text-zinc-500 dark:text-zinc-300 hover:text-accent transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:rounded-sm">
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
                    <Link href={item.href} className="text-sm text-zinc-500 dark:text-zinc-300 hover:text-accent transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:rounded-sm">
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
                    <Link href={item.href} className="text-sm text-zinc-500 dark:text-zinc-300 hover:text-accent transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:rounded-sm">
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
                    <Link href={item.href} className="text-sm text-zinc-500 dark:text-zinc-300 hover:text-accent transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:rounded-sm">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom row */}
          <div className="mt-12 pt-8 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-400 dark:text-zinc-500">
            <div className="text-center sm:text-left">
              <p>{t('footer.copyright')}</p>
              <p className="mt-1 font-mono text-xs">
                {releaseLabel}
                {buildSha ? ` · ${buildSha}` : ''}
              </p>
            </div>
            {/* Open-source signal — per 30-agent indie credibility research,
                a visible GitHub link is one of the strongest "real product,
                real team" signals a small-team SaaS can offer. */}
            <a
              href="https://github.com/Rswcf/DocTalk"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-accent dark:hover:text-accent transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:rounded-sm"
              aria-label={t('footer.github.ariaLabel')}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.38 7.86 10.9.58.1.79-.25.79-.56v-2.01c-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.27-1.68-1.27-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.25 3.34.95.1-.74.4-1.25.72-1.54-2.56-.29-5.25-1.28-5.25-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.45.11-3.03 0 0 .97-.31 3.17 1.18a11.04 11.04 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.58.23 2.74.11 3.03.74.81 1.18 1.84 1.18 3.1 0 4.42-2.69 5.4-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.52 11.52 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5z" />
              </svg>
              <span>{t('footer.github.label')}</span>
            </a>
          </div>
        </ScrollReveal>
      </div>
    </footer>
  );
}
