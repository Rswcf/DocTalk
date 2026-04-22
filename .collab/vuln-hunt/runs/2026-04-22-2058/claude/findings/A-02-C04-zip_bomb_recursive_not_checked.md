---
id: A-02-C04-01
matrix: A
agent: claude
cell_id: A-02-C04
row_key: documents
column_key: input_validation
finding_key: zip_bomb_recursive_not_checked
severity: P3
confidence: medium
status: deficiency
files:
  - "backend/app/api/documents.py:75"
  - "backend/app/api/documents.py:85"
exploit_preconditions:
  - "authenticated user uploads a crafted DOCX/PPTX/XLSX"
---

## Observation
`_validate_file_content` for Office Open XML formats (`documents.py:75-91`) checks:
- Magic bytes `PK\x03\x04` ✓
- `[Content_Types].xml` present ✓
- `sum(info.file_size for info in zf.infolist()) > 500MB` ✓ (top-level uncompressed size)

Missing: **nested zip / recursive compression** — DOCX is a ZIP, and the ZIP can contain embedded ZIP/OOXML files (e.g. an embedded Excel inside a Word doc via OLE). The outer `infolist()` only reports top-level sizes; a 1MB docx containing a nested 1MB zip that itself contains 500MB of compressed zeros evades the check.

Also missing: **compression ratio check** — a file with 0.01% compression ratio is suspicious even below the 500MB cap.

## Impact
Parse worker memory exhaustion. `parse_worker.py` calls `python-docx` / `openpyxl` which recursively unzip when handling embedded objects. A crafted docx can OOM-kill the worker (Celery `--concurrency=1` means one OOM kills the entire parse queue until restart).

Likelihood is LOW — exploits need to be targeted at the parser, and the existing 500MB cap catches the obvious cases. But defense-in-depth is cheap here.

## Suggested Fix
Add compression-ratio check and nested-zip detection:

```python
def _validate_file_content(data: bytes, file_type: str) -> bool:
    if file_type in ('docx', 'pptx', 'xlsx'):
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            if '[Content_Types].xml' not in zf.namelist():
                return False
            total_uncompressed = sum(info.file_size for info in zf.infolist())
            total_compressed = sum(info.compress_size for info in zf.infolist())
            if total_uncompressed > _MAX_UNCOMPRESSED_SIZE:
                return False
            # New: suspicious compression ratio
            if total_compressed > 0 and total_uncompressed / total_compressed > 200:
                return False
            # New: reject nested OOXML / ZIP
            for info in zf.infolist():
                name = info.filename.lower()
                if name.endswith(('.docx', '.pptx', '.xlsx', '.zip')) and info.file_size > 1024 * 1024:
                    return False
    return True
```

Also set Celery worker `--max-memory-per-child=512M` so even if parse OOMs, the child restarts instead of the scheduler dying.
