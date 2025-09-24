import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useNavigate,
  useParams,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import { createSession, streamChat, ttsToBlob } from "./api";
import { AudioQueue } from "./audioQueue";
import { isSpeechSupported, startSpeechOnce } from "./mic";

/* ========= 公共类型与数据 ========= */
type Msg = { role: "user" | "assistant"; content: string };

type Promo = {
  name: string;         // 展示名
  promoSlug: string;    // 路由用
  file: string;         // 图片路径（public 下）
  personaSlug: string;  // 后端 personas 的 slug
};

// 四张宣传图
const PROMOS: Promo[] = [
  { name: "小鸟游六花", promoSlug: "xiaoniaoyouliuhua", file: "/imgs/xiaoniaoyouliuhua.jpg", personaSlug: "generic-guide" },
  { name: "苏格拉底",   promoSlug: "sugeladi",          file: "/imgs/sugeladi.jpg",           personaSlug: "socrates" },
  { name: "哈利波特",   promoSlug: "halibote",          file: "/imgs/halibote.jpg",           personaSlug: "generic-guide" },
  { name: "卫宫胡桃",   promoSlug: "weigonghutao",      file: "/imgs/weigonghutao.jpg",       personaSlug: "generic-guide" },
];

const WRAPPER = "w-11/12 md:w-4/5 lg:w-3/4 mx-auto";

function getPromoBySlug(slug?: string | null): Promo {
  return PROMOS.find(p => p.promoSlug === slug) ?? PROMOS[0];
}

