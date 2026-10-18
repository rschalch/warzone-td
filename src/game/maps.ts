import { COLS, ROWS, TILE, setMapSize } from './defs';
import { Rng } from './rng';

export type Side = 'L' | 'R' | 'T' | 'B';

/** An opening on one edge of the map, as an inclusive cell range along that edge. */
export interface Gate {
  side: Side;
  from: number;
  to: number;
}

export interface MapDef {
  name: string;
  desc: string;
  seed: number;
  cols: number;
  rows: number;
  routes: { entry: Gate; exit: Gate }[];
  rocks: number; // how many to scatter (ignored when rockList is given)
  /** Exact rocks, for hand-made maps from the editor. */
  rockList?: { c: number; r: number; s: number }[];
  /** Rivers to run across the map (walkable water that slows ground units, never buildable). */
  rivers?: number;
  /** Mountain ranges to raise (impassable massifs; they never cut a route). */
  mountains?: number;
  /** Groves of trees to plant (impassable, unbuildable; they never cut a route). */
  forests?: number;
  /** Hand-painted water and mountain cells from the editor, run-length encoded (see encodePaint). */
  paint?: string;
}

export const MAPS: MapDef[] = [
  {
    name: 'Open Field',
    desc: 'One way in, one way out across a wide plain. Build the longest maze you can.',
    seed: 11,
    cols: 96,
    rows: 64,
    routes: [{ entry: { side: 'L', from: 30, to: 33 }, exit: { side: 'R', from: 30, to: 33 } }],
    rocks: 28,
    forests: 9,
    rivers: 1,
    mountains: 3,
  },
  {
    name: 'Crossfire',
    desc: 'Two crossing routes share the field. One maze must serve both.',
    seed: 23,
    cols: 104,
    rows: 72,
    routes: [
      { entry: { side: 'L', from: 34, to: 37 }, exit: { side: 'R', from: 34, to: 37 } },
      { entry: { side: 'T', from: 50, to: 53 }, exit: { side: 'B', from: 50, to: 53 } },
    ],
    rocks: 40,
    forests: 11,
    rivers: 1,
    mountains: 4,
  },
  {
    name: 'Boulder Pass',
    desc: 'Corner to corner through a rocky field and the mountains around it.',
    seed: 37,
    cols: 120,
    rows: 80,
    routes: [{ entry: { side: 'L', from: 4, to: 7 }, exit: { side: 'R', from: 72, to: 75 } }],
    rocks: 150,
    forests: 7,
    mountains: 7,
  },
  {
    name: 'The Gauntlet',
    desc: 'A long, narrow strip crossed by two rivers. Plenty of road to fill with guns.',
    seed: 53,
    cols: 176,
    rows: 48,
    routes: [{ entry: { side: 'L', from: 22, to: 25 }, exit: { side: 'R', from: 22, to: 25 } }],
    rocks: 60,
    forests: 9,
    rivers: 2,
    mountains: 4,
  },
  {
    name: 'Badlands',
    desc: 'A huge front of rock, mountains and a river, with three assault routes. Spread out or funnel them together.',
    seed: 71,
    cols: 160,
    rows: 104,
    routes: [
      { entry: { side: 'L', from: 22, to: 25 }, exit: { side: 'R', from: 78, to: 81 } },
      { entry: { side: 'T', from: 70, to: 73 }, exit: { side: 'B', from: 70, to: 73 } },
      { entry: { side: 'B', from: 128, to: 131 }, exit: { side: 'L', from: 80, to: 83 } },
    ],
    rocks: 180,
    forests: 14,
    rivers: 1,
    mountains: 7,
  },
];

/** Every map module (sim, flow fields, renderer) reads the live map size; call before building. */
export function useMapSize(def: MapDef): void {
  setMapSize(def.cols, def.rows);
}

export const T_BUILD = 0;
export const T_ROCK = 1;
export const T_GATE = 2; // walkable, never buildable
export const T_WATER = 3; // walkable but slow, never buildable
export const T_MOUNT = 4; // impassable, never buildable
export const T_TREE = 5; // forest: impassable, never buildable

/** Ground units wade through water at this fraction of their speed. */
export const WATER_SLOW = 0.55;

export interface Route {
  entry: number[]; // cells
  exit: number[];
  inDir: [number, number]; // unit vector pointing into the map at the entry
  outDir: [number, number]; // unit vector pointing out of the map at the exit
  airFrom: [number, number]; // px, just outside the map
  airTo: [number, number];
}

