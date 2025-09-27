// src/pages/Theatre.tsx
import React, { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as PM from "../promos";

const WRAPPER = "w-11/12 md:w-4/5 lg:w-3/4 mx-auto";

type Item = { name: string; promoSlug: string; file: string };

// 从 promos 收集基础卡片（用你的内置/自定义人物都行）
function pickBaseList(): Item[] {
  const list =
    (PM as any).listPromos?.() ||
    ((PM as any).PROMOS || []);
  return (list as any[]).map((p: any) => ({
    name: p.name,
    promoSlug: p.promoSlug || p.personaSlug || p.slug,
    file: p.file,
  }));
}
const ALL = pickBaseList();
const makeMany = (n: number): Item[] =>
  Array.from({ length: n }, (_, i) => ALL[i % ALL.length]);

const ST_DESC: Record<string, string> = {
  海龟汤: "经典“水平思考”推理：我只回答“是/否/无关”，你通过提问，一步步还原故事的离奇真相。",
  规则怪谈: "身处诡异世界，唯有遵守规则才能活下去；每条规则背后都藏着代价与线索。",
  我是爽文男主: "爽文男主，就是要让所有人闭嘴，让所有人都倒在我的脚下。",
  玄幻小说之我是萧炎: "穿越斗气大陆，以萧炎之名重开：纳戒老师、炼药师、异火、斗气修行，走出你的热血成长线。",
  我的冒险我做主: "开放式分支剧情，你的每个选择都会改写世界走向；结局由你亲手决定。",
  我的傲娇女友我来宠: "嘴硬心软、刀子嘴豆腐心；解锁 tsundere 的专属互动与甜蜜桥段。",
  开局五百亿: "现代都市题材，天降 500 亿启动资金；商业帝国、社交博弈、权谋与温情任你书写。",
  剧本杀: "阵营、任务、线索、推理与反转；沉浸式角色扮演，找出真相或达成你的阵营目标。",
};

const CATEGORIES = [
  { title: "海龟汤", items: makeMany(8), desc: ST_DESC["海龟汤"] },
  { title: "规则怪谈", items: makeMany(8), desc: ST_DESC["规则怪谈"] },
  { title: "我是爽文男主", items: makeMany(8), desc: ST_DESC["我是爽文男主"] },
  { title: "玄幻小说之我是萧炎", items: makeMany(8), desc: ST_DESC["玄幻小说之我是萧炎"] },
  { title: "我的冒险我做主", items: makeMany(8), desc: ST_DESC["我的冒险我做主"] },
  { title: "我的傲娇女友我来宠", items: makeMany(8), desc: ST_DESC["我的傲娇女友我来宠"] },
  { title: "开局五百亿", items: makeMany(8), desc: ST_DESC["开局五百亿"] },
  { title: "剧本杀", items: makeMany(8), desc: ST_DESC["剧本杀"] },
];

function CategoryRow({
  title,
  items,
  desc,
}: {
  title: string;
  items: Item[];
  desc?: string;
}) {
  const navigate = useNavigate();
  const scrollerRef = useRef<HTMLDivElement>(null);

  const data = useMemo(() => {
    const map = new Map<string, Item>();
    for (const it of items) if (!map.has(it.promoSlug)) map.set(it.promoSlug, it);
    return Array.from(map.values());
  }, [items]);

  const [canL, setCanL] = useState(false);
  const [canR, setCanR] = useState(true);
  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanL(scrollLeft > 2);
    setCanR(scrollLeft + clientWidth < scrollWidth - 2);
  };

  const isDown = useRef(false);
  const startX = useRef(0);
  const startLeft = useRef(0);
  const movedRef = useRef(0);
  const capturedRef = useRef(false); // ★ 只在不是点按钮时才捕获

  const onPointerDown = (e: React.PointerEvent) => {
    const el = scrollerRef.current;
    if (!el) return;
    isDown.current = true;
    movedRef.current = 0;
    startX.current = e.clientX;
    startLeft.current = el.scrollLeft;
    if (!(e.target as HTMLElement).closest("button")) {
      el.setPointerCapture?.(e.pointerId);
      capturedRef.current = true;
    } else {
      capturedRef.current = false;
    }
    (el.style as any).cursor = "grabbing";
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDown.current) return;
    const el = scrollerRef.current;
    if (!el) return;
    const dx = e.clientX - startX.current;
    movedRef.current = Math.max(movedRef.current, Math.abs(dx));
    el.scrollLeft = startLeft.current - dx;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const el = scrollerRef.current;
    isDown.current = false;
    if (capturedRef.current) {
      el?.releasePointerCapture?.(e.pointerId);
      capturedRef.current = false;
    }
    if (el) (el.style as any).cursor = "grab";
  };

  const by = (dir: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const w = el.clientWidth * 0.8;
    el.scrollBy({ left: dir * w, behavior: "smooth" });
  };

  return (
    <section className="relative z-20 mb-10 md:mb-14">
      <header className="mb-2 md:mb-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-2xl md:text-3xl font-semibold">
            <span className="text-pink-500 mr-1">#</span>
            <span>{title}</span>
          </h3>
          <button
            onClick={() => navigate(`/categories?cat=${encodeURIComponent(title)}`)}
            className="text-xs md:text-sm text-pink-600 hover:underline"
          >
            查看更多
          </button>
        </div>
        <div className="text-base text-gray-500 mt-1">
          {data.length} 个作品 · 0 人点赞
        </div>
        {desc && <p className="mt-1 text-sm text-gray-500 leading-relaxed">{desc}</p>}
      </header>

      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-white to-transparent rounded-l-xl" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent rounded-r-xl" />

        {canL && (
          <button
            onClick={() => by(-1)}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 m-1 px-2 py-1 rounded-full bg-white/90 shadow hover:shadow-md"
          >
            ‹
          </button>
        )}
        {canR && (
          <button
            onClick={() => by(1)}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 m-1 px-2 py-1 rounded-full bg-white/90 shadow hover:shadow-md"
          >
            ›
          </button>
        )}

        <style>{`.hidebar::-webkit-scrollbar{display:none} .hidebar{-ms-overflow-style:none;scrollbar-width:none}`}</style>

        <div
          ref={scrollerRef}
          onScroll={onScroll}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="overflow-x-auto hidebar scroll-smooth select-none cursor-grab"
          style={{ touchAction: "pan-y" }}
        >
          <div className="flex gap-4 md:gap-5 pr-6">
            {data.map((p, idx) => (
              <button
                key={`${title}-${p.promoSlug}-${idx}`}
                type="button"
                onPointerDownCapture={() => { movedRef.current = 0; }}
                onClick={() => {
                  if (movedRef.current > 6) return;
                  navigate(`/chat/${p.promoSlug}`);
                }}
                className="relative shrink-0 w-[40vw] sm:w-[26vw] md:w-[18vw] lg:w-[13vw] aspect-[9/14] rounded-2xl overflow-hidden shadow hover:shadow-xl transition group text-left bg-white"
                title={p.name}
              >
                <img
                  src={p.file}
                  alt={p.name}
                  className="w-full h-full object-cover"
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                />
                <div className="absolute inset-x-0 bottom-0 p-3 text-white bg-gradient-to-t from-black/60 to-transparent">
                  <div className="text-base md:text-lg font-medium drop-shadow">{p.name}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function TheatrePage() {
  const navigate = useNavigate();              // ← 必须声明
  const [kw, setKw] = useState("");

  return (
    <div className="min-h-screen text-gray-900">
      <div className="pt-16" />
      <main className={`${WRAPPER} pb-16`}>
        {/* 顶部搜索框（找回） */}
        <section className="my-6 md:my-8">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const kw2 = kw.trim();
              if (!kw2) return;
              navigate(`/search?q=${encodeURIComponent(kw2)}&from=theatre`);
            }}
            className="w-full max-w-2xl mx-auto"
          >
            <input
              value={kw}
              onChange={(e) => setKw(e.target.value)}
              placeholder="搜剧本、关键词或你想扮演的角色，例如：校园 / 推理 / 火焰异火"
              className="w-full border rounded-full px-5 py-2.5 outline-none bg-white/90 backdrop-blur focus:ring-2 focus:ring-pink-500/30"
            />
          </form>
        </section>

        {/* 标题行 */}
        <section className="mb-4">
          <div className="relative">
            <h2 className="inline-block text-2xl md:text-3xl font-extrabold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-pink-600 via-rose-500 to-fuchsia-600">
              小剧场
            </h2>
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-pink-500/10 text-pink-600 border border-pink-500/20 align-middle">
              剧情互动
            </span>
            <div className="h-[2px] w-24 md:w-32 mt-2 bg-gradient-to-r from-pink-500/80 to-transparent rounded-full" />
          </div>
        </section>

        {CATEGORIES.map((c) => (
          <CategoryRow key={c.title} title={`#${c.title}`} items={c.items} desc={c.desc} />
        ))}
      </main>
    </div>
  );
}
