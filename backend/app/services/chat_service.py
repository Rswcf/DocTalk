from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass
from typing import Any, AsyncGenerator, Dict, List, Optional

import sqlalchemy as sa
from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.model_profiles import get_model_profile, get_rules_for_model
from app.models.tables import (
    ChatSession,
    Chunk,
    CreditLedger,
    Document,
    Message,
    User,
    collection_documents,
)
from app.services import credit_service
from app.services.retrieval_service import retrieval_service

logger = logging.getLogger(__name__)

# ---------------------------
# SSE Event helpers
# ---------------------------

def sse(event: str, data: Dict[str, Any]) -> Dict[str, Any]:
    return {"event": event, "data": data}


_openai_client: AsyncOpenAI | None = None


def _get_openai_client() -> AsyncOpenAI:
    global _openai_client
    if _openai_client is None:
        _openai_client = AsyncOpenAI(
            api_key=settings.OPENROUTER_API_KEY,
            base_url=settings.OPENROUTER_BASE_URL,
            default_headers={
                "HTTP-Referer": settings.FRONTEND_URL,
                "X-Title": "DocTalk",
            },
        )
    return _openai_client


# ---------------------------
# RefParserFSM
# ---------------------------

@dataclass
class _ChunkInfo:
    id: uuid.UUID
    page_start: int
    bboxes: list
    text: str
    section_title: str = ""
    document_id: Optional[uuid.UUID] = None
    document_filename: str = ""


class RefParserFSM:
    """解析 LLM 流式输出中的 [n] 引用标记

    - state: TEXT | MAYBE_REF
    - buffer 上限 8 字符，超限回退
    - char_offset: 已输出字符计数
    """

    def __init__(self, chunk_map: dict[int, _ChunkInfo]):
        self.chunk_map = chunk_map
        self.buffer: str = ""
        self.char_offset: int = 0
        self.state: str = "TEXT"  # TEXT | MAYBE_REF

    def feed(self, token: str) -> List[Dict[str, Any]]:
        events: List[Dict[str, Any]] = []
        for ch in token:
            if self.state == "TEXT":
                if ch == "[":
                    self.state = "MAYBE_REF"
                    self.buffer = "["
                else:
                    events.append(sse("token", {"text": ch}))
                    self.char_offset += 1

            elif self.state == "MAYBE_REF":
                self.buffer += ch
                if ch == "]":
                    inner = self.buffer[1:-1]
                    if inner.isdigit() and (int(inner) in self.chunk_map):
                        ref_num = int(inner)
                        chunk = self.chunk_map[ref_num]
                        # Filter and sort bboxes to current page (no artificial limit)
                        page_bbs = [
                            bb
                            for bb in (chunk.bboxes or [])
                            if isinstance(bb, dict)
                            and bb.get("page", chunk.page_start) == chunk.page_start
                        ]
                        if not page_bbs:
                            page_bbs = list(chunk.bboxes or [])
                        page_bbs.sort(key=lambda b: (b.get("y", 0), b.get("x", 0)))
                        limited_bboxes = page_bbs
                        citation_data: Dict[str, Any] = {
                                    "ref_index": ref_num,
                                    "chunk_id": str(chunk.id),
                                    "page": chunk.page_start,
                                    "bboxes": limited_bboxes,
                                    "text_snippet": ((f"{chunk.section_title}: " if chunk.section_title else "") + (chunk.text or ""))[:100],
                                    "offset": self.char_offset,
                        }
                        if chunk.document_id:
                            citation_data["document_id"] = str(chunk.document_id)
                        if chunk.document_filename:
                            citation_data["document_filename"] = chunk.document_filename
                        events.append(sse("citation", citation_data))
                    else:
                        # 非有效引用，回退为普通文本
                        events.append(sse("token", {"text": self.buffer}))
                        self.char_offset += len(self.buffer)
                    self.buffer = ""
                    self.state = "TEXT"
                elif len(self.buffer) > 8:
                    # 超限回退
                    events.append(sse("token", {"text": self.buffer}))
                    self.char_offset += len(self.buffer)
                    self.buffer = ""
                    self.state = "TEXT"
        return events

    def flush(self) -> List[Dict[str, Any]]:
        events: List[Dict[str, Any]] = []
        if self.buffer:
            events.append(sse("token", {"text": self.buffer}))
            self.buffer = ""
        return events


