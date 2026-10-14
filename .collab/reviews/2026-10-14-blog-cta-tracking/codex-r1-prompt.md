# Codex adversarial review — blog /demo CTA tracking (DocTalk)

Do NOT run git. Repo root = cwd. The diff under review is at the end of this prompt (base origin/main bf3090ce, head f7b2d57b, branch feat/blog-cta-tracking). Read the changed files in full plus:
- frontend/src/lib/analytics.ts (trackEvent), frontend/src/lib/attribution.ts (first-touch capture, ATTRIBUTED_EVENTS, safeLandingPath)
- frontend/src/components/AnalyticsWrapper.tsx, frontend/src/app/layout.tsx (where attribution is imported)
- backend/app/api/events.py (ALLOWED_EVENTS / PUBLIC_EVENTS, _safe_properties) — read only, nothing there should need to change
- frontend/src/components/landing/HeroSection.tsx (existing landing_cta_clicked call sites, for parity)
- .collab/dialogue/2026-10-14-fable-readout-rulings.md (Q2: why) and .collab/reviews/2026-10-14-ungated-readout/readout_1014.py (how the events are read)
- frontend/tests/blog-cta-tracking.test.cjs, frontend/tests/attribution.test.cjs

Purpose: a visitor who lands on a blog post and clicks a /demo link must produce one `landing_cta_clicked` row whose metadata carries the first-touch attribution (`ref_host`, `utm_*`, `landing_path` = the blog path) so the readout can count listicle visitors at the CTA step.

Check, adversarially:
1. Correctness: does each of the three sites (about box, CTA banner, markdown /demo links) fire exactly once per click, before the client navigation, and is the attribution still the first touch (module memory survives next/link)? Any way the inline handler is overridden by react-markdown props, fires for non-/demo links, or fires twice (e.g. nested anchors, both onClick and something else)?
2. Does `{...props}` from react-markdown contain anything that now changes behaviour (e.g. `node`, an existing onClick)? Is placing onClick after the spread safe?
3. Privacy: the events are sent without cookie consent. Does anything new reach the backend that attribution.ts sanitizing would not cover (path, query strings, document ids)? `trackEvent` sets `path` via safeLandingPath for attributed events — confirm for /blog paths.
4. Measurement: will the readout (`readout_1014.py` §1–§5, CHANNEL CASE, owner exclusion) count these rows correctly? Any double counting with the existing PublicHeader/hero events on the same visit? Rate limit (`public_event_limiter`) interactions?
5. Tests: do the new tests actually fail if a site loses its handler (mutation reasoning), and is the regex-on-source approach brittle in a way that matters?
6. Anything else that breaks the build, SSR, or the rules in CLAUDE.md / .claude/rules/frontend.md.

Output numbered findings with severity (BLOCKER / SHOULD / NIT), file:line, evidence, and a concrete fix. Final line exactly one of: SHIP / SHIP-WITH-FIXES / REWORK.

