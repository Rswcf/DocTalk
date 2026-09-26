> Status (2026-09-26, executed by Claude; owner approved "proceed independently and continuously"):
> - **0a done.** The 3 non-document objects are `layout-translations/*` artifacts referenced from `document_jobs.metadata_json`. There are 109 missing files: 102 `storage_key` and 7 `converted_storage_key`, across 67 users, created 2026-02-04 → 06-17. The report is kept locally only.
> - **0b done by another route** (owner chose option A). All 42 objects were copied to the owner's Mac via 15-min presigned GETs and verified by size and SHA-256 against in-container hashes (42/42, 320.1 MB).
> - **0c done without rclone.** `doctalk-pdfs` and `doctalk-ops` were created with wrangler (WNAM). CORS was set: GET/HEAD for www and apex doctalk.site, `https://doctalk-*-yijie-mas-projects.vercel.app` (previews use the prod backend) and localhost:3000. The 42 objects were uploaded from the verified local copy with their content types, then downloaded back and SHA-256 verified (42/42).
> - **0d done.** Qdrant snapshot of `doc_chunks` (16,583 points, v1.16.3, 143.9 MB): its SHA-256 equals Qdrant's checksum. It is stored locally and at `doctalk-ops/qdrant/2026-09-26/`, verified.
> - **Still owner-only:** create the R2 S3 API tokens and put them into Railway variables.

# DocTalk object storage: emergency backup + MinIO → Cloudflare R2

Repo: `/Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/xenodochial-rubin-44d81d` (== origin/main 1187fe8d, version 0.32.0). Claude should save this plan as `.collab/plans/2026-09-26-r2-migration.md` before executing; Codex adversarial review is mandatory for both code releases (CSP is security-adjacent, storage refactor >30 lines).

## Standing rule for the whole plan

**Nobody touches `minio-v2` or `qdrant-v2` in Railway until their data is safely copied.** No variable edits (Railway redeploys on any variable change), no Restart/Redeploy, no volume attach, no `railway up -s minio-v2`. Any of these wipes the overlay filesystem holding the last 39 user files (and 138 MB of vectors). All Phase 0 work is done through the S3/Qdrant APIs from the `backend` container or from the owner's laptop.

## Verified code facts that shape the design

- Three MinIO client construction sites: `backend/app/services/storage_service.py` (`StorageService._new_client`, timeouts, separate `_public_client`), `backend/app/workers/parse_worker.py:67-92` (`_get_minio_client`, `_download_file_bytes`; no tests patch either), `backend/app/services/demo_seed.py:46-62` (`_get_minio_client`; six tests in `backend/tests/test_demo_seed_storage.py` monkeypatch that name, so keep the name). `backend/scripts/replay_cases.py:138` is an offline script.
- Every other storage consumer already goes through `storage_service` (doc_service, layout_translation_service, table_service, biblio_service, deletion_worker, api/documents.py, api/layout_translations.py). Object keys: `documents/{doc_id}/{filename}`, `documents/{doc_id}/converted.pdf`, `layout-translations/{job_id}/{filename}`, and `raw_storage_key` payloads (`backend/app/models/tables.py:1227`, written by `table_service._store_layout_payload`). That is almost certainly what the 3 non-document objects (42 − 39) are.
- The SSE-S3 header attempt in `upload_file` has never succeeded anywhere: prod MinIO has no KMS (falls back), CI/dev Bitnami MinIO has no KMS, and Cloudflare documents `x-amz-server-side-encryption` on PutObject/CreateMultipartUpload as unsupported. `ensure_bucket`'s `set_bucket_encryption` is the same story. Removing both is behaviour-preserving.
- minio-py builds path-style URLs for any non-AWS/non-Aliyun host (`BaseURL.build`, `_virtual_style_flag`), so presigned URLs will be `https://<ACCOUNT_ID>.r2.cloudflarestorage.com/doctalk-pdfs/documents/...`. That single host is what CSP must allow.
- R2 region is `auto` (empty and `us-east-1` alias to it). Passing `region="auto"` to the `Minio` constructor skips minio-py's GetBucketLocation lookup entirely.
- The `secure=True` client path (`cert_reqs="CERT_REQUIRED"`, no `ca_certs`) has never made a real request in production: the internal endpoint is plain http and the https `_public_client` only signs URLs locally. Add `ca_certs=certifi.where()` (certifi is a minio-py dependency) before the first TLS request goes to R2.
- pdf.js loads the presigned URL with `fetch` (`PdfViewer.tsx` passes the URL string; `isValidPdfUrl` only checks the protocol, no host allow-list). So only `connect-src` matters, not `img-src`. Cross-origin fetch means R2 **must** have a CORS policy; MinIO's default `*` CORS is why this works today without one.
- Presigned URLs do not work on R2 custom domains (Cloudflare docs), and doctalk.site DNS is at Namecheap anyway. Use the S3 endpoint; `MINIO_PUBLIC_ENDPOINT` becomes redundant.
- Qdrant: only `parse_worker.py:760-790` writes points (id = `chunk.id`, payload document_id/chunk_index/page_start). There is **no** reindex script. For the 109 file-less documents, the Qdrant vectors plus Postgres chunks are the only retrieval asset left (reparse is impossible). "Re-derivable" means "write a script first, then spend embedding credits" — so a snapshot is worth taking.
- `.railwayignore` excludes `infra/` and `scripts/` (gitignore semantics, so probably `backend/scripts/` too). Assume scripts are not inside the prod image; deliver them via `railway ssh ... sh -c 'echo <b64> | base64 -d | python -'`.

