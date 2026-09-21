"use client";

import { useLocale } from "../../i18n";

/**
 * The landing hero's product frame: a static depiction of the DocTalk reader
 * answering one question about one real document.
 *
 * Plan: .collab/plans/2026-09-20-apple-design-direction.md §7 Phase 1, owner
 * decision A2 (§10 Q1) — the frame shows the full reader and is the visual
 * spec for the Phase 4 reader redesign. Its three regions map one-to-one onto
 * real reader regions (header strip, chat column, document pane) so Phase 4
 * can swap in the real components; nothing here is a feature the reader lacks.
 *
 * HONESTY CONSTRAINTS — read before editing:
 *  - PAGE_TEXT is copied verbatim from page 1 of
 *    backend/seed_data/alphabet-earnings.pdf (the finance demo document).
 *    The highlighted sentence is the one the live product cites for this
 *    question. Do not edit it; do not translate it — it is a quotation from an
 *    English document, and the reader never translates source text.
 *  - The answer paraphrases only that sentence. It must not assert anything the
 *    source does not.
 *  - The caption must not claim quotes are word-for-word. Word-for-word is only
 *    guaranteed for `page_text` results (see .claude/rules/frontend.md, Quote
 *    Finder UI). "Taken straight from the document" and "checked against the
 *    source text" are both backed by the verified-quote pipeline.
 *
 * The visual is aria-hidden; screen readers get the sr-only description and
 * the visible caption, which are real text.
 */

const DOC_NAME = "2025q4-alphabet-earnings-release.pdf";

// Verbatim, page 1. Split so the cited sentence can be highlighted.
const PAGE_TITLE = "Alphabet Announces Fourth Quarter and Fiscal Year 2025 Results";
const PAGE_DATELINE =
  "MOUNTAIN VIEW, Calif. – February 4, 2026 – Alphabet Inc. (NASDAQ: GOOG, GOOGL) today announced financial results for the quarter ended December 31, 2025.";
// The paragraph opens with no quotation mark in the source (it is the third
// paragraph of a quotation that began two paragraphs earlier); only the
// closing ” after "billion." is present, and it is rendered below.
const PAGE_LEAD_IN =
  "We’re seeing our AI investments and infrastructure drive revenue and growth across the board. ";
const PAGE_CITED =
  "To meet customer demand and capitalize on the growing opportunities we have ahead of us, our 2026 CapEx investments are anticipated to be in the range of $175 to $185 billion.";
const PAGE_AFTER = "Q4 2025 Financial Highlights";

export default function ProductFrame() {
  const { tOr } = useLocale();

  const question = tOr(
    "landing.frame.question",
    "How much does Alphabet plan to spend on capital in 2026?",
  );
  const answer = tOr(
    "landing.frame.answer",
    "Alphabet expects its 2026 capital expenditure to be between $175 and $185 billion, to meet customer demand and the growing opportunities ahead.",
  );

  return (
    <figure className="ed-frame-figure">
      <div className="ed-frame" aria-hidden="true">
        {/* (a) header strip — the reader's own chrome, not a fake browser */}
        <div className="ed-frame-bar">
          <span className="ed-frame-mark" />
          <span className="ed-frame-doc">{DOC_NAME}</span>
          <span className="ed-frame-pageno">p. 1</span>
        </div>

        <div className="ed-frame-body">
          {/* (b) chat column */}
          <div className="ed-frame-chat">
            <p className="ed-frame-q">{question}</p>
            <p className="ed-frame-a">
              {answer}
              <span className="ed-frame-cite">1</span>
            </p>
            <div className="ed-frame-source">
              <span className="ed-frame-cite">1</span>
              <span className="ed-frame-source-page">p. 1</span>
              <span className="ed-frame-source-doc">{DOC_NAME}</span>
            </div>
          </div>

          {/* (c) document pane — a light "paper island" in both themes, the way
              a real PDF page renders */}
          <div className="ed-frame-pane">
            <div className="ed-frame-page">
              <p className="ed-frame-page-title">{PAGE_TITLE}</p>
              <p className="ed-frame-page-text ed-frame-page-muted">{PAGE_DATELINE}</p>
              <p className="ed-frame-page-text">
                {PAGE_LEAD_IN}
                <mark className="ed-frame-mark-cited">
                  <span className="ed-frame-badge">1</span>
                  {PAGE_CITED}
                </mark>
                ”
              </p>
              <p className="ed-frame-page-sub">{PAGE_AFTER}</p>
            </div>
          </div>
        </div>
      </div>

      <p className="sr-only">
        {tOr(
          "landing.frame.description",
          "An example of DocTalk answering a question about Alphabet's fourth-quarter 2025 earnings release. The answer cites page 1, and the cited sentence is highlighted on that page.",
        )}
      </p>

      <figcaption className="ed-frame-caption">
        <span>
          {tOr(
            "landing.frame.caption",
            "Every answer links to the sentence it came from, on its page.",
          )}
        </span>{" "}
        <span>
          {tOr(
            "landing.frame.quoteFinder",
            "Writing something that needs quotes? Quote Finder pulls them straight from your document, each checked against the source text.",
          )}
        </span>
      </figcaption>
    </figure>
  );
}
