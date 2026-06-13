# Quote Finder design review — Round 1 dialogue record

**Date:** 2026-06-12
**Participants:** Claude (author) ↔ Codex gpt-5.5/xhigh (adversary)

## Process note
Codex r1 ran 3× (sessions died mid-run without token settlement — suspected account throttling; also `-m gpt-5.3-codex` is no longer accepted on this account, default resolves to **gpt-5.5**; CLAUDE.md needs updating). The review FILE was never written, but Codex's intermediate findings were captured from session logs and independently verified by Claude before acceptance.

## Codex finding #1 (BLOCKER) — ACCEPTED, prod-verified
> "The plan's verifier target does not exist for PDFs as described."

Verification (Claude):
- `backend/app/workers/parse_worker.py:214` — comment: "Map page_number → original extracted text **for non-PDF** (used when persisting Page.content)"; `extracted_content_map` populated ONLY in the `file_type != "pdf"` branch (`:239`); `Page.content = extracted_content_map.get(...)` (`:409-417`) → None for PDFs.
- Prod query (read-only, 2026-06-12): `pages` joined to `documents` by file_type — **pdf: 9,243 pages, 0 with content**; docx 132/132, txt 90/90, pptx 79/79, xlsx 1/1.

Resolution: D1 REVISED — verification target = `chunks.text` of the cited chunk (the exact text the LLM saw; present for all docs/formats); display slice comes from chunk text (Deterministic Quoting preserved); parse_worker starts persisting PDF page text forward-only as the fidelity upgrade path. Plan updated in place.

## Codex finding #2 — ACCEPTED (clarification)
> "chunks.bboxes is only a JSONB column at the model layer" — need to verify population & frontend consumption.

Verification: `parse_service.py:834` line-level bbox precision; `:790` bboxes accumulated on merge; `chat_service.py:203-260` assembles citation payload from chunk bboxes. Claim in D3 corrected from "per-sentence" to **line-level** bboxes; reuse conclusion unchanged.

## Codex finding #3 — ACCEPTED (clarification)
> "text_quality is document-level only and nullable."

D1 updated: cap applies when text_quality present AND <0.75; NULL + parse_method='ocr' also caps; NULL text-layer docs uncapped.

## Outstanding for Round 2
Open questions §7 (credit pricing, saved-quote cap, chat routing, biblio table, tier thresholds) + scope challenge + verdicts — not yet delivered by Codex due to session deaths. Round 2 launched with tightened scope and the r1 corrections pre-applied.

## Round 2 process note (2026-06-12, later) — CORRECTED
**The "died/throttled" diagnosis above was WRONG.** Both Codex runs completed: gpt-5.5/xhigh review runs take 25–40 min and the logs are quiet for long stretches; Claude read logs prematurely (twice) and misdiagnosed death. Lesson: only the `tokens used` settlement line marks the end of a codex exec run — never diagnose from a mid-run log tail. Both reviews were delivered in full:
- r1: `.collab/reviews/2026-06-12-quote-finder-codex-r1.md` (BLOCK D1+D3: pages.content NULL for PDFs; bboxes not span-addressable; retrieval recall; scope cuts)
- r2: `.collab/reviews/2026-06-12-quote-finder-codex-r2.md` (REVISE: sentence-split mutation `U.S.`→`U. S.`; hard-hyphen loss; page attribution on spanning chunks; dedup key; biblio user-scoping; answers to all 5 open questions)

## Round 2 consensus (Claude response, 2026-06-12)
Claude ACCEPTS all r1+r2 required changes in full — consolidated into plan **§8 (Round-2 consensus resolutions)**, which overrides conflicting D1–D8/§5 text. Notable position changes:
- Claude's "defer chat routing to v1.1" position WITHDRAWN — both Codex rounds argued organic demand lives in chat; strict-intent routing ships in M2 (action_planner CITATION_LOOKUP hook exists).
- r1↔r2 pricing disagreement (flat job predebit vs chat-style token debit) resolved by synthesis: dedicated `reason="quote_search"` debit, balanced-style predebit 15, reconcile to actual, job-style UsageRecord.
- Free saved-quote cap 20 → **30** (r1 argument: don't cut thesis users pre-habit).
- 4-week W1–W4 replaced by milestone gating M0→M3 + fast-follow list (§8.5); exports/citeproc/Crossref/SEO pages all deferred past the first-paid-loop.

Round 3 = Codex ratification pass on §8 (confirm or final objections).
