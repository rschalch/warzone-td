// The WW2 weapons, one entry per gun: whoever fires it — an emplacement of ours, a unit we trained or
// an attacker — fires it with the same range, rate, penetration, damage, accuracy and traverse. Our
// emplacements improve theirs by upgrades, the attackers' improve with the war (Sim.warLevel), both
// along the same curve (defs.ts growth).
//
// Rates follow history: `rpm` is the practical (sustained) rate of fire, rounds or volleys a minute,
// and the game runs it TIME times faster, like everything else in a compressed battle. Traverse is
// the gun's (turret's, mount's) historical traverse in degrees a second, run TRAVERSE times faster.
// Rocket launchers stand for a battery firing in turn: a salvo every half-minute or so instead of the
// real several minutes of reloading.

import type { EnemyGun, TowerLevel } from './defs';

/** Game rates of fire are historical practical rates times this. */
export const TIME = 2.2;
/** Game traverse rates are historical ones times this (turrets would otherwise never catch a target crossing at TD speed). */
export const TRAVERSE = 4;

/** How far a weapon reaches: point blank, the infantry's fight, or across the field. */
export type Band = 'short' | 'medium' | 'long';
export const BANDS: Record<Band, string> = { short: 'Short range', medium: 'Medium range', long: 'Long range' };
export function bandOf(range: number): Band {
  return range <= 100 ? 'short' : range <= 220 ? 'medium' : 'long';
}

export interface Weapon {
  name: string;
  /** Practical rate of fire: rounds (volleys, salvos) a minute. */
  rpm: number;
  dmg: number;
  pen: number; // mm at mid range (it falls off over the range: penFalloff)
  range: number; // px
  supp?: number;
  splash?: number;
  salvo?: number;
  /** Share of shots a green crew misses at the end of the range (a third of that point blank). */
  miss: number;
  /** The same against aircraft, for guns made for it (others miss MISS_AIR). */
  aa?: number;
  /** Historical traverse, degrees a second. */
  trav: number;
  /** Where the figures come from, for the help. */
  note: string;
}

/** Share of shots at aircraft missed by guns not made for it. */
export const MISS_AIR = 0.55;

const W = (w: Weapon) => w;

