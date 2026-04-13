"use client";

import React, { useEffect, useRef, useState } from 'react';

type Props = {
  children?: React.ReactNode;
  /** If provided, splits text into words and staggers each. Use this for headlines. */
  text?: string;
  /** Group delay in seconds before any word appears. */
  delay?: number;
  /** Per-word stagger in seconds (text mode only). */
  stagger?: number;
  className?: string;
  as?: 'span' | 'div' | 'h1' | 'h2' | 'h3' | 'p';
  /** IntersectionObserver threshold. */
  threshold?: number;
};

/**
 * Entrance animation — content fades in from blur+translate-y when it
 * scrolls into view. In `text` mode, splits the string into words and
 * animates each with a small delay for an editorial "words land on the
 * page" rhythm. Respects prefers-reduced-motion.
 */
export default function BlurReveal({
  children,
  text,
  delay = 0,
  stagger = 0.07,
  className = '',
  as: Tag = 'span',
  threshold = 0.2,
}: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.unobserve(entry.target);
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  const base =
    'inline-block transition-[opacity,filter,transform] duration-[800ms] ease-out motion-reduce:transition-none will-change-[opacity,filter,transform]';
  const hidden = 'opacity-0 blur-[10px] translate-y-[10px]';
  const shown = 'opacity-100 blur-0 translate-y-0';

  if (text) {
    const parts = text.split(/(\s+)/);
    return React.createElement(
      Tag,
      { ref: ref as any, className },
      parts.map((part, i) => {
        if (/^\s+$/.test(part)) return part;
        return (
          <span
            key={i}
            className={`${base} ${visible ? shown : hidden}`}
            style={{ transitionDelay: `${delay + i * stagger}s` }}
          >
            {part}
          </span>
        );
      })
    );
  }

  return React.createElement(
    Tag,
    {
      ref: ref as any,
      className: `${base} ${visible ? shown : hidden} ${className}`,
      style: { transitionDelay: `${delay}s` },
    },
    children
  );
}
