# P1 hygiene — domain_mode backend gate (2026-08-03)

Status: complete, both entry points gated, TDD, two commits. Security-adjacent (per the team lead, will go through Codex).

## The vulnerability

`domain_mode` (`"legal"` | `"academic"`, a chat/extraction prompt overlay) is marketed and UI-gated as a **Plus+** feature — confirmed against `.claude/rules/frontend.md` and `frontend/src/components/Chat/DomainModeSelector.tsx` (`canUse = userPlan === 'plus' || userPlan === 'pro'`; free users are redirected to billing by the UI). The backend accepted the field unconditionally on **two separate entry points**, with zero plan check on either:

1. `app/schemas/chat.py`'s `ChatRequest.domain_mode` → `app/api/chat.py:488` → `chat_service.chat_stream()` → the paid domain-rules prompt overlay applied at `chat_service.py:2039-2058`.
2. `app/api/extractions.py`'s `CreateExtractionRequest.domain_mode` → persisted into the extraction job's `input_scope` and used the same way in extraction prompt construction (`extraction_service.py`).

A free or anonymous user could POST `{"domain_mode": "legal"}` directly to either endpoint and get the paid prompt behavior at no cost — a pure UI-only gate with no backend enforcement.

Confirmed via grep across `app/schemas/` and `app/api/` that these are the **only two** places `domain_mode` is ever accepted as request input; every other hit (`SessionListItem.domain_mode`, `chat.py`'s/`collections.py`'s session-listing code) is a read-only echo of the already-persisted session value, not a new write path. `ContinueRequest` (the chat continuation endpoint) has no `domain_mode` field at all — continuations can't set it directly.

## Fix

Both entry points get the identical gate, placed as the first check after the resource-existence/readiness checks (session/document lookup, `DOCUMENT_PROCESSING`/`DOCUMENT_NOT_READY`) and before any rate-limit or credit-related work — a cheap, deterministic authorization check that should short-circuit before spending effort on anything else:

```python
if body.domain_mode is not None:
    plan = (user.plan or "free").lower() if user is not None else "free"
    if plan not in {"plus", "pro"}:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "DOMAIN_MODE_REQUIRES_PLUS",
                "message": "Legal/Academic domain mode requires a Plus or Pro plan",
                "required_plan": "plus",
            },
        )
```

`domain_mode` omitted (`None`) is completely untouched — this is a conditional gate, not a blanket block on free-plan usage of either endpoint.

### Status code and error-shape decision

Went back and forth on this mid-task (see the conversation trail) — the team lead's follow-up message raised switching to 402 to align with the frontend's `useChatStream`/`PaywallModal` auto-handling of `status === 402`. Research confirmed that mechanism is real (a bare 402 alone, regardless of error code string, routes into the paywall-modal branch and fires `limit_hit`/`paywall_opened` telemetry client-side) — but also found `PaywallModal.tsx`'s `paywallCopy()` has no branch for a new code, so a 402 alone would open the modal with the wrong ("insufficient credits") copy without an accompanying frontend change. The team lead then confirmed the **original 403 / `DOMAIN_MODE_REQUIRES_PLUS` / `required_plan: "plus"` choice was exactly right** and intended — matching the `PLAN_REQUIRED`/`required_plan` convention already used by `question_templates.py`, `tables.py`, and (not coincidentally) `extractions.py`'s own pre-existing `EXTRACTION_LIMIT_REACHED` gate, which uses the identical shape one function above where this fix landed. Shipped as 403, not 402 — noting the 402/PaywallModal path exists as a documented alternative if the team ever wants this to surface as an in-app upgrade prompt instead of a generic error.

### `user is None` handling

`chat.py`'s `chat_stream` allows anonymous access (`get_current_user_optional`), so the gate explicitly treats `user is None` as `plan = "free"`. `extractions.py`'s `create_extraction` requires authentication (`require_auth`) — `user` can never be `None` there in practice — but the same defensive `if user is not None else "free"` ternary is kept for consistency and to stay correct if that dependency ever changes.

## Tests

Both entry points get the same 4-test matrix, following each file's existing conventions (`test_error_taxonomy.py` for chat, `test_extractions_api.py` for extractions — mocked `db`/dependency-override style, no real Postgres needed since this is pure authorization logic with no new schema):

1. **Free plan + `domain_mode` set → 403** `DOMAIN_MODE_REQUIRES_PLUS`, `required_plan == "plus"`.
2. **Anonymous + `domain_mode` set → 403**, same shape (chat only — extractions has no anonymous path to test).
3. **`domain_mode` omitted → reaches the NEXT check**, never the domain_mode gate (regression guard against the gate over-firing and blocking ordinary free-plan usage). Proven by asserting the response is a *different*, deterministic downstream rejection (`RATE_LIMITED` for chat, `EXTRACTION_LIMIT_REACHED` for extractions) rather than just checking "not 403."
4. **Plus plan + `domain_mode` set → reaches the NEXT check**, never the domain_mode 403 (positive proof paid users are unaffected). Chat: mocks `chat_service.chat_stream` to a trivial stream and asserts `200`. Extractions: mocks `debit_credits` to fail and asserts `402 INSUFFICIENT_CREDITS` (mirrors the file's own existing credit-failure test shape).

Both gate conditions (`if body.domain_mode is not None: ... if plan not in {"plus", "pro"}:`) are independently mutation-tested — disabling either gate reproduces the exact vulnerability and the corresponding test catches it.

## Also fixed while in there

- **Documentation gap**: `.claude/rules/frontend.md`'s feature-gating list (Subscriptions & Feature Gating section) enumerated every other backend-gated feature (Custom Instructions, Sessions, Saved quotes) but omitted Domain Mode entirely — added: `Domain Mode (legal/academic chat overlay): Plus+ (backend gated, chat.py's chat_stream — 403 DOMAIN_MODE_REQUIRES_PLUS).`

## Evidence

```
python3 -m pytest -q                                      -> 786 passed / 26 skipped (was 779 before this task)
python3 -m ruff check app/ tests/                          -> clean, both commits
SKIP_INTEGRATION=0 python3 -m pytest -m integration -q     -> 23 passed / 789 deselected (unchanged — no schema touched)
```
`doctalk`'s dev row counts (`users=1, documents=4, alembic_version=1`) reconfirmed unchanged.

**Commits (chronological):**
- `b6da842` — chat.py gate (`chat_stream`), plus the `.claude/rules/frontend.md` doc fix
- `ef7e798` — extractions.py gate (`create_extraction`), same shape, same test matrix
