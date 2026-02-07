# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workflow Protocol

When user asks to implement a plan or make code changes, ALWAYS delegate execution to Codex (`gpt-5.3-codex`) unless explicitly told otherwise. Claude's role is **architect/reviewer**, Codex's role is **implementer**. Use `codex exec --full-auto` for non-interactive execution.

---

## 项目概述

DocTalk 是一款面向高强度文档阅读者的 Web App，帮助用户在超长 PDF 中通过 AI 对话快速定位关键信息，回答绑定原文引用并实时高亮跳转。

### 线上部署

| 组件 | URL |
|---|---|
| **Frontend** (Vercel) | https://doctalk-liard.vercel.app |
| **Backend** (Railway) | https://backend-production-a62e.up.railway.app |
| **GitHub** | https://github.com/Rswcf/DocTalk |

Railway 项目包含 5 个服务：backend, Postgres, Redis, qdrant-v2, minio-v2。

### 技术栈

- **Frontend**: Next.js 14 (App Router) + Auth.js v5 + jose (JWT) + react-pdf + react-resizable-panels + Zustand + Tailwind CSS (zinc palette) + Radix UI + Inter font (next/font/google)
- **Backend**: FastAPI + Celery + Redis
- **Database**: PostgreSQL 16 (Alembic migration) + Qdrant (向量搜索)
- **Storage**: MinIO (dev) / S3-compatible (prod)
- **Auth**: Auth.js (NextAuth) v5 + Google OAuth + JWT
- **Payments**: Stripe Checkout + Webhooks
- **LLM/Embedding**: 统一通过 **OpenRouter** 网关调用
  - LLM: 默认 `anthropic/claude-sonnet-4.5`，支持用户在前端切换（8 个模型可选）
  - Embedding: `openai/text-embedding-3-small` (dim=1536)
- **PDF Parse**: PyMuPDF (fitz)
- **i18n**: 轻量级 React Context 方案，支持 8 种语言（EN, ZH, HI, ES, AR, FR, BN, PT）

### 核心架构决策

- **认证**: Auth.js v5 + Google OAuth，JWT 策略，后端通过 `require_auth` 依赖校验
- **API 代理**: 前端所有后端请求（含 SSE chat stream）通过 `/api/proxy/*` 路由，自动注入 Authorization header
- **分层认证模型**:
  - 未登录: 可试用 Demo（3 篇真实 PDF，5 条消息限制，服务端 + 客户端双重限制）
  - 已登录: 可上传个人 PDF，服务端文档列表，Credits 系统；访问 Demo 文档使用 Credits，无消息限制
- **Demo 系统**: 后端启动时自动种子 3 篇真实文档（NVIDIA 10-K、Attention 论文、NDA）到 MinIO + DB，通过 Celery 解析。`demo_slug` 列标识 Demo 文档，`is_demo` 属性暴露给前端。`GET /api/documents/demo` 返回 Demo 文档列表。`/demo` 页面从 API 获取文档 ID 后链接到 `/d/{docId}`，旧 `/demo/[sample]` 路由自动重定向
- **Credits 系统**: 预付费模式，余额 + Ledger 双表记录，每次对话扣费
- **订阅系统**: Free (10K credits/月) + Pro (100K credits/月) 两级，月度 credits 惰性发放（`ensure_monthly_credits`），Stripe 订阅集成
- **Profile 页面**: `/profile` 4 个 Tab (Profile/Credits/Usage/Account)，含交易历史、使用统计、账户删除
- **API 网关**: 所有 LLM 和 Embedding 调用统一通过 OpenRouter（单一 API key）
- **模型切换**: 前端用户可选择 LLM 模型，后端白名单 (`ALLOWED_MODELS`) 验证后透传给 OpenRouter
- **布局**: Chat 面板在左侧, PDF 查看器在右侧，中间可拖拽调节宽度 (react-resizable-panels)
- **i18n**: 客户端 React Context，8 语言 JSON 静态打包，`t()` 函数支持参数插值，Arabic 自动 RTL
- **bbox 坐标**: 归一化 [0,1], top-left origin, 存于 chunks.bboxes (JSONB)
- **引用格式**: 编号 [1]..[K]，后端 FSM 解析器处理跨 token 切断；前端 `renumberCitations()` 按出现顺序重编号为连续序列
- **PDF 文件获取**: presigned URL (不走后端代理)
- **向量维度**: 配置驱动 (EMBEDDING_DIM)，启动时校验 Qdrant collection
- **删除**: 同步 ORM cascade delete（pages, chunks, sessions, messages），返回 202；同时 best-effort 清理 MinIO 文件和 Qdrant 向量
- **会话管理**: 每文档支持多个独立对话会话，重新打开文档自动恢复最近活跃会话

