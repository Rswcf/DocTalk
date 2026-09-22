# Fable review — Phase 2b deploy gate (57a667a → 7478d1d)

Reviewer: Fable 5.1 (standing in for Codex, rate-limited until 2026-09-23 05:17 CEST).
Written 2026-09-22 08:20–09:05 CEST. Read-only: `git log/show/diff`, file reads, read-only GETs of the
public site and of `gh run list`. No code, config, production or database was touched.
Scope: `git diff 57a667a..7478d1d` (commits `72034cb`, `b8ce177`, `899298e`, `7478d1d`). The worktree
HEAD `8eb1da3` (readout kit, docs only) is NOT part of the candidate and was not reviewed.

## Verdict

**SHIP. No must-fix items. The owner should run `git push origin 7478d1d:stable` now.**

Shipped logic is one line (`preload: false`, `frontend/src/app/layout.tsx:38`) plus eleven locale
values, two guard tests and comments. Every claim in the commit messages and the decision record that
I could test from the repo or the live site held, with one accuracy gap in the decision record's
verification gates (F2) that the checklist in §3 replaces. Three findings (F1 low, F2 record accuracy,
F3 nit); none is a must-fix.

## 1. Findings on the shipped delta (ranked)

### F1 — Low, note only: the lazy Fraunces path in the citation popover is a one-time cosmetic swap

`frontend/src/components/Chat/CitationPopover.tsx:60-72` is the only reader of the face. Verified by
grep over `frontend/src` (`dt-serif|font-fraunces|Fraunces`): the other hits are `globals.css:17`
(the `--dt-serif` definition), `editorial.css:58` (`--ed-display-family: var(--dt-serif)`, which
`.dt-editorial.dt-night` overrides to Geist at `editorial.css:163`), and comments. No `.dt-editorial`
root exists without `dt-night` (grep of class usage: only `LandingPageContent`, `MarketingShell`,
and the mirroring `CookieConsentBanner` / `EdLanguageSelector`). No OG-image route references the
face. Under `:lang(zh|ja|ko|ar|hi)` `--dt-serif` is the Plex Sans stack (`globals.css:22-42`), so
those users never fetch Fraunces at all.

Concrete scenario on first hover per browser session (Latin locales): the quote paints in
`Fraunces Fallback` (next/font's size-adjusted local Times, synthesized oblique; Georgia on devices
without Times), then swaps to Fraunces italic once the ~149 KB latin italic file arrives
(`font-display: swap`, so never invisible). The card is `w-72` (fixed width) with `line-clamp-4`, so
the only possible reflow is the clamp boundary moving by one line (≈21 px at 13.5 px × 1.55); with
`side="top"` floating-ui's ResizeObserver re-anchors the card upward by that amount. That is a
single-frame shift inside a hover card on an authenticated, non-indexed route; hover is not a
"recent input" for CLS, but no field metric that matters reads that surface. Cached afterwards
(immutable `_next/static/media` assets). Not a blocker; not worth code.

Side effect worth knowing: the preload flag is part of the emitted filename
(`next-font-loader/index.js:63`: `[hash]-s.p.woff2` when preloaded, `[hash]-s.woff2` when not), so
the two Fraunces latin URLs change in this build and a returning app user refetches once.

### F2 — Record accuracy: the decision record's gate 2 names a tool that does not exist, and the memory's cache-bypass no longer works

- `decision-claude.md` gate 2 says "`prodverify.py` passes". `git ls-tree -r 7478d1d` has no such file
  (only `frontend/scripts/design-audit/cwvcheck.mjs` and `fontdelay.mjs`). §3 below is curl-only and
  replaces it.
- Memory `deploy-verify-vercel-cache-2026-09-07.md` says `Cache-Control: no-cache` returns the new
  build immediately. Measured today on production (`GET /de`, 08:4x CEST): plain, `Cache-Control:
  no-cache`, `Pragma: no-cache`, both headers, and `?v=<epoch>` ALL return `x-vercel-cache: HIT`,
  `age: 41252–41265`. The header does not bypass the edge; the `age` value does the work instead (see
  §3 step 2). Follow-up for Claude (I am read-only): correct that memory note.
- `/de/` is a `308` to `/de`. A `curl` without `-L` on the trailing-slash form returns an empty body
  and looks like a broken deploy. Use the bare path.

### F3 — Nit, later: redundant whitespace collapse

`frontend/src/app/[locale]/page.tsx:25` still runs `.replace(/\s*\n\s*/g, ' ').trim()`; the helper
path (`lib/marketingLocalePage.tsx:62`) never did, which is exactly why the new test is load-bearing.
Now that the test forbids stored breaks, the landing collapse is dead code that makes the two paths
look different. Remove when next touching the file; not for this release.

