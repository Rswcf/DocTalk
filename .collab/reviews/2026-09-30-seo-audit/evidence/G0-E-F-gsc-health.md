# G0-E / G0-F GSC health (read 2026-09-30)
Manual actions: "No issues detected". Security issues: "No issues detected". → penalty hypothesis KILLED (spam links devalued/ignored, as the 09-20 report framed).
Discover / Google News: no Performance tabs for either in the property → burst-that-ended hypothesis KILLED.
Crawl stats (90 d, last updated 2026-09-29): 2.14K requests, 42.2 MB, avg response 165 ms. By response: 200 99%, 404 <1%, 301 <1%, robots.txt not available <1%. By purpose: Refresh 96%, Discovery 4%. By file type: JS 61%, HTML 16% (~340 HTML fetches / 90 d ≈ 4 per day), other 13%, CSS 8%, image 1%, failed 1%. By Googlebot type: page resource load 55%, desktop 27%, smartphone 13%. Host status: "Host had problems in the past" (90-day window; the <1% robots.txt-not-available row is the visible trace).
Daily chart (visual read, screenshot): low baseline with one spike mid-August; no sustained ≥50% drop after 09-21 or 09-27 → G0-F KILLED.
Note: Discovery 4% + sitemap last read 2026-05-24 = Google is barely discovering new URLs; it re-fetches what it knows.

Host-status drilldown (added after review): "robots.txt not available" = ONE request, 2026-08-10 02:05 (URL /ar/alternatives/notebooklm). A single blip → "Host had problems in the past" lead KILLED.
BWT "Filter by" options: All | Web and Chat | News | Images | Video | Knowledge Panel | Crawl and Indexing — Chat is not separable from Web, so no Copilot-only series exists.
squirrelscan "leaked secrets": (1) "Cloudflare API Token" = the heading "Cloud-Based Tools (DocTalk, ChatPDF, NotebookLM, etc.)" at frontend/content/blog/ai-document-security-privacy.md:139; (2) "passwo…" in chunk 6324 = Sentry's URL sanitizer `t.password&&(t.password="%filtered%")`. Both false positives.
Semrush Referring domains report: LOCKED on the reseller (redirects to Backlinks Overview); AS distribution only: 221/231 at 0–10, 5 at 11–20, 1 at 31–40, 1 at 91–100.
