<p align="center">
  <a href="README.md">English</a> ·
  <strong>中文</strong> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.de.md">Deutsch</a> ·
  <a href="README.pt.md">Português</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.ko.md">한국어</a>
</p>

<h1 align="center">DocTalk</h1>

<p align="center">
  <strong>与任意文档对话。获取带引用的回答，高亮定位原文出处。</strong>
</p>

<p align="center">
  <a href="https://github.com/Rswcf/DocTalk/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" /></a>
  <a href="https://github.com/Rswcf/DocTalk/stargazers"><img src="https://img.shields.io/github/stars/Rswcf/DocTalk?style=social" alt="GitHub Stars" /></a>
  <a href="https://www.doctalk.site/demo"><img src="https://img.shields.io/badge/Live%20Demo-doctalk.site-brightgreen" alt="Live Demo" /></a>
  <a href="https://github.com/Rswcf/DocTalk/pulls"><img src="https://img.shields.io/badge/PRs-welcome-orange.svg" alt="PRs Welcome" /></a>
</p>

<p align="center">
  <a href="https://www.doctalk.site/demo">
    <img src="https://www.doctalk.site/opengraph-image" alt="DocTalk Screenshot" width="720" />
  </a>
</p>

---

上传 PDF、Word 文档、PowerPoint、电子表格或任意网页 — 然后用自然语言提问。DocTalk 返回 AI 生成的回答，附带编号引用（`[1]`、`[2]`），直接链接到原文出处。点击引用即可跳转到对应页面并高亮显示原文段落。

## 为什么选择 DocTalk？

- **带页面高亮的引用回答** — 每条回答都引用精确段落。点击引用即可跳转到对应页面并高亮显示原文。
- **多格式支持** — PDF、DOCX、PPTX、XLSX、TXT、Markdown 以及 URL 导入。表格、幻灯片和电子表格全面支持。
- **3 种 AI 性能模式** — 快速、均衡和深度分析，通过 OpenRouter 调用不同 LLM。按需选择速度或深度。
- **11 种语言** — 完整的 UI 和 AI 回答支持英语、中文、西班牙语、日语、德语、法语、韩语、葡萄牙语、意大利语、阿拉伯语和印地语。
- **分屏阅读器** — 可调节大小的聊天面板搭配 PDF 查看器，支持缩放、搜索和拖拽平移。
- **文档集合** — 将多个文档分组，支持跨文档提问并标注来源。
- **自动摘要** — 上传后 AI 自动生成文档摘要和推荐问题。
- **隐私优先** — GDPR 数据导出、Cookie 同意、静态加密、SSRF 防护、非 root 容器。

<p align="center">
  <a href="https://www.doctalk.site/demo"><strong>试用在线 Demo &rarr;</strong></a>
</p>

## 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | Next.js 14 (App Router)、Auth.js v5、react-pdf v9、Tailwind CSS、Radix UI、Zustand |
| **后端** | FastAPI、Celery、Redis |
| **数据库** | PostgreSQL 16、Qdrant（向量搜索） |
| **存储** | MinIO / S3 兼容 |
| **认证** | Auth.js v5 — Google OAuth、Microsoft OAuth、Email Magic Link |
| **支付** | Stripe Checkout + Subscriptions |
| **AI** | OpenRouter — DeepSeek V3.2、Mistral Medium 3.1、Mistral Large 2512 |
| **解析** | PyMuPDF、Tesseract OCR、python-docx、python-pptx、openpyxl、LibreOffice |
| **监控** | Sentry、Vercel Analytics |

## 架构

```
浏览器 ──→ Vercel (Next.js) ──→ Railway (FastAPI) ──→ PostgreSQL
                │                       │                Qdrant
                │                       │                Redis
                └── API 代理 ───────────┘                MinIO
                   (JWT 注入)
```

**工作原理：** 文档被分割为 150-300 token 的文本块并附带边界框坐标，嵌入到 Qdrant 进行向量搜索。当你提问时，系统检索相关文本块并发送给 LLM，指示其标注引用来源。引用映射回精确的页面位置，实现实时高亮。

详细架构图请参阅 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## 快速开始

### 前置要求

