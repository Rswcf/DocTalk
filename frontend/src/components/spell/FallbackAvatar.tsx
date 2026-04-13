import React from 'react';

/**
 * Seven hand-tuned gradient palettes. Avoid pure-primary saturation —
 * these sit next to ink-blue accent without fighting it. Picked
 * deterministically by name hash so the same user always gets the same
 * color, but the space is diverse enough that 7 users in a row don't
 * collide.
 */
const gradients = [
  'from-blue-700 to-blue-400',
  'from-emerald-700 to-emerald-300',
  'from-amber-700 to-yellow-300',
  'from-rose-900 to-rose-300',
  'from-indigo-800 to-indigo-300',
  'from-sky-900 to-sky-300',
  'from-fuchsia-900 to-fuchsia-300',
];

function hashName(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

type Props = {
  name: string;
  size?: number;
  className?: string;
  /** Override hashed initial. Use when two chars read better (e.g. "MY"). */
  initial?: string;
};

/**
 * Gradient + initial avatar, replaces the generic gray/zinc placeholder
 * used in shared-doc headers, profile stubs, and comment authors.
 */
export default function FallbackAvatar({ name, size = 36, className = '', initial }: Props) {
  const safeName = (name || '?').trim();
  const displayInitial = (initial ?? safeName.charAt(0)).toUpperCase();
  const grad = gradients[hashName(safeName) % gradients.length];
  return (
    <span
      aria-hidden
      className={`relative inline-flex select-none items-center justify-center overflow-hidden rounded-full bg-gradient-to-br font-semibold text-white ${grad} ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {displayInitial}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.28), transparent 50%)',
        }}
      />
    </span>
  );
}
