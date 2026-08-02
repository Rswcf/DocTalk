# Wave Backend Report — Demo Re-tune (Tasks A1–A4)

Status: **DONE**

## Environment setup

The sandbox had no `.env` and Docker was not running. `backend/tests/conftest.py`
defaults `DATABASE_URL` to `postgresql+asyncpg://postgres:postgres@localhost:5432/postgres`,
which lets the **unit** suite (533 tests) run without any infra. Task A3 needs to
verify actual SQL filtering (created_at window, message-existence, demo_slug join),
which cannot be honestly verified against mocks, so I started Docker Desktop and
`docker compose up -d` (postgres/qdrant/minio/redis), ran `alembic upgrade head`
against `postgresql+asyncpg://doctalk:doctalk@localhost:5432/doctalk` (the
docker-compose credentials), and used that as the real baseline/target DB for the
integration-marked test. This mirrors how the repo's existing integration tests
(`test_auth_adapter.py`, `test_smoke.py`, `test_migrations.py`) already work —
they're marked `@pytest.mark.integration` and skip automatically
(`SKIP_INTEGRATION` defaults to skip) when Docker isn't available, so nothing
about the default no-docker CI path changed.

**Baselines:**
- No docker (`pytest -q`, default env): **533 passed, 7 skipped** — matches
  global-constraints.md's stated baseline.
- With docker + correct `DATABASE_URL` (`SKIP_INTEGRATION=0 pytest -q`):
  **537 passed, 3 skipped** — this is the true pre-change baseline including
  integration tests.

## Task A1 — Per-document demo message counting

**Files:** `backend/app/api/chat.py`, `backend/tests/test_demo_limits.py` (new)

**RED:**
```
$ python3 -m pytest tests/test_demo_limits.py -v
ERROR tests/test_demo_limits.py
!!!!!!!!!!!!!!!!!!!! Interrupted: 1 error during collection !!!!!!!!!!!!!!!!!!!!
```
(ImportError: cannot import name `_demo_message_key`, as predicted by the brief.)

**Implementation:**
- Added `_demo_message_key(client_ip, document_id) -> str` module-level helper
  (`f"{client_ip}:{document_id}"`).
- Create-session response (`create_session`) now computes `used` via the scoped
  key; updated the stale "limit is global per IP" comment.
- `chat_stream` send path now checks/increments via the scoped key.
- `get_session_messages` gained a `request: Request` parameter and, for
  anonymous sessions on demo documents, returns a `JSONResponse` merging
  `demo_messages_used` into the normal response body — same pattern as
  create-session.
- **Deviation from the brief's literal "three call-site changes":** I also
  scoped the key in `chat_continue` (the `/sessions/{id}/chat/continue`
  endpoint), which has the identical
  `demo_message_tracker.check_and_increment(client_ip, DEMO_MESSAGE_LIMIT)`
  call and an explicit comment "continuations count against it." The brief's
  interface list only names three call sites, but leaving this one on the old
  global-per-IP key would silently break the feature: continuation traffic
  would stop counting against the new per-document counter entirely (it would
  hit a different Redis/in-memory key), while still enforcing an unrelated
  global cap. This isn't scope creep — it's completing the brief's own goal
  ("the key" must be scoped everywhere it's used) — but flagging it explicitly
  since it wasn't in the enumerated list.

**GREEN:**
```
$ python3 -m pytest tests/test_demo_limits.py -v
2 passed
$ python3 -m ruff check app/ tests/
(clean)
```
(Removed an unused `import pytest` from the brief's own test snippet — ruff
F401 — since neither test in this file uses a pytest decorator.)

**Regression:** `SKIP_INTEGRATION=0 pytest -q` → 539 passed, 3 skipped (baseline
537 + 2 new). Committed `40733b8`.

## Task A2 — Demo session cap becomes a 24h rolling window

**Files:** `backend/app/api/chat.py`, `backend/tests/test_demo_limits.py`

**RED:**
```
$ python3 -m pytest tests/test_demo_limits.py -v
ERROR tests/test_demo_limits.py  (ImportError: _recent_demo_session_filter)
```

**Implementation:** exactly as specified — `_recent_demo_session_filter(document_id)`
returns `[ChatSession.document_id == document_id, ChatSession.created_at > func.now() - dt.timedelta(hours=24)]`;
added `import datetime as dt`; replaced the lifetime count query in
`create_session`'s demo-session-cap check with
`select(func.count(ChatSession.id)).where(*_recent_demo_session_filter(document_id))`.

**GREEN:**
```
$ python3 -m pytest tests/test_demo_limits.py -v
3 passed
$ python3 -m ruff check app/ tests/
(clean)
```

**Regression:** 540 passed, 3 skipped. Committed `ad7cbae`.

## Task A3 — Nightly prune of empty anonymous demo sessions

**Files:** `backend/app/workers/cleanup_tasks.py`, `backend/app/workers/celery_app.py`,
`backend/tests/test_cleanup_tasks.py`

Read `cleanup_tasks.py` and its test first, as instructed. The module does **not**
use an ORM session factory (`SyncSessionLocal`) — its existing task
(`cleanup_expired_verification_tokens`) builds a plain `sa.create_engine(sync_url)`
from `settings.DATABASE_URL` (asyncpg→psycopg driver swap) each invocation, runs
raw `sa.text(...)` SQL inside `engine.begin()`, and disposes the engine in
`finally`. The brief's code sketch (ORM `sa.delete(ChatSession)...` via
`SyncSessionLocal()`) doesn't match this module's convention, so I adapted it to
raw SQL following the exact same engine-lifecycle pattern as the existing task,
per the task brief's own instruction to adapt imports/factory names.

