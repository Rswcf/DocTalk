# 先试用、后注册：Pangram 的访客流程与 DocTalk 对照（2026-11-22）

状态：P0 已实现（2026-11-22，见 §6）；P1 未开始，涉及安全与计费，实施前须走 Codex 对抗评审。

## 1. 调研方法与局限

- 用 Playwright（headless Chromium）打开 `https://www.pangram.com/`（桌面 1440×900、iPhone 13），截取首页各段与移动端。
- Pangram 的应用 API（`web.pangram.com`）挂了 Cloudflare 机器人挑战（`cf-mitigated: challenge`），从云容器 IP 访问返回 403，所以 `/dashboard` 在这里只能停在 "Loading…"/"Connection problem"。**没有绕过挑战。**
- 应用内部的流程来自 `www.pangram.com` 公开下发的前端 JS（Redux action 名、API 路径、埋点事件名、文案），以及首页 hero 的实际行为。下面凡是"代码显示"的内容都来自这些公开 bundle，未在真实账户里点过一遍。若要亲手走一遍，需要在本地浏览器打开。

## 2. Pangram 的流程

### 2.1 入口：hero 本身就是工具
- 首屏右侧是可用的检测框：Text / Image / Video 标签、"Paste your text or drag and drop it here"、**"Try an example: Human · ChatGPT · AI + Human"** 一键填充示例、Upload 按钮、"Check for AI" 主按钮。
- 移动端检测框上方有徽章 **"20 free credits daily"**：免费额度在动手前就讲清楚了。
- 导航栏的 "Try It for Free" 直接链到 `/dashboard`，**不是注册页**。

### 2.2 从 hero 到应用：保住用户的输入
代码显示：在 hero 提交时，文本写入 `localStorage["pending_ai_check_text"]`，然后跳到 `/dashboard?pendingCheck=true&pendingType=text`，dashboard 自动执行这次检测。用户在营销页做的动作不会丢。

### 2.3 dashboard 对访客开放
- 访客看到的是真实产品界面，结果标记 `is_guest`；访客也有额度条（"Credits"）；模型选择器只对登录用户显示。
- 额度接口 `GET /api/anonymous-scan/remaining/` 返回 `credits_remaining`、`credits_limited_by`（`visitor` / `device` / `network`）、`credit_pricing`。
- 防滥用：Cloudflare Turnstile **按风险触发**（只有接口返回 `turnstile_required` 时才弹，action=`guest_scan`）；请求头带设备指纹 `x-guest-device-id`；按访客、设备、网络三层限额；API 域名本身也在 Cloudflare 机器人管理之后。
- 检测是异步任务加轮询（`/api/anonymous-scan/status/{id}/`），刷新页面后会自动恢复未完成的访客检测（`resumeAnonymousScans`）。

### 2.4 注册墙放在哪里
- **额度用完**：402 `no_credits_remaining` → 额度耗尽 toast（`text_credits_exhausted_toast`）。
- **超出字数**：`text_word_limit_dialog`。
- **高级功能的锁点**，每个都带位置埋点：文件标签 `text_file_tab`、URL 标签 `text_url_tab`、分享 `result_share`、笔记 `result_notes`、查重 `result_plagiarism`、头像 `nav_profile`。统一事件 `Guest Signup CTA Clicked {location}`，还有 `Guest Scan Submitted`。
- 被拦下时输入不丢：文本存回 `pending_ai_check_text`，进入 `guestScanNeedsSignup` 状态；注册/登录完成后回到 `/dashboard?pendingCheck=true`，自动续跑。
- 登录页是合并的 "Login or sign up"：Google、邮箱 6 位验证码或魔法链接、SSO。
- 另有 "email me the results"（`requestTextPredictionEmailResults`），用结果换邮箱。

**一句话总结**：先交付价值（访客用自己的输入就能拿到结果），再在"额度用完"或"想要更多"的那一刻要求注册，而且注册不打断任务。

## 3. DocTalk 现在的流程（2026-11-22 生产环境）

| 步骤 | DocTalk | Pangram |
|---|---|---|
| 首屏 | 动画引用画布（演示，不能输入）+ "Start with a sample doc" + "Sign Up Free" | 可用的输入框 + 示例 chip + 上传 |
| 第一次动手 | 点 CTA → `/demo` 选样例（多一次点击）→ `/d/<id>?question=` 自动提问 | 在 hero 粘贴或点示例，直接出结果 |
| 访客能用自己的内容吗 | **不能**：`POST /api/documents/upload` 是 `require_auth`；`/demo` 写明 "Sign in to upload your own docs" | **能**，每天 20 credits |
| 访客额度 | 每个（IP, 文档）24h 5 条，强制 Flash，10 req/min/IP；阅读器显示 "4/5 questions remaining · Sign in for free credits" | 每天 credits，按访客/设备/网络限额 |
| 注册时机 | 想上传自己的文件时，在产生价值**之前** | 额度用完或点高级功能时，在产生价值**之后** |
| 注册后续跑 | 无（`#auth` 弹窗，登录后需要重新操作） | 有（`pendingCheck`） |
| 锁点埋点 | 有 `landing_cta_clicked` 等，但锁点没有统一的位置维度 | 统一 `Guest Signup CTA Clicked {location}` |

