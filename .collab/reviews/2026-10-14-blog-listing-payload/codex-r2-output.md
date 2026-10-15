No blocking regression. The direct Suspense-fallback hole is fixed. Three nonblocking limitations remain:

1. **NIT — Iterable containers remain invisible.** [blog-listing-payload.test.cjs:63](/Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/cranky-tereshkova-39eb76/frontend/tests/blog-listing-payload.test.cjs:63)  
   `Object.values()` does not traverse `Set` or `Map` entries. In-memory mutations wrapping the full-post fallback in `new Set([<Client … />])` still pass **2/2**. Installed React accepts Set children. The comment correctly excludes other client types, but “every instance” remains too broad. **Fix:** traverse supported iterable containers, or explicitly limit the comment to arrays and enumerable object properties.

2. **NIT — `seen` counts distinct objects, not occurrences.** [blog-listing-payload.test.cjs:59](/Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/cranky-tereshkova-39eb76/frontend/tests/blog-listing-payload.test.cjs:59)  
   Returning the same client element twice passes **2/2**; a React rendering probe invokes that component twice. This weakens “exactly one,” but cannot hide different payloads on the same immutable element: its props are still checked once. **Fix:** use an ancestor-path cycle guard if counting occurrences, or rename the assertion to “one distinct client element.”

3. **NIT — Matching `type` alone accepts non-elements.** [blog-listing-payload.test.cjs:62](/Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/cranky-tereshkova-39eb76/frontend/tests/blog-listing-payload.test.cjs:62)  
   A plain `{ type: Stub }` is counted as a client. Current post arrays, style objects, and `dangerouslySetInnerHTML` values do not trigger this; ordinary objects and cycles traverse without crashing. **Fix:** require `React.isValidElement(node)` before matching `node.type`, and use that same check when selecting element props.

Verified baseline **2/2 pass** and direct full-post fallback mutations **2/2 fail with AssertionError**. No files changed or git commands run.

SHIP