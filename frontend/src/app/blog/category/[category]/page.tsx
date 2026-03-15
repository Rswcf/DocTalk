import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPostsByCategory, CATEGORY_META } from '../../../../lib/blog';
import CategoryClient from './CategoryClient';
import { buildMarketingMetadata } from '../../../../lib/seo';

interface Props {
  params: { category: string };
}

const KNOWN_CATEGORIES = ['guides', 'comparisons', 'use-cases', 'product', 'ai-insights'];

export function generateStaticParams() {
  return KNOWN_CATEGORIES.map((category) => ({ category }));
}

export function generateMetadata({ params }: Props): Metadata {
  const meta = CATEGORY_META[params.category];
  if (!meta) return {};

  return buildMarketingMetadata({
    title: `${meta.label} Articles`,
    description: meta.description,
    path: `/blog/category/${params.category}`,
    openGraph: {
      title: `${meta.label} | DocTalk Blog`,
    },
  });
}

export default function CategoryPage({ params }: Props) {
  const meta = CATEGORY_META[params.category];
  if (!meta) notFound();

  const posts = getPostsByCategory(params.category);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: `${meta.label} — DocTalk Blog`,
            description: meta.description,
            url: `https://www.doctalk.site/blog/category/${params.category}`,
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              {
                '@type': 'ListItem',
                position: 1,
                name: 'Home',
                item: 'https://www.doctalk.site',
              },
              {
                '@type': 'ListItem',
                position: 2,
                name: 'Blog',
                item: 'https://www.doctalk.site/blog',
              },
              {
                '@type': 'ListItem',
                position: 3,
                name: meta.label,
              },
            ],
          }),
        }}
      />
      <CategoryClient
        category={params.category}
        label={meta.label}
        description={meta.description}
        posts={posts}
      />
    </>
  );
}
