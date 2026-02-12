#!/usr/bin/env python3
"""Comprehensive LLM-as-judge evaluation for model selection.

Evaluates model responses on 8 qualitative dimensions using Claude as judge.
Merges results from multiple benchmark runs for cross-model comparison.

Usage:
    OPENROUTER_API_KEY=sk-or-... python scripts/judge_comprehensive.py
"""
from __future__ import annotations

import json
import os
import re
import statistics
import sys
import time
from pathlib import Path

import httpx

SCRIPT_DIR = Path(__file__).resolve().parent
RESULTS_DIR = SCRIPT_DIR / "benchmark_results"

# Models to evaluate (must exist in benchmark results)
TARGET_MODELS = [
    "mistralai/mistral-medium-3.1",
    "mistralai/mistral-large-2512",
    "bytedance-seed/seed-1.6",
]

JUDGE_MODEL = "anthropic/claude-sonnet-4.5"

JUDGE_PROMPT_TEMPLATE = """You are an expert evaluator assessing the quality of AI-generated responses in a document Q&A system (RAG — Retrieval-Augmented Generation). The AI is given document fragments and must answer user questions with citations.

## Question
{question}

## Document Type
{doc_type}

## AI Response
---
{response}
---

## Evaluation Dimensions

Rate each dimension from 1 to 5. Be strict and differentiate clearly between models.

1. **Citation Accuracy (CAS)**: Are [n] citations placed correctly after factual claims? Are they relevant to the statements they support?
   - 5: Every factual claim has a relevant citation
   - 3: Most claims cited, some missing or misplaced
   - 1: Very few or no citations, or citations are irrelevant

2. **Hallucination Resistance (HR)**: Does the response avoid fabricating information not in the fragments?
   - 5: Strictly grounded, no fabricated claims
   - 3: Mostly grounded, minor unsupported additions
   - 1: Contains significant fabricated information

3. **Analysis Depth (AD)**: Does the response provide INSIGHT beyond restating facts? Does it synthesize, compare, calculate, or draw conclusions?
   - 5: Rich analysis — calculations, comparisons, implications, connections between data points
   - 3: Some analysis but mostly fact restatement
   - 1: Pure copy-paste from fragments with no synthesis

4. **Language Quality (LQ)**: Is the writing fluent, natural, vivid, and engaging? Does it read like a knowledgeable expert?
   - 5: Eloquent, natural flow, reads like a domain expert wrote it
   - 3: Adequate but somewhat dry or mechanical
   - 1: Stilted, robotic, or awkward phrasing

5. **Structure & Organization (SO)**: Is the response well-organized with clear hierarchy, logical flow, and appropriate use of formatting?
   - 5: Excellent structure — clear sections, logical progression, perfect markdown usage
   - 3: Acceptable structure but could be better organized
   - 1: Disorganized, wall of text, or excessive/poor formatting

6. **Information Completeness (IC)**: How thoroughly does the response address ALL aspects of the question?
   - 5: Comprehensive — covers all relevant aspects with detail
   - 3: Covers main points but misses some relevant details
   - 1: Very incomplete, misses major aspects

7. **Context Integration (CI)**: Does the response weave information from multiple fragments into a coherent narrative, or just list isolated facts?
   - 5: Seamlessly integrates multiple sources into unified analysis
   - 3: References multiple sources but feels like a list
   - 1: Only uses one fragment or presents disconnected facts

8. **Instruction Adherence (IA)**: Does the response follow all RAG rules — answer language matches question language, uses markdown, stays within fragment scope?
   - 5: Perfect rule compliance
   - 3: Minor violations
   - 1: Major violations

## Output Format

Respond with ONLY a JSON object (no markdown fences, no explanation):
{{"cas": <1-5>, "hr": <1-5>, "ad": <1-5>, "lq": <1-5>, "so": <1-5>, "ic": <1-5>, "ci": <1-5>, "ia": <1-5>, "note": "<one sentence summary>"}}"""


