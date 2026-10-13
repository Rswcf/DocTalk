# fix/0.36.1: three production fixes found while verifying 0.36.0 (2026-10-13)

Result: three fixes. Codex gpt-5.5 gave BLOCK in r1 (2 findings, both fixed) and SHIP in r2. Every local check passes. Not deployed at the time of writing.

Branch `fix/0.36.1`, base `8442a92e` (production 0.36.0), merged into main by `f4bf5d6b`. Code commits:

| Commit | Issue | Change |
|---|---|---|
| `74928e53` | 1 | Wikimedia-compliant User-Agent for URL import |
| `4f56fd9f` | 2 | TCP keepalive + `TCP_USER_TIMEOUT` on both storage pools |
| `97d3b544` | 3 | Slide view ignores LibreOffice list bullets (first version) |
| `8bb804eb` | 2 | Codex r1 #2: wording on POST retries; 120 s transfer read timeout |
| `a9db3e1d` | 3 | Codex r1 #1: a bullet is only a text item of nothing but markers |

## Issue 1: Wikipedia import gets 403 from Railway

- Evidence: production logs 403 for `https://198.35.26.224/wiki/Fresnel_lens`. The old UA `Mozilla/5.0 (compatible; DocTalk/1.0)` from a residential IP, pinned with `curl --resolve`, gets 200.
- Cause: Wikimedia refuses a cloud IP that sends a generic UA. Its User-Agent policy asks for `<client>/<version> (<contact>)` and warns against browser-like agents.
- Change: the UA is `DocTalk/<version.json> (https://www.doctalk.site; support@doctalk.site)`. The contact is the one the imprint, contact and about pages publish.
  - No library token: some sites block any `python-` agent.
  - No `bot` token: an import is one fetch that a signed-in user asked for.
  - A missing `version.json` gives `unknown`; it does not fail the import.
- SSRF handling is unchanged: IP pinning, Host/SNI, per-hop re-validation and size caps. Codex verified this in r1 and r2.
- Tests: the UA is pinned on both redirect hops, together with the pinned IP, the Host and the SNI. A second test covers the version source and the missing-file fallback.
- Local check: the new UA got 200 from en.wikipedia.org and 200 from a second site, from a residential IP. That proves nothing about the Railway IP.
- Not implemented (proposals for the owner; no API error code changed):
  1. Add the upstream HTTP status to the security-event reason, for example `url_fetch_http_403`.
  2. Give 403/429 a user-facing detail: "This site refused automated access; download the page and upload the file instead."

## Issue 2: first storage request after idle hangs for the read timeout

- Evidence: on the production worker, two first transfers after 30-50 min idle took 300.7 s (17:07Z demo-refresh beat) and 313.9 s (17:57Z PPTX parse). urllib3 logged `Retrying (Retry(total=4 ...)) after ... ReadTimeoutError`, and the retry then succeeded.
- Cause: the path drops a pooled keep-alive flow silently (no FIN, no RST). urllib3's checkout test cannot see that, so the request goes out on a dead socket.
- Change: both pools set these options:
  - TCP_NODELAY, because `socket_options` replaces urllib3's default list.
  - SO_KEEPALIVE with idle 60 s, interval 10 s, count 3.
  - `TCP_USER_TIMEOUT` 90 s (Linux only).
  - Each option is first tried on a throwaway socket and is left out, with a warning, if the kernel rejects it.
- The transfer pool copies minio-py 7.2.20's own pool, with two differences: the socket options, and a 120 s read timeout instead of 300 s (Codex r1 recommendation). A test pins every other setting against the pool that minio-py builds itself.
- Trade-off: `TCP_USER_TIMEOUT` counts only our own unacknowledged bytes, so it never cuts a slow but live response. The 120 s read timeout is the backstop for a runtime that ignores `TCP_USER_TIMEOUT`. It fails a live R2 body only after 120 s with no bytes.
- POST (multipart create/complete) is not retried by urllib3. An abort there now fails at once, where before it hung first, and Celery autoretry handles it. `allowed_methods` is unchanged.
- Reproduction (`keepalive-repro.py`, `keepalive-repro-run.sh`):
  - Environment: Docker Desktop Linux 6.12.54. The container was the local `redis:7.4.1-alpine` image (no new image pulled), with apk `python3` 3.12.13 and `iptables`; it was removed (`--rm`). urllib3 2.8.0 came from the venv. The real `_candidate_socket_options` source was exec'd.
  - Method: iptables DROP on the flow of one pooled connection. Scaled timings: read timeout 20 s; keepalive 3 s / 1 s / 2, so `TCP_USER_TIMEOUT` was 5 s.
  - Every production option was accepted on AF_INET and on AF_INET6.

