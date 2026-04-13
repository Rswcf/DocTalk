# Codex 对抗审阅 — 设计打磨三连击 R1

**Date**: 2026-04-14
**Author**: Claude
**Scope**: T3.A (PrivacyBadge inline redesign) + T3.C (Profile md+ sidebar) + T3.D (dark mode designed-for-dark) + i18n OCR FAQ 9-locale sync
**Status**: uncommitted on `main`, build ✓

---

## 背景

2026-04-13 session handoff 里 `.collab/tasks/2026-04-14-next-session-todo.md` 列出的"设计打磨三连击"。用户选择一次性做完 T3.A + T3.C + T3.D,加 i18n 收尾。

前置约束(CLAUDE.md / .claude/rules/frontend.md):
- 调色板 zinc + indigo,禁止 gray-*/blue-* 和 transition-all
- 所有 `t()` 调用必须在 `<LocaleProvider>` 内;新 key 用 `tOr(key, fallback)` 兜底
- i18n 更新必须顾及 11 个 locale
- 暗色模式 "designed for dark" 而不是"倒置"

---

## 变更摘要

### 1. T3.A — PrivacyBadge 去折叠 + 内联三检查
`frontend/src/components/PrivacyBadge.tsx`:完全重写。
- 移除 accordion + useState,3 条信任检查常驻显示
- 命名具体提供方:`AES-256 (SSE-S3)` · `OpenRouter zero-retention` · `Delete in <60s`
- 底部加 "Trust Center →" 链接到 2026-04-13 上线的 `/trust`
- 原 `privacy.policyLink` / `privacy.termsLink` 下链删掉(`/trust` 本身汇总了策略)
- 新 i18n key `privacy.deleteFast` / `privacy.trustLink` 在 en/zh 补齐,其他 9 个 locale 走 `tOr` fallback

### 2. T3.C — Profile tabs → md+ 侧边栏
`frontend/src/components/Profile/ProfileTabs.tsx`:改为单组件响应式渲染。
- mobile (`md:hidden`):保留原横向 tabs
- desktop (`hidden md:flex md:flex-col md:sticky md:top-24`):垂直 nav 带 Lucide 图标
- 加第 5 项 `notifications` stub(`Bell` 图标),section 体是空状态占位
- `ProfilePageClient.tsx` 包一层 `md:grid md:grid-cols-[220px_1fr] md:gap-8`
- `max-w-4xl` → `max-w-5xl`(留出侧边栏空间)
- 图标类型从 `React.ComponentType<...>` 改成 `LucideIcon`(类型收紧,修复第一次 build 失败)
- 新 i18n key `profile.tabs.notifications` / `profile.notifications.title` / `profile.notifications.empty` 在 en/zh,其余 locale `tOr` 兜底

### 3. T3.D — Dark mode designed-for-dark
`frontend/src/app/globals.css`:
- 新增表面提升 tokens `--surface-1/2/3`:
  - light: `#ffffff / #f4f4f5 / #e4e4e7`
  - dark:  `#18181b / #27272a / #3f3f46`(从 page canvas `#1c1b18` 逐级提升,而非反转)
- 字重下调(暗色下)
  ```css
  .dark h1..h6 { font-weight: 600; }
  .dark .prose strong, .dark .prose b { font-weight: 500; }
  .dark .font-bold { font-weight: 600; }
  ```
- 强调色去饱和:暗色 `--accent` 从 `#818cf8`(indigo-400)→ `#a8b3f5`(indigo-300 基础上饱和度降 ~5%);`--accent-hover` → `#c7d2fe`;`--accent-light` 改成 rgba 版本
- `.dark .glow-accent` 显式覆写成 `rgba(168,179,245,0.18)` 辐射,避免暗色画布上 halo 过亮

`frontend/tailwind.config.ts`:
- `theme.extend.colors.surface = { 1: 'var(--surface-1)', 2: 'var(--surface-2)', 3: 'var(--surface-3)' }`
- 让 Tailwind 类 `bg-surface-1/2/3` / `border-surface-3` 等可用

**明确没做**:30 个文件里 85+ 次 `dark:bg-zinc-900` 和 59+ 次 `dark:bg-zinc-800` 没做全量替换。token 先铺好,迁移分轮做,避免单次 diff 过大不可审。

### 4. i18n — OCR FAQ 9-locale sync
`useCasesLawyers.faq.q4.answer` 在 ar / de / es / fr / hi / it / ja / ko / pt 全部翻译成"DocTalk 会用 Tesseract 自动 OCR"的正确版本,对齐 en/zh 现有描述。

---

## Build 状态
`cd frontend && npm run build` 通过。无新增 warning。

---

## 请你审阅以下事项(对抗视角)

