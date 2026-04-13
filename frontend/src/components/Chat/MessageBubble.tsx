"use client";

import React, { Suspense, useMemo, useState, useCallback, useEffect } from 'react';
import remarkGfm from 'remark-gfm';
import { Copy, Check, ThumbsUp, ThumbsDown, RotateCcw, ChevronsDown } from 'lucide-react';
import type { Citation, Message } from '../../types';
import { useLocale } from '../../i18n';
import CitationPopover from './CitationPopover';
import SourcesStrip from './SourcesStrip';
import { highlightCode } from '../../lib/highlight';

const ReactMarkdown = React.lazy(() => import('react-markdown'));

interface MessageBubbleProps {
  message: Message;
  onCitationClick?: (c: Citation) => void;
  isStreaming?: boolean;
  onRegenerate?: () => void;
  isLastAssistant?: boolean;
  onContinue?: () => void;
}

function insertCitationMarkers(text: string, citations: Citation[]): string {
  if (!citations || citations.length === 0) return text;
  const sorted = [...citations].sort((a, b) => b.offset - a.offset);
  let result = text;
  for (const c of sorted) {
    const idx = Math.max(0, Math.min(result.length, c.offset));
    result = result.slice(0, idx) + `[${c.refIndex}]` + result.slice(idx);
  }
  return result;
}

function processCitationLinks(
  children: React.ReactNode,
  citations: Citation[],
  onClick?: (c: Citation) => void,
  t?: (key: string, params?: Record<string, string | number>) => string,
): React.ReactNode {
  if (!citations || citations.length === 0) return children;

  return React.Children.map(children, (child) => {
    if (typeof child === 'string') {
      const parts: React.ReactNode[] = [];
      const regex = /\[(\d+)\]/g;
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      let keyIdx = 0;

      while ((match = regex.exec(child)) !== null) {
        if (match.index > lastIndex) {
          parts.push(child.slice(lastIndex, match.index));
        }
        const refNum = parseInt(match[1], 10);
        const citation = citations.find((c) => c.refIndex === refNum);
        if (citation) {
          parts.push(
            <CitationPopover key={`cite-${refNum}-${keyIdx++}`} citation={citation}>
              <button
                type="button"
                className="not-prose align-super mx-0.5 inline-flex items-center justify-center min-w-[1.125rem] h-[1.125rem] px-1 rounded-full text-[10px] font-semibold leading-none select-none cursor-pointer bg-zinc-100 text-zinc-600 hover:bg-indigo-100 hover:text-indigo-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-indigo-900/50 dark:hover:text-indigo-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                onClick={() => onClick?.(citation)}
                title={t ? t('citation.jumpTo', { page: citation.page }) : `Jump to page ${citation.page}`}
              >
                {refNum}
              </button>
            </CitationPopover>
          );
        } else {
          parts.push(`[${refNum}]`);
        }
        lastIndex = regex.lastIndex;
      }
      if (lastIndex < child.length) {
        parts.push(child.slice(lastIndex));
      }
      return parts.length === 1 ? parts[0] : <>{parts}</>;
    }

    if (React.isValidElement(child) && child.props?.children) {
      return React.cloneElement(child as React.ReactElement<any>, {
        children: processCitationLinks(child.props.children, citations, onClick, t),
      });
    }

    return child;
  });
}

function createCitationComponent(
  Tag: string,
  citations: Citation[],
  onClick?: (c: Citation) => void,
  t?: (key: string, params?: Record<string, string | number>) => string,
) {
  return function CitationElement({ children, ...props }: any) {
    return React.createElement(Tag, props, processCitationLinks(children, citations, onClick, t));
  };
}