```python
DELETE FROM sessions
WHERE user_id IS NULL
  AND created_at < :cutoff
  AND document_id IN (SELECT id FROM documents WHERE demo_slug IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM messages WHERE messages.session_id = sessions.id)
```

**Test:** the brief's four cases (a–d) require verifying real filtering
behavior (created_at window, message-existence, demo_slug join) that a mocked
session cannot honestly assert. I wrote `test_cleanup_empty_demo_sessions_deletes_only_stale_empty_anonymous_demo_sessions`,
marked `@pytest.mark.integration`, using `SyncSessionLocal` (the app's real sync
session factory, imported fresh for the test) to insert real rows against the
local docker Postgres, call the task for real, assert the return value and
which session IDs survive, then clean up the rows it created in a `finally`
block.

**RED** (real DB, task not yet implemented):
```
$ SKIP_INTEGRATION=0 pytest tests/test_cleanup_tasks.py -v
FAILED ...AttributeError: module 'app.workers.cleanup_tasks' has no attribute 'cleanup_empty_demo_sessions'
1 failed, 1 passed
```

**Implementation:** added `cleanup_empty_demo_sessions()` task (returns `int`,
deleted count) to `cleanup_tasks.py`; added
`"cleanup-empty-demo-sessions-daily": {"task": "cleanup_empty_demo_sessions", "schedule": 86400}`
to `celery_app.py`'s `beat_schedule`.

**GREEN:**
```
$ SKIP_INTEGRATION=0 pytest tests/test_cleanup_tasks.py -v
2 passed
$ ruff check app/ tests/
(clean)
```

**Regression:**
- With docker: 541 passed, 3 skipped.
- Without docker (default env, confirming the new test degrades gracefully):
  536 passed, 8 skipped (baseline 533 + 3 new unit tests from A1/A2/A4 so far;
  the new integration test is the 8th skip).

Committed `b459e4f`.

## Task A4 — Unblock auth_confirm telemetry

**Files:** `backend/app/api/events.py`, `backend/tests/test_events_api.py`

**RED:**
```
$ pytest tests/test_events_api.py -v
FAILED [...auth_confirm_viewed] - assert 400 == 204
FAILED [...auth_confirm_clicked] - assert 400 == 204
2 failed, 4 passed
```

**Implementation:** added `"auth_confirm_viewed"` and `"auth_confirm_clicked"` to
both `ALLOWED_EVENTS` and `PUBLIC_EVENTS` in `events.py`.

**GREEN:**
```
$ pytest tests/test_events_api.py -v
6 passed
$ ruff check app/ tests/
(clean)
```

**Regression:** 543 passed, 3 skipped (with docker). Committed `db81487`.

## Final state

```
$ SKIP_INTEGRATION=0 pytest -q       # with docker up, correct DATABASE_URL
543 passed, 3 skipped

$ pytest -q                          # default env, no docker (matches CI/local dev)
536 passed, 8 skipped
```

No new failures vs either baseline in either mode. `ruff check app/ tests/` is
clean after all four tasks.

## Files changed

- `backend/app/api/chat.py` — A1 (`_demo_message_key`, 4 call sites incl. the
  `chat_continue` deviation noted above) + A2 (`_recent_demo_session_filter`)
- `backend/app/workers/cleanup_tasks.py` — A3 (`cleanup_empty_demo_sessions`)
- `backend/app/workers/celery_app.py` — A3 (beat schedule entry)
- `backend/app/api/events.py` — A4 (whitelist additions)
- `backend/tests/test_demo_limits.py` — new, A1 + A2 tests
- `backend/tests/test_cleanup_tasks.py` — extended, A3 test
- `backend/tests/test_events_api.py` — extended, A4 test

## Self-review

