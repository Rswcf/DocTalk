from __future__ import annotations

import time
import uuid
from dataclasses import dataclass
from typing import Any, AsyncGenerator, Dict, List, Optional

from openai import AsyncOpenAI
from sqlalchemy import asc, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.tables import ChatSession, Message, User
from app.services import credit_service
from app.services.retrieval_service import retrieval_service

# ---------------------------
# SSE Event helpers
# ---------------------------

def sse(event: str, data: Dict[str, Any]) -> Dict[str, Any]:
    return {"event": event, "data": data}


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
                        events.append(
                            sse(
                                "citation",
                                {
                                    "ref_index": ref_num,
                                    "chunk_id": str(chunk.id),
                                    "page": chunk.page_start,
                                    "bboxes": limited_bboxes,
                                    "text_snippet": ((f"{chunk.section_title}: " if chunk.section_title else "") + (chunk.text or ""))[:100],
                                    "offset": self.char_offset,
                                },
                            )
                        )
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
    LOCALE_TO_LANGUAGE = {
        "en": "English",
        "zh": "Chinese (Simplified)",
        "es": "Spanish",
        "fr": "French",
        "de": "German",
    }

    async def chat_stream(
        self,
        session_id: uuid.UUID,
        user_message: str,
        db: AsyncSession,
        model: Optional[str] = None,
        user: Optional[User] = None,
        locale: Optional[str] = None,
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

        # Optional pre-chat credit check
        effective_model = settings.LLM_MODEL
        if model and model in settings.ALLOWED_MODELS:
            effective_model = model

        # Premium model gating: require Plus or Pro plan
        if effective_model in settings.PREMIUM_MODELS:
            user_plan = (user.plan or "free").lower() if user else "free"
            if user_plan == "free":
                yield sse("error", {"code": "MODEL_NOT_ALLOWED", "message": "Upgrade to Plus to use premium models"})
                return

        if user is not None:
            try:
                balance = await credit_service.get_user_credits(db, user.id)
            except Exception:
                balance = 0
            if balance < credit_service.MIN_CREDITS_FOR_CHAT:
                yield sse(
                    "error",
                    {
                        "code": "INSUFFICIENT_CREDITS",
                        "message": "Insufficient credits to start chat",
                        "required": credit_service.MIN_CREDITS_FOR_CHAT,
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
            .order_by(asc(Message.created_at))
        )
        all_msgs: List[Message] = list(msgs_row.scalars())
        history_msgs = all_msgs[-(max_msgs + 1) :]  # include the just-saved user message

        # Convert to Claude message format (excluding system)
        claude_messages: List[dict] = []
        for m in history_msgs:
            claude_messages.append({"role": m.role, "content": m.content})

        # 4) Retrieval (with error handling — e.g. Qdrant down or no vectors yet)
        try:
            retrieved = await retrieval_service.search(user_message, document_id, top_k=8, db=db)
        except Exception as e:
            yield sse("error", {"code": "RETRIEVAL_ERROR", "message": f"文档检索失败: {e}"})
            return

        # 5) Build prompt (system)
        numbered_chunks: List[str] = []
        chunk_map: dict[int, _ChunkInfo] = {}
        for idx, item in enumerate(retrieved, start=1):
            # Heuristic truncation to ~350 tokens (roughly 1200-1400 chars)
            text = item["text"] or ""
            truncated = text[:1400]
            numbered_chunks.append(f"[{idx}] {truncated}")
            chunk_map[idx] = _ChunkInfo(
                id=item["chunk_id"],
                page_start=int(item["page"]),
                bboxes=item.get("bboxes") or [],
                text=text,
                section_title=item.get("section_title") or "",
            )

        language_name = self.LOCALE_TO_LANGUAGE.get(locale or "en", "English")

        system_prompt = (
            "You are a document analysis assistant. Answer the user's question based on the following document fragments.\n"
            f"You MUST respond in {language_name}.\n\n"
            "## Document Fragments\n"
            + ("\n".join(numbered_chunks) if numbered_chunks else "(none)")
            + "\n\n## Rules\n"
            "1. Only answer based on the fragments above. Do not fabricate information.\n"
            "2. After key statements, cite sources with [n] (n = fragment number).\n"
            "3. You may cite multiple fragments, e.g. [1][3].\n"
            "4. If the fragments cannot answer the question, say the information was not found in the document.\n"
            "5. Use Markdown: **bold** for emphasis, bullet lists for multiple points.\n"
            f"6. Your response language MUST be {language_name}.\n"
        )

        # 6) Stream from OpenRouter (OpenAI-compatible)
        client = AsyncOpenAI(
            api_key=settings.OPENROUTER_API_KEY,
            base_url=settings.OPENROUTER_BASE_URL,
            default_headers={
                "HTTP-Referer": settings.FRONTEND_URL,
                "X-Title": "DocTalk",
            },
        )

        # Build OpenAI-format messages (system + history) with cache_control for prompt caching
        openai_messages = [
            {
                "role": "system",
                "content": [
                    {
                        "type": "text",
                        "text": system_prompt,
                        "cache_control": {"type": "ephemeral"},
                    }
                ],
            }
        ] + claude_messages

        assistant_text_parts: List[str] = []
        citations: List[dict] = []
        fsm = RefParserFSM(chunk_map)

        last_ping = time.monotonic()
        prompt_tokens: Optional[int] = None
        output_tokens: Optional[int] = None

        # Validate model selection (already computed above)

        try:
            stream = await client.chat.completions.create(
                model=effective_model,
                max_tokens=2048,
                messages=openai_messages,
                stream=True,
                stream_options={"include_usage": True},
            )

            async for chunk in stream:
                # Extract text delta
                if chunk.choices and chunk.choices[0].delta.content:
                    text = chunk.choices[0].delta.content
                    # 7) Feed FSM and emit events
                    for ev in fsm.feed(text):
                        if ev["event"] == "token":
                            assistant_text_parts.append(ev["data"]["text"])
                        elif ev["event"] == "citation":
                            citations.append(ev["data"])
                        yield ev

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

        except Exception as e:
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

        # Credits: debit after successful chat and record usage
        if user is not None:
            pt = int(prompt_tokens or 0)
            ct = int(output_tokens or 0)
            try:
                cost = credit_service.calculate_cost(pt, ct, effective_model)
                ok = await credit_service.debit_credits(
                    db,
                    user_id=user.id,
                    cost=cost,
                    reason="chat_completion",
                    ref_type="message",
                    ref_id=str(asst_msg.id),
                )
                if ok:
                    await credit_service.record_usage(
                        db,
                        user_id=user.id,
                        message_id=asst_msg.id,
                        model=effective_model,
                        prompt_tokens=pt,
                        completion_tokens=ct,
                        cost_credits=cost,
                    )
                    await db.commit()
                else:
                    # Insufficient at debit time: emit warning event
                    yield sse(
                        "warn",
                        {
                            "code": "DEBIT_FAILED",
                            "message": "Could not debit credits due to low balance",
                            "cost": cost,
                        },
                    )
            except Exception as e:
                # Non-fatal accounting error
                yield sse("warn", {"code": "ACCOUNTING_ERROR", "message": str(e)})

        # 10) done
        yield sse("done", {"message_id": str(asst_msg.id), "citations_count": len(citations)})


# Singleton service
chat_service = ChatService()
