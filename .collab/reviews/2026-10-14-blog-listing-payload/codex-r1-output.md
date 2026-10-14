No BLOCKER or SHOULD findings. Two non-blocking findings:

1. **NIT — The guard overstates its coverage.** [frontend/tests/blog-listing-payload.test.cjs:56](/Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/cranky-tereshkova-39eb76/frontend/tests/blog-listing-payload.test.cjs:56)

   `findElements()` traverses arrays and `props.children` only. I mutated both pages **in memory** to wrap the valid client in `Suspense`, with another client receiving full posts in `fallback`. Both tests still passed.

   Fragment arrays under `children` are covered. Non-children element props are not. A different client context provider receiving full posts would also escape these assertions.

   **Fix:** Narrow the “any way” comment at line 64. Optionally traverse element-valued props and add the fallback mutation. A built-RSC regression check is needed for a guarantee covering arbitrary client providers. This gap does not invalidate the current implementation.

2. **NIT — Existing post pages still serialize four unused fields.** [frontend/src/app/blog/[slug]/page.tsx:137](/Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/cranky-tereshkova-39eb76/frontend/src/app/blog/[slug]/page.tsx:137)

   `BlogPostClient` receives the full primary post but never reads `image`, `imageAlt`, `keywords`, or `readingTime`. Those fields total approximately **303–410 JSON bytes per post** in the current content.

   **Fix:** In a separate change, project the primary post’s consumed fields. Keep `content`: the client actually uses it for Markdown and headings. This is pre-existing, small overhead; no other comparable unused large payload was confirmed in the inspected app boundaries.

The listing projections are complete. `PostCard` reads exactly the six index fields; the chips additionally use the retained `category`. Category cards read exactly their five projected fields. `PostCard` receives the summary object directly, but neither client spreads, enumerates, stringifies, or forwards posts into the marketing wrappers. The formatting helpers receive scalar values.

Ordering, keys, links, and prefetch inputs remain unchanged. Defaults still run inside `getPostBySlug()` before projection. Empty lists remain empty. Unknown categories remain index chips and retain the existing category-page rejection behavior. Duplicate slugs would retain the same duplicate-key behavior, although the current filename-derived loader cannot produce them normally. Date values—including frontmatter dates parsed as `Date` objects—are preserved without conversion.

The `<head>` reorder is safe on the evidence available. I independently compared the saved captures: **26/26 have identical head tag/title multisets, JSON-LD, and body markup after script/link removal**. Only `/blog` changes head ordering. Google and Bing require the correct verification token in the head; neither documents a position relative to `<title>`. [Google verification requirements](https://support.google.com/webmasters/answer/9008080?hl=en), [Microsoft verification instructions](https://learn.microsoft.com/en-us/bingwebmaster/verifying-wordpress). Theme-color selection considers matching theme-color elements in document order; their relative order, values, and media queries remain unchanged. [HTML standard](https://html.spec.whatwg.org/multipage/semantics.html#meta-theme-color).

The installed Next renderer places ordinary metadata and titles into a shared `hoistableChunks` queue. Changed RSC decoding/suspension timing affecting enqueue order is therefore a credible explanation. **The precise causal sequence remains unproven.** There is no evidence that metadata values or SEO directives changed.

The two getters and `Pick`/`Omit` types are proportionate. They create explicit runtime projections while preserving the full-post API. `getAllPosts()`, sitemap consumers, and post-page consumers remain unaffected. Both client `import type` statements disappear during transpilation, so these imports do not pull `fs` or `gray-matter` into client bundles.

Independent expected summaries are the right test design. They avoid sharing the getters’ projection mistakes. The synchronous `chdir`/`finally` block restores cwd, and the current Node test runner isolates test files; I found no current parallelism issue.

Verification: **368/368 unit tests passed**, TypeScript passed, scoped ESLint passed, and both i18n checks passed. Existing build artifacts match all six reported listing sizes. I inspected the successful build log; I did not rebuild or repeat browser testing. No git commands or repository edits.

SHIP