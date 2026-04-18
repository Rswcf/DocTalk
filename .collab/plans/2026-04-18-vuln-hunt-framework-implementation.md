# Vulnerability-Hunt Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the vuln-hunt framework (enums + 4 scripts + slash command), validate with a dry run, then execute the first full double-blind run and produce a prioritized finding list.

**Architecture:** Two phases. **Phase A** (Tasks 1–7) builds the reusable framework artifacts — YAML enums for the locked matrix, four Python stdlib-only scripts (`vuln_validate`, `vuln_freeze`, `vuln_reconcile`, `vuln_tie_break_prompt`), and the `/vuln-hunt` command + operator skill. **Phase B** (Tasks 8–14) executes the framework once on the current codebase via Claude matrix pass → Codex matrix pass (via `codex exec`) → freeze → free-form → cross-read → reconcile → user checkpoints → tie-break → compose → finalize.

**Tech Stack:** Python 3.11+ stdlib (`yaml` via PyYAML — already a backend dep; `hashlib`, `pathlib`, `json`). Markdown for prompts, docs, and findings. Bash for glue. `codex exec --full-auto -m gpt-5.3-codex` for the second blind agent.

**Spec reference:** `.collab/plans/2026-04-18-vuln-hunt-framework-design.md`

---

## Phase A — Build the Framework

### Task 1: Scaffold directory + matrix enum YAMLs

**Files:**
- Create: `.collab/vuln-hunt/matrix-a-rows.yaml`
- Create: `.collab/vuln-hunt/matrix-a-cols.yaml`
- Create: `.collab/vuln-hunt/matrix-b-rows.yaml`
- Create: `.collab/vuln-hunt/matrix-b-cols.yaml`
- Create: `.collab/vuln-hunt/subsystems.yaml`
- Create: `.collab/vuln-hunt/scripts/` (directory)
- Create: `.collab/vuln-hunt/runs/` (directory)
- Create: `.collab/vuln-hunt/current_run.yaml` (tracks active run ID — prevents `RUN_TS` shell-local drift across tasks)
- Create: `.collab/vuln-hunt/README.md` (one-paragraph pointer to framework.md)

- [ ] **Step 1: Create directory structure + run pointer**

Run:
```bash
mkdir -p .collab/vuln-hunt/scripts .collab/vuln-hunt/runs
printf 'current: null\n' > .collab/vuln-hunt/current_run.yaml
```

`current_run.yaml` holds the timestamp of the active run (set by `/vuln-hunt start`, read by every subsequent subcommand). Never hand-edit.

- [ ] **Step 2: Write matrix-a-rows.yaml (24 ingress rows)**

Content — use these exact keys (enum):

```yaml
# Matrix A — externally-triggerable ingress
# Each row: {key, label, paths}
rows:
  - key: auth_adapter
    label: Auth adapter + magic-link consumption
    paths: ["backend/app/api/auth.py:24", "backend/app/services/auth_service.py:153"]
  - key: documents
    label: /api/documents/* (upload, URL ingest, delete)
    paths: ["backend/app/api/documents.py:162", "backend/app/api/documents.py:280", "backend/app/api/documents.py:616"]
  - key: chat_sse
    label: /api/chat SSE (two-stage debit, mode)
    paths: ["backend/app/api/chat.py:222", "backend/app/api/chat.py:319", "backend/app/services/chat_service.py:278"]
  - key: billing_api
    label: /api/billing/* (checkout, subscribe, portal)
    paths: ["backend/app/api/billing.py:182", "backend/app/api/billing.py:210", "backend/app/api/billing.py:288"]
  - key: billing_webhook
    label: /api/billing/webhook (Stripe-signed)
    paths: ["backend/app/api/billing.py:1250"]
  - key: demo_plane
    label: Demo anonymous plane (limits, forced model)
    paths: ["backend/app/api/chat.py:38", "backend/app/core/rate_limit.py:235"]
  - key: admin_api
    label: /api/admin/* (privileged ops)
    paths: ["backend/app/api/admin.py:27"]
  - key: export_api
    label: /api/export/* (Plus+ gated session export)
    paths: ["backend/app/api/export.py:62"]
  - key: user_crud
    label: /api/{search,collections,sharing,chunks,users,credits} (user CRUD/read)
    paths:
      - "backend/app/api/search.py:19"
      - "backend/app/api/collections.py:72"
      - "backend/app/api/sharing.py:40"
      - "backend/app/api/chunks.py:18"
      - "backend/app/api/users.py:67"
      - "backend/app/api/credits.py:31"
  - key: ops_endpoints
    label: /version, /health, /health?deep=true
    paths: ["backend/app/main.py:189", "backend/app/main.py:194"]
  - key: backend_shared_token
    label: Backend /api/shared/{token}
    paths: ["backend/app/api/sharing.py:40"]
  - key: fastapi_metadata
    label: /openapi.json, /docs, /redoc
    paths: ["backend/app/main.py:153"]
  - key: parse_worker
    label: parse_worker (untrusted bytes)
    paths: ["backend/app/workers/parse_worker.py:101"]
  - key: deletion_worker
    label: deletion_worker (internal state)
    paths: ["backend/app/workers/deletion_worker.py:11"]
  - key: cleanup_tasks
    label: cleanup_tasks (cron)
    paths: ["backend/app/workers/cleanup_tasks.py:15"]
  - key: download_url_mint
    label: Download URL mint + direct MinIO domain
    paths: ["backend/app/api/documents.py:484", "backend/app/services/storage_service.py:116"]
  - key: upload_bootstrap
    label: Upload bootstrap token path
    paths:
      - "frontend/src/app/api/upload-token/route.ts:15"
      - "backend/app/api/documents.py:162"
  - key: frontend_proxy
    label: /api/proxy/[...path] (JWT inject, SSE forward)
    paths: ["frontend/src/app/api/proxy/[...path]/route.ts:46"]
  - key: nextauth_handlers
    label: /api/auth/[...nextauth] (provider handlers)
    paths: ["frontend/src/lib/auth.ts:26"]
  - key: oauth_callbacks
    label: OAuth/email callback subpaths (state, PKCE, magic-link consume)
    paths: ["frontend/src/app/api/auth/[...nextauth]/route.ts:1"]
  - key: frontend_origin_apis
    label: /api/indexnow, /api/csp-report, /api/contact
    paths:
      - "frontend/src/app/api/indexnow/route.ts:53"
      - "frontend/src/app/api/csp-report/route.ts:149"
      - "frontend/src/app/api/contact/route.ts:35"
  - key: stripe_return_urls
    label: Stripe return URL landing (/billing/success, /cancel, portal return)
    paths: ["backend/app/api/billing.py:201"]
  - key: seo_public_surfaces
    label: robots.ts, sitemap.ts, IndexNow key file
    paths: ["frontend/src/app/robots.ts:1", "frontend/src/app/sitemap.ts:1"]
  - key: shared_token_ssr
    label: /shared/[token] SSR fetch path
    paths: ["frontend/src/app/shared/[token]/page.tsx:8"]
```

- [ ] **Step 3: Write matrix-a-cols.yaml (12 threat columns)**

```yaml
# Matrix A — threat columns
columns:
  - key: authn_bypass
    label: AuthN bypass
    definition: Can unauth caller reach endpoint as authenticated?
  - key: authz_idor
    label: AuthZ / IDOR
    definition: Cross-tenant data access or privilege escalation
  - key: interpreter_injection
    label: Interpreter injection
    definition: SQL / command / template / log / header / XSS / HTML / markdown sinks
  - key: input_validation
    label: Input validation
    definition: Magic-byte / size / MIME / URL scheme / path-traversal / Unicode
  - key: ssrf_outbound
    label: SSRF / outbound
    definition: Attacker controls where the server calls
  - key: rate_limit_abuse
    label: Rate limit / abuse
    definition: Missing or bypassable limit, demo quota evasion, fan-out
  - key: idempotency_replay
    label: Idempotency / replay
    definition: Replay causes double-effect
  - key: sensitive_exposure_enum
    label: Sensitive exposure / enumeration
    definition: Secret leak in URL/log/error + account enumeration + timing oracle
  - key: resource_exhaustion
    label: Resource exhaustion
    definition: Memory / CPU / DB pool / Celery slot / bandwidth
  - key: browser_flow_integrity
    label: Browser-flow integrity
    definition: CSRF + Origin/Referer + OAuth state/nonce/PKCE + callbackUrl open-redirect
  - key: concurrency_toctou
    label: Concurrency / TOCTOU
    definition: Race between state check and mutation
  - key: llm_context_isolation
    label: LLM prompt/context isolation
    definition: Untrusted doc/chat content overrides system policy or exfiltrates cross-tenant context
```

