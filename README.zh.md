# DocTalk

[English](README.md)

> AI 驱动的文档阅读器 — 与 PDF 对话，获取带引用的回答并实时高亮跳转。

DocTalk 帮助高强度文档阅读者在超长 PDF 中通过 AI 对话快速定位关键信息。回答包含编号引用，点击即可跳转到原文对应位置并高亮显示。

## 功能特性

- **上传与解析** — 上传任意 PDF，AI 自动提取文本、检测章节、构建向量索引
- **引用回答** — 提问后获得带 `[1]`、`[2]` 引用标记的回答，精确指向原文段落
- **页面高亮** — 点击引用跳转到对应页面，以边界框覆盖层高亮显示引用区域
- **分屏视图** — 可调节的聊天面板（左）+ PDF 查看器（右），支持拖拽缩放和平移
- **9 种大模型** — 通过 OpenRouter 切换 Claude、GPT、Gemini、DeepSeek、Grok、MiniMax、Kimi 等模型
- **Demo 模式** — 无需注册即可体验 3 篇示例文档（NVIDIA 10-K、Attention 论文、NDA 合同）
- **Credits 系统** — Free 套餐（10K/月）和 Pro 套餐（100K/月），Stripe 订阅集成
- **9 种语言** — 英语、中文、印地语、西班牙语、阿拉伯语、法语、孟加拉语、葡萄牙语、德语
- **暗色模式** — 完整的暗色主题，单色 zinc 调色板
- **多会话** — 每个文档支持多个独立聊天会话，自动恢复最近活跃会话

## 在线体验

