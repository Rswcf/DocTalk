# Vendor evidence: which AI PDF readers cite the page number (collected 2026-10-10)

For the post "Which AI PDF readers cite the page number for every answer? 7 tools compared (2026)". Data only; no post copy.

**Bottom line.** Four candidates state, in their own words, that answers show a page number:
- **ChatDOC**: help guide with the example label "Page 5".
- **Adobe Acrobat AI Assistant**: stated in the PDF Spaces articles. The single-PDF article says highlight and jump only.
- **Sharly**.
- **Otio**: stated on the Zotero-integration page. The general FAQ says "exact page and passage".

 Three more describe page-level citations without saying a number is displayed: **AskYourPDF, ChatPDF, Anara**. **SciSpace** and **Gemini Notebook** document a click that jumps to the source, but no page number. **Humata, PDF.ai, Elicit, Smallpdf, Docalysis, UPDF** document no page number for chat answers.

## Method

- Access date for every URL below: **2026-10-10**.
- Quotes are verbatim, 25 words or fewer. They come from raw HTML (curl, converted to text) or from the rendered page in a browser (`innerText`). I did not use WebFetch summaries as quotes.
- I departed from the brief on one point. adobe.com, helpx.adobe.com and all UPDF hosts return HTTP 403 to curl. Instead of falling back to search-only, I read those public pages in a browser tab. They are marked "direct (browser-read)".
- I did not sign up, log in, upload, submit forms, accept terms or start trials. I clicked only billing toggles and one filter dropdown (Elicit) to read prices. The Gemini Notebook cookie notice was informational; I accepted nothing.
- Evidence types:
  - **direct**: the vendor's own page, read today.
  - **search-only**: a WebSearch snippet I could not open.
  - **secondary**: a third-party page. Never reported as fact.
- Evidence grades (used for the ranking in section 4):
  - **A**: a feature sentence or a help-center procedure that describes the product's behaviour.
  - **B**: a feature heading, a UI mock-up label, or an FAQ answer that sits in the page source.
  - **C**: a vendor blog or SEO article, a dated post, or API docs (the API is not the app).
  - **T**: a customer testimonial on the vendor's own page.
- "Page number" means the answer *shows* a number. "Page-level" means the vendor says the citation points to a page but does not say a number is shown. I kept the two apart on purpose.
- Limit: this is what vendors *document*. I did not test any UI. The post should say "documented" or "the vendor says", not "shows".

---

## 1. Summary table

| Tool | Classification (literal reading) | Strongest quote (≤25 words) | URL | Evidence |
|---|---|---|---|---|
| **ChatDOC** | page number + jump-to-source | "Every AI - generated answer includes page numbers from the original document. Click the page number to jump directly to the corresponding section." | https://chatdoc.com/guide/getting-started/verify-answers/how-to-verify-answers-in-chatdoc-traceable-citations-and-highlighted-jumps/ | direct, A |
| **Adobe Acrobat AI Assistant** | page number (PDF Spaces) + jump-to-source + highlighted passage | "Each citation includes metadata, such as the document title, section, and page number, for easy traceability." | https://helpx.adobe.com/acrobat/desktop/explore-pdf-spaces/view-citations.html | direct, A (browser-read; curl 403) |
| **Sharly AI** | page number + passage shown (jump not stated in plain words) | "Every answer shows the passage it came from, with page numbers for PDFs." | https://www.sharly.ai/cite | direct, A |
| **Otio** | page number + jump-to-source | "Citations include the paper title, author, page number, and the exact passage from the text." | https://otio.ai/integrations/zotero-ai | direct, A |
| **SciSpace** | jump-to-source + highlighted passage; page number **not stated** | "Each answer shows clickable superscripts that jump to the exact page and highlighted sentence in your PDF." | https://scispace.com/chat-pdf | direct, B (FAQ answer in page source) |
| **AskYourPDF** | page-level citation (display of a number implied, not stated) + click to verify | "We return your answer with a citation back to the exact page in the original PDF. Click the citation to verify." | https://askyourpdf.com/chat-with-pdf | direct, A |
| **ChatPDF** | jump-to-source; page-level by a feature heading only | "Pages referenced" / "Instantly jump to the referenced spot with a single click." | https://www.chatpdf.com/pdf-ai | direct, B |
| **Anara** | jump-to-source; "passage, page or figure" (page number not stated) | "Every answer cites the exact passage, page or figure it used, verifiable in one click." | https://anara.com/product | direct, A |
| **Gemini Notebook** (formerly NotebookLM) | jump-to-source (to the quote); **no page number documented** | "To navigate directly to the quote and review it in context, select a citation." | https://support.google.com/notebooklm/answer/16179559?hl=en | direct, A |
| **Humata** | link/reference; "Highlights citations" heading (what is highlighted is not stated); page number only in API docs | "Build trust with cited links into your source files." | https://www.humata.ai/ | direct, B (app); C (API) |
| **PDF.ai** | link/reference only | "Every response is backed by sources extracted from the uploaded document." | https://pdf.ai/ (Chat view) | direct, B |
| **Elicit** | link/reference (sentence-level quotes); no page number documented | "Elicit supports all AI-generated claims with sentence-level citations from the underlying sources." | https://elicit.com/ | direct, A |
| **Smallpdf** (Chat with PDF) | not documented for chat answers (Summarizer page: clickable page references) | "You can even reference specific pages (e.g., "what's on page 12?") to trace answers back to their source." | https://smallpdf.com/chat-pdf | direct, B |
| **Docalysis** | not documented | (no citation sentence on homepage, FAQ or pricing) | https://docalysis.com/faq | direct (negative) |
| **UPDF AI** | not documented | (no citation sentence on 4 vendor pages checked) | https://ai.updf.com/features/chatpdf/ | direct (negative; browser-read; curl 403) |

