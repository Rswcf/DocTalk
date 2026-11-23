# Codex 对抗评审：Pangram UI/UX 三批改动（2026-11-23）

你要评审的是 Claude 写的前端改动。请以对抗的立场审查：找真实的 bug 和违反项目规则的地方，不要提风格偏好。你不能运行 git；需要的内容都在本仓库的工作区里（已在分支 `claude/gallant-thompson-3oyisp` 上），以及本文件旁边的补丁文件。

**请全程用中文书写评审报告。** 代码、文件路径、类名、i18n key 保持原样。

## 要读的内容

1. `.collab/reviews/2026-11-23-ui-ux-pangram-batches/changes.patch`：待评审的四个提交，按顺序：
   - `f23bcc8` 第一批：X1 cookie 横幅、A1 来源列表、M6 规则清理、M2 证据数字行
   - `901333e` 删除回答下方的 CitationCard 行；来源条（SourcesStrip）接管"当前引用"标记
   - `ebbf6d0` 第二批：M1 首屏入口行 + 样例 chip、M3 头部
   - `bbad062` 第三批：M4/M5/M7 产品小画面（vignettes）、A2 最后一次免费提问提示
2. 方案：`.collab/plans/2026-11-22-ui-ux-pangram-learnings.md`。
3. 项目规则：`CLAUDE.md`、`.claude/rules/frontend.md`（Night 编辑表面、每个视图只有一个实心 `.ed-cta`、字号不小于 12px、`editorial.css` 规则必须限定在 `.dt-editorial` 下、11 种语言 i18n、本地化页面 SSR 前缀预载、demo 计数合约、引用展示规则）。

不在范围内：提交 `dd53667` 和 `a201b6f`（访客自带文档续传）是另一个 session 的工作；只有在本批改动把它们弄坏时才需要指出。

## 要回答的问题（逐条检查；检查过且没问题就写"无问题"）

1. **来源条**（`components/Chat/SourcesStrip.tsx`、`lib/sourceList.ts`、`MessageBubble.tsx`、`ChatPanel.tsx`）：删掉 CitationCard 行之后，有没有原来能用、现在丢掉的功能（当前引用标记、键盘操作、collection/多文档对话、表格/摘要引用、没有 offset 的旧引用、流式输出时的骨架屏）？按 `refIndex` 排序或折叠，会不会把回答引用的来源藏起来或排错？`citationTarget` 的比较（`chunkId` + `refIndex` + `messageId`）和 `onCitationClick` 在 `renumberCitations` / `uniqueCitationIndexes` 之后存进去的值是否一致？
2. **Cookie 横幅**（`components/CookieConsentBanner.tsx`）：在 `/d/*`、`/collections*`、`/shared/*`、`/document-diff` 上，手机、平板、桌面三种宽度下，现在的位置会不会挡住重要内容（PDF 翻页控件、输入框、collection 头部）？"拒绝"和"接受"两个按钮是否仍然同等显著？
3. **`/demo/<route>?question=` 转发**（`app/demo/[sample]/DemoRedirectPageClient.tsx`、`lib/demoSamples.ts`）：有没有注入、开放重定向或滥用路径（例如构造一个链接，让访客打开后自动消耗免费提问额度；超长输入或控制字符；编码问题）？请和 `/d/<id>?question=` 原本就允许的行为对比。
4. **首屏入口行**（`components/landing/HeroSection.tsx`、`editorial.css` 中的 `.ed-night-entry` 及其 `@media` 规则）：是否破坏了"标题 + 引文 + 回答卡同屏"的约定（review 2026-09-21 MAJOR-3）、`passageGap` 与暗色遮罩的关系、`CitationField` 的测量，或者减少动效 / `?still` 模式？`.ed-night-claim` 上的 `lang={locale}` 对每种语言都正确吗，对读屏软件无害吗？hero 视图里是否仍然只有一个实心 `.ed-cta`？
5. **头部**（`components/marketing/EditorialHeaderBase.tsx`、`i18n/chrome.ts`）：`onDemoPage` 正则是否正确；放进手机菜单的语言选择器（portal、Night 样式镜像、焦点）是否正常；本地化页面上 `trySample` 是否由服务端解析；有没有页面因此出现两个实心 CTA。
6. **证据数字行和产品小画面**（`components/landing/ProofStrip.tsx`、`components/marketing/ProductVignettes.tsx`）：每一条说法是否真实、可核对（11 种语言、7 种格式、一键直达；`CITED` 逐字引用；格式来自 `UPLOAD_EXTENSIONS`）？这些组件在异步服务端功能页里渲染是否安全（有没有把只能在客户端用的模块带进服务端组件）？有没有项目禁止的营销说法？
7. **How it works**（`components/landing/HowItWorks.tsx`）：HowTo 结构化数据与可见文字是否一致（`landingSchemaSources.ts`、`app/HomeJsonLd.tsx`、`tests/marketing-jsonld.test.cjs`）；悬停/聚焦/点击的状态切换；ARIA（按钮上的 `aria-current="step"`、`aria-controls` 指向一个在 lg 以下为 `display:none` 的面板）；键盘操作。
8. **CSS**（`app/editorial.css`）：每个新选择器都限定在 `.dt-editorial` 下；没有缺少 `.dt-editorial.dt-night` 孪生规则的 `.dark` 规则；没有新增 night-only token；没有小于 12px 的字；`--ed-ink-3` 只用于 13px 及以上；`:dir(rtl)`、`:lang()`、`subgrid` 的浏览器支持是否可接受；减少动效是否处理。
9. **i18n**：每个新 key 都在 11 种语言里且翻译合理（`landing.proof.*`、`landing.entry.*`、`landing.vignette.*`、`header.trySample`、`chat.sources.show*`、`citation.passageFallback`、`demo.lastQuestion`、`pricing.eyebrow` 的大小写改动）；`LANDING_PREFIXES` 覆盖本地化首页读取的所有 key；没有组件读取 `*.metaTitle`。
10. **A2**（`ChatPanel.tsx`）：最后一次提问的文案只读取 `demoRemaining`，没有碰 demo 计数合约。
11. **测试**（`tests/source-list.test.cjs`、`tests/landing-entry.test.cjs`、`tests/product-vignettes.test.cjs`、`tests/citation-display.test.cjs`）：它们真的能抓住回归，还是只是把实现重述一遍？

## 输出

把结果写到 `.collab/reviews/2026-11-23-ui-ux-pangram-batches/codex-r1.md`，用中文：

- 每个发现单独一节：严重程度（P0 阻断 / P1 必须修 / P2 应该修 / P3 小问题）、`文件:行号`、具体的失败场景（什么输入或状态 → 什么错误结果）、建议的修法。
- 然后按上面的问题清单逐条写"无问题"或指向对应发现。
- 最后一行给结论：可以上线 / 修完再上线 / 不能上线。

不要修改其他任何文件。
