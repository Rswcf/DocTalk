# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workflow Protocol

When user asks to implement a plan or make code changes, ALWAYS delegate execution to Codex (`gpt-5.3-codex`) unless explicitly told otherwise. Claude's role is **architect/reviewer**, Codex's role is **implementer**. Use `codex exec --full-auto` for non-interactive execution.

---

## 项目概述

DocTalk 是一款面向高强度文档阅读者的 Web App，帮助用户在超长文档中通过 AI 对话快速定位关键信息，回答绑定原文引用并实时高亮跳转。支持 PDF、DOCX、PPTX、XLSX、TXT、Markdown 文件上传及网页 URL 导入。

### 线上部署

| 组件 | URL |
|---|---|
| **Frontend** (Vercel) | https://doctalk-liard.vercel.app |
| **Backend** (Railway) | https://backend-production-a62e.up.railway.app |
| **GitHub** | https://github.com/Rswcf/DocTalk |

Railway 项目包含 5 个服务：backend, Postgres, Redis, qdrant-v2, minio-v2。

### 技术栈

- **Frontend**: Next.js 14 (App Router) + Auth.js v5 + jose (JWT) + react-pdf v9 (pdf.js v4) + Remotion (animated product showcase) + react-resizable-panels + Zustand + Tailwind CSS (zinc palette) + Radix UI + Inter font (next/font/google)
- **Backend**: FastAPI + Celery + Redis
- **Database**: PostgreSQL 16 (Alembic migration) + Qdrant (向量搜索)
- **Storage**: MinIO (dev) / S3-compatible (prod)
- **Auth**: Auth.js (NextAuth) v5 + Google OAuth + JWT
- **Payments**: Stripe Checkout + Webhooks
- **LLM/Embedding**: 统一通过 **OpenRouter** 网关调用
  - LLM: 3 种性能模式（Quick: DeepSeek V3.2 / Balanced: Mistral Medium 3.1 / Thorough: Mistral Large 2512），前端用户通过 ModeSelector 切换
  - Demo LLM: `deepseek/deepseek-v3.2`（匿名 Demo 用户使用低成本模型，降低 OpenRouter 消耗）
  - Embedding: `openai/text-embedding-3-small` (dim=1536)
- **PDF Parse**: PyMuPDF (fitz)
- **Document Parse**: python-docx (DOCX), python-pptx (PPTX), openpyxl (XLSX), httpx + BeautifulSoup4 (URL)
- **i18n**: 轻量级 React Context 方案，支持 11 种语言（EN, ZH, ES, JA, DE, FR, KO, PT, IT, AR, HI）
- **Monitoring**: Sentry 集成（后端 FastAPI + Celery，前端 Next.js），用于错误追踪和性能监控
- **Analytics**: Vercel Web Analytics（页面访问和访客追踪，需 cookie 同意后加载）
- **Security**: SSRF 防护（URL 验证 + 私有 IP 阻断）、MinIO SSE-S3 静态加密、magic-byte 文件验证、结构化安全事件日志、非 root Docker 容器

### 核心架构决策

- **认证**: Auth.js v5 + Google OAuth，JWT 策略，后端通过 `require_auth` 依赖校验
- **API 代理**: 前端所有后端请求（含 SSE chat stream）通过 `/api/proxy/*` 路由，自动注入 Authorization header
- **分层认证模型**:
  - 未登录: 可试用 Demo（3 篇真实 PDF，5 条消息限制，服务端 + 客户端双重限制，匿名用户强制使用 DeepSeek V3.2（低成本）且隐藏 ModeSelector，IP 级速率限制 10 req/min）
  - 已登录: 可上传个人 PDF，服务端文档列表，Credits 系统；访问 Demo 文档使用 Credits，无消息限制
