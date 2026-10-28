// Шаблоны персонажей. Расстановка — в описаниях локаций (spawns: id + tpl).

import type { CritterDef } from '../world/critter';

export const CRITTERS: Record<string, CritterDef> = {
  player: {
    id: 'player', sprite: 'hero', name: 'Вы', kind: 'human', faction: 'player', desc: 'Это вы.',
    look: { skin: 0xc8a07a, cloth: 0x5b7690, cloth2: 0x33393e, hair: 0x2b1d12, stripe: 0xd0802c },
    inventory: [{ id: 'knife', qty: 1 }, { id: 'ammo9', qty: 16 }, { id: 'stim', qty: 2 }, { id: 'asimon', qty: 20 }],
    hand: 'pistol9',
  },
  batya: {
    id: 'batya', sprite: 'batya', name: 'Батья', acc: 'Батью', kind: 'human', faction: 'kibbutz',
    portrait: { image: 'portraits/batya.jpg', idle: 'portraits/batya-idle.mp4', talk: 'portraits/batya-talk.mp4' },
    desc: 'Пожилая женщина в выцветшей панамке-тембель. Взгляд — как у сержанта на утреннем построении.',
    look: { skin: 0xb88a62, cloth: 0x8a8370, cloth2: 0x5a5040, hair: 0xd8d4cc, hat: 'tembel', female: true },
    sheet: { base: { st: 4, pe: 7, en: 5, ch: 7, in: 8, ag: 4, lk: 6 } },
    hand: 'knife', dialog: 'batya', trader: true,
    inventory: [{ id: 'loof', qty: 3 }, { id: 'asimon', qty: 120 }],
  },
  shlomo: {
    id: 'shlomo', sprite: 'shlomo', name: 'Шломо', kind: 'human', faction: 'kibbutz',
    portrait: { image: 'portraits/shlomo.jpg', idle: 'portraits/shlomo-idle.mp4', talk: 'portraits/shlomo-talk.mp4' },
    desc: 'Часовой с древним пистолетом. Бородатый, загорелый до черноты, не выпускает оружия из рук.',
    look: { skin: 0x9c6c48, cloth: 0x5d6b3a, cloth2: 0x3f4a26, hair: 0x1a120a, hat: 'helmet', beard: true },
    sheet: { base: { st: 6, pe: 6, en: 6, ch: 4, in: 4, ag: 6, lk: 5 }, tags: ['smallGuns'] },
    hand: 'pistol9', dialog: 'shlomo',
    inventory: [{ id: 'ammo9', qty: 8 }],
    barks: ['Опять у башни шуршат…', 'Не отходи далеко от ворот.', 'Хамсин крепчает.', 'Батья у столовой. Иди к ней.', 'Из миклата? Ну и ну.'],
  },
  scorpion: {
    id: 'scorpion', sprite: 'scorpion', name: 'Скорпион', acc: 'скорпиона', kind: 'scorpion', faction: 'monster',
    desc: 'Гигантский скорпион размером с собаку. Жало блестит от яда.',
    monster: { hp: 12, ap: 5, ac: 3, skill: 45, seq: 6, crit: 3, pe: 5, dt: 0, dr: 0, xp: 60, weapon: 'claw' },
    inventory: [{ id: 'sting', qty: 1 }],
  },
  scorpionBig: {
    id: 'scorpionBig', sprite: 'scorpionBig', name: 'Матка скорпионов', acc: 'матку скорпионов', kind: 'bigScorpion', faction: 'monster',
    desc: 'Огромная самка скорпиона. Панцирь в шрамах от пуль — кто-то уже пытался.',
    monster: { hp: 22, ap: 8, ac: 5, skill: 55, seq: 8, crit: 5, pe: 6, dt: 1, dr: 10, xp: 150, weapon: 'bigClaw' },
    inventory: [{ id: 'sting', qty: 2 }],
  },
  raider: {
    id: 'raider', sprite: 'raider', name: 'Мародёр', acc: 'мародёра', kind: 'human', faction: 'raiders', xp: 75,
    desc: 'Бородатый мародёр в кожаной разгрузке. Смотрит на ваш комбинезон, как на добычу.',
    sheet: { base: { st: 6, pe: 5, en: 5, ch: 3, in: 4, ag: 6, lk: 4 }, tags: ['smallGuns'] },
    hand: 'pistol9',
    inventory: [{ id: 'ammo9', qty: 10 }, { id: 'asimon', qty: 8 }, { id: 'loof', qty: 1 }],
    barks: ['Миклатник! Снимай комбинезон!', 'Асимоны есть? Сейчас проверим.', 'Пустошь любит щедрых.'],
  },
  raiderKnife: {
    id: 'raiderKnife', sprite: 'raider', name: 'Мародёр с ножом', acc: 'мародёра', kind: 'human', faction: 'raiders', xp: 60,
    desc: 'Жилистый мародёр с армейским ножом. Улыбается одной половиной рта.',
    sheet: { base: { st: 7, pe: 5, en: 6, ch: 3, in: 3, ag: 7, lk: 4 }, tags: ['melee'] },
    hand: 'knife',
    inventory: [{ id: 'asimon', qty: 5 }],
    barks: ['Я быстро. Ты даже не заметишь.'],
  },
  trader: {
    id: 'trader', sprite: 'shlomo', name: 'Мордехай', acc: 'Мордехая', kind: 'human', faction: 'traders',
    portrait: { image: 'portraits/mordechai.jpg', idle: 'portraits/mordechai-idle.mp4', talk: 'portraits/mordechai-talk.mp4' },
    desc: 'Караванщик из Беэр-Шевы. Пыльная каска, тяжёлая разгрузка, в глазах — калькулятор.',
    sheet: { base: { st: 6, pe: 6, en: 6, ch: 6, in: 6, ag: 5, lk: 6 }, tags: ['barter', 'smallGuns'] },
    hand: 'pistol9', dialog: 'trader',
    trader: true,
    inventory: [
      { id: 'stim', qty: 4 }, { id: 'ammo9', qty: 60 }, { id: 'jacket', qty: 1 }, { id: 'loof', qty: 6 },
      { id: 'water', qty: 5 }, { id: 'knife', qty: 1 }, { id: 'pistol9', qty: 1, loaded: 0 }, { id: 'asimon', qty: 300 },
    ],
    barks: ['Вода, патроны, шприц-тюбики. Всё честно.', 'Беэр-Шева? Два дня пути, если повезёт.'],
  },
};
