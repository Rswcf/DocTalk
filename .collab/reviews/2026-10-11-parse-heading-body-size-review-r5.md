> **This is a fresh-context Claude review standing in for the Codex adversarial review. It is not a Codex review.** Codex CLI and OpenAI credentials were unavailable in this cloud session. The owner should still run the real Codex pass locally (`2026-10-11-parse-heading-body-size-codex-prompt.md`).

# Parse v5 heading size rule: adversarial review, round 5 (confirmation of the round-4 fixes)

**Date** 2026-10-11 · **Branch** `claude/sharp-feynman-4vqkq2` @ `45d41dc9` (round 4 reviewed `cae9ff53`; base `main` `d46fc222`) · **Reviewer** Claude, fresh context. I did not design or write the change or any round of fixes.

Scope: confirm that round 4's findings are closed, attack the three round-4 rules (H, J, K), re-check the corpus record, the mutation script, the tests, and the agreement of plan §15, the rules bullet and the code.

## Method

- Parser copies were loaded side by side: `main` (v3), `a9e8245d` (r3), `cae9ff53` (r4-head), and the working tree (identical to `45d41dc9` for `backend/` and `.collab/scripts/`; `git status` clean). Round 1's copy (`780c2131`) and round 2's (`bc51e07b`) were kept for the older repros.
- Every r1–r4 repro was copied from `scratchpad/review4/` to `scratchpad/review5/`, repointed at the copies above, and run (`check_all.py` plus the top-level scripts in `prior/`).
- New repros are synthetic PDFs built with PyMuPDF, or synthetic `PageInfo` for CJK.
- Mutations and candidate fixes ran against `scratchpad/review5/mut/backend`, a copy of `backend/`, never the repo.

## Baseline

| Check | Result |
|---|---|
| `tests/test_parse_service.py` | **80/80 pass** |
| `test_parse_worker_batching.py` + `test_demo_seed_storage.py` | 53 pass, 5 skipped |
| `ruff check app/ tests/` and the two `.collab/scripts` | clean |
| `parse_heading_mutations.py` (on the scratch copy) | **62 mutations, 3 accepted; `survivors: []; stale patterns: []`**. The new H, J, K, "run_chars = longest line" and "document body counts second-look sizes" mutants are all killed. |

**Corpus record (`--old-ref main`): reproduces exactly.** Every one of the 47 rows of `…-corpus.md` matches the fresh run: heading counts, paragraph characters, added/removed, and the per-reason split.
- 47 PDFs, 35 changed, **paragraph characters fell in 0**, 799 removals to read.
- Removed 12,770 = run 10,250 · run-short 255 · run-large 60 · body 1,479 · body-short 210 · inherited 249 · floor 0 · guard 25. 242 removals are unmatched.
- Added 11 (the REIT tile titles).

**Against `cae9ff53`:** 1 PDF changes. ASML p7 gains 3 headings (`€9.3 billion`, `€6.6 billion`, `€2.8 billion`, all v3 headings), which is exactly what the response claims.

**Random documents (`fuzz_exceptions.py`, 600 random documents):** no exception, and no v5-only heading without a dominant-size gap. The floor invariant still holds.

**Cost:** unchanged within noise. K adds one character pass per `_prepare_blocks` call, about 0.08 s per 430,000 characters (chicagofed, 225 pages), and `_prepare_blocks` runs twice.

## Verdict: SHIP-WITH-FIXES (documentation and one test; no code change required)

Every round-4 finding is closed or consciously recorded. On their own repros, the H, J and K fixes do what the response claims, at 0 corpus cost (besides the 3 ASML KPI callouts). None of them breaks any r1–r4 repro.

Attacking H, J and K turned up three trades. None is MAJOR, none is visible to `--old-ref main` in the way that matters, and none is recorded:
- **R5-1, J:** one-text-page broker notes lose R2-3's fix. Equal to v3, worse than r4-head.
- **R5-3, H:** decks whose slides carry a single short bullet block plus a short footnote block. Worse than v3 in one constructed variant.
- **R5-2:** R4-3 is still open in documents of 4 pages or fewer. It is pre-existing.

Record the three in plan §15 and pin K with a test (R5-4). Candidate M for R5-1 is measured below and is the owner's call. With those done, this is safe to merge pending the owner's private-corpus run, the real Codex pass, and F8.

---

## Round-4 findings and every earlier repro, re-run

Counts are headings for **v3 / r4-head / now**.

