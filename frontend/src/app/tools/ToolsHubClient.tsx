"use client";

import React from 'react';
import Link from 'next/link';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import {
  Wrench,
  LetterText,
  Clock,
  ArrowRight,
  MessageSquareText,
} from 'lucide-react';

const tools = [
  {
    slug: 'word-counter',
    icon: LetterText,
    title: 'Word Counter',
    description:
      'Count words, characters, sentences, and paragraphs in any text. See reading time estimates and most frequent words.',
    keywords: 'word counter, character counter, pdf word count',
  },
  {
    slug: 'reading-time',
    icon: Clock,
    title: 'Reading Time Calculator',
    description:
      'Estimate how long it takes to read or present any text. Compare slow, average, and fast reading and speaking speeds.',
    keywords: 'reading time calculator, how long to read, speaking time',
  },
];

export default function ToolsHubClient() {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
      <Header variant="minimal" />
      <main className="flex-1">
        {/* Breadcrumb */}
        <div className="max-w-4xl mx-auto px-6 pt-6">
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
          <div className="max-w-4xl mx-auto px-6 pt-16 pb-16 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 mb-6">
              <Wrench className="w-6 h-6 text-zinc-600 dark:text-zinc-300" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 tracking-tight">
              Free AI Document Tools
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-300 max-w-2xl mx-auto">
              Simple, fast, and free utilities for working with text and documents.
              No sign-up required &mdash; everything runs in your browser.
            </p>
          </div>
        </section>

        {/* Tools Grid */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {tools.map((tool) => {
              const Icon = tool.icon;
              return (
                <Link
                  key={tool.slug}
                  href={`/tools/${tool.slug}`}
                  className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-[box-shadow,transform] duration-200"
                >
                  <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/30 transition-colors duration-200">
                    <Icon className="w-5 h-5 text-zinc-600 dark:text-zinc-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-200" />
                  </div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2 flex items-center justify-between">
                    <span>{tool.title}</span>
                    <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-[color,transform] duration-200" />
                  </h2>
                  <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed mb-3">
                    {tool.description}
                  </p>
                  <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400">
                    100% Free
                  </span>
                </Link>
              );
            })}
          </div>

          {/* CTA Banner */}
          <div className="mt-16 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 p-8 text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/40 mb-4">
              <MessageSquareText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              Need More Than Simple Tools?
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 max-w-lg mx-auto mb-6">
              Upload any PDF, DOCX, or PPTX to DocTalk and ask AI questions about your document.
              Get instant answers with source citations that highlight right in the original text.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/demo"
                className="group inline-flex items-center px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              >
                Try the Free Demo
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                href="/features"
                className="inline-flex items-center px-6 py-3 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              >
                Explore All Features
              </Link>
            </div>
          </div>

          {/* Related Links */}
          <div className="mt-12 pt-8 border-t border-zinc-200 dark:border-zinc-800">
            <div className="flex flex-wrap gap-3 text-sm justify-center">
              <Link href="/features/multi-format" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                Multi-Format Support
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <Link href="/features/citations" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                Citation Highlighting
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <Link href="/use-cases/students" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                For Students
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <Link href="/pricing" className="text-indigo-600 dark:text-indigo-400 hover:underline">
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