- **Demo 系统**: 后端启动时自动种子 3 篇真实文档（NVIDIA 10-K、Attention 论文、NDA）到 MinIO + DB，通过 Celery 解析。`demo_slug` 列标识 Demo 文档，`is_demo` 属性暴露给前端。`GET /api/documents/demo` 返回 Demo 文档列表。`/demo` 页面从 API 获取文档 ID 后链接到 `/d/{docId}`，旧 `/demo/[sample]` 路由自动重定向
- **Credits 系统**: 预付费模式，余额 + Ledger 双表记录。三阶段扣费：① chat 端点按模式预估余额检查（402 不足） → ② `chat_service` 调用 `pre_debit_credits()` 在流式输出前扣除预估额（`MODE_ESTIMATED_COST`: quick=5, balanced=15, thorough=35） → ③ 流式结束后 `reconcile_credits()` 按实际 token 计算差额退补。注册赠送 `SIGNUP_BONUS_CREDITS`（默认 1,000）
- **订阅系统**: Free (500 credits/月) + Plus (3,000 credits/月, $9.99) + Pro (9,000 credits/月, $19.99) 三级，支持月付/年付（年付享 20% 折扣），月度 credits 惰性发放（`ensure_monthly_credits`），Stripe 订阅集成
- **模式门控**: Thorough 模式（深度分析）仅限 Plus+ 套餐使用，后端 `chat_service.py` 校验 + 前端 `ModeSelector.tsx` 锁定图标。ModeSelector 根据认证状态显示不同 CTA：匿名用户点击锁定模式 → 登录模态框（`?auth=1`），已登录免费用户 → `/billing`。chat 端点在进入流式前按 `MODE_ESTIMATED_COST` 预检余额，不足返回 402 + `required`/`balance` 字段
- **Profile 页面**: `/profile` 4 个 Tab (Profile/Credits/Usage/Account)，含交易历史、使用统计、账户删除
- **API 网关**: 所有 LLM 和 Embedding 调用统一通过 OpenRouter（单一 API key）。匿名 Demo 用户使用 `DEMO_LLM_MODEL`（默认 `deepseek/deepseek-v3.2`）降低成本
- **模式切换**: 前端用户可选择性能模式（Quick/Balanced/Thorough），后端映射到具体模型并通过 OpenRouter 调用
- **模型自适应提示**: `model_profiles.py` 为每个模型定义独立的 `ModelProfile`（temperature、max_tokens、supports_cache_control、supports_stream_options、prompt_style）。`chat_service.py` 根据模型 profile 动态调整系统提示规则和 API 参数。2 种 prompt_style 变体：`default`（Mistral/GPT/Qwen 等通用模型）、`positive_framing`（DeepSeek — 避免消极表述过度遵从）。`stream_options` 对所有模型启用（OpenRouter 统一支持）
- **AI 回答语言**: 跟随用户提问语言（"Your response language MUST match the language of the user's question"），不受前端 UI locale 影响。前端 locale 仅控制界面文字展示
- **RAG 基准测试**: `backend/scripts/` 包含 48 个测试用例（10 类别 × 3 demo 文档）、自动化 benchmark runner（`run_benchmark.py`）和评估器（`evaluate_benchmark.py`，8 维度自动评分 + 可选 LLM-as-judge）。评估维度：引用准确度、信息完整度、幻觉率、语言合规、Markdown 质量、指令遵从、否定案例准确度、首 token 延迟
- **布局**: Chat 面板在左侧, PDF 查看器在右侧，中间可拖拽调节宽度 (react-resizable-panels)
- **i18n**: 客户端 React Context，11 语言 JSON 静态打包，`t()` 函数支持参数插值，Arabic 自动 RTL
- **bbox 坐标**: 归一化 [0,1], top-left origin, 存于 chunks.bboxes (JSONB)
- **引用高亮双策略**: PDF 文档使用 bbox 坐标定位高亮区域（PageWithHighlights）；非 PDF 文档使用 textSnippet 文本匹配定位高亮（TextViewer `findSnippetInPage()` 渐进前缀搜索）。Store 中 `highlights`（bbox）和 `highlightSnippet`（文本）由 `navigateToCitation` 同时设置
- **引用格式**: 编号 [1]..[K]，后端 FSM 解析器处理跨 token 切断；前端 `renumberCitations()` 按出现顺序重编号为连续序列
- **PDF 文件获取**: presigned URL (不走后端代理)
- **向量维度**: 配置驱动 (EMBEDDING_DIM)，启动时校验 Qdrant collection
- **删除**: 同步 ORM cascade delete（pages, chunks, sessions, messages），返回 202；同时 best-effort 清理 MinIO 文件和 Qdrant 向量。清理失败时通过 `deletion_worker.py` Celery 重试任务（3 次重试，指数退避）兜底，并记录结构化安全日志
- **会话管理**: 每文档支持多个独立对话会话，重新打开文档自动恢复最近活跃会话
- **OCR 支持**: 扫描版 PDF 自动通过 PyMuPDF 内置 Tesseract OCR 提取文字（`extract_pages_ocr()`），支持中英文（`eng+chi_sim`），可配置 DPI。流程：`detect_scanned()` → 设 status="ocr" → OCR 提取 → 验证文字量 ≥50 chars → 继续正常 parsing/embedding 流程
- **CI/CD**: GitHub Actions 3 并行 job — backend（ruff lint + pytest）、frontend（eslint + next build）、docker（Dockerfile 构建验证）
- **Chunking 配置**: TARGET_MIN_TOKENS=150, TARGET_MAX_TOKENS=300, top_k=8 检索。小分块提升引用精准度，所有 bbox 不再限制数量（原先限制 5 个）
- **引用 snippet**: text_snippet 前置 section_title，截取长度 100 chars（原先 80 chars 无标题）
- **文档重解析**: `POST /api/documents/{document_id}/reparse` 端点允许已登录用户重新解析 ready/error 状态的文档
- **自动摘要**: 文档 ready 后，Celery 调用 `summary_service.generate_summary_sync()` 加载前 20 个 chunks → 调用 DeepSeek 生成摘要 + 5 个推荐问题 → 存入 `documents.summary` (Text) + `documents.suggested_questions` (JSONB)。尽力而为，失败不影响文档状态
- **推荐问题**: 前端 ChatPanel 优先显示文档特定的 `suggestedQuestions`，无则回退到静态 i18n keys
- **消息重新生成**: ChatPanel `handleRegenerate` 截取到最后一条用户消息，重新 chatStream
- **对话导出**: `export.ts:exportConversationAsMarkdown()` 构建 Markdown + 引用脚注 → Blob 下载
- **PDF 文本搜索**: PdfViewer 通过 pdfjs `page.getTextContent()` 提取全文 → store 中 searchQuery/searchMatches/currentMatchIndex → customTextRenderer `<mark>` 高亮 → PdfToolbar 搜索 UI
- **TextViewer 文本搜索**: Ctrl+F 打开搜索栏，大小写不敏感全文搜索，匹配计数 "X/Y"，上下翻页导航，当前匹配 amber 高亮 + 其他匹配 yellow 高亮，与引用高亮共存
- **FAQ 手风琴**: `landing/FAQ.tsx` 6 项展开/折叠，`transition-[max-height,opacity]` 动画
- **Footer 组件**: `Footer.tsx` 3 列 (Product/Company/Legal) + 版权底栏。Company 列含 Contact 链接，Legal 列含 CCPA "Do Not Sell My Info" 链接
- **FinalCTA**: `landing/FinalCTA.tsx` 转化 CTA (Try Demo + Sign Up)
- **套餐对比表**: `PricingTable.tsx` Free vs Plus vs Pro 9 行对比，Check/X 图标，Plus 列 "Most Popular" 高亮
- **自定义 AI 指令**: 每文档可设置 `custom_instructions`（最多 2000 字），通过 `PATCH /api/documents/{id}` 更新，`chat_service.py` 注入系统提示
- **多格式支持**: DOCX/PPTX/XLSX/TXT/MD 文件通过 `backend/app/services/extractors/` 格式专用提取器处理，然后进入与 PDF 相同的分块+向量化流水线。`parse_worker.py` 按 `file_type` 分流。DOCX 提取器遍历 body 元素交错获取段落和表格（markdown table 格式）。XLSX 输出 markdown table（表头+分隔+数据行）。PPTX 提取幻灯片文本、表格和演讲者备注
- **URL/网页导入**: `POST /api/documents/ingest-url` 端点接收 URL，经 `url_validator.py` SSRF 防护（DNS 解析 + 私有 IP 阻断 + 端口白名单 + 最多 3 次手动重定向验证）后，通过 httpx 抓取 + BeautifulSoup 提取文本，存为 txt 文件处理。PDF URL 自动走 PDF 流水线。前端 Dashboard 提供 URL 输入框
- **文档集合**: `Collection` 模型 + `collection_documents` 多对多关联表，支持跨文档问答。`retrieval_service.search_multi()` 使用 Qdrant `MatchAny` 过滤器。`chat_service.py` 为集合会话构建跨文档系统提示，引用事件包含 `document_id` 和 `document_filename`。前端 `/collections` 列表页 + `/collections/[id]` 详情页（左侧 Chat + 右侧文档列表）
- **Vercel Web Analytics**: `@vercel/analytics` 通过 `AnalyticsWrapper.tsx` 条件加载（仅在用户 cookie 同意后），`CookieConsentBanner.tsx` 提供 Accept/Decline 选择，consent 状态存储在 localStorage
- **产品展示动画**: Remotion `<Player>` 驱动的 landing page 动画演示（`ProductShowcase.tsx`）。300帧@30fps=10s循环。动画序列：用户消息弹入→打字点→AI流式输出（`text.slice(0, chars)` + 闪烁光标）→PDF高亮渐现（`spring()` → `scaleX`）→引用卡片交错弹入→静态保持→交叉淡出循环。所有动画使用 `useCurrentFrame()` + `interpolate()`/`spring()`，禁止 CSS transition/animation。`ShowcasePlayer.tsx` lazy-load Player + 骨架屏，通过 `useTheme()` 传递 `isDark` prop 实现 dark mode

