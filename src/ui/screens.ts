// Главное меню, вступление и создание персонажа — по образцу Fallout.

import { GAME_SUBTITLE, GAME_TITLE } from '../config';
import { el, esc } from '../core/util';
import {
  FREE_STAT_POINTS, SKILLS, STATS, STAT_MAX, STAT_MIN, Sheet, SkillId, TRAITS, TraitId,
  derived, effStats, newSheet, skillValue,
} from '../rules/stats';
import { STAT_WORDS } from './ui';
import { sfx } from './sfx';

function redButton(label: string, act: () => void, cls = '') {
  const b = el('button', `rbtn ${cls}`, `<i></i><span>${label}</span>`);
  b.addEventListener('click', () => { sfx.click(); act(); });
  return b;
}

export function mainMenu(root: HTMLElement, hasSave: boolean): Promise<'new' | 'load'> {
  return new Promise((resolve) => {
    const s = el('div', 'screen menu-screen');
    s.innerHTML = `<div class="menu-bg" style="background-image: linear-gradient(90deg, rgba(10,6,3,.92) 0%, rgba(10,6,3,.55) 38%, rgba(10,6,3,0) 65%), url('art/menu.webp')"></div>
      <div class="menu-title"><div class="t1">${GAME_TITLE}</div><div class="t2">${GAME_SUBTITLE}</div></div>
      <div class="menu-ver">прототип 0.1 · графика-заглушка</div>`;
    const btns = el('div', 'menu-btns metal');
    const done = (r: 'new' | 'load') => { s.remove(); resolve(r); };
    btns.append(redButton('НОВАЯ ИГРА', () => done('new')));
    if (hasSave) btns.append(redButton('ЗАГРУЗИТЬ', () => done('load')));
    btns.append(redButton('ОБ ИГРЕ', () => {
      const a = el('div', 'menu-about crt', `<b>${GAME_TITLE}</b> — изометрическая ролевая игра о постъядерном Израиле.<br><br>
        Пошаговый бой с очками действия, прицельные выстрелы, 7 характеристик, 18 навыков, диалоги с проверками навыков.<br><br>
        Сейчас это технический прототип: графика временная, финальные фоны, персонажи и «говорящие головы» будут сгенерированы.<br><br><span class="dim">Щёлкните, чтобы закрыть.</span>`);
      a.onclick = () => a.remove();
      s.appendChild(a);
    }));
    s.appendChild(btns);
    root.appendChild(s);
  });
}

const INTRO = [
  'Сто лет назад небо над Землёй Израиля стало белым.',
  'Те, кто успел, спустились в миклаты — подземные убежища государственной программы «Мамад». Тяжёлые двери закрылись.',
  'Снаружи остался хамсин. Горячий ветер, который так и не стих.',
  'Миклат № 7 продержался сто лет. Но теперь его опреснитель умирает: треснула мембрана. Без неё воды хватит на сто пятьдесят дней.',
  'Совет миклата выбрал одного. Тебя.',
  'Найди мембрану. Двери за тобой закроются.',
];

/** Вступление. Если положить public/video/intro.mp4 (ролик из Flow), покажется он. */
export function intro(root: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    const s = el('div', 'screen intro-screen');
    root.appendChild(s);
    let finished = false;
    const finish = () => { if (finished) return; finished = true; s.remove(); resolve(); };
    const skip = el('div', 'intro-skip', 'Щёлкните или нажмите Esc, чтобы пропустить');
    s.appendChild(skip);
    s.addEventListener('click', finish);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') { window.removeEventListener('keydown', onKey); finish(); } };
    window.addEventListener('keydown', onKey);

    const video = document.createElement('video');
    video.src = 'video/intro.mp4';
    video.className = 'intro-video';
    video.playsInline = true;
    video.onended = finish;
    video.oncanplay = () => { s.prepend(video); void video.play().catch(() => {}); };
    video.onerror = () => slides();
    video.load();

    const slides = async () => {
      const t = el('div', 'intro-text');
      s.appendChild(t);
      for (const line of INTRO) {
        if (finished) return;
        t.textContent = line;
        t.classList.remove('show');
        void t.offsetWidth;
        t.classList.add('show');
        await new Promise((r) => setTimeout(r, 2600 + line.length * 28));
      }
      finish();
    };
  });
}

