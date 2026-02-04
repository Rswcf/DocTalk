# Task Backlog
ISSUED_BY: CC
DATE: 2026-02-04
STATUS: AWAITING_PLAN_APPROVAL

> 以下任务在 Tech Spec v0 审阅通过后开始执行。

---

## Sprint 1 (Week 1): 基础管线打通

### Task 1.1: 项目脚手架搭建
- PRIORITY: P0
- STATUS: TODO
- DESCRIPTION: 搭建 monorepo 项目结构，包含 frontend (Next.js 14) + backend (FastAPI) + Docker Compose 编排 (PostgreSQL, Qdrant, Redis, MinIO)
- ACCEPTANCE:
  - `docker compose up` 一键启动全部服务
  - Next.js dev server 可访问
  - FastAPI /health 端点可访问
  - 所有基础设施服务健康
- FILES: docker-compose.yml, frontend/, backend/, .env.example

### Task 1.2: PDF 上传 + 存储 + 文档状态
- PRIORITY: P0
- STATUS: TODO
- DESCRIPTION: 实现 PDF 上传 API，文件存入 MinIO，创建 documents 表记录，返回 document_id 和状态
- ACCEPTANCE:
  - POST /api/documents/upload 接受 PDF 文件
  - 文件写入 MinIO
  - documents 表有记录，status=parsing
  - GET /api/documents/{id} 返回文档状态
  - DELETE /api/documents/{id} 级联清理
- FILES: backend/app/api/documents.py, backend/app/models/document.py, backend/app/services/doc_service.py

### Task 1.3: PDF 解析 Worker
- PRIORITY: P0
- STATUS: TODO
- DESCRIPTION: Celery worker 异步解析 PDF — PyMuPDF 提取文本+bbox → 结构化切分 → 写入 chunks 表
- ACCEPTANCE:
  - 上传后自动触发解析任务
  - PyMuPDF 提取每页文本块及 bbox 坐标
  - 按策略切分为 300-500 token 的 chunks
  - chunks 表写入成功，包含 text, page_start, page_end, bboxes
  - 解析完成后 document.status 更新为 ready
- FILES: backend/app/workers/parse_worker.py, backend/app/services/parse_service.py

### Task 1.4: Embedding + 向量存储
- PRIORITY: P0
- STATUS: TODO
- DESCRIPTION: 对 chunks 调用 Embedding API 向量化，写入 Qdrant collection
- ACCEPTANCE:
  - 解析完成后自动向量化
  - Qdrant collection 创建成功
  - 每个 chunk 的向量和 payload 写入 Qdrant
  - chunks 表的 vector_id 字段更新
- FILES: backend/app/services/embedding_service.py

### Task 1.5: 语义搜索 API
- PRIORITY: P0
- STATUS: TODO
- DESCRIPTION: 实现基于向量检索的语义搜索 API
- ACCEPTANCE:
  - POST /api/documents/{id}/search 接受 query + top_k
  - 返回 Top-K chunks，包含 text, page, bboxes, score
  - 用真实 PDF 测试，结果语义相关
- FILES: backend/app/api/search.py, backend/app/services/retrieval_service.py

---

## Sprint 2 (Week 2): 对话 + 前端核心

### Task 2.1: Chat API + SSE Streaming
- PRIORITY: P0
- STATUS: TODO
- DESCRIPTION: 实现对话 API，集成 Claude LLM，流式输出+引用解析
- FILES: backend/app/api/chat.py, backend/app/services/chat_service.py

### Task 2.2: 前端 PDF Viewer + 高亮
- PRIORITY: P0
- STATUS: TODO
- DESCRIPTION: react-pdf 渲染 PDF，支持高亮层，支持跳转到指定页面+高亮 bbox
- FILES: frontend/src/components/PdfViewer/

### Task 2.3: 前端 Chat 组件
- PRIORITY: P0
- STATUS: TODO
- DESCRIPTION: Chat UI，SSE 流式渲染，引用卡片可点击
- FILES: frontend/src/components/Chat/

### Task 2.4: Zustand 联动闭环
- PRIORITY: P0
- STATUS: TODO
- DESCRIPTION: 点击引用 → PDF 跳转+高亮，实现核心体验闭环
- FILES: frontend/src/store/

### Task 2.5: 文档管理页面
- PRIORITY: P1
- STATUS: TODO
- DESCRIPTION: 上传入口、文档列表、解析状态展示
- FILES: frontend/src/app/

---

## Sprint 3 (Week 3): 打磨 + 部署

### Task 3.1: Reranker 集成
- PRIORITY: P1
- STATUS: TODO

### Task 3.2: 多轮对话上下文
- PRIORITY: P1
- STATUS: TODO

### Task 3.3: 错误处理 + 边界状态
- PRIORITY: P1
- STATUS: TODO

### Task 3.4: 部署
- PRIORITY: P0
- STATUS: TODO

### Task 3.5: 端到端验证
- PRIORITY: P0
- STATUS: TODO

---END---
