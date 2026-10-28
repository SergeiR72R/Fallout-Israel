// Игровая логика: исследование в реальном времени, пошаговый бой с очками
// действия, ИИ, взаимодействие с предметами, опыт и уровни, сохранения.

import * as THREE from 'three';
import { Hex, distance, eq, findPath, hexToWorld, key, neighbors, offsetToHex, uvToHex } from '../core/hex';
import { clamp, pick, rand, roll100, wait, tween } from '../core/util';
import { WALK_SPEED, RUN_SPEED } from '../config';
import { Level, Interactive, LevelDef, hexShape } from '../world/level';
import { View } from '../world/view';
import { Critter, CritterDef, FireMode } from '../world/critter';
import { getSheet } from '../world/sprites';
import { KIBBUTZ } from '../data/kibbutz';
import { CRITTERS } from '../data/critters';
import { WORLD, EncounterType, makeEncounter } from '../data/world';
import { DIALOGS, DialogCtx, QuestState } from '../data/dialogs';
import { AIM_PARTS, AimPart, hitChance, resolveAttack, partName } from '../rules/combat';
import { Sheet, SkillId, derived, effStats, skillPointsPerLevel, xpForLevel } from '../rules/stats';
import { PERK_EVERY, perkRank } from '../rules/perks';
import { Stack, addItem, countItem, def, removeItem } from '../rules/items';
import { sfx } from '../ui/sfx';
import type { UI } from '../ui/ui';

export type Targeting = null | 'attack' | 'lockpick';

export interface CritterState {
  tpl: string; hex: Hex; hp: number; dead: boolean; hostile: boolean;
  inv: Stack[]; hands: [Stack | null, Stack | null]; armor: Stack | null; activeHand: 0 | 1;
}

/** Состояние постоянной локации: кто жив, что лежит в ящиках. */
export interface LevelState {
  critters: Record<string, CritterState>;
  containers: Record<string, { items: Stack[]; locked?: number }>;
}

export interface SaveData {
  v: 2;
  sheet: Sheet;
  minutes: number;
  karma: number;
  flags: string[];
  quests: Record<string, QuestState>;
  player: CritterState;
  levelId: string;
  /** Описание случайной встречи, если сохранились посреди неё. */
  encounter?: LevelDef;
  levels: Record<string, LevelState>;
  world: { x: number; y: number };
  seen?: string[];
}

const START_MINUTES = 7 * 60 + 40;

export class Game {
  level!: Level;
  critters: Critter[] = [];
  readonly player: Critter;
  /** Сохранённое состояние локаций, где герой уже был. */
  levelStates: Record<string, LevelState> = {};
  /** Положение героя на карте мира. */
  world = { ...WORLD.start };
  /** Открытые клетки карты мира (туман войны). */
  worldSeen = new Set<string>();
  private encounterDef: LevelDef | null = null;
  ui!: UI;
  mode: 'explore' | 'combat' = 'explore';
  order: Critter[] = [];
  current: Critter | null = null;
  busy = false;
  targeting: Targeting = null;
  flags = new Set<string>();
  quests: Record<string, QuestState> = { membrane: 'active', tower: 'none' };
  karma = 0;
  minutes = START_MINUTES;
  dead = false;
  editor = false;

  private moveToken = 0;
  private playerTurnDone: (() => void) | null = null;
  private mouse = { x: 0, y: 0, inside: false };
  /** Положение мыши во всём окне (и над панелью) — для прокрутки краями. */
  edgeMouse = { x: 0, y: 0, inside: false };
  private lastClick = { t: 0, x: 0, y: 0 };
  private keys = new Set<string>();
  private awarenessTimer = 0;
  private barkTimer = 5;
  private hovered: Critter | null = null;
  private editorMarks = new THREE.Group();
  private spawnHex = new Map<string, Hex>();
  private wanderTimers = new Map<string, number>();

  constructor(readonly view: View, sheet: Sheet, save?: SaveData) {
    let pd: CritterDef = CRITTERS.player;
    // Героиня — отдельный набор спрайтов (если он уже отрендерен).
    if (sheet.sex === 'f' && getSheet('heroine')) pd = { ...pd, sprite: 'heroine' };
    this.player = new Critter(pd, { q: 0, r: 0 });
    this.player.sheet = sheet;
    this.player.name = sheet.name;
    this.player.hp = this.player.maxHp;
    view.scene.add(this.player.rig.root, this.editorMarks);

    if (save) {
      this.minutes = save.minutes;
      this.karma = save.karma;
      this.flags = new Set(save.flags);
      this.quests = { ...save.quests };
      this.levelStates = save.levels;
      this.world = { ...save.world };
      this.worldSeen = new Set(save.seen ?? []);
      this.restoreCritter(this.player, save.player);
      this.encounterDef = save.encounter ?? null;
      this.loadLevel(this.levelDef(save.levelId), { hex: save.player.hex });
    } else {
      this.loadLevel(KIBBUTZ, { spawn: true });
    }
  }

  private levelDef(id: string): LevelDef {
    if (this.encounterDef && this.encounterDef.id === id) return this.encounterDef;
    const loc = WORLD.locations.find((l) => l.level === id);
    if (!loc?.def) throw new Error(`Нет локации ${id}`);
    return loc.def;
  }

  /** Снимок постоянной локации перед уходом с неё. */
  private snapshotLevel() {
    if (!this.level || this.level.def.temporary) return;
    const st: LevelState = { critters: {}, containers: {} };
    for (const it of this.level.interactives) if (it.kind === 'crate') st.containers[it.id] = { items: it.items ?? [], locked: it.locked };
    for (const c of this.critters) if (!c.isPlayer) st.critters[c.id] = this.critterState(c);
    this.levelStates[this.level.def.id] = st;
  }

  private critterState(c: Critter): CritterState {
    return {
      tpl: c.def.id, hex: { ...c.hex }, hp: c.hp, dead: c.dead, hostile: c.hostile,
      inv: c.inventory, hands: c.hands, armor: c.armor, activeHand: c.activeHand,
    };
  }

  private restoreCritter(c: Critter, st: CritterState) {
    c.placeAt(st.hex);
    c.hp = st.hp;
    c.hostile = st.hostile;
    c.inventory = st.inv;
    c.hands = st.hands;
    c.armor = st.armor;
    c.activeHand = st.activeHand;
    c.syncWeaponModel();
    if (st.dead) { c.dead = true; void c.rig.die(); }
  }

