# Competitor facts fix list (2026-10-10)

Branch `content/competitor-facts-2026-10`, based on `origin/main` c29c1ab8. Not pushed, not deployed.

## Rules applied

- A competitor claim stays only if one of the three evidence files supports it. Otherwise it is corrected from the evidence, or removed, or neutralised.
- No unverified negative claim about a competitor stays. A table dash reads as "no", so a dash without evidence becomes "Not verified".
- NotebookLM is now Gemini Notebook. Pages keep the NotebookLM name where it is the subject or slug, and state the rename once.
- DocTalk claims match the product: Free 300 credits/month (+500 at signup), Plus $9.99, Pro $19.99, 7 formats, highlighted citations. Where a correction removes a DocTalk advantage, the copy says so.
- No `*.metaTitle` key changed. No blog file changed. Headings changed only where they state a false fact (one: `altsHumata.alt2Title`).

## Evidence files

- **VE** = `.collab/reviews/2026-10-10-step5-page-citations/vendor-evidence.md` (on branch `content/step5-page-citations`, not on main)
- **CF** = `.collab/reviews/2026-10-01-listicle-refresh/competitor-facts-2026-09-30.md` (direct facts only)
- **PR** = `.collab/reviews/2026-09-22-pricing-research/10-competitors-en.md` (vendor quotes only)
- **DT** = `CLAUDE.md` and `.claude/rules/frontend.md` (DocTalk product facts)

Section numbers (for example `VE §2.7`) point to the section of that file. Quotes are copied from the file.

## Count of changed keys per namespace (EN; every key is changed in all 11 locales)

| Namespace | Keys changed |
|---|---|
| `compareChatpdf` | 31 |
| `compareNotebooklm` | 32 |
| `comparePdfai` | 26 |
| `compareAskyourpdf` | 21 |
| `compareHumata` | 22 |
| `altsChatpdf` | 27 |
| `altsNotebooklm` | 23 |
| `altsPdfai` | 32 |
| `altsAskyourpdf` | 36 |
| `altsHumata` | 24 |
| `altsHub` | 3 |
| `compareHub` | 5 |
| new keys (all 11 locales) | 7 |
| **total** | **282 changed + 7 new** |

`compareHub.*` is outside the namespace list of the brief. It is included because it renders the `/compare` hub, and two of its taglines stated false facts (ChatPDF "PDF-only", NotebookLM "Google-dependent" with no rename).

## Component changes (hardcoded table cells)

A dash (`false`) in a comparison table renders as "No". Each dash below had no evidence or was contradicted, so it changed. Hardcoded prices were wrong.

| File | Row | Old competitor cell | New competitor cell | Evidence |
|---|---|---|---|---|
| `frontend/src/app/compare/chatpdf/ChatpdfContent.tsx` | Citation highlighting | – | Jumps to source | VE §2.7: "...clickable citations instantly scroll to the exact source in your PDF." / feature card "Pages referenced"; in-document highlighting not stated |
| `frontend/src/app/compare/chatpdf/ChatpdfContent.tsx` | No-signup demo | – | ✓ | PR §1: "ChatPDF is free to try and requires no account to get started." |
| `frontend/src/app/compare/chatpdf/ChatpdfContent.tsx` | Dark mode | – | Not verified | none: No statement in VE, CF or PR supports this; removed or marked "Not verified". |
| `frontend/src/app/compare/chatpdf/ChatpdfContent.tsx` | Web URL ingestion | – | ✓ | CF §1: "Formats (direct): PDF, DOC/DOCX, PPT/PPTX, MD, TXT, plus chat-with-website/YouTube." |
| `frontend/src/app/compare/chatpdf/ChatpdfContent.tsx` | Custom instructions | – | Not verified | none: No statement in VE, CF or PR supports this; removed or marked "Not verified". |
| `frontend/src/app/compare/askyourpdf/AskyourpdfContent.tsx` | Citation highlighting | – | Links to the cited page | VE §2.6: "We return your answer with a citation back to the exact page in the original PDF. Click the citation to verify." (highlighting not stated) |
| `frontend/src/app/compare/askyourpdf/AskyourpdfContent.tsx` | No-signup demo | – | Not verified | PR §3: "whether an anonymous upload actually completes is `not visible without signup`" |
| `frontend/src/app/compare/askyourpdf/AskyourpdfContent.tsx` | Dark mode | – | Not verified | none: No statement in VE, CF or PR supports this; removed or marked "Not verified". |
| `frontend/src/app/compare/humata/HumataContent.tsx` | Citation highlighting | – | ✓ | VE §2.10: "Highlights citations" (heading) / "Build trust with cited links into your source files." / "Each answer Humata generates will cite relevant sections..."; page number only in API docs |
| `frontend/src/app/compare/humata/HumataContent.tsx` | Video file support | ✓ | Not verified | VE §2.10: "Formats: not stated on the homepage, pricing page or docs pages checked." (no video, Word or other format evidence in VE, CF or PR) |
| `frontend/src/app/compare/humata/HumataContent.tsx` | Dark mode | – | Not verified | none: No statement in VE, CF or PR supports this; removed or marked "Not verified". |
| `frontend/src/app/compare/pdf-ai/PdfaiContent.tsx` | Citation highlighting | – | Sources listed | VE §2.11: "Sources included / Every response is backed by sources extracted from the uploaded document." (no page number or highlight documented) |
| `frontend/src/app/compare/pdf-ai/PdfaiContent.tsx` | Dark mode | – | Not verified | none: No statement in VE, CF or PR supports this; removed or marked "Not verified". |
| `frontend/src/app/compare/pdf-ai/PdfaiContent.tsx` | Active development | "Reduced updates" | row deleted | none: No statement in VE, CF or PR supports this; removed or marked "Not verified". |
| `frontend/src/app/alternatives/chatpdf/ChatpdfAltsContent.tsx` | Citation highlighting | – | Jumps to source | VE §2.7: "...clickable citations instantly scroll to the exact source in your PDF." / feature card "Pages referenced"; in-document highlighting not stated |
| `frontend/src/app/alternatives/chatpdf/ChatpdfAltsContent.tsx` | Languages | 1 | Not verified | none: No statement in VE, CF or PR supports this; removed or marked "Not verified". |
| `frontend/src/app/alternatives/chatpdf/ChatpdfAltsContent.tsx` | Starting price | $19.99/mo | Not published | VE §2.7: "Entry price: not published. chatpdf.com/pricing and /plus return 404 today. The FAQ names 'ChatPDF Plus' with no price." |
| `frontend/src/app/alternatives/askyourpdf/AskyourpdfAltsContent.tsx` | Citation highlighting | – | Links to the cited page | VE §2.6: "We return your answer with a citation back to the exact page in the original PDF. Click the citation to verify." (highlighting not stated) |
| `frontend/src/app/alternatives/askyourpdf/AskyourpdfAltsContent.tsx` | Languages | 1 | Not verified | none: No statement in VE, CF or PR supports this; removed or marked "Not verified". |
| `frontend/src/app/alternatives/askyourpdf/AskyourpdfAltsContent.tsx` | Starting price | $14.99/mo | $11.99/mo, billed yearly | VE §2.6 + PR §3: Premium "$11.99 per month billed yearly"; Pro "$14.99 per month billed yearly"; monthly-billed price "not shown"; Enterprise "Custom" |
| `frontend/src/app/alternatives/pdf-ai/PdfAiAltsContent.tsx` | Citation highlighting | – | Sources listed | VE §2.11: "Sources included / Every response is backed by sources extracted from the uploaded document." (no page number or highlight documented) |
| `frontend/src/app/alternatives/pdf-ai/PdfAiAltsContent.tsx` | Languages | 1 | Not verified | none: No statement in VE, CF or PR supports this; removed or marked "Not verified". |
| `frontend/src/app/alternatives/pdf-ai/PdfAiAltsContent.tsx` | Starting price | $15/mo | $17/mo ($10/mo billed yearly) | VE §2.11 + CF §3: Pro "$17 /mo Billed monthly"; "$10 /mo Billed yearly"; Pro = 100 uploads/mo, 1,000 q/mo; Ultimate "$27/user/mo monthly" |

`frontend/src/app/compare/humata/page.tsx`: the hardcoded English meta description no longer lists "video support" as a comparison point.

The keys `comparePdfai.featureActiveDevelopment`, `comparePdfai.featureActiveDevelopmentDocTalk` and `comparePdfai.featureActiveDevelopmentCompetitor` no longer render. They stay in the locale files (keys are kept); a later cleanup can delete them.

## New keys

| Key | EN value | Purpose |
|---|---|---|
| `comparison.notVerified` | Not verified | Table cell where the vendor's site does not confirm or deny a feature (replaces a dash, which reads as "no"). |
| `comparison.notPublished` | Not published | Price cell when the vendor publishes no price (ChatPDF Plus). |
| `comparison.jumpsToSource` | Jumps to source | ChatPDF citation cell: citations scroll to the source; highlighting not stated. |
| `comparison.linksToPage` | Links to the cited page | AskYourPDF citation cell: citation links to the exact page; highlighting not stated. |
| `comparison.sourcesListed` | Sources listed | PDF.ai citation cell: answers are backed by sources; no page or highlight documented. |
| `altsAskyourpdf.tableStartingPriceCompetitor` | $11.99/mo, billed yearly | Replaces the hardcoded "$14.99/mo" (that is the Pro price; Premium is the entry plan). |
| `altsPdfai.tableStartingPriceCompetitor` | $17/mo ($10/mo billed yearly) | Replaces the hardcoded "$15/mo". |

## Changed keys

### `compareChatpdf`

#### `compareChatpdf.heroDescription`

- **Old EN:** Both DocTalk and ChatPDF let you chat with documents using AI, but they take different approaches. ChatPDF focuses exclusively on PDFs with a simple interface, while DocTalk supports seven document formats and provides real-time citation highlighting so you can verify every answer against the original source. Here is how they compare across features, pricing, and performance.
- **Problem:** Says ChatPDF "focuses exclusively on PDFs"; ChatPDF reads Word, PowerPoint, Markdown and text too.
- **Evidence (VE §2.7):** "PDF (.pdf), Word (.doc, .docx), PowerPoint (.ppt, .pptx), Markdown (.md), and Text files (.txt)" (chatpdf.com FAQ)
- **Evidence (VE §2.7):** "...clickable citations instantly scroll to the exact source in your PDF." / feature card "Pages referenced"; in-document highlighting not stated
- **New EN:** Both DocTalk and ChatPDF let you chat with documents using AI. ChatPDF reads PDF, Word, PowerPoint, Markdown and text files, and its citations scroll to the source. DocTalk also reads Excel files and highlights the cited passage in your document. Here is how they compare on features, pricing and performance, checked against ChatPDF's own site in October 2026.

#### `compareChatpdf.metaDescription`

- **Old EN:** Both DocTalk and ChatPDF let you chat with documents using AI, but they take different approaches. ChatPDF focuses exclusively on PDFs with a simple interface, while DocTalk supports seven document formats and provides real-time citation highlighting so you can verify every answer against the original source. Here is how they compare across features, pricing, and performance.
- **Problem:** Same false "exclusively on PDFs" claim; also ~390 characters.
- **Evidence (VE §2.7):** "PDF (.pdf), Word (.doc, .docx), PowerPoint (.ppt, .pptx), Markdown (.md), and Text files (.txt)" (chatpdf.com FAQ)
- **Evidence (VE §2.7):** "Entry price: not published. chatpdf.com/pricing and /plus return 404 today. The FAQ names 'ChatPDF Plus' with no price."
- **New EN:** DocTalk vs ChatPDF: both read PDF, Word and PowerPoint. Compare citations, Excel support, free plans and pricing, checked on ChatPDF's site in October 2026.

#### `compareChatpdf.table.competitor.supportedFormats`

- **Old EN:** PDF only
- **Problem:** "PDF only" is false.
- **Evidence (VE §2.7):** "PDF (.pdf), Word (.doc, .docx), PowerPoint (.ppt, .pptx), Markdown (.md), and Text files (.txt)" (chatpdf.com FAQ)
- **New EN:** PDF, DOC/DOCX, PPT/PPTX, MD, TXT

#### `compareChatpdf.table.competitor.interfaceLanguages`

- **Old EN:** English-focused
- **Problem:** "English-focused" is unverified.
- **Evidence (none):** No statement in VE, CF or PR supports this; removed or marked "Not verified".
- **New EN:** Not verified

#### `compareChatpdf.table.competitor.freeTier`

- **Old EN:** 2 PDFs/day, 3 questions each
- **Problem:** "3 questions each" is not published by ChatPDF.
- **Evidence (VE §2.7):** "We offer a free plan that lets you analyze 2 documents every day." (no page, size or question cap published, PR §1)
- **Evidence (PR §1):** "ChatPDF is free to try and requires no account to get started."
- **New EN:** 2 documents/day, no account needed

#### `compareChatpdf.table.competitor.multipleAiModels`

- **Old EN:** Single model
- **Problem:** "Single model" is contradicted: ChatPDF routes between models.
- **Evidence (CF §1):** "Uses GPT-4o/GPT-4o-mini dynamic routing, not a fixed model." (direct)
- **New EN:** Automatic routing (GPT-4o, GPT-4o mini)

#### `compareChatpdf.table.competitor.docSizeLimit`

- **Old EN:** 32 MB
- **Problem:** "32 MB" is not published by ChatPDF.
- **Evidence (none):** No statement in VE, CF or PR supports this; removed or marked "Not verified".
- **New EN:** Not verified

#### `compareChatpdf.whatIsChatPDFDescription`

- **Old EN:** ChatPDF is one of the earliest AI PDF chat tools, launched in early 2023. It allows users to upload PDF files and ask questions about their contents using a conversational interface. The tool references page numbers in its answers, making it possible to locate information manually. ChatPDF has built a large user base thanks to its simplicity and early-mover advantage. The free tier allows 2 PDFs per day with 3 questions each, while the Plus plan ($19.99/month) removes these limits. ChatPDF focuses solely on PDF files and does not support other document formats like Word, PowerPoint, or Excel.
- **Problem:** Launch date, "large user base", "3 questions each", "$19.99/month" and "solely on PDF" are unsupported or false.
- **Evidence (VE §2.7):** "PDF (.pdf), Word (.doc, .docx), PowerPoint (.ppt, .pptx), Markdown (.md), and Text files (.txt)" (chatpdf.com FAQ)
- **Evidence (PR §1):** "ChatPDF is free to try and requires no account to get started."
- **Evidence (VE §2.7):** "...clickable citations instantly scroll to the exact source in your PDF." / feature card "Pages referenced"; in-document highlighting not stated
- **Evidence (VE §2.7):** "We offer a free plan that lets you analyze 2 documents every day." (no page, size or question cap published, PR §1)
- **Evidence (PR §1):** "our ChatPDF Plus plan provides unlimited document analysis, and more advanced features"
- **Evidence (VE §2.7):** "Entry price: not published. chatpdf.com/pricing and /plus return 404 today. The FAQ names 'ChatPDF Plus' with no price."
- **New EN:** ChatPDF is an AI chat tool for documents. According to its site (checked October 2026), it reads PDF, Word (.doc, .docx), PowerPoint (.ppt, .pptx), Markdown and text files, and you can start without an account. Its answers include clickable citations that scroll to the referenced spot in the document. The free plan lets you analyze 2 documents every day. ChatPDF Plus offers unlimited document analysis, but ChatPDF does not publish its price: its pricing page returned a 404 error when we checked.

#### `compareChatpdf.feature.formatSupportP1`

- **Old EN:** This is the most significant difference between the two tools. ChatPDF supports only PDF files. If you need to analyze a Word document, a PowerPoint presentation, an Excel spreadsheet, or a web page, you must first convert it to PDF before uploading, which is inconvenient and can introduce formatting issues.
- **Problem:** "ChatPDF supports only PDF files" is false.
- **Evidence (VE §2.7):** "PDF (.pdf), Word (.doc, .docx), PowerPoint (.ppt, .pptx), Markdown (.md), and Text files (.txt)" (chatpdf.com FAQ)
- **New EN:** Format support is closer than it used to be. ChatPDF now reads PDF, Word (.doc, .docx), PowerPoint (.ppt, .pptx), Markdown and text files, so you can upload most office documents without converting them first. Its FAQ (checked October 2026) does not list Excel spreadsheets among its file types.

#### `compareChatpdf.feature.citationsP1`

- **Old EN:** Both tools use retrieval-augmented generation (RAG) to answer questions based on your document content. ChatPDF provides page number references in its responses, which helps you know roughly where to look. However, you need to manually scroll to the referenced page and search for the relevant passage yourself.
- **Problem:** "You need to manually scroll" is contradicted: ChatPDF citations scroll to the source.
- **Evidence (VE §2.7):** "...clickable citations instantly scroll to the exact source in your PDF." / feature card "Pages referenced"; in-document highlighting not stated
- **New EN:** Both tools use retrieval-augmented generation (RAG) to answer from your document. ChatPDF says its clickable citations instantly scroll to the exact source in your PDF, and it lists 'Pages referenced' as a feature. Its site does not say whether the cited passage is highlighted.

#### `compareChatpdf.feature.citationsP2Pre`

- **Old EN:** DocTalk takes citations significantly further with real-time citation highlighting. When the AI answers your question, each citation is a clickable link. Clicking it instantly scrolls the document viewer to the exact passage and visually highlights it, allowing you to verify the answer in seconds without any manual searching. This feature is particularly valuable for academic research, legal document review, and any task where accuracy matters. Learn more about our 
- **Problem:** "Significantly further" and "without any manual searching" contrast DocTalk with a ChatPDF behaviour that is false.
- **Evidence (VE §2.7):** "...clickable citations instantly scroll to the exact source in your PDF." / feature card "Pages referenced"; in-document highlighting not stated
- **New EN:** DocTalk also makes each citation a clickable link. Clicking it scrolls the document viewer to the cited passage and highlights it, so you can check the answer against the source in seconds. This matters most for academic research, legal document review, and any task where accuracy matters. Learn more about our 

#### `compareChatpdf.feature.languagesP1`

- **Old EN:** ChatPDF has a primarily English interface with limited multilingual capability. While the underlying AI models can process text in multiple languages, the interface, help documentation, and user experience are centered around English speakers.
- **Problem:** "Primarily English interface with limited multilingual capability" is unverified.
- **Evidence (none):** No statement in VE, CF or PR supports this; removed or marked "Not verified".
- **New EN:** We did not verify which interface languages ChatPDF offers, so this page makes no claim about them. Check ChatPDF's site if you need a specific language.

#### `compareChatpdf.feature.pricingP1`

- **Old EN:** ChatPDF offers a free tier limited to 2 PDFs per day with 3 questions each and a maximum file size of 10 MB. The Plus plan costs $19.99 per month and includes 50 PDFs per day, 50 questions per PDF, and a 32 MB file size limit.
- **Problem:** "3 questions each", "10 MB", "$19.99", "50 PDFs per day" and "32 MB" are not published by ChatPDF.
- **Evidence (VE §2.7):** "We offer a free plan that lets you analyze 2 documents every day." (no page, size or question cap published, PR §1)
- **Evidence (PR §1):** "ChatPDF is free to try and requires no account to get started."
- **Evidence (PR §1):** "our ChatPDF Plus plan provides unlimited document analysis, and more advanced features"
- **Evidence (VE §2.7):** "Entry price: not published. chatpdf.com/pricing and /plus return 404 today. The FAQ names 'ChatPDF Plus' with no price."
- **New EN:** ChatPDF's free plan lets you analyze 2 documents every day, and you can start without an account. ChatPDF Plus offers unlimited document analysis, but ChatPDF does not publish a price: its pricing page returned a 404 error in October 2026, and its FAQ names the plan without a price.

#### `compareChatpdf.feature.pricingP2Mid`

- **Old EN:**  that requires absolutely no signup, so you can try the product before creating an account. The free tier includes 300 credits per month. The Plus plan ($9.99/month) includes 3,000 credits, unrestricted Pro mode, and export features. The Pro plan ($19.99/month) adds 9,000 credits and custom instructions. DocTalk is generally more affordable: the Plus plan at $9.99 offers comparable or better value than ChatPDF Plus at $19.99. View 
- **Problem:** Compares DocTalk Plus with an unpublished "$19.99" ChatPDF price.
- **Evidence (VE §2.7):** "Entry price: not published. chatpdf.com/pricing and /plus return 404 today. The FAQ names 'ChatPDF Plus' with no price."
- **Evidence (CLAUDE.md + .claude/rules/frontend.md):** DocTalk: Free 300 credits/month, Plus $9.99, Pro $19.99; formats PDF/DOCX/PPTX/XLSX/TXT/MD/URL; anonymous use = the sample-document demo only (sign-in required to upload)
- **New EN:**  that requires no signup, so you can try the product before creating an account. The free tier includes 300 credits per month. The Plus plan ($9.99/month) includes 3,000 credits, unrestricted Pro mode, and export features. The Pro plan ($19.99/month) adds 9,000 credits and custom instructions. DocTalk publishes these prices; ChatPDF does not, so the paid plans cannot be compared directly. View 

#### `compareChatpdf.feature.performanceP1`

- **Old EN:** ChatPDF uses a single AI model for all users and generally provides responses within a few seconds. The simplicity of its architecture, focused solely on PDF, means parsing is straightforward.
- **Problem:** "Single AI model" is contradicted; "focused solely on PDF" is false; speed claim is unmeasured.
- **Evidence (CF §1):** "Uses GPT-4o/GPT-4o-mini dynamic routing, not a fixed model." (direct)
- **New EN:** ChatPDF chooses the model for you: it routes questions between GPT-4o and GPT-4o mini automatically (per its site, September 2026). We did not measure its response times.

#### `compareChatpdf.feature.securityP1`

- **Old EN:** ChatPDF states that documents are stored securely and can be deleted by the user. The privacy policy covers basic data handling practices.
- **Problem:** Statements about ChatPDF storage, deletion and privacy policy are not in the evidence.
- **Evidence (none):** No statement in VE, CF or PR supports this; removed or marked "Not verified".
- **New EN:** We did not review ChatPDF's security or privacy documentation for this comparison. Read its privacy policy before you upload sensitive files.

#### `compareChatpdf.whoDocTalk.item1`

- **Old EN:** Users who work with multiple document formats (Word, PowerPoint, Excel) and want to avoid converting everything to PDF
- **Problem:** Reason "avoid converting Word/PowerPoint to PDF" no longer applies: ChatPDF reads them.
- **Evidence (VE §2.7):** "PDF (.pdf), Word (.doc, .docx), PowerPoint (.ppt, .pptx), Markdown (.md), and Text files (.txt)" (chatpdf.com FAQ)
- **New EN:** Users who also work with Excel spreadsheets, which ChatPDF does not list among its file types

#### `compareChatpdf.whoDocTalk.item4`

- **Old EN:** Budget-conscious users who want premium features at a lower price point ($9.99 vs $19.99)
- **Problem:** "$9.99 vs $19.99" uses an unpublished ChatPDF price.
- **Evidence (VE §2.7):** "Entry price: not published. chatpdf.com/pricing and /plus return 404 today. The FAQ names 'ChatPDF Plus' with no price."
- **Evidence (CLAUDE.md + .claude/rules/frontend.md):** DocTalk: Free 300 credits/month, Plus $9.99, Pro $19.99; formats PDF/DOCX/PPTX/XLSX/TXT/MD/URL; anonymous use = the sample-document demo only (sign-in required to upload)
- **New EN:** Users who want published prices: Plus costs $9.99 per month and Pro $19.99 per month

#### `compareChatpdf.whoChatPDF.item1`

- **Old EN:** Users who exclusively work with PDF files and do not need other format support
- **Problem:** "Exclusively work with PDF files" misdescribes ChatPDF.
- **Evidence (PR §1):** "ChatPDF is free to try and requires no account to get started."
- **New EN:** Users who want to start without creating an account

#### `compareChatpdf.whoChatPDF.item2`

- **Old EN:** People who prefer an established tool with a large community and proven track record
- **Problem:** "Large community and proven track record" is unsupported.
- **Evidence (CF §1):** "Formats (direct): PDF, DOC/DOCX, PPT/PPTX, MD, TXT, plus chat-with-website/YouTube."
- **New EN:** People who also want to chat with websites and YouTube videos

#### `compareChatpdf.whoChatPDF.item3`

- **Old EN:** Users who need the simplest possible interface with minimal learning curve
- **Problem:** "Simplest possible interface" is unsupported.
- **Evidence (VE §2.7):** "PDF (.pdf), Word (.doc, .docx), PowerPoint (.ppt, .pptx), Markdown (.md), and Text files (.txt)" (chatpdf.com FAQ)
- **New EN:** Users whose files are PDF, Word, PowerPoint, Markdown or text, not Excel

#### `compareChatpdf.whoChatPDF.item4`

- **Old EN:** Casual users who only need to ask a few questions occasionally (2 free PDFs per day may suffice)
- **Problem:** "2 free PDFs per day" understates the documented "2 documents every day".
- **Evidence (VE §2.7):** "We offer a free plan that lets you analyze 2 documents every day." (no page, size or question cap published, PR §1)
- **New EN:** Casual users who only need a few documents a day (the free plan covers 2 documents every day)

#### `compareChatpdf.verdictP1`

- **Old EN:** ChatPDF pioneered the AI PDF chat category and remains a solid choice for users who only work with PDF files and want a simple, proven interface. Its large user base and early-mover advantage give it brand recognition.
- **Problem:** "Pioneered the category", "only PDF files", "large user base" are unsupported or false.
- **Evidence (PR §1):** "ChatPDF is free to try and requires no account to get started."
- **Evidence (VE §2.7):** "PDF (.pdf), Word (.doc, .docx), PowerPoint (.ppt, .pptx), Markdown (.md), and Text files (.txt)" (chatpdf.com FAQ)
- **Evidence (VE §2.7):** "We offer a free plan that lets you analyze 2 documents every day." (no page, size or question cap published, PR §1)
- **Evidence (VE §2.7):** "...clickable citations instantly scroll to the exact source in your PDF." / feature card "Pages referenced"; in-document highlighting not stated
- **New EN:** ChatPDF is a solid choice if you want to start without an account and your files are PDF, Word, PowerPoint, Markdown or text. Its free plan covers 2 documents a day, and its citations scroll to the source.

#### `compareChatpdf.verdictP2`

- **Old EN:** However, DocTalk offers a more comprehensive solution. The support for seven document formats eliminates the need for file conversion. Real-time citation highlighting provides a level of answer verification that ChatPDF does not match. The 11-language interface makes DocTalk accessible to a global audience. And at $9.99 per month for the Plus plan versus ChatPDF Plus at $19.99, DocTalk delivers more features for less money.
- **Problem:** Format, citation and "$19.99" claims are false or unsupported.
- **Evidence (VE §2.7):** "PDF (.pdf), Word (.doc, .docx), PowerPoint (.ppt, .pptx), Markdown (.md), and Text files (.txt)" (chatpdf.com FAQ)
- **Evidence (VE §2.7):** "...clickable citations instantly scroll to the exact source in your PDF." / feature card "Pages referenced"; in-document highlighting not stated
- **Evidence (VE §2.7):** "Entry price: not published. chatpdf.com/pricing and /plus return 404 today. The FAQ names 'ChatPDF Plus' with no price."
- **Evidence (CLAUDE.md + .claude/rules/frontend.md):** DocTalk: Free 300 credits/month, Plus $9.99, Pro $19.99; formats PDF/DOCX/PPTX/XLSX/TXT/MD/URL; anonymous use = the sample-document demo only (sign-in required to upload)
- **New EN:** DocTalk differs in three ways. It also reads Excel files. It highlights the cited passage in the original document when you click a citation. And it publishes its prices: Plus costs $9.99 per month and Pro $19.99 per month, while ChatPDF does not list a price for ChatPDF Plus.

#### `compareChatpdf.verdictP3Pre`

- **Old EN:** For most users, especially those who work with mixed document formats or need citation verification, DocTalk is the stronger choice. The best way to decide is to 
- **Problem:** "Mixed document formats" framing assumes ChatPDF is PDF-only.
- **Evidence (VE §2.7):** "PDF (.pdf), Word (.doc, .docx), PowerPoint (.ppt, .pptx), Markdown (.md), and Text files (.txt)" (chatpdf.com FAQ)
- **New EN:** If you need Excel support or want to see the cited passage highlighted, DocTalk is the better fit. The best way to decide is to 

#### `compareChatpdf.faq.a1`

- **Old EN:** DocTalk supports 7 document formats (PDF, DOCX, PPTX, XLSX, TXT, MD, URL) while ChatPDF only supports PDF. DocTalk also provides real-time citation highlighting that shows you exactly where in the document each answer comes from, a feature ChatPDF lacks. However, ChatPDF has been around longer and has a larger user base.
- **Problem:** "ChatPDF only supports PDF", "feature ChatPDF lacks", "larger user base" are false or unsupported.
- **Evidence (VE §2.7):** "PDF (.pdf), Word (.doc, .docx), PowerPoint (.ppt, .pptx), Markdown (.md), and Text files (.txt)" (chatpdf.com FAQ)
- **Evidence (VE §2.7):** "...clickable citations instantly scroll to the exact source in your PDF." / feature card "Pages referenced"; in-document highlighting not stated
- **Evidence (PR §1):** "ChatPDF is free to try and requires no account to get started."
- **New EN:** It depends on your files and how you check answers. Both tools read PDF, Word and PowerPoint files. DocTalk also reads Excel (XLSX) and highlights the cited passage in your document when you click a citation. ChatPDF lets you start without an account, and its citations scroll to the source; its site does not say whether the passage is highlighted.

#### `compareChatpdf.faq.a2`

- **Old EN:** ChatPDF mentions page numbers in its answers but does not offer inline citation highlighting. DocTalk provides real-time citation highlighting that visually highlights the exact passage in your document when you click a citation, making it much easier to verify AI answers.
- **Problem:** "Mentions page numbers but does not offer inline highlighting" is not what ChatPDF documents.
- **Evidence (VE §2.7):** "...clickable citations instantly scroll to the exact source in your PDF." / feature card "Pages referenced"; in-document highlighting not stated
- **New EN:** ChatPDF says its clickable citations instantly scroll to the exact source in your PDF. Its site does not say whether the cited passage is highlighted. DocTalk scrolls to the cited passage and highlights it in your document when you click a citation.

#### `compareChatpdf.faq.a3`

- **Old EN:** Yes. DocTalk offers an instant demo that requires no signup at all, plus a free tier with 300 credits per month after you create an account. ChatPDF offers a free tier limited to 2 PDFs per day with 3 questions each.
- **Problem:** "3 questions each" is not published.
- **Evidence (VE §2.7):** "We offer a free plan that lets you analyze 2 documents every day." (no page, size or question cap published, PR §1)
- **Evidence (PR §1):** "ChatPDF is free to try and requires no account to get started."
- **Evidence (CLAUDE.md + .claude/rules/frontend.md):** DocTalk: Free 300 credits/month, Plus $9.99, Pro $19.99; formats PDF/DOCX/PPTX/XLSX/TXT/MD/URL; anonymous use = the sample-document demo only (sign-in required to upload)
- **New EN:** Yes. DocTalk offers an instant demo that requires no signup at all, plus a free tier with 300 credits per month after you create an account. ChatPDF's free plan lets you analyze 2 documents every day, without an account.

