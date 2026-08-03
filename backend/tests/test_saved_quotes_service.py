"""Tests for saved_quotes_service (M3-B2, plan D8 amended by §8.5 M3 / §8.4
point 2). Mocked-db unit tests mirror biblio_service's own test style
(SELECT-then-INSERT + IntegrityError-retry precedent); the real-Postgres
race/cap-under-concurrency proof lives in
test_saved_quotes_integration.py.
"""
from __future__ import annotations

import sys
import uuid
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from sqlalchemy.exc import IntegrityError

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import settings  # noqa: E402
from app.services import saved_quotes_service as sqs  # noqa: E402
from app.services.quote_search_service import QuoteCard  # noqa: E402


def _card(**overrides) -> QuoteCard:
    base = dict(
        display_text="the exact quoted sentence",
        page=4, page_end=4, bboxes=[{"x": 0.1, "y": 0.2, "w": 0.3, "h": 0.05, "page": 4}],
        tier="exact", source_kind="extracted_text", chunk_id=str(uuid.uuid4()), score=100.0,
    )
    base.update(overrides)
    return QuoteCard(**base)


class _ScalarResult:
    def __init__(self, value=None, values=None):
        self._value = value
        self._values = values if values is not None else ([] if value is None else [value])

    def scalar_one_or_none(self):
        return self._value

    def scalar(self):
        return self._value

    def scalars(self):
        return SimpleNamespace(all=lambda: self._values)


class TestSavedQuotesLimitForPlan:
    def test_free_plan_uses_free_limit(self) -> None:
        assert sqs.saved_quotes_limit_for_plan("free") == settings.FREE_SAVED_QUOTES_LIMIT

    def test_plus_plan_uses_plus_limit(self) -> None:
        assert sqs.saved_quotes_limit_for_plan("plus") == settings.PLUS_SAVED_QUOTES_LIMIT

    def test_pro_plan_uses_pro_limit(self) -> None:
        assert sqs.saved_quotes_limit_for_plan("pro") == settings.PRO_SAVED_QUOTES_LIMIT

    def test_missing_or_unknown_plan_defaults_to_free(self) -> None:
        assert sqs.saved_quotes_limit_for_plan(None) == settings.FREE_SAVED_QUOTES_LIMIT
        assert sqs.saved_quotes_limit_for_plan("enterprise") == settings.FREE_SAVED_QUOTES_LIMIT

    def test_case_insensitive(self) -> None:
        assert sqs.saved_quotes_limit_for_plan("PRO") == settings.PRO_SAVED_QUOTES_LIMIT


class TestComputeQuoteHash:
    def test_deterministic_for_the_same_inputs(self) -> None:
        h1 = sqs.compute_quote_hash("Hello world.", 3, 3)
        h2 = sqs.compute_quote_hash("Hello world.", 3, 3)
        assert h1 == h2

    def test_normalizes_whitespace_and_quote_variants(self) -> None:
        """§8.1's dedup philosophy: two honest saves of the "same" wording
        that differ only in incidental formatting (smart quotes, extra
        whitespace) must collide, or the unique constraint silently stops
        protecting against duplicate saves."""
        h1 = sqs.compute_quote_hash("“Hello   world.”", 3, 3)
        h2 = sqs.compute_quote_hash('"Hello world."', 3, 3)
        assert h1 == h2

    def test_different_page_range_changes_the_hash(self) -> None:
        """A client cannot dodge the unique constraint by claiming a fake
        page for identical text, NOR can the same real text on two
        genuinely different pages ever incorrectly collide."""
        h1 = sqs.compute_quote_hash("Hello world.", 3, 3)
        h2 = sqs.compute_quote_hash("Hello world.", 4, 4)
        assert h1 != h2

    def test_different_text_changes_the_hash(self) -> None:
        h1 = sqs.compute_quote_hash("Hello world.", 3, 3)
        h2 = sqs.compute_quote_hash("Goodbye world.", 3, 3)
        assert h1 != h2


