// src/pages/Categories.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { fetchCategoriesMeta } from "../api";
import * as PM from "../promos";

// —— 汇总所有可见人物：优先使用 listPromos()，否则合并自定义 + 预置 —— //
function useAllPromos(): any[] {
  const fromHelper = (PM as any).listPromos?.();
  if (fromHelper) return fromHelper;

  const presets: any[] = (PM as any).PROMOS || [];
  const custom: any[] = (PM as any).listCustomPromos ? (PM as any).listCustomPromos() : [];
  // 规范化：确保每个 promo 都有 .categories（用于后续筛选）
  return [...custom, ...presets].map((p: any) => ({
    ...p,
    categories: p.categories ?? p.tags ?? {},
  }));
}

// 时间段枚举（可保留或删除）
const TIME = ["最近", "近一周", "近一月", "近一年", "经典"];

type SearchShape = {
  trait?: string[];       // 多选
  bg?: string[];          // 多选
  style?: string[];       // 多选
  time?: string | null;   // 单选
  sort?: "time" | "hot";  // 排序
};

// URL <-> 状态
function useSearchState(): [SearchShape, (next: Partial<SearchShape>) => void] {
  const [sp, setSp] = useSearchParams();
  const getList = (k: string) => sp.getAll(k);
  const state: SearchShape = {
    trait: getList("trait"),
    bg: getList("bg"),
    style: getList("style"),
    time: sp.get("time"),
    sort: (sp.get("sort") as any) || "time",
  };
  const update = (next: Partial<SearchShape>) => {
    const s = new URLSearchParams(sp);
    const setList = (k: string, arr?: string[]) => {
      s.delete(k);
      (arr || []).forEach(v => s.append(k, v));
    };
    if (next.trait !== undefined) setList("trait", next.trait || []);
    if (next.bg !== undefined) setList("bg", next.bg || []);
    if (next.style !== undefined) setList("style", next.style || []);
    if (next.time !== undefined) {
      if (next.time) s.set("time", next.time);
      else s.delete("time");
    }
    if (next.sort !== undefined) s.set("sort", next.sort || "time");
    setSp(s, { replace: true });
  };
  return [state, update];
}