---

## Phase 0 — Protect the 42 objects (today, before any other work)

### 0a. Manifest and DB cross-check (Claude, read-only, no secrets leave the container)

1. `railway ssh -s backend` and run a base64-delivered Python script that imports `app.services.storage_service.storage_service`, iterates `list_objects(bucket, recursive=True)`, streams each object through SHA-256, and prints JSON `[{key, size, etag, last_modified, sha256}]`. 320 MB in-container is trivial.
2. Same channel, against Postgres (DATABASE_URL in env): export `documents(id, user_id, filename, status, created_at, demo_slug, storage_key, converted_storage_key)`, layout-translation artifact keys from the job result JSON (`layout-translations/...`), and every non-null `raw_storage_key`.
3. Claude diffs the two locally: (a) confirm 42 objects, 39 matching document keys, and **name the 3 others**; (b) produce `missing_files.csv` (document rows whose key is not in the manifest) — this is the 109-row report for Owner decision 6.
4. Store the manifest and CSV **only** in a local, non-repo, non-synced folder (they contain user filenames and, in the CSV, user ids/emails).

Evidence: manifest JSON with 42 entries and total size 320.1 MB; CSV row count = 109; the 3 extra objects identified.

### 0b. First durable copy — owner's laptop (Owner, ~15 min)

Owner installs rclone and configures a `minio` remote: `type = s3`, `provider = Minio`, `endpoint = https://minio-v2-production.up.railway.app`, access/secret = the values the backend service uses (`MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` in the Railway dashboard; root creds also work). Claude never sees these.

```
rclone copy minio:doctalk-pdfs ~/Private/doctalk-storage-backup-2026-09-26/doctalk-pdfs -P
rclone check --download minio:doctalk-pdfs ~/Private/doctalk-storage-backup-2026-09-26/doctalk-pdfs
```

Then `shasum -a 256` over the local tree; Claude compares against the manifest (paths and hashes are not secrets). Destination must be on the FileVault-encrypted disk and **not** under iCloud-synced Desktop/Documents, Dropbox, etc. Optionally wrap in an `age`/`gpg`-encrypted tar afterwards.

Why not ETag: minio-py multiparts anything over 5 MiB, so MinIO ETags are composite (`md5-N`) and will not match R2 or local MD5. Size + SHA-256 (or `rclone check --download`) is the completeness proof throughout this plan.

Option B (if the owner prefers not to run rclone): owner adds temporary `R2_ENDPOINT/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY` variables to the **backend** service (this redeploys the stateless backend — harmless) and Claude runs an in-container MinIO→R2 copy. Adds a redeploy and a second env-var set to clean up later; rclone is simpler.

### 0c. Second copy straight to R2 (Owner, after R2 setup below)

