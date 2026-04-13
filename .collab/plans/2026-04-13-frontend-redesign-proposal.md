# 前端视觉改造提议（Claude 初稿）

**日期**：2026-04-13
**触发**：用户反馈"前端有些丑陋会影响获客"
**约束**：用户已明确不需要保护 SEO / beta 用户（只 20 测试用户、活跃 2）→ 可做较大改动

---

## 1. Token 审计数据（事实，不是判断）

### Radius — 🔴 主要问题
```
197  rounded-lg    
171  rounded-full  
122  rounded-xl    
 51  rounded-2xl   
 29  rounded-sm    
 16  rounded-md    
  5  rounded-3xl   
```
**4 个高频 radius (lg/full/xl/2xl) 各上百次同存** = 视觉系统破碎主因。同一卡片用 `rounded-xl`，旁边按钮用 `rounded-lg`，旁边 chip 用 `rounded-full`，旁边 avatar `rounded-2xl` — 任何一屏都有 3-4 种半径并存。

### Font-weight — 🟠
```
286  font-bold
273  font-semibold
235  font-medium
```
`bold` 比 `semibold` 多 — monochrome 设计里 **过 bold = 视觉粗笨**。Linear / Vercel / Stripe / Apple 的规则：H1 用 bold，其他全 semibold。

### Spacing — 🟠
107 distinct spacing utility values（包括 `p-3`, `mt-7`, `gap-9` 等非标准刻度）。健康基线 < 30。说明大量"凭感觉"间距。

### Font-display — 🟡
定义 `font-display: ['var(--font-logo)', ...]` = Sora。Sora 跟 Inter 都是 geometric sans，差异微弱 → **H1 用 `font-display` 实际等于没差**，对比层级失效。

### 健康项 🟢
- Color 系统：zinc + indigo + 少量 status（emerald/red/amber）— 收敛得不错
- Shadow：sm+md 占 87% — 节制
- Transition：transition-colors 占 84% — 一致

---

## 2. 4 类问题 → 4 类改造（按 ROI）

### A. Token 收敛（**1-2 day**, 最高 ROI）
- **Radius 4→2**：`rounded-lg`（卡片/按钮 default）+ `rounded-full`（chip/avatar/icon-button）。废 `xl/2xl/3xl/md`，保 `sm` 给极小元素
- **Bold → Semibold**：除 H1 外，批量替换 `font-bold` → `font-semibold`
- **Spacing 收敛**：列出非 4/8/12/16/24/32/48 的值（`p-3` `mt-7` `gap-5` 等），归并到最近标准刻度
- **Font-display 重选**：换 Pretendard / Geist Sans / Söhne / Sora Bold（差异化更强的字面）。或干脆删掉 `font-display`，H1 直接用 Inter Black + tracking-tighter

**风险**：几乎为零（视觉收敛，不改 layout/逻辑）
**预期效果**：进网站第一感觉从"草稿/AI 模板"→"成品"

### B. Hero rework（**0.5-1 day**, 高 ROI）
- 删 subtitle 或 description（保一）— 现在 4 层文案 → 3 层
- 3 CTA → **1 主按钮**（`/demo`）+ 1 个 text link（"或免费注册"）— 删掉中间 `rounded-full` 描边按钮
- 把 ShowcasePlayer 上移到 hero 内（**左字 60% / 右图 40%** layout）取代 dot-pattern + radial gradient
- H1 配合 A 改 Inter Black（跟 Sora 差异大）

**风险**：低。SocialProof 等下游不动
**预期效果**：访客 3 秒内知道 "DocTalk 是干嘛的"

### C. Empty / Loading / Error 一致化（**1 day**, 中 ROI）
- 已有 13 文件用 `animate-pulse` skeleton — 但很可能 4-5 种实现风格
- 抽 `<EmptyState>` `<SkeletonCard>` `<ErrorState>` 三个组件，统一风格
- empty state 加引导文案 + 主要 CTA（不再是干巴巴的 "No documents yet"）

**风险**：低。需测试每个使用点
**预期效果**：app 内"craft 感"直接拉满 — 用户每天看 N 次的状态变成产品力体现

### D. Feature card 真截图化（**2-3 day**, 中 ROI）
- 当前 FeatureGrid 大概率是 Lucide icon + 标题 + 描述 — 看起来"通用"
- 6 张卡每张换成**实际产品 GIF / 静态截图**（如 citation pill 高亮、PDF 抠图、export 按钮）
- 资产可手动截图 + ffmpeg 录屏

**风险**：中。需要时间录素材
**预期效果**：从"卖概念"变成"卖产品"

---

## 3. Claude 推荐执行顺序

**Phase 1（小套餐，2-3 day）**：A + B
- A 是基础设施收敛，B 是首屏体验。两件加起来用户**进站 5 秒内** 体感跃升

**Phase 2（中套餐，再 1-2 day）**：D（空状态三件套）
- 让 app 内体验匹配 marketing 页

**Phase 3（大套餐，再 2-3 day）**：C（feature 截图）
- marketing 页深度优化

总计 5-8 day Claude 工时。

---

## 4. 待 Codex 挑战的点

1. **Radius 4→2 是否过激**？保留 `xl` 给某些场景（如大卡片）会更稳？
2. **Bold→Semibold 全局替换**会不会破坏某些故意 emphasize 的地方（如 banner、pricing 数字）？
3. **Hero 删一个 CTA + 删 subtitle/description** 是否会让首屏看起来太空？
4. **左字右图 hero layout** 在移动端如何处理？很多 SaaS 在 mobile 上还是回到上下结构
5. **Font-display 从 Sora 换 Pretendard / Geist** 是否值得？还是应该完全删掉差异化字体？
6. **Empty/Loading/Error 抽组件**会不会 over-engineer？13 个文件可能各有合理差异
7. **优先级是否对**？还是该先做 D（feature 截图），因为这是"看起来像产品"的最大变量？
8. 我**漏掉的视觉债**？（dark mode 实现质量？mobile responsive 完整度？accessibility 视觉部分？micro-interactions 缺失？）

---

**交付物目标**：Codex 审阅后定稿一个 1-3 phase 的 actionable plan，Claude 立即开始执行。