#### `compareChatpdf.faq.a4`

- **Old EN:** DocTalk supports 11 interface languages (English, Chinese, Spanish, Japanese, German, French, Korean, Portuguese, Italian, Arabic, and Hindi) and can analyze documents in any language. ChatPDF is primarily English-focused with limited multilingual support.
- **Problem:** "ChatPDF is primarily English-focused" is unverified.
- **Evidence (none):** No statement in VE, CF or PR supports this; removed or marked "Not verified".
- **New EN:** DocTalk's interface is available in 11 languages (English, Chinese, Spanish, Japanese, German, French, Korean, Portuguese, Italian, Arabic, and Hindi), and it can analyze documents in any language. We did not verify which interface languages ChatPDF offers.

#### `compareChatpdf.faq.a5`

- **Old EN:** Yes. DocTalk natively supports PDF, DOCX, PPTX, XLSX, TXT, Markdown, and web URLs. ChatPDF only processes PDF files, so you would need to convert other formats to PDF first.
- **Problem:** "ChatPDF only processes PDF files" is false.
- **Evidence (VE §2.7):** "PDF (.pdf), Word (.doc, .docx), PowerPoint (.ppt, .pptx), Markdown (.md), and Text files (.txt)" (chatpdf.com FAQ)
- **New EN:** Yes. DocTalk reads PDF, DOCX, PPTX, XLSX, TXT, Markdown, and web URLs. ChatPDF also reads Word and PowerPoint files (.doc, .docx, .ppt, .pptx), so neither tool needs you to convert them first.

#### `compareChatpdf.ctaDescription`

- **Old EN:** Upload a document and see citation highlighting in action. No account needed.
- **Problem:** DocTalk claim: anonymous visitors cannot upload; the no-account demo uses sample documents.
- **Evidence (CLAUDE.md + .claude/rules/frontend.md):** DocTalk: Free 300 credits/month, Plus $9.99, Pro $19.99; formats PDF/DOCX/PPTX/XLSX/TXT/MD/URL; anonymous use = the sample-document demo only (sign-in required to upload)
- **New EN:** Open a sample document and see citation highlighting in action. No account needed.

### `compareNotebooklm`

#### `compareNotebooklm.heroDescription`

- **Old EN:** Google NotebookLM and DocTalk represent two different philosophies in AI document analysis. NotebookLM is a free, Google-integrated tool built around multi-source notebooks with a unique audio podcast feature. DocTalk is an independent, privacy-first platform focused on deep single-document analysis with real-time citation highlighting across seven formats and eleven languages. Here is how they compare in detail.
- **Problem:** "Free" without limits, "unique audio podcast" and the old name are outdated or unsupported.
- **Evidence (VE §2.9 + CF §5):** "Is Gemini Notebook the same product as NotebookLM?"; notebooklm.google 301-redirects to notebook.google
- **Evidence (VE §2.9 + CF §5):** Standard: "100/user" notebooks, "50/notebook" sources ("Usage Limits (Subject to Change)")
- **Evidence (PR §11):** Standard limits table lists "3/day" Audio Overviews
- **New EN:** Google NotebookLM is now called Gemini Notebook. It and DocTalk take different approaches to AI document analysis. Gemini Notebook is built around multi-source notebooks, has a free tier with usage limits, and creates Audio Overviews. DocTalk is an independent tool focused on single-document analysis, with citation highlighting in the original document across seven formats and 11 interface languages. Here is how they compare.

#### `compareNotebooklm.metaDescription`

- **Old EN:** Google NotebookLM and DocTalk represent two different philosophies in AI document analysis. NotebookLM is a free, Google-integrated tool built around multi-source notebooks with a unique audio podcast feature. DocTalk is an independent, privacy-first platform focused on deep single-document analysis with real-time citation highlighting across seven formats and eleven languages. Here is how they compare in detail.
- **Problem:** Same outdated claims; ~390 characters.
- **Evidence (VE §2.9 + CF §5):** "Is Gemini Notebook the same product as NotebookLM?"; notebooklm.google 301-redirects to notebook.google
- **Evidence (VE §2.9 + CF §5):** "Microsoft Word (docx), Text (txt), Markdown (md), PDF files (pdf), CSV (csv), and PowerPoint (pptx) files"; "ePub files"; plus Google Docs/Slides/Sheets, web URLs, public YouTube URLs, audio, images, pasted text (no XLSX)
- **Evidence (VE §2.9 + CF §5):** Standard: "100/user" notebooks, "50/notebook" sources ("Usage Limits (Subject to Change)")
- **New EN:** DocTalk vs NotebookLM, now Gemini Notebook: citations, file formats, free tiers, privacy and pricing, checked against Google's help pages in October 2026.

#### `compareNotebooklm.table.competitor.supportedFormats`

- **Old EN:** PDF, Google Docs, web URLs, text, YouTube
- **Problem:** Omits DOCX, PPTX, CSV, ePub that Google lists.
- **Evidence (VE §2.9 + CF §5):** "Microsoft Word (docx), Text (txt), Markdown (md), PDF files (pdf), CSV (csv), and PowerPoint (pptx) files"; "ePub files"; plus Google Docs/Slides/Sheets, web URLs, public YouTube URLs, audio, images, pasted text (no XLSX)
- **New EN:** PDF, DOCX, PPTX, TXT, MD, CSV, ePub, Google Docs, URLs, YouTube

#### `compareNotebooklm.table.competitor.citationHighlighting`

- **Old EN:** Inline source references
- **Problem:** "Inline source references" omits the documented jump to the quote.
- **Evidence (VE §2.9):** "To get the full quoted text, hover over any citation." / "To navigate directly to the quote and review it in context, select a citation." / no page number documented
- **New EN:** Jumps to the quoted passage

#### `compareNotebooklm.table.competitor.interfaceLanguages`

- **Old EN:** English primary
- **Problem:** "English primary" is unverified.
- **Evidence (none):** No statement in VE, CF or PR supports this; removed or marked "Not verified".
- **New EN:** Not verified

#### `compareNotebooklm.table.competitor.freeTier`

- **Old EN:** Free (Google account required)
- **Problem:** "Free" omits the published usage limits.
- **Evidence (VE §2.9 + CF §5):** Standard: "100/user" notebooks, "50/notebook" sources ("Usage Limits (Subject to Change)")
- **Evidence (PR §11):** "you must... verify your age in your Google Account"
- **New EN:** Free tier with limits (Google account)

#### `compareNotebooklm.table.competitor.multipleAiModes`

- **Old EN:** Gemini only
- **Problem:** "Gemini only" asserts a restriction the evidence does not state.
- **Evidence (PR §11):** "built with the latest Gemini models"
- **New EN:** Gemini models

#### `compareNotebooklm.table.competitor.dataEncryption`

- **Old EN:** Google standard
- **Problem:** "Google standard" is unverified.
- **Evidence (none):** No statement in VE, CF or PR supports this; removed or marked "Not verified".
- **New EN:** Not verified

#### `compareNotebooklm.whatIsNotebookLMDescription`

- **Old EN:** Google NotebookLM (formerly Project Tailwind) is a free AI-powered research tool that lets you create notebooks with multiple source documents. You can upload PDFs, link Google Docs, paste text, and add web URLs or YouTube videos as sources. The AI synthesizes information across all sources in a notebook, making it useful for literature reviews and research projects. NotebookLM is unique in offering AI-generated audio podcasts that summarize your sources as a natural-sounding conversation. It runs on Google Gemini and is deeply integrated with the Google ecosystem. A Google account is required.
- **Problem:** "Project Tailwind", "free" and the format list are unsupported or outdated.
- **Evidence (VE §2.9 + CF §5):** "Is Gemini Notebook the same product as NotebookLM?"; notebooklm.google 301-redirects to notebook.google
- **Evidence (VE §2.9 + CF §5):** "Microsoft Word (docx), Text (txt), Markdown (md), PDF files (pdf), CSV (csv), and PowerPoint (pptx) files"; "ePub files"; plus Google Docs/Slides/Sheets, web URLs, public YouTube URLs, audio, images, pasted text (no XLSX)
- **Evidence (VE §2.9):** "To get the full quoted text, hover over any citation." / "To navigate directly to the quote and review it in context, select a citation." / no page number documented
- **Evidence (PR §11):** Standard limits table lists "3/day" Audio Overviews
- **Evidence (PR §11):** "built with the latest Gemini models"
- **Evidence (PR §11):** "you must... verify your age in your Google Account"
- **Evidence (VE §2.9 + CF §5):** Standard: "100/user" notebooks, "50/notebook" sources ("Usage Limits (Subject to Change)")
- **New EN:** Google NotebookLM, now called Gemini Notebook, is an AI research tool built around notebooks of sources. Google's help pages (checked October 2026) list PDF, Word (.docx), PowerPoint (.pptx), text, Markdown, CSV and ePub files, plus Google Docs, Slides and Sheets, web URLs and public YouTube videos as sources. Answers cite direct quotes from your sources, and it can create Audio Overviews of your sources. It is built with Gemini models, and you need a Google account. The free Standard tier allows 100 notebooks and 50 sources per notebook.

#### `compareNotebooklm.feature.formatSupportP1`

- **Old EN:** NotebookLM supports PDF files, Google Docs (natively via Drive), web URLs, pasted text, and YouTube video transcripts. It does not natively support DOCX, PPTX, or XLSX files, though you can upload Word documents to Google Drive and convert them. The YouTube integration is a unique strength for video-based research.
- **Problem:** "Does not natively support DOCX, PPTX" is false.
- **Evidence (VE §2.9 + CF §5):** "Microsoft Word (docx), Text (txt), Markdown (md), PDF files (pdf), CSV (csv), and PowerPoint (pptx) files"; "ePub files"; plus Google Docs/Slides/Sheets, web URLs, public YouTube URLs, audio, images, pasted text (no XLSX)
- **New EN:** Gemini Notebook accepts a wide range of sources. Google's help pages (October 2026) list Word (.docx), PowerPoint (.pptx), PDF, text, Markdown, CSV and ePub files, Google Docs, Slides and Sheets, web URLs, public YouTube videos and pasted text. Excel (.xlsx) files are not on that list.

#### `compareNotebooklm.feature.formatSupportP2Pre`

- **Old EN:** DocTalk directly accepts PDF, DOCX, PPTX, XLSX, TXT, Markdown, and web URLs with dedicated parsers for each format. The XLSX parser preserves spreadsheet structure, and the PPTX parser maintains slide order with speaker notes. No conversion step is needed. While DocTalk does not support YouTube or Google Docs integration, it covers the most common business and academic document formats. See 
- **Problem:** Must say plainly that Gemini Notebook accepts more source types.
- **Evidence (VE §2.9 + CF §5):** "Microsoft Word (docx), Text (txt), Markdown (md), PDF files (pdf), CSV (csv), and PowerPoint (pptx) files"; "ePub files"; plus Google Docs/Slides/Sheets, web URLs, public YouTube URLs, audio, images, pasted text (no XLSX)
- **Evidence (CLAUDE.md + .claude/rules/frontend.md):** DocTalk: Free 300 credits/month, Plus $9.99, Pro $19.99; formats PDF/DOCX/PPTX/XLSX/TXT/MD/URL; anonymous use = the sample-document demo only (sign-in required to upload)
- **New EN:** DocTalk accepts PDF, DOCX, PPTX, XLSX, TXT, Markdown, and web URLs, with a dedicated parser for each format. The XLSX parser preserves spreadsheet structure, and the PPTX parser keeps slide order and speaker notes. Gemini Notebook accepts more source types overall; DocTalk does not support YouTube, audio or Google Docs. See 

#### `compareNotebooklm.feature.citationsP1`

- **Old EN:** NotebookLM provides inline citations numbered with source references. Clicking a citation highlights the relevant source in the notebook sidebar. The multi-source approach means answers can synthesize information from multiple documents, which is powerful for cross-referencing. The AI podcast feature creates engaging audio summaries, though it cannot replace detailed Q&A.
- **Problem:** "Clicking a citation highlights the source in the sidebar" is not what Google documents; podcast claims unsupported.
- **Evidence (VE §2.9):** "To get the full quoted text, hover over any citation." / "To navigate directly to the quote and review it in context, select a citation." / no page number documented
- **New EN:** Gemini Notebook uses direct quotes from your sources as citations. Hover over a citation to see the full quote, or select it to open the quote in context, according to Google's help pages. Google does not document page numbers for citations. Because a notebook holds many sources, answers can draw on several documents at once, which helps with cross-referencing.

#### `compareNotebooklm.feature.citationsP2Pre`

- **Old EN:** DocTalk provides real-time citation highlighting in a dedicated side-by-side document viewer. Click any citation and the viewer scrolls to the exact passage with a visual highlight overlay. This is particularly effective for PDF documents where bounding-box coordinates enable precise highlighting. While DocTalk focuses on single-document analysis rather than multi-source synthesis, it provides deeper, more precise citations for individual documents. Learn more about 
- **Problem:** "Deeper, more precise citations" is an unverified comparison.
- **Evidence (VE §2.9):** "To get the full quoted text, hover over any citation." / "To navigate directly to the quote and review it in context, select a citation." / no page number documented
- **New EN:** DocTalk provides real-time citation highlighting in a dedicated side-by-side document viewer. Click any citation and the viewer scrolls to the exact passage with a visual highlight overlay. This is particularly effective for PDF documents, where bounding-box coordinates enable precise highlighting. DocTalk focuses on single-document analysis rather than multi-source synthesis, and each citation leads to the highlighted passage in the original document. Learn more about 

#### `compareNotebooklm.feature.languagesP1`

- **Old EN:** NotebookLM has a primarily English interface, though Gemini can process and respond in multiple languages. The audio podcast feature currently works best in English. The Google ecosystem provides some inherent multilingual support, but the NotebookLM interface itself is not fully localized.
- **Problem:** "Primarily English interface" and "audio works best in English" are unverified.
- **Evidence (none):** No statement in VE, CF or PR supports this; removed or marked "Not verified".
- **New EN:** We did not verify which interface or Audio Overview languages Gemini Notebook supports, so this page makes no claim about them.

#### `compareNotebooklm.feature.languagesP2Pre`

- **Old EN:** DocTalk offers a fully localized interface in 11 languages: English, Chinese, Spanish, Japanese, German, French, Korean, Portuguese, Italian, Arabic, and Hindi. Every interface element is translated, and the AI responds in the language of your question. This makes DocTalk the stronger choice for multilingual teams. See 
- **Problem:** "The stronger choice for multilingual teams" rests on the unverified claim above.
- **Evidence (none):** No statement in VE, CF or PR supports this; removed or marked "Not verified".
- **New EN:** DocTalk offers a fully localized interface in 11 languages: English, Chinese, Spanish, Japanese, German, French, Korean, Portuguese, Italian, Arabic, and Hindi. Every interface element is translated, and the AI responds in the language of your question. See 

#### `compareNotebooklm.feature.pricingP1`

- **Old EN:** NotebookLM is currently free. This is its biggest advantage. Google has not disclosed future pricing, but as with many Google products, it may remain free with usage limits while offering premium features at a cost. The tradeoff is that you are building your workflow inside Google ecosystem.
- **Problem:** "Currently free... Google has not disclosed pricing" is outdated: free tier has limits and paid Google AI plans exist.
- **Evidence (VE §2.9 + CF §5):** Standard: "100/user" notebooks, "50/notebook" sources ("Usage Limits (Subject to Change)")
- **Evidence (PR §11 + VE §2.9):** "Google AI Plus, Pro and Ultra plans are only available in specific regions."; "Entry price: not shown on Google's Gemini Notebook pages." (EUR only on one.google.com)
- **New EN:** Gemini Notebook has a free Standard tier with published usage limits: 100 notebooks per user and 50 sources per notebook (October 2026). Google sells higher limits through its Google AI Plus, Pro and Ultra plans, which are only available in some regions. Google's notebook pages do not show those plans' prices.

#### `compareNotebooklm.feature.pricingP2Mid`

- **Old EN:**  with no signup required, plus 300 free credits per month. Paid plans start at $9.99/month (Plus) for 3,000 credits and go up to $19.99/month (Pro) for 9,000 credits with advanced features. While not free like NotebookLM, DocTalk provides transparent, predictable pricing without vendor lock-in. View 
- **Problem:** "While not free like NotebookLM" is wrong: both have free tiers with limits.
- **Evidence (VE §2.9 + CF §5):** Standard: "100/user" notebooks, "50/notebook" sources ("Usage Limits (Subject to Change)")
- **Evidence (CLAUDE.md + .claude/rules/frontend.md):** DocTalk: Free 300 credits/month, Plus $9.99, Pro $19.99; formats PDF/DOCX/PPTX/XLSX/TXT/MD/URL; anonymous use = the sample-document demo only (sign-in required to upload)
- **New EN:**  with no signup required, plus 300 free credits per month. Paid plans start at $9.99/month (Plus) for 3,000 credits and go up to $19.99/month (Pro) for 9,000 credits with advanced features. Both tools have a free tier with limits. View 

#### `compareNotebooklm.feature.performanceP1`

- **Old EN:** NotebookLM runs on Google Gemini and benefits from Google infrastructure. Responses are generally fast, though processing multiple large sources in a notebook can take time. The audio podcast generation is a longer process, typically taking a minute or more to produce.
- **Problem:** Speed and audio-duration claims are unmeasured.
- **Evidence (PR §11):** "built with the latest Gemini models"
- **New EN:** Gemini Notebook is built with Google's Gemini models. We did not measure its response times or how long Audio Overviews take to create.

#### `compareNotebooklm.feature.performanceP2`

- **Old EN:** DocTalk offers two performance modes. Flash mode (DeepSeek V4 Flash) provides the fastest responses. Pro mode (DeepSeek V4 Pro) is ideal for deeper document analysis. This flexibility is unavailable in NotebookLM, which is locked to Gemini.
- **Problem:** "Unavailable in NotebookLM, which is locked to Gemini" is unverified.
- **Evidence (none):** No statement in VE, CF or PR supports this; removed or marked "Not verified".
- **New EN:** DocTalk offers two performance modes. Flash mode (DeepSeek V4 Flash) provides the fastest responses. Pro mode (DeepSeek V4 Pro) is ideal for deeper document analysis. You choose the mode for each question.

#### `compareNotebooklm.feature.securityP1`

- **Old EN:** NotebookLM is subject to Google privacy policies. While Google states that NotebookLM does not use your data for training, it is still within the Google ecosystem, and your documents are stored on Google servers. This may be a concern for organizations with strict data governance requirements or those who prefer not to centralize data with a single tech company.
- **Problem:** Google training and storage statements are not in the evidence.
- **Evidence (none):** No statement in VE, CF or PR supports this; removed or marked "Not verified".
- **New EN:** Gemini Notebook is a Google product, so Google's terms and privacy policy apply to the documents you add. We did not review Google's data-handling commitments for this page. Organizations with strict data-governance rules should read them before uploading.

#### `compareNotebooklm.feature.securityP2`

- **Old EN:** DocTalk is an independent platform with AES-256 encryption, SSRF protection, and GDPR compliance features. Documents are never used for AI training. You can export all your data at any time, and the platform supports multiple authentication providers (Google, Microsoft, email) to avoid vendor lock-in. For organizations that need data sovereignty or want to avoid Google dependency, DocTalk is the more private choice.
- **Problem:** "DocTalk is the more private choice" is an unverified comparison.
- **Evidence (none):** No statement in VE, CF or PR supports this; removed or marked "Not verified".
- **New EN:** DocTalk is an independent platform with AES-256 encryption, SSRF protection, and GDPR compliance features. Documents are never used for AI training. You can export all your data at any time, and the platform supports multiple authentication providers (Google, Microsoft, email) to avoid vendor lock-in.

#### `compareNotebooklm.whoDocTalk.item2`

- **Old EN:** People working with DOCX, PPTX, or XLSX files that NotebookLM does not natively support
- **Problem:** "DOCX, PPTX ... that NotebookLM does not natively support" is false for DOCX and PPTX.
- **Evidence (VE §2.9 + CF §5):** "Microsoft Word (docx), Text (txt), Markdown (md), PDF files (pdf), CSV (csv), and PowerPoint (pptx) files"; "ePub files"; plus Google Docs/Slides/Sheets, web URLs, public YouTube URLs, audio, images, pasted text (no XLSX)
- **New EN:** People who work with Excel (XLSX) files, which are not on Gemini Notebook's list of source types

#### `compareNotebooklm.whoNotebookLM.item2`

- **Old EN:** Users who want AI-generated audio podcasts summarizing their research
- **Problem:** Uses the unsupported "audio podcasts" description.
- **Evidence (PR §11):** Standard limits table lists "3/day" Audio Overviews
- **New EN:** Users who want Audio Overviews of their sources

#### `compareNotebooklm.whoNotebookLM.item4`

- **Old EN:** Budget-conscious users who need a completely free tool
- **Problem:** "Completely free tool" omits the published limits.
- **Evidence (VE §2.9 + CF §5):** Standard: "100/user" notebooks, "50/notebook" sources ("Usage Limits (Subject to Change)")
- **New EN:** Budget-conscious users whose work fits the free Standard tier (100 notebooks, 50 sources per notebook)

#### `compareNotebooklm.verdictP1`

- **Old EN:** NotebookLM and DocTalk solve different problems. NotebookLM excels at multi-source research with its notebook paradigm and the unique audio podcast feature. Being free and backed by Google infrastructure makes it a compelling choice for students and researchers who are comfortable within the Google ecosystem.
- **Problem:** "Unique audio podcast" and "being free" are unsupported or outdated.
- **Evidence (VE §2.9 + CF §5):** "Is Gemini Notebook the same product as NotebookLM?"; notebooklm.google 301-redirects to notebook.google
- **Evidence (VE §2.9 + CF §5):** "Microsoft Word (docx), Text (txt), Markdown (md), PDF files (pdf), CSV (csv), and PowerPoint (pptx) files"; "ePub files"; plus Google Docs/Slides/Sheets, web URLs, public YouTube URLs, audio, images, pasted text (no XLSX)
- **Evidence (PR §11):** Standard limits table lists "3/day" Audio Overviews
- **Evidence (VE §2.9 + CF §5):** Standard: "100/user" notebooks, "50/notebook" sources ("Usage Limits (Subject to Change)")
- **New EN:** Gemini Notebook and DocTalk solve different problems. Gemini Notebook is strong at multi-source research with its notebooks, accepts many source types, and creates Audio Overviews. Its free tier makes it a compelling choice for students and researchers who are comfortable within the Google ecosystem.

#### `compareNotebooklm.verdictP2`

- **Old EN:** DocTalk excels at deep, verifiable single-document analysis. The real-time citation highlighting is in a class of its own for answer verification. Support for seven document formats (including DOCX, PPTX, and XLSX that NotebookLM lacks) and 11 interface languages makes it more versatile for professional and international use cases. The independence from any single tech platform is a real advantage for organizations concerned about vendor lock-in.
- **Problem:** "DOCX, PPTX ... that NotebookLM lacks" is false; "in a class of its own" is unverified.
- **Evidence (VE §2.9 + CF §5):** "Microsoft Word (docx), Text (txt), Markdown (md), PDF files (pdf), CSV (csv), and PowerPoint (pptx) files"; "ePub files"; plus Google Docs/Slides/Sheets, web URLs, public YouTube URLs, audio, images, pasted text (no XLSX)
- **New EN:** DocTalk is built for verifiable single-document analysis. Clicking a citation highlights the cited passage in the original document. It reads Excel (XLSX) files, which Gemini Notebook does not list, and its interface is available in 11 languages. Its independence from any single tech platform matters to organizations concerned about vendor lock-in.

#### `compareNotebooklm.verdictP3Pre`

- **Old EN:** If you primarily need multi-source synthesis and love Google products, NotebookLM is excellent. If you need precise citation verification, work with business document formats, or want to avoid Google dependency, 
- **Problem:** "Business document formats" implies Gemini Notebook lacks DOCX/PPTX.
- **Evidence (VE §2.9 + CF §5):** "Microsoft Word (docx), Text (txt), Markdown (md), PDF files (pdf), CSV (csv), and PowerPoint (pptx) files"; "ePub files"; plus Google Docs/Slides/Sheets, web URLs, public YouTube URLs, audio, images, pasted text (no XLSX)
- **New EN:** If you primarily need multi-source synthesis and like Google products, Gemini Notebook is excellent. If you need highlighted citations in the original document, work with Excel files, or want to avoid Google dependency, 

#### `compareNotebooklm.faq.a1`

- **Old EN:** DocTalk and NotebookLM serve different purposes. DocTalk excels at single-document deep analysis with real-time citation highlighting, 7 format support, and 11 languages. NotebookLM is better for multi-source notebooks and offers unique AI-generated audio podcasts. DocTalk is the better choice if you need citation verification and format flexibility; NotebookLM is better for free multi-source research.
- **Problem:** "Unique audio podcasts" and "free" are unsupported; format comparison omits that Gemini Notebook reads more types.
- **Evidence (VE §2.9 + CF §5):** "Is Gemini Notebook the same product as NotebookLM?"; notebooklm.google 301-redirects to notebook.google
- **Evidence (VE §2.9 + CF §5):** "Microsoft Word (docx), Text (txt), Markdown (md), PDF files (pdf), CSV (csv), and PowerPoint (pptx) files"; "ePub files"; plus Google Docs/Slides/Sheets, web URLs, public YouTube URLs, audio, images, pasted text (no XLSX)
- **Evidence (PR §11):** Standard limits table lists "3/day" Audio Overviews
- **Evidence (VE §2.9 + CF §5):** Standard: "100/user" notebooks, "50/notebook" sources ("Usage Limits (Subject to Change)")
- **New EN:** They serve different purposes. DocTalk is built for single-document analysis: clicking a citation highlights the cited passage in your document, and it reads 7 formats including Excel. NotebookLM, now called Gemini Notebook, is better for multi-source notebooks, accepts more source types, and creates Audio Overviews. Choose DocTalk for highlighted citations; choose Gemini Notebook for multi-source research on a free tier.

#### `compareNotebooklm.faq.a2`

- **Old EN:** Yes, Google NotebookLM is currently free to use, though it requires a Google account. Google has not yet announced pricing for future premium features. However, being free means you are subject to Google data practices and potential changes in service terms.
- **Problem:** "Currently free... no pricing announced" is outdated.
- **Evidence (VE §2.9 + CF §5):** "Is Gemini Notebook the same product as NotebookLM?"; notebooklm.google 301-redirects to notebook.google
- **Evidence (VE §2.9 + CF §5):** Standard: "100/user" notebooks, "50/notebook" sources ("Usage Limits (Subject to Change)")
- **Evidence (PR §11):** "you must... verify your age in your Google Account"
- **Evidence (PR §11 + VE §2.9):** "Google AI Plus, Pro and Ultra plans are only available in specific regions."; "Entry price: not shown on Google's Gemini Notebook pages." (EUR only on one.google.com)
- **New EN:** It has a free tier with limits. NotebookLM, now called Gemini Notebook, offers a free Standard tier with 100 notebooks per user and 50 sources per notebook (October 2026), and it requires a Google account. Google sells higher limits through its Google AI Plus, Pro and Ultra plans.

#### `compareNotebooklm.faq.a3`

- **Old EN:** NotebookLM shows inline citations that link to the source document within the notebook. However, it does not provide the real-time visual highlighting that DocTalk offers, where clicking a citation scrolls to and highlights the exact passage in a document viewer alongside the chat.
- **Problem:** Omits the documented jump to the quote in context.
- **Evidence (VE §2.9 + CF §5):** "Is Gemini Notebook the same product as NotebookLM?"; notebooklm.google 301-redirects to notebook.google
- **Evidence (VE §2.9):** "To get the full quoted text, hover over any citation." / "To navigate directly to the quote and review it in context, select a citation." / no page number documented
- **New EN:** Gemini Notebook (formerly NotebookLM) uses direct quotes from your sources as citations: hover to see the full quote, or select it to open the quote in context. Google's help pages do not mention page numbers. DocTalk scrolls to the cited passage in a document viewer next to the chat and highlights it.

#### `compareNotebooklm.faq.a5`

- **Old EN:** DocTalk stores documents with AES-256 encryption, never trains AI on your data, and provides GDPR data export. NotebookLM is a Google product subject to Google privacy policies. DocTalk gives you more control and transparency over your data.
- **Problem:** "DocTalk gives you more control and transparency" is an unverified comparison.
- **Evidence (none):** No statement in VE, CF or PR supports this; removed or marked "Not verified".
- **New EN:** DocTalk stores documents with AES-256 encryption, never trains AI on your data, and provides GDPR data export. Gemini Notebook (formerly NotebookLM) is a Google product, so Google's privacy policy applies; we did not review its data-handling terms for this page.

#### `compareNotebooklm.ctaDescription`

- **Old EN:** No Google account needed. Upload a document and experience citation highlighting instantly.
- **Problem:** DocTalk claim: anonymous visitors cannot upload; the demo uses sample documents.
- **Evidence (CLAUDE.md + .claude/rules/frontend.md):** DocTalk: Free 300 credits/month, Plus $9.99, Pro $19.99; formats PDF/DOCX/PPTX/XLSX/TXT/MD/URL; anonymous use = the sample-document demo only (sign-in required to upload)
- **New EN:** No Google account needed. Open a sample document and see citation highlighting at once.

### `comparePdfai`

#### `comparePdfai.heroDescription`

- **Old EN:** PDF.ai was one of the earlier entrants in the AI PDF chat space, offering a straightforward way to ask questions about PDF files. DocTalk has expanded the concept significantly with seven-format support, real-time citation highlighting, and an 11-language interface. Here is how these two tools compare across features, pricing, and overall capability in 2026.
- **Problem:** "Earlier entrant" history is unsupported.
- **Evidence (CF §3 + PR §5):** Positioning "chat-with-PDF + document parsing API"; "A separate developer API product"
- **Evidence (CLAUDE.md + .claude/rules/frontend.md):** DocTalk: Free 300 credits/month, Plus $9.99, Pro $19.99; formats PDF/DOCX/PPTX/XLSX/TXT/MD/URL; anonymous use = the sample-document demo only (sign-in required to upload)
- **New EN:** PDF.ai is a chat-with-PDF tool that also sells a document-parsing API. DocTalk reads seven formats, highlights the cited passage in the original document, and has an 11-language interface. Here is how the two tools compare on features, pricing and capability, checked against PDF.ai's site in October 2026.

#### `comparePdfai.metaDescription`

