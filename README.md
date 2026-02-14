<p align="center">
  <strong>English</strong> ·
  <a href="README.zh.md">中文</a> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.de.md">Deutsch</a> ·
  <a href="README.pt.md">Português</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.ko.md">한국어</a>
</p>

<h1 align="center">DocTalk</h1>

<p align="center">
  <strong>Chat with any document. Get answers with citations that highlight the source.</strong>
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

Upload PDFs, Word docs, PowerPoints, spreadsheets, or any webpage — then ask questions in natural language. DocTalk returns AI-generated answers with numbered citations (`[1]`, `[2]`) that link directly to the source text. Click a citation and the original passage highlights on the page.

## Why DocTalk?

- **Cited answers with page highlighting** — Every answer references exact passages. Click a citation to jump to the page with the text highlighted.
- **Multi-format support** — PDF, DOCX, PPTX, XLSX, TXT, Markdown, and URL import. Tables, slides, and spreadsheets are all fully supported.
- **3 AI performance modes** — Quick, Balanced, and Thorough analysis powered by different LLMs through OpenRouter. Pick speed or depth.
- **11 languages** — Full UI and AI responses in English, Chinese, Spanish, Japanese, German, French, Korean, Portuguese, Italian, Arabic, and Hindi.
- **Split-view reader** — Resizable chat panel alongside a PDF viewer with zoom, search, and drag-to-pan.
- **Document collections** — Group documents together and ask cross-document questions with source attribution.
- **Auto-summary** — AI generates a document summary and suggested questions after upload.
- **Privacy-first** — GDPR data export, cookie consent, encryption at rest, SSRF protection, non-root containers.

<p align="center">
  <a href="https://www.doctalk.site/demo"><strong>Try the live demo &rarr;</strong></a>
</p>

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 14 (App Router), Auth.js v5, react-pdf v9, Tailwind CSS, Radix UI, Zustand |
| **Backend** | FastAPI, Celery, Redis |
| **Database** | PostgreSQL 16, Qdrant (vector search) |
| **Storage** | MinIO / S3-compatible |
| **Auth** | Auth.js v5 — Google OAuth, Microsoft OAuth, Email Magic Link |
| **Payments** | Stripe Checkout + Subscriptions |
| **AI** | OpenRouter — DeepSeek V3.2, Mistral Medium 3.1, Mistral Large 2512 |
| **Parsing** | PyMuPDF, Tesseract OCR, python-docx, python-pptx, openpyxl, LibreOffice |
| **Monitoring** | Sentry, Vercel Analytics |

## Architecture

```
Browser ──→ Vercel (Next.js) ──→ Railway (FastAPI) ──→ PostgreSQL
                │                       │                Qdrant
                │                       │                Redis
                └── API Proxy ──────────┘                MinIO
                   (JWT injection)
```

**How it works:** Documents are chunked into 150-300 token segments with bounding-box coordinates, embedded into Qdrant for vector search. When you ask a question, relevant chunks are retrieved and sent to the LLM with instructions to cite sources. Citations map back to exact page locations for real-time highlighting.

For detailed diagrams see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Python 3.11+, Node.js 18+
- An [OpenRouter](https://openrouter.ai) API key
- [Google OAuth credentials](https://console.cloud.google.com/)

### Setup

```bash
# 1. Clone and configure
git clone https://github.com/Rswcf/DocTalk.git
cd DocTalk
cp .env.example .env   # Edit with your keys

# 2. Start infrastructure
docker compose up -d   # PostgreSQL, Qdrant, Redis, MinIO

# 3. Backend
cd backend
pip install -r requirements.txt
python3 -m alembic upgrade head
python3 -m uvicorn app.main:app --reload

# 4. Celery worker (separate terminal)
cd backend
OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES python3 -m celery \
  -A app.workers.celery_app worker --loglevel=info -Q default,parse

# 5. Frontend (separate terminal)
cd frontend
npm install && npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> `OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES` is only required on macOS.

<details>
<summary><strong>Environment Variables</strong></summary>

### Backend (`.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (`postgresql+asyncpg://...`) |
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key |
| `AUTH_SECRET` | Yes | Random secret (shared with frontend) |
| `ADAPTER_SECRET` | Yes | Secret for internal auth API |
| `STRIPE_SECRET_KEY` | No | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook signing secret |
| `SENTRY_DSN` | No | Sentry DSN for error tracking |
| `OCR_ENABLED` | No | Enable OCR for scanned PDFs (default: `true`) |
| `OCR_LANGUAGES` | No | Tesseract language codes (default: `eng+chi_sim`) |

### Frontend (`.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_BASE` | Yes | Backend URL (default: `http://localhost:8000`) |
| `AUTH_SECRET` | Yes | Must match backend `AUTH_SECRET` |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret |
| `MICROSOFT_CLIENT_ID` | No | Microsoft OAuth client ID |
| `MICROSOFT_CLIENT_SECRET` | No | Microsoft OAuth client secret |
| `RESEND_API_KEY` | No | Resend API key for magic link emails |

</details>

<details>
<summary><strong>Project Structure</strong></summary>

```
DocTalk/
├── backend/
│   ├── app/
│   │   ├── api/            # Route handlers (documents, chat, search, billing, auth, users)
│   │   ├── core/           # Config, dependencies, SSRF protection, security logging
│   │   ├── models/         # SQLAlchemy ORM models
│   │   ├── schemas/        # Pydantic request/response schemas
│   │   ├── services/       # Business logic (chat, credits, parsing, retrieval, extractors)
│   │   └── workers/        # Celery task definitions
│   ├── alembic/            # Database migrations
│   ├── seed_data/          # Demo PDF files
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── app/            # Next.js pages
│   │   ├── components/     # React components
│   │   ├── lib/            # API client, auth, SSE, utilities
│   │   ├── i18n/           # 11 language locale files
│   │   ├── store/          # Zustand state management
│   │   └── types/
│   └── public/
├── docs/
│   ├── ARCHITECTURE.md
│   └── PRODUCT_STRATEGY.md
└── docker-compose.yml
```

</details>

## Deployment

**Branching:** `main` (development) / `stable` (production).

| Target | Method |
|--------|--------|
| **Frontend** (Vercel) | Push to `stable` → auto-deploys. Root directory: `frontend/`. |
| **Backend** (Railway) | `git checkout stable && railway up --detach` |

Railway runs 5 services: backend, PostgreSQL, Redis, Qdrant, MinIO.

## Testing

```bash
cd backend && python3 -m pytest tests/test_smoke.py -v     # Smoke tests
cd backend && python3 -m pytest -m integration -v           # Integration tests
cd backend && python3 -m ruff check app/ tests/             # Lint
```

## Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes
4. Push to the branch and open a Pull Request

## License

[MIT](LICENSE)

---

<p align="center">
  If you find DocTalk useful, consider giving it a star. It helps others discover the project.
</p>

<p align="center">
  <a href="https://github.com/Rswcf/DocTalk/stargazers"><img src="https://img.shields.io/github/stars/Rswcf/DocTalk?style=social" alt="Star on GitHub" /></a>
</p>
