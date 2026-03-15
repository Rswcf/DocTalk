import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAllPosts, getPostBySlug } from '../../../lib/blog';
import BlogPostClient from './BlogPostClient';
import {
  buildArticleJsonLd,
  buildMarketingMetadata,
  DEFAULT_SHARE_ALT,
  resolveShareImage,
} from '../../../lib/seo';

interface Props {
  params: { slug: string };
}

export function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export function generateMetadata({ params }: Props): Metadata {
  const post = getPostBySlug(params.slug);
  if (!post) return {};

  const shareImage = resolveShareImage(post.image);

  return buildMarketingMetadata({
    title: post.title,
    description: post.description,
    path: `/blog/${post.slug}`,
    keywords: post.keywords,
    openGraph: {
      title: post.title,
      type: 'article',
      publishedTime: post.date,
      modifiedTime: post.updated,
      authors: [post.author],
      tags: post.tags,
      images: [
        {
          url: shareImage,
          width: 1200,
          height: 630,
          alt: post.imageAlt || DEFAULT_SHARE_ALT,
        },
      ],
    },
    twitter: {
      title: post.title,
      images: [shareImage],
    },
  });
}

export default function BlogPostPage({ params }: Props) {
  const post = getPostBySlug(params.slug);
  if (!post) notFound();

  const allPosts = getAllPosts();
  const related = allPosts
    .filter((p) => p.category === post.category && p.slug !== post.slug)
    .slice(0, 3);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            buildArticleJsonLd({
              title: post.title,
              description: post.description,
              path: `/blog/${post.slug}`,
              datePublished: post.date,
              dateModified: post.updated,
              authorName: post.author,
              imagePath: post.image,
              keywords: post.keywords,
            })
          ),
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
                name: post.title,
              },
            ],
          }),
        }}
      />
      <BlogPostClient post={post} relatedPosts={related} />
    </>
  );
}
