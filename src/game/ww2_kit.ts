// Shared pieces of the WW2 rules: the factions, the standard arsenal slots every side fills with
// its own equipment, the roles of an attacking army, and the wave builder that turns any army's
// roster into the 30 waves of an offensive. The factions themselves are in ww2_<faction>.ts.

import { RT, type Combo, type EnemyDef, type SpawnGroup, type TowerDef, type TowerLevel, type UnitDef } from './defs';

/** The sides of the war. */
export type Faction = 'de' | 'su' | 'us' | 'jp';

/**
 * Every arsenal fills the same slots, in this order (the palette order), so the bot, the tests and
 * the help can find "the anti-tank gun" whatever it is called.
 */
export const SLOTS = [
  'mg', 'lightaa', 'at', 'sniper', 'flamer',
  'atgun', 'heavyaa', 'tank', 'bunker',
  'mortar', 'howitzer', 'rockets',
  'depot', 'observer', 'hq', 'workshop',
  'barracks', 'motorpool', 'airfield',
  'teeth', 'wire', 'atmine', 'apmine', 'roadblock',
  'strike', 'super',
] as const;
export type Slot = (typeof SLOTS)[number];

/** How a side looks on the map: emplacement bases, the commander, the super-weapon's projectile. */
export interface Look {
  base: string; // model prefix of the 10 base levels
  hero: string; // commander model
  nuke: string; // atlas texture of the super-weapon in flight
}

/** A side as the defender. */
export interface Arsenal {
  towers: TowerDef[];
  units: UnitDef[];
  combos: Combo[];
  ranks: string[];
  /** Palette heading of the two air / super-weapon slots. */
  superName: string;
  look: Look;
  /** Long help texts by tower kind. */
  help: Record<string, string>;
}

/** What a unit is for in an offensive; the wave builder asks for roles, each army fills them. */
export type ARole =
  | 'rifle' | 'assault' | 'sniper' | 'medic' | 'sapper' | 'officer'
  | 'recon' | 'armcar' | 'light' | 'medium' | 'medium2' | 'heavy' | 'boss'
  | 'attack' | 'fighter' | 'rockets';

export interface UnitHelp {
  text: string;
  counter: string;
}

/** A side as the attacker. */
export interface Army {
  enemies: EnemyDef[];
  roster: Partial<Record<ARole, number>>;
  /** Doctrine: how many of each kind it sends compared with the standard offensive. */
  doctrine?: { inf?: number; armour?: number; air?: number };
  /** Help per enemy, indexed like `enemies`. */
  help: UnitHelp[];
}

const INF: ARole[] = ['rifle', 'assault', 'sniper', 'medic', 'sapper', 'officer'];
const AIR: ARole[] = ['attack', 'fighter'];

/**
 * Wave n of an offensive by any army: infantry, motorised, armoured and combined-arms waves in
 * turn, aircraft every fifth wave, a heavy breakthrough every tenth. Later in the war the late
 * medium tank replaces the early one (wave 16).
 */
export function assault(n: number, army: Army): SpawnGroup[] {
  const g: SpawnGroup[] = [];
  const R = army.roster;
  const d = army.doctrine ?? {};
  const add = (role: ARole, count: number, interval: number, delay = 0) => {
    const kind = R[role];
    if (kind === undefined) return;
    const f = INF.includes(role) ? d.inf ?? 1 : AIR.includes(role) ? d.air ?? 1 : role === 'rockets' ? 1 : d.armour ?? 1;
    g.push({ kind, count: Math.max(1, Math.round(count * f)), interval, delay });
  };
  const medium: ARole = n >= 16 && R.medium2 !== undefined ? 'medium2' : 'medium';

  if (n % 10 === 0) {
    add('boss', n / 10, 7);
    add(medium, 2 + n / 6, 1.8, 2);
    add('rifle', 10 + n, 0.3);
  } else if (n % 5 === 0) {
    // fighters first; the ground-attack planes come in strength later in the war
    add('fighter', 4 + n * 0.3, 0.8);
    add('attack', n * 0.4 - 1, 1.2, 3);
    add('rifle', 8 + n * 0.6, 0.45, 3);
  } else {
    switch (n % 4) {
      case 1: // the infantry wave: numbers
        add('rifle', 12 + n * 1.6, 0.45);
        if (n > 3) add('assault', n * 0.6, 0.6, 3);
        break;
      case 2: // motorised
        add('recon', 4 + n * 0.5, 0.7);
        add('armcar', 2 + n * 0.4, 1.1, 2);
        add('assault', 4 + n * 0.5, 0.5, 4);
        break;
      case 3: // armour
        if (n < 8) add('light', 2 + n * 0.4, 1.6);
        if (n >= 6) add(medium, n * 0.25, 2, 2);
        if (n >= 12) add('heavy', n * 0.1, 3, 6);
        add('assault', 4 + n * 0.4, 0.6, 1);
        break;
      default: // combined arms
        add('rifle', 8 + n, 0.4);
        add(n >= 8 ? medium : 'light', 1 + n * 0.3, 1.8, 2);
        if (n > 8) add('attack', n * 0.25, 1.4, 6);
        break;
    }
  }
  // an officer leads the infantry: if he falls, the wave loses heart (see Sim.updateMorale)
  if (R.officer !== undefined && g.some((x) => x.kind === R.rifle || x.kind === R.assault)) g.push({ kind: R.officer, count: 1, interval: 1, delay: 2 });
  // assault engineers go ahead of the armour: they blow walls, lift mines and cut wire
  if (n >= 6 && n % 10 !== 0 && n % 5 !== 0 && n % 4 !== 1) add('sapper', 2 + n * 0.12, 1.4, 3);
  // rocket artillery shells the positions ahead of the armour
  if (n >= 8 && n % 10 !== 0 && n % 5 !== 0 && (n % 4 === 3 || n % 4 === 0)) add('rockets', 1 + n * 0.05, 5, 6);
  if (n >= 7 && n % 3 === 1) add('sniper', 2 + n * 0.25, 1.2, 5);
  if (n >= 9 && n % 2 === 1) add('medic', 1 + n * 0.1, 3, 3);
  return g;
}

/**
 * Another side's version of a tower: the template's behaviour and level-1 stats with this side's
 * names, model and sound, and any stats changed. Grow the finished list with growAll().
 */
export function derive(base: TowerDef, over: Partial<Omit<TowerDef, 'levels'>> & { lv?: Partial<TowerLevel> }): TowerDef {
  const { lv, ...rest } = over;
  return RT({ ...base, ...rest, levels: [{ ...base.levels[0], ...lv }] });
}

/** The tower of a slot in an arsenal. */
export const slotOf = (towers: TowerDef[], slot: Slot): TowerDef => towers[SLOTS.indexOf(slot)];
