# 独立评审 r1 与处理记录（2026-11-23）

**说明：这不是 Codex 评审。** 用户本地的 `codex-r1.md` 没有推送成功，用户要求"独立做"。评审由一个新开的 Claude 子代理完成：它在全新上下文中工作，只拿到代码、`changes.patch` 和 `codex-prompt.md`，没有拿到作者的结论。CLAUDE.md 要求的 Codex 对抗评审仍需在本地补做（可用同一份 `codex-prompt.md`）。

评审对象：`f23bcc8`、`901333e`、`ebbf6d0`、`bbad062`。评审结论：修完再上线（至少修 F1–F3）。

## 发现与处理

| # | 严重度 | 评审状态 | 问题 | 处理 | 验证 |
|---|---|---|---|---|---|
| F1 | P1 | 已复现 | 手机菜单里的语言弹层按触发器右边缘对齐，触发器在左侧，弹层落到屏幕外（390px 下 left=-143），11 种语言中 10 种受影响 | `EdLanguageSelector`：触发器左侧放不下 200px 时改为左对齐，并限制在视口内；加 `maxWidth` | Playwright：390/320px 的 LTR 页、/ar、桌面 1440 全部在视口内；回归测试 |
| F2 | P1/P2 | 按代码推导 | 工作区横幅一律放在右下：collection 页任何桌面宽度、阅读器 640–1023px 都会挡住聊天输入框和发送按钮 | 按路由放置：collection 回到头部下方（一行）；阅读器手机在头部下方、sm–lg 放左上、lg+ 放右下且宽度不超过文档面板 | Playwright：阅读器 640/768/1023 在左上，1024/1440 在右下且 left > 分栏线；回归测试（把修复改回去会失败） |
| F3 | P2 | 按代码推导 | 删掉 CitationCard 后，来源 chip 的 `aria-label` 只有"文件名 — 跳到第 N 页"，没有编号和摘录，单文档里多个 chip 名称相同，违反 WCAG 2.5.3 | 去掉 `aria-label`，让可见文字（编号、摘录或文件名、页码）做名称；跳转说明放到 `aria-describedby` | 渲染测试（把修复改回去会失败） |
| F4 | P3 | 已复现 | `?question=` 按 UTF-16 单元截断，可能切开 emoji，导致 `encodeURIComponent` 抛错 | `demoSampleHref` 和重定向页都改为按码点截断 | 单元测试：边界上的 emoji 保留完整 |
| F5 | P3 | 浏览器实测 | 手机顶栏 "Try a sample" 胶囊在 pt/de/fr/es 下折成两行、贴住 logo | 胶囊不换行、手机上缩小内边距；es/pt/fr 改用更短的文案；360px 以下隐藏 "DocTalk" 文字（保留图标，链接有 aria-label） | Playwright：320/360px × pt/de/fr/es/it/hi 都是单行，与 logo 间距 ≥24px，无横向滚动 |
| F6 | P3 | 已确认 | How it works 在 lg 以下有三个点了没效果的按钮，`aria-controls` 指向隐藏面板 | 只在 lg 及以上渲染按钮（matchMedia；首屏渲染与服务端一致，不会出现水合不一致） | Playwright：390/1023px 下 0 个按钮，1024px 下 3 个；回归测试 |
| F7 | P3 | 推测 | collection 回答只引用一个文档时，chip 不显示文件名 | 核对后端：`document_filename` 只在 collection 检索时下发。改为"引用带文件名就显示文件名" | 单元测试 |
| F8 | P3 | 已确认 | 格式 chip 用 12px 显示字母（12px 只允许用于数字） | 改为 13px | `product-vignettes` 字号测试 |
| 测试 | — | 已确认 | `landing-entry.test.cjs` 有一条正则断言的第二个分支永远匹配，形同虚设 | 改成要求胶囊类名后面紧跟 `{labels.trySample}` | — |

逐题结论中其余各项评审均为"无问题"，包括：首屏同屏约定（8 种语言 × 7 种尺寸实测）、`/demo/<route>?question=` 没有新增的滥用面、CSS 作用域与 Night 孪生规则、11 种语言 key 齐全、A2 没有碰 demo 计数合约。

## 验证汇总

- `node --test tests/*.test.cjs`：468 通过，0 失败
- `npm run lint`（含两个 i18n 检查脚本）：通过
- `npm run build`：通过
- 未验证：上传 → 提问 → 点引用跳转的黄金路径（云端没有后端和 R2 访问权限，需在本地或 preview 上走一遍）
