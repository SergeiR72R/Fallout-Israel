// Временные силуэты предметов (SVG). Когда появятся иконки из Flow,
// их пути пропишутся в ItemDef.icon и заменят эти.

const P: Record<string, string> = {
  fist: '<path d="M18 30c0-6 4-8 8-8h16c4 0 6 3 6 7v12c0 7-5 11-12 11h-6c-7 0-12-5-12-11z"/><path d="M26 22v-4c0-3 6-3 6 0v4M34 22v-5c0-3 6-3 6 0v5" fill="none" stroke="currentColor" stroke-width="3"/>',
  knife: '<path d="M8 44 L40 16 C46 12 52 12 56 14 L28 46 Z"/><rect x="4" y="44" width="16" height="7" rx="2" transform="rotate(-40 12 47)"/>',
  pistol9: '<path d="M6 18h44l4 4v6H28l-2 4h-6l-3 14c-.5 2-2 3-4 3H8c-2 0-3-2-2-4l5-13H6z"/><rect x="26" y="30" width="4" height="8"/>',
  ammo9: '<g><rect x="12" y="24" width="8" height="22" rx="1"/><path d="M12 24c0-6 8-6 8 0"/><rect x="28" y="24" width="8" height="22" rx="1"/><path d="M28 24c0-6 8-6 8 0"/><rect x="44" y="24" width="8" height="22" rx="1"/><path d="M44 24c0-6 8-6 8 0"/></g>',
  stim: '<rect x="14" y="26" width="30" height="12" rx="3" transform="rotate(-35 29 32)"/><path d="M42 18l8-8M46 22l6-2" stroke="currentColor" stroke-width="3"/><path d="M10 50l8-6" stroke="currentColor" stroke-width="3"/>',
  loof: '<rect x="16" y="18" width="32" height="30" rx="4"/><ellipse cx="32" cy="18" rx="16" ry="4" fill="#0006"/><rect x="16" y="28" width="32" height="10" fill="#0004"/>',
  jacket: '<path d="M20 12l12 6 12-6 10 8-6 10-4-2v26H20V28l-4 2-6-10z"/>',
  vest: '<path d="M22 10h6l4 6 4-6h6l6 8v34H16V18z"/><rect x="22" y="26" width="20" height="16" fill="#0004"/>',
  sting: '<path d="M12 50c10-4 18-12 22-24 2-6 6-12 14-14-2 6-4 10-8 14 4 0 8-2 10-4-4 10-14 20-38 28z"/>',
  water: '<path d="M24 14h16v6l4 4v26c0 3-2 5-5 5H25c-3 0-5-2-5-5V24l4-4z"/><rect x="26" y="8" width="12" height="7" rx="2"/>',
  machete: '<path d="M6 48 L44 14 C50 10 58 12 58 18 C56 24 30 46 22 50 Z"/><rect x="2" y="46" width="14" height="7" rx="2" transform="rotate(-40 9 49)"/>',
  uzi: '<path d="M8 20h40v8H34v6h-6l-2 16h-7l2-16h-7v-6H8z"/><rect x="48" y="22" width="10" height="3"/><rect x="22" y="34" width="5" height="14" transform="rotate(8 24 40)"/>',
  sawnoff: '<path d="M4 22h36v5H4zM4 28h36v5H4z"/><path d="M40 20h8c4 0 6 3 6 6v3l-6 4v14c0 2-2 3-4 3h-4c-2 0-3-2-2-4l2-13h-0z"/>',
  galil: '<path d="M2 26h12l4-3h26l4 3h14v6H48l-4 3v4l2 10h-6l-3-11h-7l-2 6h-5l1-6h-8l-6 6H4l6-8H2z"/><rect x="24" y="34" width="5" height="10"/>',
  shell: '<g><rect x="14" y="20" width="10" height="26" rx="2"/><rect x="14" y="40" width="10" height="6" fill="#0005"/><rect x="28" y="20" width="10" height="26" rx="2"/><rect x="28" y="40" width="10" height="6" fill="#0005"/><rect x="42" y="20" width="10" height="26" rx="2"/><rect x="42" y="40" width="10" height="6" fill="#0005"/></g>',
  ammo556: '<g><rect x="14" y="20" width="7" height="28" rx="1"/><path d="M14 20l3.5-8 3.5 8"/><rect x="28" y="20" width="7" height="28" rx="1"/><path d="M28 20l3.5-8 3.5 8"/><rect x="42" y="20" width="7" height="28" rx="1"/><path d="M42 20l3.5-8 3.5 8"/></g>',
  tireArmor: '<path d="M22 10h20l8 8v34H14V18z"/><g fill="#0005"><rect x="16" y="22" width="32" height="5"/><rect x="16" y="32" width="32" height="5"/><rect x="16" y="42" width="32" height="5"/></g>',
  metalArmor: '<path d="M20 10h24l8 10-4 6v26H16V26l-4-6z"/><g fill="#0004"><rect x="20" y="28" width="24" height="3"/><circle cx="22" cy="18" r="2"/><circle cx="42" cy="18" r="2"/></g>',
  asimon: '<circle cx="32" cy="32" r="18"/><rect x="29" y="18" width="6" height="28" fill="#0007"/>',
};

/** Иконки, нарисованные во Flow (public/icons/<id>.webp). Для остальных — SVG-силуэт. */
const RASTER = new Set(['pistol9', 'knife', 'ammo9', 'stim', 'loof', 'water', 'jacket', 'vest', 'asimon']);

export function itemIcon(id: string): string {
  if (RASTER.has(id)) return `<img class="ico raster" src="icons/${id}.webp" alt="" draggable="false">`;
  const body = P[id] ?? '<rect x="16" y="16" width="32" height="32" rx="4"/>';
  return `<svg viewBox="0 0 64 64" class="ico" fill="currentColor">${body}</svg>`;
}

const cur = (svg: string, x: number, y: number, fallback: string) =>
  `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") ${x} ${y}, ${fallback}`;

export const CURSORS = {
  move: cur('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><path d="M2 2 L2 22 L8 16 L12 26 L16 24 L12 14 L20 14 Z" fill="#f2d24b" stroke="#3a2a00" stroke-width="1.5"/></svg>', 2, 2, 'default'),
  attack: cur('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><g stroke="#ff3a20" stroke-width="2.5" fill="none"><circle cx="16" cy="16" r="9"/><path d="M16 1v8M16 23v8M1 16h8M23 16h8"/></g><circle cx="16" cy="16" r="1.8" fill="#ff3a20"/></svg>', 16, 16, 'crosshair'),
  use: cur('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><circle cx="14" cy="14" r="9" fill="none" stroke="#f2d24b" stroke-width="3"/><circle cx="14" cy="14" r="3" fill="#f2d24b"/></svg>', 14, 14, 'pointer'),
  talk: cur('<svg xmlns="http://www.w3.org/2000/svg" width="30" height="28"><path d="M3 3h24v15H12l-6 6v-6H3z" fill="#f2d24b" stroke="#3a2a00" stroke-width="1.5"/></svg>', 3, 3, 'pointer'),
  wait: cur('<svg xmlns="http://www.w3.org/2000/svg" width="26" height="30"><path d="M3 2h20M3 28h20M6 2c0 9 12 9 12 13S6 19 6 28M20 2c0 9-12 9-12 13s12 4 12 13" fill="none" stroke="#f2d24b" stroke-width="2.5"/></svg>', 13, 15, 'wait'),
};
