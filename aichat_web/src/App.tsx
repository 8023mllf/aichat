// src/App.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import CategoriesPage from "./pages/Categories";
import CreatePage from "./pages/Create";
import ChatPage from "./pages/Chat";
import TheatrePage from "./pages/Theatre";

/* ========= 公共类型与数据 ========= */
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

/** 卡牌左下角三行标签（示例数据，可后续接后端） */
const PROMO_META: Record<
  string,
  { traits?: string[]; background?: string; style?: string[] }
> = {
  xiaoniaoyouliuhua: {
    traits: ["可爱", "呆萌", "开窍"],
    background: "动漫",
    style: ["活泼", "梦幻"],
  },
  sugeladi: {
    traits: ["理性", "克制", "智慧"],
    background: "历史",
    style: ["古典", "克制"],
  },
  halibote: {
    traits: ["正直", "勇敢", "温暖"],
    background: "电影",
    style: ["魔法", "冒险"],
  },
  weigonghutao: {
    traits: ["热情", "神秘", "幽默"],
    background: "游戏",
    style: ["灵异", "古风"],
  },
};

const WRAPPER = "w-11/12 md:w-4/5 lg:w-3/4 mx-auto";

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
        setHidden(delta > 0 && y > 20);
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
  useEffect(() => {
    setKw("");
  }, [loc.pathname]);

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ${
        hidden ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      <div className="bg-white/75 backdrop-blur border-b">
        <div className="max-w-7xl mx-auto px-3">
          <div className="relative h-14">
            {/* 左侧 */}
            <div className="absolute left-0 inset-y-0 flex items-center gap-3">
              <Link to="/" className="font-semibold">AI Roleplay</Link>
              <Link to="/" className="text-gray-700 hover:text-blue-600">首页</Link>
              <span className="text-gray-400">|</span>
              <span className="text-gray-400" title="预留">占位一</span>
              <span className="text-gray-400" title="预留">占位二</span>
            </div>

            {/* 中间 */}
            <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-full flex justify-center pointer-events-none">
              <form onSubmit={onSearchSubmit} className="pointer-events-auto w-full max-w-xl">
                <input
                  value={kw}
                  onChange={(e) => setKw(e.target.value)}
                  placeholder="搜索人物或主题……"
                  className="w-full border rounded-full px-4 py-1.5 outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </form>
            </div>

            {/* 右侧 */}
            <div className="absolute right-0 inset-y-0 flex items-center gap-4">
              <Link to="/history" className="text-gray-700 hover:text-blue-600">历史</Link>
              <Link to="/messages" className="text-gray-700 hover:text-blue-600">消息中心</Link>
              <Link to="/me" className="flex items-center gap-1 text-gray-700 hover:text-blue-600">
                <img src="/imgs/moren.jpg" className="w-8 h-8 rounded-full object-cover border" alt="avatar" />
                <span>我的</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ====== 首页顶部轮播（无限+拖拽） ====== */
function InfiniteCarousel({
  items,
  onEnter,
}: {
  items: { name: string; promoSlug: string; file: string }[];
  onEnter: (slug: string) => void;
}) {
  const n = items.length;
  const stageRef = useRef<HTMLDivElement>(null);

  // 可无界中心索引
  const [pos, setPos] = useState(0);
  const posRef = useRef(0);
  posRef.current = pos;

  // 拖拽/惯性
  const dragging = useRef(false);
  const startX = useRef(0);
  const startPos = useRef(0);
  const lastX = useRef(0);
  const lastT = useRef(0);
  const moved = useRef(0);
  const vxRef = useRef(0);

  // 卡片间距
  const unitPx = useRef(340);
  useEffect(() => {
    function recalc() {
      const w = stageRef.current?.offsetWidth || 1000;
      unitPx.current = Math.max(240, Math.min(420, w * 0.3));
    }
    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, []);

  // 环形工具
  const nearestIndex = (idx: number, p: number) => idx + n * Math.round((p - idx) / n);
  const ringDelta = (i: number, p: number) => nearestIndex(i, p) - p;

  // 惯性动画
  const rafId = useRef<number | null>(null);
  const stopAnim = () => { if (rafId.current) cancelAnimationFrame(rafId.current); rafId.current = null; };
  function animateTo(target: number, v0 = 0) {
    stopAnim();
    let v = v0, last = performance.now();
    const tick = (now: number) => {
      const dt = Math.max(8, now - last) / 16;
      last = now;
      let cur = posRef.current + v * dt;
      const diff = target - cur;
      cur += diff * 0.1 * dt;
      v *= 0.94 ** dt;
      setPos(cur);
      if (Math.abs(diff) < 0.001 && Math.abs(v) < 0.002) { setPos(target); rafId.current = null; return; }
      rafId.current = requestAnimationFrame(tick);
    };
    rafId.current = requestAnimationFrame(tick);
  }

  // 轻点识别
  const tapSlugRef = useRef<string | null>(null);
  const tapIndexRef = useRef<number | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    stageRef.current?.setPointerCapture?.(e.pointerId);
    dragging.current = true;
    moved.current = 0;

    tapSlugRef.current = null;
    tapIndexRef.current = null;
    const btn = (e.target as HTMLElement).closest("[data-card]") as HTMLElement | null;
    if (btn) {
      tapSlugRef.current = btn.dataset.slug || null;
      tapIndexRef.current = btn.dataset.index ? parseInt(btn.dataset.index, 10) : null;
    }

    startX.current = e.clientX;
    startPos.current = posRef.current;
    lastX.current = e.clientX;
    lastT.current = performance.now();
    vxRef.current = 0;
    stopAnim();
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    const now = performance.now();
    const dx = e.clientX - startX.current;
    moved.current = Math.max(moved.current, Math.abs(dx));
    if (moved.current > 6) { tapSlugRef.current = null; tapIndexRef.current = null; }

    const next = startPos.current + dx / unitPx.current; // 左拖向左
    setPos(next);

    const dt = Math.max(1, now - lastT.current) / 16;
    if (dt > 0) vxRef.current = (e.clientX - lastX.current) / unitPx.current / dt;
    lastX.current = e.clientX;
    lastT.current = now;
  }
  function onPointerUp(e: React.PointerEvent) {
    if (!dragging.current) return;
    stageRef.current?.releasePointerCapture?.(e.pointerId);
    dragging.current = false;

    if (tapSlugRef.current && tapIndexRef.current !== null && moved.current <= 6) {
      const i = tapIndexRef.current!;
      const slug = tapSlugRef.current!;
      tapSlugRef.current = null;
      tapIndexRef.current = null;
      const targetAbs = nearestIndex(i, posRef.current);
      if (Math.abs(targetAbs - posRef.current) < 0.45) onEnter(slug);
      else animateTo(targetAbs);
      return;
    }

    const after = posRef.current + vxRef.current * 1.6;
    const target = Math.round(after);
    animateTo(target, vxRef.current);
  }
  function onWheel(e: React.WheelEvent) {
    if (Math.abs(e.deltaY) < 5 && Math.abs(e.deltaX) < 5) return;
    const dir = (e.deltaY || e.deltaX) > 0 ? 1 : -1;
    animateTo(Math.round(posRef.current + dir));
  }

  return (
    <section
      ref={stageRef}
      className="relative h-[420px] md:h-[500px] lg:h-[540px] overflow-hidden select-none rounded-2xl"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      role="region"
      aria-label="人物轮播"
    >
      <style>{`@keyframes floaty{from{transform:translateY(0)}to{transform:translateY(-6px)}}`}</style>

      {/* 3D 舞台 */}
      <div className="absolute inset-0 [perspective:1200px] z-10">
        {items.map((p, i) => {
          const gap = unitPx.current * 0.95;
          const d = p ? (i + Math.round((posRef.current - i) / items.length) * items.length) - posRef.current : 0;
          const x = d * gap;
          const scale = 1 - Math.min(0.22, Math.abs(d) * 0.12);
          const opacity = 1 - Math.min(0.62, Math.abs(d) * 0.34);
          const rotateY = -d * 7;
          const zIndex = 1000 - Math.abs(Math.round(d)) * 10;

          return (
            <div
              key={`${p.promoSlug}-${i}`}
              className="absolute left-1/2 top-1/2 will-change-transform"
              style={{ zIndex, transform: `translate(-50%,-50%) translateX(${x}px) rotateY(${rotateY}deg) scale(${scale})`, opacity }}
            >
              <div className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-[70%] w-[60%] h-7 bg-black/35 blur-2xl rounded-full opacity-30 pointer-events-none" />

              <button
                data-card
                data-slug={p.promoSlug}
                data-index={i}
                onClick={(e) => {
                  e.stopPropagation();
                  const targetAbs = i + Math.round((posRef.current - i) / items.length) * items.length;
                  if (Math.abs(targetAbs - posRef.current) < 0.45) onEnter(p.promoSlug);
                  else {
                    stopAnim();
                    const animateToCard = (t: number) => animateTo(t);
                    animateToCard(targetAbs);
                  }
                }}
                className="group block rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,.32)] transition-transform"
                style={{
                  width: "clamp(150px, 20vw, 260px)",
                  height: "clamp(220px, 34vw, 420px)",
                  animation: "floaty 6s ease-in-out infinite alternate",
                  animationDelay: `${i * 0.12}s`,
                  cursor: "pointer",
                }}
                title={`进入 ${p.name} 对话`}
              >
                <img
                  src={p.file}
                  alt={p.name}
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                  style={{ WebkitUserDrag: "none", userSelect: "none" }}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/60 to-transparent text-white">
                  <div className="text-base md:text-lg font-medium drop-shadow">{p.name}</div>
                  <div className="mt-1 text-[10px] md:text-xs opacity-95">
                    {PROMO_META[p.promoSlug]?.traits?.length ? "#" + PROMO_META[p.promoSlug]!.traits!.slice(0, 3).join(" #") : null}
                  </div>
                  <div className="text-[10px] md:text-xs opacity-95">
                    {PROMO_META[p.promoSlug]?.background ? "#" + PROMO_META[p.promoSlug]!.background : null}
                  </div>
                  <div className="text-[10px] md:text-xs opacity-95">
                    {PROMO_META[p.promoSlug]?.style?.length ? "#" + PROMO_META[p.promoSlug]!.style!.slice(0, 3).join(" #") : null}
                  </div>
                </div>
                <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400/18 via-blue-500/18 to-fuchsia-500/18 opacity-0 group-hover:opacity-100 blur-2xl transition pointer-events-none" />
              </button>
            </div>
          );
        })}
      </div>

      {/* 左右按钮 */}
      <div className="absolute inset-y-0 left-0 flex items-center z-20">
        <button className="m-3 rounded-full bg-white/85 hover:bg-white shadow p-2 backdrop-blur" onClick={() => setPos(Math.round(posRef.current - 1))}>‹</button>
      </div>
      <div className="absolute inset-y-0 right-0 flex items-center z-20">
        <button className="m-3 rounded-full bg-white/85 hover:bg-white shadow p-2 backdrop-blur" onClick={() => setPos(Math.round(posRef.current + 1))}>›</button>
      </div>
    </section>
  );
}

/* ========= 首页 - 四个圆框入口 ========= */
function ActionBubblesRow({
  items,
}: {
  items: { label: string; onClick: () => void; icon?: React.ReactNode }[];
}) {
  return (
    <section className="mt-14 md:mt-16">
      <div className={`${WRAPPER}`}>
        <div className="grid grid-cols-4 gap-4 md:gap-8">
          {items.map((it) => (
            <button
              key={it.label}
              onClick={it.onClick}
              title={it.label}
              className="group relative mx-auto w-24 h-24 md:w-28 md:h-28 rounded-full p-[2px] focus:outline-none"
            >
              <div className="rounded-full w-full h-full bg-[conic-gradient(from_40deg,rgba(53,138,255,.95),rgba(168,85,247,.95),rgba(99,102,241,.95),rgba(53,138,255,.95))] p-[2px] shadow-[0_10px_30px_rgba(0,0,0,.18)] group-hover:shadow-[0_18px_48px_rgba(0,0,0,.22)] transition">
                <div className="relative rounded-full w-full h-full bg-white/85 backdrop-blur-md ring-1 ring-white/70 shadow-[inset_0_0_30px_rgba(0,0,0,.05)]">
                  <div className="absolute -inset-1 rounded-full bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,.8),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(79,70,229,.18),transparent_60%)] opacity-90 pointer-events-none" />
                  <div className="absolute -inset-2 rounded-full bg-[radial-gradient(circle_at_center,rgba(99,102,241,.18),transparent_60%)] opacity-0 group-hover:opacity-100 blur-md pointer-events-none transition" />
                  <div className="relative w-full h-full flex flex-col items-center justify-center gap-2">
                    <div className="w-7 h-7 md:w-9 md:h-9 opacity-90">{it.icon}</div>
                    <span className="text-sm md:text-base font-semibold tracking-wide text-transparent bg-clip-text bg-gradient-to-b from-slate-900 to-slate-600 group-hover:from-indigo-600 group-hover:to-fuchsia-600 transition">
                      {it.label}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ========= 首页（轮播 + 推荐） ========= */
function Home() {
  const navigate = useNavigate();

  // —— 推荐锚点滚动 —— //
  const scrollToRecommend = () => {
    const el = document.getElementById("recommend");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // 圆框图标
  const IconStar = (<svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full"><path d="M12 3.5l2.9 5.88 6.5.95-4.7 4.58 1.11 6.49L12 18.9l-5.81 3.5 1.11-6.49-4.7-4.58 6.5-.95L12 3.5z" /></svg>);
  const IconPen  = (<svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm18.71-11.46a1 1 0 0 0 0-1.41l-2.09-2.09a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.58-2.08z" /></svg>);
  const IconGrid = (<svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full"><path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z" /></svg>);
  const IconTheatre = (<svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full"><path d="M4 4h16v2H4zM6 8h12l-1.2 10.2a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.8L6 8zm2.5 3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" /></svg>);

  const features = [
    { label: "推荐", onClick: scrollToRecommend, icon: IconStar },
    { label: "创作", onClick: () => navigate("/create"), icon: IconPen },
    { label: "类别", onClick: () => navigate("/categories"), icon: IconGrid },
    { label: "小剧场", onClick: () => navigate("/theatre"), icon: IconTheatre },
  ];

  /* —— 分类横滑（支持鼠标拖拽；有限列表；“查看更多”可点击） —— */
  type Item = { name: string; promoSlug: string; file: string };

  const CategoryRow = ({
    title,
    items,
    desc,
  }: {
    title: string;
    items: Item[];
    desc?: string;
  }) => {
    const navigate = useNavigate();
    const scrollerRef = useRef<HTMLDivElement>(null);

    // 去重
    const data = useMemo(() => {
      const map = new Map<string, Item>();
      for (const it of items) if (!map.has(it.promoSlug)) map.set(it.promoSlug, it);
      return Array.from(map.values());
    }, [items]);

    // 箭头显隐
    const [canL, setCanL] = useState(false);
    const [canR, setCanR] = useState(true);
    const onScroll = () => {
      const el = scrollerRef.current;
      if (!el) return;
      const { scrollLeft, scrollWidth, clientWidth } = el;
      setCanL(scrollLeft > 2);
      setCanR(scrollLeft + clientWidth < scrollWidth - 2);
    };
    useEffect(() => { onScroll(); }, []);

    // 鼠标拖拽横向滚动（不影响点击）
    const isDown = useRef(false);
    const startX = useRef(0);
    const startLeft = useRef(0);
    const movedRef = useRef(0); // 区分“拖拽”与“点击”
    const capturedRef = useRef(false); // 只在不是点按钮时才捕获

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

    const worksCount = data.length;

    return (
      <section className="relative z-20 mb-10 md:mb-14">
        <header className="mb-2 md:mb-3">
          <div className="flex items-baseline justify-between">
            <h3 className="text-2xl md:text-3xl font-semibold">
              <span className="text-indigo-500 mr-1">#</span>
              <span>{title}</span>
            </h3>
            <button
              type="button"
              onClick={() => navigate(`/categories?cat=${encodeURIComponent(title)}`)}
              className="text-xs md:text-sm text-indigo-600 hover:underline"
            >
              查看更多
            </button>
          </div>
          <div className="text-base text-gray-500 mt-1">{worksCount} 个作品 · 0 人点赞</div>
          {desc && <p className="mt-1 text-sm text-gray-500 leading-relaxed">{desc}</p>}
        </header>

        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-white to-transparent rounded-l-xl" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent rounded-r-xl" />

          {canL && (
            <button
              type="button"
              onClick={() => by(-1)}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 m-1 px-2 py-1 rounded-full bg-white/90 shadow hover:shadow-md"
              aria-label="prev"
            >
              ‹
            </button>
          )}
          {canR && (
            <button
              type="button"
              onClick={() => by(1)}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 m-1 px-2 py-1 rounded-full bg-white/90 shadow hover:shadow-md"
              aria-label="next"
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
            className="relative z-20 overflow-x-auto hidebar scroll-smooth select-none cursor-grab"
            style={{ touchAction: "pan-y" }}
          >
            <div className="flex gap-4 md:gap-5 pr-6">
              {data.map((p, idx) => (
                <button
                  key={`${title}-${p.promoSlug}-${idx}`}
                  type="button"
                  onPointerDownCapture={() => { movedRef.current = 0; }}
                  onClick={() => {
                    if (movedRef.current > 6) return; // 拖动则不触发点击
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
                    <div className="mt-1 text-[10px] md:text-xs opacity-95">
                      {PROMO_META[p.promoSlug]?.traits?.length ? "#" + PROMO_META[p.promoSlug]!.traits!.slice(0, 3).join(" #") : null}
                    </div>
                    <div className="text-[10px] md:text-xs opacity-95">
                      {PROMO_META[p.promoSlug]?.background ? "#" + PROMO_META[p.promoSlug]!.background : null}
                    </div>
                    <div className="text-[10px] md:text-xs opacity-95">
                      {PROMO_META[p.promoSlug]?.style?.length ? "#" + PROMO_META[p.promoSlug]!.style!.slice(0, 3).join(" #") : null}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  };

  // 示例数据（真实接入后替换 makeMany 即可）
  const makeMany = (count: number): Item[] =>
    Array.from({ length: count }, (_, i) => {
      const base = PROMOS[i % PROMOS.length];
      return { ...base };
    });

  const CATEGORIES: { title: string; items: Item[]; desc?: string }[] = [
    { title: "动漫", items: makeMany(10), desc: "这里可以和你喜欢的动漫角色畅聊，身临其境地感受动漫的魅力，和 TA 一起参加冒险，或者向 TA 表达心意。快来吧。" },
    { title: "游戏", items: makeMany(12), desc: "开黑上分、刷本打宝、选择职业与加点；和熟悉的游戏角色互动，定制属于你的支线与结局。" },
    { title: "电影", items: makeMany(8),  desc: "与经典电影人物对话，重温名场面；解锁角色幕后设定，聊聊你的平行结局。" },
    { title: "工具", items: makeMany(6),  desc: "超实用 AI 工具，这里应有尽有，快来体验。" },
    { title: "明星", items: makeMany(7),  desc: "模拟采访、粉丝应援、花式互动；和你喜爱的明星来一场近距离对话。" },
    { title: "历史人物", items: makeMany(9),  desc: "穿越对话先贤名将，讨论治国、兵法与学术；让历史在对谈中“活”起来。" },
    { title: "甜系女友", items: makeMany(10),  desc: "软萌治愈、贴心陪伴、甜度超标；每天都能被温柔环绕。" },
    { title: "霸道总裁", items: makeMany(8),  desc: "商战剧情、强势偏爱、只对你温柔；从办公室到宴会场，全是你的主场。" },
    { title: "傲娇女友", items: makeMany(8),  desc: "嘴上不饶人、心里很在乎；解锁 tsundere 的傲娇与撒糖两面性。" },
    { title: "高冷御姐", items: makeMany(8),  desc: "成熟理性、气场拉满；偶尔的温柔破防更让人心动。" },
    { title: "系统", items: makeMany(5),  desc: "穿越/升级/养成系统上线！随机任务、隐藏奖励、专属成长线等你探索。" },
  ];

  // 到底提示
  const endRef = useRef<HTMLDivElement>(null);
  const [atEnd, setAtEnd] = useState(false);
  useEffect(() => {
    const ob = new IntersectionObserver(
      (entries) => setAtEnd(entries.some((e) => e.isIntersecting)),
      { rootMargin: "0px 0px -20% 0px", threshold: 0.01 }
    );
    if (endRef.current) ob.observe(endRef.current);
    return () => ob.disconnect();
  }, []);

  return (
    <div className="min-h-screen text-gray-900">
      {/* 顶部导航占位 */}
      <div className="pt-16" />

      <main className={`${WRAPPER} pb-16`}>
        {/* 轮播 */}
        <div className="rounded-3xl border border-white/40 bg-white/70 backdrop-blur shadow-xl overflow-hidden p-4 md:p-6">
          <InfiniteCarousel
            items={PROMOS}
            onEnter={(slug) => navigate(`/chat/${slug}`)}
          />
        </div>

        {/* 四个圆框入口 */}
        <ActionBubblesRow
          items={[
            { label: "推荐", onClick: scrollToRecommend, icon: IconStar },
            { label: "创作", onClick: () => navigate("/create"), icon: IconPen },
            { label: "类别", onClick: () => navigate("/categories"), icon: IconGrid },
            { label: "小剧场", onClick: () => navigate("/theatre"), icon: IconTheatre },
          ]}
        />

        {/* 推荐标题 */}
        <section id="recommend" className="relative z-20 mt-20 md:mt-28 mb-4">
          <div className="relative">
            <h2 className="inline-block text-2xl md:text-3xl font-extrabold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-fuchsia-600 to-sky-600">
              推荐
            </h2>
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 align-middle">
              每日更新
            </span>
            <div className="h-[2px] w-24 md:w-32 mt-2 bg-gradient-to-r from-indigo-500/80 to-transparent rounded-full" />
          </div>
        </section>

        {/* 类别分区 */}
        {CATEGORIES.map((c) => (
          <CategoryRow key={c.title} title={c.title} items={c.items} desc={c.desc} />
        ))}

        {/* 到底提示 */}
        <div ref={endRef} className="pt-6 pb-10 text-center text-sm text-gray-400 select-none">
          {atEnd ? "已经到底啦" : ""}
        </div>
      </main>
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
                <input type="file" accept="image/*" className="hidden" onChange={onPick} />
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
        <Route path="/chat/:promoSlug" element={<ChatPage />} />
        <Route path="/me" element={<MePage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/create" element={<CreatePage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/theatre" element={<TheatrePage />} />
      </Routes>
    </BrowserRouter>
  );
}
