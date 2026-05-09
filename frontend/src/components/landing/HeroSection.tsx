"use client";

import React from 'react';
import Link from 'next/link';
import { ArrowRight, FileCheck2, Languages, ShieldCheck } from 'lucide-react';
import { useLocale } from '../../i18n';
import HeroArtifact from './HeroArtifact';
import SectionKicker from '../design/SectionKicker';
import { FlowButton, TiltCard, LightRays } from '../spell';
import { trackEvent } from '../../lib/analytics';

export default function HeroSection() {
  const { t, tOr } = useLocale();
  const headlineLines = t('landing.headline').split('\n');
  const proofItems = [
    {
      icon: FileCheck2,
      label: tOr('landing.proof.citations', 'Answers cite exact source passages'),
    },
    {
      icon: ShieldCheck,
      label: tOr('landing.proof.private', 'Documents are private and deletable'),
    },
    {
      icon: Languages,
      label: tOr('landing.proof.locales', 'Works across 11 interface languages'),
    },
  ];

  return (
    <section className="relative mx-auto max-w-7xl overflow-hidden px-6 py-20 md:py-24 lg:py-28">
      {/* Light rays atmosphere — dark mode only. Replaces the flat halo
          behind HeroArtifact with a slow-drifting conic gradient. Below
          all content; decorative. */}
      <LightRays className="hidden dark:block" />
      <div className="relative grid lg:grid-cols-5 gap-12 lg:gap-16 items-center">
        {/* Left: text — order-1 desktop, order-1 mobile */}
        <div className="lg:col-span-3 text-center lg:text-left">
          <div className="mb-6 inline-block">
            <SectionKicker num="01" centered>{t('landing.badge')}</SectionKicker>
          </div>

          <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-medium text-zinc-900 dark:text-zinc-50 leading-[1.05] tracking-[-0.025em] text-balance">
            {headlineLines.map((line: string, i: number) => (
              <React.Fragment key={i}>
                {i > 0 && <br />}
                {line}
              </React.Fragment>
            ))}
          </h1>

          <p className="mt-5 text-lg md:text-xl text-zinc-600 dark:text-zinc-300 leading-relaxed max-w-xl lg:max-w-none">
            {t('landing.description')}
          </p>

          {/* CTAs: primary FlowButton (liquid-fill hover) + ghost text link */}
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4 justify-center lg:justify-start">
            <FlowButton href="/demo" variant="primary">
              {t('landing.cta.demo')}
              <ArrowRight aria-hidden="true" size={18} className="transition-transform motion-reduce:transform-none group-hover:translate-x-0.5" />
            </FlowButton>
            <Link
              href="#auth"
              scroll={false}
              onClick={() => trackEvent('landing_cta_clicked', { source: 'hero', reason: 'sign_up' })}
              className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:text-accent dark:hover:text-accent transition-colors motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:rounded-sm"
            >
              {t('hero.signUpFree')}
              <span aria-hidden="true" className="ml-1">→</span>
            </Link>
          </div>

          <div className="mt-8 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
            {proofItems.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex min-h-16 items-center gap-3 rounded-lg border border-zinc-200/80 bg-white/70 px-3.5 py-3 text-left shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent-light text-accent">
                  <Icon aria-hidden="true" size={17} />
                </span>
                <span className="text-xs font-medium leading-5 text-zinc-600 dark:text-zinc-300">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: HeroArtifact wrapped in TiltCard for spotlight 3D */}
        <div className="lg:col-span-2">
          <TiltCard maxTilt={8} liftY={2}>
            <HeroArtifact />
          </TiltCard>
        </div>
      </div>
    </section>
  );
}