function toggle(list: string[] | undefined, val: string): string[] {
  const arr = list ? [...list] : [];
  const i = arr.indexOf(val);
  if (i >= 0) arr.splice(i, 1);
  else arr.push(val);
  return arr;
}
function days(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

export default function CategoriesPage() {
  // 动态分类元数据（来自后端）
  const [meta, setMeta] = useState<{ traits: string[]; background: string[]; style: string[] }>(
    { traits: [], background: [], style: [] }
  );
  useEffect(() => {
    fetchCategoriesMeta().then(setMeta).catch(() => { /* 拉取失败时保持空 */ });
  }, []);

  const all = useAllPromos();
  const [q, setQ] = useSearchState();

  // <-- 新增：用于整张卡片跳转 -->
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    const now = new Date();

    function passTime(p: any) {
      const t = p.createdAt ? new Date(p.createdAt) : null;
      if (!q.time || q.time === "经典") return true;
      if (!t) return false;
      if (q.time === "最近")  return (now.getTime() - t.getTime()) <= 3 * 24 * 3600 * 1000;
      if (q.time === "近一周") return t >= days(7);
      if (q.time === "近一月") return t >= days(30);
      if (q.time === "近一年") return t >= days(365);
      return true;
    }

    const hasAll = (need: string[] | undefined, owned?: string[] | string) => {
      if (!need || need.length === 0) return true;
      if (!owned) return false;
      // owned may be array or single string
      const ownedArr = Array.isArray(owned) ? owned : [owned];
      return need.every(x => ownedArr.includes(x));
    };

    return all
      .filter((p) => {
        // 规范读取：优先 p.categories（旧字段），否则 p.tags（新字段）
        const cat = p.categories ?? p.tags ?? {};
        const okTrait = hasAll(q.trait, cat.traits);
        const okBg    = hasAll(q.bg, cat.background);
        const okStyle = hasAll(q.style, cat.style);
        const okTime  = passTime(p);
        return okTrait && okBg && okStyle && okTime;
      })
      .sort((a: any, b: any) => {
        if (q.sort === "hot") return (b.hot || 0) - (a.hot || 0);
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });
  }, [all, q]);

  const clearAll = () => setQ({ trait: [], bg: [], style: [], time: null });

  return (
    <div className="min-h-screen pt-16">
      <div className="mx-auto w-11/12 max-w-7xl py-6">
        <header className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">按类别浏览</h1>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-500">
              排序：
              <select
                className="ml-2 border rounded px-2 py-1"
                value={q.sort}
                onChange={(e) => setQ({ sort: e.target.value as any })}
              >
                <option value="time">按时间</option>
                <option value="hot">按热度</option>
              </select>
            </label>
            <button className="text-sm px-2 py-1 rounded border" onClick={clearAll}>
              清空筛选
            </button>
          </div>
        </header>

        {/* 筛选条 */}
        <section className="space-y-3 bg-white/80 backdrop-blur border rounded-xl p-4 shadow-sm">
          <Row label="性格" options={meta.traits} value={q.trait || []} onChange={(v) => setQ({ trait: v })} />
          <Row label="背景" options={meta.background} value={q.bg || []} onChange={(v) => setQ({ bg: v })} />
          <Row label="语言风格" options={meta.style} value={q.style || []} onChange={(v) => setQ({ style: v })} />
          <RowRadio label="时间" options={TIME} value={q.time || ""} onChange={(v) => setQ({ time: v || null })} />
        </section>

        {/* 结果列表 */}
        <section className="mt-6 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p: any) => {
            const cat = p.categories ?? p.tags ?? {};
            const traits = cat.traits || [];
            const bg = cat.background ? (Array.isArray(cat.background) ? cat.background : [cat.background]) : [];
            const style = cat.style || [];
            const targetSlug = p.personaSlug || p.promoSlug;

            return (
              <article
                key={targetSlug}
                // 使整张卡可点击：cursor-pointer、role、tabIndex、键盘事件
                className="relative border rounded-2xl overflow-hidden bg-white/80 backdrop-blur shadow hover:shadow-md transition cursor-pointer"
                onClick={() => navigate(`/chat/${targetSlug}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(`/chat/${targetSlug}`);
                  }
                }}
                aria-label={`进入 ${p.name} 的对话`}
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  <img src={p.file} alt={p.name} className="w-full h-full object-cover" />
                  <div className="absolute left-3 bottom-3 text-xs text-white/90 space-y-1 z-10">
                    <div className="text-sm font-semibold text-white drop-shadow">{p.name}</div>
                    {!!traits.length && <div className="opacity-90">#{traits.join(" #")}</div>}
                    {!!bg.length && <div className="opacity-90">#{bg.join(" #")}</div>}
                    {!!style.length && <div className="opacity-90">#{style.join(" #")}</div>}
                  </div>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/55 to-transparent" />
                </div>

                <div className="p-4">
                  <div className="mt-1 flex items-center justify-between text-sm text-gray-500">
                    <span>{p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "—"}</span>
                    <span>热度 {p.hot ?? 0}</span>
                  </div>
                  <div className="mt-3">
                    {/* 保留底部链接（仍可单独点击），它不会阻止整卡点击 */}
                    <Link
                      to={`/chat/${targetSlug}`}
                      onClick={(e) => {
                        // 避免因为在未来卡片内放置更多交互控件时触发双重行为，
                        // 这里 stopPropagation 可以保证只由 Link 控制跳转（不是必须）
                        e.stopPropagation();
                      }}
                      className="inline-block px-3 py-1.5 rounded-lg bg-indigo-600 text-white"
                    >
                      进入对话
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        {filtered.length === 0 && (
          <p className="text-center text-gray-500 mt-10">没有符合条件的人格。</p>
        )}
      </div>
    </div>
  );
}

// 小组件：多选行
function Row({
  label, options, value, onChange,
}: {
  label: string;
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-16 shrink-0 text-gray-500 pt-1">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((op) => {
          const active = value.includes(op);
          return (
            <button
              key={op}
              onClick={() => onChange(toggle(value, op))}
              className={
                "px-3 py-1 rounded-full border text-sm " +
                (active ? "bg-indigo-600 text-white border-indigo-600" : "bg-white/80")
              }
            >
              {op}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// 单选行
function RowRadio({
  label, options, value, onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-16 shrink-0 text-gray-500 pt-1">{label}</div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onChange("")}
          className={
            "px-3 py-1 rounded-full border text-sm " +
            (!value ? "bg-indigo-600 text-white border-indigo-600" : "bg-white/80")
          }
        >
          全部
        </button>
        {options.map((op) => {
          const active = value === op;
          return (
            <button
              key={op}
              onClick={() => onChange(active ? "" : op)}
              className={
                "px-3 py-1 rounded-full border text-sm " +
                (active ? "bg-indigo-600 text-white border-indigo-600" : "bg-white/80")
              }
            >
              {op}
            </button>
          );
        })}
      </div>
    </div>
  );
}
