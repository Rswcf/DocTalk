"use client";

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import Header from '../../../components/Header';
import Footer from '../../../components/Footer';
import { Clock, ArrowRight, BookOpen, Mic, Trash2 } from 'lucide-react';

/* ---------- helpers ---------- */

function getWordCount(text: string): number {
  return (text.match(/[\p{L}\p{N}]+(?:[-']\p{L}+)*/gu) ?? []).length;
}

function formatDuration(minutes: number): string {
  if (minutes === 0) return '0 min';
  if (minutes < 1) return '< 1 min';
  const h = Math.floor(minutes / 60);
  const m = Math.ceil(minutes % 60);
  if (h === 0) return `${m} min`;
  return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
}

function formatSeconds(minutes: number): string {
  const totalSec = Math.ceil(minutes * 60);
  if (totalSec === 0) return '0 sec';
  if (totalSec < 60) return `${totalSec} sec`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m < 60) {
    return s > 0 ? `${m} min ${s} sec` : `${m} min`;
  }
  const h = Math.floor(m / 60);
  const rm = m % 60;
  const parts = [`${h} hr`];
  if (rm > 0) parts.push(`${rm} min`);
  if (s > 0) parts.push(`${s} sec`);
  return parts.join(' ');
}

/* ---------- types ---------- */

interface SpeedRow {
  label: string;
  wpm: number;
  minutes: number;
}

/* ---------- component ---------- */

export default function ReadingTimeClient() {
  const [text, setText] = useState('');

  const wordCount = useMemo(() => getWordCount(text), [text]);

  const readingSpeeds: SpeedRow[] = useMemo(
    () => [
      { label: 'Slow reader', wpm: 150, minutes: wordCount / 150 },
      { label: 'Average reader', wpm: 250, minutes: wordCount / 250 },
      { label: 'Fast reader', wpm: 350, minutes: wordCount / 350 },
    ],
    [wordCount],
  );

  const speakingSpeeds: SpeedRow[] = useMemo(
    () => [
      { label: 'Slow (deliberate)', wpm: 120, minutes: wordCount / 120 },
      { label: 'Average (conversational)', wpm: 150, minutes: wordCount / 150 },
      { label: 'Fast (energetic)', wpm: 180, minutes: wordCount / 180 },
    ],
    [wordCount],
  );

  /* For the comparison table: common document lengths */
  const referenceTable = [
    { type: 'Email', words: 200, icon: '✉' },
    { type: 'Blog Post', words: 1500, icon: '📝' },
    { type: 'News Article', words: 800, icon: '📰' },
    { type: 'Research Paper', words: 5000, icon: '📄' },
    { type: 'Thesis Chapter', words: 10000, icon: '📚' },
    { type: 'Novel', words: 80000, icon: '📖' },
  ];

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
            <Link href="/tools" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
              Tools
            </Link>
            <span>/</span>
            <span className="text-zinc-900 dark:text-zinc-100 font-medium">Reading Time Calculator</span>
          </nav>
        </div>

        {/* Hero */}
        <section className="border-b border-zinc-200 dark:border-zinc-800">
          <div className="max-w-4xl mx-auto px-6 pt-12 pb-12 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 mb-5">
              <Clock className="w-6 h-6 text-zinc-600 dark:text-zinc-300" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-3 tracking-tight">
              Reading Time Calculator
            </h1>
            <p className="text-base text-zinc-600 dark:text-zinc-300 max-w-xl mx-auto">
              Estimate how long it takes to read or present any text.
              Compare speeds for reading silently and speaking aloud.
            </p>
          </div>
        </section>

        {/* Main Tool */}
        <section className="max-w-4xl mx-auto px-6 py-10">
          {/* Text Input */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="reading-time-input"
                className="text-sm font-medium text-zinc-700 dark:text-zinc-200"
              >
                Paste your text below
              </label>
              {text.length > 0 && (
                <button
                  onClick={() => setText('')}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors rounded"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear
                </button>
              )}
            </div>
            <textarea
              id="reading-time-input"
              className="w-full h-48 sm:h-56 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
              placeholder="Type or paste your text here to estimate reading and speaking times..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
            />
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                Processed in your browser. Nothing is uploaded.
              </p>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200 tabular-nums">
                {wordCount.toLocaleString()} {wordCount === 1 ? 'word' : 'words'}
              </p>
            </div>
          </div>

          {/* Results Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            {/* Reading Time */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Reading Time (Silent)
                </h2>
              </div>
              <div className="space-y-4">
                {readingSpeeds.map((row) => (
                  <div key={row.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-zinc-500 dark:text-zinc-400">
                        {row.label}
                      </span>
                      <span className="text-xs text-zinc-400 dark:text-zinc-500 tabular-nums">
                        {row.wpm} WPM
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 dark:bg-indigo-400 rounded-full transition-[width] duration-300"
                          style={{
                            width: wordCount > 0
                              ? `${Math.min(100, (row.wpm / 350) * 100)}%`
                              : '0%',
                          }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums min-w-[5rem] text-right">
                        {wordCount > 0 ? formatDuration(row.minutes) : '--'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Speaking Time */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Mic className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Speaking Time (Presentations)
                </h2>
              </div>
              <div className="space-y-4">
                {speakingSpeeds.map((row) => (
                  <div key={row.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-zinc-500 dark:text-zinc-400">
                        {row.label}
                      </span>
                      <span className="text-xs text-zinc-400 dark:text-zinc-500 tabular-nums">
                        {row.wpm} WPM
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 dark:bg-emerald-400 rounded-full transition-[width] duration-300"
                          style={{
                            width: wordCount > 0
                              ? `${Math.min(100, (row.wpm / 180) * 100)}%`
                              : '0%',
                          }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums min-w-[5rem] text-right">
                        {wordCount > 0 ? formatSeconds(row.minutes) : '--'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Comparison Reference Table */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5 mb-10">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              Reading Time Reference by Document Type
            </h2>
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800">
                    <th className="text-left py-2 px-2 font-medium text-zinc-500 dark:text-zinc-400">
                      Document Type
                    </th>
                    <th className="text-right py-2 px-2 font-medium text-zinc-500 dark:text-zinc-400">
                      Typical Words
                    </th>
                    <th className="text-right py-2 px-2 font-medium text-zinc-500 dark:text-zinc-400">
                      Reading Time
                    </th>
                    <th className="text-right py-2 px-2 font-medium text-zinc-500 dark:text-zinc-400">
                      Speaking Time
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {referenceTable.map((row) => (
                    <tr
                      key={row.type}
                      className="border-b border-zinc-50 dark:border-zinc-800/50 last:border-0"
                    >
                      <td className="py-2.5 px-2 text-zinc-700 dark:text-zinc-300">
                        <span className="mr-2">{row.icon}</span>
                        {row.type}
                      </td>
                      <td className="py-2.5 px-2 text-right text-zinc-600 dark:text-zinc-400 tabular-nums">
                        ~{row.words.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-2 text-right text-zinc-900 dark:text-zinc-100 font-medium tabular-nums">
                        {formatDuration(row.words / 250)}
                      </td>
                      <td className="py-2.5 px-2 text-right text-zinc-900 dark:text-zinc-100 font-medium tabular-nums">
                        {formatDuration(row.words / 150)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* DocTalk CTA */}
          <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-indigo-950/20 p-6">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              Have a PDF or document to analyze?
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-4">
              Upload your PDF, DOCX, or PPTX to DocTalk and ask AI any question about it.
              Get instant summaries, key takeaways, and cited answers &mdash; no copy-pasting needed.
            </p>
            <Link
              href="/demo"
              className="group inline-flex items-center px-5 py-2.5 bg-indigo-600 text-white text-sm rounded-lg font-medium hover:bg-indigo-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              Try DocTalk Free
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {/* SEO Content */}
          <div className="mt-16 pt-10 border-t border-zinc-200 dark:border-zinc-800">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              How This Reading Time Calculator Works
            </h2>
            <div className="prose prose-zinc dark:prose-invert prose-sm max-w-none">
              <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
                This tool counts the words in your text and divides by standard words-per-minute (WPM) rates
                to estimate reading and speaking times. The average adult reads silently at about
                <strong> 250 words per minute</strong>, while comfortable speaking speed for
                presentations is around <strong>150 WPM</strong>.
              </p>
              <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mt-3">
                <strong>Reading speeds</strong> vary by individual and content complexity.
                Technical or academic text may slow readers to 150 WPM, while light fiction
                can be read at 350+ WPM. The three speed tiers give you a realistic range.
              </p>
              <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mt-3">
                <strong>Speaking times</strong> are useful for planning presentations, speeches,
                and podcasts. A deliberate pace (120 WPM) works well for formal talks,
                while 180 WPM suits energetic, fast-paced delivery.
              </p>
              <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mt-3">
                Everything runs locally in your browser &mdash; your text is never sent to any server.
                For full document analysis with AI-powered Q&A,{' '}
                <Link href="/demo" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                  try DocTalk&apos;s free demo
                </Link>.
              </p>
            </div>
          </div>

          {/* Related Links */}
          <div className="mt-10 pt-8 border-t border-zinc-200 dark:border-zinc-800">
            <div className="flex flex-wrap gap-3 text-sm justify-center">
              <Link href="/tools" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                All Tools
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <Link href="/tools/word-counter" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                Word Counter
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <Link href="/features/multi-format" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                Multi-Format Support
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
    </div>
  );
}