  /**
   * Загрузить локацию. arrival: spawn — точка «player» из описания (начало игры),
   * hex — конкретный гекс (загрузка сохранения), иначе — точка прибытия с карты мира.
   */
  loadLevel(def: LevelDef, arrival: { spawn?: boolean; hex?: Hex } = {}) {
    this.snapshotLevel();
    for (const c of this.critters) if (!c.isPlayer) this.view.scene.remove(c.rig.root);
    this.mode = 'explore';
    this.order = [];
    this.current = null;
    this.busy = false;
    this.targeting = null;
    this.moveToken++;
    this.playerTurnDone = null;
    this.spawnHex.clear();
    this.wanderTimers.clear();

    // ?nobg — посмотреть локацию на заглушках, без нарисованного фона.
    const noBg = new URLSearchParams(location.search).has('nobg');
    this.level = new Level(noBg ? { ...def, background: undefined } : def);
    this.view.setLevel(this.level, this.level.buildBackground(this.view.camera));
    for (const it of this.level.interactives) it.object.userData.interactive = it;

    const st = this.levelStates[def.id];
    this.critters = [this.player];
    for (const sp of def.spawns) {
      if (sp.id === 'player') continue;
      const tpl = sp.tpl ?? sp.id;
      const d = { ...CRITTERS[tpl], id: sp.id };
      const want = 'u' in sp ? uvToHex(sp.u, sp.v) : offsetToHex(sp.col, sp.row);
      const hex = this.level.nearestPassable(want, (h) => !this.critters.some((o) => eq(o.hex, h)));
      const c = new Critter(d, hex);
      c.rig.faceTo(Math.random() - 0.5, 1, true);
      this.spawnHex.set(c.id, { ...hex });
      const cs = st?.critters[c.id];
      if (cs) this.restoreCritter(c, cs);
      this.critters.push(c);
      this.view.scene.add(c.rig.root);
    }
    if (st) for (const it of this.level.interactives) {
      const cs = st.containers[it.id];
      if (cs) { it.items = cs.items; it.locked = cs.locked; }
    }

    const ps = def.spawns.find((s) => s.id === 'player');
    let want: Hex;
    if (arrival.hex) want = arrival.hex;
    else if (arrival.spawn && ps) want = 'u' in ps ? uvToHex(ps.u, ps.v) : offsetToHex(ps.col, ps.row);
    else if (def.entry) want = uvToHex(def.entry.u, def.entry.v);
    else want = uvToHex(this.level.sizeU / 2, this.level.sizeV / 2);
    this.player.placeAt(this.level.nearestPassable(want, (h) => !this.critters.some((o) => o !== this.player && eq(o.hex, h))));
    this.player.rig.setMoving(0);
    this.player.moving = false;
    const p = this.player.worldPos();
    this.view.lookAtWorld(p.x, p.z);
    this.ui?.setCombat(false);
    this.ui?.refresh();
  }

  /** Уйти на карту мира (через зелёную зону выхода). */
  leaveToWorldMap() {
    if (this.mode === 'combat') { this.ui.log('Нельзя уйти во время боя.'); return; }
    const loc = WORLD.locations.find((l) => l.level === this.level.def.id);
    if (loc) this.world = { x: loc.x, y: loc.y };
    this.snapshotLevel();
    this.ui.openWorldMap();
  }

  /** Прибыть в локацию с карты мира. */
  enterLocation(level: string) {
    this.encounterDef = null;
    this.loadLevel(this.levelDef(level));
    this.ui.log(`Вы прибыли: ${this.level.def.name}.`);
  }

  /** Случайная встреча в пустыне. */
  enterEncounter(type: EncounterType) {
    this.encounterDef = makeEncounter(type, Math.floor(Math.random() * 1e9));
    this.loadLevel(this.encounterDef);
    this.ui.log(this.encounterDef.name + '.');
  }

  /** Вода в миклате кончилась — конец игры, как в Fallout 1. */
  waterRunOut() {
    this.dead = true;
    this.ui.showDeath('Миклат № 7 остался без воды. Вы не успели.');
  }

  /** Время в пути по карте мира. */
  passTime(minutes: number) {
    this.minutes += minutes;
    // Отдых в пути: понемногу заживают раны.
    const p = this.player;
    p.hp = Math.min(p.maxHp, p.hp + Math.floor(((minutes / 60) * derived(p.sheet).healRate) / 6));
    p.firstAidUses = 0;
  }

  // ---------------- цикл ----------------

  update(dt: number) {
    if (this.dead) return;
    for (const c of this.critters) c.rig.update(dt);
    this.updateWallFade(dt);
    if (this.mode === 'explore') this.minutes += dt / 10;

    // Прокрутка: края экрана и клавиши, как в Fallout.
    if (!this.ui.modalOpen()) {
      // Зона прокрутки — полоса у края окна (≈90 px на 1080p), скорость растёт к самому краю.
      // Снизу полоса узкая: там панель интерфейса.
      const sp = 14 * dt;
      const zone = 90 * (window.innerHeight / 1080);
      const zoneBottom = 28 * (window.innerHeight / 1080);
      const ramp = (d: number, z: number) => (d < z ? 0.35 + 0.65 * (1 - d / z) : 0);
      let du = 0, dv = 0;
      if (this.edgeMouse.inside) {
        const { x, y } = this.edgeMouse;
        du -= sp * ramp(x, zone);
        du += sp * ramp(window.innerWidth - 1 - x, zone);
        dv -= sp * ramp(y, zone);
        dv += sp * ramp(window.innerHeight - 1 - y, zoneBottom);
      }
      if (this.keys.has('ArrowLeft')) du -= sp;
      if (this.keys.has('ArrowRight')) du += sp;
      if (this.keys.has('ArrowUp')) dv -= sp;
      if (this.keys.has('ArrowDown')) dv += sp;
      if (du || dv) this.view.pan(du, dv * 1.6);
    }

    if (this.mode === 'explore') {
      this.awarenessTimer -= dt;
      if (this.awarenessTimer <= 0) { this.awarenessTimer = 0.25; this.checkAwareness(); }
      this.barkTimer -= dt;
      if (this.barkTimer <= 0) { this.barkTimer = 7 + Math.random() * 6; this.ambientBarks(); }
      this.wander(dt);
    }
  }

  /** Как в Fallout 2: стены между камерой и героем становятся полупрозрачными. */
  private faded = new Map<THREE.Mesh, number>();
  private fadeRay = new THREE.Raycaster();
  private updateWallFade(dt: number) {
    const occ = this.level.occluders;
    if (!occ.length) return;
    const hit = new Set<THREE.Mesh>();
    const dir = this.view.camera.position.clone().sub(this.view.target).normalize();
    for (const c of [this.player, this.hovered].filter(Boolean) as Critter[]) {
      for (const h of [0.4, 1.2]) {
        const from = c.worldPos();
        from.y = h;
        this.fadeRay.set(from, dir);
        for (const i of this.fadeRay.intersectObjects(occ, false)) hit.add(i.object as THREE.Mesh);
      }
    }
    for (const m of hit) if (!this.faded.has(m)) this.faded.set(m, 1);
    for (const [m, a] of this.faded) {
      const target = hit.has(m) ? 0.3 : 1;
      const next = a + Math.sign(target - a) * Math.min(Math.abs(target - a), dt * 4);
      if (!m.userData.ownMat) { m.material = (m.material as THREE.Material).clone(); m.userData.ownMat = true; }
      const mm = m.material as THREE.MeshStandardMaterial;
      mm.transparent = next < 1;
      mm.opacity = next;
      mm.depthWrite = next >= 1;
      if (next >= 1 && !hit.has(m)) this.faded.delete(m);
      else this.faded.set(m, next);
    }
  }

