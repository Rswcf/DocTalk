"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { getDocument, uploadDocument, deleteDocument, getMyDocuments, ingestUrl } from '../lib/api';
import type { DocumentBrief } from '../lib/api';
import { ArrowRight, Sparkles, Trash2, Link2, FileUp, FolderOpen, GitCompare, X } from 'lucide-react';
import { useDocTalkStore } from '../store';
import { useLocale } from '../i18n';
import { clearAccountStorage } from '../lib/clearAccountStorage';
import { errorCopy, type ErrorCopy } from '../lib/errorCopy';
import { billingHref } from '../lib/billingLinks';
import { trackEvent } from '../lib/analytics';
import { sanitizeFilename } from '../lib/utils';
import { PrivacyBadge } from '../components/PrivacyBadge';
import Header from '../components/Header';
import HeroSection from '../components/landing/HeroSection';
import dynamic from 'next/dynamic';
// ShowcasePlayer lazy-loaded so it does not block hero LCP (Codex r1 flag).
const ShowcasePlayerLazy = dynamic(() => import('../components/landing/ShowcasePlayer'), { ssr: false });
import FeatureGrid from '../components/landing/FeatureGrid';
import HowItWorks from '../components/landing/HowItWorks';
import SocialProof from '../components/landing/SocialProof';
import SecuritySection from '../components/landing/SecuritySection';
import FAQ from '../components/landing/FAQ';
import FinalCTA from '../components/landing/FinalCTA';
import Footer from '../components/Footer';
import { useUserProfile } from '../lib/useUserProfile';

type StoredDoc = { document_id: string; filename?: string; createdAt: number; status?: string };
type PlanTier = 'free' | 'plus' | 'pro';

const MAX_UPLOAD_MB_BY_PLAN: Record<PlanTier, number> = {
  free: 25,
  plus: 50,
  pro: 100,
};

const DASHBOARD_NUDGE_DISMISS_KEY = 'doctalk_dashboard_upgrade_nudge_dismissed_at';
const DASHBOARD_NUDGE_LAST_SHOWN_KEY = 'doctalk_dashboard_upgrade_nudge_last_shown_at';
const DASHBOARD_NUDGE_IMPRESSIONS_KEY = 'doctalk_dashboard_upgrade_nudge_impressions';
const DASHBOARD_NUDGE_DISMISS_MS = 14 * 24 * 60 * 60 * 1000;
const DASHBOARD_NUDGE_SHOW_MS = 7 * 24 * 60 * 60 * 1000;
const DASHBOARD_NUDGE_MAX_IMPRESSIONS = 3;

