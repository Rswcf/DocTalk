# Codex adversarial review — missing original files (0.34.0, PR #8)

Plan: `.collab/plans/2026-09-27-missing-original-files.md` (Fable). Reviewer: Codex (gpt-5.5, static review, read-only sandbox). Shipped 2026-09-27 as 0.34.0: backend 16:06Z, Vercel 16:09Z, stable 56fd3b6c.

## Round 1 — BLOCKING
1. **BLOCKING — the synthesized `NoSuchKey`.** minio-py 7.2.20 maps every bodyless 404 on an object HEAD to `NoSuchKey`, even when the bucket is missing or misconfigured. A storage misconfiguration would therefore become a permanent 410. → `object_exists` now confirms `_bucket_reachable()` before returning False. Real-SDK tests stub `_http.urlopen` with bodyless 404/200 responses.
2. A transient download failure made intact content unusable (terminal on the first attempt). → The failure is classified: confirmed missing + complete parse → `ready`; confirmed missing otherwise → `DOWNLOAD_FAILED`; anything else → autoretry (`PARSE_FAILED` only on the final attempt).
3. A URL renewal that hit 410 bypassed the fallback. → A shared generation-guarded `markFileMissing` transition is used for renewals too.
4. Overlapping polls could leave an error over the fallback. → Polls are serialized, and the transition clears errors.
5. TextViewer ignored citation targets that arrived before the text. → `pages` is a dependency, and the animation frame is cancelled on cleanup.
6. A 410 is heuristically cacheable. → `Cache-Control: private, no-store`, and fetches use `cache: 'no-store'`.

## Round 2 — NO BLOCKING (4 should-fix, all fixed)
1. Counters could survive an interrupted cleanup. → `chunks_indexed=0` is committed before the vector delete.
2. The missing-file branch hid a translated-PDF preview. → The translated artifact renders; the toggle shows in both views.
3. The presence probe swallowed soft limits. → They propagate (direct or chained).
4. The backfill `LIMIT` was applied before the missing-file filter. → `--limit` counts enqueueable documents.

## Round 3 — NO BLOCKING (1 should-fix, 1 nit, both fixed)
- `?page=N` links (saved quotes) didn't scroll the text view. → Honoured once per document.
- Translate stayed enabled when the original was missing. → Disabled.

## Round 4 — no findings

Verification: 1085 backend unit tests, 136 integration tests in one process, 190 frontend tests, `next build`. The new tests fail on the pre-change code. There was a local isolated golden path. In production, the retired nvidia-10k demo answers 410 and its reader shows the notice plus extracted text.
