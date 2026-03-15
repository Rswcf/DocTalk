from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Optional

_COMMIT_ENV_VARS = (
    "VERCEL_GIT_COMMIT_SHA",
    "RAILWAY_GIT_COMMIT_SHA",
    "GITHUB_SHA",
    "COMMIT_SHA",
)


def _version_file_candidates() -> list[Path]:
    here = Path(__file__).resolve()
    return [
        here.parents[3] / "version.json",  # repo root in local development
        here.parents[2] / "version.json",  # /app/version.json in Docker
        Path("/app/version.json"),
    ]


@lru_cache
def _load_version_payload() -> dict[str, str]:
    for candidate in _version_file_candidates():
        if candidate.exists():
            payload = json.loads(candidate.read_text(encoding="utf-8"))
            version = str(payload.get("version", "")).strip()
            stage = str(payload.get("stage", "")).strip().lower()
            if not version or not stage:
                raise RuntimeError(f"Incomplete version metadata in {candidate}")
            return {"version": version, "stage": stage}
    raise FileNotFoundError("Could not locate version.json for DocTalk runtime metadata.")


def get_product_version() -> str:
    return _load_version_payload()["version"]


def get_release_stage() -> str:
    return _load_version_payload()["stage"]


def get_build_identifier() -> Optional[str]:
    for env_var in _COMMIT_ENV_VARS:
        value = os.getenv(env_var)
        if value:
            return value[:12]
    return None


def get_release_payload() -> dict[str, str | None]:
    payload: dict[str, str | None] = {
        "version": get_product_version(),
        "stage": get_release_stage(),
        "build": get_build_identifier(),
    }
    return payload
