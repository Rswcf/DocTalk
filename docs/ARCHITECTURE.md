# DocTalk Architecture

[中文版](ARCHITECTURE.zh.md)

This document provides a deep-dive into DocTalk's architecture with Mermaid diagrams covering system topology, data flows, authentication, billing, database schema, and frontend component structure.

---

## 1. System Overview

```mermaid
graph TB
    Browser["Browser"]

    subgraph Vercel["Vercel (Frontend)"]
        NextJS["Next.js 14<br/>App Router"]
        AuthJS["Auth.js v5<br/>Google OAuth"]
        Proxy["API Proxy<br/>/api/proxy/*<br/>JWT Injection"]
    end

    subgraph Railway["Railway (Backend)"]
        FastAPI["FastAPI<br/>REST + SSE"]
        Celery["Celery Worker<br/>PDF Parse + Embed"]
    end

    subgraph DataStores["Data Stores (Railway)"]
        PG["PostgreSQL 16"]
        Qdrant["Qdrant<br/>Vector Search"]
        Redis["Redis<br/>Celery Broker + Cache"]
        MinIO["MinIO / S3<br/>PDF Storage"]
    end

    subgraph External["External Services"]
        OpenRouter["OpenRouter<br/>LLM + Embedding API"]
        Stripe["Stripe<br/>Payments"]
        Google["Google OAuth"]
        Sentry["Sentry<br/>Error Tracking"]
    end

    Browser -->|HTTPS| NextJS
    NextJS --> AuthJS
    NextJS --> Proxy
    Proxy -->|HS256 JWT| FastAPI
    FastAPI --> PG
    FastAPI --> Qdrant
    FastAPI --> Redis
    FastAPI --> MinIO
    FastAPI --> OpenRouter
    FastAPI --> Stripe
    Celery --> PG
    Celery --> Qdrant
    Celery --> MinIO
    Celery --> OpenRouter
    Redis -.->|Task Queue| Celery
    AuthJS --> Google
    FastAPI --> Sentry
    NextJS --> Sentry
    Browser -->|Presigned URL| MinIO
```

**Component roles:**

| Component | Role |
|-----------|------|
| **Next.js** | Client-side rendered SPA (`"use client"`), handles routing, i18n, and UI state (Zustand) |
| **Auth.js v5** | Google OAuth authentication, encrypted JWE session tokens |
| **API Proxy** | Translates JWE tokens to HS256 JWT, injects `Authorization` header for all backend requests |
| **FastAPI** | REST API + SSE streaming for chat, document management, billing, user accounts |
| **Celery** | Async document parsing: text extraction (PDF/DOCX/PPTX/XLSX/TXT/MD/URL) → chunking → embedding → vector indexing |
| **PostgreSQL** | Primary data store for users, documents, pages, chunks, sessions, messages, credits |
| **Qdrant** | Vector database for semantic search (COSINE similarity, 1536 dimensions) |
| **Redis** | Celery task broker and result backend |
| **MinIO** | S3-compatible object storage for uploaded files with SSE-S3 encryption at rest |
| **OpenRouter** | Unified gateway for LLM inference and text embedding |
| **Stripe** | Payment processing for credit purchases and Plus/Pro subscriptions (monthly + annual) |
| **Sentry** | Error tracking and performance monitoring for both backend (FastAPI + Celery) and frontend (Next.js) |

---

## 2. PDF Upload & Parse Pipeline

