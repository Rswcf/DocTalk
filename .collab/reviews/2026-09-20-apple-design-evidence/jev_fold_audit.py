"""Judge every public DocTalk marketing route's above-the-fold grammar with Jev.

Jev sees the REAL rendered copy extracted from production HTML (fold-extract.json),
never a paraphrase. Code does the fetching, parsing, ranking and reporting; Jev
supplies only the judgements that need reading comprehension.

Usage:  TYPESAFE_API_KEY=... python3 jev_fold_audit.py [--limit N]
"""
from __future__ import annotations
import json, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
WORKTREE = Path("/Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/frontend-design-review-c26fcb")
sys.path.insert(0, str(WORKTREE / "frontend" / "scripts" / "seo"))
from jev_client import JevClient, noul, score  # noqa: E402

# --- the questions -------------------------------------------------------
# Wording is fixed here and reused for every page so the results are comparable
# (docs: a Noul's phrasing must not vary between items). Nouls are phrased so
# that HIGH = the thing we are worried about is TRUE.

QUESTIONS = {
    "headline_apple_grammar": score(
        {
            "task": "Judge how closely this page's H1 headline follows the compositional grammar "
                    "Apple uses on its product marketing pages.",
            "definition": "Apple's grammar: one short declarative claim, typically two to seven "
                          "words, that stands alone without the subhead, states a benefit or an "
                          "identity rather than a feature name, and does not hedge or qualify.",
            "judge": "Judge only the headline string in `headline`. Ignore the subhead, the URL and "
                     "how good the page is otherwise.",
        },
        [
            "A keyword phrase or category label with no verb and no claim, such as a bare product "
            "or comparison title.",
            "A complete sentence but long or compound: more than about twelve words, or carrying a "
            "comma, a contrast, or a qualifying clause.",
            "A short sentence that nevertheless names a feature or a mechanism rather than making a "
            "claim the reader would care about.",
            "A short declarative claim of roughly two to seven words that reads well alone and "
            "states a benefit, though its phrasing is ordinary.",
            "A short declarative claim of roughly two to seven words that reads well alone, states a "
            "benefit, and is phrased with evident craft.",
        ],
    ),
    "competing_actions": noul(
        {
            "task": "Decide whether the reader is offered several competing next steps of similar "
                    "prominence near the top of the page, rather than one obvious one.",
            "judge": "Consider `actions_near_top`. Ignore the accessibility link labelled 'Skip to "
                     "content' and ignore language or locale switchers. Two actions where one is "
                     "plainly the main one and the other is a quiet secondary link count as ONE "
                     "dominant step, not as competing.",
        },
        true="Three or more real calls to action of comparable weight, or two that compete for the "
             "same decision, so the reader must choose where to go.",
        false="One dominant next step, optionally with a clearly subordinate secondary link.",
    ),
    "prose_before_product": noul(
        {
            "task": "Decide whether the page makes the reader consume dense explanatory prose before "
                    "it shows, demonstrates or points at the product itself.",
            "judge": "Consider `subhead` and `second_paragraph` together with "
                     "`words_before_first_section`. Explanatory prose means multi-sentence paragraphs "
                     "describing capabilities, architecture or policy.",
        },
        true="The top of the page is two or more sentences of explanatory paragraph text before any "
             "demonstration, screenshot cue, or direct invitation to try the product.",
        false="The top of the page reaches a demonstration or a direct invitation quickly, with at "
              "most a short one-sentence supporting line.",
    ),
    "acquisition_weight": score(
        {
            "task": "Judge how much this page matters for turning a stranger into a paying DocTalk "
                    "customer.",
            "context": "DocTalk is a paid AI document question-answering tool. Its landing page, "
                       "pricing page and interactive demo are where purchase decisions are made. "
                       "Comparison and alternatives pages capture people already shopping. Feature "
                       "pages explain capability. Legal, imprint and contact pages are obligations.",
            "judge": "Judge the page's role from its URL, headline and section headings.",
        },
        [
            "A legal, administrative or informational obligation that no buyer's decision depends on.",
            "A supporting page a curious reader might open once, with little bearing on a purchase.",
            "A page that explains a capability and could influence a reader already interested.",
            "A page a person actively shopping for this kind of tool would read while deciding.",
            "A page where the purchase decision is actually made or lost.",
        ],
    ),
}


def build(row: dict):
    state = {k: v for k, v in row.items() if k != "error"}
    return state, QUESTIONS


def main() -> None:
    rows = json.loads((HERE / "fold-extract.json").read_text())
    rows = [r for r in rows if "error" not in r]
    if "--limit" in sys.argv:
        rows = rows[: int(sys.argv[sys.argv.index("--limit") + 1])]

    client = JevClient()
    print(f"asking Jev about {len(rows)} routes ...")
    answers = client.ask_many(
        rows, build, workers=6,
        on_progress=lambda d, t: print(f"  {d}/{t}", end="\r", flush=True),
    )
    print()

    if answers:
        (HERE / "jev-raw-sample.json").write_text(json.dumps(answers[0], indent=2, ensure_ascii=False))

    out = []
    for row, resp in zip(rows, answers):
        a = resp["answers"]
        out.append({"url": row["url"], "headline": row["headline"], "raw": a})
    (HERE / "jev-fold-answers.json").write_text(json.dumps(out, indent=2, ensure_ascii=False))
    print(f"wrote jev-fold-answers.json ({len(out)} routes)")
    print("usage:", client.usage_line())
    print("\n--- shape of one answer set ---")
    print(json.dumps(answers[0]["answers"], indent=2, ensure_ascii=False)[:1500])


if __name__ == "__main__":
    main()
