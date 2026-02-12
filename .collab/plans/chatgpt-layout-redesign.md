# ChatGPT-Style Chat Layout Redesign Plan

## Gap Analysis: ChatGPT UI vs DocTalk UI

### Context
DocTalk's chat panel lives inside a resizable left panel (50% default) alongside a PDF/text viewer. ChatGPT uses a full-width centered column. The redesign must adapt ChatGPT patterns to DocTalk's side-panel constraint while preserving all existing functionality (citations, demo mode, streaming, export, regenerate, suggested questions, custom instructions, session management).

---

## Detailed Differences

### 1. Message Area Layout
| Aspect | ChatGPT | DocTalk Current | Action |
|--------|---------|-----------------|--------|
| Container | Centered max-width column (~680px) | Full-width in panel, p-6 | Add `max-w-3xl mx-auto` centering |
| Padding | Generous horizontal padding (~1.5-2rem) | p-6 (24px) | Keep p-6, add inner max-width |
| Message gap | Comfortable spacing | my-3/my-4 | Increase to my-4/my-6 |

### 2. Input Bar (Biggest Visual Difference)
| Aspect | ChatGPT | DocTalk Current | Action |
|--------|---------|-----------------|--------|
| Left button | "+" circle button (attachments/tools) | None | Add "+" button with popover menu |
| Placeholder | "Ask anything" | "Ask a question..." | Update placeholder text |
| Right icons | Mic + Voice mode (dark circle) | Export + Send (dark circle) | Keep Send, move Export to "+" menu |
| Container | Pill shape `border-radius: 28px` | `rounded-2xl` (16px) | **Upgrade to `rounded-3xl` (24px)** |
| Textarea max-height | ~50dvh | 160px | **Increase to `max-h-[40dvh]`** |
| Width | Centered, matches message column max-width | Full-width in form | Match message area max-width |
| Disclaimer | "ChatGPT can make mistakes..." below | None | Add disclaimer text below input |

### 3. Scroll-to-Bottom Button
| Aspect | ChatGPT | DocTalk Current | Action |
|--------|---------|-----------------|--------|
| Presence | Floating ↓ arrow when scrolled up | None | **Add floating scroll button** |
| Position | Center-bottom of message area | N/A | Center-bottom, above input bar |
| Appearance | Small circle with down arrow | N/A | Circle, zinc border, arrow icon |

### 4. Action Buttons on AI Messages
| Aspect | ChatGPT | DocTalk Current | Action |
|--------|---------|-----------------|--------|
| Visibility | Show on hover for all messages | Always visible on last AI msg | **Show on hover (group-hover) for all, always for last** |
| Placement | Below message, left-aligned | Below message, left-aligned | Same (good) |
| Buttons | Copy, ThumbsUp, ThumbsDown, Regen | Copy, ThumbsUp, ThumbsDown, Regen | Same (good) |
| Opacity | Fade in on hover | No fade | Add opacity-0 group-hover:opacity-100 transition |

### 5. User Message Bubbles
| Aspect | ChatGPT | DocTalk Current | Action |
|--------|---------|-----------------|--------|
| Alignment | Right-aligned | Right-aligned | Same (good) |
| Background (light) | Light gray `~#f4f4f4` | Dark `bg-zinc-800` | **Change light mode to `bg-zinc-100`** |
| Background (dark) | Dark gray `~#2f2f2f` | `dark:bg-zinc-700` | Close enough, keep |
| Border radius | `rounded-3xl` (24px) | `rounded-2xl` (16px) | **Upgrade to `rounded-3xl`** |
| Max width | ~70-80% | max-w-[80%] | Same (good) |

### 6. AI Message Rendering
| Aspect | ChatGPT | DocTalk Current | Action |
|--------|---------|-----------------|--------|
| Background | None (transparent) | None | Same (good) |
| Typography | prose, clean spacing | prose-sm | **Upgrade from prose-sm to prose** for readability |
| Width | Full width of column | w-full | Same (good) |

### 7. Citation Cards (DocTalk-unique)
| Aspect | ChatGPT | DocTalk Current | Action |
|--------|---------|-----------------|--------|
| Presence | N/A | Full cards below AI message | **Keep but make more compact** |
| Layout | N/A | Vertical stack, full-width cards | Consider horizontal chips/pills for space |

