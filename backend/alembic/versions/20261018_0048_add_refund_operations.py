"""Add future-policy enrollment, debit epochs and durable refund operations."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20261018_0048"
down_revision = "20261018_0047"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "users",
        sa.Column(
            "refund_delete_requested_at", sa.DateTime(timezone=True), nullable=True
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "credit_debit_version", sa.BigInteger(), nullable=False, server_default="0"
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "refund_reserved_credits", sa.Integer(), nullable=False, server_default="0"
        ),
    )
    for name, typ in [
        ("refund_policy_version", sa.String(64)),
        ("refund_policy_enrolled_at", sa.DateTime(timezone=True)),
        ("refund_debit_baseline", sa.BigInteger()),
        ("refund_invoice_id", sa.String(255)),
        ("refund_subscription_id", sa.String(255)),
        ("refund_price_id", sa.String(255)),
        ("refund_grant_credits", sa.Integer()),
    ]:
        op.add_column("checkout_attempts", sa.Column(name, typ, nullable=True))
    op.create_unique_constraint(
        "uq_checkout_refund_invoice", "checkout_attempts", ["refund_invoice_id"]
    )
    columns = [
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
        ),
    ]
    for name, size, nullable in [
        ("invoice_id", 255, False),
        ("policy_version", 64, False),
        ("request_kind", 16, False),
        ("status", 32, False),
        ("review_reason", 128, True),
        ("subscription_id", 255, True),
        ("customer_id", 255, True),
        ("payment_intent_id", 255, True),
        ("charge_id", 255, True),
        ("price_id", 255, True),
        ("plan", 16, True),
        ("provider_refund_id", 255, True),
        ("idempotency_key", 255, False),
        ("cash_status", 32, True),
        ("lease_token", 64, True),
        ("last_error", 128, True),
    ]:
        columns.append(sa.Column(name, sa.String(size), nullable=nullable))
    columns += [
        sa.Column("amount_minor", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "credits_to_revoke", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column("currency", sa.String(8), nullable=False, server_default="usd"),
        sa.Column("adjustment_ledger_id", postgresql.UUID(as_uuid=True)),
        sa.Column(
            "evidence_json",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    ]
    for name in [
        "paid_at",
        "confirmed_at",
        "first_submitted_at",
        "subscription_canceled_at",
        "lease_until",
        "next_retry_at",
    ]:
        columns.append(sa.Column(name, sa.DateTime(timezone=True)))
    for name in ["requested_at", "updated_at"]:
        columns.append(
            sa.Column(
                name,
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            )
        )
    op.create_table("refund_operations", *columns)
    for name in ["invoice_id", "provider_refund_id", "idempotency_key"]:
        op.create_unique_constraint("uq_refund_" + name, "refund_operations", [name])
    op.create_index("ix_refund_operations_user_id", "refund_operations", ["user_id"])
    op.create_index("ix_refund_operations_status", "refund_operations", ["status"])
    op.create_index(
        "uq_credit_ledger_cash_refund",
        "credit_ledger",
        ["user_id", "ref_type", "ref_id"],
        unique=True,
        postgresql_where=sa.text("ref_type = 'cash_refund' AND ref_id IS NOT NULL"),
    )


def downgrade():
    # Production upgrade is add-only. Never erase financial audit on rollback.
    if (
        op.get_bind()
        .execute(sa.text("SELECT EXISTS (SELECT 1 FROM refund_operations)"))
        .scalar()
    ):
        raise RuntimeError("Refund audit exists; migration downgrade is prohibited")
    op.drop_index("uq_credit_ledger_cash_refund", table_name="credit_ledger")
    op.drop_table("refund_operations")
    op.drop_constraint(
        "uq_checkout_refund_invoice", "checkout_attempts", type_="unique"
    )
    for name in [
        "refund_policy_version",
        "refund_policy_enrolled_at",
        "refund_debit_baseline",
        "refund_invoice_id",
        "refund_subscription_id",
        "refund_price_id",
        "refund_grant_credits",
    ]:
        op.drop_column("checkout_attempts", name)
    for name in [
        "credit_debit_version",
        "refund_reserved_credits",
        "refund_delete_requested_at",
    ]:
        op.drop_column("users", name)