- [ ] **Step 4: Write matrix-b-rows.yaml (8 invariants)**

```yaml
# Matrix B — system-wide invariants
rows:
  - key: jwt_double_layer
    label: JWT double-layer consistency (AUTH_SECRET JWE + backend HS256 verify)
  - key: adapter_trust
    label: Internal adapter trust (X-Adapter-Secret — separate from AUTH_SECRET)
  - key: ip_trust_chain
    label: IP trust chain (X-Real-Client-IP + X-Proxy-IP-Secret HMAC)
  - key: feature_gate_split
    label: Feature-gate enforcement split (backend-enforced Sessions/Thorough/Custom Instructions/Export)
  - key: seed_self_heal
    label: Seed demo self-heal (Qdrant count detection)
  - key: minio_lifecycle
    label: MinIO bucket lifecycle + SSE-S3 encryption
  - key: middleware_discipline
    label: No cookies in middleware / no await cookies() in layout
  - key: secret_rotation
    label: Secret rotation coherence (AUTH_SECRET, ADAPTER_SECRET, X-Proxy-IP-Secret, Stripe signing, x-health-secret)
```

- [ ] **Step 5: Write matrix-b-cols.yaml (6 failure modes)**

```yaml
columns:
  - key: bypass
    label: Bypass
    definition: Invariant doesn't hold in some codepath
  - key: desync
    label: Desync
    definition: Two sides of the invariant disagree
  - key: secret_rotation_break
    label: Secret-rotation break
    definition: Rotating one secret silently breaks invariant
  - key: replay_idempotency
    label: Replay / idempotency
    definition: Invariant-protected op replayable
  - key: fail_open_fallback
    label: Fail-open / degraded fallback abuse
    definition: Fallback path (Redis/Qdrant down) itself exploitable
  - key: observability_blind
    label: Observability blind
    definition: Invariant violation emits no log/metric/alert
```

- [ ] **Step 6: Write subsystems.yaml (12 candidates with pick constraints)**

```yaml
buckets:
  billing: [S1, S2]
  llm_processing: [S3, S6, S9a, S9b, S9c]
  free: [S4, S5, S7, S8, S10]

coverage_gate:
  min_unique_subsystems: 5
  picks_per_agent: 3
  picks_per_agent_from_billing: 1
  picks_per_agent_from_llm_processing: 1

subsystems:
  - key: S1
    label: Credits state machine
    scope: pre-debit → stream → reconcile → refund → monthly renewal
  - key: S2
    label: Stripe + subscription lifecycle
    scope: checkout → webhook → renewal → cancel/downgrade → prorate
  - key: S3
    label: Parse worker failure modes
    scope: malformed input, time-limit, retries, idempotency, MinIO/Qdrant consistency
  - key: S4
    label: Auth double-layer
    scope: JWE → HS256 → adapter API, provider linking
  - key: S5
    label: Demo / anonymous plane
    scope: limits, forced model, seed self-heal, crossing to logged-in
  - key: S6
    label: SSE chat pipeline
    scope: stream, disconnect, token accounting, ApiError framing
  - key: S7
    label: Sharing + public access
    scope: /shared/[token], limiter, enumeration
  - key: S8
    label: Feature gate plane
    scope: Plus/Pro split, backend vs frontend, downgrade → data visibility
  - key: S9a
    label: LLM system-prompt integrity
    scope: instruction hierarchy, policy override resistance
  - key: S9b
    label: LLM retrieval boundary
    scope: tenant/document isolation, cross-doc leakage
  - key: S9c
    label: LLM output handling/rendering
    scope: markdown/link/XSS/UI trust
  - key: S10
    label: Object Storage + Artifact Lifecycle Trust
    scope: mint, access, revoke, delete race, shared-link interplay
```

- [ ] **Step 7: Write README.md pointer**

```markdown
# DocTalk Vuln-Hunt Framework

See `../plans/2026-04-18-vuln-hunt-framework-design.md` for the full spec.

**Quick start**: `/vuln-hunt start` in Claude Code — see the `doctalk-vuln-hunt` skill for the step-by-step operator guide.

**Directory layout**:
- `matrix-*.yaml` — locked enum definitions (rows and columns of both matrices)
- `subsystems.yaml` — free-form deep-dive candidate list + pick constraints
- `scripts/` — validation, freeze, reconcile, tie-break prompt generators
- `runs/YYYY-MM-DD-HHMM/` — per-run artifacts, immutable post-freeze
```

- [ ] **Step 8: Commit**

```bash
git add .collab/vuln-hunt/
git commit -m "feat(vuln-hunt): scaffold framework enums and directory layout"
```

---

### Task 2: Implement `vuln_validate.py` with TDD

**Files:**
- Create: `.collab/vuln-hunt/scripts/vuln_validate.py`
- Create: `.collab/vuln-hunt/scripts/test_vuln_validate.py`
- Create: `.collab/vuln-hunt/scripts/fixtures/valid-finding.md`
- Create: `.collab/vuln-hunt/scripts/fixtures/valid-matrix-b-finding.md`
- Create: `.collab/vuln-hunt/scripts/fixtures/invalid-finding-bad-cell-id.md`
- Create: `.collab/vuln-hunt/scripts/fixtures/invalid-finding-unknown-row-key.md`
- Create: `.collab/vuln-hunt/scripts/fixtures/invalid-matrix-b-missing-invariant-state.md`

Purpose: parse a finding markdown file, validate YAML frontmatter against the locked enums, return structured errors.

- [ ] **Step 1: Write test fixtures**

**Cell-ID convention** (used throughout plan): `{A|B}-RR-{C|D}CC` where `RR` is 2-digit row (01–24 for A, 01–08 for B) and `CC` is 2-digit column (01–12 for A, 01–06 for B). Always zero-padded to keep string sort = numerical sort.

`fixtures/valid-finding.md`:
```markdown
---
id: A-03-C07-01
matrix: A
agent: claude
cell_id: A-03-C07
row_key: chat_sse
column_key: idempotency_replay
finding_key: credit_refund_double_refund_on_retry
severity: P1
confidence: high
status: bug
files: ["backend/app/services/chat_service.py:350"]
exploit_preconditions: ["authenticated user", "network retry during SSE"]
---

## Observation
Chat retry can cause double-refund when the SSE disconnects after reconcile but before ledger commit.

## Impact
User gets free credits back twice.

## Repro / Evidence
1. Start chat request. 2. Kill connection at t=5s. 3. Retry. 4. Observe balance.

## Suggested Fix
Wrap reconcile + commit in single transaction.
```

`fixtures/valid-matrix-b-finding.md`:
```markdown
---
id: B-03-D01-01
matrix: B
agent: claude
cell_id: B-03-D01
row_key: ip_trust_chain
column_key: bypass
finding_key: hmac_compare_timing_variance
severity: P2
confidence: medium
status: deficiency
invariant_state: partial
files: ["backend/app/core/rate_limit.py:267"]
exploit_preconditions: ["direct backend access"]
---

## Observation
`hmac.compare_digest` is used, but preceding `settings.AUTH_SECRET` truthiness check can short-circuit.

## Impact
Low — would require direct backend exposure.

## Suggested Fix
Keep constant-time check even for empty-secret case.
```

`fixtures/invalid-finding-bad-cell-id.md` — same as valid but `cell_id: A-99-C07` (row out of range).
`fixtures/invalid-finding-unknown-row-key.md` — same as valid but `row_key: unknown_row`.
`fixtures/invalid-matrix-b-missing-invariant-state.md` — valid Matrix B frontmatter **minus** the `invariant_state` field.

- [ ] **Step 2: Write failing test**

```python
# test_vuln_validate.py
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
```

- [ ] **Step 3: Run test, confirm failure**

Run: `cd .collab/vuln-hunt/scripts && python3 -m pytest test_vuln_validate.py -v`
Expected: all FAIL — script missing.

- [ ] **Step 4: Implement `vuln_validate.py`**

