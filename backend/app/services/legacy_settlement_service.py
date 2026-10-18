"""Explicit, fingerprinted proof for the audited May 2026 billing protocol.

No time-only exemption. No ledger mutation. Unknown rows remain unresolved.
See docs/LEGACY-CREDIT-SETTLEMENT.md for the historical writer proof.
"""
from __future__ import annotations

import hashlib
import json
import os
import uuid
from datetime import datetime, timezone

import sqlalchemy as sa

from app.core.config import settings
from app.models.tables import (
    CreditLedger,
    Document,
    DocumentJob,
    ExtractionResult,
    LegacyCreditSettlement,
    RefundOperation,
    User,
)

PROTOCOL = "may-2026-settlement-proof-v1"
START = datetime(2026, 5, 6, tzinfo=timezone.utc)
END = datetime(2026, 5, 12, tzinfo=timezone.utc)
# Both ordinary and DOCUMENT_SUMMARY predebits. Continuations use ordinary.
CHAT_PREDEBITS = {"quick": {5, 10}, "balanced": {15, 30}}
SOURCES = [
    "de722b1a:backend/app/services/credit_service.py:38-43,177-208",
    "de722b1a:backend/app/services/chat_service.py:416-419,717-729,833-836",
    "43e9593b:backend/app/services/chat_service.py:742-747,1300-1303",
    "5ac4d833:backend/app/services/extraction_service.py:37,480-500,544-575",
    "5ac4d833:backend/app/api/extractions.py:205-228",
    "20260802_0035:existing rows deliberately retain NULL settlement marker",
]
FIELDS = (
    "id",
    "user_id",
    "delta",
    "balance_after",
    "reason",
    "ref_type",
    "ref_id",
    "created_at",
    "reconciled_at",
)


def digest(value):
    return hashlib.sha256(
        json.dumps(
            value, sort_keys=True, separators=(",", ":"), ensure_ascii=True
        ).encode()
    ).hexdigest()


def _time(value):
    if isinstance(value, str):
        value = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if value is None:
        return None
    if not isinstance(value, datetime):
        raise ValueError("invalid_timestamp")
    if value.tzinfo is None:
        raise ValueError("naive_timestamp")
    return value.astimezone(timezone.utc).isoformat()


def snapshot(row):
    values = {
        name: (row.get(name) if isinstance(row, dict) else getattr(row, name))
        for name in FIELDS
    }
    for name in ("delta", "balance_after"):
        if not isinstance(values[name], int) or isinstance(values[name], bool):
            raise ValueError("ledger_amount_not_integer")
    for name in ("reason", "ref_type", "ref_id"):
        if values[name] is not None and not isinstance(values[name], str):
            raise ValueError("ledger_label_not_string")
    for name in ("id", "user_id"):
        values[name] = str(uuid.UUID(str(values[name])))
    for name in ("created_at", "reconciled_at"):
        values[name] = _time(values[name])
    return values


def fingerprint(row):
    return digest(snapshot(row))


def prove_row(row, job=None, result=None):
    """Positive proof, restricted to an audited historical writer generation."""
    snap = snapshot(row)
    if snap["created_at"] is None:
        raise ValueError("missing_created_at")
    created = datetime.fromisoformat(snap["created_at"])
    if (
        not START <= created < END
        or snap["reconciled_at"] is not None
        or snap["delta"] >= 0
    ):
        raise ValueError("not_audited_legacy_unresolved_debit")
    if (
        snap["reason"] == "chat"
        and snap["ref_type"] == "mode"
        and snap["ref_id"] in CHAT_PREDEBITS
    ):
        possible = CHAT_PREDEBITS[snap["ref_id"]]
        if -snap["delta"] in possible:
            raise ValueError("could_be_original_chat_predebit")
        return {"kind": "changed_chat_predebit", "possible_predebits": sorted(possible)}
    if snap["reason"] == "extraction" and snap["ref_type"] == "document_job":
        if job is None or result is None:
            raise ValueError("missing_extraction_atomic_result")
        if (
            str(job.id) != snap["ref_id"]
            or str(job.user_id) != snap["user_id"]
            or job.job_type != "extraction"
            or job.status != "succeeded"
            or job.completed_at is None
            or job.cost_credits != -snap["delta"]
            or str((job.metadata_json or {}).get("predebit_ledger_id")) != snap["id"]
            or not isinstance((job.metadata_json or {}).get("pre_debited"), int)
            or not isinstance(job.cost_credits, int)
            or (job.metadata_json or {}).get("pre_debited") != 25
            or str(result.job_id) != str(job.id)
            or -snap["delta"] == 25
        ):
            raise ValueError("extraction_proof_mismatch")
        return {
            "kind": "atomic_extraction_result",
            "job_id": str(job.id),
            "result_id": str(result.id),
            "cost_credits": job.cost_credits,
            "completed_at": _time(job.completed_at),
            "pre_debited": 25,
        }
    raise ValueError("unsupported_legacy_writer")


