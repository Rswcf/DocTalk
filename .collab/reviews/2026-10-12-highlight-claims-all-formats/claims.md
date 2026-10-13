# Citation-highlight claims, widened to all formats — 2026-10-12

Branch `content/highlight-claims-all-formats`, cut from `origin/stable` @ `8927e588` (production frontend since
2026-10-12 12:06Z) and rebased onto `origin/stable` @ `8442a92e` (Release 0.36.0: backend only, plus the version
bump in `frontend/package.json`; no frontend source changed). Frontend copy only. Supersedes the "PDF and plain-text (.txt) files" limit of
`.collab/reviews/2026-10-11-highlight-claims/claims.md`.

**Conclusion.** DocTalk now highlights the cited passage in PDF, Word, PowerPoint, Excel, Markdown and
plain-text files and web pages, and the copy says so. Two limits stay in the copy:
1. When DocTalk cannot pinpoint the passage, the reader shows the cited page instead ("Page location only").
   Any sentence that promises a highlight on every or any citation carries that sentence.
2. PowerPoint: production opens a PPTX in the slide view, which marks the passage only when DocTalk can match it
   in the slide's text (else "Page location only"); the Text view marks it. Sentences whose subject is PowerPoint
   say the marks show "on the slide when DocTalk can match the passage there, and in the Text view". No sentence
   says every PowerPoint citation is highlighted on the slide.

## Product truth (browser evidence)

Sources: `.collab/reviews/2026-10-11-highlight-golden/report.md` (r1, `4e4ee459`) and `report-r2.md` (r2 `3df77e01`,
r2b `8927e588` = the production build), both on `origin/main`. Code at `8927e588`.

| Format | Reader path in production | Passage highlight verified in a browser | Evidence |
|---|---|---|---|
| PDF | `PdfViewer`, bbox lines (Exact) / region bar (Related) | **yes** | r1 rows 56–62 (`pdf-q2-c1` Exact line box "…h = 8…heads."); r2 g (`r2L-pdf-m2-c3` Exact, 2 line boxes); r2b j (pdf 2 Exact / 3 Related, "same pages, same boxes") |
| TXT | `TextViewer` → `PlainEvidenceContent` (Strategy ④) | **yes** (en + ar) | r2 e (`r2-e-kiln-m1-c1` "Exact passage"; `r2L-artxt-m1-c1` Exact, right to left); r2b j (txt 0/3, artxt 1/3, 0 wrong) |
| Markdown | `TextViewer` → `MarkdownContent` + `rehypeMarkRanges` | **yes** (en, zh, ar) | r1 rows 5, 8, 10, 12 Exact (zh `md1-q3-c1`); r2 a 14/14 correct; r2b c MD card "Exact passage"; r2b j md1 4/5, md2 7/3 |
| Word (DOCX) | Text view by default (`readerView.ts:15`, `tests/reader-default-view.test.cjs`) | **yes** | r1 rows 17, 20–22 Exact; r2 b (`r2-docx2-m1-c2`); r2b c DOCX card "Exact passage"; r2b j docx2 8/2. Coordinator, production 2026-10-12: a DOCX opened in Text view, "Exact passage", correct marks |
| PowerPoint (PPTX), Text view | `TextViewer` (the "Text" toggle button) | **yes** | r1 rows 38–42 (`pptx-q1-c1`, `pptx-q2-c4` Exact); r2b c PPTX card "Exact passage" ("Operating costs fell…"); r2b j pptx 3/3 |
| PowerPoint (PPTX), slide view | **Production default** (`readerView.ts:15` returns `slide` for every type but DOCX; `backend/Dockerfile:31-33` installs `libreoffice-impress`). `PdfViewer` on the converted PDF, `syntheticBoxes`, text-layer match kept only if unique in the whole converted document (`convertedEvidence.ts`, `PdfViewer.tsx:130-140`) | **yes, when the text matches** (1 of 2 citations) | Coordinator, production 2026-10-12 ~18:10Z (backend 0.36.0, doc `0089131c`, a 3-slide python-pptx deck converted by production LibreOffice; opens in Slides view by default): (1) cited sentence = a slide's FIRST bullet → the focus is the title glued to the sentence ("Drip lines The drip lines in block C were flushed…"), the converted text layer is "Drip lines \| • \| The drip lines…", the bullet glyph breaks the unique match → "Citation 1 · Page 2 · Page location only", no mark (the honest fallback, not a wrong mark); (2) cited sentence = a LATER bullet ("He used clean well water only, because fertiliser residue blocks the emitters.") → "Citation 1 · Page 2 · Exact passage", 2 `pdf-evidence-line` boxes covering exactly the sentence's 2 text-layer lines (x 9.7%, w 80.4/75.4%, y 47.2/54.3% against spans at 47.7/54.8%); (3) Text view, same document: both citations "Exact passage" with correct `<mark>`s. Not checked: whether the Slides-view jump scrolls (the browser pane was hidden). Before that: r1 check 4 "Slide view: not tested (no LibreOffice)"; `release.md:24` "Slide view untested."; unit tests `tests/text-viewer-highlight.test.cjs:51-76` |
| Excel (XLSX) | `TextViewer` → Markdown tables | **yes** | r1 rows 45–46 Exact ("Support", "7"); r2b c XLSX card "Exact passage" (6 cells, pipes unmarked); r2b j xlsx 0/3 (every focus empty that run → Related, marks present) |
| Web page (URL) | `TextViewer` → `WebArticleView` + `articleEvidence` | **yes** (PEP 257) | r1 rows 65–70 Exact; r2b c URL card "Exact passage"; r2b j url 8/4 |

Across formats: r2b j = 66 jumps, 33 Exact / 33 Related, **0 wrong marks over 488 marks**, 0 of 169 frames with a
label stronger than the marks. The labels are `evidence.exact` "Exact passage", `evidence.region` "Related passage"
and `evidence.page` "Page location only" (`lib/evidenceStatus.ts`). So:
- "Highlights the cited passage" is true for every verified path: Related = the cited chunk is marked.
- "Highlights the exact passage / sentence" is true for about half the live citations only. The copy never
  promises it.
- "Page location only" is the designed fallback (r1 P2-2 showed it for a Quote Finder card; fixed in r2b). The copy
  names it where a sentence is universal.

Not verified, so not claimed: that every PPTX citation is marked on the slide (one of two was); the DOCX slide view
(a DOCX opens in the Text view; the slide view is reached only through the toggle); Japanese text outside PDFs
(zh MD and ar TXT/MD were tested); a Wikipedia URL (its import failed in r1, `NO_TEXT_CONTENT`; the import fix
shipped in 0.36.0 on 2026-10-12, but no Wikipedia citation has been browser-tested).

## Verdict rules (2026-10-12)

1. **Format claims.** DocTalk highlights the cited passage in PDF, Word, PowerPoint, Excel, Markdown and plain-text
   files and web pages. A sentence that names where highlighting works uses that list (the fixed phrase FORMAT_LIST).
   A sentence that already lists the seven formats, or speaks of "your document", needs no format qualifier.
   Never "every format" / "all 7 formats" for highlighting (PowerPoint's default slide view marks a passage only
   when it can match it).
