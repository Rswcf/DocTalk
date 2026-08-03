# M3 Acceptance Gate — in-prod replay vs the retained-academic corpus

**Date:** 2026-08-04 · **Verdict: FAILED — do NOT enable Plus gating yet.**
Method: `railway ssh --service backend` → replay script calling `quote_search()` **directly** (service layer, not the billed API), so no user credits were charged and no rows written. Read-only w.r.t. user data.

This is the gate the 2026-06-12 consensus plan (§8.5 M3) requires before Plus gating: *"in-prod replay vs the retained-academic query corpus (bas\*\*\*/mel\*\*\*/ric\*\*\*/mca\*\*\*) as acceptance gate → enable Plus gating."*

## 1. The corpus is the right one

Four candidate users, three with usable documents; 14 real historical queries. They are, verbatim, Quote Finder's job description:

| user | doc | signal |
|---|---|---|
| mel\*\*\* (12 msgs, 3 active days — the deepest retained user in the DB) | *Hacia una gramática del texto*, 32p | "citas con página y todo" → "Copia tal cual" → "Pero dame las páginas" → **"Copia TAL CUAL, PALABRA POR PALABRA"** (caps in the original) |
| ric\*\*\* | Umberto Eco, *Obra aberta*, 291p | "Extraia citações diretas exatas (**palavra por palavra, sem parafrasear**)… **indicando a página exata**" |
| mca\*\*\* | Anijovich, *La evaluación como oportunidad*, 95p | "citas extraídas de este documento… el apellido del autor, el año y la página" |

mel\*\*\*'s twelve messages are one escalating conversation — a user fighting the tool for something it structurally couldn't give her. That is the demand Quote Finder was built to serve.

## 2. Result: 10 replayed queries → 10 proposed, **1 verified**

| doc | topic (from the real query) | proposed | verified | discards |
|---|---|---|---|---|
| gramática | concepto de cohesión | 0 | 0 | — |
| gramática | clasificación de la cohesión | 0 | 0 | — |
| gramática | repetición / sustitución / series ordenadas | 0 | 0 | — |
| gramática | recursos cohesivos | 0 | 0 | — |
| gramática | concepto de elipsis y conectores | 0 | 0 | — |
| gramática | clasificación de conectores | 1 | 0 | `ambiguous_page_range, aligned, 95.4` |
| gramática | progresión temática y sus tres tipos | 4 | **1** | `not_located`; `ambiguous_page_range ×2 (98.9, 98.7)` |
| Eco | co-autoria e obras participativas | 1 | 0 | **`ambiguous_page_range, exact, 100.0`** |
| Anijovich | la evaluación como oportunidad | 4 | 0 | **`ambiguous_page_range, exact, 100.0` ×3** |
| Anijovich | retroalimentación formativa | 0 | 0 | — |

Retrieval was never the bottleneck: 16–24 chunks retrieved, 16–34 candidate pages, all chunks scanned (45 / 495 / 153).

## 3. Three root causes, separated by evidence

**(A) `ambiguous_page_range` discards the majority of the corpus — the dominant, fixable cause.**
Production-wide: **8443 of 14919 PDF chunks (56%) span page boundaries**, and **7551 of those (89%) span exactly one** (page N→N+1). Because `extracted_text` has no offset→page map, the M2 Codex-r2 policy discards every one of them. The replay lost four `exact 100.0` verbatim matches this way — perfect quotes, verified, thrown away. For a span of one boundary, an honest "pp. N–N+1" is a serviceable academic citation; discarding is strictly worse for the user than reporting the range. The consensus plan §8.1 already sanctions range labelling; I chose the stricter of Codex's three options in r2, and this data says that was the wrong trade-off.

**(B) `page_text` is effectively absent in production, and cannot be backfilled for the existing corpus.**
Only **11 of 108** documents have any `pages.content`, nearly all non-PDF (the old non-PDF branch always populated it). B1 (per-page PDF text) is forward-only and shipped in v0.24.0 one day ago, so essentially every real PDF search runs the degraded path. The obvious remedy — backfill page text from the stored PDFs — is **blocked for ~103 documents by the MinIO storage loss**: the source files are gone. `extracted_text` is therefore permanent for the existing corpus, which raises the stakes on (A) considerably.

