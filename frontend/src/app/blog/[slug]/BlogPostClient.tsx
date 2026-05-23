"use client";

import React, { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeft, ArrowRight, Calendar, Clock } from 'lucide-react';
import type { BlogPost } from '../../../lib/blog';
import { useLocale } from '../../../i18n';
import { formatDateForLocale, getBlogCategoryLabel } from '../../../lib/publicI18n';
import MarketingShell from '../../../components/marketing/MarketingShell';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function headingTextFromMarkdown(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function uniqueHeadingId(baseId: string, seen: Map<string, number>): string {
  const base = baseId || 'section';
  const count = seen.get(base) ?? 0;
  seen.set(base, count + 1);
  return count === 0 ? base : `${base}-${count + 1}`;
}

function getNodeText(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(getNodeText).join('');
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return getNodeText(node.props.children);
  }
  return '';
}

function extractToc(content: string): TocItem[] {
  const headingRegex = /^(#{2,3})\s+(.+)$/gm;
  const items: TocItem[] = [];
  const seen = new Map<string, number>();
  let match;
  while ((match = headingRegex.exec(content)) !== null) {
    const text = headingTextFromMarkdown(match[2].trim());
    const id = uniqueHeadingId(slugifyHeading(text), seen);
    items.push({ id, text, level: match[1].length });
  }
  return items;
}

function extractHeadingIdsByOffset(content: string): Map<number, string> {
  const headingRegex = /^(#{2,3})\s+(.+)$/gm;
  const ids = new Map<number, string>();
  const seen = new Map<string, number>();
  let match;
  while ((match = headingRegex.exec(content)) !== null) {
    const text = headingTextFromMarkdown(match[2].trim());
    ids.set(match.index, uniqueHeadingId(slugifyHeading(text), seen));
  }
  return ids;
}

function StickyTOC({ items }: { items: TocItem[] }) {
  const { t } = useLocale();
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
      <div className="ed-label" style={{ marginBottom: '14px' }}>
        {t('blog.post.onThisPage')}
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, borderLeft: '1px solid var(--ed-rule)' }}>
        {items.map((item) => {
          const isActive = activeId === item.id;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                style={{
                  display: 'block',
                  fontSize: '13px',
                  lineHeight: 1.4,
                  padding: '5px 0',
                  paddingLeft: item.level === 3 ? '24px' : '16px',
                  marginLeft: isActive ? '-1px' : undefined,
                  borderLeft: isActive ? '2px solid var(--ed-signal)' : undefined,
                  color: isActive ? 'var(--ed-signal)' : 'var(--ed-ink-3)',
                  fontWeight: isActive ? 500 : 400,
                  transition: 'color 150ms ease',
                }}
              >
                {item.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function InlineTOC({ items }: { items: TocItem[] }) {
  const { t } = useLocale();
  if (items.length === 0) return null;
  return (
    <nav className="lg:hidden ed-card" style={{ marginBottom: '40px' }}>
      <div className="ed-label" style={{ marginBottom: '14px' }}>
        {t('blog.post.tableOfContents')}
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {items.map((item) => (
          <li key={item.id} style={{ marginBottom: '8px', paddingLeft: item.level === 3 ? '16px' : 0 }}>
            <a
              href={`#${item.id}`}
              className="ed-body"
              style={{ color: 'var(--ed-ink-2)', textDecoration: 'none' }}
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
  const { t } = useLocale();
  if (posts.length === 0) return null;
  return (
    <section style={{ marginTop: '64px', paddingTop: '40px', borderTop: '1px solid var(--ed-rule)' }}>
      <h2 className="ed-h2" style={{ marginBottom: '24px' }}>
        {t('blog.post.relatedArticles')}
      </h2>
      <div
        className="grid grid-cols-1 sm:grid-cols-2"
        style={{ gap: '16px', gridAutoRows: '1fr' }}
      >
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="ed-card h-full"
            style={{ display: 'flex', flexDirection: 'column' }}
          >
            <h3 className="ed-h3">{post.title}</h3>
            <p className="ed-body" style={{ marginTop: '8px' }}>
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
  const { locale, t } = useLocale();
  const toc = useMemo(() => extractToc(post.content), [post.content]);
  const headingIdsByOffset = useMemo(() => extractHeadingIdsByOffset(post.content), [post.content]);
  const getHeadingId = (children: React.ReactNode, node: unknown) => {
    const offset = (node as { position?: { start?: { offset?: number } } } | undefined)
      ?.position?.start?.offset;
    return typeof offset === 'number'
      ? headingIdsByOffset.get(offset) || slugifyHeading(getNodeText(children))
      : slugifyHeading(getNodeText(children));
  };

  const localizedCategory = getBlogCategoryLabel(t, post.category);

  return (
    <MarketingShell
      breadcrumb={[
        { label: t('blog.index.title'), href: '/blog' },
        { label: localizedCategory, href: `/blog/category/${post.category}` },
        { label: post.title },
      ]}
    >
      {/* Back link */}
      <div className="ed-shell" style={{ paddingTop: '32px' }}>
        <Link href="/blog" className="ed-link">
          <ArrowLeft size={14} aria-hidden="true" />
          {t('blog.post.backToBlog')}
        </Link>
      </div>

      {/* Post header */}
      <header className="ed-shell" style={{ paddingTop: '24px', paddingBottom: '32px' }}>
        <div style={{ maxWidth: '760px' }}>
          <div className="flex items-center flex-wrap gap-x-3 gap-y-1" style={{ marginBottom: '16px' }}>
            <Link
              href={`/blog/category/${post.category}`}
              className="ed-label"
              style={{ color: 'var(--ed-signal)' }}
            >
              {localizedCategory}
            </Link>
            <span className="ed-caption flex items-center gap-1">
              <Clock size={12} aria-hidden="true" />
              {t('blog.meta.minutesRead', { minutes: post.readingMinutes })}
            </span>
          </div>
          <h1 className="ed-h1">{post.title}</h1>
          <p className="ed-lede" style={{ marginTop: '18px' }}>
            {post.description}
          </p>
          {/* Article meta — editorial mono treatment */}
          <div
            className="flex flex-wrap items-center gap-x-4 gap-y-2"
            style={{ marginTop: '20px' }}
          >
            <span className="ed-caption">
              {t('blog.meta.by')}{' '}
              <span style={{ color: 'var(--ed-ink-2)' }}>{post.author}</span>
            </span>
            <span className="ed-caption flex items-center gap-1.5">
              <Calendar size={13} aria-hidden="true" />
              {t('blog.meta.published')}{' '}
              <time dateTime={post.date}>{formatDateForLocale(locale, post.date)}</time>
            </span>
            {post.updated && post.updated !== post.date ? (
              <span className="ed-caption flex items-center gap-1.5">
                <Clock size={13} aria-hidden="true" />
                {t('blog.meta.updated')}{' '}
                <time dateTime={post.updated}>{formatDateForLocale(locale, post.updated)}</time>
              </span>
            ) : null}
          </div>
        </div>
      </header>

      {/* Separator */}
      <div className="ed-shell">
        <hr className="ed-rule" />
      </div>

      {/* Content with sidebar TOC */}
      <article className="ed-shell" style={{ paddingTop: '40px', paddingBottom: '64px' }}>
        <div className="lg:grid lg:grid-cols-[1fr_220px] lg:gap-12">
          {/* Main content */}
          <div className="min-w-0">
            <InlineTOC items={toc} />

            <div className="ed-prose" style={{ maxWidth: 'none' }}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h2: ({ children, node, ...props }) => {
                    const id = getHeadingId(children, node);
                    return (
                      <h2
                        id={id}
                        className="ed-h2"
                        style={{ scrollMarginTop: '96px', marginTop: '40px', marginBottom: '16px' }}
                        {...props}
                      >
                        {children}
                      </h2>
                    );
                  },
                  h3: ({ children, node, ...props }) => {
                    const id = getHeadingId(children, node);
                    return (
                      <h3
                        id={id}
                        className="ed-h3"
                        style={{ scrollMarginTop: '96px', marginTop: '28px', marginBottom: '10px' }}
                        {...props}
                      >
                        {children}
                      </h3>
                    );
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
                  table: ({ children, ...props }) => (
                    <div
                      style={{ margin: '32px 0', overflowX: 'auto' }}
                    >
                      <table
                        style={{
                          minWidth: '42rem',
                          borderCollapse: 'collapse',
                          textAlign: 'left',
                          fontSize: '14px',
                          color: 'var(--ed-ink-2)',
                        }}
                        {...props}
                      >
                        {children}
                      </table>
                    </div>
                  ),
                  th: ({ children, ...props }) => (
                    <th
                      style={{
                        border: '1px solid var(--ed-rule)',
                        background: 'var(--ed-paper-2)',
                        padding: '8px 12px',
                        fontWeight: 600,
                        color: 'var(--ed-ink)',
                      }}
                      {...props}
                    >
                      {children}
                    </th>
                  ),
                  td: ({ children, ...props }) => (
                    <td
                      style={{
                        border: '1px solid var(--ed-rule)',
                        padding: '8px 12px',
                        verticalAlign: 'top',
                      }}
                      {...props}
                    >
                      {children}
                    </td>
                  ),
                  pre: ({ children, ...props }) => (
                    <pre
                      style={{
                        overflowX: 'auto',
                        borderRadius: '4px',
                        border: '1px solid var(--ed-rule)',
                        background: 'var(--ed-paper-2)',
                        padding: '16px',
                        fontSize: '13.5px',
                        margin: '20px 0',
                      }}
                      {...props}
                    >
                      {children}
                    </pre>
                  ),
                  code: ({ className, children, ...props }) => (
                    <code
                      className={className || ''}
                      style={{
                        fontFamily: 'var(--dt-mono)',
                        fontSize: '0.92em',
                        overflowWrap: 'anywhere',
                      }}
                      {...props}
                    >
                      {children}
                    </code>
                  ),
                }}
              >
                {post.content}
              </ReactMarkdown>
            </div>

            {/* Tags */}
            {post.tags.length > 0 && (
              <div className="flex items-center flex-wrap" style={{ marginTop: '40px', gap: '8px' }}>
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="ed-label"
                    style={{
                      padding: '4px 10px',
                      border: '1px solid var(--ed-rule)',
                      background: 'var(--ed-paper-2)',
                      borderRadius: '3px',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Author box */}
            <div className="ed-card" style={{ marginTop: '48px' }}>
              <h3 className="ed-h3">{t('blog.post.aboutTitle')}</h3>
              <p className="ed-body" style={{ marginTop: '8px', marginBottom: '18px' }}>
                {t('blog.post.aboutDescription')}
              </p>
              <div className="flex flex-wrap items-center" style={{ gap: '16px' }}>
                <Link href="/demo" className="ed-cta">
                  {t('blog.post.tryFreeDemo')}
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </Link>
                <Link href="/features" className="ed-link">
                  {t('blog.post.exploreFeatures')} <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>

            {/* CTA banner */}
            <div
              style={{
                marginTop: '40px',
                border: '1px solid var(--ed-rule)',
                background: 'var(--ed-paper-2)',
                padding: '40px 32px',
                textAlign: 'center',
              }}
            >
              <h3 className="ed-h2">{t('blog.post.cta.title')}</h3>
              <p className="ed-body" style={{ marginTop: '12px', maxWidth: '440px', marginInline: 'auto' }}>
                {t('blog.post.cta.description')}
              </p>
              <div style={{ marginTop: '24px' }}>
                <Link href="/demo" className="ed-cta">
                  {t('blog.post.cta.launchDemo')}
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </Link>
              </div>
            </div>

            <RelatedPosts posts={relatedPosts} />
          </div>

          {/* Sidebar TOC (desktop) */}
          <StickyTOC items={toc} />
        </div>
      </article>
    </MarketingShell>
  );
}
