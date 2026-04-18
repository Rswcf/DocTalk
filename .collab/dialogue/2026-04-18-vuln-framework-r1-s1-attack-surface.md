# Role & Context

You are acting as Codex, the adversarial reviewer in a Claude ↔ Codex co-design session. We are designing a systematic vulnerability-hunting framework for DocTalk (this repo). The framework will then be run in **double-blind parallel mode**: Claude and Codex each independently execute it, and the diff of findings is what exposes blind spots.

The framework has this shape (already agreed):

- **Matrix layer**: `entry-point × threat-category` grid. Each cell is a bounded yes/no question. Output is structured `{entry, category, finding, severity, evidence, repro}`.
- **Free-form layer**: each agent picks 3 highest-risk subsystems and writes narrative analysis (catches unknown unknowns).
- **Reconcile**: diff structured findings; cross-read narrative; merge into a prioritized list, then into `.collab/plans/`.

This request is about **Section 1 only: the rows of the matrix (attack surface / entry-point inventory)**. Columns (threat categories) come next.

# Claude's Draft (v1) — Entry Point Inventory

## Backend (FastAPI, under `/api/*`)
1. `auth.py` — Auth.js internal adapter callbacks + magic-link token consumption
2. `documents.py` — upload (magic-byte validation), URL ingest (SSRF surface), delete
3. `chat.py` — SSE stream, credits two-stage debit, mode selection
4. `billing.py` — Stripe checkout / portal / credit-pack purchase
5. `webhooks/stripe` — `checkout.session.completed`, `invoice.payment_succeeded`
6. Demo flow (anonymous 5-msg/session, 500 sessions/doc, 10 req/min/IP, forced DeepSeek)
7. `/internal/*` — `X-Adapter-Secret` guarded adapter API
8. `credits.py` — balance read, ledger write
9. `admin.py` — privileged ops (if authz leaks here, blast radius is max)
10. `export.py` — Plus+ gated, generates downloadables (path traversal? quota?)
11. `search.py`, `collections.py`, `sharing.py`, `chunks.py`, `users.py` — CRUD surfaces

## Celery workers
12. `parse_worker` (queue `parse`) — PDF/DOCX/PPTX/XLSX/TXT/MD parsing, 600s limit, 2 retries
13. `deletion_worker` — async deletion (could leave orphans if partial failure)
14. `cleanup_tasks` — scheduled cleanup

## MinIO / object storage
15. Pre-signed upload URLs (`/api/upload-token` on frontend generates them)
16. Pre-signed download URLs
17. Bucket lifecycle & SSE-S3 encryption

## Frontend (Next.js)
18. `/api/proxy/[...path]/route.ts` — JWT injection (JWE → HS256), SSE forwarding, `maxDuration=60`, body via `arrayBuffer()`
19. `/api/auth/[...nextauth]/route.ts` — Auth.js handlers (Google / Microsoft / email magic link, `allowDangerousEmailAccountLinking`)
20. `/api/upload-token/route.ts` — pre-signed URL minting (scope / TTL / abuse prevention)
21. `/api/indexnow/route.ts` — IndexNow SEO push (potential SSRF / quota abuse)
22. `/api/csp-report/route.ts` — CSP violation receiver (log-injection sink, DoS amplifier)
23. `/api/contact/route.ts` — contact form (spam, injection, email-header forgery)
24. `middleware.ts` — locale detection (must NOT set cookies — already encoded rule)

## Cross-cutting trust boundaries
25. JWT double-layer (`AUTH_SECRET` JWE → `ADAPTER_SECRET` HS256 consistency)
26. HMAC-signed IP trust chain (`X-Real-IP`, `X-Forwarded-For` validation)
27. Feature-gate enforcement split (backend-enforced: Sessions, Custom Instructions, Thorough-mode; frontend-gated: Export — is this intentional or a gap?)
28. Seed demo docs self-healing (detects Qdrant data loss → re-seed; what if attacker triggers repeatedly?)

# Your Job

1. **Verify each entry exists** — you can read the codebase at `-C` root. For anything fictional, flag it.
2. **Propose additions** — what did I miss? Think about: Next.js server actions, webhook re-entry, Railway/Vercel platform entries, DNS/email entries, 3rd-party callback URLs (Stripe return_url, OAuth redirect_uri), sitemap/robots, file-download direct MinIO URLs, logging sinks, health/metrics endpoints.
3. **Propose consolidations** — any rows too granular (e.g. should `sharing.py` + `collections.py` collapse)?
4. **Propose removals** — any "entry point" that's actually a consequence of another (e.g. is `credits.py` really an entry, or is it only reached via `chat.py`)?
5. **Challenge the cross-cutting row format** — rows 25–28 aren't entry points; they are system-wide invariants. Should they live in a separate section? Or become their own matrix with different columns?

# Response Format

```
## VERIFY
- [row N] — EXISTS / MISSING / RENAMED_TO: <path>

## ADD
- [new row] <name> — <path / description> — <why it matters>

## CONSOLIDATE
- rows X+Y → <merged name> — <reason>

## REMOVE
- row N — <reason>

## STRUCTURAL
- <your proposal for cross-cutting rows 25–28>

## VERDICT
- One of: AGREE / AGREE_WITH_CHANGES / DISAGREE
- If DISAGREE, one-paragraph counterproposal.
```

Be terse, be specific, cite file paths with line numbers where relevant. This is adversarial — your job is to find what's wrong, not to be agreeable.
