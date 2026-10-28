// Карта мира в духе Fallout: местность, туман войны по клеткам 10×10 км,
// путешествие с течением времени и случайные встречи.
// Подложка — нарисованная во Flow карта (public/art/worldmap.webp); пока она грузится
// или если её нет, рисуется процедурная.

import type { Game } from '../game/game';
import { WORLD, ENCOUNTERS, EncounterType, WorldLocation, rollEncounter } from '../data/world';
import { el, esc } from '../core/util';
import { sfx } from './sfx';

const PX = 7.5; // пикселей на километр
const W = WORLD.width * PX, H = Math.round(WORLD.height * PX);
/** Внутреннее разрешение холста: вдвое больше, чтобы карта была чёткой на 4K. */
const DPR = 2;
// Клетки тумана совпадают с сеткой нарисованной карты: 30 × 16.
const CELL_X = WORLD.width / 30, CELL_Y = WORLD.height / 16;

const painted = new Image();
let paintedReady = false;
painted.onload = () => { paintedReady = true; };
painted.src = 'art/worldmap.webp';

let terrain: HTMLCanvasElement | null = null;

function terrainCanvas(): CanvasImageSource {
  if (paintedReady) return painted;
  if (terrain) return terrain;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  let seed = 11;
  const R = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const k = (x: number) => x * PX;

  g.fillStyle = '#c4a068';
  g.fillRect(0, 0, W, H);
  // Пятна песка и камня.
  for (let i = 0; i < 260; i++) {
    const x = R() * W, y = R() * H, r = 20 + R() * 90;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const dark = R() < 0.5;
    gr.addColorStop(0, dark ? 'rgba(110,75,40,0.18)' : 'rgba(240,215,165,0.18)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Нагорья на юге и востоке: тёмные холмы со штриховкой.
  const hills: [number, number, number][] = [];
  for (let i = 0; i < 70; i++) {
    const x = 60 + R() * 100, y = 62 + R() * 38;
    hills.push([x, y, 3 + R() * 6]);
  }
  for (let i = 0; i < 40; i++) hills.push([110 + R() * 25, 10 + R() * 55, 2 + R() * 5]);
  for (const [x, y, r] of hills) {
    const gr = g.createRadialGradient(k(x) - r * 2, k(y) - r * 2, 0, k(x), k(y), k(r));
    gr.addColorStop(0, 'rgba(170,120,70,0.55)');
    gr.addColorStop(0.6, 'rgba(110,70,40,0.45)');
    gr.addColorStop(1, 'rgba(90,60,35,0)');
    g.fillStyle = gr;
    g.beginPath(); g.arc(k(x), k(y), k(r), 0, Math.PI * 2); g.fill();
  }
  // Море.
  g.fillStyle = '#35505c';
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(k(26), 0);
  for (let y = 0; y <= 100; y += 4) g.lineTo(k(26 - y * 0.2 + Math.sin(y * 0.4) * 1.2), k(y));
  g.lineTo(0, H);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(230,220,190,0.5)';
  g.lineWidth = 3;
  g.beginPath();
  for (let y = 0; y <= 100; y += 4) {
    const x = k(26 - y * 0.2 + Math.sin(y * 0.4) * 1.2);
    if (y === 0) g.moveTo(x, k(y)); else g.lineTo(x, k(y));
  }
  g.stroke();
  // Мёртвое море.
  g.save();
  g.translate(k(147), k(42));
  g.rotate(0.06);
  g.fillStyle = 'rgba(240,235,220,0.8)';
  g.beginPath(); g.ellipse(0, 0, k(7.5), k(30), 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#4f7f86';
  g.beginPath(); g.ellipse(0, 0, k(6), k(28), 0, 0, Math.PI * 2); g.fill();
  g.restore();
  // Вади — пересохшие русла.
  g.strokeStyle = 'rgba(95,65,35,0.55)';
  for (let i = 0; i < 14; i++) {
    g.lineWidth = 1 + R() * 2;
    let x = 30 + R() * 120, y = R() * 100;
    g.beginPath(); g.moveTo(k(x), k(y));
    for (let j = 0; j < 9; j++) { x -= 2 + R() * 4; y += (R() - 0.4) * 6; g.lineTo(k(x), k(y)); }
    g.stroke();
  }
  // Старые шоссе.
  g.setLineDash([10, 7]);
  g.lineWidth = 3;
  g.strokeStyle = 'rgba(60,55,50,0.7)';
  for (const road of [
    [[20, 12], [40, 25], [58, 38], [75, 47], [92, 55], [98, 75], [104, 100]],
    [[92, 55], [115, 50], [138, 44]],
    [[58, 38], [62, 20], [70, 0]],
  ]) {
    g.beginPath();
    road.forEach(([x, y], i) => (i ? g.lineTo(k(x), k(y)) : g.moveTo(k(x), k(y))));
    g.stroke();
  }
  g.setLineDash([]);
  // Сетка 10 км, как клетки на карте Fallout.
  g.strokeStyle = 'rgba(40,30,15,0.18)';
  g.lineWidth = 1;
  for (let x = 0; x <= WORLD.width; x += CELL_X) { g.beginPath(); g.moveTo(k(x), 0); g.lineTo(k(x), H); g.stroke(); }
  for (let y = 0; y <= WORLD.height; y += CELL_Y) { g.beginPath(); g.moveTo(0, k(y)); g.lineTo(W, k(y)); g.stroke(); }
  terrain = c;
  return c;
}


export function buildWorldMap(game: Game, close: () => void): HTMLElement {
  const wrap = el('div', 'wm metal');
  const mapBox = el('div', 'wm-map sunk');
  const canvas = document.createElement('canvas');
  canvas.width = W * DPR; canvas.height = H * DPR;
  mapBox.appendChild(canvas);
  const side = el('div', 'wm-side');
  const clock = el('div', 'wm-clock crt');
  const info = el('div', 'wm-info crt');
  const list = el('div', 'wm-list');
  const actions = el('div', 'wm-actions');
  side.append(clock, list, info, actions);
  wrap.append(mapBox, side);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(DPR, DPR);
  if (!paintedReady) painted.addEventListener('load', () => draw(), { once: true });

  let target: { x: number; y: number } | null = null;
  let traveling = false;
  let hourAcc = 0;
  let pending: EncounterType | null = null;
  let raf = 0;
  const trail: [number, number][] = [];

  const known = (l: WorldLocation) => l.knownFrom === 'start' || (!!l.knownFrom && game.flags.has(l.knownFrom));
  const here = () => WORLD.locations.find((l) => known(l) && Math.hypot(l.x - game.world.x, l.y - game.world.y) < 2.5);
  const reveal = () => {
    const cx = Math.floor(game.world.x / CELL_X), cy = Math.floor(game.world.y / CELL_Y);
    for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) {
      if (Math.abs(dx) + Math.abs(dy) < 4) game.worldSeen.add(`${cx + dx},${cy + dy}`);
    }
  };

  const draw = () => {
    ctx.drawImage(terrainCanvas(), 0, 0, W, H);
    // Туман войны.
    ctx.fillStyle = 'rgba(8,6,4,0.93)';
    for (let i = 0; i < 30; i++) for (let j = 0; j < 16; j++) {
      if (game.worldSeen.has(`${i},${j}`)) continue;
      const x0 = Math.round(i * CELL_X * PX), y0 = Math.round(j * CELL_Y * PX);
      ctx.fillRect(x0, y0, Math.round((i + 1) * CELL_X * PX) - x0, Math.round((j + 1) * CELL_Y * PX) - y0);
    }
    // След.
    ctx.fillStyle = 'rgba(200,40,20,0.8)';
    for (const [x, y] of trail) { ctx.beginPath(); ctx.arc(x * PX, y * PX, 2, 0, Math.PI * 2); ctx.fill(); }
    // Места.
    ctx.font = '600 15px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    for (const l of WORLD.locations) {
      if (!known(l)) continue;
      const x = l.x * PX, y = l.y * PX;
      ctx.strokeStyle = l.level ? '#7dff8a' : '#e8d070';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      const tw = ctx.measureText(l.name).width;
      ctx.fillRect(x - tw / 2 - 5, y + 15, tw + 10, 20);
      ctx.fillStyle = l.level ? '#9dffa8' : '#f0dc80';
      ctx.fillText(l.name, x, y + 30);
    }
    // Цель и герой.
    if (target) {
      ctx.strokeStyle = 'rgba(255,220,120,0.9)';
      ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.moveTo(game.world.x * PX, game.world.y * PX); ctx.lineTo(target.x * PX, target.y * PX); ctx.stroke();
      ctx.setLineDash([]);
    }
    const px = game.world.x * PX, py = game.world.y * PX;
    ctx.fillStyle = '#ff3a20';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#ff3a20';
    ctx.beginPath(); ctx.moveTo(px - 14, py); ctx.lineTo(px + 14, py); ctx.moveTo(px, py - 14); ctx.lineTo(px, py + 14); ctx.stroke();
  };

  const renderSide = () => {
    clock.innerHTML = `<div>${game.dateString}</div><div class="${game.waterDays <= 20 ? 'warn' : ''}">Вода в миклате: ${game.waterDays} дн.</div>`;
    list.innerHTML = '';
    for (const l of WORLD.locations) {
      if (!known(l)) continue;
      const b = el('button', 'wm-loc', `<i></i>${esc(l.name)}`);
      b.onclick = () => { if (!pending) go(l.x, l.y); };
      list.appendChild(b);
    }
    actions.innerHTML = '';
    if (pending) return;
    const h = here();
    if (traveling) {
      info.innerHTML = `<div class="hdr">В ПУТИ</div>Пустошь Негева. Щёлкните по карте, чтобы сменить направление.`;
      actions.appendChild(btn('СТОП', () => { traveling = false; target = null; renderSide(); draw(); }));
      return;
    }
    if (h) {
      info.innerHTML = `<div class="hdr">${esc(h.name.toUpperCase())}</div>${esc(h.desc)}`;
      actions.appendChild(btn(h.level ? `ВОЙТИ` : 'ПОДОЙТИ', () => {
        if (h.level) { stop(); close(); game.enterLocation(h.level); }
        else { info.innerHTML = `<div class="hdr">${esc(h.name.toUpperCase())}</div>${esc(h.closed ?? '')}`; sfx.denied(); }
      }));
    } else {
      info.innerHTML = `<div class="hdr">ПУСТОШЬ НЕГЕВА</div>Щёлкните по карте или по названию места, чтобы отправиться в путь. Пешком — ${WORLD.speed} км/ч.`;
    }
  };

  const btn = (label: string, act: () => void) => {
    const b = el('button', 'rbtn', `<i></i><span>${label}</span>`);
    b.onclick = () => { sfx.click(); act(); };
    return b;
  };

  const go = (x: number, y: number) => {
    target = { x: Math.max(0, Math.min(WORLD.width, x)), y: Math.max(0, Math.min(WORLD.height, y)) };
    if (!traveling) { traveling = true; last = performance.now(); raf = requestAnimationFrame(tick); }
    renderSide();
  };

  const encounter = (type: EncounterType) => {
    traveling = false;
    pending = type;
    // Выживание: шанс заметить встречу заранее и обойти её.
    const spotted = type === 'trader' || Math.random() * 100 < game.player.skill('outdoors');
    info.innerHTML = `<div class="hdr">ВСТРЕЧА</div>${esc(ENCOUNTERS.seen[type])}${spotted ? '' : '<br><br><b>Вас заметили первыми.</b>'}`;
    actions.innerHTML = '';
    actions.appendChild(btn(spotted ? 'ПОДОЙТИ' : 'ДАЛЕЕ', () => { pending = null; close(); game.enterEncounter(type); }));
    if (spotted) actions.appendChild(btn('ОБОЙТИ', () => {
      pending = null;
      if (target) { traveling = true; last = performance.now(); raf = requestAnimationFrame(tick); }
      renderSide();
    }));
    sfx.combat();
  };

  let last = 0;
  const tick = (t: number) => {
    if (!traveling || !target) return;
    const dtReal = Math.min(0.1, (t - last) / 1000);
    last = t;
    const hours = dtReal * 2.2; // 2.2 игровых часа в секунду
    const dx = target.x - game.world.x, dy = target.y - game.world.y;
    const dist = Math.hypot(dx, dy);
    const step = WORLD.speed * hours;
    const k = Math.min(1, step / Math.max(1e-6, dist));
    const usedH = dist < step ? dist / WORLD.speed : hours;
    game.world.x += dx * k;
    game.world.y += dy * k;
    game.passTime(usedH * 60);
    if (!trail.length || Math.hypot(trail[trail.length - 1][0] - game.world.x, trail[trail.length - 1][1] - game.world.y) > 1.2) {
      trail.push([game.world.x, game.world.y]);
    }
    reveal();
    if (game.waterDays <= 0) { stop(); close(); game.waterRunOut(); return; }
    hourAcc += usedH;
    while (hourAcc >= 1) {
      hourAcc -= 1;
      if (Math.random() < ENCOUNTERS.perHour && !here()) { draw(); renderSide(); encounter(rollEncounter()); return; }
    }
    if (k >= 1) { traveling = false; target = null; }
    draw();
    renderSide();
    if (traveling) raf = requestAnimationFrame(tick);
  };

  const stop = () => { traveling = false; cancelAnimationFrame(raf); };

  canvas.addEventListener('click', (e) => {
    if (pending) return;
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * WORLD.width;
    const y = ((e.clientY - r.top) / r.height) * WORLD.height;
    // Щелчок рядом с известным местом — точно в него.
    const l = WORLD.locations.find((o) => known(o) && Math.hypot(o.x - x, o.y - y) < 3);
    sfx.click();
    go(l ? l.x : x, l ? l.y : y);
  });

  reveal();
  draw();
  renderSide();
  (wrap as unknown as { stop: () => void }).stop = stop;
  return wrap;
}
