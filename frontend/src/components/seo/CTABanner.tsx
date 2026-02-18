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
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 dark:from-zinc-50 dark:via-zinc-100 dark:to-zinc-200" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent" />
        <div className="relative max-w-4xl mx-auto px-6 py-20 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white dark:text-zinc-900 mb-4 tracking-tight">
            {title}
          </h2>
          {description && (
            <p className="text-zinc-400 dark:text-zinc-600 mb-8 max-w-2xl mx-auto text-[15px]">
              {description}
            </p>
          )}
          <Link
            href={href}
            className="group inline-flex items-center px-7 py-3.5 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 rounded-lg font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
          >
            {buttonText}
            <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-zinc-50 dark:bg-zinc-900/50 border-y border-zinc-200 dark:border-zinc-800">
      <div className="max-w-4xl mx-auto px-6 py-16 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 tracking-tight">
          {title}
        </h2>
        {description && (
          <p className="text-zinc-600 dark:text-zinc-400 mb-8 max-w-2xl mx-auto text-[15px]">
            {description}
          </p>
        )}
        <Link
          href={href}
          className="group inline-flex items-center px-7 py-3.5 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2"
        >
          {buttonText}
          <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </section>
  );
}
