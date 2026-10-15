codex
1. **SHOULD — `zh`: ten changed citation strings add a page-number claim.**  
   `compareAskyourpdf.citationsCompetitor`, `faq2Answer`, `whatIsAskyourpdfDescription`, and seven related strings translate “paragraph or page” as **“段落或页码”**. The evidence supports a paragraph/page destination, not necessarily a displayed page number. Replace **“段落或页码” → “段落或页面”** in all ten changed AskYourPDF strings. Preserve “称” attribution and unrelated, valid page-number references.

2. **SHOULD — [chat-with-excel-spreadsheet-ai.md:14](/Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/zen-wilbur-2dd5cb/frontend/content/blog/chat-with-excel-spreadsheet-ai.md:14): the deliberately retained sentence predicts unverified behaviour.**  
   “You will get an error message or a suggestion to convert to PDF first” is not established by the evidence. Missing `.xlsx` from published format lists does not verify either response. This is pre-existing, but executor decision 1 explicitly retains it. Remove AskYourPDF from that prediction and state: **“AskYourPDF’s published format lists include CSV but do not list Excel (.xlsx) files.”**

3. **NIT — `pt/ja/ko/hi:compareAskyourpdf.verdictParagraph3` and adjoining link fragments need grammatical repair.**  
   The assembled Portuguese reads “A melhor forma de comparar é **experimente**…”. Korean and Hindi similarly join “the best way is” to an imperative; Japanese joins `…無料で試す` directly to `実際の引用ハイライトをご覧ください`. Fix the assembled sentences, preserving the links: use “To compare, try…” in Portuguese/Hindi; use a complete “try…” sentence followed by the highlighting instruction in Korean; add `ことです。` after the Japanese link. These are current join defects, not established new regressions.

Checked all **32 keys across ten translations**, plus the Portuguese fixes. No other substantive translation drift found. JSON parsing, key presence, Markdown column counts, and all five `updated` dates pass. The supplied diff preserves the frozen fields and contains no prohibited-post or metadata-key changes. No git commands or file edits were made.

SHIP-WITH-FIXES
