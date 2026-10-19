// The WW2 ruleset: historical weapons and vehicles. Realism is in the ratios, not the numbers
// (time is compressed): small arms bounce off tanks, anti-tank guns are slow but decisive, armour
// is thickest at the front, machine guns pin infantry down. See docs/ww2-design.md.
//
// Penetration (`pen`, mm) and armour (`arm`, mm: front, side, rear, top) follow real figures
// loosely, keeping their order: an MG-42 can't scratch a T-34 from any side, a PaK 40 kills it
// from the flank and struggles against a KV-1's front.

import { RT, growAll, type EnemyDef, type Ruleset, type SpawnGroup, type TowerDef } from './defs';

/** The sides of the war. Phase 1 plays Germany against the Soviet Union. */
export type Faction = 'de' | 'su';

export const FACTIONS: Record<Faction, { name: string; adj: string }> = {
  de: { name: 'Germany', adj: 'German' },
  su: { name: 'Soviet Union', adj: 'Soviet' },
};

// ---------------------------------------------------------------- German emplacements

const GERMAN: TowerDef[] = growAll([
  // ---- infantry weapons
  RT({
    kind: 'mg42', role: 'gun', cat: 'basic', name: 'MG-42 Nest', short: 'MG-42', desc: '1,200 rounds a minute: shreds and pins infantry. Bounces off armour.',
    hitsGround: true, hitsAir: true, airMult: 0.6, color: 0xc9b26a, turret: 'w_mg42', sfx: 'mg42',
    levels: [{ cost: 15, damage: 3.2, range: 100, rate: 10, pen: 8, supp: 0.07, hp: 170, fort: 15 }],
  }),
  RT({
    kind: 'flak38', role: 'gun', cat: 'basic', name: '2 cm Flak 38', short: 'Flak 38', desc: 'Light autocannon: deadly to aircraft, light vehicles and infantry.',
    hitsGround: true, hitsAir: true, airMult: 2.2, color: 0x9aa070, turret: 'w_flak38', sfx: 'flak38',
    levels: [{ cost: 35, damage: 9, range: 165, rate: 3.5, pen: 30, supp: 0.04, hp: 150, fort: 10 }],
  }),
  RT({
    kind: 'schreck', role: 'at', cat: 'basic', name: 'Panzerschreck Team', short: 'Schreck', desc: 'Rocket launcher team. Very short range, goes through any tank.',
    hitsGround: true, hitsAir: false, airMult: 0, color: 0x8a7a50, turret: 'w_schreck', sfx: 'schreck',
    levels: [{ cost: 30, damage: 85, range: 70, rate: 0.3, pen: 170, hp: 100, fort: 12 }],
  }),
  RT({
    kind: 'sniper', role: 'sniper', cat: 'basic', name: 'Scharfschütze', short: 'Sniper', desc: 'Kills a soldier per shot from far away. Useless against armour.',
    hitsGround: true, hitsAir: false, airMult: 0, color: 0x6a7a4a, turret: 'w_sniper', sfx: 'sniper',
    levels: [{ cost: 45, damage: 60, range: 280, rate: 0.4, pen: 10, hp: 80, fort: 12 }],
  }),
  RT({
    kind: 'flamer', role: 'flame', cat: 'basic', name: 'Flammenwerfer', short: 'Flamer', desc: 'Burns infantry and soft vehicles at point-blank range. Tanks are sealed.',
    hitsGround: true, hitsAir: false, airMult: 0, color: 0xff7a1a, turret: 'w_flamer', sfx: 'flame',
    levels: [{ cost: 40, damage: 22, range: 60, rate: 0, burn: 9, pen: 12, hp: 110, fort: 12 }],
  }),

  // ---- anti-tank guns
  RT({
    kind: 'pak40', role: 'at', cat: 'precision', name: '7.5 cm PaK 40', short: 'PaK 40', desc: 'Anti-tank gun: slow, decisive shots. Kills T-34s from the side.',
    hitsGround: true, hitsAir: false, airMult: 0, color: 0x7a8a5a, turret: 'w_pak40', sfx: 'pak40',
    levels: [{ cost: 55, damage: 75, range: 170, rate: 0.45, pen: 115, hp: 210, fort: 22 }],
  }),
  RT({
    kind: 'flak88', role: 'at', cat: 'precision', name: '8.8 cm Flak 36', short: 'Flak 88', desc: 'The "Eighty-Eight": long range, kills tanks and bombers alike.',
    hitsGround: true, hitsAir: true, airMult: 1, color: 0xa8a890, turret: 'w_flak88', sfx: 'flak88',
    levels: [{ cost: 120, damage: 120, range: 240, rate: 0.3, pen: 135, splash: 30, hp: 270, fort: 15 }],
  }),
  RT({
    kind: 'tiger', role: 'at', cat: 'precision', name: 'Tiger I (dug in)', short: 'Tiger', desc: 'A hull-down Tiger: the 8.8 cm KwK 36 outranges every Soviet tank.',
    hitsGround: true, hitsAir: false, airMult: 0, color: 0x9a8c60, turret: 'w_tiger', sfx: 'tiger',
    levels: [{ cost: 200, damage: 130, range: 210, rate: 0.28, pen: 140, hp: 730, fort: 100 }],
  }),
  RT({
    kind: 'bunker', role: 'bunker', cat: 'precision', name: 'MG Bunker', short: 'Bunker', desc: 'Concrete pillbox with two MGs firing at two targets at once.',
    hitsGround: true, hitsAir: false, airMult: 0, color: 0x8a8a7a, turret: 'w_bunker', sfx: 'mg42',
    levels: [{ cost: 45, damage: 3.5, range: 75, rate: 8, pen: 8, supp: 0.05, hp: 590, fort: 80 }],
  }),

  // ---- artillery
  RT({
    kind: 'mortar', role: 'cannon', cat: 'fire', name: '8 cm Mortar', short: 'Mortar', desc: 'High-explosive bombs on infantry groups. Pins them down.',
    hitsGround: true, hitsAir: false, airMult: 0, color: 0xa08a5a, turret: 'w_mortar', sfx: 'mortar',
    levels: [{ cost: 40, damage: 26, range: 180, rate: 0.5, splash: 38, pen: 12, supp: 0.25, hp: 130, fort: 12 }],
  }),
  RT({
    kind: 'lefh18', role: 'arty', cat: 'fire', name: '10.5 cm leFH 18', short: 'Howitzer', desc: 'Huge range and blast, but it needs an observation post to spot for it.',
    hitsGround: true, hitsAir: false, airMult: 0, color: 0x7a6a4a, turret: 'w_lefh18', sfx: 'arty',
    levels: [{ cost: 110, damage: 150, range: 480, rate: 0.18, splash: 58, pen: 28, supp: 0.5, hp: 210, fort: 12 }],
  }),
  RT({
    kind: 'nebel', role: 'cannon', cat: 'fire', name: 'Nebelwerfer 41', short: 'Nebelwerfer', desc: 'Six screaming rockets per salvo, scattered over the target area.',
    hitsGround: true, hitsAir: false, airMult: 0, color: 0xb05a3a, turret: 'w_nebel', sfx: 'nebel',
    levels: [{ cost: 130, damage: 45, range: 300, rate: 0.1, splash: 36, pen: 18, supp: 0.4, salvo: 6, hp: 140, fort: 8 }],
  }),

  // ---- support
  RT({
    kind: 'depot', role: 'depot', cat: 'support', name: 'Supply Depot', short: 'Depot', desc: 'Pays out at every wave, plus interest on the money you keep.',
    hitsGround: false, hitsAir: false, airMult: 0, color: 0xd0b050, turret: 'w_depot', aim: 'static', targeted: false,
    levels: [{ cost: 80, damage: 0, range: 0, rate: 0, income: 12, interest: 0.02, cap: 40, hp: 310, fort: 10 }],
  }),
  RT({
    kind: 'observer', role: 'radar', cat: 'support', name: 'Observation Post', short: 'Observer', desc: 'Spots for artillery, reveals snipers and extends the range of guns nearby.',
    hitsGround: false, hitsAir: false, airMult: 0, color: 0x50c0a0, turret: 'w_observer', aim: 'spin', targeted: false,
    levels: [{ cost: 55, damage: 0, range: 170, rate: 0, buff: 0.1, hp: 110, fort: 12 }],
  }),
  RT({
    kind: 'hq', role: 'command', cat: 'support', name: 'Field HQ', short: 'HQ', desc: 'Officers and radios: emplacements in range fire faster.',
    hitsGround: false, hitsAir: false, airMult: 0, color: 0xc04a3a, turret: 'w_hq', aim: 'static', targeted: false,
    levels: [{ cost: 90, damage: 0, range: 100, rate: 0, buff: 0.15, hp: 340, fort: 30 }],
  }),
  RT({
    kind: 'workshop', role: 'workshop', cat: 'support', name: 'Repair Workshop', short: 'Workshop', desc: 'Pioneers patch up damaged emplacements in range, even under fire.',
    hitsGround: false, hitsAir: false, airMult: 0, color: 0x6a9ad0, turret: 'w_workshop', aim: 'static', targeted: false,
    levels: [{ cost: 70, damage: 0, range: 110, rate: 0, buff: 0.03, hp: 220, fort: 12 }],
  }),

  // ---- obstacles
  RT({
    kind: 'teeth', role: 'barricade', cat: 'maze', name: "Dragon's Teeth", short: 'Teeth', desc: 'Concrete obstacles: a cheap 1×1 wall for shaping the maze.',
    size: 1, hitsGround: false, hitsAir: false, airMult: 0, color: 0xb0aca0, turret: null, aim: 'static', targeted: false, single: true,
    levels: [{ cost: 4, damage: 0, range: 0, rate: 0 }],
  }),
  RT({
    kind: 'wire', role: 'wire', cat: 'maze', name: 'Barbed Wire', short: 'Wire', desc: 'Goes on the path. Infantry get tangled and crawl; vehicles drive through.',
    walkable: true, hitsGround: false, hitsAir: false, airMult: 0, color: 0x8a8070, turret: null, aim: 'static', targeted: false, decal: 'd_wire',
    levels: [{ cost: 10, damage: 0, range: 0, rate: 0, slow: 0.4 }],
  }),
  RT({
    kind: 'teller', role: 'mine', cat: 'maze', name: 'Teller Mines', short: 'AT Mine', desc: 'Anti-tank mines on the path: only vehicles set them off.',
    size: 1, walkable: true, hitsGround: true, hitsAir: false, airMult: 0, color: 0x8a7a40, turret: null, aim: 'static', targeted: false, decal: 'd_teller', trigger: 'vehicle',
    levels: [{ cost: 25, damage: 160, range: 12, rate: 0.15, splash: 18, pen: 60 }],
  }),
  RT({
    kind: 'smine', role: 'mine', cat: 'maze', name: 'S-Mines', short: 'S-Mine', desc: 'Bounding anti-personnel mines: they leap up and burst among infantry.',
    size: 1, walkable: true, hitsGround: true, hitsAir: false, airMult: 0, color: 0x6a6a50, turret: null, aim: 'static', targeted: false, decal: 'd_smine', trigger: 'infantry',
    levels: [{ cost: 12, damage: 45, range: 12, rate: 0.3, splash: 34, pen: 0, supp: 0.5 }],
  }),
  RT({
    kind: 'roadblock', role: 'gate', cat: 'maze', name: 'Roadblock', short: 'Roadblock', desc: 'A barrier you can open and close (G) to reroute an attack mid-fight.',
    hitsGround: false, hitsAir: false, airMult: 0, color: 0xd0a040, turret: null, aim: 'static', targeted: false, single: true,
    levels: [{ cost: 30, damage: 0, range: 0, rate: 0 }],
  }),

  // ---- Luftwaffe
  RT({
    kind: 'stuka', role: 'stuka', cat: 'super', name: 'Stuka Airfield', short: 'Stuka', desc: 'Call in (R) three Ju 87s: dive-bombing that breaks tank columns.',
    hitsGround: true, hitsAir: false, airMult: 0, color: 0xe0c040, turret: 'w_stuka', aim: 'static', targeted: false, manual: true, sfx: 'stuka',
    levels: [{ cost: 220, damage: 380, range: 0, rate: 0, splash: 48, charge: 40, pen: 70, hp: 420, fort: 10 }],
  }),
  RT({
    kind: 'v2', role: 'nuke', cat: 'super', name: 'V-2 Launch Site', short: 'V-2', desc: 'Vergeltungswaffe 2: a ballistic missile (R) on any point. It falls faster than sound — no warning.',
    hitsGround: true, hitsAir: false, airMult: 0, color: 0xe8e6dc, turret: 'w_v2', aim: 'static', targeted: false, manual: true, sfx: 'v2',
    levels: [{ cost: 420, damage: 1100, range: 0, rate: 0, splash: 120, charge: 110, pen: 120, hp: 360, fort: 30 }],
  }),
]);

