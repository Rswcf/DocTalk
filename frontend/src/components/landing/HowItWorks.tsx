"use client";

import React, { useEffect, useId, useState } from 'react';
import { useLocale } from '../../i18n';
import { HOW_IT_WORKS_STEPS as steps } from './landingSchemaSources';
import { AnswerVignette, FormatsVignette, PassageVignette } from '../marketing/ProductVignettes';

/**
 * How it works: the three steps beside the product doing each one (plan
 * 2026-11-22-ui-ux-pangram-learnings, M5; Pangram pairs a product shot with
 * its numbered steps).
 *
 * Desktop (lg): the steps on one side, one picture on the other; pointing at,
 * focusing or clicking a step shows its picture. Phones and tablets: each
 * step carries its own picture, so nothing depends on hover.
 *
 * Every step's text is always rendered and visible (no accordion): the HowTo
 * schema in app/HomeJsonLd.tsx reads the same keys (landingSchemaSources.ts)
 * and must match what the page shows.
 */
export default function HowItWorks() {
  const { t, tOr } = useLocale();
  const [active, setActive] = useState(0);
  const panelId = useId();
  // The step titles are buttons only where they switch a picture (lg and up).
  // Below lg every step shows its own picture, and a button that does nothing
  // would only add dead tab stops (review 2026-11-23 F6). Starts false, as on
  // the server, so hydration matches; the effect upgrades desktop.
  const [linked, setLinked] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => setLinked(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const frame = {
    question: t('landing.frame.question'),
    answer: t('landing.frame.answer'),
    source: t('landing.frame.source'),
  };
  const visuals = [
    <FormatsVignette key="upload" dropLabel={tOr('landing.vignette.drop', 'Drop a file or paste a link')} />,
    <AnswerVignette key="ask" {...frame} />,
    <PassageVignette key="verify" pageLabel={tOr('landing.vignette.page', 'Page {page}', { page: 1 })} />,
  ];

  return (
    <div>
      <section id="how-it-works" className="ed-section">
        <div className="ed-shell">
          {/* Section header */}
          <div className="mb-12">
            <p className="ed-label mb-3">{tOr('landing.howItWorks.eyebrow', 'How it works')}</p>
            <h2 className="ed-h2">{t('landing.howItWorks.title')}</h2>
          </div>

          <div className="ed-how">
            <ol className="ed-how-steps">
              {steps.map(({ num, titleKey, descKey }, idx) => (
                <li
                  key={num}
                  className={`ed-how-step${idx === active ? ' is-active' : ''}`}
                  onMouseEnter={linked ? () => setActive(idx) : undefined}
                >
                  <div className="ed-num ed-how-num" aria-hidden="true">{num}</div>
                  <div className="min-w-0">
                    <h3 className="ed-h3">
                      {linked ? (
                        <button
                          type="button"
                          className="ed-how-trigger"
                          aria-controls={panelId}
                          aria-current={idx === active ? 'step' : undefined}
                          onClick={() => setActive(idx)}
                          onFocus={() => setActive(idx)}
                        >
                          {t(titleKey)}
                        </button>
                      ) : (
                        t(titleKey)
                      )}
                    </h3>
                    <p className="ed-body mt-3">{t(descKey)}</p>
                    <div className="ed-how-inline">{visuals[idx]}</div>
                  </div>
                </li>
              ))}
            </ol>
            <div id={panelId} className="ed-how-visual">
              {visuals[active]}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
