import {
  COLS, COMBOS, DT, EN_BOSS, ENEMIES, MAP_H, MAP_W, MAX_ENEMIES, MAX_FX, MAX_PROJECTILES, ROWS, SELL_RATIO,
  START_LIVES, START_MONEY, TILE, TOTAL_WAVES, TOWERS, WAVE_GAP, buildWave, hpScale, rewardScale,
  type SpawnGroup, type TowerKind,
} from './defs';
import { FlowField } from './flow';
import { T_BUILD, T_ROCK, type GameMap } from './maps';
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
  kind: TowerKind;
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

const TURN_RATE = 10; // rad/s for turrets
/** Render heights shared with the renderer: flying units and turret muzzles. */
export const AIR_Z = 34;
export const MUZZLE_Z = 16;
const TWO_PI = Math.PI * 2;

function angleDiff(a: number, b: number): number {
  let d = (b - a) % TWO_PI;
  if (d > Math.PI) d -= TWO_PI;
  else if (d < -Math.PI) d += TWO_PI;
  return d;
}

export class Sim {
  readonly map: GameMap;
  readonly rng = new Rng(1234);
  /** Per route: distance field towards its exit, over the current maze. */
  readonly fields: FlowField[];
  private readonly scratch: FlowField[];
  /** Impassable cells: rocks and towers. */
  readonly blocked = new Uint8Array(COLS * ROWS);
  private spawnCount = 0;

  money = START_MONEY;
  lives = START_LIVES;
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

  constructor(map: GameMap) {
    this.map = map;
    this.fields = map.routes.map((r) => new FlowField(r.exit));
    this.scratch = map.routes.map((r) => new FlowField(r.exit));
    for (let i = 0; i < map.grid.length; i++) this.blocked[i] = map.grid[i] === T_ROCK ? 1 : 0;
    for (const f of this.fields) f.compute(this.blocked);
    for (let i = 0; i < MAX_ENEMIES; i++) this.eFree[i] = MAX_ENEMIES - 1 - i;
    this.eFreeTop = MAX_ENEMIES;
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
    const cost = def.levels[0].cost;
    if ((!free && this.money < cost) || !this.canPlace(type, col, row)) return null;
    if (!free) this.money -= cost;
    const size = def.size;
    const t: Tower = {
      id: this.nextTowerId++, type, kind: def.kind, level: 0, col, row, size,
      x: (col + size / 2) * TILE, y: (row + size / 2) * TILE,
      cd: 0, angle: -Math.PI / 2, prevAngle: -Math.PI / 2,
      mode: def.kind === 'sniper' || def.kind === 'arty' ? 2 : 0, // big guns default to Strong
      beam: -1, recoil: 0, spent: free ? 0 : cost, kills: 0, damage: 0,
      open: false, charge: def.levels[0].charge ?? 0, spin: 0, heat: 0, firing: 0,
      rangeMult: 1, rateMult: 1, dmgMult: 1, airBonus: 1, combos: [],
    };
    const reroutes = this.checkReroutes;
    t.open = this.checkOpenGate;
    this.towers.push(t);
    this.towerById.set(t.id, t);
    this.setFootprint(t, t.id);
    if (reroutes) for (let k = 0; k < this.fields.length; k++) this.fields[k].copyFrom(this.scratch[k]);
    this.towerVersion++;
    this.burst(t.x, t.y, 0x9a8f78, size * 4, FX_SMOKE, 0);
    return t;
  }

  private cellsOf(t: Tower): number[] {
    const out: number[] = [];
    for (let dy = 0; dy < t.size; dy++) for (let dx = 0; dx < t.size; dx++) out.push((t.row + dy) * COLS + t.col + dx);
    return out;
  }

  private setFootprint(t: Tower, id: number): void {
    const wall = !TOWERS[t.type].walkable && !t.open;
    for (const i of this.cellsOf(t)) {
      this.towerAt[i] = id;
      this.blocked[i] = id >= 0 && wall ? 1 : 0;
    }
  }

  upgradeCost(t: Tower): number {
    const lv = TOWERS[t.type].levels;
    return t.level + 1 < lv.length ? lv[t.level + 1].cost : 0;
  }

  upgrade(t: Tower): boolean {
    const cost = this.upgradeCost(t);
    if (!cost || this.money < cost) return false;
    this.money -= cost;
    t.spent += cost;
    t.level++;
    this.towerVersion++;
    this.burst(t.x, t.y, 0xffe28a, 10, FX_SPARK, 1);
    return true;
  }

