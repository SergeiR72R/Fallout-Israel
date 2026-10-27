// Первая локация: руины кибуца Нахаль-Ор (вымышленный) в северном Негеве.
// Координаты декораций — в метрах экранной плоскости (u вправо, v вниз),
// поворот — относительно сетки тайлов, как стены в Fallout.

import type { LevelDef } from '../world/level';
import type { CritterDef } from '../world/critter';

const CONCRETE = 0xa39a88;
const PLASTER = 0xb8a98c;
const FLOOR = 0x7d7466;

export const KIBBUTZ: LevelDef = {
  id: 'kibbutz',
  name: 'Кибуц Нахаль-Ор',
  cols: 48,
  rows: 56,
  groundColor: 0xb09872,
  props: [
    { type: 'hatch', u: 6, v: 43 },
    {
      type: 'building', u: 11, v: 21, w: 10, d: 7, h: 3.4, color: PLASTER, floor: FLOOR, ruin: 0.55,
      doors: [{ side: 's', at: 0.5, width: 2.2 }, { side: 'e', at: 1, width: 2.2 }],
      name: 'Хадар-охель',
    },
    { type: 'crate', u: 9, v: 19, id: 'diningCrate', name: 'Ящик в столовой', items: [{ id: 'loof', qty: 2 }, { id: 'ammo9', qty: 12 }, { id: 'asimon', qty: 7 }] },
    {
      type: 'building', u: 27.5, v: 25, w: 6, d: 5, h: 3, color: CONCRETE, floor: FLOOR, ruin: 0.35,
      doors: [{ side: 'w', at: 0, width: 2.2 }],
    },
    {
      type: 'crate', u: 28.2, v: 25.6, id: 'armyCrate', locked: 25, name: 'Армейский ящик',
      items: [{ id: 'vest', qty: 1 }, { id: 'stim', qty: 1 }, { id: 'ammo9', qty: 20 }],
    },
    {
      type: 'building', u: 22, v: 37, w: 5.5, d: 5, h: 3, color: PLASTER, floor: FLOOR, ruin: 0.75,
      doors: [{ side: 'n', at: 0, width: 2.2 }, { side: 'e', at: 0, width: 2.2 }],
    },
    { type: 'tower', u: 25, v: 8.5 },
    { type: 'palm', u: 3.5, v: 30, h: 5.5 },
    { type: 'palm', u: 17, v: 30.5, h: 4.6 },
    { type: 'palm', u: 32.5, v: 34, h: 5 },
    { type: 'palm', u: 5, v: 10, h: 6 },
    { type: 'palm', u: 33, v: 15, h: 4.2 },
    { type: 'car', u: 13, v: 37.5, rot: 25, color: 0x6e7f86 },
    { type: 'barrel', u: 17.5, v: 24 },
    { type: 'barrel', u: 18.2, v: 24.8, color: 0x3f4f3a },
    { type: 'barrel', u: 31.5, v: 42 },
    { type: 'rubble', u: 19, v: 15, w: 2.5, d: 1.8, rot: 10 },
    { type: 'rubble', u: 8, v: 31, w: 1.8, d: 1.5 },
    { type: 'rubble', u: 30, v: 5, w: 2, d: 2 },
    { type: 'sign', u: 17, v: 45.5, text: 'נחל אור', sub: 'Кибуц Нахаль-Ор', id: 'gateSign' },
    { type: 'sandbags', u: 22, v: 46.5, w: 2.8, rot: -30 },
    { type: 'sandbags', u: 12, v: 46.5, w: 2.8, rot: -30 },
    {
      type: 'box', u: 30.5, v: 10.5, w: 1.2, d: 0.9, h: 0.25, color: 0xd8d0bc, low: true,
      name: 'Кости', desc: 'Обглоданные кости. Козьи. Кажется, козьи.', id: 'bones',
    },
  ],
  spawns: [
    { id: 'player', col: 10, row: 46 },
    { id: 'batya', col: 16, row: 31 },
    { id: 'shlomo', col: 23, row: 51 },
    { id: 'scorp1', col: 29, row: 9 },
    { id: 'scorp2', col: 37, row: 13 },
    { id: 'scorpBig', col: 34, row: 4 },
  ],
  exits: [{ col: 0, row: 8, w: 2, h: 14, to: 'worldmap', label: 'Пустошь Негева' }],
  paths: [
    [[6, 43], [10, 40], [13, 33], [12, 26], [11, 22]],
    [[17, 48], [16, 42], [13, 33]],
    [[12, 26], [18, 26], [24, 25], [27, 25]],
    [[18, 26], [21, 18], [24, 12], [25, 9]],
    [[11, 21], [6, 18], [0, 13]],
    [[16, 42], [21, 37]],
  ],
};

