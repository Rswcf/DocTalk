#!/usr/bin/env python3
"""Run billing, credits, and plan-gate checks without real Stripe checkout or LLM calls."""

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
    parser = argparse.ArgumentParser(description="Run DocTalk billing/credits QA matrix.")
    parser.add_argument("--api-base", default="http://127.0.0.1:8000")
    parser.add_argument("--file", default="test_inputs/semiconductor.pdf")
    parser.add_argument("--timeout", type=int, default=180)
    parser.add_argument("--poll-interval", type=float, default=3.0)
    parser.add_argument("--json-out")
    parser.add_argument("--keep", action="store_true")
    return parser.parse_args()


async def create_user(prefix: str, plan: str = "free") -> dict[str, Any]:
    from app.models.database import AsyncSessionLocal
    from app.services import auth_service

    email = f"qa-billing-{prefix}-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:8]}@example.com"
    async with AsyncSessionLocal() as db:
        user = await auth_service.create_user(db, email=email, name=f"QA billing {prefix}")
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
            doc_ids = (await db.scalars(select(Document.id).where(Document.user_id == user_id))).all()
            for document_id in doc_ids:
                await doc_service.delete_document(document_id, db)
            user = await db.get(User, user_id)
            if user is not None:
                await db.delete(user)
        await db.commit()


async def set_credit_balance(user_id: uuid.UUID, balance: int) -> None:
    from app.models.database import AsyncSessionLocal
    from app.models.tables import User

    async with AsyncSessionLocal() as db:
        user = await db.get(User, user_id)
        if user is None:
            raise RuntimeError(f"User {user_id} not found")
        user.credits_balance = balance
        await db.commit()


async def insert_balanced_usage_records(user_id: uuid.UUID, count: int) -> None:
    from app.core.config import settings
    from app.models.database import AsyncSessionLocal
    from app.models.tables import UsageRecord

    model = settings.MODE_MODELS["balanced"]
    async with AsyncSessionLocal() as db:
        for _ in range(count):
            db.add(
                UsageRecord(
                    user_id=user_id,
                    message_id=None,
                    model=model,
                    prompt_tokens=1,
                    completion_tokens=1,
                    total_tokens=2,
                    cost_credits=1,
                )
            )
        await db.commit()


