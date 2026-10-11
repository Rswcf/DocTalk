from __future__ import annotations

import logging
import math
import os
import re
import subprocess
import tempfile
import unicodedata
from collections import Counter
from dataclasses import dataclass
from statistics import median
from typing import Any, List, Optional, Sequence, Tuple

import fitz  # PyMuPDF

logger = logging.getLogger(__name__)

# Parse pipeline version — bump when parse/OCR logic changes materially so the backfill
# finder can tell which documents predate a fix (R2b). v2 = Unicode-aware quality OCR
# trigger + OSD-narrowed OCR language set. v3 = off-axis text is never a heading, and
# off-axis text or an arXiv stamp in the page margin is dropped from chunks (vertical
# writing mode excepted). v5 = the heading size rule compares a line with its page's body
# size (from paragraph runs of running text) and the document's median line, instead of
# with that median alone, which chart labels and table cells pull under the body; a line
# in a run of 4+ same-size lines (unless twice the body size), or one made mostly of
# figures, is never a heading by size.
PARSE_PIPELINE_VERSION = 5

# A line that starts with an arXiv identifier is a submission stamp or a wrapped
# reference, never a section title; inside the page margin band it is the stamp and is
# dropped. Backs up the geometric off-axis rule for a stamp whose line direction was
# lost (e.g. OCR output).
_ARXIV_ID_LINE_RE = re.compile(
    r"^arXiv:\s*(?:\d{4}\.\d{4,5}|[A-Za-z][A-Za-z\-]*(?:\.[A-Z]{2})?/\d{7})(?:v\d+)?\b"
)

# A line that is only a web address or an e-mail address is never a heading by size.
_BARE_ADDRESS_RE = re.compile(r"^(?:(?:https?://|www\.)\S+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+)$", re.IGNORECASE)

# OCR language resolution (Phase 2 C4 + R2b). Scanned / non-Latin PDFs need the matching
# Tesseract traineddata; eng+chi_sim alone produced garbage for Urdu/Arabic (U13/U40).
# The Dockerfile installs the packs for every code below.
_LOCALE_TESSERACT = {
    "en": "eng", "zh": "chi_sim", "ja": "jpn", "ko": "kor", "es": "spa",
    "de": "deu", "fr": "fra", "pt": "por", "it": "ita", "ar": "ara", "hi": "hin",
    "ur": "urd",
}

# Tesseract OSD script name -> ordered candidate traineddata for that script family.
# Kept TIGHT: extra languages make Tesseract hallucinate cross-script glyphs and run
# ~13× slower (validated on U13: urd=0.99/9s vs the 13-lang set=mixed-script/120s).
_SCRIPT_FAMILY_ORDERED = {
    "Arabic": ["ara", "urd", "fas"],
    "Han": ["chi_sim", "chi_tra"],
    "Japanese": ["jpn"],
    "Hangul": ["kor"],
    "Devanagari": ["hin"],
    "Cyrillic": ["rus"],
    "Latin": ["eng", "spa", "deu", "fra", "por", "ita"],
    "Greek": ["ell"],
    "Hebrew": ["heb"],
}


def _installed_ocr_langs() -> list[str]:
    """Installed Tesseract traineddata codes, from settings.OCR_LANGUAGES (the allowlist)."""
    try:
        from app.core.config import settings
        codes = [c.strip() for c in (getattr(settings, "OCR_LANGUAGES", "") or "").split("+") if c.strip()]
    except Exception:
        codes = []
    return codes or ["eng"]


def resolve_ocr_languages(locale: str | None = None, script: str | None = None) -> str:
    """Narrow Tesseract language string for OCR.

    `script` (from content-based OSD, see detect_script_osd) is PRIMARY; `locale`
    disambiguates within a script family (Arabic→ar/ur/fa, Han→zh-simp/trad) or selects the
    Latin language. Falls back to locale-only, then the full installed set. Always filtered
    to installed traineddata and capped to ≤3 languages to avoid cross-script hallucination.
    """
    installed = _installed_ocr_langs()
    loc = (locale or "").split("-")[0].split("_")[0].lower()
    locale_lang = _LOCALE_TESSERACT.get(loc) if loc else None
    chosen: list[str] = []

    if script == "Latin":
        # Latin-script languages are mutually intelligible enough to Tesseract that adding
        # siblings only adds noise — use just the locale's language (or eng).
        chosen = [locale_lang if (locale_lang and locale_lang in installed) else "eng"]
    elif script and script in _SCRIPT_FAMILY_ORDERED:
        fam = [c for c in _SCRIPT_FAMILY_ORDERED[script] if c in installed]
        if locale_lang and locale_lang in fam:
            fam = [locale_lang] + [c for c in fam if c != locale_lang]
        # NO eng for non-Latin scripts: adding eng makes Tesseract interleave spurious Latin
        # glyphs into Arabic/CJK/Devanagari output (validated on U13: urd=0.99 clean vs
        # ara+urd+eng=0.60–0.77 with 16–39% Latin noise). Western digits are handled by the
        # script's own model. Keep the set to the script family alone.
        chosen = fam[:2]
    elif locale_lang and locale_lang in installed:
        chosen = [locale_lang]

    chosen = [c for c in chosen if c in installed]
    if not chosen:
        # No script (OSD failed) and no usable locale. Do NOT return the full installed set —
        # the kitchen-sink set makes Tesseract hallucinate cross-script glyphs (the exact U13
        # failure). Fall back to eng alone: correct for Latin docs, and for a non-Latin doc it
        # yields low-quality output that the worker's adopt-only-if-better guard rejects
        # (keeping the existing text layer) rather than committing mixed-script garbage.
        return "eng" if "eng" in installed else (installed[0] if installed else "eng")
    return "+".join(chosen[:3])


_OSD_MAX_PIXELS = 20_000_000  # cap rendered image (same as extract_pages_ocr) to avoid OOM
_OSD_MIN_CONFIDENCE = 1.0      # Tesseract OSD confidence floor; below this the guess is noise


