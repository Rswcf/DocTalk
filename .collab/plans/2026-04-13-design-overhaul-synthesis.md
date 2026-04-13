# 设计升级综合方案 — 30-subagent 调研合成

**日期**：2026-04-13
**输入**：30 个并行 subagent 调研（Notion / Linear / Stripe / Vercel / Perplexity / NotebookLM / Claude+ChatGPT / Documenso / 8 个组件模式 / 6 个视觉美学 / 4 个 feature 设计 / 4 个品牌差异化）
**目标**：从"P1+P2+P3 后仍像 AI 模板"升级到"有设计感、符合产品调性"

---

## 1. 30 报告的共识主线（按出现频次排）

| # | 主题 | 报告数 | 核心结论 |
|---|------|------|---------|
| 1 | **Indigo `#4f46e5` 是"通用 AI"标记** | 8 | 立刻警示信号；不需换 brand color，但需"warm-tint 处理"或换 accent |
| 2 | **真实产品工件 > 抽象 gradient** | 7 | hero 应展示一个具体的"文档+引用"artifact，不是 ShowcasePlayer 包装的 video |
| 3 | **Citation 是 DocTalk 最强但展示弱** | 7 | 当前 [N] pill 缺 file-type / page locator；应"sources strip first" (Perplexity) |
| 4 | **Sora 弱差异化** | 5 | font-display = Sora 跟 Inter 区别太小；Inter Display 或 Instrument Serif 更值 |
| 5 | **3-card FeatureGrid 是 AI 模板标志** | 5 | DocTalk 实有 6 features，3-card 强制隐一半，bento 是正解 |
| 6 | **Empty state 是首跑活化机会** | 4 | 自动 seed 3 demo PDF 到新账户 (Linear/Granola pattern)，避免空 app |
| 7 | **Trust signal 用具体数字 + 命名方** | 4 | "AES-256" 是generic；"AES-256 (SSE-S3) · OpenRouter zero-retention" 才有信号 |
| 8 | **Tabs → Sidebar at md+** | 3 | profile 4 tab → 侧边栏，扩展到 5+ section 也不破 |
| 9 | **Dark mode 是"为黑设计"不是"反色"** | 3 | 加 3 层 surface elevation token，dark 字体减重 |
| 10 | **品牌缺 signature glyph** | 3 | DocTalk = doc + talk，speech-bubble-inside-page motif 是天然解 |

---

## 2. Tier 1 — 最高 visible/conversion ROI（Claude 1-2 day 独立可做）

### T1.A — 配色"warm-tint" + 引入 signature accent 选项
**问题**：indigo `#4f46e5` 是 2024 SaaS 模板默认值，被 8 个报告点名"generic AI tell"
**做法**：
- 不换全局 indigo（risk too high），而是引入新 CSS var `--surface-canvas`（暖灰 `#FAFAF7` light / `#1C1B18` dark），替代当前冷调 white
- 第二选项（Codex 决策）：accent 加暖色补充，如 `--accent-warm: #C96442`（Claude 的 clay）作为 highlight color，indigo 仍保留为 brand
**ROI**：高，2-4h
**风险**：低，纯 token 层；若不喜欢可快速 revert

### T1.B — Hero artifact 替换：真实"document + chat + citation" mock
**问题**：当前 hero 用 ShowcasePlayer + macOS chrome，是"录像演示"框；7 个报告说 hero 应**直接展示产品成果**而不是"演示视频框"
**做法**：
- 删除 ShowcasePlayer 包装的 macOS chrome wrapper
- 替换为一个**手工组装的 React 组件**：
  - 左边：一段 PDF 页面 mock（带黄色高亮"Q4 net revenue grew 13% YoY"）
  - 右边：chat reply mock，"Q4 net revenue rose 13% [1]"，[1] 是 pill，箭头连到高亮
  - 整体 `rotate-[-2deg]` + `shadow-2xl`
- ShowcasePlayer 移到下方独立 section（保留视频但不抢 hero 焦点）
**ROI**：极高，1 day（用现有 MessageBubble + 截图自制）
**风险**：中，需要好看的截图/mockup

### T1.C — CTA 文案重写
**问题**："Try the free demo" 弱 — "demo" 暗示评估摩擦不是承诺；多个报告引用 A/B 数据
**做法**：
- `landing.cta.demo` → "Start reading smarter" 或 "Upload your first doc"（en）
- `hero.signUpFree` 保留作 secondary text link
- 11 locale 同步翻译（用 tOr fallback 避免阻塞）
**ROI**：极高，0.5h
**风险**：零

### T1.D — Citation pill 信息升级
**问题**：当前 `[1]` 是裸数字；7 报告说应带 file-type + page locator
**做法**：
- `CitationPopover.tsx` 改 pill 为 `[PDF p.4 · 1]` / `[DOCX §2.1 · 2]` / `[XLSX Sheet1!B12 · 3]`
- 8+ citation 自动收 "+N more" chip
**ROI**：高，1 day
**风险**：低

### T1.E — 新户自动 seed 3 demo PDFs
**问题**：20 testers 2 active — onboarding cliff 在"signup → 空 app → 上传 → 等 parse"。Linear/Granola pattern 是 seed sample data
**做法**：
- 后端：注册时 hook 把 3 个 demo PDF (alphabet-earnings / attention-paper / court-filing) 复制到新用户 library，标记 "Sample" badge
- 前端：HomePageClient empty state 不再空，用户登入即看到 3 个文档
- 用户可删除（不强制保留）
**ROI**：极高（activation 是当前最大瓶颈）
**风险**：中，要测 backend logic + user_id isolation 不能破

