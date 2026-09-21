/**
 * The document the landing hero's citation field sets in low light: page 1 of
 * backend/seed_data/alphabet-earnings.pdf, the finance demo document the
 * "Try a sample document" action opens.
 *
 * HONESTY CONSTRAINTS (tests/landing-night.test.cjs checks the first two):
 *  - Every paragraph is copied VERBATIM from page 1 of a PDF in
 *    backend/seed_data/. Do not edit, abridge or translate the text: it is a
 *    quotation from an English document, and the reader never translates
 *    source text (the field renders it `dir="ltr" lang="en"` in every locale).
 *  - CITED is one sentence inside PARAGRAPHS, and it is the sentence the live
 *    product cites for `landing.frame.question`.
 *  - The answer card paraphrases only CITED. `landing.frame.{question,answer,
 *    source,description}` change together, in all 11 locales, whenever the
 *    sample changes.
 *
 * Replacing the sample: pick a page 1 from backend/seed_data/, copy its
 * paragraphs, re-point CITED and the four keys above. The canvas lays out
 * whatever text is here; no code changes. The company names and marks are
 * quoted from a public earnings release; the 2026 guidance dates the sample,
 * so revisit it whenever the seed set changes.
 */

export const DOC_NAME = '2025q4-alphabet-earnings-release.pdf';

export const PARAGRAPHS: readonly string[] = [
  'Alphabet Announces Fourth Quarter and Fiscal Year 2025 Results',
  'MOUNTAIN VIEW, Calif. – February 4, 2026 – Alphabet Inc. (NASDAQ: GOOG, GOOGL) today announced financial results for the quarter ended December 31, 2025.',
  '• Consolidated Alphabet revenues increased 18%, or 17% in constant currency, to $113.8 billion, reflecting strong momentum across the business and acceleration in growth in both Google Services and Google Cloud.',
  '• Google Services revenues increased 14% to $95.9 billion, led by 17% growth in Google Search & other, 17% in Google subscriptions, platforms, and devices, and 9% in YouTube ads.',
  '• YouTube revenue across ads and subscriptions exceeded $60 billion for the full year 2025.',
  '• Google Cloud saw a continued increase in customer demand as revenues increased 48% to $17.7 billion, led by an increase in Google Cloud Platform (GCP) across enterprise AI Infrastructure and enterprise AI Solutions, as well as core GCP products.',
  '• Consolidated Alphabet operating income increased 16% and operating margin was 31.6%. Operating income included a $2.1 billion employee compensation charge for Waymo.',
  '• Net income increased 30% and EPS increased 31% to $2.82.',
  'Sundar Pichai, CEO of Alphabet and Google, said: “It was a tremendous quarter for Alphabet and annual revenues exceeded $400 billion for the first time. The launch of Gemini 3 was a major milestone and we have great momentum. Our first party models, like Gemini, now process over 10 billion tokens per minute via direct API use by our customers, and the Gemini App has grown to over 750 million monthly active users. Search saw more usage than ever before, with AI continuing to drive an expansionary moment.',
  'We continue to drive strong growth across the business. YouTube’s annual revenues surpassed $60 billion across ads and subscriptions; we now have over 325 million paid subscriptions across consumer services, led by strong adoption for Google One and YouTube Premium. And Google Cloud ended 2025 at an annual run rate of over $70 billion, representing a wide breadth of customers, driven by demand for AI products.',
  'We’re seeing our AI investments and infrastructure drive revenue and growth across the board. To meet customer demand and capitalize on the growing opportunities we have ahead of us, our 2026 CapEx investments are anticipated to be in the range of $175 to $185 billion.”',
  'Q4 2025 Financial Highlights',
  'The following table summarizes our consolidated financial results for the quarter and fiscal year ended December 31, 2024 and 2025 (in millions, except for per share information and percentages).',
];

export const CITED =
  'To meet customer demand and capitalize on the growing opportunities we have ahead of us, our 2026 CapEx investments are anticipated to be in the range of $175 to $185 billion.';
