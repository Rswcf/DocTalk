"""Auto-generate document summary and suggested questions after parsing.

Runs in Celery worker context (synchronous DB + sync OpenAI client).
Uses a budget model (deepseek) to minimize cost — no credits charged.
"""
from __future__ import annotations

import json
import uuid
from typing import Optional

from celery.utils.log import get_task_logger
from openai import OpenAI
from sqlalchemy import select

from app.core.config import settings
from app.models.sync_database import SyncSessionLocal
from app.models.tables import Chunk, Document

logger = get_task_logger(__name__)

# Budget model for summary generation (cheap + fast)
SUMMARY_MODEL = "deepseek/deepseek-v3.2"

SUMMARY_PROMPT = """You are a document analysis assistant. Based on the following excerpts from a document, provide:

1. A concise summary (2-3 paragraphs) covering the document's main topic, key findings, and purpose.
2. Exactly 5 specific questions that a reader would likely want to ask about this document. Questions should be diverse, covering different aspects of the content.

Respond in valid JSON format:
{
  "summary": "...",
  "questions": ["Q1", "Q2", "Q3", "Q4", "Q5"]
}

Document excerpts:
---
{chunks_text}
---

Respond ONLY with the JSON object, no other text."""


def generate_summary_sync(document_id: str) -> None:
    """Load first chunks, call LLM, and persist summary + questions.

    Best-effort: failures are logged but don't affect document status.
    """
    if not settings.OPENROUTER_API_KEY:
        logger.warning("OPENROUTER_API_KEY not set, skipping summary generation")
        return

    with SyncSessionLocal() as db:
        doc: Optional[Document] = db.get(Document, uuid.UUID(document_id))
        if not doc:
            logger.warning("Document %s not found for summary", document_id)
            return

        # Skip if summary already exists
        if doc.summary:
            logger.info("Document %s already has summary, skipping", document_id)
            return

        # Load first 20 chunks
        rows = db.execute(
            select(Chunk)
            .where(Chunk.document_id == doc.id)
            .order_by(Chunk.chunk_index)
            .limit(20)
        )
        chunks = list(rows.scalars())
        if not chunks:
            logger.warning("No chunks found for document %s, skipping summary", document_id)
            return

        # Build context from chunks
        chunks_text = "\n\n".join(
            f"[Chunk {c.chunk_index + 1}, p.{c.page_start}] {c.text[:500]}"
            for c in chunks
        )

        # Truncate if too long (roughly 8K chars to stay within budget model limits)
        if len(chunks_text) > 8000:
            chunks_text = chunks_text[:8000] + "\n...(truncated)"

        prompt = SUMMARY_PROMPT.format(chunks_text=chunks_text)

        try:
            client = OpenAI(
                api_key=settings.OPENROUTER_API_KEY,
                base_url=settings.OPENROUTER_BASE_URL,
            )
            response = client.chat.completions.create(
                model=SUMMARY_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=1000,
            )
            content = response.choices[0].message.content or ""

            # Parse JSON response
            # Strip markdown code fences if present
            content = content.strip()
            if content.startswith("```"):
                content = content.split("\n", 1)[1] if "\n" in content else content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()

            data = json.loads(content)
            summary = data.get("summary", "")
            questions = data.get("questions", [])

            if not summary:
                logger.warning("Empty summary returned for %s", document_id)
                return

            # Ensure questions is a list of strings
            if not isinstance(questions, list):
                questions = []
            questions = [str(q) for q in questions[:5]]

            # Persist
            doc.summary = summary
            doc.suggested_questions = questions
            db.add(doc)
            db.commit()
            logger.info(
                "Summary generated for %s: %d chars, %d questions",
                document_id, len(summary), len(questions)
            )

        except json.JSONDecodeError as e:
            logger.warning("Failed to parse summary JSON for %s: %s", document_id, e)
        except Exception as e:
            logger.exception("Summary generation failed for %s: %s", document_id, e)
