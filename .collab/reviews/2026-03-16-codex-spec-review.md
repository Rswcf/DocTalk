**CRITICAL issues (must fix)**

- **Feature 1 endpoint/signature mismatches will break implementation as written.** Spec uses `GET /sessions/{id}/export`, `Depends(get_db)`, and `check_subscription(...)`, but codebase uses `/api/...`, `get_db_session`, and inline plan checks (no `check_subscription` helper).  
  [chat.py:41](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/chat.py:41)  
  [deps.py:18](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/core/deps.py:18)  
  [chat_service.py:279](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py:279)

- **Feature gating in spec conflicts with current subscription system.** Spec says Free gets Markdown export; current product gates export behind Plus/Pro and pricing copy reflects that.  
  [ChatPanel.tsx:183](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/Chat/ChatPanel.tsx:183)  
  [PricingTable.tsx:22](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/PricingTable.tsx:22)  
  [en.json:117](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/i18n/locales/en.json:117)

- **Feature 4 prompt integration snippet has a runtime bug and missing plumbing.** `base_rules` is undefined in the proposed loop; also `ChatRequest`, `sessions` model, and prompt rules currently have no `domain_mode` support.  
  [chat.py schema:10](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/schemas/chat.py:10)  
  [tables.py sessions:140](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/models/tables.py:140)  
  [model_profiles.py:27](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/core/model_profiles.py:27)

- **PDF export dependency plan is incomplete for deployment and has a security gap.** `weasyprint` is not present; backend Docker image currently does not install WeasyPrint runtime libs. Also spec should explicitly require HTML escaping/sanitization to avoid SSRF/resource fetch risks during render.  
  [requirements.txt:20](/Users/mayijie/Projects/Code/010_DocTalk/backend/requirements.txt:20)  
  [Dockerfile:13](/Users/mayijie/Projects/Code/010_DocTalk/backend/Dockerfile:13)

- **Spec’s shared-page server-fetch approach can undermine per-IP rate limiting.** Existing proxy injects trusted client IP headers; direct server-component fetch via internal URL won’t preserve end-user IP the same way.  
  [proxy route:66](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/api/proxy/%5B...path%5D/route.ts:66)

---

**IMPORTANT issues (should fix)**

- **Feature 2 retrieval score work is already implemented.** Spec says “add score in `search()`/`search_multi()`”, but both already return `score`.  
  [retrieval_service.py:72](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/retrieval_service.py:72)  
  [retrieval_service.py:129](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/retrieval_service.py:129)

- **Citation payload contract mismatch (camelCase vs existing snake_case SSE contract).** Frontend SSE/parser expects `ref_index`, `text_snippet`, etc.; spec examples show camelCase event fields.  
  [chat_service.py:173](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py:173)  
  [sse.ts:5](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/sse.ts:5)

- **`shared_sessions` naming/uniqueness/“active count” rules are underspecified vs current conventions.** Codebase consistently uses `user_id` naming; spec uses `created_by`. Also “create or return existing share” needs DB-level uniqueness for race safety (e.g., `(session_id, user_id)`), and active-count should filter expired links.  
  [tables.py:333](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/models/tables.py:333)

- **Cross-document plan limits are not represented in config and not enforced today.** Current limits cover docs/files/sessions-per-doc only; collections endpoints have no plan checks.  
  [config.py:119](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/core/config.py:119)  
  [collections.py:104](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/collections.py:104)  
  [collections.py:193](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/collections.py:193)

- **`/d/{documentId}?page=&highlight=` flow is not implemented.** Reader page does not read URL query params; chunk lookup exists but is unused by page init.  
  [DocumentReaderPageClient.tsx:23](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/d/%5BdocumentId%5D/DocumentReaderPageClient.tsx:23)  
  [chunks.py:17](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/chunks.py:17)

- **Collection chat UI assumptions in spec don’t match current component structure.** Mode selector is in header, not ChatPanel; collection page currently passes no `userPlan` into ChatPanel (affects gated controls), and has no session sidebar/new-chat UX as spec describes.  
  [AppHeaderShell.tsx:64](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/AppHeaderShell.tsx:64)  
  [ChatPanel.tsx:30](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/Chat/ChatPanel.tsx:30)  
  [collection page:148](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/collections/%5BcollectionId%5D/page.tsx:148)

- **Domain mode persistence requires extra API surface not in spec details.** If mode is sticky per session, session read/list payloads must expose it so frontend can restore on switch/reload. Current session payloads don’t include it.  
  [chat schemas:47](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/schemas/chat.py:47)  
  [api.ts getMessages mapping:75](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/api.ts:75)  
  [store/index.ts:31](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/store/index.ts:31)

- **Router wiring is missing from spec for new backend modules.** New `export.py`/`sharing.py` routes must be included in app startup.  
  [main.py:143](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/main.py:143)

---

**SUGGESTIONS (nice to have)**

- Add `noindex`/robots handling for `/shared/*` pages to reduce accidental indexing of private shared chats.  
  [robots.ts:3](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/robots.ts:3)

- Add explicit security logging and tests for share create/view/revoke/export limits (none currently for these paths).  
  [backend/tests list](/Users/mayijie/Projects/Code/010_DocTalk/backend/tests)

- In spec, prefer service-layer helpers for session/message loading instead of calling route handlers directly.

---

**VERDICT: NEEDS CHANGES**

- **DB migration compatibility:** proposed migrations are **add-only** (good for current beta rule), but several API/signature/gating/security integration details are currently mismatched and must be corrected before implementation.