```mermaid
sequenceDiagram
    participant B as Browser
    participant P as API Proxy
    participant API as FastAPI
    participant S3 as MinIO
    participant R as Redis
    participant W as Celery Worker
    participant DB as PostgreSQL
    participant Q as Qdrant
    participant OR as OpenRouter

    B->>P: POST /api/proxy/documents/upload<br/>(multipart/form-data)
    P->>API: Forward with JWT
    API->>S3: Upload PDF binary
    S3-->>API: storage_key
    API->>DB: INSERT document (status=uploading)
    API->>R: Dispatch parse_document task
    API-->>B: 201 {document_id, status: "parsing"}

    Note over W: Celery picks up task
    W->>S3: Download PDF
    W->>W: PyMuPDF: extract text + bboxes per page
    W->>DB: INSERT pages (page_number, width, height)
    W->>W: Chunk text (150–300 tokens)<br/>heading detection, header/footer filtering
    W->>DB: INSERT chunks (text, bboxes, page_start, page_end)

    loop For each batch of chunks
        W->>OR: POST /embeddings<br/>model: text-embedding-3-small
        OR-->>W: vectors (1536 dim)
        W->>Q: Upsert vectors to doc_chunks collection
        W->>DB: UPDATE chunk.vector_id, document.chunks_indexed
    end

    W->>DB: UPDATE document status=ready

    Note over W: Auto-summary (best-effort)
    W->>DB: Load first 20 chunks
    W->>OR: POST /chat/completions<br/>model: deepseek/deepseek-v3.2<br/>Generate summary + 5 questions
    OR-->>W: JSON {summary, questions}
    W->>DB: UPDATE document summary, suggested_questions
```

**Step-by-step:**

1. **Upload**: Browser sends PDF via multipart form through the API proxy. Backend validates per-plan document count and file size limits, performs magic-byte file validation (PDF `%PDF` header, Office ZIP structure + `[Content_Types].xml`, 500MB zip bomb protection), sanitizes the filename (Unicode normalization, control char stripping, double-extension blocking), stores the file in MinIO with SSE-S3 encryption, and creates a document record.

2. **Text Extraction**: Celery worker downloads the PDF and uses **PyMuPDF (fitz)** to extract text with bounding-box coordinates per page. Coordinates are normalized to `[0, 1]` range (top-left origin).

3. **Chunking**: Text is split into 150–300 token windows with:
   - Heading detection for section titles
   - Header/footer filtering to remove repeated page elements
   - Each chunk stores `page_start`, `page_end`, and `bboxes` (JSONB array of normalized rectangles)

4. **Embedding**: Chunks are sent to OpenRouter's `openai/text-embedding-3-small` endpoint in batches, producing 1536-dimensional vectors.

5. **Vector Indexing**: Vectors are upserted into Qdrant's `doc_chunks` collection with COSINE similarity metric. The collection dimension is configuration-driven (`EMBEDDING_DIM`).

6. **Completion**: Document status transitions from `parsing` → `ready`. The frontend polls status and transitions to the document viewer.

7. **Auto-Summary** (best-effort): After status becomes `ready`, the worker loads the first 20 chunks and calls a budget LLM (DeepSeek) to generate a 2–3 paragraph summary and 5 suggested questions. Results are stored in the `summary` and `suggested_questions` columns. Failures are logged but do not affect document status.

---

## 3. Chat & Citation Flow

```mermaid
sequenceDiagram
    participant U as User
    participant CP as ChatPanel
    participant P as API Proxy
    participant API as FastAPI
    participant CS as CreditService
    participant Q as Qdrant
    participant OR as OpenRouter
    participant FSM as RefParserFSM
    participant DB as PostgreSQL

    U->>CP: Type question & send
    CP->>P: POST /api/proxy/sessions/{id}/chat<br/>{message, mode?, locale?}
    P->>API: Forward with JWT

    API->>CS: ensure_monthly_credits(user)
    API->>CS: check_balance(user)
    CS-->>API: OK (sufficient credits)

    API->>Q: Vector search (top 8 chunks)
    Q-->>API: Matching chunks with scores

    API->>OR: POST /chat/completions (stream=true)<br/>System prompt + numbered fragments + user question

    loop SSE Token Stream
        OR-->>API: token
        API->>FSM: Feed token to RefParserFSM
        FSM-->>API: Parsed text + citation refs [n]
        API-->>P: SSE event: {token, citations?}
        P-->>CP: Forward SSE
        CP->>CP: Append to message bubble
    end

    API->>DB: INSERT message (content, citations, token counts)
    API->>CS: Debit credits (based on model + tokens)
    API-->>P: SSE event: DONE
    CP->>CP: renumberCitations() → sequential [1][2][3]
    U->>CP: Click citation [2]
    CP->>CP: Scroll PDF to page, highlight bboxes
```

