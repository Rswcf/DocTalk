# DocTalk Vulnerability-Hunt Framework — Design Spec

**Author**: Claude (main) ↔ Codex (adversarial)
**Date**: 2026-04-18
**Status**: DESIGN LOCKED (awaiting user review)
**Supersedes**: `.collab/plans/004-systematic-bug-hunt.md` (prior single-pass design)

---

## 0. Purpose & Mode

A reusable framework for hunting vulnerabilities and high-impact bugs in DocTalk. Runs in **double-blind parallel mode**: Claude and Codex each execute it independently; the diff of their outputs is what exposes blind spots.

**Scope**: security + business correctness + billing/credits integrity + concurrency + cross-plane desync + LLM-specific isolation. Explicitly out of scope: pure perf optimization, code-style cleanup.

**Layers**:
1. **Matrix pass** — structured, cellwise, diffs cleanly.
2. **Free-form deep-dive** — narrative, catches unknown unknowns.
3. **Reconcile** — mechanical diff → user checkpoint → tie-break → fix list.

The framework outputs a prioritized fix list that feeds the existing `.collab/plans/` Claude → Codex adversarial fix loop.

---

## 1. Attack Surface (Matrix A Rows) & Invariants (Matrix B Rows)

### Matrix A — Externally-triggerable ingress (24 rows)

Backend ingress:
1. Auth adapter (`/api/internal/auth/*`) + magic-link consumption — `backend/app/api/auth.py:24`
2. `/api/documents/*` — upload, URL ingest, delete — `documents.py:162,280,616`
3. `/api/chat` SSE — two-stage debit, mode — `chat.py:222,319`
4. `/api/billing/*` — checkout, subscribe, portal — `billing.py:182,210,288`
5. `/api/billing/webhook` — Stripe-signed — `billing.py:1250`
6. Demo anonymous plane — limits, forced model — `chat.py:38`, `rate_limit.py:235`
7. `/api/admin/*` — privileged ops — `admin.py:27`
8. `/api/export/*` — Plus+ gated — `export.py:62`
9. `/api/{search,collections,sharing,chunks,users,credits}` — user CRUD/read
10. Ops endpoints — `/version`, `/health`, `/health?deep=true` (`x-health-secret` gated) — `main.py:189-194`
11. Backend `/api/shared/{token}` — consumed by frontend `/shared/[token]`
12. FastAPI metadata — `/openapi.json`, `/docs`, `/redoc` — `main.py:153`

Async ingress:
13. `parse_worker` (untrusted bytes) — `parse_worker.py:101`
14. `deletion_worker` (internal state) — `deletion_worker.py:11`
15. `cleanup_tasks` (cron) — `cleanup_tasks.py:15`

Object store:
16. Download URL mint + direct MinIO domain — `documents.py:484`, `storage_service.py:116`
17. Upload bootstrap token path — `/api/upload-token` → direct backend upload — `frontend/src/app/api/upload-token/route.ts:15`, `backend/app/api/documents.py:162`

Frontend ingress:
18. `/api/proxy/[...path]` — JWT injection, SSE forward — `frontend/src/app/api/proxy/[...path]/route.ts:46`
19. `/api/auth/[...nextauth]` — provider handlers — `frontend/src/lib/auth.ts:26`
20. OAuth/email callback subpaths — state, PKCE, magic-link consume
21. `/api/indexnow`, `/api/csp-report`, `/api/contact` — frontend-origin APIs
22. Stripe return URL landing (`/billing/success`, `/cancel`, portal return) — `billing.py:201`
23. SEO public surfaces — `robots.ts`, `sitemap.ts`, IndexNow key file
24. `/shared/[token]` SSR fetch path — `frontend/src/app/shared/[token]/page.tsx:8`

### Matrix B — System-wide invariants (8 rows)

