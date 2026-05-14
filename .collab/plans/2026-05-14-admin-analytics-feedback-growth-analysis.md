# DocTalk Growth and Paid-Intent Analysis

Date: 2026-05-14

## Scope and Data Confidence

This analysis is based on verified repo behavior, public-page copy, product-event instrumentation, and the admin analytics gaps found during implementation. I could not query the production database in this workspace: the available database URL points to local Postgres and the service was not reachable. Exact production active-user trend, retention, and paid conversion rates therefore require the new `/api/admin/user-activity` endpoint after migration/deploy, or a read-only production DB/admin session.

## Product Function and Operating Principle

DocTalk is an AI document Q&A app. Users upload PDF/DOCX/PPTX/XLSX/TXT/MD/URL content, the backend parses and chunks documents, creates retrieval indexes, then chat answers are generated with source citations that jump back to the exact source passage. The product is gated by auth, credits, plan limits, and Stripe billing. Current monetization signals are emitted as product events such as `paywall_opened`, `limit_hit`, `billing_view`, `upgrade_click`, `checkout_created`, and `checkout_completed`.

## Main Reasons Traffic Is Likely Underperforming

1. Measurement was too narrow. The existing admin trends counted active users mainly from `usage_records`, so uploads, chat messages, product events, and feedback-like intent were not represented in one live active-user view. That made it hard to see whether traffic loss is acquisition, activation, retention, or payment friction.

2. Public trust had copy drift. The public counter still showed 3 performance modes while the live product is Flash/Pro. Several alternative-page locale strings also still said “Three AI performance modes.” This creates a credibility gap exactly where users compare DocTalk to competitors.

3. Localization is broad but uneven. The product advertises 11 languages, but multiple non-English locale files still contain long English competitor/comparison passages. That weakens localized SEO, reduces confidence for non-English visitors, and may lower conversion from international traffic.

4. The site explains features, but not enough proof of outcome. The strongest differentiator is verifiable citation jumping. Pages mention it, but admin did not previously expose how often users reach the activated state: signup → upload → chat → citation-backed answer. Without this activation visibility, traffic work can optimize for visits rather than successful first value.

## Main Reasons Paid Willingness Is Likely Weak

1. Plan friction is observable but not summarized. The app tracks paid-intent events, yet admin did not have a single dashboard showing which reasons dominate: upload limit, file size, session limit, Pro mode, export, collection limits, or checkout dropoff.

2. User objections were not captured at the moment of frustration. Cancellation has reasons, but general in-product feedback did not exist. Users hitting answer-quality, citation, parse, mobile, or pricing friction had no structured path to tell the team.

3. Credit value can still feel abstract. Pricing explains credits, but users need to experience enough “cited answer quality” before paying. If parsing, table extraction, citation jumping, or answer depth fails early, willingness to pay drops before the billing page.

## What This Batch Adds

- Composite dynamic admin activity analytics: DAU/WAU/MAU, active/upload/chat trends, signup cohort funnel, retention, paid-intent reasons, conversion blockers, and feedback summaries.
- Structured feedback mechanism available from product/public headers, with prefilled type/area/severity/options and optional free text.
- Public copy fixes for verified two-mode product reality and version fallback alignment with `frontend/package.json`.

## Next Data Questions After Deploy

Use the new admin dashboard to answer:

- Is traffic loss from fewer signups, fewer first uploads, or fewer first chat messages?
- Which cohort stage has the sharpest drop: signup → upload, upload → chat, chat → 5+ messages, or paid prompt → checkout?
- Which paid-intent reasons dominate by unique user count?
- Do active users return on D1/D7/D30 after first signup?
- Which feedback categories correlate with users who hit paid limits but do not check out?
