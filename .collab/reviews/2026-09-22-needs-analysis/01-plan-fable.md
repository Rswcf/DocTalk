# Needs analysis — plan (Fable 5.1, 2026-09-22, step 1 of 2)

The owner's question (verbatim in `README.md`): read every historical conversation; is the product failing to
meet users' needs, and is that — more than price — why almost nobody returns; then, weighing cost, how should
pricing be designed and does the system's capability need to rise. This file is the analysis design: the
hypotheses, the codebook the coders fill, the worker prompts Claude dispatches verbatim, the cross-tabs Claude
computes, and the questions the synthesis (`03-synthesis-fable.md`, step 2) answers. Nothing here changes a
product surface; the 09-28 rule (strategy §5, ruling 4.8) stands.

Inputs read: `README.md`, `export_qa.py`, `02-cost-to-serve-claude.md`, the churn read
`../2026-09-22-pricing-research/free-quota-at-churn.txt`, the pricing synthesis `20-synthesis-fable.md` (with
its ChatDOC erratum) and `04-claude-after-synthesis.md`, strategy `.collab/plans/2026-09-22-next-strategy.md`
§1–2, backlog `2026-09-03-backlog-decision.md` §9.14–9.19, the May retrospective
`2026-05-23-user-funnel-retrospective.md` (Appendix B), the R2 replay memory, the 06-12 Quote Finder plan, and
one structural pass over the export (aggregates only, run 14:50Z).

## 0. Standing facts, the export as it is, and the era problem

**Do not rediscover.** These are settled and the coding must build on them, not re-derive them:

- The only multi-week retaining cohort was thesis writers extracting verbatim quotes + page numbers (06-12).
  The 19 users who ever clicked a citation (163 clicks) never reached Quote Finder (0/19; §9.17). The two
  deepest returners are the two heaviest citation clickers (`4d660a71` 20 clicks, `558731d6` 31).
- The only payer (`755788ef`, 2026-05-06, a 492-page exam PDF) was refunded the same day because RAG recalled
  ~8 fragments; R2a/R2b (05-24, v0.18.2–0.18.4) fixed page grounding, terse-query refusal, garbled-text OCR
  and the "fragment" jargon, and the in-prod replay confirmed the fixes on that user's own queries.
- Walls, not credits, carry every purchase signal: `file_size` produced the only sale and the only post-A1
  checkout; `academic/legal_domain_mode` is the first source of upgrade clicks (24 of 37 in the export) and
  Domain Mode was never used once (`domain_mode` NULL on all 93 sessions).
- May's Appendix B coded 47 users into eight churn reasons (large-document coverage ~10–12, page/citation
  failure ~6, export refused ~5, over-rigid persona ~5, scanned/non-Latin garbled 2+, no reply 4, upload/UI
  confusion 2, done-once-no-hook ~15–18) and found the sweet spot at small documents (<40 pages) with focused
  questions. The new codebook maps onto those eight (§2.7) so step 2 can say what changed.
- Cost (02): a Flash answer ≈ $0.0037, a Pro answer ≈ $0.017 (peak, no cache); ~90% / ~80% LLM margin at the
  Plus credit price; all non-owner LLM spend ever ≈ a few dollars. **LLM cost does not constrain capability
  upgrades.** Free is de facto a one-time 500-credit pool: signup stamps `monthly_credits_granted_at`, so the
  monthly 300 has arrived twice in the product's history (600 credits, two grants). A Flash answer reconciles to
  ≈ 11 credits (not the 5-credit pre-debit), so 500 credits ≈ 45 Flash answers and 300 ≈ 27.

**The export (owner-run, 12:48Z; raw files outside the repo).** 175 non-owner users; 67 with conversations;
93 sessions (81 own-document, 12 demo); 311 user / 283 assistant messages; 28 user messages without an answer
— **all of them March–May 2026** (7 / 17 / 4), none after the 05-24 lost-answer fix; 120 own documents (106 PDF,
10 DOCX, 2 TXT, 1 PPTX, 1 XLSX), 15 in `error` (10 `VECTORIZE_FAILED` — the 04-15–19 Qdrant incident, 3
`OCR_FAILED`, 2 `DOWNLOAD_FAILED`); pages p50 51, p90 289, max 696; `parse_method` NULL on 87 (pre-R2b), `ocr`
9, `text` 24; 49 with a summary. 182 anonymous demo sessions with 236 user messages (152 sessions have one
message; 76 on `alphabet-earnings`, 63 on `attention-paper`, 30 on `court-filing`). **Zero feedback items.**
User-message scripts: Latin 263 (en/es/pt/fr/it/de/cs/id/vi/tr and others — the coder detects the language),
Arabic 27, Cyrillic 12, CJK 9. User text ≈ 119k characters; assistant text ≈ 871k. Message `meta` carries
nothing except an `action_plan`/`artifacts` marker on 3 assistant messages (ordinary answers persist no
metadata, so mode and model per answer are not in the export; per-user model aggregates are).

**The era problem — make it structural.** Sessions by month: Mar 5, Apr 31, May 32, Jun 3, Jul 3, Aug 16, Sep 3.
About 68 of 93 registered sessions predate the R2 fixes; roughly 25 sessions describe the product after 05-24,
and about 19 the product after the 08-08 parse-latency fix. So most of the corpus describes a product that no
longer exists, and "does today's product meet needs" is not answerable from transcripts alone. Every session
carries a mechanical `era` (§2.2), the synthesis reports failures by era, and every failed turn carries
`replay_candidate` so a replay list against the current stack falls out of the coding (the 05-24 harness and
the M3 gate already did this on ten queries; §4.5).

| Era | Dates | What the product was |
|---|---|---|
| `E0_pre_R2` | ≤ 2026-05-23 | ~8-fragment retrieval; page numbers absent from the model's context; "fragment" jargon; injection rule refusing terse queries; presence-only OCR trigger; 25 MB free cap; lost answers on cancel (fixed 05-24); Qdrant incident 04-15–19 |
| `E1_R2_latency` | 2026-05-24 – 2026-08-07 | R2a/R2b live (page grounding, terse queries, OCR quality trigger, jargon); precise/cross-lingual citation focus (06-13); 50 MB free; **but** backend in `europe-west4` while data sat in `us-west2` — parse throughput collapsed ~60×, large documents timed out |
| `E2_post_latency` | 2026-08-08 – 2026-09-06 | latency fixed, batched parse; Quote Finder M2/M3 live (08-02/03); suggested questions still invisible on first open (fixed 09-09) |
| `E3_post_TA` | ≥ 2026-09-07 | walls open Stripe directly (A1), Domain Mode trial (A3), page caps, suggested-questions fix (09-09), honest session copy (09-10) |

**Privacy rules (binding on every worker and on step 2).** The repository is public. The raw export and every
per-record output live only under the export directory in `/private/tmp` and are never copied into the repo.
Anything written into the repo is aggregate; examples are paraphrased; no run of more than eight consecutive
words from any user or assistant message is reproduced anywhere — not in JSONL `notes`, not in summaries; users,
sessions and documents appear only as their 8-character prefixes; names, e-mails, institutions, file names,
URLs or any other identifying detail that appears inside a transcript are never copied out of it.

## 1. Hypotheses, and the evidence in this corpus that would support or refute each

Each hypothesis is stated so that the codebook fields decide it. Counts, not rates, wherever a cell is under
five (67 active users, 13 returners).

