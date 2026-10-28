// Рендерит эталонные картинки для генерации ассетов во Flow в docs/guides/.
// Запуск: npm run build && npm run guides
//
//   grid.png              — эталон ракурса Fallout (1920×1080, 90 пикс/м)
//   kibbutz-blockout.png  — вся локация из примитивов, цветная
//   kibbutz-clay.png      — то же в сером «пластилине»
//   kibbutz-calibration.json — калибровка для подстановки перерисованного фона
//   beersheba-*            — то же для Беэр-Шевы

import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch {
  ({ chromium } = require(join(process.env.NODE_PATH ?? '', 'playwright')));
}

const root = resolve('dist');
const out = resolve('docs/guides');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };

const server = createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path === '/') path = '/index.html';
  try {
    const data = await readFile(join(root, path));
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const port = server.address().port;

await mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

async function shot(mode, file, extra = '') {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(`http://localhost:${port}/?guide=${mode}${extra}`);
  await page.waitForFunction(() => document.title === 'ready', null, { timeout: 120000 });
  const info = await page.evaluate(() => window.__guide);
  const canvas = page.locator('canvas');
  const dataUrl = await canvas.evaluate((c) => c.toDataURL('image/png'));
  await writeFile(join(out, file), Buffer.from(dataUrl.split(',')[1], 'base64'));
  await page.close();
  console.log(file, JSON.stringify(info));
  return info;
}

await shot('grid', 'grid.png');
const cal = await shot('blockout', 'kibbutz-blockout.png', '&ppu=45');
await shot('clay', 'kibbutz-clay.png', '&ppu=45');
await writeFile(join(out, 'kibbutz-calibration.json'), JSON.stringify(cal, null, 2) + '\n');
const calB = await shot('blockout', 'beersheba-blockout.png', '&ppu=45&level=beersheba');
await shot('clay', 'beersheba-clay.png', '&ppu=45&level=beersheba');
await writeFile(join(out, 'beersheba-calibration.json'), JSON.stringify(calB, null, 2) + '\n');

await browser.close();
server.close();
