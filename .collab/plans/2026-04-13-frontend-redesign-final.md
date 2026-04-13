# 前端视觉改造定稿 — Claude↔Codex r1 后

**日期**：2026-04-13
**辩论记录**：
- 初稿：`.collab/plans/2026-04-13-frontend-redesign-proposal.md`（Claude A→B→D→C）
- Codex r1：`.collab/dialogue/2026-04-13-frontend-codex-r1.md`（方向对，但优先级和 ROI 被美化）

Claude 接受 Codex 全部修正。

---

## 修正版 Phase Plan

### P1（1.5 day）= B + A1
**B = Hero rework（首屏转化关键）**
- 3 CTA → 1 主按钮（`/demo`）+ 1 text link（"或免费注册"）；删除中间 outline 按钮
- 4 层文案 → **3 层**：badge + H1 + **保一行支持文案**（Codex 反对全删，避免信息真空）
- ShowcasePlayer 上移到 hero 内（**Desktop 左 60% / 右 40%**；**Mobile 上下堆叠，截图置于 CTA 后**）
- 修 Hero 箭头 `group-hover:translate-x-0.5` bug（外层无 `group` class，永远不触发）
- `motion-reduce` 覆盖每个 transition

**A1 = Radius + Bold 收敛**
- **Radius 4→3**：`lg`（按钮/卡片 default）+ `xl`（**保留**给营销大卡）+ `full`（chip/avatar/icon-button）+ `md`（small button）。废 `2xl/3xl`
- **Bold → Semibold**（**有保留**）：批量替换非 H1 的 `font-bold`，但**保留** `font-bold` 用于：定价数字、步骤序号（1.2.3.）、告警/错误强调

### P2（2-3 day）= D + A2
**D = 空 / 载 / 错状态规范化**
- 不一上来抽组件（避免 over-engineer）
- 先**定 token + 骨架规范**：spinner → skeleton 何时用、empty state 必含字段（插画 + copy + CTA）、error state 必含字段（原因 + 重试）
- 抽公用组件 IFF 多文件高度雷同
- **顺手修**：dark mode 小字对比偏低（`text-zinc-400 dark:text-zinc-500` 这类组合 → 提到 `dark:text-zinc-300`）

**A2 = Spacing + Font 角色**
- 列出 143 种 spacing 类里**非标准刻度**（`p-3`/`mt-7`/`gap-5`/任意值/小数/负间距），归并到 4/8/12/16/24/32/48
- **Font 角色重新定义**（Codex 推荐）：**不换字体库**。Sora 仅留 logo，所有标题用 **Inter + 权重梯度**（H1 `font-bold tracking-tight` / H2 `font-semibold` / H3 `font-medium`）

### P3（1 day）= C
**C = Feature card 真截图化**
- FeatureGrid 6 张换 GIF / 静态截图（手动录屏 + ffmpeg）
- 退役 Lucide icon
- 每张配 1 句"产品语言"copy（不是营销话术）

### 不在本批次（明确说明）
- E（brand identity）需要外部 designer，不做
- 全局 mobile 公共导航重设（Codex 漏项 #2 — 范围太大，独立批次）
- 完整 a11y 审计（漏项 #4 — 抽样修，不全覆盖）

---

## P1 具体执行清单（Claude 立刻开始）

### B - Hero rework
1. 编辑 `frontend/src/components/landing/HeroSection.tsx`：
   - 删除 `subtitle` 行（保留 `description` 作为支持文案，因为 description 更具体）
   - 删除中间 `#auth` 按钮（rounded-full outline）
   - 第三个 "How it works" 按钮 → text link
   - 修 group-hover bug：要么外层加 `className="group ..."`，要么删 group-hover 用普通 hover
2. 重构为 left-text / right-image layout（Desktop）
3. 把 `<ShowcasePlayer>` 从 HomePageClient 提到 hero 右侧
4. mobile（< md）保持上下堆叠，截图在 CTA 之后
5. 验证：Lighthouse Accessibility ≥ 95，Hero LCP < 2.5s

### A1 - Radius + Bold
1. **Radius 收敛脚本**：
   - `rounded-2xl` → `rounded-xl`（51 处）
   - `rounded-3xl` → `rounded-xl`（5 处）
   - `rounded-sm` 保留（极小元素如 chip ring）
2. **Bold 收敛**：
   - 找出所有 `font-bold` 用法
   - 排除（保留 bold）：定价数字 / 步骤序号 / 告警 banner / H1
   - 其余批量改 `font-semibold`
3. 验证：repo 内 distinct radius 从 9 → ≤ 5；`font-bold` 用量从 286 → ≤ 100

### Done 标准
- Hero 截图（前后对比）证明信息层级清晰
- `grep -c "rounded-2xl\|rounded-3xl" frontend/src` = 0
- `grep -c "font-bold" frontend/src` ≤ 100
- 本地 dev 验证桌面 + mobile + dark mode 三种状态无 regression
- 一次 commit 推 stable，看 doctalk.site 真实效果

---

**执行起点**：本文件定稿，Claude 开始 P1 = B + A1。
