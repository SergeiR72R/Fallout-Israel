import './style.css';
import { View } from './world/view';
import { UI } from './ui/ui';
import { Game, SaveData } from './game/game';
import { tickTweens } from './core/util';
import { characterCreation, intro, mainMenu } from './ui/screens';
import type { Sheet } from './rules/stats';
import { renderGuide } from './guide';

const app = document.getElementById('app')!;

/** Масштаб интерфейса: всё свёрстано под 1080p и ужимается, чтобы влезть в любое окно. */
function updateUiScale() {
  const s = Math.min(window.innerHeight / 1080, window.innerWidth / 1520);
  document.documentElement.style.setProperty('--s', String(s));
}
updateUiScale();
window.addEventListener('resize', updateUiScale);

function readSave(): SaveData | null {
  try {
    const raw = localStorage.getItem('hamsin-save');
    return raw ? (JSON.parse(raw) as SaveData) : null;
  } catch { return null; }
}

function startGame(sheet: Sheet, save?: SaveData) {
  const gameHost = document.createElement('div');
  gameHost.id = 'game';
  const overlay = document.createElement('div');
  overlay.id = 'overlay';
  const uiRoot = document.createElement('div');
  uiRoot.id = 'ui';
  app.append(gameHost, overlay, uiRoot);

  const view = new View(gameHost, overlay);
  const ui = new UI(uiRoot, gameHost);
  const game = new Game(view, sheet, save);
  game.ui = ui;
  ui.attach(game);
  (window as any).game = game;

  const canvas = view.renderer.domElement;
  canvas.addEventListener('mousemove', (e) => game.onMouseMove(e.clientX, e.clientY));
  canvas.addEventListener('mouseleave', () => game.onMouseLeave());
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) void game.onClick(e.clientX, e.clientY, e.shiftKey);
    else if (e.button === 2) game.onRightClick(e.clientX, e.clientY);
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('keydown', (e) => game.onKey(e, true));
  window.addEventListener('keyup', (e) => game.onKey(e, false));

  if (save) ui.log('Игра загружена.', '#a0e070');
  else {
    ui.log('Гермодверь миклата № 7 закрывается у вас за спиной.');
    ui.log('Вокруг — руины кибуца. Где-то здесь должны быть люди. F1 — управление.');
  }

  let last = performance.now();
  const loop = (t: number) => {
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    tickTweens(dt);
    game.update(dt);
    view.render();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

async function boot() {
  const params = new URLSearchParams(location.search);
  const guide = params.get('guide');
  if (guide) { renderGuide(app, guide); return; }

  const save = readSave();
  let loadRequested = false;
  try {
    loadRequested = !!sessionStorage.getItem('hamsin-load');
    sessionStorage.removeItem('hamsin-load');
  } catch { /* хранилище недоступно */ }
  if (loadRequested && save) {
    startGame(save.sheet, save);
    return;
  }
  if (params.has('quick')) {
    // Быстрый старт для тестов: готовый герой без меню.
    const { newSheet } = await import('./rules/stats');
    const sh = newSheet();
    sh.base = { st: 6, pe: 7, en: 6, ch: 4, in: 5, ag: 8, lk: 4 };
    sh.tags = ['smallGuns', 'melee', 'firstAid'];
    startGame(sh);
    return;
  }
  const choice = await mainMenu(app, !!save);
  if (choice === 'load' && save) { startGame(save.sheet, save); return; }
  const sheet = await characterCreation(app);
  await intro(app);
  startGame(sheet);
}

void boot();
