# Codex adversarial review — round 2 (DocTalk un-gated attribution)

Round 1 (your review, verdict REWORK) is at .collab/reviews/2026-09-30-attribution/codex-r1-output.md (read the final "codex" section). The fix commit's diff is below. Do NOT run git. Re-review:
1. Is each of your 6 findings actually fixed? Say FIXED / PARTIAL / NOT FIXED per item with evidence (file:line).
2. Any new problem introduced by the fix (regex bypasses in safeLandingPath / safeUtm, public paths you think are wrongly kept or wrongly collapsed, referrer ignore list gaps that matter, test gaps, privacy copy accuracy vs. what the code does in all 11 locales — frontend/src/i18n/locales/*.json key "privacy.section1.content").
3. Verdict line: SHIP / SHIP-WITH-FIXES / REWORK.
Keep it short: only real issues.

## Fix diff
```diff
diff --git a/frontend/src/app/privacy/PrivacyPageClient.tsx b/frontend/src/app/privacy/PrivacyPageClient.tsx
index cd0b1cd4..ce1bf3da 100644
--- a/frontend/src/app/privacy/PrivacyPageClient.tsx
+++ b/frontend/src/app/privacy/PrivacyPageClient.tsx
@@ -24,7 +24,7 @@ export default function PrivacyPageClient() {
         lede={tOr('privacy.controller.intro', 'The controller responsible for the processing of personal data on this website is:')}
         meta={
           <p className="ed-caption">
-            {t('privacy.lastUpdated')}: 2026-09-13
+            {t('privacy.lastUpdated')}: 2026-09-30
           </p>
         }
       />
diff --git a/frontend/src/i18n/locales/de.json b/frontend/src/i18n/locales/de.json
index f9f39df2..285bcd87 100644
--- a/frontend/src/i18n/locales/de.json
+++ b/frontend/src/i18n/locales/de.json
@@ -216,7 +216,7 @@
   "auth.privacyNote": "Wir verwenden Ihre Dokumente nicht zum Training von KI-Modellen",
   "privacy.title": "Datenschutzrichtlinie",
   "privacy.section1.title": "Datenerhebung",
-  "privacy.section1.content": "Wir erheben Ihre E-Mail-Adresse zur Authentifizierung und die von Ihnen hochgeladenen Dokumente zur Analyse. Wenn du auf eine Schaltfläche zum Registrieren oder Anmelden klickst, speichern wir außerdem die Domain der Website, von der du gekommen bist, sowie Kampagnen-Tags im Link (zum Beispiel utm_source), damit wir sehen, wie Menschen DocTalk finden. Dabei werden keine Cookies und keine Kennungen verwendet.",
+  "privacy.section1.content": "Wir erheben Ihre E-Mail-Adresse zur Authentifizierung und die von Ihnen hochgeladenen Dokumente zur Analyse. Wenn du vor der Registrierung wichtige Schaltflächen nutzt (etwa Registrieren, Anmelden oder die Demo testen), speichern wir außerdem die Domain der Website, von der du gekommen bist, Kampagnen-Tags im Link (zum Beispiel utm_source) und die Art der Seite, auf der du angekommen bist, damit wir sehen, wie Menschen DocTalk finden. Dabei werden keine Cookies gesetzt und keine Gerätekennung erzeugt; wenn du angemeldet bist, werden diese Ereignisse wie unsere anderen Produktereignisse mit deinem Konto verknüpft.",
   "privacy.section2.title": "Datennutzung",
   "privacy.section2.item1": "DocTalk trainiert keine Modelle mit Ihren Daten",
   "privacy.section2.item2": "Dokumente werden für die von Ihnen angeforderten Dokumentfunktionen verarbeitet.",
diff --git a/frontend/src/i18n/locales/en.json b/frontend/src/i18n/locales/en.json
index 4679ea77..5eb9ff6b 100644
--- a/frontend/src/i18n/locales/en.json
+++ b/frontend/src/i18n/locales/en.json
@@ -217,7 +217,7 @@
   "auth.privacyNote": "We don't use your documents to train AI models",
   "privacy.title": "Privacy Policy",
   "privacy.section1.title": "Data Collection",
-  "privacy.section1.content": "We collect your email address for authentication and the documents you upload for analysis. When you click a sign-up or sign-in button, we also record the domain of the website that referred you and any campaign tags in the link (for example utm_source), so we can see how people find DocTalk. This uses no cookies and no identifiers.",
+  "privacy.section1.content": "We collect your email address for authentication and the documents you upload for analysis. When you use key buttons before signing up (such as sign up, sign in or try the demo), we also record the domain of the website that referred you, any campaign tags in the link (for example utm_source) and which kind of page you arrived on, so we can see how people find DocTalk. This sets no cookies and creates no device identifier; if you are signed in, these events are linked to your account, like our other product events.",
   "privacy.section2.title": "Data Usage",
   "privacy.section2.item1": "DocTalk does not train models on your data",
   "privacy.section2.item2": "Documents are processed to provide the document features you request.",
diff --git a/frontend/src/i18n/locales/zh.json b/frontend/src/i18n/locales/zh.json
index ad80f2e3..130d7616 100644
--- a/frontend/src/i18n/locales/zh.json
+++ b/frontend/src/i18n/locales/zh.json
@@ -217,7 +217,7 @@
   "auth.privacyNote": "我们不使用你的文档训练 AI 模型",
   "privacy.title": "隐私政策",
   "privacy.section1.title": "数据收集",
-  "privacy.section1.content": "我们收集你的邮箱用于身份验证，以及你上传的文档用于分析。 当你点击注册或登录按钮时，我们还会记录把你引荐过来的网站域名以及链接中的推广标签（例如 utm_source），以便了解大家是如何找到 DocTalk 的。这不使用 Cookie，也不使用任何标识符。",
+  "privacy.section1.content": "我们收集你的邮箱用于身份验证，以及你上传的文档用于分析。 当你在注册前使用关键按钮（例如注册、登录或试用演示）时，我们还会记录把你引荐过来的网站域名、链接中的推广标签（例如 utm_source）以及你最初进入的页面类型，以便了解大家是如何找到 DocTalk 的。这不会设置 Cookie，也不会生成设备标识符；如果你已登录，这些事件会像我们的其他产品事件一样与你的账号关联。",
   "privacy.section2.title": "数据使用",
   "privacy.section2.item1": "DocTalk 不使用您的数据训练模型",
   "privacy.section2.item2": "文档用于提供您请求的文档功能。",
diff --git a/frontend/src/lib/attribution.ts b/frontend/src/lib/attribution.ts
index e6348dfa..cbcc1f6d 100644
--- a/frontend/src/lib/attribution.ts
+++ b/frontend/src/lib/attribution.ts
@@ -3,13 +3,21 @@
 // GA4 and Vercel Analytics load only after the visitor accepts cookies
 // (AnalyticsWrapper), so the 2026-09-30 audit could not tell a real arrivals
 // drop from a capture drop. This records where the visit came from — the
-// referring site's hostname and any utm_* tags — and attaches it to the
-// funnel events in lib/analytics.ts, which go to our own /api/events.
+// referring site's hostname, any utm_* tags and the kind of page the visit
+// landed on — and attaches it to the pre-signup funnel events in
+// lib/analytics.ts, which go to our own /api/events.
 //
 // It keeps the values in module memory only: nothing is written to cookies,
-// localStorage or sessionStorage, and nothing identifies the visitor. Module
+// localStorage or sessionStorage, and no device identifier is created. Module
 // memory survives App Router client navigation and is reset by a full page
-// load, which is what "first touch of this visit" should mean.
+// load, which is what "first touch of this visit" should mean. (Events from a
+// signed-in visitor carry their user_id, like every other product event; the
+// privacy page says so.)
+//
+// Every value is sanitized so it cannot carry personal data: the landing path
+// is kept only for public marketing routes and collapsed to its route pattern
+// otherwise (no document ids or share tokens), and utm values must be short
+// slug-like tokens (no emails, long digit runs or path/query characters).
 
 export type Attribution = {
   ref_host?: string;
@@ -26,42 +34,91 @@ export const ATTRIBUTED_EVENTS = new Set([
   'auth_provider_clicked',
 ]);
 
-// Referrers that are our own hosts or an auth hop, not a traffic source.
-// A sign-in round trip reloads the page with the provider as referrer.
+// Hops that bring a visitor back rather than send one: sign-in providers,
+// payment return pages and webmail (magic-link emails).
 const IGNORED_REFERRER_HOSTS = new Set([
   'accounts.google.com',
+  'accounts.youtube.com',
   'login.microsoftonline.com',
+  'login.microsoft.com',
   'login.live.com',
+  'checkout.stripe.com',
+  'billing.stripe.com',
+  'mail.google.com',
+  'outlook.live.com',
+  'outlook.office.com',
+  'outlook.office365.com',
+  'mail.yahoo.com',
+  'mail.proton.me',
+  'mail.qq.com',
+  'mail.163.com',
 ]);
 
+const OWN_DOMAIN = 'doctalk.site';
+const URL_LOCALE = '(?:zh|ja|es|ko|de|fr|pt|it|ar|hi)';
+const SLUG = '[a-z0-9-]{1,80}';
+
+// Public marketing routes whose path is safe to keep as-is.
+const PUBLIC_PATH = new RegExp(
+  `^(?:/${URL_LOCALE})?(?:/|` +
+    `/(?:use-cases|compare|alternatives|features|tools)(?:/${SLUG})?|` +
+    `/blog(?:/category)?(?:/${SLUG})?|` +
+    `/demo(?:/${SLUG})?|` +
+    `/(?:pricing|trust|about|contact|imprint|privacy|terms))$`,
+);
+
 const MAX_LEN = 64;
+const SAFE_TOKEN = /^[a-z0-9][a-z0-9._-]{0,63}$/;
 
 let captured: Attribution | null = null;
 
-function clean(value: string | null | undefined): string | undefined {
-  if (!value) return undefined;
-  const trimmed = value.trim().slice(0, MAX_LEN);
-  return trimmed || undefined;
+function isOwnHost(host: string): boolean {
+  if (host === OWN_DOMAIN || host.endsWith(`.${OWN_DOMAIN}`)) return true;
+  // Vercel preview deployments of this project.
+  return host.endsWith('.vercel.app') && host.includes('doctalk');
 }
 
 export function referrerHost(referrer: string, currentHost: string): string | undefined {
   if (!referrer) return undefined;
-  let host: string;
+  let url: URL;
   try {
-    host = new URL(referrer).hostname.toLowerCase();
+    url = new URL(referrer);
   } catch {
     return undefined;
   }
+  if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
+  const host = url.hostname.toLowerCase();
+  if (!host || host.length > MAX_LEN) return undefined;
   const bare = (h: string) => h.replace(/^www\./, '');
-  if (!host || bare(host) === bare(currentHost.toLowerCase())) return undefined;
+  if (bare(host) === bare(currentHost.toLowerCase()) || isOwnHost(host)) return undefined;
   if (IGNORED_REFERRER_HOSTS.has(host)) return undefined;
-  return clean(host);
+  return host;
+}
+
+// A utm value survives only if it is a short slug-like token. Anything that
+// could be personal (an email, a phone or account number, a UUID-style id) or
+// that looks like a path/query is dropped rather than stored.
+export function safeUtm(value: string | null | undefined): string | undefined {
+  if (!value) return undefined;
+  const v = value.trim().toLowerCase();
+  if (!SAFE_TOKEN.test(v)) return undefined;
+  if (/\d{6,}/.test(v)) return undefined;
+  if (/[0-9a-f]{16,}/.test(v.replace(/[-_.]/g, ''))) return undefined;
+  return v;
+}
+
+// Public marketing paths are kept; anything else collapses to its first
+// segment plus "/*", so /d/<document-id> becomes "/d/*" and
+// /shared/<token> becomes "/shared/*".
+export function safeLandingPath(pathname: string): string | undefined {
+  const p = pathname.toLowerCase().replace(/\/+$/, '') || '/';
+  if (PUBLIC_PATH.test(p)) return p;
+  const first = p.split('/')[1];
+  if (!first || !/^[a-z0-9-]{1,40}$/.test(first)) return '/*';
+  return p.split('/').length > 2 ? `/${first}/*` : `/${first}`;
 }
 
-export function readAttribution(
-  referrer: string,
-  href: string,
-): Attribution {
+export function readAttribution(referrer: string, href: string): Attribution {
   let url: URL;
   try {
     url = new URL(href);
@@ -71,10 +128,10 @@ export function readAttribution(
   const params = url.searchParams;
   const result: Attribution = {
     ref_host: referrerHost(referrer, url.hostname),
-    utm_source: clean(params.get('utm_source')),
-    utm_medium: clean(params.get('utm_medium')),
-    utm_campaign: clean(params.get('utm_campaign')),
-    landing_path: clean(url.pathname),
+    utm_source: safeUtm(params.get('utm_source')),
+    utm_medium: safeUtm(params.get('utm_medium')),
+    utm_campaign: safeUtm(params.get('utm_campaign')),
+    landing_path: safeLandingPath(url.pathname),
   };
   for (const key of Object.keys(result) as (keyof Attribution)[]) {
     if (result[key] === undefined) delete result[key];
diff --git a/frontend/tests/attribution.test.cjs b/frontend/tests/attribution.test.cjs
index 2e30267c..bdbe8aae 100644
--- a/frontend/tests/attribution.test.cjs
+++ b/frontend/tests/attribution.test.cjs
@@ -20,7 +20,72 @@ function loadTs(relPath, stubs = {}) {
   return mod.exports;
 }
 
-const { readAttribution, referrerHost } = loadTs('../src/lib/attribution.ts');
+const { readAttribution, referrerHost, safeUtm, safeLandingPath } = loadTs('../src/lib/attribution.ts');
+
+test('private and dynamic routes never leak ids or tokens into landing_path', () => {
+  assert.equal(safeLandingPath('/d/182c1d7b-29df-4600-add2-420384c725a4'), '/d/*');
+  assert.equal(safeLandingPath('/shared/abcDEF123tokenXYZ'), '/shared/*');
+  assert.equal(safeLandingPath('/collections/9f0e7c1a-1111-2222-3333-444455556666'), '/collections/*');
+  assert.equal(safeLandingPath('/auth'), '/auth');
+  assert.equal(safeLandingPath('/auth/verify-request/extra'), '/auth/*');
+  assert.equal(safeLandingPath('/profile'), '/profile');
+  assert.equal(safeLandingPath('/%40user%40mail.com'), '/*');
+  // Public marketing pages are kept as-is, locale prefix included.
+  assert.equal(safeLandingPath('/'), '/');
+  assert.equal(safeLandingPath('/zh'), '/zh');
+  assert.equal(safeLandingPath('/es/use-cases/students'), '/es/use-cases/students');
+  assert.equal(safeLandingPath('/blog/chatpdf-alternatives-2026'), '/blog/chatpdf-alternatives-2026');
+  assert.equal(safeLandingPath('/blog/category/guides'), '/blog/category/guides');
+  assert.equal(safeLandingPath('/demo/alphabet-earnings'), '/demo/alphabet-earnings');
+  assert.equal(safeLandingPath('/pricing/'), '/pricing');
+});
+
+test('utm values that could carry personal data are dropped', () => {
+  assert.equal(safeUtm('chatgpt.com'), 'chatgpt.com');
+  assert.equal(safeUtm('Newsletter_Oct'), 'newsletter_oct');
+  assert.equal(safeUtm('jane.doe@example.com'), undefined);
+  assert.equal(safeUtm('+49 151 2345678'), undefined);
+  assert.equal(safeUtm('user-4915123456789'), undefined);
+  assert.equal(safeUtm('9f0e7c1a-1111-2222-3333-444455556666'), undefined);
+  assert.equal(safeUtm('a/b?c=d'), undefined);
+  assert.equal(safeUtm(''), undefined);
+});
+
+test('own subdomains, previews, return hops and non-web referrers are not sources', () => {
+  const here = 'www.doctalk.site';
+  for (const ref of [
+    'https://app.doctalk.site/x',
+    'https://doctalk-liard.vercel.app/',
+    'https://doctalk-git-main-rswcf.vercel.app/pricing',
+    'https://checkout.stripe.com/c/pay/cs_live_x',
+    'https://mail.google.com/mail/u/0/',
+    'https://outlook.live.com/mail/0/',
+    'https://accounts.youtube.com/',
+    'android-app://com.google.android.gm/',
+    'javascript:alert(1)',
+  ]) {
+    assert.equal(referrerHost(ref, here), undefined, ref);
+  }
+  assert.equal(referrerHost('https://some-other.vercel.app/', here), 'some-other.vercel.app');
+});
+
+test('first touch is cached: a later location change does not rewrite it', () => {
+  global.window = { location: { href: 'https://www.doctalk.site/blog/chatpdf-alternatives-2026?utm_source=chatgpt.com' } };
+  global.document = { referrer: 'https://chatgpt.com/' };
+  try {
+    const fresh = loadTs('../src/lib/attribution.ts');
+    global.window.location.href = 'https://www.doctalk.site/pricing';
+    global.document.referrer = '';
+    assert.deepEqual(fresh.getAttribution(), {
+      ref_host: 'chatgpt.com',
+      utm_source: 'chatgpt.com',
+      landing_path: '/blog/chatpdf-alternatives-2026',
+    });
+  } finally {
+    delete global.window;
+    delete global.document;
+  }
+});
 
 test('ChatGPT referral with utm tags is captured as first touch', () => {
   assert.deepEqual(
@@ -49,10 +114,10 @@ test('empty or malformed input yields no keys, never throws', () => {
   assert.deepEqual(readAttribution('not a url', 'also not a url'), {});
 });
 
-test('values are capped at 64 characters', () => {
-  const long = 'x'.repeat(200);
-  const out = readAttribution('', `https://www.doctalk.site/?utm_campaign=${long}`);
-  assert.equal(out.utm_campaign.length, 64);
+test('over-long utm values are dropped, not truncated', () => {
+  const out = readAttribution('', `https://www.doctalk.site/?utm_campaign=${'x'.repeat(200)}&utm_source=${'y'.repeat(64)}`);
+  assert.equal(out.utm_campaign, undefined);
+  assert.equal(out.utm_source, 'y'.repeat(64));
 });
 
 test('trackEvent attaches attribution only to the pre-signup funnel events', async () => {
```

(The other 8 locale files changed the same key the same way; read them from disk.)
