// Карта мира: северный Негев. Координаты — в километрах от левого верхнего угла.
// Как в Fallout: путешествие по карте, время идёт, случаются встречи.

import type { LevelDef, PropDef, SpawnDef } from '../world/level';
import { KIBBUTZ } from './kibbutz';

export interface WorldLocation {
  id: string;
  name: string;
  x: number;
  y: number;
  /** Локация, в которую можно войти. */
  level?: string;
  def?: LevelDef;
  /** Видна на карте с самого начала или после флага. */
  knownFrom?: 'start' | string;
  /** Что сказать, если войти пока нельзя. */
  closed?: string;
  desc: string;
}

export type EncounterType = 'scorpions' | 'raiders' | 'trader' | 'ruins';

export const WORLD = {
  width: 160,
  height: 100,
  /** Пешком по пустыне, км/ч. */
  speed: 4.5,
  start: { x: 58, y: 38 },
  locations: [
    {
      id: 'kibbutz', name: 'Кибуц Нахаль-Ор', x: 58, y: 38, level: 'kibbutz', def: KIBBUTZ, knownFrom: 'start',
      desc: 'Руины кибуца над миклатом № 7. Батья, Шломо и водонапорная башня.',
    },
    {
      id: 'miklat', name: 'Миклат № 7', x: 50, y: 46, knownFrom: 'start',
      closed: 'Гермодверь миклата закрыта изнутри. Без мембраны вас не впустят.',
      desc: 'Ваше убежище. Воды осталось на считанные дни.',
    },
    {
      id: 'beersheba', name: 'Беэр-Шева', x: 92, y: 55, knownFrom: 'knowsBeersheva',
      closed: 'Над воротами Беэр-Шевы висит табличка «Закрыто на учёт». Город появится в следующей версии.',
      desc: 'Торговый город среди морских контейнеров. Здесь можно найти Ицика-Мусорщика.',
    },
    {
      id: 'coast', name: 'Побережье', x: 14, y: 22, knownFrom: 'knowsCoast',
      closed: 'Счётчик Гейгера трещит без остановки. Пока туда лучше не соваться.',
      desc: 'Довоенные опреснители. По ночам светится.',
    },
  ] as WorldLocation[],
};

/** Встречи по типу местности: вероятность встречи за час пути и веса типов. */
export const ENCOUNTERS = {
  perHour: 0.09,
  weights: { scorpions: 35, raiders: 35, trader: 18, ruins: 12 } as Record<EncounterType, number>,
  names: {
    scorpions: 'Гнездо гигантских скорпионов',
    raiders: 'Засада мародёров',
    trader: 'Караван из Беэр-Шевы',
    ruins: 'Развалины придорожной заправки',
  } as Record<EncounterType, string>,
  seen: {
    scorpions: 'Вы замечаете в песке блестящие панцири. Скорпионы.',
    raiders: 'Вы замечаете дым костра и вооружённых людей у дороги.',
    trader: 'На горизонте показывается караван.',
    ruins: 'Вы видите развалины у старой дороги.',
  } as Record<EncounterType, string>,
};

export function rollEncounter(): EncounterType {
  const w = ENCOUNTERS.weights;
  let r = Math.random() * Object.values(w).reduce((a, b) => a + b, 0);
  for (const [k, v] of Object.entries(w) as [EncounterType, number][]) {
    if ((r -= v) < 0) return k;
  }
  return 'scorpions';
}

