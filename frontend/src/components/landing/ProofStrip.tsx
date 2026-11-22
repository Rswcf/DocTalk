"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowUpRight } from 'lucide-react';
import { useLocale } from '../../i18n';
import { localizedHrefIfAvailable, splitLocaleFromPath } from '../../i18n/routing';

/**
 * Three checkable facts under the hero, each linking to the page that shows
 * it, then a row of in-page anchors (plan 2026-11-22-ui-ux-pangram-learnings
 * §M2; Pangram puts the same pair under its hero).
 *
 * Only claims the product can show: the language count (the 11 locales), the
 * format count (PDF, DOCX, PPTX, XLSX, TXT, Markdown, URL; the compare pages
 * say 7) and the citation jump. No accuracy percentage: there is no published
 * evaluation to link to. Change a count here together with those pages.
 *
 * No filled CTA: the hero above owns the view's one `.ed-cta`.
 */
const facts = [
  {
    key: 'languages',
    path: '/features/multilingual',
    value: '11',
    label: 'languages for the interface and the answers',
  },
  {
    key: 'formats',
    path: '/features/multi-format',
    value: '7',
    label: 'file formats, from PDF and slides to web pages',
  },
  {
    key: 'jump',
    path: '/features/citations',
    value: '1 click',
    label: 'from any answer to the passage it cites',
  },
] as const;

// Each anchor reuses the heading or eyebrow key of the section it opens, so
// its text always matches what the reader lands on.
const anchors = [
  { href: '#how-it-works', labelKey: 'landing.howItWorks.title' },
  { href: '#security', labelKey: 'landing.security.eyebrow' },
  { href: '#faq', labelKey: 'landing.faq.eyebrow' },
] as const;

export default function ProofStrip() {
  const { t, tOr } = useLocale();
  const { locale: urlLocale } = splitLocaleFromPath(usePathname() || '/');
  const href = (path: string) => localizedHrefIfAvailable(urlLocale, path);

  return (
    <section className="ed-proof" aria-label={tOr('landing.proof.ariaLabel', 'DocTalk at a glance')}>
      <div className="ed-shell">
        <ul className="ed-proof-grid">
          {facts.map((fact) => (
            <li key={fact.key}>
              <Link href={href(fact.path)} className="ed-proof-cell">
                <span className="ed-num">{tOr(`landing.proof.${fact.key}.value`, fact.value)}</span>
                <span className="ed-proof-label">
                  {tOr(`landing.proof.${fact.key}.label`, fact.label)}
                  <ArrowUpRight aria-hidden="true" size={14} className="ed-proof-arrow rtl:-scale-x-100" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <nav className="ed-proof-nav" aria-label={tOr('landing.proof.nav.ariaLabel', 'On this page')}>
          {anchors.map((anchor) => (
            <a key={anchor.href} href={anchor.href}>
              {t(anchor.labelKey)}
            </a>
          ))}
          <Link href={href('/pricing')}>{t('footer.pricing')}</Link>
        </nav>
      </div>
    </section>
  );
}