1. JWT double-layer consistency (`AUTH_SECRET` JWE + backend HS256 verify)
2. Internal adapter trust (`X-Adapter-Secret` — separate from AUTH_SECRET)
3. IP trust chain (`X-Real-Client-IP` + `X-Proxy-IP-Secret` HMAC) — `rate_limit.py:254`
4. Feature-gate enforcement split (backend: Sessions, Thorough, Custom Instructions; verify Export backend-enforced per `export.py:77`)
5. Seed demo self-heal (Qdrant count detection) — `main.py:135`, `demo_seed.py:64`
6. MinIO bucket lifecycle + SSE-S3 encryption — `storage_service.py:70`
7. No-cookie-in-middleware / no-`await cookies()`-in-layout discipline (preserved even though `middleware.ts` currently absent)
8. Secret rotation coherence (`AUTH_SECRET`, `ADAPTER_SECRET`, `X-Proxy-IP-Secret`, Stripe signing, `x-health-secret`)

---

## 2. Threat Categories (Matrix Columns)

### Matrix A columns (12)

| # | Column | Scope |
|---|---|---|
| C1 | AuthN bypass | Can unauth caller reach endpoint as authenticated? |
| C2 | AuthZ / IDOR | Cross-tenant data access or privilege escalation |
| C3 | Interpreter injection | SQL / command / template / log / header / **XSS / HTML / markdown sinks** |
| C4 | Input validation | Magic-byte / size / MIME / URL scheme / path-traversal / Unicode |
| C5 | SSRF / outbound | Attacker controls where server calls (URL ingest, webhook, IndexNow, email, OpenRouter) |
| C6 | Rate limit / abuse | Missing/bypassable limit, demo quota evasion, fan-out |
| C7 | Idempotency / replay | Replay causes double-effect (webhook, magic-link, credits) |
| C8 | Sensitive exposure / enumeration | Secret leak in URL/log/error + account enumeration + timing oracle |
| C9 | Resource exhaustion | Memory / CPU / DB pool / Celery slot / bandwidth |
| C10 | Browser-flow integrity | CSRF + Origin/Referer + OAuth state/nonce/PKCE + `callbackUrl` open-redirect |
| C11 | Concurrency / TOCTOU | Race between state check and mutation |
| C12 | LLM prompt/context isolation | Untrusted doc/chat content overrides system policy or exfiltrates cross-tenant context |

### Matrix B columns (6)

| # | Column | Scope |
|---|---|---|
| D1 | Bypass | Invariant doesn't hold in some codepath |
| D2 | Desync | Two sides of the invariant disagree |
| D3 | Secret-rotation break | Rotating one secret silently breaks invariant |
| D4 | Replay / idempotency | Invariant-protected op replayable |
| D5 | Fail-open / degraded fallback abuse | Fallback path (Redis/Qdrant down) itself exploitable |
| D6 | Observability blind | Invariant violation emits no log/metric/alert |

---

## 3. Finding Schema & Coverage Manifest

### Finding block (one markdown file per non-clear cell)

```yaml
---
id: A-03-C7-01                   # matrix letter-row-column-seq
matrix: A                         # A or B
agent: claude                     # claude or codex
cell_id: A-03-C7                  # stable join key for diff tooling
row_key: chat_sse                 # enum from matrix-a-rows.yaml
column_key: idempotency_replay    # enum from matrix-a-cols.yaml
finding_key: credit_refund_double_refund_on_retry  # snake_case root cause
severity: P0 | P1 | P2 | P3
confidence: high | medium | low
status: bug | risk | deficiency | clear | unreviewed | not_applicable
invariant_state: held | partial | broken    # Matrix B only
cwe: CWE-352                      # optional, security-relevant only
files: ["path:line", ...]         # may be [] for clear/unreviewed
exploit_preconditions: ["network access", "authenticated free-tier", ...]
---

## Observation
## Impact
## Repro / Evidence
## Suggested Fix
```

For `status: clear` — omit the body; only the coverage manifest entry remains.

### Coverage manifest (`manifest.yaml`)

