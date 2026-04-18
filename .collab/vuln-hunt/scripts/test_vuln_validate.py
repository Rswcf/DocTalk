import subprocess
from pathlib import Path

SCRIPT = Path(__file__).parent / "vuln_validate.py"
FIXTURES = Path(__file__).parent / "fixtures"


def run(fixture_name: str):
    return subprocess.run(
        ["python3", str(SCRIPT), str(FIXTURES / fixture_name)],
        capture_output=True, text=True,
    )


def test_valid_finding_exits_zero():
    result = run("valid-finding.md")
    assert result.returncode == 0, result.stderr


def test_valid_matrix_b_finding_exits_zero():
    result = run("valid-matrix-b-finding.md")
    assert result.returncode == 0, result.stderr


def test_bad_cell_id_rejected():
    result = run("invalid-finding-bad-cell-id.md")
    assert result.returncode != 0
    assert "cell_id" in result.stderr.lower() or "row" in result.stderr.lower()


def test_unknown_row_key_rejected():
    result = run("invalid-finding-unknown-row-key.md")
    assert result.returncode != 0
    assert "row_key" in result.stderr.lower()


def test_matrix_b_missing_invariant_state_rejected():
    result = run("invalid-matrix-b-missing-invariant-state.md")
    assert result.returncode != 0
    assert "invariant_state" in result.stderr.lower()
