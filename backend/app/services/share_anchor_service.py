"""Stable, non-sensitive anchors for shared chat messages."""
from __future__ import annotations

from uuid import UUID


def message_share_anchor(message_id: UUID | str) -> str:
    """Return the DOM id used by private and public share surfaces.

    The public shared-session API exposes this derived anchor instead of raw
    message UUIDs. UUIDv4 prefixes are enough to be stable per conversation
    without leaking document, chunk, or citation internals.
    """
    value = str(message_id).replace("-", "").lower()
    return f"msg-{value[:16]}"