  // ---------------- ввод ----------------

  onMouseMove(x: number, y: number) {
    this.mouse = { x, y, inside: true };
    this.updateHover();
  }

  onMouseLeave() { this.mouse.inside = false; }

  private critterRoots() { return this.critters.map((c) => c.rig.root); }
  private interactiveRoots() { return this.level.interactives.map((i) => i.object); }

  private pickCritter(x: number, y: number): Critter | null {
    return this.view.pick<Critter>(x, y, this.critterRoots(), 'critter');
  }
  private pickInteractive(x: number, y: number): Interactive | null {
    return this.view.pick<Interactive>(x, y, this.interactiveRoots(), 'interactive');
  }

  updateHover() {
    const { x, y } = this.mouse;
    if (this.dead || this.ui.modalOpen()) return;
    const c = this.pickCritter(x, y);
    if (this.hovered && this.hovered !== c) this.hovered.rig.setHighlight(false);
    this.hovered = c && !c.isPlayer ? c : null;
    if (this.hovered) this.hovered.rig.setHighlight(true);

    const myTurn = this.mode === 'explore' || this.current === this.player;
    if (!myTurn || this.busy) {
      this.view.showHexCursor(null);
      this.ui.setCursor('wait');
      return;
    }
    if (this.editor) {
      this.view.showHexCursor(this.view.hexAt(x, y), 0x40a0ff);
      this.ui.setCursor('move');
      return;
    }

    if (c && !c.isPlayer) {
      this.view.showHexCursor(null);
      if (c.dead) { this.ui.setCursor('use', `${c.name} (мёртв)`); return; }
      if (this.targeting === 'attack' || c.hostile) {
        const ch = this.hitChanceFor(this.player, c, 'torso');
        this.ui.setCursor('attack', `${ch}%`);
      } else {
        this.ui.setCursor('talk', c.name);
      }
      return;
    }
    const it = this.pickInteractive(x, y);
    if (it) {
      this.view.showHexCursor(null);
      this.ui.setCursor(this.targeting === 'lockpick' ? 'attack' : 'use', it.name);
      return;
    }
    if (this.targeting) { this.view.showHexCursor(null); this.ui.setCursor('attack'); return; }

    const h = this.view.hexAt(x, y);
    if (!h || !this.level.inBounds.has(key(h))) { this.view.showHexCursor(null); this.ui.setCursor('move'); return; }
    const ok = this.walkable(h, this.player);
    if (this.mode === 'combat' && ok) {
      const path = this.pathFor(this.player, h);
      const cost = path ? path.length : 99;
      const can = cost <= this.player.ap;
      this.view.showHexCursor(h, can ? 0xf2d24b : 0xd04030);
      this.ui.setCursor('move', path ? String(cost) : '✕');
    } else {
      this.view.showHexCursor(h, ok ? 0xf2d24b : 0xd04030);
      this.ui.setCursor('move', this.level.exits.has(key(h)) ? this.level.exits.get(key(h))!.label : undefined);
    }
  }

  async onClick(x: number, y: number, shift: boolean) {
    if (this.dead || this.ui.modalOpen()) return;
    sfx.wind();
    if (this.editor) { this.editorToggle(this.view.hexAt(x, y)); return; }
    const myTurn = this.mode === 'explore' || this.current === this.player;
    if (!myTurn || this.busy) return;

    const c = this.pickCritter(x, y);
    if (c && !c.isPlayer) {
      if (c.dead) { await this.lootCorpse(c); return; }
      if (this.targeting === 'attack' || c.hostile) { this.targeting = null; await this.playerAttack(c); return; }
      await this.talk(c);
      return;
    }
    const it = this.pickInteractive(x, y);
    if (it) {
      if (this.targeting === 'lockpick') { this.targeting = null; await this.useLockpick(it); return; }
      await this.interact(it);
      return;
    }
    if (this.targeting) { this.targeting = null; this.updateHover(); return; }
    const h = this.view.hexAt(x, y);
    // Двойной щелчок по точке — бег (как в Fallout 2).
    const now = performance.now();
    const dbl = now - this.lastClick.t < 400 && Math.hypot(x - this.lastClick.x, y - this.lastClick.y) < 24;
    this.lastClick = { t: dbl ? 0 : now, x, y };
    if (h) await this.movePlayer(h, shift || dbl);
  }

  onRightClick(x: number, y: number) {
    if (this.dead || this.ui.modalOpen()) return;
    if (this.targeting) { this.targeting = null; this.updateHover(); return; }
    const c = this.pickCritter(x, y);
    if (c) { this.ui.log(c.isPlayer ? `Это вы, ${this.player.name}.` : `Вы видите: ${c.name}. ${c.dead ? 'Мёртв.' : c.def.desc}`); return; }
    const it = this.pickInteractive(x, y);
    if (it) this.ui.log(`Вы видите: ${it.name}. ${it.desc}`);
  }

  onKey(e: KeyboardEvent, down: boolean) {
    if (down) this.keys.add(e.key); else this.keys.delete(e.key);
    if (!down || this.dead) return;
    if (this.ui.modalOpen()) return;
    const k = e.key.toLowerCase();
    if (k === ' ' && this.current === this.player && this.mode === 'combat' && !this.busy) { e.preventDefault(); this.endTurn(); }
    else if (k === 'enter' && this.mode === 'combat') this.tryEndCombat();
    else if (k === 'a' || k === 'ф') this.toggleAttackMode();
    else if (k === 'b' || k === 'и') this.swapHands();
    else if (k === 'n' || k === 'т') this.cycleFireMode();
    else if (k === 'r' || k === 'к') void this.reload();
    else if (k === 'home') { const p = this.player.worldPos(); this.view.lookAtWorld(p.x, p.z); }
    else if (k === 'escape') { this.targeting = null; this.updateHover(); }
    else if (e.key === 'F10') { e.preventDefault(); this.toggleEditor(); }
  }

  // ---------------- движение ----------------

  private occupied(h: Hex, except?: Critter) {
    return this.critters.some((c) => c !== except && !c.dead && eq(c.hex, h));
  }

