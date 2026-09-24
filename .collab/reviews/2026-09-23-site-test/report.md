# Full-site test — 2026-09-23/24 (Claude)

The owner asked for a hands-on test of every main function ("实地地…全方位的网站的测试"), skipping what had
already been done, and for a check of the 60 s proxy cap. This is the report. Nothing here is deployed; the two
production fixes wait for the owner's go-ahead.

## Method

- **Production** (www.doctalk.site; `stable` = `7478d1d`, backend 0.32.0):
  - anonymous UI through the production deployment URL (same build and backend, no session cookie);
  - read-only signed-in checks in the owner's existing browser session;
  - an HTTP sweep of all 405 sitemap pages;
  - lab Core Web Vitals.
- **Isolated local stack** (branch `feat/document-first-optin`):
  - scratch DB `doctalk_golden`, its own MinIO bucket, Qdrant collection and Redis db; backend :8001, frontend :3000;
  - a local-only session minted for a fixture user (the owner's choice: "本地测试账号");
  - a headless Chrome driven over CDP with real mouse and keyboard input and a screenshot per step;
  - synthetic fixtures written for this test, so no user or third-party documents were uploaded.
- **Evidence layers are kept apart:**
  - UI (DOM and screenshots);
  - HTTP/API;
  - the scratch DB (ledger, jobs, saved quotes);
  - unit and integration tests.

## Findings, most severe first

| id | severity | where | finding | status |
|---|---|---|---|---|
| F15 | **BLOCK** | branch | With a beyond-the-document round in its history (marked "[general knowledge, unverified]" per design 07 §8), the next **grounded** answer copied it: an outside fact plus the marker, with document citations attached. Flash, 8 not-in-document questions: **5/8** with the round vs **0/8** without. A later beyond answer opened with the literal marker 4/4. This fails 07's own gate (review item 7). | fixed `ac249e5`: a grounded answer never sees a beyond round; beyond answers see all turns unmarked. After: **0/8**, **0/4**. Deviation #8, for Fable/Codex |
| F8 | P1 | production | The Arabic desktop reader crashes for everyone ("Panel constraints not found for index 2"). react-resizable-panels 4.6.0 has no RTL support, and only production builds show the crash. | fixed on `fix/arabic-reader-rtl` @`3920a63`; verified on local production builds (3/3 before the merge, 3/3 on the branch after) — **awaiting deploy approval** (frontend-only) |
| F20 | P1 | production | **URL import fails for every Wikipedia article** ("No readable text was found on this page"). Wikipedia's `<html>` class carries `vector-feature-language-in-header-enabled`. `BOILERPLATE_RE` matches "header" at the hyphen, so the whole document was removed as boilerplate. Any site whose `html`/`body`/`main` classes carry such a word fails the same way. Present since `868051f` (2026-05-06). | fixed on `fix/url-import-root-classes` @`da2617e` (off main; html/body/main never boilerplate). The Transformer article now extracts 59 pages and answers with a citation in the UI — **awaiting deploy approval** (backend-only) |
| F16 | P1 | branch | The reader's "Export Markdown" (every plan, rendered in the browser) dropped the beyond label; only the server exports had it. | fixed `9fb96b0` |
| F17 | P1 | branch | "Answer beyond the document" never appeared after an ordinary signed-in answer: the post-answer status stayed on the message and failed the action's gate. | fixed `b294df7` |
| F14 | P2 | production | Quote Finder "Close match" cards can start with stray punctuation and end mid-word (".\nSelf-attention … a representation of the s"). Tier 3 (`aligned`) displays the raw `partial_ratio_alignment` window, with only `.strip()`. It is still a raw source slice, but it cannot be cited as shown. | the pipeline is Codex-consensus-locked, so this is a Fable/Codex item |
| F21 | P2 | production | A citation jump shows **no passage highlight** for MD, DOCX, PPTX, XLSX and URL sources — 5 of 7 input types. The jump lands on a small "Page N" caption. This is the deliberate trade-off I25 (2026-05-20, `TextViewer.tsx`), with inline highlighting deferred. A long DOCX leaves the reader to find the passage. TXT and PDF highlight. | Fable: schedule the deferred remark-plugin highlight? |
| F9 | P2 | production | SSR HTML of all 340 localized pages says `<html lang="en">`; /ar has no `dir="rtl"` before hydration. | needs a root-layout decision |
| F5 | P2 | tests | 52 of 136 integration tests fail when run in one process (pytest-asyncio loop scopes). All pass file by file. CI runs none of them. | spun off as its own task |
| F18 | P3 | production | A Free user clicking the locked "Export PDF"/"Export DOCX" lands directly on Stripe Checkout (Plus, $9.99), never on /billing. | product decision. The local run reached the Stripe **sandbox** page once and entered nothing. Do not run this step against production: it fires `checkout_created` |
| F19 | P3 | production | Compare on Free shows the 60-credit reservation and an enabled button; the Pro requirement appears only after the click (403 → "Document Diff is a Pro workflow."). | — |
| F2 | P3 | production | no `<h1>` on the dashboard or reader | — |
| F3 | P3 | production | /billing's tab title flips to "Pricing — DocTalk" after hydration | — |
| F4 | P3 | production | one reader load fetches the profile ~10× and the balance ~5× (no dedup), each call crossing iad1 → us-west2 | — |
| F10 | P3 | production | error pages show the raw `error.message` (English inside the Arabic UI) | — |
| F11 | P3 | production | suggested-question chips in an RTL pane lack `dir="auto"` | — |
| F12 | P3 | production | `/favicon.ico` 404; `/d/<unknown>` is a soft 404 (200) | — |
| F13 | note | Vercel | `vercel curl` auto-created a Protection Bypass for Automation token while probing | owner: keep or revoke |
| F6 | known | production | sign-in copy "500 starter credits + 300/month" vs the month-one grant | fix staged on `fix/free-credit-copy` |
| F7 | info | infra | Vercel functions run in iad1; the backend is in us-west2 | — |

Environment artefacts, not findings:
- A locally started production build logs Auth.js `UntrustedHost`. On Vercel the host is trusted automatically.
- The fixture's +300 credits were the lazy Free monthly grant; the minted user had no grant timestamp.

## What passed

**Production, anonymous and signed-in (read-only)**
- **HTTP sweep:** all 405 sitemap pages return 200 with title, meta and canonical, exactly one h1 each, 1,220
  JSON-LD blocks that parse, and 0 broken internal links.
- **Landing, demo and sign-in:**
  - landing and the sign-in modal work (Escape closes it and returns focus);
  - /demo streams answers with sources;
  - the demo limit returns 429 on the 6th message;
  - a reload keeps the counter.
- **Answer faithfulness:** not-in-document questions, a false premise and a cross-lingual question all behave.
- **Access control:** anonymous requests for the owner's data return 404/401.
- **Signed-in pages:** the dashboard, profile, billing, collections, reader, the Quote Finder panel and the zh app
  have no raw keys.
- **Tools:** word counter (CJK sentences counted) and reading time.
- **Lab CWV:** mobile LCP 2.7–3.0 s, CLS ≤ 0.02, TBT ≤ 20 ms.

**Fluid compute:** a preview built with `maxDuration = 120` streamed 75 s past the 60 s mark. The 60 s in `route.ts`
is therefore self-imposed; lifting it is Fable's call.

**Signed in, isolated stack**
- **Golden path (10/10):**
  - PDF upload in 6–9 s;
  - an honest "not covered" answer offers "Answer beyond the document";
  - the beyond answer is labelled and tagged while it streams, has no sources, and stays beyond when regenerated;
  - the share preview carries the label;
  - a grounded answer shows the post-answer statuses and its citation jump lands in view;
  - Quote Finder reserves 15, charges 14 and refunds 1, and Save works;
  - a reload keeps the label and the tag.
- **375 px:** no horizontal overflow; a citation switches to the Document tab with the highlight in view.
- **Arabic reader:** labels, tag and action in Arabic; two panes.
- **Ledger:** one row per chat, every row settled; a beyond answer costs 1 credit.
- **Exports:** Markdown, PDF and DOCX each carry one label per beyond answer.
- **Domain Mode (Free, Academic):** grounded answer with citations; beyond works in Academic mode.
- **Collections:**
  - a cross-document answer cites both files;
  - a collection citation opens `/d/<doc>?page=10&highlight=<chunk>` in a new tab, which lands on page 10 with the
    highlight in view.
- **Compare:**
  - gated on Free;
  - on Pro, unrelated documents give "no semantic changes" (60 credits reserved, 10 charged, 50 returned);
  - contract v1 → v2 found all four edits: payment 30 → 45 days, termination removed, confidentiality 3 → 5 years,
    insurance added. They were grouped as Added/Removed/Modified.
- **Pro mode:** first text 3.3 s, done in 15.7 s, 26 citations, both statuses shown.
- **Every format:** the answer is right and cited for each one — DOCX 1936, PPTX 14 March 2027, XLSX 48,500, TXT
  212, MD 20.11. URL import (after F20's fix) answers "Attention Is All You Need".
- **Regression:**
  - branch: backend unit 1103, frontend unit 241, `npm run build`, ruff/tsc/eslint all clean;
  - main + URL fix: backend unit 1050;
  - integration: 136/136 when run file by file.

## Not covered

- a real payment;
- layout-preserving PDF translation (RetainPDF, cost-sensitive);
- question templates;
- the OAuth and magic-link round trip (only the modal);
- real mobile Safari;
- the real-user replay (after 09-28, needs production documents).

## Decisions

For the owner:
1. Deploy `fix/arabic-reader-rtl` (frontend-only): fix → main → stable.
2. Deploy `fix/url-import-root-classes` (backend-only): fix → main → stable, with `railway up` from the main checkout.
3. Keep or revoke the Vercel Protection Bypass token.

For Fable:
- the 60 s cap;
- F9 (SSR lang/dir);
- F14 (quote boundaries);
- F21 (markdown highlight);
- F18 (locked export straight to checkout);
- deviation #8, and whether Copy should carry the beyond label.