Note on the Smallpdf quote: it describes the *user* naming a page in the question. It does not say the answer shows a page.

---

## 2. Per tool

### 2.1 ChatDOC (chatdoc.com, "TapSource")

**Classification:** page number + jump-to-source. The guide gives an example label ("Page 5"). In-document highlighting is not stated in plain words. The homepage says "Highlight Text, View Quotes", and the guide's "highlighted" features refer to text in the *answer*.

Evidence (all direct):
- "Page Number Citations: Every AI - generated answer includes page numbers from the original document." (grade A). Source: https://chatdoc.com/guide/getting-started/verify-answers/how-to-verify-answers-in-chatdoc-traceable-citations-and-highlighted-jumps/
- "In ChatDOC's answer, locate the cited page number (e.g., "Page 5")." (same URL, A)
- "Click the page number to jump directly to the relevant section in the document." (same URL, A)
- "Reference Citations: Each answer includes reference sources. Click the reference to trace back to the specific content snippet in the document." (same URL, A)
- "Highlighted Numerical Values: Numerical values in answers are highlighted. Click them to trace back to the original data in the document." (same URL, A)
- "Yes, all traceability methods work seamlessly across multiple documents." (same URL, FAQ, A)
- "Click Footnotes, Reveal Context" / "Tap Data, Meet Truth" / "Highlight Text, View Quotes" (TapSource headings). Source: https://chatdoc.com/ (B)
- Pricing table, Free column, rendered: the TapSource row shows a checkmark icon (SVG path `M1.25 7.26425L8.20578 14.75L20.75 1.25`), not "-". So **TapSource is listed as included on Free**. Source: https://chatdoc.com/ (direct, read from the DOM)

Free tier. The vendor contradicts itself:
- Homepage pricing table (rendered): "5/day, 10 in total" files; "20/day, 100 in total" questions; "300" pages per file; "60 MB"; "PDF". Source: https://chatdoc.com/
- Homepage, next to the upload box: "100 Questions Free · No Card Needed · Cancel Anytime". Source: https://chatdoc.com/
- Guide: "Upload up to 2 files every 24 hours." / "Each file limited to 20 pages." Source: https://chatdoc.com/guide/getting-started/chatdoc-paid-membership-plan/
- FAQ: "upload up to 2 files per 24hrs and 10 files in total with a limit of 20 pages per file at most". Source: https://chatdoc.com/blog/chatdoc-faqs/

Entry price:
- "Auto-renewal price: $8.99 for 30 days. Original price: $16.99 for 30 days." Source: https://chatdoc.com/blog/chatdoc-faqs/
- Homepage table: "$89.9" "/360 days". Source: https://chatdoc.com/
- The 30-day toggle did not change the rendered table. `chatdoc.com/pricing` returns 404 today.

Formats: Free = "PDF". Pro = "PDF, DOC, DOCX, SCAN, WEBSITE, EPUB, MD, TXT". Source: https://chatdoc.com/ (pricing table)

