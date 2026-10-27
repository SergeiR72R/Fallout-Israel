// Интерфейс в духе Fallout 1/2: нижняя металлическая панель с зелёным
// монитором сообщений, кнопкой активного предмета, лампочками ОД и
// счётчиками; окна инвентаря, персонажа, «Кешера», навыков, диалога и
// прицельного выстрела. Вся графика — CSS/SVG, без чужих ассетов.

import type { Game } from '../game/game';
import type { Critter } from '../world/critter';
import type { DialogCtx, DialogDef } from '../data/dialogs';
import { QUESTS } from '../data/dialogs';
import { AimPart, partName } from '../rules/combat';
import { STATS, SKILLS, TRAITS, SkillId, derived, effStats, skillValue, skillStepCost, xpForLevel } from '../rules/stats';
import { Stack, def, invWeight, countItem } from '../rules/items';
import { CURSORS, itemIcon } from './icons';
import { el, esc } from '../core/util';
import { sfx } from './sfx';

export type CursorKind = keyof typeof CURSORS;

export const STAT_WORDS = ['', 'Ужасно', 'Плохо', 'Слабо', 'Ниже ср.', 'Средне', 'Хорошо', 'Отлично', 'Великолепно', 'Героически', 'Невероятно'];

const MODE_NAMES = { single: 'ОДИНОЧНЫЙ', aimed: 'ПРИЦЕЛЬНЫЙ', reload: 'ПЕРЕЗАРЯДКА' };

function redButton(label: string, act: () => void, cls = '') {
  const b = el('button', `rbtn ${cls}`, `<i></i><span>${label}</span>`);
  b.addEventListener('click', (e) => { e.stopPropagation(); sfx.click(); act(); });
  return b;
}

export class UI {
  game!: Game;
  private hud: HTMLElement;
  private logBox: HTMLElement;
  private lines: { text: string; color?: string }[] = [];
  private logScroll = 0;
  private cursorLabel: HTMLElement;
  private modal: { el: HTMLElement; close: () => void } | null = null;
  private itemBtn: HTMLElement;
  private apLights: HTMLElement;
  private hpDigits: HTMLElement;
  private acDigits: HTMLElement;
  private combatPanel: HTMLElement;
  private levelLamp: HTMLElement;
  private onModalChange: () => void = () => {};

