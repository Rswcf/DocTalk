#!/usr/bin/env python3
"""Create or clean up synthetic converted DOCX/PPTX citation fixtures for browser QA."""

from __future__ import annotations

import argparse
import asyncio
import io
import json
import sys
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import func, select

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


DOCX_PAGES = [
    "Converted DOCX QA Fixture\n\nThe first converted page establishes that a Word document can render through the slide viewer.",
    "The converted DOCX citation target sentence confirms the slide view can highlight exact source text.",
]
DOCX_SNIPPET = "The converted DOCX citation target sentence confirms the slide view can highlight exact source text."

PPTX_PAGES = [
    "Converted PPTX QA Fixture\n\nThe first slide carries presentation context for the browser citation test.",
    "The converted PPTX citation target sentence proves presentation slides support clickable source verification.",
]
PPTX_SNIPPET = "The converted PPTX citation target sentence proves presentation slides support clickable source verification."


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    create = sub.add_parser("create")
    create.add_argument("--json-out", required=True)
    cleanup = sub.add_parser("cleanup")
    cleanup.add_argument("--user-id", required=True)
    cleanup.add_argument("--json-out")
    return parser.parse_args()


def make_pdf(pages: list[str]) -> bytes:
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas

    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    for page_number, content in enumerate(pages, start=1):
        pdf.setTitle("DocTalk Converted Citation QA")
        pdf.setFont("Helvetica-Bold", 16)
        pdf.drawString(72, height - 72, f"Converted Citation QA Page {page_number}")
        pdf.setFont("Helvetica", 12)
        y = height - 112
        for paragraph in content.splitlines():
            if not paragraph:
                y -= 16
                continue
            line = paragraph
            while line:
                chunk = line[:92]
                line = line[92:]
                pdf.drawString(72, y, chunk)
                y -= 18
        pdf.showPage()
    pdf.save()
    return buffer.getvalue()


def make_placeholder_ooxml(kind: str) -> bytes:
    content_type = {
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml",
        "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml",
    }[kind]
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(
            "[Content_Types].xml",
            (
                '<?xml version="1.0" encoding="UTF-8"?>'
                '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                f'<Default Extension="xml" ContentType="{content_type}"/>'
                "</Types>"
            ),
        )
    return buffer.getvalue()


async def create_fixture(args: argparse.Namespace) -> dict[str, Any]:
    from app.models.database import AsyncSessionLocal
    from app.services import auth_service

    email = f"qa-browser-converted-citation-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:8]}@example.com"
    async with AsyncSessionLocal() as db:
        user = await auth_service.create_user(db, email=email, name="QA Browser Converted Citation")
        user.plan = "plus"

        docx_case = await make_case(
            db=db,
            user_id=user.id,
            filename="qa-converted-report.docx",
            file_type="docx",
            pages=DOCX_PAGES,
            snippet=DOCX_SNIPPET,
            target_page=2,
            answer="The converted DOCX slide view can highlight exact source text.",
        )
        pptx_case = await make_case(
            db=db,
            user_id=user.id,
            filename="qa-converted-deck.pptx",
            file_type="pptx",
            pages=PPTX_PAGES,
            snippet=PPTX_SNIPPET,
            target_page=2,
            answer="The converted PPTX slide view supports clickable source verification.",
        )
        await db.commit()

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "result": "pass",
        "user": {"id": str(user.id), "email": user.email, "name": user.name, "plan": user.plan},
        "cases": [docx_case, pptx_case],
    }


async def make_case(
    *,
    db: Any,
    user_id: uuid.UUID,
    filename: str,
    file_type: str,
    pages: list[str],
    snippet: str,
    target_page: int,
    answer: str,
) -> dict[str, Any]:
    from app.models.tables import ChatSession, Chunk, Document, Message, Page
    from app.services.storage_service import storage_service

    doc_id = uuid.uuid4()
    storage_key = f"qa/browser-converted-citation/{doc_id}/{filename}"
    converted_storage_key = f"qa/browser-converted-citation/{doc_id}/converted.pdf"
    original_bytes = make_placeholder_ooxml(file_type)
    converted_pdf = make_pdf(pages)
    await asyncio.to_thread(
        storage_service.upload_file,
        original_bytes,
        storage_key,
        f"application/vnd.openxmlformats-officedocument.{file_type}",
    )
    await asyncio.to_thread(storage_service.upload_file, converted_pdf, converted_storage_key, "application/pdf")

    doc = Document(
        id=doc_id,
        filename=filename,
        file_size=len(original_bytes),
        storage_key=storage_key,
        converted_storage_key=converted_storage_key,
        status="ready",
        page_count=len(pages),
        pages_parsed=len(pages),
        chunks_total=1,
        chunks_indexed=1,
        user_id=user_id,
        file_type=file_type,
        summary=f"Synthetic converted {file_type} citation fixture.",
        suggested_questions=[f"What does the converted {file_type.upper()} prove?"],
    )
    db.add(doc)
    for idx, content in enumerate(pages, start=1):
        db.add(Page(document_id=doc_id, page_number=idx, content=content))

    chunk_id = uuid.uuid4()
    dummy_bbox = {"page": target_page, "x": 0, "y": 0, "w": 1, "h": 1}
    db.add(
        Chunk(
            id=chunk_id,
            document_id=doc_id,
            chunk_index=0,
            text=snippet,
            token_count=18,
            page_start=target_page,
            page_end=target_page,
            bboxes=[dummy_bbox],
            section_title=None,
            vector_id=None,
        )
    )
    session_id = uuid.uuid4()
    db.add(
        ChatSession(
            id=session_id,
            document_id=doc_id,
            user_id=user_id,
            title=f"QA converted {file_type} citation session",
        )
    )
    db.add(
        Message(
            session_id=session_id,
            role="user",
            content=f"What does the converted {file_type.upper()} prove?",
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
                    "bboxes": [dummy_bbox],
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
        "storage_key": storage_key,
        "converted_storage_key": converted_storage_key,
    }


async def cleanup(user_id: str) -> dict[str, Any]:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import Document, User
    from app.services.doc_service import doc_service

    uid = uuid.UUID(user_id)
    async with AsyncSessionLocal() as db:
        doc_ids = (await db.scalars(select(Document.id).where(Document.user_id == uid))).all()
        for doc_id in doc_ids:
            await doc_service.delete_document(doc_id, db)
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
        print(f"created converted citation fixture user={report['user']['id']} cases={len(report['cases'])}")
    elif args.command == "cleanup":
        report = asyncio.run(cleanup(args.user_id))
        write_report(args.json_out, report)
        print(f"cleanup users={report['users']} documents={report['documents']}")


if __name__ == "__main__":
    main()