```python
#!/usr/bin/env python3
"""Validate a finding markdown file against locked matrix enums.

Exits 0 on valid, non-zero on error with diagnostic on stderr.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

import yaml  # PyYAML — already a backend dependency

REPO_ROOT = Path(__file__).resolve().parents[3]
VULN_HUNT_ROOT = REPO_ROOT / ".collab" / "vuln-hunt"

REQUIRED_FIELDS = {
    "id", "matrix", "agent", "cell_id", "row_key", "column_key",
    "finding_key", "severity", "confidence", "status",
    "files", "exploit_preconditions",
}
VALID_AGENTS = {"claude", "codex"}
VALID_MATRICES = {"A", "B"}
VALID_SEVERITY = {"P0", "P1", "P2", "P3"}
VALID_CONFIDENCE = {"high", "medium", "low"}
VALID_STATUS = {"bug", "risk", "deficiency", "clear", "unreviewed", "not_applicable"}
VALID_INVARIANT_STATE = {"held", "partial", "broken"}


def load_enum(path: Path, root_key: str) -> set[str]:
    data = yaml.safe_load(path.read_text())
    return {item["key"] for item in data[root_key]}


def parse_frontmatter(text: str) -> dict:
    m = re.match(r"^---\n(.*?)\n---\n", text, re.DOTALL)
    if not m:
        raise ValueError("missing YAML frontmatter")
    return yaml.safe_load(m.group(1)) or {}


def validate(path: Path) -> list[str]:
    errors: list[str] = []
    text = path.read_text()
    try:
        fm = parse_frontmatter(text)
    except ValueError as e:
        return [str(e)]

    missing = REQUIRED_FIELDS - fm.keys()
    if missing:
        errors.append(f"missing required fields: {sorted(missing)}")

    if fm.get("matrix") not in VALID_MATRICES:
        errors.append(f"matrix must be one of {VALID_MATRICES}")

    if fm.get("agent") not in VALID_AGENTS:
        errors.append(f"agent must be one of {VALID_AGENTS}")

    if fm.get("severity") not in VALID_SEVERITY:
        errors.append(f"severity must be one of {VALID_SEVERITY}")

    if fm.get("confidence") not in VALID_CONFIDENCE:
        errors.append(f"confidence must be one of {VALID_CONFIDENCE}")

    if fm.get("status") not in VALID_STATUS:
        errors.append(f"status must be one of {VALID_STATUS}")

    matrix = fm.get("matrix")
    if matrix == "A":
        rows = load_enum(VULN_HUNT_ROOT / "matrix-a-rows.yaml", "rows")
        cols = load_enum(VULN_HUNT_ROOT / "matrix-a-cols.yaml", "columns")
    elif matrix == "B":
        rows = load_enum(VULN_HUNT_ROOT / "matrix-b-rows.yaml", "rows")
        cols = load_enum(VULN_HUNT_ROOT / "matrix-b-cols.yaml", "columns")
        if fm.get("invariant_state") not in VALID_INVARIANT_STATE:
            errors.append(
                f"Matrix B finding must set invariant_state to one of {VALID_INVARIANT_STATE}"
            )
    else:
        rows = cols = set()

    if "row_key" in fm and fm["row_key"] not in rows:
        errors.append(f"row_key {fm['row_key']!r} not in matrix {matrix} enum")

    if "column_key" in fm and fm["column_key"] not in cols:
        errors.append(f"column_key {fm['column_key']!r} not in matrix {matrix} enum")

    # cell_id format: A-RR-CCC or B-RR-DCC; zero-padded 2-digit row + 2-digit column
    cell_id = fm.get("cell_id", "")
    cell_match = re.match(r"^([AB])-(\d{2})-([CD])(\d{2})$", cell_id)
    if not cell_match:
        errors.append(f"cell_id {cell_id!r} does not match ^[AB]-\\d{{2}}-[CD]\\d{{2}}$")
    else:
        letter, row_num, col_letter, col_num = cell_match.groups()
        row_i, col_i = int(row_num), int(col_num)
        if letter == "A" and (not (1 <= row_i <= 24) or not (1 <= col_i <= 12) or col_letter != "C"):
            errors.append(f"cell_id {cell_id!r} out of Matrix A range (row 01-24, col C01-C12)")
        if letter == "B" and (not (1 <= row_i <= 8) or not (1 <= col_i <= 6) or col_letter != "D"):
            errors.append(f"cell_id {cell_id!r} out of Matrix B range (row 01-08, col D01-D06)")

    if not isinstance(fm.get("files"), list):
        errors.append("files must be an array")
    if not isinstance(fm.get("exploit_preconditions"), list):
        errors.append("exploit_preconditions must be an array")

    return errors


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("usage: vuln_validate.py <finding.md>", file=sys.stderr)
        return 2
    path = Path(argv[1])
    errors = validate(path)
    if errors:
        print(f"INVALID: {path}", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
```

- [ ] **Step 5: Run tests, confirm pass**

Run: `cd .collab/vuln-hunt/scripts && python3 -m pytest test_vuln_validate.py -v`
Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add .collab/vuln-hunt/scripts/vuln_validate.py .collab/vuln-hunt/scripts/test_vuln_validate.py .collab/vuln-hunt/scripts/fixtures/
git commit -m "feat(vuln-hunt): vuln_validate.py with schema enum tests"
```

---

### Task 3: Implement `vuln_freeze.py` with TDD

**Files:**
- Create: `.collab/vuln-hunt/scripts/vuln_freeze.py`
- Create: `.collab/vuln-hunt/scripts/test_vuln_freeze.py`

Purpose: compute sha256 of every file under a run's agent tree, emit `freeze.yaml` with hashes + timestamp. Refuses to freeze if any file was modified after a freeze.yaml already exists.

- [ ] **Step 1: Write failing test**

```python
# test_vuln_freeze.py
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
    # sha256 is 64 hex chars
    for entry in data["files"].values():
        assert len(entry) == 64

def test_freeze_rejects_refreeze_when_contents_changed(tmp_path):
    tree = tmp_path / "agent"
    tree.mkdir()
    (tree / "a.md").write_text("v1")
    subprocess.run(["python3", str(SCRIPT), str(tree)], check=True)

    (tree / "a.md").write_text("v2")  # modify
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

    # add files under crossread/ and tie-break/ — must NOT invalidate freeze
    (tree / "crossread" / "S1.md").write_text("added later")
    (tree / "tie-break" / "A-03-C07-round1.md").write_text("added later")
    result = subprocess.run(
        ["python3", str(SCRIPT), str(tree)],
        capture_output=True, text=True,
    )
    assert result.returncode == 0, result.stderr
```

- [ ] **Step 2: Run test, confirm failure**

Run: `python3 -m pytest .collab/vuln-hunt/scripts/test_vuln_freeze.py -v`
Expected: FAIL — script missing.

- [ ] **Step 3: Implement `vuln_freeze.py`**

```python
#!/usr/bin/env python3
"""Freeze an agent's output tree by computing sha256 hashes + a timestamp.

Once frozen, any subsequent modification must go to a crossread/ subtree
(append-only by convention; enforced at reconcile time).
"""
from __future__ import annotations

import hashlib
import sys
from datetime import datetime, timezone
from pathlib import Path

import yaml