### 8. Empty State / Suggested Questions
| Aspect | ChatGPT | DocTalk Current | Action |
|--------|---------|-----------------|--------|
| Layout | Centered greeting + model name | Centered text + button list | **Polish: add icon/greeting, keep questions** |
| Question style | Pill/chip suggestions | Full-width bordered buttons | **Change to pill-style chips** |

### 9. Settings / Custom Instructions
| Aspect | ChatGPT | DocTalk Current | Action |
|--------|---------|-----------------|--------|
| Location | Sidebar settings | Settings2 icon bar above chat | **Move into "+" menu in input bar** |

### 10. Demo Progress Bar
| Aspect | ChatGPT | DocTalk Current | Action |
|--------|---------|-----------------|--------|
| Presence | N/A | Progress bar + text above input | **Keep but style more subtly** |

---

## Implementation Plan

### Phase 1: Input Bar Redesign (`ChatPanel.tsx`)
**Priority: HIGH — Most visible difference**

Changes:
1. Add "+" button on the left side of the input container
2. Create a popover/dropdown menu for "+" that contains:
   - Custom Instructions (Settings2 icon) — moved from page-level bar
   - Export Conversation (Download icon) — moved from inline
   - New Session (Plus icon) — optional
3. Update placeholder text
4. Ensure input bar has same max-width as message area
5. Add small disclaimer text below the input bar
6. Keep Send button as circular dark button (already matches)

Files to modify:
- `frontend/src/components/Chat/ChatPanel.tsx` — input bar restructure
- `frontend/src/app/d/[documentId]/page.tsx` — remove Settings2 bar above chat, pass instructions handler to ChatPanel

### Phase 2: Scroll-to-Bottom Button (`ChatPanel.tsx`)
**Priority: HIGH — Key UX improvement**

Changes:
1. Track scroll position with ref and scroll event handler
2. Show floating button when `scrollTop + clientHeight < scrollHeight - threshold`
3. Button: centered horizontally, positioned above input bar
4. Icon: ChevronDown or ArrowDown in a circle
5. Click: smooth scroll to bottom

Files to modify:
- `frontend/src/components/Chat/ChatPanel.tsx` — add scroll tracking + floating button

### Phase 3: Message Area Centering (`ChatPanel.tsx`)
**Priority: MEDIUM — Layout polish**

Changes:
1. Wrap message list content in a `max-w-3xl mx-auto` container
2. Wrap input bar in matching `max-w-3xl mx-auto` container
3. This centers content when the panel is wide, stays full-width when narrow

Files to modify:
- `frontend/src/components/Chat/ChatPanel.tsx` — add centering wrappers

### Phase 4: Action Buttons Hover State (`MessageBubble.tsx`)
**Priority: MEDIUM — Interaction polish**

Changes:
1. For all assistant messages: wrap action buttons in `opacity-0 group-hover:opacity-100 transition-opacity`
2. Exception: always show buttons on the last assistant message (when not streaming)
3. This matches ChatGPT's "reveal on hover" pattern

Files to modify:
- `frontend/src/components/Chat/MessageBubble.tsx` — add hover visibility logic

### Phase 5: Typography, Spacing & User Bubble Fix (`MessageBubble.tsx`)
**Priority: MEDIUM — Readability improvement + visual alignment**

Changes:
1. Upgrade AI messages from `prose-sm` to `prose` for better readability
2. Increase message vertical spacing (my-3/my-4 → my-4/my-6)
3. **Fix user bubble light mode**: `bg-zinc-800` → `bg-zinc-100 dark:bg-zinc-700` (ChatGPT uses light gray in light mode!)
4. **Fix user text light mode**: `text-white` → `text-zinc-900 dark:text-white`
5. **Upgrade bubble radius**: `rounded-2xl` → `rounded-3xl` (ChatGPT uses ~24px)
6. **Increase textarea max-height**: 160px → `max-h-[40dvh]` (ChatGPT allows ~50dvh)
7. **Upgrade input bar radius**: `rounded-2xl` → `rounded-3xl`

