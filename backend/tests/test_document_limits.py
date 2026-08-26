from __future__ import annotations

import fitz
import pytest

from app.core.config import settings
from app.services.document_limits import (
    count_document_pages,
    max_file_size_mb_for_plan,
    max_pages_for_plan,
)


def test_plan_limits_match_product_contract() -> None:
    assert [max_file_size_mb_for_plan(plan) for plan in ("free", "plus", "pro")] == [50, 100, 200]
    assert [max_pages_for_plan(plan) for plan in ("free", "plus", "pro")] == [750, 1500, 3000]
    assert max_pages_for_plan("unknown") == settings.FREE_MAX_PAGES


def test_count_pdf_pages_reads_page_tree_without_extraction() -> None:
    pdf = fitz.open()
    try:
        for _ in range(3):
            pdf.new_page()
        payload = pdf.tobytes()
    finally:
        pdf.close()

    assert count_document_pages(payload, "pdf") == 3


def test_count_pdf_pages_rejects_password_protected_pdf() -> None:
    pdf = fitz.open()
    try:
        pdf.new_page()
        payload = pdf.tobytes(
            encryption=fitz.PDF_ENCRYPT_AES_256,
            owner_pw="owner-secret",
            user_pw="user-secret",
        )
    finally:
        pdf.close()

    with pytest.raises(ValueError, match="PDF_PASSWORD_PROTECTED"):
        count_document_pages(payload, "pdf")


def test_count_pdf_pages_fails_closed_when_page_tree_is_undetermined() -> None:
    with pytest.raises(Exception):
        count_document_pages(b"%PDF-1.7\nmalformed", "pdf")


def test_count_text_pages_matches_worker_logical_page_split() -> None:
    payload = (("a" * 3000) + "\n" + ("b" * 3000)).encode()

    assert count_document_pages(payload, "txt") == 2