```
rclone copy minio:doctalk-pdfs r2:doctalk-pdfs -P --s3-no-check-bucket
rclone check --download minio:doctalk-pdfs r2:doctalk-pdfs
```

S3→S3 preserves `Content-Type` metadata (the local→R2 route would guess from extensions; fine for .pdf, keep S3→S3 anyway). `--s3-no-check-bucket` is needed because an object-scoped token cannot create buckets.

### 0d. Qdrant snapshot (Claude, in-container)

`POST $QDRANT_URL/collections/$QDRANT_COLLECTION/snapshots` (header `api-key` if `QDRANT_API_KEY` set) creates a ~138 MB snapshot on Qdrant's own overlay disk; `GET .../snapshots/<name>` streams it. It becomes durable only when pushed to R2, which needs R2 credentials in the backend container — so do the export at the first moment they exist (cutover day, or earlier under Option B), into the ops bucket (`doctalk-ops/qdrant/<date>-<collection>.snapshot`). Record `points_count` from `GET /collections/<name>` alongside it. Delete the snapshot from Qdrant's disk afterwards. Verify the exact endpoints against the running server version (`GET /` returns it) — also needed for the Qdrant phase below.

Rollback: none needed (read-only). Risks: `railway ssh` output size for the manifest (42 lines, fine); minio-v2 crashing spontaneously during the window (nothing we can do — which is why 0b happens first, today).

---

## R2 setup (Owner in Cloudflare dashboard; Claude supplies exact values)