---

## 3. Tier 2 — 身份/差异化（1-3 day 累计）

### T2.A — 字体角色重塑
- 删 Sora 的 `font-display`（已删大部分）；保留 `font-logo` 仅给 wordmark
- 引入 **Inter Display**（Google fonts subset）替代 H1-H3 的 Inter（视觉差异大）
- Marketing H1 试用 **Instrument Serif**（SIL OFL 免费）— 单页测试

### T2.B — FeatureGrid → Bento 6-tile
- DocTalk 实际 6 features：precise citations / multi-format / multi-language / demo no-signup / Quick/Balanced/Thorough modes / share links
- 改 4×3 asymmetric CSS grid，"precise citations" 占 2×2 大块
- 复用现有 bespoke visuals + 加 3 张新 mock

### T2.C — 单调 mono 编号 + section labels
- HomePageClient 每 section 上加 `01 — HOW IT WORKS` mono 小标签
- FAQ "Q.01" mono prefix
- 不需要新字体（可暂用 system mono / 加 JetBrains Mono）

### T2.D — Sources strip-before-answer (Perplexity pattern)
- `MessageBubble.tsx` 在 answer text **之前** 渲染水平 source chips
- 一旦 retrieval 完成立刻显示，answer 流式时 sources 已可见
- 强化"我们 cite 的"差异化

### T2.E — Brand signature: speech-bubble-in-page glyph
- 简单 SVG: 文档轮廓（折角）+ 聊天气泡尾巴在右下
- 用作 favicon、loader、404、footer bug、hero 装饰
- 1-2h Figma + Claude 写 SVG

---

## 4. Tier 3 — 深度/可信度（1-2 day 累计）

### T3.A — Trust 升级
- `PrivacyBadge` 去 accordion，always-visible inline 3 行
- 加 provider name：`AES-256 (SSE-S3) · OpenRouter zero-retention · Delete in <60s`
- 新建 `/trust` 页（一页：列真实控制 - SSE-S3 / SSRF protection / magic-byte validation / GDPR / 删除策略）
- Footer 加 Trust Center link

### T3.B — Footer 重构（Plain-style）
- 4 cols：Product / Resources / Company / Legal
- Copyright 加 legal entity (if exists)
- 加 status dot link (UptimeRobot 免费 ping `/health`)
- Language switcher 移到 footer（释放 header 空间）

### T3.C — Profile tabs → Sidebar (md+)
- `grid-cols-[220px_1fr]` 布局，sidebar sticky
- 加 stub 5th section（Notifications）显示扩展性
- mobile 保留 tabs

### T3.D — Dark mode surface elevation
- 加 `--surface-1/2/3` token（zinc-950 / zinc-900 / zinc-800）
- 替换 ad-hoc `dark:bg-zinc-900`
- dark 模式 H 字重降一档

### T3.E — Streaming "Thinking steps" (Thorough only)
- ChatPanel.tsx 加 collapsible reasoning card：
  - "Retrieving chunks → Reranking → Generating"
  - Thorough mode 8s+ TTFT 时显示
  - 用现有 SSE 事件做 progress signal

---

## 5. Tier 4 — 需要外援（不在本批次）

- 完全 custom icon set（5-10 hero icons by indie designer，~$3-8K）
- 长期 brand identity refresh（Claude-style cream + clay orange？需要勇气和回归测试）
- "Document + Chat-Thread Weave" 激进 hero（需 3-4 周设计 + Framer/GSAP）
- Editorial line art 套图（~$8-15K）

---

## 6. Claude 推荐执行顺序

**Phase 1 (今日 + 明日, ~6-8h)**：T1.A + T1.B + T1.C + T1.D
- 配色 warm + hero artifact + CTA 文案 + citation pill 升级
- **预期**：进站 5 秒"AI 模板感"明显减弱

**Phase 2 (后天, ~6h)**：T2.A + T2.B + T2.D
- Inter Display + Bento FeatureGrid + Sources strip
- **预期**：landing 完整看完后"这是设计过的产品"

**Phase 3 (异步)**：T1.E + T2.E + T3 全部
- Onboarding seed + signature glyph + Trust Center + Footer + Sidebar + Dark elevation + Thinking steps
- **预期**：留存层提升

**T4 不在本次**：除非有 designer 介入

---

## 7. 待 Codex 挑战的关键点

1. **T1.A 配色**：warm-tint canvas vs Claude-style 大改 — Codex 选哪个？
2. **T1.B Hero artifact**：删 ShowcasePlayer 是否过激？（用户可能想保留视频证明产品真实）
3. **T1.D Citation pill 信息密度**：`[PDF p.4 · 1]` 是否过载？mobile 折行风险？
4. **T1.E Auto-seed**：会不会侵犯用户 "fresh slate" 期望？是否应是 opt-in？
5. **T2.B Bento**：6 features 需要 6 个 bespoke visual，工作量爆炸？
6. **T2.D Sources strip**：是否会让 answer 区域被压缩，长答案体验变差？
7. **T3.B Footer status dot**：UptimeRobot 误报会让用户对产品失信任，不如不加？
8. **优先级**：Claude 推荐 T1→T2→T3 顺序合理？还是 T1.E (auto-seed) 应优先于 T1.A (配色)？

---

**交付物**：Codex 审完后选定 Phase 1 范围，Claude 立即执行。
