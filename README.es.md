<p align="center">
  <a href="README.md">English</a> ·
  <a href="README.zh.md">中文</a> ·
  <a href="README.fr.md">Français</a> ·
  <strong>Español</strong> ·
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
- **2 modos de rendimiento de IA** — Flash para respuestas citadas rápidas y Pro para análisis más profundo, impulsados por DeepSeek V4.
- **11 idiomas** — Interfaz completa y respuestas de IA en inglés, chino, español, japonés, alemán, francés, coreano, portugués, italiano, árabe e hindi.
- **Traducción de PDF conservando el diseño** — Traduce PDF con mucho texto a un nuevo PDF, previsualízalo junto al original y opcionalmente añádelo como nuevo documento DocTalk. Gratis incluye 2 pruebas; Plus/Pro desbloquean el uso continuo.
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
| **IA** | DeepSeek V4 Flash/Pro para chat; OpenRouter para embeddings y modelos de respaldo |
| **Parsing** | Azure AI Document Intelligence, PyMuPDF, Tesseract OCR, python-docx, python-pptx, openpyxl, LibreOffice |
| **Traducción PDF** | Sidecar RetainPDF, traducción DeepSeek, proveedores OCR Paddle/MinerU/Datalab |
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
| `OCR_LANGUAGES` | No | Idiomas de Tesseract instalados; el parser selecciona automáticamente un subconjunto reducido por documento según el script detectado (por defecto: `eng+chi_sim+jpn+kor+spa+deu+fra+por+ita+ara+hin+urd`) |
| `FREE_LAYOUT_TRANSLATIONS_LIMIT` | No | Número de pruebas gratuitas de por vida para traducción de PDF conservando el diseño (por defecto: `2`) |
| `FREE_LAYOUT_TRANSLATION_MAX_PAGES` | No | Límite de páginas por traducción PDF en el plan gratuito (por defecto: `25`) |
| `PLUS_LAYOUT_TRANSLATION_MAX_PAGES` | No | Límite de páginas por traducción PDF en Plus (por defecto: `150`) |
| `PRO_LAYOUT_TRANSLATION_MAX_PAGES` | No | Límite de páginas por traducción PDF en Pro (por defecto: `300`) |
| `LAYOUT_TRANSLATION_MAX_FILE_SIZE_MB` | No | Límite estricto de tamaño de archivo para traducción PDF (por defecto: `50`) |
| `LAYOUT_TRANSLATION_ENGINE` | No | Motor de traducción PDF conservando el diseño. Usa `retainpdf` para habilitar el flujo sidecar de producción |
| `RETAINPDF_API_BASE_URL` | Si la traducción está habilitada | URL completa de la API del sidecar RetainPDF, normalmente `http://...:41000` |
| `RETAINPDF_API_KEY` | No | API key opcional del sidecar RetainPDF |
| `RETAINPDF_OCR_PROVIDER` | Si la traducción está habilitada | Proveedor OCR para RetainPDF: `datalab`, `paddle` o `mineru` |
| `RETAINPDF_PADDLE_TOKEN` | Si el proveedor es Paddle | Token Paddle OCR usado por RetainPDF |
| `RETAINPDF_MINERU_TOKEN` | Si el proveedor es MinerU | Token MinerU OCR usado por RetainPDF |
| `RETAINPDF_DATALAB_TOKEN` | Si el proveedor es Datalab | Token Datalab opcional; si está vacío, la traducción PDF reutiliza `DATALAB_API_KEY` |
| `RETAINPDF_DATALAB_API_URL` | No | Origen de la API Datalab, por defecto `https://www.datalab.to` |
| `RETAINPDF_DATALAB_MODE` | No | Modo de conversión Datalab, por defecto `balanced` |
| `RETAINPDF_DATALAB_OUTPUT_FORMAT` | No | Formatos de salida Datalab, por defecto `json,markdown` |
| `RETAINPDF_TRANSLATION_API_KEY` | No | Reemplazo opcional; si está vacío, la traducción PDF reutiliza `DEEPSEEK_API_KEY` |
| `RETAINPDF_TRANSLATION_BASE_URL` | No | URL base de la API de traducción, por defecto `https://api.deepseek.com/v1` |
| `RETAINPDF_TRANSLATION_MODEL` | No | Modelo de traducción, por defecto `deepseek-v4-flash` |

### Frontend (`.env.local`)

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `NEXT_PUBLIC_API_BASE` | Sí | URL del backend (por defecto: `http://localhost:8000`) |
| `BACKEND_INTERNAL_URL` | No | Destino del proxy del lado servidor (red privada). Tiene prioridad sobre `NEXT_PUBLIC_API_BASE` cuando está definido |
| `AUTH_SECRET` | Sí | Debe coincidir con el `AUTH_SECRET` del backend |
| `ADAPTER_SECRET` | Sí | Debe coincidir con el `ADAPTER_SECRET` del backend. Se usa para firmar con HMAC el claim `X-Proxy-IP` |
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
│   ├── layout-translation-retainpdf.md
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

Railway ejecuta los servicios principales: backend, PostgreSQL, Redis, Qdrant y MinIO; la traducción PDF conservando el diseño añade el sidecar RetainPDF.

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
