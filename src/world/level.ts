// Локация: описание (LevelDef) → 3D-сцена + карта проходимости гексов.
//
// Два режима:
//  1. Заглушка: декорации строятся из примитивов (сейчас).
//  2. Нарисованный фон: картинка из Flow ставится за сценой, а те же
//     декорации становятся невидимыми «заслонками глубины» — персонаж
//     заходит за стену на картинке и прячется за ней, как в Fallout.

import * as THREE from 'three';
import { HEX_R, CAM_YAW, SIN_PITCH } from '../config';
import { Hex, hexToWorld, key, offsetToHex, hexToUV, uvToWorld, line, neighbors } from '../core/hex';
import { mat } from './models';
import type { Stack } from '../rules/items';

export interface BackgroundDef {
  src: string;
  /** Размер картинки в пикселях. */
  width: number;
  height: number;
  /** Пикселей на метр в картинке (90 = родной масштаб 1080p, 180 = 4K-исходник). */
  ppu: number;
  /** Точка картинки (в пикселях), где находится гекс (0,0) карты. */
  originPx: [number, number];
}

interface PropBase {
  u: number; v: number;
  /** Поворот относительно сетки тайлов, градусы. */
  rot?: number;
  name?: string;
  desc?: string;
  id?: string;
}

export type PropDef = PropBase & (
  | { type: 'box'; w: number; d: number; h: number; color: number; low?: boolean; noBlock?: boolean }
  | { type: 'building'; w: number; d: number; h: number; color: number; floor: number; doors: { side: 'n' | 's' | 'e' | 'w'; at: number; width: number }[]; ruin?: number; sign?: string }
  | { type: 'tower' }
  | { type: 'palm'; h?: number }
  | { type: 'barrel'; color?: number }
  | { type: 'car'; color: number }
  | { type: 'sign'; text: string; sub?: string }
  | { type: 'rubble'; w: number; d: number }
  | { type: 'crate'; locked?: number; items: Stack[] }
  | { type: 'hatch' }
  | { type: 'sandbags'; w: number }
  /** Мешки с песком между двумя точками (u,v) — для стенок, нарисованных под любым углом. */
  | { type: 'wall'; to: [number, number] }
);

/** Где появляется персонаж: столбец/ряд гексов или точка в метрах (u, v). */
export type SpawnDef = { id: string } & ({ col: number; row: number } | { u: number; v: number });

export interface LevelDef {
  id: string;
  name: string;
  cols: number;
  rows: number;
  background?: BackgroundDef;
  groundColor: number;
  props: PropDef[];
  spawns: SpawnDef[];
  exits: { col: number; row: number; w: number; h: number; to: string; label: string }[];
  /** Утоптанные тропы (для текстуры-заглушки), точки в метрах (u, v). */
  paths?: [number, number][][];
  /** Ручные правки проходимости из редактора (F10). */
  blockedExtra?: string[];
  unblocked?: string[];
}

interface Blocker { x: number; z: number; w: number; d: number; rot: number; h: number; low: boolean }

export interface Interactive {
  id: string;
  name: string;
  desc: string;
  hex: Hex;
  object: THREE.Object3D;
  kind: 'crate' | 'sign' | 'prop' | 'hatch';
  items?: Stack[];
  locked?: number;
}

export class Level {
  readonly root = new THREE.Group();
  readonly blocked = new Set<string>();
  readonly sightBlocked = new Set<string>();
  readonly inBounds = new Set<string>();
  readonly exits = new Map<string, { to: string; label: string }>();
  readonly interactives: Interactive[] = [];
  /** Стены, которые становятся прозрачными, когда закрывают героя. */
  readonly occluders: THREE.Mesh[] = [];
  readonly sizeU: number;
  readonly sizeV: number;
  private blockers: Blocker[] = [];

