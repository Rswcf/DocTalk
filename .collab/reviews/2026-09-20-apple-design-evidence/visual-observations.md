# Visual observations — live production, viewed 2026-09-20 in Claude's browser
(Claude looked at these directly; this file is the text channel to a model that cannot see images.)

## Landing page `/` (logged out, 1440-ish desktop)
- Warm grey-beige paper field. Top-left wordmark "DocTalk" with a small dark bookmark glyph + a tiny
  mono "STUDIO Nº 01 / DOCUMENT INTELLIGENCE" lockup beside it.
- Nav right: Features · Pricing · Trust & Security · EN · [Sign In] (solid terracotta pill).
- Eyebrow: mono, letterspaced, "01 — DOCUMENT INTELLIGENCE".
- Headline: very large Fraunces. Two lines roman ("Every answer cites") then one line ITALIC
  ("the exact page."). Ranged left, ragged right, tight leading.
- Sub: one line of Plex Sans, mid-grey, ~58ch.
- CTAs: solid terracotta "Start with a sample doc" + ghost "Sign Up Free →". Both rectangular with
  ~4px radius — NOT pills, unlike the Sign In button in the nav. Inconsistent button geometry.
- Right half: a collage of overlapping flat "document" cards with a dotted-grid patch, small plus-signs
  and green check dots, captioned "Fig. 01 — Reading with citations" in mono.
  It is an ILLUSTRATION of the product, not the product. No real UI is shown above the fold.
- Below fold: a stat row "11 LANGUAGES / 6 FILE FORMATS / 01 CITED ANSWERS" in Fraunces numerals with
  mono labels and hairline rules. "01 CITED ANSWERS" reads as a broken counter, not a claim.
- Overall read: a print/magazine layout (Monocle-ish). Competent, but it signals "editorial magazine",
  not "precision software". Density is high, whitespace is horizontal-only, nothing is centered,
  and there is no product moment.

## `/pricing` and `/demo`
- Same paper field, same Fraunces headline, breadcrumb "HOME / PRICING" in mono.
- Headline runs to TWO long lines ("Pricing built around real document work, not vague AI limits.")
  then a 5-line justified-ish paragraph before any plan is visible. Extremely text-forward.
- `/demo`: three sample-document cards, each with a mono category tag (FINANCE / RESEARCH / LEGAL),
  a "10 pages" meta, a loading shimmer, a title, a subtitle and a quoted suggested question.
  Cards are flat with hairline borders on paper — the `.ed-glass` material is NOT obviously reading
  as glass at this scale; it looks like flat cards.

## Authenticated dashboard `/`
- Completely different world: cool near-white #f6f8fc canvas, blue accents.
- Top bar: DocTalk + "BETA" chip + "Collections" + segmented [Flash | Pro] pill + theme icon +
  "100,881 credits" + avatar + "EN".
- A centered privacy strip in tiny type: "Privacy-first: your docs stay yours / TLS encrypted in
  transit, AES-256 at rest / DocTalk does not train models on your data / Delete your data anytime /
  Trust Center →". Four claims in ~10px type above the primary action — this is the FIRST thing in
  the content area, and it outweighs the upload box visually in count of elements.
- Upload dropzone: large white rounded card, dashed-free, "Drag & drop your document here", format list
  in tiny grey, "or", solid blue "Choose File" pill.
- Below: a URL input + blue "Import URL" pill, then "Try demo" as a tiny link.
- "My Documents" section title in Plex Sans semibold; Compare / Workspaces ghost buttons top-right;
  a "Search filenames" input and a "Sort documents" native <select> (unstyled OS select).
- A promo strip "Turn related documents into a workspace" with a blue CTA.
- Document rows: filename, then a single grey meta line "PDF · 290.2 KB · Pages: 6 · 5/13/2026,
  12:10:35 PM", a green "Ready" dot, a blue "Open" pill and a trash icon.
- Read: functional, generic SaaS. Blue pills of three different sizes, a raw native select, and
  legal/trust microcopy occupying the most valuable vertical space.

## Document reader `/d/[id]`
- Three systems visible at once: blue-grey app header on top, cream `--reader-*` paper in the chat
  column, zinc controls inside it.
- Left column (~40%): session chips row ("SESSION 1", two document tabs with "Page 4" badges),
  then the answer in small body type with inline superscript citation chips, an H3 "The 2026 CapEx
  plan itself", bulleted findings, and at the bottom a composer with [Default | Legal | Academic]
  pills, a "+" button, "Type a question…" and a circular blue send button. Under it a ~9px disclaimer
  "AI responses can be inaccurate. Always verify with the original document."
- Right column (~60%): PDF canvas with its own toolbar (zoom 100%, page 1/20, search, Translate,
  download, print) — a SECOND toolbar language that matches neither the app header nor the chat.
- The answer text is noticeably small relative to the PDF page text next to it.
- Read: dense, capable, but three toolbars in three idioms and no single visual owner of the screen.

## Reference: apple.com/macbook-pro (grammar we would be moving toward)
- Full-bleed near-black stage. Sticky translucent global nav, thin, monochrome, tiny type.
- Eyebrow = product name in plain small text ("MacBook Pro").
- Headline = huge, tight-tracked, ~1.05 leading SF-style sans, with ONE word colour-shifted for accent
  ("Fast runs in the family." — "in the family" shifts to a cool gradient).
- Sub = two short lines, normal weight.
- ONE action: a small solid blue PILL ("Buy"). No competing secondary CTA at the same weight.
- Everything is centred-left in a generous stage; the product image owns the majority of the viewport.
- One typeface. Two weights. One accent colour. Massive negative space.

## MEASURED: `/pricing` on a 375x812 phone (the highest-priority route per the Jev ranking)
Measured in-page via JS on production, 2026-09-20:
- viewport 812px, document 5778px
- H1 "Pricing built around real document work, not vague AI limits." renders 110px tall (3 lines)
- **first price ($0) sits at y=1877px — 2.31 screens of scrolling before any price is visible**
What occupies those first 2.31 screens: header, breadcrumb "HOME / PRICING", mono eyebrow "PRICING",
the 3-line serif headline, an EIGHT-line explanatory paragraph, two CTAs of near-equal weight
("Choose Plus" solid terracotta / "Try the public demo →" underlined), and a bordered refund notice.
This is the concrete form of all three Jev defects on one page at once: headline grammar 1.1/4
(long compound sentence with a comma and a "not X" contrast), competing actions 0.89 (two CTAs of
similar weight), prose-before-product 0.67 (eight lines of paragraph before anything actionable).
Craft note: the Fraunces headline itself is well set at this size — the typography is not the failure.
The FAILURE IS STRUCTURAL: the page is ordered like an essay, not like a product page.