- **Old EN:** PDF.ai was one of the earlier entrants in the AI PDF chat space, offering a straightforward way to ask questions about PDF files. DocTalk has expanded the concept significantly with seven-format support, real-time citation highlighting, and an 11-language interface. Here is how these two tools compare across features, pricing, and overall capability in 2026.
- **Problem:** Hero clone, ~360 characters.
- **Evidence (VE §2.11):** "You can only upload PDF (.pdf) files at the moment." (pdf.ai/faq)
- **Evidence (VE §2.11 + CF §3):** Pro "$17 /mo Billed monthly"; "$10 /mo Billed yearly"; Pro = 100 uploads/mo, 1,000 q/mo; Ultimate "$27/user/mo monthly"
- **New EN:** DocTalk vs PDF.ai: file formats, citations, free plans and pricing, checked against PDF.ai's own pricing page and FAQ in October 2026.

#### `comparePdfai.featureInterfaceLanguagesCompetitor`

- **Old EN:** English only
- **Problem:** "English only" is unverified.
- **Evidence (none):** No statement in VE, CF or PR supports this; removed or marked "Not verified".
- **New EN:** Not verified

#### `comparePdfai.featureMultipleAIModesCompetitor`

- **Old EN:** Single model
- **Problem:** "Single model" is unverified for paid tiers.
- **Evidence (PR §5):** "AI model: Basic" (Hobby tier); paid-tier models not stated
- **New EN:** Not verified

#### `comparePdfai.featureFreeTierCompetitor`

- **Old EN:** Limited free queries
- **Problem:** "Limited free queries" is vague; numbers are published.
- **Evidence (VE §2.11):** "Monthly upload limit" = 1; "Monthly questions limit" = 100; "Max file size" 10MB
- **New EN:** 1 PDF, 100 questions/mo

#### `comparePdfai.featureDataEncryptionCompetitor`

- **Old EN:** Standard
- **Problem:** "Standard" is unverified.
- **Evidence (none):** No statement in VE, CF or PR supports this; removed or marked "Not verified".
- **New EN:** Not verified

#### `comparePdfai.whatIsPdfaiDescription`

- **Old EN:** PDF.ai is a web-based tool that lets users upload PDF files and ask questions about their content using AI. Launched during the initial wave of AI document tools in 2023, PDF.ai offers a clean, simple interface focused exclusively on PDF interaction. The tool provides basic question-answering with page number references. PDF.ai attracted early users with its memorable domain name and simple approach. However, development has slowed compared to competitors, and the feature set has not expanded significantly. The tool remains functional for basic PDF Q&A but lacks the advanced features found in newer alternatives.
- **Problem:** "Development has slowed", launch year, "page number references" and "lacks advanced features" are unsupported.
- **Evidence (VE §2.11):** "You can only upload PDF (.pdf) files at the moment." (pdf.ai/faq)
- **Evidence (VE §2.11):** "Sources included / Every response is backed by sources extracted from the uploaded document." (no page number or highlight documented)
- **Evidence (VE §2.11):** "Monthly upload limit" = 1; "Monthly questions limit" = 100; "Max file size" 10MB
- **Evidence (VE §2.11 + CF §3):** Pro "$17 /mo Billed monthly"; "$10 /mo Billed yearly"; Pro = 100 uploads/mo, 1,000 q/mo; Ultimate "$27/user/mo monthly"
- **Evidence (CF §3 + PR §5):** Positioning "chat-with-PDF + document parsing API"; "A separate developer API product"
- **New EN:** PDF.ai is a web tool for chatting with PDF files, and it also sells a separate document-parsing API. Its FAQ says you can only upload PDF files at the moment, and that answers come with cited sources. The free Hobby plan allows 1 upload and 100 questions a month, with a 10 MB file limit. Pro costs $17 per month billed monthly, or $10 per month billed yearly (October 2026).

#### `comparePdfai.documentFormatCompetitor`

- **Old EN:** PDF.ai supports only PDF files, as its name suggests. There is no support for Word documents, spreadsheets, presentations, or web pages. If you need to analyze a non-PDF document, you must convert it to PDF first, which adds friction and can introduce formatting errors.
- **Problem:** Supported, but undated; now cites the FAQ.
- **Evidence (VE §2.11):** "You can only upload PDF (.pdf) files at the moment." (pdf.ai/faq)
- **New EN:** PDF.ai's FAQ says you can only upload PDF files at the moment (checked October 2026). To ask about a Word document, spreadsheet, presentation or web page, you would first convert it to PDF, which adds a step and can introduce formatting errors.

#### `comparePdfai.citationsCompetitor`

- **Old EN:** PDF.ai provides basic Q&A with page number references. The answers are generally competent for straightforward questions. However, the citation system is limited to page numbers without any visual highlighting or precise source identification.
- **Problem:** "Page number references" is not documented; "no precise source identification" is an unverified negative.
- **Evidence (VE §2.11):** "Sources included / Every response is backed by sources extracted from the uploaded document." (no page number or highlight documented)
- **New EN:** PDF.ai says every response is backed by sources extracted from the uploaded document. Its product pages do not say whether answers show page numbers or highlight the cited passage, and we did not test its answers.

#### `comparePdfai.citationsDocTalk`

- **Old EN:** DocTalk provides real-time citation highlighting that represents a significant advancement. Every citation in an AI response is clickable. Clicking it scrolls the document viewer to the exact passage and applies a visual highlight, allowing instant verification. For PDF documents, bounding-box coordinates enable pixel-accurate highlighting. This feature is the core differentiator that makes DocTalk particularly valuable for academic, legal, and professional research. Learn more about
- **Problem:** "Significant advancement" / "core differentiator" compare against an undocumented PDF.ai behaviour.
- **Evidence (VE §2.11):** "Sources included / Every response is backed by sources extracted from the uploaded document." (no page number or highlight documented)
- **New EN:** DocTalk provides real-time citation highlighting. Every citation in an AI response is clickable. Clicking it scrolls the document viewer to the exact passage and applies a visual highlight, so you can check the answer at once. For PDF documents, bounding-box coordinates enable precise highlighting. This is particularly useful for academic, legal, and professional research. Learn more about

#### `comparePdfai.languageSupportCompetitor`

- **Old EN:** PDF.ai has an English-only interface with no localization for other languages. While the AI can process non-English PDFs to some degree, the interface experience is exclusively English.
- **Problem:** "English-only interface" is unverified.
- **Evidence (none):** No statement in VE, CF or PR supports this; removed or marked "Not verified".
- **New EN:** We did not verify which interface languages PDF.ai offers, so this page makes no claim about them.

#### `comparePdfai.pricingCompetitor`

- **Old EN:** PDF.ai offers a limited free tier with a small number of queries per month. Paid plans provide additional capacity. Pricing details have changed over time and may not be consistently listed on their website.
- **Problem:** "Pricing may not be consistently listed" is false: PDF.ai publishes prices.
- **Evidence (VE §2.11):** "Monthly upload limit" = 1; "Monthly questions limit" = 100; "Max file size" 10MB
- **Evidence (VE §2.11 + CF §3):** Pro "$17 /mo Billed monthly"; "$10 /mo Billed yearly"; Pro = 100 uploads/mo, 1,000 q/mo; Ultimate "$27/user/mo monthly"
- **New EN:** PDF.ai publishes its prices. The free Hobby plan allows 1 upload and 100 questions a month (10 MB per file). Pro costs $17 per month billed monthly or $10 per month billed yearly, with 100 uploads and 1,000 questions a month. Ultimate and Enterprise plans cost more (pricing page, October 2026).

#### `comparePdfai.performanceCompetitor`

- **Old EN:** PDF.ai provides standard response times for basic PDF queries. The simple architecture means there is little overhead, though the lack of model options means you cannot optimize for different use cases.
- **Problem:** Speed and "lack of model options" claims are unmeasured.
- **Evidence (PR §5):** "AI model: Basic" (Hobby tier); paid-tier models not stated
- **New EN:** We did not measure PDF.ai's response times. Its pricing table lists a 'Basic' AI model for the free plan.

#### `comparePdfai.securityCompetitor`

- **Old EN:** PDF.ai offers basic security measures for uploaded documents. Detailed security documentation is limited, making it difficult to assess the exact protections in place.
- **Problem:** "Basic security measures ... documentation is limited" is unverified.
- **Evidence (none):** No statement in VE, CF or PR supports this; removed or marked "Not verified".
- **New EN:** We did not review PDF.ai's security documentation for this comparison. Read its privacy policy before you upload sensitive files.

#### `comparePdfai.whoDocTalk4`

- **Old EN:** Users who want an actively developed tool with regular improvements
- **Problem:** "Actively developed tool" insinuates PDF.ai is not (unverified).
- **Evidence (none):** No statement in VE, CF or PR supports this; removed or marked "Not verified".
- **New EN:** Users who want to try the product in a demo before creating an account

#### `comparePdfai.whoDocTalk5`

- **Old EN:** Anyone who values transparent pricing and security documentation
- **Problem:** Insinuates PDF.ai lacks transparent pricing; it publishes prices.
- **Evidence (VE §2.11 + CF §3):** Pro "$17 /mo Billed monthly"; "$10 /mo Billed yearly"; Pro = 100 uploads/mo, 1,000 q/mo; Ultimate "$27/user/mo monthly"
- **New EN:** Anyone who wants to choose between a faster and a deeper answer mode for each question

#### `comparePdfai.whoPdfai1`

- **Old EN:** Users who only work with PDFs and need the most basic chat functionality
- **Problem:** "Most basic chat functionality" is unsupported.
- **Evidence (VE §2.11):** "You can only upload PDF (.pdf) files at the moment." (pdf.ai/faq)
- **New EN:** Users who only work with PDF files

#### `comparePdfai.whoPdfai2`

- **Old EN:** People who prefer the simplest possible interface with no learning curve
- **Problem:** "Simplest possible interface with no learning curve" is unsupported.
- **Evidence (CF §3 + PR §5):** Positioning "chat-with-PDF + document parsing API"; "A separate developer API product"
- **New EN:** Developers who also want a document-parsing API from the same vendor

#### `comparePdfai.whoPdfai3`

- **Old EN:** Casual users with very occasional PDF question needs
- **Problem:** Vague; the free limits are published.
- **Evidence (VE §2.11):** "Monthly upload limit" = 1; "Monthly questions limit" = 100; "Max file size" 10MB
- **New EN:** Casual users whose needs fit the free plan: 1 upload and 100 questions a month

#### `comparePdfai.verdictParagraph1`

- **Old EN:** PDF.ai pioneered a simple approach to AI PDF chat but has not kept pace with the evolving market. The tool remains functional for basic PDF questions, but the lack of citation highlighting, multi-format support, and multilingual capabilities leaves it behind newer alternatives.
- **Problem:** "Has not kept pace" and "lack of citation highlighting, multilingual" are unverified negatives.
- **Evidence (VE §2.11):** "You can only upload PDF (.pdf) files at the moment." (pdf.ai/faq)
- **Evidence (VE §2.11):** "Sources included / Every response is backed by sources extracted from the uploaded document." (no page number or highlight documented)
- **Evidence (VE §2.11 + CF §3):** Pro "$17 /mo Billed monthly"; "$10 /mo Billed yearly"; Pro = 100 uploads/mo, 1,000 q/mo; Ultimate "$27/user/mo monthly"
- **Evidence (CF §3 + PR §5):** Positioning "chat-with-PDF + document parsing API"; "A separate developer API product"
- **New EN:** PDF.ai is a focused tool for chatting with PDF files, with published prices and a separate parsing API for developers. Its FAQ says it accepts only PDF files, and its product pages describe answers 'backed by sources' without saying whether passages are highlighted.

#### `comparePdfai.verdictParagraph2`

- **Old EN:** DocTalk offers substantially more value at every level. Seven-format support eliminates conversion headaches. Real-time citation highlighting provides answer verification that PDF.ai simply does not have. Eleven interface languages make it globally accessible. Active development means the tool continues to improve.
- **Problem:** "Simply does not have", "active development" are unverified negatives.
- **Evidence (VE §2.11):** "You can only upload PDF (.pdf) files at the moment." (pdf.ai/faq)
- **Evidence (VE §2.11 + CF §3):** Pro "$17 /mo Billed monthly"; "$10 /mo Billed yearly"; Pro = 100 uploads/mo, 1,000 q/mo; Ultimate "$27/user/mo monthly"
- **Evidence (CLAUDE.md + .claude/rules/frontend.md):** DocTalk: Free 300 credits/month, Plus $9.99, Pro $19.99; formats PDF/DOCX/PPTX/XLSX/TXT/MD/URL; anonymous use = the sample-document demo only (sign-in required to upload)
- **New EN:** DocTalk reads seven formats, so Word, PowerPoint and Excel files need no conversion. Clicking a citation highlights the cited passage in your document. The interface is available in 11 languages. Plus costs $9.99 per month, compared with $17 per month for PDF.ai Pro billed monthly ($10 per month billed yearly).

#### `comparePdfai.verdictParagraph3`

- **Old EN:** For virtually all use cases, DocTalk is the better choice over PDF.ai in 2026.
- **Problem:** "For virtually all use cases" is unsupported.
- **Evidence (VE §2.11):** "You can only upload PDF (.pdf) files at the moment." (pdf.ai/faq)
- **New EN:** If you work only with PDF files, both tools can answer your questions. If you also use other formats or want highlighted citations, DocTalk is the better fit.

#### `comparePdfai.faq1Answer`

- **Old EN:** PDF.ai continues to operate, but it has seen less development and growth compared to competitors. The tool focuses on basic PDF chat functionality without the advanced features that newer tools like DocTalk offer, such as citation highlighting and multi-format support.
- **Problem:** "Less development and growth" is an unverified negative.
- **Evidence (VE §2.11 + CF §3):** Pro "$17 /mo Billed monthly"; "$10 /mo Billed yearly"; Pro = 100 uploads/mo, 1,000 q/mo; Ultimate "$27/user/mo monthly"
- **Evidence (CF §3 + PR §5):** Positioning "chat-with-PDF + document parsing API"; "A separate developer API product"
- **New EN:** Yes. In October 2026 PDF.ai's site listed a free Hobby plan and paid Pro, Ultimate and Enterprise plans, and it also offers a document-parsing API for developers.

#### `comparePdfai.faq3Answer`

- **Old EN:** DocTalk has significantly better citation support with real-time visual highlighting. When you click a citation, the document viewer scrolls to and highlights the exact source passage. PDF.ai provides basic page references without inline highlighting.
- **Problem:** "PDF.ai provides basic page references" is not documented.
- **Evidence (VE §2.11):** "Sources included / Every response is backed by sources extracted from the uploaded document." (no page number or highlight documented)
- **New EN:** DocTalk scrolls the document viewer to the cited passage and highlights it when you click a citation. PDF.ai says every response is backed by sources from your document; its product pages do not say whether page numbers are shown or passages highlighted.

#### `comparePdfai.faq4Answer`

- **Old EN:** DocTalk offers a free demo with no signup and a free tier with 300 credits per month. Paid plans start at $9.99/month. PDF.ai pricing varies, but DocTalk generally provides more features per dollar, including citation highlighting, 7 format support, and 11 languages.
- **Problem:** "PDF.ai pricing varies" is false; prices are published.
- **Evidence (VE §2.11):** "Monthly upload limit" = 1; "Monthly questions limit" = 100; "Max file size" 10MB
- **Evidence (VE §2.11 + CF §3):** Pro "$17 /mo Billed monthly"; "$10 /mo Billed yearly"; Pro = 100 uploads/mo, 1,000 q/mo; Ultimate "$27/user/mo monthly"
- **Evidence (CLAUDE.md + .claude/rules/frontend.md):** DocTalk: Free 300 credits/month, Plus $9.99, Pro $19.99; formats PDF/DOCX/PPTX/XLSX/TXT/MD/URL; anonymous use = the sample-document demo only (sign-in required to upload)
- **New EN:** No. DocTalk offers a free demo with no signup and a free tier with 300 credits per month, and paid plans start at $9.99/month. PDF.ai's free plan allows 1 upload and 100 questions a month, and its Pro plan costs $17/month billed monthly or $10/month billed yearly (October 2026).

#### `comparePdfai.ctaDescription`

- **Old EN:** Upload a document and see the difference. Citation highlighting, 7 formats, 11 languages.
- **Problem:** DocTalk claim: anonymous visitors cannot upload.
- **Evidence (CLAUDE.md + .claude/rules/frontend.md):** DocTalk: Free 300 credits/month, Plus $9.99, Pro $19.99; formats PDF/DOCX/PPTX/XLSX/TXT/MD/URL; anonymous use = the sample-document demo only (sign-in required to upload)
- **New EN:** Open a sample document and see the difference. Citation highlighting, 7 formats, 11 languages.

### `compareAskyourpdf`

#### `compareAskyourpdf.featureSupportedFormatsCompetitor`

- **Old EN:** PDF primary + some extras
- **Problem:** "PDF primary + some extras" understates the documented list.
- **Evidence (VE §2.6):** "Drag a PDF, DOCX, EPUB, or TXT file into the AskYourPDF chat reader, or paste a URL."
- **New EN:** PDF, DOCX, EPUB, TXT, URL

#### `compareAskyourpdf.featureInterfaceLanguagesCompetitor`

- **Old EN:** English primary
- **Problem:** "English primary" is unverified.
- **Evidence (none):** No statement in VE, CF or PR supports this; removed or marked "Not verified".
- **New EN:** Not verified

#### `compareAskyourpdf.featureMultipleAIModesCompetitor`

- **Old EN:** Single model
- **Problem:** "Single model" is contradicted: paid plans include premium-model credits.
- **Evidence (PR §3):** Free model "GPT-5 Mini"; Premium/Pro include "10"/"30 Free Credits" toward premium models
- **New EN:** Varies by plan

#### `compareAskyourpdf.featureFreeTierCompetitor`

- **Old EN:** Limited free questions
- **Problem:** Vague; the free limits are published.
- **Evidence (VE §2.6):** "1 documents per day"; "100 pages per document"; "Max upload size: 15MB"; "50 questions per day"
- **New EN:** 1 doc/day, 50 questions/day

#### `compareAskyourpdf.whatIsAskyourpdfDescription`

- **Old EN:** AskYourPDF is an AI-powered document analysis tool that has built a comprehensive ecosystem around PDF interaction. It offers a Chrome extension for analyzing PDFs directly in your browser, a Zotero plugin for academic researchers, and an API for developers to integrate document analysis into their own applications. AskYourPDF started as a ChatGPT plugin and has expanded into a standalone web platform. The tool focuses on the research workflow, with features like reference extraction and citation management. Its broader integration approach makes it popular among power users who want to embed document AI into their existing workflows.
- **Problem:** "Reference extraction and citation management" is search-only; "started as a ChatGPT plugin" is not a vendor statement.
- **Evidence (VE §2.6):** "Web, iOS, Android, Chrome extension, ChatGPT GPT, and the Zotero plugin"
- **Evidence (VE §2.6):** API docs (docs.askyourpdf.com): response schema includes "page_number"
- **Evidence (VE §2.6):** "Drag a PDF, DOCX, EPUB, or TXT file into the AskYourPDF chat reader, or paste a URL."
- **Evidence (VE §2.6):** "We return your answer with a citation back to the exact page in the original PDF. Click the citation to verify." (highlighting not stated)
- **Evidence (VE §2.6):** "the homepage now leads with a website chatbot product ... The PDF chat lives at /chat-with-pdf."
- **New EN:** AskYourPDF is an AI document chat tool with a wide set of integrations. According to its site (October 2026), it runs on the web, iOS and Android, as a Chrome extension, as a ChatGPT GPT and as a Zotero plugin, and it offers an API for developers. Its chat reader accepts PDF, DOCX, EPUB and TXT files or a pasted URL, and each answer cites the exact page, which you can click to verify. Its homepage now leads with a separate website-chatbot product; PDF chat has its own page.

#### `compareAskyourpdf.documentFormatCompetitor`

- **Old EN:** AskYourPDF was originally built for PDF files and has since added some support for other formats through its plugin ecosystem. However, its core experience and parsing quality are strongest with PDFs. The tool can handle scanned PDFs through OCR capabilities.
- **Problem:** "Strongest with PDFs" and OCR claims are unsupported; format list is incomplete.
- **Evidence (VE §2.6):** "Drag a PDF, DOCX, EPUB, or TXT file into the AskYourPDF chat reader, or paste a URL."
- **Evidence (VE §3):** "The chat page lists no PPT/PPTX." (no XLSX listed either)
- **New EN:** AskYourPDF's chat reader accepts PDF, DOCX, EPUB and TXT files, and you can also paste a URL (checked October 2026). It does not list PowerPoint or Excel files for PDF chat.

#### `compareAskyourpdf.citationsCompetitor`

- **Old EN:** AskYourPDF references page numbers and can extract citations for academic papers, which is particularly useful for researchers building bibliographies. The tool provides competent answers for most document types, with particular strength in academic content.
- **Problem:** "Extract citations for bibliographies" is search-only; the documented click-to-verify is missing.
- **Evidence (VE §2.6):** "We return your answer with a citation back to the exact page in the original PDF. Click the citation to verify." (highlighting not stated)
- **New EN:** AskYourPDF says it returns each answer 'with a citation back to the exact page in the original PDF', and that you can click the citation to verify it. Its site does not say whether the cited passage is highlighted.

#### `compareAskyourpdf.citationsDocTalk`

- **Old EN:** DocTalk goes further with real-time citation highlighting. Every citation in an AI answer is clickable: click it and the document viewer scrolls to the exact passage with a visual highlight. This instant verification means you never need to manually search for the source of an answer. For academic and legal work, where every claim must be traceable, this feature saves significant time. Learn more about
- **Problem:** "You never need to manually search" contrasts with an AskYourPDF behaviour that is not documented.
- **Evidence (VE §2.6):** "We return your answer with a citation back to the exact page in the original PDF. Click the citation to verify." (highlighting not stated)
- **New EN:** DocTalk also makes every citation clickable: click it and the document viewer scrolls to the exact passage and highlights it. For academic and legal work, where every claim must be traceable, this saves time. Learn more about

#### `compareAskyourpdf.languageSupportCompetitor`

- **Old EN:** AskYourPDF has a primarily English interface. While the underlying AI can process documents in other languages, the user interface, documentation, and integrations are English-only. This limits its appeal for non-English-speaking users.
- **Problem:** "Primarily English ... integrations English-only" is unverified.
- **Evidence (none):** No statement in VE, CF or PR supports this; removed or marked "Not verified".
- **New EN:** We did not verify which interface languages AskYourPDF offers, so this page makes no claim about them.

#### `compareAskyourpdf.pricingCompetitor`

- **Old EN:** AskYourPDF offers a limited free tier and a Premium plan starting at $14.99 per month that includes the Chrome extension, unlimited documents, and priority processing. An Enterprise plan is available for teams. The API usage is charged separately based on volume.
- **Problem:** "Premium starting at $14.99" is wrong ($14.99 is Pro); "API charged separately" unsupported.
- **Evidence (VE §2.6):** "1 documents per day"; "100 pages per document"; "Max upload size: 15MB"; "50 questions per day"
- **Evidence (VE §2.6 + PR §3):** Premium "$11.99 per month billed yearly"; Pro "$14.99 per month billed yearly"; monthly-billed price "not shown"; Enterprise "Custom"
- **New EN:** AskYourPDF's free plan allows 1 document a day, 100 pages per document, 15 MB per file and 50 questions a day. Premium costs $11.99 per month and Pro $14.99 per month, both billed yearly; its pricing page does not show a monthly-billed price. An Enterprise plan has custom pricing (October 2026).

#### `compareAskyourpdf.performanceCompetitor`

- **Old EN:** AskYourPDF provides good response times for most queries. The Chrome extension enables in-browser analysis without needing to upload files separately. Processing large documents may take longer depending on the complexity of the queries.
- **Problem:** Speed claims are unmeasured; "without uploading separately" unsupported.
- **Evidence (VE §2.6):** "Web, iOS, Android, Chrome extension, ChatGPT GPT, and the Zotero plugin"
- **New EN:** We did not measure AskYourPDF's response times. Its Chrome extension and mobile apps let you use it outside the web app.

#### `compareAskyourpdf.securityCompetitor`

- **Old EN:** AskYourPDF processes documents on its servers and provides standard security measures. The Chrome extension requires browser permissions to function, which some security-conscious users may want to evaluate carefully.
- **Problem:** "Standard security measures" is unverified.
- **Evidence (none):** No statement in VE, CF or PR supports this; removed or marked "Not verified".
- **New EN:** We did not review AskYourPDF's security documentation for this comparison. If you install its Chrome extension, check the browser permissions it asks for.

#### `compareAskyourpdf.whoDocTalk2`

- **Old EN:** People who work with multiple document formats (Word, PowerPoint, Excel, web pages)
- **Problem:** Lists Word and web pages as DocTalk-only; AskYourPDF reads DOCX and URLs.
- **Evidence (VE §2.6):** "Drag a PDF, DOCX, EPUB, or TXT file into the AskYourPDF chat reader, or paste a URL."
- **New EN:** People who work with PowerPoint or Excel files as well as PDF and Word

#### `compareAskyourpdf.verdictParagraph1`

- **Old EN:** AskYourPDF has built an impressive ecosystem of integrations that makes it powerful for researchers and developers who want to embed document AI into their workflows. The Chrome extension and Zotero plugin are genuine differentiators that no other tool in this space matches.
- **Problem:** "No other tool in this space matches" is an unverified negative about all other tools.
- **Evidence (VE §2.6):** "Web, iOS, Android, Chrome extension, ChatGPT GPT, and the Zotero plugin"
- **Evidence (VE §2.6):** API docs (docs.askyourpdf.com): response schema includes "page_number"
- **New EN:** AskYourPDF has built a wide ecosystem of integrations that makes it powerful for researchers and developers who want to embed document AI into their workflows: a Chrome extension, a Zotero plugin, mobile apps, a ChatGPT GPT and an API.

#### `compareAskyourpdf.verdictParagraph2`

- **Old EN:** DocTalk takes a different approach: a focused, polished experience with citation highlighting that sets a new standard for answer verification. If your priority is getting accurate, traceable answers from mixed document formats with a simple interface, DocTalk is the stronger choice.
- **Problem:** "Sets a new standard" is unsupported; "mixed formats" ignores AskYourPDF DOCX/URL support.
- **Evidence (VE §2.6):** "Drag a PDF, DOCX, EPUB, or TXT file into the AskYourPDF chat reader, or paste a URL."
- **New EN:** DocTalk takes a different approach: one web app that highlights the cited passage in your document and reads PowerPoint and Excel files as well as PDF and Word. If your priority is traceable answers from mixed document formats, DocTalk is the better fit.

#### `compareAskyourpdf.verdictParagraph3`

- **Old EN:** For most document Q&A use cases, DocTalk offers the better balance of features, simplicity, and affordability. Power users with specific integration needs should evaluate AskYourPDF. The best way to compare is to
- **Problem:** "Better balance of ... affordability" rested on the wrong $14.99 Premium price.
- **Evidence (VE §2.6 + PR §3):** Premium "$11.99 per month billed yearly"; Pro "$14.99 per month billed yearly"; monthly-billed price "not shown"; Enterprise "Custom"
- **New EN:** If you need integrations with Zotero, Chrome or your own code, evaluate AskYourPDF. If you need highlighted citations across more formats, DocTalk fits better. The best way to compare is to

#### `compareAskyourpdf.faq1Answer`

- **Old EN:** It depends on your needs. DocTalk offers a cleaner, simpler interface with real-time citation highlighting and 7 document formats. AskYourPDF offers more integrations including a Chrome extension, Zotero plugin, and API access. If you value simplicity and citation verification, DocTalk is the better choice. If you need browser integrations or API access, AskYourPDF has the edge.
- **Problem:** "Cleaner, simpler interface" is unsupported; the format comparison is incomplete.
- **Evidence (VE §2.6):** "Web, iOS, Android, Chrome extension, ChatGPT GPT, and the Zotero plugin"
- **Evidence (VE §2.6):** "Drag a PDF, DOCX, EPUB, or TXT file into the AskYourPDF chat reader, or paste a URL."
- **New EN:** It depends on your needs. DocTalk highlights the cited passage in your document and reads 7 formats, including PowerPoint and Excel. AskYourPDF offers more integrations, including a Chrome extension, a Zotero plugin, mobile apps and API access. If you value citation highlighting and format coverage, DocTalk is the better choice. If you need browser integrations or API access, AskYourPDF has the edge.

#### `compareAskyourpdf.faq2Answer`

- **Old EN:** AskYourPDF provides page references in its answers, similar to ChatPDF. However, it does not offer the real-time inline citation highlighting that DocTalk provides, where clicking a citation scrolls to and visually highlights the exact passage in your document.
- **Problem:** "Does not offer" highlighting is an unverified negative; click-to-verify omitted.
- **Evidence (VE §2.6):** "We return your answer with a citation back to the exact page in the original PDF. Click the citation to verify." (highlighting not stated)
- **New EN:** AskYourPDF says each answer cites the exact page in the original PDF, and you can click the citation to verify it. Its site does not say whether the cited passage is highlighted. DocTalk scrolls to the cited passage and highlights it in your document when you click a citation.

#### `compareAskyourpdf.faq3Answer`

- **Old EN:** DocTalk is generally simpler to use with its clean, focused interface. AskYourPDF has more features and integrations, which can make it more complex to navigate. DocTalk also offers an instant demo with no signup required, making it the easiest to try.
- **Problem:** "Making it the easiest to try" and "more complex to navigate" are unsupported.
- **Evidence (PR §3):** "whether an anonymous upload actually completes is `not visible without signup`"
- **New EN:** DocTalk is one web app with a focused interface, and its demo needs no signup. AskYourPDF offers more apps and integrations, so there is more to choose from. Try both on a short document to see which suits you.

#### `compareAskyourpdf.faq4Answer`

- **Old EN:** AskYourPDF primarily focuses on PDF files, though it has added some support for other formats through its plugin ecosystem. DocTalk natively supports 7 formats (PDF, DOCX, PPTX, XLSX, TXT, MD, URL) with dedicated parsers for each format.
- **Problem:** "Primarily focuses on PDF ... plugin ecosystem" is outdated.
- **Evidence (VE §2.6):** "Drag a PDF, DOCX, EPUB, or TXT file into the AskYourPDF chat reader, or paste a URL."
- **New EN:** Yes. AskYourPDF's chat reader accepts PDF, DOCX, EPUB and TXT files, and you can paste a URL (October 2026). DocTalk reads 7 formats (PDF, DOCX, PPTX, XLSX, TXT, MD, URL) with a dedicated parser for each, including PowerPoint and Excel.

#### `compareAskyourpdf.ctaDescription`

- **Old EN:** See how citation highlighting compares to page references. Upload a document and try it now.
- **Problem:** DocTalk claim: anonymous visitors cannot upload.
- **Evidence (CLAUDE.md + .claude/rules/frontend.md):** DocTalk: Free 300 credits/month, Plus $9.99, Pro $19.99; formats PDF/DOCX/PPTX/XLSX/TXT/MD/URL; anonymous use = the sample-document demo only (sign-in required to upload)
- **New EN:** See how citation highlighting compares to page references. Open a sample document and try it now.