| Finding | Status | Evidence |
|---|---|---|
| **R4-1** 4-line title is its own page's body | **CLOSED** | deck (4 points) **20 / 4 / 20** (paragraph characters 2,376 / 2,680 / 2,376: the titles are back). Cover 9 / 5 / 9. The 3-point deck and `h2` deck/note are unchanged (20/20/20, 9/9/9). Test `test_four_line_slide_title_is_not_the_page_body`; mutant H killed. The class H creates in its place is R5-3. |
| **R4-2** comment over a source note; first-look document body | **OPEN, recorded** (plan §15 residuals) | (a) 98 / 18 / 18; (b) 100 / 8 / 8. Unchanged, as recorded. |
| **R4-3** a ≥ 200-character title is the page's only run | **CLOSED for documents of ≥ 5 pages.** Open at ≤ 4 pages through the document body size (R5-2). | 3-line title 151 / 4 / **22**; 2-line title 145 / 16 / 16. Test `test_one_page_standfirst_size_is_not_a_body_size_for_the_second_look`; mutant J killed. |
| **R4-4** CJK display cap | **CLOSED** | page 9: 4 / 4 / **0**. Test `test_display_cap_counts_cjk_twice`. The ×2 weight itself is not pinned (R5-4). |
| **R4-5** unpinned round-3 behaviour | **CLOSED** for the listed items | "run_chars = longest line" killed by `test_chart_heavy_page_body_is_not_a_heading`. The first-look mutant is in the script and killed. **Not addressed:** "display base without `rule_floor`" still survives (R5-4). |
| **R4-6** reading rule / raw-float compare | **CLOSED** | `run-short` label, 255 corpus removals in `TO_READ`. I sampled them: body-size sub-heads (10-Q p21, PL Capital p1 at 1.24× its body), table/legend labels, address blocks, KPI callouts; all by design. The same-class clause is a relabel: its removal changes 0 corpus PDFs and no test (R5-4). |
| **R4-7** plan and docstring drift | **CLOSED**, small residue | §3 and §5 marked superseded or prototype; docstring "v1-v4". Residue: R5-5. |
| r1 F1 2–3-line title as page body | CLOSED | `f_slide_title_clean` 6/6/6, `f_slide_title` 15/15/15, `f_wrapped_title_sets_ref` 7/7/7 |
| r1 F2(a) one text page sets a chart book's body | CLOSED / by design | `f_docref_one_page` 21/21/21; `g_docref_share` 5/15: 20/5/5, 1/20: 21/21/21 |
| r1 F2(b)/F3(a) | OPEN, accepted | `f_dominant_add` 32/3/3 |
| r1 F3(b), F4, F7 | CLOSED | `f_ws_spans_double` 3/3/3; `f_cjk_digits2` 2/2/2 ×4; `f_nonpdf_worker` 2/2/2; `g_nonpdf_fuzz` 0 of 400 differ from v3 |
| r1 F5 Word "Double" | OPEN by decision | 72/72/72 |
| r1 F6 / R2-7 cost | PARTLY CLOSED (unchanged) | ms/page 11/22/24 (10-K table), 45/127/126 (4pt table), 53/131/138 (+ watermark); noisy machine |
| r1 F8 version vs v4 | **OPEN (owner)** | `PARSE_PIPELINE_VERSION = 5`; no v4 branch in this clone |
| R2-1(b) tiles | OPEN, accepted | `g_tiles2` 36/4/4 |
| R2-3 lone exhibit comment | CLOSED for its repro. The one-text-page variant regresses to v3: R5-1. | `g_single_run_body` 98/2/2 |
| R2-4 | CLOSED | `g_rule_floor_low` 7/7/7 |
| R3-1 | CLOSED | e1 17/14/14, e2 35/32/32, e4 204/13/13 |
| R3-3 | CLOSED | e3 179/4/4 |
| R3-4 | OPEN, accepted | a1 1/0/0 |
| R3-5 | CLOSED | b1(a) 93/8/8; b1(b) 252/252/252 (= v3, recorded) |
| R2-2/R3-2 BIS covers | CLOSED | WP 1367 with a 4-line title: 100/99/99 (the 1 is `No 1367`, guard) |

---

## Findings

### R5-1 · MINOR · J undoes R2-3 on one-text-page broker notes (equal to v3, worse than r4-head; unrecorded)

`backend/app/services/parse_service.py:1081`: `body_sizes = … if n >= 2`.

