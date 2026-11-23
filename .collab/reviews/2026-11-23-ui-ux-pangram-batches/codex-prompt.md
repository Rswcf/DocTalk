# Codex adversarial review — Pangram UI/UX batches 1–3 (2026-11-23)

You are reviewing frontend changes written by Claude. Be adversarial: look for
real bugs and broken project rules, not style preferences. You cannot run git;
everything you need is in this repository's working tree (already on branch
`claude/gallant-thompson-3oyisp`) and in the patch next to this file.

## What to read

1. `.collab/reviews/2026-11-23-ui-ux-pangram-batches/changes.patch` — the four
   commits under review, in order:
   - `f23bcc8` batch 1: X1 cookie banner, A1 source lists, M6 cleanup, M2 proof strip
   - `901333e` drop the CitationCard row; SourcesStrip takes over the active citation
   - `ebbf6d0` batch 2: M1 hero entry row + sample chips, M3 masthead
   - `bbad062` batch 3: M4/M5/M7 product vignettes, A2 last-question notice
2. The plan: `.collab/plans/2026-11-22-ui-ux-pangram-learnings.md`.
3. Project rules: `CLAUDE.md`, `.claude/rules/frontend.md` (Night editorial
   surface, one filled `.ed-cta` per view, 12px floor, scoped `editorial.css`,
   11-locale i18n, SSR prefix seeding, demo counter contract, citation display
   rules).

Out of scope: commits `dd53667` and `a201b6f` (guest own-document hand-off) are
another session's work; only flag them if this batch breaks them.

## Questions to answer (check each; say "no issue" if you checked and found none)

1. **SourcesStrip** (`components/Chat/SourcesStrip.tsx`, `lib/sourceList.ts`,
   `MessageBubble.tsx`, `ChatPanel.tsx`): with the CitationCard row deleted, is
   anything that used to work now lost (active-citation marking, keyboard
   access, collection/multi-document chats, table/summary citations, legacy
   citations without offsets, streaming skeleton)? Does sorting by `refIndex`
   or the collapse ever hide or misorder a source the answer cites? Does the
   `citationTarget` comparison (`chunkId` + `refIndex` + `messageId`) match
   what `onCitationClick` stores after `renumberCitations` /
   `uniqueCitationIndexes`?
2. **Cookie banner** (`components/CookieConsentBanner.tsx`): app-surface
   placement on `/d/*`, `/collections*`, `/shared/*`, `/document-diff` at
   phone, tablet and desktop widths — does it now cover anything important
   (PDF page controls, composer, collection header)? Are Decline and Accept
   still equally prominent?
3. **`/demo/<route>?question=` forwarding**
   (`app/demo/[sample]/DemoRedirectPageClient.tsx`, `lib/demoSamples.ts`): any
   injection, open-redirect or abuse path (a crafted link that auto-spends a
   visitor's free demo questions, very long or control-character input,
   encoding issues)? Compare with what `/d/<id>?question=` already allowed.
4. **Hero entry row** (`components/landing/HeroSection.tsx`, `editorial.css`
   `.ed-night-entry` and its `@media` rules): does it break the first-screen
   contract (claim + passage + answer card, review 2026-09-21 MAJOR-3), the
   `passageGap` / darkness-pool relationship, `CitationField` measurement, or
   reduced-motion / `?still`? Is `lang={locale}` on `.ed-night-claim`
   correct for every locale and harmless for screen readers? Still exactly one
   filled `.ed-cta` in the hero view?
5. **Masthead** (`components/marketing/EditorialHeaderBase.tsx`,
   `i18n/chrome.ts`): the `onDemoPage` regex, the language selector rendered
   in the mobile menu (portal, Night mirroring, focus), server-resolved
   `trySample` on localized pages, and that no page now shows two filled CTAs.
6. **Proof strip and vignettes** (`components/landing/ProofStrip.tsx`,
   `components/marketing/ProductVignettes.tsx`): is every claim true and
   checkable (11 languages, 7 formats, 1 click; verbatim `CITED`; formats from
   `UPLOAD_EXTENSIONS`)? Can the vignettes safely render in the async server
   feature pages (no client-only imports pulled into server components)?
   Any marketing claim the project forbids?
7. **How it works** (`components/landing/HowItWorks.tsx`): HowTo schema parity
   with visible text (`landingSchemaSources.ts`, `app/HomeJsonLd.tsx`,
   `tests/marketing-jsonld.test.cjs`), the hover/focus/click state, ARIA
   (`aria-current="step"` on a button, `aria-controls` to a panel that is
   `display:none` below lg), and keyboard use.
8. **CSS** (`app/editorial.css`): every new selector scoped under
   `.dt-editorial`; no `.dark` rule without its `.dt-editorial.dt-night` twin;
   no new night-only tokens; nothing under 12px; `--ed-ink-3` only at 13px+;
   `:dir(rtl)` / `:lang()` / `subgrid` support acceptable for the browsers the
   project targets; reduced-motion handled.
9. **i18n**: every new key in all 11 locales with sensible translations
   (`landing.proof.*`, `landing.entry.*`, `landing.vignette.*`,
   `header.trySample`, `chat.sources.show*`, `citation.passageFallback`,
   `demo.lastQuestion`, `pricing.eyebrow` case change); `LANDING_PREFIXES`
   seeds everything the localized landing reads; nothing reads a
   `*.metaTitle` key.
10. **A2** (`ChatPanel.tsx`): the last-question copy uses `demoRemaining`
    without touching the demo counter contract.
11. **Tests** (`tests/source-list.test.cjs`, `tests/landing-entry.test.cjs`,
    `tests/product-vignettes.test.cjs`, `tests/citation-display.test.cjs`):
    do they actually catch regressions, or only restate the implementation?

## Output

Write your findings to
`.collab/reviews/2026-11-23-ui-ux-pangram-batches/codex-r1.md`:

- One section per finding: severity (P0 blocker / P1 must fix / P2 should fix
  / P3 nit), `file:line`, the concrete failure scenario (inputs or state →
  wrong result), and a suggested fix.
- Then the list above with "no issue" or a pointer to the finding, for each
  question you checked.
- End with a one-line verdict: ship / ship after fixes / do not ship.

Do not edit any other file.
