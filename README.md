# DocTalk

[中文版](README.zh.md)

> AI-powered document reader — chat with your PDFs, get cited answers with page highlights.

DocTalk helps heavy document readers quickly locate key information in long PDFs through AI conversation. Answers include numbered citations that link back to the original text with real-time page highlighting.

## Features

- **Upload & Parse** — Upload any PDF; AI extracts text, detects sections, and builds a vector index
- **Cited Answers** — Ask questions and get responses with `[1]`, `[2]` references to exact passages
- **Page Highlights** — Click a citation to jump to the referenced page with bounding-box overlays
- **Split View** — Resizable chat panel (left) + PDF viewer (right) with drag-to-pan zoom
- **8 LLM Models** — Switch between Claude, GPT, Gemini, DeepSeek, Mistral, and Qwen models via OpenRouter
- **Demo Mode** — Try 3 sample documents (NVIDIA 10-K, Attention paper, NDA contract) instantly
- **Credits System** — Free tier (10K/month) and Pro tier (100K/month) with Stripe subscription
- **8 Languages** — English, Chinese, Hindi, Spanish, Arabic, French, Bengali, Portuguese
- **Dark Mode** — Full dark theme with monochrome zinc palette
- **Multi-Session** — Multiple independent chat sessions per document with auto-restore

## Live Demo

- **App**: [www.doctalk.site](https://www.doctalk.site)
- **Try It**: [www.doctalk.site/demo](https://www.doctalk.site/demo)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14 (App Router), Auth.js v5, react-pdf, react-resizable-panels, Zustand, Tailwind CSS, Radix UI |
| **Backend** | FastAPI, Celery, Redis |
| **Database** | PostgreSQL 16 (Alembic migrations), Qdrant (vector search) |
| **Storage** | MinIO (dev) / S3-compatible (prod) |
| **Auth** | Auth.js (NextAuth) v5 + Google OAuth + JWT |
| **Payments** | Stripe Checkout + Subscriptions + Webhooks |
| **AI** | OpenRouter gateway — LLM: `anthropic/claude-sonnet-4.5` (default), Embedding: `openai/text-embedding-3-small` |
| **PDF Parse** | PyMuPDF (fitz) |

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Python 3.11+
- Node.js 18+
- An [OpenRouter](https://openrouter.ai) API key
- [Google OAuth credentials](https://console.cloud.google.com/)

### Local Development

**1. Clone and configure:**

```bash
git clone https://github.com/Rswcf/DocTalk.git
cd DocTalk
cp .env.example .env   # Edit with your keys
```

**2. Start infrastructure services:**

```bash
docker compose up -d   # PostgreSQL, Qdrant, Redis, MinIO
```

**3. Set up the backend:**

```bash
cd backend
pip install -r requirements.txt
python3 -m alembic upgrade head
python3 -m uvicorn app.main:app --reload
```

**4. Start the Celery worker** (in a separate terminal):

```bash
cd backend
OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES python3 -m celery \
  -A app.workers.celery_app worker --loglevel=info -Q default,parse
```

> The `OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES` variable is required on macOS.

**5. Start the frontend** (in a separate terminal):

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Variables

**Backend** (`.env` in `backend/` or project root):

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (`postgresql+asyncpg://...`) |
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key |
| `AUTH_SECRET` | Yes | Random secret string (shared with frontend) |
| `ADAPTER_SECRET` | Yes | Secret for internal auth API |
| `STRIPE_SECRET_KEY` | No | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook signing secret |
| `STRIPE_PRICE_PRO_MONTHLY` | No | Stripe recurring price ID for Pro plan |

**Frontend** (`.env.local` in `frontend/`):

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_BASE` | Yes | Backend URL (default: `http://localhost:8000`) |
| `AUTH_SECRET` | Yes | Must match backend `AUTH_SECRET` |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret |

## Project Structure

```
DocTalk/
├── backend/
│   ├── app/
│   │   ├── api/            # Route handlers (documents, chat, search, billing, auth, users)
│   │   ├── core/           # Config & dependencies
│   │   ├── models/         # SQLAlchemy ORM models
│   │   ├── schemas/        # Pydantic request/response schemas
│   │   ├── services/       # Business logic (chat, credits, parsing, demo seed)
│   │   └── workers/        # Celery task definitions
│   ├── alembic/            # Database migrations
│   ├── seed_data/          # Demo PDF files
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── app/            # Next.js pages (home, auth, billing, profile, demo, document viewer)
│   │   ├── components/     # React components (Chat, PdfViewer, Profile, landing, Header)
│   │   ├── lib/            # API client, auth config, SSE client, model definitions
│   │   ├── i18n/           # 8 language locale files
│   │   ├── store/          # Zustand state management
│   │   └── types/
│   └── public/
├── docs/
│   └── ARCHITECTURE.md     # Architecture deep-dive with Mermaid diagrams
└── docker-compose.yml
```

## Architecture

For detailed architecture diagrams including data flows, authentication, billing, and database schema, see **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

**High-level overview:**

```
Browser ──→ Vercel (Next.js) ──→ Railway (FastAPI) ──→ PostgreSQL
                │                       │                Qdrant
                │                       │                Redis
                └── API Proxy ──────────┘                MinIO
                   (JWT injection)
```

Key architectural decisions:

- **Dual JWT** — Auth.js v5 uses encrypted JWE; API proxy translates to HS256 JWT for backend compatibility
- **SSE Streaming** — Chat responses stream via Server-Sent Events through the proxy
- **Vector Search** — Chunks with bounding-box coordinates enable citation-to-page-highlight linking
- **OpenRouter Gateway** — Single API key for all LLM and embedding models

## Deployment

**Frontend (Vercel):**
- Root Directory is set to `frontend/` in Vercel project settings
- Deploy via `git push` to GitHub (auto-deploy enabled)
- Do NOT run `vercel --prod` from `frontend/` directory

**Backend (Railway):**
- Deploy from project root: `railway up --detach`
- Dockerfile runs: Alembic migration → Celery worker (background) → uvicorn
- Railway project includes 5 services: backend, PostgreSQL, Redis, Qdrant, MinIO

## Testing

```bash
# Smoke tests (requires docker compose services running)
cd backend && python3 -m pytest tests/test_smoke.py -v

# Integration tests
cd backend && python3 -m pytest -m integration -v
```

## License

MIT