### API 路由

```
# 文档管理
GET    /api/documents                     # 列出用户文档 (?mine=1)
GET    /api/documents/demo                # 列出 Demo 文档 (slug, document_id, status)
POST   /api/documents/upload              # 上传 PDF (需登录)
GET    /api/documents/{document_id}       # 查询文档状态
DELETE /api/documents/{document_id}       # 删除文档（ORM cascade，同步删除）
GET    /api/documents/{document_id}/file-url  # 获取 presigned URL
POST   /api/documents/{document_id}/search    # 语义搜索
POST   /api/documents/{document_id}/sessions  # 创建聊天会话
GET    /api/documents/{document_id}/sessions  # 列出文档的聊天会话

# 会话与对话
GET    /api/sessions/{session_id}/messages    # 获取历史消息
POST   /api/sessions/{session_id}/chat        # 对话（SSE streaming, 可选 model 字段；Demo 匿名用户限 5 条，超限返回 429）
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
GET    /api/users/profile                 # 完整 Profile (含 stats, plan, accounts)
GET    /api/users/usage-breakdown         # 按模型分组的使用统计
DELETE /api/users/me                      # 删除账户 (级联清理)

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

# 其他
GET    /api/chunks/{chunk_id}             # 获取 chunk 详情
GET    /health                            # 健康检查

# 临时 Admin (无鉴权，仅用于调试)
POST   /admin/retry-stuck                 # 重新分发 stuck 状态的解析任务
GET    /admin/documents                   # 列出所有文档及状态（最近20条）
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

> **生产部署**: Dockerfile 的 CMD 在单容器内同时启动 uvicorn 和 Celery worker（`--concurrency=1` 以节省内存），并先运行 Alembic migration。本地开发时仍需分别启动。

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
```

前端需要设置：
- `NEXT_PUBLIC_API_BASE`: 后端 URL（本地默认 `http://localhost:8000`）
- `AUTH_SECRET`: 与后端一致
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: Google OAuth

### 部署

#### Vercel (前端)

- Root Directory 配置为 `frontend/`，使用 `git push` 自动部署（GitHub 集成）
- **不要**从 `frontend/` 目录运行 `vercel --prod`，否则 Root Directory 设置不生效
- Root Directory 必须在 **Vercel Dashboard** 中更改，**不能**通过 vercel.json 设置
- `NEXT_PUBLIC_API_BASE` 必须指向 Railway 生产 URL，**绝对不能**是 localhost
- GitHub 自动部署到 Vercel — 不需要手动 `vercel` CLI 部署，除非明确要求

#### Railway (后端)

- 从项目根目录运行 `railway up --detach`
- Dockerfile 在单容器中运行 Alembic migration → Celery worker (background, concurrency=1) → uvicorn
- 确保 Dockerfile 路径配置正确，验证 Docker Image 服务不接受 start 命令
- 部署后始终确认后端运行的是**最新代码**（避免过时部署）
- 测试前检查本地端口冲突

---

## 重要约定 / Gotchas

