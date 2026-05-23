# BUG - Collection Add Documents Limit Had No User-Facing Error

Date: 2026-05-11

## Summary

Free users who already had the maximum number of documents in a collection could open **Add Documents** and click another ready document. The backend correctly returned `COLLECTION_DOC_LIMIT_REACHED`, but the collection detail page did not catch the error or show the upgrade path.

## Impact

- User sees no explanation inside the modal.
- Browser records a blocking console/page error.
- The plan limit is enforced, but the user has no clear next step at the exact point of failure.

## Reproduction

1. Create a Free user with one collection containing `FREE_MAX_DOCS_PER_COLLECTION=3` ready documents and one additional ready document outside the collection.
2. Open `/collections/{collection_id}` as that user.
3. Click **Add Documents**.
4. Click the extra ready document.

Initial evidence:

- `.collab/tasks/qa-browser-collection-doc-limit-ux-2026-05-11.json`

Observed:

- API response: `403 COLLECTION_DOC_LIMIT_REACHED`
- Collection document count stayed at `3`, as expected.
- No visible alert or Upgrade CTA appeared.
- Browser recorded `HTTP 403: {"detail":{"error":"COLLECTION_DOC_LIMIT_REACHED"...}}` as a console/page error on desktop and mobile.

Expected:

- The Add Documents modal should stay open.
- The modal should show concise collection document-limit copy and an Upgrade CTA.
- The failed request should not become an unhandled browser error.

## Fix

Updated `frontend/src/app/collections/[collectionId]/page.tsx`:

- catch `addDocumentsToCollection()` failures in the Add Documents modal
- map structured API errors with `errorCopy`
- render an inline `role="alert"` inside the modal
- render the existing billing CTA for `reason=collection_doc_limit`
- track `limit_hit` / `upgrade_click` events for this source
- disable the clicked document button while the add request is in flight

## Retest

Passed:

- `.collab/tasks/qa-browser-collection-doc-limit-ux-after-fix-2026-05-11.json`

Desktop and mobile both showed:

- `Too many documents`
- `Your plan allows up to 3 documents per collection. Upgrade for more.`
- `Upgrade` link to `/billing?plan=plus&period=monthly&source=limit&reason=collection_doc_limit`
- unchanged collection document count at `3`
- modal remained open
- 0 blocking console errors

Cleanup:

- `.collab/tasks/qa-browser-collection-doc-limit-fixture-cleanup-2026-05-11.json`
