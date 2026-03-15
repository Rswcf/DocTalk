import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import readingTime from 'reading-time';

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  updated: string;
  author: string;
  category: string;
  tags: string[];
  image: string;
  imageAlt: string;
  keywords: string[];
  content: string;
  readingTime: string;
}

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');

export const KNOWN_BLOG_CATEGORIES = [
  'guides',
  'comparisons',
  'use-cases',
  'product',
  'ai-insights',
] as const;

export function getAllPosts(): BlogPost[] {
  if (!fs.existsSync(BLOG_DIR)) return [];

  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.md'));

  const posts = files.map((filename) => {
    const slug = filename.replace(/\.md$/, '');
    return getPostBySlug(slug);
  });

  return posts
    .filter((p): p is BlogPost => p !== null)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getPostBySlug(slug: string): BlogPost | null {
  const filePath = path.join(BLOG_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);
  const stats = readingTime(content);

  return {
    slug,
    title: data.title || '',
    description: data.description || '',
    date: data.date || '',
    updated: data.updated || data.date || '',
    author: data.author || 'DocTalk Team',
    category: data.category || 'guides',
    tags: data.tags || [],
    image: data.image || '/blog/images/placeholder.png',
    imageAlt: data.imageAlt || '',
    keywords: data.keywords || [],
    content,
    readingTime: stats.text,
  };
}

export function getPostsByCategory(category: string): BlogPost[] {
  return getAllPosts().filter((p) => p.category === category);
}

export function getAllCategories(): string[] {
  const posts = getAllPosts();
  const cats = new Set<string>(KNOWN_BLOG_CATEGORIES);
  posts.forEach((post) => cats.add(post.category));
  return Array.from(cats);
}

export const CATEGORY_META: Record<string, { label: string; description: string }> = {
  guides: {
    label: 'Guides & Tutorials',
    description: 'Step-by-step guides for AI document analysis, including PDF chat, citation workflows, and practical ways to get better answers from DocTalk.',
  },
  comparisons: {
    label: 'Comparisons',
    description: 'Side-by-side comparisons of AI document tools, covering features, pricing, citation quality, and which product fits each workflow.',
  },
  'use-cases': {
    label: 'Use Cases',
    description: 'Real-world workflows for AI document chat across finance, legal, HR, research, and other document-heavy teams that need verifiable answers.',
  },
  product: {
    label: 'Product Updates',
    description: 'Latest DocTalk features, release notes, product improvements, roadmap updates, and announcements that affect how teams analyze documents.',
  },
  'ai-insights': {
    label: 'AI Insights',
    description: 'Deep dives into retrieval, citation systems, document parsing, and the AI workflow decisions behind DocTalk\'s document analysis stack.',
  },
};
