"use client";

import Link from 'next/link';
import { ArrowLeft, Clock } from 'lucide-react';
import Header from '../../../../components/Header';
import Footer from '../../../../components/Footer';
import type { BlogPost } from '../../../../lib/blog';

interface CategoryClientProps {
  category: string;
  label: string;
  description: string;
  posts: BlogPost[];
}

export default function CategoryClient({
  category,
  label,
  description,
  posts,
}: CategoryClientProps) {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
      <Header variant="minimal" />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <Link
              href="/blog"
              className="inline-flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors mb-6"
            >
              <ArrowLeft size={14} />
              All Posts
            </Link>
            <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              {label}
            </h1>
            <p className="text-lg text-zinc-500 dark:text-zinc-400 max-w-2xl">
              {description}
            </p>
          </div>
        </section>

        {/* Grid */}
        <section className="max-w-4xl mx-auto px-6 py-12">
          {posts.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-zinc-500 dark:text-zinc-400 mb-4">
                No posts in this category yet.
              </p>
              <Link
                href="/blog"
                className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
              >
                Browse All Posts
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
                    <span className="inline-block px-2.5 py-0.5 text-xs font-medium rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                      {label}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                      <Clock size={12} />
                      {post.readingTime}
                    </span>
                  </div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors mb-2">
                    {post.title}
                  </h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2 mb-4">
                    {post.description}
                  </p>
                  <time className="text-xs text-zinc-400 dark:text-zinc-500">
                    {new Date(post.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
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
