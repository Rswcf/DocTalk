"use client";

import Link from 'next/link';
import { ArrowLeft, Clock } from 'lucide-react';
import Header from '../../../../components/Header';
import Footer from '../../../../components/Footer';
import type { BlogPost } from '../../../../lib/blog';
import { useLocale } from '../../../../i18n';
import { formatDateForLocale, getBlogCategoryLabel } from '../../../../lib/publicI18n';

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
  const { locale, t } = useLocale();
  const relatedLinks = RELATED_LINK_KEYS[category] ?? RELATED_LINK_KEYS.guides;
  const categoryLinks = [
    { href: '/blog/category/guides', label: getBlogCategoryLabel(t, 'guides') },
    { href: '/blog/category/comparisons', label: getBlogCategoryLabel(t, 'comparisons') },
    { href: '/blog/category/use-cases', label: getBlogCategoryLabel(t, 'use-cases') },
    { href: '/blog/category/product', label: getBlogCategoryLabel(t, 'product') },
    { href: '/blog/category/ai-insights', label: getBlogCategoryLabel(t, 'ai-insights') },
  ];
  const localizedLabel = getBlogCategoryLabel(t, category);
  const localizedDescription = t(`blog.category.description.${category}`);

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
      <Header variant="minimal" />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <Link
              href="/blog"
              className="inline-flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors mb-6"
            >
              <ArrowLeft size={14} />
              {t('blog.category.backAllPosts')}
            </Link>
            <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              {localizedLabel}
            </h1>
            <p className="text-lg text-zinc-500 dark:text-zinc-300 max-w-2xl">
              {localizedDescription === `blog.category.description.${category}` ? description : localizedDescription}
            </p>
            <div className="flex flex-wrap gap-2 mt-6">
              {categoryLinks.map((item) => {
                const isActive = item.href.endsWith(`/${category}`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                      isActive
                        ? 'bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-50'
                        : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* Grid */}
        <section className="max-w-4xl mx-auto px-6 py-12">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 p-6 mb-10">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              {t('blog.category.panel.title')}
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-4">
              {t('blog.category.panel.description')}
            </p>
            <div className="flex flex-wrap gap-3 text-sm">
              {relatedLinks.map((item, index) => (
                <span key={item.href} className="contents">
                  {index > 0 ? <span className="text-zinc-300 dark:text-zinc-700">|</span> : null}
                  <Link href={item.href} className="text-indigo-600 dark:text-indigo-400 hover:underline">
                    {t(item.labelKey)}
                  </Link>
                </span>
              ))}
            </div>
          </div>

          {posts.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-zinc-500 dark:text-zinc-300 mb-4">
                {t('blog.category.empty')}
              </p>
              <Link
                href="/blog"
                className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
              >
                {t('blog.category.browseAllPosts')}
              </Link>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              {posts.map((post) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="group block bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className="inline-block px-2.5 py-0.5 text-xs font-medium rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                      {localizedLabel}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-300">
                      <Clock size={12} />
                      {t('blog.meta.minutesRead', { minutes: post.readingMinutes })}
                    </span>
                  </div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors mb-2">
                    {post.title}
                  </h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-300 line-clamp-2 mb-4">
                    {post.description}
                  </p>
                  <time className="text-xs text-zinc-400 dark:text-zinc-500">
                    {formatDateForLocale(locale, post.date)}
                  </time>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
