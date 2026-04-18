import subprocess
from pathlib import Path

SCRIPT = Path(__file__).parent / "vuln_tie_break_prompt.py"


def test_prompt_anonymizes_other_agent(tmp_path):
    run_dir = tmp_path / "run"
    claude = run_dir / "claude" / "findings"
    codex = run_dir / "codex" / "findings"
    claude.mkdir(parents=True)
    codex.mkdir(parents=True)

    (claude / "A-03-C07-double_refund.md").write_text("""---
id: A-03-C07-01
matrix: A
agent: claude
cell_id: A-03-C07
row_key: chat_sse
column_key: idempotency_replay
finding_key: double_refund
severity: P1
confidence: high
status: bug
files: ["backend/app/services/chat_service.py:350"]
exploit_preconditions: []
---
## Observation
Claude thinks P1 high.
""")

    (codex / "A-03-C07-double_refund.md").write_text("""---
id: A-03-C07-01
matrix: A
agent: codex
cell_id: A-03-C07
row_key: chat_sse
column_key: idempotency_replay
finding_key: double_refund
severity: P0
confidence: medium
status: bug
files: ["backend/app/services/chat_service.py:360"]
exploit_preconditions: []
---
## Observation
Codex thinks P0 medium.
""")

    result = subprocess.run(
        ["python3", str(SCRIPT), str(run_dir), "A-03-C07", "claude"],
        capture_output=True, text=True,
    )
    assert result.returncode == 0, result.stderr
    prompt = result.stdout
    assert "codex" not in prompt.lower()
    assert "P0" in prompt
    assert "medium" in prompt
    assert "chat_service.py:360" in prompt
    assert "P1" in prompt
    assert "high" in prompt