class TestSaveQuoteIdempotency:
    @pytest.mark.asyncio
    async def test_first_save_inserts_a_new_row(self) -> None:
        user = SimpleNamespace(id=uuid.uuid4())
        document = SimpleNamespace(id=uuid.uuid4())
        db = SimpleNamespace(
            execute=AsyncMock(return_value=_ScalarResult(None)),
            add=lambda _obj: None,
            commit=AsyncMock(),
            rollback=AsyncMock(),
        )

        row, created = await sqs.save_quote(db, user=user, document=document, card=_card())

        assert created is True
        assert row.user_id == user.id
        assert row.document_id == document.id
        assert row.verification_tier == "exact"
        assert row.verification_score == 100.0
        assert row.verifier_version == sqs.QUOTE_VERIFIER_VERSION
        assert row.source_kind == "extracted_text"
        db.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_repeat_save_of_the_identical_quote_returns_existing_row_not_a_new_one(self) -> None:
        """The idempotent-hit path must short-circuit BEFORE ever touching
        db.add/commit — this is the "returns 200 not 409" contract from the
        API layer's perspective."""
        user = SimpleNamespace(id=uuid.uuid4())
        document = SimpleNamespace(id=uuid.uuid4())
        existing_row = SimpleNamespace(id=uuid.uuid4())
        db = SimpleNamespace(
            execute=AsyncMock(return_value=_ScalarResult(existing_row)),
            add=AsyncMock(side_effect=AssertionError("must not insert on an idempotent hit")),
            commit=AsyncMock(),
            rollback=AsyncMock(),
        )

        row, created = await sqs.save_quote(db, user=user, document=document, card=_card())

        assert created is False
        assert row is existing_row
        db.commit.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_concurrent_identical_save_recovers_via_integrity_error_retry(
        self, monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Mirrors biblio_service's FIX-9 precedent: two concurrent identical
        saves can both SELECT None then both attempt INSERT — the loser's
        commit raises IntegrityError (the unique index), and it must
        recover by re-fetching the winner's row, not raise or 500.

        UNLIKE biblio_service's byte-for-byte pattern, the retry query runs
        on a FRESH AsyncSessionLocal() session, not the just-rolled-back
        `db` — discovered via real-Postgres asyncio.gather concurrency
        testing (test_saved_quotes_integration.py) that reusing a
        NullPool-backed session for a new query immediately after a
        rollback races with SQLAlchemy's async/greenlet connection-checkout
        machinery under true concurrent load (reproduced standalone outside
        pytest too; a production QueuePool-backed engine did not exhibit
        this). A fresh session sidesteps it unconditionally and matches the
        independent-session-for-post-failure-resolution pattern already
        used by the billing resolvers in chat_service.py / quotes.py."""
        user = SimpleNamespace(id=uuid.uuid4())
        document = SimpleNamespace(id=uuid.uuid4())
        winner_row = SimpleNamespace(id=uuid.uuid4())
        db = SimpleNamespace(
            execute=AsyncMock(return_value=_ScalarResult(None)),
            add=lambda _obj: None,
            commit=AsyncMock(side_effect=IntegrityError("stmt", {}, Exception("unique violation"))),
            rollback=AsyncMock(),
        )

        class _FakeRetrySession:
            async def __aenter__(self_inner):
                return SimpleNamespace(execute=AsyncMock(return_value=_ScalarResult(winner_row)))

            async def __aexit__(self_inner, *exc):
                return False

        monkeypatch.setattr(sqs, "AsyncSessionLocal", lambda: _FakeRetrySession())

        row, created = await sqs.save_quote(db, user=user, document=document, card=_card())

        assert created is False
        assert row is winner_row
        db.rollback.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_integrity_error_with_no_recoverable_winner_reraises(
        self, monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Not the race we anticipated (a genuine constraint violation
        elsewhere) — must surface, never swallow silently."""
        user = SimpleNamespace(id=uuid.uuid4())
        document = SimpleNamespace(id=uuid.uuid4())
        db = SimpleNamespace(
            execute=AsyncMock(return_value=_ScalarResult(None)),
            add=lambda _obj: None,
            commit=AsyncMock(side_effect=IntegrityError("stmt", {}, Exception("boom"))),
            rollback=AsyncMock(),
        )

        class _FakeRetrySession:
            async def __aenter__(self_inner):
                return SimpleNamespace(execute=AsyncMock(return_value=_ScalarResult(None)))

            async def __aexit__(self_inner, *exc):
                return False

        monkeypatch.setattr(sqs, "AsyncSessionLocal", lambda: _FakeRetrySession())

        with pytest.raises(IntegrityError):
            await sqs.save_quote(db, user=user, document=document, card=_card())


class TestCountActiveSavedQuotes:
    @pytest.mark.asyncio
    async def test_counts_rows_for_the_user_across_documents(self) -> None:
        db = SimpleNamespace(execute=AsyncMock(return_value=_ScalarResult(7)))
        count = await sqs.count_active_saved_quotes(db, uuid.uuid4())
        assert count == 7

    @pytest.mark.asyncio
    async def test_none_scalar_treated_as_zero(self) -> None:
        db = SimpleNamespace(execute=AsyncMock(return_value=_ScalarResult(None)))
        count = await sqs.count_active_saved_quotes(db, uuid.uuid4())
        assert count == 0


class TestGetOwnedSavedQuote:
    @pytest.mark.asyncio
    async def test_ownership_is_baked_into_the_query_not_checked_after(self) -> None:
        """A saved quote belonging to a different user must come back as
        None (uniform 404), never leak existence via a different error
        shape."""
        user_id = uuid.uuid4()
        db = SimpleNamespace(execute=AsyncMock(return_value=_ScalarResult(None)))
        result = await sqs.get_owned_saved_quote(db, user_id=user_id, saved_quote_id=uuid.uuid4())
        assert result is None


class TestUpdateNoteAndDelete:
    @pytest.mark.asyncio
    async def test_update_note_sets_note_and_commits(self) -> None:
        row = SimpleNamespace(note=None)
        db = SimpleNamespace(commit=AsyncMock(), refresh=AsyncMock())
        result = await sqs.update_note(db, row=row, note="cite this in intro")
        assert result.note == "cite this in intro"
        db.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_update_note_refreshes_after_commit(self) -> None:
        """Live E2E bug (2026-08-03): PATCH 500'd with MissingGreenlet
        because `updated_at` (onupdate=sa.func.now()) gets marked EXPIRED
        after the UPDATE flush and was read synchronously afterward
        (quotes.py's _saved_quote_response) outside an awaited context.
        db.refresh(row) must run, and must run AFTER commit (refreshing
        before the UPDATE has landed would be pointless) and on the SAME
        row instance, so every attribute is safely in-memory before any
        caller touches it."""
        row = SimpleNamespace(note=None)
        calls: list[str] = []
        db = SimpleNamespace(
            commit=AsyncMock(side_effect=lambda: calls.append("commit")),
            refresh=AsyncMock(side_effect=lambda _row: calls.append("refresh")),
        )
        result = await sqs.update_note(db, row=row, note="x")
        assert calls == ["commit", "refresh"]
        db.refresh.assert_awaited_once_with(row)
        assert result is row

    @pytest.mark.asyncio
    async def test_delete_removes_row_and_commits(self) -> None:
        row = SimpleNamespace()
        db = SimpleNamespace(delete=AsyncMock(), commit=AsyncMock())
        await sqs.delete_saved_quote(db, row=row)
        db.delete.assert_awaited_once_with(row)
        db.commit.assert_awaited_once()
