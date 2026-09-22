# DocTalk — what to push next (Fable 5.1, 2026-09-22)

Written 2026-09-22 ~09:00 CEST, read-only, finishing the DRAFT outline
(`.collab/plans/2026-09-22-next-strategy-DRAFT.md`, kept as the record). Key claims cite their file;
`[inference]` marks what is reasoned rather than measured. Locked owner decisions are honoured: Night marketing
surface; warm-paper/terracotta tokens kept; the app keeps zinc/blue (A2 retired); no lifecycle emails; the
owner only writes code; Fable plans, Claude executes.

## 摘要（给 owner）

1. **瓶颈是"学不到东西"**：注册 ≈0.5/天、能活跃的新用户 ≈0.2/天（09-08 实测），任何产品改动在 2027 年 2 月前都读不出留存差异；09-21 的预注册读数至今没跑——Claude 被权限分类器挡在生产库外。**owner 跑一条命令（5 分钟）就能补上**（读数工具在未推送的 `8eb1da3`，Claude 先推到 `main` 或 owner 从 worktree 路径跑），09-28 的决定靠它。
2. **产品侧唯一有证据的线索**：唯一留存过的人群（论文/引文核对者：19 人、163 次点引文）从未到过 Quote Finder（0/19）。C1 靠"问句措辞"触发，这群人靠"点引文"——点击永远不产生措辞，这是机制，不用等数据。**建议在引文落点（阅读器的 "Back to answer" 栏）加"保存为已验证引文"**：服务端复验，失败则打开面板预填、绝不自动提交。前端为主 + 后端 10 行（保存事件加 `source`）→ 版本升级、后端先行、Codex 审。≈2 Claude 天，**09-28 前只建不发**。这修订了 §9.18.7 的"09-28 前不设计"，理由见 §2.1。
3. **获客侧唯一低难度入口**是中文/西语学术长尾（`论文ai` KD 8、`读论文 ai` KD 17、`文献阅读` KD 20、`ia para investigar gratis` KD 20）。DRAFT 提的新建 `use-cases/researchers` **撤回**：`/zh|/es/use-cases/students` 已经是"学生与学术研究者"页，再建一页只会自我蚕食。改为深化该页 zh/es 正文 + 从唯一有排名的博文和 `/features/citations` 内链（≈1 天，不需批准）；改搜索标题/描述受 owner 自己的 D4 裁定约束（卡在 D2 的 GSC 导出）。
4. **匿名上传**（demo 级配额）仍按 §9.11 默认在 09-28 决定，≈6 天、后端+Codex+owner 部署；默认：读数无更强线索则启动。**09-28 的默认规则（获客）不变**；引文桥是唯一不依赖读数、靠机制论证的 C 项。
5. **停止**：设计 Phase 3–5、2b 剩余的枢纽/标题重写、Jev 标题项、QF M4/导出、休眠功能、任何定价与会话上限改动、分享页循环、新营销页。
6. **需要 owner 决定**（§4）：今天跑读数；`7478d1d` 推 stable（等另一位 Fable 的发布审阅）；批准引文桥的 §9.18.7 修订；匿名上传 go/stage/no（09-28）；企业网关分类（第三次也是最后一次问）；GSC 加 Domain 属性 + 一次导出；批准 09-28 默认规则。

## 1. Diagnosis

**Binding constraint: learning is starved, on both sides of the funnel.**

- *Arrivals cannot read a product change.* Non-owner signups measured 09-08: 0.29/day (7d), 0.43 (14d),
  0.67 (30d), 0.51 (90d) (`.collab/plans/2026-09-03-backlog-decision.md` §9 intro — all § references below
  are to this file unless stated). Exposed-active arrivals ≈0.2/day, so the day-2 rate (base 0.149 over
  active users) is undecidable before ~February 2027 (§9.11, §9.12, §9.13.1); day-4 has a true zero base.
  Every §8.6 criterion is an existence read, and the 09-21 checkpoint that would produce them **was never
  run**: no record dated 09-21+ exists under `.collab/reviews/` except the design/SEO reviews; the kit README
  (`.collab/reviews/2026-09-22-checkpoint-readout/README.md`) records the permission denial.
- *The walls are fixed but unread:* A1/A3 at T_A 09-07, B at T_B 09-09 (§9.20), honest session copy at
  T_copy 09-10 (§9.23), 0.30.1 on 09-13, v0.31/v0.32 on 09-21 — whether any converts is unknown.
