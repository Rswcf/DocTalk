# Codex r2 — locale index tiers + Humata facts (2026-10-10)

Reviewer: `codex exec -m gpt-5.5`, read-only, against abac594a. Final section only.

Run note: the first r2 run hung for ~3 h after a connection error (13:20:57Z) before writing a verdict. Its last completed checks, on the build from abac594a, passed: 99 tier-2 sub-pages carry `noindex, follow`, a self canonical and no `rel=alternate`; only tier-2 home pages appear as alternates; no hidden language nav links a tier-2 sub-page; no tier-2 sub-page in the sitemap. It was stopped and rerun with those checks marked done (r2b below).

SHIP-WITH-FIXES

1. `zh` `altsHumata.heroDescription` / `altsHumata.metaDescription` at `zh.json:1796-1797`, and `fr` same keys at `fr.json:1791-1792` — should-fix. They still use pricing-comparative wording: zh says alternatives lead on “pricing”; fr says Humata has “prix élevés.” Exact fix: translate the current English wording: “page-based pricing, English-only interface, and lack of citation highlighting,” with no “pricing-leading” / “high prices” phrasing.

2. `zh` `compareHumata.whatIsHumataDescription`, `compareHumata.verdictParagraph1`; `fr` those same keys plus `altsHumata.faq1Answer` / `altsHumata.faq3Answer` — should-fix. These are abbreviated and omit English price facts. Exact fix: translate the current English values, preserving Free 60 pages/mo; Expert $9.99/mo, up to 3 users, 500 pages, then $0.02/page; Team $49/user/mo, up to 10 users, 5,000 pages, then $0.01/page.

No Student plan, Humata `$4.99`, Humata `$14.99`, or unlimited-pages claim found in the target keys. `$14.99` hits are AskYourPDF. JSON is valid; `*.metaTitle` / `*.metaDescription` values are single-line. Tests pass 16/16 with `/opt/homebrew/bin/node --test tests/sitemap-routes.test.cjs tests/seo-meta-keys.test.cjs`; default `/usr/local/bin/node` crashes before tests with `SecItemCopyMatching failed -50`. The new sitemap tests are meaningful.

## Claude's resolution

1. Fixed: zh/fr `altsHumata.heroDescription` and `.metaDescription` now translate the English (page-based pricing, English-only interface, no citation highlighting); no "leads on pricing" / "prix élevés".
2. Fixed: zh `compareHumata.whatIsHumataDescription`, `.verdictParagraph1`; fr the same two plus `altsHumata.faq1Answer`, `.faq3Answer` now translate the full English, with the 2026-10-10 Humata numbers.
