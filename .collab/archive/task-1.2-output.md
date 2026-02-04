已完成 Task 1.2：建立 SQLAlchemy 异步基础设施、严格按 Tech Spec v1 第八节建表，并配置 Alembic 初始迁移。

**改动摘要**
- SQLAlchemy 基础设施
  - 新增 `backend/app/models/base.py:1` DeclarativeBase。
  - 新增 `backend/app/models/database.py:1` `create_async_engine` + `async_sessionmaker`，从 `DATABASE_URL` 读取。
  - 更新 `backend/app/core/deps.py:1` 实现 `get_db_session`，按 FastAPI 依赖提供 `AsyncSession`。
- ORM 模型（严格按 Tech Spec v1 第八节）
  - 新增 `backend/app/models/tables.py:1` 定义 `Document`, `Page`, `Chunk`, `ChatSession`(表名 sessions), `Message`，含全部字段、FK、UNIQUE 与索引。
  - 更新 `backend/app/models/__init__.py:1` 导出 `Base, Document, Page, Chunk, ChatSession, Message`。
- Alembic 配置与初始迁移
  - 新增 `backend/alembic.ini:1` 基本配置（URL 由 env.py 动态注入）。
  - 新增 `backend/alembic/env.py:1` 使用 async engine，读取 `settings.DATABASE_URL`/`$DATABASE_URL`，导入全部 models，支持 offline/online 迁移。
  - 新增 `backend/alembic/script.py.mako:1`（后续如需 `revision` 可直接使用）。
  - 新增 `backend/alembic/versions/20260204_0001_initial_tables.py:1` 初始迁移：
    - 建表 documents/pages/chunks/sessions/messages
    - UNIQUE(document_id, page_number), UNIQUE(document_id, chunk_index)
    - 索引：`idx_pages_document`, `idx_chunks_document`, `idx_messages_session(session_id, created_at)`
    - 迁移前置：`CREATE EXTENSION IF NOT EXISTS pgcrypto` 确保 `gen_random_uuid()` 可用

**主要文件**
- `backend/app/models/base.py:1`
- `backend/app/models/database.py:1`
- `backend/app/core/deps.py:1`
- `backend/app/models/tables.py:1`
- `backend/app/models/__init__.py:1`
- `backend/alembic.ini:1`
- `backend/alembic/env.py:1`
- `backend/alembic/script.py.mako:1`
- `backend/alembic/versions/20260204_0001_initial_tables.py:1`

**使用方法**
- 初始化/迁移
  - `cd backend`
  - `alembic upgrade head` 建表
  - `alembic downgrade -1` 回滚一步
- 环境变量
  - 读取顺序：`app.core.config.settings.DATABASE_URL` → `$DATABASE_URL` → alembic.ini（env.py 会覆盖注入）
  - 示例 `.env` 已包含：`DATABASE_URL=postgresql+asyncpg://doctalk:doctalk@localhost:5432/doctalk`

**实现说明**
- 表结构完全遵循 Tech Spec v1 第八节（字段、约束、索引、JSONB），时间戳列使用 `TIMESTAMPTZ` 默认 `now()`。
- UUID 主键采用 `gen_random_uuid()`，为可靠性在迁移中自动启用 `pgcrypto` 扩展。
- 为避免与 SQLAlchemy `Session` 命名冲突，ORM 类名使用 `ChatSession`，`__tablename__='sessions'`。
- Alembic env 采用异步 engine 并加载全部模型元数据，后续可直接使用 `alembic revision --autogenerate`。
- FastAPI 依赖 `get_db_session` 返回 `AsyncSession`，`expire_on_commit=False` 便于响应流程中使用。

已将 .collab 中任务状态更新：
- `.collab/tasks/current.md: Task 1.2` 标记为 DONE，并在 CX_NOTES 记录关键决策。

需要我现在在本地尝试运行 `alembic upgrade head` 验证一下吗？