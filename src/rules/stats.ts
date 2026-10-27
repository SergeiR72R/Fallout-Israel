// Ролевая система по правилам Fallout 1/2: 7 характеристик, 18 навыков,
// 3 «отмеченных» навыка, черты характера. Формулы — как в оригинале.
// Названия свои: система называется «Профиль» (как армейский медпрофиль).

export type StatId = 'st' | 'pe' | 'en' | 'ch' | 'in' | 'ag' | 'lk';
export type Stats = Record<StatId, number>;

export const STATS: { id: StatId; name: string; short: string; desc: string }[] = [
  { id: 'st', name: 'Сила', short: 'СИЛ', desc: 'Физическая мощь. Влияет на здоровье, переносимый вес и урон в ближнем бою.' },
  { id: 'pe', name: 'Восприятие', short: 'ВОС', desc: 'Зрение, слух, внимательность. Влияет на точность на дальней дистанции и очерёдность в бою.' },
  { id: 'en', name: 'Выносливость', short: 'ВЫН', desc: 'Стойкость и здоровье. Влияет на очки жизни и скорость заживления.' },
  { id: 'ch', name: 'Обаяние', short: 'ОБА', desc: 'Харизма и умение договариваться. Влияет на красноречие и торговлю.' },
  { id: 'in', name: 'Интеллект', short: 'ИНТ', desc: 'Ум и знания. Влияет на число очков навыков и варианты в диалогах.' },
  { id: 'ag', name: 'Ловкость', short: 'ЛОВ', desc: 'Координация и скорость. Влияет на очки действия, класс брони и стрелковые навыки.' },
  { id: 'lk', name: 'Удача', short: 'УДА', desc: 'Везение. Влияет на шанс критического попадания и азартные игры.' },
];

export type SkillId =
  | 'smallGuns' | 'bigGuns' | 'energy' | 'unarmed' | 'melee' | 'throwing'
  | 'firstAid' | 'doctor' | 'sneak' | 'lockpick' | 'steal' | 'traps'
  | 'science' | 'repair' | 'speech' | 'barter' | 'gambling' | 'outdoors';

export const SKILLS: { id: SkillId; name: string; base: (s: Stats) => number; desc: string }[] = [
  { id: 'smallGuns', name: 'Лёгкое оружие', base: (s) => 5 + 4 * s.ag, desc: 'Пистолеты, винтовки, пистолеты-пулемёты.' },
  { id: 'bigGuns', name: 'Тяжёлое оружие', base: (s) => 2 * s.ag, desc: 'Пулемёты, гранатомёты, огнемёты.' },
  { id: 'energy', name: 'Энергооружие', base: (s) => 2 * s.ag, desc: 'Лазерное и плазменное оружие довоенных лабораторий.' },
  { id: 'unarmed', name: 'Без оружия', base: (s) => 30 + 2 * (s.ag + s.st), desc: 'Кулаки, ноги, крав-мага.' },
  { id: 'melee', name: 'Холодное оружие', base: (s) => 20 + 2 * (s.ag + s.st), desc: 'Ножи, дубинки, копья.' },
  { id: 'throwing', name: 'Метание', base: (s) => 4 * s.ag, desc: 'Гранаты, ножи, камни.' },
  { id: 'firstAid', name: 'Первая помощь', base: (s) => 2 * (s.pe + s.in), desc: 'Лечение мелких ран. До трёх раз в сутки.' },
  { id: 'doctor', name: 'Врач', base: (s) => 5 + s.pe + s.in, desc: 'Лечение серьёзных ранений и травм.' },
  { id: 'sneak', name: 'Скрытность', base: (s) => 5 + 3 * s.ag, desc: 'Умение двигаться незамеченным.' },
  { id: 'lockpick', name: 'Взлом', base: (s) => 10 + s.pe + s.ag, desc: 'Открывание замков без ключа.' },
  { id: 'steal', name: 'Кража', base: (s) => 3 * s.ag, desc: 'Карманные кражи.' },
  { id: 'traps', name: 'Ловушки', base: (s) => 10 + s.pe + s.ag, desc: 'Обнаружение и обезвреживание ловушек и мин.' },
  { id: 'science', name: 'Наука', base: (s) => 4 * s.in, desc: 'Компьютеры, химия, электроника.' },
  { id: 'repair', name: 'Ремонт', base: (s) => 3 * s.in, desc: 'Починка механизмов и оружия.' },
  { id: 'speech', name: 'Красноречие', base: (s) => 5 * s.ch, desc: 'Убеждение, обман, переговоры.' },
  { id: 'barter', name: 'Торговля', base: (s) => 4 * s.ch, desc: 'Выгодный обмен и торг.' },
  { id: 'gambling', name: 'Азартные игры', base: (s) => 5 * s.lk, desc: 'Карты, кости, нарды на деньги.' },
  { id: 'outdoors', name: 'Выживание', base: (s) => 2 * (s.en + s.in), desc: 'Ориентирование в пустыне, поиск воды и пищи.' },
];

