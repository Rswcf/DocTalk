#!/usr/bin/env python3
"""Create or clean up synthetic non-PDF citation fixtures for browser QA."""

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


TXT_PAGE = """Plain text extraction should preserve user notes.

The non-PDF citation target sentence says uploaded text files can highlight exact source snippets in the document viewer.

中文段落用于验证 UTF-8 文本不会破坏普通文本引用跳转。
"""

TXT_SNIPPET = "The non-PDF citation target sentence says uploaded text files can highlight exact source snippets in the document viewer."

MD_PAGE_ONE = """# Product Plan

Markdown extraction should keep paragraphs and tables.

| Area | Priority |
| --- | --- |
| Citations | High |
| URL import | Medium |
"""

MD_PAGE_TWO = """## Citation Detail

The markdown citation target sentence confirms tables and headings still support source verification.

引用跳转需要稳定。
"""

MD_SNIPPET = "The markdown citation target sentence confirms tables and headings still support source verification."


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
    from app.services import auth_service

    email = f"qa-browser-nonpdf-citation-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:8]}@example.com"
    async with AsyncSessionLocal() as db:
        user = await auth_service.create_user(db, email=email, name="QA Browser Non-PDF Citation")
        user.plan = "plus"

        txt_case = make_case(
            db=db,
            user_id=user.id,
            filename="qa-nonpdf-notes.txt",
            file_type="txt",
            pages=[TXT_PAGE],
            snippet=TXT_SNIPPET,
            section_title=None,
            question="What does the uploaded text file prove?",
            answer="Uploaded text files can highlight exact source snippets in the document viewer.",
        )
        md_case = make_case(
            db=db,
            user_id=user.id,
            filename="qa-nonpdf-plan.md",
            file_type="md",
            pages=[MD_PAGE_ONE, MD_PAGE_TWO],
            snippet=MD_SNIPPET,
            section_title="Citation Detail",
            question="What does the markdown file prove?",
            answer="Markdown files keep headings and tables while supporting source verification.",
            target_page=2,
        )
        await db.commit()

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "result": "pass",
        "user": {"id": str(user.id), "email": user.email, "name": user.name, "plan": user.plan},
        "cases": [txt_case, md_case],
    }


def make_case(
    *,
    db: Any,
    user_id: uuid.UUID,
    filename: str,
    file_type: str,
    pages: list[str],
    snippet: str,
    section_title: str | None,
    question: str,
    answer: str,
    target_page: int = 1,
) -> dict[str, Any]:
    from app.models.tables import ChatSession, Chunk, Document, Message, Page

    doc_id = uuid.uuid4()
    doc = Document(
        id=doc_id,
        filename=filename,
        file_size=sum(len(page) for page in pages),
        storage_key=f"qa/browser-nonpdf-citation/{doc_id}/{filename}",
        status="ready",
        page_count=len(pages),
        pages_parsed=len(pages),
        chunks_total=1,
        chunks_indexed=1,
        user_id=user_id,
        file_type=file_type,
        summary=f"Synthetic {file_type} citation fixture.",
        suggested_questions=[question],
    )
    db.add(doc)
    for idx, content in enumerate(pages, start=1):
        db.add(Page(document_id=doc_id, page_number=idx, content=content))

    chunk_id = uuid.uuid4()
    db.add(
        Chunk(
            id=chunk_id,
            document_id=doc_id,
            chunk_index=0,
            text=snippet,
            token_count=18,
            page_start=target_page,
            page_end=target_page,
            bboxes=[],
            section_title=section_title,
            vector_id=None,
        )
    )
    session_id = uuid.uuid4()
    db.add(
        ChatSession(
            id=session_id,
            document_id=doc_id,
            user_id=user_id,
            title=f"QA {file_type} citation session",
        )
    )
    db.add(
        Message(
            session_id=session_id,
            role="user",
            content=question,
            citations=None,
            metadata_json={},
        )
    )
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
                    "document_filename": filename,
                    "page": target_page,
                    "page_end": target_page,
                    "text_snippet": snippet,
                    "bboxes": [],
                    "confidence_score": 0.97,
                    "offset": len(answer),
                }
            ],
            metadata_json={},
        )
    )
    return {
        "id": file_type,
        "document_id": str(doc_id),
        "session_id": str(session_id),
        "chunk_id": str(chunk_id),
        "filename": filename,
        "file_type": file_type,
        "target_page": target_page,
        "expected_highlight": snippet,
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
        print(f"created non-PDF citation fixture user={report['user']['id']} cases={len(report['cases'])}")
    elif args.command == "cleanup":
        report = asyncio.run(cleanup(args.user_id))
        write_report(args.json_out, report)
        print(f"cleanup users={report['users']} documents={report['documents']}")


if __name__ == "__main__":
    main()
