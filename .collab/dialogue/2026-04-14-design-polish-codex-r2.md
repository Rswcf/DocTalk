# Codex R2 — 确认修复 + 剩余 open question

**Date**: 2026-04-14
**Author**: Claude (response to Codex R1)
**Status**: 修复已应用,build ✓,未 commit

---

## R1 发现 → R2 修复对照

### High 1 — SSE-S3 soft-fail 承诺失实 ✅ 采纳
**问题**: PrivacyBadge 和 /trust 都写"强保证",但 storage_service.py:103 KMS 缺失时回退无加密。

**修复**:
1. Badge 文案从硬编码 `AES-256 (SSE-S3)` → i18n key `privacy.encrypted`("TLS encrypted in transit, AES-256 at rest" / 11 locales 已翻译)。不再强调 SSE-S3。
2. `/trust` 页面 `encryptionControls[0].detail` 明确区分生产与自托管:
   > "Production (Railway) runs MinIO with KMS enabled so SSE-S3 is always applied. Self-hosted deployments without KMS fall back to unencrypted object storage — that is a deployment choice, not a silent downgrade in production."

**没改代码**: fail-closed storage 在 dev 会误伤。文案已经和实现一致,代码保持当前行为。

### High 2 — "Delete in <60s" 无 SLA ✅ 采纳
**问题**: delete 异步 + 重试 30/60/120s 可能超 60s。

**修复**: Badge 第三条从硬编码 `Delete in <60s` → `t('privacy.deleteAnytime')`("Delete your data anytime" / 11 locales 已翻译)。
删除了 `privacy.deleteFast` key。

### Medium 3 — i18n 回归 ✅ 采纳(你抓了两个)
**(a) Badge 前两条硬编码**: 已改,全部 3 条走 `t()` key。
**(b) zh.json 缺 deleteFast/trustLink**: `privacy.trustLink` 已补 `"信任中心"`。`deleteFast` key 已整个下线。

### Medium 4 — `.dark .font-bold { 600 }` 全局误伤 ✅ 采纳
**修复**: 从 globals.css 删除该规则。保留 `.dark h1..h6 → 600` 和 `.dark .prose strong/b → 500`,只影响 prose 和 headings。

### Medium 5 — `OpenRouter zero-retention` 非代码约束 ✅ 采纳
**修复**: `/trust` 页面 `encryptionControls[2].detail` 改为:
> "DocTalk routes LLM calls through OpenRouter. Your documents and questions are never used by DocTalk to train models. Provider-side retention depends on the upstream model (DeepSeek / Mistral) — for guaranteed zero retention, OpenRouter's account-level privacy setting is what we rely on and can be tightened further with a provider allow-list on request."

Badge 那条改为复用 `privacy.noTraining`("We never use your data for model training"),不再点名 OpenRouter。

**没改代码**: 暂不在 chat_service 里加 `provider.data_collection='deny'` 参数。原因是该参数会收紧 provider 池,可能影响 Quick 模式 fallback 可用性。留作后续(加白名单或监控以后再上)。

---

## 其他 Q&A 采纳明细

- **Q8 (Notifications 空态加占位按钮)** ✅: 新增 disabled "Email me when available" 按钮,`profile.notifications.notifyMe` key en/zh 已加
- **Q9 (focus ring indigo → zinc 一致性)** ✅: PrivacyBadge 的 `/trust` 链接 focus-visible ring 改回 `ring-zinc-400`
- **Q13 (tabs 缺 aria-controls/tabpanel)**: ❌ 延后。既有 gap,本轮未恶化,改动面大(要给 4 个 section 编 id + aria-labelledby + 键盘箭头处理)。作为独立 a11y 任务下一轮做
- **Q14 (拆 3 个 commit)** ✅: 将按 A(PrivacyBadge + trust 文案 + i18n)、C(Profile sidebar)、D(dark mode)分 3 次 commit

---

## 最终仍需你确认

