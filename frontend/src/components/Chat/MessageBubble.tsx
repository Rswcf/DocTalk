"use client";

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, ThumbsUp, ThumbsDown, RotateCcw } from 'lucide-react';
import type { Citation, Message } from '../../types';
import { useLocale } from '../../i18n';

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
                className="inline text-zinc-600 dark:text-zinc-400 hover:underline cursor-pointer select-none font-medium bg-transparent border-none p-0 text-inherit leading-inherit"
                onClick={() => onClick?.(citation)}
                title={t ? t('citation.jumpTo', { page: citation.page }) : `Jump to page ${citation.page}`}
              >
                [{refNum}]
              </button>
              {citation.textSnippet && (
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs rounded-lg shadow-lg whitespace-normal max-w-[280px] pointer-events-none opacity-0 group-hover/cite:opacity-100 transition-opacity z-50">
                  <span className="line-clamp-3">{citation.textSnippet}</span>
                  <span className="block mt-1 text-zinc-400 dark:text-zinc-500 text-[10px]">
                    {t ? t('citation.page', { page: citation.page }) : `Page ${citation.page}`}
                  </span>
                  <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-900 dark:border-t-zinc-100" />
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
    if (citations.length === 0) return undefined;
    const tags = ['p', 'li', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'blockquote'] as const;
    const components: Record<string, any> = {};
    for (const tag of tags) {
      components[tag] = createCitationComponent(tag, citations, onCitationClick, t);
    }
    return components;
  }, [message.citations, onCitationClick, t]);

  return (
    <div className={`w-full flex ${isUser ? 'justify-end' : 'justify-start'} ${isUser ? 'my-3' : 'my-4'} group`}>
      <div className={`relative ${isUser ? 'max-w-[80%]' : 'w-full'}`}>
        <div
          className={`text-sm ${
            isError
              ? 'rounded-2xl px-4 py-3 bg-red-600 text-white'
              : isUser
              ? 'rounded-2xl px-4 py-3 bg-zinc-800 dark:bg-zinc-700 text-white shadow-sm'
              : 'text-zinc-900 dark:text-zinc-100'
          }`}
        >
          {isUser ? (
            <span className="whitespace-pre-wrap">{message.text}</span>
          ) : isStreaming && !message.text ? (
            <div className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500 text-sm">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" />
              </div>
              <span>{t('chat.searching')}</span>
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {markdownText}
              </ReactMarkdown>
              {isStreaming && isAssistant && message.text && (
                <span className="inline-block w-2 h-4 bg-zinc-400 dark:bg-zinc-500 animate-pulse rounded-sm ml-0.5 align-text-bottom" />
              )}
            </div>
          )}
        </div>

        {/* Copy + feedback buttons (assistant only) */}
        {isAssistant && !isError && message.text && (
          <div className="flex gap-1 mt-2">
            <button
              onClick={handleCopy}
              className={`p-1 rounded transition-colors text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300`}
              title={copied ? t('copy.copied') : t('copy.button')}
            >
              {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
            </button>
            <button
              onClick={() => handleFeedback('up')}
              className={`p-1 rounded transition-colors ${
                feedback === 'up'
                  ? 'text-zinc-600 dark:text-zinc-400'
                  : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'
              }`}
              title={t('feedback.helpful')}
            >
              <ThumbsUp size={14} fill={feedback === 'up' ? 'currentColor' : 'none'} />
            </button>
            <button
              onClick={() => handleFeedback('down')}
              className={`p-1 rounded transition-colors ${
                feedback === 'down'
                  ? 'text-red-500 dark:text-red-400'
                  : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'
              }`}
              title={t('feedback.notHelpful')}
            >
              <ThumbsDown size={14} fill={feedback === 'down' ? 'currentColor' : 'none'} />
            </button>
            {isLastAssistant && onRegenerate && !isStreaming && (
              <button
                onClick={onRegenerate}
                className={`p-1 rounded transition-colors text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300`}
                title={t('chat.regenerate')}
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
