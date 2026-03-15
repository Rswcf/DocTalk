#!/usr/bin/env python3
from __future__ import annotations

import argparse
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
CHANGELOG_FILE = REPO_ROOT / "CHANGELOG.md"
CHANGELOG_ZH_FILE = REPO_ROOT / "CHANGELOG.zh.md"


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data: dict) -> None:
    path.write_text(f"{json.dumps(data, indent=2, ensure_ascii=False)}\n", encoding="utf-8")


def parse_version(value: str) -> tuple[int, int, int]:
    match = SEMVER_RE.fullmatch(value)
    if not match:
        raise ValueError(
            f"Invalid version '{value}'. Use strict SemVer like 0.2.0 (no leading zeros)."
        )
    return tuple(int(part) for part in match.groups())


def format_version(version: tuple[int, int, int]) -> str:
    major, minor, patch = version
    return f"{major}.{minor}.{patch}"


def bump(version: tuple[int, int, int], release_type: str) -> tuple[int, int, int]:
    major, minor, patch = version
    if release_type == "patch":
        return major, minor, patch + 1
    if release_type == "minor":
        return major, minor + 1, 0
    raise ValueError(f"Unsupported release type: {release_type}")


def ensure_stage(stage: str) -> str:
    normalized = stage.strip().lower()
    if normalized not in VALID_STAGES:
        raise ValueError(
            f"Invalid stage '{stage}'. Expected one of: {', '.join(sorted(VALID_STAGES))}."
        )
    return normalized


def update_package_version(path: Path, version: str) -> None:
    package_json = load_json(path)
    package_json["version"] = version
    write_json(path, package_json)


def update_package_lock_version(path: Path, version: str) -> None:
    lock_json = load_json(path)
    lock_json["version"] = version
    root_package = lock_json.get("packages", {}).get("")
    if isinstance(root_package, dict):
        root_package["version"] = version
    write_json(path, lock_json)


def changelog_has_version(path: Path, version: str) -> bool:
    return f"## [{version}]" in path.read_text(encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Bump DocTalk product version using SemVer-style 0.y.z releases."
    )
    parser.add_argument(
        "command",
        choices=["patch", "minor", "set"],
        help="Increment patch/minor or set an explicit version.",
    )
    parser.add_argument("value", nargs="?", help="Explicit version when using the 'set' command.")
    parser.add_argument(
        "--stage",
        help="Optional release stage to write into version.json (alpha, beta, rc, stable).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the next version without writing any files.",
    )
    args = parser.parse_args()

    version_payload = load_json(VERSION_FILE)
    current_version = parse_version(version_payload["version"])
    if args.command == "set" and not args.value:
        parser.error("The 'set' command requires an explicit version, e.g. `set 0.2.0`.")

    next_version = (
        parse_version(args.value) if args.command == "set" else bump(current_version, args.command)
    )
    next_version_str = format_version(next_version)
    next_stage = ensure_stage(args.stage) if args.stage else version_payload["stage"]

    print(f"{version_payload['version']} -> {next_version_str} ({next_stage})")

    if args.dry_run:
        return 0

    version_payload["version"] = next_version_str
    version_payload["stage"] = next_stage
    write_json(VERSION_FILE, version_payload)
    update_package_version(FRONTEND_PACKAGE_FILE, next_version_str)
    update_package_lock_version(FRONTEND_LOCK_FILE, next_version_str)

    missing_changelog_files = [
        str(path.relative_to(REPO_ROOT))
        for path in (CHANGELOG_FILE, CHANGELOG_ZH_FILE)
        if not changelog_has_version(path, next_version_str) and "[Unreleased]" not in path.read_text(encoding="utf-8")
    ]
    if missing_changelog_files:
        print(
            "Warning: the following changelog files do not contain either an Unreleased section or "
            f"an entry for {next_version_str}: {', '.join(missing_changelog_files)}",
            file=sys.stderr,
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