### `compareHumata`

#### `compareHumata.heroDescription`

- **Old EN:** Humata and DocTalk both offer AI-powered document analysis, but they target different audiences. Humata focuses on team collaboration and offers unique video file support, while DocTalk provides real-time citation highlighting, seven document formats, and a fully multilingual interface, with credits charged per question rather than per page. Here is how they stack up across every important dimension.
- **Problem:** "Unique video file support" has no evidence.
- **Evidence (CF §4 + VE §2.10):** Free 60 pages/mo; Expert $9.99/mo (3 users, 500 pages, $0.02/extra page); Team $49/user/mo (10 users, 5,000 pages, $0.01/extra page, OCR, dept/folder permissions); Enterprise custom
- **Evidence (VE §2.10):** "Formats: not stated on the homepage, pricing page or docs pages checked." (no video, Word or other format evidence in VE, CF or PR)
- **New EN:** Humata and DocTalk both offer AI-powered document analysis, but they target different audiences. Humata offers team plans for up to 10 users and meters usage by pages, while DocTalk highlights the cited passage in your document, reads seven formats, and charges credits per question rather than per page. Here is how they stack up, checked against Humata's site in October 2026.

#### `compareHumata.metaDescription`

- **Old EN:** Humata and DocTalk both offer AI-powered document analysis, but they target different audiences. Humata focuses on team collaboration and offers unique video file support, while DocTalk provides real-time citation highlighting, seven document formats, and a fully multilingual interface, with credits charged per question rather than per page. Here is how they stack up across every important dimension.
- **Problem:** Video claim; ~390 characters.
- **Evidence (CF §4 + VE §2.10):** Free 60 pages/mo; Expert $9.99/mo (3 users, 500 pages, $0.02/extra page); Team $49/user/mo (10 users, 5,000 pages, $0.01/extra page, OCR, dept/folder permissions); Enterprise custom
- **New EN:** DocTalk vs Humata: citations, team plans, per-page vs per-question pricing and free tiers, checked against Humata's site in October 2026.

#### `compareHumata.featureSupportedFormatsCompetitor`

- **Old EN:** PDF, Word, video files
- **Problem:** "PDF, Word, video files" has no evidence; only PDF is stated.
- **Evidence (VE §2.10):** "Formats: not stated on the homepage, pricing page or docs pages checked." (no video, Word or other format evidence in VE, CF or PR)
- **Evidence (PR §4):** "No credit card required. Try our PDF AI by chatting for free."
- **New EN:** PDF (others not listed)

#### `compareHumata.featureInterfaceLanguagesCompetitor`

- **Old EN:** English only
- **Problem:** "English only" is unverified.
- **Evidence (none):** No statement in VE, CF or PR supports this; removed or marked "Not verified".
- **New EN:** Not verified

#### `compareHumata.featureMultipleAIModesCompetitor`

- **Old EN:** Single model
- **Problem:** "Single model" is unverified.
- **Evidence (none):** No statement in VE, CF or PR supports this; removed or marked "Not verified".
- **New EN:** Not verified

#### `compareHumata.whatIsHumataDescription`

- **Old EN:** Humata is an AI document analysis platform launched in 2023 that has expanded from PDF analysis into a broader content tool. It supports PDF and Word documents, and notably also supports video file analysis. Humata offers a free tier with 60 pages per month, an Expert plan at $9.99/month (500 pages, up to 3 users), and a Team plan at $49/user/month (5,000 pages, up to 10 users) with collaboration features. The team collaboration functionality, including shared workspaces and role management, sets it apart from individual-focused tools. Humata positions itself as a tool for students, researchers, and professional teams working with dense documents.
- **Problem:** Launch year, Word/video support, "shared workspaces and role management" and audience are unsupported.
- **Evidence (PR §4):** Homepage title "Humata: AI meets your knowledge base"
- **Evidence (VE §2.10):** "Highlights citations" (heading) / "Build trust with cited links into your source files." / "Each answer Humata generates will cite relevant sections..."; page number only in API docs
- **Evidence (CF §4 + VE §2.10):** Free 60 pages/mo; Expert $9.99/mo (3 users, 500 pages, $0.02/extra page); Team $49/user/mo (10 users, 5,000 pages, $0.01/extra page, OCR, dept/folder permissions); Enterprise custom
- **Evidence (VE §2.10):** "Formats: not stated on the homepage, pricing page or docs pages checked." (no video, Word or other format evidence in VE, CF or PR)
- **New EN:** Humata is an AI document analysis platform ('AI meets your knowledge base'). Each answer cites relevant sections of your uploaded documents, and its homepage lists 'Highlights citations' as a feature. Humata offers a free tier with 60 pages per month, an Expert plan at $9.99/month (500 pages, up to 3 users), and a Team plan at $49/user/month (5,000 pages, up to 10 users) with OCR and department and folder permissions (October 2026). Its homepage, pricing page and docs do not list supported file types.

#### `compareHumata.documentFormatCompetitor`

- **Old EN:** Humata supports PDF, Word documents, and video files. The video support is a unique differentiator that no other tool in this comparison category offers. However, Humata does not support PowerPoint, Excel, or web URL ingestion, which limits its usefulness for business analysts working with spreadsheets or presentations.
- **Problem:** Word/video support and "does not support PowerPoint, Excel, URL" are both unverified.
- **Evidence (VE §2.10):** "Formats: not stated on the homepage, pricing page or docs pages checked." (no video, Word or other format evidence in VE, CF or PR)
- **Evidence (PR §4):** "No credit card required. Try our PDF AI by chatting for free."
- **New EN:** Humata's homepage, pricing page and docs pages (checked October 2026) do not list the file types it accepts, beyond describing itself as a PDF AI. We could not confirm support for Word, PowerPoint, Excel, video or web URLs, so check Humata's site for your file type.

#### `compareHumata.documentFormatDocTalk`

- **Old EN:** DocTalk supports seven formats: PDF, DOCX, PPTX, XLSX, TXT, Markdown, and web URLs. Each format has a dedicated parser that preserves structure. The XLSX parser maintains spreadsheet cell relationships, the PPTX parser preserves slide order and speaker notes, and the URL ingester extracts clean article content from web pages. While DocTalk does not support video, it covers the broadest range of common document formats. See
- **Problem:** "Broadest range of common document formats" is false (Gemini Notebook lists more).
- **Evidence (VE §2.9 + CF §5):** "Microsoft Word (docx), Text (txt), Markdown (md), PDF files (pdf), CSV (csv), and PowerPoint (pptx) files"; "ePub files"; plus Google Docs/Slides/Sheets, web URLs, public YouTube URLs, audio, images, pasted text (no XLSX)
- **New EN:** DocTalk supports seven formats: PDF, DOCX, PPTX, XLSX, TXT, Markdown, and web URLs. Each format has a dedicated parser that preserves structure. The XLSX parser maintains spreadsheet cell relationships, the PPTX parser preserves slide order and speaker notes, and the URL ingester extracts clean article content from web pages. DocTalk does not support video or audio files. See

#### `compareHumata.citationsCompetitor`

- **Old EN:** Humata provides page number references in its answers. The AI generates competent responses for most document types, with a clean interface for viewing answers. The focus on team collaboration means that answers can be shared and discussed within a workspace.
- **Problem:** "Page number references" is not documented for the app; Humata claims highlighting.
- **Evidence (VE §2.10):** "Highlights citations" (heading) / "Build trust with cited links into your source files." / "Each answer Humata generates will cite relevant sections..."; page number only in API docs
- **New EN:** Humata says each answer cites relevant sections from your uploaded documents, with 'cited links into your source files', and its homepage lists 'Highlights citations' as a feature. It does not say what is highlighted or whether page numbers are shown in the app; a page number appears only in its API documentation.

#### `compareHumata.languageSupportCompetitor`

- **Old EN:** Humata has an English-only interface. While the AI can process documents in other languages, the entire application experience is in English. This is a notable limitation for international teams or non-English-speaking individuals.
- **Problem:** "English-only interface" is unverified.
- **Evidence (none):** No statement in VE, CF or PR supports this; removed or marked "Not verified".
- **New EN:** We did not verify which interface languages Humata offers, so this page makes no claim about them.

#### `compareHumata.performanceCompetitor`

- **Old EN:** Humata provides reasonable response times for most queries. Video processing takes longer due to the complexity of transcription and analysis. The tool handles long documents well, though very large files may require higher-tier plans.
- **Problem:** Speed and video-processing claims are unmeasured/unsupported.
- **Evidence (CF §4 + VE §2.10):** Free 60 pages/mo; Expert $9.99/mo (3 users, 500 pages, $0.02/extra page); Team $49/user/mo (10 users, 5,000 pages, $0.01/extra page, OCR, dept/folder permissions); Enterprise custom
- **New EN:** We did not measure Humata's response times. Long documents use more of its monthly page allowance: 60 pages on Free, 500 on Expert and 5,000 on Team, then $0.02 or $0.01 per extra page.

#### `compareHumata.securityCompetitor`

- **Old EN:** Humata emphasizes security for its team features, with role-based access control on Team plans. Documents are stored securely, and the platform is SOC 2 compliant according to their marketing materials. Enterprise plans include additional security features.
- **Problem:** "SOC 2 compliant" and "role-based access control" are not in the evidence.
- **Evidence (CF §4 + VE §2.10):** Free 60 pages/mo; Expert $9.99/mo (3 users, 500 pages, $0.02/extra page); Team $49/user/mo (10 users, 5,000 pages, $0.01/extra page, OCR, dept/folder permissions); Enterprise custom
- **New EN:** Humata's Team plan adds department and folder permissions, and Enterprise pricing is custom. We did not review its security documentation or certifications for this comparison.

#### `compareHumata.whoHumata1`

- **Old EN:** Teams that need shared workspaces and collaborative document analysis
- **Problem:** "Shared workspaces" is not in the evidence.
- **Evidence (CF §4 + VE §2.10):** Free 60 pages/mo; Expert $9.99/mo (3 users, 500 pages, $0.02/extra page); Team $49/user/mo (10 users, 5,000 pages, $0.01/extra page, OCR, dept/folder permissions); Enterprise custom
- **New EN:** Teams of up to 10 users who want one plan with department and folder permissions

#### `compareHumata.whoHumata2`

- **Old EN:** Users who need to analyze video content alongside documents
- **Problem:** Video analysis has no evidence.
- **Evidence (VE §2.10):** "Formats: not stated on the homepage, pricing page or docs pages checked." (no video, Word or other format evidence in VE, CF or PR)
- **Evidence (CF §4 + VE §2.10):** Free 60 pages/mo; Expert $9.99/mo (3 users, 500 pages, $0.02/extra page); Team $49/user/mo (10 users, 5,000 pages, $0.01/extra page, OCR, dept/folder permissions); Enterprise custom
- **New EN:** Small teams that want page-based billing with low overage rates ($0.01 to $0.02 per extra page)

#### `compareHumata.whoHumata4`

- **Old EN:** Enterprise organizations that need SOC 2 compliance and role-based access control
- **Problem:** "SOC 2 compliance and role-based access control" are not in the evidence.
- **Evidence (CF §4 + VE §2.10):** Free 60 pages/mo; Expert $9.99/mo (3 users, 500 pages, $0.02/extra page); Team $49/user/mo (10 users, 5,000 pages, $0.01/extra page, OCR, dept/folder permissions); Enterprise custom
- **New EN:** Larger organizations that need a custom Enterprise plan

#### `compareHumata.verdictParagraph1`

- **Old EN:** Humata has carved out a niche with team collaboration features and video support. For organizations that need shared document analysis with role management, the Team plan provides genuine value. The Expert plan at $9.99/month covers up to three users and 500 pages a month, with extra pages at $0.02 each.
- **Problem:** Video support and "role management" are not in the evidence.
- **Evidence (CF §4 + VE §2.10):** Free 60 pages/mo; Expert $9.99/mo (3 users, 500 pages, $0.02/extra page); Team $49/user/mo (10 users, 5,000 pages, $0.01/extra page, OCR, dept/folder permissions); Enterprise custom
- **New EN:** Humata has carved out a niche with team plans. For organizations that need shared document analysis with department and folder permissions, the Team plan ($49/user/month, up to 10 users) provides genuine value. The Expert plan at $9.99/month covers up to three users and 500 pages a month, with extra pages at $0.02 each.

#### `compareHumata.verdictParagraph2`

- **Old EN:** DocTalk offers superior citation highlighting, broader format support (seven formats vs three), 11-language localization, and better value for individual users. The credit-based pricing is more predictable than page-based pricing, and the no-signup demo makes it the easiest to try.
- **Problem:** "Superior citation highlighting" and "seven formats vs three" are unverified.
- **Evidence (VE §2.10):** "Formats: not stated on the homepage, pricing page or docs pages checked." (no video, Word or other format evidence in VE, CF or PR)
- **Evidence (VE §2.10):** "Highlights citations" (heading) / "Build trust with cited links into your source files." / "Each answer Humata generates will cite relevant sections..."; page number only in API docs
- **New EN:** DocTalk highlights the cited passage in your document, lists seven supported formats, has an 11-language interface, and charges per question rather than per page, which suits individuals with long documents. Its no-signup demo lets you try it before creating an account.

#### `compareHumata.verdictParagraph3`

- **Old EN:** For individual users, researchers, and professionals, DocTalk is the stronger choice due to citation highlighting, format flexibility, and multilingual support. For teams needing collaboration features,
- **Problem:** "Stronger choice due to ... format flexibility, multilingual" rests on unverified claims.
- **Evidence (none):** No statement in VE, CF or PR supports this; removed or marked "Not verified".
- **New EN:** For individual users with long documents, DocTalk's per-question credits are easier to predict. For teams needing collaboration features,

#### `compareHumata.faq2Answer`

- **Old EN:** Humata provides page references in its answers but does not offer real-time inline citation highlighting. DocTalk lets you click any citation to instantly scroll to and highlight the exact passage in your document viewer.
- **Problem:** "Does not offer real-time inline citation highlighting" contradicts Humata's "Highlights citations" heading.
- **Evidence (VE §2.10):** "Highlights citations" (heading) / "Build trust with cited links into your source files." / "Each answer Humata generates will cite relevant sections..."; page number only in API docs
- **New EN:** Humata's homepage lists 'Highlights citations' as a feature and says answers come with cited links into your source files, but it does not say what is highlighted or whether page numbers are shown. DocTalk lets you click any citation to scroll to and highlight the exact passage in your document viewer.

#### `compareHumata.faq3Answer`

- **Old EN:** Humata has an edge for team collaboration with shared workspaces and team management features on its Team plan ($49/user/month). DocTalk is currently focused on individual users, making it the better choice for personal document analysis.
- **Problem:** "Shared workspaces and team management" are not in the evidence.
- **Evidence (CF §4 + VE §2.10):** Free 60 pages/mo; Expert $9.99/mo (3 users, 500 pages, $0.02/extra page); Team $49/user/mo (10 users, 5,000 pages, $0.01/extra page, OCR, dept/folder permissions); Enterprise custom
- **New EN:** Humata has an edge for teams: its Team plan ($49/user/month) covers up to 10 users with department and folder permissions, and Expert covers up to 3 users. DocTalk is currently focused on individual users, making it the better choice for personal document analysis.

#### `compareHumata.faq4Answer`

- **Old EN:** Yes, Humata supports video file analysis, which is a unique feature. DocTalk does not support video files but handles 7 document formats (PDF, DOCX, PPTX, XLSX, TXT, MD, URL) with real-time citation highlighting.
- **Problem:** "Yes, Humata supports video ... unique" has no evidence.
- **Evidence (VE §2.10):** "Formats: not stated on the homepage, pricing page or docs pages checked." (no video, Word or other format evidence in VE, CF or PR)
- **New EN:** We could not confirm it. Humata's homepage, pricing page and docs (checked October 2026) do not list supported file types, so check Humata's site before relying on video. DocTalk does not support video files; it handles 7 document formats (PDF, DOCX, PPTX, XLSX, TXT, MD, URL) with real-time citation highlighting.

#### `compareHumata.ctaDescription`

- **Old EN:** See citation highlighting in action. Upload any document and start asking questions instantly.
- **Problem:** DocTalk claim: anonymous visitors cannot upload.
- **Evidence (CLAUDE.md + .claude/rules/frontend.md):** DocTalk: Free 300 credits/month, Plus $9.99, Pro $19.99; formats PDF/DOCX/PPTX/XLSX/TXT/MD/URL; anonymous use = the sample-document demo only (sign-in required to upload)
- **New EN:** See citation highlighting in action. Open a sample document and start asking questions at once.

### `altsChatpdf`

#### `altsChatpdf.heroDescription`

- **Old EN:** ChatPDF is a popular AI PDF chat tool, but it only supports PDF files, lacks citation highlighting, and its paid plan costs $19.99 per month. Whether you need multi-format support, better citations, team features, or a lower price, there are strong alternatives available. Here are the seven best ChatPDF alternatives in 2026, ranked by overall value for document analysis.
- **Problem:** "Only supports PDF files", "lacks citation highlighting", "$19.99 per month" are false or unsupported.
- **Evidence (VE §2.7):** "PDF (.pdf), Word (.doc, .docx), PowerPoint (.ppt, .pptx), Markdown (.md), and Text files (.txt)" (chatpdf.com FAQ)
- **Evidence (VE §2.7):** "...clickable citations instantly scroll to the exact source in your PDF." / feature card "Pages referenced"; in-document highlighting not stated
- **Evidence (VE §2.7):** "Entry price: not published. chatpdf.com/pricing and /plus return 404 today. The FAQ names 'ChatPDF Plus' with no price."
- **Evidence (PR §1):** "ChatPDF is free to try and requires no account to get started."
- **New EN:** ChatPDF lets you chat with PDF, Word, PowerPoint, Markdown and text files without an account, but it does not list Excel files or publish a price for ChatPDF Plus. Whether you need spreadsheet support, highlighted citations, team plans, or published pricing, there are strong alternatives. Here are the seven best ChatPDF alternatives in 2026, checked against each vendor's site in October 2026.

#### `altsChatpdf.metaDescription`

- **Old EN:** ChatPDF is a popular AI PDF chat tool, but it only supports PDF files, lacks citation highlighting, and its paid plan costs $19.99 per month. Whether you need multi-format support, better citations, team features, or a lower price, there are strong alternatives available. Here are the seven best ChatPDF alternatives in 2026, ranked by overall value for document analysis.
- **Problem:** Same false claims; ~390 characters.
- **Evidence (VE §2.7):** "PDF (.pdf), Word (.doc, .docx), PowerPoint (.ppt, .pptx), Markdown (.md), and Text files (.txt)" (chatpdf.com FAQ)
- **Evidence (VE §2.7):** "Entry price: not published. chatpdf.com/pricing and /plus return 404 today. The FAQ names 'ChatPDF Plus' with no price."
- **New EN:** The 7 best ChatPDF alternatives in 2026, from DocTalk to Gemini Notebook, compared on file formats, citations, free tiers and published prices.

#### `altsChatpdf.tablePdfOnly`

- **Old EN:** PDF only
- **Problem:** ChatPDF cell "PDF only" is false.
- **Evidence (VE §2.7):** "PDF (.pdf), Word (.doc, .docx), PowerPoint (.ppt, .pptx), Markdown (.md), and Text files (.txt)" (chatpdf.com FAQ)
- **New EN:** PDF, Word, PowerPoint, MD, TXT

#### `altsChatpdf.tableFreeTierChatpdf`

- **Old EN:** 2 PDFs/day
- **Problem:** "2 PDFs/day" understates "2 documents every day".
- **Evidence (VE §2.7):** "We offer a free plan that lets you analyze 2 documents every day." (no page, size or question cap published, PR §1)
- **New EN:** 2 documents/day

#### `altsChatpdf.alt1Desc1`

- **Old EN:** DocTalk is the most comprehensive ChatPDF alternative, addressing every major limitation of ChatPDF while adding features ChatPDF does not have. Where ChatPDF supports only PDF files, DocTalk handles seven formats: PDF, DOCX, PPTX, XLSX, TXT, Markdown, and web URLs, with dedicated parsers for each format that preserve document structure including tables, headings, and slide layouts.
- **Problem:** "Where ChatPDF supports only PDF files" and "addressing every major limitation" are false.
- **Evidence (VE §2.7):** "PDF (.pdf), Word (.doc, .docx), PowerPoint (.ppt, .pptx), Markdown (.md), and Text files (.txt)" (chatpdf.com FAQ)
- **New EN:** DocTalk is our pick for users who want highlighted citations and Excel support. ChatPDF reads PDF, Word, PowerPoint, Markdown and text files; DocTalk reads seven formats: PDF, DOCX, PPTX, XLSX, TXT, Markdown, and web URLs, with dedicated parsers for each format that preserve document structure including tables, headings, and slide layouts.

#### `altsChatpdf.alt1Desc2`

- **Old EN:** The standout feature is real-time citation highlighting. When the AI answers your question, every citation is a clickable link. Click it and the document viewer scrolls to the exact passage with a visual highlight overlay. This is a fundamental improvement over ChatPDF page number references, which require you to manually find the relevant text. For academic papers, legal documents, or any research where accuracy matters, this one feature alone justifies switching.
- **Problem:** "ChatPDF page number references, which require you to manually find the text" is contradicted.
- **Evidence (VE §2.7):** "...clickable citations instantly scroll to the exact source in your PDF." / feature card "Pages referenced"; in-document highlighting not stated
- **New EN:** The standout feature is real-time citation highlighting. When the AI answers your question, every citation is a clickable link. Click it and the document viewer scrolls to the exact passage with a visual highlight overlay. ChatPDF's citations also scroll to the source, but its site does not say whether the passage is highlighted. For academic papers, legal documents, or any research where accuracy matters, the highlight makes checking faster.

#### `altsChatpdf.alt1Desc3Pre`

- **Old EN:** DocTalk also offers two AI performance modes (Flash and Pro) instead of a single model, a fully localized interface in 11 languages, and a free demo that requires no signup at all. Paid plans start at $9.99 per month, which is half the price of ChatPDF Plus at $19.99. See our
- **Problem:** "Instead of a single model" is contradicted; "half the price of ChatPDF Plus at $19.99" uses an unpublished price.
- **Evidence (CF §1):** "Uses GPT-4o/GPT-4o-mini dynamic routing, not a fixed model." (direct)
- **Evidence (VE §2.7):** "Entry price: not published. chatpdf.com/pricing and /plus return 404 today. The FAQ names 'ChatPDF Plus' with no price."
- **Evidence (CLAUDE.md + .claude/rules/frontend.md):** DocTalk: Free 300 credits/month, Plus $9.99, Pro $19.99; formats PDF/DOCX/PPTX/XLSX/TXT/MD/URL; anonymous use = the sample-document demo only (sign-in required to upload)
- **New EN:** DocTalk also offers two AI performance modes (Flash and Pro), a fully localized interface in 11 languages, and a free demo that requires no signup at all. Paid plans start at $9.99 per month; ChatPDF does not publish a price for ChatPDF Plus. See our

#### `altsChatpdf.adv1`

- **Old EN:** 7 document formats vs PDF-only
- **Problem:** "vs PDF-only" is false.
- **Evidence (VE §2.7):** "PDF (.pdf), Word (.doc, .docx), PowerPoint (.ppt, .pptx), Markdown (.md), and Text files (.txt)" (chatpdf.com FAQ)
- **New EN:** 7 document formats, including Excel

#### `altsChatpdf.adv6`

- **Old EN:** Half the price of ChatPDF Plus ($9.99 vs $19.99)
- **Problem:** "Half the price of ChatPDF Plus ($9.99 vs $19.99)" uses an unpublished price.
- **Evidence (VE §2.7):** "Entry price: not published. chatpdf.com/pricing and /plus return 404 today. The FAQ names 'ChatPDF Plus' with no price."
- **Evidence (CLAUDE.md + .claude/rules/frontend.md):** DocTalk: Free 300 credits/month, Plus $9.99, Pro $19.99; formats PDF/DOCX/PPTX/XLSX/TXT/MD/URL; anonymous use = the sample-document demo only (sign-in required to upload)
- **New EN:** Published prices: Plus $9.99/month, Pro $19.99/month

#### `altsChatpdf.alt2Desc1`

- **Old EN:** AskYourPDF stands out with its research-oriented ecosystem. The Chrome extension lets you analyze PDFs directly in your browser without uploading them separately. The Zotero plugin integrates directly with academic reference managers, making it easy to query your research library. An API is available for developers who want to build document AI into their own applications.
- **Problem:** "Analyze PDFs without uploading them separately" is unsupported.
- **Evidence (VE §2.6):** "Web, iOS, Android, Chrome extension, ChatGPT GPT, and the Zotero plugin"
- **Evidence (VE §2.6):** API docs (docs.askyourpdf.com): response schema includes "page_number"
- **Evidence (VE §2.6):** "Drag a PDF, DOCX, EPUB, or TXT file into the AskYourPDF chat reader, or paste a URL."
- **New EN:** AskYourPDF stands out with its research-oriented ecosystem: a Chrome extension, a Zotero plugin, iOS and Android apps, a ChatGPT GPT and an API for developers. Its chat reader accepts PDF, DOCX, EPUB and TXT files or a pasted URL.

#### `altsChatpdf.alt2Desc2Pre`

- **Old EN:** The tradeoff is complexity. AskYourPDF has more moving parts than ChatPDF or DocTalk, which can be overwhelming for casual users. The interface is primarily English-only, and there is no real-time citation highlighting. Premium plans start at $14.99 per month. For researchers embedded in the Zotero ecosystem, AskYourPDF is hard to beat. For everyone else, simpler alternatives like DocTalk or ChatPDF may be better. See our
- **Problem:** "English-only", "no citation highlighting" unverified; "Premium $14.99" wrong.
- **Evidence (VE §2.6):** "We return your answer with a citation back to the exact page in the original PDF. Click the citation to verify." (highlighting not stated)
- **Evidence (VE §2.6):** "1 documents per day"; "100 pages per document"; "Max upload size: 15MB"; "50 questions per day"
- **Evidence (VE §2.6 + PR §3):** Premium "$11.99 per month billed yearly"; Pro "$14.99 per month billed yearly"; monthly-billed price "not shown"; Enterprise "Custom"
- **New EN:** Each answer cites the exact page in the original PDF, and you can click the citation to verify it. The free plan allows 1 document and 50 questions a day. Premium costs $11.99 per month, billed yearly. For researchers embedded in the Zotero ecosystem, AskYourPDF is hard to beat. See our

#### `altsChatpdf.alt3Desc1`

- **Old EN:** Humata is the only ChatPDF alternative on this list with robust team collaboration features. The Team plan ($49/user/month) includes shared workspaces, role-based access control, and the ability to share AI-generated insights across team members. Humata also uniquely supports video file analysis alongside PDFs and Word documents.
- **Problem:** "Only alternative with team features" (Sharly sells a Team plan), "shared workspaces, RBAC", video support are unsupported or false.
- **Evidence (CF §4 + VE §2.10):** Free 60 pages/mo; Expert $9.99/mo (3 users, 500 pages, $0.02/extra page); Team $49/user/mo (10 users, 5,000 pages, $0.01/extra page, OCR, dept/folder permissions); Enterprise custom
- **Evidence (VE §2.10):** "Highlights citations" (heading) / "Build trust with cited links into your source files." / "Each answer Humata generates will cite relevant sections..."; page number only in API docs
- **Evidence (VE §2.3 + PR §6):** Free "Documents / month 10", "Messages / mo 50", inline citations "Limited"; Pro "$12.5/month billed yearly"; Team "$24/month per seat, billed yearly"
- **Evidence (VE §2.10):** "Formats: not stated on the homepage, pricing page or docs pages checked." (no video, Word or other format evidence in VE, CF or PR)
- **New EN:** Humata is built for teams. Its Team plan ($49/user/month) covers up to 10 users with 5,000 pages a month and department and folder permissions, and the Expert plan ($9.99/month) covers up to 3 users. Humata's homepage lists 'Highlights citations' as a feature.

#### `altsChatpdf.alt3Desc2`

- **Old EN:** For individual users, Humata is less compelling. The free tier is limited to 60 pages per month, and the English-only interface is restrictive for international users. Page-based pricing means costs increase with document length rather than question count. But for teams needing collaborative document AI, Humata fills a niche that other tools do not.
- **Problem:** "English-only interface" is unverified; "a niche other tools do not" is unverified.
- **Evidence (CF §4 + VE §2.10):** Free 60 pages/mo; Expert $9.99/mo (3 users, 500 pages, $0.02/extra page); Team $49/user/mo (10 users, 5,000 pages, $0.01/extra page, OCR, dept/folder permissions); Enterprise custom
- **New EN:** For individual users, Humata is less compelling. The free tier covers 60 pages per month, and page-based pricing means costs increase with document length rather than question count. But for teams needing collaborative document AI, Humata fills a clear niche.

#### `altsChatpdf.alt3BestFor`

- **Old EN:** Teams needing shared workspaces, organizations with video content
- **Problem:** "Shared workspaces" and "video content" are unsupported.
- **Evidence (CF §4 + VE §2.10):** Free 60 pages/mo; Expert $9.99/mo (3 users, 500 pages, $0.02/extra page); Team $49/user/mo (10 users, 5,000 pages, $0.01/extra page, OCR, dept/folder permissions); Enterprise custom
- **Evidence (VE §2.10):** "Formats: not stated on the homepage, pricing page or docs pages checked." (no video, Word or other format evidence in VE, CF or PR)
- **New EN:** Teams of up to 10 users that want page-based plans

#### `altsChatpdf.alt4Desc1`

- **Old EN:** Google NotebookLM is the best completely free ChatPDF alternative. It supports multi-source notebooks where you can combine PDFs, Google Docs, web URLs, text, and YouTube transcripts into a single research workspace. The AI synthesizes information across all sources, which is perfect for literature reviews and cross-document research.
- **Problem:** "Completely free" omits limits; source list omits Word/PowerPoint.
- **Evidence (VE §2.9 + CF §5):** "Is Gemini Notebook the same product as NotebookLM?"; notebooklm.google 301-redirects to notebook.google
- **Evidence (VE §2.9 + CF §5):** Standard: "100/user" notebooks, "50/notebook" sources ("Usage Limits (Subject to Change)")
- **Evidence (VE §2.9 + CF §5):** "Microsoft Word (docx), Text (txt), Markdown (md), PDF files (pdf), CSV (csv), and PowerPoint (pptx) files"; "ePub files"; plus Google Docs/Slides/Sheets, web URLs, public YouTube URLs, audio, images, pasted text (no XLSX)
- **New EN:** Google NotebookLM, now called Gemini Notebook, is the strongest free option here. Its free Standard tier allows 100 notebooks and 50 sources per notebook, and a notebook can combine PDF, Word, PowerPoint, Google Docs, web URLs and YouTube videos. The AI synthesizes information across all sources, which suits literature reviews and cross-document research.

