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
  Briefcase,
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
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
      <Header variant="minimal" />
      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-zinc-200 dark:border-zinc-800">
          <div className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 mb-6">
              <Briefcase className="w-6 h-6 text-zinc-600 dark:text-zinc-300" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 tracking-tight">
              AI Document Analysis for Every Profession
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
              From academic research to legal due diligence, DocTalk helps professionals
              across industries analyze documents faster with AI-powered answers backed by
              verifiable source citations.
            </p>
          </div>
        </section>

        {/* Use Case Grid */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {useCases.map((uc) => {
              const Icon = uc.icon;
              return (
                <Link
                  key={uc.slug}
                  href={`/use-cases/${uc.slug}`}
                  className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-[box-shadow,transform] duration-200"
                >
                  <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/30 transition-colors duration-200">
                    <Icon className="w-5 h-5 text-zinc-600 dark:text-zinc-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-200" />
                  </div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2 flex items-center justify-between">
                    <span>{uc.title}</span>
                    <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-[color,transform] duration-200" />
                  </h2>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {uc.description}
                  </p>
                </Link>
              );
            })}
          </div>

          {/* CTA */}
          <div className="mt-16 pt-12 border-t border-zinc-200 dark:border-zinc-800 text-center">
            <p className="text-zinc-600 dark:text-zinc-400 mb-5">
              See DocTalk in action — try the free demo with sample documents, no signup required.
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
