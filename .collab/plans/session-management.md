# Session Management & Conversation Controls (v3 — Final)

## 背景

用户可能上传多个 PDF 并对同一文档进行多次对话。当前实现每次访问文档都新建 session，无法恢复历史对话、无法切换或管理会话。

## 竞品调研总结

| 产品 | 对话管理模式 | 核心控件 |
|------|-------------|---------|
| ChatPDF | 一个 PDF 一个对话，侧边栏切换文档 | Rename, Share, Export, Reset, Delete |
| NotebookLM | 每个 Notebook 一个累积对话 | 三列布局，源选择 |
| Adobe Acrobat AI | 右侧边栏，重开自动恢复 | Clear History, Resume |
| Humata | 仪表板+文件夹+项目 | 多文档对比 |
| AskYourPDF | Knowledge Base 概念 | 下载对话 |

**关键洞察**：多数工具仅支持每文档一个对话。支持每文档多对话是市场空白，可作为差异化优势。

## 设计目标

1. 用户可为同一文档创建多个独立对话
2. 重新打开文档时自动恢复最近活跃的对话（而非新建）
3. 通过 Header 下拉菜单管理对话（新建、切换、删除、回首页）
4. 首页增加文档删除功能

---

## UI 设计

### Header 下拉菜单

当前 Header: `DocTalk / filename ... [ModelSelector] [Theme] [Language]`

新 Header: `DocTalk / [filename ▼] ... [ModelSelector] [Theme] [Language]`

点击文档名下拉：

```
┌──────────────────────────────┐
│  ✚  New Chat                 │
│ ──────────────────────────── │
│  Recent Chats                │
│   ● "What is the reve..."    │  ← 当前 session（高亮）
│     "Explain the marke..."   │
│     "Summarize chapter..."   │
│ ──────────────────────────── │
│  🗑  Delete Current Chat     │  ← 红色文字
│  🏠  Back to Home            │
└──────────────────────────────┘
```

**交互细节**：
- 文档名 + ChevronDown icon，点击打开 Popover
- session 列表按 last_activity_at DESC 排序，最多显示 **10** 条
- 当前 session 左侧有 dot 指示器
- session 标题 = 第一条用户消息的前 50 个字符（已清洗：换行→空格，trim）；若无消息则显示 "New Chat"
- 点击其他 session → 切换（用 `setMessages()` 替换消息）
- Delete Current Chat → `window.confirm()` 确认 → 删除 → 切换到下一个或创建新的
- New Chat → 创建新 session，`setMessages([])` 清空消息
- Back to Home → navigate to `/`，reset store
- 点击外部自动关闭
- **流式对话进行中时**：New Chat / Switch Session / Delete Chat 全部 disabled（灰色+tooltip），防止竞态

### 首页文档列表增强

每个文档卡片增加：
- 右侧删除按钮 (Trash2 icon)
- 删除前 `window.confirm()` 确认
- 删除调用 `DELETE /api/documents/{id}`（已有 API）
- 删除后从 localStorage 移除并刷新列表

---

## 技术方案

### Phase 1: 后端

#### 1.1 数据库迁移：给 sessions 表加 title 字段

文件：`backend/alembic/versions/20260205_0002_add_session_title.py`

```python
"""add session title

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-02-05 00:00:00

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "b2c3d4e5f6a7"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("sessions", sa.Column("title", sa.String(200), nullable=True))


def downgrade() -> None:
    op.drop_column("sessions", "title")
```

#### 1.2 ORM 更新

文件：`backend/app/models/tables.py`

ChatSession 模型增加（在 `document_id` 之后）：
```python
title: Mapped[Optional[str]] = mapped_column(sa.String(200), nullable=True)
```

#### 1.3 新增 API：列出文档的所有 sessions（GET）

**重要**：当前 `GET /api/documents/{document_id}/sessions` 路径不存在。注意现有 `POST /api/documents/{document_id}/sessions` 是创建 session，两者路径相同但 method 不同，FastAPI 可以正确区分。

