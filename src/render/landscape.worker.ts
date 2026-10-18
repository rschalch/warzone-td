// Builds a landscape (erosion is the slow part) off the main thread; see refineBackground() in atlas.ts.

import { setMapSize } from '../game/defs';
import type { GameMap } from '../game/maps';
import { buildLandscape } from './landscape';

interface Job {
  cols: number;
  rows: number;
  grid: Uint8Array;
  seed: number;
  sub: number;
}

self.onmessage = (e: MessageEvent<Job>) => {
  const { cols, rows, grid, seed, sub } = e.data;
  setMapSize(cols, rows);
  const L = buildLandscape({ grid, def: { seed } } as unknown as GameMap, sub);
  const arrays = [L.height, L.mount, L.water, L.depth, L.forest, L.moist, L.sediment, L.sun, L.ao];
  (self as unknown as Worker).postMessage(L, arrays.map((a) => a.buffer));
};
