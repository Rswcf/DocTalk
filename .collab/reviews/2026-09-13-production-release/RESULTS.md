# DocTalk 0.30.1 release acceptance

## Released

DocTalk **0.30.1 beta is live at https://www.doctalk.site**. Backend-first rollout and the production checks below completed on 2026-09-13. Authorized scope was the existing systematic QA/remediation and production release. This report supersedes the earlier local-only acceptance status; it distinguishes measured results from owner, external-service and browser-policy limits.

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
- Remote CI: [run 34751958782](https://github.com/Rswcf/DocTalk/actions/runs/34751958782), source `ea87abd`, passed backend, migrations, frontend and Docker. The prior release checks exposed a Ruff-version mismatch: CI's pinned 0.9.7 defaulted below the actual Python 3.12 runtime and rejected `anext`, while the newer local Ruff passed. Reproduced with 0.9.7, corrected `backend/ruff.toml` to `target-version = "py312"`, then passed all checks without altering application logic. Existing Actions Node-runtime deprecation annotations are non-failing maintenance work; this is not a warning-free run.

## Production read-only baseline

- Backend 0.30.0, migration 20260826_0043, one Beat process, actual container region us-west2.
- Live Stripe complete subscription pagination: one canceled subscription; zero annual subscriptions, zero annual paid invoices, zero unknown annual prices. No annual historical backfill is needed.
- Final read-only live Portal configuration audit: one active default configuration; subscription updates disabled, cancellation and payment-method updates enabled. No external Portal settings were changed.
- 457 historical negative chat ledger entries lacked the later reconciliation marker; all precede 2026-08-03. They are historical unmarked records, not evidence of 457 unresolved charges. No automatic refunds or retroactive marker changes were made.
- Previous backend deployment: 03d77975-0ef7-4839-ad48-997aeaff7a62; previous sidecar deployment: 19500875-7b59-4723-91f9-f933a9d335cd. Baseline source/configuration was saved locally for rollback. Add-only migrations 0044–0046 preserve existing data.

## Production deployment and acceptance

| Surface | Verified result |
| --- | --- |
| Backend | Railway `50770a13-3afd-4a25-a571-3bdbe7dd13ac`, SUCCESS; public `/health` reports 0.30.1 beta; actual container region `us-west2`; migration `20260913_0046`. |
| Annual fulfillment | `ANNUAL_BILLING_ENABLED=true`; one steady-state Beat process; Beat scheduled and a worker successfully executed the annual sweep. No existing annual contracts required backfill, so the production sweep had zero due grants; actual installment lifecycle execution was tested in Stripe Sandbox, not by creating a live annual charge. |
| RetainPDF | Railway `d968faad-6959-497a-8082-8d40daf6520d`, SUCCESS; authenticated API, health 200, actual UID/GID 10001 and `us-west2`; installed footnote/context contract passed; backend contextual-glossary flag enabled after validation. |
| Frontend | Vercel `CHybqPGzUM2CSMpSyZDAdxiCFDGY`, Ready/Production, domain `www.doctalk.site`, stable source `8ebad0e` (application release `1f53ba0`). Both source branches were pushed; subsequent acceptance-document commits do not change application code. |
| Existing real PDF upload | Native Chrome file picker uploaded the existing public six-page court PDF from Downloads. Parsing reached Ready with six pages. This closes the earlier UI-upload gap for this tested path; the extension's direct file chooser API remains restricted. |
| Chat and citation | A fresh two-sentence answer cited the court document. Citation 1 jumped to page 5, displayed the honest Related passage fallback, and Back to answer restored the original citation-button focus. Answer persisted after navigation/reload; no horizontal overflow. |
| Translation | The six-page Chinese translation succeeded and remained discoverable in Previous translations after reload. Preview retained six pages; inspected page 3 terminology and page 5 substantive footnote were translated, with no visible footnote/body overlap on that page. Original/Translated viewing worked. |
| Production Demo D16 | Reopened the public earnings sample while signed in. Its page 5–6 citation placed the evidence anchor at y=420 within the PDF scroll viewport y=196–897. Back to answer restored Citation 2 focus. This validates the shared viewer's old offscreen-anchor defect; it is not a fresh anonymous-quota test. |
| Billing UI | Annual options displayed Plus $95.88/year and Pro $191.88/year with enabled subscription actions; current Free state remained visible. No production payment or plan change was submitted. |
| Accounting and runtime | Court chat settled exactly 4 credits with a persisted settlement marker; translation cost 0 credits under the permitted free trial. Final runtime check: zero chat leases, one Beat, zero annual schedule rows consistent with the live-contract audit. No unfinished new translation jobs or recent backend ERROR/Traceback/delivery-failed logs in the inspected window. |

The first non-root sidecar rollout could not write the legacy root-owned volume and was rolled back before the frontend release. A separately reviewed one-time maintenance deployment migrated 397 paths, retained contents/mode bits, and dropped privileges before API startup. The final application image contains no migration wrapper. Explicit `PORT=41000` corrected Railway's healthcheck port. See [the migration record](retainpdf-volume-migration.md); no database rollback or data purge was performed.

### Mobile performance sample

Production `/pricing`, Chrome Lighthouse 13.4.1, simulated Moto G Power/mobile:

| Measure | Result |
| --- | --- |
| Performance / Accessibility / Best practices / SEO | 100 / 100 / 96 / 100 |
| FCP / LCP | 0.8 s / 0.8 s |
| Total blocking time / CLS / Speed Index | 20 ms / 0 / 0.9 s |

This single laboratory navigation preserved browser storage (`disableStorageReset=true`). It is not a cold-cache all-site benchmark, physical-device measurement, field Core Web Vitals result, or a directly comparable improvement against the older differently configured 5.2 s sample. The best-practices deduction includes the existing report-only CSP issue; the enforcing CSP was not weakened. A nonce-based script-CSP migration remains a separate P3 hardening task.

### Browser download restriction

Both a normal direct download and native link activation encountered Chrome `ERR_BLOCKED_BY_CLIENT`. The documented browser download action opened Save; after saving `DocTalk-production-court-zh.pdf`, Chrome's download UI explicitly reported **“Blocked by your organization.”** No downloaded PDF reached disk. This is confirmed environment restriction evidence, not a passed download test or proof of every browser's behavior. No browser policy, extension permission or security protection was disabled. Successful PDF.js preview of the same authenticated artifact endpoint establishes retrieval/rendering, not file-save completion. The final file-save acceptance item remains blocked in this environment.

## Evidence and limits

Detailed logs, screenshots and private sandbox identifiers remain local in this directory; private reports and credentials must not be committed. The source PDF tests establish behavior on those documents, not perfect OCR or translation for arbitrary documents.

Local evidence includes production court citation and translated page-3/page-5 screenshots, the Lighthouse JSON, backend/sidecar runtime checks, final accounting, and the test logs listed above. Intermediate failed candidates are retained for traceability. Historical local reports describe the state at their own timestamps; this release report is the current deployment status.

The owner's actual Imprint address/VAT information remains pending. Browser file-save acceptance is blocked as described above. No fresh end-to-end Google/Microsoft/email login, real subscription renewal/tax/refund-notification lifecycle, external gateway classification submission, unrequested email, physical-device/screen-reader certification or five-person user study is claimed. Existing authenticated production use passed; live payment lifecycle remains covered by sandbox rather than real-money execution. Chinese DOCX rendering in a suitably provisioned Word/LibreOffice environment remains outside the verified PDF/export checks. These boundaries must not be summarized as “every possible test passed.”
