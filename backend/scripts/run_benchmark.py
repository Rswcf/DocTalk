#!/usr/bin/env python3
"""DocTalk RAG Benchmark Runner.

Runs all test cases against specified models via the DocTalk API and records
raw results (response text, citations, timing).

Usage:
    # Against local backend (default http://localhost:8000):
    python scripts/run_benchmark.py --jwt <JWT_TOKEN>

    # Specific models only:
    python scripts/run_benchmark.py --jwt <JWT> --models deepseek/deepseek-v3.2,anthropic/claude-sonnet-4.5

    # Against production:
    python scripts/run_benchmark.py --jwt <JWT> --base-url https://backend-production-a62e.up.railway.app

    # All models:
    python scripts/run_benchmark.py --jwt <JWT> --models all
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx

SCRIPT_DIR = Path(__file__).resolve().parent
TEST_CASES_PATH = SCRIPT_DIR / "benchmark_test_cases.json"
RESULTS_DIR = SCRIPT_DIR / "benchmark_results"

ALL_MODELS = [
    "deepseek/deepseek-v3.2",
    "google/gemini-3-flash-preview",
    "x-ai/grok-4.1-fast",
    "minimax/minimax-m2.1",
    "moonshotai/kimi-k2.5",
    "openai/gpt-5.2",
    "google/gemini-3-pro-preview",
    "anthropic/claude-sonnet-4.5",
    "anthropic/claude-opus-4.6",
]


def load_test_cases() -> list[dict]:
    with open(TEST_CASES_PATH) as f:
        data = json.load(f)
    return data["test_cases"]


def get_demo_documents(base_url: str, jwt: str) -> dict[str, str]:
    """Return {slug: document_id} mapping from /api/documents/demo."""
    resp = httpx.get(
        f"{base_url}/api/documents/demo",
        headers={"Authorization": f"Bearer {jwt}"},
        timeout=30,
    )
    resp.raise_for_status()
    docs = resp.json()
    return {d["slug"]: d["document_id"] for d in docs}


def create_session(base_url: str, jwt: str, document_id: str) -> str:
    """Create a chat session and return session_id."""
    resp = httpx.post(
        f"{base_url}/api/documents/{document_id}/sessions",
        headers={"Authorization": f"Bearer {jwt}"},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["session_id"]


def delete_session(base_url: str, jwt: str, session_id: str) -> None:
    """Delete a chat session (best-effort cleanup)."""
    try:
        httpx.delete(
            f"{base_url}/api/sessions/{session_id}",
            headers={"Authorization": f"Bearer {jwt}"},
            timeout=15,
        )
    except Exception:
        pass


def chat_sse(
    base_url: str, jwt: str, session_id: str, question: str, model: str, locale: str
) -> dict:
    """Send a chat request via SSE and collect the full response.

    Returns dict with keys: text, citations, ttft_ms, total_ms, error.
    """
    result: dict = {
        "text": "",
        "citations": [],
        "ttft_ms": None,
        "total_ms": None,
        "error": None,
    }

    start = time.monotonic()
    first_token_time: float | None = None
    text_parts: list[str] = []
    citations: list[dict] = []

    try:
        with httpx.stream(
            "POST",
            f"{base_url}/api/sessions/{session_id}/chat",
            headers={
                "Authorization": f"Bearer {jwt}",
                "Accept": "text/event-stream",
            },
            json={"message": question, "model": model, "locale": locale},
            timeout=httpx.Timeout(connect=15.0, read=120.0, write=15.0, pool=15.0),
        ) as resp:
            resp.raise_for_status()
            current_event = ""
            for line in resp.iter_lines():
                if line.startswith("event:"):
                    current_event = line[6:].strip()
                elif line.startswith("data:"):
                    data_str = line[5:].strip()
                    try:
                        data = json.loads(data_str)
                    except json.JSONDecodeError:
                        continue

                    if current_event == "token":
                        if first_token_time is None:
                            first_token_time = time.monotonic()
                        text_parts.append(data.get("text", ""))

                    elif current_event == "citation":
                        citations.append(data)

                    elif current_event == "error":
                        result["error"] = data.get("message", str(data))

                    elif current_event == "done":
                        pass
    except Exception as e:
        result["error"] = str(e)

    end = time.monotonic()
    result["text"] = "".join(text_parts)
    result["citations"] = citations
    result["total_ms"] = round((end - start) * 1000)
    if first_token_time is not None:
        result["ttft_ms"] = round((first_token_time - start) * 1000)

    return result


def run_benchmark(
    base_url: str,
    jwt: str,
    models: list[str],
    test_ids: list[str] | None = None,
) -> dict:
    """Run the full benchmark and return results dict."""
    test_cases = load_test_cases()
    if test_ids:
        test_cases = [tc for tc in test_cases if tc["id"] in test_ids]

    print(f"Loaded {len(test_cases)} test cases, {len(models)} models")
    print(f"Total runs: {len(test_cases) * len(models)}")

    # Fetch demo document IDs
    print("Fetching demo document IDs...")
    try:
        slug_to_id = get_demo_documents(base_url, jwt)
    except Exception as e:
        print(f"ERROR: Could not fetch demo documents: {e}")
        sys.exit(1)

    print(f"Demo documents: {slug_to_id}")

    results: list[dict] = []
    total = len(test_cases) * len(models)
    completed = 0

    for model in models:
        print(f"\n{'='*60}")
        print(f"Model: {model}")
        print(f"{'='*60}")

        for tc in test_cases:
            completed += 1
            doc_id = slug_to_id.get(tc["document_slug"])
            if not doc_id:
                print(f"  [{completed}/{total}] SKIP {tc['id']} — document '{tc['document_slug']}' not found")
                continue

            print(f"  [{completed}/{total}] {tc['id']}...", end=" ", flush=True)

            # Create session
            try:
                session_id = create_session(base_url, jwt, doc_id)
            except Exception as e:
                print(f"FAIL (session create: {e})")
                results.append({
                    "test_id": tc["id"],
                    "model": model,
                    "error": f"session_create_failed: {e}",
                })
                continue

            # Run chat
            locale = tc.get("language", "en")
            chat_result = chat_sse(base_url, jwt, session_id, tc["question"], model, locale)

            ttft = f"{chat_result['ttft_ms']}ms" if chat_result["ttft_ms"] else "N/A"
            total_time = f"{chat_result['total_ms']}ms"
            n_cites = len(chat_result["citations"])
            status = "ERR" if chat_result["error"] else "OK"
            print(f"{status} ttft={ttft} total={total_time} cites={n_cites}")

            results.append({
                "test_id": tc["id"],
                "model": model,
                "document_slug": tc["document_slug"],
                "question": tc["question"],
                "language": locale,
                "type": tc["type"],
                "is_negative": tc.get("is_negative", False),
                "expected_min_citations": tc.get("expected_min_citations", 0),
                "ground_truth_keywords": tc.get("ground_truth_keywords", []),
                "response_text": chat_result["text"],
                "citations": chat_result["citations"],
                "ttft_ms": chat_result["ttft_ms"],
                "total_ms": chat_result["total_ms"],
                "error": chat_result["error"],
            })

            # Cleanup session
            delete_session(base_url, jwt, session_id)

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "base_url": base_url,
        "models": models,
        "total_cases": len(test_cases),
        "total_runs": len(results),
        "results": results,
    }


def main():
    parser = argparse.ArgumentParser(description="DocTalk RAG Benchmark Runner")
    parser.add_argument("--jwt", required=True, help="JWT token for authentication")
    parser.add_argument("--base-url", default="http://localhost:8000", help="Backend base URL")
    parser.add_argument("--models", default="all", help="Comma-separated model IDs or 'all'")
    parser.add_argument("--test-ids", default=None, help="Comma-separated test case IDs (default: all)")
    parser.add_argument("--output", default=None, help="Output filename (default: timestamped)")
    args = parser.parse_args()

    if args.models == "all":
        models = ALL_MODELS
    else:
        models = [m.strip() for m in args.models.split(",")]

    test_ids = [t.strip() for t in args.test_ids.split(",")] if args.test_ids else None

    results = run_benchmark(args.base_url, args.jwt, models, test_ids)

    # Save results
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    if args.output:
        out_path = RESULTS_DIR / args.output
    else:
        ts = datetime.now().strftime("%Y-%m-%dT%H-%M-%S")
        out_path = RESULTS_DIR / f"{ts}.json"

    with open(out_path, "w") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    print(f"\nResults saved to {out_path}")
    print(f"Total runs: {results['total_runs']}")

    # Quick summary
    errors = sum(1 for r in results["results"] if r.get("error"))
    if errors:
        print(f"Errors: {errors}")


if __name__ == "__main__":
    main()