function LandingPageContent() {
  const { t } = useLocale();
  const explorePaths = [
    {
      href: '/features/citations',
      title: t('home.explore.cards.citations.title'),
      description: t('home.explore.cards.citations.description'),
    },
    {
      href: '/features/multi-format',
      title: t('home.explore.cards.multiFormat.title'),
      description: t('home.explore.cards.multiFormat.description'),
    },
    {
      href: '/features/free-demo',
      title: t('home.explore.cards.freeDemo.title'),
      description: t('home.explore.cards.freeDemo.description'),
    },
    {
      href: '/features/performance-modes',
      title: t('home.explore.cards.performanceModes.title'),
      description: t('home.explore.cards.performanceModes.description'),
    },
    {
      href: '/use-cases/finance',
      title: t('home.explore.cards.finance.title'),
      description: t('home.explore.cards.finance.description'),
    },
    {
      href: '/use-cases/hr-contracts',
      title: t('home.explore.cards.hrContracts.title'),
      description: t('home.explore.cards.hrContracts.description'),
    },
    {
      href: '/blog/category/comparisons',
      title: t('home.explore.cards.comparisonGuides.title'),
      description: t('home.explore.cards.comparisonGuides.description'),
    },
  ];

  return (
    <div className="dt-stitch-theme flex flex-col min-h-screen">
      <Header variant="minimal" />
      <main id="main-content">
        <HeroSection />

        {/* Live product demo — demoted from hero to a dedicated section below.
            Hero now shows a static artifact (HeroArtifact); this is the
            "see it actually run" proof for visitors who want more. */}
        <section className="w-full px-4 sm:px-8 lg:px-16 py-16">
          <div className="max-w-6xl mx-auto">
            <h2 className="font-semibold tracking-normal text-3xl text-[var(--workbench-ink)] text-center mb-8 text-balance">
              {t('landing.showcase.title')}
            </h2>
          </div>
          <div className="relative max-w-5xl mx-auto">
            <div className="dt-stitch-card relative rounded-2xl overflow-hidden">
              <div className="flex items-center px-4 py-2.5 border-b border-[var(--workbench-border)] bg-white/6">
                <div className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                  <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="rounded-full bg-white/9 px-3 py-0.5">
                    <span className="text-[11px] text-[var(--workbench-muted)] select-none">doctalk.site</span>
                  </div>
                </div>
                <div className="w-[52px]" aria-hidden="true" />
              </div>
              <div className="aspect-video bg-black/40 relative">
                <ShowcasePlayerLazy />
              </div>
            </div>
          </div>
          <p className="mt-4 text-center text-sm text-[var(--workbench-muted)]">
            {t('landing.showcase.caption')}
          </p>
        </section>

        <HowItWorks />

        <FeatureGrid />

        <section className="w-full px-6 py-20">
          <div className="max-w-6xl mx-auto">
            <div className="max-w-2xl mb-10">
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--workbench-muted)] mb-3">
                {t('home.explore.eyebrow')}
              </p>
              <h2 className="font-semibold tracking-normal text-3xl text-[var(--workbench-ink)] mb-4">
                {t('home.explore.title')}
              </h2>
              <p className="text-base text-[var(--workbench-muted)] leading-relaxed">
                {t('home.explore.description')}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {explorePaths.map((path) => (
                <Link
                  key={path.href}
                  href={path.href}
                  className="dt-stitch-card group rounded-2xl p-6 transition-transform duration-200 hover:-translate-y-0.5"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <h3 className="text-lg font-semibold text-[var(--workbench-ink)]">
                      {path.title}
                    </h3>
                    <span className="text-sm text-[var(--workbench-muted)] group-hover:text-white transition-colors">
                      →
                    </span>
                  </div>
                  <p className="text-sm text-[var(--workbench-muted)] leading-relaxed">
                    {path.description}
                  </p>
                </Link>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-3 text-sm">
              <Link href="/features" className="text-[var(--workbench-muted)] hover:text-white transition-colors">
                {t('home.explore.links.allFeatures')}
              </Link>
              <span className="text-white/18">|</span>
              <Link href="/use-cases" className="text-[var(--workbench-muted)] hover:text-white transition-colors">
                {t('home.explore.links.allUseCases')}
              </Link>
              <span className="text-white/18">|</span>
              <Link href="/compare" className="text-[var(--workbench-muted)] hover:text-white transition-colors">
                {t('home.explore.links.compareTools')}
              </Link>
              <span className="text-white/18">|</span>
              <Link href="/alternatives" className="text-[var(--workbench-muted)] hover:text-white transition-colors">
                {t('home.explore.links.browseAlternatives')}
              </Link>
            </div>
          </div>
        </section>

        <SocialProof />

        <div className="text-center py-8">
          <Link href="/pricing" className="text-sm font-medium text-[var(--workbench-muted)] hover:text-white transition-colors">
            {t('footer.pricing')} &rarr;
          </Link>
        </div>

        <SecuritySection />

        <FAQ />

        <FinalCTA />

        {/* Privacy Badge */}
        <section className="py-8 flex justify-center">
          <PrivacyBadge />
        </section>
      </main>

      <Footer />
    </div>
  );
}

export default function HomePageClient() {
  const router = useRouter();
  const { status } = useSession();
  const { setDocument, setDocumentStatus } = useDocTalkStore();
  const { t, tOr } = useLocale();
  const [isDragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [uploadErrorCopy, setUploadErrorCopy] = useState<ErrorCopy | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [myDocs, setMyDocs] = useState<StoredDoc[]>([]);
  const [serverDocs, setServerDocs] = useState<DocumentBrief[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlError, setUrlError] = useState('');
  const [urlErrorCopy, setUrlErrorCopy] = useState<ErrorCopy | null>(null);
  const [upgradeNudgeDismissed, setUpgradeNudgeDismissed] = useState(true);
  const upgradeNudgeTrackedRef = useRef(false);
  const isLoggedIn = status === 'authenticated';
  const { profile } = useUserProfile();

  useEffect(() => {
    if (status !== 'unauthenticated') return;
    const docs = JSON.parse(localStorage.getItem('doctalk_docs') || '[]') as StoredDoc[];
    setMyDocs(docs.sort((a, b) => b.createdAt - a.createdAt));
  }, [status]);

  useEffect(() => {
    if (!isLoggedIn) return;
    const controller = new AbortController();
    getMyDocuments(controller.signal).then(setServerDocs).catch((err) => {
      if (err.name !== 'AbortError') console.error(err);
    });
    return () => controller.abort();
  }, [isLoggedIn]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      setMyDocs([]);
      setServerDocs([]);
      clearAccountStorage();
    }
  }, [status]);

  const userPlan: PlanTier = useMemo(() => {
    if (!isLoggedIn) return 'free';
    return profile?.plan === 'plus' || profile?.plan === 'pro' ? profile.plan : 'free';
  }, [isLoggedIn, profile?.plan]);

  const allDocs = useMemo(() => {
    if (isLoggedIn) {
      return serverDocs
        .map((d) => ({
          document_id: d.id,
          filename: d.filename,
          status: d.status,
          createdAt: d.created_at ? new Date(d.created_at).getTime() : Date.now(),
        }))
        .sort((a, b) => b.createdAt - a.createdAt);
    }
    return myDocs;
  }, [isLoggedIn, myDocs, serverDocs]);

  const maxUploadMb = useMemo(() => MAX_UPLOAD_MB_BY_PLAN[userPlan] ?? MAX_UPLOAD_MB_BY_PLAN.free, [userPlan]);
  const maxUploadBytes = maxUploadMb * 1024 * 1024;
  const uploadUpgradePlan = userPlan === 'plus' ? 'pro' : 'plus';
  const readyDocumentCount = useMemo(
    () => allDocs.filter((doc) => (doc.status || '').toLowerCase() === 'ready').length,
    [allDocs]
  );
  const durableFreeUsage = userPlan === 'free' && (
    readyDocumentCount >= 2 ||
    (profile?.stats.total_documents || 0) >= 2 ||
    (profile?.stats.total_messages || 0) >= 8
  );
  const showUpgradeNudge = isLoggedIn && durableFreeUsage && !upgradeNudgeDismissed;
  const showWorkspaceNudge = readyDocumentCount >= 2;

  useEffect(() => {
    if (!isLoggedIn || userPlan !== 'free') {
      setUpgradeNudgeDismissed(true);
      return;
    }
    try {
      const now = Date.now();
      const dismissedAt = Number(localStorage.getItem(DASHBOARD_NUDGE_DISMISS_KEY) || '0');
      const lastShownAt = Number(localStorage.getItem(DASHBOARD_NUDGE_LAST_SHOWN_KEY) || '0');
      const impressions = Number(localStorage.getItem(DASHBOARD_NUDGE_IMPRESSIONS_KEY) || '0');
      setUpgradeNudgeDismissed(Boolean(
        (dismissedAt && now - dismissedAt < DASHBOARD_NUDGE_DISMISS_MS) ||
        (lastShownAt && now - lastShownAt < DASHBOARD_NUDGE_SHOW_MS) ||
        impressions >= DASHBOARD_NUDGE_MAX_IMPRESSIONS
      ));
    } catch {
      setUpgradeNudgeDismissed(false);
    }
  }, [isLoggedIn, userPlan]);

  useEffect(() => {
    if (!showUpgradeNudge || upgradeNudgeTrackedRef.current) return;
    upgradeNudgeTrackedRef.current = true;
    try {
      const impressions = Number(localStorage.getItem(DASHBOARD_NUDGE_IMPRESSIONS_KEY) || '0');
      localStorage.setItem(DASHBOARD_NUDGE_LAST_SHOWN_KEY, String(Date.now()));
      localStorage.setItem(DASHBOARD_NUDGE_IMPRESSIONS_KEY, String(impressions + 1));
    } catch {
      // localStorage may be unavailable in restricted browsers.
    }
    trackEvent('upgrade_nudge_shown', {
      source: 'dashboard_upgrade_reminder',
      reason: 'sustained_free_usage',
      plan: 'plus',
      period: 'monthly',
    });
  }, [showUpgradeNudge]);

  const dismissUpgradeNudge = () => {
    setUpgradeNudgeDismissed(true);
    try {
      localStorage.setItem(DASHBOARD_NUDGE_DISMISS_KEY, String(Date.now()));
    } catch {
      // localStorage may be unavailable in restricted browsers.
    }
  };

  const getDocStatusMeta = (status?: string) => {
    const normalized = (status || '').toLowerCase();

    if (normalized === 'error') {
      return { dotClass: 'bg-red-500', label: t('dashboard.status.error') };
    }
    if (normalized === 'parsing' || normalized === 'embedding' || normalized === 'ocr' || normalized === 'uploading' || normalized === 'idle') {
      return { dotClass: 'bg-amber-500 animate-pulse', label: t('dashboard.status.processing') };
    }
    return { dotClass: 'bg-emerald-500', label: t('dashboard.status.ready') };
  };

  const onFiles = useCallback(async (file: File) => {
    if (!file) return;
    setUploadErrorCopy(null);
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/markdown',
    ];
    const allowedExtensions = ['.pdf', '.docx', '.pptx', '.xlsx', '.txt', '.md'];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(ext)) {
      setProgressText(t('upload.unsupportedFormat'));
      setUploadErrorCopy(null);
      return;
    }
    if (file.size > maxUploadBytes) {
      const body = t('dashboard.fileSizeLimit', { size: maxUploadMb });
      setProgressText(body);
      setUploadErrorCopy({
        title: tOr('errors.FILE_TOO_LARGE.title', 'File too large'),
        body,
        cta: {
          label: tOr('errors.cta.upgrade', 'Upgrade'),
          href: billingHref({ plan: uploadUpgradePlan, source: 'limit', reason: 'file_size' }),
        },
        severity: 'warning',
      });
      trackEvent('limit_hit', { source: 'dashboard_upload_precheck', reason: 'file_size', plan: userPlan });
      return;
    }
    setUploading(true);
    setProgressText(t('upload.uploading'));
    setUploadErrorCopy(null);
    setDocumentStatus('uploading');
    try {
      const res = await uploadDocument(file);
      const docId = res.document_id;
      trackEvent('document_upload_created', { source: 'dashboard_upload', plan: userPlan });
      setDocument(docId);
      if (!isLoggedIn) {
        const docs: StoredDoc[] = JSON.parse(localStorage.getItem('doctalk_docs') || '[]');
        const entry: StoredDoc = { document_id: docId, filename: res.filename, status: res.status, createdAt: Date.now() };
        localStorage.setItem('doctalk_docs', JSON.stringify([entry, ...docs.filter((d) => d.document_id !== docId)]));
        setMyDocs([entry, ...docs.filter((d) => d.document_id !== docId)].sort((a, b) => b.createdAt - a.createdAt));
      }
      getMyDocuments().then(setServerDocs).catch(console.error);

      setProgressText(t('upload.parsing'));
      const timer = setInterval(async () => {
        try {
          const info = await getDocument(docId);
          setDocumentStatus(info.status);
          const pp = info.pages_parsed ?? 0;
          const ci = info.chunks_indexed ?? 0;
          if (info.status === 'ocr') {
            setProgressText(t('upload.ocr'));
          } else if (pp === 0 && ci === 0) {
            setProgressText(t('upload.parsing'));
          } else {
            setProgressText(t('upload.parsingProgress', { pagesParsed: pp, chunksIndexed: ci }));
          }
          if (info.status === 'ready') {
            clearInterval(timer);
            router.push(`/d/${docId}`);
          }
          if (info.status === 'error') {
            clearInterval(timer);
            setProgressText(t('upload.error'));
            setUploading(false);
          }
        } catch (e) {
          clearInterval(timer);
          setProgressText(t('upload.error'));
          setUploading(false);
        }
      }, 2000);
    } catch (e: unknown) {
      const copy = errorCopy(e, t, tOr);
      setProgressText(copy.body);
      setUploadErrorCopy(copy.cta ? copy : null);
      if (copy.cta) {
        trackEvent('limit_hit', { source: 'dashboard_upload', reason: copy.cta.href.includes('file_size') ? 'file_size' : 'upload_limit', plan: userPlan });
      }
      setUploading(false);
    }
  }, [isLoggedIn, maxUploadBytes, maxUploadMb, router, setDocument, setDocumentStatus, t, tOr, uploadUpgradePlan, userPlan]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFiles(file);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFiles(file);
  };

  const onUrlSubmit = useCallback(async () => {
    const url = urlInput.trim();
    if (!url) return;
    setUrlErrorCopy(null);
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      setUrlError(t('upload.urlError'));
      setUrlErrorCopy(null);
      return;
    }
    setUrlLoading(true);
    setUrlError('');
    setUrlErrorCopy(null);
    try {
      const res = await ingestUrl(url);
      const docId = res.document_id;
      trackEvent('url_ingest_created', { source: 'dashboard_url', plan: userPlan });
      setDocument(docId);
      setUrlInput('');
      getMyDocuments().then(setServerDocs).catch(console.error);
      router.push(`/d/${docId}`);
    } catch (e: unknown) {
      const copy = errorCopy(e, t, tOr);
      setUrlError(copy.body);
      setUrlErrorCopy(copy.cta ? copy : null);
      if (copy.cta) {
        trackEvent('limit_hit', { source: 'dashboard_url', reason: copy.cta.href.includes('file_size') ? 'file_size' : 'url_limit', plan: userPlan });
      }
    } finally {
      setUrlLoading(false);
    }
  }, [urlInput, router, setDocument, t, tOr, userPlan]);

  const confirmDeleteDocument = useCallback(async (documentId: string) => {
    setDeletingId(documentId);
    try {
      await deleteDocument(documentId);
    } catch (e) {
      console.error('Failed to delete document:', e);
    }

    if (!isLoggedIn) {
      const docs: StoredDoc[] = JSON.parse(localStorage.getItem('doctalk_docs') || '[]');
      const next = docs.filter((x) => x.document_id !== documentId);
      localStorage.setItem('doctalk_docs', JSON.stringify(next));
      setMyDocs(next.sort((a, b) => b.createdAt - a.createdAt));
    }
    setServerDocs((prev) => prev.filter((s) => s.id !== documentId));
    setDeletingId(null);
    setConfirmDeleteId((prev) => (prev === documentId ? null : prev));
  }, [isLoggedIn]);

  /* --- Loading guard (prevents flash of wrong content) --- */
  if (status === 'loading') {
    return <LandingPageContent />;
  }

  /* --- Logged-out landing page --- */
  if (!isLoggedIn) {
    return <LandingPageContent />;
  }

  /* --- Logged-in dashboard --- */
  return (
    <div className="dt-stitch-theme flex flex-col min-h-screen">
      <Header variant="full" />
      <main id="main-content" className="flex-1 flex flex-col items-center p-6 sm:p-8 gap-10">
        <div className="max-w-4xl w-full">
          <div className="mb-4 flex justify-center">
            <PrivacyBadge />
          </div>

          {showUpgradeNudge && (
            <section className="dt-stitch-card mb-5 rounded-2xl p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/12 text-white">
                    <Sparkles aria-hidden="true" size={18} />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-[var(--workbench-ink)]">
                      {tOr('dashboard.upgradeNudge.title', 'Ready for heavier document work?')}
                    </h2>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--workbench-muted)]">
                      {tOr(
                        'dashboard.upgradeNudge.body',
                        'Plus gives you 20 documents, 50 MB uploads, all AI modes, and Markdown export before your next limit stops the workflow.'
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 sm:self-start">
	                  <Link
	                    href={billingHref({ plan: 'plus', source: 'dashboard_upgrade_reminder', reason: 'sustained_free_usage' })}
	                    onClick={() => trackEvent('upgrade_click', {
	                      plan: 'plus',
	                      period: 'monthly',
	                      source: 'dashboard_upgrade_reminder',
	                      reason: 'sustained_free_usage',
	                    })}
                    className="dt-stitch-primary inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                  >
                    {tOr('dashboard.upgradeNudge.cta', 'Upgrade')}
                    <ArrowRight aria-hidden="true" size={15} />
                  </Link>
                  <button
                    type="button"
                    onClick={dismissUpgradeNudge}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--workbench-muted)] transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                    aria-label={tOr('dashboard.upgradeNudge.dismiss', 'Dismiss upgrade prompt')}
                  >
                    <X aria-hidden="true" size={16} />
                  </button>
                </div>
              </div>
            </section>
          )}

          <div
            className={`dt-command-bar rounded-[2rem] p-8 text-center transition-colors sm:p-12 ${
              isDragging
                ? 'border-white/40 bg-white/10'
                : 'border-white/18'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <input ref={inputRef} type="file" accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/markdown,.pdf,.docx,.pptx,.xlsx,.txt,.md" className="hidden" onChange={onInputChange} aria-label="Upload document" />
            <p className="text-[var(--workbench-ink)] text-lg">{t('upload.dragDrop')}</p>
            <p className="text-[var(--workbench-muted)] text-xs mt-1">{t('upload.supportedFormats')}</p>
            <p className="text-[var(--workbench-muted)] text-sm mt-1">{t('upload.or')}</p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="dt-stitch-primary mt-4 rounded-full px-6 py-2.5 font-medium transition-[box-shadow,color,background-color] disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
              disabled={uploading}
            >
              {t('upload.chooseFile')}
            </button>
            {progressText && (
              <div aria-live="polite" className={`mt-4 text-sm ${uploading ? 'text-zinc-500' : 'text-red-600 dark:text-red-400'}`}>
                <p>{progressText}</p>
                {uploadErrorCopy?.cta && (
                  <Link
                    href={uploadErrorCopy.cta.href}
                    onClick={() => trackEvent('upgrade_click', { source: 'upload_error', reason: 'upload_limit' })}
                    className="mt-3 inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
                  >
                    {uploadErrorCopy.cta.label}
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* URL Import */}
          <div className="mt-4 flex items-center gap-2 max-w-lg mx-auto">
            <div className="flex-1 relative">
              <Link2 aria-hidden="true" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="url"
                value={urlInput}
                onChange={(e) => { setUrlInput(e.target.value); setUrlError(''); setUrlErrorCopy(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') onUrlSubmit(); }}
                placeholder={t('upload.urlPlaceholder')}
                className="w-full rounded-full border border-white/14 bg-white/8 py-2.5 pl-9 pr-3 text-sm text-[var(--workbench-ink)] placeholder:text-white/38 transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                disabled={urlLoading}
                aria-label="Document URL"
              />
            </div>
            <button
              onClick={onUrlSubmit}
              disabled={urlLoading || !urlInput.trim()}
              className="dt-stitch-primary rounded-full px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
            >
              {urlLoading ? '...' : t('upload.ingestUrl')}
            </button>
          </div>
          {urlError && (
            <div role="alert" className="mt-2 text-center text-sm text-red-600 dark:text-red-400">
              <p>{urlError}</p>
              {urlErrorCopy?.cta && (
                <Link
                  href={urlErrorCopy.cta.href}
                  onClick={() => trackEvent('upgrade_click', { source: 'url_error', reason: 'url_limit' })}
                  className="mt-3 inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
                >
                  {urlErrorCopy.cta.label}
                </Link>
              )}
            </div>
          )}

          <div className="mt-3 text-center">
            <Link href="/demo" className="text-[var(--workbench-muted)] hover:text-white text-sm transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm">
              {t('home.cta.tryDemo')}
            </Link>
          </div>
        </div>

        <div className="max-w-4xl w-full">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-3xl font-semibold tracking-normal text-[var(--workbench-ink)]">{t('doc.myDocuments')}</h2>
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              <Link
                href="/document-diff"
                className="dt-workbench-button inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
              >
                <GitCompare aria-hidden="true" size={16} />
                {tOr('diff.tab', 'Compare')}
              </Link>
              <Link
                href="/collections"
                className="dt-workbench-button inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
              >
                <FolderOpen aria-hidden="true" size={16} />
                {tOr('dashboard.workspacesLink', 'Workspaces')}
              </Link>
            </div>
          </div>

          {showWorkspaceNudge && (
            <section className="dt-stitch-card mb-4 rounded-2xl p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/14 bg-white/8 text-white">
                    <FolderOpen aria-hidden="true" size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--workbench-ink)]">
                      {tOr('dashboard.workspaceNudge.title', 'Turn related documents into a workspace')}
                    </h3>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--workbench-muted)]">
                      {tOr(
                        'dashboard.workspaceNudge.body',
                        'You have ready documents. Group them to ask cross-document questions while keeping citations tied to the exact source file.'
                      )}
                    </p>
                  </div>
                </div>
                <Link
                  href="/collections?action=create&select=ready"
                  className="dt-stitch-primary inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                >
                  {tOr('dashboard.workspaceNudge.cta', 'Create workspace')}
                  <ArrowRight aria-hidden="true" size={15} />
                </Link>
              </div>
            </section>
          )}

          {allDocs.length === 0 ? (
            <div className="dt-stitch-card flex flex-col items-center justify-center rounded-2xl border-dashed px-6 py-16 text-center">
              <FileUp aria-hidden="true" size={52} className="text-[var(--workbench-muted)]" />
              <h3 className="mt-5 text-xl font-semibold text-[var(--workbench-ink)]">{t('dashboard.emptyTitle')}</h3>
              <p className="mt-2 max-w-md text-sm text-[var(--workbench-muted)]">{t('dashboard.emptySubtitle')}</p>
              {/* Dual CTA per Codex r1 + 30-agent onboarding research:
                  primary "Start with a sample" bypasses the upload-and-wait
                  cliff that's eating activation; secondary text link
                  preserves "I have my own doc" path. */}
              <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
                <Link
                  href="/demo"
                  className="dt-stitch-primary group inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-[box-shadow,color,background-color] motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                >
                  {tOr('dashboard.emptyTrySample', 'Start with a sample doc')}
                  <span aria-hidden="true" className="transition-transform motion-reduce:transform-none group-hover:translate-x-0.5">→</span>
                </Link>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="text-sm font-semibold text-[var(--workbench-muted)] transition-colors hover:text-white motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm"
                >
                  {tOr('dashboard.emptyUploadOwn', 'Or upload your own')}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {allDocs.map((d) => {
                const statusMeta = getDocStatusMeta(d.status);
                return (
                  <div
                    key={d.document_id}
                    className="dt-stitch-card flex items-center justify-between rounded-2xl p-5 transition-transform duration-200 hover:-translate-y-0.5"
                  >
                    <Link href={`/d/${d.document_id}`} className="flex-1 min-w-0 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-lg">
                      <div className="font-medium text-[var(--workbench-ink)] flex items-center gap-2 min-w-0">
                        <span className="truncate">{d.filename ? sanitizeFilename(d.filename) : d.document_id}</span>
                        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--workbench-muted)] shrink-0">
                          <span className={`w-2 h-2 rounded-full ${statusMeta.dotClass}`} />
                          <span>{statusMeta.label}</span>
                        </span>
                      </div>
                      <div className="text-xs text-[var(--workbench-muted)] mt-0.5">
                        {new Date(d.createdAt).toLocaleString()}
                      </div>
                    </Link>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/d/${d.document_id}`}
                        className="dt-stitch-primary rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                      >
                        {t('doc.open')}
                      </Link>
                      {confirmDeleteId === d.document_id ? (
                        <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-300">
                          <span>{t('dashboard.deletePrompt')}</span>
                          <button
                            className="px-2 py-1 rounded-md bg-red-600 text-white hover:bg-red-500 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500"
                            disabled={deletingId === d.document_id}
                            onClick={() => confirmDeleteDocument(d.document_id)}
                          >
                            {t('common.yes')}
                          </button>
                          <button
                            className="px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500"
                            disabled={deletingId === d.document_id}
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            {t('common.no')}
                          </button>
                        </div>
                      ) : (
                        <button
                          className="rounded-full p-2 text-[var(--workbench-muted)] transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                          disabled={deletingId === d.document_id}
                          onClick={() => setConfirmDeleteId(d.document_id)}
                          title={t('doc.deleteDoc')}
                          aria-label="Delete document"
                        >
                          <Trash2 aria-hidden="true" size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
