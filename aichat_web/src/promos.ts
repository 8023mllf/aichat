// src/promos.ts

// 人物卡片（可作为分类索引的最小信息集合）
export type Promo = {
  name: string;
  promoSlug: string;   // 聊天路由的 slug（也作为 personaSlug 使用）
  file: string;        // 头像/海报（可为 dataURL）
  personaSlug: string; // 后端 personas 的 slug

  // —— 用于“类别筛选/搜索”的元数据 —— //
  tags?: {
    traits?: string[];     // 性格
    background?: string;   // 大类
    style?: string[];      // 风格
  };
  updatedAt?: string;      // ISO 时间
  classic?: boolean;       // 是否“经典”
};

// 通用占位图（无需真实图片）
const NO_PIC =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="900">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#6366f1"/><stop offset="1" stop-color="#ec4899"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <text x="50%" y="54%" text-anchor="middle" fill="white" font-size="48" font-family="sans-serif">AI Persona</text>
    </svg>`
  );

// 预置项（保留你原来的 4 个）
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

    // —— 海龟汤（无需配图，用默认头像占位即可） —— //
  {
    name: "海龟汤·回家来电",
    promoSlug: "soup-home-call",
    file: "/imgs/moren.jpg",
    personaSlug: "soup-home-call",
    tags: {
      traits: ["水平思考","悬疑","黑暗"],
      background: "海龟汤",
      style: ["克制","简短"]
    },
    updatedAt: new Date().toISOString(),
    classic: false,
  },
  {
    name: "海龟汤·红鞋之夜",
    promoSlug: "soup-red-heels",
    file: "/imgs/moren.jpg",
    personaSlug: "soup-red-heels",
    tags: {
      traits: ["水平思考","表演","飞刀"],
      background: "海龟汤",
      style: ["克制","简短"]
    },
    updatedAt: new Date().toISOString(),
    classic: false,
  },
  {
    name: "海龟汤·三兄弟",
    promoSlug: "soup-three-brothers",
    file: "/imgs/moren.jpg",
    personaSlug: "soup-three-brothers",
    tags: {
      traits: ["水平思考","兄弟","双胞胎"],
      background: "海龟汤",
      style: ["克制","简短"]
    },
    updatedAt: new Date().toISOString(),
    classic: false,
  },
  {
    name: "海龟汤·祭日三人",
    promoSlug: "soup-anniversary",
    file: "/imgs/moren.jpg",
    personaSlug: "soup-anniversary",
    tags: {
      traits: ["水平思考","器官捐献","悼念"],
      background: "海龟汤",
      style: ["克制","简短"]
    },
    updatedAt: new Date().toISOString(),
    classic: false,
  },


  // === 新增：每类 1 人，共 11 人（与后端 slug 完全一致） ===
  {
    name: "维尔",
    promoSlug: "game-ranger",
    file: NO_PIC,
    personaSlug: "game-ranger",
    tags: { traits: ["理性","攻略控","稳妥"], background: "游戏", style: ["稳妥","实用"] },
    updatedAt: "2025-09-28T09:00:05Z",
  },
  {
    name: "诺娃",
    promoSlug: "film-captain",
    file: NO_PIC,
    personaSlug: "film-captain",
    tags: { traits: ["正直","勇敢","责任感"], background: "电影", style: ["冒险","温暖"] },
    updatedAt: "2025-09-28T09:00:10Z",
  },
  {
    name: "会议纪要助手",
    promoSlug: "tool-notetaker",
    file: NO_PIC,
    personaSlug: "tool-notetaker",
    tags: { traits: ["结构化","高效"], background: "工具", style: ["专业","简明"] },
    updatedAt: "2025-09-28T09:00:15Z",
  },
  {
    name: "晨曦",
    promoSlug: "star-morning",
    file: NO_PIC,
    personaSlug: "star-morning",
    tags: { traits: ["亲切","努力","感恩"], background: "明星", style: ["真诚","积极"] },
    updatedAt: "2025-09-28T09:00:20Z",
  },
  {
    name: "诸葛亮",
    promoSlug: "zhugeliang",
    file: NO_PIC,
    personaSlug: "zhugeliang",
    tags: { traits: ["理性","全局观","节制"], background: "历史人物", style: ["克制","谋略"] },
    updatedAt: "2025-09-28T09:00:25Z",
    classic: true,
  },
  {
    name: "软软",
    promoSlug: "sweet-yoyo",
    file: NO_PIC,
    personaSlug: "sweet-yoyo",
    tags: { traits: ["治愈","贴心","元气"], background: "甜系女友", style: ["温柔","甜"] },
    updatedAt: "2025-09-28T09:00:30Z",
  },
  {
    name: "季寒川",
    promoSlug: "ceo-coldriver",
    file: NO_PIC,
    personaSlug: "ceo-coldriver",
    tags: { traits: ["强势","护短"], background: "霸道总裁", style: ["冷面","克制"] },
    updatedAt: "2025-09-28T09:00:35Z",
  },
  {
    name: "小岚",
    promoSlug: "tsundere-lan",
    file: NO_PIC,
    personaSlug: "tsundere-lan",
    tags: { traits: ["傲娇","在乎","别扭"], background: "傲娇女友", style: ["别扭","可爱"] },
    updatedAt: "2025-09-28T09:00:40Z",
  },
  {
    name: "芷宁",
    promoSlug: "cool-zhining",
    file: NO_PIC,
    personaSlug: "cool-zhining",
    tags: { traits: ["高冷","专业","清醒"], background: "高冷御姐", style: ["理性","克制"] },
    updatedAt: "2025-09-28T09:00:45Z",
  },
  {
    name: "穿越系统·Alpha",
    promoSlug: "system-alpha",
    file: NO_PIC,
    personaSlug: "system-alpha",
    tags: { traits: ["执行","毒舌"], background: "系统", style: ["指令化","中立"] },
    updatedAt: "2025-09-28T09:00:50Z",
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

/** 供分类/搜索使用：合并内置与自定义 */
export function allPromos(): Promo[] {
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
