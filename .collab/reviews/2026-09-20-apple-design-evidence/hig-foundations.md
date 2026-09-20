# Apple HIG — primary-source extracts (fetched 2026-09-20 via browser, not memory)
Source: developer.apple.com/design/human-interface-guidelines/{typography,layout,color,materials}
NOTE: Layout page carries "September 9, 2026 — Updated guidance to reflect current best practices."

## TYPOGRAPHY
- Default/minimum body sizes: iOS/iPadOS 17pt/11pt; macOS 13pt/10pt; visionOS 17pt/12pt.
- "In general, avoid light font weights... prefer Regular, Medium, Semibold, or Bold... avoid Ultralight, Thin, and Light."
- "Minimize the number of typefaces you use, even in a highly customized interface. Mixing too many
  different typefaces can obscure your information hierarchy and hinder readability, in addition to
  making an interface feel internally inconsistent or poorly designed."   <-- DIRECT HIT on DocTalk's
  current 3-family marketing stack (Fraunces + IBM Plex Mono + Inter).
- Hierarchy is built by adjusting *weight, size, and colour* — not by switching typeface.
- System families: SF (sans; SF Pro/Compact/Mono + script variants) and New York (serif, designed to
  work alongside SF). Weights Ultralight..Black; widths incl. Condensed/Expanded.
- Text styles = (weight + point size + leading) triples forming one hierarchy; leading loosens for long
  measure, tightens in constrained rows; "If you need to display three or more lines of text, avoid
  tight leading even in areas where height is limited."
- Tracking: the system font dynamically adjusts tracking at every point size (large sizes get tighter
  tracking). Mockups must emulate this manually.
- Dynamic Type: layout must adapt to text-size changes — stacked layouts at large sizes, fewer columns,
  no truncation, hierarchy stays constant, meaningful icons scale with text.

## LAYOUT
- Reading order: most important content top + leading. RTL must adapt (DocTalk ships `ar`).
- "Align elements to make them easier to scan, and use indentation to convey hierarchy." People assume
  aligned items are related; indented items are subordinate.
- "Group related items... use negative space, container shapes, or separator lines."
- Progressive disclosure to reduce initial choice load.
- **"Differentiate controls from content."** Use Liquid Glass for CONTROLS; "Instead of applying a solid
  or semi-opaque background color beneath controls, use a scroll edge effect to visually elevate
  controls above content." Full-screen background content extends under sidebars/toolbars/tab bars.
- Adaptability: size classes, orientation, window resize, text-size changes, locale/RTL/text length.
- Test largest and smallest layouts first.

## COLOR
- "Avoid using the same color to mean different things. Use color consistently... especially when you
  use it to help communicate information like status or interactivity."
- Every colour needs light + dark + increased-contrast variants. "Even if your app ships in a single
  appearance mode, provide both light and dark colors to support Liquid Glass adaptivity."
  <-- DIRECT HIT: `.dt-editorial` is declared light-only.
- Semantic, purpose-named colours over appearance-named ones; don't redefine semantic meanings.
- Never rely on colour alone to signal interactivity/state — pair with label or glyph shape.
- Culture check: red/green connotations invert (Stocks shows red = positive in Chinese). DocTalk ships
  zh/ja/ko/ar — relevant to any "verified = olive/green" semantics.

## MATERIALS  (this is the load-bearing one for DocTalk's glass program)
- Two material families: **Liquid Glass** (the functional layer) and **standard materials** (content layer).
- Liquid Glass "forms a distinct functional layer for controls and navigation elements — like tab bars
  and sidebars — that floats above the content layer."
- **"Don't use Liquid Glass in the content layer.** Liquid Glass works best when it provides a clear
  distinction between interactive elements and content, and including it in the content layer can result
  in unnecessary complexity and a confusing visual hierarchy. Instead, use standard materials for
  elements in the content layer, such as app backgrounds."
  Exception: transient interactive elements in content (sliders, toggles) adopt glass while active.
- **"Use Liquid Glass effects sparingly."** "Limit these effects to the most important functional
  elements in your app." Overuse "distract[s] from that content."
- Two variants: **regular** (blurs + adjusts luminosity; use when background could hurt legibility or
  the component holds significant text — alerts, sidebars, popovers) and **clear** (highly translucent;
  only for components over visually rich media). Clear over bright content needs a ~35% dark dimming layer.
- Standard materials (iOS): ultraThin / thin / regular / thick — these are what content-layer surfaces
  should use. Thicker = better contrast for fine text; thinner = keeps user's sense of context.
- "Help ensure legibility by using vibrant colors on top of materials."
- Choose material by semantic meaning, NOT by the colour it appears to impart.

## MOTION
- "Add motion purposefully, supporting the experience without overshadowing it. Don't add motion for the
  sake of adding motion. Gratuitous or excessive animation can distract people and may make them feel
  disconnected or physically uncomfortable."
- "Make motion optional." Never the sole carrier of information. (=> prefers-reduced-motion is mandatory.)
- "Strive for realistic feedback motion that follows people's gestures and expectations."
- "Aim for brevity and precision in feedback animations... brief and precise... feels lightweight and
  unobtrusive, and it can often convey information more effectively than prominent animation."
- "In apps, generally avoid adding motion to UI interactions that occur frequently."
- "Let people cancel motion" — never block interaction until an animation finishes.
- Liquid Glass motion itself is input-aware: more emphatic on direct touch, subdued on trackpad.

## DARK MODE
- "Avoid offering an app-specific appearance setting... they have to adjust more than one setting...
  Worse, they may think your app is broken because it doesn't respond to their systemwide appearance
  choice."  <-- DocTalk ships components/ThemeSelector.tsx; check whether it defaults to system.
- Must look good in light, dark AND Auto (can flip mid-session).
- Dark palette is NOT a mechanical inversion of light.
- **Contrast floor: "no lower than 4.5:1"; for custom fg/bg "strive for 7:1, especially in small text."**
- Test with Increase Contrast + Reduce Transparency on, separately and together.
- "Soften the color of white backgrounds" for content images shown in dark context.
- Dark-only is acceptable ONLY in rare immersive-media cases (e.g. Stocks).
