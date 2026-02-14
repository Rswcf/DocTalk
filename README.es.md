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
  <strong>Chatea con cualquier documento. Obtiene respuestas con citas que resaltan la fuente original.</strong>
</p>

<p align="center">
  <a href="https://github.com/Rswcf/DocTalk/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="Licencia MIT" /></a>
  <a href="https://github.com/Rswcf/DocTalk/stargazers"><img src="https://img.shields.io/github/stars/Rswcf/DocTalk?style=social" alt="Estrellas en GitHub" /></a>
  <a href="https://www.doctalk.site/demo"><img src="https://img.shields.io/badge/Demo%20en%20Vivo-doctalk.site-brightgreen" alt="Demo en Vivo" /></a>
  <a href="https://github.com/Rswcf/DocTalk/pulls"><img src="https://img.shields.io/badge/PRs-bienvenidos-orange.svg" alt="PRs Bienvenidos" /></a>
</p>

<p align="center">
  <a href="https://www.doctalk.site/demo">
    <img src="https://www.doctalk.site/opengraph-image" alt="Captura de pantalla de DocTalk" width="720" />
  </a>
</p>

---

Sube archivos PDF, documentos de Word, presentaciones de PowerPoint, hojas de cálculo o cualquier página web — luego haz preguntas en lenguaje natural. DocTalk devuelve respuestas generadas por IA con citas numeradas (`[1]`, `[2]`) que enlazan directamente al texto fuente. Haz clic en una cita y el pasaje original se resalta en la página.

## ¿Por qué DocTalk?

- **Respuestas con citas y resaltado de página** — Cada respuesta hace referencia a pasajes exactos. Haz clic en una cita para saltar a la página con el texto resaltado.
- **Soporte multi-formato** — PDF, DOCX, PPTX, XLSX, TXT, Markdown e importación de URL. Tablas, diapositivas y hojas de cálculo son totalmente compatibles.
- **3 modos de rendimiento de IA** — Análisis Rápido, Equilibrado y Profundo impulsados por diferentes LLMs a través de OpenRouter. Elige velocidad o profundidad.
- **11 idiomas** — Interfaz completa y respuestas de IA en inglés, chino, español, japonés, alemán, francés, coreano, portugués, italiano, árabe e hindi.
- **Lector con vista dividida** — Panel de chat redimensionable junto a un visor de PDF con zoom, búsqueda y arrastrar para desplazar.
- **Colecciones de documentos** — Agrupa documentos y haz preguntas entre documentos con atribución de fuentes.
- **Resumen automático** — La IA genera un resumen del documento y preguntas sugeridas después de la carga.
- **Privacidad primero** — Exportación de datos GDPR, consentimiento de cookies, cifrado en reposo, protección SSRF, contenedores non-root.

<p align="center">
  <a href="https://www.doctalk.site/demo"><strong>Prueba la demo en vivo &rarr;</strong></a>
</p>

## Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| **Frontend** | Next.js 14 (App Router), Auth.js v5, react-pdf v9, Tailwind CSS, Radix UI, Zustand |
| **Backend** | FastAPI, Celery, Redis |
| **Base de Datos** | PostgreSQL 16, Qdrant (búsqueda vectorial) |
| **Almacenamiento** | MinIO / Compatible con S3 |
| **Autenticación** | Auth.js v5 — Google OAuth, Microsoft OAuth, Email Magic Link |
| **Pagos** | Stripe Checkout + Subscriptions |
| **IA** | OpenRouter — DeepSeek V3.2, Mistral Medium 3.1, Mistral Large 2512 |
| **Parsing** | PyMuPDF, Tesseract OCR, python-docx, python-pptx, openpyxl, LibreOffice |
| **Monitoreo** | Sentry, Vercel Analytics |

## Arquitectura

```
Navegador ──→ Vercel (Next.js) ──→ Railway (FastAPI) ──→ PostgreSQL
                │                       │                  Qdrant
                │                       │                  Redis
                └── API Proxy ──────────┘                  MinIO
                   (inyección de JWT)
```

**Cómo funciona:** Los documentos se dividen en segmentos de 150-300 tokens con coordenadas de bounding box, y se indexan en Qdrant para búsqueda vectorial. Cuando haces una pregunta, los fragmentos relevantes se recuperan y se envían al LLM con instrucciones para citar fuentes. Las citas se mapean a ubicaciones exactas en la página para resaltado en tiempo real.