#### `altsChatpdf.alt4Desc2`

- **Old EN:** The unique AI-generated audio podcast feature creates natural-sounding conversational summaries of your sources, which is a genuinely novel way to consume research. The tradeoff is Google lock-in: you need a Google account, your data is on Google servers, and the English-focused interface limits international use. NotebookLM also does not support DOCX, PPTX, or XLSX natively.
- **Problem:** "Does not support DOCX, PPTX" is false; "English-focused interface" unverified; "unique podcast" unsupported.
- **Evidence (PR §11):** Standard limits table lists "3/day" Audio Overviews
- **Evidence (PR §11):** "you must... verify your age in your Google Account"
- **Evidence (VE §2.9 + CF §5):** "Microsoft Word (docx), Text (txt), Markdown (md), PDF files (pdf), CSV (csv), and PowerPoint (pptx) files"; "ePub files"; plus Google Docs/Slides/Sheets, web URLs, public YouTube URLs, audio, images, pasted text (no XLSX)
- **Evidence (VE §2.9):** "To get the full quoted text, hover over any citation." / "To navigate directly to the quote and review it in context, select a citation." / no page number documented
- **New EN:** Audio Overviews turn your sources into audio summaries. The tradeoff is Google lock-in: you need a Google account. Excel (XLSX) files are not on Google's list of supported sources, and Google does not document page numbers for citations.

#### `altsChatpdf.alt5Desc1`

- **Old EN:** PDF.ai takes minimalism to its logical endpoint. The tool does one thing: you upload a PDF and ask questions. There are no multi-format parsers, no citation highlighting systems, no multilingual interfaces, and no AI model selection. This simplicity is both its strength and its limitation.
- **Problem:** "No citation systems, no multilingual interfaces, no AI model selection" are unverified negatives.
- **Evidence (VE §2.11):** "You can only upload PDF (.pdf) files at the moment." (pdf.ai/faq)
- **Evidence (VE §2.11):** "Sources included / Every response is backed by sources extracted from the uploaded document." (no page number or highlight documented)
- **Evidence (CF §3 + PR §5):** Positioning "chat-with-PDF + document parsing API"; "A separate developer API product"
- **New EN:** PDF.ai is a focused chat-with-PDF tool. Its FAQ says you can only upload PDF files at the moment, and every response is backed by sources from your document. It also sells a separate document-parsing API for developers.

#### `altsChatpdf.alt5Desc2`

- **Old EN:** For users who only need occasional, basic PDF Q&A, PDF.ai gets out of the way and lets you work. But development has slowed, and the feature set has not meaningfully evolved since launch. For anything beyond basic PDF chat, other alternatives provide substantially more value.
- **Problem:** "Development has slowed ... not evolved since launch" is an unverified negative.
- **Evidence (VE §2.11):** "Monthly upload limit" = 1; "Monthly questions limit" = 100; "Max file size" 10MB
- **Evidence (VE §2.11 + CF §3):** Pro "$17 /mo Billed monthly"; "$10 /mo Billed yearly"; Pro = 100 uploads/mo, 1,000 q/mo; Ultimate "$27/user/mo monthly"
- **New EN:** The free Hobby plan allows 1 upload and 100 questions a month. Pro costs $17 per month billed monthly, or $10 per month billed yearly (October 2026). It suits users who only need occasional PDF Q&A.

#### `altsChatpdf.alt6Desc1`

- **Old EN:** ChatDOC differentiates itself with strong table extraction and structured data handling. If your documents are heavy on tables, charts, and structured data, ChatDOC better preserves those structures during analysis. The tool supports PDF and DOCX files with particular attention to tabular content.
- **Problem:** "Better preserves table structures" is unsupported; formats incomplete.
- **Evidence (VE §2.1):** TapSource headings "Click Footnotes, Reveal Context" / "Tap Data, Meet Truth"
- **Evidence (VE §2.1):** "Every AI - generated answer includes page numbers from the original document. Click the page number to jump directly to the corresponding section."; "Numerical values in answers are highlighted. Click them to trace back to the original data"
- **Evidence (VE §2.1):** Free = "PDF". Pro = "PDF, DOC, DOCX, SCAN, WEBSITE, EPUB, MD, TXT"
- **New EN:** ChatDOC focuses on tracing answers to the data behind them. Its TapSource feature lets you click a footnote to see context, and numbers in answers are highlighted so you can trace them to the original data in the document. Every answer includes page numbers that you can click to jump to the section. The free plan reads PDF; Pro adds Word, EPUB, Markdown, text, scanned files and websites.

#### `altsChatpdf.alt6Desc2`

- **Old EN:** ChatDOC offers page-level citations that show the relevant section of the document. The interface is available in English and Chinese. Free users get 2 documents per day with 20 questions each. The Pro plan starts at $5.99 per month. For documents where table accuracy is critical, ChatDOC is worth evaluating, though DocTalk XLSX support may serve similar needs for spreadsheet-heavy workflows.
- **Problem:** "English and Chinese interface" unsupported; "2 documents/day, 20 questions" disputed by the vendor itself; "$5.99" wrong.
- **Evidence (VE §2.1):** homepage table "5/day, 10 in total" files, "300" pages per file vs guide "Upload up to 2 files every 24 hours." / "Each file limited to 20 pages."
- **Evidence (VE §2.1):** "Auto-renewal price: $8.99 for 30 days. Original price: $16.99 for 30 days."; "$89.9" "/360 days"
- **New EN:** ChatDOC's own pages disagree on the free plan: its homepage table lists 5 files a day (10 in total) and 300 pages per file, while its guide says 2 files every 24 hours and 20 pages per file. Pro costs $8.99 for 30 days on auto-renewal, or $89.9 for 360 days. For data-heavy PDFs, ChatDOC is worth evaluating; for spreadsheets themselves, DocTalk reads XLSX files directly.

#### `altsChatpdf.alt7Desc1`

- **Old EN:** Sharly (formerly Sharly AI) focuses on document summarization as its primary use case. Rather than a pure Q&A interface, Sharly emphasizes generating comprehensive summaries of uploaded documents. The tool supports PDFs and offers different summary lengths and styles to match your needs.
- **Problem:** "Formerly Sharly AI" is wrong; "summarization primary use case", "supports PDFs" understate it.
- **Evidence (PR §6):** Homepage title "Sharly AI | Research Assistant for Summarizing, Comparing & Citing Documents"
- **Evidence (VE §2.3):** "Drop in PDF, DOCX,PPTX, Notion Exports - Sharly handles it all"
- **Evidence (VE §2.3):** "Every answer shows the passage it came from, with page numbers for PDFs."
- **New EN:** Sharly AI describes itself as a research assistant for summarizing, comparing and citing documents. It reads PDF, DOCX and PPTX files and Notion exports, and it says every answer shows the passage it came from, with page numbers for PDFs.

#### `altsChatpdf.alt7Desc2`

- **Old EN:** Sharly is a good choice if your primary need is getting an overview of long documents rather than asking specific questions. The summarization quality is generally strong. However, for detailed Q&A with source verification, tools like DocTalk with citation highlighting are more appropriate. Sharly also lacks the multi-format support and multilingual interface found in DocTalk.
- **Problem:** "Lacks multi-format support and multilingual interface" is false/unverified; quality claim unmeasured.
- **Evidence (VE §2.3 + PR §6):** Free "Documents / month 10", "Messages / mo 50", inline citations "Limited"; Pro "$12.5/month billed yearly"; Team "$24/month per seat, billed yearly"
- **Evidence (VE §2.3):** "Drop in PDF, DOCX,PPTX, Notion Exports - Sharly handles it all"
- **New EN:** The free plan is capped (its pricing page lists 10 documents and 50 messages a month, with limited inline citations); Pro costs $12.5 per month billed yearly. Sharly AI is a good choice if your main need is summarizing and comparing documents.

#### `altsChatpdf.chooseNeed4`

- **Old EN:** Completely free with multi-source
- **Problem:** "Completely free" omits the published limits.
- **Evidence (VE §2.9 + CF §5):** Standard: "100/user" notebooks, "50/notebook" sources ("Usage Limits (Subject to Change)")
- **New EN:** Free tier with multi-source notebooks

#### `altsChatpdf.faq1Answer`

- **Old EN:** Google NotebookLM is the best completely free alternative, offering multi-source notebooks and audio podcast generation with no usage limits (Google account required). DocTalk also offers a free demo with no signup required and a free tier with 300 credits per month.
- **Problem:** "No usage limits" is false; "audio podcast" unsupported.
- **Evidence (VE §2.9 + CF §5):** "Is Gemini Notebook the same product as NotebookLM?"; notebooklm.google 301-redirects to notebook.google
- **Evidence (VE §2.9 + CF §5):** Standard: "100/user" notebooks, "50/notebook" sources ("Usage Limits (Subject to Change)")
- **Evidence (PR §11):** Standard limits table lists "3/day" Audio Overviews
- **Evidence (PR §11):** "you must... verify your age in your Google Account"
- **Evidence (CLAUDE.md + .claude/rules/frontend.md):** DocTalk: Free 300 credits/month, Plus $9.99, Pro $19.99; formats PDF/DOCX/PPTX/XLSX/TXT/MD/URL; anonymous use = the sample-document demo only (sign-in required to upload)
- **New EN:** Google NotebookLM, now called Gemini Notebook, is a strong free option: its free Standard tier allows 100 notebooks and 50 sources per notebook, and it creates Audio Overviews (Google account required). DocTalk also offers a free demo with no signup required and a free tier with 300 credits per month.

#### `altsChatpdf.faq2Answer`

- **Old EN:** DocTalk supports the widest range of document formats with 7 types: PDF, DOCX, PPTX, XLSX, TXT, Markdown, and web URLs. ChatPDF and most other alternatives only support PDF files.
- **Problem:** "DocTalk supports the widest range" is false; "ChatPDF only supports PDF" is false.
- **Evidence (VE §2.9 + CF §5):** "Microsoft Word (docx), Text (txt), Markdown (md), PDF files (pdf), CSV (csv), and PowerPoint (pptx) files"; "ePub files"; plus Google Docs/Slides/Sheets, web URLs, public YouTube URLs, audio, images, pasted text (no XLSX)
- **Evidence (VE §2.7):** "PDF (.pdf), Word (.doc, .docx), PowerPoint (.ppt, .pptx), Markdown (.md), and Text files (.txt)" (chatpdf.com FAQ)
- **Evidence (VE §2.11):** "You can only upload PDF (.pdf) files at the moment." (pdf.ai/faq)
- **Evidence (VE §2.1):** Free = "PDF". Pro = "PDF, DOC, DOCX, SCAN, WEBSITE, EPUB, MD, TXT"
- **New EN:** Gemini Notebook (formerly NotebookLM) accepts the widest range of sources on this list, from Word, PowerPoint, PDF, CSV and ePub files to web URLs and YouTube videos. DocTalk reads 7 formats, including Excel (XLSX). ChatPDF reads PDF, Word, PowerPoint, Markdown and text files, and PDF.ai reads only PDF.

#### `altsChatpdf.faq3Answer`

- **Old EN:** DocTalk has the most advanced citation system with real-time visual highlighting. Click any citation to instantly scroll to and highlight the exact source passage in your document. Other tools only provide page number references.
- **Problem:** "Other tools only provide page number references" is false (ChatDOC, Sharly, ChatPDF document more).
- **Evidence (VE §2.1):** "Every AI - generated answer includes page numbers from the original document. Click the page number to jump directly to the corresponding section."; "Numerical values in answers are highlighted. Click them to trace back to the original data"
- **Evidence (VE §2.3):** "Every answer shows the passage it came from, with page numbers for PDFs."
- **Evidence (VE §2.7):** "...clickable citations instantly scroll to the exact source in your PDF." / feature card "Pages referenced"; in-document highlighting not stated
- **New EN:** DocTalk highlights the cited passage in your document when you click a citation. Several alternatives document their own approach: ChatDOC and Sharly AI say answers show page numbers, and ChatPDF's citations scroll to the source. Compare how each tool shows its sources before you choose.

#### `altsChatpdf.faq4Answer`

- **Old EN:** Humata offers the best team collaboration features with shared workspaces, role management, and a Team plan at $49/user/month. Most other alternatives, including DocTalk, focus on individual users.
- **Problem:** "Shared workspaces, role management" unsupported; "most others focus on individuals" ignores Sharly Team.
- **Evidence (CF §4 + VE §2.10):** Free 60 pages/mo; Expert $9.99/mo (3 users, 500 pages, $0.02/extra page); Team $49/user/mo (10 users, 5,000 pages, $0.01/extra page, OCR, dept/folder permissions); Enterprise custom
- **Evidence (VE §2.3 + PR §6):** Free "Documents / month 10", "Messages / mo 50", inline citations "Limited"; Pro "$12.5/month billed yearly"; Team "$24/month per seat, billed yearly"
- **New EN:** Humata offers team plans: Team ($49/user/month) covers up to 10 users with department and folder permissions. Sharly AI also sells a Team plan ($24 per seat per month, billed yearly). DocTalk focuses on individual users.

### `altsNotebooklm`

#### `altsNotebooklm.heroDescription`

- **Old EN:** Google NotebookLM is a powerful free tool for multi-source research, but it requires a Google account, does not support common business formats like DOCX and XLSX, and lacks real-time citation highlighting. Whether you need vendor independence, broader format support, better citation verification, or a multilingual interface, these six alternatives offer compelling reasons to look beyond NotebookLM.
- **Problem:** "Does not support DOCX" is false; "lacks real-time citation highlighting" overstates; "free" omits limits.
- **Evidence (VE §2.9 + CF §5):** "Is Gemini Notebook the same product as NotebookLM?"; notebooklm.google 301-redirects to notebook.google
- **Evidence (PR §11):** "you must... verify your age in your Google Account"
- **Evidence (VE §2.9 + CF §5):** "Microsoft Word (docx), Text (txt), Markdown (md), PDF files (pdf), CSV (csv), and PowerPoint (pptx) files"; "ePub files"; plus Google Docs/Slides/Sheets, web URLs, public YouTube URLs, audio, images, pasted text (no XLSX)
- **Evidence (VE §2.9):** "To get the full quoted text, hover over any citation." / "To navigate directly to the quote and review it in context, select a citation." / no page number documented
- **New EN:** Google NotebookLM, now called Gemini Notebook, is a strong tool for multi-source research with a free tier, but it requires a Google account, does not list Excel (XLSX) files, and does not document page numbers for its citations. Whether you need vendor independence, Excel support, highlighted citations in the original document, or a different pricing model, these six alternatives offer reasons to look beyond NotebookLM.

#### `altsNotebooklm.metaDescription`

- **Old EN:** Google NotebookLM is a powerful free tool for multi-source research, but it requires a Google account, does not support common business formats like DOCX and XLSX, and lacks real-time citation highlighting. Whether you need vendor independence, broader format support, better citation verification, or a multilingual interface, these six alternatives offer compelling reasons to look beyond NotebookLM.
- **Problem:** Same false DOCX claim; ~390 characters.
- **Evidence (VE §2.9 + CF §5):** "Is Gemini Notebook the same product as NotebookLM?"; notebooklm.google 301-redirects to notebook.google
- **Evidence (VE §2.9 + CF §5):** "Microsoft Word (docx), Text (txt), Markdown (md), PDF files (pdf), CSV (csv), and PowerPoint (pptx) files"; "ePub files"; plus Google Docs/Slides/Sheets, web URLs, public YouTube URLs, audio, images, pasted text (no XLSX)
- **New EN:** Six NotebookLM (now Gemini Notebook) alternatives for document analysis in 2026, compared on citations, file formats, Google lock-in and pricing.

#### `altsNotebooklm.alt1Desc1`

- **Old EN:** DocTalk is the best NotebookLM alternative for users who need precise citation verification and broad format support. Where NotebookLM links to sources within its notebook, DocTalk provides real-time citation highlighting: click any citation in an AI answer to instantly scroll to and highlight the exact source passage in a side-by-side document viewer. This visual verification is a genuine step up from NotebookLM inline references.
- **Problem:** "Genuine step up from NotebookLM inline references" understates Gemini Notebook's documented jump to the quote.
- **Evidence (VE §2.9):** "To get the full quoted text, hover over any citation." / "To navigate directly to the quote and review it in context, select a citation." / no page number documented
- **New EN:** DocTalk is the best NotebookLM alternative for users who need precise citation verification in the original document. Gemini Notebook opens the quoted passage in context; DocTalk highlights the cited passage in a side-by-side viewer of your original document, so you see it on the page where it appears.

#### `altsNotebooklm.alt1Desc2`

- **Old EN:** DocTalk supports seven document formats (PDF, DOCX, PPTX, XLSX, TXT, Markdown, web URLs) compared to NotebookLM limited format support. The 11-language interface, two AI performance modes, and independence from any single tech platform make DocTalk the most versatile alternative. While DocTalk focuses on single-document deep analysis rather than multi-source notebooks, it excels at what it does.
- **Problem:** "NotebookLM limited format support" is false; "most versatile alternative" unsupported.
- **Evidence (VE §2.9 + CF §5):** "Microsoft Word (docx), Text (txt), Markdown (md), PDF files (pdf), CSV (csv), and PowerPoint (pptx) files"; "ePub files"; plus Google Docs/Slides/Sheets, web URLs, public YouTube URLs, audio, images, pasted text (no XLSX)
- **New EN:** DocTalk supports seven document formats (PDF, DOCX, PPTX, XLSX, TXT, Markdown, web URLs), including Excel files, which Gemini Notebook does not list. The 11-language interface, two AI performance modes, and independence from any single tech platform set it apart. While DocTalk focuses on single-document deep analysis rather than multi-source notebooks, it excels at what it does.

#### `altsNotebooklm.adv2`

- **Old EN:** 7 document formats including DOCX, PPTX, XLSX
- **Problem:** Implies DOCX/PPTX are DocTalk-only.
- **Evidence (VE §2.9 + CF §5):** "Microsoft Word (docx), Text (txt), Markdown (md), PDF files (pdf), CSV (csv), and PowerPoint (pptx) files"; "ePub files"; plus Google Docs/Slides/Sheets, web URLs, public YouTube URLs, audio, images, pasted text (no XLSX)
- **New EN:** 7 document formats, including Excel (XLSX)

#### `altsNotebooklm.adv3`

- **Old EN:** 11 interface languages (NotebookLM: English primary)
- **Problem:** "NotebookLM: English primary" is unverified.
- **Evidence (none):** No statement in VE, CF or PR supports this; removed or marked "Not verified".
- **New EN:** 11 interface languages

#### `altsNotebooklm.alt2Desc1`

- **Old EN:** ChatPDF is the most straightforward NotebookLM alternative. Upload a PDF, ask questions, get answers with page references. There is no multi-source notebook concept and no audio podcasts, but for users who just need to query individual PDF files, ChatPDF simplicity is its appeal. The tool has a large established user base and a proven track record.
- **Problem:** "Upload a PDF ... page references", "no audio podcasts", "large user base" are unsupported.
- **Evidence (PR §1):** "ChatPDF is free to try and requires no account to get started."
- **Evidence (VE §2.7):** "...clickable citations instantly scroll to the exact source in your PDF." / feature card "Pages referenced"; in-document highlighting not stated
- **Evidence (PR §1):** "creating a free account unlocks additional features like saved history and multi-document chats"
- **New EN:** ChatPDF is the most straightforward NotebookLM alternative: you can start without an account, upload a document and ask questions, and its citations scroll to the source. It is built around individual documents rather than notebooks, but a free account adds multi-document chats and saved history.

#### `altsNotebooklm.alt2Desc2`

- **Old EN:** The free tier allows 2 PDFs per day with 3 questions each. The Plus plan costs $19.99 per month. ChatPDF supports only PDF files and has a primarily English interface. If you are looking for a simple, focused alternative to NotebookLM for PDF-only work, ChatPDF is a reliable choice.
- **Problem:** "3 questions each", "$19.99", "only PDF files", "primarily English" are false or unsupported.
- **Evidence (VE §2.7):** "We offer a free plan that lets you analyze 2 documents every day." (no page, size or question cap published, PR §1)
- **Evidence (PR §1):** "our ChatPDF Plus plan provides unlimited document analysis, and more advanced features"
- **Evidence (VE §2.7):** "Entry price: not published. chatpdf.com/pricing and /plus return 404 today. The FAQ names 'ChatPDF Plus' with no price."
- **Evidence (VE §2.7):** "PDF (.pdf), Word (.doc, .docx), PowerPoint (.ppt, .pptx), Markdown (.md), and Text files (.txt)" (chatpdf.com FAQ)
- **New EN:** The free plan lets you analyze 2 documents every day. ChatPDF Plus offers unlimited document analysis, but ChatPDF does not publish its price. It reads PDF, Word, PowerPoint, Markdown and text files. If you want a simple, focused alternative for individual documents, ChatPDF is a reliable choice.

#### `altsNotebooklm.alt3Desc1`

- **Old EN:** AskYourPDF is the best NotebookLM alternative for academic researchers who need integration with their existing research tools. The Zotero plugin lets you query your entire reference library without uploading files individually. The Chrome extension enables in-browser PDF analysis. An API is available for programmatic access.
- **Problem:** "Query your entire library without uploading files individually" is unsupported.
- **Evidence (VE §2.6):** "Web, iOS, Android, Chrome extension, ChatGPT GPT, and the Zotero plugin"
- **Evidence (VE §2.6):** API docs (docs.askyourpdf.com): response schema includes "page_number"
- **New EN:** AskYourPDF is the best NotebookLM alternative for academic researchers who need integration with their existing research tools. The Zotero plugin connects it to your reference library, the Chrome extension works in your browser, and an API is available for programmatic access.

#### `altsNotebooklm.alt3Desc2`

- **Old EN:** Where NotebookLM notebook paradigm encourages exploratory cross-document research, AskYourPDF targets structured academic workflows. The tradeoff is complexity: setting up plugins and integrations takes more effort than NotebookLM simple drag-and-drop interface. Premium plans start at $14.99 per month.
- **Problem:** "Premium plans start at $14.99" is wrong.
- **Evidence (VE §2.6):** "We return your answer with a citation back to the exact page in the original PDF. Click the citation to verify." (highlighting not stated)
- **Evidence (VE §2.6 + PR §3):** Premium "$11.99 per month billed yearly"; Pro "$14.99 per month billed yearly"; monthly-billed price "not shown"; Enterprise "Custom"
- **New EN:** Where Gemini Notebook's notebooks encourage exploratory cross-document research, AskYourPDF targets structured academic workflows. Each answer cites the exact page, and you can click to verify it. Premium costs $11.99 per month, billed yearly.

#### `altsNotebooklm.alt4Desc1`

- **Old EN:** Humata offers what NotebookLM lacks: team collaboration features. Shared workspaces, role-based access control, and the ability to collaborate on document analysis make Humata the best choice for organizations. Humata also supports video files, which is a unique capability neither NotebookLM nor other alternatives offer.
- **Problem:** "What NotebookLM lacks", "shared workspaces, RBAC", unique video support are unsupported.
- **Evidence (CF §4 + VE §2.10):** Free 60 pages/mo; Expert $9.99/mo (3 users, 500 pages, $0.02/extra page); Team $49/user/mo (10 users, 5,000 pages, $0.01/extra page, OCR, dept/folder permissions); Enterprise custom
- **Evidence (VE §2.10):** "Highlights citations" (heading) / "Build trust with cited links into your source files." / "Each answer Humata generates will cite relevant sections..."; page number only in API docs
- **Evidence (VE §2.10):** "Formats: not stated on the homepage, pricing page or docs pages checked." (no video, Word or other format evidence in VE, CF or PR)
- **New EN:** Humata is built around team plans. Its Team plan covers up to 10 users with 5,000 pages a month and department and folder permissions, and its Expert plan covers up to 3 users. Its homepage lists 'Highlights citations' as a feature.

#### `altsNotebooklm.alt4Desc2`

- **Old EN:** The Team plan costs $49/user/month, making it the most expensive option on this list. Paid plans start at $9.99/month (Expert: 500 pages a month, up to 3 users). The interface is English-only. If you need collaborative document AI for a team, Humata is the clear winner. For individual use, other alternatives offer better value.
- **Problem:** "Most expensive option on this list" is false (Elicit Pro $49/user, Consensus Deep $65); "English-only" unverified.
- **Evidence (CF §4 + VE §2.10):** Free 60 pages/mo; Expert $9.99/mo (3 users, 500 pages, $0.02/extra page); Team $49/user/mo (10 users, 5,000 pages, $0.01/extra page, OCR, dept/folder permissions); Enterprise custom
- **Evidence (PR §10 + VE §2.12):** "Unlimited search across more than 138 million papers"; "Unlimited chat with papers with full-text access"; "Limited usage for Research Agent and Research Reports"; Pro "$49" "billed as $588 annually"; "sentence-level citations"; Pro "Custom extractions from uploaded papers"; "Dedicated Systematic Review Workflow"
- **Evidence (PR §14 + CF §6):** Free: "Basic Paper search; 10 Pro messages per month; ... Up to 3 Deep reviews per month"; Pro "$20/mo", "$12/mo" billed annually; "an AI academic search engine for peer-reviewed literature"; "Over 170 university libraries partner with Consensus." (paper count not a vendor quote)
- **New EN:** The Team plan costs $49/user/month. Paid plans start at $9.99/month (Expert: 500 pages a month, up to 3 users). If you need collaborative document AI for a team, Humata is a strong choice. For individual use, other alternatives may offer better value.

#### `altsNotebooklm.alt4BestFor`

- **Old EN:** Teams, organizations, video content analysis
- **Problem:** "Video content analysis" has no evidence.
- **Evidence (VE §2.10):** "Formats: not stated on the homepage, pricing page or docs pages checked." (no video, Word or other format evidence in VE, CF or PR)
- **Evidence (CF §4 + VE §2.10):** Free 60 pages/mo; Expert $9.99/mo (3 users, 500 pages, $0.02/extra page); Team $49/user/mo (10 users, 5,000 pages, $0.01/extra page, OCR, dept/folder permissions); Enterprise custom
- **New EN:** Teams and organizations that want page-based plans

#### `altsNotebooklm.alt5Desc1`

- **Old EN:** Consensus is a specialized alternative that focuses exclusively on scientific literature. Rather than uploading your own documents, Consensus searches across more than 200 million academic papers to answer research questions with evidence-based responses. Every answer includes citations to peer-reviewed papers with links to the original sources.
- **Problem:** "200 million papers" and "every answer includes citations" are not vendor quotes in the evidence.
- **Evidence (PR §14 + CF §6):** Free: "Basic Paper search; 10 Pro messages per month; ... Up to 3 Deep reviews per month"; Pro "$20/mo", "$12/mo" billed annually; "an AI academic search engine for peer-reviewed literature"; "Over 170 university libraries partner with Consensus." (paper count not a vendor quote)
- **New EN:** Consensus is an AI academic search engine for peer-reviewed literature. Rather than working from your own documents, it searches published research to answer questions; over 170 university libraries partner with it, according to its site.

#### `altsNotebooklm.alt5Desc2`

- **Old EN:** Consensus fills a different niche than NotebookLM. Where NotebookLM lets you create notebooks from your own sources, Consensus provides access to the entire academic literature. The tool is particularly valuable for literature reviews, meta-analyses, and fact-checking scientific claims. A free tier is available with limited searches per month. Premium plans provide unlimited searches and additional features.
- **Problem:** "Limited searches per month" is wrong: basic search is free; AI messages are capped.
- **Evidence (PR §14 + CF §6):** Free: "Basic Paper search; 10 Pro messages per month; ... Up to 3 Deep reviews per month"; Pro "$20/mo", "$12/mo" billed annually; "an AI academic search engine for peer-reviewed literature"; "Over 170 university libraries partner with Consensus." (paper count not a vendor quote)
- **New EN:** Consensus fills a different niche than Gemini Notebook. Where Gemini Notebook works from sources you add, Consensus searches the academic literature, which helps with literature reviews and fact-checking scientific claims. Its free plan includes basic paper search, 10 Pro messages and up to 3 Deep reviews a month; Pro costs $20 per month, or $12 per month billed annually.

#### `altsNotebooklm.alt6Desc1`

- **Old EN:** Elicit is an AI research assistant designed specifically for systematic literature reviews. It helps you find relevant papers, extract key data points, and organize findings into structured tables. Elicit goes beyond simple Q&A to support the entire research workflow, from search to synthesis.
- **Problem:** "Structured tables" is unsupported; free plan is mostly unlimited.
- **Evidence (PR §10 + VE §2.12):** "Unlimited search across more than 138 million papers"; "Unlimited chat with papers with full-text access"; "Limited usage for Research Agent and Research Reports"; Pro "$49" "billed as $588 annually"; "sentence-level citations"; Pro "Custom extractions from uploaded papers"; "Dedicated Systematic Review Workflow"
- **New EN:** Elicit is an AI research assistant for evidence synthesis. Its free Basic plan includes unlimited search across more than 138 million papers, unlimited summaries and unlimited chat with papers, and it supports AI-generated claims with sentence-level citations. Pro adds a systematic-review workflow and custom extractions from uploaded papers.

#### `altsNotebooklm.alt6Desc2`

- **Old EN:** Where NotebookLM creates notebooks from documents you provide, Elicit helps you discover papers you might not have found otherwise. The structured extraction feature automatically pulls key data from papers into a spreadsheet-like view. Elicit offers a free tier with limited usage and a Pro plan for heavy users. It is a complementary tool to document Q&A platforms rather than a direct replacement, ideal for the discovery and organization phases of research.
- **Problem:** "Spreadsheet-like view" and "free tier with limited usage" are unsupported or imprecise.
- **Evidence (PR §10 + VE §2.12):** "Unlimited search across more than 138 million papers"; "Unlimited chat with papers with full-text access"; "Limited usage for Research Agent and Research Reports"; Pro "$49" "billed as $588 annually"; "sentence-level citations"; Pro "Custom extractions from uploaded papers"; "Dedicated Systematic Review Workflow"
- **New EN:** Where Gemini Notebook works from documents you provide, Elicit helps you discover papers you might not have found otherwise. Research Agent and Research Reports have limited use on the free plan, and Pro costs $49 per user per month, billed annually. It is a complementary tool to document Q&A platforms rather than a direct replacement, ideal for the discovery and organization phases of research.

#### `altsNotebooklm.faq1Answer`

- **Old EN:** Common reasons include: wanting to avoid Google vendor lock-in, needing support for formats NotebookLM lacks (DOCX, PPTX, XLSX), wanting citation highlighting for answer verification, needing a fully multilingual interface, or preferring a privacy-first platform that encrypts your documents.
- **Problem:** "Formats NotebookLM lacks (DOCX, PPTX, XLSX)" is false for DOCX/PPTX; multilingual claim unverified.
- **Evidence (VE §2.9 + CF §5):** "Microsoft Word (docx), Text (txt), Markdown (md), PDF files (pdf), CSV (csv), and PowerPoint (pptx) files"; "ePub files"; plus Google Docs/Slides/Sheets, web URLs, public YouTube URLs, audio, images, pasted text (no XLSX)
- **New EN:** Common reasons include: wanting to avoid Google vendor lock-in, needing Excel (XLSX) support, which is not on Google's list of sources, wanting citations highlighted in the original document, or preferring an independent platform that encrypts your documents.

