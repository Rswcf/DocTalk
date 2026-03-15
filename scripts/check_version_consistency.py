#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

SEMVER_RE = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$")
VALID_STAGES = {"alpha", "beta", "rc", "stable"}

REPO_ROOT = Path(__file__).resolve().parents[1]
VERSION_FILE = REPO_ROOT / "version.json"
FRONTEND_PACKAGE_FILE = REPO_ROOT / "frontend" / "package.json"
FRONTEND_LOCK_FILE = REPO_ROOT / "frontend" / "package-lock.json"
CHANGELOG_FILES = [REPO_ROOT / "CHANGELOG.md", REPO_ROOT / "CHANGELOG.zh.md"]


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def fail(message: str) -> int:
    print(f"[version-check] {message}", file=sys.stderr)
    return 1


def main() -> int:
    version_payload = load_json(VERSION_FILE)
    version = version_payload.get("version", "")
    stage = version_payload.get("stage", "")

    if not SEMVER_RE.fullmatch(version):
        return fail(f"version.json has invalid SemVer version '{version}'.")
    if stage not in VALID_STAGES:
        return fail(
            f"version.json has invalid stage '{stage}'. Expected one of: {', '.join(sorted(VALID_STAGES))}."
        )

    package_json = load_json(FRONTEND_PACKAGE_FILE)
    if package_json.get("version") != version:
        return fail(
            f"frontend/package.json version '{package_json.get('version')}' does not match version.json '{version}'."
        )

    package_lock = load_json(FRONTEND_LOCK_FILE)
    if package_lock.get("version") != version:
        return fail(
            f"frontend/package-lock.json version '{package_lock.get('version')}' does not match version.json '{version}'."
        )

    root_lock = package_lock.get("packages", {}).get("", {})
    if root_lock.get("version") != version:
        return fail(
            "frontend/package-lock.json root package version does not match version.json."
        )

    for changelog in CHANGELOG_FILES:
        text = changelog.read_text(encoding="utf-8")
        if "[Unreleased]" not in text and f"## [{version}]" not in text:
            return fail(
                f"{changelog.name} must contain an [Unreleased] section or an explicit entry for {version}."
            )

    print(f"[version-check] OK: {version} ({stage})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
