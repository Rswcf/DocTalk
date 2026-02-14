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
  <strong>Discutez avec n'importe quel document. Obtenez des reponses avec des citations qui surlignent la source.</strong>
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

Importez des PDF, des documents Word, des PowerPoint, des feuilles de calcul ou n'importe quelle page web, puis posez vos questions en langage naturel. DocTalk fournit des reponses generees par IA avec des citations numerotees (`[1]`, `[2]`) qui renvoient directement au texte source. Cliquez sur une citation pour acceder a la page correspondante avec le passage surligne.

## Pourquoi DocTalk ?

- **Reponses citees avec surlignage** — Chaque reponse reference des passages precis. Cliquez sur une citation pour acceder a la page avec le texte surligne.
- **Support multi-format** — PDF, DOCX, PPTX, XLSX, TXT, Markdown et import d'URL. Tableaux, diapositives et feuilles de calcul entierement pris en charge.
- **3 modes de performance IA** — Analyse rapide, equilibree et approfondie, alimentee par differents LLM via OpenRouter. Choisissez entre vitesse et profondeur.
- **11 langues** — Interface et reponses IA disponibles en anglais, chinois, espagnol, japonais, allemand, francais, coreen, portugais, italien, arabe et hindi.
- **Lecteur en vue partagee** — Panneau de discussion redimensionnable a cote d'un lecteur PDF avec zoom, recherche et deplacement par glisser.
- **Collections de documents** — Regroupez des documents et posez des questions transversales avec attribution des sources.
- **Resume automatique** — L'IA genere un resume du document et des questions suggerees apres l'import.
- **Confidentialite d'abord** — Export de donnees RGPD, consentement aux cookies, chiffrement au repos, protection SSRF, conteneurs non-root.

<p align="center">
  <a href="https://www.doctalk.site/demo"><strong>Essayer la demo en ligne &rarr;</strong></a>
</p>

## Stack technique

| Couche | Technologie |
|--------|-------------|
| **Frontend** | Next.js 14 (App Router), Auth.js v5, react-pdf v9, Tailwind CSS, Radix UI, Zustand |
| **Backend** | FastAPI, Celery, Redis |
| **Base de donnees** | PostgreSQL 16, Qdrant (recherche vectorielle) |
| **Stockage** | MinIO / Compatible S3 |
| **Authentification** | Auth.js v5 — Google OAuth, Microsoft OAuth, Email Magic Link |
| **Paiements** | Stripe Checkout + Subscriptions |
| **IA** | OpenRouter — DeepSeek V3.2, Mistral Medium 3.1, Mistral Large 2512 |
| **Analyse de documents** | PyMuPDF, Tesseract OCR, python-docx, python-pptx, openpyxl, LibreOffice |
| **Monitoring** | Sentry, Vercel Analytics |

## Architecture

```
Navigateur ──→ Vercel (Next.js) ──→ Railway (FastAPI) ──→ PostgreSQL
                   │                       │                Qdrant
                   │                       │                Redis
                   └── Proxy API ──────────┘                MinIO
                      (injection JWT)
```

**Fonctionnement :** Les documents sont decoupes en segments de 150 a 300 tokens avec des coordonnees de boites englobantes, puis indexes dans Qdrant pour la recherche vectorielle. Lorsque vous posez une question, les segments pertinents sont recuperes et envoyes au LLM avec des instructions pour citer les sources. Les citations sont ensuite reliees aux emplacements exacts dans les pages pour un surlignage en temps reel.

