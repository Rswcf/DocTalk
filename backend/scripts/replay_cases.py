"""Replay harness for previously-failed real user scenarios (Groups P/C/Q/L/S/X).

Design (test plan §4b): for each real failed user we replay their ACTUAL uploaded
document(s) + their ACTUAL question sequence against a given build, then assert an
*invariant* (LLM output is non-deterministic, so we never string-match):

  - fail_signal  : a phrase that IS present in the historical (pre-fix) answer and
                   MUST DISAPPEAR after the fix.
  - pass_check   : a structural success signal that MUST APPEAR after the fix
                   (e.g. a citation to the right page). Defined per case; some need
                   ground-truth supplied by the product owner.

NOTE: Group R (asst=0 reliability) is NOT replayable — it is a runtime fault, not a
property of file+question. See tests/test_asst0_cancellation_baseline.py instead.

Modes:
  manifest : (runnable now, DB only) prove the replay INPUTS are recoverable —
             pull each case's real questions + doc metadata, confirm storage_key
             exists (file restorable once MinIO access is provided), and confirm
             the historical answer contains the fail_signal.
  run      : (needs MinIO + live stack) restore docs, replay questions through
             chat_service, evaluate invariants, emit before/after table. [STUB]

Usage:
  DB="postgresql://...public-url..." python3 scripts/replay_cases.py manifest
"""
from __future__ import annotations

import asyncio
import os
import re
import sys

import asyncpg

# Each case = one real failed user. user_prefix matches users.id::text prefix.
# fail_signal: regex expected in the historical assistant answer (pre-fix proof).
# privacy: "public"|"personal"|"pii" — pii cases excluded from committed fixtures.
CASES = [
    # --- Group P/C: page lookup + whole-doc coverage (large docs) ---
    dict(id="PAY-755788ef", user_prefix="755788ef", group="P/C", privacy="personal",
         fail_signal=r"(neobsahuj|strana 350|nemohu|fragment)",
         pass_check="retrieval includes page 350 chunk; citation page==350; no 'not found'",
         ground_truth_needed="what is on p.350 / where is question 80 (page + topic)"),
    dict(id="U26-72f99d73", user_prefix="72f99d73", group="C", privacy="personal",
         fail_signal=r"(no information.*Chapter 18|Chapter 18.*not|not.*Chapter 18)",
         pass_check="answer covers Chapter 18 (per ground-truth chapter list)",
         ground_truth_needed="full chapter list of the 462p bio textbook"),
    dict(id="U21-5c451f94", user_prefix="5c451f94", group="P", privacy="personal",
         fail_signal=r"(no contienen números de página|no.*página|fragment)",
         pass_check="citations carry page numbers",
         ground_truth_needed="page numbers for 3 cited quotes"),
    # --- Group Q: rare-term / mid-document fact lookup ---
    dict(id="U14-3bd25a1e", user_prefix="3bd25a1e", group="Q", privacy="personal",
         fail_signal=r"(n'est mentionné nulle part|aucune mention|لا يوجد ذكر)",
         pass_check="term located + cited (if present in doc)",
         ground_truth_needed="confirm whether 'oued attar/ouargla' actually appears + page"),
    # --- Group S: parse / OCR (garbled) ---
    dict(id="U13-3a9b0503", user_prefix="3a9b0503", group="S", privacy="personal",
         fail_signal=r"(coded|encrypt|کوڈڈ|انکرپٹڈ|خراب)",
         pass_check="readable text extracted; answer grounded",
         ground_truth_needed="2-3 facts that should be extractable (Urdu)"),
    dict(id="U38-bc2e42eb", user_prefix="bc2e42eb", group="S", privacy="pii",
         fail_signal=r"(garbled|cannot answer any of the questions)",
         pass_check="OCR extracts drawing text; MCQ answerable",
         ground_truth_needed="correct answer to the east-property-line question"),
    # --- Group X: export refusals ---
    dict(id="U30-8462490a", user_prefix="8462490a", group="X", privacy="personal",
         fail_signal=r"(无法.*CSV|cannot.*CSV|无法直接生成)",
         pass_check="downloadable CSV produced with table contents",
         ground_truth_needed="expected table values"),
    dict(id="U28-7baedcf4", user_prefix="7baedcf4", group="X", privacy="personal",
         fail_signal=r"(ne peux pas générer.*Excel|cannot generate.*Excel)",
         pass_check="downloadable Excel/structured table produced",
         ground_truth_needed="none (structural)"),
    dict(id="U42-ddf4cf56", user_prefix="ddf4cf56", group="X", privacy="personal",
         fail_signal=r"(non è possibile allegare|non mi sei utile)",
         pass_check="clear multi-file UX guidance / capability honored",
         ground_truth_needed="none (UX)"),
    # --- Group X (public doc, safe fixture): VW annual reports ---
    dict(id="U37-b30cb58c", user_prefix="b30cb58c", group="Q/X", privacy="public",
         fail_signal=r"(could not|not.*available|cannot extract)",
         pass_check="2021 production units / employees extracted + cited (public 10-K-style)",
         ground_truth_needed="known VW 2021 figures (public)"),
]


def _norm_dsn(dsn: str) -> str:
    return dsn.replace("postgresql+asyncpg://", "postgresql://")


