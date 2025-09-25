# app/api.py
import json
import os
import time
import base64
import uuid
from typing import Any, AsyncGenerator, Dict, List, Optional
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field

from openai import AsyncOpenAI

from app.db import append_message, get_recent_messages, get_session, create_session
from app.personas import get_persona  # 仍然使用已有的 get_persona
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

# ------------------------
# custom personas persistence
# ------------------------
# 文件存储在 app/custom_personas.json
_CUSTOM_PERSONAS_PATH = Path(__file__).parent / "custom_personas.json"


def _ensure_custom_store():
    if not _CUSTOM_PERSONAS_PATH.exists():
        try:
            _CUSTOM_PERSONAS_PATH.write_text(json.dumps({}), encoding="utf-8")
        except Exception:
            # 忽略写入错误（磁盘只读等），上层会返回错误
            pass


def load_custom_personas() -> Dict[str, Any]:
    """加载所有自定义 personas，返回 dict: slug -> persona dict"""
    _ensure_custom_store()
    try:
        s = _CUSTOM_PERSONAS_PATH.read_text(encoding="utf-8")
        return json.loads(s or "{}")
    except Exception:
        return {}


def save_custom_persona_to_store(slug: str, persona: Dict[str, Any], file_url: Optional[str] = None):
    """把 persona 写入 custom_personas.json（覆盖或新增）"""
    _ensure_custom_store()
    d = load_custom_personas()
    # 保证有 name 与 persona 内容
    entry = dict(persona)
    entry.setdefault("name", persona.get("name", f"custom-{slug}"))
    entry["personaSlug"] = slug
    if file_url:
        entry["file"] = file_url
    d[slug] = entry
    _CUSTOM_PERSONAS_PATH.write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8")


# -----------------------
# 请求/返回模型
# -----------------------
class CreateSessionBody(BaseModel):
    personaSlug: Optional[str] = Field(default=None)


class ChatBody(BaseModel):
    sessionId: str
    userMessage: str
    personaSlug: Optional[str] = None


class TtsReq(BaseModel):
    text: str
    voice: Optional[str] = "xiaoyun"
    format: Optional[str] = "mp3"        # mp3/wav/pcm
    sample_rate: Optional[int] = 16000
    token: Optional[str] = None


# ========================
# 会话管理
# ========================
@router.post("/session")
async def create_session_route(body: CreateSessionBody):
    """创建会话，返回 sessionId（不调用大模型，不计费）"""
    sid = create_session(body.personaSlug)
    return JSONResponse({"sessionId": sid})


# ========================
# 文本聊天（SSE 流式）
# ========================
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

    # 若 personaSlug 指定则以其为准，否则取 session 中的 persona_slug
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


# ========================
# 新增：自定义 persona 的保存与列出接口
# ========================
class CustomPersonaReq(BaseModel):
    persona: Dict[str, Any]
    image_data_url: Optional[str] = None  # 可传 data:image/... 或 URL


@router.post("/persona/custom")
async def create_custom_persona(body: CustomPersonaReq):
    """
    前端创建自定义 persona 的接口。
    请求体: { persona: {...}, image_data_url?: "data:..." | "https://..." }
    返回: { slug: "...", file: "...", name: "展示名" }
    - 当前实现会将 persona 存到 app/custom_personas.json，并返回 slug。
    - 如果传入 image_data_url，会原样放回到返回的 file 字段（前端可直接用作 img src）。
    - 可扩展：将 dataURL 解码保存成静态文件并返回静态 URL（见注释）。
    """
    persona = body.persona or {}
    image_data_url = body.image_data_url

    # 简单校验
    if not isinstance(persona, dict):
        raise HTTPException(status_code=400, detail="persona 必须是对象")

    # 生成唯一 slug（允许前端传 slug）
    slug_candidate = persona.get("slug") or persona.get("personaSlug") or f"custom-{int(time.time())}-{uuid.uuid4().hex[:6]}"
    slug = slug_candidate.replace(" ", "-").lower()

    # 如果已存在，则覆盖（可根据需求改为返回错误）
    try:
        # 如果 image_data_url 是 data: 开头，并且你希望把图片保存为静态文件，可在这里解码并写入磁盘，然后把 file_url 改为静态文件路径。
        # 例如（可选代码，需启用并确保 static 目录对外可访问）：
        #
        # if image_data_url and image_data_url.startswith("data:"):
        #     header, b64 = image_data_url.split(",", 1)
        #     ext = "png"
        #     if header.startswith("data:image/"):
        #         ext = header.split("/")[1].split(";")[0]
        #     uploads_dir = Path(__file__).parent.parent / "static" / "uploads"
        #     uploads_dir.mkdir(parents=True, exist_ok=True)
        #     filename = f"{slug}.{ext}"
        #     filepath = uploads_dir / filename
        #     with open(filepath, "wb") as f:
        #         f.write(base64.b64decode(b64))
        #     file_url = f"/static/uploads/{filename}"
        # else:
        #     file_url = image_data_url or None

        # 在当前实现中，我们直接把 image_data_url 原样保存并返回（前端可以直接使用 dataURL 显示）
        file_url = image_data_url or None

        # 保存 persona 到本地文件存储
        save_custom_persona_to_store(slug, persona, file_url=file_url)

        # 尝试让 app.personas 模块刷新/注册该 persona（可选）
        try:
            import app.personas as personas_module
            # 若 personas.py 提供了 reload_custom_personas 或 register_custom_persona，调用之
            if hasattr(personas_module, "reload_custom_personas"):
                try:
                    personas_module.reload_custom_personas()
                except Exception:
                    # 忽略 reload 的错误（以免阻塞创建）
                    pass
            elif hasattr(personas_module, "register_custom_persona"):
                try:
                    personas_module.register_custom_persona(slug, save_custom_persona_to_store)  # signature depends on impl
                except Exception:
                    pass
        except Exception:
            # 忽略无法通知 personas 模块的情况；chat_route 仍可通过 get_persona(slug) 读取预置逻辑
            pass

        return JSONResponse({"slug": slug, "file": file_url, "name": persona.get("name") or persona.get("displayName") or slug})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/persona/custom")
async def list_custom_personas_route():
    """列出后台已保存的自定义 personas（用于前端展示/管理）"""
    try:
        d = load_custom_personas()
        # 返回列表
        arr = list(d.values())
        return JSONResponse({"list": arr})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ========================
# debug / routes listing
# ========================
print("[api routes]", [getattr(r, "path", "") for r in router.routes])
