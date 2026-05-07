# DocTalk Design Direction

## Product Posture

DocTalk should feel like a verified reading desk: calm, precise, and evidence-first. The interface is for students, researchers, analysts, lawyers, and operators who need to move through dense documents without losing source traceability.

The product should not feel like a generic AI chat surface. The answer is useful only when the source is visible, clickable, and easy to inspect.

## Visual Principles

1. Evidence before flourish.
   Source chips, citation cards, page numbers, and highlights should carry more visual weight than decorative AI effects.

2. Warm paper, cool ink, amber evidence.
   Use warm off-white canvases, deep neutral text, blue ink for primary interaction, and amber only for evidence/highlight moments.

3. Dense but breathable.
   Reading and research tools need more information density than marketing pages, but with strong section grouping and enough white space for scanning.

4. Repeated items may be cards; page sections should not be nested cards.
   Message answers, citation cards, and document rows can be framed. Large layout sections should be full-height panes or bands.

5. Motion confirms state only.
   Keep hover/focus/selection under 200ms. Avoid decorative motion in the working canvas.

## Reader Surface

- The document page is the source canvas.
- The chat pane is an evidence notebook, not a chatbot toy.
- The resize handle should feel like part of the workspace chrome.
- Empty states should prompt document workflows: summarize, find evidence, compare, explain.

## Citation Components

- Citation markers are compact and clickable.
- Source strips should appear before answer prose.
- Citation cards should include ref index, page, and a short source preview.
- Evidence amber is reserved for citation/highlight states.

## Anti-Patterns

- Purple/blue AI gradients as hero or primary UI treatment.
- Generic "AI assistant" chat bubbles without source hierarchy.
- Oversized marketing typography inside the working app.
- Decorative blobs, orbs, or ambient animations in the reader.
- Invented metrics or vague trust claims.
