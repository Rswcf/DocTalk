from __future__ import annotations

import pytest

from app.services.extractors import url_extractor


class _FakeResponse:
    def __init__(self, chunks: list[bytes], headers: dict[str, str] | None = None):
        self._chunks = chunks
        self.headers = headers or {}

    def iter_bytes(self):
        yield from self._chunks


def test_read_response_bytes_limited_raises_when_stream_exceeds_limit() -> None:
    response = _FakeResponse([b"hello", b"world!"])

    with pytest.raises(ValueError, match="URL_CONTENT_TOO_LARGE"):
        url_extractor._read_response_bytes_limited(response, max_content_size=10)


def test_read_response_bytes_limited_rejects_large_content_length_header() -> None:
    response = _FakeResponse([b"tiny"], headers={"content-length": "11"})

    with pytest.raises(ValueError, match="URL_CONTENT_TOO_LARGE"):
        url_extractor._read_response_bytes_limited(response, max_content_size=10)