export interface GameMap {
  def: MapDef;
  grid: Uint8Array;
  routes: Route[];
  rocks: { c: number; r: number; s: number }[]; // s = size in cells
}

const GATE_DEPTH = 2;

function gateCells(g: Gate, depth: number): number[] {
  const out: number[] = [];
  for (let k = g.from; k <= g.to; k++) {
    for (let d = 0; d < depth; d++) {
      let c: number;
      let r: number;
      if (g.side === 'L') [c, r] = [d, k];
      else if (g.side === 'R') [c, r] = [COLS - 1 - d, k];
      else if (g.side === 'T') [c, r] = [k, d];
      else [c, r] = [k, ROWS - 1 - d];
      out.push(r * COLS + c);
    }
  }
  return out;
}

const inward: Record<Side, [number, number]> = { L: [1, 0], R: [-1, 0], T: [0, 1], B: [0, -1] };

function gateCenter(g: Gate, outside: number): [number, number] {
  const mid = ((g.from + g.to + 1) / 2) * TILE;
  if (g.side === 'L') return [-outside, mid];
  if (g.side === 'R') return [COLS * TILE + outside, mid];
  if (g.side === 'T') return [mid, -outside];
  return [mid, ROWS * TILE + outside];
}

/**
 * Can a ground unit get from every entry cell to the exit? A plain 4-neighbour flood fill:
 * diagonal moves never cut corners, so they can't connect anything 4-neighbour moves can't.
 * Much cheaper than a full flow field, which matters when scattering hundreds of rocks.
 */
function connected(blocked: Uint8Array, route: Route, seen: Uint8Array, queue: Int32Array): boolean {
  seen.fill(0);
  let head = 0;
  let tail = 0;
  for (const i of route.exit) {
    seen[i] = 1;
    queue[tail++] = i;
  }
  // stop as soon as every entry cell is reached
  let left = 0;
  for (const i of route.entry) {
    if (seen[i]) continue;
    seen[i] = 2;
    left++;
  }
  const visit = (j: number) => {
    if (seen[j] === 1 || blocked[j]) return;
    if (seen[j] === 2) left--;
    seen[j] = 1;
    queue[tail++] = j;
  };
  while (head < tail && left > 0) {
    const i = queue[head++];
    const c = i % COLS;
    if (c > 0) visit(i - 1);
    if (c < COLS - 1) visit(i + 1);
    if (i >= COLS) visit(i - COLS);
    if (i + COLS < seen.length) visit(i + COLS);
  }
  return left === 0;
}

/** Run-length encodes the water / mountain cells of a grid for MapDef.paint: "<type><run, base 36>" joined by dots. */
export function encodePaint(cells: ArrayLike<number>): string {
  const out: string[] = [];
  for (let i = 0; i < cells.length;) {
    let j = i;
    while (j < cells.length && cells[j] === cells[i]) j++;
    out.push(`${cells[i]}${(j - i).toString(36)}`);
    i = j;
  }
  return out.join('.');
}

export function decodePaint(paint: string, n: number): Uint8Array {
  const cells = new Uint8Array(n);
  let i = 0;
  for (const run of paint.split('.')) {
    const t = Number(run[0]);
    const len = parseInt(run.slice(1), 36) || 0;
    if (t === T_WATER || t === T_MOUNT || t === T_TREE) cells.fill(t, i, Math.min(n, i + len));
    i += len;
  }
  return cells;
}

/** Smooth seeded value noise in [0,1) over the cell grid, one lattice point every `step` cells. */
function valueNoise(rng: Rng, step: number): (c: number, r: number) => number {
  const w = Math.ceil(COLS / step) + 2;
  const h = Math.ceil(ROWS / step) + 2;
  const v = new Float32Array(w * h);
  for (let i = 0; i < v.length; i++) v[i] = rng.next();
  return (c, r) => {
    const x = Math.max(0, c / step);
    const y = Math.max(0, r / step);
    const ix = Math.min(w - 2, x | 0);
    const iy = Math.min(h - 2, y | 0);
    let fx = x - ix;
    let fy = y - iy;
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    const a = v[iy * w + ix] + (v[iy * w + ix + 1] - v[iy * w + ix]) * fx;
    const b = v[(iy + 1) * w + ix] + (v[(iy + 1) * w + ix + 1] - v[(iy + 1) * w + ix]) * fx;
    return a + (b - a) * fy;
  };
}

