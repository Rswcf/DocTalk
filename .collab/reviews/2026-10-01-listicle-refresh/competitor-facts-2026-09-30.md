# AI Document-Chat Tools: Verified Facts (checked 2026-09-30/10-01)

Method note: facts marked "direct" were fetched/rendered by me (WebFetch or a JS-rendering browser) from the cited URL today. Facts marked "search-only" come from WebSearch result snippets I did not open — treat these as lower confidence per the task's own standard. Prices are USD unless noted.

## 1. ChatPDF (chatpdf.com)
Positioning: no-signup AI chat with a PDF/DOC/PPT/file, "like ChatGPT for PDFs."
- Free (direct, chatpdf.com homepage FAQ): "analyze 2 documents every day." No exact page/MB/question caps stated on the live site.
- Paid: FAQ names a "ChatPDF Plus" plan with "unlimited document analysis" but **states no price**. `chatpdf.com/pricing` returns a live 404 — there is no public pricing page right now.
- The commonly-quoted $19.99/mo, 120 pages, 10MB, 50 q/day figures are **search-only**, though corroborated independently by PDF.ai's own comparison page (pdf.ai/resources/pdfai-vs-chatpdf, direct fetch) citing "$19.99/month," "2 PDFs every day, each up to 120 pages." Other search snippets disagree (3 PDFs/day per one reviewer; $4.99–$5/mo per others) — unresolved, flag as PPP/region variance or stale reviews.
- Formats (direct): PDF, DOC/DOCX, PPT/PPTX, MD, TXT, plus chat-with-website/YouTube.
- Citations (direct): yes — "Cited Sources," clickable citations that "scroll to the exact source," side-by-side view. Uses GPT-4o/GPT-4o-mini dynamic routing, not a fixed model.
- Confidence: medium (core mechanics direct; exact price/limits are search-only, official page silent).

## 2. AskYourPDF (askyourpdf.com)
Positioning: PDF chat + citation/API platform.
- Free (direct, askyourpdf.com/blog/pricing): 1 doc/day, 100 pages/doc, 15MB max, 50 questions/day, 3 conversations/day, GPT-5 Mini only.
- Paid (direct): Premium $11.99/mo (2,500 pages/doc, 50 docs/day, 1,200 q/day); Pro $14.99/mo (6,000 pages/doc, 150 docs/day, 100k q/day); Enterprise custom.
- Formats (search-only): PDF, TXT, PPT/PPTX, EPUB, RTF.
- Citations (search-only): text-based citation engine (APA/MLA/IEEE/Harvard) — not visual highlighting.
- Confidence: high on pricing (direct); medium on formats/citations.

## 3. PDF.ai (pdf.ai)
Positioning: chat-with-PDF + document parsing API.
- **Live pricing (direct, browser-rendered pdf.ai/pricing, 2026-09-30):** Hobby $0 forever (1 upload/mo, 100 questions/mo, 2 OCR pages/file, 10MB); **Pro $17/mo billed monthly or $10/mo billed yearly** (100 uploads/mo, 1,000 q/mo, 10 OCR pages/file, 50MB); **Ultimate $27/user/mo monthly or $20/mo yearly** (unlimited uploads/questions, 50 OCR pages/file, 50MB, "chat with all PDFs"); **Enterprise $37/user/mo monthly or $30/mo yearly** (100 OCR pages/file, 100MB, AI agents, white-label embed).
- This resolves an initial contradiction between third-party aggregators ($17/27/37) and PDF.ai's own comparison article (showing the annual-billed figures $10/20/30) — both were correct, just different billing toggles.
- Formats: PDF-only per third-party analysis (search-only) — no native DOCX/PPTX chat.
- Citations: text references, not visual highlighting (search-only).
- Confidence: high on pricing (direct, live-rendered); medium on formats/citation style.

## 4. Humata (humata.ai)
Positioning: "AI meets your knowledge base" — cited Q&A over uploaded docs.
- **Live pricing (direct, humata.ai/pricing, 2026-09-30):** Free $0 (1 user, 60 free pages/mo); Expert $9.99/mo (3 users, 500 free pages/mo, $0.02/extra page); Team $49/user/mo (10 users, 5,000 free pages/mo, $0.01/extra page, OCR, dept/folder permissions); Enterprise custom.
- Note: current official page has **no "Student $1.99" tier** — several third-party reviews cite one; it appears retired or not shown on this page.
- Citations (direct, humata.ai homepage): "Build trust with cited links into your source files." Page-level visual highlighting not confirmed.
- Confidence: high (fully direct).

