import * as THREE from 'three';
import { Hex, hexToWorld } from '../core/hex';
import { HumanLook, HumanRig, Rig, ScorpionRig } from './models';
import { SpriteRig, getSheet } from './sprites';
import { Sheet, SkillId, derived, effStats, newSheet, skillValue } from '../rules/stats';
import { ITEMS, Stack, WeaponDef, def } from '../rules/items';

export type Faction = 'player' | 'kibbutz' | 'monster' | 'raiders' | 'traders';
export type FireMode = 'single' | 'aimed' | 'reload';

export interface MonsterStats {
  hp: number; ap: number; ac: number; skill: number; seq: number; crit: number;
  pe: number; dt: number; dr: number; xp: number; weapon: string;
}

export interface CritterDef {
  id: string;
  name: string;
  /** Имя в винительном падеже: «попадаете в скорпиона». */
  acc?: string;
  kind: 'human' | 'scorpion' | 'bigScorpion';
  faction: Faction;
  desc: string;
  look?: HumanLook;
  /** Атлас спрайтов из Blender (src/data/sprites/<имя>.json); без него — процедурная модель. */
  sprite?: string;
  sheet?: Partial<Sheet>;
  monster?: MonsterStats;
  inventory?: Stack[];
  hand?: string;
  armor?: string;
  dialog?: string;
  /** Торгует (кнопка «ОБМЕН» в диалоге). */
  trader?: boolean;
  /** Опыт за победу (по умолчанию — из monster.xp или 50). */
  xp?: number;
  barks?: string[];
  /** «Говорящая голова» для диалога (public/portraits/...): кадр и два ролика — молчит и говорит. */
  portrait?: { image?: string; idle?: string; talk?: string };
}

export class Critter {
  readonly rig: Rig;
  readonly id: string;
  name: string;
  sheet: Sheet;
  hp = 1;
  ap = 0;
  /** Неистраченные ОД прошлого хода превращаются в класс брони (как в Fallout). */
  acBonus = 0;
  hex: Hex;
  inventory: Stack[] = [];
  hands: [Stack | null, Stack | null] = [null, null];
  activeHand: 0 | 1 = 0;
  fireMode: [FireMode, FireMode] = ['single', 'single'];
  armor: Stack | null = null;
  dead = false;
  aware = false;
  hostile: boolean;
  firstAidUses = 0;
  moving = false;

  constructor(readonly def: CritterDef, hex: Hex) {
    this.id = def.id;
    this.name = def.name;
    this.hex = { ...hex };
    this.hostile = def.faction === 'monster' || def.faction === 'raiders';
    this.sheet = { ...newSheet(), ...(def.sheet ?? {}) } as Sheet;
    if (def.sheet?.base) this.sheet.base = { ...def.sheet.base };
    if (def.kind === 'human') {
      const sheet = getSheet(def.sprite);
      this.rig = sheet
        ? new SpriteRig(sheet)
        : new HumanRig(def.look ?? { skin: 0xc49a74, cloth: 0x7a6a50, cloth2: 0x4a3a28, hair: 0x2a1a10 });
    } else {
      const sheet = getSheet(def.sprite);
      this.rig = sheet ? new SpriteRig(sheet)
        : def.kind === 'bigScorpion' ? new ScorpionRig(1.45, 0x7a4a26) : new ScorpionRig(1, 0x9a7040);
    }
    for (const s of def.inventory ?? []) this.inventory.push({ ...s });
    if (def.hand) this.hands[0] = { id: def.hand, qty: 1, loaded: ITEMS[def.hand].weapon?.mag };
    if (def.armor) this.armor = { id: def.armor, qty: 1 };
    this.hp = this.maxHp;
    this.ap = this.maxAp;
    this.placeAt(hex);
    this.syncWeaponModel();
    this.rig.root.userData.critter = this;
  }

  get isPlayer() { return this.def.faction === 'player'; }
  get m(): MonsterStats | undefined { return this.def.monster; }

  get maxHp() { return this.m ? this.m.hp : derived(this.sheet).maxHp; }
  get maxAp() { return this.m ? this.m.ap : derived(this.sheet).ap; }
  get sequence() { return this.m ? this.m.seq : derived(this.sheet).sequence; }
  get critChance() { return this.m ? this.m.crit : derived(this.sheet).crit; }
  get perception() { return this.m ? this.m.pe : effStats(this.sheet).pe; }
  get meleeBonus() { return this.m ? 0 : derived(this.sheet).meleeDmg; }

  get ac() {
    const base = this.m ? this.m.ac : derived(this.sheet).ac;
    return base + (this.armor ? def(this.armor).armor!.ac : 0) + this.acBonus;
  }
  get dt() { return (this.m?.dt ?? 0) + (this.armor ? def(this.armor).armor!.dt : 0); }
  get dr() { return (this.m?.dr ?? 0) + (this.armor ? def(this.armor).armor!.dr : 0); }

  skill(id: SkillId) {
    return this.m ? this.m.skill : skillValue(this.sheet, id);
  }

  /** Предмет в активной руке (или кулак/природное оружие). */
  get weaponStack(): Stack {
    const s = this.hands[this.activeHand];
    if (s && def(s).weapon) return s;
    return { id: this.m ? this.m.weapon : 'fist', qty: 1 };
  }
  get weapon(): WeaponDef { return def(this.weaponStack).weapon!; }

  attackCost(aimed = this.fireMode[this.activeHand] === 'aimed') {
    const w = this.weapon;
    let c = w.ap;
    if (!w.melee && this.sheet.traits.includes('fastShot')) c -= 1;
    if (aimed) c += 1;
    return Math.max(1, c);
  }

  canAim() {
    return !(this.sheet.traits.includes('fastShot') && !this.weapon.melee);
  }

  placeAt(h: Hex) {
    this.hex = { ...h };
    const [x, z] = hexToWorld(h);
    this.rig.root.position.set(x, 0, z);
  }

  worldPos(): THREE.Vector3 { return this.rig.root.position.clone(); }

  syncWeaponModel() {
    if (!(this.rig instanceof HumanRig) && !(this.rig instanceof SpriteRig)) return;
    const s = this.hands[this.activeHand];
    const id = s?.id;
    this.rig.setWeapon(id === 'pistol9' ? 'pistol' : id === 'knife' ? 'knife' : id === 'rifle' ? 'rifle' : null);
  }
}
