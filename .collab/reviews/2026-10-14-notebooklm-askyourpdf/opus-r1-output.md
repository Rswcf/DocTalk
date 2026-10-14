# Opus r1 fact-check of commit 0db7cf34 (stand-in while Codex rejected every model, 2026-10-14)

Brief: `codex-r1-prompt.md` as first written (diff of 0db7cf34). Reviewer: Claude Opus subagent, read-only, curl plus
the built-in browser (only the billing toggle was clicked). Its saved vendor copies were in the session scratchpad
and are not kept; the quotes it relied on are in `evidence.md`. The executor re-checked findings 1–3 against those
copies before acting.

**Verdict: REWORK.**

1. BLOCKER `:95` — "The pricing page does not show a monthly-billed price" is false. The toggle "Annual Billing (25% OFF)"
   is on by default; switched off, Premium $14.99 and Pro $19.99 per month, billed monthly. The page bundle holds the same
   figures. Fix in the PDF.ai shape: "Premium: $14.99/month, or $11.99/month billed yearly. Pro: $19.99/month, or $14.99/month
   billed yearly." Table "$11.99/mo (yearly)" is correct.
2. BLOCKER `:91` — "AskYourPDF does not say it highlights the passage" is false. `/pdf-ai`: answers come with the source
   paragraph or page highlighted; each answer cites the exact paragraph or page and a click jumps to the source.
3. BLOCKER `:137`, `:87` — PowerPoint "—" understates the formats. `/chat-with-documents`, `/pdf-ai`, `/ai-pdf-reader`,
   `/ai-document-assistant`, `/free-pdf-ai` list PDF, DOCX, EPUB, PPTX, RTF, TXT, CSV; `/chat-with-pdf` lists only PDF,
   DOCX, EPUB, TXT (+ URL). The vendor contradicts itself. PowerPoint "Yes / Yes", no ¹.
4. SHOULD `:138` — Excel "No": the vendor lists CSV; this table counts "Sheets or CSV" for Gemini. Fix: "CSV".
5. SHOULD `:139` — "Page citation, click to check" understates the vendor's paragraph-or-page claim.
6. SHOULD (follow-up, outside this commit) — the same errors are live: `best-ai-pdf-tools-2026.md` :92, :96, :177, :178,
   :180; `chatpdf-alternatives-2026.md` :78, :80, :196; `en.json` `compareAskyourpdf.{citationsCompetitor, faq2Answer,
   documentFormatCompetitor, featureSupportedFormatsCompetitor, faq4Answer, pricingCompetitor}`, `altsAskyourpdf.{heroDescription,
   whyReason1, whyReason2, whyReason4, faq2Answer, faq3Answer, faq4Answer, tablePdfOnly}`, `altsHumata.alt3Desc2`; all 11
   locales. Root cause: vendor-evidence §2.6/§3 read only `/chat-with-pdf`. The en.json keys are not independent evidence.
7. NIT `:21`, `:131` — check dates should be 14 October (the corrected facts come from the 10-14 re-fetch).
8. NIT `:87` — the "How it compares" line no longer compares.

Unchanged neighbours :14, :83, :97, :158 still true. Table rows 7 columns; footnote ¹ still used by Humata and PDF.ai;
`blog-jsonld.test.cjs` 7/7; frozen posts untouched.
