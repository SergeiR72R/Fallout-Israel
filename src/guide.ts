// Служебные рендеры для генерации ассетов во Flow (docs/guides):
//   ?guide=grid      — эталон ракурса: сетка тайлов, гексы, человек и куб для масштаба;
//   ?guide=blockout  — вся локация из примитивов (цветная), для перерисовки во Flow;
//   ?guide=clay      — то же в сером «пластилине».
//   &level=beersheba — другая локация (по умолчанию кибуц).
// Для blockout/clay рядом публикуется калибровка (window.__guide): размеры,
// пикселей на метр и пиксель гекса (0,0) — с ней перерисованная картинка
// встаёт в игру точно по сетке.

import * as THREE from 'three';
import { CAM_PITCH, CAM_YAW, HEX_R, PPU_1080 } from './config';
import { Level } from './world/level';
import { KIBBUTZ } from './data/kibbutz';
import { BEERSHEBA } from './data/beersheba';
import { HumanRig } from './world/models';
import { hexToWorld, uvToWorld, offsetToHex } from './core/hex';

declare global { interface Window { __guide?: unknown } }

function setupRenderer(w: number, h: number) {
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1);
  r.setSize(w, h);
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.3;
  return r;
}

function lights(scene: THREE.Scene, center: THREE.Vector3, span: number) {
  scene.add(new THREE.HemisphereLight(0xffdcae, 0x3a2c1e, 0.9));
  const sun = new THREE.DirectionalLight(0xffe2b4, 3.1);
  sun.position.set(center.x - 22, 40, center.z + 6);
  sun.target.position.copy(center);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const sc = sun.shadow.camera;
  sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span; sc.near = 1; sc.far = 150;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
}

const camDir = new THREE.Vector3(
  Math.sin(CAM_YAW) * Math.cos(CAM_PITCH), Math.sin(CAM_PITCH), Math.cos(CAM_YAW) * Math.cos(CAM_PITCH),
);

export function renderGuide(app: HTMLElement, mode: string) {
  document.body.style.overflow = 'hidden';
  if (mode === 'grid') return gridGuide(app);
  return levelGuide(app, mode === 'clay');
}

function gridGuide(app: HTMLElement) {
  const W = 1920, H = 1080;
  const r = setupRenderer(W, H);
  r.setClearColor(0x9a9a96);
  app.appendChild(r.domElement);
  const scene = new THREE.Scene();
  const center = new THREE.Vector3(0, 0, 0);
  lights(scene, center, 20);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0xb0aca2, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  // Сетка тайлов (2 м) — вдоль неё идут стены зданий.
  const grid = new THREE.GridHelper(80, 40, 0x3a3630, 0x5a554c);
  grid.position.y = 0.01;
  scene.add(grid);
  // Гексы (1 м) — по ним ходят персонажи.
  const pts: number[] = [];
  for (let c = -24; c < 24; c++) for (let rr = -30; rr < 30; rr++) {
    const h = offsetToHex(c, rr);
    const [cx, cz] = hexToWorld(h);
    if (Math.hypot(cx, cz) > 14) continue;
    for (let i = 0; i < 6; i++) {
      const a1 = (Math.PI / 3) * i, a2 = (Math.PI / 3) * (i + 1);
      const [x1, z1] = uvToWorld(HEX_R * Math.cos(a1), HEX_R * Math.sin(a1));
      const [x2, z2] = uvToWorld(HEX_R * Math.cos(a2), HEX_R * Math.sin(a2));
      pts.push(cx + x1, 0.02, cz + z1, cx + x2, 0.02, cz + z2);
    }
  }
  const hexGeo = new THREE.BufferGeometry();
  hexGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  scene.add(new THREE.LineSegments(hexGeo, new THREE.LineBasicMaterial({ color: 0xe8d070, transparent: true, opacity: 0.55 })));

  // Масштаб: человек 1.8 м, куб 3×3×3 м (высота этажа), дверной проём.
  const man = new HumanRig({ skin: 0xc8a07a, cloth: 0x3f5566, cloth2: 0x2a2f33, hair: 0x2b1d12 });
  man.root.position.set(0, 0, 0);
  man.faceTo(0.5, 1, true);
  man.update(0);
  scene.add(man.root);
  const cube = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3), new THREE.MeshStandardMaterial({ color: 0xd8d0c0, roughness: 0.95 }));
  cube.position.set(-5, 1.5, -2);
  cube.castShadow = cube.receiveShadow = true;
  scene.add(cube);
  const wall = new THREE.Group();
  const wm = new THREE.MeshStandardMaterial({ color: 0xc8b898, roughness: 0.95 });
  for (const [x, w] of [[-2.1, 2.2], [2.1, 2.2]]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(w, 3, 0.3), wm);
    p.position.set(x, 1.5, 0);
    p.castShadow = p.receiveShadow = true;
    wall.add(p);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, 0.3), wm);
  lintel.position.set(0, 2.6, 0);
  lintel.castShadow = true;
  wall.add(lintel);
  wall.position.set(5, 0, -3);
  scene.add(wall);

  const cam = new THREE.OrthographicCamera(-W / 2 / PPU_1080, W / 2 / PPU_1080, H / 2 / PPU_1080, -H / 2 / PPU_1080, 0.1, 500);
  cam.position.copy(center).addScaledVector(camDir, 100);
  cam.lookAt(center);
  r.render(scene, cam);
  window.__guide = { width: W, height: H, ppu: PPU_1080 };
  document.title = 'ready';
}

