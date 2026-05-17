"use client";

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import Header from '../../../components/Header';
import Footer from '../../../components/Footer';
import {
  ArrowRight,
  BookOpen,
  Clock,
  ClipboardPaste,
  FileText,
  GraduationCap,
  Mail,
  Mic,
  Newspaper,
  Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

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

interface ReferenceRow {
  type: string;
  words: number;
  icon: LucideIcon;
}

const sampleText = `DocTalk turns long documents into cited answers. Instead of copying passages into a chat window, upload the original PDF, DOCX, PPTX, spreadsheet, or text file and ask questions against the source. Each answer stays connected to the relevant passage so readers can verify claims quickly.`;

const referenceTable: ReferenceRow[] = [
  { type: 'Email', words: 200, icon: Mail },
  { type: 'News article', words: 800, icon: Newspaper },
  { type: 'Blog post', words: 1500, icon: FileText },
  { type: 'Research paper', words: 5000, icon: GraduationCap },
  { type: 'Thesis chapter', words: 10000, icon: FileText },
  { type: 'Novel', words: 80000, icon: BookOpen },
];

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

  return (
    <div className="dt-stitch-theme flex min-h-screen flex-col">
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
          <div className="max-w-4xl mx-auto px-6 pt-12 pb-12">
            <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-200 bg-white text-accent shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <Clock className="h-5 w-5" />
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-zinc-900 dark:text-zinc-100 mb-3 tracking-tight">
              Reading Time Calculator
            </h1>
            <p className="max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-300">
              Estimate how long it takes to read or present any text.
              Compare speeds for reading silently and speaking aloud.
            </p>
          </div>
        </section>

        {/* Main Tool */}
        <section className="max-w-4xl mx-auto px-6 py-10">
          {/* Text Input */}
          <div className="mb-8">
            <div className="mb-2 flex items-center justify-between gap-3">
              <label
                htmlFor="reading-time-input"
                className="text-sm font-medium text-zinc-700 dark:text-zinc-200"
              >
                Paste your text below
              </label>
              <div className="flex items-center gap-2">
                {text.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setText('')}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-500 transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setText(sampleText)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent-light"
                >
                  <ClipboardPaste className="h-3.5 w-3.5" />
                  Sample
                </button>
              </div>
            </div>
            <textarea
              id="reading-time-input"
              className="h-48 w-full resize-y rounded-lg border border-zinc-200 bg-white p-4 text-sm leading-relaxed text-zinc-900 placeholder:text-zinc-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 sm:h-56"
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

          <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { label: 'Words', value: wordCount.toLocaleString() },
              { label: 'Average reading', value: wordCount > 0 ? formatDuration(wordCount / 250) : '--' },
              { label: 'Average speaking', value: wordCount > 0 ? formatSeconds(wordCount / 150) : '--' },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Results Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            {/* Reading Time */}
            <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
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
                          className="h-full rounded-full bg-accent transition-[width] duration-300"
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
            <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
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
          <div className="mb-10 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
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
                  {referenceTable.map((row) => {
                    const Icon = row.icon;
                    return (
                      <tr
                        key={row.type}
                        className="border-b border-zinc-50 dark:border-zinc-800/50 last:border-0"
                      >
                        <td className="py-2.5 px-2 text-zinc-700 dark:text-zinc-300">
                          <Icon aria-hidden="true" size={14} className="mr-2 inline-block text-zinc-400" />
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* DocTalk CTA */}
          <div className="rounded-lg border border-accent/20 bg-accent-light/50 p-6 dark:bg-accent-light">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              Have a PDF or document to analyze?
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-4">
              Upload your PDF, DOCX, or PPTX to DocTalk and ask AI any question about it.
              Get instant summaries, key takeaways, and cited answers &mdash; no copy-pasting needed.
            </p>
            <Link
              href="/demo"
              className="group inline-flex items-center rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
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
                <Link href="/demo" className="text-accent hover:underline">
                  try DocTalk&apos;s free demo
                </Link>.
              </p>
            </div>
          </div>

          {/* Related Links */}
          <div className="mt-10 pt-8 border-t border-zinc-200 dark:border-zinc-800">
            <div className="flex flex-wrap gap-3 text-sm justify-center">
              <Link href="/tools" className="text-accent hover:underline">
                All Tools
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <Link href="/tools/word-counter" className="text-accent hover:underline">
                Word Counter
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <Link href="/features/multi-format" className="text-accent hover:underline">
                Multi-Format Support
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <Link href="/demo" className="text-accent hover:underline">
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
