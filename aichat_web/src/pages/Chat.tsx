// src/pages/Chat.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getPromoBySlug } from "../promos";
import { createSession, streamChat, ttsToBlob } from "../api";
import { beginVoiceCapture } from "../mic";

type BaseMsg = { role: "user" | "assistant"; ts: number };
type TextMsg = BaseMsg & { kind: "text"; content: string; audioUrl?: string };
type VoiceMsg = BaseMsg & { kind: "voice"; audioUrl: string; asr?: string };
type ChatMsg = TextMsg | VoiceMsg;

function ToggleSidebarButton({
  open, onToggle, inline = false,
}: { open: boolean; onToggle: () => void; inline?: boolean }) {
  const cls = inline
    ? "ml-auto w-8 h-8 rounded-md border bg-white/90 backdrop-blur shadow hover:bg-white transition flex items-center justify-center"
    : "fixed left-2 top-[72px] z-50 w-8 h-8 rounded-md border bg-white/90 backdrop-blur shadow hover:bg-white transition flex items-center justify-center";
  return (
    <button aria-label={open ? "收起侧边栏" : "展开侧边栏"} title={open ? "收起侧边栏" : "展开侧边栏"} onClick={onToggle} className={cls}>
      <svg viewBox="0 0 24 24" className="w-5 h-5 opacity-80">
        {open ? (
          <g fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="4" y="4" width="16" height="16" rx="3" />
            <rect x="6.5" y="6.5" width="3" height="11" rx="1.2" />
            <rect x="11.5" y="6.5" width="6" height="11" rx="1.6" opacity=".6" />
          </g>
        ) : (
          <g fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="4" y="4" width="16" height="16" rx="3" />
            <rect x="6.5" y="6.5" width="3" height="11" rx="1.2" />
          </g>
        )}
      </svg>
    </button>
  );
}

