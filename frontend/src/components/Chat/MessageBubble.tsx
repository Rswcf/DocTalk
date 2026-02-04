"use client";

import React from 'react';
import type { Citation, Message } from '../../types';

interface MessageBubbleProps {
  message: Message;
  onCitationClick?: (c: Citation) => void;
}

function renderWithCitations(text: string, citations: Citation[] | undefined, onClick?: (c: Citation) => void) {
  if (!citations || citations.length === 0) return <span>{text}</span>;
  const ordered = [...citations].sort((a, b) => a.offset - b.offset);
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  ordered.forEach((c) => {
    const idx = Math.max(0, Math.min(text.length, c.offset));
    if (idx > cursor) {
      parts.push(<span key={`t-${cursor}`}>{text.slice(cursor, idx)}</span>);
    }
    parts.push(
      <span
        key={`c-${c.refIndex}-${idx}`}
        className="text-blue-600 hover:underline cursor-pointer select-none"
        onClick={() => onClick && onClick(c)}
        title={`Jump to page ${c.page}`}
      >
        [{c.refIndex}]
      </span>
    );
    cursor = idx;
  });
  if (cursor < text.length) {
    parts.push(<span key={`t-end`}>{text.slice(cursor)}</span>);
  }
  return <>{parts}</>;
}

export default function MessageBubble({ message, onCitationClick }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isError = !!message.isError;
  return (
    <div className={`w-full flex ${isUser ? 'justify-end' : 'justify-start'} my-2`}>
      <div
        className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
          isError
            ? 'bg-red-600 text-white'
            : isUser
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-900'
        }`}
      >
        {isUser ? (
          <span>{message.text}</span>
        ) : (
          <span>{renderWithCitations(message.text, message.citations, onCitationClick)}</span>
        )}
      </div>
    </div>
  );
}
