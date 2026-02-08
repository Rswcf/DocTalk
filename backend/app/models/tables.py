from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


# Documents table
class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=sa.text("gen_random_uuid()"),
    )
    filename: Mapped[str] = mapped_column(sa.String(500), nullable=False)
    file_size: Mapped[int] = mapped_column(sa.BigInteger, nullable=False)
    page_count: Mapped[Optional[int]] = mapped_column(sa.Integer, nullable=True)
    storage_key: Mapped[str] = mapped_column(sa.String(500), nullable=False)
    status: Mapped[str] = mapped_column(sa.String(20), nullable=False, server_default=sa.text("'uploading'"))
    error_msg: Mapped[Optional[str]] = mapped_column(sa.Text, nullable=True)

    pages_parsed: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default=sa.text("0"))
    chunks_total: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default=sa.text("0"))
    chunks_indexed: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default=sa.text("0"))

    created_at: Mapped[sa.DateTime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))
    updated_at: Mapped[sa.DateTime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.func.now())

    # Optional owner user (nullable; set null on user delete)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Auto-generated summary and suggested questions (populated after parsing)
    summary: Mapped[Optional[str]] = mapped_column(sa.Text, nullable=True)
    suggested_questions: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Demo documents have a slug (e.g. "nvidia-10k"); user docs have None
    demo_slug: Mapped[Optional[str]] = mapped_column(
        sa.String(50), nullable=True, unique=True
    )

    @property
    def is_demo(self) -> bool:
        return self.demo_slug is not None

    pages: Mapped[List[Page]] = relationship("Page", back_populates="document", cascade="all, delete-orphan")
    chunks: Mapped[List[Chunk]] = relationship("Chunk", back_populates="document", cascade="all, delete-orphan")
    sessions: Mapped[List[ChatSession]] = relationship(
        "ChatSession", back_populates="document", cascade="all, delete-orphan"
    )


# Pages table
class Page(Base):
    __tablename__ = "pages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=sa.text("gen_random_uuid()"),
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
    )
    page_number: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    width_pt: Mapped[float] = mapped_column(sa.Float, nullable=False)
    height_pt: Mapped[float] = mapped_column(sa.Float, nullable=False)
    rotation: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default=sa.text("0"))

    document: Mapped[Document] = relationship("Document", back_populates="pages")

    __table_args__ = (
        sa.UniqueConstraint("document_id", "page_number", name="uq_pages_document_page"),
        sa.Index("idx_pages_document", "document_id"),
    )


# Chunks table
class Chunk(Base):
    __tablename__ = "chunks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=sa.text("gen_random_uuid()"),
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
    )
    chunk_index: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    text: Mapped[str] = mapped_column(sa.Text, nullable=False)
    token_count: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    page_start: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    page_end: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    bboxes: Mapped[dict] = mapped_column(JSONB, nullable=False)
    section_title: Mapped[Optional[str]] = mapped_column(sa.String(500))
    vector_id: Mapped[Optional[str]] = mapped_column(sa.String(100))
    created_at: Mapped[sa.DateTime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))

    document: Mapped[Document] = relationship("Document", back_populates="chunks")

    __table_args__ = (
        sa.UniqueConstraint("document_id", "chunk_index", name="uq_chunks_document_index"),
        sa.Index("idx_chunks_document", "document_id"),
    )


# Sessions table (use ChatSession to avoid conflict with SQLAlchemy Session)
class ChatSession(Base):
    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=sa.text("gen_random_uuid()"),
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[Optional[str]] = mapped_column(sa.String(200), nullable=True)
    created_at: Mapped[sa.DateTime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))
    updated_at: Mapped[sa.DateTime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.func.now())

    document: Mapped[Document] = relationship("Document", back_populates="sessions")
    messages: Mapped[List[Message]] = relationship("Message", back_populates="session", cascade="all, delete-orphan")