DocTalk 的"样例文档 + 5 条免费"其实已经是轻量的先试后注册，引用跳转、高亮的体验在样例上也完整。**真正的差距是"啊哈时刻"不对**：用户想看的是*自己的* PDF 被精确引用，现在这一步必须先注册。

## 4. 建议（分阶段）

### P0：只改前端，风险低，先做
1. **首屏变成入口，不只是演示。** hero 下方（或 `/demo` 顶部）放：
   - 样例 chip："Try an example: Earnings release · Research paper · Court filing"，直接进 `/d/<id>?question=…`，省掉 `/demo` 这一步；
   - 一个拖拽区 "Drop a PDF, DOCX or paste a URL"。
   注意营销页的设计约束：Night 表面、每个视图只有一个实心 `.ed-cta`、`.ed-glass` 只能用在功能层（见 `.claude/rules/frontend.md`）。
2. **待上传续跑（照搬 `pendingCheck`）。** 访客拖入文件 → 把 `File` 存进 IndexedDB（大小受 IndexedDB 限制，所以不用 localStorage）→ 弹认证框，文案类似 "Your file is ready. Sign in free to start, no card needed" → OAuth 或魔法链接回来后自动上传，然后进阅读器。魔法链接要是在另一台设备上打开，IndexedDB 里没有文件，就给一句"请重新拖入"作为兜底。
   这一步还是"先注册后出结果"，但把注册前后的断裂消掉了。
3. **统一锁点埋点**：Quote Finder、导出、分享、第二个文档、会话上限、额度耗尽都发 `guest_signup_cta_clicked {location}`（`frontend/src/lib/analytics.ts` 的 `trackEvent`），这样能看出哪个锁点最能带来注册。
4. **额度提前讲清楚**：hero 和 `/demo` 都放一枚像 "5 free questions per document, no sign-up" 那样的徽章（跟现有营销承诺一致，11 种语言都要更新）。

### P1：真正的访客上传（Pangram 模式），需要后端，放在开关后面做实验
- **范围**：每个访客 24h 内 1 个文档，≤20 页 / ≤10 MB，PDF / DOCX / TXT / MD。先不开 URL 导入（SSRF 攻击面，Pangram 也锁了 URL 标签），不开版面翻译（成本敏感，CLAUDE.md 禁止绕过），只用 Flash，3–5 个问题，Quote Finder 继续是锁点。
- **身份**：签名的 httpOnly 访客 cookie（`guest_id`）+ 现有 HMAC IP 信任链 + 可选设备哈希；上传时按风险触发 Turnstile；全局每日上限；开关 `GUEST_UPLOAD_ENABLED`。
- **存储与生命周期**：R2 前缀 `guest/`，`documents.user_id` 为 NULL 并带 `guest_id`，不进公开列表；beat 任务 24–72h 后删除对象、向量和行（要同时清理 Qdrant 与 R2，参照现有删除路径）；隐私文案写清保留时长。
- **注册后认领**：`POST /api/guest/claim` 凭访客 cookie 把文档转给新用户，单个事务完成；遵守行锁顺序 `documents` 先于 `users`；认领后计入新用户的文档槽位和页数上限。
- **入口上限**：继续走现有的页数计数和密码 PDF 拒绝逻辑，在写对象存储和插入 `documents` 之前就拒绝。
- **成本**：20 页的解析 + embedding 加 5 条 Flash 回答，单次成本很低。主要风险是滥用和违法内容存储，靠限额、TTL 和开关控制。
- **指标**：guest_upload_started / parsed / first_answer / signup / claim，和现有 demo → 注册转化率对比。

### P2：后续可选
- 用回答换邮箱："把这个回答和引用发到我的邮箱"。
- 访客分享链接作为锁点。

## 5. 建议的顺序
先做 P0（1–2 天，纯前端，收益是减少流失、拿到锁点数据），观察 1–2 周；P0 的数据如果显示"拖入文件后放弃注册"的比例高，再上 P1。P1 动到认证、计费和存储，按 CLAUDE.md 要走 Claude → Codex 多轮评审。

## 6. P0 实现记录（2026-11-22）

