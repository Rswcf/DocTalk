"""Shared magic-byte and container validation for document ingress."""
from __future__ import annotations

import io
import zipfile

MAGIC_SIGNATURES: dict[str, tuple[bytes, ...]] = {
    "pdf": (b"%PDF-",),
    "docx": (b"PK\x03\x04",),
    "pptx": (b"PK\x03\x04",),
    "xlsx": (b"PK\x03\x04",),
    "txt": (),
    "md": (),
}

MAX_UNCOMPRESSED_SIZE = 500 * 1024 * 1024  # 500 MB zip-bomb protection


def validate_file_content(data: bytes, file_type: str) -> bool:
    """Validate file content against its expected magic bytes and structure.

    This is intentionally shared by direct-upload validation and URL response
    sniffing so both ingress paths classify PDFs from the same byte contract.
    URL sniffing passes only the bounded magic-byte prefix for PDFs; Office
    containers continue to receive the full payload for ZIP validation.
    """
    signatures = MAGIC_SIGNATURES.get(file_type, ())
    if signatures and not any(data.startswith(signature) for signature in signatures):
        return False

    if file_type in ("docx", "pptx", "xlsx"):
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                if "[Content_Types].xml" not in archive.namelist():
                    return False
                total_uncompressed = sum(info.file_size for info in archive.infolist())
                if total_uncompressed > MAX_UNCOMPRESSED_SIZE:
                    return False
        except zipfile.BadZipFile:
            return False
    return True


def file_magic_length(file_type: str) -> int:
    """Return the bytes needed to decide the configured magic signatures."""
    return max((len(signature) for signature in MAGIC_SIGNATURES.get(file_type, ())), default=0)