### A. 逻辑 / 正确性
1. **`PrivacyBadge` 文案可信度**:`AES-256 (SSE-S3)` 和 `OpenRouter zero-retention` 在 `/trust` 页面有证据支撑吗?我把原先 policy/terms 两个页脚链删掉是不是过头了?
2. **`ProfileTabs` 响应式切换**:移动端 `md:hidden` + 桌面 `hidden md:flex` 的组合在 sm~md 之间(640~768px)行为是否符合预期?会不会出现两个都显示 / 都不显示的缝隙?
3. **暗色强调色 `#a8b3f5` 选色**:我声称是"indigo-300 + 5% 去饱和"。indigo-300 = `#a5b4fc`(hsl 230, 94%, 82%),去 5% 饱和后 hsl(230, 89%, 82%) ≈ `#a6b3f6`。我用的 `#a8b3f5` 和这个差值在可接受范围吗?与原 `#818cf8` 相比在 WCAG 对比度(对 page-background `#1c1b18`)上变化多大?是否反而把可读性降低了?
4. **`.dark .font-bold { font-weight: 600 }` 全局 override**:这会不会误伤本来期望 `font-bold`(700)视觉强调的组件?例如 logo、CTA、错误信息?
5. **i18n 翻译**:9 个 locale 的翻译由我直接产出,没有母语校对。阿拉伯语的 OCR 术语、印地语的 DocTalk 品牌名处理、朝鲜语 Tesseract 片假名是否可用?如有明显错译请点出。

### B. 风格一致性
6. `PrivacyBadge` 新布局用了 `flex-wrap` 让三个 check 在小屏能换行。在 360px 宽手机上(最小目标)布局会不会垮?
7. 桌面 Profile sidebar 220px 宽是否过宽?和 `max-w-5xl` 主栏的组合在 1280px 屏上留白感觉如何?是否应改成 200px 或 240px?
8. `Notifications` stub 空状态目前只有图标 + 标题 + 一句"即将上线"。是否应该给个"订阅邮件通知"的占位按钮(即使禁用)来强化"真的会做"的可信感?

### C. 失误 / 漏改
9. 原 `PrivacyBadge` 里的 `aria-expanded` 属性在新版里没有了(因为去了 accordion)。但新版本里 `<Link href="/trust">` 的 focus 状态 ring 颜色从 `focus-visible:ring-zinc-400` 换成了 `focus-visible:ring-indigo-400`,是否破坏了项目 focus 语义统一性?
10. `tailwind.config.ts` 新加的 `surface` 里用的是数字 key `1/2/3`。Tailwind JIT 生成类名时会不会有边缘情况失败?(我选数字而非 `low/mid/high` 是因为更直观)
11. `--accent-light` 从原先的 `rgba(129, 140, 248, 0.1)` 改成 `rgba(168, 179, 245, 0.08)`,`glow-accent` 的 light mode 版本仍然使用 `var(--accent-light)` —— light mode 下 `--accent-light` 是纯色 `#eef2ff`(十六进制),dark mode 我换成了 rgba。这里类型不一致是潜在问题吗?
12. `ProfilePageClient.tsx` 新导入的 `Bell` icon 在 `md` 以下也会加载(因为是 client 组件),bundle 成本约 +1.2kB。是否值得?(/profile 路由现在 9.78 kB)

### D. 我没想到的
13. 你发现任何 regression(打破现有功能)、性能隐患(无谓重渲染 / layout shift)、a11y 退化、深色模式语境以外的潜在冲突?
14. 三连击分三次 commit 更可逆,还是合成一次 commit 更易读?(我倾向合成一次,commit message 用 `feat(design): dark-mode polish + profile sidebar + trust badge inline`)

---

## 附:完整 diff

以下是 15 个文件的完整改动 patch。阅读建议:先 `globals.css` + `tailwind.config.ts` 建立 token 心智,再看组件改动,i18n 最后。

