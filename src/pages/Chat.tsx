import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getPromoBySlug } from "../promos";
import { createSession, streamChat, ttsToBlob } from "../api";
import { AudioQueue } from "../audioQueue";
import { isSpeechSupported, startSpeechOnce } from "../mic";

type Msg = { role: "user" | "assistant"; content: string };
const WRAPPER = "w-11/12 md:w-4/5 lg:w-3/4 mx-auto";

export default function Chat() {
  const { promoSlug } = useParams();
  const promo = getPromoBySlug(promoSlug);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const audioQ = useMemo(()=>new AudioQueue(),[]);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 每个人格独立会话：localStorage key 带 persona
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

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function sendText(text: string) {
    if (!sessionId || !text.trim()) return;
    setMessages(prev => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    const ac = new AbortController();
    abortRef.current = ac;

    let assistant = "";
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);
    const idx = messages.length + 1;

    try {
      await streamChat({
        sessionId, userMessage: text, personaSlug: promo.personaSlug,
        onDelta: (d) => {
          assistant += d;
          setMessages(prev => {
            const copy = [...prev];
            copy[idx] = { role: "assistant", content: assistant };
            return copy;
          });
        },
        signal: ac.signal
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
    } catch (e:any) { alert("语音识别失败：" + String(e)); }
  }

  return (
    <div
      className="min-h-screen relative"
      style={{
        backgroundImage: `url(${promo.file})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      {/* 背景遮罩，提升可读性 */}
      <div className="absolute inset-0 bg-white/55 backdrop-blur-sm" />

      <div className="relative">
        <header className={`${WRAPPER} py-4`}>
          <div className="flex items-center justify-between">
            <Link to="/" className="text-sm text-gray-700 hover:underline">← 返回首页</Link>
            <h1 className="text-xl font-semibold">{promo.name} · 对话</h1>
            <div className="text-sm text-gray-600">{speaking ? "🔊 播放中…" : ""}</div>
          </div>
        </header>

        <main className={`${WRAPPER} pb-12`}>
          <div className="rounded-3xl border border-white/40 bg-white/75 backdrop-blur shadow-xl overflow-hidden">
            {/* 对话主体 */}
            <section className="p-4 md:p-6">
              <div className="bg-white/90 border rounded-xl p-4 h-[64vh] md:h-[68vh] overflow-auto">
                {messages.map((m, i) => (
                  <div key={i} className={`my-3 flex ${m.role==="user" ? "justify-end": "justify-start"}`}>
                    <div className={`max-w-[80%] px-3 py-2 rounded-2xl whitespace-pre-wrap 
                        ${m.role==="user" ? "bg-blue-600 text-white rounded-br-sm" : "bg-gray-100 text-gray-900 rounded-bl-sm"}`}>
                      {m.content}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              <div className="mt-4 flex gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e=>setInput(e.target.value)}
                  onKeyDown={e=>{ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); sendText(input); }}}
                  placeholder={`对「${promo.name}」说点什么… 回车发送`}
                  className="flex-1 border rounded px-3 py-2"
                />
                <button
                  onClick={()=>sendText(input)}
                  disabled={loading || !input.trim()}
                  className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
                >发送</button>
                <button
                  onClick={handleMic}
                  className="px-3 py-2 rounded border"
                  title="浏览器语音识别（实验）"
                >🎙️ 语音</button>
                {loading && (
                  <button onClick={()=>abortRef.current?.abort()} className="px-3 py-2 rounded border">停止</button>
                )}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
