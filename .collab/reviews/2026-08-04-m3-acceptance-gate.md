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
