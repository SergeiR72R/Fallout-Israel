// Перки в духе Fallout 2: один на каждые три уровня, у многих несколько рангов,
// требования к уровню и характеристикам. Действие считается в stats.ts и combat.

import type { Sheet, SkillId, StatId } from './stats';

export type PerkId =
  | 'toughness' | 'strongBack' | 'bonusHth' | 'actionBoy' | 'earlierSequence' | 'fasterHealing'
  | 'moreCriticals' | 'lifegiver' | 'sharpshooter' | 'educated' | 'swiftLearner'
  | 'thief' | 'medic' | 'negotiator' | 'survivalist';

export interface PerkDef {
  id: PerkId;
  name: string;
  desc: string;
  ranks: number;
  level: number;
  req?: Partial<Record<StatId, number>>;
}

export const PERKS: PerkDef[] = [
  { id: 'toughness', name: 'Дублёная шкура', ranks: 3, level: 3, req: { en: 6 },
    desc: 'Солнце и песок закалили кожу. +10% к сопротивлению урону за ранг.' },
  { id: 'strongBack', name: 'Спина верблюда', ranks: 3, level: 3, req: { st: 6, en: 6 },
    desc: 'Вы таскали канистры с водой с детства. +50 фунтов к переносимому весу за ранг.' },
  { id: 'bonusHth', name: 'Тяжёлая рука', ranks: 3, level: 3, req: { st: 6, ag: 6 },
    desc: '+2 к урону в ближнем бою за ранг.' },
  { id: 'earlierSequence', name: 'Реакция сапёра', ranks: 3, level: 3, req: { pe: 6 },
    desc: 'Вы действуете раньше других. +2 к очерёдности за ранг.' },
  { id: 'fasterHealing', name: 'Быстрое заживление', ranks: 3, level: 3, req: { en: 6 },
    desc: 'Раны затягиваются быстрее. +2 к скорости лечения за ранг.' },
  { id: 'swiftLearner', name: 'Ешива', ranks: 3, level: 3, req: { in: 4 },
    desc: 'Годы учёбы в миклате не прошли даром. +5% к получаемому опыту за ранг.' },
  { id: 'educated', name: 'Книжный червь', ranks: 3, level: 6, req: { in: 6 },
    desc: '+2 очка навыков за каждый новый уровень за ранг.' },
  { id: 'thief', name: 'Ловкие пальцы', ranks: 1, level: 3,
    desc: '+10% к навыкам Скрытность, Взлом, Кража и Ловушки.' },
  { id: 'medic', name: 'Санитар ЦАХАЛа', ranks: 1, level: 3, req: { in: 5 },
    desc: '+10% к навыкам Первая помощь и Врач.' },
  { id: 'negotiator', name: 'Рыночный торговец', ranks: 1, level: 6, req: { ch: 5 },
    desc: '+10% к навыкам Красноречие и Торговля. На рынке Беэр-Шевы торгуются до хрипоты.' },
  { id: 'survivalist', name: 'Сын пустыни', ranks: 1, level: 3, req: { en: 6, in: 6 },
    desc: 'Вы читаете Негев как карту. +25% к навыку Выживание.' },
  { id: 'moreCriticals', name: 'Глаз-алмаз', ranks: 3, level: 6, req: { lk: 6 },
    desc: '+5% к шансу критического попадания за ранг.' },
  { id: 'sharpshooter', name: 'Снайпер', ranks: 1, level: 9, req: { pe: 7, in: 6 },
    desc: 'Восприятие для расчёта дальности стрельбы считается на 2 выше.' },
  { id: 'lifegiver', name: 'Живучий', ranks: 2, level: 12, req: { en: 4 },
    desc: '+4 очка жизни за каждый уровень персонажа за ранг.' },
  { id: 'actionBoy', name: 'Неутомимый', ranks: 2, level: 12, req: { ag: 5 },
    desc: '+1 очко действия в бою за ранг.' },
];

export const PERK_EVERY = 3;

export const perkRank = (sh: Sheet, id: PerkId) => sh.perks?.[id] ?? 0;

/** Перки, которые можно взять сейчас (по уровню, характеристикам и рангам). */
export function availablePerks(sh: Sheet, stats: Record<StatId, number>): PerkDef[] {
  return PERKS.filter((p) => perkRank(sh, p.id) < p.ranks && sh.level >= p.level
    && Object.entries(p.req ?? {}).every(([k, v]) => stats[k as StatId] >= (v as number)));
}

/** Прибавки к навыкам от перков. */
export function perkSkillBonus(sh: Sheet, id: SkillId): number {
  let b = 0;
  if (perkRank(sh, 'thief') && ['sneak', 'lockpick', 'steal', 'traps'].includes(id)) b += 10;
  if (perkRank(sh, 'medic') && ['firstAid', 'doctor'].includes(id)) b += 10;
  if (perkRank(sh, 'negotiator') && ['speech', 'barter'].includes(id)) b += 10;
  if (perkRank(sh, 'survivalist') && id === 'outdoors') b += 25;
  return b;
}
