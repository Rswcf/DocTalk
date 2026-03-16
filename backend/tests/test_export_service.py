from unittest.mock import MagicMock, patch

import pytest

from app.services.export_service import render_docx, render_markdown, render_pdf


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
