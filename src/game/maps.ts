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
  },
  {
    name: 'Boulder Pass',
    desc: 'Corner to corner through a rocky field.',
    seed: 37,
    cols: 120,
    rows: 80,
    routes: [{ entry: { side: 'L', from: 4, to: 7 }, exit: { side: 'R', from: 72, to: 75 } }],
    rocks: 150,
  },
  {
    name: 'The Gauntlet',
    desc: 'A long, narrow strip. Plenty of road to fill with guns.',
    seed: 53,
    cols: 176,
    rows: 48,
    routes: [{ entry: { side: 'L', from: 22, to: 25 }, exit: { side: 'R', from: 22, to: 25 } }],
    rocks: 60,
  },
  {
    name: 'Badlands',
    desc: 'A huge rocky front with three assault routes. Spread out or funnel them together.',
    seed: 71,
    cols: 160,
    rows: 104,
    routes: [
      { entry: { side: 'L', from: 22, to: 25 }, exit: { side: 'R', from: 78, to: 81 } },
      { entry: { side: 'T', from: 70, to: 73 }, exit: { side: 'B', from: 70, to: 73 } },
      { entry: { side: 'B', from: 128, to: 131 }, exit: { side: 'L', from: 80, to: 83 } },
    ],
    rocks: 180,
  },
];

/** Every map module (sim, flow fields, renderer) reads the live map size; call before building. */
export function useMapSize(def: MapDef): void {
  setMapSize(def.cols, def.rows);
}

export const T_BUILD = 0;
export const T_ROCK = 1;
export const T_GATE = 2; // walkable, never buildable

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
  const visit = (j: number) => {
    if (seen[j] || blocked[j]) return;
    seen[j] = 1;
    queue[tail++] = j;
  };
  while (head < tail) {
    const i = queue[head++];
    const c = i % COLS;
    if (c > 0) visit(i - 1);
    if (c < COLS - 1) visit(i + 1);
    if (i >= COLS) visit(i - COLS);
    if (i + COLS < seen.length) visit(i + COLS);
  }
  return route.entry.every((i) => seen[i]);
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

  // scatter rocks, rejecting any that would cut a route
  const rng = new Rng(def.seed);
  const rocks: GameMap['rocks'] = [];
  const blocked = new Uint8Array(COLS * ROWS);
  const seen = new Uint8Array(COLS * ROWS);
  const queue = new Int32Array(COLS * ROWS);
  const tryRock = (c: number, r: number, s: number): boolean => {
    const cells: number[] = [];
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) cells.push((r + dy) * COLS + c + dx);
    if (c < 0 || r < 0 || c + s > COLS || r + s > ROWS || cells.some((i) => grid[i] !== T_BUILD)) return false;
    for (const i of cells) blocked[i] = 1;
    let ok = true;
    for (let k = 0; k < routes.length && ok; k++) ok = connected(blocked, routes[k], seen, queue);
    if (!ok) {
      for (const i of cells) blocked[i] = 0;
      return false;
    }
    for (const i of cells) grid[i] = T_ROCK;
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
