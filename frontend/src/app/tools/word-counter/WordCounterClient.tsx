"use client";

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { LetterText, ClipboardPaste, Copy, Check, FileText, Timer, Trash2 } from 'lucide-react';
import MarketingShell from '../../../components/marketing/MarketingShell';
import EdPageHero from '../../../components/marketing/EdPageHero';
import EdSection from '../../../components/marketing/EdSection';
import EdProse from '../../../components/marketing/EdProse';
import EdRelatedLinks from '../../../components/marketing/EdRelatedLinks';
import EdCtaBanner from '../../../components/marketing/EdCtaBanner';

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

const sampleText = `DocTalk helps readers work through long documents without losing the source. Upload the original file, ask a question, and review answers with citations tied back to the exact passage. This makes summaries, comparisons, and follow-up research easier to verify.`;

/* ---------- editorial style helpers ---------- */

const panelStyle: React.CSSProperties = {
  border: '1px solid var(--ed-rule)',
  background: 'var(--ed-paper-2)',
  borderRadius: '3px',
  padding: '20px',
};

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
    <MarketingShell
      breadcrumb={[
        { label: 'Home', href: '/' },
        { label: 'Tools', href: '/tools' },
        { label: 'Word Counter' },
      ]}
    >
      <EdPageHero
        icon={LetterText}
        title="Free Document Word Counter"
        lede="Paste any text to instantly count words, characters, sentences, and paragraphs. See reading time estimates and your most frequently used words."
      />

      <EdSection>
        <div className="grid grid-cols-1 lg:grid-cols-3" style={{ gap: '24px' }}>
          {/* Text Input */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
              <label htmlFor="word-counter-input" className="ed-label">
                Paste your text below
              </label>
              <div className="flex items-center" style={{ gap: '14px' }}>
                <button
                  type="button"
                  onClick={() => setText(sampleText)}
                  className="inline-flex items-center"
                  style={{
                    gap: '5px',
                    fontFamily: 'var(--font-plex-mono), ui-monospace, monospace',
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--ed-signal)',
                  }}
                  title="Use sample text"
                >
                  <ClipboardPaste className="h-3.5 w-3.5" />
                  Sample
                </button>
                {text.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setText('')}
                    className="inline-flex items-center"
                    style={{
                      gap: '5px',
                      fontFamily: 'var(--font-plex-mono), ui-monospace, monospace',
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: 'var(--ed-ink-3)',
                    }}
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
              className="h-64 w-full resize-y sm:h-80"
              style={{
                border: '1px solid var(--ed-rule)',
                background: 'var(--ed-paper)',
                color: 'var(--ed-ink)',
                borderRadius: '3px',
                padding: '16px',
                fontSize: '14px',
                lineHeight: 1.7,
                outline: 'none',
              }}
              placeholder="Type or paste your text here to see word count, character count, reading time, and more..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
            />
            <p className="ed-caption" style={{ marginTop: '8px' }}>
              Your text is processed entirely in your browser. Nothing is sent to any server.
            </p>
          </div>

          {/* Stats Panel */}
          <div className="flex flex-col" style={{ gap: '16px' }}>
            {/* Core Stats */}
            <div style={panelStyle}>
              <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
                <h2 className="ed-h3">Statistics</h2>
                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={stats.wordCount === 0 && stats.charCount === 0}
                  className="inline-flex items-center disabled:cursor-not-allowed disabled:opacity-40"
                  style={{
                    gap: '5px',
                    fontFamily: 'var(--font-plex-mono), ui-monospace, monospace',
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: copied ? 'var(--ed-signal)' : 'var(--ed-ink-3)',
                  }}
                  title="Copy stats"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <dl className="flex flex-col" style={{ gap: '12px' }}>
                {[
                  { label: 'Words', value: stats.wordCount.toLocaleString() },
                  { label: 'Characters', value: stats.charCount.toLocaleString() },
                  { label: 'Characters (no spaces)', value: stats.charCountNoSpaces.toLocaleString() },
                  { label: 'Sentences', value: stats.sentenceCount.toLocaleString() },
                  { label: 'Paragraphs', value: stats.paragraphCount.toLocaleString() },
                  { label: 'Avg. word length', value: `${stats.avgWordLength.toFixed(1)} chars` },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between" style={{ gap: '12px' }}>
                    <dt className="ed-caption">{label}</dt>
                    <dd className="ed-body tabular-nums" style={{ fontWeight: 600, color: 'var(--ed-ink)' }}>
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Reading Time */}
            <div style={panelStyle}>
              <div className="flex items-center" style={{ gap: '8px', marginBottom: '12px' }}>
                <Timer aria-hidden="true" size={16} style={{ color: 'var(--ed-ink-3)' }} />
                <h2 className="ed-h3">Estimated Reading Time</h2>
              </div>
              <dl className="flex flex-col" style={{ gap: '10px' }}>
                {readingTimes.map(({ label, time }) => (
                  <div key={label} className="flex items-center justify-between" style={{ gap: '12px' }}>
                    <dt className="ed-caption">{label}</dt>
                    <dd className="ed-body tabular-nums" style={{ fontWeight: 600, color: 'var(--ed-ink)' }}>
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
          <div style={{ ...panelStyle, marginTop: '24px' }}>
            <h2 className="ed-h3" style={{ marginBottom: '16px' }}>
              Top 10 Most Frequent Words
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-5" style={{ gap: '12px' }}>
              {stats.topWords.map(({ word, freq }, i) => (
                <div
                  key={word}
                  className="ed-card flex items-center justify-between"
                  style={{ padding: '10px 12px' }}
                >
                  <span className="ed-body truncate" style={{ marginTop: 0 }}>
                    <span className="ed-caption" style={{ marginRight: '6px' }}>{i + 1}.</span>
                    {word}
                  </span>
                  <span className="ed-caption tabular-nums shrink-0" style={{ marginLeft: '8px' }}>
                    {freq}x
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3" style={{ marginTop: '24px', gap: '12px' }}>
          {[
            { icon: FileText, label: 'Content units', value: `${stats.sentenceCount} sentences` },
            { icon: LetterText, label: 'Density', value: `${stats.avgWordLength.toFixed(1)} chars / word` },
            { icon: Timer, label: 'Average read', value: stats.wordCount > 0 ? formatTime(stats.wordCount / 250) : '--' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="ed-card" style={{ padding: '16px' }}>
                <Icon aria-hidden="true" size={16} style={{ marginBottom: '12px', color: 'var(--ed-ink-3)' }} />
                <p className="ed-caption">{item.label}</p>
                <p className="ed-body" style={{ marginTop: '4px', fontWeight: 600, color: 'var(--ed-ink)' }}>
                  {item.value}
                </p>
              </div>
            );
          })}
        </div>
      </EdSection>

      <EdCtaBanner
        title="Need to analyze a PDF or DOCX file?"
        description="DocTalk lets you upload any document and ask AI questions about it. Get word counts, summaries, key insights, and cited answers — all from your original file."
        primary={{ label: 'Try DocTalk Free', href: '/demo' }}
      />

      <EdSection title="How to Use This Word Counter">
        <EdProse>
          <p>
            Simply paste or type your text into the box above. The tool instantly counts
            <strong> words</strong>, <strong>characters</strong> (with and without spaces),
            <strong> sentences</strong>, and <strong>paragraphs</strong>. It also calculates
            the average word length and estimates how long it would take to read the text
            at different speeds.
          </p>
          <p>
            The <strong>top 10 most frequent words</strong> section helps you identify
            overused terms or key themes in your writing. Common stop words
            (the, a, is, etc.) are filtered out so you see meaningful content words.
          </p>
          <p>
            This tool runs entirely in your browser — your text never leaves your device.
            It works great for essays, articles, blog posts, and any pasted text.
            For analyzing full PDF, DOCX, or PPTX files with AI,{' '}
            <Link href="/demo">try DocTalk&apos;s AI document chat</Link>.
          </p>
        </EdProse>
      </EdSection>

      <EdSection alt>
        <EdRelatedLinks
          links={[
            { href: '/tools', label: 'All Tools' },
            { href: '/tools/reading-time', label: 'Reading Time Calculator' },
            { href: '/features/multi-format', label: 'Multi-Format Support' },
            { href: '/demo', label: 'Free Demo' },
          ]}
        />
      </EdSection>
    </MarketingShell>
  );
}