**(C) Some legacy parses are garbage, and abstention is honest.**
mel\*\*\*'s document — the deepest user's — extracts as OCR noise: `———————reEE ———Wo genreate paneA4 carta?4ener" of ire \as ae ve + gos y aeon 108G.` There are no quotable passages in that text, so `proposed=0` on five of her topics is the verifier gate working **correctly**: it abstained rather than fabricate. The one card that did verify carries visible OCR damage (`"Progresién con temas derivados… derivan ternas nuevos"`). Production-wide, **87 of 97 PDFs have `text_quality = NULL`** (parsed before the R2b quality detection), so their quality is unknown and some share is unusable. Re-parsing would fix it — and is blocked by the same missing files.

## 4. Decision

- **Plus gating stays OFF.** The feature does not yet deliver for the cohort it was built for on that cohort's own documents.
- **Fix (A) now** — honest page ranges for span≤1 `extracted_text` matches; keep discarding span≥2. It is the one root cause not blocked by the storage loss, and it directly recovers the four exact-match losses.
- **(B) and (C) are storage-loss consequences**, not Quote Finder defects. They need an owner decision on the ~103 file-less documents (see below). New uploads are unaffected: they get `page_text` and current-generation parsing.
- **Re-run this gate after (A)** and re-decide Plus gating on the new numbers.

## 5. What this gate proves about the design

The verifier held. Not one fabricated or unverifiable quote reached a card across ten adversarial-in-practice queries on damaged, multilingual, legacy documents. Every failure was an honest refusal (`proposed=0`, `not_located`) or an over-strict attribution discard. The guarantee — *LLM proposes, verifier disposes, source displays* — behaved exactly as specified; what failed is a policy tuned without this data.

## 6. Owner decision still open

~103 production documents have no stored file (MinIO v2 migration loss). Consequences now measured: they can never be upgraded to `page_text`, never re-parsed to fix bad OCR, and their PDF pane stays broken. Options: (a) notify affected users and offer re-upload, (b) mark them degraded in the UI, (c) leave silent. Also unresolved: there is still **no storage backup** — the same loss can recur.

## Fix (backend, 2026-08-04)

Root cause (A) — `ambiguous_page_range` discarding every `extracted_text` match whose CHUNK spans page boundaries — is fixed with a scoped threshold, not a wholesale reversal:

- **Span 1 (2-page range, `page_end - page_start == 1`)**: now EMITTED, not discarded. `_attribute_match` gets a new third branch (`quote_search_service.py`): `page = page_start`, `page_end = page_end` (the honest range), and bboxes are every bbox belonging to EITHER page in that range — filtered, never majority-voted down to one page. This is the important distinction from the rejected Codex-r2 alternative: we are not resurrecting "guess the single most-likely page," which is provably wrong (Codex's own r2 probe: bboxes 1×p1 + 2×p2, quote physically on p1 — majority vote would pick p2). We report the range instead of guessing inside it.
- **Span ≥2 (3+ pages, `page_end - page_start >= 2`)**: still discarded as `ambiguous_page_range`. A 3-page-wide citation isn't useful to a reader regardless of honesty, so the r2 concern stands unmodified here.
- **`page_text` kind**: entirely unchanged — it was never ambiguous (one page per segment) and doesn't go through this code path at all.
- Renamed `_is_ambiguous_multipage_extracted_segment` → `_extracted_text_span_too_wide_to_report` (threshold-based, `_MAX_HONEST_EXTRACTED_TEXT_SPAN = 1`) since the old name no longer describes the logic — a 2-page span is still "multipage" but is no longer "too ambiguous to report." Both call sites updated: `quote_search()`'s discard loop and `verify_saved_quote()`'s exclusion filter. Because `verify_saved_quote()` shares `_attribute_match` and this same threshold check with `quote_search()`, the fix propagates automatically to the save flow — a card now visible in search results is now also saveable, which it structurally could not be before (a user can only try to save a card they were shown).
- **Telemetry**: `QuoteSearchResult.page_range_count` (new field, defaults to 0) counts cards emitted via the honest-range branch per search; threaded into `quotes.py`'s existing `quote_search_completed` ProductEvent metadata (`page_range_count` alongside the existing `retrieved_count`/`candidate_pages`/`no_result` FIX-6 fields) so the fix's real-world hit rate is measurable, not just inferable from the code.

**This is a deliberate, production-data-justified policy reversal of one specific outcome inside the M2 Codex-r2 finding — not a regression.** The underlying r2 concern (majority-vote bbox guessing at a single page is unreliable) is still fully honored: the new code path never guesses a page, it reports a range. What changed is the response to irreducible ambiguity — discard vs. honest-range disclosure — and only for spans of exactly one page boundary, which the plan (§8.1: "ambiguous multi-page attributions are labeled as a range") already anticipated as an acceptable outcome. `test_quote_search_service.py::TestAmbiguousMultiPageExtractedSegmentDiscarded` was rewritten with this framing explicit in its class/test docstrings (renamed from `..._Discarded`, one test now asserts the span-1 emit case using the EXACT Codex r2 probe fixture, a new test asserts the span-2 discard case still holds); `TestVerifySavedQuote`'s equivalent test was updated the same way. Mutation-tested both the span threshold (`>` vs `>=`) and the bbox-range-filter (reverting it to majority-vote reproduces the wrong page from Codex's own probe) — both caught by the updated tests, then restored.

