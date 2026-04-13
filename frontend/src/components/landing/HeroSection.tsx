"use client";

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useLocale } from '../../i18n';
import HeroArtifact from './HeroArtifact';
import SectionKicker from '../design/SectionKicker';
import { BlurReveal, FlowButton, TiltCard, LightRays } from '../spell';

export default function HeroSection() {
  const { t } = useLocale();
  const headlineLines = t('landing.headline').split('\n');

  return (
    <section className="relative max-w-7xl mx-auto px-6 py-20 md:py-28 overflow-hidden">
      {/* Light rays atmosphere — dark mode only. Replaces the flat halo
          behind HeroArtifact with a slow-drifting conic gradient. Below
          all content; decorative. */}
      <LightRays className="hidden dark:block" />
      <div className="relative grid lg:grid-cols-5 gap-12 lg:gap-16 items-center">
        {/* Left: text — order-1 desktop, order-1 mobile */}
        <div className="lg:col-span-3 text-center lg:text-left">
          {/* Editorial kicker — blur-reveal on first visit for an editorial "word-by-word lands on the page" entrance. */}
          <BlurReveal as="div" delay={0} className="mb-6 inline-block">
            <SectionKicker num="01" centered>{t('landing.badge')}</SectionKicker>
          </BlurReveal>

          {/* Headline — Fraunces serif + blur-reveal per word. Each line
              is its own BlurReveal so line breaks stay semantic. */}
          <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-medium text-zinc-900 dark:text-zinc-50 leading-[1.05] tracking-[-0.025em] text-balance">
            {headlineLines.map((line: string, i: number) => (
              <React.Fragment key={i}>
                {i > 0 && <br />}
                <BlurReveal text={line} delay={0.15 + i * 0.25} stagger={0.06} />
              </React.Fragment>
            ))}
          </h1>

          <BlurReveal as="p" delay={0.9} className="mt-5 text-lg md:text-xl text-zinc-600 dark:text-zinc-300 leading-relaxed max-w-xl lg:max-w-none">
            {t('landing.description')}
          </BlurReveal>

          {/* CTAs: primary FlowButton (liquid-fill hover) + ghost text link */}
          <BlurReveal as="div" delay={1.15} className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4 justify-center lg:justify-start">
            <FlowButton href="/demo" variant="primary">
              {t('landing.cta.demo')}
              <ArrowRight aria-hidden="true" size={18} className="transition-transform motion-reduce:transform-none group-hover:translate-x-0.5" />
            </FlowButton>
            <Link
              href="#auth"
              scroll={false}
              className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:text-accent dark:hover:text-accent transition-colors motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:rounded-sm"
            >
              {t('hero.signUpFree')}
              <span aria-hidden="true" className="ml-1">→</span>
            </Link>
          </BlurReveal>
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
