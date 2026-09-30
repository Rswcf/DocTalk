# Codex adversarial review — DocTalk frontend Release A (release/2026-10-02-frontend)

Do NOT run git (sandbox). The diff below is release/2026-10-02-frontend vs origin/main, EXCLUDING the attribution change (reviewed separately). It merges five built-but-unreviewed branches:
- growth/students-academic — deeper /use-cases/students (verified-quotes section, 11 locales), zh/es academic search titles.
- fix/free-credit-copy — locale home FAQs (also the FAQPage JSON-LD) wrongly said 500 credits/month; real: 500 one-time starter pool in month one, then 300/month.
- fix/locale-numeric-drift — translated copy claimed "three modes" (real: two, Flash and Pro), wrong alternatives counts in pt titles, invented "join thousands of professionals" on 8 locale homes, zh demo FAQ "3 documents/month".
- fix/arabic-reader-rtl — live crash in the Arabic reader: resizable panel group laid out LTR.
- fix/locale-quality-followups — German aria labels with placeholders, pt compare pages translation, a retired tour removed.
One merge conflict was resolved by hand in zh.json: featuresPerformance.whenToUse.quick takes the version WITHOUT a leading "Flash" because PerformanceModesContent.tsx renders <strong>{mode name}</strong> before it.
Project rules to check against: .claude/rules/frontend.md (i18n must hit all 11 locales; marketing copy honesty; SEO meta keys; JSON-LD rules; layout translation must not promise perfect output) and CLAUDE.md.

Review for: factual errors in copy vs. the real product rules (free = 300 credits/month + 500 one-time signup pool; Plus 3K $9.99; Pro 9K $19.99; two modes Flash/Pro; page caps Free 750 / Plus 1500 / Pro 3000), any locale left inconsistent, broken placeholders/interpolation, JSON-LD or SEO-title regressions, the RTL fix's correctness and side effects, test gaps. Output numbered findings with severity (BLOCKER / SHOULD / NIT), file:line, fix; final line verdict SHIP / SHIP-WITH-FIXES / REWORK. Only real issues.