  constructor(readonly def: LevelDef) {
    this.sizeU = 1.5 * HEX_R * (def.cols - 1);
    this.sizeV = Math.sqrt(3) * HEX_R * (def.rows - 0.5);
    for (let c = 0; c < def.cols; c++) for (let r = 0; r < def.rows; r++) this.inBounds.add(key(offsetToHex(c, r)));

    const painted = !!def.background;
    this.buildGround(painted);
    for (const p of def.props) this.buildProp(p, painted);
    this.computeBlocking();
    if (painted) this.buildClickProxies();
    for (const ex of def.exits) {
      for (let c = ex.col; c < ex.col + ex.w; c++) for (let r = ex.row; r < ex.row + ex.h; r++) {
        const h = offsetToHex(c, r);
        if (this.inBounds.has(key(h)) && !this.blocked.has(key(h))) this.exits.set(key(h), { to: ex.to, label: ex.label });
      }
    }
    this.buildExitGrids();
  }

  centerWorld(): [number, number] {
    return uvToWorld(this.sizeU / 2, this.sizeV / 2);
  }

  /** Ближайший к h проходимый гекс (если h занят стеной — соседний снаружи). */
  nearestPassable(h: Hex, free: (h: Hex) => boolean = () => true): Hex {
    const seen = new Set([key(h)]);
    const queue = [h];
    while (queue.length) {
      const cur = queue.shift()!;
      if (this.passable(cur) && free(cur)) return cur;
      for (const n of neighbors(cur)) {
        const k = key(n);
        if (!seen.has(k) && this.inBounds.has(k)) { seen.add(k); queue.push(n); }
      }
    }
    return h;
  }

  passable(h: Hex) {
    const k = key(h);
    return this.inBounds.has(k) && !this.blocked.has(k);
  }

  /** Видно ли b из a: на прямой между ними нет стен. */
  lineOfSight(a: Hex, b: Hex): boolean {
    const pts = line(a, b);
    for (let i = 1; i < pts.length - 1; i++) if (this.sightBlocked.has(key(pts[i]))) return false;
    return true;
  }

  // ---------- построение ----------

  private buildGround(painted: boolean) {
    const [cx, cz] = this.centerWorld();
    const w = this.sizeU + 2, d = this.sizeV + 2;
    const geo = new THREE.PlaneGeometry(w, d);
    geo.rotateX(-Math.PI / 2);
    let material: THREE.Material;
    if (painted) {
      material = new THREE.ShadowMaterial({ opacity: 0.45 });
    } else {
      const tex = groundTexture(this.def.groundColor, w, d, this.def.paths ?? []);
      material = new THREE.MeshStandardMaterial({ map: tex, roughness: 1 });
    }
    const ground = new THREE.Mesh(geo, material);
    ground.rotation.y = CAM_YAW;
    ground.position.set(cx, 0, cz);
    ground.receiveShadow = true;
    ground.name = 'ground';
    // Земля не пишет глубину: нижняя часть спрайта (тень у ног) уходит «под землю»
    // и иначе обрезалась бы. Земля рисуется первой, ниже неё ничего нет.
    material.depthWrite = false;
    ground.renderOrder = -5;
    this.root.add(ground);
  }

  private addBlocker(b: Blocker, painted: boolean, color: number | null, parent: THREE.Object3D = this.root) {
    this.blockers.push(b);
    const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
    let m: THREE.Material;
    if (painted) m = new THREE.MeshBasicMaterial({ colorWrite: false });
    else m = mat(color ?? 0x888888, 0.95);
    const o = new THREE.Mesh(geo, m);
    o.position.set(b.x, b.h / 2, b.z);
    o.rotation.y = b.rot;
    o.castShadow = !painted;
    o.receiveShadow = !painted;
    if (!painted && !b.low) this.occluders.push(o);
    parent.add(o);
    return o;
  }