**Input (`j1_one_text_page_flash.py`).** R2-3's broker shape with a single text page:
- p1: 40 lines at 10pt;
- 6 exhibit pages, each with a 12pt `Exhibit k: DRAM contract prices`, 25×6 cells at 6.5pt, and a 3-line 10pt comment;
- 2 disclosure pages at 7pt.

Neither 10pt (1 of 9 pages) nor 7pt (2 of 9) reaches 25 %, so there is no document body size. In r4-head the second look admitted the comment at 10pt, because p1 uses 10pt. J needs two pages, so the exhibit pages fall to the floors (6.5pt), and both the comment and the exhibit title become headings again.

| shape | v3 | r4-head | now |
|---|---:|---:|---:|
| 1 text, 6 exhibit, 2 disclosure pages | 65 | 1 | **25** |
| 1 text, 6 exhibit, 1 disclosure page | 65 | 1 | **25** |
| 1 text, 8 exhibit pages | 73 | 1 | **33** |
| 1 text, 3 exhibit pages (one page is 25 %) | 53 | 1 | 1 |
| 2 text, 6 exhibit, 2 disclosure pages | 106 | 2 | 2 |

In the first case:
- The comment `inventories at module makers …` is absent from v5's chunk text and present in r4-head's.
- Paragraph characters: 21,162 → 19,554.
- `--old-ref main` cannot show this, because v5 equals v3 on those pages.

A one-page "first take" or flash note followed by exhibits is a common broker format. J was meant to stop one cover standfirst from becoming a body size, not one page of real body text.

**Candidate M (measured).** Admit a size on the second look if it is the body size of ≥ 2 pages, **or** if it holds ≥ 1,000 first-look running characters in the document (one full text page; a cover standfirst holds ~250). The patch is in `scratchpad/review5/candM/parse_service.py`: `_reference_sizes` sums each page's running characters at its own body size per size class.
- 80/80 tests.
- Every r1–r4 repro is identical to the current code (`check_cand.py`), including R4-3: 22.
- J1: 25 → 1.
- Corpus vs the current code: only ASML p7, whose 3 KPI callouts go back to r4-head (`run-short`, read).

The owner decides. If M is not taken, record J1 in §15 residuals next to R4-2.

### R5-2 · MINOR · R4-3 stays open in documents of ≤ 4 pages, through the document body size (worse than v3; pre-existing since r1; labelled `inherited`)

`parse_service.py:1078-1079`. `common` takes every page-body class held by ≥ 25 % of pages, and `doc_ref = max(common)`. With 4 or fewer pages, one page is 25 %, so a cover's standfirst size competes with the real body, and as the larger size it wins. J only guards the second look. The exhibit page then gets the same size one step later, as `document`.

**Input (`j2_short_doc_standfirst.py`).** R4-3's shape, shortened:
- a cover (26pt title, 4-line 14pt standfirst, 5 lines of 9pt summary): page body 14;
- 1 body page at 9pt;
- 2 exhibit pages, each with a 14pt exhibit title over a table and a one-line comment.

| exhibit title | v3 | r1 | r2 | r3 | r4-head | now |
|---|---:|---:|---:|---:|---:|---:|
| 3 lines, exhibit-title lines kept | 6 | 0 | 0 | 0 | 0 | **0** |
| 2 lines, exhibit-title lines kept | 4 | 0 | 0 | 0 | 0 | **0** |

With 7 or 10 pages, v5 keeps them (2 body pages make 9pt the document body). All 6 lost lines are labelled `inherited`, so the owner's reading would see them.

Not caused by round 4. But the response marks R4-3 "Fixed", and the class is only closed from 5 pages up. Record it in §15 ("in documents of ≤ 4 pages, a cover standfirst that is its page's body becomes the document body size"). A structural fix (e.g. `n >= max(2, 25 %)` for `common` when N ≥ 2) needs its own corpus run, because two-page notes would lose their only body size.

### R5-3 · MINOR · H's trade: a slide whose body is one short bullet block is no longer its own body (worse than v3 in (a) and (c); equal to v3 in (b); unrecorded)

`parse_service.py:1017-1027`. A lone run of ≤ 160 characters counts only with a partner. That is right for R4-1's 4-line title. A slide's single list of short one-line points (four lines, ≤ 160 characters) has the same shape. When the rest of the slide's running text is under 200 characters, or is small text, the slide loses its own body size.
- The second look cannot help when the slide also has a smaller run, because it is R3-1's ratio test: 16pt > 1.25 × a 10pt note.
- J also stops 16pt from being a body size when every content slide is like this.

