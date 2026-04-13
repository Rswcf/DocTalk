"use client";

import React, { useEffect, useRef, useState } from 'react';

type Props = {
  children: React.ReactNode;
  /** Seconds between each child's entrance. */
  stagger?: number;
  /** IntersectionObserver threshold. */
  threshold?: number;
  className?: string;
  /** Extra className applied to each wrapped child. */
  itemClassName?: string;
};

/**
 * Wraps direct children and cascades their entrance as the container
 * scrolls into view. Each child fades + slides up with an incremental
 * transition-delay. Used on HowItWorks (3 steps), FeatureGrid, logo
 * rows, etc. Respects prefers-reduced-motion.
 */
export default function StaggeredReveal({
  children,
  stagger = 0.1,
  threshold = 0.2,
  className = '',
  itemClassName = '',
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
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

  const kids = React.Children.toArray(children);
  return (
    <div ref={ref} className={className}>
      {kids.map((child, i) => (
        <div
          key={i}
          className={`transition-[opacity,transform] duration-[600ms] ease-out motion-reduce:transition-none ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
          } ${itemClassName}`}
          style={{ transitionDelay: `${i * stagger}s` }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}
