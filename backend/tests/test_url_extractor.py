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


def test_fetch_and_extract_url_preserves_article_structure(monkeypatch: pytest.MonkeyPatch) -> None:
    html = b"""
    <html>
      <head>
        <title>Fallback title</title>
        <meta property="og:title" content="Great Article">
      </head>
      <body>
        <nav>Navigation should disappear</nav>
        <article>
          <h1>Great Article</h1>
          <div class="share">Share this article</div>
          <div>
            <p>First paragraph with useful context.</p>
          </div>
          <ul>
            <li>First point</li>
            <li>Second point</li>
          </ul>
          <h2>Details</h2>
          <p>More evidence in a second section.</p>
        </article>
      </body>
    </html>
    """

    def _fake_fetch(url: str):
        return url, "text/html; charset=utf-8", "utf-8", html

    monkeypatch.setattr(url_extractor, "_fetch_with_safe_redirects", _fake_fetch)

    title, pages, pdf_bytes = url_extractor.fetch_and_extract_url("https://example.com/article")
    content = "\n\n".join(page.text for page in pages)

    assert pdf_bytes is None
    assert title == "Great Article"
    assert "# Great Article" in content
    assert "First paragraph with useful context." in content
    assert "- First point" in content
    assert "## Details" in content
    assert "Navigation should disappear" not in content
    assert "Share this article" not in content
    assert content.count("First paragraph with useful context.") == 1


def test_fetch_and_extract_url_rejects_image_only_title_page(monkeypatch: pytest.MonkeyPatch) -> None:
    html = b"""
    <html>
      <head><title>Image Only Landing</title></head>
      <body>
        <main>
          <img src="/chart.png" alt="Quarterly chart">
        </main>
      </body>
    </html>
    """

    def _fake_fetch(url: str):
        return url, "text/html; charset=utf-8", "utf-8", html

    monkeypatch.setattr(url_extractor, "_fetch_with_safe_redirects", _fake_fetch)

    with pytest.raises(ValueError, match="NO_TEXT_CONTENT"):
        url_extractor.fetch_and_extract_url("https://example.com/image-only")