## Diff
```diff
diff --git a/frontend/public/llms.txt b/frontend/public/llms.txt
index 6a0eaa4c..f0626fa4 100644
--- a/frontend/public/llms.txt
+++ b/frontend/public/llms.txt
@@ -10,6 +10,10 @@
 - [Multi-Format Support](https://www.doctalk.site/features/multi-format)
 - [Multilingual (11 Languages)](https://www.doctalk.site/features/multilingual)
 - [Free Demo (No Signup)](https://www.doctalk.site/demo)
+- [Free Demo: How It Works](https://www.doctalk.site/features/free-demo)
+- [Performance Modes (Flash and Pro)](https://www.doctalk.site/features/performance-modes)
+- [Layout-Preserving PDF Translation](https://www.doctalk.site/features/layout-translation)
+- [Trust & Security](https://www.doctalk.site/trust)
 - [Pricing](https://www.doctalk.site/pricing)
 
 ## Use Cases
@@ -68,7 +72,17 @@
 - [NotebookLM Alternatives 2026](https://www.doctalk.site/blog/notebooklm-alternatives-2026)
 - [What Is RAG? How AI Document Chat Works](https://www.doctalk.site/blog/rag-explained-simple)
 
+## Blog Categories
+
+- [Guides](https://www.doctalk.site/blog/category/guides)
+- [Comparisons](https://www.doctalk.site/blog/category/comparisons)
+- [Use Cases](https://www.doctalk.site/blog/category/use-cases)
+- [Product](https://www.doctalk.site/blog/category/product)
+- [AI Insights](https://www.doctalk.site/blog/category/ai-insights)
+
 ## About
 
 - [About DocTalk](https://www.doctalk.site/about)
 - [Contact](https://www.doctalk.site/contact)
+- [Privacy Policy](https://www.doctalk.site/privacy)
+- [Terms of Service](https://www.doctalk.site/terms)
diff --git a/frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx b/frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx
index 6269070f..f9e7847d 100644
--- a/frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx
+++ b/frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx
@@ -13,7 +13,7 @@ import { ApiError, createLayoutTranslation, deleteDocument, getChunkDetail, repa
 import { PaywallModal } from '../../../components/PaywallModal';
 import { useDocTalkStore } from '../../../store';
 import { Panel, Group, Separator } from 'react-resizable-panels';
-import { useLocale } from '../../../i18n';
+import { LOCALES, useLocale } from '../../../i18n';
 import { usePageTitle } from '../../../lib/usePageTitle';
 import { AlertTriangle, Download, FileText, LogIn, MessageSquare, Presentation, Quote, RotateCcw, Trash2, X } from 'lucide-react';
 import QuoteFinderPanel from '../../../components/Quotes/QuoteFinderPanel';
@@ -51,6 +51,12 @@ export default function DocumentReaderPageClient() {
   const [mobileTab, setMobileTab] = useState<'chat' | 'document'>('chat');
   const isDesktopLayout = useDesktopReaderLayout();
   const { t, tOr, locale } = useLocale();
+  // react-resizable-panels 4.x has no right-to-left support: under <html dir="rtl"> its layout pass looked up a panel
+  // that does not exist and crashed the Arabic reader. The desktop group lays out left to right; each pane's content
+  // keeps the page direction (tests/reader-rtl-panels.test.cjs). Not mirrored on purpose: the library does not know
+  // direction, so a mirrored group would also invert dragging and the separator's arrow keys. Revisit if a release
+  // adds RTL support (none through 4.13.2).
+  const contentDir = LOCALES.find((l) => l.code === locale)?.dir === 'rtl' ? 'rtl' : 'ltr';
   const { pdfUrl, currentPage, citationTarget, highlights, highlightSnippet, highlightFocus, scale, scrollNonce, sessionId, navigateToCitation, setDocumentStatus, totalPages } = useDocTalkStore();
   const revealChat = useCallback(() => setMobileTab('chat'), []);
   const { capture: captureCitationOrigin, returnToAnswer, canReturn } = useCitationReturn(documentId, sessionId, revealChat);
@@ -624,10 +630,10 @@ export default function DocumentReaderPageClient() {
               </div>
             </div>
           ) : isDesktopLayout ? (
-            <div className="relative flex flex-1 min-h-0 px-2 pb-2 gap-0">
+            <div className="relative flex flex-1 min-h-0 px-2 pb-2 gap-0" dir="ltr">
               <Group orientation="horizontal" className="flex-1 min-h-0">
                 <Panel defaultSize={50} minSize={25}>
-                  <div className="dt-reader-pane h-full min-w-0 sm:min-w-[320px] flex flex-col border rounded-l-xl overflow-hidden">
+                  <div className="dt-reader-pane h-full min-w-0 sm:min-w-[320px] flex flex-col border rounded-l-xl overflow-hidden" dir={contentDir}>
                     <div className="flex-1 min-h-0">
                       {chatContent}
                     </div>
@@ -640,7 +646,7 @@ export default function DocumentReaderPageClient() {
                   <div className="dt-reader-resizer-grip" />
                 </Separator>
                 <Panel defaultSize={50} minSize={35}>
-                  <div className="dt-reader-pane h-full border rounded-r-xl overflow-hidden">
+                  <div className="dt-reader-pane h-full border rounded-r-xl overflow-hidden" dir={contentDir}>
                     {viewerContent}
                   </div>
                 </Panel>
diff --git a/frontend/src/app/features/citations/CitationsContent.tsx b/frontend/src/app/features/citations/CitationsContent.tsx
index 0f995a32..b405ff41 100644
--- a/frontend/src/app/features/citations/CitationsContent.tsx
+++ b/frontend/src/app/features/citations/CitationsContent.tsx
@@ -193,7 +193,7 @@ export default async function CitationsContent({ locale }: { locale: string }) {
             title: u.title,
             body: u.description,
             icon: u.icon,
-            href: u.link,
+            href: href(u.link),
           }))}
         />
       </EdSection>
diff --git a/frontend/src/app/globals.css b/frontend/src/app/globals.css
index aef4ccb1..2dd407f5 100644
--- a/frontend/src/app/globals.css
+++ b/frontend/src/app/globals.css
@@ -231,31 +231,6 @@ h3,
   padding: 1px 0;
 }
 
-/* Onboarding tour (driver.js) */
-.doctalk-tour-popover {
-  --driverjs-bg: #ffffff;
-  --driverjs-color: #18181b;
-  border: 1px solid #e4e4e7;
-  border-radius: 12px;
-  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
-}
-
-.dark .doctalk-tour-popover {
-  --driverjs-bg: #18181b;
-  --driverjs-color: #fafafa;
-  border-color: #3f3f46;
-}
-
-.doctalk-tour-popover .driver-popover-progress-text {
-  color: #71717a;
-}
-
-.doctalk-tour-popover .driver-popover-navigation-btns button {
-  border-radius: 8px;
-  font-size: 0.875rem;
-  padding: 0.375rem 0.75rem;
-}
-
 /* ============================================================
    AI Document Workbench
    ============================================================ */
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
diff --git a/frontend/src/app/sitemap.ts b/frontend/src/app/sitemap.ts
index 2d979412..45d6309d 100644
--- a/frontend/src/app/sitemap.ts
+++ b/frontend/src/app/sitemap.ts
@@ -74,14 +74,23 @@ function absolute(path: string): string {
 }
 
 export default function sitemap(): MetadataRoute.Sitemap {
-  const generatedAt = new Date();
   const posts = getAllPosts();
+  // lastModified is emitted only where it is true: blog posts carry their
+  // frontmatter date, and the blog index / category pages carry the date of
+  // their newest post. Every other entry omits it — a build timestamp on all
+  // 405 URLs told crawlers everything changed on every deploy, which teaches
+  // them to ignore the field (audit 2026-09-30, F-10).
+  const postDate = (post: (typeof posts)[number]) => new Date(post.updated || post.date);
+  const newest = (list: typeof posts) =>
+    list.reduce<Date | undefined>((acc, post) => {
+      const d = postDate(post);
+      return !acc || d > acc ? d : acc;
+    }, undefined);
 
   // English entries for every localized path, derived from LOCALIZED_PATHS so the
   // two lists cannot drift. Each carries the reciprocal hreflang map.
   const localizedEnEntries: MetadataRoute.Sitemap = [...LOCALIZED_PATHS].map((path) => ({
     url: absolute(path),
-    lastModified: generatedAt,
     changeFrequency: "monthly" as ChangeFrequency,
     priority: LOCALIZED_PRIORITY[path] ?? DEFAULT_LOCALIZED_PRIORITY,
     alternates: { languages: languagesFor(path) },
@@ -89,22 +98,22 @@ export default function sitemap(): MetadataRoute.Sitemap {
 
   // Pages that exist only in English (no `app/[locale]` route), so no hreflang.
   const englishOnlyEntries: MetadataRoute.Sitemap = [
-    { url: `${BASE_URL}/blog`, lastModified: generatedAt, changeFrequency: "weekly", priority: 0.8 },
-    { url: `${BASE_URL}/about`, lastModified: generatedAt, changeFrequency: "yearly", priority: 0.5 },
-    { url: `${BASE_URL}/contact`, lastModified: generatedAt, changeFrequency: "yearly", priority: 0.5 },
-    { url: `${BASE_URL}/privacy`, lastModified: generatedAt, changeFrequency: "yearly", priority: 0.3 },
-    { url: `${BASE_URL}/terms`, lastModified: generatedAt, changeFrequency: "yearly", priority: 0.3 },
-    { url: `${BASE_URL}/tools/word-counter`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.6 },
-    { url: `${BASE_URL}/tools/reading-time`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.6 },
+    { url: `${BASE_URL}/blog`, lastModified: newest(posts), changeFrequency: "weekly", priority: 0.8 },
+    { url: `${BASE_URL}/about`, changeFrequency: "yearly", priority: 0.5 },
+    { url: `${BASE_URL}/contact`, changeFrequency: "yearly", priority: 0.5 },
+    { url: `${BASE_URL}/privacy`, changeFrequency: "yearly", priority: 0.3 },
+    { url: `${BASE_URL}/terms`, changeFrequency: "yearly", priority: 0.3 },
+    { url: `${BASE_URL}/tools/word-counter`, changeFrequency: "monthly", priority: 0.6 },
+    { url: `${BASE_URL}/tools/reading-time`, changeFrequency: "monthly", priority: 0.6 },
     ...KNOWN_BLOG_CATEGORIES.map((category) => ({
       url: `${BASE_URL}/blog/category/${category}`,
-      lastModified: generatedAt,
+      lastModified: newest(posts.filter((post) => post.category === category)),
       changeFrequency: "weekly" as ChangeFrequency,
       priority: 0.6,
     })),
     ...posts.map((post) => ({
       url: `${BASE_URL}/blog/${post.slug}`,
-      lastModified: new Date(post.updated || post.date),
+      lastModified: postDate(post),
       changeFrequency: "monthly" as ChangeFrequency,
       priority: 0.7,
     })),
@@ -117,7 +126,6 @@ export default function sitemap(): MetadataRoute.Sitemap {
     for (const loc of URL_LOCALES) {
       localeEntries.push({
         url: `${BASE_URL}${localizedHref(loc, path)}`,
-        lastModified: generatedAt,
         changeFrequency: "monthly",
         priority: 0.7,
         alternates: { languages },
diff --git a/frontend/src/app/use-cases/students/StudentsContent.tsx b/frontend/src/app/use-cases/students/StudentsContent.tsx
index 8710f932..03464b18 100644
--- a/frontend/src/app/use-cases/students/StudentsContent.tsx
+++ b/frontend/src/app/use-cases/students/StudentsContent.tsx
@@ -181,7 +181,17 @@ export default async function StudentsContent({ locale }: { locale: string }) {
         </EdProse>
       </EdSection>
 
-      <EdSection alt title={t('useCasesStudents.multilingual.title')}>
+      {/* The one cohort that has ever retained writes papers and needs the author's words with a page number
+          (plan 2026-09-22-next-strategy §2.2). Copy is per-kind honest: no unconditional word-for-word claim. */}
+      <EdSection alt title={t('useCasesStudents.verifiedQuotes.title')}>
+        <EdProse>
+          <p>{t('useCasesStudents.verifiedQuotes.p1')}</p>
+          <p>{t('useCasesStudents.verifiedQuotes.p2')}</p>
+          <p>{t('useCasesStudents.verifiedQuotes.p3')}</p>
+        </EdProse>
+      </EdSection>
+
+      <EdSection title={t('useCasesStudents.multilingual.title')}>
         <EdProse>
           <p>{t('useCasesStudents.multilingual.p1')}</p>
           <p>
@@ -193,13 +203,13 @@ export default async function StudentsContent({ locale }: { locale: string }) {
         </EdProse>
       </EdSection>
 
-      <EdSection title={t('useCasesStudents.getStarted.title')}>
+      <EdSection alt title={t('useCasesStudents.getStarted.title')}>
         <EdStepRow
           steps={steps.map((s) => ({ title: s.title, body: s.description, icon: s.icon }))}
         />
       </EdSection>
 
-      <EdSection alt title={t('useCasesStudents.faqTitle')}>
+      <EdSection title={t('useCasesStudents.faqTitle')}>
         <EdFaqList items={faqItems} />
       </EdSection>
 
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
index 53e9585b..9268db95 100644
--- a/frontend/src/i18n/locales/ar.json
+++ b/frontend/src/i18n/locales/ar.json
@@ -2,7 +2,7 @@
   "app.subtitle": "قم بتحميل ملف PDF لبدء الدردشة.",
   "app.title": "DocTalk",
   "auth.continueWithGoogle": "المتابعة باستخدام Google",
-  "auth.freeCredits": "يحصل المستخدمون الجدد على 500 رصيد بداية + 300 رصيد شهريًا",
+  "auth.freeCredits": "يحصل المستخدمون الجدد على 500 رصيد بداية، ثم 300 رصيد شهريًا بدءًا من الشهر الثاني",
   "auth.loginBenefits": "سجّل الدخول لرفع المستندات وحفظ المحادثات والمزامنة عبر الأجهزة",
   "auth.loginToContinue": "سجّل الدخول للمتابعة",
   "auth.privacyNote": "نحن لا نستخدم مستنداتك لتدريب نماذج الذكاء الاصطناعي",
@@ -245,7 +245,7 @@
   "privacy.ccpa.content": "نحن لا نبيع المعلومات الشخصية. يمكن لسكان كاليفورنيا التواصل عبر privacy@doctalk.site لطلب الوصول أو الحذف أو التصحيح أو معلومات إلغاء الاشتراك.",
   "privacy.noTraining": "لا تدرب DocTalk النماذج على بياناتك",
   "privacy.policyLink": "سياسة الخصوصية",
-  "privacy.section1.content": "نجمع عنوان بريدك الإلكتروني للمصادقة والمستندات التي ترفعها للتحليل.",
+  "privacy.section1.content": "نجمع عنوان بريدك الإلكتروني للمصادقة والمستندات التي ترفعها للتحليل. عند استخدام الأزرار الرئيسية قبل التسجيل (مثل التسجيل أو تسجيل الدخول أو تجربة العرض التوضيحي)، نسجّل أيضًا نطاق الموقع الذي أحالك إلينا ووسوم الحملة الموجودة في الرابط (مثل utm_source) ونوع الصفحة التي وصلت إليها، لنعرف كيف يصل الناس إلى DocTalk. لا يُنشئ ذلك ملفات تعريف ارتباط ولا أي معرّف للجهاز؛ وإذا كنت مسجّل الدخول، تُربط هذه الأحداث بحسابك مثل أحداث المنتج الأخرى لدينا.",
   "privacy.section1.title": "جمع البيانات",
   "privacy.section2.item1": "لا تدرب DocTalk النماذج على بياناتك",
   "privacy.section2.item2": "تُعالج المستندات لتوفير ميزات المستندات التي تطلبها.",
@@ -401,7 +401,7 @@
   "landing.faq.q6": "هل يمكنه التعامل مع المستندات الطويلة؟",
   "landing.faq.a6": "نعم. حدود الصفحات لكل مستند هي 750 في Free و1,500 في Plus و3,000 في Pro. يحافظ التقسيم الذكي والبحث الدلالي على دقة الإجابات في المستندات الطويلة.",
   "landing.finalCta.title": "مستعد للدردشة مع ملفات PDF الخاصة بك؟",
-  "landing.finalCta.subtitle": "انضم إلى آلاف المحترفين الذين يوفرون ساعات أسبوعيًا مع تحليل المستندات بالذكاء الاصطناعي.",
+  "landing.finalCta.subtitle": "ارفع مستندًا واحصل على أول إجابة موثقة في أقل من دقيقة. لا حاجة لبطاقة ائتمان.",
   "landing.finalCta.demo": "جرب العرض المجاني",
   "landing.finalCta.signUp": "سجل مجانًا",
   "footer.product": "المنتج",
@@ -539,14 +539,6 @@
   "header.win98Mode": "Windows 98",
   "mobile.chatTab": "الدردشة",
   "mobile.documentTab": "المستند",
-  "tour.citation.title": "إجابات مع اقتباسات",
-  "tour.citation.desc": "انقر على أي اقتباس [1] لرؤية المصدر الدقيق مُميَّزًا في مستندك.",
-  "tour.mode.title": "أوضاع أداء الذكاء الاصطناعي",
-  "tour.mode.desc": "سريع للإجابات الفورية، متوازن لمزيد من التفاصيل، شامل للتحليل العميق.",
-  "tour.plus.title": "خيارات إضافية",
-  "tour.plus.desc": "عيّن تعليمات ذكاء اصطناعي مخصصة أو صدّر محادثتك.",
-  "tour.session.title": "جلسات الدردشة",
-  "tour.session.desc": "أنشئ محادثات متعددة لكل مستند لاستكشاف مواضيع مختلفة.",
   "billing.downgrade": "الرجوع إلى",
   "billing.upgradeSuccess": "تمت إضافة {credits} من الأرصدة الإضافية إلى حسابك!",
   "billing.downgradeSuccess": "تم تغيير الخطة بنجاح. تم الاحتفاظ بأرصدتك.",
@@ -708,7 +700,7 @@
   "pricing.free.price": "$0",
   "pricing.free.cadence": "/شهر",
   "pricing.free.summary": "الأفضل لتجربة DocTalk مع مجموعات مستندات صغيرة وسير عمل الدردشة الأساسي بالذكاء الاصطناعي.",
-  "pricing.free.feature1": "300 رصيد كل شهر + 500 رصيد بداية",
+  "pricing.free.feature1": "500 رصيد بداية، ثم 300 رصيد شهريًا بدءًا من الشهر الثاني",
   "pricing.free.feature2": "رفع 50 ميغابايت",
   "pricing.free.feature3": "3 مستندات",
   "pricing.free.feature4": "وضع Flash + أوضاع Pro محدودة",
@@ -2187,6 +2179,10 @@
   "useCasesStudents.citations.p2b": "يحل هذا عن طريق تأسيس كل إجابة من الذكاء الاصطناعي على نص مستندك الفعلي. كل اقتباس مرقم يتوافق مع مقطع معين في ورقتك المرفوعة. انقر على الاقتباس، وسينتقل عارض المستند إلى النص المحدد ويميزه.",
   "useCasesStudents.citations.p3": "هذا يعني أن DocTalk ليس بديلاً عن القراءة. إنه مسرّع. يساعدك في العثور على المقاطع المناسبة بشكل أسرع، وفهم الأقسام المعقدة بسرعة أكبر، والتحقق من كل ادعاء قبل تضمينه في عملك الخاص. يعمل الذكاء الاصطناعي كمساعد بحثي يظهر مصادره دائمًا.",
   "useCasesStudents.citations.p4": "للطلاب المهتمين بالنزاهة الأكاديمية، هذا التمييز بالغ الأهمية. استخدام DocTalk لتحديد وفهم المواد المصدرية في ورقة قمت بالوصول إليها بشكل شرعي لا يختلف عن استخدام وظيفة بحث أو فهرس. الأداة تساعدك في العثور على المعلومات؛ الفهم والتحليل يظلان ملكًا لك.",
+  "useCasesStudents.verifiedQuotes.title": "كلمات المؤلف نفسه، مع أرقام صفحات يمكنك الاستشهاد بها",
+  "useCasesStudents.verifiedQuotes.p1": "عندما تحتاج إلى اقتباس مباشر لا إلى ملخص، استخدم الباحث عن الاقتباسات للعثور على اقتباسات حول موضوع ما. كل اقتباس يعيده تمت مطابقته مع نص مستندك، ويحمل رقم صفحته، ويُنسخ مع استشهاد داخل النص بصيغة APA.",
+  "useCasesStudents.verifiedQuotes.p2": "احفظ الاقتباسات التي تنوي استخدامها. يحتفظ كل اقتباس محفوظ بمصدره وصفحته، فيبقى دليل كل ادعاء في مسودتك على بُعد نقرة واحدة. تتيح الخطة المجانية حفظ ما يصل إلى 30 اقتباسًا.",
+  "useCasesStudents.verifiedQuotes.p3": "عندما تكون طبقة النص في المستند غير مكتملة، كما في ملفات PDF الممسوحة ضوئيًا القديمة حيث قد تكون الواصلات في نهاية الأسطر قد دُمجت، تشير بطاقة الاقتباس إلى ذلك بدلًا من أن تعد بتطابق تام.",
   "useCasesStudents.multilingual.title": "البحث الأكاديمي متعدد اللغات",
   "useCasesStudents.multilingual.p1": "البحث الأكاديمي مسعى عالمي. تُنشر الأوراق الرائدة باللغات الصينية واليابانية والألمانية والإسبانية وعشرات اللغات الأخرى. قد يحتاج باحث يدرس تقنيات التصنيع إلى مراجعة أوراق هندسية يابانية. قد يحلل مؤرخ مصادر أولية باللغة الألمانية. وقد يصادف باحث طبي تجارب سريرية صينية.",
   "useCasesStudents.multilingual.p2a": "يدعم DocTalk ",
diff --git a/frontend/src/i18n/locales/de.json b/frontend/src/i18n/locales/de.json
index c8012a9b..d572a493 100644
--- a/frontend/src/i18n/locales/de.json
+++ b/frontend/src/i18n/locales/de.json
@@ -169,7 +169,7 @@
   "home.cta.demoNow": "Jetzt Beispiel-PDF testen",
   "home.cta.loginUpload": "Anmelden, um Ihr PDF hochzuladen",
   "home.cta.tryDemo": "Demo testen",
-  "auth.freeCredits": "Neue Benutzer erhalten 500 Start-Credits + 300 Credits/Monat",
+  "auth.freeCredits": "Neue Benutzer erhalten 500 Start-Credits, ab dem zweiten Monat 300 Credits pro Monat",
   "billing.title": "Pläne & Abrechnung",
   "billing.purchase": "Kaufen",
   "billing.purchaseSuccess": "Kauf erfolgreich! Credits wurden Ihrem Konto gutgeschrieben.",
@@ -216,7 +216,7 @@
   "auth.privacyNote": "Wir verwenden Ihre Dokumente nicht zum Training von KI-Modellen",
   "privacy.title": "Datenschutzrichtlinie",
   "privacy.section1.title": "Datenerhebung",
-  "privacy.section1.content": "Wir erheben Ihre E-Mail-Adresse zur Authentifizierung und die von Ihnen hochgeladenen Dokumente zur Analyse.",
+  "privacy.section1.content": "Wir erheben Ihre E-Mail-Adresse zur Authentifizierung und die von Ihnen hochgeladenen Dokumente zur Analyse. Wenn du vor der Registrierung wichtige Schaltflächen nutzt (etwa Registrieren, Anmelden oder die Demo testen), speichern wir außerdem die Domain der Website, von der du gekommen bist, Kampagnen-Tags im Link (zum Beispiel utm_source) und die Art der Seite, auf der du angekommen bist, damit wir sehen, wie Menschen DocTalk finden. Dabei werden keine Cookies gesetzt und keine Gerätekennung erzeugt; wenn du angemeldet bist, werden diese Ereignisse wie unsere anderen Produktereignisse mit deinem Konto verknüpft.",
   "privacy.section2.title": "Datennutzung",
   "privacy.section2.item1": "DocTalk trainiert keine Modelle mit Ihren Daten",
   "privacy.section2.item2": "Dokumente werden für die von Ihnen angeforderten Dokumentfunktionen verarbeitet.",
@@ -309,7 +309,7 @@
   "profile.credits.reason.chat_reconcile_refund": "Chat-Nutzung",
   "profile.credits.reason.chat_reconcile_charge": "Chat-Nutzung",
   "profile.credits.reason.refund": "Erstattung",
-  "profile.credits.ariaProgress": "{used} von {total} Credits verwendet",
+  "profile.credits.ariaProgress": "{percent}% der monatlichen Credits verwendet",
   "profile.usage.documents": "Dokumente",
   "profile.usage.sessions": "Chat-Sitzungen",
   "profile.usage.messages": "Nachrichten",
@@ -345,7 +345,7 @@
   "profile.account.exportDesc": "Laden Sie eine Kopie aller Ihrer DocTalk-Daten herunter, einschließlich Profil, Dokumentmetadaten, Gespräche und Credit-Verlauf.",
   "profile.account.exportButton": "Meine Daten herunterladen",
   "profile.account.exporting": "Daten werden vorbereitet...",
-  "profile.account.confirmEmail": "Geben Sie {email} zur Bestätigung ein",
+  "profile.account.confirmEmail": "E-Mail-Adresse bestätigen",
   "userMenu.profile": "Profil",
   "userMenu.buyCredits": "Credits kaufen",
   "userMenu.signOut": "Abmelden",
@@ -406,7 +406,7 @@
   "landing.faq.q4": "Welche KI-Modelle kann ich nutzen?",
   "landing.faq.a4": "DocTalk bietet 2 Leistungsmodi: Flash für schnelle, zitierte Antworten und Pro für tiefere Dokumentanalysen. Kostenlose Benutzer können Flash und eingeschränktes Pro nutzen. Plus entfernt die monatliche Pro-Beschränkung.",
   "landing.faq.q5": "Gibt es einen kostenlosen Plan?",
-  "landing.faq.a5": "Ja! Kostenlose Konten beinhalten 500 Credits monatlich, genug für Dutzende von Fragen. Keine Kreditkarte erforderlich.",
+  "landing.faq.a5": "Ja! Kostenlose Konten beinhalten 300 Credits monatlich, genug für Dutzende von Fragen. Keine Kreditkarte erforderlich.",
   "landing.faq.q6": "Kann es lange Dokumente verarbeiten?",
   "landing.faq.a6": "Ja. Die Seitenlimits pro Dokument sind 750 bei Free, 1.500 bei Plus und 3.000 bei Pro. Intelligentes Chunking und semantische Suche halten Antworten auch bei langen Dokumenten präzise.",
   "landing.finalCta.title": "Schluss mit erneutem Lesen. Fangen Sie an zu fragen.",
@@ -527,7 +527,7 @@
   "chat.responseTruncated": "Antwort wurde abgeschnitten",
   "chat.continuationLimit": "Maximale Fortsetzungen erreicht",
   "chat.scrollToBottom": "Nach unten scrollen",
-  "chat.messagesUsed": "{used}/{total} Nachrichten verwendet",
+  "chat.messagesUsed": "Nachrichten verwendet",
   "viewer.slides": "Folien",
   "viewer.text": "Text",
   "auth.emailUnavailable": "Die Anmeldung per E-Mail ist vorübergehend nicht verfügbar. Bitte versuchen Sie eine andere Methode.",
@@ -552,14 +552,6 @@
   "header.win98Mode": "Windows 98",
   "mobile.chatTab": "Chat",
   "mobile.documentTab": "Dokument",
-  "tour.citation.title": "Zitierte Antworten",
-  "tour.citation.desc": "Klicken Sie auf eine [1]-Zitatnummer, um die genaue Quelle in Ihrem Dokument hervorgehoben zu sehen.",
-  "tour.mode.title": "KI-Leistungsmodi",
-  "tour.mode.desc": "Schnell für schnelle Antworten, Ausgewogen für Details, Gründlich für tiefe Analysen.",
-  "tour.plus.title": "Weitere Optionen",
-  "tour.plus.desc": "Legen Sie benutzerdefinierte KI-Anweisungen fest oder exportieren Sie Ihr Gespräch.",
-  "tour.session.title": "Chat-Sitzungen",
-  "tour.session.desc": "Erstellen Sie mehrere Chats pro Dokument, um verschiedene Themen zu erkunden.",
   "billing.downgrade": "Downgrade auf",
   "billing.upgradeSuccess": "{credits} Bonus-Credits wurden Ihrem Konto hinzugefügt!",
   "billing.downgradeSuccess": "Plan erfolgreich geändert. Ihre Credits wurden beibehalten.",
@@ -708,7 +700,7 @@
   "pricing.free.price": "$0",
   "pricing.free.cadence": "/Monat",
   "pricing.free.summary": "Ideal zum Ausprobieren von DocTalk mit kleinen Dokumentensets und grundlegenden KI-Chat-Workflows.",
-  "pricing.free.feature1": "300 Credits pro Monat + 500 Start-Credits",
+  "pricing.free.feature1": "500 Start-Credits, ab dem zweiten Monat 300 pro Monat",
   "pricing.free.feature2": "50 MB Uploads",
   "pricing.free.feature3": "3 Dokumente",
   "pricing.free.feature4": "Flash + eingeschränkte Pro-KI-Modi",
@@ -1570,7 +1562,7 @@
   "compareNotebooklm.feature.pricingP1": "NotebookLM ist derzeit kostenlos. Das ist sein größter Vorteil. Google hat keine zukünftige Preisgestaltung offengelegt, aber wie bei vielen Google-Produkten könnte es mit Nutzungslimits kostenlos bleiben und gleichzeitig Premium-Funktionen gegen Aufpreis anbieten. Der Kompromiss ist, dass Sie Ihren Workflow innerhalb des Google-Ökosystems aufbauen.",
   "compareNotebooklm.feature.pricingP2Pre": "DocTalk bietet eine ",
   "compareNotebooklm.feature.pricingDemoLink": "kostenlose Demo",
-  "compareNotebooklm.feature.pricingP2Mid": " ohne Anmeldung, plus 500 kostenlose Credits pro Monat. Bezahlpläne beginnen bei $9.99/Monat (Plus) für 3.000 Credits und gehen bis $19.99/Monat (Pro) für 9.000 Credits mit erweiterten Funktionen. Obwohl nicht kostenlos wie NotebookLM, bietet DocTalk transparente, vorhersehbare Preise ohne Anbieterbindung. Sehen Sie die ",
+  "compareNotebooklm.feature.pricingP2Mid": " ohne Anmeldung, plus 300 kostenlose Credits pro Monat. Bezahlpläne beginnen bei $9.99/Monat (Plus) für 3.000 Credits und gehen bis $19.99/Monat (Pro) für 9.000 Credits mit erweiterten Funktionen. Obwohl nicht kostenlos wie NotebookLM, bietet DocTalk transparente, vorhersehbare Preise ohne Anbieterbindung. Sehen Sie die ",
   "compareNotebooklm.feature.pricingPricingLink": "Preise",
   "compareNotebooklm.feature.performance": "Leistung & Geschwindigkeit",
   "compareNotebooklm.feature.performanceP1": "NotebookLM läuft auf Google Gemini und profitiert von der Google-Infrastruktur. Die Antworten sind generell schnell, obwohl die Verarbeitung mehrerer großer Quellen in einem Notizbuch Zeit in Anspruch nehmen kann. Die Audio-Podcast-Generierung ist ein längerer Prozess, der typischerweise eine Minute oder mehr benötigt.",
@@ -1665,7 +1657,7 @@
   "altsChatpdf.adv1": "7 Dokumentformate vs nur PDF",
   "altsChatpdf.adv2": "Echtzeit-Zitathervorhebung mit Ein-Klick-Überprüfung",
   "altsChatpdf.adv3": "11 Oberflächensprachen",
-  "altsChatpdf.adv4": "Drei KI-Leistungsmodi",
+  "altsChatpdf.adv4": "Zwei KI-Leistungsmodi",
   "altsChatpdf.adv5": "Sofort-Demo ohne Anmeldung",
   "altsChatpdf.adv6": "Halber Preis von ChatPDF Plus ($9.99 vs $19.99)",
   "altsChatpdf.alt2Title": "AskYourPDF — Am besten für Forscher",
@@ -1811,7 +1803,7 @@
   "altsHumata.adv3": "11 Oberflächensprachen (Humata: nur Englisch)",
   "altsHumata.adv4": "Kreditbasierte Preise, vorhersehbarer als seitenbasiert",
   "altsHumata.adv5": "Sofort-Demo ohne Anmeldung",
-  "altsHumata.adv6": "Drei KI-Leistungsmodi",
+  "altsHumata.adv6": "Zwei KI-Leistungsmodi",
   "altsHumata.alt2Title": "ChatPDF — Beliebteste Alternative",
   "altsHumata.alt2Desc1": "ChatPDF ist das bekannteste KI-Dokumenten-Chat-Tool und hat die größte Nutzerbasis in der Kategorie. Seine Einfachheit ist seine Stärke: Laden Sie ein PDF hoch, beginnen Sie zu chatten. Die Oberfläche ist klar und intuitiv, praktisch ohne Lernkurve. Für Benutzer, die Humatas Funktionsumfang überwältigend finden, ist der reduzierte Ansatz von ChatPDF erfrischend.",
   "altsHumata.alt2Desc2": "Der Kompromiss ist eingeschränkte Funktionalität. ChatPDF unterstützt nur PDF-Dateien, hat keine Zitathervorhebung, und die Oberfläche ist primär auf Englisch. Das kostenlose Kontingent (2 PDFs/Tag) ist restriktiv, und der Plus-Plan für $19.99/Monat ist pro Funktion teurer als die Student- oder Expert-Pläne von Humata. Aber für reine PDF-Benutzer, die Einfachheit schätzen, ist es eine bewährte Wahl.",
@@ -2187,6 +2179,10 @@
   "useCasesStudents.citations.p2b": " von DocTalk löst dies, indem es jede KI-Antwort in Ihrem tatsächlichen Dokumenttext verankert. Jedes nummerierte Zitat entspricht einer bestimmten Passage in Ihrer hochgeladenen Arbeit. Klicken Sie auf das Zitat, und die Dokumentenansicht scrollt zum genauen Text und hebt ihn hervor.",
   "useCasesStudents.citations.p3": "Das bedeutet, DocTalk ist kein Ersatz für das Lesen. Es ist ein Beschleuniger. Es hilft Ihnen, die richtigen Passagen schneller zu finden, komplexe Abschnitte schneller zu verstehen und jede Behauptung zu überprüfen, bevor Sie sie in Ihre eigene Arbeit aufnehmen. Die KI fungiert als Forschungsassistent, der immer seine Quellen zeigt.",
   "useCasesStudents.citations.p4": "Für Studenten, die sich um akademische Integrität sorgen, ist diese Unterscheidung entscheidend. Die Verwendung von DocTalk, um Quellmaterial in einer Arbeit zu finden und zu verstehen, auf die Sie legitimerweise Zugriff haben, unterscheidet sich nicht von der Verwendung einer Suchfunktion oder eines Index. Das Tool hilft Ihnen, Informationen zu finden; das Verstehen und die Analyse bleiben Ihnen.",
+  "useCasesStudents.verifiedQuotes.title": "Die Worte des Autors, mit Seitenzahlen zum Zitieren",
+  "useCasesStudents.verifiedQuotes.p1": "Wenn Sie ein direktes Zitat statt einer Zusammenfassung brauchen, finden Sie mit der Zitatsuche Zitate zu einem Thema. Jedes Zitat wurde mit dem Text Ihres Dokuments abgeglichen, trägt seine Seitenzahl und wird mit einer APA-Kurzzitation kopiert.",
+  "useCasesStudents.verifiedQuotes.p2": "Speichern Sie die Zitate, die Sie verwenden wollen. Jedes gespeicherte Zitat behält Quelle und Seite, sodass der Beleg für jede Aussage in Ihrem Entwurf nur einen Klick entfernt ist. Im kostenlosen Tarif lassen sich bis zu 30 Zitate speichern.",
+  "useCasesStudents.verifiedQuotes.p3": "Wenn die Textebene eines Dokuments unvollständig ist, etwa bei älteren gescannten PDFs, in denen Trennstriche am Zeilenende zusammengezogen sein können, weist die Zitatkarte darauf hin, statt eine exakte Übereinstimmung zu versprechen.",
   "useCasesStudents.multilingual.title": "Mehrsprachige akademische Forschung",
   "useCasesStudents.multilingual.p1": "Akademische Forschung ist ein globales Unterfangen. Bahnbrechende Arbeiten werden auf Chinesisch, Japanisch, Deutsch, Spanisch und Dutzenden anderer Sprachen veröffentlicht. Ein Forscher, der Fertigungstechniken studiert, muss möglicherweise japanische Ingenieursarbeiten überprüfen. Ein Historiker könnte deutschsprachige Primärquellen analysieren. Ein medizinischer Forscher könnte auf chinesische klinische Studien stoßen.",
   "useCasesStudents.multilingual.p2a": "DocTalk unterstützt ",
diff --git a/frontend/src/i18n/locales/en.json b/frontend/src/i18n/locales/en.json
index 797d87da..b705ed51 100644
--- a/frontend/src/i18n/locales/en.json
+++ b/frontend/src/i18n/locales/en.json
@@ -170,7 +170,7 @@
   "home.cta.demoNow": "Try Example PDF Now",
   "home.cta.loginUpload": "Log in to upload your PDF",
   "home.cta.tryDemo": "Try demo",
-  "auth.freeCredits": "New users get 500 starter credits + 300 credits/month",
+  "auth.freeCredits": "New users get 500 starter credits, then 300 credits a month from the second month",
   "billing.title": "Plans & Billing",
   "billing.purchase": "Purchase",
   "billing.purchaseSuccess": "Purchase successful! Credits have been added to your account.",
@@ -217,7 +217,7 @@
   "auth.privacyNote": "We don't use your documents to train AI models",
   "privacy.title": "Privacy Policy",
   "privacy.section1.title": "Data Collection",
-  "privacy.section1.content": "We collect your email address for authentication and the documents you upload for analysis.",
+  "privacy.section1.content": "We collect your email address for authentication and the documents you upload for analysis. When you use key buttons before signing up (such as sign up, sign in or try the demo), we also record the domain of the website that referred you, any campaign tags in the link (for example utm_source) and which kind of page you arrived on, so we can see how people find DocTalk. This sets no cookies and creates no device identifier; if you are signed in, these events are linked to your account, like our other product events.",
   "privacy.section2.title": "Data Usage",
   "privacy.section2.item1": "DocTalk does not train models on your data",
   "privacy.section2.item2": "Documents are processed to provide the document features you request.",
@@ -557,14 +557,6 @@
   "header.win98Mode": "Windows 98",
   "mobile.chatTab": "Chat",
   "mobile.documentTab": "Document",
-  "tour.citation.title": "Cited Answers",
-  "tour.citation.desc": "Click any [1] citation to see the exact source highlighted in your document.",
-  "tour.mode.title": "AI Performance Modes",
-  "tour.mode.desc": "Quick for fast answers, Balanced for detail, Thorough for deep analysis.",
-  "tour.plus.title": "More Options",
-  "tour.plus.desc": "Set custom AI instructions or export your conversation.",
-  "tour.session.title": "Chat Sessions",
-  "tour.session.desc": "Create multiple chats per document to explore different topics.",
   "billing.downgrade": "Downgrade to",
   "billing.upgradeSuccess": "{credits} bonus credits added to your account!",
   "billing.downgradeSuccess": "Plan changed successfully. Your credits have been kept.",
@@ -713,7 +705,7 @@
   "pricing.free.price": "$0",
   "pricing.free.cadence": "/month",
   "pricing.free.summary": "Best for trying DocTalk with small document sets and core AI chat workflows.",
-  "pricing.free.feature1": "300 credits every month + 500 starter credits",
+  "pricing.free.feature1": "500 starter credits, then 300 a month from your second month",
   "pricing.free.feature2": "50 MB uploads",
   "pricing.free.feature3": "3 documents",
   "pricing.free.feature4": "Flash + limited Pro AI modes",
@@ -2194,6 +2186,10 @@
   "useCasesStudents.citations.p2b": "solves this by grounding every AI answer in your actual document text. Each numbered citation corresponds to a specific passage in your uploaded paper. Click the citation, and the document viewer scrolls to the exact text and highlights it.",
   "useCasesStudents.citations.p3": "This means DocTalk is not a replacement for reading. It is an accelerator. It helps you find the right passages faster, understand complex sections more quickly, and verify every claim before you include it in your own work. The AI acts as a research assistant that always shows its sources.",
   "useCasesStudents.citations.p4": "For students concerned about academic integrity, this distinction is crucial. Using DocTalk to locate and understand source material in a paper you have legitimately accessed is no different from using a search function or index. The tool helps you find information; the understanding and analysis remain yours.",
+  "useCasesStudents.verifiedQuotes.title": "The author's own words, with page numbers you can cite",
+  "useCasesStudents.verifiedQuotes.p1": "When you need a direct quote rather than a summary, use Quote Finder to find quotes on a topic. Every quote it returns has been checked against your document's text, carries its page number, and copies with an APA in-text citation.",
+  "useCasesStudents.verifiedQuotes.p2": "Save the quotes you plan to use. Each saved quote keeps its source and page, so the evidence behind every claim in your draft stays one click away. The free plan keeps up to 30 saved quotes.",
+  "useCasesStudents.verifiedQuotes.p3": "Where a document's text layer is imperfect, for example in older scanned PDFs where line-break hyphens may have been joined, the quote card says so instead of promising an exact match.",
   "useCasesStudents.multilingual.title": "Multilingual Academic Research",
   "useCasesStudents.multilingual.p1": "Academic research is a global endeavor. Groundbreaking papers are published in Chinese, Japanese, German, Spanish, and dozens of other languages. A researcher studying manufacturing techniques may need to review Japanese engineering papers. A historian might analyze German-language primary sources. A medical researcher could encounter Chinese clinical trials.",
   "useCasesStudents.multilingual.p2a": "DocTalk supports ",
diff --git a/frontend/src/i18n/locales/es.json b/frontend/src/i18n/locales/es.json
index 735cd448..904dcb76 100644
--- a/frontend/src/i18n/locales/es.json
+++ b/frontend/src/i18n/locales/es.json
@@ -2,7 +2,7 @@
   "app.subtitle": "Sube un PDF para empezar a chatear.",
   "app.title": "DocTalk",
   "auth.continueWithGoogle": "Continuar con Google",
-  "auth.freeCredits": "Los nuevos usuarios reciben 500 créditos iniciales + 300 créditos/mes",
+  "auth.freeCredits": "Los nuevos usuarios reciben 500 créditos iniciales y, a partir del segundo mes, 300 créditos al mes",
   "auth.loginBenefits": "Inicia sesión para subir documentos, guardar conversaciones y sincronizar entre dispositivos",
   "auth.loginToContinue": "Inicia sesión para continuar",
   "auth.privacyNote": "No usamos tus documentos para entrenar modelos de IA",
@@ -266,7 +266,7 @@
   "privacy.ccpa.content": "No vendemos información personal. Los residentes de California pueden contactar a privacy@doctalk.site para solicitar acceso, eliminación, corrección o información de exclusión.",
   "privacy.noTraining": "DocTalk no entrena modelos con sus datos",
   "privacy.policyLink": "Política de privacidad",
-  "privacy.section1.content": "Recopilamos tu dirección de correo electrónico para la autenticación y los documentos que subes para su análisis.",
+  "privacy.section1.content": "Recopilamos tu dirección de correo electrónico para la autenticación y los documentos que subes para su análisis. Cuando usas botones clave antes de registrarte (como registrarse, iniciar sesión o probar la demo), también registramos el dominio del sitio web que te remitió, las etiquetas de campaña del enlace (por ejemplo, utm_source) y el tipo de página por la que llegaste, para saber cómo llega la gente a DocTalk. No se instalan cookies ni se crea ningún identificador de dispositivo; si has iniciado sesión, estos eventos se vinculan a tu cuenta, como el resto de nuestros eventos de producto.",
   "privacy.section1.title": "Recopilación de datos",
   "privacy.section2.item1": "DocTalk no entrena modelos con sus datos",
   "privacy.section2.item2": "Los documentos se procesan para ofrecer las funciones documentales que solicita.",
@@ -397,11 +397,11 @@
   "landing.faq.q4": "¿Qué modelos de IA puedo usar?",
   "landing.faq.a4": "DocTalk ofrece 2 modos de rendimiento: Flash para respuestas rápidas con citas y Pro para un análisis más profundo de documentos. Los usuarios gratuitos pueden usar Flash y Pro limitado. Plus elimina el límite mensual de Pro.",
   "landing.faq.q5": "¿Hay un plan gratuito?",
-  "landing.faq.a5": "¡Sí! Las cuentas gratuitas incluyen 500 créditos mensuales. No se requiere tarjeta de crédito para comenzar.",
+  "landing.faq.a5": "¡Sí! Las cuentas gratuitas incluyen 300 créditos mensuales, suficientes para decenas de preguntas. No se requiere tarjeta de crédito para comenzar.",
   "landing.faq.q6": "¿Puede manejar documentos largos?",
   "landing.faq.a6": "Sí. Los límites por documento son 750 páginas en Free, 1.500 en Plus y 3.000 en Pro. La fragmentación inteligente y la búsqueda semántica mantienen la precisión en documentos largos.",
   "landing.finalCta.title": "¿Listo para chatear con tus PDFs?",
-  "landing.finalCta.subtitle": "Únete a miles de profesionales que ahorran horas cada semana con análisis de documentos potenciado por IA.",
+  "landing.finalCta.subtitle": "Sube un documento y obtén tu primera respuesta citada en menos de un minuto. No se requiere tarjeta de crédito.",
   "landing.finalCta.demo": "Probar demo gratis",
   "landing.finalCta.signUp": "Registrarse gratis",
   "footer.product": "Producto",
@@ -539,14 +539,6 @@
   "header.win98Mode": "Windows 98",
   "mobile.chatTab": "Chat",
   "mobile.documentTab": "Documento",
-  "tour.citation.title": "Respuestas con citas",
-  "tour.citation.desc": "Haz clic en cualquier cita [1] para ver la fuente exacta resaltada en tu documento.",
-  "tour.mode.title": "Modos de rendimiento IA",
-  "tour.mode.desc": "Rápido para respuestas inmediatas, Equilibrado para más detalle, Exhaustivo para análisis profundo.",
-  "tour.plus.title": "Más opciones",
-  "tour.plus.desc": "Configura instrucciones personalizadas o exporta tu conversación.",
-  "tour.session.title": "Sesiones de chat",
-  "tour.session.desc": "Crea múltiples chats por documento para explorar diferentes temas.",
   "billing.downgrade": "Bajar a",
   "billing.upgradeSuccess": "Se añadieron {credits} créditos de bonificación a tu cuenta.",
   "billing.downgradeSuccess": "Plan cambiado correctamente. Tus créditos se han conservado.",
@@ -708,7 +700,7 @@
   "pricing.free.price": "$0",
   "pricing.free.cadence": "/mes",
   "pricing.free.summary": "Ideal para probar DocTalk con conjuntos pequeños de documentos y flujos de trabajo básicos de chat con IA.",
-  "pricing.free.feature1": "300 créditos cada mes + 500 créditos iniciales",
+  "pricing.free.feature1": "500 créditos iniciales y, desde el segundo mes, 300 al mes",
   "pricing.free.feature2": "Subidas de 50 MB",
   "pricing.free.feature3": "3 documentos",
   "pricing.free.feature4": "Modos Flash y Pro AI limitados",
@@ -2134,10 +2126,10 @@
   "useCasesStudents.breadcrumb.home": "Inicio",
   "useCasesStudents.breadcrumb.useCases": "Casos de uso",
   "useCasesStudents.breadcrumb.current": "Estudiantes y académicos",
-  "useCasesStudents.hero.title": "Análisis de artículos de investigación potenciado por IA para estudiantes y académicos",
-  "useCasesStudents.metaTitle": "Análisis de artículos de investigación potenciado por IA para estudiantes y académicos",
-  "useCasesStudents.hero.subtitle": "Sube artículos de investigación, libros de texto o tesis y obtén respuestas impulsadas por IA con citas a nivel de página que puedes verificar. Dedica menos tiempo a leer y más a comprender.",
-  "useCasesStudents.metaDescription": "Sube artículos de investigación, libros de texto o tesis y obtén respuestas impulsadas por IA con citas a nivel de página que puedes verificar. Dedica menos tiempo a leer y más a comprender.",
+  "useCasesStudents.hero.title": "IA para investigar gratis: lee artículos y cita la página exacta",
+  "useCasesStudents.metaTitle": "IA para investigar gratis: lee artículos y cita la página exacta",
+  "useCasesStudents.hero.subtitle": "Sube artículos, libros de texto o tu tesis y haz tus preguntas. DocTalk responde solo con tu documento: cada afirmación lleva su número de página y un clic te lleva al pasaje original. Empieza con el plan gratuito.",
+  "useCasesStudents.metaDescription": "Sube artículos, libros de texto o tu tesis y pregunta a la IA: cada respuesta cita la página exacta y la compruebas con un clic. Empieza gratis, sin tarjeta.",
   "useCasesStudents.hero.cta": "Analiza tu primer artículo gratis",
   "useCasesStudents.challenge.title": "El reto de la lectura académica",
   "useCasesStudents.challenge.p1": "La investigación académica exige un enorme volumen de lectura. Un estudiante de doctorado típico lee más de 100 artículos al año, y esa cifra aumenta considerablemente durante las fases de revisión de literatura. Cada artículo tiene una media de 20 a 50 páginas de prosa densa y técnica. Revisar manualmente un solo artículo lleva de una a tres horas, dependiendo de la complejidad del tema y de tu familiaridad con el campo.",
@@ -2149,23 +2141,23 @@
   "useCasesStudents.helps.summarize.description": "Sube un artículo de 50 páginas y pregunta \"¿Cuáles son los hallazgos clave?\" DocTalk devuelve un resumen estructurado con citas numeradas que señalan los párrafos exactos donde se indica cada hallazgo. Lo que antes llevaba una hora, ahora lleva segundos.",
   "useCasesStudents.helps.methodologies.title": "Extraer Metodologías",
   "useCasesStudents.helps.methodologies.description": "Pregunta \"¿Qué método de investigación utilizó este estudio?\" o \"Describe el diseño experimental\". DocTalk identifica las secciones de metodología y extrae descripciones detalladas, incluidos los tamaños de muestra, variables y enfoques estadísticos.",
-  "useCasesStudents.helps.literature.title": "Acelerar Revisiones de Literatura",
-  "useCasesStudents.helps.literature.description": "Sube artículos uno por uno y formula preguntas comparativas. \"¿Cuáles fueron las conclusiones principales?\" y \"¿En qué difiere esta metodología del artículo anterior?\" Construye tu revisión bibliográfica con citas de fuentes verificadas.",
+  "useCasesStudents.helps.literature.title": "Acelera tu revisión de literatura",
+  "useCasesStudents.helps.literature.description": "Sube los artículos uno por uno y haz preguntas comparativas: «¿Cuáles son las conclusiones principales?» o «¿En qué se diferencia esta metodología de la del artículo anterior?». Cada respuesta cita su fuente, así tu revisión bibliográfica se puede verificar frase por frase.",
   "useCasesStudents.helps.exams.title": "Prepararse para Exámenes",
   "useCasesStudents.helps.exams.description": "Sube capítulos de libros de texto y formula preguntas de práctica. \"¿Cuáles son los conceptos clave del capítulo 3?\" o \"Explica la diferencia entre los errores de Tipo I y Tipo II\". Cada respuesta remite al pasaje del libro de texto para su revisión.",
-  "useCasesStudents.helps.quotes.title": "Encontrar Citas y Números de Página",
-  "useCasesStudents.helps.quotes.description": "¿Necesitas citar un pasaje específico en tu tesis? Pídele a DocTalk que lo localice. \"¿Dónde discute el autor las limitaciones del estudio?\" La IA localiza el pasaje y te da el número de página para tu cita.",
-  "useCasesStudents.docTypes.title": "Tipos de Documentos Académicos Soportados",
+  "useCasesStudents.helps.quotes.title": "Encuentra citas con su número de página",
+  "useCasesStudents.helps.quotes.description": "¿Necesitas citar un pasaje en tu tesis? Con el Buscador de citas encuentras citas por tema: cada una se comprueba contra el texto del documento, lleva su número de página y se copia con la cita en el texto en formato APA.",
+  "useCasesStudents.docTypes.title": "Tipos de documentos académicos compatibles",
   "useCasesStudents.docTypes.intro": "DocTalk soporta",
   "useCasesStudents.docTypes.formatLink": "7 formatos de documento",
   "useCasesStudents.docTypes.introSuffix": ", cubriendo prácticamente todos los tipos de material académico que encuentras en la investigación.",
-  "useCasesStudents.docTypes.pdf.format": "Artículos de Investigación en PDF",
+  "useCasesStudents.docTypes.pdf.format": "Artículos de investigación en PDF",
   "useCasesStudents.docTypes.pdf.detail": "Artículos de arXiv, PubMed, IEEE Xplore, JSTOR, Springer, Elsevier y cualquier otro repositorio. Maneja diseños de múltiples columnas, ecuaciones y tablas.",
-  "useCasesStudents.docTypes.docx.format": "Tesis y Disertaciones en DOCX",
+  "useCasesStudents.docTypes.docx.format": "Tesis y disertaciones en DOCX",
   "useCasesStudents.docTypes.docx.detail": "Documentos de Word que incluyen borradores de tesis, capítulos de disertación y documentos de retroalimentación del asesor. Conserva el contexto de formato para una cita precisa.",
-  "useCasesStudents.docTypes.pptx.format": "Diapositivas de Clase en PPTX",
+  "useCasesStudents.docTypes.pptx.format": "Diapositivas de clase en PPTX",
   "useCasesStudents.docTypes.pptx.detail": "Presentaciones de PowerPoint de conferencias, charlas de congresos y seminarios. Extrae contenido del texto de las diapositivas y las notas del orador.",
-  "useCasesStudents.docTypes.url.format": "URLs de Repositorios Académicos",
+  "useCasesStudents.docTypes.url.format": "URL de repositorios académicos",
   "useCasesStudents.docTypes.url.detail": "Pega un enlace a cualquier artículo, prepublicación o página web académica de acceso público. DocTalk obtiene y procesa el contenido automáticamente.",
   "useCasesStudents.realWorld.title": "Casos de uso académico en el mundo real",
   "useCasesStudents.realWorld.thesis.title": "Analizando una tesis de 50 páginas",
@@ -2187,20 +2179,24 @@
   "useCasesStudents.citations.p2b": " de DocTalk resuelve esto fundamentando cada respuesta de la IA en el texto real del documento. Cada cita numerada corresponde a un pasaje específico en el artículo subido. Al hacer clic en la cita, el visor de documentos se desplaza al texto exacto y lo resalta.",
   "useCasesStudents.citations.p3": "Esto significa que DocTalk no es un sustituto de la lectura. Es un acelerador. Te ayuda a encontrar los pasajes correctos más rápido, a comprender secciones complejas más rápidamente y a verificar cada afirmación antes de incluirla en tu propio trabajo. La IA actúa como un asistente de investigación que siempre muestra sus fuentes.",
   "useCasesStudents.citations.p4": "Para los estudiantes preocupados por la integridad académica, esta distinción es crucial. Utilizar DocTalk para localizar y comprender el material de origen en un artículo al que has accedido legítimamente no es diferente de usar una función de búsqueda o un índice. La herramienta te ayuda a encontrar información; la comprensión y el análisis siguen siendo tuyos.",
-  "useCasesStudents.multilingual.title": "Investigación Académica Multilingüe",
+  "useCasesStudents.verifiedQuotes.title": "Las palabras del autor, con números de página que puedes citar",
+  "useCasesStudents.verifiedQuotes.p1": "Cuando necesitas una cita textual y no un resumen, usa el Buscador de citas para encontrar citas sobre un tema. Cada cita que devuelve se ha comprobado contra el texto de tu documento, lleva su número de página y se copia con la cita en el texto en formato APA.",
+  "useCasesStudents.verifiedQuotes.p2": "Guarda las citas que vas a usar. Cada cita guardada conserva su fuente y su página, así la evidencia de cada afirmación de tu borrador está a un clic. El plan gratuito guarda hasta 30 citas.",
+  "useCasesStudents.verifiedQuotes.p3": "Cuando la capa de texto de un documento es imperfecta, por ejemplo en PDF escaneados antiguos donde los guiones de fin de línea pueden haberse unido, la tarjeta de la cita lo indica en lugar de prometer una coincidencia exacta.",
+  "useCasesStudents.multilingual.title": "Investigación académica multilingüe",
   "useCasesStudents.multilingual.p1": "La investigación académica es un esfuerzo global. Artículos innovadores se publican en chino, japonés, alemán, español y muchos otros idiomas. Un investigador que estudie técnicas de fabricación puede necesitar revisar artículos de ingeniería japoneses. Un historiador podría analizar fuentes primarias en alemán. Un investigador médico podría encontrar ensayos clínicos en chino.",
   "useCasesStudents.multilingual.p2a": "DocTalk admite ",
   "useCasesStudents.multilingual.link": "11 idiomas de interfaz",
   "useCasesStudents.multilingual.p2b": "y puede analizar documentos escritos en cualquier idioma. Sube un artículo en chino, haz preguntas en inglés y recibe respuestas en inglés con citas que remiten al texto original en chino. Esto derriba las barreras lingüísticas que históricamente han limitado la colaboración académica intercultural.",
   "useCasesStudents.multilingual.p3": "El sistema de citas funciona en todos los idiomas. Cuando DocTalk cita un pasaje de un artículo japonés, al hacer clic en la cita se resalta el texto original japonés en el visor de documentos. Puedes verificar la interpretación de la IA con la fuente, incluso si no dominas completamente el idioma del documento.",
-  "useCasesStudents.getStarted.title": "Comienza en 3 Pasos",
+  "useCasesStudents.getStarted.title": "Comienza en 3 pasos",
   "useCasesStudents.getStarted.step1.title": "Sube tu Artículo",
   "useCasesStudents.getStarted.step1.description": "Arrastra y suelta un archivo PDF, DOCX o PPTX, o pega una URL de cualquier artículo de acceso público. DocTalk extrae e indexa el texto completo en segundos.",
   "useCasesStudents.getStarted.step2.title": "Haz una Pregunta",
   "useCasesStudents.getStarted.step2.description": "Escribe cualquier pregunta en lenguaje natural. \"¿Cuáles son los hallazgos clave?\" o \"Explica la metodología.\" DocTalk recupera los pasajes más relevantes y genera una respuesta.",
   "useCasesStudents.getStarted.step3.title": "Verifica la Cita",
   "useCasesStudents.getStarted.step3.description": "Haz clic en cualquier cita numerada en la respuesta de la IA. El visor de documentos se desplaza al pasaje fuente exacto y lo resalta, para que puedas verificar la afirmación antes de usarla en tu trabajo.",
-  "useCasesStudents.faqTitle": "Preguntas Frecuentes",
+  "useCasesStudents.faqTitle": "Preguntas frecuentes",
   "useCasesStudents.faq.q1": "¿Puede DocTalk resumir un artículo de investigación?",
   "useCasesStudents.faq.a1": "Sí. Sube cualquier artículo de investigación como PDF, DOCX o URL, y luego pide a DocTalk que lo resuma. La IA generará un resumen conciso con citas numeradas que remiten a pasajes específicos del artículo, para que puedas verificar cada afirmación clave con el texto original.",
   "useCasesStudents.faq.q2": "¿Funciona con artículos de arXiv?",
diff --git a/frontend/src/i18n/locales/fr.json b/frontend/src/i18n/locales/fr.json
index e1b49036..217144c7 100644
--- a/frontend/src/i18n/locales/fr.json
+++ b/frontend/src/i18n/locales/fr.json
@@ -169,7 +169,7 @@
   "home.cta.demoNow": "Essayez un PDF d'exemple maintenant",
   "home.cta.loginUpload": "Connectez-vous pour telecharger votre PDF",
   "home.cta.tryDemo": "Essayer la demo",
-  "auth.freeCredits": "Les nouveaux utilisateurs reçoivent 500 crédits de départ + 300 crédits/mois",
+  "auth.freeCredits": "Les nouveaux utilisateurs reçoivent 500 crédits de départ, puis 300 crédits par mois à partir du deuxième mois",
   "billing.title": "Forfaits et facturation",
   "billing.purchase": "Acheter",
   "billing.purchaseSuccess": "Achat réussi ! Les crédits ont été ajoutés à votre compte.",
@@ -216,7 +216,7 @@
   "auth.privacyNote": "Nous n'utilisons pas vos documents pour entrainer des modeles d'IA",
   "privacy.title": "Politique de confidentialite",
   "privacy.section1.title": "Collecte des donnees",
-  "privacy.section1.content": "Nous collectons votre adresse e-mail pour l'authentification et les documents que vous telechargez pour l'analyse.",
+  "privacy.section1.content": "Nous collectons votre adresse e-mail pour l'authentification et les documents que vous telechargez pour l'analyse. Lorsque vous utilisez des boutons clés avant l'inscription (par exemple s'inscrire, se connecter ou essayer la démo), nous enregistrons aussi le domaine du site qui vous a redirigé, les balises de campagne du lien (par exemple utm_source) et le type de page par lequel vous êtes arrivé, afin de comprendre comment les gens découvrent DocTalk. Aucun cookie n'est déposé et aucun identifiant d'appareil n'est créé ; si vous êtes connecté, ces événements sont associés à votre compte, comme nos autres événements produit.",
   "privacy.section2.title": "Utilisation des donnees",
   "privacy.section2.item1": "DocTalk n’entraîne pas de modèles avec vos données",
   "privacy.section2.item2": "Les documents sont traités pour fournir les fonctionnalités documentaires que vous demandez.",
@@ -410,7 +410,7 @@
   "landing.faq.q6": "Peut-il gérer de longs documents ?",
   "landing.faq.a6": "Oui. Les limites par document sont de 750 pages avec Free, 1 500 avec Plus et 3 000 avec Pro. Le découpage intelligent et la recherche sémantique préservent la précision sur les longs documents.",
   "landing.finalCta.title": "Prêt à discuter avec vos PDF ?",
-  "landing.finalCta.subtitle": "Rejoignez des milliers de professionnels qui économisent des heures chaque semaine grâce à l'analyse de documents par IA.",
+  "landing.finalCta.subtitle": "Téléversez un document et obtenez votre première réponse citée en moins d'une minute. Aucune carte de crédit requise.",
   "landing.finalCta.demo": "Essai gratuit",
   "landing.finalCta.signUp": "S'inscrire gratuitement",
   "footer.product": "Produit",
@@ -552,14 +552,6 @@
   "header.win98Mode": "Windows 98",
   "mobile.chatTab": "Discussion",
   "mobile.documentTab": "Document",
-  "tour.citation.title": "Réponses citées",
-  "tour.citation.desc": "Cliquez sur n'importe quelle citation [1] pour voir la source exacte surlignée dans votre document.",
-  "tour.mode.title": "Modes de performance IA",
-  "tour.mode.desc": "Rapide pour des réponses instantanées, Équilibré pour plus de détails, Approfondi pour une analyse poussée.",
-  "tour.plus.title": "Plus d'options",
-  "tour.plus.desc": "Définissez des instructions IA personnalisées ou exportez votre conversation.",
-  "tour.session.title": "Sessions de chat",
-  "tour.session.desc": "Créez plusieurs chats par document pour explorer différents sujets.",
   "billing.downgrade": "Rétrograder vers",
   "billing.upgradeSuccess": "{credits} crédits bonus ont été ajoutés à votre compte !",
   "billing.downgradeSuccess": "Forfait modifié avec succès. Vos crédits ont été conservés.",
@@ -708,7 +700,7 @@
   "pricing.free.price": "$0",
   "pricing.free.cadence": "/mois",
   "pricing.free.summary": "Idéal pour découvrir DocTalk avec de petits ensembles de documents et les fonctionnalités de chat IA de base.",
-  "pricing.free.feature1": "300 crédits chaque mois + 500 crédits de départ",
+  "pricing.free.feature1": "500 crédits de départ, puis 300 par mois à partir du deuxième mois",
   "pricing.free.feature2": "Téléchargements de 50 Mo",
   "pricing.free.feature3": "3 documents",
   "pricing.free.feature4": "Modes IA Flash + Pro limités",
@@ -1189,11 +1181,11 @@
   "featuresDemo.steps.step4.description": "Cliquez sur n'importe quelle citation numérotée pour accéder au texte source surligné.",
   "featuresDemo.faq.title": "Questions fréquentes",
   "featuresDemo.faq.q1": "Est-ce vraiment gratuit ?",
-  "featuresDemo.faq.a1": "Oui. La démo est entièrement gratuite. Pas de carte de crédit, pas de compte, pas d'email. Cliquez et commencez à discuter avec les exemples de documents.",
+  "featuresDemo.faq.a1": "Oui. La démo est entièrement gratuite. Pas de carte de crédit, pas de compte, pas d'email. Cliquez et commencez à discuter avec les exemples de documents. Si vous voulez importer vos propres documents, le plan gratuit vous donne 300 crédits par mois, là aussi sans carte de crédit.",
   "featuresDemo.faq.q2": "Ai-je besoin d'un compte ?",
   "featuresDemo.faq.a2": "Pas pour la démo. La démo fonctionne instantanément sans aucune inscription. Pour télécharger vos propres documents et obtenir 300 crédits mensuels, créez un compte gratuit.",
   "featuresDemo.faq.q3": "Que se passe-t-il après la démo ?",
-  "featuresDemo.faq.a3": "Rien ne se passe automatiquement. Vous pouvez utiliser la démo autant de fois que vous le souhaitez. Quand vous êtes prêt, créez un compte gratuit pour télécharger vos propres documents.",
+  "featuresDemo.faq.a3": "Rien ne se passe automatiquement. Vous pouvez utiliser la démo autant de fois que vous le souhaitez. Quand vous êtes prêt à importer vos propres documents, créez un compte gratuit (300 crédits/mois) ou passez à Plus (9,99 $/mois, 3 000 crédits) ou Pro (19,99 $/mois, 9 000 crédits).",
   "featuresDemo.faq.q4": "Puis-je télécharger mes propres documents gratuitement ?",
   "featuresDemo.faq.a4": "Oui. Créez un compte gratuit (sans carte bancaire) et vous pouvez télécharger jusqu’à 3 documents (50 Mo chacun) avec 300 crédits par mois. Cela suffit pour des dizaines de questions en mode Flash.",
   "featuresDemo.faq.q5": "Combien de crédits ai-je ?",
@@ -1665,7 +1657,7 @@
   "altsChatpdf.adv1": "7 formats de documents vs PDF uniquement",
   "altsChatpdf.adv2": "Surlignage de citations en temps réel avec vérification en un clic",
   "altsChatpdf.adv3": "11 langues d'interface",
-  "altsChatpdf.adv4": "Trois modes de performance IA",
+  "altsChatpdf.adv4": "Deux modes de performance IA",
   "altsChatpdf.adv5": "Démo instantanée sans inscription",
   "altsChatpdf.adv6": "Moitié prix de ChatPDF Plus ($9.99 vs $19.99)",
   "altsChatpdf.alt2Title": "AskYourPDF — Meilleur pour les chercheurs",
@@ -1811,7 +1803,7 @@
   "altsHumata.adv3": "11 langues d'interface (Humata : anglais uniquement)",
   "altsHumata.adv4": "Tarification par crédits, plus prévisible que par pages",
   "altsHumata.adv5": "Démo instantanée sans inscription",
-  "altsHumata.adv6": "Trois modes de performance IA",
+  "altsHumata.adv6": "Deux modes de performance IA",
   "altsHumata.alt2Title": "ChatPDF — Alternative la plus populaire",
   "altsHumata.alt2Desc1": "ChatPDF est l'outil de chat documentaire IA le plus connu et a la plus grande base d'utilisateurs de la catégorie. Simple et éprouvé.",
   "altsHumata.alt2Desc2": "Le compromis est un ensemble de fonctionnalités limité. ChatPDF ne supporte que les PDF, n'a pas de surlignage de citations et est principalement en anglais.",
@@ -2187,6 +2179,10 @@
   "useCasesStudents.citations.p2b": " de DocTalk résout cela en ancrant chaque réponse IA dans le texte réel de votre document. Chaque citation numérotée correspond à un passage spécifique.",
   "useCasesStudents.citations.p3": "Cela signifie que DocTalk n'est pas un remplacement de la lecture. C'est un accélérateur. Il vous aide à trouver les bonnes informations plus rapidement, mais la vérification reste entre vos mains.",
   "useCasesStudents.citations.p4": "Pour les étudiants soucieux de l'intégrité académique, cette distinction est cruciale. Utiliser DocTalk pour localiser des passages pertinents est de la recherche, pas de la tricherie.",
+  "useCasesStudents.verifiedQuotes.title": "Les mots de l'auteur, avec des numéros de page à citer",
+  "useCasesStudents.verifiedQuotes.p1": "Quand il vous faut une citation directe plutôt qu'un résumé, utilisez la Recherche de citations pour trouver des citations sur un thème. Chaque citation renvoyée a été vérifiée par rapport au texte de votre document, porte son numéro de page et se copie avec une citation dans le texte au format APA.",
+  "useCasesStudents.verifiedQuotes.p2": "Enregistrez les citations que vous comptez utiliser. Chaque citation enregistrée conserve sa source et sa page : la preuve de chaque affirmation de votre brouillon reste à un clic. L'offre gratuite conserve jusqu'à 30 citations.",
+  "useCasesStudents.verifiedQuotes.p3": "Lorsque la couche texte d'un document est imparfaite, par exemple dans d'anciens PDF numérisés où les traits d'union de fin de ligne ont pu être fusionnés, la fiche de citation le signale au lieu de promettre une correspondance exacte.",
   "useCasesStudents.multilingual.title": "Recherche académique multilingue",
   "useCasesStudents.multilingual.p1": "La recherche académique est une entreprise mondiale. Des articles révolutionnaires sont publiés en chinois, japonais, allemand, français et dans de nombreuses autres langues.",
   "useCasesStudents.multilingual.p2a": "DocTalk supporte ",
diff --git a/frontend/src/i18n/locales/hi.json b/frontend/src/i18n/locales/hi.json
index 9e02cce8..7d1342bb 100644
--- a/frontend/src/i18n/locales/hi.json
+++ b/frontend/src/i18n/locales/hi.json
@@ -2,7 +2,7 @@
   "app.subtitle": "चैट शुरू करने के लिए PDF अपलोड करें।",
   "app.title": "DocTalk",
   "auth.continueWithGoogle": "Google के साथ जारी रखें",
-  "auth.freeCredits": "नए उपयोगकर्ताओं को 500 शुरुआती क्रेडिट + 300 क्रेडिट/माह मिलते हैं",
+  "auth.freeCredits": "नए उपयोगकर्ताओं को 500 शुरुआती क्रेडिट मिलते हैं, फिर दूसरे महीने से हर महीने 300 क्रेडिट",
   "auth.loginBenefits": "दस्तावेज़ अपलोड करने, बातचीत सहेजने और डिवाइस के बीच सिंक करने के लिए साइन इन करें",
   "auth.loginToContinue": "जारी रखने के लिए साइन इन करें",
   "auth.privacyNote": "हम आपके दस्तावेज़ों का उपयोग AI मॉडल प्रशिक्षण के लिए नहीं करते",
@@ -245,7 +245,7 @@
   "privacy.ccpa.content": "हम व्यक्तिगत जानकारी नहीं बेचते। कैलिफ़ोर्निया निवासी पहुंच, हटाने, सुधार या ऑप्ट-आउट जानकारी के लिए privacy@doctalk.site पर संपर्क कर सकते हैं।",
   "privacy.noTraining": "DocTalk आपके डेटा पर मॉडल प्रशिक्षित नहीं करता",
   "privacy.policyLink": "गोपनीयता नीति",
-  "privacy.section1.content": "हम प्रमाणीकरण के लिए आपका ईमेल पता और विश्लेषण के लिए आपके अपलोड किए गए दस्तावेज़ एकत्र करते हैं।",
+  "privacy.section1.content": "हम प्रमाणीकरण के लिए आपका ईमेल पता और विश्लेषण के लिए आपके अपलोड किए गए दस्तावेज़ एकत्र करते हैं। जब आप साइन अप करने से पहले मुख्य बटनों (जैसे साइन अप, साइन इन या डेमो आज़माएँ) का उपयोग करते हैं, तो हम उस वेबसाइट का डोमेन भी दर्ज करते हैं जिसने आपको भेजा था, लिंक में मौजूद कैंपेन टैग (जैसे utm_source) और यह कि आप किस प्रकार के पेज पर पहुँचे, ताकि यह समझ सकें कि लोग DocTalk तक कैसे पहुँचते हैं। इससे कोई कुकी सेट नहीं होती और कोई डिवाइस पहचानकर्ता नहीं बनता; यदि आप साइन इन हैं, तो ये इवेंट हमारे अन्य उत्पाद इवेंट की तरह आपके खाते से जुड़े होते हैं।",
   "privacy.section1.title": "डेटा संग्रह",
   "privacy.section2.item1": "DocTalk आपके डेटा पर मॉडल प्रशिक्षित नहीं करता",
   "privacy.section2.item2": "दस्तावेज़ आपके अनुरोधित दस्तावेज़ फ़ीचर प्रदान करने के लिए संसाधित किए जाते हैं।",
@@ -401,7 +401,7 @@
   "landing.faq.q6": "क्या यह लंबे दस्तावेज़ संभाल सकता है?",
   "landing.faq.a6": "हाँ। प्रति दस्तावेज़ पृष्ठ सीमा Free में 750, Plus में 1,500 और Pro में 3,000 है। स्मार्ट चंकिंग और सिमेंटिक खोज लंबे दस्तावेज़ों में उत्तरों को सटीक रखते हैं।",
   "landing.finalCta.title": "अपनी PDF के साथ चैट करने के लिए तैयार हैं?",
-  "landing.finalCta.subtitle": "AI-संचालित दस्तावेज़ विश्लेषण से हर हफ्ते घंटे बचाने वाले पेशेवरों से जुड़ें।",
+  "landing.finalCta.subtitle": "एक दस्तावेज़ अपलोड करें और एक मिनट से भी कम समय में अपना पहला उद्धृत उत्तर पाएँ। क्रेडिट कार्ड की आवश्यकता नहीं है।",
   "landing.finalCta.demo": "मुफ्त डेमो आज़माएं",
   "landing.finalCta.signUp": "मुफ्त साइन अप",
   "footer.product": "उत्पाद",
@@ -539,14 +539,6 @@
   "header.win98Mode": "Windows 98",
   "mobile.chatTab": "चैट",
   "mobile.documentTab": "दस्तावेज़",
-  "tour.citation.title": "उद्धृत उत्तर",
-  "tour.citation.desc": "किसी भी [1] उद्धरण पर क्लिक करें और अपने दस्तावेज़ में सटीक स्रोत हाइलाइट देखें।",
-  "tour.mode.title": "AI प्रदर्शन मोड",
-  "tour.mode.desc": "त्वरित तेज़ उत्तर के लिए, संतुलित विस्तृत उत्तर के लिए, गहन गहरे विश्लेषण के लिए।",
-  "tour.plus.title": "अधिक विकल्प",
-  "tour.plus.desc": "कस्टम AI निर्देश सेट करें या अपनी बातचीत निर्यात करें।",
-  "tour.session.title": "चैट सत्र",
-  "tour.session.desc": "प्रत्येक दस्तावेज़ के लिए कई चैट बनाएं और विभिन्न विषयों का अन्वेषण करें।",
   "billing.downgrade": "डाउनग्रेड करें",
   "billing.upgradeSuccess": "{credits} बोनस क्रेडिट आपके खाते में जोड़ दिए गए हैं!",
   "billing.downgradeSuccess": "योजना सफलतापूर्वक बदल दी गई। आपके क्रेडिट सुरक्षित रखे गए हैं।",
@@ -708,7 +700,7 @@
   "pricing.free.price": "$0",
   "pricing.free.cadence": "/माह",
   "pricing.free.summary": "छोटे दस्तावेज़ सेट और मुख्य AI चैट वर्कफ़्लो के साथ DocTalk आज़माने के लिए सर्वोत्तम।",
-  "pricing.free.feature1": "हर महीने 300 क्रेडिट + 500 शुरुआती क्रेडिट",
+  "pricing.free.feature1": "500 शुरुआती क्रेडिट, फिर दूसरे महीने से हर महीने 300 क्रेडिट",
   "pricing.free.feature2": "50 MB अपलोड",
   "pricing.free.feature3": "3 दस्तावेज़",
   "pricing.free.feature4": "Flash + सीमित Pro AI मोड",
@@ -2187,6 +2179,10 @@
   "useCasesStudents.citations.p2b": "प्रत्येक AI उत्तर को आपके वास्तविक दस्तावेज़ पाठ में आधारित करके इसे हल करती है। प्रत्येक क्रमांकित उद्धरण आपके अपलोड किए गए पेपर में एक विशिष्ट अनुच्छेद से मेल खाता है। उद्धरण पर क्लिक करें, और दस्तावेज़ दर्शक सटीक पाठ पर स्क्रॉल करके उसे हाइलाइट करता है।",
   "useCasesStudents.citations.p3": "इसका मतलब है कि DocTalk पढ़ने का विकल्प नहीं है। यह एक त्वरक है। यह आपको सही अनुच्छेदों को तेज़ी से ढूँढने, जटिल अनुभागों को अधिक तेज़ी से समझने, और हर दावे को अपने काम में शामिल करने से पहले सत्यापित करने में मदद करता है। AI एक शोध सहायक के रूप में कार्य करता है जो हमेशा अपने स्रोत दिखाता है।",
   "useCasesStudents.citations.p4": "शैक्षणिक अखंडता के बारे में चिंतित छात्रों के लिए, यह अंतर महत्वपूर्ण है। जिस पेपर तक आपकी वैध पहुँच है, उसमें स्रोत सामग्री का पता लगाने और समझने के लिए DocTalk का उपयोग करना किसी खोज फ़ंक्शन या अनुक्रमणिका का उपयोग करने से अलग नहीं है। यह उपकरण आपको जानकारी खोजने में मदद करता है; समझ और विश्लेषण आपके ही रहते हैं।",
+  "useCasesStudents.verifiedQuotes.title": "लेखक के अपने शब्द, उद्धृत करने योग्य पृष्ठ संख्याओं के साथ",
+  "useCasesStudents.verifiedQuotes.p1": "जब आपको सारांश नहीं बल्कि सीधा उद्धरण चाहिए, तो किसी विषय पर उद्धरण खोजने के लिए उद्धरण खोजक का उपयोग करें। लौटाया गया हर उद्धरण आपके दस्तावेज़ के पाठ से मिलाकर जाँचा गया है, उसके साथ पृष्ठ संख्या होती है, और वह APA इन-टेक्स्ट उद्धरण के साथ कॉपी होता है।",
+  "useCasesStudents.verifiedQuotes.p2": "जो उद्धरण आप इस्तेमाल करेंगे, उन्हें सहेज लें। हर सहेजा गया उद्धरण अपना स्रोत और पृष्ठ बनाए रखता है, इसलिए आपके मसौदे के हर दावे का प्रमाण बस एक क्लिक दूर रहता है। मुफ़्त प्लान में 30 उद्धरण तक सहेजे जा सकते हैं।",
+  "useCasesStudents.verifiedQuotes.p3": "जब किसी दस्तावेज़ की टेक्स्ट परत अधूरी होती है, जैसे पुराने स्कैन किए गए PDF में जहाँ पंक्ति के अंत के हाइफ़न जुड़ गए हो सकते हैं, तो उद्धरण कार्ड सटीक मिलान का वादा करने के बजाय यह बता देता है।",
   "useCasesStudents.multilingual.title": "बहुभाषी अकादमिक अनुसंधान",
   "useCasesStudents.multilingual.p1": "अकादमिक अनुसंधान एक वैश्विक प्रयास है। चीनी, जापानी, जर्मन, स्पेनिश और दर्जनों अन्य भाषाओं में अभूतपूर्व पेपर प्रकाशित होते हैं। विनिर्माण तकनीकों का अध्ययन करने वाले शोधकर्ता को जापानी इंजीनियरिंग पेपरों की समीक्षा करने की आवश्यकता हो सकती है। एक इतिहासकार जर्मन-भाषा के प्राथमिक स्रोतों का विश्लेषण कर सकता है। एक चिकित्सा शोधकर्ता चीनी नैदानिक परीक्षणों का सामना कर सकता है।",
   "useCasesStudents.multilingual.p2a": "DocTalk समर्थन करता है ",
diff --git a/frontend/src/i18n/locales/it.json b/frontend/src/i18n/locales/it.json
index f19e2190..7388a938 100644
--- a/frontend/src/i18n/locales/it.json
+++ b/frontend/src/i18n/locales/it.json
@@ -167,7 +167,7 @@
   "home.cta.demoNow": "Prova un PDF di esempio",
   "home.cta.loginUpload": "Accedi per caricare il tuo PDF",
   "home.cta.tryDemo": "Prova la demo",
-  "auth.freeCredits": "I nuovi utenti ricevono 500 crediti iniziali + 300 crediti/mese",
+  "auth.freeCredits": "I nuovi utenti ricevono 500 crediti iniziali, poi 300 crediti al mese dal secondo mese",
   "billing.title": "Piani e fatturazione",
   "billing.purchase": "Acquista",
   "billing.purchaseSuccess": "Acquisto riuscito! I crediti sono stati aggiunti al tuo account.",
@@ -212,7 +212,7 @@
   "auth.privacyNote": "Non utilizziamo i tuoi documenti per addestrare modelli AI",
   "privacy.title": "Informativa sulla privacy",
   "privacy.section1.title": "Raccolta dati",
-  "privacy.section1.content": "Raccogliamo il tuo indirizzo email per l'autenticazione e i documenti che carichi per l'analisi.",
+  "privacy.section1.content": "Raccogliamo il tuo indirizzo email per l'autenticazione e i documenti che carichi per l'analisi. Quando usi i pulsanti principali prima della registrazione (ad esempio registrati, accedi o prova la demo), registriamo anche il dominio del sito che ti ha indirizzato, gli eventuali tag di campagna nel link (ad esempio utm_source) e il tipo di pagina da cui sei arrivato, per capire come le persone trovano DocTalk. Non vengono impostati cookie né creati identificatori del dispositivo; se hai effettuato l'accesso, questi eventi sono collegati al tuo account, come gli altri nostri eventi di prodotto.",
   "privacy.section2.title": "Utilizzo dei dati",
   "privacy.section2.item1": "DocTalk non addestra modelli con i tuoi dati",
   "privacy.section2.item2": "I documenti vengono elaborati per fornire le funzioni documentali che richiedi.",
@@ -397,11 +397,11 @@
   "landing.faq.q4": "Quali modelli AI posso usare?",
   "landing.faq.a4": "DocTalk offre 2 modalità di performance: Flash per risposte rapide con citazioni e Pro per un'analisi più approfondita dei documenti. Gli utenti gratuiti possono usare Flash e Pro limitato. Plus rimuove il limite mensile di Pro.",
   "landing.faq.q5": "C'è un piano gratuito?",
-  "landing.faq.a5": "Sì! Gli account gratuiti includono 500 crediti al mese, sufficienti per centinaia di domande. Non è richiesta una carta di credito per iniziare.",
+  "landing.faq.a5": "Sì! Gli account gratuiti includono 300 crediti al mese, sufficienti per decine di domande. Non è richiesta una carta di credito per iniziare.",
   "landing.faq.q6": "Può gestire documenti lunghi?",
   "landing.faq.a6": "Sì. I limiti per documento sono 750 pagine con Free, 1.500 con Plus e 3.000 con Pro. Il chunking intelligente e la ricerca semantica mantengono risposte accurate nei documenti lunghi.",
   "landing.finalCta.title": "Pronto a chattare con i tuoi PDF?",
-  "landing.finalCta.subtitle": "Unisciti a migliaia di professionisti che risparmiano ore ogni settimana con l'analisi documentale basata sull'AI.",
+  "landing.finalCta.subtitle": "Carica un documento e ottieni la tua prima risposta citata in meno di un minuto. Non è richiesta una carta di credito.",
   "landing.finalCta.demo": "Prova la demo gratuita",
   "landing.finalCta.signUp": "Registrati gratis",
   "footer.product": "Prodotto",
@@ -539,14 +539,6 @@
   "header.win98Mode": "Windows 98",
   "mobile.chatTab": "Chat",
   "mobile.documentTab": "Documento",
-  "tour.citation.title": "Risposte con citazioni",
-  "tour.citation.desc": "Clicca su qualsiasi citazione [1] per vedere la fonte esatta evidenziata nel tuo documento.",
-  "tour.mode.title": "Modalità prestazioni IA",
-  "tour.mode.desc": "Veloce per risposte rapide, Bilanciato per dettagli, Approfondito per analisi profonde.",
-  "tour.plus.title": "Altre opzioni",
-  "tour.plus.desc": "Imposta istruzioni IA personalizzate o esporta la conversazione.",
-  "tour.session.title": "Sessioni di chat",
-  "tour.session.desc": "Crea più chat per documento per esplorare argomenti diversi.",
   "billing.downgrade": "Passa a",
   "billing.upgradeSuccess": "Sono stati aggiunti {credits} crediti bonus al tuo account!",
   "billing.downgradeSuccess": "Piano modificato con successo. I tuoi crediti sono stati mantenuti.",
@@ -708,7 +700,7 @@
   "pricing.free.price": "$0",
   "pricing.free.cadence": "/mese",
   "pricing.free.summary": "Ideale per provare DocTalk con piccoli set di documenti e flussi di chat AI di base.",
-  "pricing.free.feature1": "300 crediti ogni mese + 500 crediti iniziali",
+  "pricing.free.feature1": "500 crediti iniziali, poi 300 al mese dal secondo mese",
   "pricing.free.feature2": "Caricamenti da 50 MB",
   "pricing.free.feature3": "3 documenti",
   "pricing.free.feature4": "Flash + modalità Pro AI limitata",
@@ -2187,6 +2179,10 @@
   "useCasesStudents.citations.p2b": " risolve questo problema fondando ogni risposta dell'IA sul testo effettivo del tuo documento. Ogni citazione numerata corrisponde a un passaggio specifico nel tuo articolo caricato. Clicca sulla citazione e il visualizzatore del documento scorrerà fino al testo esatto evidenziandolo.",
   "useCasesStudents.citations.p3": "Ciò significa che DocTalk non è un sostituto della lettura. È un acceleratore. Ti aiuta a trovare i passaggi giusti più velocemente, a comprendere sezioni complesse più rapidamente e a verificare ogni affermazione prima di includerla nel tuo lavoro. L'IA agisce come un assistente di ricerca che mostra sempre le sue fonti.",
   "useCasesStudents.citations.p4": "Per gli studenti preoccupati dell'integrità accademica, questa distinzione è cruciale. Usare DocTalk per individuare e comprendere il materiale di partenza in un articolo a cui hai legittimamente accesso non è diverso dall'usare una funzione di ricerca o un indice. Lo strumento ti aiuta a trovare le informazioni; la comprensione e l'analisi restano tue.",
+  "useCasesStudents.verifiedQuotes.title": "Le parole dell'autore, con numeri di pagina da citare",
+  "useCasesStudents.verifiedQuotes.p1": "Quando ti serve una citazione diretta e non un riassunto, usa Ricerca citazioni per trovare citazioni su un argomento. Ogni citazione restituita è stata verificata sul testo del tuo documento, riporta il numero di pagina e si copia con la citazione nel testo in formato APA.",
+  "useCasesStudents.verifiedQuotes.p2": "Salva le citazioni che userai. Ogni citazione salvata conserva fonte e pagina, così la prova di ogni affermazione della tua bozza è a un clic. Il piano gratuito conserva fino a 30 citazioni.",
+  "useCasesStudents.verifiedQuotes.p3": "Quando lo strato di testo di un documento è imperfetto, per esempio nei vecchi PDF scansionati in cui i trattini a fine riga possono essere stati uniti, la scheda della citazione lo segnala invece di promettere una corrispondenza esatta.",
   "useCasesStudents.multilingual.title": "Ricerca accademica multilingue",
   "useCasesStudents.multilingual.p1": "La ricerca accademica è un'impresa globale. Articoli innovativi vengono pubblicati in cinese, giapponese, tedesco, spagnolo e decine di altre lingue. Un ricercatore che studia tecniche di produzione potrebbe aver bisogno di esaminare articoli di ingegneria giapponesi. Uno storico potrebbe analizzare fonti primarie in lingua tedesca. Un ricercatore medico potrebbe imbattersi in studi clinici cinesi.",
   "useCasesStudents.multilingual.p2a": "DocTalk supporta ",
diff --git a/frontend/src/i18n/locales/ja.json b/frontend/src/i18n/locales/ja.json
index 1e868578..207bfcbc 100644
--- a/frontend/src/i18n/locales/ja.json
+++ b/frontend/src/i18n/locales/ja.json
@@ -167,7 +167,7 @@
   "home.cta.demoNow": "サンプルPDFを試す",
   "home.cta.loginUpload": "ログインしてPDFをアップロード",
   "home.cta.tryDemo": "デモを試す",
-  "auth.freeCredits": "新規ユーザーは500スタータークレジット + 月300クレジットを獲得",
+  "auth.freeCredits": "新規ユーザーは500スタータークレジットを獲得し、2か月目からは毎月300クレジット",
   "billing.title": "プランと請求",
   "billing.purchase": "購入",
   "billing.purchaseSuccess": "購入が完了しました！クレジットがアカウントに追加されました。",
@@ -212,7 +212,7 @@
   "auth.privacyNote": "あなたのドキュメントをAIモデルの学習に使用することはありません",
   "privacy.title": "プライバシーポリシー",
   "privacy.section1.title": "データ収集",
-  "privacy.section1.content": "認証のためにメールアドレス、分析のためにアップロードされたドキュメントを収集します。",
+  "privacy.section1.content": "認証のためにメールアドレス、分析のためにアップロードされたドキュメントを収集します。 登録前の主要なボタン（登録、サインイン、デモを試すなど）を使用した際に、参照元サイトのドメイン、リンク内のキャンペーンタグ（例：utm_source）、最初に訪れたページの種類も記録し、DocTalk がどのように見つけられているかを把握します。Cookie は設定せず、端末識別子も作成しません。サインインしている場合、これらのイベントは他の製品イベントと同様にお客様のアカウントに紐づけられます。",
   "privacy.section2.title": "データの使用",
   "privacy.section2.item1": "DocTalk はデータをモデル学習に使用しません",
   "privacy.section2.item2": "文書は、ご利用になる文書機能を提供するために処理されます。",
@@ -397,11 +397,11 @@
   "landing.faq.q4": "どのAIモデルが使えますか？",
   "landing.faq.a4": "DocTalk には2つのパフォーマンスモードがあります。Flash は高速な引用回答用、Pro は詳細なドキュメント分析用です。無料ユーザーは Flash と制限付きの Pro を使用できます。Plus では Pro の月間上限が撤廃されます。",
   "landing.faq.q5": "無料プランはありますか？",
-  "landing.faq.a5": "はい！無料アカウントには月300クレジットが含まれ、数百の質問に十分です。利用開始にクレジットカードは不要です。",
+  "landing.faq.a5": "はい！無料アカウントには月300クレジットが含まれ、数十の質問に十分です。利用開始にクレジットカードは不要です。",
   "landing.faq.q6": "長いドキュメントにも対応できますか？",
   "landing.faq.a6": "はい。文書ごとのページ上限はFreeが750、Plusが1,500、Proが3,000ページです。スマートチャンキングとセマンティック検索により、長い文書でも正確な回答を維持します。",
   "landing.finalCta.title": "PDFとチャットする準備はできましたか？",
-  "landing.finalCta.subtitle": "AI搭載のドキュメント分析で毎週何時間も節約している数千人の専門家に加わりましょう。",
+  "landing.finalCta.subtitle": "ドキュメントをアップロードすれば、1分以内に最初の引用付き回答が得られます。クレジットカードは不要です。",
   "landing.finalCta.demo": "無料デモを試す",
   "landing.finalCta.signUp": "無料で登録",
   "footer.product": "製品",
@@ -539,14 +539,6 @@
   "header.win98Mode": "Windows 98",
   "mobile.chatTab": "チャット",
   "mobile.documentTab": "ドキュメント",
-  "tour.citation.title": "引用付き回答",
-  "tour.citation.desc": "[1] の引用番号をクリックすると、ドキュメント内の該当箇所がハイライト表示されます。",
-  "tour.mode.title": "AIパフォーマンスモード",
-  "tour.mode.desc": "クイックは高速回答、バランスは詳細回答、ソローは深層分析に対応。",
-  "tour.plus.title": "その他のオプション",
-  "tour.plus.desc": "カスタムAI指示の設定や会話のエクスポートができます。",
-  "tour.session.title": "チャットセッション",
-  "tour.session.desc": "ドキュメントごとに複数のチャットを作成し、さまざまなトピックを探索できます。",
   "billing.downgrade": "ダウングレード先",
   "billing.upgradeSuccess": "{credits} ボーナスクレジットをアカウントに追加しました！",
   "billing.downgradeSuccess": "プランの変更が完了しました。クレジットは保持されています。",
@@ -708,7 +700,7 @@
   "pricing.free.price": "$0",
   "pricing.free.cadence": "/月",
   "pricing.free.summary": "少量の文書セットと主要なAIチャットワークフローでDocTalkを試すのに最適です。",
-  "pricing.free.feature1": "毎月300クレジット + 500スタータークレジット",
+  "pricing.free.feature1": "500スタータークレジット、2か月目から毎月300クレジット",
   "pricing.free.feature2": "50MBのアップロード",
   "pricing.free.feature3": "3つのドキュメント",
   "pricing.free.feature4": "Flash + 限定Pro AIモード",
@@ -1118,7 +1110,7 @@
   "featuresPerformance.mode.thorough.bestFor4": "代わりに Pro を使用してください",
   "featuresPerformance.mode.thorough.availability": "廃止",
   "featuresPerformance.whenToUse.title": "各モードの使い分け",
-  "featuresPerformance.whenToUse.quick": "Flash は、簡単な質問のデフォルトです。日付、定義、条項、簡単な要約が必要な場合は？ Flash は引用付きの回答を素早く返し、クレジット消費を抑えます。",
+  "featuresPerformance.whenToUse.quick": "は、簡単な質問のデフォルトです。日付、定義、条項、簡単な要約が必要な場合は？ Flash は引用付きの回答を素早く返し、クレジット消費を抑えます。",
   "featuresPerformance.whenToUse.balanced": "より深い作業向けです。詳細な説明、文脈を含む要約、または文書の複数のセクションにまたがる回答が必要な場合に使用してください。",
   "featuresPerformance.whenToUse.thorough": "新しいチャットでは廃止されました。より深い文書分析にはProをお使いください。",
   "featuresPerformance.whenToUse.switching": "同じ会話内で質問ごとにモードを切り替えられます。まずFlashで概要を掴み、より慎重な分析が必要なトピックではProに切り替えてください。各質問は使用したモードに基づいて個別に課金されます。",
@@ -2187,6 +2179,10 @@
   "useCasesStudents.citations.p2b": "は、すべてのAI回答を実際の文書テキストに基づかせることでこの問題を解決します。各番号付き引用は、アップロードされた論文内の特定の箇所に対応しています。引用をクリックすると、文書ビューアーが正確なテキストまでスクロールし、それをハイライトします。",
   "useCasesStudents.citations.p3": "これは、DocTalkが読書の代替品ではないことを意味します。それは加速器です。適切な箇所をより速く見つけ、複雑なセクションをより迅速に理解し、自身の研究に含める前にすべての主張を検証するのに役立ちます。AIは常に情報源を示すリサーチアシスタントとして機能します。",
   "useCasesStudents.citations.p4": "学術的誠実性を懸念する学生にとって、この区別は極めて重要です。正当にアクセスした論文のソース資料を見つけて理解するためにDocTalkを使用することは、検索機能や索引を使用することと何ら変わりません。このツールは情報を見つけるのを助けます。理解と分析はあなたのものです。",
+  "useCasesStudents.verifiedQuotes.title": "著者自身の言葉を、引用できるページ番号付きで",
+  "useCasesStudents.verifiedQuotes.p1": "要約ではなく直接引用が必要なときは、引用ファインダーでテーマごとに引用を探せます。返される引用はすべて文書のテキストと照合済みで、ページ番号が付き、APA 形式の文中引用付きでコピーできます。",
+  "useCasesStudents.verifiedQuotes.p2": "使う予定の引用は保存しておきましょう。保存した引用は出典とページを保持するので、下書きの各主張の根拠にいつでもワンクリックで戻れます。無料プランでは最大 30 件まで保存できます。",
+  "useCasesStudents.verifiedQuotes.p3": "文書のテキスト層が不完全な場合（古いスキャン PDF で行末のハイフンが結合されている可能性がある場合など）、引用カードはその旨を明示し、完全な一致を約束しません。",
   "useCasesStudents.multilingual.title": "多言語学術研究",
   "useCasesStudents.multilingual.p1": "学術研究は世界的な取り組みです。画期的な論文は中国語、日本語、ドイツ語、スペイン語、その他数十の言語で発表されています。製造技術を研究する研究者は、日本の工学論文をレビューする必要があるかもしれません。歴史家はドイツ語の一次資料を分析するかもしれません。医学研究者は中国の臨床試験に出会うかもしれません。",
   "useCasesStudents.multilingual.p2a": "DocTalkは、",
diff --git a/frontend/src/i18n/locales/ko.json b/frontend/src/i18n/locales/ko.json
index 16cdcd81..1577bd5d 100644
--- a/frontend/src/i18n/locales/ko.json
+++ b/frontend/src/i18n/locales/ko.json
@@ -167,7 +167,7 @@
   "home.cta.demoNow": "샘플 PDF 체험하기",
   "home.cta.loginUpload": "로그인하여 PDF 업로드",
   "home.cta.tryDemo": "데모 체험하기",
-  "auth.freeCredits": "신규 사용자는 시작 크레딧 500개 + 매월 300크레딧을 받습니다",
+  "auth.freeCredits": "신규 사용자는 시작 크레딧 500개를 받고, 두 번째 달부터 매월 300크레딧을 받습니다",
   "billing.title": "요금제 및 결제",
   "billing.purchase": "구매",
   "billing.purchaseSuccess": "구매 완료! 크레딧이 계정에 추가되었습니다.",
@@ -212,7 +212,7 @@
   "auth.privacyNote": "귀하의 문서를 AI 모델 학습에 사용하지 않습니다",
   "privacy.title": "개인정보 보호정책",
   "privacy.section1.title": "데이터 수집",
-  "privacy.section1.content": "인증을 위한 이메일 주소와 분석을 위해 업로드하는 문서를 수집합니다.",
+  "privacy.section1.content": "인증을 위한 이메일 주소와 분석을 위해 업로드하는 문서를 수집합니다. 가입 전에 주요 버튼(가입, 로그인, 데모 체험 등)을 사용하면 사용자를 안내한 웹사이트의 도메인, 링크의 캠페인 태그(예: utm_source), 처음 방문한 페이지의 유형도 기록하여 사람들이 DocTalk를 어떻게 찾는지 파악합니다. 쿠키를 설정하지 않으며 기기 식별자도 만들지 않습니다. 로그인한 경우 이 이벤트는 다른 제품 이벤트와 마찬가지로 계정에 연결됩니다.",
   "privacy.section2.title": "데이터 사용",
   "privacy.section2.item1": "DocTalk은 데이터를 모델 학습에 사용하지 않습니다",
   "privacy.section2.item2": "문서는 요청하신 문서 기능을 제공하기 위해 처리됩니다.",
@@ -397,11 +397,11 @@
   "landing.faq.q4": "어떤 AI 모델을 사용할 수 있나요?",
   "landing.faq.a4": "DocTalk은 빠른 인용 답변을 위한 Flash와 심층 문서 분석을 위한 Pro의 2가지 성능 모드를 제공합니다. 무료 사용자는 Flash와 제한된 Pro를 사용할 수 있습니다. Plus는 Pro 월별 사용 한도를 없애줍니다.",
   "landing.faq.q5": "무료 요금제가 있나요?",
-  "landing.faq.a5": "네! 무료 계정에는 월 500 크레딧이 포함되어 수백 개의 질문에 충분합니다. 시작하는 데 신용카드가 필요하지 않습니다.",
+  "landing.faq.a5": "네! 무료 계정에는 월 300 크레딧이 포함되어 수십 개의 질문에 충분합니다. 시작하는 데 신용카드가 필요하지 않습니다.",
   "landing.faq.q6": "긴 문서도 처리할 수 있나요?",
   "landing.faq.a6": "네. 문서당 페이지 한도는 Free 750페이지, Plus 1,500페이지, Pro 3,000페이지입니다. 스마트 청킹과 시맨틱 검색으로 긴 문서에서도 정확한 답변을 유지합니다.",
   "landing.finalCta.title": "PDF와 채팅할 준비가 되셨나요?",
-  "landing.finalCta.subtitle": "AI 기반 문서 분석으로 매주 시간을 절약하는 수천 명의 전문가에 합류하세요.",
+  "landing.finalCta.subtitle": "문서를 업로드하면 1분 안에 첫 인용 답변을 받을 수 있습니다. 신용카드가 필요하지 않습니다.",
   "landing.finalCta.demo": "무료 데모 체험",
   "landing.finalCta.signUp": "무료 가입",
   "footer.product": "제품",
@@ -539,14 +539,6 @@
   "header.win98Mode": "Windows 98",
   "mobile.chatTab": "채팅",
   "mobile.documentTab": "문서",
-  "tour.citation.title": "인용 답변",
-  "tour.citation.desc": "[1] 인용 번호를 클릭하면 문서에서 해당 출처가 강조 표시됩니다.",
-  "tour.mode.title": "AI 성능 모드",
-  "tour.mode.desc": "빠른 모드는 즉시 답변, 균형 모드는 상세 답변, 심층 모드는 깊은 분석을 제공합니다.",
-  "tour.plus.title": "추가 옵션",
-  "tour.plus.desc": "맞춤 AI 지시를 설정하거나 대화를 내보낼 수 있습니다.",
-  "tour.session.title": "채팅 세션",
-  "tour.session.desc": "문서당 여러 채팅을 만들어 다양한 주제를 탐색하세요.",
   "billing.downgrade": "다운그레이드",
   "billing.upgradeSuccess": "{credits} 보너스 크레딧이 계정에 추가되었습니다!",
   "billing.downgradeSuccess": "플랜이 성공적으로 변경되었습니다. 기존 크레딧은 유지됩니다.",
@@ -708,7 +700,7 @@
   "pricing.free.price": "$0",
   "pricing.free.cadence": "/월",
   "pricing.free.summary": "소규모 문서 세트와 핵심 AI 채팅 워크플로로 DocTalk을 사용해보기에 가장 적합합니다.",
-  "pricing.free.feature1": "매월 300크레딧 + 시작 크레딧 500개",
+  "pricing.free.feature1": "시작 크레딧 500개, 두 번째 달부터 매월 300크레딧",
   "pricing.free.feature2": "50 MB 업로드",
   "pricing.free.feature3": "3개 문서",
   "pricing.free.feature4": "Flash + 제한된 Pro AI 모드",
@@ -2187,6 +2179,10 @@
   "useCasesStudents.citations.p2b": "은(는) 모든 AI 답변을 실제 문서 텍스트에 근거하여 이 문제를 해결합니다. 각 번호 매겨진 인용은 업로드된 논문의 특정 구절에 해당합니다. 인용을 클릭하면 문서 뷰어가 해당 텍스트로 스크롤하여 강조 표시합니다.",
   "useCasesStudents.citations.p3": "이는 DocTalk가 읽기를 대체하는 도구가 아니라는 뜻입니다. 이는 촉진제입니다. DocTalk는 올바른 구절을 더 빨리 찾고, 복잡한 섹션을 더 빠르게 이해하며, 자신의 작업에 포함하기 전에 모든 주장을 검증할 수 있도록 도와줍니다. AI는 항상 출처를 보여주는 연구 조수 역할을 합니다.",
   "useCasesStudents.citations.p4": "학문적 진실성을 염려하는 학생들에게 이 구분은 매우 중요합니다. 합법적으로 접근한 논문에서 출처 자료를 찾고 이해하기 위해 DocTalk를 사용하는 것은 검색 기능이나 색인을 사용하는 것과 다르지 않습니다. 이 도구는 정보를 찾도록 도와줍니다. 이해와 분석은 여러분의 몫으로 남습니다.",
+  "useCasesStudents.verifiedQuotes.title": "저자가 직접 쓴 문장, 인용할 수 있는 페이지 번호와 함께",
+  "useCasesStudents.verifiedQuotes.p1": "요약이 아니라 직접 인용이 필요할 때는 인용문 파인더로 주제별 인용문을 찾으세요. 반환되는 모든 인용문은 문서 텍스트와 대조되었고 페이지 번호가 붙어 있으며, APA 본문 인용과 함께 복사됩니다.",
+  "useCasesStudents.verifiedQuotes.p2": "사용할 인용문은 저장해 두세요. 저장된 인용문은 출처와 페이지를 유지하므로 초안의 모든 주장 근거를 한 번의 클릭으로 확인할 수 있습니다. 무료 플랜은 최대 30개까지 저장할 수 있습니다.",
+  "useCasesStudents.verifiedQuotes.p3": "문서의 텍스트 레이어가 불완전한 경우(예: 오래된 스캔 PDF에서 줄 끝 하이픈이 합쳐졌을 수 있는 경우) 인용 카드는 완전히 일치한다고 약속하는 대신 그 사실을 표시합니다.",
   "useCasesStudents.multilingual.title": "다국어 학술 연구",
   "useCasesStudents.multilingual.p1": "학술 연구는 글로벌한 노력입니다. 획기적인 논문은 중국어, 일본어, 독일어, 스페인어 및 수십 개의 다른 언어로 출판됩니다. 제조 기술을 연구하는 연구자는 일본어 공학 논문을 검토해야 할 수 있습니다. 역사가는 독일어 1차 자료를 분석할 수도 있습니다. 의학 연구자는 중국어 임상 시험을 접할 수 있습니다.",
   "useCasesStudents.multilingual.p2a": "DocTalk은 ",
diff --git a/frontend/src/i18n/locales/pt.json b/frontend/src/i18n/locales/pt.json
index 12967c9f..e0d837e6 100644
--- a/frontend/src/i18n/locales/pt.json
+++ b/frontend/src/i18n/locales/pt.json
@@ -26,7 +26,7 @@
   "altsChatpdf.adv1": "7 formatos de documento vs apenas PDF",
   "altsChatpdf.adv2": "Destaque de citação clicável (vs números de página do ChatPDF)",
   "altsChatpdf.adv3": "11 idiomas de interface",
-  "altsChatpdf.adv4": "3 modos de IA (Rápido, Equilibrado, Profundo)",
+  "altsChatpdf.adv4": "Dois modos de desempenho de IA",
   "altsChatpdf.adv5": "Demo instantânea sem cadastro",
   "altsChatpdf.adv6": "Metade do preço do ChatPDF Plus ($9,99 vs $19,99)",
   "altsChatpdf.alt1CompareLink": "comparação detalhada com ChatPDF",
@@ -78,10 +78,10 @@
   "altsChatpdf.ctaButton": "Iniciar demo gratuita",
   "altsChatpdf.ctaDescription": "Converse com documentos de exemplo e veja respostas com IA e citações de fontes em tempo real. Nenhuma conta é necessária.",
   "altsChatpdf.ctaTitle": "Experimente o DocTalk grátis — sem necessidade de cadastro",
-  "altsChatpdf.faq1Answer": "Sim. O DocTalk suporta 7 formatos: PDF, DOCX, PPTX, XLSX, TXT, Markdown e URLs. Isso o torna a alternativa ao ChatPDF mais versátil em termos de suporte de formato.",
-  "altsChatpdf.faq1Question": "Qual alternativa ao ChatPDF suporta mais formatos de arquivo?",
-  "altsChatpdf.faq2Answer": "Google NotebookLM é completamente gratuito sem limites de consulta. O DocTalk oferece 300 créditos gratuitos por mês (sem cartão de crédito) mais uma demo sem cadastro. AskYourPDF também tem um plano gratuito com capacidade limitada.",
-  "altsChatpdf.faq2Question": "Existem alternativas gratuitas ao ChatPDF?",
+  "altsChatpdf.faq1Answer": "Google NotebookLM é completamente gratuito sem limites de consulta. O DocTalk oferece 300 créditos gratuitos por mês (sem cartão de crédito) mais uma demo sem cadastro. AskYourPDF também tem um plano gratuito com capacidade limitada.",
+  "altsChatpdf.faq1Question": "Existem alternativas gratuitas ao ChatPDF?",
+  "altsChatpdf.faq2Answer": "O DocTalk suporta 7 formatos: PDF, DOCX, PPTX, XLSX, TXT, Markdown e URLs. Isso o torna a alternativa ao ChatPDF mais versátil em termos de suporte de formato.",
+  "altsChatpdf.faq2Question": "Qual alternativa ao ChatPDF suporta mais formatos de arquivo?",
   "altsChatpdf.faq3Answer": "DocTalk oferece o destaque de citação mais avançado. Cada citação é clicável e rola até o texto fonte exato, destacado no documento. ChatDOC e AskYourPDF oferecem referências de página. NotebookLM fornece contexto embutido.",
   "altsChatpdf.faq3Question": "Qual alternativa tem as melhores citações?",
   "altsChatpdf.faq4Answer": "Humata é a melhor alternativa ao ChatPDF para equipes, com espaços de trabalho compartilhados e recursos de colaboração. AskYourPDF oferece acesso à API para integrações personalizadas. DocTalk foca em fluxos de trabalho individuais com citações verificáveis.",
@@ -135,7 +135,7 @@
   "altsHumata.adv3": "11 idiomas de interface (Humata: apenas em inglês)",
   "altsHumata.adv4": "Precificação baseada em créditos, mais previsível do que por página",
   "altsHumata.adv5": "Demonstração instantânea sem cadastro",
-  "altsHumata.adv6": "Three AI modos de desempenho",
+  "altsHumata.adv6": "Dois modos de desempenho de IA",
   "altsHumata.alt1CompareLink": "comparação detalhada do Humata",
   "altsHumata.alt1Desc1": "O DocTalk resolve as duas maiores lacunas do Humata: verificação de citações e suporte a idiomas. Enquanto o Humata fornece referências de número de página nas respostas, o DocTalk oferece destaque de citações em tempo real. Clique em qualquer citação de uma resposta da IA para rolar instantaneamente até o trecho exato da fonte e destacá-lo em um visualizador de documentos lado a lado. Essa verificação visual elimina a necessidade de procurar as fontes manualmente.",
   "altsHumata.alt1Desc2": "O DocTalk suporta sete formatos de documentos (PDF, DOCX, PPTX, XLSX, TXT, Markdown, URLs da web) com analisadores dedicados para cada um. A interface totalmente localizada suporta 11 idiomas, tornando-a muito mais acessível do que a experiência apenas em inglês do Humata. Dois modos de desempenho de IA (Flash e Pro) oferecem controle sobre o equilíbrio entre velocidade e profundidade.",
@@ -185,8 +185,8 @@
   "altsHumata.faqTitle": "Perguntas Frequentes",
   "altsHumata.heroDescription": "Humata é popular para chat de documentos com IA, mas tem limitações. Compare as melhores alternativas ao Humata incluindo DocTalk, ChatPDF, NotebookLM e mais.",
   "altsHumata.metaDescription": "Humata é popular para chat de documentos com IA, mas tem limitações. Compare as melhores alternativas ao Humata incluindo DocTalk, ChatPDF, NotebookLM e mais.",
-  "altsHumata.heroTitle": "7 melhores alternativas ao Humata em 2026",
-  "altsHumata.metaTitle": "7 melhores alternativas ao Humata em 2026",
+  "altsHumata.heroTitle": "5 melhores alternativas ao Humata em 2026",
+  "altsHumata.metaTitle": "5 melhores alternativas ao Humata em 2026",
   "altsHumata.keyAdvantages": "Principais Vantagens em Relação ao Humata",
   "altsHumata.linkCitations": "Destaque de citação",
   "altsHumata.linkFreeDemo": "Demonstração Gratuita",
@@ -196,7 +196,7 @@
   "altsHumata.noteText": "Se você precisa especificamente de colaboração em equipe ou análise de arquivos de vídeo, o Humata continua sendo a melhor opção. Essas alternativas são mais fortes para usuários individuais que precisam de melhores citações, suporte a formatos ou preços.",
   "altsHumata.relatedPages": "Páginas Relacionadas",
   "altsNotebooklm.adv1": "Real-time destaque de citação (click to scroll + highlight)",
-  "altsNotebooklm.adv2": "7 formatos de documento including DOCX, PPTX, XLSX",
+  "altsNotebooklm.adv2": "7 formatos de documento, incluindo DOCX, PPTX, XLSX",
   "altsNotebooklm.adv3": "11 idiomas de interface (NotebookLM: English primary)",
   "altsNotebooklm.adv4": "Não requer conta do Google",
   "altsNotebooklm.adv5": "Criptografia AES-256, sem dependência de fornecedor",
@@ -255,8 +255,8 @@
   "altsNotebooklm.faqTitle": "Perguntas Frequentes",
   "altsNotebooklm.heroDescription": "Google NotebookLM é popular para pesquisa com IA, mas tem limitações. Compare as melhores alternativas ao NotebookLM incluindo DocTalk, ChatPDF, AskYourPDF e mais.",
   "altsNotebooklm.metaDescription": "Google NotebookLM é popular para pesquisa com IA, mas tem limitações. Compare as melhores alternativas ao NotebookLM incluindo DocTalk, ChatPDF, AskYourPDF e mais.",
-  "altsNotebooklm.heroTitle": "7 melhores alternativas ao NotebookLM em 2026",
-  "altsNotebooklm.metaTitle": "7 melhores alternativas ao NotebookLM em 2026",
+  "altsNotebooklm.heroTitle": "6 melhores alternativas ao NotebookLM em 2026",
+  "altsNotebooklm.metaTitle": "6 melhores alternativas ao NotebookLM em 2026",
   "altsNotebooklm.keyAdvantages": "Principais vantagens sobre o NotebookLM",
   "altsNotebooklm.linkCitations": "Destaque de citação",
   "altsNotebooklm.linkFreeDemo": "Demonstração gratuita",
@@ -283,7 +283,7 @@
   "auth.errorAccountNotLinked": "Este email já está associado a outro método de login. Use seu método de login original.",
   "auth.errorDefault": "Ocorreu um erro durante o login. Tente novamente.",
   "auth.errorVerification": "O link de login expirou ou já foi utilizado. Solicite um novo.",
-  "auth.freeCredits": "Novos usuários recebem 500 créditos iniciais + 300 créditos/mês",
+  "auth.freeCredits": "Novos usuários recebem 500 créditos iniciais e, a partir do segundo mês, 300 créditos por mês",
   "auth.linkExpires": "Este link expira em 24 horas.",
   "auth.loginBenefits": "Entre para enviar documentos, salvar conversas e sincronizar entre dispositivos",
   "auth.loginToContinue": "Entre para continuar",
@@ -779,7 +779,7 @@
   "compareHumata.performanceTitle": "Desempenho e velocidade",
   "compareHumata.pricingCompetitor": "O Humata oferece um nível gratuito com 60 páginas por mês. Os planos pagos incluem Student (US$ 4,99/mês, 100 páginas), Expert (US$ 14,99/mês, 500 páginas) e Team (US$ 49/usuário/mês, páginas ilimitadas com colaboração). O preço por página significa que os custos aumentam conforme o tamanho do documento, o que pode ser imprevisível para quem trabalha com documentos longos.",
   "compareHumata.pricingDetailsLink": "detalhes de preços",
-  "compareHumata.pricingDocTalkPart1": "DocTalk uses a credit-based system that is more predictable. The plano gratuito includes 300 créditos por mês plus a",
+  "compareHumata.pricingDocTalkPart1": "O DocTalk usa um sistema baseado em créditos, mais previsível. O plano gratuito inclui 300 créditos por mês mais uma",
   "compareHumata.pricingDocTalkPart2": "Plus ($9.99/mês) inclui 3.000 créditos com modo Pro ilimitado e exportação. Pro ($19.99/mês) inclui 9.000 créditos com instruções personalizadas. Os créditos são consumidos por pergunta com base no modo de IA utilizado, não por página do documento. Ver",
   "compareHumata.pricingTitle": "Preços e plano gratuito",
   "compareHumata.quickComparison": "Comparação Rápida",
@@ -789,7 +789,7 @@
   "compareHumata.securityTitle": "Segurança e Privacidade",
   "compareHumata.tryDocTalkLink": "experimente o DocTalk primeiro",
   "compareHumata.verdictParagraph1": "O Humata conquistou um nicho com recursos de colaboração em equipe e suporte a vídeo. Para organizações que precisam de análise compartilhada de documentos com gerenciamento de funções, o plano Team oferece valor real. O plano Student, a US$ 4,99/mês, é um dos pontos de entrada mais baratos da categoria, embora o limite de 100 páginas seja restritivo.",
-  "compareHumata.verdictParagraph2": "DocTalk offers superior destaque de citação, broader format support (seven formats vs three), 11-language localization, and better value for individual users. The credit-based pricing is more predictable than page-based pricing, and the demo sem cadastro makes it the easiest to try.",
+  "compareHumata.verdictParagraph2": "O DocTalk oferece destaque de citação superior, suporte a mais formatos (sete formatos contra três), localização em 11 idiomas e melhor custo-benefício para usuários individuais. A precificação baseada em créditos é mais previsível do que a cobrança por página, e a demo sem cadastro o torna o mais fácil de experimentar.",
   "compareHumata.verdictParagraph3": "For individual users, researchers, and professionals, DocTalk is the stronger choice due to destaque de citação, format flexibility, and multilingual support. For teams needing collaboration features,",
   "compareHumata.verdictParagraph3End": "para ver se os recursos individuais atendem às suas necessidades antes de considerar o Humata Team.",
   "compareHumata.verdictTitle": "Veredicto",
@@ -969,7 +969,7 @@
   "comparePdfai.performanceDocTalk": "O DocTalk oferece dois modos de desempenho de IA. O modo Flash (DeepSeek V4 Flash) é otimizado para velocidade. O modo Pro (DeepSeek V4 Pro) oferece análises mais profundas para perguntas complexas. Essa flexibilidade permite que você ajuste a capacidade de IA a cada pergunta.",
   "comparePdfai.performanceTitle": "Desempenho e velocidade",
   "comparePdfai.pricingCompetitor": "O PDF.ai oferece um nível gratuito limitado, com um pequeno número de consultas por mês. Os planos pagos oferecem capacidade adicional. Os detalhes de preço mudaram ao longo do tempo e podem não estar listados de forma consistente no site.",
-  "comparePdfai.pricingDocTalkPart1": "DocTalk has transparent, predictable pricing. The plano gratuito includes 300 créditos por mês plus a",
+  "comparePdfai.pricingDocTalkPart1": "O DocTalk tem preços transparentes e previsíveis. O plano gratuito inclui 300 créditos por mês mais uma",
   "comparePdfai.pricingDocTalkPart2": "O plano Plus (US$ 9,99/mês) inclui 3.000 créditos com modo Pro e exportação ilimitados. O plano Pro (US$ 19,99/mês) inclui 9.000 créditos com instruções personalizadas. Pacotes de crédito estão disponíveis para recargas únicas. Ver",
   "comparePdfai.pricingTitle": "Preços e plano gratuito",
   "comparePdfai.quickComparison": "Comparação rápida",
@@ -1741,7 +1741,7 @@
   "pricing.eyebrow": "PREÇOS",
   "pricing.free.cadence": "/mês",
   "pricing.free.cta": "Comece grátis",
-  "pricing.free.feature1": "300 créditos todo mês + 500 créditos iniciais",
+  "pricing.free.feature1": "500 créditos iniciais e, a partir do segundo mês, 300 por mês",
   "pricing.free.feature2": "Uploads de 50 MB",
   "pricing.free.feature3": "3 documentos",
   "pricing.free.feature4": "Modos de IA Flash + Pro limitado",
@@ -1785,7 +1785,7 @@
   "privacy.ccpa.content": "Não vendemos informações pessoais. Residentes da Califórnia podem contatar privacy@doctalk.site para solicitar acesso, exclusão, correção ou informações de opt-out.",
   "privacy.noTraining": "O DocTalk não treina modelos com seus dados",
   "privacy.policyLink": "Política de privacidade",
-  "privacy.section1.content": "Coletamos seu endereço de e-mail para autenticação e os documentos que você envia para análise.",
+  "privacy.section1.content": "Coletamos seu endereço de e-mail para autenticação e os documentos que você envia para análise. Quando você usa botões importantes antes do cadastro (como cadastrar-se, entrar ou experimentar a demo), também registramos o domínio do site que indicou você, as tags de campanha do link (por exemplo, utm_source) e o tipo de página pela qual você chegou, para entender como as pessoas encontram o DocTalk. Nenhum cookie é definido e nenhum identificador de dispositivo é criado; se você estiver conectado, esses eventos ficam vinculados à sua conta, como nossos outros eventos de produto.",
   "privacy.section1.title": "Coleta de dados",
   "privacy.section2.item1": "O DocTalk não treina modelos com seus dados",
   "privacy.section2.item2": "Os documentos são processados para fornecer os recursos documentais que você solicita.",
@@ -1906,14 +1906,6 @@
   "toolbar.searchPlaceholder": "Pesquisar texto...",
   "toolbar.zoomIn": "Ampliar",
   "toolbar.zoomOut": "Reduzir",
-  "tour.citation.desc": "Clique em qualquer citação [1] para ver a fonte exata destacada no seu documento.",
-  "tour.citation.title": "Respostas com citações",
-  "tour.mode.desc": "Rápido para respostas instantâneas, Equilibrado para mais detalhes, Completo para análise profunda.",
-  "tour.mode.title": "Modos de desempenho IA",
-  "tour.plus.desc": "Defina instruções personalizadas de IA ou exporte sua conversa.",
-  "tour.plus.title": "Mais opções",
-  "tour.session.desc": "Crie múltiplos chats por documento para explorar diferentes temas.",
-  "tour.session.title": "Sessões de chat",
   "upload.chooseFile": "Escolher arquivo",
   "upload.dragDrop": "Arraste e solte seu documento aqui",
   "upload.error": "Erro durante o processamento",
@@ -2207,6 +2199,10 @@
   "useCasesStudents.citations.p2b": "do DocTalk resolve isso fundamentando cada resposta da IA no texto real do seu documento. Cada citação numerada corresponde a um trecho específico no seu artigo enviado. Clique na citação e o visualizador de documentos rola até o texto exato e o destaca.",
   "useCasesStudents.citations.p3": "Isso significa que o DocTalk não substitui a leitura. Ele é um acelerador. Ajuda você a encontrar os trechos certos mais rapidamente, compreender seções complexas mais depressa e verificar cada afirmação antes de incluí-la no seu próprio trabalho. A IA atua como um assistente de pesquisa que sempre mostra suas fontes.",
   "useCasesStudents.citations.p4": "Para estudantes preocupados com integridade acadêmica, essa distinção é crucial. Usar o DocTalk para localizar e compreender material fonte em um artigo ao qual você tem acesso legítimo não é diferente de usar uma função de busca ou índice. A ferramenta ajuda você a encontrar informação, não a criá-la.",
+  "useCasesStudents.verifiedQuotes.title": "As palavras do autor, com números de página para citar",
+  "useCasesStudents.verifiedQuotes.p1": "Quando você precisa de uma citação direta, e não de um resumo, use o Localizador de citações para encontrar citações sobre um tema. Cada citação retornada foi conferida com o texto do seu documento, traz o número da página e é copiada com a citação no texto no formato APA.",
+  "useCasesStudents.verifiedQuotes.p2": "Salve as citações que você vai usar. Cada citação salva mantém a fonte e a página, então a evidência de cada afirmação do seu rascunho fica a um clique. O plano gratuito guarda até 30 citações.",
+  "useCasesStudents.verifiedQuotes.p3": "Quando a camada de texto de um documento é imperfeita, por exemplo em PDFs digitalizados antigos em que hífens de quebra de linha podem ter sido unidos, o cartão da citação informa isso em vez de prometer uma correspondência exata.",
   "useCasesStudents.citations.title": "Por que as citações importam para o trabalho acadêmico",
   "useCasesStudents.cta.description": "Experimente a demo gratuita do DocTalk com documentos de exemplo. Veja como o destaque de citação alimentado por IA funciona em artigos reais. Sem necessidade de conta.",
   "useCasesStudents.cta.title": "Comece a analisar artigos — grátis, sem cadastro",
diff --git a/frontend/src/i18n/locales/zh.json b/frontend/src/i18n/locales/zh.json
index e87e3b1b..f50eef58 100644
--- a/frontend/src/i18n/locales/zh.json
+++ b/frontend/src/i18n/locales/zh.json
@@ -170,7 +170,7 @@
   "home.cta.demoNow": "立即体验示例 PDF",
   "home.cta.loginUpload": "登录上传你的 PDF",
   "home.cta.tryDemo": "试用示例",
-  "auth.freeCredits": "新用户获得 500 启动额度 + 每月 300 额度",
+  "auth.freeCredits": "新用户获得 500 启动额度，从第二个月起每月 300 额度",
   "billing.title": "计划与账单",
   "billing.purchase": "购买",
   "billing.purchaseSuccess": "购买成功！额度已添加到您的账户。",
@@ -217,7 +217,7 @@
   "auth.privacyNote": "我们不使用你的文档训练 AI 模型",
   "privacy.title": "隐私政策",
   "privacy.section1.title": "数据收集",
-  "privacy.section1.content": "我们收集你的邮箱用于身份验证，以及你上传的文档用于分析。",
+  "privacy.section1.content": "我们收集你的邮箱用于身份验证，以及你上传的文档用于分析。 当你在注册前使用关键按钮（例如注册、登录或试用演示）时，我们还会记录把你引荐过来的网站域名、链接中的推广标签（例如 utm_source）以及你最初进入的页面类型，以便了解大家是如何找到 DocTalk 的。这不会设置 Cookie，也不会生成设备标识符；如果你已登录，这些事件会像我们的其他产品事件一样与你的账号关联。",
   "privacy.section2.title": "数据使用",
   "privacy.section2.item1": "DocTalk 不使用您的数据训练模型",
   "privacy.section2.item2": "文档用于提供您请求的文档功能。",
@@ -411,11 +411,11 @@
   "landing.faq.q4": "可以使用哪些 AI 模型？",
   "landing.faq.a4": "DocTalk 提供两种性能模式：Flash 用于快速引用回答，Pro 用于更深层次的文档分析。免费用户可以使用 Flash 和有限的 Pro。Plus 取消 Pro 的月度限制。",
   "landing.faq.q5": "有免费计划吗？",
-  "landing.faq.a5": "有！免费账户每月包含 500 积分，足够数十个问题使用。无需信用卡即可开始。",
+  "landing.faq.a5": "有！免费账户每月包含 300 积分，足够数十个问题使用。无需信用卡即可开始。",
   "landing.faq.q6": "能处理长文档吗？",
   "landing.faq.a6": "可以。每份文档的页数上限为 Free 750 页、Plus 1,500 页、Pro 3,000 页；智能分块和语义搜索可在长文档中保持回答准确。",
   "landing.finalCta.title": "准备好与 PDF 对话了吗？",
-  "landing.finalCta.subtitle": "加入数千名专业人士，每周通过 AI 文档分析节省数小时。",
+  "landing.finalCta.subtitle": "上传一份文档，一分钟内就能得到第一个带引用的答案。无需信用卡。",
   "landing.finalCta.demo": "免费试用 Demo",
   "landing.finalCta.signUp": "免费注册",
   "footer.product": "产品",
@@ -557,14 +557,6 @@
   "header.win98Mode": "Windows 98",
   "mobile.chatTab": "对话",
   "mobile.documentTab": "文档",
-  "tour.citation.title": "引用答案",
-  "tour.citation.desc": "点击任意 [1] 引用编号，查看文档中高亮标注的原文出处。",
-  "tour.mode.title": "AI 性能模式",
-  "tour.mode.desc": "快速模式回复更快，均衡模式更详细，深度模式提供深入分析。",
-  "tour.plus.title": "更多选项",
-  "tour.plus.desc": "设置自定义 AI 指令或导出对话记录。",
-  "tour.session.title": "对话会话",
-  "tour.session.desc": "为每篇文档创建多个对话，探索不同主题。",
   "billing.downgrade": "降级到",
   "billing.upgradeSuccess": "已向你的账户补充 {credits} 奖励额度！",
   "billing.downgradeSuccess": "方案已成功变更。你的额度已保留。",
@@ -713,7 +705,7 @@
   "pricing.free.price": "$0",
   "pricing.free.cadence": "/月",
   "pricing.free.summary": "适合使用少量文档和核心 AI 对话工作流试用 DocTalk。",
-  "pricing.free.feature1": "每月 300 额度 + 500 启动额度",
+  "pricing.free.feature1": "500 启动额度，从第二个月起每月 300 额度",
   "pricing.free.feature2": "50 MB 上传限制",
   "pricing.free.feature3": "3 个文档",
   "pricing.free.feature4": "Flash + 有限的 Pro AI 模式",
@@ -1123,8 +1115,8 @@
   "featuresPerformance.mode.thorough.bestFor4": "请改用 Pro",
   "featuresPerformance.mode.thorough.availability": "已停用",
   "featuresPerformance.whenToUse.title": "各模式使用场景",
-  "featuresPerformance.whenToUse.quick": "Flash 是处理简单问题的默认模式。需要日期、定义、条款或简单总结？Flash 会快速返回带引用的答案，并保持较低的积分消耗。",
-  "featuresPerformance.whenToUse.balanced": "均衡模式适用于更深入的工作。当您需要详细解释、带上下文的总结或连接文档多个部分的答案时，可使用此模式。",
+  "featuresPerformance.whenToUse.quick": "是处理简单问题的默认模式。需要日期、定义、条款或简单总结？Flash 会快速返回带引用的答案，并保持较低的积分消耗。",
+  "featuresPerformance.whenToUse.balanced": "适用于更深入的工作。当您需要详细解释、带上下文的总结或连接文档多个部分的答案时，可使用此模式。",
   "featuresPerformance.whenToUse.thorough": "详尽模式已对新的对话停用。请使用 Pro 进行更深入的文档分析。",
   "featuresPerformance.whenToUse.switching": "您可以在同一对话中在问题之间切换模式。先用 Flash 了解概况，当主题需要更细致的分析时再切换到 Pro。每个问题根据所用模式独立计费。",
   "featuresPerformance.faq.title": "常见问题",
@@ -1200,7 +1192,7 @@
   "featuresDemo.faq.q3": "演示后会怎样？",
   "featuresDemo.faq.a3": "不会自动发生任何事。您可以随意使用演示。准备上传您自己的文档时，创建免费账户（300 额度/月）或升级到 Plus（$9.99/月，3,000 额度）或 Pro（$19.99/月，9,000 额度）。",
   "featuresDemo.faq.q4": "可以免费上传自己的文档吗？",
-  "featuresDemo.faq.a4": "是的。创建免费账户（无需信用卡）后，您每月可上传最多 3 份文档（每份 50MB），并获得 300 积分。使用 Flash 模式足够提出数十个问题。",
+  "featuresDemo.faq.a4": "是的。创建免费账户（无需信用卡）后，您最多可上传 3 份文档（每份 50MB），并每月获得 300 积分。使用 Flash 模式足够提出数十个问题。",
   "featuresDemo.faq.q5": "能获得多少额度？",
   "featuresDemo.faq.a5": "演示模式不消耗积分。创建账户后，免费方案每月提供 300 积分。Flash 为低成本问题优化，Pro 进行深度分析消耗更多积分。Plus（$9.99）提供 3,000 积分，Pro（$19.99）提供 9,000 积分。",
   "featuresDemo.cta.title": "准备好试试了吗？",
@@ -1670,7 +1662,7 @@
   "altsChatpdf.adv1": "7 种文档格式 vs 仅 PDF",
   "altsChatpdf.adv2": "实时引用高亮，一键验证",
   "altsChatpdf.adv3": "11 种界面语言",
-  "altsChatpdf.adv4": "三种 AI 性能模式",
+  "altsChatpdf.adv4": "两种 AI 性能模式",
   "altsChatpdf.adv5": "免注册即时演示",
   "altsChatpdf.adv6": "ChatPDF Plus 价格的一半（$9.99 vs $19.99）",
   "altsChatpdf.alt2Title": "AskYourPDF——最适合研究人员",
@@ -1816,7 +1808,7 @@
   "altsHumata.adv3": "11 种界面语言（Humata：仅英语）",
   "altsHumata.adv4": "积分制定价，比按页计费更可预测",
   "altsHumata.adv5": "免注册即时演示",
-  "altsHumata.adv6": "三种 AI 性能模式",
+  "altsHumata.adv6": "两种 AI 性能模式",
   "altsHumata.alt2Title": "ChatPDF——最受欢迎的替代方案",
   "altsHumata.alt2Desc1": "ChatPDF 是最知名的 AI 文档聊天工具，在该品类中拥有最大的用户群。简洁是其最大的优势——上传 PDF，提问，获取答案。",
   "altsHumata.alt2Desc2": "代价是功能有限。ChatPDF 仅支持 PDF 文件，没有引用高亮，界面主要是英语。Plus 计划 $19.99/月也比 Humata 和 DocTalk 更贵。",
@@ -1908,7 +1900,7 @@
   "compareHumata.multilingualLink": "多语言支持",
   "compareHumata.pricingTitle": "定价与免费层级",
   "compareHumata.pricingCompetitor": "Humata 提供每月 60 页的免费层级。付费计划包括学生版（$4.99/月，100 页）、专家版（$14.99/月，500 页）和团队版（$49/用户/月）。按页计费意味着成本随文档长度增加。",
-  "compareHumata.pricingDocTalkPart1": "DocTalk 使用更可预测的积分制。免费层级每月包含 500 积分，加上",
+  "compareHumata.pricingDocTalkPart1": "DocTalk 使用更可预测的积分制。免费层级每月包含 300 积分，加上",
   "compareHumata.noSignupDemoLink": "免注册演示",
   "compareHumata.pricingDocTalkPart2": "Plus（每月 9.99 美元）包含 3,000 积分，可使用不受限制的 Pro 模式和导出功能。Pro（每月 19.99 美元）包含 9,000 积分，并可自定义指令。积分按问题消耗，根据所使用的 AI 模式计算，而不是按文档页数。查看",
   "compareHumata.pricingDetailsLink": "定价详情",
@@ -2001,7 +1993,7 @@
   "comparePdfai.languageSupportDocTalk": "DocTalk 提供 11 种语言的完整界面本地化：英语、中文、西班牙语、日语、德语、法语、韩语、葡萄牙语、意大利语、阿拉伯语和印地语。",
   "comparePdfai.pricingTitle": "定价与免费层级",
   "comparePdfai.pricingCompetitor": "PDF.ai 提供有限的免费层级，每月少量查询。付费计划提供额外容量。定价信息不够透明。",
-  "comparePdfai.pricingDocTalkPart1": "DocTalk 有透明、可预测的定价。免费层级每月包含 500 积分，加上",
+  "comparePdfai.pricingDocTalkPart1": "DocTalk 有透明、可预测的定价。免费层级每月包含 300 积分，加上",
   "comparePdfai.noSignupDemoLink": "免注册演示",
   "comparePdfai.pricingDocTalkPart2": "Plus（每月 9.99 美元）包含 3,000 积分，可使用不受限制的 Pro 模式和导出功能。Pro（每月 19.99 美元）包含 9,000 积分，并可自定义指令。积分包可用于一次性充值。查看",
   "comparePdfai.fullPricingLink": "完整定价",
@@ -2139,13 +2131,13 @@
   "useCasesStudents.breadcrumb.home": "首页",
   "useCasesStudents.breadcrumb.useCases": "应用场景",
   "useCasesStudents.breadcrumb.current": "学生与学术研究",
-  "useCasesStudents.hero.title": "面向学生和学术研究者的 AI 论文分析",
-  "useCasesStudents.metaTitle": "面向学生和学术研究者的 AI 论文分析",
-  "useCasesStudents.hero.subtitle": "上传研究论文、教科书或学位论文，获取带有页面级引用的 AI 回答。花更少的时间阅读，更多的时间理解。",
-  "useCasesStudents.metaDescription": "上传研究论文、教科书或学位论文，获取带有页面级引用的 AI 回答。花更少的时间阅读，更多的时间理解。",
+  "useCasesStudents.hero.title": "论文 AI：读论文、做文献阅读，每个回答都标出原文页码",
+  "useCasesStudents.metaTitle": "论文 AI：读论文、做文献阅读，每个回答都标出原文页码",
+  "useCasesStudents.hero.subtitle": "上传论文、教材或学位论文，直接提问。DocTalk 只根据您上传的文档作答，每个结论都附带原文页码，点击即可跳到原文核对。",
+  "useCasesStudents.metaDescription": "上传论文、教材或学位论文，用学术 AI 读论文、做文献阅读。每个回答都附带可点击核对的原文页码；需要原话时，引用查找器还能找出与原文核对过的引文，一键复制为 APA 文内引用。",
   "useCasesStudents.hero.cta": "免费分析您的第一篇论文",
   "useCasesStudents.challenge.title": "学术阅读的挑战",
-  "useCasesStudents.challenge.p1": "学术研究需要大量的阅读。一个典型的博士生每年阅读超过 100 篇论文，在文献综述阶段这个数字急剧攀升。每篇论文平均 20 到 50 页密集的专业文本。手动审阅一篇论文需要一到三个小时，取决于主题复杂程度和您对该领域的熟悉程度。",
+  "useCasesStudents.challenge.p1": "学术研究离不开大量的文献阅读。一个典型的博士生每年要读 100 多篇论文，文献综述阶段还会急剧增加。每篇论文平均有 20 到 50 页专业文本，读完一篇往往需要一到三个小时，取决于主题的难度和您对该领域的熟悉程度。",
   "useCasesStudents.challenge.p2": "挑战不仅仅在于阅读量。研究人员需要从论文中提取特定数据点：方法论细节、统计结果、关键发现，以及这些发现与该领域其他工作的关系。略读是有风险的，因为错过方法论部分的一个关键注意事项可能会破坏整个文献综述。",
   "useCasesStudents.challenge.p3": "本科生面临不同但相关的挑战。他们经常被要求阅读教科书章节、补充材料和学术文章，而这些主题他们还在学习中。没有深厚的专业知识，理解学术语言既缓慢又令人沮丧。考试准备加剧了压力，需要快速理解多个章节和论文。",
   "useCasesStudents.challenge.p4": "传统 AI 聊天机器人可以帮助回答一般问题，但对于学术工作有一个关键缺陷：它们从训练数据生成答案，而非您的特定文档。如果 AI 虚构统计数据或错误引用发现，而您将其纳入论文，您的学术信誉就会受到损害。学术研究需要可验证的、基于来源的回答。",
@@ -2154,12 +2146,12 @@
   "useCasesStudents.helps.summarize.description": "上传一篇 50 页的论文并提问“主要发现是什么？” DocTalk 返回结构化摘要，每个要点都有编号引用指向论述所在的确切段落。以前需要一小时的工作现在只需几秒。",
   "useCasesStudents.helps.methodologies.title": "提取方法论",
   "useCasesStudents.helps.methodologies.description": "提问“这项研究使用了什么研究方法？”或“描述实验设计。” DocTalk 识别方法论部分并提取详细描述，包括样本量、变量和统计方法。",
-  "useCasesStudents.helps.literature.title": "加速文献综述",
-  "useCasesStudents.helps.literature.description": "逐一上传论文并提出对比问题。“主要结论是什么？”和“这个方法论与上一篇论文有何不同？”使用经过验证的来源引用构建您的文献综述。",
+  "useCasesStudents.helps.literature.title": "加快文献阅读与综述",
+  "useCasesStudents.helps.literature.description": "逐篇上传论文，再提出对比问题：“主要结论是什么？”“这篇的方法和上一篇有何不同？”每个回答都附带原文出处，文献综述里的每一句都有据可查。",
   "useCasesStudents.helps.exams.title": "准备考试",
   "useCasesStudents.helps.exams.description": "上传教科书章节并提出练习题。“第 3 章的关键概念是什么？”或“解释第一类错误和第二类错误的区别。”每个回答都指向教科书段落以供复习。",
-  "useCasesStudents.helps.quotes.title": "查找引文和页码",
-  "useCasesStudents.helps.quotes.description": "需要在论文中引用特定段落？让 DocTalk 帮您定位。“作者在哪里讨论了研究的局限性？” AI 精确定位段落并提供页码用于引用。",
+  "useCasesStudents.helps.quotes.title": "找原话，带页码",
+  "useCasesStudents.helps.quotes.description": "要在论文里引用某段原文？用引用查找器按主题查找原句：每条都与文档文本核对过，附带页码，可一键复制为 APA 文内引用。",
   "useCasesStudents.docTypes.title": "支持的学术文档类型",
   "useCasesStudents.docTypes.intro": "DocTalk 支持",
   "useCasesStudents.docTypes.formatLink": "7 种文档格式",
@@ -2192,6 +2184,10 @@
   "useCasesStudents.citations.p2b": "通过将每个 AI 回答植根于您的实际文档文本来解决这个问题。每个编号引用对应您上传论文中的特定段落。点击引用，文档查看器滚动到确切文本并高亮显示。",
   "useCasesStudents.citations.p3": "这意味着 DocTalk 不是阅读的替代品，而是加速器。它帮助您更快找到正确的段落，更快理解复杂章节，并在将其纳入自己的工作之前验证每个论断。AI 充当一个始终展示来源的研究助手。",
   "useCasesStudents.citations.p4": "对于关心学术诚信的学生来说，这一区别至关重要。使用 DocTalk 在您合法获取的论文中定位和理解来源材料，与使用搜索功能或目录没有区别。工具帮助您找到信息；理解和分析仍然是您的。",
+  "useCasesStudents.verifiedQuotes.title": "作者的原话，附带可以引用的页码",
+  "useCasesStudents.verifiedQuotes.p1": "需要直接引用而不是概述时，用引用查找器按主题查找原句。返回的每一条都与文档文本核对过，附带页码，并可一键复制为 APA 文内引用。",
+  "useCasesStudents.verifiedQuotes.p2": "把要用的引文保存下来。每条保存的引文都保留出处和页码，论文草稿里每个论断的依据随时一键可查。免费版最多可保存 30 条引文。",
+  "useCasesStudents.verifiedQuotes.p3": "如果文档的文字层不够完整，例如较旧的扫描版 PDF 中断行处的连字符可能被合并，引文卡片会如实注明，而不会声称与原文完全一致。",
   "useCasesStudents.multilingual.title": "多语言学术研究",
   "useCasesStudents.multilingual.p1": "学术研究是全球性事业。开创性论文以中文、日文、德文、西班牙文和其他数十种语言发表。研究制造技术的研究人员可能需要审阅日文工程论文。历史学家可能分析德语原始资料。医学研究者可能遇到中文临床试验。",
   "useCasesStudents.multilingual.p2a": "DocTalk 支持",
diff --git a/frontend/src/lib/onboarding.ts b/frontend/src/lib/onboarding.ts
deleted file mode 100644
index 357dcb52..00000000
--- a/frontend/src/lib/onboarding.ts
+++ /dev/null
@@ -1,79 +0,0 @@
-import { driver } from 'driver.js';
-import 'driver.js/dist/driver.css';
-
-const TOUR_STORAGE_KEY = 'doctalk_tour_completed';
-
-export function shouldShowTour(): boolean {
-  if (typeof window === 'undefined') return false;
-  try {
-    return !localStorage.getItem(TOUR_STORAGE_KEY);
-  } catch {
-    return false; // localStorage unavailable in private browsing
-  }
-}
-
-export function markTourCompleted(): void {
-  try {
-    localStorage.setItem(TOUR_STORAGE_KEY, '1');
-  } catch {} // localStorage unavailable in private browsing
-}
-
-export function startOnboardingTour(
-  t: (key: string) => string,
-  options?: { showModeSelector?: boolean }
-) {
-  // Skip on mobile — layout is different with tabs
-  if (typeof window !== 'undefined' && window.innerWidth < 640) return;
-
-  const steps: Array<{ element: string; popover: { title: string; description: string; side: 'left' | 'right' | 'top' | 'bottom' } }> = [
-    {
-      element: '[data-tour="chat-area"]',
-      popover: {
-        title: t('tour.citation.title'),
-        description: t('tour.citation.desc'),
-        side: 'left',
-      },
-    },
-  ];
-
-  if (options?.showModeSelector !== false) {
-    steps.push({
-      element: '[data-tour="mode-selector"]',
-      popover: {
-        title: t('tour.mode.title'),
-        description: t('tour.mode.desc'),
-        side: 'bottom',
-      },
-    });
-  }
-
-  steps.push(
-    {
-      element: '[data-tour="plus-menu"]',
-      popover: {
-        title: t('tour.plus.title'),
-        description: t('tour.plus.desc'),
-        side: 'top',
-      },
-    },
-    {
-      element: '[data-tour="session-dropdown"]',
-      popover: {
-        title: t('tour.session.title'),
-        description: t('tour.session.desc'),
-        side: 'bottom',
-      },
-    },
-  );
-
-  const d = driver({
-    showProgress: true,
-    steps,
-    onDestroyed: () => {
-      markTourCompleted();
-    },
-    popoverClass: 'doctalk-tour-popover',
-  });
-
-  d.drive();
-}
diff --git a/frontend/tests/free-plan-credit-copy.test.cjs b/frontend/tests/free-plan-credit-copy.test.cjs
new file mode 100644
index 00000000..8b36723b
--- /dev/null
+++ b/frontend/tests/free-plan-credit-copy.test.cjs
@@ -0,0 +1,58 @@
+const test = require('node:test');
+const assert = require('node:assert/strict');
+const fs = require('node:fs');
+const path = require('node:path');
+
+// The free plan's monthly allowance is stated in ~40 marketing strings. Five translated landing FAQs (the answer
+// also ships as FAQPage JSON-LD) and three comparison pages promised 500 credits for months while the backend
+// granted 300, and three landing FAQs promised "hundreds of questions" where English says "dozens".
+
+const LOCALES = ['en', 'zh', 'ja', 'ko', 'es', 'de', 'fr', 'pt', 'it', 'ar', 'hi'];
+const messages = Object.fromEntries(
+  LOCALES.map((l) => [l, JSON.parse(fs.readFileSync(path.resolve(__dirname, `../src/i18n/locales/${l}.json`), 'utf8'))]),
+);
+const config = fs.readFileSync(path.resolve(__dirname, '../../backend/app/core/config.py'), 'utf8');
+const FREE = config.match(/PLAN_FREE_MONTHLY_CREDITS:\s*int\s*=\s*(\d+)/)[1];
+
+const asciiDigits = (s) => s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
+const statesFree = (s) => new RegExp(`(?<![\\d,.])${FREE}(?![\\d,.])`).test(asciiDigits(s));
+const allowanceKeys = Object.keys(messages.en).filter((key) =>
+  new RegExp(`(?<![\\d,.])${FREE}(?![\\d,.])[^.]*credit`, 'i').test(messages.en[key]),
+);
+
+test('the English strings that state the free allowance were found', () => {
+  assert.ok(allowanceKeys.includes('landing.faq.a5'));
+  assert.ok(allowanceKeys.length >= 30, `only ${allowanceKeys.length} keys found`);
+});
+
+test('every locale states the backend free allowance wherever English does', () => {
+  for (const key of allowanceKeys) {
+    for (const locale of LOCALES) {
+      const value = messages[locale][key];
+      assert.ok(value, `${locale}: ${key} is missing`);
+      assert.ok(statesFree(value), `${locale}: ${key} does not say ${FREE} — "${value.slice(0, 90)}"`);
+    }
+  }
+});
+
+test('no locale promises hundreds of questions on the free allowance', () => {
+  const hundreds = /hundreds|数百|上百|수백|cientos|centaines|Hunderte|centenas|centinaia|सैकड़ों|مئات/i;
+  for (const key of allowanceKeys) {
+    for (const locale of LOCALES) assert.doesNotMatch(messages[locale][key], hundreds, `${locale}: ${key}`);
+  }
+});
+
+test('month one is described as the starter pool first, never as starter credits plus the monthly grant', () => {
+  // Signup grants the 500 starter credits and stamps the monthly clock, so the first 300 arrives in month two
+  // (auth_service.py, credit_service.ensure_monthly_credits). "500 starter + 300/month" read as 800 in month one.
+  for (const key of ['auth.freeCredits', 'pricing.free.feature1']) {
+    for (const locale of LOCALES) {
+      const value = asciiDigits(messages[locale][key]);
+      assert.match(value, /(?<![\d,.])500(?![\d,.])/, `${locale}: ${key} lost the starter credits`);
+      assert.ok(statesFree(value), `${locale}: ${key} lost the monthly grant`);
+      assert.doesNotMatch(value, /\+/, `${locale}: ${key} adds the starter credits to the monthly grant`);
+      assert.ok(value.indexOf('500') < value.indexOf(FREE), `${locale}: ${key} should lead with the starter pool`);
+    }
+  }
+  assert.match(messages.en['pricing.free.feature1'], /second month/);
+});
diff --git a/frontend/tests/marketing-counts-copy.test.cjs b/frontend/tests/marketing-counts-copy.test.cjs
new file mode 100644
index 00000000..3b44755c
--- /dev/null
+++ b/frontend/tests/marketing-counts-copy.test.cjs
@@ -0,0 +1,141 @@
+const test = require('node:test');
+const assert = require('node:assert/strict');
+const fs = require('node:fs');
+const path = require('node:path');
+
+// Counts that marketing copy states about DocTalk. The zh/de/fr/pt ChatPDF and Humata alternatives pages
+// kept advertising three AI modes after Thorough was retired (pt still listed Quick, Balanced and Thorough),
+// the pt Humata and NotebookLM alternatives pages titled themselves "7 best" while listing five and six, and
+// eight home pages kept "Join thousands of professionals" for seven months after English dropped it.
+
+const LOCALES = ['en', 'zh', 'ja', 'ko', 'es', 'de', 'fr', 'pt', 'it', 'ar', 'hi'];
+const messages = Object.fromEntries(
+  LOCALES.map((l) => [l, JSON.parse(fs.readFileSync(path.resolve(__dirname, `../src/i18n/locales/${l}.json`), 'utf8'))]),
+);
+
+const DIGIT_BLOCKS = [0x0660, 0x06f0, 0x0966, 0xff10]; // Arabic-Indic, Extended Arabic-Indic, Devanagari, full-width
+const asciiDigits = (s) =>
+  DIGIT_BLOCKS.reduce(
+    (out, zero) => out.replace(new RegExp(`[\\u${zero.toString(16).padStart(4, '0')}-\\u${(zero + 9).toString(16).padStart(4, '0')}]`, 'g'), (d) => String(d.charCodeAt(0) - zero)),
+    s,
+  );
+const numbersIn = (s) => (asciiDigits(s).match(/\d+(?:[.,]\d+)*/g) || []).filter((n) => !/^(19|20)\d\d$/.test(n));
+
+// The count has to sit next to the locale's word for "mode", so a stray "two" elsewhere in a paragraph does
+// not count. Arabic says "two modes" with the dual (وضعان / وضعين / وضعا / وضعي) and no numeral.
+const AR = '\\u0621-\\u064A';
+const modeCount = (n) => ({
+  en: new RegExp(`\\b(${n.en}|${n.digit})\\b(?:[\\s-]+[A-Za-z0-9]+){0,3}?[\\s-]+modes?\\b`, 'i'),
+  zh: new RegExp(`(${n.zh}|${n.digit})\\s*(种|个)[^，。；：、]{0,16}?模式`),
+  ja: new RegExp(`(${n.ja}|${n.digit})\\s*(つの)?[^、。]{0,24}?モード`),
+  ko: new RegExp(`(${n.ko}|${n.digit})\\s?(가지|개)[^.,]{0,16}?모드|(${n.ko}|${n.digit})\\s?모드`),
+  es: new RegExp(`\\b(${n.es}|${n.digit})\\s+modos\\b`, 'i'),
+  de: new RegExp(`\\b(${n.de}|${n.digit})\\s+(?:[\\w-]+\\s+){0,2}?[\\w-]*(modi|modus)\\b`, 'i'),
+  fr: new RegExp(`\\b(${n.fr}|${n.digit})\\s+modes\\b`, 'i'),
+  pt: new RegExp(`\\b(${n.pt}|${n.digit})\\s+(?:\\w+\\s+)?modos\\b`, 'i'),
+  it: new RegExp(`\\b(${n.it}|${n.digit})\\s+modalit`, 'i'),
+  ar: new RegExp(`(?<![${AR}])(?:[وبل])?(?:ال)?(${n.ar})(?![${AR}])|(?<![\\d.,])${n.digit}\\s+(أوضاع|أنماط)`),
+  hi: new RegExp(`(?<![\\p{L}\\p{M}\\d])(${n.hi}|${n.digit})(?![\\p{L}\\p{M}\\d])\\s+(?:\\S+\\s+){0,3}?मोड`, 'u'),
+});
+const TWO_MODES = modeCount({
+  digit: '2', en: 'two', zh: '两', ja: '二', ko: '두', es: 'dos', de: 'zwei', fr: 'deux', pt: 'dois|duas', it: 'due',
+  hi: 'दो', ar: 'وضعان|وضعين|وضعا|وضعي',
+});
+const THREE_MODES = modeCount({
+  digit: '3', en: 'three', zh: '三', ja: '三', ko: '세', es: 'tres', de: 'drei', fr: 'trois', pt: 'três|three', it: 'tre',
+  hi: 'तीन', ar: 'ثلاثة أوضاع|ثلاث[ةه]? أنماط',
+});
+const modeCountKeys = Object.keys(messages.en).filter((key) => TWO_MODES.en.test(messages.en[key]));
+
+test('the English strings that count the answer modes were found', () => {
+  assert.ok(modeCountKeys.includes('altsChatpdf.adv4'));
+  assert.ok(modeCountKeys.length >= 25, `only ${modeCountKeys.length} keys found`);
+});
+
+test('every locale says two answer modes wherever English does', () => {
+  const wrong = [];
+  for (const key of modeCountKeys) {
+    for (const locale of LOCALES) {
+      const value = messages[locale][key] ?? '';
+      if (!TWO_MODES[locale].test(asciiDigits(value))) wrong.push(`${locale}: ${key} — "${value.slice(0, 90)}"`);
+    }
+  }
+  assert.deepEqual(wrong, []);
+});
+
+test('no string in any locale says DocTalk has three answer modes', () => {
+  const wrong = [];
+  for (const locale of LOCALES) {
+    for (const [key, value] of Object.entries(messages[locale])) {
+      if (THREE_MODES[locale].test(asciiDigits(value))) wrong.push(`${locale}: ${key} — "${value.slice(0, 90)}"`);
+    }
+  }
+  assert.deepEqual(wrong, []);
+});
+
+const alternativesDir = path.resolve(__dirname, '../src/app/alternatives');
+const withoutComments = (source) =>
+  source.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
+const alternativesPages = fs
+  .readdirSync(alternativesDir, { withFileTypes: true })
+  .filter((entry) => entry.isDirectory())
+  .map((entry) => {
+    const dir = path.join(alternativesDir, entry.name);
+    const content = fs.readdirSync(dir).find((file) => file.endsWith('AltsContent.tsx'));
+    const sections = content ? [...withoutComments(fs.readFileSync(path.join(dir, content), 'utf8')).matchAll(/t\('(\w+)\.alt(\d+)Title'\)/g)] : [];
+    const englishTitles = [...fs.readFileSync(path.join(dir, 'page.tsx'), 'utf8').matchAll(/title:\s*'([^']+)'/g)].map((m) => m[1]);
+    return { page: entry.name, ns: sections[0]?.[1], listed: new Set(sections.map((m) => m[2])).size, englishTitles };
+  });
+
+test('every alternatives page was found with the sections it renders', () => {
+  assert.equal(alternativesPages.length, 5);
+  for (const { page, ns, listed, englishTitles } of alternativesPages) {
+    assert.ok(ns, `${page}: no t('<ns>.alt<N>Title') sections found`);
+    assert.ok(listed >= 5, `${page} lists ${listed}`);
+    assert.ok(englishTitles.length >= 2, `${page}: English page.tsx titles not found`);
+  }
+});
+
+test('every alternatives page title states the number of alternatives the page lists, and no other count', () => {
+  const wrong = [];
+  for (const { page, ns, listed, englishTitles } of alternativesPages) {
+    // English search titles are hardcoded in page.tsx and may leave the count out; a count they state must be right.
+    for (const title of englishTitles) {
+      if (numbersIn(title).some((n) => n !== String(listed))) wrong.push(`en: ${page}/page.tsx says "${title}", page lists ${listed}`);
+    }
+    for (const key of [`${ns}.heroTitle`, `${ns}.metaTitle`]) {
+      for (const locale of LOCALES) {
+        const numbers = numbersIn(messages[locale][key] ?? '');
+        if (!numbers.includes(String(listed)) || numbers.some((n) => n !== String(listed))) {
+          wrong.push(`${locale}: ${key} says "${messages[locale][key]}", page lists ${listed}`);
+        }
+      }
+    }
+  }
+  assert.deepEqual(wrong, []);
+});
+
+// DocTalk has no user base in the thousands to cite. If that changes, point this at the evidence first.
+const USER_COUNT_CLAIMS = {
+  en: /\b(thousands|hundreds|millions) of (users|professionals|researchers|students|teams|customers|people)\b|\bjoin (thousands|hundreds|millions)\b/i,
+  zh: /(数千|数万|成千上万|上千|数百|上百)(名|位|个)?(专业人士|用户|研究人员|学生|团队|客户)/,
+  ja: /数(千|万|百)(人|名)/,
+  ko: /수(천|만|백)\s?명/,
+  es: /\b(miles|cientos|millones) de (usuarios|profesionales|investigadores|estudiantes|equipos|clientes|personas)\b/i,
+  de: /\b(Tausende|Hunderte|Millionen) (von )?(Nutzern?|Fachleuten?|Profis|Forschern?|Studierenden|Teams|Kunden|Menschen)\b/i,
+  fr: /\b(milliers|centaines|millions) de (utilisateurs|professionnels|chercheurs|étudiants|équipes|clients|personnes)\b/i,
+  pt: /\b(milhares|centenas|milhões) de (usuários|profissionais|pesquisadores|estudantes|equipes|clientes|pessoas)\b/i,
+  it: /\b(migliaia|centinaia|milioni) di (utenti|professionisti|ricercatori|studenti|team|clienti|persone)\b/i,
+  ar: /(آلاف|مئات|ملايين) (من )?(المستخدمين|المحترفين|الباحثين|الطلاب|الفرق|العملاء)/,
+  hi: /(हज़ारों|हजारों|सैकड़ों|लाखों) (उपयोगकर्ताओं|पेशेवरों|शोधकर्ताओं|छात्रों)/,
+};
+
+test('no locale claims a user base DocTalk does not have', () => {
+  const wrong = [];
+  for (const locale of LOCALES) {
+    for (const [key, value] of Object.entries(messages[locale])) {
+      if (USER_COUNT_CLAIMS[locale].test(value)) wrong.push(`${locale}: ${key} — "${value.slice(0, 90)}"`);
+    }
+  }
+  assert.deepEqual(wrong, []);
+});
diff --git a/frontend/tests/reader-rtl-panels.test.cjs b/frontend/tests/reader-rtl-panels.test.cjs
new file mode 100644
index 00000000..a825d5f0
--- /dev/null
+++ b/frontend/tests/reader-rtl-panels.test.cjs
@@ -0,0 +1,30 @@
+const test = require('node:test');
+const assert = require('node:assert/strict');
+const fs = require('node:fs');
+const path = require('node:path');
+
+// react-resizable-panels 4.x has no right-to-left support. In a production build the Arabic reader mounted the panel
+// group, the locale then set <html dir="rtl">, and the next layout pass looked up the constraints of a panel index
+// that does not exist ("Panel constraints not found for index 2") — the whole reader crashed for every Arabic
+// desktop user (found in the 2026-09-23 site test; 3/3 on a local production build of main). The group therefore
+// always lays out left to right, and each pane's content keeps the page's own direction.
+
+const READER = path.resolve(__dirname, '../src/app/d/[documentId]/DocumentReaderPageClient.tsx');
+const stripComments = (code) => code.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
+
+test('the desktop panel group always lays out left to right', () => {
+  const code = stripComments(fs.readFileSync(READER, 'utf8'));
+  const group = code.indexOf('<Group orientation="horizontal"');
+  assert.ok(group !== -1, 'the desktop reader still uses the resizable panel group');
+  const wrapper = code.lastIndexOf('<div', group);
+  assert.match(code.slice(wrapper, group), /dir="ltr"/, 'the element wrapping the panel group must pin dir="ltr"');
+});
+
+test('each pane keeps the page direction for its own content', () => {
+  const code = stripComments(fs.readFileSync(READER, 'utf8'));
+  assert.match(code, /const contentDir = LOCALES\.find\(\(l\) => l\.code === locale\)\?\.dir === 'rtl' \? 'rtl' : 'ltr';/);
+  const group = code.slice(code.indexOf('<Group orientation="horizontal"'), code.indexOf('</Group>'));
+  const panes = group.match(/className="dt-reader-pane[^"]*"[^>]*>/g) || [];
+  assert.equal(panes.length, 2, 'both panes are found');
+  for (const pane of panes) assert.match(pane, /dir=\{contentDir\}/);
+});
diff --git a/frontend/tests/session-limit.test.cjs b/frontend/tests/session-limit.test.cjs
index 921ab386..eb1a4e1d 100644
--- a/frontend/tests/session-limit.test.cjs
+++ b/frontend/tests/session-limit.test.cjs
@@ -208,7 +208,7 @@ for (const isDemo of [false, true]) {
   test(`session limit analytics include request document and demo context (${isDemo}) outside reader routes`, async () => {
     const h = harness({ isDemo, createError: limitError });
     const events = [];
-    const analytics = load('lib/analytics.ts');
+    const analytics = load('lib/analytics.ts', { './attribution': load('lib/attribution.ts') });
     const originalWindow = global.window;
     const originalFetch = global.fetch;
     try {
diff --git a/frontend/tests/students-academic.test.cjs b/frontend/tests/students-academic.test.cjs
new file mode 100644
index 00000000..89e9f33b
--- /dev/null
+++ b/frontend/tests/students-academic.test.cjs
@@ -0,0 +1,61 @@
+const test = require('node:test');
+const assert = require('node:assert/strict');
+const fs = require('node:fs');
+const path = require('node:path');
+
+// Academic long-tail on /use-cases/students (plan .collab/plans/2026-09-22-next-strategy.md §2.2, owner-approved
+// 2026-09-22 including the zh/es search titles): deepen the one academic page instead of adding a sibling, and
+// give the cohort that retains (thesis writers) the verified-quote story in every locale.
+
+const src = path.resolve(__dirname, '../src');
+const LOCALES = ['en', 'zh', 'ja', 'ko', 'es', 'de', 'fr', 'pt', 'it', 'ar', 'hi'];
+const messages = Object.fromEntries(
+  LOCALES.map((l) => [l, JSON.parse(fs.readFileSync(path.join(src, 'i18n/locales', `${l}.json`), 'utf8'))]),
+);
+const SECTION = ['title', 'p1', 'p2', 'p3'].map((k) => `useCasesStudents.verifiedQuotes.${k}`);
+
+test('the verified-quotes section renders on the students page and exists in all eleven locales', () => {
+  const content = fs.readFileSync(path.join(src, 'app/use-cases/students/StudentsContent.tsx'), 'utf8');
+  for (const key of SECTION) assert.ok(content.includes(`'${key}'`), `StudentsContent does not render ${key}`);
+  for (const locale of LOCALES) {
+    for (const key of SECTION) assert.ok(messages[locale][key]?.trim(), `${locale}: ${key} is missing`);
+  }
+});
+
+test('the verified-quotes copy names the feature as the product does and never promises a word-for-word match', () => {
+  // Trust copy is per kind (.claude/rules/frontend.md, Quote Finder UI): a word-for-word claim belongs only to
+  // page_text results, so marketing copy about every result must not make it anywhere on this page.
+  for (const locale of LOCALES) {
+    const page = Object.entries(messages[locale]).filter(([key]) => key.startsWith('useCasesStudents.'));
+    const text = SECTION.map((key) => messages[locale][key]).join(' ');
+    assert.doesNotMatch(
+      page.map(([, value]) => value).join(' '),
+      /word-for-word|verbatim|逐字|一字不差|逐語|一字一句|そのまま|그대로|축어|wörtlich|Wort für Wort|mot pour mot|mot à mot|textuellement|palabra por palabra|palavra por palavra|parola per parola|حرفي|शब्दशः|हूबहू/i,
+      `${locale}: unconditional verbatim claim`,
+    );
+    assert.ok(text.includes(messages[locale]['quoteFinder.toolbarLabel']), `${locale}: does not name the feature as the UI does`);
+  }
+});
+
+test('the zh and es search titles carry the academic long-tail terms', () => {
+  const zh = messages.zh;
+  const es = messages.es;
+  assert.match(zh['useCasesStudents.metaTitle'], /论文\s*AI/);
+  for (const term of ['读论文', '文献阅读']) {
+    assert.ok(`${zh['useCasesStudents.metaTitle']} ${zh['useCasesStudents.metaDescription']}`.includes(term), `zh meta lacks ${term}`);
+  }
+  assert.match(es['useCasesStudents.metaTitle'], /IA para investigar gratis/i);
+});
+
+test('the citations feature page links to the students page in the reader\'s locale', () => {
+  // Its use-case cards passed a bare path, so /zh/features/citations sent readers to the English students page.
+  const content = fs.readFileSync(path.join(src, 'app/features/citations/CitationsContent.tsx'), 'utf8');
+  const hrefs = [...content.matchAll(/\bhref:\s*([^,\n}]+)/g)].map((m) => m[1].trim());
+  assert.ok(hrefs.length > 0);
+  for (const value of hrefs) assert.match(value, /^href\(/, `link bypasses the locale helper: ${value}`);
+});
+
+test('the ranking academic blog post links to the students page', () => {
+  const post = fs.readFileSync(path.resolve(__dirname, '../content/blog/ai-research-paper-summarizer.md'), 'utf8');
+  assert.match(post, /\]\(\/use-cases\/students\)/);
+});
```