## 5. Google NotebookLM → **Gemini Notebook**
- **Confirmed direct:** notebooklm.google 301-redirects to notebook.google; page title is "Gemini Notebook | AI Research Tool & Thinking Partner." Rename date (July 16, 2026) is search-only, not independently confirmed.
- **Confirmed direct (support.google.com/gemininotebook/answer/16213268 and /notebooklm/answer/16215270):** Free/Standard = 100 notebooks/user, 50 sources/notebook; Plus = 200 notebooks, 100 sources; Pro = 500 notebooks, 300 sources; Ultra (20TB) = 500/500; Ultra (30TB) = 500/600. Each source ≤500,000 words or 200MB. Supported sources (direct): Word, TXT, MD, PDF, CSV, PPTX, Google Docs/Slides/Sheets, ePub, audio (MP3/WAV), images, web URLs, public YouTube URLs, Play Books, pasted text, Gemini Chats.
- **Prices for Plus/Pro/Ultra were NOT shown on Google's own limits page** — those numbers ($4.99/$19.99/$99.99–199.99) are search-only. Separately, established press (CNBC, TechCrunch, May 2025 launch) puts **Google AI Ultra at $249.99/mo**, conflicting with lower aggregator figures — unresolved, flag both.
- Confidence: high on rename/redirect/limits/source-types (direct); low-medium on tier pricing (conflicting, none official-page-confirmed).

## 6. Consensus (consensus.app)
Positioning: AI search engine over 220M+ peer-reviewed papers (not general PDF chat).
- **Live pricing (direct, browser-rendered consensus.app/pricing, 2026-09-30):** Free $0/mo — basic paper search, 10 Pro messages/mo, up to 3 Deep reviews/mo. Pro $20/mo or $144/yr (~$12/mo) — unlimited Pro messages, 15 Deep reviews/mo, 500 API/MCP uses/mo. Deep $45/mo or $540/yr — wait, correction: **Deep = $65/mo or $540/yr (~$45/mo annualized)** — 200 Deep reviews/mo, 2,000 API/MCP uses/mo. Student/faculty/clinician discount up to 40%.
- This directly contradicts several aggregator claims of "Study Snapshots" and different free-tier counts — current live plan structure has no "Study Snapshot" language at all.
- Confidence: high (direct, live-rendered).

## 7. Claude (claude.ai)
- **Direct (claude.com/pricing):** Pro $20/mo billed monthly, or $17/mo billed annually ($200 upfront). Free = rolling 5-hour usage window, no fixed message cap stated.
- **Direct (support.claude.com/en/articles/8241126):** Chat uploads up to 500MB/file, 20 files/chat, PDFs up to 1,000 pages (visual analysis only for first 100 pages; 101–1000 text-only). Project files: 30MB/file, unlimited files subject to context window.
- Citations: Claude can quote from uploaded docs conversationally; no dedicated verified-citation card UI (this is my own knowledge, not a fetched claim — flagged as such).
- Confidence: high (direct for pricing/limits).

## 8. ChatDOC (chatdoc.com)
- **Live pricing table (direct, chatdoc.com homepage, 2026-09-30):** Free $0 — 5 files/day (10 total), 20 questions/day (100 total), 300-page limit/file, 60MB max, no OCR, no TapSource, PDF only. Pro **$89.9/360 days** — 300 uploads/30 days, 300 questions/day, unlimited page limit, 200MB max, unlimited OCR/TapSource, formula recognition, file translation; adds DOC/DOCX/SCAN/WEBSITE/EPUB/MD/TXT. A separate official blog page (chatdoc.com/blog/chatdoc-pro-plan) gives the monthly-billed Pro rate as **$8.99/30 days** (list $16.99) — consistent with the annual figure, not contradictory once both are read as different billing cadences.
- Citations (direct): "TapSource™" — click footnotes for context, tap data points to see source, highlight text to view quotes.
- Confidence: high (direct, live).

