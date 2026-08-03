# Codex M3 round — saved quotes + Evidence Board (adversarial)

M2 reached CONSENSUS-SHIP at `87a724d` (your r6) and shipped as v0.24.0. M3 (plan §8.5 M3 scope: saved-quote CRUD + caps + trust snapshots — the replay acceptance gate and Plus gating are explicitly SEPARATE follow-ups) is complete on main. Scope: `eb140bc..HEAD` excluding the docs-sync commit `ee497f9`.

```
git log --oneline eb140bc..HEAD
git diff eb140bc..HEAD
```

Backend: `saved_quotes` (migrations 0036 + 0037) — server-side re-verification on save (`verify_saved_quote`: client submits ONLY chunk_id + quote_text (+page_hint); ALL trust fields re-derived; fabrication = 422), server-derived quote_hash + UNIQUE(user_id, document_id, quote_hash), idempotent re-save returns existing row with 200 and skips the cap check, FREE cap 30 active rows across documents (delete frees), source_chunk_id ON DELETE SET NULL (reparse survival), snapshot trust fields + §8.1 verification anchors (source_text_hash, quote_start/end from QuoteVerification raw offsets), no re-verification on read (locked by test). Post-review fixes: PATCH MissingGreenlet (UPDATE-flush onupdate expiration → db.refresh; real ASGI+Postgres lifecycle test covers all 5 endpoints), 200-idempotency alignment.
Frontend: Save button on cards (never disabled from cached counts; 403 SAVED_QUOTES_LIMIT_REACHED → PaywallModal), panel Search|Saved tabs (snapshot trust labels, note PATCH-on-blur with revert, delete, jump, copy), /profile Saved Quotes tab (lighter read-only board), caps indicator (plan-gated, "n of 30"), 20 i18n keys ×11 + a11y (aria-label, aria-controls tabpanel wiring).

Internal review (APPROVED) already independently re-ran the trust-boundary, FK-survival, concurrency, and no-reverify tests against real Postgres; live E2E verified save/fabrication-422/idempotent/PATCH/delete plus anchor persistence. Known/accepted (challenge if wrong): triple-duplicated display-limit literal (existing LayoutTranslationDrawer convention); 999 sentinel for Plus/Pro; anchors stored but unused in v1 (future revalidation); DocumentBiblio's latent same-shape onupdate pattern (unused field today, noted).

Attack surfaces: (1) can ANY path forge a saved "verified" row (client fields, stale chunk_id from another doc, page_hint abuse, cross-user)? (2) cap bypass via concurrency/idempotency interplay; (3) note field: injection/size/PII handling; (4) the 5 endpoints' authz (quote ownership vs document access — PATCH/DELETE must be OWNER-only even on shared/demo docs); (5) migration pair 0036+0037 on a busy table; (6) frontend: state leaks across docs/tabs, XSS on note/quote render, i18n truth.

Evidence (audit, don't repeat): 778 unit pass/22 skip, 19 real-Postgres integration pass on isolated scratch DB, ruff + tsc + lint + build clean; live E2E chain green at HEAD.

Report: severity-ranked findings with file:line, overall verdict CONSENSUS-SHIP / REVISE / BLOCK.
