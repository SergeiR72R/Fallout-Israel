import type { SkillId } from './stats';

export type ItemKind = 'weapon' | 'armor' | 'ammo' | 'drug' | 'misc' | 'money';

export interface WeaponDef {
  skill: SkillId;
  dmg: [number, number];
  ap: number;
  range: number;
  melee?: boolean;
  ammo?: string;
  mag?: number;
  /** Добавлять урон ближнего боя от Силы. */
  addMelee?: boolean;
  verb: string;
}

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  weight: number;
  value: number;
  desc: string;
  /** Иконка: путь к картинке в public/icons (появится, когда будут ассеты). */
  icon?: string;
  /** Символ-заглушка вместо иконки. */
  glyph: string;
  weapon?: WeaponDef;
  armor?: { ac: number; dt: number; dr: number };
  heal?: [number, number];
}

export const ITEMS: Record<string, ItemDef> = {
  fist: {
    id: 'fist', name: 'Кулак', kind: 'weapon', weight: 0, value: 0, glyph: '✊',
    desc: 'Старый добрый кулак.',
    weapon: { skill: 'unarmed', dmg: [1, 2], ap: 3, range: 1, melee: true, addMelee: true, verb: 'бьёте' },
  },
  knife: {
    id: 'knife', name: 'Армейский нож', kind: 'weapon', weight: 1, value: 40, glyph: '🗡',
    desc: 'Нож из довоенного армейского набора. Лезвие в зазубринах, но острое.',
    weapon: { skill: 'melee', dmg: [1, 6], ap: 3, range: 1, melee: true, addMelee: true, verb: 'режете' },
  },
  pistol9: {
    id: 'pistol9', name: '9-мм пистолет «Шмира»', kind: 'weapon', weight: 3, value: 250, glyph: '🔫',
    desc: 'Пистолет охраны убежища. Магазин на 10 патронов. Надёжный, как скала.',
    weapon: { skill: 'smallGuns', dmg: [5, 12], ap: 5, range: 20, ammo: 'ammo9', mag: 10, verb: 'стреляете в' },
  },
  ammo9: {
    id: 'ammo9', name: 'Патроны 9 мм', kind: 'ammo', weight: 0, value: 2, glyph: '⁍',
    desc: 'Стандартный пистолетный патрон. В пустоши ценится не меньше воды.',
  },
  stim: {
    id: 'stim', name: 'Шприц-тюбик', kind: 'drug', weight: 0, value: 175, glyph: '💉', heal: [12, 20],
    desc: 'Армейский шприц-тюбик с регенерирующим составом. Восстанавливает здоровье.',
  },
  loof: {
    id: 'loof', name: 'Банка «Лоф»', kind: 'drug', weight: 1, value: 10, glyph: '🥫', heal: [2, 5],
    desc: 'Армейская тушёнка. Срок годности истёк сто лет назад, но вкус не изменился.',
  },
  jacket: {
    id: 'jacket', name: 'Кожаная куртка', kind: 'armor', weight: 5, value: 250, glyph: '🧥',
    desc: 'Потёртая кожаная куртка. Лучше, чем ничего.',
    armor: { ac: 8, dt: 0, dr: 20 },
  },
  vest: {
    id: 'vest', name: 'Армейский бронежилет', kind: 'armor', weight: 10, value: 700, glyph: '🦺',
    desc: 'Довоенный бронежилет с керамическими пластинами. Одна пластина треснула.',
    armor: { ac: 15, dt: 2, dr: 25 },
  },
  sting: {
    id: 'sting', name: 'Жало скорпиона', kind: 'misc', weight: 1, value: 30, glyph: '🦂',
    desc: 'Ядовитое жало гигантского скорпиона. Знахари делают из него противоядие.',
  },
  asimon: {
    id: 'asimon', name: 'Асимон', kind: 'money', weight: 0, value: 1, glyph: '◉',
    desc: 'Жетон для таксофона с прорезью посередине. Главная валюта пустоши.',
  },
  claw: {
    id: 'claw', name: 'Клешни и жало', kind: 'weapon', weight: 0, value: 0, glyph: '🦂',
    desc: '',
    weapon: { skill: 'unarmed', dmg: [1, 4], ap: 4, range: 1, melee: true, verb: 'жалит' },
  },
  bigClaw: {
    id: 'bigClaw', name: 'Клешни и жало', kind: 'weapon', weight: 0, value: 0, glyph: '🦂',
    desc: '',
    weapon: { skill: 'unarmed', dmg: [2, 6], ap: 4, range: 1, melee: true, verb: 'жалит' },
  },
};

export interface Stack { id: string; qty: number; loaded?: number }

export const def = (s: Stack | string) => ITEMS[typeof s === 'string' ? s : s.id];

export const stackable = (id: string) => {
  const k = ITEMS[id].kind;
  return k === 'ammo' || k === 'money' || k === 'drug' || k === 'misc';
};

export function addItem(inv: Stack[], id: string, qty = 1, loaded?: number) {
  if (stackable(id)) {
    const s = inv.find((x) => x.id === id);
    if (s) { s.qty += qty; return; }
    inv.push({ id, qty });
    return;
  }
  for (let i = 0; i < qty; i++) inv.push({ id, qty: 1, loaded: loaded ?? (ITEMS[id].weapon?.mag ? 0 : undefined) });
}

export function countItem(inv: Stack[], id: string) {
  return inv.filter((s) => s.id === id).reduce((a, s) => a + s.qty, 0);
}

export function removeItem(inv: Stack[], id: string, qty = 1): number {
  let left = qty;
  for (let i = inv.length - 1; i >= 0 && left > 0; i--) {
    const s = inv[i];
    if (s.id !== id) continue;
    const take = Math.min(left, s.qty);
    s.qty -= take;
    left -= take;
    if (s.qty <= 0) inv.splice(i, 1);
  }
  return qty - left;
}

export const invWeight = (inv: Stack[]) => inv.reduce((a, s) => a + def(s).weight * s.qty, 0);
