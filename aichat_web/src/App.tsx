import React, { useEffect, useMemo, useRef, useState } from "react";
import { createSession, streamChat, ttsToBlob } from "./api";
import { AudioQueue } from "./audioQueue";
import { isSpeechSupported, startSpeechOnce } from "./mic";

type Msg = { role: "user" | "assistant"; content: string };

const personas = [
  { slug: "generic-guide", name: "通用助手" },
  { slug: "socrates", name: "苏格拉底（风格化）" }
];

export default function App() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [persona, setPersona] = useState<string>("socrates");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const audioQ = useMemo(() => new AudioQueue(), []);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("rp_session");
    (async () => {
      const id = saved || await createSession(persona);
      if (!saved) localStorage.setItem("rp_session", id);
      setSessionId(id);
    })();
  }, []);

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
        sessionId, userMessage: text, personaSlug: persona,
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
    if (!isSpeechSupported()) {
      alert("当前浏览器不支持语音识别（Web Speech API）。");
      return;
    }
    try {
      const text = await startSpeechOnce("zh-CN");
      setInput(text);
    } catch (e: any) {
      alert("语音识别失败：" + String(e));
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b bg-white">
        <div className="max-w-4xl mx-auto p-3 flex items-center gap-3">
          <h1 className="text-xl font-semibold">AI Roleplay</h1>
          <select value={persona} onChange={e => setPersona(e.target.value)} className="border rounded px-2 py-1">
            {personas.map(p => <option key={p.slug} value={p.slug}>{p.name}</option>)}
          </select>
          <div className="ml-auto text-sm text-gray-500">{speaking ? "🔊 播放中…" : ""}</div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4">
        <div className="bg-white border rounded-lg p-4 h-[70vh] overflow-auto">
          {messages.map((m, i) => (
            <div key={i} className={`my-3 flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] px-3 py-2 rounded-2xl whitespace-pre-wrap
                ${m.role === "user" ? "bg-blue-600 text-white rounded-br-sm" : "bg-gray-100 text-gray-900 rounded-bl-sm"}`}>
                {m.content}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="mt-4 flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(input); } }}
            placeholder="输入内容，回车发送…"
            className="flex-1 border rounded px-3 py-2"
          />
          <button onClick={() => sendText(input)} disabled={loading || !input.trim()}
                  className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50">发送</button>
          <button onClick={handleMic} className="px-3 py-2 rounded border" title="浏览器语音识别（实验）">🎙️ 语音</button>
          {loading && <button onClick={() => abortRef.current?.abort()} className="px-3 py-2 rounded border">停止</button>}
        </div>
      </main>
    </div>
  );
}
