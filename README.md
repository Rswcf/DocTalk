# DocTalk

面向高强度文档阅读者的 AI 对话助手 — 在超长 PDF 中通过 AI 对话快速定位关键信息，回答绑定原文引用并实时高亮跳转。

## 功能特性

- **PDF 上传与解析** — 上传 PDF，自动提取文本、切分语义块、生成向量索引
- **语义搜索** — 基于向量检索，用自然语言查找文档内容
- **AI 对话 + 引用高亮** — 流式对话回答，自动标注原文引用 `[1][2]`，点击即跳转到 PDF 对应位置并高亮

## 技术架构

```
┌─────────────┐     ┌─────────────────────────────────────────┐
│   Next.js   │────▶│              FastAPI                    │
│  (Vercel)   │ SSE │  ┌─────────┐  ┌──────────┐  ┌───────┐ │
│  react-pdf  │◀────│  │ Chat API│  │Search API│  │Doc API│ │
│  Zustand    │     │  └────┬────┘  └────┬─────┘  └───┬───┘ │
└─────────────┘     │       │            │             │     │
                    │  ┌────▼────────────▼─────────────▼───┐ │
                    │  │         Service Layer              │ │
                    │  │  chat · retrieval · embedding      │ │
                    │  │  parse · storage · doc             │ │
                    │  └──┬──────────┬──────────┬───────────┘ │
                    │     │          │          │             │
                    │  ┌──▼──┐  ┌───▼───┐  ┌───▼────┐       │
                    │  │Qdrant│  │Postgres│  │MinIO/S3│       │
                    │  └──────┘  └───────┘  └────────┘       │
                    │                                         │
                    │  ┌────────────────────────┐            │
                    │  │ Celery Worker (Redis)  │            │
                    │  │ PDF 解析 + Embedding   │            │
                    │  └────────────────────────┘            │
                    └─────────────────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │  OpenRouter  │  LLM + Embedding API
                    └─────────────┘
```

**技术栈**:
- **前端**: Next.js 14 (App Router) · react-pdf · Zustand · Tailwind CSS · Radix UI
- **后端**: FastAPI · Celery · Redis
- **数据库**: PostgreSQL 16 (Alembic) · Qdrant (向量搜索)
- **存储**: MinIO (开发) / S3 (生产)
- **AI**: OpenRouter 网关 → Claude Sonnet 4.5 (LLM) + text-embedding-3-small (Embedding)
- **PDF 解析**: PyMuPDF (fitz)

## 快速开始

### 前置要求

- Docker & Docker Compose
- Node.js 18+
- Python 3.11+
- [OpenRouter API Key](https://openrouter.ai/)

### 本地开发

1. **克隆并配置环境变量**

```bash
git clone https://github.com/Rswcf/DocTalk.git
cd DocTalk
cp .env.example .env
# 编辑 .env，填入 OPENROUTER_API_KEY
```

2. **启动基础设施**

```bash
docker compose up -d
```

3. **启动后端**

```bash
cd backend
pip install -r requirements.txt
python3 -m alembic upgrade head
python3 -m uvicorn app.main:app --reload
```

4. **启动 Celery Worker**

```bash
cd backend
OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES python3 -m celery -A app.workers.celery_app worker --loglevel=info -Q default,parse
```

> `OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES` 仅 macOS 需要

5. **启动前端**

```bash
cd frontend
npm install
npm run dev
```

访问 http://localhost:3000 开始使用。

### 环境变量

所有配置项参见 [`.env.example`](.env.example)。

## 线上部署

| 组件 | URL |
|---|---|
| **Frontend** (Vercel) | https://frontend-yijie-mas-projects.vercel.app |
| **Backend** (Railway) | https://backend-production-a62e.up.railway.app |

## API 概览

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/documents/upload` | 上传 PDF |
| `GET` | `/api/documents/{document_id}` | 查询文档状态 |
| `DELETE` | `/api/documents/{document_id}` | 删除文档（异步） |
| `GET` | `/api/documents/{document_id}/file-url` | 获取 PDF presigned URL |
| `POST` | `/api/documents/{document_id}/search` | 语义搜索 |
| `POST` | `/api/documents/{document_id}/sessions` | 创建聊天会话 |
| `GET` | `/api/sessions/{session_id}/messages` | 获取历史消息 |
| `POST` | `/api/sessions/{session_id}/chat` | AI 对话（SSE streaming） |
| `GET` | `/api/chunks/{chunk_id}` | 获取 chunk 详情 |
| `GET` | `/health` | 健康检查 |

## 项目结构

```
DocTalk/
├── backend/
│   ├── app/
│   │   ├── api/           # FastAPI 路由
│   │   ├── core/          # 配置 + 依赖注入
│   │   ├── models/        # SQLAlchemy ORM
│   │   ├── schemas/       # Pydantic 模型
│   │   ├── services/      # 业务逻辑层
│   │   └── workers/       # Celery 异步任务
│   ├── alembic/           # 数据库迁移
│   ├── tests/             # 测试
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/           # 页面
│   │   ├── components/    # React 组件
│   │   ├── lib/           # API 客户端
│   │   ├── store/         # 状态管理
│   │   └── types/         # 类型定义
│   └── package.json
├── infra/                 # Railway 基础设施 Dockerfile
├── docker-compose.yml     # 本地开发环境
└── .env.example           # 环境变量模板
```

## License

MIT
