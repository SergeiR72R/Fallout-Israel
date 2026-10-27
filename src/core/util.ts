// Кубики, задержки и простые анимации, привязанные к игровому циклу.

export const rand = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));
export const roll100 = () => rand(1, 100);
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

type Task = { t: number; dur: number; fn: (k: number) => void; done: () => void };
const tasks = new Set<Task>();

/** Анимация длительностью dur секунд; fn получает прогресс 0..1. */
export function tween(dur: number, fn: (k: number) => void): Promise<void> {
  return new Promise((done) => {
    if (dur <= 0) { fn(1); done(); return; }
    tasks.add({ t: 0, dur, fn, done });
  });
}

export const wait = (sec: number) => tween(sec, () => {});

export function tickTweens(dt: number) {
  for (const task of [...tasks]) {
    task.t += dt;
    const k = Math.min(1, task.t / task.dur);
    task.fn(k);
    if (k >= 1) { tasks.delete(task); task.done(); }
  }
}

export const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, cls?: string, html?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
