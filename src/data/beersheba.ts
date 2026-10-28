// Беэр-Шева: торговый город среди морских контейнеров у старого турецкого вокзала.
// Пока процедурная графика; фон для Flow — по заготовке docs/guides/beersheba-blockout.png.
// Координаты — в метрах экранной плоскости (u вправо, v вниз), как в kibbutz.ts.

import type { LevelDef, PropDef } from '../world/level';

const STONE = 0xc9b48a;
const PLASTER = 0xc4b8a0;
const FLOOR = 0x7d7466;
const WOOD = 0x7a5a3a;
const CONTAINERS = [0x8a4a2e, 0x3e5a72, 0x4f6a48, 0xa8783a, 0x6d3b30, 0x56616a];

/** Ряд морских контейнеров вдоль стены города: от (u0, v0) с шагом 6.5 м. */
function containerRow(u0: number, v0: number, n: number, vertical: boolean, seed: number, stacked: number[] = []): PropDef[] {
  const out: PropDef[] = [];
  for (let i = 0; i < n; i++) {
    const u = vertical ? u0 : u0 + i * 6.5;
    const v = vertical ? v0 + i * 6.5 : v0;
    out.push({
      type: 'box', u, v, w: 6, d: 2.4, h: stacked.includes(i) ? 5.2 : 2.6,
      color: CONTAINERS[(seed + i * 5) % CONTAINERS.length], rot: vertical ? 90 : 0,
    });
  }
  return out;
}

export const BEERSHEBA: LevelDef = {
  id: 'beersheba',
  name: 'Беэр-Шева',
  cols: 50,
  rows: 60,
  groundColor: 0xc9a46c,
  props: [
    // Стена из контейнеров; ворота — разрыв в левой стене.
    ...containerRow(6, 3, 5, false, 0, [1, 3]),
    ...containerRow(6, 48.5, 5, false, 2, [2]),
    ...containerRow(35, 8, 7, true, 4, [0, 4]),
    ...containerRow(2.5, 8, 3, true, 1, [1]),
    ...containerRow(2.5, 38, 2, true, 3),
    { type: 'sandbags', u: 5.2, v: 23.6, w: 3 },
    { type: 'sandbags', u: 5.2, v: 35.4, w: 3 },
    { type: 'sign', u: 4.6, v: 36.8, text: 'באר שבע', sub: 'Беэр-Шева', id: 'citySign' },

    // Старый турецкий вокзал — лавка и склад Ицика.
    {
      type: 'building', u: 22, v: 12.5, w: 12, d: 6.5, h: 4.5, color: STONE, floor: 0x8a7a60, ruin: 0.2,
      doors: [{ side: 's', at: -2, width: 2.4 }], sign: 'תחנת רכבת', name: 'Турецкий вокзал',
    },
    {
      type: 'crate', u: 25.5, v: 11, id: 'itzikStore', locked: 80, name: 'Склад Ицика',
      desc: 'Железный шкаф с тремя замками. Ицик знает, что у него лежит, до последнего винта.',
      items: [{ id: 'ammo556', qty: 20 }, { id: 'stim', qty: 2 }, { id: 'asimon', qty: 80 }],
    },

    // Рынок перед вокзалом: прилавки под навесами, бочки, ящики.
    { type: 'box', u: 14.5, v: 23.5, w: 2.6, d: 1.2, h: 1, color: WOOD, low: true, name: 'Прилавок', desc: 'Пустой прилавок. Хозяин ушёл за товаром — или навсегда.', id: 'stall1' },
    { type: 'box', u: 27, v: 23.5, w: 2.6, d: 1.2, h: 1, color: WOOD, low: true },
    { type: 'box', u: 14.5, v: 30, w: 2.6, d: 1.2, h: 1, color: WOOD, low: true },
    { type: 'box', u: 27, v: 30, w: 2.6, d: 1.2, h: 1, color: WOOD, low: true },
    { type: 'barrel', u: 12.6, v: 23.2 },
    { type: 'barrel', u: 29.2, v: 23.4, color: 0x3f4f3a },
    { type: 'barrel', u: 29.4, v: 30.6 },
    { type: 'crate', u: 12.8, v: 30.4, id: 'marketCrate', name: 'Ящик с ветошью', items: [{ id: 'loof', qty: 1 }, { id: 'asimon', qty: 3 }] },
    { type: 'car', u: 9, v: 28, rot: 20, color: 0x8a6a4a },

    // Чайхана Наамы у южной стены.
    {
      type: 'building', u: 11, v: 41, w: 8, d: 5.5, h: 3.2, color: PLASTER, floor: FLOOR,
      doors: [{ side: 'n', at: 1.5, width: 2.2 }], name: 'Чайхана',
    },
    { type: 'box', u: 10, v: 41.5, w: 2, d: 0.9, h: 0.8, color: WOOD, low: true },

    // Белый контейнер врача.
    { type: 'box', u: 29, v: 40, w: 6, d: 2.6, h: 2.6, color: 0xd8d0c0, name: 'Контейнер врача', desc: 'Белый контейнер с красной звездой Давида на двери. Пахнет спиртом.', id: 'clinic' },
    { type: 'sign', u: 32.6, v: 43.4, text: 'מרפאה', sub: 'Врач', id: 'clinicSign' },

    { type: 'palm', u: 8, v: 17, h: 5.5 },
    { type: 'palm', u: 31, v: 19, h: 5 },
    { type: 'palm', u: 18, v: 44, h: 4.6 },
    { type: 'rubble', u: 33, v: 33, w: 2, d: 1.5, rot: 20 },
  ],
  spawns: [
    { id: 'guard', u: 6.6, v: 26.2 },
    { id: 'guard2', u: 6.6, v: 33 },
    { id: 'itzik', u: 21, v: 20.5 },
    { id: 'naama', u: 12.2, v: 41.4 },
    { id: 'doctor', u: 29, v: 42.6 },
    { id: 'citizen1', tpl: 'townsman', u: 18, v: 26.5 },
    { id: 'citizen2', tpl: 'townswoman', u: 23.5, v: 28.5 },
    { id: 'citizen3', tpl: 'townsman', u: 16, v: 36 },
  ],
  entry: { u: 1.6, v: 29.5 },
  exits: [{ col: 0, row: 28, w: 2, h: 12, to: 'worldmap', label: 'Пустошь Негева' }],
  paths: [
    [[0, 29.5], [8, 29], [14, 27], [21, 26.5], [28, 27]],
    [[21, 26.5], [20, 19], [20, 16]],
    [[14, 27], [12.5, 33], [12.5, 38]],
    [[21, 26.5], [25, 34], [29, 38.5]],
  ],
};