| # | Hypothesis | Supports | Refutes |
|---|---|---|---|
| **H1 (owner)** | Needs unmet → no return | Conversations whose `overall_outcome` is `job_failed`/`job_partly_done` are the majority of real-work sessions; `leave_reason = gave_up_after_failure` dominant; failures cluster on capabilities the product lacks; explicit complaints; capability requests for things that do not exist | Most real-work sessions end `job_done_*`; failures are concentrated in `E0` on defects since fixed; `E2/E3` sessions succeed and still do not return |
| **H2** | Episodic — the need was met in one sitting, nothing to come back for | `job_done_satisfied` + `jtbd_recurrence = one_off` + span < 1 day + no failure on the last turn (the churn read's cell "own · cited · < 1 day" is 16 of 44); document types that are one-off (an assignment, a contract, a manual) | Recurring jobs (thesis, course, ongoing research) that still did not return; satisfied users who came back to the same document (8 of 13 returners did) |
| **H3** | Never activated — empty pane, parse failure, unopened documents | `activation ∈ {uploaded_only, events_only}` (21 users uploaded and never chatted; 15 error documents); first questions that are generic ("summarise this") rather than specific; one-message sessions with no follow-up and no citation click | First questions are specific; one-message users got a satisfying answer (evidence codes) — that is H2, not H3 |
| **H4** | Answer quality fails on specific document classes — large, scanned/garbled, tables/spreadsheets, non-English or cross-lingual | `failure × doc_size_band`, `× doc_type_coded`, `× cross_lingual` show concentration (the churn read: non-real-work users had *larger* documents, p50 92 vs 27 pages) | Failures are flat across size and type; large-document sessions in `E1+` succeed |
| **H5** | Reliability — no reply, errors, slowness | `missing_answer_no_reply` (28, all ≤ May), `slow_complaint`, `truncated_or_cut_off`, parse errors (15); wait gaps > 60 s before abandonment | Everything in this class is `E0` and fixed; no `E2/E3` instance |
| **H6** | Price / walls | `leave_reason = blocked_by_wall`; `wall_reaction ∈ {left_within_10min, checkout_abandoned}`; `price_mentioned`; users who stop at a wall after a satisfied answer | Walls are met by users who kept going (22 of 38 did); nobody mentions price (May: 0 of 47); walls fire before value (30 of 38 first walls were before the first message) |
| **H7** | Trust — wrong or invented answers, wrong pages, citations that contradict | `incorrect_or_hallucinated`, `citation_wrong_or_missing`, `explicit_correction`; citation clicks followed by a complaint | Corrections are rare; citation clicks are followed by continued work |
| **H8** | Job mismatch — users want generation, translation, whole-document or export tasks that the assistant refuses or cannot do | `generation_refused`, `export_or_format_refused`, `refusal_overrigid_scope`, `whole_doc_coverage_incomplete`; capability requests `write_or_draft`, `translate_*`, `summarize_whole_document`, `export_*` | Those requests are few and mostly satisfied |
| **H9** | The next-best alternative is free and good enough — users treat DocTalk as a general chatbot, or name one | `offtopic_general` questions; `alternatives_mentioned`; `outside_knowledge_or_web` requests; "answer without the document" | Questions are document-bound; nobody names an alternative |
| **H10** | The differentiator is invisible — verification behaviour exists (citation clicks, "which page", "quote exactly") but never reaches Quote Finder or a save | `verbatim_quote` / `locate_page_or_item` question types and citation clicks in sessions with no `quote_*` event (base 0/19) | Those question types are absent from the corpus |

`H2` and `H3` are the strongest alternatives to the owner's `H1`; `H4`–`H8` are the ways `H1` could be true in
detail; `H9` is the pricing lens's "next-best alternative"; `H10` is strategy §2.1's mechanism. Per user, the
coder records which hypotheses that user's history supports (`hypothesis_votes`), so step 2 can count them.

## 2. Codebook

### 2.1 Conventions

- One record per **user** (registered), one per **conversation** (session), and inside each conversation one
  entry per **user turn**. Anonymous demo sessions get a lighter per-session record (§2.5).
- Field names are fixed; enumerations are closed (`other` exists where needed and must be explained in
  `notes`). Multi-valued fields are JSON arrays; empty array means "none observed"; `null` means "cannot judge".
- Every judgment carries a confidence: `high` = the transcript states it or the rule fires unambiguously;
  `medium` = inferred from behaviour with one plausible alternative; `low` = a guess the synthesis should not
  count alone.
- Mechanical fields come from the pre-pass (§3.1) and are copied, never re-derived, by the coders.
- `notes` and `summary` are paraphrase, ≤ 8 consecutive verbatim words, no identifying detail.

### 2.2 Mechanical fields (pre-pass output; coders copy them)

Per session (`sessions_mech.jsonl`): `sid`, `uid` (null if anonymous), `demo` (bool), `demo_slug`, `doc`
(prefix), `doc_status`, `doc_error`, `doc_file_type`, `doc_pages`, `doc_size_band` (`xs` ≤ 10 · `s` 11–40 · `m`
41–100 · `l` 101–300 · `xl` > 300 · `unknown`), `doc_parse_method`, `doc_text_quality`, `doc_has_summary`,
`collection` (bool), `era` (table in §0, by session `created`), `n_user_msgs`, `n_assistant_msgs`,
`n_unanswered` (user message not followed by an assistant message), `answered_flags` (array, per user turn),
`cited_counts` (array, per assistant turn: length of `cited_pages`), `continuation_flags`, `has_action_meta`
(bool), `first_t`, `last_t`, `span_minutes`, `max_gap_minutes` (largest user→assistant gap), `citation_clicks_in_window`
(count of the user's `citation_clicked` events between `first_t − 2 min` and `last_t + 30 min`),
`walls_in_window` (array of `{reason, is_demo, t, followed_by_upgrade_click, followed_by_checkout}` for
`limit_hit` / `paywall_opened` events in the same window), `session_index_for_user` (1-based, by time),
`same_doc_as_previous_session` (bool).

Per user (`users_mech.jsonl`): `uid`, `signup`, `plan`, `balance`, `segment` (the churn read's exclusive
buckets in its first-match order: `paid` · `hit_wall` · `real_work_no_wall` · `light_use_no_wall` ·
`uploaded_never_chatted` · `never_started`), `n_docs`, `n_error_docs`, `doc_pages_max`, `doc_types`,
`n_sessions`, `n_demo_sessions`, `n_user_msgs`, `n_unanswered`, `active_days`, `span_days` (first to last user
message), `returned_later_day` (bool: a user message on a later calendar day within 7 days of the first — the
0.149 base's definition, 10 of 67; `active_days ≥ 2` is the broader flag, 13 of 67),
`returned_same_doc` (bool), `citation_clicks`, `walls` (array of `{reason, is_demo, t}`), `upgrade_clicks`
(array of `{source, reason, t}`), `checkout_created`, `checkout_completed`, `credits_spent_chat`,
`credits_spent_other`, `usage_by_model`, `eras_active` (array), `assignment` (`W1`/`W2`/`W3`/`none`).

### 2.3 Conversation record (`Wn_conversations.jsonl`, one line per session)

```json
{"sid":"0a1b2c3d","uid":"4d660a71","worker":"W1","calibration":false,
 "era":"E0_pre_R2","demo":false,"doc":"a1b2c3d4","doc_size_band":"l",
 "doc_type_coded":"pdf_text","doc_lang":"es","question_langs":["es"],"cross_lingual":false,
 "jtbd":"thesis_or_paper_writing","jtbd_recurrence":"recurring","persona":"graduate_researcher",
 "first_question_specificity":"specific","satisfied_first_answer":"partial",
 "turns":[
   {"i":0,"qtype":"verbatim_quote","qtypes_extra":["locate_page_or_item"],"lang":"es",
    "answer":"present","answer_lang":"es","answer_matches_lang":true,"cited":3,
    "outcome":"partial","outcome_evidence":["rephrase_same_question"],
    "failure":["citation_wrong_or_missing"],"capability_request":["verbatim_quotes_with_pages"],
    "replay_candidate":true,"notes":"asked for the exact sentence and its page; got a paraphrase","confidence":"high"}
 ],
 "overall_outcome":"job_partly_done","dominant_failure":"citation_wrong_or_missing",
 "walls_in_session":[],"wall_reaction":null,"wtp_signals":[],"alternatives_mentioned":[],
 "value_units_mentioned":["pages"],"last_turn_outcome":"unknown_terminal",
 "leave_reason":"job_done_partial","leave_reason_confidence":"medium",
 "appendix_b_reason":"B2_page_or_citation_failure",
 "summary":"thesis writer pulling quotes with page numbers from a Spanish monograph; paraphrases where verbatim was asked; kept going",
 "confidence":"high"}
```

Field definitions (enumerations in §2.6):

- `doc_type_coded` — the coder's judgment from metadata plus transcript: `pdf_text` (native text layer),
  `pdf_scanned` (image-only, OCR'd or not), `pdf_garbled` (text layer present but the assistant or the user
  reports mojibake / nonsense), `docx`, `pptx`, `xlsx`, `txt`, `url`, `demo`, `none`, `unknown`.
- `doc_lang` — ISO 639-1 of the document as far as the transcript reveals it (assistant quotes it, user says
  so); `unknown` otherwise. `question_langs` — languages of the user's messages. `cross_lingual` — any user
  message in a language different from `doc_lang` (both known).
- `jtbd` — what the user was trying to accomplish with this document (§2.6.1); `jtbd_recurrence` — would
  this job bring the user back (`recurring`: a thesis, a course, ongoing case work, a report cycle; `one_off`:
  one assignment, one contract, one manual look-up; `unclear`).
- `first_question_specificity` — `specific` (names a topic, page, item or question that only this document
  answers), `generic` ("summarise", "what is this about", "key points"), `test` (hello, gibberish, capability
  probe, prompt injection).
- `satisfied_first_answer` — `yes` / `partial` / `no` / `missing` (no answer) / `unknown` (the user left with
  no signal), by the rules in §2.7.
- `turns[]` — one entry per user message, `i` = its 0-based position among the session's user messages.
  `answer` = `present` / `missing`; `answer_lang` — the answer's language; `answer_matches_lang` — true when it
  equals the turn's `lang`, `null` when the answer is missing. `cited` copies the mechanical count. `outcome` and `outcome_evidence` by
  §2.7; `failure` is the mechanism (may be several); `capability_request` — anything the user asked for that
  the product did not do in that turn, whether or not it exists elsewhere in the product (§2.6.5 says which
  exist). `replay_candidate` — true when the turn failed for a reason that a re-run on today's stack could
  test (retrieval, page lookup, coverage, language, tables); false for walls, parse errors, refusals of
  off-scope requests.
- `overall_outcome` — `job_done` (the stated job was accomplished), `job_partly_done`, `job_failed`,
  `evaluation_only` (the user was probing, not working), `unclear`. `dominant_failure` — the one failure that
  best explains the outcome, or `none`.
- `walls_in_session` — copied from the mechanical window; `wall_reaction` — what the user did next (§2.6.7).
- `wtp_signals` — willingness-to-pay signals seen in this session, from events or text (§2.6.8).
- `alternatives_mentioned` — short tokens (`chatgpt`, `gemini`, `notebooklm`, `kimi`, `doubao`, `deepseek`,
  `claude`, `other`) when the user names one.
- `value_units_mentioned` — the unit the user thinks in when they talk about quantity or limits: `pages`,
  `documents`, `questions`, `chapters`, `exam_items`, `credits`, `file_size`, `none`.
- `last_turn_outcome` — the `outcome` of the last user turn; `leave_reason` — the best explanation of why the
  session (and, if it was the last session, the user) ended (§2.6.9), with its own confidence.
- `appendix_b_reason` — the May 2026 churn reason this session best matches (§2.7), or `none`.

### 2.4 User record (`Wn_users.jsonl`, one line per registered user)

```json
{"uid":"4d660a71","worker":"W1","segment":"real_work_no_wall","activation":"chatted",
 "activation_blocker":"na","persona":"graduate_researcher","jtbd_primary":"thesis_or_paper_writing",
 "jtbd_recurrence":"recurring","doc_profile":"one long Spanish monograph, native text",
 "needs_met":["page_cited_answers"],"needs_unmet":["verbatim_quotes_with_pages"],
 "capability_requests":["verbatim_quotes_with_pages","export_pdf_docx"],
 "walls":[{"reason":"session_limit","is_demo":true,"reaction":"upgrade_click_no_checkout"}],
 "wtp":"upgrade_click","price_mentioned":false,"alternatives_mentioned":[],
 "returned_later_day":true,"returned_same_doc":true,
 "leave_reason_final":"job_done_partial","leave_reason_confidence":"medium",
 "hypothesis_votes":["H2","H10"],"appendix_b_reason":"B2_page_or_citation_failure",
 "replay_candidates":[{"sid":"0a1b2c3d","i":0}],
 "summary":"returned twice to the same monograph to pull quotes; got cited paraphrases, wanted the exact words; never saw Quote Finder",
 "confidence":"high"}
```

- `doc_profile` — ≤ 20 words of paraphrase describing the user's documents (type, size, language, state);
  never a file name or title.
- `activation` — `chatted` (≥ 1 user message), `uploaded_only` (documents, no messages), `events_only` (walls
  or clicks, nothing else), `nothing`. `activation_blocker` for the non-chatters: `parse_error` (an error
  document and nothing else), `doc_ready_never_opened`, `wall_before_first_message`, `unclear`, `na`.
- `needs_met` / `needs_unmet` — the need taxonomy in §2.6.10, judged over the user's whole history: a need is
  `met` when at least one session accomplished it with a satisfied outcome, `unmet` when the user tried and the
  product failed or refused, or asked for something the product lacks.
- `walls` — each mechanical wall with the coder's `reaction`; the pre-pass marks the demo/own split.
- `wtp` — the highest level reached (§2.6.8); `price_mentioned` — the user wrote about price, cost, credits,
  a plan or a refund anywhere.
- `hypothesis_votes` — the hypotheses in §1 this user's history supports (may be several; empty if none).
- `replay_candidates` — the union of the user's flagged turns.

### 2.5 Anonymous demo session record (`W4_anon_sessions.jsonl`)

```json
{"sid":"0f9e8d7c","worker":"W4","calibration":false,"demo_slug":"attention-paper","era":"E2_post_latency",
 "n_user_msgs":2,"question_langs":["ko"],"intent":"real_question_on_demo",
 "turns":[{"i":0,"qtype":"explain_or_define","lang":"ko","answer":"present","answer_lang":"ko",
   "answer_matches_lang":true,"cited":2,"outcome":"satisfied","outcome_evidence":["asked_deeper_followup"],
   "failure":[],"capability_request":[],"notes":"","confidence":"medium"}],
 "own_doc_wish":false,"alternatives_mentioned":[],"prompt_injection":false,
 "leave_reason":"evaluation_only","summary":"two focused questions on the paper in Korean, both answered with citations",
 "confidence":"medium"}
```

`intent`: `real_question_on_demo` (a question the demo document can answer), `testing_capability` (probing
what the tool can do — "can you summarise", "what languages"), `offtopic_general` (unrelated to the document),
`asks_about_own_document` (wants to use their own file — set `own_doc_wish` too), `prompt_injection_or_abuse`,
`greeting_or_empty`. `leave_reason` for anonymous sessions: `evaluation_only`, `hit_demo_message_limit` (5
user messages), `gave_up_after_failure`, `unclear`.

### 2.6 Enumerations

**2.6.1 `jtbd`** — `exam_study` (learning or revising for a test; question banks; "explain chapter N for my
exam") · `thesis_or_paper_writing` (writing that must cite this document: quotes, page numbers, arguments,
literature) · `literature_reading` (understanding a paper or book: results, method, argument, summary of a
section) · `legal_contract_review` (clauses, obligations, risks, dates in an agreement or filing) ·
`finance_or_business_analysis` (numbers, KPIs, trends in reports, filings, decks) · `technical_or_manual_lookup`
(specs, procedures, code, standards) · `admin_or_personal_document` (forms, letters, bills, policies, CVs) ·
`translation` (the job is to get the text in another language) · `writing_generation` (the job is to produce
new text — an essay, a summary to hand in, answers to a worksheet) · `data_or_table_extraction` (the job is a
table, list or dataset out of the document) · `product_evaluation` (trying the tool) · `offtopic_general` ·
`unclear`.

**2.6.2 `persona`** — `student` (undergraduate or school; homework, exams) · `graduate_researcher` (thesis,
dissertation, paper writing) · `academic_staff` (teaching, reviewing, grant work) · `legal_professional` ·
`finance_professional` · `business_professional` (anyone working on company documents that are not legal or
finance) · `engineer_or_developer` · `educator` (preparing teaching material) · `general_consumer` (personal
documents) · `evaluator_or_competitor` (probing the product itself) · `unknown`. Judge from stated role, the
document, and the phrasing; never from a name.

**2.6.3 `qtype`** (per turn; one primary in `qtype`, others in `qtypes_extra`) — `factual_lookup` (a fact the
document states) · `locate_page_or_item` (where is X; what is on page N; find question 80; which chapter) ·
`verbatim_quote` (the exact words, a citation, "copy it as is") · `summarize_whole` (the whole document) ·
`summarize_part` (a section, chapter, page range) · `explain_or_define` · `analyze_or_evaluate` (opinion,
critique, implications, strengths) · `compare_within_doc` · `extract_table_or_numbers` (numbers, tables, lists
of values) · `list_or_enumerate` (all the X in the document) · `generate_or_write` (write, draft, rewrite,
answer these questions for me, make a quiz) · `translate` · `export_or_format` (download, PDF, Excel, CSV, a
formatted output) · `meta_product` (how the tool works, limits, price, refund, account) · `offtopic_general`
(unrelated to the document) · `followup_clarify` ("more", "explain that", "why") · `complaint_or_correction`
("that's wrong", "not on that page", "you didn't read it") · `greeting_or_test` · `prompt_injection`.

**2.6.4 `outcome` and `outcome_evidence`** — see the rules in §2.7. `outcome`: `satisfied` · `partial` ·
`unsatisfied` · `missing_answer` · `unknown_terminal`. `outcome_evidence` (several allowed, in priority order):
`explicit_complaint` · `explicit_correction` · `asked_refund_or_cancel` · `repeat_same_question` ·
`rephrase_same_question` · `mode_switch` · `regenerate_or_continue` · `abandoned_after` (the session ends on
this turn and a later turn would have been expected) · `citation_click_in_window` · `explicit_thanks` ·
`asked_deeper_followup` · `switched_topic_normally` · `none`.

**2.6.5 `failure`** (per turn, several allowed; `[]` if none) — `retrieval_miss_asserted` (the user asserts
the content exists — a page, chapter, item, "it's at the start" — and the assistant says it is not there) ·
`not_found_unverifiable` (the assistant says the document lacks it and nothing in the transcript shows
otherwise) · `page_or_item_lookup_failed` (asked for page N / item N and did not get it) ·
`whole_doc_coverage_incomplete` (a summary or listing that visibly covers part of the document — "only 10
chapters?") · `refusal_overrigid_scope` (refused a reasonable request because it was "outside the document")
· `refusal_injection_false_positive` (a terse or unusual query answered with a canned refusal) ·
`incorrect_or_hallucinated` (contradicted by the user or by the document text the assistant itself quotes) ·
`citation_wrong_or_missing` (page or passage cited does not support the claim; page numbers asked and not
given) · `wrong_answer_language` · `missing_answer_no_reply` · `truncated_or_cut_off` · `parse_or_upload_failure`
(the document never became usable) · `garbled_or_ocr_text` (mojibake, nonsense text reported) ·
`table_or_number_extraction_failed` · `export_or_format_refused` · `generation_refused` (write/draft refused) ·
`jargon_or_confusing_ui` ("what is a fragment", how do I add a document) · `slow_complaint` · `other`.

**Capability requests** (`capability_request`, per turn; `capability_requests` per user) and whether the
product has them today (for step 2's discoverability-versus-gap split; coders record the request, not the
column):

| code | request | exists today |
|---|---|---|
| `export_excel_csv` | Excel/CSV of tables or answers | table CSV export exists, Plus |
| `export_pdf_docx` | download the conversation or answer | exists, Plus |
| `download_answer` | any downloadable output | exists, Plus |
| `write_or_draft` | write an essay, answers, a summary to hand in | refused by the answer persona |
| `rewrite_or_paraphrase` | rephrase or simplify document text | partly (chat) |
| `translate_document` | the document in another language | layout translation exists, paid, PDF |
| `translate_answer` | answer in language X | exists (answer language follows the question) |
| `summarize_whole_document` | a complete summary | brief/summary exists per document; chat summary is retrieval-bound |
| `compare_documents` | two documents side by side | document diff exists (dormant) |
| `multi_document_chat` | ask across several files | collections exist |
| `ocr_scanned` | read a scanned or photographed document | exists (OCR, content-based language) |
| `table_extraction` | pull a table as data | table scan exists (dormant) |
| `figures_or_images` | read charts, figures, images | no |
| `outside_knowledge_or_web` | answer beyond the document | no (by policy) |
| `longer_or_more_detailed` | more depth | continuation exists |
| `page_navigation` | go to / read page N | exists since 05-24 |
| `verbatim_quotes_with_pages` | the exact sentence and its page | Quote Finder exists, unreached |
| `citation_formatting` | APA/MLA/BibTeX | APA in-text on quote cards only |
| `integration_drive_zotero` | Drive, Zotero, Notion… | no |
| `mobile_or_ui` | mobile layout, upload flow, UI confusion | — |
| `more_free_quota` | more messages/documents free | — |
| `larger_file` | bigger upload | 50/100/200 MB, 750/1500/3000 pages |
| `other` | explain in `notes` | — |

**2.6.6 `first_question_specificity`, `doc_size_band`, `era`** — §2.3, §2.2, §0.

**2.6.7 `wall_reaction`** — `continued_same_session` (a later message within 30 min) · `worked_around`
(deleted, re-uploaded, split the file, opened another document) · `upgrade_click_no_checkout` ·
`checkout_abandoned` · `paid` · `left_within_10min` (no later activity within 10 min) · `left_later` ·
`unknown`. The pre-pass supplies the events; the coder judges the reaction from the timeline.

**2.6.8 `wtp` / `wtp_signals`** — levels: `none` · `nudge_only` (`paywall_opened` only) · `upgrade_click` ·
`checkout_started` · `paid` · `paid_then_refunded`. Text signals to add to `wtp_signals`: `asked_price`,
`complained_price`, `asked_refund`, `asked_plan_difference`, `said_would_pay_if` (with the condition in
`notes`).

**2.6.9 `leave_reason`** — `job_done_satisfied` · `job_done_partial` · `gave_up_after_failure` ·
`blocked_by_wall` · `blocked_by_parse_error` · `blocked_by_missing_answer` · `evaluation_only` ·
`switched_to_alternative_stated` · `unclear`.

**2.6.10 Need taxonomy** (`needs_met` / `needs_unmet`) — `page_cited_answers` (answers with a correct page
reference) · `verbatim_quotes_with_pages` · `large_document_coverage` (whole-document questions on > 100
pages) · `page_or_item_navigation` · `whole_document_summary` · `section_summary` · `concept_explanation` ·
`table_or_number_extraction` · `scanned_or_garbled_text` · `non_english_or_cross_lingual` · `writing_or_drafting`
· `translation` · `export_or_download` · `multi_document` · `fast_reliable_answer` · `outside_document_knowledge`
· `other`.

**2.6.11 `hypothesis_votes`** — closed set `H1` … `H10` as defined in §1; several allowed; `[]` when the
user's history supports none.

### 2.7 Judgment rules (the ones coders drift on)

1. **Silence is not satisfaction.** A last turn with no later message is `unknown_terminal` unless the answer
   turn itself carries evidence (thanks, a complaint) or a citation click falls in the window. Tabulated
   separately; never folded into `satisfied`.
2. **Priority of evidence** when signals conflict: explicit complaint or correction > refund/cancel ask >
   repeat or rephrase of the same question > mode switch / regenerate > abandonment after a failed-looking
   answer > citation click > thanks > a normal next question. A normal next question on a *new* topic is
   `satisfied` at `medium`; on the *same* topic it is `partial`.
3. **Retrieval miss versus honest not-found.** The coder cannot see the document. `retrieval_miss_asserted`
   only when the user asserts the content exists (names a page, chapter, item, position, or says "it is in
   there"); otherwise `not_found_unverifiable`. Both mark `replay_candidate: true`.
4. **Hallucination** only when the user contradicts the answer with specifics, or the answer contradicts text
   it quotes itself; a bare "that's wrong" is `explicit_complaint` with `incorrect_or_hallucinated` at `low`.
5. **Whole-document coverage.** Code `whole_doc_coverage_incomplete` when the answer enumerates a visibly
   partial set (chapters 1–10 of a book; "the sections available"; "the excerpts provided") on a document the
   mechanical record shows to be long (`l`/`xl`), or when the user says so.
6. **Refusals.** `refusal_overrigid_scope` when the request was reasonable for a document assistant (write a
   summary in my words, answer from general knowledge *about* the document's topic, help me phrase); not when
   the request was truly unrelated (`offtopic_general` → the refusal is correct, `failure: []`).
7. **Language.** `wrong_answer_language` when the answer language differs from the question language without
   the user asking for it (a document in English answered in English to a Spanish question counts).
8. **Walls and demo.** A wall on a demo document is evaluation intent, not depth; keep `is_demo` on the wall
   entry; the session-limit wall of 08-28 (`040411e1`) fired on the `court-filing` demo — §9.16.
9. **Leave reason** is judged on the user's *last* session; for earlier sessions code the session's own end.
   Prefer `job_done_*` over `gave_up_after_failure` only when the last answered turn is `satisfied`/`partial`
   and no failure is on it. `evaluation_only` requires `product_evaluation` intent or a demo document.
10. **Anchoring to May's eight reasons** (`appendix_b_reason`): `B1_large_doc_coverage`,
    `B2_page_or_citation_failure`, `B3_export_refused`, `B4_overrigid_persona`,
    `B5_scanned_or_nonlatin_garbled`, `B6_no_reply_reliability`, `B7_upload_or_ui_confusion`,
    `B8_done_once_no_hook`, `none`. Pick the single best match per session and per user.
11. **Confidence** is per judgment; the record-level `confidence` is the lowest of `jtbd`, `overall_outcome`
    and `leave_reason`.
12. **Never infer identity.** Persona comes from role statements and document type, never from a name, an
    institution or an e-mail signature inside the text — and none of those are copied out.

## 3. Worker design

### 3.1 P0 — deterministic pre-pass (Claude, a Python script, no LLM)

Inputs: `<EXPORT_DIR>/users.json`, `<EXPORT_DIR>/anonymous_demo_sessions.json`, where `<EXPORT_DIR>` =
`/private/tmp/claude-501/-Users-mayijie-Projects-Code-010-DocTalk--claude-worktrees-frontend-design-review-c26fcb/aab7c07b-c115-4ec3-8823-4a2e6b93fa8e/scratchpad/qa-corpus`.

Outputs, all under `<EXPORT_DIR>/prepass/` (outside the repo):

- `users_mech.jsonl`, `sessions_mech.jsonl` — §2.2, one line per user / per session. `segment` must come from
  the same bucket function the churn read used (import it from
  `../2026-09-22-pricing-research/churn_from_export.py` / `free_quota_at_churn.py`, do not re-implement) so the
  counts reconcile with `free-quota-at-churn.txt`; `era` from the table in §0; `returned_later_day` from the
  0.149-base definition.
- `slices/<W>/<uid>.json` — one file per registered user in that worker's assignment: the user's `users.json`
  entry (documents, events, feedback, ledger, usage, sessions with full messages) plus its `users_mech` line
  and its `sessions_mech` lines under `"mech"`. For W4: `slices/W4/<sid>.json` per anonymous session, with its
  `sessions_mech` line.
- `assign_W1.txt`, `assign_W2.txt`, `assign_W3.txt` (uids, one per line), `assign_W4.txt` (sids).
- `calibration/755788ef.json`, `calibration/58688124.json` (whole-user slices, same shape as `slices/`),
  `calibration/ids.txt` (those two uids), `calibration/anon/<sid>.json` for the two longest anonymous sessions
  and `calibration/anon_ids.txt`. The two calibration users are **excluded** from every `assign_*.txt`; their
  canonical records are W1's calibration coding unless the field-level comparison (§4.1) shows W2's better
  justified, in which case Claude records the choice.
- `validate_coded.py <coded file> <ids file>` — infers the record type from its fields (`turns` + `uid` →
  conversation; `uid` without `turns` → user; `demo_slug` without `uid` → anonymous session). With a uid list it
  expects, for a conversation file, exactly the sessions those users own in `sessions_mech.jsonl`; for a user
  file, exactly those uids; with a sid list, exactly those sessions. Checks: one JSON object per line; required
  fields present; every enumerated value in its closed list; `turns` length equals the session's
  `n_user_msgs`; every expected id appears exactly once and no unexpected one appears (`--partial` relaxes
  coverage for the every-10-users runs but still rejects unexpected ids); `summary` ≤ 60 words, `notes` ≤ 20
  words; no 9-word window of any `summary`/`notes`/`doc_profile` occurs verbatim in any message text of the
  export (n-gram check, case-folded) **and**, because a copied Chinese or Japanese sentence is one whitespace
  "word", no 20-character window of those fields occurs verbatim in any message written in a non-Latin script
  (CJK, Arabic, Cyrillic, Devanagari; whitespace-normalised, case-folded); `hypothesis_votes` values in
  `H1`–`H10`; prints every failure and exits non-zero on any.
- `prepass_summary.md` — counts only.

Assignment rule: **deep set D** = registered users with ≥ 3 user messages (34 users, 265 messages). Order D by
total transcript characters descending and deal them to W1 and W2 in a snake (W1, W2, W2, W1, …) so both get
about half the text; print the two lists. **W3** = every other registered user with anything to code: ≤ 2
user messages (33), or ≥ 1 document and no messages (21), or wall / upgrade / citation events and no sessions
(a handful; `e804f5e0`'s 7 clicks with no sessions is one). Users with nothing at all (`never_started`, ~78)
get a mechanical record only. **W4** = all 182 anonymous sessions.

### 3.2 Tasks, models, stop conditions

| Task | Scope | Model | Why |
|---|---|---|---|
| W1 | half of the deep users (~17 users, ~130 user messages, ~400k characters of assistant text) | **Opus** | per-turn satisfaction and failure attribution on multilingual, long transcripts are the load-bearing judgments; the anchors (the payer, the returners, the 20-message sessions) sit here |
| W2 | the other half of the deep users | **Opus** | same |
| W3 | shallow + upload-only + events-only registered users (~55 users, 46 messages) | Sonnet (Opus if idle capacity) | mostly activation coding; light judgment |
| W4 | 182 anonymous demo sessions (236 messages) | Sonnet | evaluation-intent coding; 152 sessions have one message |

Common stop conditions: every assigned id has exactly one record; `validate_coded.py` passes on every output
file; the calibration records are written; the summary markdown exists and contains no run of more than eight
verbatim words; the final message lists counts, the calibration codings in one line each, and any record the
worker could not code (with the reason). If a worker cannot finish, it writes what it has (JSONL is
append-only; write after every user, never batch more than ten) and reports the remaining ids — Claude
re-dispatches the remainder with the same prompt and assignment file trimmed.

Calibration: W1, W2 and W3 each code users `755788ef` (the payer; May's transcript reading is the ground truth:
retrieval miss asserted on page 350 / question 80, jargon confusion, refusal of an outside-document answer,
refund asked in chat, `B1`) and `58688124` (12 messages over two days, span ≥ 7 days — a returner) first, into
`<W>_calibration_users.jsonl` / `<W>_calibration_conversations.jsonl` with `"calibration": true`, before their
own assignment. Claude compares the three codings field by field before reading any other output; a coder
that disagrees with the ground truth on `outcome`, `failure` or `leave_reason` for the payer is re-briefed with
the diff, not trusted. W4 codes the two calibration anonymous sessions first, into `W4_calibration.jsonl`.

Validation and merge (Claude): run the validator on every file; concatenate `W1/W2/W3_users.jsonl` into
`<EXPORT_DIR>/coded/users_coded.jsonl` and the conversations into `conversations_coded.jsonl`; join with the
mechanical files on `uid`/`sid` for §4.

### 3.3 Worker prompts (dispatch verbatim; substitute `<EXPORT_DIR>`, `<REPO>` and — in the W1/W2 prompt — `<W>` once)

`<REPO>` = `/Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/frontend-design-review-c26fcb`; `<W>`
is `W1` or `W2` and appears in file paths, so it must be substituted everywhere before dispatch.

#### Prompt for W1 and W2 (identical except the worker id and assignment file)

```
You are coder <W> (W1 or W2) in a qualitative analysis of DocTalk's historical user conversations. DocTalk is a
"chat with your document" web app: users upload a PDF/DOCX/PPTX/XLSX/TXT/MD or a URL, ask questions, and get
answers that cite the source passage with page numbers; a Quote Finder returns machine-verified verbatim quotes;
there are Flash and Pro answer modes, a free plan with walls (file size, 3 documents, 3 sessions per document,
Domain Mode, export), and demo documents. Your job is to read every conversation of each user assigned to you
and produce coded records that follow a fixed codebook exactly. You judge; you do not summarise freely.

PRIVACY — BINDING. The data are real users' conversations and the project repository is public.
- Read only from <EXPORT_DIR>/prepass/. Write only to <EXPORT_DIR>/coded/. Never write under <REPO> or
  anywhere else. Never modify the export.
- In every field you write (notes, summary, doc_profile, and your final message) use paraphrase only. Never
  reproduce more than eight consecutive words from any user or assistant message. Never copy a name, e-mail,
  institution, file name, URL, phone number or any other identifying detail that appears inside a transcript.
  Refer to users, sessions and documents only by the 8-character prefixes in the data.
- Your final message to the coordinator is aggregate only (counts and one-line paraphrases).

STEP 1 — read the codebook. Read section 2 (Codebook) of
<REPO>/.collab/reviews/2026-09-22-needs-analysis/01-plan-fable.md in full, including 2.6 (enumerations) and
2.7 (judgment rules). Those are the only field names and values you may emit. Also read section 0's era table
and section 1 (the hypotheses H1–H10 and their evidence — you vote on them per user).

STEP 2 — calibration first. Read <EXPORT_DIR>/prepass/calibration/755788ef.json and
<EXPORT_DIR>/prepass/calibration/58688124.json. Code both users completely (user record + one conversation
record per session, per-turn entries for every user message) with "calibration": true, into
<EXPORT_DIR>/coded/<W>_calibration_users.jsonl and <EXPORT_DIR>/coded/<W>_calibration_conversations.jsonl.
Run: python3 <EXPORT_DIR>/prepass/validate_coded.py <EXPORT_DIR>/coded/<W>_calibration_conversations.jsonl
<EXPORT_DIR>/prepass/calibration/ids.txt  — and fix until it passes. Do not continue until it passes.

STEP 3 — your assignment. The user ids are in <EXPORT_DIR>/prepass/assign_<W>.txt, one per line. For each uid,
in that order:
  a. Read <EXPORT_DIR>/prepass/slices/<W>/<uid>.json. It holds the user's documents, events (walls, upgrade
     clicks, citation clicks, checkouts), credit ledger, model usage, and every session with full message text
     and timestamps, plus a "mech" block with the mechanical fields already computed (era, doc size band,
     unanswered flags, cited counts, citation clicks in the session window, walls in the window, active days,
     return flags, segment). Copy mechanical fields; never recompute them.
  b. For each session, code one conversation record (codebook 2.3) with a turns[] entry for every user message
     (i = 0-based index among the session's user messages; the mech block's answered_flags and cited_counts
     line up with it). Apply the judgment rules in 2.7: silence is unknown_terminal; retrieval_miss_asserted
     only when the user asserts the content exists; hallucination only with specifics; whole-document coverage
     only when the answer is visibly partial on a long document; walls on demo documents keep is_demo true.
  c. Then code the user record (codebook 2.4): activation, needs met/unmet, capability requests, walls with
     reactions, wtp, hypothesis_votes (which of H1–H10 from section 1 this user's history supports),
     appendix_b_reason, replay_candidates, leave_reason_final on the LAST session.
  d. Append the conversation records to <EXPORT_DIR>/coded/<W>_conversations.jsonl and the user record to
     <EXPORT_DIR>/coded/<W>_users.jsonl — one JSON object per line, written after EVERY user (never hold more
     than one user in memory unwritten). Use python3 to append so the JSON is valid.
  e. Every 10 users, run the validator on both files against assign_<W>.txt with --partial (it tolerates
     incomplete coverage until the end but rejects malformed records and unexpected ids) and fix anything it
     reports.

STEP 4 — finish. Run the validator with full coverage on both files; it must pass. Then write
<EXPORT_DIR>/coded/<W>_summary.md (aggregate only, ≤ 400 words, no verbatim text beyond eight words): counts of
users and sessions coded; the distribution of jtbd, persona, overall_outcome, dominant_failure, leave_reason,
appendix_b_reason and hypothesis_votes; the capability requests seen; the three patterns you saw most often,
each as one paraphrased sentence; and anything the codebook could not express (name the field and the case by
uid only). Your final message: the same counts, your calibration coding of 755788ef in one line (outcome of the
first turn, dominant failure, leave reason) and of 58688124 in one line, and any uid you could not code and why.

Rules of conduct: do not skip a session because it is long; do not merge sessions; do not read other workers'
files; do not run anything against a database or the network; if a slice file is missing, report the uid and
continue. Confidence is per judgment (high / medium / low as defined in 2.1) and must be honest — a low is
more useful than a wrong high.
```

#### Prompt for W3

```
You are coder W3 in a qualitative analysis of DocTalk's historical users. DocTalk is a "chat with your
document" web app: users upload a PDF/DOCX/PPTX/XLSX/TXT/MD or a URL, ask questions, and get answers that cite
the source passage with page numbers; there is a free plan with walls (file size 50 MB, 3 documents, 3 sessions
per document, Domain Mode, export) and demo documents. Your users are the SHALLOW ones: registered users who
sent at most two messages, or uploaded documents and never chatted, or only triggered walls/clicks. The question
for this group is activation: what stopped them, and whether the one or two answers they got satisfied them.

PRIVACY — BINDING. The data are real users' conversations and the project repository is public.
- Read only from <EXPORT_DIR>/prepass/. Write only to <EXPORT_DIR>/coded/. Never write under <REPO> or
  anywhere else. Never modify the export.
- In every field you write (notes, summary, doc_profile, and your final message) use paraphrase only. Never
  reproduce more than eight consecutive words from any user or assistant message. Never copy a name, e-mail,
  institution, file name, URL or any other identifying detail that appears inside a transcript. Refer to users,
  sessions and documents only by the 8-character prefixes in the data.
- Your final message to the coordinator is aggregate only.

STEP 1 — read the codebook: section 2 of <REPO>/.collab/reviews/2026-09-22-needs-analysis/01-plan-fable.md
in full (2.3 conversation record, 2.4 user record, 2.6 enumerations, 2.7 judgment rules), the era table in
section 0, and section 1 (the hypotheses H1–H10 you vote on per user). Those are the only field names and
values you may emit.

STEP 2 — calibration first. Read <EXPORT_DIR>/prepass/calibration/755788ef.json and
<EXPORT_DIR>/prepass/calibration/58688124.json (deep users; they calibrate you against the other coders). Code
both completely (user record + one conversation record per session with per-turn entries) with
"calibration": true into <EXPORT_DIR>/coded/W3_calibration_users.jsonl and
<EXPORT_DIR>/coded/W3_calibration_conversations.jsonl; run
python3 <EXPORT_DIR>/prepass/validate_coded.py <EXPORT_DIR>/coded/W3_calibration_conversations.jsonl
<EXPORT_DIR>/prepass/calibration/ids.txt and fix until it passes.

STEP 3 — your assignment: <EXPORT_DIR>/prepass/assign_W3.txt, one uid per line. For each uid:
  a. Read <EXPORT_DIR>/prepass/slices/W3/<uid>.json (documents, events, ledger, usage, sessions with full text,
     and a "mech" block with era, doc size band, unanswered flags, cited counts, citation clicks and walls in
     each session window, active days, return flags, segment). Copy mechanical fields; never recompute them.
  b. If the user has sessions with messages: code one conversation record per session (codebook 2.3) with a
     turns[] entry per user message, applying 2.7 strictly — a single question with no follow-up is
     unknown_terminal unless the answer turn carries evidence or a citation click falls in the window;
     first_question_specificity matters most for this group.
  c. Code the user record (codebook 2.4). For users with no messages, the load-bearing fields are activation
     (uploaded_only / events_only), activation_blocker (parse_error when an error document is all they have —
     the mech block has doc_status and doc_error; doc_ready_never_opened when the document parsed and no
     session exists; wall_before_first_message when a wall event precedes any message), walls with reactions,
     wtp, and hypothesis_votes (H3 for never-activated; add H5 for parse errors, H6 for walls that ended the
     visit). Leave jtbd/persona as unclear/unknown when the document type alone does not say; a document
     type (e.g. XLSX, DOCX, a 500-page PDF) may justify a low-confidence jtbd.
  d. Append to <EXPORT_DIR>/coded/W3_conversations.jsonl and <EXPORT_DIR>/coded/W3_users.jsonl after every
     user, one JSON object per line, using python3 so the JSON is valid. Every 10 users run the validator on
     both files against assign_W3.txt with --partial and fix anything it reports.

STEP 4 — finish: validator with full coverage must pass on both files. Write
<EXPORT_DIR>/coded/W3_summary.md (aggregate only, ≤ 300 words, no verbatim text beyond eight words): counts;
activation and activation_blocker distributions; how many one-message users got a satisfied / partial /
unknown_terminal first answer and how many first questions were specific vs generic vs test; walls and
reactions; hypothesis_votes counts; the three most common patterns as one paraphrased sentence each. Your final
message: the same counts, your calibration coding of 755788ef and 58688124 in one line each, any uid you could
not code and why.

Rules of conduct: do not read other workers' files; do not run anything against a database or the network;
confidence must be honest (a low is more useful than a wrong high); if a slice is missing, report the uid and
continue.
```

#### Prompt for W4

```
You are coder W4 in a qualitative analysis of DocTalk's anonymous demo conversations. DocTalk is a "chat with
your document" web app; visitors who have not signed in can chat with sample documents (an earnings release
"alphabet-earnings", a research paper "attention-paper", a court filing "court-filing", an NDA "nda-contract",
a 10-K "nvidia-10k"), five messages per document per day, and are asked to sign in to upload their own file.
Your job is to code what anonymous visitors were trying to find out and whether the demo answered them — the
evaluation stage of the funnel.

PRIVACY — BINDING. The data are real visitors' messages and the project repository is public.
- Read only from <EXPORT_DIR>/prepass/. Write only to <EXPORT_DIR>/coded/. Never write under <REPO> or
  anywhere else. Never modify the export.
- In every field you write (notes, summary, final message) use paraphrase only. Never reproduce more than
  eight consecutive words from any user or assistant message. Never copy a name, e-mail, company, URL or any
  other identifying detail that appears inside a message. Refer to sessions only by their 8-character prefix.

STEP 1 — read the codebook: sections 2.5 (anonymous session record), 2.6.3 (qtype), 2.6.4 (outcome and
evidence), 2.6.5 (failure and capability requests), 2.7 (judgment rules) and the era table in section 0 of
<REPO>/.collab/reviews/2026-09-22-needs-analysis/01-plan-fable.md. Those are the only field names and values
you may emit.

STEP 2 — calibration first. Code the two sessions in <EXPORT_DIR>/prepass/calibration/anon/ (the two longest
anonymous sessions) into <EXPORT_DIR>/coded/W4_calibration.jsonl with "calibration": true, then run
python3 <EXPORT_DIR>/prepass/validate_coded.py <EXPORT_DIR>/coded/W4_calibration.jsonl
<EXPORT_DIR>/prepass/calibration/anon_ids.txt and fix until it passes.

STEP 3 — your assignment: <EXPORT_DIR>/prepass/assign_W4.txt, one session id per line (182 sessions; 152 have
a single user message). For each sid: read <EXPORT_DIR>/prepass/slices/W4/<sid>.json (the session with full
messages and a "mech" block: demo_slug, era, n_user_msgs, answered flags, cited counts). Code one record per
session (codebook 2.5): intent, question languages, a turns[] entry per user message with qtype / outcome /
outcome_evidence / failure / capability_request (silence after the only message is unknown_terminal; a second
question on a new topic makes the first satisfied at medium; a rephrase makes it partial), own_doc_wish (the
visitor wants their own document), alternatives_mentioned, prompt_injection, leave_reason (evaluation_only /
hit_demo_message_limit when n_user_msgs is 5 / gave_up_after_failure / unclear), summary (≤ 25 words,
paraphrase), confidence. Work in batches of 20 sessions; append to <EXPORT_DIR>/coded/W4_anon_sessions.jsonl
after every batch using python3; after every batch run the validator against assign_W4.txt with --partial
and fix anything it reports.

STEP 4 — finish: the validator with full coverage must pass. Write <EXPORT_DIR>/coded/W4_summary.md (aggregate
only, ≤ 300 words, no verbatim text beyond eight words): sessions by demo document and era; intent
distribution; qtype distribution; first-turn outcome distribution; failures seen with counts; how many sessions
asked for their own document or named an alternative tool; how many were off-topic or injection; the three most
common patterns as one paraphrased sentence each. Your final message: the same counts, your calibration coding
in one line per session, and any sid you could not code and why.

Rules of conduct: do not read other workers' files; do not run anything against a database or the network;
confidence must be honest; if a slice is missing, report the sid and continue.
```

### 3.4 Fable's own read (step 2 input, no worker)

Before writing the synthesis I read directly, from the slices: the payer's session; the two ≥ 20-message
sessions (`4d660a71`'s and the other one the pre-pass lists); the returners `558731d6`, `58688124`, `5954da3d`,
`040411e1`; the 3
messages with an `action_plan` marker; the contexts of the 28 unanswered messages (mechanical list); and the
15 error-document owners' histories. Coders' records on these anchors are checked against my reading before
any count is trusted.

## 4. What Claude computes from the coded JSONL (joined with the mechanical files)

Report counts, and rates only where the denominator is ≥ 10; cells under five are named, not percentaged.

**4.1 Coverage and calibration.** Records per worker; validator results; the three codings of the two
calibration users side by side (field-level agreement on `outcome`, `failure`, `leave_reason`,
`appendix_b_reason`); coder disagreements listed.

**4.2 The hypotheses.** Per user: `hypothesis_votes` counts, by `segment` and by `era` of last activity.
`overall_outcome × era`; `leave_reason × era`; `leave_reason × segment`; `appendix_b_reason` now versus May's
counts (47 users → 67).

**4.3 Needs and failures.** `dominant_failure × doc_size_band`; `failure × doc_type_coded` (turn level);
`failure × cross_lingual`; `failure × era` (which failure classes disappear after 05-24 / 08-08);
`needs_unmet` counts by `persona` and by `jtbd`; `capability_request` counts split by the "exists today"
column in §2.6.5 (discoverability gap versus capability gap); `qtype` distribution overall and among users who
clicked citations (H10: `verbatim_quote` + `locate_page_or_item` turns in sessions of users with 0 `quote_*`
events).

**4.4 Satisfaction and return.** `satisfied_first_answer × returned_later_day`; `overall_outcome × returned_later_day`;
`jtbd_recurrence × returned_later_day`; `jtbd × returned_later_day`; `first_question_specificity ×
n_user_msgs band`; `unknown_terminal` share of last turns (how much of "episodic" is really unread); the
churn read's §9 cells re-labelled by coded outcome: for "own · cited · < 1 day" (16) how many are `job_done_*`
versus `job_failed`/`job_partly_done` — that is the owner's "solved and left" cell decided.

**4.5 Walls and willingness to pay.** `wall reason × reaction`, demo/own split; `wtp` level × `overall_outcome`
(did the people who clicked upgrade get value first?); `price_mentioned` count; `value_units_mentioned`
counts (the unit users think in); `alternatives_mentioned` counts. Replay list: every `replay_candidate` turn as
`{uid, sid, i, era, doc, doc_size_band, doc_status, failure}` — kept outside the repo, counted inside it. A
replay is only possible for `ready` documents whose chunks and vectors survive (the 2026-08 MinIO loss took
source files, not chunks or vectors — the M3 gate replayed at the service layer on exactly such documents), and
it tests today's retrieval and prompting over the chunks parsed in that document's era, not a re-parse; mark
each candidate `replayable` accordingly.

**4.6 Anonymous demo.** `intent` × demo document; first-turn outcome; `own_doc_wish` count and `alternatives`;
the share of sessions that end at one message; failures on the demo (these are today's product for the
`E2/E3` rows).

**4.7 Cost to serve (extends `02-cost-to-serve-claude.md`).** Fetch prices at analysis time — DeepSeek's
official page for `deepseek-v4-flash` / `deepseek-v4-pro` (peak and off-peak, cache-miss and cache-hit),
OpenRouter's model pages for the legacy `deepseek/deepseek-v3.2` and `mistralai/mistral-medium-3.1`, and the
`text-embedding-3-small` price via the embedding gateway — and record the URLs and the access date. Compute:
- USD per user from `usage_by_model` (cache-miss peak as the upper bound; cache-hit off-peak as the lower
  bound); per active user, per session, per answer; by `segment` and by `overall_outcome` (what did the
  failed sessions cost?); the anonymous demo from message tokens at the Flash price (unbilled today).
- Per-document cost estimate: embeddings ≈ pages × 600 tokens × the embedding price; OCR is self-hosted
  (report pages OCR'd, not dollars); the 15 error documents as sunk cost.
- Implied credit prices (Plus $0.00333, Pro $0.00222, Boost $0.00798) against actual USD per credit charged per
  model → margin by mode; and the reconciled credits per answer by model (02: ≈ 11.2 Flash, ≈ 25 Pro) so the
  readable-unit copy uses real numbers (500 credits ≈ 45 Flash answers).
- Three capability-upgrade cost scenarios per answer, for step 2's pricing floor: (a) 4× retrieval context on
  Flash; (b) a whole-document map-reduce over a p90 document (289 pages × ~600 tokens on Flash, plus the
  reduce step); (c) Pro for every "hard" question type (`locate_page_or_item`, `verbatim_quote`,
  `summarize_whole`, `extract_table_or_numbers`) at the observed mix.

## 5. The synthesis questions (step 2, `03-synthesis-fable.md`)

1. **Which needs are unmet, and how often** — by need, persona, document class and era; separating what is
   unmet *today* (E2/E3 and the demo) from what was unmet in the product that no longer exists (E0/E1), and
   listing the replay candidates that would test the difference on the current stack.
2. **Unmet needs or episodic completion — which explains the return rate.** The churn read's cell
   "own · cited · < 1 day" (16 of 44) decided by coded outcome; the `unknown_terminal` share stated honestly;
   never-activated (H3: 21 upload-only users, 15 error documents, 33 one-or-two-message users) weighed against
   both. The pricing synthesis's §3 reading sits between A and B on the mechanical cells; this decides it,
   by a rule fixed now so step 2 reads the verdict off the §4.4 table: among the 16 users in that cell, if
   `job_done_*` is the majority (≥ 8 at `medium`+ confidence, `unknown_terminal` reported beside it, not
   inside it), the synthesis moves to **Read B** — the non-renewing pass is the first packaging item; if
   `job_failed`/`job_partly_done` is the plurality, **Read A** stands and capability precedes packaging; if
   `unknown_terminal` is the largest group, the cell is unreadable, the mechanical between-A-and-B verdict
   stands, and the replay run (§4.5) is scheduled after 09-28 to read it.
3. **Capability upgrades ranked by evidence and cost** — large-document retrieval and whole-document tasks,
   OCR/garbled text, tables and spreadsheets, speed and reliability, languages, generation/writing, export,
   Quote Finder discoverability (H10), and anything the data surfaces — each with the users it would have
   changed, whether the fix already shipped (era), the per-answer cost from §4.7, and the ranking rule: users
   affected × evidence quality × (1 / engineering cost).
4. **Pricing, given the findings — how `20-synthesis-fable.md` changes (or not):**
   - the value metric, re-read with the corrected numbers: a Flash answer is ≈ 11 credits, so "about 60
     questions a month" was wrong; the readable unit must be documents · pages · answers with real counts;
   - the free tier: Free is de facto a one-time 500-credit pool because the monthly grant almost never fires —
     decide whether the recommendation "Free stays free and renewing" means fixing the grant so it arrives (a
     one-line change with unknown effect on the only cohort that returns) or describing what Free actually is;
   - packaging by persona (students/thesis writers, legal, finance — from `persona × jtbd × wtp`);
   - the non-renewing pass beside Plus at the walls: confirmed, demoted or reshaped by the coded wall
     reactions and the users' own units (a document pass if `value_units_mentioned` is documents/pages; a
     time pass if answers); and whether any capability upgrade changes willingness to pay (H1 users who asked
     for something and left) or only retention;
   - cost floors for any upgrade (the three scenarios) against the credit price — LLM margin is not the
     constraint; engineering time is.
5. **What would flip each conclusion**, and the replay run to schedule after 09-28 if the era split leaves
   the present-tense question open.

## 6. Needed from Claude and the owner

- **Claude, now:** the pre-pass script and validator (§3.1) run against the export; the assignment lists; then
  dispatch W1–W4 with the prompts in §3.3, `<EXPORT_DIR>` and `<REPO>` substituted. Compare the calibration
  codings before merging. Then the §4 tables and the price fetch. Commit only this plan and, later, the
  synthesis — never anything under `<EXPORT_DIR>`.
- **Export amendments (optional second run by the owner; the analysis does not wait for them).** If the
  owner is willing to run `export_qa.py` once more, four read-only additions would raise the machine signal:
  (a) an 8-character `mid` on every message and per-message rows from `usage_records` keyed by `message_id`
  (`model`, tokens, `cost_credits`) — mode and cost per answer; (b) `rag_verification_completed` events kept
  with `message_id`, `status`, `score`, `route`, `retrieval_strategy`, `retrieved_count`, `citation_count`,
  `invalid_citation_count` (today the event is absent from `EVENTS` and the record drops all metadata but
  `is_demo`); (c) a `revisions` count per assistant message (regenerate = dissatisfaction); (d) the client
  metadata of `citation_clicked` and `limit_hit` (document/session/page if the client sends them). All are
  aggregates or ids, no new text, still read-only.
- **Owner, unchanged from the pricing research:** the Stripe payment methods and pack currencies; the § 356a
  withdrawal function. Nothing in this analysis needs production access beyond the export already run.
