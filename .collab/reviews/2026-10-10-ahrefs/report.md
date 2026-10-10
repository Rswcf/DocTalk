# Ahrefs SEO/GEO test — report (2026-10-10)

Design: `.collab/plans/2026-10-10-traffic-plan-v2.md` §1 (Fable 5.1). Executor: Claude. Shared reseller account (app.ahrefs.fast.wmxpro.com); no projects, reports or Rank Tracker saved. Evidence: `00-access.md`, `01-site-explorer-overview.md`, `03-referring-domains.md`, `06-keywords.md`. Status labels as in the 09-30 audit (PROVEN / CORRELATED / HYPOTHESIS / KILLED).

## Headline

Ahrefs agrees with GSC and Semrush that Google is not a channel: DR 0, 0 organic keywords, 0 modelled organic traffic. It also sees DocTalk in 51 AI answers over the last 3 months (+48), across 9 cited pages: AI Mode 23, Perplexity 11, Copilot 7, ChatGPT 5, Gemini 3, AI Overviews 2. That is the only external signal of AI visibility we have, and it is growing from a near-zero base. Which prompts and pages drive it is locked on this account.

Backlinks are 564 live referring domains (580 all-time), almost all link-selling spam. The only editorial link is parse.gl, and no editorial link was lost. That KILLS the "a listicle dropped us in May" mechanism for the ChatGPT cliff. Keyword checks overturn one Semrush figure (`chatty pdf` is about 10/month, not 1,600) and confirm low difficulty (KD 0) for `humata`, `chatpdf alternatives` and `論文ai`.

## Rows (plan v2 §1)

| # | Pull | Result | Status / rule outcome |
|---|---|---|---|
| 1 | Module inventory | Site Explorer overview, Referring domains, Keywords Explorer: available. Traffic add-on (sources/referrals), Brand Radar AI visibility (overview, cited pages, responses): **LOCKED**. Content Explorer: UI search is not scriptable here → fallback used. Site Audit / Rank Tracker: not used by rule | — |
| 2 | Brand Radar | LOCKED. Only the counts on Site Explorer's overview are visible: **51 AI responses (+48 in 3 months), 9 cited pages**; AI Overviews 2 (2 pages), AI Mode 23 (5), ChatGPT 5 (+3; 5), Gemini 3 (3), Perplexity 11 (3), Copilot 7 (+6; 1). The snapshot predates the Release B ship (read 10-10 ~07:00Z, B pushed 07:13Z) → **C-9 baseline = 51 responses / 9 pages / ChatGPT 5** | Baseline recorded. Fallback per plan: Perplexity grid is now Cloudflare-challenged; Semrush widget 14 mentions (09-29) |
| 3 | Backlinks new/lost, referring domains | 580 all-time; 27 not flagged SPAM, of which one editorial (parse.gl, DR 43, first seen 09-24); the rest website-value/directory auto-sites; **no lost editorial link**; wisdomquant/pdnob/effortlessacademic (the domains that mention DocTalk in AI answers) **do not link** | "Lost listicle link" mechanism **KILLED**. Spam: count only, no second disavow |
| 4 | Link Intersect | Not run: the Competitive Analysis form ignores scripted input (React state) and real typing needs the browser pane in front; it feeds only the owner's outreach list | Fallback = the SERP lists in rows 5–6 |
| 5 | Content / Web Explorer | Content Explorer's search box ignores scripted input → fallback: Keywords Explorer SERP for `chatpdf alternatives` (US, KD 0, 60/mo): logically.app (DR 44), mindgrasp.ai (DR 61), reddit r/ChatGPTPro (DR 95), denser.ai, noiz.io, chatpdf.com, aipdf.ai (DR ~31), audeus.com (DR ~23), aidetectplus.com. **None is a DocTalk URL**; several are DR 20–45 vendor blogs | Step 5 gate input: `ai pdf reader` (US 1.2K, **KD 62**, TP 15K) top 9 = product pages (chatpdf.com, notegpt.io, readloudly, reddit r/studying, smallpdf, noteey, a Play-store PDF app, adobe.com, paper2audio) — none DocTalk; at DR 0 the head term is out of reach; the long-tail P-C2 phrasing has no Ahrefs volume → the `chatpdf alternatives` SERP shows vendor listicles at DR 20–45 rank on a KD-0 term, which the refreshed post can compete with |
| 6 | Keywords Explorer | `chatty pdf` US 0–10, global 10 (Semrush said 1.6K) · `humata` US **700, KD 0, TP 1.0K**; top results: a tools directory (DR 43), Yahoo Finance article, Humata's YouTube, a UPDF-vs-Humata comparison (DR 72), make.com, AppSumo review · `chatpdf alternatives` US 60, KD 0, TP 40 · `論文ai` TW **150, KD 0**; global 400 = **Japan 200**, Taiwan 150, Hong Kong 40; top results: university pages (NTHU, NYCU, MOE), a Threads post, an editing-service blog, and two product pages (gatsbi.com/tw AI paper writer, mapify.so/tc research-paper summarizer) · `ia para investigar gratis` ES 0–10; global 600 = Venezuela 100, Mexico 90, Peru 70, Colombia 60 | ChattyPDF: **no page, final**. zh: KD 0 with product pages ranking → keep the students-page metric; note TW searches use traditional characters while `/zh` is simplified. ja: `論文ai` has more demand in Japan than Taiwan → `/ja/use-cases/students` is worth the same treatment. es: demand is Latin American |
| 7 | Organic keywords / top pages / competitors | Overview: 0 organic keywords, 0 traffic, no countries, no competitors | "Google is not the channel" **confirmed**; no locale URL ranks in its market → Tier-1 list unchanged by Ahrefs |

## What this changes in plan v2

- **Step 7 (ChattyPDF page): closed now** — no page.
- **Step 4 (locale tiering): Ahrefs adds nothing that moves a locale into Tier 1**; the tier-2 set (it/ar/hi) stands on GSC evidence. New input for Fable: `論文ai` demand is larger in Japan (200) than Taiwan (150); TW queries use traditional characters.
- **Step 5 (new post): gate data in** — head term `ai pdf reader` KD 62 (out of reach); the P-C2 long tail has no measurable volume; Fable decides.
- **C-9 baseline** for the 11-07 read: Ahrefs AI responses 51 / cited pages 9 / ChatGPT 5 (overview counts, 3-month window, read 10-10 before the ship).

## Not done (with reason)

- Link Intersect (row 4): not runnable by script on this account (see row 4). The reseller session expired once mid-test and was reopened from waimaoxia without a password.
- Un-gated attribution readout: Railway CLI needs the owner's login (pairing code flow; the owner's browser has no Railway session).
- Similarweb (enterprise) is available on waimaoxia and was not in the plan; it may estimate traffic sources including AI chatbots. To try once the session is back.

## Addendum (2026-10-10, after Fable's resolution)
- Similarweb (enterprise) on waimaoxia: **unavailable** — "工具已过有效期，请续费后使用" (the reseller subscription for this tool has expired). Competitor channel/referral pull (plan v2 resolution item 4) not possible without a renewal; not requested.
