# Codex adversarial review — blog related-post RSC payload (DocTalk)

Do NOT run git. Repo root = cwd. The diff under review is at the end of this prompt (base origin/main 2f2a9eaf, head a97c89fe, branch claude/eloquent-payne-169b39). Read the changed files in full plus:
- frontend/src/app/blog/[slug]/page.tsx and frontend/src/app/blog/[slug]/BlogPostClient.tsx (whole files)
- frontend/src/lib/blog.ts (whole file)
- frontend/src/app/sitemap.ts, frontend/src/app/blog/page.tsx, frontend/src/app/blog/category/[category]/page.tsx (other getAllPosts consumers; must be unaffected)
- frontend/tests/blog-related-posts-payload.test.cjs, frontend/tests/blog-cta-tracking.test.cjs (test style), frontend/tests/blog-jsonld.test.cjs

Purpose: `BlogPostClient` is a client component, so its props are serialised into the page's RSC payload. The page passed `relatedPosts` = up to 3 full `BlogPost` objects (including `content`, the whole markdown), so every post's HTML carried the markdown of three other posts (live /blog/chatpdf-alternatives-2026 was 148,578 bytes on 2026-10-14). The change passes only the fields `RelatedPosts` renders (slug, title, description). Requirement: the rendered output stays identical; no blog post content is edited.

Evidence already gathered by Claude (local `next build && next start`, curl of all 20 posts, /blog and the 5 category pages, before = 2f2a9eaf, after = a97c89fe):
- All 20 posts: 2,821,230 -> 1,883,435 bytes of HTML (-33.2%); per post -25.7% to -37.9%. /blog/chatpdf-alternatives-2026: 145,723 -> 96,528.
- Markup with every <script> and <link> removed: identical on all 26 pages.
- JSON-LD scripts: identical on all 26 pages.
- Asset URLs: unchanged except the `app/blog/[slug]/page-<hash>.js` chunk on post pages (BlogPostClient.tsx source changed).
- Control pages (/blog, categories): exactly one token differs, the build ID.
- RSC payload, resolved independent of row IDs (React had outlined each related post's markdown as its own T row, so 3 rows disappear and later row IDs shift by 3): the before and after trees are equal on all 20 posts once each old relatedPosts item is reduced to {slug, title, description}; without that reduction they differ (sensitivity check).
- Browser (next start, 127.0.0.1): chatpdf-alternatives-2026 hydrates, 3 related cards with the same hrefs/titles, no hydration or React errors, client navigation to a related post works.
- npm run test:unit 366/366, npm run lint clean, npm run build passes.

Check, adversarially:
1. Completeness: does anything in BlogPostClient (or anything it passes relatedPosts to) read a related-post field other than slug, title, description? Any spread or key iteration over related objects?
2. Identical output: can the reduced objects change rendering, React keys, link prefetch, or hydration in any case the evidence above does not cover (e.g. a post with fewer than 3 related posts, an empty category, a post whose title/description is empty)?
3. Selection: is getRelatedPosts' selection (same category, not itself, first 3 in getAllPosts date order) exactly the old one? Any change in evaluation cost or ordering?
4. Type surface: does importing RelatedPostSummary as a type into the client file pull lib/blog.ts (fs, gray-matter) into the client bundle? (It is `import type`.)
5. Tests: would the new tests fail if someone passed full posts again (mutation reasoning), and is the regex-on-source part brittle in a way that matters? The test chdirs to frontend/ while loading lib/blog.ts because BLOG_DIR is fixed from process.cwd() at load — any problem with node --test running files in parallel processes?
6. Out of scope but report if seen: other client components that receive full BlogPost objects they do not need (do not fix; list with evidence).
7. Anything else that breaks the build, SSR/SSG, or the rules in CLAUDE.md / .claude/rules/frontend.md.

Output numbered findings with severity (BLOCKER / SHOULD / NIT), file:line, evidence, and a concrete fix. Final line exactly one of: SHIP / SHIP-WITH-FIXES / REWORK.

## Diff
```diff
diff --git a/frontend/src/app/blog/[slug]/BlogPostClient.tsx b/frontend/src/app/blog/[slug]/BlogPostClient.tsx
index 097b3b17..c76a2174 100644
--- a/frontend/src/app/blog/[slug]/BlogPostClient.tsx
+++ b/frontend/src/app/blog/[slug]/BlogPostClient.tsx
@@ -5,7 +5,7 @@ import Link from 'next/link';
 import ReactMarkdown from 'react-markdown';
 import remarkGfm from 'remark-gfm';
 import { ArrowLeft, ArrowRight, Calendar, Clock } from 'lucide-react';
-import type { BlogPost } from '../../../lib/blog';
+import type { BlogPost, RelatedPostSummary } from '../../../lib/blog';
 import { useLocale } from '../../../i18n';
 import { formatDateForLocale, getBlogCategoryLabel } from '../../../lib/publicI18n';
 import MarketingShell from '../../../components/marketing/MarketingShell';
@@ -131,7 +131,7 @@ function InlineTOC({ items }: { items: TocItem[] }) {
   );
 }
 
-function RelatedPosts({ posts }: { posts: BlogPost[] }) {
+function RelatedPosts({ posts }: { posts: RelatedPostSummary[] }) {
   const { t } = useLocale();
   if (posts.length === 0) return null;
   return (
@@ -163,7 +163,7 @@ function RelatedPosts({ posts }: { posts: BlogPost[] }) {
 
 interface BlogPostClientProps {
   post: BlogPost;
-  relatedPosts: BlogPost[];
+  relatedPosts: RelatedPostSummary[];
 }
 
 export default function BlogPostClient({ post, relatedPosts }: BlogPostClientProps) {
diff --git a/frontend/src/app/blog/[slug]/page.tsx b/frontend/src/app/blog/[slug]/page.tsx
index 01ec48d6..1ee681d9 100644
--- a/frontend/src/app/blog/[slug]/page.tsx
+++ b/frontend/src/app/blog/[slug]/page.tsx
@@ -1,6 +1,6 @@
 import type { Metadata } from 'next';
 import { notFound } from 'next/navigation';
-import { getAllPosts, getPostBySlug } from '../../../lib/blog';
+import { getAllPosts, getPostBySlug, getRelatedPosts } from '../../../lib/blog';
 import {
   buildFaqPage,
   buildRankedItemList,
@@ -63,10 +63,7 @@ export default function BlogPostPage({ params }: Props) {
   const post = getPostBySlug(params.slug);
   if (!post) notFound();
 
-  const allPosts = getAllPosts();
-  const related = allPosts
-    .filter((p) => p.category === post.category && p.slug !== post.slug)
-    .slice(0, 3);
+  const related = getRelatedPosts(post);
 
   const postUrl = `https://www.doctalk.site/blog/${post.slug}`;
   // FAQPage and ItemList come from the post's own markdown, so they always match
diff --git a/frontend/src/lib/blog.ts b/frontend/src/lib/blog.ts
index 8625ea82..2620e5fc 100644
--- a/frontend/src/lib/blog.ts
+++ b/frontend/src/lib/blog.ts
@@ -71,6 +71,18 @@ export function getPostBySlug(slug: string): BlogPost | null {
   };
 }
 
