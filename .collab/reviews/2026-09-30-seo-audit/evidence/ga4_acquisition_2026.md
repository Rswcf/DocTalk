# GA4 property www.doctalk.site (525157255), User acquisition, read 2026-09-30
CAVEAT: GA4 + Vercel Analytics load only after cookie consent (AnalyticsWrapper.tsx), so these are consenting users only — absolute numbers undercount; ratios/trend are the signal.

## First user primary channel group, by month (total users)
Feb 7  :: Direct 5, Referral 2
Mar 11 :: Direct 7, Organic 2, Referral 1, Unassigned 1
Apr 77 :: Referral 31, Direct 20, Unassigned 15, Organic 11
May 66 :: Referral 28, Direct 18, Unassigned 10, Organic 9, Organic Video 1
Jun 23 :: Direct 8, AI Assistant 6, Referral 5, Organic 3, Unassigned 1
Jul 14 :: Organic 5, AI Assistant 4, Direct 4, Referral 1
Aug 30 :: AI Assistant 11, Organic 8, Referral 6, Direct 5
Sep(1-29) 23 :: Direct 7, Organic 7, AI Assistant 5, Referral 4
(GA4 introduced the "AI Assistant" default channel ~Jun 2026; before that chatgpt.com was counted under Referral.)

## First user source, by month
Mar: chatgpt.com 1, google 1, bing 1, vercel.com 1, (direct) 7
Apr: chatgpt.com 32, google 9, bing 2, claude.ai 1, vercel.com 1, accounts.google.com 12 (OAuth return), (direct) 20
May: chatgpt.com 27, google 6, bing 3, github.com 1, vercel.com 2, accounts.youtube.com 1, accounts.google.com 8, (direct) 18
Jun: chatgpt.com 7, google 3, vercel.com 2, accounts.google.com 3, (direct) 8
Jul: chatgpt.com 4, google 4, duckduckgo 1, accounts.google.com 1, (direct) 4
Aug: chatgpt.com 10, google 8, perplexity.ai 1, github.com 1, accounts.google.com 5, (direct) 5
Sep: chatgpt.com 5, google 7, accounts.google.com 4, (direct) 7
Mar 1–Sep 29 total 220 users: chatgpt.com 85 (38.6%), google 38 (17.3%), accounts.google.com 27, bing 6, others ≤2.

=> THE CLIFF IS CHATGPT: ~30 first users/month (Apr–May) → 4–10/month (Jun–Sep), about -75%. Google organic ~3–9/month throughout (no cliff). Timing: between May and June 2026.

## Session source × landing page (sessions), chatgpt.com
Apr 1–May 31 (393 sessions total): `/` 16 · /blog/chatpdf-alternatives-2026 12 · /blog/best-ai-pdf-tools-2026 9 · /demo 7 · /alternatives/notebooklm 5 · /blog/best-ai-tools-academic-research-2026 5 · (not set) 3 · /blog/notebooklm-alternatives-2026 2 · /auth 1 · /d/<demo> 3 (incl. ?question= zh/pt demo links)
  claude.ai: (not set) 1, /d/<demo> 1, /demo 1. bing: /demo 3, (not set) 1, / 1, /about 1.
Jun 1–Sep 29 (~207 sessions): `/` 5 · /blog/best-ai-tools-academic-research-2026 3 · /blog/chatpdf-alternatives-2026 3 · /blog/notebooklm-alternatives-2026 3 · /demo 3 · /alternatives/notebooklm 1 · /blog/ai-research-paper-summarizer 1 · /features/{citations,free-demo,multi-format} 1 each · /pricing 1 · /d/<demo>?question=… 3
  perplexity.ai: /blog/best-ai-tools-academic-research-2026 1. bing: none.
=> Every page ChatGPT sent users to is EN. The two biggest (/ and /blog/chatpdf-alternatives-2026) fell 16→5 and 12→3 over a period twice as long; /blog/best-ai-pdf-tools-2026 fell 9→0.

## Weekly first-user source (GA4, consenting visitors) — added after review
week_start  total  chatgpt  google  direct
04-04        9      3        1       3
04-11       13      5        1       4
04-18       33     10        4      11
04-25       34     17        4       5
05-02       32      9        5      10
05-09       15      6        0       6
05-16       18      8        0       7
05-23        6      2        1       2   <- 05-23 production deploy (editorial marketing surface + Wave-1/2 fixes + C1)
05-30        9      1        1       3
06-06        5      0        0       4
06-13        5      2        1       2
06-20        9      4        0       2
06-27        4      0        2       1
07-04        6      2        2       2
Shape: ChatGPT peaked in late April (17 in one week) and slid through May (9, 6, 8); in the 05-23 week EVERY source stepped down together (total 18→6, direct 7→2, chatgpt 8→2). A step shared by all sources at a deploy date is the signature of a capture change (consent/GA), not of one referrer disappearing — but a real all-channel arrivals drop gives the same picture. Only the un-gated server series (owner SQL-2/3) can tell them apart.

## Coverage proxy (C-2): GSC clicks vs GA4 google first-users
month  GSC_clicks  GA4_google  ratio
Apr        34          9       0.26
May        22          6       0.27
Jun        34          3       0.09
Jul        40          4       0.10
Aug        49          8       0.16
Sep(28d)   31          7       0.23
GA4's capture of Google visitors fell to ~⅓ in Jun–Jul and mostly recovered by Sep. Tiny counts → rough. On comparable-coverage months ChatGPT still fell: Apr–May 59 vs Aug–Sep 15 (raw −75%; ≈ −60% after scaling Aug–Sep to Apr–May coverage). Google organic did not fall: GSC clicks rose Jun→Aug (34→49) and sit at 1–2/day.
Cookie-banner code: CookieConsentBanner.tsx changed in cccb760c (05-20, shipped 05-23) — rAF debounce only; the hide-when-dialog selector `[role="dialog"][aria-modal="true"]` is unchanged, and no marketing component mounts a permanent aria-modal dialog at a06e00c2/bc3c3fe9. Mechanism for the 05-23 capture step NOT found.