- **应用**: [www.doctalk.site](https://www.doctalk.site)
- **试用**: [www.doctalk.site/demo](https://www.doctalk.site/demo)

## 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | Next.js 14 (App Router)、Auth.js v5、react-pdf、react-resizable-panels、Zustand、Tailwind CSS、Radix UI |
| **后端** | FastAPI、Celery、Redis |
| **数据库** | PostgreSQL 16 (Alembic 迁移)、Qdrant (向量搜索) |
| **存储** | MinIO (开发) / S3 兼容 (生产) |
| **认证** | Auth.js (NextAuth) v5 + Google OAuth + JWT |
| **支付** | Stripe Checkout + 订阅 + Webhooks |
| **AI** | OpenRouter 网关 — LLM: `anthropic/claude-sonnet-4.5` (默认)，Embedding: `openai/text-embedding-3-small` |
| **PDF 解析** | PyMuPDF (fitz) |
| **监控** | Sentry（错误追踪 + 性能监控） |

## 快速开始

### 前置要求

- Docker & Docker Compose
- Python 3.11+
- Node.js 18+
- [OpenRouter](https://openrouter.ai) API key
- [Google OAuth 凭证](https://console.cloud.google.com/)

### 本地开发

**1. 克隆并配置：**

```bash
git clone https://github.com/Rswcf/DocTalk.git
cd DocTalk
cp .env.example .env   # 编辑填入你的 API Keys
```

**2. 启动基础设施服务：**

```bash
docker compose up -d   # PostgreSQL, Qdrant, Redis, MinIO
```

**3. 启动后端：**

```bash
cd backend
pip install -r requirements.txt
python3 -m alembic upgrade head
python3 -m uvicorn app.main:app --reload
```

**4. 启动 Celery Worker**（新开终端）：

```bash
cd backend
OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES python3 -m celery \
  -A app.workers.celery_app worker --loglevel=info -Q default,parse
```

> `OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES` 仅在 macOS 上需要。

**5. 启动前端**（新开终端）：

```bash
cd frontend
npm install
npm run dev
```

在浏览器中打开 [http://localhost:3000](http://localhost:3000)。

### 环境变量

**后端**（`backend/` 或项目根目录下的 `.env`）：

| 变量 | 必需 | 说明 |
|------|------|------|
| `DATABASE_URL` | 是 | PostgreSQL 连接字符串（`postgresql+asyncpg://...`） |
| `OPENROUTER_API_KEY` | 是 | OpenRouter API key |
| `AUTH_SECRET` | 是 | 随机密钥字符串（需与前端一致） |
| `ADAPTER_SECRET` | 是 | 内部 Auth API 密钥 |
| `STRIPE_SECRET_KEY` | 否 | Stripe 密钥 |
| `STRIPE_WEBHOOK_SECRET` | 否 | Stripe Webhook 签名密钥 |
| `STRIPE_PRICE_PRO_MONTHLY` | 否 | Stripe Pro 套餐循环价格 ID |
| `SENTRY_DSN` | 否 | Sentry DSN，后端错误追踪 |
| `SENTRY_ENVIRONMENT` | 否 | Sentry 环境（默认: `production`） |
| `SENTRY_TRACES_SAMPLE_RATE` | 否 | Sentry 性能采样率（默认: `0.1`） |

**前端**（`frontend/` 下的 `.env.local`）：

| 变量 | 必需 | 说明 |
|------|------|------|
| `NEXT_PUBLIC_API_BASE` | 是 | 后端 URL（默认: `http://localhost:8000`） |
| `AUTH_SECRET` | 是 | 必须与后端 `AUTH_SECRET` 一致 |
| `GOOGLE_CLIENT_ID` | 是 | Google OAuth 客户端 ID |
| `GOOGLE_CLIENT_SECRET` | 是 | Google OAuth 客户端密钥 |
| `NEXT_PUBLIC_SENTRY_DSN` | 否 | Sentry DSN，前端错误追踪 |

## 项目结构

```
DocTalk/
├── backend/
│   ├── app/
│   │   ├── api/            # 路由处理 (documents, chat, search, billing, auth, users)
│   │   ├── core/           # 配置与依赖注入
│   │   ├── models/         # SQLAlchemy ORM 模型
│   │   ├── schemas/        # Pydantic 请求/响应模型
│   │   ├── services/       # 业务逻辑 (chat, credits, parsing, demo seed)
│   │   └── workers/        # Celery 任务定义
│   ├── alembic/            # 数据库迁移
│   ├── seed_data/          # Demo PDF 文件
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── app/            # Next.js 页面 (首页, 登录, 购买, 个人中心, Demo, 文档阅读)
│   │   ├── components/     # React 组件 (Chat, PdfViewer, Profile, landing, Header)
│   │   ├── lib/            # API 客户端、Auth 配置、SSE 客户端、模型定义
│   │   ├── i18n/           # 9 种语言翻译文件
│   │   ├── store/          # Zustand 状态管理
│   │   └── types/
│   └── public/
├── docs/
│   └── ARCHITECTURE.md     # 架构详解与 Mermaid 图表
└── docker-compose.yml
```

## 架构

详细的架构图表（含数据流、认证流程、计费系统、数据库模型等），请参阅 **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**。

**总体概览：**

```
浏览器 ──→ Vercel (Next.js) ──→ Railway (FastAPI) ──→ PostgreSQL
                │                       │                Qdrant
                │                       │                Redis
                └── API 代理 ───────────┘                MinIO
                   (JWT 注入)
```

核心架构决策：

- **双层 JWT** — Auth.js v5 使用加密 JWE；API 代理将其转换为 HS256 JWT 以兼容后端
- **SSE 流式传输** — 对话回答通过 Server-Sent Events 经代理层流式传输
- **向量检索** — 带边界框坐标的文本块实现引用到页面高亮的链接
- **OpenRouter 网关** — 单一 API key 调用所有 LLM 和 Embedding 模型

## 部署

**前端 (Vercel):**
- Vercel 项目设置中 Root Directory 为 `frontend/`
- 通过 `git push` 到 GitHub 自动部署
- 不要从 `frontend/` 目录运行 `vercel --prod`

**后端 (Railway):**
- 从项目根目录部署：`railway up --detach`
- `entrypoint.sh` 执行流程：Alembic 迁移 → Celery Worker（后台，崩溃自动重启）→ uvicorn，支持 SIGTERM 优雅关闭
- Railway 项目包含 5 个服务：backend、PostgreSQL、Redis、Qdrant、MinIO

## 测试

```bash
# Smoke 测试（需要 docker compose 基础设施运行）
cd backend && python3 -m pytest tests/test_smoke.py -v

# 集成测试
cd backend && python3 -m pytest -m integration -v
```

## 许可证

MIT
