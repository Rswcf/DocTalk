No BLOCKER or required fix for this change.

1. **NIT — The boundary test checks source spelling, not the final props.**  
   [blog-related-posts-payload.test.cjs:67](/Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/eloquent-payne-169b39/frontend/tests/blog-related-posts-payload.test.cjs:67)

   The tests correctly reject removing the projection, restoring the old selection, or passing `getAllPosts()` directly. However, this in-memory mutation passed all three tests and TypeScript while restoring full markdown to the final props:

   ```ts
   related.forEach(summary =>
     Object.assign(summary, getPostBySlug(summary.slug))
   );
   ```

   The exact regexes also reject harmless formatting or variable renaming. **Fix:** replace the source-wiring assertions with a test that invokes the page using a stubbed client component and asserts the keys and values of its actual `relatedPosts` prop. This is optional hardening; the current wiring is correct.

2. **SHOULD — Existing excess payload on blog index and category pages; outside this change.**  
   [blog/page.tsx:58](/Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/eloquent-payne-169b39/frontend/src/app/blog/page.tsx:58) and [category/[category]/page.tsx:81](/Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/eloquent-payne-169b39/frontend/src/app/blog/category/[category]/page.tsx:81)

   Both pass full `BlogPost[]` across client boundaries. `BlogIndexClient` uses only `slug`, `title`, `description`, `category`, `date`, and `readingMinutes`. `CategoryClient` uses the same fields except `category`. Neither reads `content`.

   **Fix in a separate change:** project the required listing fields at these server boundaries and narrow their prop types. Keep `getAllPosts()` unchanged.

The requested correctness checks passed:

- `RelatedPosts` reads only the three retained fields. No related-object spread, enumeration, identity comparison, or other consumer exists. Keys, link destinations, and prefetch configuration remain unchanged.
- Selection preserves the original filter, date ordering—including ties—and default limit. Filesystem reads, parsing, and sorting remain unchanged; the only added work constructs at most three summary objects.
- Static markup matched for all 20 posts plus four edge cases covering 0–3 cards and empty titles/descriptions. Additional selection checks covered empty datasets, self-only results, and unmatched categories.
- Client transpilation removes the `lib/blog` import entirely. `import type` introduces no runtime dependency on `fs` or `gray-matter`. [TypeScript documentation](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-8.html#type-only-imports-and-export)
- `loadBlog()` restores cwd synchronously in `finally`; the captured absolute `BLOG_DIR` remains valid. Default `node --test` execution isolates files in separate processes, so parallel files do not share cwd changes. [Node documentation](https://nodejs.org/docs/latest-v24.x/api/test.html#test-runner-execution-model)
- Sitemap and other consumers remain unaffected. No additional SSR/SSG or project-rule regression found.

Independent verification: **366/366 tests passed**, TypeScript passed, and actual page props contained only summary fields. Build, browser hydration, and full before/after comparisons remain Claude-provided evidence. No git commands or source edits were made.

SHIP