def load_and_merge_results() -> list[dict]:
    """Load results from benchmark files and merge target models."""
    all_results = []

    # Load all benchmark files in order
    benchmark_files = [
        "full_benchmark.json",
        "qwen3-mistral-benchmark.json",
        "new-models-benchmark.json",
    ]

    for fname in benchmark_files:
        fpath = RESULTS_DIR / fname
        if fpath.exists():
            with open(fpath) as f:
                data = json.load(f)
            for r in data["results"]:
                if r["model"] in TARGET_MODELS and not r.get("error"):
                    all_results.append(r)

    return all_results


def judge_single(result: dict, api_key: str) -> dict:
    """Run LLM judge on a single result."""
    prompt = JUDGE_PROMPT_TEMPLATE.format(
        question=result["question"],
        doc_type=result.get("document_slug", "unknown"),
        response=result.get("response_text", "")[:4000],
    )

    for attempt in range(3):
        try:
            resp = httpx.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": JUDGE_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 300,
                    "temperature": 0.0,
                },
                timeout=60,
            )
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]

            # Extract JSON from response
            json_match = re.search(r"\{[^}]+\}", content, re.DOTALL)
            if json_match:
                scores = json.loads(json_match.group())
                scores["test_id"] = result["test_id"]
                scores["model"] = result["model"]
                return scores
        except Exception as e:
            if attempt < 2:
                time.sleep(2)
                continue
            return {"error": str(e), "test_id": result["test_id"], "model": result["model"]}

    return {"error": "max retries", "test_id": result["test_id"], "model": result["model"]}


def compute_judge_scorecard(model: str, scores: list[dict]) -> dict:
    """Aggregate judge scores for a model."""
    valid = [s for s in scores if "error" not in s]
    if not valid:
        return {"model": model, "n_judged": 0, "error": "all failed"}

    dims = ["cas", "hr", "ad", "lq", "so", "ic", "ci", "ia"]
    sc = {"model": model, "n_judged": len(valid)}

    for dim in dims:
        vals = [s[dim] for s in valid if dim in s]
        if vals:
            sc[f"avg_{dim}"] = round(statistics.mean(vals), 2)

    # Composite score (weighted)
    # For document Q&A: analysis depth and completeness matter most
    weights = {
        "cas": 1.0,   # Citation accuracy
        "hr": 1.2,    # Hallucination resistance (high weight — critical for RAG)
        "ad": 1.5,    # Analysis depth (high weight — differentiator)
        "lq": 1.0,    # Language quality
        "so": 0.8,    # Structure
        "ic": 1.3,    # Information completeness (high weight)
        "ci": 1.0,    # Context integration
        "ia": 0.8,    # Instruction adherence
    }
    weighted_scores = []
    for s in valid:
        total = 0
        w_sum = 0
        for dim, w in weights.items():
            if dim in s:
                total += s[dim] * w
                w_sum += w
        if w_sum > 0:
            weighted_scores.append(total / w_sum)

    if weighted_scores:
        sc["composite_score"] = round(statistics.mean(weighted_scores), 2)

    return sc


