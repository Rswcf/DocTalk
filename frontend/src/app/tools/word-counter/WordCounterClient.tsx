"use client";

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import Header from '../../../components/Header';
import Footer from '../../../components/Footer';
import { LetterText, ArrowRight, Copy, Check, Trash2 } from 'lucide-react';

/* ---------- helpers ---------- */

function getWords(text: string): string[] {
  return text.match(/[\p{L}\p{N}]+(?:[-']\p{L}+)*/gu) ?? [];
}

function getSentences(text: string): number {
  const matches = text.match(/[^.!?]+[.!?]+/g);
  return matches ? matches.length : text.trim().length > 0 ? 1 : 0;
}

function getParagraphs(text: string): number {
  if (text.trim().length === 0) return 0;
  return text.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length || 1;
}

function getCharCountNoSpaces(text: string): number {
  return text.replace(/\s/g, '').length;
}

function getAverageWordLength(words: string[]): number {
  if (words.length === 0) return 0;
  const total = words.reduce((sum, w) => sum + w.length, 0);
  return total / words.length;
}

function getTopWords(words: string[], count: number): { word: string; freq: number }[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'is', 'it', 'this', 'that', 'are', 'was', 'be',
    'has', 'have', 'had', 'not', 'from', 'as', 'i', 'you', 'he', 'she',
    'we', 'they', 'my', 'your', 'his', 'her', 'its', 'our', 'their',
    'will', 'would', 'can', 'could', 'do', 'does', 'did', 'if', 'so',
    'no', 'up', 'out', 'just', 'about', 'than', 'then', 'also', 'into',
    'more', 'some', 'what', 'which', 'who', 'when', 'where', 'how',
    'all', 'each', 'every', 'both', 'few', 'most', 'other', 'been',
    'being', 'were', 'am', 'me', 'him', 'them', 'us',
  ]);
  const freq: Record<string, number> = {};
  for (const w of words) {
    const lower = w.toLowerCase();
    if (lower.length < 2 || stopWords.has(lower)) continue;
    freq[lower] = (freq[lower] || 0) + 1;
  }
  return Object.entries(freq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, count)
    .map(([word, f]) => ({ word, freq: f }));
}

function formatTime(minutes: number): string {
  if (minutes < 1) return '< 1 min';
  if (minutes < 60) return `${Math.ceil(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.ceil(minutes % 60);
  return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
}

/* ---------- component ---------- */

export default function WordCounterClient() {
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);

  const stats = useMemo(() => {
    const words = getWords(text);
    return {
      words,
      wordCount: words.length,
      charCount: text.length,
      charCountNoSpaces: getCharCountNoSpaces(text),
      sentenceCount: getSentences(text),
      paragraphCount: getParagraphs(text),
      avgWordLength: getAverageWordLength(words),
      topWords: getTopWords(words, 10),
    };
  }, [text]);

  const readingTimes = useMemo(() => {
    return [
      { label: 'Slow (150 WPM)', time: formatTime(stats.wordCount / 150) },
      { label: 'Average (250 WPM)', time: formatTime(stats.wordCount / 250) },
      { label: 'Fast (350 WPM)', time: formatTime(stats.wordCount / 350) },
    ];
  }, [stats.wordCount]);

  const handleCopy = async () => {
    const summary = [
      `Words: ${stats.wordCount}`,
      `Characters: ${stats.charCount}`,
      `Characters (no spaces): ${stats.charCountNoSpaces}`,
      `Sentences: ${stats.sentenceCount}`,
      `Paragraphs: ${stats.paragraphCount}`,
      `Avg word length: ${stats.avgWordLength.toFixed(1)} chars`,
      `Reading time (250 WPM): ${formatTime(stats.wordCount / 250)}`,
    ].join('\n');
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
            <span className="text-zinc-900 dark:text-zinc-100 font-medium">Word Counter</span>
          </nav>
        </div>

        {/* Hero */}
        <section className="border-b border-zinc-200 dark:border-zinc-800">
          <div className="max-w-4xl mx-auto px-6 pt-12 pb-12 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 mb-5">
              <LetterText className="w-6 h-6 text-zinc-600 dark:text-zinc-300" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-semibold text-zinc-900 dark:text-zinc-100 mb-3 tracking-tight">
              Free Document Word Counter
            </h1>
            <p className="text-base text-zinc-600 dark:text-zinc-300 max-w-xl mx-auto">
              Paste any text to instantly count words, characters, sentences, and paragraphs.
              See reading time estimates and your most frequently used words.
            </p>
          </div>
        </section>

        {/* Main Tool */}
        <section className="max-w-4xl mx-auto px-6 py-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Text Input */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="word-counter-input"
                  className="text-sm font-medium text-zinc-700 dark:text-zinc-200"
                >
                  Paste your text below
                </label>
                <div className="flex items-center gap-2">
                  {text.length > 0 && (
                    <button
                      onClick={() => setText('')}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors rounded"
                      title="Clear text"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <textarea
                id="word-counter-input"
                className="w-full h-64 sm:h-80 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                placeholder="Type or paste your text here to see word count, character count, reading time, and more..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                spellCheck={false}
              />
              <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
                Your text is processed entirely in your browser. Nothing is sent to any server.
              </p>
            </div>

            {/* Stats Panel */}
            <div className="space-y-4">
              {/* Core Stats */}
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Statistics
                  </h2>
                  <button
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors rounded"
                    title="Copy stats"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <dl className="space-y-3">
                  {[
                    { label: 'Words', value: stats.wordCount.toLocaleString() },
                    { label: 'Characters', value: stats.charCount.toLocaleString() },
                    { label: 'Characters (no spaces)', value: stats.charCountNoSpaces.toLocaleString() },
                    { label: 'Sentences', value: stats.sentenceCount.toLocaleString() },
                    { label: 'Paragraphs', value: stats.paragraphCount.toLocaleString() },
                    { label: 'Avg. word length', value: `${stats.avgWordLength.toFixed(1)} chars` },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between">
                      <dt className="text-sm text-zinc-500 dark:text-zinc-400">{label}</dt>
                      <dd className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* Reading Time */}
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                  Estimated Reading Time
                </h2>
                <dl className="space-y-2.5">
                  {readingTimes.map(({ label, time }) => (
                    <div key={label} className="flex items-center justify-between">
                      <dt className="text-sm text-zinc-500 dark:text-zinc-400">{label}</dt>
                      <dd className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
                        {time}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>

          {/* Top Words */}
          {stats.topWords.length > 0 && (
            <div className="mt-8 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                Top 10 Most Frequent Words
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {stats.topWords.map(({ word, freq }, i) => (
                  <div
                    key={word}
                    className="flex items-center justify-between rounded-lg bg-zinc-50 dark:bg-zinc-800 px-3 py-2"
                  >
                    <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate">
                      <span className="text-zinc-400 dark:text-zinc-500 mr-1.5">{i + 1}.</span>
                      {word}
                    </span>
                    <span className="ml-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 tabular-nums shrink-0">
                      {freq}x
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DocTalk CTA */}
          <div className="mt-10 rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-indigo-950/20 p-6">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              Need to analyze a PDF or DOCX file?
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-4">
              DocTalk lets you upload any document and ask AI questions about it.
              Get word counts, summaries, key insights, and cited answers &mdash; all from your original file.
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
              How to Use This Word Counter
            </h2>
            <div className="prose prose-zinc dark:prose-invert prose-sm max-w-none">
              <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
                Simply paste or type your text into the box above. The tool instantly counts
                <strong> words</strong>, <strong>characters</strong> (with and without spaces),
                <strong> sentences</strong>, and <strong>paragraphs</strong>. It also calculates
                the average word length and estimates how long it would take to read the text
                at different speeds.
              </p>
              <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mt-3">
                The <strong>top 10 most frequent words</strong> section helps you identify
                overused terms or key themes in your writing. Common stop words
                (the, a, is, etc.) are filtered out so you see meaningful content words.
              </p>
              <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mt-3">
                This tool runs entirely in your browser &mdash; your text never leaves your device.
                It works great for essays, articles, blog posts, and any pasted text.
                For analyzing full PDF, DOCX, or PPTX files with AI,{' '}
                <Link href="/demo" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                  try DocTalk&apos;s AI document chat
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
              <Link href="/tools/reading-time" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                Reading Time Calculator
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
