# Release 0.36.1 — backend first (2026-10-14)

Result: 0.36.1 is live (stable = main = `2ab55827`). All three fixes pass a production check. The storage fix rests on one
idle sample (below), so the logs stay the longer check.

Owner approval: "CI 绿后发布（推荐）" (2026-10-14). The two URL-import proposals (HTTP status in the security-event
reason, a 403/429 user message) were deferred by the owner: "以后单独做（推荐）".

## Steps

| Step | Evidence |
|---|---|
| Fixes | `fix/0.36.1` (`74928e53`, `4f56fd9f`, `97d3b544`, `8bb804eb`, `a9db3e1d`, records `37bd02cf`), merged by `f4bf5d6b`; summary `df9556a1` (`.collab/reviews/2026-10-13-fixes-0.36.1/summary.md`) |
| Local checks on the merged tree | ruff clean; `pytest -m "not integration"` 1190 passed; `npm run test:unit` 360/360; `tsc --noEmit` clean; lint clean. Integration 138 passed and build 426/426 at `a9db3e1d` (fix agent) |
| CI on `df9556a1` | run `38473927444`: backend, frontend, integration, docker = success |
| Version bump | `2ab55827`: version.json, frontend/package.json, package-lock.json (2 places), CHANGELOG.md, CHANGELOG.zh.md; `check_version_consistency.py` OK 0.36.1 |
| CI on `2ab55827` | run `38529827212`: 4/4 success |
| stable | main checkout: `git checkout stable && git merge --ff-only origin/main` → `2ab55827` |
| Backend | `railway up --detach --service backend` at 07:43:28Z → deployment `a271683d` SUCCESS; no migration |
| Health | 07:46:23Z and 07:46:50Z: `0.36.1`; Railway deployment list: `a271683d` SUCCESS |
| Frontend | `git push origin stable` 07:46:59Z → Vercel production deployment `7059827964` success at 07:49:07Z |
| Main checkout | back on `main` at `2ab55827` |

## Production checks

1. **Wikipedia import (issue 1): pass.** 07:47:28Z, owner account, `POST /api/proxy/api/documents/ingest-url` with
   `https://en.wikipedia.org/wiki/Fresnel_lens` → 202, document `1c31f603` ("Fresnel lens - Wikipedia"). Parsed in
   about 1.5 s: ready, 24 pages, 37/37 chunks indexed. Page 1 text starts "From Wikipedia, the free encyclopedia / A
   Fresnel lens …". The deployment log has no `URL fetch failed`, no 403 and no `Retrying` line.
2. **PPTX slide view, first bullet (issue 3): pass.** Test deck `0089131c`, Slides view, "Citation 1, page 2"
   (Drip lines / The drip lines in block C …) → status "Citation 1 · Page 2 · Exact passage", 4 evidence lines
   (title, then the sentence's three lines), 1 anchor. Geometry at 40 %: bullet glyph box x 360–368, sentence
   371–608, second evidence line 365–608 (it starts in the whitespace item after the bullet); the screenshot shows
   the bullet outside the highlight.
3. **Storage after idle (issue 2):** see the idle test section.
   - Not checkable: the startup line `Storage connection socket options: [...]` is not in the deployment log. It is
     logged at INFO when the module-level `StorageService` is built, before logging is configured, so it is dropped.
     `railway ssh` (to read `ss -tno`) needs the MEMBER role; the project token cannot use it.
   - Indirect evidence: a rejected option is logged at WARNING ("Storage socket option (...) rejected"), which
     Python's last-resort handler prints even without logging configured. The deployment log has no "rejected"
     line, so Railway's kernel accepted every option, `TCP_USER_TIMEOUT` included.

## Idle test (issue 2): pass, one sample

- Idle window: the last storage traffic before the test was the worker transfer at 07:47:28Z (ForkPoolWorker-1) and
  the API `file-url` for `0089131c` at about 07:52Z. The 08:16:09Z `refresh_stale_demo_parses` tick returned 0 in
  0.011 s and touched no storage. The log shows no other upload, import, parse or `file-url` request in between.
- 08:26:16Z, owner account: `ingest-url` of `https://en.wikipedia.org/wiki/Lighthouse` → 202 in 693 ms (the API
  `put_object` on the request pool after about 34 min idle). Document `f957e778` ("Lighthouse - Wikipedia") was ready
  3.4 s after the POST: 29 pages, 28/28 chunks.
- The parse ran on ForkPoolWorker-1, the same child whose transfer pool was last used at 07:47:28Z, so its pooled
  connection had been idle 38.8 min. The log has `Starting parse_document` at 08:26:17.004 and `Cleaned up partial
  data` (after the download) at 08:26:17.235. No `Retrying`, `ReadTimeoutError` or connection-reset line.
- Before the fix (0.36.0, 2026-10-12), both first transfers after 30–50 min idle on this worker stalled about 300 s
  (17:07Z and 17:57Z). This is one sample after the fix. Search the deployment log for
  `Retrying (Retry(total=4` after later idle periods to confirm it holds.

## Left for the owner

- Test documents in the owner account: DOCX `41bb6407`, PPTX `0089131c`, Wikipedia `1c31f603` and `f957e778`. The
  owner deletes them.
- Deferred: the two URL-import proposals above.
