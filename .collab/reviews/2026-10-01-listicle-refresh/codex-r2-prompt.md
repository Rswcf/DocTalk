# Codex fact-check round 2 — refreshed listicles

Your round-1 findings are in .collab/reviews/2026-10-01-listicle-refresh/codex-r1-output.md. Do NOT run git. Re-read the three posts (frontend/content/blog/chatpdf-alternatives-2026.md, best-ai-pdf-tools-2026.md, best-ai-tools-academic-research-2026.md) plus frontend/content/blog/how-to-chat-with-docx-ai.md (one FAQ answer changed) against the research file .collab/reviews/2026-10-01-listicle-refresh/competitor-facts-2026-09-30.md and the product code. For each round-1 item 1-9 say FIXED / NOT FIXED with file:line. Then list any NEW real problem (unsupported claim, wrong number, disparaging statement, wrong DocTalk claim). Be brief. Final line: SHIP / SHIP-WITH-FIXES / REWORK.

Fix diff:
```diff
diff --git a/frontend/content/blog/best-ai-pdf-tools-2026.md b/frontend/content/blog/best-ai-pdf-tools-2026.md
index 4463c720..851d0100 100644
--- a/frontend/content/blog/best-ai-pdf-tools-2026.md
+++ b/frontend/content/blog/best-ai-pdf-tools-2026.md
@@ -2,7 +2,7 @@
 title: "7 Best AI PDF Tools in 2026: A Detailed Comparison"
 description: "The top AI PDF chat tools of 2026 compared on formats, citations and current pricing: DocTalk, ChatPDF, AskYourPDF, Gemini Notebook (formerly NotebookLM), Humata, PDF.ai and ChatDOC. Prices checked 30 September 2026."
 date: "2026-02-18"
-updated: "2026-10-07"
+updated: "2026-10-01"
 author: "DocTalk Team"
 category: "comparisons"
 tags: ["comparison", "ai tools", "pdf", "chatpdf", "notebooklm", "review"]
@@ -80,12 +80,12 @@ For a closer look, see [DocTalk vs ChatPDF](/compare/chatpdf).
 
 ### 3. [AskYourPDF](https://askyourpdf.com) — Best for Researchers
 
-**What it does:** document chat for academic workflows, with a Chrome extension, a Zotero integration and an API.
+**What it does:** document chat for academic workflows, with an API; it is also reported to offer a Chrome extension and a Zotero integration.
 
-**Why it stands out:** the Zotero integration lets researchers query their reference library directly, and paid plans allow very long documents.
+**Why it stands out:** paid plans allow very long documents, and third-party reviews describe a Zotero integration for querying a reference library.
 
 **Key features:**
-- Chrome extension and Zotero integration
+- Chrome extension and Zotero integration (per third-party reviews)
 - API for developers
 - Up to 2,500 pages per document on Premium and 6,000 on Pro
 
@@ -97,7 +97,7 @@ For a closer look, see [DocTalk vs ChatPDF](/compare/chatpdf).
 
 ### 4. [Gemini Notebook](https://notebook.google) (formerly NotebookLM) — Best Free Option
 
-**What it does:** Google's AI notebook. Add sources, then ask questions, get cited summaries and generate audio overviews. Google renamed NotebookLM to Gemini Notebook in 2026; the old address redirects.
+**What it does:** Google's AI notebook. Add sources, then ask questions, get cited summaries and generate audio overviews. NotebookLM is now called Gemini Notebook; the old address redirects.
 
 **Why it stands out:** a large free allowance and the widest range of source types in this list.
 
@@ -196,7 +196,7 @@ Checked 30 September 2026 on each vendor's own site unless noted.
 
 ## The Citation Quality Question
 
-There is a real difference between "see page 12", a link to the file, and a highlight on the exact sentence the answer used. With a page number you still scan the page; with a highlighted passage you read one sentence and decide. If you ask many questions about documents where accuracy matters — contracts, filings, papers — that difference adds up.
+There is a real difference between "see page 12", a link to the file, and a highlight on the exact passage the answer used. With a page number you still scan the page; with a highlighted passage you read a few lines and decide. If you ask many questions about documents where accuracy matters — contracts, filings, papers — that difference adds up.
 
 The strongest tools here each take a different route: DocTalk highlights the cited passage and checks quotes against the source, ChatPDF scrolls to the source in a side-by-side view, and ChatDOC links individual data points.
 
@@ -216,7 +216,7 @@ Things to watch:
 It depends on how you check answers. For verification against the exact passage across PDF, Word, PowerPoint and Excel, DocTalk. For a free notebook in Google, Gemini Notebook. For the simplest chat, ChatPDF.
 
 ### Is NotebookLM the same as Gemini Notebook?
-Yes. Google renamed NotebookLM to Gemini Notebook in 2026, and notebooklm.google redirects to notebook.google.
+Yes. NotebookLM is now called Gemini Notebook, and notebooklm.google redirects to notebook.google.
 
 ### Can I use these tools with confidential documents?
 Read each tool's privacy policy. DocTalk encrypts documents with AES-256 and does not use them for AI training; see our [trust page](/trust). For highly sensitive files, check where each vendor stores data and for how long.
@@ -225,7 +225,7 @@ Read each tool's privacy policy. DocTalk encrypts documents with AES-256 and doe
 No. All of them rely on cloud AI models to answer questions.
 
 ### Can I chat with multiple PDFs at once?
-ChatPDF, AskYourPDF, Gemini Notebook, Humata and ChatDOC support multi-document chat in some form. DocTalk answers within one document per chat session and uses collections to organise several documents.
+ChatPDF, AskYourPDF, Gemini Notebook, Humata and ChatDOC support multi-document chat in some form. DocTalk supports single-document chats and collection workspaces for questions across several documents; Quote Finder works within one document.
 
 ### Which tool has the best free tier?
 Gemini Notebook has the largest free allowance. Among dedicated document tools, compare what you need most: DocTalk gives 500 starter credits and then 300 a month, ChatPDF two documents a day, and ChatDOC five files a day.
diff --git a/frontend/content/blog/best-ai-tools-academic-research-2026.md b/frontend/content/blog/best-ai-tools-academic-research-2026.md
index 420ce632..3ee64586 100644
--- a/frontend/content/blog/best-ai-tools-academic-research-2026.md
+++ b/frontend/content/blog/best-ai-tools-academic-research-2026.md
@@ -2,7 +2,7 @@
 title: "Best AI Tools for Academic Research in 2026: A Researcher's Guide"
 description: "The best AI tools for academic research in 2026 — document analysis, literature search, systematic reviews and reference management — with honest pros and cons and prices checked 30 September 2026. Includes Gemini Notebook (formerly NotebookLM), Consensus, Elicit and DocTalk."
 date: "2026-03-18"
-updated: "2026-10-07"
+updated: "2026-10-01"
 author: "DocTalk Team"
 category: "comparisons"
 tags: ["academic research", "ai tools", "students", "researchers", "literature review", "comparison"]
@@ -14,14 +14,14 @@ keywords: ["ai tools for academic research", "best ai research tools 2026", "ai
 **Short answer:** to find papers, use Semantic Scholar (free) and Consensus. To run a systematic review, use Elicit. To read and question the papers you have, with every answer and quote traceable to the page, use [DocTalk](/). For a free notebook across many sources, use Gemini Notebook (formerly NotebookLM). Zotero keeps the references together.
 
 > **Updated October 2026 — what changed since March:**
-> - Google renamed **NotebookLM to Gemini Notebook**; it now accepts Word and PowerPoint files and allows 50 sources per notebook on the free plan.
+> - **NotebookLM is now Gemini Notebook**; it now accepts Word and PowerPoint files and allows 50 sources per notebook on the free plan.
 > - **Consensus**, **Elicit** and **Connected Papers** changed their pricing; the figures below are current.
 > - **DocTalk** added Quote Finder: quotes checked against the paper by machine, with the page they come from, ready to paste with an APA in-text citation.
-> - ChatGPT plugins were retired in 2024, so the ScholarAI entry now describes how ScholarAI is offered today.
+> - ChatGPT plugins were retired in 2024; we did not re-verify ScholarAI's current access model or pricing, and say so below.
 
 If you are a researcher in 2026, you are surrounded by AI tools promising to make your work faster. The problem is not a lack of options — it is figuring out which tools actually help and which ones create more problems than they solve.
 
-This guide cuts through the noise. We have organized the best AI research tools by what they actually do, given honest assessments of their strengths and limitations, and explained when each tool is worth your time. Prices and limits come from each vendor's own pricing page, read on 30 September 2026. No tool does everything well, so we will also explain how to combine them into a practical workflow.
+This guide cuts through the noise. We have organized the best AI research tools by what they actually do, given honest assessments of their strengths and limitations, and explained when each tool is worth your time. Prices and limits for DocTalk, Gemini Notebook, Claude, Consensus, Elicit and Connected Papers come from each vendor's own pages, read on 30 September 2026. Feature descriptions for the discovery and reference tools come from our March 2026 review and were not re-tested in this update. No tool does everything well, so we will also explain how to combine them into a practical workflow.
 
 ## How We Categorize Research AI Tools
 
@@ -42,7 +42,7 @@ These tools let you upload specific papers or documents and interrogate their co
 
 [DocTalk](/) is an AI document Q&A platform that lets you upload papers in seven formats — PDF, DOCX, PPTX, XLSX, TXT, Markdown, and web URLs — and ask questions that get cited answers.
 
-**Why researchers care:** The [citation highlighting](/features/citations) feature is particularly valuable for academic work. When DocTalk cites a passage, you click the citation number and the app scrolls to the exact sentence in the original paper and highlights it. This makes it fast to verify claims — essential when you are building arguments that depend on accurate interpretation of source material.
+**Why researchers care:** The [citation highlighting](/features/citations) feature is particularly valuable for academic work. When DocTalk cites a passage, you click the citation number and the app scrolls to the exact passage in the original paper and highlights it. This makes it fast to verify claims — essential when you are building arguments that depend on accurate interpretation of source material.
 
 **Quote Finder** is built for the step where most AI tools let researchers down: quoting. Give it a topic and it returns quotes taken from the paper and checked against the source text by machine before they are shown, with the page they come from. Copy one with its APA in-text citation, or save it to the document's evidence board.
 
@@ -72,7 +72,7 @@ If you are a student deciding whether DocTalk fits your workflow, see our [stude
 
 ### Gemini Notebook (formerly NotebookLM) — Best Free Research Notebook
 
-[Gemini Notebook](https://notebook.google) is Google's AI notebook, renamed from NotebookLM in 2026 (the old address redirects). Add sources — PDFs, Word and PowerPoint files, Google Docs, Slides and Sheets, web links, YouTube videos, audio — and it creates a notebook where you can ask questions and generate summaries.
+[Gemini Notebook](https://notebook.google) is Google's AI notebook, formerly NotebookLM (the old address redirects). Add sources — PDFs, Word and PowerPoint files, Google Docs, Slides and Sheets, web links, YouTube videos, audio — and it creates a notebook where you can ask questions and generate summaries.
 
 **Why researchers care:** It is free, which matters for students and early-career researchers. The notebook metaphor — organizing multiple sources into themed notebooks — maps well to how many researchers think about their projects.
 
@@ -122,22 +122,20 @@ These tools help you find relevant papers and understand the research landscape.
 
 ### Consensus — Best for Evidence-Based Answers
 
-[Consensus](https://consensus.app) is an AI search engine over more than 220 million peer-reviewed papers. Ask a question, and it returns answers synthesized from published research, with a "consensus meter" showing how studies line up on a claim.
+[Consensus](https://consensus.app) is an AI search engine over more than 220 million peer-reviewed papers. Ask a question, and it returns answers synthesized from published research, with links to the papers behind them.
 
-**Why researchers care:** The consensus meter is genuinely useful for literature reviews. Instead of reading 30 papers to determine whether the evidence supports a hypothesis, Consensus gives you a quantitative summary. Each claim links to the original paper via DOI.
+**Why researchers care:** for a literature review, Consensus gives a first view of what published studies say about a question, with links to each paper, before you read them yourself.
 
 **Strengths:**
 - Searches 220M+ peer-reviewed papers
-- Consensus meter summarises agreement across studies
 - "Deep review" reports that synthesise many papers
 - Links to every cited source
 - Up to 40% off for students, faculty and clinicians
 
 **Limitations:**
 - Cannot analyze your own uploaded documents
-- Skewed toward biomedical and social science literature (weaker in humanities, engineering)
 - Free plan: 10 Pro messages and up to 3 Deep reviews a month
-- Sometimes surfaces low-quality or irrelevant studies in results
+- Answers summarise papers; read the cited studies before relying on them
 
 **Pricing:** Free (limits above), Pro ($20/month, or $144/year), Deep ($65/month, or $540/year).
 
@@ -157,11 +155,9 @@ These tools help you find relevant papers and understand the research landscape.
 - Transparent methodology — shows why each paper was included/excluded
 
 **Limitations:**
-- Learning curve is steeper than simpler tools
-- Best suited for health sciences and social sciences
-- Free tier limits the number of papers you can process
-- Not useful for general-purpose document Q&A
-- Data extraction accuracy varies with paper complexity
+- Research-agent use is limited on the free plan
+- Built for systematic reviews, not general-purpose document Q&A
+- Check extracted data against the papers, as with any AI extraction
 
 **Pricing:** Free (unlimited search across 138M+ papers and unlimited summaries, with limited research-agent use), Pro ($49 per user per month, or $588/year), Scale ($169 per user per month), Enterprise (custom).
 
@@ -205,10 +201,8 @@ These tools help you find relevant papers and understand the research landscape.
 - Completely free
 
 **Limitations:**
-- Coverage gaps in some humanities and non-English publications
-- TLDR summaries are occasionally inaccurate for complex papers
 - No document upload or analysis
-- Search ranking can surface irrelevant results for ambiguous queries
+- AI summaries are a starting point; read the paper before citing it
 
 **Pricing:** Free.
 
@@ -220,7 +214,7 @@ These tools help you find relevant papers and understand the research landscape.
 
 [Zotero](https://www.zotero.org/) is the most widely used free reference manager in academia. By itself, it is not an AI tool — but a growing ecosystem of AI plugins extends it with summarization, Q&A, and automated tagging.
 
-The most notable plugin is **Zotero GPT / ZotBot**, which lets you ask questions about papers in your Zotero library using LLMs. AskYourPDF also offers a Zotero integration that indexes your library for AI search.
+The most notable plugin is **Zotero GPT / ZotBot**, which lets you ask questions about papers in your Zotero library using LLMs. AskYourPDF is also reported to offer a Zotero integration.
 
 **Strengths:**
 - Free and open source (core application)
@@ -239,22 +233,11 @@ The most notable plugin is **Zotero GPT / ZotBot**, which lets you ask questions
 
 **Best for:** Researchers who already use Zotero and want to add AI capabilities to their existing workflow.
 
-### ScholarAI — Research Search Inside ChatGPT
+### ScholarAI — Paper Search from the ChatGPT Era
 
-[ScholarAI](https://scholarai.io/) started as a ChatGPT plugin that searched and summarised academic papers. OpenAI retired plugins in 2024, and ScholarAI now offers its research search as a GPT inside ChatGPT and on its own site; check scholarai.io for its current plans.
+[ScholarAI](https://scholarai.io/) became known as a ChatGPT plugin for searching and summarising academic papers. ChatGPT plugins were retired in 2024, and we did not verify ScholarAI's current access model or pricing in this update — check scholarai.io before relying on it.
 
-**Strengths:**
-- Searches and summarises papers in one step
-- Familiar if you already work in ChatGPT
-- Focus on open-access literature
-
-**Limitations:**
-- Limited to papers ScholarAI can access (mostly open access)
-- Answers depend on the underlying chat model's reading of the paper
-
-**Pricing:** See scholarai.io; we could not confirm current prices.
-
-**Best for:** ChatGPT users who want paper search without switching tools.
+**Best for:** researchers who want to try paper search that grew out of ChatGPT; confirm the current offer first.
 
 ## Building a Research Workflow: Combining Tools
 
@@ -320,7 +303,7 @@ For questioning a paper and checking every answer against the page it came from,
 DocTalk's Quote Finder returns quotes taken from the paper and checked against the source text before they are shown, with the page they come from, and copies them with an APA in-text citation.
 
 ### What happened to NotebookLM?
-Google renamed it Gemini Notebook in 2026. It is still free, and notebooklm.google now redirects to notebook.google.
+It is now called Gemini Notebook. It is still free, and notebooklm.google redirects to notebook.google.
 
 ### Which AI tool is best for a systematic review?
 Elicit is built for screening and data extraction across many papers. Pair it with a document tool for reading the included papers closely.
diff --git a/frontend/content/blog/chatpdf-alternatives-2026.md b/frontend/content/blog/chatpdf-alternatives-2026.md
index 13c177d3..e143bd63 100644
--- a/frontend/content/blog/chatpdf-alternatives-2026.md
+++ b/frontend/content/blog/chatpdf-alternatives-2026.md
@@ -2,7 +2,7 @@
 title: "7 Best ChatPDF Alternatives in 2026 (Free and Paid)"
 description: "ChatPDF alternatives compared on formats, citations and current pricing: DocTalk, AskYourPDF, PDF.ai, Humata, Gemini Notebook (formerly NotebookLM), Consensus and Claude. Prices checked 30 September 2026."
 date: "2026-03-18"
-updated: "2026-10-07"
+updated: "2026-10-01"
 author: "DocTalk Team"
 category: "comparisons"
 tags: ["chatpdf", "comparison", "alternatives", "ai tools", "pdf", "document chat"]
@@ -15,7 +15,7 @@ keywords: ["chatpdf alternative", "chatpdf alternatives 2026", "best chatpdf alt
 
 > **Updated October 2026 — what changed since March:**
 > - ChatPDF now reads Word, PowerPoint, Markdown and text files as well as PDFs, and its citations scroll to the source passage. Two of the reasons people left it in 2025 no longer apply.
-> - Google renamed NotebookLM to **Gemini Notebook**; the old address now redirects to notebook.google. It also accepts Word and PowerPoint files now.
+> - NotebookLM is now **Gemini Notebook**; the old address redirects to notebook.google. It also accepts Word and PowerPoint files now.
 > - PDF.ai's free plan is now one upload a month; paid plans start at $10/month billed yearly.
 > - Humata's Team plan is $49 per user per month, and the $1.99 student plan no longer appears on its pricing page.
 > - AskYourPDF and Consensus changed their plans; the figures below are current.
@@ -26,7 +26,7 @@ ChatPDF introduced millions of people to a simple idea in 2023: upload a PDF, as
 
 ## Why People Look for ChatPDF Alternatives
 
-**Verification at passage level.** ChatPDF's citations now jump to the source, which covers most everyday checking. Some work — legal review, compliance, a thesis — needs more: the exact sentence highlighted, or a quote you can paste with its page number, knowing it matches the source. That is where specialised tools differ most.
+**Verification at passage level.** ChatPDF's citations now jump to the source, which covers most everyday checking. Some work — legal review, compliance, a thesis — needs more: the exact passage highlighted, or a quote you can paste with its page number, knowing it matches the source. That is where specialised tools differ most.
 
 **Spreadsheets and web pages alongside documents.** ChatPDF reads PDF, DOC/DOCX, PPT/PPTX, Markdown and text files. If your work also involves Excel files or web pages you want to question in the same place, you need a tool that handles those too.
 
@@ -64,13 +64,13 @@ If you only need quick answers from a few files a day, ChatPDF may still be the
 
 ### 2. AskYourPDF — Best for Research Integration
 
-[AskYourPDF](https://askyourpdf.com) began as a ChatGPT plugin and is now a standalone app with a Chrome extension, a Zotero integration and a developer API.
+[AskYourPDF](https://askyourpdf.com) began as a ChatGPT plugin and is now a standalone app and API; it is also reported to offer a Chrome extension and a Zotero integration.
 
-**What sets it apart:** researchers who keep their library in Zotero can query papers from it directly.
+**What sets it apart:** very large page allowances on paid plans and, per third-party reviews, a Zotero integration for researchers.
 
 **Pros:**
-- Zotero integration for academic workflows
-- Chrome extension and API
+- Zotero integration and Chrome extension (per third-party reviews)
+- Developer API
 - Very large page allowances on paid plans (2,500 pages per document on Premium, 6,000 on Pro)
 
 **Cons:**
@@ -122,7 +122,7 @@ If you only need quick answers from a few files a day, ChatPDF may still be the
 
 ### 5. Gemini Notebook (formerly NotebookLM) — Best Free Research Notebook
 
-[Gemini Notebook](https://notebook.google) is Google's AI notebook, renamed from NotebookLM in 2026. You add sources to a notebook, then ask questions, get summaries with inline citations, and generate audio overviews.
+[Gemini Notebook](https://notebook.google) is Google's AI notebook, formerly NotebookLM. You add sources to a notebook, then ask questions, get summaries with inline citations, and generate audio overviews.
 
 **What sets it apart:** a generous free tier and a very wide range of source types, inside the Google account you may already use.
 
@@ -216,7 +216,7 @@ For a wider comparison, see our [2026 guide to AI PDF tools](/blog/best-ai-pdf-t
 For a free research notebook, Gemini Notebook (formerly NotebookLM) has the largest free allowance: 100 notebooks with 50 sources each. For verifying answers against the exact page across PDF, Word, PowerPoint and Excel, DocTalk's free plan gives 500 starter credits and then 300 credits a month, with a no-signup [demo](/demo).
 
 ### Is NotebookLM still available?
-Yes, under a new name. Google renamed it Gemini Notebook in 2026, and notebooklm.google now redirects to notebook.google.
+Yes, under a new name: it is now Gemini Notebook, and notebooklm.google redirects to notebook.google.
 
 ### Does ChatPDF support Word files now?
 Yes. As of September 2026, ChatPDF reads PDF, DOC/DOCX, PPT/PPTX, Markdown and text files, and it can also chat with a website or YouTube video.
diff --git a/frontend/content/blog/how-to-chat-with-docx-ai.md b/frontend/content/blog/how-to-chat-with-docx-ai.md
index b6d7a9cb..2ae338bb 100644
--- a/frontend/content/blog/how-to-chat-with-docx-ai.md
+++ b/frontend/content/blog/how-to-chat-with-docx-ai.md
@@ -141,7 +141,7 @@ No. DocTalk processes the final version of the document text. If your Word file
 
 ### Can I chat with a DOCX and a PDF in the same session?
 
-DocTalk currently supports one document per chat session. You can upload both files separately and create individual sessions for each, then compare the answers manually. Multi-document chat within a single session is on the roadmap.
+Yes, with a collection. Add the DOCX and the PDF to the same collection and ask questions across both; each answer cites the file and passage it came from. You can also open each file in its own chat.
 
 ### How does DOCX processing speed compare to PDF?
 
```
