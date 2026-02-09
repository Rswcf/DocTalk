#!/usr/bin/env python3
"""DocTalk RAG Benchmark Evaluator.

Reads raw benchmark results and computes per-model scorecards using both
automated metrics and (optionally) LLM-as-judge evaluation.

Usage:
    # Automated metrics only (no API key needed):
    python scripts/evaluate_benchmark.py --results benchmark_results/2026-02-10T10-30-00.json

    # With LLM-as-judge (requires OPENROUTER_API_KEY env var):
    python scripts/evaluate_benchmark.py --results benchmark_results/2026-02-10T10-30-00.json --llm-judge
"""
from __future__ import annotations

import argparse
import json
import os
import re
import statistics
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
RESULTS_DIR = SCRIPT_DIR / "benchmark_results"


# ---------------------------------------------------------------------------
# Automated metrics
# ---------------------------------------------------------------------------

def count_citations(text: str) -> int:
    """Count unique [n] citation references in text."""
    return len(set(re.findall(r"\[(\d+)\]", text)))


def check_language_compliance(text: str, expected_lang: str) -> bool:
    """Heuristic language detection based on character ratios."""
    if not text.strip():
        return False

    # Count character types
    cjk = sum(1 for c in text if "\u4e00" <= c <= "\u9fff")
    hiragana_katakana = sum(1 for c in text if "\u3040" <= c <= "\u30ff")
    arabic_chars = sum(1 for c in text if "\u0600" <= c <= "\u06ff")
    latin = sum(1 for c in text if c.isascii() and c.isalpha())
    total_alpha = cjk + hiragana_katakana + arabic_chars + latin
    if total_alpha == 0:
        return True  # all numbers/symbols — pass

    if expected_lang == "zh":
        return cjk / total_alpha > 0.3
    elif expected_lang == "ja":
        return (cjk + hiragana_katakana) / total_alpha > 0.3
    elif expected_lang == "ar":
        return arabic_chars / total_alpha > 0.3
    elif expected_lang == "es":
        # Spanish uses Latin chars; check for Spanish-specific markers
        spanish_markers = ["ñ", "á", "é", "í", "ó", "ú", "¿", "¡"]
        has_markers = any(m in text.lower() for m in spanish_markers)
        return latin / total_alpha > 0.5 and (has_markers or expected_lang == "en")
    else:
        # Default: mostly Latin is fine for EN, DE, FR, etc.
        return latin / total_alpha > 0.3


def check_markdown_quality(text: str) -> float:
    """Score markdown quality from 0–10 based on structural element usage."""
    score = 0.0
    if "**" in text:
        score += 2  # bold
    if re.search(r"^[-*] ", text, re.MULTILINE):
        score += 2  # bullet lists
    if re.search(r"^\d+\. ", text, re.MULTILINE):
        score += 1  # numbered lists
    if re.search(r"^#{1,3} ", text, re.MULTILINE):
        score += 1  # headers
    if "|" in text and "---" in text:
        score += 2  # tables
    if "```" in text:
        score += 1  # code blocks
    # Baseline for any non-empty well-structured response
    if len(text) > 50:
        score += 1
    return min(score, 10.0)


def check_negative_case(text: str, is_negative: bool) -> bool | None:
    """For negative cases, check if model correctly said 'not found'.
    Returns None for non-negative cases.
    """
    if not is_negative:
        return None

    text_lower = text.lower()
    not_found_phrases = [
        "not found", "not mention", "no information", "not contain",
        "not available", "does not", "doesn't", "not present",
        "not included", "not discuss", "cannot find", "no specific",
        "not specified", "unable to find",
        # Chinese
        "未找到", "没有提到", "没有包含", "未提及", "没有相关",
        # Spanish
        "no se encuentra", "no menciona", "no contiene",
        # Japanese
        "見つかり", "記載されて", "含まれて",
    ]

    # Also check that the response doesn't hallucinate a concrete answer
    hallucination_signals = [
        "the revenue", "the plan", "the strategy",
        "they operate", "the number of stores",
    ]

    has_not_found = any(p in text_lower for p in not_found_phrases)
    has_hallucination = any(p in text_lower for p in hallucination_signals)

    return has_not_found and not has_hallucination