  private buildProp(p: PropDef, painted: boolean) {
    if (p.type === 'wall') {
      const [x1, z1] = uvToWorld(p.u, p.v);
      const [x2, z2] = uvToWorld(p.to[0], p.to[1]);
      const len = Math.hypot(x2 - x1, z2 - z1);
      const rot = (Math.atan2(-(z2 - z1), x2 - x1) * 180) / Math.PI;
      this.buildProp({ type: 'sandbags', u: (p.u + p.to[0]) / 2, v: (p.v + p.to[1]) / 2, w: len, rot }, painted);
      return;
    }
    const [x, z] = uvToWorld(p.u, p.v);
    const rot = ((p.rot ?? 0) * Math.PI) / 180;
    const local = (lx: number, lz: number): [number, number] => [
      x + lx * Math.cos(rot) + lz * Math.sin(rot),
      z - lx * Math.sin(rot) + lz * Math.cos(rot),
    ];
    const deco = (o: THREE.Object3D) => {
      o.traverse((c) => { c.castShadow = true; c.receiveShadow = true; });
      if (painted) o.visible = false;
      this.root.add(o);
      return o;
    };

    switch (p.type) {
      case 'box': {
        const o = this.addBlocker({ x, z, w: p.w, d: p.d, h: p.h, rot, low: !!p.low }, painted, p.color);
        if (p.noBlock) this.blockers.pop();
        if (p.name) this.interactives.push({ id: p.id ?? p.name, name: p.name, desc: p.desc ?? '', hex: this.nearestHex(x, z), object: o, kind: 'prop' });
        break;
      }
      case 'building': {
        const t = 0.3;
        const segs: [number, number, number, number][] = []; // lx, lz, len, dir(0 = вдоль x)
        const sides = { n: [-p.d / 2, p.w, 0], s: [p.d / 2, p.w, 0], w: [-p.w / 2, p.d, 1], e: [p.w / 2, p.d, 1] } as const;
        for (const side of ['n', 's', 'w', 'e'] as const) {
          const [off, len, dir] = sides[side];
          const holes = p.doors.filter((dd) => dd.side === side).map((dd) => [dd.at - dd.width / 2, dd.at + dd.width / 2]);
          holes.sort((a, b) => a[0] - b[0]);
          let start = -len / 2;
          for (const [a, b] of [...holes, [len / 2, len / 2]]) {
            if (a - start > 0.05) {
              const mid = (start + a) / 2;
              segs.push(dir === 0 ? [mid, off, a - start, 0] : [off, mid, a - start, 1]);
            }
            start = b;
          }
        }
        let seed = (p.u * 13.7 + p.v * 7.1) % 1;
        const rnd = () => (seed = (seed * 9301 + 49297) % 233280 / 233280);
        for (const [lx, lz, len, dir] of segs) {
          // Разрушенные стены: режем сегмент на куски разной высоты.
          const pieces = Math.max(1, Math.round(len / 1.5));
          for (let i = 0; i < pieces; i++) {
            const pl = len / pieces;
            const off = -len / 2 + pl * (i + 0.5);
            const ruin = p.ruin ?? 0;
            const h = Math.max(0.5, p.h * (1 - ruin * rnd()));
            const [wx, wz] = dir === 0 ? local(lx + off, lz) : local(lx, lz + off);
            this.addBlocker({ x: wx, z: wz, w: dir === 0 ? pl + 0.01 : t, d: dir === 0 ? t : pl + 0.01, h, rot, low: h < 1.2 }, painted, p.color);
          }
        }
        const floor = new THREE.Mesh(new THREE.BoxGeometry(p.w, 0.06, p.d), mat(p.floor, 1));
        floor.position.set(x, 0.03, z);
        floor.rotation.y = rot;
        floor.receiveShadow = true;
        deco(floor);
        break;
      }
      case 'tower': {
        // Водонапорная башня — символ любого кибуца.
        const g = new THREE.Group();
        const legM = mat(0x6d6a63, 0.9);
        for (const [lx, lz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) {
          const [wx, wz] = local(lx, lz);
          this.blockers.push({ x: wx, z: wz, w: 0.5, d: 0.5, h: 7, rot, low: false });
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.35, 6.2, 0.35), legM);
          leg.position.set(lx, 3.1, lz);
          g.add(leg);
        }
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.7, 2.6, 20), mat(0x8c8a80, 0.8));
        tank.position.y = 7.4;
        const roof = new THREE.Mesh(new THREE.ConeGeometry(2.0, 0.7, 20), mat(0x6e675c, 0.8));
        roof.position.y = 9.05;
        const brace = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.18, 0.18), legM);
        brace.position.y = 3;
        const brace2 = brace.clone();
        brace2.rotation.y = Math.PI / 2;
        g.add(tank, roof, brace, brace2);
        g.position.set(x, 0, z);
        g.rotation.y = rot;
        deco(g);
        if (painted) for (const [lx, lz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) {
          const [wx, wz] = local(lx, lz);
          const proxy = new THREE.Mesh(new THREE.BoxGeometry(0.35, 6.2, 0.35), new THREE.MeshBasicMaterial({ colorWrite: false }));
          proxy.position.set(wx, 3.1, wz);
          this.root.add(proxy);
        }
        this.interactives.push({ id: 'tower', name: 'Водонапорная башня', desc: 'Бак пробит в трёх местах. Внизу, в тени, что-то шуршит.', hex: this.nearestHex(x, z), object: g, kind: 'prop' });
        break;
      }
      case 'palm': {
        const h = p.h ?? 5;
        const g = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, h, 8), mat(0x6b5235));
        trunk.position.y = h / 2;
        trunk.rotation.z = 0.08;
        g.add(trunk);
        for (let i = 0; i < 7; i++) {
          const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.03, 2.2), mat(i % 2 ? 0x5d5a2a : 0x6b6230));
          leaf.position.set(0, h, 0);
          leaf.rotation.y = (i / 7) * Math.PI * 2;
          leaf.rotation.x = 0.5;
          leaf.translateZ(0.9);
          g.add(leaf);
        }
        g.position.set(x, 0, z);
        deco(g);
        this.blockers.push({ x, z, w: 0.4, d: 0.4, h, rot: 0, low: false });
        break;
      }
      case 'barrel': {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.9, 14), mat(p.color ?? 0x5a4a32, 0.6, 0.3));
        b.position.set(x, 0.45, z);
        deco(b);
        this.blockers.push({ x, z, w: 0.6, d: 0.6, h: 0.9, rot: 0, low: true });
        break;
      }
      case 'car': {
        // Остов грузовичка «Темпо».
        const g = new THREE.Group();
        const body = mat(p.color, 0.7, 0.2);
        const rust = mat(0x5e3b22, 0.95);
        const cab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.2, 1.2), body);
        cab.position.set(0, 0.95, 1.1);
        const bed = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 2.0), rust);
        bed.position.set(0, 0.55, -0.6);
        const glass = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.45, 0.05), mat(0x1c2326, 0.2, 0.4));
        glass.position.set(0, 1.25, 1.71);
        g.add(cab, bed, glass);
        for (const [wx, wz] of [[-0.8, 1.1], [0.8, 1.1], [-0.8, -0.9], [0.8, -0.9]]) {
          const w = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 12), mat(0x1a1a1a, 0.9));
          w.rotation.z = Math.PI / 2;
          w.position.set(wx, 0.25, wz);
          g.add(w);
        }
        g.position.set(x, 0, z);
        g.rotation.set(0, rot, 0.06);
        deco(g);
        this.blockers.push({ x, z, w: 1.7, d: 3.4, h: 1.6, rot, low: true });
        if (painted) this.addBlocker({ x, z, w: 1.6, d: 3.2, h: 1.5, rot, low: true }, true, null);
        this.interactives.push({ id: 'car', name: 'Ржавый «Темпо»', desc: 'Трёхколёсный грузовичок довоенной сборки. Колёса давно сняли.', hex: this.nearestHex(x, z), object: g, kind: 'prop' });
        break;
      }
      case 'sign': {
        const g = new THREE.Group();
        const postM = mat(0x5a4a38);
        for (const sx of [-0.9, 0.9]) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 0.1), postM);
          post.position.set(sx, 1.1, 0);
          g.add(post);
        }
        const board = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 0.06), new THREE.MeshStandardMaterial({ map: signTexture(p.text, p.sub), roughness: 0.9 }));
        board.position.set(0, 1.8, 0.05);
        board.rotation.z = -0.05;
        g.add(board);
        g.position.set(x, 0, z);
        g.rotation.y = rot;
        deco(g);
        this.interactives.push({ id: p.id ?? 'sign', name: 'Вывеска', desc: p.desc ?? `На вывеске написано: «${p.text}»${p.sub ? ` (${p.sub})` : ''}.`, hex: this.nearestHex(x, z), object: g, kind: 'sign' });
        break;
      }
      case 'rubble': {
        const g = new THREE.Group();
        const n = Math.round(p.w * p.d * 2);
        for (let i = 0; i < n; i++) {
          const s = 0.2 + Math.random() * 0.5;
          const r = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.6, s * 0.8), mat(i % 3 ? 0x8a8072 : 0x6e6458, 1));
          r.position.set((Math.random() - 0.5) * p.w, s * 0.25, (Math.random() - 0.5) * p.d);
          r.rotation.set(Math.random(), Math.random() * 3, Math.random());
          g.add(r);
        }
        g.position.set(x, 0, z);
        g.rotation.y = rot;
        deco(g);
        this.blockers.push({ x, z, w: p.w * 0.8, d: p.d * 0.8, h: 0.6, rot, low: true });
        break;
      }
      case 'crate': {
        const g = new THREE.Group();
        const c = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.6), mat(p.locked ? 0x4c5338 : 0x7a5c3a, 0.9));
        c.position.y = 0.3;
        g.add(c);
        if (p.locked) {
          const lock = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.05), mat(0x9a8a50, 0.4, 0.7));
          lock.position.set(0, 0.42, 0.31);
          g.add(lock);
        }
        g.position.set(x, 0, z);
        g.rotation.y = rot;
        deco(g);
        this.blockers.push({ x, z, w: 0.9, d: 0.6, h: 0.6, rot, low: true });
        this.interactives.push({
          id: p.id ?? `crate${this.interactives.length}`, name: p.name ?? (p.locked ? 'Армейский ящик' : 'Деревянный ящик'),
          desc: p.desc ?? (p.locked ? 'Металлический ящик с армейской маркировкой. Заперт.' : 'Ящик из-под апельсинов.'),
          hex: this.nearestHex(x, z), object: g, kind: 'crate', items: p.items, locked: p.locked,
        });
        break;
      }
      case 'hatch': {
        const g = new THREE.Group();
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 0.25, 20), mat(0x6a6a62, 0.8, 0.3));
        ring.position.y = 0.12;
        const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.08, 20), mat(0x3f4a3c, 0.6, 0.5));
        lid.position.set(0.9, 0.5, 0);
        lid.rotation.z = 1.2;
        const hole = new THREE.Mesh(new THREE.CircleGeometry(0.75, 20), new THREE.MeshBasicMaterial({ color: 0x050505 }));
        hole.rotation.x = -Math.PI / 2;
        hole.position.y = 0.255;
        g.add(ring, lid, hole);
        g.position.set(x, 0, z);
        deco(g);
        this.blockers.push({ x, z, w: 1.6, d: 1.6, h: 0.3, rot: 0, low: true });
        this.interactives.push({ id: 'hatch', name: 'Аварийный лаз миклата', desc: 'Бетонная труба аварийного выхода из миклата № 7. Через неё вы и выбрались наружу. За спиной — сто лет темноты, назад дороги нет.', hex: this.nearestHex(x, z), object: g, kind: 'hatch' });
        break;
      }
      case 'sandbags': {
        const g = new THREE.Group();
        const n = Math.round(p.w / 0.55);
        for (let row = 0; row < 3; row++) for (let i = 0; i < n - (row % 2); i++) {
          const b = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.26, 0.38), mat(row % 2 ? 0x8f7c55 : 0x9a8660, 1));
          b.position.set(-p.w / 2 + 0.3 + i * 0.55 + (row % 2) * 0.27, 0.13 + row * 0.25, 0);
          b.rotation.y = (Math.random() - 0.5) * 0.15;
          g.add(b);
        }
        g.position.set(x, 0, z);
        g.rotation.y = rot;
        deco(g);
        this.blockers.push({ x, z, w: p.w, d: 0.45, h: 0.8, rot, low: true });
        break;
      }
    }
  }

  /** На нарисованном фоне декорации скрыты; по невидимым коробкам того же размера можно щёлкать. */
  private buildClickProxies() {
    const m = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    for (const it of this.interactives) {
      const box = new THREE.Box3().setFromObject(it.object, true);
      const size = box.getSize(new THREE.Vector3()).max(new THREE.Vector3(0.8, 0.6, 0.8));
      const proxy = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), m);
      box.getCenter(proxy.position);
      this.root.add(proxy);
      it.object = proxy;
    }
  }

  nearestHex(x: number, z: number): Hex {
    let best: Hex = { q: 0, r: 0 }, bd = Infinity;
    for (const k of this.inBounds) {
      const [q, r] = k.split(',').map(Number);
      const [hx, hz] = hexToWorld({ q, r });
      const d = (hx - x) ** 2 + (hz - z) ** 2;
      if (d < bd) { bd = d; best = { q, r }; }
    }
    return best;
  }

  private computeBlocking() {
    const margin = 0.42;
    for (const k of this.inBounds) {
      const [q, r] = k.split(',').map(Number);
      const [hx, hz] = hexToWorld({ q, r });
      for (const b of this.blockers) {
        const dx = hx - b.x, dz = hz - b.z;
        const lx = dx * Math.cos(b.rot) - dz * Math.sin(b.rot);
        const lz = dx * Math.sin(b.rot) + dz * Math.cos(b.rot);
        if (Math.abs(lx) <= b.w / 2 + margin * (b.w < 0.7 ? 0.6 : 1) && Math.abs(lz) <= b.d / 2 + margin * (b.d < 0.7 ? 0.6 : 1)) {
          this.blocked.add(k);
          if (!b.low) this.sightBlocked.add(k);
        }
      }
    }
    for (const k of this.def.blockedExtra ?? []) this.blocked.add(k);
    for (const k of this.def.unblocked ?? []) { this.blocked.delete(k); this.sightBlocked.delete(k); }
    for (const it of this.interactives) {
      // Точка взаимодействия должна быть свободным соседним гексом — её ищет игра.
      this.blocked.add(key(it.hex));
    }
  }

  private buildExitGrids() {
    const geo = hexShape(HEX_R * 0.92);
    const m = new THREE.MeshBasicMaterial({ color: 0x5fd35a, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
    for (const k of this.exits.keys()) {
      const [q, r] = k.split(',').map(Number);
      const [x, z] = hexToWorld({ q, r });
      const o = new THREE.Mesh(geo, m);
      o.position.set(x, 0.02, z);
      o.renderOrder = 2;
      this.root.add(o);
    }
  }

  /** Нарисованный фон: плоскость, повёрнутая к камере, за всей сценой. */
  buildBackground(camera: THREE.OrthographicCamera): THREE.Mesh | null {
    const bg = this.def.background;
    if (!bg) return null;
    const tex = new THREE.TextureLoader().load(bg.src);
    tex.colorSpace = THREE.SRGBColorSpace;
    const w = bg.width / bg.ppu, h = bg.height / bg.ppu;
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, depthTest: false, depthWrite: false, toneMapped: false }),
    );
    plane.renderOrder = -10;
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const [ax, az] = hexToWorld({ q: 0, r: 0 });
    const dx = (bg.width / 2 - bg.originPx[0]) / bg.ppu;
    const dy = (bg.height / 2 - bg.originPx[1]) / bg.ppu;
    plane.position.set(ax, 0, az).addScaledVector(right, dx).addScaledVector(up, -dy).addScaledVector(fwd, 150);
    plane.quaternion.copy(camera.quaternion);
    return plane;
  }
}

