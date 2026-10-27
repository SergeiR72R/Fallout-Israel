// Рендер: ортографическая камера в ракурсе Fallout, свет, тени,
// прокрутка карты, выбор объектов мышью, курсор-гекс и всплывающий текст.

import * as THREE from 'three';
import { CAM_PITCH, CAM_YAW, HEX_R, PPU_1080, SIN_PITCH } from '../config';
import { Hex, hexToWorld, worldToHex, worldToUV, uvToWorld } from '../core/hex';
import type { Level } from './level';
import { hexShape } from './level';

export class View {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;
  readonly target = new THREE.Vector3();
  readonly sun: THREE.DirectionalLight;
  zoom = 1;
  private readonly dir: THREE.Vector3;
  private raycaster = new THREE.Raycaster();
  readonly hexCursor: THREE.Mesh;
  private hexCursorMat: THREE.MeshBasicMaterial;
  readonly pathMarks = new THREE.Group();
  private floaters: { el: HTMLElement; obj: THREE.Object3D; h: number; until: number }[] = [];
  private overlay: HTMLElement;
  bounds: { u0: number; u1: number; v0: number; v1: number } | null = null;
  private level: Level | null = null;

  constructor(container: HTMLElement, overlay: HTMLElement) {
    this.overlay = overlay;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.98;
    this.renderer.setClearColor(0x000000);
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 500);
    this.dir = new THREE.Vector3(
      Math.sin(CAM_YAW) * Math.cos(CAM_PITCH),
      Math.sin(CAM_PITCH),
      Math.cos(CAM_YAW) * Math.cos(CAM_PITCH),
    );

