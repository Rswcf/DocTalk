VERDICT: SHIP-WITH-FIXES

1. EN + all 11 locales: `compareNotebooklm.faq.a5`, `compareNotebooklm.feature.securityP2`, `altsNotebooklm.faq1Answer`.
Problem: new copy adds DocTalk security/privacy claims not supported by the allowed DocTalk facts: AES-256, GDPR export, never trains AI, encryption as a NotebookLM alternative reason.
Evidence: `CLAUDE.md` supports formats, citations, 11 locales, modes; `.claude/rules/frontend.md` supports Free/Plus/Pro and Flash/Pro. No allowed DocTalk source supports these security claims.
Replacement EN:
`compareNotebooklm.faq.a5`: `Gemini Notebook (formerly NotebookLM) is a Google product, so Google's privacy policy applies; we did not review its data-handling terms for this page.`
`compareNotebooklm.feature.securityP2`: `DocTalk is not part of Gemini Notebook. We did not compare DocTalk and Gemini Notebook privacy terms on this page.`
`altsNotebooklm.faq1Answer`: `Common reasons include: needing Excel (XLSX) support, which is not on Google's list of sources, wanting citations highlighted in the original document, or preferring a tool outside Gemini Notebook.`

2. EN + all 11 locales: `compareChatpdf.faq.a4`, `compareNotebooklm.feature.languagesP2Pre`, `altsChatpdf.alt1Desc1`, `compareNotebooklm.feature.formatSupportP2Pre`, `compareHumata.documentFormatDocTalk`, `altsHumata.alt1Desc2`.
Problem: DocTalk overclaims: “any language”, “every interface element”, parser preservation, spreadsheet cell relationships, speaker notes, clean article extraction.
Evidence: `CLAUDE.md` says DocTalk uploads `PDF / DOCX / PPTX / XLSX / TXT / MD / URL` and has `11 locales`. It does not support the stronger parser/language claims.
Replacement EN:
`compareChatpdf.faq.a4`: `DocTalk's interface is available in 11 languages (English, Chinese, Spanish, Japanese, German, French, Korean, Portuguese, Italian, Arabic, and Hindi). We did not verify which interface languages ChatPDF offers.`
`compareNotebooklm.feature.languagesP2Pre`: `DocTalk's interface is available in 11 languages: English, Chinese, Spanish, Japanese, German, French, Korean, Portuguese, Italian, Arabic, and Hindi. See `
`altsChatpdf.alt1Desc1`: `DocTalk is our pick for users who want highlighted citations and Excel support. ChatPDF reads PDF, Word, PowerPoint, Markdown and text files; DocTalk reads seven formats: PDF, DOCX, PPTX, XLSX, TXT, Markdown, and web URLs.`
`compareNotebooklm.feature.formatSupportP2Pre`: `DocTalk accepts PDF, DOCX, PPTX, XLSX, TXT, Markdown, and web URLs. Gemini Notebook accepts more source types overall; DocTalk does not support YouTube, audio or Google Docs. See `
`compareHumata.documentFormatDocTalk`: `DocTalk supports seven formats: PDF, DOCX, PPTX, XLSX, TXT, Markdown, and web URLs. DocTalk does not support video or audio files. See`
`altsHumata.alt1Desc2`: `DocTalk supports seven document formats (PDF, DOCX, PPTX, XLSX, TXT, Markdown, web URLs); Humata's site does not list its supported file types. The interface supports 11 languages. Two visible chat modes are Flash and Pro.`

3. EN + all 11 locales: `altsAskyourpdf.alt1Desc2`.
Problem: says DocTalk has no browser extension, Zotero plugin or public API. The evidence proves AskYourPDF has these integrations, not that DocTalk lacks them.
Evidence: VE §2.6 says AskYourPDF has “Web, iOS, Android, Chrome extension, ChatGPT GPT, and the Zotero plugin” plus API docs.
Replacement EN: `DocTalk also supports 11 interface languages, offers a free demo with no signup required, and provides two visible chat modes (Flash and Pro). AskYourPDF remains stronger on integrations: its site lists a Chrome extension, Zotero plugin, mobile apps, ChatGPT GPT and API.`

4. EN + all 11 locales: `altsNotebooklm.alt2Desc1`.
Problem: “a free account adds multi-document chats and saved history” is unsupported for ChatPDF.
Evidence: VE §2.7 supports no-account use, 2 documents/day, citations scroll to source, and unpublished Plus price. It does not support free-account saved history or multi-document chats.
Replacement EN: `ChatPDF is a straightforward NotebookLM alternative: you can start without an account, upload a document and ask questions, and its citations scroll to the source. It is built around individual documents rather than notebooks.`

5. EN + all 11 locales: `altsHumata.alt5Desc1`.
Problem: “most focused option” is an unsupported superlative.
Evidence: VE §2.11 supports PDF.ai as PDF-only and a separate parsing API, not “most” focused.
Replacement EN: `PDF.ai is focused on PDF chat: its FAQ says you can only upload PDF files at the moment. It also sells a separate document-parsing API for developers. This focus may suit users who find Humata and broader alternatives too feature-rich.`

6. EN + all 11 locales: `altsNotebooklm.heroDescription`, `altsNotebooklm.metaDescription`, `altsChatpdf.alt4Desc2`, `altsHumata.alt4Desc2`.
Problem: “Google lock-in” / “vendor independence” is harsher than the evidence. The evidence supports “Google account required” and “Google product”.
Evidence: VE §2.9 confirms Gemini Notebook rename, Google account requirement, source limits, no page numbers; it does not say lock-in.
Replacement EN:
`altsNotebooklm.metaDescription`: `Six NotebookLM (now Gemini Notebook) alternatives for document analysis in 2026, compared on citations, file formats, Google account requirements and pricing.`
For body copy, replace “Google lock-in/vendor independence” with “Google account requirement” or “non-Google workflow” in the same locales.