def main():
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        # Try loading from .env
        env_paths = [Path(".env"), Path("..") / ".env"]
        for ep in env_paths:
            if ep.exists():
                for line in ep.read_text().splitlines():
                    if line.startswith("OPENROUTER_API_KEY="):
                        api_key = line.split("=", 1)[1].strip().strip('"').strip("'")
                        break
            if api_key:
                break

    if not api_key:
        print("ERROR: OPENROUTER_API_KEY not found")
        sys.exit(1)

    print("Loading benchmark results...")
    all_results = load_and_merge_results()

    # Count per model
    model_counts = {}
    for r in all_results:
        model_counts[r["model"]] = model_counts.get(r["model"], 0) + 1

    print(f"Loaded {len(all_results)} results:")
    for m, c in sorted(model_counts.items()):
        print(f"  {m}: {c} cases")

    missing = [m for m in TARGET_MODELS if m not in model_counts]
    if missing:
        print(f"WARNING: Missing models: {missing}")

    # Run LLM judge on ALL results
    total = len(all_results)
    print(f"\nRunning LLM-as-judge on {total} responses (8 dimensions each)...")
    print(f"Judge model: {JUDGE_MODEL}")
    print(f"Estimated time: ~{total * 3 // 60} minutes\n")

    judge_results = []
    for i, r in enumerate(all_results, 1):
        model_short = r["model"].split("/")[-1]
        print(f"  [{i}/{total}] {r['test_id']} ({model_short})...", end=" ", flush=True)

        scores = judge_single(r, api_key)
        judge_results.append(scores)

        if "error" in scores:
            print(f"ERR: {scores['error']}")
        else:
            ad = scores.get("ad", "?")
            lq = scores.get("lq", "?")
            ic = scores.get("ic", "?")
            print(f"AD={ad} LQ={lq} IC={ic}")

        # Rate limit: ~1 req/sec
        if i < total:
            time.sleep(0.5)

    # Compute per-model scorecards
    print("\n" + "=" * 70)
    print("COMPREHENSIVE JUDGE SCORECARDS")
    print("=" * 70)

    model_scores: dict[str, list[dict]] = {}
    for s in judge_results:
        model_scores.setdefault(s["model"], []).append(s)

    scorecards = []
    for model in TARGET_MODELS:
        if model in model_scores:
            sc = compute_judge_scorecard(model, model_scores[model])
            scorecards.append(sc)

    # Print table
    dims = ["cas", "hr", "ad", "lq", "so", "ic", "ci", "ia"]
    dim_names = {
        "cas": "Citation",
        "hr": "No Halluc.",
        "ad": "Depth",
        "lq": "Lang Qual",
        "so": "Structure",
        "ic": "Complete",
        "ci": "Integration",
        "ia": "Instruct.",
    }

    header = f"{'Model':<25} " + " ".join(f"{dim_names[d]:>10}" for d in dims) + f" {'COMPOSITE':>10}"
    print(f"\n{header}")
    print("-" * len(header))

    for sc in scorecards:
        model_short = sc["model"].split("/")[-1]
        vals = " ".join(f"{sc.get(f'avg_{d}', 0):>10.2f}" for d in dims)
        comp = sc.get("composite_score", 0)
        print(f"{model_short:<25} {vals} {comp:>10.2f}")

    # Save results
    output_path = RESULTS_DIR / "comprehensive_judge_results.json"
    with open(output_path, "w") as f:
        json.dump({
            "judge_model": JUDGE_MODEL,
            "dimensions": list(dim_names.keys()),
            "dimension_names": dim_names,
            "weights": {
                "cas": 1.0, "hr": 1.2, "ad": 1.5, "lq": 1.0,
                "so": 0.8, "ic": 1.3, "ci": 1.0, "ia": 0.8,
            },
            "scorecards": scorecards,
            "raw_scores": judge_results,
        }, f, indent=2, ensure_ascii=False)
    print(f"\nResults saved to {output_path}")

    # Print recommendation
    print("\n" + "=" * 70)
    print("MODEL RANKING BY COMPOSITE SCORE")
    print("=" * 70)
    ranked = sorted(scorecards, key=lambda s: s.get("composite_score", 0), reverse=True)
    for i, sc in enumerate(ranked, 1):
        m = sc["model"].split("/")[-1]
        comp = sc.get("composite_score", 0)
        ad = sc.get("avg_ad", 0)
        lq = sc.get("avg_lq", 0)
        print(f"  #{i} {m:<25} Composite={comp:.2f}  Depth={ad:.2f}  LangQual={lq:.2f}")


if __name__ == "__main__":
    main()