**Input (`h5_deck_short_bullets.py`)**, 960×540. Each content slide has:
- a 24pt title;
- four one-line 16pt points (151 characters, one run);
- four one-line 10pt footnotes stacked as one run (189 characters: counted, but under 200 alone).

| case | v3 | r4-head | now | what |
|---|---:|---:|---:|---|
| (a) + 3 "statement" slides (28pt title, 5-line 20pt paragraph): document body 20pt | 9 | 9 | **3** | the 6 content-slide titles (24 ≤ 1.25 × 20) are lost, labelled `inherited` |
| (b) + 6 chart slides of 8pt labels (floors 8, no document body) | 36 | 12 | **36** | the 24 bullet lines become headings (display exemption against the floors), = v3 |
| (a′) the same without footnotes | 9 | 3 | 3 | pre-existing: a sparse slide already inherits |

**(c) Share knife-edge (`h6_lead_share_knife_edge.py`).** A note's first page has:
- a 5-line 12pt lead (355 characters);
- a 10-11-line 10pt body;
- four one-line 8pt footnotes (159 characters, one run).

r4-head counted the footnotes, so the lead held < 30 % and the page body was 10pt. With H the footnotes drop out of the total, the lead reaches 30 %, the page body becomes 12pt, and the 14pt section head (≤ 1.25 × 12) is lost. v3 and r4-head keep it. It is a 2-line band (body 10–11 lines), and the harness labels it `body`, which is not read. The underlying "largest size with 30 %" rule loses the same heading in r4-head at 9 body lines.

None of these is on the 47 PDFs (H changes 0). (b) equals v3, so `--old-ref main` cannot show it. Record (a)–(c) in §15 next to the "4-line body text ≤ 160 characters" residual. The owner's slide decks are where to look: read `inherited` removals on content slides.

### R5-4 · MINOR · Round-4 behaviour that no test pins

These mutants of `45d41dc9` pass all 80 tests (`scratchpad/review5/mut/extra_mutations.py`, `extra2.py`):

- **K at ×3** (`len + 2 × CJK`). Without a failing test, this would make a 4-line CJK title of 54–80 characters body text. With the k1 cover (4-line 22pt title over a 10.5pt cover), 56, 60 and 76 characters give 4 → 0 headings.
  - `test_display_cap_counts_cjk_twice` only checks the upper side: 148 CJK characters are long at ×2 and at ×3.
  - Add the lower side: a 4-line CJK title of about 60 characters at ≥ 1.5× its page body stays four headings.
