# Codex review r2 — blog listing guard test (DocTalk)

Do NOT run git. Repo root = cwd. Round 1 (your review of d670015f, verdict SHIP) raised NIT 1: `findElements()` in frontend/tests/blog-listing-payload.test.cjs walked only arrays and `props.children`, so a client element in a non-children prop (a Suspense `fallback` holding full posts) passed the test, and the comment overstated coverage. Commit b5c0bf5c (diff below) changes only that test file. NIT 2 (the post page's primary post carries image, imageAlt, keywords, readingTime unread) is pre-existing and left for a separate change.

Evidence from Claude:
- Your Suspense-fallback mutation, applied to both pages: the d670015f test passes it (2/2 pass); the b5c0bf5c test fails it (0/2 pass).
- All 14 mutations fail the new test on an AssertionError: the 12 from round 1 plus a Suspense fallback client with full posts on each page.
- npm run test:unit 368/368, npm run lint clean.

Check:
1. Is the new walker correct: does it find every element of the stubbed type anywhere in the props tree the page returns? Any false positive or crash from walking non-element objects (dangerouslySetInnerHTML, the posts arrays, style objects)? Is the `seen` set safe (it could skip a second reference to the same element object; does that matter for the "exactly one client" assertion)?
2. Is the narrowed comment accurate?
3. Anything else wrong with the test.

Output numbered findings with severity (BLOCKER / SHOULD / NIT), file:line, evidence, and a concrete fix. Final line exactly one of: SHIP / SHIP-WITH-FIXES / REWORK.

## Diff
```diff
diff --git a/frontend/tests/blog-listing-payload.test.cjs b/frontend/tests/blog-listing-payload.test.cjs
index 0387619a..27ef2684 100644
--- a/frontend/tests/blog-listing-payload.test.cjs
+++ b/frontend/tests/blog-listing-payload.test.cjs
@@ -53,15 +53,20 @@ function pick(post, fields) {
   return Object.fromEntries(fields.map((field) => [field, post[field]]));
 }
 
-function findElements(node, type) {
-  if (!node || typeof node !== 'object') return [];
-  if (Array.isArray(node)) return node.flatMap((child) => findElements(child, type));
-  if (node.type === type) return [node];
-  return findElements(node.props && node.props.children, type);
+// Walks every prop, not only children, so a client element placed in another
+// prop (a Suspense fallback, say) is found too.
+function findElements(node, type, seen = new Set()) {
+  if (!node || typeof node !== 'object' || seen.has(node)) return [];
+  seen.add(node);
+  if (Array.isArray(node)) return node.flatMap((child) => findElements(child, type, seen));
+  const own = node.type === type ? [node] : [];
+  const values = node.$$typeof ? Object.values(node.props || {}) : Object.values(node);
+  return own.concat(values.flatMap((value) => findElements(value, type, seen)));
 }
 
 // Renders the real page with its client component stubbed and reads the props
-// it would serialise, so any way of putting full posts back into them fails.
+// every instance of that client would serialise. Full posts handed to some other
+// client component (a context provider, say) are outside what this test sees.
 test('the blog index hands the client only post summaries', () => {
   const { blog, posts } = loadBlog();
   assert.ok(posts.length > 0, 'no blog posts found');
```