/** Детерминированный генератор случайных чисел (одна и та же встреча из одного seed). */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Сгенерировать локацию случайной встречи. */
export function makeEncounter(type: EncounterType, seed: number): LevelDef {
  const R = rng(seed);
  const cols = 40, rows = 46;
  const U = 0.75 * (cols - 1), V = 0.866 * (rows - 0.5);
  const props: PropDef[] = [];
  const spawns: SpawnDef[] = [];
  const free = (u: number, v: number) => props.every((p) => Math.hypot(p.u - u, p.v - v) > 3.2)
    && Math.hypot(u - 4, v - V / 2) > 5;
  const place = (n: number, make: (u: number, v: number) => PropDef) => {
    for (let i = 0, tries = 0; i < n && tries < 200; tries++) {
      const u = 3 + R() * (U - 6), v = 4 + R() * (V - 8);
      if (!free(u, v)) continue;
      props.push(make(u, v));
      i++;
    }
  };
  place(5 + Math.floor(R() * 4), (u, v) => ({ type: 'rubble', u, v, w: 1.2 + R() * 1.8, d: 1 + R() * 1.4, rot: R() * 90 }));
  place(4 + Math.floor(R() * 4), (u, v) => ({ type: 'rock', u, v, r: 0.5 + R() * 1.1 }));
  place(2, (u, v) => ({ type: 'barrel', u, v, color: R() < 0.5 ? 0x5a4a32 : 0x3f4f3a }));
  if (R() < 0.6) place(1, (u, v) => ({ type: 'car', u, v, rot: R() * 180, color: [0x6e7f86, 0x8a6a4a, 0x5d6b3a][Math.floor(R() * 3)] }));
  if (R() < 0.5) place(1, (u, v) => ({ type: 'sandbags', u, v, w: 2.4 + R() * 2, rot: R() * 180 }));

  const enemyU = U * 0.62, enemyV = V * 0.5;
  const around = (n: number, tpl: string, spread = 4) => {
    for (let i = 0; i < n; i++) {
      spawns.push({ id: `${tpl}${i}`, tpl, u: enemyU + (R() - 0.3) * spread * 2, v: enemyV + (R() - 0.5) * spread * 2.4 });
    }
  };
  if (type === 'scorpions') {
    around(2 + Math.floor(R() * 2), 'scorpion');
    if (R() < 0.35) spawns.push({ id: 'queen', tpl: 'scorpionBig', u: enemyU + 4, v: enemyV - 3 });
  } else if (type === 'raiders') {
    around(1 + Math.floor(R() * 2), 'raider', 3);
    around(1, 'raiderKnife', 3);
    props.push({ type: 'crate', u: enemyU + 3, v: enemyV + 1, id: 'stash', name: 'Тайник мародёров', items: [{ id: 'ammo9', qty: 6 + Math.floor(R() * 10) }, { id: 'asimon', qty: 5 + Math.floor(R() * 20) }, { id: 'water', qty: 1 }] });
  } else if (type === 'trader') {
    spawns.push({ id: 'trader', tpl: 'trader', u: U * 0.5, v: V * 0.48 });
    props.push({ type: 'crate', u: U * 0.5 + 2.2, v: V * 0.48 - 1, id: 'cargo', name: 'Тюки каравана', locked: 95, desc: 'Тюки каравана, перетянутые проволокой. Чужое.', items: [{ id: 'water', qty: 3 }] });
  } else {
    props.push({
      type: 'building', u: U * 0.55, v: V * 0.45, w: 7, d: 5, h: 3, color: 0xb8ab90, floor: 0x7d7466, ruin: 0.6,
      doors: [{ side: 's', at: -1, width: 2.2 }, { side: 'w', at: 0.5, width: 2.2 }],
    });
    props.push({ type: 'crate', u: U * 0.55 + 0.6, v: V * 0.45 - 0.3, id: 'ruinCrate', name: 'Ржавый шкаф', items: [{ id: 'water', qty: 1 + Math.floor(R() * 2) }, { id: 'loof', qty: 1 }, { id: 'ammo9', qty: Math.floor(R() * 8) }, ...(R() < 0.35 ? [{ id: 'stim', qty: 1 }] : [])] });
    if (R() < 0.5) around(1 + Math.floor(R() * 2), 'scorpion', 5);
  }
  return {
    id: `encounter-${seed}`,
    name: ENCOUNTERS.names[type],
    cols, rows,
    groundColor: 0xc9a46c,
    temporary: true,
    props,
    spawns,
    entry: { u: 3.5, v: V / 2 },
    exits: [
      { col: 0, row: 0, w: 2, h: rows, to: 'worldmap', label: 'Пустошь Негева' },
      { col: cols - 2, row: 0, w: 2, h: rows, to: 'worldmap', label: 'Пустошь Негева' },
    ],
    paths: [[[0, V / 2], [U * 0.3, V / 2 + 2], [U * 0.6, V / 2 - 3], [U, V / 2 + 1]]],
  };
}
