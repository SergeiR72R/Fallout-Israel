// Формулы боя в духе Fallout 2: шанс попадания от навыка, дистанции,
// Восприятия и класса брони цели; прицельные выстрелы; криты от Удачи;
// урон режется порогом (DT) и сопротивлением (DR) брони.

import { clamp, rand, roll100 } from '../core/util';

export type AimPart = 'torso' | 'head' | 'eyes' | 'groin' | 'larm' | 'rarm' | 'lleg' | 'rleg';

export const AIM_PARTS: { id: AimPart; name: string; mod: number; critMsg: string }[] = [
  { id: 'head', name: 'Голова', mod: -40, critMsg: 'оглушая' },
  { id: 'eyes', name: 'Глаза', mod: -60, critMsg: 'ослепляя' },
  { id: 'torso', name: 'Торс', mod: 0, critMsg: 'выбивая дух' },
  { id: 'groin', name: 'Пах', mod: -30, critMsg: 'и цель сгибается пополам' },
  { id: 'larm', name: 'Левая рука', mod: -30, critMsg: 'ломая кость' },
  { id: 'rarm', name: 'Правая рука', mod: -30, critMsg: 'ломая кость' },
  { id: 'lleg', name: 'Левая нога', mod: -20, critMsg: 'сбивая с ног' },
  { id: 'rleg', name: 'Правая нога', mod: -20, critMsg: 'сбивая с ног' },
];

const BEAST_PARTS: Partial<Record<AimPart, string>> = {
  larm: 'Левая клешня', rarm: 'Правая клешня', groin: 'Хвост', lleg: 'Передние лапы', rleg: 'Задние лапы',
};

/** Название части тела; у скорпионов — клешни, хвост и лапы. */
export const partName = (p: AimPart, beast = false) =>
  (beast && BEAST_PARTS[p]) || AIM_PARTS.find((a) => a.id === p)!.name;

export interface HitInput {
  skill: number;
  targetAc: number;
  distance: number;
  perception: number;
  melee: boolean;
  aim: AimPart;
}

export function hitChance(h: HitInput): number {
  const aimMod = AIM_PARTS.find((a) => a.id === h.aim)!.mod;
  let chance = h.skill - h.targetAc + aimMod;
  if (!h.melee) {
    // Первые 2×(ВОС−2) гексов бесплатны, дальше −4% за гекс.
    const free = Math.max(0, 2 * (h.perception - 2));
    chance -= 4 * Math.max(0, h.distance - free);
  }
  return clamp(Math.round(chance), 5, 95);
}

export interface AttackResult {
  hit: boolean;
  crit: boolean;
  damage: number;
  roll: number;
}

export interface DamageInput {
  dmg: [number, number];
  bonus: number;
  critChance: number;
  aim: AimPart;
  dt: number;
  dr: number;
  finesse: boolean;
}

export function resolveAttack(chance: number, d: DamageInput): AttackResult {
  const roll = roll100();
  if (roll > chance) return { hit: false, crit: false, damage: 0, roll };
  const aimMod = AIM_PARTS.find((a) => a.id === d.aim)!.mod;
  const critChance = d.critChance + Math.floor(-aimMod / 2);
  const crit = roll100() <= critChance;
  let dmg = rand(d.dmg[0], d.dmg[1]) + d.bonus;
  let dt = d.dt;
  let dr = d.dr + (d.finesse ? 30 : 0);
  if (crit) {
    dmg *= d.aim === 'eyes' || d.aim === 'head' ? 3 : 2;
    dt = 0; // крит проходит сквозь порог брони
  }
  dmg = Math.max(0, dmg - dt);
  dmg = Math.floor(dmg * (1 - clamp(dr, 0, 90) / 100));
  return { hit: true, crit, damage: crit ? Math.max(1, dmg) : dmg, roll };
}
