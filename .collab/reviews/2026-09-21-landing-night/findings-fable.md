# Landing Night, slices 1–2 — adversarial review (Fable, 2026-09-21)

**Verdict: SHIP-WITH-FIXES (re-verified 2026-09-21 after `725f66e`, tree `4adf43e`, production build).** The two facts that blocked are gone — the pool no longer touches the passage (pixel diff 0 over the highlighted rows at six viewports) and the evidence is now by measurement — but two local residuals must land and be re-measured before any 1920×1080 capture reaches the owner or the 09-23 gate: the field's top-fade mask (`editorial.css:795-801`) still dims the cited sentence to 39–62 % at 1920×1080, where the un-cited text under it is brighter (MAJOR-1b), and the answer card overhangs the fold in 7 of 11 locales at 1366×768 (MAJOR-3, open for de/fr/pt/ja/ko/hi/es). Everything else is closed; see "Re-verification" at the end. No redesign.

*Original verdict (2026-09-21, before `725f66e`): BLOCK (short).* The slice fails its own §5 acceptance gate at the viewports most visitors have: under the committed CSS the claim's darkness pool sits on top of the cited passage — 95 %/94 %/75 % over its three lines at 1440×900 (measured live), ≈95 % over the whole passage on the 800 px stages of 1280×720, 1366×768 and 1024×768 (computed from measured geometry, consistent with their screenshots) — so the final frame shows no lit passage. The evidence PNGs in this folder show a render the committed CSS does not produce at those sizes, so the owner milestone review cannot proceed on them. The fix is one declaration plus a re-derivation of the pool box, but it changes the hero's composition, so the four desktop viewports must be re-verified and re-captured before the owner and Codex judge it. Everything else below is small and local; nothing needs redesign.

Reviewed: `git diff 3320009..cab3bd8 -- frontend/` (the file at `slices-1-2.diff`), read against the plan `.collab/plans/2026-09-21-landing-night.md`, `.claude/rules/frontend.md` and `CLAUDE.md`. Line numbers are cited `@cab3bd8`; the working tree moved during the review (slice 3 landed as `c26a2e8`, and there are further uncommitted edits — see "Out of scope" at the end), so I checked every live measurement against the committed rule text. Live checks ran on the author's dev server (port 3100, Chrome 152 in the Browser pane), with `?still` unless stated.

---

## MAJOR

### MAJOR-1 — The claim's darkness pool covers the cited passage on every common laptop viewport

`frontend/src/app/editorial.css:725-740 @cab3bd8` (`.ed-night-claim::before`: `top: -80px; height: 660px; radial-gradient(closest-side, paper 97% 0%, paper 94% 62%, transparent 100%)`), with `HeroSection.tsx:41 @cab3bd8` (`focusY: 0.64`) and `editorial.css:686` (`min-height: max(800px, calc(100svh - 64px))`).

**Failure.** The pool is a positioned pseudo-element at `z-index: -1` in the stage's `isolation: isolate` context, later in tree order than `.ed-night-field` (also `-1`), so it paints **above** the canvas — proven by forcing `background: red !important` on it: the red box covers the passage and everything above y≈732. Its gradient box is fixed (1560×660, anchored 80 px above the claim), so its 94 % plateau reaches 62 % of a 330 px vertical radius, i.e. to viewport y≈607 at 1440×900, and the ellipse only fades out by y≈732. The passage centre is placed at `0.64 × stageHeight`:

| viewport | stage h | passage centre (viewport y) | pool t | pool alpha over passage (measured / computed) |
|---|---|---|---|---|
| 1280×720 | 800 | 576 | 0.53 | ≈0.95 — computed from measured `passageY`/`claimTop`; screenshot shows the passage barely visible |
| 1366×768 | 800 | 576 | 0.53 | ≈0.95 — computed (same geometry as 1280×720) |
| 1024×768 | 800 | 576 | 0.53 | ≈0.95 — computed; screenshot shows the passage barely visible |
| 1440×900 | 836 | 599 | 0.60 | 0.95 / 0.94 / 0.75 over the three highlighted lines — measured live, (a)–(f) below; spec-equivalent gradient sampled at y = 571/601/631 |
| 768×1024 | 960 | 678 | 0.84 | ≈0.40 — computed; screenshot shows the first line visibly dimmer |
| 1920×1080 | 1016 | 714 | 0.95 | ≈0.12 — computed; screenshot bright (fine) |

