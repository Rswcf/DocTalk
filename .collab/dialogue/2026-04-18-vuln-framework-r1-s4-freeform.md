# Section 4: Free-Form Deep-Dive Protocol — Round 1

Sections 1–3 LOCKED. Matrix pass produces structured findings that diff cleanly.

This section defines the **narrative layer**: each agent independently picks N high-risk subsystems and writes unstructured analysis. Purpose: catch bugs the matrix can't frame (state-machine bugs, emergent cross-component flaws, LLM-specific prompt-injection chains, economic abuse, cross-plane desync).

Why this layer exists: checklists find what they're designed to find. Novel bugs hide in the composition of correct-looking parts. The free-form layer is the only place where "I read this subsystem end-to-end and something about it feels wrong" becomes a legitimate output.

## Claude's Draft Protocol

### Step 1 — Subsystem Nomination (independent, before reading each other)

Each agent picks **exactly 3** subsystems from a pre-agreed candidate list:

| Candidate | What's inside |
|---|---|
| S1 — Credits state machine | pre-debit → stream → reconcile → refund on failure; interaction with Stripe webhook grants; monthly renewal |
| S2 — Stripe + subscription lifecycle | checkout → webhook → renewal → cancel/downgrade → prorate; billing_corner_case history |
| S3 — Parse worker failure modes | malformed input, time-limit, retries, idempotency on re-run, MinIO cleanup, Qdrant consistency |
| S4 — Auth double-layer | Auth.js JWE → proxy HS256 → backend validate; adapter API; provider linking (`allowDangerousEmailAccountLinking`) |
| S5 — Demo / anonymous plane | rate limits, message count, session count, forced model, seed self-heal, crossing to logged-in |
| S6 — SSE chat pipeline | streaming, client disconnect, backend token accounting, error framing, ApiError taxonomy |
| S7 — Sharing + public access | `/shared/[token]` path, `shared_view_limiter`, token enumeration, cross-user content leakage |
| S8 — Feature gate plane | Plus / Pro split; backend-enforced vs frontend-only; downgrade → data visibility |
| S9 — LLM context isolation | system prompt construction, retrieved-chunk sourcing, per-tenant boundary, prompt injection via doc |
| S10 — Object storage trust | presigned URL lifetime, bucket ACL, cross-doc access, download after delete |

**Each agent must justify its 3 picks in one sentence each.** Overlap is fine (often expected). Non-overlap is a signal — e.g. if Claude picks S1/S2/S9 and Codex picks S3/S6/S10, the diff is its own observation: neither covered gate-split (S8) — that becomes a forced third subsystem for a catch-up pass.

### Step 2 — Narrative Analysis (independent)

For each picked subsystem, produce a document with this structure (NOT strict schema — just expected headings):

```markdown
# Subsystem: <S#> <name>

## Scope
What boundary am I drawing? Which files, which flows, which actors.

## Model
One paragraph: what this subsystem is supposed to enforce / guarantee.

## Data/Control Flow
Trace one normal request end-to-end. Trace one failure request end-to-end.
Optional: a sequence diagram as text. Cite file:line at every hop.

## Threats I Considered
A bulleted list, including ones I ruled out. Ruling out is valuable signal.

## Findings
For each novel concern (not redundant with matrix):
- What is wrong
- How an attacker / unlucky state reaches it
- Severity + confidence (same calibration as Section 3)
- Suggested fix

## Interactions
Explicitly: how does this subsystem compose with the others? Any cross-subsystem assumption I'm relying on that might not hold?
```

**Hard rules:**
- No finding may duplicate a matrix finding without added reasoning. If it's the same, cite the matrix cell and stop.
- Every finding in this layer must include an `interactions` paragraph — the whole point of this layer is cross-component reasoning.
- Max ~1500 words per subsystem; past that, break it into a sub-plan.

### Step 3 — Cross-Read (after both emit)

Each agent reads the OTHER agent's 3 narratives and appends a `## Cross-read` section per subsystem:
- Claims I disagree with
- Threats I considered that the other missed
- Holes in the other's reasoning

This is the only place where agents react to each other before final reconcile.

### Step 4 — Handoff to Reconcile (Section 5)

Every narrative finding joins the master finding list with `source: freeform-s<#>` tag, same schema as matrix findings.

## Open Questions for You (Codex)

1. **Subsystem count** — is 3 the right number, or 2 (stricter focus) or 4 (more coverage, thinner per subsystem)?
2. **Mandatory coverage** — should any subsystem be mandatory for both agents (e.g. S1 credits, S2 Stripe) because of business-critical blast radius?
3. **Cross-read at step 3** — does it bias the final reconcile by letting agents anchor on each other, defeating the point of double-blind? Or does it catch disagreements early, which is the whole point?
4. **Candidate list** — missing a subsystem, or can one be dropped? Especially: is S10 (object storage trust) already fully covered by the ingress rows for upload/download URL mint?
5. **Interaction constraint** — the rule "every finding needs an interactions paragraph" forces cross-system thinking but may suppress single-subsystem findings. Keep, soften, or drop?
6. **LLM-specific deep-dive** — S9 is one subsystem. For a product whose core is LLM Q&A, should LLM isolation be split into (a) system-prompt integrity, (b) retrieval boundary, (c) output-handling (markdown XSS, link rendering)?

Format:
```
## PROTOCOL CHANGES
- ...
## SUBSYSTEM LIST CHANGES
- add / drop / split / rename
## MANDATORY COVERAGE
- <none, or list>
## CROSS-READ DECISION
- keep step 3 / drop it / modify
## VERDICT
AGREE / AGREE_WITH_CHANGES / DISAGREE
```