export const ARMS = {
  // ------------------------------------------------ machine guns (7.62 – 7.92 mm unless noted)
  mg42: W({ name: 'MG 42', rpm: 300, dmg: 2.9, pen: 8, range: 130, supp: 0.07, miss: 0.38, aa: 0.5, trav: 45, note: '1,200 rounds/min cyclic, fired in bursts with barrel changes: ~300 sustained' }),
  mg34: W({ name: 'MG 34', rpm: 225, dmg: 2.9, pen: 8, range: 125, supp: 0.06, miss: 0.35, trav: 40, note: '900 rounds/min cyclic, ~225 sustained' }),
  maxim: W({ name: 'Maxim M1910', rpm: 260, dmg: 2.9, pen: 8, range: 135, supp: 0.07, miss: 0.3, aa: 0.5, trav: 35, note: '600 rounds/min cyclic; water-cooled, 250-300 combat rate; the Sokolov mount steadies it' }),
  dt: W({ name: 'DT', rpm: 125, dmg: 2.9, pen: 8, range: 120, supp: 0.05, miss: 0.38, trav: 30, note: '600 rounds/min cyclic from a 63-round pan: ~125 practical' }),
  m1919: W({ name: 'M1919A4 Browning', rpm: 160, dmg: 2.9, pen: 8, range: 135, supp: 0.06, miss: 0.32, aa: 0.5, trav: 40, note: '400-600 rounds/min cyclic, air-cooled: fired in bursts, ~150 sustained' }),
  type92: W({ name: 'Type 92 HMG', rpm: 200, dmg: 3.2, pen: 9, range: 145, supp: 0.06, miss: 0.28, aa: 0.5, trav: 30, note: '450 rounds/min cyclic from 30-round strips ("woodpecker"); a telescopic sight' }),
  type99: W({ name: 'Type 99 LMG', rpm: 150, dmg: 3, pen: 8, range: 125, supp: 0.06, miss: 0.34, trav: 45, note: '800 rounds/min cyclic, 30-round magazine: ~150 practical' }),
  type97mg: W({ name: 'Type 97 tank MG', rpm: 125, dmg: 3, pen: 8, range: 120, supp: 0.05, miss: 0.38, trav: 30, note: '500 rounds/min cyclic, 20-round magazine' }),
  m45: W({ name: 'M45 Quadmount (4 × .50)', rpm: 400, dmg: 3.5, pen: 22, range: 160, supp: 0.06, miss: 0.42, aa: 0.32, trav: 60, note: 'four M2 .50s, 450-575 rounds/min each, in a powered turret: ~400 sustained' }),

  // ------------------------------------------------ small arms (a squad's fire is one volley)
  kar98k: W({ name: 'Kar98k rifles', rpm: 40, dmg: 4.8, pen: 7, range: 120, supp: 0.03, miss: 0.35, trav: 60, note: 'bolt action, ~10-15 aimed rounds/min a man' }),
  mosin: W({ name: 'Mosin-Nagant rifles', rpm: 40, dmg: 4.8, pen: 7, range: 120, supp: 0.03, miss: 0.36, trav: 60, note: 'bolt action, ~10-15 aimed rounds/min a man' }),
  arisaka: W({ name: 'Arisaka rifles', rpm: 40, dmg: 4.6, pen: 7, range: 120, supp: 0.03, miss: 0.34, trav: 60, note: 'bolt action, ~10-15 aimed rounds/min a man; the long Type 38 is accurate' }),
  garand: W({ name: 'M1 Garand rifles', rpm: 65, dmg: 4.6, pen: 8, range: 120, supp: 0.04, miss: 0.33, trav: 60, note: 'semi-automatic: ~25-40 rounds/min a man, twice a bolt-action squad' }),
  mp40: W({ name: 'MP 40 submachine guns', rpm: 140, dmg: 1.4, pen: 5, range: 65, supp: 0.04, miss: 0.45, trav: 80, note: '500 rounds/min cyclic, 32-round magazines: ~100-120 practical a man' }),
  ppsh: W({ name: 'PPSh-41 submachine guns', rpm: 160, dmg: 1.3, pen: 5, range: 65, supp: 0.04, miss: 0.47, trav: 80, note: '900-1,000 rounds/min cyclic from a 71-round drum' }),
  thompson: W({ name: 'Thompson submachine guns', rpm: 130, dmg: 1.6, pen: 5, range: 65, supp: 0.04, miss: 0.44, trav: 80, note: '600-700 rounds/min cyclic, the heavy .45 round' }),
  pistol: W({ name: 'pistol and submachine gun', rpm: 30, dmg: 2.4, pen: 5, range: 80, supp: 0.02, miss: 0.45, trav: 80, note: 'the officer\'s sidearm' }),
  bayonet: W({ name: 'bayonets and grenades', rpm: 30, dmg: 6, pen: 6, range: 26, supp: 0.02, miss: 0.3, trav: 90, note: 'the charge' }),
  satchel: W({ name: 'satchel charges', rpm: 7, dmg: 260, pen: 150, range: 22, supp: 0.6, miss: 0, trav: 90, note: 'a few kilograms of explosive placed by hand' }),
  sniper: W({ name: 'scoped rifle', rpm: 10, dmg: 64, pen: 10, range: 290, supp: 0.15, miss: 0.18, trav: 20, note: 'a marksman\'s aimed shot every 6 s or so' }),

  // ------------------------------------------------ infantry anti-tank
  schreck: W({ name: 'Panzerschreck', rpm: 5, dmg: 140, pen: 165, range: 75, miss: 0.45, trav: 40, note: '8.8 cm rocket: ~4-5 aimed rounds/min with a loader' }),
  bazooka: W({ name: 'M9 Bazooka', rpm: 5, dmg: 120, pen: 100, range: 80, miss: 0.48, trav: 40, note: '2.36 in rocket: ~4-5 aimed rounds/min with a loader' }),
  rodan: W({ name: 'Type 4 Ro-Dan', rpm: 4, dmg: 125, pen: 85, range: 75, miss: 0.48, trav: 40, note: '70 mm rocket, a copy of the bazooka' }),
  ptrd: W({ name: 'PTRD-41', rpm: 9, dmg: 48, pen: 40, range: 120, miss: 0.4, trav: 35, note: '14.5 mm single-shot rifle: 8-10 rounds/min' }),
  lunge: W({ name: 'lunge mine', rpm: 4, dmg: 140, pen: 150, range: 26, miss: 0.2, trav: 90, note: 'a shaped charge on a pole, pushed against the tank' }),
  flamer: W({ name: 'flamethrower', rpm: 0, dmg: 22, pen: 12, range: 60, miss: 0, trav: 40, note: 'bursts of a few seconds from a 10-12 litre tank' }),

  // ------------------------------------------------ anti-aircraft
  flak38: W({ name: '2 cm Flak 38', rpm: 200, dmg: 4.3, pen: 30, range: 165, supp: 0.04, miss: 0.4, aa: 0.34, trav: 30, note: '420-480 rounds/min cyclic from 20-round magazines: ~180-220 practical' }),
  k61: W({ name: '37 mm 61-K', rpm: 165, dmg: 5.6, pen: 40, range: 175, supp: 0.04, miss: 0.4, aa: 0.33, trav: 25, note: '170 rounds/min practical from 5-round clips' }),
  type96: W({ name: 'Twin 25 mm Type 96', rpm: 120, dmg: 6.3, pen: 30, range: 165, supp: 0.04, miss: 0.42, aa: 0.36, trav: 25, note: '2 × 220-260 rounds/min cyclic from 15-round magazines: ~110-120 practical' }),
  flak88: W({ name: '8.8 cm Flak 36', rpm: 10, dmg: 100, pen: 135, range: 290, splash: 30, miss: 0.34, aa: 0.3, trav: 12, note: '15-20 rounds/min at aircraft with a fuse setter; ~10 laid on tanks' }),
  k52: W({ name: '85 mm 52-K', rpm: 10, dmg: 95, pen: 120, range: 280, splash: 28, miss: 0.36, aa: 0.32, trav: 12, note: '15-20 rounds/min at aircraft; ~10 laid on tanks' }),
  m2_90: W({ name: '90 mm M2', rpm: 12, dmg: 100, pen: 140, range: 290, splash: 30, miss: 0.34, aa: 0.28, trav: 20, note: '22-25 rounds/min with the spring rammer; powered traverse, a radar-fed director' }),
  type88: W({ name: '75 mm Type 88', rpm: 10, dmg: 85, pen: 90, range: 270, splash: 26, miss: 0.38, aa: 0.36, trav: 10, note: '15 rounds/min at aircraft; ~10 laid on tanks' }),

  // ------------------------------------------------ anti-tank guns
  pak40: W({ name: '7.5 cm PaK 40', rpm: 14, dmg: 66, pen: 115, range: 235, miss: 0.36, trav: 8, note: '12-14 rounds/min; split trail, laid by hand across 65°' }),
  zis3: W({ name: '76 mm ZiS-3', rpm: 20, dmg: 52, pen: 95, range: 240, miss: 0.38, trav: 8, note: 'up to 25 rounds/min, the quickest gun of its class; laid by hand across 54°' }),
  m1_57: W({ name: '57 mm M1', rpm: 15, dmg: 58, pen: 95, range: 230, miss: 0.36, trav: 8, note: '12-15 rounds/min (the British 6-pounder); split trail, laid by hand' }),
  type1_47: W({ name: '47 mm Type 1', rpm: 15, dmg: 50, pen: 78, range: 220, miss: 0.38, trav: 10, note: '15 rounds/min; split trail, laid by hand' }),

  // ------------------------------------------------ tank guns (the same gun in a dug-in tank, a tank of ours or theirs)
  kwk36: W({ name: '8.8 cm KwK 36 (Tiger I)', rpm: 7, dmg: 140, pen: 140, range: 245, miss: 0.3, trav: 6, note: '6-8 rounds/min; the TZF 9b sight; a heavy turret: 360° in ~60 s' }),
  kwk40: W({ name: '7.5 cm KwK 40 (Panzer IV)', rpm: 12, dmg: 60, pen: 105, range: 205, miss: 0.36, trav: 14, note: '10-15 rounds/min; electric traverse, 360° in ~25 s' }),
  kwk42: W({ name: '7.5 cm KwK 42 (Panther)', rpm: 7, dmg: 105, pen: 150, range: 235, miss: 0.3, trav: 18, note: '6-8 rounds/min (the long round); hydraulic traverse, 360° in ~18-20 s' }),
  kwk43: W({ name: '8.8 cm KwK 43 (King Tiger)', rpm: 6, dmg: 170, pen: 190, range: 250, miss: 0.3, trav: 12, note: '5-8 rounds/min; hydraulic traverse, 360° in ~19-30 s' }),
  kwk39: W({ name: '5 cm KwK 39 (Panzer III)', rpm: 13, dmg: 40, pen: 60, range: 180, miss: 0.38, trav: 18, note: '10-15 rounds/min' }),
  zis53: W({ name: '85 mm ZiS-S-53 (T-34/85)', rpm: 8, dmg: 95, pen: 100, range: 215, miss: 0.38, trav: 24, note: '7-8 rounds/min; electric traverse, 360° in ~15 s' }),
  f34: W({ name: '76 mm F-34 (T-34/76)', rpm: 5, dmg: 60, pen: 70, range: 190, miss: 0.42, trav: 24, note: '4-8 rounds/min: a two-man turret, the commander lays the gun' }),
  zis5: W({ name: '76 mm ZiS-5 (KV-1)', rpm: 5, dmg: 62, pen: 75, range: 190, miss: 0.42, trav: 12, note: '4-5 rounds/min; a heavy turret' }),
  k20: W({ name: '45 mm 20-K (T-70)', rpm: 8, dmg: 30, pen: 50, range: 165, miss: 0.42, trav: 15, note: '7-12 rounds/min from a one-man turret, traversed by hand' }),
  d25t: W({ name: '122 mm D-25T (IS-2)', rpm: 2, dmg: 230, pen: 160, range: 235, splash: 24, miss: 0.45, trav: 12, note: '1.5-3 rounds/min: two-piece ammunition; the shell alone weighs 25 kg' }),
  m3_75: W({ name: '75 mm M3 (Sherman)', rpm: 12, dmg: 55, pen: 75, range: 195, splash: 14, miss: 0.36, trav: 24, note: 'up to 20 rounds/min, ~12 practical; hydraulic traverse, 360° in 15 s, a gyrostabiliser' }),
  m1_76: W({ name: '76 mm M1 (Sherman 76)', rpm: 10, dmg: 80, pen: 110, range: 215, splash: 12, miss: 0.36, trav: 24, note: '~10 rounds/min practical; hydraulic traverse, 360° in 15 s' }),
  m6_37: W({ name: '37 mm M6 (Stuart, Greyhound)', rpm: 15, dmg: 26, pen: 45, range: 165, miss: 0.38, trav: 20, note: 'up to 30 rounds/min, ~15 practical' }),
  m3_90: W({ name: '90 mm M3 (Pershing)', rpm: 8, dmg: 115, pen: 150, range: 230, splash: 16, miss: 0.32, trav: 18, note: '~8 rounds/min; hydraulic traverse, 360° in ~20 s' }),
  type94_37: W({ name: '37 mm Type 94 (Ha-Go)', rpm: 15, dmg: 22, pen: 35, range: 160, miss: 0.4, trav: 25, note: '~15 rounds/min from a one-man turret' }),
  type97_57: W({ name: '57 mm Type 97 (Chi-Ha)', rpm: 10, dmg: 32, pen: 40, range: 165, splash: 14, miss: 0.45, trav: 20, note: '~10 rounds/min; a low-velocity infantry gun' }),
  type1_47t: W({ name: '47 mm Type 1 tank gun', rpm: 12, dmg: 48, pen: 70, range: 200, splash: 10, miss: 0.4, trav: 20, note: '~10-15 rounds/min; turned by hand and shoulder' }),
  type3_75: W({ name: '75 mm Type 3 (Chi-Nu)', rpm: 10, dmg: 70, pen: 85, range: 200, splash: 14, miss: 0.38, trav: 15, note: '~10 rounds/min' }),
  oi_105: W({ name: '105 mm (O-I)', rpm: 4, dmg: 150, pen: 120, range: 220, splash: 28, miss: 0.45, trav: 8, note: 'a prototype\'s main gun, ~4 rounds/min' }),

  // ------------------------------------------------ mortars, howitzers, rockets
  grw34: W({ name: '8 cm GrW 34', rpm: 15, dmg: 24, pen: 12, range: 200, splash: 38, supp: 0.25, miss: 0.45, trav: 10, note: '15-25 rounds/min' }),
  pm41: W({ name: '82 mm PM-41', rpm: 16, dmg: 23, pen: 12, range: 200, splash: 38, supp: 0.25, miss: 0.46, trav: 10, note: '15-25 rounds/min' }),
  m1_81: W({ name: '81 mm M1', rpm: 18, dmg: 21, pen: 12, range: 200, splash: 38, supp: 0.25, miss: 0.44, trav: 10, note: '18 rounds/min sustained' }),
  type97_81: W({ name: '81 mm Type 97', rpm: 15, dmg: 24, pen: 12, range: 190, splash: 38, supp: 0.25, miss: 0.45, trav: 10, note: '15-20 rounds/min' }),
  lefh18: W({ name: '10.5 cm leFH 18', rpm: 5, dmg: 150, pen: 28, range: 480, splash: 58, supp: 0.5, miss: 0.5, trav: 4, note: '4-6 rounds/min; 56° of traverse, then the trail is shifted' }),
  m30: W({ name: '122 mm M-30', rpm: 5, dmg: 175, pen: 32, range: 470, splash: 62, supp: 0.5, miss: 0.5, trav: 4, note: '5-6 rounds/min; 49° of traverse' }),
  m2a1: W({ name: '105 mm M2A1', rpm: 6, dmg: 145, pen: 28, range: 480, splash: 58, supp: 0.5, miss: 0.48, trav: 4, note: '3 rounds/min sustained, 10 in a burst — and ammunition that never ran short' }),
  type91: W({ name: '105 mm Type 91', rpm: 6, dmg: 140, pen: 28, range: 470, splash: 56, supp: 0.5, miss: 0.5, trav: 4, note: '6-8 rounds/min' }),
  nebel41: W({ name: '15 cm Nebelwerfer 41', rpm: 1.5, dmg: 118, pen: 18, range: 300, splash: 38, supp: 0.4, salvo: 6, miss: 0, trav: 5, note: '6 rockets in 10 s, then ~90 s to reload: a battery fires in turn' }),
  bm13: W({ name: 'BM-13 Katyusha', rpm: 1.2, dmg: 56, pen: 30, range: 340, splash: 32, supp: 0.5, salvo: 16, miss: 0, trav: 5, note: '16 rockets in 7-10 s, then 3-5 min to reload: a battery fires in turn' }),
  t34calliope: W({ name: 'T34 Calliope', rpm: 1.3, dmg: 60, pen: 30, range: 320, splash: 32, supp: 0.5, salvo: 12, miss: 0, trav: 24, note: '60 tubes rippled off in seconds from a Sherman\'s turret' }),
  type4r: W({ name: '20 cm Type 4 rockets', rpm: 1.4, dmg: 140, pen: 35, range: 300, splash: 40, supp: 0.6, salvo: 6, miss: 0, trav: 5, note: 'rail-launched 20 cm rockets, slow to reload' }),

  // ------------------------------------------------ aircraft
  fighter: W({ name: 'fighter cannon and MGs', rpm: 140, dmg: 9, pen: 20, range: 115, miss: 0.5, aa: 0.45, trav: 90, note: 'a few seconds of fire on each pass' }),
  attack: W({ name: 'rockets and bombs', rpm: 10, dmg: 34, pen: 50, range: 70, splash: 24, supp: 0.3, miss: 0.5, trav: 90, note: 'a pass with rockets and small bombs' }),
  divebomb: W({ name: 'dive bomb', rpm: 8, dmg: 48, pen: 70, range: 60, splash: 26, supp: 0.35, miss: 0.5, trav: 90, note: 'one bomb per dive' }),
  kamikaze: W({ name: 'kamikaze', rpm: 30, dmg: 240, pen: 140, range: 36, splash: 30, supp: 0.6, miss: 0, trav: 90, note: 'the aircraft and its 250 kg bomb' }),
} as const;

