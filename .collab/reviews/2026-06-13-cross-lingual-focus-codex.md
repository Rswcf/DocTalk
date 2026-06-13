# Codex adversarial review: cross-lingual citation focus

Date: 2026-06-13
Verdict: **REVISE**

Scope reviewed: `backend/app/services/citation_quote_service.py`, `backend/app/services/chat_service.py`, `backend/tests/test_citation_quote_service.py`, `backend/tests/test_chat_corrective_retrieval.py`, `frontend/src/lib/sse.ts`, `frontend/src/lib/useChatStream.ts`, citation reload/store/click paths. No git commands used.

## Findings

1. **REVISE: table/summary citations are still sent to quote extraction, contrary to H8.**

   `extract_focus_quotes()` gates only on `ref_index`, missing `focus_snippet`, and non-empty `chunk_texts` (`backend/app/services/citation_quote_service.py:79-91`). `_refine_citation_focus()` passes every `chunk_map` entry as source text with no `retrieval_modality` filter (`backend/app/services/chat_service.py:987-993`). That means table and map-reduce summary citations can trigger the extra LLM call and receive `focus_snippet`.

   This violates the plan's H8 ("Table/summary modality has no clean sentence; excluded from focus"). It is not just cost: summary coverage is explicitly approximate in the main answer prompt (`backend/app/services/chat_service.py:595-607`), while the frontend treats any `focusSnippet` as a precise highlight layer (`frontend/src/store/index.ts:163-170`, `frontend/src/components/PdfViewer/PageWithHighlights.tsx:80-87`). Fix by filtering to text citations only, for example `retrieval_modality` absent/`"text"` and no `table_id`, and add tests for table-only and summary-only citations asserting no extraction call.

2. **REVISE: the new DeepSeek Flash call does not apply provider options, so it may not be the intended cheap non-thinking call.**

   Main answer and repair calls route DeepSeek official models through `_apply_provider_options()`, which disables V4 thinking (`backend/app/services/chat_service.py:194-202`, used at `backend/app/services/chat_service.py:1662` and `backend/app/services/chat_service.py:2341`). The quote extractor directly calls `client.chat.completions.create(...)` without `extra_body` or a shared create-kwargs hook (`backend/app/services/citation_quote_service.py:102-112`).

   The plan's cost/latency premise is "cheap Flash"; this call currently uses the Flash model name but not the same provider settings as chat. Thread the provider options into `extract_focus_quotes()` or build the completion kwargs in `chat_service` and pass them through. Add a unit test that the focus call includes the DeepSeek thinking-disabled body when `quick` is a DeepSeek official model.

3. **REVISE: post-generation extraction is unbounded before `done`, which expands the cancellation/timeout window.**

   `_refine_citation_focus()` is awaited after repair and before final persistence/accounting/`done` in both paths (`backend/app/services/chat_service.py:1843-1849`, `backend/app/services/chat_service.py:2497-2503`). There is no per-call timeout in the extractor (`backend/app/services/citation_quote_service.py:102-112`) and the shared `AsyncOpenAI` clients are created without a local timeout (`backend/app/services/chat_service.py:158-185`).

   `CancelledError` is not swallowed on Python 3.9 because it inherits `BaseException`, not `Exception`; the existing `except asyncio.CancelledError: raise` paths still work. The risk is delay: a slow or stuck nicety can hold back `done`, final citation persistence, and credit settlement. It also makes it more likely that a user/Vercel abort after answer text but before final update leaves only the pre-verification draft persisted (`persisted=True` skips cancel-path re-persist at `backend/app/services/chat_service.py:1938-1951` and `backend/app/services/chat_service.py:2565-2577`). Add a short timeout around the focus extraction, treat timeout as `{}`, and keep cancellation propagating.

4. **REVISE: verifier gating prevents fabrication, but the extraction prompt lacks the project's data-boundary hardening.**

   The extractor embeds both generated answer text and raw source chunk text directly into the user message (`backend/app/services/citation_quote_service.py:95-100`). The system prompt says to copy a supporting sentence (`backend/app/services/citation_quote_service.py:30-39`) but does not say that answer/source contents are untrusted data and must not be followed as instructions. Main chat has an explicit data-boundary rule because document prompt injection is a known risk (`backend/app/services/chat_service.py:49-68`).

   `verify_quote()` is a strong provenance guard: it stops hallucinated, translated, and cross-chunk quotes from being displayed. It is not a semantic-support guard. A malicious source or crafted answer can still steer the extractor toward a different verbatim sentence in the same cited chunk; `verify_quote()` will accept that because the text is real. This degrades to a misleading narrow highlight instead of the current whole-chunk highlight. Add extractor-specific data-boundary language and delimiter/schema framing. If feasible, also verify against exactly the source slice sent to the extractor, not unseen full chunk text.

## Attack Checklist

A. Prompt injection/data boundary: partially guarded. The quote shown is source-derived because of `verify_quote`, but same-chunk malicious quote selection remains possible. The prompt should inherit the data-boundary posture used in main chat.

B. Streaming/lifecycle: cancellation is not swallowed (`asyncio.CancelledError` is `BaseException` on Python 3.9). The lifecycle concern is the missing timeout before `done` and final persistence.

B2. `_refine_citation_focus()`'s `except Exception` does not catch `CancelledError` on Python 3.9.

C. Gating/cost: no-citation and already-focused text citations are gated correctly in `extract_focus_quotes()`. Flash model selection is correct via `settings.MODE_MODELS["quick"]`, and `max_tokens=512` is sane for the JSON result. Cost gating is incomplete because table/summary citations can call the extractor, DeepSeek thinking-disabled options are missing, and the extractor usage is not recorded or billed anywhere.

D. SSE/frontend race: `citations_refined` arrives before `done` and `handleCitationsRefined()` flushes pending text before replacing only `citations`, so streamed text is preserved (`frontend/src/lib/useChatStream.ts:223-228`). `updateLastMessageMeta()` merges rather than clobbers other message fields (`frontend/src/store/index.ts:290-295`). Replacing the full citation list is correct for both main and continuation paths. Existing navigation/abort races are not made fundamentally worse, but the longer backend wait increases the chance of abort before `done`.

E. Persistence: enriched citations are assigned back to `asst_msg.citations` before final commit in both main and continuation streams (`backend/app/services/chat_service.py:1851-1858`, `backend/app/services/chat_service.py:2505-2509`). Reload mapping preserves `focus_snippet` via `mapCitationPayload()` (`frontend/src/lib/api.ts:70-85`).

F. Continuation: using `merged_citations` and emitting the complete list is correct. The helper may also refine older unfocused citations from the existing message, which is acceptable. The same modality/timeout/provider-option issues apply.

G. Divergent table/new edge cases: H8 is unhandled. Additional edge case: repeated use of the same `ref_index` for multiple distinct claims can only get one extracted quote per source because `extract_focus_quotes()` deduplicates refs (`backend/app/services/citation_quote_service.py:80-91`) and `apply_focus_quotes()` applies the same focus to all citations for that ref (`backend/app/services/citation_quote_service.py:132-143`). The frontend already mostly treats citations as unique by ref, so this is a residual product limitation rather than a new blocker, but it is worth documenting.

## Summary

The core architecture is sound: the answer prompt/FSM are untouched, same-language lexical focus remains first, and `verify_quote()` gives a real provenance guard. Do not ship this exact patch until the text-only modality gate, DeepSeek provider options, timeout behavior, and extractor data-boundary prompt are tightened.
