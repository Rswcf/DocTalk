# Codex round 3 — confirm the round-2 fixes (DocTalk attribution)

Your round-2 review is at .collab/reviews/2026-09-30-attribution/codex-r2-output.md (final 'codex' section). Do NOT run git. The fix diff is below. For each of your round-2 PARTIAL items (1, 3, 6) say FIXED / NOT FIXED with evidence, list any NEW real problem, and end with one verdict line: SHIP / SHIP-WITH-FIXES / REWORK. Be brief.

```diff
diff --git a/frontend/src/lib/analytics.ts b/frontend/src/lib/analytics.ts
index 1cb55a3b..1e41ce8b 100644
--- a/frontend/src/lib/analytics.ts
+++ b/frontend/src/lib/analytics.ts
@@ -1,4 +1,4 @@
-import { ATTRIBUTED_EVENTS, getAttribution } from './attribution';
+import { ATTRIBUTED_EVENTS, getAttribution, safeLandingPath } from './attribution';
 
 type EventParams = Record<string, string | number | boolean | null | undefined>;
 
@@ -11,9 +11,12 @@ declare global {
 export function trackEvent(eventName: string, params: EventParams = {}) {
   if (typeof window === 'undefined') return;
   try {
+    // The pre-signup funnel events are sent without consent, so their path is
+    // bucketed like landing_path (no document ids or share tokens).
+    const attributed = ATTRIBUTED_EVENTS.has(eventName);
     const safeParams: EventParams = {
-      path: window.location.pathname,
-      ...(ATTRIBUTED_EVENTS.has(eventName) ? getAttribution() : {}),
+      path: attributed ? safeLandingPath(window.location.pathname) : window.location.pathname,
+      ...(attributed ? getAttribution() : {}),
       ...params,
     };
     window.gtag?.('event', eventName, safeParams);
diff --git a/frontend/src/lib/attribution.ts b/frontend/src/lib/attribution.ts
index cbcc1f6d..ee0c545e 100644
--- a/frontend/src/lib/attribution.ts
+++ b/frontend/src/lib/attribution.ts
@@ -64,7 +64,7 @@ const PUBLIC_PATH = new RegExp(
     `/(?:use-cases|compare|alternatives|features|tools)(?:/${SLUG})?|` +
     `/blog(?:/category)?(?:/${SLUG})?|` +
     `/demo(?:/${SLUG})?|` +
-    `/(?:pricing|trust|about|contact|imprint|privacy|terms))$`,
+    `/(?:pricing|trust|about|contact|imprint|privacy|terms))?$`,
 );
 
 const MAX_LEN = 64;
@@ -107,15 +107,22 @@ export function safeUtm(value: string | null | undefined): string | undefined {
   return v;
 }
 
-// Public marketing paths are kept; anything else collapses to its first
-// segment plus "/*", so /d/<document-id> becomes "/d/*" and
-// /shared/<token> becomes "/shared/*".
-export function safeLandingPath(pathname: string): string | undefined {
+// App routes whose first segment is safe to name; everything under them is
+// collapsed. Any other unknown path becomes "/*".
+const APP_ROUTE_BUCKETS = new Set([
+  'd', 'shared', 'collections', 'auth', 'billing', 'profile', 'admin', 'document-diff',
+]);
+
+// Public marketing paths are kept; known app routes collapse to their first
+// segment, so /d/<document-id> becomes "/d/*" and /shared/<token> becomes
+// "/shared/*"; anything else becomes "/*".
+export function safeLandingPath(pathname: string): string {
   const p = pathname.toLowerCase().replace(/\/+$/, '') || '/';
   if (PUBLIC_PATH.test(p)) return p;
-  const first = p.split('/')[1];
-  if (!first || !/^[a-z0-9-]{1,40}$/.test(first)) return '/*';
-  return p.split('/').length > 2 ? `/${first}/*` : `/${first}`;
+  const segments = p.split('/');
+  const first = segments[1];
+  if (!first || !APP_ROUTE_BUCKETS.has(first)) return '/*';
+  return segments.length > 2 ? `/${first}/*` : `/${first}`;
 }
 
 export function readAttribution(referrer: string, href: string): Attribution {
diff --git a/frontend/tests/attribution.test.cjs b/frontend/tests/attribution.test.cjs
index bdbe8aae..0cfc4d54 100644
--- a/frontend/tests/attribution.test.cjs
+++ b/frontend/tests/attribution.test.cjs
@@ -30,6 +30,8 @@ test('private and dynamic routes never leak ids or tokens into landing_path', ()
   assert.equal(safeLandingPath('/auth/verify-request/extra'), '/auth/*');
   assert.equal(safeLandingPath('/profile'), '/profile');
   assert.equal(safeLandingPath('/%40user%40mail.com'), '/*');
+  assert.equal(safeLandingPath('/john-smith'), '/*');
+  assert.equal(safeLandingPath('/unknown/deeper/path'), '/*');
   // Public marketing pages are kept as-is, locale prefix included.
   assert.equal(safeLandingPath('/'), '/');
   assert.equal(safeLandingPath('/zh'), '/zh');
@@ -122,7 +124,7 @@ test('over-long utm values are dropped, not truncated', () => {
 
 test('trackEvent attaches attribution only to the pre-signup funnel events', async () => {
   const sent = [];
-  global.window = { location: { pathname: '/', href: 'https://www.doctalk.site/' } };
+  global.window = { location: { pathname: '/d/182c1d7b-29df-4600-add2-420384c725a4', href: 'https://www.doctalk.site/' } };
   global.fetch = (_url, init) => {
     sent.push(JSON.parse(init.body));
     return Promise.resolve();
@@ -130,6 +132,7 @@ test('trackEvent attaches attribution only to the pre-signup funnel events', asy
   const attribution = {
     ATTRIBUTED_EVENTS: new Set(['landing_cta_clicked', 'auth_modal_opened', 'auth_provider_clicked']),
     getAttribution: () => ({ ref_host: 'chatgpt.com', utm_source: 'chatgpt.com', landing_path: '/' }),
+    safeLandingPath: (p) => (p.startsWith('/d/') ? '/d/*' : p),
   };
   const { trackEvent } = loadTs('../src/lib/analytics.ts', { './attribution': attribution });
   try {
@@ -142,7 +145,10 @@ test('trackEvent attaches attribution only to the pre-signup funnel events', asy
   }
   assert.equal(sent[0].properties.ref_host, 'chatgpt.com');
   assert.equal(sent[0].properties.cta, 'hero');
+  assert.equal(sent[0].properties.path, '/d/*');
   assert.equal(sent[1].properties.ref_host, undefined);
+  // Non-funnel events keep their raw path (authenticated product analytics, unchanged).
+  assert.equal(sent[1].properties.path, '/d/182c1d7b-29df-4600-add2-420384c725a4');
   // Caller-supplied params win over captured attribution.
   assert.equal(sent[2].properties.ref_host, 'explicit.example');
 });
```
