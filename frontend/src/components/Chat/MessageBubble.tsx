"use client";

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, ThumbsUp, ThumbsDown, RotateCcw } from 'lucide-react';
import type { Citation, Message } from '../../types';
import { useLocale } from '../../i18n';
import { useWin98Theme } from '../win98/useWin98Theme';
import { CopyIcon, ThumbUpIcon, ThumbDownIcon, RefreshIcon } from '../win98/Win98Icons';

interface MessageBubbleProps {
  message: Message;
  onCitationClick?: (c: Citation) => void;
  isStreaming?: boolean;
  onRegenerate?: () => void;
  isLastAssistant?: boolean;
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
  isWin98?: boolean,
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
            <span key={`cite-${refNum}-${keyIdx++}`} className="relative inline-block group/cite">
              <button
                type="button"
                className={isWin98
                  ? "inline text-[#000080] hover:underline cursor-pointer select-none font-bold bg-transparent border-none p-0 text-inherit leading-inherit"
                  : "inline text-zinc-600 dark:text-zinc-400 hover:underline cursor-pointer select-none font-medium bg-transparent border-none p-0 text-inherit leading-inherit focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm"
                }
                onClick={() => onClick?.(citation)}
                title={t ? t('citation.jumpTo', { page: citation.page }) : `Jump to page ${citation.page}`}
              >
                [{refNum}]
              </button>
              {citation.textSnippet && (
                <span className={isWin98
                  ? "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[#FFFFE1] text-black text-[10px] border border-black shadow whitespace-normal max-w-[280px] pointer-events-none opacity-0 group-hover/cite:opacity-100 z-50"
                  : "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-zinc-900 dark:bg-zinc-800 text-white dark:text-zinc-100 dark:border dark:border-zinc-700 text-xs rounded-lg shadow-lg whitespace-normal max-w-[280px] pointer-events-none opacity-0 group-hover/cite:opacity-100 transition-opacity z-50"
                }>
                  <span className="line-clamp-3">{citation.textSnippet}</span>
                  <span className={isWin98
                    ? "block mt-1 text-[#808080] text-[9px]"
                    : "block mt-1 text-zinc-400 dark:text-zinc-500 text-[10px]"
                  }>
                    {t ? t('citation.page', { page: citation.page }) : `Page ${citation.page}`}
                  </span>
                  {!isWin98 && (
                    <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-900 dark:border-t-zinc-800" />
                  )}
                </span>
              )}
            </span>
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
        children: processCitationLinks(child.props.children, citations, onClick, t, isWin98),
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
  isWin98?: boolean,
) {
  return function CitationElement({ children, ...props }: any) {
    return React.createElement(Tag, props, processCitationLinks(children, citations, onClick, t, isWin98));
  };
}

/* ── Code block with header + copy button ── */
function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const { t } = useLocale();

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <div className="not-prose my-4 rounded-xl overflow-hidden bg-zinc-900">
      <div className="flex items-center justify-between px-4 py-2 text-xs text-zinc-400 bg-zinc-800">
        <span className="font-mono">{language}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 hover:text-zinc-200 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <span>{copied ? t('chat.copied') : t('chat.copyCode')}</span>
        </button>
      </div>
      <div className="overflow-x-auto p-4">
        <pre className="text-[13px] leading-relaxed text-zinc-100">
          <code>{code}</code>
        </pre>
      </div>
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
  } catch {}
}

