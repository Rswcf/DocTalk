import subprocess
from pathlib import Path

SCRIPT = Path(__file__).parent / "vuln_reconcile.py"


def write_finding(tree: Path, cell_id: str, severity: str, confidence: str,
                  agent: str, finding_key: str):
    findings = tree / "findings"
    findings.mkdir(parents=True, exist_ok=True)
    (findings / f"{cell_id}-{finding_key}.md").write_text(f"""---
id: {cell_id}-01
matrix: A
agent: {agent}
cell_id: {cell_id}
row_key: chat_sse
column_key: idempotency_replay
finding_key: {finding_key}
severity: {severity}
confidence: {confidence}
status: bug
files: []
exploit_preconditions: []
---
body
""")


def write_manifest(tree: Path, entries):
    import yaml
    tree.mkdir(parents=True, exist_ok=True)
    (tree / "manifest.yaml").write_text(yaml.safe_dump(entries))


def test_agree_bucket_gap_zero(tmp_path):
    claude = tmp_path / "claude"
    codex = tmp_path / "codex"
    write_finding(claude, "A-03-C07", "P1", "high", "claude", "double_refund")
    write_finding(codex, "A-03-C07", "P1", "medium", "codex", "double_refund")
    write_manifest(claude, [{"cell_id": "A-03-C07", "state": "finding"}])
    write_manifest(codex, [{"cell_id": "A-03-C07", "state": "finding"}])

    result = subprocess.run(
        ["python3", str(SCRIPT), str(claude), str(codex), str(tmp_path / "out.yaml")],
        capture_output=True, text=True,
    )
    assert result.returncode == 0, result.stderr
    import yaml
    out = yaml.safe_load((tmp_path / "out.yaml").read_text())
    rec = out["records"][0]
    assert rec["alignment"] == "agree"
    assert rec["severity_gap"] == 0
    assert rec["p0_asymmetry"] is False


def test_agree_bucket_gap_one_no_p0(tmp_path):
    """P1 vs P2 = gap 1, no P0 asymmetry = consensus per design §5 Stage 2."""
    claude = tmp_path / "claude"
    codex = tmp_path / "codex"
    write_finding(claude, "A-03-C07", "P1", "high", "claude", "double_refund")
    write_finding(codex, "A-03-C07", "P2", "medium", "codex", "double_refund")
    write_manifest(claude, [{"cell_id": "A-03-C07", "state": "finding"}])
    write_manifest(codex, [{"cell_id": "A-03-C07", "state": "finding"}])
    subprocess.run(
        ["python3", str(SCRIPT), str(claude), str(codex), str(tmp_path / "out.yaml")],
        capture_output=True, text=True, check=True,
    )
    import yaml
    rec = yaml.safe_load((tmp_path / "out.yaml").read_text())["records"][0]
    assert rec["alignment"] == "agree"
    assert rec["severity_gap"] == 1
    assert rec["p0_asymmetry"] is False
    assert rec.get("severity_disputed") is True


def test_tie_break_triggered_by_p0_asymmetry(tmp_path):
    """P0 vs P1 = gap 1 BUT P0 asymmetry → tie-break."""
    claude = tmp_path / "claude"
    codex = tmp_path / "codex"
    write_finding(claude, "A-03-C07", "P1", "high", "claude", "double_refund")
    write_finding(codex, "A-03-C07", "P0", "medium", "codex", "double_refund")
    write_manifest(claude, [{"cell_id": "A-03-C07", "state": "finding"}])
    write_manifest(codex, [{"cell_id": "A-03-C07", "state": "finding"}])
    subprocess.run(
        ["python3", str(SCRIPT), str(claude), str(codex), str(tmp_path / "out.yaml")],
        capture_output=True, text=True, check=True,
    )
    import yaml
    rec = yaml.safe_load((tmp_path / "out.yaml").read_text())["records"][0]
    assert rec["alignment"] == "same_finding_different_severity"
    assert rec["p0_asymmetry"] is True


def test_tie_break_triggered_by_gap_two(tmp_path):
    """P1 vs P3 = gap 2 → tie-break."""
    claude = tmp_path / "claude"
    codex = tmp_path / "codex"
    write_finding(claude, "A-03-C07", "P1", "high", "claude", "double_refund")
    write_finding(codex, "A-03-C07", "P3", "medium", "codex", "double_refund")
    write_manifest(claude, [{"cell_id": "A-03-C07", "state": "finding"}])
    write_manifest(codex, [{"cell_id": "A-03-C07", "state": "finding"}])
    subprocess.run(
        ["python3", str(SCRIPT), str(claude), str(codex), str(tmp_path / "out.yaml")],
        capture_output=True, text=True, check=True,
    )
    import yaml
    rec = yaml.safe_load((tmp_path / "out.yaml").read_text())["records"][0]
    assert rec["alignment"] == "same_finding_different_severity"
    assert rec["severity_gap"] == 2


def test_blind_spot(tmp_path):
    claude = tmp_path / "claude"
    codex = tmp_path / "codex"
    write_finding(claude, "A-03-C07", "P1", "high", "claude", "double_refund")
    (codex / "findings").mkdir(parents=True)
    write_manifest(claude, [{"cell_id": "A-03-C07", "state": "finding"}])
    write_manifest(codex, [{"cell_id": "A-03-C07", "state": "clear"}])

    subprocess.run(
        ["python3", str(SCRIPT), str(claude), str(codex), str(tmp_path / "out.yaml")],
        capture_output=True, text=True, check=True,
    )
    import yaml
    out = yaml.safe_load((tmp_path / "out.yaml").read_text())
    assert out["records"][0]["alignment"] == "only_claude"