| Item | Recommendation |
|---|---|
| Buckets | `doctalk-pdfs` (same name as today → `MINIO_BUCKET` and every stored key unchanged) and `doctalk-ops` (Qdrant snapshots, future backups; never presigned by the app) |
| Location hint | `wnam` (Western North America; backend is us-west2). Immutable after creation. No jurisdiction (Postgres/Redis are US-resident anyway; `eu` would buy nothing legally and add latency) |
| Token for the app | R2 API token, **Object Read & Write**, scoped to `doctalk-pdfs` + `doctalk-ops`, no expiry. Owner pastes it only into Railway variables |
| Token for rclone | Separate Object Read & Write token, same two buckets; owner keeps it in rclone config only, revoke after decommission |
| Endpoint | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` for server-side and presigned URLs. No custom domain (presigned URLs unsupported there; DNS not on Cloudflare). No r2.dev public access |
| Encryption | AES-256 at rest, automatic, Cloudflare-managed keys, cannot be disabled (Cloudflare "Data security" reference). This is what the trust page must say |
| CORS (dashboard JSON) | `[{"AllowedOrigins":["https://www.doctalk.site","https://doctalk.site"],"AllowedMethods":["GET","HEAD"],"AllowedHeaders":["Range","If-Match","If-None-Match","If-Modified-Since","If-Unmodified-Since"],"ExposeHeaders":["Content-Length","Content-Range","Accept-Ranges","ETag","Last-Modified"],"MaxAgeSeconds":3600}]`. Add `"https://*.vercel.app"` **if** preview deployments point at the production backend (Owner decision 4). ExposeHeaders lets pdf.js read `Accept-Ranges`/`Content-Length` and range-stream large PDFs instead of downloading whole |
| Cost | Free tier (10 GB, 1M class-A, 10M class-B ops/month, zero egress) covers current usage entirely |

Claude's wrangler OAuth token has no confirmed R2 scope, so CORS/bucket creation stay with the owner (dashboard). Claude verifies afterwards with a read-only `curl -I -H "Origin: https://www.doctalk.site"` against a presigned URL (expect `access-control-allow-origin`).

---

## Release A — provider-agnostic code + CSP (Claude writes, Codex reviews, normal backend-first deploy)

This dissolves the CSP-vs-backend-first conflict: the backend ships with env still pointing at MinIO (behaviour unchanged), the frontend adds the R2 origin as a second allowed host, and the actual switch becomes an env-only cutover with no code deploy. Both stores are allowed by CSP throughout.

### Backend

`backend/app/core/config.py`
- Add `MINIO_REGION: Optional[str] = None` (set `auto` for R2). Update the block comment: "S3-compatible object storage; production = Cloudflare R2, dev/CI = MinIO". Keep `MINIO_*` names (Owner decision 5). Mark `MINIO_PUBLIC_ENDPOINT` as legacy/optional.

`backend/app/services/storage_service.py`
- `StorageService.__init__(..., region: Optional[str] = None)`; `_new_client(host, secure, access_key, secret_key, region)` passes `region=region` to `Minio(...)` and `ca_certs=certifi.where()` to the `PoolManager` when `secure`.
- Delete `SseS3`/`SSEConfig`/`Rule` imports; `upload_file` becomes one `put_object` wrapped in `_storage_unavailable`; delete the KMS fallback branch.
- `ensure_bucket`: `bucket_exists()`; on `S3Error` with code `AccessDenied` (HeadBucket under a bucket-scoped token is unverified) fall back to a one-request list probe (`list_objects(..., extra_query_params={"max-keys": "1"})`, take `next(..., None)`); `make_bucket` only when the bucket is genuinely absent (CI/dev still need this). No encryption config call.
- `health_check`: same list probe instead of `bucket_exists`, so `/health?deep=true` does not depend on HeadBucket permissions.
- Add `object_exists(storage_key) -> bool` (`stat_object`, `NoSuchKey` → False) and a `client` property exposing `_client`.
- Log/exception text: "object storage" instead of "MinIO".

`backend/app/workers/parse_worker.py`: delete `from minio import Minio` and `_get_minio_client`; `_download_file_bytes(bucket, object_key)` keeps its signature and delegates to `storage_service.download_file(object_key)` (one client, one timeout policy, region-aware).

`backend/app/services/demo_seed.py`: keep `_get_minio_client()` as the patch point; body becomes `return storage_service.client`.

`backend/scripts/replay_cases.py:138`: pass `region=os.environ.get("MINIO_REGION")`.

`backend/app/main.py`: keep the `"minio"` component key in deep health for compatibility; change log text only.

New in-container tools (delivered via base64; also committed under `backend/scripts/` for the record): `storage_manifest.py` (Phase 0a script), `storage_smoke.py` (put/stat/get/presign/delete a canary under `_smoke/`, prints the presigned host, and calls the deep-health probes), `missing_files_report.py` (DB keys vs `object_exists` → CSV).

### Tests (`backend/tests/test_storage_service.py`, `backend/tests/test_demo_seed_storage.py`)
- `FakeMinio.__init__` must accept `region` and `http_client`.
- New: R2 endpoint → `secure=True`, `region="auto"`, presigned URL starts with `https://<acct>.r2.cloudflarestorage.com/bucket/`; `upload_file` calls `put_object` with **no** `sse` kwarg; `ensure_bucket`/`health_check` fall back to the list probe on `AccessDenied`; `object_exists` False on `NoSuchKey`, re-raises other codes.
- `test_parse_worker_*` unaffected (nothing patches `_download_file_bytes`); demo-seed tests unchanged because the patched name survives.
- CI: keep `bitnamilegacy/minio` pinned by digest for the `integration` job and `docker-compose.yml` as the S3 stand-in (there is no local R2 S3 emulator; R2-specific behaviour is covered by the unit tests plus the in-container smoke script at cutover). Note in a comment that bitnamilegacy is frozen; revisit later (e.g. Garage/RustFS) — out of scope.

### Frontend

`frontend/next.config.mjs`: add `const OBJECT_STORAGE_ORIGIN = "https://<ACCOUNT_ID>.r2.cloudflarestorage.com";` and append it to `connect-src` in **both** `cspDirectives` and `cspReportOnlyDirectives`. Pin the exact account host — `https://*.r2.cloudflarestorage.com` would let any injected script exfiltrate to an attacker's R2 account. Do not touch `img-src`. Keep `https://*.up.railway.app` (the backend API itself lives there); narrowing it is Owner decision 10, separate commit.

### Docs/version in Release A
`.env.example` (add `MINIO_REGION`, an R2 example block, drop the minio-v2 public endpoint line), `CHANGELOG.md` + `CHANGELOG.zh.md`, version bump to 0.33.0 (`version.json`, `frontend/package.json`, `frontend/package-lock.json` ×2; `python3 scripts/check_version_consistency.py`).

