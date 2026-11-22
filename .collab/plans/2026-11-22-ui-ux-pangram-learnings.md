# 参考 Pangram 的 UI/UX：DocTalk 营销页与应用内优化方案（2026-11-22）

状态：第一批（X1、A1、M6、M2）与第二批（M1、M3）已实现（2026-11-22，分支 `claude/gallant-thompson-3oyisp`）；其余待定。

实施记录：
- A1 追加：owner 决定只保留回答上方的来源条，删除下方 CitationCard 行；来源条接管"当前引用"标记（`aria-current`），折叠时保持可见。
- M1：访客上传入口由访客流程方案实现（`GuestUploadEntry`，hero 的 "Try your own document"），本方案只加了额度徽章（复用 `demo.freeNoSignup`）和三个样例 chip（`lib/demoSamples.ts`，经 `/demo/<route>?question=` 进入阅读器）。为守住"标题 + 引文 + 回答卡同屏"的约定（review 2026-09-21 MAJOR-3），入口行在桌面单行显示；桌面窗口高度 ≤760px 时隐藏，ja/ko/hi（三行标题）在 ≤920px 时隐藏。6 种尺寸 × 11 种语言实测，回答卡不再因入口行掉出首屏。
- M3：头部改为 "Sign in" 文字链 + 常驻 quiet 胶囊 "Try a sample"（/demo 页不显示）；手机顶栏只剩 Logo、胶囊、菜单，语言与登录移入菜单。没有做"滚动后升级为实心按钮"，以保证每屏只有一个实心 CTA。
关联：`.collab/plans/2026-11-22-guest-trial-flow-pangram.md`（访客流程方向）。其中 **P0-2 待上传续跑、P1 访客上传（后端）不在本方案范围**；本方案只覆盖入口区（样例 chip、拖拽区、额度徽章）的视觉与布局。

## 1. 方法

- Playwright（headless Chromium，经代理），桌面 1440×900 与 iPhone 13 各一套，2026-11-22 生产环境：
  Pangram `www.pangram.com`；DocTalk `/`、`/demo`、`/pricing`、`/features/citations`、`/d/182c1d7b…?question=How does multi-head attention work?`（阅读器，用了 1 条访客额度）。
- Pangram `/dashboard` 有 Cloudflare 挑战，未尝试。
- 截图在 session scratchpad（临时目录，未入库）。

## 2. 对照结论（一句话）

Pangram 首屏把"产品 + 免费额度 + 证据数字"三件事一次讲完，每个 section 都用**真实产品 UI** 而不是文字说明。DocTalk 的 hero 画布很有辨识度、品牌一致，但：①首屏没有可操作入口、免费额度不可见；②首屏以下几乎全是纯文字网格，Quote Finder 这个旗舰功能只在一行脚注里出现；③应用内的引用来源列表和 cookie 横幅是最直接的体验扣分点。

## 3. 排序总表（影响 / 成本）

