// The WW2 rules: historical weapons and vehicles. Realism is in the ratios, not the numbers
// (time is compressed): small arms bounce off tanks, anti-tank guns are slow but decisive, armour
// is thickest at the front, machine guns pin infantry down. See docs/ww2-design.md.
//
// A WW2 game is one side's arsenal (ww2_<side>.ts) against another side's army; ww2_kit.ts has
// the shared slots and the wave builder.

import type { EnemyDef, Ruleset, UnitDef } from './defs';
import { GERMANY, WEHRMACHT_ARMY } from './ww2_de';
import { RED_ARMY, SOVIET_DEFENCE } from './ww2_su';
import { ALLIED_DEFENCE, US_ARMY } from './ww2_us';
import { JAPANESE_DEFENCE, JP_ARMY } from './ww2_jp';
import { SLOTS, assault, type Arsenal, type Army, type Faction, type Slot, type UnitHelp } from './ww2_kit';
import { battleById } from './battles';
import { armsGun, type WeaponId } from './ww2_arms';

export type { Faction } from './ww2_kit';

export const FACTIONS: Record<Faction, { name: string; adj: string; foes: Faction[] }> = {
  de: { name: 'Germany', adj: 'German', foes: ['su', 'us'] },
  su: { name: 'Soviet Union', adj: 'Soviet', foes: ['de'] },
  us: { name: 'Western Allies', adj: 'Allied', foes: ['de', 'jp'] },
  jp: { name: 'Japan', adj: 'Japanese', foes: ['us'] },
};

/** Each side as the defender, and as the attacker (undefined until it is ready). */
export const ARSENALS: Partial<Record<Faction, Arsenal>> = { de: GERMANY, su: SOVIET_DEFENCE, us: ALLIED_DEFENCE, jp: JAPANESE_DEFENCE };
export const ARMIES: Partial<Record<Faction, Army>> = { su: RED_ARMY, de: WEHRMACHT_ARMY, us: US_ARMY, jp: JP_ARMY };

export function ww2Ruleset(side: Faction, foe: Faction, battle?: string): Ruleset {
  const a = ARSENALS[side];
  const b = battleById(battle);
  // a battle brings the attacker's units of the period and its doctrine there
  const base = ARMIES[foe];
  const army = base && b ? { ...base, roster: { ...base.roster, ...b.roster }, doctrine: b.doctrine ?? base.doctrine } : base;
  if (!a || !army) throw new Error(`no WW2 matchup ${side} vs ${foe}`);
  a.towers.forEach((t, i) => {
    if (t.slot !== SLOTS[i]) throw new Error(`${side} arsenal: ${t.kind} is in the ${SLOTS[i]} slot`);
  });
  return {
    id: 'ww2',
    side,
    foe,
    towers: a.towers,
    enemies: [...army.enemies, ...garrison(foe)],
    units: [...a.units, supplyTruck(side), scouts(side), repairCrew(side)],
    combos: a.combos,
    categories: [
      { id: 'basic', name: 'Infantry' },
      { id: 'precision', name: 'Anti-tank' },
      { id: 'fire', name: 'Artillery' },
      { id: 'support', name: 'Support' },
      { id: 'units', name: 'Units' },
      { id: 'maze', name: 'Obstacles' },
      { id: 'super', name: a.superName },
    ],
    ranks: a.ranks,
    look: a.look,
    wave: (n) => assault(n, army),
  };
}

/**
 * The attacker's base, built from its own arsenal: the headquarters (destroy it to win) and the
 * machine-gun nests and anti-tank guns guarding it. Appended to the army's units in this order.
 */