def sha256_file(p: Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


EXCLUDED_PREFIXES = ("crossread/", "tie-break/")


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
        # identical re-freeze is a no-op
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
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `python3 -m pytest .collab/vuln-hunt/scripts/test_vuln_freeze.py -v`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add .collab/vuln-hunt/scripts/vuln_freeze.py .collab/vuln-hunt/scripts/test_vuln_freeze.py
git commit -m "feat(vuln-hunt): vuln_freeze.py with sha256 and refreeze guard"
```

---

### Task 4: Implement `vuln_reconcile.py` with TDD

**Files:**
- Create: `.collab/vuln-hunt/scripts/vuln_reconcile.py`
- Create: `.collab/vuln-hunt/scripts/test_vuln_reconcile.py`

Purpose: walk `claude/` and `codex/` trees, emit `reconcile-raw.yaml` with `alignment` tags per cell per Section 5 Stage 1.

- [ ] **Step 1: Write failing test**

```python
# test_vuln_reconcile.py
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
    """Manifest is a TOP-LEVEL list of cells (matches design spec §3)."""
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
    # codex: cell is clear, no finding file, manifest entry only
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
```

- [ ] **Step 2: Run test, confirm failure**

Run: `python3 -m pytest .collab/vuln-hunt/scripts/test_vuln_reconcile.py -v`
Expected: 3 FAIL — script missing.

- [ ] **Step 3: Implement `vuln_reconcile.py`**

```python
#!/usr/bin/env python3
"""Diff Claude and Codex outputs into reconcile-raw.yaml per Section 5."""
from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Optional

import yaml

SEVERITY_RANK = {"P0": 0, "P1": 1, "P2": 2, "P3": 3}


def parse_frontmatter(text: str) -> dict:
    m = re.match(r"^---\n(.*?)\n---\n", text, re.DOTALL)
    if not m:
        return {}
    return yaml.safe_load(m.group(1)) or {}


def load_findings(tree: Path) -> dict[str, dict]:
    out: dict[str, dict] = {}
    findings_dir = tree / "findings"
    if not findings_dir.is_dir():
        return out
    for f in findings_dir.iterdir():
        if not f.is_file() or not f.suffix == ".md":
            continue
        fm = parse_frontmatter(f.read_text())
        if "cell_id" not in fm:
            continue
        out[fm["cell_id"]] = fm
    return out


def load_manifest(tree: Path) -> dict[str, dict]:
    """Manifest is a TOP-LEVEL list of cells (design spec §3)."""
    path = tree / "manifest.yaml"
    if not path.exists():
        return {}
    data = yaml.safe_load(path.read_text()) or []
    if isinstance(data, dict):  # tolerate legacy {entries: [...]} shape
        data = data.get("entries", [])
    return {e["cell_id"]: e for e in data}


def classify(claude: Optional[dict], codex: Optional[dict],
             claude_state: str, codex_state: str) -> dict:
    """Return {alignment, severity_gap, p0_asymmetry, severity_disputed}.

    Design spec §5 Stage 2 triage rules:
    - gap == 0                              → agree
    - gap == 1 AND no P0 asymmetry          → agree, mark severity_disputed
    - gap >= 2 OR P0 asymmetry              → same_finding_different_severity (tie-break)
    """
    # Precedence: unreviewed → root-cause mismatch → severity mismatch
    if claude_state == "unreviewed" and codex_state == "unreviewed":
        return {"alignment": "both_unreviewed"}
    if claude_state == "unreviewed" or codex_state == "unreviewed":
        return {"alignment": "one_unreviewed"}
    if claude_state == "clear" and codex_state == "clear":
        return {"alignment": "both_clear"}
    if claude is None and codex is not None:
        return {"alignment": "only_codex"}
    if codex is None and claude is not None:
        return {"alignment": "only_claude"}
    if claude["finding_key"] != codex["finding_key"]:
        return {"alignment": "same_cell_different_finding"}

    sev_gap = abs(SEVERITY_RANK[claude["severity"]] - SEVERITY_RANK[codex["severity"]])
    p0_asymmetry = (claude["severity"] == "P0") != (codex["severity"] == "P0")
    if sev_gap == 0:
        return {"alignment": "agree", "severity_gap": 0, "p0_asymmetry": False}
    if sev_gap == 1 and not p0_asymmetry:
        return {
            "alignment": "agree",
            "severity_gap": 1,
            "p0_asymmetry": False,
            "severity_disputed": True,
        }
    return {
        "alignment": "same_finding_different_severity",
        "severity_gap": sev_gap,
        "p0_asymmetry": p0_asymmetry,
    }


def main(argv: list[str]) -> int:
    if len(argv) != 4:
        print("usage: vuln_reconcile.py <claude-dir> <codex-dir> <out.yaml>",
              file=sys.stderr)
        return 2
    claude_dir, codex_dir, out_path = Path(argv[1]), Path(argv[2]), Path(argv[3])
    claude_findings = load_findings(claude_dir)
    codex_findings = load_findings(codex_dir)
    claude_manifest = load_manifest(claude_dir)
    codex_manifest = load_manifest(codex_dir)

    all_cells = set(claude_findings) | set(codex_findings) \
        | set(claude_manifest) | set(codex_manifest)

    records = []
    for cell in sorted(all_cells):
        c_fm = claude_findings.get(cell)
        x_fm = codex_findings.get(cell)
        c_state = claude_manifest.get(cell, {}).get("state", "unreviewed")
        x_state = codex_manifest.get(cell, {}).get("state", "unreviewed")
        record = {
            "cell_id": cell,
            "claude": {
                "state": c_state,
                **({"severity": c_fm["severity"],
                    "confidence": c_fm["confidence"],
                    "finding_key": c_fm["finding_key"]} if c_fm else {}),
            },
            "codex": {
                "state": x_state,
                **({"severity": x_fm["severity"],
                    "confidence": x_fm["confidence"],
                    "finding_key": x_fm["finding_key"]} if x_fm else {}),
            },
            **classify(c_fm, x_fm, c_state, x_state),
        }
        records.append(record)

    out_path.write_text(yaml.safe_dump({"records": records}, sort_keys=False))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `python3 -m pytest .collab/vuln-hunt/scripts/test_vuln_reconcile.py -v`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add .collab/vuln-hunt/scripts/vuln_reconcile.py .collab/vuln-hunt/scripts/test_vuln_reconcile.py
git commit -m "feat(vuln-hunt): vuln_reconcile.py with alignment tagging"
```

---

### Task 5: Implement `vuln_tie_break_prompt.py` with TDD

**Files:**
- Create: `.collab/vuln-hunt/scripts/vuln_tie_break_prompt.py`
- Create: `.collab/vuln-hunt/scripts/test_vuln_tie_break_prompt.py`

Purpose: given a disputed cell in `reconcile-raw.yaml`, generate an **anonymized** tie-break prompt (the other agent's identity stripped — only evidence/paths/lines exposed) per Section 5 Stage 3.

- [ ] **Step 1: Write failing test**

```python
# test_vuln_tie_break_prompt.py
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
    # Must NOT reveal that the other side is codex
    assert "codex" not in prompt.lower()
    # Must include the dissenting evidence
    assert "P0" in prompt
    assert "medium" in prompt
    assert "chat_service.py:360" in prompt
    # Must reference Claude's own prior position
    assert "P1" in prompt
    assert "high" in prompt
```

- [ ] **Step 2: Run test, confirm failure**

Run: `python3 -m pytest .collab/vuln-hunt/scripts/test_vuln_tie_break_prompt.py -v`
Expected: FAIL — script missing.

- [ ] **Step 3: Implement `vuln_tie_break_prompt.py`**

```python
#!/usr/bin/env python3
"""Generate an anonymized tie-break prompt for a disputed cell."""
from __future__ import annotations

import re
import sys
from pathlib import Path

import yaml

TEMPLATE = """# Tie-Break: {cell_id}

You previously assessed cell **{cell_id}** ({row_key} × {column_key}) as **severity={own_severity}** with **confidence={own_confidence}**, finding_key `{own_finding_key}`.

The parallel reviewer assessed the same cell as **severity={other_severity}** with **confidence={other_confidence}**, finding_key `{other_finding_key}`.

Their evidence (verbatim, agent identity redacted):

---
{other_body}
---

Your task: re-examine the referenced code path. Do you revise, hold, or adjust? Ground your answer in specific file:line evidence.

Output format:
```
new_severity: P0|P1|P2|P3
new_confidence: high|medium|low
rationale: <one paragraph>
```
"""


def parse_finding(path: Path) -> tuple[dict, str]:
    text = path.read_text()
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.DOTALL)
    if not m:
        raise ValueError(f"no frontmatter in {path}")
    return yaml.safe_load(m.group(1)) or {}, m.group(2)


def find_cell(tree: Path, cell_id: str) -> Path | None:
    findings = tree / "findings"
    if not findings.is_dir():
        return None
    for f in findings.iterdir():
        if f.name.startswith(cell_id + "-"):
            return f
    return None


def anonymize(body: str) -> str:
    # Strip references to either agent name
    return re.sub(r"\b(claude|codex)\b", "<agent>", body, flags=re.IGNORECASE)


