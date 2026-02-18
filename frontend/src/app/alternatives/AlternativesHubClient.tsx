"use client";

import React from 'react';
import Link from 'next/link';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { ArrowRight, Repeat } from 'lucide-react';

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
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
      <Header variant="minimal" />
      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-zinc-200 dark:border-zinc-800">
          <div className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 mb-6">
              <Repeat className="w-6 h-6 text-zinc-600 dark:text-zinc-300" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 tracking-tight">
              AI Document Tool Alternatives
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
              Looking for an alternative to your current AI document tool? Browse our curated guides to find
              the best replacement based on your needs, from citation accuracy to multilingual support.
            </p>
          </div>
        </section>

        {/* Alternatives Grid */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {alternatives.map((alt) => (
              <Link
                key={alt.slug}
                href={`/alternatives/${alt.slug}`}
                className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-[box-shadow,transform] duration-200"
              >
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    {alt.name} Alternatives
                  </h2>
                  <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-[color,transform] duration-200" />
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
                  {alt.tagline}
                </p>
                <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                  {alt.count} alternatives compared
                </span>
              </Link>
            ))}
          </div>

          {/* Link to comparisons */}
          <div className="mt-16 pt-12 border-t border-zinc-200 dark:border-zinc-800 text-center">
            <p className="text-zinc-600 dark:text-zinc-400 mb-5">
              Want a head-to-head comparison between two specific tools?
            </p>
            <Link
              href="/compare"
              className="group inline-flex items-center px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2"
            >
              View Comparisons
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
