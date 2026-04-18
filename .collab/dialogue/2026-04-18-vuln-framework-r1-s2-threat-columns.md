# Section 2: Threat Categories (Matrix Columns) — Round 1

Claude ↔ Codex vulnerability-hunt framework co-design. Section 1 is LOCKED (attack surface / 24 rows in Matrix A + 8 invariants in Matrix B).

Now: **the columns**. Each cell = `(entry, threat) → one bounded question`. Too few columns = coarse findings. Too many = ritual. The right count is "as many as the DocTalk stack actually surfaces distinct failure modes for."

## Matrix A Columns — Claude's Draft

Rows are externally-triggerable ingress. Proposed threat columns:

| # | Column | One-sentence definition | Typical DocTalk question |
|---|---|---|---|
| C1 | **AuthN bypass** | Can an unauthenticated caller reach the endpoint as if authenticated? | Is the backend route behind `require_auth` / `X-Adapter-Secret` / webhook signature? |
| C2 | **AuthZ / IDOR** | Can an authenticated user access another user's data or escalate? | Does the ownership check use `user_id` from JWT vs path param? |
| C3 | **Injection** | SQL / command / template / log / ORM / header injection on parameters or body. | Is user-controlled string concatenated into raw SQL, `subprocess`, or log strings used by downstream parsers? |
| C4 | **Input validation** | Magic-byte / size / MIME / URL scheme / path-traversal / Unicode normalization. | For uploads + URL ingest + shared-token + contact form: is input shape enforced before any processing? |
| C5 | **SSRF / outbound** | Attacker controls where the server calls. | URL ingest, webhook retries, Stripe `return_url`, IndexNow push, email provider, OpenRouter. |
| C6 | **Rate limit / abuse** | Missing or bypassable limit, demo quota evasion, resource exhaustion via fan-out. | Is the limiter per-user, per-IP, or both? Does it fail-open when Redis drops? |
| C7 | **Idempotency / replay** | Replaying a valid request causes double-effect (credits, subscription grant, webhook). | Stripe webhook idempotency key; magic-link reuse; chat pre-debit retry. |
| C8 | **Secret / token exposure** | Secret in URL, log, error message, response body, git, env dump. | JWT in query string? Error message echoes `AUTH_SECRET`? |
| C9 | **Info disclosure / enumeration** | Stack trace, differentiated 404/403, account enumeration, timing oracle. | Does login error differ between "no user" and "wrong password"? |
| C10 | **Resource exhaustion** | Memory / CPU / DB pool / Celery slot / MinIO bandwidth. | Zip bomb in parse worker? Unbounded URL ingest size? Simultaneous SSE streams per user? |
| C11 | **CSRF / origin** | State-changing endpoint reachable cross-origin without CSRF token or origin check. | JWT in cookie → any POST CSRF? NextAuth CSRF on sign-in? |
| C12 | **Concurrency / TOCTOU** | Two requests race; state check precedes mutation by window. | Credit debit vs concurrent chat; verification-token consume; subscription state vs chat mode. |

**Count: 12 columns.** Not every row × column cell has real content; ~40% will be N/A. That's fine — structured N/A is itself a signal.

## Matrix B Columns — Claude's Draft (building on your proposal)

Rows = 8 system-wide invariants (JWT double-layer, IP trust chain, feature-gate split, seed self-heal, etc.). Proposed failure-mode columns:

| # | Column | One-sentence definition |
|---|---|---|
| D1 | **Bypass** | Invariant doesn't hold in at least one codepath. |
| D2 | **Desync** | Two sides of the invariant (e.g., frontend gate vs backend gate) disagree. |
| D3 | **Secret-rotation break** | Rotating one secret breaks the invariant without obvious error. |
| D4 | **Replay / idempotency** | Replay of the invariant-protected operation re-applies effect. |
| D5 | **Degraded-fallback abuse** | Fallback path (Redis down → in-memory limiter; Qdrant down → re-seed) is itself exploitable. |
| D6 | **Observability blind** | Invariant violation doesn't emit a log / metric / alert — silent breakage. |

**Count: 6 columns.** D6 is new from me — without it the framework can catch bugs but not detect whether the app would know when the invariant broke in prod.

## Your Job

1. **Columns too coarse / too fine?** — e.g. should C3 split into SQL vs command vs log injection? Should C4+C5 merge (both are "untrusted input routing")?
2. **Missing column?** — think: CSP / frame embedding, crypto misuse (weak randomness, timing-unsafe comparison), dependency / supply-chain, TLS / certificate, cache poisoning (CDN, Next.js ISR), OAuth-specific (state tampering, PKCE absence, open redirect via `callbackUrl`), email header injection (we have contact + magic link), prompt injection against the LLM itself (uploaded doc attacks the AI).
3. **Matrix B's D6 (observability blind)** — keep it or drop as out-of-scope?
4. **Is 12 + 6 the right count?** — or should we aim for 8 + 4 and let the free-form layer catch the rest?

Format:
```
## COLUMN CHANGES (A)
- keep / drop / add / split / merge
## COLUMN CHANGES (B)
- ...
## NEW COLUMNS I WANT TO ADD
- name — definition — DocTalk example
## VERDICT
AGREE / AGREE_WITH_CHANGES / DISAGREE
```

Terse. Adversarial. The goal is the smallest set of columns that covers every real DocTalk threat class and produces clean double-blind diffs.
