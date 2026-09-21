"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLocale } from '../../i18n';
import { trackEvent } from '../../lib/analytics';
import CitationField, { type CitationFieldLayout, type CitationFieldSettings } from './CitationField';

/**
 * Landing hero, Night (plan .collab/plans/2026-09-21-landing-night.md; the
 * owner chose prototype B). One claim, one sentence, one filled action, then
 * the product: behind the claim a real document page sits in low light, a
 * lamp finds the cited sentence, and the answer arrives with its citation.
 *
 * Real text first. The h1, lede and actions are server-rendered; the canvas is
 * aria-hidden decoration inside a `dir="ltr" lang="en"` wrapper (it is an
 * English document and must not reflow in the Arabic UI); the answer card is
 * real text, and an sr-only line describes the picture.
 *
 * `landing.headline` drives only this h1; the page <title> reads
 * `landing.metaTitle` (app/[locale]/page.tsx), so the headline can change
 * without moving the search title. `landing.description` is the visible lede
 * and the landing JSON-LD's description (app/HomeJsonLd.tsx).
 *
 * Deliberately absent: an eyebrow, a stat band, an italic split, trailing
 * arrows on the actions (plan 2026-09-20 §5.2), and an entrance animation on
 * the claim: the h1 is the page's largest paint, and hiding it would delay it.
 */

// The field behind a desktop hero: the page tiled so the passage can sit low,
// with the claim in the dark above it.
const WIDE: CitationFieldSettings = {
  fontSize: 18,
  titleFontSize: 22,
  lineHeight: 30,
  paraGap: 12,
  pad: 96,
  repeat: 3,
  repeatSkip: 2,
  occurrence: 1,
  focusY: 0.64,
  dimAlpha: 0.16, // prototype B's value on its #0a0908 ground
  litAlpha: 0.72, // below full ink, so the cited words stay the brightest thing on the page
  lampRadius: 340,
  bloomAlpha: 0.2,
  bloomRadius: 420,
  cursorRadius: 190,
  cursorAlpha: 0.5,
  start: 700,
  scanDur: 1500,
  markDur: 900,
};

// Phones: the field is its own band under the claim.
const NARROW: CitationFieldSettings = {
  ...WIDE,
  fontSize: 15,
  titleFontSize: 18,
  lineHeight: 25,
  pad: 30,
  repeat: 2,
  occurrence: 0,
  focusY: 0.55,
  lampRadius: 220,
  bloomRadius: 260,
};

const NARROW_QUERY = '(max-width: 767px)';
const CARD_WIDTH = 420;
// Desktop card: aligned with the document's text column, directly under the
// passage (badge, passage, answer read down one edge). It stays clear of the
// bottom-right corner, where the first-visit cookie banner sits.
const CARD_EDGE = 24;

export default function HeroSection() {
  const { t, tOr } = useLocale();
  const headlineLines = t('landing.headline').split('\n');

  const stageRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const [narrow, setNarrow] = useState(false);
  const [cited, setCited] = useState(false);
  const [cardPos, setCardPos] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY);
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    // The card waits for the citation. Never let it wait forever: if the
    // canvas cannot run, show it anyway.
    const fallback = window.setTimeout(() => setCited(true), 6000);
    return () => {
      mq.removeEventListener('change', sync);
      window.clearTimeout(fallback);
    };
  }, []);

  const onLayout = useCallback((layout: CitationFieldLayout) => {
    const stage = stageRef.current;
    const card = cardRef.current;
    if (!stage || !card || window.matchMedia(NARROW_QUERY).matches) {
      setCardPos(null);
      return;
    }
    const stageWidth = stage.clientWidth;
    const stageHeight = stage.clientHeight;
    // The field is centred in the stage, so stage x = canvas x + inset.
    const inset = (stageWidth - layout.width) / 2;
    const left = Math.max(CARD_EDGE, inset + layout.textLeft);
    const cardFrom = left - inset - 8;
    const cardTo = left - inset + CARD_WIDTH + 8;
    const covered = layout.spans.filter((s) => s.x2 > cardFrom && s.x1 < cardTo);
    const below = covered.length ? Math.max(...covered.map((s) => s.bottom)) + 16 : layout.citedY + 24;
    const top = Math.min(below, stageHeight - card.offsetHeight - CARD_EDGE);
    setCardPos({ left: Math.round(left), top: Math.round(top) });
  }, []);

  const onCited = useCallback(() => setCited(true), []);

  return (
    <>
      <section
        ref={stageRef}
        className={`ed-night-stage${cited ? ' is-cited' : ''}`}
        aria-labelledby="landing-hero-title"
      >
        <div className="ed-night-field" dir="ltr" lang="en" aria-hidden="true">
          <CitationField settings={narrow ? NARROW : WIDE} onLayout={onLayout} onCited={onCited} />
        </div>

        <div className="ed-night-claim">
          <h1 id="landing-hero-title" className="ed-display">
            {headlineLines.map((line: string, i: number) => (
              <React.Fragment key={i}>
                {/* The space keeps the words apart where the break is hidden
                    (phones balance the whole headline instead). */}
                {i > 0 && <>{' '}<br /></>}
                {line}
              </React.Fragment>
            ))}
          </h1>

          <p className="ed-lede">{t('landing.description')}</p>

          <div className="ed-night-actions">
            <Link
              href="/demo"
              onClick={() => trackEvent('landing_cta_clicked', { source: 'hero', reason: 'demo' })}
              className="ed-cta"
            >
              {t('landing.cta.demo')}
            </Link>
            {/* Plain <a> (not next/link): a native hash anchor fires the
                `hashchange` event AuthModal listens for, so the modal opens.
                next/link updates the hash via history API without firing it. */}
            <a
              href="#auth"
              onClick={() => trackEvent('landing_cta_clicked', { source: 'hero', reason: 'sign_up' })}
              className="ed-link"
            >
              {t('hero.signUpFree')}
            </a>
          </div>
        </div>

        <figure
          ref={cardRef}
          className="ed-night-card"
          style={cardPos ? { left: cardPos.left, top: cardPos.top, bottom: 'auto' } : undefined}
        >
          <p className="ed-night-q">
            {tOr('landing.frame.question', 'How much does Alphabet plan to spend on capital in 2026?')}
          </p>
          <p className="ed-frame-a">
            {tOr(
              'landing.frame.answer',
              'Alphabet expects its 2026 capital expenditure to be between $175 and $185 billion, to meet customer demand and the growing opportunities ahead.',
            )}
            <span className="ed-frame-cite">1</span>
          </p>
          <figcaption className="ed-frame-source">
            <span className="ed-frame-cite">1</span>
            <span className="ed-frame-source-doc">
              {tOr('landing.frame.source', 'Alphabet Q4 2025 earnings release, p. 1')}
            </span>
          </figcaption>
        </figure>

        <p className="sr-only">
          {tOr(
            'landing.frame.description',
            "An example of DocTalk answering a question about Alphabet's fourth-quarter 2025 earnings release. The answer cites page 1, and the cited sentence is highlighted on that page.",
          )}
        </p>

      </section>

      {/* Quote Finder, named once, as the hero's footnote: under the stage, on
          plain ground, where no document text runs behind it. */}
      <p className="ed-night-note">
        {tOr(
          'landing.frame.quoteFinder',
          'Writing something that needs quotes? Quote Finder pulls them straight from your document, each checked against the source text.',
        )}
      </p>
    </>
  );
}
