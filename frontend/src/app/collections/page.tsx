"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Plus } from 'lucide-react';
import Header from '../../components/Header';
import CollectionList from '../../components/Collections/CollectionList';
import CreateCollectionModal from '../../components/Collections/CreateCollectionModal';
import { listCollections, deleteCollection } from '../../lib/api';
import { useLocale } from '../../i18n';
import type { CollectionBrief } from '../../types';

export default function CollectionsPage() {
  const router = useRouter();
  const { status } = useSession();
  const { t } = useLocale();
  const [collections, setCollections] = useState<CollectionBrief[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated') {
      listCollections().then(setCollections).catch(console.error);
    }
  }, [status]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center">
        <div className="animate-pulse text-zinc-400">{t('common.loading')}</div>
      </div>
    );
  }

  if (status !== 'authenticated') {
    router.push('/auth?callbackUrl=/collections');
    return null;
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteCollection(id);
      setCollections(prev => prev.filter(c => c.id !== id));
    } catch {}
    setDeletingId(null);
  };

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-zinc-950">
      <Header variant="full" />
      <main className="flex-1 flex flex-col items-center p-6 sm:p-8">
        <div className="max-w-4xl w-full">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              {t('collections.title')}
            </h1>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium text-sm hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
            >
              <Plus aria-hidden="true" size={16} />
              {t('collections.create')}
            </button>
          </div>

          <CollectionList
            collections={collections}
            onDelete={handleDelete}
            deletingId={deletingId}
          />
        </div>
      </main>

      <CreateCollectionModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(id) => {
          router.push(`/collections/${id}`);
        }}
      />
    </div>
  );
}