Measured, not inferred: (a) `document.elementFromPoint(720, 600)` returns `div.ed-night-claim` (the pool's box) at the passage; (b) `getComputedStyle(claim, '::before').backgroundImage` = `radial-gradient(closest-side, color(srgb .09 .086 .078 / 0.97) 0%, … / 0.94 62%, rgba(0,0,0,0) 100%)`; (c) a white canvas under the pool renders as an opaque near-black ellipse down to ≈y 560 fading out by ≈y 700; (d) with the pool `display: none` the passage is bright and the highlight reads exactly as §5 wants; (e) the live, probe-free sequence at 1440×900 ends with **no visible passage** at all; (f) restoring the committed tokens (`--ed-paper: #171614`) on the drifted tree changes nothing — the pool rule is byte-identical between `cab3bd8` and the working tree (`git diff` shows no hunk in it) and the card top is 660 in both `n2-home.png` and my run, so this is the committed behaviour, not the drift.

**Why the evidence disagrees.** `n2-home.png`, `n2-mid.png` and `n2-reduce.png` show a lit passage *and* faint document text behind the h1 — the look you get with the pool absent (my toggle (d) reproduces those PNGs exactly). Under the committed rule the text behind the h1 sits at t≈0.64 → ≈0.89 alpha and cannot be visible. I cannot tell how those captures were produced; they do not reproduce in Chrome 152 from this tree.

**Root cause (this is a port regression, not a prototype flaw).** Prototype B has the same 660 px / 97 %→94 %@62 % pool (`b-dark.html:68-71`) but places the passage at `focusY .72` on a `max(100vh, 860px)` stage with the claim's own `padding-top: 104px` and the pool at `top: 20px`: at 1440×900 that is t≈0.90 → ≈25 % pool, and B's `litAlpha .9` compensates. The port kept the pool box where it was (stage y≈8 vs B's 20) but moved the passage ~110 px up — deliberate deviation #2 (`focusY .64`, "to leave room for the card") plus the stage becoming `100svh − 64px` — into the plateau, and never re-derived the pool. The pool's three stops (97 % → 94 % at 62 % → 0) are B's own (`b-dark.html:71`), copied faithfully; the plateau is why the coverage is near-total once the passage is inside the ellipse, not something the port changed.

**Fix.** Size the pool to the claim instead of a fixed 660 px: `top: -80px; bottom: -48px; height: auto` (at 1440 the box becomes 452 px tall, ry ≈ 226, centre at viewport y≈298: the passage at 599 falls outside the ellipse, t≈1.33 → 0; the actions row at ≈476 sits at t≈0.79 → ≈50 % pooled — verify the lede and CTA still read there; the field's own top mask is only 12–20 % alpha at that height anyway), and/or drop the 94 % plateau back to the plan's two stops. Also add `pointer-events: none` (MAJOR-2). Then re-verify with `?still` at 1280×720, 1366×768, 1440×900 and 1920×1080, on `/de`, `/fr`, `/pt` at 1366×768 where the claim is tallest, and re-capture `n2-home/mid/reduce`; keep a pool-on/pool-off pair in the folder so the next reviewer can see the delta.

### MAJOR-2 — A parked pointer keeps the canvas loop running at full frame rate; today the pool's hit-box hides it

`frontend/src/components/landing/CitationField.tsx:440-456, 405-408 @cab3bd8`; `editorial.css:725 @cab3bd8` (no `pointer-events: none` on the pool).

**Failure.** `onMove` sets `cursor.ta = 1` (:447) and only `onLeave` clears it (:451). `cursorLive = cursor.ta > 0 || cursor.a > 0.01` (:405) therefore stays true for as long as the pointer *rests* anywhere over the canvas, and `frame` re-schedules itself (:408) — two full-bitmap `drawImage` calls plus a radial-gradient fill on a 2160×1800 layer per frame. Measured: 6 s after the sequence, with no pointer the count is 0 rAF in 2 s (the "0 rAF" claim holds); with the pointer merely parked at (720, 850) it is **137 `frame` calls in 2 s (≈68 fps)**, indefinitely. This is the "sixty times a second forever" the docblock (:20-22) says was removed. Today it is only reachable in the ≈170 px strip below the pool (and beside the card) because the pool intercepts pointer events everywhere else — `elementFromPoint` returns the claim over the whole stage down to y≈732 — which also means the cursor lamp, as shipped, is dead across ~80 % of the field. The moment MAJOR-1's `pointer-events: none` lands, a mouse left in the hero (the common desktop posture) becomes a permanent 60–120 fps redraw; the two fixes must ship together.

**Fix.** In `onMove`, (re)arm an idle timer (~1.2 s) that sets `cursor.ta = 0`; the existing decay then stops the loop about a second later. Alternatively only light the cursor while it is moving (`ta = 1` for the duration of the timer only). Add `pointer-events: none` to `.ed-night-claim::before` so the lamp works where the document is, and keep the claim's real box (760 px, text and buttons) as the only thing that swallows the pointer.

### MAJOR-3 — The answer card is below the fold on 1366×768, 1280×720 and 1024×768

`HeroSection.tsx:114-115 @cab3bd8` (card top = lowest highlight bottom + 16, clamped to the stage), `editorial.css:686` (stage floor 800 px), `HeroSection.tsx:41` (`focusY .64`).

**Failure.** The card (h≈183) is stacked under a passage that sits at 64 % of a stage whose floor is 800 px, while the viewport offers 704 (1366×768) or 656 (1280×720). Measured card overhang below the fold: **+65.5 px at 1366×768, +113.5 px at 1280×720, +51.5 px at 1024×768**; 1440×900 has 57 px to spare, 1920×1080 108 px, 768×1024 102 px. With this geometry the card fits only when the stage is ≥ ~744 px *and* the viewport is at least that tall; the clamp at :115 clamps to the stage, not to the viewport, so it never engages. 1366×768 is still the single most common desktop resolution, and the card is the "answer arrives with its citation" half of the moment. Independent of MAJOR-1 (shrinking the pool moves nothing).

**Fix (author's choice).** Either derive `focusY` from the available height so that `passageBottom + 16 + cardHeight + 24 ≤ min(stageHeight, viewportHeight − 64)` (≈0.58 at 704 px), or lower the floor and let the stage be `calc(100svh − 64px)` down to ~640 px, or on short stages fall back to the plan's beside-the-passage placement (`left: calc(50% + 150px)`), which does not spend the vertical budget twice. If the card moves, re-check the cookie-banner overlap that motivated deviation #1 at 1440 and 1024.

---

## MINOR

### MINOR-1 — Chinese and Japanese phone headlines carry a visible stray space

`HeroSection.tsx:136-139 @cab3bd8` (`{' '}<br />`) with `editorial.css:880` (`br { display: none }` ≤767 px).

**Failure.** The joiner is a real U+0020 in every locale. On a 375 px phone `/zh` renders `"每个回答 都标出原文所在页。"` — `text-wrap: balance` breaks after 都标, so the gap shows mid-line ("每个回答 都标 / 出原文所在页。"); `/ja` renders "すべての回答 / が、 正確なペ / ージを引用。" with the gap after the comma. Desktop is fine (the space collapses before the forced break). ko, hi, ar, and the Latin locales use spaces and are correct.

**Fix.** Cheapest: keep the authored `<br>` on phones under `:lang(zh), :lang(ja)` (the authored 4+8 / 8+10 splits suit a phone), i.e. scope :880 to `:not(:lang(zh)):not(:lang(ja))`. Or make the joiner per locale in the component (`['zh','ja'].includes(locale) ? '' : ' '`).

### MINOR-2 — If `CITED` is not found, the loop runs forever and the card waits for the 6 s fallback

`CitationField.tsx:241-248, 288-293, 377-380, 408 @cab3bd8`.

**Failure.** `cited` is null when the sentence is absent from the `occurrence` repeat (a content edit, or `occurrence ≥ repeat` in a settings tweak — the test only checks `CITED ⊂ PARAGRAPHS`). `draw` then returns before `finished` can be set (:288-293), so `frame` re-schedules at 60 fps with nothing to animate, and `onCited` never fires. Not reachable with today's content; one edit away.

**Fix.** In `layout()` after `buildLayout()`, when `!cited`: draw the dim page once, set `finished = true`, call `onCitedRef.current?.()` and do not `kick()`. Add an assertion (dev) or a test that `occurrence < repeat` for `WIDE` and `NARROW`.

### MINOR-3 — None of the new tests run in CI

`.github/workflows/ci.yml:64-86` (frontend job: `npm ci`, `npm run lint`, `npm run build`; no `test:unit`), `frontend/tests/landing-night.test.cjs:77-83 @cab3bd8` (skips without `pdftotext`).

**Failure.** The twin-rule guard, the verbatim-page check and the 11-locale key check exist only on developer machines; the verbatim check additionally *skips* rather than fails where poppler is absent. Pre-existing gap, but this slice leans on these tests as its contract ("the test checks", plan §8, §10). Fix: add `- run: npm run test:unit` to the frontend job, `sudo apt-get install -y poppler-utils` before it, and make the verbatim test fail (not skip) when `process.env.CI` is set.

### MINOR-4 — Light OS: overscroll bands and the page scrollbar stay light around the black page

`LandingPageContent.tsx:35, 61-70 @cab3bd8`; `color-scheme: dark` lives on the root div only (`editorial.css:107-141`).

**Failure.** `<html>`/`<body>` keep the app's near-white background and light `color-scheme`, so rubber-band overscroll on macOS/iOS shows white bands above and below the Night page, and the document scrollbar is the light one. Fix: in the same effect that swaps `theme-color`, toggle a class on `document.documentElement` (e.g. `dt-night-doc`) with one global rule `html.dt-night-doc { background: #171614; color-scheme: dark }`, restored on unmount.

---

## NIT

- **NIT-1** `CitationField.tsx:329, 367 @cab3bd8` — `ctx.roundRect` throws on Safari < 16 / Chrome < 99; the exception aborts `frame` before it re-schedules, so the lamp freezes on the passage with no highlighter and the card only appears via the 6 s fallback. Guard with `typeof ctx.roundRect === 'function'` and fall back to `fillRect`, or state the browser floor in the docblock.
- **NIT-2** `tests/landing-night.test.cjs:15-29 @cab3bd8` — the twin test only inspects selectors that *start with* `.dark .dt-editorial` in `editorial.css`. `html.dark .dt-editorial`, `.dark :is(.dt-editorial)`, or a `.dark` rule in another stylesheet targeting `.ed-*` would pass. Fail on any selector containing `.dark` in `editorial.css` without a `.dt-night` twin, and grep `globals.css` for `.dark .ed-` / `.dark .dt-editorial`.
- **NIT-3** `CitationField.tsx:274-276 @cab3bd8` — the `rgba(0, 0, 0, …)` stops are colour literals in a component whose test forbids colour literals; they are correct (`destination-in` discards the colour), so say so in a one-line comment before someone "tokenises" them.
- **NIT-4** `editorial.css:779-783 @cab3bd8` — browsers without the `scripting` media feature (Safari < 17, Chrome < 120, Firefox < 113) show the card from first paint at the CSS position (`bottom: 40px`) and then see it jump to the computed `top` when `onLayout` fires. Acceptable degradation; note it in the comment so it is not reported as a regression later.

---

## Deviations from the plan, judged

1. Card under the passage, text-column aligned — sound reasoning (cookie banner, long `landing.frame.answer`), but it spends the vertical budget twice and is why MAJOR-3 exists; keep it, fix the height budget.
2. `focusY .64` / `litAlpha .72` — `.64` is the root cause of MAJOR-1 (it moved the passage into the pool's plateau without re-deriving the pool); `litAlpha .72` is fine and the cited words are indeed the brightest thing where the pool does not cover them.
3. Fill + 16 % evidence + 1 px rule — reads as a highlight, not a selection, at 375 (verified) and at 1440 once the pool is fixed (verified with the pool hidden). Accept.
4. `@media (scripting: enabled)` instead of `is-armed` — better than the plan (no SSR flash); NIT-4 only.
5. Quote Finder note under the stage — fine; 14 px `--ed-ink-3` on the stage is 5.63:1.
6. No h1 entrance; `<br>` hidden on phones — fine for Latin/ko/hi/ar; MINOR-1 for zh/ja.
7. "0 rAF after the sequence" — true without a pointer, false with a parked one (MAJOR-2).

## Verified OK (so the MAJORs are read in proportion)

- Lifecycle: StrictMode double-mount is safe (cleanup nulls `relayoutRef`, clears the 1.2 s timer, cancels rAF, disconnects both observers; the first run's font promise sees `alive=false`, `CitationField.tsx:477-493`); `narrow` flip re-lays out through the settings ref without tearing down (`:137-140, 430-432`) and `onLayout` returns `null` on phones (`HeroSection.tsx:102-105`); `visible` starts true and the IO gate only ever defers a `kick`; no pointer listeners under `still`/reduced motion (`:453-456`); `!cited` aside (MINOR-2), `onCited` fires once (`:377-380`); no RO/IO feedback loop (the canvas is CSS-sized; `setCardPos` never resizes it).
- SSR / no-JS: the card is in the server HTML with no inline style (`<figure class="ed-night-card">`), hidden only under `(scripting: enabled)`; `narrow`, `cited`, `cardPos` all start at their SSR values, so no hydration mismatch; console shows zero errors on `/`, `/zh`, `/ja`.
- Contrast: card question 13 px `--ed-ink-3` on `--ed-surface` 5.11:1; note 14 px on stage 5.63:1; source row 13 px 5.11:1; badge 7.08:1 — all ≥ 4.5.
- Scoping: every new rule is under `.dt-editorial`; no `.dark`/`dark:` utilities in any landing component or the header/footer chrome; `.dt-editorial > *` z-index rule unaffected; the reduced-motion block (`editorial.css:662-671`) neutralises the card's rise (0.01 ms), so `?still`/reduced motion show the finished frame with no motion (matches `n2-reduce.png`).
- Twin rule: both `.dark .dt-editorial` sites carry the `.dt-editorial.dt-night` twin in the same list (`:107-108, :176-177`); the third site (`.ed-frame-page`) is deleted with `ProductFrame`; no orphan `ed-frame-*` rule except `.ed-frame-source-page`, which is harmless.
- Cookie banner mirrors `dt-night` (verified in every desktop/phone capture); language popover mirror is code-reviewed and test-covered (`closest('.dt-night')`, test :50-56) — **not** live-verified: my programmatic click ran on a hot-reloading tree and returned nothing; the author should open it once on a light OS.
- RTL: canvas wrapper `dir="ltr" lang="en"`; card keeps physical `left`; `/ar` card text and rows render correctly (`n2-ar.png` agrees with the code).
- i18n: every visible string goes through `t`/`tOr`; `landing.frame.source` shipped via `tOr` and is translated ×11 in `c26a2e8`; `landing.frame.caption` retired but left in the JSONs; JSON-LD and `landing.meta*` untouched.
- Width sweep 768/1024/1280/1366/1440/1920: no horizontal overflow (`scrollWidth === innerWidth` everywhere); the field width `min(1080px, 100%)` and `inset` maths in `onLayout` agree with the DOM (card `left` 93/193/236/273/513 as computed).
- Content: `CITED` ⊂ one paragraph; all 13 paragraphs verbatim on page 1 per `pdftotext` (test ran, not skipped, on this machine).

## Out of scope for slices 1–2, flagged for the 09-23 Codex pass

The working tree now carries uncommitted edits beyond `c26a2e8`: a standalone `.dt-editorial.dt-night { --ed-paper: #0a0908; --ed-paper-2; --ed-glass; --ed-glass-strong }` block, Geist as the Night display face (`geist` dependency, `background-clip: text` gradient on the h1), `dimAlpha .16`, `bloomAlpha .2`, `NIGHT_THEME_COLOR '#0a0908'`, and a rewritten twin test that permits exactly that block. `.claude/rules/frontend.md` as amended today says "never a standalone night block, never new token names", and the plan's §2 argued against `#0a0908` because ~8 dark tokens are measured against `#171614`. Rule text and code are diverging in the same tree; whichever wins, the rule, the plan §2 note and the test must say the same thing, and the pool arithmetic in MAJOR-1 must be redone on the final ground (a deeper stage makes the pool's 94 % plateau marginally more opaque in effect, not less).

---

## Resolution (Claude, 2026-09-21) — all findings fixed, verified by measurement

A note on the evidence first: Fable was right about MAJOR-1 and my PNGs were misread, not mis-rendered.
Pixel sampling of my own `n2-home.png`/`n3-home.png` at the passage gives (26,24,19)/(14,12,8) where the
pool-off render gives the highlight fill (87,67,19): the pool was covering the passage in my captures too, and I
judged the dim frame "lit" by eye. From here on, hero verification is by pixel comparison and DOM geometry, not
by looking.

| Finding | Fix | Verified |
|---|---|---|
| MAJOR-1 pool covers passage | Pool sized to the claim (`top:-80px; bottom:-40px`, no fixed height); passage anchored at claim bottom + `clamp(40, 6% stage, 64)` via new `anchorTop` setting, so it always starts below the pool box | `herocheck.mjs` at 1440×900, 1366×768, 1366×650, 1280×720, 1024×768, 1920×1080: passage top ≥ pool bottom everywhere; pool-on vs pool-off pixel diff over the passage rows = **0** at every viewport |
| MAJOR-2 parked pointer loop | `pointer-events:none` on the pool; the cursor lamp lights only while the pointer moves (1.2 s idle timer → `ta=0` → fade → loop stops) | `rafcheck.mjs`: idle 0 rAF/2 s; moving 120; parked 3.5 s later **0**; topmost element under the pointer is the canvas |
| MAJOR-3 card below the fold | Height-aware type/spacing (`svh` clamps), stage floor 640 px, passage follows the measured claim, stage grows instead of pulling the card over the passage; ≤740 px tall viewports tighten further and drop the card's source row (the badge and chip carry the "1") | card bottom ≤ viewport at all six viewports, incl. 1366×650 (a 768 px laptop screen under browser chrome) and 1280×720 |
| MINOR-1 zh/ja stray space | joiner is `''` for zh/ja, `' '` otherwise | code |
| MINOR-2 `!cited` loop | no citation → one dim frame, `finished`, `onCited`, no loop; test pins `occurrence < repeat` for WIDE and NARROW | unit test |
| MINOR-3 tests not in CI | `ci.yml` frontend job installs poppler-utils and runs `npm run test:unit`; the verbatim check fails (not skips) under `CI` | CI config |
| MINOR-4 light overscroll/scrollbar | `useNightDocument()` toggles `html.dt-night-doc` (reference-counted across roots); editorial.css paints html/body the stage and forces `color-scheme: dark` | contrast audit re-run |
| NIT-1 roundRect | `roundedRect()` helper falls back to `rect()` | code |
| NIT-2 twin parser | any `.dark` selector in editorial.css must be spelled `.dark .dt-editorial …` and twinned; new test forbids `.dark` + editorial classes in globals.css | unit test |
| NIT-3 mask literals | comment: destination-in keeps alpha only | code |
| NIT-4 scripting fallback | documented in the CSS comment | — |

Also: the theme-color / document dressing is now reference-counted (first mount captures the original values,
last unmount restores), so overlapping night→night navigations cannot leave app pages night-coloured (Codex
brief item 5). Contrast audit after all fixes: 54 marketing pages, light OS and dark OS, **0** below AA (the audit
now skips `.sr-only` text, which it had wrongly counted once `<body>` turned dark).

---

## Re-verification (Fable, 2026-09-21, after `725f66e`; tree `4adf43e`, `next start` on :3200)

**Method.** I re-measured rather than reading the Resolution table. The served bundle carries the fix (CSS: `bottom:-40px` and `pointer-events:none` on the pool, `html.dt-night-doc`, `max-height:740px`, `9.5svh`, no `height:660px`; JS chunks: `anchorTop` ×3, `roundRect` guard ×2, `dt-night-doc` ×2). Geometry: `herocheck.mjs` on `/` at the six viewports and on all ten locale roots at 1366×768 / 1366×650 / 1280×720 (de/fr/pt also 1024×768 and 1440×900). Pixels: pool-on vs pool-off diff over the highlighted rows *located by colour in the off image*, not by the computed `passageTop`; per-line p99 luminance of the cited words against the un-cited ink just below them; near-neutral ink beside the lede and the actions row. rAF: `rafcheck.mjs` as committed, plus a variant parked over the document at (1065, 560). `npm run test:unit`: 177 pass, 0 skipped (pdftotext present). Phones: `/zh`, `/ja` at 375×812. Light-OS document probe on `/`, `/pricing`, `/de`, `/tools` and across client navigations.

| Finding | Status | Evidence |
|---|---|---|
| MAJOR-1 pool covers the passage | **Closed as stated — residual MAJOR-1b below** | pool influence ends 30–60 rows above the first highlight band at all six viewports; diff over the highlight rows 0 (0 px differ) everywhere |
| MAJOR-2 parked pointer loop | Closed | idle 0 · moving 120 · parked 0 rAF/2 s on both pointer paths; canvas is topmost (`elementFromPoint`) |
| MAJOR-3 card below the fold | **Closed for `en` only** | en: card bottom ≤ viewport at all six (1366×768: 745/768, 1280×720: 651/720, 1366×650: 630/650); 7/11 locales overhang at 1366×768 — see below |
| MINOR-1 zh/ja stray space | Closed | 375 px: "每个回答都标出 / 原文所在页。", "すべての回答 / が、正確なペ / ージを引用。" |
| MINOR-2 `!cited` loop | Closed | `CitationField.tsx:442-452` draws the dim page, sets `finished`, fires `onCited`, no `kick`; test `:205` |
| MINOR-3 tests in CI | Closed | `ci.yml:84-85`; the verbatim test asserts (not skips) under `CI` (`landing-night.test.cjs:162`) |
| MINOR-4 light overscroll / scrollbar | Closed | html/body `rgb(10,9,8)`, `color-scheme: dark` over next-themes' inline `light`, theme-color `#0a0908` ×2 on all four routes; `html.dt-night-doc body` (0,1,2) beats globals' `.dark body` (0,1,1). The last-unmount restore (`night.ts:50-56`) is code-reviewed only: every marketing route is Night now, so a marketing→app client navigation needs a signed-in session |
| NIT-1 `roundRect` | Closed | `CitationField.tsx:118-122` |
| NIT-2 twin parser | Closed | any `.dark` selector must be spelled `.dark .dt-editorial …` (`test.cjs:22-25`); globals guard (`:34-43`) |
| NIT-3 mask literals | Closed | `CitationField.tsx:288-289` |
| NIT-4 scripting fallback | Closed | `editorial.css:871-875` |

### Still open

**MAJOR-1b — the field's own top-fade mask now dims the passage (same root-cause class as MAJOR-1).** `editorial.css:795-801`: `.ed-night-field` mask `rgba(0,0,0,.12) 0% → .2 44% → #000 64%` of the stage. Those stops are percentages of the stage height and were derived for `focusY .64`, which put the passage exactly where the ramp ends. `anchorTop` (`HeroSection.tsx:77, 100-113`) now places it at 46–56 % of the stage, inside the ramp. Measured p99 luminance of the cited words per line (reference 236 = the same words where the mask is 1.0):

| viewport | cited line 1 / 2 / 3 | un-cited ink 0–60 px below the passage, right of the card |
|---|---|---|
| 1920×1080 | 93 / 119 / 146 (39–62 %) | 144 — as bright as the brightest cited line |
| 1440×900 | 155 / 190 / 223 | 158 — brighter than cited line 1 |
| 1366×650 | 165 / 209 / 236 | 184 — brighter than cited line 1 |
| 1024×768 | 159 / 200 / 236 | 158 |
| 1366×768 | 186 / 229 / 236 | 158 |
| 1280×720 | 180 / 227 / 236 | 158 |

Lines 2–3 match the mask model to ±0.02 (`maskprofile.py`), so it is the mask — not the pool (diff 0) and not the lamp. At 1920×1080 the un-cited text under the passage (inside the lamp, where the mask is already 1.0) is brighter than the cited sentence; the 1920 frame shows it plainly, and the "cited words are the brightest thing" criterion I accepted under deviation #2 fails there. **Fix:** tie the mask's full-strength stop to the passage the way the pool now follows the claim — HeroSection already knows `anchorTop`; expose it on the stage as a custom property (e.g. `--ed-night-passage`) and end the ramp at `calc(var(--ed-night-passage) - Npx)`, or otherwise guarantee the field reaches 1.0 no lower than the first cited line. Pre-empt the side effect: pulling the ramp up raises the mask at the actions row from ≈0.2 to ≈0.7, where the pool is only ≈30 % — document ink beside the buttons is ≤ 12 % today (max 38/255 at 1920 and 1440) and must stay there. **Acceptance, all six viewports:** (a) every cited line p99 ≥ 0.9 × 236; (b) cited ≥ the un-cited ink just below it; (c) ink beside the actions row ≤ 15 %. Note for the next reviewer: the Resolution's "pool-on vs pool-off diff = 0" is true but only measures the pool's delta — the off image is itself mask-dimmed — so an absolute-brightness check belongs next to `herocheck.mjs` (p99 of near-neutral pixels ≥ 70 per 30 px line band from `passageTop`, versus the band from `cardTop` to +60 px right of the card).

**MAJOR-3 — open for 7 of 11 locales at 1366×768** (`HeroSection.tsx:149-158`, `editorial.css:976-982`). The localized answer wraps to four lines (the question to two), the card is ≈224 px, `stageMin` grows the stage and the card continues under the fold by design. Card bottom − viewport at 1366×768: de/fr/pt +21, ja +27, ko +46 (its headline wraps to three lines there; claim bottom 503), hi +8, es +1; it/zh/ar/en fit. At 1366×650: de/fr/pt +43, ja +23, hi +4, es +3 — the answer's last line is cut, the source row is already hidden. 1280×720 and 1024×768 fit in every locale measured. The `/de` 1366×768 frame shows the source row cut at the fold. Author's choice, checked not guessed: widening the tight query (`:976`) to `max-height: 800px` recovers ≈47 px (source row + padding), enough for all seven at 1366×768 but marginal for ko (+46 → fits by 1 px); 1366×650 needs the four-line answers handled (smaller card type, or the plan's beside-the-passage placement when the height budget fails). **Acceptance:** card bottom ≤ viewport at 1366×768 and 1366×650 for all 11 locale roots (`VIEWPORTS="1366x768 1366x650" node herocheck.mjs http://…/xx`).

### Not findings, for the 09-23 pass
- `about`, `contact`, `imprint`, `privacy`, `terms` now render through `MarketingShell` (`12a8565`), so `dt-night-doc` on `/about` is correct, not a leak; `.claude/rules/frontend.md` still lists those five as zinc/blue — update the rule with the code.
- The 1440×900 and 1366×768 frames read as intended (passage lit, card under it, document ≤ 12 % behind the buttons, ≤ 27 % on the first line under the pool); the composition needs no redesign, only the two re-derivations above.

---

## Resolution 2 (Claude, 2026-09-21) — MAJOR-1b and MAJOR-3 (all locales)

- **MAJOR-1b** — the field's top fade now ends at the passage, wherever it sits: `.ed-night-field` mask stops are
  `rgba(.2) calc(var(--passage-top) - 180px)` → `#000 calc(var(--passage-top) - 24px)`, and HeroSection sets
  `--passage-top` to the measured anchor (64 % before measurement).
- **MAJOR-3 (all locales)** — the card goes compact (no source row, tighter padding) wherever the FULL card would end
  below the first screen (`is-compact`, decided from the remembered full height, so it cannot flip), plus under
  `max-height: 820px`; `max-height: 700px` tightens the claim further. The pool's reach and the passage gap floor
  moved together from 40 to 32 px (the invariant test still pins them).
- **Measured** with `frontend/scripts/design-audit/herocheck.mjs` + `herocompare.py`, production build, 11 locales ×
  5 viewports (1366×768, 1440×900, 1920×1080, 1280×720, 1366×650) = 55 renders, each against a control with BOTH
  the claim pool and the field mask removed: passage p99 difference **0** in all 55 (max 2); card overflow **none**;
  passage top ≥ pool bottom + 6 px; topmost element at the passage is the canvas in all 55. `rafcheck.mjs`: 0 / 120 / 0.
  Contrast audit, 54 pages, light OS: 0 below AA. 177/177 unit tests; lint and build pass.
- The `frontend.md` zinc-pages sentence noted under "Not findings" was already removed in `12a8565`; the five pages
  are listed in the editorial surface.