def detect_script_osd(pdf_bytes: bytes, *, sample_pages: int = 3, dpi: int = 150) -> str | None:
    """Detect a PDF's dominant script via Tesseract OSD (`--psm 0`) — content-based and
    locale-independent. Renders up to `sample_pages` pages to PNG (pixel-capped) and votes on
    the detected script, requiring a minimum confidence. Returns a Tesseract script name
    ('Arabic', 'Han', 'Latin', ...) or None when no page yields a confident detection.
    """
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except (RuntimeError, ValueError, OSError) as e:
        logger.debug("OSD could not open PDF: %s", e)
        return None
    try:
        votes: Counter = Counter()
        for pi in range(min(sample_pages, doc.page_count)):
            png = None
            try:
                page = doc[pi]
                # Cap rendered pixels (huge pages can OOM the worker before the timeout helps).
                eff_dpi = dpi
                w_px = page.rect.width * dpi / 72
                h_px = page.rect.height * dpi / 72
                if w_px * h_px > _OSD_MAX_PIXELS:
                    eff_dpi = max(36, int(dpi * (_OSD_MAX_PIXELS / (w_px * h_px)) ** 0.5))
                pix = page.get_pixmap(dpi=eff_dpi)
                with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tf:
                    png = tf.name
                pix.save(png)
                out = subprocess.run(
                    ["tesseract", png, "-", "--psm", "0"],
                    capture_output=True, text=True, timeout=30,
                )
                m = re.search(r"^Script:\s*(\S+)", out.stdout, re.M)
                conf = re.search(r"^Script confidence:\s*([\d.]+)", out.stdout, re.M)
                if m and conf and float(conf.group(1)) >= _OSD_MIN_CONFIDENCE:
                    votes[m.group(1)] += 1
            except (subprocess.SubprocessError, OSError, RuntimeError, ValueError, MemoryError) as e:
                # Narrow catch (not bare Exception) so a Celery SoftTimeLimitExceeded — which
                # subclasses Exception — propagates to the worker instead of being swallowed.
                logger.debug("OSD failed on page %d: %s", pi, e)
            finally:
                if png:
                    try:
                        os.unlink(png)
                    except OSError:
                        pass
        return votes.most_common(1)[0][0] if votes else None
    finally:
        doc.close()


def text_quality_score(pages: Sequence["PageInfo"]) -> float:
    """Fraction of non-whitespace chars in Unicode Letter/Number/Mark categories.

    Script-agnostic — CJK, Arabic, Devanagari, and Latin diacritics all count as good, so
    diacritic-heavy languages (Czech č/ř/ž) are NOT penalised. Low for broken-font mojibake
    (symbol/control soup). Returns 1.0 for empty text (emptiness is detect_scanned's job).
    """
    good = total = 0
    for p in pages:
        for b in p.blocks:
            for c in b.text:
                if c.isspace():
                    continue
                total += 1
                if c == "�":
                    continue
                if unicodedata.category(c)[0] in ("L", "N", "M"):
                    good += 1
    return good / total if total else 1.0


def _avg_token_len(pages: Sequence["PageInfo"]) -> float:
    n = chars = 0
    for p in pages:
        for b in p.blocks:
            for t in b.text.split():
                n += 1
                chars += len(t)
    return chars / n if n else 0.0


def _bad_char_ratio(pages: Sequence["PageInfo"]) -> float:
    """Fraction of non-whitespace chars that are replacement/control/PUA/symbol — high in
    mojibake. Latin-Extended *letters* (diacritics) are NOT counted, so diacritic languages
    are not penalised."""
    bad = total = 0
    for p in pages:
        for b in p.blocks:
            for c in b.text:
                if c.isspace():
                    continue
                total += 1
                cp = ord(c)
                if c == "�" or unicodedata.category(c)[0] in ("C", "S") or 0xE000 <= cp <= 0xF8FF:
                    bad += 1
    return bad / total if total else 0.0


def detect_low_quality_text(
    pages: Sequence["PageInfo"], *, file_type: str = "pdf"
) -> tuple[bool, float]:
    """Two-tier, PDF-scoped detector for a present-but-garbled (broken-font) text layer that
    detect_scanned() misses (it only checks for *absence* of text). Returns
    (needs_ocr, quality_score). Calibrated in-prod: U13 garbage lnm=0.56 vs good docs ≥0.94.
    """
    q = text_quality_score(pages)
    if file_type != "pdf":
        return False, q  # only PDFs have broken-font layers and are OCR-able via fitz
    if q >= 0.75:
        return False, q  # clearly good (good docs ≥0.94 — wide margin)
    if q < 0.50:
        return True, q   # clear garbage incl. no-space U+FFFD/PUA runs (CJK-safe: good CJK ≥0.9)
    # ambiguous 0.50–0.75: require a second, script-robust garbage signal
    return (_bad_char_ratio(pages) > 0.30 or _avg_token_len(pages) < 4.0), q


@dataclass
class BlockInfo:
    page: int
    text: str
    bbox: Tuple[float, float, float, float]  # x0, y0, x1, y1 in PDF points
    font_size: float
    # PyMuPDF line "dir" (cos, sin) in unrotated page space; (1, 0) = left-to-right.
    # Non-PDF extractors never set it, so their blocks always run with the page.
    direction: Tuple[float, float] = (1.0, 0.0)
    # PyMuPDF line "wmode" == 1: the font itself is in vertical writing mode
    # (tategaki), so the line is body text, never a rotated margin stamp.
    vertical_writing: bool = False
    # Size of the span size that carries the most characters on the line (0.0 =
    # unknown: use font_size). font_size is the plain mean over spans, so a 10pt line
    # with a 6pt superscript reads 8pt there and 10pt here. Read by the heading
    # classifier only; element metadata keeps font_size.
    dominant_size: float = 0.0
    # A section title a DOCX/PPTX/XLSX/TXT/MD/URL extractor reported (parse_worker).
    # The PDF shape guards (digits, bare addresses) do not apply to it: a Markdown
    # "## v2.0.0 (2024-05-01)" is a title, not a chart callout.
    extractor_title: bool = False


