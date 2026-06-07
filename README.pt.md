<p align="center">
  <a href="README.md">English</a> ·
  <a href="README.zh.md">中文</a> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.de.md">Deutsch</a> ·
  <strong>Português</strong> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.ko.md">한국어</a>
</p>

<h1 align="center">DocTalk</h1>

<p align="center">
  <strong>Converse com qualquer documento. Obtenha respostas com citações que destacam a fonte.</strong>
</p>

<p align="center">
  <a href="https://github.com/Rswcf/DocTalk/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="Licença MIT" /></a>
  <a href="https://github.com/Rswcf/DocTalk/stargazers"><img src="https://img.shields.io/github/stars/Rswcf/DocTalk?style=social" alt="GitHub Stars" /></a>
  <a href="https://www.doctalk.site/demo"><img src="https://img.shields.io/badge/Live%20Demo-doctalk.site-brightgreen" alt="Demo ao Vivo" /></a>
  <a href="https://github.com/Rswcf/DocTalk/pulls"><img src="https://img.shields.io/badge/PRs-welcome-orange.svg" alt="PRs são bem-vindos" /></a>
</p>

<p align="center">
  <a href="https://www.doctalk.site/demo">
    <img src="https://www.doctalk.site/opengraph-image" alt="Captura de tela do DocTalk" width="720" />
  </a>
</p>

---

Faça upload de PDFs, documentos do Word, apresentações do PowerPoint, planilhas ou qualquer página da web — e depois faça perguntas em linguagem natural. O DocTalk retorna respostas geradas por IA com citações numeradas (`[1]`, `[2]`) que apontam diretamente para o texto original. Clique em uma citação e a passagem correspondente é destacada na página.

## Por que DocTalk?

- **Respostas citadas com destaque na página** — Cada resposta referencia passagens exatas. Clique em uma citação para ir diretamente à página com o texto destacado.
- **Suporte a múltiplos formatos** — PDF, DOCX, PPTX, XLSX, TXT, Markdown e importação de URLs. Tabelas, slides e planilhas são totalmente suportados.
- **2 modos de desempenho de IA** — Flash para respostas citadas rápidas e Pro para análise mais profunda, com DeepSeek V4.
- **11 idiomas** — Interface completa e respostas de IA em Inglês, Chinês, Espanhol, Japonês, Alemão, Francês, Coreano, Português, Italiano, Árabe e Hindi.
- **Tradução de PDF preservando o layout** — Traduza PDFs com muito texto para um novo PDF, visualize-o ao lado do original e opcionalmente adicione-o como novo documento DocTalk. O gratuito inclui 2 testes; Plus/Pro liberam uso contínuo.
- **Visualização dividida** — Painel de chat redimensionável ao lado de um visualizador de PDF com zoom, busca e arrastar para navegar.
- **Coleções de documentos** — Agrupe documentos e faça perguntas cruzadas entre documentos com atribuição de fonte.
- **Resumo automático** — A IA gera um resumo do documento e perguntas sugeridas após o upload.
- **Privacidade em primeiro lugar** — Exportação de dados GDPR, consentimento de cookies, criptografia em repouso, proteção contra SSRF, containers não-root.

<p align="center">
  <a href="https://www.doctalk.site/demo"><strong>Experimente a demo ao vivo &rarr;</strong></a>
</p>

## Stack Tecnológico

| Camada | Tecnologia |
|--------|------------|
| **Frontend** | Next.js 14 (App Router), Auth.js v5, react-pdf v9, Tailwind CSS, Radix UI, Zustand |
| **Backend** | FastAPI, Celery, Redis |
| **Banco de Dados** | PostgreSQL 16, Qdrant (busca vetorial) |
| **Armazenamento** | MinIO / compatível com S3 |
| **Autenticação** | Auth.js v5 — Google OAuth, Microsoft OAuth, Email Magic Link |
| **Pagamentos** | Stripe Checkout + Subscriptions |
| **IA** | DeepSeek V4 Flash/Pro para chat; OpenRouter para embeddings e modelos de fallback |
| **Parsing** | Azure AI Document Intelligence, PyMuPDF, Tesseract OCR, python-docx, python-pptx, openpyxl, LibreOffice |
| **Tradução PDF** | Sidecar RetainPDF, tradução DeepSeek, provedores OCR Paddle/MinerU/Datalab |
| **Monitoramento** | Sentry, Vercel Analytics |

## Arquitetura

```
Browser ──→ Vercel (Next.js) ──→ Railway (FastAPI) ──→ PostgreSQL
                │                       │                Qdrant
                │                       │                Redis
                └── API Proxy ──────────┘                MinIO
                   (injeção de JWT)
```

