# DocTalk 0.30.1 release acceptance

## Release candidate

Authorized scope: complete the existing systematic QA/remediation and release to production. This report distinguishes measured results from remaining owner/external validation. Production status will be updated after deployment.

- PDF source highlighting: selected A treatment, text-aligned highlights, honest related-passage fallback, one active citation, zoom/fit-width stability, and return-to-answer focus restoration. Five existing real PDFs were exercised in the preceding acceptance batch, including academic, financial, court and Chinese documents.
- Durable annual allowances: 12 calendar-month installments per paid annual invoice, atomic balance/ledger/schedule writes, concurrent and repeated delivery safety, paid upgrade supplements, late-event reconciliation, refund/cancellation review and retry fairness. New sales default off until migration and worker/Beat verification; existing delivery does not depend on the sales flag.
- Chat cancellation: bounded settlement, rollback/invalidation, explicit SQLAlchemy session close, heartbeat/source cleanup and lease release across native cancellation and ASGI disconnect paths. Defined cleanup phases total at most 44 seconds for the tested cooperative driver paths; Uvicorn graceful shutdown is 60 seconds. Arbitrary code swallowing cancellation is not claimed forcibly terminable.
- Billing: annual cards disclose the actual annual charge; admin-assigned plans open a new Checkout rather than modifying a nonexistent subscription. Same-plan intent actions are disabled except the explicit Pro credit-pack shortcut.

## Verification evidence

- Full backend suite: 1,159 passed, 15 warnings (existing dependency/deprecation warnings), including PostgreSQL integration. Two additional annual PostgreSQL regressions passed in the 8-test final annual suite: delayed upgrade after future months already delivered, and refund of only the upgrade funding invoice. Ruff passed.
- Frontend: 150 unit tests passed; lint and critical i18n checks passed; Next.js production build passed; version consistency 0.30.1; diff whitespace checks passed.
- Two actual Stripe sandbox test-clock runs passed: paid annual invoice, 12 monthly installments from a January-31 anchor, upgrade with paid proration, period-end cancellation, idempotent repeats, and refunded invoice holding remaining installments. No live charges or refunds were performed.
- Browser: existing 15-page academic PDF generated a fresh cited answer; citation jumped to page 4, related passage was labelled honestly, fit width reached 135%, and Back to answer restored focus. No horizontal overflow. New annual Checkout reached Stripe Sandbox with the exact annual amount; payment was not submitted.
- Independent adversarial review: see independent-review.md. Reproduced cancellation/hidden-close/heartbeat-budget defects were corrected before freeze. Latest reviewed candidate had no reproducible P1/P2.

## Production read-only baseline

- Backend 0.30.0, migration 20260826_0043, one Beat process, actual container region us-west2.
- Live Stripe complete subscription pagination: one canceled subscription; zero annual subscriptions, zero annual paid invoices, zero unknown annual prices. No annual historical backfill is needed.
- 457 historical negative chat ledger entries lacked the later reconciliation marker; all precede 2026-08-03. They are historical unmarked records, not evidence of 457 unresolved charges. No automatic refunds or retroactive marker changes were made.
- Previous backend deployment: 03d77975-0ef7-4839-ad48-997aeaff7a62; previous sidecar deployment: 19500875-7b59-4723-91f9-f933a9d335cd. Baseline source/configuration was saved locally for rollback. Add-only migrations 0044–0046 preserve existing data.

## Evidence and limits

Detailed logs, screenshots and private sandbox identifiers remain local in this directory; private reports and credentials must not be committed. The source PDF tests establish behavior on those documents, not perfect OCR or translation for arbitrary documents.

The owner's actual Imprint address/VAT information remains pending. No external gateway classification submissions, real payments, unrequested emails, physical-device/screen-reader certification or five-person user study are claimed. A new production performance measurement is still required before claiming a mobile performance improvement.
