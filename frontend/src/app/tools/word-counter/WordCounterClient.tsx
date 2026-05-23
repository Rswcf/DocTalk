"use client";

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { LetterText, ClipboardPaste, Copy, Check, FileText, Timer, Trash2 } from 'lucide-react';
import { useLocale } from '../../../i18n';
import MarketingShell from '../../../components/marketing/MarketingShell';
import EdPageHero from '../../../components/marketing/EdPageHero';
import EdSection from '../../../components/marketing/EdSection';
import EdProse from '../../../components/marketing/EdProse';
import EdRelatedLinks from '../../../components/marketing/EdRelatedLinks';
import EdCtaBanner from '../../../components/marketing/EdCtaBanner';

type TFn = (key: string, params?: Record<string, string | number>) => string;

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

function formatTime(minutes: number, t: TFn): string {
  if (minutes < 1) return t('toolWordCounter.timeLessThanMin');
  if (minutes < 60) return t('toolWordCounter.timeMin', { m: Math.ceil(minutes) });
  const h = Math.floor(minutes / 60);
  const m = Math.ceil(minutes % 60);
  return m > 0
    ? t('toolWordCounter.timeHrMin', { h, m })
    : t('toolWordCounter.timeHr', { h });
}

/* ---------- editorial style helpers ---------- */

const panelStyle: React.CSSProperties = {
  border: '1px solid var(--ed-rule)',
  background: 'var(--ed-paper-2)',
  borderRadius: '3px',
  padding: '20px',
};

/* ---------- component ---------- */

