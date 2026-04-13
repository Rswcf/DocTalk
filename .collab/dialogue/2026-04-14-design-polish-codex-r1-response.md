Reading prompt from stdin...
2026-04-13T18:05:32.258239Z ERROR codex_core::codex: failed to load skill /Users/mayijie/Projects/Code/010_DocTalk/.agents/skills/deploy/SKILL.md: missing YAML frontmatter delimited by ---
2026-04-13T18:05:32.258252Z ERROR codex_core::codex: failed to load skill /Users/mayijie/Projects/Code/010_DocTalk/.agents/skills/codex-implement/SKILL.md: missing YAML frontmatter delimited by ---
OpenAI Codex v0.120.0 (research preview)
--------
workdir: /Users/mayijie/Projects/Code/010_DocTalk
model: gpt-5.3-codex
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR, /Users/mayijie/.codex/memories]
reasoning effort: xhigh
reasoning summaries: none
session id: 019d8805-26e3-7721-bd11-89ed60adb24e
--------
user
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

codex
我会按“代码审阅”方式做一轮对抗检查：先核对你贴的改动在当前工作区是否一致，再重点看 `/trust` 证据链、响应式断点行为、暗色对比度与全局字重副作用，最后给出分级 findings（含文件行号）和对 14 个问题的逐条结论。
exec
/bin/zsh -lc 'cd /Users/mayijie/Projects/Code/010_DocTalk && git status --short' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
 M frontend/src/app/globals.css
 M frontend/src/app/profile/ProfilePageClient.tsx
 M frontend/src/components/PrivacyBadge.tsx
 M frontend/src/components/Profile/ProfileTabs.tsx
 M frontend/src/i18n/locales/ar.json
 M frontend/src/i18n/locales/de.json
 M frontend/src/i18n/locales/en.json
 M frontend/src/i18n/locales/es.json
 M frontend/src/i18n/locales/fr.json
 M frontend/src/i18n/locales/hi.json
 M frontend/src/i18n/locales/it.json
 M frontend/src/i18n/locales/ja.json
 M frontend/src/i18n/locales/ko.json
 M frontend/src/i18n/locales/pt.json
 M frontend/src/i18n/locales/zh.json
 M frontend/tailwind.config.ts
?? .claude/scheduled_tasks.lock
?? .collab/dialogue/2026-04-13-bento-codex-review.md
?? .collab/dialogue/2026-04-13-codex-review-a-prime-r2.md
?? .collab/dialogue/2026-04-13-codex-review-a-prime.md
?? .collab/dialogue/2026-04-13-design-overhaul-codex-p1-review.md
?? .collab/dialogue/2026-04-13-frontend-codex-p1-review.md
?? .collab/dialogue/2026-04-13-frontend-codex-p2-review.md
?? .collab/dialogue/2026-04-13-frontend-codex-p3-review.md
?? .collab/dialogue/2026-04-13-sources-strip-codex-review.md
?? .collab/dialogue/2026-04-14-design-polish-codex-r1-response.md
?? .collab/dialogue/2026-04-14-design-polish-codex-r1.md

codex
我已确认工作区改动与您描述一致。下一步我会读取实际文件和规则文件，定位具体行号，并做针对性核对（尤其是 `/trust` 证据与 i18n）。
exec
/bin/zsh -lc "cd /Users/mayijie/Projects/Code/010_DocTalk && sed -n '1,240p' .claude/rules/frontend.md" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
---
paths:
  - "frontend/**"
---

# Frontend Conventions

## Architecture
- **All pages are `"use client"`** — client components with server wrapper for metadata
- Pages that fetch API data must render meaningful content in loading AND error states (prevents Google Soft 404)

## API Proxy
- **ALL** frontend→backend calls go through `/api/proxy/*` route, which injects JWT. Including SSE chat stream (`sse.ts`). Missing this = 401 errors
- **JWT double-layer**: Auth.js uses encrypted JWE (unreadable by backend). Proxy creates plain HS256 JWT via `jose`. Backend `deps.py` validates exp/iat/sub
- `allowDangerousEmailAccountLinking: true` enables cross-provider auto-linking by email
- **Proxy maxDuration**: `route.ts` exports `maxDuration = 60` (Vercel Hobby limit). SSE chat 60s timeout, others 30s

## UI Design System
- **Palette**: zinc monochrome + indigo accent (`#4f46e5`/`#818cf8`). Zero `gray-*`/`blue-*` classes (except Google OAuth brand + status colors). Zero `transition-all` (use specific properties)
- **i18n**: Components using `t()` MUST be inside `<LocaleProvider>`. Outside = raw key fallback. Only `en` is statically loaded; other 10 locales lazy-loaded

## PDF & Documents
- **react-pdf v9 CJK**: After upgrading react-pdf/pdfjs-dist, MUST re-copy `cmaps/`, `standard_fonts/`, `pdf.worker.min.mjs` to `public/`. Worker loaded from same-origin (not CDN) for CSP compliance
- **bbox coordinates**: Normalized [0,1], top-left origin. Three citation highlight strategies: ① PDF bbox, ② TextViewer text-snippet match, ③ converted PDF fallback to text-snippet when dummy bbox detected

## Subscriptions & Feature Gating
- Free (500/mo) + Plus (3K/mo, $9.99) + Pro (9K/mo, $19.99). Annual = 20% discount
- Thorough mode: Plus+ only. Export: Plus+ (frontend gated). Custom Instructions: Pro (backend gated). Sessions: Free=3/doc (backend gated)
- Credit packs: Boost(500/$3.99), Power(2K/$9.99), Ultra(5K/$19.99)

exec
/bin/zsh -lc "cd /Users/mayijie/Projects/Code/010_DocTalk && nl -ba frontend/src/components/PrivacyBadge.tsx | sed -n '1,220p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	"use client";
     2	
     3	import { Shield, Check } from 'lucide-react';
     4	import Link from 'next/link';
     5	import { useLocale } from '../i18n';
     6	
     7	export function PrivacyBadge() {
     8	  const { t, tOr } = useLocale();
     9	
    10	  return (
    11	    <div className="w-full max-w-xl mb-6 flex flex-col items-center gap-2 text-sm">
    12	      <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
    13	        <Shield aria-hidden="true" size={16} className="text-emerald-600 dark:text-emerald-400" />
    14	        <span className="font-medium">{t('privacy.badge')}</span>
    15	      </div>
    16	
    17	      <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-zinc-600 dark:text-zinc-400">
    18	        <li className="flex items-center gap-1.5">
    19	          <Check aria-hidden="true" size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
    20	          <span>AES-256 (SSE-S3)</span>
    21	        </li>
    22	        <li className="flex items-center gap-1.5">
    23	          <Check aria-hidden="true" size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
    24	          <span>OpenRouter zero-retention</span>
    25	        </li>
    26	        <li className="flex items-center gap-1.5">
    27	          <Check aria-hidden="true" size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
    28	          <span>{tOr('privacy.deleteFast', 'Delete in <60s')}</span>
    29	        </li>
    30	      </ul>
    31	
    32	      <Link
    33	        href="/trust"
    34	        className="text-xs text-indigo-600 dark:text-indigo-300 hover:text-indigo-700 dark:hover:text-indigo-200 hover:underline focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:rounded-sm"
    35	      >
    36	        {tOr('privacy.trustLink', 'Trust Center')} →
    37	      </Link>
    38	    </div>
    39	  );
    40	}