def main(argv: list[str]) -> int:
    if len(argv) != 4:
        print("usage: vuln_tie_break_prompt.py <run-dir> <cell_id> <requesting-agent>",
              file=sys.stderr)
        return 2
    run_dir, cell_id, requesting = Path(argv[1]), argv[2], argv[3]
    other = "codex" if requesting == "claude" else "claude"

    own_path = find_cell(run_dir / requesting, cell_id)
    other_path = find_cell(run_dir / other, cell_id)
    if not own_path or not other_path:
        print(f"missing finding file for cell {cell_id}", file=sys.stderr)
        return 1

    own_fm, _ = parse_finding(own_path)
    other_fm, other_body = parse_finding(other_path)

    print(TEMPLATE.format(
        cell_id=cell_id,
        row_key=own_fm["row_key"],
        column_key=own_fm["column_key"],
        own_severity=own_fm["severity"],
        own_confidence=own_fm["confidence"],
        own_finding_key=own_fm["finding_key"],
        other_severity=other_fm["severity"],
        other_confidence=other_fm["confidence"],
        other_finding_key=other_fm["finding_key"],
        other_body=anonymize(other_body).strip(),
    ))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `python3 -m pytest .collab/vuln-hunt/scripts/test_vuln_tie_break_prompt.py -v`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add .collab/vuln-hunt/scripts/vuln_tie_break_prompt.py .collab/vuln-hunt/scripts/test_vuln_tie_break_prompt.py
git commit -m "feat(vuln-hunt): vuln_tie_break_prompt.py with agent anonymization"
```

---

### Task 6: Write `/vuln-hunt` slash command + `doctalk-vuln-hunt` skill

**Files:**
- Create: `.claude/commands/vuln-hunt.md`
- Create: `.claude/skills/doctalk-vuln-hunt/SKILL.md`

- [ ] **Step 1: Write the slash command**

`.claude/commands/vuln-hunt.md`:
```markdown
---
description: Run the DocTalk vulnerability-hunt framework (double-blind Claude+Codex)
argument-hint: "<start|codex-dispatch|freeze|cross-read|reconcile|stage2-checkpoint|tie-break|compose|finalize>"
---

Run the vuln-hunt framework subcommand `$ARGUMENTS`.

Load the skill `doctalk-vuln-hunt` for full operator instructions. The skill defines the state machine and all commands. Before running any subcommand, check `.collab/vuln-hunt/runs/<current-run>/run-state.yaml` to confirm the prior step completed.

If `$ARGUMENTS` is empty, treat as `start` for a fresh run — but first confirm with the user that it's OK to begin a full run (~7–9 hours wall-clock).
```

- [ ] **Step 2: Write the skill operator guide**

`.claude/skills/doctalk-vuln-hunt/SKILL.md`:
```markdown
---
name: doctalk-vuln-hunt
description: Execute the DocTalk vulnerability-hunt framework in double-blind Claude+Codex mode. Activates when the user invokes /vuln-hunt or asks to "run the vuln audit", "hunt bugs systematically", or "execute the vuln-hunt framework".
---

# DocTalk Vuln-Hunt Framework — Operator Skill

Full design: `.collab/plans/2026-04-18-vuln-hunt-framework-design.md`
Framework artifacts: `.collab/vuln-hunt/`

## State Machine

Every run goes through these steps in order. Each step writes its state to `runs/<ts>/run-state.yaml`. Steps cannot be skipped.

`start → codex-dispatch → freeze → cross-read → reconcile → stage2-checkpoint → tie-break → compose → finalize`

## Commands

### `/vuln-hunt start`
1. Create `runs/$(date -u +%Y-%m-%d-%H%M)/` with `claude/`, `codex/` subtrees.
2. Write `run-state.yaml` with `state: started`, current `git_sha`, `script_version`.
3. Claude: for each of the 24 Matrix A rows × 12 columns + 8 Matrix B rows × 6 columns = 336 cells, read the referenced code, produce a finding file (non-clear cells) and a manifest entry (every cell). Produce 3 free-form narratives per Section 4 bucket constraints.
4. Validate every finding with `vuln_validate.py`.

### `/vuln-hunt codex-dispatch`
Invoke Codex via `cat <prompt> | codex exec --full-auto -m gpt-5.3-codex -C <repo-root>` with a prompt that includes: (a) the full locked matrix YAMLs, (b) bucket constraints, (c) schema + severity calibration, (d) explicit instruction NOT to read Claude's `claude/` tree. Codex writes to `codex/`.

### `/vuln-hunt freeze`
Run `vuln_freeze.py claude/` and `vuln_freeze.py codex/`. Emit two `freeze.yaml` files. From here, any in-place modification is rejected.

### `/vuln-hunt cross-read`
Each agent reads the OTHER agent's `freeform/` narratives and appends a `crossread/S<#>-<name>.md` file. Rules per Section 4 Step 3: only `disagree`, `missed-threat`, `reasoning-hole` comments; new findings tagged `late-add`.

### `/vuln-hunt reconcile`
Run `vuln_reconcile.py claude/ codex/ reconcile-raw.yaml`.

### `/vuln-hunt stage2-checkpoint`
**USER INTERACTION**. Summarize the 7 triage buckets with counts; ask user to approve before tie-break spend.

### `/vuln-hunt tie-break`
For each disputed cell, run `vuln_tie_break_prompt.py` to generate anonymized prompts. Send to dissenting agent. Max 2 rounds per cell. Outputs go to `tie-break/<cell_id>-roundN.md`.

### `/vuln-hunt compose`
On post-tiebreak accepted findings, cross-reference shared resources (credit ledger, MinIO object, user record, verification token) and emit `composition-candidates.yaml`.

### `/vuln-hunt finalize`
**USER INTERACTION** at Stage 5. Emit `../../plans/<ts>-vuln-hunt-findings.md` + `<ts>-vuln-hunt-findings.yaml`. Split into `actionable_fixes` and `confirmation_needed`. Each finding gets `VHF-YYYY-MM-DD-NNN` stable ID.

## Safety Rails
- No agent executes exploits. Findings are code-reading + reasoning only.
- Scripts reject writes outside `.collab/vuln-hunt/runs/<current-run>/`.
- Codex is always invoked with `--full-auto -m gpt-5.3-codex -C <repo-root>` and prompted NOT to read `claude/`.

## Time Budget
First full run: ~7–9 hours wall-clock, 2 sessions.

## Cadence
Baseline every 8 weeks; ad-hoc before major releases or after architecture changes to auth, billing, or parser.
```

- [ ] **Step 3: Commit**

```bash
git add .claude/commands/vuln-hunt.md .claude/skills/doctalk-vuln-hunt/SKILL.md
git commit -m "feat(vuln-hunt): /vuln-hunt command and doctalk-vuln-hunt skill"
```

---

### Task 7: Integration dry-run

**Files:**
- Create: `.collab/vuln-hunt/runs/2026-04-18-dryrun/claude/findings/A-03-C07-double_refund.md`
- Create: `.collab/vuln-hunt/runs/2026-04-18-dryrun/claude/manifest.yaml`
- Create: `.collab/vuln-hunt/runs/2026-04-18-dryrun/codex/findings/A-03-C07-double_refund.md`
- Create: `.collab/vuln-hunt/runs/2026-04-18-dryrun/codex/manifest.yaml`

Purpose: a synthetic one-cell run that exercises `validate → freeze → reconcile → tie_break_prompt` end-to-end. No real bug hunting yet. Purpose is to prove the pipeline works before committing ~8 hours.

- [ ] **Step 1: Write synthetic Claude finding + manifest**

Copy the valid-finding fixture from Task 2 Step 1 into `runs/2026-04-18-dryrun/claude/findings/A-03-C07-double_refund.md`. Then write the manifest at `runs/2026-04-18-dryrun/claude/manifest.yaml` — **top-level list**:

```yaml
- cell_id: A-03-C07
  state: finding
  severity: P1
  confidence: high
  finding_ref: A-03-C07-01
```

Create empty `crossread/` subdir: `mkdir -p runs/2026-04-18-dryrun/claude/{findings,crossread,freeform}`.

- [ ] **Step 2: Write synthetic Codex finding + manifest (deliberate P0/P1 asymmetry → tie-break)**

Same `cell_id` (`A-03-C07`), same `finding_key` (`double_refund`), but `severity: P0`, `confidence: medium`, `agent: codex`. Codex manifest same shape but with `severity: P0`.

- [ ] **Step 3: Validate both**

Run:
```bash
python3 .collab/vuln-hunt/scripts/vuln_validate.py \
  .collab/vuln-hunt/runs/2026-04-18-dryrun/claude/findings/A-03-C07-double_refund.md
python3 .collab/vuln-hunt/scripts/vuln_validate.py \
  .collab/vuln-hunt/runs/2026-04-18-dryrun/codex/findings/A-03-C07-double_refund.md