#### `altsNotebooklm.faq2Answer`

- **Old EN:** DocTalk offers a free demo with no signup required and a free tier with 300 credits per month. ChatPDF offers 2 free PDFs per day. However, no other tool matches NotebookLM fully free unlimited usage, since it is subsidized by Google.
- **Problem:** "NotebookLM fully free unlimited usage" is false.
- **Evidence (VE §2.9 + CF §5):** Standard: "100/user" notebooks, "50/notebook" sources ("Usage Limits (Subject to Change)")
- **Evidence (VE §2.7):** "We offer a free plan that lets you analyze 2 documents every day." (no page, size or question cap published, PR §1)
- **Evidence (PR §10 + VE §2.12):** "Unlimited search across more than 138 million papers"; "Unlimited chat with papers with full-text access"; "Limited usage for Research Agent and Research Reports"; Pro "$49" "billed as $588 annually"; "sentence-level citations"; Pro "Custom extractions from uploaded papers"; "Dedicated Systematic Review Workflow"
- **Evidence (CLAUDE.md + .claude/rules/frontend.md):** DocTalk: Free 300 credits/month, Plus $9.99, Pro $19.99; formats PDF/DOCX/PPTX/XLSX/TXT/MD/URL; anonymous use = the sample-document demo only (sign-in required to upload)
- **New EN:** Yes. DocTalk offers a free demo with no signup required and a free tier with 300 credits per month. ChatPDF's free plan covers 2 documents a day, and Elicit's free plan includes unlimited search and chat with papers. Gemini Notebook itself is free with usage limits, not unlimited.

#### `altsNotebooklm.faq3Answer`

- **Old EN:** DocTalk has the most advanced citation system with real-time visual highlighting. Click any citation to scroll to and highlight the exact source passage. Other tools provide page references but not visual highlighting.
- **Problem:** "Other tools provide page references but not highlighting" is an unverified generalisation.
- **Evidence (VE §2.6):** "We return your answer with a citation back to the exact page in the original PDF. Click the citation to verify." (highlighting not stated)
- **Evidence (PR §10 + VE §2.12):** "Unlimited search across more than 138 million papers"; "Unlimited chat with papers with full-text access"; "Limited usage for Research Agent and Research Reports"; Pro "$49" "billed as $588 annually"; "sentence-level citations"; Pro "Custom extractions from uploaded papers"; "Dedicated Systematic Review Workflow"
- **Evidence (VE §2.9):** "To get the full quoted text, hover over any citation." / "To navigate directly to the quote and review it in context, select a citation." / no page number documented
- **New EN:** DocTalk highlights the cited passage in your original document when you click a citation. Among the alternatives here, AskYourPDF cites the exact page and Elicit uses sentence-level citations. Gemini Notebook itself opens the quoted passage in context but does not document page numbers.

#### `altsNotebooklm.faq4Answer`

- **Old EN:** No. NotebookLM AI-generated audio podcast feature is unique and not replicated by any alternative. If audio summaries are important to your workflow, NotebookLM remains the only option for that specific feature.
- **Problem:** "Unique and not replicated by any alternative" is an unverified negative about all other tools.
- **Evidence (PR §11):** Standard limits table lists "3/day" Audio Overviews
- **New EN:** Gemini Notebook (formerly NotebookLM) lists Audio Overviews among its features. DocTalk does not create audio, and we did not check the other alternatives on this page for audio features. If audio summaries matter to your workflow, start with Gemini Notebook.

#### `altsNotebooklm.faq5Answer`

- **Old EN:** Consensus is specifically built for scientific research, searching across 200M+ academic papers. For analyzing your own documents, DocTalk provides citation highlighting and AskYourPDF integrates with Zotero for reference management.
- **Problem:** "200M+ academic papers" is not a vendor quote in the evidence.
- **Evidence (PR §14 + CF §6):** Free: "Basic Paper search; 10 Pro messages per month; ... Up to 3 Deep reviews per month"; Pro "$20/mo", "$12/mo" billed annually; "an AI academic search engine for peer-reviewed literature"; "Over 170 university libraries partner with Consensus." (paper count not a vendor quote)
- **Evidence (PR §10 + VE §2.12):** "Unlimited search across more than 138 million papers"; "Unlimited chat with papers with full-text access"; "Limited usage for Research Agent and Research Reports"; Pro "$49" "billed as $588 annually"; "sentence-level citations"; Pro "Custom extractions from uploaded papers"; "Dedicated Systematic Review Workflow"
- **Evidence (VE §2.6):** "Web, iOS, Android, Chrome extension, ChatGPT GPT, and the Zotero plugin"
- **New EN:** Consensus is built for scientific research: it is an AI search engine for peer-reviewed literature. Elicit searches more than 138 million papers. For analyzing your own documents, DocTalk provides citation highlighting and AskYourPDF integrates with Zotero.

#### `altsNotebooklm.ctaDescription`

- **Old EN:** No Google account needed. Upload a document and experience citation highlighting instantly.
- **Problem:** DocTalk claim: anonymous visitors cannot upload.
- **Evidence (CLAUDE.md + .claude/rules/frontend.md):** DocTalk: Free 300 credits/month, Plus $9.99, Pro $19.99; formats PDF/DOCX/PPTX/XLSX/TXT/MD/URL; anonymous use = the sample-document demo only (sign-in required to upload)
- **New EN:** No Google account needed. Open a sample document and see citation highlighting at once.

### `altsPdfai`

#### `altsPdfai.heroDescription`

- **Old EN:** PDF.ai combines AI chat with PDF editing, but its single-format limitation and basic citation system leave many users wanting more. Whether you need multi-format support, better citation highlighting, or more affordable pricing, these 7 alternatives deliver where PDF.ai falls short.
- **Problem:** "Combines AI chat with PDF editing" has no evidence; "basic citation system" is unverified.
- **Evidence (VE §2.11):** "You can only upload PDF (.pdf) files at the moment." (pdf.ai/faq)
- **Evidence (CF §3 + PR §5):** Positioning "chat-with-PDF + document parsing API"; "A separate developer API product"
- **New EN:** PDF.ai is a focused chat-with-PDF tool, but its FAQ says it accepts only PDF files. Whether you need Word, PowerPoint or Excel support, citations highlighted in the original document, or a different pricing model, these 7 alternatives are worth a look.

#### `altsPdfai.metaDescription`

- **Old EN:** PDF.ai combines AI chat with PDF editing, but its single-format limitation and basic citation system leave many users wanting more. Whether you need multi-format support, better citation highlighting, or more affordable pricing, these 7 alternatives deliver where PDF.ai falls short.
- **Problem:** Same editing claim.
- **Evidence (VE §2.11):** "You can only upload PDF (.pdf) files at the moment." (pdf.ai/faq)
- **New EN:** The 7 best PDF.ai alternatives in 2026 for multi-format document chat, compared on citations, free plans and published prices.

#### `altsPdfai.tableFreeTierCompetitor`

- **Old EN:** Limited free plan
- **Problem:** Vague; limits are published.
- **Evidence (VE §2.11):** "Monthly upload limit" = 1; "Monthly questions limit" = 100; "Max file size" 10MB
- **New EN:** 1 PDF, 100 questions/mo

#### `altsPdfai.faq1Answer`

- **Old EN:** Google NotebookLM is the best completely free alternative, offering multi-source notebooks and audio podcast generation. DocTalk also offers a free demo with no signup and a free tier with 300 credits per month, both providing more features than PDF.ai's free plan.
- **Problem:** "Completely free" omits limits; "more features than PDF.ai's free plan" unverified.
- **Evidence (VE §2.9 + CF §5):** "Is Gemini Notebook the same product as NotebookLM?"; notebooklm.google 301-redirects to notebook.google
- **Evidence (VE §2.9 + CF §5):** Standard: "100/user" notebooks, "50/notebook" sources ("Usage Limits (Subject to Change)")
- **Evidence (PR §11):** Standard limits table lists "3/day" Audio Overviews
- **Evidence (VE §2.11):** "Monthly upload limit" = 1; "Monthly questions limit" = 100; "Max file size" 10MB
- **Evidence (CLAUDE.md + .claude/rules/frontend.md):** DocTalk: Free 300 credits/month, Plus $9.99, Pro $19.99; formats PDF/DOCX/PPTX/XLSX/TXT/MD/URL; anonymous use = the sample-document demo only (sign-in required to upload)
- **New EN:** Google NotebookLM, now called Gemini Notebook, is a strong free alternative: its free Standard tier allows 100 notebooks and 50 sources per notebook, and it creates Audio Overviews. DocTalk also offers a free demo with no signup and a free tier with 300 credits per month. PDF.ai's free plan allows 1 upload and 100 questions a month.

#### `altsPdfai.faq2Answer`

- **Old EN:** Common reasons include PDF.ai's limited format support (PDF only), basic citation system without visual highlighting, fewer language options, and higher pricing compared to alternatives that offer more features for the same cost.
- **Problem:** "Basic citation system", "fewer language options", "higher pricing" are unverified.
- **Evidence (VE §2.11):** "You can only upload PDF (.pdf) files at the moment." (pdf.ai/faq)
- **Evidence (VE §2.11):** "Sources included / Every response is backed by sources extracted from the uploaded document." (no page number or highlight documented)
- **Evidence (VE §2.11 + CF §3):** Pro "$17 /mo Billed monthly"; "$10 /mo Billed yearly"; Pro = 100 uploads/mo, 1,000 q/mo; Ultimate "$27/user/mo monthly"
- **New EN:** Reasons vary. PDF.ai's FAQ says it accepts only PDF files, so people who also use Word, PowerPoint or Excel need another tool. Others want citations highlighted in the original document, which PDF.ai's product pages do not describe, or a different price point: PDF.ai Pro costs $17 per month billed monthly or $10 billed yearly.

#### `altsPdfai.faq3Answer`

- **Old EN:** DocTalk supports 7 formats (PDF, DOCX, PPTX, XLSX, TXT, Markdown, and web URLs), making it the most versatile alternative. PDF.ai only handles PDFs, so users needing multi-format support often switch to DocTalk or Humata.
- **Problem:** "Most versatile alternative" is false; "often switch to DocTalk or Humata" unsupported.
- **Evidence (VE §2.9 + CF §5):** "Microsoft Word (docx), Text (txt), Markdown (md), PDF files (pdf), CSV (csv), and PowerPoint (pptx) files"; "ePub files"; plus Google Docs/Slides/Sheets, web URLs, public YouTube URLs, audio, images, pasted text (no XLSX)
- **Evidence (VE §2.1):** Free = "PDF". Pro = "PDF, DOC, DOCX, SCAN, WEBSITE, EPUB, MD, TXT"
- **Evidence (VE §2.11):** "You can only upload PDF (.pdf) files at the moment." (pdf.ai/faq)
- **New EN:** Gemini Notebook (formerly NotebookLM) accepts the widest range of sources on this list, from Word, PowerPoint and ePub files to web URLs and YouTube videos. DocTalk reads 7 formats, including Excel, and ChatDOC's Pro plan adds Word, EPUB, Markdown, text and websites. PDF.ai only handles PDFs.

#### `altsPdfai.faq4Answer`

- **Old EN:** DocTalk provides the most advanced citation system with real-time visual highlighting. Click any citation to scroll to and highlight the exact source passage in your document, offering much stronger verification than PDF.ai's basic page references.
- **Problem:** "PDF.ai's basic page references" is not documented; "most advanced" unverified.
- **Evidence (VE §2.1):** "Every AI - generated answer includes page numbers from the original document. Click the page number to jump directly to the corresponding section."; "Numerical values in answers are highlighted. Click them to trace back to the original data"
- **Evidence (VE §2.3):** "Every answer shows the passage it came from, with page numbers for PDFs."
- **Evidence (VE §2.11):** "Sources included / Every response is backed by sources extracted from the uploaded document." (no page number or highlight documented)
- **New EN:** DocTalk scrolls to the cited passage and highlights it in your document when you click a citation. ChatDOC and Sharly AI say their answers show page numbers. PDF.ai says every response is backed by sources from the document, without describing page numbers or highlighting.

#### `altsPdfai.faq5Answer`

- **Old EN:** Humata offers the best team features with shared workspaces, role-based access, and a Team plan at $49/user/month. For individual users who want strong citation verification and multi-format support, DocTalk is the top choice.
- **Problem:** "Shared workspaces, role-based access" are not in the evidence.
- **Evidence (CF §4 + VE §2.10):** Free 60 pages/mo; Expert $9.99/mo (3 users, 500 pages, $0.02/extra page); Team $49/user/mo (10 users, 5,000 pages, $0.01/extra page, OCR, dept/folder permissions); Enterprise custom
- **Evidence (VE §2.3 + PR §6):** Free "Documents / month 10", "Messages / mo 50", inline citations "Limited"; Pro "$12.5/month billed yearly"; Team "$24/month per seat, billed yearly"
- **New EN:** Humata's Team plan ($49/user/month) covers up to 10 users with department and folder permissions, and Sharly AI sells a Team plan too. For individual users who want strong citation verification and multi-format support, DocTalk is the top choice.

#### `altsPdfai.whyIntro`

- **Old EN:** PDF.ai has its strengths in combining AI chat with PDF editing, but users frequently run into limitations that drive them to explore alternatives:
- **Problem:** "Combining AI chat with PDF editing" and "users frequently run into limitations" are unsupported.
- **Evidence (CF §3 + PR §5):** Positioning "chat-with-PDF + document parsing API"; "A separate developer API product"
- **New EN:** PDF.ai is a focused tool for chatting with PDF files, but some needs take you elsewhere:

#### `altsPdfai.whyReason2`

- **Old EN:** Basic citation references — PDF.ai provides page-level citations but lacks the real-time visual highlighting that tools like DocTalk offer for instant source verification.
- **Problem:** "Provides page-level citations but lacks highlighting" is not documented.
- **Evidence (VE §2.11):** "Sources included / Every response is backed by sources extracted from the uploaded document." (no page number or highlight documented)
- **New EN:** Citation style — PDF.ai says every response is backed by sources from your document, but its product pages do not describe page numbers or highlighting. DocTalk highlights the cited passage in the original document.

#### `altsPdfai.whyReason3`

- **Old EN:** Limited language support — PDF.ai primarily serves English-speaking users, while alternatives like DocTalk support 11 languages natively.
- **Problem:** "Primarily serves English-speaking users" is unverified.
- **Evidence (none):** No statement in VE, CF or PR supports this; removed or marked "Not verified".
- **New EN:** Interface language — DocTalk's interface is available in 11 languages. We did not verify which interface languages PDF.ai offers.

#### `altsPdfai.whyReason4`

- **Old EN:** Price vs. features — At $15/month for the paid plan, some users find better value in alternatives with broader capabilities at similar or lower price points.
- **Problem:** "$15/month" is wrong ($17 monthly, $10 yearly).
- **Evidence (VE §2.11 + CF §3):** Pro "$17 /mo Billed monthly"; "$10 /mo Billed yearly"; Pro = 100 uploads/mo, 1,000 q/mo; Ultimate "$27/user/mo monthly"
- **Evidence (CLAUDE.md + .claude/rules/frontend.md):** DocTalk: Free 300 credits/month, Plus $9.99, Pro $19.99; formats PDF/DOCX/PPTX/XLSX/TXT/MD/URL; anonymous use = the sample-document demo only (sign-in required to upload)
- **New EN:** Price — PDF.ai Pro costs $17 per month billed monthly, or $10 per month billed yearly (October 2026). DocTalk Plus costs $9.99 per month.

#### `altsPdfai.alt1Desc1`

- **Old EN:** DocTalk is the best PDF.ai alternative for users who need more than just PDF support. While PDF.ai focuses on PDFs with built-in editing, DocTalk handles 7 document formats (PDF, DOCX, PPTX, XLSX, TXT, Markdown, and URLs) with a superior citation system that highlights exact source passages in real time.
- **Problem:** "PDF.ai focuses on PDFs with built-in editing" and "superior citation system" are unsupported.
- **Evidence (VE §2.11):** "You can only upload PDF (.pdf) files at the moment." (pdf.ai/faq)
- **New EN:** DocTalk is the best PDF.ai alternative for users who need more than PDF support. While PDF.ai accepts only PDF files, DocTalk handles 7 document formats (PDF, DOCX, PPTX, XLSX, TXT, Markdown, and URLs), and its citations highlight the exact source passage in real time.

#### `altsPdfai.alt1Desc2`

- **Old EN:** DocTalk's real-time citation highlighting is its standout feature. Every AI answer includes clickable citations that scroll to and visually highlight the exact text in your document, making it easy to verify accuracy instantly. This goes far beyond PDF.ai's basic page references.
- **Problem:** "Far beyond PDF.ai's basic page references" is not documented.
- **Evidence (VE §2.11):** "Sources included / Every response is backed by sources extracted from the uploaded document." (no page number or highlight documented)
- **New EN:** DocTalk's real-time citation highlighting is its standout feature. Every AI answer includes clickable citations that scroll to and visually highlight the exact text in your document, making it easy to verify accuracy at once.

#### `altsPdfai.adv6`

- **Old EN:** Starting at $9.99/mo (vs $15/mo)
- **Problem:** "vs $15/mo" is wrong.
- **Evidence (VE §2.11 + CF §3):** Pro "$17 /mo Billed monthly"; "$10 /mo Billed yearly"; Pro = 100 uploads/mo, 1,000 q/mo; Ultimate "$27/user/mo monthly"
- **Evidence (CLAUDE.md + .claude/rules/frontend.md):** DocTalk: Free 300 credits/month, Plus $9.99, Pro $19.99; formats PDF/DOCX/PPTX/XLSX/TXT/MD/URL; anonymous use = the sample-document demo only (sign-in required to upload)
- **New EN:** Starting at $9.99/mo (PDF.ai Pro: $17/mo)

#### `altsPdfai.alt2Desc1`

- **Old EN:** ChatPDF is one of the original AI PDF chat tools and remains popular for its simplicity. Compared to PDF.ai, ChatPDF has a more streamlined interface focused purely on conversation rather than editing. It's quick to set up and easy to use, making it a good fit for users who just need fast answers.
- **Problem:** "Original tool", "remains popular", "rather than editing" are unsupported.
- **Evidence (PR §1):** "ChatPDF is free to try and requires no account to get started."
- **Evidence (VE §2.7):** "PDF (.pdf), Word (.doc, .docx), PowerPoint (.ppt, .pptx), Markdown (.md), and Text files (.txt)" (chatpdf.com FAQ)
- **Evidence (VE §2.7):** "...clickable citations instantly scroll to the exact source in your PDF." / feature card "Pages referenced"; in-document highlighting not stated
- **New EN:** ChatPDF is a simple AI document chat tool that you can use without an account. It reads PDF, Word, PowerPoint, Markdown and text files, and its citations scroll to the source. It's quick to start, making it a good fit for users who just need fast answers.

#### `altsPdfai.alt2Desc2Pre`

- **Old EN:** Like PDF.ai, ChatPDF is PDF-only, but it compensates with faster response times and a more generous free tier. See our
- **Problem:** "Like PDF.ai, ChatPDF is PDF-only" is false; "faster response times" unmeasured.
- **Evidence (VE §2.7):** "PDF (.pdf), Word (.doc, .docx), PowerPoint (.ppt, .pptx), Markdown (.md), and Text files (.txt)" (chatpdf.com FAQ)
- **Evidence (VE §2.7):** "We offer a free plan that lets you analyze 2 documents every day." (no page, size or question cap published, PR §1)
- **Evidence (VE §2.7):** "Entry price: not published. chatpdf.com/pricing and /plus return 404 today. The FAQ names 'ChatPDF Plus' with no price."
- **New EN:** Unlike PDF.ai, ChatPDF reads more than PDF, and its free plan covers 2 documents every day; ChatPDF does not publish a price for its Plus plan. See our

#### `altsPdfai.alt2BestFor`

- **Old EN:** Users who want the simplest possible PDF chat experience without extra editing features.
- **Problem:** "Without extra editing features" implies PDF.ai editing (no evidence).
- **Evidence (PR §1):** "ChatPDF is free to try and requires no account to get started."
- **New EN:** Users who want a simple document chat tool with no account needed.

#### `altsPdfai.alt3Desc2Pre`

- **Old EN:** AskYourPDF also focuses on PDFs but adds features like batch processing and a ChatGPT plugin that PDF.ai lacks. See our
- **Problem:** "Also focuses on PDFs" is false; "batch processing" unsupported; "ChatGPT plugin" is now a GPT.
- **Evidence (VE §2.6):** "Drag a PDF, DOCX, EPUB, or TXT file into the AskYourPDF chat reader, or paste a URL."
- **Evidence (VE §2.6):** "Web, iOS, Android, Chrome extension, ChatGPT GPT, and the Zotero plugin"
- **Evidence (VE §2.6):** "We return your answer with a citation back to the exact page in the original PDF. Click the citation to verify." (highlighting not stated)
- **New EN:** AskYourPDF also reads DOCX, EPUB and TXT files and URLs, and it is available as a Chrome extension, a ChatGPT GPT and mobile apps. Each answer cites the exact page. See our

#### `altsPdfai.alt4Desc1`

- **Old EN:** Humata is the go-to PDF.ai alternative for teams. While PDF.ai and most other tools focus on individual use, Humata provides shared workspaces, role-based access control, admin dashboards, and usage analytics. If your organization needs collaborative document analysis, Humata is purpose-built for that.
- **Problem:** "Shared workspaces, RBAC, admin dashboards, usage analytics" are not in the evidence; PDF.ai sells per-user plans.
- **Evidence (CF §4 + VE §2.10):** Free 60 pages/mo; Expert $9.99/mo (3 users, 500 pages, $0.02/extra page); Team $49/user/mo (10 users, 5,000 pages, $0.01/extra page, OCR, dept/folder permissions); Enterprise custom
- **New EN:** Humata is the go-to PDF.ai alternative for teams. Its Team plan covers up to 10 users with 5,000 pages a month, OCR, and department and folder permissions, and the Expert plan covers up to 3 users. If your organization needs collaborative document analysis, Humata is built for that.

#### `altsPdfai.alt4Desc2Pre`

- **Old EN:** The Team plan at $49/user/month is pricier than PDF.ai, but includes features no other tool in this category offers. See our
- **Problem:** "Features no other tool in this category offers" is an unverified negative.
- **Evidence (CF §4 + VE §2.10):** Free 60 pages/mo; Expert $9.99/mo (3 users, 500 pages, $0.02/extra page); Team $49/user/mo (10 users, 5,000 pages, $0.01/extra page, OCR, dept/folder permissions); Enterprise custom
- **Evidence (VE §2.11 + CF §3):** Pro "$17 /mo Billed monthly"; "$10 /mo Billed yearly"; Pro = 100 uploads/mo, 1,000 q/mo; Ultimate "$27/user/mo monthly"
- **New EN:** The Team plan costs $49/user/month, more than PDF.ai's Ultimate plan ($27/user/month billed monthly). See our

#### `altsPdfai.alt4BestFor`

- **Old EN:** Teams that need enterprise-grade document collaboration with role management.
- **Problem:** "Enterprise-grade ... role management" is not in the evidence.
- **Evidence (CF §4 + VE §2.10):** Free 60 pages/mo; Expert $9.99/mo (3 users, 500 pages, $0.02/extra page); Team $49/user/mo (10 users, 5,000 pages, $0.01/extra page, OCR, dept/folder permissions); Enterprise custom
- **New EN:** Teams that need shared document analysis with folder permissions.

#### `altsPdfai.alt5Desc1`

- **Old EN:** NotebookLM is the only completely free tool on this list, making it an attractive PDF.ai alternative for budget-conscious users. It supports multiple source types (PDFs, Google Docs, websites, YouTube) and generates unique Audio Overview podcasts from your sources.
- **Problem:** "Only completely free tool on this list" is false (several free tiers); source list incomplete.
- **Evidence (VE §2.9 + CF §5):** "Is Gemini Notebook the same product as NotebookLM?"; notebooklm.google 301-redirects to notebook.google
- **Evidence (VE §2.9 + CF §5):** Standard: "100/user" notebooks, "50/notebook" sources ("Usage Limits (Subject to Change)")
- **Evidence (VE §2.9 + CF §5):** "Microsoft Word (docx), Text (txt), Markdown (md), PDF files (pdf), CSV (csv), and PowerPoint (pptx) files"; "ePub files"; plus Google Docs/Slides/Sheets, web URLs, public YouTube URLs, audio, images, pasted text (no XLSX)
- **Evidence (PR §11):** Standard limits table lists "3/day" Audio Overviews
- **New EN:** NotebookLM, now called Gemini Notebook, has a free Standard tier (100 notebooks, 50 sources per notebook), making it an attractive PDF.ai alternative for budget-conscious users. It accepts many source types, including PDF, Word, PowerPoint, Google Docs, websites and YouTube videos, and creates Audio Overviews of your sources.

#### `altsPdfai.alt5Desc2Pre`

- **Old EN:** While NotebookLM lacks the PDF editing features that PDF.ai offers, its multi-source notebook approach and free pricing make it ideal for research and learning. See our
- **Problem:** "PDF editing features that PDF.ai offers" has no evidence.
- **Evidence (PR §11):** "you must... verify your age in your Google Account"
- **New EN:** Its multi-source notebook approach and free tier make it a good fit for research and learning; you need a Google account. See our

#### `altsPdfai.alt6Desc1`

- **Old EN:** ChatDOC excels at extracting structured data from documents. If you frequently work with tables, charts, and forms within PDFs, ChatDOC's table extraction is significantly more accurate than what PDF.ai offers. It also supports a few formats beyond PDF, including DOCX.
- **Problem:** "Significantly more accurate table extraction than PDF.ai" is unsupported.
- **Evidence (VE §2.1):** "Every AI - generated answer includes page numbers from the original document. Click the page number to jump directly to the corresponding section."; "Numerical values in answers are highlighted. Click them to trace back to the original data"
- **Evidence (VE §2.1):** Free = "PDF". Pro = "PDF, DOC, DOCX, SCAN, WEBSITE, EPUB, MD, TXT"
- **New EN:** ChatDOC focuses on tracing answers to the data behind them: numbers in its answers are highlighted, and you can click them to see the original data in the document. Every answer includes page numbers you can click to jump to the section. Its Pro plan adds formats beyond PDF, including DOCX.

#### `altsPdfai.alt6Desc2`

- **Old EN:** For users switching from PDF.ai specifically because of poor table handling, ChatDOC is a strong choice. It may lack PDF.ai's editing tools but makes up for it with superior data extraction capabilities.
- **Problem:** "Poor table handling" and "PDF.ai's editing tools" are unsupported.
- **Evidence (VE §2.1):** "Auto-renewal price: $8.99 for 30 days. Original price: $16.99 for 30 days."; "$89.9" "/360 days"
- **Evidence (VE §2.1):** homepage table "5/day, 10 in total" files, "300" pages per file vs guide "Upload up to 2 files every 24 hours." / "Each file limited to 20 pages."
- **New EN:** ChatDOC Pro costs $8.99 for 30 days on auto-renewal, or $89.9 for 360 days. Its own pages disagree on the free plan's limits, so check them before you rely on it.

#### `altsPdfai.alt7Desc1`

- **Old EN:** Sharly focuses on speed and simplicity with an AI assistant that can summarize, explain, and answer questions about your documents quickly. It offers a cleaner interface than PDF.ai and focuses on the core Q&A experience without the added complexity of editing tools.
- **Problem:** "Cleaner interface than PDF.ai" and "editing tools" are unsupported.
- **Evidence (PR §6):** Homepage title "Sharly AI | Research Assistant for Summarizing, Comparing & Citing Documents"
- **Evidence (VE §2.3):** "Every answer shows the passage it came from, with page numbers for PDFs."
- **New EN:** Sharly AI is a research assistant for summarizing, comparing and citing documents. It says every answer shows the passage it came from, with page numbers for PDFs.

#### `altsPdfai.alt7Desc2`

- **Old EN:** Sharly supports multiple file formats and offers competitive pricing. It's a good middle-ground choice for users who found PDF.ai too feature-heavy but want more than what basic PDF chat tools provide.
- **Problem:** "Competitive pricing" and "PDF.ai too feature-heavy" are unsupported.
- **Evidence (VE §2.3):** "Drop in PDF, DOCX,PPTX, Notion Exports - Sharly handles it all"
- **Evidence (VE §2.3 + PR §6):** Free "Documents / month 10", "Messages / mo 50", inline citations "Limited"; Pro "$12.5/month billed yearly"; Team "$24/month per seat, billed yearly"
- **New EN:** Sharly AI reads PDF, DOCX and PPTX files and Notion exports. Pro costs $12.5 per month billed yearly, and the free plan is capped (its pricing page lists 10 documents and 50 messages a month).

#### `altsPdfai.alt7BestFor`

- **Old EN:** Users who want fast, no-frills AI document analysis with a clean interface.
- **Problem:** "No-frills ... clean interface" is unsupported.
- **Evidence (PR §6):** Homepage title "Sharly AI | Research Assistant for Summarizing, Comparing & Citing Documents"
- **Evidence (VE §2.3):** "Every answer shows the passage it came from, with page numbers for PDFs."
- **New EN:** Users who summarize and compare documents and want page-numbered sources.

#### `altsPdfai.chooseNeed4`

- **Old EN:** Team collaboration with admin controls
- **Problem:** "Admin controls" is not in the evidence; Humata documents department and folder permissions.
- **Evidence (CF §4 + VE §2.10):** Free 60 pages/mo; Expert $9.99/mo (3 users, 500 pages, $0.02/extra page); Team $49/user/mo (10 users, 5,000 pages, $0.01/extra page, OCR, dept/folder permissions); Enterprise custom
- **New EN:** Team collaboration with folder permissions

#### `altsPdfai.chooseNeed7`

- **Old EN:** Fast, clean AI document assistant
- **Problem:** "Fast, clean" is unmeasured; Sharly AI describes itself as a tool for summarizing and comparing documents.
- **Evidence (PR §6):** Homepage title "Sharly AI | Research Assistant for Summarizing, Comparing & Citing Documents"
- **New EN:** Summarizing and comparing documents

#### `altsPdfai.ctaDescription`

- **Old EN:** Upload any document and get cited answers in seconds. No signup required.
- **Problem:** DocTalk claim: anonymous visitors cannot upload.
- **Evidence (CLAUDE.md + .claude/rules/frontend.md):** DocTalk: Free 300 credits/month, Plus $9.99, Pro $19.99; formats PDF/DOCX/PPTX/XLSX/TXT/MD/URL; anonymous use = the sample-document demo only (sign-in required to upload)
- **New EN:** Open a sample document and get cited answers in seconds. No signup required.

