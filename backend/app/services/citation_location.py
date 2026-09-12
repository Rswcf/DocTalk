"""Conservative physical-page attribution shared by chat and extractions."""
from __future__ import annotations

import math
import re
from collections.abc import Mapping
from typing import Any


def citation_location(
    page_start: int,
    page_end: int,
    bboxes: list,
    *,
    source_text: str = "",
    focus: str = "",
    page_texts: Mapping[int, str] | None = None,
) -> dict[str, Any]:
    """Narrow only a source-verified focus uniquely found in complete page text.

    A missing/ambiguous match retains the entire chunk range. Box counts never
    establish which page supports an answer. Whitespace differences are harmless
    PDF extraction layout differences; punctuation and case must still match.
    """
    start = max(1, page_start)
    end = max(start, page_end or start)
    boxes = []
    for raw in bboxes or []:
        if not isinstance(raw, dict):
            continue
        if not all(
            isinstance(raw.get(k), (int, float))
            and not isinstance(raw[k], bool)
            and math.isfinite(raw[k])
            for k in ("x", "y", "w", "h")
        ):
            continue
        page = raw.get("page", start)
        if not isinstance(page, (int, float)) or isinstance(page, bool) or not math.isfinite(page):
            continue
        if int(page) != page or not start <= page <= end:
            continue
        boxes.append({**raw, "page": int(page)})
    boxes.sort(key=lambda bb: (bb["page"], bb["y"], bb["x"]))
    normalize = lambda text: re.sub(r"\s+", " ", text).strip()  # noqa: E731
    needle = normalize(focus)
    pages = page_texts or {}
    if (
        start < end
        and len(needle) >= 12
        and needle in normalize(source_text)
        and all(pages.get(p, "").strip() for p in range(start, end + 1))
    ):
        matches = [p for p in range(start, end + 1) if needle in normalize(pages[p])]
        if len(matches) == 1:
            start = end = matches[0]
            boxes = [bb for bb in boxes if bb["page"] == start]
    return {"page": start, "page_end": end, "bboxes": boxes}