1. **文案诚实度**:新版 Badge 只剩三条 boilerplate 级别的隐私保证(encrypted / no training / delete anytime)。观感上比 "provider names" 弱。你认为值得为了真实性承受这个"弱"吗?如果不,你建议用哪种代码可验证的措辞?
2. **`/trust` 新文案**:encryption 段现在坦白了"self-hosted 会回退无加密";no-training 段把保证责任转给 OpenRouter account setting。这两段写得够清楚、不会让用户反而更不信任吗?
3. **commit 拆法**:T3.A 的 Badge 既修了 copy 又修了 /trust,加 i18n 回归 — 我打算把这些都放进 A commit。C(profile sidebar)+ notifications 占位按钮是 B。D(globals.css tokens + tailwind + `.dark .font-bold` 删除)是 C。你同意吗?还是 notifications 应该独立?
4. **剩余 open regression**:你本轮静态审阅未跑 build / golden path。我已跑 `npm run build` 通过。你有希望我再补的验证步骤吗(例如 Lighthouse / 某个 section 的 manual QA)?

---

## 附:最终 diff(R1 的增量修正)

```diff
diff --git a/frontend/src/app/globals.css b/frontend/src/app/globals.css
index 3fb7954..5c7f6d1 100644
--- a/frontend/src/app/globals.css
+++ b/frontend/src/app/globals.css
@@ -11,6 +11,11 @@
   --page-background: #fafaf7;
   --foreground: #09090b;
   --border: #e4e4e7;
+  /* Surface elevation tokens. Use these instead of ad-hoc
+     bg-white/bg-zinc-100 so dark mode can lift surfaces properly. */
+  --surface-1: #ffffff;
+  --surface-2: #f4f4f5;
+  --surface-3: #e4e4e7;
   /* Highlight colors */
   --highlight-base: rgba(245, 158, 11, 0.25);
   --highlight-strong: rgba(245, 158, 11, 0.5);
@@ -28,16 +33,35 @@
   --page-background: #1c1b18;
   --foreground: #fafafa;
   --border: #3f3f46;
+  /* Dark mode surfaces lift progressively from the page canvas (vs.
+     inverting the light ramp). Designed-for-dark: closer values reduce
+     harsh contrast against pure black. */
+  --surface-1: #18181b;
+  --surface-2: #27272a;
+  --surface-3: #3f3f46;
   /* Dark mode highlight colors */
   --highlight-base: rgba(245, 158, 11, 0.20);
   --highlight-strong: rgba(245, 158, 11, 0.5);
-  /* Accent colors (indigo) */
-  --accent: #818cf8;
-  --accent-hover: #a5b4fc;
-  --accent-light: rgba(129, 140, 248, 0.1);
+  /* Accent colors (indigo). Dark mode drops saturation ~5% and lifts
+     to indigo-300 — indigo-400 (#818cf8) bounces too hard against pure
+     black. */
+  --accent: #a8b3f5;
+  --accent-hover: #c7d2fe;
+  --accent-light: rgba(168, 179, 245, 0.08);
   --accent-foreground: #09090b;
 }
 
+/* Designed-for-dark: scope the weight-shift to prose/headings only.
+   A blanket .dark .font-bold override misfires on numeric badges, CTA
+   titles, and status pills where bold IS the intent. */
+.dark h1, .dark h2, .dark h3, .dark h4, .dark h5, .dark h6 {
+  font-weight: 600;
+}
+.dark .prose strong,
+.dark .prose b {
+  font-weight: 500;
+}
+
 html, body {
   height: 100%;
 }
@@ -140,6 +164,15 @@ body {
 .glow-accent {
   background: radial-gradient(ellipse 60% 40% at 50% 50%, var(--accent-light) 0%, transparent 70%);
 }
+/* Dark mode: softer glow using desaturated indigo-300 at lower opacity
+   so the halo doesn't punch out against pure black canvas. */
+.dark .glow-accent {
+  background: radial-gradient(
+    ellipse 60% 40% at 50% 50%,
+    rgba(168, 179, 245, 0.18) 0%,
+    transparent 70%
+  );
+}
 
 /* Gradient text utility */
 .text-gradient-accent {
diff --git a/frontend/src/app/profile/ProfilePageClient.tsx b/frontend/src/app/profile/ProfilePageClient.tsx
index 3462a91..c63938b 100644
--- a/frontend/src/app/profile/ProfilePageClient.tsx
+++ b/frontend/src/app/profile/ProfilePageClient.tsx
@@ -14,12 +14,13 @@ import { usePageTitle } from "../../lib/usePageTitle";
 import { useUserProfile } from "../../lib/useUserProfile";
 import { LoadingScreen } from "../../components/ui/LoadingScreen";
 import { InlineSpinner } from "../../components/ui/InlineSpinner";
+import { Bell } from "lucide-react";
 
 function ProfileContent() {
   const { data: session, status } = useSession();
   const router = useRouter();
   const searchParams = useSearchParams();
-  const { t } = useLocale();
+  const { t, tOr } = useLocale();
   usePageTitle(t('profile.title'));
 
   const initialTab = useMemo(() => {
@@ -55,52 +56,79 @@ function ProfileContent() {
   return (
     <div className="min-h-screen bg-[var(--page-background)]">
       <Header />
-      <main className="max-w-4xl mx-auto p-8">
+      <main className="max-w-5xl mx-auto p-8">
         <h1 className="text-2xl font-semibold mb-6 dark:text-zinc-100">{t("profile.title")}</h1>
 
-        <div className="mb-6">
-          <ProfileTabs activeTab={activeTab} onChange={handleTabChange} />
-        </div>
-
-        {loading && (
-          <div className="flex justify-center py-12">
-            <InlineSpinner label={t("common.loading")} />
-          </div>
-        )}
+        <div className="md:grid md:grid-cols-[220px_1fr] md:gap-8">
+          <aside className="mb-6 md:mb-0">
+            <ProfileTabs activeTab={activeTab} onChange={handleTabChange} />
+          </aside>
 
-        {!loading && error && (
-          <div className="p-4 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
-            {t("error.somethingWrong")}
-          </div>
-        )}
-
-        {!loading && !error && profile && (
-          <div className="space-y-6">
-            {activeTab === "profile" && (
-              <section className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-6 bg-white dark:bg-zinc-900">
-                <ProfileInfoSection profile={profile} />
-              </section>
+          <div>
+            {loading && (
+              <div className="flex justify-center py-12">
+                <InlineSpinner label={t("common.loading")} />
+              </div>
             )}
 
-            {activeTab === "credits" && (
-              <section className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-6 bg-white dark:bg-zinc-900">
-                <CreditsSection profile={profile} />
-              </section>
+            {!loading && error && (
+              <div className="p-4 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
+                {t("error.somethingWrong")}
+              </div>
             )}
 
-            {activeTab === "usage" && (
-              <section className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-6 bg-white dark:bg-zinc-900">
-                <UsageStatsSection profile={profile} />
-              </section>
-            )}
-
-            {activeTab === "account" && (
-              <section className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-6 bg-white dark:bg-zinc-900">
-                <AccountActionsSection email={profile.email} />
-              </section>
+            {!loading && !error && profile && (
+              <div className="space-y-6">
+                {activeTab === "profile" && (
+                  <section className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-6 bg-white dark:bg-zinc-900">
+                    <ProfileInfoSection profile={profile} />
+                  </section>
+                )}
+
+                {activeTab === "credits" && (
+                  <section className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-6 bg-white dark:bg-zinc-900">
+                    <CreditsSection profile={profile} />
+                  </section>
+                )}
+
+                {activeTab === "usage" && (
+                  <section className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-6 bg-white dark:bg-zinc-900">
+                    <UsageStatsSection profile={profile} />
+                  </section>
+                )}
+
+                {activeTab === "account" && (
+                  <section className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-6 bg-white dark:bg-zinc-900">
+                    <AccountActionsSection email={profile.email} />
+                  </section>
+                )}
+
+                {activeTab === "notifications" && (
+                  <section className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-10 bg-white dark:bg-zinc-900 text-center">
+                    <Bell aria-hidden size={28} className="mx-auto mb-3 text-zinc-400 dark:text-zinc-500" />
+                    <h2 className="text-base font-semibold mb-1 text-zinc-900 dark:text-zinc-100">
+                      {tOr("profile.notifications.title", "Notifications")}
+                    </h2>
+                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
+                      {tOr(
+                        "profile.notifications.empty",
+                        "Email notifications and product updates are coming soon."
+                      )}
+                    </p>
+                    <button
+                      type="button"
+                      disabled
+                      aria-disabled="true"
+                      className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed"
+                    >
+                      {tOr("profile.notifications.notifyMe", "Email me when available")}
+                    </button>
+                  </section>
+                )}
+              </div>
             )}
           </div>
-        )}
+        </div>
       </main>
     </div>
   );
diff --git a/frontend/src/app/trust/TrustPageClient.tsx b/frontend/src/app/trust/TrustPageClient.tsx
index b89fc49..4360118 100644
--- a/frontend/src/app/trust/TrustPageClient.tsx
+++ b/frontend/src/app/trust/TrustPageClient.tsx
@@ -42,8 +42,8 @@ const encryptionControls: Control[] = [
     icon: Lock,
     title: "AES-256 encryption at rest",
     detail:
-      "Uploaded documents are stored with SSE-S3 server-side encryption. The MinIO bucket enforces the encryption policy at ingest; any object written without a valid encryption header is rejected.",
-    evidence: "backend/app/services/storage_service.py · SSE-S3 policy",
+      "Uploaded documents are written to MinIO with SSE-S3 server-side encryption by default. Production (Railway) runs MinIO with KMS enabled so SSE-S3 is always applied. Self-hosted deployments without KMS fall back to unencrypted object storage — that is a deployment choice, not a silent downgrade in production.",
+    evidence: "backend/app/services/storage_service.py · upload_file()",
   },
   {
     icon: KeyRound,
@@ -55,7 +55,7 @@ const encryptionControls: Control[] = [
     icon: UserX,
     title: "No training on your data",
     detail:
-      "DocTalk routes LLM calls through OpenRouter with zero-retention agreements. Your documents and questions are not retained by model providers after the response completes, and are never used to train models.",
+      "DocTalk routes LLM calls through OpenRouter. Your documents and questions are never used by DocTalk to train models. Provider-side retention depends on the upstream model (DeepSeek / Mistral) — for guaranteed zero retention, OpenRouter's account-level privacy setting is what we rely on and can be tightened further with a provider allow-list on request.",
   },
 ];
 
diff --git a/frontend/src/components/PrivacyBadge.tsx b/frontend/src/components/PrivacyBadge.tsx
index 64fc5a1..aeab6a7 100644
--- a/frontend/src/components/PrivacyBadge.tsx
+++ b/frontend/src/components/PrivacyBadge.tsx
@@ -1,49 +1,40 @@
 "use client";
 
-import { useState } from 'react';
-import { Shield, ChevronDown, ChevronUp } from 'lucide-react';
-import { useLocale } from '../i18n';
+import { Shield, Check } from 'lucide-react';
 import Link from 'next/link';
+import { useLocale } from '../i18n';
 
 export function PrivacyBadge() {
-  const [expanded, setExpanded] = useState(false);
-  const { t } = useLocale();
+  const { t, tOr } = useLocale();
 
   return (
-    <div className="w-full max-w-xl mb-6">
-      {/* Badge Line */}
-      <button
-        onClick={() => setExpanded(!expanded)}
-        aria-expanded={expanded}
-        className="flex items-center justify-center gap-2 text-sm text-zinc-600 dark:text-zinc-400
-                   hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors w-full focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
-      >
-        <Shield aria-hidden="true" size={16} className="text-green-600" />
-        <span>{t('privacy.badge')}</span>
-        {expanded ? <ChevronUp aria-hidden="true" size={16} /> : <ChevronDown aria-hidden="true" size={16} />}
-      </button>
+    <div className="w-full max-w-xl mb-6 flex flex-col items-center gap-2 text-sm">
+      <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
+        <Shield aria-hidden="true" size={16} className="text-emerald-600 dark:text-emerald-400" />
+        <span className="font-medium">{t('privacy.badge')}</span>
+      </div>
 
-      {/* Expanded Details */}
-      {expanded && (
-        <div className="mt-3 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-sm space-y-2">
-          <p className="flex items-center gap-2">
-            <span className="text-green-600">✓</span>
-            <span className="text-zinc-700 dark:text-zinc-300">{t('privacy.noTraining')}</span>
-          </p>
-          <p className="flex items-center gap-2">
-            <span className="text-green-600">✓</span>
-            <span className="text-zinc-700 dark:text-zinc-300">{t('privacy.encrypted')}</span>
-          </p>
-          <p className="flex items-center gap-2">
-            <span className="text-green-600">✓</span>
-            <span className="text-zinc-700 dark:text-zinc-300">{t('privacy.deleteAnytime')}</span>
-          </p>
-          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700 flex gap-4 text-xs">
-            <Link href="/privacy" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm">{t('privacy.policyLink')}</Link>
-            <Link href="/terms" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm">{t('privacy.termsLink')}</Link>
-          </div>
-        </div>
-      )}
+      <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-zinc-600 dark:text-zinc-400">
+        <li className="flex items-center gap-1.5">
+          <Check aria-hidden="true" size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
+          <span>{t('privacy.encrypted')}</span>
+        </li>
+        <li className="flex items-center gap-1.5">
+          <Check aria-hidden="true" size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
+          <span>{t('privacy.noTraining')}</span>
+        </li>
+        <li className="flex items-center gap-1.5">
+          <Check aria-hidden="true" size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
+          <span>{t('privacy.deleteAnytime')}</span>
+        </li>
+      </ul>
+
+      <Link
+        href="/trust"
+        className="text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:underline focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm"
+      >
+        {tOr('privacy.trustLink', 'Trust Center')} →
+      </Link>
     </div>
   );
 }
diff --git a/frontend/src/i18n/locales/en.json b/frontend/src/i18n/locales/en.json
index d536f85..fcd1817 100644
--- a/frontend/src/i18n/locales/en.json
+++ b/frontend/src/i18n/locales/en.json
@@ -87,6 +87,7 @@
   "privacy.noTraining": "We never use your data for model training",
   "privacy.encrypted": "TLS encrypted in transit, AES-256 at rest",
   "privacy.deleteAnytime": "Delete your data anytime",
+  "privacy.trustLink": "Trust Center",
   "privacy.policyLink": "Privacy Policy",
   "privacy.termsLink": "Terms",
   "home.cta.demoNow": "Try Example PDF Now",
@@ -195,6 +196,10 @@
   "profile.tabs.credits": "Credits",
   "profile.tabs.usage": "Usage",
   "profile.tabs.account": "Account",
+  "profile.tabs.notifications": "Notifications",
+  "profile.notifications.title": "Notifications",
+  "profile.notifications.empty": "Email notifications and product updates are coming soon.",
+  "profile.notifications.notifyMe": "Email me when available",
   "profile.info.memberSince": "Member for {days} days",
   "profile.info.connectedWith": "Connected with {provider}",
   "profile.plan.free": "Free",
diff --git a/frontend/src/i18n/locales/zh.json b/frontend/src/i18n/locales/zh.json
index e1d744d..c309e9e 100644
--- a/frontend/src/i18n/locales/zh.json
+++ b/frontend/src/i18n/locales/zh.json
@@ -87,6 +87,7 @@
   "privacy.noTraining": "不用于模型训练",
   "privacy.encrypted": "传输 TLS 加密，存储 AES-256 加密",
   "privacy.deleteAnytime": "随时可删除数据",
+  "privacy.trustLink": "信任中心",
   "privacy.policyLink": "隐私政策",
   "privacy.termsLink": "服务条款",
   "home.cta.demoNow": "立即体验示例 PDF",
@@ -195,6 +196,10 @@
   "profile.tabs.credits": "额度",
   "profile.tabs.usage": "用量",
   "profile.tabs.account": "账户",
+  "profile.tabs.notifications": "通知",
+  "profile.notifications.title": "通知",
+  "profile.notifications.empty": "邮件通知和产品更新即将上线。",
+  "profile.notifications.notifyMe": "上线后提醒我",
   "profile.info.memberSince": "已加入 {days} 天",
   "profile.info.connectedWith": "已通过 {provider} 连接",
   "profile.plan.free": "免费",

```
