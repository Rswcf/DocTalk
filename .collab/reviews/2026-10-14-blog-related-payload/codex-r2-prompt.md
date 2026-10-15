# Codex adversarial review r2 — blog related-post RSC payload (DocTalk)

Do NOT run git. Repo root = cwd. Round 1 (your output: .collab/reviews/2026-10-14-blog-related-payload/codex-r1-output.md) was SHIP with one NIT: the wiring test matched source spelling, so `related.forEach(s => Object.assign(s, getPostBySlug(s.slug)))` passed it. Commit 153f0a5d below replaces that test. Only the test file changed; no source change since r1.

Read frontend/tests/blog-related-posts-payload.test.cjs in full. It now transpiles `src/app/blog/[slug]/page.tsx` with JSX, stubs `./BlogPostClient`, `next/navigation`, `lib/seo` and `lib/blogSchema`, calls `BlogPostPage` for every post, finds the stub element and asserts its `relatedPosts` prop deep-equals `getRelatedPosts(post)` and has exactly the keys slug/title/description.

Claude's mutation runs: (A) your Object.assign mutation and (B) the original full-post selection in page.tsx each fail this test on the AssertionError, then page.tsx was restored. `npm run test:unit` 366/366, `npm run lint` clean.

Check: does the test fail for every way of putting extra fields into the client props (including mutating the summaries, or passing `getAllPosts()` slices)? Can it pass vacuously (e.g. the stub never found, zero related posts, the stubs hiding a real code path that matters)? Is anything about the stubs or the JSX transpile brittle in a way that matters?

Output numbered findings with severity (BLOCKER / SHOULD / NIT), file:line, evidence, and a concrete fix. Final line exactly one of: SHIP / SHIP-WITH-FIXES / REWORK.

## Diff (r1 head a97c89fe -> r2 head)
```diff
diff --git a/frontend/tests/blog-related-posts-payload.test.cjs b/frontend/tests/blog-related-posts-payload.test.cjs
index 954d8a92..9521cf57 100644
--- a/frontend/tests/blog-related-posts-payload.test.cjs
+++ b/frontend/tests/blog-related-posts-payload.test.cjs
@@ -10,22 +10,27 @@ const ts = require('typescript');
 // HTML carried the whole markdown of three other posts (2026-10-14). Only the
 // fields the related-post card renders may cross to the client.
 
-function loadTs(relPath) {
+function loadTs(relPath, stubs = {}) {
   const filename = path.resolve(__dirname, relPath);
   const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
-    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
+    compilerOptions: {
+      module: ts.ModuleKind.CommonJS,
+      target: ts.ScriptTarget.ES2020,
+      esModuleInterop: true,
+      jsx: ts.JsxEmit.ReactJSX,
+    },
     fileName: filename,
   }).outputText;
   const mod = new Module(filename, module);
   mod.filename = filename;
   mod.paths = Module._nodeModulePaths(path.dirname(filename));
+  const realRequire = mod.require.bind(mod);
+  mod.require = (request) => (request in stubs ? stubs[request] : realRequire(request));
   mod._compile(compiled, filename);
   return mod.exports;
 }
 
 const FRONTEND = path.resolve(__dirname, '..');
-const PAGE = path.join(FRONTEND, 'src/app/blog/[slug]/page.tsx');
-const CLIENT = path.join(FRONTEND, 'src/app/blog/[slug]/BlogPostClient.tsx');
 
 function loadBlog() {
   // lib/blog.ts fixes its content directory from the working directory at load.
@@ -64,13 +69,49 @@ test('getRelatedPosts keeps the selection: same category, not itself, first 3 by
   }
 });
 
-test('the post page passes related summaries, never full posts, to the client', () => {
-  const page = fs.readFileSync(PAGE, 'utf8');
-  assert.match(page, /const related = getRelatedPosts\(post\);/);
-  assert.match(page, /relatedPosts=\{related\}/);
+// Renders the real page with BlogPostClient stubbed and reads the props it
+// would serialise, so any way of putting full posts back into them fails.
+test('the post page hands the client only related summaries', () => {
+  const { blog, posts } = loadBlog();
+  function BlogPostClientStub() {
+    return null;
+  }
+  const { default: BlogPostPage } = loadTs('../src/app/blog/[slug]/page.tsx', {
+    '../../../lib/blog': blog,
+    './BlogPostClient': BlogPostClientStub,
+    'next/navigation': { notFound: () => { throw new Error('notFound'); } },
+    '../../../lib/seo': {
+      buildArticleJsonLd: () => ({}),
+      buildMarketingMetadata: () => ({}),
+      DEFAULT_SHARE_ALT: '',
+      resolveShareImage: () => '',
+    },
+    '../../../lib/blogSchema': {
+      buildFaqPage: () => ({}),
+      buildRankedItemList: () => ({}),
+      extractFaq: () => [],
+      extractRankedItems: () => [],
+      jsonLdString: () => '',
+    },
+  });
+
+  const findClient = (node) => {
+    if (!node || typeof node !== 'object') return null;
+    if (Array.isArray(node)) return node.map(findClient).find(Boolean) || null;
+    if (node.type === BlogPostClientStub) return node;
+    return findClient(node.props && node.props.children);
+  };
 
-  const client = fs.readFileSync(CLIENT, 'utf8');
-  assert.match(client, /relatedPosts: RelatedPostSummary\[\];/);
-  assert.match(client, /function RelatedPosts\(\{ posts \}: \{ posts: RelatedPostSummary\[\] \}\)/);
-  assert.doesNotMatch(client, /relatedPosts: BlogPost\[\]/);
+  let cards = 0;
+  for (const post of posts) {
+    const client = findClient(BlogPostPage({ params: { slug: post.slug } }));
+    assert.ok(client, `${post.slug}: BlogPostClient not rendered`);
+    const { relatedPosts } = client.props;
+    assert.deepEqual(relatedPosts, blog.getRelatedPosts(post), post.slug);
+    for (const card of relatedPosts) {
+      assert.deepEqual(Object.keys(card).sort(), ['description', 'slug', 'title'], post.slug);
+      cards += 1;
+    }
+  }
+  assert.ok(cards > 0, 'no post has related posts, the check proves nothing');
 });
```
