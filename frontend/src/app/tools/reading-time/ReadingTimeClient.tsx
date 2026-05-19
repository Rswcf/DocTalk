"use client";

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
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
import MarketingShell from '../../../components/marketing/MarketingShell';
import EdPageHero from '../../../components/marketing/EdPageHero';
import EdSection from '../../../components/marketing/EdSection';
import EdProse from '../../../components/marketing/EdProse';
import EdRelatedLinks from '../../../components/marketing/EdRelatedLinks';
import EdCtaBanner from '../../../components/marketing/EdCtaBanner';

const monoBtnBase: React.CSSProperties = {
  gap: '5px',
  fontFamily: 'var(--font-plex-mono), ui-monospace, monospace',
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
};

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

/* ---------- editorial style helpers ---------- */

const panelStyle: React.CSSProperties = {
  border: '1px solid var(--ed-rule)',
  background: 'var(--ed-paper-2)',
  borderRadius: '3px',
  padding: '20px',
};

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
    <MarketingShell
      breadcrumb={[
        { label: 'Home', href: '/' },
        { label: 'Tools', href: '/tools' },
        { label: 'Reading Time Calculator' },
      ]}
    >
      <EdPageHero
        icon={Clock}
        title="Reading Time Calculator"
        lede="Estimate how long it takes to read or present any text. Compare speeds for reading silently and speaking aloud."
      />

      <EdSection>
        {/* Text Input */}
        <div style={{ marginBottom: '32px' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '8px', gap: '12px' }}>
            <label htmlFor="reading-time-input" className="ed-label">
              Paste your text below
            </label>
            <div className="flex items-center" style={{ gap: '14px' }}>
              {text.length > 0 && (
                <button
                  type="button"
                  onClick={() => setText('')}
                  className="inline-flex items-center"
                  title="Clear text"
                  style={{ ...monoBtnBase, color: 'var(--ed-ink-3)' }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => setText(sampleText)}
                className="inline-flex items-center"
                title="Use sample text"
                style={{ ...monoBtnBase, color: 'var(--ed-signal)' }}
              >
                <ClipboardPaste className="h-3.5 w-3.5" />
                Sample
              </button>
            </div>
          </div>
          <textarea
            id="reading-time-input"
            className="h-48 w-full resize-y sm:h-56"
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
            placeholder="Type or paste your text here to estimate reading and speaking times..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
          />
          <div className="flex items-center justify-between" style={{ marginTop: '8px', gap: '12px' }}>
            <p className="ed-caption">Processed in your browser. Nothing is uploaded.</p>
            <p className="ed-body tabular-nums" style={{ marginTop: 0, fontWeight: 600, color: 'var(--ed-ink)' }}>
              {wordCount.toLocaleString()} {wordCount === 1 ? 'word' : 'words'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3" style={{ marginBottom: '32px', gap: '12px' }}>
          {[
            { label: 'Words', value: wordCount.toLocaleString() },
            { label: 'Average reading', value: wordCount > 0 ? formatDuration(wordCount / 250) : '--' },
            { label: 'Average speaking', value: wordCount > 0 ? formatSeconds(wordCount / 150) : '--' },
          ].map((item) => (
            <div key={item.label} className="ed-card" style={{ padding: '16px' }}>
              <p className="ed-caption">{item.label}</p>
              <p
                className="tabular-nums"
                style={{
                  marginTop: '8px',
                  fontFamily: 'var(--font-newsreader), serif',
                  fontSize: '26px',
                  fontWeight: 600,
                  color: 'var(--ed-ink)',
                }}
              >
                {item.value}
              </p>
            </div>
          ))}
        </div>

        {/* Results Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '24px' }}>
          {/* Reading Time */}
          <div style={panelStyle}>
            <div className="flex items-center" style={{ gap: '8px', marginBottom: '16px' }}>
              <BookOpen aria-hidden="true" className="w-4 h-4" style={{ color: 'var(--ed-ink-3)' }} />
              <h2 className="ed-h3">Reading Time (Silent)</h2>
            </div>
            <div className="flex flex-col" style={{ gap: '16px' }}>
              {readingSpeeds.map((row) => (
                <div key={row.label}>
                  <div className="flex items-center justify-between" style={{ marginBottom: '4px', gap: '12px' }}>
                    <span className="ed-caption">{row.label}</span>
                    <span className="ed-caption tabular-nums">{row.wpm} WPM</span>
                  </div>
                  <div className="flex items-center" style={{ gap: '12px' }}>
                    <div
                      className="flex-1 overflow-hidden"
                      style={{ height: '6px', background: 'var(--ed-rule)', borderRadius: '3px' }}
                    >
                      <div
                        style={{
                          height: '100%',
                          borderRadius: '3px',
                          background: 'var(--ed-signal)',
                          transition: 'width 300ms',
                          width: wordCount > 0
                            ? `${Math.min(100, (row.wpm / 350) * 100)}%`
                            : '0%',
                        }}
                      />
                    </div>
                    <span
                      className="ed-body tabular-nums text-right"
                      style={{ marginTop: 0, fontWeight: 600, color: 'var(--ed-ink)', minWidth: '5rem' }}
                    >
                      {wordCount > 0 ? formatDuration(row.minutes) : '--'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Speaking Time */}
          <div style={panelStyle}>
            <div className="flex items-center" style={{ gap: '8px', marginBottom: '16px' }}>
              <Mic aria-hidden="true" className="w-4 h-4" style={{ color: 'var(--ed-ink-3)' }} />
              <h2 className="ed-h3">Speaking Time (Presentations)</h2>
            </div>
            <div className="flex flex-col" style={{ gap: '16px' }}>
              {speakingSpeeds.map((row) => (
                <div key={row.label}>
                  <div className="flex items-center justify-between" style={{ marginBottom: '4px', gap: '12px' }}>
                    <span className="ed-caption">{row.label}</span>
                    <span className="ed-caption tabular-nums">{row.wpm} WPM</span>
                  </div>
                  <div className="flex items-center" style={{ gap: '12px' }}>
                    <div
                      className="flex-1 overflow-hidden"
                      style={{ height: '6px', background: 'var(--ed-rule)', borderRadius: '3px' }}
                    >
                      <div
                        style={{
                          height: '100%',
                          borderRadius: '3px',
                          background: 'var(--ed-ochre)',
                          transition: 'width 300ms',
                          width: wordCount > 0
                            ? `${Math.min(100, (row.wpm / 180) * 100)}%`
                            : '0%',
                        }}
                      />
                    </div>
                    <span
                      className="ed-body tabular-nums text-right"
                      style={{ marginTop: 0, fontWeight: 600, color: 'var(--ed-ink)', minWidth: '5rem' }}
                    >
                      {wordCount > 0 ? formatSeconds(row.minutes) : '--'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Comparison Reference Table */}
        <div style={{ ...panelStyle, marginTop: '24px' }}>
          <h2 className="ed-h3" style={{ marginBottom: '16px' }}>
            Reading Time Reference by Document Type
          </h2>
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--ed-rule)' }}>
                  <th className="ed-label" style={{ textAlign: 'left', padding: '8px' }}>
                    Document Type
                  </th>
                  <th className="ed-label" style={{ textAlign: 'right', padding: '8px' }}>
                    Typical Words
                  </th>
                  <th className="ed-label" style={{ textAlign: 'right', padding: '8px' }}>
                    Reading Time
                  </th>
                  <th className="ed-label" style={{ textAlign: 'right', padding: '8px' }}>
                    Speaking Time
                  </th>
                </tr>
              </thead>
              <tbody>
                {referenceTable.map((row) => {
                  const Icon = row.icon;
                  return (
                    <tr key={row.type} style={{ borderBottom: '1px solid var(--ed-rule)' }}>
                      <td className="ed-body" style={{ marginTop: 0, padding: '10px 8px' }}>
                        <Icon aria-hidden="true" size={14} className="mr-2 inline-block" style={{ color: 'var(--ed-ink-3)' }} />
                        {row.type}
                      </td>
                      <td className="ed-body tabular-nums" style={{ marginTop: 0, padding: '10px 8px', textAlign: 'right' }}>
                        ~{row.words.toLocaleString()}
                      </td>
                      <td
                        className="ed-body tabular-nums"
                        style={{ marginTop: 0, padding: '10px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--ed-ink)' }}
                      >
                        {formatDuration(row.words / 250)}
                      </td>
                      <td
                        className="ed-body tabular-nums"
                        style={{ marginTop: 0, padding: '10px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--ed-ink)' }}
                      >
                        {formatDuration(row.words / 150)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </EdSection>

      <EdCtaBanner
        title="Have a PDF or document to analyze?"
        description="Upload your PDF, DOCX, or PPTX to DocTalk and ask AI any question about it. Get instant summaries, key takeaways, and cited answers — no copy-pasting needed."
        primary={{ label: 'Try DocTalk Free', href: '/demo' }}
      />

      <EdSection title="How This Reading Time Calculator Works">
        <EdProse>
          <p>
            This tool counts the words in your text and divides by standard words-per-minute (WPM) rates
            to estimate reading and speaking times. The average adult reads silently at about
            <strong> 250 words per minute</strong>, while comfortable speaking speed for
            presentations is around <strong>150 WPM</strong>.
          </p>
          <p>
            <strong>Reading speeds</strong> vary by individual and content complexity.
            Technical or academic text may slow readers to 150 WPM, while light fiction
            can be read at 350+ WPM. The three speed tiers give you a realistic range.
          </p>
          <p>
            <strong>Speaking times</strong> are useful for planning presentations, speeches,
            and podcasts. A deliberate pace (120 WPM) works well for formal talks,
            while 180 WPM suits energetic, fast-paced delivery.
          </p>
          <p>
            Everything runs locally in your browser — your text is never sent to any server.
            For full document analysis with AI-powered Q&amp;A,{' '}
            <Link href="/demo">try DocTalk&apos;s free demo</Link>.
          </p>
        </EdProse>
      </EdSection>

      <EdSection alt>
        <EdRelatedLinks
          links={[
            { href: '/tools', label: 'All Tools' },
            { href: '/tools/word-counter', label: 'Word Counter' },
            { href: '/features/multi-format', label: 'Multi-Format Support' },
            { href: '/demo', label: 'Free Demo' },
          ]}
        />
      </EdSection>
    </MarketingShell>
  );
}