  walkable(h: Hex, who: Critter) {
    return this.level.passable(h) && !this.occupied(h, who);
  }

  pathFor(who: Critter, to: Hex): Hex[] | null {
    return findPath(who.hex, to, (h) => this.walkable(h, who));
  }

  /** Путь до соседнего с целью гекса. */
  pathAdjacent(who: Critter, to: Hex): Hex[] | null {
    if (distance(who.hex, to) <= 1) return [];
    const p = findPath(who.hex, to, (h) => this.walkable(h, who), 4000, true);
    if (!p) return null;
    p.pop();
    return p;
  }

  private async stepAlong(c: Critter, path: Hex[], run: boolean, token?: number, inCombat = false): Promise<boolean> {
    const speed = run ? RUN_SPEED : WALK_SPEED;
    // Новый маршрут во время ходьбы: дождаться, пока закончится текущий шаг,
    // и не дать старому маршруту остановить анимацию нового.
    const seq = ++c.walkSeq;
    if (c.stepping) await c.stepping;
    if (seq !== c.walkSeq) return false;
    c.rig.setMoving(speed);
    c.moving = true;
    try {
      for (const h of path) {
        if (seq !== c.walkSeq) return false;
        if (token !== undefined && token !== this.moveToken) return false;
        if (c.dead) return false;
        if (!this.walkable(h, c)) return false;
        if (inCombat) { if (c.ap < 1) return false; c.ap -= 1; }
        const from = c.worldPos();
        const [tx, tz] = hexToWorld(h);
        c.rig.faceTo(tx - from.x, tz - from.z);
        c.hex = { ...h };
        const dur = Math.hypot(tx - from.x, tz - from.z) / speed;
        c.stepping = tween(dur, (k) => c.rig.root.position.set(from.x + (tx - from.x) * k, 0, from.z + (tz - from.z) * k));
        await c.stepping;
        c.stepping = null;
        if (c.isPlayer) {
          this.followCamera();
          if (inCombat) this.ui.refresh();
          if (this.mode === 'explore') {
            this.checkAwareness();
            if (this.mode !== 'explore') return false;
          }
        }
      }
      return true;
    } finally {
      if (seq === c.walkSeq) {
        c.rig.setMoving(0);
        c.moving = false;
      }
    }
  }

  private followCamera() {
    const p = this.player.worldPos();
    const [sx, sy] = this.view.toScreen(p);
    const w = window.innerWidth, h = window.innerHeight;
    if (sx < w * 0.25 || sx > w * 0.75 || sy < h * 0.2 || sy > h * 0.65) {
      const from = this.view.target.clone();
      void tween(0.6, (k) => {
        const e = k * (2 - k);
        this.view.lookAtWorld(from.x + (p.x - from.x) * e, from.z + (p.z - from.z) * e);
      });
    }
  }

  private centerOn(c: Critter) {
    const p = c.worldPos();
    const [sx, sy] = this.view.toScreen(p);
    if (sx < 0 || sy < 0 || sx > window.innerWidth || sy > window.innerHeight * 0.8) this.view.lookAtWorld(p.x, p.z);
  }

  async movePlayer(h: Hex, run: boolean) {
    if (!this.walkable(h, this.player)) { sfx.denied(); return; }
    const path = this.pathFor(this.player, h);
    if (!path) { sfx.denied(); return; }
    const token = ++this.moveToken;
    if (this.mode === 'combat') {
      if (path.length > this.player.ap) { this.ui.log('Недостаточно очков действия.'); sfx.denied(); return; }
      this.busy = true;
      this.view.showHexCursor(null);
      await this.stepAlong(this.player, path, false, token, true);
      this.busy = false;
      this.ui.refresh();
      this.updateHover();
      return;
    }
    this.view.showPath(path);
    const done = await this.stepAlong(this.player, path, run, token);
    if (token === this.moveToken) this.view.showPath([]);
    if (done && this.mode === 'explore') {
      if (this.level.exits.get(key(this.player.hex))) this.leaveToWorldMap();
    }
  }

  /** Подойти вплотную к гексу (для разговора, ящика, удара). */
  private async approach(target: Hex): Promise<boolean> {
    if (distance(this.player.hex, target) <= 1) return true;
    const path = this.pathAdjacent(this.player, target);
    if (!path) { this.ui.log('Туда не пройти.'); sfx.denied(); return false; }
    const token = ++this.moveToken;
    if (this.mode === 'combat') {
      if (path.length > this.player.ap) { this.ui.log('Недостаточно очков действия.'); return false; }
      this.busy = true;
      const ok = await this.stepAlong(this.player, path, false, token, true);
      this.busy = false;
      this.ui.refresh();
      return ok;
    }
    this.view.showPath(path);
    const ok = await this.stepAlong(this.player, path, false, token);
    if (token === this.moveToken) this.view.showPath([]);
    return ok && distance(this.player.hex, target) <= 1;
  }

  private faceHex(c: Critter, h: Hex) {
    const [tx, tz] = hexToWorld(h);
    const p = c.worldPos();
    c.rig.faceTo(tx - p.x, tz - p.z);
  }

  // ---------------- взаимодействие ----------------

  async talk(c: Critter) {
    if (this.mode === 'combat') { this.ui.log('Сейчас не время для разговоров.'); return; }
    if (!(await this.approach(c.hex))) return;
    this.faceHex(this.player, c.hex);
    this.faceHex(c, this.player.hex);
    const dlg = c.def.dialog ? DIALOGS[c.def.dialog] : null;
    if (dlg) { await this.ui.openDialog(c, dlg, this.dialogCtx()); this.ui.refresh(); return; }
    const barks = c.def.barks ?? ['…'];
    this.view.float(c.rig.root, pick(barks), '#e8e0a0', c.rig.height);
  }

  async interact(it: Interactive) {
    if (it.kind === 'sign' || it.kind === 'prop' || it.kind === 'hatch') {
      this.ui.log(`Вы видите: ${it.name}. ${it.desc}`);
      return;
    }
    if (!(await this.approach(it.hex))) return;
    this.faceHex(this.player, it.hex);
    if (it.kind === 'crate') {
      if (it.locked) { this.ui.log(`${it.name}: заперто.`); sfx.denied(); return; }
      if (this.mode === 'combat') { if (this.player.ap < 2) { this.ui.log('Недостаточно очков действия.'); return; } this.player.ap -= 2; }
      await this.ui.openLoot(it.name, it.items ?? (it.items = []));
      this.ui.refresh();
    }
  }

  async lootCorpse(c: Critter) {
    if (!(await this.approach(c.hex))) return;
    const items = c.inventory;
    for (const h of [0, 1] as const) if (c.hands[h]) { items.push(c.hands[h]!); c.hands[h] = null; }
    if (c.armor) { items.push(c.armor); c.armor = null; }
    await this.ui.openLoot(c.name, items);
    this.ui.refresh();
  }

