// Static game data: dimensions, enemies, towers, waves.

export const TILE = 20;

// Map dimensions differ per map. They are module-level live bindings so the hot loops keep
// reading plain numbers; set them with setMapSize() before building a map, sim or renderer.
export let COLS = 96;
export let ROWS = 64;
export let MAP_W = COLS * TILE;
export let MAP_H = ROWS * TILE;

export function setMapSize(cols: number, rows: number): void {
  COLS = cols;
  ROWS = rows;
  MAP_W = cols * TILE;
  MAP_H = rows * TILE;
}

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;

export const MAX_ENEMIES = 4096;
export const MAX_PROJECTILES = 8192;
export const MAX_FX = 6144;

export const START_MONEY = 250;
/** Paid at each new wave for holding the last one: base + per wave number. */
export const WAVE_BONUS = [25, 5] as const;
export const START_LIVES = 20;
export const TOTAL_WAVES = 30;
export const WAVE_GAP = 18; // seconds between the end of one wave's spawns and the next wave
export const SELL_RATIO = 0.7;

// ---------------------------------------------------------------- enemies

export interface EnemyDef {
  name: string;
  hp: number;
  speed: number; // px/s
  reward: number;
  armor: number; // flat damage reduction per hit
  air: boolean;
  radius: number;
  lives: number; // lives lost when it leaks
  tex: string;
  bio: number; // damage multiplier from gas (soft targets choke, armour seals)
  stealth?: boolean; // untargetable unless inside a radar's range
  shield?: number; // regenerating shield, as a fraction of max hp
  heal?: number; // medic: hp healed per pulse, as a fraction of the target's max hp
}

export const EN_INFANTRY = 0;
export const EN_BUGGY = 1;
export const EN_APC = 2;
export const EN_TANK = 3;
export const EN_HELI = 4;
export const EN_BOSS = 5;
export const EN_GHOST = 6;
export const EN_AEGIS = 7;
export const EN_MEDIC = 8;

export const ENEMIES: EnemyDef[] = [
  { name: 'Infantry', hp: 32, speed: 52, reward: 2, armor: 0, air: false, radius: 6, lives: 1, tex: 'infantry', bio: 2 },
  { name: 'Buggy', hp: 48, speed: 96, reward: 3, armor: 0, air: false, radius: 8, lives: 1, tex: 'buggy', bio: 1 },
  { name: 'APC', hp: 110, speed: 48, reward: 5, armor: 2, air: false, radius: 10, lives: 1, tex: 'apc', bio: 0.5 },
  { name: 'Tank', hp: 190, speed: 34, reward: 7, armor: 5, air: false, radius: 12, lives: 2, tex: 'tank', bio: 0.35 },
  { name: 'Helicopter', hp: 85, speed: 62, reward: 5, armor: 0, air: true, radius: 11, lives: 1, tex: 'heli', bio: 0 },
  { name: 'Mammoth', hp: 2000, speed: 22, reward: 80, armor: 7, air: false, radius: 18, lives: 4, tex: 'boss', bio: 0.25 },
  { name: 'Ghost', hp: 70, speed: 74, reward: 5, armor: 1, air: false, radius: 8, lives: 1, tex: 'ghost', bio: 1, stealth: true },
  { name: 'Aegis', hp: 150, speed: 40, reward: 8, armor: 3, air: false, radius: 11, lives: 2, tex: 'aegis', bio: 0.5, shield: 1 },
  { name: 'Medic', hp: 120, speed: 44, reward: 7, armor: 1, air: false, radius: 10, lives: 1, tex: 'medic', bio: 1.2, heal: 0.12 },
];

// ---------------------------------------------------------------- towers

export type TowerKind =
  | 'gun' | 'cannon' | 'missile' | 'laser' | 'tesla' | 'emp'
  | 'flame' | 'napalm' | 'acid' | 'gas'
  | 'sniper' | 'rail' | 'gatling' | 'flak' | 'arty'
  | 'cryo' | 'gravity' | 'repulsor' | 'hacker' | 'jammer'
  | 'depot' | 'radar' | 'command' | 'salvage'
  | 'barricade' | 'mine' | 'tar' | 'spikes' | 'gate' | 'bunker'
  | 'orbital' | 'nuke' | 'hive' | 'blackhole';