## Diff
```diff
diff --git a/frontend/src/app/blog/[slug]/BlogPostClient.tsx b/frontend/src/app/blog/[slug]/BlogPostClient.tsx
index 028995f0..097b3b17 100644
--- a/frontend/src/app/blog/[slug]/BlogPostClient.tsx
+++ b/frontend/src/app/blog/[slug]/BlogPostClient.tsx
@@ -9,6 +9,7 @@ import type { BlogPost } from '../../../lib/blog';
 import { useLocale } from '../../../i18n';
 import { formatDateForLocale, getBlogCategoryLabel } from '../../../lib/publicI18n';
 import MarketingShell from '../../../components/marketing/MarketingShell';
+import { isDemoHref, trackBlogDemoClick } from '../../../lib/blogCta';
 import {
   extractHeadingIdsByOffset,
   headingTextFromMarkdown,
@@ -286,7 +287,11 @@ export default function BlogPostClient({ post, relatedPosts }: BlogPostClientPro
                     const isInternal = href?.startsWith('/');
                     if (isInternal) {
                       return (
-                        <Link href={href!} {...props}>
+                        <Link
+                          href={href!}
+                          {...props}
+                          onClick={isDemoHref(href) ? () => trackBlogDemoClick('blog_inline') : undefined}
+                        >
                           {children}
                         </Link>
                       );
@@ -403,7 +408,7 @@ export default function BlogPostClient({ post, relatedPosts }: BlogPostClientPro
                 {t('blog.post.aboutDescription')}
               </p>
               <div className="flex flex-wrap items-center" style={{ gap: '16px' }}>
-                <Link href="/demo" className="ed-cta">
+                <Link href="/demo" className="ed-cta" onClick={() => trackBlogDemoClick('blog_about')}>
                   {t('blog.post.tryFreeDemo')}
                   <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                 </Link>
@@ -428,7 +433,7 @@ export default function BlogPostClient({ post, relatedPosts }: BlogPostClientPro
                 {t('blog.post.cta.description')}
               </p>
               <div style={{ marginTop: '24px' }}>
-                <Link href="/demo" className="ed-cta">
+                <Link href="/demo" className="ed-cta" onClick={() => trackBlogDemoClick('blog_cta')}>
                   {t('blog.post.cta.launchDemo')}
                   <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                 </Link>
diff --git a/frontend/src/lib/blogCta.ts b/frontend/src/lib/blogCta.ts
new file mode 100644
index 00000000..057769e8
--- /dev/null
+++ b/frontend/src/lib/blogCta.ts
@@ -0,0 +1,20 @@
+import { trackEvent } from './analytics';
+
+// A blog post's call to action is its /demo links: the about box, the CTA
+// banner and /demo links inside the post text. They send landing_cta_clicked,
+// the attributed funnel event the traffic readout counts per landing page.
+// Before this, a visitor who landed on a post was counted only at the sign-in
+// step, while a home-page visitor was counted at the first CTA click (Fable
+// ruling 2026-10-14, Q2: `.collab/dialogue/2026-10-14-fable-readout-rulings.md`).
+
+export type BlogCtaSource = 'blog_about' | 'blog_cta' | 'blog_inline';
+
+const DEMO_HREF = /^\/demo(?:[/?#]|$)/;
+
+export function isDemoHref(href: string | undefined): boolean {
+  return typeof href === 'string' && DEMO_HREF.test(href);
+}
+
+export function trackBlogDemoClick(source: BlogCtaSource) {
+  trackEvent('landing_cta_clicked', { source, reason: 'demo' });
+}
diff --git a/frontend/tests/blog-cta-tracking.test.cjs b/frontend/tests/blog-cta-tracking.test.cjs
new file mode 100644
index 00000000..20fd7ab5
--- /dev/null
+++ b/frontend/tests/blog-cta-tracking.test.cjs
@@ -0,0 +1,77 @@
+const assert = require('node:assert/strict');
+const fs = require('node:fs');
+const path = require('node:path');
+const Module = require('node:module');
+const test = require('node:test');
+const ts = require('typescript');
+
+// Blog /demo links send landing_cta_clicked, so the traffic readout can count
+// a listicle visitor at the CTA click, as it does for the home page (Fable
+// ruling 2026-10-14, Q2).
+
+function loadTs(relPath, stubs = {}) {
+  const filename = path.resolve(__dirname, relPath);
+  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
+    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
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
+const BLOG_POST_CLIENT = path.resolve(__dirname, '../src/app/blog/[slug]/BlogPostClient.tsx');
+
+test('isDemoHref matches the demo route and its sub-paths only', () => {
+  const calls = [];
+  const { isDemoHref } = loadTs('../src/lib/blogCta.ts', {
+    './analytics': { trackEvent: (...args) => calls.push(args) },
+  });
+  for (const href of ['/demo', '/demo/alphabet-earnings', '/demo?ref=blog', '/demo#start']) {
+    assert.equal(isDemoHref(href), true, href);
+  }
+  for (const href of ['/demonstrate', '/pricing', '/blog/demo', 'https://www.doctalk.site/demo', '', undefined]) {
+    assert.equal(isDemoHref(href), false, String(href));
+  }
+  assert.equal(calls.length, 0);
+});
+
+test('trackBlogDemoClick sends the attributed CTA event with its source', () => {
+  const calls = [];
+  const { trackBlogDemoClick } = loadTs('../src/lib/blogCta.ts', {
+    './analytics': { trackEvent: (...args) => calls.push(args) },
+  });
+  trackBlogDemoClick('blog_about');
+  trackBlogDemoClick('blog_cta');
+  trackBlogDemoClick('blog_inline');
+  assert.deepEqual(calls, [
+    ['landing_cta_clicked', { source: 'blog_about', reason: 'demo' }],
+    ['landing_cta_clicked', { source: 'blog_cta', reason: 'demo' }],
+    ['landing_cta_clicked', { source: 'blog_inline', reason: 'demo' }],
+  ]);
+  // The readout counts this event; it must stay in the attributed set.
+  const { ATTRIBUTED_EVENTS } = loadTs('../src/lib/attribution.ts');
+  assert.equal(ATTRIBUTED_EVENTS.has('landing_cta_clicked'), true);
+});
+
+test('every /demo link in the blog post template is tracked once per site', () => {
+  const src = fs.readFileSync(BLOG_POST_CLIENT, 'utf8');
+  for (const source of ['blog_about', 'blog_cta', 'blog_inline']) {
+    const count = src.split(`trackBlogDemoClick('${source}')`).length - 1;
+    assert.equal(count, 1, `${source} call sites`);
+  }
+  // Each hard-coded /demo Link carries a tracked onClick.
+  const demoLinks = src.match(/<Link href="\/demo"[^\n]*/g) || [];
+  assert.equal(demoLinks.length, 2);
+  for (const tag of demoLinks) assert.match(tag, /onClick=\{\(\) => trackBlogDemoClick\('blog_(about|cta)'\)\}/);
+  // Markdown links: only /demo hrefs are tracked, and the handler is set after
+  // the spread props so react-markdown's props cannot replace it.
+  assert.match(
+    src,
+    /\{\.\.\.props\}\s*onClick=\{isDemoHref\(href\) \? \(\) => trackBlogDemoClick\('blog_inline'\) : undefined\}/,
+  );
+});
```
