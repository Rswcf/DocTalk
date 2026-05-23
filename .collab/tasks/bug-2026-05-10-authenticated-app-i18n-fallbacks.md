# BUG-2026-05-10-AUTHENTICATED-APP-I18N-FALLBACKS

Status: **fixed locally / retested**

## Summary

Authenticated app pages rendered correctly across all 11 supported locales, but Profile, Billing, and Collections emitted `tOr` fallback warnings for 28 keys. This meant portions of logged-in app copy were not fully represented in the locale JSON files.

The missing authenticated-app keys have now been added to all 11 locale JSON files, and the authenticated locale browser smoke was rerun successfully. The final retest also cleared the untranslated-core-key warnings for visible Profile, Collections, and Document Diff labels.

## Evidence

- Passing matrix: `.collab/tasks/qa-authenticated-locale-ui-2026-05-10.json`
- Run report: `.collab/tasks/qa-run-2026-05-10-authenticated-locale-ui.md`
- Coverage: 88/88 checks passed across 11 locales, 4 authenticated routes, and desktop/mobile.
- Fix/retest run: `.collab/tasks/qa-run-2026-05-11-authenticated-locale-i18n-cleanup.md`
- Final passing retest: `.collab/tasks/qa-authenticated-locale-ui-after-i18n-quality-fix-2026-05-11.json`

## Affected Keys

- Profile: `profile.eyebrow`, `profile.subtitle`, `profile.overview.credits`, `profile.overview.documents`, `profile.overview.messages`
- Billing: `billing.overview.plan`, `billing.overview.credits`, `billing.overview.renewal`, `billing.overview.noRenewal`, `billing.eyebrow`, `billing.subtitle`, `billing.overview.title`, `billing.planSelector.title`, `billing.planSelector.subtitle`, `billing.refundPolicy.title`, `billing.refundPolicy.body`
- Collections: `collections.stats.collections`, `collections.stats.documents`, `collections.stats.latest`, `collections.stats.none`, `collections.eyebrow`, `collections.workspaceSubtitle`, `collections.libraryTitle`, `collections.librarySubtitle`, `collections.uploadFirst`, `collections.emptyStep1`, `collections.emptyStep2`, `collections.emptyStep3`

## Impact

- Severity: P3 localization quality issue.
- Functional impact: none observed in this run.
- UX impact: logged-in non-English users can see fallback English/product copy in parts of Profile, Billing, and Collections.

## Retest Criteria

1. Add these keys to all 11 locale JSON files.
2. Run:

```bash
node .collab/scripts/qa_authenticated_locale_ui_smoke.js \
  --base-url http://localhost:3000 \
  --fixture .collab/tasks/qa-authenticated-locale-fixture-2026-05-10.json \
  --json-out .collab/tasks/qa-authenticated-locale-ui-2026-05-10.json
```

3. Verify `missing_i18n_warning_keys` is empty or only contains explicitly accepted rollout keys.

## Retest Result

Final 2026-05-11 retest passed:

- `88/88` authenticated browser checks across 11 locales, 4 routes, and desktop/mobile.
- `missing_i18n_warning_keys={}`.
- `untranslated_core_keys={}`.
- Fixture cleanup verified zero residual rows for the QA user.