**Como funciona:** Os documentos são divididos em segmentos de 150-300 tokens com coordenadas de bounding box, e indexados no Qdrant para busca vetorial. Quando você faz uma pergunta, os trechos relevantes são recuperados e enviados ao LLM com instruções para citar as fontes. As citações mapeiam de volta para localizações exatas na página, permitindo destaque em tempo real.

Para diagramas detalhados, consulte [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Início Rápido

### Pré-requisitos

- Docker & Docker Compose
- Python 3.11+, Node.js 18+
- Uma chave de API do [OpenRouter](https://openrouter.ai)
- [Credenciais Google OAuth](https://console.cloud.google.com/)

### Configuração

```bash
# 1. Clone e configure
git clone https://github.com/Rswcf/DocTalk.git
cd DocTalk
cp .env.example .env   # Edite com suas chaves

# 2. Inicie a infraestrutura
docker compose up -d   # PostgreSQL, Qdrant, Redis, MinIO

# 3. Backend
cd backend
pip install -r requirements.txt
python3 -m alembic upgrade head
python3 -m uvicorn app.main:app --reload

# 4. Celery worker (terminal separado)
cd backend
OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES python3 -m celery \
  -A app.workers.celery_app worker --loglevel=info -Q default,parse

# 5. Frontend (terminal separado)
cd frontend
npm install && npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

> `OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES` é necessário apenas no macOS.

<details>
<summary><strong>Variáveis de Ambiente</strong></summary>

### Backend (`.env`)

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `DATABASE_URL` | Sim | String de conexão PostgreSQL (`postgresql+asyncpg://...`) |
| `OPENROUTER_API_KEY` | Sim | Chave de API do OpenRouter |
| `AUTH_SECRET` | Sim | Secret aleatório (compartilhado com o frontend) |
| `ADAPTER_SECRET` | Sim | Secret para API de autenticação interna |
| `STRIPE_SECRET_KEY` | Não | Chave secreta do Stripe |
| `STRIPE_WEBHOOK_SECRET` | Não | Secret de assinatura de webhook do Stripe |
| `SENTRY_DSN` | Não | DSN do Sentry para rastreamento de erros |
| `OCR_ENABLED` | Não | Habilitar OCR para PDFs digitalizados (padrão: `true`) |
| `OCR_LANGUAGES` | Não | Idiomas do Tesseract instalados; o parser seleciona automaticamente um subconjunto reduzido por documento conforme o script detectado (padrão: `eng+chi_sim+jpn+kor+spa+deu+fra+por+ita+ara+hin+urd`) |
| `FREE_LAYOUT_TRANSLATIONS_LIMIT` | Não | Número de testes gratuitos vitalícios para tradução de PDF preservando layout (padrão: `2`) |
| `FREE_LAYOUT_TRANSLATION_MAX_PAGES` | Não | Limite de páginas por tradução PDF no plano gratuito (padrão: `25`) |
| `PLUS_LAYOUT_TRANSLATION_MAX_PAGES` | Não | Limite de páginas por tradução PDF no Plus (padrão: `150`) |
| `PRO_LAYOUT_TRANSLATION_MAX_PAGES` | Não | Limite de páginas por tradução PDF no Pro (padrão: `300`) |
| `LAYOUT_TRANSLATION_MAX_FILE_SIZE_MB` | Não | Limite rígido de tamanho de arquivo para tradução PDF (padrão: `50`) |
| `LAYOUT_TRANSLATION_ENGINE` | Não | Motor de tradução PDF preservando layout. Use `retainpdf` para ativar o fluxo sidecar de produção |
| `RETAINPDF_API_BASE_URL` | Se a tradução estiver ativada | URL completa da API do sidecar RetainPDF, geralmente `http://...:41000` |
| `RETAINPDF_API_KEY` | Não | API key opcional do sidecar RetainPDF |
| `RETAINPDF_OCR_PROVIDER` | Se a tradução estiver ativada | Provedor OCR para RetainPDF: `datalab`, `paddle` ou `mineru` |
| `RETAINPDF_PADDLE_TOKEN` | Se o provedor for Paddle | Token Paddle OCR usado pelo RetainPDF |
| `RETAINPDF_MINERU_TOKEN` | Se o provedor for MinerU | Token MinerU OCR usado pelo RetainPDF |
| `RETAINPDF_DATALAB_TOKEN` | Se o provedor for Datalab | Token Datalab opcional; vazio, a tradução PDF reutiliza `DATALAB_API_KEY` |
| `RETAINPDF_DATALAB_API_URL` | Não | Origem da API Datalab, padrão `https://www.datalab.to` |
| `RETAINPDF_DATALAB_MODE` | Não | Modo de conversão Datalab, padrão `balanced` |
| `RETAINPDF_DATALAB_OUTPUT_FORMAT` | Não | Formatos de saída Datalab, padrão `json,markdown` |
| `RETAINPDF_TRANSLATION_API_KEY` | Não | Override opcional; vazio, a tradução PDF reutiliza `DEEPSEEK_API_KEY` |
| `RETAINPDF_TRANSLATION_BASE_URL` | Não | URL base da API de tradução, padrão `https://api.deepseek.com/v1` |
| `RETAINPDF_TRANSLATION_MODEL` | Não | Modelo de tradução, padrão `deepseek-v4-flash` |

### Frontend (`.env.local`)

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `NEXT_PUBLIC_API_BASE` | Sim | URL do backend (padrão: `http://localhost:8000`) |
| `BACKEND_INTERNAL_URL` | Não | Destino do proxy do lado do servidor (rede privada). Tem prioridade sobre `NEXT_PUBLIC_API_BASE` quando definido |
| `AUTH_SECRET` | Sim | Deve ser igual ao `AUTH_SECRET` do backend |
| `ADAPTER_SECRET` | Sim | Deve ser igual ao `ADAPTER_SECRET` do backend. Usado para assinar com HMAC o claim `X-Proxy-IP` |
| `GOOGLE_CLIENT_ID` | Sim | Client ID do Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Sim | Client Secret do Google OAuth |
| `MICROSOFT_CLIENT_ID` | Não | Client ID do Microsoft OAuth |
| `MICROSOFT_CLIENT_SECRET` | Não | Client Secret do Microsoft OAuth |
| `RESEND_API_KEY` | Não | Chave de API do Resend para e-mails de magic link |

</details>

<details>
<summary><strong>Estrutura do Projeto</strong></summary>

```
DocTalk/
├── backend/
│   ├── app/
│   │   ├── api/            # Handlers de rotas (documents, chat, search, billing, auth, users)
│   │   ├── core/           # Config, dependências, proteção SSRF, logging de segurança
│   │   ├── models/         # Modelos ORM SQLAlchemy
│   │   ├── schemas/        # Schemas Pydantic de request/response
│   │   ├── services/       # Lógica de negócios (chat, créditos, parsing, retrieval, extractors)
│   │   └── workers/        # Definições de tarefas Celery
│   ├── alembic/            # Migrações de banco de dados
│   ├── seed_data/          # Arquivos PDF de demonstração
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── app/            # Páginas Next.js
│   │   ├── components/     # Componentes React
│   │   ├── lib/            # Cliente API, auth, SSE, utilitários
│   │   ├── i18n/           # Arquivos de localização (11 idiomas)
│   │   ├── store/          # Gerenciamento de estado Zustand
│   │   └── types/
│   └── public/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── layout-translation-retainpdf.md
│   └── PRODUCT_STRATEGY.md
└── docker-compose.yml
```

</details>

## Deploy

**Branches:** `main` (desenvolvimento) / `stable` (produção).

| Destino | Método |
|---------|--------|
| **Frontend** (Vercel) | Push para `stable` → deploy automático. Diretório raiz: `frontend/`. |
| **Backend** (Railway) | `git checkout stable && railway up --detach` |

O Railway executa os serviços principais: backend, PostgreSQL, Redis, Qdrant e MinIO; a tradução de PDF preservando layout adiciona o sidecar RetainPDF.

## Testes

```bash
cd backend && python3 -m pytest tests/test_smoke.py -v     # Smoke tests
cd backend && python3 -m pytest -m integration -v           # Testes de integração
cd backend && python3 -m ruff check app/ tests/             # Lint
```

## Contribuindo

Contribuições são bem-vindas! Por favor, abra uma issue primeiro para discutir o que você gostaria de alterar.

1. Faça um fork do repositório
2. Crie sua branch de feature (`git checkout -b feature/recurso-incrivel`)
3. Faça commit das suas alterações
4. Faça push para a branch e abra um Pull Request

## Licença

[MIT](LICENSE)

---

<p align="center">
  Se o DocTalk foi útil para você, considere dar uma estrela. Isso ajuda outras pessoas a descobrir o projeto.
</p>

<p align="center">
  <a href="https://github.com/Rswcf/DocTalk/stargazers"><img src="https://img.shields.io/github/stars/Rswcf/DocTalk?style=social" alt="Dar estrela no GitHub" /></a>
</p>
