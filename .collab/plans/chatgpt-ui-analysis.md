# ChatGPT Chat UI Design Analysis (2026)

> Research document for guiding DocTalk's chat interface redesign.
> Based on screenshot analysis, web research, OpenAI developer documentation, and community reverse-engineering.

---

## 1. Overall Layout & Structure

### Content Column
- **Centered single column** for the conversation area
- Max-width uses responsive Tailwind classes:
  - `md:max-w-3xl` (~768px)
  - `lg:max-w-[40rem]` (640px)
  - `xl:max-w-[48rem]` (768px)
- Messages flow vertically in a scrollable container
- No visible grid or card structure around individual messages
- The conversation occupies the full viewport height minus header and input bar

### Sidebar
- **Collapsible left sidebar** with conversation history
- Default width ~260px (customizable via scripts to ~330px)
- Can be toggled with `Ctrl+Shift+S`
- On mobile: collapses into a hamburger menu
- The main chat area expands to fill available space when sidebar is hidden

### Vertical Spacing
- Clean separation between messages (estimated ~16-24px gap between message groups)
- User and AI messages have distinct visual treatment but share the same column alignment
- No horizontal dividers between messages

---

## 2. Typography

### Font Family
- **Primary**: `Sohne` (a contemporary sans-serif by Klim Type Foundry)
  - Licensed at ~$40,000; chosen for humanist character width variation
  - Fallback stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- **Monospace** (code blocks): `Sohne Mono`, with fallbacks to `Consolas, ui-monospace, SFMono-Regular, SF Mono, Menlo`
- **Mobile**: Inherits platform-native system fonts (SF Pro on iOS, Roboto on Android)
- **Input area**: May use `Victor Mono` or the same Sohne stack

### Font Sizes (estimated from inspection)
- **Body text (AI messages)**: ~16px (1rem)
- **User message text**: ~16px (1rem)
- **Code block text**: ~14px (0.875rem)
- **Footer disclaimer**: ~12px (0.75rem), muted gray color
- **Headings in AI responses**: Standard markdown heading hierarchy (h1 through h6)

### Line Height
- **Optimized at ~1.65** for body text (reduces cognitive load)
- Comfortable reading spacing throughout

---

## 3. Message Styling

### User Messages
- **Alignment**: Right-aligned within the content column
- **Background**: Dark rounded bubble
  - Light mode: Soft gray (`~#f4f4f4` or similar light gray)
  - Dark mode: Dark gray (`~#2f2f2f` to `#3a3a3a` range)
  - With accent color feature (2025+): Users can customize via hex color input
- **Text color**: Contrasting (dark text on light bubble, white text on dark bubble)
- **Border-radius**: Large rounded corners (~`rounded-3xl` / `24px`)
- **Padding**: ~12px 16px (comfortable but compact)
- **Max-width constraint**: Does not span the full column width; constrained to ~70-80% of content area
- **No avatar/icon** displayed next to user messages
- **No timestamp** visible by default

### AI/Assistant Messages
- **Alignment**: Left-aligned within the content column
- **NO bubble/border/background** -- plain text rendered directly
- **Full-width**: Text spans the entire content column width (no max-width constraint like user messages)
- **Rich markdown rendering**: Headers, bold, italic, bullet lists, numbered lists, tables, inline code, code blocks, images inline
- **No avatar** inline with text (small OpenAI logo may appear at the top of the response)
- **Design rationale**: Removing the bubble makes AI responses feel like a document/article, reducing visual clutter and improving readability for long responses

### Message Grouping
- Messages from the same sender are visually grouped
- User message appears, then AI response follows without explicit separator
- The asymmetry (bubble vs. no-bubble) creates clear visual distinction without labels

---

## 4. Action Buttons on Messages

### AI Message Actions
- **Position**: Below the AI message, left-aligned
- **Visibility**: Appear on hover over the message area (not always visible)
  - Known issue: Hover-dependent visibility can interfere with audio playback
- **Buttons** (left to right):
  1. **Copy** (clipboard icon) -- copies the full response; shows checkmark on success
  2. **Thumbs Up** (feedback positive)
  3. **Thumbs Down** (feedback negative)
  4. **Regenerate** (refresh/retry icon) -- replaces previous reply with new generation
  5. **Read Aloud** (speaker icon, when available)
- **Styling**: Small icon buttons, no text labels, muted gray color
- **Size**: ~20-24px icons with ~8px spacing between them
- **Hover state**: Slightly darker/more opaque

### User Message Actions
- **Edit button**: Appears on hover, allows editing the user message and re-submitting

---

## 5. Input Composer Bar

### Container
- **Position**: Fixed at the bottom of the viewport, centered within content column
- **Border-radius**: `28px` (large pill shape)
- **Background**: Slightly elevated from page background (subtle contrast)
  - Light mode: White or very light gray with subtle border/shadow
  - Dark mode: Slightly lighter than page background (`~#2f2f2f` on `#212121` bg)
