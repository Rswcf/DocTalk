import { Calendar, Clock } from 'lucide-react';

interface ArticleMetaProps {
  author: string;
  published: string;
  updated?: string;
  centered?: boolean;
  className?: string;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(value));
}

export default function ArticleMeta({
  author,
  published,
  updated,
  centered = false,
  className = '',
}: ArticleMetaProps) {
  const layoutClassName = centered ? 'justify-center' : '';

  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-zinc-500 dark:text-zinc-400 ${layoutClassName} ${className}`.trim()}
    >
      <span className="font-medium text-zinc-900 dark:text-zinc-100">
        {author}
      </span>
      <span className="flex items-center gap-1.5">
        <Calendar aria-hidden="true" size={14} />
        <time dateTime={published}>{formatDate(published)}</time>
      </span>
      {updated && updated !== published ? (
        <span className="flex items-center gap-1.5">
          <Clock aria-hidden="true" size={14} />
          <span>Updated</span>
          <time dateTime={updated}>{formatDate(updated)}</time>
        </span>
      ) : null}
    </div>
  );
}
