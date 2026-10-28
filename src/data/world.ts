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
  /** По пропорциям нарисованной карты 2752×1536. */
  height: 160 * 1536 / 2752,
  /** Пешком по пустыне, км/ч. */
  speed: 4.5,
  start: { x: 50, y: 58.7 },
  locations: [
    {
      id: 'kibbutz', name: 'Кибуц Нахаль-Ор', x: 50, y: 58.7, level: 'kibbutz', def: KIBBUTZ, knownFrom: 'start',
      desc: 'Руины кибуца над миклатом № 7. Батья, Шломо и водонапорная башня.',
    },
    {
      id: 'miklat', name: 'Миклат № 7', x: 45.9, y: 65.1, knownFrom: 'start',
      closed: 'Гермодверь миклата закрыта изнутри. Без мембраны вас не впустят.',
      desc: 'Ваше убежище. Воды осталось на считанные дни.',
    },
    {
      id: 'beersheba', name: 'Беэр-Шева', x: 80.2, y: 30.5, knownFrom: 'knowsBeersheva',
      closed: 'Над воротами Беэр-Шевы висит табличка «Закрыто на учёт». Город появится в следующей версии.',
      desc: 'Торговый город среди морских контейнеров. Здесь можно найти Ицика-Мусорщика.',
    },
    {
      id: 'coast', name: 'Побережье', x: 38.4, y: 22.1, knownFrom: 'knowsCoast',
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

type XY = [number, number];

/**
 * Фоны встреч нарисованы во Flow в 2752×1536 при 85 пикселях на метр.
 * Препятствия ниже размечены по превью вдвое меньше (1376×768), P переводит их в (u, v).
 */
const P = (x: number, y: number): XY => [(2 * x - 42.5) / 85, (2 * y - 21.25) / 42.5];
const desertBg = (type: EncounterType) => ({ src: `backgrounds/desert-${type === 'trader' ? 'caravan' : type}.jpg`, width: 2752, height: 1536, ppu: 85, originPx: [42.5, 21.25] as XY });

/** Невидимая стенка по нарисованному препятствию: от a до b (пиксели превью), толщина t и высота h в метрах. */
function seg(a: XY, b: XY, t = 1, h = 1.6, low?: boolean): PropDef {
  const [u, v] = P(...a);
  return { type: 'block', u, v, to: P(...b), t, h, low };
}
/** Небольшое препятствие в точке: бочка, колесо, столб. */
const dot = (x: number, y: number, t = 0.9, h = 1): PropDef => seg([x, y], [x, y], t, h);

function spawnAt(id: string, tpl: string, x: number, y: number): SpawnDef {
  const [u, v] = P(x, y);
  return { id, tpl, u, v };
}

const LEFT_RIGHT = (cols: number, rows: number) => [
  { col: 0, row: 0, w: 2, h: rows, to: 'worldmap', label: 'Пустошь Негева' },
  { col: cols - 2, row: 0, w: 2, h: rows, to: 'worldmap', label: 'Пустошь Негева' },
];

/** Локация случайной встречи: нарисованный фон своего типа, число врагов и добыча — от seed. */
export function makeEncounter(type: EncounterType, seed: number): LevelDef {
  const R = rng(seed);
  const cols = 43, rows = 41;
  const props: PropDef[] = [];
  const spawns: SpawnDef[] = [];
  let entry = P(1240, 420);
  let exits = LEFT_RIGHT(cols, rows);

  if (type === 'raiders') {
    props.push(
      seg([110, 300], [470, 215], 2.4, 3),       // автобус
      seg([200, 400], [390, 400], 1.6, 2.6),     // палатки
      seg([110, 515], [250, 470], 2.6, 2.6),
      seg([150, 630], [355, 605], 1.8, 2.5),
      seg([410, 380], [580, 372], 1.8, 2.6),
      seg([620, 410], [800, 400], 1.8, 2.6),
      seg([580, 300], [700, 300], 0.4, 1.5),     // доска на козлах
      seg([465, 488], [520, 488], 1.2, 0.4, true), // костёр
      seg([690, 478], [725, 478], 0.9, 0.6, true), // покрышки
      dot(812, 425), dot(65, 505), dot(325, 652), dot(850, 672),
      seg([370, 632], [610, 680], 1, 0.9),       // мешки с песком
      seg([115, 640], [170, 650], 1, 0.9),
      dot(232, 690, 1, 0.6),
      seg([745, 640], [905, 575], 1, 0.9),
      seg([880, 580], [1045, 680], 2.2, 1.6),    // куча хлама
      seg([1050, 610], [1105, 700], 1, 0.9),
    );
    const [su, sv] = P(775, 475);
    props.push({ type: 'crate', u: su, v: sv, id: 'stash', name: 'Тайник мародёров', items: [{ id: 'ammo9', qty: 6 + Math.floor(R() * 10) }, { id: 'asimon', qty: 5 + Math.floor(R() * 20) }, { id: 'water', qty: 1 }] });
    spawns.push(spawnAt('raider0', 'raider', 560, 455), spawnAt('raiderKnife0', 'raiderKnife', 450, 545));
    if (R() < 0.6) spawns.push(spawnAt('raider1', 'raider', 640, 530));
  } else if (type === 'scorpions') {
    props.push(
      seg([500, 40], [760, 40], 3, 2),           // скалы сверху
      seg([780, 60], [1000, 90], 2.5, 1.8),      // развалины под брезентом
      seg([1000, 60], [1376, 90], 4, 2),
      seg([1100, 110], [1376, 160], 2.5, 1.5),
      seg([0, 200], [400, 170], 3, 2),           // развалины слева
      seg([150, 280], [330, 300], 2.4, 1.8),
      seg([0, 330], [160, 350], 3, 1.6),
      seg([0, 430], [200, 450], 3, 1.6),
      seg([60, 500], [110, 500], 1.2, 1),
      seg([280, 400], [310, 400], 1, 1),         // куст
      seg([395, 345], [445, 345], 1, 1),         // обломки кресел
      seg([1290, 330], [1340, 330], 1, 2),       // сухое дерево
      seg([1030, 180], [1110, 195], 1.2, 1),
      seg([1050, 420], [1260, 460], 1.4, 0.8, true), // скелет
      seg([900, 490], [1040, 500], 2, 0.5, true),    // норы гнезда
      dot(1170, 535, 1.2, 0.5),
      seg([920, 590], [1030, 600], 1.6, 0.5, true),
      seg([1100, 600], [1210, 620], 1.8, 0.5, true),
      seg([0, 600], [470, 700], 4, 2),           // скалы снизу слева
      seg([0, 560], [60, 700], 2, 2),
      seg([330, 580], [460, 600], 1.2, 1),
      dot(480, 610, 1, 1),
    );
    const n = 2 + Math.floor(R() * 2);
    const pos: XY[] = [[860, 540], [1060, 540], [1150, 680]];
    for (let i = 0; i < n; i++) spawns.push(spawnAt(`scorpion${i}`, 'scorpion', ...pos[i]));
    if (R() < 0.35) spawns.push(spawnAt('queen', 'scorpionBig', 1300, 560));
    entry = P(640, 690);
    exits = [
      { col: cols - 2, row: 0, w: 2, h: rows, to: 'worldmap', label: 'Пустошь Негева' },
      { col: 0, row: rows - 2, w: cols, h: 2, to: 'worldmap', label: 'Пустошь Негева' },
    ];
  } else if (type === 'trader') {
    props.push(
      seg([240, 330], [430, 400], 2.4, 1.6),     // тюки
      seg([400, 300], [600, 340], 2, 1.4),
      dot(220, 350, 0.4, 3), dot(480, 250, 0.4, 3), dot(595, 340, 0.4, 3), dot(330, 420, 0.4, 3), // столбы навеса
      seg([630, 250], [645, 250], 1.2, 4),       // дерево
      seg([720, 320], [880, 320], 3.2, 1.2),     // колодец
      seg([150, 370], [235, 410], 0.4, 1, true), // коновязи
      seg([258, 440], [345, 510], 0.4, 1, true),
      seg([420, 495], [550, 450], 0.4, 1, true),
      seg([590, 440], [720, 395], 0.4, 1, true),
      seg([1215, 30], [1330, 110], 0.8, 2),      // забор
      seg([0, 660], [140, 760], 2.5, 1.6),       // камни
    );
    const [cu, cv] = P(480, 320);
    props.push({ type: 'crate', u: cu, v: cv, id: 'cargo', name: 'Тюки каравана', locked: 95, desc: 'Тюки каравана, перетянутые проволокой. Чужое.', items: [{ id: 'water', qty: 3 }] });
    spawns.push(spawnAt('trader', 'trader', 520, 430));
    entry = P(1200, 450);
  } else {
    // Заправка: стены магазина размечены прямо в метрах, в стене L→F — дверной проём.
    const L: XY = [19.4, 15.6], F: XY = [24.9, 20.0], Rr: XY = [29.2, 15.4], B: XY = [23.7, 11.0];
    const wall = (a: XY, b: XY): PropDef => ({ type: 'block', u: a[0], v: a[1], to: b, t: 0.3, h: 3 });
    props.push(wall(L, [20.17, 16.22]), wall([21.33, 17.14], F), wall(F, Rr), wall(Rr, B), wall(B, L));
    props.push(
      dot(322, 520, 0.5, 4), dot(408, 570, 0.5, 4), dot(632, 420, 0.5, 4), dot(546, 370, 0.5, 4), // опоры навеса
      dot(268, 490, 0.9, 1.8), dot(470, 600, 0.9, 1.8), dot(692, 445, 0.9, 1.8),                  // колонки
      { type: 'block', ...uvOf(150, 435), pts: [P(150, 435), P(570, 175), P(795, 305), P(395, 570)], h: 0.35, y0: 3.8, noBlock: true }, // крыша навеса
      seg([160, 465], [195, 480], 1, 1.2),       // генератор
      ...([[385, 610], [1010, 450], [1160, 585], [760, 265], [850, 330], [1050, 550], [1120, 440], [1200, 630]] as XY[]).map(([x, y]) => dot(x, y, 0.8, 0.6)),
    );
    props.push({ type: 'crate', u: 24.5, v: 14, id: 'ruinCrate', name: 'Ржавый шкаф', items: [{ id: 'water', qty: 1 + Math.floor(R() * 2) }, { id: 'loof', qty: 1 }, { id: 'ammo9', qty: Math.floor(R() * 8) }, ...(R() < 0.35 ? [{ id: 'stim', qty: 1 }] : [])] });
    if (R() < 0.5) {
      spawns.push(spawnAt('scorpion0', 'scorpion', 1000, 650));
      if (R() < 0.5) spawns.push(spawnAt('scorpion1', 'scorpion', 700, 650));
    }
    entry = P(1300, 690);
  }

  return {
    id: `encounter-${seed}`,
    name: ENCOUNTERS.names[type],
    cols, rows,
    background: desertBg(type),
    groundColor: 0xc9a46c,
    temporary: true,
    props,
    spawns,
    entry: { u: entry[0], v: entry[1] },
    exits,
  };
}

function uvOf(x: number, y: number) {
  const [u, v] = P(x, y);
  return { u, v };
}
