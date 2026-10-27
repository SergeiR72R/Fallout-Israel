// Временные процедурные 3D-модели персонажей. Когда появятся модели из
// Meshy/Tripo + анимации Mixamo, их можно будет подставить вместо этих —
// интерфейс Rig (setMoving / attack / hit / die) останется тем же.

import * as THREE from 'three';
import { tween, wait, ease } from '../core/util';

let grime: THREE.Texture | null = null;
function grimeTexture(): THREE.Texture {
  if (grime) return grime;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const img = g.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 200 + Math.random() * 55;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(60,40,20,${Math.random() * 0.12})`;
    g.beginPath();
    g.arc(Math.random() * 128, Math.random() * 128, 4 + Math.random() * 18, 0, Math.PI * 2);
    g.fill();
  }
  grime = new THREE.CanvasTexture(c);
  grime.wrapS = grime.wrapT = THREE.RepeatWrapping;
  grime.colorSpace = THREE.SRGBColorSpace;
  return grime;
}

const matCache = new Map<string, THREE.MeshStandardMaterial>();
export function mat(color: number, rough = 0.85, metal = 0): THREE.MeshStandardMaterial {
  const k = `${color}:${rough}:${metal}`;
  let m = matCache.get(k);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, map: grimeTexture() });
    matCache.set(k, m);
  }
  return m;
}

function mesh(geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);

export interface HumanLook {
  skin: number; cloth: number; cloth2: number; hair: number;
  hat?: 'tembel' | 'helmet' | null;
  female?: boolean; beard?: boolean; stripe?: number;
}

export abstract class Rig {
  /** Корень: стоит в точке гекса. */
  readonly root = new THREE.Group();
  /** Поворачивается при смене направления. */
  readonly body = new THREE.Group();
  protected phase = 0;
  protected speed = 0;
  facing = 0;
  private targetFacing = 0;
  dead = false;

  constructor() {
    this.root.add(this.body);
  }

  setMoving(speed: number) { this.speed = speed; }

  faceTo(dx: number, dz: number, instant = false) {
    if (Math.abs(dx) + Math.abs(dz) < 1e-6) return;
    this.targetFacing = Math.atan2(dx, dz);
    if (instant) this.facing = this.targetFacing;
  }

  update(dt: number) {
    let d = this.targetFacing - this.facing;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.facing += d * Math.min(1, dt * 14);
    this.body.rotation.y = this.facing;
    if (this.dead) return;
    this.phase += dt * (this.speed > 0 ? this.speed * 3.2 : 1.6);
    this.animate(dt);
  }

  protected abstract animate(dt: number): void;
  abstract attack(ranged: boolean): Promise<void>;
  abstract hit(): Promise<void>;
  abstract die(): Promise<void>;
  /** Высота над землёй для всплывающего текста. */
  abstract get height(): number;

  setHighlight(on: boolean) {
    this.root.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (!m || !(o as THREE.Mesh).isMesh || !m.emissive) return;
      if (on && !o.userData.ownMat) { (o as THREE.Mesh).material = m.clone(); o.userData.ownMat = true; }
      const mm = (o as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if (o.userData.ownMat) mm.emissive.setHex(on ? 0x2a1a08 : 0x000000);
    });
  }

  protected bloodPool(size: number) {
    const m = new THREE.MeshBasicMaterial({ color: 0x3a0605, transparent: true, opacity: 0.85, depthWrite: false });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 20), m);
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.012;
    disc.scale.setScalar(0.01);
    disc.renderOrder = 1;
    this.root.add(disc);
    tween(2.5, (k) => disc.scale.set(size * ease(k), size * 0.8 * ease(k), 1));
  }

  flash(at: THREE.Object3D) {
    const light = new THREE.PointLight(0xffc060, 6, 6, 1.5);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff0a0 }));
    at.add(light, ball);
    wait(0.07).then(() => { at.remove(light, ball); light.dispose(); });
  }
}

export class HumanRig extends Rig {
  private legL = new THREE.Group();
  private legR = new THREE.Group();
  private torso = new THREE.Group();
  private armL = new THREE.Group();
  private armR = new THREE.Group();
  private hips = new THREE.Group();
  private gunSlot = new THREE.Group();
  private muzzle = new THREE.Group();
  private aiming = 0;
  private recoil = 0;
  private swing = -1;

  constructor(look: HumanLook) {
    super();
    const cloth = mat(look.cloth), cloth2 = mat(look.cloth2), skin = mat(look.skin, 0.7), hair = mat(look.hair, 0.9);
    const boot = mat(0x2a2118);
    const hipsY = 0.92;
    this.hips.position.y = hipsY;
    this.body.add(this.hips);

    for (const [leg, x] of [[this.legL, -0.1], [this.legR, 0.1]] as const) {
      leg.position.set(x, 0, 0);
      leg.add(mesh(box(0.15, 0.82, 0.17), cloth, 0, -0.41, 0));
      leg.add(mesh(box(0.16, 0.12, 0.27), boot, 0, -0.86, 0.04));
      this.hips.add(leg);
    }
    this.hips.add(this.torso);
    const chestW = look.female ? 0.36 : 0.42;
    this.torso.add(mesh(box(chestW, 0.58, 0.23), cloth, 0, 0.3, 0));
    this.torso.add(mesh(box(chestW + 0.01, 0.07, 0.24), cloth2, 0, 0.04, 0));
    if (look.stripe !== undefined) {
      this.torso.add(mesh(box(0.06, 0.58, 0.235), mat(look.stripe), 0, 0.3, 0));
    }
    const head = new THREE.Group();
    head.position.y = 0.64;
    this.torso.add(head);
    head.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 8), skin, 0, 0.02, 0));
    const skull = mesh(new THREE.SphereGeometry(0.115, 14, 10), skin, 0, 0.15, 0);
    skull.scale.set(0.92, 1.12, 1);
    head.add(skull);
    const cap = mesh(new THREE.SphereGeometry(0.122, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), hair, 0, 0.17, -0.01);
    cap.scale.set(0.95, 0.9, 1.02);
    head.add(cap);
    if (look.female) head.add(mesh(box(0.2, 0.22, 0.08), hair, 0, 0.07, -0.08));
    if (look.beard) head.add(mesh(box(0.16, 0.09, 0.06), hair, 0, 0.06, 0.08));
    if (look.hat === 'tembel') {
      // Кова-тембель — панамка кибуцника.
      const hat = mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.13, 16), mat(0x3d5f8c), 0, 0.27, 0);
      head.add(hat);
    } else if (look.hat === 'helmet') {
      const h = mesh(new THREE.SphereGeometry(0.14, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x4a5233, 0.7), 0, 0.17, 0);
      head.add(h);
    }

    for (const [arm, x] of [[this.armL, -0.27], [this.armR, 0.27]] as const) {
      arm.position.set(x, 0.54, 0);
      arm.add(mesh(box(0.11, 0.6, 0.12), cloth, 0, -0.28, 0));
      arm.add(mesh(new THREE.SphereGeometry(0.055, 8, 6), skin, 0, -0.61, 0));
      this.torso.add(arm);
    }
    this.gunSlot.position.set(0, -0.62, 0.02);
    this.armR.add(this.gunSlot);
    this.root.userData.rig = this;
  }

  get height() { return 1.9; }

  setWeapon(kind: 'pistol' | 'knife' | 'rifle' | null) {
    this.gunSlot.clear();
    this.muzzle = new THREE.Group();
    if (kind === 'pistol') {
      const g = mesh(box(0.05, 0.1, 0.24), mat(0x222222, 0.5, 0.6), 0, 0, 0.08);
      g.rotation.x = Math.PI / 2;
      this.gunSlot.add(g);
      this.muzzle.position.set(0, -0.22, 0);
    } else if (kind === 'rifle') {
      const g = mesh(box(0.06, 0.08, 0.8), mat(0x2a2a26, 0.5, 0.5), 0, 0, 0.1);
      g.rotation.x = Math.PI / 2;
      this.gunSlot.add(g);
      this.muzzle.position.set(0, -0.5, 0);
    } else if (kind === 'knife') {
      const k = mesh(box(0.02, 0.24, 0.05), mat(0xb0b0b0, 0.3, 0.8), 0, -0.1, 0.03);
      this.gunSlot.add(k);
    }
    this.gunSlot.add(this.muzzle);
  }

  protected animate() {
    const s = Math.sin(this.phase);
    const amp = this.speed > 0 ? (this.speed > 3.5 ? 0.85 : 0.55) : 0;
    this.legL.rotation.x = s * amp;
    this.legR.rotation.x = -s * amp;
    this.armL.rotation.x = -s * amp * 0.8;
    const armSwing = s * amp * 0.8;
    let armR = armSwing * (1 - this.aiming) + (-Math.PI / 2 + this.recoil) * this.aiming;
    if (this.swing >= 0) armR = -2.4 + this.swing * 2.2;
    this.armR.rotation.x = armR;
    this.hips.position.y = 0.92 + (this.speed > 0 ? Math.abs(Math.cos(this.phase)) * 0.04 : Math.sin(this.phase) * 0.006);
    this.torso.rotation.x = this.speed > 3.5 ? 0.15 : 0;
  }

  async attack(ranged: boolean) {
    if (ranged) {
      await tween(0.18, (k) => { this.aiming = ease(k); });
      this.flash(this.muzzle);
      await tween(0.12, (k) => { this.recoil = Math.sin(k * Math.PI) * 0.35; });
      await wait(0.15);
      await tween(0.25, (k) => { this.aiming = 1 - ease(k); });
    } else {
      await tween(0.12, (k) => { this.swing = 0; this.armR.rotation.x = -2.4 * k; });
      await tween(0.14, (k) => { this.swing = ease(k); });
      await wait(0.08);
      this.swing = -1;
    }
  }

  async hit() {
    await tween(0.08, (k) => { this.torso.rotation.x = -0.3 * k; });
    await tween(0.2, (k) => { this.torso.rotation.x = -0.3 * (1 - k); });
  }

  async die() {
    this.dead = true;
    this.aiming = 0;
    this.bloodPool(0.75);
    await tween(0.55, (k) => {
      const e = ease(k);
      this.body.rotation.x = -Math.PI / 2 * e;
      this.body.position.y = 0.12 * e;
      this.legL.rotation.x = 0.2 * e;
      this.legR.rotation.x = -0.15 * e;
      this.armL.rotation.x = -2.6 * e;
      this.armR.rotation.x = -0.4 * e;
    });
  }
}

export class ScorpionRig extends Rig {
  private legs: THREE.Group[] = [];
  private tail: THREE.Group[] = [];
  private clawL = new THREE.Group();
  private clawR = new THREE.Group();
  private hull = new THREE.Group();
  private strike = 0;
  private scale: number;

  constructor(size = 1, color = 0x8a6236) {
    super();
    this.scale = size;
    const shell = mat(color, 0.55);
    const dark = mat(0x3d2a17, 0.6);
    this.body.add(this.hull);
    this.hull.scale.setScalar(size);
    this.hull.position.y = 0;
    const thorax = mesh(new THREE.SphereGeometry(0.3, 14, 10), shell, 0, 0.24, 0);
    thorax.scale.set(1, 0.5, 1.6);
    this.hull.add(thorax);
    const head = mesh(new THREE.SphereGeometry(0.17, 12, 8), shell, 0, 0.24, 0.45);
    head.scale.set(1.1, 0.55, 0.9);
    this.hull.add(head);
    this.hull.add(mesh(new THREE.SphereGeometry(0.025, 6, 4), mat(0x111111, 0.2), -0.06, 0.37, 0.56));
    this.hull.add(mesh(new THREE.SphereGeometry(0.025, 6, 4), mat(0x111111, 0.2), 0.06, 0.37, 0.56));

    for (let i = 0; i < 8; i++) {
      const side = i < 4 ? -1 : 1;
      const idx = i % 4;
      const leg = new THREE.Group();
      leg.position.set(side * 0.18, 0.22, 0.22 - idx * 0.15);
      const upper = mesh(box(0.3, 0.035, 0.035), dark, side * 0.14, 0.04, 0);
      upper.rotation.z = side * 0.35;
      const lower = mesh(box(0.035, 0.28, 0.035), dark, side * 0.3, -0.08, 0);
      lower.rotation.z = side * -0.6;
      leg.add(upper, lower);
      leg.userData.side = side;
      leg.userData.idx = idx;
      this.legs.push(leg);
      this.hull.add(leg);
    }

    for (const [claw, side] of [[this.clawL, -1], [this.clawR, 1]] as const) {
      claw.position.set(side * 0.18, 0.22, 0.5);
      const arm = mesh(box(0.06, 0.06, 0.38), shell, side * 0.06, 0, 0.18);
      arm.rotation.y = -side * 0.4;
      const pincer = mesh(new THREE.SphereGeometry(0.13, 10, 8), shell, side * 0.16, 0, 0.45);
      pincer.scale.set(0.8, 0.5, 1.4);
      claw.add(arm, pincer);
      this.hull.add(claw);
    }

    // Хвост: цепочка сегментов, загибается над спиной.
    let parent: THREE.Object3D = this.hull;
    const base = new THREE.Group();
    base.position.set(0, 0.28, -0.42);
    parent.add(base);
    parent = base;
    for (let i = 0; i < 6; i++) {
      const seg = new THREE.Group();
      if (i > 0) seg.position.set(0, 0, -0.17);
      const s = mesh(new THREE.SphereGeometry(0.12 - i * 0.01, 10, 8), shell, 0, 0, -0.08);
      s.scale.set(1, 0.85, 1.3);
      seg.add(s);
      seg.rotation.x = 0.5;
      parent.add(seg);
      this.tail.push(seg);
      parent = seg;
    }
    const stinger = mesh(new THREE.ConeGeometry(0.05, 0.2, 8), mat(0x1a120a, 0.3), 0, -0.05, -0.2);
    stinger.rotation.x = -2.4;
    parent.add(stinger);
    this.root.userData.rig = this;
  }

  get height() { return 1.1 * this.scale; }

  protected animate() {
    const moving = this.speed > 0;
    for (const leg of this.legs) {
      const off = (leg.userData.idx + (leg.userData.side > 0 ? 1 : 0)) % 2 ? Math.PI : 0;
      leg.rotation.y = moving ? Math.sin(this.phase * 2.2 + off) * 0.35 : Math.sin(this.phase * 0.5 + off) * 0.03;
    }
    const sway = Math.sin(this.phase * 0.7) * 0.06;
    this.tail.forEach((seg, i) => { seg.rotation.x = 0.5 + sway + this.strike * (i < 3 ? 0.35 : -0.2); });
    this.clawL.rotation.y = Math.sin(this.phase * 0.9) * 0.08;
    this.clawR.rotation.y = -Math.sin(this.phase * 0.9 + 1) * 0.08;
  }

  async attack() {
    await tween(0.2, (k) => { this.strike = -0.4 * ease(k); });
    await tween(0.1, (k) => { this.strike = -0.4 + 1.4 * k; });
    await wait(0.1);
    await tween(0.25, (k) => { this.strike = 1 - ease(k); });
  }

  async hit() {
    await tween(0.08, (k) => { this.hull.position.y = 0.06 * k; });
    await tween(0.15, (k) => { this.hull.position.y = 0.06 * (1 - k); });
  }

  async die() {
    this.dead = true;
    this.bloodPool(0.55 * this.scale);
    await tween(0.6, (k) => {
      const e = ease(k);
      this.hull.position.y = -0.12 * e * this.scale;
      this.tail.forEach((seg, i) => { seg.rotation.x = 0.5 - (i === 0 ? 0.7 : 0.4) * e; });
      for (const leg of this.legs) leg.rotation.z = leg.userData.side * 0.8 * e;
      this.hull.rotation.z = 0.25 * e;
    });
  }
}
