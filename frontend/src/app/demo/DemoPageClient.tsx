"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, FileCheck2, FileSignature, FileText, Loader2, Quote } from 'lucide-react';
import { useLocale } from '../../i18n';
import Header from '../../components/Header';
import { getDemoDocuments, type DemoDocument } from '../../lib/api';
import { usePageTitle } from '../../lib/usePageTitle';

const SAMPLE_CONFIG: Record<string, {
  icon: typeof FileText;
  titleKey: string;
  descKey: string;
  questionKey: string;
  badge: string;
  pages: string;
  accentClass: string;
}> = {
  'alphabet-earnings': {
    icon: FileText,
    titleKey: 'demo.sample.earnings.title',
    descKey: 'demo.sample.earnings.desc',
    questionKey: 'demo.sample.earnings.question',
    badge: 'Finance',
    pages: 'Q4 report',
    accentClass: 'from-white/10 to-white/5',
  },
  'attention-paper': {
    icon: BookOpen,
    titleKey: 'demo.sample.paper.title',
    descKey: 'demo.sample.paper.desc',
    questionKey: 'demo.sample.paper.question',
    badge: 'Research',
    pages: 'AI paper',
    accentClass: 'from-white/10 to-white/5',
  },
  'court-filing': {
    icon: FileSignature,
    titleKey: 'demo.sample.court.title',
    descKey: 'demo.sample.court.desc',
    questionKey: 'demo.sample.court.question',
    badge: 'Legal',
    pages: 'Court filing',
    accentClass: 'from-white/10 to-white/5',
  },
};

export default function DemoPageClient() {
  const { t, tOr } = useLocale();
  usePageTitle(t('footer.demo'));
  const [docs, setDocs] = useState<DemoDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchDocs = () => {
    setLoading(true);
    setError(false);
    getDemoDocuments()
      .then(setDocs)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const docsBySlug = new Map(docs.map((doc) => [doc.slug, doc]));

  return (
    <div className="dt-stitch-theme min-h-screen flex flex-col">
      <Header variant="minimal" />
      <main id="main-content" className="flex-1 px-6 py-12 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <section className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
            <div>
              <p className="mb-4 text-sm font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                {tOr('demo.eyebrow', 'Public demo')}
              </p>
              <h1 className="text-4xl font-semibold tracking-normal text-[var(--workbench-ink)] sm:text-5xl">
                {t('demo.title')}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-300 sm:text-lg">
                {t('demo.subtitle')}
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
                <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-900">
                  <FileCheck2 aria-hidden="true" size={15} className="text-accent" />
                  {t('demo.freeMessages')}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-900">
                  <Quote aria-hidden="true" size={15} className="text-accent" />
                  {tOr('demo.citationPromise', 'Click citations to inspect the source')}
                </span>
              </div>
            </div>

            <div className="dt-stitch-card rounded-2xl p-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {tOr('demo.flow.title', 'What you will test')}
                </span>
                <span className="rounded-md bg-accent-light px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-accent">
                  {tOr('demo.flow.badge', 'Cited answers')}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  tOr('demo.flow.step1', 'Open a prepared document'),
                  tOr('demo.flow.step2', 'Ask the suggested question'),
                  tOr('demo.flow.step3', 'Jump from answer to source'),
                ].map((label, index) => (
                  <div key={label} className="rounded-xl border border-white/12 bg-white/7 p-3">
                    <div className="mb-2 flex h-6 w-6 items-center justify-center rounded bg-white text-xs font-semibold text-zinc-950">
                      {index + 1}
                    </div>
                    <p className="text-xs font-medium leading-5 text-zinc-600 dark:text-zinc-300">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {error && (
            <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>{tOr('demo.loadError', 'Demo documents could not be loaded.')}</span>
                <button
                  type="button"
                  onClick={fetchDocs}
                  className="inline-flex items-center justify-center rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200 dark:hover:bg-amber-900 focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  {tOr('common.retry', 'Retry')}
                </button>
              </div>
            </div>
          )}

          <section className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-3">
            {Object.entries(SAMPLE_CONFIG).map(([slug, config]) => {
              const doc = docsBySlug.get(slug);
              const Icon = config.icon;
              const isReady = Boolean(doc && doc.status === 'ready');
              const isPending = loading || Boolean(doc && doc.status !== 'ready');
              const suggestedQuestion = t(config.questionKey);
              const cardContent = (
                <>
                  <div className={`mb-5 rounded-2xl border border-white/12 bg-gradient-to-br ${config.accentClass} p-4`}>
                    <div className="mb-8 flex items-center justify-between">
                      <span className="rounded-full bg-white/12 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-white/72 shadow-sm">
                        {tOr(`demo.sample.${slug}.badge`, config.badge)}
                      </span>
                      <span className="text-xs font-medium text-[var(--workbench-muted)]">
                        {tOr(`demo.sample.${slug}.pages`, config.pages)}
                      </span>
                    </div>
                    <div className="flex items-end justify-between gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/14 bg-white/10 text-white shadow-sm">
                        <Icon aria-hidden="true" size={24} />
                      </div>
                      <div className="rounded-full border border-white/14 bg-white/10 px-2 py-1 font-mono text-[10px] font-semibold text-white/72 shadow-sm">
                        {tOr('demo.pageCitations', 'Page citations')}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-lg font-semibold leading-6 text-[var(--workbench-ink)] transition-colors group-hover:text-white">
                      {t(config.titleKey)}
                    </h2>
                    {isPending && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                        <Loader2 aria-hidden="true" size={12} className="animate-spin" />
                        {loading ? tOr('common.loading', 'Loading') : t('demo.processing')}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--workbench-muted)]">
                    {t(config.descKey)}
                  </p>
                  <div className="mt-5 rounded-2xl border border-white/12 bg-white/7 p-3">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
                      {tOr('demo.suggestedQuestion', 'Suggested question')}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--workbench-ink)]">
                      &ldquo;{suggestedQuestion}&rdquo;
                    </p>
                  </div>
                  <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4 text-sm">
                    <span className="text-[var(--workbench-muted)]">
                      {isReady ? tOr('demo.ready', 'Ready to open') : tOr('demo.preparing', 'Preparing sample')}
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-white">
                      {tOr('demo.openSample', 'Open sample')}
                      <ArrowRight aria-hidden="true" size={15} />
                    </span>
                  </div>
                </>
              );

              return isReady && doc ? (
                <Link
                  key={slug}
                  href={`/d/${doc.document_id}?question=${encodeURIComponent(suggestedQuestion)}`}
                  className="dt-stitch-card group flex min-h-[390px] flex-col rounded-2xl p-5 transition-transform duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                >
                  {cardContent}
                </Link>
              ) : (
                <div
                  key={slug}
                  className="dt-stitch-card flex min-h-[390px] flex-col rounded-2xl p-5 opacity-75"
                >
                  {cardContent}
                </div>
              );
            })}
          </section>

          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/12 pt-6 text-sm text-[var(--workbench-muted)] sm:flex-row">
            <p>{t('demo.hint')}</p>
            <Link href="/" className="font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm">
              &larr; {t('demo.backToHome')}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