  sellValue(t: Tower): number {
    return Math.floor(t.spent * SELL_RATIO);
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
      for (let k = 0; k < 10; k++) this.fx(FX_SMOKE, 0, t.x, t.y, this.rng.range(-60, 60), this.rng.range(-60, 60), 1.2, 10, 40, 0.6, 0xb0aca0, 2, 6);
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
    this.tarGrid.fill(1);
    this.spikeGrid.fill(0);
    this.spikeSrc.fill(null);
    for (const t of this.towers) {
      t.rangeMult = t.rateMult = t.dmgMult = t.airBonus = 1;
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
      if (t.kind !== 'depot') continue;
      const lv = TOWERS[t.type].levels[t.level];
      sum += (lv.income ?? 0) + Math.min(lv.cap ?? 0, Math.floor(this.money * (lv.interest ?? 0)));
    }
    return sum;
  }

  startNextWave(): void {
    if (!this.canCallWave) return;
    this.money += this.earlyBonus;
    if (this.wave > 0) {
      this.money += this.depotIncome;
      for (const t of this.towers) if (t.kind === 'depot') this.burst(t.x, t.y, 0xffd84a, 10, FX_GLOW, 1);
    }
    this.wave++;
    const groups = buildWave(this.wave);
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
    const kinds = [0, 1, 2, 3, 4, 6, 7, 8];
    const groups: SpawnGroup[] = kinds.map((kind) => ({
      kind, count: Math.floor(count / kinds.length), interval: 6 / (count / kinds.length), delay: 0,
    }));
    this.spawners.push({
      wave: Math.max(this.wave, 1) + 12, groups,
      left: new Int32Array(groups.map((g) => g.count)),
      timer: new Float32Array(groups.length), t: 0,
    });
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
    this.eMaxHp[i] = this.eHp[i] = def.hp * hpScale(wave);
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
    this.eSpeed[i] = def.speed * this.rng.range(0.94, 1.06);
    this.eReward[i] = Math.round(def.reward * rewardScale(wave));
    this.eSlowT[i] = 0;
    this.eSlowF[i] = 1;
    this.eFlash[i] = 0;
    const [ix, iy] = route.inDir;
    const jitter = kind === EN_BOSS ? 0 : TILE * 0.3;
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
    if (dps >= this.eBurn[i] || this.eBurnT[i] <= 0) {
      this.eBurn[i] = dps;
      this.eBurnBy[i] = src;
    }
    this.eBurnT[i] = Math.max(this.eBurnT[i], time);
  }

