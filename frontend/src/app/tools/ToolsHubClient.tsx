"use client";

import React from 'react';
import Link from 'next/link';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import {
  LetterText,
  Clock,
  ArrowRight,
  MessageSquareText,
  FileCheck2,
  LockKeyhole,
  Sparkles,
} from 'lucide-react';

const tools = [
  {
    slug: 'word-counter',
    icon: LetterText,
    title: 'Word Counter',
    description:
      'Count words, characters, sentences, and paragraphs in any text. See reading time estimates and most frequent words.',
    meta: 'Text metrics',
  },
  {
    slug: 'reading-time',
    icon: Clock,
    title: 'Reading Time Calculator',
    description:
      'Estimate how long it takes to read or present any text. Compare slow, average, and fast reading and speaking speeds.',
    meta: 'Planning utility',
  },
];

const proofPoints = [
  { icon: LockKeyhole, label: 'Browser-only text processing' },
  { icon: FileCheck2, label: 'Built for document workflows' },
  { icon: Sparkles, label: 'Ready to hand off to AI chat' },
];

export default function ToolsHubClient() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--page-background)]">
      <Header variant="minimal" />
      <main className="flex-1">
        {/* Breadcrumb */}
        <div className="mx-auto max-w-5xl px-6 pt-6">
          <nav className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
            <Link href="/" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
              Home
            </Link>
            <span>/</span>
            <span className="text-zinc-900 dark:text-zinc-100 font-medium">Tools</span>
          </nav>
        </div>

        {/* Hero */}
        <section className="border-b border-zinc-200 dark:border-zinc-800">
          <div className="mx-auto grid max-w-5xl gap-8 px-6 py-14 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <span className="mb-4 inline-flex rounded-md bg-accent-light px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
                Free utilities
              </span>
              <h1 className="font-serif text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-4xl">
                Document tools for quick checks before deeper AI analysis.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-300">
                Count, estimate, and prepare text locally. When the work needs source-grounded answers,
                move the same document into DocTalk.
              </p>
            </div>
            <div className="grid gap-2 rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              {proofPoints.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex items-center gap-3 rounded-md bg-zinc-50 px-3 py-2.5 dark:bg-zinc-950">
                    <Icon aria-hidden="true" size={16} className="text-accent" />
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{item.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Tools Grid */}
        <section className="mx-auto max-w-5xl px-6 py-12">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Available tools</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Small utilities for repeated document prep work.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {tools.map((tool) => {
              const Icon = tool.icon;
              return (
                <Link
                  key={tool.slug}
                  href={`/tools/${tool.slug}`}
                  className="group rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 transition-colors duration-200 group-hover:border-accent/30 group-hover:bg-accent-light dark:border-zinc-800 dark:bg-zinc-950">
                      <Icon className="h-5 w-5 text-zinc-600 transition-colors duration-200 group-hover:text-accent dark:text-zinc-300" />
                    </div>
                    <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      {tool.meta}
                    </span>
                  </div>
                  <h3 className="mb-2 flex items-center justify-between text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    <span>{tool.title}</span>
                    <ArrowRight className="h-4 w-4 text-zinc-400 transition-[color,transform] duration-200 group-hover:translate-x-0.5 group-hover:text-accent" />
                  </h3>
                  <p className="mb-4 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                    {tool.description}
                  </p>
                  <span className="inline-flex items-center rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
                    No sign-up required
                  </span>
                </Link>
              );
            })}
          </div>

          {/* CTA Banner */}
          <div className="mt-12 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:flex md:items-center md:justify-between md:gap-8">
            <div className="flex gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent-light text-accent">
                <MessageSquareText className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  Need cited answers from the original file?
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                  Upload a PDF, DOCX, PPTX, or spreadsheet to ask questions and inspect citations in context.
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row md:mt-0">
              <Link
                href="/demo"
                className="group inline-flex items-center justify-center rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground shadow-sm transition-colors hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
              >
                Try the Free Demo
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/features"
                className="inline-flex items-center justify-center rounded-lg border border-zinc-200 px-5 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:border-accent hover:text-accent dark:border-zinc-700 dark:text-zinc-300"
              >
                Explore features
              </Link>
            </div>
          </div>

          {/* Related Links */}
          <div className="mt-12 pt-8 border-t border-zinc-200 dark:border-zinc-800">
            <div className="flex flex-wrap gap-3 text-sm justify-center">
              <Link href="/features/multi-format" className="text-accent hover:underline">
                Multi-Format Support
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <Link href="/features/citations" className="text-accent hover:underline">
                Citation Highlighting
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <Link href="/use-cases/students" className="text-accent hover:underline">
                For Students
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <Link href="/pricing" className="text-accent hover:underline">
                Pricing
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
