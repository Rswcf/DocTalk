# Deploy decision — Fraunces preload + Phase 2b titles (Claude, 2026-09-22)

This is a decision record, not a review. The owner delegated the call ("你自行地判断和决定，你可以问
Fable 5.1"). The Fable agent asked to review these commits hit the Fable usage limit (HTTP 429)
before reading them, so no stand-in review exists. Codex (the review gate) returns on 2026-09-23 05:17.

**Commits:** `72034cb` (Fraunces `preload: false`, docs, lab tools, guard test), `b8ce177` (records
only), `899298e` (Phase 2b option B: single-line `landing.metaTitle`; de/pt titles back on the PDF
message; guard test).

**Decision: ship now, frontend-only — fast-forward `main` and `stable` to this commit, no version
bump, no Railway deploy.** Codex reviews all three commits post-hoc on 09-23 with the pending 2a and
Night briefs; any finding ships as a follow-up.

Why:
- **Backend-first has nothing to order.** `git diff --stat 57a667a..HEAD -- backend/
  frontend/src/app/api frontend/src/middleware.ts version.json` is empty. The HMAC IP-trust contract
  lives in the proxy and the backend; neither changes.
- **Precedent.** `.collab/plans/2026-09-03-backlog-decision.md` §9 row 3 shipped a frontend-only
  marketing branch "as a separate `git push origin stable` with no version bump".
- **The Codex rule is not triggered.** Shipped logic is one line (`preload: false`); the rest is
  locale data (11 values), comments and ~25 test lines. The lab tools are not shipped code.
- **Verified before shipping.** `npm run build` passes. Unit suite is 180/180. Build metadata vs
  v0.32.0 differs in exactly 9 of 2,496 lines (title/og:title/twitter:title of /ja, /de, /pt). Font
  preloads: 5 on marketing pages and 4 on app pages; the runtime probe shows Fraunces is fetched only
  when used. Production A/B for the preload: phone LCP −175/−204 ms.
- **Rollback is one revert.** No migration and no backend image are involved.
- **Not (ii), v0.32.1.** Bumping `version.json` without a Railway deploy leaves `/health` at 0.32.0.
  Redeploying an unchanged backend (with the region check) for a label is risk without benefit. The
  changelog entries stay under `[Unreleased]` and go out with the next backend release.
- **Not (iii), wait for Codex.** Fable's unfinished strategy outline suggested shipping "after a
  BLOCK-only Codex pass on 09-23". That was a one-line sequencing note written without reading the
  diff, and no project rule requires a pre-deploy review at this size. Waiting about 29 hours buys
  nothing a post-hoc pass does not. The owner shipped v0.32.0 the same way.

**Gates.**
1. CI green on `main`.
2. After the `stable` push, the production checks in Fable's review §3 pass (`findings-fable.md`; the
   `prodverify.py` named here originally was a local scratch script and is not in the repo). Poll the
   `age` header, not no-cache headers, until the edge cache turns over. Expected results:
   - /ja, /de and /pt titles match option B, and /zh, /es, /ko and / are unchanged;
   - 5 font preloads on /, /pricing and /ja, and 4 on /auth;
   - no Fraunces preload anywhere.
3. One `cwvcheck.mjs` on production `/` (phone) confirms only the five fonts download.

**Follow-up for whoever deploys the backend next.** The main checkout's local `main` and `stable`
still point at `57a667a`. `railway up` packages the main checkout, so `git pull` there first.

**Review (added 2026-09-22 08:5x):** Fable's retry of the review found SHIP, with no must-fix items, and agreed with
the frontend-only, no-bump call. `stable` waits on the owner's push; Claude's push was denied by the auto-mode classifier.
