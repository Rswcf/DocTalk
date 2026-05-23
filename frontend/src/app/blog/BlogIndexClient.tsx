"use client";

import Link from 'next/link';
import { Inbox } from 'lucide-react';
import type { BlogPost } from '../../lib/blog';
import { useLocale } from '../../i18n';
import { formatDateForLocale, getBlogCategoryLabel } from '../../lib/publicI18n';
import MarketingShell from '../../components/marketing/MarketingShell';
import EdPageHero from '../../components/marketing/EdPageHero';
import EdSection from '../../components/marketing/EdSection';

function PostCard({ post }: { post: BlogPost }) {
  const { locale, t } = useLocale();

  return (
    <Link
      href={`/blog/${post.slug}`}
      className="ed-card h-full"
      style={{ display: 'flex', flexDirection: 'column' }}
    >
      <div className="flex items-center flex-wrap gap-x-3 gap-y-1" style={{ marginBottom: '12px' }}>
        <span className="ed-label" style={{ color: 'var(--ed-signal)' }}>
          {getBlogCategoryLabel(t, post.category)}
        </span>
        <span className="ed-caption">
          {t('blog.meta.minutesRead', { minutes: post.readingMinutes })}
        </span>
      </div>
      <h2 className="ed-h3">{post.title}</h2>
      <p className="ed-body" style={{ marginTop: '8px', flex: 1 }}>
        {post.description}
      </p>
      <time className="ed-caption" style={{ marginTop: '16px', display: 'block' }}>
        {formatDateForLocale(locale, post.date)}
      </time>
    </Link>
  );
}

interface BlogIndexClientProps {
  posts: BlogPost[];
}

export default function BlogIndexClient({ posts }: BlogIndexClientProps) {
  const { t, tOr } = useLocale();
  const categories = ['all', ...Array.from(new Set(posts.map((p) => p.category)))];

  return (
    <MarketingShell
      breadcrumb={[
        { label: tOr('blog.breadcrumb.home', 'Home'), href: '/' },
        { label: t('blog.index.title') },
      ]}
    >
      <EdPageHero
        eyebrow={t('blog.index.title')}
        title={t('blog.index.title')}
        lede={t('blog.index.description')}
      />

      <EdSection>
        {/* Category links */}
        <div className="flex flex-wrap" style={{ gap: '10px', marginBottom: '40px' }}>
          {categories.map((cat) => (
            <Link
              key={cat}
              href={cat === 'all' ? '/blog' : `/blog/category/${cat}`}
              className="ed-label"
              style={{
                padding: '6px 14px',
                border: '1px solid var(--ed-rule)',
                background: 'var(--ed-paper-2)',
                borderRadius: '3px',
              }}
            >
              {getBlogCategoryLabel(t, cat)}
            </Link>
          ))}
        </div>

        {/* High-intent research panel */}
        <div className="ed-card" style={{ marginBottom: '40px' }}>
          <h2 className="ed-h3">{t('blog.index.panel.title')}</h2>
          <p className="ed-body" style={{ marginTop: '8px', marginBottom: '16px', maxWidth: '620px' }}>
            {t('blog.index.panel.description')}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link href="/blog/category/comparisons" className="ed-link">
              {t('blog.index.panel.compareGuides')}
            </Link>
            <Link href="/compare" className="ed-link">
              {t('blog.index.panel.toolComparisons')}
            </Link>
            <Link href="/alternatives" className="ed-link">
              {t('blog.index.panel.alternatives')}
            </Link>
            <Link href="/use-cases" className="ed-link">
              {t('blog.index.panel.useCases')}
            </Link>
          </div>
        </div>

        {/* Post grid */}
        {posts.length === 0 ? (
          <div
            className="ed-card flex flex-col items-center text-center"
            style={{ padding: '56px 24px' }}
            role="status"
          >
            <span style={{ color: 'var(--ed-ink-3)', marginBottom: '14px' }}>
              <Inbox className="w-7 h-7" aria-hidden="true" />
            </span>
            <h3 className="ed-h3">{t('blog.index.empty')}</h3>
            <p className="ed-body" style={{ marginTop: '8px', maxWidth: '420px' }}>
              {tOr(
                'blog.index.emptyDescription',
                'New posts are added regularly. In the meantime, try DocTalk on a real document.'
              )}
            </p>
            <Link href="/demo" className="ed-cta" style={{ marginTop: '20px' }}>
              {tOr('blog.index.emptyAction', 'Try the free demo')}
            </Link>
          </div>
        ) : (
          <div
            className="grid grid-cols-1 sm:grid-cols-2"
            style={{ gap: '16px', gridAutoRows: '1fr' }}
          >
            {posts.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
        )}
      </EdSection>
    </MarketingShell>
  );
}
