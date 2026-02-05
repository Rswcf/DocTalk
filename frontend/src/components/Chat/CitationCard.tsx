"use client";

import React from 'react';

interface CitationCardProps {
  refIndex: number;
  textSnippet: string;
  page: number;
  onClick?: () => void;
}

export default function CitationCard({ refIndex, textSnippet, page, onClick }: CitationCardProps) {
  const snippet = textSnippet?.length > 80 ? textSnippet.slice(0, 80) + '…' : textSnippet || '';
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left border rounded-md p-2 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 transition flex items-start gap-2"
    >
      <span className="text-blue-600 dark:text-blue-400 font-semibold">[{refIndex}]</span>
      <div className="flex-1">
        <p className="text-sm text-gray-800 dark:text-gray-200">{snippet}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Page {page}</p>
      </div>
    </button>
  );
}
