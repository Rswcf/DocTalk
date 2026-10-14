# Blog related-post payload (2026-10-14)

`BlogPostClient` is a client component, so its props are serialised into the page's RSC payload.
`/blog/[slug]/page.tsx` passed `relatedPosts` = up to three full `BlogPost` objects, `content`
included. Every post's HTML therefore carried the whole markdown of three other posts (live
`/blog/chatpdf-alternatives-2026` was 148,578 bytes on 2026-10-14 and held text from
`notebooklm-alternatives-2026.md`). React outlined each of those markdown strings as its own
text row in the payload.

## Change

- `frontend/src/lib/blog.ts`: `RelatedPostSummary = Pick<BlogPost, 'slug' | 'title' | 'description'>`
  and `getRelatedPosts(post, limit = 3)`. Same selection as before (same category, not itself,
  first 3 in `getAllPosts()` date order), then only the three fields `RelatedPosts` renders.
- `frontend/src/app/blog/[slug]/page.tsx`: `const related = getRelatedPosts(post);`
- `frontend/src/app/blog/[slug]/BlogPostClient.tsx`: `relatedPosts` and `RelatedPosts` are typed
  `RelatedPostSummary[]` (type-only import; no JSX change).
- `frontend/tests/blog-related-posts-payload.test.cjs`: 3 tests. The third renders the real page
  with `BlogPostClient` stubbed and the real schema helpers, and asserts exactly one client with
  exactly the props `post` and `relatedPosts`, the summaries equal to `getRelatedPosts(post)`.
  Commits: a97c89fe (change), 153f0a5d (Codex r1 NIT), 60ca257d (Codex r2 NITs).

No blog post content changed. Frontend only; no version bump.

## Evidence

Local `npm run build` then `next start`, curl of all 20 posts, `/blog` and the 5 category pages.
Before = 2f2a9eaf, after = a97c89fe (the later commits change only the test). The local baseline
(145,723 bytes for chatpdf-alternatives-2026) is lower than live (148,578) because of
environment-specific markup; read the change, not the absolute.

| Post | Before (bytes) | After (bytes) | Change |
|---|---:|---:|---:|
| `ai-contract-review-guide` | 130,058 | 83,783 | -35.6% |
| `ai-document-analysis-languages` | 160,071 | 105,935 | -33.8% |
| `ai-document-security-privacy` | 148,790 | 98,176 | -34.0% |
| `ai-due-diligence-guide` | 135,307 | 90,217 | -33.3% |
| `ai-financial-report-analysis` | 128,405 | 80,708 | -37.1% |
| `ai-hr-contract-review` | 134,393 | 88,761 | -34.0% |
| `ai-pdf-readers-page-number-citations-2026` | 143,263 | 93,647 | -34.6% |
| `ai-research-paper-summarizer` | 133,318 | 87,686 | -34.2% |
| `best-ai-pdf-tools-2026` | 154,655 | 101,600 | -34.3% |
| `best-ai-tools-academic-research-2026` | 156,192 | 113,830 | -27.1% |
| `chat-with-excel-spreadsheet-ai` | 147,192 | 109,364 | -25.7% |
| `chat-with-powerpoint-ai` | 141,905 | 102,904 | -27.5% |
| `chatpdf-alternatives-2026` | 145,723 | 96,528 | -33.8% |
| `citation-highlighting-matters` | 153,751 | 100,858 | -34.4% |
| `free-ai-pdf-chat-no-signup` | 122,296 | 77,668 | -36.5% |
| `how-to-chat-with-docx-ai` | 130,019 | 85,391 | -34.3% |
| `how-to-chat-with-pdf-ai` | 132,839 | 88,211 | -33.6% |
| `how-to-chat-with-url-webpage-ai` | 141,380 | 102,311 | -27.6% |
| `notebooklm-alternatives-2026` | 139,999 | 86,944 | -37.9% |
| `rag-explained-simple` | 141,674 | 88,913 | -37.2% |
| **All 20 posts** | **2,821,230** | **1,883,435** | **-33.2%** |

- Markup with every `<script>` and `<link>` removed: identical on all 26 pages.
- JSON-LD scripts: identical on all 26 pages.
- Asset URLs: unchanged, except the `app/blog/[slug]/page-<hash>.js` chunk on post pages.
- `/blog` and the category pages: exactly one token differs, the build ID.
- RSC payload, compared with every row reference resolved (row IDs shift by 3 because the three
  outlined markdown rows are gone): before and after trees are equal on all 20 posts once each
  old related item is reduced to `{slug, title, description}`; without that reduction they differ.
- The leak is gone: "NotebookLM is now called" (body text of `notebooklm-alternatives-2026.md`)
  appears once in the before HTML of `chatpdf-alternatives-2026` and zero times after.
- Browser (`next start` at 127.0.0.1; `localhost` fails here because the production headers send
  HSTS and `upgrade-insecure-requests`): the page hydrates, 3 related cards with the same hrefs and
  titles, no hydration or React errors, client navigation to a related post works. The only
  console errors are Auth.js session 500s from the local server's missing auth config.
- Mutations, each run against the final test and each failing it on an `AssertionError`:
  `Object.assign` of full posts onto the summaries; the old full-post selection; a second
  `BlogPostClient` with full posts; an extra prop holding full posts; the `Object.assign`
  mutation gated on `faq.length` and on `ranked.length`.
- `npm run test:unit` 366/366, `npm run lint` clean, `npm run build` passes.

## Review

Codex 0.154.0, model `gpt-6-astra`. `gpt-5.5` (the model CLAUDE.md names) and `gpt-5.4` /
`gpt-6.1-sol` were rejected for the ChatGPT account from about 17:56 local time on 2026-10-14;
`codex debug models` now lists `gpt-6-astra`, `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`.

- r1: **SHIP**. NIT applied (153f0a5d): the wiring test matched source spelling, so an in-memory
  `Object.assign` passed it. SHOULD, out of scope: `/blog` (`BlogIndexClient`) and the category
  pages (`CategoryClient`) also pass full `BlogPost[]` to client components; neither reads
  `content`. `/blog` was 352,256 bytes locally.
- r2: **SHIP**. Two NITs applied (60ca257d): check every client element and its exact prop
  names; use the real schema helpers so the FAQ and ranked-list branches run. Not re-reviewed by
  Codex; the six mutations above are the evidence.
