import React from 'react';
import { LOCALES, type Locale } from '../../i18n/locales-meta';
import { CITED, DOC_NAME, PARAGRAPHS } from '../landing/citationFieldContent';
import { UPLOAD_EXTENSIONS } from '../../lib/uploadFormats';

/**
 * Small pieces of the product, drawn in HTML on the editorial tokens, for the
 * landing feature cards, How it works and the feature-page heroes (plan
 * .collab/plans/2026-11-22-ui-ux-pangram-learnings.md, M4/M5/M7; Pangram puts
 * mini product UI in its feature cards instead of icons).
 *
 * Rules:
 *  - Pure components: no hooks, no "use client". Server feature pages and the
 *    client landing both render them, and pass every string in already
 *    translated.
 *  - Only real output. The answer is the hero card's answer
 *    (`landing.frame.*`), the page text is the verbatim sample page
 *    (citationFieldContent.ts, always `dir="ltr" lang="en"`), and the formats
 *    are the ones upload accepts. Change them together with those sources.
 *  - Illustrations, not controls: `aria-hidden`, nothing focusable, the copy
 *    beside each one says the same thing in words.
 *  - Nothing under 12px (an earlier set of mini illustrations was removed for
 *    7-10px text); amber `--ed-evidence` only marks citations.
 *  - Content layer: opaque `--ed-surface`, never glass. No `.dt-editorial`
 *    root here; the page's root owns it.
 */

export interface AnswerStrings {
  question: string;
  answer: string;
  source: string;
}

export function AnswerVignette({ question, answer, source }: AnswerStrings) {
  return (
    <div className="ed-vignette" aria-hidden="true">
      <p className="ed-vignette-q">{question}</p>
      <p className="ed-frame-a ed-vignette-a">
        {answer}
        <span className="ed-frame-cite">1</span>
      </p>
      <div className="ed-frame-source">
        <span className="ed-frame-cite">1</span>
        <span className="ed-frame-source-doc">{source}</span>
      </div>
    </div>
  );
}

/** The sentence before the cited one, from the same paragraph. */
const CITED_PARAGRAPH = PARAGRAPHS.find((p) => p.includes(CITED)) ?? CITED;
const LEAD_IN = CITED_PARAGRAPH.slice(0, CITED_PARAGRAPH.indexOf(CITED)).trim();

export function PassageVignette({ pageLabel }: { pageLabel: string }) {
  return (
    <div className="ed-vignette ed-vignette-page" aria-hidden="true">
      <div className="ed-vignette-pagebar">
        <span className="ed-vignette-doc" dir="ltr" lang="en">{DOC_NAME}</span>
        <span className="ed-vignette-pageno">{pageLabel}</span>
      </div>
      <p className="ed-vignette-passage" dir="ltr" lang="en">
        <span className="ed-vignette-margin">
          <span className="ed-frame-cite">1</span>
        </span>
        <span className="ed-vignette-lead">{LEAD_IN} </span>
        <mark className="ed-vignette-mark">{CITED}</mark>
      </p>
    </div>
  );
}

/** Four language pills (one line in a feature card), the reader's own always
 *  among them and selected. */
export function vignetteLanguages(current: string): { code: Locale; label: string }[] {
  const picked: Locale[] = ['en', 'zh', 'es', 'ar'];
  const own = LOCALES.find((l) => l.code === current)?.code;
  const codes = own && !picked.includes(own) ? [...picked.slice(0, 3), own] : picked;
  return codes.map((code) => ({ code, label: LOCALES.find((l) => l.code === code)!.label }));
}

export function LanguagesVignette({
  locale,
  question,
  answer,
  source,
}: AnswerStrings & { locale: string }) {
  const active = LOCALES.some((l) => l.code === locale) ? locale : 'en';
  return (
    <div className="ed-vignette" aria-hidden="true">
      <div className="ed-vignette-pills">
        {vignetteLanguages(active).map((l) => (
          <span
            key={l.code}
            lang={l.code}
            className={`ed-vignette-pill${l.code === active ? ' is-active' : ''}`}
          >
            {l.label}
          </span>
        ))}
      </div>
      <p className="ed-vignette-q">{question}</p>
      <p className="ed-frame-a ed-vignette-a">
        {answer}
        <span className="ed-frame-cite">1</span>
      </p>
      <div className="ed-frame-source">
        <span className="ed-frame-cite">1</span>
        <span className="ed-frame-source-doc">{source}</span>
      </div>
    </div>
  );
}

/** The layout of one page: a title, two columns of text, a figure and an
 *  equation line. Lines are shapes, not words: this shows structure kept, it
 *  does not pretend to be a translation of anything. */
function PageSketch({ variant }: { variant: 'original' | 'translated' }) {
  // Different line lengths on the translated page: the words change, the
  // places on the page do not.
  const left = variant === 'original' ? [92, 100, 84, 96, 70] : [100, 88, 96, 78, 90];
  const right = variant === 'original' ? [100, 90, 96, 62] : [86, 100, 74, 94];
  return (
    <div className="ed-vignette-sheet">
      <span className="ed-vignette-line is-title" style={{ width: variant === 'original' ? '72%' : '64%' }} />
      <div className="ed-vignette-cols">
        <div>
          {left.map((w, i) => <span key={i} className="ed-vignette-line" style={{ width: `${w}%` }} />)}
        </div>
        <div>
          <span className="ed-vignette-figure" />
          {right.map((w, i) => <span key={i} className="ed-vignette-line" style={{ width: `${w}%` }} />)}
        </div>
      </div>
      <span className="ed-vignette-line is-equation" />
    </div>
  );
}

export function TranslationVignette({ originalLabel, translatedLabel }: { originalLabel: string; translatedLabel: string }) {
  return (
    <div className="ed-vignette ed-vignette-translate" aria-hidden="true">
      <figure className="ed-vignette-side">
        <PageSketch variant="original" />
        <figcaption>{originalLabel}</figcaption>
      </figure>
      <span className="ed-vignette-arrow">→</span>
      <figure className="ed-vignette-side">
        <PageSketch variant="translated" />
        <figcaption>{translatedLabel}</figcaption>
      </figure>
    </div>
  );
}

/** The formats upload accepts (lib/uploadFormats.ts, never forked) plus URL
 *  import. */
export const VIGNETTE_FORMATS: readonly string[] = [
  ...UPLOAD_EXTENSIONS.map((ext) => ext.slice(1).toUpperCase()),
  'URL',
];

export function FormatsVignette({ dropLabel }: { dropLabel: string }) {
  return (
    <div className="ed-vignette" aria-hidden="true">
      <div className="ed-vignette-drop">
        <span className="ed-vignette-drop-label">{dropLabel}</span>
        <div className="ed-vignette-formats">
          {VIGNETTE_FORMATS.map((f) => (
            <span key={f} className="ed-vignette-format">{f}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
