#!/usr/bin/env python3
"""Create or clean up a synthetic URL/TextViewer citation fixture for browser QA."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import func, select

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


PAGE_ONE = """# Example Domain QA Source

Example Domain is a small public page used for documentation examples. It is intentionally simple so product tests can distinguish source content from browser or navigation chrome.
"""

PAGE_TWO = """# Citation Target

The citation target sentence says Example Domain is reserved for illustrative examples in documents and should be easy to verify inside the text viewer.

The surrounding paragraph adds neutral filler so the highlighted sentence is not the only visible text in this section.
"""

PAGE_THREE = """# Follow-up Context

This final section confirms the imported source has multiple text sections, a visible source URL, and enough body copy for a mobile citation-jump check.
"""

CITATION_SNIPPET = (
    "The citation target sentence says Example Domain is reserved for illustrative examples "
    "in documents and should be easy to verify inside the text viewer."
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    create = sub.add_parser("create")
    create.add_argument("--json-out", required=True)
    cleanup = sub.add_parser("cleanup")
    cleanup.add_argument("--user-id", required=True)
    cleanup.add_argument("--json-out")
    return parser.parse_args()


async def create_fixture(args: argparse.Namespace) -> dict[str, Any]:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import ChatSession, Chunk, Document, Message, Page
    from app.services import auth_service

    email = f"qa-browser-text-citation-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:8]}@example.com"
    async with AsyncSessionLocal() as db:
        user = await auth_service.create_user(db, email=email, name="QA Browser Text Citation")
        user.plan = "plus"

        doc_id = uuid.uuid4()
        doc = Document(
            id=doc_id,
            filename="Example Domain QA Source",
            file_size=len(PAGE_ONE) + len(PAGE_TWO) + len(PAGE_THREE),
            storage_key=f"qa/browser-text-citation/{doc_id}.txt",
            status="ready",
            page_count=3,
            pages_parsed=3,
            chunks_total=3,
            chunks_indexed=3,
            user_id=user.id,
            file_type="url",
            source_url="https://example.com/",
            summary="Synthetic URL/TextViewer citation fixture.",
            suggested_questions=["What is Example Domain used for?"],
        )
        db.add(doc)
        db.add_all(
            [
                Page(document_id=doc_id, page_number=1, content=PAGE_ONE),
                Page(document_id=doc_id, page_number=2, content=PAGE_TWO),
                Page(document_id=doc_id, page_number=3, content=PAGE_THREE),
            ]
        )
        chunk_id = uuid.uuid4()
        db.add(
            Chunk(
                id=chunk_id,
                document_id=doc_id,
                chunk_index=1,
                text=CITATION_SNIPPET,
                token_count=22,
                page_start=2,
                page_end=2,
                bboxes=[],
                section_title="Citation Target",
                vector_id=None,
            )
        )
        session_id = uuid.uuid4()
        db.add(
            ChatSession(
                id=session_id,
                document_id=doc_id,
                user_id=user.id,
                title="QA URL text citation session",
            )
        )
        db.add(
            Message(
                session_id=session_id,
                role="user",
                content="What is Example Domain used for?",
                citations=None,
                metadata_json={},
            )
        )
        answer = "Example Domain is reserved for illustrative examples in documents."
        db.add(
            Message(
                session_id=session_id,
                role="assistant",
                content=answer,
                citations=[
                    {
                        "ref_index": 1,
                        "chunk_id": str(chunk_id),
                        "document_id": str(doc_id),
                        "document_filename": doc.filename,
                        "page": 2,
                        "page_end": 2,
                        "text_snippet": CITATION_SNIPPET,
                        "bboxes": [],
                        "confidence_score": 0.98,
                        "offset": len(answer),
                    }
                ],
                metadata_json={},
            )
        )
        await db.commit()

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "result": "pass",
        "user": {"id": str(user.id), "email": user.email, "name": user.name, "plan": user.plan},
        "document_id": str(doc_id),
        "session_id": str(session_id),
        "chunk_id": str(chunk_id),
        "source_url": "https://example.com/",
        "expected_highlight": CITATION_SNIPPET,
    }


async def cleanup(user_id: str) -> dict[str, Any]:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import Document, User

    uid = uuid.UUID(user_id)
    async with AsyncSessionLocal() as db:
        doc_ids = (await db.scalars(select(Document.id).where(Document.user_id == uid))).all()
        for doc_id in doc_ids:
            doc = await db.get(Document, doc_id)
            if doc is not None:
                await db.delete(doc)
        user = await db.get(User, uid)
        if user is not None:
            await db.delete(user)
        await db.commit()

    async with AsyncSessionLocal() as db:
        users = await db.scalar(select(func.count()).select_from(User).where(User.id == uid))
        docs = await db.scalar(select(func.count()).select_from(Document).where(Document.user_id == uid))
    return {"result": "pass", "user_id": user_id, "users": int(users or 0), "documents": int(docs or 0)}


def write_report(path: str | None, report: dict[str, Any]) -> None:
    if not path:
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    args = parse_args()
    if args.command == "create":
        report = asyncio.run(create_fixture(args))
        write_report(args.json_out, report)
        print(f"created text citation fixture user={report['user']['id']} doc={report['document_id']}")
    elif args.command == "cleanup":
        report = asyncio.run(cleanup(args.user_id))
        write_report(args.json_out, report)
        print(f"cleanup users={report['users']} documents={report['documents']}")


if __name__ == "__main__":
    main()
