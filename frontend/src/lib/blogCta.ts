import { trackEvent } from './analytics';

// A blog post's call to action is its /demo links: the about box, the CTA
// banner and /demo links inside the post text. They send landing_cta_clicked,
// the attributed funnel event the traffic readout counts per landing page.
// Before this, a visitor who landed on a post was counted only at the sign-in
// step, while a home-page visitor was counted at the first CTA click (Fable
// ruling 2026-10-14, Q2: `.collab/dialogue/2026-10-14-fable-readout-rulings.md`).

export type BlogCtaSource = 'blog_about' | 'blog_cta' | 'blog_inline';

const DEMO_HREF = /^\/demo(?:[/?#]|$)/;

export function isDemoHref(href: string | undefined): boolean {
  return typeof href === 'string' && DEMO_HREF.test(href);
}

export function trackBlogDemoClick(source: BlogCtaSource) {
  trackEvent('landing_cta_clicked', { source, reason: 'demo' });
}
