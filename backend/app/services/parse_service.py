from __future__ import annotations

from dataclasses import dataclass
from statistics import median
from typing import List, Optional, Sequence, Tuple

import fitz  # PyMuPDF


@dataclass
class BlockInfo:
    page: int
    text: str
    bbox: Tuple[float, float, float, float]  # x0, y0, x1, y1 in PDF points
    font_size: float


@dataclass
class PageInfo:
    page_number: int  # 1-based
    width_pt: float
    height_pt: float
    rotation: int
    blocks: List[BlockInfo]


@dataclass
class CleanBlock:
    page: int
    text: str
    bbox: Tuple[float, float, float, float]
    font_size: float


@dataclass
class ChunkInfo:
    text: str
    chunk_index: int
    page_start: int
    page_end: int
    bboxes: List[dict]  # [{page, x, y, w, h}] normalized to [0,1]
    section_title: Optional[str]
    token_count: int


class ParseService:
    """Core PDF parsing, cleaning and chunking utilities.

    This class is intentionally stateless across calls, except that some helper
    methods compute global signals (e.g., header/footer texts) from a list of
    pages to support per-page cleaning heuristics.
    """

    HEADER_FOOTER_REGION_RATIO = 0.10  # top/bottom 10%
    HEADER_FOOTER_FREQ_THRESHOLD = 0.60  # appears in >60% pages

    TARGET_MIN_TOKENS = 150
    TARGET_MAX_TOKENS = 300
    OVERLAP_TOKENS = 50

    SENTENCE_DELIMS = "。！？；.!?"  # Chinese + English basic punctuation

    # -------------------------- Public API --------------------------
    def extract_pages(self, pdf_bytes: bytes) -> List[PageInfo]:
        """Use PyMuPDF to extract all pages with text blocks and geometries.

        Returns a list of PageInfo entries, one per page.
        """
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        try:
            pages: List[PageInfo] = []
            for pi, page in enumerate(doc, start=1):
                rect = page.rect
                rotation = int(page.rotation or 0)
                width_pt = float(rect.width)
                height_pt = float(rect.height)

                # Extract text as dictionary to access spans and sizes
                page_dict = page.get_text("dict")
                blocks: List[BlockInfo] = []
                for blk in page_dict.get("blocks", []):
                    if blk.get("type", 0) != 0:  # 0=text, 1=image, etc.
                        continue
                    lines = blk.get("lines", [])
                    if not lines:
                        continue

                    # Emit one BlockInfo per line for precise bbox granularity
                    for line_info in self._extract_line_blocks(pi, lines):
                        blocks.append(line_info)

                pages.append(
                    PageInfo(
                        page_number=pi,
                        width_pt=width_pt,
                        height_pt=height_pt,
                        rotation=rotation,
                        blocks=blocks,
                    )
                )

            return pages
        finally:
            # Always close the PDF document to free resources
            doc.close()

    def extract_pages_ocr(
        self, pdf_bytes: bytes, languages: str = "eng+chi_sim", dpi: int = 300
    ) -> List[PageInfo]:
        """Extract pages using Tesseract OCR via PyMuPDF.

        Same interface as extract_pages() but uses OCR for scanned PDFs.
        Requires Tesseract to be installed on the system.
        """
        import logging
        logger = logging.getLogger(__name__)
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        try:
            pages: List[PageInfo] = []
            for pi, page in enumerate(doc, start=1):
                try:
                    rect = page.rect
                    rotation = int(page.rotation or 0)
                    width_pt = float(rect.width)
                    height_pt = float(rect.height)

                    # Cap rendered image size at 20MP to prevent Tesseract crashes
                    page_w_px = width_pt * dpi / 72
                    page_h_px = height_pt * dpi / 72
                    max_pixels = 20_000_000
                    if page_w_px * page_h_px > max_pixels:
                        scale = (max_pixels / (page_w_px * page_h_px)) ** 0.5
                        effective_dpi = max(72, int(dpi * scale))
                        logger.info("Page %d too large (%.0fx%.0f px at %d DPI), reducing to %d DPI",
                                    pi, page_w_px, page_h_px, dpi, effective_dpi)
                    else:
                        effective_dpi = dpi

                    tp = page.get_textpage_ocr(language=languages, dpi=effective_dpi, full=True)
                    page_dict = page.get_text("dict", textpage=tp)
                    blocks: List[BlockInfo] = []
                    for blk in page_dict.get("blocks", []):
                        if blk.get("type", 0) != 0:
                            continue
                        lines = blk.get("lines", [])
                        if not lines:
                            continue
                        for line_info in self._extract_line_blocks(pi, lines):
                            blocks.append(line_info)

                    pages.append(
                        PageInfo(
                            page_number=pi,
                            width_pt=width_pt,
                            height_pt=height_pt,
                            rotation=rotation,
                            blocks=blocks,
                        )
                    )
                except Exception as e:
                    logger.warning("OCR failed on page %d: %s", pi, e)
                    # Skip this page but continue with the rest
                    continue
            return pages
        finally:
            doc.close()

    def detect_scanned(self, pages: Sequence[PageInfo]) -> bool:
        """Return True if the document appears to be scanned (no text layer).

        Heuristic: if >70% of pages have text length <50 chars, mark as scanned.
        """
        if not pages:
            return True
        low_text_pages = 0
        for p in pages:
            total_len = sum(len(b.text) for b in p.blocks)
            if total_len < 50:
                low_text_pages += 1
        return (low_text_pages / max(1, len(pages))) > 0.70

    def clean_text_blocks(
        self,
        blocks: Sequence[BlockInfo],
        page_width: float,
        page_height: float,
        header_texts: Optional[set[str]] = None,
        footer_texts: Optional[set[str]] = None,
    ) -> List[CleanBlock]:
        """Remove common header/footer texts and fix hyphenations.

        - Removes any block whose text matches a commonly repeated header/footer
          phrase that appears in the top/bottom 10% region across >60% pages.
        - Returns cleaned blocks with basic normalization.
        """
        header_texts = header_texts or set()
        footer_texts = footer_texts or set()
        top_cutoff = page_height * self.HEADER_FOOTER_REGION_RATIO
        bottom_cutoff = page_height * (1.0 - self.HEADER_FOOTER_REGION_RATIO)

        cleaned: List[CleanBlock] = []
        for b in blocks:
            x0, y0, x1, y1 = b.bbox
            is_top = y0 <= top_cutoff
            is_bottom = y1 >= bottom_cutoff
            text_norm = self._normalize_inline_text(b.text)

            if is_top and text_norm in header_texts:
                continue
            if is_bottom and text_norm in footer_texts:
                continue

            cleaned.append(CleanBlock(page=b.page, text=text_norm, bbox=b.bbox, font_size=b.font_size))

        return cleaned

    def chunk_document(self, pages: Sequence[PageInfo]) -> List[ChunkInfo]:
        """Produce ChunkInfo items with normalized bboxes and metadata.

        Steps:
        1) Identify repeated header/footer texts across pages
        2) Clean blocks per page (remove header/footer, fix hyphenations)
        3) Detect headings via font size threshold (size > median × 1.3)
        4) Split into sentence-level units, then assemble chunks sized 300–500 tokens
           with 50-token overlap
        5) Normalize bbox coordinates to [0,1] using page dims (top-left origin)
        """
        # 1) Header/footer detection
        header_texts, footer_texts = self._detect_header_footer_texts(pages)

        # 2) Clean and collect blocks, also gather font sizes for median
        all_clean_blocks: List[CleanBlock] = []
        page_dims: dict[int, Tuple[float, float]] = {}
        for p in pages:
            page_dims[p.page_number] = (p.width_pt, p.height_pt)
            cleaned = self.clean_text_blocks(
                p.blocks, p.width_pt, p.height_pt, header_texts=header_texts, footer_texts=footer_texts
            )
            # Keep display order roughly top-to-bottom, left-to-right
            cleaned.sort(key=lambda cb: (cb.bbox[1], cb.bbox[0]))
            all_clean_blocks.extend(cleaned)

        if not all_clean_blocks:
            return []

        font_sizes = [cb.font_size for cb in all_clean_blocks if cb.font_size > 0]
        median_size = median(font_sizes) if font_sizes else 12.0

        # 3) Determine headings and build content sentences
        current_section_title: Optional[str] = None
        # (text, page, bbox, section_title)
        sentences: List[tuple[str, int, Tuple[float, float, float, float], Optional[str]]] = []

        for cb in all_clean_blocks:
            if cb.font_size > (median_size * 1.3):
                # Heading: update current section title; do not include in content
                title = cb.text.strip()
                # Avoid overly long titles
                current_section_title = title[:200] if title else None
                continue

            # Treat each block as a paragraph, split it into sentences
            for sent in self._split_into_sentences(cb.text):
                st = sent.strip()
                if not st:
                    continue
                sentences.append((st, cb.page, cb.bbox, current_section_title))

        # 4) Assemble chunks by sentences with overlap
        chunks: List[ChunkInfo] = []
        if not sentences:
            return chunks

        # Build parallel token counts for each sentence
        sent_tokens = [self._estimate_tokens(t) for (t, _pg, _bb, _sec) in sentences]

        start_idx = 0
        chunk_index = 0

        while start_idx < len(sentences):
            token_sum = 0
            end_idx = start_idx

            # Expand until reaching the target range
            while end_idx < len(sentences) and token_sum < self.TARGET_MIN_TOKENS:
                token_sum += sent_tokens[end_idx]
                end_idx += 1

            # If we can still add more sentences without exceeding max, do so
            while end_idx < len(sentences) and (token_sum + sent_tokens[end_idx]) <= self.TARGET_MAX_TOKENS:
                token_sum += sent_tokens[end_idx]
                end_idx += 1

            # Fallback: ensure at least one sentence
            if end_idx == start_idx:
                end_idx = min(start_idx + 1, len(sentences))
                token_sum = sum(sent_tokens[start_idx:end_idx])

            # Aggregate text and bboxes
            sel = sentences[start_idx:end_idx]
            text = "".join([s for (s, _pg, _bb, _sec) in sel])
            pages_range = [pg for (_t, pg, _bb, _sec) in sel]
            page_start = min(pages_range) if pages_range else 1
            page_end = max(pages_range) if pages_range else page_start

            # Aggregate and normalize bboxes per sentence
            bbox_dicts: List[dict] = []
            for (_t, pg, bb, _sec) in sel:
                w, h = page_dims.get(pg, (1.0, 1.0))
                bbox_dicts.append(self._normalize_bbox(pg, bb, w, h))

            # Track section title for this chunk as the last known heading before start_idx
            # We approximate by scanning backwards to find the last heading block before start_idx
            # Since we do not store headings separately per position, we reuse last_known_title
            section_title = sel[0][3] if sel and sel[0][3] else None

            chunks.append(
                ChunkInfo(
                    text=text,
                    chunk_index=chunk_index,
                    page_start=page_start,
                    page_end=page_end,
                    bboxes=bbox_dicts,
                    section_title=section_title,
                    token_count=self._estimate_tokens(text),
                )
            )
            chunk_index += 1

            # Advance start index with overlap of 50 tokens
            # Compute how many sentences to step back to preserve ~50 tokens overlap
            overlap = self.OVERLAP_TOKENS
            # We want next window to start so that the tail has ~overlap tokens
            # Find k: sum of last k sentences' tokens >= overlap
            k = 0
            acc = 0
            j = end_idx - 1
            while j >= start_idx and acc < overlap:
                acc += sent_tokens[j]
                k += 1
                j -= 1
            next_start = max(end_idx - k, start_idx + 1)  # ensure progress

            start_idx = next_start

        # Post-process: remove micro-chunks that provide no retrieval value.
        # These arise from form fields, metadata footers, or single short lines.
        MIN_CHUNK_CHARS = 50
        filtered = []
        for c in chunks:
            if len(c.text.strip()) >= MIN_CHUNK_CHARS:
                filtered.append(c)
            elif filtered:
                # Merge micro-chunk text into previous chunk
                prev = filtered[-1]
                filtered[-1] = ChunkInfo(
                    text=prev.text + c.text,
                    chunk_index=prev.chunk_index,
                    page_start=prev.page_start,
                    page_end=max(prev.page_end, c.page_end),
                    bboxes=prev.bboxes + c.bboxes,
                    section_title=prev.section_title,
                    token_count=prev.token_count + c.token_count,
                )
            # else: first chunk is micro — skip it entirely (very rare)

        # Re-index chunk_index after filtering
        for i, c in enumerate(filtered):
            if c.chunk_index != i:
                filtered[i] = ChunkInfo(
                    text=c.text,
                    chunk_index=i,
                    page_start=c.page_start,
                    page_end=c.page_end,
                    bboxes=c.bboxes,
                    section_title=c.section_title,
                    token_count=c.token_count,
                )

        return filtered

    # -------------------------- Helpers --------------------------
    def _build_block_text_and_size(self, lines: Sequence[dict]) -> Tuple[str, float]:
        """Flatten spans into a paragraph text and estimate average font size.

        Also merges hyphenations at line breaks: if a line ends with '-' and the
        next line starts with a lowercase letter / alnum, drop the hyphen.
        """
        pieces: List[str] = []
        sizes: List[float] = []

        num_lines = len(lines)
        for i, line in enumerate(lines):
            spans = line.get("spans", [])
            line_text = "".join([s.get("text", "") for s in spans])
            for s in spans:
                sz = float(s.get("size")) if s.get("size") else None
                if sz:
                    sizes.append(sz)

            # Hyphenation fix across lines
            if i < (num_lines - 1) and line_text.rstrip().endswith("-"):
                next_line_spans = lines[i + 1].get("spans", [])
                next_text = "".join([s.get("text", "") for s in next_line_spans])
                if next_text and next_text[:1].isalnum():
                    # remove trailing hyphen
                    line_text = line_text.rstrip("-")
                    # no added space to merge words
                    pieces.append(line_text)
                    continue

            pieces.append(line_text + " ")  # space between lines

        text = "".join(pieces)
        text = self._normalize_inline_text(text)
        avg_size = (sum(sizes) / len(sizes)) if sizes else 12.0
        return text, avg_size

    def _extract_line_blocks(self, page: int, lines: Sequence[dict]) -> List[BlockInfo]:
        """Extract one BlockInfo per line from a PyMuPDF block's lines.

        This gives line-level bbox precision instead of block-level,
        resulting in much tighter highlight regions.
        """
        result: List[BlockInfo] = []
        num_lines = len(lines)
        for i, line in enumerate(lines):
            spans = line.get("spans", [])
            if not spans:
                continue

            line_bbox = line.get("bbox", None)
            if not line_bbox:
                continue

            line_text = "".join([s.get("text", "") for s in spans])
            sizes: List[float] = []
            for s in spans:
                sz = float(s.get("size")) if s.get("size") else None
                if sz:
                    sizes.append(sz)

            # Hyphenation fix across lines
            if i < (num_lines - 1) and line_text.rstrip().endswith("-"):
                next_line_spans = lines[i + 1].get("spans", [])
                next_text = "".join([s.get("text", "") for s in next_line_spans])
                if next_text and next_text[:1].isalnum():
                    line_text = line_text.rstrip("-")
                else:
                    line_text = line_text + " "
            else:
                line_text = line_text + " "

            text = self._normalize_inline_text(line_text)
            if not text:
                continue

            avg_size = (sum(sizes) / len(sizes)) if sizes else 12.0
            result.append(
                BlockInfo(
                    page=page,
                    text=text,
                    bbox=(float(line_bbox[0]), float(line_bbox[1]),
                          float(line_bbox[2]), float(line_bbox[3])),
                    font_size=avg_size,
                )
            )
        return result

    def _normalize_inline_text(self, text: str) -> str:
        # Collapse excessive whitespace but keep sentence punctuation
        # Replace non-breaking spaces etc.
        t = text.replace("\xa0", " ")
        # Collapse multiple spaces
        while "  " in t:
            t = t.replace("  ,", ",").replace("  .", ".").replace("  ", " ")
        return t.strip()

    def _split_into_sentences(self, text: str) -> List[str]:
        """Split text by common sentence boundaries while keeping delimiters."""
        if not text:
            return []
        sentences: List[str] = []
        buff: List[str] = []
        for ch in text:
            buff.append(ch)
            if ch in self.SENTENCE_DELIMS:
                sentences.append("".join(buff))
                buff = []
        if buff:
            sentences.append("".join(buff))
        return sentences

    def _estimate_tokens(self, text: str) -> int:
        # Heuristic: Chinese token ~ 2 chars; English token ~ 1 word
        if not text:
            return 0
        # If space density is low, likely Chinese
        space_ratio = text.count(" ") / max(1, len(text))
        if space_ratio < 0.05:
            return max(1, len(text) // 2)
        return max(1, len(text.split()))

    def _normalize_bbox(
        self,
        page: int,
        bbox: Tuple[float, float, float, float],
        width_pt: float,
        height_pt: float,
    ) -> dict:
        x0, y0, x1, y1 = bbox
        w = max(0.0, x1 - x0)
        h = max(0.0, y1 - y0)
        xn = (x0 / width_pt) if width_pt else 0.0
        yn = (y0 / height_pt) if height_pt else 0.0
        wn = (w / width_pt) if width_pt else 0.0
        hn = (h / height_pt) if height_pt else 0.0
        # Clamp to [0,1]
        def clamp(v: float) -> float:
            return 0.0 if v < 0.0 else (1.0 if v > 1.0 else v)

        return {
            "page": page,
            "x": clamp(xn),
            "y": clamp(yn),
            "w": clamp(wn),
            "h": clamp(hn),
        }

    def _detect_header_footer_texts(self, pages: Sequence[PageInfo]) -> tuple[set[str], set[str]]:
        """Find repeated texts in top/bottom 10% regions that appear on >60% pages."""
        if not pages or len(pages) < 3:
            # Need at least 3 pages for meaningful header/footer detection
            return set(), set()

        top_counts: dict[str, int] = {}
        bot_counts: dict[str, int] = {}
        total_pages = len(pages)
        for p in pages:
            top_cutoff = p.height_pt * self.HEADER_FOOTER_REGION_RATIO
            bottom_cutoff = p.height_pt * (1.0 - self.HEADER_FOOTER_REGION_RATIO)

            seen_top: set[str] = set()
            seen_bot: set[str] = set()
            for b in p.blocks:
                x0, y0, x1, y1 = b.bbox
                txt = self._normalize_inline_text(b.text)
                if not txt:
                    continue
                if y0 <= top_cutoff:
                    seen_top.add(txt)
                elif y1 >= bottom_cutoff:
                    seen_bot.add(txt)

            for t in seen_top:
                top_counts[t] = top_counts.get(t, 0) + 1
            for t in seen_bot:
                bot_counts[t] = bot_counts.get(t, 0) + 1

        header_texts = {t for t, c in top_counts.items() if (c / total_pages) > self.HEADER_FOOTER_FREQ_THRESHOLD}
        footer_texts = {t for t, c in bot_counts.items() if (c / total_pages) > self.HEADER_FOOTER_FREQ_THRESHOLD}
        return header_texts, footer_texts
