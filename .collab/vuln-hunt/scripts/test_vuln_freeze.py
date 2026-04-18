import subprocess
from pathlib import Path

SCRIPT = Path(__file__).parent / "vuln_freeze.py"


def test_freeze_creates_manifest(tmp_path):
    tree = tmp_path / "agent"
    tree.mkdir()
    (tree / "findings").mkdir()
    (tree / "findings" / "A-03-C07-01.md").write_text("content")
    (tree / "manifest.yaml").write_text("manifest: true")

    result = subprocess.run(
        ["python3", str(SCRIPT), str(tree)],
        capture_output=True, text=True,
    )
    assert result.returncode == 0, result.stderr
    freeze = tree / "freeze.yaml"
    assert freeze.exists()
    import yaml
    data = yaml.safe_load(freeze.read_text())
    assert "timestamp" in data
    assert "files" in data
    assert any("findings/A-03-C07-01.md" in p for p in data["files"])
    for entry in data["files"].values():
        assert len(entry) == 64


def test_freeze_rejects_refreeze_when_contents_changed(tmp_path):
    tree = tmp_path / "agent"
    tree.mkdir()
    (tree / "a.md").write_text("v1")
    subprocess.run(["python3", str(SCRIPT), str(tree)], check=True)

    (tree / "a.md").write_text("v2")
    result = subprocess.run(
        ["python3", str(SCRIPT), str(tree)],
        capture_output=True, text=True,
    )
    assert result.returncode != 0
    assert "already frozen" in result.stderr.lower() or "modified" in result.stderr.lower()


def test_freeze_excludes_crossread_and_tiebreak(tmp_path):
    """Crossread and tie-break are append-only post-freeze — must not trigger refreeze errors."""
    tree = tmp_path / "agent"
    tree.mkdir()
    (tree / "findings").mkdir()
    (tree / "findings" / "a.md").write_text("finding")
    (tree / "crossread").mkdir()
    (tree / "tie-break").mkdir()
    subprocess.run(["python3", str(SCRIPT), str(tree)], check=True)

    (tree / "crossread" / "S1.md").write_text("added later")
    (tree / "tie-break" / "A-03-C07-round1.md").write_text("added later")
    result = subprocess.run(
        ["python3", str(SCRIPT), str(tree)],
        capture_output=True, text=True,
    )
    assert result.returncode == 0, result.stderr
