"""add document parse metadata (R2b)

Adds nullable, add-only columns for parse-pipeline observability and the
quality-based OCR backfill: parse_version, parse_method, text_quality, ocr_languages.

Revision ID: 20260524_0032
Revises: 20260524_0031
Create Date: 2026-05-24
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260524_0032"
down_revision = "20260524_0031"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("documents", sa.Column("parse_version", sa.Integer(), nullable=True))
    op.add_column("documents", sa.Column("parse_method", sa.String(length=16), nullable=True))
    op.add_column("documents", sa.Column("text_quality", sa.Float(), nullable=True))
    op.add_column("documents", sa.Column("ocr_languages", sa.String(length=64), nullable=True))


def downgrade() -> None:
    op.drop_column("documents", "ocr_languages")
    op.drop_column("documents", "text_quality")
    op.drop_column("documents", "parse_method")
    op.drop_column("documents", "parse_version")
