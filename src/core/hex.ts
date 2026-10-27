// Гексагональная сетка (flat-top, осевые координаты q,r).
// Сетка лежит в плоскости (u,v): u — вправо по экрану, v — вниз по экрану (к камере).
// Как в Fallout, ряды гексов идут горизонтально по экрану, а стены зданий —
// под углом, вдоль сетки тайлов мира (x,z).

import { CAM_YAW, HEX_R } from '../config';

export interface Hex { q: number; r: number }

const SQRT3 = Math.sqrt(3);
const COS_Y = Math.cos(CAM_YAW);
const SIN_Y = Math.sin(CAM_YAW);

export const key = (h: Hex) => `${h.q},${h.r}`;
export const fromKey = (k: string): Hex => {
  const [q, r] = k.split(',').map(Number);
  return { q, r };
};
export const eq = (a: Hex, b: Hex) => a.q === b.q && a.r === b.r;

export function hexToUV(h: Hex): [number, number] {
  return [1.5 * HEX_R * h.q, SQRT3 * HEX_R * (h.r + h.q / 2)];
}

export function uvToHex(u: number, v: number): Hex {
  const q = ((2 / 3) * u) / HEX_R;
  const r = ((-1 / 3) * u + (SQRT3 / 3) * v) / HEX_R;
  return round(q, r);
}

function round(fq: number, fr: number): Hex {
  const fs = -fq - fr;
  let q = Math.round(fq), r = Math.round(fr);
  const s = Math.round(fs);
  const dq = Math.abs(q - fq), dr = Math.abs(r - fr), ds = Math.abs(s - fs);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return { q, r };
}

/** (u,v) экранной плоскости → (x,z) мира. */
export function uvToWorld(u: number, v: number): [number, number] {
  return [u * COS_Y + v * SIN_Y, -u * SIN_Y + v * COS_Y];
}
export function worldToUV(x: number, z: number): [number, number] {
  return [x * COS_Y - z * SIN_Y, x * SIN_Y + z * COS_Y];
}
export function hexToWorld(h: Hex): [number, number] {
  const [u, v] = hexToUV(h);
  return uvToWorld(u, v);
}
export function worldToHex(x: number, z: number): Hex {
  const [u, v] = worldToUV(x, z);
  return uvToHex(u, v);
}

export const DIRS: Hex[] = [
  { q: 1, r: -1 }, { q: 1, r: 0 }, { q: 0, r: 1 },
  { q: -1, r: 1 }, { q: -1, r: 0 }, { q: 0, r: -1 },
];
export const neighbors = (h: Hex) => DIRS.map((d) => ({ q: h.q + d.q, r: h.r + d.r }));

export function distance(a: Hex, b: Hex): number {
  const dq = a.q - b.q, dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

/** Гексы на прямой от a до b включительно. */
export function line(a: Hex, b: Hex): Hex[] {
  const n = distance(a, b);
  const out: Hex[] = [];
  for (let i = 0; i <= n; i++) {
    const t = n === 0 ? 0 : i / n;
    out.push(round(a.q + (b.q - a.q) * t + 1e-6, a.r + (b.r - a.r) * t + 1e-6));
  }
  return out;
}

/** Смещённые координаты карты (столбец/ряд, odd-q) ↔ осевые. */
export const offsetToHex = (col: number, row: number): Hex => ({ q: col, r: row - (col - (col & 1)) / 2 });
export const hexToOffset = (h: Hex): [number, number] => [h.q, h.r + (h.q - (h.q & 1)) / 2];

/** A* по гексам. passable(h) решает, можно ли встать на гекс (цель проверяется отдельно). */
export function findPath(
  from: Hex, to: Hex, passable: (h: Hex) => boolean, maxNodes = 4000, allowBlockedGoal = false,
): Hex[] | null {
  if (eq(from, to)) return [];
  if (!allowBlockedGoal && !passable(to)) return null;
  const open = new Map<string, { h: Hex; g: number; f: number }>();
  const came = new Map<string, string>();
  const gScore = new Map<string, number>();
  const sk = key(from);
  open.set(sk, { h: from, g: 0, f: distance(from, to) });
  gScore.set(sk, 0);
  let expanded = 0;
  while (open.size && expanded < maxNodes) {
    let bestK = '', best: { h: Hex; g: number; f: number } | null = null;
    for (const [k, n] of open) if (!best || n.f < best.f) { best = n; bestK = k; }
    if (!best) break;
    open.delete(bestK);
    expanded++;
    for (const nb of neighbors(best.h)) {
      const nk = key(nb);
      const isGoal = eq(nb, to);
      if (!isGoal && !passable(nb)) continue;
      const g = best.g + 1;
      if (g >= (gScore.get(nk) ?? Infinity)) continue;
      gScore.set(nk, g);
      came.set(nk, bestK);
      if (isGoal) {
        const path: Hex[] = [to];
        let k = bestK;
        while (k !== sk) { path.unshift(fromKey(k)); k = came.get(k)!; }
        return path;
      }
      open.set(nk, { h: nb, g, f: g + distance(nb, to) });
    }
  }
  return null;
}