async def user_plan_and_transition_count(user_id: uuid.UUID) -> dict[str, Any]:
    from sqlalchemy import func, select

    from app.models.database import AsyncSessionLocal
    from app.models.tables import PlanTransition, User

    async with AsyncSessionLocal() as db:
        user = await db.get(User, user_id)
        transitions = await db.scalar(select(func.count()).select_from(PlanTransition).where(PlanTransition.user_id == user_id))
        return {
            "exists": user is not None,
            "plan": user.plan if user else None,
            "stripe_subscription_id": user.stripe_subscription_id if user else None,
            "transition_count": int(transitions or 0),
        }


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
    doc_limit_user = await create_user("doclimit", "free")
    session_user = await create_user("sessionlimit", "free")
    low_credit_user = await create_user("lowcredit", "plus")
    free_pro_user = await create_user("freepromode", "free")
    billing_user = await create_user("adminplus", "plus")
    users = [doc_limit_user, session_user, low_credit_user, free_pro_user, billing_user]
    headers = {u["email"]: {"Authorization": f"Bearer {token_for(u['id'])}"} for u in users}
    report: dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "api_base": args.api_base,
        "file": args.file,
        "users": {
            "doc_limit": {"id": str(doc_limit_user["id"]), "plan": doc_limit_user["plan"]},
            "session_limit": {"id": str(session_user["id"]), "plan": session_user["plan"]},
            "low_credit": {"id": str(low_credit_user["id"]), "plan": low_credit_user["plan"]},
            "free_pro_mode": {"id": str(free_pro_user["id"]), "plan": free_pro_user["plan"]},
            "billing": {"id": str(billing_user["id"]), "plan": billing_user["plan"]},
        },
        "checks": [],
        "cleanup": "pending",
    }

    try:
        async with httpx.AsyncClient(base_url=args.api_base, timeout=60.0) as client:
            health = await client.get("/health")
            report["health"] = {"status_code": health.status_code, "body": safe_json(health)}
            health.raise_for_status()

            res = await client.get("/api/billing/products")
            products_body = safe_json(res)
            report["checks"].append(
                check(
                    "billing_products_public",
                    res.status_code,
                    200,
                    products_body,
                    predicate=lambda: sorted(p.get("id") for p in products_body.get("products", [])) == ["boost", "power", "ultra"],
                )
            )
            for name, method, url in [
                ("anon_credit_balance_requires_auth", "GET", "/api/credits/balance"),
                ("anon_credit_history_requires_auth", "GET", "/api/credits/history"),
                ("anon_billing_cancel_requires_auth", "POST", "/api/billing/cancel"),
                ("anon_billing_portal_requires_auth", "POST", "/api/billing/portal"),
                ("anon_billing_subscribe_requires_auth", "POST", "/api/billing/subscribe"),
            ]:
                res = await client.request(method, url)
                report["checks"].append(check(name, res.status_code, 401, safe_json(res)))

            # Credit balance/history for a fresh signup.
            billing_headers = headers[billing_user["email"]]
            res = await client.get("/api/credits/balance", headers=billing_headers)
            balance_body = safe_json(res)
            report["checks"].append(
                check(
                    "credit_balance_signup_bonus",
                    res.status_code,
                    200,
                    balance_body,
                    predicate=lambda: balance_body.get("balance", 0) >= 500
                    and any(t.get("reason") == "signup_bonus" for t in balance_body.get("recent_transactions", [])),
                )
            )
            res = await client.get("/api/credits/history?limit=500&offset=-10", headers=billing_headers)
            history_body = safe_json(res)
            report["checks"].append(
                check(
                    "credit_history_bounds_and_signup_bonus",
                    res.status_code,
                    200,
                    compact_body(history_body),
                    predicate=lambda: history_body.get("total", 0) >= 1
                    and any(item.get("reason") == "signup_bonus" for item in history_body.get("items", []))
                    and len(history_body.get("items", [])) <= 100,
                )
            )

            # Admin-promoted Plus billing state and cancel path avoid real Stripe calls.
            res = await client.get("/api/users/profile", headers=billing_headers)
            profile_body = safe_json(res)
            billing_state = profile_body.get("billing_state") or {}
            report["checks"].append(
                check(
                    "billing_state_admin_promoted_plus",
                    res.status_code,
                    200,
                    compact_body(profile_body),
                    predicate=lambda: profile_body.get("plan") == "plus"
                    and billing_state.get("managed_by") == "admin"
                    and billing_state.get("can_cancel") is True,
                )
            )
            res = await client.post(
                "/api/billing/cancel",
                headers=billing_headers,
                json={"reason": "too_expensive", "feedback": "QA cancel path", "refund_requested": True},
            )
            cancel_body = safe_json(res)
            plan_after_cancel = await user_plan_and_transition_count(billing_user["id"])
            report["billing_plan_after_cancel"] = plan_after_cancel
            report["checks"].append(
                check(
                    "billing_cancel_admin_promoted_reverts_free",
                    res.status_code,
                    200,
                    cancel_body,
                    predicate=lambda: cancel_body.get("status") == "immediate_revert"
                    and cancel_body.get("refund_requested") is True
                    and plan_after_cancel.get("plan") == "free"
                    and plan_after_cancel.get("stripe_subscription_id") is None
                    and plan_after_cancel.get("transition_count", 0) >= 1,
                )
            )
            res = await client.post("/api/billing/cancel", headers=billing_headers)
            report["checks"].append(check("billing_cancel_free_rejected", res.status_code, 400, safe_json(res)))
            res = await client.post("/api/billing/portal", headers=billing_headers)
            report["checks"].append(check("billing_portal_no_customer", res.status_code, 400, safe_json(res)))
            res = await client.post("/api/billing/change-plan", headers=billing_headers, json={"plan": "pro", "billing": "monthly"})
            report["checks"].append(check("billing_change_plan_without_subscription", res.status_code, 400, safe_json(res)))

            # Free document-count limit.
            doc_limit_headers = headers[doc_limit_user["email"]]
            uploaded_doc_limit_docs = []
            for idx in range(3):
                doc = await upload_and_wait(client, doc_limit_headers, ROOT / args.file, args.timeout, args.poll_interval)
                uploaded_doc_limit_docs.append(doc)
                report["checks"].append(check(f"free_upload_document_{idx + 1}", doc["upload_status"], 202, doc))
            report["doc_limit_documents"] = uploaded_doc_limit_docs
            res = await upload_only(client, doc_limit_headers, ROOT / args.file)
            doc_limit_body = safe_json(res)
            report["checks"].append(
                check(
                    "free_upload_fourth_document_limit",
                    res.status_code,
                    403,
                    doc_limit_body,
                    predicate=lambda: error_code(doc_limit_body) == "DOCUMENT_LIMIT_REACHED",
                )
            )

            # Free session-count limit.
            session_headers = headers[session_user["email"]]
            session_doc = await upload_and_wait(client, session_headers, ROOT / args.file, args.timeout, args.poll_interval)
            report["session_limit_document"] = session_doc
            created_sessions = []
            for idx in range(3):
                res = await client.post(f"/api/documents/{session_doc['document_id']}/sessions", headers=session_headers)
                body = safe_json(res)
                created_sessions.append(body)
                report["checks"].append(check(f"free_create_session_{idx + 1}", res.status_code, 201, body))
            res = await client.post(f"/api/documents/{session_doc['document_id']}/sessions", headers=session_headers)
            session_limit_body = safe_json(res)
            report["checks"].append(
                check(
                    "free_create_fourth_session_limit",
                    res.status_code,
                    403,
                    session_limit_body,
                    predicate=lambda: error_code(session_limit_body) == "SESSION_LIMIT_REACHED",
                )
            )

            # Authenticated chat insufficient-credit precheck avoids LLM call.
            low_headers = headers[low_credit_user["email"]]
            low_doc = await upload_and_wait(client, low_headers, ROOT / args.file, args.timeout, args.poll_interval)
            res = await client.post(f"/api/documents/{low_doc['document_id']}/sessions", headers=low_headers)
            low_session = safe_json(res)
            await set_credit_balance(low_credit_user["id"], 0)
            res = await client.post(
                f"/api/sessions/{low_session['session_id']}/chat",
                headers=low_headers,
                json={"message": "This should be blocked before LLM.", "mode": "quick"},
            )
            low_chat_body = safe_json(res)
            report["checks"].append(
                check(
                    "chat_insufficient_credits_precheck",
                    res.status_code,
                    402,
                    low_chat_body,
                    predicate=lambda: error_code(low_chat_body) == "INSUFFICIENT_CREDITS"
                    and low_chat_body.get("detail", {}).get("balance") == 0,
                )
            )

            # Free Pro-mode monthly cap avoids LLM call.
            free_pro_headers = headers[free_pro_user["email"]]
            free_pro_doc = await upload_and_wait(client, free_pro_headers, ROOT / args.file, args.timeout, args.poll_interval)
            res = await client.post(f"/api/documents/{free_pro_doc['document_id']}/sessions", headers=free_pro_headers)
            free_pro_session = safe_json(res)
            await insert_balanced_usage_records(free_pro_user["id"], 20)
            res = await client.post(
                f"/api/sessions/{free_pro_session['session_id']}/chat",
                headers=free_pro_headers,
                json={"message": "This should hit the Free Pro-mode cap.", "mode": "balanced"},
            )
            pro_limit_body = safe_json(res)
            report["checks"].append(
                check(
                    "free_pro_mode_monthly_limit",
                    res.status_code,
                    402,
                    pro_limit_body,
                    predicate=lambda: error_code(pro_limit_body) == "PRO_MODE_LIMIT_REACHED"
                    and pro_limit_body.get("detail", {}).get("required_plan") == "plus",
                )
            )

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
                await delete_users([u["id"] for u in users])
                report["cleanup"] = "deleted qa users and owned docs"
            except Exception as cleanup_exc:
                report["cleanup"] = f"failed: {type(cleanup_exc).__name__}: {cleanup_exc}"
        if args.json_out:
            out = Path(args.json_out)
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


async def upload_only(client: httpx.AsyncClient, headers: dict[str, str], path: Path) -> httpx.Response:
    data = path.read_bytes()
    return await client.post(
        "/api/documents/upload",
        headers=headers,
        files={"file": (path.name, data, "application/pdf")},
    )


async def upload_and_wait(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    path: Path,
    timeout: int,
    poll_interval: float,
) -> dict[str, Any]:
    started = time.monotonic()
    res = await upload_only(client, headers, path)
    body = safe_json(res)
    if res.status_code != 202:
        return {"upload_status": res.status_code, "body": body}
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
    print(f"PASS: {len(report['checks'])} billing/credits checks; cleanup={report['cleanup']}")


if __name__ == "__main__":
    main()
