# UI Redesign Phase 2: Header Variant + Landing Page Components + Homepage

## Task
Add a `variant` prop to Header, create new landing page components (HeroSection, FeatureGrid), and completely redesign the homepage (both logged-out and logged-in views) with a premium monochrome SaaS aesthetic.

## Important Context
- The project uses `next/font/google` Inter font (added in Phase 1) with `font-sans` Tailwind class
- CSS variables have been updated to zinc-based palette (Phase 1)
- New i18n keys `landing.*` have been added (Phase 1)
- The i18n hook is `useLocale()` from `../i18n` returning `{ t, locale }`
- All components are `"use client"`
- Auth uses `next-auth/react` with `useSession()`, `signIn()`
- Icons come from `lucide-react`
- The store is `useDocTalkStore` from `../store`

## File Changes

### 1. `frontend/src/components/Header.tsx` — Add variant prop

Current Header always shows full controls (ModelSelector, theme toggle, CreditsDisplay, LanguageSelector, etc).

Add a `variant` prop:
- `variant?: 'minimal' | 'full'` (default `'full'`)
- **minimal** (for homepage, demo, auth): Logo left + UserMenu/Sign-in right only. No ModelSelector, no theme toggle, no CreditsDisplay, no LanguageSelector. Transparent bg, no bottom border.
- **full** (for doc pages, billing, profile): Current behavior unchanged

Updated Header:
```tsx
"use client";

import React from 'react';
import { Sun, Moon, ArrowLeft } from 'lucide-react';
import { useTheme } from 'next-themes';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useDocTalkStore } from '../store';
import ModelSelector from './ModelSelector';
import LanguageSelector from './LanguageSelector';
import UserMenu from './UserMenu';
import { useLocale } from '../i18n';
import SessionDropdown from './SessionDropdown';
import { CreditsDisplay } from './CreditsDisplay';

interface HeaderProps {
  variant?: 'minimal' | 'full';
}

export default function Header({ variant = 'full' }: HeaderProps) {
  const documentName = useDocTalkStore((s) => s.documentName);
  const lastDocumentId = useDocTalkStore((s) => s.lastDocumentId);
  const lastDocumentName = useDocTalkStore((s) => s.lastDocumentName);
  const { theme, setTheme } = useTheme();
  const { t } = useLocale();
  const pathname = usePathname();
  const isDocumentPage = pathname?.startsWith('/d/');
  const isMinimal = variant === 'minimal';

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <header className={`h-14 flex items-center px-6 shrink-0 ${
      isMinimal
        ? 'bg-transparent'
        : 'border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950'
    }`}>
      <Link href="/" className="font-semibold text-lg text-zinc-900 dark:text-zinc-100 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
        {t('app.title')}
      </Link>
      {!isMinimal && documentName && (
        <>
          <span className="mx-3 text-zinc-300 dark:text-zinc-600">/</span>
          <SessionDropdown />
        </>
      )}
      {!isMinimal && !isDocumentPage && lastDocumentId && (
        <Link
          href={`/d/${lastDocumentId}`}
          className="ml-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          title={lastDocumentName || ''}
          aria-label={t('header.backToDocument')}
        >
          <ArrowLeft size={14} className="shrink-0" />
          <span className="max-w-[160px] truncate">{lastDocumentName}</span>
        </Link>
      )}
      <div className="ml-auto flex items-center gap-2">
        {!isMinimal && <ModelSelector />}
        {!isMinimal && (
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors"
            title={theme === 'dark' ? t('header.lightMode') : t('header.darkMode')}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        )}
        {!isMinimal && <CreditsDisplay />}
        <UserMenu />
        {!isMinimal && <LanguageSelector />}
      </div>
    </header>
  );
}
```

### 2. `frontend/src/components/landing/HeroSection.tsx` — New file

```tsx
"use client";

import React from 'react';
import Link from 'next/link';
import { useLocale } from '../../i18n';

export default function HeroSection() {
  const { t } = useLocale();

  return (
    <section className="max-w-6xl mx-auto px-6 py-20 md:py-28">
      <div className="max-w-3xl">
        {/* Badge */}
        <div className="flex items-center gap-2 mb-6">
          <span className="inline-block w-2.5 h-2.5 bg-zinc-900 dark:bg-zinc-100" />
          <span className="text-xs font-medium tracking-widest uppercase text-zinc-500 dark:text-zinc-400">
            {t('landing.badge')}
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-zinc-900 dark:text-zinc-50 leading-[1.1] tracking-tight">
          {t('landing.headline').split('\n').map((line: string, i: number) => (
            <React.Fragment key={i}>
              {i > 0 && <br />}
              {line}
            </React.Fragment>
          ))}
        </h1>

        {/* Subtitle */}
        <p className="mt-4 text-2xl md:text-3xl text-zinc-400 dark:text-zinc-500 font-medium">
          {t('landing.subtitle')}
        </p>

        {/* Description */}
        <p className="mt-6 text-lg text-zinc-600 dark:text-zinc-400 max-w-lg leading-relaxed">
          {t('landing.description')}
        </p>

        {/* CTA buttons */}
        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="/demo"
            className="inline-flex items-center px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all duration-200"
          >
            {t('landing.cta.demo')}
          </Link>
          <Link
            href="#features"
            className="inline-flex items-center px-6 py-3 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all duration-200"
          >
            {t('landing.cta.howItWorks')}
          </Link>
        </div>
      </div>
    </section>
  );
}
```