# ---------------------------
# Chat Service
# ---------------------------


class ChatService:
    async def chat_stream(
        self,
        session_id: uuid.UUID,
        user_message: str,
        db: AsyncSession,
        user: Optional[User] = None,
        locale: Optional[str] = None,
        mode: Optional[str] = None,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Main chat streaming generator producing SSE event dicts.

        Steps per spec:
        1) Load session + document
        2) Save user message
        3) Load recent history (last MAX_CHAT_HISTORY_TURNS rounds)
        4) Retrieval top-5
        5) Build prompt with numbered chunks
        6) Stream Anthropic
        7) Parse with RefParserFSM and yield events; ping every 15s
        8) Save assistant message + citations
        9) Yield done
        """

        # 1) Load session
        row = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
        session_obj: Optional[ChatSession] = row.scalar_one_or_none()
        if not session_obj:
            yield sse("error", {"code": "SESSION_NOT_FOUND", "message": "会话不存在"})
            return

        document_id = session_obj.document_id
        collection_id = getattr(session_obj, "collection_id", None)
        is_collection_session = collection_id is not None and document_id is None

        # Load document for custom instructions (single-doc sessions)
        doc = await db.get(Document, document_id) if document_id else None

        # For collection sessions, load all document IDs and filenames
        collection_doc_ids: List[uuid.UUID] = []
        collection_doc_names: dict[uuid.UUID, str] = {}
        if is_collection_session:
            cd_rows = await db.execute(
                select(collection_documents.c.document_id).where(
                    collection_documents.c.collection_id == collection_id
                )
            )
            collection_doc_ids = [row[0] for row in cd_rows.all()]
            if collection_doc_ids:
                doc_rows = await db.execute(
                    select(Document.id, Document.filename).where(Document.id.in_(collection_doc_ids))
                )
                for drow in doc_rows.all():
                    collection_doc_names[drow[0]] = drow[1]

        # Resolve mode → model (mode is the ONLY way to select a model)
        effective_mode = mode if mode in settings.MODE_MODELS else "balanced"
        effective_model = settings.MODE_MODELS[effective_mode]

        # Force demo model for anonymous users on demo documents
        if user is None and doc and doc.demo_slug:
            effective_model = settings.DEMO_LLM_MODEL
            effective_mode = "quick"

        # Premium mode gating: require Plus or Pro plan
        if effective_mode in settings.PREMIUM_MODES:
            user_plan = (user.plan or "free").lower() if user else "free"
            if user_plan == "free":
                yield sse("error", {"code": "MODE_NOT_ALLOWED", "message": "Upgrade to Plus to use Thorough mode"})
                return

        # Pre-debit estimated credits BEFORE streaming (prevents TOCTOU + free rides)
        pre_debited = 0
        predebit_ledger_id = None
        if user is not None:
            estimated = credit_service.get_estimated_cost(effective_mode)
            predebit_ledger_id = await credit_service.debit_credits(
                db, user_id=user.id, cost=estimated,
                reason="chat", ref_type="mode", ref_id=effective_mode,
            )
            if predebit_ledger_id:
                pre_debited = estimated
                await db.commit()
            else:
                balance = await credit_service.get_user_credits(db, user.id)
                yield sse(
                    "error",
                    {
                        "code": "INSUFFICIENT_CREDITS",
                        "message": "Insufficient credits to start chat",
                        "required": estimated,
                        "balance": balance,
                    },
                )
                return

        # 2) Save user message
        user_msg = Message(session_id=session_id, role="user", content=user_message)
        db.add(user_msg)
        await db.commit()

        # Auto-set session title from first user message
        session = await db.get(ChatSession, session_id)
        if session and not session.title:
            clean = user_message.replace("\n", " ").replace("\r", "").strip()
            session.title = clean[:50]
            await db.commit()

        # 3) Load history (last N*2 messages before current user msg)
        max_turns = int(settings.MAX_CHAT_HISTORY_TURNS or 6)
        max_msgs = max_turns * 2
        msgs_row = await db.execute(
            select(Message)
            .where(Message.session_id == session_id)
            .order_by(Message.created_at.desc())
            .limit(max_msgs + 1)
        )
        history_msgs: List[Message] = list(msgs_row.scalars().all())
        history_msgs.reverse()  # back to chronological order

        # Convert to Claude message format (excluding system)
        claude_messages: List[dict] = []
        for m in history_msgs:
            claude_messages.append({"role": m.role, "content": m.content})

        # 4) Retrieval (with error handling — e.g. Qdrant down or no vectors yet)
        try:
            if is_collection_session and collection_doc_ids:
                retrieved = await retrieval_service.search_multi(
                    user_message, collection_doc_ids, top_k=8, db=db
                )
            elif document_id:
                retrieved = await retrieval_service.search(user_message, document_id, top_k=8, db=db)
            else:
                retrieved = []
        except Exception as e:
            yield sse("error", {"code": "RETRIEVAL_ERROR", "message": f"Document retrieval failed: {e}"})
            return

        # 5) Build prompt (system)
        numbered_chunks: List[str] = []
        chunk_map: dict[int, _ChunkInfo] = {}
        for idx, item in enumerate(retrieved, start=1):
            # Heuristic truncation to ~350 tokens (roughly 1200-1400 chars)
            text = item["text"] or ""
            truncated = text[:1400]
            chunk_doc_id = item.get("document_id")
            doc_label = ""
            if is_collection_session and chunk_doc_id:
                fname = collection_doc_names.get(chunk_doc_id, "")
                if fname:
                    doc_label = f"(from: {fname}) "
            numbered_chunks.append(f"[{idx}] {doc_label}{truncated}")
            chunk_map[idx] = _ChunkInfo(
                id=item["chunk_id"],
                page_start=int(item["page"]),
                bboxes=item.get("bboxes") or [],
                text=text,
                section_title=item.get("section_title") or "",
                document_id=chunk_doc_id if chunk_doc_id else document_id,
                document_filename=collection_doc_names.get(chunk_doc_id, "") if chunk_doc_id else "",
            )

        rules = get_rules_for_model(
            effective_model, is_collection=is_collection_session
        )

        if is_collection_session:
            doc_list = ", ".join(collection_doc_names.values()) if collection_doc_names else "(no documents)"
            system_prompt = (
                "You are a document analysis assistant. Answer the user's question based on fragments from multiple documents.\n\n"
                f"## Available Documents\n{doc_list}\n\n"
                "## Document Fragments\n"
                + ("\n".join(numbered_chunks) if numbered_chunks else "(none)")
                + "\n\n## Rules\n" + rules
            )
        else:
            system_prompt = (
                "You are a document analysis assistant. Answer the user's question based on the following document fragments.\n\n"
                "## Document Fragments\n"
                + ("\n".join(numbered_chunks) if numbered_chunks else "(none)")
                + "\n\n## Rules\n" + rules
            )

        # Inject custom instructions if present
        if doc and doc.custom_instructions:
            system_prompt += (
                "\n## Custom Instructions\n"
                "The user has provided the following custom instructions for this document. Follow them:\n"
                + doc.custom_instructions + "\n"
            )

        # 6) Stream from OpenRouter (OpenAI-compatible)
        client = _get_openai_client()

        # Build OpenAI-format messages (system + history)
        # cache_control is Anthropic-specific — only include for Anthropic models
        profile = get_model_profile(effective_model)
        if profile.supports_cache_control:
            sys_msg: dict = {
                "role": "system",
                "content": [
                    {
                        "type": "text",
                        "text": system_prompt,
                        "cache_control": {"type": "ephemeral"},
                    }
                ],
            }
        else:
            sys_msg = {"role": "system", "content": system_prompt}
        openai_messages = [sys_msg] + claude_messages

        assistant_text_parts: List[str] = []
        citations: List[dict] = []
        fsm = RefParserFSM(chunk_map)

        last_ping = time.monotonic()
        prompt_tokens: Optional[int] = None
        output_tokens: Optional[int] = None
        llm_start = time.time()
        first_token_logged = False
        token_count = 0
        finish_reason: Optional[str] = None

        try:
            create_kwargs: dict[str, Any] = {
                "model": effective_model,
                "max_tokens": profile.max_tokens,
                "temperature": profile.temperature,
                "messages": openai_messages,
                "stream": True,
            }
            if profile.supports_stream_options:
                create_kwargs["stream_options"] = {"include_usage": True}
            stream = await client.chat.completions.create(**create_kwargs)

            async for chunk in stream:
                # Extract text delta
                if chunk.choices and chunk.choices[0].delta.content:
                    text = chunk.choices[0].delta.content
                    token_count += 1
                    if not first_token_logged:
                        first_token_logged = True
                        latency = time.time() - llm_start
                        logger.info("LLM first_token_latency=%.2fs model=%s", latency, effective_model)
                    # 7) Feed FSM and emit events
                    for ev in fsm.feed(text):
                        if ev["event"] == "token":
                            assistant_text_parts.append(ev["data"]["text"])
                        elif ev["event"] == "citation":
                            citations.append(ev["data"])
                        yield ev

                # Track finish_reason from choices
                if chunk.choices and chunk.choices[0].finish_reason:
                    finish_reason = chunk.choices[0].finish_reason

                # Extract usage if present (last chunk)
                if hasattr(chunk, "usage") and chunk.usage:
                    prompt_tokens = getattr(chunk.usage, "prompt_tokens", None)
                    output_tokens = getattr(chunk.usage, "completion_tokens", None)

                # Ping every 15 seconds
                now = time.monotonic()
                if now - last_ping >= 15.0:
                    yield sse("ping", {})
                    last_ping = now

            # Flush at stream end
            for ev in fsm.flush():
                if ev["event"] == "token":
                    assistant_text_parts.append(ev["data"]["text"])
                yield ev

            # Warn if response was truncated due to token limit
            if finish_reason == "length":
                logger.warning(
                    "LLM response truncated (finish_reason=length) model=%s max_tokens=%d output_tokens=%s",
                    effective_model, profile.max_tokens, output_tokens,
                )
                yield sse("truncated", {"reason": "max_tokens"})

            total_time = time.time() - llm_start
            final_token_count = int(output_tokens) if output_tokens is not None else token_count
            logger.info(
                "LLM total_latency=%.2fs tokens=%d model=%s",
                total_time,
                final_token_count,
                effective_model,
            )

        except Exception as e:
            # Refund pre-debited credits on LLM failure: restore balance and remove ledger entry
            if user is not None and pre_debited > 0 and predebit_ledger_id is not None:
                try:
                    await db.execute(
                        sa.update(User).where(User.id == user.id)
                        .values(credits_balance=User.credits_balance + pre_debited)
                    )
                    await db.execute(
                        sa.delete(CreditLedger).where(CreditLedger.id == predebit_ledger_id)
                    )
                    await db.commit()
                except Exception:
                    pass  # best-effort refund
            yield sse("error", {"code": "LLM_ERROR", "message": str(e)})
            return

        # 9) Save assistant message + citations
        assistant_text = "".join(assistant_text_parts)
        try:
            asst_msg = Message(
                session_id=session_id,
                role="assistant",
                content=assistant_text,
                citations=citations or None,
                prompt_tokens=int(prompt_tokens) if prompt_tokens is not None else None,
                output_tokens=int(output_tokens) if output_tokens is not None else None,
            )
            db.add(asst_msg)
            await db.commit()
        except IntegrityError:
            await db.rollback()
            yield sse("error", {"code": "PERSIST_FAILED", "message": "Failed to save response"})
            return

        # Credits: reconcile pre-debited estimate against actual cost
        if user is not None and pre_debited > 0 and predebit_ledger_id is not None:
            pt = int(prompt_tokens or 0)
            ct = int(output_tokens or 0)
            try:
                actual_cost = credit_service.calculate_cost(pt, ct, effective_model, mode=effective_mode)
                await credit_service.reconcile_credits(
                    db, user.id, predebit_ledger_id, pre_debited, actual_cost,
                )
                await credit_service.record_usage(
                    db,
                    user_id=user.id,
                    message_id=asst_msg.id,
                    model=effective_model,
                    prompt_tokens=pt,
                    completion_tokens=ct,
                    cost_credits=actual_cost,
                )
                await db.commit()
            except Exception as e:
                # Non-fatal accounting error
                yield sse("warn", {"code": "ACCOUNTING_ERROR", "message": str(e)})

        # 10) done
        can_continue = asst_msg.continuation_count < settings.MAX_CONTINUATIONS_PER_MESSAGE
        yield sse("done", {
            "message_id": str(asst_msg.id),
            "citations_count": len(citations),
            "can_continue": can_continue and finish_reason == "length",
            "continuation_count": asst_msg.continuation_count,
        })

    async def continue_stream(
        self,
        session_id: uuid.UUID,
        message_id: Optional[uuid.UUID],
        db: AsyncSession,
        user: Optional[User] = None,
        locale: Optional[str] = None,
        mode: Optional[str] = None,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Continue a truncated assistant response, appending to the existing message."""

        # 1) Load session
        row = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
        session_obj: Optional[ChatSession] = row.scalar_one_or_none()
        if not session_obj:
            yield sse("error", {"code": "SESSION_NOT_FOUND", "message": "Session not found"})
            return

        document_id = session_obj.document_id
        collection_id = getattr(session_obj, "collection_id", None)
        is_collection_session = collection_id is not None and document_id is None

        doc = await db.get(Document, document_id) if document_id else None

        # For collection sessions, load document names
        collection_doc_names: dict[uuid.UUID, str] = {}
        if is_collection_session:
            from app.models.tables import collection_documents as cd_table
            cd_rows = await db.execute(
                select(cd_table.c.document_id).where(cd_table.c.collection_id == collection_id)
            )
            collection_doc_ids = [r[0] for r in cd_rows.all()]
            if collection_doc_ids:
                doc_rows = await db.execute(
                    select(Document.id, Document.filename).where(Document.id.in_(collection_doc_ids))
                )
                for drow in doc_rows.all():
                    collection_doc_names[drow[0]] = drow[1]

        # 2) Load assistant message to continue
        if message_id:
            asst_msg = await db.get(Message, message_id)
        else:
            # Fall back to most recent assistant message in session
            result = await db.execute(
                select(Message)
                .where(Message.session_id == session_id, Message.role == "assistant")
                .order_by(Message.created_at.desc())
                .limit(1)
            )
            asst_msg = result.scalar_one_or_none()

        if not asst_msg or asst_msg.role != "assistant":
            yield sse("error", {"code": "MESSAGE_NOT_FOUND", "message": "Assistant message not found"})
            return

        if asst_msg.session_id != session_id:
            yield sse("error", {"code": "MESSAGE_NOT_FOUND", "message": "Message does not belong to this session"})
            return

        # 3) Check continuation limit
        if asst_msg.continuation_count >= settings.MAX_CONTINUATIONS_PER_MESSAGE:
            yield sse("error", {"code": "CONTINUATION_LIMIT", "message": "Maximum continuations reached"})
            return

        # 4) Resolve mode → model
        effective_mode = mode if mode in settings.MODE_MODELS else "balanced"
        effective_model = settings.MODE_MODELS[effective_mode]

        if user is None and doc and doc.demo_slug:
            effective_model = settings.DEMO_LLM_MODEL
            effective_mode = "quick"

        if effective_mode in settings.PREMIUM_MODES:
            user_plan = (user.plan or "free").lower() if user else "free"
            if user_plan == "free":
                yield sse("error", {"code": "MODE_NOT_ALLOWED", "message": "Upgrade to Plus to use Thorough mode"})
                return

        # 5) Pre-debit credits
        pre_debited = 0
        predebit_ledger_id = None
        if user is not None:
            estimated = credit_service.get_estimated_cost(effective_mode)
            predebit_ledger_id = await credit_service.debit_credits(
                db, user_id=user.id, cost=estimated,
                reason="chat", ref_type="mode", ref_id=effective_mode,
            )
            if predebit_ledger_id:
                pre_debited = estimated
                await db.commit()
            else:
                balance = await credit_service.get_user_credits(db, user.id)
                yield sse("error", {
                    "code": "INSUFFICIENT_CREDITS",
                    "message": "Insufficient credits",
                    "required": estimated,
                    "balance": balance,
                })
                return

        # 6) Reconstruct chunk_map from original citations
        chunk_map: dict[int, _ChunkInfo] = {}
        original_citations = asst_msg.citations or []
        if original_citations:
            chunk_ids_set: set[str] = set()
            ref_to_chunk_id: dict[int, str] = {}
            for cit in original_citations:
                cid = cit.get("chunk_id")
                ref = cit.get("ref_index")
                if cid and ref is not None:
                    chunk_ids_set.add(cid)
                    ref_to_chunk_id[int(ref)] = cid

            if chunk_ids_set:
                chunk_uuids = [uuid.UUID(c) for c in chunk_ids_set]
                chunk_rows = await db.execute(
                    select(Chunk).where(Chunk.id.in_(chunk_uuids))
                )
                chunks_by_id: dict[str, Chunk] = {}
                for ch in chunk_rows.scalars():
                    chunks_by_id[str(ch.id)] = ch

                for ref_num, cid in ref_to_chunk_id.items():
                    ch = chunks_by_id.get(cid)
                    if ch:
                        chunk_map[ref_num] = _ChunkInfo(
                            id=ch.id,
                            page_start=ch.page_start,
                            bboxes=ch.bboxes or [],
                            text=ch.text,
                            section_title=ch.section_title or "",
                            document_id=ch.document_id,
                            document_filename=collection_doc_names.get(ch.document_id, ""),
                        )

        # 7) Load conversation history
        max_turns = int(settings.MAX_CHAT_HISTORY_TURNS or 6)
        max_msgs = max_turns * 2
        msgs_row = await db.execute(
            select(Message)
            .where(Message.session_id == session_id)
            .order_by(Message.created_at.desc())
            .limit(max_msgs + 1)
        )
        history_msgs: List[Message] = list(msgs_row.scalars().all())
        history_msgs.reverse()

        claude_messages: List[dict] = []
        for m in history_msgs:
            claude_messages.append({"role": m.role, "content": m.content})

        # Add continuation prompt
        claude_messages.append({
            "role": "user",
            "content": "Please continue your response from where you left off. Do not repeat what you already said.",
        })

        # 8) Build system prompt with chunk_map context
        numbered_chunks: List[str] = []
        for idx in sorted(chunk_map.keys()):
            info = chunk_map[idx]
            text = (info.text or "")[:1400]
            doc_label = ""
            if is_collection_session and info.document_id:
                fname = collection_doc_names.get(info.document_id, "")
                if fname:
                    doc_label = f"(from: {fname}) "
            numbered_chunks.append(f"[{idx}] {doc_label}{text}")

        rules = get_rules_for_model(
            effective_model, is_collection=is_collection_session
        )

        if is_collection_session:
            doc_list = ", ".join(collection_doc_names.values()) if collection_doc_names else "(no documents)"
            system_prompt = (
                "You are a document analysis assistant. Answer the user's question based on fragments from multiple documents.\n\n"
                f"## Available Documents\n{doc_list}\n\n"
                "## Document Fragments\n"
                + ("\n".join(numbered_chunks) if numbered_chunks else "(none)")
                + "\n\n## Rules\n" + rules
            )
        else:
            system_prompt = (
                "You are a document analysis assistant. Answer the user's question based on the following document fragments.\n\n"
                "## Document Fragments\n"
                + ("\n".join(numbered_chunks) if numbered_chunks else "(none)")
                + "\n\n## Rules\n" + rules
            )

        if doc and doc.custom_instructions:
            system_prompt += (
                "\n## Custom Instructions\n"
                "The user has provided the following custom instructions for this document. Follow them:\n"
                + doc.custom_instructions + "\n"
            )

        # 9) Stream from LLM
        client = _get_openai_client()
        profile = get_model_profile(effective_model)

        if profile.supports_cache_control:
            sys_msg: dict = {
                "role": "system",
                "content": [{"type": "text", "text": system_prompt, "cache_control": {"type": "ephemeral"}}],
            }
        else:
            sys_msg = {"role": "system", "content": system_prompt}
        openai_messages = [sys_msg] + claude_messages

        continuation_text_parts: List[str] = []
        new_citations: List[dict] = []
        fsm = RefParserFSM(chunk_map)
        fsm.char_offset = len(asst_msg.content)  # Offset citations relative to full text

        last_ping = time.monotonic()
        prompt_tokens: Optional[int] = None
        output_tokens: Optional[int] = None
        finish_reason: Optional[str] = None

        try:
            create_kwargs: dict[str, Any] = {
                "model": effective_model,
                "max_tokens": profile.max_tokens,
                "temperature": profile.temperature,
                "messages": openai_messages,
                "stream": True,
            }
            if profile.supports_stream_options:
                create_kwargs["stream_options"] = {"include_usage": True}
            stream = await client.chat.completions.create(**create_kwargs)

            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    text = chunk.choices[0].delta.content
                    for ev in fsm.feed(text):
                        if ev["event"] == "token":
                            continuation_text_parts.append(ev["data"]["text"])
                        elif ev["event"] == "citation":
                            new_citations.append(ev["data"])
                        yield ev

                if chunk.choices and chunk.choices[0].finish_reason:
                    finish_reason = chunk.choices[0].finish_reason

                if hasattr(chunk, "usage") and chunk.usage:
                    prompt_tokens = getattr(chunk.usage, "prompt_tokens", None)
                    output_tokens = getattr(chunk.usage, "completion_tokens", None)

                now = time.monotonic()
                if now - last_ping >= 15.0:
                    yield sse("ping", {})
                    last_ping = now

            for ev in fsm.flush():
                if ev["event"] == "token":
                    continuation_text_parts.append(ev["data"]["text"])
                yield ev

            if finish_reason == "length":
                yield sse("truncated", {"reason": "max_tokens"})

        except Exception as e:
            if user is not None and pre_debited > 0 and predebit_ledger_id is not None:
                try:
                    await db.execute(
                        sa.update(User).where(User.id == user.id)
                        .values(credits_balance=User.credits_balance + pre_debited)
                    )
                    await db.execute(
                        sa.delete(CreditLedger).where(CreditLedger.id == predebit_ledger_id)
                    )
                    await db.commit()
                except Exception:
                    pass
            yield sse("error", {"code": "LLM_ERROR", "message": str(e)})
            return

        # 10) Update existing message (append text, merge citations, bump count)
        continuation_text = "".join(continuation_text_parts)
        try:
            asst_msg.content = (asst_msg.content or "") + continuation_text
            merged_citations = list(asst_msg.citations or []) + new_citations
            asst_msg.citations = merged_citations if merged_citations else None
            asst_msg.continuation_count = (asst_msg.continuation_count or 0) + 1
            asst_msg.output_tokens = (asst_msg.output_tokens or 0) + (int(output_tokens) if output_tokens else 0)
            await db.commit()
        except Exception:
            await db.rollback()
            yield sse("error", {"code": "PERSIST_FAILED", "message": "Failed to save continuation"})
            return

        # Credits: reconcile
        if user is not None and pre_debited > 0 and predebit_ledger_id is not None:
            pt = int(prompt_tokens or 0)
            ct = int(output_tokens or 0)
            try:
                actual_cost = credit_service.calculate_cost(pt, ct, effective_model, mode=effective_mode)
                await credit_service.reconcile_credits(
                    db, user.id, predebit_ledger_id, pre_debited, actual_cost,
                )
                await credit_service.record_usage(
                    db,
                    user_id=user.id,
                    message_id=asst_msg.id,
                    model=effective_model,
                    prompt_tokens=pt,
                    completion_tokens=ct,
                    cost_credits=actual_cost,
                )
                await db.commit()
            except Exception as e:
                yield sse("warn", {"code": "ACCOUNTING_ERROR", "message": str(e)})

        # 11) done
        can_continue = asst_msg.continuation_count < settings.MAX_CONTINUATIONS_PER_MESSAGE
        yield sse("done", {
            "message_id": str(asst_msg.id),
            "citations_count": len(merged_citations) if merged_citations else 0,
            "can_continue": can_continue and finish_reason == "length",
            "continuation_count": asst_msg.continuation_count,
        })


# Singleton service
chat_service = ChatService()
