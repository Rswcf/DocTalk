"""
OCR baseline benchmark for DocTalk's Tesseract pipeline.

Synthesizes 3 scan-quality variants from demo PDF first pages, runs
extract_pages_ocr, and reports char count / char density / wall time.

Not a product go/no-go — see .collab/plans/2026-04-13-next-batch-final.md
for O-2 scope (real scanned samples needed).
"""
from __future__ import annotations

import io
import math
import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path

import fitz  # PyMuPDF

REPO = Path(__file__).resolve().parents[2]
SEED = REPO / "backend" / "seed_data"
sys.path.insert(0, str(REPO / "backend"))

# Import the real service to use the same extract_pages_ocr as prod
from app.services.parse_service import ParseService  # noqa: E402

svc = ParseService()


@dataclass
class Variant:
    name: str
    dpi: int        # render DPI for rasterization
    rotate_deg: int  # post-rotation (simulates skewed scan)
    # Note: "blur" simulated by low DPI (100) which degrades legibility
    # after upsampling during OCR


VARIANTS = [
    Variant("clean-200dpi", dpi=200, rotate_deg=0),
    Variant("low-res-100dpi", dpi=100, rotate_deg=0),
    Variant("tilted-200dpi-15deg", dpi=200, rotate_deg=15),
]


def synthesize_scan_pdf(src_pdf: Path, variant: Variant, max_pages: int = 2) -> bytes:
    """Render first N pages of src as raster images at given DPI, optionally
    rotate, and wrap back into a PDF with no text layer. Output is what a
    scanned PDF with image-only pages looks like to extract_pages()."""
    src = fitz.open(str(src_pdf))
    out = fitz.open()

    for page_index in range(min(max_pages, len(src))):
        page = src[page_index]
        mat = fitz.Matrix(variant.dpi / 72, variant.dpi / 72)
        if variant.rotate_deg:
            mat = mat * fitz.Matrix(
                math.cos(math.radians(variant.rotate_deg)),
                math.sin(math.radians(variant.rotate_deg)),
                -math.sin(math.radians(variant.rotate_deg)),
                math.cos(math.radians(variant.rotate_deg)),
                0, 0,
            )
        pix = page.get_pixmap(matrix=mat, alpha=False)
        img_bytes = pix.tobytes("png")

        # New page in output matching pixmap size
        new_page = out.new_page(width=pix.width, height=pix.height)
        new_page.insert_image(
            fitz.Rect(0, 0, pix.width, pix.height),
            stream=img_bytes,
        )

    buf = io.BytesIO()
    out.save(buf)
    src.close()
    out.close()
    return buf.getvalue()


def measure(pdf_bytes: bytes, label: str) -> dict:
    """Run extract_pages_ocr and report metrics."""
    t0 = time.monotonic()
    pages = svc.extract_pages_ocr(pdf_bytes, languages="eng+chi_sim", dpi=300)
    wall = time.monotonic() - t0

    total_chars = 0
    total_blocks = 0
    per_page_chars = []
    for p in pages:
        page_chars = sum(len(b.text) for b in p.blocks)
        total_chars += page_chars
        total_blocks += len(p.blocks)
        per_page_chars.append(page_chars)

    detected_scanned = svc.detect_scanned(pages)
    return {
        "label": label,
        "pages": len(pages),
        "blocks": total_blocks,
        "chars": total_chars,
        "chars_per_page": total_chars / max(len(pages), 1),
        "wall_s": round(wall, 2),
        "chars_per_s": round(total_chars / max(wall, 0.01), 1),
        "detect_scanned_after_ocr": detected_scanned,
        "per_page_chars": per_page_chars,
    }


def main():
    target_pdf = SEED / "alphabet-earnings.pdf"
    print(f"# OCR baseline — src: {target_pdf.name}, first 2 pages\n")
    print(f"{'variant':<28} {'pages':>5} {'chars':>7} {'c/pg':>7} {'wall(s)':>8} {'c/s':>7}")
    print("-" * 70)
    results = []
    for v in VARIANTS:
        pdf = synthesize_scan_pdf(target_pdf, v)
        size_kb = len(pdf) // 1024
        r = measure(pdf, v.name)
        r["synth_size_kb"] = size_kb
        results.append(r)
        print(
            f"{v.name:<28} {r['pages']:>5} {r['chars']:>7} "
            f"{r['chars_per_page']:>7.0f} {r['wall_s']:>8.2f} {r['chars_per_s']:>7.1f}"
        )
    print()
    return results


if __name__ == "__main__":
    main()