### 认证相关
- **上传需登录**: `upload_document` 使用 `require_auth` 依赖，未登录返回 401
- **API 代理**: 所有后端接口（含 SSE chat stream）通过 `/api/proxy/*` 走前端代理，自动注入 JWT
- **JWT 双层设计**: Auth.js v5 使用加密 JWT (JWE)，后端无法直接解密。API 代理使用 `jose` 库创建后端兼容的明文 JWT (HS256)，包含 sub/iat/exp claims
- **JWT 校验**: 后端 `deps.py` 验证 exp/iat/sub claims
- **Adapter Secret**: 内部 Auth API 使用 `X-Adapter-Secret` header 校验

### 前端相关
- **UI 设计**: 单色 zinc 调色板，Inter 字体，dark mode 反转按钮 (`bg-zinc-900 dark:bg-zinc-50`)，全站无 `gray-*`/`blue-*` 类（保留 Google OAuth 品牌色和状态色）。卡片使用 `shadow-sm`/`shadow-md` 分层，模态框 `animate-fade-in`/`animate-slide-up` 动画，零 `transition-all` 策略（所有过渡使用具体属性 `transition-colors`/`transition-opacity`/`transition-shadow`）
- **Header variant**: `variant='minimal'`（首页/Demo/Auth：仅 Logo+UserMenu）vs `variant='full'`（文档页/Billing/Profile：完整控件）
- **Landing page**: HeroSection（大字标题+CTA）+ macOS window chrome 产品展示 + FeatureGrid（3列特性卡片）+ PrivacyBadge
- **动态 CTA**: 首页根据登录状态显示不同 UI（未登录→Landing page，已登录→Dashboard 上传区+文档列表）
- **AuthModal**: 使用查询参数 `?auth=1` 触发登录模态框，ESC 可关闭
- **Demo 模式**: `/demo` 页面从后端 `GET /api/documents/demo` 获取真实文档列表，链接到 `/d/{docId}`；ChatPanel 通过 `maxUserMessages` prop 实现客户端 5 条限制 + 计数条 + 登录 CTA；旧 `/demo/[sample]` 路由自动重定向到新路径
- **文档列表**: 服务端 + localStorage 合并，服务端优先
- **前端全部 `"use client"`**: 无 SSR，所有页面和组件均为客户端渲染
- **所有 API 走代理**: REST 和 SSE (chat stream) 均通过 `PROXY_BASE` (`/api/proxy`) 路由，`sse.ts` 的 `chatStream()` 也走代理以注入 JWT
- **Proxy maxDuration**: `route.ts` 导出 `maxDuration = 60`（Vercel Hobby 上限），SSE chat 使用 60s fetch timeout，其他请求 30s
- **UserMenu 替代 AuthButton**: Header 中 `AuthButton` 已被 `UserMenu` 下拉菜单替代，未登录时仍显示 Sign In 按钮
- **Profile 页面**: `/profile?tab=credits` (默认 tab)，受保护路由，未登录重定向到 `/auth?callbackUrl=/profile`
- **Billing 页面**: 顶部 Pro 订阅卡片（渐变 zinc-800→zinc-900 边框），根据 plan 显示 Upgrade/Manage；下方 credit packs 卡片 (rounded-xl)
- **响应式**: Header 移动端间距/截断/CreditsDisplay 小屏隐藏，upload zone `p-8 sm:p-12`，billing `p-6 sm:p-8`

