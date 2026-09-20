"""J1: triage competitor-gap keywords with Jev.

Design: .collab/plans/2026-09-20-jev-seo-design.md §3.2.
This is the job Jev is *necessary* for: the corpus is hundreds to thousands of
rows, and a substring filter ('pdf') would both admit noise and miss real
matches ('study guide generator', 'and ask questions', 'help pdf').

Five independent judgments over the same state, batched into one request per
keyword (docs: cookbooks/parallel_questions). Raw probabilities are written
alongside every decision so thresholds can change in code without re-running.
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from jev_client import JevClient, choice, noul  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"

PRODUCT = (
    "DocTalk is a web app where a person uploads their own document (PDF, DOCX, PPTX, XLSX, "
    "TXT, Markdown) or a URL and chats with an AI about it. Every answer carries a numbered "
    "citation that jumps to and highlights the exact passage in the source. It also offers "
    "machine-verified verbatim quote extraction with page numbers, OCR for scanned PDFs, "
    "layout-preserving PDF translation, and answers in 11 languages."
)

SECTIONS = {
    "home": "The landing page. Only for the product's own brand name or the single broadest category term.",
    "features": "A capability page: citation highlighting, multi-format support, multilingual, free demo, performance modes, layout-preserving translation.",
    "use_cases": "An audience page: lawyers, finance, students, teachers, consultants, healthcare, HR/contracts, real estate, compliance.",
    "compare": "A head-to-head page against one named competitor (ChatPDF, AskYourPDF, Humata, NotebookLM, PDF.ai).",
    "alternatives": "An 'alternatives to X' page for one named competitor.",
    "tools": "A free browser-only utility page: word counter, reading time estimator. No upload, no AI.",
    "pricing": "The plans and pricing page.",
    "blog": "An article: how-to guides, tool round-ups, research-workflow explainers.",
    "none": "No page on this site should target it — the query is outside what this product does, or it is another company's brand that we do not have a page for.",
}


def _volume(raw: str) -> int:
    raw = raw.strip()
    if raw.endswith("K"):
        return int(float(raw[:-1]) * 1000)
    return int(raw) if raw.isdigit() else 0


def load_rows() -> list[dict]:
    with open(HERE / "data" / "gap_full_us_20260919.psv", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh, delimiter="|"))
    for row in rows:
        row["volume"] = _volume(row["volume"])
    return rows


def main() -> int:
    rows = load_rows()
    client = JevClient()

    def build(row):
        state = {
            "product": PRODUCT,
            "search_query": row["keyword"],
            "monthly_us_volume": row["volume"],
            "keyword_difficulty_0_to_100": row["kd"] or "unknown",
        }
        return state, {
                "relevant": noul(
                    "Could DocTalk, as described in `product`, genuinely satisfy someone who typed "
                    "`search_query` into Google?",
                    true="A person typing this wants something DocTalk actually does, so a DocTalk page could honestly rank for it and serve the searcher.",
                    false="The query is for a different job (detecting AI-written text, humanising text, paraphrasing, making flashcards or slides, fonts, song lyrics, movies), or it is only a brand name for a company whose product DocTalk does not replace.",
                ),
                "owner_section": choice(
                    "Assuming DocTalk should target `search_query`, which section of its site should own that query?",
                    SECTIONS,
                ),
                "search_intent": choice(
                    "What is the searcher trying to do when they type `search_query`?",
                    {
                        "informational": "Learn how something works or find an explanation.",
                        "commercial": "Compare or evaluate products before choosing one.",
                        "transactional": "Start using or buying a specific product right now.",
                        "navigational": "Reach one particular website or brand they already have in mind.",
                    },
                ),
                "heavy_document": noul(
                    "Does `search_query` imply the searcher is dealing with a LARGE or LONG document "
                    "— many pages, a big file, or a document another tool already refused?",
                    true="The wording points at size or length, or at a limit being hit.",
                    false="No hint about the document's size.",
                ),
                "icp_fit": choice(
                    "Which professional audience does `search_query` most point to?",
                    {
                        "academic": "A student or researcher working with papers, theses or study material.",
                        "legal": "A lawyer or compliance professional working with contracts, filings or regulations.",
                        "finance": "An analyst working with reports, statements or filings.",
                        "general": "A general knowledge worker with no specific profession implied.",
                        "none": "No professional context at all.",
                    },
                ),
        }

    def progress(done, total):
        if done % 50 == 0 or done == total:
            print(f"  ... {done}/{total}  ({client.usage_line()})", file=sys.stderr)

    responses = client.ask_many(rows, build, workers=8, on_progress=progress)

    results = []
    for row, resp in zip(rows, responses):
        a = resp["answers"]
        rec = {
            "keyword": row["keyword"],
            "volume": row["volume"],
            "kd": row["kd"],
            "chatpdf_pos": row["chatpdf_pos"],
            "relevant_p": round(a["relevant"]["noul"], 3),
            "section": a["owner_section"]["choice"],
            "section_conf": round(a["owner_section"]["confidence"], 3),
            "intent": a["search_intent"]["choice"],
            "intent_conf": round(a["search_intent"]["confidence"], 3),
            "heavy_doc_p": round(a["heavy_document"]["noul"], 3),
            "icp": a["icp_fit"]["choice"],
            "icp_conf": round(a["icp_fit"]["confidence"], 3),
            "section_probs": {k: round(v, 3) for k, v in a["owner_section"]["probabilities"].items()},
        }
        results.append(rec)

    OUT.mkdir(exist_ok=True)
    (OUT / "keyword_triage.json").write_text(
        json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(f"{len(results)} keywords triaged. {client.usage_line()}")
    print(f"written: {OUT / 'keyword_triage.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
