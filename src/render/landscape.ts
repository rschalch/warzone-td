// The battlefield's landscape for the terrain renderer: a heightfield shaped by the map (hills
// everywhere, uplifted massifs over mountain cells, valleys under rivers), carved by a hydraulic erosion
// simulation, plus the fields the ground shader needs (moisture, water, sediment, shadows, occlusion).
// Purely cosmetic and DOM-free: the simulation never reads it. Deterministic per map.

import { COLS, ROWS } from '../game/defs';
import { T_MOUNT, T_TREE, T_WATER, type GameMap } from '../game/maps';
import { Rng } from '../game/rng';

export interface Landscape {
  sub: number; // samples per cell side
  W: number;
  H: number;
  /** Height in world px (cell = 20 px), after erosion. */
  height: Float32Array;
  /** Soft mask of the mountain cells (0-1): rock must cover what blocks. */
  mount: Float32Array;
  /** Soft mask of the water cells and depth in cells. */
  water: Float32Array;
  depth: Float32Array;
  /** Soft mask of the forest cells (0-1). */
  forest: Float32Array;
  /** 0 dry - 1 wet. */
  moist: Float32Array;
  /** Sediment laid down by the erosion (gravel fans, valley floors), 0-1. */
  sediment: Float32Array;
  /** Light: direct sun (0 in cast shadow, 1 lit) and ambient occlusion (0-1). */
  sun: Float32Array;
  ao: Float32Array;
}

/** Light comes from the top left, fairly low, like the rest of the game's shading. */
export const SUN: [number, number, number] = [-0.55, -0.62, 0.56];

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Seeded gradient-free value noise with smoothstep blending. */
function lattice(rng: Rng): (x: number, y: number) => number {
  const table = new Float32Array(4096);
  for (let i = 0; i < table.length; i++) table[i] = rng.next();
  const at = (ix: number, iy: number) => table[(Math.imul(ix, 73856093) ^ Math.imul(iy, 19349663)) & 4095];
  return (x, y) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    let fx = x - ix;
    let fy = y - iy;
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    const a = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * fx;
    const b = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * fx;
    return a + (b - a) * fy;
  };
}

/** Box blur passes over a w×h field (a few passes ≈ gaussian). */
function blur(src: Float32Array, w: number, h: number, passes: number, radius = 1): Float32Array {
  let a = src.slice();
  let b = new Float32Array(a.length);
  for (let p = 0; p < passes; p++) {
    // separable: rows then columns, with running sums
    for (let y = 0; y < h; y++) {
      let sum = 0;
      const row = y * w;
      for (let x = -radius; x <= radius; x++) sum += a[row + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        b[row + x] = sum / (2 * radius + 1);
        sum += a[row + Math.min(w - 1, x + radius + 1)] - a[row + Math.max(0, x - radius)];
      }
    }
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let y = -radius; y <= radius; y++) sum += b[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        a[y * w + x] = sum / (2 * radius + 1);
        sum += b[Math.min(h - 1, y + radius + 1) * w + x] - b[Math.max(0, y - radius) * w + x];
      }
    }
  }
  return a;
}

/** Steps (8-neighbour) inside cells of type t to the nearest other cell, on the cell grid; 0 outside. */
function depthIn(grid: Uint8Array, t: number): Float32Array {
  const d = new Float32Array(grid.length);
  const queue: number[] = [];
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] !== t) continue;
    const c = i % COLS;
    const r = (i / COLS) | 0;
    let edge = false;
    for (let dy = -1; dy <= 1 && !edge; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = c + dx;
        const y = r + dy;
        if (x >= 0 && y >= 0 && x < COLS && y < ROWS && grid[y * COLS + x] !== t) edge = true;
      }
    }
    if (edge) {
      d[i] = 1;
      queue.push(i);
    }
  }
  for (let h = 0; h < queue.length; h++) {
    const i = queue[h];
    const c = i % COLS;
    const r = (i / COLS) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = c + dx;
        const y = r + dy;
        if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
        const j = y * COLS + x;
        if (grid[j] === t && !d[j]) {
          d[j] = d[i] + 1;
          queue.push(j);
        }
      }
    }
  }
  return d;
}

