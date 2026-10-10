# Competitor facts batch — review resolution (2026-10-11)

Codex r1 SHIP-WITH-FIXES → r2 SHIP-WITH-FIXES → r3 SHIP-WITH-FIXES (one trailing space, applied verbatim). Reviews: `codex-r1.md`, `codex-r2.md`, `codex-r3.md`. Change log: `fix-list.md` (first commit only; later rounds are below).

## Round 1 findings
- 1 (DocTalk security claims): kept, reworded to the Trust page (`trust.encryption.rest.*`, `trust.encryption.noTraining.*`, `trust.dataRights.export.*`). "All your data" removed: the export excludes original files.
- 2 (DocTalk overclaims): applied. Kept and verified in code: PPTX speaker notes (`pptx_extractor.py:60-66`), XLSX = one markdown table per sheet (`xlsx_extractor.py:10-37`), answer language = question language (`chat_service.py:2169`). "Clean article content" removed: the Wikipedia URL-import fix (`fix/url-import-root-classes`) is not in production.
- 3 rejected: "DocTalk has no browser extension, Zotero plugin or public API" is a true statement about DocTalk; the AskYourPDF table already shows ✗.
- 4 rejected: PR §1 quotes ChatPDF: "creating a free account unlocks additional features like saved history and multi-document chats".
- 5, 6 applied ("most focused" superlative; "lock-in" wording).

## Round 2 findings
- 1–3 applied as written. 4 (`SecItemCopyMatching -50`) was the Codex sandbox keychain; tests pass outside it (228/228).
- Also fixed: three older lock-in values on these pages, and the fr `comparePdfai.languageSupportDocTalk` value that ended in a dangling "Voir la page de " on a standalone paragraph (pre-existing live defect).

## Found by Claude, fixed in this batch
- **Highlight claims vs the product (site test F21, `TextViewer.tsx:737` I25):** DocTalk highlights the cited passage only in PDF and TXT; MD, DOCX, PPTX, XLSX and URL citations jump to the location with a page caption. Twelve DocTalk values that said "every/any citation" or tied highlighting to "seven formats" now say "in PDF and text files". Generic "DocTalk highlights the cited passage" sentences on these pages were left as they are (the comparisons are against PDF tools).
- **Duplicated product name:** the 5 compare components rendered `<a>Name</a> {description}` while every description already starts with the name ("ChatPDF ChatPDF is …" live). The description now renders alone, followed by the official domain as a link; NotebookLM links to notebook.google.com.
- **"Approximately 4.5 billion native speakers"** (unsourced DocTalk claim) removed from 21 values.

## Not done (out of scope; for a later pass)
- **Site-wide F21:** the landing page, /features/* and the blog still describe highlighting without the PDF/TXT limit. Either build inline highlighting for the other 5 formats (F21, routed to Fable on 09-23) or qualify the copy site-wide. Owner/Fable decision.
- `altsNotebooklm.adv1` still says "real-time" (pt half English); `*.whoDocTalk.item3` still says "fully localized"; pt `compareAskyourpdf.verdictParagraph3Mid` is half English.
- `comparePdfai.featureActiveDevelopment*` keys are unused; the `*AltsJsonLd.tsx` ItemLists still link chatpdf.com / notebooklm.google.com (both redirect).
