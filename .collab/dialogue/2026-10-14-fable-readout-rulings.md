# Fable resolution — readout questions (2026-10-14)

Asked by Claude after the Step 3 readout (10-13 read, run 10-14) and Perplexity day 1 (`.collab/reviews/2026-10-14-ungated-readout/report.md` §6). Planner: Fable 5.1 (Plan agent, read-only).

## Q1 — Unfreeze two posts for fact corrections; academic post stays frozen
- Ship now: every vendor-evidence.md §3 row for `best-ai-pdf-tools-2026.md` and `chatpdf-alternatives-2026.md`, plus claims.md §D Q1–Q2. Executor's lean stands, widened to the second file (same AskYourPDF format error, :196).
- `best-ai-tools-academic-research-2026.md` stays frozen: nothing in it is wrong. Q3 waits for 11-07.
- Unchanged: `title`, frontmatter `description` (the meta description; prices do not change, so "checked 30 September 2026" stays true), every heading, tool order, Short answer, Verdict. No new blocks or correction notice; the actions-log is the record.
- Changed besides the §3 cells: footnote ¹ dropped where a cell becomes vendor-sourced; lines 34 and 171 name the second check date (10-10 if Codex finds the vendor pages unchanged, else ship day); `updated` = ship date (`dateModified`, lastmod follow). English-only, no i18n; Codex fact-check; frontend-only release.
- The `updated` bump is a second freshness pulse, accepted: supported on 11-07 means "two pulses on 2 of 3 units", killed is a stronger kill, the decision (refresh `/alternatives/*` or stop) is the same. Read date stays 11-07.

## Q2 — Option (a), and fix the instrument
- Bar: ≥ 1 qualifying event (pre-registered definition) in 10-10 07:13Z → 11-07; precedent plan §1 row 2.
- The event arm supports, never kills: 0 at the sign-in step is uninformative. KILLED = probe arm < 2 of 4 tier a/b AND event arm 0. Event arm alone → HYPOTHESIS; probe arm → CORRELATED; either plus GA4 or Brand Radar agreeing → PROVEN.
- Instrument: `landing_cta_clicked` is in the metric and in `ATTRIBUTED_EVENTS`, but no blog page emits it. `BlogPostClient.tsx` renders `/demo` in the about box, the CTA banner and markdown links (~:406, ~:431, :289) without `trackEvent`. Add `trackEvent('landing_cta_clicked', { source: 'blog_about' | 'blog_cta' | 'blog_inline', reason: 'demo' })`; no copy, i18n or backend. `readout_1014.py` §5 filters by event name and landing_path, so it counts the new rows; add an `event_name` breakdown there.
- Ship the instrument first, with its own timestamp. The 11-07 report names each qualifying event's step: sign-in compares with the 0 baseline; CTA exists only after the fix.

## Q3 — Minimum n = 10; expect "not readable" on 10-27
- Readable at ≥ 10 attributed `auth_provider_clicked` since 09-30 21:59Z (cumulative, owner excluded); then AI ≥ 30 % → AEO is the channel. (n = 10: ≥ 3 AI clicks against a 10 % background, p ≈ 0.07.)
- Fallback: the §2 volume bar on all three attributed events (≥ 5/week, AI ≥ 20 %, 2 consecutive full weeks), disclosing the blog-CTA instrument change if that is what reaches it.
- Current rate ~1 attributed provider click/week. Roll to 11-03, then decide on 11-07 with what is there, labelled. Report the attributed fraction beside the share (9 of 23 today).

## Plan changes
- ChatGPT MFA (owner item ③) goes to the top of the owner list. The cliff was ChatGPT; Perplexity read d on every category probe on 09-30 and 10-14, so a Perplexity-only probe arm reads d whatever C-9's truth. Without it the 11-07 read is weak and says so.
- ChatGPT still links `/` (5 of 7 events carry its utm tag); C-9 asks whether it will cite the listicles, not whether it cites us.
- Step 3: GSC Generative AI features becomes a permanent column (impressions; direction only, never arrivals); page table each readout; the corrected post's series is a guard, not a test. GA4 chatgpt.com sessions by landing page at 10-27 if accessible, else owner list.
- Step 6: Copilot retries stop; 10-28 the 8 remaining probes; 11-07 P-C1, C4, C6, C8, not earlier.
- Steps 5, 8: unchanged; the two new timestamps become 11-07 intervention rows. August AI-feature peak (4,178): no cause on record; owner question, not chased.

## Executor steps
1. Add `trackEvent` to the three `/demo` link sites in `BlogPostClient.tsx`; test; Codex SHIP; frontend-only; ship; log the timestamp.
2. Branch `content/listicle-corrections-2026-10`; apply the §3 rows and §D Q1/Q2 to the two files under the Q1 rules; set lines 34, 171 and `updated`.
3. Codex fact-check → SHIP; CI green; `backend/`, `version.json`, `infra/` diff empty; push `stable`.
4. No-cache verify `dateModified` and lastmod; IndexNow the two URLs, `/blog`, `/blog/category/comparisons`; GSC request indexing ×2; log "second intervention, 2 of 3 C-9 units; academic untouched; Q3 queued".
5. Add the `event_name` breakdown to `readout_1014.py` §5; rerun 10-20, 10-27, 11-03 with the GSC AI-feature page table and GA4 if accessible.
6. 10-27: apply the Q3 rule; write "not readable" if n < 10.
7. 10-28: 8 Perplexity probes; no Copilot.
8. 11-07: P-C1, C4, C6, C8 (ChatGPT if MFA is done); C-9 read under Q2, each event's funnel step named.
