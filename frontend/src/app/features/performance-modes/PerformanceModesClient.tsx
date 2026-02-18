"use client";

import React from 'react';
import Link from 'next/link';
import Header from '../../../components/Header';
import Footer from '../../../components/Footer';
import {
  Gauge,
  Zap,
  Scale,
  SearchCode,
  ArrowRight,
} from 'lucide-react';

const modes = [
  {
    icon: Zap,
    name: 'Quick',
    model: 'DeepSeek V3.2',
    credits: 2,
    speed: 'Fastest',
    description:
      'Optimized for speed and efficiency. Get concise answers to straightforward questions in seconds. Best for factual lookups, simple summaries, and quick checks when you know exactly what you are looking for.',
    bestFor: [
      'Factual lookups and definitions',
      'Quick summaries of short sections',
      'Yes/no questions with clear answers',
      'Rapid document scanning',
    ],
    availability: 'All plans (Free, Plus, Pro)',
  },
  {
    icon: Scale,
    name: 'Balanced',
    model: 'Mistral Medium 3.1',
    credits: 8,
    speed: 'Moderate',
    description:
      'The everyday workhorse. Balanced mode delivers detailed, well-structured answers that cover nuance and context. Good for most document analysis tasks where you want a thorough answer without the premium cost.',
    bestFor: [
      'General Q&A about document content',
      'Multi-paragraph explanations',
      'Comparing sections or data points',
      'Everyday research tasks',
    ],
    availability: 'All plans (Free, Plus, Pro)',
  },
  {
    icon: SearchCode,
    name: 'Thorough',
    model: 'Mistral Large 2512',
    credits: 24,
    speed: 'Deepest',
    description:
      'Maximum depth and reasoning. Thorough mode uses the most capable model available for complex, multi-part questions that require synthesizing information from across the document. Best for professional analysis.',
    bestFor: [
      'Complex multi-part questions',
      'Synthesizing across document sections',
      'Legal and financial analysis',
      'Academic deep-dives',
    ],
    availability: 'Plus and Pro plans only',
  },
];

export default function PerformanceModesClient() {
  return (
    <>
      <Header variant="minimal" />
      <main className="min-h-screen">
        {/* Hero */}
        <section className="bg-white dark:bg-zinc-950">
          <div className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-sm text-zinc-600 dark:text-zinc-400 mb-6">
              <Gauge className="w-4 h-4" />
              3 Modes
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-zinc-900 dark:text-zinc-100 mb-6 leading-tight">
              Choose Your AI Performance Mode
            </h1>
            <p className="text-lg text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto mb-8">
              Not every question needs the same depth. DocTalk offers three AI performance modes so
              you can balance speed, quality, and cost for every question. Switch modes anytime,
              even mid-conversation.
            </p>
            <Link
              href="/demo"
              className="inline-flex items-center px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
            >
              Try It Free
              <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* Three Modes */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-12 text-center">
              Three Modes, Three Purposes
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {modes.map((mode) => {
                const Icon = mode.icon;
                return (
                  <div
                    key={mode.name}
                    className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
                      </div>
                      <div>
                        <h3 className="font-bold text-zinc-900 dark:text-zinc-100">
                          {mode.name}
                        </h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {mode.model}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 mb-4">
                      <span className="inline-flex items-center px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        {mode.credits} credits
                      </span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {mode.speed}
                      </span>
                    </div>

                    <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed mb-4">
                      {mode.description}
                    </p>

                    <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
                      <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                        Best for:
                      </p>
                      <ul className="space-y-1">
                        {mode.bestFor.map((item, j) => (
                          <li key={j} className="text-xs text-zinc-500 dark:text-zinc-400 flex items-start gap-1.5">
                            <span className="text-zinc-400 dark:text-zinc-600 mt-0.5">&#x2022;</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                      <p className="text-xs text-zinc-400 dark:text-zinc-500">
                        {mode.availability}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* When to Use Each */}
        <section className="bg-white dark:bg-zinc-950">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
              When to Use Each Mode
            </h2>
            <div className="space-y-4 text-zinc-500 dark:text-zinc-400 leading-relaxed">
              <p>
                <strong className="text-zinc-900 dark:text-zinc-100">Quick mode</strong> is your
                default for straightforward questions. Need to find a specific date, definition, or
                data point? Quick mode finds it in seconds at just 2 credits. It is fast enough for
                rapid-fire questions when you are scanning a document for specific information.
              </p>
              <p>
                <strong className="text-zinc-900 dark:text-zinc-100">Balanced mode</strong> is what
                most people use most of the time. When you want a detailed explanation, a summary
                with context, or an answer that connects multiple sections of the document, Balanced
                delivers at 8 credits per question. It provides the depth of a thorough reading
                without the premium cost.
              </p>
              <p>
                <strong className="text-zinc-900 dark:text-zinc-100">Thorough mode</strong> is for
                high-stakes analysis. Complex legal questions, multi-factor financial analysis, or
                academic research where you need the AI to reason carefully across many parts of
                the document. At 24 credits, it uses the most capable model to deliver comprehensive,
                nuanced answers. Available on Plus and Pro plans.
              </p>
              <p>
                You can switch modes between questions in the same conversation. Start with Quick to
                get your bearings, then switch to Balanced or Thorough when you hit a complex topic.
                Each question is charged independently based on the mode used.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-10 text-center">
              Frequently Asked Questions
            </h2>

            <div className="space-y-6 max-w-3xl mx-auto">
              {[
                {
                  q: 'What is the difference between the three modes?',
                  a: 'Quick (2 credits) uses DeepSeek V3.2 for fast, concise answers. Balanced (8 credits) uses Mistral Medium 3.1 for detailed everyday analysis. Thorough (24 credits) uses Mistral Large 2512 for deep, complex reasoning. Each uses a different AI model optimized for its purpose.',
                },
                {
                  q: 'Can I switch modes during a conversation?',
                  a: 'Yes. The mode selector in the header lets you switch at any time. Each message is charged based on the mode used for that specific question, so you can mix and match freely.',
                },
                {
                  q: 'Is Thorough mode available on the free plan?',
                  a: 'No. Thorough mode requires a Plus ($9.99/month) or Pro ($19.99/month) subscription. Free accounts can use Quick and Balanced modes with 500 credits per month.',
                },
                {
                  q: 'Which mode should I use?',
                  a: 'Start with Quick for simple lookups and factual questions. Use Balanced for general Q&A and explanations. Reserve Thorough for complex analysis, multi-part questions, and professional work where maximum accuracy matters.',
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-6"
                >
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                    {item.q}
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    {item.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-white dark:bg-zinc-950">
          <div className="max-w-4xl mx-auto px-6 py-16 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              Try All Three Modes
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto mb-8">
              The free demo uses Quick mode. Sign up free to access Balanced mode with 500
              credits per month, or upgrade to Plus for Thorough mode.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/demo"
                className="inline-flex items-center px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
              >
                Try the Free Demo
                <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
              <Link
                href="/billing"
                className="inline-flex items-center px-6 py-3 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                View Pricing
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4 text-sm">
              <Link href="/billing" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                Pricing
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <Link href="/features/citations" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                Citation Highlighting
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <Link href="/demo" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                Free Demo
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