- Docker & Docker Compose
- Python 3.11+、Node.js 18+
- [OpenRouter](https://openrouter.ai) API key
- [Google OAuth 凭证](https://console.cloud.google.com/)

### 安装配置

```bash
# 1. 克隆并配置
git clone https://github.com/Rswcf/DocTalk.git
cd DocTalk
cp .env.example .env   # 编辑填入你的 API Keys

# 2. 启动基础设施
docker compose up -d   # PostgreSQL, Qdrant, Redis, MinIO

# 3. 后端
cd backend
pip install -r requirements.txt
python3 -m alembic upgrade head
python3 -m uvicorn app.main:app --reload

# 4. Celery Worker（新开终端）
cd backend
OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES python3 -m celery \
  -A app.workers.celery_app worker --loglevel=info -Q default,parse

# 5. 前端（新开终端）
cd frontend
npm install && npm run dev
```

在浏览器中打开 [http://localhost:3000](http://localhost:3000)。

> `OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES` 仅在 macOS 上需要。

<details>
<summary><strong>环境变量</strong></summary>

### 后端 (`.env`)

| 变量 | 必需 | 说明 |
|------|------|------|
| `DATABASE_URL` | 是 | PostgreSQL 连接字符串（`postgresql+asyncpg://...`） |
| `OPENROUTER_API_KEY` | 是 | OpenRouter API key |
| `AUTH_SECRET` | 是 | 随机密钥（需与前端一致） |
| `ADAPTER_SECRET` | 是 | 内部 Auth API 密钥 |
| `STRIPE_SECRET_KEY` | 否 | Stripe 密钥 |
| `STRIPE_WEBHOOK_SECRET` | 否 | Stripe Webhook 签名密钥 |
| `SENTRY_DSN` | 否 | Sentry DSN，用于错误追踪 |
| `OCR_ENABLED` | 否 | 启用扫描 PDF 的 OCR（默认: `true`） |
| `OCR_LANGUAGES` | 否 | Tesseract 语言代码（默认: `eng+chi_sim`） |

### 前端 (`.env.local`)

| 变量 | 必需 | 说明 |
|------|------|------|
| `NEXT_PUBLIC_API_BASE` | 是 | 后端 URL（默认: `http://localhost:8000`） |
| `AUTH_SECRET` | 是 | 必须与后端 `AUTH_SECRET` 一致 |
| `GOOGLE_CLIENT_ID` | 是 | Google OAuth 客户端 ID |
| `GOOGLE_CLIENT_SECRET` | 是 | Google OAuth 客户端密钥 |
| `MICROSOFT_CLIENT_ID` | 否 | Microsoft OAuth 客户端 ID |
| `MICROSOFT_CLIENT_SECRET` | 否 | Microsoft OAuth 客户端密钥 |
| `RESEND_API_KEY` | 否 | Resend API key，用于 Magic Link 邮件 |

</details>

<details>
<summary><strong>项目结构</strong></summary>

```
DocTalk/
├── backend/
│   ├── app/
│   │   ├── api/            # 路由处理 (documents, chat, search, billing, auth, users)
│   │   ├── core/           # 配置、依赖注入、SSRF 防护、安全日志
│   │   ├── models/         # SQLAlchemy ORM 模型
│   │   ├── schemas/        # Pydantic 请求/响应模型
│   │   ├── services/       # 业务逻辑 (chat, credits, parsing, retrieval, extractors)
│   │   └── workers/        # Celery 任务定义
│   ├── alembic/            # 数据库迁移
│   ├── seed_data/          # Demo PDF 文件
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── app/            # Next.js 页面
│   │   ├── components/     # React 组件
│   │   ├── lib/            # API 客户端、Auth 配置、SSE、工具函数
│   │   ├── i18n/           # 11 种语言翻译文件
│   │   ├── store/          # Zustand 状态管理
│   │   └── types/
│   └── public/
├── docs/
│   ├── ARCHITECTURE.md
│   └── PRODUCT_STRATEGY.md
└── docker-compose.yml
```

</details>

## 部署

**分支策略：** `main`（开发）/ `stable`（生产）。

| 目标 | 方式 |
|------|------|
| **前端** (Vercel) | 推送 `stable` → 自动部署。Root Directory: `frontend/`。 |
| **后端** (Railway) | `git checkout stable && railway up --detach` |

Railway 运行 5 个服务：backend、PostgreSQL、Redis、Qdrant、MinIO。

## 测试

```bash
cd backend && python3 -m pytest tests/test_smoke.py -v     # Smoke 测试
cd backend && python3 -m pytest -m integration -v           # 集成测试
cd backend && python3 -m ruff check app/ tests/             # 代码检查
```

## 参与贡献

欢迎贡献！请先提交 Issue 讨论你想要修改的内容。

1. Fork 本仓库
2. 创建功能分支（`git checkout -b feature/amazing-feature`）
3. 提交你的更改
4. 推送分支并创建 Pull Request

## 许可证

[MIT](LICENSE)

---

<p align="center">
  如果你觉得 DocTalk 有用，请考虑给一个 Star，帮助更多人发现这个项目。
</p>

<p align="center">
  <a href="https://github.com/Rswcf/DocTalk/stargazers"><img src="https://img.shields.io/github/stars/Rswcf/DocTalk?style=social" alt="Star on GitHub" /></a>
</p>
