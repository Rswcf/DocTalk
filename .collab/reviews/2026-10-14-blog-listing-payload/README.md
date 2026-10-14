# Blog listing payload (2026-10-14)

`BlogIndexClient` and `CategoryClient` are client components, so their `posts` prop is serialised
into the page's RSC payload. `/blog/page.tsx` passed all 20 full `BlogPost` objects (`content` =
the whole markdown) and `/blog/category/[category]/page.tsx` passed each category's full posts.
React outlined each markdown string as its own text row, so `/blog` was 352,256 bytes of HTML
locally. Codex r1 of the related-post fix (`../2026-10-14-blog-related-payload/`) reported this as
out of scope there; this change applies the same method.

This branch is cut from `claude/eloquent-payne-169b39` (e79f761f), which is not on main yet, so
`RelatedPostSummary` exists.

## Change

- `frontend/src/lib/blog.ts`:
  - `BlogPostSummary = Pick<BlogPost, 'slug' | 'title' | 'description' | 'category' | 'date' | 'readingMinutes'>`
    and `getPostSummaries()` (all posts, `getAllPosts()` order).
  - `CategoryPostSummary = Omit<BlogPostSummary, 'category'>` and
    `getCategoryPostSummaries(category)` (`getPostsByCategory()` order). The category cards show
    the page's own label, so the post's category is not sent.
  - `getAllPosts()` and `getPostsByCategory()` are unchanged (the sitemap and the post page use
    `getAllPosts()`).
- `frontend/src/app/blog/page.tsx`: `const posts = getPostSummaries();`
- `frontend/src/app/blog/category/[category]/page.tsx`: `const posts = getCategoryPostSummaries(params.category);`
- `BlogIndexClient.tsx`, `CategoryClient.tsx`: `posts` typed with the summary types (type-only
  import; no JSX change).
- `frontend/tests/blog-listing-payload.test.cjs`: 2 tests. Each renders the real server page with
  its client component stubbed and asserts exactly one client, its exact prop names, `posts` equal
  to an expectation the test computes from `getAllPosts()` itself, and the exact keys of every
  item. The category test covers all 5 known categories and an unknown one (`notFound`).

Fields read, verified in the source: `BlogIndexClient` reads `slug`, `title`, `description`,
`category` (card label and the category chips), `date`, `readingMinutes`. `CategoryClient` reads
the same minus `category`. Neither reads `content`. Both files keep clear of the substring
`readingTime`, which `scripts/check-public-i18n.js` bans there.

No blog post content changed. Frontend only; no version bump.

## Evidence

Local `npm run build`, then `next start -p 3117 -H 127.0.0.1`, curl of `/blog`, the 5 category
pages and all 20 posts. Before = e79f761f, after = d670015f.

| Page | Before (bytes) | After (bytes) | Change |
|---|---:|---:|---:|
| `/blog` | 352,256 | 50,622 | -85.6% |
| `/blog/category/ai-insights` (4 posts) | 104,693 | 34,739 | -66.8% |
| `/blog/category/comparisons` (5 posts) | 115,776 | 36,076 | -68.8% |
| `/blog/category/guides` (6 posts) | 112,228 | 36,467 | -67.5% |
| `/blog/category/use-cases` (5 posts) | 112,477 | 35,696 | -68.3% |
| `/blog/category/product` (0 posts, empty state) | 30,468 | 30,468 | 0.0% |
| **6 listing pages** | **827,898** | **224,068** | **-72.9%** |
| 20 post pages (controls) | 1,883,435 | 1,883,435 | 0.0% |

- Body markup (everything after `</head>`, with every `<script>` and `<link>` removed): identical
  on all 26 pages.
- JSON-LD scripts: identical on all 26 pages.
- Controls: all 20 post pages and the empty product category are identical as whole files once
  the build ID (and, for product, the page chunk name) is normalised.