### `altsAskyourpdf`

#### `altsAskyourpdf.heroDescription`

- **Old EN:** AskYourPDF is a popular AI PDF chat tool, but it has limitations in file format support and citation verification. Whether you need multi-format document analysis, better citation highlighting, or more affordable pricing, these 7 alternatives offer compelling options for every use case.
- **Problem:** "Limitations in file format support and citation verification" assumes PDF-only and weak citations.
- **Evidence (VE §2.6):** "Drag a PDF, DOCX, EPUB, or TXT file into the AskYourPDF chat reader, or paste a URL."
- **Evidence (VE §3):** "The chat page lists no PPT/PPTX." (no XLSX listed either)
- **Evidence (VE §2.6):** "Web, iOS, Android, Chrome extension, ChatGPT GPT, and the Zotero plugin"
- **New EN:** AskYourPDF is an AI PDF chat tool with many integrations. Its chat reader accepts PDF, DOCX, EPUB and TXT files or a URL, but it does not list PowerPoint or Excel files. Whether you need those formats, citations highlighted in the original document, or a different pricing model, these 7 alternatives offer options for every use case.

#### `altsAskyourpdf.metaDescription`

- **Old EN:** AskYourPDF is a popular AI PDF chat tool, but it has limitations in file format support and citation verification. Whether you need multi-format document analysis, better citation highlighting, or more affordable pricing, these 7 alternatives offer compelling options for every use case.
- **Problem:** Same claim.
- **Evidence (VE §2.6):** "Drag a PDF, DOCX, EPUB, or TXT file into the AskYourPDF chat reader, or paste a URL."
- **New EN:** The 7 best AskYourPDF alternatives in 2026, compared on file formats, citation style, free plans and published prices.

#### `altsAskyourpdf.tablePdfOnly`

- **Old EN:** PDF only
- **Problem:** AskYourPDF cell "PDF only" is false.
- **Evidence (VE §2.6):** "Drag a PDF, DOCX, EPUB, or TXT file into the AskYourPDF chat reader, or paste a URL."
- **New EN:** PDF, DOCX, EPUB, TXT, URL

#### `altsAskyourpdf.tableFreeTierCompetitor`

- **Old EN:** Limited free plan
- **Problem:** Vague; limits are published.
- **Evidence (VE §2.6):** "1 documents per day"; "100 pages per document"; "Max upload size: 15MB"; "50 questions per day"
- **New EN:** 1 doc/day, 50 questions/day

#### `altsAskyourpdf.faq1Answer`

- **Old EN:** Google NotebookLM is completely free with multi-source notebooks and audio summaries. DocTalk also offers a free demo with no signup and a free tier with 300 credits per month, making both strong options for users looking to switch from AskYourPDF without paying.
- **Problem:** "Completely free" omits limits.
- **Evidence (VE §2.9 + CF §5):** "Is Gemini Notebook the same product as NotebookLM?"; notebooklm.google 301-redirects to notebook.google
- **Evidence (VE §2.9 + CF §5):** Standard: "100/user" notebooks, "50/notebook" sources ("Usage Limits (Subject to Change)")
- **Evidence (PR §11):** Standard limits table lists "3/day" Audio Overviews
- **Evidence (CLAUDE.md + .claude/rules/frontend.md):** DocTalk: Free 300 credits/month, Plus $9.99, Pro $19.99; formats PDF/DOCX/PPTX/XLSX/TXT/MD/URL; anonymous use = the sample-document demo only (sign-in required to upload)
- **New EN:** Google NotebookLM, now called Gemini Notebook, has a free Standard tier with usage limits (100 notebooks, 50 sources per notebook) and creates Audio Overviews. DocTalk also offers a free demo with no signup and a free tier with 300 credits per month, making both strong options for users looking to switch from AskYourPDF without paying.

#### `altsAskyourpdf.faq2Answer`

- **Old EN:** Common reasons include limited file format support (AskYourPDF focuses mainly on PDFs), lack of real-time citation highlighting, inconsistent OCR quality on scanned documents, and pricing that can be high relative to features offered.
- **Problem:** "Focuses mainly on PDFs", "inconsistent OCR quality" are false or unsupported.
- **Evidence (VE §2.6):** "Drag a PDF, DOCX, EPUB, or TXT file into the AskYourPDF chat reader, or paste a URL."
- **Evidence (VE §3):** "The chat page lists no PPT/PPTX." (no XLSX listed either)
- **Evidence (VE §2.6):** "We return your answer with a citation back to the exact page in the original PDF. Click the citation to verify." (highlighting not stated)
- **Evidence (VE §2.6 + PR §3):** Premium "$11.99 per month billed yearly"; Pro "$14.99 per month billed yearly"; monthly-billed price "not shown"; Enterprise "Custom"
- **New EN:** Reasons vary. AskYourPDF's chat reader does not list PowerPoint or Excel files, and its site does not say whether cited passages are highlighted. Its paid plans are priced per month but billed yearly ($11.99 for Premium), and the monthly-billed price is not shown.

#### `altsAskyourpdf.faq3Answer`

- **Old EN:** DocTalk supports 7 formats (PDF, DOCX, PPTX, XLSX, TXT, Markdown, and web URLs), far more than AskYourPDF which primarily handles PDFs. This makes DocTalk ideal for users working with diverse document types.
- **Problem:** "Far more than AskYourPDF which primarily handles PDFs" is false.
- **Evidence (VE §2.9 + CF §5):** "Microsoft Word (docx), Text (txt), Markdown (md), PDF files (pdf), CSV (csv), and PowerPoint (pptx) files"; "ePub files"; plus Google Docs/Slides/Sheets, web URLs, public YouTube URLs, audio, images, pasted text (no XLSX)
- **Evidence (VE §2.6):** "Drag a PDF, DOCX, EPUB, or TXT file into the AskYourPDF chat reader, or paste a URL."
- **New EN:** Gemini Notebook (formerly NotebookLM) accepts the widest range of sources on this list, from Word, PowerPoint and ePub files to web URLs and YouTube videos. DocTalk reads 7 formats, including PowerPoint and Excel. AskYourPDF reads PDF, DOCX, EPUB, TXT and URLs.

#### `altsAskyourpdf.faq4Answer`

- **Old EN:** DocTalk offers the most advanced citation system with real-time visual highlighting that scrolls to and highlights the exact source passage. AskYourPDF provides page references but lacks the interactive visual verification that DocTalk offers.
- **Problem:** "Lacks the interactive visual verification" omits the documented click-to-verify.
- **Evidence (VE §2.6):** "We return your answer with a citation back to the exact page in the original PDF. Click the citation to verify." (highlighting not stated)
- **Evidence (VE §2.1):** "Every AI - generated answer includes page numbers from the original document. Click the page number to jump directly to the corresponding section."; "Numerical values in answers are highlighted. Click them to trace back to the original data"
- **New EN:** DocTalk scrolls to the cited passage and highlights it in your document. AskYourPDF already cites the exact page and lets you click the citation to verify it; its site does not say whether the passage is highlighted. ChatDOC also documents clickable page numbers.

#### `altsAskyourpdf.chooseNeed2`

- **Old EN:** Simple PDF chat with fast responses
- **Problem:** "Fast responses" is unmeasured.
- **Evidence (PR §1):** "ChatPDF is free to try and requires no account to get started."
- **New EN:** Simple document chat without an account

#### `altsAskyourpdf.chooseNeed3`

- **Old EN:** PDF annotation + AI chat in one tool
- **Problem:** "PDF annotation" has no evidence.
- **Evidence (CF §3 + PR §5):** Positioning "chat-with-PDF + document parsing API"; "A separate developer API product"
- **Evidence (VE §2.11):** "You can only upload PDF (.pdf) files at the moment." (pdf.ai/faq)
- **New EN:** PDF chat plus a document-parsing API

#### `altsAskyourpdf.chooseNeed4`

- **Old EN:** Team collaboration with shared workspaces
- **Problem:** "Shared workspaces" is not in the evidence.
- **Evidence (CF §4 + VE §2.10):** Free 60 pages/mo; Expert $9.99/mo (3 users, 500 pages, $0.02/extra page); Team $49/user/mo (10 users, 5,000 pages, $0.01/extra page, OCR, dept/folder permissions); Enterprise custom
- **New EN:** Team collaboration with folder permissions

#### `altsAskyourpdf.whyIntro`

- **Old EN:** AskYourPDF is a solid tool for basic PDF Q&A, but many users find themselves needing more. The most common reasons people look for alternatives include:
- **Problem:** "Basic PDF Q&A" and "many users find themselves needing more" are unsupported.
- **Evidence (VE §2.6):** "Web, iOS, Android, Chrome extension, ChatGPT GPT, and the Zotero plugin"
- **New EN:** AskYourPDF is a solid tool for PDF Q&A with many integrations, but some needs take you elsewhere:

#### `altsAskyourpdf.whyReason1`

- **Old EN:** PDF-only limitation — AskYourPDF focuses exclusively on PDFs, leaving users who work with Word documents, spreadsheets, or presentations without support.
- **Problem:** "Focuses exclusively on PDFs" is false.
- **Evidence (VE §2.6):** "Drag a PDF, DOCX, EPUB, or TXT file into the AskYourPDF chat reader, or paste a URL."
- **Evidence (VE §3):** "The chat page lists no PPT/PPTX." (no XLSX listed either)
- **New EN:** Format coverage — AskYourPDF's chat reader accepts PDF, DOCX, EPUB and TXT files and URLs, but it does not list PowerPoint or Excel files.

#### `altsAskyourpdf.whyReason2`

- **Old EN:** Basic citation system — While AskYourPDF provides page references, it lacks real-time visual highlighting to verify answers against source text.
- **Problem:** "Lacks real-time visual highlighting" is an unverified negative.
- **Evidence (VE §2.6):** "We return your answer with a citation back to the exact page in the original PDF. Click the citation to verify." (highlighting not stated)
- **New EN:** Citation style — AskYourPDF cites the exact page and lets you click to verify, but its site does not say whether the passage is highlighted. DocTalk highlights the cited passage in the original document.

#### `altsAskyourpdf.whyReason3`

- **Old EN:** OCR inconsistency — Scanned PDFs and image-heavy documents can produce unreliable text extraction, affecting answer quality.
- **Problem:** "OCR inconsistency" is unsupported.
- **Evidence (VE §2.6):** "1 documents per day"; "100 pages per document"; "Max upload size: 15MB"; "50 questions per day"
- **New EN:** Free-plan limits — The free plan allows 1 document a day, up to 100 pages and 15 MB per document, and 50 questions a day.

#### `altsAskyourpdf.whyReason4`

- **Old EN:** Pricing concerns — At $14.99/month for the premium plan, some users find better value in alternatives that offer more features at lower price points.
- **Problem:** "$14.99/month for the premium plan" is wrong ($14.99 is Pro; Premium $11.99 billed yearly).
- **Evidence (VE §2.6 + PR §3):** Premium "$11.99 per month billed yearly"; Pro "$14.99 per month billed yearly"; monthly-billed price "not shown"; Enterprise "Custom"
- **Evidence (CLAUDE.md + .claude/rules/frontend.md):** DocTalk: Free 300 credits/month, Plus $9.99, Pro $19.99; formats PDF/DOCX/PPTX/XLSX/TXT/MD/URL; anonymous use = the sample-document demo only (sign-in required to upload)
- **New EN:** Pricing — Premium costs $11.99 per month billed yearly, and the pricing page does not show a monthly-billed price. DocTalk Plus costs $9.99 per month, billed monthly.

#### `altsAskyourpdf.alt1Desc1`

- **Old EN:** DocTalk is the top alternative to AskYourPDF, offering everything AskYourPDF does plus multi-format support for 7 document types (PDF, DOCX, PPTX, XLSX, TXT, Markdown, and URLs). Its standout feature is real-time citation highlighting that visually verifies every AI answer against the source document.
- **Problem:** "Offering everything AskYourPDF does" is false (no Chrome extension, Zotero, API, EPUB).
- **Evidence (VE §2.6):** "Web, iOS, Android, Chrome extension, ChatGPT GPT, and the Zotero plugin"
- **Evidence (VE §2.6):** "Drag a PDF, DOCX, EPUB, or TXT file into the AskYourPDF chat reader, or paste a URL."
- **New EN:** DocTalk is the top alternative to AskYourPDF for users who want highlighted citations and broader format support: it reads 7 document types (PDF, DOCX, PPTX, XLSX, TXT, Markdown, and URLs), including PowerPoint and Excel. Its standout feature is real-time citation highlighting that visually verifies every AI answer against the source document.

#### `altsAskyourpdf.alt1Desc2`

- **Old EN:** Unlike AskYourPDF, DocTalk supports 11 languages natively, offers a completely free demo with no signup required, and provides two AI performance modes (Flash and Pro) so you can optimize for speed or accuracy.
- **Problem:** "Unlike AskYourPDF" for languages and demo is unverified; must say what AskYourPDF does better.
- **Evidence (VE §2.6):** "Web, iOS, Android, Chrome extension, ChatGPT GPT, and the Zotero plugin"
- **Evidence (PR §3):** "whether an anonymous upload actually completes is `not visible without signup`"
- **New EN:** DocTalk also supports 11 interface languages, offers a free demo with no signup required, and provides two AI performance modes (Flash and Pro) so you can optimize for speed or accuracy. It has no browser extension, Zotero plugin or public API, so AskYourPDF remains stronger on integrations.

#### `altsAskyourpdf.adv1`

- **Old EN:** 7 document formats vs PDF-only
- **Problem:** "vs PDF-only" is false.
- **Evidence (VE §2.6):** "Drag a PDF, DOCX, EPUB, or TXT file into the AskYourPDF chat reader, or paste a URL."
- **New EN:** 7 document formats, including PowerPoint and Excel

#### `altsAskyourpdf.adv6`

- **Old EN:** Starting at $9.99/mo (vs $14.99/mo)
- **Problem:** "vs $14.99/mo" names the Pro price as the entry price.
- **Evidence (VE §2.6 + PR §3):** Premium "$11.99 per month billed yearly"; Pro "$14.99 per month billed yearly"; monthly-billed price "not shown"; Enterprise "Custom"
- **Evidence (CLAUDE.md + .claude/rules/frontend.md):** DocTalk: Free 300 credits/month, Plus $9.99, Pro $19.99; formats PDF/DOCX/PPTX/XLSX/TXT/MD/URL; anonymous use = the sample-document demo only (sign-in required to upload)
- **New EN:** Starting at $9.99/mo (AskYourPDF Premium: $11.99/mo billed yearly)

#### `altsAskyourpdf.alt2Desc1`

- **Old EN:** ChatPDF is one of the most well-known AI PDF chat tools. It offers a clean, simple interface for uploading PDFs and asking questions. Like AskYourPDF, it focuses exclusively on PDF files, but it tends to have faster response times and a more intuitive user experience.
- **Problem:** "Focuses exclusively on PDF files" is false; "faster response times" unmeasured.
- **Evidence (PR §1):** "ChatPDF is free to try and requires no account to get started."
- **Evidence (VE §2.7):** "PDF (.pdf), Word (.doc, .docx), PowerPoint (.ppt, .pptx), Markdown (.md), and Text files (.txt)" (chatpdf.com FAQ)
- **Evidence (VE §2.7):** "...clickable citations instantly scroll to the exact source in your PDF." / feature card "Pages referenced"; in-document highlighting not stated
- **New EN:** ChatPDF offers a clean, simple interface for asking questions about documents, and you can start without an account. It reads PDF, Word, PowerPoint, Markdown and text files, and its citations scroll to the source.

#### `altsAskyourpdf.alt2Desc2Pre`

- **Old EN:** ChatPDF's free tier allows limited daily usage, making it a good option for occasional users. However, it lacks multi-format support and real-time citation highlighting. See our
- **Problem:** "Lacks multi-format support and real-time citation highlighting" is false or unverified.
- **Evidence (VE §2.7):** "We offer a free plan that lets you analyze 2 documents every day." (no page, size or question cap published, PR §1)
- **Evidence (VE §2.7):** "Entry price: not published. chatpdf.com/pricing and /plus return 404 today. The FAQ names 'ChatPDF Plus' with no price."
- **New EN:** ChatPDF's free plan lets you analyze 2 documents every day, making it a good option for occasional users. It does not publish a price for ChatPDF Plus. See our

#### `altsAskyourpdf.alt2BestFor`

- **Old EN:** Users who want a simple, fast PDF chat experience with minimal setup.
- **Problem:** "Fast" is unmeasured.
- **Evidence (PR §1):** "ChatPDF is free to try and requires no account to get started."
- **New EN:** Users who want a simple document chat tool with no account needed.

#### `altsAskyourpdf.alt3Desc1`

- **Old EN:** PDF.ai combines AI chat with built-in PDF editing capabilities, letting you both ask questions about and annotate your documents in one place. This dual functionality sets it apart from AskYourPDF, which focuses purely on the Q&A aspect.
- **Problem:** "Built-in PDF editing ... annotate" has no evidence.
- **Evidence (CF §3 + PR §5):** Positioning "chat-with-PDF + document parsing API"; "A separate developer API product"
- **Evidence (VE §2.11):** "Monthly upload limit" = 1; "Monthly questions limit" = 100; "Max file size" 10MB
- **Evidence (VE §2.11 + CF §3):** Pro "$17 /mo Billed monthly"; "$10 /mo Billed yearly"; Pro = 100 uploads/mo, 1,000 q/mo; Ultimate "$27/user/mo monthly"
- **New EN:** PDF.ai is a focused chat-with-PDF tool that also sells a separate document-parsing API for developers. Its free Hobby plan allows 1 upload and 100 questions a month, and Pro costs $17 per month billed monthly or $10 billed yearly.

#### `altsAskyourpdf.alt3Desc2Pre`

- **Old EN:** The tool is PDF-only like AskYourPDF, but its editing features make it useful for users who need to mark up documents alongside their AI analysis. See our
- **Problem:** "PDF-only like AskYourPDF" is false for AskYourPDF; "editing features" has no evidence.
- **Evidence (VE §2.11):** "You can only upload PDF (.pdf) files at the moment." (pdf.ai/faq)
- **New EN:** Its FAQ says you can only upload PDF files at the moment, so it suits users who work only with PDFs. See our

#### `altsAskyourpdf.alt3BestFor`

- **Old EN:** Users who need PDF annotation and editing alongside AI chat features.
- **Problem:** "PDF annotation and editing" has no evidence.
- **Evidence (VE §2.11):** "You can only upload PDF (.pdf) files at the moment." (pdf.ai/faq)
- **Evidence (CF §3 + PR §5):** Positioning "chat-with-PDF + document parsing API"; "A separate developer API product"
- **New EN:** PDF-only users and developers who want a document-parsing API.

#### `altsAskyourpdf.alt4Desc1`

- **Old EN:** Humata is an enterprise-focused AI document tool that excels at team collaboration. It offers shared workspaces, role-based access control, and the ability to analyze large document sets together. For organizations outgrowing AskYourPDF, Humata provides the team infrastructure they need.
- **Problem:** "Shared workspaces, RBAC, analyze large sets together" are not in the evidence.
- **Evidence (CF §4 + VE §2.10):** Free 60 pages/mo; Expert $9.99/mo (3 users, 500 pages, $0.02/extra page); Team $49/user/mo (10 users, 5,000 pages, $0.01/extra page, OCR, dept/folder permissions); Enterprise custom
- **New EN:** Humata is a team-focused AI document tool. Its Team plan covers up to 10 users with 5,000 pages a month, OCR, and department and folder permissions. For organizations outgrowing AskYourPDF, Humata provides team plans with page-based pricing.

#### `altsAskyourpdf.alt4Desc2Pre`

- **Old EN:** While more expensive than AskYourPDF (Team plan at $49/user/month), Humata justifies its price with enterprise features like admin dashboards, usage analytics, and priority support. See our
- **Problem:** "Admin dashboards, usage analytics, priority support" are not in the evidence.
- **Evidence (CF §4 + VE §2.10):** Free 60 pages/mo; Expert $9.99/mo (3 users, 500 pages, $0.02/extra page); Team $49/user/mo (10 users, 5,000 pages, $0.01/extra page, OCR, dept/folder permissions); Enterprise custom
- **New EN:** The Team plan costs $49/user/month, and the Expert plan costs $9.99/month for up to 3 users and 500 pages. See our

#### `altsAskyourpdf.alt4BestFor`

- **Old EN:** Teams and enterprises that need shared document workspaces with role management.
- **Problem:** "Role management" is not in the evidence.
- **Evidence (CF §4 + VE §2.10):** Free 60 pages/mo; Expert $9.99/mo (3 users, 500 pages, $0.02/extra page); Team $49/user/mo (10 users, 5,000 pages, $0.01/extra page, OCR, dept/folder permissions); Enterprise custom
- **New EN:** Teams and enterprises that need shared document analysis with folder permissions.

#### `altsAskyourpdf.alt5Desc1`

- **Old EN:** NotebookLM is Google's free AI notebook tool that lets you upload multiple sources (PDFs, Google Docs, websites, YouTube videos) and chat across all of them simultaneously. Its unique Audio Overview feature generates podcast-style summaries of your sources.
- **Problem:** "Free" omits limits; "unique ... podcast-style" unsupported; source list incomplete.
- **Evidence (VE §2.9 + CF §5):** "Is Gemini Notebook the same product as NotebookLM?"; notebooklm.google 301-redirects to notebook.google
- **Evidence (VE §2.9 + CF §5):** "Microsoft Word (docx), Text (txt), Markdown (md), PDF files (pdf), CSV (csv), and PowerPoint (pptx) files"; "ePub files"; plus Google Docs/Slides/Sheets, web URLs, public YouTube URLs, audio, images, pasted text (no XLSX)
- **Evidence (PR §11):** Standard limits table lists "3/day" Audio Overviews
- **New EN:** NotebookLM, now called Gemini Notebook, is Google's AI notebook tool. It lets you add many sources (PDF, Word, PowerPoint, Google Docs, websites, YouTube videos) and chat across all of them at once. It can also create Audio Overviews of your sources.

#### `altsAskyourpdf.alt5Desc2Pre`

- **Old EN:** The biggest advantage over AskYourPDF is that NotebookLM is completely free. However, it requires a Google account and doesn't offer the same depth of single-document analysis. See our
- **Problem:** "Completely free" omits limits.
- **Evidence (VE §2.9 + CF §5):** Standard: "100/user" notebooks, "50/notebook" sources ("Usage Limits (Subject to Change)")
- **Evidence (PR §11):** "you must... verify your age in your Google Account"
- **Evidence (VE §2.9):** "To get the full quoted text, hover over any citation." / "To navigate directly to the quote and review it in context, select a citation." / no page number documented
- **New EN:** Its biggest advantage over AskYourPDF is its free Standard tier (100 notebooks, 50 sources per notebook). It requires a Google account, and Google does not document page numbers for its citations. See our

#### `altsAskyourpdf.alt6Desc1`

- **Old EN:** ChatDOC specializes in structured data extraction from documents, making it particularly effective for tables, charts, and forms. If you work with data-heavy PDFs like financial reports or research papers with complex tables, ChatDOC often extracts this information more accurately than AskYourPDF.
- **Problem:** "Often extracts more accurately than AskYourPDF" is unsupported.
- **Evidence (VE §2.1):** "Every AI - generated answer includes page numbers from the original document. Click the page number to jump directly to the corresponding section."; "Numerical values in answers are highlighted. Click them to trace back to the original data"
- **New EN:** ChatDOC focuses on tracing answers to the data behind them: numbers in its answers are highlighted, and you can click them to see the original data. Every answer includes page numbers that you can click to jump to the section, which suits data-heavy PDFs like financial reports.

#### `altsAskyourpdf.alt6Desc2`

- **Old EN:** ChatDOC supports PDF, DOCX, and a few other formats, putting it between AskYourPDF (PDF-only) and DocTalk (7 formats) in terms of versatility. Its table extraction is a standout feature.
- **Problem:** "AskYourPDF (PDF-only)" is false; "table extraction is a standout" unsupported.
- **Evidence (VE §2.1):** Free = "PDF". Pro = "PDF, DOC, DOCX, SCAN, WEBSITE, EPUB, MD, TXT"
- **Evidence (VE §2.1):** "Auto-renewal price: $8.99 for 30 days. Original price: $16.99 for 30 days."; "$89.9" "/360 days"
- **Evidence (VE §2.6):** "Drag a PDF, DOCX, EPUB, or TXT file into the AskYourPDF chat reader, or paste a URL."
- **New EN:** ChatDOC's free plan reads PDF; Pro ($8.99 for 30 days on auto-renewal) adds Word, EPUB, Markdown, text, scanned files and websites.

#### `altsAskyourpdf.alt7Desc1`

- **Old EN:** Consensus takes a unique approach by searching across millions of published academic papers rather than analyzing uploaded documents. For researchers who need to find evidence across the scientific literature, Consensus offers something entirely different from AskYourPDF's single-document analysis.
- **Problem:** "Millions of papers" count is not a vendor quote in the evidence.
- **Evidence (PR §14 + CF §6):** Free: "Basic Paper search; 10 Pro messages per month; ... Up to 3 Deep reviews per month"; Pro "$20/mo", "$12/mo" billed annually; "an AI academic search engine for peer-reviewed literature"; "Over 170 university libraries partner with Consensus." (paper count not a vendor quote)
- **New EN:** Consensus is an AI academic search engine for peer-reviewed literature. Rather than analyzing a document you upload, it searches published research, which suits researchers who need evidence across the scientific literature.

#### `altsAskyourpdf.alt7Desc2`