Gaps:
- Whether the cited passage is highlighted inside the document viewer is not stated.
- The FAQ also says: "PS. Asking questions about "Page N" of the PDF is not supported." (https://chatdoc.com/blog/chatdoc-faqs/). This is about questions, not citations.

### 2.2 Adobe Acrobat AI Assistant

**Classification:** page number + jump-to-source + highlighted passage.
- Scope caveat: the page-number sentence is in the **PDF Spaces** articles (multi-file workspace, desktop and mobile).
- The single-PDF AI Assistant article documents highlight and jump, but does not mention a page number.

Evidence:
- "Each citation includes metadata, such as the document title, section, and page number, for easy traceability." (A; page "Last updated on Nov 26, 2025"). Source: https://helpx.adobe.com/acrobat/desktop/explore-pdf-spaces/view-citations.html
- "Multi-citation links open a list of references and take you directly to the cited section, with the file name and page highlighted." (same URL, A)
- Same page-number sentence on mobile (A; "Last updated on Aug 18, 2026"). Source: https://helpx.adobe.com/acrobat/mobile/pdf-spaces/view-citations.html (redirected from /acrobat/using/view-citations-on-mobile.html)
- "AI Assistant highlights where it found the answer in the document and suggests follow-up questions." (A; "Last updated on Aug 7, 2026"). Source: https://helpx.adobe.com/acrobat/desktop/use-acrobat-ai/generative-ai-features/ai-get-answers.html
- "Select a source number to jump to the relevant section of the document." (same URL, A)
- "Get clear overviews of your files with precise citations that link right to the source in your docs." (B). Source: https://www.adobe.com/acrobat/generative-ai-pdf.html
- Access note: curl gets HTTP 403 on adobe.com and helpx.adobe.com. All of the above were read in a browser tab (direct).
- search-only (WebSearch summary, not opened): an Adobe online-tool page says selecting a numbered link "instantly highlights the related source content".

Free tier: no free AI.
- "Acrobat Reader / Open and view PDFs with Acrobat Reader. Free. Always." Source: https://www.adobe.com/acrobat/plans.html
- Acrobat Studio "Includes everything in Acrobat Pro, plus AI Assistant." (same URL)
- The 09-22 audit quoted the FAQ line "AI features requires a paid subscription". I did not re-read that FAQ today.

Entry price. Geo-priced in EUR for this browser; USD not obtained:
- "Acrobat Express / 11,98 €/mo incl. VAT", annual billed monthly, with "Get AI summaries, insights, and answers". This tier is **new since the 09-22 audit**. Source: https://www.adobe.com/acrobat/generative-ai-pdf.html
- Acrobat Studio "29,99 €/mo incl. VAT". Source: https://www.adobe.com/acrobat/plans.html
- Add-on: "Add AI Assistant to your Acrobat plan for 1,99 €/mo incl." (text cut at "incl."). Source: https://www.adobe.com/acrobat/plans.html

Formats: search-only. Adobe's PDF Spaces "supported formats" help page reportedly lists PDF, DOCX, PPTX, XLSX, TXT, RTF, VTT (https://helpx.adobe.com/acrobat/desktop/explore-pdf-spaces/supported-formats-limitations.html). Not opened.

### 2.3 Sharly AI (sharly.ai)

**Classification:** page number + passage shown. Jump-to-source is suggested by "Cite & Navigate" and "Hover, click, and verify", but not stated as a jump.

Evidence (direct):
- "Every answer shows the passage it came from, with page numbers for PDFs. Verification is part of the method." (A). Source: https://www.sharly.ai/cite
- Suggested methods text the vendor gives researchers: "...answers from passages retrieved from the uploaded documents and shows the source excerpt and page." (A, same URL)
- Homepage UI mock-up labels: "Statistical Analysis Plan / Page 12", "Clinical Trial Report – Phase III / Page 24" (B). Source: https://www.sharly.ai/
- "Every insight is backed by verifiable sources—APA, MLA, and Chicago formats. Hover, click, and verify." (A). Source: https://www.sharly.ai/
- "Inline citations / Every insight links back to its exact source for proof." (B). Source: https://www.sharly.ai/product

Free tier:
- "5 docs/day" (card). The comparison table says "Documents / month 10" and "Messages / mo 50".
- "Inline citations" row: Free = "Limited". Source: https://www.sharly.ai/pricing

Entry price: Pro "$12.5/month billed yearly". The monthly-billed price is not shown. Source: https://www.sharly.ai/pricing

Formats: "Drop in PDF, DOCX,PPTX, Notion Exports - Sharly handles it all". Source: https://www.sharly.ai/pricing

Gaps: "Limited" inline citations on Free is not explained.

### 2.4 Otio (otio.ai)

**Classification:** page number + jump-to-source. The explicit "page number" sentence is on the Zotero-integration page. The general FAQ says "exact page and passage". Highlighting is not stated.

Evidence (direct):
- "Citations include the paper title, author, page number, and the exact passage from the text." (A). Source: https://otio.ai/integrations/zotero-ai
- "Every answer cites the exact source, whether it's a page number from a PDF or a timestamp from a video." (A, same URL)
- "Click any citation to jump to the exact passage in the source document." (A, same URL)
- FAQ answer (FAQ schema in page source): "Every answer Otio generates includes a citation to the exact page and passage in your uploaded source." (B). Source: https://otio.ai/
- Same FAQ: "Click the citation, and Otio jumps you straight to the source text so you can verify before you use it." (B, https://otio.ai/)
- "Every answer cites the exact page and passage. Check it in one click." (A, https://otio.ai/)
- "Deep Research and page-level citations included." (A). Source: https://otio.ai/pricing

Free tier: "Limited monthly AI usage" / "Upload up to 10 files · 25MB per file · 50MB total" / "Basic PDF viewer". Source: https://otio.ai/pricing

Entry price: Lite "$7/mo", "$84/yr · Billed annually". The toggle reads "Yearly (Save 50%)". Clicking "Monthly" did not change the rendered figures, so the monthly-billed price is not shown. Source: https://otio.ai/pricing

Formats: "PDFs, articles, videos, and transcripts"; "Create visualisations from your CSVs". Source: https://otio.ai/

Gaps:
- Rendering bug: the Free card shows "£540/yr · Billed annually".
- No help-center article on citations was found.

### 2.5 SciSpace (scispace.com/chat-pdf)

**Classification:** jump-to-source + highlighted passage. The jump is page-accurate, but the vendor says the markers are "superscripts". It does not say a page number is shown. Count it as **no documented page number**.

Evidence (direct; FAQ answers from the page's embedded JSON, `faq-answer-15` and `faq-answer-11`):
- "Each answer shows clickable superscripts that jump to the exact page and highlighted sentence in your PDF." (B). Source: https://scispace.com/chat-pdf
- "...can cite pay-walled PDFs you upload, linking directly to the exact page and sentence for verification." (B, same URL)
- "Get answers backed by citations from specific sections of the PDF" (B, same URL)
- "...ensures transparency and credibility by providing references to the original document sources for each response." (B, same URL, `faq-answer-2`)

Free tier: none published in numbers.
- The chat page says "free tier" with no quantity.
- The pricing page has no Free card (Premium/Advanced/Max only). Source: https://scispace.com/pricing

Entry price: Premium "$20 /month" monthly; "$12 /month billed annually".
- Banner: "Flash sale till 10 October 2026. Extra 30% discount on all Yearly plans" (expires on the access date).
- "1,200 monthly credits"; "Unlimited Chat with PDF". Source: https://scispace.com/pricing (rendered at 1440 px width)

Formats: "Currently {scispace} Chat PDF supports only PDF documents. We plan to support PPT, Docx and video uploads in the near future." (https://scispace.com/chat-pdf, `faq-answer-3`)

### 2.6 AskYourPDF (askyourpdf.com)

**Classification:**
- Page-level citation plus a clickable citation, stated directly.
- The page never literally says a number is printed in the answer.
- An older plugin-era blog does say "page numbers". Read it as "page number, likely; not literal".

Evidence (direct):
- "We return your answer with a citation back to the exact page in the original PDF. Click the citation to verify." (A). Source: https://askyourpdf.com/chat-with-pdf
- "Cited answers tied to source page" (B, same URL)
- "...with citations linking every answer back to the exact page." (A, same URL)
- "Pull every clause, scope a question to one section, and get a citation back to the exact page." (A, same URL)
- Blog (C; ChatGPT-plugin era, undated in page): "...click on the "More sources" button to see the page numbers or URLs from which the answer was extracted." Source: https://askyourpdf.com/blog/how-to-query-your-document-on-askyourpdf
- API docs (C): the response schema includes `"page_number": 1`, and "cite_source (boolean, optional) : Flag for cite_source. Default if false". Source: https://docs.askyourpdf.com/askyourpdf-docs
- Positioning change: the homepage now leads with a website chatbot product ("40+ Free AI Tools"). The PDF chat lives at /chat-with-pdf. Source: https://askyourpdf.com/

Free tier: "1 documents per day"; "100 pages per document"; "Max upload size: 15MB"; "50 questions per day". Source: https://askyourpdf.com/pricing

Entry price: Premium "$11.99 per month billed yearly". The monthly-billed price is not shown. The chat page also offers "unlock the full stack for $1 with the Premium trial". Sources: https://askyourpdf.com/pricing, https://askyourpdf.com/chat-with-pdf

Formats: "Drag a PDF, DOCX, EPUB, or TXT file into the AskYourPDF chat reader, or paste a URL." Source: https://askyourpdf.com/chat-with-pdf

Integrations: "Web, iOS, Android, Chrome extension, ChatGPT GPT, and the Zotero plugin". Source: https://askyourpdf.com/chat-with-pdf

**Addendum 2026-10-14:** this section read only `/chat-with-pdf` and the static pricing HTML. AskYourPDF's `/pdf-ai` and `/chat-with-documents` pages also list PPTX, RTF and CSV and say the source is highlighted, and the pricing page has a monthly-billed price (Premium $14.99, Pro $19.99). So "The monthly-billed price is not shown" above and §3's "PPT/PPTX appear only for the homepage *website chatbot* product" are wrong as of 2026-10-14. Evidence: `.collab/reviews/2026-10-14-notebooklm-askyourpdf/evidence.md`.

### 2.7 ChatPDF (chatpdf.com)

**Classification:**
- Jump-to-source: direct.
- Page-level: only a feature heading ("Pages referenced") on the PDF AI page.
- Explicit "page numbers" appear only for the separate PDF Summary tool.
- Literal reading: page reference by heading; number display not stated for chat.

Evidence (direct):
- "...clickable citations instantly scroll to the exact source in your PDF." (A). Source: https://www.chatpdf.com/
- "Cited Sources / Built-in citations anchor responses to PDF references. No more page-by-page searching." (B, https://www.chatpdf.com/)
- "Pages referenced" / "Instantly jump to the referenced spot with a single click." (B, feature card). Source: https://www.chatpdf.com/pdf-ai
- "Questions are answered by PDF AIwith references to the original PDF." (typo as published) (A, https://www.chatpdf.com/pdf-ai)
- PDF Summary tool, not chat: "Yes, page numbers are included for easy reference. You can click on a reference to instantly navigate to that part in the PDF." (A). Source: https://www.chatpdf.com/pdf-summary

Free tier: "We offer a free plan that lets you analyze 2 documents every day." No account is needed. Source: https://www.chatpdf.com/ (FAQ)

Entry price: **not published**. `chatpdf.com/pricing` and `/plus` return 404 today. The FAQ names "ChatPDF Plus" with no price.

Formats: "PDF (.pdf), Word (.doc, .docx), PowerPoint (.ppt, .pptx), Markdown (.md), and Text files (.txt)". Source: https://www.chatpdf.com/ (FAQ)

### 2.8 Anara (anara.com, formerly Unriddle)

**Classification:** jump-to-source (direct). It cites the "passage, page or figure" without saying a page number is shown, so count it as no documented page number. Highlighting appears only in a testimonial.

Evidence:
- "Every answer cites the exact passage, page or figure it used, verifiable in one click." (A). Source: https://anara.com/product
- "Every answer Anara gives you is backed by inline citations that link directly to the exact passage in your documents." (A). Source: https://support.anara.com/en/articles/14473005-what-is-anara
- "Click any citation to jump straight to the source." (A, same URL)
- "Ask one paper, a folder or your whole library. Every answer links to the exact passage, so you can check it in one click." (A). Source: https://anara.com/
- Excluded: "Passage-level citations / Cites the exact passage wherever open-access full text is available." This card belongs to the **search API**, not to chat with uploaded files (https://anara.com/).
- Testimonial (T, on the vendor page, not a feature claim): "...Anara shows you exactly where it found the information by highlighting it in the paper." Source: https://anara.com/

Free tier: "Limited AI usage and uploads"; "20MB or 120 pages per upload". The FAQ says: "On Free it refreshes daily". Source: https://anara.com/pricing

Entry price: "Plus is $10 ... per seat per month. Billed yearly, they are $8..." (FAQ). The card shows "$10 / month / seat, billed yearly", which conflicts with the FAQ. No student discount. Source: https://anara.com/pricing

Formats: PDFs, Zotero/Mendeley import, DOI/URL, web clips (help center), plus "PDFs, webpages and YouTube videos" and spreadsheets (product page). Sources: https://support.anara.com/en/articles/14473005-what-is-anara, https://anara.com/product

### 2.9 Gemini Notebook (formerly NotebookLM; notebook.google)

**Classification:** jump-to-source (to the quote, in context). The full quote shows on hover. **No page number is documented.** Citations can be missing on short sources.

Evidence (direct; support.google.com URLs redirect to /gemininotebook/ paths):
- "Gemini Notebook uses direct quotes, text, and images from your sources as citations. These citations help you check response accuracy." (A). Source: https://support.google.com/notebooklm/answer/16179559?hl=en
- "To get the full quoted text, hover over any citation." (A, same URL)
- "To navigate directly to the quote and review it in context, select a citation." (A, same URL)
- "If your source content is too short, Gemini Notebook references the entire document without a cited individual text from your source." (A). Source: https://support.google.com/gemininotebook/answer/16269187?hl=en
- Homepage: "The responses you get will always be grounded in the information you provide." Source: https://notebook.google/
- Rename confirmed: the homepage FAQ asks "Is Gemini Notebook the same product as NotebookLM?"

Free tier (Standard): "100/user" notebooks and "50/notebook" sources, under "Usage Limits (Subject to Change)". Source: https://support.google.com/gemininotebook/answer/16213268?hl=en
- "Each source can contain up to 500,000 words or up to 200MB for uploaded files." Source: https://support.google.com/gemininotebook/answer/16215270?hl=en
- Change since 09-22: today's limits table **no longer lists the "50/day" chats row** that the 09-22 audit quoted.

Entry price: not shown on Google's Gemini Notebook pages. The 09-22 audit read EUR Google AI plan prices on one.google.com; not re-read today.

Formats: "Microsoft Word (docx), Text (txt), Markdown (md), PDF files (pdf), CSV (csv), and PowerPoint (pptx) files"; "ePub files". Source: https://support.google.com/gemininotebook/answer/16215270?hl=en

### 2.10 Humata (humata.ai)

**Classification:**
- Link/reference ("cited links into your source files").
- "Highlights citations" is a feature heading, but the page does not say what is highlighted or where.
- A page number appears only in an **API** docs example, and the docs say the format "is subject to change".
- For the app: no documented page number.

Evidence:
- "Highlights citations" (heading) / "Build trust with cited links into your source files." (B). Source: https://www.humata.ai/
- "Each answer Humata generates will cite relevant sections from your uploaded documents." (A, https://www.humata.ai/)
- API docs (C): "References - [3]: Page 10 of History of the United States.pdf" and "The format of references is subject to change." Source: https://docs.humata.ai/guides/humata-api/how-to-ask
- Official blog (C; dated 2023-10-13): "Humata provides instant, AI-powered answers for any PDF, citing and highlighting answers derived from your documents." Source: https://www.humata.ai/blog/how-to-use-ai-for-legal-documents
- "Grounded - Humata strictly cites your documentation for precise answers." (A). Source: https://docs.humata.ai/guides/readme/chat-settings
- Checked with no citation detail: the docs pages how-to-upload, how-to-ask-all, getting-started and llms.txt.

Free tier: "Basic features for up to 60 free pages of use." / "Free pages (monthly)" row = "60". The homepage also says "Up to 10 answers" with no period. Sources: https://www.humata.ai/pricing, https://www.humata.ai/

Entry price: Expert "$9.99 / month" (3 users). Source: https://www.humata.ai/pricing

Formats: not stated on the homepage, pricing page or docs pages checked.

### 2.11 PDF.ai (pdf.ai)

**Classification:** link/reference only, on product pages. One vendor SEO article makes a hedged page claim ("often"). Count it as no documented page number.

Evidence:
- "Sources included / Every response is backed by sources extracted from the uploaded document." (B). Source: https://pdf.ai/ (Chat toggle; the homepage now defaults to the API product)
- FAQ: "...give you a well-informed answer (with cited sources)." (A). Source: https://pdf.ai/faq
- Vendor resource article (C, undated): "...often with citations pointing right to the page where it found the information." Source: https://pdf.ai/resources/taking-notes-on-pdf
- Vendor resource article (C): it advises users to ask for page references in prompts, e.g. "List the key conclusions from pages 12 to 18 with page citations." Source: https://pdf.ai/resources/report-on-pdf. This implies page references depend on the prompt, not that they are shown by default.
- Checked with nothing on citations: https://pdf.ai/compare/chatpdf-alternative

Free tier:
- FAQ: "Yes, you can upload 1 PDF file (max 10MB) to try it out for free."
- Pricing table: "Monthly upload limit" = 1; "Monthly questions limit" = 100; "Max file size" 10MB.
- The row label now says *Monthly*. The 09-22 audit read it as "PDF upload limit" with no period. Sources: https://pdf.ai/faq, https://pdf.ai/pricing

Entry price: Pro "$17 /mo Billed monthly"; "$10 /mo Billed yearly". Source: https://pdf.ai/pricing (both toggles rendered)

Formats: "You can only upload PDF (.pdf) files at the moment." Source: https://pdf.ai/faq

### 2.12 Elicit (chat with papers)

**Classification:** link/reference (sentence-level quotes). No page number is documented. Elicit is a research-search product, not a PDF reader. Weak fit for the post.

Evidence (direct):
- "Elicit supports all AI-generated claims with sentence-level citations from the underlying sources." (A). Source: https://elicit.com/
- Free tier list: "Unlimited chat with papers with full-text access" / "View sources for answers". Source: https://elicit.com/pricing
- search-only: the changelog (https://support.elicit.com/en/articles/14823097-changelog) reportedly says the Research Agent "answers with citations back to the source material". Fetched, but not quoted.

Free tier: Basic: "Unlimited search across more than 138 million papers"; "Unlimited chat with papers with full-text access"; "Limited usage for Research Agent and Research Reports". Source: https://elicit.com/pricing

Entry price: unresolved.
- Rendered default: Pro "$49 / Per user/month, billed as $588 annually".
- The page's static HTML also holds a variant with "Plus / $11 / Per user/month, billed as $132 annually". This is probably the "Academic" option of a filter whose aria-label is "Filter by industry or Academic".
- Choosing "Academic" changed the label, but innerText still read $49.
- Source: https://elicit.com/pricing

Formats: uploaded papers (Pro lists "Custom extractions from uploaded papers"); no format list found.

### 2.13 Smallpdf (Chat with PDF / AI PDF)

**Classification:** not documented for Chat with PDF answers. The Summarizer page claims "clickable page references" for its AI chat refinement. That is a different tool page, so read it as ambiguous.

Evidence (direct):
- "You can even reference specific pages (e.g., "what's on page 12?") to trace answers back to their source." (B). This is the user naming a page. Source: https://smallpdf.com/chat-pdf
- "Refine summaries with AI chat and get clickable page references for quick access to source material." (A, Summarizer). Source: https://smallpdf.com/pdf-summarizer
- Blog (C, dated 2023-10-09 in page data): "...you can ask questions, jump to relevant sections, and export what matters." Source: https://smallpdf.com/blog/use-ai-review-pdf-files
- search-only, not found on the page: a WebSearch summary attributed "the AI lists the pages in your PDF where it got the answer" to a Smallpdf post. That URL (/blog/ai-pdf-readers-a-new-way-to-interact-with-pdfs) now redirects to /ai-pdf, and the sentence is not there. Do not use it.

Free tier:
- "You can start using Chat With PDF for free without creating an account, although usage limits apply." Source: https://smallpdf.com/chat-pdf
- Pricing table: Chat with PDF "Limited"; "AI-tool file size limit" 50 MB; "AI-tool document word limit" "25–35k". Source: https://smallpdf.com/pricing

Entry price: **not rendered**. Prices show as "..." even after 5 s at 1440 px; the 09-30 audit saw the same.
- search-only: Smallpdf pages reportedly list Pro at about $9/mo yearly or $12/mo monthly.
- The 2026-08-03 Smallpdf blog https://smallpdf.com/blog/smallpdf-free-vs-pro-plan-comparison contains no dollar figure in its HTML.

Formats: Chat with PDF covers PDFs. No other format is stated for chat.

### 2.14 Docalysis (docalysis.com)

**Classification:** not documented. There is no citation, source or page-reference sentence on the homepage, FAQ or pricing page.

Free tier: "5 MB file size limit"; "600 page upload / month"; "150 page limit / file"; "50 question credit / month". Source: https://docalysis.com/pricing

Entry price: Plus "$14/mo" ("0% off $14/mo, paid annually"). Source: https://docalysis.com/pricing

Formats: "Docalysis supports PDFs, TXTs, CSV, and DOCX files." Source: https://docalysis.com/faq

Pages checked: https://docalysis.com/, https://docalysis.com/faq, https://docalysis.com/pricing

### 2.15 UPDF AI (updf.com / ai.updf.com)

**Classification:** not documented. curl gets HTTP 403 on all UPDF hosts, so I read the pages in a browser. None of the four pages mentions citations, sources or pages in answers. The page-related features are summarize or translate *by page range*, which is user input, not answer attribution.

Pages checked:
- https://updf.com/updf-ai/
- https://ai.updf.com/features/chatpdf/
- https://updf.com/updf-ai-user-guide/chat-with-updf-ai/
- https://updf.com/updf-ai-user-guide/introduction/

Free tier: "PDF Uploads 5"; "PDF Size 10MB/PDF"; "PDF Page 100/PDF"; "Questions 100". The FAQ adds: "the total free uploads allowed are five". Source: https://updf.com/updf-ai/

Entry price: "US$29.00/ Quarter". Yearly options are also shown: US$49.99, US$79.00, US$99.00 per year. Source: https://updf.com/updf-ai/

Formats: "Supported file types: PDF". Source: https://ai.updf.com/features/chatpdf/

---

## 3. Contradictions with current site copy

Files are under `frontend/content/blog/`. I edited nothing. "Upgrade" means the site's fact is still right but its source label is out of date.

**best-ai-pdf-tools-2026.md** (updated 2026-10-10)

| Line | Site says | Vendor says today | Type |
|---|---|---|---|
| 83, 85, 88 | AskYourPDF Chrome extension and Zotero "per third-party reviews" | "Web, iOS, Android, Chrome extension, ChatGPT GPT, and the Zotero plugin" (askyourpdf.com/chat-with-pdf) | Upgrade to vendor-sourced |
| 96 | AskYourPDF: "references are page-level text citations rather than highlighted passages (per third-party reviews)" | "a citation back to the exact page in the original PDF. Click the citation to verify." | Source label wrong. The click-through is not credited. |
| 133 | Humata: "we could not confirm passage-level highlighting" | Homepage heading "Highlights citations"; 2023 blog "citing and highlighting answers" | Soften. The vendor claims highlighting but not what or where. |
| 150 | PDF.ai: "third-party reviews report no native Word or PowerPoint chat" | "You can only upload PDF (.pdf) files at the moment." (pdf.ai/faq) | Upgrade |
| 176 | AskYourPDF Word "—¹" | "Drag a PDF, DOCX, EPUB, or TXT file..." | **Contradiction**: Word = Yes |
| 177 | AskYourPDF PowerPoint "Yes¹" | The chat page lists no PPT/PPTX. PPT/PPTX appear only for the homepage *website chatbot* product. | **Unsupported** for PDF chat |
| 176–177 | PDF.ai Word/PowerPoint "No¹" | PDF-only per vendor FAQ | Upgrade (drop ¹) |
| 179 | AskYourPDF Web URL "—" | "...or paste a URL." | **Contradiction**: URL = Yes |
| 180 | AskYourPDF "Page reference¹" | Vendor-direct | Upgrade (drop ¹) |
| 180 | Gemini Notebook "Inline citation" | "To navigate directly to the quote and review it in context, select a citation." | Incomplete: jump-to-source is not credited |
| 180 | ChatDOC "TapSource" | Guide: "Every AI - generated answer includes page numbers..." and "Click the page number to jump" | Incomplete: page number + jump not stated |
| 180 | Humata "Link to file" | "Highlights citations" heading | Partial, as for line 133 |
| 163, 181 | ChatDOC Free "5 files a day (10 in total)... up to 300 pages and 60 MB" | Matches today's homepage table. ChatDOC's own guide and FAQ say "2 files every 24 hours" and "20 pages". | **Vendor contradicts itself.** Cite the homepage table and date it. |
| 201 | "ChatDOC links individual data points" | The guide documents page-number citations with jump | Incomplete |

**chatpdf-alternatives-2026.md** (updated 2026-10-10)

| Line | Site says | Vendor says today | Type |
|---|---|---|---|
| 67, 69, 72 | AskYourPDF Zotero/Chrome "per third-party reviews" | Vendor-direct, as above | Upgrade |
| 78 | AskYourPDF "page-level text citations rather than highlighted passages (per third-party reviews)" | "citation back to the exact page... Click the citation to verify." | Source label wrong; click not credited |
| 97 | PDF.ai "third-party reviews report no native Word or PowerPoint chat" | PDF-only per vendor FAQ | Upgrade |
| 98 | PDF.ai "References are text-based rather than highlighted passages (per third-party reviews)" | "Sources included / Every response is backed by sources..." | Consistent; upgrade the label |
| 111, 117 | Humata "Citations link to the file; we could not confirm passage-level highlighting" | "Highlights citations" | Soften, as above |
| 132, 199 | Gemini Notebook "Inline citations grounded in your sources" / "Inline source citations" | Selecting a citation navigates to the quote in context | Incomplete |
| 196 | AskYourPDF reads "PDF-first"; checks via "Page-level text references" | PDF, DOCX, EPUB, TXT, URL; click citation to verify | **Contradiction** on formats; incomplete on checking |

**citation-highlighting-matters.md** (updated 2026-03-18; the oldest file and the most wrong)

| Line | Site says | Vendor says today | Type |
|---|---|---|---|
| 121 | ChatPDF: "Page reference / Manual page scan needed / Partial — page only" | "clickable citations instantly scroll to the exact source in your PDF" | **Contradiction** |
| 122 | AskYourPDF: "Page reference / Manual page scan needed" | "Click the citation to verify." | Partial contradiction (the vendor implies click-through) |
| 123 | PDF.ai: "In-document highlight / Low / Yes — but limited to PDF" | No vendor page claims highlighting. The vendor says only "Sources included" / "with cited sources". | **Contradiction**. It also contradicts best-ai-pdf-tools-2026.md:180 ("Text reference¹"). |
| 124 | NotebookLM: "Inline source quote / ... / No navigation to source" | "To navigate directly to the quote and review it in context, select a citation." The product is now named Gemini Notebook. | **Contradiction** + outdated name |
| 166 | "Most tools provide page references at best. Click-to-navigate highlighting ... is less common." | Click-to-navigate is documented by ChatPDF, ChatDOC, Adobe, SciSpace, Otio, Anara and Gemini Notebook. In-document highlighting is documented by Adobe and SciSpace. | **Contradiction** with the general claim |

---

## 4. Ranking for the post, and the honest negatives

### 4.1 The 6 non-DocTalk tools with the strongest documented evidence

The ranking follows evidence grade and clarity, not product quality. A clear documented "no page number" counts as strong evidence too.

| Rank | Tool | Page number documented? | Why it ranks here |
|---|---|---|---|
| 1 | **ChatDOC** | **Yes**, with an example label "Page 5" | A help-center procedure: locate the page number, click it, jump. The most explicit page-number evidence of all 15. |
| 2 | **Adobe Acrobat AI Assistant** | **Yes** (PDF Spaces) | Three dated helpx articles (2025-11 to 2026-08): page number in the citation metadata, jump to section, highlight in the document. Caveat: the page-number sentence is scoped to PDF Spaces; the single-PDF article says highlight + jump only. Paid-only. |
| 3 | **Gemini Notebook** | **No** | A Google help-center procedure: hover for the quote, select to navigate to it. No page number anywhere. The best-known tool, with a clean, documented negative. |
| 4 | **SciSpace** | **No** (jump goes to "the exact page", but the markers are "superscripts") | One explicit sentence covers jump + page + highlighted sentence. Strong on jump and highlight. The honest reading is "no page number shown". |
| 5 | **Otio** | **Yes** | An explicit "page number" sentence plus an FAQ jump sentence. Caveat: the page-number sentence sits on the Zotero-integration page. |
| 6 | **Sharly AI** | **Yes** | Explicit "with page numbers for PDFs" plus UI mock-up labels "Page 12/24". Caveats: inline citations are "Limited" on Free; jump is implied, not stated. |

Alternates, if the post needs the better-known names:
- **AskYourPDF**: page-level, stated directly, plus click to verify. A literal number is shown only in an old plugin blog. It is strong enough to call "page-level citations".
- **ChatPDF**: jump stated directly; page-level only through the heading "Pages referenced".

Swapping them in for Otio and Sharly lowers the count of strict "page number" tools and raises the count of borderline ones.

### 4.2 Effect on the headline "N of 7 show a page number"

Count of the six non-DocTalk tools, by literal vendor wording. I did not assess DocTalk.

- **Evidence-ranked lineup** (ChatDOC, Adobe, Gemini Notebook, SciSpace, Otio, Sharly): **4 of 6** document a page number. Gemini Notebook and SciSpace do not.
- **Recognition lineup** (ChatPDF, AskYourPDF, ChatDOC, Adobe, Gemini Notebook, SciSpace):
  - **2 of 6** strictly document a number (ChatDOC, Adobe).
  - **2** document page-level citations without saying a number is shown (AskYourPDF, ChatPDF).
  - **2** document none (Gemini Notebook, SciSpace).

If the post uses this lineup, it needs a third bucket ("points to the page, number not confirmed").

### 4.3 Tools with NO documented page number in chat answers

- **Gemini Notebook**: jump to quote, hover for quote. No page.
- **SciSpace**: jumps to the exact page and highlights the sentence, but the markers are "superscripts". No page number stated.
- **Anara**: "passage, page or figure"; jump to the passage. No page number stated.
- **Humata**: "cited links into your source files"; "Highlights citations". A page appears only in API docs ("subject to change").
- **PDF.ai**: "Sources included". One hedged blog line ("often ... pointing right to the page").
- **Elicit**: sentence-level citations / "View sources for answers".
- **Smallpdf Chat with PDF**: nothing for chat answers. The Summarizer claims "clickable page references".
- **Docalysis**: nothing.
- **UPDF AI**: nothing.

Borderline: **ChatPDF**, by the heading only; explicit page numbers appear only in its Summary tool.

### 4.4 Gaps worth closing before publishing

1. **USD prices:** Adobe showed EUR (geo-priced), and Smallpdf did not render. Both need a US-located check.
2. **Elicit entry price:** $11 (Academic Plus, static HTML) vs $49 (rendered Pro). Unresolved.
3. **ChatDOC free tier:** the vendor contradicts itself (homepage 5/day, 300 pages vs guide and FAQ 2/24h, 20 pages). Quote the homepage table and say so.
4. **No product testing:** everything above is documentation. The post should say "documented" or "the vendor says", or the owner should test with a sample PDF.