```
Expected: both exit 0.

- [ ] **Step 4: Freeze both trees**

Run:
```bash
python3 .collab/vuln-hunt/scripts/vuln_freeze.py .collab/vuln-hunt/runs/2026-04-18-dryrun/claude
python3 .collab/vuln-hunt/scripts/vuln_freeze.py .collab/vuln-hunt/runs/2026-04-18-dryrun/codex
```
Expected: each creates `freeze.yaml`.

- [ ] **Step 5: Reconcile**

Run:
```bash
python3 .collab/vuln-hunt/scripts/vuln_reconcile.py \
  .collab/vuln-hunt/runs/2026-04-18-dryrun/claude \
  .collab/vuln-hunt/runs/2026-04-18-dryrun/codex \
  .collab/vuln-hunt/runs/2026-04-18-dryrun/reconcile-raw.yaml
```
Expected: `reconcile-raw.yaml` contains one record with `alignment: same_finding_different_severity`, `severity_gap: 1`, `p0_asymmetry: true`.

- [ ] **Step 6: Generate tie-break prompt (anonymized)**

Run:
```bash
python3 .collab/vuln-hunt/scripts/vuln_tie_break_prompt.py \
  .collab/vuln-hunt/runs/2026-04-18-dryrun A-03-C07 claude
```
Expected: stdout includes "P0" and "medium" and file paths, but the word `codex` never appears.

- [ ] **Step 7: Commit**

```bash
git add .collab/vuln-hunt/runs/2026-04-18-dryrun/
git commit -m "test(vuln-hunt): dry-run fixture exercises full pipeline"
```

**Phase A Gate**: do NOT proceed to Phase B until every test in Tasks 2–5 passes and the Task 7 dry-run produces the expected outputs. Report `PHASE A COMPLETE` to the user and await explicit approval to start Phase B (the real run).

---

## Phase B — Execute First Full Run

### Task 8: Claude matrix pass (336 cells)

**Files:**
- Create: `.collab/vuln-hunt/runs/<real-ts>/claude/manifest.yaml`
- Create: `.collab/vuln-hunt/runs/<real-ts>/claude/findings/<cell_id>-<finding_key>.md` (per non-clear cell)

- [ ] **Step 1: Create run directory + persist run ID**

```bash
RUN_TS=$(date -u +%Y-%m-%d-%H%M)
mkdir -p .collab/vuln-hunt/runs/${RUN_TS}/claude/{findings,freeform,crossread}
mkdir -p .collab/vuln-hunt/runs/${RUN_TS}/codex/{findings,freeform,crossread}
mkdir -p .collab/vuln-hunt/runs/${RUN_TS}/tie-break
GIT_SHA=$(git rev-parse HEAD)
cat > .collab/vuln-hunt/runs/${RUN_TS}/run-state.yaml <<EOF
state: started
git_sha: ${GIT_SHA}
script_version: 1
claude_matrix_done: false
claude_freeform_done: false
codex_done: false
freeze_done: false
reconcile_done: false
tiebreak_done: false
compose_done: false
EOF
# Persist the active run ID so every subsequent task uses the same path
printf 'current: %s\n' "${RUN_TS}" > .collab/vuln-hunt/current_run.yaml
```

**All subsequent Phase B tasks read the active run ID with**:
```bash
RUN_TS=$(python3 -c "import yaml,pathlib;print(yaml.safe_load(pathlib.Path('.collab/vuln-hunt/current_run.yaml').read_text())['current'])")
RUN_DIR=".collab/vuln-hunt/runs/${RUN_TS}"
```

- [ ] **Step 2: Matrix A pass (24 × 12 = 288 cells)**

Iterate: for each row (read `matrix-a-rows.yaml`), for each column (read `matrix-a-cols.yaml`):
1. Read the row's referenced `paths`.
2. Consider the column's threat definition.
3. Decide: finding, clear, unreviewed, or not_applicable.
4. If finding, write `findings/<cell_id>-<finding_key>.md` per the schema.
5. Record the cell's state in `manifest.yaml`.

Budget 20–30 seconds per cell. Keep findings tight (≤300 words body).

- [ ] **Step 3: Matrix B pass (8 × 6 = 48 cells)**

Same pattern. Each Matrix B finding MUST set `invariant_state: held|partial|broken`.

- [ ] **Step 4: Validate every finding** (glob-safe via Python)

```bash
python3 - "${RUN_DIR}" <<'PY'
import pathlib, subprocess, sys
run_dir = pathlib.Path(sys.argv[1])
findings = sorted((run_dir / "claude" / "findings").glob("*.md"))
if not findings:
    print("FAIL: Claude produced no findings — unexpected for a full matrix pass", file=sys.stderr)
    sys.exit(1)
for f in findings:
    r = subprocess.run(["python3", ".collab/vuln-hunt/scripts/vuln_validate.py", str(f)],
                       capture_output=True, text=True)
    if r.returncode != 0:
        print(f"FAIL at {f}:\n{r.stderr}", file=sys.stderr)
        sys.exit(1)
print(f"validated {len(findings)} Claude findings")
PY
```
Expected stdout: `validated N Claude findings` for N > 0.

- [ ] **Step 5: Update run-state**

Edit `${RUN_DIR}/run-state.yaml`: flip `claude_matrix_done: true`.

- [ ] **Step 6: Checkpoint commit (Phase B protects against long-run loss)**

```bash
git add "${RUN_DIR}/claude/" "${RUN_DIR}/run-state.yaml" .collab/vuln-hunt/current_run.yaml
git commit -m "vuln-hunt(${RUN_TS}): claude matrix pass complete"
```

---

### Task 9: Claude free-form pass (3 subsystems)

- [ ] **Step 1: Pick 3 subsystems per bucket constraints**

Per `subsystems.yaml`:
- 1 from `{S1, S2}`
- 1 from `{S3, S6, S9a, S9b, S9c}`
- 1 free pick from `{S4, S5, S7, S8, S10}`

Write picks + one-sentence justifications to `freeform/picks.yaml`.

- [ ] **Step 2: Write one narrative per pick**

Per Section 4 structure: `Scope / Model / Data-Control Flow / Threats Considered / Findings / Interactions`. Cap 1500 words each. Save to `freeform/S<#>-<slug>.md`.

- [ ] **Step 3: Update run-state**

Edit `run-state.yaml`: `claude_freeform_done: true`.

- [ ] **Step 4: Pre-Codex sanity gate** (must-fix per Codex r1 review)

Verify Claude's pass is complete and clean before spending on Codex. Run:

```bash
python3 - <<'PY'
import yaml, sys, pathlib
run = pathlib.Path(".collab/vuln-hunt/runs") / yaml.safe_load(
    pathlib.Path(".collab/vuln-hunt/current_run.yaml").read_text())["current"]
manifest = yaml.safe_load((run / "claude" / "manifest.yaml").read_text()) or []
cells = {e["cell_id"] for e in manifest}
expected = {
    f"A-{r:02d}-C{c:02d}" for r in range(1, 25) for c in range(1, 13)
} | {f"B-{r:02d}-D{c:02d}" for r in range(1, 9) for c in range(1, 7)}
missing = expected - cells
if missing:
    print(f"FAIL: Claude manifest missing {len(missing)} cells: {sorted(missing)[:10]}...", file=sys.stderr)
    sys.exit(1)
picks = yaml.safe_load((run / "claude" / "freeform" / "picks.yaml").read_text())
subs = yaml.safe_load(pathlib.Path(".collab/vuln-hunt/subsystems.yaml").read_text())
billing = set(subs["buckets"]["billing"])
llm = set(subs["buckets"]["llm_processing"])
free = set(subs["buckets"]["free"])
picks_list = picks["picks"]
# Strict count check BEFORE dedupe
if len(picks_list) != 3:
    print(f"FAIL: picks.yaml must list exactly 3 picks, got {len(picks_list)}", file=sys.stderr)
    sys.exit(1)
chosen_keys = [p["key"] for p in picks_list]
if len(set(chosen_keys)) != 3:
    print(f"FAIL: picks contain duplicates: {chosen_keys}", file=sys.stderr)
    sys.exit(1)
chosen = set(chosen_keys)
if not (chosen & billing):
    print(f"FAIL: no pick from billing bucket {billing}", file=sys.stderr)
    sys.exit(1)
if not (chosen & llm):
    print(f"FAIL: no pick from llm_processing bucket {llm}", file=sys.stderr)
    sys.exit(1)
known = billing | llm | free
unknown = chosen - known
if unknown:
    print(f"FAIL: picks {unknown} are not in any known bucket", file=sys.stderr)
    sys.exit(1)
print("Claude pass clean — ready to dispatch Codex.")
PY
```