Files to modify:
- `frontend/src/components/Chat/MessageBubble.tsx` — prose size, spacing

### Phase 6: Citation Cards Compact Mode (`CitationCard.tsx`)
**Priority: LOW — Polish**

Changes:
1. Make citation cards more compact — horizontal pill/chip layout
2. Reduce from full-width card to inline-flex pill: `[1] "snippet..." p.5`
3. Wrap in a horizontal scrollable row or flex-wrap container

Files to modify:
- `frontend/src/components/Chat/CitationCard.tsx` — compact pill variant
- `frontend/src/components/Chat/ChatPanel.tsx` — citation container layout

### Phase 7: Empty State Polish (`ChatPanel.tsx`)
**Priority: LOW — Visual polish**

Changes:
1. Add document icon or greeting above suggested questions
2. Style suggested questions as rounded pill chips instead of full-width buttons
3. Arrange in a flex-wrap grid instead of vertical stack

Files to modify:
- `frontend/src/components/Chat/ChatPanel.tsx` — empty state redesign

### Phase 8: Disclaimer Footer (`ChatPanel.tsx`)
**Priority: LOW — Trust signal**

Changes:
1. Add small muted text below input bar
2. Text: i18n key for "AI responses may be inaccurate. Verify with original document."

Files to modify:
- `frontend/src/components/Chat/ChatPanel.tsx` — add disclaimer
- `frontend/src/i18n/*.json` — add i18n key

---

## Files Impact Summary

| File | Changes | Risk |
|------|---------|------|
| `ChatPanel.tsx` | Input bar, scroll button, centering, empty state, disclaimer, citations layout | HIGH (core component) |
| `MessageBubble.tsx` | Hover actions, typography, spacing | MEDIUM |
| `CitationCard.tsx` | Compact pill variant | LOW |
| `d/[documentId]/page.tsx` | Remove Settings2 bar, pass instructions props to ChatPanel | LOW |
| `collections/[id]/page.tsx` | Same ChatPanel changes apply automatically | NONE (uses same component) |
| `i18n/*.json` (11 files) | Add disclaimer text, update placeholder | LOW |
| `lib/sse.ts` | Add AbortSignal support for stop generation | LOW |
| `store/index.ts` | No changes needed | NONE |
| `types/index.ts` | No changes needed | NONE |

## Functionality Preservation Checklist
- [ ] Citation click → PDF highlight navigation
- [ ] Citation hover tooltips
- [ ] Citation cards display
- [ ] Message streaming with cursor animation
- [ ] 3-dot searching indicator
- [ ] Demo mode 5-message limit + progress bar
- [ ] Error handling (402, 409, 429)
- [ ] Message regeneration
- [ ] Conversation export
- [ ] Copy/feedback buttons
- [ ] Session dropdown in header
- [ ] Model selector in header
- [ ] Custom instructions modal
- [ ] PaywallModal integration
- [ ] Keyboard shortcuts (Enter to send, Shift+Enter for newline)
- [ ] Auto-resize textarea
- [ ] Suggested questions click-to-send

### Phase 9: Stop Generation Button (`ChatPanel.tsx`, `sse.ts`)
**Priority: HIGH — Key missing interaction**

Changes:
1. Add AbortController support to `chatStream()` in `sse.ts`
   - Accept optional `signal: AbortSignal` parameter
   - Pass signal to `fetch()` call
   - Handle abort error gracefully (not as error message)
2. In ChatPanel, store AbortController ref
3. When streaming, replace Send button with Stop button (Square icon)
4. Stop button click: abort controller → reader closes → streaming stops → show partial response
5. Clear abort controller on stream completion

Files to modify:
- `frontend/src/lib/sse.ts` — add AbortSignal parameter
- `frontend/src/components/Chat/ChatPanel.tsx` — stop button, abort controller ref

---

## Design Tokens (Matching DocTalk's zinc palette)
- Input bar border: `border-zinc-200 dark:border-zinc-700`
- "+" button: `text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200`
- Scroll button: `bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-md`
- Disclaimer: `text-xs text-zinc-400 dark:text-zinc-500`
- Focus ring: `focus-within:ring-2 focus-within:ring-zinc-400`
