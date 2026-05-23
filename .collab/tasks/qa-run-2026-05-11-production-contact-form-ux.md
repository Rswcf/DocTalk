# QA Run - Production Contact Form UX - 2026-05-11

Scope: browser-level public `/contact` form UX on production, covering desktop and mobile validation/error/success states without intentionally sending production email.

## Environment

| Item | Value |
|---|---|
| Frontend | `https://www.doctalk.site` |
| Harness | `.collab/scripts/qa_production_contact_form_ux.js` |
| Evidence | `.collab/tasks/qa-production-contact-form-ux-2026-05-11.json` |
| Viewports | Desktop `1440 x 900`; mobile `390 x 844` |

## Command

```bash
node .collab/scripts/qa_production_contact_form_ux.js \
  --base-url https://www.doctalk.site \
  --json-out .collab/tasks/qa-production-contact-form-ux-2026-05-11.json \
  --screenshot-dir .collab/tasks/screenshots/2026-05-11/production-contact-form
```

## Safety Model

The corrected harness uses real production API calls only for validation paths that return `400` before email sending:

- Invalid email.
- Message too short.

The honeypot UI path and valid human success UI path are mocked with Playwright route interception to avoid sending production email.

Harness correction note: an initial harness attempt tried to exercise the honeypot against the real production API, but the hidden React-controlled field was not set in the submitted body. The corrected final run uses a forced input fill and mocks the honeypot/success paths. Treat the final JSON as the evidence for this QA run.

## Result

Final result: **pass**.

```json
{
  "result": "pass",
  "summary": {
    "total": 2,
    "passed": 2,
    "failed": 0,
    "real_validation_contact_requests": 4,
    "mocked_success_viewports": 2,
    "mocked_honeypot_viewports": 2
  }
}
```

Per viewport, the run verified:

- `/contact` loaded successfully.
- Form, H1, labels, and submit button rendered.
- No horizontal overflow.
- No clipped visible interactive controls.
- No page errors or request failures.
- Expected `400` validation responses surfaced user-readable alerts:
  - `Invalid email address.`
  - `Message is too short.`
- Mocked honeypot request preserved the hidden `website` value and showed the success status.
- Mocked valid success request showed success copy and reset `name`, `email`, and `message` fields.

Expected console noise:

- Chromium logs two resource errors per viewport for the intentional `400` validation responses. The harness records them and excludes only those known validation errors from the unexpected-console gate.
