<p align="center">
  <a href="README.md">English</a> ·
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
  <strong>Chatten Sie mit jedem Dokument. Erhalten Sie Antworten mit Quellenverweisen, die den Originaltext hervorheben.</strong>
</p>

<p align="center">
  <a href="https://github.com/Rswcf/DocTalk/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT-Lizenz" /></a>
  <a href="https://github.com/Rswcf/DocTalk/stargazers"><img src="https://img.shields.io/github/stars/Rswcf/DocTalk?style=social" alt="GitHub-Sterne" /></a>
  <a href="https://www.doctalk.site/demo"><img src="https://img.shields.io/badge/Live%20Demo-doctalk.site-brightgreen" alt="Live-Demo" /></a>
  <a href="https://github.com/Rswcf/DocTalk/pulls"><img src="https://img.shields.io/badge/PRs-willkommen-orange.svg" alt="PRs Willkommen" /></a>
</p>

<p align="center">
  <a href="https://www.doctalk.site/demo">
    <img src="https://www.doctalk.site/opengraph-image" alt="DocTalk Screenshot" width="720" />
  </a>
</p>

---

Laden Sie PDFs, Word-Dokumente, PowerPoint-Präsentationen, Tabellenkalkulationen oder beliebige Webseiten hoch — und stellen Sie dann Fragen in natürlicher Sprache. DocTalk liefert KI-generierte Antworten mit nummerierten Quellenverweisen (`[1]`, `[2]`), die direkt auf den Quelltext verlinken. Klicken Sie auf einen Verweis und die entsprechende Passage wird auf der Seite hervorgehoben.

## Warum DocTalk?

- **Quellenbasierte Antworten mit Seitenhervorhebung** — Jede Antwort referenziert exakte Textpassagen. Klicken Sie auf einen Verweis, um zur entsprechenden Seite zu springen und den Text hervorgehoben zu sehen.
- **Multi-Format-Unterstützung** — PDF, DOCX, PPTX, XLSX, TXT, Markdown und URL-Import. Tabellen, Folien und Tabellenkalkulationen werden vollständig unterstützt.
- **3 KI-Leistungsmodi** — Schnelle, Ausgewogene und Gründliche Analyse, angetrieben durch verschiedene LLMs über OpenRouter. Wählen Sie zwischen Geschwindigkeit und Tiefe.
- **11 Sprachen** — Vollständige Benutzeroberfläche und KI-Antworten in Englisch, Chinesisch, Spanisch, Japanisch, Deutsch, Französisch, Koreanisch, Portugiesisch, Italienisch, Arabisch und Hindi.
- **Geteilte Ansicht** — Größenveränderbares Chat-Panel neben einem PDF-Viewer mit Zoom, Suche und Drag-to-Pan.
- **Dokumentsammlungen** — Gruppieren Sie Dokumente und stellen Sie dokumentübergreifende Fragen mit Quellenangabe.
- **Automatische Zusammenfassung** — KI erstellt nach dem Upload eine Dokumentzusammenfassung und schlägt Fragen vor.
- **Datenschutz zuerst** — DSGVO-Datenexport, Cookie-Einwilligung, Verschlüsselung im Ruhezustand, SSRF-Schutz, Non-Root-Container.

<p align="center">
  <a href="https://www.doctalk.site/demo"><strong>Live-Demo ausprobieren &rarr;</strong></a>
</p>

## Technologie-Stack

| Schicht | Technologie |
|---------|-------------|
| **Frontend** | Next.js 14 (App Router), Auth.js v5, react-pdf v9, Tailwind CSS, Radix UI, Zustand |
| **Backend** | FastAPI, Celery, Redis |
| **Datenbank** | PostgreSQL 16, Qdrant (Vektorsuche) |
| **Speicher** | MinIO / S3-kompatibel |
| **Authentifizierung** | Auth.js v5 — Google OAuth, Microsoft OAuth, E-Mail Magic Link |
| **Zahlungen** | Stripe Checkout + Subscriptions |
| **KI** | OpenRouter — DeepSeek V3.2, Mistral Medium 3.1, Mistral Large 2512 |
| **Parsing** | PyMuPDF, Tesseract OCR, python-docx, python-pptx, openpyxl, LibreOffice |
| **Monitoring** | Sentry, Vercel Analytics |

## Architektur

```
Browser ──→ Vercel (Next.js) ──→ Railway (FastAPI) ──→ PostgreSQL
               │                       │                Qdrant
               │                       │                Redis
               └── API Proxy ──────────┘                MinIO
                  (JWT-Injection)
```

**So funktioniert es:** Dokumente werden in Segmente von 150-300 Tokens mit Bounding-Box-Koordinaten aufgeteilt und in Qdrant für die Vektorsuche indexiert. Wenn Sie eine Frage stellen, werden relevante Textabschnitte abgerufen und an das LLM mit Anweisungen zur Quellenangabe gesendet. Die Verweise werden auf exakte Seitenpositionen abgebildet, um Echtzeit-Hervorhebung zu ermöglichen.