/** Bilinear upsampling of a cell field to the sample grid (values at cell centres). */
function upsample(cells: ArrayLike<number>, sub: number): Float32Array {
  const W = COLS * sub;
  const H = ROWS * sub;
  const out = new Float32Array(W * H);
  for (let Y = 0; Y < H; Y++) {
    const v = (Y + 0.5) / sub - 0.5;
    const y0 = Math.max(0, Math.min(ROWS - 1, Math.floor(v)));
    const y1 = Math.min(ROWS - 1, y0 + 1);
    const fy = Math.max(0, Math.min(1, v - y0));
    for (let X = 0; X < W; X++) {
      const u = (X + 0.5) / sub - 0.5;
      const x0 = Math.max(0, Math.min(COLS - 1, Math.floor(u)));
      const x1 = Math.min(COLS - 1, x0 + 1);
      const fx = Math.max(0, Math.min(1, u - x0));
      const a = cells[y0 * COLS + x0] + (cells[y0 * COLS + x1] - cells[y0 * COLS + x0]) * fx;
      const b = cells[y1 * COLS + x0] + (cells[y1 * COLS + x1] - cells[y1 * COLS + x0]) * fx;
      out[Y * W + X] = a + (b - a) * fy;
    }
  }
  return out;
}

/**
 * Hydraulic erosion by droplets (after Hans Theobald Beyer's thesis and Sebastian Lague's
 * implementation): each droplet runs downhill with inertia, picks up sediment where it speeds up and
 * has capacity, drops it where it slows or climbs, and evaporates. Erosion uses a small brush so it
 * carves gullies rather than pits. `spawn` (0-1 per sample) says where it rains most.
 */
function erode(height: Float32Array, W: number, H: number, drops: number, rng: Rng, spawn: Float32Array, deposit: Float32Array): void {
  const inertia = 0.05;
  const capacityK = 4;
  const minCapacity = 0.01;
  const erodeK = 0.4;
  const depositK = 0.3;
  const evaporate = 0.015;
  const gravity = 4;
  const lifetime = 50;
  // brush: radius 2, weights falling off linearly
  const R = 2;
  const bx: number[] = [];
  const by: number[] = [];
  const bw: number[] = [];
  let wsum = 0;
  for (let y = -R; y <= R; y++) {
    for (let x = -R; x <= R; x++) {
      const d = Math.hypot(x, y);
      if (d > R) continue;
      bx.push(x);
      by.push(y);
      bw.push(1 - d / R);
      wsum += 1 - d / R;
    }
  }
  for (let k = 0; k < bw.length; k++) bw[k] /= wsum;

  const grad = (px: number, py: number, out: number[]) => {
    const x = px | 0;
    const y = py | 0;
    const fx = px - x;
    const fy = py - y;
    const i = y * W + x;
    const nw = height[i];
    const ne = height[i + 1];
    const sw = height[i + W];
    const se = height[i + W + 1];
    out[0] = (ne - nw) * (1 - fy) + (se - sw) * fy;
    out[1] = (sw - nw) * (1 - fx) + (se - ne) * fx;
    out[2] = nw * (1 - fx) * (1 - fy) + ne * fx * (1 - fy) + sw * (1 - fx) * fy + se * fx * fy;
  };
  const g0 = [0, 0, 0];
  const g1 = [0, 0, 0];
  let placed = 0;
  let guard = 0;
  while (placed < drops && guard++ < drops * 6) {
    let px = rng.range(1, W - 2);
    let py = rng.range(1, H - 2);
    if (rng.next() > spawn[(py | 0) * W + (px | 0)]) continue;
    placed++;
    let dx = 0;
    let dy = 0;
    let speed = 1;
    let water = 1;
    let sediment = 0;
    for (let life = 0; life < lifetime; life++) {
      const x = px | 0;
      const y = py | 0;
      const fx = px - x;
      const fy = py - y;
      const i = y * W + x;
      grad(px, py, g0);
      dx = dx * inertia - g0[0] * (1 - inertia);
      dy = dy * inertia - g0[1] * (1 - inertia);
      const len = Math.hypot(dx, dy);
      if (len < 1e-6) break;
      dx /= len;
      dy /= len;
      px += dx;
      py += dy;
      if (px < 1 || py < 1 || px >= W - 2 || py >= H - 2) break;
      grad(px, py, g1);
      const dh = g1[2] - g0[2];
      const capacity = Math.max(-dh * speed * water * capacityK, minCapacity);
      if (sediment > capacity || dh > 0) {
        // fill the pit we're climbing out of, or drop the excess
        const amount = dh > 0 ? Math.min(dh, sediment) : (sediment - capacity) * depositK;
        sediment -= amount;
        height[i] += amount * (1 - fx) * (1 - fy);
        height[i + 1] += amount * fx * (1 - fy);
        height[i + W] += amount * (1 - fx) * fy;
        height[i + W + 1] += amount * fx * fy;
        deposit[i] += amount;
      } else {
        const amount = Math.max(0, Math.min((capacity - sediment) * erodeK, -dh));
        for (let k = 0; k < bw.length; k++) {
          const xx = x + bx[k];
          const yy = y + by[k];
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const j = yy * W + xx;
          const take = amount * bw[k]; // heights may be negative (river beds): no floor at zero
          height[j] -= take;
          sediment += take;
        }
      }
      speed = Math.sqrt(Math.max(0, speed * speed + dh * gravity));
      water *= 1 - evaporate;
    }
  }
}

