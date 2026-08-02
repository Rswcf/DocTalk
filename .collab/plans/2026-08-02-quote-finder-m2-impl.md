# Quote Finder M2 ("the loop") — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the verified-quote loop — topic in → machine-verified verbatim quote cards out (exact source slice, page, jump-to-highlight, one-click APA in-text copy) — per the ratified consensus plan `.collab/plans/2026-06-12-quote-finder-evidence-board.md` (§8.5 M2 scope; §9 M1→M2 boundary conditions). Plus one incident-hardening task (MinIO self-heal).

**Architecture:** All verification runs through the LIVE M1 substrate (`text_normalizer`, `quote_verification_service.verify_quote` — already in production serving citation focus). M2 adds: forward-only PDF page-text persistence, a verification-source selector with honest trust labels, a quote-search service + billed endpoint, a strict chat-intent router, and the quote-card UI. Display text is ALWAYS the server-verified raw slice — never the LLM emission.

**Tech stack:** FastAPI/SQLAlchemy async + Celery(sync) + Qdrant + rapidfuzz (installed); Next.js 14 + zustand. New deps: NONE (citeproc/Crossref explicitly deferred).

## Global Constraints

- Consensus decisions in the 2026-06-12 plan §8 are LOCKED (billing shape, thresholds 95/90, dedup key, trust-label copy, strict-intent-only routing, no citeproc/Crossref/exports in M2). Do not re-litigate; cite §8.x when a task references one.
- Backend: `HTTPException` for errors; API async / Celery sync DB, never mixed; MinIO calls in async endpoints via `asyncio.to_thread()`.
- Billing: two-stage debit — pre-check → `debit_credits()` predebit → work → `reconcile_credits()` same ledger row; failure → DELETE + full refund. Quote search: `reason="quote_search"`, predebit 15, reconcile to actual tokens, charge actual cost on verified-empty results (§8.4.1). `UsageRecord.message_id=None`.
- i18n: every new user-facing key lands in ALL 11 locales (en/zh/ja/ko/es/de/fr/pt/it/ar/hi), flat dotted keys.
- Palette: app UI zinc + blue accent; zero gray-*/indigo-*/violet-*/purple-*; zero transition-all.
- Alembic: `down_revision` = actual current head revision STRING (check `alembic heads`), never a filename. Migrations add-only. NEVER run `downgrade` against the shared dev DB — use a scratch database for round-trip tests (2026-08-02 incident).
- Verification contract before "done": `npm run build` (never while dev runs) · `ruff check app/ tests/` · full `pytest` no new failures (current baseline 542 pass / 8 skip no-docker).
- Commits on `main`, one per task, ending with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. Push `origin main` after each wave completes review (owner asked for periodic progress pushes).
- Codex adversarial review at the end (mandatory), multi-round to consensus.

## Execution waves

- **Wave B (backend, ONE agent, sequential):** B0 → B1 → B2 → B3 → B4 → B5 → B6.
- **Wave F (frontend, ONE agent, after B):** F1 → F2 → F3 → F4.
- **Wave T:** integration verification (controller). **Wave R:** Codex rounds to consensus, then deploy per runbook.
- Deferred out of this batch (tracked, not lost): academic demo seed doc (needs owner-chosen file), M3 saved_quotes/Evidence Board, exports, citeproc, SEO tool pages.

---

### Task B0: Demo self-heal verifies MinIO objects (incident hardening)

2026-08-02 incident: MinIO v2 migration lost ~106/108 stored files; demo self-heal never noticed because it only checks Qdrant vectors. Make startup seeding also stat each demo doc's storage object and re-upload from `backend/seed_data/` (id- and key-preserving) when missing.

**Files:** Modify `backend/app/services/demo_seed.py`; Test `backend/tests/test_demo_seed_storage.py` (new).

**Interfaces:** Produces `_ensure_demo_files(docs: list[Document]) -> int` (module-level, returns re-uploaded count; called from the existing seed/self-heal entrypoint after the Qdrant check).

