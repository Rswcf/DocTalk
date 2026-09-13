"use client";

import { useCallback, useEffect, useState } from 'react';
import { getMyDocuments, type DocumentBrief, type DocumentListOptions } from './api';

const PAGE_SIZE = 20;

export function useDocumentLibrary(enabled: boolean, accountKey: string) {
  const [documents, setDocuments] = useState<DocumentBrief[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState({ q: '', sort: 'newest' as NonNullable<DocumentListOptions['sort']>, page: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [hasNext, setHasNext] = useState(false);
  const [revision, setRevision] = useState(0);
  const [loadedAccount, setLoadedAccount] = useState('');
  const [loadedFilter, setLoadedFilter] = useState<typeof filter | null>(null);
  const refresh = useCallback(() => setRevision(value => value + 1), []);

  useEffect(() => {
    const timer = setTimeout(() => setFilter(current => current.q === query.trim() ? current : { ...current, q: query.trim(), page: 0 }), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!enabled) {
      setDocuments([]);
      setLoadedAccount('');
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(false);

    getMyDocuments(controller.signal, { q: filter.q, sort: filter.sort, limit: PAGE_SIZE + 1, offset: filter.page * PAGE_SIZE })
      .then(items => {
        if (controller.signal.aborted) return;
        if (!items.length && filter.page > 0) {
          setFilter(current => ({ ...current, page: current.page - 1 }));
          return;
        }
        setDocuments(items.slice(0, PAGE_SIZE));
        setLoadedAccount(accountKey);
        setLoadedFilter(filter);
        setHasNext(items.length > PAGE_SIZE);
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [enabled, accountKey, filter, revision]);

  return {
    documents: loadedAccount === accountKey && loadedFilter === filter ? documents : [], setDocuments,
    query, setQuery, sort: filter.sort, page: filter.page, searching: Boolean(filter.q), loading, error, hasNext,
    refresh,
    setSort: (sort: NonNullable<DocumentListOptions['sort']>) => setFilter(current => ({ ...current, sort, page: 0 })),
    previous: () => setFilter(current => ({ ...current, page: Math.max(0, current.page - 1) })),
    next: () => setFilter(current => ({ ...current, page: current.page + 1 })),
  };
}