### Verification before deploy
`cd frontend && npm run build`; `cd backend && python3 -m ruff check app/ tests/`; `python3 -m pytest tests/test_storage_service.py tests/test_demo_seed_storage.py tests/test_parse_service.py -v`; `docker compose up -d && SKIP_INTEGRATION=0 python3 -m pytest -m integration -v` (bucket auto-create path still works without the encryption call); local golden path upload → view → citation jump.

### Deploy (normal `/deploy` protocol, from the MAIN checkout on `stable`)
`railway up --detach` → `/health` shows 0.33.0 → `git push origin stable` → Vercel Ready. Post-deploy evidence: upload + PDF pane works on www.doctalk.site (still a Railway presigned URL); response header on any page contains the R2 origin in both CSP headers; Sentry shows no new CSP reports.

Rollback: redeploy previous image (no migrations in this release, so the alembic crash-loop caveat from the deploy skill does not apply); frontend revert is a `stable` revert.

Risks: `certifi` import (present as a minio-py dependency, but pin it in `requirements.txt` explicitly); removing the SSE path changes nothing observable — assert this in review.

---

## Cutover — env flip, no code (Owner flips secrets, Claude verifies)

Window: any low-traffic hour; ~10 minutes of possible upload/parse disruption. With ~zero active users, use a **bracketed sync** instead of a maintenance page or dual-write (Owner decision 11).

1. Owner: `rclone copy minio:doctalk-pdfs r2:doctalk-pdfs --s3-no-check-bucket` (delta; seconds).
2. Owner records current `MINIO_*` values (rollback), then in Railway **backend** variables, as one staged change: `MINIO_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com`, `MINIO_ACCESS_KEY`/`MINIO_SECRET_KEY` = R2 token, `MINIO_REGION=auto`, delete `MINIO_PUBLIC_ENDPOINT`; `MINIO_BUCKET` unchanged. Deploy the staged change (one redeploy).
3. Claude: wait for `/health`; run `storage_smoke.py` in-container (canary round-trip, presigned host is the R2 account host, deep health `minio: ok`); check startup logs for the bucket-ready line and no AccessDenied warnings.
4. Owner: run the rclone copy once more (catches any object written to MinIO during the redeploy), then `rclone check --download minio:doctalk-pdfs r2:doctalk-pdfs`.
5. Claude: rerun `storage_manifest.py` (now against R2) and diff (key, size, sha256) with the Phase 0a manifest — must be identical apart from objects created/deleted in the window. Query `documents WHERE created_at >= <T0>`: any row in `parsing`/`error` whose object exists only in R2 after step 4 gets a reparse.
6. Claude, browser: www.doctalk.site upload → PDF pane renders from `*.r2.cloudflarestorage.com`; DevTools shows the CORS headers and (for a large PDF) 206 range responses; demo doc pane works; a layout-translation download works; deleting a test document removes the R2 object.
7. Claude: push the Qdrant snapshot from 0d to `doctalk-ops` now that credentials exist in the container.

Rollback: restore the recorded `MINIO_*` values (one staged redeploy). Any object uploaded to R2 in between must be rclone-copied back before MinIO serves again — and the rollback target remains the volume-less service, so treat rollback as a last resort with a same-day retry.

Risks: HeadBucket denial (mitigated in Release A); TLS trust (mitigated by `ca_certs`); wrong CORS (symptom: PDF pane "failed to load", console CORS error; fix is dashboard-only, no deploy); presigned URL clock skew (backend clock is NTP-synced on Railway; R2 accepts ±15 min).

---

## Release B — truthful copy and docs (Claude writes, Codex reviews; ship only after cutover so it is never false while live)

