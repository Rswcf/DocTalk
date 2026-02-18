"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQSectionProps {
  items: FAQItem[];
}

function FAQAccordionItem({ item, isOpen, onToggle }: { item: FAQItem; isOpen: boolean; onToggle: () => void }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  const measureHeight = useCallback(() => {
    if (contentRef.current) {
      setHeight(contentRef.current.scrollHeight);
    }
  }, []);

  useEffect(() => {
    measureHeight();
  }, [measureHeight, item.answer]);

  return (
    <div
      className={`border rounded-xl overflow-hidden transition-colors duration-200 ${
        isOpen
          ? 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900'
          : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-4.5 text-left cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-inset"
        aria-expanded={isOpen}
      >
        <span className="font-medium text-zinc-900 dark:text-zinc-100 pr-4 text-[15px]">
          {item.question}
        </span>
        <ChevronDown
          className={`w-5 h-5 text-zinc-400 dark:text-zinc-500 shrink-0 transition-transform duration-300 ease-out ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      <div
        className="overflow-hidden transition-[max-height,opacity] duration-300 ease-out"
        style={{
          maxHeight: isOpen ? `${height}px` : '0px',
          opacity: isOpen ? 1 : 0,
        }}
      >
        <div ref={contentRef} className="px-6 pb-5">
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed text-[15px]">
            {item.answer}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function FAQSection({ items }: FAQSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <FAQAccordionItem
          key={i}
          item={item}
          isOpen={openIndex === i}
          onToggle={() => setOpenIndex(openIndex === i ? null : i)}
        />
      ))}
    </div>
  );
}
