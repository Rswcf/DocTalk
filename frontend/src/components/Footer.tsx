"use client";

import React from 'react';
import Link from 'next/link';
import { useLocale } from '../i18n';
import ScrollReveal from './landing/ScrollReveal';
import DocTalkLogo from './DocTalkLogo';

const PRODUCT_LINKS = [
  { href: '/demo', label: 'Demo' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/features', label: 'Features' },
  { href: '/features/free-demo', label: 'No-Signup Demo' },
  { href: '/features/citations', label: 'Citation Highlighting' },
  { href: '/features/performance-modes', label: 'Performance Modes' },
];

const USE_CASE_LINKS = [
  { href: '/use-cases', label: 'Use Cases' },
  { href: '/use-cases/students', label: 'Students' },
  { href: '/use-cases/lawyers', label: 'Lawyers' },
  { href: '/use-cases/finance', label: 'Finance' },
  { href: '/use-cases/hr-contracts', label: 'HR & Contracts' },
];

const RESOURCE_LINKS = [
  { href: '/compare', label: 'Compare Tools' },
  { href: '/alternatives', label: 'Alternatives' },
  { href: '/blog', label: 'Blog' },
  { href: '/blog/category/comparisons', label: 'Comparison Guides' },
  { href: '/features/multi-format', label: 'Multi-Format Support' },
];

const COMPANY_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/terms', label: 'Terms of Service' },
  { href: '/privacy#ccpa', label: 'Do Not Sell My Info' },
];

export default function Footer() {
  const { t } = useLocale();

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
            AI document chat for PDFs, spreadsheets, contracts, and research reports. Explore
            product features, role-based workflows, competitive comparisons, and practical guides.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                {t('footer.product')}
              </h3>
              <ul className="space-y-3">
                {PRODUCT_LINKS.map((item) => (
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
                Use Cases
              </h3>
              <ul className="space-y-3">
                {USE_CASE_LINKS.map((item) => (
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
                Resources
              </h3>
              <ul className="space-y-3">
                {RESOURCE_LINKS.map((item) => (
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
                {COMPANY_LINKS.map((item) => (
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
          </div>
        </ScrollReveal>
      </div>
    </footer>
  );
}
