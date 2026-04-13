"use client";

import React from 'react';
import Link from 'next/link';

type BaseProps = {
  variant?: 'primary' | 'ghost';
  size?: 'md' | 'lg';
  className?: string;
  children: React.ReactNode;
};
type LinkishProps = BaseProps & { href: string; onClick?: never; type?: never; disabled?: never };
type BtnProps = BaseProps & {
  href?: never;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
};

/**
 * CTA button with liquid-fill hover. A ::before layer slides up from the
 * bottom on hover, giving the press an "it rose up to meet you" quality
 * vs. a flat color swap. Primary uses accent-hover as the fill, ghost
 * uses a low-alpha ink. Disabled in reduced-motion.
 */
export default function FlowButton(props: LinkishProps | BtnProps) {
  const { variant = 'primary', size = 'md', className = '', children } = props;
  const sizing = size === 'lg' ? 'px-7 py-3.5 text-base' : 'px-6 py-3 text-sm';
  const base =
    'group relative inline-flex items-center gap-2 rounded-lg font-semibold overflow-hidden isolate transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950 disabled:opacity-60 disabled:cursor-not-allowed';
  const tone =
    variant === 'primary'
      ? 'bg-accent text-accent-foreground shadow-sm focus-visible:ring-accent'
      : 'border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-50 bg-transparent focus-visible:ring-zinc-400';
  const fill =
    variant === 'primary'
      ? 'before:bg-accent-hover'
      : 'before:bg-zinc-900/[.06] dark:before:bg-white/10';
  const flow =
    "before:content-[''] before:absolute before:inset-0 before:-z-10 before:translate-y-full before:transition-transform before:duration-[450ms] before:ease-[cubic-bezier(.7,0,.2,1)] hover:before:translate-y-0 motion-reduce:before:hidden";
  const cls = `${base} ${sizing} ${tone} ${fill} ${flow} ${className}`;

  if ('href' in props && props.href !== undefined) {
    const external = props.href.startsWith('http');
    if (external) {
      return (
        <a href={props.href} className={cls} target="_blank" rel="noreferrer noopener">
          {children}
        </a>
      );
    }
    return (
      <Link href={props.href} className={cls}>
        {children}
      </Link>
    );
  }
  const { onClick, type = 'button', disabled } = props as BtnProps;
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}