/**
 * Builds the landscape at `sub` samples per cell side. Heights are shaped in "height units" (about a
 * cell tall), eroded, then scaled to world px.
 */
export function buildLandscape(map: GameMap, sub: number): Landscape {
  const grid = map.grid;
  const W = COLS * sub;
  const H = ROWS * sub;
  const n = W * H;
  const rng = new Rng(map.def.seed * 101 + 17);
  const noise = lattice(rng);
  const fbm = (x: number, y: number, oct: number) => {
    let s = 0;
    let a = 0.5;
    let f = 1;
    let norm = 0;
    for (let o = 0; o < oct; o++) {
      s += noise(x * f + o * 17.3, y * f - o * 9.1) * a;
      norm += a;
      a *= 0.5;
      f *= 2.03;
    }
    return s / norm;
  };
  // ridged multifractal: sharp crests where the noise crosses its middle, sharper with each octave
  const ridged = (x: number, y: number) => {
    let s = 0;
    let a = 0.5;
    let f = 1;
    let w = 1;
    for (let o = 0; o < 5; o++) {
      let r = 1 - Math.abs(2 * noise(x * f + o * 31.7, y * f + o * 5.3) - 1);
      r *= r * w;
      w = Math.min(1, r * 2);
      s += r * a;
      a *= 0.5;
      f *= 2.1;
    }
    return s;
  };

  const isM = Float32Array.from(grid, (t) => (t === T_MOUNT ? 1 : 0));
  const isW = Float32Array.from(grid, (t) => (t === T_WATER ? 1 : 0));
  const mDepth = depthIn(grid, T_MOUNT);
  const wDepth = depthIn(grid, T_WATER);
  // sample-grid fields
  const mount = blur(upsample(isM, sub), W, H, 1, Math.max(1, sub >> 1));
  const uplift = blur(upsample(isM, sub), W, H, 3, sub * 2); // massif + foothills, ~5 cells wide
  const core = blur(upsample(mDepth, sub), W, H, 3, sub); // grows towards the middle of each massif
  const water = blur(upsample(isW, sub), W, H, 1, Math.max(1, sub >> 1));
  const depth = upsample(wDepth, sub);
  const valley = blur(water, W, H, 3, sub * 2);
  const forest = blur(upsample(Float32Array.from(grid, (t) => (t === T_TREE ? 1 : 0)), sub), W, H, 1, Math.max(1, sub >> 1));
  // what shapes the height must be smooth to its slope (single box passes leave creases that the
  // light turns into lines): three passes each
  const mountH = blur(upsample(isM, sub), W, H, 3, Math.max(1, sub >> 1));
  const waterH = blur(upsample(isW, sub), W, H, 3, Math.max(1, sub >> 1));

  // shape: rolling hills, uplifted ridged massifs, valleys along the rivers (height units)
  const height = new Float32Array(n);
  for (let Y = 0; Y < H; Y++) {
    const v = (Y + 0.5) / sub;
    for (let X = 0; X < W; X++) {
      const u = (X + 0.5) / sub;
      const k = Y * W + X;
      const up = uplift[k];
      let h = 1.0 * fbm(u * 0.05, v * 0.05, 4) + 0.08 * fbm(u * 0.5, v * 0.5, 2);
      if (up > 0.002) {
        // a spine: height grows steadily towards the middle of the massif (a cone along its core),
        // with ridged detail in proportion, over foothills that rise for a few cells
        const c = core[k];
        const warp = fbm(u * 0.12 + 7, v * 0.12, 3) - 0.5;
        const spine = c * (1 + 1.2 * warp); // warped, but still fading smoothly to zero at the edge
        h += 1.3 * Math.pow(up, 1.2);
        h += 1.05 * spine + (0.6 + 0.35 * spine) * ridged(u * 0.11 + warp, v * 0.11 - warp) * smooth(0.3, 0.8, mountH[k]);
      }
      h -= 1.4 * valley[k] + 0.6 * waterH[k];
      height[k] = h;
    }
  }

  // erosion: it rains mostly on the mountains; heights in sample units for the droplet maths
  const scale = sub; // one height unit = one cell = `sub` samples, so slopes stay in proportion
  for (let k = 0; k < n; k++) height[k] *= scale;
  const spawn = new Float32Array(n);
  let rainy = 0;
  for (let k = 0; k < n; k++) {
    spawn[k] = 0.01 + 0.99 * smooth(0.05, 0.4, uplift[k]);
    rainy += spawn[k];
  }
  const deposit = new Float32Array(n);
  const drops = Math.round(rainy * 1.6);
  const before = height.slice();
  erode(height, W, H, drops, new Rng(map.def.seed * 7 + 3), spawn, deposit);
  // keep only the carving, in proportion: deposits pile up as rims where the droplets stop, so they
  // only colour the ground (gravel fans, via `deposit`) instead of shaping it
  for (let k = 0; k < n; k++) height[k] = before[k] + Math.max(-1.5 * scale, Math.min(0, height[k] - before[k]));
  // keep what blocks looking high, and the river beds below their banks
  for (let k = 0; k < n; k++) {
    height[k] = height[k] / scale;
    if (mountH[k] > 0.5) height[k] = Math.max(height[k], 0.6 * mountH[k]);
  }

  // world px: one height unit ≈ a cell (20 px), a little exaggerated
  const PX = 16;
  for (let k = 0; k < n; k++) height[k] *= PX;
  const sediment = blur(deposit, W, H, 1, 1);
  let maxDep = 1e-6;
  for (let k = 0; k < n; k++) maxDep = Math.max(maxDep, sediment[k]);
  for (let k = 0; k < n; k++) sediment[k] = smooth(0.08, 0.5, sediment[k] / maxDep);

  // moisture: broad regions, wet along rivers and in low ground, dry high up
  const moist = new Float32Array(n);
  const wet = blur(water, W, H, 3, sub * 3);
  for (let Y = 0; Y < H; Y++) {
    const v = (Y + 0.5) / sub;
    for (let X = 0; X < W; X++) {
      const u = (X + 0.5) / sub;
      const k = Y * W + X;
      moist[k] = Math.min(1, Math.max(0, 0.12 + 0.85 * fbm(u * 0.03 + 50, v * 0.03, 3) + 0.7 * wet[k] - 0.4 * uplift[k] + 0.25 * sediment[k] * (1 - mount[k])));
    }
  }

  // light: cast shadows by marching towards the sun, ambient occlusion from the blurred surroundings
  const step = 20 / sub; // world px per sample
  const sun = new Float32Array(n);
  const [lx, ly, lz] = SUN;
  const lh = Math.hypot(lx, ly);
  const rise = lz / lh; // height gained per px travelled towards the sun
  for (let Y = 0; Y < H; Y++) {
    for (let X = 0; X < W; X++) {
      const k = Y * W + X;
      const h0 = height[k];
      let lit = 1;
      for (let s = 1; s <= 24; s++) {
        const d = s * s * 0.5 + s; // longer steps further out
        const x = Math.round(X + (lx / lh) * d);
        const y = Math.round(Y + (ly / lh) * d);
        if (x < 0 || y < 0 || x >= W || y >= H) break;
        const over = height[y * W + x] - (h0 + d * step * rise);
        if (over > 0) {
          lit = Math.min(lit, 1 - Math.min(1, over / 6));
          if (lit <= 0) break;
        }
      }
      sun[k] = lit;
    }
  }
  const around = blur(height, W, H, 2, sub * 2);
  const ao = new Float32Array(n);
  for (let k = 0; k < n; k++) ao[k] = 1 - smooth(0, 18, around[k] - height[k]) * 0.6;

  return { sub, W, H, height, mount, water, depth, forest, moist, sediment, sun, ao };
}