文件：`backend/app/api/chat.py`

```
GET /api/documents/{document_id}/sessions
```

Response:
```json
{
  "sessions": [
    {
      "session_id": "uuid",
      "title": "What is the revenue...",
      "message_count": 6,
      "created_at": "2026-02-05T...",
      "last_activity_at": "2026-02-05T..."
    }
  ]
}
```

**实现**（修复 v2 中 GROUP BY 不完整和 order_by 字符串问题）：

```python
from sqlalchemy import func, desc

@chat_router.get("/documents/{document_id}/sessions", response_model=SessionListResponse)
async def list_sessions(document_id: uuid.UUID, db: AsyncSession = Depends(get_db_session)):
    last_activity = func.coalesce(
        func.max(Message.created_at), ChatSession.created_at
    ).label("last_activity_at")

    stmt = (
        select(
            ChatSession.id,
            ChatSession.title,
            ChatSession.created_at,
            func.count(Message.id).label("message_count"),
            last_activity,
        )
        .outerjoin(Message, Message.session_id == ChatSession.id)
        .where(ChatSession.document_id == document_id)
        .group_by(ChatSession.id, ChatSession.title, ChatSession.created_at)
        .order_by(desc(last_activity))
        .limit(10)
    )
    result = await db.execute(stmt)
    rows = result.all()
    sessions = [
        SessionListItem(
            session_id=row.id,
            title=row.title,
            message_count=row.message_count,
            created_at=row.created_at,
            last_activity_at=row.last_activity_at,
        )
        for row in rows
    ]
    return SessionListResponse(sessions=sessions)
```

关键修复点：
- `group_by(ChatSession.id, ChatSession.title, ChatSession.created_at)` — 包含所有非聚合列
- `order_by(desc(last_activity))` — 使用 labeled column object 而非字符串
- `.limit(10)` — 与 UI 规格一致（最多 10 条）

#### 1.4 新增 API：删除 session

```
DELETE /api/sessions/{session_id}
```

Response: `204 No Content`

```python
@chat_router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(session_id: uuid.UUID, db: AsyncSession = Depends(get_db_session)):
    sess = await db.get(ChatSession, session_id)
    if not sess:
        return JSONResponse(status_code=404, content={"detail": "Session not found"})
    await db.delete(sess)
    await db.commit()
    return None  # 204
```

Cascade 会自动删除关联的 messages。

#### 1.5 修改 chat_service：自动设置 session title + 安全保存

文件：`backend/app/services/chat_service.py`

**变更 A**：在保存用户消息后，自动设置 title：

```python
# Auto-set session title from first user message
session = await db.get(ChatSession, session_id)
if session and not session.title:
    clean = message.replace("\n", " ").replace("\r", "").strip()
    session.title = clean[:50]
    await db.commit()
```

注意：`message` 是 `chat_stream` 的参数名（当前代码中已有）。

**变更 B**：在保存 assistant 消息的代码块外包裹 try/except，防止 session 被删除后 FK violation：

```python
from sqlalchemy.exc import IntegrityError

try:
    assistant_msg = Message(
        session_id=session_id,
        role="assistant",
        content=full_text,
        citations=citations_json,
        prompt_tokens=prompt_tokens,
        output_tokens=output_tokens,
    )
    db.add(assistant_msg)
    await db.commit()
except IntegrityError:
    await db.rollback()
    yield sse("error", {"code": "PERSIST_FAILED", "message": "Failed to save response"})
```

使用项目中已有的 `sse()` helper（`chat_service.py:22`），catch 仅限 `IntegrityError`（FK violation）。

#### 1.6 新增/更新 Pydantic schemas

文件：`backend/app/schemas/chat.py`