  private chill(i: number, amount: number): void {
    if (this.eFrozenT[i] > 0) return;
    const boss = this.eKind[i] === EN_BOSS;
    this.eChill[i] = Math.min(boss ? 0.6 : 1, this.eChill[i] + (boss ? amount * 0.4 : amount));
    if (this.eChill[i] >= 1) {
      this.eChill[i] = 0;
      this.eFrozenT[i] = 1.6;
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
          this.fx(FX_GLOW, 1, x + this.rng.range(-4, 4), y + this.rng.range(-4, 4), this.rng.range(-8, 8), -10, 0.35, 8, 3, 0.9, this.rng.next() < 0.5 ? 0xff7a1a : 0xffc040, 1, 8);
        }
        if (this.damage(i, this.eBurn[i] * DT, true, this.eBurnBy[i])) continue;
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
      if (!air) sp *= this.tarGrid[g];
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
        const field = this.fields[this.eRoute[i]];
        let cell = cy * COLS + cx;
        // brushing a tower corner can put us in a blocked cell: steer from the last good one
        if (this.blocked[cell] || field.dist[cell] === Infinity) cell = this.eCell[i];
        else this.eCell[i] = cell;
        const dist = field.dist[cell];
        this.eRemain[i] = dist * TILE;
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
  damage(i: number, amount: number, pierce: boolean, src: Tower | null, shatter = false): boolean {
    if (!this.eAlive[i]) return false;
    let a = amount * (1 + this.eJam[i]);
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
    if (src) src.damage += dealt;
    if (this.eHp[i] > 0) return false;
    if (src) src.kills++;
    this.totalKills++;
    this.money += Math.round(this.eReward[i] * (1 + this.salvageGrid[this.eGCell[i]]));
    const kind = this.eKind[i];
    const big = kind === EN_BOSS ? 3 : ENEMIES[kind].radius >= 10 ? 1.6 : kind === 0 ? 0.6 : 1.1;
    this.explosion(this.eX[i], this.eY[i], big, this.eAir[i] ? AIR_Z : 4);
    this.freeEnemy(i);
    return true;
  }

  /**
   * Best target in range by targeting mode. `skip` excludes one slot; `spot` > 0 means the unit must
   * be within `spot` px or under radar cover (artillery).
   */
  private findTarget(x: number, y: number, range: number, air: boolean, ground: boolean, mode: number, skip = -1, spot = 0): number {
    const n = this.hash.query(x, y, range, this.qbuf);
    const r2 = range * range;
    let best = -1;
    let bestScore = -Infinity;
    for (let k = 0; k < n; k++) {
      const i = this.qbuf[k];
      if (i === skip || !this.targetable(i)) continue;
      if (this.eAir[i] ? !air : !ground) continue;
      const dx = this.eX[i] - x;
      const dy = this.eY[i] - y;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      if (spot > 0 && d2 > spot * spot && !this.radarGrid[this.eGCell[i]]) continue;
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
      t.cd -= DT;
      t.beam = -1;
      this.updateTower(t);
    }
  }

  private updateTower(t: Tower): void {
    const def = TOWERS[t.type];
    const lv = def.levels[t.level];
    const range = lv.range * t.rangeMult;
    const rate = lv.rate * t.rateMult;
    const dmg = lv.damage * t.dmgMult;
    const airMult = def.airMult * t.airBonus;
    const ca = Math.cos(t.angle);
    const sa = Math.sin(t.angle);

    switch (t.kind) {
      // ------------------------------------------------ passive: auras, walls, floor traps
      case 'jammer': case 'depot': case 'radar': case 'command': case 'salvage':
      case 'barricade': case 'gate': case 'tar': case 'spikes':
        return;

      case 'orbital': case 'nuke':
        if (t.charge > 0) t.charge = Math.max(0, t.charge - DT);
        return;

      case 'emp': {
        if (t.cd > 0 || this.findTarget(t.x, t.y, range, true, true, 3) < 0) return;
        this.forEachInRange(t.x, t.y, range, true, true, (i) => {
          this.setSlow(i, lv.slow!, lv.slowTime!);
          this.damage(i, dmg, true, t);
        });
        this.fx(FX_RING, 1, t.x, t.y, 0, 0, 0.45, 8, range * 2, 0.8, 0x8cf0a8, 0, 0);
        t.cd = 1 / rate;
        return;
      }

      case 'mine': {
        if (t.cd > 0) return;
        const v = this.findTarget(t.x, t.y, lv.range, false, true, 3);
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
          const a = this.rng.next() * TWO_PI;
          const r = range * this.rng.range(0.5, 1);
          this.fx(FX_SPARK, 1, t.x + Math.cos(a) * r, t.y + Math.sin(a) * r, -Math.sin(a) * 60 - Math.cos(a) * 50, Math.cos(a) * 60 - Math.sin(a) * 50, 0.6, 5, 2, 0.8, 0xb080ff, 0, 3);
        }
        return;
      }

      case 'repulsor': {
        if (t.cd > 0 || this.findTarget(t.x, t.y, range, false, true, 3) < 0) return;
        this.forEachInRange(t.x, t.y, range, false, true, (i) => {
          const back = this.eKind[i] === EN_BOSS ? 0.25 : 1;
          // push against the direction of travel, so it has to walk that stretch again
          this.shove(i, -Math.cos(this.eAng[i]) * lv.knock! * back, -Math.sin(this.eAng[i]) * lv.knock! * back);
          this.damage(i, dmg, false, t);
        });
        this.fx(FX_RING, 1, t.x, t.y, 0, 0, 0.35, 10, range * 2, 0.9, 0x5ac8e8, 0, 0);
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
        t.cd = 1 / rate;
        return;
      }

      case 'hacker': {
        if (t.cd > 0) return;
        // the toughest vehicle in range that isn't a boss
        let best = -1;
        let hp = 0;
        this.forEachInRange(t.x, t.y, range, false, true, (i) => {
          if (this.eKind[i] === EN_BOSS || !this.targetable(i) || this.eKind[i] === 0) return;
          if (this.eHp[i] > hp) {
            hp = this.eHp[i];
            best = i;
          }
        });
        if (best < 0) return;
        this.aim(t, this.eX[best], this.eY[best]);
        this.eHackT[best] = lv.duration!;
        this.eHackDps[best] = dmg;
        this.streak(t.x, t.y, MUZZLE_Z + 6, this.eX[best], this.eY[best], 8, 0.5, 0x3aff8a, 2);
        this.fx(FX_RING, 1, this.eX[best], this.eY[best], 0, 0, 0.4, 6, 40, 0.9, 0x3aff8a, 0, 0);
        t.cd = 1 / rate;
        return;
      }
    }

    // ------------------------------------------------ everything below picks a target
    const spot = t.kind === 'arty' ? 140 : 0;
    const tgt = this.findTarget(t.x, t.y, range, def.hitsAir, def.hitsGround, t.mode, -1, spot);
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
      this.tesla(t, tgt, dmg, lv.chain!);
      t.cd = 1 / rate;
      return;
    }
    // turrets keep tracking while reloading
    if (!this.aim(t, tx, ty)) return;

