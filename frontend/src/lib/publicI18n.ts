export const BLOG_CATEGORY_TRANSLATION_KEYS: Record<string, string> = {
  all: 'blog.category.all',
  guides: 'blog.category.guides',
  comparisons: 'blog.category.comparisons',
  'use-cases': 'blog.category.useCases',
  product: 'blog.category.product',
  'ai-insights': 'blog.category.aiInsights',
};

export function getBlogCategoryLabel(
  t: (key: string, params?: Record<string, string | number>) => string,
  category: string,
) {
  return BLOG_CATEGORY_TRANSLATION_KEYS[category] ? t(BLOG_CATEGORY_TRANSLATION_KEYS[category]) : category;
}

export function formatDateForLocale(locale: string, value: string | Date) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) {
    return String(value ?? '');
  }

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}
