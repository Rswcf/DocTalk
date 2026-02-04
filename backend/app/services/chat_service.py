from __future__ import annotations

import asyncio
import time
import uuid
from dataclasses import dataclass
from typing import Any, AsyncGenerator, Dict, List, Optional

from anthropic import AsyncAnthropic
from sqlalchemy import asc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.tables import ChatSession, Message
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
                        events.append(
                            sse(
                                "citation",
                                {
                                    "ref_index": ref_num,
                                    "chunk_id": str(chunk.id),
                                    "page": chunk.page_start,
                                    "bboxes": chunk.bboxes,
                                    "text_snippet": (chunk.text or "")[:80],
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
    async def chat_stream(
        self, session_id: uuid.UUID, user_message: str, db: AsyncSession
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

        # 2) Save user message
        user_msg = Message(session_id=session_id, role="user", content=user_message)
        db.add(user_msg)
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

        # 4) Retrieval
        retrieved = await retrieval_service.search(user_message, document_id, top_k=5, db=db)

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
            )

        system_prompt = (
            "你是一个文档分析助手。基于以下文档片段回答用户问题。\n\n"
            "## 文档片段\n"
            + ("\n".join(numbered_chunks) if numbered_chunks else "(无)")
            + "\n\n## 规则\n"
            "1. 只基于以上片段回答，不要编造信息。\n"
            "2. 在关键论述后用 [n] 标注引用来源（n 为片段编号）。\n"
            "3. 可以引用多个片段，如 [1][3]。\n"
            "4. 如果以上片段无法回答问题，直接说文档中未找到相关信息。\n\n"
            "## 示例\n"
            "用户：2023年毛利率是多少？\n"
            "助手：根据财报数据，2023年公司整体毛利率为35.2%[2]，较上年同期提升2.1个百分点。\n"
        )

        # 6) Stream from Anthropic
        client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

        assistant_text_parts: List[str] = []
        citations: List[dict] = []
        fsm = RefParserFSM(chunk_map)

        last_ping = time.monotonic()

        try:
            async with client.messages.stream(
                model=settings.LLM_MODEL,
                max_tokens=2048,
                system=system_prompt,
                messages=claude_messages,
            ) as stream:
                async for text in stream.text_stream:
                    # 7) Feed FSM and emit events
                    for ev in fsm.feed(text):
                        if ev["event"] == "token":
                            assistant_text_parts.append(ev["data"]["text"])
                        elif ev["event"] == "citation":
                            citations.append(ev["data"])  # already serializable
                        yield ev

                    # 8) Ping every 15 seconds
                    now = time.monotonic()
                    if now - last_ping >= 15.0:
                        yield sse("ping", {})
                        last_ping = now

                # Flush at stream end
                for ev in fsm.flush():
                    if ev["event"] == "token":
                        assistant_text_parts.append(ev["data"]["text"])
                    yield ev

                final_message = await stream.get_final_message()
                usage = getattr(final_message, "usage", None)
                prompt_tokens = getattr(usage, "input_tokens", None) if usage else None
                output_tokens = getattr(usage, "output_tokens", None) if usage else None

        except Exception as e:
            # Surface error and stop
            yield sse("error", {"code": "LLM_ERROR", "message": str(e)})
            return

        # 9) Save assistant message + citations
        assistant_text = "".join(assistant_text_parts)
        asst_msg = Message(
            session_id=session_id,
            role="assistant",
            content=assistant_text,
            citations=citations or None,
            prompt_tokens=int(prompt_tokens) if "prompt_tokens" in locals() and prompt_tokens is not None else None,
            output_tokens=int(output_tokens) if "output_tokens" in locals() and output_tokens is not None else None,
        )
        db.add(asst_msg)
        await db.commit()

        # 10) done
        yield sse("done", {"message_id": str(asst_msg.id), "citations_count": len(citations)})


# Singleton service
chat_service = ChatService()

