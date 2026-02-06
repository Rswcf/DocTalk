# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

- **Frontend**: Next.js 14 (App Router) + Auth.js v5 + jose (JWT) + react-pdf + react-resizable-panels + Zustand + Tailwind CSS + Radix UI
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
- **API 代理**: 前端敏感接口通过 `/api/proxy/*` 路由，自动注入 Authorization header
- **分层认证模型**:
  - 未登录: 可试用 Demo（示例 PDF，5 条消息限制）
  - 已登录: 可上传个人 PDF，服务端文档列表，Credits 系统
- **Credits 系统**: 预付费模式，余额 + Ledger 双表记录，每次对话扣费
- **API 网关**: 所有 LLM 和 Embedding 调用统一通过 OpenRouter（单一 API key）
- **模型切换**: 前端用户可选择 LLM 模型，后端白名单 (`ALLOWED_MODELS`) 验证后透传给 OpenRouter
- **布局**: Chat 面板在左侧, PDF 查看器在右侧，中间可拖拽调节宽度 (react-resizable-panels)
- **i18n**: 客户端 React Context，8 语言 JSON 静态打包，`t()` 函数支持参数插值，Arabic 自动 RTL
- **bbox 坐标**: 归一化 [0,1], top-left origin, 存于 chunks.bboxes (JSONB)
- **引用格式**: 编号 [1]..[K]，后端 FSM 解析器处理跨 token 切断；前端 `renumberCitations()` 按出现顺序重编号为连续序列
- **PDF 文件获取**: presigned URL (不走后端代理)
- **向量维度**: 配置驱动 (EMBEDDING_DIM)，启动时校验 Qdrant collection
- **删除**: 异步 202 + Celery worker
- **会话管理**: 每文档支持多个独立对话会话，重新打开文档自动恢复最近活跃会话

### API 路由

```
# 文档管理
GET    /api/documents                     # 列出用户文档 (?mine=1)
POST   /api/documents/upload              # 上传 PDF (需登录)
GET    /api/documents/{document_id}       # 查询文档状态
DELETE /api/documents/{document_id}       # 删除文档（异步）
GET    /api/documents/{document_id}/file-url  # 获取 presigned URL
POST   /api/documents/{document_id}/search    # 语义搜索
POST   /api/documents/{document_id}/sessions  # 创建聊天会话
GET    /api/documents/{document_id}/sessions  # 列出文档的聊天会话

# 会话与对话
GET    /api/sessions/{session_id}/messages    # 获取历史消息
POST   /api/sessions/{session_id}/chat        # 对话（SSE streaming, 可选 model 字段）
DELETE /api/sessions/{session_id}             # 删除聊天会话

# Credits & Billing
GET    /api/credits/balance               # 获取余额
POST   /api/billing/checkout              # 创建 Stripe Checkout
POST   /api/billing/webhook               # Stripe Webhook

# 内部 Auth (Adapter)
POST   /api/internal/auth/users           # 创建用户
GET    /api/internal/auth/users/{id}      # 获取用户
PUT    /api/internal/auth/users/{id}      # 更新用户
DELETE /api/internal/auth/users/{id}      # 删除用户
POST   /api/internal/auth/accounts        # Link 账户
DELETE /api/internal/auth/accounts/{provider}/{id}  # Unlink 账户
POST   /api/internal/auth/verification-tokens       # 创建验证 Token
POST   /api/internal/auth/verification-tokens/use   # 使用验证 Token

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

# OAuth (前端)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

前端需要设置：
- `NEXT_PUBLIC_API_BASE`: 后端 URL（本地默认 `http://localhost:8000`）
- `AUTH_SECRET`: 与后端一致
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: Google OAuth

---

## 重要约定 / Gotchas

### 认证相关
- **上传需登录**: `upload_document` 使用 `require_auth` 依赖，未登录返回 401
- **API 代理**: 敏感接口（上传、删除、会话）通过 `/api/proxy/*` 走前端代理，自动注入 JWT
- **JWT 双层设计**: Auth.js v5 使用加密 JWT (JWE)，后端无法直接解密。API 代理使用 `jose` 库创建后端兼容的明文 JWT (HS256)，包含 sub/iat/exp claims
- **JWT 校验**: 后端 `deps.py` 验证 exp/iat/sub claims
- **Adapter Secret**: 内部 Auth API 使用 `X-Adapter-Secret` header 校验

