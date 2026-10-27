// Персонажи-спрайты, отрендеренные в Blender (tools/blender/characters.py)
// и собранные в атласы (tools/pack_sprites.py). Как в Fallout: 6 направлений
// по гексам, готовые кадры ходьбы, бега, атаки, ранения и смерти.
//
// Спрайт — вертикальная плоскость в точке ног, повёрнутая к камере и
// вытянутая по высоте на 1/cos(наклона): на экране она выглядит ровно как
// исходный кадр, а по глубине стоит там же, где персонаж, — поэтому он
// правильно заходит за стены и выходит из-за них.

import * as THREE from 'three';
import { CAM_PITCH, CAM_YAW } from '../config';
import { Rig } from './models';
import { wait } from '../core/util';

type FrameRec = [page: number, x: number, y: number, w: number, h: number, ox: number, oy: number];

export interface SheetData {
  name: string;
  ppu: number;
  height: number;
  dirs: number[];
  anims: Record<string, number>;
  pages: [url: string, w: number, h: number][];
  frames: Record<string, FrameRec>;
}

const SHEETS = import.meta.glob<SheetData>('../data/sprites/*.json', { eager: true, import: 'default' });

export function getSheet(name: string | undefined): SheetData | null {
  if (!name) return null;
  return SHEETS[`../data/sprites/${name}.json`] ?? null;
}

const pageCache = new Map<string, { tex: THREE.Texture; loaded: boolean; waiters: THREE.Texture[] }>();

/** Копия страницы атласа со своими offset/repeat; картинка — общая. */
function pageClone(url: string): THREE.Texture {
  let p = pageCache.get(url);
  if (!p) {
    const entry = { tex: null as unknown as THREE.Texture, loaded: false, waiters: [] as THREE.Texture[] };
    entry.tex = new THREE.TextureLoader().load(url, () => {
      entry.loaded = true;
      for (const c of entry.waiters) c.needsUpdate = true;
      entry.waiters = [];
    });
    entry.tex.colorSpace = THREE.SRGBColorSpace;
    entry.tex.anisotropy = 4;
    pageCache.set(url, entry);
    p = entry;
  }
  const c = p.tex.clone();
  if (p.loaded) c.needsUpdate = true;
  else p.waiters.push(c);
  return c;
}

const COS_P = Math.cos(CAM_PITCH);
const RIGHT = new THREE.Vector3(Math.cos(CAM_YAW), 0, -Math.sin(CAM_YAW));

/** Кадров в секунду по анимациям (ходьба и бег — под скорость шага). */
const FPS: Record<string, number> = { idle: 1, walk: 15, run: 18, attack: 10, hit: 12, death: 12 };

export class SpriteRig extends Rig {
  private mesh: THREE.Mesh;
  private mat: THREE.MeshBasicMaterial;
  private tex: THREE.Texture | null = null;
  private texPage = -1;
  private wset = 'none';
  private anim = 'idle';
  private t = 0;
  private once: { resolve: () => void; hold: boolean } | null = null;
  private lastKey = '';

  constructor(private sheet: SheetData) {
    super();
    this.mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, alphaTest: 0.02, toneMapped: false });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.mat);
    this.mesh.rotation.y = CAM_YAW;
    this.mesh.renderOrder = 5;
    this.mesh.raycast = () => {};
    this.root.add(this.mesh);
    // Невидимый «столб» для щелчков мышью по персонажу.
    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, sheet.height, 0.6),
      new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
    );
    hit.position.y = sheet.height / 2;
    this.root.add(hit);
    this.applyFrame();
  }

  get height() { return this.sheet.height + 0.15; }

  setWeapon(kind: string | null) {
    this.wset = kind && this.sheet.anims[`${kind}/idle`] ? kind : 'none';
    this.lastKey = '';
  }

  setHighlight(on: boolean) {
    this.mat.color.setScalar(on ? 1.3 : 1);
  }

  private dirIndex() {
    let best = 0, bd = Infinity;
    this.sheet.dirs.forEach((a, i) => {
      let d = Math.abs(a - this.facing) % (Math.PI * 2);
      if (d > Math.PI) d = Math.PI * 2 - d;
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  private frames(anim: string) {
    return this.sheet.anims[`${this.wset}/${anim}`] ?? this.sheet.anims[`none/${anim}`] ?? 1;
  }

  update(dt: number) {
    super.update(dt);
    if (this.dead) this.animate(dt);
  }

  protected animate(dt: number) {
    if (!this.once) {
      const a = this.speed > 3.5 ? 'run' : this.speed > 0 ? 'walk' : 'idle';
      if (a !== this.anim) { this.anim = a; this.t = 0; }
    }
    this.t += dt;
    this.applyFrame();
  }

  private applyFrame() {
    const n = this.frames(this.anim);
    let f = Math.floor(this.t * (FPS[this.anim] ?? 10));
    if (this.once) {
      if (f >= n) {
        f = n - 1;
        if (!this.once.hold) {
          const done = this.once.resolve;
          this.once = null;
          this.anim = 'idle';
          this.t = 0;
          f = 0;
          done();
        }
      }
    } else {
      f %= n;
    }
    const d = this.dirIndex();
    let key = `${this.wset}/${this.anim}/${d}/${f}`;
    let rec = this.sheet.frames[key];
    if (!rec) { key = `none/${this.anim}/${d}/${f}`; rec = this.sheet.frames[key]; }
    if (!rec || key === this.lastKey) return;
    this.lastKey = key;
    const [page, x, y, w, h, ox, oy] = rec;
    const [url, pw, ph] = this.sheet.pages[page];
    if (page !== this.texPage) {
      this.tex = pageClone(url);
      this.texPage = page;
      this.mat.map = this.tex;
      this.mat.needsUpdate = true;
    }
    const tex = this.tex!;
    tex.repeat.set(w / pw, h / ph);
    tex.offset.set(x / pw, 1 - (y + h) / ph);
    const ppu = this.sheet.ppu;
    this.mesh.scale.set(w / ppu, h / ppu / COS_P, 1);
    const cx = (ox + w / 2) / ppu;
    const cy = (oy + h / 2) / ppu;
    this.mesh.position.copy(RIGHT).multiplyScalar(cx);
    this.mesh.position.y = -cy / COS_P;
  }

  private play(anim: string, hold = false): Promise<void> {
    this.once?.resolve();
    return new Promise((resolve) => {
      this.anim = anim;
      this.t = 0;
      this.once = { resolve, hold };
      this.lastKey = '';
      this.applyFrame();
    });
  }

  attack() { return this.play('attack'); }
  hit() { return this.play('hit'); }

  die() {
    this.dead = true;
    this.bloodPool(0.75);
    // Смерть доигрывается до последнего кадра и остаётся на нём.
    void this.play('death', true);
    return wait(0.9);
  }
}
