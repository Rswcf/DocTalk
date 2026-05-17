"use client";

import React from 'react';
import Link from 'next/link';
import { ArrowRight, FileCheck2, Languages, ShieldCheck, Sparkles } from 'lucide-react';
import { useLocale } from '../../i18n';
import HeroArtifact from './HeroArtifact';
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
    <section className="dt-workbench-canvas relative overflow-hidden">
      <div className="relative mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-7xl flex-col items-center px-5 pb-10 pt-24 text-center sm:px-8 md:pt-28">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/7 px-3 py-1.5 text-xs font-medium text-[var(--workbench-muted)] shadow-2xl shadow-black/30 backdrop-blur-xl">
          <Sparkles aria-hidden="true" size={14} />
          {tOr('workbench.heroPill', 'AI Document Workbench')}
        </div>

        <h1 className="max-w-5xl text-5xl font-medium leading-[0.98] tracking-normal text-[var(--workbench-ink)] sm:text-6xl lg:text-7xl xl:text-8xl text-balance">
            {headlineLines.map((line: string, i: number) => (
              <React.Fragment key={i}>
                {i > 0 && <br />}
                {line}
              </React.Fragment>
            ))}
        </h1>

        <p className="mt-6 max-w-3xl text-lg leading-8 text-[var(--workbench-muted)] md:text-xl">
          {t('landing.description')}
        </p>

        <div className="mt-10 w-full">
          <HeroArtifact />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/demo"
            onClick={() => trackEvent('landing_cta_clicked', { source: 'hero', reason: 'demo' })}
            className="dt-stitch-primary inline-flex min-h-11 items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          >
            {t('landing.cta.demo')}
            <ArrowRight aria-hidden="true" size={17} />
          </Link>
          <Link
            href="#auth"
            scroll={false}
            onClick={() => trackEvent('landing_cta_clicked', { source: 'hero', reason: 'sign_up' })}
            className="inline-flex min-h-11 items-center rounded-full border border-white/14 bg-white/7 px-5 py-2 text-sm font-semibold text-[var(--workbench-ink)] transition-colors hover:bg-white/12 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          >
            {t('hero.signUpFree')}
          </Link>
        </div>

        <div className="mt-9 flex max-w-5xl flex-wrap justify-center gap-2">
          {proofItems.map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/7 px-3 py-1.5 text-xs font-medium text-[var(--workbench-muted)] backdrop-blur-xl"
            >
              <Icon aria-hidden="true" size={14} />
              {label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
