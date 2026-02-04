# Current Tasks — Sprint 3 Week 3: 对齐修复 + 打磨 + 验证
ISSUED_BY: CC
DATE: 2026-02-04
PLAN: 002-tech-spec-v1.md (APPROVED)

---

## Task 3.0: Frontend-Backend API + Type 对齐 (Critical Bug Fix)
- PRIORITY: P0
- STATUS: DONE
- DESCRIPTION:
  修复前端 api.ts 中所有与后端路由不匹配的 URL，以及前后端数据类型不一致的问题。

  **URL 修复 (frontend/src/lib/api.ts):**
  1. uploadDocument: `POST /api/documents` → `POST /api/documents/upload`
  2. getDocumentFileUrl: `GET /api/documents/${docId}/file` → `GET /api/documents/${docId}/file-url`
  3. searchDocument: 当前用 GET + query params → 改为 `POST /api/documents/${docId}/search` + JSON body `{query, top_k}`

  **类型对齐 (frontend/src/types/index.ts + frontend/src/lib/api.ts):**
  4. DocumentResponse: 后端返回 `id` (UUID)，前端期望 `document_id`。
     后端返回扁平字段 `pages_parsed`, `chunks_total`, `chunks_indexed`，
     前端期望嵌套 `parse_progress: { pagesParsed, chunksIndexed }`。
     方案: 修改前端 DocumentResponse 类型匹配后端 schema，同时更新 page.tsx 中使用它的代码。
  5. Message 历史: 后端 ChatMessageResponse 返回 `{role, content, citations, created_at}` 无 id 字段。
     前端 Message 类型期望 `{id, role, text, citations?, createdAt?}`。
     方案: 在 getMessages 的返回值处做映射转换 (content→text, 生成临时 id, created_at→createdAt)。

- ACCEPTANCE:
  - 所有 API URL 与后端路由完全匹配
  - TypeScript 类型编译无 error
  - 上传 → 状态轮询 → 阅读页 → 聊天 → 历史加载，全流程数据流通畅
- FILES: frontend/src/lib/api.ts, frontend/src/types/index.ts, frontend/src/app/page.tsx, frontend/src/app/d/[documentId]/page.tsx, frontend/src/components/Chat/ChatPanel.tsx

## Task 3.1: Error Handling + Loading / Empty 状态
- PRIORITY: P1
- STATUS: DONE
- DESCRIPTION:
  为关键用户流程添加错误处理和状态反馈:
  1. 上传页: 文件类型校验提示 (仅 PDF), 文件过大提示, 上传失败友好提示
  2. 阅读页: PDF 加载失败 fallback, 文档不存在 (404) 提示并引导回首页
  3. Chat: 聊天流式出错时显示错误消息气泡, 网络断开提示
  4. 全局: 添加 React Error Boundary (app/layout.tsx 级别)
  5. Loading 状态: 上传页 skeleton, PDF 加载 spinner, Chat 初始化 loading
- ACCEPTANCE:
  - 上传非 PDF 文件有友好提示
  - 打开不存在的文档 ID 不白屏
  - Chat 出错时用户能看到错误并可重试
- FILES: frontend/src/app/page.tsx, frontend/src/app/d/[documentId]/page.tsx, frontend/src/app/layout.tsx, frontend/src/components/Chat/ChatPanel.tsx

## Task 3.2: Git Init + .gitignore + 依赖安装验证
- PRIORITY: P0
- STATUS: DONE
- DESCRIPTION:
  1. 在项目根目录 `git init`
  2. 创建 .gitignore: node_modules, __pycache__, .env, .next, *.pyc, dist/, build/, .venv/,
     backend/*.egg-info, .DS_Store, *.db
  3. `cd frontend && npm install` — 验证前端依赖可正常安装
  4. `cd backend && pip install -r requirements.txt` — 验证后端依赖可正常安装 (如果有 venv 则用 venv)
  5. 创建初始 commit
- ACCEPTANCE:
  - `git log` 可看到初始 commit
  - `npm install` 无 error
  - `pip install` 无 error
- FILES: .gitignore

## Task 3.3: 端到端 Smoke Test 脚本
- PRIORITY: P0
- STATUS: DONE
- DESCRIPTION:
  编写一个 backend/tests/test_smoke.py (pytest) 脚本，验证核心 API 端到端可用：
  1. POST /api/documents/upload — 上传一个小 PDF (可内联创建一个 1 页 test PDF)
  2. GET /api/documents/{id} — 轮询直到 status=ready
  3. POST /api/documents/{id}/search — 搜索返回结果
  4. POST /api/documents/{id}/sessions — 创建会话
  5. POST /api/sessions/{id}/chat — 发送消息，验证 SSE 返回 token 和 done 事件
  6. GET /api/sessions/{id}/messages — 获取历史消息
  7. DELETE /api/documents/{id} — 删除文档

  注意: 这是集成测试，需要 docker compose 基础设施运行。
  可以用 `@pytest.mark.integration` 标记，默认跳过。
  使用 httpx 的 AsyncClient 直连 FastAPI app (TestClient 模式)。
- ACCEPTANCE:
  - pytest 脚本可执行 (即使部分跳过因为缺少外部服务)
  - API 调用链路逻辑正确
- FILES: backend/tests/test_smoke.py, backend/tests/conftest.py

---END---