- `<head>` of `/blog`: the same 23 `<meta>`/`<title>` elements. Four root-layout tags
  (`google-site-verification`, `msvalidate.01`, `theme-color` ×2, written literally in
  `app/layout.tsx`'s `<head>`) moved from after the metadata to before `<title>`. Before the
  change `/blog` was the only one of the 26 pages with them after the metadata; after it, all 26
  have the same order. A second, independent build of e79f761f reproduced all 26 before pages
  byte-for-byte apart from the build ID, including that order, so the reorder is deterministic
  and follows from the change. The mechanism is not proven; the likely cause is the smaller RSC
  stream changing when the metadata resolves during prerendering.
- Asset URLs: unchanged, except the two page chunks (`app/blog/page-*.js`,
  `app/blog/category/[category]/page-*.js`). Their contents: the index chunk differs only in the
  Sentry debug ID; the category chunk differs in the debug ID and a consistent swap of two mangled
  locals inside `CategoryClient` (`tOr` x→b, `relatedLinks` b→x; the remaining `x` tokens are in
  class strings such as `gap-x-4`). The rebuilt before state reproduced the original chunk hashes
  exactly, and the final after build reproduced the after hashes.
- RSC payload, compared with every row reference resolved: `/blog` 48 → 28 rows (the 20
  outlined markdown rows are gone); category pages lose 4–6 such rows. On all 6 listing pages
  the trees are equal once each old `posts` item is reduced to the projected fields; without that
  reduction they differ. After the change every `posts` item has exactly the projected keys and
  no outlined references. Post pages: trees equal with no reduction.
- The leak is gone: "NotebookLM is now called" (body text of `notebooklm-alternatives-2026.md`)
  appears 3 times in the before HTML of `/blog` and of `/blog/category/comparisons`, 0 times
  after. The `readingTime` field appears 20 times in before `/blog`, 0 after.
- Browser (built-in browser, `next start` at 127.0.0.1; `localhost` fails here because the
  production headers send HSTS and `upgrade-insecure-requests`): `/blog` hydrates with 20 cards
  and the chips All / Comparisons / Use Cases / AI Insights / Guides; clicking Guides navigates
  client-side to the category page (6 cards, active chip). A hard load of
  `/blog/category/comparisons` hydrates, and a card click navigates client-side to the post (a
  window marker survived). `/blog/category/product` shows the empty state. The only console
  errors are Auth.js session 500s from the local server's missing auth config; no hydration or
  React errors.
- The guard test fails on the old pages (both tests, `AssertionError`). Mutations, each run
  against the final test (0cb260c0) and each failing it on an `AssertionError` (five more are
  listed under Review): `Object.assign` of full posts
  onto the summaries (index; category); the old `getAllPosts()` / `getPostsByCategory()`; a second
  client with full posts (index; category); an extra prop with full posts (index; category); the
  index projection adds `content`; the index projection drops `readingMinutes`; the category page
  uses the index summaries filtered by category; the category projection adds `category` back.
- `npm run test:unit` 368/368, `npm run lint` clean (including both i18n checks), `npm run build`
  passes.

Commits: d670015f (change), b5c0bf5c (Codex r1 NIT), 0cb260c0 (Codex r2 NITs). The later two
change only the test, so the page measurements above (taken at d670015f) still describe the
branch tip.

## Review

Codex 0.154.0, model `gpt-6-astra` (top of `codex debug models`; `gpt-5.5` is rejected for the
ChatGPT account since 2026-10-14).

- r1: **SHIP**, no BLOCKER or SHOULD. Codex confirmed independently: both clients read only the
  projected fields; ordering, keys, links and prefetch are unchanged; `import type` keeps
  `lib/blog.ts` out of the client bundle; 26/26 saved captures have the same head elements,
  JSON-LD and body markup. On the `<head>` reorder: Google and Bing require the verification
  token in the head and document no position relative to `<title>`; the two `theme-color` tags
  keep their relative order, values and media queries; Next's renderer queues titles and
  metadata in one hoistable queue, so a timing change in RSC decoding is a credible cause (not
  proven). Two NITs:
  1. The guard test walked only `props.children`; a client in a `Suspense` `fallback` with full
     posts passed it. Fixed in b5c0bf5c: the test walks every prop. Both `Suspense` mutations pass
     the d670015f test and fail the b5c0bf5c test.
  2. Out of scope, pre-existing: the post page passes its primary post in full, and
     `BlogPostClient` never reads `image`, `imageAlt`, `keywords` or `readingTime` (about 303–410
     JSON bytes per post). Left for a separate change.
- r2 (on b5c0bf5c): **SHIP**. Three NITs on the walker, all fixed in 0cb260c0 and not re-reviewed
  by Codex: it skipped `Set`/`Map` children; its global `seen` set counted one element rendered
  twice as one client; it matched any object with the client's `type`. Evidence: a `Set`-wrapped
  fallback (index), a `Map`-wrapped fallback (category) and one element rendered twice each pass
  the b5c0bf5c test and fail the 0cb260c0 test on an `AssertionError`; a non-element
  `{ type: BlogIndexClient }` object fails the b5c0bf5c test and passes the 0cb260c0 test. The 14
  earlier mutations still fail the final test on an `AssertionError`. `npm run test:unit`
  368/368, `npm run lint` clean.
