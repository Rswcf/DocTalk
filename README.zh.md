# DocTalk

[English](README.md)

> AI 驱动的文档阅读器 — 与 PDF、文档和网页对话，获取带引用的回答并实时高亮跳转。

DocTalk 帮助高强度文档阅读者在超长文档中通过 AI 对话快速定位关键信息。支持上传 PDF、Word、PowerPoint、Excel、文本文件，或导入任意网页 — 然后与 AI 对话，精准找到所需信息。回答包含编号引用，点击即可跳转到原文对应位置并高亮显示。

## 功能特性

- **上传与解析** — 上传 PDF、DOCX、PPTX、XLSX、TXT 或 Markdown 文件，AI 自动提取文本、检测章节、构建向量索引
- **引用回答** — 提问后获得带 `[1]`、`[2]` 引用标记的回答，精确指向原文段落
- **页面高亮** — 悬浮或点击引用即可预览引用文本；点击跳转到对应页面并高亮显示引用区域（PDF 使用边界框覆盖层，非 PDF 使用文本片段匹配高亮）
- **分屏视图** — 可调节的聊天面板（左）+ PDF 查看器（右），支持拖拽缩放和平移
- **9 种大模型** — 通过 OpenRouter 切换 Claude、GPT、Gemini、DeepSeek、Grok、MiniMax、Kimi 等模型
- **Demo 模式** — 无需注册即可体验 3 篇示例文档（NVIDIA 10-K、Attention 论文、NDA 合同），每个文档 5 条免费消息，带进度条指示和速率限制
- **Credits 系统** — Free（5K/月）、Plus（30K/月）和 Pro（150K/月），支持 Stripe 订阅和年付
- **11 种语言** — 英语、中文、西班牙语、日语、德语、法语、韩语、葡萄牙语、意大利语、阿拉伯语、印地语
- **暗色模式** — 完整的暗色主题，单色 zinc 调色板
- **多会话** — 每个文档支持多个独立聊天会话，自动恢复最近活跃会话
- **自动摘要** — AI 解析完成后自动生成文档摘要和 5 个推荐问题
- **消息重新生成** — 一键重新生成上一条 AI 回答
- **对话导出** — 将聊天记录下载为 Markdown 文件，引用转为脚注
- **PDF 文本搜索** — 阅读器内 Ctrl+F 搜索，匹配高亮显示，支持上下翻页
- **自定义 AI 指令** — 为每个文档设置自定义指令，定制 AI 的分析和回答方式
- **多格式支持** — 完整支持 PDF、Word (DOCX)、PowerPoint (PPTX)、Excel (XLSX)、纯文本和 Markdown。DOCX/PPTX/XLSX 中的表格提取后以带边框、交替行色的格式化表格渲染
- **URL 导入** — 粘贴任意网页链接，导入其内容为文档进行 AI 问答
- **文档集合** — 将多个文档分组为集合，支持跨文档提问并标注来源
- **引用悬浮预览** — 将鼠标悬浮在 `[1]`、`[2]` 引用标记上，即可看到引用文本摘要和页码的提示框
- **流式状态指示** — 文档搜索时显示弹跳点动画，回答流式生成时显示闪烁光标
- **OCR 支持** — 扫描版 PDF 自动通过 Tesseract OCR 处理（支持中英文）
- **文档重新解析** — 配置变更后可重新解析已有文档，无需重新上传
- **键盘无障碍** — 菜单、模态框完整键盘导航支持，焦点陷阱，ARIA 合规
- **套餐对比** — 购买页展示 Free vs Plus vs Pro 功能对比表
- **模型门控** — 高级模型（Claude Opus 4.6）仅限 Plus+ 套餐使用
- **Landing 页面** — FAQ 常见问题、使用步骤、信任指标、安全卡片、底部 CTA

## 在线体验