function garrison(foe: Faction): EnemyDef[] {
  const a = ARSENALS[foe]!;
  const gun = (slot: Slot) => a.towers.find((t) => t.slot === slot)!;
  const base = (lv: number) => `${a.look.base}${lv}`;
  const adj = FACTIONS[foe].adj;
  // their positions fire the very guns of their arsenal (the headquarters: its MGs, at a longer reach from the walls)
  const arms = (slot: Slot) => gun(slot).weapon as WeaponId;
  return [
    { name: `${adj} Headquarters`, hp: 3600, speed: 0, reward: 0, armor: 0, air: false, radius: 36, lives: 0, tex: `${gun('hq').turret!}_base`, bio: 0,
      arm: [100, 100, 100, 70], fixed: 'hq', spot: 220, gun: armsGun(arms('mg'), 'mg', { range: 150 }) },
    { name: gun('mg').name, hp: 260, speed: 0, reward: 12, armor: 0, air: false, radius: 9, lives: 0, tex: gun('mg').turret!, bio: 0.5,
      arm: [25, 25, 25, 12], fixed: 'mg', base: base(3), spot: 180, gun: armsGun(arms('mg'), 'mg') },
    { name: gun('atgun').name, hp: 320, speed: 0, reward: 18, armor: 0, air: false, radius: 11, lives: 0, tex: gun('atgun').turret!, bio: 0.5,
      arm: [40, 30, 30, 12], fixed: 'at', base: base(3), spot: 200, gun: armsGun(arms('atgun'), 'tank', { supp: 0.3, halt: 0.6, splash: 10 }) },
    { name: `${adj} Supply Dump`, hp: 900, speed: 0, reward: 40, armor: 0, air: false, radius: 13, lives: 0, tex: gun('depot').turret!, bio: 0.5,
      arm: [20, 20, 20, 8], fixed: 'depot', base: base(2), spot: 120 },
    { name: `${TRUCKS[foe][0]} supply truck`, hp: 160, speed: 50, reward: 10, armor: 0, air: false, radius: 9, lives: 0, tex: TRUCKS[foe][1], bio: 0.6,
      supply: true },
    { name: `${gun('howitzer').name} battery`, hp: 420, speed: 0, reward: 30, armor: 0, air: false, radius: 11, lives: 0, tex: gun('howitzer').turret!, bio: 0.5,
      arm: [25, 20, 20, 10], fixed: 'arty', base: base(3), spot: 120 },
  ];
}

/** Help for the positions of the enemy's base, in `garrison()` order. */
/** Each side's ammunition lorry: name and model. */
const TRUCKS: Record<Faction, [string, string]> = {
  de: ['Opel Blitz', 'de_truck'],
  su: ['ZIS-5', 'su_truck'],
  us: ['GMC CCKW', 'us_truck'],
  jp: ['Isuzu Type 94', 'jp_truck'],
};

/** Our supply truck: the headquarters sends it to refill the depots (see Sim.updateSupply). */
function supplyTruck(side: Faction): UnitDef {
  const [name, tex] = TRUCKS[side];
  return {
    kind: `${side}_truck`, name: `${name} supply truck`, short: 'Truck', tex, from: 'supply', truck: true,
    cost: 0, manpower: 0, train: 0, hp: 180, speed: 55, radius: 9,
    desc: 'Drives ammunition from the headquarters to a depot that is running low, then goes back. Unarmoured: the enemy shoots at it, and a depot whose truck is lost waits for the next one.',
  };
}

/** Each side's scouts: name and model (its sniper's). */
const SCOUTS: Record<Faction, [string, string]> = {
  de: ['Spähtrupp', 'de_sniper'],
  su: ['Razvedchiki', 'su_sniper'],
  us: ['Recon Scouts', 'us_sniper'],
  jp: ['Sekkō Scouts', 'jp_sniper'],
};

/** Scouts, trained at the barracks of every arsenal: the eyes of the army, at night above all. */
function scouts(side: Faction): UnitDef {
  const [name, tex] = SCOUTS[side];
  return {
    kind: `${side}_scout`, name, short: 'Scouts', tex, from: 'barracks', scout: true, camo: true, inf: true,
    cost: 25, manpower: 1, train: 5, hp: 60, speed: 62, radius: 5,
    desc: 'Unarmed scouts who see far, at night too, and slip past the enemy unseen unless one walks right into them. In Hunt they roam the battlefield by themselves, uncovering the ground and showing your guns, above all your artillery, where to fire; send them somewhere and set Guard or Hold to keep a watch there.',
  };
}