**Key components:**

- **Retrieval**: Top-8 chunks by COSINE vector similarity from Qdrant. Each chunk includes text, page numbers, and bounding boxes.

- **LLM Prompt**: System prompt instructs the model to cite sources using `[n]` notation matching the numbered document fragments provided. Anonymous demo users use a cheaper model (`DEMO_LLM_MODEL`, default DeepSeek V3.2) to reduce API costs. A **model-adaptive prompt system** (`model_profiles.py`) tailors the rules section and API parameters per model: DeepSeek uses `positive_framing` to avoid negative-framing over-compliance, other models use the `default` style. Temperature, max_tokens, and feature flags (stream_options) are also per-model.

- **RefParserFSM**: A finite state machine in `chat_service.py` that handles `[n]` citation markers split across streaming token boundaries. For example, token `"[1"` followed by `"]"` is correctly parsed as citation reference 1.

- **Frontend Rendering**: `renumberCitations()` in ChatPanel reassigns citation numbers to a sequential series `[1], [2], [3]...` based on order of appearance, regardless of the backend's original numbering.

- **PDF Highlight**: When a user clicks a citation, the PDF viewer scrolls to the referenced page and renders translucent overlay rectangles using the chunk's normalized bbox coordinates multiplied by the page's pixel dimensions.

---