  async useLockpick(it: Interactive) {
    if (it.kind !== 'crate' || !it.locked) { this.ui.log('Здесь нечего взламывать.'); return; }
    if (!(await this.approach(it.hex))) return;
    this.faceHex(this.player, it.hex);
    const chance = clamp(this.player.skill('lockpick') - it.locked + 20, 5, 95);
    this.minutes += 5;
    if (roll100() <= chance) {
      it.locked = 0;
      sfx.unlock();
      this.ui.log(`Вы вскрываете замок: ${it.name}.`);
      this.gainXp(25);
    } else {
      sfx.denied();
      this.ui.log('Вам не удалось вскрыть замок.');
    }
  }

  useFirstAid() {
    if (this.mode === 'combat') { this.ui.log('Первую помощь нельзя оказывать в бою.'); return; }
    if (this.player.hp >= this.player.maxHp) { this.ui.log('Вы не ранены.'); return; }
    if (this.player.firstAidUses >= 3) { this.ui.log('Вы уже трижды оказывали себе помощь. Нужен отдых.'); return; }
    this.player.firstAidUses++;
    this.minutes += 30;
    if (roll100() <= this.player.skill('firstAid')) {
      const heal = rand(4, 10);
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
      this.ui.log(`Вы перевязываете раны и восстанавливаете ${heal} ОЖ.`);
      this.gainXp(10);
    } else {
      this.ui.log('Вы возитесь с бинтами, но толку никакого.');
    }
    this.ui.refresh();
  }

  useSkill(id: SkillId) {
    if (id === 'firstAid' || id === 'doctor') { this.useFirstAid(); return; }
    if (id === 'lockpick') {
      this.targeting = 'lockpick';
      this.ui.log('Выберите, что взломать.');
      return;
    }
    this.ui.log('Здесь этот навык не пригодится.');
  }

  // ---------------- инвентарь ----------------

  private spendAp(n: number): boolean {
    if (this.mode !== 'combat') return true;
    if (this.current !== this.player) return false;
    if (this.player.ap < n) { this.ui.log('Недостаточно очков действия.'); sfx.denied(); return false; }
    this.player.ap -= n;
    return true;
  }

  useItem(s: Stack) {
    const d = def(s);
    if (d.heal) {
      if (!this.spendAp(2)) return;
      const p = this.player;
      const v = rand(d.heal[0], d.heal[1]);
      p.hp = Math.min(p.maxHp, p.hp + v);
      removeItem(p.inventory, s.id, 1);
      this.ui.log(`Вы используете: ${d.name}. +${v} ОЖ.`);
      this.ui.refresh();
      return;
    }
    if (d.weapon) { this.equipHand(s, this.player.activeHand); return; }
    if (d.armor) { this.equipArmor(s); return; }
    this.ui.log('Это нельзя использовать.');
  }

  equipHand(s: Stack, hand: 0 | 1) {
    const p = this.player;
    const i = p.inventory.indexOf(s);
    if (i < 0) return;
    p.inventory.splice(i, 1);
    if (p.hands[hand]) p.inventory.push(p.hands[hand]!);
    p.hands[hand] = s;
    p.fireMode[hand] = 'single';
    p.syncWeaponModel();
    this.ui.refresh();
  }

  unequipHand(hand: 0 | 1) {
    const p = this.player;
    if (!p.hands[hand]) return;
    p.inventory.push(p.hands[hand]!);
    p.hands[hand] = null;
    p.syncWeaponModel();
    this.ui.refresh();
  }

  equipArmor(s: Stack) {
    const p = this.player;
    const i = p.inventory.indexOf(s);
    if (i < 0) return;
    if (!this.spendAp(4)) return;
    p.inventory.splice(i, 1);
    if (p.armor) p.inventory.push(p.armor);
    p.armor = s;
    this.ui.log(`Вы надеваете: ${def(s).name}.`);
    this.ui.refresh();
  }

  unequipArmor() {
    const p = this.player;
    if (!p.armor) return;
    p.inventory.push(p.armor);
    p.armor = null;
    this.ui.refresh();
  }

  swapHands() {
    this.player.activeHand = this.player.activeHand === 0 ? 1 : 0;
    this.player.syncWeaponModel();
    sfx.click();
    this.ui.refresh();
  }

  cycleFireMode() {
    const p = this.player, h = p.activeHand;
    const w = p.weapon;
    const modes: FireMode[] = ['single'];
    if (p.canAim()) modes.push('aimed');
    if (w.burst) modes.push('burst');
    if (w.ammo) modes.push('reload');
    const i = modes.indexOf(p.fireMode[h]);
    p.fireMode[h] = modes[(i + 1) % modes.length];
    sfx.click();
    this.ui.refresh();
  }

  async reload() {
    const p = this.player;
    const s = p.hands[p.activeHand];
    const w = s ? def(s).weapon : undefined;
    if (!s || !w?.ammo || !w.mag) { this.ui.log('Это оружие не нужно перезаряжать.'); return; }
    const need = w.mag - (s.loaded ?? 0);
    if (need <= 0) { this.ui.log('Магазин полон.'); return; }
    const have = countItem(p.inventory, w.ammo);
    if (!have) { this.ui.log('Нет подходящих патронов.'); sfx.denied(); return; }
    if (!this.spendAp(2)) return;
    const n = removeItem(p.inventory, w.ammo, need);
    s.loaded = (s.loaded ?? 0) + n;
    p.fireMode[p.activeHand] = 'single';
    sfx.unlock();
    this.ui.log(`Вы перезаряжаете оружие (${s.loaded}/${w.mag}).`);
    this.ui.refresh();
  }

  toggleAttackMode() {
    if (this.player.fireMode[this.player.activeHand] === 'reload') { void this.reload(); return; }
    this.targeting = this.targeting === 'attack' ? null : 'attack';
    sfx.click();
    this.updateHover();
  }

  // ---------------- бой ----------------

  hitChanceFor(att: Critter, tgt: Critter, aim: AimPart): number {
    const w = att.weapon;
    return hitChance({
      skill: att.skill(w.skill),
      targetAc: tgt.ac,
      distance: distance(att.hex, tgt.hex),
      perception: att.rangePerception,
      melee: !!w.melee,
      aim,
    });
  }

