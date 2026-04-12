from unittest.mock import MagicMock

import pytest

from app.services.export_service import (
    _sanitize_xml_text,
    render_docx,
    render_markdown,
    render_pdf,
)


def _make_messages():
    return [
        MagicMock(role="user", content="What is section 3?", citations=None),
        MagicMock(
            role="assistant",
            content="Section 3 states that [1] the parties agree...",
            citations=[{
                "ref_index": 1,
                "page": 3,
                "text_snippet": "The parties agree to...",
                "document_filename": "contract.pdf",
            }],
        ),
    ]


# --- Markdown tests ---

def test_render_markdown():
    md = render_markdown("Test Session", "contract.pdf", _make_messages())
    assert "# Test Session" in md
    assert "What is section 3?" in md
    assert "[^1]" in md
    assert "Page 3" in md


def test_render_markdown_empty_messages():
    md = render_markdown("Empty", "doc.pdf", [])
    assert "Empty" in md


def test_render_markdown_limit():
    msgs = [MagicMock(role="user", content=f"Q{i}", citations=None) for i in range(600)]
    with pytest.raises(ValueError, match="500"):
        render_markdown("Too Long", "doc.pdf", msgs)


# --- DOCX tests ---

def test_render_docx():
    buf = render_docx("Test Session", "contract.pdf", _make_messages())
    assert buf.getbuffer().nbytes > 0


def test_render_docx_limit():
    msgs = [MagicMock(role="user", content=f"Q{i}", citations=None) for i in range(600)]
    with pytest.raises(ValueError, match="500"):
        render_docx("Too Long", "doc.pdf", msgs)


# --- PDF tests (require weasyprint + system libs) ---

_weasyprint_available = False
try:
    import weasyprint  # noqa: F401
    _weasyprint_available = True
except (ImportError, OSError):
    pass

_skip_pdf = pytest.mark.skipif(not _weasyprint_available, reason="weasyprint not available")


@_skip_pdf
def test_render_pdf():
    buf = render_pdf("Test Session", "contract.pdf", _make_messages())
    content = buf.getvalue()
    assert content[:5] == b"%PDF-"


def test_render_pdf_limit():
    """Limit check runs before weasyprint import, so no skip needed."""
    msgs = [MagicMock(role="user", content=f"Q{i}", citations=None) for i in range(600)]
    with pytest.raises(ValueError, match="500"):
        render_pdf("Too Long", "doc.pdf", msgs)


@_skip_pdf
def test_render_pdf_html_injection():
    """Verify that user content is HTML-escaped in PDF output."""
    malicious = MagicMock(
        role="user",
        content='<script>alert("xss")</script><img src="http://evil.com/steal">',
        citations=None,
    )
    buf = render_pdf("Test", "doc.pdf", [malicious])
    content = buf.getvalue()
    assert content[:5] == b"%PDF-"


# --- Citation edge cases ---

def test_citations_as_non_list():
    """If citations field is a dict instead of list, should not crash."""
    msg = MagicMock(role="assistant", content="text", citations={"bad": "shape"})
    md = render_markdown("Test", "doc.pdf", [msg])
    assert "text" in md


def test_citations_with_non_dict_items():
    """If citations list contains non-dict items, should skip them."""
    msg = MagicMock(role="assistant", content="text", citations=["not-a-dict", 42])
    md = render_markdown("Test", "doc.pdf", [msg])
    assert "text" in md


# --- XML sanitization regression tests (root cause of PDF/DOCX 400 bug) ---

@pytest.mark.parametrize(
    "raw,expected",
    [
        ("hello\x00world", "helloworld"),           # NUL
        ("a\x01b\x02c\x08d", "abcd"),               # C0 controls
        ("v\x0Bt\x0Cff", "vtff"),                   # vertical tab + form feed
        ("e\x1Ff", "ef"),                           # unit separator
        ("keep\ttabs\nlf\rcr", "keep\ttabs\nlf\rcr"),  # whitespace preserved
        ("\uD800stray", "stray"),                   # unpaired high surrogate
        ("bom\uFFFE", "bom"),                       # non-character U+FFFE
        ("bad\uFFFFend", "badend"),                 # non-character U+FFFF
        ("", ""),
        (None, ""),
        (42, "42"),                                 # coerce to str
    ],
)
def test_sanitize_xml_text(raw, expected):
    assert _sanitize_xml_text(raw) == expected


