# Review r1 — Claude subagent (NOT the Codex gate)

**This is not the Codex adversarial review that CLAUDE.md requires.** The cloud container this work was done in
has no Codex CLI and no ChatGPT/OpenAI credentials, so Codex could not run. A fresh-context Claude subagent
reviewed the uncommitted diff with `codex-r1-prompt.md` as its brief. **Codex r1 is still owed before merging:**

```bash
cat .collab/reviews/2026-10-11-citation-snippet-prefix/codex-r1-prompt.md \
  | codex exec -m gpt-5.5 --sandbox workspace-write -C <worktree>
```

Verdict: **approve with fixes** (findings 1 and 2 before merge). Both fixed in the same commit; responses below.

## Findings and responses

| # | Tag | Finding | Response |
|---|---|---|---|
| 1 | SHOULD-FIX | The `": "` fallback inherited the loop's `searchText.length >= 10` gate, so a 10–29-char tail could match. A snippet often misses whole because `Page.content` keeps raw line breaks while chunk text is joined. Input: page `"Late fees: see Schedule 4.\n\nRemedies\nIf the Buyer\nfails to pay, …"`, snippet `"If the Buyer fails to pay, … Late fees: see Schedule 4."` → `[11,15]`, the unrelated first line. | **Fixed.** Fallback candidates (`": "` and `" — "`) need ≥30 chars, the same floor the whole snippet never goes below (`snippetMatch.ts` `MIN_FALLBACK_LENGTH`). The reviewer's input is a test; both forms now return `null`. |
| 2 | SHOULD-FIX | Map-reduce summary snippets are internal coverage text (`"Section group 1 map summary coverage:\n- target sections: …"`). The old `"Map-reduce section summary: "` prefix guaranteed `null`; now the tail after `"target sections: "` could match a section name in the prose. | **Fixed.** `navigateToCitation` sets no `highlightSnippet` when `retrievalModality === 'summary'` (store test added). Covers new and stored summary citations; `retrieval_modality` is persisted and mapped by both `sse.ts` and `mapCitationPayload`. Quoting that coverage text on shared answers/exports predates this change — follow-up, not here. |
| 3 | OK, wording | "Verifier evidence unchanged" is not literal: the summary label's words no longer count (one constructed answer went pass→warn, which triggers the billed repair), and section titles over 98 chars now count in full (warn→pass). Tables and continuation are unchanged. | **Accepted, wording corrected** in `.claude/rules/frontend.md`: a heading's words and numbers still count as evidence. The summary label is internal text; it should never have supported a claim. |
| 4 | NIT | Continuing an answer from before the deploy gives the same ref + chunk a different `text_snippet`, so `citationSourceKey` and `_prepare_export` dedup see two sources once. | **Accepted as is.** One-time per pre-deploy message. |
| 5 | OK | `section_title` in stored citation JSON breaks nothing: public snapshots and digests use `PublicAnswerCitation`'s field list, conversation shares and exports read named fields, `citations` is `List[dict]`, and the frontend mappers ignore it. | — |
| 6 | NIT | Converted-PDF path is unchanged. The new snippet can match there only if the 100-char cut lands between words (`findEvidenceRange` rejects a mid-word cut). | **Accepted, no change.** The snippet is not consulted on that path in practice: synthetic bboxes are slivers, so the dummy-full-page gate never fires (see `reproduction.md`). Trimming the partial word belongs to the inline-highlight plan. |
| 7 | OK | No other code puts the title in front of a snippet or depends on it. The remaining title concatenations are LLM-prompt labels or lexical scoring. | — |
| 8 | NIT | The verifier test's overlap assertion passed without `section_title`. | **Fixed.** The snippet shares no words or numbers with the answer. Without the field: low_overlap 1, numeric 1. With it: 0 and 0. |
| 9 | OK | No credits/settlement or verified-quote code touched. | — |

## After the fixes

- `npm run test:unit` 236/236; backend non-integration 1151 pass; integration (one process) 138 pass; ruff clean;
  `npm run build` passes.
- Every-chunk replay (see `reproduction.md`) unchanged with the 30-char floor: DOCX 1/6→6/6, lead-paragraph MD
  1/6→6/6, `#`-first MD 5/6→5/6, legacy snippets 6/6, 6/6, 5/6.
