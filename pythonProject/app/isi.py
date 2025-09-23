# app/isi.py
import os, json, uuid
from typing import Tuple, AsyncGenerator, Optional
from aliyunsdkcore.client import AcsClient
from aliyunsdkcore.request import CommonRequest
import websockets

ALIYUN_REGION = os.getenv("ALIYUN_REGION", "cn-shanghai")
ALIYUN_AK_ID = os.getenv("ALIYUN_AK_ID", "")
ALIYUN_AK_SECRET = os.getenv("ALIYUN_AK_SECRET", "")
ISI_APPKEY = os.getenv("ISI_APPKEY", "")
ISI_WS_URL = os.getenv("ISI_WS_URL", "wss://nls-gateway.aliyuncs.com/ws/v1")

def create_isi_token() -> Tuple[str, int]:
    """调用 CreateToken，返回 (token, expireTime)（秒级时间戳）"""
    if not (ALIYUN_AK_ID and ALIYUN_AK_SECRET):
        raise RuntimeError("缺少 ALIYUN_AK_ID / ALIYUN_AK_SECRET")
    client = AcsClient(ALIYUN_AK_ID, ALIYUN_AK_SECRET, ALIYUN_REGION)
    req = CommonRequest()
    req.set_method("POST")
    req.set_domain("nls-meta.cn-shanghai.aliyuncs.com")
    req.set_version("2019-02-28")
    req.set_action_name("CreateToken")
    data = json.loads(client.do_action_with_exception(req))
    return data["Token"]["Id"], int(data["Token"]["ExpireTime"])

async def tts_stream_via_isi(
    text: str,
    token: Optional[str] = None,
    voice: str = "xiaoyun",
    fmt: str = "mp3",
    sample_rate: int = 16000,
) -> AsyncGenerator[bytes, None]:
    """用 ISI 的 WebSocket 协议做流式 TTS，增量产出音频帧。"""
    if not ISI_APPKEY:
        raise RuntimeError("缺少 ISI_APPKEY")
    if not token:
        token, _ = create_isi_token()

    headers = [("X-NLS-Token", token)]
    task_id = uuid.uuid4().hex

    async with websockets.connect(ISI_WS_URL, extra_headers=headers) as ws:
        # StartSynthesis
        await ws.send(json.dumps({
            "header": {
                "message_id": uuid.uuid4().hex,
                "task_id": task_id,
                "namespace": "FlowingSpeechSynthesizer",
                "name": "StartSynthesis",
                "appkey": ISI_APPKEY,
            },
            "payload": {"voice": voice, "format": fmt, "sample_rate": sample_rate}
        }))
        # RunSynthesis
        await ws.send(json.dumps({
            "header": {
                "message_id": uuid.uuid4().hex,
                "task_id": task_id,
                "namespace": "FlowingSpeechSynthesizer",
                "name": "RunSynthesis",
                "appkey": ISI_APPKEY,
            },
            "payload": {"text": text}
        }))
        # StopSynthesis
        await ws.send(json.dumps({
            "header": {
                "message_id": uuid.uuid4().hex,
                "task_id": task_id,
                "namespace": "FlowingSpeechSynthesizer",
                "name": "StopSynthesis",
                "appkey": ISI_APPKEY,
            }
        }))

        # 读取：二进制=音频，文本=事件
        while True:
            msg = await ws.recv()
            if isinstance(msg, (bytes, bytearray)):
                yield bytes(msg)
            else:
                try:
                    ev = json.loads(msg)
                    name = ev.get("header", {}).get("name")
                    if name in ("SynthesisCompleted", "TaskFailed"):
                        break
                except Exception:
                    pass
