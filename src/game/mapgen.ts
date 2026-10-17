// Seeded random maps: pick a size, a number of routes and a rock density, get a playable MapDef.
// The same options and seed always produce the same map, so a map can be shared as a short code.

import type { Gate, MapDef, Side } from './maps';
import { Rng } from './rng';

export type MapSize = 'S' | 'M' | 'L' | 'XL';

export const MAP_SIZES: Record<MapSize, { name: string; cols: number; rows: number }> = {
  S: { name: 'Small', cols: 72, rows: 48 },
  M: { name: 'Medium', cols: 104, rows: 68 },
  L: { name: 'Large', cols: 136, rows: 88 },
  XL: { name: 'Huge', cols: 176, rows: 112 },
};

export interface RandomMapOptions {
  seed: number;
  size: MapSize;
  routes: number; // 1-3
  density: number; // 0-3: rocks per 1000 cells ≈ density * 6
}

const GATE_W = 4;
const OPPOSITE: Record<Side, Side> = { L: 'R', R: 'L', T: 'B', B: 'T' };

/** Short shareable code, e.g. "M2-1-48213". */
export function mapCode(o: RandomMapOptions): string {
  return `${o.size}${o.routes}-${o.density}-${o.seed}`;
}

export function parseMapCode(code: string): RandomMapOptions | null {
  const m = /^(S|M|L|XL)([1-3])-([0-3])-(\d{1,9})$/.exec(code.trim().toUpperCase());
  return m ? { size: m[1] as MapSize, routes: Number(m[2]), density: Number(m[3]), seed: Number(m[4]) } : null;
}

export function randomMap(o: RandomMapOptions): MapDef {
  const rng = new Rng(o.seed * 2654435761 >>> 0 || 1);
  const { cols, rows, name } = MAP_SIZES[o.size];
  const used: Record<Side, [number, number][]> = { L: [], R: [], T: [], B: [] };
  const len = (side: Side) => (side === 'L' || side === 'R' ? rows : cols);
  // a free stretch of edge for a gate, away from corners and other gates
  const gate = (side: Side, near?: number): Gate | null => {
    const n = len(side);
    for (let attempt = 0; attempt < 40; attempt++) {
      const from = near !== undefined && attempt < 20
        ? Math.round(near + rng.range(-n * 0.35, n * 0.35))
        : 3 + rng.int(n - 6 - GATE_W);
      const to = from + GATE_W - 1;
      if (from < 3 || to > n - 4) continue;
      if (used[side].some(([a, b]) => from <= b + 6 && to >= a - 6)) continue;
      used[side].push([from, to]);
      return { side, from, to };
    }
    return null;
  };
  const sides: Side[] = ['L', 'R', 'T', 'B'];
  const routes: MapDef['routes'] = [];
  for (let k = 0; k < o.routes; k++) {
    // mostly across the map, sometimes around a corner
    const start = k === 0 ? 'L' : sides[rng.int(4)];
    const end = rng.next() < 0.7 ? OPPOSITE[start] : sides.filter((s) => s !== start && s !== OPPOSITE[start])[rng.int(2)];
    const entry = gate(start);
    const exit = entry && gate(end, end === OPPOSITE[start] ? entry.from : undefined);
    if (entry && exit) routes.push({ entry, exit });
  }
  return {
    name: `Random ${name}`,
    desc: `Seed ${mapCode(o)}`,
    seed: o.seed,
    cols,
    rows,
    routes,
    rocks: Math.round(((cols * rows) / 1000) * o.density * 6),
  };
}

/** Today's date as YYYY-MM-DD (local time), the key of the daily challenge. */
export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The same random map, tower set and twist for everyone on a given day. */
export function dailySetup(date: string): { opts: RandomMapOptions; towerSeed: number } {
  let h = 2166136261;
  for (const ch of date) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const seed = (h >>> 0) % 1_000_000_000;
  const rng = new Rng(seed);
  const sizes: MapSize[] = ['S', 'M', 'L'];
  return {
    opts: { seed, size: sizes[rng.int(3)], routes: 1 + rng.int(3), density: 1 + rng.int(3) },
    towerSeed: rng.int(1_000_000),
  };
}