做了什么：
- `lib/pendingUpload.ts`：IndexedDB 暂存，读取和删除在同一个 readwrite 事务里完成（只能取一次），30 分钟过期，浏览器拒绝存储时返回失败，照常登录。
- `components/marketing/GuestUploadEntry.tsx`：首页 hero 的次要操作从 "Sign Up Free" 换成 "Try your own document"（`.ed-link`）；`/demo` 样例卡片下方加了虚线拖拽区（`.ed-cta-quiet`）。
- 认证弹窗：从这条路径打开时，标题是 "Your document is ready"，并显示文件名；回调地址 `/?resumeUpload=1`。
- dashboard：只有带 `?resumeUpload` 时才取出文件，走原来的 `onFiles` 上传（服务端的所有上限照常生效），埋点 `document_upload_created {source: 'pending_upload_resume'}`。
- `lib/uploadFormats.ts`：支持的格式列表抽出来，dashboard 和访客入口共用。
- 所有 `openAuthModal` 调用都带 `location`；`auth_modal_opened` / `auth_provider_clicked` 带 `location` 和 `pending_upload`。
- `/demo` 额度说明改为 "5 free questions per document · no sign-up needed"。11 种语言都已补齐。

和 §4 计划的偏差：
1. **hero 没有加样例 chip 和拖拽区**，只替换了次要操作。hero 的 "一个主张、一句话、一个实心操作、不要数据带" 是 owner 的设计决定（plan 2026-09-20 §5.2，HeroSection 文件头注释）；完整拖拽区放在 `/demo`。要在 hero 加 chip，需要 owner 先改这条决定。
2. **埋点没有新增事件名**：给现有的 `auth_modal_opened` / `auth_provider_clicked` 加了 `location` 字段，后端白名单不用改，也就没有"后端先部署"的顺序要求。
3. **续跑必须带 `?resumeUpload`**（计划里写的是只要 IndexedDB 里有文件就续跑）：共享电脑上，B 从页头正常登录时，不能把 A 留下的文件传进 B 的账户。
4. 额度徽章只放在 `/demo`，hero 没有放，原因同第 1 条。

验证：`npm run build` 通过，`/` 和 `/demo` 仍是静态页；`npm run test:unit` 436/436 通过（新增 `tests/guest-pending-upload.test.cjs`，内含 IndexedDB 内存实现，测了只取一次、过期删除、替换、浏览器拒绝四种情况）；在 `next start` 下用 Playwright 走了一遍：hero 选择不支持的格式会报错，选 PDF 会弹出带文件名的认证框，IndexedDB 里有这个文件；mock 掉会话和上传接口后，不带参数访问 0 次上传，带参数 1 次上传、参数被清掉，刷新后不会重复上传；iPhone 13 视口下没有横向溢出。

没验证：真实的 Google/Microsoft/邮件登录往返（本地没配登录提供方）。上线后需要在预览环境走一遍：hero → 选文件 → 邮件魔法链接 → 自动上传。

### 6.1 独立评审后的修复（2026-11-22）

本地云环境没有 codex CLI，所以先用一个独立子代理做了对抗评审（只读）。没有 blocker，3 个 major 都已修：
1. **固定的 `?resumeUpload=1` 能被利用**（major）：共享电脑上，书签、历史记录或构造的 `/auth?callbackUrl=%2F%3FresumeUpload%3D1` 都能把上一位访客的文件传进别人的账户。改为每次保存生成 128 位随机 nonce，和文件存在一起，回调带 `?resumeUpload=<nonce>`；只有 nonce 匹配才交出文件，不匹配时原样保留。
2. **过期文件一直留在浏览器里**（major）：以前只在取文件时删除过期项。现在根布局的 AuthModal 每次加载页面都会清理过期项（只有设置了 localStorage 标记时才打开 IndexedDB），退出登录（`clearAccountStorage`）时直接清空。
3. **本地化页面首屏是英文**（major）：`guestUpload.` 加进了 `LANDING_PREFIXES` 和 `DEMO_PREFIXES`，并加了测试。
次要问题：已登录用户选文件后直接上传，不再弹登录框；续跑会等 profile 加载完（埋点和上限用真实套餐）；文件取不到时 dashboard 会提示"请重新选择"；"浏览器无法保留文件"的提示改为在弹窗里显示；链接按钮加了 disabled 样式；`onversionchange` 时关闭数据库连接。
没改：FinalCTA 的 `#auth` 链接被 Ctrl/中键点击时，本标签页会残留 `final_cta` 这个 location，影响很小。

复验：`npm run test:unit` 446/446；`npm run build` 通过，`/` 和 `/demo` 仍是静态页。浏览器里在同一个上下文中先未登录选文件、再 mock 成已登录：`?resumeUpload=1` 和错误 nonce 都是 0 次上传并显示提示；正确 nonce 1 次上传，埋点 `plan: plus`；重放不会重复上传；已登录用户在 `/demo` 选文件时不弹登录框，直接上传；`/zh` 和 `/de/demo` 的服务端 HTML 已经是译文。

**仍需在本地补跑 Codex 对抗评审**（CLAUDE.md 要求，云端没有 codex CLI）。
