"use client";

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useLocale } from '../../i18n';
import ScrollReveal from './ScrollReveal';
import { trackEvent } from '../../lib/analytics';

export default function FinalCTA() {
  const { t } = useLocale();

  return (
    <section className="ed-section" style={{ borderTop: '1px solid var(--ed-rule)' }}>
      <div className="ed-shell">
        <ScrollReveal>
          <div className="max-w-2xl">
            <p className="ed-label mb-4">Get Started</p>
            <hr className="ed-rule mb-10" />
            <h2 className="ed-display mb-6">{t('landing.finalCta.title')}</h2>
            <p className="ed-lede mb-10">{t('landing.finalCta.subtitle')}</p>
            <div className="flex items-center gap-6 flex-wrap">
              <Link
                href="/demo"
                onClick={() => trackEvent('landing_cta_clicked', { source: 'final_cta', reason: 'demo' })}
                className="ed-cta"
              >
                {t('landing.finalCta.demo')}
                <ArrowRight aria-hidden="true" size={16} />
              </Link>
              {/* Plain <a> (not next/link): a native hash anchor fires the
                  `hashchange` event AuthModal listens for, so the modal opens.
                  next/link updates the hash via history API without firing it. */}
              <a
                href="#auth"
                onClick={() => trackEvent('landing_cta_clicked', { source: 'final_cta', reason: 'sign_up' })}
                className="ed-link"
              >
                {t('landing.finalCta.signUp')}
              </a>
            </div>
          </div>
          <hr className="ed-rule mt-16" />
        </ScrollReveal>
      </div>
    </section>
  );
}
