# QA Run - Production Tools UX - 2026-05-11

Scope: browser-level production UX checks for the public `/tools` utility pages, covering hub navigation plus the interactive Word Counter and Reading Time Calculator on desktop and mobile.

## Environment

| Item | Value |
|---|---|
| Frontend | `https://www.doctalk.site` |
| Harness | `.collab/scripts/qa_production_tools_ux.js` |
| Evidence | `.collab/tasks/qa-production-tools-ux-2026-05-11.json` |
| Viewports | Desktop `1440 x 900`; mobile `390 x 844` |

## Command

```bash
node .collab/scripts/qa_production_tools_ux.js \
  --base-url https://www.doctalk.site \
  --json-out .collab/tasks/qa-production-tools-ux-2026-05-11.json \
  --screenshot-dir .collab/tasks/screenshots/2026-05-11/production-tools-ux
```

## Result

Final result: **pass**.

```json
{
  "result": "pass",
  "summary": {
    "total": 2,
    "passed": 2,
    "failed": 0,
    "scenarios": 6
  }
}
```

## Coverage

`/tools` hub:

- Page loaded on desktop/mobile.
- H1 rendered.
- Word Counter and Reading Time Calculator links were visible.
- No horizontal overflow or clipped interactive controls.

`/tools/word-counter`:

- Custom text `Alpha beta beta.\n\nGamma delta alpha!` produced `6` words, `36` characters, `2` sentences, and `2` paragraphs.
- Top words included `alpha` and `beta`.
- Copy stats showed `Copied`.
- Clear reset the text and word count to `0`.
- Sample text populated the textarea and updated stats.
- No horizontal overflow, clipped controls, console errors, page errors, or failed requests.

`/tools/reading-time`:

- `300` generated words produced `300 words`, average reading `2 min`, and average speaking `2 min`.
- Silent average row and conversational speaking row both showed `2 min`.
- Clear reset the text and word count to `0`.
- Sample text populated the textarea and updated word count to `45 words`.
- No horizontal overflow, clipped controls, console errors, page errors, or failed requests.

Privacy/safety assertion:

- The harness asserted there were no non-auth `/api/*` requests during tool interactions. The tools process user text in the browser.

## Harness Notes

- Initial harness attempts were corrected for overly broad heading selection and Top Words DOM extraction. Final evidence is the passing JSON listed above.