// ---------------------------------------------------------------- Soviet attackers

export const SU_RIFLE = 0;
export const SU_SMG = 1;
export const SU_SNIPER = 2;
export const SU_MEDIC = 3;
export const SU_GAZ = 4;
export const SU_BA64 = 5;
export const SU_T70 = 6;
export const SU_T34 = 7;
export const SU_T3485 = 8;
export const SU_KV1 = 9;
export const SU_IS2 = 10;
export const SU_IL2 = 11;
export const SU_YAK = 12;
export const SU_KATYUSHA = 13;

const SOVIET: EnemyDef[] = [
  { name: 'Rifle Squad', hp: 30, speed: 44, reward: 2, armor: 0, air: false, radius: 6, lives: 1, tex: 'su_rifle', bio: 2, inf: true, gun: { dmg: 2.5, range: 110, rate: 0.7, pen: 7, supp: 0.03, fx: 'rifle' } },
  { name: 'SMG Assault', hp: 40, speed: 54, reward: 3, armor: 0, air: false, radius: 6, lives: 1, tex: 'su_smg', bio: 2, inf: true, gun: { dmg: 4, range: 70, rate: 1.1, pen: 6, supp: 0.05, fx: 'smg' } },
  { name: 'Sniper', hp: 26, speed: 46, reward: 4, armor: 0, air: false, radius: 6, lives: 1, tex: 'su_sniper', bio: 2, inf: true, stealth: true, gun: { dmg: 14, range: 230, rate: 0.25, pen: 10, supp: 0.15, fx: 'rifle' } },
  { name: 'Medic', hp: 40, speed: 44, reward: 5, armor: 0, air: false, radius: 6, lives: 1, tex: 'su_medic', bio: 2, inf: true, heal: 0.08 },
  { name: 'GAZ-67 Jeep', hp: 50, speed: 95, reward: 3, armor: 0, air: false, radius: 8, lives: 1, tex: 'su_gaz', bio: 1 },
  { name: 'BA-64 Armoured Car', hp: 70, speed: 80, reward: 4, armor: 0, air: false, radius: 9, lives: 1, tex: 'su_ba64', bio: 0.6, arm: [10, 7, 7, 6], gun: { dmg: 3, range: 110, rate: 2, pen: 8, supp: 0.04, fx: 'mg' } },
  { name: 'T-70 Light Tank', hp: 120, speed: 50, reward: 6, armor: 0, air: false, radius: 11, lives: 1, tex: 'su_t70', bio: 0.4, arm: [45, 25, 25, 10], gun: { dmg: 20, range: 160, rate: 0.3, pen: 50, supp: 0.2, halt: 0.5, fx: 'tank' } },
  { name: 'T-34/76', hp: 190, speed: 42, reward: 8, armor: 0, air: false, radius: 13, lives: 2, tex: 'su_t34', bio: 0.35, arm: [90, 50, 40, 20], gun: { dmg: 36, range: 180, rate: 0.22, pen: 70, supp: 0.3, halt: 0.6, splash: 16, fx: 'tank' } },
  { name: 'T-34/85', hp: 230, speed: 42, reward: 10, armor: 0, air: false, radius: 13, lives: 2, tex: 'su_t3485', bio: 0.35, arm: [90, 60, 45, 20], gun: { dmg: 48, range: 190, rate: 0.2, pen: 100, supp: 0.3, halt: 0.6, splash: 18, fx: 'tank' } },
  { name: 'KV-1 Heavy Tank', hp: 320, speed: 28, reward: 14, armor: 0, air: false, radius: 14, lives: 3, tex: 'su_kv1', bio: 0.3, arm: [110, 80, 70, 30], gun: { dmg: 40, range: 180, rate: 0.2, pen: 75, supp: 0.3, halt: 0.7, splash: 16, fx: 'tank' } },
  { name: 'IS-2 Heavy Tank', hp: 2000, speed: 24, reward: 80, armor: 0, air: false, radius: 16, lives: 4, tex: 'su_is2', bio: 0.25, arm: [160, 90, 60, 30], boss: true, gun: { dmg: 140, range: 220, rate: 0.1, pen: 160, supp: 0.6, halt: 0.9, splash: 30, fx: 'tank' } },
  { name: 'Il-2 Sturmovik', hp: 95, speed: 70, reward: 6, armor: 0, air: true, radius: 13, lives: 1, tex: 'su_il2', bio: 0, arm: [12, 12, 8, 8], gun: { dmg: 32, range: 70, rate: 0.35, pen: 40, supp: 0.3, splash: 24, fx: 'rocket' } },
  { name: 'Yak-9 Fighter', hp: 60, speed: 110, reward: 4, armor: 0, air: true, radius: 12, lives: 1, tex: 'su_yak', bio: 0 },
  { name: 'BM-13 Katyusha', hp: 90, speed: 58, reward: 9, armor: 0, air: false, radius: 11, lives: 1, tex: 'su_katyusha', bio: 1,
    gun: { dmg: 22, range: 340, rate: 1 / 14, pen: 30, supp: 0.5, halt: 1.2, splash: 30, salvo: 16, fx: 'katyusha' } },
];