# Messages table
class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=sa.text("gen_random_uuid()"),
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), sa.ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(sa.String(10), nullable=False)
    content: Mapped[str] = mapped_column(sa.Text, nullable=False)
    citations: Mapped[Optional[dict]] = mapped_column(JSONB)
    prompt_tokens: Mapped[Optional[int]] = mapped_column(sa.Integer)
    output_tokens: Mapped[Optional[int]] = mapped_column(sa.Integer)
    created_at: Mapped[sa.DateTime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))

    session: Mapped[ChatSession] = relationship("ChatSession", back_populates="messages")

    __table_args__ = (
        sa.Index("idx_messages_session", "session_id", "created_at"),
    )


# Users table
class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    email: Mapped[str] = mapped_column(sa.String(255), unique=True, nullable=False, index=True)
    name: Mapped[Optional[str]] = mapped_column(sa.String(255))
    image: Mapped[Optional[str]] = mapped_column(sa.String(500))
    email_verified: Mapped[Optional[datetime]] = mapped_column(sa.DateTime(timezone=True))
    credits_balance: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default=sa.text("0"))
    signup_bonus_granted_at: Mapped[Optional[datetime]] = mapped_column(sa.DateTime(timezone=True))
    plan: Mapped[str] = mapped_column(sa.String(20), nullable=False, server_default=sa.text("'free'"))
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(sa.String(255))
    stripe_subscription_id: Mapped[Optional[str]] = mapped_column(sa.String(255))
    monthly_credits_granted_at: Mapped[Optional[datetime]] = mapped_column(sa.DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.func.now()
    )

    # Relationships
    accounts: Mapped[List["Account"]] = relationship("Account", back_populates="user", cascade="all, delete-orphan")


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    type: Mapped[str] = mapped_column(sa.String(50), nullable=False)
    provider: Mapped[str] = mapped_column(sa.String(50), nullable=False)
    provider_account_id: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    refresh_token: Mapped[Optional[str]] = mapped_column(sa.Text)
    access_token: Mapped[Optional[str]] = mapped_column(sa.Text)
    expires_at: Mapped[Optional[int]] = mapped_column(sa.BigInteger)
    token_type: Mapped[Optional[str]] = mapped_column(sa.String(50))
    scope: Mapped[Optional[str]] = mapped_column(sa.String(500))
    id_token: Mapped[Optional[str]] = mapped_column(sa.Text)

    user: Mapped[User] = relationship("User", back_populates="accounts")

    __table_args__ = (
        sa.UniqueConstraint("provider", "provider_account_id", name="uq_accounts_provider_account"),
        sa.Index("idx_accounts_user_id", "user_id"),
    )


class VerificationToken(Base):
    __tablename__ = "verification_tokens"

    identifier: Mapped[str] = mapped_column(sa.String(255), primary_key=True)
    token: Mapped[str] = mapped_column(sa.String(255), primary_key=True)
    expires: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), nullable=False)


class CreditLedger(Base):
    __tablename__ = "credit_ledger"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    delta: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    balance_after: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    reason: Mapped[str] = mapped_column(sa.String(50), nullable=False)
    ref_type: Mapped[Optional[str]] = mapped_column(sa.String(50))
    ref_id: Mapped[Optional[str]] = mapped_column(sa.String(255))
    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))

    __table_args__ = (
        sa.Index("idx_credit_ledger_user_created", "user_id", "created_at"),
        sa.Index("idx_credit_ledger_ref", "ref_type", "ref_id"),
    )


class UsageRecord(Base):
    __tablename__ = "usage_records"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    message_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), sa.ForeignKey("messages.id", ondelete="SET NULL"), nullable=True
    )
    model: Mapped[str] = mapped_column(sa.String(100), nullable=False)
    prompt_tokens: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    completion_tokens: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    total_tokens: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    cost_credits: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))

    __table_args__ = (
        sa.Index("idx_usage_records_user_created", "user_id", "created_at"),
    )