/** Each side's repair crew: name and its lorry's model. */
const CREWS: Record<Faction, [string, string]> = {
  de: ['Instandsetzungstrupp', 'de_truck'],
  su: ['Letuchka Repair Lorry', 'su_truck'],
  us: ['Ordnance Repair Team', 'us_truck'],
  jp: ['Kōsaku Repair Team', 'jp_truck'],
};

/**
 * The repair crew, sent out by the workshop: a lorry of mechanics and engineers that drives round the
 * whole camp by itself, rebuilding wrecked positions first and patching up damaged ones, and paying
 * for the work out of the army's money as it goes (see Sim.crewTask).
 */
function repairCrew(side: Faction): UnitDef {
  const [name, tex] = CREWS[side];
  return {
    kind: `${side}_crew`, name, short: 'Repair Crew', tex, from: 'workshop', crew: true,
    cost: 60, manpower: 1, train: 8, hp: 240, speed: 60, radius: 9, repair: 120,
    desc: 'Mechanics and engineers in a lorry. They drive round the whole camp by themselves, rebuild wrecked positions (the most valuable first) and patch up damaged ones, paying for the work from your money as they go — at the price of a repair — and waiting when the money runs out. They keep clear of the fighting until it moves on, and with nothing to repair they tow knocked-out tanks off your ground. Guard or Hold keeps them near one spot; Roam (Hunt) is the default.',
  };
}

export const GARRISON_HELP: UnitHelp[] = [
  { text: 'The enemy\'s headquarters, in concrete. Destroy it to win: the waves keep coming until one side\'s headquarters falls. Its garrison machine-guns anything close, and their engineers repair it whenever it is left alone for a few seconds: it takes a sustained attack.',
    counter: 'Heavy guns: tanks and anti-tank guns through the walls, heavy artillery, bombers and the super-weapon from above. Machine guns and rifles do nothing.' },
  { text: 'A machine-gun nest guarding the enemy\'s base. Destroyed positions are rebuilt after a while.',
    counter: 'Mortars and artillery, tanks, or infantry assaulting from cover.' },
  { text: 'An anti-tank gun guarding the enemy\'s base: it goes through the front of most tanks. Destroyed positions are rebuilt after a while.',
    counter: 'Artillery and mortars, or infantry: it can\'t do much against soldiers.' },
  { text: 'The enemy\'s supply dump behind its headquarters. Their trucks bring the ammunition for the next waves here: destroy it and the stocks burn, and the next waves come smaller and later until it is rebuilt.',
    counter: 'Heavy artillery and the super-weapon from out of range, or a raid by tanks.' },
  { text: 'A truck of the enemy\'s supply column, driving ammunition from the rear to their supply dump. Every one that gets through makes the next waves bigger.',
    counter: 'Anything that reaches their base: long-range guns, artillery spotted by an observer, fighters, a tank raid.' },
  { text: 'The enemy\'s artillery, dug in behind its headquarters and hidden until found. It listens for your guns: every salvo your mortars, rockets and howitzers fire gives it a better fix, and once it has one it answers with counter-battery fire on that gun. Its own muzzle flashes give it away for a moment.',
    counter: 'Find it (an observation post in sight of it, a recon flight, or catch it firing) and shell it with your howitzers. Camouflaged guns are harder to fix; a gun that moves starts again.' },
];

/** For the HUD: how a unit's armour compares to a weapon's penetration. */
export function penVerdict(pen: number, arm: readonly number[] | undefined): 'soft' | 'all' | 'side' | 'rear' | 'none' {
  if (!arm) return 'soft';
  if (pen >= arm[0]) return 'all';
  if (pen >= arm[1]) return 'side';
  if (pen >= arm[2]) return 'rear';
  return 'none';
}

