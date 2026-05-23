# BUG-2026-05-10-PRODUCTION-CSP-MEDIA-SRC-NONE

Status: **fixed locally, still pending production deploy**

## Summary

Production still serves `content-security-policy: media-src 'none'` on public pages. Earlier UI smoke found this policy blocks Remotion/landing media; the local branch now allows `media-src 'self' data:` in `frontend/next.config.mjs`, but `https://www.doctalk.site` has not picked that up yet.

## Severity

P2 production UI/UX deploy drift.

This can make public pages appear less polished or partially broken when media assets are expected to render. It does not block billing APIs directly, but it affects production trust surfaces around pricing/demo/landing.

## Evidence

Production public payment sanity:

- Raw result: `.collab/tasks/qa-production-payment-public-sanity-2026-05-10.json`
- Warning: `production_csp_media_src_not_current_local_policy`
- Observed: `media-src 'none'`
- Expected after local fix: `media-src 'self' data:`

Production public payment sanity rerun:

- Raw result: `.collab/tasks/qa-production-payment-public-sanity-rerun-2026-05-11.json`
- QA run: `.collab/tasks/qa-run-2026-05-11-production-payment-public-sanity-rerun.md`
- Functional checks: `9/9` passed
- `/pricing`: observed `media-src 'none'`
- `/demo`: observed `media-src 'none'`

Production public mobile UX sweep:

- Raw result: `.collab/tasks/qa-production-public-mobile-pages-ux-2026-05-11.json`
- QA run: `.collab/tasks/qa-run-2026-05-11-production-public-mobile-ux.md`
- Result: `67/68` public mobile routes passed
- Failed route: `/`
- Failure mode: 5 browser console CSP media violations for `data:audio/mp3` with `media-src 'none'`
- Screenshot: `.collab/tasks/screenshots/2026-05-11/production-public-mobile/home.png`

Production public HTML/security sweep:

- Raw result: `.collab/tasks/qa-production-public-html-security-2026-05-11.json`
- QA run: `.collab/tasks/qa-run-2026-05-11-production-public-html-security.md`
- Result: `68/68` public routes passed base HTML/security checks with warning
- Warning: all `68/68` routes still observed `media-src 'none'`
- Sensitive marker routes: `0`
- Missing canonical/meta-description routes: `0`

Manual header check also showed the old policy on:

- `https://www.doctalk.site/`
- `https://www.doctalk.site/pricing`
- `https://www.doctalk.site/demo`

## Recommendation

Deploy the current frontend CSP fix through the normal `main -> stable` path. After deploy, rerun:

```bash
python3 .collab/scripts/qa_production_payment_public_sanity.py \
  --json-out .collab/tasks/qa-production-payment-public-sanity-after-csp-deploy-2026-05-11.json
```

Expected result: `pass` with no CSP warning.
