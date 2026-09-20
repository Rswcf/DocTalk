/**
 * Key lists shared by the landing page's visible sections and its JSON-LD.
 *
 * `FAQ.tsx` and `HowItWorks.tsx` are client components; `app/HomeJsonLd.tsx` is a
 * server component. Both read the copy from these same lists, so the structured
 * data cannot describe something the page does not show. Keep this module free of
 * "use client" and of React imports so either side can import it.
 */

/** Used when a locale has no `landing.faq.a2`; mirrors the visible FAQ's `tOr` fallback. */
export const FILE_SUPPORT_FALLBACK =
  'DocTalk supports PDF, DOCX, PPTX, XLSX, TXT, and Markdown files, plus web URLs. PDFs include scanned documents via built-in OCR. Direct uploads use plan limits of Free 50 MB / 750 pages, Plus 100 MB / 1,500 pages, and Pro 200 MB / 3,000 pages. URL imports are capped at 10 MB on every plan.';

export const FAQ_ITEMS = [
  { q: 'landing.faq.q1', a: 'landing.faq.a1' },
  { q: 'landing.faq.q2', a: 'landing.faq.a2', fallback: FILE_SUPPORT_FALLBACK },
  { q: 'landing.faq.q3', a: 'landing.faq.a3' },
  { q: 'landing.faq.q4', a: 'landing.faq.a4' },
  { q: 'landing.faq.q5', a: 'landing.faq.a5' },
  { q: 'landing.faq.q6', a: 'landing.faq.a6' },
] as const;

export const HOW_IT_WORKS_STEPS = [
  { num: '01', titleKey: 'landing.howItWorks.step1.title', descKey: 'landing.howItWorks.step1.desc' },
  { num: '02', titleKey: 'landing.howItWorks.step2.title', descKey: 'landing.howItWorks.step2.desc' },
  { num: '03', titleKey: 'landing.howItWorks.step3.title', descKey: 'landing.howItWorks.step3.desc' },
] as const;