- **J on raw floats** (no `_cluster_sizes`): 0 corpus change. Page body sizes are cluster means, so two text pages at 9.98 and 10.0 would each count once, and R2-3 would break (as in R5-1). Add a test with two text pages whose body sizes differ within one class.
- **R4-6 same-class clause removed**: 0 corpus change. It is a relabel, so acceptable as an accepted survivor; list it in the script.
- **Display base without `rule_floor`** (R4-5's second item, not addressed by the response): still survives. Add it to the script as accepted, or pin it.

### R5-5 · NIT · Documentation drift

- `.claude/rules/backend.md:46`, "Word "Double" spacing forms no runs (same result as v4)". R4-7 changed the docstring to v1-v4/main; this line should say v3 (`main`). v4 is unmerged (F8).
- `.collab/reviews/2026-10-11-parse-heading-body-size-codex-prompt.md:29` lists `_weighted_median`, which no longer exists in `parse_service.py`.
- Plan §15:
  - "≥ 25 % of ALL pages" counts pages with at least one cleaned line (`len(per_page)`). Blank and image-only pages do not count.
  - The first-look rule omits the fallback when no size class reaches 30 % (the heaviest class, `:1042`).
- Harness `parse_heading_corpus.py:97-99`: `body_from_short_runs` still means run_len ≤ 3, while H's short run is ≤ 3 lines **or** ≤ 160 characters. This is label-only. A 4+-line short-run removal is caught first as `run-short` (checked with `h7_partnered_display_runs.py`: two partnered 4-line 24pt blocks per slide, v3 24 → 8, all 16 labelled `run-short`; = r4-head, the R2-1(b) mechanism).

### Note (not a finding) · K's boundary

A 4-line CJK display title is now capped at 80 CJK characters (`k1_cjk_long_title.py`: 84, 88 and 100 characters give v3 4 / r4-head 4 / now **0**). In words, that is looser than Latin's 160 characters, so it is consistent by design, and only near-full 4-line titles at display size reach it. Worth one clause in §15.

---

## Checked and holding

- **H and the display exemption.** H can only *remove* a run from a page's running text. The page's reference then falls (more headings, bounded by the floor gate, so ≈ v3), moves to the second look or the document body (R5-3(a)), or shifts shares (R5-3(c)). It cannot add a heading over v3: the floor invariant held on the fuzz and on every repro.
- **CJK and H.** With K, CJK runs of 81–160 code points are no longer short, so H drops fewer CJK runs than it would without K (conservative). A CJK page whose body is one short paragraph is restored by the second look whenever its size is a 2-page body size and it is not over 1.25× the page's smallest run. That is R5-1/R4-2 territory, not a CJK-specific gap.
  - Page shares (`REF_MIN_PAGE_CHARS`, 30 %) count code points unweighted. That is consistent with v1–r4 and not changed by K.
- **J and 2-page documents.** With 4 or fewer pages, J changes nothing, because the document body size admits any single page (R5-2 is the side effect).
- **Plan §15, the rules bullet and the code agree** on every clause I checked:
  - rule size and size class;
  - `run_chars` with CJK ×2;
  - short = ≤ 3 lines or ≤ 160 characters, with a partner;
  - 30 % / 200 characters;
  - document body from first-look sizes at 25 %;
  - second look on ≥ 2 pages (size classes) and ≤ 1.25 × the smallest run, used if ≥ the document body or the same class;
  - floors in two units;
  - display exemption ≤ 160 and ≥ 1.5 × max(reference, floors).

  The exceptions are R5-5.
- **Repo untouched.** Every mutation and candidate ran on `scratchpad/review5/mut/backend`. `git status` is clean apart from this file.

## Not reproduced

- A corpus instance of R5-1, R5-2 or R5-3: the 47 PDFs have no one-text-page flash note, no ≤ 4-page note with a standfirst cover, and no deck of single-list slides. The owner's private corpus is where to look:
  - read `inherited` on slides and short notes;
  - and, since R5-1 and R5-3(b) equal v3, compare against `--old-ref cae9ff53` as well as `main` on broker notes and decks.
- OCR span sizes, real tategaki PDFs, and the private 50-PDF corpus, as in rounds 1–4.

## Required before merge

1. **Record R5-1, R5-2 and R5-3 in plan §15 residuals**, or take candidate M for R5-1.
2. **Add the K lower-bound test** (R5-4).
3. **F8**: settle the version order with v4 (unchanged).

**Recommended:**
- R5-4: a two-text-pages-in-one-class test for J's clustering, and list the two relabel/base survivors as accepted in `parse_heading_mutations.py`.
- R5-5: doc drift.
- R2-7: compute `_prepare_blocks` once (unchanged).

| # | Sev | Where | Summary |
|---|---|---|---|
| R5-1 | MINOR | `parse_service.py:1081` | J's ≥ 2-page rule puts R2-3's exhibit comments and titles back into headings on one-text-page broker notes (v3 65 / r4-head 1 / now 25); = v3, worse than r4-head, unrecorded; candidate M (≥ 2 pages or ≥ 1,000 running characters) measured: 80/80 tests, r1–r4 repros unchanged, corpus only ASML's 3 callouts |
| R5-2 | MINOR | `parse_service.py:1078-1079` | R4-3 is closed only from 5 pages up: in ≤ 4-page documents the cover standfirst size becomes the document body (`max(common)`) and exhibit titles are lost; worse than v3, pre-existing since r1, labelled `inherited`; record |
| R5-3 | MINOR | `parse_service.py:1017-1027` | H makes a slide whose body is one ≤ 160-character bullet list body-less: (a) titles lost through an inherited larger document body (v3 9 / r4-head 9 / now 3, `inherited`); (b) bullets become headings in chart-heavy decks (36/12/36, = v3); (c) a 2-line share knife-edge loses a 14pt head (labelled `body`); constructed, record |
| R5-4 | MINOR | `tests/test_parse_service.py:1369`; `parse_heading_mutations.py` | Surviving mutants: K ×3 (would drop 54–80-character 4-line CJK titles), J on raw floats, the R4-6 same-class clause, and the display base without `rule_floor` (R4-5 item, unaddressed) |
| R5-5 | NIT | rules `:46`; codex prompt `:29`; plan §15; harness `:97-99` | "same result as v4"; `_weighted_median` no longer exists; "ALL pages" = pages with text, no heaviest-class fallback in §15; `body_from_short_runs` uses the pre-H notion of short |
