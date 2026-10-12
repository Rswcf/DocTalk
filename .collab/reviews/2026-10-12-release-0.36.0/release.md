# Release 0.36.0 — backend-first, 2026-10-12

Owner approval: "现在发布（推荐）" (2026-10-12). Contents: parse pipeline v3 (margin stamps), v4 (heading rules), in-place demo re-parse, URL-import root-class fix (08e89cac). Frontend: version number only (the all-format highlight and chat-restore fixes were already live).

## Steps and evidence

| Step | Evidence |
|---|---|
| Version bump on main | 8442a92e; `check_version_consistency.py` OK 0.36.0; CI run 38277904548: integration, backend, frontend, docker = success |
| stable fast-forward (main checkout) | stable d3b2b7ef (local) / 8927e588 (origin) → 8442a92e; 0 tracked changes; no `backend/alembic` diff (no migration) |
| Backend deploy | `railway up --detach --service backend` with the project token; deploy 8ff6cabe SUCCESS 16:37Z; previous 0d7e5a6e (0.35.0) is a safe rollback (no migration) |
| Health | `/health` 0.36.0 at 16:37:28Z and 16:38:03Z |
| Region | deployment manifest `multiRegionConfig {"us-west2": {"numReplicas": 1}}`; `railway ssh` refused for a project token (MEMBER role), so `RAILWAY_REPLICA_REGION` was not read in the container |
| Startup logs | alembic ran, celery ready, uvicorn up, no errors; demo re-parse dispatched |
| stable push → Vercel | 8927e588..8442a92e; GitHub deployment status `success` (Production) |

## Production checks

- Demo "Attention Is All You Need" (182c1d7b): before, all 15 pages had section_title `arXiv:1706.03762v7 [cs.CL] 2 Aug 2023`; after, page 1 = "Attention Is All You Need", real section titles ("2 Background", "3 Model Architecture"), 0 stamp titles; DB: parse_version 4, 35/35 chunks indexed, 0 chunks contain the stamp. `pages.content` keeps the stamp on page 1 by design (raw page text for verbatim quote verification; v3 changed only `parse_service.py`).
- All three demo docs at parse_version 4 after the 17:07Z beat tick (alphabet-earnings and court-filing were re-parsed then).
- PPTX test deck (0089131c, 3 slides, LibreOffice-converted): opens in Slides view. Slides view, later bullet → "Exact passage", 2 boxes exactly over the sentence's 2 text-layer lines; slide's first bullet → "Page location only", no mark (title glued to the focus; the text layer has a "•" glyph between them). Text view → "Exact passage" for both.
- DOCX test doc (41bb6407): text view by default, "Exact passage" (checked before the deploy, same frontend).

## Findings (not fixed)

1. Wikipedia URL import fails at fetch: `403 Forbidden for url 'https://198.35.26.224/wiki/Fresnel_lens'`. The same UA (`Mozilla/5.0 (compatible; DocTalk/1.0)`, url_extractor.py:213) pinned to the same IP from a residential connection returns 200, so the block is on the Railway IP plus a generic UA. Only 5 URL imports were ever stored in production; none from Wikipedia. Candidate fix: a Wikimedia-policy User-Agent with contact details.
2. R2 stale connection: after ~30–50 min idle, the first `transfer_client` request on a worker hung exactly 300 s (minio default read timeout) and the retry succeeded at once (17:07Z demo tick 300.7 s; 17:57Z PPTX parse 313.9 s). Pre-existing since 09-27 (this release does not touch storage). The request client (read 10 s) probably stalls 10 s the same way. Candidate fix: TCP keepalive socket options or a shorter read timeout plus GET retries.
3. PPTX Slides view: first bullet of a slide falls back to "Page location only" (see above). Candidate fix in `lib/convertedEvidence.ts`: ignore list-bullet glyphs, or try the focus without its glued slide title.

Test documents 41bb6407 (DOCX) and 0089131c (PPTX) remain in the owner account for the owner to delete.