Detaillierte Diagramme finden Sie unter [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Schnellstart

### Voraussetzungen

- Docker & Docker Compose
- Python 3.11+, Node.js 18+
- Ein [OpenRouter](https://openrouter.ai) API-Key
- [Google OAuth Zugangsdaten](https://console.cloud.google.com/)

### Einrichtung

```bash
# 1. Klonen und konfigurieren
git clone https://github.com/Rswcf/DocTalk.git
cd DocTalk
cp .env.example .env   # Mit Ihren Schlüsseln bearbeiten

# 2. Infrastruktur starten
docker compose up -d   # PostgreSQL, Qdrant, Redis, MinIO

# 3. Backend
cd backend
pip install -r requirements.txt
python3 -m alembic upgrade head
python3 -m uvicorn app.main:app --reload

# 4. Celery Worker (separates Terminal)
cd backend
OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES python3 -m celery \
  -A app.workers.celery_app worker --loglevel=info -Q default,parse

# 5. Frontend (separates Terminal)
cd frontend
npm install && npm run dev
```

Öffnen Sie [http://localhost:3000](http://localhost:3000).

> `OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES` ist nur unter macOS erforderlich.

<details>
<summary><strong>Umgebungsvariablen</strong></summary>

### Backend (`.env`)

| Variable | Erforderlich | Beschreibung |
|----------|-------------|--------------|
| `DATABASE_URL` | Ja | PostgreSQL-Verbindungszeichenfolge (`postgresql+asyncpg://...`) |
| `OPENROUTER_API_KEY` | Ja | OpenRouter API-Key |
| `AUTH_SECRET` | Ja | Zufälliges Geheimnis (mit Frontend geteilt) |
| `ADAPTER_SECRET` | Ja | Geheimnis für die interne Auth-API |
| `STRIPE_SECRET_KEY` | Nein | Geheimer Stripe-Schlüssel |
| `STRIPE_WEBHOOK_SECRET` | Nein | Stripe Webhook-Signaturgeheimnis |
| `SENTRY_DSN` | Nein | Sentry DSN für Fehlererfassung |
| `OCR_ENABLED` | Nein | OCR für gescannte PDFs aktivieren (Standard: `true`) |
| `OCR_LANGUAGES` | Nein | Tesseract-Sprachcodes (Standard: `eng+chi_sim`) |

### Frontend (`.env.local`)

| Variable | Erforderlich | Beschreibung |
|----------|-------------|--------------|
| `NEXT_PUBLIC_API_BASE` | Ja | Backend-URL (Standard: `http://localhost:8000`) |
| `AUTH_SECRET` | Ja | Muss mit dem Backend `AUTH_SECRET` übereinstimmen |
| `GOOGLE_CLIENT_ID` | Ja | Google OAuth Client-ID |
| `GOOGLE_CLIENT_SECRET` | Ja | Google OAuth Client-Secret |
| `MICROSOFT_CLIENT_ID` | Nein | Microsoft OAuth Client-ID |
| `MICROSOFT_CLIENT_SECRET` | Nein | Microsoft OAuth Client-Secret |
| `RESEND_API_KEY` | Nein | Resend API-Key für Magic-Link-E-Mails |

</details>

<details>
<summary><strong>Projektstruktur</strong></summary>

```
DocTalk/
├── backend/
│   ├── app/
│   │   ├── api/            # Route-Handler (documents, chat, search, billing, auth, users)
│   │   ├── core/           # Konfiguration, Abhängigkeiten, SSRF-Schutz, Sicherheitslogging
│   │   ├── models/         # SQLAlchemy ORM-Modelle
│   │   ├── schemas/        # Pydantic Request/Response-Schemas
│   │   ├── services/       # Geschäftslogik (chat, credits, parsing, retrieval, extractors)
│   │   └── workers/        # Celery Task-Definitionen
│   ├── alembic/            # Datenbankmigrationen
│   ├── seed_data/          # Demo-PDF-Dateien
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── app/            # Next.js-Seiten
│   │   ├── components/     # React-Komponenten
│   │   ├── lib/            # API-Client, Auth, SSE, Hilfsfunktionen
│   │   ├── i18n/           # Sprachdateien für 11 Sprachen
│   │   ├── store/          # Zustand State-Management
│   │   └── types/
│   └── public/
├── docs/
│   ├── ARCHITECTURE.md
│   └── PRODUCT_STRATEGY.md
└── docker-compose.yml
```

</details>

## Deployment

**Branching:** `main` (Entwicklung) / `stable` (Produktion).

| Ziel | Methode |
|------|---------|
| **Frontend** (Vercel) | Push nach `stable` → automatisches Deployment. Root-Verzeichnis: `frontend/`. |
| **Backend** (Railway) | `git checkout stable && railway up --detach` |

Railway betreibt 5 Services: Backend, PostgreSQL, Redis, Qdrant, MinIO.

## Tests

```bash
cd backend && python3 -m pytest tests/test_smoke.py -v     # Smoke-Tests
cd backend && python3 -m pytest -m integration -v           # Integrationstests
cd backend && python3 -m ruff check app/ tests/             # Lint
```

## Mitwirken

Beiträge sind willkommen! Bitte eröffnen Sie zuerst ein Issue, um die gewünschten Änderungen zu besprechen.

1. Forken Sie das Repository
2. Erstellen Sie Ihren Feature-Branch (`git checkout -b feature/grossartige-funktion`)
3. Committen Sie Ihre Änderungen
4. Pushen Sie den Branch und eröffnen Sie einen Pull Request

## Lizenz

[MIT](LICENSE)

---

<p align="center">
  Wenn Sie DocTalk nützlich finden, freuen wir uns über einen Stern. Er hilft anderen, das Projekt zu entdecken.
</p>

<p align="center">
  <a href="https://github.com/Rswcf/DocTalk/stargazers"><img src="https://img.shields.io/github/stars/Rswcf/DocTalk?style=social" alt="Stern auf GitHub" /></a>
</p>