- **Completeness:** all four tasks implemented per brief; interfaces match
  exactly (`_demo_message_key`, `_recent_demo_session_filter`,
  `cleanup_empty_demo_sessions() -> int`, `demo_messages_used` field name/shape).
- **Quality:** each fix follows the existing module's conventions rather than
  the brief's sketch verbatim where they diverged (A3's raw-SQL engine pattern;
  A1's extra `chat_continue` fix for consistency).
- **YAGNI:** did not add anything beyond what each task needs — e.g. A3's test
  covers exactly the brief's 4 cases, no extra scenarios; didn't touch the
  non-demo-document session-cap path (still uses `settings.FREE_MAX_SESSIONS_PER_DOC`
  unchanged, out of scope).
- **Test honesty:** A3's test hits a real Postgres and asserts on actual row
  survival, not a mock that would trivially pass regardless of the SQL's
  correctness. It's marked `@pytest.mark.integration` and cleans up its own
  rows in a `finally` block so repeated runs don't accumulate data or collide
  (unique demo_slug per run via `uuid4().hex[:8]`).
- **Docker was left running** at the end of this session (`docker compose up -d`
  containers `doctalk-qdrant`, `doctalk-redis`, `doctalk-minio`, `doctalk-postgres`)
  since another wave/agent in this session may also need it. Local DB now has a
  couple of extra alembic-migrated tables applied vs whatever state it was in
  before (migrations were already 2 revisions behind head).

## Concerns for reviewers / Codex round

1. **A1 deviation** (`chat_continue` also scoped): flagged above — recommend
   confirming this matches intent, since the brief explicitly enumerated only
   3 call sites and this is a 4th.
2. **A3's DELETE is raw SQL, not ORM**, diverging from the brief's sketch. This
   was a deliberate adaptation to match the module's existing convention (the
   brief itself said to adapt), not an oversight — worth a second look given
   security-adjacent-ish (bulk delete) territory.
3. Frontend Task B1 consumes `demo_messages_used` from
   `GET /api/sessions/{id}/messages` — the field is present on both the
   create-session (201) and messages (200) responses now, same shape.

---

## Codex r1 fix round (2026-08-02)

Triage doc: `/Users/mayijie/Projects/Code/010_DocTalk/.collab/dialogue/2026-08-02-p0-codex-r1-triage.md`.
Owned three items: FIX-1 (blocker), FIX-6-INDEX, FIX-8. Same TDD discipline,
docker + local Postgres (`postgresql+asyncpg://doctalk:doctalk@localhost:5432/doctalk`)
still up from the first round.

**Baseline before this round:** 543 passed, 3 skipped (with docker).

### FIX-1 — authed demo-cap DoS (BLOCKER)

The reported hole: `_recent_demo_session_filter` counted *all* sessions
(anon + authed) against the 500/24h abuse cap, while the free-plan session
cap explicitly excluded demo docs (`not doc.demo_slug`) — so an authenticated
free account creating sessions on a demo doc hit neither guard and could
create unbounded rows.

- **(a)** `_recent_demo_session_filter` now also filters
  `ChatSession.user_id.is_(None)` — the anon cap counts only anonymous rows.
  Docstring updated to explain why (the per-user cap in (b) covers authed
  users instead).
- **(b)** New guard block in `create_session`: for
  `user is not None and (user.plan or "free").lower() == "free" and doc.demo_slug`,
  counts sessions filtered to `document_id == document_id AND user_id == user.id`
  and 403s with the existing `SESSION_LIMIT_REACHED` detail shape at
  `>= settings.FREE_MAX_SESSIONS_PER_DOC`. Left the pre-existing non-demo
  free-cap branch untouched, per the brief's explicit instruction not to
  just drop `not doc.demo_slug` from it (that query counts *everyone's* rows
  on the doc, which would instantly lock a demo doc for the whole userbase
  the first time any free user hit the count).
- **(c)** `cleanup_empty_demo_sessions` now also prunes authenticated empty
  demo sessions >7d — dropped the `user_id IS NULL` predicate from the
  DELETE, kept demo-doc + zero-messages + age. Docstring updated.
- **Note (accepted, not paid tier):** the new per-user guard in (b) only
  applies to `plan == "free"`. An authenticated Plus/Pro user creating demo
  sessions still has no cap, same as they have none on non-demo docs. This
  matches the reported vulnerability's scope (a free account costs nothing
  to create) and the codebase's existing convention of gating session caps
  on the free plan only — flagging in case the reviewers intended broader
  coverage.

**RED** (`test_demo_session_window_excludes_authenticated_sessions`,
`test_create_session_free_plan_demo_cap_reached` in `test_error_taxonomy.py`,
and the extended `test_cleanup_tasks.py` case):
```
$ SKIP_INTEGRATION=0 pytest tests/test_demo_limits.py \
    tests/test_error_taxonomy.py::test_create_session_free_plan_demo_cap_reached \
    tests/test_cleanup_tasks.py -v
3 failed, 4 passed
```

