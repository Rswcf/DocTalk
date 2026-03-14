from __future__ import annotations

from types import SimpleNamespace

from app.workers import cleanup_tasks


def test_cleanup_uses_psycopg_driver(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class DummyTransaction:
        def __enter__(self):
            return SimpleNamespace(execute=lambda *_args, **_kwargs: SimpleNamespace(rowcount=0))

        def __exit__(self, exc_type, exc, tb):
            return False

    class DummyEngine:
        def begin(self):
            return DummyTransaction()

        def dispose(self):
            captured["disposed"] = True

    def fake_create_engine(url: str):
        captured["url"] = url
        return DummyEngine()

    monkeypatch.setattr(
        cleanup_tasks.settings,
        "DATABASE_URL",
        "postgresql+asyncpg://postgres:postgres@localhost:5432/postgres",
    )
    monkeypatch.setattr(cleanup_tasks.sa, "create_engine", fake_create_engine)

    cleanup_tasks.cleanup_expired_verification_tokens()

    assert captured["url"] == "postgresql+psycopg://postgres:postgres@localhost:5432/postgres"
    assert captured["disposed"] is True