@dataclass
class PageInfo:
    page_number: int  # 1-based
    width_pt: float
    height_pt: float
    rotation: int
    blocks: List[BlockInfo]
    # Raw linear text (PyMuPDF page.get_text("text")), captured on the SAME
    # open page as the block extraction below — no second document open.
    # Forward-only PDF page-text persistence (M2, plan §8.1/§9): this is what
    # the parse worker feeds into Page.content for the verification substrate.
    # Non-PDF callers (parse_worker's extractor branch) leave this at "" and
    # populate Page.content from their own extracted text instead.
    raw_text: str = ""


@dataclass
class CleanBlock:
    page: int
    text: str
    bbox: Tuple[float, float, float, float]
    font_size: float
    # Runs against the page's dominant direction (rotated label, vertical stamp).
    off_axis: bool = False
    # Size the heading size rule compares: BlockInfo.dominant_size when known, else
    # font_size (0.0 on a CleanBlock built directly = use font_size).
    rule_size: float = 0.0
    # Lines in this line's paragraph run (same-size neighbours in the same column
    # within one line height, see _annotate_runs). 1 = isolated.
    run_len: int = 1
    # Which run on its page the line belongs to (-1 = none: off-axis).
    run_id: int = -1
    # Set once by _prepare_blocks, so chunk_document and extract_elements agree.
    is_heading: bool = False
    extractor_title: bool = False  # see BlockInfo.extractor_title


@dataclass
class ChunkInfo:
    text: str
    chunk_index: int
    page_start: int
    page_end: int
    bboxes: List[dict]  # [{page, x, y, w, h}] normalized to [0,1]
    section_title: Optional[str]
    token_count: int


@dataclass
class ElementInfo:
    element_type: str
    page_start: int
    page_end: int
    bbox: dict[str, Any]
    text: str
    reading_order: int
    metadata_json: dict[str, Any]


