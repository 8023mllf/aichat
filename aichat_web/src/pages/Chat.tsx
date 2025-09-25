import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getPromoBySlug } from "../promos";
import { createSession, streamChat, ttsToBlob } from "../api";
import { AudioQueue } from "../audioQueue";
import { isSpeechSupported, startSpeechOnce } from "../mic";

type Msg = { role: "user" | "assistant"; content: string };

/* 收起/展开侧栏的小方框按钮（支持内联/浮动两种模式） */
function ToggleSidebarButton({
  open,
  onToggle,
  inline = false,
}: {
  open: boolean;
  onToggle: () => void;
  inline?: boolean;
}) {
  const cls = inline
    ? "ml-auto w-8 h-8 rounded-md border bg-white/90 backdrop-blur shadow hover:bg-white transition flex items-center justify-center"
    : "fixed left-2 top-[72px] z-50 w-8 h-8 rounded-md border bg-white/90 backdrop-blur shadow hover:bg-white transition flex items-center justify-center";
  return (
    <button
      aria-label={open ? "收起侧边栏" : "展开侧边栏"}
      title={open ? "收起侧边栏" : "展开侧边栏"}
      onClick={onToggle}
      className={cls}
    >
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
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  // 用户头像（默认 moren.jpg，可在“我的”更换）
  const [userAvatar, setUserAvatar] = useState<string>(
    localStorage.getItem("user_avatar") || "/imgs/moren.jpg"
  );
  useEffect(() => {
    const onChanged = () => setUserAvatar(localStorage.getItem("user_avatar") || "/imgs/moren.jpg");
    window.addEventListener("avatar-changed", onChanged as any);
    return () => window.removeEventListener("avatar-changed", onChanged as any);
  }, []);

  // 侧栏显示/隐藏（记住状态）
  const [sideOpen, setSideOpen] = useState<boolean>(() => {
    return localStorage.getItem("chat_sidebar_open") !== "0";
  });
  useEffect(() => {
    localStorage.setItem("chat_sidebar_open", sideOpen ? "1" : "0");
  }, [sideOpen]);

  // 音频 & 中止
  const audioQ = useMemo(() => new AudioQueue(), []);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 每个人格独立 session
  const storageKey = `rp_session_${promo.personaSlug}`;
  useEffect(() => {
    (async () => {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setSessionId(saved);
      } else {
        const id = await createSession(promo.personaSlug);
        localStorage.setItem(storageKey, id);
        setSessionId(id);
      }
    })();
  }, [promo.personaSlug]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendText(text: string) {
    if (!sessionId || !text.trim()) return;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    const ac = new AbortController();
    abortRef.current = ac;

    let assistant = "";
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
    const idx = messages.length + 1;

    try {
      await streamChat({
        sessionId,
        userMessage: text,
        personaSlug: promo.personaSlug,
        onDelta: (d) => {
          assistant += d;
          setMessages((prev) => {
            const copy = [...prev];
            copy[idx] = { role: "assistant", content: assistant };
            return copy;
          });
        },
        signal: ac.signal,
      });
    } finally {
      setLoading(false);
      abortRef.current = null;
      if (assistant.trim()) {
        setSpeaking(true);
        const blob = await ttsToBlob(assistant, { format: "mp3" });
        await audioQ.enqueue(blob);
        setSpeaking(false);
      }
    }
  }

  async function handleMic() {
    if (!isSpeechSupported()) { alert("当前浏览器不支持语音识别（Web Speech API）。"); return; }
    try {
      const text = await startSpeechOnce("zh-CN");
      setInput(text);
    } catch (e: any) { alert("语音识别失败：" + String(e)); }
  }

  // 新建聊天
  async function newChat() {
    const id = await createSession(promo.personaSlug);
    localStorage.setItem(storageKey, id);
    setSessionId(id);
    setMessages([]);
  }

  return (
    // 整页高度锁定 + 禁止纵向滚动
    <div className="h-screen overflow-hidden relative bg-gradient-to-b from-white via-[#f7fbff] to-white">
      {/* 顶部栏固定高度 48px */}
      <header className="h-12 z-30 bg-white/70 backdrop-blur border-b">
        <div className="mx-auto w-11/12 max-w-7xl h-full flex items-center justify-between">
          <Link to="/" className="text-sm text-gray-700 hover:underline">← 返回首页</Link>
          <div className="font-semibold">{promo.name} · 对话</div>
          <div className="text-sm text-gray-500">{speaking ? "🔊 播放中…" : ""}</div>
        </div>
      </header>

      {/* 左侧侧边栏（固定） */}
      <aside
        className={`fixed top-12 bottom-0 left-0 z-40 w-72 bg-white/90 backdrop-blur border-r
          transition-transform duration-300 ${sideOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="h-full flex flex-col">
          <div className="p-3">
            <button
              onClick={newChat}
              className="w-full rounded-lg bg-indigo-600 text-white py-2 shadow hover:shadow-md"
            >
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

      {/* 侧栏收起时的浮动展开按钮 */}
      {!sideOpen && <ToggleSidebarButton open={sideOpen} onToggle={() => setSideOpen(true)} />}

      {/* 主体：高度 = 视口 - 顶部栏；禁止自身滚动，内部卡片滚动 */}
      <main
        className={`h-[calc(100vh-48px)] overflow-hidden px-4 md:px-6 transition-[margin-left] duration-300 ${
          sideOpen ? "md:ml-72" : "md:ml-0"
        }`}
      >
        {/* 对话卡片更宽：md 5/6、lg 2/3、xl 3/5；并且高撑满 main */}
        <div className="mx-auto h-full w-11/12 md:w-5/6 lg:w-2/3 xl:w-3/5 max-w-5xl">
          <div className="h-full rounded-3xl border border-white/50 bg-transparent shadow-xl overflow-hidden flex flex-col">
            {/* 上半：消息区域（填满剩余高度，内部滚动） */}
            <section className="relative flex-1">
              {/* 背景图固定 + 轻薄遮罩 */}
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `url(${promo.file})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
              {/* 消息列表：真正滚动的地方 */}
              <div className="relative h-full p-4 overflow-y-auto">
                {messages.map((m, i) => {
                  const isUser = m.role === "user";
                  return (
                    <div key={i} className={`my-3 flex items-end gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
                      {!isUser && (
                        <img src={promo.file} alt="ai" className="w-8 h-8 rounded-full object-cover shadow" />
                      )}
                      <div
                        className={`max-w-[78%] px-3 py-2 rounded-2xl whitespace-pre-wrap ${
                          isUser ? "bg-white text-gray-900 border rounded-br-sm" : "bg-black text-white rounded-bl-sm"
                        }`}
                      >
                        {m.content}
                      </div>
                      {isUser && (
                        <img src={userAvatar} alt="me" className="w-8 h-8 rounded-full object-cover shadow" />
                      )}
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
            </section>

            {/* 下半：输入条（始终可见，贴住卡片底部） */}
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
                <button onClick={handleMic} className="px-3 py-2 rounded border" title="语音识别（实验）">
                  🎙️
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
