# QA Run - 2026-05-10 - Account Privacy Matrix

Scope: execute account profile, GDPR-style data export, export rate-limit, and account deletion checks for the long-run `/goal`.

## Environment

| Item | Result |
|---|---|
| Backend | Existing local `http://127.0.0.1:8000` healthy |
| Docker infra | Postgres, Redis, Qdrant, MinIO running |
| Celery | Existing `default,parse` worker processes running |
| Test file | `test_inputs/semiconductor.pdf` |
| Account | Temporary Free QA user with no Stripe customer/subscription |

## Artifacts

| Artifact | Purpose |
|---|---|
| `.collab/scripts/qa_account_privacy_matrix.py` | Reusable profile/export/rate-limit/delete matrix. |
| `.collab/tasks/qa-account-privacy-matrix-2026-05-10.json` | Machine-readable account privacy execution result. |

## Command Run

```bash
python3 .collab/scripts/qa_account_privacy_matrix.py \
  --api-base http://127.0.0.1:8000 \
  --file test_inputs/semiconductor.pdf \
  --timeout 240 \
  --json-out .collab/tasks/qa-account-privacy-matrix-2026-05-10.json
```

## Results

Overall: **Pass**. 10/10 checks passed.

Setup:

| Data | Count Before Delete |
|---|---:|
| User rows | 1 |
| Documents | 1 |
| Sessions | 1 |
| Messages | 2 |
| Credit ledger rows | 1 |

Checks:

| Case | Expected | Result |
|---|---|---|
| `GET /api/users/me` | 200, current user id/email | Pass |
| `GET /api/users/profile` | 200, stats show 1 doc / 1 session / 2 messages | Pass |
| `GET /api/users/usage-breakdown` | 200, empty mode usage | Pass |
| `GET /api/users/me/export` | 200 JSON attachment with user, document, conversation, credit history | Pass |
| Immediate second data export | 429 `EXPORT_RATE_LIMITED` with `Retry-After` | Pass |
| Anonymous data export | 401 | Pass |
| `DELETE /api/users/me` | 200 `{deleted:true}` | Pass |
| DB rows after delete | user/docs/sessions/messages/credit ledger all zero | Pass |
| Deleted user's old JWT calls `GET /api/users/me` | 401 | Pass |
| Anonymous account delete | 401 | Pass |

Cleanup:
- The account was deleted through the product API.
- Verification query returned `qa_account_users=0`, `qa_account_docs=0`.

## Coverage Added

This run covers:
- Profile identity and stats.
- Account data export content and attachment behavior.
- Export rate limiting.
- Anonymous auth boundaries for account export/delete.
- Account deletion cascade for documents, sessions, messages, and credit ledger.
- JWT invalidation by user deletion.

## Not Covered

- Browser profile/account UI, confirmation dialog UX, download behavior, and post-delete frontend storage clearing were not exercised in this slice.
- Stripe subscription cancellation during account deletion was not exercised because the temporary QA user had no Stripe customer/subscription.
