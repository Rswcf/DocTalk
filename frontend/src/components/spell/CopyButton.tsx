"use client";

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

type Props = {
  value: string;
  label?: string;
  copiedLabel?: string;
  size?: 'sm' | 'md';
  className?: string;
  onCopied?: () => void;
};

/**
 * Click-to-copy button with a tick confirmation and a cursor-origin
 * ripple. Replaces the various silent `navigator.clipboard.writeText`
 * affordances scattered across chat code blocks and citation chips.
 */
export default function CopyButton({
  value,
  label = 'COPY',
  copiedLabel = 'COPIED',
  size = 'sm',
  className = '',
  onCopied,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [rp, setRp] = useState<{ x: number; y: number; k: number } | null>(null);

  const handle = async (e: React.MouseEvent<HTMLButtonElement>) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      /* clipboard can be blocked in non-secure contexts; best-effort */
    }
    const r = e.currentTarget.getBoundingClientRect();
    setRp({
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
      k: Date.now(),
    });
    setCopied(true);
    onCopied?.();
    setTimeout(() => setCopied(false), 1600);
  };

  const sz = size === 'md' ? 'px-3 py-1.5 text-xs gap-2' : 'px-2.5 py-1 text-[10px] gap-1.5';
  const iconSize = size === 'md' ? 14 : 12;

  return (
    <button
      type="button"
      onClick={handle}
      className={`relative inline-flex items-center font-mono font-semibold tracking-wider uppercase rounded-md overflow-hidden transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950 ${sz} ${
        copied
          ? 'bg-emerald-600 text-white'
          : 'bg-accent text-accent-foreground hover:bg-accent-hover'
      } ${className}`}
    >
      {copied ? <Check size={iconSize} /> : <Copy size={iconSize} />}
      <span>{copied ? copiedLabel : label}</span>
      {rp && (
        <span
          key={rp.k}
          aria-hidden
          className="pointer-events-none absolute inset-0 motion-reduce:hidden"
          style={{
            background: `radial-gradient(circle at ${rp.x}% ${rp.y}%, rgba(255,255,255,0.35), transparent 60%)`,
            animation: 'spellRipple 420ms ease-out forwards',
          }}
        />
      )}
      <style>{`@keyframes spellRipple { from { opacity: 1; } to { opacity: 0; } }`}</style>
    </button>
  );
}