exec
/bin/zsh -lc "cd /Users/mayijie/Projects/Code/010_DocTalk && nl -ba frontend/src/components/Profile/ProfileTabs.tsx | sed -n '1,260p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	"use client";
     2	
     3	import React from "react";
     4	import { User, CreditCard, BarChart3, Settings, Bell, type LucideIcon } from "lucide-react";
     5	import { useLocale } from "../../i18n";
     6	
     7	interface Props {
     8	  activeTab: string;
     9	  onChange: (tab: string) => void;
    10	}
    11	
    12	const TABS: Array<{ key: string; labelKey: string; fallback: string; icon: LucideIcon }> = [
    13	  { key: "profile", labelKey: "profile.tabs.profile", fallback: "Profile", icon: User },
    14	  { key: "credits", labelKey: "profile.tabs.credits", fallback: "Credits", icon: CreditCard },
    15	  { key: "usage", labelKey: "profile.tabs.usage", fallback: "Usage", icon: BarChart3 },
    16	  { key: "account", labelKey: "profile.tabs.account", fallback: "Account", icon: Settings },
    17	  { key: "notifications", labelKey: "profile.tabs.notifications", fallback: "Notifications", icon: Bell },
    18	];
    19	
    20	export default function ProfileTabs({ activeTab, onChange }: Props) {
    21	  const { tOr } = useLocale();
    22	
    23	  return (
    24	    <>
    25	      {/* Mobile: horizontal tabs */}
    26	      <div className="flex gap-2 overflow-x-auto md:hidden" role="tablist">
    27	        {TABS.map((tab) => {
    28	          const isActive = activeTab === tab.key;
    29	          return (
    30	            <button
    31	              key={tab.key}
    32	              type="button"
    33	              role="tab"
    34	              aria-selected={isActive}
    35	              onClick={() => onChange(tab.key)}
    36	              className={
    37	                `shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900 ` +
    38	                (isActive
    39	                  ? `bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900`
    40	                  : `bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700`)
    41	              }
    42	            >
    43	              {tOr(tab.labelKey, tab.fallback)}
    44	            </button>
    45	          );
    46	        })}
    47	      </div>
    48	
    49	      {/* Desktop (md+): vertical sidebar */}
    50	      <nav
    51	        className="hidden md:flex md:flex-col md:gap-1 md:sticky md:top-24"
    52	        role="tablist"
    53	        aria-orientation="vertical"
    54	      >
    55	        {TABS.map((tab) => {
    56	          const Icon = tab.icon;
    57	          const isActive = activeTab === tab.key;
    58	          return (
    59	            <button
    60	              key={tab.key}
    61	              type="button"
    62	              role="tab"
    63	              aria-selected={isActive}
    64	              onClick={() => onChange(tab.key)}
    65	              className={
    66	                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-left focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900 transition-colors ` +
    67	                (isActive
    68	                  ? `bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900`
    69	                  : `text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800`)
    70	              }
    71	            >
    72	              <Icon aria-hidden size={16} className="shrink-0" />
    73	              <span>{tOr(tab.labelKey, tab.fallback)}</span>
    74	            </button>
    75	          );
    76	        })}
    77	      </nav>
    78	    </>
    79	  );
    80	}

exec
/bin/zsh -lc "cd /Users/mayijie/Projects/Code/010_DocTalk && nl -ba frontend/src/app/globals.css | sed -n '1,280p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	@tailwind base;
     2	@tailwind components;
     3	@tailwind utilities;
     4	
     5	:root {
     6	  --background: #ffffff;
     7	  /* Page canvas: warm-tinted off-white. Replaces pure #ffffff so the
     8	     marketing surface reads as paper, not screen. Inspired by Notion's
     9	     #F7F6F3 and Linear's #F4F5F8. Move chosen by Codex r1
    10	     (.collab/dialogue/2026-04-13-design-overhaul-codex-r1.md). */
    11	  --page-background: #fafaf7;
    12	  --foreground: #09090b;
    13	  --border: #e4e4e7;
    14	  /* Surface elevation tokens. Use these instead of ad-hoc
    15	     bg-white/bg-zinc-100 so dark mode can lift surfaces properly. */
    16	  --surface-1: #ffffff;
    17	  --surface-2: #f4f4f5;
    18	  --surface-3: #e4e4e7;
    19	  /* Highlight colors */
    20	  --highlight-base: rgba(245, 158, 11, 0.25);
    21	  --highlight-strong: rgba(245, 158, 11, 0.5);
    22	  /* Accent colors (indigo) */
    23	  --accent: #4f46e5;
    24	  --accent-hover: #4338ca;
    25	  --accent-light: #eef2ff;
    26	  --accent-foreground: #ffffff;
    27	}
    28	
    29	.dark {
    30	  --background: #09090b;
    31	  /* Warm-tinted near-black canvas (vs pure zinc-950). 2-tick warmer.
    32	     Pairs with the warm light canvas above. */
    33	  --page-background: #1c1b18;
    34	  --foreground: #fafafa;
    35	  --border: #3f3f46;
    36	  /* Dark mode surfaces lift progressively from the page canvas (vs.
    37	     inverting the light ramp). Designed-for-dark: closer values reduce
    38	     harsh contrast against pure black. */
    39	  --surface-1: #18181b;
    40	  --surface-2: #27272a;
    41	  --surface-3: #3f3f46;
    42	  /* Dark mode highlight colors */
    43	  --highlight-base: rgba(245, 158, 11, 0.20);
    44	  --highlight-strong: rgba(245, 158, 11, 0.5);
    45	  /* Accent colors (indigo). Dark mode drops saturation ~5% and lifts
    46	     to indigo-300 — indigo-400 (#818cf8) bounces too hard against pure
    47	     black. */
    48	  --accent: #a8b3f5;
    49	  --accent-hover: #c7d2fe;
    50	  --accent-light: rgba(168, 179, 245, 0.08);
    51	  --accent-foreground: #09090b;
    52	}
    53	
    54	/* Designed-for-dark: weight-shift one step lighter so bold type doesn't
    55	   strobe on low-luminance surfaces. Applied to prose and headings. */
    56	.dark h1, .dark h2, .dark h3, .dark h4, .dark h5, .dark h6 {
    57	  font-weight: 600;
    58	}
    59	.dark .prose strong,
    60	.dark .prose b {
    61	  font-weight: 500;
    62	}
    63	.dark .font-bold {
    64	  font-weight: 600;
    65	}
    66	
    67	html, body {
    68	  height: 100%;
    69	}
    70	
    71	body {
    72	  color: var(--foreground);
    73	  background: var(--page-background, var(--background));
    74	}
    75	
    76	/* Chat prose: tighten paragraph spacing vs. default prose */
    77	.prose p {
    78	  margin-top: 0.75em;
    79	  margin-bottom: 0.75em;
    80	}
    81	.prose ul, .prose ol {
    82	  margin-top: 0.5em;
    83	  margin-bottom: 0.5em;
    84	}
    85	.prose li {
    86	  margin-top: 0.25em;
    87	  margin-bottom: 0.25em;
    88	}
    89	
    90	/* PDF text-level citation highlighting */
    91	.textLayer mark.pdf-highlight {
    92	  background-color: var(--highlight-base);
    93	  color: transparent;
    94	  border-radius: 2px;
    95	  padding: 1px 0;
    96	  animation: highlightPulse 1.2s ease-out;
    97	}
    98	
    99	@keyframes highlightPulse {
   100	  0% { background-color: var(--highlight-strong); box-shadow: 0 0 8px var(--highlight-strong); }
   101	  50% { background-color: var(--highlight-base); box-shadow: 0 0 4px var(--highlight-base); }
   102	  100% { background-color: var(--highlight-base); box-shadow: none; }
   103	}
   104	
   105	/* Overlay-layer citation highlighting (always visible, even without text layer) */
   106	.citation-overlay {
   107	  background: rgba(245, 158, 11, 0.15);
   108	  border-left: 3px solid rgba(245, 158, 11, 0.6);
   109	  border-radius: 2px;
   110	  pointer-events: none;
   111	  animation: overlayPulse 1.5s ease-out;
   112	}
   113	
   114	@keyframes overlayPulse {
   115	  0% { background: rgba(245, 158, 11, 0.35); border-left-color: rgba(245, 158, 11, 0.9); }
   116	  40% { background: rgba(245, 158, 11, 0.2); border-left-color: rgba(245, 158, 11, 0.7); }
   117	  100% { background: rgba(245, 158, 11, 0.15); border-left-color: rgba(245, 158, 11, 0.6); }
   118	}
   119	
   120	/* Shiki dual-theme: switch CSS variables based on .dark class */
   121	.shiki-container .shiki,
   122	.shiki-container .shiki span {
   123	  color: var(--shiki-light);
   124	  background-color: var(--shiki-light-bg);
   125	  font-style: var(--shiki-light-font-style);
   126	  font-weight: var(--shiki-light-font-weight);
   127	  text-decoration: var(--shiki-light-text-decoration);
   128	}
   129	.dark .shiki-container .shiki,
   130	.dark .shiki-container .shiki span {
   131	  color: var(--shiki-dark);
   132	  background-color: var(--shiki-dark-bg);
   133	  font-style: var(--shiki-dark-font-style);
   134	  font-weight: var(--shiki-dark-font-weight);
   135	  text-decoration: var(--shiki-dark-text-decoration);
   136	}
   137	
   138	/* Cookie consent banner slide-up */
   139	@keyframes slideUp {
   140	  from { transform: translateY(100%); }
   141	  to { transform: translateY(0); }
   142	}
   143	
   144	/* PDF text search highlighting */
   145	.textLayer mark.pdf-search-match {
   146	  background-color: rgba(250, 204, 21, 0.4);
   147	  color: transparent;
   148	  border-radius: 2px;
   149	  padding: 1px 0;
   150	}
   151	
   152	/* ============================================================
   153	   Landing Page Utilities
   154	   ============================================================ */
   155	
   156	/* Subtle dot grid pattern for visual depth */
   157	.dot-pattern {
   158	  background-image: radial-gradient(circle, #d4d4d8 1px, transparent 1px);
   159	  background-size: 24px 24px;
   160	}
   161	.dark .dot-pattern {
   162	  background-image: radial-gradient(circle, #27272a 1px, transparent 1px);
   163	}
   164	
   165	/* Radial glow behind showcase */
   166	.glow-accent {
   167	  background: radial-gradient(ellipse 60% 40% at 50% 50%, var(--accent-light) 0%, transparent 70%);
   168	}
   169	/* Dark mode: softer glow using desaturated indigo-300 at lower opacity
   170	   so the halo doesn't punch out against pure black canvas. */
   171	.dark .glow-accent {
   172	  background: radial-gradient(
   173	    ellipse 60% 40% at 50% 50%,
   174	    rgba(168, 179, 245, 0.18) 0%,
   175	    transparent 70%
   176	  );
   177	}
   178	
   179	/* Gradient text utility */
   180	.text-gradient-accent {
   181	  background: linear-gradient(135deg, var(--accent) 0%, #7c3aed 100%);
   182	  -webkit-background-clip: text;
   183	  -webkit-text-fill-color: transparent;
   184	  background-clip: text;
   185	}
   186	.dark .text-gradient-accent {
   187	  background: linear-gradient(135deg, var(--accent) 0%, #c4b5fd 100%);
   188	  -webkit-background-clip: text;
   189	  -webkit-text-fill-color: transparent;
   190	  background-clip: text;
   191	}
   192	
   193	/* Onboarding tour (driver.js) */
   194	.doctalk-tour-popover {
   195	  --driverjs-bg: #ffffff;
   196	  --driverjs-color: #18181b;
   197	  border: 1px solid #e4e4e7;
   198	  border-radius: 12px;
   199	  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
   200	}
   201	
   202	.dark .doctalk-tour-popover {
   203	  --driverjs-bg: #18181b;
   204	  --driverjs-color: #fafafa;
   205	  border-color: #3f3f46;
   206	}
   207	
   208	.doctalk-tour-popover .driver-popover-progress-text {
   209	  color: #71717a;
   210	}
   211	
   212	.doctalk-tour-popover .driver-popover-navigation-btns button {
   213	  border-radius: 8px;
   214	  font-size: 0.875rem;
   215	  padding: 0.375rem 0.75rem;
   216	}

exec
/bin/zsh -lc "cd /Users/mayijie/Projects/Code/010_DocTalk && nl -ba frontend/src/app/profile/ProfilePageClient.tsx | sed -n '1,280p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	"use client";
     2	
     3	import { Suspense, useEffect, useMemo, useState } from "react";
     4	import { useSession } from "next-auth/react";
     5	import { useRouter, useSearchParams } from "next/navigation";
     6	import Header from "../../components/Header";
     7	import { useLocale } from "../../i18n";
     8	import ProfileTabs from "../../components/Profile/ProfileTabs";
     9	import ProfileInfoSection from "../../components/Profile/ProfileInfoSection";
    10	import CreditsSection from "../../components/Profile/CreditsSection";
    11	import UsageStatsSection from "../../components/Profile/UsageStatsSection";
    12	import AccountActionsSection from "../../components/Profile/AccountActionsSection";
    13	import { usePageTitle } from "../../lib/usePageTitle";
    14	import { useUserProfile } from "../../lib/useUserProfile";
    15	import { LoadingScreen } from "../../components/ui/LoadingScreen";
    16	import { InlineSpinner } from "../../components/ui/InlineSpinner";
    17	import { Bell } from "lucide-react";
    18	
    19	function ProfileContent() {
    20	  const { data: session, status } = useSession();
    21	  const router = useRouter();
    22	  const searchParams = useSearchParams();
    23	  const { t, tOr } = useLocale();
    24	  usePageTitle(t('profile.title'));
    25	
    26	  const initialTab = useMemo(() => {
    27	    const tab = searchParams.get("tab");
    28	    return tab || "profile";
    29	  }, [searchParams]);
    30	
    31	  const [activeTab, setActiveTab] = useState<string>(initialTab);
    32	  const { profile, loading, error } = useUserProfile();
    33	
    34	  // Keep activeTab in sync with URL
    35	  useEffect(() => {
    36	    setActiveTab(initialTab);
    37	  }, [initialTab]);
    38	
    39	  // Auth guard
    40	  useEffect(() => {
    41	    if (status === "unauthenticated") {
    42	      router.push("/auth?callbackUrl=/profile");
    43	    }
    44	  }, [status, router]);
    45	
    46	  const handleTabChange = (tab: string) => {
    47	    setActiveTab(tab);
    48	    // Update URL without full navigation
    49	    router.replace(`/profile?tab=${encodeURIComponent(tab)}`);
    50	  };
    51	
    52	  if (status === "loading") {
    53	    return <LoadingScreen label={t("common.loading")} />;
    54	  }
    55	
    56	  return (
    57	    <div className="min-h-screen bg-[var(--page-background)]">
    58	      <Header />
    59	      <main className="max-w-5xl mx-auto p-8">
    60	        <h1 className="text-2xl font-semibold mb-6 dark:text-zinc-100">{t("profile.title")}</h1>
    61	
    62	        <div className="md:grid md:grid-cols-[220px_1fr] md:gap-8">
    63	          <aside className="mb-6 md:mb-0">
    64	            <ProfileTabs activeTab={activeTab} onChange={handleTabChange} />
    65	          </aside>
    66	
    67	          <div>
    68	            {loading && (
    69	              <div className="flex justify-center py-12">
    70	                <InlineSpinner label={t("common.loading")} />
    71	              </div>
    72	            )}
    73	
    74	            {!loading && error && (
    75	              <div className="p-4 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
    76	                {t("error.somethingWrong")}
    77	              </div>
    78	            )}
    79	
    80	            {!loading && !error && profile && (
    81	              <div className="space-y-6">
    82	                {activeTab === "profile" && (
    83	                  <section className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-6 bg-white dark:bg-zinc-900">
    84	                    <ProfileInfoSection profile={profile} />
    85	                  </section>
    86	                )}
    87	
    88	                {activeTab === "credits" && (
    89	                  <section className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-6 bg-white dark:bg-zinc-900">
    90	                    <CreditsSection profile={profile} />
    91	                  </section>
    92	                )}
    93	
    94	                {activeTab === "usage" && (
    95	                  <section className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-6 bg-white dark:bg-zinc-900">
    96	                    <UsageStatsSection profile={profile} />
    97	                  </section>
    98	                )}
    99	
   100	                {activeTab === "account" && (
   101	                  <section className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-6 bg-white dark:bg-zinc-900">
   102	                    <AccountActionsSection email={profile.email} />
   103	                  </section>
   104	                )}
   105	
   106	                {activeTab === "notifications" && (
   107	                  <section className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-10 bg-white dark:bg-zinc-900 text-center">
   108	                    <Bell aria-hidden size={28} className="mx-auto mb-3 text-zinc-400 dark:text-zinc-500" />
   109	                    <h2 className="text-base font-semibold mb-1 text-zinc-900 dark:text-zinc-100">
   110	                      {tOr("profile.notifications.title", "Notifications")}
   111	                    </h2>
   112	                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
   113	                      {tOr(
   114	                        "profile.notifications.empty",
   115	                        "Email notifications and product updates are coming soon."
   116	                      )}
   117	                    </p>
   118	                  </section>
   119	                )}
   120	              </div>
   121	            )}
   122	          </div>
   123	        </div>
   124	      </main>
   125	    </div>
   126	  );
   127	}
   128	
   129	export default function ProfilePageClient() {
   130	  return (
   131	    <Suspense fallback={<LoadingScreen />}>
   132	      <ProfileContent />
   133	    </Suspense>
   134	  );
   135	}

exec
/bin/zsh -lc "cd /Users/mayijie/Projects/Code/010_DocTalk && nl -ba frontend/tailwind.config.ts | sed -n '1,220p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	import type { Config } from 'tailwindcss'
     2	
     3	const config: Config = {
     4	  darkMode: 'class',
     5	  content: [
     6	    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
     7	    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
     8	    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
     9	  ],
    10	  theme: {
    11	    extend: {
    12	      fontFamily: {
    13	        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
    14	        display: ['var(--font-logo)', 'system-ui', 'sans-serif'],
    15	        logo: ['var(--font-logo)', 'system-ui', 'sans-serif'],
    16	      },
    17	      colors: {
    18	        accent: {
    19	          DEFAULT: 'var(--accent)',
    20	          hover: 'var(--accent-hover)',
    21	          light: 'var(--accent-light)',
    22	          foreground: 'var(--accent-foreground)',
    23	        },
    24	        surface: {
    25	          1: 'var(--surface-1)',
    26	          2: 'var(--surface-2)',
    27	          3: 'var(--surface-3)',
    28	        },
    29	      },
    30	      keyframes: {
    31	        'fade-in': {
    32	          '0%': { opacity: '0' },
    33	          '100%': { opacity: '1' },
    34	        },
    35	        'slide-up': {
    36	          '0%': { opacity: '0', transform: 'translateY(8px)' },
    37	          '100%': { opacity: '1', transform: 'translateY(0)' },
    38	        },
    39	        'reveal-up': {
    40	          '0%': { opacity: '0', transform: 'translateY(24px)' },
    41	          '100%': { opacity: '1', transform: 'translateY(0)' },
    42	        },
    43	      },
    44	      animation: {
    45	        'fade-in': 'fade-in 150ms ease-out',
    46	        'slide-up': 'slide-up 200ms ease-out',
    47	        'reveal-up': 'reveal-up 600ms ease-out both',
    48	      },
    49	      typography: {
    50	        DEFAULT: {
    51	          css: {
    52	            '--tw-prose-body': '#09090b',
    53	            '--tw-prose-headings': '#09090b',
    54	            '--tw-prose-bold': '#09090b',
    55	            'code::before': { content: 'none' },
    56	            'code::after': { content: 'none' },
    57	            code: {
    58	              backgroundColor: 'rgb(0 0 0 / 0.06)',
    59	              borderRadius: '0.375rem',
    60	              padding: '0.125rem 0.375rem',
    61	              fontWeight: '500',
    62	              fontSize: '0.875em',
    63	            },
    64	          },
    65	        },
    66	        invert: {
    67	          css: {
    68	            '--tw-prose-invert-body': '#fafafa',
    69	            '--tw-prose-invert-headings': '#fafafa',
    70	            '--tw-prose-invert-bold': '#fafafa',
    71	            code: {
    72	              backgroundColor: 'rgb(255 255 255 / 0.12)',
    73	            },
    74	          },
    75	        },
    76	      },
    77	    },
    78	  },
    79	  plugins: [
    80	    require('@tailwindcss/typography'),
    81	  ],
    82	}
    83	export default config

exec
/bin/zsh -lc "cd /Users/mayijie/Projects/Code/010_DocTalk && rg -n \"OpenRouter|zero-retention|retention|SSE-S3|AES-256|trust|privacy|terms|delete\" frontend/src/app/trust frontend/src/app/privacy frontend/src/app/terms frontend/src -g '*.tsx' | sed -n '1,320p'" in /Users/mayijie/Projects/Code/010_DocTalk
exec
/bin/zsh -lc "cd /Users/mayijie/Projects/Code/010_DocTalk && rg -n \"privacy\\.deleteFast|privacy\\.trustLink|profile\\.tabs\\.notifications|profile\\.notifications\\.|useCasesLawyers\\.faq\\.q4\\.answer|zero-retention|SSE-S3|Trust Center|Tesseract\" frontend/src/i18n/locales/*.json frontend/src/app frontend/src/components frontend/src | sed -n '1,260p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
frontend/src/app/trust/page.tsx:8:    'How DocTalk secures your documents: AES-256 encryption at rest, SSRF protection, magic-byte validation, zero-retention LLM calls, GDPR data rights, and what we have not yet certified.',
frontend/src/app/trust/page.tsx:9:  path: '/trust',
frontend/src/app/trust/page.tsx:12:    description: 'The real security and privacy controls in place for DocTalk.',
frontend/src/app/terms/page.tsx:8:    'Read the DocTalk terms of service covering acceptable use, account responsibilities, intellectual property, and service limitations.',
frontend/src/app/terms/page.tsx:9:  path: '/terms',
frontend/src/app/terms/page.tsx:12:    description: 'Rules and account terms for using the DocTalk AI document analysis platform.',
frontend/src/app/privacy/page.tsx:8:    'Learn how DocTalk handles your data, storage, deletion rights, and GDPR-aligned privacy controls for uploaded documents.',
frontend/src/app/privacy/page.tsx:9:  path: '/privacy',
frontend/src/app/privacy/page.tsx:12:    description: 'How DocTalk handles your data, encryption, and document privacy controls.',
frontend/src/app/terms/TermsPageClient.tsx:9:  usePageTitle(t('terms.title'));
frontend/src/app/terms/TermsPageClient.tsx:14:        <h1 className="text-2xl font-semibold mb-6 dark:text-white">{t('terms.title')}</h1>
frontend/src/app/terms/TermsPageClient.tsx:18:            <h2 className="text-lg font-semibold mb-2 dark:text-white">{t('terms.section1.title')}</h2>
frontend/src/app/terms/TermsPageClient.tsx:19:            <p>{t('terms.section1.content')}</p>
frontend/src/app/terms/TermsPageClient.tsx:23:            <h2 className="text-lg font-semibold mb-2 dark:text-white">{t('terms.section2.title')}</h2>
frontend/src/app/terms/TermsPageClient.tsx:24:            <p>{t('terms.section2.content')}</p>
frontend/src/app/terms/TermsPageClient.tsx:28:            <h2 className="text-lg font-semibold mb-2 dark:text-white">{t('terms.section3.title')}</h2>
frontend/src/app/terms/TermsPageClient.tsx:29:            <p>{t('terms.section3.content')}</p>
frontend/src/app/terms/TermsPageClient.tsx:33:            <h2 className="text-lg font-semibold mb-2 dark:text-white">{t('terms.section4.title')}</h2>
frontend/src/app/terms/TermsPageClient.tsx:34:            <p>{t('terms.section4.content')}</p>
frontend/src/app/terms/TermsPageClient.tsx:39:          <p>{t('terms.lastUpdated')}: 2026-02-05</p>
frontend/src/components/AuthModal.tsx:28:    currentSearch.delete('auth');
frontend/src/components/CookieConsentBanner.tsx:44:            href="/privacy"
frontend/src/components/Collections/CreateCollectionModal.tsx:39:      if (next.has(id)) next.delete(id);
frontend/src/components/SessionDropdown.tsx:8:import { createSession, getMessages, deleteSession } from '../lib/api';
frontend/src/components/SessionDropdown.tsx:84:    await deleteSession(targetId);
frontend/src/components/SessionDropdown.tsx:217:                        <span>{t('dashboard.deletePrompt')}</span>
frontend/src/components/SessionDropdown.tsx:240:                        title={t('session.deleteChat')}
frontend/src/components/SessionDropdown.tsx:241:                        aria-label={t('session.deleteChat')}
frontend/src/components/SessionDropdown.tsx:263:              <span>{t('session.deleteChat')}</span>
frontend/src/components/SessionDropdown.tsx:267:                <span>{t('dashboard.deletePrompt')}</span>
frontend/src/components/PdfViewer/PdfViewer.tsx:218:            nearbyPages.delete(pageNum);
frontend/src/components/AuthFormContent.tsx:205:        {t("auth.termsPrefix")}{" "}
frontend/src/components/AuthFormContent.tsx:206:        <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-600 dark:hover:text-zinc-300">{t("auth.termsOfService")}</a>
frontend/src/components/AuthFormContent.tsx:208:        <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-600 dark:hover:text-zinc-300">{t("auth.privacyPolicy")}</a>.
frontend/src/components/PrivacyBadge.tsx:14:        <span className="font-medium">{t('privacy.badge')}</span>
frontend/src/components/PrivacyBadge.tsx:20:          <span>AES-256 (SSE-S3)</span>
frontend/src/components/PrivacyBadge.tsx:24:          <span>OpenRouter zero-retention</span>
frontend/src/components/PrivacyBadge.tsx:28:          <span>{tOr('privacy.deleteFast', 'Delete in <60s')}</span>
frontend/src/components/PrivacyBadge.tsx:33:        href="/trust"
frontend/src/components/PrivacyBadge.tsx:36:        {tOr('privacy.trustLink', 'Trust Center')} →
frontend/src/components/Collections/CollectionList.tsx:58:                if (window.confirm(t('collections.deleteConfirm'))) {
frontend/src/components/Collections/CollectionList.tsx:62:              title={t('collections.delete')}
frontend/src/components/Collections/CollectionList.tsx:63:              aria-label={t('collections.delete')}
frontend/src/components/landing/FeatureGrid.tsx:171:            AES-256
frontend/src/components/landing/FeatureGrid.tsx:205:  { Visual: VisualPrivacy,       titleKey: 'landing.feature.privacy.title',   descKey: 'landing.feature.privacy.desc',   lgSpan: 2 },
frontend/src/components/landing/HeroArtifact.tsx:13: * the video should be demoted, not deleted — kept as a section below.
frontend/src/components/Profile/AccountActionsSection.tsx:6:import { deleteUserAccount, exportUserData } from "../../lib/api";
frontend/src/components/Profile/AccountActionsSection.tsx:47:      await deleteUserAccount();
frontend/src/components/Profile/AccountActionsSection.tsx:83:          {t("profile.account.deleteWarning")}
frontend/src/components/Profile/AccountActionsSection.tsx:90:          {t("profile.account.deleteAccount")}
frontend/src/components/Profile/AccountActionsSection.tsx:104:            aria-labelledby="delete-account-title"
frontend/src/components/Profile/AccountActionsSection.tsx:106:            <h4 id="delete-account-title" className="text-lg font-semibold mb-2 dark:text-zinc-100">
frontend/src/components/Profile/AccountActionsSection.tsx:107:              {t("profile.account.deleteAccount")}
frontend/src/components/Profile/AccountActionsSection.tsx:110:              {t("profile.account.deleteConfirm")}
frontend/src/components/Profile/AccountActionsSection.tsx:140:                {deleting ? t("profile.account.deleting") : t("profile.account.deleteAccount")}
frontend/src/app/HomePageClient.tsx:7:import { getDocument, uploadDocument, deleteDocument, getMyDocuments, ingestUrl } from '../lib/api';
frontend/src/app/HomePageClient.tsx:393:      await deleteDocument(documentId);
frontend/src/app/HomePageClient.tsx:395:      console.error('Failed to delete document:', e);
frontend/src/app/HomePageClient.tsx:550:                          <span>{t('dashboard.deletePrompt')}</span>
frontend/src/app/HomePageClient.tsx:571:                          title={t('doc.deleteDoc')}
frontend/src/app/trust/TrustPageClient.tsx:23: * rather than i18n'd, because the technical claims (SSE-S3, SSRF, RFC 7748)
frontend/src/app/trust/TrustPageClient.tsx:43:    title: "AES-256 encryption at rest",
frontend/src/app/trust/TrustPageClient.tsx:45:      "Uploaded documents are stored with SSE-S3 server-side encryption. The MinIO bucket enforces the encryption policy at ingest; any object written without a valid encryption header is rejected.",
frontend/src/app/trust/TrustPageClient.tsx:46:    evidence: "backend/app/services/storage_service.py · SSE-S3 policy",
frontend/src/app/trust/TrustPageClient.tsx:58:      "DocTalk routes LLM calls through OpenRouter with zero-retention agreements. Your documents and questions are not retained by model providers after the response completes, and are never used to train models.",
frontend/src/app/trust/TrustPageClient.tsx:81:      "Public endpoints (shared views, anonymous reads) have per-IP rate limits with HMAC-signed IP trust chain via the Vercel edge — the real client IP cannot be spoofed. Authenticated users bypass.",
frontend/src/app/trust/TrustPageClient.tsx:97:      "You can delete your account from Profile → Account. All documents, sessions, chat history, embeddings, and billing records are removed; the account is not recoverable after deletion.",
frontend/src/app/trust/TrustPageClient.tsx:155:  usePageTitle(t("trust.title", {}) || "Trust & Security");
frontend/src/app/trust/TrustPageClient.tsx:258:                href="/privacy"
frontend/src/components/Footer.tsx:39:    { href: '/trust', label: t('footer.links.trust') },
frontend/src/components/Footer.tsx:40:    { href: '/privacy', label: t('privacy.policyLink') },
frontend/src/components/Footer.tsx:41:    { href: '/terms', label: t('terms.title') },
frontend/src/components/Footer.tsx:42:    { href: '/privacy#ccpa', label: t('footer.doNotSell') },
frontend/src/app/privacy/PrivacyPageClient.tsx:9:  usePageTitle(t('privacy.title'));
frontend/src/app/privacy/PrivacyPageClient.tsx:14:        <h1 className="text-2xl font-semibold mb-6 dark:text-white">{t('privacy.title')}</h1>
frontend/src/app/privacy/PrivacyPageClient.tsx:18:            <h2 className="text-lg font-semibold mb-2 dark:text-white">{t('privacy.section1.title')}</h2>
frontend/src/app/privacy/PrivacyPageClient.tsx:19:            <p>{t('privacy.section1.content')}</p>
frontend/src/app/privacy/PrivacyPageClient.tsx:23:            <h2 className="text-lg font-semibold mb-2 dark:text-white">{t('privacy.section2.title')}</h2>
frontend/src/app/privacy/PrivacyPageClient.tsx:25:              <li>{t('privacy.section2.item1')}</li>
frontend/src/app/privacy/PrivacyPageClient.tsx:26:              <li>{t('privacy.section2.item2')}</li>
frontend/src/app/privacy/PrivacyPageClient.tsx:27:              <li>{t('privacy.section2.item3')}</li>
frontend/src/app/privacy/PrivacyPageClient.tsx:32:            <h2 className="text-lg font-semibold mb-2 dark:text-white">{t('privacy.section3.title')}</h2>
frontend/src/app/privacy/PrivacyPageClient.tsx:33:            <p>{t('privacy.section3.content')}</p>
frontend/src/app/privacy/PrivacyPageClient.tsx:37:            <h2 className="text-lg font-semibold mb-2 dark:text-white">{t('privacy.section4.title')}</h2>
frontend/src/app/privacy/PrivacyPageClient.tsx:38:            <p>{t('privacy.section4.content')}</p>
frontend/src/app/privacy/PrivacyPageClient.tsx:42:            <h2 className="text-lg font-semibold mb-2 dark:text-white">{t('privacy.section5.title')}</h2>
frontend/src/app/privacy/PrivacyPageClient.tsx:43:            <p>{t('privacy.section5.content')}</p>
frontend/src/app/privacy/PrivacyPageClient.tsx:48:          <p>{t('privacy.lastUpdated')}: 2026-02-05</p>
frontend/src/app/contact/page.tsx:8:    'Contact the DocTalk team for product support, billing questions, privacy requests, partnerships, bug reports, or general feedback.',
frontend/src/app/contact/page.tsx:27:              'Contact information for the DocTalk team covering support, privacy, billing, and partnerships.',
frontend/src/app/contact/ContactPageClient.tsx:56:              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{t('contact.privacy.title')}</h2>
frontend/src/app/contact/ContactPageClient.tsx:58:                {t('contact.privacy.description')}
frontend/src/app/trust/page.tsx:8:    'How DocTalk secures your documents: AES-256 encryption at rest, SSRF protection, magic-byte validation, zero-retention LLM calls, GDPR data rights, and what we have not yet certified.',
frontend/src/app/trust/page.tsx:9:  path: '/trust',
frontend/src/app/trust/page.tsx:12:    description: 'The real security and privacy controls in place for DocTalk.',
frontend/src/app/tools/word-counter/WordCounterClient.tsx:300:                overused terms or key themes in your writing. Common stop words
frontend/src/app/trust/TrustPageClient.tsx:23: * rather than i18n'd, because the technical claims (SSE-S3, SSRF, RFC 7748)
frontend/src/app/trust/TrustPageClient.tsx:43:    title: "AES-256 encryption at rest",
frontend/src/app/trust/TrustPageClient.tsx:45:      "Uploaded documents are stored with SSE-S3 server-side encryption. The MinIO bucket enforces the encryption policy at ingest; any object written without a valid encryption header is rejected.",
frontend/src/app/trust/TrustPageClient.tsx:46:    evidence: "backend/app/services/storage_service.py · SSE-S3 policy",
frontend/src/app/trust/TrustPageClient.tsx:58:      "DocTalk routes LLM calls through OpenRouter with zero-retention agreements. Your documents and questions are not retained by model providers after the response completes, and are never used to train models.",
frontend/src/app/trust/TrustPageClient.tsx:81:      "Public endpoints (shared views, anonymous reads) have per-IP rate limits with HMAC-signed IP trust chain via the Vercel edge — the real client IP cannot be spoofed. Authenticated users bypass.",
frontend/src/app/trust/TrustPageClient.tsx:97:      "You can delete your account from Profile → Account. All documents, sessions, chat history, embeddings, and billing records are removed; the account is not recoverable after deletion.",
frontend/src/app/trust/TrustPageClient.tsx:155:  usePageTitle(t("trust.title", {}) || "Trust & Security");
frontend/src/app/trust/TrustPageClient.tsx:258:                href="/privacy"
frontend/src/app/use-cases/healthcare/page.tsx:22:      'DocTalk is a general-purpose AI document analysis tool. It is not specifically HIPAA-certified and has not undergone a formal HIPAA compliance audit. We encrypt all documents with AES-256 at rest and never use documents for AI training, but we recommend against uploading documents containing Protected Health Information (PHI). DocTalk is well-suited for reviewing published research, compliance frameworks, protocols, and educational materials that do not contain individual patient data.',
frontend/src/app/use-cases/healthcare/page.tsx:37:      'All uploaded documents are encrypted with AES-256 encryption at rest. Documents are never used for AI model training. DocTalk is GDPR-compliant, provides data export and deletion capabilities, and each user account is fully isolated. However, as noted above, we recommend against uploading documents with PHI since DocTalk is not HIPAA-certified.',
frontend/src/app/use-cases/finance/FinanceClient.tsx:101:                Understanding <a href="https://www.investopedia.com/terms/a/annual-report.asp" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">annual reports</a> is critical for investment decisions.
frontend/src/app/about/page.tsx:8:    'Learn what DocTalk does, who it is for, how it approaches trustworthy AI document analysis, and how to contact the team.',
frontend/src/app/about/page.tsx:27:              'Background on DocTalk, its product mission, and its approach to trustworthy AI document analysis.',
frontend/src/app/terms/page.tsx:8:    'Read the DocTalk terms of service covering acceptable use, account responsibilities, intellectual property, and service limitations.',
frontend/src/app/terms/page.tsx:9:  path: '/terms',
frontend/src/app/terms/page.tsx:12:    description: 'Rules and account terms for using the DocTalk AI document analysis platform.',
frontend/src/app/use-cases/finance/page.tsx:37:      'Yes. All uploaded documents are encrypted with AES-256 encryption at rest. Your financial documents are never used for AI model training. DocTalk is GDPR-compliant and provides data export and deletion capabilities.',
frontend/src/app/use-cases/healthcare/HealthcareClient.tsx:50:      'Upload insurance policy documents and ask about coverage terms, exclusions, pre-authorization requirements, and appeal procedures. Get cited answers pointing to the specific policy clause.',
frontend/src/app/use-cases/healthcare/HealthcareClient.tsx:72:  { icon: MessageSquare, step: '2', title: 'Ask Your Question', description: 'Type questions about endpoints, requirements, dosing, coverage terms, or anything in the document.' },
frontend/src/app/use-cases/healthcare/HealthcareClient.tsx:80:      'DocTalk is a general-purpose AI document analysis tool. It is not specifically HIPAA-certified and has not undergone a formal HIPAA compliance audit. We encrypt all documents with AES-256 at rest and never use documents for AI training, but we recommend against uploading documents containing Protected Health Information (PHI). DocTalk is well-suited for reviewing published research, compliance frameworks, protocols, and educational materials that do not contain individual patient data.',
frontend/src/app/use-cases/healthcare/HealthcareClient.tsx:95:      'All uploaded documents are encrypted with AES-256 encryption at rest. Documents are never used for AI model training. DocTalk is GDPR-compliant, provides data export and deletion capabilities, and each user account is fully isolated. However, as noted above, we recommend against uploading documents with PHI since DocTalk is not HIPAA-certified.',
frontend/src/app/use-cases/healthcare/HealthcareClient.tsx:302:                DocTalk encrypts all documents with AES-256 at rest, never uses documents for AI training, and is GDPR-compliant. However, DocTalk is not HIPAA-certified — please do not upload documents containing Protected Health Information (PHI).
frontend/src/app/about/AboutPageClient.tsx:50:              {t('about.trust.title')}
frontend/src/app/about/AboutPageClient.tsx:53:              {t('about.trust.paragraph1')}
frontend/src/app/about/AboutPageClient.tsx:56:              {t('about.trust.paragraph2')}
frontend/src/app/terms/TermsPageClient.tsx:9:  usePageTitle(t('terms.title'));
frontend/src/app/terms/TermsPageClient.tsx:14:        <h1 className="text-2xl font-semibold mb-6 dark:text-white">{t('terms.title')}</h1>
frontend/src/app/terms/TermsPageClient.tsx:18:            <h2 className="text-lg font-semibold mb-2 dark:text-white">{t('terms.section1.title')}</h2>
frontend/src/app/terms/TermsPageClient.tsx:19:            <p>{t('terms.section1.content')}</p>
frontend/src/app/terms/TermsPageClient.tsx:23:            <h2 className="text-lg font-semibold mb-2 dark:text-white">{t('terms.section2.title')}</h2>
frontend/src/app/terms/TermsPageClient.tsx:24:            <p>{t('terms.section2.content')}</p>
frontend/src/app/terms/TermsPageClient.tsx:28:            <h2 className="text-lg font-semibold mb-2 dark:text-white">{t('terms.section3.title')}</h2>
frontend/src/app/terms/TermsPageClient.tsx:29:            <p>{t('terms.section3.content')}</p>
frontend/src/app/terms/TermsPageClient.tsx:33:            <h2 className="text-lg font-semibold mb-2 dark:text-white">{t('terms.section4.title')}</h2>
frontend/src/app/terms/TermsPageClient.tsx:34:            <p>{t('terms.section4.content')}</p>
frontend/src/app/terms/TermsPageClient.tsx:39:          <p>{t('terms.lastUpdated')}: 2026-02-05</p>
frontend/src/app/use-cases/compliance/page.tsx:22:      'Yes. Upload regulatory texts, guidelines, or standards as PDF or DOCX files and ask questions like "What are the data retention requirements?", "What penalties apply for non-compliance?", or "Summarize the reporting obligations." DocTalk extracts the relevant provisions with numbered citations to the exact section.',
frontend/src/app/privacy/page.tsx:8:    'Learn how DocTalk handles your data, storage, deletion rights, and GDPR-aligned privacy controls for uploaded documents.',
frontend/src/app/privacy/page.tsx:9:  path: '/privacy',
frontend/src/app/privacy/page.tsx:12:    description: 'How DocTalk handles your data, encryption, and document privacy controls.',
frontend/src/app/use-cases/lawyers/page.tsx:22:      'Yes. DocTalk encrypts all uploaded documents with AES-256 encryption (SSE-S3) at rest. Your documents are never used for AI model training. DocTalk is GDPR-compliant and provides data export functionality for compliance requirements. All data processing happens through secured API connections.',
frontend/src/app/use-cases/compliance/ComplianceClient.tsx:56:  'What are the data retention requirements in this regulation?',
frontend/src/app/use-cases/compliance/ComplianceClient.tsx:90:  { icon: Lock, title: 'AES-256 Encryption', detail: 'All documents encrypted at rest with industry-standard encryption' },
frontend/src/app/use-cases/compliance/ComplianceClient.tsx:106:      'Yes. Upload regulatory texts, guidelines, or standards as PDF or DOCX files and ask questions like "What are the data retention requirements?", "What penalties apply for non-compliance?", or "Summarize the reporting obligations." DocTalk extracts the relevant provisions with numbered citations to the exact section.',
frontend/src/app/privacy/PrivacyPageClient.tsx:9:  usePageTitle(t('privacy.title'));
frontend/src/app/privacy/PrivacyPageClient.tsx:14:        <h1 className="text-2xl font-semibold mb-6 dark:text-white">{t('privacy.title')}</h1>
frontend/src/app/privacy/PrivacyPageClient.tsx:18:            <h2 className="text-lg font-semibold mb-2 dark:text-white">{t('privacy.section1.title')}</h2>
frontend/src/app/privacy/PrivacyPageClient.tsx:19:            <p>{t('privacy.section1.content')}</p>
frontend/src/app/privacy/PrivacyPageClient.tsx:23:            <h2 className="text-lg font-semibold mb-2 dark:text-white">{t('privacy.section2.title')}</h2>
frontend/src/app/privacy/PrivacyPageClient.tsx:25:              <li>{t('privacy.section2.item1')}</li>
frontend/src/app/privacy/PrivacyPageClient.tsx:26:              <li>{t('privacy.section2.item2')}</li>
frontend/src/app/privacy/PrivacyPageClient.tsx:27:              <li>{t('privacy.section2.item3')}</li>
frontend/src/app/privacy/PrivacyPageClient.tsx:32:            <h2 className="text-lg font-semibold mb-2 dark:text-white">{t('privacy.section3.title')}</h2>
frontend/src/app/privacy/PrivacyPageClient.tsx:33:            <p>{t('privacy.section3.content')}</p>
frontend/src/app/privacy/PrivacyPageClient.tsx:37:            <h2 className="text-lg font-semibold mb-2 dark:text-white">{t('privacy.section4.title')}</h2>
frontend/src/app/privacy/PrivacyPageClient.tsx:38:            <p>{t('privacy.section4.content')}</p>
frontend/src/app/privacy/PrivacyPageClient.tsx:42:            <h2 className="text-lg font-semibold mb-2 dark:text-white">{t('privacy.section5.title')}</h2>
frontend/src/app/privacy/PrivacyPageClient.tsx:43:            <p>{t('privacy.section5.content')}</p>
frontend/src/app/privacy/PrivacyPageClient.tsx:48:          <p>{t('privacy.lastUpdated')}: 2026-02-05</p>
frontend/src/app/use-cases/hr-contracts/page.tsx:27:      'Yes. DocTalk encrypts all uploaded documents with AES-256 encryption at rest. Documents are never used for AI model training. DocTalk is GDPR-compliant and supports data export and deletion requests.',
frontend/src/app/shared/[token]/page.tsx:16:  // egress IP. Same trust model as /api/proxy.
frontend/src/app/use-cases/teachers/page.tsx:32:      'Yes. All uploaded documents are encrypted with AES-256 encryption at rest. Your documents are never used for AI model training. DocTalk is GDPR-compliant and you can delete any uploaded document at any time. We recommend removing student names from submissions if privacy is a concern.',
frontend/src/app/use-cases/real-estate/RealEstateClient.tsx:71:  { icon: Lock, title: 'AES-256 Encryption', detail: 'All client documents encrypted at rest with industry-standard encryption' },
frontend/src/app/use-cases/real-estate/RealEstateClient.tsx:73:  { icon: FileText, title: 'GDPR Compliant', detail: 'Data export and deletion for compliance with privacy regulations' },
frontend/src/app/use-cases/real-estate/RealEstateClient.tsx:102:      'Yes. All uploaded documents are encrypted with AES-256 encryption at rest. Your documents are never used for AI model training. DocTalk is GDPR-compliant and you can delete any document at any time. Each user account is isolated and documents are only accessible to the uploader.',
frontend/src/app/use-cases/real-estate/RealEstateClient.tsx:158:                Agents and brokers need to quickly locate specific terms, compare provisions across documents, and identify potential issues before they become problems. Manually searching through stacks of documents is time-consuming and error-prone.
frontend/src/app/use-cases/real-estate/page.tsx:37:      'Yes. All uploaded documents are encrypted with AES-256 encryption at rest. Your documents are never used for AI model training. DocTalk is GDPR-compliant and you can delete any document at any time. Each user account is isolated and documents are only accessible to the uploader.',
frontend/src/app/use-cases/teachers/TeachersClient.tsx:88:      'Yes. All uploaded documents are encrypted with AES-256 encryption at rest. Your documents are never used for AI model training. DocTalk is GDPR-compliant and you can delete any uploaded document at any time. We recommend removing student names from submissions if privacy is a concern.',
frontend/src/app/page.tsx:91:              text: 'Absolutely. Your documents are TLS encrypted in transit and AES-256 encrypted at rest, never used for AI training, and you can delete them anytime. We follow privacy-first principles.',
frontend/src/app/use-cases/consultants/page.tsx:22:      'Yes. All uploaded documents are encrypted with AES-256 encryption at rest. Your documents are never used for AI model training. DocTalk is GDPR-compliant and provides data export and deletion capabilities. Each user account is isolated, and documents are only accessible to the user who uploaded them.',
frontend/src/app/use-cases/consultants/ConsultantsClient.tsx:50:      'Use Collections to group multiple client documents — contracts, financials, org charts — and run cross-document queries. Identify risks, inconsistencies, and key terms across the full document set.',
frontend/src/app/use-cases/consultants/ConsultantsClient.tsx:58:  'What are the payment terms in this contract?',
frontend/src/app/use-cases/consultants/ConsultantsClient.tsx:71:  { icon: Lock, title: 'AES-256 Encryption', detail: 'All documents encrypted at rest with industry-standard encryption' },
frontend/src/app/use-cases/consultants/ConsultantsClient.tsx:79:  { icon: MessageSquare, step: '2', title: 'Ask About the Document', description: 'Type questions about requirements, data points, terms, or anything in the text.' },
frontend/src/app/use-cases/consultants/ConsultantsClient.tsx:87:      'Yes. All uploaded documents are encrypted with AES-256 encryption at rest. Your documents are never used for AI model training. DocTalk is GDPR-compliant and provides data export and deletion capabilities. Each user account is isolated, and documents are only accessible to the user who uploaded them.',
frontend/src/app/collections/CollectionsPageClient.tsx:10:import { listCollections, deleteCollection } from '../../lib/api';
frontend/src/app/collections/CollectionsPageClient.tsx:44:      await deleteCollection(id);
frontend/src/app/collections/CollectionsPageClient.tsx:47:      console.error('Failed to delete collection:', e);
frontend/src/app/compare/notebooklm/page.tsx:8:    'Compare DocTalk and Google NotebookLM across citations, format support, privacy, pricing, and the tradeoff between deep analysis and multi-source notebooks.',
frontend/src/app/compare/notebooklm/page.tsx:14:      'DocTalk vs Google NotebookLM: citation highlighting, format support, privacy, and pricing compared.',
frontend/src/app/compare/notebooklm/page.tsx:25:    answer: 'Yes, Google NotebookLM is currently free to use, though it requires a Google account. Google has not yet announced pricing for future premium features. However, being free means you are subject to Google data practices and potential changes in service terms.',
frontend/src/app/compare/notebooklm/page.tsx:37:    answer: 'DocTalk stores documents with SSE-S3 encryption, never trains AI on your data, and provides GDPR data export. NotebookLM is a Google product subject to Google privacy policies. DocTalk gives you more control and transparency over your data.',
frontend/src/app/alternatives/notebooklm/page.tsx:14:      'Top NotebookLM alternatives for AI document analysis. Citation highlighting, multi-format support, and privacy-first options.',
frontend/src/app/alternatives/notebooklm/page.tsx:21:    answer: 'Common reasons include: wanting to avoid Google vendor lock-in, needing support for formats NotebookLM lacks (DOCX, PPTX, XLSX), wanting citation highlighting for answer verification, needing a fully multilingual interface, or preferring a privacy-first platform that encrypts your documents.',
frontend/src/app/alternatives/askyourpdf/AskyourpdfAltsClient.tsx:281:            DocTalk (7 formats) in terms of versatility. Its table extraction is a standout feature.

 succeeded in 0ms:
frontend/src/i18n/locales/de.json:883:  "useCasesLawyers.faq.q1.answer": "Ja. DocTalk verschlüsselt alle hochgeladenen Dokumente mit AES-256-Verschlüsselung (SSE-S3) im Ruhezustand. Ihre Dokumente werden niemals für KI-Modelltraining verwendet. DocTalk ist DSGVO-konform und bietet Datenexportfunktionalität für Compliance-Anforderungen.",
frontend/src/i18n/locales/de.json:889:  "useCasesLawyers.faq.q4.answer": "DocTalk funktioniert am besten mit textbasierten PDFs, bei denen die Textschicht erhalten ist. Für gescannte oder reine Bild-PDFs führt DocTalk automatisch OCR mit Tesseract (Englisch + vereinfachtes Chinesisch) aus, um Text zu extrahieren. Die OCR-Qualität hängt von Scan-Auflösung und Seitenlayout ab — für juristische Arbeit mit hoher Genauigkeitsanforderung bleiben textbasierte PDFs die zuverlässigste Quelle.",
frontend/src/i18n/locales/de.json:1324:  "compareChatpdf.feature.securityP2": "DocTalk implementiert SSE-S3-Verschlüsselung für alle hochgeladenen Dokumente, SSRF-Schutz für URL-Import, Magic-Byte-Dateivalidierung zur Verhinderung bösartiger Uploads und strukturierte Sicherheitsereignisprotokollierung. Dokumente werden niemals zum Training von KI-Modellen verwendet. DocTalk bietet auch einen DSGVO-Datenexport-Endpunkt und Cookie-Einwilligungsverwaltung. Die OAuth-Implementierung entfernt Token nach der Verknüpfung, und die Docker-Bereitstellung läuft als Nicht-Root-Benutzer für zusätzliche Sicherheit.",
frontend/src/i18n/locales/de.json:1390:  "compareNotebooklm.table.doctalk.dataEncryption": "SSE-S3",
frontend/src/i18n/locales/de.json:1420:  "compareNotebooklm.feature.securityP2": "DocTalk ist eine unabhängige Plattform mit SSE-S3-Verschlüsselung, SSRF-Schutz und DSGVO-Compliance-Funktionen. Dokumente werden niemals für KI-Training verwendet. Sie können Ihre Daten jederzeit exportieren, und die Plattform unterstützt mehrere Authentifizierungsanbieter (Google, Microsoft, E-Mail), um Anbieterbindung zu vermeiden. Für Organisationen, die Datenhoheit benötigen oder Google-Abhängigkeit vermeiden möchten, ist DocTalk die privatere Wahl.",
frontend/src/i18n/locales/de.json:1449:  "compareNotebooklm.faq.a5": "DocTalk speichert Dokumente mit SSE-S3-Verschlüsselung, trainiert niemals KI mit Ihren Daten und bietet DSGVO-Datenexport. NotebookLM ist ein Google-Produkt, das den Google-Datenschutzrichtlinien unterliegt. DocTalk gibt Ihnen mehr Kontrolle und Transparenz über Ihre Daten.",
frontend/src/i18n/locales/de.json:1579:  "altsNotebooklm.adv5": "SSE-S3-Verschlüsselung, keine Anbieterbindung",
frontend/src/i18n/locales/de.json:1745:  "compareHumata.securityDocTalk": "DocTalk implementiert SSE-S3-Verschlüsselung für alle hochgeladenen Dokumente, SSRF-Schutz für URL-Import, Magic-Byte-Dateivalidierung und DSGVO-Compliance mit Datenexport. Dokumente werden niemals für KI-Training verwendet. Die Anwendung läuft in Nicht-Root-Docker-Containern und verwendet strukturierte Sicherheitsereignisprotokollierung für Audit-Trails.",
frontend/src/i18n/locales/de.json:1804:  "comparePdfai.featureDataEncryptionDocTalk": "SSE-S3",
frontend/src/i18n/locales/de.json:1836:  "comparePdfai.securityDocTalk": "DocTalk implementiert umfassende Sicherheit: SSE-S3-Verschlüsselung für alle hochgeladenen Dokumente, SSRF-Schutz für URL-Import, Magic-Byte-Dateivalidierung, DSGVO-Datenexport, Cookie-Einwilligungsverwaltung, Nicht-Root-Docker-Bereitstellung und strukturierte Sicherheitsprotokollierung. Dokumente werden niemals für KI-Training verwendet.",
frontend/src/i18n/locales/de.json:1922:  "compareAskyourpdf.securityDocTalk": "DocTalk implementiert SSE-S3-Verschlüsselung, SSRF-Schutz, Magic-Byte-Dateivalidierung und DSGVO-Compliance-Funktionen einschließlich Datenexport. Keine Browser-Erweiterungen erforderlich, und Dokumente werden niemals für KI-Training verwendet. Die Anwendung läuft in Nicht-Root-Docker-Containern für zusätzliche Sicherheit.",
frontend/src/i18n/locales/ar.json:883:  "useCasesLawyers.faq.q1.answer": "Yes. DocTalk encrypts all uploaded documents with AES-256 encryption (SSE-S3) at rest. Your documents are never used for AI model training. DocTalk is GDPR-compliant and provides data export functionality for compliance requirements.",
frontend/src/i18n/locales/ar.json:889:  "useCasesLawyers.faq.q4.answer": "يعمل DocTalk بشكل أفضل مع ملفات PDF النصية التي تحافظ على طبقة النص. بالنسبة لملفات PDF الممسوحة ضوئيًا أو التي تحتوي على صور فقط، يقوم DocTalk تلقائيًا بتشغيل التعرف البصري على الحروف (OCR) باستخدام Tesseract (الإنجليزية + الصينية المبسطة) لاستخراج النص. تختلف جودة OCR حسب دقة المسح وتخطيط الصفحة — بالنسبة للعمل القانوني الذي يتطلب دقة عالية، تظل ملفات PDF النصية المصدر الأكثر موثوقية.",
frontend/src/i18n/locales/ar.json:1324:  "compareChatpdf.feature.securityP2": "DocTalk implements SSE-S3 encryption for all uploaded documents, SSRF protection for URL ingestion, magic-byte file validation to prevent malicious uploads, and structured security event logging. Documents are never used to train AI models. DocTalk also provides a GDPR data export endpoint and cookie consent management. The OAuth implementation strips tokens after linking, and the Docker deployment runs as a non-root user for defense in depth.",
frontend/src/i18n/locales/ar.json:1390:  "compareNotebooklm.table.doctalk.dataEncryption": "SSE-S3",
frontend/src/i18n/locales/ar.json:1420:  "compareNotebooklm.feature.securityP2": "DocTalk is an independent platform with SSE-S3 encryption, SSRF protection, and GDPR compliance features. Documents are never used for AI training. You can export all your data at any time, and the platform supports multiple authentication providers (Google, Microsoft, email) to avoid vendor lock-in. For organizations that need data sovereignty or want to avoid Google dependency, DocTalk is the more private choice.",
frontend/src/i18n/locales/ar.json:1449:  "compareNotebooklm.faq.a5": "DocTalk stores documents with SSE-S3 encryption, never trains AI on your data, and provides GDPR data export. NotebookLM is a Google product subject to Google privacy policies. DocTalk gives you more control and transparency over your data.",
frontend/src/i18n/locales/ar.json:1579:  "altsNotebooklm.adv5": "SSE-S3 encryption, no vendor lock-in",
frontend/src/i18n/locales/ar.json:1745:  "compareHumata.securityDocTalk": "DocTalk implements SSE-S3 encryption for all uploaded documents, SSRF protection for URL ingestion, magic-byte file validation, and GDPR compliance with data export. Documents are never used for AI training. The application runs in non-root Docker containers and uses structured security event logging for audit trails.",
frontend/src/i18n/locales/ar.json:1804:  "comparePdfai.featureDataEncryptionDocTalk": "SSE-S3",
frontend/src/i18n/locales/ar.json:1836:  "comparePdfai.securityDocTalk": "DocTalk implements comprehensive security: SSE-S3 encryption for all uploaded documents, SSRF protection for URL ingestion, magic-byte file validation, GDPR data export, cookie consent management, non-root Docker deployment, and structured security logging. Documents are never used for AI training.",
frontend/src/i18n/locales/ar.json:1922:  "compareAskyourpdf.securityDocTalk": "DocTalk implements SSE-S3 encryption, SSRF protection, magic-byte file validation, and GDPR compliance features including data export. No browser extensions are required, and documents are never used for AI training. The application runs in non-root Docker containers for additional security.",
frontend/src/i18n/locales/zh.json:198:  "profile.tabs.notifications": "通知",
frontend/src/i18n/locales/zh.json:199:  "profile.notifications.title": "通知",
frontend/src/i18n/locales/zh.json:200:  "profile.notifications.empty": "邮件通知和产品更新即将上线。",
frontend/src/i18n/locales/zh.json:886:  "useCasesLawyers.faq.q1.answer": "安全。DocTalk 对所有上传文档采用 AES-256 加密（SSE-S3）存储。您的文档绝不会用于 AI 训练，且您可以随时删除文件。",
frontend/src/i18n/locales/zh.json:892:  "useCasesLawyers.faq.q4.answer": "DocTalk 在保留文本层的文本型 PDF 上效果最佳。对于扫描件或纯图像 PDF，DocTalk 会自动使用 Tesseract（英文 + 简体中文）进行 OCR 提取。OCR 质量因扫描分辨率和版式而异 — 对高保真度要求的法律工作，文本型 PDF 仍是最可靠的输入。",
frontend/src/i18n/locales/zh.json:1327:  "compareChatpdf.feature.securityP2": "DocTalk 对所有上传文档实施 SSE-S3 加密、URL 导入的 SSRF 防护、magic-byte 文件验证以防止恶意上传，以及结构化的安全事件日志。文档绝不用于训练 AI 模型。DocTalk 还提供 GDPR 数据导出端点和 Cookie 同意管理。OAuth 实现在链接后清除令牌，Docker 部署以非 root 用户运行以实现纵深防御。",
frontend/src/i18n/locales/zh.json:1393:  "compareNotebooklm.table.doctalk.dataEncryption": "SSE-S3",
frontend/src/i18n/locales/zh.json:1423:  "compareNotebooklm.feature.securityP2": "DocTalk 是一个独立平台，提供 SSE-S3 加密、SSRF 防护和 GDPR 合规功能。文档绝不用于 AI 训练。您可以随时导出或删除所有数据。",
frontend/src/i18n/locales/zh.json:1452:  "compareNotebooklm.faq.a5": "DocTalk 使用 SSE-S3 加密存储文档，绝不在您的数据上训练 AI，并提供 GDPR 数据导出。NotebookLM 是 Google 产品，受 Google 隐私政策约束。DocTalk 是一个不受大型科技公司生态系统约束的独立平台。",
frontend/src/i18n/locales/zh.json:1582:  "altsNotebooklm.adv5": "SSE-S3 加密，无供应商锁定",
frontend/src/i18n/locales/zh.json:1748:  "compareHumata.securityDocTalk": "DocTalk 对所有上传文档实施 SSE-S3 加密、URL 导入的 SSRF 防护、magic-byte 文件验证以防止恶意上传、GDPR 合规功能（包括数据导出和删除），以及安全事件日志。",
frontend/src/i18n/locales/zh.json:1807:  "comparePdfai.featureDataEncryptionDocTalk": "SSE-S3",
frontend/src/i18n/locales/zh.json:1839:  "comparePdfai.securityDocTalk": "DocTalk 实施全面安全：所有上传文档的 SSE-S3 加密、URL 导入的 SSRF 防护、magic-byte 文件验证、GDPR 合规功能（包括数据导出和删除），以及安全事件日志。",
frontend/src/i18n/locales/zh.json:1925:  "compareAskyourpdf.securityDocTalk": "DocTalk 实施 SSE-S3 加密、SSRF 防护、magic-byte 文件验证和 GDPR 合规功能（包括数据导出和删除）。文档绝不用于 AI 训练。",
frontend/src/i18n/locales/ko.json:883:  "useCasesLawyers.faq.q1.answer": "Yes. DocTalk encrypts all uploaded documents with AES-256 encryption (SSE-S3) at rest. Your documents are never used for AI model training. DocTalk is GDPR-compliant and provides data export functionality for compliance requirements.",
frontend/src/i18n/locales/ko.json:889:  "useCasesLawyers.faq.q4.answer": "DocTalk는 텍스트 레이어가 보존된 텍스트 기반 PDF에서 가장 잘 작동합니다. 스캔된 PDF나 이미지 전용 PDF의 경우, DocTalk가 Tesseract(영어 + 중국어 간체)를 사용해 자동으로 OCR을 실행하여 텍스트를 추출합니다. OCR 품질은 스캔 해상도와 페이지 레이아웃에 따라 달라집니다 — 높은 정확도가 필요한 법률 업무에서는 텍스트 기반 PDF가 여전히 가장 신뢰할 수 있는 소스입니다.",
frontend/src/i18n/locales/ko.json:1324:  "compareChatpdf.feature.securityP2": "DocTalk implements SSE-S3 encryption for all uploaded documents, SSRF protection for URL ingestion, magic-byte file validation to prevent malicious uploads, and structured security event logging. Documents are never used to train AI models. DocTalk also provides a GDPR data export endpoint and cookie consent management. The OAuth implementation strips tokens after linking, and the Docker deployment runs as a non-root user for defense in depth.",
frontend/src/i18n/locales/ko.json:1390:  "compareNotebooklm.table.doctalk.dataEncryption": "SSE-S3",
frontend/src/i18n/locales/ko.json:1420:  "compareNotebooklm.feature.securityP2": "DocTalk is an independent platform with SSE-S3 encryption, SSRF protection, and GDPR compliance features. Documents are never used for AI training. You can export all your data at any time, and the platform supports multiple authentication providers (Google, Microsoft, email) to avoid vendor lock-in. For organizations that need data sovereignty or want to avoid Google dependency, DocTalk is the more private choice.",
frontend/src/i18n/locales/ko.json:1449:  "compareNotebooklm.faq.a5": "DocTalk stores documents with SSE-S3 encryption, never trains AI on your data, and provides GDPR data export. NotebookLM is a Google product subject to Google privacy policies. DocTalk gives you more control and transparency over your data.",
frontend/src/i18n/locales/ko.json:1579:  "altsNotebooklm.adv5": "SSE-S3 encryption, no vendor lock-in",
frontend/src/i18n/locales/ko.json:1745:  "compareHumata.securityDocTalk": "DocTalk implements SSE-S3 encryption for all uploaded documents, SSRF protection for URL ingestion, magic-byte file validation, and GDPR compliance with data export. Documents are never used for AI training. The application runs in non-root Docker containers and uses structured security event logging for audit trails.",
frontend/src/i18n/locales/ko.json:1804:  "comparePdfai.featureDataEncryptionDocTalk": "SSE-S3",
frontend/src/i18n/locales/ko.json:1836:  "comparePdfai.securityDocTalk": "DocTalk implements comprehensive security: SSE-S3 encryption for all uploaded documents, SSRF protection for URL ingestion, magic-byte file validation, GDPR data export, cookie consent management, non-root Docker deployment, and structured security logging. Documents are never used for AI training.",
frontend/src/i18n/locales/ko.json:1922:  "compareAskyourpdf.securityDocTalk": "DocTalk implements SSE-S3 encryption, SSRF protection, magic-byte file validation, and GDPR compliance features including data export. No browser extensions are required, and documents are never used for AI training. The application runs in non-root Docker containers for additional security.",
frontend/src/i18n/locales/pt.json:196:  "altsNotebooklm.adv5": "SSE-S3 encryption, no vendor lock-in",
frontend/src/i18n/locales/pt.json:556:  "compareAskyourpdf.securityDocTalk": "DocTalk implements SSE-S3 encryption, SSRF protection, magic-byte file validation, and GDPR compliance features including data export. No browser extensions are required, and documents are never used for AI training. The application runs in non-root Docker containers for additional security.",
frontend/src/i18n/locales/pt.json:623:  "compareChatpdf.feature.securityP2": "DocTalk implements SSE-S3 encryption for all documentos enviados, SSRF protection for URL ingestion, magic-byte file validation to prevent malicious uploads, and structured security event logging. Documents are never used to train AI models. DocTalk also provides a GDPR data export endpoint and cookie consent management. The OAuth implementation strips tokens after linking, and the Docker deployment runs as a non-root user for defense in depth.",
frontend/src/i18n/locales/pt.json:761:  "compareHumata.securityDocTalk": "DocTalk implements SSE-S3 encryption for all documentos enviados, SSRF protection for URL ingestion, magic-byte file validation, and GDPR compliance with data export. Documents are never used for AI training. The application runs in non-root Docker containers and uses structured security event logging for audit trails.",
frontend/src/i18n/locales/pt.json:795:  "compareNotebooklm.faq.a5": "DocTalk stores documents with SSE-S3 encryption, never trains AI on your data, and provides GDPR data export. NotebookLM is a Google product subject to Google privacy policies. DocTalk gives you more control and transparency over your data.",
frontend/src/i18n/locales/pt.json:825:  "compareNotebooklm.feature.securityP2": "O DocTalk é an independent platform with SSE-S3 encryption, SSRF protection, and GDPR compliance features. Documents are never used for AI training. You can export all your data at any time, and the platform supports multiple authentication providers (Google, Microsoft, email) to avoid vendor lock-in. For organizations that need data sovereignty or want to avoid Google dependency, O DocTalk é the more private choice.",
frontend/src/i18n/locales/pt.json:846:  "compareNotebooklm.table.doctalk.dataEncryption": "SSE-S3",
frontend/src/i18n/locales/pt.json:910:  "comparePdfai.featureDataEncryptionDocTalk": "SSE-S3",
frontend/src/i18n/locales/pt.json:947:  "comparePdfai.securityDocTalk": "DocTalk implements comprehensive security: SSE-S3 encryption for all documentos enviados, SSRF protection for URL ingestion, magic-byte file validation, GDPR data export, cookie consent management, non-root Docker deployment, and structured security logging. Documents are never used for AI training.",
frontend/src/i18n/locales/pt.json:1958:  "useCasesLawyers.faq.q1.answer": "Yes. DocTalk encrypts all uploaded documents with criptografia AES-256 (SSE-S3) at rest. Your documents are never used for AI model training. DocTalk is GDPR-compliant and provides data export functionality for compliance requirements.",
frontend/src/i18n/locales/pt.json:1964:  "useCasesLawyers.faq.q4.answer": "O DocTalk funciona melhor com PDFs textuais em que a camada de texto é preservada. Para PDFs digitalizados ou somente imagem, o DocTalk executa OCR automaticamente com Tesseract (inglês + chinês simplificado) para extrair texto. A qualidade do OCR varia conforme a resolução da digitalização e o layout da página — para trabalho jurídico que exige alta fidelidade, PDFs textuais continuam sendo a fonte mais confiável.",
frontend/src/i18n/locales/fr.json:883:  "useCasesLawyers.faq.q1.answer": "Oui. DocTalk chiffre tous les documents téléchargés avec le chiffrement AES-256 (SSE-S3) au repos. Vos documents ne sont jamais utilisés pour l'entraînement IA.",
frontend/src/i18n/locales/fr.json:889:  "useCasesLawyers.faq.q4.answer": "DocTalk fonctionne mieux avec les PDF texte où la couche de texte est préservée. Pour les PDF scannés ou uniquement images, DocTalk exécute automatiquement l'OCR via Tesseract (anglais + chinois simplifié) pour extraire le texte. La qualité de l'OCR varie selon la résolution du scan et la mise en page — pour un travail juridique exigeant une haute fidélité, les PDF texte restent la source la plus fiable.",
frontend/src/i18n/locales/fr.json:1324:  "compareChatpdf.feature.securityP2": "DocTalk implémente le chiffrement SSE-S3 pour tous les documents téléchargés, la protection SSRF pour l'import d'URL, et la conformité RGPD avec des fonctionnalités d'export et de suppression de données.",
frontend/src/i18n/locales/fr.json:1390:  "compareNotebooklm.table.doctalk.dataEncryption": "SSE-S3",
frontend/src/i18n/locales/fr.json:1420:  "compareNotebooklm.feature.securityP2": "DocTalk est une plateforme indépendante avec chiffrement SSE-S3, protection SSRF et conformité RGPD. Pas de dépendance à Google.",
frontend/src/i18n/locales/fr.json:1449:  "compareNotebooklm.faq.a5": "DocTalk stocke les documents avec chiffrement SSE-S3, n'entraîne jamais d'IA sur vos données et fournit des fonctionnalités d'export de données RGPD. NotebookLM est soumis aux politiques Google.",
frontend/src/i18n/locales/fr.json:1579:  "altsNotebooklm.adv5": "Chiffrement SSE-S3, pas de dépendance fournisseur",
frontend/src/i18n/locales/fr.json:1745:  "compareHumata.securityDocTalk": "DocTalk implémente le chiffrement SSE-S3 pour tous les documents téléchargés, la protection SSRF pour l'import d'URL et la conformité RGPD.",
frontend/src/i18n/locales/fr.json:1804:  "comparePdfai.featureDataEncryptionDocTalk": "SSE-S3",
frontend/src/i18n/locales/fr.json:1836:  "comparePdfai.securityDocTalk": "DocTalk implémente une sécurité complète : chiffrement SSE-S3 pour tous les documents, protection SSRF, validation magic-byte des fichiers et conformité RGPD.",
frontend/src/i18n/locales/fr.json:1922:  "compareAskyourpdf.securityDocTalk": "DocTalk implémente le chiffrement SSE-S3, la protection SSRF, la validation magic-byte des fichiers et la conformité RGPD.",
frontend/src/i18n/locales/ja.json:883:  "useCasesLawyers.faq.q1.answer": "Yes. DocTalk encrypts all uploaded documents with AES-256 encryption (SSE-S3) at rest. Your documents are never used for AI model training. DocTalk is GDPR-compliant and provides data export functionality for compliance requirements.",
frontend/src/i18n/locales/ja.json:889:  "useCasesLawyers.faq.q4.answer": "DocTalk はテキスト層が保持されたテキスト型 PDF で最も高い性能を発揮します。スキャンされた PDF や画像のみの PDF に対しては、DocTalk が Tesseract（英語 + 簡体字中国語）で自動的に OCR を実行し、テキストを抽出します。OCR の品質はスキャン解像度やページレイアウトによって変動します — 高い正確性が求められる法務業務では、テキスト型 PDF が引き続き最も信頼できるソースです。",
frontend/src/i18n/locales/ja.json:1324:  "compareChatpdf.feature.securityP2": "DocTalk implements SSE-S3 encryption for all uploaded documents, SSRF protection for URL ingestion, magic-byte file validation to prevent malicious uploads, and structured security event logging. Documents are never used to train AI models. DocTalk also provides a GDPR data export endpoint and cookie consent management. The OAuth implementation strips tokens after linking, and the Docker deployment runs as a non-root user for defense in depth.",
frontend/src/i18n/locales/ja.json:1390:  "compareNotebooklm.table.doctalk.dataEncryption": "SSE-S3",
frontend/src/i18n/locales/ja.json:1420:  "compareNotebooklm.feature.securityP2": "DocTalk is an independent platform with SSE-S3 encryption, SSRF protection, and GDPR compliance features. Documents are never used for AI training. You can export all your data at any time, and the platform supports multiple authentication providers (Google, Microsoft, email) to avoid vendor lock-in. For organizations that need data sovereignty or want to avoid Google dependency, DocTalk is the more private choice.",
frontend/src/i18n/locales/ja.json:1449:  "compareNotebooklm.faq.a5": "DocTalk stores documents with SSE-S3 encryption, never trains AI on your data, and provides GDPR data export. NotebookLM is a Google product subject to Google privacy policies. DocTalk gives you more control and transparency over your data.",
frontend/src/i18n/locales/ja.json:1579:  "altsNotebooklm.adv5": "SSE-S3 encryption, no vendor lock-in",
frontend/src/i18n/locales/ja.json:1745:  "compareHumata.securityDocTalk": "DocTalk implements SSE-S3 encryption for all uploaded documents, SSRF protection for URL ingestion, magic-byte file validation, and GDPR compliance with data export. Documents are never used for AI training. The application runs in non-root Docker containers and uses structured security event logging for audit trails.",
frontend/src/i18n/locales/ja.json:1804:  "comparePdfai.featureDataEncryptionDocTalk": "SSE-S3",
frontend/src/i18n/locales/ja.json:1836:  "comparePdfai.securityDocTalk": "DocTalk implements comprehensive security: SSE-S3 encryption for all uploaded documents, SSRF protection for URL ingestion, magic-byte file validation, GDPR data export, cookie consent management, non-root Docker deployment, and structured security logging. Documents are never used for AI training.",
frontend/src/i18n/locales/ja.json:1922:  "compareAskyourpdf.securityDocTalk": "DocTalk implements SSE-S3 encryption, SSRF protection, magic-byte file validation, and GDPR compliance features including data export. No browser extensions are required, and documents are never used for AI training. The application runs in non-root Docker containers for additional security.",
frontend/src/i18n/locales/en.json:90:  "privacy.deleteFast": "Delete in <60s",
frontend/src/i18n/locales/en.json:91:  "privacy.trustLink": "Trust Center",
frontend/src/i18n/locales/en.json:200:  "profile.tabs.notifications": "Notifications",
frontend/src/i18n/locales/en.json:201:  "profile.notifications.title": "Notifications",
frontend/src/i18n/locales/en.json:202:  "profile.notifications.empty": "Email notifications and product updates are coming soon.",
frontend/src/i18n/locales/en.json:888:  "useCasesLawyers.faq.q1.answer": "Yes. DocTalk encrypts all uploaded documents with AES-256 encryption (SSE-S3) at rest. Your documents are never used for AI model training. DocTalk is GDPR-compliant and provides data export functionality for compliance requirements.",
frontend/src/i18n/locales/en.json:894:  "useCasesLawyers.faq.q4.answer": "DocTalk works best with text-based PDFs where the text layer is preserved. For scanned or image-only PDFs, DocTalk automatically runs OCR using Tesseract (English + Simplified Chinese) to extract text. OCR quality varies with scan resolution and page layout — for legal work requiring high fidelity, text-based PDFs remain the most reliable source.",
frontend/src/i18n/locales/en.json:1329:  "compareChatpdf.feature.securityP2": "DocTalk implements SSE-S3 encryption for all uploaded documents, SSRF protection for URL ingestion, magic-byte file validation to prevent malicious uploads, and structured security event logging. Documents are never used to train AI models. DocTalk also provides a GDPR data export endpoint and cookie consent management. The OAuth implementation strips tokens after linking, and the Docker deployment runs as a non-root user for defense in depth.",
frontend/src/i18n/locales/en.json:1395:  "compareNotebooklm.table.doctalk.dataEncryption": "SSE-S3",
frontend/src/i18n/locales/en.json:1425:  "compareNotebooklm.feature.securityP2": "DocTalk is an independent platform with SSE-S3 encryption, SSRF protection, and GDPR compliance features. Documents are never used for AI training. You can export all your data at any time, and the platform supports multiple authentication providers (Google, Microsoft, email) to avoid vendor lock-in. For organizations that need data sovereignty or want to avoid Google dependency, DocTalk is the more private choice.",
frontend/src/i18n/locales/en.json:1454:  "compareNotebooklm.faq.a5": "DocTalk stores documents with SSE-S3 encryption, never trains AI on your data, and provides GDPR data export. NotebookLM is a Google product subject to Google privacy policies. DocTalk gives you more control and transparency over your data.",
frontend/src/i18n/locales/en.json:1584:  "altsNotebooklm.adv5": "SSE-S3 encryption, no vendor lock-in",
frontend/src/i18n/locales/en.json:1750:  "compareHumata.securityDocTalk": "DocTalk implements SSE-S3 encryption for all uploaded documents, SSRF protection for URL ingestion, magic-byte file validation, and GDPR compliance with data export. Documents are never used for AI training. The application runs in non-root Docker containers and uses structured security event logging for audit trails.",
frontend/src/i18n/locales/en.json:1809:  "comparePdfai.featureDataEncryptionDocTalk": "SSE-S3",
frontend/src/i18n/locales/en.json:1841:  "comparePdfai.securityDocTalk": "DocTalk implements comprehensive security: SSE-S3 encryption for all uploaded documents, SSRF protection for URL ingestion, magic-byte file validation, GDPR data export, cookie consent management, non-root Docker deployment, and structured security logging. Documents are never used for AI training.",
frontend/src/i18n/locales/en.json:1927:  "compareAskyourpdf.securityDocTalk": "DocTalk implements SSE-S3 encryption, SSRF protection, magic-byte file validation, and GDPR compliance features including data export. No browser extensions are required, and documents are never used for AI training. The application runs in non-root Docker containers for additional security.",
frontend/src/i18n/locales/it.json:883:  "useCasesLawyers.faq.q1.answer": "Yes. DocTalk encrypts all uploaded documents with AES-256 encryption (SSE-S3) at rest. Your documents are never used for AI model training. DocTalk is GDPR-compliant and provides data export functionality for compliance requirements.",
frontend/src/i18n/locales/it.json:889:  "useCasesLawyers.faq.q4.answer": "DocTalk funziona meglio con PDF testuali in cui il livello di testo è preservato. Per PDF scansionati o solo immagine, DocTalk esegue automaticamente l'OCR tramite Tesseract (inglese + cinese semplificato) per estrarre il testo. La qualità dell'OCR varia in base alla risoluzione della scansione e all'impaginazione — per il lavoro legale che richiede alta fedeltà, i PDF testuali restano la fonte più affidabile.",
frontend/src/i18n/locales/it.json:1324:  "compareChatpdf.feature.securityP2": "DocTalk implements SSE-S3 encryption for all uploaded documents, SSRF protection for URL ingestion, magic-byte file validation to prevent malicious uploads, and structured security event logging. Documents are never used to train AI models. DocTalk also provides a GDPR data export endpoint and cookie consent management. The OAuth implementation strips tokens after linking, and the Docker deployment runs as a non-root user for defense in depth.",
frontend/src/i18n/locales/it.json:1390:  "compareNotebooklm.table.doctalk.dataEncryption": "SSE-S3",
frontend/src/i18n/locales/it.json:1420:  "compareNotebooklm.feature.securityP2": "DocTalk is an independent platform with SSE-S3 encryption, SSRF protection, and GDPR compliance features. Documents are never used for AI training. You can export all your data at any time, and the platform supports multiple authentication providers (Google, Microsoft, email) to avoid vendor lock-in. For organizations that need data sovereignty or want to avoid Google dependency, DocTalk is the more private choice.",
frontend/src/i18n/locales/it.json:1449:  "compareNotebooklm.faq.a5": "DocTalk stores documents with SSE-S3 encryption, never trains AI on your data, and provides GDPR data export. NotebookLM is a Google product subject to Google privacy policies. DocTalk gives you more control and transparency over your data.",
frontend/src/i18n/locales/it.json:1579:  "altsNotebooklm.adv5": "SSE-S3 encryption, no vendor lock-in",
frontend/src/i18n/locales/it.json:1745:  "compareHumata.securityDocTalk": "DocTalk implements SSE-S3 encryption for all uploaded documents, SSRF protection for URL ingestion, magic-byte file validation, and GDPR compliance with data export. Documents are never used for AI training. The application runs in non-root Docker containers and uses structured security event logging for audit trails.",
frontend/src/i18n/locales/it.json:1804:  "comparePdfai.featureDataEncryptionDocTalk": "SSE-S3",
frontend/src/i18n/locales/it.json:1836:  "comparePdfai.securityDocTalk": "DocTalk implements comprehensive security: SSE-S3 encryption for all uploaded documents, SSRF protection for URL ingestion, magic-byte file validation, GDPR data export, cookie consent management, non-root Docker deployment, and structured security logging. Documents are never used for AI training.",
frontend/src/i18n/locales/it.json:1922:  "compareAskyourpdf.securityDocTalk": "DocTalk implements SSE-S3 encryption, SSRF protection, magic-byte file validation, and GDPR compliance features including data export. No browser extensions are required, and documents are never used for AI training. The application runs in non-root Docker containers for additional security.",
frontend/src/i18n/locales/hi.json:883:  "useCasesLawyers.faq.q1.answer": "Yes. DocTalk encrypts all uploaded documents with AES-256 encryption (SSE-S3) at rest. Your documents are never used for AI model training. DocTalk is GDPR-compliant and provides data export functionality for compliance requirements.",
frontend/src/i18n/locales/hi.json:889:  "useCasesLawyers.faq.q4.answer": "DocTalk टेक्स्ट-आधारित PDF के साथ सबसे बेहतर काम करता है जहाँ टेक्स्ट लेयर सुरक्षित रहती है। स्कैन किए गए या केवल-छवि वाले PDF के लिए, DocTalk Tesseract (अंग्रेज़ी + सरलीकृत चीनी) का उपयोग करके स्वचालित रूप से OCR चलाता है और टेक्स्ट निकालता है। OCR गुणवत्ता स्कैन रिज़ॉल्यूशन और पेज लेआउट के अनुसार बदलती है — उच्च सटीकता वाले कानूनी काम के लिए, टेक्स्ट-आधारित PDF ही सबसे विश्वसनीय स्रोत हैं।",
frontend/src/i18n/locales/hi.json:1324:  "compareChatpdf.feature.securityP2": "DocTalk implements SSE-S3 encryption for all uploaded documents, SSRF protection for URL ingestion, magic-byte file validation to prevent malicious uploads, and structured security event logging. Documents are never used to train AI models. DocTalk also provides a GDPR data export endpoint and cookie consent management. The OAuth implementation strips tokens after linking, and the Docker deployment runs as a non-root user for defense in depth.",
frontend/src/i18n/locales/hi.json:1390:  "compareNotebooklm.table.doctalk.dataEncryption": "SSE-S3",
frontend/src/i18n/locales/hi.json:1420:  "compareNotebooklm.feature.securityP2": "DocTalk is an independent platform with SSE-S3 encryption, SSRF protection, and GDPR compliance features. Documents are never used for AI training. You can export all your data at any time, and the platform supports multiple authentication providers (Google, Microsoft, email) to avoid vendor lock-in. For organizations that need data sovereignty or want to avoid Google dependency, DocTalk is the more private choice.",
frontend/src/i18n/locales/hi.json:1449:  "compareNotebooklm.faq.a5": "DocTalk stores documents with SSE-S3 encryption, never trains AI on your data, and provides GDPR data export. NotebookLM is a Google product subject to Google privacy policies. DocTalk gives you more control and transparency over your data.",
frontend/src/i18n/locales/hi.json:1579:  "altsNotebooklm.adv5": "SSE-S3 encryption, no vendor lock-in",
frontend/src/i18n/locales/hi.json:1745:  "compareHumata.securityDocTalk": "DocTalk implements SSE-S3 encryption for all uploaded documents, SSRF protection for URL ingestion, magic-byte file validation, and GDPR compliance with data export. Documents are never used for AI training. The application runs in non-root Docker containers and uses structured security event logging for audit trails.",
frontend/src/i18n/locales/hi.json:1804:  "comparePdfai.featureDataEncryptionDocTalk": "SSE-S3",
frontend/src/i18n/locales/hi.json:1836:  "comparePdfai.securityDocTalk": "DocTalk implements comprehensive security: SSE-S3 encryption for all uploaded documents, SSRF protection for URL ingestion, magic-byte file validation, GDPR data export, cookie consent management, non-root Docker deployment, and structured security logging. Documents are never used for AI training.",
frontend/src/i18n/locales/hi.json:1922:  "compareAskyourpdf.securityDocTalk": "DocTalk implements SSE-S3 encryption, SSRF protection, magic-byte file validation, and GDPR compliance features including data export. No browser extensions are required, and documents are never used for AI training. The application runs in non-root Docker containers for additional security.",
frontend/src/i18n/locales/es.json:883:  "useCasesLawyers.faq.q1.answer": "Yes. DocTalk encrypts all uploaded documents with AES-256 encryption (SSE-S3) at rest. Your documents are never used for AI model training. DocTalk is GDPR-compliant and provides data export functionality for compliance requirements.",
frontend/src/i18n/locales/es.json:889:  "useCasesLawyers.faq.q4.answer": "DocTalk funciona mejor con PDF de texto donde se conserva la capa textual. Para PDF escaneados o solo de imagen, DocTalk ejecuta automáticamente OCR con Tesseract (inglés + chino simplificado) para extraer texto. La calidad del OCR varía según la resolución del escaneo y el diseño de página — para trabajos jurídicos que requieren alta fidelidad, los PDF de texto siguen siendo la fuente más fiable.",
frontend/src/i18n/locales/es.json:1324:  "compareChatpdf.feature.securityP2": "DocTalk implements SSE-S3 encryption for all uploaded documents, SSRF protection for URL ingestion, magic-byte file validation to prevent malicious uploads, and structured security event logging. Documents are never used to train AI models. DocTalk also provides a GDPR data export endpoint and cookie consent management. The OAuth implementation strips tokens after linking, and the Docker deployment runs as a non-root user for defense in depth.",
frontend/src/i18n/locales/es.json:1390:  "compareNotebooklm.table.doctalk.dataEncryption": "SSE-S3",
frontend/src/i18n/locales/es.json:1420:  "compareNotebooklm.feature.securityP2": "DocTalk is an independent platform with SSE-S3 encryption, SSRF protection, and GDPR compliance features. Documents are never used for AI training. You can export all your data at any time, and the platform supports multiple authentication providers (Google, Microsoft, email) to avoid vendor lock-in. For organizations that need data sovereignty or want to avoid Google dependency, DocTalk is the more private choice.",
frontend/src/i18n/locales/es.json:1449:  "compareNotebooklm.faq.a5": "DocTalk stores documents with SSE-S3 encryption, never trains AI on your data, and provides GDPR data export. NotebookLM is a Google product subject to Google privacy policies. DocTalk gives you more control and transparency over your data.",
frontend/src/i18n/locales/es.json:1579:  "altsNotebooklm.adv5": "SSE-S3 encryption, no vendor lock-in",
frontend/src/i18n/locales/es.json:1745:  "compareHumata.securityDocTalk": "DocTalk implements SSE-S3 encryption for all uploaded documents, SSRF protection for URL ingestion, magic-byte file validation, and GDPR compliance with data export. Documents are never used for AI training. The application runs in non-root Docker containers and uses structured security event logging for audit trails.",
frontend/src/i18n/locales/es.json:1804:  "comparePdfai.featureDataEncryptionDocTalk": "SSE-S3",
frontend/src/i18n/locales/es.json:1836:  "comparePdfai.securityDocTalk": "DocTalk implements comprehensive security: SSE-S3 encryption for all uploaded documents, SSRF protection for URL ingestion, magic-byte file validation, GDPR data export, cookie consent management, non-root Docker deployment, and structured security logging. Documents are never used for AI training.",
frontend/src/i18n/locales/es.json:1922:  "compareAskyourpdf.securityDocTalk": "DocTalk implements SSE-S3 encryption, SSRF protection, magic-byte file validation, and GDPR compliance features including data export. No browser extensions are required, and documents are never used for AI training. The application runs in non-root Docker containers for additional security.",
frontend/src/i18n/locales/en.json:90:  "privacy.deleteFast": "Delete in <60s",
frontend/src/i18n/locales/en.json:91:  "privacy.trustLink": "Trust Center",
frontend/src/i18n/locales/en.json:200:  "profile.tabs.notifications": "Notifications",
frontend/src/i18n/locales/en.json:201:  "profile.notifications.title": "Notifications",
frontend/src/i18n/locales/en.json:202:  "profile.notifications.empty": "Email notifications and product updates are coming soon.",
frontend/src/i18n/locales/en.json:888:  "useCasesLawyers.faq.q1.answer": "Yes. DocTalk encrypts all uploaded documents with AES-256 encryption (SSE-S3) at rest. Your documents are never used for AI model training. DocTalk is GDPR-compliant and provides data export functionality for compliance requirements.",
frontend/src/i18n/locales/en.json:894:  "useCasesLawyers.faq.q4.answer": "DocTalk works best with text-based PDFs where the text layer is preserved. For scanned or image-only PDFs, DocTalk automatically runs OCR using Tesseract (English + Simplified Chinese) to extract text. OCR quality varies with scan resolution and page layout — for legal work requiring high fidelity, text-based PDFs remain the most reliable source.",
frontend/src/i18n/locales/en.json:1329:  "compareChatpdf.feature.securityP2": "DocTalk implements SSE-S3 encryption for all uploaded documents, SSRF protection for URL ingestion, magic-byte file validation to prevent malicious uploads, and structured security event logging. Documents are never used to train AI models. DocTalk also provides a GDPR data export endpoint and cookie consent management. The OAuth implementation strips tokens after linking, and the Docker deployment runs as a non-root user for defense in depth.",
frontend/src/i18n/locales/en.json:1395:  "compareNotebooklm.table.doctalk.dataEncryption": "SSE-S3",
frontend/src/i18n/locales/en.json:1425:  "compareNotebooklm.feature.securityP2": "DocTalk is an independent platform with SSE-S3 encryption, SSRF protection, and GDPR compliance features. Documents are never used for AI training. You can export all your data at any time, and the platform supports multiple authentication providers (Google, Microsoft, email) to avoid vendor lock-in. For organizations that need data sovereignty or want to avoid Google dependency, DocTalk is the more private choice.",
frontend/src/i18n/locales/en.json:1454:  "compareNotebooklm.faq.a5": "DocTalk stores documents with SSE-S3 encryption, never trains AI on your data, and provides GDPR data export. NotebookLM is a Google product subject to Google privacy policies. DocTalk gives you more control and transparency over your data.",
frontend/src/i18n/locales/en.json:1584:  "altsNotebooklm.adv5": "SSE-S3 encryption, no vendor lock-in",
frontend/src/i18n/locales/en.json:1750:  "compareHumata.securityDocTalk": "DocTalk implements SSE-S3 encryption for all uploaded documents, SSRF protection for URL ingestion, magic-byte file validation, and GDPR compliance with data export. Documents are never used for AI training. The application runs in non-root Docker containers and uses structured security event logging for audit trails.",
frontend/src/i18n/locales/en.json:1809:  "comparePdfai.featureDataEncryptionDocTalk": "SSE-S3",
frontend/src/i18n/locales/en.json:1841:  "comparePdfai.securityDocTalk": "DocTalk implements comprehensive security: SSE-S3 encryption for all uploaded documents, SSRF protection for URL ingestion, magic-byte file validation, GDPR data export, cookie consent management, non-root Docker deployment, and structured security logging. Documents are never used for AI training.",
frontend/src/i18n/locales/en.json:1927:  "compareAskyourpdf.securityDocTalk": "DocTalk implements SSE-S3 encryption, SSRF protection, magic-byte file validation, and GDPR compliance features including data export. No browser extensions are required, and documents are never used for AI training. The application runs in non-root Docker containers for additional security.",
frontend/src/components/Profile/ProfileTabs.tsx:17:  { key: "notifications", labelKey: "profile.tabs.notifications", fallback: "Notifications", icon: Bell },
frontend/src/i18n/locales/ar.json:883:  "useCasesLawyers.faq.q1.answer": "Yes. DocTalk encrypts all uploaded documents with AES-256 encryption (SSE-S3) at rest. Your documents are never used for AI model training. DocTalk is GDPR-compliant and provides data export functionality for compliance requirements.",
frontend/src/i18n/locales/ar.json:889:  "useCasesLawyers.faq.q4.answer": "يعمل DocTalk بشكل أفضل مع ملفات PDF النصية التي تحافظ على طبقة النص. بالنسبة لملفات PDF الممسوحة ضوئيًا أو التي تحتوي على صور فقط، يقوم DocTalk تلقائيًا بتشغيل التعرف البصري على الحروف (OCR) باستخدام Tesseract (الإنجليزية + الصينية المبسطة) لاستخراج النص. تختلف جودة OCR حسب دقة المسح وتخطيط الصفحة — بالنسبة للعمل القانوني الذي يتطلب دقة عالية، تظل ملفات PDF النصية المصدر الأكثر موثوقية.",
frontend/src/i18n/locales/ar.json:1324:  "compareChatpdf.feature.securityP2": "DocTalk implements SSE-S3 encryption for all uploaded documents, SSRF protection for URL ingestion, magic-byte file validation to prevent malicious uploads, and structured security event logging. Documents are never used to train AI models. DocTalk also provides a GDPR data export endpoint and cookie consent management. The OAuth implementation strips tokens after linking, and the Docker deployment runs as a non-root user for defense in depth.",
frontend/src/i18n/locales/ar.json:1390:  "compareNotebooklm.table.doctalk.dataEncryption": "SSE-S3",
frontend/src/i18n/locales/ar.json:1420:  "compareNotebooklm.feature.securityP2": "DocTalk is an independent platform with SSE-S3 encryption, SSRF protection, and GDPR compliance features. Documents are never used for AI training. You can export all your data at any time, and the platform supports multiple authentication providers (Google, Microsoft, email) to avoid vendor lock-in. For organizations that need data sovereignty or want to avoid Google dependency, DocTalk is the more private choice.",
frontend/src/i18n/locales/ar.json:1449:  "compareNotebooklm.faq.a5": "DocTalk stores documents with SSE-S3 encryption, never trains AI on your data, and provides GDPR data export. NotebookLM is a Google product subject to Google privacy policies. DocTalk gives you more control and transparency over your data.",
frontend/src/i18n/locales/ar.json:1579:  "altsNotebooklm.adv5": "SSE-S3 encryption, no vendor lock-in",
frontend/src/i18n/locales/ar.json:1745:  "compareHumata.securityDocTalk": "DocTalk implements SSE-S3 encryption for all uploaded documents, SSRF protection for URL ingestion, magic-byte file validation, and GDPR compliance with data export. Documents are never used for AI training. The application runs in non-root Docker containers and uses structured security event logging for audit trails.",
frontend/src/i18n/locales/ar.json:1804:  "comparePdfai.featureDataEncryptionDocTalk": "SSE-S3",
frontend/src/i18n/locales/ar.json:1836:  "comparePdfai.securityDocTalk": "DocTalk implements comprehensive security: SSE-S3 encryption for all uploaded documents, SSRF protection for URL ingestion, magic-byte file validation, GDPR data export, cookie consent management, non-root Docker deployment, and structured security logging. Documents are never used for AI training.",
frontend/src/i18n/locales/ar.json:1922:  "compareAskyourpdf.securityDocTalk": "DocTalk implements SSE-S3 encryption, SSRF protection, magic-byte file validation, and GDPR compliance features including data export. No browser extensions are required, and documents are never used for AI training. The application runs in non-root Docker containers for additional security.",
frontend/src/components/PrivacyBadge.tsx:20:          <span>AES-256 (SSE-S3)</span>
frontend/src/components/PrivacyBadge.tsx:24:          <span>OpenRouter zero-retention</span>
frontend/src/components/PrivacyBadge.tsx:28:          <span>{tOr('privacy.deleteFast', 'Delete in <60s')}</span>
frontend/src/components/PrivacyBadge.tsx:36:        {tOr('privacy.trustLink', 'Trust Center')} →
frontend/src/i18n/locales/pt.json:196:  "altsNotebooklm.adv5": "SSE-S3 encryption, no vendor lock-in",
frontend/src/i18n/locales/pt.json:556:  "compareAskyourpdf.securityDocTalk": "DocTalk implements SSE-S3 encryption, SSRF protection, magic-byte file validation, and GDPR compliance features including data export. No browser extensions are required, and documents are never used for AI training. The application runs in non-root Docker containers for additional security.",
frontend/src/i18n/locales/pt.json:623:  "compareChatpdf.feature.securityP2": "DocTalk implements SSE-S3 encryption for all documentos enviados, SSRF protection for URL ingestion, magic-byte file validation to prevent malicious uploads, and structured security event logging. Documents are never used to train AI models. DocTalk also provides a GDPR data export endpoint and cookie consent management. The OAuth implementation strips tokens after linking, and the Docker deployment runs as a non-root user for defense in depth.",
frontend/src/i18n/locales/pt.json:761:  "compareHumata.securityDocTalk": "DocTalk implements SSE-S3 encryption for all documentos enviados, SSRF protection for URL ingestion, magic-byte file validation, and GDPR compliance with data export. Documents are never used for AI training. The application runs in non-root Docker containers and uses structured security event logging for audit trails.",
frontend/src/i18n/locales/pt.json:795:  "compareNotebooklm.faq.a5": "DocTalk stores documents with SSE-S3 encryption, never trains AI on your data, and provides GDPR data export. NotebookLM is a Google product subject to Google privacy policies. DocTalk gives you more control and transparency over your data.",
frontend/src/i18n/locales/pt.json:825:  "compareNotebooklm.feature.securityP2": "O DocTalk é an independent platform with SSE-S3 encryption, SSRF protection, and GDPR compliance features. Documents are never used for AI training. You can export all your data at any time, and the platform supports multiple authentication providers (Google, Microsoft, email) to avoid vendor lock-in. For organizations that need data sovereignty or want to avoid Google dependency, O DocTalk é the more private choice.",
frontend/src/i18n/locales/pt.json:846:  "compareNotebooklm.table.doctalk.dataEncryption": "SSE-S3",
frontend/src/i18n/locales/pt.json:910:  "comparePdfai.featureDataEncryptionDocTalk": "SSE-S3",
frontend/src/i18n/locales/pt.json:947:  "comparePdfai.securityDocTalk": "DocTalk implements comprehensive security: SSE-S3 encryption for all documentos enviados, SSRF protection for URL ingestion, magic-byte file validation, GDPR data export, cookie consent management, non-root Docker deployment, and structured security logging. Documents are never used for AI training.",
frontend/src/i18n/locales/pt.json:1958:  "useCasesLawyers.faq.q1.answer": "Yes. DocTalk encrypts all uploaded documents with criptografia AES-256 (SSE-S3) at rest. Your documents are never used for AI model training. DocTalk is GDPR-compliant and provides data export functionality for compliance requirements.",
frontend/src/i18n/locales/pt.json:1964:  "useCasesLawyers.faq.q4.answer": "O DocTalk funciona melhor com PDFs textuais em que a camada de texto é preservada. Para PDFs digitalizados ou somente imagem, o DocTalk executa OCR automaticamente com Tesseract (inglês + chinês simplificado) para extrair texto. A qualidade do OCR varia conforme a resolução da digitalização e o layout da página — para trabalho jurídico que exige alta fidelidade, PDFs textuais continuam sendo a fonte mais confiável.",
frontend/src/i18n/locales/es.json:883:  "useCasesLawyers.faq.q1.answer": "Yes. DocTalk encrypts all uploaded documents with AES-256 encryption (SSE-S3) at rest. Your documents are never used for AI model training. DocTalk is GDPR-compliant and provides data export functionality for compliance requirements.",
frontend/src/i18n/locales/es.json:889:  "useCasesLawyers.faq.q4.answer": "DocTalk funciona mejor con PDF de texto donde se conserva la capa textual. Para PDF escaneados o solo de imagen, DocTalk ejecuta automáticamente OCR con Tesseract (inglés + chino simplificado) para extraer texto. La calidad del OCR varía según la resolución del escaneo y el diseño de página — para trabajos jurídicos que requieren alta fidelidad, los PDF de texto siguen siendo la fuente más fiable.",
frontend/src/i18n/locales/es.json:1324:  "compareChatpdf.feature.securityP2": "DocTalk implements SSE-S3 encryption for all uploaded documents, SSRF protection for URL ingestion, magic-byte file validation to prevent malicious uploads, and structured security event logging. Documents are never used to train AI models. DocTalk also provides a GDPR data export endpoint and cookie consent management. The OAuth implementation strips tokens after linking, and the Docker deployment runs as a non-root user for defense in depth.",
frontend/src/i18n/locales/es.json:1390:  "compareNotebooklm.table.doctalk.dataEncryption": "SSE-S3",
frontend/src/i18n/locales/es.json:1420:  "compareNotebooklm.feature.securityP2": "DocTalk is an independent platform with SSE-S3 encryption, SSRF protection, and GDPR compliance features. Documents are never used for AI training. You can export all your data at any time, and the platform supports multiple authentication providers (Google, Microsoft, email) to avoid vendor lock-in. For organizations that need data sovereignty or want to avoid Google dependency, DocTalk is the more private choice.",
frontend/src/i18n/locales/es.json:1449:  "compareNotebooklm.faq.a5": "DocTalk stores documents with SSE-S3 encryption, never trains AI on your data, and provides GDPR data export. NotebookLM is a Google product subject to Google privacy policies. DocTalk gives you more control and transparency over your data.",
frontend/src/i18n/locales/es.json:1579:  "altsNotebooklm.adv5": "SSE-S3 encryption, no vendor lock-in",
frontend/src/i18n/locales/es.json:1745:  "compareHumata.securityDocTalk": "DocTalk implements SSE-S3 encryption for all uploaded documents, SSRF protection for URL ingestion, magic-byte file validation, and GDPR compliance with data export. Documents are never used for AI training. The application runs in non-root Docker containers and uses structured security event logging for audit trails.",
frontend/src/i18n/locales/es.json:1804:  "comparePdfai.featureDataEncryptionDocTalk": "SSE-S3",
frontend/src/i18n/locales/es.json:1836:  "comparePdfai.securityDocTalk": "DocTalk implements comprehensive security: SSE-S3 encryption for all uploaded documents, SSRF protection for URL ingestion, magic-byte file validation, GDPR data export, cookie consent management, non-root Docker deployment, and structured security logging. Documents are never used for AI training.",
frontend/src/i18n/locales/es.json:1922:  "compareAskyourpdf.securityDocTalk": "DocTalk implements SSE-S3 encryption, SSRF protection, magic-byte file validation, and GDPR compliance features including data export. No browser extensions are required, and documents are never used for AI training. The application runs in non-root Docker containers for additional security.",
frontend/src/i18n/locales/ko.json:883:  "useCasesLawyers.faq.q1.answer": "Yes. DocTalk encrypts all uploaded documents with AES-256 encryption (SSE-S3) at rest. Your documents are never used for AI model training. DocTalk is GDPR-compliant and provides data export functionality for compliance requirements.",
frontend/src/i18n/locales/ko.json:889:  "useCasesLawyers.faq.q4.answer": "DocTalk는 텍스트 레이어가 보존된 텍스트 기반 PDF에서 가장 잘 작동합니다. 스캔된 PDF나 이미지 전용 PDF의 경우, DocTalk가 Tesseract(영어 + 중국어 간체)를 사용해 자동으로 OCR을 실행하여 텍스트를 추출합니다. OCR 품질은 스캔 해상도와 페이지 레이아웃에 따라 달라집니다 — 높은 정확도가 필요한 법률 업무에서는 텍스트 기반 PDF가 여전히 가장 신뢰할 수 있는 소스입니다.",
frontend/src/i18n/locales/ko.json:1324:  "compareChatpdf.feature.securityP2": "DocTalk implements SSE-S3 encryption for all uploaded documents, SSRF protection for URL ingestion, magic-byte file validation to prevent malicious uploads, and structured security event logging. Documents are never used to train AI models. DocTalk also provides a GDPR data export endpoint and cookie consent management. The OAuth implementation strips tokens after linking, and the Docker deployment runs as a non-root user for defense in depth.",
frontend/src/i18n/locales/ko.json:1390:  "compareNotebooklm.table.doctalk.dataEncryption": "SSE-S3",
frontend/src/i18n/locales/ko.json:1420:  "compareNotebooklm.feature.securityP2": "DocTalk is an independent platform with SSE-S3 encryption, SSRF protection, and GDPR compliance features. Documents are never used for AI training. You can export all your data at any time, and the platform supports multiple authentication providers (Google, Microsoft, email) to avoid vendor lock-in. For organizations that need data sovereignty or want to avoid Google dependency, DocTalk is the more private choice.",
frontend/src/i18n/locales/ko.json:1449:  "compareNotebooklm.faq.a5": "DocTalk stores documents with SSE-S3 encryption, never trains AI on your data, and provides GDPR data export. NotebookLM is a Google product subject to Google privacy policies. DocTalk gives you more control and transparency over your data.",
frontend/src/i18n/locales/ko.json:1579:  "altsNotebooklm.adv5": "SSE-S3 encryption, no vendor lock-in",
frontend/src/i18n/locales/ko.json:1745:  "compareHumata.securityDocTalk": "DocTalk implements SSE-S3 encryption for all uploaded documents, SSRF protection for URL ingestion, magic-byte file validation, and GDPR compliance with data export. Documents are never used for AI training. The application runs in non-root Docker containers and uses structured security event logging for audit trails.",
frontend/src/i18n/locales/ko.json:1804:  "comparePdfai.featureDataEncryptionDocTalk": "SSE-S3",
frontend/src/i18n/locales/ko.json:1836:  "comparePdfai.securityDocTalk": "DocTalk implements comprehensive security: SSE-S3 encryption for all uploaded documents, SSRF protection for URL ingestion, magic-byte file validation, GDPR data export, cookie consent management, non-root Docker deployment, and structured security logging. Documents are never used for AI training.",
frontend/src/i18n/locales/ko.json:1922:  "compareAskyourpdf.securityDocTalk": "DocTalk implements SSE-S3 encryption, SSRF protection, magic-byte file validation, and GDPR compliance features including data export. No browser extensions are required, and documents are never used for AI training. The application runs in non-root Docker containers for additional security.",
frontend/src/i18n/locales/hi.json:883:  "useCasesLawyers.faq.q1.answer": "Yes. DocTalk encrypts all uploaded documents with AES-256 encryption (SSE-S3) at rest. Your documents are never used for AI model training. DocTalk is GDPR-compliant and provides data export functionality for compliance requirements.",
frontend/src/i18n/locales/hi.json:889:  "useCasesLawyers.faq.q4.answer": "DocTalk टेक्स्ट-आधारित PDF के साथ सबसे बेहतर काम करता है जहाँ टेक्स्ट लेयर सुरक्षित रहती है। स्कैन किए गए या केवल-छवि वाले PDF के लिए, DocTalk Tesseract (अंग्रेज़ी + सरलीकृत चीनी) का उपयोग करके स्वचालित रूप से OCR चलाता है और टेक्स्ट निकालता है। OCR गुणवत्ता स्कैन रिज़ॉल्यूशन और पेज लेआउट के अनुसार बदलती है — उच्च सटीकता वाले कानूनी काम के लिए, टेक्स्ट-आधारित PDF ही सबसे विश्वसनीय स्रोत हैं।",
frontend/src/i18n/locales/hi.json:1324:  "compareChatpdf.feature.securityP2": "DocTalk implements SSE-S3 encryption for all uploaded documents, SSRF protection for URL ingestion, magic-byte file validation to prevent malicious uploads, and structured security event logging. Documents are never used to train AI models. DocTalk also provides a GDPR data export endpoint and cookie consent management. The OAuth implementation strips tokens after linking, and the Docker deployment runs as a non-root user for defense in depth.",
frontend/src/i18n/locales/hi.json:1390:  "compareNotebooklm.table.doctalk.dataEncryption": "SSE-S3",
frontend/src/i18n/locales/hi.json:1420:  "compareNotebooklm.feature.securityP2": "DocTalk is an independent platform with SSE-S3 encryption, SSRF protection, and GDPR compliance features. Documents are never used for AI training. You can export all your data at any time, and the platform supports multiple authentication providers (Google, Microsoft, email) to avoid vendor lock-in. For organizations that need data sovereignty or want to avoid Google dependency, DocTalk is the more private choice.",
frontend/src/i18n/locales/hi.json:1449:  "compareNotebooklm.faq.a5": "DocTalk stores documents with SSE-S3 encryption, never trains AI on your data, and provides GDPR data export. NotebookLM is a Google product subject to Google privacy policies. DocTalk gives you more control and transparency over your data.",
frontend/src/i18n/locales/hi.json:1579:  "altsNotebooklm.adv5": "SSE-S3 encryption, no vendor lock-in",
frontend/src/i18n/locales/hi.json:1745:  "compareHumata.securityDocTalk": "DocTalk implements SSE-S3 encryption for all uploaded documents, SSRF protection for URL ingestion, magic-byte file validation, and GDPR compliance with data export. Documents are never used for AI training. The application runs in non-root Docker containers and uses structured security event logging for audit trails.",
frontend/src/i18n/locales/hi.json:1804:  "comparePdfai.featureDataEncryptionDocTalk": "SSE-S3",
frontend/src/i18n/locales/hi.json:1836:  "comparePdfai.securityDocTalk": "DocTalk implements comprehensive security: SSE-S3 encryption for all uploaded documents, SSRF protection for URL ingestion, magic-byte file validation, GDPR data export, cookie consent management, non-root Docker deployment, and structured security logging. Documents are never used for AI training.",
frontend/src/i18n/locales/hi.json:1922:  "compareAskyourpdf.securityDocTalk": "DocTalk implements SSE-S3 encryption, SSRF protection, magic-byte file validation, and GDPR compliance features including data export. No browser extensions are required, and documents are never used for AI training. The application runs in non-root Docker containers for additional security.",
frontend/src/i18n/locales/fr.json:883:  "useCasesLawyers.faq.q1.answer": "Oui. DocTalk chiffre tous les documents téléchargés avec le chiffrement AES-256 (SSE-S3) au repos. Vos documents ne sont jamais utilisés pour l'entraînement IA.",
frontend/src/i18n/locales/fr.json:889:  "useCasesLawyers.faq.q4.answer": "DocTalk fonctionne mieux avec les PDF texte où la couche de texte est préservée. Pour les PDF scannés ou uniquement images, DocTalk exécute automatiquement l'OCR via Tesseract (anglais + chinois simplifié) pour extraire le texte. La qualité de l'OCR varie selon la résolution du scan et la mise en page — pour un travail juridique exigeant une haute fidélité, les PDF texte restent la source la plus fiable.",
frontend/src/i18n/locales/fr.json:1324:  "compareChatpdf.feature.securityP2": "DocTalk implémente le chiffrement SSE-S3 pour tous les documents téléchargés, la protection SSRF pour l'import d'URL, et la conformité RGPD avec des fonctionnalités d'export et de suppression de données.",
frontend/src/i18n/locales/fr.json:1390:  "compareNotebooklm.table.doctalk.dataEncryption": "SSE-S3",
frontend/src/i18n/locales/fr.json:1420:  "compareNotebooklm.feature.securityP2": "DocTalk est une plateforme indépendante avec chiffrement SSE-S3, protection SSRF et conformité RGPD. Pas de dépendance à Google.",
frontend/src/i18n/locales/fr.json:1449:  "compareNotebooklm.faq.a5": "DocTalk stocke les documents avec chiffrement SSE-S3, n'entraîne jamais d'IA sur vos données et fournit des fonctionnalités d'export de données RGPD. NotebookLM est soumis aux politiques Google.",
frontend/src/i18n/locales/fr.json:1579:  "altsNotebooklm.adv5": "Chiffrement SSE-S3, pas de dépendance fournisseur",
frontend/src/i18n/locales/fr.json:1745:  "compareHumata.securityDocTalk": "DocTalk implémente le chiffrement SSE-S3 pour tous les documents téléchargés, la protection SSRF pour l'import d'URL et la conformité RGPD.",
frontend/src/i18n/locales/fr.json:1804:  "comparePdfai.featureDataEncryptionDocTalk": "SSE-S3",
frontend/src/i18n/locales/fr.json:1836:  "comparePdfai.securityDocTalk": "DocTalk implémente une sécurité complète : chiffrement SSE-S3 pour tous les documents, protection SSRF, validation magic-byte des fichiers et conformité RGPD.",
frontend/src/i18n/locales/fr.json:1922:  "compareAskyourpdf.securityDocTalk": "DocTalk implémente le chiffrement SSE-S3, la protection SSRF, la validation magic-byte des fichiers et la conformité RGPD.",
frontend/src/components/PrivacyBadge.tsx:20:          <span>AES-256 (SSE-S3)</span>
frontend/src/components/PrivacyBadge.tsx:24:          <span>OpenRouter zero-retention</span>
frontend/src/components/PrivacyBadge.tsx:28:          <span>{tOr('privacy.deleteFast', 'Delete in <60s')}</span>
frontend/src/components/PrivacyBadge.tsx:36:        {tOr('privacy.trustLink', 'Trust Center')} →
frontend/src/i18n/locales/it.json:883:  "useCasesLawyers.faq.q1.answer": "Yes. DocTalk encrypts all uploaded documents with AES-256 encryption (SSE-S3) at rest. Your documents are never used for AI model training. DocTalk is GDPR-compliant and provides data export functionality for compliance requirements.",
frontend/src/i18n/locales/it.json:889:  "useCasesLawyers.faq.q4.answer": "DocTalk funziona meglio con PDF testuali in cui il livello di testo è preservato. Per PDF scansionati o solo immagine, DocTalk esegue automaticamente l'OCR tramite Tesseract (inglese + cinese semplificato) per estrarre il testo. La qualità dell'OCR varia in base alla risoluzione della scansione e all'impaginazione — per il lavoro legale che richiede alta fedeltà, i PDF testuali restano la fonte più affidabile.",
frontend/src/i18n/locales/it.json:1324:  "compareChatpdf.feature.securityP2": "DocTalk implements SSE-S3 encryption for all uploaded documents, SSRF protection for URL ingestion, magic-byte file validation to prevent malicious uploads, and structured security event logging. Documents are never used to train AI models. DocTalk also provides a GDPR data export endpoint and cookie consent management. The OAuth implementation strips tokens after linking, and the Docker deployment runs as a non-root user for defense in depth.",
frontend/src/i18n/locales/it.json:1390:  "compareNotebooklm.table.doctalk.dataEncryption": "SSE-S3",
frontend/src/i18n/locales/it.json:1420:  "compareNotebooklm.feature.securityP2": "DocTalk is an independent platform with SSE-S3 encryption, SSRF protection, and GDPR compliance features. Documents are never used for AI training. You can export all your data at any time, and the platform supports multiple authentication providers (Google, Microsoft, email) to avoid vendor lock-in. For organizations that need data sovereignty or want to avoid Google dependency, DocTalk is the more private choice.",
frontend/src/i18n/locales/it.json:1449:  "compareNotebooklm.faq.a5": "DocTalk stores documents with SSE-S3 encryption, never trains AI on your data, and provides GDPR data export. NotebookLM is a Google product subject to Google privacy policies. DocTalk gives you more control and transparency over your data.",
frontend/src/i18n/locales/it.json:1579:  "altsNotebooklm.adv5": "SSE-S3 encryption, no vendor lock-in",
frontend/src/i18n/locales/it.json:1745:  "compareHumata.securityDocTalk": "DocTalk implements SSE-S3 encryption for all uploaded documents, SSRF protection for URL ingestion, magic-byte file validation, and GDPR compliance with data export. Documents are never used for AI training. The application runs in non-root Docker containers and uses structured security event logging for audit trails.",
frontend/src/i18n/locales/it.json:1804:  "comparePdfai.featureDataEncryptionDocTalk": "SSE-S3",
frontend/src/i18n/locales/it.json:1836:  "comparePdfai.securityDocTalk": "DocTalk implements comprehensive security: SSE-S3 encryption for all uploaded documents, SSRF protection for URL ingestion, magic-byte file validation, GDPR data export, cookie consent management, non-root Docker deployment, and structured security logging. Documents are never used for AI training.",
frontend/src/i18n/locales/it.json:1922:  "compareAskyourpdf.securityDocTalk": "DocTalk implements SSE-S3 encryption, SSRF protection, magic-byte file validation, and GDPR compliance features including data export. No browser extensions are required, and documents are never used for AI training. The application runs in non-root Docker containers for additional security.",
frontend/src/components/Profile/ProfileTabs.tsx:17:  { key: "notifications", labelKey: "profile.tabs.notifications", fallback: "Notifications", icon: Bell },
frontend/src/i18n/locales/de.json:883:  "useCasesLawyers.faq.q1.answer": "Ja. DocTalk verschlüsselt alle hochgeladenen Dokumente mit AES-256-Verschlüsselung (SSE-S3) im Ruhezustand. Ihre Dokumente werden niemals für KI-Modelltraining verwendet. DocTalk ist DSGVO-konform und bietet Datenexportfunktionalität für Compliance-Anforderungen.",
frontend/src/i18n/locales/de.json:889:  "useCasesLawyers.faq.q4.answer": "DocTalk funktioniert am besten mit textbasierten PDFs, bei denen die Textschicht erhalten ist. Für gescannte oder reine Bild-PDFs führt DocTalk automatisch OCR mit Tesseract (Englisch + vereinfachtes Chinesisch) aus, um Text zu extrahieren. Die OCR-Qualität hängt von Scan-Auflösung und Seitenlayout ab — für juristische Arbeit mit hoher Genauigkeitsanforderung bleiben textbasierte PDFs die zuverlässigste Quelle.",
frontend/src/i18n/locales/de.json:1324:  "compareChatpdf.feature.securityP2": "DocTalk implementiert SSE-S3-Verschlüsselung für alle hochgeladenen Dokumente, SSRF-Schutz für URL-Import, Magic-Byte-Dateivalidierung zur Verhinderung bösartiger Uploads und strukturierte Sicherheitsereignisprotokollierung. Dokumente werden niemals zum Training von KI-Modellen verwendet. DocTalk bietet auch einen DSGVO-Datenexport-Endpunkt und Cookie-Einwilligungsverwaltung. Die OAuth-Implementierung entfernt Token nach der Verknüpfung, und die Docker-Bereitstellung läuft als Nicht-Root-Benutzer für zusätzliche Sicherheit.",
frontend/src/i18n/locales/de.json:1390:  "compareNotebooklm.table.doctalk.dataEncryption": "SSE-S3",
frontend/src/i18n/locales/de.json:1420:  "compareNotebooklm.feature.securityP2": "DocTalk ist eine unabhängige Plattform mit SSE-S3-Verschlüsselung, SSRF-Schutz und DSGVO-Compliance-Funktionen. Dokumente werden niemals für KI-Training verwendet. Sie können Ihre Daten jederzeit exportieren, und die Plattform unterstützt mehrere Authentifizierungsanbieter (Google, Microsoft, E-Mail), um Anbieterbindung zu vermeiden. Für Organisationen, die Datenhoheit benötigen oder Google-Abhängigkeit vermeiden möchten, ist DocTalk die privatere Wahl.",
frontend/src/i18n/locales/de.json:1449:  "compareNotebooklm.faq.a5": "DocTalk speichert Dokumente mit SSE-S3-Verschlüsselung, trainiert niemals KI mit Ihren Daten und bietet DSGVO-Datenexport. NotebookLM ist ein Google-Produkt, das den Google-Datenschutzrichtlinien unterliegt. DocTalk gibt Ihnen mehr Kontrolle und Transparenz über Ihre Daten.",
frontend/src/i18n/locales/de.json:1579:  "altsNotebooklm.adv5": "SSE-S3-Verschlüsselung, keine Anbieterbindung",
frontend/src/i18n/locales/de.json:1745:  "compareHumata.securityDocTalk": "DocTalk implementiert SSE-S3-Verschlüsselung für alle hochgeladenen Dokumente, SSRF-Schutz für URL-Import, Magic-Byte-Dateivalidierung und DSGVO-Compliance mit Datenexport. Dokumente werden niemals für KI-Training verwendet. Die Anwendung läuft in Nicht-Root-Docker-Containern und verwendet strukturierte Sicherheitsereignisprotokollierung für Audit-Trails.",
frontend/src/i18n/locales/de.json:1804:  "comparePdfai.featureDataEncryptionDocTalk": "SSE-S3",
frontend/src/i18n/locales/de.json:1836:  "comparePdfai.securityDocTalk": "DocTalk implementiert umfassende Sicherheit: SSE-S3-Verschlüsselung für alle hochgeladenen Dokumente, SSRF-Schutz für URL-Import, Magic-Byte-Dateivalidierung, DSGVO-Datenexport, Cookie-Einwilligungsverwaltung, Nicht-Root-Docker-Bereitstellung und strukturierte Sicherheitsprotokollierung. Dokumente werden niemals für KI-Training verwendet.",
frontend/src/i18n/locales/de.json:1922:  "compareAskyourpdf.securityDocTalk": "DocTalk implementiert SSE-S3-Verschlüsselung, SSRF-Schutz, Magic-Byte-Dateivalidierung und DSGVO-Compliance-Funktionen einschließlich Datenexport. Keine Browser-Erweiterungen erforderlich, und Dokumente werden niemals für KI-Training verwendet. Die Anwendung läuft in Nicht-Root-Docker-Containern für zusätzliche Sicherheit.",
frontend/src/i18n/locales/ja.json:883:  "useCasesLawyers.faq.q1.answer": "Yes. DocTalk encrypts all uploaded documents with AES-256 encryption (SSE-S3) at rest. Your documents are never used for AI model training. DocTalk is GDPR-compliant and provides data export functionality for compliance requirements.",
frontend/src/i18n/locales/ja.json:889:  "useCasesLawyers.faq.q4.answer": "DocTalk はテキスト層が保持されたテキスト型 PDF で最も高い性能を発揮します。スキャンされた PDF や画像のみの PDF に対しては、DocTalk が Tesseract（英語 + 簡体字中国語）で自動的に OCR を実行し、テキストを抽出します。OCR の品質はスキャン解像度やページレイアウトによって変動します — 高い正確性が求められる法務業務では、テキスト型 PDF が引き続き最も信頼できるソースです。",
frontend/src/i18n/locales/ja.json:1324:  "compareChatpdf.feature.securityP2": "DocTalk implements SSE-S3 encryption for all uploaded documents, SSRF protection for URL ingestion, magic-byte file validation to prevent malicious uploads, and structured security event logging. Documents are never used to train AI models. DocTalk also provides a GDPR data export endpoint and cookie consent management. The OAuth implementation strips tokens after linking, and the Docker deployment runs as a non-root user for defense in depth.",
frontend/src/i18n/locales/ja.json:1390:  "compareNotebooklm.table.doctalk.dataEncryption": "SSE-S3",
frontend/src/i18n/locales/ja.json:1420:  "compareNotebooklm.feature.securityP2": "DocTalk is an independent platform with SSE-S3 encryption, SSRF protection, and GDPR compliance features. Documents are never used for AI training. You can export all your data at any time, and the platform supports multiple authentication providers (Google, Microsoft, email) to avoid vendor lock-in. For organizations that need data sovereignty or want to avoid Google dependency, DocTalk is the more private choice.",
frontend/src/i18n/locales/ja.json:1449:  "compareNotebooklm.faq.a5": "DocTalk stores documents with SSE-S3 encryption, never trains AI on your data, and provides GDPR data export. NotebookLM is a Google product subject to Google privacy policies. DocTalk gives you more control and transparency over your data.",
frontend/src/i18n/locales/ja.json:1579:  "altsNotebooklm.adv5": "SSE-S3 encryption, no vendor lock-in",
frontend/src/i18n/locales/ja.json:1745:  "compareHumata.securityDocTalk": "DocTalk implements SSE-S3 encryption for all uploaded documents, SSRF protection for URL ingestion, magic-byte file validation, and GDPR compliance with data export. Documents are never used for AI training. The application runs in non-root Docker containers and uses structured security event logging for audit trails.",
frontend/src/i18n/locales/ja.json:1804:  "comparePdfai.featureDataEncryptionDocTalk": "SSE-S3",
frontend/src/i18n/locales/ja.json:1836:  "comparePdfai.securityDocTalk": "DocTalk implements comprehensive security: SSE-S3 encryption for all uploaded documents, SSRF protection for URL ingestion, magic-byte file validation, GDPR data export, cookie consent management, non-root Docker deployment, and structured security logging. Documents are never used for AI training.",
frontend/src/i18n/locales/ja.json:1922:  "compareAskyourpdf.securityDocTalk": "DocTalk implements SSE-S3 encryption, SSRF protection, magic-byte file validation, and GDPR compliance features including data export. No browser extensions are required, and documents are never used for AI training. The application runs in non-root Docker containers for additional security.",
frontend/src/i18n/locales/zh.json:198:  "profile.tabs.notifications": "通知",
frontend/src/i18n/locales/zh.json:199:  "profile.notifications.title": "通知",
frontend/src/i18n/locales/zh.json:200:  "profile.notifications.empty": "邮件通知和产品更新即将上线。",
frontend/src/i18n/locales/zh.json:886:  "useCasesLawyers.faq.q1.answer": "安全。DocTalk 对所有上传文档采用 AES-256 加密（SSE-S3）存储。您的文档绝不会用于 AI 训练，且您可以随时删除文件。",
frontend/src/i18n/locales/zh.json:892:  "useCasesLawyers.faq.q4.answer": "DocTalk 在保留文本层的文本型 PDF 上效果最佳。对于扫描件或纯图像 PDF，DocTalk 会自动使用 Tesseract（英文 + 简体中文）进行 OCR 提取。OCR 质量因扫描分辨率和版式而异 — 对高保真度要求的法律工作，文本型 PDF 仍是最可靠的输入。",
frontend/src/i18n/locales/zh.json:1327:  "compareChatpdf.feature.securityP2": "DocTalk 对所有上传文档实施 SSE-S3 加密、URL 导入的 SSRF 防护、magic-byte 文件验证以防止恶意上传，以及结构化的安全事件日志。文档绝不用于训练 AI 模型。DocTalk 还提供 GDPR 数据导出端点和 Cookie 同意管理。OAuth 实现在链接后清除令牌，Docker 部署以非 root 用户运行以实现纵深防御。",

codex
我已经拿到关键文件和行号。接下来会做三件事：1) 直接核验 `/trust` 与后端实现是否真的支撑你写的三条承诺；2) 计算暗色对比度（含你给的 `#a8b3f5`）；3) 抽查 9 个 locale 的 OCR 文案和新增 key 覆盖情况。
exec
/bin/zsh -lc "cd /Users/mayijie/Projects/Code/010_DocTalk && nl -ba frontend/src/app/trust/TrustPageClient.tsx | sed -n '1,360p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	"use client";
     2	
     3	import React from "react";
     4	import Link from "next/link";
     5	import {
     6	  Lock,
     7	  ShieldCheck,
     8	  FileWarning,
     9	  KeyRound,
    10	  UserX,
    11	  Database,
    12	  Globe2,
    13	  AlertTriangle,
    14	  Mail,
    15	  type LucideIcon,
    16	} from "lucide-react";
    17	import Header from "../../components/Header";
    18	import Footer from "../../components/Footer";
    19	import { usePageTitle } from "../../lib/usePageTitle";
    20	import { useLocale } from "../../i18n";
    21	
    22	/* Trust Center content is intentionally specific and hand-maintained here
    23	 * rather than i18n'd, because the technical claims (SSE-S3, SSRF, RFC 7748)
    24	 * need precise English terminology to be credible. Copy will translate at
    25	 * the section-heading level; the control names stay in English.
    26	 *
    27	 * Honest rule for this page: everything listed is something we actually
    28	 * implemented (see backend code + docs/ARCHITECTURE.md §10). Things we have
    29	 * NOT done (SOC2, HIPAA, SSO) are listed openly in the "What we don't have
    30	 * yet" section so the reader can judge the gap.
    31	 */
    32	
    33	interface Control {
    34	  icon: LucideIcon;
    35	  title: string;
    36	  detail: string;
    37	  evidence?: string;
    38	}
    39	
    40	const encryptionControls: Control[] = [
    41	  {
    42	    icon: Lock,
    43	    title: "AES-256 encryption at rest",
    44	    detail:
    45	      "Uploaded documents are stored with SSE-S3 server-side encryption. The MinIO bucket enforces the encryption policy at ingest; any object written without a valid encryption header is rejected.",
    46	    evidence: "backend/app/services/storage_service.py · SSE-S3 policy",
    47	  },
    48	  {
    49	    icon: KeyRound,
    50	    title: "TLS 1.2+ in transit",
    51	    detail:
    52	      "Every network hop — browser to Vercel edge, edge to Railway backend, backend to LLM providers — uses TLS. HSTS with max-age=63072000 and includeSubDomains is set on the apex domain.",
    53	  },
    54	  {
    55	    icon: UserX,
    56	    title: "No training on your data",
    57	    detail:
    58	      "DocTalk routes LLM calls through OpenRouter with zero-retention agreements. Your documents and questions are not retained by model providers after the response completes, and are never used to train models.",
    59	  },
    60	];
    61	
    62	const ingestControls: Control[] = [
    63	  {
    64	    icon: FileWarning,
    65	    title: "Magic-byte file validation",
    66	    detail:
    67	      "Uploads are validated against file signature bytes, not file extensions. A .pdf with an executable payload inside is rejected at ingest — you cannot trick the parser by renaming a file.",
    68	    evidence: "backend/app/services/upload_service.py · magic-byte check",
    69	  },
    70	  {
    71	    icon: Globe2,
    72	    title: "SSRF protection on URL ingestion",
    73	    detail:
    74	      "When you drop a URL to summarize, the backend validates the target against an allow-list of public hosts and rejects any request to private IP ranges, link-local addresses, or cloud metadata endpoints (169.254.169.254, etc).",
    75	    evidence: "backend/app/core/url_validator.py",
    76	  },
    77	  {
    78	    icon: AlertTriangle,
    79	    title: "Rate limits on anonymous endpoints",
    80	    detail:
    81	      "Public endpoints (shared views, anonymous reads) have per-IP rate limits with HMAC-signed IP trust chain via the Vercel edge — the real client IP cannot be spoofed. Authenticated users bypass.",
    82	    evidence: "backend/app/core/rate_limit.py · shared_view_limiter, anon_read_limiter",
    83	  },
    84	];
    85	
    86	const dataRightsControls: Control[] = [
    87	  {
    88	    icon: Database,
    89	    title: "Full data export",
    90	    detail:
    91	      "From your Profile → Account you can export all your documents and session data. The export includes everything DocTalk stores about you, in portable formats.",
    92	  },
    93	  {
    94	    icon: UserX,
    95	    title: "Account deletion",
    96	    detail:
    97	      "You can delete your account from Profile → Account. All documents, sessions, chat history, embeddings, and billing records are removed; the account is not recoverable after deletion.",
    98	  },
    99	  {
   100	    icon: ShieldCheck,
   101	    title: "User isolation",
   102	    detail:
   103	      "Every document and session is scoped to its owner's user_id at the database and vector-store layer. There is no shared namespace, no org-wide collection by default, and the isolation is enforced at query time — not just at render time.",
   104	  },
   105	];
   106	
   107	const gaps = [
   108	  {
   109	    name: "SOC 2 Type II",
   110	    status: "Not audited",
   111	    note: "We are a small team without the engineering spend for a full SOC 2 audit yet. The underlying controls are in place; the certification is not.",
   112	  },
   113	  {
   114	    name: "HIPAA",
   115	    status: "Not compliant",
   116	    note: "DocTalk is not a HIPAA-covered business associate. If you handle Protected Health Information, do not upload PHI until we announce BAA support.",
   117	  },
   118	  {
   119	    name: "Enterprise SSO / SAML",
   120	    status: "Not available",
   121	    note: "Individual OAuth (Google, Microsoft) and magic-link email sign-in only. Enterprise SSO is on the roadmap but not shipped.",
   122	  },
   123	  {
   124	    name: "On-premise / air-gapped deployment",
   125	    status: "Not offered",
   126	    note: "DocTalk is SaaS only. Self-hosted is not currently supported.",
   127	  },
   128	];
   129	
   130	function ControlCard({ icon: Icon, title, detail, evidence }: Control) {
   131	  return (
   132	    <div className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
   133	      <div className="flex items-center gap-3 mb-2">
   134	        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
   135	          <Icon aria-hidden size={18} />
   136	        </span>
   137	        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
   138	          {title}
   139	        </h3>
   140	      </div>
   141	      <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
   142	        {detail}
   143	      </p>
   144	      {evidence && (
   145	        <p className="mt-3 font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
   146	          {evidence}
   147	        </p>
   148	      )}
   149	    </div>
   150	  );
   151	}
   152	
   153	export default function TrustPageClient() {
   154	  const { t } = useLocale();
   155	  usePageTitle(t("trust.title", {}) || "Trust & Security");
   156	
   157	  return (
   158	    <div className="flex flex-col min-h-screen bg-[var(--page-background)]">
   159	      <Header variant="minimal" />
   160	      <main id="main-content" className="flex-1">
   161	        {/* Hero */}
   162	        <section className="max-w-4xl mx-auto px-6 pt-16 pb-10">
   163	          <p className="text-[11px] font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-3">
   164	            Trust Center
   165	          </p>
   166	          <h1 className="text-3xl md:text-5xl font-medium tracking-[-0.03em] text-zinc-900 dark:text-zinc-50 text-balance mb-5">
   167	            The real controls protecting your documents.
   168	          </h1>
   169	          <p className="text-lg text-zinc-600 dark:text-zinc-300 leading-relaxed max-w-2xl">
   170	            What DocTalk actually does to keep your uploads private, isolated,
   171	            and unused for model training. And — openly — what we haven&apos;t
   172	            certified yet.
   173	          </p>
   174	        </section>
   175	
   176	        {/* Encryption & transit */}
   177	        <section className="max-w-5xl mx-auto px-6 py-8">
   178	          <h2 className="text-[11px] font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-4">
   179	            01 — Encryption & transit
   180	          </h2>
   181	          <div className="grid md:grid-cols-3 gap-4">
   182	            {encryptionControls.map((c) => (
   183	              <ControlCard key={c.title} {...c} />
   184	            ))}
   185	          </div>
   186	        </section>
   187	
   188	        {/* Ingest safety */}
   189	        <section className="max-w-5xl mx-auto px-6 py-8">
   190	          <h2 className="text-[11px] font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-4">
   191	            02 — Ingest safety
   192	          </h2>
   193	          <div className="grid md:grid-cols-3 gap-4">
   194	            {ingestControls.map((c) => (
   195	              <ControlCard key={c.title} {...c} />
   196	            ))}
   197	          </div>
   198	        </section>
   199	
   200	        {/* Data rights */}
   201	        <section className="max-w-5xl mx-auto px-6 py-8">
   202	          <h2 className="text-[11px] font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-4">
   203	            03 — Your data, your control
   204	          </h2>
   205	          <div className="grid md:grid-cols-3 gap-4">
   206	            {dataRightsControls.map((c) => (
   207	              <ControlCard key={c.title} {...c} />
   208	            ))}
   209	          </div>
   210	        </section>
   211	
   212	        {/* Honest gaps */}
   213	        <section className="max-w-5xl mx-auto px-6 py-8">
   214	          <h2 className="text-[11px] font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-4">
   215	            04 — What we don&apos;t have yet
   216	          </h2>
   217	          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-200 dark:divide-zinc-800">
   218	            {gaps.map((g) => (
   219	              <div key={g.name} className="flex flex-col md:flex-row md:items-start gap-2 md:gap-6 p-5">
   220	                <div className="md:w-64 shrink-0">
   221	                  <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
   222	                    {g.name}
   223	                  </div>
   224	                  <div className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wide text-amber-700 dark:text-amber-400">
   225	                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
   226	                    {g.status}
   227	                  </div>
   228	                </div>
   229	                <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
   230	                  {g.note}
   231	                </p>
   232	              </div>
   233	            ))}
   234	          </div>
   235	        </section>
   236	
   237	        {/* Contact */}
   238	        <section className="max-w-5xl mx-auto px-6 py-12">
   239	          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
   240	            <div>
   241	              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
   242	                Report a security issue
   243	              </h2>
   244	              <p className="text-sm text-zinc-600 dark:text-zinc-300">
   245	                Responsible disclosure welcomed. We reply to every vulnerability
   246	                report within 72 hours.
   247	              </p>
   248	            </div>
   249	            <div className="flex flex-wrap gap-3">
   250	              <Link
   251	                href="/contact"
   252	                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-semibold shadow-sm hover:shadow-md hover:bg-accent-hover transition-[box-shadow,background-color] motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950"
   253	              >
   254	                <Mail aria-hidden size={14} />
   255	                Contact security
   256	              </Link>
   257	              <Link
   258	                href="/privacy"
   259	                className="inline-flex items-center px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm font-semibold text-zinc-700 dark:text-zinc-200 hover:border-accent hover:text-accent transition-colors motion-reduce:transition-none"
   260	              >
   261	                Privacy Policy
   262	              </Link>
   263	            </div>
   264	          </div>
   265	        </section>
   266	      </main>
   267	      <Footer />
   268	    </div>
   269	  );
   270	}

exec
/bin/zsh -lc "cd /Users/mayijie/Projects/Code/010_DocTalk && nl -ba backend/app/services/storage_service.py | sed -n '1,280p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	from __future__ import annotations
     2	
     3	import datetime
     4	import logging
     5	from io import BytesIO
     6	from typing import Optional
     7	from urllib.parse import urlparse
     8	
     9	from minio import Minio
    10	from minio.error import S3Error
    11	from minio.sse import SseS3
    12	from minio.sseconfig import Rule, SSEConfig
    13	
    14	from app.core.config import settings
    15	
    16	
    17	def _parse_minio_endpoint(endpoint: str) -> tuple[str, bool]:
    18	    """Return (host:port, secure) from endpoint which may include scheme."""
    19	    if endpoint.startswith("http://") or endpoint.startswith("https://"):
    20	        parsed = urlparse(endpoint)
    21	        secure = parsed.scheme == "https"
    22	        host = parsed.netloc
    23	        return host, secure
    24	    # default: no scheme → assume insecure (dev MinIO)
    25	    return endpoint, False
    26	
    27	
    28	class StorageService:
    29	    def __init__(self,
    30	                 endpoint: Optional[str] = None,
    31	                 access_key: Optional[str] = None,
    32	                 secret_key: Optional[str] = None,
    33	                 bucket: Optional[str] = None,
    34	                 default_ttl: Optional[int] = None) -> None:
    35	        endpoint = endpoint or settings.MINIO_ENDPOINT
    36	        access_key = access_key or settings.MINIO_ACCESS_KEY
    37	        secret_key = secret_key or settings.MINIO_SECRET_KEY
    38	        bucket = bucket or settings.MINIO_BUCKET
    39	        default_ttl = default_ttl or settings.MINIO_PRESIGN_TTL
    40	
    41	        host, secure = _parse_minio_endpoint(endpoint)
    42	        # Configure MinIO client with short timeouts to avoid blocking the
    43	        # asyncio event loop when MinIO is unreachable.  The default urllib3
    44	        # retry policy retries 502/503/504 responses multiple times with
    45	        # exponential backoff, which can block for 30+ seconds.
    46	        import urllib3
    47	        http_client = urllib3.PoolManager(
    48	            timeout=urllib3.Timeout(connect=5, read=10),
    49	            retries=urllib3.Retry(total=2, backoff_factor=0.5,
    50	                                  status_forcelist=[500, 502, 503, 504]),
    51	            cert_reqs="CERT_REQUIRED" if secure else "CERT_NONE",
    52	        )
    53	        self._client = Minio(host, access_key=access_key, secret_key=secret_key,
    54	                             secure=secure, http_client=http_client)
    55	        self._bucket = bucket
    56	        self._default_ttl = int(default_ttl)
    57	
    58	    @property
    59	    def bucket(self) -> str:
    60	        return self._bucket
    61	
    62	    def health_check(self) -> bool:
    63	        """Probe MinIO liveness. Returns True if reachable; raises on error.
    64	
    65	        Used by the /health?deep=true endpoint. bucket_exists is the lightest
    66	        authenticated call and validates both connectivity and credentials.
    67	        """
    68	        return bool(self._client.bucket_exists(self._bucket))
    69	
    70	    def ensure_bucket(self) -> None:
    71	        """Create bucket if it does not exist. Sets default SSE-S3 encryption."""
    72	        found = self._client.bucket_exists(self._bucket)
    73	        if not found:
    74	            self._client.make_bucket(self._bucket)
    75	        # Enable default server-side encryption (AES-256)
    76	        try:
    77	            self._client.set_bucket_encryption(
    78	                self._bucket, SSEConfig(Rule.new_sse_s3_rule())
    79	            )
    80	        except Exception:
    81	            logging.getLogger(__name__).warning(
    82	                "Could not set bucket encryption policy — MinIO version may not support it"
    83	            )
    84	
    85	    def upload_file(self, file_bytes: bytes, storage_key: str, content_type: str = "application/pdf") -> None:
    86	        """Upload bytes to MinIO under the given storage_key.
    87	
    88	        Attempts SSE-S3 encryption first; falls back to unencrypted upload
    89	        if KMS is not configured on the MinIO instance.
    90	        """
    91	        data = BytesIO(file_bytes)
    92	        size = len(file_bytes)
    93	        try:
    94	            self._client.put_object(
    95	                self._bucket,
    96	                storage_key,
    97	                data,
    98	                length=size,
    99	                content_type=content_type,
   100	                sse=SseS3(),
   101	            )
   102	        except S3Error as exc:
   103	            if "KMS" in str(exc) or exc.code == "NotImplemented":
   104	                # KMS not configured — upload without encryption
   105	                data.seek(0)
   106	                self._client.put_object(
   107	                    self._bucket,
   108	                    storage_key,
   109	                    data,
   110	                    length=size,
   111	                    content_type=content_type,
   112	                )
   113	            else:
   114	                raise
   115	
   116	    def get_presigned_url(self, storage_key: str, ttl: Optional[int] = None) -> str:
   117	        """Generate a presigned GET URL for the object."""
   118	        expires = datetime.timedelta(seconds=int(ttl or self._default_ttl))
   119	        url = self._client.presigned_get_object(self._bucket, storage_key, expires=expires)
   120	        return url
   121	
   122	    def delete_file(self, storage_key: str) -> None:
   123	        """Delete an object. No-op if not found."""
   124	        try:
   125	            self._client.remove_object(self._bucket, storage_key)
   126	        except S3Error as exc:
   127	            # If the object does not exist, ignore
   128	            if getattr(exc, "code", None) != "NoSuchKey":
   129	                raise
   130	
   131	
   132	# Singleton instance for app-wide use
   133	storage_service = StorageService()
   134	

exec
/bin/zsh -lc "cd /Users/mayijie/Projects/Code/010_DocTalk && rg -n \"zero-retention|retention|OpenRouter|delete|<60|60s|SSE-S3|x-amz-server-side-encryption\" backend frontend/src/app/trust frontend/src/components -g '*.py' -g '*.tsx' | sed -n '1,320p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
frontend/src/app/trust/page.tsx:8:    'How DocTalk secures your documents: AES-256 encryption at rest, SSRF protection, magic-byte validation, zero-retention LLM calls, GDPR data rights, and what we have not yet certified.',
frontend/src/app/trust/TrustPageClient.tsx:23: * rather than i18n'd, because the technical claims (SSE-S3, SSRF, RFC 7748)
frontend/src/app/trust/TrustPageClient.tsx:45:      "Uploaded documents are stored with SSE-S3 server-side encryption. The MinIO bucket enforces the encryption policy at ingest; any object written without a valid encryption header is rejected.",
frontend/src/app/trust/TrustPageClient.tsx:46:    evidence: "backend/app/services/storage_service.py · SSE-S3 policy",
frontend/src/app/trust/TrustPageClient.tsx:58:      "DocTalk routes LLM calls through OpenRouter with zero-retention agreements. Your documents and questions are not retained by model providers after the response completes, and are never used to train models.",
frontend/src/app/trust/TrustPageClient.tsx:97:      "You can delete your account from Profile → Account. All documents, sessions, chat history, embeddings, and billing records are removed; the account is not recoverable after deletion.",
backend/tests/test_deletion_retry.py:14:async def test_delete_document_queues_retry_for_converted_pdf_cleanup(monkeypatch) -> None:
backend/tests/test_deletion_retry.py:25:        delete=lambda _doc: None,
backend/tests/test_deletion_retry.py:32:    async def fake_delete(_doc):
backend/tests/test_deletion_retry.py:38:    def fake_delete_file(storage_key: str) -> None:
backend/tests/test_deletion_retry.py:46:    monkeypatch.setattr(doc_service_module.storage_service, "delete_file", fake_delete_file)
backend/tests/test_deletion_retry.py:50:        lambda: SimpleNamespace(delete=lambda **_kwargs: None),
backend/tests/test_deletion_retry.py:55:    db.delete = fake_delete
backend/tests/test_deletion_retry.py:58:    deleted = await doc_service_module.doc_service.delete_document(document_id, db)
backend/tests/test_deletion_retry.py:60:    assert deleted is True
backend/tests/test_deletion_retry.py:70:    deleted_keys: list[str] = []
backend/tests/test_deletion_retry.py:73:        "app.services.storage_service.storage_service.delete_file",
backend/tests/test_deletion_retry.py:74:        lambda storage_key: deleted_keys.append(storage_key),
backend/tests/test_deletion_retry.py:84:    assert deleted_keys == [
frontend/src/components/Collections/CreateCollectionModal.tsx:39:      if (next.has(id)) next.delete(id);
backend/alembic/versions/20260317_0019_add_shared_sessions.py:23:        sa.Column("session_id", UUID(as_uuid=True), sa.ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False),
backend/alembic/versions/20260317_0019_add_shared_sessions.py:25:        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
frontend/src/components/Collections/CollectionList.tsx:58:                if (window.confirm(t('collections.deleteConfirm'))) {
frontend/src/components/Collections/CollectionList.tsx:62:              title={t('collections.delete')}
frontend/src/components/Collections/CollectionList.tsx:63:              aria-label={t('collections.delete')}
backend/tests/test_document_access.py:36:async def test_delete_me_aborts_when_any_document_delete_fails(monkeypatch: pytest.MonkeyPatch) -> None:
backend/tests/test_document_access.py:52:        delete=AsyncMock(),
backend/tests/test_document_access.py:58:    async def fake_delete_document(document_id: uuid.UUID, _db) -> bool:
backend/tests/test_document_access.py:64:    monkeypatch.setattr(users_api.doc_service, "delete_document", fake_delete_document)
backend/tests/test_document_access.py:67:        await users_api.delete_me(user=user, db=db)
backend/tests/test_document_access.py:72:    db.delete.assert_not_awaited()
backend/tests/test_document_access.py:77:async def test_delete_me_aborts_when_subscription_cancel_fails(
backend/tests/test_document_access.py:89:        delete=AsyncMock(),
backend/tests/test_document_access.py:93:    async def fake_delete_document(_document_id: uuid.UUID, _db) -> bool:
backend/tests/test_document_access.py:96:    monkeypatch.setattr(users_api.doc_service, "delete_document", fake_delete_document)
backend/tests/test_document_access.py:105:        await users_api.delete_me(user=user, db=db)
backend/tests/test_document_access.py:108:    db.delete.assert_not_awaited()
backend/alembic/versions/20260316_0018_add_session_user_id.py:29:        ondelete="SET NULL",
backend/alembic/versions/20260204_0001_initial_tables.py:47:        sa.Column("document_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
backend/alembic/versions/20260204_0001_initial_tables.py:60:        sa.Column("document_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
backend/alembic/versions/20260204_0001_initial_tables.py:78:        sa.Column("document_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
backend/alembic/versions/20260204_0001_initial_tables.py:87:        sa.Column("session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False),
backend/tests/test_auth_adapter.py:116:    resp = await client.delete(
backend/tests/test_auth_adapter.py:128:    resp = await client.delete(f"/api/internal/auth/users/{user_id}", headers=_headers())
backend/tests/test_sharing_api.py:28:        resp = await client.delete(
backend/alembic/versions/20260208_0009_add_collections.py:24:        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
backend/alembic/versions/20260208_0009_add_collections.py:33:        sa.Column('collection_id', UUID(as_uuid=True), sa.ForeignKey('collections.id', ondelete='CASCADE'), primary_key=True),
backend/alembic/versions/20260208_0009_add_collections.py:34:        sa.Column('document_id', UUID(as_uuid=True), sa.ForeignKey('documents.id', ondelete='CASCADE'), primary_key=True),
backend/alembic/versions/20260208_0009_add_collections.py:44:        ondelete='CASCADE',
frontend/src/components/PrivacyBadge.tsx:20:          <span>AES-256 (SSE-S3)</span>
frontend/src/components/PrivacyBadge.tsx:24:          <span>OpenRouter zero-retention</span>
frontend/src/components/PrivacyBadge.tsx:28:          <span>{tOr('privacy.deleteFast', 'Delete in <60s')}</span>
frontend/src/components/CreditsDisplay.tsx:58:    // Periodic refresh every 60s
frontend/src/components/PdfViewer/PdfViewer.tsx:218:            nearbyPages.delete(pageNum);
backend/alembic/versions/20260205_0003_add_auth_credits_tables.py:45:        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
backend/alembic/versions/20260205_0003_add_auth_credits_tables.py:71:        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
backend/alembic/versions/20260205_0003_add_auth_credits_tables.py:86:        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
backend/alembic/versions/20260205_0003_add_auth_credits_tables.py:87:        sa.Column("message_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("messages.id", ondelete="SET NULL"), nullable=True),
backend/alembic/versions/20260205_0003_add_auth_credits_tables.py:97:    # Alter documents: add user_id (nullable, set null on user delete)
backend/alembic/versions/20260205_0003_add_auth_credits_tables.py:103:            sa.ForeignKey("users.id", ondelete="SET NULL"),
frontend/src/components/AuthModal.tsx:28:    currentSearch.delete('auth');
backend/tests/test_billing_logic.py:25:    cache_delete = AsyncMock()
backend/tests/test_billing_logic.py:38:    monkeypatch.setattr(billing_api, "cache_delete", cache_delete)
backend/tests/test_billing_logic.py:46:    cache_delete.assert_awaited_once_with(f"user:profile:{user.id}")
backend/tests/test_billing_logic.py:107:async def test_subscription_deleted_ignores_stale_deleted_subscription() -> None:
backend/tests/test_billing_logic.py:120:    response = await billing_api._handle_subscription_deleted(
frontend/src/components/Profile/AccountActionsSection.tsx:6:import { deleteUserAccount, exportUserData } from "../../lib/api";
frontend/src/components/Profile/AccountActionsSection.tsx:47:      await deleteUserAccount();
frontend/src/components/Profile/AccountActionsSection.tsx:83:          {t("profile.account.deleteWarning")}
frontend/src/components/Profile/AccountActionsSection.tsx:90:          {t("profile.account.deleteAccount")}
frontend/src/components/Profile/AccountActionsSection.tsx:104:            aria-labelledby="delete-account-title"
frontend/src/components/Profile/AccountActionsSection.tsx:106:            <h4 id="delete-account-title" className="text-lg font-semibold mb-2 dark:text-zinc-100">
frontend/src/components/Profile/AccountActionsSection.tsx:107:              {t("profile.account.deleteAccount")}
frontend/src/components/Profile/AccountActionsSection.tsx:110:              {t("profile.account.deleteConfirm")}
frontend/src/components/Profile/AccountActionsSection.tsx:140:                {deleting ? t("profile.account.deleting") : t("profile.account.deleteAccount")}
backend/scripts/run_benchmark.py:2:"""DocTalk RAG Benchmark Runner — Direct OpenRouter.
backend/scripts/run_benchmark.py:7:  - OpenRouter   (embeddings + LLM streaming)
backend/scripts/run_benchmark.py:11:  Phase 2 — Stream each model via OpenRouter, collect TTFT / latency / text / citations
backend/scripts/run_benchmark.py:194:    """Embed a single query via OpenRouter."""
backend/scripts/run_benchmark.py:305:# Phase 2: Direct OpenRouter LLM calls
backend/scripts/run_benchmark.py:334:    """Stream a single LLM call via OpenRouter. Returns metrics dict."""
backend/scripts/run_benchmark.py:519:        description="DocTalk RAG Benchmark — Direct OpenRouter",
backend/scripts/evaluate_benchmark.py:290:    """Use Claude via OpenRouter to evaluate a single response.
backend/tests/conftest.py:80:                await doc_service.delete_document(document_id, db)
backend/tests/conftest.py:84:                await db.delete(persisted_user)
frontend/src/components/landing/HeroArtifact.tsx:13: * the video should be demoted, not deleted — kept as a section below.
frontend/src/components/SessionDropdown.tsx:8:import { createSession, getMessages, deleteSession } from '../lib/api';
frontend/src/components/SessionDropdown.tsx:84:    await deleteSession(targetId);
frontend/src/components/SessionDropdown.tsx:217:                        <span>{t('dashboard.deletePrompt')}</span>
frontend/src/components/SessionDropdown.tsx:240:                        title={t('session.deleteChat')}
frontend/src/components/SessionDropdown.tsx:241:                        aria-label={t('session.deleteChat')}
frontend/src/components/SessionDropdown.tsx:263:              <span>{t('session.deleteChat')}</span>
frontend/src/components/SessionDropdown.tsx:267:                <span>{t('dashboard.deletePrompt')}</span>
backend/app/services/storage_service.py:71:        """Create bucket if it does not exist. Sets default SSE-S3 encryption."""
backend/app/services/storage_service.py:88:        Attempts SSE-S3 encryption first; falls back to unencrypted upload
backend/app/services/storage_service.py:122:    def delete_file(self, storage_key: str) -> None:
backend/app/workers/deletion_worker.py:22:    Uses exponential backoff: 30s, 60s, 120s.
backend/app/workers/deletion_worker.py:35:            storage_service.delete_file(original_storage_key)
backend/app/workers/deletion_worker.py:44:            storage_service.delete_file(converted_storage_key)
backend/app/workers/deletion_worker.py:62:            qclient.delete(
backend/app/workers/cleanup_tasks.py:37:            deleted = result.rowcount
backend/app/workers/cleanup_tasks.py:38:        if deleted:
backend/app/workers/cleanup_tasks.py:39:            logger.info("Cleaned up %d expired verification tokens", deleted)
backend/app/services/demo_seed.py:106:                            db.delete(existing)
backend/app/services/demo_seed.py:120:                        db.delete(existing)
backend/app/services/auth_service.py:105:async def delete_user(db: AsyncSession, user: User) -> None:
backend/app/services/auth_service.py:106:    await db.delete(user)
backend/app/services/auth_service.py:139:        await db.delete(account)
backend/app/services/auth_service.py:156:    """Use and delete a verification token atomically.
backend/app/services/auth_service.py:175:    # Check expiration and delete in single transaction
backend/app/services/auth_service.py:177:        await db.delete(vt)
backend/app/services/auth_service.py:182:    await db.delete(vt)
backend/app/workers/parse_worker.py:98:            from sqlalchemy import delete as sa_delete
backend/app/workers/parse_worker.py:100:            db.execute(sa_delete(Chunk).where(Chunk.document_id == doc.id))
backend/app/workers/parse_worker.py:101:            db.execute(sa_delete(Page).where(Page.document_id == doc.id))
backend/app/models/tables.py:37:    # Optional owner user (nullable; set null on user delete)
backend/app/models/tables.py:40:        sa.ForeignKey("users.id", ondelete="SET NULL"),
backend/app/models/tables.py:70:    pages: Mapped[List[Page]] = relationship("Page", back_populates="document", cascade="all, delete-orphan")
backend/app/models/tables.py:71:    chunks: Mapped[List[Chunk]] = relationship("Chunk", back_populates="document", cascade="all, delete-orphan")
backend/app/models/tables.py:73:        "ChatSession", back_populates="document", cascade="all, delete-orphan",
backend/app/models/tables.py:93:        UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
backend/app/models/tables.py:119:        UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
backend/app/models/tables.py:149:        UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=True
backend/app/models/tables.py:152:        UUID(as_uuid=True), sa.ForeignKey("collections.id", ondelete="CASCADE"), nullable=True
backend/app/models/tables.py:156:        sa.ForeignKey("users.id", ondelete="SET NULL"),
backend/app/models/tables.py:168:    messages: Mapped[List[Message]] = relationship("Message", back_populates="session", cascade="all, delete-orphan")
backend/app/models/tables.py:181:        UUID(as_uuid=True), sa.ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False
backend/app/models/tables.py:221:    accounts: Mapped[List["Account"]] = relationship("Account", back_populates="user", cascade="all, delete-orphan")
backend/app/models/tables.py:231:        UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
backend/app/models/tables.py:266:        UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
backend/app/models/tables.py:299:        UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
backend/app/models/tables.py:302:        UUID(as_uuid=True), sa.ForeignKey("messages.id", ondelete="SET NULL"), nullable=True
backend/app/models/tables.py:320:    sa.Column("collection_id", UUID(as_uuid=True), sa.ForeignKey("collections.id", ondelete="CASCADE"), primary_key=True),
backend/app/models/tables.py:321:    sa.Column("document_id", UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), primary_key=True),
backend/app/models/tables.py:335:        UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
backend/app/models/tables.py:348:        "ChatSession", back_populates="collection", cascade="all, delete-orphan"
backend/app/models/tables.py:359:        UUID(as_uuid=True), sa.ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False
backend/app/models/tables.py:365:        UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
backend/app/services/chat_service.py:82:    Uses ledger delete as the single source of truth: only restore balance
backend/app/services/chat_service.py:92:        sa.delete(CreditLedger).where(CreditLedger.id == predebit_ledger_id)
backend/app/services/chat_service.py:451:        # 6) Stream from OpenRouter (OpenAI-compatible)
backend/app/core/cache.py:91:async def cache_delete(key: str) -> None:
backend/app/core/cache.py:97:        await client.delete(f"{_CACHE_PREFIX}{key}")
backend/app/core/cache.py:102:async def cache_delete_pattern(pattern: str) -> int:
backend/app/core/cache.py:108:        deleted = 0
backend/app/core/cache.py:110:            deleted += await client.delete(redis_key)
backend/app/core/cache.py:111:        return deleted
backend/app/services/embedding_service.py:22:    - Provides batch embedding via OpenRouter (OpenAI-compatible)
backend/app/services/embedding_service.py:48:        Retries with exponential backoff on transient failures (e.g. OpenRouter
backend/app/schemas/common.py:39:    deleted: bool
backend/app/services/doc_service.py:114:    async def delete_document(self, document_id: uuid.UUID, db: AsyncSession) -> bool:
backend/app/services/doc_service.py:117:        Pages, chunks, sessions, and messages are cascade-deleted by SQLAlchemy.
backend/app/services/doc_service.py:139:            await asyncio.to_thread(storage_service.delete_file, storage_key)
backend/app/services/doc_service.py:147:                await asyncio.to_thread(storage_service.delete_file, converted_key)
backend/app/services/doc_service.py:161:                qclient.delete,
backend/app/services/doc_service.py:171:        # ORM cascade deletes pages, chunks, sessions, messages
backend/app/services/doc_service.py:172:        await db.delete(doc)
backend/app/services/doc_service.py:176:            "document_deleted", document_id=document_id, user_id=doc.user_id,
backend/app/core/config.py:11:    # OpenRouter — 统一 API 网关
backend/app/core/config.py:15:    # Embedding — 模型与维度强绑定 (通过 OpenRouter 调用)
backend/app/core/config.py:24:    # LLM (通过 OpenRouter 调用)
backend/app/api/sharing.py:91:@router.delete("/api/sessions/{session_id}/share", status_code=204)
backend/app/api/sharing.py:107:    await db.delete(share)
backend/app/api/documents.py:503:@documents_router.delete(
backend/app/api/documents.py:508:async def delete_document(
backend/app/api/documents.py:516:    # Only the document owner can delete; demo docs (user_id=None) are not deletable via API
backend/app/api/documents.py:519:    await doc_service.delete_document(document_id, db)
backend/app/api/documents.py:520:    return JSONResponse(status_code=202, content={"status": "deleted"})
backend/app/api/billing.py:15:from app.core.cache import cache_delete
backend/app/api/billing.py:142:        await cache_delete(f"user:profile:{user.id}")
backend/app/api/billing.py:393:    await cache_delete(f"user:profile:{user.id}")
backend/app/api/billing.py:474:    await cache_delete(f"user:profile:{user.id}")
backend/app/api/billing.py:642:        await cache_delete(f"user:profile:{user.id}")
backend/app/api/billing.py:646:async def _handle_subscription_deleted(
backend/app/api/billing.py:658:    deleted_subscription_id = subscription.get("id")
backend/app/api/billing.py:660:        deleted_subscription_id
backend/app/api/billing.py:662:        and deleted_subscription_id != user.stripe_subscription_id
backend/app/api/billing.py:665:            "Ignoring stale subscription.deleted webhook for user %s: deleted=%s current=%s",
backend/app/api/billing.py:667:            deleted_subscription_id,
backend/app/api/billing.py:673:    if active_sub and active_sub.get("id") != deleted_subscription_id:
backend/app/api/billing.py:683:        await cache_delete(f"user:profile:{user.id}")
backend/app/api/billing.py:685:            "Ignored subscription.deleted for user %s because active subscription %s still exists",
backend/app/api/billing.py:700:    await cache_delete(f"user:profile:{user.id}")
backend/app/api/billing.py:724:        await cache_delete(f"user:profile:{user.id}")
backend/app/api/billing.py:729:    await cache_delete(f"user:profile:{user.id}")
backend/app/api/billing.py:797:        await cache_delete(f"user:profile:{user.id}")
backend/app/api/billing.py:846:        "customer.subscription.deleted": _handle_subscription_deleted,
backend/app/api/collections.py:196:@collections_router.delete("/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
backend/app/api/collections.py:197:async def delete_collection(
backend/app/api/collections.py:206:    await db.delete(coll)
backend/app/api/collections.py:282:@collections_router.delete("/{collection_id}/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
backend/app/api/collections.py:295:        collection_documents.delete().where(
backend/app/api/users.py:348:@router.delete("/me", response_model=DeletedResponse)
backend/app/api/users.py:349:async def delete_me(
backend/app/api/users.py:361:            await doc_service.delete_document(doc_id, db)
backend/app/api/users.py:366:                "account_delete_document_failed",
backend/app/api/users.py:373:        raise HTTPException(status_code=500, detail="Failed to delete all user documents")
backend/app/api/users.py:401:        await db.delete(user)
backend/app/api/users.py:405:        raise HTTPException(status_code=500, detail="Failed to delete user")
backend/app/api/users.py:408:    log_security_event("account_deleted", user_id=user.id, email=user.email)
backend/app/api/users.py:409:    return {"deleted": True}
backend/app/api/chat.py:455:@chat_router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
backend/app/api/chat.py:456:async def delete_session(
backend/app/api/chat.py:466:    await db.delete(session)
backend/app/api/auth.py:92:@router.delete("/users/{user_id}", status_code=204)
backend/app/api/auth.py:93:async def delete_user(
backend/app/api/auth.py:101:    await auth_service.delete_user(db, user)
backend/app/api/auth.py:124:@router.delete("/accounts/{provider}/{provider_account_id}", status_code=204)

exec
/bin/zsh -lc "cd /Users/mayijie/Projects/Code/010_DocTalk && nl -ba backend/app/core/config.py | sed -n '1,220p'" in /Users/mayijie/Projects/Code/010_DocTalk
exec
/bin/zsh -lc "cd /Users/mayijie/Projects/Code/010_DocTalk && nl -ba backend/app/services/chat_service.py | sed -n '1,260p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	from __future__ import annotations
     2	
     3	from pathlib import Path
     4	from typing import Optional
     5	
     6	from pydantic import Field
     7	from pydantic_settings import BaseSettings, SettingsConfigDict
     8	
     9	
    10	class Settings(BaseSettings):
    11	    # OpenRouter — 统一 API 网关
    12	    OPENROUTER_API_KEY: Optional[str] = None
    13	    OPENROUTER_BASE_URL: str = Field(default="https://openrouter.ai/api/v1")
    14	
    15	    # Embedding — 模型与维度强绑定 (通过 OpenRouter 调用)
    16	    EMBEDDING_MODEL: str = Field(default="openai/text-embedding-3-small")
    17	    EMBEDDING_DIM: int = Field(default=1536)
    18	
    19	    # Qdrant
    20	    QDRANT_URL: str = Field(default="http://localhost:6333")
    21	    QDRANT_API_KEY: Optional[str] = None
    22	    QDRANT_COLLECTION: str = Field(default="doc_chunks")
    23	
    24	    # LLM (通过 OpenRouter 调用)
    25	    LLM_MODEL: str = Field(default="mistralai/mistral-medium-3.1")
    26	    ALLOWED_MODELS: list[str] = Field(default=[
    27	        "deepseek/deepseek-v3.2",
    28	        "mistralai/mistral-medium-3.1",
    29	        "mistralai/mistral-large-2512",
    30	        # Fallbacks
    31	        "qwen/qwen3-30b-a3b",
    32	        "mistralai/mistral-medium-3",
    33	        "openai/gpt-5.2",
    34	    ])
    35	
    36	    # Object Storage (MinIO local / S3-compatible in production)
    37	    MINIO_ENDPOINT: str = Field(default="localhost:9000")
    38	    MINIO_ACCESS_KEY: str = Field(default="minioadmin")
    39	    MINIO_SECRET_KEY: str = Field(default="minioadmin")
    40	    MINIO_BUCKET: str = Field(default="doctalk-pdfs")
    41	    MINIO_PRESIGN_TTL: int = Field(default=300)
    42	    MINIO_SECURE: bool = Field(default=False)
    43	
    44	    # Celery
    45	    CELERY_BROKER_URL: str = Field(default="redis://localhost:6379/0")
    46	    EMBED_BATCH_SIZE: int = Field(default=64)
    47	    EMBED_MAX_CONCURRENCY: int = Field(default=4)
    48	
    49	    # Limits
    50	    MAX_PDF_SIZE_MB: int = Field(default=50)
    51	    MAX_PDF_PAGES: int = Field(default=500)
    52	    MAX_CHAT_HISTORY_TURNS: int = Field(default=6)
    53	    MAX_RETRIEVAL_TOKENS: int = Field(default=1750)
    54	    LLM_MAX_CONTEXT_TOKENS: int = Field(default=180000)
    55	    MAX_CONTINUATIONS_PER_MESSAGE: int = 3
    56	
    57	    # OCR
    58	    OCR_ENABLED: bool = Field(default=True)
    59	    OCR_LANGUAGES: str = Field(default="eng+chi_sim")
    60	    OCR_DPI: int = Field(default=300)
    61	
    62	    # Multi-format support
    63	    ALLOWED_FILE_TYPES: list[str] = Field(default=[
    64	        'pdf', 'docx', 'pptx', 'xlsx', 'txt', 'md',
    65	    ])
    66	
    67	    # CORS
    68	    FRONTEND_URL: str = Field(default="http://localhost:3000")
    69	
    70	    # Optional DB URL placeholder for future use
    71	    DATABASE_URL: Optional[str] = None
    72	
    73	    # Auth
    74	    AUTH_SECRET: Optional[str] = None  # Shared with Next.js Auth.js
    75	    ADAPTER_SECRET: Optional[str] = None  # For internal adapter API calls
    76	
    77	    # Demo LLM — cheaper model for anonymous demo conversations
    78	    DEMO_LLM_MODEL: str = "deepseek/deepseek-v3.2"
    79	
    80	    # Mode-based model selection (Quick/Balanced/Thorough)
    81	    MODE_MODELS: dict[str, str] = {
    82	        "quick": "deepseek/deepseek-v3.2",
    83	        "balanced": "mistralai/mistral-medium-3.1",
    84	        "thorough": "mistralai/mistral-large-2512",
    85	    }
    86	    MODE_CREDIT_MULTIPLIER: dict[str, float] = {
    87	        "quick": 0.5,
    88	        "balanced": 1.0,
    89	        "thorough": 3.0,
    90	    }
    91	    PREMIUM_MODES: list[str] = Field(default=["thorough"])
    92	
    93	    # Sentry
    94	    SENTRY_DSN: Optional[str] = None
    95	    SENTRY_ENVIRONMENT: str = Field(default="production")
    96	    SENTRY_TRACES_SAMPLE_RATE: float = Field(default=0.1)
    97	
    98	    # Stripe
    99	    STRIPE_SECRET_KEY: Optional[str] = None
   100	    STRIPE_WEBHOOK_SECRET: Optional[str] = None
   101	    STRIPE_PRICE_BOOST: str = "price_boost"
   102	    STRIPE_PRICE_POWER: str = "price_power"
   103	    STRIPE_PRICE_ULTRA: str = "price_ultra"
   104	
   105	    # Credit amounts
   106	    CREDITS_BOOST: int = 500
   107	    CREDITS_POWER: int = 2000
   108	    CREDITS_ULTRA: int = 5000
   109	    SIGNUP_BONUS_CREDITS: int = 1000
   110	    # Subscription tiers
   111	    PLAN_FREE_MONTHLY_CREDITS: int = 500
   112	    PLAN_PLUS_MONTHLY_CREDITS: int = 3000
   113	    PLAN_PRO_MONTHLY_CREDITS: int = 9000
   114	    STRIPE_PRICE_PLUS_MONTHLY: str = ''
   115	    STRIPE_PRICE_PLUS_ANNUAL: str = ''
   116	    STRIPE_PRICE_PRO_MONTHLY: str = ''
   117	    STRIPE_PRICE_PRO_ANNUAL: str = ''
   118	
   119	    # Per-plan limits
   120	    FREE_MAX_DOCUMENTS: int = 3
   121	    PLUS_MAX_DOCUMENTS: int = 20
   122	    PRO_MAX_DOCUMENTS: int = 999
   123	    FREE_MAX_SESSIONS_PER_DOC: int = 3
   124	    FREE_MAX_FILE_SIZE_MB: int = 25
   125	    PLUS_MAX_FILE_SIZE_MB: int = 50
   126	    PRO_MAX_FILE_SIZE_MB: int = 100
   127	
   128	    # Collection limits per plan
   129	    FREE_MAX_COLLECTIONS: int = 1
   130	    PLUS_MAX_COLLECTIONS: int = 5
   131	    PRO_MAX_COLLECTIONS: int = 999
   132	    FREE_MAX_DOCS_PER_COLLECTION: int = 3
   133	    PLUS_MAX_DOCS_PER_COLLECTION: int = 10
   134	    PRO_MAX_DOCS_PER_COLLECTION: int = 999
   135	
   136	    # Admin access — comma-separated email list
   137	    ADMIN_EMAILS: str = ""
   138	
   139	    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False)
   140	
   141	
   142	# Try to load .env from backend/ or repo root for local dev
   143	_candidates = [Path(".env"), Path("..") / ".env"]
   144	_env_file = next((str(p) for p in _candidates if p.exists()), None)
   145	
   146	settings = Settings(_env_file=_env_file) if _env_file else Settings()
   147	
   148	# Reverse lookup: model → mode (for enforcing correct credit multiplier)
   149	MODEL_TO_MODE: dict[str, str] = {v: k for k, v in settings.MODE_MODELS.items()}
   150	
   151	FILE_TYPE_MAP = {
   152	    'application/pdf': 'pdf',
   153	    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
   154	    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
   155	    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
   156	    'text/plain': 'txt',
   157	    'text/markdown': 'md',
   158	    'application/octet-stream': None,  # will be detected by extension
   159	}
   160	
   161	EXTENSION_TYPE_MAP = {
   162	    '.pdf': 'pdf',
   163	    '.docx': 'docx',
   164	    '.pptx': 'pptx',
   165	    '.xlsx': 'xlsx',
   166	    '.txt': 'txt',
   167	    '.md': 'md',
   168	}

 succeeded in 0ms:
     1	from __future__ import annotations
     2	
     3	import logging
     4	import time
     5	import uuid
     6	from dataclasses import dataclass
     7	from typing import Any, AsyncGenerator, Dict, List, Optional
     8	
     9	import sqlalchemy as sa
    10	from openai import AsyncOpenAI
    11	from sqlalchemy import select
    12	from sqlalchemy.ext.asyncio import AsyncSession
    13	
    14	from app.core.config import settings
    15	from app.core.model_profiles import get_model_profile, get_rules_for_model
    16	from app.models.tables import (
    17	    ChatSession,
    18	    Chunk,
    19	    CreditLedger,
    20	    Document,
    21	    Message,
    22	    User,
    23	    collection_documents,
    24	)
    25	from app.services import credit_service
    26	from app.services.retrieval_service import retrieval_service
    27	
    28	logger = logging.getLogger(__name__)
    29	
    30	# ---------------------------
    31	# SSE Event helpers
    32	# ---------------------------
    33	
    34	def sse(event: str, data: Dict[str, Any]) -> Dict[str, Any]:
    35	    return {"event": event, "data": data}
    36	
    37	
    38	_USER_SAFE_ERRORS = {
    39	    "LLM_ERROR": "Failed to generate response. Please try again.",
    40	    "RETRIEVAL_ERROR": "Document retrieval failed. Please try again.",
    41	    "ACCOUNTING_ERROR": "Usage accounting issue occurred. Credits remain safe.",
    42	    "CHAT_SETUP_ERROR": "Failed to set up chat. Please try again.",
    43	    "PERSIST_FAILED": "Failed to save response. Please try again.",
    44	}
    45	
    46	
    47	def _safe_sse(event: str, code: str, exc: Exception, **ctx: Any) -> Dict[str, Any]:
    48	    """Log detailed error server-side, return sanitized SSE payload to client."""
    49	    logger.exception("SSE %s [%s] context=%s", event, code, ctx)
    50	    return sse(event, {"code": code, "message": _USER_SAFE_ERRORS.get(code, "An error occurred.")})
    51	
    52	
    53	_openai_client: AsyncOpenAI | None = None
    54	
    55	
    56	def _get_openai_client() -> AsyncOpenAI:
    57	    global _openai_client
    58	    if _openai_client is None:
    59	        _openai_client = AsyncOpenAI(
    60	            api_key=settings.OPENROUTER_API_KEY,
    61	            base_url=settings.OPENROUTER_BASE_URL,
    62	            default_headers={
    63	                "HTTP-Referer": settings.FRONTEND_URL,
    64	                "X-Title": "DocTalk",
    65	            },
    66	        )
    67	    return _openai_client
    68	
    69	
    70	def _is_valid_bbox(bb: dict) -> bool:
    71	    return all(isinstance(bb.get(k), (int, float)) for k in ("x", "y", "w", "h"))
    72	
    73	
    74	async def _refund_predebit(
    75	    db: AsyncSession,
    76	    user_id: uuid.UUID,
    77	    pre_debited: int,
    78	    predebit_ledger_id: uuid.UUID,
    79	) -> None:
    80	    """Idempotent refund for chat failures before final accounting.
    81	
    82	    Uses ledger delete as the single source of truth: only restore balance
    83	    if the pre-debit ledger row still exists (i.e., not already refunded or
    84	    reconciled away). Safe against double invocation.
    85	    """
    86	    try:
    87	        await db.rollback()
    88	    except Exception:
    89	        pass
    90	
    91	    result = await db.execute(
    92	        sa.delete(CreditLedger).where(CreditLedger.id == predebit_ledger_id)
    93	    )
    94	    if result.rowcount and result.rowcount > 0:
    95	        await db.execute(
    96	            sa.update(User).where(User.id == user_id)
    97	            .values(credits_balance=User.credits_balance + pre_debited)
    98	        )
    99	    await db.commit()
   100	
   101	
   102	# ---------------------------
   103	# RefParserFSM
   104	# ---------------------------
   105	
   106	@dataclass
   107	class _ChunkInfo:
   108	    id: uuid.UUID
   109	    page_start: int
   110	    page_end: int
   111	    bboxes: list
   112	    text: str
   113	    section_title: str = ""
   114	    document_id: Optional[uuid.UUID] = None
   115	    document_filename: str = ""
   116	    score: float = 0.0
   117	
   118	
   119	class RefParserFSM:
   120	    """解析 LLM 流式输出中的 [n] 引用标记
   121	
   122	    - state: TEXT | MAYBE_REF
   123	    - buffer 上限 8 字符，超限回退
   124	    - char_offset: 已输出字符计数
   125	    """
   126	
   127	    def __init__(self, chunk_map: dict[int, _ChunkInfo]):
   128	        self.chunk_map = chunk_map
   129	        self.buffer: str = ""
   130	        self.char_offset: int = 0
   131	        self.state: str = "TEXT"  # TEXT | MAYBE_REF
   132	
   133	    def feed(self, token: str) -> List[Dict[str, Any]]:
   134	        events: List[Dict[str, Any]] = []
   135	        for ch in token:
   136	            if self.state == "TEXT":
   137	                if ch == "[":
   138	                    self.state = "MAYBE_REF"
   139	                    self.buffer = "["
   140	                else:
   141	                    events.append(sse("token", {"text": ch}))
   142	                    self.char_offset += 1
   143	
   144	            elif self.state == "MAYBE_REF":
   145	                self.buffer += ch
   146	                if ch == "]":
   147	                    inner = self.buffer[1:-1]
   148	                    if inner.isdigit() and (int(inner) in self.chunk_map):
   149	                        ref_num = int(inner)
   150	                        chunk = self.chunk_map[ref_num]
   151	                        all_bbs = [
   152	                            bb
   153	                            for bb in (chunk.bboxes or [])
   154	                            if isinstance(bb, dict) and _is_valid_bbox(bb)
   155	                        ]
   156	                        all_bbs.sort(
   157	                            key=lambda b: (
   158	                                int(b.get("page", chunk.page_start))
   159	                                if isinstance(b.get("page", chunk.page_start), (int, float))
   160	                                else chunk.page_start,
   161	                                b.get("y", 0),
   162	                                b.get("x", 0),
   163	                            )
   164	                        )
   165	                        page_counts: dict[int, int] = {}
   166	                        for bb in all_bbs:
   167	                            page_val = bb.get("page", chunk.page_start)
   168	                            page = (
   169	                                int(page_val)
   170	                                if isinstance(page_val, (int, float))
   171	                                else chunk.page_start
   172	                            )
   173	                            page_counts[page] = page_counts.get(page, 0) + 1
   174	                        best_page = (
   175	                            min(page_counts, key=lambda p: (-page_counts[p], p))
   176	                            if page_counts
   177	                            else chunk.page_start
   178	                        )
   179	                        citation_data: Dict[str, Any] = {
   180	                                    "ref_index": ref_num,
   181	                                    "chunk_id": str(chunk.id),
   182	                                    "page": best_page,
   183	                                    "page_end": chunk.page_end,
   184	                                    "bboxes": all_bbs,
   185	                                    "text_snippet": ((f"{chunk.section_title}: " if chunk.section_title else "") + (chunk.text or ""))[:100],
   186	                                    "offset": self.char_offset,
   187	                        }
   188	                        citation_data["confidence_score"] = round(chunk.score, 3)
   189	                        citation_data["context_text"] = (chunk.text or "")[:300]
   190	                        if chunk.document_id:
   191	                            citation_data["document_id"] = str(chunk.document_id)
   192	                        if chunk.document_filename:
   193	                            citation_data["document_filename"] = chunk.document_filename
   194	                        events.append(sse("citation", citation_data))
   195	                    else:
   196	                        # 非有效引用，回退为普通文本
   197	                        events.append(sse("token", {"text": self.buffer}))
   198	                        self.char_offset += len(self.buffer)
   199	                    self.buffer = ""
   200	                    self.state = "TEXT"
   201	                elif len(self.buffer) > 8:
   202	                    # 超限回退
   203	                    events.append(sse("token", {"text": self.buffer}))
   204	                    self.char_offset += len(self.buffer)
   205	                    self.buffer = ""
   206	                    self.state = "TEXT"
   207	        return events
   208	
   209	    def flush(self) -> List[Dict[str, Any]]:
   210	        events: List[Dict[str, Any]] = []
   211	        if self.buffer:
   212	            events.append(sse("token", {"text": self.buffer}))
   213	            self.buffer = ""
   214	        return events
   215	
   216	
   217	# ---------------------------
   218	# Chat Service
   219	# ---------------------------
   220	
   221	
   222	class ChatService:
   223	    async def chat_stream(
   224	        self,
   225	        session_id: uuid.UUID,
   226	        user_message: str,
   227	        db: AsyncSession,
   228	        user: Optional[User] = None,
   229	        locale: Optional[str] = None,
   230	        mode: Optional[str] = None,
   231	        domain_mode: Optional[str] = None,
   232	    ) -> AsyncGenerator[Dict[str, Any], None]:
   233	        """Main chat streaming generator producing SSE event dicts.
   234	
   235	        Steps per spec:
   236	        1) Load session + document
   237	        2) Save user message
   238	        3) Load recent history (last MAX_CHAT_HISTORY_TURNS rounds)
   239	        4) Retrieval top-5
   240	        5) Build prompt with numbered chunks
   241	        6) Stream Anthropic
   242	        7) Parse with RefParserFSM and yield events; ping every 15s
   243	        8) Save assistant message + citations
   244	        9) Yield done
   245	        """
   246	
   247	        # 1) Load session
   248	        row = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
   249	        session_obj: Optional[ChatSession] = row.scalar_one_or_none()
   250	        if not session_obj:
   251	            yield sse("error", {"code": "SESSION_NOT_FOUND", "message": "会话不存在"})
   252	            return
   253	
   254	        document_id = session_obj.document_id
   255	        collection_id = getattr(session_obj, "collection_id", None)
   256	        is_collection_session = collection_id is not None and document_id is None
   257	
   258	        # Load document for custom instructions (single-doc sessions)
   259	        doc = await db.get(Document, document_id) if document_id else None
   260	

exec
/bin/zsh -lc "cd /Users/mayijie/Projects/Code/010_DocTalk && rg -n \"OpenRouter|openrouter|X-Title|HTTP-Referer|zero|retention|provider|messages|model\" backend/app/services/chat_service.py backend/app/services/embedding_service.py backend/app/core/config.py | sed -n '1,260p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
backend/app/services/embedding_service.py:11:from qdrant_client.models import Distance, VectorParams
backend/app/services/embedding_service.py:21:    - Reads model/dim from settings
backend/app/services/embedding_service.py:22:    - Provides batch embedding via OpenRouter (OpenAI-compatible)
backend/app/services/embedding_service.py:27:        self.model: str = settings.EMBEDDING_MODEL
backend/app/services/embedding_service.py:48:        Retries with exponential backoff on transient failures (e.g. OpenRouter
backend/app/services/embedding_service.py:57:                resp = client.embeddings.create(model=self.model, input=texts)
backend/app/core/config.py:11:    # OpenRouter — 统一 API 网关
backend/app/core/config.py:13:    OPENROUTER_BASE_URL: str = Field(default="https://openrouter.ai/api/v1")
backend/app/core/config.py:15:    # Embedding — 模型与维度强绑定 (通过 OpenRouter 调用)
backend/app/core/config.py:24:    # LLM (通过 OpenRouter 调用)
backend/app/core/config.py:77:    # Demo LLM — cheaper model for anonymous demo conversations
backend/app/core/config.py:80:    # Mode-based model selection (Quick/Balanced/Thorough)
backend/app/core/config.py:139:    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False)
backend/app/core/config.py:148:# Reverse lookup: model → mode (for enforcing correct credit multiplier)
backend/app/services/chat_service.py:15:from app.core.model_profiles import get_model_profile, get_rules_for_model
backend/app/services/chat_service.py:16:from app.models.tables import (
backend/app/services/chat_service.py:63:                "HTTP-Referer": settings.FRONTEND_URL,
backend/app/services/chat_service.py:64:                "X-Title": "DocTalk",
backend/app/services/chat_service.py:278:        # Resolve mode → model (mode is the ONLY way to select a model)
backend/app/services/chat_service.py:280:        effective_model = settings.MODE_MODELS[effective_mode]
backend/app/services/chat_service.py:282:        # Force demo model for anonymous users on demo documents
backend/app/services/chat_service.py:284:            effective_model = settings.DEMO_LLM_MODEL
backend/app/services/chat_service.py:333:            # 3) Load history (last N*2 messages before current user msg)
backend/app/services/chat_service.py:346:            claude_messages: List[dict] = []
backend/app/services/chat_service.py:348:                claude_messages.append({"role": m.role, "content": m.content})
backend/app/services/chat_service.py:392:            rules = get_rules_for_model(
backend/app/services/chat_service.py:393:                effective_model, is_collection=is_collection_session
backend/app/services/chat_service.py:425:                from app.core.model_profiles import DOMAIN_RULES
backend/app/services/chat_service.py:451:        # 6) Stream from OpenRouter (OpenAI-compatible)
backend/app/services/chat_service.py:454:        # Build OpenAI-format messages (system + history)
backend/app/services/chat_service.py:455:        # cache_control is Anthropic-specific — only include for Anthropic models
backend/app/services/chat_service.py:456:        profile = get_model_profile(effective_model)
backend/app/services/chat_service.py:470:        openai_messages = [sys_msg] + claude_messages
backend/app/services/chat_service.py:486:                "model": effective_model,
backend/app/services/chat_service.py:489:                "messages": openai_messages,
backend/app/services/chat_service.py:504:                        logger.info("LLM first_token_latency=%.2fs model=%s", latency, effective_model)
backend/app/services/chat_service.py:537:                    "LLM response truncated (finish_reason=length) model=%s max_tokens=%d output_tokens=%s",
backend/app/services/chat_service.py:538:                    effective_model, profile.max_tokens, output_tokens,
backend/app/services/chat_service.py:545:                "LLM total_latency=%.2fs tokens=%d model=%s",
backend/app/services/chat_service.py:548:                effective_model,
backend/app/services/chat_service.py:595:                actual_cost = credit_service.calculate_cost(pt, ct, effective_model, mode=effective_mode)
backend/app/services/chat_service.py:603:                    model=effective_model,
backend/app/services/chat_service.py:649:            from app.models.tables import collection_documents as cd_table
backend/app/services/chat_service.py:687:        # 4) Resolve mode → model
backend/app/services/chat_service.py:689:        effective_model = settings.MODE_MODELS[effective_mode]
backend/app/services/chat_service.py:692:            effective_model = settings.DEMO_LLM_MODEL
backend/app/services/chat_service.py:772:            claude_messages: List[dict] = []
backend/app/services/chat_service.py:774:                claude_messages.append({"role": m.role, "content": m.content})
backend/app/services/chat_service.py:777:            claude_messages.append({
backend/app/services/chat_service.py:794:            rules = get_rules_for_model(
backend/app/services/chat_service.py:795:                effective_model, is_collection=is_collection_session
backend/app/services/chat_service.py:835:        profile = get_model_profile(effective_model)
backend/app/services/chat_service.py:844:        openai_messages = [sys_msg] + claude_messages
backend/app/services/chat_service.py:858:                "model": effective_model,
backend/app/services/chat_service.py:861:                "messages": openai_messages,
backend/app/services/chat_service.py:937:                actual_cost = credit_service.calculate_cost(pt, ct, effective_model, mode=effective_mode)
backend/app/services/chat_service.py:945:                    model=effective_model,

exec
/bin/zsh -lc "cd /Users/mayijie/Projects/Code/010_DocTalk && nl -ba backend/app/services/chat_service.py | sed -n '430,560p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   430	                    for i, rule in enumerate(domain_rules, start=base_rule_count + 1):
   431	                        domain_rules_text += f"{i}. {rule}\n"
   432	                    system_prompt += domain_rules_text
   433	
   434	            # Persist domain_mode to session (null clears, string sets)
   435	            if domain_mode != session_obj.domain_mode:
   436	                session_obj.domain_mode = domain_mode
   437	                await db.commit()
   438	
   439	        except Exception as e:
   440	            if user is not None and pre_debited > 0 and predebit_ledger_id is not None:
   441	                try:
   442	                    await _refund_predebit(db, user.id, pre_debited, predebit_ledger_id)
   443	                except Exception:
   444	                    logger.exception(
   445	                        "Failed to refund pre-debited credits during chat setup failure for user %s",
   446	                        user.id,
   447	                    )
   448	            yield _safe_sse("error", setup_error_code, e, session_id=str(session_id))
   449	            return
   450	
   451	        # 6) Stream from OpenRouter (OpenAI-compatible)
   452	        client = _get_openai_client()
   453	
   454	        # Build OpenAI-format messages (system + history)
   455	        # cache_control is Anthropic-specific — only include for Anthropic models
   456	        profile = get_model_profile(effective_model)
   457	        if profile.supports_cache_control:
   458	            sys_msg: dict = {
   459	                "role": "system",
   460	                "content": [
   461	                    {
   462	                        "type": "text",
   463	                        "text": system_prompt,
   464	                        "cache_control": {"type": "ephemeral"},
   465	                    }
   466	                ],
   467	            }
   468	        else:
   469	            sys_msg = {"role": "system", "content": system_prompt}
   470	        openai_messages = [sys_msg] + claude_messages
   471	
   472	        assistant_text_parts: List[str] = []
   473	        citations: List[dict] = []
   474	        fsm = RefParserFSM(chunk_map)
   475	
   476	        last_ping = time.monotonic()
   477	        prompt_tokens: Optional[int] = None
   478	        output_tokens: Optional[int] = None
   479	        llm_start = time.time()
   480	        first_token_logged = False
   481	        token_count = 0
   482	        finish_reason: Optional[str] = None
   483	
   484	        try:
   485	            create_kwargs: dict[str, Any] = {
   486	                "model": effective_model,
   487	                "max_tokens": profile.max_tokens,
   488	                "temperature": profile.temperature,
   489	                "messages": openai_messages,
   490	                "stream": True,
   491	            }
   492	            if profile.supports_stream_options:
   493	                create_kwargs["stream_options"] = {"include_usage": True}
   494	            stream = await client.chat.completions.create(**create_kwargs)
   495	
   496	            async for chunk in stream:
   497	                # Extract text delta
   498	                if chunk.choices and chunk.choices[0].delta.content:
   499	                    text = chunk.choices[0].delta.content
   500	                    token_count += 1
   501	                    if not first_token_logged:
   502	                        first_token_logged = True
   503	                        latency = time.time() - llm_start
   504	                        logger.info("LLM first_token_latency=%.2fs model=%s", latency, effective_model)
   505	                    # 7) Feed FSM and emit events
   506	                    for ev in fsm.feed(text):
   507	                        if ev["event"] == "token":
   508	                            assistant_text_parts.append(ev["data"]["text"])
   509	                        elif ev["event"] == "citation":
   510	                            citations.append(ev["data"])
   511	                        yield ev
   512	
   513	                # Track finish_reason from choices
   514	                if chunk.choices and chunk.choices[0].finish_reason:
   515	                    finish_reason = chunk.choices[0].finish_reason
   516	
   517	                # Extract usage if present (last chunk)
   518	                if hasattr(chunk, "usage") and chunk.usage:
   519	                    prompt_tokens = getattr(chunk.usage, "prompt_tokens", None)
   520	                    output_tokens = getattr(chunk.usage, "completion_tokens", None)
   521	
   522	                # Ping every 15 seconds
   523	                now = time.monotonic()
   524	                if now - last_ping >= 15.0:
   525	                    yield sse("ping", {})
   526	                    last_ping = now
   527	
   528	            # Flush at stream end
   529	            for ev in fsm.flush():
   530	                if ev["event"] == "token":
   531	                    assistant_text_parts.append(ev["data"]["text"])
   532	                yield ev
   533	
   534	            # Warn if response was truncated due to token limit
   535	            if finish_reason == "length":
   536	                logger.warning(
   537	                    "LLM response truncated (finish_reason=length) model=%s max_tokens=%d output_tokens=%s",
   538	                    effective_model, profile.max_tokens, output_tokens,
   539	                )
   540	                yield sse("truncated", {"reason": "max_tokens"})
   541	
   542	            total_time = time.time() - llm_start
   543	            final_token_count = int(output_tokens) if output_tokens is not None else token_count
   544	            logger.info(
   545	                "LLM total_latency=%.2fs tokens=%d model=%s",
   546	                total_time,
   547	                final_token_count,
   548	                effective_model,
   549	            )
   550	
   551	        except Exception as e:
   552	            # Refund pre-debited credits on LLM failure: restore balance and remove ledger entry
   553	            if user is not None and pre_debited > 0 and predebit_ledger_id is not None:
   554	                try:
   555	                    await _refund_predebit(db, user.id, pre_debited, predebit_ledger_id)
   556	                except Exception:
   557	                    logger.exception(
   558	                        "Failed to refund pre-debited credits after LLM error for user %s",
   559	                        user.id,
   560	                    )

exec
/bin/zsh -lc "cd /Users/mayijie/Projects/Code/010_DocTalk && nl -ba backend/app/services/doc_service.py | sed -n '100,260p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   100	        try:
   101	            from app.workers.parse_worker import parse_document
   102	
   103	            parse_document.delay(str(doc.id))
   104	        except Exception:
   105	            pass
   106	
   107	        return doc_id
   108	
   109	    async def get_document(self, document_id: uuid.UUID, db: AsyncSession) -> Optional[Document]:
   110	        res = await db.execute(select(Document).where(Document.id == document_id))
   111	        doc = res.scalar_one_or_none()
   112	        return doc
   113	
   114	    async def delete_document(self, document_id: uuid.UUID, db: AsyncSession) -> bool:
   115	        """Delete document and all related data via ORM cascade.
   116	
   117	        Pages, chunks, sessions, and messages are cascade-deleted by SQLAlchemy.
   118	        Storage and vector cleanup is best-effort.
   119	        """
   120	        from sqlalchemy.orm import selectinload
   121	
   122	        res = await db.execute(
   123	            select(Document)
   124	            .options(selectinload(Document.chunks))
   125	            .where(Document.id == document_id)
   126	        )
   127	        doc = res.scalar_one_or_none()
   128	        if not doc:
   129	            return False
   130	
   131	        original_storage_ok = True
   132	        converted_storage_ok = True
   133	        qdrant_ok = True
   134	        storage_key = doc.storage_key
   135	        converted_key = doc.converted_storage_key
   136	
   137	        # Best-effort: clean up object storage (sync call, run off event loop)
   138	        try:
   139	            await asyncio.to_thread(storage_service.delete_file, storage_key)
   140	        except Exception as e:
   141	            original_storage_ok = False
   142	            logger.error("MinIO deletion failed for doc %s: %s", document_id, e)
   143	
   144	        # Best-effort: clean up converted PDF if it exists
   145	        if converted_key:
   146	            try:
   147	                await asyncio.to_thread(storage_service.delete_file, converted_key)
   148	            except Exception as e:
   149	                converted_storage_ok = False
   150	                logger.error("MinIO deletion of converted PDF failed for doc %s: %s", document_id, e)
   151	
   152	        # Best-effort: clean up Qdrant vectors (sync call, run off event loop)
   153	        try:
   154	            from qdrant_client.models import FieldCondition, Filter, MatchValue
   155	
   156	            from app.core.config import settings as _settings
   157	            from app.services.embedding_service import embedding_service
   158	
   159	            qclient = embedding_service.get_qdrant_client()
   160	            await asyncio.to_thread(
   161	                qclient.delete,
   162	                collection_name=_settings.QDRANT_COLLECTION,
   163	                points_selector=Filter(
   164	                    must=[FieldCondition(key="document_id", match=MatchValue(value=str(document_id)))]
   165	                ),
   166	            )
   167	        except Exception as e:
   168	            qdrant_ok = False
   169	            logger.error("Qdrant deletion failed for doc %s: %s", document_id, e)
   170	
   171	        # ORM cascade deletes pages, chunks, sessions, messages
   172	        await db.delete(doc)
   173	        await db.commit()
   174	
   175	        log_security_event(
   176	            "document_deleted", document_id=document_id, user_id=doc.user_id,
   177	            storage_cleaned=original_storage_ok and converted_storage_ok,
   178	            original_storage_cleaned=original_storage_ok,
   179	            converted_storage_cleaned=converted_storage_ok,
   180	            vectors_cleaned=qdrant_ok,
   181	        )
   182	
   183	        # Queue retry task if any cleanup failed
   184	        if not original_storage_ok or not converted_storage_ok or not qdrant_ok:
   185	            try:
   186	                from app.workers.deletion_worker import retry_failed_deletion
   187	                retry_failed_deletion.delay(
   188	                    str(document_id),
   189	                    original_storage_key=storage_key if not original_storage_ok else None,
   190	                    converted_storage_key=converted_key if not converted_storage_ok else None,
   191	                    cleanup_qdrant=not qdrant_ok,
   192	                )
   193	            except Exception:
   194	                logger.error("Failed to queue deletion retry for doc %s", document_id)
   195	
   196	        return True
   197	
   198	
   199	# Singleton instance for routers
   200	doc_service = DocService()

exec
/bin/zsh -lc "cd /Users/mayijie/Projects/Code/010_DocTalk && nl -ba backend/app/workers/deletion_worker.py | sed -n '1,260p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	"""Celery task to retry failed storage/vector cleanup on document deletion."""
     2	from __future__ import annotations
     3	
     4	import logging
     5	
     6	from app.workers.celery_app import celery_app
     7	
     8	logger = logging.getLogger(__name__)
     9	
    10	
    11	@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
    12	def retry_failed_deletion(
    13	    self,
    14	    document_id: str,
    15	    storage_key: str | None = None,
    16	    cleanup_qdrant: bool = False,
    17	    original_storage_key: str | None = None,
    18	    converted_storage_key: str | None = None,
    19	):
    20	    """Retry MinIO and/or Qdrant cleanup that failed during document deletion.
    21	
    22	    Uses exponential backoff: 30s, 60s, 120s.
    23	    """
    24	    from app.core.security_log import log_security_event
    25	
    26	    original_storage_key = original_storage_key or storage_key
    27	
    28	    original_storage_ok = True
    29	    converted_storage_ok = True
    30	    qdrant_ok = True
    31	
    32	    if original_storage_key:
    33	        try:
    34	            from app.services.storage_service import storage_service
    35	            storage_service.delete_file(original_storage_key)
    36	            logger.info("Retry: MinIO cleanup succeeded for original file of doc %s", document_id)
    37	        except Exception as e:
    38	            original_storage_ok = False
    39	            logger.error("Retry: MinIO cleanup failed for original file of doc %s: %s", document_id, e)
    40	
    41	    if converted_storage_key:
    42	        try:
    43	            from app.services.storage_service import storage_service
    44	            storage_service.delete_file(converted_storage_key)
    45	            logger.info("Retry: MinIO cleanup succeeded for converted file of doc %s", document_id)
    46	        except Exception as e:
    47	            converted_storage_ok = False
    48	            logger.error(
    49	                "Retry: MinIO cleanup failed for converted file of doc %s: %s",
    50	                document_id,
    51	                e,
    52	            )
    53	
    54	    if cleanup_qdrant:
    55	        try:
    56	            from qdrant_client.models import FieldCondition, Filter, MatchValue
    57	
    58	            from app.core.config import settings
    59	            from app.services.embedding_service import embedding_service
    60	
    61	            qclient = embedding_service.get_qdrant_client()
    62	            qclient.delete(
    63	                collection_name=settings.QDRANT_COLLECTION,
    64	                points_selector=Filter(
    65	                    must=[FieldCondition(key="document_id", match=MatchValue(value=document_id))]
    66	                ),
    67	            )
    68	            logger.info("Retry: Qdrant cleanup succeeded for doc %s", document_id)
    69	        except Exception as e:
    70	            qdrant_ok = False
    71	            logger.error("Retry: Qdrant cleanup failed for doc %s: %s", document_id, e)
    72	
    73	    if not original_storage_ok or not converted_storage_ok or not qdrant_ok:
    74	        try:
    75	            raise self.retry(countdown=30 * (2 ** self.request.retries))
    76	        except self.MaxRetriesExceededError:
    77	            log_security_event(
    78	                "deletion_cleanup_failed_permanently",
    79	                document_id=document_id,
    80	                original_storage_key=original_storage_key,
    81	                converted_storage_key=converted_storage_key,
    82	                original_storage_ok=original_storage_ok,
    83	                converted_storage_ok=converted_storage_ok,
    84	                qdrant_ok=qdrant_ok,
    85	            )
    86	            logger.critical(
    87	                "PERMANENT: Cleanup failed after all retries for doc %s (original=%s, converted=%s, qdrant=%s)",
    88	                document_id,
    89	                original_storage_ok,
    90	                converted_storage_ok,
    91	                qdrant_ok,
    92	            )

exec
/bin/zsh -lc "cd /Users/mayijie/Projects/Code/010_DocTalk && nl -ba backend/app/api/documents.py | sed -n '470,560p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   470	            {"page_number": pn, "text": "\n".join(texts)}
   471	            for pn, texts in sorted(pages_dict.items())
   472	        ]
   473	
   474	    return {"file_type": getattr(doc, 'file_type', 'pdf'), "pages": pages_list}
   475	
   476	
   477	@documents_router.post(
   478	    "/{document_id}/reparse",
   479	    status_code=status.HTTP_202_ACCEPTED,
   480	    response_model=StatusResponse,
   481	)
   482	async def reparse_document(
   483	    document_id: uuid.UUID,
   484	    user: User = Depends(require_auth),
   485	    db: AsyncSession = Depends(get_db_session),
   486	):
   487	    """Re-parse an existing document (e.g., after chunk config changes)."""
   488	    from app.models.tables import Document
   489	
   490	    doc = await db.get(Document, document_id)
   491	    if not doc or doc.user_id != user.id:
   492	        raise HTTPException(status_code=404, detail="Document not found")
   493	    if doc.status not in ("ready", "error"):
   494	        raise HTTPException(status_code=409, detail="Document is still processing")
   495	    doc.status = "parsing"
   496	    db.add(doc)
   497	    await db.commit()
   498	    from app.workers.parse_worker import parse_document
   499	    parse_document.delay(str(doc.id))
   500	    return {"status": "reparsing"}
   501	
   502	
   503	@documents_router.delete(
   504	    "/{document_id}",
   505	    status_code=status.HTTP_202_ACCEPTED,
   506	    response_model=StatusResponse,
   507	)
   508	async def delete_document(
   509	    document_id: uuid.UUID,
   510	    user: User = Depends(require_auth),
   511	    db: AsyncSession = Depends(get_db_session),
   512	):
   513	    doc = await doc_service.get_document(document_id, db)
   514	    if not doc:
   515	        raise HTTPException(status_code=404, detail="Document not found")
   516	    # Only the document owner can delete; demo docs (user_id=None) are not deletable via API
   517	    if doc.user_id != user.id:
   518	        raise HTTPException(status_code=404, detail="Document not found")
   519	    await doc_service.delete_document(document_id, db)
   520	    return JSONResponse(status_code=202, content={"status": "deleted"})
   521	
   522	
   523	class UpdateDocumentRequest(BaseModel):
   524	    custom_instructions: Optional[str] = Field(None, max_length=2000)
   525	
   526	
   527	@documents_router.patch("/{document_id}", response_model=StatusResponse)
   528	async def update_document(
   529	    document_id: uuid.UUID,
   530	    body: UpdateDocumentRequest,
   531	    user: User = Depends(require_auth),
   532	    db: AsyncSession = Depends(get_db_session),
   533	):
   534	    from app.models.tables import Document
   535	
   536	    doc = await db.get(Document, document_id)
   537	    if not doc or doc.user_id != user.id:
   538	        raise HTTPException(status_code=404, detail="Document not found")
   539	    if body.custom_instructions is not None:
   540	        if len(body.custom_instructions) > 2000:
   541	            raise HTTPException(status_code=400, detail="Instructions too long (max 2000 chars)")
   542	        # Custom instructions require Pro plan
   543	        if body.custom_instructions.strip():
   544	            plan = (user.plan or "free").lower()
   545	            if plan != "pro":
   546	                raise HTTPException(status_code=403, detail="Custom instructions require Pro plan")
   547	        doc.custom_instructions = body.custom_instructions if body.custom_instructions.strip() else None
   548	    db.add(doc)
   549	    await db.commit()
   550	    return {"status": "updated"}

exec
/bin/zsh -lc "cd /Users/mayijie/Projects/Code/010_DocTalk && rg -n \"<PrivacyBadge|PrivacyBadge\\(\" frontend/src -g '*.tsx'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
frontend/src/components/PrivacyBadge.tsx:7:export function PrivacyBadge() {
frontend/src/app/HomePageClient.tsx:193:          <PrivacyBadge />
frontend/src/app/HomePageClient.tsx:426:            <PrivacyBadge />

exec
/bin/zsh -lc "cd /Users/mayijie/Projects/Code/010_DocTalk && nl -ba frontend/src/app/HomePageClient.tsx | sed -n '140,260p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   140	                  href={path.href}
   141	                  className="group rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-[box-shadow,transform] duration-200"
   142	                >
   143	                  <div className="flex items-start justify-between gap-4 mb-3">
   144	                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
   145	                      {path.title}
   146	                    </h3>
   147	                    <span className="text-sm text-zinc-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
   148	                      →
   149	                    </span>
   150	                  </div>
   151	                  <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
   152	                    {path.description}
   153	                  </p>
   154	                </Link>
   155	              ))}
   156	            </div>
   157	            <div className="mt-8 flex flex-wrap gap-3 text-sm">
   158	              <Link href="/features" className="text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
   159	                {t('home.explore.links.allFeatures')}
   160	              </Link>
   161	              <span className="text-zinc-300 dark:text-zinc-700">|</span>
   162	              <Link href="/use-cases" className="text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
   163	                {t('home.explore.links.allUseCases')}
   164	              </Link>
   165	              <span className="text-zinc-300 dark:text-zinc-700">|</span>
   166	              <Link href="/compare" className="text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
   167	                {t('home.explore.links.compareTools')}
   168	              </Link>
   169	              <span className="text-zinc-300 dark:text-zinc-700">|</span>
   170	              <Link href="/alternatives" className="text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
   171	                {t('home.explore.links.browseAlternatives')}
   172	              </Link>
   173	            </div>
   174	          </div>
   175	        </section>
   176	
   177	        <SocialProof />
   178	
   179	        <div className="text-center py-8">
   180	          <Link href="/pricing" className="text-sm font-medium text-zinc-500 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
   181	            {t('footer.pricing')} &rarr;
   182	          </Link>
   183	        </div>
   184	
   185	        <SecuritySection />
   186	
   187	        <FAQ />
   188	
   189	        <FinalCTA />
   190	
   191	        {/* Privacy Badge */}
   192	        <section className="py-8 flex justify-center">
   193	          <PrivacyBadge />
   194	        </section>
   195	      </main>
   196	
   197	      <Footer />
   198	    </div>
   199	  );
   200	}
   201	
   202	export default function HomePageClient() {
   203	  const router = useRouter();
   204	  const { status } = useSession();
   205	  const { setDocument, setDocumentStatus } = useDocTalkStore();
   206	  const { t, tOr } = useLocale();
   207	  const [isDragging, setDragging] = useState(false);
   208	  const [uploading, setUploading] = useState(false);
   209	  const [progressText, setProgressText] = useState('');
   210	  const inputRef = useRef<HTMLInputElement>(null);
   211	  const [myDocs, setMyDocs] = useState<StoredDoc[]>([]);
   212	  const [serverDocs, setServerDocs] = useState<DocumentBrief[]>([]);
   213	  const [deletingId, setDeletingId] = useState<string | null>(null);
   214	  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
   215	  const [urlInput, setUrlInput] = useState('');
   216	  const [urlLoading, setUrlLoading] = useState(false);
   217	  const [urlError, setUrlError] = useState('');
   218	  const isLoggedIn = status === 'authenticated';
   219	  const { profile } = useUserProfile();
   220	
   221	  useEffect(() => {
   222	    if (status !== 'unauthenticated') return;
   223	    const docs = JSON.parse(localStorage.getItem('doctalk_docs') || '[]') as StoredDoc[];
   224	    setMyDocs(docs.sort((a, b) => b.createdAt - a.createdAt));
   225	  }, [status]);
   226	
   227	  useEffect(() => {
   228	    if (!isLoggedIn) return;
   229	    const controller = new AbortController();
   230	    getMyDocuments(controller.signal).then(setServerDocs).catch((err) => {
   231	      if (err.name !== 'AbortError') console.error(err);
   232	    });
   233	    return () => controller.abort();
   234	  }, [isLoggedIn]);
   235	
   236	  useEffect(() => {
   237	    if (status === 'unauthenticated') {
   238	      setMyDocs([]);
   239	      setServerDocs([]);
   240	      clearAccountStorage();
   241	    }
   242	  }, [status]);
   243	
   244	  const userPlan: PlanTier = useMemo(() => {
   245	    if (!isLoggedIn) return 'free';
   246	    return profile?.plan === 'plus' || profile?.plan === 'pro' ? profile.plan : 'free';
   247	  }, [isLoggedIn, profile?.plan]);
   248	
   249	  const allDocs = useMemo(() => {
   250	    if (isLoggedIn) {
   251	      return serverDocs
   252	        .map((d) => ({
   253	          document_id: d.id,
   254	          filename: d.filename,
   255	          status: d.status,
   256	          createdAt: d.created_at ? new Date(d.created_at).getTime() : Date.now(),
   257	        }))
   258	        .sort((a, b) => b.createdAt - a.createdAt);
   259	    }
   260	    return myDocs;

exec
/bin/zsh -lc "cd /Users/mayijie/Projects/Code/010_DocTalk && nl -ba frontend/src/app/HomePageClient.tsx | sed -n '380,470p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   380	      } else if (msg.includes('NO_TEXT_CONTENT')) {
   381	        setUrlError(t('upload.noTextContent'));
   382	      } else {
   383	        setUrlError(t('upload.urlError'));
   384	      }
   385	    } finally {
   386	      setUrlLoading(false);
   387	    }
   388	  }, [urlInput, router, setDocument, t]);
   389	
   390	  const confirmDeleteDocument = useCallback(async (documentId: string) => {
   391	    setDeletingId(documentId);
   392	    try {
   393	      await deleteDocument(documentId);
   394	    } catch (e) {
   395	      console.error('Failed to delete document:', e);
   396	    }
   397	
   398	    if (!isLoggedIn) {
   399	      const docs: StoredDoc[] = JSON.parse(localStorage.getItem('doctalk_docs') || '[]');
   400	      const next = docs.filter((x) => x.document_id !== documentId);
   401	      localStorage.setItem('doctalk_docs', JSON.stringify(next));
   402	      setMyDocs(next.sort((a, b) => b.createdAt - a.createdAt));
   403	    }
   404	    setServerDocs((prev) => prev.filter((s) => s.id !== documentId));
   405	    setDeletingId(null);
   406	    setConfirmDeleteId((prev) => (prev === documentId ? null : prev));
   407	  }, [isLoggedIn]);
   408	
   409	  /* --- Loading guard (prevents flash of wrong content) --- */
   410	  if (status === 'loading') {
   411	    return <LandingPageContent />;
   412	  }
   413	
   414	  /* --- Logged-out landing page --- */
   415	  if (!isLoggedIn) {
   416	    return <LandingPageContent />;
   417	  }
   418	
   419	  /* --- Logged-in dashboard --- */
   420	  return (
   421	    <div className="flex flex-col min-h-screen bg-[var(--page-background)]">
   422	      <Header variant="full" />
   423	      <main id="main-content" className="flex-1 flex flex-col items-center p-6 sm:p-8 gap-10">
   424	        <div className="max-w-4xl w-full">
   425	          <div className="mb-4 flex justify-center">
   426	            <PrivacyBadge />
   427	          </div>
   428	
   429	          <div
   430	            className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center transition-colors ${
   431	              isDragging
   432	                ? 'border-zinc-500 bg-zinc-50 dark:bg-zinc-900'
   433	                : 'border-zinc-300 dark:border-zinc-700'
   434	            }`}
   435	            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
   436	            onDragLeave={() => setDragging(false)}
   437	            onDrop={onDrop}
   438	          >
   439	            <input ref={inputRef} type="file" accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/markdown,.pdf,.docx,.pptx,.xlsx,.txt,.md" className="hidden" onChange={onInputChange} aria-label="Upload document" />
   440	            <p className="text-zinc-700 dark:text-zinc-300 text-lg">{t('upload.dragDrop')}</p>
   441	            <p className="text-zinc-400 text-xs mt-1">{t('upload.supportedFormats')}</p>
   442	            <p className="text-zinc-400 text-sm mt-1">{t('upload.or')}</p>
   443	            <button
   444	              type="button"
   445	              onClick={() => inputRef.current?.click()}
   446	              className="mt-4 px-6 py-2.5 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-sm hover:shadow-md transition-[box-shadow,color,background-color] disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
   447	              disabled={uploading}
   448	            >
   449	              {t('upload.chooseFile')}
   450	            </button>
   451	            {progressText && (
   452	              <div aria-live="polite" className={`mt-4 text-sm ${uploading ? 'text-zinc-500' : 'text-red-600 dark:text-red-400'}`}>
   453	                {progressText}
   454	              </div>
   455	            )}
   456	          </div>
   457	
   458	          {/* URL Import */}
   459	          <div className="mt-4 flex items-center gap-2 max-w-lg mx-auto">
   460	            <div className="flex-1 relative">
   461	              <Link2 aria-hidden="true" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
   462	              <input
   463	                type="url"
   464	                value={urlInput}
   465	                onChange={(e) => { setUrlInput(e.target.value); setUrlError(''); }}
   466	                onKeyDown={(e) => { if (e.key === 'Enter') onUrlSubmit(); }}
   467	                placeholder={t('upload.urlPlaceholder')}
   468	                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 transition-shadow"
   469	                disabled={urlLoading}
   470	                aria-label="Document URL"

exec
/bin/zsh -lc "cd /Users/mayijie/Projects/Code/010_DocTalk && nl -ba frontend/src/i18n/locales/en.json | sed -n '160,250p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   160	  "terms.section3.title": "Disclaimer",
   161	  "terms.section3.content": "AI responses may contain errors. Verify important information independently.",
   162	  "terms.section4.title": "Changes",
   163	  "terms.section4.content": "We may update these terms. Continued use constitutes acceptance of changes.",
   164	  "terms.lastUpdated": "Last updated",
   165	  "demo.notFound": "Demo document not found",
   166	  "demo.viewAll": "View all demos",
   167	  "demo.title": "Choose a sample document",
   168	  "demo.subtitle": "Experience DocTalk with these example PDFs",
   169	  "demo.hint": "Tip: Click citation numbers [1] to jump to the source and see highlights",
   170	  "demo.backToHome": "Back to home",
   171	  "demo.sample.earnings.title": "Alphabet Earnings Release",
   172	  "demo.sample.earnings.desc": "Q4 2025 Quarterly Earnings",
   173	  "demo.sample.earnings.question": "What was Alphabet's revenue this quarter?",
   174	  "demo.sample.paper.title": "Attention Is All You Need",
   175	  "demo.sample.paper.desc": "Foundational AI/ML research paper",
   176	  "demo.sample.paper.question": "How does multi-head attention work?",
   177	  "demo.sample.court.title": "US District Court Filing",
   178	  "demo.sample.court.desc": "Federal civil case document",
   179	  "demo.sample.court.question": "What are the key claims in this filing?",
   180	  "demo.viewing": "Viewing",
   181	  "demo.loginToSave": "Sign in to save",
   182	  "demo.loggedIn": "Signed in",
   183	  "demo.emptyState": "Ask a question about this document",
   184	  "demo.remaining": "{count}/{total} messages remaining",
   185	  "demo.loginForMore": "Sign in for unlimited",
   186	  "demo.limitReached": "Sign in to continue",
   187	  "demo.questionsRemaining": "{remaining}/{total} questions remaining",
   188	  "demo.signInForUnlimited": "Sign in for unlimited",
   189	  "demo.signInToContinue": "Sign in to continue chatting",
   190	  "demo.limitReachedMessage": "You've used all 5 demo questions. Sign in for unlimited access with free credits!",
   191	  "demo.processing": "Processing...",
   192	  "demo.freeMessages": "5 free messages per document · Sign in for unlimited access",
   193	  "demo.rateLimitMessage": "Too many requests. Please wait a moment and try again.",
   194	  "common.backToHome": "Back to home",
   195	  "profile.title": "Profile",
   196	  "profile.tabs.profile": "Profile",
   197	  "profile.tabs.credits": "Credits",
   198	  "profile.tabs.usage": "Usage",
   199	  "profile.tabs.account": "Account",
   200	  "profile.tabs.notifications": "Notifications",
   201	  "profile.notifications.title": "Notifications",
   202	  "profile.notifications.empty": "Email notifications and product updates are coming soon.",
   203	  "profile.info.memberSince": "Member for {days} days",
   204	  "profile.info.connectedWith": "Connected with {provider}",
   205	  "profile.plan.free": "Free",
   206	  "profile.plan.plus": "Plus",
   207	  "profile.plan.pro": "Pro",
   208	  "profile.plan.upgrade": "Upgrade to Pro",
   209	  "profile.plan.manage": "Manage Subscription",
   210	  "profile.plan.monthlyAllowance": "{used} / {total} monthly credits",
   211	  "profile.plan.nextRenewal": "Renews in {days} days",
   212	  "profile.credits.balance": "Credits Balance",
   213	  "profile.credits.buyMore": "Buy Extra Credits",
   214	  "profile.credits.prevPage": "Previous page",
   215	  "profile.credits.nextPage": "Next page",
   216	  "profile.credits.history": "Transaction History",
   217	  "profile.credits.noHistory": "No transactions yet",
   218	  "profile.credits.date": "Date",
   219	  "profile.credits.type": "Type",
   220	  "profile.credits.amount": "Amount",
   221	  "profile.credits.reason.signup_bonus": "Signup Bonus",
   222	  "profile.credits.reason.purchase": "Credit Purchase",
   223	  "profile.credits.reason.chat": "Chat Usage",
   224	  "profile.credits.reason.monthly_allowance": "Monthly Allowance",
   225	  "profile.credits.reason.chat_predebit": "Chat Usage",
   226	  "profile.credits.reason.chat_predebit_refund": "Chat Usage",
   227	  "profile.credits.reason.chat_reconcile_refund": "Chat Usage",
   228	  "profile.credits.reason.chat_reconcile_charge": "Chat Usage",
   229	  "profile.credits.reason.refund": "Refund",
   230	  "profile.credits.ariaProgress": "{percent}% of monthly credits used",
   231	  "profile.usage.documents": "Documents",
   232	  "profile.usage.sessions": "Chat Sessions",
   233	  "profile.usage.messages": "Messages",
   234	  "profile.usage.creditsSpent": "Credits Spent",
   235	  "profile.usage.tokensUsed": "Tokens Used",
   236	  "profile.usage.modelBreakdown": "Usage by Model",
   237	  "profile.usage.model": "Mode",
   238	  "profile.usage.calls": "Calls",
   239	  "profile.usage.tokens": "Tokens",
   240	  "profile.usage.credits": "Credits",
   241	  "profile.usage.modeBreakdown": "Usage by Mode",
   242	  "profile.usage.detailedBreakdown": "Detailed Breakdown",
   243	  "profile.usage.mode.quick": "Quick",
   244	  "profile.usage.mode.balanced": "Balanced",
   245	  "profile.usage.mode.thorough": "Thorough",
   246	  "profile.usage.mode.other": "Other",
   247	  "profile.usage.chats": "Chats",
   248	  "profile.usage.avgPerChat": "Avg/Chat",
   249	  "profile.usage.share": "Share",
   250	  "profile.usage.total": "Total",

exec
/bin/zsh -lc "cd /Users/mayijie/Projects/Code/010_DocTalk && nl -ba frontend/src/i18n/locales/zh.json | sed -n '160,260p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   160	  "terms.section4.title": "条款变更",
   161	  "terms.section4.content": "我们可能更新这些条款。继续使用即表示接受变更。",
   162	  "terms.lastUpdated": "最后更新",
   163	  "demo.notFound": "未找到演示文档",
   164	  "demo.viewAll": "查看所有演示",
   165	  "demo.title": "选择示例文档",
   166	  "demo.subtitle": "使用这些示例 PDF 体验 DocTalk",
   167	  "demo.hint": "提示：点击引用编号 [1] 可跳转到原文并高亮显示",
   168	  "demo.backToHome": "返回首页",
   169	  "demo.sample.earnings.title": "Alphabet 财报",
   170	  "demo.sample.earnings.desc": "2025年第四季度财报",
   171	  "demo.sample.earnings.question": "Alphabet 本季度收入是多少？",
   172	  "demo.sample.paper.title": "Attention Is All You Need",
   173	  "demo.sample.paper.desc": "AI/ML 基础研究论文",
   174	  "demo.sample.paper.question": "多头注意力机制是如何工作的？",
   175	  "demo.sample.court.title": "美国地方法院文书",
   176	  "demo.sample.court.desc": "联邦民事案件文书",
   177	  "demo.sample.court.question": "本案的关键主张是什么？",
   178	  "demo.viewing": "正在查看",
   179	  "demo.loginToSave": "登录保存对话",
   180	  "demo.loggedIn": "已登录",
   181	  "demo.emptyState": "向这份文档提问",
   182	  "demo.remaining": "剩余 {count}/{total} 条消息",
   183	  "demo.loginForMore": "登录解锁无限",
   184	  "demo.limitReached": "登录以继续",
   185	  "demo.questionsRemaining": "剩余 {remaining}/{total} 个问题",
   186	  "demo.signInForUnlimited": "登录解锁无限",
   187	  "demo.signInToContinue": "登录以继续对话",
   188	  "demo.limitReachedMessage": "5 个演示问题已用完。登录即可免费获取 Credits，享受无限对话！",
   189	  "demo.processing": "处理中…",
   190	  "demo.freeMessages": "每篇文档 5 条免费消息 · 登录享受无限访问",
   191	  "demo.rateLimitMessage": "请求过于频繁，请稍后再试。",
   192	  "common.backToHome": "返回首页",
   193	  "profile.title": "个人资料",
   194	  "profile.tabs.profile": "资料",
   195	  "profile.tabs.credits": "额度",
   196	  "profile.tabs.usage": "用量",
   197	  "profile.tabs.account": "账户",
   198	  "profile.tabs.notifications": "通知",
   199	  "profile.notifications.title": "通知",
   200	  "profile.notifications.empty": "邮件通知和产品更新即将上线。",
   201	  "profile.info.memberSince": "已加入 {days} 天",
   202	  "profile.info.connectedWith": "已通过 {provider} 连接",
   203	  "profile.plan.free": "免费",
   204	  "profile.plan.plus": "Plus",
   205	  "profile.plan.pro": "专业版",
   206	  "profile.plan.upgrade": "升级到专业版",
   207	  "profile.plan.manage": "管理订阅",
   208	  "profile.plan.monthlyAllowance": "{used} / {total} 每月额度",
   209	  "profile.plan.nextRenewal": "{days} 天后续订",
   210	  "profile.credits.balance": "额度余额",
   211	  "profile.credits.buyMore": "购买额外额度",
   212	  "profile.credits.prevPage": "上一页",
   213	  "profile.credits.nextPage": "下一页",
   214	  "profile.credits.history": "交易记录",
   215	  "profile.credits.noHistory": "暂无交易记录",
   216	  "profile.credits.date": "日期",
   217	  "profile.credits.type": "类型",
   218	  "profile.credits.amount": "金额",
   219	  "profile.credits.reason.signup_bonus": "注册赠送",
   220	  "profile.credits.reason.purchase": "购买额度",
   221	  "profile.credits.reason.chat": "聊天消耗",
   222	  "profile.credits.reason.monthly_allowance": "每月额度",
   223	  "profile.credits.reason.chat_predebit": "聊天消耗",
   224	  "profile.credits.reason.chat_predebit_refund": "聊天消耗",
   225	  "profile.credits.reason.chat_reconcile_refund": "聊天消耗",
   226	  "profile.credits.reason.chat_reconcile_charge": "聊天消耗",
   227	  "profile.credits.reason.refund": "退款",
   228	  "profile.credits.ariaProgress": "已使用 {percent}% 的每月积分",
   229	  "profile.usage.documents": "文档",
   230	  "profile.usage.sessions": "聊天会话",
   231	  "profile.usage.messages": "消息",
   232	  "profile.usage.creditsSpent": "已消耗额度",
   233	  "profile.usage.tokensUsed": "已使用 Tokens",
   234	  "profile.usage.modelBreakdown": "按模型统计",
   235	  "profile.usage.model": "模式",
   236	  "profile.usage.calls": "调用次数",
   237	  "profile.usage.tokens": "Tokens",
   238	  "profile.usage.credits": "额度",
   239	  "profile.usage.modeBreakdown": "按模式统计",
   240	  "profile.usage.detailedBreakdown": "详细明细",
   241	  "profile.usage.mode.quick": "快速",
   242	  "profile.usage.mode.balanced": "均衡",
   243	  "profile.usage.mode.thorough": "深度",
   244	  "profile.usage.mode.other": "其他",
   245	  "profile.usage.chats": "对话",
   246	  "profile.usage.avgPerChat": "均值/次",
   247	  "profile.usage.share": "占比",
   248	  "profile.usage.total": "合计",
   249	  "profile.usage.otherNote": "包含使用旧版 DocTalk AI 配置的历史记录。",
   250	  "profile.usage.noData": "暂无使用数据。开始与文档对话吧！",
   251	  "profile.account.dangerZone": "危险区域",
   252	  "profile.account.deleteAccount": "删除账户",
   253	  "profile.account.deleteWarning": "这将永久删除你的账户、所有文档、对话和数据。此操作无法撤销。",
   254	  "profile.account.deleteConfirm": "输入你的邮箱以确认删除",
   255	  "profile.account.deleting": "正在删除账户…",
   256	  "profile.account.exportTitle": "下载我的数据",
   257	  "profile.account.exportDesc": "下载您在 DocTalk 的所有数据副本，包括个人资料、文档元数据、对话记录和额度历史。",
   258	  "profile.account.exportButton": "下载我的数据",
   259	  "profile.account.exporting": "正在准备您的数据…",
   260	  "profile.account.confirmEmail": "确认邮箱地址",

exec
/bin/zsh -lc "cd /Users/mayijie/Projects/Code/010_DocTalk && rg -n 'privacy\\.deleteFast|privacy\\.trustLink|profile\\.tabs\\.notifications|profile\\.notifications\\.title|profile\\.notifications\\.empty' frontend/src/i18n/locales/*.json | sed -n '1,200p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
frontend/src/i18n/locales/zh.json:198:  "profile.tabs.notifications": "通知",
frontend/src/i18n/locales/zh.json:199:  "profile.notifications.title": "通知",
frontend/src/i18n/locales/zh.json:200:  "profile.notifications.empty": "邮件通知和产品更新即将上线。",
frontend/src/i18n/locales/en.json:90:  "privacy.deleteFast": "Delete in <60s",
frontend/src/i18n/locales/en.json:91:  "privacy.trustLink": "Trust Center",
frontend/src/i18n/locales/en.json:200:  "profile.tabs.notifications": "Notifications",
frontend/src/i18n/locales/en.json:201:  "profile.notifications.title": "Notifications",
frontend/src/i18n/locales/en.json:202:  "profile.notifications.empty": "Email notifications and product updates are coming soon.",

exec
/bin/zsh -lc "cd /Users/mayijie/Projects/Code/010_DocTalk && nl -ba frontend/src/i18n/locales/en.json | sed -n '70,120p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
    70	  "session.deleteChat": "Delete Chat",
    71	  "session.deleteChatConfirm": "Are you sure you want to delete this chat? This cannot be undone.",
    72	  "session.backHome": "Back to Home",
    73	  "session.noTitle": "New Chat",
    74	  "session.messageCount": "{count} messages",
    75	  "doc.deleteDoc": "Delete",
    76	  "doc.deleteDocConfirm": "Are you sure you want to delete this document and all its chats?",
    77	  "auth.signIn": "Sign In",
    78	  "auth.signInSubtitle": "Sign in to continue to DocTalk",
    79	  "auth.continueWithGoogle": "Continue with Google",
    80	  "auth.termsNotice": "By continuing, you agree to our Terms of Service and Privacy Policy.",
    81	  "auth.signOut": "Sign Out",
    82	  "credits.credits": "credits",
    83	  "credits.insufficientCredits": "Insufficient Credits",
    84	  "credits.purchasePrompt": "You've run out of credits. Purchase more to continue chatting.",
    85	  "credits.buyCredits": "Buy Credits",
    86	  "privacy.badge": "Privacy-first: your docs stay yours",
    87	  "privacy.noTraining": "We never use your data for model training",
    88	  "privacy.encrypted": "TLS encrypted in transit, AES-256 at rest",
    89	  "privacy.deleteAnytime": "Delete your data anytime",
    90	  "privacy.deleteFast": "Delete in <60s",
    91	  "privacy.trustLink": "Trust Center",
    92	  "privacy.policyLink": "Privacy Policy",
    93	  "privacy.termsLink": "Terms",
    94	  "home.cta.demoNow": "Try Example PDF Now",
    95	  "home.cta.loginUpload": "Log in to upload your PDF",
    96	  "home.cta.tryDemo": "Try demo",
    97	  "auth.freeCredits": "New users get 1,000 credits",
    98	  "billing.title": "Purchase Credits",
    99	  "billing.purchase": "Purchase",
   100	  "billing.purchaseSuccess": "Purchase successful! Credits have been added to your account.",
   101	  "billing.purchaseCanceled": "Purchase was canceled.",
   102	  "billing.error": "An error occurred. Please try again.",
   103	  "billing.plus.title": "Plus Plan",
   104	  "billing.plus.description": "3,000 credits/month, all models, export",
   105	  "billing.plus.priceMonthly": "$9.99/month",
   106	  "billing.plus.priceAnnual": "$7.99/month",
   107	  "billing.plus.credits": "3,000",
   108	  "billing.pro.title": "Pro Plan",
   109	  "billing.pro.description": "9,000 credits/month, custom prompts, priority support",
   110	  "billing.pro.priceMonthly": "$19.99/month",
   111	  "billing.pro.priceAnnual": "$15.99/month",
   112	  "billing.pro.pricePerMonth": "${price}/month",
   113	  "billing.pro.credits": "9,000",
   114	  "billing.free.credits": "500",
   115	  "billing.annual": "Annual",
   116	  "billing.monthly": "Monthly",
   117	  "billing.savePercent": "Save {percent}%",
   118	  "billing.mostPopular": "Most Popular",
   119	  "billing.currentPlan": "Current Plan",
   120	  "billing.upgrade": "Upgrade",

exec
/bin/zsh -lc "cd /Users/mayijie/Projects/Code/010_DocTalk && nl -ba frontend/src/i18n/locales/zh.json | sed -n '70,120p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
    70	  "session.deleteChat": "删除当前对话",
    71	  "session.deleteChatConfirm": "确定要删除该对话吗？此操作不可恢复。",
    72	  "session.backHome": "返回首页",
    73	  "session.noTitle": "新建对话",
    74	  "session.messageCount": "{count} 条消息",
    75	  "doc.deleteDoc": "删除",
    76	  "doc.deleteDocConfirm": "确定要删除该文档及其所有对话吗？",
    77	  "auth.signIn": "登录",
    78	  "auth.signInSubtitle": "登录以继续使用 DocTalk",
    79	  "auth.continueWithGoogle": "使用 Google 继续",
    80	  "auth.termsNotice": "继续即表示您同意我们的服务条款和隐私政策。",
    81	  "auth.signOut": "退出登录",
    82	  "credits.credits": "额度",
    83	  "credits.insufficientCredits": "额度不足",
    84	  "credits.purchasePrompt": "您的额度已用完。请购买更多额度以继续聊天。",
    85	  "credits.buyCredits": "购买额度",
    86	  "privacy.badge": "隐私优先：你的文档只属于你",
    87	  "privacy.noTraining": "不用于模型训练",
    88	  "privacy.encrypted": "传输 TLS 加密，存储 AES-256 加密",
    89	  "privacy.deleteAnytime": "随时可删除数据",
    90	  "privacy.policyLink": "隐私政策",
    91	  "privacy.termsLink": "服务条款",
    92	  "home.cta.demoNow": "立即体验示例 PDF",
    93	  "home.cta.loginUpload": "登录上传你的 PDF",
    94	  "home.cta.tryDemo": "试用示例",
    95	  "auth.freeCredits": "新用户赠送 1,000 credits",
    96	  "billing.title": "购买额度",
    97	  "billing.purchase": "购买",
    98	  "billing.purchaseSuccess": "购买成功！额度已添加到您的账户。",
    99	  "billing.purchaseCanceled": "购买已取消。",
   100	  "billing.error": "出现错误，请重试。",
   101	  "billing.plus.title": "Plus 计划",
   102	  "billing.plus.description": "每月 3,000 额度，全部模型，导出",
   103	  "billing.plus.priceMonthly": "$9.99/月",
   104	  "billing.plus.priceAnnual": "$7.99/月",
   105	  "billing.plus.credits": "3,000",
   106	  "billing.pro.title": "Pro 计划",
   107	  "billing.pro.description": "每月 9,000 额度，自定义提示词，优先支持",
   108	  "billing.pro.priceMonthly": "$19.99/月",
   109	  "billing.pro.priceAnnual": "$15.99/月",
   110	  "billing.pro.pricePerMonth": "${price}/月",
   111	  "billing.pro.credits": "9,000",
   112	  "billing.free.credits": "500",
   113	  "billing.annual": "按年",
   114	  "billing.monthly": "按月",
   115	  "billing.savePercent": "省 {percent}%",
   116	  "billing.mostPopular": "最受欢迎",
   117	  "billing.currentPlan": "当前方案",
   118	  "billing.upgrade": "升级",
   119	  "billing.manage": "管理",
   120	  "billing.features.plusCredits": "每月 3,000 额度",

exec
/bin/zsh -lc 'cd /Users/mayijie/Projects/Code/010_DocTalk && for f in ar de es fr hi it ja ko pt; do echo "--- $f"; rg -n '"'\"useCasesLawyers\\.faq\\.q4\\.answer\"' frontend/src/i18n/locales/"'$f.json; done' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
--- ar
889:  "useCasesLawyers.faq.q4.answer": "يعمل DocTalk بشكل أفضل مع ملفات PDF النصية التي تحافظ على طبقة النص. بالنسبة لملفات PDF الممسوحة ضوئيًا أو التي تحتوي على صور فقط، يقوم DocTalk تلقائيًا بتشغيل التعرف البصري على الحروف (OCR) باستخدام Tesseract (الإنجليزية + الصينية المبسطة) لاستخراج النص. تختلف جودة OCR حسب دقة المسح وتخطيط الصفحة — بالنسبة للعمل القانوني الذي يتطلب دقة عالية، تظل ملفات PDF النصية المصدر الأكثر موثوقية.",
--- de
889:  "useCasesLawyers.faq.q4.answer": "DocTalk funktioniert am besten mit textbasierten PDFs, bei denen die Textschicht erhalten ist. Für gescannte oder reine Bild-PDFs führt DocTalk automatisch OCR mit Tesseract (Englisch + vereinfachtes Chinesisch) aus, um Text zu extrahieren. Die OCR-Qualität hängt von Scan-Auflösung und Seitenlayout ab — für juristische Arbeit mit hoher Genauigkeitsanforderung bleiben textbasierte PDFs die zuverlässigste Quelle.",
--- es
889:  "useCasesLawyers.faq.q4.answer": "DocTalk funciona mejor con PDF de texto donde se conserva la capa textual. Para PDF escaneados o solo de imagen, DocTalk ejecuta automáticamente OCR con Tesseract (inglés + chino simplificado) para extraer texto. La calidad del OCR varía según la resolución del escaneo y el diseño de página — para trabajos jurídicos que requieren alta fidelidad, los PDF de texto siguen siendo la fuente más fiable.",
--- fr
889:  "useCasesLawyers.faq.q4.answer": "DocTalk fonctionne mieux avec les PDF texte où la couche de texte est préservée. Pour les PDF scannés ou uniquement images, DocTalk exécute automatiquement l'OCR via Tesseract (anglais + chinois simplifié) pour extraire le texte. La qualité de l'OCR varie selon la résolution du scan et la mise en page — pour un travail juridique exigeant une haute fidélité, les PDF texte restent la source la plus fiable.",
--- hi
889:  "useCasesLawyers.faq.q4.answer": "DocTalk टेक्स्ट-आधारित PDF के साथ सबसे बेहतर काम करता है जहाँ टेक्स्ट लेयर सुरक्षित रहती है। स्कैन किए गए या केवल-छवि वाले PDF के लिए, DocTalk Tesseract (अंग्रेज़ी + सरलीकृत चीनी) का उपयोग करके स्वचालित रूप से OCR चलाता है और टेक्स्ट निकालता है। OCR गुणवत्ता स्कैन रिज़ॉल्यूशन और पेज लेआउट के अनुसार बदलती है — उच्च सटीकता वाले कानूनी काम के लिए, टेक्स्ट-आधारित PDF ही सबसे विश्वसनीय स्रोत हैं।",
--- it
889:  "useCasesLawyers.faq.q4.answer": "DocTalk funziona meglio con PDF testuali in cui il livello di testo è preservato. Per PDF scansionati o solo immagine, DocTalk esegue automaticamente l'OCR tramite Tesseract (inglese + cinese semplificato) per estrarre il testo. La qualità dell'OCR varia in base alla risoluzione della scansione e all'impaginazione — per il lavoro legale che richiede alta fedeltà, i PDF testuali restano la fonte più affidabile.",
--- ja
889:  "useCasesLawyers.faq.q4.answer": "DocTalk はテキスト層が保持されたテキスト型 PDF で最も高い性能を発揮します。スキャンされた PDF や画像のみの PDF に対しては、DocTalk が Tesseract（英語 + 簡体字中国語）で自動的に OCR を実行し、テキストを抽出します。OCR の品質はスキャン解像度やページレイアウトによって変動します — 高い正確性が求められる法務業務では、テキスト型 PDF が引き続き最も信頼できるソースです。",
--- ko
889:  "useCasesLawyers.faq.q4.answer": "DocTalk는 텍스트 레이어가 보존된 텍스트 기반 PDF에서 가장 잘 작동합니다. 스캔된 PDF나 이미지 전용 PDF의 경우, DocTalk가 Tesseract(영어 + 중국어 간체)를 사용해 자동으로 OCR을 실행하여 텍스트를 추출합니다. OCR 품질은 스캔 해상도와 페이지 레이아웃에 따라 달라집니다 — 높은 정확도가 필요한 법률 업무에서는 텍스트 기반 PDF가 여전히 가장 신뢰할 수 있는 소스입니다.",
--- pt
1964:  "useCasesLawyers.faq.q4.answer": "O DocTalk funciona melhor com PDFs textuais em que a camada de texto é preservada. Para PDFs digitalizados ou somente imagem, o DocTalk executa OCR automaticamente com Tesseract (inglês + chinês simplificado) para extrair texto. A qualidade do OCR varia conforme a resolução da digitalização e o layout da página — para trabalho jurídico que exige alta fidelidade, PDFs textuais continuam sendo a fonte mais confiável.",

codex
我在继续挖两个风险点：一是 `storage_service` 里存在 SSE-S3 失败回退到无加密上传（会影响“绝对加密”表述），二是全局 `.dark .font-bold` 可能改到很多非正文组件。接着我会给出可量化影响（对比度和命中范围）。
exec
/bin/zsh -lc "cd /Users/mayijie/Projects/Code/010_DocTalk && rg -n \"font-bold\" frontend/src -g '*.tsx' -g '*.ts' -g '*.css' | sed -n '1,260p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
frontend/src/app/global-error.tsx:25:          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">Something went wrong</h2>
frontend/src/components/seo/CTABanner.tsx:22:          <h2 className="text-2xl sm:text-3xl font-bold text-white dark:text-zinc-900 mb-4 tracking-tight">
frontend/src/components/seo/CTABanner.tsx:45:        <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 tracking-tight">
frontend/src/components/Chat/SourcesStrip.tsx:108:              <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded bg-accent text-[10px] font-bold leading-none text-accent-foreground">
frontend/src/components/Profile/CreditsSection.tsx:102:          <div className={`text-3xl font-bold ${balanceColor}`}>
frontend/src/app/auth/error/page.tsx:45:          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-3">
frontend/src/app/billing/BillingPageClient.tsx:290:        <h1 className="text-2xl font-bold mb-6 text-zinc-900 dark:text-zinc-50">
frontend/src/app/billing/BillingPageClient.tsx:377:                    <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 tabular-nums">
frontend/src/app/billing/BillingPageClient.tsx:438:                    <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 tabular-nums">
frontend/src/app/billing/BillingPageClient.tsx:542:                <p className="text-3xl font-bold mt-2 text-zinc-900 dark:text-zinc-100">
frontend/src/app/globals.css:63:.dark .font-bold {
frontend/src/components/landing/SocialProof.tsx:78:                <div className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400 bg-clip-text text-transparent mb-2 tabular-nums">
frontend/src/components/landing/HowItWorks.tsx:31:                <div className="w-10 h-10 rounded-full bg-accent text-accent-foreground text-sm font-bold flex items-center justify-center mb-4">
frontend/src/components/landing/HeroArtifact.tsx:60:          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
frontend/src/components/landing/HeroArtifact.tsx:77:            <span className="inline-flex items-center justify-center h-4 px-1.5 rounded bg-accent text-[10px] font-bold leading-none text-accent-foreground">
frontend/src/components/landing/FeatureGrid.tsx:45:            <span className="inline-flex items-center justify-center text-[9px] font-bold leading-none px-1.5 py-0.5 rounded bg-accent text-accent-foreground mr-1">
frontend/src/app/alternatives/chatpdf/ChatpdfAltsClient.tsx:84:            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-bold">1</span>
frontend/src/app/alternatives/chatpdf/ChatpdfAltsClient.tsx:130:              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-bold">2</span>
frontend/src/app/alternatives/chatpdf/ChatpdfAltsClient.tsx:153:            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-bold">3</span>
frontend/src/app/alternatives/chatpdf/ChatpdfAltsClient.tsx:173:              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-bold">4</span>
frontend/src/app/alternatives/chatpdf/ChatpdfAltsClient.tsx:193:            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-bold">5</span>
frontend/src/app/alternatives/chatpdf/ChatpdfAltsClient.tsx:213:              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-bold">6</span>
frontend/src/app/alternatives/chatpdf/ChatpdfAltsClient.tsx:233:            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-bold">7</span>
frontend/src/app/alternatives/notebooklm/NotebooklmAltsClient.tsx:66:              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-bold">1</span>
frontend/src/app/alternatives/notebooklm/NotebooklmAltsClient.tsx:111:            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-bold">2</span>
frontend/src/app/alternatives/notebooklm/NotebooklmAltsClient.tsx:131:              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-bold">3</span>
frontend/src/app/alternatives/notebooklm/NotebooklmAltsClient.tsx:151:            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-bold">4</span>
frontend/src/app/alternatives/notebooklm/NotebooklmAltsClient.tsx:171:              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-bold">5</span>
frontend/src/app/alternatives/notebooklm/NotebooklmAltsClient.tsx:191:            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-bold">6</span>
frontend/src/app/alternatives/askyourpdf/AskyourpdfAltsClient.tsx:116:              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-bold">1</span>
frontend/src/app/alternatives/askyourpdf/AskyourpdfAltsClient.tsx:165:            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-bold">2</span>
frontend/src/app/alternatives/askyourpdf/AskyourpdfAltsClient.tsx:191:              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-bold">3</span>
frontend/src/app/alternatives/askyourpdf/AskyourpdfAltsClient.tsx:217:            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-bold">4</span>
frontend/src/app/alternatives/askyourpdf/AskyourpdfAltsClient.tsx:243:              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-bold">5</span>
frontend/src/app/alternatives/askyourpdf/AskyourpdfAltsClient.tsx:269:            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-bold">6</span>
frontend/src/app/alternatives/askyourpdf/AskyourpdfAltsClient.tsx:292:              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-bold">7</span>
frontend/src/app/alternatives/humata/HumataAltsClient.tsx:66:              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-bold">1</span>
frontend/src/app/alternatives/humata/HumataAltsClient.tsx:111:            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-bold">2</span>
frontend/src/app/alternatives/humata/HumataAltsClient.tsx:131:              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-bold">3</span>
frontend/src/app/alternatives/humata/HumataAltsClient.tsx:151:            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-bold">4</span>
frontend/src/app/alternatives/humata/HumataAltsClient.tsx:171:              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-bold">5</span>
frontend/src/app/alternatives/pdf-ai/PdfAiAltsClient.tsx:116:              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-bold">1</span>
frontend/src/app/alternatives/pdf-ai/PdfAiAltsClient.tsx:166:            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-bold">2</span>
frontend/src/app/alternatives/pdf-ai/PdfAiAltsClient.tsx:192:              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-bold">3</span>
frontend/src/app/alternatives/pdf-ai/PdfAiAltsClient.tsx:218:            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-bold">4</span>
frontend/src/app/alternatives/pdf-ai/PdfAiAltsClient.tsx:244:              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-bold">5</span>
frontend/src/app/alternatives/pdf-ai/PdfAiAltsClient.tsx:270:            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-bold">6</span>
frontend/src/app/alternatives/pdf-ai/PdfAiAltsClient.tsx:293:              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-bold">7</span>

exec
/bin/zsh -lc "cd /Users/mayijie/Projects/Code/010_DocTalk && node - <<'NODE'
function hexToRgb(h){h=h.replace('#','');return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]}
function srgb(v){v/=255;return v<=0.03928? v/12.92: Math.pow((v+0.055)/1.055,2.4)}
function lum(hex){const [r,g,b]=hexToRgb(hex);return 0.2126*srgb(r)+0.7152*srgb(g)+0.0722*srgb(b)}
function contrast(a,b){const L1=Math.max(lum(a),lum(b));const L2=Math.min(lum(a),lum(b));return (L1+0.05)/(L2+0.05)}
const bg='#1c1b18';
const old='#818cf8';
const neu='#a8b3f5';
const hover='#c7d2fe';
const textDark='#09090b';
console.log('contrast old accent vs bg',contrast(old,bg).toFixed(2));
console.log('contrast new accent vs bg',contrast(neu,bg).toFixed(2));
console.log('contrast hover vs bg',contrast(hover,bg).toFixed(2));
console.log('contrast old accent text on dark fg?',contrast(old,textDark).toFixed(2));
console.log('contrast new accent text on dark fg?',contrast(neu,textDark).toFixed(2));
NODE" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
contrast old accent vs bg 5.77
contrast new accent vs bg 8.56
contrast hover vs bg 11.55
contrast old accent text on dark fg? 6.67
contrast new accent text on dark fg? 9.88

exec
/bin/zsh -lc "cd /Users/mayijie/Projects/Code/010_DocTalk && node - <<'NODE'
function hexToRgb(h){h=h.replace('#','');return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]}
function rgbToHsl(r,g,b){r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b);let h,s,l=(max+min)/2;
if(max===min){h=s=0;}else{const d=max-min;s=l>0.5?d/(2-max-min):d/(max+min);switch(max){case r:h=(g-b)/d+(g<b?6:0);break;case g:h=(b-r)/d+2;break;case b:h=(r-g)/d+4;break;}h*=60;}
return [h,s*100,l*100];}
for (const c of ['#a5b4fc','#a6b3f6','#a8b3f5','#818cf8']){const [r,g,b]=hexToRgb(c);const [h,s,l]=rgbToHsl(r,g,b);console.log(c, 'hsl',h.toFixed(1),s.toFixed(1)+'%',l.toFixed(1)+'%');}
NODE" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
#a5b4fc hsl 229.7 93.5% 81.8%
#a6b3f6 hsl 230.3 81.6% 80.8%
#a8b3f5 hsl 231.4 79.4% 81.0%
#818cf8 hsl 234.5 89.5% 73.9%

exec
/bin/zsh -lc "cd /Users/mayijie/Projects/Code/010_DocTalk && node - <<'NODE'
function hexToRgb(h){h=h.replace('#','');return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]}
function srgb(v){v/=255;return v<=0.03928? v/12.92: Math.pow((v+0.055)/1.055,2.4)}
function lum(hex){const [r,g,b]=hexToRgb(hex);return 0.2126*srgb(r)+0.7152*srgb(g)+0.0722*srgb(b)}
function contrast(a,b){const L1=Math.max(lum(a),lum(b));const L2=Math.min(lum(a),lum(b));return (L1+0.05)/(L2+0.05)}
const fg='#09090b';
for (const c of ['#4f46e5','#818cf8','#a8b3f5','#c7d2fe','#eef2ff']){
  console.log(c,'vs #09090b',contrast(c,fg).toFixed(2), 'vs #ffffff',contrast(c,'#ffffff').toFixed(2));
}
NODE" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
#4f46e5 vs #09090b 3.16 vs #ffffff 6.29
#818cf8 vs #09090b 6.67 vs #ffffff 2.98
#a8b3f5 vs #09090b 9.88 vs #ffffff 2.01
#c7d2fe vs #09090b 13.34 vs #ffffff 1.49
#eef2ff vs #09090b 17.79 vs #ffffff 1.12

exec
/bin/zsh -lc 'cd /Users/mayijie/Projects/Code/010_DocTalk && git diff --stat' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
 frontend/src/app/globals.css                    | 43 +++++++++--
 frontend/src/app/profile/ProfilePageClient.tsx  | 96 +++++++++++++++----------
 frontend/src/components/PrivacyBadge.tsx        | 67 ++++++++---------
 frontend/src/components/Profile/ProfileTabs.tsx | 92 ++++++++++++++++--------
 frontend/src/i18n/locales/ar.json               |  2 +-
 frontend/src/i18n/locales/de.json               |  2 +-
 frontend/src/i18n/locales/en.json               |  5 ++
 frontend/src/i18n/locales/es.json               |  2 +-
 frontend/src/i18n/locales/fr.json               |  2 +-
 frontend/src/i18n/locales/hi.json               |  2 +-
 frontend/src/i18n/locales/it.json               |  2 +-
 frontend/src/i18n/locales/ja.json               |  2 +-
 frontend/src/i18n/locales/ko.json               |  2 +-
 frontend/src/i18n/locales/pt.json               |  2 +-
 frontend/src/i18n/locales/zh.json               |  3 +
 frontend/tailwind.config.ts                     |  5 ++
 16 files changed, 211 insertions(+), 118 deletions(-)

exec
/bin/zsh -lc "cd /Users/mayijie/Projects/Code/010_DocTalk && git diff -- frontend/src/i18n/locales/en.json | sed -n '1,220p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
diff --git a/frontend/src/i18n/locales/en.json b/frontend/src/i18n/locales/en.json
index d536f85..7084ba5 100644
--- a/frontend/src/i18n/locales/en.json
+++ b/frontend/src/i18n/locales/en.json
@@ -87,6 +87,8 @@
   "privacy.noTraining": "We never use your data for model training",
   "privacy.encrypted": "TLS encrypted in transit, AES-256 at rest",
   "privacy.deleteAnytime": "Delete your data anytime",
+  "privacy.deleteFast": "Delete in <60s",
+  "privacy.trustLink": "Trust Center",
   "privacy.policyLink": "Privacy Policy",
   "privacy.termsLink": "Terms",
   "home.cta.demoNow": "Try Example PDF Now",
@@ -195,6 +197,9 @@
   "profile.tabs.credits": "Credits",
   "profile.tabs.usage": "Usage",
   "profile.tabs.account": "Account",
+  "profile.tabs.notifications": "Notifications",
+  "profile.notifications.title": "Notifications",
+  "profile.notifications.empty": "Email notifications and product updates are coming soon.",
   "profile.info.memberSince": "Member for {days} days",
   "profile.info.connectedWith": "Connected with {provider}",
   "profile.plan.free": "Free",

exec
/bin/zsh -lc "cd /Users/mayijie/Projects/Code/010_DocTalk && git diff -- frontend/src/i18n/locales/zh.json | sed -n '1,220p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
diff --git a/frontend/src/i18n/locales/zh.json b/frontend/src/i18n/locales/zh.json
index e1d744d..ee1501b 100644
--- a/frontend/src/i18n/locales/zh.json
+++ b/frontend/src/i18n/locales/zh.json
@@ -195,6 +195,9 @@
   "profile.tabs.credits": "额度",
   "profile.tabs.usage": "用量",
   "profile.tabs.account": "账户",
+  "profile.tabs.notifications": "通知",
+  "profile.notifications.title": "通知",
+  "profile.notifications.empty": "邮件通知和产品更新即将上线。",
   "profile.info.memberSince": "已加入 {days} 天",
   "profile.info.connectedWith": "已通过 {provider} 连接",
   "profile.plan.free": "免费",

exec
/bin/zsh -lc "cd /Users/mayijie/Projects/Code/010_DocTalk && git diff -- frontend/src/i18n/locales/ar.json frontend/src/i18n/locales/de.json frontend/src/i18n/locales/es.json frontend/src/i18n/locales/fr.json frontend/src/i18n/locales/hi.json frontend/src/i18n/locales/it.json frontend/src/i18n/locales/ja.json frontend/src/i18n/locales/ko.json frontend/src/i18n/locales/pt.json | sed -n '1,320p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
diff --git a/frontend/src/i18n/locales/ar.json b/frontend/src/i18n/locales/ar.json
index eb45d30..1bdecb5 100644
--- a/frontend/src/i18n/locales/ar.json
+++ b/frontend/src/i18n/locales/ar.json
@@ -886,7 +886,7 @@
   "useCasesLawyers.faq.q3.question": "How accurate is AI for legal analysis?",
   "useCasesLawyers.faq.q3.answer": "DocTalk uses Retrieval-Augmented Generation (RAG) to base every answer on the actual text of your document. Every answer includes numbered citations so you can verify each claim. DocTalk is a research acceleration tool, not a substitute for legal judgment.",
   "useCasesLawyers.faq.q4.question": "Does it work with scanned PDFs?",
-  "useCasesLawyers.faq.q4.answer": "DocTalk works best with text-based PDFs where the text layer is preserved. Most modern legal documents produce text-based PDFs. Scanned image-only PDFs without OCR may have limited text extraction.",
+  "useCasesLawyers.faq.q4.answer": "يعمل DocTalk بشكل أفضل مع ملفات PDF النصية التي تحافظ على طبقة النص. بالنسبة لملفات PDF الممسوحة ضوئيًا أو التي تحتوي على صور فقط، يقوم DocTalk تلقائيًا بتشغيل التعرف البصري على الحروف (OCR) باستخدام Tesseract (الإنجليزية + الصينية المبسطة) لاستخراج النص. تختلف جودة OCR حسب دقة المسح وتخطيط الصفحة — بالنسبة للعمل القانوني الذي يتطلب دقة عالية، تظل ملفات PDF النصية المصدر الأكثر موثوقية.",
   "useCasesLawyers.faq.q5.question": "Is there a team plan?",
   "useCasesLawyers.faq.q5.answer": "DocTalk currently offers individual plans: Free (500 credits/month), Plus ($9.99/month for 3,000 credits), and Pro ($19.99/month for 9,000 credits). Team and enterprise plans are on the roadmap.",
   "useCasesLawyers.cta.title": "Start Reviewing Documents — Free, No Signup",
diff --git a/frontend/src/i18n/locales/de.json b/frontend/src/i18n/locales/de.json
index 34fd013..1a952c5 100644
--- a/frontend/src/i18n/locales/de.json
+++ b/frontend/src/i18n/locales/de.json
@@ -886,7 +886,7 @@
   "useCasesLawyers.faq.q3.question": "Wie genau ist KI für juristische Analyse?",
   "useCasesLawyers.faq.q3.answer": "DocTalk verwendet Retrieval-Augmented Generation (RAG), um jede Antwort auf dem tatsächlichen Text Ihres Dokuments zu basieren. Jede Antwort enthält nummerierte Zitate, damit Sie jede Behauptung überprüfen können. DocTalk ist ein Forschungsbeschleunigungstool, kein Ersatz für juristisches Urteil.",
   "useCasesLawyers.faq.q4.question": "Funktioniert es mit gescannten PDFs?",
-  "useCasesLawyers.faq.q4.answer": "DocTalk funktioniert am besten mit textbasierten PDFs, bei denen die Textschicht erhalten ist. Die meisten modernen juristischen Dokumente erzeugen textbasierte PDFs. Gescannte Bild-PDFs ohne OCR können eine eingeschränkte Textextraktion haben.",
+  "useCasesLawyers.faq.q4.answer": "DocTalk funktioniert am besten mit textbasierten PDFs, bei denen die Textschicht erhalten ist. Für gescannte oder reine Bild-PDFs führt DocTalk automatisch OCR mit Tesseract (Englisch + vereinfachtes Chinesisch) aus, um Text zu extrahieren. Die OCR-Qualität hängt von Scan-Auflösung und Seitenlayout ab — für juristische Arbeit mit hoher Genauigkeitsanforderung bleiben textbasierte PDFs die zuverlässigste Quelle.",
   "useCasesLawyers.faq.q5.question": "Gibt es einen Team-Plan?",
   "useCasesLawyers.faq.q5.answer": "DocTalk bietet derzeit Einzelpläne: Kostenlos (500 Credits/Monat), Plus ($9.99/Monat für 3.000 Credits) und Pro ($19.99/Monat für 9.000 Credits). Team- und Enterprise-Pläne sind in der Roadmap.",
   "useCasesLawyers.cta.title": "Jetzt Dokumente überprüfen — kostenlos, ohne Anmeldung",
diff --git a/frontend/src/i18n/locales/es.json b/frontend/src/i18n/locales/es.json
index e4fa8b7..d210b55 100644
--- a/frontend/src/i18n/locales/es.json
+++ b/frontend/src/i18n/locales/es.json
@@ -886,7 +886,7 @@
   "useCasesLawyers.faq.q3.question": "How accurate is AI for legal analysis?",
   "useCasesLawyers.faq.q3.answer": "DocTalk uses Retrieval-Augmented Generation (RAG) to base every answer on the actual text of your document. Every answer includes numbered citations so you can verify each claim. DocTalk is a research acceleration tool, not a substitute for legal judgment.",
   "useCasesLawyers.faq.q4.question": "Does it work with scanned PDFs?",
-  "useCasesLawyers.faq.q4.answer": "DocTalk works best with text-based PDFs where the text layer is preserved. Most modern legal documents produce text-based PDFs. Scanned image-only PDFs without OCR may have limited text extraction.",
+  "useCasesLawyers.faq.q4.answer": "DocTalk funciona mejor con PDF de texto donde se conserva la capa textual. Para PDF escaneados o solo de imagen, DocTalk ejecuta automáticamente OCR con Tesseract (inglés + chino simplificado) para extraer texto. La calidad del OCR varía según la resolución del escaneo y el diseño de página — para trabajos jurídicos que requieren alta fidelidad, los PDF de texto siguen siendo la fuente más fiable.",
   "useCasesLawyers.faq.q5.question": "Is there a team plan?",
   "useCasesLawyers.faq.q5.answer": "DocTalk currently offers individual plans: Free (500 credits/month), Plus ($9.99/month for 3,000 credits), and Pro ($19.99/month for 9,000 credits). Team and enterprise plans are on the roadmap.",
   "useCasesLawyers.cta.title": "Start Reviewing Documents — Free, No Signup",
diff --git a/frontend/src/i18n/locales/fr.json b/frontend/src/i18n/locales/fr.json
index 9412ea8..5090d45 100644
--- a/frontend/src/i18n/locales/fr.json
+++ b/frontend/src/i18n/locales/fr.json
@@ -886,7 +886,7 @@
   "useCasesLawyers.faq.q3.question": "Quelle est la précision de l'IA pour l'analyse juridique ?",
   "useCasesLawyers.faq.q3.answer": "DocTalk utilise la génération augmentée par récupération (RAG) pour baser chaque réponse sur le texte réel de votre document. Chaque affirmation est accompagnée d'une citation vérifiable.",
   "useCasesLawyers.faq.q4.question": "Fonctionne-t-il avec les PDF numérisés ?",
-  "useCasesLawyers.faq.q4.answer": "DocTalk fonctionne mieux avec les PDF texte où la couche de texte est préservée. La plupart des documents juridiques modernes sont des PDF texte natifs.",
+  "useCasesLawyers.faq.q4.answer": "DocTalk fonctionne mieux avec les PDF texte où la couche de texte est préservée. Pour les PDF scannés ou uniquement images, DocTalk exécute automatiquement l'OCR via Tesseract (anglais + chinois simplifié) pour extraire le texte. La qualité de l'OCR varie selon la résolution du scan et la mise en page — pour un travail juridique exigeant une haute fidélité, les PDF texte restent la source la plus fiable.",
   "useCasesLawyers.faq.q5.question": "Y a-t-il un plan équipe ?",
   "useCasesLawyers.faq.q5.answer": "DocTalk propose actuellement des plans individuels : Gratuit (500 crédits/mois), Plus ($9.99/mois pour 3 000 crédits) et Pro ($19.99/mois pour 9 000 crédits).",
   "useCasesLawyers.cta.title": "Commencez la révision documentaire — Gratuit, sans inscription",
diff --git a/frontend/src/i18n/locales/hi.json b/frontend/src/i18n/locales/hi.json
index 82d67da..df759a1 100644
--- a/frontend/src/i18n/locales/hi.json
+++ b/frontend/src/i18n/locales/hi.json
@@ -886,7 +886,7 @@
   "useCasesLawyers.faq.q3.question": "How accurate is AI for legal analysis?",
   "useCasesLawyers.faq.q3.answer": "DocTalk uses Retrieval-Augmented Generation (RAG) to base every answer on the actual text of your document. Every answer includes numbered citations so you can verify each claim. DocTalk is a research acceleration tool, not a substitute for legal judgment.",
   "useCasesLawyers.faq.q4.question": "Does it work with scanned PDFs?",
-  "useCasesLawyers.faq.q4.answer": "DocTalk works best with text-based PDFs where the text layer is preserved. Most modern legal documents produce text-based PDFs. Scanned image-only PDFs without OCR may have limited text extraction.",
+  "useCasesLawyers.faq.q4.answer": "DocTalk टेक्स्ट-आधारित PDF के साथ सबसे बेहतर काम करता है जहाँ टेक्स्ट लेयर सुरक्षित रहती है। स्कैन किए गए या केवल-छवि वाले PDF के लिए, DocTalk Tesseract (अंग्रेज़ी + सरलीकृत चीनी) का उपयोग करके स्वचालित रूप से OCR चलाता है और टेक्स्ट निकालता है। OCR गुणवत्ता स्कैन रिज़ॉल्यूशन और पेज लेआउट के अनुसार बदलती है — उच्च सटीकता वाले कानूनी काम के लिए, टेक्स्ट-आधारित PDF ही सबसे विश्वसनीय स्रोत हैं।",
   "useCasesLawyers.faq.q5.question": "Is there a team plan?",
   "useCasesLawyers.faq.q5.answer": "DocTalk currently offers individual plans: Free (500 credits/month), Plus ($9.99/month for 3,000 credits), and Pro ($19.99/month for 9,000 credits). Team and enterprise plans are on the roadmap.",
   "useCasesLawyers.cta.title": "Start Reviewing Documents — Free, No Signup",
diff --git a/frontend/src/i18n/locales/it.json b/frontend/src/i18n/locales/it.json
index 0755350..7159942 100644
--- a/frontend/src/i18n/locales/it.json
+++ b/frontend/src/i18n/locales/it.json
@@ -886,7 +886,7 @@
   "useCasesLawyers.faq.q3.question": "How accurate is AI for legal analysis?",
   "useCasesLawyers.faq.q3.answer": "DocTalk uses Retrieval-Augmented Generation (RAG) to base every answer on the actual text of your document. Every answer includes numbered citations so you can verify each claim. DocTalk is a research acceleration tool, not a substitute for legal judgment.",
   "useCasesLawyers.faq.q4.question": "Does it work with scanned PDFs?",
-  "useCasesLawyers.faq.q4.answer": "DocTalk works best with text-based PDFs where the text layer is preserved. Most modern legal documents produce text-based PDFs. Scanned image-only PDFs without OCR may have limited text extraction.",
+  "useCasesLawyers.faq.q4.answer": "DocTalk funziona meglio con PDF testuali in cui il livello di testo è preservato. Per PDF scansionati o solo immagine, DocTalk esegue automaticamente l'OCR tramite Tesseract (inglese + cinese semplificato) per estrarre il testo. La qualità dell'OCR varia in base alla risoluzione della scansione e all'impaginazione — per il lavoro legale che richiede alta fedeltà, i PDF testuali restano la fonte più affidabile.",
   "useCasesLawyers.faq.q5.question": "Is there a team plan?",
   "useCasesLawyers.faq.q5.answer": "DocTalk currently offers individual plans: Free (500 credits/month), Plus ($9.99/month for 3,000 credits), and Pro ($19.99/month for 9,000 credits). Team and enterprise plans are on the roadmap.",
   "useCasesLawyers.cta.title": "Start Reviewing Documents — Free, No Signup",
diff --git a/frontend/src/i18n/locales/ja.json b/frontend/src/i18n/locales/ja.json
index abe699c..79a7893 100644
--- a/frontend/src/i18n/locales/ja.json
+++ b/frontend/src/i18n/locales/ja.json
@@ -886,7 +886,7 @@
   "useCasesLawyers.faq.q3.question": "How accurate is AI for legal analysis?",
   "useCasesLawyers.faq.q3.answer": "DocTalk uses Retrieval-Augmented Generation (RAG) to base every answer on the actual text of your document. Every answer includes numbered citations so you can verify each claim. DocTalk is a research acceleration tool, not a substitute for legal judgment.",
   "useCasesLawyers.faq.q4.question": "Does it work with scanned PDFs?",
-  "useCasesLawyers.faq.q4.answer": "DocTalk works best with text-based PDFs where the text layer is preserved. Most modern legal documents produce text-based PDFs. Scanned image-only PDFs without OCR may have limited text extraction.",
+  "useCasesLawyers.faq.q4.answer": "DocTalk はテキスト層が保持されたテキスト型 PDF で最も高い性能を発揮します。スキャンされた PDF や画像のみの PDF に対しては、DocTalk が Tesseract（英語 + 簡体字中国語）で自動的に OCR を実行し、テキストを抽出します。OCR の品質はスキャン解像度やページレイアウトによって変動します — 高い正確性が求められる法務業務では、テキスト型 PDF が引き続き最も信頼できるソースです。",
   "useCasesLawyers.faq.q5.question": "Is there a team plan?",
   "useCasesLawyers.faq.q5.answer": "DocTalk currently offers individual plans: Free (500 credits/month), Plus ($9.99/month for 3,000 credits), and Pro ($19.99/month for 9,000 credits). Team and enterprise plans are on the roadmap.",
   "useCasesLawyers.cta.title": "Start Reviewing Documents — Free, No Signup",
diff --git a/frontend/src/i18n/locales/ko.json b/frontend/src/i18n/locales/ko.json
index adcfc2d..25da0a6 100644
--- a/frontend/src/i18n/locales/ko.json
+++ b/frontend/src/i18n/locales/ko.json
@@ -886,7 +886,7 @@
   "useCasesLawyers.faq.q3.question": "How accurate is AI for legal analysis?",
   "useCasesLawyers.faq.q3.answer": "DocTalk uses Retrieval-Augmented Generation (RAG) to base every answer on the actual text of your document. Every answer includes numbered citations so you can verify each claim. DocTalk is a research acceleration tool, not a substitute for legal judgment.",
   "useCasesLawyers.faq.q4.question": "Does it work with scanned PDFs?",
-  "useCasesLawyers.faq.q4.answer": "DocTalk works best with text-based PDFs where the text layer is preserved. Most modern legal documents produce text-based PDFs. Scanned image-only PDFs without OCR may have limited text extraction.",
+  "useCasesLawyers.faq.q4.answer": "DocTalk는 텍스트 레이어가 보존된 텍스트 기반 PDF에서 가장 잘 작동합니다. 스캔된 PDF나 이미지 전용 PDF의 경우, DocTalk가 Tesseract(영어 + 중국어 간체)를 사용해 자동으로 OCR을 실행하여 텍스트를 추출합니다. OCR 품질은 스캔 해상도와 페이지 레이아웃에 따라 달라집니다 — 높은 정확도가 필요한 법률 업무에서는 텍스트 기반 PDF가 여전히 가장 신뢰할 수 있는 소스입니다.",
   "useCasesLawyers.faq.q5.question": "Is there a team plan?",
   "useCasesLawyers.faq.q5.answer": "DocTalk currently offers individual plans: Free (500 credits/month), Plus ($9.99/month for 3,000 credits), and Pro ($19.99/month for 9,000 credits). Team and enterprise plans are on the roadmap.",
   "useCasesLawyers.cta.title": "Start Reviewing Documents — Free, No Signup",
diff --git a/frontend/src/i18n/locales/pt.json b/frontend/src/i18n/locales/pt.json
index 1da2dbf..7ff97ff 100644
--- a/frontend/src/i18n/locales/pt.json
+++ b/frontend/src/i18n/locales/pt.json
@@ -1961,7 +1961,7 @@
   "useCasesLawyers.faq.q2.question": "Can it analyze contracts?",
   "useCasesLawyers.faq.q3.answer": "O DocTalk usa Geração Aumentada por Recuperação (RAG) to base every answer on the actual text of your document. Every answer includes numbered citations so you can verify each claim. O DocTalk é a research acceleration tool, not a substitute for legal judgment.",
   "useCasesLawyers.faq.q3.question": "How accurate is AI for legal analysis?",
-  "useCasesLawyers.faq.q4.answer": "DocTalk works best with text-based PDFs where the text layer is preserved. Most modern legal documents produce text-based PDFs. Scanned image-only PDFs without OCR may have limited text extraction.",
+  "useCasesLawyers.faq.q4.answer": "O DocTalk funciona melhor com PDFs textuais em que a camada de texto é preservada. Para PDFs digitalizados ou somente imagem, o DocTalk executa OCR automaticamente com Tesseract (inglês + chinês simplificado) para extrair texto. A qualidade do OCR varia conforme a resolução da digitalização e o layout da página — para trabalho jurídico que exige alta fidelidade, PDFs textuais continuam sendo a fonte mais confiável.",
   "useCasesLawyers.faq.q4.question": "Does it work with scanned PDFs?",
   "useCasesLawyers.faq.q5.answer": "DocTalk currently offers individual plans: Free (500 credits/month), Plus ($9.99/month for 3,000 credits), and Pro ($19.99/month for 9,000 credits). Team and enterprise plans are on the roadmap.",
   "useCasesLawyers.faq.q5.question": "Is there a team plan?",

exec
/bin/zsh -lc "cd /Users/mayijie/Projects/Code/010_DocTalk && rg -n \"font-bold\" frontend/src -g '*.tsx' | wc -l" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
      47

codex
**Findings (按严重度)**
1. **High — 安全承诺与实现不完全一致（SSE-S3）**  
   `PrivacyBadge` 和 `/trust` 都是“强保证”措辞，但后端在 `SSE-S3` 失败时会回退到无加密上传。  
   参考: [PrivacyBadge.tsx:20](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/PrivacyBadge.tsx:20), [TrustPageClient.tsx:45](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/trust/TrustPageClient.tsx:45), [storage_service.py:88](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/storage_service.py:88), [storage_service.py:103](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/storage_service.py:103)

2. **High — `Delete in <60s` 目前无代码级 SLA 支撑**  
   删除接口返回 `202`，且失败清理会走 30/60/120s 重试，明显可能超过 60s。  
   参考: [PrivacyBadge.tsx:28](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/PrivacyBadge.tsx:28), [documents.py:503](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/documents.py:503), [deletion_worker.py:22](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/workers/deletion_worker.py:22)

3. **Medium — i18n 回归**  
   Badge 前两条是硬编码英文；且 `zh` 没有新增 `privacy.deleteFast/privacy.trustLink`，现在会走英文 fallback。  
   参考: [PrivacyBadge.tsx:20](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/PrivacyBadge.tsx:20), [PrivacyBadge.tsx:24](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/PrivacyBadge.tsx:24), [PrivacyBadge.tsx:28](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/PrivacyBadge.tsx:28), [en.json:90](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/i18n/locales/en.json:90), [zh.json:86](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/i18n/locales/zh.json:86)

4. **Medium — `.dark .font-bold { font-weight: 600 }` 影响面过大**  
   这是全局降级，会命中大量非正文强调位（数字徽标、CTA 标题等）。  
   参考: [globals.css:63](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/globals.css:63), [CTABanner.tsx:22](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/seo/CTABanner.tsx:22), [BillingPageClient.tsx:377](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/billing/BillingPageClient.tsx:377)

5. **Medium — `OpenRouter zero-retention` 是文案承诺，不是代码可验证约束**  
   目前调用层只设置 `HTTP-Referer/X-Title`，未见 retention/provider 约束参数。  
   参考: [PrivacyBadge.tsx:24](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/PrivacyBadge.tsx:24), [TrustPageClient.tsx:58](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/trust/TrustPageClient.tsx:58), [chat_service.py:62](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py:62), [chat_service.py:485](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py:485)

**逐条答复（Q1-Q14）**
1. 目前不够硬：`AES-256(SSE-S3)`、`<60s`、`zero-retention` 都建议降级为“best effort/默认配置”措辞，或先补代码与监控证据。  
2. `md:hidden` + `hidden md:flex` 在 640~768 不会双显/双隐，断点逻辑正确。  
3. 你给的 `#a8b3f5` 可接受；对 `#1c1b18` 对比度从约 **5.77**（旧 `#818cf8`）升到 **8.56**，可读性是提升不是下降。  
4. 会误伤，建议只作用于 `h1-h6` / `.prose`，不要全局改 `.font-bold`。  
5. 9 个 OCR 翻译总体可用，无明显错译；阿语可做母语润色但不阻塞。  
6. 360px 下会换行但不应垮；视觉上是“多行徽章”，功能无问题。  
7. `220px + max-w-5xl` 在 1280 屏观感是平衡的；200 只是风格更紧凑，不是必须改。  
8. 建议加一个 disabled 的“Email me when available”占位按钮，可信感会更强。  
9. `indigo` focus ring 不会造成功能回归，但与现有大量 `zinc` ring 有一致性偏差。  
10. Tailwind `surface: {1,2,3}` 没问题，`bg-surface-1/2/3` 可正常生成。  
11. `--accent-light` light 用 hex、dark 用 rgba 在 CSS 变量层面合法，不是问题。  
12. `/profile` +1.2kB 可接受；在 9.78kB 级别里收益/成本比是正向的。  
13. 我看到的主要回归就是上面 1/2/3/4/5；另外 `tab` 语义本来就不完整（无 `aria-controls/tabpanel`），这次未恶化但仍是待补点。  
14. 建议拆 **3 个 commit**（A/C/D+i18n），更利于回滚和 bisect；最终上 PR 可 squash 成 1 个也行。

我这轮只做了静态审阅和代码核对，未重新跑构建/浏览器 golden path。
tokens used
109,266
**Findings (按严重度)**
1. **High — 安全承诺与实现不完全一致（SSE-S3）**  
   `PrivacyBadge` 和 `/trust` 都是“强保证”措辞，但后端在 `SSE-S3` 失败时会回退到无加密上传。  
   参考: [PrivacyBadge.tsx:20](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/PrivacyBadge.tsx:20), [TrustPageClient.tsx:45](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/trust/TrustPageClient.tsx:45), [storage_service.py:88](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/storage_service.py:88), [storage_service.py:103](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/storage_service.py:103)

2. **High — `Delete in <60s` 目前无代码级 SLA 支撑**  
   删除接口返回 `202`，且失败清理会走 30/60/120s 重试，明显可能超过 60s。  
   参考: [PrivacyBadge.tsx:28](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/PrivacyBadge.tsx:28), [documents.py:503](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/documents.py:503), [deletion_worker.py:22](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/workers/deletion_worker.py:22)

3. **Medium — i18n 回归**  
   Badge 前两条是硬编码英文；且 `zh` 没有新增 `privacy.deleteFast/privacy.trustLink`，现在会走英文 fallback。  
   参考: [PrivacyBadge.tsx:20](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/PrivacyBadge.tsx:20), [PrivacyBadge.tsx:24](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/PrivacyBadge.tsx:24), [PrivacyBadge.tsx:28](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/PrivacyBadge.tsx:28), [en.json:90](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/i18n/locales/en.json:90), [zh.json:86](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/i18n/locales/zh.json:86)

4. **Medium — `.dark .font-bold { font-weight: 600 }` 影响面过大**  
   这是全局降级，会命中大量非正文强调位（数字徽标、CTA 标题等）。  
   参考: [globals.css:63](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/globals.css:63), [CTABanner.tsx:22](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/seo/CTABanner.tsx:22), [BillingPageClient.tsx:377](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/billing/BillingPageClient.tsx:377)

5. **Medium — `OpenRouter zero-retention` 是文案承诺，不是代码可验证约束**  
   目前调用层只设置 `HTTP-Referer/X-Title`，未见 retention/provider 约束参数。  
   参考: [PrivacyBadge.tsx:24](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/PrivacyBadge.tsx:24), [TrustPageClient.tsx:58](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/trust/TrustPageClient.tsx:58), [chat_service.py:62](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py:62), [chat_service.py:485](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py:485)

**逐条答复（Q1-Q14）**
1. 目前不够硬：`AES-256(SSE-S3)`、`<60s`、`zero-retention` 都建议降级为“best effort/默认配置”措辞，或先补代码与监控证据。  
2. `md:hidden` + `hidden md:flex` 在 640~768 不会双显/双隐，断点逻辑正确。  
3. 你给的 `#a8b3f5` 可接受；对 `#1c1b18` 对比度从约 **5.77**（旧 `#818cf8`）升到 **8.56**，可读性是提升不是下降。  
4. 会误伤，建议只作用于 `h1-h6` / `.prose`，不要全局改 `.font-bold`。  
5. 9 个 OCR 翻译总体可用，无明显错译；阿语可做母语润色但不阻塞。  
6. 360px 下会换行但不应垮；视觉上是“多行徽章”，功能无问题。  
7. `220px + max-w-5xl` 在 1280 屏观感是平衡的；200 只是风格更紧凑，不是必须改。  
8. 建议加一个 disabled 的“Email me when available”占位按钮，可信感会更强。  
9. `indigo` focus ring 不会造成功能回归，但与现有大量 `zinc` ring 有一致性偏差。  
10. Tailwind `surface: {1,2,3}` 没问题，`bg-surface-1/2/3` 可正常生成。  
11. `--accent-light` light 用 hex、dark 用 rgba 在 CSS 变量层面合法，不是问题。  
12. `/profile` +1.2kB 可接受；在 9.78kB 级别里收益/成本比是正向的。  
13. 我看到的主要回归就是上面 1/2/3/4/5；另外 `tab` 语义本来就不完整（无 `aria-controls/tabpanel`），这次未恶化但仍是待补点。  
14. 建议拆 **3 个 commit**（A/C/D+i18n），更利于回滚和 bisect；最终上 PR 可 squash 成 1 个也行。

我这轮只做了静态审阅和代码核对，未重新跑构建/浏览器 golden path。
