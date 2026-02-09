# DocTalk

[中文版](README.zh.md)

> AI-powered document reader — chat with your PDFs, documents, and webpages, get cited answers with page highlights.

DocTalk helps heavy document readers quickly locate key information in long documents through AI conversation. Upload PDFs, Word documents, PowerPoints, spreadsheets, text files, or import any webpage — then chat with AI to find exactly what you need. Answers include numbered citations that link back to the original text with real-time page highlighting.

## Features

- **Upload & Parse** — Upload PDF, DOCX, PPTX, XLSX, TXT, or Markdown files; AI extracts text, detects sections, and builds a vector index
- **Cited Answers** — Ask questions and get responses with `[1]`, `[2]` references to exact passages
- **Page Highlights** — Click or hover a citation to see the referenced text; click to jump to the page with bounding-box overlays (PDF) or text snippet highlighting (non-PDF)
- **Split View** — Resizable chat panel (left) + PDF viewer (right) with drag-to-pan zoom
- **9 LLM Models** — Switch between Claude, GPT, Gemini, DeepSeek, Grok, MiniMax, Kimi, and more via OpenRouter
- **Demo Mode** — Try 3 sample documents (NVIDIA 10-K, Attention paper, NDA contract) instantly with 5 free messages per document, progress bar indicator, and rate limiting
- **Credits System** — Free (5K/month), Plus (30K/month), and Pro (150K/month) with Stripe subscriptions and annual billing
- **11 Languages** — English, Chinese, Spanish, Japanese, German, French, Korean, Portuguese, Italian, Arabic, Hindi
- **Dark Mode** — Full dark theme with monochrome zinc palette
- **Multi-Session** — Multiple independent chat sessions per document with auto-restore
- **Auto-Summary** — AI automatically generates a document summary and 5 suggested questions after parsing
- **Message Regenerate** — Re-generate the last AI response with one click
- **Conversation Export** — Download any chat as a Markdown file with citations as footnotes
- **PDF Text Search** — In-viewer Ctrl+F search with highlighted matches and prev/next navigation
- **Custom AI Instructions** — Set per-document instructions to customize how the AI analyzes and responds
- **Multi-Format Support** — Full support for PDF, Word (DOCX), PowerPoint (PPTX), Excel (XLSX), plain text, and Markdown. Tables extracted from DOCX/PPTX/XLSX render as formatted tables with borders and alternating rows
- **URL Import** — Paste any webpage URL to import its content as a document for AI-powered Q&A
- **Document Collections** — Group multiple documents into collections for cross-document questions with source attribution
- **Citation Hover Preview** — Hover over any `[1]`, `[2]` citation to see a tooltip with the cited text snippet and page number
- **Streaming Indicators** — Bouncing dots during document search, blinking cursor during response streaming
- **OCR Support** — Scanned PDFs are automatically processed with Tesseract OCR (Chinese + English)
- **Re-parse Documents** — Re-parse existing documents after config changes without re-uploading
- **Keyboard Accessible** — Full keyboard navigation for menus, modals with focus traps, and ARIA compliance
- **Pricing Comparison** — Free vs Plus vs Pro feature comparison table on the billing page
- **Model Gating** — Premium models (Claude Opus 4.6) restricted to Plus+ plans
- **Landing Page** — FAQ section, How-It-Works steps, social proof metrics, security cards, and final CTA
- **SSRF Protection** — URL imports validated against private IP ranges, internal ports blocked, manual redirect following with per-hop validation
- **Encryption at Rest** — MinIO server-side encryption (SSE-S3) on all stored files with bucket-level default policy
- **File Validation** — Magic-byte verification (PDF headers, Office ZIP structure), zip bomb protection (500MB limit), double-extension blocking
- **Per-Plan Limits** — Document count (3/20/999) and file size limits (25/50/100 MB) enforced per subscription tier
- **Security Logging** — Structured JSON event logs for auth failures, rate limits, SSRF blocks, uploads, and deletions
- **GDPR Data Export** — Download all personal data as JSON via Profile page
- **Cookie Consent** — GDPR-compliant banner controlling analytics loading; Vercel Analytics only activates on user consent
- **CCPA Compliance** — "Do Not Sell My Info" link in footer
- **Non-Root Docker** — Production container runs as unprivileged user (UID 1001)
- **Filename Sanitization** — Unicode normalization, control character stripping, double-extension blocking across frontend and backend

## Live Demo

