"""Add durable monthly installments for paid annual subscriptions."""
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision = '20260913_0046'
down_revision = '20260913_0045'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('annual_credit_installments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('invoice_id', sa.String(255), nullable=False),
        sa.Column('subscription_id', sa.String(255), nullable=False),
        sa.Column('month_index', sa.Integer(), nullable=False),
        sa.Column('plan', sa.String(20), nullable=False),
        sa.Column('credits', sa.Integer(), nullable=False),
        sa.Column('due_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('retry_at', sa.DateTime(timezone=True)),
        sa.Column('period_end', sa.DateTime(timezone=True), nullable=False),
        sa.Column('state', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('granted_at', sa.DateTime(timezone=True)),
        sa.Column('ledger_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('credit_ledger.id', ondelete='SET NULL')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.UniqueConstraint('invoice_id', 'month_index', name='uq_annual_invoice_month'),
        sa.CheckConstraint('month_index >= 0 AND month_index < 12', name='ck_annual_month_index'),
        sa.CheckConstraint('credits > 0', name='ck_annual_positive_credits'),
        sa.CheckConstraint("state IN ('pending', 'granted', 'stopped', 'review')", name='ck_annual_state'),
    )
    op.create_index('ix_annual_due', 'annual_credit_installments', ['state', 'due_at'])
    op.create_index('ix_annual_subscription', 'annual_credit_installments', ['subscription_id'])


def downgrade() -> None:
    op.drop_table('annual_credit_installments')
