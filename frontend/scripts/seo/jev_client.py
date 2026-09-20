"""Single entry point for every TypeSafe (Jev) call in the SEO harness.

Design: .collab/plans/2026-09-20-jev-seo-design.md §4.

Everything that decides model, cost, retries or thresholds lives here so a
change is one edit and so every audit logs comparable usage. The API key is
read from the repo-root .env and is never printed or logged.

Offline use only. This module is NOT imported by the Next.js app; it lives
under frontend/scripts/ so it is outside src/ and never ships to Vercel.
"""
from __future__ import annotations

import json
import os
import random
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

ENDPOINT = "https://api.typesafe.ai/v1/systemone"
MODEL = "jev-latest"

# docs.typesafe.ai/models — $0.042 per 1M input tokens, output tokens free.
USD_PER_INPUT_TOKEN = 0.042 / 1_000_000

# docs.typesafe.ai/models — 64k per request total, 32k for state + longest question.
MAX_REQUEST_TOKENS = 64_000
MAX_STATE_TOKENS = 32_000

_REPO_ROOT = Path(__file__).resolve().parents[3]
_RETRY_STATUSES = {429, 500, 502, 503, 504, 529}


class JevError(RuntimeError):
    pass


def _load_api_key() -> str:
    """Read TYPESAFE_API_KEY from the environment, else from the repo-root .env.

    The value is returned but never logged. .env is gitignored (.gitignore:6).
    """
    key = os.environ.get("TYPESAFE_API_KEY", "").strip()
    if key:
        return key
    env_path = _REPO_ROOT / ".env"
    if not env_path.is_file():
        raise JevError(f"no TYPESAFE_API_KEY in env and no {env_path}")
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("TYPESAFE_API_KEY="):
            key = line.split("=", 1)[1].strip().strip("'\"")
            if key:
                return key
    raise JevError("TYPESAFE_API_KEY is present but empty — fill .env")


class JevClient:
    """Thin, dependency-free client. Accumulates usage so audits can report cost."""

    def __init__(self, *, model: str = MODEL, max_attempts: int = 5, timeout: int = 120):
        self._key = _load_api_key()
        self.model = model
        self.max_attempts = max_attempts
        self.timeout = timeout
        self.total_input_tokens = 0
        self.total_output_tokens = 0
        self.request_count = 0

    # -- public ---------------------------------------------------------

    def ask(self, state: Any, questions: dict[str, dict]) -> dict:
        """One request, many questions over the same state.

        Jev ingests the state once and answers every question against it in
        parallel, so batching questions that share a state is both cheaper and
        faster than separate calls (docs: cookbooks/parallel_questions).
        """
        if not questions:
            raise JevError("questions must not be empty")
        payload = {"state": state, "model": self.model, "questions": questions}
        body = json.dumps(payload).encode("utf-8")
        result = self._post(body)
        usage = result.get("usage") or {}
        self.total_input_tokens += int(usage.get("input_tokens") or 0)
        self.total_output_tokens += int(usage.get("output_tokens") or 0)
        self.request_count += 1
        return result

    @property
    def cost_usd(self) -> float:
        return self.total_input_tokens * USD_PER_INPUT_TOKEN

    def usage_line(self) -> str:
        return (
            f"{self.request_count} requests, "
            f"{self.total_input_tokens:,} input tokens, "
            f"{self.total_output_tokens:,} output tokens, "
            f"${self.cost_usd:.4f}"
        )

    # -- internals ------------------------------------------------------

    def _post(self, body: bytes) -> dict:
        last_err: Exception | None = None
        for attempt in range(1, self.max_attempts + 1):
            req = urllib.request.Request(
                ENDPOINT,
                data=body,
                method="POST",
                headers={
                    "Authorization": f"Bearer {self._key}",
                    "Content-Type": "application/json",
                },
            )
            try:
                with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                    return json.loads(resp.read().decode("utf-8"))
            except urllib.error.HTTPError as exc:
                detail = exc.read().decode("utf-8", "replace")[:400]
                if exc.code in _RETRY_STATUSES and attempt < self.max_attempts:
                    self._sleep(attempt, exc.headers.get("retry-after"))
                    last_err = JevError(f"HTTP {exc.code}: {detail}")
                    continue
                # Never echo the Authorization header; detail is the API's own body.
                raise JevError(f"HTTP {exc.code}: {detail}") from None
            except urllib.error.URLError as exc:
                if attempt < self.max_attempts:
                    self._sleep(attempt, None)
                    last_err = exc
                    continue
                raise JevError(f"connection failed: {exc.reason}") from None
        raise JevError(f"exhausted {self.max_attempts} attempts: {last_err}")

    @staticmethod
    def _sleep(attempt: int, retry_after: str | None) -> None:
        if retry_after:
            try:
                time.sleep(min(float(retry_after), 30.0))
                return
            except ValueError:
                pass
        time.sleep(min(2 ** attempt, 30) * (0.5 + random.random() / 2))


# -- question builders (keep every question's wording in this module) -----
#
# docs: P(noul) and 1 - P(not noul) are not structurally comparable, so a
# Noul's wording must be fixed once and reused. Phrase so that high = yes.

def noul(instructions: Any, *, true: str | None = None, false: str | None = None) -> dict:
    q: dict[str, Any] = {"type": "noul", "instructions": instructions}
    if true is not None or false is not None:
        q["criteria"] = {k: v for k, v in (("true", true), ("false", false)) if v is not None}
    return q


def choice(instructions: Any, criteria: dict[str, Any]) -> dict:
    if len(criteria) > 255:
        raise JevError(f"Choice allows at most 255 options, got {len(criteria)}")
    return {"type": "choice", "instructions": instructions, "criteria": criteria}


def score(instructions: Any, criteria: list[str]) -> dict:
    if not 2 <= len(criteria) <= 10:
        raise JevError(f"Score allows 2-10 levels, got {len(criteria)}")
    return {"type": "score", "instructions": instructions, "criteria": criteria}