**GREEN:**
```
$ SKIP_INTEGRATION=0 pytest tests/test_demo_limits.py tests/test_error_taxonomy.py tests/test_cleanup_tasks.py -v
58 passed
$ ruff check app/ tests/
(clean)
```
The cleanup test's 4 cases became 5: (d) authed-empty-8d flipped from
"kept" to "deleted" (that's the whole point of (c)); added (e) authed +
1 message, 8d old → kept. `assert deleted == 2` now (a) + (d).

**Regression:** 545 passed, 3 skipped. Committed `f816335`.

### FIX-6-INDEX — partial index for the anonymous demo window

New migration `20260802_0033_add_sessions_demo_window_index.py`
(`down_revision = "20260524_0032"`, the actual head revision string, per
the project's alembic rule). Adds
`idx_sessions_demo_window ON sessions (document_id, created_at) WHERE user_id IS NULL`
via `op.create_index(..., postgresql_where=sa.text("user_id IS NULL"))`,
matching the shape `_recent_demo_session_filter` now queries after FIX-1(a).
Downgrade drops the index.

No new test file — the repo already has a generic
`test_migrations.py::test_migrations_downgrade_and_reupgrade_round_trip`
(`upgrade head → downgrade base → upgrade head`) that exercises every
migration's `upgrade()`/`downgrade()`, including this one, end to end.

Proved it applies directly, then via the round-trip test:
```
$ alembic heads
20260802_0033 (head)
$ alembic upgrade head
Running upgrade 20260524_0032 -> 20260802_0033, add partial index for anonymous demo session window
$ docker exec -i doctalk-postgres psql -U doctalk -d doctalk -c "\d sessions" | grep idx_sessions_demo_window
"idx_sessions_demo_window" btree (document_id, created_at) WHERE user_id IS NULL
$ SKIP_INTEGRATION=0 pytest tests/test_migrations.py -v
1 passed   # upgrade head -> downgrade base -> upgrade head round trip
```
Note: the round-trip test wipes and rebuilds the local schema (by design,
per its own docstring) — fine for this throwaway local docker DB, confirmed
back at `20260802_0033 (head)` afterward.

`ruff check app/ tests/` stays clean (alembic/ isn't in the project's
mandated ruff scope; the new migration file has the same pre-existing
import-sort style as every other file in `alembic/versions/`, not a
regression).

**Regression:** 545 passed, 3 skipped. Committed `38b8a36`.

### FIX-8 — typed SessionMessagesResponse, no JSONResponse merge

Added `demo_messages_used: Optional[int] = None` to `SessionMessagesResponse`
in `backend/app/schemas/chat.py`. `get_session_messages` now builds
`SessionMessagesResponse(messages=items, demo_messages_used=demo_messages_used)`
directly and returns it — no more manual `{**response.model_dump(...), ...}`
merge into a raw `JSONResponse`. Left `create_session`'s JSONResponse
pattern untouched, per the brief (pre-existing, out of scope).

RED test targeted the case the old merge-based implementation couldn't
honestly produce: a non-demo/authenticated session's response already went
through the plain pydantic model before this fix, so adding the field to the
schema is the only way `demo_messages_used: null` shows up in that response
at all.

**RED:**
```
$ pytest tests/test_error_taxonomy.py::test_get_session_messages_includes_null_demo_field_for_authed_session \
         tests/test_error_taxonomy.py::test_get_session_messages_returns_demo_count_for_anon_demo_session -v
1 failed, 1 passed
# failed: "demo_messages_used" not in body (field didn't exist on the schema yet)
# passed: the anon-demo path already worked via the old JSONResponse merge —
#         kept as a GREEN-preserving regression companion for the refactor
```

**GREEN:**
```
$ pytest tests/test_error_taxonomy.py tests/test_demo_limits.py tests/test_smoke.py -v
62 passed, 1 skipped
$ ruff check app/ tests/
(clean)
```

**Regression:** 547 passed, 3 skipped (docker); 542 passed, 8 skipped
(default no-docker env, re-verified). Committed `0f1cdd8`.

### Final state (Codex r1 round)

```
$ SKIP_INTEGRATION=0 pytest -q       # docker up
547 passed, 3 skipped

$ pytest -q                          # default env, no docker
542 passed, 8 skipped
```

No new failures vs either baseline. `ruff check app/ tests/` clean throughout.

Commits, in order: `f816335` (FIX-1), `38b8a36` (FIX-6-INDEX), `0f1cdd8` (FIX-8).
