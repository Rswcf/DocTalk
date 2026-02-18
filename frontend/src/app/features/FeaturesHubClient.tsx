"use client";

import React from 'react';
import Link from 'next/link';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import {
  Quote,
  FileStack,
  Languages,
  PlayCircle,
  Gauge,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

const features = [
  {
    slug: 'citations',
    icon: Quote,
    title: 'Citation Highlighting',
    description:
      'Every AI answer includes numbered citations. Click any citation to jump to the exact source text, highlighted in your document.',
  },
  {
    slug: 'multi-format',
    icon: FileStack,
    title: 'Multi-Format Support',
    description:
      'Upload PDF, DOCX, PPTX, XLSX, TXT, Markdown, or any URL. Chat with any document format using AI.',
  },
  {
    slug: 'multilingual',
    icon: Languages,
    title: '11 Languages',
    description:
      'Chat with documents in English, Chinese, Japanese, Spanish, German, French, Korean, Portuguese, Italian, Arabic, and Hindi.',
  },
  {
    slug: 'free-demo',
    icon: PlayCircle,
    title: 'Free Demo',
    description:
      'Try AI document chat instantly. No signup, no credit card. 3 sample documents ready to explore.',
  },
  {
    slug: 'performance-modes',
    icon: Gauge,
    title: '3 Performance Modes',
    description:
      'Quick for fast answers, Balanced for everyday use, Thorough for deep analysis. Choose the right speed and depth.',
  },
];

export default function FeaturesHubClient() {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
      <Header variant="minimal" />
      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-zinc-200 dark:border-zinc-800">
          <div className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 mb-6">
              <Sparkles className="w-6 h-6 text-zinc-600 dark:text-zinc-300" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 tracking-tight">
              DocTalk Features
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
              Upload any document, ask questions in natural language, and get AI-powered answers
              with source citations you can verify. Explore the features that make DocTalk
              the most transparent AI document tool.
            </p>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <Link
                  key={f.slug}
                  href={`/features/${f.slug}`}
                  className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-[box-shadow,transform] duration-200"
                >
                  <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/30 transition-colors duration-200">
                    <Icon className="w-5 h-5 text-zinc-600 dark:text-zinc-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-200" />
                  </div>
                  <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-2 flex items-center justify-between">
                    <span>{f.title}</span>
                    <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-[color,transform] duration-200" />
                  </h2>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {f.description}
                  </p>
                </Link>
              );
            })}
          </div>

          {/* CTA */}
          <div className="mt-16 pt-12 border-t border-zinc-200 dark:border-zinc-800 text-center">
            <p className="text-zinc-600 dark:text-zinc-400 mb-5">
              See it all in action with the free demo — no account required.
            </p>
            <Link
              href="/demo"
              className="group inline-flex items-center px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2"
            >
              Try the Free Demo
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
