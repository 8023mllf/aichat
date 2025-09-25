export type Promo = {
  name: string;
  promoSlug: string;   // 聊天路由的 slug（也作为 personaSlug 使用）
  file: string;        // 头像/海报（可为 dataURL）
  personaSlug: string; // 后端 personas 的 slug
};

// 预置项（保留）
export const PROMOS: Promo[] = [
  { name: "小鸟游六花", promoSlug: "xiaoniaoyouliuhua", file: "/imgs/xiaoniaoyouliuhua.jpg", personaSlug: "generic-guide" },
  { name: "苏格拉底",   promoSlug: "sugeladi",          file: "/imgs/sugeladi.jpg",           personaSlug: "socrates" },
  { name: "哈利波特",   promoSlug: "halibote",          file: "/imgs/halibote.jpg",           personaSlug: "generic-guide" },
  { name: "卫宫胡桃",   promoSlug: "weigonghutao",      file: "/imgs/weigonghutao.jpg",       personaSlug: "generic-guide" },
];

// —— 本地自定义 —— //
const KEY = "custom_promos";
export function listCustomPromos(): Promo[] {
  try {
    const s = localStorage.getItem(KEY);
    return s ? (JSON.parse(s) as Promo[]) : [];
  } catch { return []; }
}
export function saveCustomPromo(p: Promo) {
  const arr = listCustomPromos();
  const i = arr.findIndex(x => x.promoSlug === p.promoSlug);
  if (i >= 0) arr[i] = p; else arr.push(p);
  localStorage.setItem(KEY, JSON.stringify(arr));
}

export function getPromoBySlug(slug?: string | null): Promo {
  if (slug) {
    const custom = listCustomPromos().find(x => x.promoSlug === slug);
    if (custom) return custom;
  }
  const preset = PROMOS.find(x => x.promoSlug === slug);
  return preset ?? PROMOS[0];
}