def check_keyword_coverage(text: str, keywords: list[str]) -> float:
    """Fraction of ground-truth keywords found in the response."""
    if not keywords:
        return 1.0
    text_lower = text.lower()
    found = sum(1 for kw in keywords if kw.lower() in text_lower)
    return found / len(keywords)


# ---------------------------------------------------------------------------
# Evaluation pipeline
# ---------------------------------------------------------------------------

def evaluate_result(r: dict) -> dict:
    """Compute automated metrics for a single benchmark result."""
    text = r.get("response_text", "")
    citations_in_text = count_citations(text)
    citations_from_sse = len(r.get("citations", []))

    metrics = {
        "test_id": r["test_id"],
        "model": r["model"],
        "error": r.get("error"),
        "ttft_ms": r.get("ttft_ms"),
        "total_ms": r.get("total_ms"),
        "citation_count_text": citations_in_text,
        "citation_count_sse": citations_from_sse,
        "meets_min_citations": citations_from_sse >= r.get("expected_min_citations", 0),
        "language_compliant": check_language_compliance(text, r.get("language", "en")),
        "markdown_quality": check_markdown_quality(text),
        "negative_case_correct": check_negative_case(text, r.get("is_negative", False)),
        "keyword_coverage": check_keyword_coverage(text, r.get("ground_truth_keywords", [])),
        "response_length": len(text),
    }
    return metrics


def compute_model_scorecard(model: str, metrics_list: list[dict]) -> dict:
    """Aggregate metrics into a per-model scorecard."""
    valid = [m for m in metrics_list if not m.get("error")]
    all_results = metrics_list

    n_total = len(all_results)
    n_errors = sum(1 for m in all_results if m.get("error"))
    n_valid = len(valid)

    if n_valid == 0:
        return {
            "model": model,
            "n_total": n_total,
            "n_errors": n_errors,
            "n_valid": 0,
            "error_rate": 1.0,
        }

    # TTFT
    ttfts = [m["ttft_ms"] for m in valid if m["ttft_ms"] is not None]
    avg_ttft = statistics.mean(ttfts) if ttfts else None
    p50_ttft = statistics.median(ttfts) if ttfts else None
    p95_ttft = sorted(ttfts)[int(len(ttfts) * 0.95)] if len(ttfts) >= 2 else (ttfts[0] if ttfts else None)

    # Total time
    total_times = [m["total_ms"] for m in valid if m["total_ms"] is not None]
    avg_total = statistics.mean(total_times) if total_times else None

    # Citation accuracy
    meets_cites = [m["meets_min_citations"] for m in valid]
    citation_accuracy = sum(meets_cites) / len(meets_cites) if meets_cites else 0

    # Language compliance
    lang_checks = [m["language_compliant"] for m in valid]
    lang_compliance = sum(lang_checks) / len(lang_checks) if lang_checks else 0

    # Markdown quality
    md_scores = [m["markdown_quality"] for m in valid]
    avg_markdown = statistics.mean(md_scores) if md_scores else 0

    # Negative case accuracy
    neg_results = [m["negative_case_correct"] for m in valid if m["negative_case_correct"] is not None]
    neg_accuracy = sum(neg_results) / len(neg_results) if neg_results else None

    # Keyword coverage (proxy for information completeness)
    kw_covs = [m["keyword_coverage"] for m in valid]
    avg_keyword_cov = statistics.mean(kw_covs) if kw_covs else 0

    return {
        "model": model,
        "n_total": n_total,
        "n_errors": n_errors,
        "n_valid": n_valid,
        "error_rate": round(n_errors / n_total, 3) if n_total else 0,
        "avg_ttft_ms": round(avg_ttft) if avg_ttft else None,
        "p50_ttft_ms": round(p50_ttft) if p50_ttft else None,
        "p95_ttft_ms": round(p95_ttft) if p95_ttft else None,
        "avg_total_ms": round(avg_total) if avg_total else None,
        "citation_accuracy": round(citation_accuracy, 3),
        "language_compliance": round(lang_compliance, 3),
        "avg_markdown_quality": round(avg_markdown, 1),
        "negative_case_accuracy": round(neg_accuracy, 3) if neg_accuracy is not None else None,
        "avg_keyword_coverage": round(avg_keyword_cov, 3),
    }