export const CRITTERS: Record<string, CritterDef> = {
  player: {
    id: 'player', name: 'Вы', kind: 'human', faction: 'player', desc: 'Это вы.',
    look: { skin: 0xc8a07a, cloth: 0x5b7690, cloth2: 0x33393e, hair: 0x2b1d12, stripe: 0xd0802c },
    inventory: [{ id: 'knife', qty: 1 }, { id: 'ammo9', qty: 16 }, { id: 'stim', qty: 2 }, { id: 'asimon', qty: 20 }],
    hand: 'pistol9',
  },
  batya: {
    id: 'batya', name: 'Батья', acc: 'Батью', kind: 'human', faction: 'kibbutz',
    desc: 'Пожилая женщина в выцветшей панамке-тембель. Взгляд — как у сержанта на утреннем построении.',
    look: { skin: 0xb88a62, cloth: 0x8a8370, cloth2: 0x5a5040, hair: 0xd8d4cc, hat: 'tembel', female: true },
    sheet: { base: { st: 4, pe: 7, en: 5, ch: 7, in: 8, ag: 4, lk: 6 } },
    hand: 'knife', dialog: 'batya',
    inventory: [{ id: 'loof', qty: 3 }, { id: 'asimon', qty: 120 }],
  },
  shlomo: {
    id: 'shlomo', name: 'Шломо', kind: 'human', faction: 'kibbutz',
    desc: 'Часовой с древним пистолетом. Бородатый, загорелый до черноты, не выпускает оружия из рук.',
    look: { skin: 0x9c6c48, cloth: 0x5d6b3a, cloth2: 0x3f4a26, hair: 0x1a120a, hat: 'helmet', beard: true },
    sheet: { base: { st: 6, pe: 6, en: 6, ch: 4, in: 4, ag: 6, lk: 5 }, tags: ['smallGuns'] },
    hand: 'pistol9',
    inventory: [{ id: 'ammo9', qty: 8 }],
    barks: ['Опять у башни шуршат…', 'Не отходи далеко от ворот.', 'Хамсин крепчает.', 'Батья у столовой. Иди к ней.', 'Из миклата? Ну и ну.'],
  },
  scorp1: {
    id: 'scorp1', name: 'Скорпион', acc: 'скорпиона', kind: 'scorpion', faction: 'monster',
    desc: 'Гигантский скорпион размером с собаку. Жало блестит от яда.',
    monster: { hp: 12, ap: 5, ac: 3, skill: 45, seq: 6, crit: 3, pe: 5, dt: 0, dr: 0, xp: 60, weapon: 'claw' },
    inventory: [{ id: 'sting', qty: 1 }],
  },
  scorp2: {
    id: 'scorp2', name: 'Скорпион', acc: 'скорпиона', kind: 'scorpion', faction: 'monster',
    desc: 'Гигантский скорпион размером с собаку. Жало блестит от яда.',
    monster: { hp: 12, ap: 5, ac: 3, skill: 45, seq: 6, crit: 3, pe: 5, dt: 0, dr: 0, xp: 60, weapon: 'claw' },
    inventory: [{ id: 'sting', qty: 1 }],
  },
  scorpBig: {
    id: 'scorpBig', name: 'Матка скорпионов', acc: 'матку скорпионов', kind: 'bigScorpion', faction: 'monster',
    desc: 'Огромная самка скорпиона. Панцирь в шрамах от пуль — кто-то уже пытался.',
    monster: { hp: 22, ap: 8, ac: 5, skill: 55, seq: 8, crit: 5, pe: 6, dt: 1, dr: 10, xp: 150, weapon: 'bigClaw' },
    inventory: [{ id: 'sting', qty: 2 }],
  },
};
