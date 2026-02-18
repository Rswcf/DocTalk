"use client";

import React from 'react';
import Link from 'next/link';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import {
  GraduationCap,
  Scale,
  TrendingUp,
  FileText,
  ArrowRight,
} from 'lucide-react';

const useCases = [
  {
    slug: 'students',
    icon: GraduationCap,
    title: 'Students & Academics',
    description:
      'Analyze research papers, textbooks, and dissertations with AI. Get cited answers with page-level references to speed up literature reviews and exam prep.',
  },
  {
    slug: 'lawyers',
    icon: Scale,
    title: 'Legal Professionals',
    description:
      'Review contracts, court filings, and regulatory documents with AI. Extract specific clauses, assess risk, and verify every finding against the source text.',
  },
  {
    slug: 'finance',
    icon: TrendingUp,
    title: 'Financial Analysts',
    description:
      'Analyze 10-K filings, earnings reports, and investor presentations with AI. Extract key metrics and verify figures with citations pointing to original tables.',
  },
  {
    slug: 'hr-contracts',
    icon: FileText,
    title: 'HR & Contract Review',
    description:
      'Navigate employment contracts, company handbooks, and HR policies with AI. Get instant answers about specific clauses with verifiable source citations.',
  },
];

export default function UseCasesHubClient() {
  return (
    <>
      <Header variant="minimal" />
      <main className="min-h-screen bg-white dark:bg-zinc-950">
        {/* Hero */}
        <section className="max-w-4xl mx-auto px-6 pt-20 pb-12 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
            AI Document Analysis for Every Profession
          </h1>
          <p className="text-lg text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto">
            From academic research to legal due diligence, DocTalk helps professionals
            across industries analyze documents faster with AI-powered answers backed by
            verifiable source citations.
          </p>
        </section>

        {/* Use Case Grid */}
        <section className="max-w-4xl mx-auto px-6 pb-20">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {useCases.map((uc) => {
              const Icon = uc.icon;
              return (
                <Link
                  key={uc.slug}
                  href={`/use-cases/${uc.slug}`}
                  className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
                  </div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2 flex items-center justify-between">
                    {uc.title}
                    <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors" />
                  </h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
                    {uc.description}
                  </p>
                  <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                    Learn more
                  </span>
                </Link>
              );
            })}
          </div>

          {/* CTA */}
          <div className="mt-16 text-center">
            <p className="text-zinc-500 dark:text-zinc-400 mb-4">
              See DocTalk in action — try the free demo with sample documents, no signup required.
            </p>
            <Link
              href="/demo"
              className="inline-flex items-center px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
            >
              Try the Free Demo
              <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
