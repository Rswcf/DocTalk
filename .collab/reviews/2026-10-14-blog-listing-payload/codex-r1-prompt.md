# Codex adversarial review — blog listing RSC payload (DocTalk)

Do NOT run git. Repo root = cwd. The diff under review is at the end of this prompt (base e79f761f = tip of branch claude/eloquent-payne-169b39, which fixed the same bug on blog post pages and is not on main yet; head d670015f). Read the changed files in full plus:
- frontend/src/app/blog/BlogIndexClient.tsx and frontend/src/app/blog/category/[category]/CategoryClient.tsx (whole files)
- frontend/src/app/blog/page.tsx and frontend/src/app/blog/category/[category]/page.tsx (whole files)
- frontend/src/lib/blog.ts (whole file), frontend/src/lib/publicI18n.ts (formatDateForLocale, getBlogCategoryLabel)
- frontend/src/app/sitemap.ts and frontend/src/app/blog/[slug]/page.tsx (other getAllPosts / getPostsByCategory consumers; must be unaffected)
- frontend/tests/blog-listing-payload.test.cjs (new) and frontend/tests/blog-related-posts-payload.test.cjs (the pattern it copies)
- frontend/scripts/check-public-i18n.js (bans the substring `readingTime` in both client files)

Purpose: `BlogIndexClient` and `CategoryClient` are client components, so their `posts` prop is serialised into the page's RSC payload. `/blog` passed all 20 full `BlogPost` objects (`content` = whole markdown) and each category page its own posts. The change passes only the fields each card renders: index = slug, title, description, category, date, readingMinutes (category is also used for the category chips); category page = the same minus category (its cards show the page's own label). Requirement: rendered output unchanged; no blog post content edited; `getAllPosts()` unchanged.

Evidence already gathered by Claude (local `npm run build && next start -p 3117 -H 127.0.0.1`, curl of /blog, the 5 category pages and all 20 posts; before = e79f761f, after = d670015f):

| Page | Before (bytes) | After (bytes) | Change |
|---|---:|---:|---:|
| /blog | 352,256 | 50,622 | -85.6% |
| /blog/category/ai-insights (4 posts) | 104,693 | 34,739 | -66.8% |
| /blog/category/comparisons (5) | 115,776 | 36,076 | -68.8% |
| /blog/category/guides (6) | 112,228 | 36,467 | -67.5% |
| /blog/category/use-cases (5) | 112,477 | 35,696 | -68.3% |
| /blog/category/product (0 posts, empty state) | 30,468 | 30,468 | 0 |
| 20 post pages (controls) | 1,883,435 | 1,883,435 | 0 |

