# BUG-2026-05-11-PRODUCTION-ICON-MANIFEST-METADATA-MISSING

Status: **fixed locally, production deploy/retest pending**.

## Summary

Production root HTML exposes a favicon link but does not advertise an Apple touch icon or web manifest. Core web navigation still works, but mobile home-screen bookmarks, install surfaces, and some preview contexts can fall back to generic metadata.

## Environment

- Frontend: `https://www.doctalk.site`
- Harness: `.collab/scripts/qa_production_public_machine_entrypoints.py`
- Evidence: `.collab/tasks/qa-production-public-machine-entrypoints-2026-05-11.json`

## Reproduction

1. Fetch `https://www.doctalk.site/`.
2. Parse `<link>` tags in `<head>`.
3. Check icon and manifest metadata.

Expected:

- A reachable favicon is advertised.
- A reachable Apple touch icon is advertised.
- A web manifest is advertised and serves valid manifest JSON.

Actual:

- Root HTML advertises only:

  ```json
  [
    {
      "rel": "icon",
      "href": "/icon.svg?c51a6892d74efbdf",
      "type": "image/svg+xml",
      "sizes": "any"
    }
  ]
  ```

- No `rel="apple-touch-icon"` link is present.
- No `rel="manifest"` link is present.
- Direct production probes for `/manifest.json`, `/manifest.webmanifest`, and `/site.webmanifest` returned `404`.

## Impact

- iOS users adding DocTalk to the home screen may see a generic icon.
- Installability/PWA metadata is absent.
- Share and preview metadata is less complete than the rest of the public SEO surface.

## Local Fix - 2026-05-11

Patched frontend metadata:

- `frontend/src/app/layout.tsx` now declares:
  - `icon: /icon.svg`
  - `apple: /logo-icon.png`
- `frontend/src/app/manifest.ts` now generates `/manifest.webmanifest` with:
  - `name` and `short_name`
  - product description
  - `start_url` and `scope`
  - theme/background colors
  - PNG and SVG icon entries

Validation:

- `cd frontend && npm run build` passed.
- Next build output includes static `/manifest.webmanifest`.
- Built HTML contains `rel="manifest"` and `rel="apple-touch-icon"` links.
- Local Next production-server retest passed:
  - JSON: `.collab/tasks/qa-local-public-machine-entrypoints-after-icon-manifest-fix-2026-05-11.json`
  - Result: `14/14` pass, `0` warnings.
  - Root HTML advertised `manifest`, `icon`, and `apple-touch-icon`.
  - `/manifest.webmanifest` returned `200 application/manifest+json`, parsed as `DocTalk`, and contained `2` icons.

## Remaining Work

Deploy the frontend, then rerun:

```bash
python3 .collab/scripts/qa_production_public_machine_entrypoints.py \
  --json-out .collab/tasks/qa-production-public-machine-entrypoints-after-icon-manifest-fix-2026-05-11.json
```

The production warning can be closed once root HTML advertises both links and `/manifest.webmanifest` is reachable.