### 前端相关
- **动态 CTA**: 首页根据登录状态显示不同 UI（未登录→Demo，已登录→上传）
- **AuthModal**: 使用查询参数 `?auth=1` 触发登录模态框，ESC 可关闭
- **Demo 模式**: `/demo` 页面提供示例 PDF 试用，前端限制 5 条消息
- **文档列表**: 服务端 + localStorage 合并，服务端优先
- **前端全部 `"use client"`**: 无 SSR，所有页面和组件均为客户端渲染

### 后端相关
- **Celery 用同步 DB**: Worker 使用 `psycopg`（同步），API 使用 `asyncpg`（异步）
- **macOS Celery fork 安全**: 必须设置 `OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES`
- **Credits 扣费**: 使用 `db.flush()` 确保 ledger 在同一事务中写入
- **FOR UPDATE 锁**: 验证 Token 使用行锁防止 TOCTOU 竞态

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
│   │   │   ├── auth.py           # 内部 Auth Adapter API
│   │   │   ├── billing.py        # Stripe Checkout + Webhook
│   │   │   └── credits.py        # Credits 余额查询
│   │   ├── core/
│   │   │   ├── config.py         # Settings, ALLOWED_MODELS 白名单
│   │   │   └── deps.py           # FastAPI 依赖 (require_auth, get_db)
│   │   ├── models/
│   │   │   ├── tables.py         # ORM (User, Document, Session, Credits, Ledger...)
│   │   │   ├── database.py       # Async engine
│   │   │   └── sync_database.py  # Sync engine (Celery)
│   │   ├── schemas/
│   │   │   └── document.py       # DocumentResponse, DocumentBrief
│   │   ├── services/
│   │   │   ├── chat_service.py   # LLM 对话 + 引用解析
│   │   │   ├── credit_service.py # Credits debit/credit
│   │   │   ├── auth_service.py   # User/Account/Token 管理
│   │   │   └── ...
│   │   └── workers/              # Celery 任务
│   ├── alembic/                  # 数据库迁移
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx          # 首页 (动态 CTA)
│   │   │   ├── auth/             # 登录页
│   │   │   ├── billing/          # 购买页
│   │   │   ├── demo/             # Demo 选择 + 阅读页
│   │   │   ├── d/[documentId]/   # 文档阅读页
│   │   │   ├── privacy/          # 隐私政策
│   │   │   ├── terms/            # 服务条款
│   │   │   └── api/
│   │   │       ├── auth/         # NextAuth 路由
│   │   │       └── proxy/        # API 代理 (创建后端兼容 JWT)
│   │   ├── components/
│   │   │   ├── AuthModal.tsx     # 登录模态框
│   │   │   ├── AuthButton.tsx    # 登录/登出按钮
│   │   │   ├── PrivacyBadge.tsx  # 隐私承诺徽章
│   │   │   ├── CreditsDisplay.tsx # 余额显示
│   │   │   ├── PaywallModal.tsx  # 付费墙
│   │   │   ├── Chat/             # ChatPanel, MessageBubble, CitationCard
│   │   │   └── PdfViewer/        # PdfViewer, PdfToolbar, PageWithHighlights
│   │   ├── lib/
│   │   │   ├── api.ts            # REST 客户端 (含 PROXY_BASE)
│   │   │   ├── auth.ts           # Auth.js 配置
│   │   │   ├── authAdapter.ts    # FastAPI Adapter
│   │   │   └── sse.ts            # SSE 流式客户端
│   │   ├── i18n/                 # 8 种语言
│   │   ├── store/                # Zustand
│   │   └── types/
│   ├── public/
│   │   └── samples/              # Demo PDF 文件
│   └── package.json
├── .collab/                      # CC ↔ CX 协作文档
├── docker-compose.yml
└── CLAUDE.md
```

---

## Working Mode: Claude Code (CC) + Codex (CX) 协作

本项目采用 CC 主导 + CX 执行的双 AI 协作模式。

### 如何调用 Codex

```bash
codex exec \
  --skip-git-repo-check \
  --full-auto \
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