function sovietWave(n: number): SpawnGroup[] {
  const g: SpawnGroup[] = [];
  const add = (kind: number, count: number, interval: number, delay = 0) =>
    g.push({ kind, count: Math.max(1, Math.round(count)), interval, delay });
  // the T-34/85 replaces the T-34/76 from 1944 on (wave 16)
  const t34 = n >= 16 ? SU_T3485 : SU_T34;

  if (n % 10 === 0) {
    add(SU_IS2, n / 10, 7);
    add(t34, 2 + n / 6, 1.8, 2);
    add(SU_RIFLE, 10 + n, 0.3);
  } else if (n % 5 === 0) {
    // fighters first; the armoured Il-2s come in strength later in the war
    add(SU_YAK, 4 + n * 0.3, 0.8);
    add(SU_IL2, n * 0.4 - 1, 1.2, 3);
    add(SU_RIFLE, 8 + n * 0.6, 0.45, 3);
  } else {
    switch (n % 4) {
      case 1: // the infantry wave: numbers
        add(SU_RIFLE, 12 + n * 1.6, 0.45);
        if (n > 3) add(SU_SMG, n * 0.6, 0.6, 3);
        break;
      case 2: // motorised
        add(SU_GAZ, 4 + n * 0.5, 0.7);
        add(SU_BA64, 2 + n * 0.4, 1.1, 2);
        add(SU_SMG, 4 + n * 0.5, 0.5, 4);
        break;
      case 3: // armour
        if (n < 8) add(SU_T70, 2 + n * 0.4, 1.6);
        if (n >= 6) add(t34, n * 0.25, 2, 2);
        if (n >= 12) add(SU_KV1, n * 0.1, 3, 6);
        add(SU_SMG, 4 + n * 0.4, 0.6, 1);
        break;
      default: // combined arms
        add(SU_RIFLE, 8 + n, 0.4);
        add(n >= 8 ? t34 : SU_T70, 1 + n * 0.3, 1.8, 2);
        if (n > 8) add(SU_IL2, n * 0.25, 1.4, 6);
        break;
    }
  }
  // rocket artillery shells the positions ahead of the armour
  if (n >= 8 && n % 10 !== 0 && n % 5 !== 0 && (n % 4 === 3 || n % 4 === 0)) add(SU_KATYUSHA, 1 + n * 0.05, 5, 6);
  if (n >= 7 && n % 3 === 1) add(SU_SNIPER, 2 + n * 0.25, 1.2, 5);
  if (n >= 9 && n % 2 === 1) add(SU_MEDIC, 1 + n * 0.1, 3, 3);
  return g;
}