## 9. ChattyPDF (chattypdf.com)
- Direct fetch of chattypdf.com shows an AI PDF Q&A tool built by **NLMatics** (NYC NLP startup, founded ~2019) tying answers to specific pages, with TOC search, term-linking, table extraction; recommends OCR first for scans.
- **No pricing or free-tier information found anywhere on the official domain.** Third-party sources (Tracxn) describe the company as "unfunded" and the tool as open source. A separate "ChattyPDF AI" iOS app (4.7★/147 ratings) may or may not be the same product — unconfirmed.
- Confidence: low; pricing is **unverified**.

## 10–13. Research-paper tools (one-liners)
- **Elicit** (direct, elicit.com/pricing): Free — unlimited search/138M+ papers, unlimited summaries, limited Research Agent/Reports. Pro $49/user/mo ($588/yr, -35%); Scale $169/user/mo; Enterprise custom. *(Note: this directly-fetched price is notably higher than several search-only aggregator claims of $12–79/mo — trust the direct fetch.)*
- **SciSpace** (direct, browser-rendered scispace.com/pricing): Premium $20/mo or $12/mo annual (1,200 credits); Advanced $90/mo or $70/mo annual; Max tier also exists. No distinct "Free" plan card currently shown on the pricing page itself.
- **Semantic Scholar**: free API, no paid tier; 100 req/5min unauthenticated (search-only, widely consistent).
- **Connected Papers** (direct, browser-rendered connectedpapers.com/pricing): Free — 5 graphs/month. Academic — €4.16/mo billed annually (€49.92/yr). Business — €13.87/mo billed annually (€166.40/yr). Priced in EUR, not USD.

## 14. Smallpdf "Chat with PDF" / Otio
- **Smallpdf** (direct, smallpdf.com/pricing): Chat with PDF is "Limited" on Free (50MB file/25–35k word limit) and unlocked fully on Pro/Team/Business (100k word limit); exact USD price didn't render (geo-priced JS widget) — third-party figures of $12–15/mo are search-only.
- **Otio** (direct, otio.ai/pricing): Free $0 (10 files, 25MB/file, 2 parallel chats); Lite $7/mo ($84/yr); Go $18/mo ($216/yr); Pro $45/mo ($540/yr). All tiers include "every AI model" and Deep Research with page-level citations.

## Roundup pages (who AI engines likely cite)
| URL | Publisher | Date shown | Tools listed |
|---|---|---|---|
| denser.ai/blog/chatpdf-alternative/ | DenserAI | Dec 22 2025, upd. Mar 18 2026 | NotebookLM, Claude, ChatGPT, PDF.ai, **Denser**, Humata, Smallpdf, AskYourPDF |
| eesel.ai/blog/pdf-ai | eesel AI | upd. Jun 17 2026 | **eesel**, Adobe Acrobat AI, ChatGPT, ChatPDF, PDF.ai, Smallpdf, AskYourPDF |
| denser.ai/blog/best-ai-pdf-reader/ | DenserAI | Jul 21 2025, upd. Jun 15 2026 | **Denser**, ChatPDF, AskYourPDF, Smallpdf, PDF.ai, SciSpace, Adobe Acrobat AI |
| wordvice.ai/blog/best-pdf-ai-chatpdf-alternatives | Wordvice AI | no date shown | **Wordvice AI ChatPDF**, PDF.ai, AskYourPDF, ChatDOC, Smallpdf |
| mindgrasp.ai/blog/6-chatpdf-alternatives-in-2026 | Mindgrasp | Jan 9 2026 | **Mindgrasp**, AskYourPDF, Humata, ScholarAI, Quizlet, Chegg, ChatPDF |

Pattern worth noting for the DocTalk posts: every vendor-run roundup ranks its own product #1 — these are marketing content, not neutral comparisons, which matters for how much weight to give them as "third-party" sources.

---
**Key unresolved contradictions to flag before publishing:** (1) ChatPDF has no public price on its own site; (2) Google AI Ultra price ($249.99 per press vs $99–199 per aggregators); (3) NotebookLM→Gemini Notebook paid-tier prices never appeared on Google's own limits page, only on aggregators; (4) ChattyPDF pricing is fully unverified.
