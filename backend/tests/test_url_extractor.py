from __future__ import annotations

from contextlib import nullcontext

import pytest

from app.services.extractors import url_extractor


class _FakeResponse:
    def __init__(self, chunks: list[bytes], headers: dict[str, str] | None = None):
        self._chunks = chunks
        self.headers = headers or {}

    def iter_bytes(self):
        yield from self._chunks


class _StreamResponse(_FakeResponse):
    def __init__(
        self,
        chunks: list[bytes],
        *,
        headers: dict[str, str] | None = None,
        redirect: bool = False,
    ) -> None:
        super().__init__(chunks, headers)
        self.is_redirect = redirect
        self.encoding = "utf-8"

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def raise_for_status(self) -> None:
        return None


class _StreamClient:
    def __init__(self, responses: list[_StreamResponse]) -> None:
        self._responses = responses

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def stream(self, *_args, **_kwargs):
        return nullcontext(self._responses.pop(0))


def test_read_response_bytes_limited_raises_when_stream_exceeds_limit() -> None:
    response = _FakeResponse([b"hello", b"world!"])

    with pytest.raises(ValueError, match="URL_CONTENT_TOO_LARGE"):
        url_extractor._read_response_bytes_limited(response, max_content_size=10)


def test_read_response_bytes_limited_rejects_large_content_length_header() -> None:
    response = _FakeResponse([b"tiny"], headers={"content-length": "11"})

    with pytest.raises(ValueError, match="URL_CONTENT_TOO_LARGE"):
        url_extractor._read_response_bytes_limited(response, max_content_size=10)


@pytest.mark.parametrize(
    ("advertised_mb", "plan_cap_mb"),
    [(50, 100), (150, 200)],
)
def test_read_response_bytes_limited_allows_plus_and_pro_pdf_headroom(
    advertised_mb: int,
    plan_cap_mb: int,
) -> None:
    """10–100 MB (Plus) and 100–200 MB (Pro) PDF responses pass the
    header guard. A tiny body avoids allocating 200 MB in a unit test; the
    streaming branch separately proves actual received bytes are bounded."""
    response = _FakeResponse(
        [b"%PDF-1.7\n"],
        headers={"content-length": str(advertised_mb * 1024 * 1024)},
    )

    assert url_extractor._read_response_bytes_limited(
        response,
        max_content_size=plan_cap_mb * 1024 * 1024,
    ).startswith(b"%PDF")


@pytest.mark.parametrize("with_content_length", [False, True], ids=["chunked", "content-length"])
@pytest.mark.parametrize("after_redirect", [False, True], ids=["final", "post-redirect"])
@pytest.mark.parametrize(
    ("content_type", "body", "expected_pdf", "expected_error"),
    [
        ("application/pdf", b"<html>large", False, "URL_CONTENT_TOO_LARGE"),
        ("application/octet-stream", b"%PDF-123456789", True, None),
        ("application/pdf", b"%PDF-123456789", True, None),
        ("text/html", b"<p>short", False, None),
    ],
    ids=["html-labelled-pdf", "pdf-labelled-octet", "pdf-labelled-pdf", "html-labelled-html"],
)
def test_fetch_caps_and_classifies_final_body_by_shared_magic_bytes(
    monkeypatch: pytest.MonkeyPatch,
    with_content_length: bool,
    after_redirect: bool,
    content_type: str,
    body: bytes,
    expected_pdf: bool,
    expected_error: str | None,
) -> None:
    final_headers = {"content-type": content_type}
    if with_content_length:
        final_headers["content-length"] = str(len(body))
    responses: list[_StreamResponse] = []
    if after_redirect:
        responses.append(
            _StreamResponse(
                [],
                headers={
                    "location": "https://cdn.example.com/final",
                    # Even a redirect advertising PDF cannot influence the
                    # cap applied to the final response body.
                    "content-type": "application/pdf",
                },
                redirect=True,
            )
        )
    responses.append(_StreamResponse([body], headers=final_headers))

    monkeypatch.setattr(
        url_extractor,
        "validate_and_resolve_url",
        lambda url: (url, "93.184.216.34"),
    )
    client = _StreamClient(responses)
    monkeypatch.setattr(url_extractor.httpx, "Client", lambda **_kwargs: client)

    if expected_error:
        with pytest.raises(ValueError, match=expected_error):
            url_extractor._fetch_with_safe_redirects(
                "https://example.com/start",
                max_pdf_bytes=30,
                max_html_bytes=10,
            )
        return

    _url, _header, _encoding, payload = url_extractor._fetch_with_safe_redirects(
        "https://example.com/start",
        max_pdf_bytes=30,
        max_html_bytes=10,
    )
    assert payload == body
    assert url_extractor.validate_file_content(payload, "pdf") is expected_pdf


def test_fetch_and_extract_url_recognizes_pdf_with_generic_content_type(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    payload = b"%PDF-1.7\nbody"
    monkeypatch.setattr(
        url_extractor,
        "_fetch_with_safe_redirects",
        lambda url, **_kwargs: (url, "application/octet-stream", "utf-8", payload),
    )

    title, pages, pdf_bytes = url_extractor.fetch_and_extract_url(
        "https://example.com/report.pdf",
        max_pdf_bytes=100,
    )

    assert title == "report.pdf"
    assert pages == []
    assert pdf_bytes == payload


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

    def _fake_fetch(url: str, **_kwargs):
        return url, "text/html; charset=utf-8", "utf-8", html

    monkeypatch.setattr(url_extractor, "_fetch_with_safe_redirects", _fake_fetch)

    title, pages, pdf_bytes = url_extractor.fetch_and_extract_url(
        "https://example.com/article",
        max_pdf_bytes=100 * 1024 * 1024,
    )
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

    def _fake_fetch(url: str, **_kwargs):
        return url, "text/html; charset=utf-8", "utf-8", html

    monkeypatch.setattr(url_extractor, "_fetch_with_safe_redirects", _fake_fetch)

    with pytest.raises(ValueError, match="NO_TEXT_CONTENT"):
        url_extractor.fetch_and_extract_url(
            "https://example.com/image-only",
            max_pdf_bytes=100 * 1024 * 1024,
        )
