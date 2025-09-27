// src/promos.ts

// 人物卡片（可作为分类索引的最小信息集合）
export type Promo = {
  name: string;
  promoSlug: string;   // 聊天路由的 slug（也作为 personaSlug 使用）
  file: string;        // 头像/海报（可为 dataURL）
  personaSlug: string; // 后端 personas 的 slug

  // —— 新增：用于“类别筛选”的元数据（可选） —— //
  tags?: {
    traits?: string[];     // 性格：甜美/可爱/傲娇/高冷/热情/幽默/呆萌/深沉/知性/元气/治愈 …
    background?: string;   // 背景：动漫/游戏/电影/电视剧/明星/自创 …
    style?: string[];      // 语言风格 / 说话语气：活泼/亲切/克制/启发式/冒险/温暖/直爽/机智 …
  };
  updatedAt?: string;      // ISO 时间，用于“最近/近一周/近一月/近一年”筛选
  classic?: boolean;       // 是否标记为“经典”
};

// 预置项（可自由补充 tags/时间）
export const PROMOS: Promo[] = [
  {
    name: "小鸟游六花",
    promoSlug: "xiaoniaoyouliuhua",
    file: "/imgs/xiaoniaoyouliuhua.jpg",
    personaSlug: "generic-guide",
    tags: {
      traits: ["可爱", "呆萌", "元气"],
      background: "动漫",
      style: ["活泼", "亲切"],
    },
    updatedAt: "2025-09-20T10:00:00Z",
  },
  {
    name: "苏格拉底",
    promoSlug: "sugeladi",
    file: "/imgs/sugeladi.jpg",
    personaSlug: "socrates",
    tags: {
      traits: ["理性", "克制", "知性"],
      background: "自创",
      style: ["启发式", "克制"],
    },
    updatedAt: "2025-09-22T12:00:00Z",
    classic: true,
  },
  {
    name: "哈利波特",
    promoSlug: "halibote",
    file: "/imgs/halibote.jpg",
    personaSlug: "generic-guide",
    tags: {
      traits: ["正直", "温和"],
      background: "电影",
      style: ["冒险", "温暖"],
    },
    updatedAt: "2025-09-10T09:00:00Z",
  },
  {
    name: "卫宫胡桃",
    promoSlug: "weigonghutao",
    file: "/imgs/weigonghutao.jpg",
    personaSlug: "generic-guide",
    tags: {
      traits: ["热情", "可爱"],
      background: "游戏",
      style: ["直爽", "热情"],
    },
    updatedAt: "2025-09-18T16:30:00Z",
  },
];

// —— 本地自定义 —— //
const KEY = "custom_promos";

/** 读取本地自定义人物 */
export function listCustomPromos(): Promo[] {
  try {
    const s = localStorage.getItem(KEY);
    return s ? (JSON.parse(s) as Promo[]) : [];
  } catch {
    return [];
  }
}

/** 保存/更新本地自定义人物（按 promoSlug upsert） */
export function saveCustomPromo(p: Promo) {
  const arr = listCustomPromos();
  const i = arr.findIndex((x) => x.promoSlug === p.promoSlug);
  if (i >= 0) arr[i] = { ...arr[i], ...p };
  else arr.push(p);
  localStorage.setItem(KEY, JSON.stringify(arr));
}

/** 供分类页使用：合并内置与自定义 */
export function allPromos(): Promo[] {
  // 自定义放前面或后面都行，这里放前面以便用户刚创建的人格更显眼
  return [...listCustomPromos(), ...PROMOS];
}

/** 通过 slug 获取人物（优先自定义，后退到预置） */
export function getPromoBySlug(slug?: string | null): Promo {
  if (slug) {
    const custom = listCustomPromos().find((x) => x.promoSlug === slug);
    if (custom) return custom;
  }
  const preset = PROMOS.find((x) => x.promoSlug === slug);
  return preset ?? PROMOS[0];
}
