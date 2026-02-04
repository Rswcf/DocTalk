Done. I scaffolded Docker Compose, backend (FastAPI), frontend (Next.js), added .env.example and .gitignore, and updated the task status and notes.

**What I Built**
- Docker Compose with PostgreSQL 16, Qdrant, Redis, MinIO; all with named volumes.
- Backend FastAPI skeleton with CORS and /health endpoint; pydantic-settings for config.
- Frontend Next.js 14 (App Router, src), TypeScript, Tailwind, ESLint; deps for react-pdf, zustand, @radix-ui/react-slot.
- .env.example including all Tech Spec v1 Section 3 variables (plus FRONTEND_URL, DATABASE_URL).
- .gitignore for Python, Node, .env, MinIO data, caches.

**Key Files**
- docker-compose.yml:1
- backend/requirements.txt:1
- backend/Dockerfile:1
- backend/app/main.py:1
- backend/app/core/config.py:1
- backend/app/core/deps.py:1
- backend/app/models/__init__.py:1
- backend/app/schemas/__init__.py:1
- backend/app/api/__init__.py:1
- backend/app/services/__init__.py:1
- backend/app/workers/__init__.py:1
- frontend/package.json:1
- frontend/tsconfig.json:1
- frontend/tailwind.config.ts:1
- frontend/postcss.config.js:1
- frontend/src/app/layout.tsx:1
- frontend/src/app/page.tsx:1
- frontend/src/app/globals.css:1
- frontend/next-env.d.ts:1
- .env.example:1
- .gitignore:1
- .collab/tasks/current.md: Task 1.1 status updated and CX_NOTES added

**How To Run**
- Infra: `docker compose up -d`
- Backend: `cp .env.example backend/.env` (or keep env in repo root) then `cd backend && uvicorn app.main:app --reload` and open `http://localhost:8000/health`
- Frontend: `cd frontend && npm install && npm run dev` then open `http://localhost:3000`

**Notes**
- CORS reads `FRONTEND_URL` (default http://localhost:3000).
- Config loads `.env` from `backend/.env` or falls back to repo root `.env`.
- DB session DI is a placeholder per Task 1.2 scope.
- Frontend was manually scaffolded (no network). All required deps are declared in package.json.

**Task Update**
- Marked Task 1.1 as DONE and recorded decisions under CX_NOTES in `.collab/tasks/current.md`.