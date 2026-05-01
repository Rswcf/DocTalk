"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { getDocument, uploadDocument, deleteDocument, getMyDocuments, ingestUrl } from '../lib/api';
import type { DocumentBrief } from '../lib/api';
import { Trash2, Link2, FileUp } from 'lucide-react';
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
    <div className="flex flex-col min-h-screen bg-[var(--page-background)]">
      <Header variant="minimal" />
      <main id="main-content">
        <HeroSection />

        {/* Live product demo — demoted from hero to a dedicated section below.
            Hero now shows a static artifact (HeroArtifact); this is the
            "see it actually run" proof for visitors who want more. */}
        <section className="w-full px-4 sm:px-8 lg:px-16 py-16">
          <div className="max-w-6xl mx-auto">
            <h2 className="font-serif font-semibold tracking-tight text-3xl text-zinc-900 dark:text-zinc-50 text-center mb-8 text-balance">
              {t('landing.showcase.title')}
            </h2>
          </div>
          <div className="relative max-w-5xl mx-auto">
            <div className="glow-accent absolute -inset-8 blur-2xl opacity-40 pointer-events-none" aria-hidden="true" />
            <div className="relative rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden">
              <div className="flex items-center px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
                <div className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                  <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="bg-zinc-200 dark:bg-zinc-700 rounded-md px-3 py-0.5">
                    <span className="text-[11px] text-zinc-600 dark:text-zinc-300 select-none">doctalk.site</span>
                  </div>
                </div>
                <div className="w-[52px]" aria-hidden="true" />
              </div>
              <div className="aspect-video bg-zinc-50 dark:bg-zinc-900 relative">
                <ShowcasePlayerLazy />
              </div>
            </div>
          </div>
          <p className="mt-4 text-center text-sm text-zinc-500 dark:text-zinc-300">
            {t('landing.showcase.caption')}
          </p>
        </section>

        <HowItWorks />

        <FeatureGrid />

        <section className="w-full px-6 py-20">
          <div className="max-w-6xl mx-auto">
            <div className="max-w-2xl mb-10">
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-300 mb-3">
                {t('home.explore.eyebrow')}
              </p>
              <h2 className="font-serif font-semibold tracking-tight text-3xl text-zinc-900 dark:text-zinc-50 mb-4">
                {t('home.explore.title')}
              </h2>
              <p className="text-base text-zinc-600 dark:text-zinc-300 leading-relaxed">
                {t('home.explore.description')}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {explorePaths.map((path) => (
                <Link
                  key={path.href}
                  href={path.href}
                  className="group rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-[box-shadow,transform] duration-200"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                      {path.title}
                    </h3>
                    <span className="text-sm text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      →
                    </span>
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                    {path.description}
                  </p>
                </Link>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-3 text-sm">
              <Link href="/features" className="text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
                {t('home.explore.links.allFeatures')}
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <Link href="/use-cases" className="text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
                {t('home.explore.links.allUseCases')}
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <Link href="/compare" className="text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
                {t('home.explore.links.compareTools')}
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <Link href="/alternatives" className="text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
                {t('home.explore.links.browseAlternatives')}
              </Link>
            </div>
          </div>
        </section>

        <SocialProof />

        <div className="text-center py-8">
          <Link href="/pricing" className="text-sm font-medium text-zinc-500 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
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
    <div className="flex flex-col min-h-screen bg-[var(--page-background)]">
      <Header variant="full" />
      <main id="main-content" className="flex-1 flex flex-col items-center p-6 sm:p-8 gap-10">
        <div className="max-w-4xl w-full">
          <div className="mb-4 flex justify-center">
            <PrivacyBadge />
          </div>

          <div
            className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center transition-colors ${
              isDragging
                ? 'border-zinc-500 bg-zinc-50 dark:bg-zinc-900'
                : 'border-zinc-300 dark:border-zinc-700'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <input ref={inputRef} type="file" accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/markdown,.pdf,.docx,.pptx,.xlsx,.txt,.md" className="hidden" onChange={onInputChange} aria-label="Upload document" />
            <p className="text-zinc-700 dark:text-zinc-300 text-lg">{t('upload.dragDrop')}</p>
            <p className="text-zinc-400 text-xs mt-1">{t('upload.supportedFormats')}</p>
            <p className="text-zinc-400 text-sm mt-1">{t('upload.or')}</p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-4 px-6 py-2.5 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-sm hover:shadow-md transition-[box-shadow,color,background-color] disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
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
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 transition-shadow"
                disabled={urlLoading}
                aria-label="Document URL"
              />
            </div>
            <button
              onClick={onUrlSubmit}
              disabled={urlLoading || !urlInput.trim()}
              className="px-4 py-2.5 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-sm transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
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
            <Link href="/demo" className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm">
              {t('home.cta.tryDemo')}
            </Link>
          </div>
        </div>

        <div className="max-w-4xl w-full">
          <h2 className="text-xl font-semibold mb-4 text-zinc-900 dark:text-zinc-100">{t('doc.myDocuments')}</h2>
          {allDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
              <FileUp aria-hidden="true" size={52} className="text-zinc-400 dark:text-zinc-500" />
              <h3 className="mt-5 text-xl font-semibold text-zinc-900 dark:text-zinc-100">{t('dashboard.emptyTitle')}</h3>
              <p className="mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-300">{t('dashboard.emptySubtitle')}</p>
              {/* Dual CTA per Codex r1 + 30-agent onboarding research:
                  primary "Start with a sample" bypasses the upload-and-wait
                  cliff that's eating activation; secondary text link
                  preserves "I have my own doc" path. */}
              <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
                <Link
                  href="/demo"
                  className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-accent-foreground text-sm font-semibold shadow-sm hover:shadow-md transition-[box-shadow,color,background-color] motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950"
                >
                  {tOr('dashboard.emptyTrySample', 'Start with a sample doc')}
                  <span aria-hidden="true" className="transition-transform motion-reduce:transform-none group-hover:translate-x-0.5">→</span>
                </Link>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:text-accent dark:hover:text-accent transition-colors motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:rounded-sm"
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
                    className="p-5 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-shadow transition-transform duration-200 flex items-center justify-between"
                  >
                    <Link href={`/d/${d.document_id}`} className="flex-1 min-w-0 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-lg">
                      <div className="font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2 min-w-0">
                        <span className="truncate">{d.filename ? sanitizeFilename(d.filename) : d.document_id}</span>
                        <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-300 shrink-0">
                          <span className={`w-2 h-2 rounded-full ${statusMeta.dotClass}`} />
                          <span>{statusMeta.label}</span>
                        </span>
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        {new Date(d.createdAt).toLocaleString()}
                      </div>
                    </Link>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/d/${d.document_id}`}
                        className="px-4 py-2 text-sm bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
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
                          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
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
