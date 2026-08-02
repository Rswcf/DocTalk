"""Minimal per-user biblio + APA in-text formatter (B6, plan §8.4 point 4 / D6).

document_biblio is keyed by (document_id, user_id) in spirit (see the model
docstring for why it's two partial unique indexes, not a literal composite
PK): one SYSTEM row per document (`user_id IS NULL`) holds an auto-detected
default seeded from filename heuristics + best-effort PyMuPDF doc metadata;
each user who edits it gets their OWN row. A user's edit must NEVER mutate
the system row or another user's row — Document.user_id is nullable and demo
docs are shared across users, so metadata isolation matters.

No citeproc-py, no Crossref/DOI lookup, no identifier scan in M2 (plan §8.5,
D6's fuller Zotero-hybrid vision is fast-follow) — `source` is only
'system' | 'user'.
"""
from __future__ import annotations

import asyncio
import logging
import re
import uuid
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tables import Document, DocumentBiblio, User

logger = logging.getLogger(__name__)

SYSTEM_SOURCE = "system"
USER_SOURCE = "user"

_EXTENSION_RE = re.compile(r"\.(pdf|docx?|pptx?|xlsx?|txt|md)$", re.IGNORECASE)
_YEAR_RE = re.compile(r"(?:\(((?:19|20)\d{2})\)|\b((?:19|20)\d{2})\b)")
_AUTHOR_TITLE_SPLIT_RE = re.compile(r"^\s*([^-–—:]{2,60})\s*[-–—:]\s*(.+)$")


def _split_author_name(name: str) -> Optional[dict[str, str]]:
    name = name.strip()
    if not name:
        return None
    parts = name.split()
    if len(parts) == 1:
        return {"family": parts[0], "given": ""}
    return {"family": parts[-1], "given": " ".join(parts[:-1])}


def _seed_csl_from_filename(filename: str) -> dict[str, Any]:
    """Filename heuristics (D6 seed step 1): "Author - Title (Year).ext" or
    "Author: Title.ext" style filenames yield an author + title guess; a bare
    4-digit year anywhere is picked up too. Falls back to the filename itself
    as the title when nothing else parses — always returns SOMETHING so the
    system row is never blocked on this heuristic failing."""
    base = _EXTENSION_RE.sub("", filename or "").strip()
    if not base:
        return {"title": filename or "Untitled document"}

    year_match = _YEAR_RE.search(base)
    year = int(year_match.group(1) or year_match.group(2)) if year_match else None
    # Drop the matched year fragment so it doesn't linger in the title guess.
    if year_match:
        remainder = base[: year_match.start()] + base[year_match.end() :]
        remainder = re.sub(r"\s+", " ", remainder).strip(" -–—()")
    else:
        remainder = base

    author_match = _AUTHOR_TITLE_SPLIT_RE.match(remainder)
    author = None
    title = remainder
    if author_match:
        author_part, title_part = author_match.group(1).strip(), author_match.group(2).strip()
        # Only treat the left side as an author if it looks name-shaped
        # (short, no digits) — otherwise this isn't an "Author - Title" file.
        if title_part and len(author_part.split()) <= 5 and not re.search(r"\d", author_part):
            author = author_part
            title = title_part

    csl: dict[str, Any] = {"title": title or base or filename}
    if author:
        parsed = _split_author_name(author)
        if parsed:
            csl["author"] = [parsed]
    if year:
        csl["issued"] = {"year": year}
    return csl


async def _enrich_from_pdf_metadata(document: Document, csl: dict[str, Any]) -> dict[str, Any]:
    """Best-effort enrichment (D6 seed step 1, PyMuPDF doc metadata) — opens
    the document's PDF (or its converted-to-PDF representation for
    DOCX/PPTX) and fills in author/title/year from PyMuPDF's metadata dict
    where the filename heuristic didn't already find them. NEVER raises —
    any failure (storage unavailable, corrupt file, non-PDF with no
    conversion yet) just keeps the filename-only seed."""
    try:
        file_type = getattr(document, "file_type", "pdf") or "pdf"
        storage_key = document.storage_key
        if file_type != "pdf":
            converted = getattr(document, "converted_storage_key", None)
            if not converted:
                return csl
            storage_key = converted

        import fitz

        from app.services.storage_service import storage_service

        data = await asyncio.to_thread(storage_service.download_file, storage_key)
        pdf_doc = fitz.open(stream=data, filetype="pdf")
        try:
            meta = pdf_doc.metadata or {}
        finally:
            pdf_doc.close()

        pdf_title = (meta.get("title") or "").strip()
        if pdf_title and not csl.get("author"):
            # Only override the filename-guessed title when we don't already
            # have a confident author+title split — a real PDF title field
            # is usually more reliable than the filename by itself.
            csl["title"] = pdf_title
        elif pdf_title and not csl.get("title"):
            csl["title"] = pdf_title

        pdf_author = (meta.get("author") or "").strip()
        if pdf_author and not csl.get("author"):
            names = re.split(r"[;,&]| and ", pdf_author)
            authors = [a for a in (_split_author_name(n) for n in names) if a]
            if authors:
                csl["author"] = authors

        creation = meta.get("creationDate") or ""
        year_match = re.match(r"D:(\d{4})", creation)
        if year_match and not csl.get("issued"):
            csl["issued"] = {"year": int(year_match.group(1))}
    except Exception as exc:  # noqa: BLE001 — enrichment is optional, never blocks seeding
        logger.info("biblio PDF metadata enrichment skipped for %s: %s", getattr(document, "id", None), exc)
    return csl