- *The one cohort that retains has no path to the differentiator.* 19 non-owner users ever clicked a
  citation (163 clicks); 0 of 19 ever opened the Quote Finder panel, clicked the chip, searched or saved
  (§9.17). The 13 multi-day returners made 75 citation clicks, 0 saves, 0 searches; 8 of 13 returned to the
  *same* document (§9.14). Thesis writers were already the only multi-week retention on 06-12
  (`memory/quote-finder-strategy-2026-06-12.md`). C1's trigger fires on query phrasing; a click never produces
  a phrase (§9.15.6, §9.18.7) — a mechanism, not a statistic.
- *Acquisition has one open door and one closed instrument.* Authority Score 6, three earned links, a
  188-domain disavow uploaded 09-20 — no ranking movement is attributable for weeks
  (`memory/seo-spam-backlinks-2026-09-20.md`). The only ranking cluster is one academic blog post at #62–93;
  the lowest-difficulty keywords in the corpus are zh/es academic and the locale pages exist; legal/finance
  demand is absent from the competitor-gap data (`.collab/reviews/2026-09-20-jev-seo/findings.md` §2, §B).

`[inference]` The constraint is compound: (a) too few arrivals for any wall metric to move; (b) the retained
cohort's behaviour (clicking citations) is invisible to the feature built for it. (a) is answered by the
readout plus acquisition; (b) by putting the feature where the behaviour already is.

**What would change my mind.** From the readout: post-T_A citation clickers who touched Quote Finder ≥ 2 →
C1 reaches them and the bridge drops below acquisition; `checkout_created` ≥ 1 from an own-document in-app
source → the wall is price/value and packaging analysis (not cuts, §9.4) enters the list; day-4 ≥ 1 → read
that user, the batch is what they did (§9.11). From outside: signups ≥ 1.5/day sustained for 14 days (3× the
90-day rate) → product reads become decidable this year and acquisition falls; a new spam-link campaign in
the Semrush anchors → SEO reads stay closed longer.

## 2. Ranked initiatives

The §9.11 default for 09-28 stands: **acquisition unless a thread exists.** Initiative 1 is the one C item
that runs regardless, on the mechanism argument; 2 and 3 are the default's content.

### 2.0 Run the overdue checkpoint readout; decide 09-28 with it in hand

- **Hypothesis.** Every pre-registered row and the historical returner read (§9.11, §9.13.5) are readable
  today from existing data; no new signup is needed for the highest-information reads.