| # | 区域 | 建议 | 影响 | 工作量 |
|---|---|---|---|---|
| M1 | 营销 | Hero 入口条：样例 chip + 额度徽章 + 拖拽区，CTA 不再压在画布文字上 | 高 | M（1–1.5 天） |
| A1 | 应用 | 来源列表：默认折叠为前 5 条、去重、空摘要兜底、移动端显示摘要而非文件名 | 高 | S–M |
| X1 | 两者 | Cookie 横幅：不遮挡阅读器工具栏/回答；营销页移动端缩成底部单行条 | 高 | S |
| M2 | 营销 | 首屏下方证据数字行（3 格，均链到证据页）+ 页内锚点 | 中高 | S |
| M3 | 营销 | 头部常驻主操作：桌面 "Try a sample"，移动端顶栏 Logo + 主操作 + 汉堡（语言收进菜单） | 中高 | S |
| M4 | 营销 | 功能区改为"迷你产品 UI 卡片"（引用跳转 / Quote Finder / 版面翻译），替换纯文字三栏 | 中 | M |
| A2 | 应用 | 访客额度条：进度 + 用尽前的预告 + 用尽态卡片（文案与锁点埋点对齐访客流程方案） | 中 | S |
| M5 | 营销 | How it works 改为"截图 + 编号步骤"联动（Pangram 的手风琴，改成无手风琴的同步高亮） | 中 | M |
| M6 | 营销 | 规则清理：全大写 eyebrow / 重复标签（demo 卡片、pricing 面包屑、Privacy 区 "01 — Privacy"） | 低中（合规） | S |
| M7 | 营销 | 功能页（features/*）顶部加真实产品截图/短视频，长文降级到下方 | 中 | M（按页） |
| — | 不采用 | 彩色 section 标签、悬浮卡片导航、Logo 跑马灯、插画风、回到顶部按钮 | — | 见 §6 |

---

## 4. 营销页

### M1 Hero 入口条（样例 chip + 额度徽章 + 拖拽区）
- **Pangram**：首屏右侧是能用的检测卡：示例 chip "Try an example: Human · ChatGPT · AI + Human"、Upload 次按钮、主按钮；卡上方 "20 free credits daily" 徽章。
- **DocTalk 现状**（截图）：标题 + lede + "Start with a sample doc"（实心）+ "Sign Up Free"（文字链）。两个按钮**直接压在画布的文档正文上**（桌面 y≈430 处与正文行重叠，"Sign Up Free" 读起来吃力）；免费额度（每文档 5 问、免注册）首屏看不到；点 CTA 还要经过 `/demo` 再选一次样例。
- **改法**：
  1. 在 `.ed-night-actions` 下加一条入口条（同一个 claim 列内，画布之上有不透明底，保证对比度）：
     - 额度徽章：`5 free questions per document · no sign-up`（`tOr('landing.entry.quota', …)`）。徽章是普通文本 + 图标，不是按钮，不算第二个实心 CTA。
     - 样例 chip（3 个，`.ed-cta-quiet` 尺寸缩小版，或新 `.ed-chip` 类，限定在 `.dt-editorial` 下）："Earnings release · Research paper · Court filing"，直接链到 `/d/<id>?question=…`（id 与问题取自 `/demo` 已在用的公开 demo 列表接口，后端只返回 `DEMO_DOCS` slug；不在前端另写一份常量）。
     - 拖拽区（桌面显示，移动端收为"Upload your file"文字链）：访客拖入 → 本方案**只做视觉与提示**（"Sign in free to upload your own file"），续跑逻辑归访客流程方案 P0-2；在 P0-2 落地前，拖入行为 = 打开现有 `#auth` 弹窗。
  2. 主 CTA 保持唯一实心 `.ed-cta`（"Start with a sample doc" 可改为直达第一个样例，或保留去 `/demo`，二选一，建议保留并让 chip 承担直达）。
  3. 画布与 claim 之间加一层 `--ed-paper` 的渐隐底（已有 `ed-night-stage` 结构，改 `editorial.css` 中 `.dt-editorial .ed-night-claim` 的背景/内边距），让按钮不再压在正文行上。
- **文件**：`components/landing/HeroSection.tsx`、`app/editorial.css`（全部限定 `.dt-editorial`，夜间值走现有 token，不新增 night-only token，`tests/landing-night.test.cjs` 的封闭列表不变）、11 个 locale 的 `landing.entry.*`（先 `tOr`）。
- **风险**：①一个视图只能一个实心 CTA，chip 必须是 quiet 样式；②`citationFieldContent.ts` 与 `landing.frame.*` 不动；③hero 文案改动不影响 SEO（meta key 已解耦），但 `HomeJsonLd` 跟随可见 hero，新增的入口条文案不进 JSON-LD 即可；④CitationField 的 rAF/`?still` 行为不受影响；⑤要做 CDP 对比度复查（入口条在画布上方）。
- **衡量**：`landing_cta_clicked` 加 `location=hero_chip|hero_drop|hero_cta`。

### M2 证据数字行 + 页内锚点
- **Pangram**：首屏下三格数字（1 in 10,000 FPR / #1 independent studies / 20+ languages），每格链到证据；再下一行锚点。
- **DocTalk 现状**：hero 下方直接是 "From answer to source" 视频区，没有可验证的数字。
- **改法**：hero 下加三格（`.ed-num` 数字 + 一行说明 + `.ed-link`），**只放能证明的数字**，候选：`11 languages`（链 `/features/multilingual` 或语言选择器说明）、`PDF · DOCX · PPTX · XLSX · TXT · MD · URL`（链 `/features/multi-format`）、`Every quote machine-verified`（链 `/features/citations` 中 Quote Finder 说明）。不要写无出处的准确率百分比。下面一行锚点：How it works · Quote Finder · Security · FAQ · Pricing（Pricing 是外链）。
- **文件**：新 `components/landing/ProofStrip.tsx`、`LandingPageContent.tsx`、`editorial.css`、11 locale。
- **风险**：营销不得夸大（CLAUDE.md 对版面翻译有明确要求，不出现"完美翻译"类措辞）。

### M3 头部常驻主操作 + 移动端顶栏
- **Pangram**：头部始终有 "Try It for Free"；移动端只有 Logo + 主按钮 + 汉堡。
- **DocTalk 现状**：桌面头部唯一按钮是 "Sign In"（描边）；移动端顶栏挤了 Logo、EN、汉堡、Sign In 四项，主操作（试用）不在头部。
- **改法**：头部右侧改为 `Sign in`（`.ed-link`）+ `Try a sample`（`.ed-cta-quiet`；hero 在视口内时 quiet，hero 滚出后可升为实心——用 IntersectionObserver 保证同一视图仍只有一个实心 CTA）。移动端：语言选择器收进汉堡菜单，顶栏只剩 Logo + `Try a sample` + 汉堡。
- **文件**：`components/marketing/EditorialHeaderBase.tsx`、`EdLanguageSelector.tsx`（移动端放菜单内，门户菜单的 Night 镜像类不能丢）。
- **风险**：头部是 `.ed-glass` 功能层，允许；"单一实心 CTA"靠滚动切换实现，要写测试锁住。

### M4 功能区改迷你产品 UI 卡片
- **Pangram**：三张彩色底卡片，卡里是缩小的真实结果 UI。
- **DocTalk 现状**："Built for serious readers" 三栏纯文字；Quote Finder（v0.24 旗舰）只在 hero 底部一行脚注提到。
- **改法**：三张卡，卡内是用 HTML/CSS 画的**静态迷你 UI**（不是截图图片，便于 11 语言和夜间主题）：① 引用 chip + 高亮句；② Quote Finder 卡片（verified 标、页码、复制 APA）；③ 版面翻译前后对照缩略。底色用 `--ed-paper-2`，**不用 Pangram 的多彩底**（会成为第二套表面风格）；olive 只用于 verified、amber 只用于引用，符合角色色规则。
- **文件**：`components/landing/FeatureGrid.tsx`、`editorial.css`、11 locale。
- **风险**：迷你 UI 的文字必须是真实可得的输出形态，不能暗示做不到的效果。

### M5 How it works：截图 + 编号步骤联动
- **Pangram**：左截图、右 01–04 手风琴。
- **DocTalk 现状**：三列 "01/02/03" 纯文字。
- **改法**：左侧一张产品画面（复用 `ProductDemo` 的视频/海报帧，按步骤切换帧），右侧三步列表；不用手风琴（折叠内容对 SEO 和 `landingSchemaSources.ts` 的 HowTo 一致性不利），改为全部展开 + 当前步骤高亮，滚动/点击切换画面。
- **文件**：`HowItWorks.tsx`、`ProductDemo.tsx`、`landingSchemaSources.ts`（文案 key 不变，仅布局；HowTo 与可见文本的一致性测试必须继续通过）。
- **风险**：减少动效偏好下只显示第一帧。

### M6 规则清理（低成本，建议顺手做）
截图里发现与现有设计规则冲突的地方：
- `/demo` 样例卡 "FINANCE / RESEARCH / LEGAL"、"SUGGESTED QUESTION" 为全大写 eyebrow（`DemoPageClient.tsx:148`、`:202` 的 `ed-caption uppercase`）。
- `/pricing` 面包屑 "PRICING" 与页首 eyebrow "PRICING" 全大写。
- 首页 Privacy 区每格重复 "01 — Privacy … 04 — Privacy"，标签无信息量，可删去 "— Privacy"。
- **文件**：`app/demo/DemoPageClient.tsx`、`app/pricing/*`、`components/landing/SecuritySection.tsx`、相关 CSS（`text-transform: uppercase`）。

### M7 功能页顶部放真实产品画面
- **DocTalk 现状**：`/features/citations` 首屏是长标题 + 一段文字 + 按钮，下方是大段说明文，无产品画面。
- **改法**：`EdPageHero variant="product"`（已有）用于各 features 页，右侧放对应功能的迷你 UI（与 M4 复用组件）；长文移到下方。逐页推进，先做 citations / multi-format / layout-translation（目前没有独立的 Quote Finder 功能页，是否新建另议）。
- **风险**：每个 features 页的 SoftwareApplication JSON-LD 校验（`verify-marketing-jsonld-phase2.py`）不受影响，但要跑一遍。

---

## 5. 应用内

### A1 来源列表（SourcesStrip / CitationCard）
- **DocTalk 现状**（阅读器截图，一次回答 15 个来源）：
  - 桌面：15 张 `CitationCard` 竖排占满一屏，宽度参差；#1、#9、#13 的摘要为空，只剩 "Page 4–5"（`sanitizeText` 后为空的情况没有兜底）。
  - 移动端：`SourcesStrip` 每个 chip 都显示文件名 "Attention Is All You…"，单文档场景下 15 个 chip 完全一样，只能靠页码区分；顺序是 7, 2, 8, 3, 4, 9…，与正文编号不一致。
- **Pangram 对应**：结果区信息分层清楚（总分 → 分段 → 明细），默认只展示要点。
- **改法**：
  1. 默认显示前 5 个来源 + "Show all 15 sources"（`aria-expanded`），展开后全量。
  2. 单文档会话中 chip 显示摘要而非文件名（多文档/collection 仍显示文件名）；摘要为空时回退为 "Page N"+章节或 "Passage on page N"，不留空白。
  3. 按引用编号排序；同 chunk 同页的重复来源合并显示（不改变 `citationSourceKey` 的身份规则，只改展示）。
- **文件**：`components/Chat/SourcesStrip.tsx`、`CitationCard.tsx`、`MessageBubble.tsx`（使用处）、11 locale 的 `chat.sources.*`。
- **风险**：引用展示有大量既有约定（`text_snippet` 只用块文本、compound citations 的 focus 规则），本改动只动**列表的折叠、排序和空值兜底**，不改 snippet 内容与跳转目标；`tests/*citation*` 相关测试需全过。应用内保持 zinc + 蓝色。

### X1 Cookie 横幅
- **现状**：桌面阅读器里横幅压住 PDF 工具栏右侧（"Sign in for Quote Finder" 入口被遮住）；移动端阅读器横幅压在回答正文上；营销页移动端横幅占首屏约 1/5。
- **改法**：阅读器内改为底部全宽细条（不覆盖工具栏，进入时把 chat 输入区上推），营销页移动端缩为单行 "Analytics cookies? Decline · Accept"。`CookieConsentBanner` 是已获准的双表面组件，自己检测表面，保持该机制。
- **文件**：`components/CookieConsentBanner.tsx`。
- **风险**：合规文案和 Decline 同等显著性不能削弱。

### A2 访客额度条
- **现状**："4/5 questions remaining · Sign in for free credits"，进度条很细；用完时的状态未截到。
- **改法**：剩 1 条时提示 "1 free question left on this document"，用尽后在输入框位置显示卡片（"Sign in free to keep asking — your conversation stays here"）。锁点埋点统一用访客流程方案里的 `guest_signup_cta_clicked {location}`，本方案只做 UI。
- **文件**：`components/Chat/ChatPanel.tsx`（额度区）、11 locale。
- **风险**：demo 计数合约（`totalUsed` 公式、`demoAccountingEpoch`）不动，只读已有数值。

---

## 6. 明确不采用的 Pangram 做法

| Pangram 做法 | 不采用原因 |
|---|---|
| 彩色小标签（"Our Product" 等，彩色底） | 与"无全大写 eyebrow、无等宽标签、单一表面"冲突；DocTalk 已有 `EdSection` 的小号普通字 eyebrow，可保留但保持句首大写、无底色。 |
| 悬浮圆角卡片式导航 | 头部已是 `.ed-glass` 粘性条；改为悬浮卡会形成第二套表面处理。M3 已覆盖"主 CTA 常驻"这一要点。 |
| 客户 Logo 跑马灯（带暂停） | DocTalk 没有可公开的客户 Logo；虚构或未授权使用不可取。若将来有，需按 Pangram 带暂停按钮。 |
| 插画风格背景 | Night 表面的识别元素是 CitationField 画布，插画会成为第二套视觉语言。 |
| 每张卡不同的鲜艳底色 | 同上；角色色（olive=verified、amber=citation）有固定语义。 |
| 回到顶部按钮 | 首页长度约 4,800px（桌面），收益低；暂不做。 |
| "时效性证据"模型卡（每个模型准确率 + 日期） | 思路可借鉴（M2 的证据数字要能链到证据），但 DocTalk 目前没有公开的分模型评测数据，不应先放卡片后补数据。若做了 citation 准确率评测博文，可再加。 |

## 7. 建议顺序

1. 第一批（1–2 天，低风险高收益）：**X1、A1、M6、M2**。
2. 第二批（2–3 天）：**M1、M3**（与访客流程方案 P0-1/P0-4 合并实施，避免两次改 hero）。
3. 第三批（按页推进）：**M4、M5、M7、A2**。

每批实施后：`cd frontend && npm run build`、相关 `tests/*.test.cjs`（`landing-night`、`seo-meta-keys`、`sitemap-routes`、`chat-session-restore`、citation/evidence 系列）、浏览器走黄金路径（上传 → 提问 → 点引用跳转），营销页做一次 CDP 对比度检查。超过 30 行逻辑的改动按 CLAUDE.md 走 Codex 评审（云端没有 codex CLI，需在本地补做）。
