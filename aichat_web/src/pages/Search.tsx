// src/pages/Search.tsx
import React, { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { allPromos, Promo } from "../promos";

const WRAPPER = "w-11/12 md:w-4/5 lg:w-3/4 mx-auto";

// 背景分类同义词（可按需继续扩）
const BG_ALIASES: Record<string, string[]> = {
  "动漫": ["动画", "二次元", "ACG", "番剧"],
  "电影": ["影视", "movie", "film", "影片"],
  "游戏": ["game", "games", "玩家", "网游", "单机"],
  // "自创": [] // 也可映射到“历史/哲学”等，但建议直接在 promos 里把 Socrates 的 background 改成“历史”
};

function haystackOf(p: Promo): string {
  const parts: string[] = [
    p.name || "",
    p.promoSlug || "",
    p.tags?.background || "",
    ...(p.tags?.traits || []),
    ...(p.tags?.style || []),
  ];
  const bg = p.tags?.background;
  if (bg && BG_ALIASES[bg]) parts.push(...BG_ALIASES[bg]);
  return parts.join(" ").toLowerCase();
}

function matchTokens(p: Promo, tokens: string[]) {
  if (tokens.length === 0) return true;
  const hay = haystackOf(p);
  return tokens.every((t) => hay.includes(t));
}

export default function SearchPage() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const qRaw = (sp.get("q") || "").trim();

  const tokens = useMemo(
    () =>
      qRaw
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean),
    [qRaw]
  );

  const results = useMemo(() => {
    const all = allPromos();
    return all.filter((p) => matchTokens(p, tokens));
  }, [tokens]);

  return (
    <div className="pt-16">
      <main className={`${WRAPPER} py-8`}>
        <header className="mb-4">
          <h2 className="text-xl font-semibold">
            搜索：<span className="text-indigo-600">“{qRaw || "（空）"}”</span>
          </h2>
          <div className="text-sm text-gray-500 mt-1">共 {results.length} 个匹配</div>
        </header>

        {results.length === 0 ? (
          <div className="border rounded-xl p-6 bg-white/80 backdrop-blur shadow text-gray-500">
            没有找到匹配的人格。可以尝试：名字 / slug / 分类（动漫、电影、游戏）/ #性格 / #风格 等关键词。
          </div>
        ) : (
          <section className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((p) => (
              <button
                key={p.promoSlug}
                type="button"
                onClick={() => navigate(`/chat/${p.promoSlug}`)}
                className="relative text-left border rounded-2xl overflow-hidden bg-white/80 backdrop-blur shadow hover:shadow-md transition"
                title={`进入 ${p.name} 对话`}
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  <img
                    src={p.file}
                    alt={p.name}
                    className="w-full h-full object-cover"
                    draggable={false}
                    onDragStart={(e) => e.preventDefault()}
                  />
                  <div className="absolute left-3 bottom-3 text-xs text-white space-y-1 z-10">
                    <div className="text-sm font-semibold drop-shadow">{p.name}</div>
                    {p.tags?.traits?.length ? (
                      <div className="opacity-95">#{p.tags.traits.slice(0, 3).join(" #")}</div>
                    ) : null}
                    {p.tags?.background ? (
                      <div className="opacity-95">#{p.tags.background}</div>
                    ) : null}
                    {p.tags?.style?.length ? (
                      <div className="opacity-95">#{p.tags.style.slice(0, 3).join(" #")}</div>
                    ) : null}
                  </div>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/55 to-transparent" />
                </div>
              </button>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