  async playerAttack(tgt: Critter) {
    const p = this.player;
    const w = p.weapon;
    if (w.melee) {
      if (distance(p.hex, tgt.hex) > 1) {
        if (this.mode === 'explore') { if (!(await this.approach(tgt.hex))) return; }
        else {
          const path = this.pathAdjacent(p, tgt.hex);
          if (!path || path.length + p.attackCost() > p.ap) { this.ui.log('Слишком далеко.'); sfx.denied(); return; }
          if (!(await this.approach(tgt.hex))) return;
        }
      }
    } else {
      const d = distance(p.hex, tgt.hex);
      if (d > w.range) { this.ui.log('Цель вне досягаемости.'); sfx.denied(); return; }
      if (!this.level.lineOfSight(p.hex, tgt.hex)) { this.ui.log('Цель не видна.'); sfx.denied(); return; }
    }
    const stack = p.weaponStack;
    if (w.ammo && (stack.loaded ?? 0) <= 0) { this.ui.log('Нет патронов. Нажмите R, чтобы перезарядить.'); sfx.denied(); return; }

    let aim: AimPart = 'torso';
    const aimed = p.fireMode[p.activeHand] === 'aimed' && p.canAim();
    if (aimed) {
      const chances = Object.fromEntries(AIM_PARTS.map((a) => [a.id, this.hitChanceFor(p, tgt, a.id)])) as Record<AimPart, number>;
      const chosen = await this.ui.chooseAim(tgt, chances);
      if (!chosen) return;
      aim = chosen;
    }
    if (this.mode === 'explore') await this.startCombat(p);
    const burst = p.fireMode[p.activeHand] === 'burst' && !!w.burst;
    if (p.ap < p.attackCost(aimed, burst)) { this.ui.log('Недостаточно очков действия.'); sfx.denied(); return; }
    this.busy = true;
    if (burst) await this.burstAttack(p, tgt);
    else await this.attack(p, tgt, aim, aimed);
    this.busy = false;
    this.ui.refresh();
    this.updateHover();
    this.checkCombatOver();
  }

  async attack(att: Critter, tgt: Critter, aim: AimPart, aimed = false) {
    const w = att.weapon;
    const stack = att.weaponStack;
    att.ap -= att.attackCost(aimed, false);
    if (w.ammo && stack.loaded !== undefined) stack.loaded--;
    this.faceHex(att, tgt.hex);
    const chance = this.hitChanceFor(att, tgt, aim);
    const res = resolveAttack(chance, {
      dmg: w.dmg,
      bonus: w.addMelee ? att.meleeBonus : 0,
      critChance: att.critChance,
      aim,
      dt: tgt.dt,
      dr: tgt.dr,
      finesse: att.sheet.traits.includes('finesse'),
    });
    const anim = att.rig.attack(!w.melee);
    await wait(w.melee ? 0.22 : 0.2);
    if (!w.melee) sfx.shot(); else if (att.def.kind !== 'human') sfx.sting(); else sfx.punch();

    // Нападение на мирных делает их врагами.
    if (!tgt.hostile && att.isPlayer) this.provoke(tgt);
    tgt.aware = true;
    if (this.mode === 'combat' && tgt.hostile && !this.order.includes(tgt)) this.order.push(tgt);

    const tName = tgt.isPlayer ? 'вас' : (tgt.def.acc ?? tgt.name);
    const part = aim !== 'torso' ? ` (${partName(aim, tgt.def.kind !== 'human').toLowerCase()})` : '';
    if (!res.hit) {
      this.ui.log(att.isPlayer ? 'Вы промахиваетесь.' : `${att.name} промахивается.`);
    } else {
      const critMsg = res.crit ? AIM_PARTS.find((a) => a.id === aim)!.critMsg : '';
      let msg: string;
      if (att.isPlayer) msg = `${res.crit ? 'Критическое попадание! ' : ''}Вы попадаете в ${tName}${part}${res.crit ? `, ${critMsg}` : ''}`;
      else if (att.def.kind !== 'human') msg = `${res.crit ? 'Критический удар! ' : ''}${att.name} ${w.verb} ${tName}${part}`;
      else msg = `${res.crit ? 'Критическое попадание! ' : ''}${att.name} попадает в ${tName}${part}`;
      msg += res.damage > 0 ? `: ${res.damage} ед. урона.` : ', но не пробивает броню.';
      this.ui.log(msg, res.crit ? '#ffd060' : undefined);
      tgt.hp -= res.damage;
      if (res.damage > 0) sfx.hit();
      if (tgt.hp <= 0) await this.kill(tgt, att);
      else if (res.damage > 0) void tgt.rig.hit();
    }
    await anim;
    this.ui.refresh();
  }

  /** Очередь: каждый патрон бросается отдельно, отдача снижает точность следующих. */
  async burstAttack(att: Critter, tgt: Critter) {
    const w = att.weapon;
    const stack = att.weaponStack;
    att.ap -= att.attackCost(false, true);
    const rounds = Math.min(w.burst ?? 1, stack.loaded ?? 1);
    if (stack.loaded !== undefined) stack.loaded -= rounds;
    this.faceHex(att, tgt.hex);
    const base = this.hitChanceFor(att, tgt, 'torso');
    const anim = att.rig.attack(true);
    let hits = 0, dmg = 0, crit = false;
    for (let i = 0; i < rounds; i++) {
      const res = resolveAttack(Math.max(5, base - 10 - 6 * i), {
        dmg: w.dmg, bonus: 0, critChance: att.critChance, aim: 'torso', dt: tgt.dt, dr: tgt.dr,
        finesse: att.sheet.traits.includes('finesse'),
      });
      sfx.shot();
      await wait(0.07);
      if (res.hit) { hits++; dmg += res.damage; crit ||= res.crit; }
    }
    if (!tgt.hostile && att.isPlayer) this.provoke(tgt);
    tgt.aware = true;
    if (this.mode === 'combat' && tgt.hostile && !this.order.includes(tgt)) this.order.push(tgt);
    const tName = tgt.isPlayer ? 'вас' : (tgt.def.acc ?? tgt.name);
    const who = att.isPlayer ? 'Вы даёте очередь' : `${att.name} даёт очередь`;
    if (!hits) this.ui.log(`${who}: все пули мимо.`);
    else {
      this.ui.log(`${who}: ${hits} из ${rounds} ${hits === 1 ? 'попадает' : 'попадают'} в ${tName}, ${dmg} ед. урона.`, crit ? '#ffd060' : undefined);
      tgt.hp -= dmg;
      if (dmg > 0) sfx.hit();
      if (tgt.hp <= 0) await this.kill(tgt, att);
      else if (dmg > 0) void tgt.rig.hit();
    }
    await anim;
    this.ui.refresh();
  }

  private provoke(victim: Critter) {
    for (const c of this.critters) {
      if (c.def.faction === victim.def.faction && !c.dead && !c.hostile) {
        c.hostile = true;
        c.aware = true;
        if (this.mode === 'combat' && !this.order.includes(c)) this.order.push(c);
      }
    }
    this.karma -= 20;
    const who = victim.def.faction === 'kibbutz' ? 'Обитатели кибуца становятся'
      : victim.def.faction === 'town' ? 'Жители Беэр-Шевы становятся' : `${victim.name} становится`;
    this.ui.log(`${who} враждебны!`.replace('становится враждебны', 'становится враждебным'), '#ff7050');
  }