export default function MessageBubble({ message, onCitationClick, isStreaming, onRegenerate, isLastAssistant }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isError = !!message.isError;
  const isAssistant = !isUser;
  const { t } = useLocale();
  const isWin98 = useWin98Theme();

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
        components[tag] = createCitationComponent(tag, citations, onCitationClick, t, isWin98);
      }
    }
    return components;
  }, [message.citations, onCitationClick, t, isWin98]);

  if (isWin98) {
    return (
      <div className="flex flex-col gap-1 my-2">
        {/* Message Header */}
        <div className="flex items-center gap-1">
          {isUser ? (
            <span className="text-[11px] font-bold text-[#000080]">[You]</span>
          ) : (
            <span className="text-[11px] font-bold text-[#008000]">[DocTalk Assistant]</span>
          )}
        </div>
        {/* Message Content */}
        <div
          className={`text-[12px] leading-[1.5] whitespace-pre-wrap select-text cursor-text ${
            isUser
              ? 'bg-[#FFFFCC] border border-[#808080] p-2'
              : isError
              ? 'bg-[#FF6666] text-white p-2'
              : 'px-1'
          }`}
        >
          {isUser ? (
            message.text
          ) : isStreaming && !message.text ? (
            <span className="text-[11px] text-[var(--win98-dark-gray)] animate-pulse motion-reduce:animate-none">DocTalk is typing...</span>
          ) : (
            <>
              <div className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0 text-[12px]">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {markdownText}
                </ReactMarkdown>
              </div>
              {isStreaming && isAssistant && message.text && (
                <span className="inline-block w-1.5 h-3 bg-black animate-pulse motion-reduce:animate-none ml-0.5 align-text-bottom" />
              )}
            </>
          )}
        </div>
        {/* Actions (assistant only) */}
        {isAssistant && !isError && message.text && (
          <div className="flex items-center gap-[2px] mt-1">
            <button type="button" onClick={handleCopy} className="win98-button flex items-center gap-[3px] h-[18px] px-1 text-[10px]" title="Copy">
              <CopyIcon size={10} />
              <span>{copied ? 'OK' : 'Copy'}</span>
            </button>
            <button type="button" onClick={() => handleFeedback('up')} className={`win98-button flex items-center gap-[3px] h-[18px] px-1 text-[10px] ${feedback === 'up' ? 'win98-inset' : ''}`} title="Like">
              <ThumbUpIcon size={10} />
            </button>
            <button type="button" onClick={() => handleFeedback('down')} className={`win98-button flex items-center gap-[3px] h-[18px] px-1 text-[10px] ${feedback === 'down' ? 'win98-inset' : ''}`} title="Dislike">
              <ThumbDownIcon size={10} />
            </button>
            {isLastAssistant && onRegenerate && !isStreaming && (
              <button type="button" onClick={onRegenerate} className="win98-button flex items-center gap-[3px] h-[18px] px-1 text-[10px]" title="Retry">
                <RefreshIcon size={10} />
                <span>Retry</span>
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`w-full flex ${isUser ? 'justify-end' : 'justify-start'} ${isUser ? 'my-4' : 'my-6'} group`}>
      <div className={`relative ${isUser ? 'max-w-[80%]' : 'w-full'}`}>
        <div
          className={
            isError
              ? 'text-sm rounded-3xl px-4 py-3 bg-red-600 text-white'
              : isUser
              ? 'text-sm rounded-3xl px-4 py-3 bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
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
            <div className="prose dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {markdownText}
              </ReactMarkdown>
              {isStreaming && isAssistant && message.text && (
                <span aria-hidden="true" className="inline-block w-2 h-4 bg-zinc-400 dark:bg-zinc-500 animate-pulse motion-reduce:animate-none rounded-sm ml-0.5 align-text-bottom" />
              )}
            </div>
          )}
        </div>

        {/* Copy + feedback buttons (assistant only) */}
        {isAssistant && !isError && message.text && (
          <div className={`flex gap-2 mt-2 transition-opacity ${isLastAssistant ? '' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'}`}>
            <button
              onClick={handleCopy}
              className={`p-2 rounded transition-colors text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 focus-visible:ring-2 focus-visible:ring-zinc-400`}
              title={copied ? t('copy.copied') : t('copy.button')}
              aria-label="Copy message"
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
              aria-label="Good response"
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
              aria-label="Bad response"
              aria-pressed={feedback === 'down'}
            >
              <ThumbsDown size={14} fill={feedback === 'down' ? 'currentColor' : 'none'} />
            </button>
            {isLastAssistant && onRegenerate && !isStreaming && (
              <button
                onClick={onRegenerate}
                className={`p-2 rounded transition-colors text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 focus-visible:ring-2 focus-visible:ring-zinc-400`}
                title={t('chat.regenerate')}
                aria-label="Regenerate response"
              >
                <RotateCcw size={14} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
