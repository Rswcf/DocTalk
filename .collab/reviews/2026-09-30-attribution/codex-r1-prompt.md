# Codex adversarial review — un-gated first-touch attribution (DocTalk, 2026-09-30)

You are reviewing a small frontend change. Be adversarial: find real bugs, privacy/compliance problems, and ways the data could be wrong. Do NOT run git (your sandbox cannot); the full diff is below. You may read any file in the repo (cwd is the repo root; frontend/ is the Next.js 14 App Router app).

## Why
GA4 + Vercel Analytics load only after cookie consent (frontend/src/components/AnalyticsWrapper.tsx), so the owner cannot see where arrivals come from. The funnel events (landing_cta_clicked, auth_modal_opened, auth_provider_clicked) already POST to /api/proxy/api/events without consent (frontend/src/lib/analytics.ts → backend/app/api/events.py, PUBLIC_EVENTS, _safe_properties ≤20 keys, strings ≤256) and land in product_events.metadata_json. The change adds referrer host + utm_* + landing path to those three events.

## Design constraints (decided)
- No cookies, no localStorage/sessionStorage, no identifiers; module memory only (first touch per full page load).
- Our own hosts and sign-in hops (accounts.google.com, login.microsoftonline.com, login.live.com) are not sources.
- Backend unchanged.
- Privacy page paragraph updated in all 11 locales.