### API 路由

```
# 文档管理
GET    /api/documents                     # 列出用户文档 (?mine=1)
GET    /api/documents/demo                # 列出 Demo 文档 (slug, document_id, status)
POST   /api/documents/upload              # 上传文档 (PDF/DOCX/PPTX/XLSX/TXT/MD, 需登录)
POST   /api/documents/ingest-url         # 导入网页 URL (需登录)
GET    /api/documents/{document_id}       # 查询文档状态
GET    /api/documents/{document_id}/text-content  # 获取非 PDF 文档的文本内容 (优先 Page.content，回退 chunk 重建)
PATCH  /api/documents/{document_id}       # 更新文档设置 (custom_instructions)
DELETE /api/documents/{document_id}       # 删除文档（ORM cascade，同步删除）
POST   /api/documents/{document_id}/reparse  # 重新解析文档（需登录，ready/error 状态）
GET    /api/documents/{document_id}/file-url  # 获取 presigned URL
POST   /api/documents/{document_id}/search    # 语义搜索
POST   /api/documents/{document_id}/sessions  # 创建聊天会话
GET    /api/documents/{document_id}/sessions  # 列出文档的聊天会话

# 会话与对话
GET    /api/sessions/{session_id}/messages    # 获取历史消息
POST   /api/sessions/{session_id}/chat        # 对话（SSE streaming, 可选 model 字段；匿名用户速率限制 10 req/min/IP；Demo 匿名用户限 5 条消息 + 强制默认模型，超限返回 429）
DELETE /api/sessions/{session_id}             # 删除聊天会话

# Credits & Billing
GET    /api/credits/balance               # 获取余额
GET    /api/credits/history               # 交易历史 (?limit=20&offset=0)
POST   /api/billing/checkout              # 创建 Stripe Checkout (一次性购买)
POST   /api/billing/subscribe             # 创建 Stripe Subscription Checkout (Pro)
POST   /api/billing/portal                # 创建 Stripe Customer Portal
GET    /api/billing/products              # 列出 credit packs (starter/pro/enterprise)
POST   /api/billing/webhook               # Stripe Webhook

# 用户
GET    /api/users/me                      # 基本用户信息
GET    /api/users/me/export               # GDPR 数据导出 (JSON，包含用户所有数据)
GET    /api/users/profile                 # 完整 Profile (含 stats, plan, accounts)
GET    /api/users/usage-breakdown         # 按模型分组的使用统计
DELETE /api/users/me                      # 删除账户 (级联清理)

# 管理后台 (require_admin 保护)
GET    /api/admin/overview               # KPI 概览 (用户数/文档数/token/credits)
GET    /api/admin/trends                 # 时间序列趋势 (?period=day&days=30)
GET    /api/admin/breakdowns             # 分类统计 (套餐/模型/文件类型/文档状态)
GET    /api/admin/recent-users           # 最近注册用户 (?limit=20)
GET    /api/admin/top-users              # 活跃用户排行 (?by=tokens&limit=20)

# 内部 Auth (Adapter)
POST   /api/internal/auth/users           # 创建用户
GET    /api/internal/auth/users/{id}      # 获取用户
GET    /api/internal/auth/users/by-email/{email}          # 按邮箱查询用户
GET    /api/internal/auth/users/by-account/{provider}/{id} # 按 OAuth 账户查询用户
PUT    /api/internal/auth/users/{id}      # 更新用户
DELETE /api/internal/auth/users/{id}      # 删除用户
POST   /api/internal/auth/accounts        # Link 账户
DELETE /api/internal/auth/accounts/{provider}/{id}  # Unlink 账户
POST   /api/internal/auth/verification-tokens       # 创建验证 Token
POST   /api/internal/auth/verification-tokens/use   # 使用验证 Token

# 文档集合
GET    /api/collections                   # 列出用户集合
POST   /api/collections                   # 创建集合 (name, description?, document_ids?)
GET    /api/collections/{id}              # 获取集合详情 (含文档列表)
DELETE /api/collections/{id}              # 删除集合 (保留文档)
POST   /api/collections/{id}/documents    # 添加文档到集合
DELETE /api/collections/{id}/documents/{doc_id}  # 从集合移除文档
POST   /api/collections/{id}/sessions     # 创建集合聊天会话
GET    /api/collections/{id}/sessions     # 列出集合的聊天会话

# 其他
GET    /api/chunks/{chunk_id}             # 获取 chunk 详情
GET    /health                            # 健康检查

```

---

## 常用开发命令

```bash
# 启动基础设施（PostgreSQL, Qdrant, Redis, MinIO）
docker compose up -d

# 后端（从 backend/ 目录运行）
cd backend && python3 -m uvicorn app.main:app --reload

# 前端（从 frontend/ 目录运行）
cd frontend && npm run dev

# 数据库迁移
cd backend && python3 -m alembic upgrade head

# Celery worker（macOS 需要设置 fork 安全变量）
cd backend && OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES python3 -m celery -A app.workers.celery_app worker --loglevel=info -Q default,parse
```

> **生产部署**: `entrypoint.sh` 进程管理器在单容器内编排：Alembic migration → Celery worker（后台，`--concurrency=1`，崩溃自动重启）→ uvicorn（前台）。支持 SIGTERM 优雅关闭（先停 Celery 再停 uvicorn）。本地开发时仍需分别启动。

### 环境变量

后端配置通过 `.env` 文件加载（根目录或 backend/ 目录）。关键变量：

```bash
# 必需
DATABASE_URL=postgresql+asyncpg://...
OPENROUTER_API_KEY=sk-or-...
AUTH_SECRET=<随机字符串>
ADAPTER_SECRET=<随机字符串>

# 支付 (可选)
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO_MONTHLY=price_...  # Stripe recurring price ID for Pro plan

# OAuth (前端)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# OCR (可选，默认值即可)
OCR_ENABLED=true
OCR_LANGUAGES=eng+chi_sim
OCR_DPI=300

# 监控 (可选)
SENTRY_DSN=https://...@sentry.io/...
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
```

