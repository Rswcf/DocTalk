# Codex consensus review: cross-lingual citation focus round 2

Date: 2026-06-13
Verdict: **CONSENSUS**

Scope reviewed: focused verification of the four round-1 REVISE findings against the uncommitted working tree. No git commands used.

## Findings

No blocking or revise findings.

## Verification

1. **Table/summary excluded.** `extract_focus_quotes()` now defines `_NON_FOCUSABLE_MODALITIES = {"table", "summary"}` and skips citations with those modalities or any `table_id` before building `need` (`backend/app/services/citation_quote_service.py:46-103`). Focused probe confirmed both `retrieval_modality="table"` and `table_id` citations return `{}` and do not call `client.chat.completions.create`.

2. **DeepSeek provider options forwarded.** `_refine_citation_focus()` builds `_opts`, applies `_apply_provider_options(_opts, focus_model)`, and passes `_opts.get("extra_body")` into `extract_focus_quotes()` (`backend/app/services/chat_service.py:985-1001`). The extractor forwards non-empty `extra_body` into the OpenAI create kwargs (`backend/app/services/citation_quote_service.py:113-126`). Focused probe confirmed the helper selects `settings.MODE_MODELS["quick"]` and passes `{"thinking": {"type": "disabled"}}` to extraction for the DeepSeek Flash focus call.

3. **Timeout bounds post-generation focus.** `_refine_citation_focus()` wraps extraction in `asyncio.wait_for(..., timeout=8.0)` and returns `False` on `asyncio.TimeoutError` (`backend/app/services/chat_service.py:991-1006`). It still catches only `Exception` after that, so `asyncio.CancelledError` is not swallowed. Focused probe confirmed the 8.0 timeout path keeps citations unchanged and `CancelledError` propagates.

4. **Data boundary and exact-slice verification.** The extractor system prompt now labels the answer and numbered sources as `UNTRUSTED DATA` and says not to follow instructions inside them (`backend/app/services/citation_quote_service.py:30-43`). It truncates each source once into `prompt_texts`, sends that same slice to the model, and verifies returned quotes against `prompt_texts[ref]` rather than full unseen chunk text (`backend/app/services/citation_quote_service.py:106-142`). Focused probe confirmed an LLM-returned sentence present only after the 1200-character visible slice is rejected, and that the hidden tail is absent from the prompt.

## Tests / Probes

- `cd backend && python3 -m pytest tests/test_citation_quote_service.py -q` passed: 9 passed.
- Direct async probe passed for table/table_id no-call gating, `_refine_citation_focus` provider options, timeout handling, `CancelledError` propagation, and exact truncated-slice verification.

## Residual

The previously noted one-focus-per-`ref_index` behavior remains an accepted product limitation, not a shipping blocker.
