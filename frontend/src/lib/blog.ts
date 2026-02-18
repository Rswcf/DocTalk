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
  const cats = new Set(posts.map((p) => p.category));
  return Array.from(cats);
}

export const CATEGORY_META: Record<string, { label: string; description: string }> = {
  guides: {
    label: 'Guides & Tutorials',
    description: 'Step-by-step guides for getting the most out of AI document analysis.',
  },
  comparisons: {
    label: 'Comparisons',
    description: 'Side-by-side comparisons of AI document tools to help you choose the right one.',
  },
  'use-cases': {
    label: 'Use Cases',
    description: 'Real-world applications of AI document chat across industries.',
  },
  product: {
    label: 'Product Updates',
    description: 'Latest features, improvements, and announcements from DocTalk.',
  },
  'ai-insights': {
    label: 'AI Insights',
    description: 'Deep dives into the AI technology behind document analysis.',
  },
};
