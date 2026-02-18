"use client";

import React from 'react';
import Link from 'next/link';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { ArrowRight, GitCompareArrows } from 'lucide-react';

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
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
      <Header variant="minimal" />
      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-zinc-200 dark:border-zinc-800">
          <div className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 mb-6">
              <GitCompareArrows className="w-6 h-6 text-zinc-600 dark:text-zinc-300" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 tracking-tight">
              AI Document Tool Comparisons
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
              Honest, feature-by-feature comparisons between DocTalk and other popular AI document tools.
              See how each tool handles format support, citations, pricing, and more.
            </p>
          </div>
        </section>

        {/* Comparison Grid */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {comparisons.map((c) => (
              <Link
                key={c.slug}
                href={`/compare/${c.slug}`}
                className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-[box-shadow,transform] duration-200"
              >
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2 flex items-center justify-between">
                  <span>DocTalk vs {c.name}</span>
                  <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-[color,transform] duration-200" />
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {c.tagline}
                </p>
              </Link>
            ))}
          </div>

          {/* Link to alternatives */}
          <div className="mt-16 pt-12 border-t border-zinc-200 dark:border-zinc-800 text-center">
            <p className="text-zinc-600 dark:text-zinc-400 mb-5">
              Looking for a list of alternatives to a specific tool?
            </p>
            <Link
              href="/alternatives"
              className="group inline-flex items-center px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2"
            >
              Browse Alternatives
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
