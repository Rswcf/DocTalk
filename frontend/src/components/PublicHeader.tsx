"use client";

import Link from 'next/link';
import DocTalkLogo from './DocTalkLogo';
import LanguageSelector from './LanguageSelector';
import { useLocale } from '../i18n';

const PUBLIC_NAV = [
  { href: '/features', label: 'Features' },
  { href: '/use-cases', label: 'Use Cases' },
  { href: '/compare', label: 'Compare' },
  { href: '/blog', label: 'Blog' },
  { href: '/pricing', label: 'Pricing' },
];

export default function PublicHeader() {
  const { t } = useLocale();

  return (
    <header className="h-14 flex items-center px-4 sm:px-6 gap-3 min-w-0 shrink-0 sticky top-0 z-30 border-b border-zinc-200 dark:border-zinc-800 bg-[var(--page-background)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--page-background)]/80">
      <Link href="/" className="font-logo font-semibold text-xl text-zinc-900 dark:text-zinc-100 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm inline-flex items-center gap-2">
        <DocTalkLogo size={26} />
        {t('app.title')}
        <span className="ml-1 -mt-2 px-1.5 py-0.5 text-[10px] font-medium leading-none rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300 tracking-wide uppercase">Beta</span>
      </Link>

      <nav className="hidden lg:flex items-center gap-4 ml-4" aria-label="Public navigation">
        {PUBLIC_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-2 shrink-0">
        <div className="hidden sm:flex"><LanguageSelector /></div>
        <Link
          href="/auth"
          className="hidden sm:inline-flex items-center px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-md"
        >
          Sign in to DocTalk
        </Link>
        <Link
          href="/demo"
          className="inline-flex items-center px-3 py-1.5 text-sm bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
        >
          {t('footer.demo')}
        </Link>
      </div>
    </header>
  );
}
