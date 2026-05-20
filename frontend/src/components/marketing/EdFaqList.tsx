"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

// SSR-safe layout effect — useLayoutEffect warns under server rendering, so
// we fall back to useEffect when `window` isn't available. This keeps the
// first painted frame in sync with the measured scrollHeight on the client
// (no collapsed→expanded jump) while remaining safe for any SSR boundary.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

interface FaqItem {
  question: string;
  answer: string;
}

interface EdFaqListProps {
  items: FaqItem[];
}

export default function EdFaqList({ items }: EdFaqListProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <div>
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        const questionNum = `Q${index + 1}`;

        return (
          <FaqRow
            key={`faq-${index}`}
            index={index}
            questionNum={questionNum}
            question={item.question}
            answer={item.answer}
            isOpen={isOpen}
            isLast={index === items.length - 1}
            onToggle={() => toggle(index)}
          />
        );
      })}
    </div>
  );
}

interface FaqRowProps {
  index: number;
  questionNum: string;
  question: string;
  answer: string;
  isOpen: boolean;
  isLast: boolean;
  onToggle: () => void;
}

function FaqRow({
  index,
  questionNum,
  question,
  answer,
  isOpen,
  isLast,
  onToggle,
}: FaqRowProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useIsomorphicLayoutEffect(() => {
    const el = contentRef.current;
    if (!el || !isOpen) return;
    setHeight(el.scrollHeight);
    const ro = new ResizeObserver(() => setHeight(el.scrollHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [isOpen]);

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <div
      style={{
        borderTop: "1px solid var(--ed-rule)",
        borderBottom: isLast ? "1px solid var(--ed-rule)" : undefined,
      }}
    >
      <button
        type="button"
        id={`ed-faq-btn-${index}`}
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`ed-faq-panel-${index}`}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "24px",
          textAlign: "left",
          width: "100%",
          padding: "20px 0",
          cursor: "pointer",
          background: "transparent",
          border: "none",
        }}
      >
        {/* Left: number + question */}
        <span
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "16px",
            flex: 1,
          }}
        >
          <span
            className="ed-caption"
            aria-hidden="true"
            style={{ color: "var(--ed-signal)", flexShrink: 0 }}
          >
            {questionNum}
          </span>
          <span className="ed-h3">{question}</span>
        </span>

        {/* Right: +/− indicator */}
        <span
          className="ed-caption"
          aria-hidden="true"
          style={{
            flexShrink: 0,
            fontSize: "16px",
            letterSpacing: 0,
            color: "var(--ed-ink-3)",
            marginTop: "2px",
          }}
        >
          {isOpen ? "−" : "+"}
        </span>
      </button>

      {/* Answer panel — measured-height accordion */}
      <div
        id={`ed-faq-panel-${index}`}
        role="region"
        aria-labelledby={`ed-faq-btn-${index}`}
        ref={contentRef}
        style={{
          overflow: "hidden",
          maxHeight: isOpen ? `${height}px` : "0px",
          opacity: isOpen ? 1 : 0,
          transition: prefersReducedMotion
            ? "none"
            : "max-height 300ms ease, opacity 300ms ease",
        }}
      >
        <p
          className="ed-body"
          style={{ maxWidth: "660px", paddingBottom: "20px" }}
        >
          {answer}
        </p>
      </div>
    </div>
  );
}
