import {
  COLS, COMBOS, DT, ENEMIES, MAP_H, MAP_W, MAX_ENEMIES, MAX_FX, MAX_PROJECTILES, ROWS, SELL_RATIO,
  START_MONEY, TILE, TOTAL_WAVES, TOWERS, UNITS, WAVE_BONUS, WAVE_GAP, WW2, buildWave, hpScale, rewardScale, towerIndex,
  type EnemyDef, type EnemyGun, type Role, type SpawnGroup, type TowerLevel,
} from './defs';
import { setRuleset } from './rules';
import { DIFFICULTIES, perk, type GameConfig } from './config';
import type { Command } from './commands';
import { FlowField } from './flow';
import { T_BUILD, T_MOUNT, T_ROCK, T_TREE, T_WATER, WATER_SLOW, buildMap, type GameMap } from './maps';
import { Rng } from './rng';
import { SpatialHash } from './spatial';

// Projectile kinds
export const P_BULLET = 0;
export const P_SHELL = 1;
export const P_MISSILE = 2;
export const P_NAPALM = 3;
export const P_ACID = 4;
export const P_GAS = 5;
export const P_FLAK = 6;
export const P_ARTY = 7;
export const P_CRYO = 8;
export const P_NUKE = 9;
export const P_AP = 10; // WW2 armour-piercing round: a fast tracer at one unit
/** Projectiles that fly a ballistic arc to a fixed point, and how high (render only). */
export const ARC_HEIGHT: Record<number, number> = { [P_SHELL]: 45, [P_NAPALM]: 55, [P_GAS]: 50, [P_ARTY]: 150, [P_NUKE]: 240 };

// Ground/air zones left behind by some weapons
export const Z_FIRE = 0;
export const Z_GAS = 1;
export const Z_HOLE = 2;
export const Z_ORBITAL = 3;

export interface Zone {
  kind: number;
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  r: number;
  t: number; // s left
  t0: number;
  dps: number;
  pull: number;
  burn: boolean; // gas that also sets units alight (Firestorm combo)
  src: Tower | null;
}

export interface Drone {
  hive: Tower;
  x: number;
  y: number;
  px: number;
  py: number;
  ang: number;
  pang: number;
  cd: number;
  tgt: number;
  orbit: number;
}

/** Short-lived straight lines: sniper tracers, railgun trails, hacker links, orbital beams. */
export interface Streak {
  x0: number;
  y0: number;
  z0: number;
  x1: number;
  y1: number;
  z1: number;
  life: number;
  life0: number;
  color: number;
  width: number;
}

// Effect textures
export const FX_GLOW = 0;
export const FX_SMOKE = 1;
export const FX_SPARK = 2;
export const FX_RING = 3;
export const FX_DEBRIS = 4;

export const MAX_BOLTS = 128;
export const BOLT_NODES = 8;

export interface Tower {
  id: number;
  type: number;
  kind: Role; // what it does (TOWERS[type].role)
  level: number;
  col: number;
  row: number;
  size: number;
  x: number;
  y: number;
  cd: number;
  angle: number;
  prevAngle: number;
  mode: number;
  beam: number; // laser target slot, -1 none
  recoil: number;
  spent: number;
  kills: number;
  damage: number;
  open: boolean; // gates
  charge: number; // superweapons: s until ready
  spin: number; // gatling: 0..1 spin-up
  heat: number; // gatling: 0..1, overheats at 1
  firing: number; // flamethrower: s left of visible spray
  // from auras and combos, refreshed when the towers change
  rangeMult: number;
  rateMult: number;
  dmgMult: number;
  airBonus: number;
  combos: string[];
  /** Who built it: 0 the player(s), PARTNER (1) the AI partner. */
  owner: number;
  /** WW2: hit points left (0 for things the enemy can't shoot at), a destroyed emplacement's rubble, crew suppression 0..1. */
  hp: number;
  wreck: boolean;
  supp: number;
  /** WW2 barracks / motor pool: the unit being trained (-1 none) and s left. */
  trainKind: number;
  trainT: number;
  /** WW2 stealth: s it stays revealed after firing, and s the enemy still knows where it is after spotting it. */
  seenT: number;
  knownT: number;
}

/** Effective stats of a tower after auras and combos. */
export interface TowerStats {
  damage: number;
  range: number;
  rate: number;
}

interface Spawner {
  wave: number;
  groups: SpawnGroup[];
  left: Int32Array;
  timer: Float32Array;
  t: number;
}

export type PlaceStatus = 'ok' | 'blocked' | 'occupied' | 'invalid';

// Events for sound and screen effects, five numbers each: type, x, y, a, b. Purely cosmetic: the
// simulation never reads them back, so they can't break determinism.
export const EV_SHOT = 0; // a = tower type
export const EV_BOOM = 1; // a = size
export const EV_KILL = 2; // a = enemy kind, b = reward
export const EV_LEAK = 3; // a = enemy kind
export const EV_BUILD = 4;
export const EV_SELL = 5;
export const EV_UPGRADE = 6;
export const EV_WAVE = 7; // a = wave
export const EV_HIT = 8; // a = damage (big single hits only)
export const EV_STATUS = 9; // a = 0 frozen, 1 hacked, 2 shatter, 3 stunned, 4 swallowed, 5 ricochet, 6 tracked, 7 critical hit
export const EV_NUKE = 10;
export const EV_LEVEL = 11; // hero level up, a = level
export const EV_ITEM = 12; // a = item
export const EV_ABILITY = 13; // a = ability
export const EV_DENY = 14;
export const EV_ESHOT = 15; // an attacker fires; a = weapon (ENEMY_FX index)
export const EV_WRECK = 16; // an emplacement destroyed; a = tower type
export const EV_DOWN = 17; // the commander is wounded
export const EV_USHOT = 18; // a defender unit fires; a = unit kind
export const EV_SIZE = 5;

export const ITEMS = [
  { name: 'Barrage', key: 'Z', desc: 'Eight artillery shells rain down around the target.' },
  { name: 'Mine Drop', key: 'X', desc: 'Scatters six mines around the target.' },
  { name: 'Supply Crate', key: 'C', desc: 'Instant cash: $40 + $15 per wave.' },
] as const;

export const HERO_ABILITIES = [
  { name: 'Airstrike', key: '[', cd: 40, desc: 'A jet carpet-bombs a line through the target.' },
  { name: 'Rally', key: ']', cd: 50, desc: 'Towers near the hero fire 40% faster for 8s.' },
  { name: 'Stun Grenade', key: '\\', cd: 25, desc: 'Stops every unit near the target for 2.5s.' },
] as const;

export const HERO_MAX_LEVEL = 10;

export interface Hero {
  x: number;
  y: number;
  px: number;
  py: number;
  ang: number;
  pang: number;
  path: number[]; // cells still to walk, next first
  level: number;
  xp: number;
  cd: number[]; // ability cooldowns (s)
  fireCd: number;
  rallyT: number;
  /** WW2: the commander can be wounded: hit points, s until back in the fight, and where he comes back. */
  hp: number;
  downT: number;
  homeX: number;
  homeY: number;
  /** Stands in for the hero as the damage source, so kills can be credited. */
  src: Tower;
}

/** A delayed area hit: airstrike bombs, barrage shells. */
interface Strike {
  x: number;
  y: number;
  t: number;
  dmg: number;
  r: number;
  src: Tower | null;
  pen: number; // WW2: penetration of the bomb or shell (top armour)
}

const TURN_RATE = 10; // rad/s for turrets
const STEALTH_DETECT = 45; // px: any tower spots a stealth unit this close
/** WW2: penetration of the commander's submachine gun. */
const HERO_PEN = 8;
/** Render heights shared with the renderer: flying units and turret muzzles. */
export const AIR_Z = 34;
export const MUZZLE_Z = 16;
const TWO_PI = Math.PI * 2;
/** WW2: how the attackers' weapons sound (EV_ESHOT), indexed like EnemyGun.fx. */
export const ENEMY_FX = ['rifle', 'smg', 'mg', 'tank', 'rocket', 'katyusha', 'satchel', 'barrage'] as const;
/** WW2: Katyusha rockets in flight at once. */
export const MAX_ROCKETS = 512;
/** WW2: what a wrecked emplacement costs to rebuild, and what a repair costs, as a share of what went into it. */
const REPAIR_SHARE = 0.4;
/** s the wounded commander is out of action. */
const HERO_DOWN = 20;
/** WW2 defender units: slots, cells of path each can hold, stances. */
export const MAX_UNITS = 192;
export const UNIT_PATH = 160;
export const ST_HOLD = 0;
export const ST_GUARD = 1;
export const ST_HUNT = 2;
export const ST_AMBUSH = 3;
export const STANCES = [
  { name: 'Hold', desc: 'Stay put and fire at whatever comes into range.' },
  { name: 'Guard', desc: 'Engage enemies near its post, then return to it.' },
  { name: 'Hunt', desc: 'Chase any enemy it can see, anywhere.' },
  { name: 'Ambush', desc: 'Hidden while still; holds fire until a close or flank shot, which hits harder.' },
];
/** How far a Guard leaves its post to chase, and how far a Hunt looks for prey (px). */
const GUARD_LEASH = 150;
const HUNT_RANGE = 420;
/** Defender ids for units: -(UNIT_ID0 + slot). */
const UNIT_ID0 = 10;
/** WW2: the tower targeting mode that holds fire for a flank or point-blank shot. */
export const MODE_AMBUSH = 4;
/** s an emplacement or unit stays revealed after firing, and stays known after being spotted. */
const REVEAL_T = 3;
const KNOWN_T = 4;
/** WW2 smoke screens at once; s they last; px radius. */
export const MAX_SMOKE = 64;
const SMOKE_T = 6;
export const SMOKE_R = 40;

function angleDiff(a: number, b: number): number {
  let d = (b - a) % TWO_PI;
  if (d > Math.PI) d -= TWO_PI;
  else if (d < -Math.PI) d += TWO_PI;
  return d;
}

export class Sim {
  readonly map: GameMap;
  /** Gameplay randomness: must be consumed identically on every run (replays, co-op lockstep). */
  readonly rng: Rng;
  /** Visual-only randomness (particles), so effect settings never change the outcome. */
  private readonly vr = new Rng(99);
  /** Per route: distance field towards its exit, over the current maze. */
  readonly fields: FlowField[];
  private readonly scratch: FlowField[];
  /**
   * WW2: per route, the way through if walls can be broken: emplacement cells are passable at a cost
   * that grows with their strength. Rebuilt whenever the towers change (derived state, not saved).
   */
  readonly breach: FlowField[];
  private readonly breachCost = new Float32Array(COLS * ROWS);
  private readonly breachBlocked = new Uint8Array(COLS * ROWS);
  private breachVersion = -1;
  /** Speed factor of the bare ground (water slows ground units) and the matching path cost. Static per map. */
  private readonly groundSlow = new Float32Array(COLS * ROWS);
  private readonly moveCost = new Float32Array(COLS * ROWS);
  /** Impassable cells: rocks, mountains, forests and towers. */
  readonly blocked = new Uint8Array(COLS * ROWS);
  private spawnCount = 0;

  readonly config: GameConfig;
  money = 0;
  lives = 0;
  private readonly hpMult: number;
  private readonly routeFactor: number;
  private readonly bountyMult: number;
  readonly events: number[] = [];
  /** Damage dealt by each tower since the last wave report (cosmetic: never read by the simulation). */
  waveDamage = new Map<number, number>();
  hero: Hero | null = null;
  readonly items = [1, 1, 1];
  readonly itemMax: number;
  private readonly strikes: Strike[] = [];
  leakedThisWave = 0;
  /** Fraction of cosmetic particles to keep (effects quality setting). */
  fxScale = 1;
  wave = 0;
  nextWaveTimer = 0;
  time = 0;
  ticks = 0;
  gameOver = false;
  victory = false;
  endless = false;
  totalKills = 0;

  // ------------------------------------------------------------ enemies (stable slots)
  readonly eAlive = new Uint8Array(MAX_ENEMIES);
  readonly eUid = new Int32Array(MAX_ENEMIES);
  readonly eKind = new Uint8Array(MAX_ENEMIES);
  readonly eAir = new Uint8Array(MAX_ENEMIES);
  readonly eHp = new Float32Array(MAX_ENEMIES);
  readonly eMaxHp = new Float32Array(MAX_ENEMIES);
  readonly eRoute = new Uint8Array(MAX_ENEMIES);
  readonly eRemain = new Float32Array(MAX_ENEMIES); // px left to the exit (targeting)
  readonly eCell = new Int32Array(MAX_ENEMIES); // last walkable cell
  readonly eSpeed = new Float32Array(MAX_ENEMIES);
  readonly eSlowT = new Float32Array(MAX_ENEMIES);
  readonly eSlowF = new Float32Array(MAX_ENEMIES);
  readonly eOx = new Float32Array(MAX_ENEMIES); // per-unit aim offset inside a cell, so crowds spread out
  readonly eOy = new Float32Array(MAX_ENEMIES);
  readonly eX = new Float32Array(MAX_ENEMIES);
  readonly eY = new Float32Array(MAX_ENEMIES);
  readonly ePx = new Float32Array(MAX_ENEMIES);
  readonly ePy = new Float32Array(MAX_ENEMIES);
  readonly eAng = new Float32Array(MAX_ENEMIES);
  readonly ePang = new Float32Array(MAX_ENEMIES);
  readonly eReward = new Float32Array(MAX_ENEMIES);
  readonly eFlash = new Float32Array(MAX_ENEMIES);
  readonly eGCell = new Int32Array(MAX_ENEMIES); // grid cell under the unit (air too), for aura lookups
  readonly eStealth = new Uint8Array(MAX_ENEMIES);
  readonly eSeen = new Uint8Array(MAX_ENEMIES); // stealth unit inside a radar this tick
  readonly eJam = new Float32Array(MAX_ENEMIES); // jammer exposure this tick (0 = not jammed)
  readonly eShield = new Float32Array(MAX_ENEMIES);
  readonly eMaxShield = new Float32Array(MAX_ENEMIES);
  private readonly eShieldCd = new Float32Array(MAX_ENEMIES); // s since last hit
  private readonly eHealCd = new Float32Array(MAX_ENEMIES);
  readonly eBurnT = new Float32Array(MAX_ENEMIES);
  private readonly eBurn = new Float32Array(MAX_ENEMIES); // dps
  private readonly eBurnBy: (Tower | null)[] = new Array(MAX_ENEMIES).fill(null);
  private readonly eShred = new Float32Array(MAX_ENEMIES);
  private readonly eShredT = new Float32Array(MAX_ENEMIES);
  readonly eChill = new Float32Array(MAX_ENEMIES);
  readonly eFrozenT = new Float32Array(MAX_ENEMIES);
  readonly eHackT = new Float32Array(MAX_ENEMIES);
  readonly eStunT = new Float32Array(MAX_ENEMIES);
  /** WW2: suppression 0..1 — pinned infantry crawl and keep their heads down. */
  readonly eSupp = new Float32Array(MAX_ENEMIES);
  /** WW2 intelligence: breaching a wall (0/1), the tower id it is breaking through, s spent stuck, smoke used, inside smoke, sapper work timer. */
  readonly eBreach = new Uint8Array(MAX_ENEMIES);
  readonly eWall = new Int32Array(MAX_ENEMIES);
  private readonly eBreachT = new Float32Array(MAX_ENEMIES);
  private readonly eSmokeUsed = new Uint8Array(MAX_ENEMIES);
  readonly eSmoked = new Uint8Array(MAX_ENEMIES);
  private readonly eWork = new Float32Array(MAX_ENEMIES);
  /** WW2 return fire: the defender aimed at (0 none, -1 the commander, else a tower id), reload, s left of the halt to aim. */
  readonly eTgt = new Int32Array(MAX_ENEMIES);
  private readonly eGunCd = new Float32Array(MAX_ENEMIES);
  readonly eAimT = new Float32Array(MAX_ENEMIES);
  private readonly eHackDps = new Float32Array(MAX_ENEMIES);
  private readonly eFree = new Int32Array(MAX_ENEMIES);
  private eFreeTop = 0;
  private nextUid = 1;
  /** Dense list of live slots, valid after each tick. */
  readonly live = new Int32Array(MAX_ENEMIES);
  liveCount = 0;

  // ------------------------------------------------------------ projectiles (swap-remove)
  readonly pKind = new Uint8Array(MAX_PROJECTILES);
  readonly pX = new Float32Array(MAX_PROJECTILES);
  readonly pY = new Float32Array(MAX_PROJECTILES);
  readonly pPx = new Float32Array(MAX_PROJECTILES);
  readonly pPy = new Float32Array(MAX_PROJECTILES);
  readonly pVx = new Float32Array(MAX_PROJECTILES);
  readonly pVy = new Float32Array(MAX_PROJECTILES);
  readonly pSpeed = new Float32Array(MAX_PROJECTILES);
  readonly pDmg = new Float32Array(MAX_PROJECTILES);
  readonly pSplash = new Float32Array(MAX_PROJECTILES);
  readonly pAirMult = new Float32Array(MAX_PROJECTILES);
  readonly pTarget = new Int32Array(MAX_PROJECTILES);
  readonly pTuid = new Int32Array(MAX_PROJECTILES);
  readonly pTtl = new Float32Array(MAX_PROJECTILES);
  readonly pTtl0 = new Float32Array(MAX_PROJECTILES);
  readonly pTx = new Float32Array(MAX_PROJECTILES);
  readonly pTy = new Float32Array(MAX_PROJECTILES);
  private readonly pExtra = new Float32Array(MAX_PROJECTILES); // chill, shred, burn, cloud life…
  private readonly pExtra2 = new Float32Array(MAX_PROJECTILES);
  private readonly pSrc: (Tower | null)[] = new Array(MAX_PROJECTILES).fill(null);
  pCount = 0;

  // ------------------------------------------------------------ WW2: enemy rockets in flight (swap-remove)
  readonly rkSx = new Float32Array(MAX_ROCKETS);
  readonly rkSy = new Float32Array(MAX_ROCKETS);
  readonly rkTx = new Float32Array(MAX_ROCKETS);
  readonly rkTy = new Float32Array(MAX_ROCKETS);
  readonly rkWait = new Float32Array(MAX_ROCKETS); // s until it leaves the rail
  readonly rkT = new Float32Array(MAX_ROCKETS); // s of flight left
  readonly rkT0 = new Float32Array(MAX_ROCKETS);
  private readonly rkDmg = new Float32Array(MAX_ROCKETS);
  rkCount = 0;

  // ------------------------------------------------------------ WW2: smoke screens (swap-remove)
  readonly smX = new Float32Array(MAX_SMOKE);
  readonly smY = new Float32Array(MAX_SMOKE);
  readonly smT = new Float32Array(MAX_SMOKE);
  smCount = 0;
  readonly rkShell = new Uint8Array(MAX_ROCKETS); // 1: an artillery shell rather than a rocket

  // ------------------------------------------------------------ WW2: defender units (stable slots)
  readonly uAlive = new Uint8Array(MAX_UNITS);
  readonly uUid = new Int32Array(MAX_UNITS);
  readonly uKind = new Uint8Array(MAX_UNITS);
  readonly uAir = new Uint8Array(MAX_UNITS);
  readonly uX = new Float32Array(MAX_UNITS);
  readonly uY = new Float32Array(MAX_UNITS);
  readonly uPx = new Float32Array(MAX_UNITS);
  readonly uPy = new Float32Array(MAX_UNITS);
  readonly uAng = new Float32Array(MAX_UNITS);
  readonly uPang = new Float32Array(MAX_UNITS);
  readonly uHp = new Float32Array(MAX_UNITS);
  private readonly uCd = new Float32Array(MAX_UNITS);
  readonly uTgt = new Int32Array(MAX_UNITS).fill(-1); // enemy slot
  private readonly uTuid = new Int32Array(MAX_UNITS);
  readonly uStance = new Uint8Array(MAX_UNITS);
  readonly uPostX = new Float32Array(MAX_UNITS);
  readonly uPostY = new Float32Array(MAX_UNITS);
  readonly uPath = new Int32Array(MAX_UNITS * UNIT_PATH);
  readonly uPathLen = new Uint16Array(MAX_UNITS);
  readonly uPathI = new Uint16Array(MAX_UNITS);
  private readonly uGoal = new Int32Array(MAX_UNITS).fill(-1);
  readonly uOrder = new Uint8Array(MAX_UNITS); // walking a player's order
  readonly uSupp = new Float32Array(MAX_UNITS);
  readonly uLife = new Float32Array(MAX_UNITS); // aircraft: s of patrol left
  readonly uSeenT = new Float32Array(MAX_UNITS); // s it stays revealed after firing
  readonly uKnownT = new Float32Array(MAX_UNITS); // s the enemy keeps track of it after spotting it
  readonly uKills = new Int32Array(MAX_UNITS);
  readonly uTask = new Int32Array(MAX_UNITS).fill(-1); // engineers: tower id; medics: unit slot (-2 the commander)
  nextUnitUid = 1;
  /** Stands in as the damage source for unit fire (id -2), and as the aim point of shots at a unit. */
  private readonly unitSrc: Tower = Sim.proxy(-2);
  private readonly aimProxy: Tower = Sim.proxy(-UNIT_ID0);
  private proxyRange = 0;
  private proxySupp = 0;
  /** Bumped when units appear or die (UI resync). */
  unitVersion = 0;
  private readonly bfsPrev = new Int32Array(COLS * ROWS);
  private readonly bfsQ = new Int32Array(COLS * ROWS);

  // ------------------------------------------------------------ visual effects (swap-remove)
  readonly fTex = new Uint8Array(MAX_FX);
  readonly fAdd = new Uint8Array(MAX_FX); // additive blend
  readonly fX = new Float32Array(MAX_FX);
  readonly fY = new Float32Array(MAX_FX);
  readonly fZ = new Float32Array(MAX_FX); // height above ground (render only)
  readonly fPx = new Float32Array(MAX_FX);
  readonly fPy = new Float32Array(MAX_FX);
  readonly fVx = new Float32Array(MAX_FX);
  readonly fVy = new Float32Array(MAX_FX);
  readonly fDrag = new Float32Array(MAX_FX);
  readonly fLife = new Float32Array(MAX_FX);
  readonly fMax = new Float32Array(MAX_FX);
  readonly fS0 = new Float32Array(MAX_FX);
  readonly fS1 = new Float32Array(MAX_FX);
  readonly fA0 = new Float32Array(MAX_FX);
  readonly fRot = new Float32Array(MAX_FX);
  readonly fColor = new Uint32Array(MAX_FX);
  fCount = 0;

  // ------------------------------------------------------------ tesla bolts
  readonly bLife = new Float32Array(MAX_BOLTS);
  readonly bN = new Uint8Array(MAX_BOLTS);
  readonly bPts = new Float32Array(MAX_BOLTS * BOLT_NODES * 2);
  bCount = 0;

  // ------------------------------------------------------------ towers
  readonly towers: Tower[] = [];
  readonly towerAt = new Int32Array(COLS * ROWS).fill(-1); // tower id per cell
  private readonly towerById = new Map<number, Tower>();
  private nextTowerId = 1;
  /** Bumped when towers change so the renderer can resync lazily. */
  towerVersion = 0;

  // ------------------------------------------------------------ auras, rebuilt when towers change
  private auraVersion = -1;
  readonly radarGrid = new Uint8Array(COLS * ROWS);
  private readonly jamGrid = new Float32Array(COLS * ROWS);
  private readonly salvageGrid = new Float32Array(COLS * ROWS);
  private readonly tarGrid = new Float32Array(COLS * ROWS);
  /** WW2: speed factor for infantry only (barbed wire). */
  private readonly wireGrid = new Float32Array(COLS * ROWS).fill(1);
  private readonly spikeGrid = new Float32Array(COLS * ROWS);
  private readonly spikeSrc: (Tower | null)[] = new Array(COLS * ROWS).fill(null);

  readonly zones: Zone[] = [];
  readonly drones: Drone[] = [];
  readonly streaks: Streak[] = [];

  private spawners: Spawner[] = [];
  private readonly hash = new SpatialHash(MAP_W, MAP_H, 80, MAX_ENEMIES);
  private readonly qbuf = new Int32Array(MAX_ENEMIES);
  private readonly qpool: Int32Array[] = [];
  private qdepth = 0;
  private readonly chainHit = new Int32Array(16);

