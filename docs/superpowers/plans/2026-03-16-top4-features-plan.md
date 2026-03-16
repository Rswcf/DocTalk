# Top 4 Features Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement PDF/DOCX export, shareable links, citation confidence indicators, cross-document Q&A UI, and legal/academic mode — delivered serially.

**Architecture:** Each feature builds on the previous. Feature 1 adds export + sharing infrastructure. Feature 2 enriches the citation pipeline with confidence data. Feature 3 builds the collection chat UI using Features 1+2. Feature 4 adds prompt-layer domain modes that apply across all views.

**Tech Stack:** FastAPI, SQLAlchemy async, PostgreSQL, Qdrant, weasyprint, python-docx, Next.js 14, Zustand, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-16-top4-features-design.md`

---

## Chunk 1: Feature 1 — PDF/DOCX Export + Shareable Links

### Task 1: Add weasyprint dependency + Dockerfile update

**Files:**
- Modify: `backend/requirements.txt:24` (append)
- Modify: `backend/Dockerfile:13-24` (add weasyprint system libs)

- [ ] **Step 1: Add weasyprint + markupsafe to requirements.txt**

Append after line 24 (`beautifulsoup4==4.13.4`):
```
weasyprint>=62.0
markupsafe>=2.1.0
```

- [ ] **Step 2: Add weasyprint system libraries to Dockerfile**

In `backend/Dockerfile`, after the existing `apt-get install` block (line 14-24), add `libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf2.0-0` to the install list. Replace lines 13-24:

```dockerfile
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       build-essential \
       tesseract-ocr \
       tesseract-ocr-eng \
       tesseract-ocr-chi-sim \
       libreoffice-core \
       libreoffice-impress \
       libreoffice-writer \
       fonts-liberation \
       fonts-noto-cjk \
       libpango-1.0-0 \
       libpangocairo-1.0-0 \
       libgdk-pixbuf2.0-0 \
    && rm -rf /var/lib/apt/lists/*
```

- [ ] **Step 3: Verify dependencies install locally**

Run: `cd backend && pip install weasyprint markupsafe`
Expected: installs without error

- [ ] **Step 4: Commit**

```bash
git add backend/requirements.txt backend/Dockerfile
git commit -m "deps: add weasyprint + system libs for PDF export"
```

---

### Task 2: Backend export service (render_markdown, render_docx, render_pdf)

**Files:**
- Create: `backend/app/services/export_service.py`
- Test: `backend/tests/test_export_service.py`

- [ ] **Step 1: Write failing tests for export service**

```python
# backend/tests/test_export_service.py
import pytest
from unittest.mock import MagicMock
from app.services.export_service import render_markdown, render_docx, render_pdf


def _make_messages():
    return [
        MagicMock(role="user", content="What is section 3?", citations=None),
        MagicMock(
            role="assistant",
            content="Section 3 states that [1] the parties agree...",
            citations=[{
                "ref_index": 1,
                "page": 3,
                "text_snippet": "The parties agree to...",
                "document_filename": "contract.pdf",
            }],
        ),
    ]


def test_render_markdown():
    md = render_markdown("Test Session", "contract.pdf", _make_messages())
    assert "# Test Session" in md
    assert "What is section 3?" in md
    assert "[^1]" in md or "[1]" in md
    assert "Page 3" in md


def test_render_docx():
    buf = render_docx("Test Session", "contract.pdf", _make_messages())
    assert buf.getbuffer().nbytes > 0  # non-empty DOCX


def test_render_pdf():
    buf = render_pdf("Test Session", "contract.pdf", _make_messages())
    content = buf.getvalue()
    assert content[:5] == b"%PDF-"  # valid PDF header


def test_render_markdown_empty_messages():
    md = render_markdown("Empty", "doc.pdf", [])
    assert "Empty" in md


def test_message_limit():
    msgs = [MagicMock(role="user", content=f"Q{i}", citations=None) for i in range(600)]
    with pytest.raises(ValueError, match="500"):
        render_markdown("Too Long", "doc.pdf", msgs)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python3 -m pytest tests/test_export_service.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.export_service'`

- [ ] **Step 3: Implement export_service.py**

```python
# backend/app/services/export_service.py
"""Render chat sessions as Markdown, DOCX, or PDF."""
from __future__ import annotations

import io
import re
from datetime import datetime, timezone
from typing import Any, List

from markupsafe import escape as html_escape


_MAX_MESSAGES = 500


def _extract_citations(messages: List[Any]) -> list[dict]:
    """Collect unique citations across all messages."""
    seen: set[int] = set()
    citations: list[dict] = []
    for msg in messages:
        if msg.citations:
            for c in msg.citations:
                idx = c.get("ref_index", 0)
                if idx not in seen:
                    seen.add(idx)
                    citations.append(c)
    return sorted(citations, key=lambda c: c.get("ref_index", 0))


def _format_footnote(c: dict) -> str:
    page = c.get("page", "?")
    doc = c.get("document_filename", "")
    snippet = c.get("text_snippet", "")[:80]
    source = f"{doc}, " if doc else ""
    return f"Page {page}, {source}\"{snippet}...\""


def render_markdown(title: str, doc_name: str, messages: List[Any]) -> str:
    if len(messages) > _MAX_MESSAGES:
        raise ValueError(f"Export limited to {_MAX_MESSAGES} messages")

    lines = [f"# {title}", f"*Document: {doc_name}*", f"*Exported: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}*", "", "---", ""]

    for msg in messages:
        if msg.role == "user":
            lines.append(f"**Q:** {msg.content}")
        else:
            # Convert [n] to footnote markers [^n]
            text = re.sub(r'\[(\d+)\]', r'[^\1]', msg.content)
            lines.append(f"**A:** {text}")
        lines.append("")

    citations = _extract_citations(messages)
    if citations:
        lines.append("---")
        lines.append("## References")
        lines.append("")
        for c in citations:
            idx = c.get("ref_index", 0)
            lines.append(f"[^{idx}]: {_format_footnote(c)}")

    lines.extend(["", "---", "*Generated by DocTalk — www.doctalk.site*"])
    return "\n".join(lines)


def render_docx(title: str, doc_name: str, messages: List[Any]) -> io.BytesIO:
    if len(messages) > _MAX_MESSAGES:
        raise ValueError(f"Export limited to {_MAX_MESSAGES} messages")

    from docx import Document
    from docx.shared import Pt, RGBColor

    doc = Document()
    doc.add_heading(title, level=1)
    p = doc.add_paragraph()
    run = p.add_run(f"Document: {doc_name} | Exported: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    run.font.size = Pt(9)
    run.font.color.rgb = RGBColor(128, 128, 128)

    for msg in messages:
        if msg.role == "user":
            p = doc.add_paragraph()
            run = p.add_run(f"Q: {msg.content}")
            run.bold = True
        else:
            doc.add_paragraph(msg.content)

    citations = _extract_citations(messages)
    if citations:
        doc.add_heading("References", level=2)
        for c in citations:
            idx = c.get("ref_index", 0)
            doc.add_paragraph(f"[{idx}] {_format_footnote(c)}", style="List Number")

    p = doc.add_paragraph()
    run = p.add_run("Generated by DocTalk — www.doctalk.site")
    run.font.size = Pt(8)
    run.font.color.rgb = RGBColor(160, 160, 160)

    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    return buf


def render_pdf(title: str, doc_name: str, messages: List[Any]) -> io.BytesIO:
    if len(messages) > _MAX_MESSAGES:
        raise ValueError(f"Export limited to {_MAX_MESSAGES} messages")

    from weasyprint import HTML

    # Build HTML with escaped content to prevent SSRF
    safe_title = html_escape(title)
    safe_doc = html_escape(doc_name)
    date_str = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')

    msg_html = []
    for msg in messages:
        safe_content = html_escape(msg.content)
        if msg.role == "user":
            msg_html.append(f'<div class="q"><strong>Q:</strong> {safe_content}</div>')
        else:
            msg_html.append(f'<div class="a">{safe_content}</div>')

    citations = _extract_citations(messages)
    refs_html = ""
    if citations:
        refs_items = []
        for c in citations:
            idx = c.get("ref_index", 0)
            refs_items.append(f"<li>[{idx}] {html_escape(_format_footnote(c))}</li>")
        refs_html = f'<h2>References</h2><ol>{"".join(refs_items)}</ol>'

    html_str = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  body {{ font-family: 'Noto Sans CJK SC', 'Noto Sans', sans-serif; font-size: 11pt; color: #333; margin: 2cm; }}
  h1 {{ font-size: 18pt; margin-bottom: 4pt; }}
  .meta {{ color: #888; font-size: 9pt; margin-bottom: 16pt; }}
  .q {{ background: #f5f5f5; padding: 8pt; margin: 6pt 0; border-radius: 4pt; }}
  .a {{ padding: 8pt; margin: 6pt 0; }}
  h2 {{ font-size: 13pt; margin-top: 20pt; }}
  ol {{ font-size: 9pt; color: #666; }}
  .footer {{ text-align: center; color: #aaa; font-size: 8pt; margin-top: 30pt; }}
</style></head><body>
<h1>{safe_title}</h1>
<div class="meta">Document: {safe_doc} | Exported: {date_str}</div>
{"".join(msg_html)}
{refs_html}
<div class="footer">Generated by DocTalk — www.doctalk.site</div>
</body></html>"""

    buf = io.BytesIO()
    HTML(string=html_str).write_pdf(buf)
    buf.seek(0)
    return buf
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python3 -m pytest tests/test_export_service.py -v`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/export_service.py backend/tests/test_export_service.py
git commit -m "feat: add export service for markdown/docx/pdf rendering"
```

---

### Task 3: Backend export API endpoint

**Files:**
- Create: `backend/app/api/export.py`
- Modify: `backend/app/main.py:152` (register router)
- Test: `backend/tests/test_export_api.py`

- [ ] **Step 1: Write failing test for export endpoint**

```python
# backend/tests/test_export_api.py
import pytest
from unittest.mock import AsyncMock, patch, MagicMock


@pytest.mark.asyncio
async def test_export_md_requires_auth():
    """Export endpoint should reject unauthenticated requests."""
    from httpx import AsyncClient, ASGITransport
    from app.main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/sessions/00000000-0000-0000-0000-000000000001/export?format=md")
    assert resp.status_code in (401, 403)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest tests/test_export_api.py -v`
Expected: FAIL — route not found (404)

- [ ] **Step 3: Implement export API endpoint**

```python
# backend/app/api/export.py
"""Session export API — PDF, DOCX, Markdown."""
from __future__ import annotations

from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db_session
from app.models.tables import ChatSession, Message, User
from app.services.export_service import render_docx, render_markdown, render_pdf

router = APIRouter(tags=["export"])


def _sanitize_filename(name: str) -> str:
    import re
    return re.sub(r'[^\w\s\-.]', '', name)[:100] or "export"


@router.get("/api/sessions/{session_id}/export")
async def export_session(
    session_id: UUID,
    format: Literal["pdf", "docx", "md"] = Query("md"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    # Load session with ownership check
    result = await db.execute(
        select(ChatSession).where(ChatSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session or session.user_id != user.id:
        raise HTTPException(404, "Session not found")

    # Plan gating for PDF/DOCX
    if format in ("pdf", "docx"):
        if user.plan not in ("plus", "pro"):
            raise HTTPException(403, "PDF/DOCX export requires Plus or Pro plan")

    # Load messages
    rows = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at)
    )
    messages = list(rows.scalars())

    title = session.title or "DocTalk Conversation"
    doc_name = "document"
    if session.document:
        doc_name = session.document.filename or doc_name

    safe_title = _sanitize_filename(title)

    if format == "md":
        content = render_markdown(title, doc_name, messages)
        return StreamingResponse(
            iter([content.encode("utf-8")]),
            media_type="text/markdown; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{safe_title}.md"'},
        )
    elif format == "docx":
        buf = render_docx(title, doc_name, messages)
        return StreamingResponse(
            buf,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{safe_title}.docx"'},
        )
    elif format == "pdf":
        buf = render_pdf(title, doc_name, messages)
        return StreamingResponse(
            buf,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{safe_title}.pdf"'},
        )
```

- [ ] **Step 4: Register router in main.py**

Add after line 152 in `backend/app/main.py` (after `app.include_router(admin_router)`):

```python
from app.api.export import router as export_router
app.include_router(export_router)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && python3 -m pytest tests/test_export_api.py -v`
Expected: PASS (401 for unauthenticated)

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/export.py backend/app/main.py backend/tests/test_export_api.py
git commit -m "feat: add export API endpoint for PDF/DOCX/MD"
```

---

### Task 4: Alembic migration for shared_sessions table

**Files:**
- Create: `backend/alembic/versions/xxxx_add_shared_sessions.py` (via alembic revision)

- [ ] **Step 1: Create migration**

Run:
```bash
cd backend && python3 -m alembic revision --autogenerate -m "add_shared_sessions"
```

- [ ] **Step 2: Edit migration to match spec**

The generated migration should create the `shared_sessions` table. Verify/edit to contain:

```python
def upgrade():
    op.create_table(
        "shared_sessions",
        sa.Column("id", sa.dialects.postgresql.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("session_id", sa.dialects.postgresql.UUID(), sa.ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("share_token", sa.dialects.postgresql.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False, unique=True),
        sa.Column("user_id", sa.dialects.postgresql.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("session_id", "user_id", name="uq_shared_sessions_session_user"),
    )
    op.create_index("idx_shared_sessions_token", "shared_sessions", ["share_token"])

def downgrade():
    op.drop_index("idx_shared_sessions_token")
    op.drop_table("shared_sessions")
```

- [ ] **Step 3: Add SharedSession model to tables.py**

Add after the `Collection` class in `backend/app/models/tables.py` (after line ~349):

```python
class SharedSession(Base):
    __tablename__ = "shared_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()"))
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), sa.ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    share_token: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, unique=True, server_default=sa.text("gen_random_uuid()"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    expires_at: Mapped[Optional[sa.DateTime]] = mapped_column(sa.DateTime(timezone=True), nullable=True)
    created_at: Mapped[sa.DateTime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))

    session: Mapped[ChatSession] = relationship("ChatSession")
    user: Mapped["User"] = relationship("User")

    __table_args__ = (
        sa.UniqueConstraint("session_id", "user_id", name="uq_shared_sessions_session_user"),
    )
```

- [ ] **Step 4: Run migration**

Run: `cd backend && python3 -m alembic upgrade head`
Expected: migration applies without error

- [ ] **Step 5: Commit**

```bash
git add backend/alembic/ backend/app/models/tables.py
git commit -m "migration: add shared_sessions table"
```

---

### Task 5: Backend sharing API (create/revoke/view)

**Files:**
- Create: `backend/app/api/sharing.py`
- Modify: `backend/app/main.py` (register router)
- Test: `backend/tests/test_sharing_api.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_sharing_api.py
import pytest


@pytest.mark.asyncio
async def test_shared_view_404_for_invalid_token():
    from httpx import AsyncClient, ASGITransport
    from app.main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/shared/00000000-0000-0000-0000-000000000099")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_share_requires_auth():
    from httpx import AsyncClient, ASGITransport
    from app.main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/sessions/00000000-0000-0000-0000-000000000001/share")
    assert resp.status_code in (401, 403)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python3 -m pytest tests/test_sharing_api.py -v`
Expected: FAIL (404 route not found)

- [ ] **Step 3: Implement sharing API**

```python
# backend/app/api/sharing.py
"""Session sharing API — create, view, revoke shareable links."""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_current_user, get_db_session
from app.models.tables import ChatSession, Message, SharedSession, User

router = APIRouter(tags=["sharing"])


class ShareResponse(BaseModel):
    share_token: str
    url: str
    expires_at: str | None = None


class SharedSessionView(BaseModel):
    session_title: str
    document_name: str
    created_at: str
    messages: list[dict]


@router.post("/api/sessions/{session_id}/share", response_model=ShareResponse)
async def create_share(
    session_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    # Verify session ownership
    result = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session or session.user_id != user.id:
        raise HTTPException(404, "Session not found")

    # Check existing share
    existing = await db.execute(
        select(SharedSession).where(
            SharedSession.session_id == session_id,
            SharedSession.user_id == user.id,
        )
    )
    share = existing.scalar_one_or_none()
    if share:
        return ShareResponse(
            share_token=str(share.share_token),
            url=f"{settings.FRONTEND_URL}/shared/{share.share_token}",
            expires_at=share.expires_at.isoformat() if share.expires_at else None,
        )

    # Free plan limit: 3 active shares
    if user.plan not in ("plus", "pro"):
        count_result = await db.execute(
            select(func.count()).select_from(SharedSession).where(
                SharedSession.user_id == user.id,
                (SharedSession.expires_at.is_(None)) | (SharedSession.expires_at > datetime.now(timezone.utc)),
            )
        )
        active_count = count_result.scalar() or 0
        if active_count >= 3:
            raise HTTPException(403, "Free plan limited to 3 active share links. Upgrade to Plus for unlimited.")

    # Create share
    share = SharedSession(session_id=session_id, user_id=user.id)
    db.add(share)
    await db.commit()
    await db.refresh(share)

    return ShareResponse(
        share_token=str(share.share_token),
        url=f"{settings.FRONTEND_URL}/shared/{share.share_token}",
    )


@router.delete("/api/sessions/{session_id}/share", status_code=204)
async def revoke_share(
    session_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    result = await db.execute(
        select(SharedSession).where(
            SharedSession.session_id == session_id,
            SharedSession.user_id == user.id,
        )
    )
    share = result.scalar_one_or_none()
    if not share:
        raise HTTPException(404, "Share not found")

    await db.delete(share)
    await db.commit()


@router.get("/api/shared/{share_token}", response_model=SharedSessionView)
async def view_shared(
    share_token: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
):
    result = await db.execute(
        select(SharedSession).where(SharedSession.share_token == share_token)
    )
    share = result.scalar_one_or_none()
    if not share:
        raise HTTPException(404, "Shared session not found")

    # Check expiry
    if share.expires_at and share.expires_at < datetime.now(timezone.utc):
        raise HTTPException(410, "Share link has expired")

    # Load session
    session_result = await db.execute(select(ChatSession).where(ChatSession.id == share.session_id))
    session = session_result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session no longer exists")

    # Load messages
    rows = await db.execute(
        select(Message).where(Message.session_id == share.session_id).order_by(Message.created_at)
    )
    messages = list(rows.scalars())

    # Build safe response — exclude bboxes, documentId, chunkId, confidence
    safe_messages = []
    for msg in messages:
        safe_msg: dict = {"role": msg.role, "content": msg.content}
        if msg.citations:
            safe_citations = []
            for c in msg.citations:
                safe_citations.append({
                    "text_snippet": c.get("text_snippet", ""),
                    "page": c.get("page"),
                    "document_filename": c.get("document_filename", ""),
                })
            safe_msg["citations"] = safe_citations
        safe_messages.append(safe_msg)

    doc_name = "document"
    if session.document_id:
        from app.models.tables import Document
        doc_result = await db.execute(select(Document.filename).where(Document.id == session.document_id))
        row = doc_result.first()
        if row:
            doc_name = row[0] or doc_name

    return SharedSessionView(
        session_title=session.title or "Untitled Conversation",
        document_name=doc_name,
        created_at=session.created_at.isoformat(),
        messages=safe_messages,
    )
```

- [ ] **Step 4: Register router in main.py**

Add after the export router registration:
```python
from app.api.sharing import router as sharing_router
app.include_router(sharing_router)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && python3 -m pytest tests/test_sharing_api.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/sharing.py backend/app/main.py backend/tests/test_sharing_api.py
git commit -m "feat: add sharing API (create/view/revoke share links)"
```

---

### Task 6: Frontend — export dropdown (PDF/DOCX)

**Files:**
- Modify: `frontend/src/components/Chat/ChatPanel.tsx:177-185` (export button → dropdown)
- Modify: `frontend/src/lib/api.ts` (add exportSession helper)

- [ ] **Step 1: Add exportSession to api.ts**

Add to `frontend/src/lib/api.ts`:

```typescript
export async function exportSession(sessionId: string, format: 'pdf' | 'docx'): Promise<Blob> {
  const res = await fetch(`${PROXY_BASE}/api/sessions/${sessionId}/export?format=${format}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Export failed: ${text}`);
  }
  return res.blob();
}
```

- [ ] **Step 2: Update ChatPanel export menu**

In `frontend/src/components/Chat/ChatPanel.tsx`, replace the `handleExport` callback (lines 177-180) and the export menu item in PlusMenu. Keep the existing markdown export as client-side, add PDF/DOCX via backend:

```typescript
const handleExportMarkdown = useCallback(() => {
  const docName = useDocTalkStore.getState().documentName || 'document';
  exportConversationAsMarkdown(messages, docName);
}, [messages]);

const handleExportFormat = useCallback(async (format: 'pdf' | 'docx') => {
  try {
    const blob = await exportSession(sessionId, format);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('Export failed:', e);
  }
}, [sessionId]);
```

Update the PlusMenu items to show Markdown (always), PDF and DOCX (Plus+ only with paywall prompt for free users).

- [ ] **Step 3: Test manually**

1. Open a document with chat messages
2. Click export dropdown → Markdown (should download .md)
3. Click PDF (if Plus+ plan → downloads .pdf; if Free → shows paywall)
4. Click DOCX (same gating)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Chat/ChatPanel.tsx frontend/src/lib/api.ts
git commit -m "feat: add PDF/DOCX export dropdown in ChatPanel"
```

---

### Task 7: Frontend — share button + shared page

**Files:**
- Modify: `frontend/src/lib/api.ts` (add share API helpers)
- Modify: `frontend/src/components/Chat/ChatPanel.tsx` (add share button)
- Create: `frontend/src/app/shared/[token]/page.tsx` (shared view page)

- [ ] **Step 1: Add share API helpers to api.ts**

```typescript
export async function createShare(sessionId: string): Promise<{ share_token: string; url: string }> {
  const res = await fetch(`${PROXY_BASE}/api/sessions/${sessionId}/share`, { method: 'POST' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function revokeShare(sessionId: string): Promise<void> {
  const res = await fetch(`${PROXY_BASE}/api/sessions/${sessionId}/share`, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) throw new Error(await res.text());
}

export async function getSharedSession(token: string): Promise<any> {
  const backendUrl = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_BASE || '';
  const res = await fetch(`${backendUrl}/api/shared/${token}`);
  if (!res.ok) return null;
  return res.json();
}
```

- [ ] **Step 2: Add share button to ChatPanel**

In ChatPanel, add a share icon button near the export area. On click, call `createShare()`, copy URL to clipboard, show toast.

- [ ] **Step 3: Create shared page**

```tsx
// frontend/src/app/shared/[token]/page.tsx
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import type { Metadata } from 'next';

async function fetchShared(token: string) {
  const backendUrl = process.env.BACKEND_INTERNAL_URL || '';
  const headersList = await headers();
  const xff = headersList.get('x-forwarded-for') || '';
  const res = await fetch(`${backendUrl}/api/shared/${token}`, {
    headers: { 'X-Forwarded-For': xff },
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const data = await fetchShared(token);
  if (!data) return { title: 'Not Found' };
  const preview = data.messages?.find((m: any) => m.role === 'assistant')?.content?.slice(0, 150) || '';
  return {
    title: data.session_title,
    description: preview,
    robots: { index: false, follow: false },
    openGraph: { title: data.session_title, description: preview },
  };
}

export default async function SharedPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await fetchShared(token);
  if (!data) notFound();

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-1">{data.session_title}</h1>
        <p className="text-sm text-zinc-500 mb-6">Document: {data.document_name}</p>

        <div className="space-y-4">
          {data.messages.map((msg: any, i: number) => (
            <div key={i} className={msg.role === 'user' ? 'flex justify-end' : ''}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
              }`}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                {msg.citations?.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {msg.citations.map((c: any, j: number) => (
                      <div key={j} className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-700 rounded px-2 py-1">
                        p. {c.page}{c.document_filename ? ` — ${c.document_filename}` : ''}: &ldquo;{c.text_snippet}&rdquo;
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center border-t border-zinc-200 dark:border-zinc-800 pt-6">
          <p className="text-sm text-zinc-500 mb-3">Powered by DocTalk</p>
          <a
            href="https://www.doctalk.site"
            className="inline-block px-6 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Try DocTalk Free
          </a>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Test manually**

1. Open a session → click Share → verify URL is copied
2. Open the shared URL in incognito → verify read-only view renders
3. Verify OG tags work (paste URL in Slack/Discord)
4. Test free plan 3-share limit

- [ ] **Step 5: Add i18n strings to all 11 locale files**

Add keys: `chat.share`, `chat.shareCopied`, `chat.shareRevoke`, `chat.exportPdf`, `chat.exportDocx`

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/shared/ frontend/src/lib/api.ts frontend/src/components/Chat/ChatPanel.tsx frontend/src/i18n/
git commit -m "feat: shareable links with read-only shared page + CTA"
```

---

## Chunk 2: Feature 2 — Citation Confidence Indicators

### Task 8: Backend — add score to _ChunkInfo and citation data

**Files:**
- Modify: `backend/app/services/chat_service.py:102-109` (_ChunkInfo dataclass)
- Modify: `backend/app/services/chat_service.py:368-379` (chunk_map construction)
- Modify: `backend/app/services/chat_service.py:163-176` (citation_data construction)

- [ ] **Step 1: Add `score` field to _ChunkInfo (line 109)**

After `document_filename: str = ""` (line 109), add:
```python
    score: float = 0.0
```

- [ ] **Step 2: Populate score in chunk_map (line 368-379)**

In the `chunk_map[idx] = _ChunkInfo(...)` block, add `score=item.get("score", 0.0)` after `document_filename`:
```python
                chunk_map[idx] = _ChunkInfo(
                    id=item["chunk_id"],
                    page_start=int(item["page"]),
                    page_end=int(item.get("page_end", item["page"])),
                    bboxes=item.get("bboxes") or [],
                    text=text,
                    section_title=item.get("section_title") or "",
                    document_id=chunk_doc_id if chunk_doc_id else document_id,
                    document_filename=collection_doc_names.get(chunk_doc_id, "")
                    if chunk_doc_id
                    else "",
                    score=item.get("score", 0.0),
                )
```

- [ ] **Step 3: Add confidence_score and context_text to citation_data (line 173-176)**

After `"offset": self.char_offset,` (line 170), before the `if chunk.document_id:` block (line 172), add:
```python
                        citation_data["confidence_score"] = round(chunk.score, 3)
                        citation_data["context_text"] = (chunk.text or "")[:300]
```

- [ ] **Step 4: Run existing tests to verify nothing broke**

Run: `cd backend && python3 -m pytest tests/test_smoke.py tests/test_parse_service.py -v`
Expected: All existing tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/chat_service.py
git commit -m "feat: add confidence_score and context_text to citation SSE events"
```

---

### Task 9: Frontend — SSE parser + types + hover popover

**Files:**
- Modify: `frontend/src/types/index.ts:12-22` (Citation interface)
- Modify: `frontend/src/lib/sse.ts:4-17` (CitationPayload + mapping)
- Create: `frontend/src/components/Chat/CitationPopover.tsx`
- Modify: `frontend/src/components/Chat/MessageBubble.tsx` (add hover trigger)

- [ ] **Step 1: Update Citation type**

In `frontend/src/types/index.ts`, add after `documentFilename` (line 21):
```typescript
  confidenceScore?: number;
  contextText?: string;
```

- [ ] **Step 2: Update SSE parser**

In `frontend/src/lib/sse.ts`, update `CitationEventPayload` (line 14-17) to include:
```typescript
type CitationEventPayload = CitationPayload & {
  document_id?: string;
  document_filename?: string;
  confidence_score?: number;
  context_text?: string;
};
```

In the citation mapping block (lines 65-75), add after `documentFilename`:
```typescript
                confidenceScore: typeof p.confidence_score === 'number' ? p.confidence_score : undefined,
                contextText: typeof p.context_text === 'string' ? p.context_text : undefined,
```

- [ ] **Step 3: Create CitationPopover component**

```tsx
// frontend/src/components/Chat/CitationPopover.tsx
"use client";

import React, { useState, useRef } from 'react';
import type { Citation } from '../../types';

interface CitationPopoverProps {
  citation: Citation;
  children: React.ReactNode;
}

function confidenceColor(score: number): string {
  if (score >= 0.8) return 'bg-emerald-500';
  if (score >= 0.5) return 'bg-amber-500';
  return 'bg-red-500';
}

export default function CitationPopover({ citation, children }: CitationPopoverProps) {
  const [show, setShow] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleEnter = () => {
    timerRef.current = setTimeout(() => setShow(true), 300);
  };
  const handleLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShow(false);
  };

  return (
    <span className="relative inline-block" onMouseEnter={handleEnter} onMouseLeave={handleLeave} onClick={() => setShow(!show)}>
      {children}
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 rounded-lg shadow-lg border bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-xs">
          {citation.confidenceScore != null && (
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-2 h-2 rounded-full ${confidenceColor(citation.confidenceScore)}`} />
              <span className="text-zinc-500">{Math.round(citation.confidenceScore * 100)}% confidence</span>
            </div>
          )}
          <div className="text-zinc-500 mb-1">
            {citation.documentFilename && <span className="font-medium text-zinc-700 dark:text-zinc-300">{citation.documentFilename}</span>}
            {citation.page && <span> — p. {citation.page}</span>}
          </div>
          {citation.contextText && (
            <p className="text-zinc-600 dark:text-zinc-400 line-clamp-4 mt-1">&ldquo;{citation.contextText}&rdquo;</p>
          )}
        </div>
      )}
    </span>
  );
}
```

- [ ] **Step 4: Wrap citation markers in MessageBubble with CitationPopover**

In the MessageBubble component where `[n]` markers are rendered as clickable spans, wrap each with `<CitationPopover citation={matchedCitation}>`.

- [ ] **Step 5: Test manually**

1. Send a message → hover over [1] → popover shows confidence %, doc name, page, context
2. Verify popover disappears on mouse leave
3. On mobile, tap to toggle

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/lib/sse.ts frontend/src/components/Chat/CitationPopover.tsx frontend/src/components/Chat/MessageBubble.tsx
git commit -m "feat: citation confidence popover with score, context, and source info"
```

---

## Chunk 3: Feature 3 — Cross-Document Q&A UI

### Task 10: Backend — collection plan limits

**Files:**
- Modify: `backend/app/core/config.py:122-128` (add collection limits)
- Modify: `backend/app/api/collections.py` (add limit checks)
- Test: `backend/tests/test_collection_limits.py`

- [ ] **Step 1: Add collection limit constants to config.py**

After `PRO_MAX_FILE_SIZE_MB` (line 128), add:
```python
    # Collection limits per plan
    FREE_MAX_COLLECTIONS: int = 1
    PLUS_MAX_COLLECTIONS: int = 5
    PRO_MAX_COLLECTIONS: int = 999
    FREE_MAX_DOCS_PER_COLLECTION: int = 3
    PLUS_MAX_DOCS_PER_COLLECTION: int = 10
    PRO_MAX_DOCS_PER_COLLECTION: int = 999
```

- [ ] **Step 2: Add limit checks in collections.py**

In the `create_collection` endpoint, before creating the collection, add:
```python
    # Plan limit check
    count_result = await db.execute(
        select(func.count()).select_from(Collection).where(Collection.user_id == user.id)
    )
    current_count = count_result.scalar() or 0
    max_collections = getattr(settings, f"{user.plan.upper()}_MAX_COLLECTIONS", 1)
    if current_count >= max_collections:
        raise HTTPException(403, f"Your plan allows up to {max_collections} collections")
```

In the `add_documents_to_collection` endpoint, add:
```python
    # Check doc count limit
    doc_count_result = await db.execute(
        select(func.count()).select_from(collection_documents).where(
            collection_documents.c.collection_id == collection_id
        )
    )
    current_docs = doc_count_result.scalar() or 0
    max_docs = getattr(settings, f"{user.plan.upper()}_MAX_DOCS_PER_COLLECTION", 3)
    if current_docs + len(request.document_ids) > max_docs:
        raise HTTPException(403, f"Your plan allows up to {max_docs} documents per collection")
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/core/config.py backend/app/api/collections.py
git commit -m "feat: enforce collection plan limits (count + docs per collection)"
```

---

### Task 11: Frontend — collection chat page redesign

**Files:**
- Modify: `frontend/src/app/collections/[collectionId]/page.tsx` (full redesign)
- Create: `frontend/src/components/Collections/CollectionSidebar.tsx`
- Create: `frontend/src/components/Collections/SessionList.tsx`
- Create: `frontend/src/components/Chat/CollectionCitationCard.tsx`

- [ ] **Step 1: Create CollectionSidebar component**

```tsx
// frontend/src/components/Collections/CollectionSidebar.tsx
"use client";
import React from 'react';
import { FileText, Plus, ExternalLink } from 'lucide-react';
import type { CollectionDocumentBrief } from '../../types';

interface CollectionSidebarProps {
  documents: CollectionDocumentBrief[];
  onAddDocs: () => void;
  onOpenDoc: (docId: string) => void;
}

export default function CollectionSidebar({ documents, onAddDocs, onOpenDoc }: CollectionSidebarProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-800">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Documents ({documents.length})</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {documents.map((doc) => (
          <button
            key={doc.id}
            onClick={() => onOpenDoc(doc.id)}
            className="w-full flex items-center gap-2 p-2 rounded-lg text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <FileText size={14} className="text-zinc-400 shrink-0" />
            <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate">{doc.filename}</span>
            <ExternalLink size={10} className="text-zinc-400 shrink-0 ml-auto" />
          </button>
        ))}
      </div>
      <div className="p-2 border-t border-zinc-200 dark:border-zinc-800">
        <button onClick={onAddDocs} className="w-full flex items-center justify-center gap-1 px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
          <Plus size={12} /> Add Documents
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create SessionList component**

```tsx
// frontend/src/components/Collections/SessionList.tsx
"use client";
import React from 'react';
import { MessageSquare, Plus } from 'lucide-react';
import type { SessionItem } from '../../types';

interface SessionListProps {
  sessions: SessionItem[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
}

export default function SessionList({ sessions, activeSessionId, onSelectSession, onNewSession }: SessionListProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-800">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Sessions</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sessions.map((s) => (
          <button
            key={s.session_id}
            onClick={() => onSelectSession(s.session_id)}
            className={`w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors ${
              s.session_id === activeSessionId
                ? 'bg-zinc-200 dark:bg-zinc-700'
                : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            <MessageSquare size={14} className="text-zinc-400 shrink-0" />
            <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate">
              {s.title || `Session ${s.message_count} msgs`}
            </span>
          </button>
        ))}
      </div>
      <div className="p-2 border-t border-zinc-200 dark:border-zinc-800">
        <button onClick={onNewSession} className="w-full flex items-center justify-center gap-1 px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
          <Plus size={12} /> New Chat
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create CollectionCitationCard (expandable)**

```tsx
// frontend/src/components/Chat/CollectionCitationCard.tsx
"use client";
import React, { useState } from 'react';
import { ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import type { Citation } from '../../types';

interface Props {
  citation: Citation;
}

function confidenceColor(score: number): string {
  if (score >= 0.8) return 'bg-emerald-500';
  if (score >= 0.5) return 'bg-amber-500';
  return 'bg-red-500';
}

export default function CollectionCitationCard({ citation }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <span className="inline">
      <button
        onClick={() => setExpanded(!expanded)}
        className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-xs font-medium bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
      >
        [{citation.refIndex}]
        {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
      </button>
      {expanded && (
        <div className="block mt-1 mb-2 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs">
          <div className="flex items-center gap-2 mb-1">
            {citation.confidenceScore != null && (
              <div className={`w-2 h-2 rounded-full ${confidenceColor(citation.confidenceScore)}`} />
            )}
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">{citation.documentFilename || 'Document'}</span>
            <span className="text-zinc-500">p. {citation.page}</span>
          </div>
          {citation.contextText && (
            <p className="text-zinc-600 dark:text-zinc-400 mt-1 line-clamp-4">&ldquo;{citation.contextText}&rdquo;</p>
          )}
          {citation.documentId && (
            <a
              href={`/d/${citation.documentId}?page=${citation.page}&highlight=${citation.chunkId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              <ExternalLink size={10} /> View in original
            </a>
          )}
        </div>
      )}
    </span>
  );
}
```

- [ ] **Step 4: Redesign collection detail page**

Rewrite `frontend/src/app/collections/[collectionId]/page.tsx` using the new sidebar components. Layout: left sidebar (documents + sessions) + right chat panel. Pass `collectionId` to ChatPanel. Mobile: dropdowns at top.

- [ ] **Step 5: Add query param handling to DocumentReaderPageClient**

In `frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx`, add at the top of the component:
```typescript
import { useSearchParams } from 'next/navigation';

// Inside the component:
const searchParams = useSearchParams();
useEffect(() => {
  const page = searchParams.get('page');
  const highlight = searchParams.get('highlight');
  if (page) {
    setCurrentPage(parseInt(page, 10));
  }
  // highlight handling via existing bbox lookup
}, [searchParams]);
```

- [ ] **Step 6: Test manually**

1. Create a collection with 3 docs → verify chat works
2. Ask a cross-document question → verify response cites different docs
3. Click citation → card expands with doc name, page, context
4. Click "View in original" → opens document page at correct location
5. Test session switching
6. Test mobile layout

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/collections/ frontend/src/components/Collections/ frontend/src/components/Chat/CollectionCitationCard.tsx frontend/src/app/d/
git commit -m "feat: cross-document Q&A UI with expandable citation cards"
```

---

## Chunk 4: Feature 4 — Legal / Academic Mode

### Task 12: Alembic migration — add domain_mode to sessions

**Files:**
- Create: `backend/alembic/versions/xxxx_add_domain_mode.py`
- Modify: `backend/app/models/tables.py:160` (ChatSession model)

- [ ] **Step 1: Add domain_mode column to ChatSession model**

After `updated_at` (line 162) in `ChatSession`, add:
```python
    domain_mode: Mapped[Optional[str]] = mapped_column(sa.String(20), nullable=True)
```

- [ ] **Step 2: Generate and edit migration**

```bash
cd backend && python3 -m alembic revision --autogenerate -m "add_domain_mode_to_sessions"
```

Edit the migration to include the CHECK constraint:
```python
def upgrade():
    op.add_column("sessions", sa.Column("domain_mode", sa.String(20), nullable=True))
    op.create_check_constraint("ck_sessions_domain_mode", "sessions", "domain_mode IN ('legal', 'academic')")

def downgrade():
    op.drop_constraint("ck_sessions_domain_mode", "sessions")
    op.drop_column("sessions", "domain_mode")
```

- [ ] **Step 3: Run migration**

Run: `cd backend && python3 -m alembic upgrade head`

- [ ] **Step 4: Commit**

```bash
git add backend/alembic/ backend/app/models/tables.py
git commit -m "migration: add domain_mode column to sessions"
```

---

### Task 13: Backend — domain rules + chat service integration

**Files:**
- Modify: `backend/app/core/model_profiles.py:55` (add DOMAIN_RULES after COLLECTION_EXTRA_RULES)
- Modify: `backend/app/schemas/chat.py:10-13` (add domain_mode to ChatRequest)
- Modify: `backend/app/schemas/chat.py:47-52` (add domain_mode to SessionListItem)
- Modify: `backend/app/services/chat_service.py:392-408` (inject domain rules into prompt)

- [ ] **Step 1: Add DOMAIN_RULES to model_profiles.py**

After `COLLECTION_EXTRA_RULES` (line 65), add:
```python
DOMAIN_RULES: dict[str, list[str]] = {
    "legal": [
        "Every factual claim MUST have a citation [n] to a specific document fragment. If the document does not contain relevant information, state: 'The document does not contain information on this topic.'",
        "Never generate, infer, or paraphrase legal conclusions not directly supported by the document text.",
        "Use precise legal language: 'The document states...' rather than 'According to...' or 'It seems...'",
        "When quoting, preserve the original wording exactly. Mark any omissions with [...].",
        "If multiple interpretations are possible, present each with its supporting citation.",
    ],
    "academic": [
        "Every claim MUST cite the specific document fragment with [n]. Clearly distinguish direct quotes from paraphrased content.",
        "For comparative questions, cite multiple sources and note agreements or contradictions between them.",
        "Include section titles and page numbers in your analysis when referencing specific parts of a document.",
        "Use academic register: hedging language for uncertain claims ('the data suggests...'), definitive language only for directly quoted content.",
        "If the documents do not contain sufficient evidence to answer, explicitly state the limitation rather than speculating.",
    ],
}
```

- [ ] **Step 2: Update ChatRequest schema**

In `backend/app/schemas/chat.py`, add after `mode` field (line 12):
```python
    domain_mode: Optional[Literal["legal", "academic"]] = None
```

Add `domain_mode` to `SessionListItem` (line 50):
```python
    domain_mode: Optional[str] = None
```

- [ ] **Step 3: Inject domain rules in chat_service.py**

After the system prompt is built (after line ~408, after custom instructions injection), add:
```python
            # Domain-specific rules (legal/academic mode)
            domain_mode = body.domain_mode or session.domain_mode
            if domain_mode and domain_mode in DOMAIN_RULES:
                from app.core.model_profiles import DOMAIN_RULES
                domain_rules_text = f"\n\n## {domain_mode.title()} Mode Rules\n"
                base_rule_count = len(rules.strip().split('\n'))
                for i, rule in enumerate(DOMAIN_RULES[domain_mode], start=base_rule_count + 1):
                    domain_rules_text += f"{i}. {rule}\n"
                system_prompt += domain_rules_text

            # Persist domain_mode to session if changed
            if body.domain_mode and body.domain_mode != session.domain_mode:
                session.domain_mode = body.domain_mode
                await db.commit()
```

Import `DOMAIN_RULES` at the top of the file.

- [ ] **Step 4: Update session list endpoint to include domain_mode**

In the session list query/response mapping, include `domain_mode` from the session.

- [ ] **Step 5: Run tests**

Run: `cd backend && python3 -m pytest tests/test_smoke.py tests/test_parse_service.py -v`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/core/model_profiles.py backend/app/schemas/chat.py backend/app/services/chat_service.py
git commit -m "feat: legal/academic domain mode rules + chat service integration"
```

---

### Task 14: Frontend — domain mode toggle + SSE integration

**Files:**
- Modify: `frontend/src/lib/sse.ts:131` (pass domain_mode in chatStream)
- Modify: `frontend/src/store/index.ts` (add domainMode state)
- Create: `frontend/src/components/Chat/DomainModeSelector.tsx`
- Modify: `frontend/src/components/Chat/ChatPanel.tsx` (integrate selector)

- [ ] **Step 1: Add domainMode to store**

In `frontend/src/store/index.ts`, add to the store interface:
```typescript
  domainMode: string | null;
  setDomainMode: (mode: string | null) => void;
```

And in the store creation:
```typescript
  domainMode: null,
  setDomainMode: (mode) => set({ domainMode: mode }),
```

- [ ] **Step 2: Update SSE chatStream to pass domain_mode**

In `frontend/src/lib/sse.ts`, add `domainMode` parameter to `chatStream()` (line 124) and include in the request body (line 131):
```typescript
export async function chatStream(
  sessionId: string,
  message: string,
  onToken, onCitation, onError, onDone, onTruncated,
  mode?: string,
  locale?: string,
  signal?: AbortSignal,
  domainMode?: string,  // NEW
) {
  const res = await fetch(`${PROXY_BASE}/api/sessions/${sessionId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      ...(mode ? { mode } : {}),
      ...(locale ? { locale } : {}),
      ...(domainMode ? { domain_mode: domainMode } : {}),
    }),
    signal,
  });
```

- [ ] **Step 3: Create DomainModeSelector component**

```tsx
// frontend/src/components/Chat/DomainModeSelector.tsx
"use client";
import React from 'react';
import { Scale, GraduationCap, Lock } from 'lucide-react';
import { useDocTalkStore } from '../../store';
import { useLocale } from '../../i18n';

interface Props {
  userPlan?: string;
}

const MODES = [
  { id: null, label: 'Default', icon: null },
  { id: 'legal', label: 'Legal', icon: Scale, color: 'amber' },
  { id: 'academic', label: 'Academic', icon: GraduationCap, color: 'blue' },
] as const;

export default function DomainModeSelector({ userPlan }: Props) {
  const domainMode = useDocTalkStore((s) => s.domainMode);
  const setDomainMode = useDocTalkStore((s) => s.setDomainMode);
  const isStreaming = useDocTalkStore((s) => s.isStreaming);
  const canUse = userPlan === 'plus' || userPlan === 'pro';

  return (
    <div className="flex gap-1">
      {MODES.map((m) => {
        const active = domainMode === m.id;
        const disabled = !canUse && m.id !== null;
        const Icon = m.icon;

        return (
          <button
            key={m.id ?? 'default'}
            onClick={() => !disabled && !isStreaming && setDomainMode(m.id)}
            disabled={disabled || isStreaming}
            title={disabled ? 'Upgrade to Plus to unlock' : m.label}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md border transition-colors ${
              active
                ? m.id === 'legal'
                  ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : m.id === 'academic'
                    ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                    : 'border-zinc-400 bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200'
                : 'border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {disabled && <Lock size={10} />}
            {Icon && !disabled && <Icon size={10} />}
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Integrate into ChatPanel**

In ChatPanel, render `<DomainModeSelector userPlan={userPlan} />` below the mode selector area. Pass `domainMode` from store to the `sendMessage` flow.

- [ ] **Step 5: Add i18n strings**

Add keys to all 11 locales: `chat.domainDefault`, `chat.domainLegal`, `chat.domainAcademic`, `chat.domainUpgrade`

- [ ] **Step 6: Test manually**

1. As Plus user: select Legal → send question → verify stricter citations in response
2. As Plus user: select Academic → send question → verify academic tone
3. As Free user: verify Legal/Academic buttons are disabled with lock icon
4. Switch sessions → verify domain mode restores correctly
5. Test mode combinations: Legal + Thorough, Academic + Quick

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/sse.ts frontend/src/store/index.ts frontend/src/components/Chat/DomainModeSelector.tsx frontend/src/components/Chat/ChatPanel.tsx frontend/src/i18n/
git commit -m "feat: legal/academic domain mode toggle with plan gating"
```

---

## Chunk 5: Final Integration + Deployment

### Task 15: Integration testing + deploy

- [ ] **Step 1: Run full backend test suite**

```bash
cd backend && python3 -m pytest tests/ -v
cd backend && python3 -m ruff check app/ tests/
```

- [ ] **Step 2: Run frontend build**

```bash
cd frontend && npm run build
```

- [ ] **Step 3: Manual E2E test checklist**

- [ ] Export: Markdown, PDF, DOCX all download correctly
- [ ] Share: create link, open in incognito, verify read-only view
- [ ] Share: free plan 3-link limit works
- [ ] Confidence: hover citation shows popover with score + context
- [ ] Cross-doc: collection chat works, citation cards expand
- [ ] Cross-doc: "View in original" opens correct page
- [ ] Legal mode: stricter citations, refuses to speculate
- [ ] Academic mode: hedging language, section titles in citations
- [ ] Domain mode: persists per session, restores on switch
- [ ] Domain mode: disabled for free users

- [ ] **Step 4: Deploy backend**

```bash
git checkout stable && git merge main && git push origin stable
git checkout stable && railway up --detach
git checkout main
```

- [ ] **Step 5: Deploy frontend**

Frontend auto-deploys when `stable` is pushed to GitHub. Verify at https://www.doctalk.site.

- [ ] **Step 6: Run DB migrations on production**

Migrations run automatically via `entrypoint.sh` on Railway deploy.

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: complete top 4 features (export, confidence, cross-doc, domain modes)"
```