async def build_manifest(db, user_id, ledger_ids):
    """Read-only report for explicit IDs. Never discovers a permissive population."""
    user_id = uuid.UUID(str(user_id))
    ids = [uuid.UUID(str(value)) for value in ledger_ids]
    if not ids or len(set(ids)) != len(ids):
        raise ValueError("empty_or_duplicate_ledger_ids")
    rows = list(
        (
            await db.scalars(
                sa.select(CreditLedger)
                .where(CreditLedger.user_id == user_id, CreditLedger.id.in_(ids))
                .execution_options(populate_existing=True)
            )
        ).all()
    )
    if len(rows) != len(ids):
        raise ValueError("ledger_scope_mismatch")
    entries = []
    for row in sorted(rows, key=lambda item: str(item.id)):
        job = result = None
        if row.ref_type == "document_job":
            try:
                job_id = uuid.UUID(row.ref_id)
            except (ValueError, TypeError):
                raise ValueError("invalid_job_reference") from None
            job = await db.get(DocumentJob, job_id)
            result = await db.scalar(
                sa.select(ExtractionResult).where(ExtractionResult.job_id == job_id)
            )
        evidence = prove_row(row, job, result)
        entries.append(
            {
                "ledger_id": str(row.id),
                "snapshot": snapshot(row),
                "fingerprint": fingerprint(row),
                "evidence": evidence,
            }
        )
    body = {
        "protocol": PROTOCOL,
        "user_id": str(user_id),
        "sources": SOURCES,
        "entries": entries,
    }
    return {**body, "manifest_sha256": digest(body)}


async def apply_manifest(db, manifest, reviewer):
    """Caller commits once; any error must roll back the entire transaction."""
    if os.environ.get("DOCTALK_LEGACY_SETTLEMENT_ADMIN") != "1":
        raise ValueError("legacy_settlement_admin_required")
    if settings.AUTO_REFUND_ENABLED or settings.AUTO_REFUND_PROVIDER_CREATES_ENABLED:
        raise ValueError("disable_refunds_before_attestation")
    if not reviewer or not reviewer.strip():
        raise ValueError("reviewer_required")
    body = {key: value for key, value in manifest.items() if key != "manifest_sha256"}
    if (
        manifest.get("manifest_sha256") != digest(body)
        or manifest.get("protocol") != PROTOCOL
        or manifest.get("sources") != SOURCES
    ):
        raise ValueError("manifest_integrity_mismatch")
    uid = uuid.UUID(manifest["user_id"])
    # Lock the pre-existing debits before the user, matching both reconciliation
    # and conditional predebit refund. No ledger may change between proof and
    # attestation. The ledger FK additionally protects a DELETE whose statement
    # snapshot predates this insertion; row locking alone cannot do that.
    ids = [uuid.UUID(entry["ledger_id"]) for entry in manifest["entries"]]
    if not ids or len(set(ids)) != len(ids):
        raise ValueError("empty_or_duplicate_ledger_ids")
    locked = list(
        (
            await db.scalars(
                sa.select(CreditLedger)
                .where(CreditLedger.user_id == uid, CreditLedger.id.in_(ids))
                .order_by(CreditLedger.id)
                .with_for_update()
                .execution_options(populate_existing=True)
            )
        ).all()
    )
    if len(locked) != len(ids):
        raise ValueError("ledger_scope_mismatch")
    user = await db.scalar(
        sa.select(User)
        .where(User.id == uid)
        .with_for_update(key_share=True)
        .execution_options(populate_existing=True)
    )
    if user is None or user.refund_reserved_credits or user.refund_delete_requested_at:
        raise ValueError("user_not_quiescent")
    if await db.scalar(
        sa.select(Document.id)
        .where(
            Document.user_id == uid,
            Document.status.in_(["parsing", "uploading", "processing"]),
        )
        .limit(1)
    ):
        raise ValueError("active_document")
    if await db.scalar(
        sa.select(DocumentJob.id)
        .where(
            DocumentJob.user_id == uid,
            DocumentJob.status.in_(["queued", "running", "pending"]),
        )
        .limit(1)
    ):
        raise ValueError("active_job")
    if await db.scalar(
        sa.select(RefundOperation.id)
        .where(
            RefundOperation.user_id == uid,
            RefundOperation.status.notin_(
                ["review", "cash_failed", "completed", "eligible"]
            ),
        )
        .limit(1)
    ):
        raise ValueError("active_refund")
    ids = [entry["ledger_id"] for entry in manifest["entries"]]
    fresh = await build_manifest(db, uid, ids)
    if fresh != manifest:
        raise ValueError("manifest_snapshot_changed")
    for entry in fresh["entries"]:
        lid = uuid.UUID(entry["ledger_id"])
        existing = await db.get(LegacyCreditSettlement, lid)
        if existing:
            if (
                existing.manifest_sha256 != fresh["manifest_sha256"]
                or existing.ledger_fingerprint != entry["fingerprint"]
                or existing.revoked_at is not None
            ):
                raise ValueError("attestation_conflict")
            continue
        db.add(
            LegacyCreditSettlement(
                ledger_id=lid,
                user_id=uid,
                protocol=PROTOCOL,
                ledger_fingerprint=entry["fingerprint"],
                ledger_snapshot=entry["snapshot"],
                evidence_json={"proof": entry["evidence"], "sources": SOURCES},
                manifest_sha256=fresh["manifest_sha256"],
                reviewed_by=reviewer.strip(),
            )
        )
    await db.flush()
    return len(ids)


