# DocTalk

面向高强度文档阅读者的 AI 对话助手 — 在超长 PDF 中通过 AI 对话快速定位关键信息，回答绑定原文引用并实时高亮跳转。

## 功能特性

- **PDF 上传与解析** — 上传 PDF，自动提取文本、切分语义块、生成向量索引
- **语义搜索** — 基于向量检索，用自然语言查找文档内容
- **AI 对话 + 引用高亮** — 流式对话回答，自动标注原文引用 `[1][2]`，点击即跳转到 PDF 对应位置并高亮
- **多模型切换** — 支持 8 个主流 LLM（Claude、GPT、Gemini、DeepSeek、Mistral、Qwen），用户可在对话中随时切换
- **多语言支持** — 8 种语言界面（English、中文、हिन्दी、Español、العربية、Français、বাংলা、Português）
- **可调节布局** — Chat 面板在左、PDF 查看器在右，中间可拖拽调节宽度
- **Demo 试用** — 无需注册即可体验示例文档（财报、论文、合同）
- **Google 登录** — 一键登录，云端同步文档和对话历史
- **Credits 系统** — 预付费模式，Stripe 支付集成

## 技术架构

```
┌─────────────┐     ┌─────────────────────────────────────────┐
│   Next.js   │────▶│              FastAPI                    │
│  (Vercel)   │ SSE │  ┌─────────┐  ┌──────────┐  ┌───────┐ │
│  Auth.js    │◀────│  │ Chat API│  │Search API│  │Doc API│ │
│  react-pdf  │     │  └────┬────┘  └────┬─────┘  └───┬───┘ │
│  Zustand    │     │       │            │             │     │
└─────────────┘     │  ┌────▼────────────▼─────────────▼───┐ │
                    │  │         Service Layer              │ │
                    │  │  chat · retrieval · embedding      │ │
                    │  │  parse · storage · auth · credits  │ │
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
                           │                │
                    ┌──────▼──────┐  ┌──────▼──────┐
                    │  OpenRouter  │  │   Stripe    │
                    │  LLM API     │  │  Payments   │
                    └─────────────┘  └─────────────┘
```

**技术栈**:
- **前端**: Next.js 14 (App Router) · Auth.js v5 · jose (JWT) · react-pdf · react-resizable-panels · Zustand · Tailwind CSS
- **后端**: FastAPI · Celery · Redis
- **数据库**: PostgreSQL 16 (Alembic) · Qdrant (向量搜索)
- **存储**: MinIO (开发) / S3 (生产)
- **认证**: Auth.js (NextAuth) v5 + Google OAuth + JWT
- **支付**: Stripe Checkout + Webhooks
- **AI**: OpenRouter 网关 → 多模型可选（默认 Claude Sonnet 4.5）+ text-embedding-3-small
- **PDF 解析**: PyMuPDF (fitz)
- **i18n**: 8 种语言，客户端 React Context

## 快速开始

### 前置要求

- Docker & Docker Compose
- Node.js 18+
- Python 3.11+
- [OpenRouter API Key](https://openrouter.ai/)
- [Google OAuth Credentials](https://console.cloud.google.com/)

### 本地开发

1. **克隆并配置环境变量**

```bash
git clone https://github.com/Rswcf/DocTalk.git
cd DocTalk
cp .env.example .env
# 编辑 .env，填入必要的 API Keys
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

访问 http://localhost:3001 开始使用。

### 环境变量

关键配置项（完整列表见 [`.env.example`](.env.example)）：

```bash
# 必需
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/doctalk
OPENROUTER_API_KEY=sk-or-...
AUTH_SECRET=<随机字符串，前后端一致>
ADAPTER_SECRET=<随机字符串>

# OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# 支付 (可选)
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## 线上部署

| 组件 | URL |
|---|---|
| **Frontend** (Vercel) | https://doctalk-liard.vercel.app |
| **Backend** (Railway) | https://backend-production-a62e.up.railway.app |

## API 概览

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/documents` | 列出用户文档 (?mine=1) |
| `POST` | `/api/documents/upload` | 上传 PDF (需登录) |
| `GET` | `/api/documents/{id}` | 查询文档状态 |
| `DELETE` | `/api/documents/{id}` | 删除文档（异步） |
| `GET` | `/api/documents/{id}/file-url` | 获取 PDF presigned URL |
| `POST` | `/api/documents/{id}/search` | 语义搜索 |
| `POST` | `/api/documents/{id}/sessions` | 创建聊天会话 |
| `GET` | `/api/sessions/{id}/messages` | 获取历史消息 |
| `POST` | `/api/sessions/{id}/chat` | AI 对话（SSE streaming） |
| `GET` | `/api/credits/balance` | 获取 Credits 余额 |
| `POST` | `/api/billing/checkout` | 创建 Stripe Checkout |
| `GET` | `/health` | 健康检查 |

## 项目结构

```
DocTalk/
├── backend/
│   ├── app/
│   │   ├── api/           # FastAPI 路由 (documents, chat, auth, billing, credits)
│   │   ├── core/          # 配置 + 依赖注入
│   │   ├── models/        # SQLAlchemy ORM (User, Document, Credits, Ledger...)
│   │   ├── schemas/       # Pydantic 模型
│   │   ├── services/      # 业务逻辑层
│   │   └── workers/       # Celery 异步任务
│   ├── alembic/           # 数据库迁移
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── app/           # 页面 (/, /demo, /d/[id], /auth, /billing, /privacy, /terms)
│   │   ├── components/    # React 组件 (AuthModal, Chat, PdfViewer, CreditsDisplay...)
│   │   ├── i18n/          # 国际化 (8 种语言)
│   │   ├── lib/           # API 客户端, Auth 配置
│   │   ├── store/         # Zustand 状态管理
│   │   └── types/
│   ├── public/
│   │   └── samples/       # Demo PDF 文件
│   └── package.json
├── .collab/               # CC ↔ CX 协作文档
├── docker-compose.yml
├── .env.example
└── CLAUDE.md              # 开发指南
```

## 用户流程

```
首页 (未登录)
├── "试用示例" → /demo → 选择示例 → /demo/[sample] (5条消息限制)
│                                    └── 登录模态框 → 注册/登录
└── "登录上传" → 登录模态框 → Google 登录

首页 (已登录)
├── 上传 PDF → 解析中... → /d/[documentId] → 对话 + PDF 预览
├── "我的文档" → 点击打开 → /d/[documentId]
└── 购买 Credits → /billing → Stripe Checkout
```

## License

MIT
