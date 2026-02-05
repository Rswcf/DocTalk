"""add auth, credits, usage tables and alter documents

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-02-05 00:30:00

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "c3d4e5f6a7b8"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Ensure pgcrypto for gen_random_uuid()
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    # users
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("email", sa.String(length=255), nullable=False, unique=True),
        sa.Column("name", sa.String(length=255), nullable=True),
        sa.Column("image", sa.String(length=500), nullable=True),
        sa.Column("email_verified", sa.DateTime(timezone=True), nullable=True),
        sa.Column("credits_balance", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("signup_bonus_granted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_users_email", "users", ["email"], unique=False)

    # accounts
    op.create_table(
        "accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(length=50), nullable=False),
        sa.Column("provider", sa.String(length=50), nullable=False),
        sa.Column("provider_account_id", sa.String(length=255), nullable=False),
        sa.Column("refresh_token", sa.Text(), nullable=True),
        sa.Column("access_token", sa.Text(), nullable=True),
        sa.Column("expires_at", sa.BigInteger(), nullable=True),
        sa.Column("token_type", sa.String(length=50), nullable=True),
        sa.Column("scope", sa.String(length=500), nullable=True),
        sa.Column("id_token", sa.Text(), nullable=True),
        sa.UniqueConstraint("provider", "provider_account_id", name="uq_accounts_provider_account"),
    )
    op.create_index("idx_accounts_user_id", "accounts", ["user_id"], unique=False)

    # verification_tokens (composite PK)
    op.create_table(
        "verification_tokens",
        sa.Column("identifier", sa.String(length=255), primary_key=True),
        sa.Column("token", sa.String(length=255), primary_key=True),
        sa.Column("expires", sa.DateTime(timezone=True), nullable=False),
    )

    # credit_ledger
    op.create_table(
        "credit_ledger",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("delta", sa.Integer(), nullable=False),
        sa.Column("balance_after", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(length=50), nullable=False),
        sa.Column("ref_type", sa.String(length=50), nullable=True),
        sa.Column("ref_id", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_credit_ledger_user_created", "credit_ledger", ["user_id", "created_at"], unique=False)
    op.create_index("idx_credit_ledger_ref", "credit_ledger", ["ref_type", "ref_id"], unique=False)

    # usage_records
    op.create_table(
        "usage_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("message_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("messages.id", ondelete="SET NULL"), nullable=True),
        sa.Column("model", sa.String(length=100), nullable=False),
        sa.Column("prompt_tokens", sa.Integer(), nullable=False),
        sa.Column("completion_tokens", sa.Integer(), nullable=False),
        sa.Column("total_tokens", sa.Integer(), nullable=False),
        sa.Column("cost_credits", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_usage_records_user_created", "usage_records", ["user_id", "created_at"], unique=False)

    # Alter documents: add user_id (nullable, set null on user delete)
    op.add_column(
        "documents",
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("idx_documents_user_id", "documents", ["user_id"], unique=False)


def downgrade() -> None:
    # Drop index and column from documents
    op.drop_index("idx_documents_user_id", table_name="documents")
    op.drop_column("documents", "user_id")

    # Drop usage_records
    op.drop_index("idx_usage_records_user_created", table_name="usage_records")
    op.drop_table("usage_records")

    # Drop credit_ledger
    op.drop_index("idx_credit_ledger_ref", table_name="credit_ledger")
    op.drop_index("idx_credit_ledger_user_created", table_name="credit_ledger")
    op.drop_table("credit_ledger")

    # Drop verification_tokens
    op.drop_table("verification_tokens")

    # Drop accounts
    op.drop_index("idx_accounts_user_id", table_name="accounts")
    op.drop_table("accounts")

    # Drop users
    op.drop_index("idx_users_email", table_name="users")
    op.drop_table("users")