    if (t.kind === 'laser') {
      t.beam = tgt;
      this.damage(tgt, dmg * (this.eAir[tgt] ? airMult : 1) * DT, true, t);
      if ((this.ticks & 3) === 0 && this.eAlive[tgt]) {
        this.fx(FX_SPARK, 1, tx, ty, this.rng.range(-80, 80), this.rng.range(-80, 80), 0.2, 3, 1, 1, 0xff8a8a, 4, tz);
      }
      return;
    }
    if (t.kind === 'flame') {
      t.firing = 0.12;
      const mx = t.x + ca * 16;
      const my = t.y + sa * 16;
      for (let k = 0; k < 2; k++) {
        const a = t.angle + this.rng.range(-0.28, 0.28);
        const s = this.rng.range(150, 230);
        this.fx(FX_GLOW, 1, mx, my, Math.cos(a) * s, Math.sin(a) * s, range / s * 1.1, 5, 22, 0.75, k ? 0xff9a2a : 0xffd060, 1.5, MUZZLE_Z - 4);
      }
      if (this.ticks % 4 === 0) {
        if (this.rng.next() < 0.5) this.fx(FX_SMOKE, 0, mx + ca * range * 0.7, my + sa * range * 0.7, ca * 30, sa * 30, 0.8, 8, 22, 0.3, 0x3a3430, 1, 10);
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
          for (let k = 0; k < 6; k++) this.fx(FX_SMOKE, 0, mx, my, this.rng.range(-30, 30), this.rng.range(-40, -10), 1, 6, 18, 0.5, 0xd0d0d0, 2, MUZZLE_Z);
        }
        break;
      }
      case 'cannon':
        this.lob(P_SHELL, t, tgt, mx, my, 420, dmg, lv.splash!);
        this.muzzleFlash(mx, my, 16, 0xffc070);
        for (let s = 0; s < 3; s++) this.fx(FX_SMOKE, 0, mx, my, ca * 40 + this.rng.range(-20, 20), sa * 40 + this.rng.range(-20, 20), 0.6, 6, 16, 0.5, 0x9a948a, 3, MUZZLE_Z);
        break;
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
        for (let s = 0; s < 6; s++) this.fx(FX_SMOKE, 0, mx, my, ca * 60 + this.rng.range(-30, 30), sa * 60 + this.rng.range(-30, 30), 1, 8, 26, 0.55, 0x9a948a, 3, MUZZLE_Z);
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
        for (let k = 0; k < 8; k++) this.fx(FX_SPARK, 1, mx + ca * k * range / 8, my + sa * k * range / 8, this.rng.range(-40, 40), this.rng.range(-40, 40), 0.3, 4, 1, 0.9, 0x8ad4ff, 3, MUZZLE_Z);
        break;
      }
    }
    t.cd = cd;
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
            if (d < 16 && this.eKind[i] !== EN_BOSS && this.eHp[i] < this.eMaxHp[i] * 0.25) {
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
        const a = this.rng.next() * TWO_PI;
        const r = Math.sqrt(this.rng.next()) * zn.r * 0.85;
        this.fx(FX_GLOW, 1, zn.x + Math.cos(a) * r, zn.y + Math.sin(a) * r, 0, -12, 0.5, 10 * life + 4, 3, 0.85, this.rng.next() < 0.5 ? 0xff6a1a : 0xffb040, 1, 4);
        if (this.rng.next() < 0.2) this.fx(FX_SMOKE, 0, zn.x + Math.cos(a) * r, zn.y + Math.sin(a) * r, 0, -10, 1.2, 8, 24, 0.3, 0x2a2420, 1, 12);
      } else if (zn.kind === Z_GAS && this.ticks % 3 === 0) {
        const a = this.rng.next() * TWO_PI;
        const r = Math.sqrt(this.rng.next()) * zn.r * 0.8;
        this.fx(FX_SMOKE, 0, zn.x + Math.cos(a) * r, zn.y + Math.sin(a) * r, zn.vx, zn.vy, 1.4, zn.r * 0.5, zn.r * 0.9, 0.35 * Math.min(1, life * 3), zn.burn ? 0xb0a040 : 0x8ac84a, 0.5, 4);
      } else if (zn.kind === Z_HOLE && (this.ticks & 1) === 0) {
        const a = this.rng.next() * TWO_PI;
        const r = zn.r * this.rng.range(0.6, 1.1);
        this.fx(FX_SPARK, 1, zn.x + Math.cos(a) * r, zn.y + Math.sin(a) * r, -Math.cos(a) * r * 2 - Math.sin(a) * 90, -Math.sin(a) * r * 2 + Math.cos(a) * 90, 0.45, 6, 1, 0.9, this.rng.next() < 0.5 ? 0xa060ff : 0xe0c0ff, 0, 6);
      } else if (zn.kind === Z_ORBITAL) {
        if ((this.ticks & 1) === 0) this.streak(zn.x, zn.y, 600, zn.x, zn.y, 0, 0.05, 0xff4a7a, zn.r * 0.7);
        const a = this.rng.next() * TWO_PI;
        this.fx(FX_SPARK, 1, zn.x, zn.y, Math.cos(a) * 160, Math.sin(a) * 160, 0.3, 6, 1, 1, 0xffa0c0, 3, 2);
        if (this.ticks % 4 === 0) this.fx(FX_SMOKE, 0, zn.x, zn.y, this.rng.range(-20, 20), this.rng.range(-20, 20), 1, 10, 30, 0.4, 0x2a2224, 1, 4);
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
  private splash(x: number, y: number, r: number, dmg: number, mask: number, airMult: number, src: Tower | null, shatter = false): void {
    this.forEachInRange(x, y, r, (mask & 2) !== 0, (mask & 1) !== 0, (i) => {
      const d2 = (this.eX[i] - x) ** 2 + (this.eY[i] - y) ** 2;
      const fall = 1 - 0.5 * Math.sqrt(d2 / (r * r));
      this.damage(i, dmg * fall * (this.eAir[i] ? airMult : 1), false, src, shatter);
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
        for (let k = 0; k < 6; k++) this.fx(FX_SMOKE, 0, x, y, this.rng.range(-40, 40), this.rng.range(-40, 40), 1, 10, r, 0.5, 0x9bd15a, 3, 4);
        break;
      case P_NUKE:
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
        for (let k = 0; k < 4; k++) this.fx(FX_SMOKE, 0, x, y, this.rng.range(-25, 25), this.rng.range(-25, 25), 0.9, 8, 22, 0.6, 0x2a2826, 2, AIR_Z + 4);
        break;
      case P_ACID:
        this.forEachInRange(x, y, r, true, true, (i) => {
          this.eShred[i] = Math.max(this.eShred[i], this.pExtra[p]);
          this.eShredT[i] = this.pExtra2[p];
          this.damage(i, dmg, false, src);
        });
        for (let k = 0; k < 6; k++) this.fx(FX_GLOW, 1, x, y, this.rng.range(-50, 50), this.rng.range(-50, 50), 0.4, 6, 2, 0.8, 0xa6e22e, 4, 4);
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

      if (kind === P_BULLET || kind === P_ACID || kind === P_CRYO) {
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
          if (kind !== P_BULLET) this.impact(p, kind, this.pTx[p], this.pTy[p]);
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
          this.fx(FX_SMOKE, 0, this.pX[p], this.pY[p], this.rng.range(-8, 8), this.rng.range(-8, 8), 0.5, 3, 9, 0.45, 0xc8c4bc, 2, this.missileZ(p));
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
    if (this.fCount >= MAX_FX) return;
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
    this.fRot[f] = tex === FX_SPARK ? Math.atan2(vy, vx) : this.rng.next() * TWO_PI;
    this.fColor[f] = color;
    this.fDrag[f] = drag;
  }

  private burst(x: number, y: number, color: number, n: number, tex: number, add: number): void {
    for (let k = 0; k < n; k++) {
      const a = this.rng.next() * TWO_PI;
      const s = this.rng.range(30, 90);
      this.fx(tex, add, x, y, Math.cos(a) * s, Math.sin(a) * s, this.rng.range(0.3, 0.6), tex === FX_SMOKE ? 8 : 4, tex === FX_SMOKE ? 18 : 1, 0.8, color, 4);
    }
  }

  explosion(x: number, y: number, size: number, z = 4): void {
    // degrade gracefully when the effect pool is busy
    const load = this.fCount / MAX_FX;
    const q = load > 0.8 ? 0.25 : load > 0.5 ? 0.6 : 1;
    const rng = this.rng;
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