export type TraitId = 'gifted' | 'smallFrame' | 'bruiser' | 'fastShot' | 'finesse' | 'kamikaze';

export const TRAITS: { id: TraitId; name: string; desc: string }[] = [
  { id: 'gifted', name: 'Одарённый', desc: '+1 ко всем характеристикам. −10% ко всем навыкам, на 5 очков навыков меньше за уровень.' },
  { id: 'smallFrame', name: 'Хрупкое сложение', desc: '+1 к Ловкости, но переносимый вес меньше.' },
  { id: 'bruiser', name: 'Громила', desc: '+2 к Силе, но −2 очка действия.' },
  { id: 'fastShot', name: 'Быстрый стрелок', desc: 'Выстрел стоит на 1 ОД меньше, но прицельная стрельба невозможна.' },
  { id: 'finesse', name: 'Аккуратист', desc: '+10% к шансу критического попадания, но урон на 30% слабее.' },
  { id: 'kamikaze', name: 'Камикадзе', desc: '+5 к очерёдности, но нет естественного класса брони.' },
];

export interface Sheet {
  name: string;
  age: number;
  sex: 'm' | 'f';
  base: Stats;
  tags: SkillId[];
  traits: TraitId[];
  /** Очки навыков, вложенные игроком сверх базы (в процентах навыка). */
  skillAdd: Partial<Record<SkillId, number>>;
  level: number;
  xp: number;
  skillPoints: number;
}

export const STAT_MIN = 1, STAT_MAX = 10, FREE_STAT_POINTS = 5;

export function newSheet(): Sheet {
  return {
    name: 'Ноам', age: 25, sex: 'm',
    base: { st: 5, pe: 5, en: 5, ch: 5, in: 5, ag: 5, lk: 5 },
    tags: [], traits: [], skillAdd: {}, level: 1, xp: 0, skillPoints: 0,
  };
}

export function effStats(sh: Sheet): Stats {
  const s = { ...sh.base };
  if (sh.traits.includes('gifted')) for (const k of Object.keys(s) as StatId[]) s[k] += 1;
  if (sh.traits.includes('smallFrame')) s.ag += 1;
  if (sh.traits.includes('bruiser')) s.st += 2;
  for (const k of Object.keys(s) as StatId[]) s[k] = Math.max(1, Math.min(10, s[k]));
  return s;
}

export function skillValue(sh: Sheet, id: SkillId): number {
  const s = effStats(sh);
  const def = SKILLS.find((d) => d.id === id)!;
  let v = def.base(s) + (sh.tags.includes(id) ? 20 : 0) + (sh.skillAdd[id] ?? 0);
  if (sh.traits.includes('gifted')) v -= 10;
  return Math.max(0, v);
}

export interface Derived {
  maxHp: number; ap: number; ac: number; meleeDmg: number; carry: number;
  sequence: number; healRate: number; crit: number;
}

export function derived(sh: Sheet): Derived {
  const s = effStats(sh);
  const t = (id: TraitId) => sh.traits.includes(id);
  return {
    maxHp: 15 + s.st + 2 * s.en + (sh.level - 1) * (2 + Math.floor(s.en / 2)),
    ap: 5 + Math.floor(s.ag / 2) - (t('bruiser') ? 2 : 0),
    ac: t('kamikaze') ? 0 : s.ag,
    meleeDmg: Math.max(1, s.st - 5),
    carry: t('smallFrame') ? 25 + 15 * s.st : 25 + 25 * s.st,
    sequence: 2 * s.pe + (t('kamikaze') ? 5 : 0),
    healRate: Math.max(1, Math.floor(s.en / 3)),
    crit: s.lk + (t('finesse') ? 10 : 0),
  };
}

export const xpForLevel = (lvl: number) => (1000 * (lvl - 1) * lvl) / 2;

export function skillPointsPerLevel(sh: Sheet): number {
  return Math.max(1, 5 + 2 * effStats(sh).in - (sh.traits.includes('gifted') ? 5 : 0));
}

/** Стоимость повышения навыка на 1 шаг (как в Fallout: дороже после 100%). */
export function skillStepCost(value: number): number {
  if (value < 101) return 1;
  if (value < 126) return 2;
  if (value < 151) return 3;
  if (value < 176) return 4;
  return 5;
}