/* ========= 顶部整宽导航（下滑隐藏、上滑出现） ========= */
function TopBar() {
  const [hidden, setHidden] = useState(false);
  const [kw, setKw] = useState("");
  const lastY = useRef(0);
  const navigate = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY;
      const delta = y - lastY.current;
      if (Math.abs(delta) > 6) {
        setHidden(delta > 0 && y > 20); // 向下滚且已离顶，隐藏
        lastY.current = y;
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    navigate(`/search?q=${encodeURIComponent(kw.trim())}`);
  }

  // 路由变化时，收起/重置搜索
  useEffect(() => { setKw(""); }, [loc.pathname]);

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ${
        hidden ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      <div className="bg-white/75 backdrop-blur border-b">
        <div className="max-w-7xl mx-auto px-3">
          <div className="h-14 flex items-center gap-3">
            {/* 左侧：LOGO + 首页 + 预留位 */}
            <div className="flex items-center gap-3">
              <Link to="/" className="font-semibold">AI Roleplay</Link>
              <Link to="/" className="text-gray-700 hover:text-blue-600">首页</Link>
              <span className="text-gray-400">|</span>
              <a className="text-gray-400 cursor-default" title="预留">占位一</a>
              <a className="text-gray-400 cursor-default" title="预留">占位二</a>
            </div>

            {/* 中间：搜索 */}
            <div className="flex-1">
              <form onSubmit={onSearchSubmit}>
                <input
                  value={kw}
                  onChange={e=>setKw(e.target.value)}
                  placeholder="搜索人物或主题……"
                  className="w-full max-w-xl border rounded-full px-4 py-1.5 outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </form>
            </div>

            {/* 右侧：历史 / 消息中心 / 我的 + 头像 */}
            <div className="flex items-center gap-4">
              <Link to="/history" className="hover:text-blue-600">历史</Link>
              <Link to="/messages" className="hover:text-blue-600">消息中心</Link>
              <Link to="/me" className="flex items-center gap-2 hover:opacity-90">
                <img
                  src={localStorage.getItem("user_avatar") || "/imgs/moren.jpg"}
                  className="w-8 h-8 rounded-full object-cover border"
                  alt="avatar"
                />
                <span>我的</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ====== 新增：封面流 / 惯性拖拽轮播 ======
function ShowroomCarousel({
  items,
  onEnter,
}: {
  items: { name: string; promoSlug: string; file: string }[];
  onEnter: (slug: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(0);
  const posRef = useRef(0);
  posRef.current = pos;

  const dragging = useRef(false);
  const startX = useRef(0);
  const startPos = useRef(0);
  const lastX = useRef(0);
  const lastT = useRef(0);
  const unitPx = useRef(420);

  useEffect(() => {
    function recalc() {
      const w = containerRef.current?.offsetWidth || 1000;
      unitPx.current = Math.max(260, Math.min(520, w * 0.42));
    }
    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragging.current = true;
    startX.current = e.clientX;
    startPos.current = posRef.current;
    lastX.current = e.clientX;
    lastT.current = performance.now();
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    const dx = e.clientX - startX.current;
    const next = startPos.current - dx / unitPx.current;
    setPos(next);
    lastX.current = e.clientX;
    lastT.current = performance.now();
  }
  function onPointerUp() {
    if (!dragging.current) return;
    dragging.current = false;
    const now = performance.now();
    const dt = Math.max(8, now - lastT.current);
    const vx_units = (lastX.current - startX.current) / unitPx.current / (dt / 16);
    let target = posRef.current - vx_units * 1.8;
    target = Math.round(target);
    target = Math.max(0, Math.min(items.length - 1, target));
    smoothGoto(target);
  }

  function smoothGoto(target: number) {
    const tick = () => {
      const cur = posRef.current;
      const diff = target - cur;
      if (Math.abs(diff) < 0.001) {
        setPos(target);
        return;
      }
      const next = cur + diff * 0.12; // ease-out
      setPos(next);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function onWheel(e: React.WheelEvent) {
    if (Math.abs(e.deltaY) < 5 && Math.abs(e.deltaX) < 5) return;
    const dir = (e.deltaY || e.deltaX) > 0 ? 1 : -1;
    let target = Math.round(posRef.current + dir);
    target = Math.max(0, Math.min(items.length - 1, target));
    smoothGoto(target);
  }

  function prev() { smoothGoto(Math.max(0, Math.round(posRef.current - 1))); }
  function next() { smoothGoto(Math.min(items.length - 1, Math.round(posRef.current + 1))); }

  function onCardClick(i: number, slug: string) {
    if (Math.abs(i - posRef.current) < 0.6) onEnter(slug);
    else smoothGoto(i);
  }

  return (
    <section
      ref={containerRef}
      className="relative h-[460px] md:h-[520px] lg:h-[560px] overflow-visible select-none"
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <style>{`@keyframes floaty { from{transform:translateY(0)} to{transform:translateY(-6px)} }`}</style>

      <div className="absolute inset-0 [perspective:1200px]">
        {items.map((p, i) => {
          const d = i - pos;
          const gap = unitPx.current * 0.86;
          const translateX = d * gap;
          const scale = 1 - Math.min(0.16, Math.abs(d) * 0.10);
          const opacity = 1 - Math.min(0.55, Math.abs(d) * 0.28);
          const rotateY = -d * 10;
          const zIndex = 1000 - Math.abs(Math.round(d)) * 10;

          return (
            <div
              key={p.promoSlug}
              className="absolute left-1/2 top-1/2 will-change-transform"
              style={{
                zIndex,
                transform: `translate(-50%,-50%) translateX(${translateX}px) rotateY(${rotateY}deg) scale(${scale})`,
                opacity,
              }}
            >
              <button
                onClick={() => onCardClick(i, p.promoSlug)}
                className="group block rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/50 backdrop-blur bg-white/70 hover:bg-white/85 transition-colors"
                style={{
                  width: "min(76vw, 880px)",
                  height: "min(40vw, 420px)",
                  animation: "floaty 5.5s ease-in-out infinite alternate",
                  animationDelay: `${i * 0.15}s`,
                }}
                title={`进入 ${p.name} 对话`}
              >
                <div className="relative w-full h-full">
                  <img
                    src={p.file}
                    alt=""
                    aria-hidden
                    className="absolute inset-0 w-full h-full object-cover blur-md scale-110 brightness-[0.8]"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <img
                      src={p.file}
                      alt={p.name}
                      className="max-w-[92%] max-h-[90%] object-contain drop-shadow-2xl"
                    />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
                    <div className="text-white text-lg md:text-2xl font-medium drop-shadow">{p.name}</div>
                    <div className="text-white/80 text-xs md:text-sm">点击进入与此人格对话</div>
                  </div>
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 via-cyan-400/20 to-fuchsia-500/20 opacity-0 group-hover:opacity-100 blur-2xl transition-opacity pointer-events-none" />
                </div>
              </button>
            </div>
          );
        })}
      </div>

      <div className="absolute inset-y-0 left-0 flex items-center z-20">
        <button onClick={prev} className="m-3 rounded-full bg-white/80 hover:bg-white shadow p-2 backdrop-blur" aria-label="上一张">‹</button>
      </div>
      <div className="absolute inset-y-0 right-0 flex items-center z-20">
        <button onClick={next} className="m-3 rounded-full bg-white/80 hover:bg-white shadow p-2 backdrop-blur" aria-label="下一张">›</button>
      </div>

      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex gap-2">
        {items.map((_, i) => (
          <span
            key={i}
            onClick={() => {
              const target = i;
              const cur = posRef.current;
              const tick = () => {
                const diff = target - posRef.current;
                if (Math.abs(diff) < 0.001) return setPos(target);
                setPos(posRef.current + diff * 0.12);
                requestAnimationFrame(tick);
              };
              requestAnimationFrame(tick);
            }}
            className={`h-2 w-2 rounded-full cursor-pointer ${Math.round(pos)===i ? "bg-white" : "bg-white/50"}`}
          />
        ))}
      </div>
    </section>
  );
}


/* ========= 首页（轮播） ========= */
function Home() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen text-gray-900">
      {/* 顶栏占位（如果你有 fixed 顶栏） */}
      <div className="pt-16" />

      <main className={`${WRAPPER} pb-12`}>
        <div className="rounded-3xl border border-white/40 bg-white/70 backdrop-blur shadow-xl overflow-hidden p-4 md:p-6">
          <ShowroomCarousel
            items={PROMOS}
            onEnter={(slug) => navigate(`/chat/${slug}`)}
          />

          <section className="mt-6 text-sm text-gray-700">
            拖拽或点击上方卡片即可进入与对应人格的对话。
          </section>
        </div>
      </main>
    </div>
  );
}


/* ========= 对话页（背景=宣传图，气泡+头像） ========= */
function Chat() {
  const { promoSlug } = useParams();
  const promo = getPromoBySlug(promoSlug);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [userAvatar, setUserAvatar] = useState<string>(localStorage.getItem("user_avatar") || "/imgs/moren.jpg");

  const audioQ = useMemo(()=>new AudioQueue(),[]);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 监听“我的”页面修改头像后的自定义事件
  useEffect(() => {
    function onChanged(e: Event) {
      const url = localStorage.getItem("user_avatar") || "/imgs/moren.jpg";
      setUserAvatar(url);
    }
    window.addEventListener("avatar-changed", onChanged as any);
    return () => window.removeEventListener("avatar-changed", onChanged as any);
  }, []);

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
      {/* 顶部导航高度占位 */}
      <div className="pt-16" />
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-white/55 backdrop-blur-sm" />

      <div className="relative">
        <main className={`${WRAPPER} pb-12`}>
          <div className="rounded-3xl border border-white/40 bg-white/75 backdrop-blur shadow-xl overflow-hidden">
            <section className="p-4 md:p-6">
              <div className="bg-white/90 border rounded-xl p-4 h-[64vh] md:h-[68vh] overflow-auto">
                {messages.map((m, i) => {
                  const isUser = m.role === "user";
                  return (
                    <div key={i} className={`my-3 flex items-end ${isUser ? "justify-end" : "justify-start"} gap-2`}>
                      {/* 左侧头像（AI） */}
                      {!isUser && (
                        <img src={promo.file} alt="ai" className="w-8 h-8 rounded-full object-cover shadow" />
                      )}
                      {/* 气泡 */}
                      <div
                        className={`max-w-[78%] px-3 py-2 rounded-2xl whitespace-pre-wrap ${
                          isUser
                            ? "bg-blue-600 text-white rounded-br-sm"
                            : "bg-gray-100 text-gray-900 rounded-bl-sm"
                        }`}
                      >
                        {m.content}
                      </div>
                      {/* 右侧头像（用户） */}
                      {isUser && (
                        <img src={userAvatar} alt="me" className="w-8 h-8 rounded-full object-cover shadow" />
                      )}
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <div className="mt-4 flex gap-2">
                <input
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
                <button onClick={handleMic} className="px-3 py-2 rounded border" title="语音识别（实验）">🎙️</button>
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

/* ========= 我的（可更换头像） ========= */
function MePage() {
  const [avatar, setAvatar] = useState<string>(localStorage.getItem("user_avatar") || "/imgs/moren.jpg");

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || "");
      setAvatar(url);
      localStorage.setItem("user_avatar", url);
      window.dispatchEvent(new Event("avatar-changed"));
    };
    reader.readAsDataURL(f);
  }

  function reset() {
    const url = "/imgs/moren.jpg";
    setAvatar(url);
    localStorage.setItem("user_avatar", url);
    window.dispatchEvent(new Event("avatar-changed"));
  }

  return (
    <div className="pt-16">
      <div className={`${WRAPPER} py-8`}>
        <h2 className="text-xl font-semibold mb-4">我的信息</h2>
        <div className="bg-white/80 backdrop-blur border rounded-2xl p-6 shadow">
          <div className="flex items-center gap-6">
            <img src={avatar} className="w-20 h-20 rounded-full object-cover border" alt="me" />
            <div className="space-x-2">
              <label className="px-3 py-2 rounded border cursor-pointer">
                更换头像
                <input type="file" accept="image/*" className="hidden" onChange={onPick}/>
              </label>
              <button onClick={reset} className="px-3 py-2 rounded border">恢复默认</button>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-4">（更多个人信息页内容，后续补充）</p>
        </div>
      </div>
    </div>
  );
}

/* ========= 历史 / 消息中心 / 搜索（占位页） ========= */
function HistoryPage() {
  return (
    <div className="pt-16">
      <div className={`${WRAPPER} py-10`}>
        <h2 className="text-xl font-semibold mb-4">历史对话</h2>
        <div className="border rounded-xl p-6 bg-white/80 backdrop-blur shadow">
          暂未实现：这里将展示你与不同 AI 人格的会话列表（可点击进入）。
        </div>
      </div>
    </div>
  );
}
function MessagesPage() {
  return (
    <div className="pt-16">
      <div className={`${WRAPPER} py-10`}>
        <h2 className="text-xl font-semibold mb-4">消息中心</h2>
        <div className="border rounded-xl p-6 bg-white/80 backdrop-blur shadow">
          暂未实现：系统通知、会话提醒等。
        </div>
      </div>
    </div>
  );
}
function SearchPage() {
  const [sp] = useSearchParams();
  const q = sp.get("q") || "";
  return (
    <div className="pt-16">
      <div className={`${WRAPPER} py-10`}>
        <h2 className="text-xl font-semibold mb-4">搜索</h2>
        <div className="border rounded-xl p-6 bg-white/80 backdrop-blur shadow">
          关键词：<b>{q || "(空)"}</b>（预留：搜索人物卡/历史会话）
        </div>
      </div>
    </div>
  );
}

/* ========= 顶层：挂载路由 + 顶部导航 ========= */
export default function App() {
  return (
    <BrowserRouter>
      <TopBar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/chat/:promoSlug" element={<Chat />} />
        <Route path="/me" element={<MePage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/search" element={<SearchPage />} />
      </Routes>
    </BrowserRouter>
  );
}
