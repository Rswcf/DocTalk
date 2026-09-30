# Codex fact-check round 2 (gpt-5.5, 2026-10-01) — final section

codex
Read-only check complete. I did not run `git`.

1. FIXED — future dates are now `2026-10-01`: `chatpdf-alternatives-2026.md:5`, `best-ai-pdf-tools-2026.md:5`, `best-ai-tools-academic-research-2026.md:5`.
2. NOT FIXED — partial only. Methodology is improved at `best-ai-tools-academic-research-2026.md:24`, but `:281` still says prices are from each vendor’s site, while rows like Semantic Scholar/Zotero/ScholarAI are not supported that way.
3. NOT FIXED — main ScholarAI copy is fixed at `best-ai-tools-academic-research-2026.md:238-240`, but table row `:279` still implies current “Paper search in ChatGPT” / “ChatGPT users” despite saying current access was not verified.
4. FIXED — unsupported Consensus negatives are gone; current claims at `best-ai-tools-academic-research-2026.md:125-140` match the research file.
5. FIXED — unrefreshed discovery/reference features are now disclosed at `best-ai-tools-academic-research-2026.md:24`; risky negative limitations were pared back at `:157-160` and `:203-205`.
6. FIXED — AskYourPDF integrations are hedged: `chatpdf-alternatives-2026.md:67-72`, `best-ai-pdf-tools-2026.md:83-88`, `best-ai-tools-academic-research-2026.md:217`.
7. FIXED — “renamed in 2026” timing removed: `chatpdf-alternatives-2026.md:18`, `best-ai-pdf-tools-2026.md:100`, `best-ai-tools-academic-research-2026.md:75`.
8. FIXED — multi-document DocTalk copy now names collections: `best-ai-pdf-tools-2026.md:228`, `how-to-chat-with-docx-ai.md:144`; product code supports collection sessions/retrieval/cross-doc citation metadata at `backend/app/api/collections.py:354-365`, `backend/app/services/chat_service.py:2041-2046`, `backend/app/services/chat_service.py:295-298`.
9. FIXED — “exact sentence” became “exact passage”: `best-ai-tools-academic-research-2026.md:45`, also `chatpdf-alternatives-2026.md:29`, `best-ai-pdf-tools-2026.md:199`.

NEW real problems:
- `how-to-chat-with-docx-ai.md:22` and `:124-130` are stale: ChatPDF is no longer “PDF only” and Gemini Notebook is no longer “Google Docs only” per `competitor-facts-2026-09-30.md:10` and `:39`; PDF.ai “In-doc highlight” conflicts with `competitor-facts-2026-09-30.md:27`.
- `best-ai-pdf-tools-2026.md:177` understates AskYourPDF PowerPoint support as unconfirmed/dash, while the research file has PPT/PPTX as search-only supported at `competitor-facts-2026-09-30.md:18`.
- `how-to-chat-with-docx-ai.md:5` still has `updated: "2026-02-18"` even though the FAQ changed at `:144`.

SHIP-WITH-FIXES


