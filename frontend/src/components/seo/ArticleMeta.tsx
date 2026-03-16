"use client";

import { Calendar, Clock } from 'lucide-react';
import { useLocale } from '../../i18n';
import { formatDateForLocale } from '../../lib/publicI18n';

interface ArticleMetaProps {
  author: string;
  published: string;
  updated?: string;
  centered?: boolean;
  className?: string;
}

export default function ArticleMeta({
  author,
  published,
  updated,
  centered = false,
  className = '',
}: ArticleMetaProps) {
  const { locale, t } = useLocale();
  const layoutClassName = centered ? 'justify-center' : '';

  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-zinc-500 dark:text-zinc-300 ${layoutClassName} ${className}`.trim()}
    >
      <span className="flex items-center gap-1.5">
        <span>{t('blog.meta.by')}</span>
        <span className="font-medium text-zinc-900 dark:text-zinc-100">
          {author}
        </span>
      </span>
      <span className="flex items-center gap-1.5">
        <Calendar aria-hidden="true" size={14} />
        <span>{t('blog.meta.published')}</span>
        <time dateTime={published}>{formatDateForLocale(locale, published)}</time>
      </span>
      {updated && updated !== published ? (
        <span className="flex items-center gap-1.5">
          <Clock aria-hidden="true" size={14} />
          <span>{t('blog.meta.updated')}</span>
          <time dateTime={updated}>{formatDateForLocale(locale, updated)}</time>
        </span>
      ) : null}
    </div>
  );
}
