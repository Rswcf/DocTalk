"use client";

import Link from 'next/link';
import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Play } from 'lucide-react';
import { useLocale } from '../../i18n';
import { localizedHref } from '../../i18n/routing';
import { trackEvent } from '../../lib/analytics';

const MEDIA = '/media/citation-demo';
const PHONE = '(max-width: 767px), (pointer: coarse) and (max-width: 960px) and (max-height: 500px)';
const playerClass = 'block h-auto max-h-[72svh] w-auto max-w-full rounded-[var(--ed-r-3)]';

export default function ProductDemo() {
  const { locale, t } = useLocale();
  const [format, setFormat] = useState<'portrait' | 'landscape' | null>(null);
  const video = useRef<HTMLVideoElement>(null);

  function playDemo() {
    // Start media within the user's gesture, including on iOS. Keep their place on rotation.
    flushSync(() => setFormat(window.matchMedia(PHONE).matches ? 'portrait' : 'landscape'));
    video.current?.focus({ preventScroll: true });
    video.current?.play().catch(() => { /* Native controls remain available for a retry. */ });
  }

  return (
    <section id="product-demo" aria-labelledby="demo-film-title" className="ed-section border-y border-[var(--ed-rule)]">
      <div className="ed-shell grid items-center gap-6 lg:grid-cols-[1fr_2.4fr] lg:gap-12">
        <div className="flex flex-wrap items-center justify-between gap-4 lg:flex-col lg:items-start lg:gap-7">
          <h2 id="demo-film-title" className="ed-h2">{t('landing.video.title')}</h2>
          <Link className="ed-cta" href={localizedHref(locale, '/demo')}
            onClick={() => trackEvent('landing_cta_clicked', { source: 'product_video', reason: 'demo' })}>
            {t('landing.video.try')}
          </Link>
        </div>
        <div className="flex min-w-0 justify-center">
          {format ? (
            <video ref={video} className={playerClass} controls playsInline tabIndex={0}
              width={format === 'portrait' ? 720 : 1280} height={format === 'portrait' ? 1280 : 720}
              aria-labelledby="demo-film-title" src={`${MEDIA}/${format}.mp4`} poster={`${MEDIA}/${format}.webp`} />
          ) : (
            <button type="button" onClick={playDemo} aria-label={t('landing.video.play')}
              className="relative block max-w-full rounded-[var(--ed-r-3)] focus-visible:outline-offset-4">
              <picture>
                <source media={PHONE} srcSet={`${MEDIA}/portrait.webp`} width="720" height="1280" />
                {/* A native picture selects the matching poster before hydration. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={playerClass} src={`${MEDIA}/landscape.webp`} alt="" width="1280" height="720" loading="lazy" />
              </picture>
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-black/80 text-white">
                  <Play aria-hidden="true" size={24} fill="currentColor" />
                </span>
              </span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