def test_render_docx_accepts_nul_bytes():
    """Root cause regression: DOCX used to 400 on NUL/control chars in content."""
    msg = MagicMock(
        role="assistant",
        content="text with NUL\x00 and \x08 control \x1F bytes",
        citations=None,
    )
    buf = render_docx("title\x00bad", "doc\x0C.pdf", [msg])
    assert buf.getbuffer().nbytes > 0


def test_render_markdown_passthrough_control_chars():
    """Markdown does not sanitize — consumer treats it as plain text."""
    msg = MagicMock(role="user", content="tab\there", citations=None)
    md = render_markdown("Title", "doc.pdf", [msg])
    assert "tab\there" in md


@_skip_pdf
def test_render_pdf_accepts_control_chars():
    """PDF path must also tolerate control chars via _sanitize_xml_text."""
    msg = MagicMock(
        role="assistant",
        content="NUL\x00 then \x0B vtab then \x0C formfeed",
        citations=None,
    )
    buf = render_pdf("Title\x00", "doc.pdf", [msg])
    assert buf.getvalue()[:5] == b"%PDF-"


# --- Content-Disposition header encoding (root cause of 400 on Chinese titles) ---

def test_content_disposition_ascii():
    from app.api.export import _content_disposition
    v = _content_disposition("export.pdf")
    # latin-1 encodable → both params survive
    assert 'filename="export.pdf"' in v
    assert "filename*=UTF-8''export.pdf" in v
    v.encode("latin-1")  # must not raise


def test_content_disposition_chinese():
    """Non-ASCII title was the real root cause: raw filename fails latin-1 encode."""
    from app.api.export import _content_disposition
    v = _content_disposition("中文会话.pdf")
    # ASCII fallback replaces CJK with '_' or similar
    assert 'filename="' in v
    # RFC 5987 filename* carries percent-encoded UTF-8
    assert "filename*=UTF-8''" in v
    assert "%E4%B8%AD%E6%96%87" in v  # 中文
    # Must be latin-1 encodable end-to-end (this is what failed before the fix)
    v.encode("latin-1")


def test_content_disposition_emoji_and_quotes():
    """Quotes and emoji in user-supplied title should not break the header."""
    from app.api.export import _content_disposition
    v = _content_disposition('bad"title🎉.docx')
    assert "filename*=UTF-8''" in v
    v.encode("latin-1")


def test_content_disposition_empty_after_strip():
    from app.api.export import _content_disposition
    v = _content_disposition("纯中文")
    # Fallback becomes "export" when ASCII version is all underscores
    assert 'filename="export"' in v or 'filename="_' in v
    v.encode("latin-1")


def test_content_disposition_crlf_stripped():
    """Header injection hardening: CR/LF in title must not leak into header."""
    from app.api.export import _content_disposition
    v = _content_disposition("safe\r\nX-Evil: pwn.pdf")
    assert "\r" not in v and "\n" not in v
    # Even the percent-encoded UTF-8 form must not contain raw CR/LF
    assert "%0D" not in v and "%0A" not in v  # CR/LF got stripped, not encoded
    v.encode("latin-1")


def test_content_disposition_quote_and_backslash():
    """Quoted-string specials in fallback must be escaped/replaced."""
    from app.api.export import _content_disposition
    v = _content_disposition('bad"title\\.pdf')
    # fallback quoted-string should not contain raw " or \
    head = v.split(";")[1]  # ' filename="..."'
    assert head.count('"') == 2  # opening + closing only
    assert "\\" not in head
    v.encode("latin-1")


def test_content_disposition_very_long_name():
    """Very long title should still produce valid header (upstream already caps at 100)."""
    from app.api.export import _content_disposition
    v = _content_disposition("a" * 500 + ".pdf")
    v.encode("latin-1")
    assert 'filename="' in v and "filename*=UTF-8''" in v
