# Production Public Machine Entrypoints - 2026-05-11

Scope: non-destructive production checks for public machine-readable entry points, social/share assets, favicon metadata, and PDF renderer static assets served by `https://www.doctalk.site`.

## Environment

- Frontend: `https://www.doctalk.site`
- Harness: `.collab/scripts/qa_production_public_machine_entrypoints.py`

## Command

```bash
python3 .collab/scripts/qa_production_public_machine_entrypoints.py \
  --json-out .collab/tasks/qa-production-public-machine-entrypoints-2026-05-11.json
```

## Result

Final result: **pass with warning**.

```json
{
  "total": 14,
  "passed": 14,
  "failed": 0,
  "warnings": 1,
  "groups": [
    "crawler_entrypoints",
    "pdf_render_static_assets",
    "share_and_icon_assets"
  ]
}
```

Evidence: `.collab/tasks/qa-production-public-machine-entrypoints-2026-05-11.json`

## Coverage

Crawler and LLM entry points:

- `GET /robots.txt` returned `200`, allowed `/`, disallowed private/gated route prefixes, and declared `https://www.doctalk.site/sitemap.xml`.
- `GET /sitemap.xml` returned parseable XML with 50+ public URLs, required public paths, no duplicates, no private/gated prefixes, and only `https://www.doctalk.site` URLs.
- `GET /llms.txt` returned product, use-case, and blog sections with HTTPS DocTalk links.
- `GET /38e9d0db4a654c64b237039b2ac0af5d.txt` returned the exact public IndexNow key body.

Social/share and icon assets:

- `GET /opengraph-image` and `GET /twitter-image` returned valid PNG images.
- `GET /icon.svg`, `GET /logo-icon.svg`, and `GET /logo-icon.png` returned valid image assets.
- Root HTML advertised a valid favicon link.

PDF renderer static assets:

- `GET /pdf.worker.min.mjs` returned the PDF.js worker with expected worker symbols.
- `GET /cmaps/UniJIS-UCS2-H.bcmap` returned the Japanese CMap asset.
- `GET /cmaps/UniGB-UCS2-H.bcmap` returned the Chinese CMap asset.
- `GET /standard_fonts/LiberationSans-Regular.ttf` returned a valid TrueType font.

All checked responses avoided sensitive marker leakage for localhost/loopback, DB/Redis URLs, provider key names, auth/adapter/Stripe secret names, Stripe secret patterns, private keys, and stack traces.

## Warning

Production root HTML currently advertises only:

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

It does not yet advertise an Apple touch icon or web manifest. This is not a functional blocker for the web app, but it is a share/install metadata quality gap for mobile users and previews.

Tracking note: `.collab/tasks/bug-2026-05-11-production-icon-manifest-metadata-missing.md`

## Local Fix

Patched frontend metadata:

- `frontend/src/app/layout.tsx` now explicitly advertises `/icon.svg` and `/logo-icon.png` as the favicon and Apple touch icon.
- `frontend/src/app/manifest.ts` now generates `/manifest.webmanifest` with DocTalk name, description, theme colors, start URL, and icons.

Validation:

- `cd frontend && npm run build` passed.
- Build output includes static `/manifest.webmanifest`.
- Generated HTML contains both `<link rel="manifest" href="/manifest.webmanifest">` and `<link rel="apple-touch-icon" href="/logo-icon.png" ...>`.
- Local Next production server retest passed with the same harness:

  ```bash
  python3 .collab/scripts/qa_production_public_machine_entrypoints.py \
    --base-url http://127.0.0.1:3000 \
    --expected-site-url https://www.doctalk.site \
    --json-out .collab/tasks/qa-local-public-machine-entrypoints-after-icon-manifest-fix-2026-05-11.json
  ```

  Result: `14/14` pass, `0` warnings. Root HTML advertised `manifest`, `icon`, and `apple-touch-icon`; `/manifest.webmanifest` returned `200 application/manifest+json`, parsed as `DocTalk`, and contained `2` icons.

Production remains warning-only until the frontend is deployed and this harness is rerun.