One entry per (row, col) cell — exhaustive, compact:

```yaml
- cell_id: A-03-C7
  state: finding        # finding | clear | unreviewed | not_applicable
  severity: P1          # only if finding
  confidence: high      # only if finding
  finding_ref: A-03-C7-01
```

### Severity calibration (DocTalk-specific)

- **P0**: cross-tenant data leak/write, auth bypass / account takeover, RCE / secret exfiltration, irreversible multi-user data loss, unbounded payment fraud
- **P1**: exploitable high-impact bug, bounded scope (single-tenant unauthorized action/data access, billing/credit bypass, sustained DoS)
- **P2**: real but limited edge-case impact, recoverable integrity issues, partial metadata leakage, non-default abuse path
- **P3**: hardening / observability deficiencies, low-likelihood low-impact

### Confidence × severity

- Orthogonal — no auto-downgrade
- `low + P0` is allowed but should usually ship as `status: risk` until confirmed
- Every `confidence: low` item must carry explicit verification steps

---

## 4. Free-Form Deep-Dive Protocol

Each agent picks **exactly 3** subsystems with bucket constraints:
- 1 from `{S1 credits, S2 stripe}` — **mandatory billing coverage**
- 1 from `{S3 parse-worker, S6 SSE chat, S9a system-prompt, S9b retrieval boundary, S9c output rendering}` — **mandatory LLM/processing coverage**
- 1 free pick from any remaining

Plus: **combined (Claude ∪ Codex) picks must cover ≥ 5 unique subsystems**. If not, only the free slot is re-picked.

### Candidate list

| ID | Subsystem |
|---|---|
| S1 | Credits state machine (pre-debit → stream → reconcile → refund → monthly renewal) |
| S2 | Stripe + subscription lifecycle |
| S3 | Parse worker failure modes (malformed input, time-limit, retries, idempotency, MinIO/Qdrant consistency) |
| S4 | Auth double-layer (JWE → HS256 → adapter API, provider linking) |
| S5 | Demo / anonymous plane (limits, forced model, seed self-heal, crossing to logged-in) |
| S6 | SSE chat pipeline (stream, disconnect, token accounting, ApiError framing) |
| S7 | Sharing + public access (`/shared/[token]`, limiter, enumeration) |
| S8 | Feature gate plane (Plus/Pro split, backend vs frontend, downgrade → data visibility) |
| S9a | LLM system-prompt integrity and instruction hierarchy |
| S9b | LLM retrieval boundary and tenant/document isolation |
| S9c | LLM output handling/rendering (markdown/link/XSS/UI trust) |
| S10 | Object Storage + Artifact Lifecycle Trust (mint, access, revoke, delete race, shared-link interplay) |

### Narrative structure per subsystem

```markdown
# Subsystem: <S#> <name>
## Scope            — files/flows/actors boundary
## Model            — what it's supposed to enforce
## Data/Control Flow — normal path + failure path, cite file:line each hop
## Threats I Considered  — incl. ones ruled out (ruling out is signal)
## Findings          — novel concerns only (no matrix duplicates)
## Interactions      — cross-subsystem assumptions (or "no material cross-subsystem dependency" if none)
```

Cap: ~1500 words per subsystem. Any finding duplicating a matrix cell must cite the cell and stop (no double-booking).

### Step 3 cross-read discipline

- Step 2 outputs are **frozen** with sha256 + timestamp (`vuln_freeze.py`) before cross-read begins.
- Cross-read annotations are **append-only** to separate files under `crossread/`.
- Only 3 comment types allowed: `disagree`, `missed-threat`, `reasoning-hole`.
- Any new finding surfaced during cross-read is tagged `late-add` and scored separately in reconcile.

---

## 5. Reconcile & Diff Protocol

### Stage 1 — Mechanical normalize

`vuln_validate.py` validates both agents' outputs against the locked schema (enums from matrix YAML). `vuln_reconcile.py` emits `reconcile-raw.yaml` with per-cell records and an `alignment` tag.

