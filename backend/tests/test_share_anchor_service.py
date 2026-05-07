from __future__ import annotations

import uuid

from app.services.share_anchor_service import message_share_anchor


def test_message_share_anchor_is_stable_and_not_raw_uuid() -> None:
    message_id = uuid.UUID("12345678-90ab-4def-8123-456789abcdef")

    anchor = message_share_anchor(message_id)

    assert anchor == "msg-1234567890ab4def"
    assert str(message_id) not in anchor