function levelGuide(app: HTMLElement, clay: boolean) {
  const params = new URLSearchParams(location.search);
  const ppu = Number(params.get('ppu') ?? 45);
  const def = params.get('level') === 'beersheba' ? BEERSHEBA : KIBBUTZ;
  const level = new Level({ ...def, background: undefined });
  // Без зелёных зон выхода.
  level.root.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | undefined;
    if (m && (m as THREE.MeshBasicMaterial).isMeshBasicMaterial && m.transparent) o.visible = false;
  });
  if (clay) {
    const cm = new THREE.MeshStandardMaterial({ color: 0xc9c5bc, roughness: 1 });
    level.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = cm; });
  }
  const [cx, cz] = level.centerWorld();
  const center = new THREE.Vector3(cx, 0, cz);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 500);
  cam.position.copy(center).addScaledVector(camDir, 100);
  cam.lookAt(center);
  cam.updateMatrixWorld();

  // Рамка: углы карты на земле и на высоте 10 м.
  const corners: THREE.Vector3[] = [];
  for (const [u, v] of [[-1, -1], [level.sizeU + 1, -1], [-1, level.sizeV + 1], [level.sizeU + 1, level.sizeV + 1]]) {
    const [x, z] = uvToWorld(u, v);
    corners.push(new THREE.Vector3(x, 0, z), new THREE.Vector3(x, 10, z));
  }
  const inv = cam.matrixWorldInverse;
  let l = Infinity, rr = -Infinity, b = Infinity, t = -Infinity;
  for (const c of corners) {
    const p = c.clone().applyMatrix4(inv);
    l = Math.min(l, p.x); rr = Math.max(rr, p.x); b = Math.min(b, p.y); t = Math.max(t, p.y);
  }
  const W = Math.round((rr - l) * ppu), H = Math.round((t - b) * ppu);
  cam.left = l; cam.right = rr; cam.top = t; cam.bottom = b;
  cam.updateProjectionMatrix();

  const r = setupRenderer(W, H);
  r.setClearColor(0x000000);
  app.appendChild(r.domElement);
  const scene = new THREE.Scene();
  lights(scene, center, 45);
  scene.add(level.root);
  r.render(scene, cam);

  const [ox, oz] = hexToWorld({ q: 0, r: 0 });
  const o = new THREE.Vector3(ox, 0, oz).applyMatrix4(inv);
  window.__guide = {
    src: 'backgrounds/kibbutz.png', width: W, height: H, ppu,
    originPx: [Math.round((o.x - l) * ppu * 100) / 100, Math.round((t - o.y) * ppu * 100) / 100],
  };
  document.title = 'ready';
}