  private static proxy(id: number): Tower {
    return {
      id, type: 0, kind: 'gun', level: 0, col: 0, row: 0, size: 1, x: 0, y: 0, cd: 0, angle: 0, prevAngle: 0, mode: 3,
      beam: -1, recoil: 0, spent: 0, kills: 0, damage: 0, open: false, charge: 0, spin: 0, heat: 0, firing: 0,
      rangeMult: 1, rateMult: 1, dmgMult: 1, airBonus: 1, combos: [], owner: 0, hp: 0, wreck: false, supp: 0, trainKind: -1, trainT: 0, seenT: 0, knownT: 0,
    };
  }

  /** Builds the map (which sets the live map size) before any grid-sized arrays exist. */
  static create(config: GameConfig): Sim {
    setRuleset(config);
    return new Sim(buildMap(config.map), config);
  }

  private constructor(map: GameMap, config: GameConfig) {
    this.map = map;
    this.config = config;
    this.rng = new Rng(config.seed);
    const diff = DIFFICULTIES[config.difficulty];
    // every extra route splits the defence, so it pays more to hold it
    this.routeFactor = 1 + 0.35 * (map.routes.length - 1);
    this.money = Math.round(START_MONEY * diff.money * this.routeFactor) + 50 * perk(config, 'logistics');
    this.lives = config.modifiers.includes('oneLife') ? 1 : diff.lives + 5 * perk(config, 'fortify');
    this.hpMult = diff.hp;
    this.bountyMult = 1 + 0.1 * perk(config, 'bounty');
    this.itemMax = 1 + perk(config, 'airpower');
    this.items.fill(this.itemMax);
    for (let i = 0; i < map.grid.length; i++) {
      const t = map.grid[i];
      this.blocked[i] = t === T_ROCK || t === T_MOUNT || t === T_TREE ? 1 : 0;
      this.groundSlow[i] = t === T_WATER ? WATER_SLOW : 1;
      this.moveCost[i] = 1 / this.groundSlow[i];
    }
    this.tarGrid.set(this.groundSlow);
    this.fields = map.routes.map((r) => new FlowField(r.exit, this.moveCost));
    this.scratch = map.routes.map((r) => new FlowField(r.exit, this.moveCost));
    this.breach = map.routes.map((r) => new FlowField(r.exit, this.breachCost));
    for (const f of this.fields) f.compute(this.blocked);
    for (let i = 0; i < MAX_ENEMIES; i++) this.eFree[i] = MAX_ENEMIES - 1 - i;
    this.eFreeTop = MAX_ENEMIES;
    this.spawnHero(1 + 2 * perk(config, 'veteran'));
  }

  private ev(type: number, x: number, y: number, a = 0, b = 0): void {
    if (this.events.length < 4000) this.events.push(type, x, y, a, b);
  }

  // ============================================================ rules from the config

  /** Can this tower type be built in this game (challenge modifiers, limited arsenal)? */
  allowed(type: number): boolean {
    const cfg = this.config;
    if (cfg.allowed && !cfg.allowed.includes(type)) return false;
    const role = TOWERS[type].role;
    return !(cfg.modifiers.includes('noBarricades') && (role === 'barricade' || role === 'gate'));
  }

  /** Build (level 0) or upgrade cost after perks. */
  cost(type: number, level = 0): number {
    const base = TOWERS[type].levels[level].cost;
    const disc = TOWERS[type].cat === 'maze' ? 1 - 0.1 * perk(this.config, 'engineering') : 1;
    return Math.max(1, Math.round(base * disc));
  }

  get canSell(): boolean {
    return !this.config.modifiers.includes('ironman');
  }

  /** The spawn groups of wave n, after modifiers. */
  waveGroups(n: number): SpawnGroup[] {
    const groups = WW2 ? this.adapt(n, buildWave(n)) : buildWave(n);
    if (!this.config.modifiers.includes('airRaid')) return groups;
    // everything flies: aircraft in numbers matching the ground units' threat
    const air = ENEMIES.findIndex((e) => e.air);
    return groups.map((g) => ({
      ...g,
      kind: air,
      count: Math.max(1, Math.round(g.count * Math.min(3, ENEMIES[g.kind].hp / ENEMIES[air].hp))),
    }));
  }

  // ============================================================ save / restore

