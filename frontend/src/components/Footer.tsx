"use client";

import React from 'react';
import Link from 'next/link';
import { useLocale } from '../i18n';
import ScrollReveal from './landing/ScrollReveal';
import DocTalkLogo from './DocTalkLogo';

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

          <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
            {/* Product */}
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                {t('footer.product')}
              </h3>
              <ul className="space-y-3">
                <li>
                  <Link href="/demo" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-accent transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:rounded-sm">
                    {t('footer.demo')}
                  </Link>
                </li>
                <li>
                  <Link href="/billing" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-accent transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:rounded-sm">
                    {t('footer.pricing')}
                  </Link>
                </li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                {t('footer.company')}
              </h3>
              <ul className="space-y-3">
                <li>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400 font-logo">
                    DocTalk
                  </span>
                </li>
                <li>
                  <a href="mailto:support@doctalk.app" aria-label={t('footer.contactEmail') || 'Send email to support'} className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-accent transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:rounded-sm outline-none">
                    {t('footer.contact')}
                  </a>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                {t('footer.legal')}
              </h3>
              <ul className="space-y-3">
                <li>
                  <Link href="/privacy" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-accent transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:rounded-sm">
                    {t('privacy.policyLink')}
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-accent transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:rounded-sm">
                    {t('privacy.termsLink')}
                  </Link>
                </li>
                <li>
                  <Link href="/privacy#ccpa" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-accent transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:rounded-sm">
                    {t('footer.doNotSell')}
                  </Link>
                </li>
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