export default function WordCounterClient() {
  const { t } = useLocale();
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);

  const sampleText = t('toolWordCounter.sampleText');

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
      { label: t('toolWordCounter.speedSlow'), time: formatTime(stats.wordCount / 150, t) },
      { label: t('toolWordCounter.speedAverage'), time: formatTime(stats.wordCount / 250, t) },
      { label: t('toolWordCounter.speedFast'), time: formatTime(stats.wordCount / 350, t) },
    ];
  }, [stats.wordCount, t]);

  const handleCopy = async () => {
    const summary = [
      t('toolWordCounter.copyWords', { value: stats.wordCount }),
      t('toolWordCounter.copyCharacters', { value: stats.charCount }),
      t('toolWordCounter.copyCharactersNoSpaces', { value: stats.charCountNoSpaces }),
      t('toolWordCounter.copySentences', { value: stats.sentenceCount }),
      t('toolWordCounter.copyParagraphs', { value: stats.paragraphCount }),
      t('toolWordCounter.copyAvgWordLength', { value: stats.avgWordLength.toFixed(1) }),
      t('toolWordCounter.copyReadingTime', { value: formatTime(stats.wordCount / 250, t) }),
    ].join('\n');
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <MarketingShell
      breadcrumb={[
        { label: t('toolWordCounter.breadcrumbHome'), href: '/' },
        { label: t('toolWordCounter.breadcrumbTools'), href: '/tools' },
        { label: t('toolWordCounter.breadcrumbWordCounter') },
      ]}
    >
      <EdPageHero
        icon={LetterText}
        title={t('toolWordCounter.heroTitle')}
        lede={t('toolWordCounter.heroLede')}
      />

      <EdSection>
        <div className="grid grid-cols-1 lg:grid-cols-3" style={{ gap: '24px' }}>
          {/* Text Input */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
              <label htmlFor="word-counter-input" className="ed-label">
                {t('toolWordCounter.inputLabel')}
              </label>
              <div className="flex items-center" style={{ gap: '14px' }}>
                <button
                  type="button"
                  onClick={() => setText(sampleText)}
                  className="inline-flex items-center"
                  style={{
                    gap: '5px',
                    fontFamily: 'var(--dt-mono)',
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--ed-signal)',
                  }}
                  title={t('toolWordCounter.sampleTitle')}
                >
                  <ClipboardPaste className="h-3.5 w-3.5" />
                  {t('toolWordCounter.sampleButton')}
                </button>
                {text.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setText('')}
                    className="inline-flex items-center"
                    style={{
                      gap: '5px',
                      fontFamily: 'var(--dt-mono)',
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: 'var(--ed-ink-3)',
                    }}
                    title={t('toolWordCounter.clearTitle')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {t('toolWordCounter.clearButton')}
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
              placeholder={t('toolWordCounter.inputPlaceholder')}
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
            />
            <p className="ed-caption" style={{ marginTop: '8px' }}>
              {t('toolWordCounter.privacyNote')}
            </p>
          </div>

          {/* Stats Panel */}
          <div className="flex flex-col" style={{ gap: '16px' }}>
            {/* Core Stats */}
            <div style={panelStyle}>
              <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
                <h2 className="ed-h3">{t('toolWordCounter.statisticsHeading')}</h2>
                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={stats.wordCount === 0 && stats.charCount === 0}
                  className="inline-flex items-center disabled:cursor-not-allowed disabled:opacity-40"
                  style={{
                    gap: '5px',
                    fontFamily: 'var(--dt-mono)',
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: copied ? 'var(--ed-signal)' : 'var(--ed-ink-3)',
                  }}
                  title={t('toolWordCounter.copyTitle')}
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copied ? t('toolWordCounter.copiedButton') : t('toolWordCounter.copyButton')}
                </button>
              </div>
              <dl className="flex flex-col" style={{ gap: '12px' }}>
                {[
                  { label: t('toolWordCounter.statWords'), value: stats.wordCount.toLocaleString() },
                  { label: t('toolWordCounter.statCharacters'), value: stats.charCount.toLocaleString() },
                  { label: t('toolWordCounter.statCharactersNoSpaces'), value: stats.charCountNoSpaces.toLocaleString() },
                  { label: t('toolWordCounter.statSentences'), value: stats.sentenceCount.toLocaleString() },
                  { label: t('toolWordCounter.statParagraphs'), value: stats.paragraphCount.toLocaleString() },
                  { label: t('toolWordCounter.statAvgWordLength'), value: t('toolWordCounter.charsValue', { value: stats.avgWordLength.toFixed(1) }) },
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
                <h2 className="ed-h3">{t('toolWordCounter.readingTimeHeading')}</h2>
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
              {t('toolWordCounter.topWordsHeading')}
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
                    {t('toolWordCounter.frequencyValue', { count: freq })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3" style={{ marginTop: '24px', gap: '12px' }}>
          {[
            { icon: FileText, label: t('toolWordCounter.summaryContentUnits'), value: t('toolWordCounter.sentencesValue', { count: stats.sentenceCount }) },
            { icon: LetterText, label: t('toolWordCounter.summaryDensity'), value: t('toolWordCounter.charsPerWordValue', { value: stats.avgWordLength.toFixed(1) }) },
            { icon: Timer, label: t('toolWordCounter.summaryAverageRead'), value: stats.wordCount > 0 ? formatTime(stats.wordCount / 250, t) : '--' },
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
        title={t('toolWordCounter.ctaTitle')}
        description={t('toolWordCounter.ctaDescription')}
        primary={{ label: t('toolWordCounter.ctaPrimary'), href: '/demo' }}
      />

      <EdSection title={t('toolWordCounter.howToTitle')}>
        <EdProse>
          <p>
            {t('toolWordCounter.howToP1Lead')}
            <strong> {t('toolWordCounter.howToP1Words')}</strong>, <strong>{t('toolWordCounter.howToP1Characters')}</strong> {t('toolWordCounter.howToP1CharactersNote')},
            <strong> {t('toolWordCounter.howToP1Sentences')}</strong>, {t('toolWordCounter.howToP1And')} <strong>{t('toolWordCounter.howToP1Paragraphs')}</strong>. {t('toolWordCounter.howToP1Tail')}
          </p>
          <p>
            {t('toolWordCounter.howToP2Lead')} <strong>{t('toolWordCounter.howToP2TopWords')}</strong> {t('toolWordCounter.howToP2Tail')}
          </p>
          <p>
            {t('toolWordCounter.howToP3Lead')}{' '}
            <Link href="/demo">{t('toolWordCounter.howToP3Link')}</Link>.
          </p>
        </EdProse>
      </EdSection>

      <EdSection alt>
        <EdRelatedLinks
          links={[
            { href: '/tools', label: t('toolWordCounter.relatedAllTools') },
            { href: '/tools/reading-time', label: t('toolWordCounter.relatedReadingTime') },
            { href: '/features/multi-format', label: t('toolWordCounter.relatedMultiFormat') },
            { href: '/demo', label: t('toolWordCounter.relatedFreeDemo') },
          ]}
        />
      </EdSection>
    </MarketingShell>
  );
}
