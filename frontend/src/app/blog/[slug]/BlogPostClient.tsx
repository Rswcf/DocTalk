"use client";

import React, { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeft, Clock, Calendar, Tag, ArrowRight } from 'lucide-react';
import Header from '../../../components/Header';
import Footer from '../../../components/Footer';
import type { BlogPost } from '../../../lib/blog';

const CATEGORY_LABELS: Record<string, string> = {
  guides: 'Guides',
  comparisons: 'Comparisons',
  'use-cases': 'Use Cases',
  product: 'Product',
  'ai-insights': 'AI Insights',
};

interface TocItem {
  id: string;
  text: string;
  level: number;
}

function extractToc(content: string): TocItem[] {
  const headingRegex = /^(#{2,3})\s+(.+)$/gm;
  const items: TocItem[] = [];
  let match;
  while ((match = headingRegex.exec(content)) !== null) {
    const text = match[2].trim();
    const id = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');
    items.push({ id, text, level: match[1].length });
  }
  return items;
}

function StickyTOC({ items }: { items: TocItem[] }) {
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    const headings = items.map((item) => document.getElementById(item.id)).filter(Boolean) as HTMLElement[];
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 }
    );

    headings.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  return (
    <nav className="hidden lg:block sticky top-24 self-start">
      <h2 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 mb-3 uppercase tracking-wider">
        On this page
      </h2>
      <ul className="space-y-1 border-l border-zinc-200 dark:border-zinc-800">
        {items.map((item) => (
          <li key={item.id} className={item.level === 3 ? 'ml-0' : ''}>
            <a
              href={`#${item.id}`}
              className={`block text-[13px] leading-snug py-1 transition-colors duration-150 ${
                item.level === 3 ? 'pl-6' : 'pl-4'
              } ${
                activeId === item.id
                  ? 'text-indigo-600 dark:text-indigo-400 border-l-2 border-indigo-600 dark:border-indigo-400 -ml-px font-medium'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function InlineTOC({ items }: { items: TocItem[] }) {
  if (items.length === 0) return null;
  return (
    <nav className="lg:hidden mb-10 p-5 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl">
      <h2 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 mb-3 uppercase tracking-wider">
        Table of Contents
      </h2>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.id} className={item.level === 3 ? 'ml-4' : ''}>
            <a
              href={`#${item.id}`}
              className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function RelatedPosts({ posts }: { posts: BlogPost[] }) {
  if (posts.length === 0) return null;
  return (
    <section className="mt-16 pt-10 border-t border-zinc-200 dark:border-zinc-800">
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-6">
        Related Articles
      </h2>
      <div className="grid gap-5 sm:grid-cols-2">
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="group block bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-[box-shadow,transform] duration-200"
          >
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-200 mb-2 leading-snug">
              {post.title}
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2">
              {post.description}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

interface BlogPostClientProps {
  post: BlogPost;
  relatedPosts: BlogPost[];
}

export default function BlogPostClient({ post, relatedPosts }: BlogPostClientProps) {
  const toc = useMemo(() => extractToc(post.content), [post.content]);

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
      <Header variant="minimal" />

      <main className="flex-1">
        {/* Back link */}
        <div className="max-w-5xl mx-auto px-6 pt-8">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            <ArrowLeft size={14} />
            Back to Blog
          </Link>
        </div>

        {/* Post Header */}
        <header className="max-w-5xl mx-auto px-6 pt-6 pb-8">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 mb-4">
              <Link
                href={`/blog/category/${post.category}`}
                className="inline-block px-2.5 py-0.5 text-xs font-medium rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                {CATEGORY_LABELS[post.category] || post.category}
              </Link>
              <span className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                <Clock size={12} />
                {post.readingTime}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 leading-tight tracking-tight">
              {post.title}
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed">
              {post.description}
            </p>
            <div className="flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {post.author}
              </span>
              <span className="flex items-center gap-1">
                <Calendar size={12} />
                {new Date(post.date).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
              {post.updated !== post.date && (
                <span className="text-xs">
                  Updated{' '}
                  {new Date(post.updated).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Separator */}
        <div className="max-w-5xl mx-auto px-6">
          <div className="border-t border-zinc-200 dark:border-zinc-800" />
        </div>

        {/* Content with sidebar TOC */}
        <article className="max-w-5xl mx-auto px-6 pt-10 pb-16">
          <div className="lg:grid lg:grid-cols-[1fr_220px] lg:gap-12">
            {/* Main content */}
            <div className="min-w-0">
              <InlineTOC items={toc} />

              <div className="prose prose-zinc dark:prose-invert max-w-none prose-headings:scroll-mt-20 prose-headings:tracking-tight prose-a:text-indigo-600 dark:prose-a:text-indigo-400 prose-a:no-underline hover:prose-a:underline prose-img:rounded-xl prose-table:text-sm prose-p:text-zinc-600 dark:prose-p:text-zinc-400 prose-li:text-zinc-600 dark:prose-li:text-zinc-400">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h2: ({ children, ...props }) => {
                      const text = typeof children === 'string' ? children : String(children);
                      const id = text
                        .toLowerCase()
                        .replace(/[^\w\s-]/g, '')
                        .replace(/\s+/g, '-');
                      return <h2 id={id} {...props}>{children}</h2>;
                    },
                    h3: ({ children, ...props }) => {
                      const text = typeof children === 'string' ? children : String(children);
                      const id = text
                        .toLowerCase()
                        .replace(/[^\w\s-]/g, '')
                        .replace(/\s+/g, '-');
                      return <h3 id={id} {...props}>{children}</h3>;
                    },
                    a: ({ href, children, ...props }) => {
                      const isInternal = href?.startsWith('/');
                      if (isInternal) {
                        return (
                          <Link href={href!} {...props}>
                            {children}
                          </Link>
                        );
                      }
                      return (
                        <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                          {children}
                        </a>
                      );
                    },
                  }}
                >
                  {post.content}
                </ReactMarkdown>
              </div>

              {/* Tags */}
              {post.tags.length > 0 && (
                <div className="mt-10 flex items-center gap-2 flex-wrap">
                  <Tag size={14} className="text-zinc-400 dark:text-zinc-500" />
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-0.5 text-xs rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Author Box */}
              <div className="mt-12 p-6 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                  About DocTalk
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4 leading-relaxed">
                  DocTalk is an AI-powered document chat app. Upload any document
                  and get instant answers with source citations that highlight in your
                  original text. Supports PDF, DOCX, PPTX, XLSX, and more in 11
                  languages.
                </p>
                <div className="flex gap-3">
                  <Link
                    href="/demo"
                    className="group inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2"
                  >
                    Try Free Demo
                    <ArrowRight className="ml-1.5 w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                  <Link
                    href="/"
                    className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2"
                  >
                    Learn More
                  </Link>
                </div>
              </div>

              {/* CTA Banner */}
              <div className="mt-10 relative overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
                <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 dark:from-zinc-100 dark:via-zinc-50 dark:to-zinc-100" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent" />
                <div className="relative px-8 py-10 text-center">
                  <h3 className="text-xl font-semibold text-white dark:text-zinc-900 mb-2">
                    Try DocTalk Free — No Signup Required
                  </h3>
                  <p className="text-sm text-zinc-400 dark:text-zinc-600 mb-5 max-w-md mx-auto">
                    Chat with sample documents and see AI-powered answers with real-time
                    source citations. No account needed.
                  </p>
                  <Link
                    href="/demo"
                    className="group inline-flex items-center px-6 py-2.5 text-sm font-medium rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    Launch Demo
                    <ArrowRight className="ml-1.5 w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </div>

              <RelatedPosts posts={relatedPosts} />
            </div>

            {/* Sidebar TOC (desktop) */}
            <StickyTOC items={toc} />
          </div>
        </article>
      </main>

      <Footer />
    </div>
  );
}