  /**
   * A structured-clone-friendly copy of the whole state (typed arrays stay typed). Object references
   * (towers as damage sources, drone hives…) are stored as tower ids.
   */
  snapshot(): Record<string, unknown> {
    const SKIP = new Set(['map', 'groundSlow', 'moveCost', 'fields', 'scratch', 'hash', 'qbuf', 'qpool', 'chainHit', 'events', 'towerById', 'config', 'rng', 'vr', 'bfsPrev', 'bfsQ', 'breach', 'breachCost', 'breachBlocked', 'breachVersion']);
    const id = (t: Tower | null) => (t ? t.id : null);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(this)) {
      if (SKIP.has(k)) continue;
      if (ArrayBuffer.isView(v)) out[k] = (v as Float32Array).slice();
      else if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') out[k] = v;
    }
    out.config = this.config;
    out.rng = (this.rng as unknown as { s: number }).s;
    out.vr = (this.vr as unknown as { s: number }).s;
    out.towers = this.towers.map((t) => ({ ...t, combos: [] }));
    out.zones = this.zones.map((z) => ({ ...z, src: id(z.src) }));
    out.drones = this.drones.map((d) => ({ ...d, hive: d.hive.id }));
    out.strikes = this.strikes.map((k) => ({ ...k, src: id(k.src) }));
    out.spawners = this.spawners.map((sp) => ({ ...sp, left: sp.left.slice(), timer: sp.timer.slice() }));
    out.hero = this.hero ? { ...this.hero, path: [...this.hero.path], cd: [...this.hero.cd], src: null } : null;
    out.items = [...this.items];
    out.lastBuild = this.lastBuild;
    out.waveDamage = [...this.waveDamage];
    out.pSrc = this.pSrc.slice(0, this.pCount).map(id);
    out.eBurnBy = this.eBurnBy.map(id);
    return out;
  }

  static restore(snap: Record<string, unknown>): Sim {
    const sim = Sim.create(snap.config as GameConfig);
    const any = sim as unknown as Record<string, unknown>;
    for (const [k, v] of Object.entries(snap)) {
      const cur = any[k];
      if (ArrayBuffer.isView(cur) && ArrayBuffer.isView(v)) (cur as Float32Array).set(v as Float32Array);
      else if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') {
        if (k !== 'rng' && k !== 'vr') any[k] = v;
      }
    }
    (sim.rng as unknown as { s: number }).s = snap.rng as number;
    (sim.vr as unknown as { s: number }).s = snap.vr as number;
    for (const t of snap.towers as Tower[]) {
      // saves from before WW2 emplacements could be shot at
      t.hp ??= 0;
      t.wreck ??= false;
      t.supp ??= 0;
      t.trainKind ??= -1;
      t.trainT ??= 0;
      t.seenT ??= 0;
      t.knownT ??= 0;
      sim.towers.push(t);
      sim.towerById.set(t.id, t);
    }
    const byId = (i: number | null) => (i === null ? null : i === -1 ? sim.hero?.src ?? null : sim.towerById.get(i) ?? null);
    const hero = snap.hero as Hero | null;
    if (hero && sim.hero) Object.assign(sim.hero, { ...hero, src: sim.hero.src });
    else sim.hero = null;
    if (sim.hero) {
      sim.hero.src.x = sim.hero.x;
      sim.hero.src.y = sim.hero.y;
    }
    for (const z of snap.zones as (Zone & { src: number | null })[]) sim.zones.push({ ...z, src: byId(z.src as unknown as number | null) });
    for (const d of snap.drones as (Drone & { hive: number })[]) {
      const hive = byId(d.hive as unknown as number);
      if (hive) sim.drones.push({ ...d, hive });
    }
    for (const k of snap.strikes as (Strike & { src: number | null })[]) sim.strikes.push({ ...k, src: byId(k.src as unknown as number | null) });
    sim.spawners = snap.spawners as Spawner[];
    (snap.items as number[]).forEach((n, k) => (sim.items[k] = n));
    sim.lastBuild = snap.lastBuild as Sim['lastBuild'];
    sim.waveDamage = new Map(snap.waveDamage as [number, number][]);
    (snap.pSrc as (number | null)[]).forEach((i, p) => (sim.pSrc[p] = byId(i)));
    (snap.eBurnBy as (number | null)[]).forEach((i, e) => (sim.eBurnBy[e] = byId(i)));
    for (const f of sim.fields) f.compute(sim.blocked);
    sim.auraVersion = -1;
    sim.breachVersion = -1;
    sim.checkKey = '';
    return sim;
  }

  /** A cheap fingerprint of the gameplay state, to detect co-op desyncs. */
  stateHash(): number {
    let h = 2166136261;
    const mix = (n: number) => (h = Math.imul(h ^ (Math.round(n * 16) | 0), 16777619));
    mix(this.ticks);
    mix(this.money);
    mix(this.lives);
    mix(this.liveCount);
    mix(this.towers.length);
    for (const t of this.towers) mix(t.hp);
    for (let u = 0; u < MAX_UNITS; u++) {
      if (!this.uAlive[u]) continue;
      mix(this.uX[u]);
      mix(this.uY[u]);
      mix(this.uHp[u]);
    }
    for (let n = 0; n < this.liveCount; n++) {
      const i = this.live[n];
      mix(this.eX[i]);
      mix(this.eY[i]);
      mix(this.eHp[i]);
    }
    return h >>> 0;
  }

  // ============================================================ commands

  /** The most recent build, refundable in full for a few seconds (undo). */
  private lastBuild: { id: number; tick: number } | null = null;
  static readonly UNDO_TICKS = 5 * 60;

  tower(id: number): Tower | null {
    return this.towerById.get(id) ?? null;
  }

  /** Hands over the damage and leak tallies since the last report, and starts new ones. */
  takeReport(): { damage: Map<number, number>; leaked: number } {
    const r = { damage: this.waveDamage, leaked: this.leakedThisWave };
    this.waveDamage = new Map();
    this.leakedThisWave = 0;
    return r;
  }

  /** No units on the field and none still to come from the waves called so far. */
  get fieldClear(): boolean {
    return !this.spawning && this.liveCount === 0;
  }

  get canUndo(): boolean {
    const b = this.lastBuild;
    return !!b && this.ticks - b.tick <= Sim.UNDO_TICKS && this.towerById.get(b.id)?.level === 0;
  }

  /** Applies one player command. Returns false if it had no effect. */
  exec(cmd: Command): boolean {
    switch (cmd.t) {
      case 'place': {
        const t = this.place(cmd.type, cmd.col, cmd.row);
        if (t && cmd.by) t.owner = cmd.by;
        else if (t) this.lastBuild = { id: t.id, tick: this.ticks };
        return !!t;
      }
      case 'sell': {
        if (!this.canSell) return false;
        let any = false;
        for (const id of cmd.ids) {
          const t = this.towerById.get(id);
          if (t) {
            this.sell(t);
            any = true;
          }
        }
        return any;
      }
      case 'upgrade': {
        let any = false;
        for (const id of cmd.ids) {
          const t = this.towerById.get(id);
          if (t && this.upgrade(t)) any = true;
        }
        return any;
      }
      case 'mode': {
        const t = this.towerById.get(cmd.id);
        if (!t || !TOWERS[t.type].targeted) return false;
        t.mode = cmd.mode;
        return true;
      }
      case 'gate': {
        const t = this.towerById.get(cmd.id);
        return !!t && !t.wreck && this.toggleGate(t) === 'ok';
      }
      case 'train': {
        const t = this.towerById.get(cmd.id);
        return !!t && this.train(t, cmd.unit);
      }
      case 'unitMove':
        return this.unitMove(cmd.ids, cmd.x, cmd.y);
      case 'unitStance': {
        let any = false;
        for (const id of cmd.ids) {
          const u = this.unitSlot(id);
          if (u < 0 || UNITS[this.uKind[u]].air) continue;
          this.uStance[u] = cmd.stance;
          this.uPostX[u] = this.uX[u];
          this.uPostY[u] = this.uY[u];
          any = true;
        }
        return any;
      }
      case 'repair': {
        let any = false;
        for (const id of cmd.ids) {
          const t = this.towerById.get(id);
          if (t && this.repair(t)) any = true;
        }
        return any;
      }
      case 'fire': {
        const t = this.towerById.get(cmd.id);
        return !!t && !t.wreck && this.fireSuper(t, cmd.x, cmd.y);
      }
      case 'wave':
        if (!this.canCallWave) return false;
        this.startNextWave();
        return true;
      case 'undo': {
        if (!this.canUndo) return false;
        const t = this.towerById.get(this.lastBuild!.id)!;
        const refund = t.spent;
        this.sell(t);
        this.money += refund - this.sellValue(t); // full refund
        this.lastBuild = null;
        return true;
      }
      case 'stress':
        this.stress(3000);
        return true;
      case 'item':
        return this.useItem(cmd.item, cmd.x, cmd.y);
      case 'heroMove':
        return this.heroMove(cmd.x, cmd.y);
      case 'heroAbility':
        return this.heroAbility(cmd.ability, cmd.x, cmd.y);
      default:
        return false;
    }
  }

  // ============================================================ player actions

  /** Cells covered by a `size`-cell building whose top-left cell is (col,row), or null if any is unbuildable. */
  private footprint(col: number, row: number, size: number): number[] | null {
    if (col < 0 || row < 0 || col + size > COLS || row + size > ROWS) return null;
    const cells: number[] = [];
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        const i = (row + dy) * COLS + col + dx;
        if (this.map.grid[i] !== T_BUILD || this.towerAt[i] >= 0) return null;
        cells.push(i);
      }
    }
    return cells;
  }

  /** Cheap pre-check (no path search): is the ground free and buildable for this tower type? */
  footprintFree(type: number, col: number, row: number): boolean {
    return this.footprint(col, row, TOWERS[type].size) !== null;
  }

  private checkKey = '';
  private checkResult: PlaceStatus = 'invalid';
  private checkReroutes = false;
  private checkOpenGate = false;

  /**
   * Why tower `type` can or can't go at (col,row): the footprint must be free grass and, for walls,
   * have no ground unit on it, and every route (and every unit already walking) must still reach
   * its exit. On success the would-be flow fields are left in `scratch`. Cached per tick.
   */
  placeStatus(type: number, col: number, row: number): PlaceStatus {
    const key = `${type},${col},${row},${this.towerVersion},${this.ticks}`;
    if (key === this.checkKey) return this.checkResult;
    this.checkKey = key;
    const def = TOWERS[type];
    const cells = this.footprint(col, row, def.size);
    this.checkReroutes = !!cells && !def.walkable;
    this.checkOpenGate = false;
    if (!cells) return (this.checkResult = 'invalid');
    if (def.walkable) return (this.checkResult = 'ok');
    const status = this.wallStatus(cells);
    if (status !== 'ok' && def.kind === 'gate') {
      // a gate that can't close here yet is built open
      this.checkReroutes = false;
      this.checkOpenGate = true;
      return (this.checkResult = 'ok');
    }
    return (this.checkResult = status);
  }

  /** Can these cells become impassable? Leaves the resulting fields in `scratch` when they can. */
  private wallStatus(cells: number[]): PlaceStatus {
    for (let n = 0; n < this.liveCount; n++) {
      const i = this.live[n];
      if (!this.eAlive[i] || this.eAir[i]) continue;
      const r = ENEMIES[this.eKind[i]].radius * 0.6;
      for (const c of cells) {
        const x0 = (c % COLS) * TILE;
        const y0 = ((c / COLS) | 0) * TILE;
        if (this.eX[i] > x0 - r && this.eX[i] < x0 + TILE + r && this.eY[i] > y0 - r && this.eY[i] < y0 + TILE + r) return 'occupied';
      }
    }
    const was = cells.map((i) => this.blocked[i]);
    for (const i of cells) this.blocked[i] = 1;
    let ok = true;
    for (let k = 0; k < this.scratch.length && ok; k++) {
      const f = this.scratch[k];
      f.compute(this.blocked);
      for (const e of this.map.routes[k].entry) if (f.dist[e] === Infinity) ok = false;
    }
    for (let n = 0; n < this.liveCount && ok; n++) {
      const i = this.live[n];
      if (this.eAlive[i] && !this.eAir[i] && this.scratch[this.eRoute[i]].dist[this.eCell[i]] === Infinity) ok = false;
    }
    cells.forEach((i, k) => (this.blocked[i] = was[k]));
    return ok ? 'ok' : 'blocked';
  }

  /** Flow fields as they would be with tower `type` at (col,row); null if it can't go there or doesn't change the route. */
  preview(type: number, col: number, row: number): readonly FlowField[] | null {
    return this.placeStatus(type, col, row) === 'ok' && this.checkReroutes ? this.scratch : null;
  }

  canPlace(type: number, col: number, row: number): boolean {
    return this.placeStatus(type, col, row) === 'ok';
  }

  towerAtTile(col: number, row: number): Tower | null {
    if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return null;
    const id = this.towerAt[row * COLS + col];
    return id < 0 ? null : this.towerById.get(id) ?? null;
  }

  place(type: number, col: number, row: number, free = false): Tower | null {
    const def = TOWERS[type];
    const cost = this.cost(type);
    if (!free && !this.allowed(type)) return null;
    if ((!free && this.money < cost) || !this.canPlace(type, col, row)) return null;
    if (!free) this.money -= cost;
    const size = def.size;
    const t: Tower = {
      id: this.nextTowerId++, type, kind: def.role, level: 0, col, row, size,
      x: (col + size / 2) * TILE, y: (row + size / 2) * TILE,
      cd: 0, angle: -Math.PI / 2, prevAngle: -Math.PI / 2,
      mode: def.role === 'sniper' || def.role === 'arty' ? 2 : 0, // big guns default to Strong
      beam: -1, recoil: 0, spent: free ? 0 : cost, kills: 0, damage: 0,
      open: false, charge: def.levels[0].charge ?? 0, spin: 0, heat: 0, firing: 0,
      rangeMult: 1, rateMult: 1, dmgMult: 1, airBonus: 1, combos: [], owner: 0,
      hp: WW2 ? def.levels[0].hp ?? 0 : 0, wreck: false, supp: 0, trainKind: -1, trainT: 0, seenT: 0, knownT: 0,
    };
    const reroutes = this.checkReroutes;
    t.open = this.checkOpenGate;
    this.towers.push(t);
    this.towerById.set(t.id, t);
    this.setFootprint(t, t.id);
    if (reroutes) for (let k = 0; k < this.fields.length; k++) this.fields[k].copyFrom(this.scratch[k]);
    this.towerVersion++;
    this.burst(t.x, t.y, 0x9a8f78, size * 4, FX_SMOKE, 0);
    if (!free) this.ev(EV_BUILD, t.x, t.y, type);
    return t;
  }

  private cellsOf(t: Tower): number[] {
    const out: number[] = [];
    for (let dy = 0; dy < t.size; dy++) for (let dx = 0; dx < t.size; dx++) out.push((t.row + dy) * COLS + t.col + dx);
    return out;
  }

  private setFootprint(t: Tower, id: number): void {
    const wall = !TOWERS[t.type].walkable && !t.open && !t.wreck;
    for (const i of this.cellsOf(t)) {
      this.towerAt[i] = id;
      this.blocked[i] = id >= 0 && wall ? 1 : 0;
    }
  }

  upgradeCost(t: Tower): number {
    return t.level + 1 < TOWERS[t.type].levels.length ? this.cost(t.type, t.level + 1) : 0;
  }

  upgrade(t: Tower): boolean {
    const cost = this.upgradeCost(t);
    if (!cost || this.money < cost || t.wreck) return false;
    this.money -= cost;
    t.spent += cost;
    const was = this.maxHp(t);
    t.level++;
    if (t.hp > 0) t.hp += this.maxHp(t) - was; // the new works add to what is still standing
    this.towerVersion++;
    this.burst(t.x, t.y, 0xffe28a, 10, FX_SPARK, 1);
    this.ev(EV_UPGRADE, t.x, t.y, t.level);
    return true;
  }

  sellValue(t: Tower): number {
    // rubble is worth only the scrap
    return Math.floor(t.spent * (SELL_RATIO + 0.1 * perk(this.config, 'salvage')) * (t.wreck ? 0.25 : 1));
  }

  // ============================================================ WW2: damage to the defence

  /** Hit points of a tower at full strength (0: the enemy doesn't shoot at it). */
  maxHp(t: Tower): number {
    return WW2 ? TOWERS[t.type].levels[t.level].hp ?? 0 : 0;
  }

  /** Fortification in mm of armour equivalent: sandbags, then timber and earth, then concrete. */
  fortOf(t: Tower): number {
    return TOWERS[t.type].levels[t.level].fort ?? 0;
  }

  /** Camouflage 0..1: nets and scrub from level 4, more at level 7. */
  camoOf(t: Tower): number {
    const c = TOWERS[t.type].camo ?? 0;
    return c ? Math.min(0.95, c + (t.level >= 3 ? 0.1 : 0) + (t.level >= 6 ? 0.05 : 0)) : 0;
  }

  /** Does the enemy not know this emplacement is there (camouflaged, not spotted, not just fired)? */
  towerHidden(t: Tower): boolean {
    return WW2 && t.seenT <= 0 && t.knownT <= 0 && this.camoOf(t) > 0;
  }

  /** How far an attacker sees: infantry look around, buttoned-up tanks see little, recon sees far. */
  private spotRange(k: number): number {
    const e = ENEMIES[k];
    return e.spot ?? (e.inf ? 110 : e.air ? 170 : 75);
  }

  /**
   * WW2 spotting, a few times a second: any attacker close enough to a camouflaged emplacement or
   * hidden unit (nearer the better the camouflage) gives it away to the whole column for a while.
   */
  private updateSpotting(): void {
    for (const t of this.towers) {
      if (t.seenT > 0) t.seenT = Math.max(0, t.seenT - DT * 10);
      if (t.knownT > 0) t.knownT = Math.max(0, t.knownT - DT * 10);
      const camo = this.camoOf(t);
      if (!camo || t.wreck || t.knownT > 0) continue;
      const f = 1 - 0.7 * camo;
      const n = this.hash.query(t.x, t.y, 230 * f + t.size * 10, this.qbuf);
      for (let k = 0; k < n; k++) {
        const i = this.qbuf[k];
        if (!this.eAlive[i]) continue;
        const r = this.spotRange(this.eKind[i]) * f + t.size * 10;
        if ((this.eX[i] - t.x) ** 2 + (this.eY[i] - t.y) ** 2 <= r * r) {
          t.knownT = KNOWN_T;
          break;
        }
      }
    }
    for (let u = 0; u < MAX_UNITS; u++) {
      if (!this.uAlive[u] || this.uAir[u] || !this.unitHidden(u)) continue;
      // a hidden unit is only found close up
      const n = this.hash.query(this.uX[u], this.uY[u], 80, this.qbuf);
      for (let k = 0; k < n; k++) {
        const i = this.qbuf[k];
        if (!this.eAlive[i]) continue;
        const r = this.spotRange(this.eKind[i]) * 0.3;
        if ((this.eX[i] - this.uX[u]) ** 2 + (this.eY[i] - this.uY[u]) ** 2 <= r * r) {
          this.uKnownT[u] = KNOWN_T * 0.5;
          break;
        }
      }
    }
  }

  /** What patching it up (or rebuilding the rubble) costs right now; 0 if it needs nothing. */
  repairCost(t: Tower): number {
    const max = this.maxHp(t);
    if (!max || t.hp >= max) return 0;
    return Math.max(1, Math.ceil(t.spent * REPAIR_SHARE * (1 - t.hp / max)));
  }

  /** Repairs a damaged emplacement, or rebuilds a destroyed one if nothing stands in the rubble. */
  repair(t: Tower): boolean {
    const cost = this.repairCost(t);
    if (!cost || this.money < cost) return false;
    if (t.wreck) {
      const def = TOWERS[t.type];
      const reroutes = !def.walkable && !t.open;
      if (reroutes && this.wallStatus(this.cellsOf(t)) !== 'ok') return false;
      t.wreck = false;
      this.setFootprint(t, t.id);
      if (reroutes) for (let k = 0; k < this.fields.length; k++) this.fields[k].copyFrom(this.scratch[k]);
      t.charge = TOWERS[t.type].levels[t.level].charge ?? 0;
      this.towerVersion++;
      this.burst(t.x, t.y, 0x9a8f78, t.size * 4, FX_SMOKE, 0);
      this.ev(EV_BUILD, t.x, t.y, t.type);
    } else {
      this.burst(t.x, t.y, 0xffe28a, 8, FX_SPARK, 1);
      this.ev(EV_UPGRADE, t.x, t.y, t.level);
    }
    this.money -= cost;
    t.hp = this.maxHp(t);
    t.supp = 0;
    return true;
  }

  /** The emplacement is knocked out: it becomes rubble that units can climb through (slowly). */
  private wreckTower(t: Tower): void {
    t.hp = 0;
    t.wreck = true;
    t.supp = 0;
    t.beam = -1;
    t.firing = 0;
    this.setFootprint(t, t.id);
    for (let d = this.drones.length - 1; d >= 0; d--) if (this.drones[d].hive === t) this.drones.splice(d, 1);
    for (const f of this.fields) f.compute(this.blocked);
    this.towerVersion++;
    this.explosion(t.x, t.y, 1.2 + t.size * 0.5, 4);
    for (let k = 0; k < 10; k++) this.fx(FX_DEBRIS, 0, t.x, t.y, this.vr.range(-110, 110), this.vr.range(-110, 110), 0.9, 4, 3, 1, 0x7a6a50, 3, 8);
    this.ev(EV_WRECK, t.x, t.y, t.type);
  }

  /**
   * A shot from the attackers lands on a defender: the same rule as our guns against their armour
   * (penetration against fortification; blasts and bombs from above find the open top). The crew is
   * suppressed either way; concrete keeps most of that off.
   */
  private hitDefender(id: number, dmg: number, pen: number, supp: number, top: boolean, sx = 0, sy = 0): void {
    if (id <= -UNIT_ID0) {
      this.hitUnit(-id - UNIT_ID0, dmg, pen, supp, top, sx, sy);
      return;
    }
    if (id === -1) {
      const h = this.hero;
      if (!h || h.downT > 0) return;
      h.hp -= dmg;
      if (h.hp <= 0) {
        // wounded: carried back to the rear, back in the fight later
        h.hp = 0;
        h.downT = HERO_DOWN;
        h.path = [];
        h.rallyT = 0;
        this.burst(h.x, h.y, 0xd04a3a, 8, FX_GLOW, 1);
        this.ev(EV_DOWN, h.x, h.y);
      }
      return;
    }
    const t = this.towerById.get(id);
    if (!t || t.wreck || t.hp <= 0) return;
    let fort = this.fortOf(t);
    if (top) fort *= 0.5;
    const r = fort > 0 ? pen / fort : 9;
    const a = r >= 1 ? dmg : r < 0.7 ? 0 : dmg * 0.25 * ((r - 0.7) / 0.3);
    t.supp = Math.min(1, t.supp + supp * (fort >= 60 ? 0.25 : 1));
    if (a <= 0) return;
    t.hp -= a;
    if (t.hp <= 0) this.wreckTower(t);
  }

  /** Where defender `id` stands (the commander or a tower), or null if it's gone or can't be shot at. */
  private defenderAt(id: number): Tower | null {
    if (id === -1) return this.hero && this.hero.downT <= 0 ? this.hero.src : null;
    if (id <= -UNIT_ID0) {
      const u = -id - UNIT_ID0;
      if (u >= MAX_UNITS || !this.uAlive[u]) return null;
      const a = this.aimProxy;
      a.id = id;
      a.x = this.uX[u];
      a.y = this.uY[u];
      return a;
    }
    const t = this.towerById.get(id);
    return t && !t.wreck && t.hp > 0 ? t : null;
  }

  /**
   * The defender attacker `i` shoots at: within range, the most threatening. Tanks go for the guns
   * that can kill them, infantry for the machine guns pinning them down, snipers for the officer.
   */
  private pickDefender(i: number, def: EnemyDef, g: EnemyGun): number {
    const x = this.eX[i];
    const y = this.eY[i];
    const r2 = g.range * g.range;
    let best = 0;
    let bestScore = -Infinity;
    for (const t of this.towers) {
      if (t.wreck || t.hp <= 0 || g.air || this.towerHidden(t)) continue;
      const d2 = (t.x - x) ** 2 + (t.y - y) ** 2;
      const reach = g.range + t.size * TILE * 0.5;
      if (d2 > reach * reach) continue;
      const lv = TOWERS[t.type].levels[t.level];
      let s = -Math.sqrt(d2);
      if (g.fx === 'tank') s += (lv.pen ?? 0) >= 40 ? 90 : 0;
      else if (def.inf) s += lv.supp ? 50 : 0;
      if (g.fx === 'rocket') s += t.size * 20;
      if (s > bestScore) {
        bestScore = s;
        best = t.id;
      }
    }
    for (let u = 0; u < MAX_UNITS; u++) {
      if (!this.uAlive[u] || (this.uAir[u] === 1) !== !!g.air || this.unitHidden(u)) continue;
      const d2 = (this.uX[u] - x) ** 2 + (this.uY[u] - y) ** 2;
      if (d2 > r2) continue;
      const ud = UNITS[this.uKind[u]];
      let s = -Math.sqrt(d2);
      if (g.fx === 'tank') s += ud.arm ? 110 : 0;
      else if (def.inf) s += ud.inf ? 40 : 0;
      if (s > bestScore) {
        bestScore = s;
        best = -u - UNIT_ID0;
      }
    }
    const h = this.hero;
    if (h && h.downT <= 0 && !g.air) {
      const d2 = (h.x - x) ** 2 + (h.y - y) ** 2;
      if (d2 <= r2) {
        const s = -Math.sqrt(d2) + (def.stealth ? 200 : def.inf ? 30 : 0);
        if (s > bestScore) best = -1;
      }
    }
    return best;
  }

  /**
   * WW2: attacker i fires back. It picks a defender every few ticks; tanks halt to aim (returns true
   * while halted), infantry fire on the move and less often while suppressed.
   */
  private enemyFire(i: number, def: EnemyDef, g: EnemyGun): boolean {
    if (this.eGunCd[i] > 0) this.eGunCd[i] -= DT * (def.inf ? 1 - 0.6 * this.eSupp[i] : 1);
    if (this.eSmoked[i] && this.eWall[i] <= 0) {
      // smoke blinds both ways: nobody inside picks a target outside
      this.eAimT[i] = 0;
      return false;
    }
    if (this.eWall[i] > 0 && this.eAimT[i] <= 0) this.eTgt[i] = this.eWall[i]; // breaking through
    else if ((this.ticks + i) % 12 === 0 && this.eAimT[i] <= 0) this.eTgt[i] = this.pickDefender(i, def, g);
    const id = this.eTgt[i];
    if (!id) return false;
    const t = this.defenderAt(id);
    if (!t) {
      this.eTgt[i] = 0;
      this.eAimT[i] = 0;
      return false;
    }
    if (this.eAimT[i] > 0) {
      // halted: the tank swings its front (its thickest armour) towards the target
      if (def.arm) this.eAng[i] += Math.max(-1.4 * DT, Math.min(1.4 * DT, angleDiff(this.eAng[i], Math.atan2(t.y - this.eY[i], t.x - this.eX[i]))));
      if ((this.eAimT[i] -= DT) <= 0) this.enemyShot(i, def, g, t);
      return true;
    }
    if (this.eGunCd[i] > 0) return false;
    const reach = g.range + t.size * TILE * 0.5 + 8;
    if ((t.x - this.eX[i]) ** 2 + (t.y - this.eY[i]) ** 2 > reach * reach) {
      this.eTgt[i] = 0;
      return false;
    }
    if (g.halt && !this.eAir[i]) {
      this.eAimT[i] = g.halt;
      return true;
    }
    this.enemyShot(i, def, g, t);
    return false;
  }

  private enemyShot(i: number, def: EnemyDef, g: EnemyGun, t: Tower): void {
    this.eGunCd[i] = (1 / g.rate) * this.rng.range(0.85, 1.15);
    const air = this.eAir[i] === 1;
    const x = this.eX[i];
    const y = this.eY[i];
    const z = air ? AIR_Z : def.inf ? 6 : 10;
    // aim somewhere on the emplacement, not always its centre
    const spread = t.size * TILE * 0.3;
    const tx = t.x + this.rng.range(-spread, spread);
    const ty = t.y + this.rng.range(-spread, spread);
    const dmg = g.dmg * (0.6 + 0.4 * this.hpMult);
    if (g.salvo) {
      // a ripple of rockets off the rails, landing scattered around the target a few seconds later
      for (let k = 0; k < g.salvo && this.rkCount < MAX_ROCKETS; k++) {
        const r = this.rkCount++;
        const a = this.rng.next() * TWO_PI;
        const d = Math.sqrt(this.rng.next()) * 75;
        this.rkSx[r] = x;
        this.rkSy[r] = y;
        this.rkTx[r] = tx + Math.cos(a) * d;
        this.rkTy[r] = ty + Math.sin(a) * d;
        this.rkWait[r] = k * 0.16;
        this.rkT[r] = this.rkT0[r] = 1.4 + Math.hypot(tx - x, ty - y) / 400;
        this.rkDmg[r] = dmg;
        this.rkShell[r] = 0;
      }
      for (let k = 0; k < 10; k++) this.fx(FX_SMOKE, 0, x, y, this.vr.range(-50, 50), this.vr.range(-50, 50), 2, 8, 30, 0.5, 0xb8b0a0, 1.5, 6);
      this.ev(EV_ESHOT, x, y, ENEMY_FX.indexOf(g.fx));
      return;
    }
    const top = air;
    this.hitDefender(t.id, dmg, g.pen, g.supp, top, x, y);
    if (g.splash) {
      for (let u = 0; u < MAX_UNITS; u++) {
        if (!this.uAlive[u] || this.uAir[u] || -u - UNIT_ID0 === t.id) continue;
        if ((this.uX[u] - tx) ** 2 + (this.uY[u] - ty) ** 2 <= g.splash * g.splash) this.hitUnit(u, dmg * 0.5, g.pen * 0.6, g.supp * 0.5, true, x, y);
      }
      // HE: whatever stands next to the impact gets a share
      for (const o of this.towers) {
        if (o === t || o.wreck || o.hp <= 0) continue;
        const r = g.splash + o.size * TILE * 0.5;
        if ((o.x - tx) ** 2 + (o.y - ty) ** 2 <= r * r) this.hitDefender(o.id, dmg * 0.5, g.pen * 0.6, g.supp * 0.5, true);
      }
      const h = this.hero;
      if (t.id !== -1 && h && (h.x - tx) ** 2 + (h.y - ty) ** 2 <= g.splash * g.splash * 2) this.hitDefender(-1, dmg * 0.5, 0, 0, true);
    }
    // cosmetic: muzzle flash, tracer, impact
    const ang = Math.atan2(ty - y, tx - x);
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const big = g.fx === 'tank';
    if (g.fx === 'satchel') {
      // a satchel charge thrown against the wall
      this.explosion(tx, ty, 1.3, 4);
      return;
    }
    this.fx(FX_GLOW, 1, x + ca * 8, y + sa * 8, 0, 0, 0.07, big ? 16 : 6, big ? 6 : 2, 0.9, 0xffd890, 0, z);
    if (g.fx === 'rifle') this.streak(x, y, z, tx, ty, 8, 0.1, 0xfff0c0, 0.8);
    else if (g.fx === 'rocket') this.streak(x, y, z, tx, ty, 4, 0.3, 0xffb060, 1.6);
    else this.streak(x, y, z, tx, ty, 8, big ? 0.12 : 0.06, big ? 0xffe0a0 : 0xffd070, big ? 2 : 1);
    if (big || g.fx === 'rocket') {
      this.explosion(tx, ty, g.splash ? 0.5 + g.splash / 60 : 0.4, 4);
      for (let k = 0; k < 4; k++) this.fx(FX_SMOKE, 0, x + ca * 12, y + sa * 12, this.vr.range(-30, 30), this.vr.range(-30, 30), 0.8, 6, 18, 0.45, 0xa8a49a, 3, z);
    } else if (this.vr.next() < 0.5) {
      this.fx(FX_SPARK, 1, tx, ty, this.vr.range(-60, 60), this.vr.range(-60, 60), 0.15, 3, 1, 1, 0xffe0a0, 4, 8);
    }
    this.ev(EV_ESHOT, x, y, ENEMY_FX.indexOf(g.fx));
  }

  sell(t: Tower): void {
    this.money += this.sellValue(t);
    const i = this.towers.indexOf(t);
    if (i >= 0) this.towers.splice(i, 1);
    this.towerById.delete(t.id);
    this.setFootprint(t, -1);
    for (let d = this.drones.length - 1; d >= 0; d--) if (this.drones[d].hive === t) this.drones.splice(d, 1);
    for (const f of this.fields) f.compute(this.blocked);
    this.towerVersion++;
    this.burst(t.x, t.y, 0x8a8170, 12, FX_SMOKE, 0);
    this.ev(EV_SELL, t.x, t.y);
  }

  /** Opens or closes a gate. Closing is refused if it would trap units or seal a route. */
  toggleGate(t: Tower): PlaceStatus {
    if (t.kind !== 'gate') return 'invalid';
    const cells = this.cellsOf(t);
    if (t.open) {
      for (const i of cells) this.blocked[i] = 0;
      const status = this.wallStatus(cells);
      if (status !== 'ok') return status;
      t.open = false;
      for (const i of cells) this.blocked[i] = 1;
      for (let k = 0; k < this.fields.length; k++) this.fields[k].copyFrom(this.scratch[k]);
    } else {
      t.open = true;
      for (const i of cells) this.blocked[i] = 0;
      for (const f of this.fields) f.compute(this.blocked);
    }
    this.towerVersion++;
    this.burst(t.x, t.y, 0xe0b040, 6, FX_SPARK, 1);
    return 'ok';
  }

  /** Superweapon readiness, 0..1. */
  chargeLevel(t: Tower): number {
    const total = TOWERS[t.type].levels[t.level].charge ?? 0;
    return total ? 1 - t.charge / total : 1;
  }

  /** Fires a charged orbital laser or nuke at a world point. */
  fireSuper(t: Tower, x: number, y: number): boolean {
    const lv = TOWERS[t.type].levels[t.level];
    if (!TOWERS[t.type].manual || t.charge > 0) return false;
    x = Math.min(MAP_W, Math.max(0, x));
    y = Math.min(MAP_H, Math.max(0, y));
    t.charge = lv.charge ?? 0;
    this.ev(EV_SHOT, t.x, t.y, t.type);
    if (t.kind === 'airfield') {
      // a pair of Fw 190s takes off and patrols the point
      const kind = UNITS.findIndex((d) => d.from === 'airfield');
      for (let k = 0; k < 2; k++) {
        const u = this.spawnUnit(kind, t.x + (k ? 12 : -12), t.y, -1);
        if (u < 0) break;
        this.uPostX[u] = x;
        this.uPostY[u] = y;
        this.uLife[u] = 25;
        this.uAng[u] = Math.atan2(y - t.y, x - t.x);
      }
      return true;
    }
    if (t.kind === 'stuka') {
      // three Ju 87s dive one after another along the line from the airfield, bombs on the target
      const d = Math.hypot(x - t.x, y - t.y) || 1;
      const ux = (x - t.x) / d;
      const uy = (y - t.y) / d;
      for (let k = 0; k < 3; k++) {
        const off = (k - 1) * 22;
        const bx = x + ux * off - uy * this.rng.range(-12, 12);
        const by = y + uy * off + ux * this.rng.range(-12, 12);
        this.strikes.push({ x: bx, y: by, t: 1.6 + k * 0.45, dmg: lv.damage * t.dmgMult, r: lv.splash ?? 48, src: t, pen: lv.pen ?? 70 });
      }
      this.streak(x - ux * 500, y - uy * 500, 260, x + ux * 300, y + uy * 300, 40, 2.6, 0xc8ccd0, 2);
      return true;
    }
    if (t.kind === 'orbital') {
      this.addZone(Z_ORBITAL, x, y, lv.splash ?? 30, lv.duration ?? 4, lv.damage * t.dmgMult, 0, false, t);
    } else {
      const d = Math.hypot(x - t.x, y - t.y);
      const p = this.spawnProjectile(P_NUKE, t.x, t.y, (x - t.x) / (d || 1), (y - t.y) / (d || 1), Math.max(d / 1.4, 260), lv.damage * t.dmgMult, lv.splash ?? 150, 1, -1, t, Math.max(1.4, d / 260));
      if (p >= 0) {
        this.pTx[p] = x;
        this.pTy[p] = y;
        this.pVx[p] = (x - t.x) / this.pTtl[p];
        this.pVy[p] = (y - t.y) / this.pTtl[p];
      }
      for (let k = 0; k < 10; k++) this.fx(FX_SMOKE, 0, t.x, t.y, this.vr.range(-60, 60), this.vr.range(-60, 60), 1.2, 10, 40, 0.6, 0xb0aca0, 2, 6);
    }
    return true;
  }

  /** Damage, range and rate after auras and combos. */
  stats(t: Tower): TowerStats {
    this.refreshAuras();
    const lv = TOWERS[t.type].levels[t.level];
    return { damage: lv.damage * t.dmgMult, range: lv.range * t.rangeMult, rate: lv.rate * t.rateMult };
  }

  /** Rebuilds aura grids, tower buffs and combos after the set of towers changed. */
  private refreshAuras(): void {
    if (this.auraVersion === this.towerVersion) return;
    this.auraVersion = this.towerVersion;
    this.radarGrid.fill(0);
    this.jamGrid.fill(0);
    this.salvageGrid.fill(0);
    this.tarGrid.set(this.groundSlow);
    this.wireGrid.fill(1);
    this.spikeGrid.fill(0);
    this.spikeSrc.fill(null);
    const ballistics = 1 + 0.05 * perk(this.config, 'ballistics');
    for (const t of this.towers) {
      t.rangeMult = t.rateMult = t.airBonus = 1;
      t.dmgMult = ballistics;
      t.combos.length = 0;
    }
    const cover = (t: Tower, r: number, fn: (cell: number) => void) => {
      const c0 = Math.max(0, Math.floor((t.x - r) / TILE));
      const c1 = Math.min(COLS - 1, Math.floor((t.x + r) / TILE));
      const r0 = Math.max(0, Math.floor((t.y - r) / TILE));
      const r1 = Math.min(ROWS - 1, Math.floor((t.y + r) / TILE));
      for (let row = r0; row <= r1; row++) {
        for (let col = c0; col <= c1; col++) {
          const dx = (col + 0.5) * TILE - t.x;
          const dy = (row + 0.5) * TILE - t.y;
          if (dx * dx + dy * dy <= r * r) fn(row * COLS + col);
        }
      }
    };
    for (const t of this.towers) {
      const lv = TOWERS[t.type].levels[t.level];
      const buff = lv.buff ?? 0;
      if (t.wreck) {
        // climbing through rubble
        for (const c of this.cellsOf(t)) this.tarGrid[c] = Math.min(this.tarGrid[c], 0.55);
        continue;
      }
      switch (t.kind) {
        case 'radar':
          cover(t, lv.range, (c) => (this.radarGrid[c] = 1));
          for (const o of this.towers) if (Math.hypot(o.x - t.x, o.y - t.y) <= lv.range) o.rangeMult = Math.max(o.rangeMult, 1 + buff);
          break;
        case 'command':
          for (const o of this.towers) if (o !== t && Math.hypot(o.x - t.x, o.y - t.y) <= lv.range) o.rateMult = Math.max(o.rateMult, 1 + buff);
          break;
        case 'jammer':
          cover(t, lv.range, (c) => (this.jamGrid[c] = Math.max(this.jamGrid[c], buff)));
          break;
        case 'salvage':
          cover(t, lv.range, (c) => (this.salvageGrid[c] = Math.max(this.salvageGrid[c], buff)));
          break;
        case 'tar':
          for (const c of this.cellsOf(t)) this.tarGrid[c] = Math.min(this.tarGrid[c], lv.slow ?? 1);
          break;
        case 'wire':
          for (const c of this.cellsOf(t)) this.wireGrid[c] = Math.min(this.wireGrid[c], lv.slow ?? 1);
          break;
        case 'spikes':
          for (const c of this.cellsOf(t)) {
            this.spikeGrid[c] = lv.damage;
            this.spikeSrc[c] = t;
          }
          break;
      }
    }
    // combos: look at the ring of cells around each footprint for a partner
    for (const t of this.towers) {
      const seen = new Set<number>();
      for (let row = t.row - 1; row <= t.row + t.size; row++) {
        for (let col = t.col - 1; col <= t.col + t.size; col++) {
          if (col < 0 || row < 0 || col >= COLS || row >= ROWS) continue;
          const id = this.towerAt[row * COLS + col];
          if (id < 0 || id === t.id || seen.has(id)) continue;
          seen.add(id);
          const o = this.towerById.get(id)!;
          if (t.wreck || o.wreck) continue;
          for (const c of COMBOS) {
            if (!((c.a === t.kind && c.b === o.kind) || (c.b === t.kind && c.a === o.kind))) continue;
            if (t.combos.includes(c.name)) continue;
            t.combos.push(c.name);
            t.dmgMult *= c.dmg ?? 1;
            t.rateMult *= c.rate ?? 1;
            t.rangeMult *= c.range ?? 1;
            t.airBonus *= c.air ?? 1;
          }
        }
      }
    }
  }

  get spawning(): boolean {
    return this.spawners.length > 0;
  }

  get canCallWave(): boolean {
    return !this.gameOver && (this.endless || this.wave < TOTAL_WAVES);
  }

  /** Money awarded for calling the next wave now. */
  get earlyBonus(): number {
    return this.wave === 0 ? 0 : Math.floor(this.nextWaveTimer * 2);
  }

  /** What the supply depots will pay at the next wave start. */
  get depotIncome(): number {
    let sum = 0;
    for (const t of this.towers) {
      if (t.kind !== 'depot' || t.wreck) continue;
      const lv = TOWERS[t.type].levels[t.level];
      sum += (lv.income ?? 0) + Math.min(lv.cap ?? 0, Math.floor(this.money * (lv.interest ?? 0)));
    }
    return sum;
  }

  startNextWave(): void {
    if (!this.canCallWave) return;
    this.money += this.earlyBonus;
    for (let k = 0; k < 3; k++) this.items[k] = Math.min(this.itemMax, this.items[k] + (this.wave > 0 ? 1 : 0));
    if (this.wave > 0) {
      this.money += Math.round((WAVE_BONUS[0] + WAVE_BONUS[1] * this.wave) * this.routeFactor) + this.depotIncome;
      for (const t of this.towers) if (t.kind === 'depot' && !t.wreck) this.burst(t.x, t.y, 0xffd84a, 10, FX_GLOW, 1);
    }
    this.wave++;
    this.ev(EV_WAVE, 0, 0, this.wave);
    // before an armoured assault, the guns prepare the ground
    if (WW2 && this.wave >= 6 && (this.wave % 4 === 3 || this.wave % 10 === 0)) this.barrage(this.wave);
    const groups = this.waveGroups(this.wave);
    let dur = 0;
    for (const g of groups) dur = Math.max(dur, g.delay + g.count * g.interval);
    this.spawners.push({
      wave: this.wave, groups,
      left: new Int32Array(groups.map((g) => g.count)),
      timer: new Float32Array(groups.length),
      t: 0,
    });
    this.nextWaveTimer = dur + WAVE_GAP;
  }

  /** Sandbox: build a serpentine maze of maxed towers and flood it with enemies. */
  stress(count: number): void {
    const pool = TOWERS.map((d, i) => (d.size === 2 && !d.walkable && !d.manual && d.kind !== 'gate' ? i : -1)).filter((i) => i >= 0);
    let wall = 0;
    for (let c = 5; c + 2 < COLS - 3; c += 4, wall++) {
      const gapTop = wall % 2 === 0;
      for (let r = 0; r + 2 <= ROWS; r += 2) {
        if (gapTop ? r < 4 : r >= ROWS - 4) continue;
        const t = this.place(pool[this.rng.int(pool.length)], c, r, true);
        if (t) t.level = 2;
      }
    }
    this.towerVersion++;
    const kinds = ENEMIES.map((e, k) => (e.boss ? -1 : k)).filter((k) => k >= 0);
    const groups: SpawnGroup[] = kinds.map((kind) => ({
      kind, count: Math.floor(count / kinds.length), interval: 6 / (count / kinds.length), delay: 0,
    }));
    this.spawners.push({
      wave: Math.max(this.wave, 1) + 12, groups,
      left: new Int32Array(groups.map((g) => g.count)),
      timer: new Float32Array(groups.length), t: 0,
    });
  }


  // ============================================================ hero commander

  private spawnHero(level: number): void {
    // a few cells in from the first exit: the last line of defence
    const route = this.map.routes[0];
    const f = this.fields[0];
    const ex = route.airTo[0];
    const ey = route.airTo[1];
    let cell = route.exit[route.exit.length >> 1];
    let bestD = Infinity;
    for (let i = 0; i < f.dist.length; i++) {
      if (this.blocked[i] || f.dist[i] < 5 || f.dist[i] >= 7) continue;
      const d = (((i % COLS) + 0.5) * TILE - ex) ** 2 + ((((i / COLS) | 0) + 0.5) * TILE - ey) ** 2;
      if (d < bestD) {
        bestD = d;
        cell = i;
      }
    }
    const x = ((cell % COLS) + 0.5) * TILE;
    const y = (((cell / COLS) | 0) + 0.5) * TILE;
    const src: Tower = {
      id: -1, type: 0, kind: 'gun', level: 0, col: 0, row: 0, size: 1, x, y, cd: 0, angle: 0, prevAngle: 0, mode: 3,
      beam: -1, recoil: 0, spent: 0, kills: 0, damage: 0, open: false, charge: 0, spin: 0, heat: 0, firing: 0,
      rangeMult: 1, rateMult: 1, dmgMult: 1, airBonus: 1, combos: [], owner: 0, hp: 0, wreck: false, supp: 0, trainKind: -1, trainT: 0, seenT: 0, knownT: 0,
    };
    level = Math.min(HERO_MAX_LEVEL, level);
    this.hero = {
      x, y, px: x, py: y, ang: 0, pang: 0, path: [], level, xp: 0, cd: [0, 0, 0], fireCd: 0, rallyT: 0,
      hp: this.heroMaxHp(level), downT: 0, homeX: x, homeY: y, src,
    };
  }

  /** WW2: the commander's hit points at a level. */
  heroMaxHp(level = this.hero?.level ?? 1): number {
    return 90 + 15 * (level - 1);
  }

  /** XP needed to reach the next level. */
  heroNextXp(level: number): number {
    return Math.round(40 * Math.pow(level, 1.5));
  }

  heroRange(): number {
    return 110 + 4 * (this.hero?.level ?? 1);
  }

  heroDamage(): number {
    return 10 * (1 + 0.2 * ((this.hero?.level ?? 1) - 1));
  }

  /** Walk to a point: shortest path over walkable cells (4-way BFS). */
  private heroMove(x: number, y: number): boolean {
    const h = this.hero;
    if (!h || h.downT > 0) return false;
    const goal = Math.floor(y / TILE) * COLS + Math.floor(x / TILE);
    const start = Math.floor(h.y / TILE) * COLS + Math.floor(h.x / TILE);
    if (goal < 0 || goal >= this.blocked.length || this.blocked[goal]) return false;
    const prev = new Int32Array(COLS * ROWS).fill(-1);
    const queue = new Int32Array(COLS * ROWS);
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    prev[start] = start;
    while (head < tail && prev[goal] < 0) {
      const i = queue[head++];
      const c = i % COLS;
      for (const j of [c > 0 ? i - 1 : -1, c < COLS - 1 ? i + 1 : -1, i - COLS, i + COLS]) {
        if (j < 0 || j >= prev.length || prev[j] >= 0 || this.blocked[j]) continue;
        prev[j] = i;
        queue[tail++] = j;
      }
    }
    if (prev[goal] < 0) return false;
    const path: number[] = [];
    for (let i = goal; i !== start; i = prev[i]) path.push(i);
    h.path = path.reverse();
    return true;
  }

  private heroAbility(a: number, x: number, y: number): boolean {
    const h = this.hero;
    if (!h || h.downT > 0 || a < 0 || a > 2 || h.cd[a] > 0) return false;
    const power = 1 + 0.15 * (h.level - 1);
    if (a === 0) {
      // carpet bombing across the line from the hero to the target
      const dx = x - h.x;
      const dy = y - h.y;
      const d = Math.hypot(dx, dy) || 1;
      const px = -dy / d;
      const py = dx / d;
      for (let k = -3; k <= 3; k++) {
        this.strikes.push({ x: x + px * k * 26, y: y + py * k * 26, t: 0.9 + (k + 3) * 0.08, dmg: 140 * power * (1 + 0.1 * this.wave), r: 40, src: h.src, pen: 60 });
      }
      this.streak(x - px * 400, y - py * 400, 120, x + px * 400, y + py * 400, 120, 1.2, 0xc0c8d0, 2);
    } else if (a === 1) {
      h.rallyT = 8;
      this.fx(FX_RING, 1, h.x, h.y, 0, 0, 0.6, 10, 320, 0.8, 0xffd84a, 0, 0);
    } else {
      if (Math.hypot(x - h.x, y - h.y) > 260) return false;
      this.forEachInRange(x, y, 70, false, true, (i) => {
        this.eStunT[i] = 2.5;
      });
      this.explosion(x, y, 0.6, 4);
      this.fx(FX_RING, 1, x, y, 0, 0, 0.4, 10, 140, 1, 0xfff0a0, 0, 0);
      this.ev(EV_STATUS, x, y, 3);
    }
    h.cd[a] = HERO_ABILITIES[a].cd;
    this.ev(EV_ABILITY, x, y, a);
    return true;
  }

  private updateHero(): void {
    const h = this.hero;
    if (!h) return;
    h.px = h.x;
    h.py = h.y;
    h.pang = h.ang;
    for (let k = 0; k < 3; k++) if (h.cd[k] > 0) h.cd[k] = Math.max(0, h.cd[k] - DT);
    if (h.rallyT > 0) h.rallyT -= DT;
    if (h.downT > 0) {
      // wounded: back at the command post once patched up
      if ((h.downT -= DT) > 0) return;
      h.downT = 0;
      h.x = h.px = h.src.x = h.homeX;
      h.y = h.py = h.src.y = h.homeY;
      h.hp = this.heroMaxHp();
      this.fx(FX_RING, 1, h.x, h.y, 0, 0, 0.5, 6, 60, 1, 0xffd84a, 0, 0);
    }
    if (WW2) h.hp = Math.min(this.heroMaxHp(), h.hp + 1.5 * DT); // field dressing
    // walking
    if (h.path.length) {
      const next = h.path[0];
      if (this.blocked[next]) {
        // a wall went up in the way: re-plan to the same goal
        const goal = h.path[h.path.length - 1];
        h.path = [];
        this.heroMove(((goal % COLS) + 0.5) * TILE, (((goal / COLS) | 0) + 0.5) * TILE);
      } else {
        const tx = ((next % COLS) + 0.5) * TILE;
        const ty = (((next / COLS) | 0) + 0.5) * TILE;
        const dx = tx - h.x;
        const dy = ty - h.y;
        const d = Math.hypot(dx, dy);
        const step = 95 * DT;
        if (d <= step) {
          h.x = tx;
          h.y = ty;
          h.path.shift();
        } else {
          h.x += (dx / d) * step;
          h.y += (dy / d) * step;
        }
        h.ang += angleDiff(h.ang, Math.atan2(dy, dx)) * Math.min(1, 12 * DT);
      }
    }
    h.src.x = h.x;
    h.src.y = h.y;
    // shooting
    h.fireCd -= DT;
    const tgt = this.findTarget(h.x, h.y, this.heroRange(), true, true, 0);
    if (tgt < 0) return;
    if (!h.path.length) h.ang += angleDiff(h.ang, Math.atan2(this.eY[tgt] - h.y, this.eX[tgt] - h.x)) * Math.min(1, 14 * DT);
    if (h.fireCd > 0) return;
    h.fireCd = 1 / 3;
    const ca = Math.cos(h.ang);
    const sa = Math.sin(h.ang);
    this.spawnProjectile(P_BULLET, h.x + ca * 8, h.y + sa * 8, ca, sa, 900, this.heroDamage(), 0, 1, tgt, h.src, 1);
    this.fx(FX_GLOW, 1, h.x + ca * 9, h.y + sa * 9, 0, 0, 0.06, 8, 3, 0.9, 0xffe7a0, 0, 10);
    this.ev(EV_SHOT, h.x, h.y, 0);
  }

  private gainHeroXp(xp: number): void {
    const h = this.hero!;
    if (h.level >= HERO_MAX_LEVEL) return;
    h.xp += xp;
    while (h.level < HERO_MAX_LEVEL && h.xp >= this.heroNextXp(h.level)) {
      h.xp -= this.heroNextXp(h.level);
      h.level++;
      h.hp += 15;
      this.ev(EV_LEVEL, h.x, h.y, h.level);
      this.fx(FX_RING, 1, h.x, h.y, 0, 0, 0.5, 6, 60, 1, 0xffd84a, 0, 0);
    }
  }

  // ============================================================ tactical items

  private useItem(item: number, x: number, y: number): boolean {
    if (item < 0 || item > 2 || this.items[item] <= 0) return false;
    x = Math.min(MAP_W, Math.max(0, x));
    y = Math.min(MAP_H, Math.max(0, y));
    if (item === 0) {
      const dmg = 120 * (1 + 0.12 * this.wave);
      for (let k = 0; k < 8; k++) {
        const a = this.rng.next() * TWO_PI;
        const r = Math.sqrt(this.rng.next()) * 90;
        this.strikes.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, t: 0.6 + k * 0.18, dmg, r: 45, src: null, pen: 30 });
      }
    } else if (item === 1) {
      const mine = towerIndex('mine');
      let placed = 0;
      for (let tries = 0; tries < 40 && placed < 6; tries++) {
        const a = this.rng.next() * TWO_PI;
        const r = Math.sqrt(this.rng.next()) * 70;
        const t = this.place(mine, Math.floor((x + Math.cos(a) * r) / TILE), Math.floor((y + Math.sin(a) * r) / TILE), true);
        if (t) placed++;
      }
      if (!placed) return false;
    } else {
      this.money += 40 + 15 * this.wave;
      this.burst(x, y, 0xffd84a, 14, FX_GLOW, 1);
    }
    this.items[item]--;
    this.ev(EV_ITEM, x, y, item);
    return true;
  }

  private updateStrikes(): void {
    for (let k = this.strikes.length - 1; k >= 0; k--) {
      const st = this.strikes[k];
      if ((st.t -= DT) > 0) continue;
      this.splash(st.x, st.y, st.r, st.dmg, 1, 0, st.src, true, st.pen ?? -1);
      this.explosion(st.x, st.y, 1.4, 0);
      this.strikes.splice(k, 1);
    }
  }



  // ============================================================ WW2: enemy intelligence

  /** Rebuilds the breach fields: emplacements cost their strength to break through; obstacles without HP stay solid. */
  private refreshBreach(): void {
    this.breachVersion = this.towerVersion;
    for (let i = 0; i < this.blocked.length; i++) {
      this.breachBlocked[i] = this.blocked[i];
      this.breachCost[i] = this.moveCost[i];
    }
    for (const t of this.towers) {
      const max = this.maxHp(t);
      if (!max || t.wreck || TOWERS[t.type].walkable) continue;
      // the time it takes to shoot a way through under fire, as cells of walking: about a cell per HP,
      // far more for concrete that a 76 mm shell barely scratches
      const k = (max * (1 + this.fortOf(t) / 25)) / t.size;
      for (const c of this.cellsOf(t)) {
        this.breachBlocked[c] = 0;
        this.breachCost[c] = this.moveCost[c] + k;
      }
    }
    for (const f of this.breach) f.compute(this.breachBlocked, this.blocked);
  }

  /** Attackers that can break a wall: tanks with HE, sappers with satchel charges. */
  private canBreach(def: EnemyDef): boolean {
    // on Easy the attacker never thinks of it
    if (this.hpMult < 0.9) return false;
    return !def.air && !!def.gun && (def.gun.fx === 'tank' || def.gun.fx === 'satchel');
  }

  /**
   * The assault decision: when the maze makes the way round much longer than smashing through the
   * cheapest wall, a tank or sapper goes for the wall (and drops the idea if it gets stuck too long).
   */
  private thinkBreach(i: number, def: EnemyDef, cell: number): void {
    const r = this.eRoute[i];
    const around = this.fields[r].dist[cell];
    const through = this.breach[r].dist[cell];
    if (through === Infinity) {
      this.eBreach[i] = 0;
      return;
    }
    // the harder the game, the readier the enemy is to smash through instead of going round
    const slack = (def.gun!.fx === 'satchel' ? 10 : 50) / this.hpMult ** 2;
    if (!this.eBreach[i]) {
      if (around - through > slack) {
        this.eBreach[i] = 1;
        this.eBreachT[i] = 0;
      }
    } else if (around <= through + 2 || this.eBreachT[i] > 25) {
      this.eBreach[i] = 0;
      this.eWall[i] = 0;
    }
  }

  /** Removes a tower without paying for it (sappers lifting mines and cutting wire). */
  private demolish(t: Tower): void {
    const i = this.towers.indexOf(t);
    if (i >= 0) this.towers.splice(i, 1);
    this.towerById.delete(t.id);
    this.setFootprint(t, -1);
    for (const f of this.fields) f.compute(this.blocked);
    this.towerVersion++;
    this.burst(t.x, t.y, 0x8a8170, 8, FX_SMOKE, 0);
  }

  /** Sappers clear mines and wire they walk over, a second or so each. */
  private sapperWork(i: number): void {
    const c = Math.floor(this.eX[i] / TILE);
    const r = Math.floor(this.eY[i] / TILE);
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return;
    const id = this.towerAt[r * COLS + c];
    const t = id >= 0 ? this.towerById.get(id) : undefined;
    if (!t || (t.kind !== 'mine' && t.kind !== 'wire')) {
      this.eWork[i] = 0;
      return;
    }
    if ((this.eWork[i] += DT) >= 1.4) {
      this.eWork[i] = 0;
      this.demolish(t);
    }
  }

  /** A tank under anti-tank fire screens itself with smoke: guns can't pick targets inside it except point-blank. */
  private popSmoke(i: number): void {
    this.eSmokeUsed[i] = 1;
    if (this.smCount >= MAX_SMOKE) return;
    const k = this.smCount++;
    // the cloud drifts out ahead of the tank
    this.smX[k] = this.eX[i] + Math.cos(this.eAng[i]) * 14;
    this.smY[k] = this.eY[i] + Math.sin(this.eAng[i]) * 14;
    this.smT[k] = SMOKE_T;
    for (let n = 0; n < 6; n++) this.fx(FX_SMOKE, 0, this.smX[k], this.smY[k], this.vr.range(-50, 50), this.vr.range(-50, 50), 1.6, 10, 40, 0.8, 0xe8e8e0, 1.2, 6);
  }

  private updateSmoke(): void {
    for (let k = this.smCount - 1; k >= 0; k--) {
      if ((this.smT[k] -= DT) <= 0) {
        const last = --this.smCount;
        this.smX[k] = this.smX[last];
        this.smY[k] = this.smY[last];
        this.smT[k] = this.smT[last];
        continue;
      }
      if ((this.ticks + k * 5) % 8 === 0) {
        const a = this.vr.next() * TWO_PI;
        const r = this.vr.next() * SMOKE_R * 0.8;
        this.fx(FX_SMOKE, 0, this.smX[k] + Math.cos(a) * r, this.smY[k] + Math.sin(a) * r, this.vr.range(-8, 8), this.vr.range(-8, 8), 2.4, 18, 44, 0.55, 0xdcdcd4, 0.6, 8);
      }
    }
    // who is inside a cloud this tick (read by targeting)
    for (let n = 0; n < this.liveCount; n++) {
      const i = this.live[n];
      let inside = 0;
      for (let k = 0; k < this.smCount && !inside; k++) {
        if ((this.eX[i] - this.smX[k]) ** 2 + (this.eY[i] - this.smY[k]) ** 2 <= SMOKE_R * SMOKE_R) inside = 1;
      }
      this.eSmoked[i] = inside;
    }
  }

  /**
   * Artillery preparation before an armoured assault: shells on the positions the enemy already
   * knows about (anything not hidden), the most valuable first.
   */
  private barrage(n: number): void {
    const known = this.towers.filter((t) => !t.wreck && t.hp > 0 && !this.towerHidden(t)).sort((a, b) => b.spent - a.spent || a.id - b.id);
    if (!known.length) return;
    const shells = Math.min(MAX_ROCKETS - this.rkCount, 6 + Math.floor(n / 3));
    const from = this.map.routes[0].airFrom;
    const dmg = 38 * (0.6 + 0.4 * this.hpMult);
    for (let k = 0; k < shells; k++) {
      const t = known[Math.min(known.length - 1, Math.floor(this.rng.next() * this.rng.next() * known.length))];
      const r = this.rkCount++;
      const a = this.rng.next() * TWO_PI;
      const d = Math.sqrt(this.rng.next()) * 34;
      this.rkSx[r] = from[0];
      this.rkSy[r] = from[1];
      this.rkTx[r] = t.x + Math.cos(a) * d;
      this.rkTy[r] = t.y + Math.sin(a) * d;
      this.rkWait[r] = 2 + k * 0.35;
      this.rkT[r] = this.rkT0[r] = 1.6;
      this.rkDmg[r] = dmg;
      this.rkShell[r] = 1;
    }
    this.ev(EV_ESHOT, from[0], from[1], ENEMY_FX.indexOf('barrage'));
  }

  /**
   * Adaptive waves: the attacker brings what counters the defence it has seen. Many anti-tank guns
   * mean more infantry; many machine guns, more armour; no flak, aircraft.
   */
  private adapt(n: number, groups: SpawnGroup[]): SpawnGroup[] {
    let at = 0;
    let mg = 0;
    let aa = 0;
    let total = 0;
    for (const t of this.towers) {
      const d = TOWERS[t.type];
      if (t.wreck || !d.hitsGround && !d.hitsAir) continue;
      total++;
      const lv = d.levels[t.level];
      if (d.role === 'at') at++;
      else if (lv.supp && (d.role === 'gun' || d.role === 'bunker')) mg++;
      if (d.hitsAir && d.airMult >= 1) aa++;
    }
    if (total < 6) return groups;
    // a trade rather than a bonus: armour comes in place of infantry and the other way round
    const lean = (mg - at) / total;
    const arm = Math.min(1.4, Math.max(0.7, 1 + 0.6 * lean));
    const inf = Math.min(1.4, Math.max(0.7, 1 - 0.6 * lean));
    const out = groups.map((g) => {
      const e = ENEMIES[g.kind];
      const f = e.inf ? inf : !e.air && e.arm && e.arm[0] >= 40 ? arm : 1;
      return f === 1 ? g : { ...g, count: Math.max(1, Math.round(g.count * f)) };
    });
    if (n >= 6 && aa === 0) {
      const il2 = ENEMIES.findIndex((e) => e.air && e.gun && !e.gun.air);
      if (il2 >= 0) out.push({ kind: il2, count: 1 + Math.round(n * 0.15), interval: 1.5, delay: 4 });
    }
    return out;
  }

  // ============================================================ WW2: defender units

  /** Slot of the unit with this uid, or -1. */
  unitSlot(uid: number): number {
    for (let u = 0; u < MAX_UNITS; u++) if (this.uAlive[u] && this.uUid[u] === uid) return u;
    return -1;
  }

  /** Manpower: what the HQs and depots can field, and what is in use or in training. */
  get manpowerCap(): number {
    let n = 6;
    for (const t of this.towers) if (!t.wreck) n += t.kind === 'command' ? 4 : t.kind === 'depot' ? 2 : 0;
    return n;
  }

  get manpowerUsed(): number {
    let n = 0;
    for (let u = 0; u < MAX_UNITS; u++) if (this.uAlive[u]) n += UNITS[this.uKind[u]].manpower;
    for (const t of this.towers) if (t.trainKind >= 0) n += UNITS[t.trainKind].manpower;
    return n;
  }

  /** Why unit `kind` can't be trained at tower t right now ('' if it can). */
  trainBlock(t: Tower, kind: number): string {
    const d = UNITS[kind];
    if (!d || d.from !== t.kind || t.wreck) return 'invalid';
    if (t.trainKind >= 0) return 'busy';
    if (this.manpowerUsed + d.manpower > this.manpowerCap) return 'manpower';
    if (this.money < d.cost) return 'money';
    return '';
  }

  private train(t: Tower, kind: number): boolean {
    if (this.trainBlock(t, kind)) return false;
    const d = UNITS[kind];
    this.money -= d.cost;
    t.trainKind = kind;
    t.trainT = d.train;
    return true;
  }

  /** Is unit u hidden from the enemy: camouflaged or in ambush, standing still and not just fired? */
  unitHidden(u: number): boolean {
    const d = UNITS[this.uKind[u]];
    return (!!d.camo || this.uStance[u] === ST_AMBUSH) && this.uSeenT[u] <= 0 && this.uKnownT[u] <= 0 && this.uPathI[u] >= this.uPathLen[u];
  }

  private spawnUnit(kind: number, x: number, y: number, cell: number): number {
    let u = 0;
    while (u < MAX_UNITS && this.uAlive[u]) u++;
    if (u === MAX_UNITS) return -1;
    const d = UNITS[kind];
    this.uAlive[u] = 1;
    this.uUid[u] = this.nextUnitUid++;
    this.uKind[u] = kind;
    this.uAir[u] = d.air ? 1 : 0;
    this.uX[u] = this.uPx[u] = this.uPostX[u] = x;
    this.uY[u] = this.uPy[u] = this.uPostY[u] = y;
    this.uAng[u] = this.uPang[u] = -Math.PI / 2;
    this.uHp[u] = d.hp;
    this.uCd[u] = 0;
    this.uTgt[u] = -1;
    this.uStance[u] = ST_GUARD;
    this.uPathLen[u] = this.uPathI[u] = 0;
    this.uGoal[u] = d.air ? -1 : cell;
    this.uOrder[u] = 0;
    this.uSupp[u] = 0;
    this.uLife[u] = 0;
    this.uSeenT[u] = 0;
    this.uKnownT[u] = 0;
    this.uKills[u] = 0;
    this.uTask[u] = -1;
    this.unitVersion++;
    return u;
  }

  private killUnit(u: number): void {
    const d = UNITS[this.uKind[u]];
    this.uAlive[u] = 0;
    this.unitVersion++;
    if (d.arm || d.air) this.explosion(this.uX[u], this.uY[u], 1.4, d.air ? AIR_Z : 4);
    else this.burst(this.uX[u], this.uY[u], 0x8a3a2a, 5, FX_SMOKE, 0);
  }

  /** A shot at unit u from (sx, sy): armour by the side facing the shooter, as for our guns against theirs. */
  private hitUnit(u: number, dmg: number, pen: number, supp: number, top: boolean, sx: number, sy: number): void {
    if (!this.uAlive[u]) return;
    const d = UNITS[this.uKind[u]];
    let a = dmg;
    if (d.arm) {
      let armour: number;
      if (top) armour = d.arm[3];
      else {
        const rel = Math.abs(angleDiff(this.uAng[u], Math.atan2(sy - this.uY[u], sx - this.uX[u])));
        armour = rel < Math.PI / 4 ? d.arm[0] : rel > (Math.PI * 3) / 4 ? d.arm[2] : d.arm[1];
      }
      const r = armour > 0 ? pen / armour : 9;
      a = r >= 1 ? dmg : r < 0.7 ? 0 : dmg * 0.25 * ((r - 0.7) / 0.3);
      if (a <= 0 && dmg >= 20 && !top) this.fx(FX_SPARK, 1, this.uX[u], this.uY[u], this.vr.range(-120, 120), this.vr.range(-120, 120), 0.25, 6, 1, 1, 0xffe0a0, 4, 8);
    } else if (d.inf) {
      this.uSupp[u] = Math.min(1, this.uSupp[u] + supp);
      a *= 1 - 0.35 * this.uSupp[u];
    }
    if (a <= 0) return;
    this.uHp[u] -= a;
    if (this.uHp[u] <= 0) this.killUnit(u);
  }

  /**
   * Breadth-first path (4-way) from unit u to the first walkable cell inside the rectangle
   * [c0..c1]×[r0..r1] that is not inside the excluded one (a tower's own footprint). Writes the
   * path into the unit's buffer; returns false if no cell can be reached.
   */
  private unitPathTo(u: number, c0: number, r0: number, c1: number, r1: number, ex0 = -1, ey0 = -1, ex1 = -2, ey1 = -2): boolean {
    const start = Math.floor(this.uY[u] / TILE) * COLS + Math.floor(this.uX[u] / TILE);
    if (start < 0 || start >= COLS * ROWS) return false;
    const prev = this.bfsPrev;
    const q = this.bfsQ;
    prev.fill(-1);
    let head = 0;
    let tail = 0;
    q[tail++] = start;
    prev[start] = start;
    let goal = -1;
    const isGoal = (i: number) => {
      const c = i % COLS;
      const r = (i / COLS) | 0;
      return c >= c0 && c <= c1 && r >= r0 && r <= r1 && !(c >= ex0 && c <= ex1 && r >= ey0 && r <= ey1);
    };
    while (head < tail) {
      const i = q[head++];
      if (isGoal(i) && !this.blocked[i]) {
        goal = i;
        break;
      }
      const c = i % COLS;
      const n0 = c > 0 ? i - 1 : -1;
      const n1 = c < COLS - 1 ? i + 1 : -1;
      const n2 = i - COLS;
      const n3 = i + COLS;
      if (n0 >= 0 && prev[n0] < 0 && !this.blocked[n0]) { prev[n0] = i; q[tail++] = n0; }
      if (n1 >= 0 && prev[n1] < 0 && !this.blocked[n1]) { prev[n1] = i; q[tail++] = n1; }
      if (n2 >= 0 && prev[n2] < 0 && !this.blocked[n2]) { prev[n2] = i; q[tail++] = n2; }
      if (n3 < COLS * ROWS && prev[n3] < 0 && !this.blocked[n3]) { prev[n3] = i; q[tail++] = n3; }
    }
    if (goal < 0) return false;
    // walk back, then keep the first UNIT_PATH cells (the unit re-plans when it gets there)
    let len = 0;
    for (let i = goal; i !== start; i = prev[i]) len++;
    const n = Math.min(len, UNIT_PATH);
    const base = u * UNIT_PATH;
    let k = len;
    for (let i = goal; i !== start; i = prev[i]) {
      k--;
      if (k < n) this.uPath[base + k] = i;
    }
    this.uPathLen[u] = n;
    this.uPathI[u] = 0;
    this.uGoal[u] = goal;
    return true;
  }

  /** Walk to the cell under (x, y), or as near as it gets. */
  private unitGoto(u: number, x: number, y: number, near = 0): boolean {
    const c = Math.floor(x / TILE);
    const r = Math.floor(y / TILE);
    return this.unitPathTo(u, c - near, r - near, c + near, r + near);
  }

  /** Player order: the selected units walk to (x, y) in a loose formation, and guard there. */
  private unitMove(ids: number[], x: number, y: number): boolean {
    x = Math.min(MAP_W - 1, Math.max(0, x));
    y = Math.min(MAP_H - 1, Math.max(0, y));
    let k = 0;
    for (const id of ids) {
      const u = this.unitSlot(id);
      if (u < 0) continue;
      const side = Math.ceil(Math.sqrt(ids.length));
      const ox = ((k % side) - (side - 1) / 2) * 16;
      const oy = (Math.floor(k / side) - (side - 1) / 2) * 16;
      k++;
      this.uPostX[u] = x + ox;
      this.uPostY[u] = y + oy;
      if (this.uAir[u]) continue; // fighters patrol where they were sent
      if (this.unitGoto(u, x + ox, y + oy, 1)) {
        this.uOrder[u] = 1;
        this.uTask[u] = -1;
      }
    }
    return k > 0;
  }

  private updateUnits(): void {
    for (let u = 0; u < MAX_UNITS; u++) {
      if (!this.uAlive[u]) continue;
      this.uPx[u] = this.uX[u];
      this.uPy[u] = this.uY[u];
      this.uPang[u] = this.uAng[u];
      if (this.uSeenT[u] > 0) this.uSeenT[u] -= DT;
      if (this.uKnownT[u] > 0) this.uKnownT[u] -= DT;
      if (this.uSupp[u] > 0) this.uSupp[u] = Math.max(0, this.uSupp[u] - 0.45 * DT);
      if (this.uCd[u] > 0) this.uCd[u] -= DT * (1 - 0.5 * this.uSupp[u]);
      if (this.uAir[u]) this.updatePlane(u);
      else this.updateGroundUnit(u);
    }
  }

  /** Fw 190s: fly to the patrol point, circle it, dive on aircraft first, then soft ground targets. */
  private updatePlane(u: number): void {
    const d = UNITS[this.uKind[u]];
    const g = d.gun!;
    if ((this.uLife[u] -= DT) <= 0) {
      this.uAlive[u] = 0;
      this.unitVersion++;
      return;
    }
    const px = this.uPostX[u];
    const py = this.uPostY[u];
    let t = this.uTgt[u];
    if (t >= 0 && (!this.eAlive[t] || this.eUid[t] !== this.uTuid[u])) t = -1;
    if ((this.ticks + u) % 10 === 0) {
      t = this.findTarget(px, py, 200, true, false, 3);
      if (t < 0) {
        t = this.findTarget(px, py, 160, false, true, 3);
        if (t >= 0 && ENEMIES[this.eKind[t]].arm && ENEMIES[this.eKind[t]].arm![3] > g.pen) t = -1;
      }
      this.uTgt[u] = t;
      if (t >= 0) this.uTuid[u] = this.eUid[t];
    }
    const x = this.uX[u];
    const y = this.uY[u];
    let wx: number;
    let wy: number;
    if (t >= 0) {
      wx = this.eX[t];
      wy = this.eY[t];
    } else {
      const a = this.time * 1.4 + u;
      wx = px + Math.cos(a) * 70;
      wy = py + Math.sin(a) * 70;
    }
    const want = Math.atan2(wy - y, wx - x);
    const da = angleDiff(this.uAng[u], want);
    this.uAng[u] += Math.max(-3 * DT, Math.min(3 * DT, da));
    this.uX[u] = x + Math.cos(this.uAng[u]) * d.speed * DT;
    this.uY[u] = y + Math.sin(this.uAng[u]) * d.speed * DT;
    if (t >= 0 && this.uCd[u] <= 0 && Math.abs(da) < 0.35 && (wx - x) ** 2 + (wy - y) ** 2 <= g.range * g.range) this.unitFire(u, t, 1);
  }

  private updateGroundUnit(u: number): void {
    const d = UNITS[this.uKind[u]];
    const g = d.gun;
    const think = (this.ticks + u * 7) % 15 === 0;
    let moving = this.uPathI[u] < this.uPathLen[u];
    const x = this.uX[u];
    const y = this.uY[u];
    const stance = this.uStance[u];

    // ---- support roles: engineers repair, medics heal
    if ((d.repair || d.heal) && !this.uOrder[u] && think) this.supportTask(u, d.repair ? 'repair' : 'heal');
    if (d.repair && this.uTask[u] >= 0) this.doRepair(u, d.repair);
    if (d.heal) this.doHeal(u, d.heal);

    // ---- target
    let t = this.uTgt[u];
    if (t >= 0 && (!this.eAlive[t] || this.eUid[t] !== this.uTuid[u])) t = this.uTgt[u] = -1;
    if (g && think) {
      const look = stance === ST_HUNT ? HUNT_RANGE : stance === ST_GUARD ? g.range + GUARD_LEASH * 0.6 : g.range;
      t = this.findTarget(x, y, look, !!g.hitsAir, true, 3, -1, 0, g.pen, false);
      this.uTgt[u] = t;
      if (t >= 0) this.uTuid[u] = this.eUid[t];
      if (!this.uOrder[u] && this.uTask[u] < 0) {
        const tx = t >= 0 ? this.eX[t] : 0;
        const ty = t >= 0 ? this.eY[t] : 0;
        const d2 = t >= 0 ? (tx - x) ** 2 + (ty - y) ** 2 : 0;
        const leash = (tx - this.uPostX[u]) ** 2 + (ty - this.uPostY[u]) ** 2 <= (GUARD_LEASH + g.range * 0.5) ** 2;
        if (t >= 0 && d2 > (g.range * 0.85) ** 2 && (stance === ST_HUNT || (stance === ST_GUARD && leash))) {
          // close in to firing range
          this.unitGoto(u, tx, ty, Math.max(1, Math.floor((g.range * 0.6) / TILE)));
        } else if (t >= 0 && d2 <= g.range * g.range && g.still) {
          this.uPathLen[u] = this.uPathI[u]; // stop and set up
        } else if (t < 0 && stance === ST_GUARD && (x - this.uPostX[u]) ** 2 + (y - this.uPostY[u]) ** 2 > 14 * 14 && !moving) {
          this.unitGoto(u, this.uPostX[u], this.uPostY[u]);
        }
      }
      moving = this.uPathI[u] < this.uPathLen[u];
    }

    // ---- walk
    if (moving) {
      const base = u * UNIT_PATH;
      const next = this.uPath[base + this.uPathI[u]];
      if (this.blocked[next]) {
        // a wall went up in the way: plan again
        const goal = this.uGoal[u];
        this.uPathLen[u] = 0;
        if (goal >= 0) this.unitPathTo(u, goal % COLS, (goal / COLS) | 0, goal % COLS, (goal / COLS) | 0);
      } else {
        // a small offset per unit so a squad doesn't stack on one point
        const jx = ((this.uUid[u] * 37) % 9) - 4;
        const jy = ((this.uUid[u] * 53) % 9) - 4;
        const tx = ((next % COLS) + 0.5) * TILE + jx;
        const ty = (((next / COLS) | 0) + 0.5) * TILE + jy;
        const dx = tx - x;
        const dy = ty - y;
        const dist = Math.hypot(dx, dy);
        let sp = d.speed * this.groundSlow[Math.min(COLS * ROWS - 1, Math.max(0, Math.floor(y / TILE) * COLS + Math.floor(x / TILE)))];
        if (d.inf) sp *= 1 - 0.5 * this.uSupp[u];
        const step = sp * DT;
        if (dist <= step) {
          this.uX[u] = tx;
          this.uY[u] = ty;
          if (++this.uPathI[u] >= this.uPathLen[u]) {
            const goal = this.uGoal[u];
            const here = Math.floor(ty / TILE) * COLS + Math.floor(tx / TILE);
            if (goal >= 0 && goal !== here && this.uPathLen[u] === UNIT_PATH) this.unitPathTo(u, goal % COLS, (goal / COLS) | 0, goal % COLS, (goal / COLS) | 0);
            else this.uOrder[u] = 0;
          }
        } else {
          this.uX[u] = x + (dx / dist) * step;
          this.uY[u] = y + (dy / dist) * step;
        }
        const turn = d.arm ? 3 : 10;
        this.uAng[u] += Math.max(-turn * DT, Math.min(turn * DT, angleDiff(this.uAng[u], Math.atan2(dy, dx))));
        moving = this.uPathI[u] < this.uPathLen[u];
      }
    }

    // ---- fire
    if (!g || t < 0) return;
    const tx = this.eX[t];
    const ty = this.eY[t];
    const d2 = (tx - x) ** 2 + (ty - y) ** 2;
    if (d2 > g.range * g.range) return;
    if (g.still && moving) return;
    const want = Math.atan2(ty - y, tx - x);
    if (!moving) {
      // tanks turn their front (and gun) to the target; soldiers just face it
      const turn = d.arm ? 1.6 : 10;
      this.uAng[u] += Math.max(-turn * DT, Math.min(turn * DT, angleDiff(this.uAng[u], want)));
      if (d.arm && Math.abs(angleDiff(this.uAng[u], want)) > 0.25) return;
    }
    if (this.uCd[u] > 0) return;
    let bonus = 1;
    if (this.unitHidden(u)) {
      // an ambush waits for a close shot or one into the flank, and the first round counts double
      const e = ENEMIES[this.eKind[t]];
      const flank = !!e.arm && Math.abs(angleDiff(this.eAng[t], Math.atan2(y - ty, x - tx))) > Math.PI / 4;
      if (stance === ST_AMBUSH && !flank && d2 > (g.range * 0.6) ** 2) return;
      bonus = 1.5;
    }
    this.unitFire(u, t, bonus);
  }

  private unitFire(u: number, t: number, bonus: number): void {
    const d = UNITS[this.uKind[u]];
    const g = d.gun!;
    const x = this.uX[u];
    const y = this.uY[u];
    const tx = this.eX[t];
    const ty = this.eY[t];
    this.uCd[u] = 1 / g.rate;
    this.uSeenT[u] = d.camo ? 2.5 : 1.5;
    const src = this.unitSrc;
    src.x = x;
    src.y = y;
    this.proxyRange = g.range;
    this.proxySupp = g.supp ?? 0;
    const airMult = this.eAir[t] ? (g.hitsAir ? 1 : 0) : 1;
    if (airMult > 0 && this.damage(t, g.dmg * bonus * airMult, false, src, false, g.pen, false)) this.uKills[u]++;
    // cosmetic
    const z = this.uAir[u] ? AIR_Z : d.inf ? 6 : 10;
    const tz = this.eAir[t] ? AIR_Z + 6 : 6;
    const big = g.dmg >= 50;
    const ca = Math.cos(this.uAng[u]);
    const sa = Math.sin(this.uAng[u]);
    const r = d.radius;
    this.fx(FX_GLOW, 1, x + ca * r, y + sa * r, 0, 0, 0.07, big ? 16 : 6, big ? 6 : 2, 0.9, 0xffe7a0, 0, z);
    this.streak(x + ca * r, y + sa * r, z, tx, ty, tz, big ? 0.12 : 0.07, 0xffe0a0, big ? 2 : 0.9);
    if (big) for (let k = 0; k < 3; k++) this.fx(FX_SMOKE, 0, x + ca * r, y + sa * r, ca * 40 + this.vr.range(-20, 20), sa * 40 + this.vr.range(-20, 20), 0.8, 6, 18, 0.45, 0xa8a49a, 3, z);
    this.ev(EV_USHOT, x, y, this.uKind[u]);
  }

  /** Engineers and medics look for work near their post (Hold: only within reach). */
  private supportTask(u: number, what: 'repair' | 'heal'): void {
    const reach = this.uStance[u] === ST_HOLD ? 40 : this.uStance[u] === ST_HUNT ? HUNT_RANGE : GUARD_LEASH + 60;
    const ox = this.uStance[u] === ST_HUNT ? this.uX[u] : this.uPostX[u];
    const oy = this.uStance[u] === ST_HUNT ? this.uY[u] : this.uPostY[u];
    let best = -1;
    let bestD = reach * reach;
    if (what === 'repair') {
      if (this.uTask[u] >= 0) {
        const cur = this.towerById.get(this.uTask[u]);
        if (cur && cur.hp < this.maxHp(cur)) return;
      }
      let pick: Tower | null = null;
      for (const t of this.towers) {
        const max = this.maxHp(t);
        if (!max || t.hp >= max) continue;
        const d2 = (t.x - ox) ** 2 + (t.y - oy) ** 2;
        if (d2 < bestD) {
          bestD = d2;
          pick = t;
        }
      }
      this.uTask[u] = pick ? pick.id : -1;
      if (pick) this.unitPathTo(u, pick.col - 1, pick.row - 1, pick.col + pick.size, pick.row + pick.size, pick.col, pick.row, pick.col + pick.size - 1, pick.row + pick.size - 1);
      else if (this.uStance[u] !== ST_HUNT && (this.uX[u] - this.uPostX[u]) ** 2 + (this.uY[u] - this.uPostY[u]) ** 2 > 14 * 14 && this.uPathI[u] >= this.uPathLen[u]) this.unitGoto(u, this.uPostX[u], this.uPostY[u]);
      return;
    }
    for (let v = 0; v < MAX_UNITS; v++) {
      if (v === u || !this.uAlive[v] || !UNITS[this.uKind[v]].inf || this.uHp[v] >= UNITS[this.uKind[v]].hp) continue;
      const d2 = (this.uX[v] - ox) ** 2 + (this.uY[v] - oy) ** 2;
      if (d2 < bestD) {
        bestD = d2;
        best = v;
      }
    }
    const h = this.hero;
    if (h && h.downT <= 0 && h.hp < this.heroMaxHp() && (h.x - ox) ** 2 + (h.y - oy) ** 2 < bestD) best = -2;
    this.uTask[u] = best;
    if (best === -2) this.unitGoto(u, h!.x, h!.y, 1);
    else if (best >= 0) this.unitGoto(u, this.uX[best], this.uY[best], 1);
  }

  /** Engineers at work: hit points back, and rubble raised again once it is a third rebuilt. */
  private doRepair(u: number, rate: number): void {
    const t = this.towerById.get(this.uTask[u]);
    if (!t) {
      this.uTask[u] = -1;
      return;
    }
    const reach = t.size * TILE * 0.5 + 16;
    if ((t.x - this.uX[u]) ** 2 + (t.y - this.uY[u]) ** 2 > reach * reach) return;
    const max = this.maxHp(t);
    t.hp = Math.min(max, t.hp + rate * DT);
    if ((this.ticks + u) % 12 === 0) this.fx(FX_SPARK, 1, t.x + this.vr.range(-8, 8), t.y + this.vr.range(-8, 8), this.vr.range(-40, 40), -40, 0.3, 3, 1, 1, 0xffd070, 4, 8);
    if (t.wreck && t.hp >= max * 0.35) {
      const def = TOWERS[t.type];
      const wall = !def.walkable && !t.open;
      if (wall && this.wallStatus(this.cellsOf(t)) !== 'ok') return; // someone is standing in the rubble
      t.wreck = false;
      this.setFootprint(t, t.id);
      if (wall) for (let k = 0; k < this.fields.length; k++) this.fields[k].copyFrom(this.scratch[k]);
      this.towerVersion++;
      this.burst(t.x, t.y, 0x9a8f78, t.size * 4, FX_SMOKE, 0);
      this.ev(EV_BUILD, t.x, t.y, t.type);
    }
    if (t.hp >= max) this.uTask[u] = -1;
  }

  /** Medics patch up every soldier (and the commander) close by. */
  private doHeal(u: number, rate: number): void {
    const x = this.uX[u];
    const y = this.uY[u];
    let any = false;
    for (let v = 0; v < MAX_UNITS; v++) {
      if (!this.uAlive[v] || !UNITS[this.uKind[v]].inf) continue;
      const max = UNITS[this.uKind[v]].hp;
      if (this.uHp[v] >= max || (this.uX[v] - x) ** 2 + (this.uY[v] - y) ** 2 > 30 * 30) continue;
      this.uHp[v] = Math.min(max, this.uHp[v] + rate * DT);
      any = true;
    }
    const h = this.hero;
    if (h && h.downT <= 0 && h.hp < this.heroMaxHp() && (h.x - x) ** 2 + (h.y - y) ** 2 <= 30 * 30) {
      h.hp = Math.min(this.heroMaxHp(), h.hp + rate * DT);
      any = true;
    }
    if (any && (this.ticks + u) % 20 === 0) this.fx(FX_GLOW, 1, x, y, 0, -20, 0.4, 8, 4, 0.8, 0x6aff7a, 0, 10);
  }

  /** A barracks or motor pool finishing a unit: it walks out next to the building. */
  private finishTraining(t: Tower): void {
    if ((t.trainT -= DT) > 0) return;
    const kind = t.trainKind;
    // the nearest free cell around the footprint
    let cell = -1;
    for (let ring = 1; ring < 4 && cell < 0; ring++) {
      for (let r = t.row - ring; r <= t.row + t.size - 1 + ring && cell < 0; r++) {
        for (let c = t.col - ring; c <= t.col + t.size - 1 + ring; c++) {
          if (c < 0 || r < 0 || c >= COLS || r >= ROWS) continue;
          const i = r * COLS + c;
          if (!this.blocked[i] && this.map.grid[i] !== T_WATER) {
            cell = i;
            break;
          }
        }
      }
    }
    const u = cell < 0 ? -1 : this.spawnUnit(kind, ((cell % COLS) + 0.5) * TILE, (((cell / COLS) | 0) + 0.5) * TILE, cell);
    if (u < 0) {
      t.trainT = 1; // no room: try again shortly
      return;
    }
    t.trainKind = -1;
    t.trainT = 0;
    this.burst(this.uX[u], this.uY[u], 0x9a8f78, 6, FX_SMOKE, 0);
    this.ev(EV_BUILD, this.uX[u], this.uY[u], t.type);
  }

  /** WW2: Katyusha rockets come down on whatever stands around the impact (from above: open tops). */
  private updateRockets(): void {
    for (let r = this.rkCount - 1; r >= 0; r--) {
      if (this.rkWait[r] > 0) {
        if ((this.rkWait[r] -= DT) <= 0) this.fx(FX_GLOW, 1, this.rkSx[r], this.rkSy[r], 0, 0, 0.1, 14, 6, 0.9, 0xffb060, 0, 14);
        continue;
      }
      if ((this.rkT[r] -= DT) > 0) continue;
      const x = this.rkTx[r];
      const y = this.rkTy[r];
      const dmg = this.rkDmg[r];
      for (const t of this.towers) {
        if (t.wreck || t.hp <= 0) continue;
        const rr = 30 + t.size * TILE * 0.5;
        if ((t.x - x) ** 2 + (t.y - y) ** 2 <= rr * rr) this.hitDefender(t.id, dmg, 30, 0.35, true);
      }
      const h = this.hero;
      if (h && (h.x - x) ** 2 + (h.y - y) ** 2 <= 30 * 30) this.hitDefender(-1, dmg, 0, 0, true);
      for (let u = 0; u < MAX_UNITS; u++) {
        if (this.uAlive[u] && !this.uAir[u] && (this.uX[u] - x) ** 2 + (this.uY[u] - y) ** 2 <= 30 * 30) this.hitUnit(u, dmg, 30, 0.35, true, x, y);
      }
      this.explosion(x, y, 0.8, 0);
      // swap-remove
      const last = --this.rkCount;
      if (r !== last) {
        this.rkSx[r] = this.rkSx[last];
        this.rkSy[r] = this.rkSy[last];
        this.rkTx[r] = this.rkTx[last];
        this.rkTy[r] = this.rkTy[last];
        this.rkWait[r] = this.rkWait[last];
        this.rkT[r] = this.rkT[last];
        this.rkT0[r] = this.rkT0[last];
        this.rkDmg[r] = this.rkDmg[last];
        this.rkShell[r] = this.rkShell[last];
      }
    }
  }

  /** Strikes still on their way, for the renderer (incoming markers). */
  get pendingStrikes(): readonly { x: number; y: number; t: number }[] {
    return this.strikes;
  }

  // ============================================================ tick

  step(): void {
    if (this.gameOver) return;
    this.time += DT;
    this.ticks++;

    this.refreshAuras();
    this.updateSpawners();
    this.updateEnemies();
    this.hash.build(this.live, this.liveCount, this.eX, this.eY);
    this.updateTowers();
    if (WW2) {
      if (this.breachVersion !== this.towerVersion) this.refreshBreach();
      if (this.smCount) this.updateSmoke();
      this.updateUnits();
      if (this.ticks % 10 === 0) this.updateSpotting();
    }
    this.updateHero();
    this.updateStrikes();
    if (this.rkCount) this.updateRockets();
    this.updateZones();
    this.updateDrones();
    this.updateProjectiles();
    this.updateFx();
    this.updateBolts();
    this.updateStreaks();
    this.compactLive();

    if (!this.spawning && this.canCallWave && this.wave > 0) {
      this.nextWaveTimer -= DT;
      if (this.nextWaveTimer <= 0) {
        this.nextWaveTimer = 0;
        this.startNextWave();
      }
    }
    if (!this.endless && this.wave >= TOTAL_WAVES && !this.spawning && this.liveCount === 0 && !this.victory) {
      this.victory = true;
    }
  }

  private updateSpawners(): void {
    for (let s = this.spawners.length - 1; s >= 0; s--) {
      const sp = this.spawners[s];
      sp.t += DT;
      let pending = 0;
      for (let g = 0; g < sp.groups.length; g++) {
        if (sp.left[g] <= 0) continue;
        pending++;
        const grp = sp.groups[g];
        if (sp.t < grp.delay) continue;
        sp.timer[g] -= DT;
        while (sp.timer[g] <= 0 && sp.left[g] > 0) {
          this.spawnEnemy(grp.kind, sp.wave);
          sp.left[g]--;
          sp.timer[g] += grp.interval;
        }
      }
      if (pending === 0) this.spawners.splice(s, 1);
    }
  }

  spawnEnemy(kind: number, wave: number): number {
    if (this.eFreeTop === 0) return -1;
    const i = this.eFree[--this.eFreeTop];
    const def = ENEMIES[kind];
    const routeIdx = this.spawnCount++ % this.map.routes.length;
    const route = this.map.routes[routeIdx];
    this.eAlive[i] = 1;
    this.eUid[i] = this.nextUid++;
    this.eKind[i] = kind;
    this.eAir[i] = def.air ? 1 : 0;
    this.eRoute[i] = routeIdx;
    this.eMaxHp[i] = this.eHp[i] = def.hp * hpScale(wave) * this.hpMult;
    this.eMaxShield[i] = this.eShield[i] = (def.shield ?? 0) * this.eMaxHp[i];
    this.eShieldCd[i] = 0;
    this.eHealCd[i] = 1;
    this.eStealth[i] = def.stealth ? 1 : 0;
    this.eSeen[i] = 0;
    this.eJam[i] = 0;
    this.eBurnT[i] = this.eBurn[i] = 0;
    this.eBurnBy[i] = null;
    this.eShred[i] = this.eShredT[i] = 0;
    this.eChill[i] = this.eFrozenT[i] = 0;
    this.eHackT[i] = 0;
    this.eStunT[i] = 0;
    this.eSupp[i] = 0;
    this.eTgt[i] = 0;
    this.eAimT[i] = 0;
    this.eBreach[i] = 0;
    this.eWall[i] = 0;
    this.eBreachT[i] = 0;
    this.eSmokeUsed[i] = 0;
    this.eSmoked[i] = 0;
    this.eWork[i] = 0;
    this.eGunCd[i] = def.gun ? this.rng.range(0.3, 1) / def.gun.rate : 0;
    this.eSpeed[i] = def.speed * this.rng.range(0.94, 1.06);
    this.eReward[i] = Math.round(def.reward * rewardScale(wave) * this.bountyMult);
    this.eSlowT[i] = 0;
    this.eSlowF[i] = 1;
    this.eFlash[i] = 0;
    const [ix, iy] = route.inDir;
    const jitter = def.boss ? 0 : TILE * 0.3;
    this.eOx[i] = this.rng.range(-jitter, jitter);
    this.eOy[i] = this.rng.range(-jitter, jitter);
    let x: number;
    let y: number;
    if (def.air) {
      const side = this.rng.range(-30, 30);
      x = route.airFrom[0] - iy * side;
      y = route.airFrom[1] + ix * side;
    } else {
      const cell = route.entry[this.rng.int(route.entry.length)];
      this.eCell[i] = cell;
      x = ((cell % COLS) + 0.5) * TILE - ix * TILE * 1.5 + this.eOx[i];
      y = (((cell / COLS) | 0) + 0.5) * TILE - iy * TILE * 1.5 + this.eOy[i];
    }
    this.eX[i] = this.ePx[i] = x;
    this.eY[i] = this.ePy[i] = y;
    this.eAng[i] = this.ePang[i] = Math.atan2(iy, ix);
    this.eRemain[i] = 1e6;
    this.live[this.liveCount++] = i;
    return i;
  }

  private freeEnemy(i: number): void {
    this.eAlive[i] = 0;
    this.eBurnBy[i] = null;
    this.eFree[this.eFreeTop++] = i;
  }

  private leak(i: number): void {
    this.lives -= ENEMIES[this.eKind[i]].lives;
    this.leakedThisWave++;
    this.ev(EV_LEAK, this.eX[i], this.eY[i], this.eKind[i]);
    this.burst(Math.min(MAP_W, Math.max(0, this.eX[i])), Math.min(MAP_H, Math.max(0, this.eY[i])), 0xff5a3a, 6, FX_GLOW, 1);
    this.freeEnemy(i);
    if (this.lives <= 0) {
      this.lives = 0;
      this.gameOver = true;
    }
  }

  /** Units that towers may pick: alive, not hacked, and visible. */
  private targetable(i: number): boolean {
    return this.eAlive[i] === 1 && this.eHackT[i] <= 0 && (this.eStealth[i] === 0 || this.eSeen[i] === 1);
  }

  /** Is a stealth unit hidden from the player right now (render)? */
  hidden(i: number): boolean {
    return this.eStealth[i] === 1 && this.eSeen[i] === 0;
  }

  setSlow(i: number, f: number, time: number): void {
    if (f < this.eSlowF[i] || this.eSlowT[i] <= 0) this.eSlowF[i] = f;
    this.eSlowT[i] = Math.max(this.eSlowT[i], time);
  }

  private ignite(i: number, dps: number, time: number, src: Tower | null): void {
    if (this.eAir[i]) return;
    // closed-down armour doesn't catch fire; open-topped cars and soldiers do
    const arm = ENEMIES[this.eKind[i]].arm;
    if (WW2 && arm && arm[3] > 8) return;
    if (dps >= this.eBurn[i] || this.eBurnT[i] <= 0) {
      this.eBurn[i] = dps;
      this.eBurnBy[i] = src;
    }
    this.eBurnT[i] = Math.max(this.eBurnT[i], time);
  }

  private chill(i: number, amount: number): void {
    if (this.eFrozenT[i] > 0) return;
    const boss = ENEMIES[this.eKind[i]].boss;
    this.eChill[i] = Math.min(boss ? 0.6 : 1, this.eChill[i] + (boss ? amount * 0.4 : amount));
    if (this.eChill[i] >= 1) {
      this.eChill[i] = 0;
      this.eFrozenT[i] = 1.6;
      this.ev(EV_STATUS, this.eX[i], this.eY[i], 0);
      this.fx(FX_RING, 1, this.eX[i], this.eY[i], 0, 0, 0.3, 6, 30, 0.8, 0xbff4ff, 0, 0);
    }
  }

  /** Moves a ground unit by (dx,dy) unless that would put it inside a wall. */
  private shove(i: number, dx: number, dy: number): void {
    const steps = Math.ceil(Math.hypot(dx, dy) / 4) || 1;
    for (let s = 0; s < steps; s++) {
      const nx = this.eX[i] + dx / steps;
      const ny = this.eY[i] + dy / steps;
      const c = Math.floor(nx / TILE);
      const r = Math.floor(ny / TILE);
      if (c < 0 || r < 0 || c >= COLS || r >= ROWS || this.blocked[r * COLS + c]) return;
      this.eX[i] = nx;
      this.eY[i] = ny;
    }
  }

  private updateEnemies(): void {
    const margin = TILE * 1.5;
    for (let n = 0; n < this.liveCount; n++) {
      const i = this.live[n];
      if (!this.eAlive[i]) continue;
      const x = (this.ePx[i] = this.eX[i]);
      const y = (this.ePy[i] = this.eY[i]);
      this.ePang[i] = this.eAng[i];
      if (this.eFlash[i] > 0) this.eFlash[i] -= DT * 6;

      // auras under the unit
      let gc = Math.floor(x / TILE);
      let gr = Math.floor(y / TILE);
      gc = gc < 0 ? 0 : gc >= COLS ? COLS - 1 : gc;
      gr = gr < 0 ? 0 : gr >= ROWS ? ROWS - 1 : gr;
      const g = (this.eGCell[i] = gr * COLS + gc);
      this.eSeen[i] = this.radarGrid[g];
      const jam = (this.eJam[i] = this.jamGrid[g]);
      const air = this.eAir[i] === 1;
      const def = ENEMIES[this.eKind[i]];

      // shields recharge unless jammed
      if (this.eMaxShield[i] > 0) {
        if (jam > 0) this.eShield[i] = 0;
        else if ((this.eShieldCd[i] += DT) > 2) this.eShield[i] = Math.min(this.eMaxShield[i], this.eShield[i] + this.eMaxShield[i] * 0.25 * DT);
      }
      // medics patch up everything around them
      if (def.heal && jam === 0 && (this.eHealCd[i] -= DT) <= 0) {
        this.eHealCd[i] = 2;
        const m = this.hash.query(x, y, 70, this.qbuf);
        for (let k = 0; k < m; k++) {
          const j = this.qbuf[k];
          if (!this.eAlive[j] || this.eHp[j] >= this.eMaxHp[j]) continue;
          if ((this.eX[j] - x) ** 2 + (this.eY[j] - y) ** 2 > 70 * 70) continue;
          this.eHp[j] = Math.min(this.eMaxHp[j], this.eHp[j] + this.eMaxHp[j] * def.heal);
          this.fx(FX_GLOW, 1, this.eX[j], this.eY[j], 0, -20, 0.4, 10, 4, 0.8, 0x6aff7a, 0, 10);
        }
        this.fx(FX_RING, 1, x, y, 0, 0, 0.4, 8, 140, 0.5, 0x6aff7a, 0, 0);
      }
      // damage over time
      if (this.eBurnT[i] > 0) {
        this.eBurnT[i] -= DT;
        if (((this.ticks + i) & 7) === 0) {
          this.fx(FX_GLOW, 1, x + this.vr.range(-4, 4), y + this.vr.range(-4, 4), this.vr.range(-8, 8), -10, 0.35, 8, 3, 0.9, this.vr.next() < 0.5 ? 0xff7a1a : 0xffc040, 1, 8);
        }
        if (this.damage(i, this.eBurn[i] * DT, true, this.eBurnBy[i], false, 999, true)) continue;
      }
      if (!air && this.spikeGrid[g] > 0 && this.damage(i, this.spikeGrid[g] * DT, true, this.spikeSrc[g])) continue;
      if (this.eShredT[i] > 0 && (this.eShredT[i] -= DT) <= 0) this.eShred[i] = 0;
      if (this.eChill[i] > 0) this.eChill[i] = Math.max(0, this.eChill[i] - 0.1 * DT);
      if (this.eFrozenT[i] > 0) this.eFrozenT[i] -= DT;

      // hacked: stand still and shoot the nearest unit of its own wave
      if (this.eHackT[i] > 0) {
        this.eHackT[i] -= DT;
        if ((this.ticks + i) % 6 === 0) {
          const v = this.findTarget(x, y, 80, false, true, 3, i);
          if (v >= 0) {
            this.damage(v, this.eHackDps[i] * 6 * DT, false, null);
            this.streak(x, y, 8, this.eX[v], this.eY[v], 6, 0.08, 0x5aff8a, 1.2);
          }
        }
        continue;
      }

      let sp = this.eSpeed[i];
      if (this.eSlowT[i] > 0) {
        sp *= this.eSlowF[i];
        this.eSlowT[i] -= DT;
        if (this.eSlowT[i] <= 0) this.eSlowF[i] = 1;
      }
      sp *= 1 - 0.5 * this.eChill[i];
      if (this.eFrozenT[i] > 0) sp = 0;
      if (this.eStunT[i] > 0) {
        this.eStunT[i] -= DT;
        sp = 0;
      }
      if (!air) sp *= this.tarGrid[g];
      if (WW2 && def.gun && this.enemyFire(i, def, def.gun)) sp = 0; // halted to fire
      if (def.inf) {
        sp *= this.wireGrid[g];
        if (this.eSupp[i] > 0) {
          sp *= 1 - 0.55 * this.eSupp[i];
          this.eSupp[i] = Math.max(0, this.eSupp[i] - 0.45 * DT);
        }
      }
      const route = this.map.routes[this.eRoute[i]];
      let tx: number;
      let ty: number;

      if (air) {
        tx = route.airTo[0];
        ty = route.airTo[1];
        const d = Math.hypot(tx - x, ty - y);
        this.eRemain[i] = d;
        if (d < sp * DT + 2) {
          this.leak(i);
          continue;
        }
      } else {
        let cx = (x / TILE) | 0;
        let cy = (y / TILE) | 0;
        if (x < 0) cx = 0;
        else if (cx >= COLS) cx = COLS - 1;
        if (y < 0) cy = 0;
        else if (cy >= ROWS) cy = ROWS - 1;
        const breaching = this.eBreach[i] === 1;
        const field = breaching ? this.breach[this.eRoute[i]] : this.fields[this.eRoute[i]];
        let cell = cy * COLS + cx;
        // brushing a tower corner can put us in a blocked cell: steer from the last good one
        if (this.blocked[cell] || field.dist[cell] === Infinity) cell = this.eCell[i];
        else this.eCell[i] = cell;
        if (WW2 && (this.ticks + i) % 60 === 0 && this.canBreach(def)) this.thinkBreach(i, def, cell);
        if (def.gun?.fx === 'satchel' && (this.ticks + i) % 6 === 0) this.sapperWork(i);
        const dist = field.dist[cell];
        this.eRemain[i] = dist * TILE;
        let wall = 0;
        if (breaching && dist > 0) {
          // the next step is into an emplacement: stop and break it
          const nx = field.next[cell];
          if (nx >= 0 && this.blocked[nx]) {
            wall = this.towerAt[nx] >= 0 ? this.towerAt[nx] : 0;
            sp = 0;
            this.eBreachT[i] += DT;
          }
        }
        this.eWall[i] = wall;
        if (dist === 0) {
          // in the exit gate: walk straight off the map
          tx = x + route.outDir[0] * TILE * 4;
          ty = y + route.outDir[1] * TILE * 4;
          if (x < -margin || y < -margin || x > MAP_W + margin || y > MAP_H + margin) {
            this.leak(i);
            continue;
          }
        } else {
          const nx = field.next[cell];
          tx = ((nx % COLS) + 0.5) * TILE + this.eOx[i];
          ty = (((nx / COLS) | 0) + 0.5) * TILE + this.eOy[i];
        }
      }
      const dx = tx - x;
      const dy = ty - y;
      const len = Math.hypot(dx, dy) || 1;
      const step = Math.min(len, sp * DT);
      this.eX[i] = x + (dx / len) * step;
      this.eY[i] = y + (dy / len) * step;
      if (sp > 0) this.eAng[i] += angleDiff(this.eAng[i], Math.atan2(dy, dx)) * Math.min(1, 10 * DT);
    }

    // fire spreads to whoever walks close behind a burning unit
    if (this.ticks % 10 === 0) {
      for (let n = 0; n < this.liveCount; n++) {
        const i = this.live[n];
        if (!this.eAlive[i] || this.eBurnT[i] <= 0.3) continue;
        const m = this.hash.query(this.eX[i], this.eY[i], 16, this.qbuf);
        for (let k = 0; k < m; k++) {
          const j = this.qbuf[k];
          if (j !== i && this.eAlive[j] && this.eBurnT[j] <= 0 && this.rng.next() < 0.35) this.ignite(j, this.eBurn[i] * 0.6, 2, this.eBurnBy[i]);
        }
      }
    }
  }

  private compactLive(): void {
    let w = 0;
    for (let n = 0; n < this.liveCount; n++) {
      const i = this.live[n];
      if (this.eAlive[i]) this.live[w++] = i;
    }
    this.liveCount = w;
  }

  /**
   * Applies damage; returns true if the enemy died. Shields soak first; armour (minus acid shred)
   * reduces non-piercing hits; jammed and frozen units take extra, and frozen ones shatter under splash.
   */
  damage(i: number, amount: number, pierce: boolean, src: Tower | null, shatter = false, pen = -1, top = false): boolean {
    if (!this.eAlive[i]) return false;
    let a = amount * (1 + this.eJam[i]);
    if (WW2) {
      a = this.ballistics(i, a, src, pen, top);
      if (a <= 0) return false;
      pierce = true; // armour has been dealt with
    }
    if (this.eFrozenT[i] > 0) a *= shatter ? 2.5 : 1.25;
    this.eFlash[i] = 1;
    if (this.eShield[i] > 0) {
      const soak = Math.min(this.eShield[i], a);
      this.eShield[i] -= soak;
      this.eShieldCd[i] = 0;
      a -= soak;
      if (src) src.damage += soak;
      if (a <= 0) return false;
    }
    const armor = ENEMIES[this.eKind[i]].armor - this.eShred[i];
    const dmg = pierce ? a : Math.max(a - armor, a * 0.25);
    const dealt = Math.min(dmg, this.eHp[i]);
    this.eHp[i] -= dmg;
    if (src) {
      src.damage += dealt;
      this.waveDamage.set(src.id, (this.waveDamage.get(src.id) ?? 0) + dealt);
    }
    if (dmg >= 60 && dmg < 1e8) this.ev(EV_HIT, this.eX[i], this.eY[i], dmg, shatter && this.eFrozenT[i] > 0 ? 1 : 0);
    if (this.eHp[i] > 0) return false;
    if (src) src.kills++;
    this.totalKills++;
    const reward = Math.round(this.eReward[i] * (1 + this.salvageGrid[this.eGCell[i]]));
    this.money += reward;
    if (src && this.hero && src === this.hero.src) this.gainHeroXp(reward);
    this.ev(EV_KILL, this.eX[i], this.eY[i], this.eKind[i], reward);
    const kind = this.eKind[i];
    const big = ENEMIES[kind].boss ? 3 : ENEMIES[kind].radius >= 10 ? 1.6 : ENEMIES[kind].inf ? 0.6 : 1.1;
    this.explosion(this.eX[i], this.eY[i], big, this.eAir[i] ? AIR_Z : 4);
    this.freeEnemy(i);
    return true;
  }

  /** Level stats of a damage source (the commander stands in as a tower with id -1). */
  private levelOf(src: Tower): TowerLevel | null {
    return src.id < 0 ? null : TOWERS[src.type].levels[src.level];
  }

  /**
   * WW2 rules for one hit: penetration against the armour of the side that was hit (front, side or
   * rear from the shooter's bearing to the hull's heading; top for blasts and bombs), falling off
   * with range. A shot that doesn't get through bounces off; a blast may still break a track.
   * Infantry are suppressed and, once pinned, harder to hit. Returns the damage that gets through.
   */
  private ballistics(i: number, a: number, src: Tower | null, pen: number, top: boolean): number {
    const def = ENEMIES[this.eKind[i]];
    const lv = src ? this.levelOf(src) : null;
    if (def.arm) {
      if (pen < 0) pen = src ? lv?.pen ?? HERO_PEN : 0;
      let armour: number;
      if (top || !src) armour = def.arm[3];
      else {
        const dx = src.x - this.eX[i];
        const dy = src.y - this.eY[i];
        const rel = Math.abs(angleDiff(this.eAng[i], Math.atan2(dy, dx)));
        armour = rel < Math.PI / 4 ? def.arm[0] : rel > (Math.PI * 3) / 4 ? def.arm[2] : def.arm[1];
        const range = lv ? lv.range * src.rangeMult : src === this.unitSrc ? this.proxyRange : this.heroRange();
        if (range > 0) pen *= 1.1 - 0.25 * Math.min(1, Math.hypot(dx, dy) / range);
      }
      const r = armour > 0 ? pen / armour : 9;
      // under anti-tank fire, a tank crew pops smoke once
      if (!top && pen >= 40 && def.arm[0] >= 40 && !this.eSmokeUsed[i] && this.rng.next() < 0.35) this.popSmoke(i);
      if (r < 1) {
        // bounced: a glancing hit near the limit still chips something off
        const big = a >= 20;
        if (top && big && this.eStunT[i] <= 0 && this.rng.next() < 0.12) {
          this.eStunT[i] = 1.5;
          this.ev(EV_STATUS, this.eX[i], this.eY[i], 6);
        }
        if (!top && big) {
          this.ev(EV_STATUS, this.eX[i], this.eY[i], 5);
          this.fx(FX_SPARK, 1, this.eX[i], this.eY[i], this.vr.range(-120, 120), this.vr.range(-120, 120), 0.25, 6, 1, 1, 0xffe0a0, 4, 8);
        }
        return r < 0.7 ? 0 : a * 0.25 * ((r - 0.7) / 0.3);
      }
      if (r >= 1.5 && a >= 20 && this.rng.next() < 0.12) {
        // through and through: ammunition or fuel goes up
        this.ev(EV_STATUS, this.eX[i], this.eY[i], 7);
        return a * 2.5;
      }
      return a;
    }
    if (def.inf) {
      const supp = lv ? lv.supp ?? 0 : src === this.unitSrc ? this.proxySupp : 0;
      if (supp > 0) this.eSupp[i] = Math.min(1, this.eSupp[i] + supp);
      a *= 1 - 0.35 * this.eSupp[i];
    }
    return a;
  }

  /** WW2 targeting: can a weapon of this penetration hurt unit i at all (from its weakest side, or from above)? */
  private canHurt(i: number, pen: number, top: boolean): boolean {
    const arm = ENEMIES[this.eKind[i]].arm;
    if (!arm) return true;
    return pen >= (top ? arm[3] : Math.min(arm[1], arm[2])) * 0.9;
  }

  /**
   * Best target in range by targeting mode. `skip` excludes one slot; `spot` > 0 means the unit must
   * be within `spot` px or under radar cover (artillery).
   */
  private findTarget(x: number, y: number, range: number, air: boolean, ground: boolean, mode: number, skip = -1, spot = 0, pen = 0, top = false): number {
    const n = this.hash.query(x, y, range, this.qbuf);
    const r2 = range * range;
    let best = -1;
    let bestScore = -Infinity;
    for (let k = 0; k < n; k++) {
      const i = this.qbuf[k];
      if (i === skip || !this.eAlive[i] || this.eHackT[i] > 0) continue;
      if (this.eAir[i] ? !air : !ground) continue;
      const dx = this.eX[i] - x;
      const dy = this.eY[i] - y;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      // stealth: radar reveals it everywhere; otherwise only point-blank
      if (this.eStealth[i] && !this.eSeen[i] && d2 > STEALTH_DETECT * STEALTH_DETECT) continue;
      if (spot > 0 && d2 > spot * spot && !this.radarGrid[this.eGCell[i]]) continue;
      if (this.eSmoked[i] && d2 > 50 * 50) continue; // can't see into the smoke
      if (pen > 0 && !this.canHurt(i, pen, top)) continue;
      let s: number;
      switch (mode) {
        case 0: s = -this.eRemain[i]; break;
        case 1: s = this.eRemain[i]; break;
        case 2: s = this.eHp[i] + this.eShield[i]; break;
        default: s = -d2;
      }
      if (s > bestScore) {
        bestScore = s;
        best = i;
      }
    }
    return best;
  }

  private aim(t: Tower, tx: number, ty: number): boolean {
    const want = Math.atan2(ty - t.y, tx - t.x);
    const d = angleDiff(t.angle, want);
    const maxTurn = TURN_RATE * DT;
    t.angle += Math.abs(d) <= maxTurn ? d : Math.sign(d) * maxTurn;
    return Math.abs(d) < 0.3;
  }

  /** Point a moving target will be at when a projectile of `speed` arrives (one-step lead). */
  private lead(i: number, fx: number, fy: number, speed: number): [number, number] {
    const tt = Math.hypot(this.eX[i] - fx, this.eY[i] - fy) / speed;
    return [this.eX[i] + ((this.eX[i] - this.ePx[i]) / DT) * tt, this.eY[i] + ((this.eY[i] - this.ePy[i]) / DT) * tt];
  }

  /** Like lob(), but returns the projectile (or -1). */
  private lobAt(kind: number, t: Tower, i: number, fx: number, fy: number, speed: number, dmg: number, splash: number): number {
    const [ax, ay] = this.lead(i, fx, fy, speed);
    const d = Math.hypot(ax - fx, ay - fy) || 1;
    const p = this.spawnProjectile(kind, fx, fy, (ax - fx) / d, (ay - fy) / d, speed, dmg, splash, 0, i, t, d / speed);
    if (p >= 0) {
      this.pTx[p] = ax;
      this.pTy[p] = ay;
    }
    return p;
  }

  /** Fires a ballistic round at where target `i` will be. */
  private lob(kind: number, t: Tower, i: number, fx: number, fy: number, speed: number, dmg: number, splash: number, extra = 0, extra2 = 0): void {
    const [ax, ay] = this.lead(i, fx, fy, speed);
    const d = Math.hypot(ax - fx, ay - fy) || 1;
    const p = this.spawnProjectile(kind, fx, fy, (ax - fx) / d, (ay - fy) / d, speed, dmg, splash, 0, i, t, d / speed);
    if (p < 0) return;
    this.pTx[p] = ax;
    this.pTy[p] = ay;
    this.pExtra[p] = extra;
    this.pExtra2[p] = extra2;
  }

  private muzzleFlash(x: number, y: number, size: number, color: number): void {
    this.fx(FX_GLOW, 1, x, y, 0, 0, 0.07, size, size * 0.4, 0.9, color, 0, MUZZLE_Z);
  }

  private updateTowers(): void {
    for (const t of this.towers) {
      t.prevAngle = t.angle;
      if (t.recoil > 0) t.recoil = Math.max(0, t.recoil - DT * 8);
      if (t.firing > 0) t.firing -= DT;
      t.beam = -1;
      if (t.wreck) {
        // the rubble smoulders
        if ((this.ticks + t.id * 7) % 40 === 0) this.fx(FX_SMOKE, 0, t.x + this.vr.range(-6, 6), t.y + this.vr.range(-6, 6), this.vr.range(-6, 6), -18, 2.2, 6, 26, 0.4, 0x4a4640, 1, 6);
        continue;
      }
      if (t.supp > 0) t.supp = Math.max(0, t.supp - 0.35 * DT);
      // a pinned crew keeps its head down: slower to serve the gun
      t.cd -= DT * (1 - 0.5 * t.supp);
      this.updateTower(t);
    }
  }

  private updateTower(t: Tower): void {
    const def = TOWERS[t.type];
    const lv = def.levels[t.level];
    const range = lv.range * t.rangeMult;
    const h = this.hero;
    const rallied = h !== null && h.rallyT > 0 && (t.x - h.x) ** 2 + (t.y - h.y) ** 2 < 160 * 160;
    const rate = lv.rate * t.rateMult * (rallied ? 1.4 : 1);
    let dmg = lv.damage * t.dmgMult;
    const airMult = def.airMult * t.airBonus;
    const ca = Math.cos(t.angle);
    const sa = Math.sin(t.angle);

    switch (t.kind) {
      // ------------------------------------------------ passive: auras, walls, floor traps
      case 'jammer': case 'depot': case 'radar': case 'command': case 'salvage':
      case 'barricade': case 'gate': case 'tar': case 'spikes': case 'wire':
        return;

      case 'barracks': case 'motorpool':
        if (t.trainKind >= 0) this.finishTraining(t);
        return;

      case 'airfield':
        if (t.charge > 0) t.charge = Math.max(0, t.charge - DT);
        return;

      case 'workshop': {
        // pioneers go round the emplacements in range, patching them up
        if (t.cd > 0) return;
        t.cd = 0.5;
        for (const o of this.towers) {
          if (o === t || o.wreck || o.hp <= 0) continue;
          const max = this.maxHp(o);
          if (o.hp >= max || (o.x - t.x) ** 2 + (o.y - t.y) ** 2 > range * range) continue;
          o.hp = Math.min(max, o.hp + max * (lv.buff ?? 0) * 0.5);
          if (this.vr.next() < 0.5) this.fx(FX_SPARK, 1, o.x + this.vr.range(-8, 8), o.y + this.vr.range(-8, 8), this.vr.range(-40, 40), -40, 0.3, 3, 1, 1, 0xffd070, 4, 10);
        }
        return;
      }

      case 'orbital': case 'nuke': case 'stuka':
        if (t.charge > 0) t.charge = Math.max(0, t.charge - DT);
        return;

      case 'emp': {
        if (t.cd > 0 || this.findTarget(t.x, t.y, range, true, true, 3) < 0) return;
        this.forEachInRange(t.x, t.y, range, true, true, (i) => {
          this.setSlow(i, lv.slow!, lv.slowTime!);
          this.damage(i, dmg, true, t);
        });
        this.fx(FX_RING, 1, t.x, t.y, 0, 0, 0.45, 8, range * 2, 0.8, 0x8cf0a8, 0, 0);
        this.ev(EV_SHOT, t.x, t.y, t.type);
        t.cd = 1 / rate;
        return;
      }

      case 'mine': {
        if (t.cd > 0) return;
        // WW2 mines only go off under what they are made for
        let v = -1;
        if (def.trigger) {
          const veh = def.trigger === 'vehicle';
          this.forEachInRange(t.x, t.y, lv.range, false, true, (i) => {
            if (v < 0 && !ENEMIES[this.eKind[i]].inf === veh && this.eHackT[i] <= 0) v = i;
          });
        } else v = this.findTarget(t.x, t.y, lv.range, false, true, 3);
        if (v < 0) return;
        this.splash(t.x, t.y, lv.splash!, dmg, 1, 0, t, true);
        this.explosion(t.x, t.y, 1.1, 2);
        t.cd = 1 / rate;
        return;
      }

      case 'gravity': {
        const pull = lv.pull! * (t.rangeMult > 1 ? 1.2 : 1);
        this.forEachInRange(t.x, t.y, range, false, true, (i) => {
          const dx = t.x - this.eX[i];
          const dy = t.y - this.eY[i];
          const d = Math.hypot(dx, dy);
          if (d > 10) this.shove(i, (dx / d) * pull * DT, (dy / d) * pull * DT);
          this.setSlow(i, lv.slow!, 0.2);
          this.damage(i, dmg * DT, true, t);
        });
        if (this.ticks % 3 === 0) {
          const a = this.vr.next() * TWO_PI;
          const r = range * this.vr.range(0.5, 1);
          this.fx(FX_SPARK, 1, t.x + Math.cos(a) * r, t.y + Math.sin(a) * r, -Math.sin(a) * 60 - Math.cos(a) * 50, Math.cos(a) * 60 - Math.sin(a) * 50, 0.6, 5, 2, 0.8, 0xb080ff, 0, 3);
        }
        return;
      }

      case 'repulsor': {
        if (t.cd > 0 || this.findTarget(t.x, t.y, range, false, true, 3) < 0) return;
        this.forEachInRange(t.x, t.y, range, false, true, (i) => {
          const back = ENEMIES[this.eKind[i]].boss ? 0.25 : 1;
          // push against the direction of travel, so it has to walk that stretch again
          this.shove(i, -Math.cos(this.eAng[i]) * lv.knock! * back, -Math.sin(this.eAng[i]) * lv.knock! * back);
          this.damage(i, dmg, false, t);
        });
        this.fx(FX_RING, 1, t.x, t.y, 0, 0, 0.35, 10, range * 2, 0.9, 0x5ac8e8, 0, 0);
        this.ev(EV_SHOT, t.x, t.y, t.type);
        t.cd = 1 / rate;
        return;
      }

      case 'hive': {
        let n = 0;
        for (const d of this.drones) if (d.hive === t) n++;
        if (n < lv.drones! && t.cd <= 0) {
          this.drones.push({ hive: t, x: t.x, y: t.y, px: t.x, py: t.y, ang: 0, pang: 0, cd: 0, tgt: -1, orbit: this.rng.next() * TWO_PI });
          t.cd = 2;
        }
        return;
      }

      case 'blackhole': {
        if (t.cd > 0) return;
        const v = this.findTarget(t.x, t.y, range, false, true, t.mode);
        if (v < 0) return;
        this.addZone(Z_HOLE, this.eX[v], this.eY[v], lv.splash!, lv.duration!, dmg, lv.pull!, false, t);
        this.ev(EV_SHOT, t.x, t.y, t.type);
        t.cd = 1 / rate;
        return;
      }

      case 'hacker': {
        if (t.cd > 0) return;
        // the toughest vehicle in range that isn't a boss
        let best = -1;
        let hp = 0;
        this.forEachInRange(t.x, t.y, range, false, true, (i) => {
          if (ENEMIES[this.eKind[i]].boss || !this.targetable(i) || ENEMIES[this.eKind[i]].inf) return;
          if (this.eHp[i] > hp) {
            hp = this.eHp[i];
            best = i;
          }
        });
        if (best < 0) return;
        this.aim(t, this.eX[best], this.eY[best]);
        this.eHackT[best] = lv.duration!;
        this.ev(EV_STATUS, this.eX[best], this.eY[best], 1);
        this.eHackDps[best] = dmg;
        this.streak(t.x, t.y, MUZZLE_Z + 6, this.eX[best], this.eY[best], 8, 0.5, 0x3aff8a, 2);
        this.fx(FX_RING, 1, this.eX[best], this.eY[best], 0, 0, 0.4, 6, 40, 0.9, 0x3aff8a, 0, 0);
        t.cd = 1 / rate;
        return;
      }
    }

    // ------------------------------------------------ everything below picks a target
    const spot = t.kind === 'arty' ? 140 : 0;
    // WW2: crews don't waste rounds on armour they can't get through (blasts count against the top)
    const pen = WW2 ? lv.pen ?? 0 : 0;
    const ambush = t.mode === MODE_AMBUSH;
    const tgt = this.findTarget(t.x, t.y, range, def.hitsAir, def.hitsGround, ambush ? 0 : t.mode, -1, spot, pen, !!lv.splash && t.kind !== 'at');
    if (tgt < 0) {
      if (t.kind === 'gatling') t.spin = Math.max(0, t.spin - DT * 0.5);
      if (t.kind === 'gatling') t.heat = Math.max(0, t.heat - DT * 0.4);
      return;
    }
    const tx = this.eX[tgt];
    const ty = this.eY[tgt];
    const tz = this.eAir[tgt] ? AIR_Z + 6 : 6;

    if (t.kind === 'tesla') {
      if (t.cd > 0) return;
      this.ev(EV_SHOT, t.x, t.y, t.type);
      this.tesla(t, tgt, dmg, lv.chain!);
      t.cd = 1 / rate;
      return;
    }
    // turrets keep tracking while reloading
    if (!this.aim(t, tx, ty)) return;

    if (t.kind === 'laser') {
      if (t.cd <= 0) {
        // a hum every so often while the beam is on
        this.ev(EV_SHOT, t.x, t.y, t.type);
        t.cd = 0.5;
      }
      t.beam = tgt;
      this.damage(tgt, dmg * (this.eAir[tgt] ? airMult : 1) * DT, true, t);
      if ((this.ticks & 3) === 0 && this.eAlive[tgt]) {
        this.fx(FX_SPARK, 1, tx, ty, this.vr.range(-80, 80), this.vr.range(-80, 80), 0.2, 3, 1, 1, 0xff8a8a, 4, tz);
      }
      return;
    }
    if (t.kind === 'flame') {
      if (t.firing <= 0) this.ev(EV_SHOT, t.x, t.y, t.type);
      if (WW2) t.seenT = REVEAL_T;
      t.firing = 0.12;
      const mx = t.x + ca * 16;
      const my = t.y + sa * 16;
      for (let k = 0; k < 2; k++) {
        const a = t.angle + this.vr.range(-0.28, 0.28);
        const s = this.vr.range(150, 230);
        this.fx(FX_GLOW, 1, mx, my, Math.cos(a) * s, Math.sin(a) * s, range / s * 1.1, 5, 22, 0.75, k ? 0xff9a2a : 0xffd060, 1.5, MUZZLE_Z - 4);
      }
      if (this.ticks % 4 === 0) {
        if (this.vr.next() < 0.5) this.fx(FX_SMOKE, 0, mx + ca * range * 0.7, my + sa * range * 0.7, ca * 30, sa * 30, 0.8, 8, 22, 0.3, 0x3a3430, 1, 10);
        this.forEachInRange(t.x, t.y, range, false, true, (i) => {
          const a = Math.atan2(this.eY[i] - t.y, this.eX[i] - t.x);
          if (Math.abs(angleDiff(t.angle, a)) > 0.42) return;
          this.ignite(i, lv.burn! * t.dmgMult, 2.5, t);
          this.damage(i, dmg * 4 * DT, true, t);
        });
      }
      return;
    }
    if (t.kind === 'gatling') {
      t.spin = Math.min(1, t.spin + DT * 0.4);
      if (t.cd > 0) return;
    } else if (t.cd > 0) return;

    if (this.towerHidden(t)) {
      // from hiding: an ambush waits for a flank or point-blank shot; the first round of a hidden gun hits harder
      if (ambush) {
        const e = ENEMIES[this.eKind[tgt]];
        const flank = !!e.arm && Math.abs(angleDiff(this.eAng[tgt], Math.atan2(t.y - ty, t.x - tx))) > Math.PI / 4;
        if (!flank && (tx - t.x) ** 2 + (ty - t.y) ** 2 > (range * 0.6) ** 2) return;
      }
      dmg *= ambush ? 1.5 : 1.25;
    }
    t.recoil = 1;
    const mx = t.x + ca * 17;
    const my = t.y + sa * 17;
    let cd = 1 / rate;
    switch (t.kind) {
      case 'gun':
        this.spawnProjectile(P_BULLET, mx, my, ca, sa, 900, dmg, 0, airMult, tgt, t, 1);
        this.muzzleFlash(mx, my, 10, 0xffe7a0);
        break;
      case 'bunker': {
        this.spawnProjectile(P_BULLET, t.x + ca * 12 - sa * 5, t.y + sa * 12 + ca * 5, ca, sa, 900, dmg, 0, 1, tgt, t, 1);
        const second = this.findTarget(t.x, t.y, range, false, true, t.mode, tgt);
        this.spawnProjectile(P_BULLET, t.x + ca * 12 + sa * 5, t.y + sa * 12 - ca * 5, ca, sa, 900, dmg, 0, 1, second >= 0 ? second : tgt, t, 1);
        this.muzzleFlash(mx, my, 9, 0xffe7a0);
        break;
      }
      case 'gatling': {
        const side = this.ticks & 1 ? 2 : -2;
        this.spawnProjectile(P_BULLET, mx - sa * side, my + ca * side, ca, sa, 950, dmg, 0, airMult, tgt, t, 1);
        this.muzzleFlash(mx, my, 8, 0xffe7a0);
        cd = 1 / (rate * (1 + t.spin * 4));
        t.heat += 0.012;
        if (t.heat >= 1) {
          // overheated: vent and cool off
          t.heat = 0;
          t.spin = 0;
          cd = 2.5;
          for (let k = 0; k < 6; k++) this.fx(FX_SMOKE, 0, mx, my, this.vr.range(-30, 30), this.vr.range(-40, -10), 1, 6, 18, 0.5, 0xd0d0d0, 2, MUZZLE_Z);
        }
        break;
      }
      case 'cannon':
        if (lv.salvo) {
          // a rocket salvo: one round after another, scattered over the target area
          for (let k = 0; k < lv.salvo; k++) {
            const a = this.rng.next() * TWO_PI;
            const r = Math.sqrt(this.rng.next()) * lv.splash! * 1.4;
            const p = this.lobAt(P_SHELL, t, tgt, mx, my, 300 + k * 18, dmg, lv.splash!);
            if (p >= 0) {
              this.pTx[p] += Math.cos(a) * r;
              this.pTy[p] += Math.sin(a) * r;
              this.pVx[p] = (this.pTx[p] - mx) / this.pTtl[p];
              this.pVy[p] = (this.pTy[p] - my) / this.pTtl[p];
            }
          }
          for (let s = 0; s < 8; s++) this.fx(FX_SMOKE, 0, mx, my, -ca * 50 + this.vr.range(-30, 30), -sa * 50 + this.vr.range(-30, 30), 1.2, 8, 26, 0.55, 0xb0aca0, 2, MUZZLE_Z);
          this.muzzleFlash(mx, my, 18, 0xff9a50);
          break;
        }
        this.lob(P_SHELL, t, tgt, mx, my, 420, dmg, lv.splash!);
        this.muzzleFlash(mx, my, 16, 0xffc070);
        for (let s = 0; s < 3; s++) this.fx(FX_SMOKE, 0, mx, my, ca * 40 + this.vr.range(-20, 20), sa * 40 + this.vr.range(-20, 20), 0.6, 6, 16, 0.5, 0x9a948a, 3, MUZZLE_Z);
        break;
      case 'at': {
        if (this.eAir[tgt]) {
          // the 88 against aircraft: time-fused shells bursting at altitude
          const [ax, ay] = this.lead(tgt, mx, my, 620);
          const d = Math.hypot(ax - mx, ay - my) || 1;
          const p = this.spawnProjectile(P_FLAK, mx, my, (ax - mx) / d, (ay - my) / d, 620, dmg * airMult, lv.splash ?? 30, 1, tgt, t, d / 620);
          if (p >= 0) {
            this.pTx[p] = ax;
            this.pTy[p] = ay;
          }
        } else {
          this.spawnProjectile(P_AP, mx, my, ca, sa, 1100, dmg, 0, 1, tgt, t, 1);
        }
        const big = dmg >= 100 ? 1.3 : 1;
        this.muzzleFlash(mx, my, 18 * big, 0xffd080);
        for (let s = 0; s < 5; s++) this.fx(FX_SMOKE, 0, mx, my, ca * 50 + this.vr.range(-25, 25), sa * 50 + this.vr.range(-25, 25), 0.9, 7 * big, 22 * big, 0.5, 0xa8a49a, 3, MUZZLE_Z);
        // muzzle blast kicks up dust around the gun
        for (let s = 0; s < 3; s++) this.fx(FX_SMOKE, 0, t.x, t.y, this.vr.range(-40, 40), this.vr.range(-40, 40), 0.8, 8, 20, 0.3, 0x9a8a6a, 3, 2);
        break;
      }
      case 'napalm':
        this.lob(P_NAPALM, t, tgt, mx, my, 260, dmg, lv.splash!, lv.duration!);
        this.muzzleFlash(mx, my, 12, 0xff8040);
        break;
      case 'gas':
        this.lob(P_GAS, t, tgt, mx, my, 240, dmg, lv.splash!, lv.duration!, t.combos.includes('Firestorm') ? 1 : 0);
        this.fx(FX_SMOKE, 0, mx, my, ca * 30, sa * 30, 0.6, 5, 14, 0.5, 0x9bd15a, 3, MUZZLE_Z);
        break;
      case 'arty':
        this.lob(P_ARTY, t, tgt, mx, my, 300, dmg, lv.splash!);
        this.muzzleFlash(mx, my, 22, 0xffc070);
        for (let s = 0; s < 6; s++) this.fx(FX_SMOKE, 0, mx, my, ca * 60 + this.vr.range(-30, 30), sa * 60 + this.vr.range(-30, 30), 1, 8, 26, 0.55, 0x9a948a, 3, MUZZLE_Z);
        break;
      case 'missile': {
        const side = (t.kills + this.ticks) & 1 ? 5 : -5;
        this.spawnProjectile(P_MISSILE, t.x + ca * 8 - sa * side, t.y + sa * 8 + ca * side, ca, sa, 160, dmg, lv.splash!, airMult, tgt, t, 4);
        break;
      }
      case 'acid': {
        const p = this.spawnProjectile(P_ACID, mx, my, ca, sa, 380, dmg, lv.splash!, 1, tgt, t, 2);
        if (p >= 0) {
          this.pExtra[p] = lv.shred!;
          this.pExtra2[p] = lv.duration!;
        }
        break;
      }
      case 'cryo': {
        const p = this.spawnProjectile(P_CRYO, mx, my, ca, sa, 420, dmg, lv.splash!, 1, tgt, t, 2);
        if (p >= 0) this.pExtra[p] = lv.chill!;
        this.muzzleFlash(mx, my, 9, 0xbff4ff);
        break;
      }
      case 'flak': {
        const [ax, ay] = this.lead(tgt, mx, my, 520);
        const d = Math.hypot(ax - mx, ay - my) || 1;
        const p = this.spawnProjectile(P_FLAK, mx, my, (ax - mx) / d, (ay - my) / d, 520, dmg * airMult, lv.splash!, 1, tgt, t, d / 520);
        if (p >= 0) {
          this.pTx[p] = ax;
          this.pTy[p] = ay;
        }
        this.muzzleFlash(mx, my, 12, 0xffd090);
        break;
      }
      case 'sniper': {
        this.damage(tgt, dmg, true, t);
        this.streak(mx, my, MUZZLE_Z, tx, ty, tz, 0.18, 0xfff2c0, 1.2);
        this.muzzleFlash(mx, my, 14, 0xfff2c0);
        this.fx(FX_SPARK, 1, tx, ty, ca * 120, sa * 120, 0.2, 6, 1, 1, 0xffe0a0, 4, tz);
        break;
      }
      case 'rail': {
        // the slug pierces everything on the line out to full range; fire dead on the target
        t.angle = Math.atan2(ty - t.y, tx - t.x);
        const ca = Math.cos(t.angle);
        const sa = Math.sin(t.angle);
        const ex = t.x + ca * range;
        const ey = t.y + sa * range;
        const mxp = (t.x + ex) / 2;
        const myp = (t.y + ey) / 2;
        const n = this.hash.query(mxp, myp, range / 2 + 20, this.qbuf);
        const hits: number[] = [];
        for (let k = 0; k < n; k++) {
          const i = this.qbuf[k];
          if (!this.eAlive[i] || this.eHackT[i] > 0) continue;
          const rx = this.eX[i] - t.x;
          const ry = this.eY[i] - t.y;
          const along = rx * ca + ry * sa;
          if (along < 0 || along > range) continue;
          if (Math.abs(rx * sa - ry * ca) <= ENEMIES[this.eKind[i]].radius + 4) hits.push(i);
        }
        for (const i of hits) this.damage(i, dmg, true, t);
        this.streak(mx, my, MUZZLE_Z, ex, ey, MUZZLE_Z * 0.6, 0.35, 0x8ad4ff, 3);
        this.muzzleFlash(mx, my, 20, 0xa8e0ff);
        for (let k = 0; k < 8; k++) this.fx(FX_SPARK, 1, mx + ca * k * range / 8, my + sa * k * range / 8, this.vr.range(-40, 40), this.vr.range(-40, 40), 0.3, 4, 1, 0.9, 0x8ad4ff, 3, MUZZLE_Z);
        break;
      }
    }
    t.cd = cd;
    this.ev(EV_SHOT, t.x, t.y, t.type);
    // the muzzle flash gives it away (a sniper's less)
    if (WW2) t.seenT = Math.max(t.seenT, t.kind === 'sniper' ? 1.2 : REVEAL_T);
  }

  /** Calls fn for every unit within r. Callbacks may query again: each nesting level gets its own buffer. */
  private forEachInRange(x: number, y: number, r: number, air: boolean, ground: boolean, fn: (i: number) => void): void {
    const ids = (this.qpool[this.qdepth] ??= new Int32Array(MAX_ENEMIES));
    this.qdepth++;
    const n = this.hash.query(x, y, r, ids);
    const r2 = r * r;
    for (let k = 0; k < n; k++) {
      const i = ids[k];
      if (!this.eAlive[i]) continue;
      if (this.eAir[i] ? !air : !ground) continue;
      const dx = this.eX[i] - x;
      const dy = this.eY[i] - y;
      if (dx * dx + dy * dy <= r2) fn(i);
    }
    this.qdepth--;
  }

  private tesla(t: Tower, first: number, dmg: number, jumps: number): void {
    if (this.bCount >= MAX_BOLTS) return;
    const b = this.bCount++;
    const base = b * BOLT_NODES * 2;
    this.bLife[b] = 0.16;
    const pts = this.bPts;
    pts[base] = t.x;
    pts[base + 1] = t.y;
    let nodes = 1;
    let cur = first;
    let hits = 0;
    let d = dmg;
    while (cur >= 0 && nodes < BOLT_NODES) {
      const cx = this.eX[cur];
      const cy = this.eY[cur];
      pts[base + nodes * 2] = cx;
      pts[base + nodes * 2 + 1] = cy;
      nodes++;
      this.chainHit[hits++] = cur;
      this.fx(FX_GLOW, 1, cx, cy, 0, 0, 0.15, 14, 6, 0.9, 0x9fdcff, 0, this.eAir[cur] ? AIR_Z + 6 : 6);
      this.damage(cur, d, false, t);
      d *= 0.82;
      if (hits > jumps) break;
      // nearest un-hit enemy within jump range
      const n = this.hash.query(cx, cy, 90, this.qbuf);
      let best = -1;
      let bd = 90 * 90;
      for (let k = 0; k < n; k++) {
        const i = this.qbuf[k];
        if (!this.targetable(i)) continue;
        let seen = false;
        for (let h = 0; h < hits; h++) if (this.chainHit[h] === i) { seen = true; break; }
        if (seen) continue;
        const dx = this.eX[i] - cx;
        const dy = this.eY[i] - cy;
        const dd = dx * dx + dy * dy;
        if (dd < bd) {
          bd = dd;
          best = i;
        }
      }
      cur = best;
    }
    this.bN[b] = nodes;
  }

  private updateBolts(): void {
    for (let b = this.bCount - 1; b >= 0; b--) {
      this.bLife[b] -= DT;
      if (this.bLife[b] > 0) continue;
      const last = --this.bCount;
      if (b !== last) {
        this.bLife[b] = this.bLife[last];
        this.bN[b] = this.bN[last];
        this.bPts.copyWithin(b * BOLT_NODES * 2, last * BOLT_NODES * 2, (last + 1) * BOLT_NODES * 2);
      }
    }
  }

  // ============================================================ zones, drones, streaks

  private addZone(kind: number, x: number, y: number, r: number, t: number, dps: number, pull: number, burn: boolean, src: Tower | null): void {
    if (this.zones.length >= 256) return;
    const drift = kind === Z_GAS ? 10 : 0;
    const a = this.rng.next() * TWO_PI;
    this.zones.push({ kind, x, y, px: x, py: y, vx: Math.cos(a) * drift, vy: Math.sin(a) * drift, r, t, t0: t, dps, pull, burn, src });
  }

  private updateZones(): void {
    for (let z = this.zones.length - 1; z >= 0; z--) {
      const zn = this.zones[z];
      zn.px = zn.x;
      zn.py = zn.y;
      zn.t -= DT;
      if (zn.t <= 0) {
        if (zn.kind === Z_HOLE) {
          this.fx(FX_RING, 1, zn.x, zn.y, 0, 0, 0.4, zn.r * 2, 8, 0.9, 0xc090ff, 0, 0);
          this.fx(FX_GLOW, 1, zn.x, zn.y, 0, 0, 0.25, 50, 4, 1, 0xd0b0ff, 0, 8);
        }
        this.zones.splice(z, 1);
        continue;
      }
      if (zn.kind === Z_ORBITAL) {
        // the beam hunts the toughest unit nearby
        const v = this.findTarget(zn.x, zn.y, 200, true, true, 2);
        if (v >= 0) {
          const dx = this.eX[v] - zn.x;
          const dy = this.eY[v] - zn.y;
          const d = Math.hypot(dx, dy) || 1;
          const sp = Math.min(d / DT, 110);
          zn.vx = (dx / d) * sp;
          zn.vy = (dy / d) * sp;
        } else {
          zn.vx *= 0.9;
          zn.vy *= 0.9;
        }
      }
      zn.x += zn.vx * DT;
      zn.y += zn.vy * DT;
      const air = zn.kind === Z_ORBITAL;
      this.forEachInRange(zn.x, zn.y, zn.r, air, true, (i) => {
        switch (zn.kind) {
          case Z_FIRE:
            this.ignite(i, zn.dps, 1, zn.src);
            break;
          case Z_GAS:
            this.damage(i, zn.dps * ENEMIES[this.eKind[i]].bio * DT, true, zn.src);
            if (zn.burn && this.eAlive[i]) this.ignite(i, zn.dps * 0.5, 1, zn.src);
            break;
          case Z_HOLE: {
            const dx = zn.x - this.eX[i];
            const dy = zn.y - this.eY[i];
            const d = Math.hypot(dx, dy);
            if (d < 16 && !ENEMIES[this.eKind[i]].boss && this.eHp[i] < this.eMaxHp[i] * 0.25) {
              this.ev(EV_STATUS, this.eX[i], this.eY[i], 4);
              this.damage(i, 1e9, true, zn.src); // swallowed
              return;
            }
            if (d > 4) this.shove(i, (dx / d) * zn.pull * DT, (dy / d) * zn.pull * DT);
            this.damage(i, zn.dps * DT, true, zn.src);
            break;
          }
          case Z_ORBITAL:
            this.damage(i, zn.dps * DT, true, zn.src);
            break;
        }
      });
      // visuals
      const life = zn.t / zn.t0;
      if (zn.kind === Z_FIRE && (this.ticks & 1) === 0) {
        const a = this.vr.next() * TWO_PI;
        const r = Math.sqrt(this.vr.next()) * zn.r * 0.85;
        this.fx(FX_GLOW, 1, zn.x + Math.cos(a) * r, zn.y + Math.sin(a) * r, 0, -12, 0.5, 10 * life + 4, 3, 0.85, this.vr.next() < 0.5 ? 0xff6a1a : 0xffb040, 1, 4);
        if (this.vr.next() < 0.2) this.fx(FX_SMOKE, 0, zn.x + Math.cos(a) * r, zn.y + Math.sin(a) * r, 0, -10, 1.2, 8, 24, 0.3, 0x2a2420, 1, 12);
      } else if (zn.kind === Z_GAS && this.ticks % 3 === 0) {
        const a = this.vr.next() * TWO_PI;
        const r = Math.sqrt(this.vr.next()) * zn.r * 0.8;
        this.fx(FX_SMOKE, 0, zn.x + Math.cos(a) * r, zn.y + Math.sin(a) * r, zn.vx, zn.vy, 1.4, zn.r * 0.5, zn.r * 0.9, 0.35 * Math.min(1, life * 3), zn.burn ? 0xb0a040 : 0x8ac84a, 0.5, 4);
      } else if (zn.kind === Z_HOLE && (this.ticks & 1) === 0) {
        const a = this.vr.next() * TWO_PI;
        const r = zn.r * this.vr.range(0.6, 1.1);
        this.fx(FX_SPARK, 1, zn.x + Math.cos(a) * r, zn.y + Math.sin(a) * r, -Math.cos(a) * r * 2 - Math.sin(a) * 90, -Math.sin(a) * r * 2 + Math.cos(a) * 90, 0.45, 6, 1, 0.9, this.vr.next() < 0.5 ? 0xa060ff : 0xe0c0ff, 0, 6);
      } else if (zn.kind === Z_ORBITAL) {
        if ((this.ticks & 1) === 0) this.streak(zn.x, zn.y, 600, zn.x, zn.y, 0, 0.05, 0xff4a7a, zn.r * 0.7);
        const a = this.vr.next() * TWO_PI;
        this.fx(FX_SPARK, 1, zn.x, zn.y, Math.cos(a) * 160, Math.sin(a) * 160, 0.3, 6, 1, 1, 0xffa0c0, 3, 2);
        if (this.ticks % 4 === 0) this.fx(FX_SMOKE, 0, zn.x, zn.y, this.vr.range(-20, 20), this.vr.range(-20, 20), 1, 10, 30, 0.4, 0x2a2224, 1, 4);
      }
    }
  }

  private updateDrones(): void {
    const DRONE_SPEED = 150;
    for (const d of this.drones) {
      d.px = d.x;
      d.py = d.y;
      d.pang = d.ang;
      d.cd -= DT;
      const hive = d.hive;
      const lv = TOWERS[hive.type].levels[hive.level];
      const leash = lv.range * hive.rangeMult;
      if (d.tgt >= 0 && (!this.targetable(d.tgt) || Math.hypot(this.eX[d.tgt] - hive.x, this.eY[d.tgt] - hive.y) > leash)) d.tgt = -1;
      if (d.tgt < 0 && (this.ticks + (d.orbit * 10 | 0)) % 15 === 0) {
        const v = this.findTarget(d.x, d.y, 220, true, true, 3);
        if (v >= 0 && Math.hypot(this.eX[v] - hive.x, this.eY[v] - hive.y) <= leash) d.tgt = v;
      }
      d.orbit += DT * 2.2;
      let gx: number;
      let gy: number;
      if (d.tgt >= 0) {
        gx = this.eX[d.tgt] + Math.cos(d.orbit) * 34;
        gy = this.eY[d.tgt] + Math.sin(d.orbit) * 34;
      } else {
        gx = hive.x + Math.cos(d.orbit) * 26;
        gy = hive.y + Math.sin(d.orbit) * 26;
      }
      const dx = gx - d.x;
      const dy = gy - d.y;
      const dist = Math.hypot(dx, dy) || 1;
      const step = Math.min(dist, DRONE_SPEED * DT);
      d.x += (dx / dist) * step;
      d.y += (dy / dist) * step;
      if (d.tgt >= 0) {
        const ax = this.eX[d.tgt] - d.x;
        const ay = this.eY[d.tgt] - d.y;
        d.ang += angleDiff(d.ang, Math.atan2(ay, ax)) * Math.min(1, 12 * DT);
        if (d.cd <= 0 && ax * ax + ay * ay < 70 * 70) {
          const a = Math.hypot(ax, ay) || 1;
          this.spawnProjectile(P_BULLET, d.x, d.y, ax / a, ay / a, 800, lv.damage * hive.dmgMult, 0, 1, d.tgt, hive, 1);
          d.cd = 1 / (lv.rate * hive.rateMult);
        }
      } else if (step > 0.1) {
        d.ang += angleDiff(d.ang, Math.atan2(dy, dx)) * Math.min(1, 8 * DT);
      }
    }
  }

  private streak(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, life: number, color: number, width: number): void {
    if (this.streaks.length >= 512) return;
    this.streaks.push({ x0, y0, z0, x1, y1, z1, life, life0: life, color, width });
  }

  private updateStreaks(): void {
    for (let k = this.streaks.length - 1; k >= 0; k--) {
      if ((this.streaks[k].life -= DT) <= 0) {
        this.streaks[k] = this.streaks[this.streaks.length - 1];
        this.streaks.pop();
      }
    }
  }

  // ============================================================ projectiles

  private spawnProjectile(
    kind: number, x: number, y: number, dx: number, dy: number, speed: number, dmg: number,
    splash: number, airMult: number, target: number, src: Tower, ttl: number,
  ): number {
    if (this.pCount >= MAX_PROJECTILES) return -1;
    const p = this.pCount++;
    this.pKind[p] = kind;
    this.pX[p] = this.pPx[p] = x;
    this.pY[p] = this.pPy[p] = y;
    this.pVx[p] = dx * speed;
    this.pVy[p] = dy * speed;
    this.pSpeed[p] = speed;
    this.pDmg[p] = dmg;
    this.pSplash[p] = splash;
    this.pAirMult[p] = airMult;
    this.pTarget[p] = target;
    this.pTuid[p] = target >= 0 ? this.eUid[target] : -1;
    this.pTtl[p] = this.pTtl0[p] = ttl;
    this.pTx[p] = target >= 0 ? this.eX[target] : x;
    this.pTy[p] = target >= 0 ? this.eY[target] : y;
    this.pExtra[p] = this.pExtra2[p] = 0;
    this.pSrc[p] = src;
    return p;
  }

  private removeProjectile(p: number): void {
    const last = --this.pCount;
    if (p === last) return;
    this.pKind[p] = this.pKind[last];
    this.pX[p] = this.pX[last];
    this.pY[p] = this.pY[last];
    this.pPx[p] = this.pPx[last];
    this.pPy[p] = this.pPy[last];
    this.pVx[p] = this.pVx[last];
    this.pVy[p] = this.pVy[last];
    this.pSpeed[p] = this.pSpeed[last];
    this.pDmg[p] = this.pDmg[last];
    this.pSplash[p] = this.pSplash[last];
    this.pAirMult[p] = this.pAirMult[last];
    this.pTarget[p] = this.pTarget[last];
    this.pTuid[p] = this.pTuid[last];
    this.pTtl[p] = this.pTtl[last];
    this.pTtl0[p] = this.pTtl0[last];
    this.pTx[p] = this.pTx[last];
    this.pTy[p] = this.pTy[last];
    this.pExtra[p] = this.pExtra[last];
    this.pExtra2[p] = this.pExtra2[last];
    this.pSrc[p] = this.pSrc[last];
    this.pSrc[last] = null;
  }

  /** Render height of a projectile chasing its target: climbs toward flying targets. */
  missileZ(p: number): number {
    if (this.pKind[p] === P_FLAK) return AIR_Z * Math.min(1, 1.3 - this.pTtl[p] / this.pTtl0[p]);
    return this.targetValid(p) && this.eAir[this.pTarget[p]] ? AIR_Z + 4 : 10;
  }

  targetValid(p: number): boolean {
    const t = this.pTarget[p];
    return t >= 0 && this.eAlive[t] === 1 && this.eUid[t] === this.pTuid[p];
  }

  /** Area damage falling off to half at the edge. mask: 1 ground, 2 air, 3 both. */
  private splash(x: number, y: number, r: number, dmg: number, mask: number, airMult: number, src: Tower | null, shatter = false, pen = -1): void {
    this.forEachInRange(x, y, r, (mask & 2) !== 0, (mask & 1) !== 0, (i) => {
      const d2 = (this.eX[i] - x) ** 2 + (this.eY[i] - y) ** 2;
      const fall = 1 - 0.5 * Math.sqrt(d2 / (r * r));
      this.damage(i, dmg * fall * (this.eAir[i] ? airMult : 1), false, src, shatter, pen, true);
    });
  }

  /** A projectile reached its target point or unit. */
  private impact(p: number, kind: number, x: number, y: number): void {
    const src = this.pSrc[p];
    const dmg = this.pDmg[p];
    const r = this.pSplash[p];
    switch (kind) {
      case P_SHELL:
        this.splash(x, y, r, dmg, 1, 0, src, true);
        this.explosion(x, y, 1.2, 0);
        break;
      case P_ARTY:
        this.splash(x, y, r, dmg, 1, 0, src, true);
        this.explosion(x, y, 2.2, 0);
        this.fx(FX_RING, 1, x, y, 0, 0, 0.4, 10, r * 2, 0.7, 0xffc080, 0, 0);
        break;
      case P_NAPALM:
        this.addZone(Z_FIRE, x, y, r, this.pExtra[p], dmg, 0, false, src);
        this.explosion(x, y, 0.8, 0);
        break;
      case P_GAS:
        this.addZone(Z_GAS, x, y, r, this.pExtra[p], dmg, 0, this.pExtra2[p] > 0, src);
        for (let k = 0; k < 6; k++) this.fx(FX_SMOKE, 0, x, y, this.vr.range(-40, 40), this.vr.range(-40, 40), 1, 10, r, 0.5, 0x9bd15a, 3, 4);
        break;
      case P_NUKE:
        this.ev(EV_NUKE, x, y);
        this.splash(x, y, r, dmg, 3, 1, src, true);
        this.explosion(x, y, 6, 0);
        this.fx(FX_RING, 1, x, y, 0, 0, 0.8, 20, r * 2.4, 1, 0xfff0c0, 0, 0);
        this.fx(FX_RING, 1, x, y, 0, 0, 1.3, 10, r * 3.2, 0.6, 0xffa060, 0, 0);
        for (let k = 0; k < 24; k++) {
          const a = (k / 24) * TWO_PI;
          this.fx(FX_SMOKE, 0, x, y, Math.cos(a) * 160, Math.sin(a) * 160, 2.2, 30, 70, 0.6, 0x5a5048, 1.5, 10);
        }
        break;
      case P_FLAK:
        this.splash(x, y, r, dmg, 2, 1, src);
        this.fx(FX_GLOW, 1, x, y, 0, 0, 0.15, 12, 30, 0.9, 0xffd090, 0, AIR_Z + 4);
        for (let k = 0; k < 4; k++) this.fx(FX_SMOKE, 0, x, y, this.vr.range(-25, 25), this.vr.range(-25, 25), 0.9, 8, 22, 0.6, 0x2a2826, 2, AIR_Z + 4);
        break;
      case P_ACID:
        this.forEachInRange(x, y, r, true, true, (i) => {
          this.eShred[i] = Math.max(this.eShred[i], this.pExtra[p]);
          this.eShredT[i] = this.pExtra2[p];
          this.damage(i, dmg, false, src);
        });
        for (let k = 0; k < 6; k++) this.fx(FX_GLOW, 1, x, y, this.vr.range(-50, 50), this.vr.range(-50, 50), 0.4, 6, 2, 0.8, 0xa6e22e, 4, 4);
        break;
      case P_CRYO:
        this.forEachInRange(x, y, r, true, true, (i) => {
          this.chill(i, this.pExtra[p]);
          this.damage(i, dmg, false, src);
        });
        this.fx(FX_GLOW, 1, x, y, 0, 0, 0.25, 8, r * 1.6, 0.7, 0xbff4ff, 0, 6);
        break;
    }
  }

  private updateProjectiles(): void {
    for (let p = this.pCount - 1; p >= 0; p--) {
      this.pPx[p] = this.pX[p];
      this.pPy[p] = this.pY[p];
      const kind = this.pKind[p];

      if (kind === P_BULLET || kind === P_AP || kind === P_ACID || kind === P_CRYO) {
        // straight at the target, following it
        const valid = this.targetValid(p);
        if (valid) {
          this.pTx[p] = this.eX[this.pTarget[p]];
          this.pTy[p] = this.eY[this.pTarget[p]];
        }
        const dx = this.pTx[p] - this.pX[p];
        const dy = this.pTy[p] - this.pY[p];
        const d = Math.hypot(dx, dy);
        const step = this.pSpeed[p] * DT;
        if (d <= step + 4) {
          if (kind === P_AP) {
            if (valid) this.damage(this.pTarget[p], this.pDmg[p], false, this.pSrc[p]);
            this.fx(FX_GLOW, 1, this.pTx[p], this.pTy[p], 0, 0, 0.1, 6, 18, 0.9, 0xffe0a0, 0, 8);
            for (let k = 0; k < 3; k++) this.fx(FX_SMOKE, 0, this.pTx[p], this.pTy[p], this.vr.range(-30, 30), this.vr.range(-30, 30), 0.7, 5, 16, 0.45, 0x8a8478, 3, 6);
          } else if (kind !== P_BULLET) this.impact(p, kind, this.pTx[p], this.pTy[p]);
          else if (valid) {
            const t = this.pTarget[p];
            this.damage(t, this.pDmg[p] * (this.eAir[t] ? this.pAirMult[p] : 1), false, this.pSrc[p]);
            this.fx(FX_SPARK, 1, this.pTx[p], this.pTy[p], -dx / d * 60, -dy / d * 60, 0.12, 4, 1, 1, 0xffd27a, 6, this.eAir[t] ? AIR_Z + 6 : 6);
          }
          this.removeProjectile(p);
          continue;
        }
        this.pVx[p] = (dx / d) * this.pSpeed[p];
        this.pVy[p] = (dy / d) * this.pSpeed[p];
        this.pX[p] += this.pVx[p] * DT;
        this.pY[p] += this.pVy[p] * DT;
      } else if (kind !== P_MISSILE) {
        // ballistic rounds and flak: fly to a fixed point and go off there
        this.pX[p] += this.pVx[p] * DT;
        this.pY[p] += this.pVy[p] * DT;
        this.pTtl[p] -= DT;
        if (kind === P_NUKE && (this.ticks & 1) === 0) {
          this.fx(FX_SMOKE, 0, this.pX[p], this.pY[p], 0, 0, 0.8, 6, 16, 0.5, 0xd0ccc4, 2, 20);
        }
        if (this.pTtl[p] <= 0) {
          this.impact(p, kind, this.pTx[p], this.pTy[p]);
          this.removeProjectile(p);
        }
      } else {
        // homing missile
        this.pTtl[p] -= DT;
        if (!this.targetValid(p)) {
          const n = this.findTarget(this.pX[p], this.pY[p], 220, true, true, 3);
          if (n >= 0) {
            this.pTarget[p] = n;
            this.pTuid[p] = this.eUid[n];
          }
        }
        const valid = this.targetValid(p);
        if (valid) {
          this.pTx[p] = this.eX[this.pTarget[p]];
          this.pTy[p] = this.eY[this.pTarget[p]];
        }
        const spd = (this.pSpeed[p] = Math.min(560, this.pSpeed[p] + 900 * DT));
        let ang = Math.atan2(this.pVy[p], this.pVx[p]);
        const want = Math.atan2(this.pTy[p] - this.pY[p], this.pTx[p] - this.pX[p]);
        const diff = angleDiff(ang, want);
        const turn = 7 * DT;
        ang += Math.abs(diff) < turn ? diff : Math.sign(diff) * turn;
        this.pVx[p] = Math.cos(ang) * spd;
        this.pVy[p] = Math.sin(ang) * spd;
        this.pX[p] += this.pVx[p] * DT;
        this.pY[p] += this.pVy[p] * DT;
        if ((this.ticks & 1) === 0) {
          this.fx(FX_SMOKE, 0, this.pX[p], this.pY[p], this.vr.range(-8, 8), this.vr.range(-8, 8), 0.5, 3, 9, 0.45, 0xc8c4bc, 2, this.missileZ(p));
        }
        const dx = this.pTx[p] - this.pX[p];
        const dy = this.pTy[p] - this.pY[p];
        const hitR = valid ? ENEMIES[this.eKind[this.pTarget[p]]].radius + 4 : 6;
        if (dx * dx + dy * dy < hitR * hitR || this.pTtl[p] <= 0) {
          const x = this.pX[p];
          const y = this.pY[p];
          if (valid) this.damage(this.pTarget[p], this.pDmg[p] * 0.5 * (this.eAir[this.pTarget[p]] ? this.pAirMult[p] : 1), false, this.pSrc[p]);
          this.splash(x, y, this.pSplash[p], this.pDmg[p] * 0.5, 3, this.pAirMult[p], this.pSrc[p]);
          this.explosion(x, y, 0.8, this.missileZ(p));
          this.removeProjectile(p);
        }
      }
    }
  }

  // ============================================================ effects

  /** Spawns one effect particle. Silently drops when the pool is full. */
  fx(
    tex: number, add: number, x: number, y: number, vx: number, vy: number, life: number,
    s0: number, s1: number, a0: number, color: number, drag: number, z = 4,
  ): void {
    if (this.fCount >= MAX_FX || (this.fxScale < 1 && this.vr.next() > this.fxScale)) return;
    const f = this.fCount++;
    this.fTex[f] = tex;
    this.fAdd[f] = add;
    this.fX[f] = this.fPx[f] = x;
    this.fY[f] = this.fPy[f] = y;
    this.fZ[f] = z;
    this.fVx[f] = vx;
    this.fVy[f] = vy;
    this.fLife[f] = this.fMax[f] = life;
    this.fS0[f] = s0;
    this.fS1[f] = s1;
    this.fA0[f] = a0;
    this.fRot[f] = tex === FX_SPARK ? Math.atan2(vy, vx) : this.vr.next() * TWO_PI;
    this.fColor[f] = color;
    this.fDrag[f] = drag;
  }

  private burst(x: number, y: number, color: number, n: number, tex: number, add: number): void {
    for (let k = 0; k < n; k++) {
      const a = this.vr.next() * TWO_PI;
      const s = this.vr.range(30, 90);
      this.fx(tex, add, x, y, Math.cos(a) * s, Math.sin(a) * s, this.vr.range(0.3, 0.6), tex === FX_SMOKE ? 8 : 4, tex === FX_SMOKE ? 18 : 1, 0.8, color, 4);
    }
  }

  explosion(x: number, y: number, size: number, z = 4): void {
    this.ev(EV_BOOM, x, y, size);
    // degrade gracefully when the effect pool is busy
    const load = this.fCount / MAX_FX;
    const q = load > 0.8 ? 0.25 : load > 0.5 ? 0.6 : 1;
    const rng = this.vr;
    this.fx(FX_GLOW, 1, x, y, 0, 0, 0.18, 10 * size, 46 * size, 1, 0xfff0c0, 0, z);
    const fire = Math.ceil(5 * size * q);
    for (let k = 0; k < fire; k++) {
      const a = rng.next() * TWO_PI;
      const s = rng.range(10, 60) * size;
      this.fx(FX_GLOW, 1, x, y, Math.cos(a) * s, Math.sin(a) * s, rng.range(0.25, 0.45), 14 * size, 4, 0.9, k & 1 ? 0xff8a2a : 0xffc04a, 3, z);
    }
    const smoke = Math.ceil(4 * size * q);
    for (let k = 0; k < smoke; k++) {
      const a = rng.next() * TWO_PI;
      const s = rng.range(8, 40) * size;
      this.fx(FX_SMOKE, 0, x, y, Math.cos(a) * s, Math.sin(a) * s - 10, rng.range(0.8, 1.4), 10 * size, 34 * size, 0.55, 0x4a463f, 2, z);
    }
    const debris = Math.ceil(6 * size * q);
    for (let k = 0; k < debris; k++) {
      const a = rng.next() * TWO_PI;
      const s = rng.range(80, 220) * Math.sqrt(size);
      this.fx(FX_SPARK, 1, x, y, Math.cos(a) * s, Math.sin(a) * s, rng.range(0.2, 0.4), 5, 2, 1, 0xffd080, 5, z);
    }
  }

  private updateFx(): void {
    for (let f = this.fCount - 1; f >= 0; f--) {
      this.fLife[f] -= DT;
      if (this.fLife[f] <= 0) {
        const l = --this.fCount;
        if (f !== l) {
          this.fTex[f] = this.fTex[l];
          this.fAdd[f] = this.fAdd[l];
          this.fX[f] = this.fX[l];
          this.fY[f] = this.fY[l];
          this.fZ[f] = this.fZ[l];
          this.fPx[f] = this.fPx[l];
          this.fPy[f] = this.fPy[l];
          this.fVx[f] = this.fVx[l];
          this.fVy[f] = this.fVy[l];
          this.fDrag[f] = this.fDrag[l];
          this.fLife[f] = this.fLife[l];
          this.fMax[f] = this.fMax[l];
          this.fS0[f] = this.fS0[l];
          this.fS1[f] = this.fS1[l];
          this.fA0[f] = this.fA0[l];
          this.fRot[f] = this.fRot[l];
          this.fColor[f] = this.fColor[l];
        }
        continue;
      }
      this.fPx[f] = this.fX[f];
      this.fPy[f] = this.fY[f];
      const drag = 1 - Math.min(1, this.fDrag[f] * DT);
      this.fVx[f] *= drag;
      this.fVy[f] *= drag;
      this.fX[f] += this.fVx[f] * DT;
      this.fY[f] += this.fVy[f] * DT;
    }
  }
}