```python
class SessionListItem(BaseModel):
    session_id: uuid.UUID
    title: Optional[str] = None
    message_count: int
    created_at: datetime
    last_activity_at: datetime

class SessionListResponse(BaseModel):
    sessions: List[SessionListItem]
```

注意：`SessionListItem` 不需要 `Config: from_attributes = True`（手动构造，非 ORM 直接映射）。

更新 `SessionResponse`（创建 session 的返回值也包含 title + created_at）：
```python
class SessionResponse(BaseModel):
    session_id: uuid.UUID
    document_id: uuid.UUID
    title: Optional[str] = None
    created_at: datetime
```

更新 `create_session` endpoint 返回完整信息：
```python
@chat_router.post("/documents/{document_id}/sessions", status_code=status.HTTP_201_CREATED)
async def create_session(document_id: uuid.UUID, db: AsyncSession = Depends(get_db_session)):
    sess = ChatSession(document_id=document_id)
    db.add(sess)
    await db.commit()
    await db.refresh(sess)  # 获取 server_default 的 created_at
    return SessionResponse(
        session_id=sess.id,
        document_id=sess.document_id,
        title=sess.title,
        created_at=sess.created_at,
    )
```

### Phase 2: 前端

#### 2.1 TypeScript 类型

文件：`frontend/src/types/index.ts`

新增（**必须 export**）：
```typescript
export interface SessionItem {
  session_id: string;
  title: string | null;
  message_count: number;
  created_at: string;
  last_activity_at: string;
}

export interface SessionListResponse {
  sessions: SessionItem[];
}
```

#### 2.2 API 客户端更新

文件：`frontend/src/lib/api.ts`

新增：
```typescript
import type { SessionListResponse } from '../types';

export async function listSessions(docId: string): Promise<SessionListResponse> {
  const res = await fetch(`${API_BASE}/api/documents/${docId}/sessions`);
  return handle(res);
}

export async function deleteSession(sessionId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}`, { method: 'DELETE' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
}