- **Old EN:** While not a direct replacement for AskYourPDF (you can't upload your own documents), Consensus is invaluable for academic research, literature reviews, and finding citations across published work. It pairs well with tools like DocTalk for a complete research workflow.
- **Problem:** "You can't upload your own documents" is an unverified negative.
- **Evidence (PR §14 + CF §6):** Free: "Basic Paper search; 10 Pro messages per month; ... Up to 3 Deep reviews per month"; Pro "$20/mo", "$12/mo" billed annually; "an AI academic search engine for peer-reviewed literature"; "Over 170 university libraries partner with Consensus." (paper count not a vendor quote)
- **New EN:** It is not a direct replacement for AskYourPDF, but it helps with literature reviews and finding published evidence. The free plan includes basic paper search, 10 Pro messages and up to 3 Deep reviews a month; Pro costs $20 per month, or $12 per month billed annually. It pairs well with tools like DocTalk.

#### `altsAskyourpdf.ctaDescription`

- **Old EN:** Upload any document and get cited answers in seconds. No signup required.
- **Problem:** DocTalk claim: anonymous visitors cannot upload.
- **Evidence (CLAUDE.md + .claude/rules/frontend.md):** DocTalk: Free 300 credits/month, Plus $9.99, Pro $19.99; formats PDF/DOCX/PPTX/XLSX/TXT/MD/URL; anonymous use = the sample-document demo only (sign-in required to upload)
- **New EN:** Open a sample document and get cited answers in seconds. No signup required.

### `altsHumata`

#### `altsHumata.heroDescription`

- **Old EN:** Humata has built a solid AI document analysis tool with unique team features and video support, but its page-based pricing, English-only interface, and lack of citation highlighting leave room for improvement. Whether you need better citations, more document formats, multilingual support, or simply better value for individual use, these five alternatives are worth considering.
- **Problem:** "Video support", "English-only interface", "lack of citation highlighting" are unsupported or contradicted.
- **Evidence (CF §4 + VE §2.10):** Free 60 pages/mo; Expert $9.99/mo (3 users, 500 pages, $0.02/extra page); Team $49/user/mo (10 users, 5,000 pages, $0.01/extra page, OCR, dept/folder permissions); Enterprise custom
- **Evidence (VE §2.10):** "Formats: not stated on the homepage, pricing page or docs pages checked." (no video, Word or other format evidence in VE, CF or PR)
- **Evidence (VE §2.10):** "Highlights citations" (heading) / "Build trust with cited links into your source files." / "Each answer Humata generates will cite relevant sections..."; page number only in API docs
- **New EN:** Humata has built a solid AI document analysis tool with team plans for up to 10 users, but its page-based pricing means long documents use up the allowance quickly. Whether you want per-question pricing, a free tier, listed support for Word, PowerPoint and Excel, or an 11-language interface, these five alternatives are worth considering.

#### `altsHumata.metaDescription`

- **Old EN:** Humata has built a solid AI document analysis tool with unique team features and video support, but its page-based pricing, English-only interface, and lack of citation highlighting leave room for improvement. Whether you need better citations, more document formats, multilingual support, or simply better value for individual use, these five alternatives are worth considering.
- **Problem:** Same unsupported claims; ~390 characters.
- **Evidence (CF §4 + VE §2.10):** Free 60 pages/mo; Expert $9.99/mo (3 users, 500 pages, $0.02/extra page); Team $49/user/mo (10 users, 5,000 pages, $0.01/extra page, OCR, dept/folder permissions); Enterprise custom
- **New EN:** Five Humata AI alternatives for 2026, compared with Humata's page-based pricing on citations, file formats, free tiers and team needs.

#### `altsHumata.alt1Desc1`

- **Old EN:** DocTalk addresses Humata two biggest gaps: citation verification and language support. Where Humata provides page number references in answers, DocTalk offers real-time citation highlighting. Click any citation in an AI answer to instantly scroll to and highlight the exact source passage in a side-by-side document viewer. This visual verification eliminates the need to manually search for sources.
- **Problem:** "Where Humata provides page number references" is not documented; Humata claims highlighting.
- **Evidence (VE §2.10):** "Highlights citations" (heading) / "Build trust with cited links into your source files." / "Each answer Humata generates will cite relevant sections..."; page number only in API docs
- **New EN:** DocTalk is the best Humata alternative for individuals who want per-question pricing and citations they can check on the page. Click any citation in an AI answer to instantly scroll to and highlight the exact source passage in a side-by-side document viewer. Humata's homepage also lists 'Highlights citations', but it does not say what is highlighted.

#### `altsHumata.alt1Desc2`

- **Old EN:** DocTalk supports seven document formats (PDF, DOCX, PPTX, XLSX, TXT, Markdown, web URLs) with dedicated parsers for each. The fully localized interface supports 11 languages, making it far more accessible than Humata English-only experience. Two AI performance modes (Flash and Pro) give you control over the speed-depth tradeoff.
- **Problem:** "Far more accessible than Humata English-only experience" is unverified.
- **Evidence (VE §2.10):** "Formats: not stated on the homepage, pricing page or docs pages checked." (no video, Word or other format evidence in VE, CF or PR)
- **New EN:** DocTalk supports seven document formats (PDF, DOCX, PPTX, XLSX, TXT, Markdown, web URLs) with dedicated parsers for each; Humata's site does not list its supported file types. The fully localized interface supports 11 languages. Two AI performance modes (Flash and Pro) give you control over the speed-depth tradeoff.

#### `altsHumata.adv1`

- **Old EN:** Real-time citation highlighting (Humata: page references only)
- **Problem:** "Humata: page references only" is contradicted.
- **Evidence (VE §2.10):** "Highlights citations" (heading) / "Build trust with cited links into your source files." / "Each answer Humata generates will cite relevant sections..."; page number only in API docs
- **New EN:** Real-time citation highlighting in the original document

#### `altsHumata.adv2`

- **Old EN:** 7 document formats (Humata: PDF, Word, video)
- **Problem:** "Humata: PDF, Word, video" has no evidence.
- **Evidence (VE §2.10):** "Formats: not stated on the homepage, pricing page or docs pages checked." (no video, Word or other format evidence in VE, CF or PR)
- **New EN:** 7 listed document formats, including PowerPoint and Excel

#### `altsHumata.adv3`

- **Old EN:** 11 interface languages (Humata: English only)
- **Problem:** "Humata: English only" is unverified.
- **Evidence (none):** No statement in VE, CF or PR supports this; removed or marked "Not verified".
- **New EN:** 11 interface languages

#### `altsHumata.alt2Title`

- **Old EN:** ChatPDF — Most Popular Alternative
- **Problem:** Heading states an unsupported fact ("Most Popular").
- **Evidence (none):** No statement in VE, CF or PR supports this; removed or marked "Not verified".
- **New EN:** ChatPDF — Best Without an Account

#### `altsHumata.alt2Desc1`

- **Old EN:** ChatPDF is the most well-known AI document chat tool and has the largest user base in the category. Its simplicity is its strength: upload a PDF, start chatting. The interface is clean and intuitive, with virtually no learning curve. For users who find Humata feature set overwhelming, ChatPDF stripped-down approach is refreshing.
- **Problem:** "Most well-known ... largest user base" is unsupported; "upload a PDF" understates formats.
- **Evidence (PR §1):** "ChatPDF is free to try and requires no account to get started."
- **Evidence (VE §2.7):** "PDF (.pdf), Word (.doc, .docx), PowerPoint (.ppt, .pptx), Markdown (.md), and Text files (.txt)" (chatpdf.com FAQ)
- **New EN:** ChatPDF is a simple AI document chat tool: you can start without an account, upload a document and start chatting. It reads PDF, Word, PowerPoint, Markdown and text files. For users who find Humata's feature set more than they need, ChatPDF's stripped-down approach is refreshing.

#### `altsHumata.alt2Desc2`

- **Old EN:** The tradeoff is limited functionality. ChatPDF supports only PDF files, has no citation highlighting, and the interface is primarily English. The free tier (2 PDFs/day) is restrictive, and the Plus plan at $19.99/month costs more than Humata Expert ($9.99/month). But for PDF-only users who value simplicity, it is a proven choice.
- **Problem:** "Only PDF files", "no citation highlighting", "primarily English", "$19.99/month" are false or unsupported.
- **Evidence (VE §2.7):** "We offer a free plan that lets you analyze 2 documents every day." (no page, size or question cap published, PR §1)
- **Evidence (VE §2.7):** "Entry price: not published. chatpdf.com/pricing and /plus return 404 today. The FAQ names 'ChatPDF Plus' with no price."
- **Evidence (VE §2.7):** "...clickable citations instantly scroll to the exact source in your PDF." / feature card "Pages referenced"; in-document highlighting not stated
- **Evidence (CF §4 + VE §2.10):** Free 60 pages/mo; Expert $9.99/mo (3 users, 500 pages, $0.02/extra page); Team $49/user/mo (10 users, 5,000 pages, $0.01/extra page, OCR, dept/folder permissions); Enterprise custom
- **New EN:** The free plan lets you analyze 2 documents every day. ChatPDF does not publish a price for ChatPDF Plus, so you cannot compare it with Humata Expert ($9.99/month) up front. Its citations scroll to the source; its site does not say whether passages are highlighted. For users who value simplicity, it is a good choice.

#### `altsHumata.alt2BestFor`

- **Old EN:** Users who want a simple, established PDF chat tool
- **Problem:** "Established" is unsupported.
- **Evidence (PR §1):** "ChatPDF is free to try and requires no account to get started."
- **New EN:** Users who want a simple document chat tool with no account needed

#### `altsHumata.alt3Desc1`

- **Old EN:** AskYourPDF offers the richest integration ecosystem among Humata alternatives. The Chrome extension, Zotero plugin, and developer API make it possible to embed document AI into existing workflows. For power users who need document analysis as part of a larger toolchain, AskYourPDF flexibility is unmatched.
- **Problem:** "Richest ecosystem ... unmatched" is an unverified superlative.
- **Evidence (VE §2.6):** "Web, iOS, Android, Chrome extension, ChatGPT GPT, and the Zotero plugin"
- **Evidence (VE §2.6):** API docs (docs.askyourpdf.com): response schema includes "page_number"
- **New EN:** AskYourPDF offers a wide integration ecosystem: a Chrome extension, a Zotero plugin, iOS and Android apps, a ChatGPT GPT and a developer API. For power users who need document analysis as part of a larger toolchain, that flexibility is the main draw.

#### `altsHumata.alt3Desc2`

- **Old EN:** Like Humata, AskYourPDF is primarily PDF-focused. It lacks citation highlighting and has an English-only interface. Premium plans start at $14.99 per month. The main advantage over Humata is the integration approach: rather than building everything into one platform, AskYourPDF lets you connect document AI to the tools you already use.
- **Problem:** "Primarily PDF-focused", "lacks citation highlighting", "English-only", "$14.99 Premium" are false or unverified.
- **Evidence (VE §2.6):** "Drag a PDF, DOCX, EPUB, or TXT file into the AskYourPDF chat reader, or paste a URL."
- **Evidence (VE §2.6):** "We return your answer with a citation back to the exact page in the original PDF. Click the citation to verify." (highlighting not stated)
- **Evidence (VE §2.6 + PR §3):** Premium "$11.99 per month billed yearly"; Pro "$14.99 per month billed yearly"; monthly-billed price "not shown"; Enterprise "Custom"
- **New EN:** Its chat reader accepts PDF, DOCX, EPUB and TXT files or a pasted URL, and each answer cites the exact page, which you can click to verify. Premium costs $11.99 per month, billed yearly. The main advantage over Humata is the integration approach: rather than building everything into one platform, AskYourPDF lets you connect document AI to the tools you already use.

#### `altsHumata.alt4Desc1`

- **Old EN:** Google NotebookLM is the best free Humata alternative. Where Humata free tier limits you to 60 pages per month, NotebookLM is entirely free (with a Google account). The multi-source notebook approach lets you combine PDFs, Google Docs, web URLs, and YouTube transcripts. The AI-generated audio podcast feature creates conversational summaries of your sources.
- **Problem:** "Entirely free" omits limits; "audio podcast" unsupported.
- **Evidence (VE §2.9 + CF §5):** "Is Gemini Notebook the same product as NotebookLM?"; notebooklm.google 301-redirects to notebook.google
- **Evidence (VE §2.9 + CF §5):** Standard: "100/user" notebooks, "50/notebook" sources ("Usage Limits (Subject to Change)")
- **Evidence (VE §2.9 + CF §5):** "Microsoft Word (docx), Text (txt), Markdown (md), PDF files (pdf), CSV (csv), and PowerPoint (pptx) files"; "ePub files"; plus Google Docs/Slides/Sheets, web URLs, public YouTube URLs, audio, images, pasted text (no XLSX)
- **Evidence (PR §11):** Standard limits table lists "3/day" Audio Overviews
- **Evidence (CF §4 + VE §2.10):** Free 60 pages/mo; Expert $9.99/mo (3 users, 500 pages, $0.02/extra page); Team $49/user/mo (10 users, 5,000 pages, $0.01/extra page, OCR, dept/folder permissions); Enterprise custom
- **New EN:** Google NotebookLM, now called Gemini Notebook, is the best free Humata alternative. Where Humata's free tier covers 60 pages per month, Gemini Notebook's free Standard tier allows 100 notebooks and 50 sources per notebook (with a Google account). A notebook can combine PDF, Word, PowerPoint, Google Docs, web URLs and YouTube videos, and Audio Overviews turn your sources into audio summaries.

#### `altsHumata.alt4Desc2`

- **Old EN:** The tradeoff is Google lock-in and format limitations. NotebookLM does not support DOCX, PPTX, or XLSX natively. The interface is primarily English. You need a Google account, and your data is on Google servers. But for budget-conscious users who are comfortable with Google, NotebookLM is hard to beat on value.
- **Problem:** "Does not support DOCX, PPTX" is false; "primarily English" unverified.
- **Evidence (VE §2.9 + CF §5):** "Microsoft Word (docx), Text (txt), Markdown (md), PDF files (pdf), CSV (csv), and PowerPoint (pptx) files"; "ePub files"; plus Google Docs/Slides/Sheets, web URLs, public YouTube URLs, audio, images, pasted text (no XLSX)
- **Evidence (PR §11):** "you must... verify your age in your Google Account"
- **Evidence (VE §2.9):** "To get the full quoted text, hover over any citation." / "To navigate directly to the quote and review it in context, select a citation." / no page number documented
- **New EN:** The tradeoff is Google lock-in. You need a Google account, Excel (XLSX) files are not on Google's list of sources, and Google does not document page numbers for citations. But for budget-conscious users who are comfortable with Google, Gemini Notebook is hard to beat on value.

#### `altsHumata.alt5Desc1`

- **Old EN:** PDF.ai is the most minimalist option on this list. Upload a PDF, ask questions, get answers. No team features, no integrations, no multi-format support. This simplicity appeals to users who find both Humata and other alternatives too feature-rich for their needs.
- **Problem:** "No team features, no integrations" is false (per-user plans, parsing API).
- **Evidence (VE §2.11):** "You can only upload PDF (.pdf) files at the moment." (pdf.ai/faq)
- **Evidence (CF §3 + PR §5):** Positioning "chat-with-PDF + document parsing API"; "A separate developer API product"
- **Evidence (VE §2.11 + CF §3):** Pro "$17 /mo Billed monthly"; "$10 /mo Billed yearly"; Pro = 100 uploads/mo, 1,000 q/mo; Ultimate "$27/user/mo monthly"
- **New EN:** PDF.ai is the most focused option on this list: its FAQ says you can only upload PDF files at the moment. It also sells a separate document-parsing API for developers. This focus appeals to users who find both Humata and other alternatives too feature-rich for their needs.

#### `altsHumata.alt5Desc2`

- **Old EN:** PDF.ai has seen reduced development activity compared to competitors. The feature set has not evolved significantly, and the tool lacks citation highlighting, multilingual support, and modern features like dark mode. For very basic, occasional PDF Q&A, it works. For anything more, other alternatives provide substantially more value.
- **Problem:** "Reduced development activity", "lacks citation highlighting, multilingual support, dark mode" are unverified negatives (pt value was untranslated English).
- **Evidence (VE §2.11):** "Sources included / Every response is backed by sources extracted from the uploaded document." (no page number or highlight documented)
- **Evidence (VE §2.11):** "Monthly upload limit" = 1; "Monthly questions limit" = 100; "Max file size" 10MB
- **Evidence (VE §2.11 + CF §3):** Pro "$17 /mo Billed monthly"; "$10 /mo Billed yearly"; Pro = 100 uploads/mo, 1,000 q/mo; Ultimate "$27/user/mo monthly"
- **New EN:** Every response is backed by sources from your document, according to PDF.ai. The free Hobby plan allows 1 upload and 100 questions a month; Pro costs $17 per month billed monthly or $10 per month billed yearly (October 2026). For occasional PDF Q&A, it works.

#### `altsHumata.chooseNeed2`

- **Old EN:** Largest user base + simplicity
- **Problem:** "Largest user base" is unsupported.
- **Evidence (PR §1):** "ChatPDF is free to try and requires no account to get started."
- **New EN:** No account + simplicity

#### `altsHumata.chooseNeed4`

- **Old EN:** Completely free with multi-source
- **Problem:** "Completely free" omits limits.
- **Evidence (VE §2.9 + CF §5):** Standard: "100/user" notebooks, "50/notebook" sources ("Usage Limits (Subject to Change)")
- **New EN:** Free tier with multi-source notebooks

#### `altsHumata.noteText`

- **Old EN:** If you specifically need team collaboration or video file analysis, Humata remains the best option. These alternatives are strongest for individual users who need better citations, format support, or pricing.
- **Problem:** "Video file analysis" has no evidence.
- **Evidence (CF §4 + VE §2.10):** Free 60 pages/mo; Expert $9.99/mo (3 users, 500 pages, $0.02/extra page); Team $49/user/mo (10 users, 5,000 pages, $0.01/extra page, OCR, dept/folder permissions); Enterprise custom
- **Evidence (VE §2.10):** "Formats: not stated on the homepage, pricing page or docs pages checked." (no video, Word or other format evidence in VE, CF or PR)
- **New EN:** If you specifically need team plans with page-based pricing, Humata remains a strong option. These alternatives suit individual users who want per-question pricing, listed format support, or a different free tier.

#### `altsHumata.faq2Answer`

- **Old EN:** Google NotebookLM is completely free with a Google account. DocTalk offers a free demo with no signup required and a free tier with 300 credits per month. ChatPDF offers 2 free PDFs per day.
- **Problem:** "NotebookLM is completely free" is outdated.
- **Evidence (VE §2.9 + CF §5):** "Is Gemini Notebook the same product as NotebookLM?"; notebooklm.google 301-redirects to notebook.google
- **Evidence (VE §2.9 + CF §5):** Standard: "100/user" notebooks, "50/notebook" sources ("Usage Limits (Subject to Change)")
- **Evidence (PR §11):** "you must... verify your age in your Google Account"
- **Evidence (VE §2.7):** "We offer a free plan that lets you analyze 2 documents every day." (no page, size or question cap published, PR §1)
- **Evidence (CLAUDE.md + .claude/rules/frontend.md):** DocTalk: Free 300 credits/month, Plus $9.99, Pro $19.99; formats PDF/DOCX/PPTX/XLSX/TXT/MD/URL; anonymous use = the sample-document demo only (sign-in required to upload)
- **New EN:** Yes. Google NotebookLM, now called Gemini Notebook, has a free Standard tier with usage limits (100 notebooks, 50 sources per notebook; Google account required). DocTalk offers a free demo with no signup required and a free tier with 300 credits per month. ChatPDF's free plan covers 2 documents a day.

#### `altsHumata.faq3Answer`

- **Old EN:** Most Humata alternatives focus on individual users. If you need team collaboration, Humata Team plan ($49/user/month) remains the strongest option. However, AskYourPDF offers some collaboration features through its API and Chrome extension that teams can share.
- **Problem:** "AskYourPDF collaboration through its API and Chrome extension" is unsupported.
- **Evidence (CF §4 + VE §2.10):** Free 60 pages/mo; Expert $9.99/mo (3 users, 500 pages, $0.02/extra page); Team $49/user/mo (10 users, 5,000 pages, $0.01/extra page, OCR, dept/folder permissions); Enterprise custom
- **Evidence (VE §2.6 + PR §3):** Premium "$11.99 per month billed yearly"; Pro "$14.99 per month billed yearly"; monthly-billed price "not shown"; Enterprise "Custom"
- **New EN:** Most alternatives on this list focus on individual users. If you need team collaboration, Humata's Team plan ($49/user/month, up to 10 users) remains a strong option. AskYourPDF also offers an Enterprise plan with custom pricing.

#### `altsHumata.faq4Answer`

- **Old EN:** DocTalk supports the most formats with 7 types: PDF, DOCX, PPTX, XLSX, TXT, Markdown, and web URLs. Humata supports PDF, Word, and video. ChatPDF and PDF.ai support only PDF.
- **Problem:** "DocTalk supports the most formats", "Humata: PDF, Word, video", "ChatPDF only PDF" are false or unsupported.
- **Evidence (VE §2.9 + CF §5):** "Microsoft Word (docx), Text (txt), Markdown (md), PDF files (pdf), CSV (csv), and PowerPoint (pptx) files"; "ePub files"; plus Google Docs/Slides/Sheets, web URLs, public YouTube URLs, audio, images, pasted text (no XLSX)
- **Evidence (VE §2.6):** "Drag a PDF, DOCX, EPUB, or TXT file into the AskYourPDF chat reader, or paste a URL."
- **Evidence (VE §2.7):** "PDF (.pdf), Word (.doc, .docx), PowerPoint (.ppt, .pptx), Markdown (.md), and Text files (.txt)" (chatpdf.com FAQ)
- **Evidence (VE §2.11):** "You can only upload PDF (.pdf) files at the moment." (pdf.ai/faq)
- **Evidence (VE §2.10):** "Formats: not stated on the homepage, pricing page or docs pages checked." (no video, Word or other format evidence in VE, CF or PR)
- **New EN:** Gemini Notebook (formerly NotebookLM) accepts the widest range of sources on this list, including Word, PowerPoint, PDF, CSV and ePub files, web URLs and YouTube videos. DocTalk reads 7 formats, including Excel. AskYourPDF reads PDF, DOCX, EPUB, TXT and URLs, ChatPDF reads PDF, Word, PowerPoint, Markdown and text, and PDF.ai reads only PDF. Humata's site does not list its file types.

#### `altsHumata.faq5Answer`

- **Old EN:** No. Humata video file support is unique among AI document tools. If video analysis is essential, Humata remains the best choice. For document-only workflows, DocTalk 7-format support covers more document types.
- **Problem:** "Humata video file support is unique" has no evidence.
- **Evidence (VE §2.9 + CF §5):** "Microsoft Word (docx), Text (txt), Markdown (md), PDF files (pdf), CSV (csv), and PowerPoint (pptx) files"; "ePub files"; plus Google Docs/Slides/Sheets, web URLs, public YouTube URLs, audio, images, pasted text (no XLSX)
- **Evidence (VE §2.10):** "Formats: not stated on the homepage, pricing page or docs pages checked." (no video, Word or other format evidence in VE, CF or PR)
- **New EN:** Gemini Notebook (formerly NotebookLM) accepts public YouTube videos as sources. DocTalk does not support video. We could not confirm that Humata itself supports video, because its site does not list supported file types (checked October 2026).

### `altsHub`

#### `altsHub.humataTagline`

- **Old EN:** 5 best Humata AI alternatives with better pricing, citations, and language support.
- **Problem:** "Better pricing, citations, and language support" than Humata is unverified.
- **Evidence (CF §4 + VE §2.10):** Free 60 pages/mo; Expert $9.99/mo (3 users, 500 pages, $0.02/extra page); Team $49/user/mo (10 users, 5,000 pages, $0.01/extra page, OCR, dept/folder permissions); Enterprise custom
- **Evidence (VE §2.10):** "Highlights citations" (heading) / "Build trust with cited links into your source files." / "Each answer Humata generates will cite relevant sections..."; page number only in API docs
- **New EN:** 5 best Humata AI alternatives compared on pricing, citations, and language support.

#### `altsHub.askyourpdfTagline`

- **Old EN:** 7 best AskYourPDF alternatives with better citations, multi-format support, and free options.
- **Problem:** "Better citations, multi-format support" assumes AskYourPDF is PDF-only with weak citations.
- **Evidence (VE §2.6):** "Drag a PDF, DOCX, EPUB, or TXT file into the AskYourPDF chat reader, or paste a URL."
- **Evidence (VE §2.6):** "We return your answer with a citation back to the exact page in the original PDF. Click the citation to verify." (highlighting not stated)
- **New EN:** 7 best AskYourPDF alternatives compared on citations, file formats, and free options.

#### `altsHub.pdfaiTagline`

- **Old EN:** 7 best PDF.ai alternatives with improved accuracy, citations, and broader format support.
- **Problem:** "Improved accuracy" is unsupported.
- **Evidence (VE §2.11):** "You can only upload PDF (.pdf) files at the moment." (pdf.ai/faq)
- **New EN:** 7 best PDF.ai alternatives with broader format support, citations, and free options.

### `compareHub`

#### `compareHub.tagline.chatpdf`

- **Old EN:** 7 formats vs PDF-only. Real-time citation highlighting vs none.
- **Problem:** "PDF-only" and "citation highlighting vs none" are false.
- **Evidence (VE §2.7):** "PDF (.pdf), Word (.doc, .docx), PowerPoint (.ppt, .pptx), Markdown (.md), and Text files (.txt)" (chatpdf.com FAQ)
- **Evidence (VE §2.7):** "...clickable citations instantly scroll to the exact source in your PDF." / feature card "Pages referenced"; in-document highlighting not stated
- **Evidence (PR §1):** "ChatPDF is free to try and requires no account to get started."
- **New EN:** Excel support and highlighted citations vs no-account chat with PDF, Word and PowerPoint.

#### `compareHub.tagline.askyourpdf`

- **Old EN:** Simpler UX with citation highlighting vs Chrome extension ecosystem.
- **Problem:** "Simpler UX" is unsupported.
- **Evidence (VE §2.6):** "Web, iOS, Android, Chrome extension, ChatGPT GPT, and the Zotero plugin"
- **New EN:** Highlighted citations in one web app vs an ecosystem of extensions and integrations.

#### `compareHub.tagline.notebooklm`

- **Old EN:** Privacy-first multi-format tool vs Google-locked notebook.
- **Problem:** "Multi-format tool vs Google-locked notebook" implies Gemini Notebook reads fewer formats; it reads more.
- **Evidence (VE §2.9 + CF §5):** "Microsoft Word (docx), Text (txt), Markdown (md), PDF files (pdf), CSV (csv), and PowerPoint (pptx) files"; "ePub files"; plus Google Docs/Slides/Sheets, web URLs, public YouTube URLs, audio, images, pasted text (no XLSX)
- **New EN:** Single-document focus with highlighted citations vs Google's multi-source notebooks.

#### `compareHub.tagline.humata`

- **Old EN:** Affordable multi-language support vs team collaboration features.
- **Problem:** "Affordable" vs Humata: both start at $9.99.
- **Evidence (CF §4 + VE §2.10):** Free 60 pages/mo; Expert $9.99/mo (3 users, 500 pages, $0.02/extra page); Team $49/user/mo (10 users, 5,000 pages, $0.01/extra page, OCR, dept/folder permissions); Enterprise custom
- **New EN:** Per-question credits and 11 languages vs page-based team plans.

#### `compareHub.tagline.pdfai`

- **Old EN:** 7 document formats with citations vs basic PDF chat.
- **Problem:** "Basic PDF chat" is an unsupported characterisation.
- **Evidence (VE §2.11):** "You can only upload PDF (.pdf) files at the moment." (pdf.ai/faq)
- **New EN:** 7 document formats with highlighted citations vs PDF-only chat.

## Kept, verified

These competitor claims were checked against the evidence and left unchanged.

| Key or cell | Claim | Evidence |
|---|---|---|
| `compareHumata.pricingCompetitor`, `compareHumata.featureStartingPriceCompetitor`, `compareHumata.whoHumata3`, `compareHumata.faq1Answer` | Humata free 60 pages/mo; Expert $9.99 (3 users, 500 pages, $0.02/page); Team $49/user (10 users, 5,000 pages, $0.01/page) | CF §4 + VE §2.10 |
| `altsHumata.alt1Desc3Pre`, `altsHumata.faq1Answer` | DocTalk Plus and Humata Expert both cost $9.99; Expert = 500 pages + $0.02/page | CF §4 + VE §2.10, DT |
| `comparePdfai.documentFormatCompetitor`, `comparePdfai.faq2Answer`, `comparePdfai.featureSupportedFormatsCompetitor` ("PDF only"), `altsPdfai.tablePdfOnly`, `altsPdfai.whyReason1`, `altsPdfai.adv1` | PDF.ai accepts PDF only | VE §2.11: "You can only upload PDF (.pdf) files at the moment." |
| compare/pdf-ai table: no-signup demo ✗, web URL ✗ | PDF.ai needs signup; PDF only | PR §5: "no anonymous upload found; homepage CTA is 'Sign up for free'"; VE §2.11 |
| compare/askyourpdf table: Chrome extension ✓, Zotero ✓, API ✓ | AskYourPDF integrations | VE §2.6: "Web, iOS, Android, Chrome extension, ChatGPT GPT, and the Zotero plugin"; API docs |
| `compareAskyourpdf.heroDescription`, `compareAskyourpdf.metaDescription`, `compareAskyourpdf.whoAskyourpdf1`–`4`, `altsPdfai.alt3Desc1`, `altsPdfai.alt3BestFor`, `altsChatpdf.alt2BestFor`, `altsHumata.alt3BestFor`, `altsNotebooklm.alt3BestFor` | AskYourPDF = browser extension + research integrations (Zotero, API) | VE §2.6 |
| compare/humata table: team collaboration ✓, no-signup demo ✗ | Humata team plans; signup-only CTA | CF §4 (Team plan, dept/folder permissions); PR §4: "the only CTA is 'Get started for free'" |
| compare/notebooklm table: multi-source ✓, audio ✓, requires Google account ✓, no-signup demo ✗ | Gemini Notebook notebooks, Audio Overviews, Google account | VE §2.9, PR §11 ("3/day" Audio Overviews; Google Account age check) |
| `compareNotebooklm.faq.a4`, `altsNotebooklm.adv4` | NotebookLM requires a Google account | PR §11 |
| `compareNotebooklm.whoNotebookLM.item1`, `altsChatpdf.faq5Answer`, `altsAskyourpdf.faq5Answer`, `altsAskyourpdf.alt5BestFor`, `altsPdfai.alt5BestFor` | NotebookLM suits free multi-source research with audio summaries | VE §2.9 (free Standard tier, 50 sources per notebook), PR §11 (Audio Overviews) |
| `altsPdfai.alt6BestFor`, `altsAskyourpdf.alt6BestFor`, `altsChatpdf.alt6BestFor`, `altsChatpdf.alt6Title` and the "Table and structured data" choose rows | ChatDOC suits tables and numeric data | VE §2.1: "Numerical values in answers are highlighted. Click them to trace back to the original data"; TapSource "Tap Data, Meet Truth" |
| `altsNotebooklm.alt5BestFor`, `altsNotebooklm.alt6BestFor`, `altsAskyourpdf.alt7BestFor`, related choose rows | Consensus = academic search; Elicit = systematic reviews, extraction from papers | PR §14 ("AI academic search engine for peer-reviewed literature"); PR §10 / VE §2.12 ("Dedicated Systematic Review Workflow", "Custom extractions from uploaded papers") |
| `altsHumata.chooseNeed3`, `altsPdfai.chooseNeed3`, `altsNotebooklm.chooseNeed3`, `altsChatpdf.chooseNeed2` | AskYourPDF for Zotero / Chrome / API | VE §2.6 |
| Editorial "best for" headings (for example "Humata — Best for Teams", "NotebookLM — Best Free Option", "PDF.ai — Simplest Interface") and `altsChatpdf.chooseNeed5`/`altsHumata.chooseNeed5` ("Maximum simplicity") | Editorial judgement, not a factual claim | Heading keys are changed only where they state a false fact |
| All DocTalk-only values (7 formats, 11 languages, two modes, 300 credits/month, $9.99 / $19.99) | DocTalk product facts | DT |

## Removed or neutralised because no evidence file supports them

- **ChatPDF:** the "$19.99/month" Plus price (ChatPDF publishes no price; its pricing page returns 404), "50 PDFs/day", "3 questions each", 10 MB / 32 MB size limits, launch date, "large user base", "single AI model", English-only interface, storage, deletion and privacy-policy claims, response-speed claims.
- **AskYourPDF:** "$14.99 Premium" (that is the Pro price; Premium is $11.99 billed yearly), "PDF-focused" (it reads DOCX, EPUB, TXT and URLs), "no citation highlighting" / "inconsistent OCR", English-only interface, "batch processing", "query your library without uploading".
- **PDF.ai:** "reduced development activity" / "Reduced updates" (the table row is deleted), "built-in PDF editing and annotation", "basic page references", "no team features, no integrations", English-only interface, "$15/month".
- **Humata:** video file support (no evidence; the table cell is now "Not verified" and the FAQ says we could not confirm it), Word/PDF format list (Humata lists no formats), "page references only" (Humata says it highlights citations), English-only interface, SOC 2 / security-certification claims, "shared workspaces, RBAC, admin dashboards, usage analytics, priority support".
- **NotebookLM / Gemini Notebook:** "completely free / no usage limits", "does not support DOCX/PPTX" (it reads both; XLSX is the format it does not list), "Project Tailwind" origin story, "your data is not used for training" and other privacy claims, English-primary interface, "unique audio podcasts no alternative replicates".
- **ChatDOC:** "$5.99" price (Pro is $8.99 for 30 days), "2 documents/day, 20 questions" (ChatDOC's own pages disagree; the copy now quotes both), "English and Chinese interface", "better table extraction than X".
- **Sharly AI:** "formerly Sharly" (the current name is Sharly AI), "PDF-only / lacks multi-format support", "lacks multilingual interface", "competitive pricing", "fast, clean interface".
- **Consensus:** "200 million papers" (not a vendor quote in the evidence), "limited searches per month" (basic search is free; Pro messages are capped), "you can't upload your own documents".
- **Elicit:** "structured tables / spreadsheet view" wording that the evidence does not state; the free plan is now described from the vendor quote.
- **All tools:** dark-mode support and interface-language counts in comparison tables (now "Not verified"); "only tool / unique / no other tool" superlatives; "DocTalk supports the most formats" (Gemini Notebook lists more source types).
- **DocTalk:** "Upload a document … no account needed" in CTA copy. Anonymous visitors can only open the sample documents, so the copy now says "Open a sample document".

## Translation

- Every changed key was translated from the new EN value into all 10 other locales (Opus subagents, one per locale and page group), then checked by a script: all keys present, single line, every EN number present, product names kept, "two modes" wording and the 300-credit figure kept, leading/trailing spaces kept.
- Locale-only fixes made on the way: `pt` `altsHumata.alt5Desc2` was untranslated English and is now Portuguese; `fr`, `pt` and `hi` `compareChatpdf.feature.pricingP2Mid` lacked the space before or after the two links it sits between (French rendered "démo instantanéequi"), so both spaces were added.
- A number-drift scan of the in-scope keys that were not changed found no locale stating a different competitor figure from EN.

## Found but not changed (outside this brief)

- **Duplicate product name in "What is X?" sections.** Every `*Content.tsx` renders `<a>Name</a>{' '}{t('...whatIs…Description')}`, and every locale value starts with the product name, so pages read "ChatPDF ChatPDF is …". The new values follow the current convention. A fix belongs in the components or in all 11 locales at once.
- **"4.5 billion native speakers"** in `comparePdfai.languageSupportDocTalk` and `compareAskyourpdf.languageSupportDocTalk` is a DocTalk claim with no source; native speakers of the 11 languages total roughly 3 billion (estimate). Not a competitor claim, so not changed here.
- **`compareAskyourpdf.metaDescription`** is about 390 characters (it duplicates the hero). Its facts are correct, so it was not changed.
- **`comparePdfai.featureActiveDevelopment*`** keys are now unused (see Component changes).
