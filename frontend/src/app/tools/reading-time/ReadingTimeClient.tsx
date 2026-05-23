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
import { useLocale } from '../../../i18n';
import MarketingShell from '../../../components/marketing/MarketingShell';
import EdPageHero from '../../../components/marketing/EdPageHero';
import EdSection from '../../../components/marketing/EdSection';
import EdProse from '../../../components/marketing/EdProse';
import EdRelatedLinks from '../../../components/marketing/EdRelatedLinks';
import EdCtaBanner from '../../../components/marketing/EdCtaBanner';

type TFn = (key: string, params?: Record<string, string | number>) => string;

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

function formatDuration(minutes: number, t: TFn): string {
  if (minutes === 0) return t('toolReadingTime.durZeroMin');
  if (minutes < 1) return t('toolReadingTime.durLessThanMin');
  const h = Math.floor(minutes / 60);
  const m = Math.ceil(minutes % 60);
  if (h === 0) return t('toolReadingTime.durMin', { m });
  return m > 0
    ? t('toolReadingTime.durHrMin', { h, m })
    : t('toolReadingTime.durHr', { h });
}

function formatSeconds(minutes: number, t: TFn): string {
  const totalSec = Math.ceil(minutes * 60);
  if (totalSec === 0) return t('toolReadingTime.secZeroSec');
  if (totalSec < 60) return t('toolReadingTime.secSec', { s: totalSec });
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m < 60) {
    return s > 0
      ? t('toolReadingTime.secMinSec', { m, s })
      : t('toolReadingTime.secMin', { m });
  }
  const h = Math.floor(m / 60);
  const rm = m % 60;
  const parts = [t('toolReadingTime.secPartHr', { h })];
  if (rm > 0) parts.push(t('toolReadingTime.secPartMin', { m: rm }));
  if (s > 0) parts.push(t('toolReadingTime.secPartSec', { s }));
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

/* ---------- editorial style helpers ---------- */

const panelStyle: React.CSSProperties = {
  border: '1px solid var(--ed-rule)',
  background: 'var(--ed-paper-2)',
  borderRadius: '3px',
  padding: '20px',
};

/* ---------- component ---------- */