/** 4-neighbour steps from each cell to the nearest gate cell, capped at `cap`. */
function gateDistance(grid: Uint8Array, cap: number): Uint8Array {
  const d = new Uint8Array(grid.length).fill(cap);
  const queue: number[] = [];
  for (let i = 0; i < grid.length; i++) if (grid[i] === T_GATE) {
    d[i] = 0;
    queue.push(i);
  }
  for (let h = 0; h < queue.length; h++) {
    const i = queue[h];
    if (d[i] + 1 >= cap) continue;
    const c = i % COLS;
    for (const j of [c > 0 ? i - 1 : -1, c < COLS - 1 ? i + 1 : -1, i - COLS, i + COLS]) {
      if (j < 0 || j >= grid.length || d[j] <= d[i] + 1) continue;
      d[j] = d[i] + 1;
      queue.push(j);
    }
  }
  return d;
}

/**
 * A meandering river across the map, perpendicular to the first route so ground units have to
 * wade through it (rather than wading along it). `at` is where it crosses, as a fraction of the map.
 */
function carveRiver(grid: Uint8Array, rng: Rng, vertical: boolean, at: number): void {
  const len = vertical ? ROWS : COLS;
  const span = vertical ? COLS : ROWS;
  const wander = valueNoise(rng, 9);
  const amp = span * rng.range(0.05, 0.1);
  const freq = rng.range(0.8, 1.8);
  const phase = rng.range(0, Math.PI * 2);
  const base = span * at;
  let prev = -1;
  for (let t = 0; t < len; t++) {
    const centre = base + amp * Math.sin((t / len) * Math.PI * 2 * freq + phase) + (wander(t, at * 50) - 0.5) * span * 0.12;
    const half = 1 + 1.4 * wander(at * 50 + 7, t);
    const lo = Math.round(Math.min(centre, prev < 0 ? centre : prev) - half);
    const hi = Math.round(Math.max(centre, prev < 0 ? centre : prev) + half);
    prev = centre;
    for (let k = Math.max(0, lo); k <= Math.min(span - 1, hi); k++) {
      const i = vertical ? t * COLS + k : k * COLS + t;
      if (grid[i] === T_BUILD) grid[i] = T_WATER;
    }
  }
}

