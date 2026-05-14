"use client";

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import DocTalkLogo from './DocTalkLogo';
import LanguageSelector from './LanguageSelector';
import FeedbackButton from './FeedbackButton';
import { useLocale } from '../i18n';
import { trackEvent } from '../lib/analytics';

export default function PublicHeader() {
  const { t, tOr } = useLocale();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const publicNav = [
    { href: '/features', label: t('public.nav.features') },
    { href: '/use-cases', label: t('public.nav.useCases') },
    { href: '/compare', label: t('public.nav.compare') },
    { href: '/blog', label: t('public.nav.blog') },
    { href: '/pricing', label: t('footer.pricing') },
  ];

  return (
    <header className="relative h-14 flex items-center px-4 sm:px-6 gap-3 min-w-0 shrink-0 sticky top-0 z-30 border-b border-zinc-200 dark:border-zinc-800 bg-[var(--page-background)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--page-background)]/80">
      <Link href="/" className="font-logo font-semibold text-xl text-zinc-900 dark:text-zinc-100 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm inline-flex items-center gap-2">
        <DocTalkLogo size={26} />
        {t('app.title')}
        <span className="ml-1 -mt-2 px-1.5 py-0.5 text-[10px] font-medium leading-none rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300 tracking-wide uppercase">Beta</span>
      </Link>

      <nav className="hidden lg:flex items-center gap-4 ml-4" aria-label="Public navigation">
        {publicNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-2 shrink-0">
        <div className="hidden sm:flex"><LanguageSelector /></div>
        <div className="hidden md:flex"><FeedbackButton /></div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen((open) => !open)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:focus-visible:ring-zinc-500 dark:focus-visible:ring-offset-zinc-900 lg:hidden"
          aria-label={mobileMenuOpen ? t('common.close') : tOr('common.menu', 'Menu')}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-public-navigation"
        >
          {mobileMenuOpen ? <X aria-hidden="true" size={18} /> : <Menu aria-hidden="true" size={18} />}
        </button>
        <Link
          href="/demo"
          onClick={() => trackEvent('landing_cta_clicked', { source: 'public_header', reason: 'demo' })}
          className="hidden sm:inline-flex items-center px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-md"
        >
          {t('footer.demo')}
        </Link>
        <Link
          href="/auth"
          onClick={() => trackEvent('landing_cta_clicked', { source: 'public_header', reason: 'sign_up' })}
          className="inline-flex items-center px-3 py-1.5 text-sm bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
        >
          {t('hero.signUpFree')}
        </Link>
      </div>
      {mobileMenuOpen && (
        <nav
          id="mobile-public-navigation"
          className="absolute left-3 right-3 top-full mt-2 rounded-xl border border-zinc-200 bg-white p-2 shadow-xl dark:border-zinc-800 dark:bg-zinc-950 lg:hidden"
          aria-label="Mobile navigation"
        >
          <div className="grid gap-1">
            {[...publicNav, { href: '/demo', label: t('footer.demo') }].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-200 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="mt-2 border-t border-zinc-200 px-3 py-2 dark:border-zinc-800 sm:hidden">
            <LanguageSelector />
          </div>
        </nav>
      )}
    </header>
  );
}
