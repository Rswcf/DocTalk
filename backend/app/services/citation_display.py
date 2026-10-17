"""Read-only display projection for server-generated citation records.

Stored focus snippets are source-verified by the chat pipeline. Legacy records
may still pair them with a chunk-prefix excerpt. Project them on every mutable
read/export boundary; immutable published answer snapshots are deliberately not
rewritten. No section heading is presented as verbatim evidence.
"""
from __future__ import annotations

import re


def citation_display(citation: dict, *, source_text: str | None = None) -> dict:
    result = dict(citation)
    focus = result.get("focus_snippet")
    if not isinstance(focus, str):
        focus = ""
    if source_text is not None:
        normalized = lambda s: re.sub(r"\s+", " ", s).strip()  # noqa: E731
        if not normalized(focus) or normalized(focus) not in normalized(source_text):
            focus = ""
            result.pop("focus_snippet", None)
        result["text_snippet"] = (focus or source_text)[:100]
    elif focus.strip():
        # Do not reverify against context_text: it is truncated to 900 characters
        # and can omit a correctly verified focus from the end of a long chunk.
        result["text_snippet"] = focus[:100]
    else:
        context = result.get("context_text")
        if isinstance(context, str):
            # Chat context has a trusted page prefix followed by source text,
            # unlike legacy text_snippet which may prepend a section title.
            match = re.match(r"^\[page \d+(?:–\d+)?\] (.*)$", context, re.DOTALL)
            if match:
                result["text_snippet"] = match.group(1)[:100]
    return result


def display_citations(citations: list | None) -> list | None:
    if not isinstance(citations, list):
        return citations
    return [citation_display(c) if isinstance(c, dict) else c for c in citations]
