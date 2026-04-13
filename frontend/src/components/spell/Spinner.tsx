import React from 'react';

type Props = {
  /**
   * Variant picks a shape that carries semantic meaning:
   * - `bars` — equalizer bars (parsing / data crunching, e.g. upload)
   * - `dots` — three dots (AI typing)
   * - `circle` — classic spinner (generic fetching)
   */
  variant?: 'bars' | 'dots' | 'circle';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
};

/**
 * Unified loading indicator. Before this, DocTalk had 5 different
 * spinner implementations across upload / chat / profile / billing. The
 * shape carries meaning — bars = work being done, dots = thinking,
 * circle = waiting on a network call.
 */
export default function Spinner({ variant = 'circle', size = 'md', className = '', label }: Props) {
  const aria = {
    role: 'status' as const,
    'aria-live': 'polite' as const,
    'aria-label': label || 'Loading',
  };

  if (variant === 'bars') {
    const h = size === 'sm' ? 'h-4' : size === 'lg' ? 'h-8' : 'h-6';
    return (
      <span {...aria} className={`inline-flex items-end gap-[3px] ${h} ${className}`}>
        {[40, 60, 100, 75, 45].map((hp, i) => (
          <span
            key={i}
            className="inline-block w-[3px] rounded-sm bg-accent motion-reduce:animate-none"
            style={{ height: `${hp}%`, animation: `spellBar 1s ease-in-out ${-1 + i * 0.1}s infinite` }}
          />
        ))}
        <style>{`@keyframes spellBar { 0%,100% { transform: scaleY(.5); } 50% { transform: scaleY(1); } }`}</style>
      </span>
    );
  }

  if (variant === 'dots') {
    const d = size === 'sm' ? 'w-1 h-1' : size === 'lg' ? 'w-2 h-2' : 'w-1.5 h-1.5';
    return (
      <span {...aria} className={`inline-flex items-center gap-1 ${className}`}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`rounded-full bg-accent motion-reduce:animate-none ${d}`}
            style={{ animation: `spellDot 1.2s ease-in-out ${i * 0.15}s infinite` }}
          />
        ))}
        <style>{`@keyframes spellDot { 0%,60%,100% { opacity: .25; transform: scale(.8); } 30% { opacity: 1; transform: scale(1); } }`}</style>
      </span>
    );
  }

  const dim =
    size === 'sm'
      ? 'h-4 w-4 border-[1.5px]'
      : size === 'lg'
        ? 'h-8 w-8 border-[2.5px]'
        : 'h-6 w-6 border-2';
  return (
    <span
      {...aria}
      className={`inline-block animate-spin rounded-full border-zinc-300 border-t-accent dark:border-zinc-600 motion-reduce:animate-none ${dim} ${className}`}
    />
  );
}
