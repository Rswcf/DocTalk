# Codex r2: AskYourPDF facts batch (2026-10-15) — fixes for your r1 findings

You reviewed commit 61b07d95 in r1 (prompt: `.collab/reviews/2026-10-15-askyourpdf-facts/codex-r1-prompt.md`,
your output: `codex-r1-output.md` in the same folder) and returned SHIP-WITH-FIXES with three findings.
The diff below is the working tree against 61b07d95 (you cannot run git; the files are on disk in this worktree).

What was done for each finding:
1. SHOULD zh: "段落或页码" → "段落或页面" in all ten AskYourPDF strings that had it (vendor wording is
   "the exact paragraph or page"). ChatDOC/Gemini "page numbers" references in other locales were checked and are correct.
2. SHOULD `frontend/content/blog/chat-with-excel-spreadsheet-ai.md`: AskYourPDF removed from the error-message
   prediction; added your sentence; `updated` = 2026-10-15. The ChatPDF / PDF.ai prediction is unchanged (not this batch's
   scope; PDF.ai's FAQ says PDF only).
3. NIT verdict joins (TSX renders `verdictParagraph3 + ' ' + <link tryDocTalkLink> + ' ' + verdictParagraph3Mid + ' ' +
   <link chatpdfComparisonLink> + ' ' + verdictParagraph3End`):
   - pt and hi: "To compare, …" lead-in.
   - ja: Mid starts with "ことです。".
   - ko: "직접 비교해 보려면 [DocTalk를 무료로 사용해 보세요] (인용 강조 기능이 … 확인할 수 있습니다). 관심이 있다면 다음 비교도
     참고해 보세요: [DocTalk 대 ChatPDF] 비교." A period cannot follow the link because the markup inserts a space, so the
     highlighting clause is a parenthetical; the old second half ("또한 관심이 있을 만한 … 비교.") was a verbless fragment
     and is now a sentence. `tryDocTalkLink` and `verdictParagraph3End` are unchanged.

Checks after the fixes: `npm run test:unit` 363/363; `npm run build` 426/426; built-HTML phrase check PASS (adds the Excel
post: new sentence present, "ChatPDF, AskYourPDF, or PDF.ai" absent, dateModified 2026-10-15); built zh/ja/ko/pt/hi
`/compare/askyourpdf` pages show the new strings and none of the old.

Review only this diff and whether it closes your r1 findings without new errors (grammar of the rewritten joins, any zh
string still saying 页码 for AskYourPDF, the Excel sentence's accuracy against
`.collab/reviews/2026-10-14-notebooklm-askyourpdf/evidence.md`). End with exactly one verdict line:
`VERDICT: SHIP`, `VERDICT: SHIP-WITH-FIXES` (list them, MUST/SHOULD/NIT), or `VERDICT: BLOCK`.

## Diff (working tree vs 61b07d95)

```diff
diff --git a/frontend/content/blog/chat-with-excel-spreadsheet-ai.md b/frontend/content/blog/chat-with-excel-spreadsheet-ai.md
index 8b7d28f0..5084ed42 100644
--- a/frontend/content/blog/chat-with-excel-spreadsheet-ai.md
+++ b/frontend/content/blog/chat-with-excel-spreadsheet-ai.md
@@ -2,7 +2,7 @@
 title: "How to Analyze Excel Spreadsheets with AI: A Complete Guide"
 description: "Learn how to chat with Excel (XLSX) files using AI. Most AI document tools skip spreadsheets entirely. See how DocTalk extracts table data for cited, verifiable answers."
 date: "2026-03-18"
-updated: "2026-10-12"
+updated: "2026-10-15"
 author: "DocTalk Team"
 category: "guides"
 tags: ["excel", "xlsx", "spreadsheet", "ai chat", "tutorial", "multi-format", "data analysis"]
@@ -11,7 +11,7 @@ imageAlt: "An Excel spreadsheet being analyzed by AI with citations pointing to
 keywords: ["analyze excel with ai", "ai spreadsheet analysis", "chat with excel ai", "xlsx ai tool", "ask ai about spreadsheet", "ai excel reader", "excel chatbot"]
 ---
 
-Here is a gap that most AI document tools quietly ignore: spreadsheets. You can find dozens of products that let you chat with a PDF. A handful support Word documents. But try uploading an Excel file to ChatPDF, AskYourPDF, or PDF.ai, and you will get an error message or a suggestion to convert to PDF first.
+Here is a gap that most AI document tools quietly ignore: spreadsheets. You can find dozens of products that let you chat with a PDF. A handful support Word documents. But try uploading an Excel file to ChatPDF or PDF.ai, and you will get an error message or a suggestion to convert to PDF first. AskYourPDF's published format lists include CSV but do not list Excel (.xlsx) files.
 
 That conversion destroys the very thing that makes spreadsheets useful — structured tabular data with rows, columns, and relationships between cells. A financial model converted to PDF is just a static image of numbers. You lose the ability to ask structured questions about the data.
 
diff --git a/frontend/src/i18n/locales/hi.json b/frontend/src/i18n/locales/hi.json
index afcb391b..b15186af 100644
--- a/frontend/src/i18n/locales/hi.json
+++ b/frontend/src/i18n/locales/hi.json
@@ -2106,7 +2106,7 @@
   "compareAskyourpdf.verdictTitle": "निर्णय",
   "compareAskyourpdf.verdictParagraph1": "AskYourPDF ने एकीकरणों का एक व्यापक इकोसिस्टम बनाया है, जो इसे उन शोधकर्ताओं और डेवलपर्स के लिए शक्तिशाली बनाता है जो अपने कार्यप्रवाहों में दस्तावेज़ AI को एम्बेड करना चाहते हैं: एक Chrome एक्सटेंशन, एक Zotero प्लगइन, मोबाइल ऐप, एक ChatGPT GPT और एक API।",
   "compareAskyourpdf.verdictParagraph2": "DocTalk एक अलग दृष्टिकोण अपनाता है: एक वेब ऐप जो PDF, Word और PowerPoint के साथ-साथ Excel फ़ाइलें भी पढ़ता है, और आपके दस्तावेज़ में उद्धृत अंश को हाइलाइट करता है। यदि आपकी प्राथमिकता स्प्रेडशीट सहित मिश्रित दस्तावेज़ प्रारूपों से पता लगाने योग्य उत्तर प्राप्त करना है, तो DocTalk बेहतर विकल्प है।",
-  "compareAskyourpdf.verdictParagraph3": "यदि आपको Zotero, Chrome या अपने कोड के साथ एकीकरण चाहिए, तो AskYourPDF का मूल्यांकन करें। यदि आपको Excel समर्थन चाहिए, तो DocTalk बेहतर है। तुलना करने का सबसे अच्छा तरीका है",
+  "compareAskyourpdf.verdictParagraph3": "यदि आपको Zotero, Chrome या अपने कोड के साथ एकीकरण चाहिए, तो AskYourPDF का मूल्यांकन करें। यदि आपको Excel समर्थन चाहिए, तो DocTalk बेहतर है। तुलना करने के लिए,",
   "compareAskyourpdf.tryDocTalkLink": "मुफ्त में DocTalk आज़माएं",
   "compareAskyourpdf.verdictParagraph3Mid": "और उद्धरण हाइलाइटिंग को कार्रवाई में देखें। आपको हमारी इसमें भी रुचि हो सकती है",
   "compareAskyourpdf.chatpdfComparisonLink": "DocTalk बनाम ChatPDF",
diff --git a/frontend/src/i18n/locales/ja.json b/frontend/src/i18n/locales/ja.json
index b9f7e382..c923485e 100644
--- a/frontend/src/i18n/locales/ja.json
+++ b/frontend/src/i18n/locales/ja.json
@@ -2108,7 +2108,7 @@
   "compareAskyourpdf.verdictParagraph2": "DocTalkは異なるアプローチを採用しています。1つのWebアプリで、PDF、Word、PowerPointに加えてExcelファイルも読み込め、文書内の引用箇所をハイライト表示します。スプレッドシートを含むさまざまな形式の文書から追跡可能な回答を得ることを優先するなら、DocTalkの方が適しています。",
   "compareAskyourpdf.verdictParagraph3": "Zotero、Chrome、または独自のコードとの統合が必要なら、AskYourPDFを検討してください。Excelのサポートが必要なら、DocTalkの方が適しています。比較する最良の方法は、",
   "compareAskyourpdf.tryDocTalkLink": "DocTalkを無料で試す",
-  "compareAskyourpdf.verdictParagraph3Mid": "実際の引用ハイライトをご覧ください。また、以下の比較記事もご関心があるかもしれません。",
+  "compareAskyourpdf.verdictParagraph3Mid": "ことです。実際の引用ハイライトをご覧ください。また、以下の比較記事もご関心があるかもしれません。",
   "compareAskyourpdf.chatpdfComparisonLink": "DocTalk 対 ChatPDF",
   "compareAskyourpdf.verdictParagraph3End": "の比較。",
   "compareAskyourpdf.faqTitle": "よくある質問",
diff --git a/frontend/src/i18n/locales/ko.json b/frontend/src/i18n/locales/ko.json
index 8f116806..e32ef1e1 100644
--- a/frontend/src/i18n/locales/ko.json
+++ b/frontend/src/i18n/locales/ko.json
@@ -2106,9 +2106,9 @@
   "compareAskyourpdf.verdictTitle": "평결",
   "compareAskyourpdf.verdictParagraph1": "AskYourPDF는 Chrome 확장 프로그램, Zotero 플러그인, 모바일 앱, ChatGPT GPT, API 등 폭넓은 통합 생태계를 구축해, 문서 AI를 워크플로우에 포함하려는 연구자와 개발자에게 강력한 도구가 되었습니다.",
   "compareAskyourpdf.verdictParagraph2": "DocTalk는 다른 접근 방식을 취합니다. 하나의 웹 앱에서 PDF, Word, PowerPoint뿐 아니라 Excel 파일도 읽으며, 문서에서 인용된 구절을 강조 표시합니다. 스프레드시트를 포함해 다양한 형식의 문서에서 추적 가능한 답변을 얻는 것이 우선이라면 DocTalk가 더 적합합니다.",
-  "compareAskyourpdf.verdictParagraph3": "Zotero, Chrome 또는 자체 코드와의 통합이 필요하다면 AskYourPDF를 검토해 보세요. Excel 지원이 필요하다면 DocTalk가 더 적합합니다. 비교하는 가장 좋은 방법은",
+  "compareAskyourpdf.verdictParagraph3": "Zotero, Chrome 또는 자체 코드와의 통합이 필요하다면 AskYourPDF를 검토해 보세요. Excel 지원이 필요하다면 DocTalk가 더 적합합니다. 직접 비교해 보려면",
   "compareAskyourpdf.tryDocTalkLink": "DocTalk를 무료로 사용해 보세요",
-  "compareAskyourpdf.verdictParagraph3Mid": "인용 강조 기능이 실제로 작동하는 모습을 확인하세요. 또한 관심이 있을 만한",
+  "compareAskyourpdf.verdictParagraph3Mid": "(인용 강조 기능이 실제로 작동하는 모습을 확인할 수 있습니다). 관심이 있다면 다음 비교도 참고해 보세요:",
   "compareAskyourpdf.chatpdfComparisonLink": "DocTalk 대 ChatPDF",
   "compareAskyourpdf.verdictParagraph3End": "비교.",
   "compareAskyourpdf.faqTitle": "자주 묻는 질문",
diff --git a/frontend/src/i18n/locales/pt.json b/frontend/src/i18n/locales/pt.json
index cc891d4a..f1b18f90 100644
--- a/frontend/src/i18n/locales/pt.json
+++ b/frontend/src/i18n/locales/pt.json
@@ -579,7 +579,7 @@
   "compareAskyourpdf.tryDocTalkLink": "experimente o DocTalk gratuitamente",
   "compareAskyourpdf.verdictParagraph1": "O AskYourPDF construiu um amplo ecossistema de integrações que o torna poderoso para pesquisadores e desenvolvedores que desejam incorporar IA documental em seus fluxos de trabalho: uma extensão do Chrome, um plugin do Zotero, aplicativos móveis, um ChatGPT GPT e uma API.",
   "compareAskyourpdf.verdictParagraph2": "O DocTalk adota uma abordagem diferente: um único aplicativo web que lê arquivos do Excel, além de PDF, Word e PowerPoint, e destaca o trecho citado no seu documento. Se a sua prioridade é obter respostas rastreáveis a partir de formatos de documento variados, incluindo planilhas, o DocTalk é o mais indicado.",
-  "compareAskyourpdf.verdictParagraph3": "Se você precisa de integrações com o Zotero, o Chrome ou o seu próprio código, avalie o AskYourPDF. Se você precisa de suporte a Excel, o DocTalk atende melhor. A melhor forma de comparar é",
+  "compareAskyourpdf.verdictParagraph3": "Se você precisa de integrações com o Zotero, o Chrome ou o seu próprio código, avalie o AskYourPDF. Se você precisa de suporte a Excel, o DocTalk atende melhor. Para comparar,",
   "compareAskyourpdf.verdictParagraph3End": "comparação.",
   "compareAskyourpdf.verdictParagraph3Mid": "e veja o destaque de citação em ação. Você também pode se interessar pela nossa",
   "compareAskyourpdf.verdictTitle": "Veredicto",
diff --git a/frontend/src/i18n/locales/zh.json b/frontend/src/i18n/locales/zh.json
index 0ee3f628..3eb6494a 100644
--- a/frontend/src/i18n/locales/zh.json
+++ b/frontend/src/i18n/locales/zh.json
@@ -1673,7 +1673,7 @@
   "altsChatpdf.adv6": "公开价格：Plus $9.99/月，Pro $19.99/月",
   "altsChatpdf.alt2Title": "AskYourPDF——最适合研究人员",
   "altsChatpdf.alt2Desc1": "AskYourPDF 以其面向研究的生态系统脱颖而出：Chrome 扩展、Zotero 插件、iOS 和 Android 应用、ChatGPT GPT，以及面向开发者的 API。其页面列出了 PDF、DOCX、EPUB、PPTX、RTF、TXT 和 CSV 文件以及粘贴的 URL。",
-  "altsChatpdf.alt2Desc2Pre": "AskYourPDF 称每个回答都会引用确切的段落或页码，点击引用即可跳转到来源并将其高亮显示。免费计划每天允许 1 份文档和 50 个问题。Premium 每月 $14.99，按年计费则为每月 $11.99。对于深度使用 Zotero 生态的研究人员来说，AskYourPDF 很难被超越。查看我们的",
+  "altsChatpdf.alt2Desc2Pre": "AskYourPDF 称每个回答都会引用确切的段落或页面，点击引用即可跳转到来源并将其高亮显示。免费计划每天允许 1 份文档和 50 个问题。Premium 每月 $14.99，按年计费则为每月 $11.99。对于深度使用 Zotero 生态的研究人员来说，AskYourPDF 很难被超越。查看我们的",
   "altsChatpdf.alt2CompareLink": "AskYourPDF 对比",
   "altsChatpdf.alt2BestFor": "学术研究人员、Zotero 用户、需要 API 的开发者",
   "altsChatpdf.alt3Title": "Humata——最适合团队",
@@ -1753,7 +1753,7 @@
   "altsNotebooklm.alt2BestFor": "需要最简单 PDF 问答工具的用户",
   "altsNotebooklm.alt3Title": "AskYourPDF——最适合研究人员",
   "altsNotebooklm.alt3Desc1": "AskYourPDF 是需要与现有研究工具集成的学术研究人员的最佳 NotebookLM 替代方案。Zotero 插件可将其连接到您的文献库，Chrome 扩展可在浏览器中使用，并提供 API 供程序化访问。",
-  "altsNotebooklm.alt3Desc2": "Gemini Notebook 的笔记本鼓励探索性的跨文档研究，而 AskYourPDF 则针对结构化学术工作流程。它称每个回答都会引用确切的段落或页码，点击引用即可跳转到来源并将其高亮显示。Premium 每月 $14.99，按年计费则为每月 $11.99。",
+  "altsNotebooklm.alt3Desc2": "Gemini Notebook 的笔记本鼓励探索性的跨文档研究，而 AskYourPDF 则针对结构化学术工作流程。它称每个回答都会引用确切的段落或页面，点击引用即可跳转到来源并将其高亮显示。Premium 每月 $14.99，按年计费则为每月 $11.99。",
   "altsNotebooklm.alt3BestFor": "学术研究人员、Zotero 用户、开发者",
   "altsNotebooklm.alt4Title": "Humata——最适合团队",
   "altsNotebooklm.alt4Desc1": "Humata 围绕团队计划打造。其 Team 计划最多支持 10 位用户，每月 5,000 页，并提供部门和文件夹权限；其 Expert 计划最多支持 3 位用户。其首页把“Highlights citations”（高亮引用）列为其功能之一。",
@@ -1781,7 +1781,7 @@
   "altsNotebooklm.faq2Question": "有免费的 NotebookLM 替代方案吗？",
   "altsNotebooklm.faq2Answer": "有。DocTalk 提供无需注册的免费演示和每月 300 积分的免费层级。ChatPDF 的免费计划每天可处理 2 份文档，Elicit 的免费计划包含无限次搜索和论文对话。Gemini Notebook 本身免费，但有用量限制，并非无限使用。",
   "altsNotebooklm.faq3Question": "哪个 NotebookLM 替代方案的引用最好？",
-  "altsNotebooklm.faq3Answer": "点击引用时，DocTalk 会滚动到原始文档中被引用的段落并将其高亮显示。在本页的替代方案中，AskYourPDF 称其会引用确切的段落或页码并高亮显示来源，Elicit 使用句子级引用。Gemini Notebook 本身会在上下文中打开被引用的段落，但未在文档中说明会标注页码。",
+  "altsNotebooklm.faq3Answer": "点击引用时，DocTalk 会滚动到原始文档中被引用的段落并将其高亮显示。在本页的替代方案中，AskYourPDF 称其会引用确切的段落或页面并高亮显示来源，Elicit 使用句子级引用。Gemini Notebook 本身会在上下文中打开被引用的段落，但未在文档中说明会标注页码。",
   "altsNotebooklm.faq4Question": "有替代方案能像 NotebookLM 一样生成音频播客吗？",
   "altsNotebooklm.faq4Answer": "Gemini Notebook（原 NotebookLM）将 Audio Overviews（音频概览）列为其功能之一。DocTalk 不生成音频，我们也没有核查本页其他替代方案是否提供音频功能。如果音频摘要对您的工作流程很重要，请从 Gemini Notebook 开始。",
   "altsNotebooklm.faq5Question": "哪个替代方案最适合科学论文？",
@@ -1821,7 +1821,7 @@
   "altsHumata.alt2BestFor": "想要无需账号、简单易用的文档聊天工具的用户",
   "altsHumata.alt3Title": "AskYourPDF——最佳集成方案",
   "altsHumata.alt3Desc1": "AskYourPDF 提供广泛的集成生态系统：Chrome 扩展、Zotero 插件、iOS 和 Android 应用、ChatGPT GPT 以及开发者 API。对于需要将文档分析纳入更大工具链的高级用户，这种灵活性是其主要吸引力。",
-  "altsHumata.alt3Desc2": "其页面列出了 PDF、DOCX、EPUB、PPTX、RTF、TXT 和 CSV 文件以及粘贴的 URL；它称每个回答都会引用确切的段落或页码，点击即可跳转到高亮显示的来源。Premium 每月 $14.99，按年计费则为每月 $11.99。相比 Humata，它的主要优势在于集成方式：AskYourPDF 不是把所有功能都塞进一个平台，而是让您把文档 AI 连接到已在使用的工具上。",
+  "altsHumata.alt3Desc2": "其页面列出了 PDF、DOCX、EPUB、PPTX、RTF、TXT 和 CSV 文件以及粘贴的 URL；它称每个回答都会引用确切的段落或页面，点击即可跳转到高亮显示的来源。Premium 每月 $14.99，按年计费则为每月 $11.99。相比 Humata，它的主要优势在于集成方式：AskYourPDF 不是把所有功能都塞进一个平台，而是让您把文档 AI 连接到已在使用的工具上。",
   "altsHumata.alt3BestFor": "需要浏览器、Zotero 和 API 集成的高级用户",
   "altsHumata.alt4Title": "NotebookLM——最佳免费替代方案",
   "altsHumata.alt4Desc1": "Google NotebookLM（现名 Gemini Notebook）是最好的免费 Humata 替代方案。Humata 的免费层级每月可处理 60 页，而 Gemini Notebook 免费的 Standard 层级允许创建 100 个笔记本、每个笔记本 50 个来源（需 Google 账号）。一个笔记本可组合 PDF、Word、PowerPoint、Google Docs、网页 URL 和 YouTube 视频，Audio Overviews（音频概览）可将您的来源转为音频摘要。",
@@ -2071,7 +2071,7 @@
   "compareAskyourpdf.whatIsDocTalkTitle": "什么是 DocTalk？",
   "compareAskyourpdf.whatIsDocTalkDescription": "DocTalk 是一个 AI 文档问答平台，支持七种文件格式：PDF、DOCX、PPTX、XLSX、TXT、Markdown 和网页 URL。其突出功能是可点击的引用：点击 AI 回答中的引用，即可滚动到文档中的出处，并看到被引用的段落高亮显示。界面支持 11 种语言，两种 AI 性能模式（Flash 和 Pro）让您选择速度和深度之间的最佳平衡。DocTalk 专为需要对照原文验证 AI 回答的任何人打造，从撰写论文的学生到审阅合同的律师。",
   "compareAskyourpdf.whatIsAskyourpdfTitle": "什么是 AskYourPDF？",
-  "compareAskyourpdf.whatIsAskyourpdfDescription": "AskYourPDF 是一款 AI 文档聊天工具，拥有丰富的集成。根据其官网（2026 年 10 月），它可在网页、iOS 和 Android 上使用，也提供 Chrome 扩展、ChatGPT GPT 和 Zotero 插件，并为开发者提供 API。其文档相关页面列出了 PDF、DOCX、EPUB、PPTX、RTF、TXT 和 CSV 文件；其 PDF 聊天页面列出了 PDF、DOCX、EPUB 和 TXT 文件或粘贴的 URL。它称每个回答都会引用确切的段落或页码，点击引用即可跳转到来源并将其高亮显示。其首页现在主推一款独立的网站聊天机器人产品，PDF 聊天则有单独的页面。",
+  "compareAskyourpdf.whatIsAskyourpdfDescription": "AskYourPDF 是一款 AI 文档聊天工具，拥有丰富的集成。根据其官网（2026 年 10 月），它可在网页、iOS 和 Android 上使用，也提供 Chrome 扩展、ChatGPT GPT 和 Zotero 插件，并为开发者提供 API。其文档相关页面列出了 PDF、DOCX、EPUB、PPTX、RTF、TXT 和 CSV 文件；其 PDF 聊天页面列出了 PDF、DOCX、EPUB 和 TXT 文件或粘贴的 URL。它称每个回答都会引用确切的段落或页面，点击引用即可跳转到来源并将其高亮显示。其首页现在主推一款独立的网站聊天机器人产品，PDF 聊天则有单独的页面。",
   "compareAskyourpdf.featureByFeatureTitle": "逐项功能对比",
   "compareAskyourpdf.documentFormatTitle": "文档格式支持",
   "compareAskyourpdf.documentFormatCompetitor": "AskYourPDF 自己的各个页面列出的格式并不相同（2026 年 10 月核实）：其 PDF AI 页面和文档聊天页面列出了 PDF、DOCX、EPUB、PPTX、RTF、TXT 和 CSV 文件，其 PDF 聊天页面则列出了 PDF、DOCX、EPUB 和 TXT 文件或粘贴的 URL。这些页面均未列出 Excel（.xlsx）文件。",
@@ -2079,7 +2079,7 @@
   "compareAskyourpdf.multiFormatLink": "多格式支持",
   "compareAskyourpdf.forDetails": "了解详情。",
   "compareAskyourpdf.citationsTitle": "AI 回答质量与引用",
-  "compareAskyourpdf.citationsCompetitor": "AskYourPDF 称“每个回答都包含指向您文档中确切段落或页码的引用”，点击引用会直接跳转到来源，且来源段落或页面会被高亮显示。",
+  "compareAskyourpdf.citationsCompetitor": "AskYourPDF 称“每个回答都包含指向您文档中确切段落或页面的引用”，点击引用会直接跳转到来源，且来源段落或页面会被高亮显示。",
   "compareAskyourpdf.citationsDocTalk": "DocTalk 同样让每个引用都可点击：点击后，文档查看器会滚动到被引用的段落并将其高亮显示。如果 DocTalk 无法精确定位该段落，则会改为显示被引用的页面。对于每项论断都必须可追溯的学术和法律工作，这能节省时间。了解更多关于我们的",
   "compareAskyourpdf.citationHighlightingLink": "引用高亮",
   "compareAskyourpdf.languageSupportTitle": "语言支持",
@@ -2120,7 +2120,7 @@
   "compareAskyourpdf.faq1Question": "DocTalk 比 AskYourPDF 好吗？",
   "compareAskyourpdf.faq1Answer": "取决于您的需求。DocTalk 可读取包括 Excel 在内的 7 种格式，并在您的文档中高亮显示被引用的段落。AskYourPDF 提供更多集成，包括 Chrome 扩展、Zotero 插件、移动应用和 API 访问。如果您需要处理 Excel 文件，DocTalk 是更好的选择。如果您需要浏览器集成或 API 访问，AskYourPDF 更有优势。",
   "compareAskyourpdf.faq2Question": "AskYourPDF 支持引用高亮吗？",
-  "compareAskyourpdf.faq2Answer": "AskYourPDF 称支持：每个回答都会引用确切的段落或页码，点击引用会跳转到来源，且来源会被高亮显示。点击引用时，DocTalk 会滚动到文档中被引用的段落并将其高亮显示。",
+  "compareAskyourpdf.faq2Answer": "AskYourPDF 称支持：每个回答都会引用确切的段落或页面，点击引用会跳转到来源，且来源会被高亮显示。点击引用时，DocTalk 会滚动到文档中被引用的段落并将其高亮显示。",
   "compareAskyourpdf.faq3Question": "哪个工具更容易使用？",
   "compareAskyourpdf.faq3Answer": "DocTalk 是一个界面专注的网页应用，其演示无需注册。AskYourPDF 提供更多应用和集成，可选择的也更多。不妨用一份简短的文档分别试用两者，看看哪个更适合您。",
   "compareAskyourpdf.faq4Question": "AskYourPDF 能处理非 PDF 文档吗？",
@@ -2885,7 +2885,7 @@
   "altsAskyourpdf.faq3Question": "哪个 AskYourPDF 替代品支持最多的文档格式？",
   "altsAskyourpdf.faq3Answer": "Gemini Notebook（原 NotebookLM）在此列表中支持的来源范围最广，从 Word、PowerPoint 和 ePub 文件到网页 URL 和 YouTube 视频。DocTalk 支持7种格式，包括 PowerPoint 和 Excel。AskYourPDF 的页面列出了 PDF、DOCX、EPUB、PPTX、RTF、TXT、CSV 和 URL。",
   "altsAskyourpdf.faq4Question": "是否有引用准确性更高的 AskYourPDF 替代品？",
-  "altsAskyourpdf.faq4Answer": "DocTalk 会滚动到文档中被引用的段落并将其高亮显示，引用查找器还会将引文与原文进行核对。AskYourPDF 称其会引用确切的段落或页码，点击引用即跳转到该处，并高亮显示来源。ChatDOC 的文档中也提到了可点击的页码。",
+  "altsAskyourpdf.faq4Answer": "DocTalk 会滚动到文档中被引用的段落并将其高亮显示，引用查找器还会将引文与原文进行核对。AskYourPDF 称其会引用确切的段落或页面，点击引用即跳转到该处，并高亮显示来源。ChatDOC 的文档中也提到了可点击的页码。",
   "altsAskyourpdf.faq5Question": "哪个 AskYourPDF 替代品最适合学术研究？",
   "altsAskyourpdf.faq5Answer": "对于学术研究，Consensus 非常适合搜索已发表的论文。DocTalk 最适合分析带有可验证引用的特定文档。NotebookLM 非常适合免费的带音频摘要的多源文献综述。",
   "altsAskyourpdf.chooseNeed1": "多格式支持 + 引用高亮显示",
@@ -2906,7 +2906,7 @@
   "altsAskyourpdf.whyTitle": "为什么要寻找 AskYourPDF 的替代方案？",
   "altsAskyourpdf.whyIntro": "AskYourPDF 是一款集成众多、可靠的 PDF 问答工具，但有些需求会让您另寻他处：",
   "altsAskyourpdf.whyReason1": "格式覆盖 — AskYourPDF 的页面列出了 PDF、DOCX、EPUB、PPTX、RTF、TXT 和 CSV 文件以及 URL，但均未列出 Excel（.xlsx）文件。DocTalk 可原生读取 Excel 文件。",
-  "altsAskyourpdf.whyReason2": "引文核查 — AskYourPDF 称每个回答都会引用确切的段落或页码，并高亮显示来源。DocTalk 同样会高亮被引用的段落，其引用查找器只显示与原文核对过的引文，并附上引文所在的页码。",
+  "altsAskyourpdf.whyReason2": "引文核查 — AskYourPDF 称每个回答都会引用确切的段落或页面，并高亮显示来源。DocTalk 同样会高亮被引用的段落，其引用查找器只显示与原文核对过的引文，并附上引文所在的页码。",
   "altsAskyourpdf.whyReason3": "免费计划限制 — 免费计划每天允许 1 份文档（每份最多 100 页、15 MB），以及每天 50 个问题。",
   "altsAskyourpdf.whyReason4": "定价 — Premium 按月计费为每月 $14.99，按年计费为每月 $11.99。DocTalk Plus 每月 $9.99，按月计费。",
   "altsAskyourpdf.alt1Title": "DocTalk",
@@ -3029,7 +3029,7 @@
   "altsPdfai.alt2BestFor": "想要无需账号、简单易用的文档聊天工具的用户。",
   "altsPdfai.alt3Title": "AskYourPDF",
   "altsPdfai.alt3Desc1": "AskYourPDF通过为学术工作流集成Zotero和为开发者提供API访问而与众不同。如果您从PDF.ai切换过来并需要研究工具集成，AskYourPDF很好地填补了这一空白。",
-  "altsPdfai.alt3Desc2Pre": "AskYourPDF的页面还列出了DOCX、EPUB、PPTX、RTF、TXT和CSV文件以及粘贴的URL，它也提供Chrome扩展、ChatGPT GPT和移动应用。它称每个回答都会引用确切的段落或页码。请查看我们的",
+  "altsPdfai.alt3Desc2Pre": "AskYourPDF的页面还列出了DOCX、EPUB、PPTX、RTF、TXT和CSV文件以及粘贴的URL，它也提供Chrome扩展、ChatGPT GPT和移动应用。它称每个回答都会引用确切的段落或页面。请查看我们的",
   "altsPdfai.alt3CompareLink": "AskYourPDF对比",
   "altsPdfai.alt3BestFor": "需要Zotero集成和API访问以实现自动化工作流的研究人员。",
   "altsPdfai.alt4Title": "Humata",
```
