"""Convert office documents (PPTX, DOCX) to PDF using LibreOffice headless."""
from __future__ import annotations

import logging
import os
import subprocess
import tempfile

logger = logging.getLogger(__name__)

# File types that support visual PDF conversion
CONVERTIBLE_TYPES = {"pptx", "docx"}

# Map file_type to file extension for temp files
_SUFFIX_MAP = {
    "pptx": ".pptx",
    "docx": ".docx",
}


def convert_to_pdf(input_bytes: bytes, file_type: str, timeout: int = 120) -> bytes:
    """Convert office document bytes to PDF using LibreOffice headless.

    Args:
        input_bytes: Raw file bytes.
        file_type: One of 'pptx', 'docx'.
        timeout: Max seconds for the conversion subprocess.

    Returns:
        PDF file bytes.

    Raises:
        RuntimeError: If conversion fails or produces no output.
    """
    suffix = _SUFFIX_MAP.get(file_type)
    if not suffix:
        raise ValueError(f"Unsupported file type for conversion: {file_type}")

    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = os.path.join(tmpdir, f"input{suffix}")
        with open(input_path, "wb") as f:
            f.write(input_bytes)

        try:
            result = subprocess.run(
                [
                    "libreoffice",
                    "--headless",
                    "--norestore",
                    "--convert-to", "pdf",
                    "--outdir", tmpdir,
                    input_path,
                ],
                capture_output=True,
                timeout=timeout,
                cwd=tmpdir,
            )
        except subprocess.TimeoutExpired:
            raise RuntimeError(
                f"LibreOffice conversion timed out after {timeout}s"
            )

        if result.returncode != 0:
            stderr = result.stderr.decode("utf-8", errors="replace")[:500]
            raise RuntimeError(
                f"LibreOffice conversion failed (exit {result.returncode}): {stderr}"
            )

        # Output PDF has same base name as input
        output_path = os.path.join(tmpdir, "input.pdf")
        if not os.path.exists(output_path):
            raise RuntimeError("LibreOffice conversion produced no output PDF")

        with open(output_path, "rb") as f:
            return f.read()
