codex
1. SHOULD — `frontend/content/blog/best-ai-pdf-tools-2026.md:180`: Humata cell says “Link to file; says it highlights.” Vendor evidence only supports the exact feature heading “Highlights citations,” with no object or location.  
Concrete fix: `Links to cited files; "Highlights citations" not specified`.

2. SHOULD — `frontend/content/blog/best-ai-pdf-tools-2026.md:181` and `:231`: ChatDOC free tier still silently says `5 files/day` / `five files a day`. The prose at `:163` correctly names the homepage table and the guide/FAQ conflict, but the table and FAQ answer still pick the homepage side without carrying the contradiction.  
Concrete fix: table cell `5 files/day (homepage; guide/FAQ say 2/day)` and FAQ sentence `ChatDOC lists five files a day on its homepage, while its guide and FAQ say two files per 24 hours.`

No blocker found. The `chatpdf-alternatives` second-check-date edits at `:25` and `:190` are right by analogy. Remaining `¹` markers are only Humata format cells; no vendor-sourced cell kept one. The pasted diff touches only the two allowed files; the two frozen posts still show `updated: "2026-10-10"` in the current checkout. DocTalk “exact passage/page” holdouts are not false enough to override the locked Short answer/Verdict rule; changed DocTalk highlight claims use “cited passage.”

SHIP-WITH-FIXES


