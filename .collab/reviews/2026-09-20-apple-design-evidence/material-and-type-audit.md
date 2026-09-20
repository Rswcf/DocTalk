# Material-layer and typeface audit (mechanical, grep-verified 2026-09-20)

## Glass is in the content layer — 5 of 7 consumers
HIG Materials: "Don't use Liquid Glass in the content layer... use standard materials for elements in
the content layer" and "Use Liquid Glass effects sparingly... Limit these effects to the most important
functional elements."

`.ed-glass` consumers in frontend/src/:
  FUNCTIONAL layer (HIG-legitimate):
    marketing/EditorialHeaderBase.tsx    1   — sticky header  ✓
    marketing/EdLanguageSelector.tsx     1   — popover        ✓
  CONTENT layer (contrary to HIG):
    landing/HeroCollage.tsx              3   — decorative hero cards
    marketing/EdCardGrid.tsx             2   — content cards
    marketing/EdFaqList.tsx              1   — FAQ rows
    marketing/EdCtaBanner.tsx            1   — CTA banner
    marketing/EdComparisonTable.tsx      1   — comparison table
=> The v0.28.0 "Liquid Glass Batch 1" work put the material almost entirely where current HIG says it
   should not be. This is the clearest single point where "move toward Apple" and "keep what we shipped
   6 weeks ago" actually conflict, and the plan must resolve it rather than paper over it.
   Note the observation from the live site: at real scale these cards do not read as glass anyway —
   they read as flat cards on paper. So the material is paying a cost (backdrop-filter repaint) for an
   effect that is barely visible AND is in the wrong layer.

## Typeface switching — the concrete form of the HIG "minimize typefaces" violation
HIG Typography: "Minimize the number of typefaces you use, even in a highly customized interface.
Mixing too many different typefaces can obscure your information hierarchy and hinder readability."

Four families are loaded (layout.tsx): IBM Plex Sans, Sora, Fraunces, IBM Plex Mono.
Switch sites on the marketing surface:
  editorial.css  — 11 `font-family` declarations across 3 families
                   (one of them, line 187, hardcodes `var(--font-plex-sans)` and bypasses the token)
  marketing/ + landing/ .tsx — 15 inline `var(--dt-serif)` / `var(--dt-mono)` switches in 8 of 36 files
  => ~26 deliberate typeface switches on one surface.
Weight ceiling is 700 everywhere (Plex Sans 400-700, Sora 500-700). Apple-style display type gets its
presence from size + tight tracking + weight; with a 700 ceiling, size and tracking have to carry it.

## De-glass leftover bug class — largely closed
Only 4 remaining `text-white` / `white/NN` utilities on light surfaces with no `dark:` variant
(was ~40 before v0.23.0). Not a significant factor any more. Do not spend a phase on it.