```diff
diff --git a/frontend/src/app/globals.css b/frontend/src/app/globals.css
index 3fb7954..122c95a 100644
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
@@ -28,16 +33,37 @@
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
 
+/* Designed-for-dark: weight-shift one step lighter so bold type doesn't
+   strobe on low-luminance surfaces. Applied to prose and headings. */
+.dark h1, .dark h2, .dark h3, .dark h4, .dark h5, .dark h6 {
+  font-weight: 600;
+}
+.dark .prose strong,
+.dark .prose b {
+  font-weight: 500;
+}
+.dark .font-bold {
+  font-weight: 600;
+}
+
 html, body {
   height: 100%;
 }
@@ -140,6 +166,15 @@ body {
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
index 3462a91..3c7dd0c 100644
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
@@ -55,52 +56,71 @@ function ProfileContent() {
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
+                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
+                      {tOr(
+                        "profile.notifications.empty",
+                        "Email notifications and product updates are coming soon."
+                      )}
+                    </p>
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
diff --git a/frontend/src/components/PrivacyBadge.tsx b/frontend/src/components/PrivacyBadge.tsx
index 64fc5a1..d33b836 100644
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
+          <span>AES-256 (SSE-S3)</span>
+        </li>
+        <li className="flex items-center gap-1.5">
+          <Check aria-hidden="true" size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
+          <span>OpenRouter zero-retention</span>
+        </li>
+        <li className="flex items-center gap-1.5">
+          <Check aria-hidden="true" size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
+          <span>{tOr('privacy.deleteFast', 'Delete in <60s')}</span>
+        </li>
+      </ul>
+
+      <Link
+        href="/trust"
+        className="text-xs text-indigo-600 dark:text-indigo-300 hover:text-indigo-700 dark:hover:text-indigo-200 hover:underline focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:rounded-sm"
+      >
+        {tOr('privacy.trustLink', 'Trust Center')} →
+      </Link>
     </div>
   );
 }
diff --git a/frontend/src/components/Profile/ProfileTabs.tsx b/frontend/src/components/Profile/ProfileTabs.tsx
index 63d02dc..b7d3872 100644
--- a/frontend/src/components/Profile/ProfileTabs.tsx
+++ b/frontend/src/components/Profile/ProfileTabs.tsx
@@ -1,6 +1,7 @@
 "use client";
 
 import React from "react";
+import { User, CreditCard, BarChart3, Settings, Bell, type LucideIcon } from "lucide-react";
 import { useLocale } from "../../i18n";
 
 interface Props {
@@ -8,39 +9,72 @@ interface Props {
   onChange: (tab: string) => void;
 }
 
-const TABS: Array<{ key: string; labelKey: string }> = [
-  { key: "profile", labelKey: "profile.tabs.profile" },
-  { key: "credits", labelKey: "profile.tabs.credits" },
-  { key: "usage", labelKey: "profile.tabs.usage" },
-  { key: "account", labelKey: "profile.tabs.account" },
+const TABS: Array<{ key: string; labelKey: string; fallback: string; icon: LucideIcon }> = [
+  { key: "profile", labelKey: "profile.tabs.profile", fallback: "Profile", icon: User },
+  { key: "credits", labelKey: "profile.tabs.credits", fallback: "Credits", icon: CreditCard },
+  { key: "usage", labelKey: "profile.tabs.usage", fallback: "Usage", icon: BarChart3 },
+  { key: "account", labelKey: "profile.tabs.account", fallback: "Account", icon: Settings },
+  { key: "notifications", labelKey: "profile.tabs.notifications", fallback: "Notifications", icon: Bell },
 ];
 
 export default function ProfileTabs({ activeTab, onChange }: Props) {
-  const { t } = useLocale();
+  const { tOr } = useLocale();
 
   return (
-    <div className="flex gap-2 overflow-x-auto" role="tablist">
-      {TABS.map((tab) => {
-        const isActive = activeTab === tab.key;
-        return (
-          <button
-            key={tab.key}
-            type="button"
-            role="tab"
-            aria-selected={isActive}
-            onClick={() => onChange(tab.key)}
-            className={
-              `shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900 ` +
-              (isActive
-                ? `bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900`
-                : `bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700`)
-            }
-          >
-            {t(tab.labelKey)}
-          </button>
-        );
-      })}
-    </div>
+    <>
+      {/* Mobile: horizontal tabs */}
+      <div className="flex gap-2 overflow-x-auto md:hidden" role="tablist">
+        {TABS.map((tab) => {
+          const isActive = activeTab === tab.key;
+          return (
+            <button
+              key={tab.key}
+              type="button"
+              role="tab"
+              aria-selected={isActive}
+              onClick={() => onChange(tab.key)}
+              className={
+                `shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900 ` +
+                (isActive
+                  ? `bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900`
+                  : `bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700`)
+              }
+            >
+              {tOr(tab.labelKey, tab.fallback)}
+            </button>
+          );
+        })}
+      </div>
+
+      {/* Desktop (md+): vertical sidebar */}
+      <nav
+        className="hidden md:flex md:flex-col md:gap-1 md:sticky md:top-24"
+        role="tablist"
+        aria-orientation="vertical"
+      >
+        {TABS.map((tab) => {
+          const Icon = tab.icon;
+          const isActive = activeTab === tab.key;
+          return (
+            <button
+              key={tab.key}
+              type="button"
+              role="tab"
+              aria-selected={isActive}
+              onClick={() => onChange(tab.key)}
+              className={
+                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-left focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900 transition-colors ` +
+                (isActive
+                  ? `bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900`
+                  : `text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800`)
+              }
+            >
+              <Icon aria-hidden size={16} className="shrink-0" />
+              <span>{tOr(tab.labelKey, tab.fallback)}</span>
+            </button>
+          );
+        })}
+      </nav>
+    </>
   );
 }
-
diff --git a/frontend/tailwind.config.ts b/frontend/tailwind.config.ts
index e476aa2..3978988 100644
--- a/frontend/tailwind.config.ts
+++ b/frontend/tailwind.config.ts
@@ -21,6 +21,11 @@ const config: Config = {
           light: 'var(--accent-light)',
           foreground: 'var(--accent-foreground)',
         },
+        surface: {
+          1: 'var(--surface-1)',
+          2: 'var(--surface-2)',
+          3: 'var(--surface-3)',
+        },
       },
       keyframes: {
         'fade-in': {

```
