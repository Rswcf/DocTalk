#!/usr/bin/env python3
"""Run cross-user document/session/share access boundary checks."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import httpx
from jose import jwt

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run DocTalk access-boundary QA smoke.")
    parser.add_argument("--api-base", default="http://127.0.0.1:8000")
    parser.add_argument("--file", default="test_inputs/semiconductor.pdf")
    parser.add_argument("--query", default="semiconductor")
    parser.add_argument("--timeout", type=int, default=180)
    parser.add_argument("--poll-interval", type=float, default=3.0)
    parser.add_argument("--json-out")
    parser.add_argument("--keep", action="store_true")
    return parser.parse_args()


async def create_user(prefix: str) -> Any:
    from app.models.database import AsyncSessionLocal
    from app.services import auth_service

    email = f"qa-{prefix}-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:8]}@example.com"
    async with AsyncSessionLocal() as db:
        return await auth_service.create_user(db, email=email, name=f"QA {prefix}")


async def delete_users(user_ids: list[uuid.UUID]) -> None:
    from sqlalchemy import select

    from app.models.database import AsyncSessionLocal
    from app.models.tables import Document, User
    from app.services.doc_service import doc_service

    async with AsyncSessionLocal() as db:
        for user_id in user_ids:
            doc_ids = (
                await db.scalars(select(Document.id).where(Document.user_id == user_id))
            ).all()
            for document_id in doc_ids:
                await doc_service.delete_document(document_id, db)
            user = await db.get(User, user_id)
            if user is not None:
                await db.delete(user)
        await db.commit()


def token_for(user_id: uuid.UUID) -> str:
    from app.core.config import settings

    if not settings.AUTH_SECRET:
        raise RuntimeError("AUTH_SECRET is required")
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "sub": str(user_id),
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(hours=2)).timestamp()),
        },
        settings.AUTH_SECRET,
        algorithm="HS256",
    )


async def insert_share_messages(session_id: str, document_id: str, chunk_id: str, filename: str) -> None:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import Message

    async with AsyncSessionLocal() as db:
        db.add(
            Message(
                session_id=uuid.UUID(session_id),
                role="user",
                content="What does this document mention about semiconductors?",
                citations=None,
                metadata_json={},
            )
        )
        db.add(
            Message(
                session_id=uuid.UUID(session_id),
                role="assistant",
                content="The document mentions semiconductor reports and related market materials. [1]",
                citations=[
                    {
                        "ref_index": 1,
                        "chunk_id": chunk_id,
                        "document_id": document_id,
                        "document_filename": filename,
                        "page": 1,
                        "text_snippet": "semiconductor reports",
                        "bboxes": [{"x": 0.1, "y": 0.2, "w": 0.3, "h": 0.1, "page": 1}],
                        "confidence_score": 0.9,
                    }
                ],
                metadata_json={},
            )
        )
        await db.commit()


async def run(args: argparse.Namespace) -> dict[str, Any]:
    file_path = (ROOT / args.file).resolve()
    owner = await create_user("owner")
    other = await create_user("other")
    owner_headers = {"Authorization": f"Bearer {token_for(owner.id)}"}
    other_headers = {"Authorization": f"Bearer {token_for(other.id)}"}
    report: dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "api_base": args.api_base,
        "file": str(file_path.relative_to(ROOT)),
        "owner_user_id": str(owner.id),
        "other_user_id": str(other.id),
        "checks": [],
        "cleanup": "pending",
    }

    try:
        async with httpx.AsyncClient(base_url=args.api_base, timeout=30.0) as client:
            health = await client.get("/health")
            report["health"] = {"status_code": health.status_code, "body": safe_json(health)}
            health.raise_for_status()

            with file_path.open("rb") as fh:
                upload = await client.post(
                    "/api/documents/upload",
                    headers=owner_headers,
                    files={"file": (file_path.name, fh, "application/pdf")},
                )
            upload_body = safe_json(upload)
            upload.raise_for_status()
            document_id = upload_body["document_id"]
            report["document_id"] = document_id
            report["checks"].append(check_result("owner_upload", upload.status_code, 202, body=upload_body))

            final_doc = await poll_ready(client, document_id, owner_headers, args.timeout, args.poll_interval)
            report["checks"].append({"name": "owner_poll_ready", "result": "pass", "polls": final_doc["polls"]})

            search = await client.post(
                f"/api/documents/{document_id}/search",
                headers=owner_headers,
                json={"query": args.query, "top_k": 1},
            )
            search_body = safe_json(search)
            search.raise_for_status()
            chunk_id = search_body["results"][0]["chunk_id"]
            report["chunk_id"] = chunk_id
            report["checks"].append(check_result("owner_search", search.status_code, 200, body=summarize_search(search_body)))

            session = await client.post(f"/api/documents/{document_id}/sessions", headers=owner_headers)
            session_body = safe_json(session)
            session.raise_for_status()
            session_id = session_body["session_id"]
            report["session_id"] = session_id
            report["checks"].append(check_result("owner_create_session", session.status_code, 201, body=session_body))

            await insert_share_messages(session_id, document_id, chunk_id, file_path.name)

            # Owner-allowed endpoints.
            owner_checks = [
                ("owner_get_document", "GET", f"/api/documents/{document_id}", None),
                ("owner_file_url", "GET", f"/api/documents/{document_id}/file-url", None),
                ("owner_text_content", "GET", f"/api/documents/{document_id}/text-content", None),
                ("owner_chunk_detail", "GET", f"/api/chunks/{chunk_id}", None),
                ("owner_get_messages", "GET", f"/api/sessions/{session_id}/messages", None),
            ]
            for name, method, url, payload in owner_checks:
                res = await request(client, method, url, owner_headers, payload)
                report["checks"].append(check_result(name, res.status_code, 200, body=safe_json(res)))

            # Other user should get 404 for private resource surfaces.
            other_checks = [
                ("other_get_document", "GET", f"/api/documents/{document_id}", None),
                ("other_file_url", "GET", f"/api/documents/{document_id}/file-url", None),
                ("other_text_content", "GET", f"/api/documents/{document_id}/text-content", None),
                ("other_search", "POST", f"/api/documents/{document_id}/search", {"query": args.query, "top_k": 1}),
                ("other_chunk_detail", "GET", f"/api/chunks/{chunk_id}", None),
                ("other_create_session", "POST", f"/api/documents/{document_id}/sessions", None),
                ("other_get_messages", "GET", f"/api/sessions/{session_id}/messages", None),
            ]
            for name, method, url, payload in other_checks:
                res = await request(client, method, url, other_headers, payload)
                report["checks"].append(check_result(name, res.status_code, 404, body=safe_json(res)))

            # Anonymous should be denied or hidden, depending on endpoint auth semantics.
            anon_expected = [
                ("anon_get_document", "GET", f"/api/documents/{document_id}", None, 404),
                ("anon_file_url", "GET", f"/api/documents/{document_id}/file-url", None, 404),
                ("anon_text_content", "GET", f"/api/documents/{document_id}/text-content", None, 404),
                ("anon_search", "POST", f"/api/documents/{document_id}/search", {"query": args.query, "top_k": 1}, 404),
                ("anon_chunk_detail", "GET", f"/api/chunks/{chunk_id}", None, 404),
                ("anon_create_session", "POST", f"/api/documents/{document_id}/sessions", None, 404),
                ("anon_create_share", "POST", f"/api/sessions/{session_id}/share", None, 401),
            ]
            for name, method, url, payload, expected in anon_expected:
                res = await request(client, method, url, None, payload)
                report["checks"].append(check_result(name, res.status_code, expected, body=safe_json(res)))

            other_share = await client.post(f"/api/sessions/{session_id}/share", headers=other_headers)
            report["checks"].append(check_result("other_create_share", other_share.status_code, 404, body=safe_json(other_share)))

            owner_share = await client.post(f"/api/sessions/{session_id}/share", headers=owner_headers)
            owner_share_body = safe_json(owner_share)
            owner_share.raise_for_status()
            share_token = owner_share_body["share_token"]
            report["share_token"] = share_token
            report["checks"].append(check_result("owner_create_share", owner_share.status_code, 200, body=owner_share_body))

            public_share = await client.get(f"/api/shared/{share_token}")
            public_share_body = safe_json(public_share)
            public_share.raise_for_status()
            safe_text = json.dumps(public_share_body, ensure_ascii=False)
            safe = all(field not in safe_text for field in ["chunk_id", "document_id", "bboxes", "confidence_score"])
            report["checks"].append({
                "name": "public_share_sanitized",
                "actual_status": public_share.status_code,
                "expected_status": 200,
                "result": "pass" if safe and public_share.status_code == 200 else "fail",
                "message_count": len(public_share_body.get("messages", [])) if isinstance(public_share_body, dict) else None,
                "private_fields_absent": safe,
            })

            revoke = await client.delete(f"/api/sessions/{session_id}/share", headers=owner_headers)
            report["checks"].append(check_result("owner_revoke_share", revoke.status_code, 204, body={}))
            revoked = await client.get(f"/api/shared/{share_token}")
            report["checks"].append(check_result("public_share_after_revoke", revoked.status_code, 404, body=safe_json(revoked)))

        report["result"] = "pass" if all(c.get("result") == "pass" for c in report["checks"]) else "fail"
        return report
    except Exception as exc:
        report["result"] = "fail"
        report["error"] = f"{type(exc).__name__}: {exc}"
        raise
    finally:
        if args.keep:
            report["cleanup"] = "kept"
        else:
            try:
                await delete_users([owner.id, other.id])
                report["cleanup"] = "deleted qa users and owned docs"
            except Exception as cleanup_exc:
                report["cleanup"] = f"failed: {type(cleanup_exc).__name__}: {cleanup_exc}"
        if args.json_out:
            out = Path(args.json_out)
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


async def poll_ready(
    client: httpx.AsyncClient,
    document_id: str,
    headers: dict[str, str],
    timeout: int,
    poll_interval: float,
) -> dict[str, Any]:
    started = time.monotonic()
    deadline = started + timeout
    polls: list[dict[str, Any]] = []
    while time.monotonic() < deadline:
        res = await client.get(f"/api/documents/{document_id}", headers=headers)
        body = safe_json(res)
        status = body.get("status") if isinstance(body, dict) else None
        polls.append({
            "at_seconds": round(time.monotonic() - started, 3),
            "status_code": res.status_code,
            "status": status,
        })
        res.raise_for_status()
        if status == "ready":
            return {"body": body, "polls": polls}
        if status == "error":
            raise RuntimeError(f"Document ended with error: {body}")
        await asyncio.sleep(poll_interval)
    raise TimeoutError(f"Document {document_id} did not become ready within {timeout}s")


async def request(
    client: httpx.AsyncClient,
    method: str,
    url: str,
    headers: dict[str, str] | None,
    payload: dict[str, Any] | None,
) -> httpx.Response:
    kwargs: dict[str, Any] = {}
    if headers:
        kwargs["headers"] = headers
    if payload is not None:
        kwargs["json"] = payload
    return await client.request(method, url, **kwargs)


def check_result(name: str, actual: int, expected: int, *, body: Any) -> dict[str, Any]:
    return {
        "name": name,
        "actual_status": actual,
        "expected_status": expected,
        "result": "pass" if actual == expected else "fail",
        "body": compact_body(body),
    }


def compact_body(body: Any) -> Any:
    text = json.dumps(body, ensure_ascii=False)
    if len(text) <= 1200:
        return body
    return {"truncated_json": text[:1200]}


def summarize_search(body: dict[str, Any]) -> dict[str, Any]:
    results = body.get("results") or []
    return {
        "result_count": len(results),
        "first": {
            "chunk_id": results[0].get("chunk_id"),
            "page": results[0].get("page"),
            "bbox_count": len(results[0].get("bboxes") or []),
            "score": results[0].get("score"),
        } if results else None,
    }


def safe_json(response: httpx.Response) -> Any:
    try:
        return response.json()
    except Exception:
        return {"text": response.text[:1000]}


def main() -> None:
    args = parse_args()
    try:
        report = asyncio.run(run(args))
    except Exception as exc:
        print(f"FAIL: {type(exc).__name__}: {exc}", file=sys.stderr)
        raise SystemExit(1)
    failed = [c["name"] for c in report["checks"] if c.get("result") != "pass"]
    if failed:
        print(f"FAIL: {len(failed)} checks failed: {', '.join(failed)}", file=sys.stderr)
        raise SystemExit(1)
    print(f"PASS: {len(report['checks'])} access-boundary checks; cleanup={report['cleanup']}")


if __name__ == "__main__":
    main()