- **应用**: [www.doctalk.site](https://www.doctalk.site)
- **试用**: [www.doctalk.site/demo](https://www.doctalk.site/demo)

## 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | Next.js 14 (App Router)、Auth.js v5、react-pdf v9 (pdf.js v4)、Remotion（动画产品展示）、react-resizable-panels、Zustand、Tailwind CSS、Radix UI |
| **后端** | FastAPI、Celery、Redis |
| **数据库** | PostgreSQL 16 (Alembic 迁移)、Qdrant (向量搜索) |
| **存储** | MinIO (开发) / S3 兼容 (生产) |
| **认证** | Auth.js (NextAuth) v5 + Google OAuth + JWT |
| **支付** | Stripe Checkout + 订阅 + Webhooks |
| **AI** | OpenRouter 网关 — LLM: `anthropic/claude-sonnet-4.5` (默认)，Embedding: `openai/text-embedding-3-small` |
| **PDF 解析** | PyMuPDF (fitz)、Tesseract OCR |
| **文档解析** | python-docx、python-pptx、openpyxl (DOCX/PPTX/XLSX)，httpx + BeautifulSoup4 (URL) |
| **分析** | Vercel Web Analytics |
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
| `STRIPE_PRICE_PLUS_MONTHLY` | 否 | Stripe Plus 月付价格 ID |
| `STRIPE_PRICE_PLUS_ANNUAL` | 否 | Stripe Plus 年付价格 ID |
| `STRIPE_PRICE_PRO_MONTHLY` | 否 | Stripe Pro 月付价格 ID |
| `STRIPE_PRICE_PRO_ANNUAL` | 否 | Stripe Pro 年付价格 ID |
| `SENTRY_DSN` | 否 | Sentry DSN，后端错误追踪 |
| `SENTRY_ENVIRONMENT` | 否 | Sentry 环境（默认: `production`） |
| `SENTRY_TRACES_SAMPLE_RATE` | 否 | Sentry 性能采样率（默认: `0.1`） |
| `OCR_ENABLED` | 否 | 启用扫描 PDF 的 OCR（默认: `true`） |
| `OCR_LANGUAGES` | 否 | Tesseract 语言代码（默认: `eng+chi_sim`） |
| `OCR_DPI` | 否 | OCR 渲染 DPI（默认: `300`） |

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
│   │   ├── services/       # 业务逻辑 (chat, credits, parsing, retrieval, extractors, demo seed, summary)
│   │   └── workers/        # Celery 任务定义
│   ├── alembic/            # 数据库迁移
│   ├── seed_data/          # Demo PDF 文件
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── app/            # Next.js 页面 (首页, 登录, 购买, 个人中心, Demo, 文档阅读, 集合)
│   │   ├── components/     # React 组件 (Chat, PdfViewer, TextViewer, Collections, Profile, landing, Header, Footer, PricingTable)
│   │   ├── lib/            # API 客户端、Auth 配置、SSE 客户端、模型定义、导出工具
│   │   ├── i18n/           # 11 种语言翻译文件
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
- **向量检索** — 带边界框坐标的文本块实现引用到页面高亮的链接（PDF 使用 bbox 覆盖层，非 PDF 使用文本片段匹配）
- **精细分块** — 150–300 token 小分块配合 8 条检索结果，实现精准引用定位
- **自动摘要** — 解析完成后，Celery 通过预算 LLM（DeepSeek）生成文档摘要 + 推荐问题
- **多格式支持** — DOCX/PPTX/XLSX/TXT/MD 文件通过格式专用提取器处理（DOCX/XLSX 表格提取为 markdown table，PPTX 含演讲者备注），然后进入与 PDF 相同的分块+向量化流水线。非 PDF 查看器使用 react-markdown 渲染表格
- **URL 导入** — 通过 httpx 获取网页，使用 BeautifulSoup 解析提取文本，然后作为文本文档处理
- **文档集合** — 文档可分组为集合进行跨文档问答；向量搜索使用 Qdrant MatchAny 过滤器跨多个文档 ID 检索
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