### 后端相关
- **Celery 用同步 DB**: Worker 使用 `psycopg`（同步），API 使用 `asyncpg`（异步）
- **macOS Celery fork 安全**: 必须设置 `OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES`
- **Credits 扣费**: 使用 `db.flush()` 确保 ledger 在同一事务中写入
- **FOR UPDATE 锁**: 验证 Token 使用行锁防止 TOCTOU 竞态
- **Parse worker 幂等**: 重新执行时先删除已有 pages/chunks，重置计数器，避免 UniqueViolation；支持 stuck 文档重试
- **启动自动重试**: `main.py` 的 `on_startup` 在后台线程中检测 status=parsing/embedding 的文档，自动重新分发 parse 任务
- **Demo 文档种子**: `on_startup` → `_seed_demo_documents()` → `demo_seed.seed_demo_documents()`，从 `backend/seed_data/` 读取 3 篇 PDF，上传 MinIO 并 dispatch parse。幂等：已 ready 跳过，stuck 重派，error 重建
- **Demo 5 条消息限制**: `chat.py:chat_stream` 中，匿名用户 + demo_slug 文档 → 查询 user messages 数量 → 超过 5 条返回 429
- **Retrieval 容错**: `chat_service.py` 的 retrieval 调用包裹在 try/except 中，Qdrant 不可用时返回 `RETRIEVAL_ERROR` SSE 事件
- **删除为同步级联**: `doc_service.delete_document()` 使用 ORM cascade 真正删除 DB 记录（非仅标记 status），同时 best-effort 清理 MinIO + Qdrant
- **文档列表过滤**: `list_documents` 查询排除 `status="deleting"` 的文档
- **月度 Credits 惰性发放**: `ensure_monthly_credits()` 在每次 chat 前检查，30 天周期，ledger 幂等，时区安全
- **Stripe 订阅 Webhook**: `checkout.session.completed` 按 mode 分流 (subscription vs payment)；`invoice.payment_succeeded` 按 invoice.id 幂等；`customer.subscription.deleted` 清除 plan
- **账户删除**: `DELETE /api/users/me` 先取消 Stripe 订阅，再逐文档清理 MinIO+Qdrant，最后 ORM cascade 删除用户

### PDF 相关
- **bbox 坐标**: 归一化到 [0,1]，top-left origin，前端渲染时乘以页面实际像素尺寸
- **引用 FSM 解析器**: `chat_service.py:RefParserFSM` 处理 LLM 流式输出中跨 token 的 `[n]` 引用标记切断
- **引用重编号**: `ChatPanel.tsx:renumberCitations()` 将后端返回的 refIndex 重编号为连续序列
- **presigned URL 直连**: PDF 文件通过 MinIO/S3 presigned URL 直接下载

### 其他
- **模型白名单**: 后端 `config.py:ALLOWED_MODELS` 定义允许的模型 ID 列表
- **react-resizable-panels v4 API**: 使用 `Group`/`Panel`/`Separator`
- **Alembic 配置**: `sqlalchemy.url` 被 `env.py` 运行时覆盖

---

## 测试

```bash
# 运行 smoke test（需要 docker compose 基础设施运行）
cd backend && python3 -m pytest tests/test_smoke.py -v

# 仅运行集成测试（标记为 @pytest.mark.integration）
cd backend && python3 -m pytest -m integration -v
```

测试文件位于 `backend/tests/`，使用 httpx AsyncClient 直连 FastAPI app。

---

## 项目结构

