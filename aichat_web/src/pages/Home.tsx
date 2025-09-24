import React, { useEffect, useRef, useState } from "react";
import { PROMOS } from "../promos";
import { useNavigate } from "react-router-dom";

const WRAPPER = "w-11/12 md:w-4/5 lg:w-3/4 mx-auto";

export default function Home() {
  const [active, setActive] = useState(0);
  const timerRef = useRef<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => { startAuto(); return stopAuto; }, [active]);

  function startAuto() {
    stopAuto();
    timerRef.current = window.setTimeout(() => {
      setActive((prev) => (prev + 1) % PROMOS.length);
    }, 4000);
  }
  function stopAuto() { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } }

  function onPromoClick(slug: string) {
    navigate(`/chat/${slug}`); // ← 跳转到独立的对话页
  }

  return (
    <div className="min-h-screen text-gray-900">
      <header className={`${WRAPPER} py-4`}>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold drop-shadow">AI Roleplay</h1>
          <span className="text-sm text-gray-600">点击上方宣传图开始对话</span>
        </div>
      </header>

      <main className={`${WRAPPER} pb-12`}>
        <div className="rounded-3xl border border-white/40 bg-white/70 backdrop-blur shadow-xl overflow-hidden">
          {/* 顶部轮播 */}
          <section
            className="relative h-[260px] md:h-[320px] lg:h-[380px] overflow-hidden"
            onMouseEnter={stopAuto}
            onMouseLeave={startAuto}
          >
            <div
              className="whitespace-nowrap transition-transform duration-700"
              style={{ transform: `translateX(-${active * 100}%)` }}
            >
              {PROMOS.map((p) => (
                <button
                  key={p.promoSlug}
                  className="inline-block align-top w-full h-[260px] md:h-[320px] lg:h-[380px] relative group select-none"
                  onClick={() => onPromoClick(p.promoSlug)}
                  title={`进入 ${p.name} 对话`}
                >
                  <img src={p.file} alt={p.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                    <div className="text-white text-lg md:text-2xl font-medium drop-shadow">{p.name}</div>
                    <div className="text-white/80 text-xs md:text-sm">点击进入与此人格对话</div>
                  </div>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                </button>
              ))}
            </div>

            {/* 切换控件 */}
            <div className="absolute inset-y-0 left-0 flex items-center">
              <button onClick={() => setActive((active - 1 + PROMOS.length) % PROMOS.length)}
                      className="m-2 rounded-full bg-white/70 hover:bg-white shadow p-2" aria-label="上一张">‹</button>
            </div>
            <div className="absolute inset-y-0 right-0 flex items-center">
              <button onClick={() => setActive((active + 1) % PROMOS.length)}
                      className="m-2 rounded-full bg-white/70 hover:bg-white shadow p-2" aria-label="下一张">›</button>
            </div>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2">
              {PROMOS.map((_, i) => (
                <span key={i} onClick={() => setActive(i)}
                      className={`h-2 w-2 rounded-full cursor-pointer ${i===active ? "bg-white" : "bg-white/50"}`} />
              ))}
            </div>
          </section>

          {/* 占位内容（可放介绍） */}
          <section className="p-6 text-sm text-gray-700">
            欢迎来到 AI 人格体验站。选择上方角色即可开始与其对话。
          </section>
        </div>
      </main>

      <footer className={`${WRAPPER} py-6 text-center text-xs text-gray-500`}>
        © {new Date().getFullYear()} AI Roleplay
      </footer>
    </div>
  );
}
