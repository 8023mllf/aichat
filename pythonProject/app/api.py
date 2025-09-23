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

from app.isi import create_isi_token, tts_stream_via_isi

DASH_BASE_URL = os.getenv("DASH_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1")
API_KEY = os.getenv("DASHSCOPE_API_KEY")
MODEL_NAME = os.getenv("MODEL_NAME", "qwen-plus")
MAX_CONTEXT_MESSAGES = 30

if not API_KEY:
    raise RuntimeError("缺少 DASHSCOPE_API_KEY，请在 .env 或系统变量中设置。")

client = AsyncOpenAI(api_key=API_KEY, base_url=DASH_BASE_URL)

router = APIRouter(prefix="/api", tags=["api"])
print("[api loaded from]", __file__)


# ========================
# 会话管理
# ========================
class CreateSessionBody(BaseModel):
    personaSlug: Optional[str] = Field(default=None)

@router.post("/session")
async def create_session_route(body: CreateSessionBody):
    """创建会话，返回 sessionId（不调用大模型，不计费）"""
    sid = create_session(body.personaSlug)
    return JSONResponse({"sessionId": sid})

# ========================
# 文本聊天（SSE 流式）
# ========================
class ChatBody(BaseModel):
    sessionId: str
    userMessage: str
    personaSlug: Optional[str] = None

@router.post("/chat")
async def chat_route(body: ChatBody):
    """向指定会话发送一条消息，流式返回大模型回复（会计费）"""
    session = get_session(body.sessionId)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")

    user_text = (body.userMessage or "").strip()
    if not user_text:
        raise HTTPException(status_code=400, detail="userMessage 不能为空")

    append_message(body.sessionId, "user", user_text)

    persona = get_persona(body.personaSlug or session["persona_slug"])
    recent = get_recent_messages(body.sessionId, MAX_CONTEXT_MESSAGES)

    messages: List[Dict[str, str]] = [
        {"role": "system", "content": persona.get("systemPrompt", f"你是{persona.get('name','助手')}。")},
        *recent,
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

# ========================
# 语音相关接口
# ========================
@router.get("/isi/token")
def issue_isi_token():
    """签发阿里云 ISI 的短期 Token"""
    try:
        token, expire = create_isi_token()
        return {
            "token": token,
            "expireTime": expire,
            "appkey": os.getenv("ISI_APPKEY", ""),
            "wsUrl": os.getenv("ISI_WS_URL", "wss://nls-gateway.aliyuncs.com/ws/v1"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class TtsReq(BaseModel):
    text: str
    voice: Optional[str] = "xiaoyun"
    format: Optional[str] = "mp3"        # mp3/wav/pcm
    sample_rate: Optional[int] = 16000
    token: Optional[str] = None

@router.post("/voice/tts")
async def tts_endpoint(body: TtsReq):
    """语音合成（后端代理）：把文本转换为音频流返回"""
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="text 不能为空")
    gen = tts_stream_via_isi(
        text=body.text,
        token=body.token,
        voice=body.voice or "xiaoyun",
        fmt=body.format or "mp3",
        sample_rate=body.sample_rate or 16000,
    )
    media_type = "audio/mpeg" if (body.format or "mp3") == "mp3" else "audio/wav"
    return StreamingResponse(gen, media_type=media_type)

print("[api routes]", [getattr(r, "path", "") for r in router.routes])
