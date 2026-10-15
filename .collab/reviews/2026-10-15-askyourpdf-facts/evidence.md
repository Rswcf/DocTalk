# Vendor pages re-read 2026-10-15

Every fact this batch writes was re-read today. Method: curl with a desktop User-Agent, HTML stripped to text
(scripts and styles dropped), quotes of 25 words or fewer; PDF.ai is client-rendered and was read in the built-in
browser. Nothing was signed up for or submitted. Source of record for AskYourPDF stays
`.collab/reviews/2026-10-14-notebooklm-askyourpdf/evidence.md`; for the other tools
`.collab/reviews/2026-10-10-step5-page-citations/vendor-evidence.md` §2.1, §2.9–2.11. Result: **no fact changed
since those reads.**

## AskYourPDF (all 10-14 quotes present on 10-15)

| Page | Found on 10-15 |
|---|---|
| https://askyourpdf.com/chat-with-pdf | "Drag a PDF, DOCX, EPUB, or TXT file into the AskYourPDF chat reader, or paste a URL."; upload box "PDF · DOCX · EPUB · TXT"; "citation back to the exact page"; "Web, iOS, Android, Chrome extension, ChatGPT GPT, and the Zotero plugin" |
| https://askyourpdf.com/pdf-ai | "Drag any PDF, DOCX, EPUB, PPTX, RTF, TXT, or CSV file into the upload box."; "Every answer includes a citation to the exact paragraph or page in your document."; "jump straight to the source"; "highlighted so you can verify" |
| https://askyourpdf.com/chat-with-documents | "Drag any PDF, DOCX, EPUB, PPTX, RTF, TXT, or CSV file into the chat."; upload box "PDF · DOCX · EPUB · PPTX · TXT · CSV · Up to 150 MB"; "links back to the exact paragraph" |
| https://askyourpdf.com/pricing (static HTML, yearly toggle) | Free "$0.00 / per month / billed yearly", "100 pages per document", "Max upload size: 15MB", "1 documents per day", "50 questions per day"; Premium "$11.99 / per month / billed yearly", "2500 pages per document"; Pro "$14.99 / per month / billed yearly", "6000 pages per document"; Enterprise "Custom" |
| pricing bundle `_app-f990c1fe2a703606.js` | `month:{free:"0.00",premium:"14.99",pro:"19.99",…},year:{free:"0.00",premium:"11.99",pro:"14.99",…}`; `pricing-fd625a403a4abb66.js` renders "billed yearly" or "billed monthly" by the toggle (same bundle names as 10-14) |
| https://askyourpdf.com/ | Title "AI Chatbot for Your Website & PDF AI Tools"; hero "The AI Chatbot for Your Website, Trained on Your Content" (homepage still leads with the website chatbot) |
| Chrome Web Store, PodcastAnywhere by AskYourPDF | "Turn your documents into podcasts you can actually listen to!"; "Created by the owner of the listed website"; 388 users |

No AskYourPDF page read contains "xlsx" or "Excel". The only "PPT, PPTX" outside the two document pages is on the
pricing page, for the website-chatbot product ("Your website plus any files you upload, including PDF, TXT, PPT,
PPTX, EPUB, and RTF").

Note for re-checks: `grep -F` on the stripped text missed "per month billed yearly", "1 documents per day" and
"2500 pages" because the page splits them across elements; the rows above come from reading the stripped text
(`sed -n`), not from the grep.

## Other tools (cells upgraded in this batch)

- **PDF.ai** (https://pdf.ai/faq, browser): "You can only upload PDF (.pdf) files at the moment."; "give you a
  well-informed answer (with cited sources)". https://pdf.ai/pricing (yearly view) Pro "$10 /mo Billed yearly",
  Hobby "Monthly upload limit" 1, "Monthly questions limit" 100 — unchanged.
- **Humata** (https://www.humata.ai/): heading "Highlights citations"; "Build trust with cited links into your source
  files."; "Each answer Humata generates will cite relevant sections from your uploaded documents." Pricing: "Basic
  features for up to 60 free pages of use." No format list on either page.
- **Gemini Notebook** (https://support.google.com/gemininotebook/answer/16179559?hl=en): "To get the full quoted
  text, hover over any citation."; "To navigate directly to the quote and review it in context, select a citation."
  Formats (answer/16215270): "Microsoft Word (docx), Text (txt), Markdown (md), PDF files (pdf), CSV (csv), and
  PowerPoint (pptx) files"; "ePub files".
- **ChatDOC** (https://chatdoc.com/guide/getting-started/verify-answers/how-to-verify-answers-in-chatdoc-traceable-citations-and-highlighted-jumps/):
  "Every AI - generated answer includes page numbers from the original document."; "Click the page number to jump
  directly to the relevant section in the document."
