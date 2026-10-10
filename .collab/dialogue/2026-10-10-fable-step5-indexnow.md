# Fable resolution — Step 5 method and Bing submission (2026-10-10, ~13:58Z)

Asked by Claude after Step 4 and the ja page shipped. Planner: Fable 5.1 (Plan agent, read-only).

## Q1 — Step 5 post: option (c), ship
- Method: "documented" for every tool (vendor pages, dated, short verbatim quotes, as in the three listicles). The only hands-on element is DocTalk's public `/demo` on "Attention Is All You Need" (no account). No uploads to ChatPDF/Smallpdf → no ToS acceptance, no licence question. Quote at most 1–2 sentences of the paper per citation, attributed "Vaswani et al., 2017, arXiv:1706.03762". "Tested on the same paper" is dropped (n=1, asymmetric, not reproducible).
- Title: "Which AI PDF readers cite the page number for every answer? 7 tools compared (2026)". Body answers "N of 7 do". A declarative "7 readers that cite the page number" would contradict `best-ai-pdf-tools-2026.md:199` (ChatPDF scrolls to source, not a page number). If fewer than 7 tools have documented evidence, change the number, not the claim.
- Go/no-go unchanged: the gate is AI-engine citation on the P-C2 prompt class, not Google rank. KD 62 at DR 0 only confirms Google is not the mechanism.
- Timing: write 10-13 → 10-16, ship on Codex SHIP, target 10-17, no later than 10-24.
- Executor steps: (1) live `/demo` on the Attention paper, confirm "Page N" citations, record answer + page refs; (2) candidates from `.collab/reviews/2026-09-22-pricing-research/10-competitors-en.md` + Smallpdf + Otio; bar = a vendor page stating page-level citation (URL + date); classify page number / jump-to-source / highlighted passage; (3) `category: comparisons`, `### N.` headings, `## Frequently Asked Questions`, answer-first opener, comparison table; (4) inbound link from `citation-highlighting-matters.md` only; do not edit the three Release B listicles before 11-07; (5) Codex fact-check 1–2 rounds, frontend-only ship, IndexNow ping, log; (6) pre-register the 11-21 read: primary = Bing indexed by +7 d and Ahrefs "cited pages" > 9 (baseline); P-C2/C3 probes when available; GSC impressions ≥ 50 secondary.

## Q2 — Bing without the owner: do it now, one-off, no code
- The IndexNow key file already exists and is live (`frontend/public/38e9d0db4a654c64b237039b2ac0af5d.txt`; `src/app/api/indexnow/route.ts` uses it). Any client may POST for the host, so no repo change, no `AUTH_SECRET`, no owner. Bing Webmaster sign-in is still needed for the 11-07 / 11-21 reads.
- Scope: content-changed URLs only (never the full 306). Guardrails: each URL in a no-cache fetch of the live sitemap, HTTP 200, no `noindex`; key file fetched first; payload as in `route.ts`; record status + list in actions-log; never touch `/api/indexnow` or `AUTH_SECRET`.
- Going forward: a validated-submit script `frontend/scripts/seo/indexnow_submit.py` lands with the Step 5 PR and becomes a ship-checklist step. Not CI.
