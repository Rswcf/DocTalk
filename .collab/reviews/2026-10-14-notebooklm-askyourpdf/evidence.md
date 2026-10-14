# AskYourPDF vendor evidence, re-read 2026-10-14

Supersedes `.collab/reviews/2026-10-10-step5-page-citations/vendor-evidence.md` §2.6 where they differ. §2.6 read
only `/chat-with-pdf` and the static pricing HTML. Method as in vendor-evidence.md: verbatim quotes of 25 words or
fewer, vendor pages only, access date **2026-10-14**, read with curl (HTML stripped to text). The billing toggle was
also read in a browser by the Opus fact-check (`opus-r1-output.md`). Nothing was signed up for or submitted.

## Formats: the vendor's pages disagree

| Page | Quote | Formats |
|---|---|---|
| https://askyourpdf.com/chat-with-pdf | "Drag a PDF, DOCX, EPUB, or TXT file into the AskYourPDF chat reader, or paste a URL." | PDF, DOCX, EPUB, TXT, URL |
| https://askyourpdf.com/chat-with-pdf (upload box) | "PDF · DOCX · EPUB · TXT" | same |
| https://askyourpdf.com/pdf-ai | "Drag any PDF, DOCX, EPUB, PPTX, RTF, TXT, or CSV file into the upload box." | + PPTX, RTF, CSV |
| https://askyourpdf.com/chat-with-documents | "Drag any PDF, DOCX, EPUB, PPTX, RTF, TXT, or CSV file into the chat." | + PPTX, RTF, CSV |
| https://askyourpdf.com/chat-with-documents (upload box) | "PDF · DOCX · EPUB · PPTX · TXT · CSV · Up to 150 MB" | |

`/ai-pdf-reader`, `/ai-document-assistant` and `/free-pdf-ai` list the same seven formats as `/pdf-ai` (Opus r1).
No page of the seven read contains "xlsx" or "Excel".

## Citations

- `/chat-with-pdf`: "We return your answer with a citation back to the exact page in the original PDF. Click the citation to verify."
- `/pdf-ai`: "Every answer includes a citation to the exact paragraph or page in your document. Click the citation to jump straight to the source"
- `/pdf-ai`: "serves answers in seconds, with the source paragraph or page highlighted so you can verify the response yourself."
- `/chat-with-documents`: "Every reply links back to the exact paragraph in the document. Click the citation and you're there."

So §2.6's "page-level citation, click to verify" is right for `/chat-with-pdf`, and the claim "AskYourPDF does
not say it highlights the passage" (shipped 10-14 in two posts) is wrong: `/pdf-ai` says the source is highlighted.

## Apps

- `/chat-with-pdf`: "Chat with PDFs on every device you use Web, iOS, Android, Chrome extension, ChatGPT GPT, and the Zotero plugin."

## Prices (https://askyourpdf.com/pricing)

- Static HTML (yearly toggle on by default): "Annual Billing (25% OFF)"; Premium "$11.99 per month billed yearly";
  Pro "$14.99 per month billed yearly"; Enterprise "Custom".
- Free: "100 pages per document Max upload size: 15MB 1 documents per day"; "50 questions per day".
- Premium "2500 pages per document"; Pro "6000 pages per document".
- Monthly billing exists. The page bundle `_app-f990c1fe2a703606.js` holds
  `month:{free:"0.00",premium:"14.99",pro:"19.99",…},year:{free:"0.00",premium:"11.99",pro:"14.99",…}`, and
  `pricing-fd625a403a4abb66.js` renders "billed yearly" or "billed monthly" by the toggle. With the toggle off the
  rendered cards read Premium $14.99 and Pro $19.99 per month, billed monthly (Opus r1, browser).
  §2.6's "The monthly-billed price is not shown" is wrong as of 2026-10-14 (it held for the static HTML only).

## Audio (added after Codex r1)

- https://chromewebstore.google.com/detail/podcastanywhere-by-askyou/ebmciflehjbionjhpaeohnbicccdcgbj: "PodcastAnywhere by
  AskYourPDF - Turn your documents into podcasts you can actually listen to!"; "Created by the owner of the listed website";
  Version 1.0.1, "Updated March 18, 2025", 388 users.
- https://askyourpdf.com/blog/using-podanywhere-by-askyourpdf-chrome-extension (dated "Jan 10, 2025"): "This extension enables users to
  convert written content into audio conversations"; "Step 6:Convert to Podcast".
- The extension is not in the product list on `/chat-with-pdf` or `/about-us` (AI Agent, AI Form Filler, Chat with Docs,
  Summarise Docs, Chrome Extension, Zotero Plugin, GPT, iOS, Android). So: a separate extension, not a chat feature.

## API and history (added after Codex r1)

- https://docs.askyourpdf.com/askyourpdf-docs: "Introducing the AskYourPDF API"; the docs also hold "How to Install and Use
  AskYourPDF Plugin for ChatGPT". The pricing page still lists "Unlimited ChatGPT Plugin Question".
- No vendor page read says AskYourPDF *began* as a ChatGPT plugin, so the post no longer states that history.
