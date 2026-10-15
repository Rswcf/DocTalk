# AskYourPDF facts site-wide, plus PDF.ai / Humata / Gemini cells (2026-10-15)

Follow-up to `.collab/reviews/2026-10-14-notebooklm-askyourpdf/` ("Follow-up, not done"). The 10-10 source of record
(`vendor-evidence.md` §2.6) read only AskYourPDF's `/chat-with-pdf` and the static pricing HTML, so four false
statements stayed live wherever the site describes AskYourPDF: PowerPoint "—"/"No", "does not say it highlights the
passage", yearly-billed prices shown as bare "/month", and "the pricing page does not show a monthly-billed price".
Evidence: `.collab/reviews/2026-10-14-notebooklm-askyourpdf/evidence.md` (10-14), re-read 10-15 in `evidence.md`
here (nothing changed).

## Gate

`best-ai-pdf-tools-2026.md` and `chatpdf-alternatives-2026.md` are C-9 read units (Fable 10-14 Q1 unfroze them once,
for the 10-14 13:41Z corrections). **Owner approved a third intervention on 2026-10-15** (AskUserQuestion, option
"Fix now": AskYourPDF facts only, same Q1 rules — title, frontmatter description, headings, tool order, Short answer
and Verdict unchanged; `updated` = ship date; logged as the third intervention on 2 of 3 C-9 units).
`best-ai-tools-academic-research-2026.md` and `ai-pdf-readers-page-number-citations-2026.md` are untouched.

## What changed

Commit 61b07d95 plus the Codex r1 fixes (branch `content/askyourpdf-facts-2026-10-15`, base main 8ce854f9). English wording follows the
10-14 notebooklm post (Codex r2 SHIP) and the 10-14 sibling corrections.