/** Signed turn from heading a to heading b, in (-π, π]. */
function angleTo(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function buildMap(def: MapDef): GameMap {
  useMapSize(def);
  const grid = new Uint8Array(COLS * ROWS);
  const routes: Route[] = def.routes.map(({ entry, exit }) => {
    for (const i of gateCells(entry, GATE_DEPTH)) grid[i] = T_GATE;
    for (const i of gateCells(exit, GATE_DEPTH)) grid[i] = T_GATE;
    const [ix, iy] = inward[exit.side];
    return {
      entry: gateCells(entry, 1),
      exit: gateCells(exit, 1),
      inDir: inward[entry.side],
      outDir: [-ix, -iy] as [number, number],
      airFrom: gateCenter(entry, TILE),
      airTo: gateCenter(exit, TILE),
    };
  });

  const blocked = new Uint8Array(COLS * ROWS);
  const seen = new Uint8Array(COLS * ROWS);
  const queue = new Int32Array(COLS * ROWS);
  const allOpen = () => {
    for (const route of routes) if (!connected(blocked, route, seen, queue)) return false;
    return true;
  };
  // Blocking `cells` keeps every route open if the free cells bordering them stay connected to one
  // another: any path that crossed them can then detour. That search is usually local and tiny; only
  // when it fails (it may have sealed a pocket nobody needs) does the full per-route check run.
  const stamp = new Int32Array(COLS * ROWS);
  let gen = 0;
  const keepsOpen = (cells: number[]) => {
    for (const i of cells) blocked[i] = 1;
    gen += 2;
    const ring: number[] = [];
    const neighbours = (i: number, fn: (j: number) => void) => {
      const c = i % COLS;
      if (c > 0) fn(i - 1);
      if (c < COLS - 1) fn(i + 1);
      if (i >= COLS) fn(i - COLS);
      if (i + COLS < blocked.length) fn(i + COLS);
    };
    for (const i of cells) neighbours(i, (j) => {
      if (!blocked[j] && stamp[j] !== gen) {
        stamp[j] = gen;
        ring.push(j);
      }
    });
    let left = ring.length - 1;
    let head = 0;
    let tail = 0;
    if (ring.length) {
      stamp[ring[0]] = gen + 1;
      queue[tail++] = ring[0];
    }
    while (head < tail && left > 0) {
      neighbours(queue[head++], (j) => {
        if (blocked[j] || stamp[j] === gen + 1) return;
        if (stamp[j] === gen) left--;
        stamp[j] = gen + 1;
        queue[tail++] = j;
      });
    }
    const ok = left <= 0 || allOpen();
    for (const i of cells) blocked[i] = 0;
    return ok;
  };

  // hand-painted terrain; mountain cells that would cut a route are dropped, as rocks are
  if (def.paint) {
    const painted = decodePaint(def.paint, grid.length);
    const mount: number[] = [];
    for (let i = 0; i < grid.length; i++) {
      if (grid[i] !== T_BUILD || !painted[i]) continue;
      grid[i] = painted[i];
      if (painted[i] === T_MOUNT || painted[i] === T_TREE) {
        blocked[i] = 1;
        mount.push(i);
      }
    }
    if (!allOpen()) {
      for (const i of mount) blocked[i] = 0;
      for (const i of mount) {
        blocked[i] = 1;
        if (!allOpen()) {
          blocked[i] = 0;
          grid[i] = T_BUILD;
        }
      }
    }
  }

  // rivers cross the first route's direction; several are spread out along it
  const tr = new Rng(def.seed * 31 + 7);
  const rivers = def.rivers ?? 0;
  const side = def.routes[0]?.entry.side ?? 'L';
  const vertical = side === 'L' || side === 'R';
  // gates on the edges a river runs into: keep the river well away, or it becomes a road along a route
  const ends = def.routes.flatMap((r) => [r.entry, r.exit]).filter((g) => (g.side === 'T' || g.side === 'B') === vertical);
  const span = vertical ? COLS : ROWS;
  for (let k = 0; k < rivers; k++) {
    let at = (k + 1) / (rivers + 1);
    for (let attempt = 0; attempt < 24; attempt++) {
      const cand = (k + 1) / (rivers + 1) + tr.range(-0.12, 0.12) * (1 + attempt / 6);
      if (cand < 0.15 || cand > 0.85) continue;
      at = cand;
      if (ends.every((g) => Math.abs((g.from + g.to) / 2 - cand * span) > span * 0.16 + 6)) break;
    }
    carveRiver(grid, tr, vertical, at);
  }

  // mountain ranges: chains of noisy discs along a wandering ridge line, gathered around the middle
  // of the map. A disc that would cut a route is skipped, which leaves a pass through the range.
  // They keep clear of the gates and of the outer band of the map.
  const ranges = def.mountains ?? 0;
  if (ranges) {
    const edge = valueNoise(tr, 3);
    const nearGate = gateDistance(grid, 16);
    const cap = grid.length * 0.2;
    const cx = COLS / 2;
    const cy = ROWS / 2;
    // spread from the centre: triangular, so most land in the middle third
    const central = (half: number) => (tr.next() + tr.next() - 1) * half;
    let raised = 0;
    for (let m = 0; m < ranges && raised < cap; m++) {
      let x = 0;
      let y = 0;
      // each range starts clear of the others, so they stay separate massifs with valleys between
      const clear = (c: number, r: number) => {
        for (let y2 = Math.max(0, r - 9); y2 <= Math.min(ROWS - 1, r + 9); y2++) {
          for (let x2 = Math.max(0, c - 9); x2 <= Math.min(COLS - 1, c + 9); x2++) if (grid[y2 * COLS + x2] === T_MOUNT) return false;
        }
        return true;
      };
      for (let attempt = 0; attempt < 40; attempt++) {
        x = cx + central(COLS * (0.3 + attempt * 0.004));
        y = cy + central(ROWS * (0.3 + attempt * 0.004));
        if (nearGate[(y | 0) * COLS + (x | 0)] >= 16 && grid[(y | 0) * COLS + (x | 0)] === T_BUILD && clear(x | 0, y | 0)) break;
      }
      let heading = tr.range(0, Math.PI * 2);
      const length = Math.max(COLS, ROWS) * tr.range(0.18, 0.36);
      const peak = tr.range(4.5, 8);
      for (let walked = 0, stride = 1.8; walked < length; walked += stride) {
        const radius = peak * (0.45 + 0.55 * Math.sqrt(Math.sin((walked / length) * Math.PI)));
        const cells: number[] = [];
        for (let r = Math.floor(y - radius - 2); r <= y + radius + 2; r++) {
          for (let c = Math.floor(x - radius - 2); c <= x + radius + 2; c++) {
            if (c < 1 || r < 1 || c >= COLS - 1 || r >= ROWS - 1) continue;
            const i = r * COLS + c;
            if (grid[i] !== T_BUILD || nearGate[i] < 7) continue;
            if (Math.hypot(c + 0.5 - x, r + 0.5 - y) > radius * (0.7 + 0.6 * edge(c, r))) continue;
            cells.push(i);
          }
        }
        if (keepsOpen(cells)) {
          for (const i of cells) {
            grid[i] = T_MOUNT;
            blocked[i] = 1;
          }
          raised += cells.length;
        }
        heading += tr.range(-0.35, 0.35);
        // ridges that wander away from the middle curve back towards it
        const off = Math.max(Math.abs(x - cx) / COLS, Math.abs(y - cy) / ROWS);
        if (off > 0.22) heading += angleTo(heading, Math.atan2(cy - y, cx - x)) * Math.min(0.5, (off - 0.22) * 4);
        stride = Math.max(1.8, radius * 0.6);
        x += Math.cos(heading) * stride;
        y += Math.sin(heading) * stride;
        if (Math.abs(x - cx) > COLS * 0.4 || Math.abs(y - cy) > ROWS * 0.4) break;
      }
    }
  }

  // groves: noisy blobs of trees anywhere on open ground (big woods and small copses), clear of the
  // gates; a grove that would cut a route is skipped
  const groves = def.forests ?? 0;
  if (groves) {
    const fr = new Rng(def.seed * 53 + 11);
    const edge = valueNoise(fr, 2);
    const nearGate = gateDistance(grid, 10);
    for (let g = 0; g < groves; g++) {
      const big = fr.next() < 0.45;
      const radius = big ? fr.range(2.5, 4.5) : fr.range(1.2, 2.4);
      let x = 0;
      let y = 0;
      let ok = false;
      for (let attempt = 0; attempt < 30 && !ok; attempt++) {
        x = fr.range(3, COLS - 3);
        y = fr.range(2, ROWS - 2);
        const i = (y | 0) * COLS + (x | 0);
        ok = grid[i] === T_BUILD && nearGate[i] >= 10;
      }
      if (!ok) continue;
      // a big wood is a few overlapping blobs
      const parts = big ? 2 + fr.int(3) : 1;
      for (let p = 0; p < parts; p++) {
        const px = x + (p ? fr.range(-radius, radius) * 1.2 : 0);
        const py = y + (p ? fr.range(-radius, radius) * 1.2 : 0);
        const pr = radius * (p ? fr.range(0.6, 0.9) : 1);
        const cells: number[] = [];
        for (let r = Math.floor(py - pr - 1); r <= py + pr + 1; r++) {
          for (let c = Math.floor(px - pr - 1); c <= px + pr + 1; c++) {
            if (c < 1 || r < 1 || c >= COLS - 1 || r >= ROWS - 1) continue;
            const i = r * COLS + c;
            if (grid[i] !== T_BUILD || nearGate[i] < 5) continue;
            if (Math.hypot(c + 0.5 - px, r + 0.5 - py) > pr * (0.65 + 0.7 * edge(c, r))) continue;
            cells.push(i);
          }
        }
        if (cells.length && keepsOpen(cells)) {
          for (const i of cells) {
            grid[i] = T_TREE;
            blocked[i] = 1;
          }
        }
      }
    }
  }

  // scatter rocks, rejecting any that would cut a route
  const rng = new Rng(def.seed);
  const rocks: GameMap['rocks'] = [];
  const tryRock = (c: number, r: number, s: number): boolean => {
    const cells: number[] = [];
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) cells.push((r + dy) * COLS + c + dx);
    if (c < 0 || r < 0 || c + s > COLS || r + s > ROWS || cells.some((i) => grid[i] !== T_BUILD)) return false;
    if (!keepsOpen(cells)) return false;
    for (const i of cells) {
      grid[i] = T_ROCK;
      blocked[i] = 1;
    }
    rocks.push({ c, r, s });
    return true;
  };
  if (def.rockList) {
    for (const k of def.rockList) tryRock(k.c, k.r, k.s);
    return { def, grid, routes, rocks };
  }
  let tries = 0;
  while (rocks.length < def.rocks && tries++ < def.rocks * 20) {
    const s = rng.next() < 0.4 ? 2 : 1;
    let c = 3 + rng.int(COLS - 6 - s);
    let r = 1 + rng.int(ROWS - 2 - s);
    if (rocks.length && rng.next() < 0.55) {
      // grow an existing outcrop so big maps get rock fields rather than even speckle
      const near = rocks[rng.int(rocks.length)];
      c = near.c + rng.int(5) - 2;
      r = near.r + rng.int(5) - 2;
      if (c < 3 || r < 1 || c + s > COLS - 3 || r + s > ROWS - 1) continue;
    }
    tryRock(c, r, s);
  }
  return { def, grid, routes, rocks };
}