## Review checklist
1. Correctness: is first touch really captured before client navigation on every route (side-effect import in AnalyticsWrapper, which the root layout imports)? Any SSR/hydration hazard from module-level `window` access? Any case where `document.referrer` is our own page after an App Router navigation (it should not be — confirm)? Vercel preview hosts?
2. Data quality: what referrers will be wrong or misleading (e.g. Stripe return, magic-link email clients, t.co, android-app://, ChatGPT app with no referrer, `utm_source=chatgpt.com` only)? Anything that should also be ignored?
3. Privacy/compliance (EU owner, GDPR/ePrivacy): is sending referrer hostname + utm tags + path to our own first-party endpoint without consent defensible given nothing is stored on the device? Is the privacy sentence accurate and sufficient? Any key that could carry personal data (e.g. utm_campaign containing an email, landing_path containing a document id or token such as /d/<uuid> or /shared/<token>)? If so, propose a concrete mitigation.
4. Tests: do frontend/tests/attribution.test.cjs cover the risky paths? What is missing?
5. Anything else that would make this unsafe to ship.

Output: a numbered list of findings with severity (BLOCKER / SHOULD / NIT), file:line, and a concrete fix. End with a one-line verdict: SHIP / SHIP-WITH-FIXES / REWORK.

## Diff
```diff
diff --git a/frontend/src/components/AnalyticsWrapper.tsx b/frontend/src/components/AnalyticsWrapper.tsx
index 50c6476d..cbd59c3b 100644
--- a/frontend/src/components/AnalyticsWrapper.tsx
+++ b/frontend/src/components/AnalyticsWrapper.tsx
@@ -3,6 +3,10 @@
 import { useState, useEffect } from 'react';
 import Script from 'next/script';
 import { Analytics } from '@vercel/analytics/react';
+// Side-effect import: records first-touch referrer/utm on every route's first
+// load, before any client navigation. Independent of the consent gate below;
+// it stores nothing in the browser (see lib/attribution.ts).
+import '../lib/attribution';
 
 const CONSENT_KEY = 'doctalk_analytics_consent';
 // Must match the hard-coded ID inside frontend/public/ga-init.js. If you
diff --git a/frontend/src/i18n/locales/ar.json b/frontend/src/i18n/locales/ar.json
index 53e9585b..2275c3a0 100644
--- a/frontend/src/i18n/locales/ar.json
+++ b/frontend/src/i18n/locales/ar.json
@@ -245,7 +245,7 @@
   "privacy.ccpa.content": "نحن لا نبيع المعلومات الشخصية. يمكن لسكان كاليفورنيا التواصل عبر privacy@doctalk.site لطلب الوصول أو الحذف أو التصحيح أو معلومات إلغاء الاشتراك.",
   "privacy.noTraining": "لا تدرب DocTalk النماذج على بياناتك",
   "privacy.policyLink": "سياسة الخصوصية",
-  "privacy.section1.content": "نجمع عنوان بريدك الإلكتروني للمصادقة والمستندات التي ترفعها للتحليل.",
+  "privacy.section1.content": "نجمع عنوان بريدك الإلكتروني للمصادقة والمستندات التي ترفعها للتحليل. عند النقر على زر التسجيل أو تسجيل الدخول، نسجّل أيضًا نطاق الموقع الذي أحالك إلينا ووسوم الحملة الموجودة في الرابط (مثل utm_source)، لنعرف كيف يصل الناس إلى DocTalk. لا يستخدم ذلك ملفات تعريف الارتباط ولا أي معرّفات.",
   "privacy.section1.title": "جمع البيانات",
   "privacy.section2.item1": "لا تدرب DocTalk النماذج على بياناتك",
   "privacy.section2.item2": "تُعالج المستندات لتوفير ميزات المستندات التي تطلبها.",
diff --git a/frontend/src/i18n/locales/de.json b/frontend/src/i18n/locales/de.json
index c8012a9b..f9f39df2 100644
--- a/frontend/src/i18n/locales/de.json
+++ b/frontend/src/i18n/locales/de.json
@@ -216,7 +216,7 @@
   "auth.privacyNote": "Wir verwenden Ihre Dokumente nicht zum Training von KI-Modellen",
   "privacy.title": "Datenschutzrichtlinie",
   "privacy.section1.title": "Datenerhebung",
-  "privacy.section1.content": "Wir erheben Ihre E-Mail-Adresse zur Authentifizierung und die von Ihnen hochgeladenen Dokumente zur Analyse.",
+  "privacy.section1.content": "Wir erheben Ihre E-Mail-Adresse zur Authentifizierung und die von Ihnen hochgeladenen Dokumente zur Analyse. Wenn du auf eine Schaltfläche zum Registrieren oder Anmelden klickst, speichern wir außerdem die Domain der Website, von der du gekommen bist, sowie Kampagnen-Tags im Link (zum Beispiel utm_source), damit wir sehen, wie Menschen DocTalk finden. Dabei werden keine Cookies und keine Kennungen verwendet.",
   "privacy.section2.title": "Datennutzung",
   "privacy.section2.item1": "DocTalk trainiert keine Modelle mit Ihren Daten",
   "privacy.section2.item2": "Dokumente werden für die von Ihnen angeforderten Dokumentfunktionen verarbeitet.",
diff --git a/frontend/src/i18n/locales/en.json b/frontend/src/i18n/locales/en.json
index 797d87da..4679ea77 100644
--- a/frontend/src/i18n/locales/en.json
+++ b/frontend/src/i18n/locales/en.json
@@ -217,7 +217,7 @@
   "auth.privacyNote": "We don't use your documents to train AI models",
   "privacy.title": "Privacy Policy",
   "privacy.section1.title": "Data Collection",
-  "privacy.section1.content": "We collect your email address for authentication and the documents you upload for analysis.",
+  "privacy.section1.content": "We collect your email address for authentication and the documents you upload for analysis. When you click a sign-up or sign-in button, we also record the domain of the website that referred you and any campaign tags in the link (for example utm_source), so we can see how people find DocTalk. This uses no cookies and no identifiers.",
   "privacy.section2.title": "Data Usage",
   "privacy.section2.item1": "DocTalk does not train models on your data",
   "privacy.section2.item2": "Documents are processed to provide the document features you request.",
diff --git a/frontend/src/i18n/locales/es.json b/frontend/src/i18n/locales/es.json
index 735cd448..45eb6aff 100644
--- a/frontend/src/i18n/locales/es.json
+++ b/frontend/src/i18n/locales/es.json
@@ -266,7 +266,7 @@
   "privacy.ccpa.content": "No vendemos información personal. Los residentes de California pueden contactar a privacy@doctalk.site para solicitar acceso, eliminación, corrección o información de exclusión.",
   "privacy.noTraining": "DocTalk no entrena modelos con sus datos",
   "privacy.policyLink": "Política de privacidad",
-  "privacy.section1.content": "Recopilamos tu dirección de correo electrónico para la autenticación y los documentos que subes para su análisis.",
+  "privacy.section1.content": "Recopilamos tu dirección de correo electrónico para la autenticación y los documentos que subes para su análisis. Cuando haces clic en un botón de registro o inicio de sesión, también registramos el dominio del sitio web que te remitió y las etiquetas de campaña del enlace (por ejemplo, utm_source), para saber cómo llega la gente a DocTalk. No usa cookies ni identificadores.",
   "privacy.section1.title": "Recopilación de datos",
   "privacy.section2.item1": "DocTalk no entrena modelos con sus datos",
   "privacy.section2.item2": "Los documentos se procesan para ofrecer las funciones documentales que solicita.",
diff --git a/frontend/src/i18n/locales/fr.json b/frontend/src/i18n/locales/fr.json
index e1b49036..5f52d524 100644
--- a/frontend/src/i18n/locales/fr.json
+++ b/frontend/src/i18n/locales/fr.json
@@ -216,7 +216,7 @@
   "auth.privacyNote": "Nous n'utilisons pas vos documents pour entrainer des modeles d'IA",
   "privacy.title": "Politique de confidentialite",
   "privacy.section1.title": "Collecte des donnees",
-  "privacy.section1.content": "Nous collectons votre adresse e-mail pour l'authentification et les documents que vous telechargez pour l'analyse.",
+  "privacy.section1.content": "Nous collectons votre adresse e-mail pour l'authentification et les documents que vous telechargez pour l'analyse. Lorsque vous cliquez sur un bouton d'inscription ou de connexion, nous enregistrons aussi le domaine du site qui vous a redirigé et les balises de campagne du lien (par exemple utm_source), afin de comprendre comment les gens découvrent DocTalk. Aucun cookie ni identifiant n'est utilisé.",
   "privacy.section2.title": "Utilisation des donnees",
   "privacy.section2.item1": "DocTalk n’entraîne pas de modèles avec vos données",
   "privacy.section2.item2": "Les documents sont traités pour fournir les fonctionnalités documentaires que vous demandez.",
diff --git a/frontend/src/i18n/locales/hi.json b/frontend/src/i18n/locales/hi.json
index 9e02cce8..464f342b 100644
--- a/frontend/src/i18n/locales/hi.json
+++ b/frontend/src/i18n/locales/hi.json
@@ -245,7 +245,7 @@
   "privacy.ccpa.content": "हम व्यक्तिगत जानकारी नहीं बेचते। कैलिफ़ोर्निया निवासी पहुंच, हटाने, सुधार या ऑप्ट-आउट जानकारी के लिए privacy@doctalk.site पर संपर्क कर सकते हैं।",
   "privacy.noTraining": "DocTalk आपके डेटा पर मॉडल प्रशिक्षित नहीं करता",
   "privacy.policyLink": "गोपनीयता नीति",
-  "privacy.section1.content": "हम प्रमाणीकरण के लिए आपका ईमेल पता और विश्लेषण के लिए आपके अपलोड किए गए दस्तावेज़ एकत्र करते हैं।",
+  "privacy.section1.content": "हम प्रमाणीकरण के लिए आपका ईमेल पता और विश्लेषण के लिए आपके अपलोड किए गए दस्तावेज़ एकत्र करते हैं। जब आप साइन अप या साइन इन बटन पर क्लिक करते हैं, तो हम उस वेबसाइट का डोमेन भी दर्ज करते हैं जिसने आपको भेजा था, साथ ही लिंक में मौजूद कैंपेन टैग (जैसे utm_source), ताकि यह समझ सकें कि लोग DocTalk तक कैसे पहुँचते हैं। इसमें कुकी या किसी पहचानकर्ता का उपयोग नहीं होता।",
   "privacy.section1.title": "डेटा संग्रह",
   "privacy.section2.item1": "DocTalk आपके डेटा पर मॉडल प्रशिक्षित नहीं करता",
   "privacy.section2.item2": "दस्तावेज़ आपके अनुरोधित दस्तावेज़ फ़ीचर प्रदान करने के लिए संसाधित किए जाते हैं।",
diff --git a/frontend/src/i18n/locales/it.json b/frontend/src/i18n/locales/it.json
index f19e2190..3e1a79a4 100644
--- a/frontend/src/i18n/locales/it.json
+++ b/frontend/src/i18n/locales/it.json
@@ -212,7 +212,7 @@
   "auth.privacyNote": "Non utilizziamo i tuoi documenti per addestrare modelli AI",
   "privacy.title": "Informativa sulla privacy",
   "privacy.section1.title": "Raccolta dati",
-  "privacy.section1.content": "Raccogliamo il tuo indirizzo email per l'autenticazione e i documenti che carichi per l'analisi.",
+  "privacy.section1.content": "Raccogliamo il tuo indirizzo email per l'autenticazione e i documenti che carichi per l'analisi. Quando fai clic su un pulsante di registrazione o di accesso, registriamo anche il dominio del sito che ti ha indirizzato e gli eventuali tag di campagna nel link (ad esempio utm_source), per capire come le persone trovano DocTalk. Non vengono usati cookie né identificatori.",
   "privacy.section2.title": "Utilizzo dei dati",
   "privacy.section2.item1": "DocTalk non addestra modelli con i tuoi dati",
   "privacy.section2.item2": "I documenti vengono elaborati per fornire le funzioni documentali che richiedi.",
diff --git a/frontend/src/i18n/locales/ja.json b/frontend/src/i18n/locales/ja.json
index 1e868578..76915455 100644
--- a/frontend/src/i18n/locales/ja.json
+++ b/frontend/src/i18n/locales/ja.json
@@ -212,7 +212,7 @@
   "auth.privacyNote": "あなたのドキュメントをAIモデルの学習に使用することはありません",
   "privacy.title": "プライバシーポリシー",
   "privacy.section1.title": "データ収集",
-  "privacy.section1.content": "認証のためにメールアドレス、分析のためにアップロードされたドキュメントを収集します。",
+  "privacy.section1.content": "認証のためにメールアドレス、分析のためにアップロードされたドキュメントを収集します。 登録またはサインインのボタンをクリックした際に、参照元サイトのドメインとリンク内のキャンペーンタグ（例：utm_source）も記録し、DocTalk がどのように見つけられているかを把握します。Cookie や識別子は使用しません。",
   "privacy.section2.title": "データの使用",
   "privacy.section2.item1": "DocTalk はデータをモデル学習に使用しません",
   "privacy.section2.item2": "文書は、ご利用になる文書機能を提供するために処理されます。",
diff --git a/frontend/src/i18n/locales/ko.json b/frontend/src/i18n/locales/ko.json
index 16cdcd81..c51864b0 100644
--- a/frontend/src/i18n/locales/ko.json
+++ b/frontend/src/i18n/locales/ko.json
@@ -212,7 +212,7 @@
   "auth.privacyNote": "귀하의 문서를 AI 모델 학습에 사용하지 않습니다",
   "privacy.title": "개인정보 보호정책",
   "privacy.section1.title": "데이터 수집",
-  "privacy.section1.content": "인증을 위한 이메일 주소와 분석을 위해 업로드하는 문서를 수집합니다.",
+  "privacy.section1.content": "인증을 위한 이메일 주소와 분석을 위해 업로드하는 문서를 수집합니다. 가입 또는 로그인 버튼을 클릭하면 사용자를 안내한 웹사이트의 도메인과 링크의 캠페인 태그(예: utm_source)도 기록하여 사람들이 DocTalk를 어떻게 찾는지 파악합니다. 쿠키나 식별자는 사용하지 않습니다.",
   "privacy.section2.title": "데이터 사용",
   "privacy.section2.item1": "DocTalk은 데이터를 모델 학습에 사용하지 않습니다",
   "privacy.section2.item2": "문서는 요청하신 문서 기능을 제공하기 위해 처리됩니다.",
diff --git a/frontend/src/i18n/locales/pt.json b/frontend/src/i18n/locales/pt.json
index 12967c9f..d6077c94 100644
--- a/frontend/src/i18n/locales/pt.json
+++ b/frontend/src/i18n/locales/pt.json
@@ -1785,7 +1785,7 @@
   "privacy.ccpa.content": "Não vendemos informações pessoais. Residentes da Califórnia podem contatar privacy@doctalk.site para solicitar acesso, exclusão, correção ou informações de opt-out.",
   "privacy.noTraining": "O DocTalk não treina modelos com seus dados",
   "privacy.policyLink": "Política de privacidade",
-  "privacy.section1.content": "Coletamos seu endereço de e-mail para autenticação e os documentos que você envia para análise.",
+  "privacy.section1.content": "Coletamos seu endereço de e-mail para autenticação e os documentos que você envia para análise. Quando você clica em um botão de cadastro ou login, também registramos o domínio do site que indicou você e as tags de campanha do link (por exemplo, utm_source), para entender como as pessoas encontram o DocTalk. Isso não usa cookies nem identificadores.",
   "privacy.section1.title": "Coleta de dados",
   "privacy.section2.item1": "O DocTalk não treina modelos com seus dados",
   "privacy.section2.item2": "Os documentos são processados para fornecer os recursos documentais que você solicita.",
diff --git a/frontend/src/i18n/locales/zh.json b/frontend/src/i18n/locales/zh.json
index e87e3b1b..ad80f2e3 100644
--- a/frontend/src/i18n/locales/zh.json
+++ b/frontend/src/i18n/locales/zh.json
@@ -217,7 +217,7 @@
   "auth.privacyNote": "我们不使用你的文档训练 AI 模型",
   "privacy.title": "隐私政策",
   "privacy.section1.title": "数据收集",
-  "privacy.section1.content": "我们收集你的邮箱用于身份验证，以及你上传的文档用于分析。",
+  "privacy.section1.content": "我们收集你的邮箱用于身份验证，以及你上传的文档用于分析。 当你点击注册或登录按钮时，我们还会记录把你引荐过来的网站域名以及链接中的推广标签（例如 utm_source），以便了解大家是如何找到 DocTalk 的。这不使用 Cookie，也不使用任何标识符。",
   "privacy.section2.title": "数据使用",
   "privacy.section2.item1": "DocTalk 不使用您的数据训练模型",
   "privacy.section2.item2": "文档用于提供您请求的文档功能。",
diff --git a/frontend/src/lib/analytics.ts b/frontend/src/lib/analytics.ts
index 18751b6f..1cb55a3b 100644
--- a/frontend/src/lib/analytics.ts
+++ b/frontend/src/lib/analytics.ts
@@ -1,3 +1,5 @@
+import { ATTRIBUTED_EVENTS, getAttribution } from './attribution';
+
 type EventParams = Record<string, string | number | boolean | null | undefined>;
 
 declare global {
@@ -11,6 +13,7 @@ export function trackEvent(eventName: string, params: EventParams = {}) {
   try {
     const safeParams: EventParams = {
       path: window.location.pathname,
+      ...(ATTRIBUTED_EVENTS.has(eventName) ? getAttribution() : {}),
       ...params,
     };
     window.gtag?.('event', eventName, safeParams);
diff --git a/frontend/src/lib/attribution.ts b/frontend/src/lib/attribution.ts
new file mode 100644
index 00000000..e6348dfa
--- /dev/null
+++ b/frontend/src/lib/attribution.ts
@@ -0,0 +1,99 @@
+// First-touch attribution that does not depend on cookie consent.
+//
+// GA4 and Vercel Analytics load only after the visitor accepts cookies
+// (AnalyticsWrapper), so the 2026-09-30 audit could not tell a real arrivals
+// drop from a capture drop. This records where the visit came from — the
+// referring site's hostname and any utm_* tags — and attaches it to the
+// funnel events in lib/analytics.ts, which go to our own /api/events.
+//
+// It keeps the values in module memory only: nothing is written to cookies,
+// localStorage or sessionStorage, and nothing identifies the visitor. Module
+// memory survives App Router client navigation and is reset by a full page
+// load, which is what "first touch of this visit" should mean.
+
+export type Attribution = {
+  ref_host?: string;
+  utm_source?: string;
+  utm_medium?: string;
+  utm_campaign?: string;
+  landing_path?: string;
+};
+
+// Events that carry attribution. Only the pre-signup funnel needs it.
+export const ATTRIBUTED_EVENTS = new Set([
+  'landing_cta_clicked',
+  'auth_modal_opened',
+  'auth_provider_clicked',
+]);
+
+// Referrers that are our own hosts or an auth hop, not a traffic source.
+// A sign-in round trip reloads the page with the provider as referrer.
+const IGNORED_REFERRER_HOSTS = new Set([
+  'accounts.google.com',
+  'login.microsoftonline.com',
+  'login.live.com',
+]);
+
+const MAX_LEN = 64;
+
+let captured: Attribution | null = null;
+
+function clean(value: string | null | undefined): string | undefined {
+  if (!value) return undefined;
+  const trimmed = value.trim().slice(0, MAX_LEN);
+  return trimmed || undefined;
+}
+
+export function referrerHost(referrer: string, currentHost: string): string | undefined {
+  if (!referrer) return undefined;
+  let host: string;
+  try {
+    host = new URL(referrer).hostname.toLowerCase();
+  } catch {
+    return undefined;
+  }
+  const bare = (h: string) => h.replace(/^www\./, '');
+  if (!host || bare(host) === bare(currentHost.toLowerCase())) return undefined;
+  if (IGNORED_REFERRER_HOSTS.has(host)) return undefined;
+  return clean(host);
+}
+
+export function readAttribution(
+  referrer: string,
+  href: string,
+): Attribution {
+  let url: URL;
+  try {
+    url = new URL(href);
+  } catch {
+    return {};
+  }
+  const params = url.searchParams;
+  const result: Attribution = {
+    ref_host: referrerHost(referrer, url.hostname),
+    utm_source: clean(params.get('utm_source')),
+    utm_medium: clean(params.get('utm_medium')),
+    utm_campaign: clean(params.get('utm_campaign')),
+    landing_path: clean(url.pathname),
+  };
+  for (const key of Object.keys(result) as (keyof Attribution)[]) {
+    if (result[key] === undefined) delete result[key];
+  }
+  return result;
+}
+
+export function getAttribution(): Attribution {
+  if (typeof window === 'undefined') return {};
+  if (captured === null) {
+    try {
+      captured = readAttribution(document.referrer, window.location.href);
+    } catch {
+      captured = {};
+    }
+  }
+  return captured;
+}
+
+// Capture as early as the module is evaluated in the browser, so a later
+// client-side navigation cannot change landing_path or drop the utm tags.
+if (typeof window !== 'undefined') getAttribution();
diff --git a/frontend/tests/attribution.test.cjs b/frontend/tests/attribution.test.cjs
new file mode 100644
index 00000000..2e30267c
--- /dev/null
+++ b/frontend/tests/attribution.test.cjs
@@ -0,0 +1,83 @@
+const assert = require('node:assert/strict');
+const fs = require('node:fs');
+const path = require('node:path');
+const Module = require('node:module');
+const test = require('node:test');
+const ts = require('typescript');
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
+const { readAttribution, referrerHost } = loadTs('../src/lib/attribution.ts');
+
+test('ChatGPT referral with utm tags is captured as first touch', () => {
+  assert.deepEqual(
+    readAttribution(
+      'https://chatgpt.com/',
+      'https://www.doctalk.site/blog/chatpdf-alternatives-2026?utm_source=chatgpt.com',
+    ),
+    {
+      ref_host: 'chatgpt.com',
+      utm_source: 'chatgpt.com',
+      landing_path: '/blog/chatpdf-alternatives-2026',
+    },
+  );
+});
+
+test('own hosts and sign-in hops are not a traffic source', () => {
+  assert.equal(referrerHost('https://www.doctalk.site/pricing', 'www.doctalk.site'), undefined);
+  assert.equal(referrerHost('https://doctalk.site/', 'www.doctalk.site'), undefined);
+  assert.equal(referrerHost('https://accounts.google.com/', 'www.doctalk.site'), undefined);
+  assert.equal(referrerHost('https://login.microsoftonline.com/x', 'www.doctalk.site'), undefined);
+  assert.equal(referrerHost('https://www.perplexity.ai/search/1', 'www.doctalk.site'), 'www.perplexity.ai');
+});
+
+test('empty or malformed input yields no keys, never throws', () => {
+  assert.deepEqual(readAttribution('', 'https://www.doctalk.site/'), { landing_path: '/' });
+  assert.deepEqual(readAttribution('not a url', 'also not a url'), {});
+});
+
+test('values are capped at 64 characters', () => {
+  const long = 'x'.repeat(200);
+  const out = readAttribution('', `https://www.doctalk.site/?utm_campaign=${long}`);
+  assert.equal(out.utm_campaign.length, 64);
+});
+
+test('trackEvent attaches attribution only to the pre-signup funnel events', async () => {
+  const sent = [];
+  global.window = { location: { pathname: '/', href: 'https://www.doctalk.site/' } };
+  global.fetch = (_url, init) => {
+    sent.push(JSON.parse(init.body));
+    return Promise.resolve();
+  };
+  const attribution = {
+    ATTRIBUTED_EVENTS: new Set(['landing_cta_clicked', 'auth_modal_opened', 'auth_provider_clicked']),
+    getAttribution: () => ({ ref_host: 'chatgpt.com', utm_source: 'chatgpt.com', landing_path: '/' }),
+  };
+  const { trackEvent } = loadTs('../src/lib/analytics.ts', { './attribution': attribution });
+  try {
+    trackEvent('landing_cta_clicked', { cta: 'hero' });
+    trackEvent('paywall_opened', { reason: 'limit' });
+    trackEvent('auth_provider_clicked', { ref_host: 'explicit.example' });
+  } finally {
+    delete global.window;
+    delete global.fetch;
+  }
+  assert.equal(sent[0].properties.ref_host, 'chatgpt.com');
+  assert.equal(sent[0].properties.cta, 'hero');
+  assert.equal(sent[1].properties.ref_host, undefined);
+  // Caller-supplied params win over captured attribution.
+  assert.equal(sent[2].properties.ref_host, 'explicit.example');
+});
```