Expected stdout: `Claude pass clean — ready to dispatch Codex.` If FAIL, fix gaps before Task 10.

---

### Task 10: Codex matrix + free-form pass via `codex exec` (chunked)

**Chunking rationale**: 336 cells + freeform in a single `codex exec` call is unreliable (context limits, ragged output, no resume). Split into **6 chunks**: 4 Matrix A batches (rows 1–6, 7–12, 13–18, 19–24), 1 Matrix B batch, 1 freeform batch. Each chunk independently validated. Resume from manifest if a chunk fails.

**Files:**
- Create: `/tmp/vuln-framework/codex-run-prompt-<chunk>.md` (6 files)
- Produced by Codex: `${RUN_DIR}/codex/…`

- [ ] **Step 1: Generate the 6 chunk prompts**

Each chunk prompt follows this template (example shown for Matrix A rows 1–6):

```markdown
# DocTalk Vuln-Hunt — Codex Chunk: Matrix A rows 1–6

You are the second agent in a double-blind vulnerability hunt. Produce findings ONLY for the cells named in this chunk.

**Hard rules:**
- DO NOT read `${RUN_DIR}/claude/` — it will bias you.
- All writes go under `${RUN_DIR}/codex/` (already exists; create `findings/` entries by cell_id).
- Append manifest entries to `${RUN_DIR}/codex/manifest.yaml` — a top-level YAML list. Do NOT rewrite existing entries from prior chunks.
- Use the locked schema from `.collab/plans/2026-04-18-vuln-hunt-framework-design.md` §3 and enums from `.collab/vuln-hunt/matrix-*.yaml`.

**This chunk covers**:
- Matrix A rows 1–6 × all 12 columns = 72 cells
- Row keys (ordered): auth_adapter, documents, chat_sse, billing_api, billing_webhook, demo_plane

**Deliverables for THIS chunk**:
1. Exactly 72 manifest entries appended to `codex/manifest.yaml`.
2. One `codex/findings/<cell_id>-<finding_key>.md` for every non-clear cell.
3. Run `python3 .collab/vuln-hunt/scripts/vuln_validate.py <each-finding>` before declaring done.

When complete, print `CHUNK A1-6 DONE` on stdout as the last line.
```

The other 5 chunk prompts follow the same template with scope substituted:
- Chunk A7-12: rows 7–12 (admin_api, export_api, user_crud, ops_endpoints, backend_shared_token, fastapi_metadata)
- Chunk A13-18: rows 13–18 (parse_worker, deletion_worker, cleanup_tasks, download_url_mint, upload_bootstrap, frontend_proxy)
- Chunk A19-24: rows 19–24 (nextauth_handlers, oauth_callbacks, frontend_origin_apis, stripe_return_urls, seo_public_surfaces, shared_token_ssr)
- Chunk B: Matrix B full (8 rows × 6 cols = 48 cells) — **must set `invariant_state` on every finding**
- Chunk FF: freeform — the picks.yaml + 3 narratives per bucket constraints

- [ ] **Step 2: Dispatch chunks sequentially; validate after each**

```bash
RUN_TS=$(python3 -c "import yaml,pathlib;print(yaml.safe_load(pathlib.Path('.collab/vuln-hunt/current_run.yaml').read_text())['current'])")
RUN_DIR=".collab/vuln-hunt/runs/${RUN_TS}"

for chunk in A1-6 A7-12 A13-18 A19-24 B FF; do
  echo "=== Dispatching chunk ${chunk} ==="
  cat "/tmp/vuln-framework/codex-run-prompt-${chunk}.md" \
    | codex exec --full-auto -m gpt-5.3-codex \
        -C /Users/mayijie/Projects/Code/010_DocTalk \
    2>&1 | tee "${RUN_DIR}/codex/chunk-${chunk}.log"

  # Validate this chunk's newly-written findings (skip gracefully if chunk produced zero)
  python3 - "${RUN_DIR}" <<'PY'
import pathlib, subprocess, sys
run_dir = pathlib.Path(sys.argv[1])
findings = sorted((run_dir / "codex" / "findings").glob("*.md"))
if not findings:
    print("chunk produced no findings — OK (all clear)")
    sys.exit(0)
for f in findings:
    r = subprocess.run(
        ["python3", ".collab/vuln-hunt/scripts/vuln_validate.py", str(f)],
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        print(f"validation failed for {f}:\n{r.stderr}", file=sys.stderr)
        sys.exit(1)
print(f"validated {len(findings)} findings")
PY

  # Dedupe + detect cell_id conflicts in the append-only manifest
  python3 - "${RUN_DIR}" <<'PY'
import yaml, pathlib, sys
run_dir = pathlib.Path(sys.argv[1])
path = run_dir / "codex" / "manifest.yaml"
if not path.exists():
    sys.exit(0)
entries = yaml.safe_load(path.read_text()) or []
seen = {}
conflicts = []
for e in entries:
    cid = e["cell_id"]
    if cid in seen and seen[cid] != e:
        conflicts.append(cid)
    seen[cid] = e
if conflicts:
    print(f"FAIL: manifest has conflicting duplicate cell_ids: {conflicts[:10]}", file=sys.stderr)
    sys.exit(1)
# Dedupe (keep last occurrence, which is the latest write — useful when a chunk is re-run after fixing)
deduped = list({e["cell_id"]: e for e in entries}.values())
if len(deduped) < len(entries):
    path.write_text(yaml.safe_dump(deduped, sort_keys=False))
    print(f"deduped manifest: {len(entries)} → {len(deduped)} entries")
PY
done
```

**Retry semantics**: if a chunk fails mid-way, fix the prompt and re-run only that chunk. The Python dedupe step keeps the latest entry per `cell_id` (so retries overwrite cleanly) but REJECTS hard on entries that differ in their non-identity fields — those indicate Codex produced inconsistent results for the same cell and must be resolved manually.

- [ ] **Step 3: Final Codex output validation** (glob-safe)

```bash
python3 - "${RUN_DIR}" <<'PY'
import pathlib, subprocess, sys, yaml
run_dir = pathlib.Path(sys.argv[1])
findings = sorted((run_dir / "codex" / "findings").glob("*.md"))
if not findings:
    print("FAIL: Codex produced no findings — unexpected", file=sys.stderr)
    sys.exit(1)
for f in findings:
    r = subprocess.run(["python3", ".collab/vuln-hunt/scripts/vuln_validate.py", str(f)],
                       capture_output=True, text=True)
    if r.returncode != 0:
        print(f"FAIL at {f}:\n{r.stderr}", file=sys.stderr)
        sys.exit(1)

manifest = yaml.safe_load((run_dir / "codex" / "manifest.yaml").read_text()) or []
cells = {e["cell_id"] for e in manifest}
expected_count = 24*12 + 8*6
if len(cells) != expected_count:
    print(f"FAIL: Codex manifest has {len(cells)} cells, expected {expected_count}", file=sys.stderr)
    sys.exit(1)
print(f"Codex pass clean — {len(findings)} findings, {len(cells)} cells covered.")
PY
```

- [ ] **Step 4: Update run-state + checkpoint commit**

Edit `run-state.yaml`: `codex_done: true`.

```bash
git add "${RUN_DIR}/codex/" "${RUN_DIR}/run-state.yaml"
git commit -m "vuln-hunt(${RUN_TS}): codex pass complete (6 chunks)"
```

---

### Task 11: Freeze + cross-read + reconcile

```bash
# All steps below use these shell vars:
RUN_TS=$(python3 -c "import yaml,pathlib;print(yaml.safe_load(pathlib.Path('.collab/vuln-hunt/current_run.yaml').read_text())['current'])")
RUN_DIR=".collab/vuln-hunt/runs/${RUN_TS}"
```

- [ ] **Step 1: Freeze both trees**

```bash
python3 .collab/vuln-hunt/scripts/vuln_freeze.py "${RUN_DIR}/claude"
python3 .collab/vuln-hunt/scripts/vuln_freeze.py "${RUN_DIR}/codex"
```

`vuln_freeze.py` excludes `crossread/**` and `tie-break/**` from the hash (per Task 3 test), so the cross-read writes that follow do NOT trigger refreeze errors.