前端需要设置：
- `NEXT_PUBLIC_API_BASE`: 后端 URL（本地默认 `http://localhost:8000`）
- `AUTH_SECRET`: 与后端一致
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: Google OAuth
- `NEXT_PUBLIC_SENTRY_DSN`: (可选) Sentry DSN 用于前端错误追踪

### 部署

#### Vercel (前端)

- Root Directory 配置为 `frontend/`，使用 `git push` 自动部署（GitHub 集成）
- **不要**从 `frontend/` 目录运行 `vercel --prod`，否则 Root Directory 设置不生效
- Root Directory 必须在 **Vercel Dashboard** 中更改，**不能**通过 vercel.json 设置
- `NEXT_PUBLIC_API_BASE` 必须指向 Railway 生产 URL，**绝对不能**是 localhost
- GitHub 自动部署到 Vercel — 不需要手动 `vercel` CLI 部署，除非明确要求

#### Railway (后端)

- 从项目根目录运行 `railway up --detach`
- `entrypoint.sh` 进程管理器：Alembic migration → Celery worker (后台, concurrency=1, 崩溃自动重启) → uvicorn (前台)
- SIGTERM 优雅关闭：trap 信号 → 先停 Celery 再停 uvicorn
- 确保 Dockerfile 路径配置正确，验证 Docker Image 服务不接受 start 命令。容器以非 root 用户 `app` (UID 1001) 运行
- 部署后始终确认后端运行的是**最新代码**（避免过时部署）
- 测试前检查本地端口冲突

---

## 重要约定 / Gotchas

### 安全相关
- **上传/删除需登录**: `upload_document` 和 `delete_document` 使用 `require_auth` 依赖，未登录返回 401
- **搜索支持可选认证**: `search_document` 使用 `get_current_user_optional`，已登录用户可搜索自己的文档，匿名用户可搜索 demo 文档
- **Demo 会话上限**: 匿名用户每个 demo 文档最多创建 500 个会话 (`DEMO_MAX_SESSIONS_PER_DOC=500`)，超限返回 429。上限较大是因为全局计数（含已登录用户的会话），真正的保护是每会话 5 条消息限制
- **匿名速率限制**: `rate_limit.py` 提供内存级 token-bucket 速率限制器，匿名用户 chat 端点限制 10 req/min/IP，超限返回 429 + `Retry-After` header。bucket 字典超过 10K 条目时自动清理过期条目
- **匿名 Demo 模型强制**: 匿名用户在 Demo 文档上的 chat 请求忽略 `model` 参数，强制使用 `settings.DEMO_LLM_MODEL`（默认 `deepseek/deepseek-v3.2`），通过 OpenRouter 调用。防止通过 API 直接调用高成本模型
- **Admin 端点**: 旧无鉴权端点已移除，新增 `require_admin`（邮箱白名单）保护的分析端点
- **依赖已锁定**: `requirements.txt` 中所有依赖版本已 pin（`==`），防止供应链攻击
- **SSRF 防护**: `url_validator.py` 对 URL 导入端点执行 DNS 解析，阻断 RFC 1918/链路本地/云元数据地址段的私有 IP，封锁内部服务端口（5432/6379/6333/9000），手动跟踪最多 3 次重定向并在每跳验证目标安全性
- **Magic-byte 文件验证**: 上传时检查 PDF `%PDF` 头、Office ZIP 结构 + `[Content_Types].xml`，以及 500MB zip bomb 保护
- **MinIO SSE-S3 静态加密**: 所有 `put_object()` 调用附加 `SseS3()` + bucket 默认加密策略
- **Per-plan 文档/文件限制**: FREE_MAX_DOCUMENTS=3, PLUS_MAX_DOCUMENTS=20, PRO_MAX_DOCUMENTS=999；按套餐文件大小限制（25/50/100 MB）在上传端点实际校验
- **文件名清洗**: `sanitizeFilename()` 执行 Unicode 规范化、控制字符剥离、双扩展名阻断（.pdf.exe → _pdf.exe）、200 字符截断
- **删除验证**: 结构化安全日志替代静默 `except: pass`；MinIO/Qdrant 清理失败时排入 `deletion_worker.py` Celery 重试任务（3 次重试，指数退避）
- **安全事件日志**: `security_log.py` 输出结构化 JSON 日志，覆盖认证失败、速率限制命中、SSRF 阻断、上传、删除、账户删除等事件
- **GDPR 数据导出**: `GET /api/users/me/export` 返回包含用户所有数据的 JSON（GDPR Art. 20 数据可携带性）
- **OAuth Token 清理**: `link_account()` 中剥离 access_token/refresh_token/id_token — DocTalk 仅需身份信息
- **非 root Docker**: 容器以 `app` 用户（UID 1001）运行

### 认证相关
- **API 代理**: 所有后端接口（含 SSE chat stream）通过 `/api/proxy/*` 走前端代理，自动注入 JWT
- **JWT 双层设计**: Auth.js v5 使用加密 JWT (JWE)，后端无法直接解密。API 代理使用 `jose` 库创建后端兼容的明文 JWT (HS256)，包含 sub/iat/exp claims
- **JWT 校验**: 后端 `deps.py` 验证 exp/iat/sub claims
- **Adapter Secret**: 内部 Auth API 使用 `X-Adapter-Secret` header 校验
- **OAuth Token 清理**: `auth_service.py:link_account()` 剥离 OAuth 提供商返回的 access_token/refresh_token/id_token，DocTalk 仅保存身份绑定信息（provider + provider_account_id），不存储可用于访问用户第三方账户的令牌