async def manifest(con: asyncpg.Connection) -> None:
    print(f"REPLAY MANIFEST — {len(CASES)} cases\n" + "=" * 72)
    restorable = recoverable_q = signal_confirmed = 0
    for c in CASES:
        u = await con.fetchrow("select id::text uid from users where id::text like $1", c["user_prefix"] + "%")
        tag = f"[{c['id']}] group={c['group']} privacy={c['privacy']}"
        if not u:
            print(f"\n{tag}\n   USER NOT FOUND (prefix {c['user_prefix']})")
            continue
        uid = u["uid"]
        docs = await con.fetch(
            "select left(filename,46) fn, file_type ft, status, page_count pc, "
            "(storage_key is not null and storage_key<>'') has_key "
            "from documents where user_id=$1 and demo_slug is null order by created_at", uid)
        umsgs = await con.fetch(
            "select left(m.content,90) q from messages m join sessions s on s.id=m.session_id "
            "where s.user_id=$1 and m.role='user' order by m.created_at", uid)
        amsgs = await con.fetch(
            "select m.content c from messages m join sessions s on s.id=m.session_id "
            "where s.user_id=$1 and m.role='assistant' order by m.created_at", uid)
        rx = re.compile(c["fail_signal"], re.I)
        signal_hit = any(rx.search(a["c"] or "") for a in amsgs)
        all_have_key = bool(docs) and all(d["has_key"] for d in docs)
        restorable += int(all_have_key)
        recoverable_q += int(len(umsgs) > 0)
        signal_confirmed += int(signal_hit)

        print(f"\n{tag}")
        print(f"   docs({len(docs)}): " + ("; ".join(
            f"{d['fn']}[{d['ft']},{d['pc']}p,key={'Y' if d['has_key'] else 'N'}]" for d in docs) or "NONE/demo"))
        print(f"   replay questions: {len(umsgs)} (recoverable from DB now)")
        for q in umsgs[:3]:
            print(f"      U> {q['q']}")
        print(f"   fail_signal present in historical answer: {'YES' if signal_hit else 'no'}  "
              f"/regex: {c['fail_signal'][:40]}")
        print(f"   PASS check (post-fix): {c['pass_check']}")
        print(f"   ground-truth needed: {c['ground_truth_needed']}")

    n = len(CASES)
    print("\n" + "=" * 72)
    print(f"SUMMARY: questions recoverable {recoverable_q}/{n} | "
          f"docs restorable (storage_key present) {restorable}/{n} | "
          f"pre-fix fail_signal confirmed {signal_confirmed}/{n}")
    print("Next: provide MinIO access -> `run` mode restores docs + replays + evaluates invariants.")


def _minio_client():
    from minio import Minio
    ep = os.environ["MINIO_PUBLIC_ENDPOINT"]
    secure = ep.startswith("https://")
    host = ep.split("://", 1)[-1].rstrip("/")
    return Minio(host, access_key=os.environ["MINIO_ACCESS_KEY"],
                 secret_key=os.environ["MINIO_SECRET_KEY"], secure=secure)


async def restore(con: asyncpg.Connection) -> None:
    """Prove the replay's last missing piece: original files are restorable from MinIO.

    READ-ONLY: stat_object (HEAD) for every case's docs; fget_object (download) only
    for privacy='public' cases (or REPLAY_DOWNLOAD_ALL=1) to avoid pulling personal/PII
    content without explicit authorization.
    """
    from pathlib import Path
    bucket = os.environ["MINIO_BUCKET"]
    client = _minio_client()
    out = Path("test_inputs/replay"); out.mkdir(parents=True, exist_ok=True)
    download_all = os.environ.get("REPLAY_DOWNLOAD_ALL") == "1"
    stat_ok = downloaded = missing = 0
    print(f"RESTORE from bucket={bucket} (public endpoint)  download_all={download_all}\n" + "=" * 64)
    for c in CASES:
        u = await con.fetchrow("select id::text uid from users where id::text like $1", c["user_prefix"] + "%")
        if not u:
            continue
        docs = await con.fetch(
            "select filename, storage_key from documents "
            "where user_id=$1 and demo_slug is null and storage_key is not null order by created_at", u["uid"])
        for d in docs:
            try:
                st = client.stat_object(bucket, d["storage_key"])
                stat_ok += 1
                line = f"   [{c['id']}] {d['filename'][:40]} -> {st.size//1024} KB  EXISTS"
                if c["privacy"] == "public" or download_all:
                    safe = f"{c['id']}__{Path(d['filename']).name}".replace('/', '_')
                    client.fget_object(bucket, d["storage_key"], str(out / safe))
                    downloaded += 1
                    line += f"  DOWNLOADED -> test_inputs/replay/{safe}"
                else:
                    line += f"  (skip download: privacy={c['privacy']})"
                print(line)
            except Exception as e:
                missing += 1
                print(f"   [{c['id']}] {d['filename'][:40]}  MISSING/ERR: {str(e)[:80]}")
    print("=" * 64)
    print(f"SUMMARY: objects EXIST {stat_ok} | downloaded {downloaded} | missing {missing}")
    print("=> file restoration works; with a live stack the `run` mode can re-ingest + replay.")


async def run_mode(con: asyncpg.Connection) -> None:  # pragma: no cover - needs live stack
    raise SystemExit(
        "run mode requires a LIVE stack (Postgres/Qdrant/Redis/MinIO) + LLM keys to re-ingest the "
        "restored files and replay through chat_service. Prod Qdrant is internal-only, so run this "
        "either inside Railway, or locally after `docker compose up -d` + ingest. Use `restore` first."
    )


async def _main() -> None:
    mode = sys.argv[1] if len(sys.argv) > 1 else "manifest"
    dsn = os.environ.get("DB") or os.environ.get("DATABASE_URL")
    if not dsn:
        raise SystemExit("set DB or DATABASE_URL (public proxy URL for production read-only)")
    con = await asyncpg.connect(_norm_dsn(dsn))
    modes = {"manifest": manifest, "restore": restore, "run": run_mode}
    try:
        await modes.get(mode, manifest)(con)
    finally:
        await con.close()


if __name__ == "__main__":
    asyncio.run(_main())