async def attested_ledger_ids(db, rows):
    """An exact immutable snapshot is required on every eligibility recheck."""
    pending = {
        row.id: row for row in rows if row.delta < 0 and row.reconciled_at is None
    }
    if not pending:
        return set()
    attestations = (
        await db.scalars(
            sa.select(LegacyCreditSettlement).where(
                LegacyCreditSettlement.ledger_id.in_(pending)
            )
        )
    ).all()
    valid = set()
    for attestation in attestations:
        row = pending[attestation.ledger_id]
        if (
            attestation.user_id == row.user_id
            and attestation.protocol == PROTOCOL
            and attestation.revoked_at is None
            and attestation.reviewed_by
            and attestation.ledger_fingerprint == fingerprint(row)
            and attestation.ledger_snapshot == snapshot(row)
            and attestation.evidence_json.get("sources") == SOURCES
        ):
            # Also reject corrupted proof fields rather than trusting the row ID.
            proof = attestation.evidence_json.get("proof", {})
            if proof.get("kind") == "changed_chat_predebit":
                try:
                    if prove_row(row) != proof:
                        continue
                except ValueError:
                    continue
            elif proof.get("kind") == "atomic_extraction_result":
                try:
                    if (
                        row.reason != "extraction"
                        or row.ref_type != "document_job"
                        or str(uuid.UUID(proof["job_id"])) != row.ref_id
                        or not str(uuid.UUID(proof["result_id"]))
                        or not isinstance(proof["cost_credits"], int)
                        or isinstance(proof["cost_credits"], bool)
                        or proof["cost_credits"] != -row.delta
                        or not isinstance(proof["pre_debited"], int)
                        or isinstance(proof["pre_debited"], bool)
                        or proof["pre_debited"] != 25
                        or -row.delta == 25
                        or not _time(proof["completed_at"])
                        or not START <= row.created_at < END
                    ):
                        continue
                except (KeyError, ValueError, TypeError):
                    continue
            else:
                continue
            valid.add(row.id)
    return valid


def unresolved_predebit():
    """Shared SQL guard: an attested ID can NEVER be refunded as a predebit.

    Even a changed/revoked attestation fails eligibility closed but must not
    become permission to return already-spent credits a second time.
    """
    return sa.and_(
        CreditLedger.reconciled_at.is_(None),
        ~sa.exists(
            sa.select(LegacyCreditSettlement.ledger_id).where(
                LegacyCreditSettlement.ledger_id == CreditLedger.id
            )
        ).correlate(CreditLedger),
    )
