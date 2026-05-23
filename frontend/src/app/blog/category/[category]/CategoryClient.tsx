"use client";

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { BlogPost } from '../../../../lib/blog';
import { useLocale } from '../../../../i18n';
import { formatDateForLocale, getBlogCategoryLabel } from '../../../../lib/publicI18n';
import MarketingShell from '../../../../components/marketing/MarketingShell';
import EdPageHero from '../../../../components/marketing/EdPageHero';
import EdSection from '../../../../components/marketing/EdSection';

interface CategoryClientProps {
  category: string;
  label: string;
  description: string;
  posts: BlogPost[];
}

const RELATED_LINK_KEYS: Record<string, { href: string; labelKey: string }[]> = {
  comparisons: [
    { href: '/compare', labelKey: 'blog.category.related.compareTools' },
    { href: '/alternatives', labelKey: 'blog.category.related.browseAlternatives' },
    { href: '/pricing', labelKey: 'blog.category.related.reviewPricing' },
  ],
  guides: [
    { href: '/features', labelKey: 'blog.category.related.exploreFeatures' },
    { href: '/demo', labelKey: 'blog.category.related.tryDemo' },
    { href: '/use-cases', labelKey: 'blog.category.related.seeUseCases' },
  ],
  'use-cases': [
    { href: '/use-cases', labelKey: 'blog.category.related.useCaseHub' },
    { href: '/features/citations', labelKey: 'blog.category.related.citationHighlighting' },
    { href: '/features/multi-format', labelKey: 'blog.category.related.multiFormatSupport' },
  ],
  product: [
    { href: '/pricing', labelKey: 'blog.category.related.pricingOverview' },
    { href: '/features/performance-modes', labelKey: 'blog.category.related.performanceModes' },
    { href: '/demo', labelKey: 'blog.category.related.tryDemo' },
  ],
  'ai-insights': [
    { href: '/blog', labelKey: 'blog.category.related.allBlogPosts' },
    { href: '/compare', labelKey: 'blog.category.related.commercialComparisons' },
    { href: '/alternatives', labelKey: 'blog.category.related.alternativeRoundups' },
  ],
};

export default function CategoryClient({
  category,
  label,
  description,
  posts,
}: CategoryClientProps) {
  const { locale, t, tOr } = useLocale();
  const relatedLinks = RELATED_LINK_KEYS[category] ?? RELATED_LINK_KEYS.guides;
  const categoryLinks = [
    { href: '/blog/category/guides', label: getBlogCategoryLabel(t, 'guides'), key: 'guides' },
    { href: '/blog/category/comparisons', label: getBlogCategoryLabel(t, 'comparisons'), key: 'comparisons' },
    { href: '/blog/category/use-cases', label: getBlogCategoryLabel(t, 'use-cases'), key: 'use-cases' },
    { href: '/blog/category/product', label: getBlogCategoryLabel(t, 'product'), key: 'product' },
    { href: '/blog/category/ai-insights', label: getBlogCategoryLabel(t, 'ai-insights'), key: 'ai-insights' },
  ];
  const localizedLabel = getBlogCategoryLabel(t, category);
  const localizedDescription = t(`blog.category.description.${category}`);
  const resolvedDescription =
    localizedDescription === `blog.category.description.${category}` ? description : localizedDescription;

  return (
    <MarketingShell
      breadcrumb={[
        { label: tOr('blog.breadcrumb.home', 'Home'), href: '/' },
        { label: t('blog.index.title'), href: '/blog' },
        { label: localizedLabel },
      ]}
    >
      <EdPageHero
        eyebrow={t('blog.index.title')}
        title={localizedLabel}
        lede={resolvedDescription}
        meta={
          <Link href="/blog" className="ed-link">
            <ArrowLeft size={14} aria-hidden="true" />
            {t('blog.category.backAllPosts')}
          </Link>
        }
      />

      <EdSection>
        {/* Category chips */}
        <div className="flex flex-wrap" style={{ gap: '10px', marginBottom: '40px' }}>
          {categoryLinks.map((item) => {
            const isActive = item.key === category;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="ed-label"
                aria-current={isActive ? 'page' : undefined}
                style={{
                  padding: '6px 14px',
                  borderRadius: '3px',
                  border: '1px solid',
                  borderColor: isActive ? 'var(--ed-ink)' : 'var(--ed-rule)',
                  background: isActive ? 'var(--ed-ink)' : 'var(--ed-paper-2)',
                  color: isActive ? 'var(--ed-paper)' : 'var(--ed-ink-3)',
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Continue-from-topic panel */}
        <div className="ed-card" style={{ marginBottom: '40px' }}>
          <h2 className="ed-h3">{t('blog.category.panel.title')}</h2>
          <p className="ed-body" style={{ marginTop: '8px', marginBottom: '16px' }}>
            {t('blog.category.panel.description')}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {relatedLinks.map((item) => (
              <Link key={item.href} href={item.href} className="ed-link">
                {t(item.labelKey)}
              </Link>
            ))}
          </div>
        </div>

        {/* Post grid */}
        {posts.length === 0 ? (
          <div
            className="ed-card flex flex-col items-center text-center"
            style={{ padding: '56px 24px' }}
            role="status"
          >
            <h3 className="ed-h3">{t('blog.category.empty')}</h3>
            <Link href="/blog" className="ed-cta" style={{ marginTop: '20px' }}>
              {t('blog.category.browseAllPosts')}
            </Link>
          </div>
        ) : (
          <div
            className="grid grid-cols-1 sm:grid-cols-2"
            style={{ gap: '16px', gridAutoRows: '1fr' }}
          >
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="ed-card h-full"
                style={{ display: 'flex', flexDirection: 'column' }}
              >
                <div
                  className="flex items-center flex-wrap gap-x-3 gap-y-1"
                  style={{ marginBottom: '12px' }}
                >
                  <span className="ed-label" style={{ color: 'var(--ed-signal)' }}>
                    {localizedLabel}
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
            ))}
          </div>
        )}
      </EdSection>
    </MarketingShell>
  );
}
