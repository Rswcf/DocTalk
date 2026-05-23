#!/usr/bin/env python3
"""Run collection workflow and ownership-boundary checks."""

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
    parser = argparse.ArgumentParser(description="Run DocTalk collections QA matrix.")
    parser.add_argument("--api-base", default="http://127.0.0.1:8000")
    parser.add_argument("--timeout", type=int, default=180)
    parser.add_argument("--poll-interval", type=float, default=3.0)
    parser.add_argument("--json-out")
    parser.add_argument("--keep", action="store_true")
    return parser.parse_args()


async def create_user(prefix: str, plan: str) -> dict[str, Any]:
    from app.models.database import AsyncSessionLocal
    from app.services import auth_service

    email = f"qa-collections-{prefix}-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:8]}@example.com"
    async with AsyncSessionLocal() as db:
        user = await auth_service.create_user(db, email=email, name=f"QA collections {prefix}")
        if plan != getattr(user, "plan", "free"):
            user.plan = plan
            await db.commit()
            await db.refresh(user)
        return {"id": user.id, "email": user.email, "plan": user.plan}


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


async def run(args: argparse.Namespace) -> dict[str, Any]:
    owner = await create_user("owner", "pro")
    other = await create_user("other", "free")
    free_gate = await create_user("freegate", "free")
    owner_headers = {"Authorization": f"Bearer {token_for(owner['id'])}"}
    other_headers = {"Authorization": f"Bearer {token_for(other['id'])}"}
    free_headers = {"Authorization": f"Bearer {token_for(free_gate['id'])}"}
    report: dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "api_base": args.api_base,
        "users": {
            "owner": {"id": str(owner["id"]), "plan": owner["plan"]},
            "other": {"id": str(other["id"]), "plan": other["plan"]},
            "free_gate": {"id": str(free_gate["id"]), "plan": free_gate["plan"]},
        },
        "checks": [],
        "cleanup": "pending",
    }

    try:
        async with httpx.AsyncClient(base_url=args.api_base, timeout=60.0) as client:
            health = await client.get("/health")
            report["health"] = {"status_code": health.status_code, "body": safe_json(health)}
            health.raise_for_status()

            doc1 = await upload_and_wait(
                client,
                owner_headers,
                ROOT / "test_inputs/semiconductor.pdf",
                args.timeout,
                args.poll_interval,
            )
            doc2 = await upload_and_wait(
                client,
                owner_headers,
                ROOT / "test_inputs/盘中解读.pdf",
                args.timeout,
                args.poll_interval,
            )
            other_doc = await upload_and_wait(
                client,
                other_headers,
                ROOT / "test_inputs/semiconductor.pdf",
                args.timeout,
                args.poll_interval,
            )
            report["documents"] = {
                "owner_doc1": doc1,
                "owner_doc2": doc2,
                "other_doc": other_doc,
            }

            # Owner list starts empty.
            res = await client.get("/api/collections", headers=owner_headers)
            body = safe_json(res)
            report["checks"].append(check("owner_list_initial_empty", res.status_code, 200, body, extra={"empty": body == []}))

            # Create collection with one owned doc, one other-user doc, and an invalid UUID.
            create_payload = {
                "name": "QA collection matrix",
                "description": "Temporary collection workflow test",
                "document_ids": [doc1["document_id"], other_doc["document_id"], "not-a-uuid"],
            }
            res = await client.post("/api/collections", headers=owner_headers, json=create_payload)
            create_body = safe_json(res)
            collection_id = create_body.get("id")
            report["collection_id"] = collection_id
            report["checks"].append(check("owner_create_collection", res.status_code, 201, create_body))

            res = await client.get(f"/api/collections/{collection_id}", headers=owner_headers)
            detail = safe_json(res)
            report["checks"].append(
                check(
                    "owner_get_collection_initial_filters_foreign_docs",
                    res.status_code,
                    200,
                    compact_collection(detail),
                    extra={"document_count": len(detail.get("documents", [])) if isinstance(detail, dict) else None},
                    predicate=lambda: len(detail.get("documents", [])) == 1 and detail["documents"][0]["id"] == doc1["document_id"],
                )
            )

            # Add second owned doc, duplicate it, include other user's doc, and an invalid UUID.
            add_payload = {"document_ids": [doc2["document_id"], doc2["document_id"], other_doc["document_id"], "bad-id"]}
            res = await client.post(f"/api/collections/{collection_id}/documents", headers=owner_headers, json=add_payload)
            add_body = safe_json(res)
            report["checks"].append(
                check(
                    "owner_add_documents_dedupes_and_filters",
                    res.status_code,
                    201,
                    add_body,
                    predicate=lambda: add_body.get("added") == 1,
                )
            )

            res = await client.post(f"/api/collections/{collection_id}/documents", headers=owner_headers, json={"document_ids": [doc2["document_id"]]})
            dup_body = safe_json(res)
            report["checks"].append(
                check(
                    "owner_add_duplicate_is_noop",
                    res.status_code,
                    201,
                    dup_body,
                    predicate=lambda: dup_body.get("added") == 0,
                )
            )

            res = await client.get(f"/api/collections/{collection_id}", headers=owner_headers)
            detail = safe_json(res)
            report["checks"].append(
                check(
                    "owner_get_collection_after_add",
                    res.status_code,
                    200,
                    compact_collection(detail),
                    extra={"document_count": len(detail.get("documents", [])) if isinstance(detail, dict) else None},
                    predicate=lambda: sorted(d["id"] for d in detail.get("documents", [])) == sorted([doc1["document_id"], doc2["document_id"]]),
                )
            )

            res = await client.get("/api/collections", headers=owner_headers)
            list_body = safe_json(res)
            report["checks"].append(
                check(
                    "owner_list_collection_count",
                    res.status_code,
                    200,
                    compact_body(list_body),
                    predicate=lambda: len(list_body) == 1 and list_body[0].get("document_count") == 2,
                )
            )

            res = await client.post(f"/api/collections/{collection_id}/sessions", headers=owner_headers)
            session_body = safe_json(res)
            session_id = session_body.get("session_id")
            report["session_id"] = session_id
            report["checks"].append(check("owner_create_collection_session", res.status_code, 201, session_body))

            res = await client.get(f"/api/collections/{collection_id}/sessions", headers=owner_headers)
            sessions_body = safe_json(res)
            report["checks"].append(
                check(
                    "owner_list_collection_sessions",
                    res.status_code,
                    200,
                    compact_body(sessions_body),
                    predicate=lambda: len(sessions_body.get("sessions", [])) == 1 and sessions_body["sessions"][0]["session_id"] == session_id,
                )
            )

            res = await client.get(f"/api/sessions/{session_id}/messages", headers=owner_headers)
            messages_body = safe_json(res)
            report["checks"].append(
                check(
                    "owner_get_collection_session_messages",
                    res.status_code,
                    200,
                    messages_body,
                    predicate=lambda: messages_body.get("messages") == [],
                )
            )

            # Cross-user and anonymous boundaries.
            for name, method, url, headers, payload, expected in [
                ("other_get_collection", "GET", f"/api/collections/{collection_id}", other_headers, None, 404),
                ("other_add_documents", "POST", f"/api/collections/{collection_id}/documents", other_headers, {"document_ids": [other_doc["document_id"]]}, 404),
                ("other_remove_document", "DELETE", f"/api/collections/{collection_id}/documents/{doc1['document_id']}", other_headers, None, 404),
                ("other_create_collection_session", "POST", f"/api/collections/{collection_id}/sessions", other_headers, None, 404),
                ("other_list_collection_sessions", "GET", f"/api/collections/{collection_id}/sessions", other_headers, None, 404),
                ("other_get_collection_session_messages", "GET", f"/api/sessions/{session_id}/messages", other_headers, None, 404),
                ("other_delete_collection", "DELETE", f"/api/collections/{collection_id}", other_headers, None, 404),
                ("anon_list_collections", "GET", "/api/collections", None, None, 401),
                ("anon_get_collection", "GET", f"/api/collections/{collection_id}", None, None, 401),
                ("anon_get_collection_session_messages", "GET", f"/api/sessions/{session_id}/messages", None, None, 404),
            ]:
                res = await request(client, method, url, headers, payload)
                report["checks"].append(check(name, res.status_code, expected, safe_json(res)))

            # Remove doc1, then delete collection and verify sessions cascade.
            res = await client.delete(f"/api/collections/{collection_id}/documents/{doc1['document_id']}", headers=owner_headers)
            report["checks"].append(check("owner_remove_document", res.status_code, 204, {}))
            res = await client.get(f"/api/collections/{collection_id}", headers=owner_headers)
            detail_after_remove = safe_json(res)
            report["checks"].append(
                check(
                    "owner_get_collection_after_remove",
                    res.status_code,
                    200,
                    compact_collection(detail_after_remove),
                    predicate=lambda: [d["id"] for d in detail_after_remove.get("documents", [])] == [doc2["document_id"]],
                )
            )

            res = await client.delete(f"/api/collections/{collection_id}", headers=owner_headers)
            report["checks"].append(check("owner_delete_collection", res.status_code, 204, {}))
            res = await client.get(f"/api/collections/{collection_id}", headers=owner_headers)
            report["checks"].append(check("owner_get_deleted_collection", res.status_code, 404, safe_json(res)))
            res = await client.get(f"/api/sessions/{session_id}/messages", headers=owner_headers)
            report["checks"].append(check("collection_session_deleted_with_collection", res.status_code, 404, safe_json(res)))

            # Free plan collection limit.
            res = await client.post("/api/collections", headers=free_headers, json={"name": "Free gate one"})
            free_first = safe_json(res)
            report["free_gate_collection_id"] = free_first.get("id")
            report["checks"].append(check("free_create_first_collection", res.status_code, 201, free_first))
            res = await client.post("/api/collections", headers=free_headers, json={"name": "Free gate two"})
            free_second = safe_json(res)
            report["checks"].append(
                check(
                    "free_create_second_collection_limit",
                    res.status_code,
                    403,
                    free_second,
                    predicate=lambda: error_code(free_second) == "COLLECTION_LIMIT_REACHED",
                )
            )

            res = await client.post("/api/collections", headers=owner_headers, json={"name": ""})
            report["checks"].append(check("create_collection_empty_name_validation", res.status_code, 422, compact_body(safe_json(res))))

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
                await delete_users([owner["id"], other["id"], free_gate["id"]])
                report["cleanup"] = "deleted qa users and owned docs"
            except Exception as cleanup_exc:
                report["cleanup"] = f"failed: {type(cleanup_exc).__name__}: {cleanup_exc}"
        if args.json_out:
            out = Path(args.json_out)
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