Para diagramas detallados consulta [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Inicio Rápido

### Requisitos Previos

- Docker & Docker Compose
- Python 3.11+, Node.js 18+
- Una API key de [OpenRouter](https://openrouter.ai)
- [Credenciales de Google OAuth](https://console.cloud.google.com/)

### Configuración

```bash
# 1. Clonar y configurar
git clone https://github.com/Rswcf/DocTalk.git
cd DocTalk
cp .env.example .env   # Editar con tus claves

# 2. Iniciar infraestructura
docker compose up -d   # PostgreSQL, Qdrant, Redis, MinIO

# 3. Backend
cd backend
pip install -r requirements.txt
python3 -m alembic upgrade head
python3 -m uvicorn app.main:app --reload

# 4. Celery worker (terminal separada)
cd backend
OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES python3 -m celery \
  -A app.workers.celery_app worker --loglevel=info -Q default,parse

# 5. Frontend (terminal separada)
cd frontend
npm install && npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

> `OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES` solo es necesario en macOS.

<details>
<summary><strong>Variables de Entorno</strong></summary>

### Backend (`.env`)

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `DATABASE_URL` | Sí | Cadena de conexión PostgreSQL (`postgresql+asyncpg://...`) |
| `OPENROUTER_API_KEY` | Sí | API key de OpenRouter |
| `AUTH_SECRET` | Sí | Secreto aleatorio (compartido con el frontend) |
| `ADAPTER_SECRET` | Sí | Secreto para la API de autenticación interna |
| `STRIPE_SECRET_KEY` | No | Clave secreta de Stripe |
| `STRIPE_WEBHOOK_SECRET` | No | Secreto de firma del webhook de Stripe |
| `SENTRY_DSN` | No | DSN de Sentry para rastreo de errores |
| `OCR_ENABLED` | No | Habilitar OCR para PDFs escaneados (por defecto: `true`) |
| `OCR_LANGUAGES` | No | Códigos de idioma de Tesseract (por defecto: `eng+chi_sim`) |

### Frontend (`.env.local`)

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `NEXT_PUBLIC_API_BASE` | Sí | URL del backend (por defecto: `http://localhost:8000`) |
| `AUTH_SECRET` | Sí | Debe coincidir con el `AUTH_SECRET` del backend |
| `GOOGLE_CLIENT_ID` | Sí | ID de cliente de Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Sí | Secreto de cliente de Google OAuth |
| `MICROSOFT_CLIENT_ID` | No | ID de cliente de Microsoft OAuth |
| `MICROSOFT_CLIENT_SECRET` | No | Secreto de cliente de Microsoft OAuth |
| `RESEND_API_KEY` | No | API key de Resend para emails de magic link |

</details>

<details>
<summary><strong>Estructura del Proyecto</strong></summary>

```
DocTalk/
├── backend/
│   ├── app/
│   │   ├── api/            # Manejadores de rutas (documents, chat, search, billing, auth, users)
│   │   ├── core/           # Configuración, dependencias, protección SSRF, logging de seguridad
│   │   ├── models/         # Modelos ORM de SQLAlchemy
│   │   ├── schemas/        # Esquemas de request/response Pydantic
│   │   ├── services/       # Lógica de negocio (chat, credits, parsing, retrieval, extractors)
│   │   └── workers/        # Definiciones de tareas Celery
│   ├── alembic/            # Migraciones de base de datos
│   ├── seed_data/          # Archivos PDF de demo
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── app/            # Páginas de Next.js
│   │   ├── components/     # Componentes React
│   │   ├── lib/            # Cliente API, auth, SSE, utilidades
│   │   ├── i18n/           # Archivos de localización en 11 idiomas
│   │   ├── store/          # Gestión de estado con Zustand
│   │   └── types/
│   └── public/
├── docs/
│   ├── ARCHITECTURE.md
│   └── PRODUCT_STRATEGY.md
└── docker-compose.yml
```

</details>

## Despliegue

**Ramas:** `main` (desarrollo) / `stable` (producción).

| Destino | Método |
|---------|--------|
| **Frontend** (Vercel) | Push a `stable` → despliegue automático. Directorio raíz: `frontend/`. |
| **Backend** (Railway) | `git checkout stable && railway up --detach` |

Railway ejecuta 5 servicios: backend, PostgreSQL, Redis, Qdrant, MinIO.

## Pruebas

```bash
cd backend && python3 -m pytest tests/test_smoke.py -v     # Pruebas de humo
cd backend && python3 -m pytest -m integration -v           # Pruebas de integración
cd backend && python3 -m ruff check app/ tests/             # Lint
```

## Contribuir

Las contribuciones son bienvenidas. Por favor, abre un issue primero para discutir los cambios que te gustaría realizar.

1. Haz un fork del repositorio
2. Crea tu rama de funcionalidad (`git checkout -b feature/funcionalidad-increible`)
3. Haz commit de tus cambios
4. Haz push a la rama y abre un Pull Request

## Licencia

[MIT](LICENSE)

---

<p align="center">
  Si DocTalk te resulta útil, considera darle una estrella. Ayuda a que otros descubran el proyecto.
</p>

<p align="center">
  <a href="https://github.com/Rswcf/DocTalk/stargazers"><img src="https://img.shields.io/github/stars/Rswcf/DocTalk?style=social" alt="Estrella en GitHub" /></a>
</p>