/* ── Code block with header + copy button + Shiki highlighting ── */
function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const [html, setHtml] = useState<string | null>(null);
  const { t } = useLocale();

  useEffect(() => {
    let cancelled = false;
    setHtml(null);
    highlightCode(code, language)
      .then((out) => {
        if (!cancelled) setHtml(out);
      })
      .catch(() => {
        if (!cancelled) setHtml(null);
      });
    return () => {
      cancelled = true;
    };
  }, [code, language]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <div className="not-prose my-4 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700">
      <div className="flex items-center justify-between px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-700">
        <span className="font-mono">{language || 'text'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <span>{copied ? t('chat.copied') : t('chat.copyCode')}</span>
        </button>
      </div>
      {html ? (
        <div
          className="shiki-container text-[13px] leading-relaxed [&_pre]:!m-0 [&_pre]:!p-4 [&_pre]:overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className="text-[13px] leading-relaxed text-zinc-800 dark:text-zinc-100 bg-white dark:bg-zinc-900 overflow-x-auto p-4 m-0">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}

/* ── Pre override: render fenced code blocks as CodeBlock ── */
function PreBlock({ children }: any) {
  const child = React.Children.toArray(children)[0];
  if (React.isValidElement(child)) {
    const childProps = (child as any).props || {};
    const className = childProps.className || '';
    const match = /language-(\w+)/.exec(className);
    const lang = match ? match[1] : '';
    const text = String(childProps.children ?? '').replace(/\n$/, '');
    if (text) {
      return <CodeBlock language={lang} code={text} />;
    }
  }
  return <pre className="overflow-x-auto">{children}</pre>;
}

type Feedback = 'up' | 'down' | null;

function getFeedback(messageId: string): Feedback {
  try {
    return localStorage.getItem(`doctalk_fb_${messageId}`) as Feedback;
  } catch {
    // localStorage unavailable in private browsing
    return null;
  }
}

function setFeedbackStorage(messageId: string, fb: Feedback) {
  try {
    if (fb) {
      localStorage.setItem(`doctalk_fb_${messageId}`, fb);
    } else {
      localStorage.removeItem(`doctalk_fb_${messageId}`);
    }
  } catch {
    // localStorage unavailable in private browsing
  }
}

export default function MessageBubble({ message, onCitationClick, isStreaming, onRegenerate, isLastAssistant, onContinue }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isError = !!message.isError;
  const isAssistant = !isUser;
  const { t } = useLocale();

  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    if (isAssistant) {
      setFeedback(getFeedback(message.id));
    }
  }, [message.id, isAssistant]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [message.text]);

  const handleFeedback = useCallback((fb: Feedback) => {
    const newFb = feedback === fb ? null : fb;
    setFeedback(newFb);
    setFeedbackStorage(message.id, newFb);
  }, [feedback, message.id]);

  const markdownText = useMemo(() => {
    if (isUser || isError) return message.text;
    return insertCitationMarkers(message.text, message.citations || []);
  }, [message.text, message.citations, isUser, isError]);

  const markdownComponents = useMemo(() => {
    const citations = message.citations || [];
    const components: Record<string, any> = {
      pre: PreBlock,
    };
    if (citations.length > 0) {
      const tags = ['p', 'li', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'blockquote'] as const;
      for (const tag of tags) {
        components[tag] = createCitationComponent(tag, citations, onCitationClick, t);
      }
    }
    return components;
  }, [message.citations, onCitationClick, t]);

  return (
    <div className={`w-full flex ${isUser ? 'justify-end' : 'justify-start'} ${isUser ? 'my-4' : 'my-6'} group`}>
      <div className={`relative ${isUser ? 'max-w-[80%]' : 'w-full'}`}>
        <div
          className={
            isError
              ? 'text-sm rounded-xl px-4 py-3 bg-red-600 text-white'
              : isUser
              ? 'text-sm rounded-xl px-4 py-3 bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
              : 'text-zinc-900 dark:text-zinc-100'
          }
        >
          {isUser ? (
            <span className="whitespace-pre-wrap">{message.text}</span>
          ) : isStreaming && !message.text ? (
            <div className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500 text-sm" aria-live="polite">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce motion-reduce:animate-none [animation-delay:-0.3s]" aria-hidden="true" />
                <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce motion-reduce:animate-none [animation-delay:-0.15s]" aria-hidden="true" />
                <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce motion-reduce:animate-none" aria-hidden="true" />
                <span className="hidden motion-reduce:inline" aria-hidden="true">...</span>
              </div>
              <span>{t('chat.searching')}</span>
            </div>
          ) : (
            <>
              {/* Sources strip — rendered above the prose so the
                  "grounded-in-these-documents" signal is visible before the
                  user reads the answer. During streaming with no citations
                  yet, SourcesStrip itself draws a skeleton so the block
                  doesn't flicker into existence mid-answer. */}
              {isAssistant && (
                <SourcesStrip
                  citations={message.citations ?? []}
                  onCitationClick={onCitationClick}
                  isStreaming={isStreaming}
                />
              )}
              <div className="prose dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                <Suspense fallback={<span className="whitespace-pre-wrap">{markdownText}</span>}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                    {markdownText}
                  </ReactMarkdown>
                </Suspense>
                {isStreaming && isAssistant && message.text && (
                  <span aria-hidden="true" className="inline-block w-2 h-4 bg-zinc-400 dark:bg-zinc-500 animate-pulse motion-reduce:animate-none rounded-sm ml-0.5 align-text-bottom" />
                )}
              </div>
            </>
          )}
        </div>

        {/* Copy + feedback buttons (assistant only) */}
        {isAssistant && !isError && message.text && (
          <div className={`flex gap-2 mt-2 transition-opacity ${isLastAssistant ? '' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'}`}>
            <button
              onClick={handleCopy}
              className={`p-2 rounded transition-colors text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 focus-visible:ring-2 focus-visible:ring-zinc-400`}
              title={copied ? t('copy.copied') : t('copy.button')}
              aria-label={t('copy.button')}
            >
              {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
            </button>
            <button
              onClick={() => handleFeedback('up')}
              className={`p-2 rounded transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                feedback === 'up'
                  ? 'text-zinc-600 dark:text-zinc-400'
                  : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'
              }`}
              title={t('feedback.helpful')}
              aria-label={t('feedback.helpful')}
              aria-pressed={feedback === 'up'}
            >
              <ThumbsUp size={14} fill={feedback === 'up' ? 'currentColor' : 'none'} />
            </button>
            <button
              onClick={() => handleFeedback('down')}
              className={`p-2 rounded transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                feedback === 'down'
                  ? 'text-red-500 dark:text-red-400'
                  : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'
              }`}
              title={t('feedback.notHelpful')}
              aria-label={t('feedback.notHelpful')}
              aria-pressed={feedback === 'down'}
            >
              <ThumbsDown size={14} fill={feedback === 'down' ? 'currentColor' : 'none'} />
            </button>
            {isLastAssistant && onRegenerate && !isStreaming && (
              <button
                onClick={onRegenerate}
                className={`p-2 rounded transition-colors text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 focus-visible:ring-2 focus-visible:ring-zinc-400`}
                title={t('chat.regenerate')}
                aria-label={t('chat.regenerate')}
              >
                <RotateCcw size={14} />
              </button>
            )}
          </div>
        )}

        {/* Continue generating button */}
        {isAssistant && message.isTruncated && !isStreaming && isLastAssistant && onContinue && (
          <button
            onClick={onContinue}
            className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-400"
            title={t('chat.continueGenerating')}
          >
            <ChevronsDown size={14} />
            {t('chat.continueGenerating')}
          </button>
        )}
      </div>
    </div>
  );
}