### Stage 2 — Triage buckets

Precedence (resolves ambiguity): `unreviewed` beats all → root-cause mismatch → severity mismatch.

| Bucket | Trigger | Action |
|---|---|---|
| CONSENSUS | same finding, severity gap ≤ 1 | auto-promote, take higher severity |
| DIVERGENT SEVERITY | gap ≥ 2 **OR** one side calls P0 and the other doesn't | tie-break |
| DIFFERENT ROOT CAUSE | same cell, different `finding_key` | both promoted (usually both true) |
| BLIND SPOT — CLAUDE | `only_codex` non-clear | Claude re-reviews that cell |
| BLIND SPOT — CODEX | `only_claude` non-clear | Codex re-reviews that cell |
| COVERAGE HOLE | `unreviewed` on either side | must be reviewed before final |
| CLEAR | both clear | audit-kept |

**→ USER CHECKPOINT: Stage 2.** User approves triage buckets before tie-break dispatches.

### Stage 3 — Tie-break

Narrow anonymized prompts to each dissenting agent (the other agent's identity is stripped — only evidence, file paths, line numbers). Max 2 rounds per cell. After 2 rounds of disagreement → user decision with both positions summarized.

### Stage 4 — Composition graph

Run **only on post-tiebreak accepted findings**, isolated from cell-level adjudication. Emits `composition-candidates.yaml` with chained risks (e.g., `finding X + finding Y = cross-tenant data persistence`). Output is candidate, not auto-promoted.

### Stage 5 — Fix list

Output: `.collab/plans/YYYY-MM-DD-vuln-hunt-findings.md` + companion `.yaml` for automation.

Split into:
- `actionable_fixes` — consensus + resolved divergences
- `confirmation_needed` — `low + P0` and similar; same file, different SLA

Each entry: stable ID `VHF-YYYY-MM-DD-NNN`, merged finding block, audit links, empty `resolution:` stub.

**→ USER CHECKPOINT: Stage 5.** User signs off on final plan before fix branches cut.

### Stage 6 — Handoff

Each accepted finding becomes a `.collab/plans/<VHF-ID>.md` task with severity, owner, required tests, and mandatory Claude → Codex adversarial fix review (existing project protocol).

---

## 6. Execution Orchestration

### Artifact layout

```
.collab/vuln-hunt/
  framework.md                          # this spec, canonical reference
  matrix-a-rows.yaml                    # 24 rows (enum)
  matrix-a-cols.yaml                    # 12 cols (enum)
  matrix-b-rows.yaml                    # 8 rows (enum)
  matrix-b-cols.yaml                    # 6 cols (enum)
  subsystems.yaml                       # S1..S10 w/ bucket constraints
  scripts/
    vuln_validate.py
    vuln_freeze.py
    vuln_reconcile.py
    vuln_tie_break_prompt.py
  runs/
    YYYY-MM-DD-HHMM/
      run-state.yaml                    # enforces step ordering
      manifest.yaml                     # git_sha + model + prompt_sha256 + script_version + artifact hashes
      claude/{manifest.yaml, findings/, freeform/, crossread/}
      codex/{same}
      reconcile-raw.yaml
      composition-candidates.yaml
      tie-break/<cell_id>-round<N>.md
```

### Interface

`/vuln-hunt` slash command is the primary entry point; `doctalk-vuln-hunt` skill provides the operator guide.

| Command | Action |
|---|---|
| `/vuln-hunt start` | Creates `runs/<timestamp>/`, Claude does matrix + 3 freeform |
| `/vuln-hunt codex-dispatch` | Codex does matrix + 3 freeform via `codex exec --full-auto` |
| `/vuln-hunt freeze` | sha256 both trees |
| `/vuln-hunt cross-read` | Append-only cross-read annotations |
| `/vuln-hunt reconcile` | `vuln_reconcile.py` → `reconcile-raw.yaml` |
| `/vuln-hunt stage2-checkpoint` | User approves buckets |
| `/vuln-hunt tie-break` | Narrow prompts to resolve divergences |
| `/vuln-hunt compose` | Composition graph on post-tiebreak findings |
| `/vuln-hunt finalize` | Emit final plan + YAML |

`run-state.yaml` enforces transitions: `start → codex-dispatch → freeze → cross-read → reconcile → checkpoint → tie-break → compose → finalize`. Steps cannot be skipped.

### Parallelism policy

v1 = **sequential** (Claude, then Codex) with isolated context — Claude's session cannot read Codex prompts/outputs until freeze. True-parallel deferred to v2 after rate-limit behavior is characterized.

### Time budget (one full run)

| Step | Claude | Codex |
|---|---|---|
| Matrix pass (336 cells) | 100–130 min | 110–140 min |
| Free-form (3 subsystems) | 50–70 min | 55–75 min |
| Cross-read | 20–30 min | 20–30 min |
| Tie-break (per cell per round) | 6–10 min | 6–10 min |

**First full run wall-clock**: ~7–9 hours, typically 2 sessions (matrix day + freeform/reconcile day).

### Safety rails

- No agent attempts exploits against running systems. All findings derive from code reading + reasoning.
- Framework scripts reject file writes outside `.collab/vuln-hunt/runs/`.
- User reviews final plan before any fix branch is cut.

### Cadence & lifecycle

- Baseline **every 8 weeks**, plus ad-hoc before major releases and after auth/billing/parser architecture changes.
- Finding lifecycle: `open → patched (merged) → deployed (stable) → verified_clear (next vuln-hunt)`. Archive only at `verified_clear`.
- Commit messages / PR bodies must reference `VHF-YYYY-MM-DD-NNN` when landing fixes so future runs verify closure.

---

## 7. Implementation Plan (if approved)

Before first run:

1. Scaffold `.collab/vuln-hunt/` with matrix YAML enums + subsystems file (30 min).
2. Implement the four scripts (Python, stdlib only where possible) (~3 hours).
3. Write the `/vuln-hunt` slash command + `doctalk-vuln-hunt` skill guide (~1 hour).
4. Dry-run on a single cell to validate schema + diff tooling (~30 min).

Then: execute first run per Section 6.

---

## 8. Open Items for User Review

1. **Approve this spec** — or request changes (will iterate with Codex again if needed).
2. **Approve user-checkpoint locations** — Stage 2 (bucket triage) + Stage 5 (final plan). Agree or reduce to one?
3. **Approve scope** — security + business correctness + billing + concurrency + LLM isolation. Anything to add/remove before v1?
4. **Approve first-run trigger** — execute framework immediately after this spec is approved, or schedule?

---

## Appendix A — Consensus Log (Claude ↔ Codex Rounds)

| Section | Rounds | Key concession |
|---|---|---|
| 1 Attack surface | 2 | Codex flagged renames (row 5/25/26), 6 missed rows, structural split into Matrix A/B. Claude pushback on Celery + billing consolidation accepted. |
| 2 Threat columns | 1 | C8+C9 merged; C11 broadened; S9 foreshadowed; new `LLM isolation` column added. |
| 3 Schema | 1 | `agent`/`cell_id`/`finding_key` added; `row_key`/`column_key` as enum; coverage manifest pattern; severity calibration locked. |
| 4 Free-form | 1 | S9 split; bucket picks; coverage gate ≥5; append-only cross-read. |
| 5 Reconcile | 1 | Precedence rules; anonymized tie-break; P0-asymmetry; dual user checkpoints. |
| 6 Orchestration | 1 | Timestamped runs; run-state transitions; tooling-first; sequential v1; 8-week cadence. |

Raw dialogue files: `/tmp/vuln-framework/r{1,2}-s{1..6}-*.md` (to be archived to `.collab/dialogue/2026-04-18-vuln-framework-*.md` on approval).