- `trust.encryption.rest.detail` in all 11 locales (`frontend/src/i18n/locales/{en,zh,ja,ko,es,de,fr,pt,it,ar,hi}.json`). English source: "Uploaded documents and generated files are stored in Cloudflare R2, which encrypts every object at rest with AES-256 using keys managed by Cloudflare. Encryption is automatic and cannot be switched off, and DocTalk never holds storage encryption keys. Your browser receives a file only through a signed link that expires after five minutes, issued after the backend has checked your access." `trust.encryption.rest.evidence` → "Cloudflare R2 data-security reference · backend/app/api/documents.py · file-url" (upload_file no longer does anything encryption-related). Fix the pre-existing `ar.json` bug where the evidence path is glued onto the end of `rest.detail`. `privacy.section3.content` ("Documents are encrypted at rest using AES-256") becomes true at cutover and needs no change.
- `frontend/content/blog/ai-document-security-privacy.md` (SSE-S3 claim, "Railway (…MinIO…)" infra list), `README.md`/`README.zh.md` (Storage row, infra sentence), `AGENTS.md` + `CLAUDE.md` infra table, `docs/ARCHITECTURE.md` (16 mentions: component table, diagrams, §8 encryption row, deep-health prose, §10 incident note — add the corrected root cause: the 2026-06-19 redeploy of a volume-less minio-v2, not the migration itself) and `docs/ARCHITECTURE.zh.md` (15), `.claude/rules/backend.md` async-safety bullet ("object storage calls MUST use `asyncio.to_thread()`"), `docs/layout-translation-retainpdf.md`, `frontend/public/samples/README.md`.
- Repo cleanup: delete `infra/minio/Dockerfile` (unused by any build; excluded by `.railwayignore`), remove `MINIO_PUBLIC_ENDPOINT` from config/tests (`test_storage_service_uses_public_endpoint_for_presigned_urls` becomes a same-host test), keep `_BLOCKED_PORTS` 9000/9001 in `url_validator.py` (harmless defence).
- Version 0.33.1 + changelogs. Frontend-only plus config cleanup, but follow the normal backend-first order anyway.

Evidence: `npm run build`; a locale-parity check that all 11 files carry the new strings; render `/trust` in two locales.

---

## Decommission minio-v2 (Owner clicks, Claude verifies)

1. Cutover day, after step 6 passes: remove minio-v2's public domain (Railway → service → Networking). Reason beyond hygiene: an archived, unpatched MinIO build is internet-reachable today.
2. Cutover + 7 days with zero `STORAGE_UNAVAILABLE` and a clean manifest diff: owner deletes the `minio-v2` service and the detached `minio-volume`. Local encrypted backup stays per Owner decision 7. Revoke the rclone MinIO credentials (they die with the service).
3. Confirm via Railway GraphQL (read-only) that the service is gone and no variable in `backend` references `minio-v2`.

---

## Qdrant durability (week 2, after R2 is stable)

Recommendation: attach a volume and restore from snapshot (Owner decision 8); the re-embed script remains a documented fallback only.