## 4. Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant NJ as Next.js
    participant AJ as Auth.js v5
    participant G as Google OAuth
    participant AD as FastAPI Adapter
    participant DB as PostgreSQL
    participant PX as API Proxy
    participant API as FastAPI

    U->>NJ: Click "Sign in with Google"
    NJ->>AJ: signIn("google")
    AJ->>G: OAuth redirect
    G-->>AJ: Authorization code
    AJ->>G: Exchange for tokens
    G-->>AJ: id_token, access_token

    AJ->>AD: POST /api/internal/auth/users<br/>(X-Adapter-Secret header)
    AD->>DB: UPSERT user + account
    AD-->>AJ: UserResponse

    AJ->>AJ: Create encrypted JWE session token
    AJ-->>NJ: Set session cookie<br/>(__Secure-authjs.session-token)

    Note over PX: Subsequent API requests
    NJ->>PX: Request to /api/proxy/*
    PX->>PX: Decrypt JWE → extract user ID
    PX->>PX: Create HS256 JWT<br/>(sub, iat, exp)
    PX->>API: Forward with Authorization: Bearer <HS256 JWT>
    API->>API: Verify JWT (deps.py)<br/>Check exp, iat, sub
    API-->>PX: Response
    PX-->>NJ: Forward response
```

**Why dual JWT?**

Auth.js v5 encrypts session tokens as JWE (JSON Web Encryption), which the Python backend cannot decrypt without sharing the encryption key and matching the exact encryption algorithm. Instead of coupling the two systems:

1. The **API proxy** (`/api/proxy/[...path]/route.ts`) decrypts the JWE using Auth.js's built-in `getToken()` function
2. It creates a new **HS256-signed JWT** with just `sub` (user ID), `iat`, and `exp` claims
3. The backend validates this simple JWT using the shared `AUTH_SECRET`

This cleanly separates the frontend auth system from the backend API authentication.

**Internal Auth Adapter**: Auth.js uses a custom adapter that calls the FastAPI backend's `/api/internal/auth/*` endpoints (protected by `X-Adapter-Secret` header) to manage users, accounts, and verification tokens in PostgreSQL.

---

## 5. Billing & Credits Flow

```mermaid
flowchart TB
    subgraph Sources["Credit Sources"]
        Signup["Signup Bonus<br/>1,000 credits"]
        Monthly["Monthly Grant<br/>Free: 500 / Plus: 3K / Pro: 9K"]
        Purchase["One-Time Purchase<br/>Starter: 5K / Pro: 20K / Enterprise: 100K"]
        Subscription["Plus/Pro Subscription<br/>Plus: 3K / Pro: 9K credits/month"]
    end

    subgraph Stripe["Stripe Integration"]
        Checkout["Stripe Checkout<br/>(one-time)"]
        SubCheckout["Stripe Subscription<br/>Checkout"]
        Portal["Customer Portal<br/>(manage subscription)"]
        Webhook["Webhook Handler"]
    end

    subgraph Backend["Backend Processing"]
        CreditService["CreditService"]
        Ledger["CreditLedger<br/>(append-only)"]
        Balance["User.credits_balance"]
        UsageRecord["UsageRecord<br/>(per-message)"]
    end

    subgraph Chat["Chat Debit (3-phase)"]
        EnsureMonthly["ensure_monthly_credits()<br/>30-day lazy check"]
        PreCheck["balance pre-check<br/>MODE_ESTIMATED_COST"]
        PreDebit["pre_debit_credits()<br/>estimated cost before stream"]
        Reconcile["reconcile_credits()<br/>actual vs estimated diff"]
    end

    Signup --> CreditService
    Monthly --> EnsureMonthly
    Purchase --> Checkout --> Webhook --> CreditService
    Subscription --> SubCheckout --> Webhook
    Portal --> Stripe

    CreditService --> Ledger
    CreditService --> Balance

    EnsureMonthly --> CreditService
    PreCheck --> Balance
    PreDebit --> CreditService
    Reconcile --> CreditService
    Reconcile --> UsageRecord
```

**Credit lifecycle:**

1. **Signup Bonus**: New users receive 1,000 credits on first login (configurable via `SIGNUP_BONUS_CREDITS`; idempotent, `signup_bonus_granted_at` timestamp guards against double-grant).

2. **Monthly Grant**: `ensure_monthly_credits()` is called before every chat request. It checks `monthly_credits_granted_at` — if 30+ days have elapsed, grants Free (500), Plus (3K), or Pro (9K) credits based on the user's plan. The ledger entry uses `ref_type=monthly_grant` with a timestamp-based `ref_id` for idempotency.

3. **One-Time Purchase**: Stripe Checkout creates a payment session. On `checkout.session.completed` webhook (mode=payment), credits are added to the user's balance. Idempotent by `payment_intent` ID.

4. **Plus/Pro Subscription**: Stripe recurring subscription (monthly or annual). `checkout.session.completed` (mode=subscription) only updates the user's plan — it does **not** grant credits (prevents double-grant with invoice webhook). Credits are granted solely via `invoice.payment_succeeded` webhook based on plan (Plus: 3K, Pro: 9K). Idempotent by `invoice.id`. On `customer.subscription.deleted`, plan is reset to Free.

5. **Chat Debit (3-phase)**: ① `chat.py` pre-checks balance >= `MODE_ESTIMATED_COST` (quick=5, balanced=15, thorough=35), returns 402 if insufficient. ② `chat_service.py` calls `pre_debit_credits()` to debit estimated cost before LLM streaming starts. ③ After streaming completes, `reconcile_credits()` computes actual cost from token usage and refunds or charges the difference. All operations recorded in `CreditLedger` (balance tracking) and `UsageRecord` (analytics).

---

## 6. Database Schema

```mermaid
erDiagram
    User ||--o{ Document : "uploads"
    User ||--o{ Account : "has"
    User ||--o{ CreditLedger : "has"
    User ||--o{ UsageRecord : "has"
    User ||--o{ Collection : "owns"
    Collection }o--o{ Document : "contains"
    Collection ||--o{ ChatSession : "has"
    Document ||--o{ Page : "contains"
    Document ||--o{ Chunk : "contains"
    Document ||--o{ ChatSession : "has"
    ChatSession ||--o{ Message : "contains"
    Message ||--o| UsageRecord : "tracks"

    User {
        uuid id PK
        string email UK
        string name
        string image
        datetime email_verified
        int credits_balance
        datetime signup_bonus_granted_at
        string plan "free | plus | pro"
        string stripe_customer_id
        string stripe_subscription_id
        datetime monthly_credits_granted_at
        datetime created_at
        datetime updated_at
    }

    Document {
        uuid id PK
        string filename
        int file_size
        int page_count
        string storage_key
        string status "uploading | parsing | ocr | ready | error | deleting"
        string error_msg
        int pages_parsed
        int chunks_total
        int chunks_indexed
        uuid user_id FK "nullable (demo docs)"
        string demo_slug UK "nullable"
        text summary "AI-generated summary"
        jsonb suggested_questions "AI-generated questions"
        text custom_instructions "User AI instructions"
        string file_type "pdf | docx | pptx | xlsx | txt | md"
        string source_url "URL for imported webpages"
        datetime created_at
        datetime updated_at
    }

    Page {
        uuid id PK
        uuid document_id FK
        int page_number
        float width_pt "nullable (non-PDF)"
        float height_pt "nullable (non-PDF)"
        text content "original extracted text"
        int rotation
    }

    Chunk {
        uuid id PK
        uuid document_id FK
        int chunk_index
        text text
        int token_count
        int page_start
        int page_end
        jsonb bboxes "normalized [0,1] coordinates"
        string section_title
        string vector_id
        datetime created_at
    }

    ChatSession {
        uuid id PK
        uuid document_id FK "nullable"
        uuid collection_id FK "nullable"
        string title
        datetime created_at
        datetime updated_at
    }

    Message {
        uuid id PK
        uuid session_id FK
        string role "user | assistant"
        text content
        jsonb citations
        int prompt_tokens
        int output_tokens
        datetime created_at
    }

    Account {
        uuid id PK
        uuid user_id FK
        string type
        string provider
        string provider_account_id
        string refresh_token "stripped on save"
        string access_token "stripped on save"
        int expires_at
        string token_type
        string scope
        string id_token "stripped on save"
    }

    CreditLedger {
        uuid id PK
        uuid user_id FK
        int delta
        int balance_after
        string reason
        string ref_type
        string ref_id
        datetime created_at
    }

    UsageRecord {
        uuid id PK
        uuid user_id FK
        uuid message_id FK "nullable"
        string model
        int prompt_tokens
        int completion_tokens
        int total_tokens
        int cost_credits
        datetime created_at
    }

    Collection {
        uuid id PK
        string name
        text description
        uuid user_id FK
        datetime created_at
        datetime updated_at
    }

    VerificationToken {
        string identifier PK
        string token PK
        datetime expires
    }
```

**Key relationships:**

- `User → Document`: SET NULL on delete (demo documents have `user_id = NULL`)
- `User → Account/CreditLedger/UsageRecord`: CASCADE delete
- `Document → Page/Chunk/ChatSession`: CASCADE delete
- `ChatSession → Message`: CASCADE delete
- `Message → UsageRecord`: SET NULL on delete
- `User → Collection`: CASCADE delete
- `Collection → ChatSession`: CASCADE delete (via collection_id)
- `Collection ↔ Document`: Many-to-many via `collection_documents` junction table

**Unique constraints:**
- `(Document.document_id, Page.page_number)` — one page per number per document
- `(Document.document_id, Chunk.chunk_index)` — sequential chunk ordering
- `(Account.provider, Account.provider_account_id)` — one account link per provider
- `Document.demo_slug` — unique when not NULL

---

## 7. Frontend Component Tree

```mermaid
graph TD
    Layout["RootLayout<br/>Providers + ErrorBoundary"]

    subgraph Pages
        Home["/ (Home)<br/>Landing or Dashboard"]
        DocView["d/[documentId]<br/>Document Viewer"]
        Demo["/demo<br/>Demo Selection"]
        Auth["/auth<br/>Auth Page"]
        Billing["/billing<br/>Billing Page"]
        Profile["/profile<br/>Profile Page"]
        Collections["/collections<br/>Document Collections"]
        CollDetail["/collections/[id]<br/>Collection Detail"]
        Privacy["/privacy"]
        Terms["/terms"]
    end

    subgraph HeaderComp["Header"]
        Logo["Logo"]
        ModelSel["ModeSelector"]
        LangSel["LanguageSelector"]
        SessionDrop["SessionDropdown"]
        CreditsDis["CreditsDisplay"]
        UserMenuC["UserMenu"]
    end

    subgraph LandingComp["Landing Components"]
        Hero["HeroSection<br/>Headline + CTAs"]
        Showcase["Product Showcase<br/>Remotion Animation<br/>macOS Window Chrome"]
        HowItWorks["HowItWorks<br/>3-Step Guide"]
        Features["FeatureGrid<br/>3-Column Cards"]
        SocialProof["SocialProof<br/>Trust Metrics"]
        Security["SecuritySection<br/>4 Security Cards"]
        FAQ["FAQ<br/>6-Item Accordion"]
        FinalCTA["FinalCTA<br/>Conversion Section"]
        PrivBadge["PrivacyBadge"]
        FooterComp["Footer<br/>3-Column Links"]
    end

    subgraph DocViewComp["Document Viewer"]
        ResizablePanels["react-resizable-panels<br/>Group / Panel / Separator"]
        ChatPanel["ChatPanel<br/>Messages + Input"]
        PdfViewer["PdfViewer<br/>react-pdf"]
        TextViewer["TextViewer<br/>Non-PDF Viewer<br/>Markdown Rendering + Search<br/>Snippet Highlights"]
    end

    subgraph ChatComp["Chat Components"]
        MsgBubble["MessageBubble<br/>Flat AI / Pill Bubble User<br/>+ Hover Copy/Feedback/Regen"]
        CitCard["CitationCard<br/>Compact Pills"]
        PlusMenu["'+' Menu<br/>Instructions + Export"]
        ScrollBtn["Scroll-to-Bottom"]
    end

    subgraph PdfComp["PDF Components"]
        PdfToolbar["PdfToolbar<br/>Zoom + Hand + Search"]
        PageHL["PageWithHighlights<br/>bbox + Search Overlays"]
    end

    subgraph ProfileComp["Profile Components"]
        ProfTabs["ProfileTabs"]
        ProfInfo["ProfileInfoSection"]
        CreditsSec["CreditsSection"]
        UsageSec["UsageStatsSection"]
        AccountSec["AccountActionsSection"]
    end

    subgraph CollComp["Collection Components"]
        CollList["CollectionList"]
        CreateColl["CreateCollectionModal"]
        CustomInst["CustomInstructionsModal"]
    end

    Layout --> Pages
    Layout --> HeaderComp
    Home --> LandingComp
    Home -->|"logged in"| DocViewComp
    DocView --> ResizablePanels
    ResizablePanels --> ChatPanel
    ResizablePanels --> PdfViewer
    ChatPanel --> ChatComp
    PdfViewer --> PdfComp
    Profile --> ProfileComp
    Collections --> CollComp

    AuthModal["AuthModal<br/>?auth=1 trigger"]
    PaywallMod["PaywallModal"]

    Layout -.-> AuthModal
    Layout -.-> PaywallMod
```

**Header variants:**
- `variant="minimal"` — Logo + UserMenu only (transparent background) — used on Home, Demo, Auth pages
- `variant="full"` — All controls (ModeSelector, LanguageSelector, SessionDropdown, CreditsDisplay, UserMenu) — used on Document, Billing, Profile pages. Additional `isDemo`/`isLoggedIn` props hide ModeSelector for anonymous demo users

**Landing page sections** (in order): HeroSection → Product Showcase (Remotion `<Player>` animated demo, 300 frames @ 30fps, lazy-loaded) → HowItWorks → FeatureGrid → SocialProof → SecuritySection → FAQ → FinalCTA → PrivacyBadge → Footer

**Chat features:**
- **ChatGPT-style UI**: AI messages render flat without card/border/background (full width, base `prose` size); user messages keep `rounded-3xl` bubbles (light gray `bg-zinc-100` in light mode, `dark:bg-zinc-700` in dark mode). Messages area + input bar use `max-w-3xl mx-auto` centering for comfortable reading width on wide panels. Action buttons (Copy, ThumbsUp/Down, Regenerate) appear on hover for older messages (`opacity-0 group-hover:opacity-100`), always visible on the latest AI message
- **Typography polish**: `antialiased` font rendering on body for smoother text on Retina displays. Prose text color overridden from Tailwind Typography default gray-700 (`#374151`) to zinc-950 (`#09090b`, near-black); dark mode uses zinc-50 (`#fafafa`). Paragraph and list spacing tightened for denser, more readable chat output
- **Code blocks**: `PreBlock` component intercepts `<pre>` elements and renders styled code blocks with dark background (`bg-zinc-900`), language label header bar (`bg-zinc-800`), and Copy code button. Uses `not-prose` to escape Typography styling. Inline `code` renders as a gray background pill (backtick decorations removed via Typography config)
- **Input bar**: `rounded-3xl` pill-shaped container with resting `shadow-sm` for elevation. Left: "+" button with dropdown menu (Custom Instructions + Export Chat). Right: Send/Stop toggle (Stop button with `Square` icon during streaming, aborts SSE via `AbortController`). Disclaimer text below input bar (11 locales)
- **Scroll-to-bottom**: Floating `ArrowDown` button appears when scrolled >80px from bottom
- **Compact citations**: `CitationCard` renders as inline `rounded-lg` pills in a `flex-wrap` row (not full-width stacked cards)
- **Suggested questions**: Displayed as `rounded-full` pill chips in a centered flex-wrap layout
- **Auto-Summary**: New sessions inject a synthetic assistant message with the AI-generated document summary
- **Regenerate**: Re-send the last user message to get a new AI response
- **Export**: Download the full conversation as a Markdown file with citations converted to footnotes (accessed via "+" menu)

**PDF Search**: Ctrl+F triggers an in-viewer search bar. Text is extracted via `pdfjs page.getTextContent()`, matches are highlighted using `customTextRenderer` with `<mark>` tags, and prev/next navigation scrolls between matches.

**State management:**
- **Zustand store** manages document state, selected model, active session, PDF viewer state, search state (query, matches, currentMatchIndex), document summary, and suggested questions
- **Auth.js SessionProvider** wraps the entire app via `Providers.tsx`

---

## 8. Security & Compliance

### Security Layers

| Layer | Mechanism |
|-------|-----------|
| **SSRF Protection** | `url_validator.py` — DNS resolution + private IP blocking (RFC 1918, link-local, cloud metadata `169.254.169.254`), internal port blocking (5432/6379/6333/9000), manual redirect following (max 3 hops) with per-hop validation |
| **File Validation** | Magic-byte checks: PDF `%PDF` header, Office ZIP structure + `[Content_Types].xml` presence, 500MB zip bomb protection. Double-extension blocking (`.pdf.exe` becomes `_pdf.exe`) |
| **Encryption at Rest** | MinIO SSE-S3 on all `put_object()` calls + bucket-level default encryption policy |
| **Per-Plan Limits** | FREE: 3 docs / 25MB, PLUS: 20 docs / 50MB, PRO: 999 docs / 100MB — enforced at upload endpoint |
| **Filename Sanitization** | Unicode NFC normalization, control character stripping, double-extension blocking, 200 character truncation — applied in both frontend (`utils.ts`) and backend |
| **Rate Limiting** | In-memory token-bucket for anonymous chat (10 req/min/IP), automatic cleanup when bucket dict exceeds 10K entries |
| **OAuth Token Cleanup** | `link_account()` strips access_token, refresh_token, and id_token — DocTalk stores only identity binding (provider + provider_account_id) |
| **Non-Root Docker** | Container runs as `app` user (UID 1001), not root |
| **Deletion Verification** | Failed MinIO/Qdrant cleanup queued as Celery retry task (`deletion_worker.py`, 3 retries with exponential backoff); structured security logging replaces silent exception swallowing |
| **Security Event Logging** | `security_log.py` emits structured JSON logs for: auth failures, rate limit hits, SSRF blocks, file uploads, document deletions, account deletions |

### Privacy & Compliance

| Requirement | Implementation |
|-------------|---------------|
| **GDPR Art. 17 (Right to Erasure)** | `DELETE /api/users/me` — cascading deletion of all user data, Stripe subscription cancellation, MinIO + Qdrant cleanup |
| **GDPR Art. 20 (Data Portability)** | `GET /api/users/me/export` — JSON export of all user data (profile, documents, sessions, messages, credits, usage) |
| **GDPR ePrivacy (Cookies)** | `CookieConsentBanner.tsx` — Accept/Decline banner; `AnalyticsWrapper.tsx` conditionally loads Vercel Analytics only on consent; consent stored in localStorage |
| **AI Processing Disclosure** | `AuthModal` displays `auth.aiDisclosure` notice: documents are processed by third-party AI services (OpenRouter) |
| **CCPA (Do Not Sell)** | Footer Legal column includes "Do Not Sell My Info" link |
| **False Claims Removed** | All 11 locale files corrected: removed "end-to-end encryption", "30-day auto-deletion", "no third-party sharing", "we retain nothing" — replaced with accurate descriptions |

---

## 9. Infrastructure & Deployment

```mermaid
graph LR
    subgraph GitHub["GitHub Repository"]
        Repo["Rswcf/DocTalk"]
    end

    subgraph VercelDeploy["Vercel"]
        VBuild["Build<br/>Root: frontend/"]
        VDeploy["Deploy<br/>Serverless Functions"]
        VDomain["www.doctalk.site"]
    end

    subgraph RailwayDeploy["Railway"]
        RBuild["Docker Build<br/>Root: ./"]
        subgraph Container["Single Container (entrypoint.sh)"]
            Alembic["1. Alembic Migrate"]
            CeleryW["2. Celery Worker<br/>(background, auto-restart)"]
            Uvicorn["3. Uvicorn<br/>(foreground, graceful shutdown)"]
        end
        subgraph RServices["Managed Services"]
            RPG["PostgreSQL"]
            RRedis["Redis"]
            RQdrant["Qdrant"]
            RMinIO["MinIO"]
        end
    end

    Repo -->|"git push<br/>(auto-deploy)"| VBuild
    VBuild --> VDeploy --> VDomain
    Repo -->|"railway up<br/>(manual)"| RBuild
    RBuild --> Alembic --> CeleryW --> Uvicorn
    Uvicorn --> RServices
    CeleryW --> RServices
```

**Deployment details:**

| Aspect | Frontend (Vercel) | Backend (Railway) |
|--------|-------------------|-------------------|
| **Trigger** | `git push` (auto) | `railway up --detach` (manual) |
| **Build** | Next.js static export from `frontend/` | Dockerfile from project root |
| **Runtime** | Serverless functions (Hobby plan) | Single container (`entrypoint.sh`): alembic → celery (auto-restart) → uvicorn |
| **Domain** | `www.doctalk.site` | `backend-production-a62e.up.railway.app` |
| **Limits** | 4.5 MB function body, 60s max duration | Container memory based on Railway plan |

**Environment sync:**
- `AUTH_SECRET` and `ADAPTER_SECRET` must match between Vercel and Railway
- `NEXT_PUBLIC_API_BASE` on Vercel must point to the Railway backend URL
- `BACKEND_INTERNAL_URL` on Vercel is the same Railway URL (used by the auth adapter)