- **Change.** The kit is commit `8eb1da3`, unpushed, on the worktree branch — the owner's main checkout
  does not have it. Claude pushes it to `origin/main` (docs-only, CI-neutral) or the owner runs it from the
  worktree path; then one command from the README. Claude amends the kit first, or as a second pass if the
  owner runs it earlier (only the added rows need re-running): (i) `by_limit` groups only by `reason` ×
  `post_copy`; §9.18.5 requires the demo/own split and §9.19 says pre-T_copy demo `session_limit` chains
  routed to Stripe — split on `metadata_json->>'is_demo'` (emitted by `SessionDropdown.tsx:120` since
  T_copy) and flag rows without the key as demo-contaminated, or a `checkout_created` there reads as the
  purchase wall falling; (ii) add anonymous demo sessions/day since T_A (session rows exist — the 500/doc
  cap counts them, `.claude/rules/backend.md`; IPs only if a column stores them), `share_created` all time,
  and non-owner signups/day since T_A. Then fold the §9.8/§9.11 SQL into
  `backend/scripts/observation_window.py` — day-2 still anchors on `users.created_at` (`:67`, `:178`). No
  deploy: the production image has no `/app/scripts` (§9.13's "ships in the image" is wrong; recorded).
- **Metric.** The readout exists; every §8.6 row has a value; defect triggers evaluated; Fable records
  §9.25 in the backlog document.
- **Cost.** Claude 0.5 day (kit + script fold, syntax-checked on `doctalk_test`); owner 5 min; Fable 0.5 day.
- **Risks.** Not run → 09-28 is decided without data (§5). SQL is syntax-checked, not data-tested; a failing
  section prints and continues.
- **Does NOT.** Touch any product surface; add shown-event instrumentation during the window (§8.6).
- **Claude alone?** Kit, push to `main`, script: yes. Running it: no (production read — owner).

### 2.1 Citation → verified-quote bridge (build now, ship after 09-28)

- **Hypothesis.** Putting "save as a verified quote" where a citation click lands converts the retained
  cohort's existing behaviour into the differentiator's first loop — discovery → save → jump → copy is the
  registered first paid moment (`.collab/plans/2026-06-12-quote-finder-evidence-board.md:138`).
- **Amendment, owned.** §9.18.7 registered this entry point but said "not designed before 09-28", pending
  the read of post-T_A clickers against chip events. Amended: at ≈0.2 active arrivals/day that read is a
  handful of users by 09-28 and cannot decide "0 with clicks > 0" either way; the argument is deterministic
  (a click produces no phrase); building touches no production surface. Shipping waits for 09-28 — not
  because the surface is untouched (0.30.1 shipped inside the window on 09-13 and changed this very evidence
  bar and billing, `.collab/reviews/2026-09-13-production-release/RESULTS.md`) but so that no further
  confound lands before the readout records the baseline, and because the deploy needs the owner and Codex
  anyway. Owner ratifies (§4.3).
- **Change.** (a) Primary: a "Save quote" button in the reader's evidence bar beside "Back to answer"
  (`frontend/src/components/PdfViewer/PdfViewer.tsx:489`, `:505`) — where `citation_clicked` lands
  (`DocumentReaderPageClient.tsx:425`) and it works on touch. Calls the existing
  `saveQuote(documentId, {chunkId, quoteText: citation.focusSnippet, pageHint: citation.page})`
  (`frontend/src/lib/api.ts:432`); the server re-verifies and returns the trust fields
  (`backend/app/api/quotes.py`, `verify_saved_quote`, 422 `QUOTE_NOT_VERIFIABLE`); the toast shows only the
  server's text and a per-kind trust label. 422, or no `focusSnippet` → open `QuoteFinderPanel` with
  `initialTopic` = the cited claim (`QuoteFinderPanel.tsx:37`), never auto-submit (searches are billed).
  Anonymous (demo) → sign-in CTA, as the panel does. (b) Secondary: the same action in
  `frontend/src/components/Chat/CitationPopover.tsx` (a Radix HoverCard — hover-only, never primary).
  (c) Backend, ~10 lines: optional `source` enum on `SaveQuoteRequest` (`quotes.py:445`) written to the
  server-side `quote_saved` event, today hardcoded `source="quote_finder"` (`quotes.py:614`); values
  `quote_finder | citation_evidence_bar | citation_popover`. (d) 11 locales, `tOr` first.
- **Metric (existing analytics).** `quote_saved` with `source in (citation_evidence_bar, citation_popover)`
  ≥ 1 by a non-owner = first adoption ever (base 0, §9.17). Then, post-T_bridge, share of `citation_clicked`
  users with ≥ 1 `quote_saved` (the §9.17 denominator); `quote_finder_panel_opened` with
  `source=citation_evidence_bar` = fallback rate; `auth_modal_opened` with `source=citation_save` for the
  anonymous path. All from `product_events`, same SQL shape as the kit.
- **Cost.** 2 Claude-days + Codex (logic > 30 lines, the save path is trust-critical — mandatory). Ships as
  a version bump, backend-first (`CLAUDE.md`, Deploy).
- **Risks.** `verify_quote` guards (~40 chars / 8 tokens, M1 in the 06-12 memory) send short supporting
  sentences to the fallback — the panel path is not optional. Legacy documents verify as `extracted_text`
  (`pages.content` exists for 11 of 108, M3 gate) — the label must be per-kind (`.claude/rules/frontend.md`,
  Quote Finder UI). Confounds the C1 read → distinct `source`, T_bridge recorded at deploy. Free cap 30
  active — never disable from a cached count.
- **Does NOT.** Auto-submit a billed search; change C1's trigger; add exports/citeproc (M4); ship before 09-28.
- **Claude alone?** Build, tests, Codex rounds: yes. Deploy: no.

### 2.2 Academic long-tail: deepen `/use-cases/students` zh/es — no new page

- **Reversal, owned.** The DRAFT proposed `use-cases/researchers` ×11. Withdrawn: `useCasesStudents.metaTitle`
  is already "面向学生和学术研究者的 AI 论文分析" (zh) and "…para estudiantes y académicos" (es)
  (`frontend/src/i18n/locales/{zh,es}.json`). A sibling would split the one academic cluster the site has;
  Jev's own ruling was consolidate, not add (findings §7).
- **Hypothesis.** The only KD-low keywords in the corpus are zh/es academic — `论文ai` 210/mo KD 8,
  `读论文 ai` 210 KD 17, `文献阅读` 170 KD 20, `学术ai` 480 KD 32, `ia para investigar gratis` 720 KD 20
  (findings §B) — and the SSR locale pages exist. Depth plus internal links on one cluster is the only on-page
  move an AS-6 domain can make.
- **Change.** Slice A (no gate): zh/es h1/subtitle/body of `/use-cases/students` carry 读论文 / 文献阅读 /
  "investigar" naturally; a verified-quote section (page-accurate verbatim quotes, APA — the cohort's need);
  inlinks from `/blog/ai-research-paper-summarizer` (`frontend/content/blog/…md`, links students once today),
  `/features/citations` and the zh/es landing related links; JSON-LD follows the visible copy (parity test).
  Slice B (gated): `useCasesStudents.metaTitle/metaDescription` zh/es — the owner's D4 ruling allows locale
  title changes only "automatic by threshold", blocked on the D2 GSC export
  (`.collab/plans/2026-09-20-jev-seo-design.md` §12); needs that export or an explicit approval (§4.7).
- **Metric.** GSC impressions/clicks for the two URLs at +28 d and Semrush positions for the five keywords
  (owner); in-product `landing_cta_clicked` / `auth_modal_opened` by `path` (`frontend/src/lib/analytics.ts:13`).
  Rankings are unreadable until the disavow settles — a null read at 28 d is uninformative, by design.
- **Cost.** 1 Claude-day; structural tests only (`seo-meta-keys`, `sitemap-routes`, JSON-LD verifier).
- **Risks.** zh/es copy quality (es needs a native check); FAQ/markup parity; no ranking feedback for weeks.
- **Does NOT.** New pages; `ai with unlimited file uploads` (we are not — findings §A); category heads;
  legal/finance research; more blog posts (`memory/topdown-review-2026-08-25.md`).
- **Claude alone?** Slice A: yes (owner frontend push). Slice B: after D2 or approval.

### 2.3 Anonymous upload with demo-grade caps (decide 09-28)

- **Hypothesis.** Evaluation happens on the demo — 148 sessions on three demo documents (08-25 memory); the
  one recent multi-day user held three conversations on the legal demo and ~1 message per own document
  (§9.18.4) — but an anonymous visitor cannot test *their* document (`backend/app/api/documents.py:213`,
  `require_auth`). One anonymous upload with demo caps turns arrivals into evaluations and sign-in into "keep
  this". `[inference]` ChatPDF-class products are no-account; unverified here.
- **Change (shape only; designed after the readout).** Caps 2/IP/24 h, 20 MB, 100 pages, 5 messages, Flash
  forced, no OCR, 24 h TTL with a purge beat, claim-on-sign-in; reuses the demo limiter (`.claude/rules/backend.md`).
- **Metric.** Anonymous uploads/day; claim rate within 24 h; post-claim day-2 against the 0.149 base.
- **Cost.** ~6 Claude-days + 1–2 Codex rounds (abuse, storage, cost) + owner backend deploy.
- **Risks.** Parse/embedding cost per upload; purge correctness (the 2026-08 MinIO loss); privacy copy; it
  changes the funnel's unit — arrival stops meaning signup, the day-2 definition breaks (§9.6.2) — so it must
  not start before the baseline is recorded.
- **Does NOT.** Persist beyond 24 h; indexable share pages; loosen page/byte caps; anonymous URL import (SSRF).
- **Claude alone?** Build: yes. Deploy and env: no.

## 3. Stop / drop

- Design Phases 3–5 — A2 retired 09-21 (`memory/apple-design-direction-2026-09-21.md`); closed.
- Phase 2b remainder (hub restructures, headline grammar) — no readable metric during the disavow window.
- Jev title work (Phase 4 of `2026-09-20-jev-seo-design.md`) — gated on the D2 export that does not exist.
- Quote Finder M4 (citeproc, exports, Zotero) — adoption is 0; 08-25 ruled it out.
- Dormant features (layout translation, extraction, table scan, question templates) — 08-25 counts.
- Pricing and the session cap — a boundary moves on a rate across ≥ 3 users under honest copy (§9.15.7);
  the number 3 stays (§9.18.1); item 4 was dropped, not deferred (§9.21).
- Share-page loop / indexable share pages — out until 09-28 (§9.6.2); `share_created` count is in 2.0.
- New marketing pages, directory listings, manual outreach — the owner only writes code; not planned.
- Any shown-event instrumentation before 09-28 (§8.6).

## 4. Owner decisions

1. **Readout.** Run today (once the kit is on `main` or from the worktree path) / also create a read-only
   Postgres role and allow Claude that URL / neither. *Rec:* run today; and the read-only role (one-time,
   ~15 min) so future readouts stop being owner-gated.
2. **`7478d1d` → `stable`.** Push now / after the release review / hold. *Rec:* after
   `.collab/reviews/2026-09-22-phase2b-deploy/findings-fable.md` reaches a verdict (PENDING at writing);
   frontend-only, no version bump.
3. **Bridge amendment of §9.18.7** (build now, ship after 09-28). Ratify / keep "not before 09-28".
   *Rec:* ratify.
4. **Anonymous upload.** Go after 09-28 / stage (build now) / no. *Rec:* decide on 09-28 with the readout;
   default go unless it yields a stronger thread; do not start building before then.
5. **Web-filter categorization** (deferred 09-03 §1, 09-08 §9.6.0, 09-20 D7). Do / never. Third and last
   ask. *Rec:* do — ~30 min, zero code, nothing substitutes; the ICP sits behind those gateways.
6. **GSC.** Add a Domain property and re-upload the disavow (`memory/seo-spam-backlinks-2026-09-20.md`), one
   baseline export (D2). Do / skip. *Rec:* do — it unblocks D4 and 2.2 slice B.
7. **Students page zh/es search titles** (2.2 slice B). Approve now / wait for D2. *Rec:* approve for
   these two URLs — they rank for nothing today (findings §2), so there is nothing to lose.
8. **09-28 rule.** Ratify: default acquisition unless a thread; the bridge independent of the readout.

## 5. Sequencing through 2026-09-28

- **09-22.** Claude: push the kit commit to `main`; kit amendment (2.0); then bridge slice 1 (§6) on a
  branch off `main`. Owner: readout; `stable` push after 4.2.
- **09-23 (Codex back 05:17 CEST).** Post-hoc Codex on 2a / Night / 2b with the existing briefs. Fable
  reads the readout if it exists → §9.25 checkpoint record; any defect trigger → fixed that day.
- **09-24–25.** Bridge slice 2 (backend `source`, popover, 11 locales) → Codex; 2.2 slice A starts.
- **09-26–27.** Fixes; script fold; 2.2 slice A ready for a frontend push.
- **09-28, readout run.** Apply §9.11 with data: a thread → follow it; none → acquisition = ship 2.2, start
  2.3; the bridge ships in the first backend release after (v0.33.0), T_bridge recorded.
- **09-28, readout not run.** §9.11's default applies without data. No product-wall change on unread data
  (caps, pricing, nudge untouched). The bridge and 2.2 proceed — neither is conditional on the readout. 2.3
  waits until the readout exists: it is the one item that changes the funnel's unit and needs the baseline
  first. The readout stays owed and its defect triggers fire whenever it runs. §9.4's "do not extend past
  09-28" is about waiting for signups; it does not license deciding 2.3 without the baseline.

## 6. First executable slice for Claude

**Slice 1 — "Save quote" in the reader evidence bar. Frontend-only, no deploy, no production access.**

Scope: button in the `PdfViewer.tsx` evidence bar (rendered when `citation` is set, `:489`), handler in
`DocumentReaderPageClient.tsx` (already holds `citationTarget`, `quoteFinderPrefillTopic`, the panel);
`quote_finder_panel_opened` gains `source: 'citation_evidence_bar'` on the fallback (extend the derivation at
`QuoteFinderPanel.tsx:88`); strings via `tOr` (en now, ten locales in slice 2). Branch
`feat/citation-save-bridge` off `main`.

Acceptance criteria:
1. `cd frontend && npm run build` passes; the unit suite passes with the new tests.
2. Test: Save calls `saveQuote` with `{chunkId, quoteText: focusSnippet, pageHint: page}`; the toast renders
   only the server response's text and tier — never the client string.
3. Test: 422 `QUOTE_NOT_VERIFIABLE` → panel opens with `initialTopic` = the claim and `quote_search_submitted`
   is not fired (never auto-submit).
4. Test: no `focusSnippet` → panel path directly, no save call.
5. Test: anonymous / demo → sign-in CTA, no save call; 403 `SAVED_QUOTES_LIMIT_REACHED` → `paywall_opened`
   as `QuoteCardList.tsx:47` does; the button is never disabled from a cached count.
6. Palette: no `gray-*`, no `transition-all`, nothing below 12 px, `dark:` variants for any `*-white/NN`.
7. Golden path on the local stack: upload → chat → click a citation → Save → Saved tab shows "1 of 30".
8. Nothing deployed; no `version.json` change; the backend `source` field is slice 2.

## 7. Data requests

- Answered by the kit (with the 2.0 amendments): every §8.6 row; the §9.8 defect trigger; day-2 / day-4;
  purchase-by-limit split demo/own; Quote Finder among clickers; the historical returner read; refreshed
  intent rates; anonymous demo sessions/day; `share_created`; signups/day since T_A.
- Owner-only: the GSC baseline export and Domain property (D2); Semrush positions for the five zh/es
  keywords; a re-pull of backlink anchors (is the spam still growing?).

## 8. Owner's ruling (2026-09-22 ~09:20 CEST)

The owner accepted every §4 recommendation: "按照 Fable 的推荐继续推进". What that means in practice:

- **4.1** The readout runs today (owner). A read-only role is optional; setup is in `2026-09-22-owner-actions.md`.
- **4.2** `stable` was pushed to `7478d1d` at 07:22:13Z, after Fable's SHIP review.
- **4.3** The §9.18.7 amendment is ratified. The bridge is built now and ships after 09-28.
- **4.4** Anonymous upload is decided on 09-28 with the readout; nothing is built before then.
- **4.5 / 4.6** Web-filter categorization and the GSC Domain property with the D2 export are owner-only. The
  checklist is in `2026-09-22-owner-actions.md`.
- **4.7** The zh/es search titles of `/use-cases/students` are approved; §2.2 slice B is no longer gated.
- **4.8** The 09-28 rule is ratified.

## 9. Readout addendum (2026-09-22, after the 07:45Z run — Fable 5.1)

The readout ran (owner, 07:45Z; raw output at
`.collab/reviews/2026-09-22-checkpoint-readout/readout-0922.txt`). The record is §9.25 of
`.collab/plans/2026-09-03-backlog-decision.md`; this lists only what it changes here.

**Unchanged:** the ranking (2.0 → 2.1 → 2.2 → 2.3), the 09-28 default (acquisition unless a thread), the
bridge's independence from the readout, and the stop list. No §9.11 thread exists: day-4 = 0, non-owner Quote
Finder search = 0 with zero post-T_A citation clickers (C1's reach is untested, not failed), and the
historical returner profile is the 09-08 read in table form — 7 of 10 same-document, shallow, never through
Quote Finder, with 7 of 10 unreadable on `cites` because the instrumentation only persists from 05-07. That
profile is already 2.1; it adds no second hook.

**What moved:**

1. **2.0 is done, with one open item.** Every §8.6 row has a value (§9.25 table). The defect trigger fired —
   5 `checkout_failed` rows since T_A over any user; all authenticated, and at most one can be a non-owner
   (only one authenticated non-owner `startCheckout` call exists since T_A, e8fed11b's). It is **open** until
   the owner runs `defect_checkout_failed.py`; §9.25 holds a decision table keyed to that script's columns,
   with Claude's same-day action per row. **New dated step, 09-22/23:** Claude adds control (a) and read (b)
   from §9.25 to the script before the owner runs it (or as a second pass), then acts on the table that day
   and records the outcome as §9.26. The Purchase row stays provisional until then — a server-side
   `checkout_created` can coexist with a client-side failure for the same click.
2. **§1's "what would change my mind" item 2 fired at the edge of its wording.** e8fed11b reached a checkout
   from `upload_error`/`file_size` — in-app, own work, but the no-document surface — and did not pay.
   Honoured narrowly: read (b) is the "packaging analysis" (what Stripe offered, whether they returned or
   uploaded). No price or cap moves (§9.3 needs C ~ 5; §9.4); no batch. `file_size` is now the limit behind
   both the only sale and the only post-A1 checkout — carried forward as a fact, n = 2 in five months. The
   instrument cannot say how large the file was; recorded as a gap, not fixed during the window.
3. **Zero active non-owner users since T_A** (§9.25 read 1): the 12-MAU base of 09-08 did not return and the
   5 arrivals did not chat, while anonymous demo sessions (34), signups (5) and uploads (3) continued.
   Measured and cross-checked (relation unchanged after 0.30.1; the owner's own 09-13 production chat
   persisted); control (a) closes the residual doubt. Consequences: §1's diagnosis is stronger, not different;
   every wall metric this window was measured on nobody; 2.3's case is stronger; and the bridge's own metric
   has no readers until non-owner activity returns — recorded, not a reason to stop it (it runs on the
   mechanism argument).
4. **One gate on 2.3, consistent with §5's own logic:** it starts on the owner's 09-28 go only if the
   follow-up run has closed the defect trigger and control (a) has not overturned the zero-active read. 2.3
   changes the funnel's unit; it must not start on an open trigger or an unconfirmed baseline. 2.1 and 2.2
   are not gated.
5. **09-28 is still the decision day.** The owner re-runs `readout_0922.py` plus the follow-up that morning
   (5 min); the rows that can move in six days are active users, day-4, Quote Finder and the purchase chain.
   Four instrument caveats for that run are registered spec-only in §9.25 (recovered-attempt success
   signature; owner-exclusion on four lines; `file_size` carries no size; per-user activation beside B1).

## 10. Build status (Claude, 2026-09-22 evening)

The owner asked for the 09-24 items and what follows to be built now, with every review held until later
("审查我们后面再做"). Nothing below is deployed and nothing touches `version.json`.

| Item | Branch @ head | State | Ships |
|---|---|---|---|
| 2.1 bridge, slices 1+2 | `feat/citation-save-bridge` @ `307e334` | built; frontend + backend tests green; the Codex brief covers both slices | v0.33.0 after the review, backend-first; criterion 7 (signed-in golden path) still needs the owner's sign-in on a local stack at head |
| 2.2 slices A+B | `growth/students-academic` @ `67196cf` | built; `npm run build` + 185 unit tests green | frontend-only push on the 09-28 acquisition default; the es copy wants a native pass |
| Free-allowance copy (new) | `fix/free-credit-copy` @ `a179c80` | built; `npm run build` + 183 unit tests green | frontend-only; a correction, not an experiment, so it can ship before or with 2.2 |

- The three branches merge cleanly pairwise, and all three merged together pass 220/220 unit tests.
- **2.2 as built.** A verified-quotes section on `/use-cases/students` in 11 locales: Quote Finder is named the
  way each locale's UI names it, and no locale makes a word-for-word claim. The test's vocabulary now covers
  all eleven locales, which caught a Korean "그대로". Also built: the zh/es hero and helps copy, the approved
  (4.7) zh/es search titles, and sentence-case es headings.
- **2.2 inlinks.** The `/features/citations` use-case cards sent every locale to the English students page;
  that is fixed. Its related links were already localized, and the blog post already links the page.
- **2.2 item not built, on purpose: "the zh/es landing related links".** The Night landing has no
  related-links block, and adding one is a design change to the landing. `EditorialFooter` already links
  `/use-cases/students` through `lh()` on every marketing page, the landing included. Fable and the owner
  decide whether a body link is wanted.
- **Found while building 2.2, fixed on its own branch.** Five translated landing FAQs promised 500 free credits
  a month: zh/ko/es/de/it, and each answer also ships as the home page's FAQPage JSON-LD. So did three
  comparison pages. The backend grants 300 a month; 500 is the one-time signup bonus. ja/ko/it also promised
  "hundreds of questions" where English says "dozens". The test now reads the number from
  `backend/app/core/config.py`.
- **Numeric drift not fixed.** The other en↔locale number differences are omissions and competitor figures,
  not false claims about DocTalk; they are left for a follow-up audit.
- **Bridge deploy note.** The live `SaveQuoteRequest` ignores unknown fields (the Pydantic default), so a
  frontend-first deploy would lose `source` attribution but not break anything. Ship backend-first anyway, so
  T_bridge counts from the first save. Once the bridge is on `main`, every `stable` push is backend-first
  until v0.33.0 is live.
- **Script fold (§5, 09-26–27): deferred to after 09-28**, so that the 09-28 re-run uses the same instrument
  as 09-22 and the two reads are comparable.
- **Owner-only, still open:**
  - run the updated `defect_checkout_failed.py` (gate checks 1–4);
  - web-filter categorization (4.5);
  - the GSC Domain property, disavow re-upload and D2 export (4.6);
  - criterion 7.
