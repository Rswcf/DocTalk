#!/usr/bin/env python3
"""Run document-diff API, artifact, export, and boundary checks without LLM execution."""

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
    parser = argparse.ArgumentParser(description="Run DocTalk document-diff QA matrix.")
    parser.add_argument("--api-base", default="http://127.0.0.1:8000")
    parser.add_argument("--timeout", type=int, default=180)
    parser.add_argument("--poll-interval", type=float, default=3.0)
    parser.add_argument("--json-out")
    parser.add_argument("--keep", action="store_true")
    return parser.parse_args()


async def create_user(prefix: str, plan: str) -> dict[str, Any]:
    from app.models.database import AsyncSessionLocal
    from app.services import auth_service

    email = f"qa-diff-{prefix}-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:8]}@example.com"
    async with AsyncSessionLocal() as db:
        user = await auth_service.create_user(db, email=email, name=f"QA diff {prefix}")
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


async def insert_completed_diff_job(
    *,
    user_id: uuid.UUID,
    old_doc_id: str,
    old_filename: str,
    new_doc_id: str,
    new_filename: str,
    collection_id: str,
) -> str:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import DocumentJob, ExtractionResult
    from app.services.document_diff_service import (
        DOCUMENT_DIFF_JOB_TYPE,
        DOCUMENT_DIFF_RESULT_KEY,
    )

    now = datetime.now(timezone.utc)
    structured = {
        "old_document": {"id": old_doc_id, "filename": old_filename},
        "new_document": {"id": new_doc_id, "filename": new_filename},
        "summary": "The new document adds a QA-only comparison point.",
        "changes": [
            {
                "kind": "added",
                "title": "QA comparison point",
                "detail": "The new document includes a synthetic comparison change for export validation.",
                "old_refs": [],
                "new_refs": [1],
            }
        ],
    }
    markdown = (
        "# Document Diff\n\n"
        f"**Old:** {old_filename}\n"
        f"**New:** {new_filename}\n\n"
        "## Summary\n"
        "The new document adds a QA-only comparison point.\n\n"
        "## Added\n"
        "- **QA comparison point**: The new document includes a synthetic comparison change for export validation. [N1]\n"
    )
    citations = [
        {
            "ref_index": 1,
            "side": "new",
            "label": "N1",
            "document_id": new_doc_id,
            "document_filename": new_filename,
            "page": 1,
            "text_snippet": "synthetic comparison change",
            "bboxes": [{"x": 0.1, "y": 0.2, "w": 0.3, "h": 0.1, "page": 1}],
            "confidence_score": 0.88,
        }
    ]
    async with AsyncSessionLocal() as db:
        job = DocumentJob(
            user_id=user_id,
            document_id=uuid.UUID(new_doc_id),
            collection_id=uuid.UUID(collection_id),
            job_type=DOCUMENT_DIFF_JOB_TYPE,
            status="succeeded",
            input_scope={
                "old_document_id": old_doc_id,
                "old_document_filename": old_filename,
                "new_document_id": new_doc_id,
                "new_document_filename": new_filename,
                "locale": "en",
            },
            cost_credits=12,
            metadata_json={"qa_synthetic": True},
            completed_at=now,
        )
        db.add(job)
        await db.flush()
        db.add(
            ExtractionResult(
                job_id=job.id,
                template_key=DOCUMENT_DIFF_RESULT_KEY,
                structured_json=structured,
                rendered_markdown=markdown,
                citations=citations,
            )
        )
        await db.commit()
        await db.refresh(job)
        return str(job.id)