- Body markup (everything after </head>, scripts and links removed) identical on all 26 pages.
- JSON-LD scripts identical on all 26 pages.
- All 20 post pages and the empty product category: whole HTML identical once the build ID (and, for product, the page chunk name) is normalised.
- <head> on /blog: same 23 meta/title elements, but the four root-layout meta tags (google-site-verification, msvalidate.01, theme-color x2, written literally in app/layout.tsx's <head>) moved from after the metadata to before <title>. Before the change /blog was the only one of 26 pages with them after the metadata; after it, all 26 have the same order. A second independent build of e79f761f reproduced every one of the 26 before pages byte-for-byte apart from the build ID, including that /blog head order, so the reorder is deterministic and caused by the change (plausibly the RSC stream size changing when the metadata row resolves during SSR; mechanism not proven).
- Asset URLs: unchanged except the two page chunks (app/blog/page-*.js, app/blog/category/[category]/page-*.js). Chunk contents compared: index chunk identical apart from the Sentry debug ID UUID; category chunk identical apart from the UUID and a consistent swap of two mangled locals inside CategoryClient (tOr x->b, relatedLinks b->x; the other x tokens are inside class strings like "gap-x-4"). The rebuilt before state reproduced the original chunk hashes exactly, and the final after build reproduced the after hashes.
- RSC payload, compared with every "$<id>" reference resolved: /blog rows 48 -> 28 (20 outlined T rows, the markdown, gone), categories lose 4-6 T rows. Trees are equal on all 6 listing pages once each old posts item is reduced to the projected fields; without that reduction they differ (sensitivity check). After the change every posts item has exactly the projected keys and no outlined references. Post pages: trees equal with no reduction.
- Leak probe: "NotebookLM is now called" (body text of notebooklm-alternatives-2026.md) appears 3 times in before /blog and before /blog/category/comparisons, 0 times after. The `readingTime` field: 20 -> 0 on /blog.
- Browser (built-in browser, next start at 127.0.0.1): /blog hydrates, 20 cards, chips All/Comparisons/Use Cases/AI Insights/Guides; clicking Guides client-navigates to the category page (6 cards, active chip); hard load of /blog/category/comparisons hydrates and a card click client-navigates to the post (window marker kept); /blog/category/product shows the empty state. Only console errors: Auth.js session 500s from the local server's missing auth config. No hydration or React errors.
- Guard test fails on the old pages (both tests, AssertionError). 12 mutations, each failing it on an AssertionError: Object.assign full posts onto the summaries (index, category); the old getAllPosts() / getPostsByCategory(); a second client with full posts (index, category); an extra prop with full posts (index, category); index projection adds content; index projection drops readingMinutes; category page uses index summaries filtered by category; category projection adds category back.
- npm run test:unit 368/368, npm run lint clean (incl. public i18n checks), npm run build passes.

Check, adversarially:
1. Completeness: does anything in either client (PostCard, the chip list, formatDateForLocale, getBlogCategoryLabel, MarketingShell/EdPageHero/EdSection) read a post field outside the projected set? Any spread, Object.keys, JSON.stringify, or prop forwarding of post objects?
2. Identical output: can the reduced objects change rendering, React keys, link prefetch, ordering, or hydration in any case the evidence does not cover (a category with zero posts, a post missing frontmatter fields so defaults apply, a duplicate slug, a non-known category that only exists in posts)?
3. The /blog <head> reorder: is it safe for SEO and site verification (Google / Bing meta tags, theme-color media queries)? Is there a better explanation of the cause, and is anything else in the head affected?
4. Design: one 6-field type for the index plus `Omit<..., 'category'>` for category pages, two getters in lib/blog.ts, getPostsByCategory left in place. Too much surface, or right? Does `import type` in the client files keep lib/blog.ts (fs, gray-matter) out of the client bundle?
5. Tests: would the guard test miss any realistic way of putting full posts back into a client prop (e.g. a client element nested in a non-children prop, a context provider, a fragment array)? Is computing the expected summaries in the test (not via the module's own getters) the right call? Any brittleness or cwd/parallelism problem?
6. Out of scope but report if seen: any other server-to-client boundary in frontend/src/app that passes full BlogPost objects or other large data the client does not read (list with evidence; do not fix).
7. Anything else that breaks the build, SSR/SSG, or the rules in CLAUDE.md / .claude/rules/frontend.md.

Output numbered findings with severity (BLOCKER / SHOULD / NIT), file:line, evidence, and a concrete fix. Final line exactly one of: SHIP / SHIP-WITH-FIXES / REWORK.

## Diff
```diff
diff --git a/frontend/src/app/blog/BlogIndexClient.tsx b/frontend/src/app/blog/BlogIndexClient.tsx
index 58f3eea3..cc4920cb 100644
--- a/frontend/src/app/blog/BlogIndexClient.tsx
+++ b/frontend/src/app/blog/BlogIndexClient.tsx
@@ -2,14 +2,14 @@
 
 import Link from 'next/link';
 import { Inbox } from 'lucide-react';
-import type { BlogPost } from '../../lib/blog';
+import type { BlogPostSummary } from '../../lib/blog';
 import { useLocale } from '../../i18n';
 import { formatDateForLocale, getBlogCategoryLabel } from '../../lib/publicI18n';
 import MarketingShell from '../../components/marketing/MarketingShell';
 import EdPageHero from '../../components/marketing/EdPageHero';
 import EdSection from '../../components/marketing/EdSection';
 
-function PostCard({ post }: { post: BlogPost }) {
+function PostCard({ post }: { post: BlogPostSummary }) {
   const { locale, t } = useLocale();
 
   return (
@@ -38,7 +38,7 @@ function PostCard({ post }: { post: BlogPost }) {
 }
 
 interface BlogIndexClientProps {
-  posts: BlogPost[];
+  posts: BlogPostSummary[];
 }
 
 export default function BlogIndexClient({ posts }: BlogIndexClientProps) {
diff --git a/frontend/src/app/blog/category/[category]/CategoryClient.tsx b/frontend/src/app/blog/category/[category]/CategoryClient.tsx
index 8fa58c72..c1b7da03 100644
--- a/frontend/src/app/blog/category/[category]/CategoryClient.tsx
+++ b/frontend/src/app/blog/category/[category]/CategoryClient.tsx
@@ -2,7 +2,7 @@
 
 import Link from 'next/link';
 import { ArrowLeft } from 'lucide-react';
-import type { BlogPost } from '../../../../lib/blog';
+import type { CategoryPostSummary } from '../../../../lib/blog';
 import { useLocale } from '../../../../i18n';
 import { formatDateForLocale, getBlogCategoryLabel } from '../../../../lib/publicI18n';
 import MarketingShell from '../../../../components/marketing/MarketingShell';
@@ -13,7 +13,7 @@ interface CategoryClientProps {
   category: string;
   label: string;
   description: string;
-  posts: BlogPost[];
+  posts: CategoryPostSummary[];
 }
 
 const RELATED_LINK_KEYS: Record<string, { href: string; labelKey: string }[]> = {
diff --git a/frontend/src/app/blog/category/[category]/page.tsx b/frontend/src/app/blog/category/[category]/page.tsx
index 0dda36cb..5ab90c56 100644
--- a/frontend/src/app/blog/category/[category]/page.tsx
+++ b/frontend/src/app/blog/category/[category]/page.tsx
@@ -1,6 +1,6 @@
 import type { Metadata } from 'next';
 import { notFound } from 'next/navigation';
-import { getPostsByCategory, CATEGORY_META, KNOWN_BLOG_CATEGORIES } from '../../../../lib/blog';
+import { getCategoryPostSummaries, CATEGORY_META, KNOWN_BLOG_CATEGORIES } from '../../../../lib/blog';
 import CategoryClient from './CategoryClient';
 import { buildMarketingMetadata } from '../../../../lib/seo';
 
@@ -30,7 +30,7 @@ export default function CategoryPage({ params }: Props) {
   const meta = CATEGORY_META[params.category];
   if (!meta) notFound();
 
-  const posts = getPostsByCategory(params.category);
+  const posts = getCategoryPostSummaries(params.category);
 
   return (
     <>
diff --git a/frontend/src/app/blog/page.tsx b/frontend/src/app/blog/page.tsx
index 1573d45f..deff4462 100644
--- a/frontend/src/app/blog/page.tsx
+++ b/frontend/src/app/blog/page.tsx
@@ -1,5 +1,5 @@
 import type { Metadata } from 'next';
-import { getAllPosts } from '../../lib/blog';
+import { getPostSummaries } from '../../lib/blog';
 import BlogIndexClient from './BlogIndexClient';
 import { buildMarketingMetadata } from '../../lib/seo';
 
@@ -15,7 +15,7 @@ export const metadata: Metadata = buildMarketingMetadata({
 });
 
 export default function BlogPage() {
-  const posts = getAllPosts();
+  const posts = getPostSummaries();
 
   return (
     <>
diff --git a/frontend/src/lib/blog.ts b/frontend/src/lib/blog.ts
index 2620e5fc..9a088ee4 100644
--- a/frontend/src/lib/blog.ts
+++ b/frontend/src/lib/blog.ts
@@ -87,6 +87,37 @@ export function getPostsByCategory(category: string): BlogPost[] {
   return getAllPosts().filter((p) => p.category === category);
 }
 
+// What a /blog index card renders, for the same reason as RelatedPostSummary:
+// full posts put the whole markdown of every post into the index page's HTML.
+export type BlogPostSummary = Pick<
+  BlogPost,
+  'slug' | 'title' | 'description' | 'category' | 'date' | 'readingMinutes'
+>;
+
+export function getPostSummaries(): BlogPostSummary[] {
+  return getAllPosts().map(({ slug, title, description, category, date, readingMinutes }) => ({
+    slug,
+    title,
+    description,
+    category,
+    date,
+    readingMinutes,
+  }));
+}
+
+// A category page card shows the page's own category label, not the post's.
+export type CategoryPostSummary = Omit<BlogPostSummary, 'category'>;
+
+export function getCategoryPostSummaries(category: string): CategoryPostSummary[] {
+  return getPostsByCategory(category).map(({ slug, title, description, date, readingMinutes }) => ({
+    slug,
+    title,
+    description,
+    date,
+    readingMinutes,
+  }));
+}
+
 export function getAllCategories(): string[] {
   const posts = getAllPosts();
   const cats = new Set<string>(KNOWN_BLOG_CATEGORIES);
diff --git a/frontend/tests/blog-listing-payload.test.cjs b/frontend/tests/blog-listing-payload.test.cjs
new file mode 100644
index 00000000..0387619a
--- /dev/null
+++ b/frontend/tests/blog-listing-payload.test.cjs
@@ -0,0 +1,124 @@
+const assert = require('node:assert/strict');
+const fs = require('node:fs');
+const path = require('node:path');
+const Module = require('node:module');
+const test = require('node:test');
+const ts = require('typescript');
+
+// A client component prop is serialised into the page's RSC payload. The /blog
+// index and the category pages passed full posts to their client components,
+// so /blog carried the whole markdown of every post (352,256 bytes locally,
+// 2026-10-14). Only the fields the listing cards render may cross to the client.
+
+const INDEX_FIELDS = ['category', 'date', 'description', 'readingMinutes', 'slug', 'title'];
+const CATEGORY_FIELDS = ['date', 'description', 'readingMinutes', 'slug', 'title'];
+
+function loadTs(relPath, stubs = {}) {
+  const filename = path.resolve(__dirname, relPath);
+  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
+    compilerOptions: {
+      module: ts.ModuleKind.CommonJS,
+      target: ts.ScriptTarget.ES2020,
+      esModuleInterop: true,
+      jsx: ts.JsxEmit.ReactJSX,
+    },
+    fileName: filename,
+  }).outputText;
+  const mod = new Module(filename, module);
+  mod.filename = filename;
+  mod.paths = Module._nodeModulePaths(path.dirname(filename));
+  const realRequire = mod.require.bind(mod);
+  mod.require = (request) => (request in stubs ? stubs[request] : realRequire(request));
+  mod._compile(compiled, filename);
+  return mod.exports;
+}
+
+const FRONTEND = path.resolve(__dirname, '..');
+
+function loadBlog() {
+  // lib/blog.ts fixes its content directory from the working directory at load.
+  const cwd = process.cwd();
+  process.chdir(FRONTEND);
+  try {
+    const blog = loadTs('../src/lib/blog.ts');
+    return { blog, posts: blog.getAllPosts() };
+  } finally {
+    process.chdir(cwd);
+  }
+}
+
+const SEO_STUB = { buildMarketingMetadata: () => ({}) };
+
+function pick(post, fields) {
+  return Object.fromEntries(fields.map((field) => [field, post[field]]));
+}
+
+function findElements(node, type) {
+  if (!node || typeof node !== 'object') return [];
+  if (Array.isArray(node)) return node.flatMap((child) => findElements(child, type));
+  if (node.type === type) return [node];
+  return findElements(node.props && node.props.children, type);
+}
+
+// Renders the real page with its client component stubbed and reads the props
+// it would serialise, so any way of putting full posts back into them fails.
+test('the blog index hands the client only post summaries', () => {
+  const { blog, posts } = loadBlog();
+  assert.ok(posts.length > 0, 'no blog posts found');
+  function BlogIndexClientStub() {
+    return null;
+  }
+  const { default: BlogPage } = loadTs('../src/app/blog/page.tsx', {
+    '../../lib/blog': blog,
+    './BlogIndexClient': BlogIndexClientStub,
+    '../../lib/seo': SEO_STUB,
+  });
+
+  const clients = findElements(BlogPage(), BlogIndexClientStub);
+  assert.equal(clients.length, 1, 'expected one BlogIndexClient');
+  const [client] = clients;
+  assert.deepEqual(Object.keys(client.props).sort(), ['posts']);
+  // Same posts in the same order as before the change, reduced to the card fields.
+  assert.deepEqual(client.props.posts, posts.map((post) => pick(post, INDEX_FIELDS)));
+  for (const summary of client.props.posts) {
+    assert.deepEqual(Object.keys(summary).sort(), INDEX_FIELDS, summary.slug);
+  }
+});
+
+test('each category page hands the client only post summaries', () => {
+  const { blog, posts } = loadBlog();
+  function CategoryClientStub() {
+    return null;
+  }
+  const notFound = () => {
+    throw new Error('notFound');
+  };
+  const { default: CategoryPage } = loadTs('../src/app/blog/category/[category]/page.tsx', {
+    '../../../../lib/blog': blog,
+    './CategoryClient': CategoryClientStub,
+    'next/navigation': { notFound },
+    '../../../../lib/seo': SEO_STUB,
+  });
+
+  let summaries = 0;
+  for (const category of blog.KNOWN_BLOG_CATEGORIES) {
+    const clients = findElements(CategoryPage({ params: { category } }), CategoryClientStub);
+    assert.equal(clients.length, 1, `${category}: expected one CategoryClient`);
+    const [client] = clients;
+    assert.deepEqual(
+      Object.keys(client.props).sort(),
+      ['category', 'description', 'label', 'posts'],
+      category,
+    );
+    const expected = posts
+      .filter((post) => post.category === category)
+      .map((post) => pick(post, CATEGORY_FIELDS));
+    assert.deepEqual(client.props.posts, expected, category);
+    for (const summary of client.props.posts) {
+      assert.deepEqual(Object.keys(summary).sort(), CATEGORY_FIELDS, `${category}: ${summary.slug}`);
+      summaries += 1;
+    }
+  }
+  assert.ok(summaries > 0, 'no category has posts, the check proves nothing');
+  assert.throws(() => CategoryPage({ params: { category: 'no-such-category' } }), /notFound/);
+});
```