export interface TowerLevel {
  cost: number; // build cost (level 0) or upgrade cost
  damage: number; // per shot; per second for beams, flames, clouds, auras
  range: number; // px
  rate: number; // shots/s
  splash?: number; // px radius
  chain?: number; // tesla jumps
  slow?: number; // speed multiplier
  slowTime?: number;
  burn?: number; // burn dps applied to whatever it hits
  shred?: number; // armour removed (acid)
  chill?: number; // cryo: chill added per hit; 1 = frozen
  pull?: number; // px/s towards the centre (gravity, black hole)
  knock?: number; // px pushed back (repulsor)
  duration?: number; // s: hack length, cloud/fire/singularity life
  buff?: number; // aura strength (radar range, command rate, salvage bounty, jammer exposure)
  income?: number; // depot: paid at each wave start
  interest?: number; // depot: fraction of banked money paid at each wave start…
  cap?: number; // …up to this much
  charge?: number; // s to charge a superweapon
  drones?: number;
}

export type TowerCat = 'basic' | 'fire' | 'precision' | 'control' | 'support' | 'maze' | 'super';

export const CATEGORIES: { id: TowerCat; name: string }[] = [
  { id: 'basic', name: 'Basic' },
  { id: 'fire', name: 'Fire & Chem' },
  { id: 'precision', name: 'Precision' },
  { id: 'control', name: 'Control' },
  { id: 'support', name: 'Support' },
  { id: 'maze', name: 'Maze' },
  { id: 'super', name: 'Super' },
];

export interface TowerDef {
  kind: TowerKind;
  cat: TowerCat;
  name: string;
  short: string;
  desc: string;
  size: 1 | 2; // footprint in cells
  walkable?: boolean; // built on the path: never blocks it
  hitsGround: boolean;
  hitsAir: boolean;
  airMult: number;
  color: number;
  turret: string | null; // model on top of the base; null for plain blocks and floor traps
  aim: 'track' | 'spin' | 'static'; // how the turret faces
  targeted: boolean; // picks targets (shows targeting modes)
  manual?: boolean; // superweapon: the player fires it
  levels: TowerLevel[];
}

const T = (d: Omit<TowerDef, 'size' | 'aim' | 'targeted'> & Partial<Pick<TowerDef, 'size' | 'aim' | 'targeted'>>): TowerDef =>
  ({ size: 2, aim: 'track', targeted: true, ...d });