async def run(args: argparse.Namespace) -> dict[str, Any]:
    pro_user = await create_user("pro", "pro")
    plus_user = await create_user("plus", "plus")
    other_user = await create_user("other", "free")
    pro_headers = {"Authorization": f"Bearer {token_for(pro_user['id'])}"}
    plus_headers = {"Authorization": f"Bearer {token_for(plus_user['id'])}"}
    other_headers = {"Authorization": f"Bearer {token_for(other_user['id'])}"}
    report: dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "api_base": args.api_base,
        "users": {
            "pro": {"id": str(pro_user["id"]), "plan": pro_user["plan"]},
            "plus": {"id": str(plus_user["id"]), "plan": plus_user["plan"]},
            "other": {"id": str(other_user["id"]), "plan": other_user["plan"]},
        },
        "checks": [],
        "cleanup": "pending",
    }

    try:
        async with httpx.AsyncClient(base_url=args.api_base, timeout=60.0) as client:
            health = await client.get("/health")
            report["health"] = {"status_code": health.status_code, "body": safe_json(health)}
            health.raise_for_status()

            old_doc = await upload_and_wait(
                client,
                pro_headers,
                ROOT / "test_inputs/semiconductor.pdf",
                args.timeout,
                args.poll_interval,
            )
            new_doc = await upload_and_wait(
                client,
                pro_headers,
                ROOT / "test_inputs/盘中解读.pdf",
                args.timeout,
                args.poll_interval,
            )
            report["documents"] = {"old_doc": old_doc, "new_doc": new_doc}

            # Plan, same-doc, missing-doc, and anonymous gates.
            diff_payload = {"old_document_id": old_doc["document_id"], "new_document_id": new_doc["document_id"]}
            res = await client.post("/api/document-diffs", headers=plus_headers, json=diff_payload)
            report["checks"].append(
                check(
                    "plus_create_diff_requires_pro",
                    res.status_code,
                    403,
                    safe_json(res),
                    predicate=lambda body=safe_json(res): error_code(body) == "PLAN_REQUIRED",
                )
            )
            res = await client.post(
                "/api/document-diffs",
                headers=pro_headers,
                json={"old_document_id": old_doc["document_id"], "new_document_id": old_doc["document_id"]},
            )
            report["checks"].append(
                check(
                    "pro_create_diff_same_document",
                    res.status_code,
                    400,
                    safe_json(res),
                    predicate=lambda body=safe_json(res): error_code(body) == "DOCUMENT_DIFF_SAME_DOCUMENT",
                )
            )
            res = await client.post(
                "/api/document-diffs",
                headers=pro_headers,
                json={"old_document_id": str(uuid.uuid4()), "new_document_id": new_doc["document_id"]},
            )
            report["checks"].append(check("pro_create_diff_missing_document", res.status_code, 404, safe_json(res)))
            res = await client.post("/api/document-diffs", json=diff_payload)
            report["checks"].append(check("anon_create_diff_requires_auth", res.status_code, 401, safe_json(res)))

            # Collection membership mismatch, then valid collection membership for synthetic job.
            res = await client.post(
                "/api/collections",
                headers=pro_headers,
                json={"name": "QA diff collection", "document_ids": [old_doc["document_id"]]},
            )
            collection_body = safe_json(res)
            collection_id = collection_body.get("id")
            report["collection_id"] = collection_id
            report["checks"].append(check("pro_create_diff_collection_fixture", res.status_code, 201, collection_body))

            res = await client.post(
                "/api/document-diffs",
                headers=pro_headers,
                json={**diff_payload, "collection_id": collection_id},
            )
            mismatch_body = safe_json(res)
            report["checks"].append(
                check(
                    "pro_create_diff_collection_mismatch",
                    res.status_code,
                    400,
                    mismatch_body,
                    predicate=lambda: error_code(mismatch_body) == "DOCUMENT_DIFF_COLLECTION_MISMATCH",
                )
            )

            res = await client.post(
                f"/api/collections/{collection_id}/documents",
                headers=pro_headers,
                json={"document_ids": [new_doc["document_id"]]},
            )
            report["checks"].append(
                check(
                    "pro_add_new_doc_to_diff_collection",
                    res.status_code,
                    201,
                    safe_json(res),
                    predicate=lambda body=safe_json(res): body.get("added") == 1,
                )
            )

            job_id = await insert_completed_diff_job(
                user_id=pro_user["id"],
                old_doc_id=old_doc["document_id"],
                old_filename=old_doc["filename"],
                new_doc_id=new_doc["document_id"],
                new_filename=new_doc["filename"],
                collection_id=collection_id,
            )
            report["synthetic_job_id"] = job_id

            res = await client.get("/api/document-diffs", headers=pro_headers)
            list_body = safe_json(res)
            report["checks"].append(
                check(
                    "pro_list_document_diffs",
                    res.status_code,
                    200,
                    compact_body(list_body),
                    predicate=lambda: any(item.get("id") == job_id and item.get("result") for item in list_body),
                )
            )
            res = await client.get(f"/api/document-diffs?collection_id={collection_id}", headers=pro_headers)
            filtered_body = safe_json(res)
            report["checks"].append(
                check(
                    "pro_list_document_diffs_by_collection",
                    res.status_code,
                    200,
                    compact_body(filtered_body),
                    predicate=lambda: len(filtered_body) == 1 and filtered_body[0].get("id") == job_id,
                )
            )
            res = await client.get(f"/api/document-diffs/{job_id}", headers=pro_headers)
            get_body = safe_json(res)
            report["checks"].append(
                check(
                    "pro_get_document_diff",
                    res.status_code,
                    200,
                    compact_body(get_body),
                    predicate=lambda: get_body.get("status") == "succeeded" and bool(get_body.get("result")),
                )
            )
            res = await client.get(f"/api/document-jobs/{job_id}", headers=pro_headers)
            artifact_body = safe_json(res)
            report["checks"].append(
                check(
                    "pro_get_document_job_artifact",
                    res.status_code,
                    200,
                    compact_body(artifact_body),
                    predicate=lambda: (artifact_body.get("artifact") or {}).get("artifact_type") == "document_diff"
                    and len((artifact_body.get("artifact") or {}).get("download_urls") or []) == 2,
                )
            )

            for fmt in ("md", "csv"):
                res = await client.get(f"/api/document-diffs/{job_id}/export?format={fmt}", headers=pro_headers)
                report["checks"].append(export_check(f"pro_export_document_diff_{fmt}", res, fmt))

            # Ownership and anonymous boundaries.
            for name, url in [
                ("other_get_document_diff", f"/api/document-diffs/{job_id}"),
                ("other_get_document_job", f"/api/document-jobs/{job_id}"),
                ("other_export_document_diff", f"/api/document-diffs/{job_id}/export?format=md"),
            ]:
                res = await client.get(url, headers=other_headers)
                report["checks"].append(check(name, res.status_code, 404, safe_json(res)))
            for name, url in [
                ("anon_list_document_diffs", "/api/document-diffs"),
                ("anon_get_document_diff", f"/api/document-diffs/{job_id}"),
                ("anon_get_document_job", f"/api/document-jobs/{job_id}"),
                ("anon_export_document_diff", f"/api/document-diffs/{job_id}/export?format=md"),
            ]:
                res = await client.get(url)
                report["checks"].append(check(name, res.status_code, 401, safe_json(res)))

            res = await client.get(f"/api/document-diffs/{job_id}/export?format=pdf", headers=pro_headers)
            report["checks"].append(check("document_diff_export_invalid_format", res.status_code, 422, compact_body(safe_json(res))))
            res = await client.get(f"/api/document-diffs/{uuid.uuid4()}", headers=pro_headers)
            report["checks"].append(check("pro_get_missing_document_diff", res.status_code, 404, safe_json(res)))

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
                await delete_users([pro_user["id"], plus_user["id"], other_user["id"]])
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
    started = time.monotonic()
    data = path.read_bytes()
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


