import uuid

import pytest

# Minimal valid-ish single-page PDF bytes for testing upload
MINIMAL_PDF = (
    b"%PDF-1.0\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj "
    b"3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n"
    b"0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n"
    b"trailer<</Size 4/Root 1 0 R>>\nstartxref\n206\n%%EOF"
)


@pytest.mark.asyncio
async def test_health(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("status") == "ok"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_full_document_lifecycle(client):
    # 1) Upload PDF
    files = {"file": ("test.pdf", MINIMAL_PDF, "application/pdf")}
    resp = await client.post("/api/documents/upload", files=files)
    assert resp.status_code == 202
    payload = resp.json()
    assert "document_id" in payload
    document_id = payload["document_id"]

    # 2) Get document
    resp = await client.get(f"/api/documents/{document_id}")
    assert resp.status_code == 200

    # 3) Create chat session
    resp = await client.post(f"/api/documents/{document_id}/sessions")
    assert resp.status_code == 201
    session_payload = resp.json()
    assert "session_id" in session_payload
    session_id = session_payload["session_id"]
    # basic type check
    _ = uuid.UUID(session_id)

    # 4) Get session messages (should be empty list initially)
    resp = await client.get(f"/api/sessions/{session_id}/messages")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, dict)
    assert "messages" in data
    assert isinstance(data["messages"], list)

    # 5) Health check still OK
    resp = await client.get("/health")
    assert resp.status_code == 200