export function ww2Ruleset(side: Faction, foe: Faction): Ruleset {
  void side;
  void foe;
  return {
    id: 'ww2',
    towers: GERMAN,
    enemies: SOVIET,
    combos: [
      { a: 'mg42', b: 'wire', name: 'Kill Zone', desc: '+30% fire rate', rate: 1.3 },
      { a: 'pak40', b: 'pak40', name: 'Pakfront', desc: '+20% fire rate', rate: 1.2 },
      { a: 'lefh18', b: 'observer', name: 'Fire Mission', desc: '+30% fire rate', rate: 1.3 },
      { a: 'sniper', b: 'observer', name: 'Spotter', desc: '+40% damage', dmg: 1.4 },
      { a: 'flak88', b: 'flak38', name: 'Flak Battery', desc: '+30% vs air', air: 1.3 },
      { a: 'bunker', b: 'teeth', name: 'Fortified', desc: '+25% damage', dmg: 1.25 },
    ],
    categories: [
      { id: 'basic', name: 'Infantry' },
      { id: 'precision', name: 'Anti-tank' },
      { id: 'fire', name: 'Artillery' },
      { id: 'support', name: 'Support' },
      { id: 'maze', name: 'Obstacles' },
      { id: 'super', name: 'Luftwaffe & V-weapons' },
    ],
    ranks: ['Schütze', 'Gefreiter', 'Obergefreiter', 'Unteroffizier', 'Feldwebel', 'Leutnant', 'Hauptmann', 'Major', 'Oberst', 'General'],
    wave: sovietWave,
  };
}

/** For the HUD: how a unit's armour compares to a weapon's penetration. */
export function penVerdict(pen: number, arm: readonly number[] | undefined): 'soft' | 'all' | 'side' | 'rear' | 'none' {
  if (!arm) return 'soft';
  if (pen >= arm[0]) return 'all';
  if (pen >= arm[1]) return 'side';
  if (pen >= arm[2]) return 'rear';
  return 'none';
}