**Blog (English only):**
- `best-ai-pdf-tools-2026.md` (C-9): What it does + both vendor format lists; Key features + the vendor's citation
  claim ("the exact paragraph or page", click jumps, source highlighted); Pricing monthly and yearly; Limitations
  "no Excel files: its pages list CSV but not .xlsx"; table PowerPoint Yes, Excel CSV, How you check = the notebooklm
  cell, Paid from "$11.99/mo (yearly)"; check-date sentences :34/:171 add "AskYourPDF … 15 October 2026". Audio:
  the post makes no AskYourPDF audio claim (only Gemini's audio overviews), so nothing changed there.
- `chatpdf-alternatives-2026.md` (C-9): "began as a ChatGPT plugin" dropped (no vendor page says so); format
  sentence; Pros + citation claim; Cons "No Excel files…"; Pricing; table row (formats union, cell, "(yearly)");
  check dates :25/:190.
- `notebooklm-alternatives-2026.md`: PDF.ai "PDF only" (FAQ quote), Word/PowerPoint "No / No", "Cited sources";
  Humata "Cited links to files; "Highlights citations" (unspecified)" + prose; Gemini "Inline citation, jumps to the
  quote" + prose (:43); FAQ :174 adds AskYourPDF's highlight claim; check dates name 15 October for those three.
- `how-to-chat-with-docx-ai.md`: AskYourPDF DOCX "Not listed¹" → "Yes (DOCX)" (false before); PDF.ai, Gemini, ChatDOC
  cells vendor-sourced; footnote ¹ removed (no ¹ cell left); intro :22 PDF.ai from its FAQ; AskYourPDF added to the
  "read DOCX natively" sentence.
- `citation-highlighting-matters.md`: AskYourPDF row (vendor says the source is highlighted).
- `chat-with-excel-spreadsheet-ai.md` (Codex r1 #2): AskYourPDF removed from the "you will get an error message or a
  suggestion to convert to PDF" prediction (no evidence for either response); new sentence "AskYourPDF's published
  format lists include CSV but do not list Excel (.xlsx) files." The ChatPDF / PDF.ai prediction is unchanged.
- `updated: 2026-10-15` on all six. Untouched: titles, descriptions, headings, tool order, Short answers, Verdicts;
  `best-ai-tools-academic-research-2026.md`, `ai-pdf-readers-page-number-citations-2026.md`.

**Locales (11):** 31 changed keys + 1 new (`comparison.vendorSaysYes`) in every locale; key parity checked
(32 per locale, nothing left unchanged, one new key). False facts: `compareAskyourpdf.{featureSupportedFormatsCompetitor,
whatIsAskyourpdfDescription, documentFormatCompetitor, citationsCompetitor, pricingCompetitor, faq2Answer, faq4Answer}`,
`altsAskyourpdf.{tablePdfOnly, whyReason1, whyReason4, faq2Answer, faq3Answer, faq4Answer, adv6}`,
`altsHumata.{alt3Desc2, faq4Answer}`, `altsChatpdf.{alt2Desc1, alt2Desc2Pre}`, `altsNotebooklm.{alt3Desc2, faq3Answer}`,
`altsPdfai.alt3Desc2Pre`. **Scope note (Humata precedent, 10-10):** differentiators that rested on "AskYourPDF
lacks PowerPoint / does not highlight" were reworded to what is still true (Excel; Quote Finder):
`compareAskyourpdf.{whoDocTalk2, verdictParagraph2, verdictParagraph3, faq1Answer, ctaDescription}`,
`compareHub.tagline.askyourpdf`, `altsAskyourpdf.{heroDescription, whyReason2, alt1Desc1, adv1}`. No `*.metaTitle` /
`*.metaDescription` changed. pt `compareAskyourpdf.{faq2Question, verdictParagraph3Mid}` were half English; now
Portuguese. Codex r1 fixes: zh "段落或页码" → "段落或页面" in the ten AskYourPDF strings (vendor says "paragraph or
page", not page number); `compareAskyourpdf.verdictParagraph3`/`verdictParagraph3Mid` joins repaired in pt, hi
("To compare, …"), ja ("…ことです。") and ko (parenthetical, because the markup puts a space after the link).
Translations: five Opus agents (two locales each) from the English diff; executor token check (numbers,
prices, formats, product names) 0 issues.

**TSX:** AskYourPDF highlight cell = `comparison.vendorSaysYes` on /features/citations, /features/multi-format,
/compare/askyourpdf, /alternatives/askyourpdf (was "Links to the cited page" / "Not verified"); multi-format PPTX
`true`. `comparison.linksToPage` is now unused (left in place).

## Reviews

- Codex r1 (gpt-6-astra; `codex-r1-prompt.md`, `codex-r1-output.md`): SHIP-WITH-FIXES, two SHOULD and one NIT, all
  applied (see above).
- Codex r2 (`codex-r2-prompt.md`, `codex-r2-output.md`): **SHIP**, no findings.

## Checks

- After the r1 fixes: `npm run test:unit` 363/363; `npm run build` 426/426; built-HTML phrase check on 15 pages PASS
  (present/absent phrases, `dateModified` 2026-10-15 on the six posts); built zh/ja/ko/pt/hi `/compare/askyourpdf`
  show the new strings and none of the old.
- Locale parity: 32 keys per locale changed or added in all 11; executor token check 0 issues.
- `indexnow-urls.txt`: 82 URLs (it/ar/hi sub-pages left out: noindex).

## Release

- Frontend only (0 diff lines under backend/, version.json, infra/). main 8ce854f9 → ad2c8030 (CI 38671336665, 4/4);
  backend /health 0.36.1 at 02:32:27Z and 02:33:00Z; stable 3faef683 → ad2c8030 at 02:33:07Z; Vercel Production success
  02:34:30Z.
- Live check (no-cache) four runs 02:35:07Z → 02:36:11Z, PASS all four, plus the r1 locale fixes live on zh/ja/ko/pt/hi.
- IndexNow 02:36:16Z: 82 URLs, HTTP 200 OK.
- Logged in `.collab/reviews/2026-09-30-seo-audit/evidence/actions-log.md` (2026-10-15 02:33:07Z) as the third
  intervention on 2 of 3 C-9 units, with the 11-07 read notes.

## Not done (follow-ups)

- `ai-pdf-readers-page-number-citations-2026.md` and `best-ai-tools-academic-research-2026.md` are frozen and were
  not read for AskYourPDF claims in this batch; if they carry §2.6 wording, it waits for the 11-07 read.
- pt and hi `compareAskyourpdf.verdictParagraph3Mid` + `verdictParagraph3End` keep the English word order for the
  ChatPDF link ("nossa DocTalk vs. ChatPDF comparação"); readable, not fixed here.
- pt `compareHumata.faq2Question` ("Does Humata have destaque de citação?") is half English (not this page).
- `featuresMultilingual` table marks AskYourPDF, ChatPDF and NotebookLM interface "English only" and several rows
  "No" with no vendor evidence on record.
