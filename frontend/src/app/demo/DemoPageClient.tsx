"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, FileCheck2, FileSignature, FileText, Loader2, Quote } from 'lucide-react';
import { useLocale } from '../../i18n';
import { getDemoDocuments, type DemoDocument } from '../../lib/api';
import { usePageTitle } from '../../lib/usePageTitle';
import MarketingShell from '../../components/marketing/MarketingShell';
import EdPageHero from '../../components/marketing/EdPageHero';
import EdSection from '../../components/marketing/EdSection';
import EdStepRow from '../../components/marketing/EdStepRow';

const SAMPLE_CONFIG: Record<string, {
  icon: typeof FileText;
  titleKey: string;
  descKey: string;
  questionKey: string;
  badge: string;
  pages: string;
}> = {
  'alphabet-earnings': {
    icon: FileText,
    titleKey: 'demo.sample.earnings.title',
    descKey: 'demo.sample.earnings.desc',
    questionKey: 'demo.sample.earnings.question',
    badge: 'Finance',
    pages: 'Q4 report',
  },
  'attention-paper': {
    icon: BookOpen,
    titleKey: 'demo.sample.paper.title',
    descKey: 'demo.sample.paper.desc',
    questionKey: 'demo.sample.paper.question',
    badge: 'Research',
    pages: 'AI paper',
  },
  'court-filing': {
    icon: FileSignature,
    titleKey: 'demo.sample.court.title',
    descKey: 'demo.sample.court.desc',
    questionKey: 'demo.sample.court.question',
    badge: 'Legal',
    pages: 'Court filing',
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
    <MarketingShell
      breadcrumb={[
        { label: t('useCasesHub.breadcrumb.home'), href: '/' },
        { label: t('footer.demo') },
      ]}
    >
      <EdPageHero
        eyebrow={tOr('demo.eyebrow', 'Public demo')}
        title={t('demo.title')}
        lede={t('demo.subtitle')}
        meta={
          <div className="flex gap-4 flex-wrap">
            <span className="inline-flex items-center gap-2">
              <FileCheck2
                aria-hidden="true"
                size={14}
                style={{ color: 'var(--ed-ink-3)' }}
              />
              <span className="ed-caption">{t('demo.freeMessages')}</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <Quote
                aria-hidden="true"
                size={14}
                style={{ color: 'var(--ed-ink-3)' }}
              />
              <span className="ed-caption">
                {tOr('demo.citationPromise', 'Click citations to inspect the source')}
              </span>
            </span>
          </div>
        }
      />

      <EdSection title={tOr('demo.flow.title', 'What you will test')}>
        <EdStepRow
          steps={[
            { title: tOr('demo.flow.step1', 'Open a prepared document'), body: '' },
            { title: tOr('demo.flow.step2', 'Ask the suggested question'), body: '' },
            { title: tOr('demo.flow.step3', 'Jump from answer to source'), body: '' },
          ]}
        />
      </EdSection>

      <EdSection alt label={tOr('demo.samplesLabel', 'Sample documents')}>
        {error && (
          <div
            style={{
              border: '1px solid var(--ed-rule)',
              padding: '14px 16px',
              marginBottom: '24px',
            }}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="ed-body" style={{ color: 'var(--ed-ochre)' }}>
                {tOr('demo.loadError', 'Demo documents could not be loaded.')}
              </span>
              <button
                type="button"
                onClick={fetchDocs}
                className="ed-caption inline-flex items-center justify-center shrink-0"
                style={{
                  border: '1px solid var(--ed-rule)',
                  background: 'var(--ed-paper)',
                  color: 'var(--ed-ink)',
                  padding: '7px 14px',
                }}
              >
                {tOr('common.retry', 'Retry')}
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3" style={{ gap: '16px' }}>
          {Object.entries(SAMPLE_CONFIG).map(([slug, config]) => {
            const doc = docsBySlug.get(slug);
            const Icon = config.icon;
            const isReady = Boolean(doc && doc.status === 'ready');
            const isPending = loading || Boolean(doc && doc.status !== 'ready');
            const suggestedQuestion = t(config.questionKey);
            const cardContent = (
              <>
                <div className="flex items-center justify-between">
                  <span className="ed-caption uppercase">
                    {tOr(`demo.sample.${slug}.badge`, config.badge)}
                  </span>
                  <span className="ed-caption">
                    {tOr(`demo.sample.${slug}.pages`, config.pages)}
                  </span>
                </div>

                <div
                  className="flex items-center justify-between gap-3"
                  style={{ marginTop: '18px' }}
                >
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      border: '1px solid var(--ed-rule)',
                      background: 'var(--ed-paper-2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon
                      aria-hidden="true"
                      size={22}
                      style={{ color: 'var(--ed-ink-2)' }}
                    />
                  </div>
                  {isPending && (
                    <span
                      className="ed-caption inline-flex shrink-0 items-center gap-1.5"
                    >
                      <Loader2 aria-hidden="true" size={12} className="animate-spin" />
                      {loading ? tOr('common.loading', 'Loading') : t('demo.processing')}
                    </span>
                  )}
                </div>

                <h3 className="ed-h3" style={{ marginTop: '16px' }}>
                  {t(config.titleKey)}
                </h3>
                <p className="ed-body" style={{ marginTop: '8px' }}>
                  {t(config.descKey)}
                </p>

                <div
                  style={{
                    marginTop: '18px',
                    border: '1px solid var(--ed-rule)',
                    background: 'var(--ed-paper)',
                    padding: '12px 14px',
                  }}
                >
                  <p className="ed-caption uppercase">
                    {tOr('demo.suggestedQuestion', 'Suggested question')}
                  </p>
                  <p
                    className="ed-body"
                    style={{
                      marginTop: '8px',
                      fontFamily: 'var(--font-newsreader), Georgia, serif',
                      fontStyle: 'italic',
                    }}
                  >
                    &ldquo;{suggestedQuestion}&rdquo;
                  </p>
                </div>

                <div
                  className="flex items-center justify-between gap-3"
                  style={{
                    marginTop: 'auto',
                    paddingTop: '18px',
                  }}
                >
                  <span className="ed-caption">
                    {isReady ? tOr('demo.ready', 'Ready to open') : tOr('demo.preparing', 'Preparing sample')}
                  </span>
                  <span
                    className="inline-flex items-center gap-1.5"
                    style={{
                      fontFamily: 'var(--font-inter), sans-serif',
                      fontSize: '14px',
                      fontWeight: 500,
                      color: 'var(--ed-ink)',
                    }}
                  >
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
                className="ed-card flex flex-col h-full"
                style={{ minHeight: '390px' }}
              >
                {cardContent}
              </Link>
            ) : (
              <div
                key={slug}
                className="ed-card flex flex-col h-full"
                style={{ minHeight: '390px', opacity: 0.7 }}
              >
                {cardContent}
              </div>
            );
          })}
        </div>

        <p className="ed-caption" style={{ marginTop: '32px' }}>
          {t('demo.hint')}
        </p>
      </EdSection>
    </MarketingShell>
  );
}