export const TOWERS: TowerDef[] = [
  // ---- basic
  T({
    kind: 'gun', cat: 'basic', name: 'Machine Gun', short: 'Gun', desc: 'Cheap and fast — the backbone of any maze.',
    hitsGround: true, hitsAir: true, airMult: 1, color: 0xd8c25a, turret: 't_gun',
    levels: [
      { cost: 10, damage: 4.5, range: 80, rate: 5 },
      { cost: 20, damage: 8, range: 90, rate: 6 },
      { cost: 45, damage: 14, range: 105, rate: 7 },
    ],
  }),
  T({
    kind: 'cannon', cat: 'basic', name: 'Cannon', short: 'Cannon', desc: 'Heavy splash shells. Ground only.',
    hitsGround: true, hitsAir: false, airMult: 0, color: 0xc77b3b, turret: 't_cannon',
    levels: [
      { cost: 40, damage: 42, range: 125, rate: 0.85, splash: 42 },
      { cost: 60, damage: 78, range: 135, rate: 0.9, splash: 50 },
      { cost: 110, damage: 140, range: 150, rate: 1.0, splash: 60 },
    ],
  }),
  T({
    kind: 'missile', cat: 'basic', name: 'Missile', short: 'Missile', desc: 'Long-range homing. Bonus vs air.',
    hitsGround: true, hitsAir: true, airMult: 1.8, color: 0xd9d9d9, turret: 't_missile',
    levels: [
      { cost: 50, damage: 40, range: 175, rate: 1.0, splash: 26 },
      { cost: 65, damage: 72, range: 190, rate: 1.25, splash: 30 },
      { cost: 120, damage: 125, range: 215, rate: 1.5, splash: 36 },
    ],
  }),
  T({
    kind: 'laser', cat: 'basic', name: 'Laser', short: 'Laser', desc: 'Continuous beam, ignores armor.',
    hitsGround: true, hitsAir: true, airMult: 1, color: 0xff4a5a, turret: 't_laser',
    levels: [
      { cost: 65, damage: 46, range: 135, rate: 0 },
      { cost: 80, damage: 86, range: 145, rate: 0 },
      { cost: 140, damage: 160, range: 165, rate: 0 },
    ],
  }),
  T({
    kind: 'tesla', cat: 'basic', name: 'Tesla Coil', short: 'Tesla', desc: 'Lightning chains between enemies.',
    hitsGround: true, hitsAir: true, airMult: 1, color: 0x6fc8ff, turret: 't_tesla', aim: 'spin',
    levels: [
      { cost: 75, damage: 30, range: 115, rate: 1.2, chain: 3 },
      { cost: 90, damage: 52, range: 125, rate: 1.35, chain: 4 },
      { cost: 150, damage: 90, range: 140, rate: 1.5, chain: 6 },
    ],
  }),
  T({
    kind: 'emp', cat: 'basic', name: 'EMP Pulse', short: 'EMP', desc: 'Slows everything in range.',
    hitsGround: true, hitsAir: true, airMult: 1, color: 0x8cf0a8, turret: 't_emp', aim: 'spin', targeted: false,
    levels: [
      { cost: 30, damage: 3, range: 85, rate: 1.0, slow: 0.55, slowTime: 1.4 },
      { cost: 40, damage: 6, range: 100, rate: 1.1, slow: 0.45, slowTime: 1.6 },
      { cost: 80, damage: 12, range: 118, rate: 1.2, slow: 0.32, slowTime: 1.8 },
    ],
  }),

  // ---- fire & chemical
  T({
    kind: 'flame', cat: 'fire', name: 'Flamethrower', short: 'Flamer', desc: 'Short cone of fire. Burning units ignite the ones behind them. Ground only.',
    hitsGround: true, hitsAir: false, airMult: 0, color: 0xff7a1a, turret: 't_flame',
    levels: [
      { cost: 45, damage: 26, range: 70, rate: 0, burn: 8 },
      { cost: 60, damage: 56, range: 76, rate: 0, burn: 14 },
      { cost: 110, damage: 100, range: 86, rate: 0, burn: 24 },
    ],
  }),
  T({
    kind: 'napalm', cat: 'fire', name: 'Napalm Mortar', short: 'Napalm', desc: 'Lobs napalm that leaves burning ground behind. Ground only.',
    hitsGround: true, hitsAir: false, airMult: 0, color: 0xe0482a, turret: 't_napalm',
    levels: [
      { cost: 60, damage: 18, range: 160, rate: 0.35, splash: 34, duration: 4 },
      { cost: 75, damage: 32, range: 175, rate: 0.4, splash: 40, duration: 4.5 },
      { cost: 130, damage: 55, range: 195, rate: 0.45, splash: 48, duration: 5 },
    ],
  }),
  T({
    kind: 'acid', cat: 'fire', name: 'Acid Sprayer', short: 'Acid', desc: 'Corrodes armour so every other tower hits harder.',
    hitsGround: true, hitsAir: true, airMult: 1, color: 0xa6e22e, turret: 't_acid',
    levels: [
      { cost: 40, damage: 12, range: 110, rate: 1.2, splash: 26, shred: 4, duration: 5 },
      { cost: 55, damage: 20, range: 120, rate: 1.4, splash: 30, shred: 7, duration: 5 },
      { cost: 100, damage: 34, range: 135, rate: 1.6, splash: 34, shred: 11, duration: 6 },
    ],
  }),
  T({
    kind: 'gas', cat: 'fire', name: 'Gas Launcher', short: 'Gas', desc: 'Drifting toxic clouds. Deadly to infantry, weak against armour.',
    hitsGround: true, hitsAir: false, airMult: 0, color: 0x9bd15a, turret: 't_gas',
    levels: [
      { cost: 50, damage: 14, range: 130, rate: 0.3, splash: 40, duration: 5 },
      { cost: 65, damage: 26, range: 140, rate: 0.35, splash: 48, duration: 5.5 },
      { cost: 115, damage: 45, range: 155, rate: 0.4, splash: 56, duration: 6 },
    ],
  }),

  // ---- precision
  T({
    kind: 'sniper', cat: 'precision', name: 'Sniper', short: 'Sniper', desc: 'Huge range and damage, slow to fire. Ignores armour.',
    hitsGround: true, hitsAir: true, airMult: 1, color: 0x6a8a5a, turret: 't_sniper',
    levels: [
      { cost: 70, damage: 90, range: 300, rate: 0.45 },
      { cost: 90, damage: 170, range: 340, rate: 0.5 },
      { cost: 160, damage: 320, range: 400, rate: 0.6 },
    ],
  }),
  T({
    kind: 'rail', cat: 'precision', name: 'Railgun', short: 'Railgun', desc: 'The slug pierces every unit in a straight line. Feed it long corridors.',
    hitsGround: true, hitsAir: true, airMult: 1, color: 0x58b4ff, turret: 't_rail',
    levels: [
      { cost: 110, damage: 120, range: 240, rate: 0.33 },
      { cost: 130, damage: 260, range: 260, rate: 0.38 },
      { cost: 220, damage: 480, range: 290, rate: 0.45 },
    ],
  }),
  T({
    kind: 'gatling', cat: 'precision', name: 'Gatling', short: 'Gatling', desc: 'Spins up the longer it fires, then overheats.',
    hitsGround: true, hitsAir: true, airMult: 1, color: 0xb0a080, turret: 't_gatling',
    levels: [
      { cost: 55, damage: 6, range: 95, rate: 3 },
      { cost: 70, damage: 10, range: 105, rate: 3.5 },
      { cost: 125, damage: 17, range: 115, rate: 4 },
    ],
  }),
  T({
    kind: 'flak', cat: 'precision', name: 'Flak Cannon', short: 'Flak', desc: 'Air only. Bursting shells shred groups of helicopters.',
    hitsGround: false, hitsAir: true, airMult: 1, color: 0x8a96a8, turret: 't_flak',
    levels: [
      { cost: 45, damage: 26, range: 170, rate: 1.1, splash: 36 },
      { cost: 60, damage: 46, range: 185, rate: 1.25, splash: 42 },
      { cost: 105, damage: 80, range: 205, rate: 1.4, splash: 50 },
    ],
  }),
  T({
    kind: 'arty', cat: 'precision', name: 'Artillery', short: 'Artillery', desc: 'Enormous range, but it only sees 140px — use radars to spot for it.',
    hitsGround: true, hitsAir: false, airMult: 0, color: 0x7a6a4a, turret: 't_arty',
    levels: [
      { cost: 120, damage: 180, range: 520, rate: 0.22, splash: 60 },
      { cost: 150, damage: 320, range: 580, rate: 0.25, splash: 70 },
      { cost: 260, damage: 560, range: 650, rate: 0.28, splash: 80 },
    ],
  }),

  // ---- control
  T({
    kind: 'cryo', cat: 'control', name: 'Cryo', short: 'Cryo', desc: 'Chills and then freezes units solid. Frozen units shatter under splash.',
    hitsGround: true, hitsAir: true, airMult: 1, color: 0x9fe8ff, turret: 't_cryo',
    levels: [
      { cost: 50, damage: 4, range: 105, rate: 1.5, splash: 22, chill: 0.25 },
      { cost: 65, damage: 7, range: 115, rate: 1.7, splash: 26, chill: 0.33 },
      { cost: 115, damage: 12, range: 130, rate: 2, splash: 30, chill: 0.45 },
    ],
  }),
  T({
    kind: 'gravity', cat: 'control', name: 'Gravity Well', short: 'Gravity', desc: 'Pulls ground units towards it, bunching them up for splash.',
    hitsGround: true, hitsAir: false, airMult: 0, color: 0xa070ff, turret: 't_gravity', aim: 'spin', targeted: false,
    levels: [
      { cost: 70, damage: 4, range: 75, rate: 0, pull: 22, slow: 0.8 },
      { cost: 85, damage: 8, range: 85, rate: 0, pull: 32, slow: 0.75 },
      { cost: 150, damage: 14, range: 95, rate: 0, pull: 44, slow: 0.7 },
    ],
  }),
  T({
    kind: 'repulsor', cat: 'control', name: 'Repulsor', short: 'Repulsor', desc: 'Knocks ground units back so they walk that stretch again.',
    hitsGround: true, hitsAir: false, airMult: 0, color: 0x5ac8e8, turret: 't_repulsor', aim: 'spin', targeted: false,
    levels: [
      { cost: 60, damage: 6, range: 70, rate: 0.4, knock: 34 },
      { cost: 75, damage: 12, range: 78, rate: 0.45, knock: 48 },
      { cost: 130, damage: 22, range: 88, rate: 0.5, knock: 64 },
    ],
  }),
  T({
    kind: 'hacker', cat: 'control', name: 'Hacker', short: 'Hacker', desc: 'Takes over a vehicle, which stops and fires on its own wave.',
    hitsGround: true, hitsAir: false, airMult: 0, color: 0x3aff8a, turret: 't_hacker',
    levels: [
      { cost: 90, damage: 30, range: 120, rate: 0.15, duration: 3 },
      { cost: 110, damage: 55, range: 135, rate: 0.18, duration: 4 },
      { cost: 190, damage: 90, range: 150, rate: 0.22, duration: 5.5 },
    ],
  }),
  T({
    kind: 'jammer', cat: 'control', name: 'Shield Jammer', short: 'Jammer', desc: 'Kills shields and medic healing in range; jammed units take extra damage.',
    hitsGround: true, hitsAir: true, airMult: 1, color: 0xff5ad0, turret: 't_jammer', aim: 'spin', targeted: false,
    levels: [
      { cost: 55, damage: 0, range: 90, rate: 0, buff: 0.15 },
      { cost: 70, damage: 0, range: 105, rate: 0, buff: 0.22 },
      { cost: 120, damage: 0, range: 125, rate: 0, buff: 0.3 },
    ],
  }),

  // ---- support
  T({
    kind: 'depot', cat: 'support', name: 'Supply Depot', short: 'Depot', desc: 'Pays out at every wave, plus interest on the money you keep.',
    hitsGround: false, hitsAir: false, airMult: 0, color: 0xf0c040, turret: 't_depot', aim: 'static', targeted: false,
    levels: [
      { cost: 80, damage: 0, range: 0, rate: 0, income: 12, interest: 0.02, cap: 40 },
      { cost: 100, damage: 0, range: 0, rate: 0, income: 22, interest: 0.03, cap: 70 },
      { cost: 170, damage: 0, range: 0, rate: 0, income: 35, interest: 0.04, cap: 110 },
    ],
  }),
  T({
    kind: 'radar', cat: 'support', name: 'Radar', short: 'Radar', desc: 'Reveals stealth units, spots for artillery and extends the range of nearby towers.',
    hitsGround: false, hitsAir: false, airMult: 0, color: 0x40e0c0, turret: 't_radar', aim: 'spin', targeted: false,
    levels: [
      { cost: 60, damage: 0, range: 150, rate: 0, buff: 0.1 },
      { cost: 75, damage: 0, range: 180, rate: 0, buff: 0.15 },
      { cost: 130, damage: 0, range: 220, rate: 0, buff: 0.22 },
    ],
  }),
  T({
    kind: 'command', cat: 'support', name: 'Command Post', short: 'Command', desc: 'Towers in range fire faster.',
    hitsGround: false, hitsAir: false, airMult: 0, color: 0xe85a4a, turret: 't_command', aim: 'static', targeted: false,
    levels: [
      { cost: 90, damage: 0, range: 90, rate: 0, buff: 0.15 },
      { cost: 110, damage: 0, range: 105, rate: 0, buff: 0.22 },
      { cost: 190, damage: 0, range: 120, rate: 0, buff: 0.3 },
    ],
  }),
  T({
    kind: 'salvage', cat: 'support', name: 'Salvage Yard', short: 'Salvage', desc: 'Units destroyed in range pay a bigger bounty.',
    hitsGround: false, hitsAir: false, airMult: 0, color: 0xc0a070, turret: 't_salvage', aim: 'spin', targeted: false,
    levels: [
      { cost: 70, damage: 0, range: 120, rate: 0, buff: 0.25 },
      { cost: 85, damage: 0, range: 140, rate: 0, buff: 0.4 },
      { cost: 150, damage: 0, range: 160, rate: 0, buff: 0.6 },
    ],
  }),

  // ---- maze
  T({
    kind: 'barricade', cat: 'maze', name: 'Barricade', short: 'Barricade', desc: 'A cheap 1×1 wall for fine-grained mazes. Does not shoot.',
    size: 1, hitsGround: false, hitsAir: false, airMult: 0, color: 0x9a9a8a, turret: null, aim: 'static', targeted: false,
    levels: [{ cost: 3, damage: 0, range: 0, rate: 0 }],
  }),
  T({
    kind: 'mine', cat: 'maze', name: 'Minefield', short: 'Mine', desc: 'Goes on the path itself. Blows up under ground units, then re-arms.',
    size: 1, walkable: true, hitsGround: true, hitsAir: false, airMult: 0, color: 0xd04030, turret: null, aim: 'static', targeted: false,
    levels: [
      { cost: 15, damage: 60, range: 12, rate: 0.25, splash: 30 },
      { cost: 20, damage: 110, range: 12, rate: 0.33, splash: 34 },
      { cost: 35, damage: 200, range: 12, rate: 0.5, splash: 40 },
    ],
  }),
  T({
    kind: 'tar', cat: 'maze', name: 'Tar Pit', short: 'Tar', desc: 'Goes on the path. Everything that wades through it slows down.',
    walkable: true, hitsGround: true, hitsAir: false, airMult: 0, color: 0x3a3028, turret: null, aim: 'static', targeted: false,
    levels: [
      { cost: 20, damage: 0, range: 0, rate: 0, slow: 0.55 },
      { cost: 25, damage: 0, range: 0, rate: 0, slow: 0.45 },
      { cost: 45, damage: 0, range: 0, rate: 0, slow: 0.35 },
    ],
  }),
  T({
    kind: 'spikes', cat: 'maze', name: 'Spike Strip', short: 'Spikes', desc: 'Goes on the path. Shreds anything that drives over it.',
    walkable: true, hitsGround: true, hitsAir: false, airMult: 0, color: 0x8a8a90, turret: null, aim: 'static', targeted: false,
    levels: [
      { cost: 25, damage: 35, range: 0, rate: 0 },
      { cost: 30, damage: 65, range: 0, rate: 0 },
      { cost: 55, damage: 110, range: 0, rate: 0 },
    ],
  }),
  T({
    kind: 'gate', cat: 'maze', name: 'Gate', short: 'Gate', desc: 'A wall you can open and close (G) to reroute a wave mid-fight.',
    hitsGround: false, hitsAir: false, airMult: 0, color: 0xe0b040, turret: null, aim: 'static', targeted: false,
    levels: [{ cost: 35, damage: 0, range: 0, rate: 0 }],
  }),
  T({
    kind: 'bunker', cat: 'maze', name: 'Bunker', short: 'Bunker', desc: 'Short range, but fires at two units at once as they pass.',
    hitsGround: true, hitsAir: false, airMult: 0, color: 0x6a7050, turret: 't_bunker',
    levels: [
      { cost: 40, damage: 11, range: 62, rate: 4 },
      { cost: 55, damage: 18, range: 68, rate: 5 },
      { cost: 100, damage: 30, range: 75, rate: 6 },
    ],
  }),

  // ---- superweapons
  T({
    kind: 'orbital', cat: 'super', name: 'Orbital Laser', short: 'Orbital', desc: 'Charges up; then you aim (R) a beam from orbit that hunts down units.',
    hitsGround: true, hitsAir: true, airMult: 1, color: 0xff3a6a, turret: 't_orbital', aim: 'spin', targeted: false, manual: true,
    levels: [
      { cost: 250, damage: 300, range: 0, rate: 0, splash: 30, charge: 35, duration: 4 },
      { cost: 220, damage: 500, range: 0, rate: 0, splash: 34, charge: 30, duration: 4.5 },
      { cost: 380, damage: 800, range: 0, rate: 0, splash: 40, charge: 25, duration: 5 },
    ],
  }),
  T({
    kind: 'nuke', cat: 'super', name: 'Nuke Silo', short: 'Nuke', desc: 'One launch per charge (R), anywhere on the map. Clears a huge area.',
    hitsGround: true, hitsAir: true, airMult: 1, color: 0xffe040, turret: 't_nuke', aim: 'static', targeted: false, manual: true,
    levels: [
      { cost: 300, damage: 2500, range: 0, rate: 0, splash: 150, charge: 60 },
      { cost: 300, damage: 4500, range: 0, rate: 0, splash: 170, charge: 52 },
      { cost: 500, damage: 8000, range: 0, rate: 0, splash: 200, charge: 45 },
    ],
  }),
  T({
    kind: 'hive', cat: 'super', name: 'Drone Hive', short: 'Drones', desc: 'Launches drones that hunt units around the hive, air or ground.',
    hitsGround: true, hitsAir: true, airMult: 1, color: 0x50d0ff, turret: 't_hive', aim: 'static',
    levels: [
      { cost: 150, damage: 14, range: 260, rate: 3, drones: 2 },
      { cost: 140, damage: 20, range: 300, rate: 3.2, drones: 3 },
      { cost: 240, damage: 30, range: 340, rate: 3.5, drones: 4 },
    ],
  }),
  T({
    kind: 'blackhole', cat: 'super', name: 'Black Hole Projector', short: 'Black Hole', desc: 'Opens a singularity that drags units in and swallows the weak ones.',
    hitsGround: true, hitsAir: false, airMult: 0, color: 0x8a40ff, turret: 't_blackhole', aim: 'spin',
    levels: [
      { cost: 350, damage: 80, range: 200, rate: 0.125, splash: 80, pull: 110, duration: 3 },
      { cost: 300, damage: 140, range: 230, rate: 0.14, splash: 90, pull: 130, duration: 3.5 },
      { cost: 500, damage: 230, range: 260, rate: 0.16, splash: 100, pull: 150, duration: 4 },
    ],
  }),
];

