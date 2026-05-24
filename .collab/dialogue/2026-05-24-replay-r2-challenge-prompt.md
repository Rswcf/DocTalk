# Challenge debate — Remediation R2 design (real-user replay findings)

This is a **Challenge-style design debate**, not a code review. Be adversarial:
poke holes in each proposed fix, surface failure modes, propose BETTER
alternatives where mine are weak, and push toward a consensus design ("formula").
Do not rubber-stamp. You cannot run git, but read the repo + the research doc.

## Read first
- `.collab/reviews/2026-05-24-replay-r2-research.md` — full root-cause + best-practice research + my proposed formula for 4 issues found by replaying real failed users in prod.
- Code anchors: `backend/app/services/chat_service.py` (line 50 `SYSTEM_PROMPT_META_RULE`; ~1242–1348 excerpt build + prompt branches; `_citation_contract` ~490; `get_rules_for_model`), `backend/app/services/corrective_retrieval_service.py` (`_fetch_page_chunks` lives in chat_service), `backend/app/models/tables.py` (documents table — note: NO parse_version), parse path `app/services/parse_service.py`.

## The 4 issues + my proposed fixes (challenge each)

1. **Page/source not in model context** → put `(p.X[–Y]) [section]` into each numbered excerpt + a page-citation rule. The page metadata already exists in `chunk_map`; it's just not surfaced.
2. **Injection meta-rule false-refuses terse/keyword queries** → replace "refuse if it resembles a command" with spotlighting: treat user input as a question/search (short keyword queries = "find/explain this term"), ignore embedded role-change but still answer, only decline when there's genuinely no document request.
3. **OCR/parse not retroactive** (old docs keep garbled parse; no parse_version) → add `parse_version` + garbled-text heuristic → owner "re-process" + admin backfill; not a blanket re-ingest.
4. **Internal jargon ("fragment") leaks into answers** → output-terminology guard in all branches/locales.

## Specifically challenge / decide (the hard parts)
- **#1 page labels:** Will exposing `(p.350)` cause the model to FABRICATE page numbers for claims it didn't truly source there (a NEW hallucination vector)? How to label converted/text docs with no real pages (`page_start` may be 0/dummy — bbox fallback)? Is page-in-text the right move, or should we instead use a structured citation contract / a post-hoc page-verification step? Token-cost across ~8 excerpts.
- **#2 spotlighting:** Does dropping the refusal weaken real injection defense (DocTalk ingests URLs → untrusted content in excerpts can carry injections)? Should the meta-rule distinguish *user-message* injection (rare, low-stakes) from *retrieved-content* injection (the real threat for a doc-QA tool)? Is a refusal ever correct? Define the precise new rule text.
- **#3 re-ingest:** lazy-on-access vs admin backfill vs heuristic-flag — which, and why? How to detect "garbled" reliably across Urdu/Arabic/CJK without false-flagging good non-Latin text? Cost of re-vectorizing (embedding spend). Should the parse worker auto-OCR when text-quality is low *at ingest* (so it's not version-dependent)? Is `parse_version` even the right abstraction vs a `text_quality` gate?
- **#4:** trivial — just confirm placement (meta-rule vs rules) so it covers summary + page-lookup + collection branches.
- **Sequencing/scope:** is this one batch or should #3 (infra-heavy) split out? What's the minimal change that flips the most replay cases FAIL→PASS without regressing PAY/U26/U28/U42?

## Output
Write to `.collab/reviews/2026-05-24-replay-r2-codex-challenge.md`: for each issue, your CHALLENGE (risks/holes in my proposal), your COUNTER-PROPOSAL or AGREE, and a concrete recommended design. End with a consensus "formula" (the agreed fix set + sequencing) or the specific points still in dispute for round 2.