### 前端相关
- **UI 设计**: 单色 zinc 调色板，Inter 字体 + `antialiased` 字体渲染，dark mode 反转按钮 (`bg-zinc-900 dark:bg-zinc-50`)，全站无 `gray-*`/`blue-*` 类（保留 Google OAuth 品牌色和状态色）。卡片使用 `shadow-sm`/`shadow-md` 分层，模态框 `animate-fade-in`/`animate-slide-up` 动画，零 `transition-all` 策略（所有过渡使用具体属性 `transition-colors`/`transition-opacity`/`transition-shadow`）。Tailwind Typography 配置：prose 正文颜色覆盖为 zinc-950（`#09090b`，近纯黑，替代默认 gray-700 `#374151`），dark mode 为 zinc-50（`#fafafa`）；内联 `code` 去除反引号装饰 + 灰色背景药丸样式；段落/列表间距收紧
- **Header variant**: `variant='minimal'`（首页/Demo/Auth：仅 Logo+UserMenu）vs `variant='full'`（文档页/Billing/Profile：完整控件）。额外支持 `isDemo`/`isLoggedIn` props，匿名 Demo 用户时隐藏 ModeSelector
- **Landing page**: HeroSection（大字标题+CTA）+ **ProductShowcase**（Remotion `<Player>` 动画演示：用户提问→AI流式引用回答→PDF高亮同步，300帧@30fps=10s循环，macOS window chrome 框架，lazy-loaded，支持 dark mode）+ **HowItWorks**（3步骤：Upload→Ask→Cited Answers）+ FeatureGrid（3列特性卡片）+ **SocialProof**（4项信任指标）+ **SecuritySection**（4张安全卡片）+ **FAQ**（6项手风琴）+ **FinalCTA**（转化CTA）+ PrivacyBadge + **Footer**（3列链接组件）
- **动态 CTA**: 首页根据登录状态显示不同 UI（未登录→Landing page，已登录→Dashboard 上传区+文档列表）
- **AuthModal**: 使用查询参数 `?auth=1` 触发登录模态框，ESC 可关闭，焦点陷阱（Tab 循环），backdrop 点击关闭。底部显示 AI 处理披露（`auth.aiDisclosure`：文档由第三方 AI 服务处理）和服务条款通知（`auth.termsNotice`）
- **Cookie 同意**: `CookieConsentBanner.tsx` 底部横栏提供 Accept/Decline 按钮，控制 Vercel Analytics 加载（`AnalyticsWrapper.tsx` 条件渲染），consent 存储在 localStorage
- **CCPA 合规**: Footer Legal 列新增 "Do Not Sell My Info" 链接
- **数据导出**: Profile AccountActionsSection 新增 "Download My Data" 按钮，调用 `GET /api/users/me/export` 下载用户全部数据 JSON
- **隐私声明修正**: 11 种语言的 i18n 文件中移除了虚假声明（"端到端加密"、"30 天自动删除"、"不与第三方共享"、"我们不保留任何内容"），替换为准确描述
- **Demo 模式**: `/demo` 页面从后端 `GET /api/documents/demo` 获取真实文档列表，显示 "5 free messages" 提示信息，链接到 `/d/{docId}`；ChatPanel 通过 `maxUserMessages` prop 实现客户端 5 条限制 + 进度条（剩余 ≤2 时 amber 警告色）+ 登录 CTA；旧 `/demo/[sample]` 路由自动重定向到新路径。匿名用户在 Demo 文档页面 Header 中隐藏 ModeSelector（通过 `isDemo`/`isLoggedIn` props 控制）
- **文档列表**: 服务端 + localStorage 合并，服务端优先
- **前端全部 `"use client"`**: 无 SSR，所有页面和组件均为客户端渲染
- **所有 API 走代理**: REST 和 SSE (chat stream) 均通过 `PROXY_BASE` (`/api/proxy`) 路由，`sse.ts` 的 `chatStream()` 也走代理以注入 JWT
- **Proxy maxDuration**: `route.ts` 导出 `maxDuration = 60`（Vercel Hobby 上限），SSE chat 使用 60s fetch timeout，其他请求 30s
- **UserMenu 替代 AuthButton**: Header 中 `AuthButton` 已被 `UserMenu` 下拉菜单替代，未登录时仍显示 Sign In 按钮
- **Profile 页面**: `/profile?tab=credits` (默认 tab)，受保护路由，未登录重定向到 `/auth?callbackUrl=/profile`
- **Billing 页面**: 月付/年付切换 + Plus 订阅卡片（"Most Popular" 标记）+ Pro 订阅卡片；中间 PricingTable（Free vs Plus vs Pro 9 行对比）；下方 credit packs 卡片 (rounded-xl)
- **Chat UI（ChatGPT 风格）**: AI 消息无卡片/边框/背景，`prose` 级别文本平铺渲染（用户消息 `rounded-3xl` 圆角气泡，浅色模式 `bg-zinc-100`，深色模式 `dark:bg-zinc-700`）。消息区域 + 输入栏使用 `max-w-3xl mx-auto` 居中，宽面板时保持舒适阅读宽度。Copy/ThumbsUp/ThumbsDown/Regenerate 按钮在 AI 消息下方 hover 显示（`opacity-0 group-hover:opacity-100`），最后一条 AI 消息始终可见。输入框为 `rounded-3xl` 药丸形容器（`shadow-sm` 静态阴影 + `focus-within:ring` 聚焦高亮），左侧 "+" 按钮弹出菜单（Custom Instructions + Export Chat），右侧 Send/Stop 按钮切换（streaming 时 Square 图标替换 SendHorizontal）。输入栏下方显示 AI 准确性免责声明（`chat.disclaimer`，11 语言）
- **代码块**: `MessageBubble.tsx` 中 `PreBlock` 组件拦截 `<pre>` 元素，渲染为深色背景代码块（`bg-zinc-900` header + `bg-zinc-900` code body），顶部显示语言标签 + Copy code 按钮。`not-prose` 避免 Typography 样式干扰。内联 `code` 通过 `tailwind.config.ts` Typography 配置渲染为灰色背景药丸（无反引号装饰）
- **Stop 生成**: `sse.ts` 支持 `AbortSignal` 参数，`ChatPanel` 通过 `AbortController` 实现流式中断。Streaming 时 Send 按钮变为 Stop 按钮（Square 图标），点击后立即中止 SSE 连接并保留已生成的部分回答
- **"+" 菜单**: 输入栏左侧 Plus 按钮弹出下拉菜单，包含 Custom Instructions（Settings2 图标，指令已设置时显示翡翠色圆点指示器）和 Export Chat（Download 图标）。替代了原先 page.tsx 中的 Settings2 顶栏和输入框内嵌的 Export 按钮
- **引用卡片（紧凑模式）**: `CitationCard.tsx` 使用 `inline-flex` 紧凑药丸样式（`rounded-lg px-2.5 py-1.5 text-xs`），引用容器为 `flex flex-wrap gap-1.5` 水平排列，替代原先的全宽竖向卡片
- **建议问题药丸**: 空消息状态下建议问题使用 `rounded-full` 药丸按钮 + `flex flex-wrap` 居中排列，替代原先的全宽竖向按钮
- **滚动到底部按钮**: 消息列表滚动离底部 >80px 时，显示浮动 ArrowDown 圆形按钮，点击平滑滚动到底部
- **引用悬浮 Tooltip**: `MessageBubble.tsx` 中引用 `[n]` 按钮悬浮显示 textSnippet + page tooltip，减少验证点击次数
- **流式状态指示**: streaming 时显示 3 点弹跳动画（"搜索文档中..."）和闪烁光标，区分 retrieval 阶段和生成阶段
- **下拉菜单键盘导航**: UserMenu、ModeSelector、LanguageSelector、SessionDropdown 支持 Arrow/Home/End/Escape 键盘操作
- **CreditsDisplay 自动刷新**: 每 60s 轮询 + 自定义事件 `doctalk:credits-refresh`（聊天完成/购买后触发），`triggerCreditsRefresh()` 导出供外部调用
- **Billing 骨架屏**: 产品列表加载中显示 skeleton cards，失败显示 error + retry 按钮
- **响应式**: Header 移动端间距/截断/CreditsDisplay 小屏隐藏，upload zone `p-8 sm:p-12`，billing `p-6 sm:p-8`
- **自定义 AI 指令模态框**: `CustomInstructionsModal.tsx`，通过 ChatPanel "+" 菜单中的 Settings2 图标触发（`onOpenSettings` prop 从 page.tsx 传入），textarea 2000 字限制，Save/Clear 按钮
- **多格式上传**: Dashboard 上传区 accept 属性包含 PDF/DOCX/PPTX/XLSX/TXT/MD 的 MIME 类型和扩展名
- **TextViewer**: 非 PDF 文档使用 `TextViewer.tsx` 显示内容，PDF 文档使用 PdfViewer。支持两种渲染模式：md/docx/pptx/xlsx 使用 react-markdown + remark-gfm 渲染（Tailwind Typography prose 样式，表格带边框和交替行色），txt/url 使用纯文本 `<pre>` 渲染。引用高亮：`highlightSnippet` 通过 `findSnippetInPage()` 渐进前缀匹配定位（amber 背景）。全文搜索：Ctrl+F 打开搜索栏，跨页搜索+匹配计数+上下翻页（黄色高亮）。搜索和引用高亮共存，重叠时引用优先
- **URL 导入**: Dashboard 上传区下方 URL 输入框（Link2 图标 + 输入 + Import URL 按钮），调用 `ingestUrl()` → 跳转到文档页
- **文档集合**: `/collections` 列表页 + `/collections/[id]` 详情页（ChatPanel 左 + 文档列表侧栏右），Header full variant 新增 FolderOpen 集合入口