class ParseService:
    """Core PDF parsing, cleaning and chunking utilities.

    This class is intentionally stateless across calls, except that some helper
    methods compute global signals (e.g., header/footer texts) from a list of
    pages to support per-page cleaning heuristics.
    """

    HEADER_FOOTER_REGION_RATIO = 0.10  # top/bottom 10%
    HEADER_FOOTER_FREQ_THRESHOLD = 0.60  # appears in >60% pages
    # Off-axis text (see _is_off_axis) lying wholly in the outer 10% of the page is a
    # margin artifact such as the vertical arXiv stamp, not document content.
    MARGIN_BAND_RATIO = 0.10
    OFF_AXIS_TOLERANCE_DEG = 15.0

    # Heading size rule (v5, .collab/plans/2026-10-11-parse-heading-body-size.md):
    # a line is a heading by size when it is larger than HEADING_SIZE_FACTOR x its
    # page's body size. The body size comes from running text: on-axis lines in a
    # paragraph run that span at least REF_MIN_LINE_EXTENT of the page, so chart
    # labels, axis ticks and table cells never set it.
    HEADING_SIZE_FACTOR = 1.25
    HEADING_MAX_WRAP_LINES = 3  # a run longer than this is a paragraph, not a wrapped heading
    HEADING_DISPLAY_FACTOR = 2.0  # ...unless it is this much larger than the page body (a cover title)
    RUN_GAP_LINE_HEIGHTS = 1.0  # the next line of a run starts within one line height
    RUN_MIN_OVERLAP = 0.30  # of the narrower line's extent across the column
    RUN_ACTIVE_CAP = 400  # earlier lines a sweep step compares against, at most
    REF_MIN_LINE_EXTENT = 0.20
    REF_MIN_PAGE_CHARS = 200  # less running text than this: the page takes the document's size
    REF_SUBSTANTIAL_SHARE = 0.30  # the largest size with this share of a page's running text
    REF_DOC_PAGE_SHARE = 0.25  # the largest page size held by this share of pages

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

                # Raw linear text on the SAME open page (no second document
                # open) — feeds Page.content forward-only (plan §8.1/§9).
                raw_text = page.get_text("text")

                pages.append(
                    PageInfo(
                        page_number=pi,
                        width_pt=width_pt,
                        height_pt=height_pt,
                        rotation=rotation,
                        blocks=blocks,
                        raw_text=raw_text,
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

                    # Raw OCR'd linear text on the SAME textpage used for the
                    # block dict above — feeds Page.content when OCR is adopted.
                    raw_text = page.get_text("text", textpage=tp)

                    pages.append(
                        PageInfo(
                            page_number=pi,
                            width_pt=width_pt,
                            height_pt=height_pt,
                            rotation=rotation,
                            blocks=blocks,
                            raw_text=raw_text,
                        )
                    )
                except (RuntimeError, ValueError, OSError, MemoryError) as e:
                    # Narrow catch (not bare Exception) so a Celery SoftTimeLimitExceeded —
                    # an Exception subclass — propagates to the worker and the task honours its
                    # soft time limit instead of silently skipping pages and running on.
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
        rotation: int = 0,
        fallback_angle: float = 0.0,
    ) -> List[CleanBlock]:
        """Remove common header/footer texts and fix hyphenations.

        - Removes any block whose text matches a commonly repeated header/footer
          phrase that appears in the top/bottom 10% region across >60% pages.
        - Removes off-axis text lying wholly in the page margin band (margin stamps)
          and marks the remaining off-axis blocks so they are never headings.
          `fallback_angle` is the direction for a page with no text outside the
          band (see _document_line_angle).
        - Returns cleaned blocks with basic normalization.
        """
        header_texts = header_texts or set()
        footer_texts = footer_texts or set()
        top_cutoff = page_height * self.HEADER_FOOTER_REGION_RATIO
        bottom_cutoff = page_height * (1.0 - self.HEADER_FOOTER_REGION_RATIO)
        band_w, band_h = self._band_dims(page_width, page_height, rotation)
        dominant_angle = self._dominant_line_angle(blocks, band_w, band_h, fallback_angle)

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
            off_axis = self._is_off_axis(b.direction, dominant_angle)
            if (
                not b.vertical_writing
                and self._in_margin_band(b.bbox, band_w, band_h)
                and (off_axis or _ARXIV_ID_LINE_RE.match(text_norm))
            ):
                continue

            cleaned.append(
                CleanBlock(
                    page=b.page,
                    text=text_norm,
                    bbox=b.bbox,
                    font_size=b.font_size,
                    off_axis=off_axis,
                    rule_size=b.dominant_size if b.dominant_size > 0 else b.font_size,
                    extractor_title=b.extractor_title,
                )
            )

        return cleaned

    def chunk_document(self, pages: Sequence[PageInfo]) -> List[ChunkInfo]:
        """Produce ChunkInfo items with normalized bboxes and metadata.

        Steps:
        1) Clean, order and classify every line (_prepare_blocks: header/footer and
           margin removal, reading order, headings by the page-level size rule)
        2) Split the non-heading lines into sentence-level units, then assemble
           chunks sized 150–300 tokens with 50-token overlap
        3) Normalize bbox coordinates to [0,1] using page dims (top-left origin)
        """
        page_dims: dict[int, Tuple[float, float]] = {p.page_number: (p.width_pt, p.height_pt) for p in pages}
        all_clean_blocks = self._prepare_blocks(pages)
        if not all_clean_blocks:
            return []

        current_section_title: Optional[str] = None
        # (text, page, bbox, section_title)
        sentences: List[tuple[str, int, Tuple[float, float, float, float], Optional[str]]] = []

        for cb in all_clean_blocks:
            if cb.is_heading:
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
            text = self._join_text_units([s for (s, _pg, _bb, _sec) in sel])
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
        filtered: List[ChunkInfo] = []
        pending_micro: List[ChunkInfo] = []
        for c in chunks:
            if len(c.text.strip()) >= MIN_CHUNK_CHARS:
                if pending_micro:
                    prefix = pending_micro[0]
                    for micro in pending_micro[1:]:
                        prefix = self._merge_adjacent_chunks(prefix, micro)
                    c = self._merge_adjacent_chunks(prefix, c)
                    pending_micro = []
                filtered.append(c)
            elif filtered:
                # Merge micro-chunk text into previous chunk
                prev = filtered[-1]
                filtered[-1] = self._merge_adjacent_chunks(prev, c)
            else:
                pending_micro.append(c)

        if pending_micro and not filtered:
            # Short documents still need a searchable chunk; do not filter the
            # whole document down to nothing.
            combined = pending_micro[0]
            for micro in pending_micro[1:]:
                combined = self._merge_adjacent_chunks(combined, micro)
            filtered.append(combined)

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

    def extract_elements(self, pages: Sequence[PageInfo]) -> List[ElementInfo]:
        """Build a canonical reading-order element stream from parsed pages.

        Chunks remain the citation anchor for existing RAG. Elements are a
        higher-level document model used by summary, extraction, diff, and
        table-aware retrieval so those workflows do not have to infer document
        structure from arbitrary chunk windows.
        """
        page_dims: dict[int, Tuple[float, float]] = {p.page_number: (p.width_pt, p.height_pt) for p in pages}
        all_clean_blocks = self._prepare_blocks(pages)
        if not all_clean_blocks:
            return []

        elements: List[ElementInfo] = []
        current_section_title: Optional[str] = None
        current_heading_order: Optional[int] = None
        page_block_orders: dict[int, int] = {}
        for block in all_clean_blocks:
            text = block.text.strip().replace("\x00", "")
            if not text:
                continue
            page_block_order = page_block_orders.get(block.page, 0)
            page_block_orders[block.page] = page_block_order + 1
            reading_order = block.page * 10000 + page_block_order
            page_width, page_height = page_dims.get(block.page, (1.0, 1.0))
            bbox = self._normalize_bbox(block.page, block.bbox, page_width, page_height)
            is_heading = block.is_heading
            metadata: dict[str, Any] = {
                "font_size": round(float(block.font_size or 0.0), 2),
            }
            if is_heading:
                element_type = "heading"
                current_section_title = text[:200]
                current_heading_order = reading_order
            else:
                element_type = "paragraph"
                if current_section_title:
                    metadata["section_title"] = current_section_title
                if current_heading_order is not None:
                    metadata["parent_reading_order"] = current_heading_order

            elements.append(
                ElementInfo(
                    element_type=element_type,
                    page_start=block.page,
                    page_end=block.page,
                    bbox=bbox,
                    text=text,
                    reading_order=reading_order,
                    metadata_json=metadata,
                )
            )

        return elements

    # -------------------------- Helpers --------------------------
    def _order_blocks_for_reading(
        self,
        blocks: Sequence[CleanBlock],
        page_width: float,
        page_height: float,
    ) -> List[CleanBlock]:
        """Return blocks in reading order, including simple two-column layouts."""
        if len(blocks) < 6 or page_width <= 0:
            return sorted(blocks, key=lambda cb: (cb.bbox[1], cb.bbox[0]))

        full_width: List[CleanBlock] = []
        column_candidates: List[CleanBlock] = []
        for block in blocks:
            x0, _y0, x1, _y1 = block.bbox
            width_ratio = max(0.0, x1 - x0) / page_width
            crosses_center = x0 < page_width * 0.42 and x1 > page_width * 0.58
            if width_ratio >= 0.62 or crosses_center:
                full_width.append(block)
            else:
                column_candidates.append(block)

        if len(column_candidates) < 6:
            return sorted(blocks, key=lambda cb: (cb.bbox[1], cb.bbox[0]))

        centers = sorted((cb.bbox[0] + cb.bbox[2]) / 2 for cb in column_candidates)
        gaps = [
            (centers[i + 1] - centers[i], i)
            for i in range(len(centers) - 1)
        ]
        max_gap, split_idx = max(gaps, default=(0.0, 0), key=lambda item: item[0])
        if max_gap < page_width * 0.16:
            return sorted(blocks, key=lambda cb: (cb.bbox[1], cb.bbox[0]))

        split_x = (centers[split_idx] + centers[split_idx + 1]) / 2
        left = [cb for cb in column_candidates if ((cb.bbox[0] + cb.bbox[2]) / 2) <= split_x]
        right = [cb for cb in column_candidates if ((cb.bbox[0] + cb.bbox[2]) / 2) > split_x]
        if len(left) < 2 or len(right) < 2:
            return sorted(blocks, key=lambda cb: (cb.bbox[1], cb.bbox[0]))

        def order_column_band(band: Sequence[CleanBlock]) -> List[CleanBlock]:
            band_left = [cb for cb in band if ((cb.bbox[0] + cb.bbox[2]) / 2) <= split_x]
            band_right = [cb for cb in band if ((cb.bbox[0] + cb.bbox[2]) / 2) > split_x]
            if band_left and band_right:
                return (
                    sorted(band_left, key=lambda cb: (cb.bbox[1], cb.bbox[0]))
                    + sorted(band_right, key=lambda cb: (cb.bbox[1], cb.bbox[0]))
                )
            return sorted(band, key=lambda cb: (cb.bbox[1], cb.bbox[0]))

        result: List[CleanBlock] = []
        current_cut_y = float("-inf")
        sorted_full = sorted(full_width, key=lambda cb: (cb.bbox[1], cb.bbox[0]))
        for full_block in sorted_full:
            band = [
                cb
                for cb in column_candidates
                if current_cut_y <= cb.bbox[1] < full_block.bbox[1]
            ]
            result.extend(order_column_band(band))
            result.append(full_block)
            current_cut_y = max(current_cut_y, full_block.bbox[1])

        trailing_band = [cb for cb in column_candidates if cb.bbox[1] >= current_cut_y]
        result.extend(order_column_band(trailing_band))
        return result

    def _prepare_blocks(self, pages: Sequence[PageInfo]) -> List[CleanBlock]:
        """Clean, order and classify every line once.

        chunk_document and extract_elements both consume this list, so a line is a
        heading in one iff it is a heading in the other.
        """
        header_texts, footer_texts = self._detect_header_footer_texts(pages)
        document_angle = self._document_line_angle(pages)

        per_page: List[Tuple[PageInfo, bool, List[CleanBlock]]] = []
        for p in pages:
            cleaned = self.clean_text_blocks(
                p.blocks,
                p.width_pt,
                p.height_pt,
                header_texts=header_texts,
                footer_texts=footer_texts,
                rotation=p.rotation,
                fallback_angle=document_angle,
            )
            if not cleaned:
                continue
            band_w, band_h = self._band_dims(p.width_pt, p.height_pt, p.rotation)
            # Same page direction clean_text_blocks used to mark off-axis lines.
            angle = self._dominant_line_angle(p.blocks, band_w, band_h, document_angle)
            vertical = int(angle) % 180 == 90
            self._annotate_runs(cleaned, vertical=vertical)
            per_page.append((p, vertical, self._order_blocks_for_reading(cleaned, p.width_pt, p.height_pt)))

        references, floors = self._reference_sizes(per_page)
        out: List[CleanBlock] = []
        for p, _vertical, ordered in per_page:
            for cb in ordered:
                cb.is_heading = self._is_heading_block(cb, references[p.page_number], floors)
                out.append(cb)
        return out

    @staticmethod
    def _same_size(a: float, b: float) -> bool:
        """One size class: within 8% (at least 0.35pt). Wide against the 25% heading
        factor, tight against a 9pt caption beside 10pt body."""
        return abs(a - b) <= max(0.35, 0.08 * max(a, b))

    @staticmethod
    def _rule_size(block: CleanBlock) -> float:
        return block.rule_size if block.rule_size > 0 else block.font_size

    def _annotate_runs(self, blocks: Sequence[CleanBlock], vertical: bool = False) -> None:
        """Set CleanBlock.run_len, the number of lines in each line's paragraph run.

        Two on-axis lines are neighbours when they are the same size class, overlap
        across the reading direction by RUN_MIN_OVERLAP of the narrower one (same
        column), and the lower one starts below the upper one's middle and within
        RUN_GAP_LINE_HEIGHTS of its end. A run is a connected component of that
        relation. Lines stack along y, or along x on a vertical page. One sweep per
        size group in stacking order keeps only the earlier lines still within reach,
        so the cost is O(n log n + n*k), k = lines of the group within one line
        height (one table row).
        """
        # (stack lo, stack hi, across lo, across hi) per line
        ext = [
            (b.bbox[0], b.bbox[2], b.bbox[1], b.bbox[3]) if vertical else (b.bbox[1], b.bbox[3], b.bbox[0], b.bbox[2])
            for b in blocks
        ]
        on_axis = [i for i, b in enumerate(blocks) if not b.off_axis]
        parent = list(range(len(blocks)))

        def find(i: int) -> int:
            while parent[i] != i:
                parent[i] = parent[parent[i]]
                i = parent[i]
            return i

        # Neighbours are the same size, so each chain of sizes no more than one
        # tolerance apart is swept on its own (every same-size pair falls in one
        # chain): a 72pt watermark cannot widen the reach of a page of 4pt cells.
        size_of = [self._rule_size(b) for b in blocks]
        by_size = sorted(on_axis, key=lambda k: size_of[k])
        groups: List[List[int]] = []
        for k in by_size:
            if groups and self._same_size(size_of[groups[-1][-1]], size_of[k]):
                groups[-1].append(k)
            else:
                groups.append([k])

        gap = self.RUN_GAP_LINE_HEIGHTS
        min_overlap = self.RUN_MIN_OVERLAP
        for group in groups:
            if len(group) < 2:
                continue
            reach = gap * max(ext[i][1] - ext[i][0] for i in group)
            active: List[int] = []
            for i in sorted(group, key=lambda k: (ext[k][0], ext[k][2])):
                lo, hi, a0, a1 = ext[i]
                h = hi - lo
                width = a1 - a0
                reachable: List[int] = []
                for j in active:
                    jlo, jhi, ja0, ja1 = ext[j]
                    if lo - jhi > reach:
                        continue  # lines are visited in stacking order: out of reach for good
                    reachable.append(j)
                    # Cheapest test first: in a table most earlier lines are other columns.
                    overlap = (a1 if a1 < ja1 else ja1) - (a0 if a0 > ja0 else ja0)
                    jwidth = ja1 - ja0
                    if overlap <= 0 or overlap < min_overlap * (width if width < jwidth else jwidth):
                        continue
                    jh = jhi - jlo
                    if lo - jhi > gap * (h if h > jh else jh):
                        continue
                    if lo < jlo + 0.5 * jh:
                        continue  # beside j (a cell in the same table row), not below it
                    if not self._same_size(size_of[i], size_of[j]):
                        continue
                    root_i, root_j = find(i), find(j)
                    if root_i != root_j:
                        parent[root_i] = root_j
                reachable.append(i)
                active = reachable[-self.RUN_ACTIVE_CAP:]

        roots = {i: find(i) for i in on_axis}
        sizes = Counter(roots.values())
        for i in on_axis:
            blocks[i].run_len = sizes[roots[i]]
            blocks[i].run_id = roots[i]

    def _cluster_sizes(self, weights: dict[float, float]) -> List[Tuple[float, float]]:
        """Group sizes into same-size classes: [(weighted mean size, weight)], ascending."""
        clusters: List[Tuple[float, float]] = []
        start: Optional[float] = None
        acc_w = acc_sw = 0.0
        for size, w in sorted(weights.items()):
            if start is not None and not self._same_size(start, size):
                clusters.append((acc_sw / acc_w, acc_w))
                start, acc_w, acc_sw = None, 0.0, 0.0
            if start is None:
                start = size
            acc_w += w
            acc_sw += size * w
        if start is not None and acc_w:
            clusters.append((acc_sw / acc_w, acc_w))
        return clusters

    def _running_text_chars(
        self,
        blocks: Sequence[CleanBlock],
        vertical: bool,
        band_w: float,
        band_h: float,
        body_sizes: Sequence[float] = (),
    ) -> dict[float, float]:
        """Characters of running text per size on one page: the lines of runs with at
        least two lines that span REF_MIN_LINE_EXTENT of the page along the line (one
        wide line over a short axis tick is a chart subtitle, not a paragraph).

        A run of at most HEADING_MAX_WRAP_LINES lines counts only when the page has
        another such run of its size, or its size is one of `body_sizes` (other
        pages' body sizes). Alone it is shaped like a wrapped heading (a two-line
        slide or cover title), and as the page's largest substantial size it would
        become the reference it has to exceed.
        """
        page_extent = band_h if vertical else band_w
        runs: dict[int, List[CleanBlock]] = {}
        for b in blocks:
            if b.run_id < 0 or self._rule_size(b) <= 0:  # off-axis lines never join a run
                continue
            x0, y0, x1, y1 = b.bbox
            length = (y1 - y0) if vertical else (x1 - x0)
            if length < self.REF_MIN_LINE_EXTENT * page_extent:
                continue
            runs.setdefault(b.run_id, []).append(b)
        runs = {rid: lines for rid, lines in runs.items() if len(lines) >= 2}

        run_size = {rid: self._rule_size(lines[0]) for rid, lines in runs.items()}
        chars: dict[float, float] = {}
        for rid, lines in runs.items():
            if lines[0].run_len <= self.HEADING_MAX_WRAP_LINES and not (
                any(other != rid and self._same_size(run_size[rid], size) for other, size in run_size.items())
                or any(self._same_size(run_size[rid], size) for size in body_sizes)
            ):
                continue
            for b in lines:
                size = self._rule_size(b)
                chars[size] = chars.get(size, 0.0) + len(b.text)
        return chars

    def _page_reference(self, chars: dict[float, float]) -> Optional[float]:
        """A page's body size: the largest size class holding REF_SUBSTANTIAL_SHARE of
        its running text (18pt slide bullets over 14pt sub-bullets, 12pt body over 9pt
        footnotes). None when the page has too little running text."""
        total = sum(chars.values())
        if total < self.REF_MIN_PAGE_CHARS:
            return None
        clusters = self._cluster_sizes(chars)
        substantial = [s for s, w in clusters if w >= self.REF_SUBSTANTIAL_SHARE * total]
        return max(substantial) if substantial else max(clusters, key=lambda c: c[1])[0]

    def _reference_sizes(
        self, per_page: Sequence[Tuple[PageInfo, bool, List[CleanBlock]]]
    ) -> Tuple[dict[int, float], Tuple[float, float]]:
        """Reference sizes of the heading size rule.

        Returns each page's body size (0.0 = unknown) and the document floors: the
        median line size by span mean (font_size, the reference v1-v4 used
        everywhere) and by dominant span (rule_size). A page without enough running
        text of its own takes the document's body size: the largest page body size
        held by REF_DOC_PAGE_SHARE of ALL pages, so one text page cannot set it for a
        deck of chart pages; with none, the page has only the floors (v4 behaviour).
        Before that, a page with no body size gets a second look in which a lone
        2-3-line run counts if its size is another page's body size: the one comment
        paragraph of a broker's exhibit page, not a wrapped title (titles are larger
        than any page's body).
        """
        font_sizes = [cb.font_size for _p, _v, blocks in per_page for cb in blocks if cb.font_size > 0]
        rule_sizes = [self._rule_size(cb) for _p, _v, blocks in per_page for cb in blocks if self._rule_size(cb) > 0]
        floors = (median(font_sizes) if font_sizes else 12.0, median(rule_sizes) if rule_sizes else 12.0)

        page_refs: dict[int, Optional[float]] = {}
        for p, vertical, blocks in per_page:
            band_w, band_h = self._band_dims(p.width_pt, p.height_pt, p.rotation)
            page_refs[p.page_number] = self._page_reference(self._running_text_chars(blocks, vertical, band_w, band_h))
        body_sizes = sorted({r for r in page_refs.values() if r is not None})
        if body_sizes:
            for p, vertical, blocks in per_page:
                if page_refs[p.page_number] is None:
                    band_w, band_h = self._band_dims(p.width_pt, p.height_pt, p.rotation)
                    chars = self._running_text_chars(blocks, vertical, band_w, band_h, body_sizes)
                    page_refs[p.page_number] = self._page_reference(chars)

        pages_per_size: dict[float, float] = {}
        for r in page_refs.values():
            if r is not None:
                pages_per_size[r] = pages_per_size.get(r, 0.0) + 1.0
        common = [s for s, n in self._cluster_sizes(pages_per_size) if n >= self.REF_DOC_PAGE_SHARE * len(per_page)]
        doc_ref = max(common) if common else 0.0
        return {pn: r if r is not None else doc_ref for pn, r in page_refs.items()}, floors

    @staticmethod
    def _letter_weight(ch: str) -> int:
        """Letters for the shape guard. A CJK ideograph, kana or hangul syllable
        carries about a word, so it counts twice; combining marks (Devanagari
        matras and virama) count as letters."""
        if (
            "\u4e00" <= ch <= "\u9fff"  # CJK unified ideographs
            or "\u3400" <= ch <= "\u4dbf"  # extension A
            or "\uf900" <= ch <= "\ufaff"  # compatibility ideographs
            or "\u3040" <= ch <= "\u30ff"  # hiragana + katakana
            or "\uac00" <= ch <= "\ud7a3"  # hangul syllables
        ):
            return 2
        return 1 if ch.isalpha() or unicodedata.category(ch).startswith("M") else 0

    def _is_heading_by_size(
        self, block: CleanBlock, reference_size: float, floors: Tuple[float, float] = (0.0, 0.0)
    ) -> bool:
        """The size rule and its guards; the caps rule in _is_heading_block is separate.

        The line must clear HEADING_SIZE_FACTOR x its page's body size, and also x the
        document's median line in the same unit as one of its two sizes: a span mean
        pulled down by a superscript or a small whitespace span cannot make an
        ordinary line clear a median that other lines' means pulled down too. The
        dominant size is held to the larger median, since a span mean can also be
        pushed above it (a large trailing space after small cell text).
        """
        rule_size = self._rule_size(block)
        font_floor, rule_floor = floors
        if (
            block.run_len > self.HEADING_MAX_WRAP_LINES
            and rule_size < self.HEADING_DISPLAY_FACTOR * max(reference_size, font_floor, rule_floor)
        ):
            return False
        if rule_size <= reference_size * self.HEADING_SIZE_FACTOR:
            return False
        if (
            block.font_size <= font_floor * self.HEADING_SIZE_FACTOR
            and rule_size <= max(rule_floor, font_floor) * self.HEADING_SIZE_FACTOR
        ):
            return False
        if block.extractor_title:
            return True
        text = block.text.strip()
        if _BARE_ADDRESS_RE.match(text):
            return False  # a broker's "www.example.com" line, not a title
        letters = sum(self._letter_weight(ch) for ch in text)
        figures = sum(1 for ch in text if ch.isdigit() or ch in "$\u20ac\u00a3\u00a5%\u2030")
        # "US$ 4.2bn" and "\u957f\u946b\u79d1\u6280\uff08688825\uff09" pass; "Q3 2025", "+12%", "2026E" are chart callouts.
        return letters >= 2 and figures < letters

    def _is_heading_block(
        self, block: CleanBlock, reference_size: float, floors: Tuple[float, float] = (0.0, 0.0)
    ) -> bool:
        text = block.text.strip()
        if not text or len(text) > 220:
            return False
        if block.off_axis or _ARXIV_ID_LINE_RE.match(text):
            return False
        if text[-1:] in self.SENTENCE_DELIMS and len(text) > 45:
            return False
        if not any(ch.isalpha() or "\u4e00" <= ch <= "\u9fff" for ch in text):
            return False
        if self._is_heading_by_size(block, reference_size, floors):
            return True
        words = text.split()
        if 1 <= len(words) <= 12 and len(text) <= 90 and text[-1:] not in self.SENTENCE_DELIMS:
            alpha = "".join(ch for ch in text if ch.isalpha())
            if alpha and alpha.isupper():
                return True
        return False

    @staticmethod
    def _line_angle(direction: Tuple[float, float]) -> float:
        return math.degrees(math.atan2(direction[1], direction[0]))

    def _snapped_angle(self, direction: Tuple[float, float]) -> int:
        return (round(self._line_angle(direction) / 90.0) * 90) % 360

    @staticmethod
    def _band_dims(page_width: float, page_height: float, rotation: int) -> Tuple[float, float]:
        # Line bboxes are in unrotated page space; page_width/height are the rotated rect.
        return (page_height, page_width) if rotation % 180 == 90 else (page_width, page_height)

    def _dominant_line_angle(
        self, blocks: Sequence[BlockInfo], band_w: float, band_h: float, fallback_angle: float = 0.0
    ) -> float:
        """Character-weighted line direction of a page, snapped to 0/90/180/270°.

        Relative, not absolute: on a vertical-writing (tategaki) page or a page drawn
        rotated, vertical lines ARE the content and must not count as off-axis.
        Only body lines vote — outside the margin band, or in vertical writing mode
        anywhere — so a long vertical stamp cannot outvote a sparse body (a figure
        page with one caption). A page with no voters takes `fallback_angle`.
        """
        weights: Counter = Counter()
        for b in blocks:
            chars = len(b.text.strip())
            if chars and (b.vertical_writing or not self._in_margin_band(b.bbox, band_w, band_h)):
                weights[self._snapped_angle(b.direction)] += chars
        return float(weights.most_common(1)[0][0]) if weights else fallback_angle

    def _document_line_angle(self, pages: Sequence[PageInfo]) -> float:
        """Direction for pages with no text outside the margin band.

        The whole document's interior vote: an image-only page of a horizontal paper
        stays horizontal, so its vertical stamp is still dropped, while the margin-only
        last page of a vertical-writing book stays vertical. A document with no
        interior text at all votes with every line, else reads left-to-right.
        """
        interior: Counter = Counter()
        everything: Counter = Counter()
        for p in pages:
            band_w, band_h = self._band_dims(p.width_pt, p.height_pt, p.rotation)
            for b in p.blocks:
                chars = len(b.text.strip())
                if not chars:
                    continue
                angle = self._snapped_angle(b.direction)
                everything[angle] += chars
                if b.vertical_writing or not self._in_margin_band(b.bbox, band_w, band_h):
                    interior[angle] += chars
        weights = interior or everything
        return float(weights.most_common(1)[0][0]) if weights else 0.0

    def _is_off_axis(self, direction: Tuple[float, float], dominant_angle: float) -> bool:
        diff = abs(self._line_angle(direction) - dominant_angle) % 360.0
        return min(diff, 360.0 - diff) > self.OFF_AXIS_TOLERANCE_DEG

    def _in_margin_band(
        self, bbox: Tuple[float, float, float, float], width: float, height: float
    ) -> bool:
        x0, y0, x1, y1 = bbox
        r = self.MARGIN_BAND_RATIO
        return (
            x1 <= width * r
            or x0 >= width * (1.0 - r)
            or y1 <= height * r
            or y0 >= height * (1.0 - r)
        )

    @staticmethod
    def _is_cjk_context(ch: str) -> bool:
        """CJK ideograph, kana, or CJK/fullwidth punctuation. CJK text has no
        inter-word/sentence spaces, so the rejoin must never synthesize a space
        on either side of such a character (incl. after 。！？；)."""
        return (
            "一" <= ch <= "鿿"   # CJK unified ideographs
            or "぀" <= ch <= "ヿ"  # hiragana + katakana
            or "　" <= ch <= "〿"  # CJK symbols & punctuation (。、「」)
            or "＀" <= ch <= "￯"  # fullwidth / halfwidth forms (！？；：)
        )

    def _join_text_units(self, units: Sequence[str]) -> str:
        text = ""
        for raw in units:
            part = (raw or "").strip()
            if not part:
                continue
            if not text:
                text = part
                continue
            prev = text[-1]
            first = part[0]
            needs_space = (
                prev not in " \n([{"
                and first not in " \n,.;:!?)]}。！？；，、"
                and not self._is_cjk_context(prev)
                and not self._is_cjk_context(first)
            )
            text += (" " if needs_space else "") + part
        return text

    def _merge_adjacent_chunks(self, left: ChunkInfo, right: ChunkInfo) -> ChunkInfo:
        return ChunkInfo(
            text=self._join_text_units([left.text, right.text]),
            chunk_index=left.chunk_index,
            page_start=left.page_start,
            page_end=max(left.page_end, right.page_end),
            bboxes=left.bboxes + right.bboxes,
            section_title=left.section_title or right.section_title,
            token_count=left.token_count + right.token_count,
        )

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
            size_chars: dict[float, int] = {}
            for s in spans:
                sz = float(s.get("size")) if s.get("size") else None
                if sz:
                    sizes.append(sz)
                    n_chars = len((s.get("text") or "").strip())
                    if n_chars:
                        size_chars[sz] = size_chars.get(sz, 0) + n_chars

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
            # The span size holding the most characters (ties: the larger one).
            dominant = max(size_chars.items(), key=lambda kv: (kv[1], kv[0]))[0] if size_chars else 0.0
            line_dir = line.get("dir") or (1.0, 0.0)
            result.append(
                BlockInfo(
                    page=page,
                    text=text,
                    bbox=(float(line_bbox[0]), float(line_bbox[1]),
                          float(line_bbox[2]), float(line_bbox[3])),
                    font_size=avg_size,
                    direction=(float(line_dir[0]), float(line_dir[1])),
                    vertical_writing=line.get("wmode") == 1,
                    dominant_size=dominant,
                )
            )
        return result

    def _normalize_inline_text(self, text: str) -> str:
        # Collapse excessive whitespace but keep sentence punctuation
        # Strip NUL bytes (PostgreSQL text fields cannot contain \x00)
        t = text.replace("\x00", "")
        # Replace non-breaking spaces etc.
        t = t.replace("\xa0", " ")
        # Collapse multiple spaces
        while "  " in t:
            t = t.replace("  ,", ",").replace("  .", ".").replace("  ", " ")
        return t.strip()

    def _split_into_sentences(self, text: str) -> List[str]:
        """Split text by common sentence boundaries while keeping delimiters.

        An ASCII ``.``/``?``/``!`` is a boundary ONLY when followed by
        whitespace or end of string. Mid-token / no-space cases (U.S., e.g.,
        3.14, config.txt, "Why?Because") are not boundaries — otherwise the
        split→`_join_text_units` rejoin re-inserts a space and corrupts the
        wording the verifier later displays as a quote. CJK delimiters
        (。！？；) keep the always-split behaviour because CJK has no
        inter-sentence spaces; the rejoin path is responsible for not adding a
        space after them (see `_join_text_units`).
        """
        if not text:
            return []
        sentences: List[str] = []
        buff: List[str] = []
        n = len(text)
        for i, ch in enumerate(text):
            buff.append(ch)
            if ch not in self.SENTENCE_DELIMS:
                continue
            if ch in ".?!":  # ASCII sentence punctuation
                nxt = text[i + 1] if i + 1 < n else ""
                if nxt and not nxt.isspace():
                    continue
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