Files: `backend/app/services/quote_search_service.py`, `backend/app/api/quotes.py`, `backend/tests/test_quote_search_service.py`, `backend/tests/test_quotes_api.py`. Full suite: 790 passed, 28 skipped (docker-gated integration). `ruff check app/ tests/`: clean.

---

## 7. Gate RE-RUN after fix (A) — **PASSES**

Same ten queries, same production data, same method; the patched service was loaded into the replay process from `/tmp` via importlib, so production code and data were **not** modified.

| | before | after |
|---|---|---|
| proposed | 10 | 10 |
| **verified** | **1** | **8** |

Recovered — and these are exactly what the users originally asked for:

| user | quote (verbatim, server slice) | page | tier |
|---|---|---|---|
| ric\*\*\* (Eco, pt) | "Colabora para fazer a obra." | pp. 50–51 | exact 100.0 |
| mca\*\*\* (Anijovich, es) | "consideramos que una evaluación valiosa es la que constituye una instancia más de enseñanza…" | pp. 11–12 | exact 100.0 |
| mca\*\*\* | "entendemos que la evaluación es una oportunidad para contribuir a estos procesos formativos." | pp. 86–87 | exact 100.0 |
| mca\*\*\* | "En este libro abordaremos la evaluación, entendida como una oportunidad para que los alumnos…" | pp. 7–8 | exact 100.0 |
| mca\*\*\* | "Consideramos que entender la evaluación como oportunidad implica pensar en la mejora…" | pp. 7–8 | exact 100.0 |
| mel\*\*\* (gramática, es) | "Progresión lineal o encadenada: el rema se convierte en tema de la oración…" (OCR-damaged) | pp. 30–31 | aligned 99.0 |

Per document, excluding the OCR-destroyed one: **Eco 1/1 topics served, Anijovich 1/2** (the miss, "retroalimentación formativa", appears simply not to be a topic of that book). On mel\*\*\*'s document — whose text layer extracts as noise — the system still abstains on 5 of 7 topics, which remains the correct behavior for unreadable source text.

**Verdict: the gate now PASSES.** Quote Finder delivers verbatim, page-cited quotes to the cohort it was built for, on that cohort's own real documents, in Spanish and Portuguese, through the degraded `extracted_text` path. The two failure classes that remain are (i) documents with destroyed text layers, and (ii) topics genuinely absent from the source — both honest.

### Conditions on the pass
1. Fix (A) must be **deployed** before this result describes production. Until then production still runs the discard policy measured in §2.
2. Plus gating: the free/paid split (`FREE_SAVED_QUOTES_LIMIT=30`, paid unlimited) is already live and enforced since v0.25.0. What this gate unblocks is the **decision to push Quote Finder as the paid wedge** — an owner call, now backed by evidence rather than hope.
3. Root causes (B) and (C) are storage-loss consequences and remain open; they cap what legacy documents can ever deliver.