- [ ] **Step 2: Cross-read — Claude reads Codex's freeform**

For each `${RUN_DIR}/codex/freeform/S*.md`, write `${RUN_DIR}/claude/crossread/S<#>-<slug>.md` with ONLY `disagree | missed-threat | reasoning-hole` tagged comments. If a genuinely new finding surfaces, tag it `late-add` — it scores separately in reconcile, does not modify the frozen Step-2 output.

- [ ] **Step 3: Cross-read — Codex reads Claude's freeform**

```bash
cat > /tmp/vuln-framework/codex-crossread-prompt.md <<EOF
Read every file under \`${RUN_DIR}/claude/freeform/\`. For each, write the corresponding \`${RUN_DIR}/codex/crossread/<same-name>.md\` with only three comment types: **disagree**, **missed-threat**, **reasoning-hole**. New findings must be tagged **late-add**.

DO NOT modify any file under \`${RUN_DIR}/codex/findings/\` or \`${RUN_DIR}/codex/freeform/\` — they are frozen.
EOF
cat /tmp/vuln-framework/codex-crossread-prompt.md \
  | codex exec --full-auto -m gpt-5.3-codex -C /Users/mayijie/Projects/Code/010_DocTalk
```

- [ ] **Step 4: Reconcile**

```bash
python3 .collab/vuln-hunt/scripts/vuln_reconcile.py \
  "${RUN_DIR}/claude" "${RUN_DIR}/codex" "${RUN_DIR}/reconcile-raw.yaml"
```

- [ ] **Step 5: Update run-state + checkpoint commit**

Edit `run-state.yaml`: `freeze_done: true, reconcile_done: true`.

```bash
git add "${RUN_DIR}/claude/freeze.yaml" "${RUN_DIR}/codex/freeze.yaml" \
        "${RUN_DIR}/claude/crossread/" "${RUN_DIR}/codex/crossread/" \
        "${RUN_DIR}/reconcile-raw.yaml" "${RUN_DIR}/run-state.yaml"
git commit -m "vuln-hunt(${RUN_TS}): freeze + cross-read + reconcile"
```

---

### Task 12: Stage 2 user checkpoint

- [ ] **Step 1: Summarize triage buckets**

Count records per `alignment` value. Produce human-readable summary:

```
CONSENSUS: N findings (P0: n, P1: n, P2: n, P3: n)
DIVERGENT SEVERITY: N cells → tie-break queue
DIFFERENT ROOT CAUSE: N cells → both promoted
BLIND SPOT — CLAUDE: N cells → Claude re-review queue
BLIND SPOT — CODEX: N cells → Codex re-review queue
COVERAGE HOLE: N cells → must review before final
CLEAR: N cells (audit-kept)
```

- [ ] **Step 2: Ask user to approve before tie-break**

Halt. Await user reply.

---

### Task 13: Tie-break + compose

```bash
RUN_TS=$(python3 -c "import yaml,pathlib;print(yaml.safe_load(pathlib.Path('.collab/vuln-hunt/current_run.yaml').read_text())['current'])")
RUN_DIR=".collab/vuln-hunt/runs/${RUN_TS}"
mkdir -p "${RUN_DIR}/tie-break"
```

- [ ] **Step 1: Generate tie-break prompts for all disputed cells** (Python — no `yq` dep, no env var dep)

Pass `RUN_DIR` as argv (shell vars are not exported into heredoc by default):

```bash
python3 - "${RUN_DIR}" <<'PY'
import yaml, subprocess, pathlib, sys
run_dir = pathlib.Path(sys.argv[1])
data = yaml.safe_load((run_dir / "reconcile-raw.yaml").read_text())
disputed = [r for r in data["records"] if r["alignment"] == "same_finding_different_severity"]
script = ".collab/vuln-hunt/scripts/vuln_tie_break_prompt.py"
(run_dir / "tie-break").mkdir(exist_ok=True)
for rec in disputed:
    cell = rec["cell_id"]
    for agent in ("claude", "codex"):
        out = run_dir / "tie-break" / f"{cell}-round1-to-{agent}.md"
        result = subprocess.run(
            ["python3", script, str(run_dir), cell, agent],
            capture_output=True, text=True, check=True,
        )
        out.write_text(result.stdout)
        print(f"wrote {out}")
PY
```

- [ ] **Step 2: Dispatch tie-break prompts, max 2 rounds**

- **Claude side**: read `${RUN_DIR}/tie-break/<cell>-round1-to-claude.md`, produce response at `${RUN_DIR}/tie-break/<cell>-round1-claude-response.md`.
- **Codex side**: pipe each `${RUN_DIR}/tie-break/<cell>-round1-to-codex.md` to `codex exec` with output captured at `${RUN_DIR}/tie-break/<cell>-round1-codex-response.md`.
- If round 1 doesn't converge, repeat for round 2 (regenerate prompts with the other side's round-1 evidence).
- After round 2, unresolved cells go to user decision.

- [ ] **Step 3: Compose — cross-finding graph**

Enumerate findings that touch the same resource (credit ledger, MinIO object, user record, verification token, session, share token). For each pair, judge composability. Write `${RUN_DIR}/composition-candidates.yaml` with fields: `pair: [VHF-A, VHF-B]`, `shared_resource`, `composed_risk`, `confidence: high|medium|low`.

- [ ] **Step 4: Update run-state + checkpoint commit**

Edit `run-state.yaml`: `tiebreak_done: true, compose_done: true`.

```bash
git add "${RUN_DIR}/tie-break/" "${RUN_DIR}/composition-candidates.yaml" "${RUN_DIR}/run-state.yaml"
git commit -m "vuln-hunt(${RUN_TS}): tie-break + composition graph"
```

---

### Task 14: Finalize + user sign-off

```bash
RUN_TS=$(python3 -c "import yaml,pathlib;print(yaml.safe_load(pathlib.Path('.collab/vuln-hunt/current_run.yaml').read_text())['current'])")
RUN_DIR=".collab/vuln-hunt/runs/${RUN_TS}"
```

- [ ] **Step 1: Merge into fix list**

Produce `.collab/plans/${RUN_TS}-vuln-hunt-findings.md` + `.yaml`. Split into:
- `## Actionable Fixes` — consensus + resolved divergences, ordered P0 → P1 → P2 → P3 → composition chains
- `## Confirmation Needed` — `low + P0`, contested items, etc.

Each entry: stable `VHF-YYYY-MM-DD-NNN` ID, merged best-of-both text, audit links to raw files.

- [ ] **Step 2: Commit final artifacts**

```bash
git add ".collab/plans/${RUN_TS}-vuln-hunt-findings.md" ".collab/plans/${RUN_TS}-vuln-hunt-findings.yaml" "${RUN_DIR}/run-state.yaml"
git commit -m "vuln-hunt(${RUN_TS}): final plan — N findings (P0:n P1:n P2:n P3:n)"
```

- [ ] **Step 3: Present to user for Stage 5 sign-off**

Summarize:
- Total findings by severity
- Actionable vs Confirmation-needed split
- Top 5 P0/P1 one-liners
- Recommended fix order
- Any composition chains flagged

Await user approval before cutting fix branches (handoff to existing Claude → Codex fix loop).

---

## Post-Plan Self-Review Checklist

- ✅ **Spec coverage**: every spec section (1–6) has implementation steps (Tasks 1–7 for framework, 8–14 for first run).
- ✅ **Placeholders**: no `TBD` / `TODO` / "implement later"; all code blocks are complete.
- ✅ **Type consistency**: `cell_id` format, enum keys, schema fields all aligned across Tasks 2, 4, 5, 7.
- ✅ **Phase gate**: Task 7 is the hard gate between framework-building and real-run execution.
- ✅ **User checkpoints**: Stage 2 (Task 12) and Stage 5 (Task 14) both explicit, per Section 5 consensus.

## Risks

- **Phase A underestimates**: tooling tasks look simple but cross-cell diff edge cases always surprise. Budget +1h buffer.
- **Phase B wall-clock**: 336 cells × 20-30s = 1.5–3h per agent for Matrix alone. Plan for two work sessions.
- **Codex context cost**: each `codex exec` re-reads repo; `.collab/vuln-hunt/` added context ~25KB, acceptable.
- **Enum drift**: any change to matrix YAMLs after runs start invalidates the validator; gate with `script_version` in run `manifest.yaml`.
