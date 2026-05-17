"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ArrowRight, FileText, FolderOpen, Layers, Plus } from 'lucide-react';
import Header from '../../components/Header';
import CollectionList from '../../components/Collections/CollectionList';
import CreateCollectionModal from '../../components/Collections/CreateCollectionModal';
import { listCollections, deleteCollection } from '../../lib/api';
import { useLocale } from '../../i18n';
import type { CollectionBrief } from '../../types';
import { usePageTitle } from '../../lib/usePageTitle';
import { LoadingScreen } from '../../components/ui/LoadingScreen';

export default function CollectionsPageClient() {
  const router = useRouter();
  const { status } = useSession();
  const { t, tOr } = useLocale();
  usePageTitle(t('collections.title'));
  const [collections, setCollections] = useState<CollectionBrief[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectReadyOnCreateOpen, setSelectReadyOnCreateOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const openedCreateFromQueryRef = useRef(false);

  useEffect(() => {
    if (status === 'authenticated') {
      listCollections().then(setCollections).catch(console.error);
    }
  }, [status]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth?callbackUrl=/collections');
    }
  }, [router, status]);

  useEffect(() => {
    if (status !== 'authenticated' || openedCreateFromQueryRef.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') !== 'create') return;

    openedCreateFromQueryRef.current = true;
    setSelectReadyOnCreateOpen(params.get('select') === 'ready');
    setShowCreate(true);
    window.history.replaceState(null, '', window.location.pathname);
  }, [status]);

  const totalDocuments = useMemo(
    () => collections.reduce((sum, collection) => sum + collection.document_count, 0),
    [collections]
  );

  const latestCollection = useMemo(() => {
    if (collections.length === 0) return null;
    return collections.reduce((latest, collection) => (
      new Date(collection.created_at).getTime() > new Date(latest.created_at).getTime()
        ? collection
        : latest
    ), collections[0]);
  }, [collections]);

  const stats = [
    {
      icon: Layers,
      label: tOr('collections.stats.collections', 'Collections'),
      value: collections.length.toLocaleString(),
    },
    {
      icon: FileText,
      label: tOr('collections.stats.documents', 'Documents organized'),
      value: totalDocuments.toLocaleString(),
    },
    {
      icon: FolderOpen,
      label: tOr('collections.stats.latest', 'Latest workspace'),
      value: latestCollection ? latestCollection.name : tOr('collections.stats.none', 'None yet'),
      clamp: true,
    },
  ];

  if (status === 'loading') {
    return <LoadingScreen label={t('common.loading')} />;
  }

  if (status !== 'authenticated') {
    return <LoadingScreen label={t('common.loading')} />;
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteCollection(id);
      setCollections(prev => prev.filter(c => c.id !== id));
    } catch (e) {
      console.error('Failed to delete collection:', e);
    }
    setDeletingId(null);
  };

  return (
    <div className="dt-stitch-theme flex flex-col min-h-screen">
      <Header variant="full" />
      <main className="flex-1 px-6 py-8 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <section className="mb-8 grid gap-5 lg:grid-cols-[1fr_420px] lg:items-end">
            <div>
              <p className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                {tOr('collections.eyebrow', 'Document workspaces')}
              </p>
              <h1 className="font-serif text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                {t('collections.title')}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-300 sm:text-base">
                {tOr(
                  'collections.workspaceSubtitle',
                  'Group related files, return to active research, and keep document-heavy projects separate from one-off uploads.'
                )}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="grid grid-cols-3 gap-3">
                {stats.map(({ icon: Icon, label, value, clamp }) => (
                  <div key={label} className="min-w-0 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
                    <Icon aria-hidden="true" size={16} className="mb-2 text-accent" />
                    <div className={`text-lg font-semibold text-zinc-900 dark:text-zinc-50 ${clamp ? 'truncate' : ''}`}>
                      {value}
                    </div>
                    <div className="mt-1 text-[11px] font-medium leading-4 text-zinc-500 dark:text-zinc-400">
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="mb-5 flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {tOr('collections.libraryTitle', 'Workspace library')}
              </h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {tOr('collections.librarySubtitle', 'Open a collection to review its files and start a multi-document chat.')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectReadyOnCreateOpen(false);
                setShowCreate(true);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
            >
              <Plus aria-hidden="true" size={16} />
              {t('collections.create')}
            </button>
          </div>

          {collections.length === 0 ? (
            <div className="overflow-hidden rounded-xl border border-dashed border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900">
              <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="flex flex-col justify-center p-8 sm:p-10">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
                    <FolderOpen size={22} className="text-accent" />
                  </div>
                  <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                    {t('collections.emptyTitle')}
                  </h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                    {t('collections.emptySubtitle')}
                  </p>
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectReadyOnCreateOpen(false);
                        setShowCreate(true);
                      }}
                      className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
                    >
                      <Plus aria-hidden="true" size={16} />
                      {t('collections.create')}
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push('/')}
                      className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
                    >
                      {tOr('collections.uploadFirst', 'Upload a document first')}
                      <ArrowRight aria-hidden="true" size={15} />
                    </button>
                  </div>
                </div>
                <div className="border-t border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-950 lg:border-l lg:border-t-0">
                  <div className="grid gap-3">
                    {[
                      tOr('collections.emptyStep1', 'Create a workspace for a client, class, case, or research thread.'),
                      tOr('collections.emptyStep2', 'Add related documents so citations stay grouped by project.'),
                      tOr('collections.emptyStep3', 'Open the collection to ask cross-document questions.'),
                    ].map((step, index) => (
                      <div key={step} className="flex gap-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-zinc-900 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-950">
                          {index + 1}
                        </span>
                        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <CollectionList
              collections={collections}
              onDelete={handleDelete}
              deletingId={deletingId}
            />
          )}
        </div>
      </main>

      <CreateCollectionModal
        isOpen={showCreate}
        selectReadyOnOpen={selectReadyOnCreateOpen}
        onClose={() => {
          setShowCreate(false);
          setSelectReadyOnCreateOpen(false);
        }}
        onCreated={(id) => {
          router.push(`/collections/${id}`);
        }}
      />
    </div>
  );
}
