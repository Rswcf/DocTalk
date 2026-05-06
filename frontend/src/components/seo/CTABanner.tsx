"use client";

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

interface CTABannerProps {
  title: string;
  description?: string;
  buttonText: string;
  href: string;
  variant?: 'default' | 'highlight';
}

export default function CTABanner({ title, description, buttonText, href, variant = 'default' }: CTABannerProps) {
  if (variant === 'highlight') {
    return (
      <section className="relative overflow-hidden bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950">
        <div className="mx-auto grid max-w-5xl gap-8 px-6 py-16 md:grid-cols-[1fr_320px] md:items-center">
          <div>
            <p className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
              DocTalk
            </p>
            <h2 className="font-serif text-2xl font-bold tracking-tight sm:text-3xl">
              {title}
            </h2>
            {description && (
              <p className="mt-4 max-w-2xl text-[15px] leading-7 text-zinc-300 dark:text-zinc-600">
                {description}
              </p>
            )}
            <Link
              href={href}
              className="group mt-7 inline-flex items-center rounded-lg bg-white px-7 py-3.5 font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
            >
              {buttonText}
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
            </Link>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 dark:border-zinc-200 dark:bg-white">
            <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-3 dark:border-zinc-200">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
                verified answer
              </span>
              <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">
                1
              </span>
            </div>
            <div className="space-y-2">
              <div className="h-2 w-full rounded bg-white/20 dark:bg-zinc-200" />
              <div className="h-2 w-10/12 rounded bg-white/20 dark:bg-zinc-200" />
              <div className="h-5 w-full rounded bg-amber-300/30 dark:bg-amber-200" />
              <div className="h-2 w-7/12 rounded bg-white/20 dark:bg-zinc-200" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="border-y border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="mx-auto max-w-4xl px-6 py-16 text-center">
        <h2 className="mb-4 font-serif text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl">
          {title}
        </h2>
        {description && (
          <p className="mx-auto mb-8 max-w-2xl text-[15px] leading-7 text-zinc-600 dark:text-zinc-300">
            {description}
          </p>
        )}
        <Link
          href={href}
          className="group inline-flex items-center rounded-lg bg-zinc-900 px-7 py-3.5 font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2"
        >
          {buttonText}
          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
        </Link>
      </div>
    </section>
  );
}