Pour des diagrammes detailles, consultez [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Demarrage rapide

### Prerequis

- Docker & Docker Compose
- Python 3.11+, Node.js 18+
- Une cle API [OpenRouter](https://openrouter.ai)
- Des [identifiants Google OAuth](https://console.cloud.google.com/)

### Installation

```bash
# 1. Cloner et configurer
git clone https://github.com/Rswcf/DocTalk.git
cd DocTalk
cp .env.example .env   # Modifier avec vos cles

# 2. Demarrer l'infrastructure
docker compose up -d   # PostgreSQL, Qdrant, Redis, MinIO

# 3. Backend
cd backend
pip install -r requirements.txt
python3 -m alembic upgrade head
python3 -m uvicorn app.main:app --reload

# 4. Worker Celery (terminal separe)
cd backend
OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES python3 -m celery \
  -A app.workers.celery_app worker --loglevel=info -Q default,parse

# 5. Frontend (terminal separe)
cd frontend
npm install && npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000).

> `OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES` est uniquement necessaire sur macOS.

<details>
<summary><strong>Variables d'environnement</strong></summary>

### Backend (`.env`)

| Variable | Requis | Description |
|----------|--------|-------------|
| `DATABASE_URL` | Oui | Chaine de connexion PostgreSQL (`postgresql+asyncpg://...`) |
| `OPENROUTER_API_KEY` | Oui | Cle API OpenRouter |
| `AUTH_SECRET` | Oui | Secret aleatoire (partage avec le frontend) |
| `ADAPTER_SECRET` | Oui | Secret pour l'API d'authentification interne |
| `STRIPE_SECRET_KEY` | Non | Cle secrete Stripe |
| `STRIPE_WEBHOOK_SECRET` | Non | Secret de signature des webhooks Stripe |
| `SENTRY_DSN` | Non | DSN Sentry pour le suivi des erreurs |
| `OCR_ENABLED` | Non | Activer l'OCR pour les PDF scannes (defaut : `true`) |
| `OCR_LANGUAGES` | Non | Codes de langue Tesseract (defaut : `eng+chi_sim`) |

### Frontend (`.env.local`)

| Variable | Requis | Description |
|----------|--------|-------------|
| `NEXT_PUBLIC_API_BASE` | Oui | URL du backend (defaut : `http://localhost:8000`) |
| `AUTH_SECRET` | Oui | Doit correspondre au `AUTH_SECRET` du backend |
| `GOOGLE_CLIENT_ID` | Oui | ID client Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Oui | Secret client Google OAuth |
| `MICROSOFT_CLIENT_ID` | Non | ID client Microsoft OAuth |
| `MICROSOFT_CLIENT_SECRET` | Non | Secret client Microsoft OAuth |
| `RESEND_API_KEY` | Non | Cle API Resend pour les emails Magic Link |

</details>

<details>
<summary><strong>Structure du projet</strong></summary>

```
DocTalk/
├── backend/
│   ├── app/
│   │   ├── api/            # Gestionnaires de routes (documents, chat, recherche, facturation, auth, utilisateurs)
│   │   ├── core/           # Configuration, dependances, protection SSRF, journalisation securisee
│   │   ├── models/         # Modeles ORM SQLAlchemy
│   │   ├── schemas/        # Schemas Pydantic requete/reponse
│   │   ├── services/       # Logique metier (chat, credits, analyse, recherche, extracteurs)
│   │   └── workers/        # Definitions des taches Celery
│   ├── alembic/            # Migrations de base de donnees
│   ├── seed_data/          # Fichiers PDF de demo
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── app/            # Pages Next.js
│   │   ├── components/     # Composants React
│   │   ├── lib/            # Client API, auth, SSE, utilitaires
│   │   ├── i18n/           # Fichiers de traduction (11 langues)
│   │   ├── store/          # Gestion d'etat Zustand
│   │   └── types/
│   └── public/
├── docs/
│   ├── ARCHITECTURE.md
│   └── PRODUCT_STRATEGY.md
└── docker-compose.yml
```

</details>

## Deploiement

**Strategie de branches :** `main` (developpement) / `stable` (production).

| Cible | Methode |
|-------|---------|
| **Frontend** (Vercel) | Push sur `stable` → deploiement automatique. Repertoire racine : `frontend/`. |
| **Backend** (Railway) | `git checkout stable && railway up --detach` |

Railway execute 5 services : backend, PostgreSQL, Redis, Qdrant, MinIO.

## Tests

```bash
cd backend && python3 -m pytest tests/test_smoke.py -v     # Tests de fumee
cd backend && python3 -m pytest -m integration -v           # Tests d'integration
cd backend && python3 -m ruff check app/ tests/             # Lint
```

## Contribuer

Les contributions sont les bienvenues ! Veuillez d'abord ouvrir une issue pour discuter des modifications souhaitees.

1. Forkez le depot
2. Creez votre branche de fonctionnalite (`git checkout -b feature/amazing-feature`)
3. Committez vos modifications
4. Poussez la branche et ouvrez une Pull Request

## Licence

[MIT](LICENSE)

---

<p align="center">
  Si vous trouvez DocTalk utile, n'hesitez pas a lui attribuer une etoile. Cela aide d'autres personnes a decouvrir le projet.
</p>

<p align="center">
  <a href="https://github.com/Rswcf/DocTalk/stargazers"><img src="https://img.shields.io/github/stars/Rswcf/DocTalk?style=social" alt="Star on GitHub" /></a>
</p>