### Verified as claimed (so nobody re-checks)

| Claim | How verified |
|---|---|
| `en.landing.metaTitle` is fallback-only | `app/[locale]/layout.tsx:14-17`: `dynamicParams = false` + `generateStaticParams` over `URL_LOCALES` (no `en`) → `/en` is a build-time 404 before `generateMetadata` runs. `i18n/server.ts:85` resolves `messages[key] ?? en[key]`, so the en value is reachable only if a locale lacked the key, which the existing presence test forbids. English `/` keeps `title.absolute` at `app/page.tsx:8`. |
| Exactly 9 rendered lines change (title/og/twitter × ja, de, pt) | Independent simulation: both JSONs via `git show`, passed through the `[locale]/page.tsx` collapse — zh/es/ko/fr/it/ar/hi identical, ja/de/pt differ, no description differs. `landing.metaTitle` occurs exactly once per file (no JSON duplicate-key shadowing). No other reader of `landing.metaTitle` (grep; `HomeJsonLd` follows the hero). `og:title` and `twitter:title` both derive from the same string (`[locale]/page.tsx:28,33`; `lib/seo.ts:126,143`). Live production titles today equal the simulation's "old" values. |
| de/pt are "their own February translations" | `git log -S`: `aedd005` (2026-03-16) removed `"landing.headline": "Chatten Sie mit jedem PDF\nin Sekunden"` from de.json (pt likewise, back to `e6ae7f0` 2026-02-06). The new values are those words without the line break. |
| `preload: false` keeps the `@font-face` | `@next/font/.../google/loader.js:92`: `findFontFilesInCss(decls, preload ? subsets : undefined)` — preload only selects files for the manifest; every declaration is still emitted. `validate-google-font-function-call.js:24-29`: no warning for `preload:false` with `subsets` set. Build probe in the record (italic `var(--dt-serif)` element fetches the face) is consistent with this. |
| New test regex is sound | `tests/seo-meta-keys.test.cjs:74-84`: keys `/\.meta(Title|Description)$/`, values `/\n/`; locale files are flat dotted keys with string values (a non-string would throw, not pass). The `landing-night.test.cjs:102-108` block regex is lazy up to the first `})`, which the declaration does not contain. Both fail in the right direction. |
| CI green on the candidate | `gh run list --branch main`: `7478d1d CI completed success 2026-09-21T22:35:54Z`. CI runs `test:unit`, `lint`, `build` (`.github/workflows/ci.yml:85-87`). |
| Frontend-only, fast-forward | `git diff --stat 57a667a..7478d1d -- backend/ frontend/src/app/api version.json frontend/package*.json frontend/next.config.*` is empty; `git merge-base --is-ancestor 57a667a 7478d1d` succeeds (no force needed). `version.json` and `package.json` both `0.32.0`. |
| Lab tools are inert | `scripts/design-audit/*.mjs` import only `node:child_process`, `node:fs`, `node:os`; outside `src/`, not in any npm script. CHANGELOG is not rendered in-app (grep), so `[Unreleased]` under a 0.32.0 label is invisible to users. |

### What the build and CI cannot catch (accepted)

The SERP effect of three title changes (unmeasurable until the 09-20 disavow settles and traffic
exists; Google re-crawls `/de`, `/pt`, `/ja` on its own schedule). The F1 swap. The edge cache serving
the old HTML for a while after "Ready" (§3 handles it). None of these is changed by waiting.

## 2. On Claude's frontend-only / no-bump decision