export default function ChatPage() {
  const { promoSlug } = useParams();
  const navigate = useNavigate();
  const promo = getPromoBySlug(promoSlug);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [recording, setRecording] = useState(false);
  const stopCaptureRef = useRef<null | (() => Promise<{ blob: Blob; asr: string }>)>(null);

  const [userAvatar, setUserAvatar] = useState<string>(localStorage.getItem("user_avatar") || "/imgs/moren.jpg");
  useEffect(() => {
    const onChanged = () => setUserAvatar(localStorage.getItem("user_avatar") || "/imgs/moren.jpg");
    window.addEventListener("avatar-changed", onChanged as any);
    return () => window.removeEventListener("avatar-changed", onChanged as any);
  }, []);

  const [sideOpen, setSideOpen] = useState<boolean>(() => localStorage.getItem("chat_sidebar_open") !== "0");
  useEffect(() => { localStorage.setItem("chat_sidebar_open", sideOpen ? "1" : "0"); }, [sideOpen]);

  const players = useRef<Record<string, HTMLAudioElement>>({});
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const storageKey = `rp_session_${promo.personaSlug}`;
  useEffect(() => {
    (async () => {
      const saved = localStorage.getItem(storageKey);
      if (saved) setSessionId(saved);
      else {
        const id = await createSession(promo.personaSlug);
        localStorage.setItem(storageKey, id);
        setSessionId(id);
      }
    })();
  }, [promo.personaSlug]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  function togglePlay(id: string, url: string) {
    if (!url) return;
    let audio = players.current[id];
    if (!audio) { audio = new Audio(url); players.current[id] = audio; }
    if (audio.paused) audio.play(); else audio.pause();
  }

  async function sendText(text: string) {
    if (!sessionId || !text.trim()) return;
    setMessages((p) => [...p, { role: "user", kind: "text", content: text.trim(), ts: Date.now() }]);
    setInput("");
    setLoading(true);
    const ac = new AbortController();
    abortRef.current = ac;

    let assistant = "";
    setMessages((p) => [...p, { role: "assistant", kind: "text", content: "", ts: Date.now() } as TextMsg]);

    try {
      await streamChat({
        sessionId,
        userMessage: text.trim(),
        personaSlug: promo.personaSlug,
        onDelta: (d) => {
          assistant += d;
          setMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = { ...(copy[copy.length - 1] as TextMsg), content: assistant } as TextMsg;
            return copy;
          });
        },
        signal: ac.signal,
      });
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  async function onMicClick() {
    if (!sessionId) return;

    if (!recording) {
      try {
        const stop = await beginVoiceCapture();
        stopCaptureRef.current = stop;
        setRecording(true);
      } catch {
        alert("无法开始录音，请检查麦克风权限。");
      }
      return;
    }

    setRecording(false);
    const stop = stopCaptureRef.current;
    stopCaptureRef.current = null;
    if (!stop) return;

    const { blob, asr } = await stop();
    const url = URL.createObjectURL(blob);

    setMessages((p) => [...p, { role: "user", kind: "voice", audioUrl: url, asr, ts: Date.now() }]);

    setMessages((p) => [...p, { role: "assistant", kind: "text", content: "", ts: Date.now() } as TextMsg]);

    const promptForLLM =
      asr && asr.trim()
        ? asr.trim()
        : "（用户刚刚发送了一段语音，请结合上下文自然回复，不必提及“语音”二字。）";

    const ac = new AbortController();
    abortRef.current = ac;

    let assistantText = "";
    setLoading(true);
    try {
      await streamChat({
        sessionId,
        userMessage: promptForLLM,
        personaSlug: promo.personaSlug,
        onDelta: (d) => {
          assistantText += d;
          setMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = { ...(copy[copy.length - 1] as TextMsg), content: assistantText } as TextMsg;
            return copy;
          });
        },
        signal: ac.signal,
      });
    } finally {
      setLoading(false);
      abortRef.current = null;
    }

    if (assistantText.trim()) {
      try {
        const ttsBlob = await ttsToBlob(assistantText, { format: "mp3" });
        const aUrl = URL.createObjectURL(ttsBlob);
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1] as TextMsg;
          copy[copy.length - 1] = { ...last, audioUrl: aUrl };
          return copy;
        });
      } catch { /* 保留文本即可 */ }
    }
  }

  async function newChat() {
    const id = await createSession(promo.personaSlug);
    localStorage.setItem(storageKey, id);
    setSessionId(id);
    setMessages([]);
  }

  return (
    <div className="h-screen overflow-hidden relative bg-gradient-to-b from-white via-[#f7fbff] to-white">
      <header className="h-12 z-30 bg-white/70 backdrop-blur border-b">
        <div className="mx-auto w-11/12 max-w-7xl h-full flex items-center justify-between">
          <Link to="/" className="text-sm text-gray-700 hover:underline">← 返回首页</Link>
          <div className="font-semibold">{promo.name} · 对话</div>
          <div className="text-sm text-gray-500" />
        </div>
      </header>

      <aside
        className={`fixed top-12 bottom-0 left-0 z-40 w-72 bg-white/90 backdrop-blur border-r
          transition-transform duration-300 ${sideOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="h-full flex flex-col">
          <div className="p-3">
            <button onClick={newChat} className="w-full rounded-lg bg-indigo-600 text-white py-2 shadow hover:shadow-md">
              新建聊天
            </button>
          </div>
          <div className="px-3 text-sm text-gray-500">暂无历史聊天</div>
          <div className="mt-auto border-t p-3 flex items-center gap-2">
            <img src={userAvatar} className="w-8 h-8 rounded-full object-cover border" alt="me" />
            <button onClick={() => navigate("/me")} className="text-sm text-gray-700 hover:text-indigo-600">我的</button>
            <ToggleSidebarButton open={sideOpen} onToggle={() => setSideOpen(o => !o)} inline />
          </div>
        </div>
      </aside>

      {!sideOpen && <ToggleSidebarButton open={sideOpen} onToggle={() => setSideOpen(true)} />}

      <main
        className={`h-[calc(100vh-48px)] overflow-hidden px-4 md:px-6 transition-[margin-left] duration-300 ${
          sideOpen ? "md:ml-72" : "md:ml-0"
        }`}
      >
        {/* 关键：min-h-0 允许内部滚动容器真正滚动 */}
        <div className="mx-auto h-full w-11/12 md:w-5/6 lg:w-2/3 xl:w-3/5 max-w-5xl">
          <div className="h-full rounded-3xl border border-white/50 bg-transparent shadow-xl overflow-hidden flex flex-col min-h-0">
            <section className="relative flex-1 min-h-0">
              {/* 背景层降到负 z-index + 禁用指针事件，避免遮挡和“放大”错觉 */}
              <div
                className="absolute inset-0 -z-10 pointer-events-none bg-center bg-cover"
                style={{ backgroundImage: `url(${promo.file})` }}
              />
              {/* 可选：轻微遮罩提高对比度 */}
              <div className="absolute inset-0 -z-10 pointer-events-none bg-white/10" />

              {/* 真正滚动的地方：放到更高层级 */}
              <div className="relative z-10 h-full p-4 overflow-y-auto">
                {messages.map((m, i) => {
                  const isUser = m.role === "user";
                  const id = `msg-${i}`;
                  return (
                    <div key={id} className={`my-3 flex items-end gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
                      {!isUser && <img src={promo.file} alt="ai" className="w-8 h-8 rounded-full object-cover shadow" />}
                      <div
                        className={`max-w-[78%] px-3 py-2 rounded-2xl whitespace-pre-wrap ${
                          isUser ? "bg-white text-gray-900 border rounded-br-sm" : "bg-black text-white rounded-bl-sm"
                        }`}
                      >
                        {m.kind === "voice" && (
                          <button
                            onClick={() => togglePlay(id, m.audioUrl)}
                            className={`w-full text-left rounded-lg border px-3 py-2 ${
                              isUser ? "border-gray-300 text-gray-900" : "border-white/40 text-white"
                            }`}
                          >
                            ▶︎ {isUser ? "我的语音" : "语音播放"}
                          </button>
                        )}
                        {m.kind === "text" && m.audioUrl && (
                          <>
                            <button
                              onClick={() => togglePlay(id, m.audioUrl!)}
                              className={`mb-2 w-full text-left rounded-lg border px-3 py-2 ${
                                isUser ? "border-gray-300 text-gray-900" : "border-white/40 text-white"
                              }`}
                            >
                              ▶︎ 语音播放
                            </button>
                            <div>{m.content || "…"}</div>
                          </>
                        )}
                        {m.kind === "text" && !m.audioUrl && <div>{m.content || "…"}</div>}
                      </div>
                      {isUser && <img src={userAvatar} alt="me" className="w-8 h-8 rounded-full object-cover shadow" />}
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
            </section>

            <div className="border-t bg-white/85 backdrop-blur p-3">
              <div className="flex gap-2 items-center">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendText(input);
                    }
                  }}
                  placeholder={`对「${promo.name}」说点什么… 回车发送`}
                  className="flex-1 border rounded px-3 py-2 bg-white/90"
                />
                <button
                  onClick={() => sendText(input)}
                  disabled={loading || !input.trim()}
                  className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
                >
                  发送
                </button>
                <button
                  onClick={onMicClick}
                  className={`px-3 py-2 rounded border ${recording ? "border-red-500 text-red-600" : ""}`}
                  title={recording ? "结束并发送语音" : "语音输入（点击开始，再次点击结束）"}
                >
                  {recording ? "● 录音中" : "🎙️"}
                </button>
                {loading && (
                  <button onClick={() => abortRef.current?.abort()} className="px-3 py-2 rounded border">
                    停止
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