  async kill(c: Critter, killer: Critter) {
    c.hp = 0;
    c.dead = true;
    this.ui.log(`${c.name} ${c.def.kind === 'human' ? 'падает замертво' : 'погибает'}.`);
    await c.rig.die();
    if (c.isPlayer) { this.gameOver(); return; }
    if (killer.isPlayer) this.gainXp(c.def.xp ?? c.m?.xp ?? 50);
    if (this.level.def.id === 'kibbutz' && c.def.faction === 'monster'
      && this.critters.filter((o) => o.def.faction === 'monster').every((o) => o.dead)) {
      this.flags.add('kibbutzScorpionsDead');
      if (this.quests.tower === 'active') this.ui.log('Гнездо у башни уничтожено. Батья будет рада.', '#a0e070');
    }
  }

  scorpionsDead() {
    return this.flags.has('kibbutzScorpionsDead');
  }

  gainXp(n: number) {
    const sh = this.player.sheet;
    n = Math.round(n * (1 + 0.05 * perkRank(sh, 'swiftLearner')));
    sh.xp += n;
    this.ui.log(`Вы получаете ${n} очков опыта.`);
    while (sh.xp >= xpForLevel(sh.level + 1)) {
      const before = this.player.maxHp;
      sh.level++;
      sh.skillPoints += skillPointsPerLevel(sh);
      this.player.hp += this.player.maxHp - before;
      sfx.levelUp();
      this.ui.log(`Вы достигли уровня ${sh.level}! Распределите очки навыков в окне персонажа (C).`, '#a0e070');
      if (sh.level % PERK_EVERY === 0) {
        sh.perkPoints = (sh.perkPoints ?? 0) + 1;
        this.ui.log('Можно выбрать новый перк: окно персонажа (C) → «ПЕРК».', '#a0e070');
      }
      this.ui.flashLevel();
    }
    this.ui.refresh();
  }

  async startCombat(first?: Critter) {
    if (this.mode === 'combat') return;
    this.moveToken++;
    this.targeting = null;
    this.view.showPath([]);
    this.mode = 'combat';
    sfx.combat();
    for (const c of this.critters) {
      if (c.dead || !c.hostile) continue;
      if (c.aware || distance(c.hex, this.player.hex) <= 14) c.aware = true;
    }
    this.order = this.critters.filter((c) => !c.dead && (c.isPlayer || (c.hostile && c.aware)));
    this.order.sort((a, b) => b.sequence - a.sequence || (a.isPlayer ? -1 : 1));
    if (first) { this.order.splice(this.order.indexOf(first), 1); this.order.unshift(first); }
    // Ждём, пока все остановятся.
    while (this.critters.some((c) => c.moving)) await wait(0.05);
    this.ui.setCombat(true);
    this.ui.log('Бой!', '#ff9050');
    void this.runCombat();
    await wait(0);
  }

  private async runCombat() {
    let i = 0;
    while (this.mode === 'combat' && !this.dead) {
      const c = this.order[i % this.order.length];
      i++;
      if (c.dead) continue;
      c.ap = c.maxAp;
      c.acBonus = 0;
      this.current = c;
      this.ui.refresh();
      this.centerOn(c);
      if (c.isPlayer) {
        this.busy = false;
        this.updateHover();
        await new Promise<void>((res) => (this.playerTurnDone = res));
      } else {
        this.busy = true;
        this.updateHover();
        await this.aiTurn(c);
      }
      c.acBonus = c.dead ? 0 : c.ap;
      if (this.dead || this.mode !== 'combat') return;
      // Подтягиваем тех, кто заметил героя.
      for (const o of this.critters) {
        if (!o.dead && o.hostile && !this.order.includes(o) && (o.aware || this.sees(o, this.player))) { o.aware = true; this.order.push(o); }
      }
      if (this.checkCombatOver()) return;
    }
  }

  endTurn() {
    if (this.current !== this.player || !this.playerTurnDone) return;
    this.targeting = null;
    const done = this.playerTurnDone;
    this.playerTurnDone = null;
    this.busy = true;
    this.view.showHexCursor(null);
    done();
  }

  private checkCombatOver(): boolean {
    if (this.mode !== 'combat') return true;
    const foes = this.critters.filter((c) => !c.dead && c.hostile && c.aware);
    if (foes.length) return false;
    this.endCombat();
    return true;
  }

  tryEndCombat() {
    if (this.mode !== 'combat' || this.current !== this.player || this.busy) return;
    const near = this.critters.some((c) => !c.dead && c.hostile && c.aware && distance(c.hex, this.player.hex) <= 12 && this.sees(c, this.player));
    if (near) { this.ui.log('Нельзя закончить бой: враги рядом.'); sfx.denied(); return; }
    for (const c of this.critters) if (c.hostile) c.aware = false;
    this.endCombat();
  }

  private endCombat() {
    this.mode = 'explore';
    this.current = null;
    this.order = [];
    this.player.acBonus = 0;
    this.player.ap = this.player.maxAp;
    this.busy = false;
    const done = this.playerTurnDone;
    this.playerTurnDone = null;
    done?.();
    this.ui.setCombat(false);
    this.ui.log('Бой окончен.');
    this.ui.refresh();
    this.updateHover();
  }

  private async aiTurn(c: Critter) {
    await wait(0.3);
    const tgt = this.player;
    let guard = 30;
    while (c.ap > 0 && !c.dead && !tgt.dead && guard-- > 0 && this.mode === 'combat') {
      const w = c.weapon;
      const stack = c.weaponStack;
      const d = distance(c.hex, tgt.hex);
      if (w.ammo && (stack.loaded ?? 0) <= 0) {
        const n = removeItem(c.inventory, w.ammo, w.mag ?? 1);
        if (n > 0 && c.ap >= 2) { c.ap -= 2; stack.loaded = n; this.ui.log(`${c.name} перезаряжает оружие.`); continue; }
        c.hands[c.activeHand] = null;
        c.inventory.push(stack);
        continue;
      }
      const cost = c.attackCost(false);
      const inRange = w.melee ? d <= 1 : d <= w.range && this.level.lineOfSight(c.hex, tgt.hex);
      if (inRange) {
        if (c.ap < cost) break;
        await this.attack(c, tgt, 'torso');
        await wait(0.15);
        continue;
      }
      const path = this.pathAdjacent(c, tgt.hex);
      if (!path || !path.length) break;
      // Дальнобойные подходят, пока не появится линия огня.
      if (!(await this.stepAlong(c, [path[0]], false, undefined, true))) break;
    }
    await wait(0.2);
  }

