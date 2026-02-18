"use client";

import React from 'react';
import Link from 'next/link';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { ArrowRight } from 'lucide-react';

const alternatives = [
  {
    slug: 'chatpdf',
    name: 'ChatPDF',
    tagline: '7 best ChatPDF alternatives including multi-format tools, citation systems, and free options.',
    count: 7,
  },
  {
    slug: 'notebooklm',
    name: 'NotebookLM',
    tagline: '6 best NotebookLM alternatives for document analysis without Google lock-in.',
    count: 6,
  },
  {
    slug: 'humata',
    name: 'Humata',
    tagline: '5 best Humata AI alternatives with better pricing, citations, and language support.',
    count: 5,
  },
];

export default function AlternativesHubClient() {
  return (
    <>
      <Header variant="minimal" />
      <main className="min-h-screen bg-white dark:bg-zinc-950">
        {/* Hero */}
        <section className="max-w-4xl mx-auto px-6 pt-20 pb-12 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
            AI Document Tool Alternatives
          </h1>
          <p className="text-lg text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto">
            Looking for an alternative to your current AI document tool? Browse our curated guides to find
            the best replacement based on your needs, from citation accuracy to multilingual support.
          </p>
        </section>

        {/* Alternatives Grid */}
        <section className="max-w-4xl mx-auto px-6 pb-20">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {alternatives.map((alt) => (
              <Link
                key={alt.slug}
                href={`/alternatives/${alt.slug}`}
                className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    {alt.name} Alternatives
                  </h2>
                  <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors" />
                </div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
                  {alt.tagline}
                </p>
                <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
                  {alt.count} alternatives compared
                </span>
              </Link>
            ))}
          </div>

          {/* Link to comparisons */}
          <div className="mt-12 text-center">
            <p className="text-zinc-500 dark:text-zinc-400 mb-4">
              Want a head-to-head comparison between two specific tools?
            </p>
            <Link
              href="/compare"
              className="inline-flex items-center px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
            >
              View Comparisons
              <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
