"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { trackEvent } from "../../lib/analytics";

type EventParams = Record<string, string | number | boolean | null | undefined>;

/**
 * Client island for a CTA link that fires an analytics event on click. Lets the
 * surrounding marketing page be a server component (which can't carry onClick
 * handlers) while preserving click tracking. Server pages pass the resolved
 * label as children and the event spec as props.
 */
export default function TrackedCtaLink({
  href,
  event,
  className,
  style,
  children,
}: {
  href: string;
  event?: { name: string; params?: EventParams };
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={event ? () => trackEvent(event.name, event.params) : undefined}
      className={className}
      style={style}
    >
      {children}
    </Link>
  );
}
