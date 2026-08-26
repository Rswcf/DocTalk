from __future__ import annotations

import gzip
import zlib
from contextlib import nullcontext

import pytest

from app.services.extractors import url_extractor


class _FakeResponse:
    def __init__(self, chunks: list[bytes], headers: dict[str, str] | None = None):
        self._chunks = chunks
        self.headers = headers or {}
        self.num_bytes_downloaded = 0
        self.raw_chunk_size: int | None = None

    def iter_raw(self, chunk_size: int | None = None):
        self.raw_chunk_size = chunk_size
        for chunk in self._chunks:
            self.num_bytes_downloaded += len(chunk)
            yield chunk


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
    response = _FakeResponse([b"x" * 30])

    with pytest.raises(ValueError, match="URL_CONTENT_TOO_LARGE"):
        url_extractor._read_response_bytes_limited(response, max_content_size=10)
    assert response.raw_chunk_size == 11


def test_read_response_bytes_limited_rejects_large_content_length_header() -> None:
    response = _FakeResponse([b"tiny"], headers={"content-length": "11"})

    with pytest.raises(ValueError, match="URL_CONTENT_TOO_LARGE"):
        url_extractor._read_response_bytes_limited(response, max_content_size=10)


def test_read_response_bytes_limited_rejects_pdf_magic_above_flat_cap() -> None:
    response = _FakeResponse(
        [b"%PDF-" + b"x" * 20],
    )

    with pytest.raises(ValueError, match="URL_CONTENT_TOO_LARGE"):
        url_extractor._read_response_bytes_limited(response, max_content_size=10)


@pytest.mark.parametrize(
    ("encoding", "compressed"),
    [
        ("gzip", gzip.compress(b"x" * 30)),
        ("deflate", zlib.compress(b"x" * 30)),
    ],
)
def test_read_response_bytes_limited_rejects_decoded_expansion_without_overshoot(
    encoding: str,
    compressed: bytes,
) -> None:
    response = _FakeResponse(
        [compressed],
        headers={"content-encoding": encoding},
    )

    with pytest.raises(ValueError, match="URL_CONTENT_TOO_LARGE"):
        url_extractor._read_response_bytes_limited(response, max_content_size=10)


@pytest.mark.parametrize(
    ("encoding", "compressed"),
    [
        ("gzip", gzip.compress(b"within-cap")),
        ("deflate", zlib.compress(b"within-cap")),
    ],
)
def test_read_response_bytes_limited_decodes_supported_content_within_cap(
    encoding: str,
    compressed: bytes,
) -> None:
    response = _FakeResponse(
        [compressed[:3], compressed[3:]],
        headers={"content-encoding": encoding},
    )

    assert url_extractor._read_response_bytes_limited(
        response,
        max_content_size=100,
    ) == b"within-cap"


@pytest.mark.parametrize("encoding", ["br", "zstd"])
def test_read_response_bytes_limited_rejects_unbounded_optional_decoders_before_read(
    encoding: str,
) -> None:
    response = _FakeResponse(
        [b"compressed"],
        headers={"content-encoding": encoding},
    )

    with pytest.raises(url_extractor.httpx.DecodingError):
        url_extractor._read_response_bytes_limited(response, max_content_size=10)
    assert response.num_bytes_downloaded == 0


@pytest.mark.parametrize("with_content_length", [False, True], ids=["chunked", "content-length"])
@pytest.mark.parametrize("after_redirect", [False, True], ids=["final", "post-redirect"])
@pytest.mark.parametrize(
    ("content_type", "body", "expected_pdf", "expected_error"),
    [
        ("application/pdf", b"<html>large", False, "URL_CONTENT_TOO_LARGE"),
        ("application/octet-stream", b"%PDF-1234", True, None),
        ("application/pdf", b"%PDF-1234", True, None),
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
                max_content_size=10,
            )
        return

    _url, _header, _encoding, payload = url_extractor._fetch_with_safe_redirects(
        "https://example.com/start",
        max_content_size=10,
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
        max_content_size=100,
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
        max_content_size=100 * 1024 * 1024,
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
            max_content_size=100 * 1024 * 1024,
        )