+// What a related-post card renders. Only these fields go to the client: a
+// client component prop is serialised into the page's RSC payload, and full
+// posts put the whole markdown of three other posts into every post's HTML.
+export type RelatedPostSummary = Pick<BlogPost, 'slug' | 'title' | 'description'>;
+
+export function getRelatedPosts(post: BlogPost, limit = 3): RelatedPostSummary[] {
+  return getAllPosts()
+    .filter((p) => p.category === post.category && p.slug !== post.slug)
+    .slice(0, limit)
+    .map(({ slug, title, description }) => ({ slug, title, description }));
+}
+
 export function getPostsByCategory(category: string): BlogPost[] {
   return getAllPosts().filter((p) => p.category === category);
 }
diff --git a/frontend/tests/blog-related-posts-payload.test.cjs b/frontend/tests/blog-related-posts-payload.test.cjs
new file mode 100644
index 00000000..954d8a92
--- /dev/null
+++ b/frontend/tests/blog-related-posts-payload.test.cjs
@@ -0,0 +1,76 @@
+const assert = require('node:assert/strict');
+const fs = require('node:fs');
+const path = require('node:path');
+const Module = require('node:module');
+const test = require('node:test');
+const ts = require('typescript');
+
+// A client component prop is serialised into the page's RSC payload. The blog
+// post page passed three full related posts to BlogPostClient, so every post's
+// HTML carried the whole markdown of three other posts (2026-10-14). Only the
+// fields the related-post card renders may cross to the client.
+
+function loadTs(relPath) {
+  const filename = path.resolve(__dirname, relPath);
+  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
+    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
+    fileName: filename,
+  }).outputText;
+  const mod = new Module(filename, module);
+  mod.filename = filename;
+  mod.paths = Module._nodeModulePaths(path.dirname(filename));
+  mod._compile(compiled, filename);
+  return mod.exports;
+}
+
+const FRONTEND = path.resolve(__dirname, '..');
+const PAGE = path.join(FRONTEND, 'src/app/blog/[slug]/page.tsx');
+const CLIENT = path.join(FRONTEND, 'src/app/blog/[slug]/BlogPostClient.tsx');
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
+test('getRelatedPosts returns only slug, title and description', () => {
+  const { blog, posts } = loadBlog();
+  assert.ok(posts.length > 0, 'no blog posts found');
+  let cards = 0;
+  for (const post of posts) {
+    const related = blog.getRelatedPosts(post);
+    for (const card of related) {
+      assert.deepEqual(Object.keys(card).sort(), ['description', 'slug', 'title'], post.slug);
+      cards += 1;
+    }
+  }
+  assert.ok(cards > 0, 'no post has related posts, the check proves nothing');
+});
+
+test('getRelatedPosts keeps the selection: same category, not itself, first 3 by date', () => {
+  const { blog, posts } = loadBlog();
+  for (const post of posts) {
+    const expected = posts
+      .filter((p) => p.category === post.category && p.slug !== post.slug)
+      .slice(0, 3)
+      .map((p) => ({ slug: p.slug, title: p.title, description: p.description }));
+    assert.deepEqual(blog.getRelatedPosts(post), expected, post.slug);
+  }
+});
+
+test('the post page passes related summaries, never full posts, to the client', () => {
+  const page = fs.readFileSync(PAGE, 'utf8');
+  assert.match(page, /const related = getRelatedPosts\(post\);/);
+  assert.match(page, /relatedPosts=\{related\}/);
+
+  const client = fs.readFileSync(CLIENT, 'utf8');
+  assert.match(client, /relatedPosts: RelatedPostSummary\[\];/);
+  assert.match(client, /function RelatedPosts\(\{ posts \}: \{ posts: RelatedPostSummary\[\] \}\)/);
+  assert.doesNotMatch(client, /relatedPosts: BlogPost\[\]/);
+});
```
