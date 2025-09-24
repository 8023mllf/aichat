export type Promo = {
  name: string;         // 展示名
  promoSlug: string;    // 用于路由与图片名
  file: string;         // 图片路径（放 public 下）
  personaSlug: string;  // 后端 personas 的 slug
};

// 你给定的四个宣传项
export const PROMOS: Promo[] = [
  { name: "小鸟游六花", promoSlug: "xiaoniaoyouliuhua", file: "/imgs/xiaoniaoyouliuhua.jpg", personaSlug: "generic-guide" },
  { name: "苏格拉底",   promoSlug: "sugeladi",          file: "/imgs/sugeladi.jpg",           personaSlug: "socrates" },
  { name: "哈利波特",   promoSlug: "halibote",          file: "/imgs/halibote.jpg",           personaSlug: "generic-guide" },
  { name: "卫宫胡桃",   promoSlug: "weigonghutao",      file: "/imgs/weigonghutao.jpg",       personaSlug: "generic-guide" },
];

export function getPromoBySlug(slug?: string | null): Promo {
  const p = PROMOS.find(x => x.promoSlug === slug);
  return p ?? PROMOS[0];
}
