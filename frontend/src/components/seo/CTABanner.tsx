"use client";

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

interface CTABannerProps {
  title: string;
  description?: string;
  buttonText: string;
  href: string;
}

export default function CTABanner({ title, description, buttonText, href }: CTABannerProps) {
  return (
    <section className="bg-zinc-50 dark:bg-zinc-900/50">
      <div className="max-w-4xl mx-auto px-6 py-16 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
          {title}
        </h2>
        {description && (
          <p className="text-zinc-500 dark:text-zinc-400 mb-8 max-w-2xl mx-auto">
            {description}
          </p>
        )}
        <Link
          href={href}
          className="inline-flex items-center px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
        >
          {buttonText}
          <ArrowRight className="ml-2 w-4 h-4" />
        </Link>
      </div>
    </section>
  );
}