### 后端相关
- **Celery 用同步 DB**: Worker 使用 `psycopg`（同步），API 使用 `asyncpg`（异步）
- **macOS Celery fork 安全**: 必须设置 `OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES`
- **Credits 三阶段扣费**: ① `chat.py` 按 `MODE_ESTIMATED_COST` 预检余额（402 不足） → ② `chat_service.py` 调用 `pre_debit_credits()` 预扣估算额 → ③ 流式结束后 `reconcile_credits()` 按实际 token 差额退补。`db.flush()` 确保 ledger 在同一事务中写入
- **FOR UPDATE 锁**: 验证 Token 使用行锁防止 TOCTOU 竞态
- **OCR 回退**: `detect_scanned()` 检测到扫描 PDF 后，若 `OCR_ENABLED=true`，设 status="ocr" → 调用 `extract_pages_ocr()` → 验证文字 ≥50 chars → 继续 parsing。PyMuPDF `page.get_textpage_ocr(language=..., dpi=..., full=True)` 需要系统安装 Tesseract（Dockerfile 已包含 `tesseract-ocr-eng` + `tesseract-ocr-chi-sim`）
- **OCR 容错**: 每页独立 try/except，一页 OCR 失败不影响其他页。OCR 文字不足 50 chars 时标记 error
- **Parse worker 幂等**: 重新执行时先删除已有 pages/chunks，重置计数器，避免 UniqueViolation；支持 stuck 文档重试
- **启动自动重试**: `main.py` 的 `on_startup` 在后台线程中检测 status=parsing/embedding 的文档，自动重新分发 parse 任务
- **自动摘要生成**: `summary_service.generate_summary_sync(document_id)` 在 Celery 上下文中调用，加载前 20 个 chunks（max 8K chars），通过 OpenRouter 调用 `deepseek/deepseek-v3.2` 生成 JSON `{summary, questions}`。支持 markdown code fence 解析。不扣 credits（系统生成）。在 `parse_worker.py` 中 ready 后 try/except 调用，失败仅 warning 日志
- **Demo 文档种子**: `on_startup` → `_seed_demo_documents()` → `demo_seed.seed_demo_documents()`，从 `backend/seed_data/` 读取 3 篇 PDF，上传 MinIO 并 dispatch parse。幂等：已 ready 跳过，stuck 重派，error 重建
- **Demo 5 条消息限制**: `chat.py:chat_stream` 中，匿名用户 + demo_slug 文档 → 查询 user messages 数量 → 超过 5 条返回 429。前端 ChatPanel 区分速率限制 429（"Rate limit exceeded" → `demo.rateLimitMessage`）和消息限制 429（→ `demo.limitReachedMessage`）
- **Retrieval 容错**: `chat_service.py` 的 retrieval 调用包裹在 try/except 中，Qdrant 不可用时返回 `RETRIEVAL_ERROR` SSE 事件
- **删除为同步级联**: `doc_service.delete_document()` 使用 ORM cascade 真正删除 DB 记录（非仅标记 status），同时 best-effort 清理 MinIO + Qdrant。清理失败时通过 `deletion_worker.py` Celery 任务重试（3 次，指数退避），所有删除操作记录结构化安全日志
- **文档列表过滤**: `list_documents` 查询排除 `status="deleting"` 的文档
- **月度 Credits 惰性发放**: `ensure_monthly_credits()` 在每次 chat 前检查，30 天周期，ledger 幂等，时区安全
- **Stripe 订阅 Webhook**: `checkout.session.completed` 按 mode 分流 — subscription 模式仅更新 plan（不发 credits，避免与 invoice 双重发放），payment 模式按 payment_intent 幂等发放一次性包 credits；`invoice.payment_succeeded` 按 invoice.id 幂等发放订阅月度 credits；`customer.subscription.deleted` 清除 plan
- **账户删除**: `DELETE /api/users/me` 先取消 Stripe 订阅，再逐文档清理 MinIO+Qdrant，最后 ORM cascade 删除用户

### PDF 相关
- **react-pdf v9 (pdf.js v4.8)**: 从 v7 升级到 v9 以支持 CJK 字体渲染。Worker 文件扩展名从 `.js` 改为 `.mjs`
- **CJK CMap 支持**: CMap 文件（169 个）和标准字体文件（16 个）从 `pdfjs-dist` 复制到 `public/cmaps/` 和 `public/standard_fonts/`。`PDF_OPTIONS` 使用 `window.location.origin` 构建绝对 URL，因为 pdf.js Web Worker 运行在 CDN 域名上，相对路径无法解析。升级 react-pdf 或 pdfjs-dist 后需重新复制这些文件
- **bbox 坐标**: 归一化到 [0,1]，top-left origin，前端渲染时乘以页面实际像素尺寸
- **引用 FSM 解析器**: `chat_service.py:RefParserFSM` 处理 LLM 流式输出中跨 token 的 `[n]` 引用标记切断
- **引用重编号**: `ChatPanel.tsx:renumberCitations()` 将后端返回的 refIndex 重编号为连续序列
- **presigned URL 直连**: PDF 文件通过 MinIO/S3 presigned URL 直接下载
- **PDF 文本搜索**: PdfViewer 通过 `pdfjs page.getTextContent()` 提取全文文本，存入 Zustand store (searchQuery/searchMatches/currentMatchIndex)。PageWithHighlights 的 `customTextRenderer` 同时处理引用高亮和搜索匹配高亮（`<mark class="pdf-search-match">`）。PdfToolbar 提供搜索 UI（Search 图标 + 输入框 + 匹配计数 + 上下翻页）