  constructor(private root: HTMLElement, private canvasHost: HTMLElement) {
    this.cursorLabel = el('div', 'cursor-label');
    root.appendChild(this.cursorLabel);
    window.addEventListener('mousemove', (e) => {
      this.cursorLabel.style.transform = `translate(${e.clientX + 22}px, ${e.clientY + 18}px)`;
    });

    this.hud = el('div', 'hud metal');
    // Монитор сообщений
    const mon = el('div', 'monitor');
    this.logBox = el('div', 'log crt');
    const arrows = el('div', 'log-arrows');
    const up = el('button', 'arrow', '▲');
    const down = el('button', 'arrow', '▼');
    up.onclick = () => { this.logScroll = Math.min(this.lines.length - 1, this.logScroll + 2); this.renderLog(); };
    down.onclick = () => { this.logScroll = Math.max(0, this.logScroll - 2); this.renderLog(); };
    arrows.append(up, down);
    mon.append(this.logBox, arrows);

    const colA = el('div', 'hud-col');
    colA.append(redButton('ИНВ', () => this.openInventory()), redButton('МЕНЮ', () => this.openOptions()));

    const center = el('div', 'hud-center');
    this.itemBtn = el('div', 'itembtn');
    this.itemBtn.title = 'ЛКМ — атаковать (A). ПКМ — режим огня (N).';
    this.itemBtn.addEventListener('click', (e) => { e.stopPropagation(); this.game.toggleAttackMode(); });
    this.itemBtn.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); this.game.cycleFireMode(); });
    this.apLights = el('div', 'aplights');
    center.append(this.itemBtn, this.apLights);

    const swap = el('button', 'swapbtn', '⇄');
    swap.title = 'Сменить руку (B)';
    swap.onclick = (e) => { e.stopPropagation(); this.game.swapHands(); };

    const counters = el('div', 'hud-counters');
    this.hpDigits = el('div', 'digits');
    this.acDigits = el('div', 'digits small');
    const c1 = el('div', 'counter'); c1.append(this.hpDigits, el('span', 'lbl', 'ОЖ'));
    const c2 = el('div', 'counter'); c2.append(this.acDigits, el('span', 'lbl', 'КБ'));
    this.levelLamp = el('div', 'levellamp', 'УРОВЕНЬ');
    this.levelLamp.onclick = () => this.openCharacter();
    counters.append(c1, c2, this.levelLamp);

    const colB = el('div', 'hud-col two');
    colB.append(
      redButton('НАВЫКИ', () => this.openSkilldex()),
      redButton('КАРТА', () => this.showWorldMapStub('Пустошь Негева')),
      redButton('ПЕРС', () => this.openCharacter()),
      redButton('КЕШЕР', () => this.openKesher()),
    );

    this.combatPanel = el('div', 'combat-panel');
    this.combatPanel.append(
      redButton('ХОД', () => this.game.endTurn(), 'green'),
      redButton('БОЙ', () => this.game.tryEndCombat(), 'green'),
    );

    this.hud.append(mon, colA, center, swap, counters, colB, this.combatPanel);
    this.hud.addEventListener('mousedown', (e) => e.stopPropagation());
    this.hud.addEventListener('mousemove', () => this.setCursor('move'));
    root.appendChild(this.hud);

    window.addEventListener('keydown', (e) => {
      if (!this.game) return;
      const k = e.key.toLowerCase();
      if (k === 'escape' && this.modal) { e.preventDefault(); this.closeModal(); return; }
      if (this.modal) return;
      if (k === 'i' || k === 'ш') this.openInventory();
      else if (k === 'c' || k === 'с') this.openCharacter();
      else if (k === 'p' || k === 'з') this.openKesher();
      else if (k === 's' || k === 'ы') this.openSkilldex();
      else if (k === 'o' || k === 'щ' || k === 'escape') this.openOptions();
      else if (e.key === 'F1') { e.preventDefault(); this.openHelp(); }
      else if (e.key === 'F6') { e.preventDefault(); this.quickSave(); }
      else if (e.key === 'F9') { e.preventDefault(); this.quickLoad(); }
    });
  }

  attach(game: Game) {
    this.game = game;
    this.onModalChange = () => game.updateHover();
    this.refresh();
  }

  // ---------------- журнал ----------------

  log(text: string, color?: string) {
    this.lines.push({ text, color });
    if (this.lines.length > 200) this.lines.shift();
    this.logScroll = 0;
    this.renderLog();
  }

  private renderLog() {
    const end = this.lines.length - this.logScroll;
    const slice = this.lines.slice(Math.max(0, end - 7), end);
    this.logBox.innerHTML = slice.map((l) => `<div${l.color ? ` style="color:${l.color}"` : ''}>• ${esc(l.text)}</div>`).join('');
  }

  // ---------------- курсор ----------------

  setCursor(kind: CursorKind, label?: string) {
    this.canvasHost.style.cursor = CURSORS[kind];
    this.cursorLabel.textContent = label ?? '';
    this.cursorLabel.style.display = label ? 'block' : 'none';
    this.cursorLabel.className = `cursor-label ${kind}`;
  }

  // ---------------- панель ----------------

  refresh() {
    if (!this.game) return;
    const p = this.game.player;
    this.hpDigits.textContent = String(Math.max(0, p.hp)).padStart(3, '0');
    this.hpDigits.classList.toggle('low', p.hp <= p.maxHp / 4);
    this.acDigits.textContent = String(p.ac).padStart(3, '0');
    const inCombat = this.game.mode === 'combat';
    const apNow = inCombat ? (this.game.current === p ? p.ap : 0) : p.maxAp;
    this.apLights.innerHTML = Array.from({ length: 10 }, (_, i) =>
      `<i class="${i < apNow ? 'on' : ''}${i >= p.maxAp ? ' na' : ''}"></i>`).join('');
    this.apLights.classList.toggle('idle', !inCombat);

    const s = p.weaponStack;
    const d = def(s);
    const w = d.weapon!;
    const mode = p.fireMode[p.activeHand];
    const cost = mode === 'reload' ? 2 : p.attackCost();
    const ammo = w.ammo && w.mag ? `<div class="ammo"><div style="height:${((s.loaded ?? 0) / w.mag) * 100}%"></div></div>` : '';
    this.itemBtn.innerHTML = `
      <div class="hand">РУКА ${p.activeHand + 1}</div>
      <div class="mode">${MODE_NAMES[mode]}</div>
      ${itemIcon(s.id)}
      <div class="iname">${esc(d.name)}${w.ammo ? ` <b>${s.loaded ?? 0}/${w.mag}</b>` : ''}</div>
      <div class="apcost">ОД <b>${cost}</b></div>${ammo}`;
    this.itemBtn.classList.toggle('targeting', this.game.targeting === 'attack');
    this.levelLamp.classList.toggle('on', p.sheet.skillPoints > 0);
    if (this.modal?.el.dataset.refresh) (this.modal.el as any).refresh?.();
  }

  setCombat(on: boolean) {
    this.combatPanel.classList.toggle('open', on);
    this.refresh();
  }

  flashLevel() {
    this.levelLamp.classList.add('flash');
    setTimeout(() => this.levelLamp.classList.remove('flash'), 3000);
  }

  // ---------------- окна ----------------

  modalOpen() { return !!this.modal; }

  private openModal(win: HTMLElement, onClose?: () => void, cls = 'modal') {
    this.closeModal();
    const back = el('div', `${cls}-back`);
    back.appendChild(win);
    back.addEventListener('mousedown', (e) => e.stopPropagation());
    back.addEventListener('contextmenu', (e) => e.preventDefault());
    this.root.appendChild(back);
    this.setCursor('move');
    this.game?.view.showHexCursor(null);
    this.modal = {
      el: win,
      close: () => { back.remove(); onClose?.(); },
    };
  }

  closeModal() {
    const m = this.modal;
    if (!m) return;
    this.modal = null;
    m.close();
    this.onModalChange();
  }

  private window(title: string, cls: string): HTMLElement {
    const w = el('div', `win metal ${cls}`);
    w.appendChild(el('div', 'win-title', esc(title)));
    return w;
  }

  // ---------- инвентарь ----------

  openInventory() {
    const g = this.game;
    const p = g.player;
    const w = this.window('ИНВЕНТАРЬ', 'inv');
    w.dataset.refresh = '1';
    let selected: Stack | null = null;
    const list = el('div', 'inv-list sunk');
    const info = el('div', 'inv-info crt');
    const slots = el('div', 'inv-slots');
    const stats = el('div', 'inv-stats crt');
    const actions = el('div', 'inv-actions');

    const slot = (label: string, s: Stack | null, onClick: () => void, active = false) => {
      const b = el('div', `slot sunk${active ? ' active' : ''}`, `<div class="slot-lbl">${label}</div>${s ? itemIcon(s.id) + `<div class="slot-name">${esc(def(s).name)}</div>` : '<div class="slot-empty">пусто</div>'}`);
      b.onclick = onClick;
      return b;
    };

    const render = () => {
      list.innerHTML = '';
      for (const s of p.inventory) {
        const d = def(s);
        const row = el('div', `inv-item${s === selected ? ' sel' : ''}`, `${itemIcon(s.id)}<span>${esc(d.name)}</span>${s.qty > 1 ? `<b>×${s.qty}</b>` : ''}`);
        row.onclick = () => { selected = s; render(); };
        row.ondblclick = () => { g.useItem(s); selected = null; render(); };
        list.appendChild(row);
      }
      if (!p.inventory.length) list.appendChild(el('div', 'empty', 'Пусто'));

      slots.innerHTML = '';
      slots.append(
        slot('РУКА 1', p.hands[0], () => { if (selected && def(selected).weapon) { g.equipHand(selected, 0); selected = null; } else g.unequipHand(0); render(); }, p.activeHand === 0),
        slot('РУКА 2', p.hands[1], () => { if (selected && def(selected).weapon) { g.equipHand(selected, 1); selected = null; } else g.unequipHand(1); render(); }, p.activeHand === 1),
        slot('БРОНЯ', p.armor, () => { if (selected && def(selected).armor) { g.equipArmor(selected); selected = null; } else g.unequipArmor(); render(); }),
      );

      if (selected && p.inventory.includes(selected)) {
        const d = def(selected);
        let extra = '';
        if (d.weapon) extra = `<br>Урон: ${d.weapon.dmg[0]}–${d.weapon.dmg[1]}. ОД: ${d.weapon.ap}. Дальность: ${d.weapon.range}.${d.weapon.mag ? ` Магазин: ${selected.loaded ?? 0}/${d.weapon.mag}.` : ''}`;
        if (d.armor) extra = `<br>КБ: ${d.armor.ac}. Порог: ${d.armor.dt}. Сопротивление: ${d.armor.dr}%.`;
        if (d.heal) extra = `<br>Лечит ${d.heal[0]}–${d.heal[1]} ОЖ.`;
        info.innerHTML = `<div class="hdr">${esc(d.name)}</div>${esc(d.desc)}${extra}<br><span class="dim">Вес: ${d.weight}. Цена: ${d.value}.</span>`;
      } else {
        selected = null;
        info.innerHTML = '<div class="dim">Выберите предмет. Двойной щелчок — использовать. Щелчок по слоту — надеть выбранное или снять.</div>';
      }
      const dd = derived(p.sheet);
      const wt = invWeight(p.inventory) + [p.hands[0], p.hands[1], p.armor].reduce((a, s) => a + (s ? def(s).weight : 0), 0);
      stats.innerHTML = `<div class="hdr">${esc(p.sheet.name)}</div>
        ОЖ ${p.hp}/${p.maxHp}<br>КБ ${p.ac} · Порог ${p.dt} · Сопр. ${p.dr}%<br>
        Вес ${wt}/${dd.carry} фунтов<br>Асимоны: ${countItem(p.inventory, 'asimon')}`;

      actions.innerHTML = '';
      if (selected) {
        const d = def(selected);
        const sel = selected;
        if (d.heal) actions.appendChild(redButton('ИСПОЛЬЗОВАТЬ', () => { g.useItem(sel); selected = null; render(); }));
        if (d.weapon) actions.appendChild(redButton('В АКТИВНУЮ РУКУ', () => { g.equipHand(sel, p.activeHand); selected = null; render(); }));
        if (d.armor) actions.appendChild(redButton('НАДЕТЬ', () => { g.equipArmor(sel); selected = null; render(); }));
      }
      actions.appendChild(redButton('ЗАКРЫТЬ', () => this.closeModal()));
    };
    (w as any).refresh = render;
    const body = el('div', 'inv-body');
    const mid = el('div', 'inv-mid');
    mid.append(stats, info);
    body.append(list, mid, slots);
    w.append(body, actions);
    render();
    this.openModal(w);
  }

  // ---------- лут ----------

  openLoot(name: string, items: Stack[]): Promise<void> {
    return new Promise((resolve) => {
      const p = this.game.player;
      const w = this.window(name.toUpperCase(), 'loot');
      const left = el('div', 'inv-list sunk');
      const right = el('div', 'inv-list sunk');
      const move = (from: Stack[], to: Stack[], s: Stack) => {
        from.splice(from.indexOf(s), 1);
        const same = to.find((x) => x.id === s.id && x.loaded === undefined && s.loaded === undefined && def(x).kind !== 'weapon' && def(x).kind !== 'armor');
        if (same) same.qty += s.qty; else to.push(s);
      };
      const render = () => {
        for (const [box, src, dst] of [[left, p.inventory, items], [right, items, p.inventory]] as const) {
          box.innerHTML = '';
          for (const s of src) {
            const row = el('div', 'inv-item', `${itemIcon(s.id)}<span>${esc(def(s).name)}</span>${s.qty > 1 ? `<b>×${s.qty}</b>` : ''}`);
            row.onclick = () => { sfx.click(); move(src, dst, s); render(); this.refresh(); };
            box.appendChild(row);
          }
          if (!src.length) box.appendChild(el('div', 'empty', 'Пусто'));
        }
      };
      const cols = el('div', 'loot-cols');
      const lc = el('div', 'loot-col'); lc.append(el('div', 'col-lbl', esc(p.sheet.name.toUpperCase())), left);
      const rc = el('div', 'loot-col'); rc.append(el('div', 'col-lbl', esc(name.toUpperCase())), right);
      cols.append(lc, rc);
      const actions = el('div', 'inv-actions');
      actions.append(
        redButton('ВЗЯТЬ ВСЁ', () => { for (const s of [...items]) move(items, p.inventory, s); render(); this.refresh(); }),
        redButton('ГОТОВО', () => this.closeModal()),
      );
      w.append(cols, actions);
      render();
      this.openModal(w, resolve);
    });
  }

  // ---------- персонаж ----------

  openCharacter() {
    const g = this.game;
    const p = g.player;
    const sh = p.sheet;
    const w = this.window('ПЕРСОНАЖ', 'charwin');
    const pending: Partial<Record<SkillId, number[]>> = {};
    let desc = { title: 'Персонаж', text: 'Наведите на характеристику или навык, чтобы прочитать описание.' };
    const render = () => {
      const st = effStats(sh);
      const d = derived(sh);
      w.querySelector('.char-body')?.remove();
      const body = el('div', 'char-body');
      const left = el('div', 'char-left');
      const stats = el('div', 'stats sunk');
      for (const s of STATS) {
        const row = el('div', 'stat', `<span class="sname">${s.short}</span><span class="digits small">${String(st[s.id]).padStart(2, '0')}</span><span class="sword">${STAT_WORDS[st[s.id]]}</span>`);
        row.onmouseenter = () => { desc = { title: s.name, text: s.desc }; renderDesc(); };
        stats.appendChild(row);
      }
      const der = el('div', 'derived sunk crt', `
        <div>Очки жизни <b>${p.hp}/${p.maxHp}</b></div>
        <div>Класс брони <b>${p.ac}</b></div>
        <div>Очки действия <b>${p.maxAp}</b></div>
        <div>Переносимый вес <b>${d.carry}</b></div>
        <div>Урон в ближнем бою <b>${d.meleeDmg}</b></div>
        <div>Сопротивление урону <b>${p.dr}%</b></div>
        <div>Очерёдность <b>${d.sequence}</b></div>
        <div>Скорость лечения <b>${d.healRate}</b></div>
        <div>Шанс крита <b>${d.crit}%</b></div>`);
      left.append(stats, der);

      const mid = el('div', 'char-mid');
      const info = el('div', 'char-info crt', `
        <div><b>${esc(sh.name)}</b> · ${sh.age} лет · ${sh.sex === 'f' ? 'жен.' : 'муж.'}</div>
        <div>Уровень: <b>${sh.level}</b></div>
        <div>Опыт: <b>${sh.xp}</b></div>
        <div>След. уровень: <b>${xpForLevel(sh.level + 1)}</b></div>
        <div>Карма: <b>${g.karma}</b></div>
        <div class="dim">Черты: ${sh.traits.length ? sh.traits.map((t) => TRAITS.find((x) => x.id === t)!.name).join(', ') : 'нет'}</div>`);
      const descBox = el('div', 'char-desc crt');
      const renderDesc = () => { descBox.innerHTML = `<div class="hdr">${esc(desc.title)}</div>${esc(desc.text)}`; };
      renderDesc();
      mid.append(info, descBox);

      const right = el('div', 'char-right');
      right.appendChild(el('div', 'col-lbl', `НАВЫКИ <span class="pts">Очки: <b>${sh.skillPoints}</b></span>`));
      const skills = el('div', 'skills sunk');
      for (const s of SKILLS) {
        const v = skillValue(sh, s.id);
        const tagged = sh.tags.includes(s.id);
        const row = el('div', `skill${tagged ? ' tag' : ''}`, `<span>${s.name}</span><b>${v}%</b>`);
        if (sh.skillPoints > 0 || pending[s.id]?.length) {
          const plus = el('button', 'pm', '+');
          const minus = el('button', 'pm', '−');
          plus.onclick = () => {
            const cost = skillStepCost(v);
            if (sh.skillPoints < cost || v >= 300) { sfx.denied(); return; }
            sh.skillPoints -= cost;
            sh.skillAdd[s.id] = (sh.skillAdd[s.id] ?? 0) + (tagged ? 2 : 1);
            (pending[s.id] ??= []).push(cost);
            sfx.click();
            render();
          };
          minus.onclick = () => {
            const c = pending[s.id]?.pop();
            if (c === undefined) { sfx.denied(); return; }
            sh.skillPoints += c;
            sh.skillAdd[s.id] = (sh.skillAdd[s.id] ?? 0) - (tagged ? 2 : 1);
            sfx.click();
            render();
          };
          row.append(minus, plus);
        }
        row.onmouseenter = () => { desc = { title: s.name, text: s.desc + (tagged ? ' (отмеченный навык: растёт вдвое быстрее)' : '') }; renderDesc(); };
        skills.appendChild(row);
      }
      right.appendChild(skills);
      body.append(left, mid, right);
      w.insertBefore(body, w.querySelector('.inv-actions'));
    };
    const actions = el('div', 'inv-actions');
    actions.append(redButton('ГОТОВО', () => this.closeModal()));
    w.append(actions);
    render();
    this.openModal(w, () => this.refresh());
  }

  // ---------- навыки ----------

  openSkilldex() {
    const g = this.game;
    const w = this.window('НАВЫКИ', 'skilldex');
    const ids: SkillId[] = ['sneak', 'lockpick', 'steal', 'traps', 'firstAid', 'doctor', 'science', 'repair'];
    for (const id of ids) {
      const s = SKILLS.find((x) => x.id === id)!;
      const b = el('button', 'sd-btn', `<span>${s.name}</span><b>${g.player.skill(id)}%</b>`);
      b.onclick = () => { sfx.click(); this.closeModal(); g.useSkill(id); };
      w.appendChild(b);
    }
    const actions = el('div', 'inv-actions');
    actions.append(redButton('ОТМЕНА', () => this.closeModal()));
    w.appendChild(actions);
    this.openModal(w);
  }

  // ---------- Кешер ----------

  openKesher() {
    const g = this.game;
    const w = el('div', 'kesher metal');
    const screen = el('div', 'kesher-screen crt');
    const tabs = el('div', 'kesher-tabs');
    let tab: 'status' | 'quests' | 'map' = 'status';
    const render = () => {
      const c = g.dialogCtx();
      if (tab === 'status') {
        screen.innerHTML = `
          <div class="hdr">КЕШЕР-7 · СТАТУС</div>
          <div>${g.dateString}</div><br>
          <div>${esc(g.player.sheet.name)}: ОЖ ${g.player.hp}/${g.player.maxHp}</div>
          <div>Местность: Кибуц Нахаль-Ор, северный Негев</div><br>
          <div class="warn">ВОДА В МИКЛАТЕ № 7: ОСТАЛОСЬ ${g.waterDays} ДН.</div>`;
      } else if (tab === 'quests') {
        const qs = Object.entries(g.quests).filter(([, s]) => s !== 'none');
        screen.innerHTML = `<div class="hdr">КЕШЕР-7 · ЗАДАНИЯ</div>` + qs.map(([id, s]) =>
          `<div class="quest ${s}"><b>${esc(QUESTS[id].title)}</b>${s === 'done' ? ' — ВЫПОЛНЕНО' : ''}<br>${esc(QUESTS[id].desc(c))}</div>`).join('');
      } else {
        screen.innerHTML = `<div class="hdr">КЕШЕР-7 · КАРТЫ</div><div class="dim">Карта мира будет в следующей версии.<br><br>Известные места:<br>· Миклат № 7<br>· Кибуц Нахаль-Ор${g.flags.has('knowsBeersheva') ? '<br>· Беэр-Шева (Ицик-Мусорщик)' : ''}</div>`;
      }
    };
    for (const [id, label] of [['status', 'СТАТУС'], ['quests', 'ЗАДАНИЯ'], ['map', 'КАРТЫ']] as const) {
      tabs.appendChild(redButton(label, () => { tab = id; render(); }));
    }
    tabs.appendChild(redButton('ЗАКРЫТЬ', () => this.closeModal()));
    w.append(screen, tabs);
    render();
    this.openModal(w);
  }

  // ---------- меню ----------

  openOptions() {
    const w = this.window('МЕНЮ', 'options');
    w.append(
      redButton('СОХРАНИТЬ  (F6)', () => { this.closeModal(); this.quickSave(); }),
      redButton('ЗАГРУЗИТЬ  (F9)', () => { this.closeModal(); this.quickLoad(); }),
      redButton('УПРАВЛЕНИЕ (F1)', () => this.openHelp()),
      redButton('ГЛАВНОЕ МЕНЮ', () => { location.reload(); }),
      redButton('ПРОДОЛЖИТЬ', () => this.closeModal()),
    );
    this.openModal(w);
  }

  quickSave() {
    if (this.game.mode === 'combat') { this.log('Нельзя сохраняться во время боя.'); return; }
    try {
      localStorage.setItem('hamsin-save', JSON.stringify(this.game.save()));
      this.log('Игра сохранена.', '#a0e070');
    } catch { this.log('Не удалось сохранить игру.'); }
  }

  quickLoad() {
    let has = false;
    try { has = !!localStorage.getItem('hamsin-save'); } catch { /* нет доступа */ }
    if (!has) { this.log('Нет сохранений.'); return; }
    try { sessionStorage.setItem('hamsin-load', '1'); } catch { this.log('Не удалось загрузить игру.'); return; }
    location.reload();
  }

  openHelp() {
    const w = this.window('УПРАВЛЕНИЕ', 'help');
    w.appendChild(el('div', 'help-text crt', `
      <div><b>ЛКМ</b> по земле — идти, <b>двойной щелчок</b> (или <b>Shift</b>) — бежать</div>
      <div><b>ЛКМ</b> по врагу — атаковать, по человеку — говорить, по ящику — открыть, по трупу — обыскать</div>
      <div><b>ПКМ</b> — осмотреть</div>
      <div><b>Стрелки / края экрана</b> — прокрутка карты, <b>Home</b> — к герою</div>
      <div><b>A</b> — режим атаки · <b>N</b> — режим огня (одиночный / прицельный / перезарядка) · <b>R</b> — перезарядить · <b>B</b> — сменить руку</div>
      <div><b>Пробел</b> — закончить ход · <b>Enter</b> — закончить бой</div>
      <div><b>I</b> — инвентарь · <b>C</b> — персонаж · <b>P</b> — Кешер · <b>S</b> — навыки · <b>O/Esc</b> — меню</div>
      <div><b>F6</b> — сохранить · <b>F9</b> — загрузить · <b>F10</b> — редактор проходимости</div>`));
    const actions = el('div', 'inv-actions');
    actions.append(redButton('ГОТОВО', () => this.closeModal()));
    w.appendChild(actions);
    this.openModal(w);
  }

  showWorldMapStub(label: string) {
    const w = this.window('КАРТА МИРА', 'options');
    w.appendChild(el('div', 'help-text crt', `<div>${esc(label)}.</div><br><div class="dim">Путешествие по карте мира со случайными встречами появится в следующей версии.</div>`));
    w.appendChild(redButton('ОСТАТЬСЯ', () => this.closeModal()));
    this.openModal(w);
  }

  // ---------- прицельный выстрел ----------

  chooseAim(tgt: Critter, chances: Record<AimPart, number>): Promise<AimPart | null> {
    return new Promise((resolve) => {
      let result: AimPart | null = null;
      const w = this.window(`ПРИЦЕЛЬНЫЙ ВЫСТРЕЛ: ${tgt.name.toUpperCase()}`, 'aim');
      const body = el('div', 'aim-body');
      const left = el('div', 'aim-col'), right = el('div', 'aim-col');
      const human = tgt.def.kind === 'human';
      const fig = el('div', 'aim-fig sunk', human
        ? '<svg viewBox="0 0 100 200"><circle cx="50" cy="28" r="18"/><rect x="28" y="50" width="44" height="70" rx="8"/><rect x="10" y="52" width="14" height="68" rx="6"/><rect x="76" y="52" width="14" height="68" rx="6"/><rect x="30" y="122" width="17" height="72" rx="6"/><rect x="53" y="122" width="17" height="72" rx="6"/></svg>'
        : '<svg viewBox="0 0 200 140"><ellipse cx="100" cy="90" rx="34" ry="22"/><circle cx="100" cy="58" r="14"/><path d="M100 112 C100 140 150 140 160 110 C170 80 150 60 140 70" fill="none" stroke="currentColor" stroke-width="10"/><path d="M70 70 L40 40 M130 70 L160 40" stroke="currentColor" stroke-width="8"/><g stroke="currentColor" stroke-width="4"><path d="M70 90 L30 100M70 98 L34 116M130 90 L170 100M130 98 L166 116"/></g></svg>');
      const order: AimPart[][] = [['head', 'larm', 'torso', 'lleg'], ['eyes', 'rarm', 'groin', 'rleg']];
      order.forEach((col, ci) => {
        for (const id of col) {
          const b = el('button', 'aim-btn', `<span>${partName(id, !human)}</span><b>${chances[id]}%</b>`);
          b.onclick = () => { sfx.click(); result = id; this.closeModal(); };
          (ci ? right : left).appendChild(b);
        }
      });
      body.append(left, fig, right);
      const actions = el('div', 'inv-actions');
      actions.append(redButton('ОТМЕНА', () => this.closeModal()));
      w.append(body, actions);
      this.openModal(w, () => resolve(result));
    });
  }

  // ---------- диалог ----------

  openDialog(npc: Critter, dlg: DialogDef, ctx: DialogCtx): Promise<void> {
    return new Promise((resolve) => {
      const w = el('div', 'dialog metal');
      const head = el('div', 'dlg-head');
      const portrait = npc.def.portrait;
      if (portrait?.video) head.innerHTML = `<video src="${portrait.video}" autoplay loop muted playsinline></video>`;
      else if (portrait?.image) head.innerHTML = `<img src="${portrait.image}" alt="">`;
      else head.innerHTML = `<div class="dlg-ph"><svg viewBox="0 0 200 200"><circle cx="100" cy="80" r="46"/><path d="M20 200c0-50 36-78 80-78s80 28 80 78z"/></svg><div>${esc(npc.name.toUpperCase())}<br><span>здесь будет «говорящая голова» — видео из Flow</span></div></div>`;
      head.appendChild(el('div', 'dlg-name', esc(npc.name)));
      const reply = el('div', 'dlg-reply crt');
      const opts = el('div', 'dlg-opts crt');
      const side = el('div', 'dlg-side');
      side.append(redButton('ОБМЕН', () => { sfx.denied(); this.flashReply(reply, '[Торговля появится в следующей версии.]'); }), redButton('ПРОЩАЙ', () => this.closeModal()));
      const lower = el('div', 'dlg-lower');
      lower.append(reply, opts, side);
      w.append(head, lower);
      const T = (t: string | ((c: DialogCtx) => string)) => (typeof t === 'function' ? t(ctx) : t);

      const keyHandler = (e: KeyboardEvent) => {
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= 9) (opts.children[n - 1] as HTMLElement | undefined)?.click();
      };
      window.addEventListener('keydown', keyHandler);

      const go = (id: string) => {
        if (id === 'end') { this.closeModal(); return; }
        const node = dlg.nodes[id];
        node.onEnter?.(ctx);
        reply.innerHTML = esc(T(node.text)).replace(/\n/g, '<br>');
        reply.scrollTop = 0;
        opts.innerHTML = '';
        const visible = node.options.filter((o) => !o.show || o.show(ctx));
        visible.forEach((o, i) => {
          const b = el('div', 'dlg-opt', `${i + 1}. ${esc(T(o.text))}`);
          b.onclick = () => {
            sfx.click();
            o.act?.(ctx);
            go(o.next ? T(o.next) : 'end');
          };
          opts.appendChild(b);
        });
        this.refresh();
      };
      this.openModal(w, () => { window.removeEventListener('keydown', keyHandler); resolve(); }, 'dialog');
      go(dlg.start(ctx));
    });
  }

  private flashReply(box: HTMLElement, text: string) {
    const prev = box.innerHTML;
    box.innerHTML = esc(text);
    setTimeout(() => { if (box.isConnected) box.innerHTML = prev; }, 1500);
  }

  // ---------- смерть ----------

  showDeath() {
    const w = el('div', 'death');
    w.innerHTML = `<div class="death-title">ВЫ ПОГИБЛИ</div>
      <div class="death-text">Пустошь забирает своих. Миклат № 7 так и не дождался мембраны.<br>Через ${this.game.waterDays} дней в нём закончится вода.</div>`;
    const btns = el('div', 'death-btns');
    btns.append(redButton('ЗАГРУЗИТЬ', () => this.quickLoad()), redButton('ГЛАВНОЕ МЕНЮ', () => location.reload()));
    w.appendChild(btns);
    this.openModal(w, undefined, 'death');
  }
}