- **Overflow**: `clip` (via `bg-clip-padding` class) -- known to cause Chrome rendering issues
- **Shadow/Border**: Subtle shadow or 1px border for elevation

### Textarea
- **Auto-growing**: Expands height as user types multiple lines
- **Max-height**: ~50dvh (50% of viewport dynamic height), some customizations allow up to 65dvh
- **Placeholder text**: "Ask anything" (centered when empty)
- **Send behavior**: `Enter` to send, `Shift+Enter` for new line

### Buttons Within Input Bar
- **Left side**: `+` button (attachments, tools, file upload)
- **Right side**:
  - **Send button**: Appears when text is entered; circular (`rounded-full`), filled dark
  - **Microphone icon**: For voice input (visible when no text entered)
  - **Voice mode button**: Dark circular button with audio waveform icon
- **Layout**: Buttons are vertically centered within the input container

### Focus State
- Entire input bar container shows a focus ring/highlight when the textarea is focused (`focus-within` pattern)

---

## 6. Color Palette

### Light Mode
| Element | Color (approx.) |
|---------|-----------------|
| Page background | `#ffffff` |
| Sidebar background | `#f9f9f9` to `#f7f7f8` |
| User message bubble | `#f4f4f4` (light gray) |
| AI message text | `#1a1a1a` (near-black) |
| Input bar background | `#ffffff` with subtle border |
| Muted text / icons | `#6b6b6b` to `#8e8e8e` |
| Footer disclaimer | `#999` to `#aaa` |
| Code block background | `#f6f6f6` to `#f0f0f0` |

### Dark Mode
| Element | Color (approx.) |
|---------|-----------------|
| Page background | `#212121` to `#1a1a1a` |
| Sidebar background | `#171717` to `#1e1e1e` |
| User message bubble | `#2f2f2f` to `#3a3a3a` |
| AI message text | `#d1d1d1` to `#ececec` |
| Input bar background | `#2f2f2f` (slightly lighter than page) |
| Muted text / icons | `#8e8e8e` to `#999` |
| Code block background | `#1e1e1e` to `#181818` |
| Inline code background | `#272727` with text `#eab38a` |

### Accent Color System (2025+)
- Users can choose an accent color from a palette or enter a custom hex value
- Accent color applies to: conversation bubbles, Voice button, highlighted text
- Default accent appears to be a neutral dark gray (no color accent by default)
- Theme settings are per-device, per-platform (web vs. iOS vs. Android)

---

## 7. Code Blocks

### Container
- **Background**: Dark/charcoal in both light and dark modes (dark mode: `#181818`, light mode: `#1e1e1e` to `#2d2d2d`)
- **Border-radius**: Rounded corners (~8-12px)
- **Padding**: ~16px
- **Full-width**: Spans the entire content column
- **Overflow-x**: Horizontal scroll for long lines

### Header Bar
- **Language label**: Displayed in top-left of code block (e.g., "python", "javascript")
- **Copy button**: Top-right, with "Copy code" text or clipboard icon
  - Sticky positioning: Stays visible while scrolling through long code blocks
  - Shows checkmark after successful copy

### Syntax Highlighting
- Standard dark-theme syntax highlighting
- Monospace font (`Sohne Mono` / `Consolas` / system monospace)
- Font size slightly smaller than body text (~14px)

---

## 8. Scroll Behavior

### Auto-scroll
- During streaming: Automatically scrolls to keep latest content visible
- Auto-scroll stops if user manually scrolls up (respects user position)

### Scroll-to-Bottom Button
- **Appears**: When user has scrolled up from the bottom of the conversation
- **Position**: Floating button, centered horizontally, above the input bar
- **Icon**: Down arrow (chevron-down or arrow-down)
- **Shape**: Circular button with subtle shadow
- **Animation**: Smooth scroll on click (`behavior: 'smooth'`)
- Uses velocity-based spring animation for smooth, natural-feeling scroll

### Streaming Scroll
- New content smoothly pushes the viewport down
- Uses `scrollIntoView` or equivalent with smooth behavior
- Some implementations use spring-based animation for more natural feel

---

## 9. Streaming & Typing Animation

### AI Response Streaming
- Text appears token by token as it streams from the API
- **Blinking cursor**: A vertical bar cursor (`|`) blinks at the end of the streaming text
  - CSS animation: `border-right` with `@keyframes blinkCursor` toggling opacity at 0.5s intervals
  - Alternatively: `display: inline-block, width: 1ch` with flicker animation
- **No typing dots/bubbles**: ChatGPT does NOT show "..." thinking indicator before streaming starts (unlike older versions)

### Markdown Rendering During Streaming
- Renders markdown progressively as tokens arrive
- Code blocks are optimistically styled when opening backticks are detected
- Headers, bold, lists render as soon as the syntax is complete
- Avoids "flickering" of half-rendered markdown by operating at AST level

---

## 10. "Ask ChatGPT" Text Selection Feature

