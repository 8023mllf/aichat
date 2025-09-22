# app/api.py
import json
import os
from typing import Any, AsyncGenerator, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse

from openai import AsyncOpenAI
from pydantic import BaseModel, Field

from app.db import append_message, get_recent_messages, get_session, create_session
from app.personas import get_persona


DASH_BASE_URL = os.getenv("DASH_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1")
API_KEY = os.getenv("DASHSCOPE_API_KEY")
MODEL_NAME = os.getenv("MODEL_NAME", "qwen-plus")
MAX_CONTEXT_MESSAGES = 30

if not API_KEY:
    raise RuntimeError("缺少 DASHSCOPE_API_KEY，请在 .env 或系统变量中设置。")

client = AsyncOpenAI(api_key=API_KEY, base_url=DASH_BASE_URL)

router = APIRouter(prefix="/api", tags=["api"])

class CreateSessionBody(BaseModel):
    personaSlug: Optional[str] = Field(default=None)

@router.post("/session")
async def create_session_route(body: CreateSessionBody):
    sid = create_session(body.personaSlug)
    return JSONResponse({"sessionId": sid})

class ChatBody(BaseModel):
    sessionId: str
    userMessage: str
    personaSlug: Optional[str] = None

@router.post("/chat")
async def chat_route(body: ChatBody):
    session = get_session(body.sessionId)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")

    user_text = (body.userMessage or "").strip()
    if not user_text:
        raise HTTPException(status_code=400, detail="userMessage 不能为空")

    # 先落库用户消息，保证掉线也能恢复
    append_message(body.sessionId, "user", user_text)

    persona = get_persona(body.personaSlug or session["persona_slug"])
    recent = get_recent_messages(body.sessionId, MAX_CONTEXT_MESSAGES)

    # 拼装 messages（可以把 session['summary'] 作为额外 system 注入，后续再加摘要）
    messages: List[Dict[str, str]] = [
        {"role": "system", "content": persona["systemPrompt"]},
        *recent,  # recent 已包含历史 user/assistant
        {"role": "user", "content": user_text},
    ]

    async def event_stream() -> AsyncGenerator[bytes, None]:
        assistant_text = ""
        try:
            stream = await client.chat.completions.create(
                model=MODEL_NAME,
                stream=True,
                messages=messages,  # type: ignore
            )
            async for chunk in stream:
                delta = chunk.choices[0].delta.content or ""
                if delta:
                    assistant_text += delta
                    yield f"data: {json.dumps({'delta': delta})}\n\n".encode("utf-8")
        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n".encode("utf-8")
        finally:
            # 结束事件
            yield b"data: {\"done\": true}\n\n"
            if assistant_text.strip():
                append_message(body.sessionId, "assistant", assistant_text.strip())

    headers = {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    return StreamingResponse(event_stream(), headers=headers)
