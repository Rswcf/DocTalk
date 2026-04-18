#!/usr/bin/env python3
"""Freeze an agent's output tree by computing sha256 hashes + a timestamp.

Excludes crossread/ and tie-break/ subtrees (append-only post-freeze).
Once frozen, any subsequent modification to non-excluded files is rejected.
"""
from __future__ import annotations

import hashlib
import sys
from datetime import datetime, timezone
from pathlib import Path

import yaml

EXCLUDED_PREFIXES = ("crossread/", "tie-break/")


def sha256_file(p: Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def collect_files(root: Path) -> dict[str, str]:
    """Hash every file EXCEPT append-only post-freeze directories and freeze.yaml itself."""
    hashes: dict[str, str] = {}
    for p in sorted(root.rglob("*")):
        if not p.is_file():
            continue
        if p.name == "freeze.yaml":
            continue
        rel = p.relative_to(root).as_posix()
        if any(rel.startswith(pref) for pref in EXCLUDED_PREFIXES):
            continue
        hashes[rel] = sha256_file(p)
    return hashes


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("usage: vuln_freeze.py <agent-tree-dir>", file=sys.stderr)
        return 2
    root = Path(argv[1])
    if not root.is_dir():
        print(f"not a directory: {root}", file=sys.stderr)
        return 2
    freeze_path = root / "freeze.yaml"
    current = collect_files(root)
    if freeze_path.exists():
        prior = yaml.safe_load(freeze_path.read_text()) or {}
        prior_files = prior.get("files", {})
        mismatches = [
            k for k, v in current.items()
            if k in prior_files and prior_files[k] != v
        ]
        if mismatches or set(current) != set(prior_files):
            print(
                f"tree already frozen at {prior.get('timestamp')}; "
                f"files modified or added: {mismatches[:5]}",
                file=sys.stderr,
            )
            return 1
        return 0
    freeze_path.write_text(
        yaml.safe_dump({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "files": current,
        }, sort_keys=True)
    )
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
