"use client";

import { useState } from 'react';
import Link from 'next/link';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { BookOpen } from 'lucide-react';
import type { BlogPost } from '../../lib/blog';

const CATEGORY_LABELS: Record<string, string> = {
  all: 'All Posts',
  guides: 'Guides',
  comparisons: 'Comparisons',
  'use-cases': 'Use Cases',
  product: 'Product',
  'ai-insights': 'AI Insights',
};

function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="inline-block px-2.5 py-0.5 text-xs font-medium rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
      {CATEGORY_LABELS[category] || category}
    </span>
  );
}

function PostCard({ post }: { post: BlogPost }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group block bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-[box-shadow,transform] duration-200"
    >
      <div className="flex items-center gap-3 mb-3">
        <CategoryBadge category={post.category} />
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {post.readingTime}
        </span>
      </div>
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-200 mb-2 leading-snug">
        {post.title}
      </h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2 mb-4 leading-relaxed">
        {post.description}
      </p>
      <time className="text-xs text-zinc-500 dark:text-zinc-500">
        {new Date(post.date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
      </time>
    </Link>
  );
}

interface BlogIndexClientProps {
  posts: BlogPost[];
}

export default function BlogIndexClient({ posts }: BlogIndexClientProps) {
  const [activeCategory, setActiveCategory] = useState('all');

  const categories = ['all', ...Array.from(new Set(posts.map((p) => p.category)))];

  const filtered =
    activeCategory === 'all'
      ? posts
      : posts.filter((p) => p.category === activeCategory);

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
      <Header variant="minimal" />

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 pt-24 pb-16">
            <div className="flex items-center gap-3 mb-6">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800">
                <BookOpen className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                DocTalk Blog
              </h1>
            </div>
            <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl">
              Guides, comparisons, and tips for AI document analysis. Learn how
              to chat with PDFs, Word documents, and more.
            </p>
          </div>
        </section>

        {/* Filters + Grid */}
        <section className="max-w-4xl mx-auto px-6 py-12">
          {/* Category Filters */}
          <div className="flex flex-wrap gap-2 mb-10">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-1.5 text-sm font-medium rounded-full border cursor-pointer transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 ${
                  activeCategory === cat
                    ? 'bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-50'
                    : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600'
                }`}
              >
                {CATEGORY_LABELS[cat] || cat}
              </button>
            ))}
          </div>

          {/* Post Grid */}
          {filtered.length === 0 ? (
            <p className="text-center text-zinc-500 dark:text-zinc-400 py-16">
              No posts in this category yet.
            </p>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              {filtered.map((post) => (
                <PostCard key={post.slug} post={post} />
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