async def upload_and_wait(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    path: Path,
    timeout: int,
    poll_interval: float,
) -> dict[str, Any]:
    data = path.read_bytes()
    started = time.monotonic()
    res = await client.post(
        "/api/documents/upload",
        headers=headers,
        files={"file": (path.name, data, "application/pdf")},
    )
    body = safe_json(res)
    res.raise_for_status()
    document_id = body["document_id"]
    final = await poll_ready(client, document_id, headers, timeout, poll_interval)
    return {
        "document_id": document_id,
        "filename": path.name,
        "upload_status": res.status_code,
        "ready_seconds": round(time.monotonic() - started, 3),
        "final": compact_doc(final["body"]),
        "polls": final["polls"],
    }


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


def check(
    name: str,
    actual_status: int,
    expected_status: int,
    body: Any,
    *,
    extra: dict[str, Any] | None = None,
    predicate=None,
) -> dict[str, Any]:
    ok = actual_status == expected_status
    if predicate is not None:
        try:
            ok = ok and bool(predicate())
        except Exception:
            ok = False
    result = {
        "name": name,
        "actual_status": actual_status,
        "expected_status": expected_status,
        "result": "pass" if ok else "fail",
        "body": compact_body(body),
    }
    if extra:
        result.update(extra)
    return result


