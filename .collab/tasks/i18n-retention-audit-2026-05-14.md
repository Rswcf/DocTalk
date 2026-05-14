# i18n + Retention Audit

Date: 2026-05-14

## Reported Issues

- Feedback modal changed language for headings, but type/area/severity options and quick choices stayed in English.
- Document chat suggested questions used backend-generated `suggested_questions`; those were generated once and did not change when the UI locale changed.

## Fix Applied

- `FeedbackButton` now separates canonical option values from localized labels and uses `tOr(...)` for all feedback type, area, severity, and quick-choice labels.
- Added feedback option translations across all 11 locale files.
- `ChatPanel` now uses localized starter questions whenever the UI locale is not English. English keeps the document-generated suggested questions.

## Remaining i18n Debt

Core product prefixes still have missing or English-identical strings outside this patch:

- `ar`: 127 missing, 99 identical-to-English product strings.
- `de`: 101 missing, 79 identical-to-English product strings.
- `es`: 127 missing, 109 identical-to-English product strings.
- `fr`: 127 missing, 95 identical-to-English product strings.
- `hi`: 127 missing, 102 identical-to-English product strings.
- `it`: 127 missing, 96 identical-to-English product strings.
- `ja`: 127 missing, 92 identical-to-English product strings.
- `ko`: 127 missing, 92 identical-to-English product strings.
- `pt`: 127 missing, 80 identical-to-English product strings.
- `zh`: 126 missing, 18 identical-to-English product strings.

High-risk areas: auth, billing current-plan states, upload error copy, profile notifications, contact/legal pages, several product workflow panels.

## Production Aggregate Signals

No PII was queried or recorded; only aggregate counts.

- Total users: 100.
- Paid users: 1.
- Total non-demo documents: 88.
- Total user messages: 301.

30-day funnel:

- Signups: 71.
- Uploaded: 44.
- Created sessions: 45.
- Chatted: 35.
- 5+ messages: 8.
- Paywall opened: 24.
- Checkout completed: 1.

7-day funnel:

- Signups: 12.
- Uploaded: 8.
- Chatted: 8.
- 5+ messages: 1.
- Paywall opened: 8.
- Checkout completed: 0.

Active-day distribution:

- 46 users active on exactly 1 day.
- 9 users active on 2 days.
- 2 users active on 3 days.
- 3 users active on 4 days.
- 1 user active on 6 days.
- 1 user active on 23 days.

30-day document health:

- Ready: 55.
- Error: 10.
- OCR/in-progress: 2.

Paid-intent/event signals:

- `dashboard_activation_nudge` opened paywall 116 times across 27 users, but only 2 users clicked upgrade from that source and no checkout completed from that path.
- `file_size` and `upload_limit` limit hits affected 7 unique users combined.
- `rag_verification_completed` with `warn` occurred 31 times across 11 users.

## Product Interpretation

- Retention is low partly because the product is currently a one-shot utility: users upload a document, ask a few questions, and leave after the immediate task.
- The largest funnel drop is not signup-to-upload; it is chat-to-repeat-depth and next-day return. 35 users chatted in 30 days, but only 8 reached 5+ messages.
- Upload/parse reliability is a real activation blocker: 10 document errors in 30 days is material against 55 ready documents.
- The current activation nudge likely creates monetization noise. It triggers often after activation, but does not convert to checkout.
- Trust may be limiting repeat use: 31 RAG warning events across 11 users suggests answer quality/citation confidence needs closer review.

## Recommended Next Features

1. Complete core app localization before traffic acquisition.
2. Add parse-failure recovery: clearer localized error, retry, and fallback text extraction.
3. Add a post-parse value moment: localized instant brief plus 3 localized next actions.
4. Add a return loop: email/notification when parse finishes, saved brief digest, and "continue where you left off."
5. Move paid prompts later: after repeat use, citation clicks, exports, comparisons, or clear limit moments.
6. Treat `dashboard_activation_nudge` as a suspect feature; A/B test reducing or delaying it.