- **Trigger**: Selecting/highlighting text anywhere in the conversation
- **Appearance**: A floating tooltip/button appears near the selection
- **Icon**: Quotation marks icon (")
- **Label**: "Ask ChatGPT"
- **Behavior**: Clicking it opens a context to ask about or modify the selected text
- **Controversial**: Some users find it annoying as it "eats mouse focus" during selection
- Primarily used with Canvas feature for editing specific portions of text or code

---

## 11. Responsive Design

### Desktop (>1024px)
- Full sidebar + centered content column + input bar
- Content column has max-width constraints
- Sidebar pinnable for quick context switching

### Tablet (~768-1024px)
- Sidebar collapses by default
- Content column expands
- Touch targets increase in size

### Mobile (<768px)
- Sidebar becomes hamburger menu overlay
- Content column goes edge-to-edge with appropriate padding
- Input bar sits at bottom with adjusted padding
- Prominent microphone button for voice input
- Action buttons may be always visible (not hover-dependent) on touch devices
- System fonts (SF Pro / Roboto) instead of custom web fonts

---

## 12. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Send message |
| `Shift+Enter` | New line in input |
| `Ctrl/Cmd + Shift + O` | Open new chat |
| `Ctrl/Cmd + Shift + S` | Toggle sidebar |
| `Ctrl/Cmd + Shift + X` | Delete current chat |
| `Ctrl/Cmd + Shift + C` | Copy last response |
| `Ctrl/Cmd + Shift + ;` | Copy code block |
| `Shift + Esc` | Focus chat input |
| `Ctrl/Cmd + /` | Show all shortcuts |

---

## 13. Footer Disclaimer

- **Text**: "ChatGPT can make mistakes. Check important info."
- Followed by "See Cookie Preferences." link
- **Position**: Centered below the input bar
- **Styling**: Small font (~12px), muted gray color, minimal visual weight
- Acts as a subtle legal/safety reminder without disrupting the interface

---

## 14. Mode Selector (GPT-5 Era)

- Located near the top or within the input bar area
- Options: "Auto", "Fast", "Thinking" modes
- Dropdown or toggle interface
- Replaces the old model selector (GPT-4, GPT-3.5 dropdown)

---

## 15. Design Philosophy Summary

### Core Principles
1. **Minimal chrome**: Remove all unnecessary UI elements; let content breathe
2. **Asymmetric message design**: User bubbles vs. AI flat text creates clear attribution without labels
3. **Progressive disclosure**: Action buttons hidden until hover; features revealed contextually
4. **Content-first**: AI responses look like articles/documents, not chat messages
5. **System-level consistency**: Use platform fonts, system colors, and native interaction patterns
6. **Accessibility**: WCAG AA contrast, system font sizing, text resizing support

### What Makes ChatGPT's Chat UI Distinctive
- **No AI message bubbles** -- breaks the traditional chat UI convention; treats AI output as rich content, not a "message"
- **Centered single-column layout** -- focuses attention, reduces scanning
- **Large pill-shaped input bar** -- feels friendly and approachable
- **Minimal color usage** -- near-monochrome palette with optional accent color
- **Generous whitespace** -- comfortable reading density

---

## 16. Key Differences from DocTalk's Current Chat UI

| Aspect | ChatGPT | DocTalk (Current) |
|--------|---------|-------------------|
| AI message styling | No bubble, no border, flat text | No bubble/border (already aligned) |
| User message styling | Right-aligned dark bubble | Right-aligned dark bubble (aligned) |
| AI message width | Full content column width | Full width (already aligned) |
| Action buttons | Below message, on hover | Below message (aligned) |
| Input bar shape | Pill (`border-radius: 28px`) | Rounded container (aligned) |
| Content column width | Centered, max `48rem` | Resizable panel (different -- has PDF viewer) |
| Scroll-to-bottom | Floating circular button | May need implementation |
| Code block header | Language label + sticky copy | Standard code blocks |
| Streaming cursor | Blinking `|` bar | 3-dot bounce + blinking cursor |
| Footer disclaimer | "Can make mistakes" below input | Not present |
| Text selection action | "Ask ChatGPT" floating button | Not applicable (different product) |
| Font | Sohne (custom) | Inter (Google Font) |

---

## 17. Recommendations for DocTalk

Based on this analysis, the following ChatGPT patterns are most relevant to DocTalk's context (split-panel document reader + chat):

1. **Already aligned**: AI messages without bubbles, user messages with dark bubbles, action buttons below messages
2. **Consider adopting**:
   - Scroll-to-bottom floating button (if not already implemented)
   - Improved streaming cursor (blinking bar vs. bouncing dots)
   - Code block with language label header + sticky copy button
   - Footer disclaimer about AI accuracy
3. **Context-dependent** (DocTalk has PDF viewer, ChatGPT does not):
   - Content column max-width doesn't directly apply since DocTalk uses resizable panels
   - "Ask ChatGPT" text selection feature doesn't apply
   - Sidebar toggle doesn't apply (DocTalk sidebar is the document viewer)

---

*Research completed: 2026-02-09*
*Sources: OpenAI developer documentation, community reverse-engineering, UI comparison articles, ChatGPT interface inspection*