export const towerIndex = (kind: TowerKind) => TOWERS.findIndex((t) => t.kind === kind);
export const TW_GUN = towerIndex('gun');
export const TW_EMP = towerIndex('emp');
export const TW_LASER = towerIndex('laser');

// ---------------------------------------------------------------- combos
// Two towers of these kinds with touching footprints both get the bonus.

export interface Combo {
  a: TowerKind;
  b: TowerKind;
  name: string;
  desc: string;
  dmg?: number; // damage multiplier for both
  rate?: number;
  range?: number;
  air?: number; // extra multiplier vs air
}

export const COMBOS: Combo[] = [
  { a: 'gun', b: 'gatling', name: 'Lead Storm', desc: '+25% fire rate', rate: 1.25 },
  { a: 'cannon', b: 'cryo', name: 'Shatter', desc: '+40% damage', dmg: 1.4 },
  { a: 'missile', b: 'radar', name: 'Guided', desc: '+25% range and damage', dmg: 1.25, range: 1.25 },
  { a: 'laser', b: 'tesla', name: 'Ion Lance', desc: '+40% damage', dmg: 1.4 },
  { a: 'flame', b: 'gas', name: 'Firestorm', desc: '+30% damage; gas clouds burn', dmg: 1.3 },
  { a: 'sniper', b: 'radar', name: 'Overwatch', desc: '+50% damage', dmg: 1.5 },
  { a: 'rail', b: 'tesla', name: 'Gauss', desc: '+40% damage', dmg: 1.4 },
  { a: 'emp', b: 'gravity', name: 'Event Horizon', desc: '+30% range', range: 1.3 },
  { a: 'napalm', b: 'acid', name: 'Hellfire', desc: '+30% damage', dmg: 1.3 },
  { a: 'flak', b: 'missile', name: 'Sky Net', desc: '+35% vs air', air: 1.35 },
  { a: 'arty', b: 'command', name: 'Fire Mission', desc: '+30% fire rate', rate: 1.3 },
  { a: 'bunker', b: 'barricade', name: 'Fortified', desc: '+30% damage', dmg: 1.3 },
];