1. Claude: `GET $QDRANT_URL/` → running version; pin `infra/qdrant/Dockerfile` to that exact tag (it is `qdrant/qdrant:latest`; a rebuild could pull a version outside qdrant-client 1.16.1's support window). Commit.
2. Claude: fresh snapshot → `doctalk-ops`, record `points_count`.
3. Owner: attach `qdrant-volume` (or a new volume) at `/qdrant/storage`, using Railway's **Redeploy** of the existing deployment (reuses the built image; do **not** `railway up`, which would rebuild). This wipes the overlay data — expected.
4. Claude, immediately: generate a 1-hour presigned URL for the snapshot from the backend container and call `PUT /collections/<name>/snapshots/recover` with `{"location": "<url>", "priority": "snapshot"}` (verify endpoint shape against the running version). Do not restart the backend in the gap (`ensure_collection` would create an empty collection and demo self-heal would start re-seeding; recover replaces the collection anyway, but avoid the noise).
5. Verify `points_count` matches step 2, `/health?deep=true` `qdrant: ok`, a chat query on a pre-June document returns citations, `/proc/mounts` in qdrant-v2 shows the volume at `/qdrant/storage`.
6. Owner deletes the remaining detached `qdrant-volume-xhbe`.

Rollback: if recover fails, the collection is empty; backend keeps working for lexical retrieval; fix and re-run recover (snapshot is in R2). Ultimate fallback: a ~100-line script that re-embeds `chunks.text` per document via `embedding_service.embed_texts` and upserts with `id = chunk.id` (mirrors `parse_worker.py:760-790`), costing embedding credits.

---

## Owner decisions (with recommendations)

1. Bucket name/hint/jurisdiction → `doctalk-pdfs`, `wnam`, none.
2. Second bucket `doctalk-ops` for snapshots/backups → yes; same token scope.
3. Token model → two Object Read & Write tokens scoped to the two buckets (app, rclone); no admin token in Railway.
4. CORS origins → `https://www.doctalk.site`, `https://doctalk.site`; add `https://*.vercel.app` if previews use the prod backend (confirm; CORS is not the security boundary, the 5-minute signature is).
5. Env var names → keep `MINIO_*` now, add `MINIO_REGION`; rename to `OBJECT_STORAGE_*` later as a separate mechanical commit if desired.
6. 109 file-less documents → report-only CSV now; UX follow-up (HEAD-check in `file-url` returning a `FILE_MISSING` message, reparse disabled) is a separate decision; possible user notification is yours.
7. Local backup retention → keep the encrypted local copy at least 30 days after decommission, ideally until a scheduled R2→`doctalk-ops` backup exists (R2 has no versioning per the docs; a user-initiated delete is final).
8. Qdrant → volume + snapshot restore (recommended) over re-embed.
9. Decommission timing → domain removal at cutover+0, service deletion at +7 days.
10. Optional hardening → narrow CSP `https://*.up.railway.app` to the exact backend host; separate commit.
11. Cutover mode → bracketed sync (recommended) rather than a maintenance banner or dual-write.
12. Trust/privacy → adopt the R2 copy above; decide whether the trust page should also name Cloudflare as a sub-processor (recommended: yes, one clause).

## Facts to re-verify or correct

- The 42 − 39 = 3 unexplained objects: expected to be `layout-translations/*` or `raw_storage_key` payloads; Phase 0a names them. Copy them regardless.
- `privacy.section3.content` also claims AES-256 at rest — false today, true after cutover. Not in the brief.
- Fact 5 nuance: only `connect-src` is load-bearing for the PDF pane; `img-src`'s Railway wildcard is not used by it. `MINIO_SECURE` also exists in config (scheme-less endpoints only).
- Fact 6 ("Qdrant re-derivable"): true in principle, but no reindex code exists, and for the 109 file-less docs the vectors are irreplaceable without it. Treat the snapshot as required, not optional.
- Fact 3: Restart/Redeploy reuse the built image, but anything that triggers a *build* (new `railway up`, changed Dockerfile) fails because `minio/minio:latest` is unpullable. Same trap applies to `qdrant/qdrant:latest` in `infra/qdrant/Dockerfile` — pin before any rebuild.
- Unverified: HeadBucket permission under a bucket-scoped Object R&W token (designed around); whether qdrant-v2 has a public domain (changes snapshot export options); whether Vercel previews hit the prod backend; which MinIO credentials the backend uses (root or separate — either works for rclone); whether `backend/scripts/` is inside the prod image (`.railwayignore` `scripts/` pattern) — default to base64 delivery.
- Whether an ON_FAILURE restart wipes the overlay is stated as fact; do not test it — assume yes.

### Critical Files for Implementation
- /Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/xenodochial-rubin-44d81d/backend/app/services/storage_service.py
- /Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/xenodochial-rubin-44d81d/backend/app/core/config.py
- /Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/xenodochial-rubin-44d81d/backend/app/workers/parse_worker.py
- /Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/xenodochial-rubin-44d81d/frontend/next.config.mjs
- /Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/xenodochial-rubin-44d81d/frontend/src/i18n/locales/en.json (plus the other 10 locale files for `trust.encryption.rest.*`)

Also touched: `backend/app/services/demo_seed.py`, `backend/tests/test_storage_service.py`, `backend/app/main.py`, `infra/minio/Dockerfile` (delete), `infra/qdrant/Dockerfile` (pin), `docs/ARCHITECTURE.md` / `docs/ARCHITECTURE.zh.md`, `README.md`, `AGENTS.md`, `CLAUDE.md`, `.env.example`, `frontend/content/blog/ai-document-security-privacy.md`.