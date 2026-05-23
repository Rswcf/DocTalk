# Production Public Mobile UX Sweep - 2026-05-11

Scope: non-authenticated mobile browser UX sweep against the live production frontend at `https://www.doctalk.site`. This extends the local public mobile sweep by checking the deployed site rather than the local branch.

## Environment

- Frontend: `https://www.doctalk.site`
- Browser driver: Playwright Chromium
- Viewport: mobile `390x844`
- Route source: `.collab/tasks/qa-route-inventory-2026-05-10.json`

## Command

```bash
node .collab/scripts/qa_public_mobile_pages_ux.js \
  --base-url https://www.doctalk.site \
  --inventory .collab/tasks/qa-route-inventory-2026-05-10.json \
  --json-out .collab/tasks/qa-production-public-mobile-pages-ux-2026-05-11.json \
  --screenshot-dir .collab/tasks/screenshots/2026-05-11/production-public-mobile
```

## Result

Final result: **fail with known production CSP deploy drift**.

| Check | Result |
|---|---|
| Route matrix | 67/68 public routes passed |
| Status codes | Pass: failed route `/` still returned 200 |
| H1 | Pass: 0 H1 issues |
| Horizontal overflow | Pass: 0 route-level overflow issues |
| Clipped interactive controls | Pass: 0 clipped-control routes |
| Console errors | Fail: `/` emitted 5 CSP media violations |

Evidence:

- Raw result: `.collab/tasks/qa-production-public-mobile-pages-ux-2026-05-11.json`
- Failure screenshot: `.collab/tasks/screenshots/2026-05-11/production-public-mobile/home.png`

## Failure

The only failed route was `/`. The page rendered and had no layout failure, but browser console captured repeated violations:

```text
Loading media from 'data:audio/mp3;base64,...' violates the following Content Security Policy directive: "media-src 'none'".
```

Manual production header checks confirmed the deployed CSP still includes `media-src 'none'` on `/`, `/pricing`, and `/demo`. The local branch already has `media-src 'self' data:` in `frontend/next.config.mjs`, so this remains a production deploy-drift issue, not a new local code issue.

Tracking bug: `.collab/tasks/bug-2026-05-10-production-csp-media-src-none.md`.

## Notes

- The harness flags small tap targets as a warning signal. `67` routes had at least one small text link target, mostly footer and inline links; this did not fail the run because no controls were clipped and the existing local sweep used the same pass criteria.
- This was non-destructive and did not create accounts, documents, sessions, or billing records.
