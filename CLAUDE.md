# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

DocTalk 是一款面向高强度文档阅读者的 Web App，帮助用户在超长 PDF 中通过 AI 对话快速定位关键信息，回答绑定原文引用并实时高亮跳转。

### 线上部署

| 组件 | URL |
|---|---|
| **Frontend** (Vercel) | https://frontend-yijie-mas-projects.vercel.app |
| **Backend** (Railway) | https://backend-production-a62e.up.railway.app |
| **GitHub** | https://github.com/Rswcf/DocTalk |

Railway 项目包含 5 个服务：backend, Postgres, Redis, qdrant-v2, minio-v2。

### 技术栈

- **Frontend**: Next.js 14 (App Router) + react-pdf + Zustand + Tailwind CSS + Radix UI
- **Backend**: FastAPI + Celery + Redis
- **Database**: PostgreSQL 16 (Alembic migration) + Qdrant (向量搜索)
- **Storage**: MinIO (dev) / S3-compatible (prod)
- **LLM/Embedding**: 统一通过 **OpenRouter** 网关调用
  - LLM: `anthropic/claude-sonnet-4.5`
  - Embedding: `openai/text-embedding-3-small` (dim=1536)
- **PDF Parse**: PyMuPDF (fitz)

### 核心架构决策

- **API 网关**: 所有 LLM 和 Embedding 调用统一通过 OpenRouter（单一 API key）
- **bbox 坐标**: 归一化 [0,1], top-left origin, 存于 chunks.bboxes (JSONB)
- **引用格式**: 编号 [1]..[K]，后端 FSM 解析器处理跨 token 切断
- **PDF 文件获取**: presigned URL (不走后端代理)
- **向量维度**: 配置驱动 (EMBEDDING_DIM)，启动时校验 Qdrant collection
- **删除**: 异步 202 + Celery worker
- **认证 (MVP)**: 无登录，UUID 不可猜测

### API 路由

```
POST   /api/documents/upload              # 上传 PDF
GET    /api/documents/{document_id}        # 查询文档状态
DELETE /api/documents/{document_id}        # 删除文档（异步）
GET    /api/documents/{document_id}/file-url  # 获取 presigned URL
POST   /api/documents/{document_id}/search    # 语义搜索
POST   /api/documents/{document_id}/sessions  # 创建聊天会话
GET    /api/sessions/{session_id}/messages     # 获取历史消息
POST   /api/sessions/{session_id}/chat         # 对话（SSE streaming）
GET    /api/chunks/{chunk_id}                  # 获取 chunk 详情
GET    /health                                 # 健康检查
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

后端配置通过 `.env` 文件加载（根目录或 backend/ 目录）。所有字段参见 `.env.example`。

前端需要设置 `NEXT_PUBLIC_API_BASE`：
- 本地开发：默认 `http://localhost:8000`（可不设置）
- 生产环境：在 Vercel 中设置为 Railway 后端 URL

---

## 重要约定 / Gotchas

- **Celery 用同步 DB**: Worker 使用 `psycopg`（同步），API 使用 `asyncpg`（异步）。不要在 worker 中使用 async session，也不要在 API 中使用 sync session。同步引擎定义在 `backend/app/models/sync_database.py`。
- **macOS Celery fork 安全**: 必须设置 `OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES`，否则 worker fork 后会 crash。
- **PDF bbox 坐标**: 归一化到 [0,1]，top-left origin。前端渲染时乘以页面实际像素尺寸。
- **引用 FSM 解析器**: `chat_service.py:RefParserFSM` 处理 LLM 流式输出中跨 token 的 `[n]` 引用标记切断。
- **前端全部 `"use client"`**: 无 SSR，所有页面和组件均为客户端渲染。
- **presigned URL 直连**: PDF 文件通过 MinIO/S3 presigned URL 直接下载，不经后端代理。
- **前端文档列表**: 存 localStorage (`doctalk_docs`)，无后端列表 API 持久化。
- **Alembic 配置**: `backend/alembic.ini` 中 `sqlalchemy.url` 被 `env.py` 运行时覆盖，以读取 `.env` 中的 `DATABASE_URL`。

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
│   │   ├── api/           # FastAPI 路由 (documents, chat, search, chunks)
│   │   ├── core/
│   │   │   ├── config.py  # Settings (pydantic-settings)
│   │   │   └── deps.py    # FastAPI 依赖注入 (get_db 等)
│   │   ├── models/
│   │   │   ├── base.py          # SQLAlchemy declarative base
│   │   │   ├── tables.py        # ORM 表定义
│   │   │   ├── database.py      # Async engine + session
│   │   │   └── sync_database.py # Sync engine (Celery worker 专用)
│   │   ├── schemas/       # Pydantic 请求/响应模型
│   │   ├── services/
│   │   │   ├── chat_service.py       # LLM 对话 + 引用 FSM 解析
│   │   │   ├── doc_service.py        # 文档管理 (CRUD)
│   │   │   ├── embedding_service.py  # Embedding + Qdrant 管理
│   │   │   ├── parse_service.py      # PyMuPDF 提取 + chunk 切分
│   │   │   ├── retrieval_service.py  # 向量检索
│   │   │   └── storage_service.py    # MinIO/S3 文件存储
│   │   └── workers/
│   │       ├── celery_app.py    # Celery 应用配置
│   │       └── parse_worker.py  # 文档解析 + embedding 任务
│   ├── alembic/           # 数据库迁移
│   ├── alembic.ini        # Alembic 配置
│   ├── tests/             # Pytest 测试
│   ├── Dockerfile         # Railway 部署（从 repo root 构建）
│   ├── railway.toml       # Railway 部署配置
│   └── requirements.txt   # Python 依赖
├── frontend/
│   ├── src/
│   │   ├── app/           # Next.js App Router 页面
│   │   ├── components/    # React 组件 (PdfViewer, Chat, ErrorBoundary)
│   │   ├── lib/           # API 客户端 (api.ts, sse.ts)
│   │   ├── store/         # Zustand 状态管理
│   │   └── types/         # TypeScript 类型定义
│   ├── next.config.mjs    # Next.js 配置（canvas stub for pdf.js）
│   └── package.json
├── infra/
│   ├── qdrant/Dockerfile  # Railway Qdrant 服务
│   └── minio/Dockerfile   # Railway MinIO 服务
├── .collab/               # CC ↔ CX 协作文档
├── .env.example           # 环境变量模板
├── .dockerignore          # Docker 构建排除
├── docker-compose.yml     # 本地开发基础设施
└── CLAUDE.md              # 本文件
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
├── tasks/
│   ├── current.md       # 当前任务
│   └── backlog.md       # 后续任务
├── dialogue/            # CC ↔ CX 讨论记录
└── archive/             # 已完成的历史文档
```
