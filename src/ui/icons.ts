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
  asimon: '<circle cx="32" cy="32" r="18"/><rect x="29" y="18" width="6" height="28" fill="#0007"/>',
};

export function itemIcon(id: string): string {
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
