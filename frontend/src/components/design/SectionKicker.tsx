import React from 'react';

type Props = {
  /** Two-digit section counter, e.g. "01", "02". Optional — omit to hide. */
  num?: string;
  /** The kicker label itself. */
  children: React.ReactNode;
  /** Center-align on mobile, left-align from sm+. Default false = left. */
  centered?: boolean;
  className?: string;
};

/**
 * Editorial eyebrow/kicker. Small-caps mono, optional leading numeral,
 * trailing hairline. Designed to sit above an H1/H2 and give marketing
 * pages a "magazine feature" rhythm instead of the generic SaaS badge
 * pill. Paired with `font-serif` headlines.
 */
export default function SectionKicker({ num, children, centered, className = '' }: Props) {
  return (
    <div
      className={[
        'flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400',
        centered ? 'justify-center sm:justify-start' : '',
        className,
      ].join(' ')}
    >
      {num ? (
        <span className="font-mono tabular-nums text-accent">{num}</span>
      ) : null}
      <span className="font-mono">{children}</span>
      <span aria-hidden className="h-px flex-none w-8 bg-zinc-300 dark:bg-zinc-700" />
    </div>
  );
}
