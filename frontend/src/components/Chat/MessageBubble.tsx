"use client";

import React, { Suspense, useMemo, useState, useCallback, useEffect } from 'react';
import remarkGfm from 'remark-gfm';
import { Copy, Check, ThumbsUp, ThumbsDown, RotateCcw, ChevronsDown, Share2 } from 'lucide-react';
import type { ChatArtifact, Citation, Message } from '../../types';
import { useLocale } from '../../i18n';
import CitationPopover from './CitationPopover';
import SourcesStrip from './SourcesStrip';
import ChatArtifactCard from './ChatArtifactCard';
import { highlightCode } from '../../lib/highlight';
import { CopyButton } from '../spell';
import { trackEvent } from '../../lib/analytics';

const ReactMarkdown = React.lazy(() => import('react-markdown'));

interface MessageBubbleProps {
  message: Message;
  onCitationClick?: (c: Citation) => void;
  onPreviewLayoutTranslation?: (url: string, artifact: ChatArtifact) => void;
  isStreaming?: boolean;
  onRegenerate?: () => void;
  isLastAssistant?: boolean;
  onContinue?: () => void;
  onShareAnswer?: (message: Message) => void;
  isSharingAnswer?: boolean;
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
                className="not-prose dt-source-index align-super mx-0.5 inline-flex h-[1.125rem] min-w-[1.125rem] cursor-pointer select-none items-center justify-center rounded px-1 text-[10px] font-semibold leading-none transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--reader-evidence)]"
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
      const elementType = (child as any).type;
      // Don't recurse into literal code / anchors / keyboard / sample spans.
      // Otherwise an LLM emitting `[1]` inside a backtick code span would have
      // the marker rewritten into a <CitationPopover><button>, producing a
      // button-inside-code-element semantic mess (and breaking copy-paste of
      // the literal code).
      if (
        typeof elementType === 'string'
        && ['code', 'pre', 'a', 'kbd', 'samp'].includes(elementType)
      ) {
        return child;
      }
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