def error_code(body: Any) -> str | None:
    if not isinstance(body, dict):
        return None
    detail = body.get("detail")
    if isinstance(detail, dict):
        return detail.get("error")
    if isinstance(body.get("error"), str):
        return body["error"]
    return None


def compact_doc(body: dict[str, Any]) -> dict[str, Any]:
    keys = ["id", "filename", "status", "page_count", "pages_parsed", "chunks_total", "chunks_indexed", "error_msg", "file_type"]
    return {k: body.get(k) for k in keys if k in body}


def compact_collection(body: Any) -> Any:
    if not isinstance(body, dict):
        return body
    return {
        "id": body.get("id"),
        "name": body.get("name"),
        "document_count": len(body.get("documents", []) or []),
        "documents": [
            {
                "id": d.get("id"),
                "filename": d.get("filename"),
                "status": d.get("status"),
                "file_type": d.get("file_type"),
            }
            for d in (body.get("documents") or [])
        ],
    }


def compact_body(body: Any) -> Any:
    text = json.dumps(body, ensure_ascii=False, default=str)
    if len(text) <= 1200:
        return body
    return {"truncated_json": text[:1200]}


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
    print(f"PASS: {len(report['checks'])} collection checks; cleanup={report['cleanup']}")


if __name__ == "__main__":
    main()
