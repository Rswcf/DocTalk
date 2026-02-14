<p align="center">
  <a href="README.md">English</a> ·
  <a href="README.zh.md">中文</a> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.de.md">Deutsch</a> ·
  <a href="README.pt.md">Português</a> ·
  <a href="README.ja.md">日本語</a> ·
  <strong>한국어</strong>
</p>

<h1 align="center">DocTalk</h1>

<p align="center">
  <strong>모든 문서와 대화하고, 출처를 강조 표시하는 인용과 함께 답변을 받으세요.</strong>
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

PDF, Word 문서, PowerPoint, 스프레드시트 또는 웹페이지를 업로드한 다음 자연어로 질문하세요. DocTalk는 원본 텍스트로 직접 연결되는 번호가 매겨진 인용(`[1]`, `[2]`)과 함께 AI가 생성한 답변을 제공합니다. 인용을 클릭하면 페이지에서 원본 구절이 강조 표시됩니다.

## DocTalk를 선택하는 이유

- **페이지 강조 표시 기능이 있는 인용 답변** — 모든 답변은 정확한 구절을 참조합니다. 인용을 클릭하면 텍스트가 강조 표시된 페이지로 이동합니다.
- **다중 형식 지원** — PDF, DOCX, PPTX, XLSX, TXT, Markdown 및 URL 가져오기를 지원합니다. 표, 슬라이드, 스프레드시트 모두 완벽하게 지원됩니다.
- **3가지 AI 성능 모드** — OpenRouter를 통해 서로 다른 LLM으로 구동되는 Quick, Balanced, Thorough 분석. 속도 또는 깊이를 선택하세요.
- **11개 언어** — 영어, 중국어, 스페인어, 일본어, 독일어, 프랑스어, 한국어, 포르투갈어, 이탈리아어, 아랍어, 힌디어로 전체 UI 및 AI 응답을 제공합니다.
- **분할 화면 리더** — 확대/축소, 검색 및 드래그하여 이동할 수 있는 PDF 뷰어와 함께 크기 조정 가능한 채팅 패널을 제공합니다.
- **문서 컬렉션** — 문서를 함께 그룹화하고 출처 표시와 함께 문서 간 질문을 할 수 있습니다.
- **자동 요약** — AI가 업로드 후 문서 요약 및 제안 질문을 생성합니다.
- **프라이버시 우선** — GDPR 데이터 내보내기, 쿠키 동의, 저장 시 암호화, SSRF 보호, 비루트 컨테이너를 제공합니다.

<p align="center">
  <a href="https://www.doctalk.site/demo"><strong>라이브 데모 사용해보기 &rarr;</strong></a>
</p>

## 기술 스택

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

## 아키텍처

```
Browser ──→ Vercel (Next.js) ──→ Railway (FastAPI) ──→ PostgreSQL
                │                       │                Qdrant
                │                       │                Redis
                └── API Proxy ──────────┘                MinIO
                   (JWT injection)
```

**작동 방식:** 문서는 경계 상자 좌표와 함께 150-300 토큰 세그먼트로 청크되어 벡터 검색을 위해 Qdrant에 임베딩됩니다. 질문을 하면 관련 청크가 검색되어 출처 인용 지침과 함께 LLM으로 전송됩니다. 인용은 실시간 강조 표시를 위해 정확한 페이지 위치로 다시 매핑됩니다.

자세한 다이어그램은 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)를 참조하세요.

## 빠른 시작

### 사전 요구 사항

- Docker & Docker Compose
- Python 3.11+, Node.js 18+
- [OpenRouter](https://openrouter.ai) API 키
- [Google OAuth 자격 증명](https://console.cloud.google.com/)

### 설정

```bash
# 1. 클론 및 구성
git clone https://github.com/Rswcf/DocTalk.git
cd DocTalk
cp .env.example .env   # 키로 편집

# 2. 인프라 시작
docker compose up -d   # PostgreSQL, Qdrant, Redis, MinIO

# 3. 백엔드
cd backend
pip install -r requirements.txt
python3 -m alembic upgrade head
python3 -m uvicorn app.main:app --reload

# 4. Celery worker (별도 터미널)
cd backend
OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES python3 -m celery \
  -A app.workers.celery_app worker --loglevel=info -Q default,parse

# 5. 프론트엔드 (별도 터미널)
cd frontend
npm install && npm run dev
```

[http://localhost:3000](http://localhost:3000)을 여세요.

> `OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES`는 macOS에서만 필요합니다.

<details>
<summary><strong>환경 변수</strong></summary>

### Backend (`.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL 연결 문자열 (`postgresql+asyncpg://...`) |
| `OPENROUTER_API_KEY` | Yes | OpenRouter API 키 |
| `AUTH_SECRET` | Yes | 무작위 시크릿 (프론트엔드와 공유) |
| `ADAPTER_SECRET` | Yes | 내부 인증 API용 시크릿 |
| `STRIPE_SECRET_KEY` | No | Stripe 시크릿 키 |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe 웹훅 서명 시크릿 |
| `SENTRY_DSN` | No | 오류 추적을 위한 Sentry DSN |
| `OCR_ENABLED` | No | 스캔된 PDF에 대해 OCR 활성화 (기본값: `true`) |
| `OCR_LANGUAGES` | No | Tesseract 언어 코드 (기본값: `eng+chi_sim`) |

### Frontend (`.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_BASE` | Yes | 백엔드 URL (기본값: `http://localhost:8000`) |
| `AUTH_SECRET` | Yes | 백엔드 `AUTH_SECRET`과 일치해야 함 |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth 클라이언트 ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth 클라이언트 시크릿 |
| `MICROSOFT_CLIENT_ID` | No | Microsoft OAuth 클라이언트 ID |
| `MICROSOFT_CLIENT_SECRET` | No | Microsoft OAuth 클라이언트 시크릿 |
| `RESEND_API_KEY` | No | 매직 링크 이메일을 위한 Resend API 키 |

</details>

<details>
<summary><strong>프로젝트 구조</strong></summary>

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

## 배포

**브랜칭:** `main` (개발) / `stable` (프로덕션).

| Target | Method |
|--------|--------|
| **Frontend** (Vercel) | `stable`로 푸시 → 자동 배포. 루트 디렉토리: `frontend/`. |
| **Backend** (Railway) | `git checkout stable && railway up --detach` |

Railway는 5개의 서비스를 실행합니다: backend, PostgreSQL, Redis, Qdrant, MinIO.

## 테스트

```bash
cd backend && python3 -m pytest tests/test_smoke.py -v     # 스모크 테스트
cd backend && python3 -m pytest -m integration -v           # 통합 테스트
cd backend && python3 -m ruff check app/ tests/             # 린트
```

## 기여하기

기여를 환영합니다! 변경하고 싶은 내용에 대해 먼저 이슈를 열어 논의해 주세요.

1. 리포지토리를 포크하세요
2. 기능 브랜치를 생성하세요 (`git checkout -b feature/amazing-feature`)
3. 변경 사항을 커밋하세요
4. 브랜치로 푸시하고 Pull Request를 여세요

## 라이선스

[MIT](LICENSE)

---

<p align="center">
  DocTalk가 유용하다면 별표를 주는 것을 고려해 주세요. 다른 사람들이 프로젝트를 발견하는 데 도움이 됩니다.
</p>

<p align="center">
  <a href="https://github.com/Rswcf/DocTalk/stargazers"><img src="https://img.shields.io/github/stars/Rswcf/DocTalk?style=social" alt="Star on GitHub" /></a>
</p>