- **App**: [www.doctalk.site](https://www.doctalk.site)
- **Try It**: [www.doctalk.site/demo](https://www.doctalk.site/demo)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14 (App Router), Auth.js v5, react-pdf v9 (pdf.js v4), Remotion (animated showcase), react-resizable-panels, Zustand, Tailwind CSS, Radix UI |
| **Backend** | FastAPI, Celery, Redis |
| **Database** | PostgreSQL 16 (Alembic migrations), Qdrant (vector search) |
| **Storage** | MinIO (dev) / S3-compatible (prod) |
| **Auth** | Auth.js (NextAuth) v5 + Google OAuth + JWT |
| **Payments** | Stripe Checkout + Subscriptions + Webhooks |
| **AI** | OpenRouter gateway — LLM: `anthropic/claude-sonnet-4.5` (default), Embedding: `openai/text-embedding-3-small` |
| **PDF Parse** | PyMuPDF (fitz), Tesseract OCR |
| **Document Parse** | python-docx, python-pptx, openpyxl (DOCX/PPTX/XLSX), httpx + BeautifulSoup4 (URL) |
| **Analytics** | Vercel Web Analytics (cookie-consent-gated) |
| **Monitoring** | Sentry (error tracking + performance) |
| **Security** | SSRF protection, SSE-S3 encryption at rest, magic-byte file validation, structured security logging |

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
| `STRIPE_PRICE_PLUS_MONTHLY` | No | Stripe recurring price ID for Plus monthly plan |
| `STRIPE_PRICE_PLUS_ANNUAL` | No | Stripe recurring price ID for Plus annual plan |
| `STRIPE_PRICE_PRO_MONTHLY` | No | Stripe recurring price ID for Pro monthly plan |
| `STRIPE_PRICE_PRO_ANNUAL` | No | Stripe recurring price ID for Pro annual plan |
| `SENTRY_DSN` | No | Sentry DSN for backend error tracking |
| `SENTRY_ENVIRONMENT` | No | Sentry environment (default: `production`) |
| `SENTRY_TRACES_SAMPLE_RATE` | No | Sentry performance sampling rate (default: `0.1`) |
| `NVIDIA_API_KEY` | No | NVIDIA NIM API key for free demo LLM calls (falls back to OpenRouter if unset) |
| `OCR_ENABLED` | No | Enable OCR for scanned PDFs (default: `true`) |
| `OCR_LANGUAGES` | No | Tesseract language codes (default: `eng+chi_sim`) |
| `OCR_DPI` | No | OCR rendering DPI (default: `300`) |

**Frontend** (`.env.local` in `frontend/`):

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_BASE` | Yes | Backend URL (default: `http://localhost:8000`) |
| `AUTH_SECRET` | Yes | Must match backend `AUTH_SECRET` |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret |
| `NEXT_PUBLIC_SENTRY_DSN` | No | Sentry DSN for frontend error tracking |

## Project Structure

```
DocTalk/
├── backend/
│   ├── app/
│   │   ├── api/            # Route handlers (documents, chat, search, billing, auth, users)
│   │   ├── core/           # Config, dependencies, SSRF protection, security logging
│   │   ├── models/         # SQLAlchemy ORM models
│   │   ├── schemas/        # Pydantic request/response schemas
│   │   ├── services/       # Business logic (chat, credits, parsing, retrieval, extractors, demo seed, summary)
│   │   └── workers/        # Celery task definitions
│   ├── alembic/            # Database migrations
│   ├── seed_data/          # Demo PDF files
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── app/            # Next.js pages (home, auth, billing, profile, demo, document viewer, collections)
│   │   ├── components/     # React components (Chat, PdfViewer, TextViewer, Collections, Profile, landing, Header, Footer, PricingTable, CookieConsentBanner, AnalyticsWrapper)
│   │   ├── lib/            # API client, auth config, SSE client, model definitions, export utils, filename sanitization
│   │   ├── i18n/           # 11 language locale files
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
- **Vector Search** — Chunks with bounding-box coordinates enable citation-to-page-highlight linking (PDF bbox overlays, non-PDF text snippet matching)
- **Small Chunks** — 150--300 token chunks with 8 retrieval results for precise citation targeting
- **Auto-Summary** — After parsing, Celery generates a document summary + suggested questions via budget LLM (DeepSeek)
- **Multi-Format** — DOCX/PPTX/XLSX/TXT/MD files are processed through format-specific extractors (with table extraction as markdown tables, speaker notes for PPTX), then fed into the same chunking+embedding pipeline as PDFs. Non-PDF viewer renders markdown with react-markdown for rich table display
- **URL Ingestion** — Webpages are fetched via httpx, parsed with BeautifulSoup to extract text, then processed as text documents
- **Collections** — Documents can be grouped into collections for cross-document Q&A; vector search uses Qdrant MatchAny filter across multiple document IDs
- **OpenRouter Gateway** — Single API key for all LLM and embedding models
- **Defense in Depth** — SSRF validation on URL imports, magic-byte file verification, SSE-S3 encryption at rest, per-plan upload limits, filename sanitization, non-root Docker container, structured security event logging, Celery retry for failed storage cleanup
- **Privacy & Compliance** — GDPR data export endpoint, cookie consent banner gating analytics, AI processing disclosure in auth flow, CCPA "Do Not Sell" link, OAuth token cleanup (no access/refresh tokens stored)

## Deployment

**Frontend (Vercel):**
- Root Directory is set to `frontend/` in Vercel project settings
- Deploy via `git push` to GitHub (auto-deploy enabled)
- Do NOT run `vercel --prod` from `frontend/` directory

**Backend (Railway):**
- Deploy from project root: `railway up --detach`
- `entrypoint.sh` runs: Alembic migration → Celery worker (background, auto-restart) → uvicorn, with SIGTERM graceful shutdown. Container runs as non-root user `app` (UID 1001)
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