**Agree.** The backend, proxy and version delta is empty, so the backend-first rule has nothing to
order and `/health` already confirms the backend this frontend talks to; the precedent is explicit
(`.collab/plans/2026-09-03-backlog-decision.md:1566`: "Frontend-only deploy: `git push origin
stable`, no `railway up` and no version bump"), and redeploying an unchanged backend for a label is
risk without benefit. Waiting ~21 hours for Codex buys down review risk on one config line and eleven
strings, which a one-commit revert (or a Vercel promote of the previous deployment) covers equally
well; it buys nothing on the only unmeasurable outcome, the SERP effect, which is unreadable anyway
until the disavow settles.

## 3. Post-push verification checklist

Before-values below were read from production at 08:3x–08:5x CEST on 2026-09-22 (build `57a667a`).

**0. Push.** In whichever checkout: `git fetch origin && git merge-base --is-ancestor origin/stable 7478d1d && git push origin 7478d1d:stable` (plain fast-forward; no `--force`). Confirm: `git ls-remote origin stable` → `7478d1d…`.

**1. Vercel.** Dashboard → production deployment for `7478d1d` shows "Ready". Note the time and the
deployment URL (`https://<deployment>.vercel.app`).

**2. Edge cache — poll `age`, not headers.**
`curl -sS -o /dev/null -D - https://www.doctalk.site/de | grep -i 'x-vercel-cache\|^age'`
Today: `HIT`, `age ≈ 41,25x` (the entry dates from the v0.32.0 purge). After "Ready", repeat until
`age` is smaller than the seconds since "Ready" (a purge gives `MISS`/`PRERENDER` or a small age).
`Cache-Control: no-cache`, `Pragma` and query strings do NOT bypass (F2). Definitive alternative: run
steps 3–5 against the deployment URL, which never serves the old build (if Deployment Protection is
on, curl gets 401 — use a browser).

**3. Titles** (bare paths; `/de/` is a 308):
`for p in /de /pt /ja /zh /; do curl -sSL https://www.doctalk.site$p | grep -o '<title>[^<]*</title>\|property="og:title" content="[^"]*"\|name="twitter:title" content="[^"]*"'; done`

| Path | Before | After |
|---|---|---|
| `/de` | `Jede Antwort zitiert die genaue Seite. \| DocTalk` | `Chatten Sie mit jedem PDF in Sekunden \| DocTalk` |
| `/pt` | `Cada resposta cita a página exata. \| DocTalk` | `Converse com qualquer PDF em segundos \| DocTalk` |
| `/ja` | `あらゆるPDFと 瞬時にチャット \| DocTalk` (space) | `あらゆるPDFと瞬時にチャット \| DocTalk` |
| `/zh` (control) | `与任何 PDF 即时对话 \| DocTalk` | unchanged |
| `/` (control) | `DocTalk — AI Document Chat with Cited Answers` | unchanged |

On `/de`, `/pt`, `/ja` the `og:title` and `twitter:title` must equal the `<title>`.

**4. Font preloads** (count of `rel="preload" … as="font"` in the HTML):
`for p in / /pricing /ja /auth; do printf "%s " $p; curl -sSL https://www.doctalk.site$p | grep -o 'rel="preload"[^>]*as="font"' | wc -l; done`
Before: `/` 7, `/pricing` 7, `/ja` 7, `/auth` 6. After: 5, 5, 5, 4.

**5. Fraunces declared but not preloaded — the one-shot proof.** next/font names preloaded files
`-s.p.woff2` and non-preloaded ones `-s.woff2`; the family is emitted as `__Fraunces_<hash>`. For
every CSS chunk the page references (all of them, not the first — memory 2026-09-21):
```
for c in $(curl -sSL https://www.doctalk.site/ | grep -o '/_next/static/css/[^"]*\.css' | sort -u); do
  B=$(curl -sS "https://www.doctalk.site$c" | tr -d '\n' | grep -o '@font-face{[^}]*}' | grep 'font-family:__Fraunces')
  printf "%s  fraunces-faces=%s  preloaded=%s\n" "$c" "$(echo "$B" | grep -c .)" "$(echo "$B" | grep -c '\.p\.woff2')"
done
```
Before (chunk `e00b5501b527c129.css`): `fraunces-faces=6 preloaded=2` (latin normal
`26dc4a78…-s.p.woff2` 120,724 B; latin italic `e0f4b1eb…-s.p.woff2` 149,268 B). After: some chunk
reads `fraunces-faces=6 preloaded=0`, and no preloaded font on `/` is 120,724 or 149,268 bytes
(`curl -sSI` each `href` from step 4 and read `content-length`).

**6. Runtime.** Signed in on production, open a chat with citations, hover one: the quote shows
italic serif after a brief fallback; DevTools → Network shows one ~149 KB `.woff2` on the first hover
only, none on load. Optional: `[...document.fonts].map(f=>f.family)` on `/` lists no `__Fraunces`.

**7. Golden path** (CLAUDE.md): login → upload → chat → citation jump; the popover is on that path.

**8. Backend untouched.** `curl -fsS https://backend-production-a62e.up.railway.app/health` still
reports `0.32.0`.

**9. Rollback, if ever needed.** Fastest: Vercel dashboard → promote the `57a667a` deployment
(frontend-only, no migration; leaves `stable` ahead of production until the next push). Git:
`git push origin 57a667a:stable --force-with-lease=stable:7478d1d` (non-fast-forward, hence the lease).

**10. Afterwards.** The main checkout's local `main` and `stable` still point at `57a667a`;
`railway up` packages the main checkout, so `git pull` there before any future backend deploy
(memory `feedback-railway-up-from-worktree.md`). Correct the cache memory note (F2).