```
DocTalk/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── documents.py      # 文档 CRUD + 列表
│   │   │   ├── chat.py           # 会话 + 对话
│   │   │   ├── search.py         # 语义搜索
│   │   │   ├── chunks.py         # Chunk 详情
│   │   │   ├── auth.py           # 内部 Auth Adapter API
│   │   │   ├── billing.py        # Stripe Checkout/Subscribe/Portal/Products + Webhook
│   │   │   ├── credits.py        # Credits 余额 + 历史
│   │   │   └── users.py          # /me, /profile, /usage-breakdown, DELETE /me
│   │   │   # admin endpoints are in main.py (temporary, no auth)
│   │   ├── core/
│   │   │   ├── config.py         # Settings, ALLOWED_MODELS 白名单
│   │   │   └── deps.py           # FastAPI 依赖 (require_auth, get_db)
│   │   ├── models/
│   │   │   ├── tables.py         # ORM (User, Document, Session, Credits, Ledger...)
│   │   │   ├── database.py       # Async engine
│   │   │   └── sync_database.py  # Sync engine (Celery)
│   │   ├── schemas/
│   │   │   ├── document.py       # DocumentResponse, DocumentBrief, DocumentFileUrlResponse
│   │   │   ├── search.py         # SearchRequest, SearchResultItem, SearchResponse
│   │   │   ├── chat.py           # ChatRequest, ChatMessageResponse, SessionResponse
│   │   │   └── auth.py           # User/Account/VerificationToken schemas
│   │   ├── services/
│   │   │   ├── chat_service.py   # LLM 对话 + 引用解析
│   │   │   ├── credit_service.py # Credits debit/credit + ensure_monthly_credits
│   │   │   ├── auth_service.py   # User/Account/Token 管理
│   │   │   ├── demo_seed.py      # Demo 文档种子 (启动时自动执行)
│   │   │   └── ...
│   │   └── workers/              # Celery 任务
│   ├── alembic/                  # 数据库迁移
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
│   │   │   ├── d/[documentId]/   # 文档阅读页
│   │   │   ├── privacy/          # 隐私政策
│   │   │   ├── terms/            # 服务条款
│   │   │   └── api/
│   │   │       ├── auth/         # NextAuth 路由
│   │   │       └── proxy/        # API 代理 (创建后端兼容 JWT)
│   │   ├── components/
│   │   │   ├── landing/          # HeroSection, FeatureGrid (登陆页组件)
│   │   │   ├── AuthModal.tsx     # 登录模态框 (rounded-2xl, zinc)
│   │   │   ├── AuthButton.tsx    # 登录/登出按钮 (已被 UserMenu 替代)
│   │   │   ├── UserMenu.tsx      # 头像下拉菜单 (Profile/Buy Credits/Sign Out)
│   │   │   ├── PrivacyBadge.tsx  # 隐私承诺徽章
│   │   │   ├── CreditsDisplay.tsx # 余额显示
│   │   │   ├── PaywallModal.tsx  # 付费墙
│   │   │   ├── ErrorBoundary.tsx # React 错误边界
│   │   │   ├── Providers.tsx     # SessionProvider 包装器
│   │   │   ├── Profile/          # ProfileTabs, ProfileInfo, Credits, Usage, Account
│   │   │   ├── Chat/             # ChatPanel, MessageBubble, CitationCard
│   │   │   └── PdfViewer/        # PdfViewer, PdfToolbar, PageWithHighlights
│   │   ├── lib/
│   │   │   ├── api.ts            # REST 客户端 (含 PROXY_BASE)
│   │   │   ├── auth.ts           # Auth.js 配置
│   │   │   ├── authAdapter.ts    # FastAPI Adapter
│   │   │   ├── models.ts         # AVAILABLE_MODELS 定义 (8 模型)
│   │   │   └── sse.ts            # SSE 流式客户端
│   │   ├── i18n/                 # 8 种语言
│   │   ├── store/                # Zustand
│   │   └── types/
│   ├── public/
│   │   └── samples/              # (已清空，Demo PDF 现由后端 seed_data/ 提供)
│   └── package.json
├── .collab/                      # CC ↔ CX 协作文档
├── docs/
│   ├── ARCHITECTURE.md           # 架构文档 - 英文 (Mermaid 图表)
│   └── ARCHITECTURE.zh.md       # 架构文档 - 中文
├── docker-compose.yml
├── README.md                     # 英文 README (与 README.zh.md 保持同步)
├── README.zh.md                  # 中文 README (与 README.md 保持同步)
└── CLAUDE.md
```

---

## 文档维护

- `README.md`（英文）和 `README.zh.md`（中文）内容必须保持同步。修改其中一个时，需同步更新另一个
- `docs/ARCHITECTURE.md` 包含 Mermaid 架构图，架构变更时需同步更新
- `CLAUDE.md` 面向 AI 开发工具，记录内部约定和实现细节

---

## Session Completion Checklist

部署或重大变更后，**必须**更新文档（README.md、ARCHITECTURE.md、相关 docs/）并推送到 GitHub。不要将文档视为可选或可延迟的。

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
