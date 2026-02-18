"use client";

import React from 'react';
import Link from 'next/link';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { ArrowRight } from 'lucide-react';

const comparisons = [
  {
    slug: 'chatpdf',
    name: 'ChatPDF',
    tagline: '7 formats vs PDF-only. Real-time citation highlighting vs none.',
  },
  {
    slug: 'askyourpdf',
    name: 'AskYourPDF',
    tagline: 'Simpler UX with citation highlighting vs Chrome extension ecosystem.',
  },
  {
    slug: 'notebooklm',
    name: 'NotebookLM',
    tagline: 'Privacy-first multi-format tool vs Google-locked notebook.',
  },
  {
    slug: 'humata',
    name: 'Humata',
    tagline: 'Affordable multi-language support vs team collaboration features.',
  },
  {
    slug: 'pdf-ai',
    name: 'PDF.ai',
    tagline: '7 document formats with citations vs basic PDF chat.',
  },
];

export default function CompareHubClient() {
  return (
    <>
      <Header variant="minimal" />
      <main className="min-h-screen bg-white dark:bg-zinc-950">
        {/* Hero */}
        <section className="max-w-4xl mx-auto px-6 pt-20 pb-12 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
            AI Document Tool Comparisons
          </h1>
          <p className="text-lg text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto">
            Honest, feature-by-feature comparisons between DocTalk and other popular AI document tools.
            See how each tool handles format support, citations, pricing, and more.
          </p>
        </section>

        {/* Comparison Grid */}
        <section className="max-w-4xl mx-auto px-6 pb-20">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {comparisons.map((c) => (
              <Link
                key={c.slug}
                href={`/compare/${c.slug}`}
                className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
              >
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2 flex items-center justify-between">
                  DocTalk vs {c.name}
                  <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors" />
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {c.tagline}
                </p>
              </Link>
            ))}
          </div>

          {/* Link to alternatives */}
          <div className="mt-12 text-center">
            <p className="text-zinc-500 dark:text-zinc-400 mb-4">
              Looking for a list of alternatives to a specific tool?
            </p>
            <Link
              href="/alternatives"
              className="inline-flex items-center px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
            >
              Browse Alternatives
              <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