2. **Universal sentences.** A sentence that promises a highlight for every or any clicked citation either becomes
   singular and generic ("Click a citation … and see the cited passage highlighted") or is followed by the fixed
   sentence NUANCE: "When DocTalk cannot pinpoint the passage, it shows the cited page instead." A sentence with a
   universal reading ("each citation … clicking it highlights", "its citations highlight", "in all of these
   formats") carries NUANCE in the same paragraph. Table cells and feature labels do not.
3. **"Exact".** No changed sentence puts "exact passage / text / sentence" next to a highlight verb. The highlight
   is "the cited passage". Navigation wording that 10-11 accepted ("jump to the exact clause / page") stays.
4. **PowerPoint.** Where PowerPoint is the subject, the sentence says the marks show "on the slide when DocTalk can
   match the passage there, and in the Text view" (the reader button `viewer.text`). Never "every PowerPoint
   citation is highlighted on the slide". (First draft, before the coordinator's production test: "in the Text
   view" only. Replaced in 3 keys × 11 locales and 2 blog lines once the slide view was tested.)
5. **Mechanism.** PDF: bounding-box coordinates. Other formats: "DocTalk finds the cited text in the document's
   extracted text and marks it". The retired ".txt progressive text-snippet matching" and the converted-PDF
   text-layer path are never described.
6. **Unchanged.** Competitor cells and competitor facts (Humata click-to-highlight stays "Partial", vendor cells
   "Not verified"), prices, limits, other features, every `*.metaTitle`. `*.metaDescription` stays single-line and
   equal to its hero value where it was equal before.
7. **Method.** New EN values are built from the 10-11 AFTER text by replacing the limit clause, never from the
   10-11 BEFORE text (which carried "Click any citation … see it highlighted", "real-time", "pixel-perfect",
   "visual highlight overlay"). Translations change the highlight clause and keep every other sentence
   byte-identical.

Kept as is (true, generic, or demo-PDF context; not edited by this change): `demo.hint` and
`featuresDemo.steps.step4.description` (the 3 demo documents are PDFs; no exact-sentence promise);
`featuresMultiFormat.detailPdfText` and `formatPdfDesc` (PDF bbox); `compare*.whoDocTalk*`, `alts*.chooseNeed*`,
`alts*.adv*` "Real-time citation highlighting…" and `compareHub.tagline.*` (feature names, audience and
capability lines; puffery left as the competitor-facts batch left it); `featuresCitations.heroTitle` /
`metaTitle` ("Real-Time Highlighting", metaTitle rule); `featuresMultiFormat.formatPptxDesc` / `formatXlsxDesc` /
`detailUrlText` (under-claims: they do not mention highlighting, not wrong).

## A. Locale keys

The 10-11 change touched 79 keys (`git diff 1c3e108a 69a6f356`). 66 are widened; 13 are kept on purpose.

| # | key | 10-11 EN (limit clause) | new EN value | flags |
|---|---|---|---|---|
| W1 | `landing.feature.citations.desc` | Click one and, in PDF and .txt files, the passage highlights on screen — verify without losing your place | Numbered citations link to the exact page. Click one and the passage highlights on screen — verify without losing your place. |  |
| W2 | `landing.faq.a1` | in PDF and plain-text (.txt) files, you also see it highlighted | Every answer includes numbered citations that link to the exact passage in your document. Click any citation to jump to the source and see the cited passage highlighted. When DocTalk cannot pinpoint the passage, it shows the cited page instead. You always verify the AI's work yourself. | nuance |
| W3 | `useCasesFinance.whyCitations.p2post` | in PDF and plain-text (.txt) files, it also highlights it |  ensures that every number, every claim, and every summary is traceable to a specific passage in the original document. Click a citation, and the document viewer scrolls to the source text and highlights the cited passage. You see the original table, the original footnote, the original paragraph. No guessing, no trust required. |  |
| W4 | `useCasesLawyers.whyCitations.p3post` | in PDF and plain-text (.txt) files, it also highlights it |  addresses this directly. Every AI answer includes numbered citations that link to specific passages in your uploaded document. Click a citation, and the document viewer scrolls to the source text and highlights the cited passage. The AI cannot fabricate what is not in your document, because its answers are grounded in the actual text through Retrieval-Augmented Generation. |  |
| W5 | `useCasesLawyers.steps.verify.description` | In PDF and plain-text (.txt) files, the source text is highlighted so you can read the original language and confirm the AI's extraction | Click a citation number to jump to the exact clause in the document and see the cited passage highlighted, so you can read the original language and confirm the AI's extraction. |  |
| W6 | `featuresMultilingual.cjk.p3` | Citation highlighting works with CJK text the same way as Latin text — click a citation to jump to the source passage and, in PDF and plain-text (.txt) files, see it highlighted on the page | Citation highlighting works with CJK text the same way as Latin text — click a citation to jump to the source passage and see it highlighted on the page. The semantic search engine indexes CJK text natively, so questions about Chinese, Japanese, or Korean documents return accurate, relevant passages. |  |
| W7 | `featuresHub.citationsDesc` | Click any citation to jump to the exact source text, highlighted in PDF and .txt files | Every AI answer includes numbered citations. Click a citation to jump to the source text and see the cited passage highlighted. |  |
| W8 | `featuresCitations.heroSubtitle` | in PDF and plain-text (.txt) files, you also see it highlighted | Every answer DocTalk generates includes numbered citations that link directly to the original text in your document. Click a citation to scroll to the source and see the cited passage highlighted. No more guessing whether the AI got it right. |  |
| W9 | `featuresCitations.metaDescription` | in PDF and plain-text (.txt) files, you also see it highlighted | (same as featuresCitations.heroSubtitle) | = featuresCitations.heroSubtitle |
| W10 | `featuresCitations.howStep3Desc` | In PDF and plain-text (.txt) files, the passage is highlighted in yellow so you can read the original context and verify the AI's claim yourself | Click a citation number and the document viewer instantly scrolls to the exact source text. The cited passage is highlighted in yellow so you can read the original context and verify the AI's claim yourself. When DocTalk cannot pinpoint the passage, it shows the cited page instead. | nuance |
| W11 | `featuresCitations.whyPara3` | in PDF and plain-text (.txt) files, it is highlighted so you can read it in context | DocTalk solves this with a citation-first approach. Every answer comes with numbered source references. Every reference is clickable. Every click takes you to the cited passage in the original document and highlights it, so you can read it in context. When DocTalk cannot pinpoint the passage, it shows the cited page instead. The AI does not just tell you the answer — it shows you where the answer comes from. | nuance |
| W12 | `featuresCitations.layer3Desc` | For .txt files, it uses progressive text-snippet matching to locate and highlight the passage | The final layer is the interactive highlight experience. Click any citation and the document viewer scrolls to the source passage. For PDFs, this uses bounding box coordinates to highlight the cited text region on the page. For Word, PowerPoint, Excel, Markdown and plain-text files and web pages, DocTalk finds the cited text in the document's extracted text and marks it; in PowerPoint files, the marks show on the slide when DocTalk can match the passage there, and in the Text view. When DocTalk cannot pinpoint the passage, it shows the cited page instead. | nuance, pptx |
| W13 | `featuresCitations.compTextSnippet` | Text-snippet highlighting (.txt files) | Passage highlighting in Word, PowerPoint, Excel, Markdown, TXT and web pages |  |
| W14 | `featuresCitations.faq2A` | in PDF and plain-text (.txt) files, it also highlights it in yellow so you can read the original text in context | Yes. Every numbered citation in an AI answer is clickable. Clicking it scrolls the document viewer to the source passage and highlights it in yellow so you can read the original text in context. For PDFs, this highlights the bounding box region on the page. In the other formats, DocTalk finds the cited text in the document's extracted text. When DocTalk cannot pinpoint the passage, it shows the cited page instead. | nuance |
| W15 | `featuresCitations.faq3A` | The passage itself is highlighted in PDF and plain-text (.txt) files — PDF uses bounding box coordinates, while | Yes. DocTalk highlights the cited passage in PDF, Word, PowerPoint, Excel, Markdown and plain-text files and web pages. PDFs use bounding box coordinates; in the other formats, DocTalk finds the cited text in the document's extracted text. Word documents open in the Text view, where the passage is marked; in PowerPoint files, the marks show on the slide when DocTalk can match the passage there, and in the Text view. When DocTalk cannot pinpoint the passage, it shows the cited page instead. | nuance, list, pptx |
| W16 | `featuresMultiFormat.formatUrlDesc` | Paste any URL and chat with the page content using the same citation features | Web page content extraction and analysis. Paste any URL and chat with the page content using the same citation and highlighting features. |  |
| W17 | `featuresMultiFormat.howStep3Desc` | Highlighting works in PDF and plain-text (.txt) files | Ask any question in the chat panel. The AI searches the extracted content, generates an answer with numbered citations, and lets you click to verify each one. Clicking a citation highlights the cited passage. When DocTalk cannot pinpoint the passage, it shows the cited page instead. | nuance |
| W18 | `featuresMultiFormat.compCitationHighlight` | Citation highlighting (PDF and .txt files) | Citation highlighting |  |
| W19 | `featuresMultiFormat.faq2A` | Yes. Upload any .pptx file and DocTalk extracts both slide content and speaker notes. Cita | Yes. Upload any .pptx file and DocTalk extracts both slide content and speaker notes. Citations reference specific slides so you can navigate directly to the source; the cited passage is highlighted on the slide when DocTalk can match it there, and in the Text view. | pptx |
| W20 | `featuresMultiFormat.faq4A` | The extracted text is then available for AI chat with the same clickable citations as any uploaded document | Yes. Paste any URL and DocTalk extracts the web page content automatically. The extracted text is then available for AI chat with the same citation highlighting as any uploaded document. |  |
| W21 | `compareChatpdf.heroDescription` | DocTalk also reads Excel files, and in PDF and plain-text (.txt) files it highlights the cited passage | Both DocTalk and ChatPDF let you chat with documents using AI. ChatPDF reads PDF, Word, PowerPoint, Markdown and text files, and its citations scroll to the source. DocTalk also reads Excel files and highlights the cited passage in your document. Here is how they compare on features, pricing and performance, checked against ChatPDF's own site in October 2026. |  |
| W22 | `compareChatpdf.whatIsDocTalkDescription` | in PDF and plain-text (.txt) files, the exact passage is also highlighted | DocTalk is an AI-powered document question-and-answer platform that supports seven file formats: PDF, DOCX, PPTX, XLSX, TXT, Markdown, and web URLs. Upload a document, ask questions in natural language, and receive answers with numbered citations. Clicking a citation scrolls to the source in your original document and highlights the cited passage. The interface supports 11 languages, offers two AI performance modes (Flash and Pro), and includes a free demo that requires no account creation. DocTalk is designed for students, researchers, legal professionals, and anyone who needs to extract information from documents quickly while maintaining full traceability to the source material. |  |
| W23 | `compareChatpdf.feature.citationsP2Pre` | Clicking it scrolls the document viewer to the cited location and, in PDF and plain-text (.txt) files, highlights the passage, so you can check the answer against the source in seconds | DocTalk also makes each citation a clickable link. Clicking it scrolls the document viewer to the cited passage and highlights it, so you can check the answer against the source in seconds. This matters most for academic research, legal document review, and any task where accuracy matters. When DocTalk cannot pinpoint the passage, it shows the cited page instead. Learn more about our  | nuance |
| W24 | `compareChatpdf.verdictP2` | In PDF and plain-text (.txt) files, it highlights the cited passage in the original document when you click a citation | DocTalk differs in three ways. It also reads Excel files. It highlights the cited passage in the original document when you click a citation. And it publishes its prices: Plus costs $9.99 per month and Pro $19.99 per month, while ChatPDF does not list a price for ChatPDF Plus. |  |
| W25 | `compareChatpdf.faq.a1` | DocTalk also reads Excel (XLSX), and in PDF and plain-text (.txt) files it highlights the cited passage when you click a citation | It depends on your files and how you check answers. Both tools read PDF, Word and PowerPoint files. DocTalk also reads Excel (XLSX) and highlights the cited passage in your document when you click a citation. ChatPDF lets you start without an account, and its citations scroll to the source; its site does not say whether the passage is highlighted. |  |
| W26 | `compareChatpdf.faq.a2` | When you click a citation, DocTalk scrolls to the cited location in your document | ChatPDF says its clickable citations instantly scroll to the exact source in your PDF. Its site does not say whether the cited passage is highlighted. When you click a citation, DocTalk scrolls to the cited passage in your document and highlights it. |  |
| W27 | `compareNotebooklm.heroDescription` | DocTalk is an independent tool focused on single-document analysis: it reads seven formats, highlights the cited passage in PDF and plain-text (.txt) files, and has an interface in 11 languages | Google NotebookLM is now called Gemini Notebook. It and DocTalk take different approaches to AI document analysis. Gemini Notebook is built around multi-source notebooks, has a free tier with usage limits, and creates Audio Overviews. DocTalk is an independent tool focused on single-document analysis: it reads seven formats, highlights the cited passage in your document, and has an interface in 11 languages. Here is how they compare. |  |
| W28 | `compareNotebooklm.table.doctalk.citationHighlighting` | Highlights the passage (PDF and .txt files) | Highlights the cited passage |  |
| W29 | `compareNotebooklm.whatIsDocTalkDescription` | in PDF and plain-text (.txt) files the exact passage is highlighted | DocTalk is an independent AI document Q&A platform designed for verifiable analysis of individual documents. It supports seven file formats (PDF, DOCX, PPTX, XLSX, TXT, Markdown, and web URLs). Click a citation in an AI answer to scroll to the source in a side-by-side document viewer, where the cited passage is highlighted. The interface is available in 11 languages. Two AI performance modes (Flash and Pro) let you choose between speed and depth. You can sign in with Google, Microsoft, or email. Stored documents are encrypted at rest, and DocTalk does not train models on your data. |  |
| W30 | `compareNotebooklm.feature.citationsP2Pre` | Click a citation and the viewer scrolls to the cited location | DocTalk shows citations in a side-by-side document viewer. Click a citation and the viewer scrolls to the cited passage and highlights it; in PDFs, bounding-box coordinates place the highlight precisely. DocTalk focuses on single-document analysis rather than multi-source synthesis. Learn more about  |  |
| W31 | `compareNotebooklm.verdictP2` | Clicking a citation jumps to the cited location in the original document | DocTalk is built for verifiable single-document analysis. Clicking a citation highlights the cited passage in the original document. It reads Excel (XLSX) files, which Gemini Notebook does not list, and its interface is available in 11 languages. You can sign in with Google, Microsoft or email. |  |
| W32 | `compareNotebooklm.faq.a1` | DocTalk is built for single-document analysis: clicking a citation jumps to the cited location in your document and, in PDF and plain-text (.txt) files, highlights the passage | They serve different purposes. DocTalk is built for single-document analysis: clicking a citation highlights the cited passage in your document. It reads 7 formats including Excel. NotebookLM, now called Gemini Notebook, is better for multi-source notebooks, accepts more source types, and creates Audio Overviews. Choose DocTalk for highlighted citations; choose Gemini Notebook for multi-source research on a free tier. |  |
| W33 | `compareNotebooklm.faq.a3` | DocTalk scrolls to the cited location in a document viewer next to the chat | Gemini Notebook (formerly NotebookLM) uses direct quotes from your sources as citations: hover to see the full quote, or select it to open the quote in context. Google's help pages do not mention page numbers. DocTalk scrolls to the cited passage in a document viewer next to the chat and highlights it. |  |
| W34 | `altsChatpdf.alt1Desc2` | Click it and the document viewer scrolls to the cited location | The standout feature is citation highlighting. When the AI answers your question, every citation is a clickable link. Click it and the document viewer scrolls to the cited passage and highlights it. When DocTalk cannot pinpoint the passage, it shows the cited page instead. ChatPDF's citations also scroll to the source, but its site does not say whether the passage is highlighted. For academic papers, legal documents, or any research where accuracy matters, the highlight makes checking faster. | nuance |
| W35 | `altsChatpdf.faq3Answer` | When you click a citation, DocTalk scrolls to the cited location in your document | When you click a citation, DocTalk scrolls to the cited passage in your document and highlights it. Several alternatives document their own approach: ChatDOC and Sharly AI say answers show page numbers, and ChatPDF's citations scroll to the source. Compare how each tool shows its sources before you choose. |  |
| W36 | `altsNotebooklm.alt1Desc1` | in PDF and plain-text (.txt) files, DocTalk highlights the cited passage in a side-by-side viewer of your original document, so you see it on the page where it appears | DocTalk is the best NotebookLM alternative for users who need precise citation verification in the original document. Gemini Notebook opens the quoted passage in context; DocTalk highlights the cited passage in a side-by-side viewer of your original document, so you see it on the page where it appears. |  |
| W37 | `altsNotebooklm.adv1` | PDF and .txt files also highlight the passage | Clickable citations that highlight the cited passage |  |
| W38 | `altsNotebooklm.faq3Answer` | When you click a citation, DocTalk scrolls to the cited location in your original document | When you click a citation, DocTalk scrolls to the cited passage in your original document and highlights it. Among the alternatives here, AskYourPDF cites the exact page and Elicit uses sentence-level citations. Gemini Notebook itself opens the quoted passage in context but does not document page numbers. |  |
| W39 | `altsHumata.alt1Desc1` | in PDF and plain-text (.txt) files the exact passage is highlighted | DocTalk is the best Humata alternative for individuals who want per-question pricing and citations they can check on the page. Click a citation in an AI answer to scroll to the source in a side-by-side document viewer, where the cited passage is highlighted. Humata's homepage also lists 'Highlights citations', but it does not say what is highlighted. |  |
| W40 | `compareHumata.heroDescription` | Humata offers team plans for up to 10 users and meters usage by pages, while DocTalk reads seven formats, highlights the cited passage in PDF and plain-text (.txt) files, and charges credits per question rather than per page | Humata and DocTalk both offer AI-powered document analysis, but they target different audiences. Humata offers team plans for up to 10 users and meters usage by pages, while DocTalk reads seven formats, highlights the cited passage in your document, and charges credits per question rather than per page. Here is how they stack up, checked against Humata's site in October 2026. |  |
| W41 | `compareHumata.whatIsDocTalkDescription` | in PDF and .txt files, the passage is also highlighted | DocTalk is an AI document Q&A platform built for verifiable answers. Upload documents in seven formats (PDF, DOCX, PPTX, XLSX, TXT, Markdown, or web URL), ask questions, and receive answers with clickable citations. Click a citation to scroll directly to the source and see the cited passage highlighted. The interface is available in 11 languages. Two AI performance modes (Flash and Pro) let you optimize for speed or depth. A free demo requires no signup, and paid plans start at $9.99 per month. DocTalk is designed for individuals who need fast, accurate, and traceable document analysis. |  |
| W42 | `compareHumata.citationsDocTalk` | Every citation in a DocTalk answer is clickable: click it and the document viewer scrolls to the cited location | Every citation in a DocTalk answer is clickable: click it and the document viewer scrolls to the cited passage and highlights it. In PDF files, bounding-box coordinates place the highlight; in the other formats, DocTalk finds the cited text in the document's extracted text. When DocTalk cannot pinpoint the passage, it shows the cited page instead. Researchers and professionals no longer need to search for sources by hand. Learn more about | nuance |
| W43 | `compareHumata.verdictParagraph2` | DocTalk lists seven supported formats, highlights the cited passage in PDF and plain-text (.txt) files, has an 11-language interface, and charges per question rather than per page, which suits individuals with long documents | DocTalk lists seven supported formats, highlights the cited passage in your document, has an 11-language interface, and charges per question rather than per page, which suits individuals with long documents. Its no-signup demo lets you try it before creating an account. |  |
| W44 | `compareHumata.faq2Answer` | in PDF and plain-text (.txt) files it also highlights the exact passage | Humata's homepage lists 'Highlights citations' as a feature and says answers come with cited links into your source files, but it does not say what is highlighted or whether page numbers are shown. In DocTalk, clicking a citation scrolls your document viewer to the source and highlights the cited passage. |  |
| W45 | `compareHumata.faq4Answer` | it handles 7 document formats (PDF, DOCX, PPTX, XLSX, TXT, MD, URL), and in PDF and plain-text (.txt) files its citations highlight the cited passage | We could not confirm it. Humata's homepage, pricing page and docs (checked October 2026) do not list supported file types, so check Humata's site before relying on video. DocTalk does not support video files; it handles 7 document formats (PDF, DOCX, PPTX, XLSX, TXT, MD, URL), and its citations highlight the cited passage. |  |
| W46 | `comparePdfai.heroDescription` | DocTalk reads seven formats, highlights the cited passage in PDF and plain-text (.txt) files, and has an 11-language interface | PDF.ai is a chat-with-PDF tool that also sells a document-parsing API. DocTalk reads seven formats, highlights the cited passage in the original document, and has an 11-language interface. Here is how the two tools compare on features, pricing and capability, checked against PDF.ai's site in October 2026. |  |
| W47 | `comparePdfai.whatIsDocTalkDescription` | Its standout feature is clickable citations: clicking a citation in an AI answer scrolls a side-by-side document viewer to the source, and in PDF and .txt files it also highlights the exact passage | DocTalk is a modern AI document Q&A platform supporting seven file formats: PDF, DOCX, PPTX, XLSX, TXT, Markdown, and web URLs. Its standout feature is clickable citations: clicking a citation in an AI answer scrolls a side-by-side document viewer to the source and highlights the cited passage. The interface is available in 11 languages, with two AI performance modes (Flash and Pro). DocTalk offers a free demo requiring no signup, a free tier with 300 credits per month, and paid plans starting at $9.99. It is actively developed with regular feature additions and security improvements. |  |
| W48 | `comparePdfai.citationsDocTalk` | Clicking it scrolls the document viewer to the cited location | Every citation in a DocTalk answer is clickable. Clicking it scrolls the document viewer to the cited passage and highlights it, so you can check the answer at once. For PDFs, bounding-box coordinates place the highlight precisely. When DocTalk cannot pinpoint the passage, it shows the cited page instead. This is particularly useful for academic, legal, and professional research. Learn more about | nuance |
| W49 | `comparePdfai.verdictParagraph2` | Clicking a citation jumps to the cited location in your document | DocTalk reads seven formats, so Word, PowerPoint and Excel files need no conversion. Clicking a citation highlights the cited passage in your document. The interface is available in 11 languages. Plus costs $9.99 per month, compared with $17 per month for PDF.ai Pro billed monthly ($10 per month billed yearly). |  |
| W50 | `comparePdfai.faq3Answer` | When you click a citation, DocTalk scrolls the document viewer to the cited location | When you click a citation, DocTalk scrolls the document viewer to the cited passage and highlights it. PDF.ai says every response is backed by sources from your document; its product pages do not say whether page numbers are shown or passages highlighted. |  |
| W51 | `compareAskyourpdf.heroDescription` | AskYourPDF builds an ecosystem of browser extensions and research integrations, while DocTalk focuses on one web app that reads seven document formats and highlights the cited passage in PDF and .txt files | DocTalk and AskYourPDF both help you extract information from documents using AI, but they serve different use cases. AskYourPDF builds an ecosystem of browser extensions and research integrations, while DocTalk focuses on one web app that reads seven document formats and highlights the cited passage in your document. Here is a detailed comparison to help you choose the right tool. | skip zh/fr |
| W52 | `compareAskyourpdf.metaDescription` | AskYourPDF builds an ecosystem of browser extensions and research integrations, while DocTalk focuses on one web app that reads seven document formats and highlights the cited passage in PDF and .txt files | (same as compareAskyourpdf.heroDescription) | = compareAskyourpdf.heroDescription, skip zh/fr |
| W53 | `compareAskyourpdf.whatIsDocTalkDescription` | Its standout feature is clickable citations: click any citation in an AI answer to scroll to the source in your document, and in PDF and .txt files the exact passage is highlighted | DocTalk is an AI document Q&A platform that supports seven file formats: PDF, DOCX, PPTX, XLSX, TXT, Markdown, and web URLs. Its standout feature is clickable citations: click a citation in an AI answer to scroll to the source in your document and see the cited passage highlighted. The interface is available in 11 languages, and two AI performance modes (Flash and Pro) let you choose the right tradeoff between speed and depth. DocTalk is built for anyone who needs to verify AI answers against original sources, from students writing papers to lawyers reviewing contracts. |  |
| W54 | `compareAskyourpdf.citationsDocTalk` | DocTalk also makes every citation clickable: click it and the document viewer scrolls to the cited location, and in PDF and plain-text (.txt) files it highlights the passage | DocTalk also makes every citation clickable: click it and the document viewer scrolls to the cited passage and highlights it. When DocTalk cannot pinpoint the passage, it shows the cited page instead. For academic and legal work, where every claim must be traceable, this saves time. Learn more about | nuance |
| W55 | `compareAskyourpdf.verdictParagraph2` | DocTalk takes a different approach: one web app that reads PowerPoint and Excel files as well as PDF and Word, and highlights the cited passage in PDF and plain-text (.txt) files | DocTalk takes a different approach: one web app that reads PowerPoint and Excel files as well as PDF and Word, and highlights the cited passage in your document. If your priority is traceable answers from mixed document formats, DocTalk is the better fit. |  |
| W56 | `compareAskyourpdf.faq1Answer` | DocTalk reads 7 formats, including PowerPoint and Excel, and highlights the cited passage in PDF and plain-text (.txt) files | It depends on your needs. DocTalk reads 7 formats, including PowerPoint and Excel, and highlights the cited passage in your document. AskYourPDF offers more integrations, including a Chrome extension, a Zotero plugin, mobile apps and API access. If you value citation highlighting and format coverage, DocTalk is the better choice. If you need browser integrations or API access, AskYourPDF has the edge. |  |
| W57 | `compareAskyourpdf.faq2Answer` | When you click a citation, DocTalk scrolls to the cited location in your document | AskYourPDF says each answer cites the exact page in the original PDF, and you can click the citation to verify it. Its site does not say whether the cited passage is highlighted. When you click a citation, DocTalk scrolls to the cited passage in your document and highlights it. |  |
| W58 | `useCasesStudents.citations.p2b` | in PDF and plain-text (.txt) files, it also highlights it | solves this by grounding every AI answer in your actual document text. Each numbered citation corresponds to a specific passage in your uploaded paper. Click the citation, and the document viewer scrolls to the source text and highlights the cited passage. When DocTalk cannot pinpoint the passage, it shows the cited page instead. | nuance |
| W59 | `useCasesStudents.getStarted.step3.description` | The document viewer scrolls to the exact source passage, highlighted in PDF and plain-text (.txt) files, so you can verify the claim before using it in your work | Click a numbered citation in the AI answer. The document viewer scrolls to the source passage and highlights it, so you can verify the claim before using it in your work. |  |
| W60 | `altsAskyourpdf.faq4Answer` | DocTalk scrolls to the cited location in your document and, in PDF and plain-text (.txt) files, highlights the passage | DocTalk scrolls to the cited passage in your document and highlights it. AskYourPDF already cites the exact page and lets you click the citation to verify it; its site does not say whether the passage is highlighted. ChatDOC also documents clickable page numbers. |  |
| W61 | `altsAskyourpdf.whyReason2` | DocTalk highlights the cited passage in PDF and plain-text (.txt) files | Citation style — AskYourPDF cites the exact page and lets you click to verify, but its site does not say whether the passage is highlighted. DocTalk highlights the cited passage in the original document. |  |
| W62 | `altsAskyourpdf.alt1Desc1` | Its standout feature is citation highlighting: in PDF and plain-text (.txt) files, clicking a citation highlights the cited passage in the source document | DocTalk is the top alternative to AskYourPDF for users who want highlighted citations and broader format support: it reads 7 document types (PDF, DOCX, PPTX, XLSX, TXT, Markdown, and URLs), including PowerPoint and Excel. Its standout feature is citation highlighting: clicking a citation highlights the cited passage in the source document. |  |
| W63 | `altsPdfai.faq4Answer` | When you click a citation, DocTalk scrolls to the cited location in your document | When you click a citation, DocTalk scrolls to the cited passage in your document and highlights it. ChatDOC and Sharly AI say their answers show page numbers. PDF.ai says every response is backed by sources from the document, without describing page numbers or highlighting. |  |
| W64 | `altsPdfai.whyReason2` | DocTalk highlights the cited passage in PDF and plain-text (.txt) files | Citation style — PDF.ai says every response is backed by sources from your document, but its product pages do not describe page numbers or highlighting. DocTalk highlights the cited passage in the original document. |  |
| W65 | `altsPdfai.alt1Desc1` | In PDF and plain-text (.txt) files, its citations highlight the exact source passage | DocTalk is the best PDF.ai alternative for users who need more than PDF support. While PDF.ai accepts only PDF files, DocTalk handles 7 document formats (PDF, DOCX, PPTX, XLSX, TXT, Markdown, and URLs). Its citations highlight the cited passage in the source document. |  |
| W66 | `altsPdfai.alt1Desc2` | Every AI answer includes clickable citations that scroll to the source, and in PDF and plain-text (.txt) files they highlight the exact text, making it easy to check an answer at once | DocTalk's citation highlighting is its standout feature. Every AI answer includes clickable citations that scroll to the source and highlight the cited passage, making it easy to check an answer at once. When DocTalk cannot pinpoint the passage, it shows the cited page instead. | nuance |

| # | key | reason kept |
|---|---|---|
| K1 | `landing.description` | true as is ("exact page cited"); home search snippet; owner decision |
| K2 | `landing.metaDescription` | same as landing.description |
| K3 | `blog.post.aboutDescription` | true as is ("source citations that link back to your original text"); rendered on all 20 blog posts, the 4 frozen ones included; a highlight claim there would be universal (Codex r1) |
| K4 | `featuresDemo.hero.subtitle` | the 3 demo documents are PDFs; "multi-format support" stays dropped |
| K5 | `featuresDemo.metaDescription` | same as featuresDemo.hero.subtitle |
| K6 | `featuresDemo.docs.doc3.description` | demo documents are PDFs; "across formats" stays dropped |
| K7 | `featuresCitations.howStep3Title` | true as is ("Click any citation to jump to the source"); HowTo step name |
| K8 | `featuresMultiFormat.compTitle` | competitor-table heading (competitor facts batch) |
| K9 | `featuresMultiFormat.compSubtitle` | competitor-table subtitle (competitor facts batch) |
| K10 | `featuresMultiFormat.compDisclaimer` | competitor-table disclaimer (competitor facts batch) |
| K11 | `useCasesStudents.multilingual.p3` | true as is ("a Japanese PDF"); Japanese text in non-PDF formats was not browser-tested (zh MD and ar TXT/MD were) |
| K12 | `useCasesLawyers.whyCitations.p3link` | pt-only grammar fix in the 10-11 change; no limit |
| K13 | `useCasesLawyers.whyCitations.p3pre` | pt-only grammar fix in the 10-11 change; no limit |

Per-locale scope: `compareAskyourpdf.heroDescription` / `metaDescription` are skipped in zh and fr — those two
locales never coupled the highlight claim with formats (unchanged in the 10-11 change too). The two
`useCasesLawyers.whyCitations.p3*` keys changed in pt only on 10-11 (a grammar fix), so they are kept.

Fixed phrases per locale (each asserted verbatim in every value that needs it):

| locale | NUANCE | FORMAT_LIST | Text view |
|---|---|---|---|
| en | When DocTalk cannot pinpoint the passage, it shows the cited page instead. | PDF, Word, PowerPoint, Excel, Markdown and plain-text files and web pages | the Text view |
| zh | 如果 DocTalk 无法精确定位该段落，则会改为显示被引用的页面。 | PDF、Word、PowerPoint、Excel、Markdown、纯文本文件和网页 | 「文本」视图 |
| ja | DocTalkが該当箇所を正確に特定できない場合は、代わりに引用されたページを表示します。 | PDF、Word、PowerPoint、Excel、Markdown、プレーンテキストの各ファイルとWebページ | 「テキスト」ビュー |
| ko | DocTalk에서 구절 위치를 정확히 찾지 못하면 인용된 페이지를 대신 보여 줍니다. | PDF, Word, PowerPoint, Excel, Markdown, 일반 텍스트 파일 및 웹 페이지 | '텍스트' 보기 |
| es | Si DocTalk no puede ubicar el pasaje con precisión, muestra en su lugar la página citada. | archivos PDF, Word, PowerPoint, Excel, Markdown y de texto plano, y páginas web | la vista «Texto» |
| de | Wenn DocTalk die Passage nicht genau lokalisieren kann, zeigt es stattdessen die zitierte Seite an. | PDF-, Word-, PowerPoint-, Excel-, Markdown- und Textdateien sowie Webseiten | Ansicht „Text“ |
| fr | Lorsque DocTalk ne parvient pas à localiser précisément le passage, il affiche la page citée à la place. | les fichiers PDF, Word, PowerPoint, Excel, Markdown et texte brut, ainsi que dans les pages web | la vue « Texte » |
| pt | Quando o DocTalk não consegue localizar o trecho com precisão, ele mostra a página citada. | arquivos PDF, Word, PowerPoint, Excel, Markdown e de texto simples, e em páginas web | visualização "Texto" |
| it | Quando DocTalk non riesce a individuare con precisione il passaggio, mostra invece la pagina citata. | nei file PDF, Word, PowerPoint, Excel, Markdown e di testo semplice e nelle pagine web | vista "Testo" |
| ar | وعندما يتعذّر تحديد المقطع بدقة، يعرض DocTalk الصفحة المُستشهد بها بدلًا من ذلك. | ملفات PDF وWord وPowerPoint وExcel وMarkdown والنص العادي وصفحات الويب | عرض «النص» |
| hi | जब DocTalk अंश को ठीक-ठीक नहीं ढूँढ पाता, तो वह उसकी जगह उद्धृत पृष्ठ दिखाता है। | PDF, Word, PowerPoint, Excel, Markdown और सादा-पाठ फ़ाइलों तथा वेब पेजों | “टेक्स्ट” व्यू |

PowerPoint clause (rule 4), written after the coordinator's slide-view test, in `featuresCitations.layer3Desc`,
`featuresCitations.faq3A` and `featuresMultiFormat.faq2A` of every locale (script `pptx-followup.js`, each old
clause asserted to occur once). EN: "in PowerPoint files, the marks show on the slide when DocTalk can match the
passage there, and in the Text view." / faq2A: "the cited passage is highlighted on the slide when DocTalk can
match it there, and in the Text view." The slide is 幻灯片 / スライド / 슬라이드 / diapositiva / Folie / diapositive /
slide / diapositiva / الشريحة / स्लाइड; the Text view keeps the phrase in the table above. ko puts the Text view
first ("…'텍스트' 보기에 표시되며, … 슬라이드에도 표시됩니다"); the meaning is the same.

Where a value lists the formats without PDF (`featuresCitations.layer3Desc`, as in English), it holds FORMAT_LIST
minus its PDF item. The pt value keeps "…e de texto simples, e em páginas web" (the comma and the repeated
preposition keep "páginas web" from reading as a kind of file).

Translator notes on pre-existing defects outside the highlight clause, left unchanged (out of scope):
- zh `blog.post.aboutDescription` (kept, unchanged) last sentence "支持PDF、DOCX、PPTX、XLSX等11种语言。" mistranslates
  "and more, in 11 languages" (Codex r1); ja has a stray space before "PDF". The blog is English-only, so neither
  renders.
- fr `featuresMultilingual.cjk.p3` has never carried the English second sentence (CJK semantic search).
- pt `featuresMultilingual.cjk.p3` second sentence ("funcionem tão bem quanto em inglês") differs from the English.
Fixed because the sentence was rewritten anyway: `useCasesLawyers.steps.verify.description` "original language"
→ "original wording" in es, it, de (the old text read it as a language).

## B. TSX, `llms.txt`

| file | before | after |
|---|---|---|
| `frontend/src/app/features/citations/page.tsx` (OpenGraph description, EN) | "…Click any citation to jump to the exact source text, highlighted in PDF and .txt files. Verify every answer." | "…Click a citation to jump to the source text and see the cited passage highlighted. Verify every answer." |
| `frontend/src/app/features/citations/page.tsx` (metadata description, EN; Codex r1) | "Every AI answer includes numbered citations. Click any citation to jump to the exact source text and verify every answer in your document." | "Every AI answer includes numbered citations. Click a citation to jump to the source text and verify every answer in your document." |
| `frontend/public/llms.txt:3` | "…click a citation to jump to the source, with the passage highlighted in PDF and plain-text (.txt) files." | "…click a citation to jump to the source and see the cited passage highlighted." |

Kept: `layout.tsx` / `page.tsx` root description "source citations that link back to your document" and
`landing.description` / `landing.metaDescription` "the exact page cited" (true; they are the home search snippet,
so widening them is left to the owner); `HomeJsonLd` `DATE_MODIFIED` is left at `2026-10-11` — coordinator
decides. Facts: it is the `dateModified` of the SoftwareApplication node (`HomeJsonLd.tsx:88`), whose `description`
is `landing.description` (unchanged here); the source comment says "Bumped by hand when the product description
materially changes"; the 10-11 commit `5b94d020` bumped it "(landing description changed)". `landing.faq.a1`
(FAQPage node, which has no date) does change here; `FinanceContent.tsx` anchor "clickable citations" (true; "each answer … through citation
highlighting" was the borderline universal reading). `CitationsContent.tsx` / `MultiFormatContent.tsx` cells are
unchanged: DocTalk `true`, competitors `Not verified` / `Jumps to source` / `Links to the cited page` / Humata
`Partial`. Their row labels change through `featuresCitations.compTextSnippet` and
`featuresMultiFormat.compCitationHighlight`.

## C. Blog posts (non-frozen), `updated: "2026-10-12"` on each

Rule for blog prose (after Codex r2): a sentence that states a highlight as the outcome of a click carries NUANCE in
the same paragraph. Table cells and feature labels ("Click-to-highlight citations") do not.

| file | edits (line numbers in the final file) |
|---|---|
| `ai-document-analysis-languages.md` | :60 the citations take you to the German passages "and highlight the cited passage" + NUANCE |
| `chat-with-excel-spreadsheet-ai.md` | :94 "The highlighted passage shows the rows and columns the AI used." + NUANCE; :172 DocTalk cell "Click-to-highlight citations" (competitor cells unchanged) |
| `chat-with-powerpoint-ai.md` | :85 "…jump to the corresponding slide in the document viewer; the cited passage is highlighted on the slide when DocTalk can match it there, and in the Text view." + NUANCE (rule 4) |
| `citation-highlighting-matters.md` | :68 highlights the cited passage + NUANCE; :80 "confirming the highlighted passage" → "the cited passage" (Codex r3: "You click each citation …" is universal); :110, :114 worked examples "shows the highlighted note / text" → "the cited note / text" (same "each click" reading); :120 DocTalk row "Click-to-navigate highlighting, with the page on each citation" / "Yes — highlighted in the original document"; :154 "…and highlights the cited passage." + NUANCE; :188 "Upload a document … Click a numbered citation in the answer to see the cited passage highlighted in the original document." + NUANCE |
| `how-to-chat-with-docx-ai.md` | :51 scrolls to the section and highlights the cited passage; "Word documents open in the Text view, where DocTalk finds the cited text and marks it." + NUANCE; :77 "The highlighted passage shows you what the AI based its answer on." + NUANCE; :125 DocTalk cell "Click a citation → passage highlighted"; :134 "In DocTalk, clicking a citation highlights the cited passage in the document." + NUANCE (no "difference" claim restored); :160 "Click a citation to jump to the source text and see the cited passage highlighted." + NUANCE |
| `how-to-chat-with-pdf-ai.md` | :52 "highlights the exact passage" → "the cited passage" (rule 3, untouched by 10-11); :80 + NUANCE (untouched by 10-11, "Click any citation number … The relevant text is highlighted"); :149 "In all of these formats, clicking a citation jumps to the source and highlights the cited passage; in PowerPoint files, the highlight shows on the slide when DocTalk can match the passage there, and in the Text view." + NUANCE (rule 4) |
| `how-to-chat-with-url-webpage-ai.md` | :16 anchor "citation highlighting"; :93 "Click a numbered citation … and see it highlighted." + NUANCE (:208 stays at the base "cited answers linked to their source passages") |
| `notebooklm-alternatives-2026.md` | :51 "…scrolls to the passage and [highlights it]" + NUANCE; :57 "Click-to-highlight citations in the original document"; :138 DocTalk cell "Passage highlighted in the file" (other cells unchanged); :153 "DocTalk highlights the cited passage; Quote Finder gives…"; :173 "…scrolls to the passage and highlights it." + NUANCE. :14, :43, :53, :167 stay at the base "original PDF" (they speak of the original layout; a Word file shows in the Text view) |
| `rag-explained-simple.md` | :14 "the exact paragraph highlighted" → "the cited paragraph" (rule 3, untouched by 10-11); :111 "DocTalk highlights the cited passage in the original document viewer…" + NUANCE |

Left as is in these posts: `citation-highlighting-matters.md:70` ("here is the exact sentence, highlighted in
context" — describes Level 4 as a concept, accepted on 10-11), :16 (defines the concept), and the other worked
examples :94–106 (one scenario each, no "each citation" promise);
`how-to-chat-with-pdf-ai.md:193` (the demo: its three documents are PDFs, singular "click a citation");
`rag-explained-simple.md` :109, :123, :166 (how RAG tools work in general, not a DocTalk promise); `imageAlt`
lines (they describe a placeholder image); `chat-with-powerpoint-ai.md` :130, :196, :200 ("cited answers" — true).

## D. Frozen posts — not edited, queued

`best-ai-pdf-tools-2026.md`, `chatpdf-alternatives-2026.md`, `best-ai-tools-academic-research-2026.md` (frozen until
11-07) and `ai-pdf-readers-page-number-citations-2026.md` (frozen until 11-21) are byte-identical to `origin/stable`.
Under the new rules their format claims are now true (they never carried the 10-11 limit, so the 10-11 queue
Q1–Q11 is withdrawn). Three spots break rule 3 and are queued:

| # | file:line | current | proposed for the read date |
|---|---|---|---|
| Q1 | `best-ai-pdf-tools-2026.md:189` | "DocTalk highlights the exact passage and gives machine-checked quotes with the page." | "DocTalk highlights the cited passage and gives machine-checked quotes with the page." |
| Q2 | `chatpdf-alternatives-2026.md:43` | "click one and the document scrolls to the exact passage and [highlights it](/features/citations)" | "click one and the document scrolls to the cited passage and [highlights it](/features/citations)" |
| Q3 | `best-ai-tools-academic-research-2026.md:45` | "…the app scrolls to the exact passage in the original paper and highlights it." | "…the app scrolls to the cited passage in the original paper and highlights it." |

Read and found acceptable (no edit queued): `best-ai-pdf-tools-2026.md` :40, :42, :46 ("Click-to-highlight
citations on every answer": a feature line, no exact-sentence promise), :199, :201, :238; `chatpdf-alternatives-2026.md`
:45, :49, :194, :205, :225, :234; `best-ai-tools-academic-research-2026.md` :58, :254, :265, :300;
`ai-pdf-readers-page-number-citations-2026.md` :48, :149, :184 (PDF context, true).

## E. Counts

- Locale values: 66 widened keys × 11 locales, minus 2 skips in zh and fr = **722 values** (en 66, zh 64, ja 66,
  ko 66, es 66, de 66, fr 64, pt 66, it 66, ar 66, hi 66). No key added or removed; 13 keys of the 10-11 set kept.
  Every widened key changed in every locale it applies to; the NUANCE sentence occurs exactly once in each of the
  14 flagged keys per locale and in no other changed value; `featuresCitations.metaDescription` =
  `heroSubtitle` and `compareAskyourpdf.metaDescription` = `heroDescription` in every locale where they were
  equal before; no `*.metaTitle` changed; no changed value has a newline or ".txt" (script: `cross.js`).
- TSX: 1 file (`features/citations/page.tsx`: metadata and OpenGraph descriptions). `llms.txt`: 1 line.
- Blog: 9 non-frozen posts, `updated: "2026-10-12"` on each. Frozen: 4 posts byte-unchanged, 3 spots queued (D).

## F. Changed public URLs (for IndexNow)

Method: the final build (HEAD `09821195`, `next build`) was searched for a fragment of every changed locale value
and blog line, with `<script>` content stripped, so only visible text and `<head>` metadata count. The visibly
changed sitemap pages are exactly this list (157 URLs):
- `/` and the 10 locale home pages (landing FAQ answer 1 and the citations feature card; it/ar/hi home pages are
  indexable).
- 17 paths × 8 indexable locales (en, zh, ja, es, ko, de, fr, pt): `/features`, `/features/citations`,
  `/features/multi-format`, `/features/multilingual`, `/use-cases/{finance,lawyers,students}`,
  `/compare/{chatpdf,notebooklm,humata,pdf-ai,askyourpdf}`, `/alternatives/{chatpdf,notebooklm,humata,askyourpdf,pdf-ai}`.
- The 9 edited blog posts.
- `/llms.txt`.

Changed but not listed: the same 17 paths in it, ar, hi (noindex; 51 pages); new text only inside the RSC payload,
nothing visible, on `/{zh,ja,ko,es,de,fr,pt}/demo`, `/blog`, `/blog/category/{ai-insights,comparisons,guides}` and
the posts `ai-document-security-privacy`, `free-ai-pdf-chat-no-signup` and three frozen posts
(`ai-pdf-readers-page-number-citations-2026`, `best-ai-tools-academic-research-2026`, `chatpdf-alternatives-2026`),
whose payload carries other posts' text. The frozen posts' visible HTML is unchanged.

```
https://www.doctalk.site/
https://www.doctalk.site/zh
https://www.doctalk.site/ja
https://www.doctalk.site/es
https://www.doctalk.site/ko
https://www.doctalk.site/de
https://www.doctalk.site/fr
https://www.doctalk.site/pt
https://www.doctalk.site/it
https://www.doctalk.site/ar
https://www.doctalk.site/hi
https://www.doctalk.site/features
https://www.doctalk.site/zh/features
https://www.doctalk.site/ja/features
https://www.doctalk.site/es/features
https://www.doctalk.site/ko/features
https://www.doctalk.site/de/features
https://www.doctalk.site/fr/features
https://www.doctalk.site/pt/features
https://www.doctalk.site/features/citations
https://www.doctalk.site/zh/features/citations
https://www.doctalk.site/ja/features/citations
https://www.doctalk.site/es/features/citations
https://www.doctalk.site/ko/features/citations
https://www.doctalk.site/de/features/citations
https://www.doctalk.site/fr/features/citations
https://www.doctalk.site/pt/features/citations
https://www.doctalk.site/features/multi-format
https://www.doctalk.site/zh/features/multi-format
https://www.doctalk.site/ja/features/multi-format
https://www.doctalk.site/es/features/multi-format
https://www.doctalk.site/ko/features/multi-format
https://www.doctalk.site/de/features/multi-format
https://www.doctalk.site/fr/features/multi-format
https://www.doctalk.site/pt/features/multi-format
https://www.doctalk.site/features/multilingual
https://www.doctalk.site/zh/features/multilingual
https://www.doctalk.site/ja/features/multilingual
https://www.doctalk.site/es/features/multilingual
https://www.doctalk.site/ko/features/multilingual
https://www.doctalk.site/de/features/multilingual
https://www.doctalk.site/fr/features/multilingual
https://www.doctalk.site/pt/features/multilingual
https://www.doctalk.site/use-cases/finance
https://www.doctalk.site/zh/use-cases/finance
https://www.doctalk.site/ja/use-cases/finance
https://www.doctalk.site/es/use-cases/finance
https://www.doctalk.site/ko/use-cases/finance
https://www.doctalk.site/de/use-cases/finance
https://www.doctalk.site/fr/use-cases/finance
https://www.doctalk.site/pt/use-cases/finance
https://www.doctalk.site/use-cases/lawyers
https://www.doctalk.site/zh/use-cases/lawyers
https://www.doctalk.site/ja/use-cases/lawyers
https://www.doctalk.site/es/use-cases/lawyers
https://www.doctalk.site/ko/use-cases/lawyers
https://www.doctalk.site/de/use-cases/lawyers
https://www.doctalk.site/fr/use-cases/lawyers
https://www.doctalk.site/pt/use-cases/lawyers
https://www.doctalk.site/use-cases/students
https://www.doctalk.site/zh/use-cases/students
https://www.doctalk.site/ja/use-cases/students
https://www.doctalk.site/es/use-cases/students
https://www.doctalk.site/ko/use-cases/students
https://www.doctalk.site/de/use-cases/students
https://www.doctalk.site/fr/use-cases/students
https://www.doctalk.site/pt/use-cases/students
https://www.doctalk.site/compare/chatpdf
https://www.doctalk.site/zh/compare/chatpdf
https://www.doctalk.site/ja/compare/chatpdf
https://www.doctalk.site/es/compare/chatpdf
https://www.doctalk.site/ko/compare/chatpdf
https://www.doctalk.site/de/compare/chatpdf
https://www.doctalk.site/fr/compare/chatpdf
https://www.doctalk.site/pt/compare/chatpdf
https://www.doctalk.site/compare/notebooklm
https://www.doctalk.site/zh/compare/notebooklm
https://www.doctalk.site/ja/compare/notebooklm
https://www.doctalk.site/es/compare/notebooklm
https://www.doctalk.site/ko/compare/notebooklm
https://www.doctalk.site/de/compare/notebooklm
https://www.doctalk.site/fr/compare/notebooklm
https://www.doctalk.site/pt/compare/notebooklm
https://www.doctalk.site/compare/humata
https://www.doctalk.site/zh/compare/humata
https://www.doctalk.site/ja/compare/humata
https://www.doctalk.site/es/compare/humata
https://www.doctalk.site/ko/compare/humata
https://www.doctalk.site/de/compare/humata
https://www.doctalk.site/fr/compare/humata
https://www.doctalk.site/pt/compare/humata
https://www.doctalk.site/compare/pdf-ai
https://www.doctalk.site/zh/compare/pdf-ai
https://www.doctalk.site/ja/compare/pdf-ai
https://www.doctalk.site/es/compare/pdf-ai
https://www.doctalk.site/ko/compare/pdf-ai
https://www.doctalk.site/de/compare/pdf-ai
https://www.doctalk.site/fr/compare/pdf-ai
https://www.doctalk.site/pt/compare/pdf-ai
https://www.doctalk.site/compare/askyourpdf
https://www.doctalk.site/zh/compare/askyourpdf
https://www.doctalk.site/ja/compare/askyourpdf
https://www.doctalk.site/es/compare/askyourpdf
https://www.doctalk.site/ko/compare/askyourpdf
https://www.doctalk.site/de/compare/askyourpdf
https://www.doctalk.site/fr/compare/askyourpdf
https://www.doctalk.site/pt/compare/askyourpdf
https://www.doctalk.site/alternatives/chatpdf
https://www.doctalk.site/zh/alternatives/chatpdf
https://www.doctalk.site/ja/alternatives/chatpdf
https://www.doctalk.site/es/alternatives/chatpdf
https://www.doctalk.site/ko/alternatives/chatpdf
https://www.doctalk.site/de/alternatives/chatpdf
https://www.doctalk.site/fr/alternatives/chatpdf
https://www.doctalk.site/pt/alternatives/chatpdf
https://www.doctalk.site/alternatives/notebooklm
https://www.doctalk.site/zh/alternatives/notebooklm
https://www.doctalk.site/ja/alternatives/notebooklm
https://www.doctalk.site/es/alternatives/notebooklm
https://www.doctalk.site/ko/alternatives/notebooklm
https://www.doctalk.site/de/alternatives/notebooklm
https://www.doctalk.site/fr/alternatives/notebooklm
https://www.doctalk.site/pt/alternatives/notebooklm
https://www.doctalk.site/alternatives/humata
https://www.doctalk.site/zh/alternatives/humata
https://www.doctalk.site/ja/alternatives/humata
https://www.doctalk.site/es/alternatives/humata
https://www.doctalk.site/ko/alternatives/humata
https://www.doctalk.site/de/alternatives/humata
https://www.doctalk.site/fr/alternatives/humata
https://www.doctalk.site/pt/alternatives/humata
https://www.doctalk.site/alternatives/askyourpdf
https://www.doctalk.site/zh/alternatives/askyourpdf
https://www.doctalk.site/ja/alternatives/askyourpdf
https://www.doctalk.site/es/alternatives/askyourpdf
https://www.doctalk.site/ko/alternatives/askyourpdf
https://www.doctalk.site/de/alternatives/askyourpdf
https://www.doctalk.site/fr/alternatives/askyourpdf
https://www.doctalk.site/pt/alternatives/askyourpdf
https://www.doctalk.site/alternatives/pdf-ai
https://www.doctalk.site/zh/alternatives/pdf-ai
https://www.doctalk.site/ja/alternatives/pdf-ai
https://www.doctalk.site/es/alternatives/pdf-ai
https://www.doctalk.site/ko/alternatives/pdf-ai
https://www.doctalk.site/de/alternatives/pdf-ai
https://www.doctalk.site/fr/alternatives/pdf-ai
https://www.doctalk.site/pt/alternatives/pdf-ai
https://www.doctalk.site/blog/ai-document-analysis-languages
https://www.doctalk.site/blog/chat-with-excel-spreadsheet-ai
https://www.doctalk.site/blog/chat-with-powerpoint-ai
https://www.doctalk.site/blog/citation-highlighting-matters
https://www.doctalk.site/blog/how-to-chat-with-docx-ai
https://www.doctalk.site/blog/how-to-chat-with-pdf-ai
https://www.doctalk.site/blog/how-to-chat-with-url-webpage-ai
https://www.doctalk.site/blog/notebooklm-alternatives-2026
https://www.doctalk.site/blog/rag-explained-simple
https://www.doctalk.site/llms.txt
```

## G. Codex adversarial review

| round | verdict | findings | fixed in |
|---|---|---|---|
| r1 (`codex-r1.md`) | SHIP-WITH-FIXES | `page.tsx` metadata description "Click any citation to jump to the exact source text"; `blog.post.aboutDescription` universal highlight claim on all 20 blog posts; zh mistranslation in that key; `citation-highlighting-matters.md` :154 and :188 without the fallback; nit: ja stray space in that key | `3fc712a1`: metadata "Click a citation to jump to the source text"; `aboutDescription` restored to the base value in all 11 locales (now kept, so the zh/ja defects are pre-existing and unrendered); NUANCE added at :154 and :188. Also `notebooklm-alternatives-2026.md:43` restored to "the original PDF" (found during the fix: the paragraph is about the original layout) |
| r2 (`codex-r2.md`) | SHIP-WITH-FIXES | `ai-document-analysis-languages.md:60` plural "the citations … highlight them"; `how-to-chat-with-pdf-ai.md:149` "In all of these formats … highlights"; `notebooklm-alternatives-2026.md:14` "check each answer against the highlighted passage in the original file" | `d034e305`: NUANCE in every blog paragraph that states a highlight as a click outcome (11 places, section C); "exact" → "cited" at pdf:52 and rag:14; notebooklm :14/:53/:167 and url :208 back to their base text. Then, before r3: NUANCE added to `compareChatpdf.feature.citationsP2Pre` ("each citation … Clicking it … highlights it") and `useCasesStudents.citations.p2b` ("Each numbered citation … highlights") in all 11 locales |
| r3 (`codex-r3.md`) | SHIP-WITH-FIXES | `citation-highlighting-matters.md:80` "You click each citation, spend 5-10 seconds confirming the highlighted passage" is universal | `09821195`: :80 "the cited passage"; :110 and :114 ("Each click shows the highlighted note", "Clicking each citation shows the highlighted text") softened the same way |
| r4 (`codex-r4.md`) | **SHIP** | none ("No blocker or should-fix findings remain"; nits: none) | — |

## H. Verification (final tree, HEAD `09821195`)

- `npm run test:unit`: 350 tests, 350 pass, 0 fail. `npm run lint`: no ESLint warnings or errors; critical and public
  i18n checks passed. (`npm test` does not exist in `frontend/package.json`; `test:unit` is `node --test`.)
- `df -h /System/Volumes/Data` before the build: 19 GiB free. `npm run build`: exit 0, 426/426 static pages (only
  the pre-existing Sentry deprecation warning). `scripts/verify-marketing-jsonld-phase2.py`: PASS, 253 prerendered
  URLs, 770 exact FAQ pairs, 33 exact HowTo steps. Built HTML: 0 files with "plain-text (.txt)" / "PDF and .txt".
  `frontend/.next` deleted afterwards.
- `cross.js`: every widened key changed in each locale it applies to, kept keys byte-identical to `origin/stable`,
  NUANCE once in each of the 14 flagged keys per locale, meta = hero pairs equal, no `*.metaTitle` change, no
  newline or ".txt" in a changed value: CROSS OK.
- Not verified in a browser: the rendered copy (no dev server was started); whether the Slides-view jump scrolls.

## I. Release (2026-10-13)

Frontend and content only: no `backend/`, `version.json` or infra diff, so it shipped under the standing frontend
approval (CI green + Codex SHIP).

| Step | Evidence |
|---|---|
| Commit | `b95fed39` on `main` and `stable` (claims `e442cc37..09821195` + record `edcfc791`, then the 0.36.0 record) |
| CI | run `38434275219` on `b95fed39`: backend, frontend, integration, docker = success (16:54:09Z → 16:57:03Z) |
| Vercel production | deployment for `b95fed39` = success at 16:59:48Z |
| Live check | `live_claims_check.py` against www.doctalk.site, three runs (two saved, about 40 s apart): 155 OK / 0 FAIL / ALL_OK each |
| IndexNow | 156 URLs from §F (home as `https://www.doctalk.site`, `/llms.txt` dropped: not in the sitemap). The 17:03:01Z send printed no visible status, so it was resent at 17:05:41Z: `validated 156 URL(s)`, `IndexNow HTTP 200 OK` |

Left open for the owner:

1. `HomeJsonLd` `DATE_MODIFIED` stays `2026-10-11`. The home page copy changed, so a bump is defensible, but the
   value is pinned on purpose and was not changed in this batch.
2. The frozen-post queue Q1–Q3 (§D) is applied on each post's read date, not before.
3. Two existing locale defects, not rendered on any page: `blog.post.aboutDescription` is mistranslated in `zh`, and
   the `ja` value has a stray space. Not touched here.
