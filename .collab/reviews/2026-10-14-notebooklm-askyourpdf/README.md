# AskYourPDF facts in notebooklm-alternatives-2026 (2026-10-14)

Owner request: replace the "per third-party reviews" label on AskYourPDF's Zotero and Chrome integrations
(`notebooklm-alternatives-2026.md:91`) with vendor-sourced wording, check the rest of the AskYourPDF section against
vendor evidence, set `updated` to the ship date. The post is not frozen. Frozen and untouched:
`best-ai-tools-academic-research-2026.md`, `ai-pdf-readers-page-number-citations-2026.md`.

## What changed in the post

- Apps: web, iOS, Android, Chrome extension, ChatGPT GPT, Zotero plugin (vendor, no ¹). "Began as a ChatGPT plugin"
  removed: no vendor page says so.
- Formats: names both vendor lists. `/chat-with-pdf`: PDF, DOCX, EPUB, TXT or a pasted URL; `/pdf-ai` and
  `/chat-with-documents`: PDF, DOCX, EPUB, PPTX, RTF, TXT, CSV. Table: Word / PowerPoint "Yes / Yes", Excel "CSV".
- Citations: stated as the vendor's claim, "the exact paragraph or page", a click jumps to the source, the source is
  highlighted. Table: "Paragraph or page cited; vendor says a click jumps there and highlights it".
- Prices: Premium $14.99/month, or $11.99/month billed yearly; Pro $19.99/month, or $14.99/month billed yearly.
  Table "Paid from" "$11.99/mo (yearly)".
- Audio: AskYourPDF publishes a separate Chrome extension, PodcastAnywhere. Table cell "Separate extension
  (PodcastAnywhere)"; "None of the alternatives here offer them" → "only AskYourPDF offers podcast-style audio,
  through a separate Chrome extension".
- Check-date sentences: "AskYourPDF's prices and features were checked again on 14 October 2026". `updated` 2026-10-14.

Unchanged: title, description, headings, tool order, Short answer, FAQ, the other tools' cells.

## The evidence changed during the work

`vendor-evidence.md` §2.6 (10-10) read only `/chat-with-pdf` and the static pricing HTML. A first draft built on it
(local commit 0db7cf34, never pushed) said "PowerPoint —", "AskYourPDF does not say it highlights the passage" and
"The pricing page does not show a monthly-billed price". An Opus fact-check (`opus-r1-output.md`, run while Codex
rejected every model) found all three false on AskYourPDF's other pages and in the pricing toggle. The executor
re-checked them against the saved pages before rewriting. Source of record now: `evidence.md` (quotes ≤25 words,
read 2026-10-14). §2.6 carries a dated addendum pointing here.

## Reviews

- Codex attempt with `-m gpt-5.5` (CLAUDE.md): rejected, as were `gpt-5.4` and `gpt-6.1-sol` ("not supported when using
  Codex with a ChatGPT account"); `codex debug models` listed `gpt-6-astra`, used for r1 and r2.
- Opus r1 (stand-in): REWORK, 3 BLOCKER, 3 SHOULD, 2 NIT; all applied in this post except SHOULD 6 (follow-up below).
- Codex r1 (gpt-6-astra): SHIP-WITH-FIXES, 1 SHOULD (audio) + 2 NIT (formats wording, launch history); all applied.
- Codex r2: **SHIP**, 1 NIT (tutorial date), applied in `evidence.md`.

## Checks

- `npm run test:unit` 363/363; `npm run build` 426/426; built `<article>`: every new phrase present, every replaced
  phrase absent, JSON-LD `dateModified` 2026-10-14.

## Follow-up, not done (owner / Fable decision)

The same §2.6 gap is live elsewhere and now contradicts this post:
- `best-ai-pdf-tools-2026.md` :92 (bare "/month" prices), :96 ("does not say it highlights"), :177 (PowerPoint "—"),
  :178 (Excel "No"), :180; `chatpdf-alternatives-2026.md` :78, :80, :196. Both shipped 2026-10-14 13:41Z (C-9 units).
- `en.json` and the 10 other locales: `compareAskyourpdf.{citationsCompetitor, faq2Answer, documentFormatCompetitor,
  featureSupportedFormatsCompetitor, faq4Answer, pricingCompetitor}`, `altsAskyourpdf.{heroDescription, whyReason1,
  whyReason2, whyReason4, faq2Answer, faq3Answer, faq4Answer, tablePdfOnly}`, `altsHumata.alt3Desc2`.
- Same post, other tools (siblings already upgraded them from vendor-evidence §2.9–2.11): PDF.ai "third-party reviews
  report no native Word or PowerPoint chat" (:122) and its "No¹"/"Text reference¹" cells; Gemini Notebook "Inline
  citation" (no jump-to-quote); Humata "Link to file".
