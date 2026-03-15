from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

from app.core.version import get_release_payload

REPO_ROOT = Path(__file__).resolve().parents[2]


def _version_config() -> dict[str, str]:
    return json.loads((REPO_ROOT / "version.json").read_text(encoding="utf-8"))


def test_release_payload_matches_version_file():
    release = get_release_payload()
    version_config = _version_config()
    assert release["version"] == version_config["version"]
    assert release["stage"] == version_config["stage"]
    assert release["build"] is None


def test_version_consistency_script_passes():
    result = subprocess.run(
        [sys.executable, str(REPO_ROOT / "scripts" / "check_version_consistency.py")],
        check=False,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr
    assert _version_config()["version"] in result.stdout


def test_bump_version_dry_run_reports_next_patch():
    result = subprocess.run(
        [sys.executable, str(REPO_ROOT / "scripts" / "bump_version.py"), "patch", "--dry-run"],
        check=False,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr
    assert "0.2.0 -> 0.2.1" in result.stdout