  return (
    <div className="not-prose my-4 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700">
      <div className="flex items-center justify-between px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-700">
        <span className="font-mono">{language || 'text'}</span>
        <CopyButton value={code} label={t('chat.copyCode')} copiedLabel={t('chat.copied')} />
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

function MessageBubble({
  message,
  onCitationClick,
  onPreviewLayoutTranslation,
  isStreaming,
  onRegenerate,
  isLastAssistant,
  onContinue,
  onShareAnswer,
  isSharingAnswer,
}: MessageBubbleProps) {
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
    navigator.clipboard.writeText(message.text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        // iOS Safari / non-HTTPS reject clipboard.writeText. The natural
        // "didn't work" cue is the absence of the copied state — no toast
        // needed. Swallowing prevents an unhandled promise rejection.
      });
  }, [message.text]);

  const handleFeedback = useCallback((fb: Feedback) => {
    const newFb = feedback === fb ? null : fb;
    setFeedback(newFb);
    setFeedbackStorage(message.id, newFb);
    if (newFb) {
      trackEvent('feedback_submitted', {
        source: 'message_actions',
        rating: newFb,
        has_citations: Boolean(message.citations?.length),
      });
    }
  }, [feedback, message.citations?.length, message.id]);

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
              ? 'text-sm rounded-2xl px-4 py-3 bg-red-500/92 text-white shadow-2xl shadow-red-950/30'
              : isUser
              ? 'dt-user-bubble text-sm rounded-2xl px-4 py-3'
              : 'dt-answer-card text-[var(--workbench-ink)]'
          }
        >
          {isUser ? (
            <span className="whitespace-pre-wrap">{message.text}</span>
          ) : isStreaming && !message.text ? (
            <div className="flex items-center gap-2 text-[var(--workbench-muted)] text-sm" aria-live="polite">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-white/55 rounded-full animate-bounce motion-reduce:animate-none [animation-delay:-0.3s]" aria-hidden="true" />
                <span className="w-1.5 h-1.5 bg-white/55 rounded-full animate-bounce motion-reduce:animate-none [animation-delay:-0.15s]" aria-hidden="true" />
                <span className="w-1.5 h-1.5 bg-white/55 rounded-full animate-bounce motion-reduce:animate-none" aria-hidden="true" />
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
              <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 sm:prose-base">
                <Suspense fallback={<span className="whitespace-pre-wrap">{markdownText}</span>}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                    {markdownText}
                  </ReactMarkdown>
                </Suspense>
                {isStreaming && isAssistant && message.text && (
                  <span aria-hidden="true" className="inline-block w-2 h-4 bg-white/45 animate-pulse motion-reduce:animate-none rounded-sm ml-0.5 align-text-bottom" />
                )}
              </div>
              {isAssistant && !message.text && message.toolStatus ? (
                <p className="mt-3 text-sm text-[var(--workbench-muted)]">{message.toolStatus}</p>
              ) : null}
              {isAssistant && message.artifacts?.map((artifact, index) => (
                <ChatArtifactCard
                  key={`${artifact.jobId || artifact.title}-${index}`}
                  artifact={artifact}
                  onCitationClick={onCitationClick}
                  onPreviewLayoutTranslation={onPreviewLayoutTranslation}
                />
              ))}
            </>
          )}
        </div>

        {/* Copy + feedback buttons (assistant only) */}
        {isAssistant && !isError && message.text && (
          <div className={`mt-2 flex gap-1.5 transition-opacity ${isLastAssistant ? '' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'}`}>
            <button
              onClick={handleCopy}
              className="rounded-full p-1.5 text-[var(--workbench-muted)] transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-zinc-400"
              title={copied ? t('copy.copied') : t('copy.button')}
              aria-label={t('copy.button')}
            >
              {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
            </button>
            <button
              onClick={() => handleFeedback('up')}
              className={`rounded-lg p-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                feedback === 'up'
                  ? 'text-white'
                  : 'text-[var(--workbench-muted)] hover:bg-white/10 hover:text-white'
              }`}
              title={t('feedback.helpful')}
              aria-label={t('feedback.helpful')}
              aria-pressed={feedback === 'up'}
            >
              <ThumbsUp size={14} fill={feedback === 'up' ? 'currentColor' : 'none'} />
            </button>
            <button
              onClick={() => handleFeedback('down')}
              className={`rounded-lg p-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                feedback === 'down'
                  ? 'text-red-500 dark:text-red-400'
                  : 'text-[var(--workbench-muted)] hover:bg-white/10 hover:text-white'
              }`}
              title={t('feedback.notHelpful')}
              aria-label={t('feedback.notHelpful')}
              aria-pressed={feedback === 'down'}
            >
              <ThumbsDown size={14} fill={feedback === 'down' ? 'currentColor' : 'none'} />
            </button>
            {message.shareAnchor && onShareAnswer && !isStreaming && (
              <button
                onClick={() => onShareAnswer(message)}
                disabled={isSharingAnswer}
                className="rounded-full p-1.5 text-[var(--workbench-muted)] transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-50"
                title={t('chat.shareAnswer')}
                aria-label={t('chat.shareAnswer')}
              >
                <Share2 size={14} />
              </button>
            )}
            {isLastAssistant && onRegenerate && !isStreaming && (
              <button
                onClick={onRegenerate}
                className="rounded-full p-1.5 text-[var(--workbench-muted)] transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-zinc-400"
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
            className="mt-2 flex items-center gap-1.5 rounded-lg border border-[var(--reader-evidence-border)] bg-[var(--reader-evidence-soft)] px-3 py-1.5 text-sm font-medium text-[var(--reader-evidence)] transition-colors hover:brightness-95 focus-visible:ring-2 focus-visible:ring-[var(--reader-evidence)]"
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

/**
 * Memoized export — prevents the chat re-render storm during SSE streaming
 * (Wave-2 I21). The store flushes the streaming assistant message every
 * ~50ms via `updateLastMessage`, which creates a new object only for the
 * last message; prior messages keep the same reference. Combined with
 * `useCallback`-stabilized `onRegenerate` / `onContinue` / `onShareAnswer`
 * in `ChatPanel`, shallow-prop comparison correctly skips re-renders of
 * historical messages — keeping per-flush ReactMarkdown + Shiki work O(1)
 * in the streaming message instead of O(n) across the whole thread.
 */
export default React.memo(MessageBubble);