export function hexShape(r: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    const px = r * Math.cos(a), py = r * Math.sin(a);
    if (i === 0) s.moveTo(px, py); else s.lineTo(px, py);
  }
  s.closePath();
  const g = new THREE.ShapeGeometry(s);
  // Гекс строится в плоскости (u,v) и укладывается на землю мира.
  g.rotateX(Math.PI / 2);
  g.rotateY(CAM_YAW);
  return g;
}

export function hexOutline(r: number): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 6; i++) {
    const a = (Math.PI / 3) * i;
    const [x, z] = uvToWorld(r * Math.cos(a), r * Math.sin(a));
    pts.push(new THREE.Vector3(x, 0, z));
  }
  return new THREE.BufferGeometry().setFromPoints(pts);
}

/** Цельная (без повторов) текстура земли на всю карту: пятна, трещины, камешки, тропы. */
function groundTexture(base: number, wM: number, dM: number, paths: [number, number][][]): THREE.CanvasTexture {
  const PX = 80; // пикселей на метр
  const W = Math.round(wM * PX), H = Math.round(dM * PX);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const col = new THREE.Color(base);
  g.fillStyle = `#${col.getHexString()}`;
  g.fillRect(0, 0, W, H);
  const R = () => Math.random();
  const blob = (x: number, y: number, r: number, color: string) => {
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  };
  // Крупные пятна: светлый песок, тёмная земля, рыжие наносы.
  for (let i = 0; i < (W * H) / 9000; i++) {
    const t = R();
    blob(R() * W, R() * H, 60 + R() * 380,
      t < 0.4 ? 'rgba(60,40,22,0.16)' : t < 0.75 ? 'rgba(255,236,200,0.12)' : 'rgba(150,80,30,0.12)');
  }
  // Тропы — утоптанная земля.
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const path of paths) {
    for (const [wd, a] of [[2.6, 0.10], [1.6, 0.12], [0.9, 0.10]] as const) {
      g.strokeStyle = `rgba(70,48,28,${a})`;
      g.lineWidth = wd * PX;
      g.beginPath();
      path.forEach(([u, v], i) => (i ? g.lineTo((u + 1) * PX, (v + 1) * PX) : g.moveTo((u + 1) * PX, (v + 1) * PX)));
      g.stroke();
    }
  }
  // Пиксельный шум.
  const img = g.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (R() - 0.5) * 16;
    d[i] += n; d[i + 1] += n * 0.95; d[i + 2] += n * 0.8;
  }
  g.putImageData(img, 0, 0);
  // Трещины высохшей земли.
  for (let i = 0; i < (W * H) / 60000; i++) {
    let x = R() * W, y = R() * H;
    g.strokeStyle = `rgba(55,36,20,${0.25 + R() * 0.3})`;
    g.lineWidth = 0.6 + R() * 1.6;
    g.beginPath();
    g.moveTo(x, y);
    let a = R() * Math.PI * 2;
    for (let j = 0; j < 8; j++) {
      a += (R() - 0.5) * 1.4;
      const len = 10 + R() * 40;
      x += Math.cos(a) * len; y += Math.sin(a) * len;
      g.lineTo(x, y);
      if (R() < 0.3) { g.moveTo(x, y); a += (R() - 0.5) * 3; }
    }
    g.stroke();
  }
  // Камешки и сухая трава.
  for (let i = 0; i < (W * H) / 2600; i++) {
    const x = R() * W, y = R() * H, s = 1.5 + R() * 3.5;
    g.fillStyle = R() < 0.6 ? 'rgba(85,66,46,0.55)' : 'rgba(205,190,160,0.45)';
    g.beginPath();
    g.ellipse(x, y, s, s * 0.7, R() * 3, 0, Math.PI * 2);
    g.fill();
    if (R() < 0.15) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x - s * 0.3, y + s * 0.4, s * 1.2, s * 0.5); }
  }
  for (let i = 0; i < (W * H) / 22000; i++) {
    const x = R() * W, y = R() * H;
    g.strokeStyle = `rgba(${90 + R() * 40},${80 + R() * 30},${40 + R() * 20},0.75)`;
    g.lineWidth = 1.2;
    for (let k = 0; k < 6; k++) {
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (R() - 0.5) * 16, y - 6 - R() * 12);
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function signTexture(text: string, sub?: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 186;
  const g = c.getContext('2d')!;
  g.fillStyle = '#c9b48a';
  g.fillRect(0, 0, 512, 186);
  g.fillStyle = 'rgba(80,50,20,0.25)';
  for (let i = 0; i < 30; i++) g.fillRect(Math.random() * 512, Math.random() * 186, 40 + Math.random() * 120, 2 + Math.random() * 4);
  g.fillStyle = '#2f3b2a';
  g.textAlign = 'center';
  g.font = 'bold 64px "DejaVu Sans", Arial, sans-serif';
  g.fillText(text, 256, 92);
  if (sub) {
    g.font = 'bold 32px "DejaVu Sans", Arial, sans-serif';
    g.fillText(sub, 256, 150);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export { hexToUV, SIN_PITCH };