export const TARGET_MODES = ['First', 'Last', 'Strong', 'Close'] as const;

// ---------------------------------------------------------------- waves

export interface SpawnGroup {
  kind: number;
  count: number;
  interval: number; // s between spawns
  delay: number; // s from wave start
}

export function hpScale(wave: number): number {
  const n = wave - 1;
  return 1 + 0.15 * n + 0.009 * n * n;
}

export function rewardScale(wave: number): number {
  return 1 + 0.05 * (wave - 1);
}

export function buildWave(wave: number): SpawnGroup[] {
  const n = wave;
  const g: SpawnGroup[] = [];
  const add = (kind: number, count: number, interval: number, delay = 0) =>
    g.push({ kind, count: Math.max(1, Math.round(count)), interval, delay });

  if (n % 10 === 0) {
    add(EN_BOSS, n / 10, 6);
    add(EN_TANK, 2 + n / 6, 1.6, 2);
    add(EN_INFANTRY, 8 + n * 0.8, 0.35, 0);
  } else if (n % 5 === 0) {
    add(EN_HELI, 6 + n * 0.6, 0.9);
    add(EN_BUGGY, 4 + n * 0.3, 0.7, 3);
  } else {
    switch (n % 4) {
      case 1:
        add(EN_INFANTRY, 10 + n * 1.4, 0.55);
        if (n > 6) add(EN_APC, n * 0.3, 1.5, 4);
        break;
      case 2:
        add(EN_BUGGY, 6 + n * 0.9, 0.6);
        add(EN_INFANTRY, 6 + n * 0.6, 0.5, 2);
        break;
      case 3:
        add(EN_APC, 4 + n * 0.5, 1.1);
        if (n > 3) add(EN_TANK, n * 0.25, 2.0, 3);
        break;
      default:
        add(EN_INFANTRY, 8 + n, 0.45);
        add(EN_TANK, 1 + n * 0.3, 1.8, 2);
        if (n > 8) add(EN_HELI, n * 0.3, 1.2, 5);
        break;
    }
  }
  // later waves bring units that need specific counters
  if (n >= 7 && n % 3 === 1) add(EN_GHOST, 3 + n * 0.35, 0.9, 6);
  if (n >= 9 && n % 4 === 1) add(EN_AEGIS, 2 + n * 0.25, 1.6, 4);
  if (n >= 11 && n % 2 === 1) add(EN_MEDIC, 1 + n * 0.08, 3, 3);
  return g;
}
