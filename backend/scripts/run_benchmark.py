#!/usr/bin/env python3
"""DocTalk RAG Benchmark Runner — Direct OpenRouter.

Bypasses the DocTalk backend entirely. Connects directly to:
  - PostgreSQL  (chunk text & document metadata)
  - Qdrant      (vector search)
  - OpenRouter   (embeddings + LLM streaming)

Two-phase approach for fair comparison:
  Phase 1 — Retrieve & cache chunks per test case (all models see identical context)
  Phase 2 — Stream each model via OpenRouter, collect TTFT / latency / text / citations

Usage:
    # All models (needs local infra or Railway creds in backend/.env):
    python scripts/run_benchmark.py --models all

    # Specific models:
    python scripts/run_benchmark.py --models qwen/qwen3.5-397b-a17b,z-ai/glm-5,minimax/minimax-m2.5

    # Reuse cached chunks from a previous run (skip Phase 1):
    python scripts/run_benchmark.py --chunk-cache benchmark_results/chunks_2026-02-17T12-00-00.json

    # Specific test cases:
    python scripts/run_benchmark.py --test-ids factual_01,analytical_01

    # Against production infra (set DATABASE_URL / QDRANT_URL in env):
    DATABASE_URL=postgres://... QDRANT_URL=https://... python scripts/run_benchmark.py
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx

SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
TEST_CASES_PATH = SCRIPT_DIR / "benchmark_test_cases.json"
RESULTS_DIR = SCRIPT_DIR / "benchmark_results"

# ---------------------------------------------------------------------------
# Model registry
# ---------------------------------------------------------------------------

ALL_MODELS = [
    "deepseek/deepseek-v3.2",
    "google/gemini-3-flash-preview",
    "x-ai/grok-4.1-fast",
    "minimax/minimax-m2.1",
    "minimax/minimax-m2.5",
    "moonshotai/kimi-k2.5",
    "openai/gpt-5.2",
    "google/gemini-3-pro-preview",
    "anthropic/claude-sonnet-4.5",
    "anthropic/claude-opus-4.6",
    "qwen/qwen3.5-397b-a17b",
    "z-ai/glm-5",
]

# Per-model parameters (mirrors model_profiles.py)
MODEL_PARAMS: dict[str, dict] = {
    "deepseek/deepseek-v3.2":        {"temperature": 0.1, "max_tokens": 2048, "prompt_style": "positive_framing"},
    "openai/gpt-5.2":                {"temperature": 0.0, "max_tokens": 4096},
    "qwen/qwen3-30b-a3b":            {"temperature": 0.2, "max_tokens": 4096},
    "qwen/qwen3.5-397b-a17b":        {"temperature": 0.2, "max_tokens": 4096},
    "mistralai/mistral-medium-3":     {"temperature": 0.2, "max_tokens": 4096},
    "mistralai/mistral-medium-3.1":   {"temperature": 0.2, "max_tokens": 4096},
    "mistralai/mistral-large-2512":   {"temperature": 0.2, "max_tokens": 8192},
    "minimax/minimax-m2.1":           {"temperature": 0.2, "max_tokens": 4096},
    "minimax/minimax-m2.5":           {"temperature": 0.2, "max_tokens": 4096},
    "z-ai/glm-5":                     {"temperature": 0.2, "max_tokens": 4096},
    "anthropic/claude-sonnet-4.5":    {"temperature": 0.2, "max_tokens": 4096, "cache_control": True},
    "anthropic/claude-opus-4.6":      {"temperature": 0.2, "max_tokens": 4096, "cache_control": True},
}
DEFAULT_PARAMS = {"temperature": 0.3, "max_tokens": 2048, "prompt_style": "default"}

# ---------------------------------------------------------------------------
# Prompt rules (identical to model_profiles.py)
# ---------------------------------------------------------------------------

PROMPT_RULES = {
    "default": (
        "1. Only answer based on the fragments above. Do not fabricate information.\n"
        "2. After key statements, cite sources with [n] (n = fragment number).\n"
        "3. You may cite multiple fragments, e.g. [1][3].\n"
        "4. Always extract as much relevant information as possible from the fragments. "
        "Focus on what IS available rather than what is missing. "
        "Only say the information was not found if the fragments are truly unrelated to the question.\n"
        "5. If the question asks about a specific topic that is genuinely NOT covered in any of the fragments, "
        'clearly state: "This information is not present in the provided document."\n'
        "6. Use Markdown: **bold** for emphasis, bullet lists for multiple points.\n"
        "7. Your response language MUST match the language of the user's question.\n"
    ),
    "positive_framing": (
        "1. Only answer based on the fragments above. Do not fabricate information.\n"
        "2. After key statements, cite sources with [n] (n = fragment number).\n"
        "3. You may cite multiple fragments, e.g. [1][3].\n"
        "4. Your primary goal is to extract and present ALL useful information from the fragments. "
        "Be thorough — cover every relevant detail you find.\n"
        "5. Only say information is unavailable if the fragments are genuinely unrelated to the question.\n"
        "6. When a question is about a topic completely absent from ALL fragments, "
        "state that this specific information is not available in the document.\n"
        "7. Use Markdown: **bold** for emphasis, bullet lists for multiple points.\n"
        "8. Your response language MUST match the language of the user's question.\n"
    ),
}

# ---------------------------------------------------------------------------
# Retrieval constants
# ---------------------------------------------------------------------------

OPENROUTER_BASE = "https://openrouter.ai/api/v1"
EMBEDDING_MODEL = "openai/text-embedding-3-small"
QDRANT_COLLECTION = "doc_chunks"
TOP_K = 8
OVERFETCH_MULTIPLIER = 3
MIN_CHUNK_LEN = 200
CHUNK_TRUNCATE = 1400


# ---------------------------------------------------------------------------
# Environment helpers
# ---------------------------------------------------------------------------

def load_env() -> dict[str, str]:
    """Load config from backend/.env, overridden by real env vars."""
    env: dict[str, str] = {}
    for env_path in [BACKEND_DIR / ".env", BACKEND_DIR.parent / ".env", Path(".env")]:
        if env_path.exists():
            for line in env_path.read_text().splitlines():
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip().strip('"').strip("'")
            break
    # Real env vars always win
    for k in ["OPENROUTER_API_KEY", "DATABASE_URL", "QDRANT_URL", "QDRANT_API_KEY"]:
        if k in os.environ:
            env[k] = os.environ[k]
    return env


def load_test_cases() -> list[dict]:
    with open(TEST_CASES_PATH) as f:
        return json.load(f)["test_cases"]


# ---------------------------------------------------------------------------
# Phase 1: Chunk retrieval (embed → Qdrant → PostgreSQL)
# ---------------------------------------------------------------------------

def _normalize_db_url(db_url: str) -> str:
    """Strip SQLAlchemy dialect suffixes (e.g. +asyncpg) for raw psycopg."""
    import re
    return re.sub(r"^postgresql\+\w+://", "postgresql://", db_url)


def _get_db_connection(db_url: str):
    """Return a psycopg/psycopg2 connection."""
    db_url = _normalize_db_url(db_url)
    try:
        import psycopg2
        return psycopg2.connect(db_url)
    except ImportError:
        pass
    try:
        import psycopg
        return psycopg.connect(db_url)
    except ImportError:
        print("ERROR: Install psycopg2-binary or psycopg[binary]")
        sys.exit(1)


def get_demo_doc_ids(db_url: str) -> dict[str, str]:
    """Return {demo_slug: document_id} from PostgreSQL."""
    conn = _get_db_connection(db_url)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, demo_slug FROM documents WHERE demo_slug IS NOT NULL")
            return {row[1]: str(row[0]) for row in cur.fetchall()}
    finally:
        conn.close()


def embed_query(api_key: str, text: str) -> list[float]:
    """Embed a single query via OpenRouter."""
    resp = httpx.post(
        f"{OPENROUTER_BASE}/embeddings",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={"model": EMBEDDING_MODEL, "input": [text]},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["data"][0]["embedding"]


def search_qdrant(qdrant_url: str, qdrant_api_key: str | None,
                  vector: list[float], document_id: str, limit: int) -> list[dict]:
    """Search Qdrant via qdrant-client, return [{id, score}, ...]."""
    from qdrant_client import QdrantClient
    from qdrant_client.models import FieldCondition, Filter, MatchValue

    client = QdrantClient(url=qdrant_url, api_key=qdrant_api_key or None)
    flt = Filter(must=[FieldCondition(key="document_id", match=MatchValue(value=document_id))])
    res = client.query_points(
        collection_name=QDRANT_COLLECTION,
        query=vector,
        limit=limit,
        query_filter=flt,
    )
    return [{"id": str(p.id), "score": float(p.score or 0)} for p in res.points]


def load_chunks_from_db(db_url: str, chunk_ids: list[str]) -> dict[str, dict]:
    """Load chunk text + metadata from PostgreSQL."""
    if not chunk_ids:
        return {}
    conn = _get_db_connection(db_url)
    try:
        with conn.cursor() as cur:
            placeholders = ",".join(["%s"] * len(chunk_ids))
            cur.execute(
                f"SELECT id, text, page_start, page_end, section_title "
                f"FROM chunks WHERE id IN ({placeholders})",
                chunk_ids,
            )
            result = {}
            for row in cur.fetchall():
                result[str(row[0])] = {
                    "text": row[1] or "",
                    "page_start": row[2],
                    "page_end": row[3],
                    "section_title": row[4] or "",
                }
            return result
    finally:
        conn.close()


def retrieve_chunks(env: dict[str, str], question: str, document_id: str) -> list[dict]:
    """Full retrieval: embed → Qdrant search → DB load → filter → top_k."""
    api_key = env["OPENROUTER_API_KEY"]
    qdrant_url = env.get("QDRANT_URL", "http://localhost:6333")
    qdrant_api_key = env.get("QDRANT_API_KEY")
    db_url = env["DATABASE_URL"]

    vector = embed_query(api_key, question)
    points = search_qdrant(qdrant_url, qdrant_api_key, vector, document_id, TOP_K * OVERFETCH_MULTIPLIER)

    chunk_ids = [p["id"] for p in points]
    scores = {p["id"]: p["score"] for p in points}
    chunks_db = load_chunks_from_db(db_url, chunk_ids)

    results = []
    for cid, score in sorted(scores.items(), key=lambda x: x[1], reverse=True):
        if cid not in chunks_db:
            continue
        ch = chunks_db[cid]
        if len(ch["text"].strip()) < MIN_CHUNK_LEN:
            continue
        results.append({
            "chunk_id": cid,
            "text": ch["text"],
            "page_start": ch["page_start"],
            "page_end": ch["page_end"],
            "section_title": ch["section_title"],
            "score": score,
        })
    return results[:TOP_K]


def collect_all_chunks(
    env: dict[str, str],
    test_cases: list[dict],
    slug_to_id: dict[str, str],
) -> dict[str, list[dict]]:
    """Phase 1: retrieve chunks for every test case. Returns {test_id: [chunks]}."""
    cache: dict[str, list[dict]] = {}
    total = len(test_cases)
    for i, tc in enumerate(test_cases, 1):
        doc_id = slug_to_id.get(tc["document_slug"])
        if not doc_id:
            print(f"  [{i}/{total}] SKIP {tc['id']} — doc '{tc['document_slug']}' not found")
            continue
        print(f"  [{i}/{total}] {tc['id']}...", end=" ", flush=True)
        try:
            chunks = retrieve_chunks(env, tc["question"], doc_id)
            cache[tc["id"]] = chunks
            print(f"OK ({len(chunks)} chunks)")
        except Exception as e:
            print(f"ERR: {e}")
            cache[tc["id"]] = []
    return cache


# ---------------------------------------------------------------------------
# Phase 2: Direct OpenRouter LLM calls
# ---------------------------------------------------------------------------

def build_system_prompt(chunks: list[dict], model: str) -> str:
    """Build the RAG system prompt with numbered fragments (same as chat_service.py)."""
    numbered = []
    for idx, ch in enumerate(chunks, 1):
        text = ch["text"][:CHUNK_TRUNCATE]
        numbered.append(f"[{idx}] {text}")

    params = {**DEFAULT_PARAMS, **MODEL_PARAMS.get(model, {})}
    style = params.get("prompt_style", "default")
    rules = PROMPT_RULES.get(style, PROMPT_RULES["default"])

    return (
        "You are a document analysis assistant. Answer the user's question "
        "based on the following document fragments.\n\n"
        "## Document Fragments\n"
        + ("\n".join(numbered) if numbered else "(none)")
        + "\n\n## Rules\n" + rules
    )


def count_citations(text: str) -> list[int]:
    """Extract unique [n] citation ref numbers from text."""
    return sorted(set(int(m) for m in re.findall(r"\[(\d+)\]", text)))


def stream_llm(api_key: str, model: str, system_prompt: str, question: str) -> dict:
    """Stream a single LLM call via OpenRouter. Returns metrics dict."""
    params = {**DEFAULT_PARAMS, **MODEL_PARAMS.get(model, {})}

    result: dict = {
        "text": "",
        "citations": [],
        "ttft_ms": None,
        "total_ms": None,
        "prompt_tokens": None,
        "completion_tokens": None,
        "error": None,
    }

    # Build messages — use cache_control for Anthropic models
    if params.get("cache_control"):
        sys_msg: dict = {
            "role": "system",
            "content": [{"type": "text", "text": system_prompt, "cache_control": {"type": "ephemeral"}}],
        }
    else:
        sys_msg = {"role": "system", "content": system_prompt}

    body = {
        "model": model,
        "messages": [sys_msg, {"role": "user", "content": question}],
        "max_tokens": params["max_tokens"],
        "temperature": params["temperature"],
        "stream": True,
        "stream_options": {"include_usage": True},
    }

    start = time.monotonic()
    first_token_time: float | None = None
    text_parts: list[str] = []

    try:
        with httpx.stream(
            "POST",
            f"{OPENROUTER_BASE}/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://www.doctalk.site",
                "X-Title": "DocTalk Benchmark",
            },
            json=body,
            timeout=httpx.Timeout(connect=15.0, read=180.0, write=15.0, pool=15.0),
        ) as resp:
            resp.raise_for_status()
            for line in resp.iter_lines():
                if not line.startswith("data:"):
                    continue
                data_str = line[5:].strip()
                if data_str == "[DONE]":
                    break
                try:
                    data = json.loads(data_str)
                except json.JSONDecodeError:
                    continue

                # Token content
                choices = data.get("choices", [])
                if choices:
                    delta = choices[0].get("delta", {})
                    content = delta.get("content")
                    if content:
                        if first_token_time is None:
                            first_token_time = time.monotonic()
                        text_parts.append(content)

                # Usage (last chunk)
                usage = data.get("usage")
                if usage:
                    result["prompt_tokens"] = usage.get("prompt_tokens")
                    result["completion_tokens"] = usage.get("completion_tokens")

    except Exception as e:
        result["error"] = str(e)

    end = time.monotonic()
    result["text"] = "".join(text_parts)
    result["total_ms"] = round((end - start) * 1000)
    if first_token_time is not None:
        result["ttft_ms"] = round((first_token_time - start) * 1000)
    result["citations"] = count_citations(result["text"])
    return result


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

def run_benchmark(
    env: dict[str, str],
    models: list[str],
    test_cases: list[dict],
    chunk_cache: dict[str, list[dict]] | None = None,
) -> dict:
    """Run the full two-phase benchmark."""
    api_key = env["OPENROUTER_API_KEY"]

    # ---- Phase 1: chunks ----
    if chunk_cache is None:
        print("\n=== Phase 1: Retrieving chunks ===")
        slug_to_id = get_demo_doc_ids(env["DATABASE_URL"])
        print(f"Demo documents: {slug_to_id}")
        chunk_cache = collect_all_chunks(env, test_cases, slug_to_id)

        RESULTS_DIR.mkdir(parents=True, exist_ok=True)
        cache_path = RESULTS_DIR / f"chunks_{datetime.now().strftime('%Y-%m-%dT%H-%M-%S')}.json"
        with open(cache_path, "w") as f:
            json.dump(chunk_cache, f, ensure_ascii=False)
        print(f"Chunk cache saved to {cache_path}")
    else:
        print(f"\nUsing cached chunks ({len(chunk_cache)} entries)")

    # ---- Phase 2: LLM calls ----
    print(f"\n=== Phase 2: Testing {len(models)} models × {len(test_cases)} cases ===")
    print(f"Total runs: {len(models) * len(test_cases)}")

    results: list[dict] = []
    total = len(models) * len(test_cases)
    completed = 0

    for model in models:
        print(f"\n{'='*60}")
        print(f"Model: {model}")
        print(f"{'='*60}")

        for tc in test_cases:
            completed += 1
            chunks = chunk_cache.get(tc["id"], [])
            if not chunks and not tc.get("is_negative", False):
                print(f"  [{completed}/{total}] SKIP {tc['id']} — no chunks retrieved")
                continue

            print(f"  [{completed}/{total}] {tc['id']}...", end=" ", flush=True)

            system_prompt = build_system_prompt(chunks, model)
            llm_result = stream_llm(api_key, model, system_prompt, tc["question"])

            ttft = f"{llm_result['ttft_ms']}ms" if llm_result["ttft_ms"] else "N/A"
            total_time = f"{llm_result['total_ms']}ms"
            n_cites = len(llm_result["citations"])
            status = "ERR" if llm_result["error"] else "OK"
            pt = llm_result["prompt_tokens"] or "?"
            ct = llm_result["completion_tokens"] or "?"
            print(f"{status} ttft={ttft} total={total_time} cites={n_cites} pt={pt} ct={ct}")

            results.append({
                "test_id": tc["id"],
                "model": model,
                "document_slug": tc["document_slug"],
                "question": tc["question"],
                "language": tc.get("language", "en"),
                "type": tc["type"],
                "is_negative": tc.get("is_negative", False),
                "expected_min_citations": tc.get("expected_min_citations", 0),
                "ground_truth_keywords": tc.get("ground_truth_keywords", []),
                "response_text": llm_result["text"],
                "citations": llm_result["citations"],
                "ttft_ms": llm_result["ttft_ms"],
                "total_ms": llm_result["total_ms"],
                "prompt_tokens": llm_result["prompt_tokens"],
                "completion_tokens": llm_result["completion_tokens"],
                "error": llm_result["error"],
                "n_chunks": len(chunks),
            })

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "mode": "direct_openrouter",
        "models": models,
        "total_cases": len(test_cases),
        "total_runs": len(results),
        "results": results,
    }


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="DocTalk RAG Benchmark — Direct OpenRouter",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""examples:
  python scripts/run_benchmark.py --models all
  python scripts/run_benchmark.py --models qwen/qwen3.5-397b-a17b,z-ai/glm-5
  python scripts/run_benchmark.py --chunk-cache benchmark_results/chunks_2026-02-17T12-00-00.json
""",
    )
    parser.add_argument("--models", default="all", help="Comma-separated model IDs or 'all'")
    parser.add_argument("--test-ids", default=None, help="Comma-separated test case IDs (default: all)")
    parser.add_argument("--chunk-cache", default=None, help="Path to cached chunks JSON (skips Phase 1)")
    parser.add_argument("--output", default=None, help="Output filename (default: timestamped)")
    args = parser.parse_args()

    env = load_env()
    missing = [k for k in ["OPENROUTER_API_KEY", "DATABASE_URL"] if k not in env]
    if missing:
        print(f"ERROR: Missing env vars: {', '.join(missing)}")
        print("Set them in backend/.env or as environment variables.")
        sys.exit(1)

    if args.models == "all":
        models = ALL_MODELS
    else:
        models = [m.strip() for m in args.models.split(",")]

    test_cases = load_test_cases()
    if args.test_ids:
        ids = {t.strip() for t in args.test_ids.split(",")}
        test_cases = [tc for tc in test_cases if tc["id"] in ids]

    print(f"Models: {len(models)}, Test cases: {len(test_cases)}")
    print(f"Total runs: {len(models) * len(test_cases)}")

    # Load chunk cache if provided
    chunk_cache = None
    if args.chunk_cache:
        cache_path = Path(args.chunk_cache)
        if not cache_path.is_absolute():
            cache_path = RESULTS_DIR / cache_path
        if cache_path.exists():
            with open(cache_path) as f:
                chunk_cache = json.load(f)
            print(f"Loaded chunk cache: {len(chunk_cache)} entries")
        else:
            print(f"WARN: Chunk cache not found at {cache_path}, will retrieve fresh")

    results = run_benchmark(env, models, test_cases, chunk_cache)

    # Save
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    if args.output:
        out_path = RESULTS_DIR / args.output
    else:
        ts = datetime.now().strftime("%Y-%m-%dT%H-%M-%S")
        out_path = RESULTS_DIR / f"benchmark_{ts}.json"

    with open(out_path, "w") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    print(f"\nResults saved to {out_path}")
    print(f"Total runs: {results['total_runs']}")
    errors = sum(1 for r in results["results"] if r.get("error"))
    if errors:
        print(f"Errors: {errors}")


if __name__ == "__main__":
    main()