### 其他
- **模型白名单 + 模式映射**: 后端 `config.py:ALLOWED_MODELS` 定义允许的模型 ID 列表（3 种模式对应的主模型 + 备选模型）。`MODE_MODELS` 正向映射 mode→model，`MODEL_TO_MODE` 反向映射 model→mode（防止用户通过直传 model 绕过模式计费）
- **模型 Profile**: `model_profiles.py:MODEL_PROFILES` 为各模型定义独立的 temperature/max_tokens/prompt_style。`get_model_profile()` 返回模型配置，`get_rules_for_model()` 返回模型专用规则文本
- **react-resizable-panels v4 API**: 使用 `Group`/`Panel`/`Separator`
- **Alembic 配置**: `sqlalchemy.url` 被 `env.py` 运行时覆盖

---

## 测试

```bash
# 运行 smoke test（需要 docker compose 基础设施运行）
cd backend && python3 -m pytest tests/test_smoke.py -v

# 运行 parse service 单元测试（无外部依赖）
cd backend && python3 -m pytest tests/test_parse_service.py -v

# 仅运行集成测试（标记为 @pytest.mark.integration）
cd backend && python3 -m pytest -m integration -v

# Lint 检查
cd backend && python3 -m ruff check app/ tests/
```

测试文件位于 `backend/tests/`，使用 httpx AsyncClient 直连 FastAPI app。CI 通过 GitHub Actions 自动运行（`.github/workflows/ci.yml`）。

---

## 项目结构

```
DocTalk/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── documents.py      # 文档 CRUD + 列表 + URL 导入
│   │   │   ├── collections.py    # 文档集合 CRUD + 跨文档会话
│   │   │   ├── chat.py           # 会话 + 对话
│   │   │   ├── search.py         # 语义搜索
│   │   │   ├── chunks.py         # Chunk 详情
│   │   │   ├── auth.py           # 内部 Auth Adapter API
│   │   │   ├── billing.py        # Stripe Checkout/Subscribe/Portal/Products + Webhook
│   │   │   ├── credits.py        # Credits 余额 + 历史
│   │   │   └── users.py          # /me, /profile, /usage-breakdown, DELETE /me
│   │   ├── core/
│   │   │   ├── config.py         # Settings, ALLOWED_MODELS 白名单, MODE_MODELS/MODEL_TO_MODE 映射
│   │   │   ├── deps.py           # FastAPI 依赖 (require_auth, get_db)
│   │   │   ├── rate_limit.py     # 内存级速率限制器 (匿名用户 chat 端点, 10K 条目自动清理)
│   │   │   ├── url_validator.py  # SSRF 防护 (DNS 解析 + 私有 IP 阻断 + 端口封锁 + 重定向验证)
│   │   │   ├── security_log.py   # 结构化 JSON 安全事件日志
│   │   │   └── model_profiles.py # 模型自适应配置 (ModelProfile + 各模型 profile + 2 种 prompt_style)
│   │   ├── models/
│   │   │   ├── tables.py         # ORM (User, Document, Collection, Session, Credits, Ledger...)
│   │   │   ├── database.py       # Async engine
│   │   │   └── sync_database.py  # Sync engine (Celery)
│   │   ├── schemas/
│   │   │   ├── document.py       # DocumentResponse, DocumentBrief, DocumentFileUrlResponse
│   │   │   ├── search.py         # SearchRequest, SearchResultItem, SearchResponse
│   │   │   ├── chat.py           # ChatRequest, ChatMessageResponse, SessionResponse
│   │   │   └── auth.py           # User/Account/VerificationToken schemas
│   │   ├── services/
│   │   │   ├── chat_service.py   # LLM 对话 + 引用解析 + 模型自适应提示/参数
│   │   │   ├── credit_service.py # Credits pre-debit/reconcile + ensure_monthly_credits
│   │   │   ├── auth_service.py   # User/Account/Token 管理
│   │   │   ├── demo_seed.py      # Demo 文档种子 (启动时自动执行)
│   │   │   ├── summary_service.py # 自动摘要生成 (Celery 上下文, DeepSeek)
│   │   │   ├── retrieval_service.py # 向量检索 (search + search_multi for collections)
│   │   │   ├── extractors/       # 多格式文档提取器
│   │   │   │   ├── base.py       # ExtractedPage 数据类 + extract_document() 路由
│   │   │   │   ├── docx_extractor.py  # Word 文档提取 (段落+表格交错，markdown table)
│   │   │   │   ├── pptx_extractor.py  # PowerPoint 提取 (文本+表格+演讲者备注)
│   │   │   │   ├── xlsx_extractor.py  # Excel 提取 (markdown table 格式)
│   │   │   │   ├── text_extractor.py  # TXT/Markdown 提取
│   │   │   │   └── url_extractor.py   # URL/网页提取 (httpx + BeautifulSoup)
│   │   │   └── ...
│   │   └── workers/              # Celery 任务 (parse_worker + deletion_worker)
│   ├── alembic/                  # 数据库迁移
│   ├── scripts/
│   │   ├── benchmark_test_cases.json  # RAG 基准测试用例 (48 cases, 10 types)
│   │   ├── run_benchmark.py           # 自动化 benchmark runner
│   │   ├── evaluate_benchmark.py      # 评分评估器 (自动指标 + LLM-as-judge)
│   │   └── benchmark_results/         # 基准测试结果输出
│   ├── seed_data/                # Demo PDF 文件 (nvidia-10k, attention-paper, nda-contract)
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx          # 首页 (动态 CTA)
│   │   │   ├── auth/             # 登录页
│   │   │   ├── billing/          # 购买页 (含 Pro 订阅卡片)
│   │   │   ├── profile/          # Profile 页 (4 tabs: info/credits/usage/account)
│   │   │   ├── demo/             # Demo 选择页 + 旧路由重定向
│   │   │   ├── d/[documentId]/   # 文档阅读页 (PDF: PdfViewer, 其他: TextViewer)
│   │   │   ├── collections/      # 文档集合列表 + 详情页 (跨文档 Chat)
│   │   │   ├── privacy/          # 隐私政策
│   │   │   ├── terms/            # 服务条款
│   │   │   └── api/
│   │   │       ├── auth/         # NextAuth 路由
│   │   │       └── proxy/        # API 代理 (创建后端兼容 JWT)
│   │   ├── components/
│   │   │   ├── landing/          # HeroSection, ProductShowcase (Remotion), ShowcasePlayer, FeatureGrid, HowItWorks, SocialProof, SecuritySection, FAQ, FinalCTA
│   │   │   ├── AuthModal.tsx     # 登录模态框 (rounded-2xl, zinc)
│   │   │   ├── AuthButton.tsx    # 登录/登出按钮 (已被 UserMenu 替代)
│   │   │   ├── UserMenu.tsx      # 头像下拉菜单 (Profile/Buy Credits/Sign Out)
│   │   │   ├── PrivacyBadge.tsx  # 隐私承诺徽章
│   │   │   ├── CreditsDisplay.tsx # 余额显示 (自动刷新 + 事件驱动刷新)
│   │   │   ├── PaywallModal.tsx  # 付费墙
│   │   │   ├── Footer.tsx        # 页脚 (3 列链接: Product/Company/Legal + CCPA "Do Not Sell" + Contact)
│   │   │   ├── PricingTable.tsx  # 套餐对比表 (Free vs Plus vs Pro)
│   │   │   ├── CookieConsentBanner.tsx  # Cookie 同意横栏 (GDPR ePrivacy, Accept/Decline)
│   │   │   ├── AnalyticsWrapper.tsx     # 条件 Vercel Analytics (仅 cookie 同意后加载)
│   │   │   ├── ErrorBoundary.tsx # React 错误边界
│   │   │   ├── Providers.tsx     # SessionProvider 包装器
│   │   │   ├── Profile/          # ProfileTabs, ProfileInfo, Credits, Usage, Account
│   │   │   ├── Collections/      # CollectionList, CreateCollectionModal
│   │   │   ├── Chat/             # ChatPanel, MessageBubble, CitationCard
│   │   │   ├── PdfViewer/        # PdfViewer, PdfToolbar, PageWithHighlights
│   │   │   ├── TextViewer/       # TextViewer (非 PDF: markdown 渲染 + 全文搜索)
│   │   │   └── CustomInstructionsModal.tsx  # 自定义 AI 指令模态框
│   │   ├── lib/
│   │   │   ├── api.ts            # REST 客户端 (含 PROXY_BASE)
│   │   │   ├── auth.ts           # Auth.js 配置
│   │   │   ├── authAdapter.ts    # FastAPI Adapter
│   │   │   ├── models.ts         # AVAILABLE_MODELS 定义 (3 性能模式)
│   │   │   ├── export.ts         # 对话导出 (Markdown + 引用脚注)
│   │   │   ├── utils.ts          # 工具函数 (sanitizeFilename: Unicode 规范化 + 控制字符剥离 + 双扩展名阻断)
│   │   │   └── sse.ts            # SSE 流式客户端 (支持 AbortSignal 中断)
│   │   ├── i18n/                 # 11 种语言
│   │   ├── store/                # Zustand
│   │   └── types/
│   ├── public/
│   │   └── samples/              # (已清空，Demo PDF 现由后端 seed_data/ 提供)
│   └── package.json
├── .collab/                      # CC ↔ CX 协作文档
├── docs/
│   ├── ARCHITECTURE.md           # 架构文档 - 英文 (Mermaid 图表)
│   └── ARCHITECTURE.zh.md       # 架构文档 - 中文
├── .github/
│   └── workflows/
│       └── ci.yml                # GitHub Actions CI (backend lint+test, frontend build, docker build)
├── docker-compose.yml
├── README.md                     # 英文 README (与 README.zh.md 保持同步)
├── README.zh.md                  # 中文 README (与 README.md 保持同步)
└── CLAUDE.md
```