  private sees(c: Critter, t: Critter) {
    return distance(c.hex, t.hex) <= c.perception + 4 && this.level.lineOfSight(c.hex, t.hex);
  }

  private checkAwareness() {
    if (this.mode !== 'explore') return;
    for (const c of this.critters) {
      if (c.dead || !c.hostile || c.aware) continue;
      if (this.sees(c, this.player)) {
        c.aware = true;
        this.view.float(c.rig.root, c.def.barks ? pick(c.def.barks) : '!', '#ff5040', c.rig.height);
        void this.startCombat();
        return;
      }
    }
  }

  private ambientBarks() {
    for (const c of this.critters) {
      if (c.dead || c.hostile || c.isPlayer || !c.def.barks) continue;
      if (distance(c.hex, this.player.hex) <= 9 && Math.random() < 0.6) {
        this.view.float(c.rig.root, pick(c.def.barks), '#e8e0a0', c.rig.height);
      }
    }
  }

  private wander(dt: number) {
    for (const c of this.critters) {
      if (c.dead || c.isPlayer || c.moving || c.aware) continue;
      if (c.def.faction !== 'monster' && c.def.faction !== 'raiders' && !c.def.wander) continue;
      const t = (this.wanderTimers.get(c.id) ?? Math.random() * 4) - dt;
      this.wanderTimers.set(c.id, t);
      if (t > 0) continue;
      this.wanderTimers.set(c.id, 3 + Math.random() * 5);
      const home = this.spawnHex.get(c.id)!;
      const opts = neighbors(c.hex).filter((h) => distance(h, home) <= 3 && this.walkable(h, c));
      if (opts.length) void this.stepAlong(c, [pick(opts)], false);
    }
  }

  private gameOver() {
    this.dead = true;
    this.mode = 'explore';
    this.ui.setCombat(false);
    setTimeout(() => this.ui.showDeath(), 1200);
  }

  // ---------------- диалоги ----------------

  dialogCtx(): DialogCtx {
    const p = this.player;
    return {
      flag: (f) => this.flags.has(f),
      set: (f) => { this.flags.add(f); },
      stat: (id) => effStats(p.sheet)[id],
      skill: (id) => p.skill(id),
      quest: (id) => this.quests[id] ?? 'none',
      setQuest: (id, s) => {
        const was = this.quests[id] ?? 'none';
        this.quests[id] = s;
        if (was !== s) this.ui.log(s === 'done' ? 'Задание выполнено.' : 'Новое задание в «Кешере».', '#a0e070');
      },
      give: (item, qty) => {
        addItem(p.inventory, item, qty);
        this.ui.log(`Вы получаете: ${def(item).name}${qty > 1 ? ` ×${qty}` : ''}.`);
      },
      count: (item) => countItem(p.inventory, item),
      take: (item, qty) => {
        const n = removeItem(p.inventory, item, qty);
        if (n) this.ui.log(`Вы отдаёте: ${def(item).name}${n > 1 ? ` ×${n}` : ''}.`);
        this.ui.refresh();
        return n;
      },
      hurt: () => p.maxHp - p.hp,
      heal: (n) => {
        const was = p.hp;
        p.hp = Math.min(p.maxHp, p.hp + (n ?? p.maxHp));
        if (p.hp > was) this.ui.log(`Вы восстанавливаете ${p.hp - was} ОЖ.`, '#a0e070');
        this.ui.refresh();
      },
      xp: (n) => this.gainXp(n),
      g: (m, f) => (p.sheet.sex === 'f' ? f : m),
      name: p.sheet.name,
      scorpionsDead: () => this.scorpionsDead(),
    };
  }

  // ---------------- время ----------------

  /** Дней воды у миклата осталось (как 150 дней в Fallout 1). */
  get waterDays() { return Math.max(0, 150 - Math.floor((this.minutes - START_MINUTES) / 1440)); }

  get dateString() {
    const total = Math.floor(this.minutes);
    const day = 3 + Math.floor(total / 1440);
    const hh = Math.floor((total % 1440) / 60), mm = total % 60;
    return `${day} ХЕШВАНА 2161   ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  // ---------------- сохранения ----------------

  save(): SaveData {
    this.snapshotLevel();
    return {
      v: 2, sheet: this.player.sheet, minutes: this.minutes, karma: this.karma,
      flags: [...this.flags], quests: this.quests,
      player: this.critterState(this.player),
      levelId: this.level.def.id,
      encounter: this.level.def.temporary ? this.level.def : undefined,
      levels: this.levelStates,
      world: this.world,
      seen: [...this.worldSeen],
    };
  }

  // ---------------- редактор проходимости (F10) ----------------

  private toggleEditor() {
    this.editor = !this.editor;
    this.redrawEditor();
    this.ui.log(this.editor
      ? 'Редактор проходимости: клик по гексу — переключить. F10 — выйти и скопировать правки.'
      : 'Редактор закрыт. Правки скопированы в буфер обмена.');
    if (!this.editor) {
      const json = JSON.stringify({ blockedExtra: this.level.def.blockedExtra ?? [], unblocked: this.level.def.unblocked ?? [] });
      void navigator.clipboard?.writeText(json).catch(() => {});
      console.log(json);
    }
  }

  private editorToggle(h: Hex | null) {
    if (!h || !this.level.inBounds.has(key(h))) return;
    const k = key(h);
    const d = this.level.def;
    d.blockedExtra ??= [];
    d.unblocked ??= [];
    if (this.level.blocked.has(k)) {
      this.level.blocked.delete(k);
      this.level.sightBlocked.delete(k);
      d.blockedExtra = d.blockedExtra.filter((x) => x !== k);
      if (!d.unblocked.includes(k)) d.unblocked.push(k);
    } else {
      this.level.blocked.add(k);
      this.level.sightBlocked.add(k);
      d.unblocked = d.unblocked.filter((x) => x !== k);
      if (!d.blockedExtra.includes(k)) d.blockedExtra.push(k);
    }
    this.redrawEditor();
  }

  private redrawEditor() {
    this.editorMarks.clear();
    if (!this.editor) return;
    const geo = hexShape(0.42);
    const m = new THREE.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: 0.35, depthTest: false, side: THREE.DoubleSide });
    for (const k of this.level.blocked) {
      const [q, r] = k.split(',').map(Number);
      const [x, z] = hexToWorld({ q, r });
      const o = new THREE.Mesh(geo, m);
      o.position.set(x, 0.04, z);
      o.renderOrder = 40;
      this.editorMarks.add(o);
    }
  }

  carryInfo() {
    const d = derived(this.player.sheet);
    return d.carry;
  }
}
