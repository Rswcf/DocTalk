# Codex fact-check r2: listicle corrections (DocTalk, 2026-10-14)

Do NOT run git. Repo root = cwd. Your r1 verdict was SHIP-WITH-FIXES with two SHOULD findings. Both are
applied; the diff of the fix commit is below. Check only:
1. Each fix against vendor-evidence.md §2.10 (Humata) and §2.1 (ChatDOC), and that it does not overstate.
2. The FAQ answer under "### Which tool has the best free tier?" (best-ai-pdf-tools-2026.md) is also
   emitted as FAQPage JSON-LD by the blog page: check that the sentence reads well as a standalone answer.
3. Table column counts at lines 180–181.
4. Anything else in the two files that r1 should have caught.

Output numbered findings with severity (BLOCKER / SHOULD / NIT), file:line, and a concrete fix.
Final line: SHIP / SHIP-WITH-FIXES / REWORK.

```diff
diff --git a/frontend/content/blog/best-ai-pdf-tools-2026.md b/frontend/content/blog/best-ai-pdf-tools-2026.md
index d23ae280..34148715 100644
--- a/frontend/content/blog/best-ai-pdf-tools-2026.md
+++ b/frontend/content/blog/best-ai-pdf-tools-2026.md
@@ -177,8 +177,8 @@ Checked 30 September 2026 on each vendor's own site unless noted; formats and ci
 | **PowerPoint** | Yes | Yes | — | Yes | —¹ | No | — |
 | **Excel** | Yes | No | No | Sheets/CSV | —¹ | No | — |
 | **Web URL** | Yes | Yes | Yes | Yes | — | No | Pro |
-| **How you check** | Passage highlighted | Scrolls to source | Page citation, click to check | Inline citation, jumps to the quote | Link to file; says it highlights | Cited sources | Page number, click to jump |
-| **Free tier** | 500 starter, then 300/mo | 2 docs/day | 1 doc/day | 100 notebooks | 60 pages/mo | 1 upload/mo | 5 files/day |
+| **How you check** | Passage highlighted | Scrolls to source | Page citation, click to check | Inline citation, jumps to the quote | Cited links to files; "Highlights citations" (unspecified) | Cited sources | Page number, click to jump |
+| **Free tier** | 500 starter, then 300/mo | 2 docs/day | 1 doc/day | 100 notebooks | 60 pages/mo | 1 upload/mo | 5 files/day (homepage; guide/FAQ say 2/day) |
 | **Paid from** | $9.99/mo | Not published | $11.99/mo | Google AI plans | $9.99/mo | $10/mo (yearly) | $8.99/30 days |
 | **No-signup demo** | Yes | — | — | — | — | — | — |
 
@@ -228,7 +228,7 @@ No. All of them rely on cloud AI models to answer questions.
 ChatPDF, AskYourPDF, Gemini Notebook, Humata and ChatDOC support multi-document chat in some form. DocTalk supports single-document chats and collection workspaces for questions across several documents; Quote Finder works within one document.
 
 ### Which tool has the best free tier?
-Gemini Notebook has the largest free allowance. Among dedicated document tools, compare what you need most: DocTalk gives 500 starter credits and then 300 a month, ChatPDF two documents a day, and ChatDOC five files a day.
+Gemini Notebook has the largest free allowance. Among dedicated document tools, compare what you need most: DocTalk gives 500 starter credits and then 300 a month, ChatPDF two documents a day, and ChatDOC five files a day on its homepage (its guide and FAQ say two files per 24 hours).
 
 ### Are there open-source alternatives?
 Yes — self-hosted projects such as PrivateGPT and Quivr. They need technical setup and usually lack citation highlighting and multi-format support.
```
