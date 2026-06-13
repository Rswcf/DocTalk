"""Phase 2: RefParserFSM threads the answer claim into citation focus.

When the streaming parser emits a citation, it should attach a `focus_snippet`
(the supporting sentence) derived from the answer text just written before the
`[n]` marker — so the UI can highlight that sentence, not the whole chunk.
"""
from __future__ import annotations

import sys
import uuid
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.chat_service import RefParserFSM, _ChunkInfo  # noqa: E402

CHUNK = (
    "The committee met in March. Fluency renders the translator invisible to "
    "the reader. Publishers reward transparent prose above all else. "
    "These trends accelerated after 1990."
)


def _chunk_map():
    return {
        1: _ChunkInfo(
            id=uuid.uuid4(),
            page_start=1,
            page_end=1,
            bboxes=[{"x": 0.1, "y": 0.1, "w": 0.5, "h": 0.05, "page": 1}],
            text=CHUNK,
        )
    }


def _citations(answer: str):
    fsm = RefParserFSM(_chunk_map())
    out = []
    for ev in fsm.feed(answer):
        if ev.get("event") == "citation":
            out.append(ev["data"])
    return out


class TestFocusWiring:
    def test_citation_gets_focus_snippet_from_claim(self):
        answer = "Fluency makes the translator invisible to the reader[1]."
        cites = _citations(answer)
        assert len(cites) == 1
        assert cites[0].get("focus_snippet") == (
            "Fluency renders the translator invisible to the reader."
        )

    def test_focus_snippet_is_verbatim_in_chunk(self):
        answer = "Publishers reward transparent prose, the analysis shows[1]."
        cites = _citations(answer)
        assert cites[0].get("focus_snippet") in CHUNK

    def test_ambiguous_or_empty_claim_no_focus(self):
        # A bare citation with no preceding claim text → no focus snippet,
        # caller keeps the whole-chunk highlight.
        cites = _citations("[1]")
        assert cites[0].get("focus_snippet") is None

    def test_second_citation_does_not_reuse_first_sentence(self):
        # Codex finding 2: each citation focuses its OWN current sentence, not
        # the leftover of the previous one in the rolling buffer.
        chunk = (
            "The committee met in March. Fluency renders the translator invisible "
            "to the reader. Publishers reward transparent prose above all else. "
            "These trends accelerated after 1990."
        )
        fsm = RefParserFSM({
            1: _ChunkInfo(
                id=uuid.uuid4(), page_start=1, page_end=1,
                bboxes=[{"x": 0.1, "y": 0.1, "w": 0.5, "h": 0.05, "page": 1}],
                text=chunk,
            )
        })
        answer = (
            "Fluency renders the translator invisible[1]. "
            "Publishers reward transparent prose[1]."
        )
        focuses = [ev["data"].get("focus_snippet")
                   for ev in fsm.feed(answer) if ev.get("event") == "citation"]
        assert focuses[0] == "Fluency renders the translator invisible to the reader."
        assert focuses[1] == "Publishers reward transparent prose above all else."
