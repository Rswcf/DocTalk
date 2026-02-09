"""Structured security event logging for compliance auditing."""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

security_logger = logging.getLogger("doctalk.security")


def log_security_event(event_type: str, **kwargs: object) -> None:
    """Log a structured JSON security event."""
    security_logger.info(json.dumps({
        "event": event_type,
        "ts": datetime.now(timezone.utc).isoformat(),
        **{k: str(v) for k, v in kwargs.items()},
    }))