def export_check(name: str, response: httpx.Response, fmt: str) -> dict[str, Any]:
    body = response.content
    headers = {
        "content_type": response.headers.get("content-type"),
        "content_disposition": response.headers.get("content-disposition"),
        "content_length": len(body),
    }
    def ok() -> bool:
        if response.status_code != 200:
            return False
        cd = headers["content_disposition"] or ""
        if "\r" in cd or "\n" in cd or "filename=" not in cd or "filename*=" not in cd:
            return False
        if fmt == "md":
            text = body.decode("utf-8", errors="replace")
            return "text/markdown" in (headers["content_type"] or "") and "# Document Diff" in text and "QA comparison point" in text
        if fmt == "csv":
            text = body.decode("utf-8-sig", errors="replace")
            return "text/csv" in (headers["content_type"] or "") and "kind,title,detail,old_refs,new_refs" in text and "QA comparison point" in text
        return False
    return {
        "name": name,
        "actual_status": response.status_code,
        "expected_status": 200,
        "result": "pass" if ok() else "fail",
        "headers": headers,
        "body_preview": body[:500].decode("utf-8", errors="replace") if fmt in {"md", "csv"} else None,
    }


def check(
    name: str,
    actual_status: int,
    expected_status: int,
    body: Any,
    *,
    predicate=None,
) -> dict[str, Any]:
    ok = actual_status == expected_status
    if predicate is not None:
        try:
            ok = ok and bool(predicate())
        except Exception:
            ok = False
    return {
        "name": name,
        "actual_status": actual_status,
        "expected_status": expected_status,
        "result": "pass" if ok else "fail",
        "body": compact_body(body),
    }


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
    print(f"PASS: {len(report['checks'])} document-diff checks; cleanup={report['cleanup']}")


if __name__ == "__main__":
    main()
