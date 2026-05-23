# DocTalk Design System

DocTalk uses an AI Document Workbench interface. The product should feel like a focused workspace for reading, asking, verifying, and acting on document evidence.

## Principles

- Workbench first: app pages should feel like a live AI workspace, not a marketing template or a generic chat page.
- Evidence is visible: citations, sources, verification, and document state must be surfaced as chips, status bars, or source strips near the answer.
- Human-readable analytics: admin pages must show business language and next-action cues, not raw event names.
- Brand-safe inspiration: use AI-native canvas ideas such as dotted grids, floating command bars, agent status, preview/edit modes, and glass panels without copying Google branding, Stitch assets, or Stitch wording.

## Visual Tokens

- Canvas: `--workbench-bg`, `--workbench-canvas`, dotted grid, restrained cyan/violet glows.
- Panels: `--workbench-panel`, `--workbench-panel-strong`, `--workbench-border`, `--workbench-border-strong`.
- Text: `--workbench-ink` for primary UI text, `--workbench-muted` for secondary labels.
- Actions: `--accent` and `--accent-light` for focused commands, evidence highlights, and active controls.

## Core Components

- `dt-workbench-canvas`: full-page canvas with grid and glow.
- `dt-shell-header`: translucent sticky product header.
- `dt-glass-panel`: elevated glass surface for major panels.
- `dt-agent-status`: compact status strip for agent, source, and verification state.
- `dt-command-bar`: floating command input surface.
- `dt-admin-panel` and `dt-kpi-card`: admin insight surfaces.

## Interaction Rules

- Primary user action should be available through a command bar or clearly grouped toolbar.
- Preview/edit controls should be segmented pills, not text-only links.
- Use icon buttons for tool actions where the meaning is common; add labels where ambiguity would slow users down.
- Keep cards at 16px or less radius for workbench surfaces and avoid nesting decorative cards inside cards.
- Dark and light themes must both preserve contrast and visible panel boundaries.