async def _fetch_system_row(db: AsyncSession, document_id: uuid.UUID) -> Optional[DocumentBiblio]:
    result = await db.execute(
        select(DocumentBiblio)
        .where(DocumentBiblio.document_id == document_id)
        .where(DocumentBiblio.user_id.is_(None))
    )
    return result.scalar_one_or_none()


async def _fetch_user_row(
    db: AsyncSession, document_id: uuid.UUID, user_id: uuid.UUID
) -> Optional[DocumentBiblio]:
    result = await db.execute(
        select(DocumentBiblio)
        .where(DocumentBiblio.document_id == document_id)
        .where(DocumentBiblio.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def get_or_seed_system_biblio(db: AsyncSession, document: Document) -> DocumentBiblio:
    """Return the document's system (auto-detected default) row, seeding it
    from filename heuristics + best-effort PyMuPDF metadata on first access.

    FIX-9 (Codex r1 MINOR #9): the SELECT-then-INSERT above races on first
    access — two concurrent requests for the same never-seeded document can
    both SELECT None, then both attempt to INSERT. The partial unique index
    `uq_document_biblio_system` (document_id WHERE user_id IS NULL) correctly
    stops the second INSERT from committing, but that would otherwise
    surface as an unhandled IntegrityError -> 500 for the loser. Recover by
    rolling back and re-fetching: the loser's job here is only to return
    SOME valid system row, and the winner's row (seeded moments earlier) is
    exactly that — never re-seed a duplicate, never error a benign race.
    """
    existing = await _fetch_system_row(db, document.id)
    if existing:
        return existing

    csl = _seed_csl_from_filename(document.filename)
    csl = await _enrich_from_pdf_metadata(document, csl)
    row = DocumentBiblio(document_id=document.id, user_id=None, csl_json=csl, source=SYSTEM_SOURCE)
    db.add(row)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        winner = await _fetch_system_row(db, document.id)
        if winner is None:
            raise  # not the race we anticipated — a genuine failure
        return winner
    return row


async def get_biblio_for_user(db: AsyncSession, document: Document, user: User) -> DocumentBiblio:
    """The effective biblio for GET: the user's own edit if they have one,
    else the (seeded) system default. Never creates a user row — read-only
    fallback."""
    user_row = await _fetch_user_row(db, document.id, user.id)
    if user_row:
        return user_row
    return await get_or_seed_system_biblio(db, document)


async def upsert_user_biblio(
    db: AsyncSession, document: Document, user: User, csl_json: dict[str, Any]
) -> DocumentBiblio:
    """PUT: always writes to the CALLING user's own row (source='user'),
    creating it if needed. Never reads or mutates the system row or any
    other user's row — that's the whole point of the per-user key.

    FIX-9 (Codex r1 MINOR #9): SELECT-then-INSERT races the same way
    get_or_seed_system_biblio does — two concurrent first PUTs from the SAME
    user for the SAME document (double-click, two tabs) can both SELECT
    None, then both attempt to INSERT, and `uq_document_biblio_user`
    (document_id, user_id WHERE user_id IS NOT NULL) stops the loser's
    commit. Unlike the system-row race, the loser's intent here matters —
    it's an EDIT, not a passive seed — so recovery retries as an UPDATE
    against the row the winner just created, landing the caller's actual
    csl_json rather than silently keeping the winner's.
    """
    existing = await _fetch_user_row(db, document.id, user.id)
    if existing:
        existing.csl_json = csl_json
        existing.source = USER_SOURCE
        await db.commit()
        return existing

    row = DocumentBiblio(document_id=document.id, user_id=user.id, csl_json=csl_json, source=USER_SOURCE)
    db.add(row)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        winner = await _fetch_user_row(db, document.id, user.id)
        if winner is None:
            raise  # not the race we anticipated — a genuine failure
        winner.csl_json = csl_json
        winner.source = USER_SOURCE
        await db.commit()
        return winner
    return row


def format_apa_intext(biblio: dict[str, Any], page: Optional[int]) -> str:
    """Pure function: minimal APA in-text citation, no citeproc (§8.5).

    "(Family, Year, p. X)"; 2 authors -> "A & B"; 3+ -> "A et al.";
    missing author falls back to title; missing year -> "n.d."; missing
    page omits the page fragment entirely.
    """
    authors = biblio.get("author") or []
    families = [
        a.get("family", "").strip()
        for a in authors
        if isinstance(a, dict) and (a.get("family") or "").strip()
    ]
    if families:
        if len(families) == 1:
            who = families[0]
        elif len(families) == 2:
            who = f"{families[0]} & {families[1]}"
        else:
            who = f"{families[0]} et al."
    else:
        title = (biblio.get("title") or "").strip()
        who = title if title else "n.a."

    year = (biblio.get("issued") or {}).get("year")
    year_str = str(year) if year else "n.d."

    page_str = f", p. {page}" if page else ""
    return f"({who}, {year_str}{page_str})"
