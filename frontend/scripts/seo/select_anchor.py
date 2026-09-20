"""Select an anchor text from candidates with Jev ("select instead of generate").

Design: .collab/plans/2026-09-20-jev-seo-design.md §3.2 (J2 shape, small case).
Jev cannot write text, so the candidates are authored in code; Jev only ranks them
on two independent dimensions over the same state, in one request. The winner is
composed in code so the policy stays visible and changeable without re-running
inference.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from jev_client import JevClient, choice  # noqa: E402

OUT = Path(__file__).resolve().parent / "out"

CANDIDATES = {
    "Free Document Tools": "Names the page's own framing ('Free utilities', 'Document tools') and says they cost nothing.",
    "Document Tools": "Shortest accurate label; matches the page's H1 wording.",
    "Word Counter & Reading Time": "Names the two concrete utilities the page actually lists.",
    "Free Text Utilities": "Emphasises that the processing is text-only and browser-local.",
    "Quick Document Checks": "Describes the job the page is for rather than the artefacts on it.",
}

STATE = {
    "linked_page": {
        "url_path": "/tools",
        "title": "Document tools for quick checks before deeper AI analysis.",
        "eyebrow": "Free utilities",
        "lede": (
            "Count, estimate, and prepare text locally. When the work needs source-grounded "
            "answers, move the same document into AI chat."
        ),
        "section": "Available tools — Small utilities for repeated document prep work.",
        "tools_listed": ["Word counter", "Reading time estimator"],
        "processing": "Browser-only text processing",
    },
    "placement": {
        "where": "The 'Resources' column of the site-wide footer of an AI document-chat product.",
        "sibling_anchor_texts": [
            "Compare Tools",
            "Alternatives",
            "Blog",
            "Comparison Guides",
            "Multi-Format Support",
        ],
        "style": "Sibling anchors use Title Case.",
    },
}


def main() -> int:
    client = JevClient()
    resp = client.ask(
        STATE,
        {
            "most_accurate": choice(
                {
                    "question": (
                        "Which anchor text tells a reader most accurately what they will get if "
                        "they follow this link to `linked_page`?"
                    )
                },
                CANDIDATES,
            ),
            "most_confusable": choice(
                {
                    "question": (
                        "Which anchor text is MOST likely to be confused with the existing "
                        "'Compare Tools' link sitting in the same footer column "
                        "(`placement.sibling_anchor_texts`)?"
                    )
                },
                CANDIDATES,
            ),
        },
    )

    accurate = resp["answers"]["most_accurate"]
    confusable = resp["answers"]["most_confusable"]

    print("most_accurate:")
    for name, p in sorted(accurate["probabilities"].items(), key=lambda kv: -kv[1]):
        print(f"   {p:.2f}  {name}")
    print(f"  -> {accurate['choice']} (confidence {accurate['confidence']:.2f})")
    print("\nmost_confusable:")
    for name, p in sorted(confusable["probabilities"].items(), key=lambda kv: -kv[1]):
        print(f"   {p:.2f}  {name}")
    print(f"  -> {confusable['choice']} (confidence {confusable['confidence']:.2f})")

    # Policy, in code and therefore changeable without re-running inference:
    # take the most accurate anchor unless it is ALSO the one most likely to be
    # confused with its neighbour AND that confusion call is confident.
    winner = accurate["choice"]
    note = "most accurate candidate"
    if confusable["choice"] == winner and confusable["confidence"] >= 0.6:
        ranked = sorted(accurate["probabilities"].items(), key=lambda kv: -kv[1])
        winner = ranked[1][0]
        note = f"runner-up; top pick collided with 'Compare Tools' (conf {confusable['confidence']:.2f})"

    print(f"\nSELECTED: {winner}  ({note})")
    print(client.usage_line())

    OUT.mkdir(exist_ok=True)
    (OUT / "anchor_tools.json").write_text(
        json.dumps(
            {
                "selected": winner,
                "rationale": note,
                "most_accurate": accurate,
                "most_confusable": confusable,
                "candidates": CANDIDATES,
            },
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