export async function deleteDocument(docId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/documents/${docId}`, { method: 'DELETE' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
}
```

#### 2.3 Zustand Store 更新

文件：`frontend/src/store/index.ts`

新增字段和 actions：

```typescript
// 新增到 DocTalkStore interface
sessions: SessionItem[];
setMessages: (msgs: Message[]) => void;
setSessions: (sessions: SessionItem[]) => void;
addSession: (session: SessionItem) => void;
removeSession: (sessionId: string) => void;
updateSessionActivity: (sessionId: string) => void;  // 更新当前 session 的 last_activity_at 并重排
```

实现：
```typescript
// initialState 新增
sessions: [] as SessionItem[],

// 新增 actions
setMessages: (msgs: Message[]) => set({ messages: msgs }),
setSessions: (sessions: SessionItem[]) => set({ sessions }),
addSession: (session: SessionItem) => set((state) => ({
  sessions: [session, ...state.sessions],
})),
removeSession: (sessionId: string) => set((state) => ({
  sessions: state.sessions.filter((s) => s.session_id !== sessionId),
})),
updateSessionActivity: (sessionId: string) => set((state) => {
  const now = new Date().toISOString();
  const updated = state.sessions.map((s) =>
    s.session_id === sessionId
      ? { ...s, last_activity_at: now, message_count: s.message_count + 1 }
      : s
  );
  // 重排：将活跃 session 移到顶部
  updated.sort((a, b) => new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime());
  return { sessions: updated };
}),
```

`reset()` 通过 `...initialState` 自动清空 `sessions: []`。

#### 2.4 新组件：SessionDropdown

文件：`frontend/src/components/SessionDropdown.tsx`

从 store 读取：`documentName`, `documentId`, `sessionId`, `sessions`, `isStreaming`

行为概要：
- `onNewChat`：
  1. `const s = await createSession(documentId)`
  2. `addSession({ session_id: s.session_id, title: null, message_count: 0, created_at: s.created_at, last_activity_at: s.created_at })`
  3. `setSessionId(s.session_id)`
  4. `setMessages([])`
  5. `setOpen(false)`

- `onSwitchSession(id)`：
  1. `setMessages([])` — 先清空，避免闪烁旧消息
  2. `setSessionId(id)`
  3. `const msgs = await getMessages(id)`
  4. `setMessages(msgs.messages)`
  5. `setOpen(false)`

- `onDeleteSession`：
  1. `if (!window.confirm(t('session.deleteChatConfirm'))) return`
  2. `await deleteSession(sessionId)`
  3. `removeSession(sessionId)`
  4. **从最新 store 状态读取**：`const remaining = useDocTalkStore.getState().sessions`
  5. 如果 `remaining.length > 0` → `onSwitchSession(remaining[0].session_id)`
  6. 否则 → 创建新 session（同 onNewChat 逻辑）
  7. `setOpen(false)`

- `onBackHome`：
  1. `router.push('/')`
  2. `store.reset()`

**所有修改 session 的操作（New Chat, Switch, Delete）在 `isStreaming === true` 时 disabled**。

UI 实现模式：与 `ModelSelector.tsx` / `LanguageSelector.tsx` 一致：
- `useState(open)` + `useRef<HTMLDivElement>` + `useEffect` click-outside listener
- 不引入新的 UI 依赖

#### 2.5 修改 Header.tsx

在 `documentName` 存在时，替换静态文本为 `<SessionDropdown />`。

```tsx
{documentName && (
  <>
    <span className="mx-3 text-gray-300 dark:text-gray-600">/</span>
    <SessionDropdown />
  </>
)}
```

#### 2.6 修改文档页面逻辑（核心变更）

文件：`frontend/src/app/d/[documentId]/page.tsx`

**消息加载统一在 page.tsx**。ChatPanel 不再独立加载消息。

新逻辑（替换原 line 56-61 的 session 创建代码）：

```typescript
import { listSessions, createSession, getMessages, getDocument, getDocumentFileUrl } from '../../../lib/api';

// 在 useEffect 中：
// 1. 获取已有 sessions
const sessionsData = await listSessions(documentId);
setSessions(sessionsData.sessions);

// 2. 恢复最近 session 或创建新的
if (sessionsData.sessions.length > 0) {
  const latest = sessionsData.sessions[0]; // 已按 last_activity_at DESC 排序
  setSessionId(latest.session_id);
  const msgsData = await getMessages(latest.session_id);
  setMessages(msgsData.messages);
} else {
  const s = await createSession(documentId);
  setSessionId(s.session_id);
  addSession({
    session_id: s.session_id,
    title: null,
    message_count: 0,
    created_at: s.created_at,
    last_activity_at: s.created_at,
  });
  setMessages([]);
}
```

需要从 store 额外解构 `setSessions`, `addSession`, `setMessages`。

#### 2.7 修改 ChatPanel：移除独立消息加载 + 更新 session 活跃度

文件：`frontend/src/components/Chat/ChatPanel.tsx`

**删除**原 lines 47-59 的 `useEffect`（加载历史消息的 effect）：

```typescript
// 删除这段代码：
useEffect(() => {
  (async () => {
    try {
      const data = await getMessages(sessionId);
      for (const m of data.messages) {
        addMessage(m);
      }
    } catch {
      // ignore if history not available
    }
  })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [sessionId]);
```

消息加载现在完全由 page.tsx 负责。同时移除不再使用的 `getMessages` import。

**新增**：在 `sendMessage` 的 `onDone` 回调中调用 `updateSessionActivity(sessionId)`，确保当前 session 在下拉列表中排到最前面：

```typescript
// 在 chatStream 的 onDone 回调中：
() => {
  setStreaming(false);
  updateSessionActivity(sessionId);  // 新增
}
```

需要从 store 解构 `updateSessionActivity`。

#### 2.8 首页文档删除

文件：`frontend/src/app/page.tsx`

每个文档 `<li>` 的右侧增加删除按钮：

```tsx
<div className="flex items-center gap-2">
  <button
    className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded dark:bg-gray-100 dark:text-gray-900"
    onClick={() => router.push(`/d/${d.document_id}`)}
  >
    {t('doc.open')}
  </button>
  <button
    className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
    title={t('doc.deleteDoc')}
    onClick={async () => {
      if (!window.confirm(t('doc.deleteDocConfirm'))) return;
      try {
        await deleteDocument(d.document_id);
      } catch { /* backend may 404 if already deleted */ }
      const docs = JSON.parse(localStorage.getItem('doctalk_docs') || '[]') as StoredDoc[];
      const filtered = docs.filter((x) => x.document_id !== d.document_id);
      localStorage.setItem('doctalk_docs', JSON.stringify(filtered));
      setMyDocs(filtered.sort((a, b) => b.createdAt - a.createdAt));
    }}
  >
    <Trash2 size={16} />
  </button>
</div>
```

需要 `import { Trash2 } from 'lucide-react'` 和 `import { deleteDocument } from '../lib/api'`。

#### 2.9 i18n 更新

所有 8 个语言文件新增键：

**en.json:**
```json
{
  "session.newChat": "New Chat",
  "session.recentChats": "Recent Chats",
  "session.deleteChat": "Delete Chat",
  "session.deleteChatConfirm": "Are you sure you want to delete this chat? This cannot be undone.",
  "session.backHome": "Back to Home",
  "session.noTitle": "New Chat",
  "session.messageCount": "{count} messages",
  "doc.deleteDoc": "Delete",
  "doc.deleteDocConfirm": "Are you sure you want to delete this document and all its chats?"
}
```

其余 7 个语言文件（zh, hi, es, ar, fr, bn, pt）添加对应翻译。

#### 2.10 更新 CLAUDE.md

在 API 路由表中新增：
```
GET    /api/documents/{document_id}/sessions  # 列出文档的聊天会话
DELETE /api/sessions/{session_id}              # 删除聊天会话
```

在核心架构决策中新增：
- **会话管理**: 每文档支持多个独立对话会话，重新打开文档自动恢复最近活跃会话

---

## 文件改动清单

### 后端（4 个文件 + 1 个迁移）

| 文件 | 改动 |
|------|------|
| `backend/alembic/versions/20260205_0002_add_session_title.py` | **新增** — 迁移：sessions 表加 title 列 |
| `backend/app/models/tables.py` | 修改 — ChatSession 加 `title` 字段 |
| `backend/app/schemas/chat.py` | 修改 — 新增 SessionListItem, SessionListResponse；更新 SessionResponse 增加 title + created_at |
| `backend/app/api/chat.py` | 修改 — 新增 list_sessions (GET), delete_session (DELETE) 端点；更新 create_session 返回 |
| `backend/app/services/chat_service.py` | 修改 — 自动设置 session title；assistant 消息保存 try/except IntegrityError |

### 前端（12+ 个文件）

| 文件 | 改动 |
|------|------|
| `frontend/src/types/index.ts` | 修改 — 新增 `export interface SessionItem` + `SessionListResponse` |
| `frontend/src/lib/api.ts` | 修改 — 新增 listSessions, deleteSession, deleteDocument |
| `frontend/src/store/index.ts` | 修改 — 新增 sessions, setMessages, setSessions, addSession, removeSession, updateSessionActivity |
| `frontend/src/components/SessionDropdown.tsx` | **新增** — 会话管理下拉菜单 |
| `frontend/src/components/Header.tsx` | 修改 — 集成 SessionDropdown |
| `frontend/src/app/d/[documentId]/page.tsx` | 修改 — 恢复最近 session + 统一消息加载 |
| `frontend/src/components/Chat/ChatPanel.tsx` | 修改 — 移除消息加载 useEffect + 新增 updateSessionActivity 调用 |
| `frontend/src/app/page.tsx` | 修改 — 文档删除功能 |
| `frontend/src/i18n/locales/*.json` (×8) | 修改 — 新增翻译键 |

### 文档

| 文件 | 改动 |
|------|------|
| `CLAUDE.md` | 修改 — 新增 API 路由 + 架构决策说明 |

---

## Codex Review Issues 处理记录

### Round 1 (v1 → v2)

| # | Severity | Issue | Resolution |
|---|----------|-------|-----------|
| 1 | Critical | updated_at 不会随消息更新 | 改用 COALESCE(MAX(messages.created_at), sessions.created_at)，字段改为 last_activity_at |
| 2 | Major | Store 缺少 setMessages | 新增 setMessages action |
| 3 | Major | ChatPanel 和 page.tsx 双重加载 | 删除 ChatPanel 的消息加载 useEffect |
| 4 | Major | 流式对话中切换/删除竞态 | 前端 isStreaming 时 disable；后端 try/except |
| 5 | Major | Session list API 排序不一致 | GROUP BY + MAX + COALESCE + last_activity_at |
| 6 | Major | SessionResponse 不对齐 | 增加 title + created_at；create_session 返回完整信息 |
| 7 | Minor | SessionItem 未 export | 明确 export |
| 8 | Minor | reset() 应清空 sessions | sessions 在 initialState 中 |
| 9 | Minor | 迁移缺 boilerplate | 补全 |
| 10 | Minor | deleteDocument 返回处理 | manual check |
| 11 | Nit | Title 清洗 | 换行→空格，trim，50 字符 |
| 12 | Nit | i18n 覆盖 | 全部使用 t()，8 文件更新 |

### Round 2 (v2 → v3)

| # | Severity | Issue | Resolution |
|---|----------|-------|-----------|
| 1 | Critical | GROUP BY 不完整 + order_by 用字符串 | 加 ChatSession.title, ChatSession.created_at 到 group_by；order_by 使用 labeled column object |
| 2 | Major | _sse_error 不存在 + except 太宽 | 使用已有 sse() helper；catch 限 IntegrityError + rollback |
| 3 | Major | 删除后 sessions[0] 是旧值 | 改用 useDocTalkStore.getState().sessions 获取最新值 |
| 4 | Major | Limit 不一致（UI 10 vs 后端 20） | 统一为 10 |
| 5 | Major | 聊天后 session 列表不更新 | 新增 updateSessionActivity action，在 onDone 时调用 |
| 6 | Minor | deleteDocument 在 api.ts 中遗漏 | 确认已包含（v2 已有但标注不清晰） |
| 7 | Minor | CLAUDE.md 未更新 | 新增 section 2.10 |
| 8 | Nit | SessionListItem 不需要 Config | 移除 |

---

## 验证清单

1. `cd backend && python3 -m alembic upgrade head` — 迁移成功
2. `cd frontend && npm run build` — 编译无错误
3. `cd frontend && npx next lint` — 无新 lint 错误
4. 上传新文档 → 自动创建 session → 发送消息 → session title 自动生成
5. 刷新页面 → 自动恢复最近活跃 session + 历史消息（不是创建新 session）
6. 下拉菜单 → New Chat → 新建空 session → 消息列表清空
7. 下拉菜单 → 切换到其他 session → 加载该 session 的历史消息（旧消息完全替换）
8. 下拉菜单 → Delete Current Chat → 确认 → 删除 → 切换到下一个
9. 下拉菜单 → Back to Home → 回到首页
10. 流式对话进行中 → 下拉菜单所有修改操作 disabled
11. 发送消息后 → 当前 session 在下拉列表中排到最前
12. 首页 → 删除文档 → 确认 → 从列表消失
13. 引用点击跳转仍然正常
14. 流式对话仍然正常
15. 模型切换仍然正常