export default function ReadingTimeClient() {
  const { t } = useLocale();
  const [text, setText] = useState('');

  const sampleText = t('toolReadingTime.sampleText');

  const referenceTable: ReferenceRow[] = useMemo(
    () => [
      { type: t('toolReadingTime.refEmail'), words: 200, icon: Mail },
      { type: t('toolReadingTime.refNewsArticle'), words: 800, icon: Newspaper },
      { type: t('toolReadingTime.refBlogPost'), words: 1500, icon: FileText },
      { type: t('toolReadingTime.refResearchPaper'), words: 5000, icon: GraduationCap },
      { type: t('toolReadingTime.refThesisChapter'), words: 10000, icon: FileText },
      { type: t('toolReadingTime.refNovel'), words: 80000, icon: BookOpen },
    ],
    [t],
  );

  const wordCount = useMemo(() => getWordCount(text), [text]);

  const readingSpeeds: SpeedRow[] = useMemo(
    () => [
      { label: t('toolReadingTime.readSlow'), wpm: 150, minutes: wordCount / 150 },
      { label: t('toolReadingTime.readAverage'), wpm: 250, minutes: wordCount / 250 },
      { label: t('toolReadingTime.readFast'), wpm: 350, minutes: wordCount / 350 },
    ],
    [wordCount, t],
  );

  const speakingSpeeds: SpeedRow[] = useMemo(
    () => [
      { label: t('toolReadingTime.speakSlow'), wpm: 120, minutes: wordCount / 120 },
      { label: t('toolReadingTime.speakAverage'), wpm: 150, minutes: wordCount / 150 },
      { label: t('toolReadingTime.speakFast'), wpm: 180, minutes: wordCount / 180 },
    ],
    [wordCount, t],
  );

  return (
    <MarketingShell
      breadcrumb={[
        { label: t('toolReadingTime.breadcrumbHome'), href: '/' },
        { label: t('toolReadingTime.breadcrumbTools'), href: '/tools' },
        { label: t('toolReadingTime.breadcrumbReadingTime') },
      ]}
    >
      <EdPageHero
        icon={Clock}
        title={t('toolReadingTime.heroTitle')}
        lede={t('toolReadingTime.heroLede')}
      />

      <EdSection>
        {/* Text Input */}
        <div style={{ marginBottom: '32px' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '8px', gap: '12px' }}>
            <label htmlFor="reading-time-input" className="ed-label">
              {t('toolReadingTime.inputLabel')}
            </label>
            <div className="flex items-center" style={{ gap: '14px' }}>
              {text.length > 0 && (
                <button
                  type="button"
                  onClick={() => setText('')}
                  className="inline-flex items-center"
                  title={t('toolReadingTime.clearTitle')}
                  style={{ ...monoBtnBase, color: 'var(--ed-ink-3)' }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {t('toolReadingTime.clearButton')}
                </button>
              )}
              <button
                type="button"
                onClick={() => setText(sampleText)}
                className="inline-flex items-center"
                title={t('toolReadingTime.sampleTitle')}
                style={{ ...monoBtnBase, color: 'var(--ed-signal)' }}
              >
                <ClipboardPaste className="h-3.5 w-3.5" />
                {t('toolReadingTime.sampleButton')}
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
            placeholder={t('toolReadingTime.inputPlaceholder')}
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
          />
          <div className="flex items-center justify-between" style={{ marginTop: '8px', gap: '12px' }}>
            <p className="ed-caption">{t('toolReadingTime.privacyNote')}</p>
            <p className="ed-body tabular-nums" style={{ marginTop: 0, fontWeight: 600, color: 'var(--ed-ink)' }}>
              {wordCount === 1
                ? t('toolReadingTime.wordCountSingular', { count: wordCount.toLocaleString() })
                : t('toolReadingTime.wordCountPlural', { count: wordCount.toLocaleString() })}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3" style={{ marginBottom: '32px', gap: '12px' }}>
          {[
            { label: t('toolReadingTime.summaryWords'), value: wordCount.toLocaleString() },
            { label: t('toolReadingTime.summaryAverageReading'), value: wordCount > 0 ? formatDuration(wordCount / 250, t) : '--' },
            { label: t('toolReadingTime.summaryAverageSpeaking'), value: wordCount > 0 ? formatSeconds(wordCount / 150, t) : '--' },
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
              <h2 className="ed-h3">{t('toolReadingTime.readingTimeHeading')}</h2>
            </div>
            <div className="flex flex-col" style={{ gap: '16px' }}>
              {readingSpeeds.map((row) => (
                <div key={row.label}>
                  <div className="flex items-center justify-between" style={{ marginBottom: '4px', gap: '12px' }}>
                    <span className="ed-caption">{row.label}</span>
                    <span className="ed-caption tabular-nums">{t('toolReadingTime.wpmValue', { wpm: row.wpm })}</span>
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
                      {wordCount > 0 ? formatDuration(row.minutes, t) : '--'}
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
              <h2 className="ed-h3">{t('toolReadingTime.speakingTimeHeading')}</h2>
            </div>
            <div className="flex flex-col" style={{ gap: '16px' }}>
              {speakingSpeeds.map((row) => (
                <div key={row.label}>
                  <div className="flex items-center justify-between" style={{ marginBottom: '4px', gap: '12px' }}>
                    <span className="ed-caption">{row.label}</span>
                    <span className="ed-caption tabular-nums">{t('toolReadingTime.wpmValue', { wpm: row.wpm })}</span>
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
                      {wordCount > 0 ? formatSeconds(row.minutes, t) : '--'}
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
            {t('toolReadingTime.referenceHeading')}
          </h2>
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--ed-rule)' }}>
                  <th className="ed-label" style={{ textAlign: 'left', padding: '8px' }}>
                    {t('toolReadingTime.colDocumentType')}
                  </th>
                  <th className="ed-label" style={{ textAlign: 'right', padding: '8px' }}>
                    {t('toolReadingTime.colTypicalWords')}
                  </th>
                  <th className="ed-label" style={{ textAlign: 'right', padding: '8px' }}>
                    {t('toolReadingTime.colReadingTime')}
                  </th>
                  <th className="ed-label" style={{ textAlign: 'right', padding: '8px' }}>
                    {t('toolReadingTime.colSpeakingTime')}
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
                        {formatDuration(row.words / 250, t)}
                      </td>
                      <td
                        className="ed-body tabular-nums"
                        style={{ marginTop: 0, padding: '10px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--ed-ink)' }}
                      >
                        {formatDuration(row.words / 150, t)}
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
        title={t('toolReadingTime.ctaTitle')}
        description={t('toolReadingTime.ctaDescription')}
        primary={{ label: t('toolReadingTime.ctaPrimary'), href: '/demo' }}
      />

      <EdSection title={t('toolReadingTime.howToTitle')}>
        <EdProse>
          <p>
            {t('toolReadingTime.howToP1Lead')}
            <strong> {t('toolReadingTime.howToP1Wpm250')}</strong>{t('toolReadingTime.howToP1Mid')} <strong>{t('toolReadingTime.howToP1Wpm150')}</strong>.
          </p>
          <p>
            <strong>{t('toolReadingTime.howToP2Heading')}</strong> {t('toolReadingTime.howToP2Body')}
          </p>
          <p>
            <strong>{t('toolReadingTime.howToP3Heading')}</strong> {t('toolReadingTime.howToP3Body')}
          </p>
          <p>
            {t('toolReadingTime.howToP4Lead')}{' '}
            <Link href="/demo">{t('toolReadingTime.howToP4Link')}</Link>.
          </p>
        </EdProse>
      </EdSection>

      <EdSection alt>
        <EdRelatedLinks
          links={[
            { href: '/tools', label: t('toolReadingTime.relatedAllTools') },
            { href: '/tools/word-counter', label: t('toolReadingTime.relatedWordCounter') },
            { href: '/features/multi-format', label: t('toolReadingTime.relatedMultiFormat') },
            { href: '/demo', label: t('toolReadingTime.relatedFreeDemo') },
          ]}
        />
      </EdSection>
    </MarketingShell>
  );
}