### 3. `frontend/src/components/landing/FeatureGrid.tsx` — New file

```tsx
"use client";

import React from 'react';
import { Zap, BookOpen, Shield } from 'lucide-react';
import { useLocale } from '../../i18n';

const features = [
  { icon: Zap, titleKey: 'landing.feature.answers.title', descKey: 'landing.feature.answers.desc' },
  { icon: BookOpen, titleKey: 'landing.feature.citations.title', descKey: 'landing.feature.citations.desc' },
  { icon: Shield, titleKey: 'landing.feature.privacy.title', descKey: 'landing.feature.privacy.desc' },
];

export default function FeatureGrid() {
  const { t } = useLocale();

  return (
    <section id="features" className="max-w-5xl mx-auto px-6 py-16">
      <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 text-center mb-12">
        {t('landing.features.title')}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {features.map(({ icon: Icon, titleKey, descKey }) => (
          <div
            key={titleKey}
            className="p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:shadow-md transition-all duration-200"
          >
            <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
              <Icon size={20} className="text-zinc-600 dark:text-zinc-400" />
            </div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              {t(titleKey)}
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {t(descKey)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

### 4. `frontend/src/app/page.tsx` — Complete rewrite

This is the MOST important file. Rewrite it completely with:

**Logged-out view:**
- `<Header variant="minimal" />`
- `<HeroSection />`
- Product showcase section (image placeholder with a styled div if `/showcase.png` doesn't exist yet — use a gradient placeholder)
- `<FeatureGrid />`
- `<PrivacyBadge />` relocated at bottom

**Logged-in view:**
- `<Header variant="full" />`
- Upload zone: max-w-4xl, larger padding, rounded-2xl, zinc borders, zinc-900 "Choose File" button
- Document list: card-style with rounded-xl, hover shadow, better spacing
- "Open" button: bg-zinc-900 text-white

Here is the full new `page.tsx`:

```tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useSession, signIn } from 'next-auth/react';
import { getDocument, uploadDocument, deleteDocument, getMyDocuments } from '../lib/api';
import type { DocumentBrief } from '../lib/api';
import { Trash2 } from 'lucide-react';
import { useDocTalkStore } from '../store';
import { useLocale } from '../i18n';
import { PrivacyBadge } from '../components/PrivacyBadge';
import Header from '../components/Header';
import HeroSection from '../components/landing/HeroSection';
import FeatureGrid from '../components/landing/FeatureGrid';

type StoredDoc = { document_id: string; filename?: string; createdAt: number };