- [ ] Read `demo_seed.py` fully first (seed specs map slug→local file; `_get_minio_client()` exists; uploads use plain `put_object` content_type=application/pdf).
- [ ] Failing test: fake/minimal MinIO client double — doc row whose `stat_object` raises `S3Error(code="NoSuchKey")` → `_ensure_demo_files` uploads bytes from the seed file to EXACTLY `doc.storage_key` and returns 1; doc whose stat succeeds → no upload, returns 0; slug not in seed map → skipped, logged, no crash.
- [ ] Implement: for each demo doc row with a known slug, `stat_object(bucket, doc.storage_key)`; on NoSuchKey → read seed file → `put_object(bucket, doc.storage_key, ...)` → log warning `demo_seed.file_restored`. Wrap per-doc in try/except so one failure never blocks startup. Wire into the existing startup seed function AFTER the vector check (runs regardless of whether vectors were healthy).
- [ ] Tests + ruff + full-suite; commit `fix(demo): self-heal re-uploads missing demo PDFs to MinIO (2026-08-02 incident hardening)`.

### Task B1: Forward-only PDF page-text persistence

§8.1/§9: PDFs must start persisting per-page raw text into `pages.content` (currently NULL for all PDFs) so verification can run against page text. Forward-only: new/re-parsed docs only. KNOWN INTERACTION (§9, flagged by Codex r2): `backend/app/api/documents.py` `get_document_text_content` PREFERS `Page.content` when present — after this change, newly parsed PDFs switch that endpoint (and TextViewer) from chunk-concatenation to raw page text. That behavior change is IN SCOPE and must be verified deliberately, not discovered.

**Files:** Modify `backend/app/workers/parse_worker.py` (PDF branch); Test `backend/tests/test_parse_pdf_page_content.py` (new).

- [ ] Read the PDF extract pass in `parse_worker.py` / `parse_service.py` — capture `page.get_text("text")` per page during the EXISTING pass (no extra document open), populate the same `extracted_content_map` mechanism the non-PDF branch uses (find it at the `file_type != "pdf"` branch; mirror it).
- [ ] Failing test: run the parse path on a small fixture PDF (fixtures exist under `backend/tests/` or `test_inputs/` — find one; else build a 2-page PDF with PyMuPDF in-test) → assert every created Page row has non-null `content` equal to PyMuPDF `get_text("text")` for that page.
- [ ] Verify the `get_document_text_content` interaction: add a test asserting the endpoint/service function returns page-content-joined text for a PDF WITH content and falls back to chunks for a PDF WITHOUT (legacy). Read the function first; document the observed contract in the test names.
- [ ] Tests + ruff + suite; commit `feat(quotes): persist per-page PDF text forward-only (M2 substrate, plan §8.1)`.

### Task B2: Verification-source selector with honest trust labels

**Files:** Create `backend/app/services/quote_source_service.py`; Test `backend/tests/test_quote_source_service.py`.

**Interfaces:** Produces:
```python
@dataclass
class QuoteSource:
    text: str                 # the verification corpus
    kind: str                 # "page_text" | "extracted_text"
    page_start: int
    page_end: int

async def build_quote_source(db, document_id, chunk, neighbor_chunks) -> QuoteSource
```
Rule (§8.1/§9): if ALL pages in the chunk's `page_start..page_end` have non-null `Page.content` → concatenate those pages' content, kind="page_text". Else → cited chunk text ± provided neighbors, kind="extracted_text". Trust-label copy derives from `kind` downstream ("verified against page text" vs "verified against extracted text").

- [ ] Failing tests: page-content-complete doc → page_text; any missing page content → extracted_text with chunk+neighbors joined in document order; single-page chunk; multi-page chunk.
- [ ] Implement (pure + one Page query); ruff + suite; commit `feat(quotes): verification-source selector with honest trust labels (plan §8.1)`.

### Task B3: Quote search service

**Files:** Create `backend/app/services/quote_search_service.py`; Test `backend/tests/test_quote_search_service.py`.

