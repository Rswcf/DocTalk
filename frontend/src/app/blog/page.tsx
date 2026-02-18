import type { Metadata } from 'next';
import { getAllPosts } from '../../lib/blog';
import BlogIndexClient from './BlogIndexClient';

export const metadata: Metadata = {
  title: 'Blog',
  description:
    'Guides, comparisons, and tips for AI document analysis. Learn how to chat with PDFs, DOCX, PPTX, and more.',
  alternates: { canonical: '/blog' },
  openGraph: {
    title: 'Blog | DocTalk',
    description:
      'Guides, comparisons, and tips for AI document analysis. Learn how to chat with PDFs, DOCX, PPTX, and more.',
    url: 'https://www.doctalk.site/blog',
  },
};

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