| Case | Checkout saw the dead socket | Second request |
|---|---|---|
| A. urllib3 default options, 8 s idle | no | 20.01 s, then a retry (the production pattern) |
| B. new options, 8 s idle | yes | 0.00 s |
| C. new options, flow dies just before reuse | no | 5.42 s (the user timeout fires, then a retry) |

## Issue 3: PPTX slide view never marks a slide's first bullet

- Evidence: the focus is `Drip lines The drip lines in block C ...`, because the slide title is glued on. The converted text layer is `Drip lines | • | The drip lines ... | ...`. Both converted-PDF gates failed: the whole-document uniqueness index and the text-layer match.
- Change: `isListMarkerItem` is true only for a pdf.js item made of nothing but marker glyphs. The markers are the PowerPoint, Word, Impress and Writer defaults, plus the recoded Symbol/Wingdings bullets.
  - The uniqueness index drops such items. PdfViewer keeps each page's items for this; the search text is unchanged.
  - PageWithHighlights reads such a span as spaces of the same length and draws no box for it.
  - The citation text is never changed.
  - This applies only on the converted path (`syntheticBoxes`). `pdfEvidence.ts` is unchanged.
- Codex r1 #1 led to this rule. The first version masked any spaced marker, so a focus without a prose en dash could have matched a page that has one.
- Glued title: it is marked together with the sentence. The mark is the citation's own text, and the slide view has no verified title it could drop. The frontend rules forbid dropping unverified leading text.
- Tests: `frontend/tests/converted-evidence.test.cjs` (10 tests) uses the production span sequence. It covers the bug, uniqueness, match offsets, Codex's counterexample, repeat refusal, the real layout-effect body (4 rects, none for the bullet), the native path unchanged, and the wiring.
- Accepted residual (Codex r2): a prose en dash that pdf.js emits as its own item would count as a bullet. A false mark would also need the PDF and the extractor text to differ exactly there, for example PPTX speaker notes, and the result to be unique in the whole document. Closing it needs item geometry in both gates.

## Tests (local, macOS, Python 3.12 venv from requirements-dev.txt, Node)

| Check | Result |
|---|---|
| `ruff check app/ tests/` | All checks passed |
| `pytest -m "not integration"` | 1190 passed, 138 deselected |
| `SKIP_INTEGRATION=0 pytest -m integration` (local Docker Postgres + MinIO) | 138 passed, at `a9db3e1d` |
| `npm run test:unit` | 360 passed, 0 failed |
| `npm run lint` | clean (ESLint + both i18n checks) |
| `npx tsc --noEmit` | clean |
| `npm run build` | compiled; 426/426 static pages, at `a9db3e1d`; `.next` deleted afterwards |
| `gitleaks` (commit hook) | no leaks, every commit |
| Mutation check (first version, `97d3b544`) | reverting the index change made 3 of its 9 new tests fail |

## Codex

- r1 (gpt-5.5) on `8442a92e..97d3b544`: BLOCK. P1: the spaced en dash allowed a false exact mark. P2: the claim that POSTs are retried was too broad. Fixed in `a9db3e1d` and `8bb804eb`.
- r2 on `8442a92e..a9db3e1d`: SHIP, no findings. Codex could not run git, node or the test suites in its sandbox; it reviewed the diffs and the source.

## Not verified until production

- Issue 1: only the Railway IP proves it. After the deploy, import `https://en.wikipedia.org/wiki/Fresnel_lens` in the app. Expected: a document is created, and the backend log has no `URL fetch failed ... 403`.
- Issue 2: the production check is the first transfer after at least 30 min of idle (demo-refresh beat or a parse). Expected: no `Retrying ... ReadTimeoutError` line, and no 120-300 s task.
  - Also check that the startup log line `Storage connection socket options: [...]` lists six options on Railway.
  - The live socket state (`ss -tno state established '( dport = :443 )'`, expecting `timer:(keepalive,...)`) needs `railway ssh`, which needs the MEMBER role; the project token cannot use it.
  - The reproduction proves the mechanism on a Linux kernel. It does not prove Railway's egress behaviour or that Railway's runtime honours `TCP_USER_TIMEOUT`.
- Issue 3: the node tests use the production span sequence with synthetic geometry. Check in production: open the 3-slide test deck in the slide view, cite the first bullet, and expect "Exact passage" with the title and sentence lines marked.