**Interfaces:** Produces:
```python
async def quote_search(db, *, document, user, topic: str, locale: str) -> QuoteSearchResult
# QuoteSearchResult: cards: list[QuoteCard], proposed: int, verified: int, discarded: list[(reason, tier, score)],
#   scanned_chunks: int, usage: (prompt_tokens, completion_tokens), model: str
# QuoteCard: display_text (server slice), page, page_end, bboxes (cited chunk's, for the verified page),
#   tier ("exact"|"normalized"|"aligned"), source_kind ("page_text"|"extracted_text"), chunk_id, score
```
Flow (§8.3 + §9 scout): retrieval at ~2× chat top_k via the existing hybrid stack + deterministic candidate expansion (normalized topic term/phrase scan over the doc's chunks — use `text_normalizer.normalize`; merge hits into candidates before generation) → ONE balanced-model DeepSeek call, JSON `{"quotes": [{"quote_text", "source_ref_n", "page"}]}` with abstention licensed ("return [] if none") — reuse the extraction feature's JSON plumbing/retry pattern (find it in `extraction` service) → per proposal: ref range-check → `build_quote_source` (B2) → `verify_quote(proposed, source.text, text_quality=doc.text_quality, parse_method=doc.parse_method)` → keep only `QuoteVerification.verified` (exact/normalized/aligned-auto); flagged/rejected → discarded with reason → dedup by §8.1 key `(document_id, normalized_quote_text, page_range, offset-or-bbox-signature)` → cards.
- Data-boundary prompt rule (v0.21 precedent): retrieved text is UNTRUSTED; instruct the model accordingly.
- [ ] Failing tests with a mocked LLM: verified exact quote → card with raw-slice display; LLM emission ≠ source (paraphrase) → discarded; hallucinated ref_n → discarded (ref_out_of_range); duplicate quote in overlapping chunks → one card; empty proposals → empty result with counts.
- [ ] Implement; ruff + suite; commit `feat(quotes): verified quote-search service (LLM proposes, verifier disposes)`.

### Task B4: Endpoint + billing + telemetry

**Files:** Create `backend/app/api/quotes.py` (router `POST /api/documents/{document_id}/quote-search`); register in the API router assembly (find where routers are included); Test `backend/tests/test_quotes_api.py`.

Contract: auth REQUIRED (v1 is the paid wedge; anonymous gets 401 → frontend shows sign-in CTA). Access via the existing `can_access_document` pattern. Body `{"topic": str (1..300)}`. Billing per Global Constraints (§8.4.1): pre-check balance (402 detail shape like chat) → `debit_credits(reason="quote_search", predebit=15)` → run B3 → `reconcile_credits` to actual token cost (charge actual even when zero cards — §8.4.1) → on exception DELETE ledger + refund (follow `chat_service`'s reconcile/refund pattern EXACTLY — read it first). Record `UsageRecord` (message_id=None) like summary_usage precedent. Telemetry: ProductEvent `quote_search_completed` (add to ALLOWED_EVENTS — server-side insert, not client) with counts from B3 result. Rate limit: reuse `auth_chat_limiter`. Response: cards + counts + trust label kind + `remaining_credits`.
- [ ] Failing tests: 401 anon; 402 insufficient; happy path (mock B3) bills predebit→reconcile single ledger row; failure path refunds; response shape.
- [ ] Implement; ruff + suite; commit `feat(quotes): billed quote-search endpoint with telemetry (plan §8.4.1, §8.3)`.

### Task B5: Strict chat-intent routing (LAST backend task — riskiest)

§8.4.3: strict direct-quote intents only, in chat, v1. SEPARATE matcher from the broad `_CITATION_RE` (`action_planner.py:68`).

**Files:** Modify `backend/app/services/action_planner.py` (new STRICT matcher + action), `backend/app/services/chat_service.py` (route strict intent → quote pipeline, emit cards, honest empty answer); Test `backend/tests/test_quote_intent_routing.py`.

- Strict patterns (en/zh/es minimum, per the retained-user corpus): "direct quote(s)", "verbatim", "exact quotation", "quote ... with page", "word for word"; zh: 逐字引用/原文引用/一字不差; es: "copia tal cual", "cita textual", "textualmente". NOT bare "quote"/"citation"/"source".
- Routing shape: when strict intent fires in an AUTHED non-demo chat message, chat_service runs the B3 service (billing stays the CHAT message's own two-stage debit — do NOT double-bill; reconcile includes the quote call's tokens) and streams a compact answer: intro line + quote cards emitted as a chat ARTIFACT (`ChatArtifactCard` channel — read how extraction/table artifacts are emitted over SSE and reuse that exact mechanism) + citations payload for jump. Verified-empty → the localized "no verified quotes found" message — NEVER unverified fallback text. Anonymous/demo or non-strict → untouched chat path (byte-for-byte).
- [ ] Failing tests: matcher positives/negatives per language; routing test with mocked quote service (authed → artifact emitted; anon/demo → normal chat); empty-result honesty.
- [ ] Implement; ruff + FULL suite (chat_service is load-bearing — zero regressions tolerated); commit `feat(quotes): strict verbatim-quote chat routing (plan §8.4.3)`.

### Task B6: Minimal biblio (document_biblio) + APA in-text formatter

**Files:** Alembic migration (table per D8 amended §8.4.4: PK `(document_id, user_id)` with a SYSTEM row for auto-detected defaults — user edits never mutate demo/shared docs' shared metadata); Create `backend/app/services/biblio_service.py` + endpoints in `backend/app/api/quotes.py` (`GET/PUT /api/documents/{id}/biblio`); Test `backend/tests/test_biblio.py`.

- Seed: filename heuristics + PyMuPDF doc metadata (author/title/year) → CSL-JSON-shaped dict `{author: [{family, given}], issued: {year}, title}`; stored with `source` flag ('system'|'user').
- `format_apa_intext(biblio, page) -> str` — pure function: "(Family, Year, p. X)"; multi-author: "(A & B, Year, p. X)", 3+: "(A et al., Year, p. X)"; missing fields degrade gracefully ("(Title, n.d., p. X)"). NO citeproc (§8.5).
- [ ] Migration (scratch-DB round-trip ONLY, per Global Constraints), failing tests for formatter cases + GET seeds system row + PUT writes user row without touching system row; implement; ruff + suite; commit `feat(quotes): minimal per-user biblio + APA in-text formatter (plan §8.4.4)`.

### Task F1: Quote Finder panel UI

**Files:** Create `frontend/src/components/Quotes/QuoteFinderPanel.tsx` (+ small pieces as needed); wire an entry point in the reader (`DocumentReaderPageClient` — a "Quotes" toolbar action next to the view toggle; hidden for anonymous users, shows sign-in CTA instead); API client fns in `frontend/src/lib/api.ts`.

- Panel: topic input + search → loading → card list. Card: verified badge + tier/trust label (i18n), display_text (the verbatim slice, styled as quotation), page, actions: Jump (reuse the citation-jump store actions — `setCurrentPage`/highlight snippet with the display_text, approximate-precision label per §8.2), Copy (quote + APA in-text from F2 biblio, one string to clipboard). Discarded count line ("n verified, m discarded"). 402 → PaywallModal (existing pattern); 401 → auth modal.
- [ ] Implement; `tsc + lint`; commit `feat(quotes): Quote Finder panel with verified quote cards`.

### Task F2: Biblio mini-form

**Files:** Create `frontend/src/components/Quotes/BiblioForm.tsx`; wire into the panel (edit icon near the copy action).
- Fields: author(s) (one per line "Family, Given"), year, title; loads GET biblio (user row if present else system), saves PUT. Prefilled copy uses it immediately.
- [ ] Implement; tsc + lint; commit `feat(quotes): editable citation metadata form`.

### Task F3: Chat quote-card artifact rendering

**Files:** Modify `frontend/src/components/Chat/ChatArtifactCard.tsx` (new artifact type `quote_cards`), plus SSE/type plumbing (`lib/sse.ts`, `types`) following the existing extraction-artifact pattern exactly.
- Renders the same card list as F1 inside chat; jump + copy identical.
- [ ] Implement; tsc + lint; commit `feat(quotes): quote cards render as chat artifacts`.

### Task F4: i18n sweep ×11

- [ ] Every new key (panel labels, trust labels, "n verified, m discarded", empty-state honesty line, CTA copy, form labels) translated natively in all 11 locale JSONs; `python3 -c "import json..."` parse check; tsc + lint + build in integration; commit `feat(quotes): i18n for Quote Finder (11 locales)`.

### Task T: Integration verification (controller)

- [ ] Backend suite + ruff at HEAD; frontend build (no dev server).
- [ ] Live stack (docker + uvicorn + celery + dev): upload a real PDF → quote search from panel (verify billing ledger predebit→reconcile in DB, UsageRecord row, telemetry event) → cards show verbatim slices → jump highlights → copy string correct → biblio edit reflected → chat strict intent ("give me a direct quote about X with page number") routes to cards → verified-empty topic shows the honest empty message. Both themes.
- [ ] New-parse PDF gets Page.content; TextViewer for that doc still renders sanely (B1 interaction).

### Task R: Codex adversarial review → consensus → deploy

- [ ] Brief in `.collab/reviews/2026-08-02-quote-finder-m2-review-request.md`: scope = wave commits; attack surfaces: verification-gate bypasses (can ANY unverified text reach a card?), billing double-charge/leak paths incl. chat-routed searches, prompt-injection via document text (data-boundary), page-attribution on spanning chunks, B1's get_document_text_content behavior change, migration safety, i18n completeness, chat-path regression risk (B5).
- [ ] `codex exec` rounds to consensus (same protocol as P0 batch); fix waves via the implementing agents; then version bump + backend-first deploy per `/deploy` runbook (owner has authorized deploy cadence for this program).