def generate_report(scorecards: list[dict], output_path: Path) -> str:
    """Generate a human-readable Markdown report."""
    lines = [
        "# DocTalk RAG Benchmark Report",
        "",
        f"Generated: {scorecards[0].get('_timestamp', 'N/A') if scorecards else 'N/A'}",
        "",
        "## Model Scorecards",
        "",
        "| Model | Valid/Total | Err% | Avg TTFT | P95 TTFT | Cite Acc | Lang | MD | Neg Acc | KW Cov |",
        "|-------|-----------|------|----------|----------|----------|------|-----|---------|--------|",
    ]

    for sc in scorecards:
        model_short = sc["model"].split("/")[-1]
        valid_total = f"{sc['n_valid']}/{sc['n_total']}"
        err_pct = f"{sc['error_rate']*100:.1f}%"
        ttft = f"{sc['avg_ttft_ms']}ms" if sc.get("avg_ttft_ms") else "N/A"
        p95 = f"{sc['p95_ttft_ms']}ms" if sc.get("p95_ttft_ms") else "N/A"
        cite = f"{sc['citation_accuracy']*100:.0f}%" if sc.get("citation_accuracy") is not None else "N/A"
        lang = f"{sc['language_compliance']*100:.0f}%" if sc.get("language_compliance") is not None else "N/A"
        md = f"{sc['avg_markdown_quality']:.1f}" if sc.get("avg_markdown_quality") is not None else "N/A"
        neg = f"{sc['negative_case_accuracy']*100:.0f}%" if sc.get("negative_case_accuracy") is not None else "N/A"
        kw = f"{sc['avg_keyword_coverage']*100:.0f}%" if sc.get("avg_keyword_coverage") is not None else "N/A"

        lines.append(f"| {model_short} | {valid_total} | {err_pct} | {ttft} | {p95} | {cite} | {lang} | {md} | {neg} | {kw} |")

    lines.extend([
        "",
        "## Metric Definitions",
        "",
        "- **Cite Acc**: % of test cases meeting minimum expected citation count",
        "- **Lang**: % of responses in correct language",
        "- **MD**: Average markdown quality score (0-10)",
        "- **Neg Acc**: % of negative cases correctly identified as 'not found'",
        "- **KW Cov**: Average ground-truth keyword coverage (proxy for completeness)",
        "",
    ])

    report = "\n".join(lines)
    with open(output_path, "w") as f:
        f.write(report)
    return report


# ---------------------------------------------------------------------------
# LLM-as-judge (optional)
# ---------------------------------------------------------------------------

