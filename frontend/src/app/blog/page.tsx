import type { Metadata } from 'next';
import { getAllPosts } from '../../lib/blog';
import BlogIndexClient from './BlogIndexClient';
import { buildMarketingMetadata } from '../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'DocTalk Blog: Guides, Comparisons & Tips',
  description:
    'Read practical guides, product comparisons, and workflow tips for AI document analysis across PDFs, DOCX, PPTX, spreadsheets, and web pages.',
  path: '/blog',
  keywords: ['ai document blog', 'pdf chat guides', 'document ai tutorials'],
  openGraph: {
    title: 'AI Document Analysis Blog | DocTalk',
  },
});

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'DocTalk Blog',
            description:
              'Guides, comparisons, and tips for AI document analysis.',
            url: 'https://www.doctalk.site/blog',
            publisher: {
              '@type': 'Organization',
              name: 'DocTalk',
              url: 'https://www.doctalk.site',
            },
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
              { '@type': 'ListItem', position: 2, name: 'Blog' },
            ],
          }),
        }}
      />
      <BlogIndexClient posts={posts} />
    </>
  );
}