    this.scene.add(new THREE.HemisphereLight(0xffdcae, 0x3a2c1e, 1.05));
    this.sun = new THREE.DirectionalLight(0xffe4bc, 2.7);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 120;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target);

    this.hexCursorMat = new THREE.MeshBasicMaterial({ color: 0xf2d24b, transparent: true, opacity: 0.9, depthTest: false, side: THREE.DoubleSide });
    this.hexCursor = new THREE.Mesh(hexRing(HEX_R * 0.98, HEX_R * 0.8), this.hexCursorMat);
    this.hexCursor.renderOrder = 50;
    this.scene.add(this.hexCursor, this.pathMarks);

    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  get ppu() { return PPU_1080 * (this.renderer.domElement.clientHeight / 1080) * this.zoom; }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    const halfH = 1080 / (2 * PPU_1080 * this.zoom);
    const halfW = halfH * (w / h);
    this.camera.left = -halfW; this.camera.right = halfW;
    this.camera.top = halfH; this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();
    this.computeBounds();
    this.clampTarget();
    this.updateCamera();
  }

  setLevel(level: Level) {
    this.scene.add(level.root);
    this.level = level;
    this.computeBounds();
  }

  /** Камера не показывает пустоту за краем карты (как в Fallout). */
  private computeBounds() {
    const level = this.level;
    if (!level) return;
    const halfH = this.camera.top, halfW = this.camera.right;
    const depth = halfH / SIN_PITCH;
    let u0 = halfW - 0.5, u1 = level.sizeU - halfW + 0.5;
    let v0 = depth - 4, v1 = level.sizeV - depth + 3;
    if (u0 > u1) u0 = u1 = level.sizeU / 2;
    if (v0 > v1) v0 = v1 = level.sizeV / 2;
    this.bounds = { u0, u1, v0, v1 };
  }

  lookAtWorld(x: number, z: number) {
    this.target.set(x, 0, z);
    this.clampTarget();
    this.updateCamera();
  }

  pan(du: number, dv: number) {
    const [u, v] = worldToUV(this.target.x, this.target.z);
    const [x, z] = uvToWorld(u + du, v + dv);
    this.target.set(x, 0, z);
    this.clampTarget();
    this.updateCamera();
  }

  private clampTarget() {
    if (!this.bounds) return;
    let [u, v] = worldToUV(this.target.x, this.target.z);
    const b = this.bounds;
    u = Math.max(b.u0, Math.min(b.u1, u));
    v = Math.max(b.v0, Math.min(b.v1, v));
    const [x, z] = uvToWorld(u, v);
    this.target.set(x, 0, z);
  }

  updateCamera() {
    this.camera.position.copy(this.target).addScaledVector(this.dir, 100);
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
    // Солнце — слева сверху, как в пререндере Fallout.
    this.sun.position.set(this.target.x - 22, 40, this.target.z + 6);
    this.sun.target.position.copy(this.target);
  }

  /** Где на экране (в пикселях) находится точка мира. */
  toScreen(p: THREE.Vector3): [number, number] {
    const v = p.clone().project(this.camera);
    const el = this.renderer.domElement;
    return [(v.x + 1) / 2 * el.clientWidth, (1 - v.y) / 2 * el.clientHeight];
  }

  private ndc(mx: number, my: number) {
    const el = this.renderer.domElement;
    return new THREE.Vector2((mx / el.clientWidth) * 2 - 1, -(my / el.clientHeight) * 2 + 1);
  }

  groundAt(mx: number, my: number): THREE.Vector3 | null {
    this.raycaster.setFromCamera(this.ndc(mx, my), this.camera);
    const r = this.raycaster.ray;
    if (Math.abs(r.direction.y) < 1e-6) return null;
    const t = -r.origin.y / r.direction.y;
    return r.origin.clone().addScaledVector(r.direction, t);
  }

  hexAt(mx: number, my: number): Hex | null {
    const p = this.groundAt(mx, my);
    return p ? worldToHex(p.x, p.z) : null;
  }

  /** Первый объект под мышью, у которого (или у предка) есть userData[keyName]. */
  pick<T>(mx: number, my: number, roots: THREE.Object3D[], keyName: string): T | null {
    this.raycaster.setFromCamera(this.ndc(mx, my), this.camera);
    const hits = this.raycaster.intersectObjects(roots, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o) {
        if (o.userData[keyName]) return o.userData[keyName] as T;
        o = o.parent;
      }
    }
    return null;
  }

  showHexCursor(h: Hex | null, color = 0xf2d24b) {
    this.hexCursor.visible = !!h;
    if (!h) return;
    const [x, z] = hexToWorld(h);
    this.hexCursor.position.set(x, 0.03, z);
    this.hexCursorMat.color.setHex(color);
  }

  showPath(path: Hex[], color = 0xf2d24b) {
    this.pathMarks.clear();
    const geo = hexShape(HEX_R * 0.18);
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, depthTest: false, side: THREE.DoubleSide });
    for (const h of path) {
      const [x, z] = hexToWorld(h);
      const o = new THREE.Mesh(geo, m);
      o.position.set(x, 0.03, z);
      o.renderOrder = 49;
      this.pathMarks.add(o);
    }
  }

  /** Всплывающий текст над персонажем, как реплики в Fallout. */
  float(obj: THREE.Object3D, text: string, color = '#e8e0a0', height = 2, sec = 3) {
    for (const f of this.floaters) if (f.obj === obj) { f.el.remove(); f.until = 0; }
    const el = document.createElement('div');
    el.className = 'floater';
    el.style.color = color;
    el.textContent = text;
    this.overlay.appendChild(el);
    this.floaters.push({ el, obj, h: height, until: performance.now() + sec * 1000 });
  }

  render() {
    const now = performance.now();
    this.floaters = this.floaters.filter((f) => {
      if (now > f.until) { f.el.remove(); return false; }
      const p = f.obj.getWorldPosition(new THREE.Vector3());
      p.y += f.h;
      const [sx, sy] = this.toScreen(p);
      f.el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -100%)`;
      return true;
    });
    this.renderer.render(this.scene, this.camera);
  }
}

export function hexRing(rOut: number, rIn: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  const hole = new THREE.Path();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    if (i === 0) { s.moveTo(rOut * Math.cos(a), rOut * Math.sin(a)); hole.moveTo(rIn * Math.cos(a), rIn * Math.sin(a)); }
    else { s.lineTo(rOut * Math.cos(a), rOut * Math.sin(a)); hole.lineTo(rIn * Math.cos(a), rIn * Math.sin(a)); }
  }
  s.closePath();
  hole.closePath();
  s.holes.push(hole);
  const g = new THREE.ShapeGeometry(s);
  g.rotateX(Math.PI / 2);
  g.rotateY(CAM_YAW);
  return g;
}
