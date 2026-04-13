import React from 'react';

type Props = {
  children: React.ReactNode;
  /** Show the pulsing dot before the label. */
  pulse?: boolean;
  className?: string;
};

/**
 * Small pill badge with a pulsing dot + passing light shimmer. Used for
 * "MOST POPULAR" on pricing, "BETA" on features, "NEW" on changelog
 * items. Stays subtle — the motion is slow, the shimmer is low-alpha.
 * Disabled under prefers-reduced-motion.
 */
export default function ShimmerBadge({ children, pulse = true, className = '' }: Props) {
  return (
    <span
      className={`relative inline-flex items-center gap-1.5 overflow-hidden rounded-full py-1 text-[11px] font-mono font-semibold uppercase tracking-[0.14em] text-accent ${
        pulse ? 'pl-5 pr-3' : 'px-3'
      } ${className}`}
      style={{ background: 'linear-gradient(90deg,transparent,rgba(29,78,216,0.10),transparent)' }}
    >
      {pulse && (
        <span
          aria-hidden
          className="absolute left-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-current motion-reduce:animate-none"
          style={{ animation: 'spellPulse 2s infinite' }}
        />
      )}
      <span className="relative z-10">{children}</span>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 motion-reduce:hidden"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(29,78,216,0.18) 50%, transparent 100%)',
          transform: 'translateX(-100%)',
          animation: 'spellShimX 2.4s linear infinite',
        }}
      />
      <style>{`
        @keyframes spellShimX { to { transform: translateX(100%); } }
        @keyframes spellPulse {
          0%   { box-shadow: 0 0 0 0 rgba(29,78,216,0.4); }
          70%  { box-shadow: 0 0 0 8px rgba(29,78,216,0); }
          100% { box-shadow: 0 0 0 0 rgba(29,78,216,0); }
        }
      `}</style>
    </span>
  );
}