export default function HomePage() {
  const router = useRouter();
  const { status } = useSession();
  const { setDocument, setDocumentStatus } = useDocTalkStore();
  const { t } = useLocale();
  const [isDragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progressText, setProgressText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [myDocs, setMyDocs] = useState<StoredDoc[]>([]);
  const [serverDocs, setServerDocs] = useState<DocumentBrief[]>([]);
  const isLoggedIn = status === 'authenticated';

  useEffect(() => {
    const docs = JSON.parse(localStorage.getItem('doctalk_docs') || '[]') as StoredDoc[];
    setMyDocs(docs.sort((a, b) => b.createdAt - a.createdAt));
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      getMyDocuments().then(setServerDocs).catch(console.error);
    }
  }, [isLoggedIn]);

  const allDocs = useMemo(() => {
    const serverIds = new Set(serverDocs.map((d) => d.id));
    const localOnly = myDocs.filter((d) => !serverIds.has(d.document_id));
    const mappedServer: StoredDoc[] = serverDocs.map((d) => ({
      document_id: d.id,
      filename: d.filename,
      createdAt: d.created_at ? new Date(d.created_at).getTime() : Date.now(),
    }));
    return [...mappedServer, ...localOnly].sort((a, b) => b.createdAt - a.createdAt);
  }, [serverDocs, myDocs]);

  const onFiles = useCallback(async (file: File) => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setProgressText(t('upload.pdfOnly'));
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setProgressText(t('upload.tooLarge'));
      return;
    }
    setUploading(true);
    setProgressText(t('upload.uploading'));
    setDocumentStatus('uploading');
    try {
      const res = await uploadDocument(file);
      const docId = res.document_id;
      setDocument(docId);
      const docs: StoredDoc[] = JSON.parse(localStorage.getItem('doctalk_docs') || '[]');
      const entry: StoredDoc = { document_id: docId, filename: res.filename, createdAt: Date.now() };
      localStorage.setItem('doctalk_docs', JSON.stringify([entry, ...docs.filter(d => d.document_id !== docId)]));
      setMyDocs([entry, ...docs.filter(d => d.document_id !== docId)].sort((a, b) => b.createdAt - a.createdAt));
      getMyDocuments().then(setServerDocs).catch(console.error);

      setProgressText(t('upload.parsing'));
      const timer = setInterval(async () => {
        try {
          const info = await getDocument(docId);
          setDocumentStatus(info.status);
          const pp = info.pages_parsed ?? 0;
          const ci = info.chunks_indexed ?? 0;
          setProgressText(pp === 0 && ci === 0
            ? t('upload.parsing')
            : t('upload.parsingProgress', { pagesParsed: pp, chunksIndexed: ci }));
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
    } catch (e: any) {
      setProgressText(t('upload.networkError'));
      setUploading(false);
    }
  }, [router, setDocument, setDocumentStatus, t]);

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

  /* --- Logged-out landing page --- */
  if (!isLoggedIn) {
    return (
      <div className="flex flex-col min-h-screen bg-white dark:bg-zinc-950">
        <Header variant="minimal" />

        <HeroSection />

        {/* Product Showcase */}
        <section className="max-w-5xl mx-auto px-6 py-16">
          <div className="border-t border-dashed border-zinc-300 dark:border-zinc-700 pt-12">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 text-center mb-8">
              {t('landing.showcase.title')}
            </h2>
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden">
              <Image
                src="/showcase.png"
                alt="DocTalk — PDF chat with citations"
                width={1200}
                height={675}
                className="w-full h-auto"
                priority
              />
            </div>
            <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 mt-4">
              {t('landing.showcase.caption')}
            </p>
          </div>
        </section>

        <FeatureGrid />

        {/* Privacy Badge */}
        <section className="py-8 flex justify-center">
          <PrivacyBadge />
        </section>
      </div>
    );
  }

  /* --- Logged-in dashboard --- */
  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-zinc-950">
      <Header variant="full" />
      <main className="flex-1 flex flex-col items-center p-8 gap-10">
        <div className="max-w-4xl w-full">
          <div className="mb-4 flex justify-center">
            <PrivacyBadge />
          </div>

          <div
            className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-200 ${
              isDragging
                ? 'border-zinc-500 bg-zinc-50 dark:bg-zinc-900'
                : 'border-zinc-300 dark:border-zinc-700'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={onInputChange} />
            <p className="text-zinc-700 dark:text-zinc-300 text-lg">{t('upload.dragDrop')}</p>
            <p className="text-zinc-400 text-sm mt-1">{t('upload.or')}</p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-4 px-6 py-2.5 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all duration-200"
              disabled={uploading}
            >
              {t('upload.chooseFile')}
            </button>
            {progressText && (
              <div className={`mt-4 text-sm ${uploading ? 'text-zinc-500' : 'text-red-600 dark:text-red-400'}`}>
                {progressText}
              </div>
            )}
          </div>

          <div className="mt-3 text-center">
            <Link href="/demo" className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 text-sm transition-colors">
              {t('home.cta.tryDemo')}
            </Link>
          </div>
        </div>

        <div className="max-w-4xl w-full">
          <h2 className="text-xl font-semibold mb-4 text-zinc-900 dark:text-zinc-100">{t('doc.myDocuments')}</h2>
          {allDocs.length === 0 ? (
            <p className="text-zinc-500 text-sm">{t('doc.noDocuments')}</p>
          ) : (
            <div className="space-y-2">
              {allDocs.map((d) => (
                <div
                  key={d.document_id}
                  className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:shadow-md transition-all duration-200 flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">
                      {d.filename || d.document_id}
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      {new Date(d.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="px-4 py-1.5 text-sm bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all duration-200"
                      onClick={() => router.push(`/d/${d.document_id}`)}
                    >
                      {t('doc.open')}
                    </button>
                    <button
                      className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors"
                      onClick={async () => {
                        if (!window.confirm(t('doc.deleteDocConfirm'))) return;
                        try { await deleteDocument(d.document_id); } catch {}
                        const docs: StoredDoc[] = JSON.parse(localStorage.getItem('doctalk_docs') || '[]');
                        const next = docs.filter((x) => x.document_id !== d.document_id);
                        localStorage.setItem('doctalk_docs', JSON.stringify(next));
                        setMyDocs(next.sort((a, b) => b.createdAt - a.createdAt));
                        setServerDocs((prev) => prev.filter((s) => s.id !== d.document_id));
                      }}
                      title={t('doc.deleteDoc')}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
```

## IMPORTANT NOTES
- `Image` from `next/image` is used for the showcase screenshot. If `/showcase.png` doesn't exist yet that's fine — it will show a broken image placeholder for now.
- Keep all existing functional logic (upload, polling, delete, localStorage merge) exactly the same.
- The Header component is the EXACT file listed above — replace the entire file.
- Create the `frontend/src/components/landing/` directory if it doesn't exist.
- All color classes use `zinc-*` instead of `gray-*` or `blue-*`.
- Dark mode uses `dark:bg-zinc-950` as page background, `dark:text-zinc-*` for text.
- Primary buttons: `bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900`
