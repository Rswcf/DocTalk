# Codex adversarial review — Postgres backup watcher (0.35.0, PR #12)

Plan: `.collab/plans/2026-09-27-postgres-backups.md` §4.5 (Fable). Reviewer: Codex (gpt-5.5, static review, read-only sandbox). Shipped 2026-09-27: backend 18:53Z, Vercel 18:57Z, stable 5c6867c4. `PG_BACKUP_MONITOR_ENABLED=1` on backend.

## Round 1 — BLOCKING (2 blocking, 5 should-fix)
1. **BLOCKING — the daily 12:00 check with a 30 h limit missed a single skipped 09:15 run.** → Went to 26 h, then replaced in r2 (see below).
2. **BLOCKING — a manifest body-read error skipped the alert path.** → The read is guarded; stale still wins over unverified.
3. The listing was unbounded. → The scan tracks the newest object incrementally, with an entry budget and a 60 s deadline; an incomplete scan counts as unreachable.
4. The best-effort event write was unbounded. → The task has 120/180 s time limits and `SET LOCAL` lock and statement timeouts.
5. The admin card vanished when its fetch failed. → It shows "Check unavailable" with a retry button.
6. A contradictory encryption flag was accepted. → The flag must be a boolean that matches the file type.
7. There was no explicit cache policy. → `Cache-Control: private, no-store`.

## Round 2 — BLOCKING (1 blocking, 2 major, 1 minor)
1. **BLOCKING — any age limit lets a late upload hide a missed run.** → Freshness is now **schedule coverage**: the newest artifact must be at or after the latest scheduled run (`PG_BACKUP_SCHEDULE_UTC=09:15`) whose grace period (`PG_BACKUP_GRACE_HOURS=2`) has passed. Tests cover the missed run, a late upload the day before, the in-grace window, a late run today, and the boundaries.
2. Blocking I/O was not bounded. → The request storage client ignores `Retry-After` (bounded retries for every request-path storage call).
3. The plan's steps still said 30 h. → The plan's execution notes are visible, and the config and negative-test steps are corrected.
4. The clock test patched process-wide `time`. → The clock is injected.

## Round 3 — NO BLOCKING (4 minor, all fixed)
- Naive datetimes are treated as UTC.
- 429 stays in the bounded retry list.
- The card names the missed run.
- The endpoint caches for 120 s.

## Round 4 — no findings (cache and label checks)

Production verification:
- Run in the container, the watcher reports `ok` (restore test ok, encrypted, region us-west2), and the beat task returns `ok`.
- The admin Overview card reads "Postgres backups · Healthy · 0.6 h ago · 51.5 MB · restore test passed".