export type WeaponId = keyof typeof ARMS;

/** A weapon's game rate of fire (shots a second). */
export function rateOf(w: Weapon): number {
  return Math.round(((w.rpm * TIME) / 60) * 1000) / 1000;
}

/** A weapon's game traverse (radians a second). */
export function travOf(w: Weapon): number {
  return Math.round(((w.trav * TRAVERSE * Math.PI) / 180) * 100) / 100;
}

/** The level-1 stats an emplacement gets from its weapon (add cost, hit points, fortification). */
export function armsLv(id: WeaponId): Omit<TowerLevel, 'cost'> {
  const w: Weapon = ARMS[id];
  const lv: Omit<TowerLevel, 'cost'> = { damage: w.dmg, range: w.range, rate: rateOf(w), pen: w.pen, miss: w.miss, traverse: travOf(w) };
  if (w.supp) lv.supp = w.supp;
  if (w.splash) lv.splash = w.splash;
  if (w.salvo) lv.salvo = w.salvo;
  if (w.aa) lv.aa = w.aa;
  return lv;
}

/** An attacker's weapon: the same gun, with how it sounds and how long a vehicle halts to fire it. */
export function armsGun(id: WeaponId, fx: EnemyGun['fx'], extra: Partial<EnemyGun> = {}): EnemyGun {
  const w: Weapon = ARMS[id];
  const g: EnemyGun = { w: id, dmg: w.dmg, range: w.range, rate: rateOf(w), pen: w.pen, supp: w.supp ?? 0, miss: w.miss, traverse: travOf(w), fx };
  if (w.splash) g.splash = w.splash;
  if (w.salvo) g.salvo = w.salvo;
  if (w.aa) g.aa = w.aa;
  return { ...g, ...extra };
}

/** A unit's weapon of ours. */
export function armsUnit(id: WeaponId, sfx: string, extra: { still?: boolean; hitsAir?: boolean; splash?: number } = {}) {
  const w: Weapon = ARMS[id];
  return {
    w: id as string, dmg: w.dmg, range: w.range, rate: rateOf(w), pen: w.pen, supp: w.supp, splash: w.splash, miss: w.miss, aa: w.aa, traverse: travOf(w), sfx, ...extra,
  };
}

/** The catalogue entry of a weapon id (for the help), if it is one. */
export function weaponOf(id: string | undefined): Weapon | undefined {
  return id && id in ARMS ? (ARMS as Record<string, Weapon>)[id] : undefined;
}