---

## 文档维护

"更新文档"的含义是**广义的**——不仅限于 CLAUDE.md，而是包括所有受影响的文档：

- `README.md`（英文）和 `README.zh.md`（中文）内容必须保持同步。修改其中一个时，需同步更新另一个
- `docs/ARCHITECTURE.md` / `docs/ARCHITECTURE.zh.md` 包含 Mermaid 架构图，架构变更时需同步更新
- `docs/PRODUCT_STRATEGY.md` 包含产品定位和竞争分析，功能/配置变更时需同步更新
- `docs/research/` 下的研究文档（user-segments.md、competitive-analysis.md、feature-roadmap.md 等）中引用了具体数字（语言数、模型数等），变更时需全局搜索并更新
- `CLAUDE.md` 面向 AI 开发工具，记录内部约定和实现细节

**操作原则**: 每次功能变更后，使用 `grep -r` 或 Grep 工具在整个仓库的 `*.md` 文件中搜索受影响的关键词（如数量、名称、列表），确保所有文档中的引用保持一致。不要只更新一处而遗漏其他位置。

---

## Session Completion Checklist

部署或重大变更后，**必须**更新所有受影响的文档（README.md、README.zh.md、ARCHITECTURE.md、PRODUCT_STRATEGY.md、docs/research/*、CLAUDE.md）并推送到 GitHub。不要将文档视为可选或可延迟的。"更新文档"意味着搜索整个仓库中所有可能引用了变更内容的 Markdown 文件，而非仅更新单个文件。

---

## Development Server

- **不要**启动多个后台开发服务器进程
- 启动新服务器前先检查是否已有运行中的
- 启动服务前终止占用冲突端口的孤儿进程

---

## Working Mode: Claude Code (CC) + Codex (CX) 协作

本项目采用 CC 主导 + CX 执行的双 AI 协作模式。

### Codex 集成规范

- 使用 `codex exec --full-auto` 进行非交互式执行
- 正确的模型名是 **`gpt-5.3-codex`**（不是 `gpt-5.3`，缺少 `-codex` 后缀会失败）
- Codex 沙箱**无法执行 git 操作**（`.git/index.lock` 权限限制 + 无网络）— 在 Claude 中直接处理 git push/commit

### 如何调用 Codex

```bash
codex exec \
  --full-auto \
  -m gpt-5.3-codex \
  -C /Users/mayijie/Projects/Code/010_DocTalk \
  -o <output-file> \
  "<prompt>"
```

### 协作文件结构

```
.collab/
├── PROTOCOL.md          # 完整协作协议
├── plans/               # CC 写的计划文档
├── reviews/             # CX 的审阅反馈
├── tasks/               # 任务执行记录
└── archive/             # 已完成的历史文档
```