def llm_judge_evaluate(result: dict, api_key: str) -> dict:
    """Use Claude via OpenRouter to evaluate a single response.
    Returns scores for citation_accuracy, hallucination, completeness.
    """
    import httpx

    prompt = f"""You are evaluating a RAG (Retrieval-Augmented Generation) response.

Question: {result['question']}
Document type: {result.get('document_slug', 'unknown')}

Response to evaluate:
---
{result.get('response_text', '')[:3000]}
---

Number of citations in response: {len(result.get('citations', []))}

Evaluate on these dimensions (score 1-5 each):

1. **Citation Accuracy (CAS)**: Do the [n] citations appear to reference relevant fragments? Are claims supported by citations?
2. **Hallucination (HR)**: Does the response contain claims that seem fabricated or unsupported?
   - 5 = no hallucination, 1 = severe hallucination
3. **Information Completeness (ICS)**: How thoroughly does the response address the question?
4. **Instruction Adherence (IAS)**: Does the response follow RAG rules (based on fragments only, proper citations, markdown)?

Respond with ONLY a JSON object:
{{"citation_accuracy": <1-5>, "hallucination_score": <1-5>, "completeness": <1-5>, "instruction_adherence": <1-5>, "brief_note": "<one sentence>"}}"""

    try:
        resp = httpx.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "anthropic/claude-sonnet-4.5",
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 256,
                "temperature": 0.0,
            },
            timeout=60,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        # Extract JSON from response
        json_match = re.search(r"\{[^}]+\}", content)
        if json_match:
            return json.loads(json_match.group())
    except Exception as e:
        return {"error": str(e)}

    return {"error": "Could not parse LLM judge response"}


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="DocTalk RAG Benchmark Evaluator")
    parser.add_argument("--results", required=True, help="Path to benchmark results JSON")
    parser.add_argument("--llm-judge", action="store_true", help="Use LLM-as-judge for qualitative evaluation")
    parser.add_argument("--judge-sample", type=int, default=5, help="Max cases per model for LLM judge (default: 5)")
    args = parser.parse_args()

    results_path = Path(args.results)
    if not results_path.is_absolute():
        results_path = RESULTS_DIR / results_path

    if not results_path.exists():
        print(f"ERROR: Results file not found: {results_path}")
        sys.exit(1)

    with open(results_path) as f:
        raw = json.load(f)

    results = raw["results"]
    print(f"Loaded {len(results)} results from {results_path.name}")

    # Compute automated metrics
    all_metrics: list[dict] = []
    for r in results:
        m = evaluate_result(r)
        all_metrics.append(m)

    # Group by model
    models_seen: dict[str, list[dict]] = {}
    for m in all_metrics:
        models_seen.setdefault(m["model"], []).append(m)

    # Compute scorecards
    scorecards: list[dict] = []
    for model, metrics in sorted(models_seen.items()):
        sc = compute_model_scorecard(model, metrics)
        sc["_timestamp"] = raw.get("timestamp", "")
        scorecards.append(sc)
        print(f"\n{model}:")
        for k, v in sc.items():
            if k.startswith("_"):
                continue
            print(f"  {k}: {v}")

    # Optional LLM-as-judge
    if args.llm_judge:
        api_key = os.environ.get("OPENROUTER_API_KEY")
        if not api_key:
            print("\nWARN: OPENROUTER_API_KEY not set, skipping LLM judge")
        else:
            print(f"\nRunning LLM-as-judge (sample={args.judge_sample} per model)...")
            judge_results = []
            for model, metrics in sorted(models_seen.items()):
                model_results = [r for r in results if r["model"] == model and not r.get("error")]
                sample = model_results[: args.judge_sample]
                for r in sample:
                    print(f"  Judging {r['test_id']} ({model.split('/')[-1]})...", end=" ", flush=True)
                    judge = llm_judge_evaluate(r, api_key)
                    judge["test_id"] = r["test_id"]
                    judge["model"] = model
                    judge_results.append(judge)
                    if "error" in judge:
                        print(f"ERR: {judge['error']}")
                    else:
                        print(f"CAS={judge.get('citation_accuracy')} HR={judge.get('hallucination_score')} ICS={judge.get('completeness')}")

            # Save judge results alongside scorecard
            judge_path = results_path.with_name(results_path.stem + "_judge.json")
            with open(judge_path, "w") as f:
                json.dump(judge_results, f, indent=2, ensure_ascii=False)
            print(f"LLM judge results saved to {judge_path}")

    # Save scorecard
    scorecard_path = results_path.with_name(results_path.stem + "_scorecard.json")
    with open(scorecard_path, "w") as f:
        json.dump(scorecards, f, indent=2, ensure_ascii=False)
    print(f"\nScorecard saved to {scorecard_path}")

    # Generate report
    report_path = results_path.with_name(results_path.stem + "_report.md")
    report = generate_report(scorecards, report_path)
    print(f"Report saved to {report_path}")
    print("\n" + report)


if __name__ == "__main__":
    main()
