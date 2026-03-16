import json
import uuid
from pathlib import Path

import pytest

from app.core.version import get_build_identifier

pytestmark = pytest.mark.asyncio(loop_scope="session")

# Minimal valid-ish single-page PDF bytes for testing upload
MINIMAL_PDF = (
    b"%PDF-1.0\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj "
    b"3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n"
    b"0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n"
    b"trailer<</Size 4/Root 1 0 R>>\nstartxref\n206\n%%EOF"
)


async def test_health(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("status") == "ok"
    assert data["release"]["version"] == _version_config()["version"]
    assert data["release"]["stage"] == _version_config()["stage"]


async def test_health_deep_requires_auth(client):
    """H4: /health?deep=true without secret header returns 403."""
    resp = await client.get("/health?deep=true")
    assert resp.status_code == 403


async def test_health_deep_with_valid_secret(client):
    """H4: /health?deep=true with correct X-Health-Secret returns 200."""
    resp = await client.get(
        "/health?deep=true",
        headers={"X-Health-Secret": "test-adapter-secret"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] in ("ok", "degraded")
    assert "components" in data


async def test_version_endpoint(client):
    resp = await client.get("/version")
    assert resp.status_code == 200
    assert resp.json() == {
        "version": _version_config()["version"],
        "stage": _version_config()["stage"],
        "build": get_build_identifier(),
    }


@pytest.mark.integration
async def test_full_document_lifecycle(client, auth_headers):
    # 1) Upload PDF
    files = {"file": ("test.pdf", MINIMAL_PDF, "application/pdf")}
    resp = await client.post("/api/documents/upload", files=files, headers=auth_headers)
    assert resp.status_code == 202
    payload = resp.json()
    assert "document_id" in payload
    document_id = payload["document_id"]

    # 2) Get document
    resp = await client.get(f"/api/documents/{document_id}", headers=auth_headers)
    assert resp.status_code == 200

    # 3) Create chat session
    resp = await client.post(f"/api/documents/{document_id}/sessions", headers=auth_headers)
    assert resp.status_code == 201
    session_payload = resp.json()
    assert "session_id" in session_payload
    session_id = session_payload["session_id"]
    # basic type check
    _ = uuid.UUID(session_id)

    # 4) Get session messages (should be empty list initially)
    resp = await client.get(f"/api/sessions/{session_id}/messages", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, dict)
    assert "messages" in data
    assert isinstance(data["messages"], list)

    # 5) Health check still OK
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["release"]["version"] == _version_config()["version"]


def _version_config() -> dict[str, str]:
    return json.loads((Path(__file__).resolve().parents[2] / "version.json").read_text(encoding="utf-8"))