const PRESETS: { name: string; label: string; desc: string; sheet: Partial<Sheet> }[] = [
  {
    name: 'Ноам', label: 'Ноам — боец', desc: 'Служил в охране миклата. Метко стреляет и не боится драки.',
    sheet: { sex: 'm', age: 24, base: { st: 6, pe: 7, en: 6, ch: 4, in: 5, ag: 8, lk: 4 }, tags: ['smallGuns', 'melee', 'firstAid'], traits: [] },
  },
  {
    name: 'Шира', label: 'Шира — дипломат', desc: 'Дочь председателя совета. Умеет уговорить кого угодно.',
    sheet: { sex: 'f', age: 22, base: { st: 4, pe: 6, en: 5, ch: 9, in: 7, ag: 5, lk: 4 }, tags: ['speech', 'barter', 'smallGuns'], traits: [] },
  },
  {
    name: 'Ади', label: 'Ади — техник', desc: 'Чинила опреснитель, пока он ещё чинился. Умная и ловкая.',
    sheet: { sex: 'f', age: 27, base: { st: 4, pe: 6, en: 5, ch: 4, in: 9, ag: 7, lk: 5 }, tags: ['science', 'repair', 'lockpick'], traits: [] },
  },
];

export function characterCreation(root: HTMLElement): Promise<Sheet> {
  return new Promise((resolve) => {
    let sh = newSheet();
    const scr = el('div', 'screen cc-screen');
    const w = el('div', 'win metal cc');
    w.appendChild(el('div', 'win-title', 'СОЗДАНИЕ ПЕРСОНАЖА'));
    scr.appendChild(w);
    root.appendChild(scr);
    let desc = { title: 'Профиль', text: 'Распределите очки характеристик кнопками «+» и «−», затем щёлкните по трём навыкам справа, чтобы отметить их (отмеченные растут быстрее). Черты характера — по желанию, до двух. Или выберите готового героя вверху справа.' };

    const spent = () => STATS.reduce((a, s) => a + sh.base[s.id], 0) - 35;
    const left = () => FREE_STAT_POINTS - spent();

    const render = () => {
      w.querySelector('.cc-body')?.remove();
      w.querySelector('.inv-actions')?.remove();
      const body = el('div', 'cc-body');

      // Верх: имя, возраст, пол, готовые герои
      const top = el('div', 'cc-top');
      const name = el('input', 'cc-name') as HTMLInputElement;
      name.value = sh.name;
      name.maxLength = 16;
      name.oninput = () => { sh.name = name.value || 'Безымянный'; };
      const age = el('div', 'cc-age sunk', `ВОЗРАСТ <b>${sh.age}</b>`);
      const ageM = el('button', 'pm', '−'), ageP = el('button', 'pm', '+');
      ageM.onclick = () => { sh.age = Math.max(16, sh.age - 1); render(); };
      ageP.onclick = () => { sh.age = Math.min(60, sh.age + 1); render(); };
      age.prepend(ageM); age.append(ageP);
      const sex = el('button', 'cc-sex sunk', sh.sex === 'm' ? 'МУЖЧИНА' : 'ЖЕНЩИНА');
      sex.onclick = () => { sh.sex = sh.sex === 'm' ? 'f' : 'm'; sfx.click(); render(); };
      const presets = el('div', 'cc-presets');
      for (const p of PRESETS) {
        const b = el('button', 'preset', esc(p.label));
        b.onclick = () => {
          sh = { ...newSheet(), ...p.sheet, name: p.name } as Sheet;
          sh.base = { ...p.sheet.base! };
          sh.tags = [...p.sheet.tags!];
          sh.traits = [];
          desc = { title: p.label, text: p.desc };
          sfx.click();
          render();
        };
        presets.appendChild(b);
      }
      top.append(el('span', 'lbl', 'ИМЯ'), name, age, sex, presets);

      // Характеристики
      const colStats = el('div', 'cc-col');
      colStats.appendChild(el('div', 'col-lbl', 'ПРОФИЛЬ'));
      const stats = el('div', 'stats sunk');
      const eff = effStats(sh);
      for (const s of STATS) {
        const row = el('div', 'stat', `<span class="sname">${s.short}</span><span class="digits small">${String(eff[s.id]).padStart(2, '0')}</span><span class="sword">${STAT_WORDS[eff[s.id]]}</span>`);
        const m = el('button', 'pm', '−'), p = el('button', 'pm', '+');
        m.onclick = () => { if (sh.base[s.id] > STAT_MIN) { sh.base[s.id]--; sfx.click(); render(); } else sfx.denied(); };
        p.onclick = () => { if (sh.base[s.id] < STAT_MAX && left() > 0) { sh.base[s.id]++; sfx.click(); render(); } else sfx.denied(); };
        row.append(m, p);
        row.onmouseenter = () => { desc = { title: s.name, text: s.desc }; renderDesc(); };
        stats.appendChild(row);
      }
      const pts = el('div', 'cc-points', `ОЧКИ <span class="digits small">${String(left()).padStart(2, '0')}</span>`);
      colStats.append(stats, pts);

      // Производные и черты
      const colMid = el('div', 'cc-col');
      const d = derived(sh);
      colMid.appendChild(el('div', 'col-lbl', 'ПОКАЗАТЕЛИ'));
      colMid.appendChild(el('div', 'derived sunk crt', `
        <div>Очки жизни <b>${d.maxHp}</b></div><div>Класс брони <b>${d.ac}</b></div>
        <div>Очки действия <b>${d.ap}</b></div><div>Переносимый вес <b>${d.carry}</b></div>
        <div>Урон в ближнем бою <b>${d.meleeDmg}</b></div><div>Очерёдность <b>${d.sequence}</b></div>
        <div>Скорость лечения <b>${d.healRate}</b></div><div>Шанс крита <b>${d.crit}%</b></div>`));
      colMid.appendChild(el('div', 'col-lbl', `ЧЕРТЫ <span class="pts">до 2</span>`));
      const traits = el('div', 'traits sunk');
      for (const t of TRAITS) {
        const on = sh.traits.includes(t.id);
        const row = el('div', `trait${on ? ' on' : ''}`, `<i></i>${t.name}`);
        row.onclick = () => {
          if (on) sh.traits = sh.traits.filter((x) => x !== t.id);
          else if (sh.traits.length < 2) sh.traits = [...sh.traits, t.id as TraitId];
          else { sfx.denied(); return; }
          sfx.click();
          render();
        };
        row.onmouseenter = () => { desc = { title: t.name, text: t.desc }; renderDesc(); };
        traits.appendChild(row);
      }
      colMid.appendChild(traits);

      // Навыки
      const colSkills = el('div', 'cc-col');
      colSkills.appendChild(el('div', 'col-lbl', `НАВЫКИ <span class="pts">отметьте ещё: <b>${3 - sh.tags.length}</b></span>`));
      const skills = el('div', 'skills sunk');
      for (const s of SKILLS) {
        const tagged = sh.tags.includes(s.id);
        const row = el('div', `skill pickable${tagged ? ' tag' : ''}`, `<i></i><span>${s.name}</span><b>${skillValue(sh, s.id)}%</b>`);
        row.onclick = () => {
          if (tagged) sh.tags = sh.tags.filter((x) => x !== s.id);
          else if (sh.tags.length < 3) sh.tags = [...sh.tags, s.id as SkillId];
          else { sfx.denied(); return; }
          sfx.click();
          render();
        };
        row.onmouseenter = () => { desc = { title: s.name, text: s.desc }; renderDesc(); };
        skills.appendChild(row);
      }
      colSkills.appendChild(skills);

      const descBox = el('div', 'cc-desc crt');
      const renderDesc = () => { descBox.innerHTML = `<div class="hdr">${esc(desc.title)}</div>${esc(desc.text)}`; };
      renderDesc();

      body.append(top, colStats, colMid, colSkills, descBox);
      w.appendChild(body);

      const actions = el('div', 'inv-actions');
      const ready = left() === 0 && sh.tags.length === 3;
      const go = redButton('ГОТОВО', () => {
        if (!(left() === 0 && sh.tags.length === 3)) {
          sfx.denied();
          desc = { title: 'Не готово', text: left() > 0 ? `Распределите оставшиеся очки характеристик: ${left()}.` : 'Отметьте ровно три навыка.' };
          renderDesc();
          return;
        }
        scr.remove();
        resolve(sh);
      }, ready ? '' : 'dim');
      actions.append(go);
      w.appendChild(actions);
    };
    render();
  });
}
