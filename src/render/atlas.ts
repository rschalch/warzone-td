import { CanvasSource, Texture, Rectangle } from 'pixi.js';
import { COLS, MAP_H, MAP_W, ROWS, TILE, TOWERS } from '../game/defs';
import { T_GATE, T_MOUNT, T_WATER, type GameMap } from '../game/maps';
import { Rng } from '../game/rng';
import { DIRS, models } from './models';

export { DIRS, MODEL_TOP, TOWER_DECK } from './models';

import { RES, bakeCost, bakeModel, type BakedFrame } from './bake';

type Draw = (g: CanvasRenderingContext2D, w: number, h: number) => void;

interface Entry {
  name: string;
  w: number;
  h: number;
  draw: Draw;
  anchor?: [number, number];
}

const entries: Entry[] = [];
const def = (name: string, w: number, h: number, draw: Draw, anchor?: [number, number]) =>
  entries.push({ name, w, h, draw, anchor });

// ---------------------------------------------------------------- helpers

function rrect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

function radial(g: CanvasRenderingContext2D, r: number, stops: [number, string][]) {
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, r);
  for (const [o, c] of stops) grad.addColorStop(o, c);
  g.fillStyle = grad;
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.fill();
}


// ---------------------------------------------------------------- fx & projectiles

def('px', 4, 4, (g) => {
  g.fillStyle = '#fff';
  g.fillRect(-2, -2, 4, 4);
});
def('glow', 64, 64, (g) => radial(g, 32, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.7)'], [1, 'rgba(255,255,255,0)']]));
def('smoke', 64, 64, (g) => {
  const rng = new Rng(5);
  for (let i = 0; i < 7; i++) {
    g.save();
    g.translate(rng.range(-9, 9), rng.range(-9, 9));
    radial(g, rng.range(14, 22), [[0, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0)']]);
    g.restore();
  }
});
def('spark', 16, 4, (g) => {
  const grad = g.createLinearGradient(-8, 0, 8, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(1, 'rgba(255,255,255,1)');
  g.fillStyle = grad;
  rrect(g, -8, -1.5, 16, 3, 1.5);
  g.fill();
});
def('ring', 128, 128, (g) => {
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 8;
  g.beginPath();
  g.arc(0, 0, 58, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = '#fff';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(0, 0, 60, 0, Math.PI * 2);
  g.stroke();
});
def('bullet', 12, 4, (g) => {
  const grad = g.createLinearGradient(-6, 0, 6, 0);
  grad.addColorStop(0, 'rgba(255,200,80,0)');
  grad.addColorStop(1, '#fff6c8');
  g.fillStyle = grad;
  rrect(g, -6, -1.2, 12, 2.4, 1.2);
  g.fill();
});
def('shell', 9, 9, (g) => {
  radial(g, 4.5, [[0, '#8a8a8a'], [0.6, '#2a2a2a'], [1, '#111']]);
});
def('missile', 16, 7, (g) => {
  g.fillStyle = '#556';
  g.beginPath();
  g.moveTo(-7, -3.5); g.lineTo(-4, -1); g.lineTo(-4, 1); g.lineTo(-7, 3.5); g.closePath();
  g.fill();
  g.fillStyle = '#e8e8e8';
  rrect(g, -6, -1.5, 11, 3, 1.5);
  g.fill();
  g.fillStyle = '#d33';
  g.beginPath();
  g.moveTo(5, -1.5); g.lineTo(8, 0); g.lineTo(5, 1.5); g.closePath();
  g.fill();
});
def('blob', 10, 10, (g) => radial(g, 5, [[0, '#ffffff'], [0.45, 'rgba(255,255,255,0.9)'], [1, 'rgba(255,255,255,0)']]));
def('canister', 8, 8, (g) => {
  g.fillStyle = '#c8c8b8';
  rrect(g, -3.5, -2.5, 7, 5, 2);
  g.fill();
  g.fillStyle = '#5a5a40';
  g.fillRect(-1, -2.5, 2, 5);
});
def('nukeshell', 26, 10, (g) => {
  g.fillStyle = '#556';
  g.beginPath();
  g.moveTo(-12, -5); g.lineTo(-7, -1.5); g.lineTo(-7, 1.5); g.lineTo(-12, 5); g.closePath();
  g.fill();
  g.fillStyle = '#e8e8e0';
  rrect(g, -10, -2.6, 18, 5.2, 2.6);
  g.fill();
  g.fillStyle = '#e8c440';
  g.fillRect(-4, -2.6, 2, 5.2);
  g.fillStyle = '#d33';
  g.beginPath();
  g.moveTo(8, -2.6); g.lineTo(12.5, 0); g.lineTo(8, 2.6); g.closePath();
  g.fill();
});

// ---------------------------------------------------------------- floor decals (lie on the ground)

def('d_mine', 20, 20, (g) => {
  g.fillStyle = 'rgba(60,45,30,0.55)';
  g.beginPath();
  g.arc(0, 0, 8.5, 0, Math.PI * 2);
  g.fill();
  const gr = g.createRadialGradient(-1.5, -1.5, 0.5, 0, 0, 5.5);
  gr.addColorStop(0, '#9a9a80');
  gr.addColorStop(1, '#3a3a2a');
  g.fillStyle = gr;
  g.beginPath();
  g.arc(0, 0, 5.5, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.5)';
  g.lineWidth = 0.6;
  g.stroke();
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    g.fillStyle = '#2a2a20';
    g.beginPath();
    g.arc(Math.cos(a) * 3.8, Math.sin(a) * 3.8, 0.6, 0, Math.PI * 2);
    g.fill();
  }
});
def('d_mine_light', 6, 6, (g) => radial(g, 3, [[0, '#ffffff'], [0.4, '#ff3a2a'], [1, 'rgba(255,40,30,0)']]));
def('d_tar', 40, 40, (g) => {
  const rng = new Rng(9);
  g.fillStyle = '#16120e';
  g.beginPath();
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    const r = 17 * rng.range(0.85, 1.05);
    k ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r) : g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  for (let k = 0; k < 7; k++) {
    const x = rng.range(-10, 10);
    const y = rng.range(-10, 10);
    const gr = g.createRadialGradient(x - 1, y - 1, 0, x, y, rng.range(2, 4));
    gr.addColorStop(0, 'rgba(160,150,130,0.55)');
    gr.addColorStop(1, 'rgba(40,32,24,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, 4, 0, Math.PI * 2);
    g.fill();
  }
});
def('d_spikes', 40, 40, (g) => {
  g.fillStyle = 'rgba(40,40,36,0.85)';
  rrect(g, -18, -18, 36, 36, 3);
  g.fill();
  for (let y = -14; y <= 14; y += 7) {
    g.fillStyle = '#6a6a64';
    g.fillRect(-17, y - 1.2, 34, 2.4);
    for (let x = -14; x <= 14; x += 4) {
      g.fillStyle = '#d0d0c8';
      g.beginPath();
      g.moveTo(x - 1.5, y + 1.2); g.lineTo(x, y - 2.6); g.lineTo(x + 1.5, y + 1.2); g.closePath();
      g.fill();
    }
  }
});
def('d_gate_open', 40, 40, (g) => {
  g.fillStyle = 'rgba(74,75,68,0.9)';
  rrect(g, -19.5, -19.5, 39, 39, 3);
  g.fill();
  g.fillStyle = '#7a7c72';
  g.fillRect(-19, -19, 6, 38);
  g.fillRect(13, -19, 6, 38);
  // doors folded back against the posts
  g.fillStyle = '#8a7a48';
  g.fillRect(-13, -19, 3, 38);
  g.fillRect(10, -19, 3, 38);
  g.strokeStyle = 'rgba(224,176,64,0.8)';
  g.lineWidth = 1.5;
  g.setLineDash([3, 3]);
  g.beginPath();
  g.moveTo(-9, 0); g.lineTo(9, 0);
  g.stroke();
});

def('pip', 8, 5, (g) => {
  g.fillStyle = '#ffd34a';
  g.strokeStyle = '#3a2a00';
  g.lineWidth = 0.8;
  g.beginPath();
  g.moveTo(-3.5, 1.8); g.lineTo(0, -1.8); g.lineTo(3.5, 1.8); g.lineTo(2, 1.8); g.lineTo(0, -0.2); g.lineTo(-2, 1.8); g.closePath();
  g.fill();
  g.stroke();
});

// ---------------------------------------------------------------- icons

/**
 * Draws one atlas entry scaled to fill a size×size box, centred. The frame is first trimmed to its
 * visible pixels, since baked frames carry room for the longest barrel at every heading.
 */
function fitEntry(g: CanvasRenderingContext2D, name: string, size: number, zoom = 1): void {
  const e = entries.find((en) => en.name === name);
  if (!e) return;
  const res = 3;
  const tmp = document.createElement('canvas');
  tmp.width = Math.ceil(e.w * res);
  tmp.height = Math.ceil(e.h * res);
  const tg = tmp.getContext('2d', { willReadFrequently: true })!;
  tg.scale(res, res);
  tg.translate(e.w / 2, e.h / 2);
  e.draw(tg, e.w, e.h);
  // visible bounds
  const { data, width, height } = tg.getImageData(0, 0, tmp.width, tmp.height);
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] < 150) continue; // skip the soft contact shadow
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return;
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;
  const k = (Math.min(size / bw, size / bh) * zoom);
  g.drawImage(tmp, x0, y0, bw, bh, (size - bw * k) / 2, (size - bh * k) / 2, bw * k, bh * k);
}

const ICON_DECALS: Record<string, string> = { mine: 'd_mine', tar: 'd_tar', spikes: 'd_spikes' };

/**
 * A small picture of a tower for the build buttons: its turret as seen by the iso camera (the
 * concrete base is the same for every tower, so it's left out), or the trap/wall itself.
 * Call after buildAtlas().
 */
export function towerIcon(type: number, size = 28): HTMLCanvasElement {
  const t = TOWERS[type];
  const c = document.createElement('canvas');
  const dpr = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
  c.width = c.height = size * dpr;
  c.style.width = c.style.height = `${size}px`;
  const g = c.getContext('2d')!;
  g.scale(dpr, dpr);
  if (ICON_DECALS[t.kind]) {
    // lay the trap flat in the same 2:1 projection as the iso camera
    g.translate(size / 2, size / 2);
    g.scale(1, 0.55);
    g.rotate(Math.PI / 4);
    g.translate(-size / 2, -size / 2);
    fitEntry(g, ICON_DECALS[t.kind], size, t.size === 1 ? 0.8 : 1);
  } else if (t.turret) {
    fitEntry(g, dirFrame(t.turret, -Math.PI * 0.75, models[t.turret].dirs), size, 0.95);
  } else {
    fitEntry(g, `${t.kind}_0`, size, t.size === 1 ? 0.75 : 0.95);
  }
  return c;
}

/** Iso frame name for a model at a world heading. */
export function dirFrame(name: string, heading: number, dirs = DIRS): string {
  const d = Math.round((heading / (Math.PI * 2)) * dirs);
  return `${name}_${((d % dirs) + dirs) % dirs}`;
}

// ---------------------------------------------------------------- build

export type Atlas = Record<string, Texture>;

/**
 * Bakes every model, in parallel across workers when possible. Each worker gets a share of the
 * models balanced by estimated cost and sends the frames back as ImageBitmaps.
 */
async function bakeAll(): Promise<BakedFrame[]> {
  const names = Object.keys(models).sort((a, b) => bakeCost(b) - bakeCost(a));
  const n = Math.max(1, Math.min(8, (navigator.hardwareConcurrency || 4) - 1));
  const shares: string[][] = Array.from({ length: n }, () => []);
  const load = new Array(n).fill(0);
  for (const name of names) {
    let k = 0;
    for (let j = 1; j < n; j++) if (load[j] < load[k]) k = j;
    shares[k].push(name);
    load[k] += bakeCost(name);
  }
  try {
    const parts = await Promise.all(shares.filter((s) => s.length).map((share) => new Promise<BakedFrame[]>((resolve, reject) => {
      const w = new Worker(new URL('./bake.worker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (e: MessageEvent<BakedFrame[]>) => {
        resolve(e.data);
        w.terminate();
      };
      w.onerror = (e) => {
        reject(e);
        w.terminate();
      };
      w.postMessage(share);
    })));
    return parts.flat();
  } catch {
    // no module workers: bake here
    return names.flatMap(bakeModel);
  }
}

export async function buildAtlas(): Promise<Atlas> {
  for (const f of await bakeAll()) {
    const { w, h, image } = f;
    def(f.name, w, h, (g) => g.drawImage(image, -w / 2, -h / 2, w, h), f.anchor);
  }
  const pad = 2;
  const size = 1024;
  // shelf-pack first to know the height we need
  const frames: Record<string, Rectangle> = {};
  let x = pad;
  let y = pad;
  let rowH = 0;
  const sorted = [...entries].sort((a, b) => b.h - a.h);
  for (const e of sorted) {
    if (x + e.w + pad > size) {
      x = pad;
      y += rowH + pad;
      rowH = 0;
    }
    frames[e.name] = new Rectangle(x, y, e.w, e.h);
    x += e.w + pad;
    rowH = Math.max(rowH, e.h);
  }
  const height = y + rowH + pad;
  if (height * RES > 8192) throw new Error('atlas overflow');

  const canvas = document.createElement('canvas');
  canvas.width = size * RES;
  canvas.height = Math.ceil(height) * RES;
  const g = canvas.getContext('2d')!;
  g.scale(RES, RES);
  for (const e of sorted) {
    const f = frames[e.name];
    g.save();
    g.beginPath();
    g.rect(f.x, f.y, f.width, f.height);
    g.clip();
    g.translate(f.x + f.width / 2, f.y + f.height / 2);
    e.draw(g, e.w, e.h);
    g.restore();
  }

  const source = new CanvasSource({ resource: canvas, resolution: RES, scaleMode: 'linear' });
  source.autoGenerateMipmaps = true;
  const atlas: Atlas = {};
  for (const e of entries) {
    atlas[e.name] = new Texture({
      source,
      frame: frames[e.name],
      defaultAnchor: e.anchor ? { x: e.anchor[0], y: e.anchor[1] } : undefined,
    });
  }
  return atlas;
}

// ---------------------------------------------------------------- terrain

/** For each cell of type `t`: steps (8-neighbour) to the nearest cell of another type, 1 on the edge; 0 elsewhere. */
function depthOf(map: GameMap, t: number): Uint8Array {
  const grid = map.grid;
  const d = new Uint8Array(grid.length);
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

/** Where the 3D summits stand on mountain massifs: s = 1..3 (peak1..peak3), x/y in world px. */
export function mountainPeaks(map: GameMap): { x: number; y: number; s: number }[] {
  const depth = depthOf(map, T_MOUNT);
  const rng = new Rng(map.def.seed * 13 + 5);
  const cand: number[] = [];
  for (let i = 0; i < depth.length; i++) if (depth[i] >= 2) cand.push(i);
  // deepest first, ties in a seeded shuffle
  const jitter = new Map(cand.map((i) => [i, rng.next()]));
  cand.sort((a, b) => depth[b] - depth[a] || jitter.get(a)! - jitter.get(b)!);
  const out: { x: number; y: number; s: number }[] = [];
  const radius = [0, 22, 34, 50];
  for (const i of cand) {
    const s = Math.min(3, depth[i] - 1);
    const x = ((i % COLS) + 0.5) * TILE + rng.range(-4, 4);
    const y = (((i / COLS) | 0) + 0.5) * TILE + rng.range(-4, 4);
    if (out.some((p) => Math.hypot(p.x - x, p.y - y) < (radius[p.s] + radius[s]) * 0.85)) continue;
    out.push({ x, y, s });
  }
  return out;
}

/** Seeded smooth noise over continuous coordinates (hashed lattice, smoothstep-blended), in [0,1). */
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

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Rivers and mountains, sampled `sub` times per cell side: a smooth height field for the mountains
 * (from the distance to their edge, plus ridged noise) lit from the top left, with snow up high and
 * shadows cast on the ground; water deepening away from muddy banks.
 */
function drawLandforms(g: CanvasRenderingContext2D, map: GameMap, rng: Rng, res: number): void {
  const grid = map.grid;
  let any = false;
  for (let i = 0; i < grid.length && !any; i++) any = grid[i] === T_WATER || grid[i] === T_MOUNT;
  if (!any) return;
  const water = depthOf(map, T_WATER);
  const mount = depthOf(map, T_MOUNT);
  const sub = Math.max(2, Math.min(10, Math.round((TILE * res) / 4)));
  const W = COLS * sub;
  const H = ROWS * sub;
  const noise = lattice(rng);
  const fbm = (x: number, y: number) => noise(x, y) * 0.55 + noise(x * 2.1 + 17, y * 2.1) * 0.3 + noise(x * 4.3, y * 4.3 + 9) * 0.15;
  // bilinear over cell centres
  const bil = (f: (i: number) => number, u: number, v: number) => {
    u -= 0.5;
    v -= 0.5;
    const x0 = Math.max(0, Math.min(COLS - 1, Math.floor(u)));
    const y0 = Math.max(0, Math.min(ROWS - 1, Math.floor(v)));
    const x1 = Math.min(COLS - 1, x0 + 1);
    const y1 = Math.min(ROWS - 1, y0 + 1);
    const fx = Math.max(0, Math.min(1, u - x0));
    const fy = Math.max(0, Math.min(1, v - y0));
    const a = f(y0 * COLS + x0) + (f(y0 * COLS + x1) - f(y0 * COLS + x0)) * fx;
    const b = f(y1 * COLS + x0) + (f(y1 * COLS + x1) - f(y1 * COLS + x0)) * fx;
    return a + (b - a) * fy;
  };
  const isM = (i: number) => (grid[i] === T_MOUNT ? 1 : 0);
  const isW = (i: number) => (grid[i] === T_WATER ? 1 : 0);
  const mD = (i: number) => mount[i];
  const wD = (i: number) => water[i];

  // cells worth sampling: terrain and a 2-cell margin (banks, shadows)
  const near = new Uint8Array(grid.length);
  for (let i = 0; i < grid.length; i++) {
    if (!isM(i) && !isW(i)) continue;
    const c = i % COLS;
    const r = (i / COLS) | 0;
    for (let y = Math.max(0, r - 2); y <= Math.min(ROWS - 1, r + 2); y++) for (let x = Math.max(0, c - 2); x <= Math.min(COLS - 1, c + 2); x++) near[y * COLS + x] = 1;
  }

  // pass 1: mountain height (world px) and the inside/outside masks
  const height = new Float32Array(W * H);
  const mMask = new Float32Array(W * H);
  const wMask = new Float32Array(W * H);
  const wDepth = new Float32Array(W * H);
  for (let i = 0; i < grid.length; i++) {
    if (!near[i]) continue;
    const c = i % COLS;
    const r = (i / COLS) | 0;
    for (let sy = 0; sy < sub; sy++) {
      for (let sx = 0; sx < sub; sx++) {
        const u = c + (sx + 0.5) / sub;
        const v = r + (sy + 0.5) / sub;
        const k = (r * sub + sy) * W + c * sub + sx;
        const m = bil(isM, u, v) + (fbm(u * 0.7, v * 0.7) - 0.5) * 0.3;
        mMask[k] = m;
        if (m > 0.4) {
          const d = Math.max(0, bil(mD, u, v) - 0.5 + (m - 0.5));
          const ridge = 1 - Math.abs(2 * noise(u * 0.45 + 40, v * 0.45) - 1);
          height[k] = 13 * Math.pow(d, 0.9) + 9 * ridge * Math.min(1, d) + 3 * fbm(u * 1.7, v * 1.7);
        }
        const w = bil(isW, u, v) + (fbm(u * 0.9 + 70, v * 0.9) - 0.5) * 0.22;
        wMask[k] = w;
        wDepth[k] = Math.max(0, bil(wD, u, v) - 0.5 + (w - 0.5));
      }
    }
  }

  // pass 2: shade
  const img = new ImageData(W, H);
  const px = img.data;
  const step = TILE / sub; // world px per sample
  const [lx, ly, lz] = [-0.55, -0.62, 0.56];
  const shadowReach = Math.round(sub * 0.9);
  for (let i = 0; i < grid.length; i++) {
    if (!near[i]) continue;
    const c = i % COLS;
    const r = (i / COLS) | 0;
    for (let sy = 0; sy < sub; sy++) {
      for (let sx = 0; sx < sub; sx++) {
        const X = c * sub + sx;
        const Y = r * sub + sy;
        const k = Y * W + X;
        const u = X / sub;
        const v = Y / sub;
        let R = 0;
        let G = 0;
        let B = 0;
        let A = 0;
        const m = mMask[k];
        const w = wMask[k];
        if (w > 0.36) {
          // bank, then water deepening towards the middle
          const bank = smooth(0.36, 0.46, w);
          const wet = smooth(0.49, 0.53, w);
          const f = Math.min(1, wDepth[k] / 2.2);
          const ripple = (fbm(u * 3 + 5, v * 1.2) - 0.5) * 22;
          const wr = 70 - 42 * f + ripple * 0.5;
          const wg = 118 - 46 * f + ripple;
          const wb = 112 - 14 * f + ripple;
          const foam = smooth(0.58, 0.5, w) * 0.5;
          R = 104 + (wr - 104) * wet + (180 - wr) * foam * wet;
          G = 90 + (wg - 90) * wet + (200 - wg) * foam * wet;
          B = 60 + (wb - 60) * wet + (190 - wb) * foam * wet;
          A = 255 * bank;
        }
        if (m > 0.4) {
          const h = height[k];
          const hx = (height[k + (X < W - 1 ? 1 : 0)] - height[k - (X > 0 ? 1 : 0)]) / (2 * step);
          const hy = (height[k + (Y < H - 1 ? W : 0)] - height[k - (Y > 0 ? W : 0)]) / (2 * step);
          const n = 1 / Math.hypot(hx, hy, 1);
          const lit = Math.max(0, (-hx * lx - hy * ly + lz) * n);
          const strata = fbm(u * 0.8 + 30, v * 0.8 + h * 0.05);
          const rocky = Math.min(1, h / 22);
          let cr = 112 + (150 - 112) * rocky + (strata - 0.5) * 40;
          let cg = 98 + (144 - 98) * rocky + (strata - 0.5) * 36;
          let cb = 74 + (132 - 74) * rocky + (strata - 0.5) * 30;
          // snow where it's high and not too steep
          const snow = smooth(0, 6, h - 40 - 10 * noise(u * 1.3 + 3, v * 1.3)) * smooth(1.6, 0.6, Math.hypot(hx, hy));
          cr += (238 - cr) * snow;
          cg += (242 - cg) * snow;
          cb += (246 - cb) * snow;
          const shade = 0.3 + 0.95 * lit;
          const a = smooth(0.44, 0.56, m);
          R = R * (1 - a) + cr * shade * a;
          G = G * (1 - a) + cg * shade * a;
          B = B * (1 - a) + cb * shade * a;
          A = Math.max(A, 255 * a);
        }
        // shadow cast by mountains towards the lower right, onto the ground, water or lower slopes
        const sxk = X - shadowReach;
        const syk = Y - shadowReach;
        if (sxk >= 0 && syk >= 0) {
          const up = height[syk * W + sxk];
          if (up > height[k] + 4) {
            const sh = Math.min(0.5, (up - height[k]) / 40);
            if (A > 0) {
              R *= 1 - sh;
              G *= 1 - sh;
              B *= 1 - sh;
            } else A = 255 * sh;
          }
        }
        px[k * 4] = R;
        px[k * 4 + 1] = G;
        px[k * 4 + 2] = B;
        px[k * 4 + 3] = A;
      }
    }
  }
  const layer = document.createElement('canvas');
  layer.width = W;
  layer.height = H;
  layer.getContext('2d')!.putImageData(img, 0, 0);
  g.imageSmoothingEnabled = true;
  g.drawImage(layer, 0, 0, MAP_W, MAP_H);

  // glints on the water and reeds along the banks
  if (res < 0.5) return;
  g.lineCap = 'round';
  for (let i = 0; i < grid.length; i++) {
    if (water[i] >= 2 && rng.next() < 0.5) {
      const x = ((i % COLS) + rng.next()) * TILE;
      const y = (((i / COLS) | 0) + rng.next()) * TILE;
      const a = rng.range(-0.4, 0.4);
      const l = rng.range(2, 5);
      g.strokeStyle = `rgba(210,235,240,${rng.range(0.08, 0.2).toFixed(2)})`;
      g.lineWidth = rng.range(0.6, 1.2);
      g.beginPath();
      g.moveTo(x - Math.cos(a) * l, y - Math.sin(a) * l);
      g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    } else if (water[i] === 1 && rng.next() < 0.2) {
      const x = ((i % COLS) + rng.next()) * TILE;
      const y = (((i / COLS) | 0) + rng.next()) * TILE;
      g.strokeStyle = 'rgba(110,135,60,0.6)';
      g.lineWidth = 0.8;
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        g.moveTo(x + k * 1.5, y);
        g.lineTo(x + k * 1.5 + rng.range(-1.5, 1.5), y - rng.range(3, 6));
        g.stroke();
      }
    }
  }
}

/** Upper bound on terrain texture pixels (~48MB of RGBA) so the biggest maps stay GPU-friendly. */
const TERRAIN_MAX_PX = 12e6;

export function buildBackground(map: GameMap): Texture {
  const res = Math.min(RES, Math.sqrt(TERRAIN_MAX_PX / (MAP_W * MAP_H)), 8192 / Math.max(MAP_W, MAP_H));
  return new Texture({ source: new CanvasSource({ resource: drawTerrain(map, res), resolution: res }) });
}

/**
 * Terrain painted at `res` pixels per world pixel (low res for menu previews).
 * `solidRocks` paints the rocks themselves, for overviews that don't draw the 3D sprites.
 */
export function drawTerrain(map: GameMap, res: number, solidRocks = false): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(MAP_W * res);
  canvas.height = Math.ceil(MAP_H * res);
  const g = canvas.getContext('2d')!;
  g.scale(res, res);
  const rng = new Rng(map.def.seed * 7 + 1);
  const density = (MAP_W * MAP_H) / (960 * 640); // decoration counts were tuned on a 48x32 map

  g.fillStyle = '#3b4728';
  g.fillRect(0, 0, MAP_W, MAP_H);
  // broad patches of lush, dry and bare ground so big maps aren't one flat green
  const patches = ['rgba(28,44,16,0.5)', 'rgba(96,104,52,0.35)', 'rgba(104,84,52,0.3)', 'rgba(52,70,30,0.45)'];
  for (let i = 0; i < 14 * density; i++) {
    const x = rng.next() * MAP_W;
    const y = rng.next() * MAP_H;
    const r = rng.range(60, 200);
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, patches[rng.int(patches.length)]);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.save();
    g.translate(x, y);
    g.scale(1, rng.range(0.5, 1));
    g.translate(-x, -y);
    g.fillRect(x - r, y - r, r * 2, r * 2);
    g.restore();
  }
  for (let i = 0; i < 2600 * density; i++) {
    const light = rng.next() < 0.5;
    g.fillStyle = light ? 'rgba(140,160,90,0.06)' : 'rgba(10,20,0,0.08)';
    g.beginPath();
    g.arc(rng.next() * MAP_W, rng.next() * MAP_H, rng.range(2, 14), 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 600 * density; i++) {
    g.strokeStyle = 'rgba(120,150,70,0.25)';
    g.lineWidth = 0.8;
    const gx = rng.next() * MAP_W;
    const gy = rng.next() * MAP_H;
    g.beginPath();
    g.moveTo(gx, gy);
    g.lineTo(gx + rng.range(-2, 2), gy - rng.range(2, 5));
    g.stroke();
  }

  // build grid: faint cell lines, stronger every tower-width
  for (let c = 0; c <= COLS; c++) {
    g.strokeStyle = c % 2 ? 'rgba(0,0,0,0.07)' : 'rgba(0,0,0,0.16)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(c * TILE + 0.5, 0);
    g.lineTo(c * TILE + 0.5, MAP_H);
    g.stroke();
  }
  for (let r = 0; r <= ROWS; r++) {
    g.strokeStyle = r % 2 ? 'rgba(0,0,0,0.07)' : 'rgba(0,0,0,0.16)';
    g.beginPath();
    g.moveTo(0, r * TILE + 0.5);
    g.lineTo(MAP_W, r * TILE + 0.5);
    g.stroke();
  }

  drawLandforms(g, map, rng, res);

  // entry / exit gates: trampled dirt + chevrons
  for (let i = 0; i < map.grid.length; i++) {
    if (map.grid[i] !== T_GATE) continue;
    const c = i % COLS;
    const r = (i / COLS) | 0;
    g.fillStyle = '#6e5b3c';
    g.fillRect(c * TILE, r * TILE, TILE, TILE);
    for (let k = 0; k < 6; k++) {
      g.fillStyle = rng.next() < 0.5 ? 'rgba(50,38,20,0.3)' : 'rgba(170,145,100,0.25)';
      g.beginPath();
      g.arc(c * TILE + rng.next() * TILE, r * TILE + rng.next() * TILE, rng.range(0.8, 2.2), 0, Math.PI * 2);
      g.fill();
    }
  }
  const chevron = (x: number, y: number, dx: number, dy: number, color: string) => {
    g.save();
    g.translate(x, y);
    g.rotate(Math.atan2(dy, dx));
    g.strokeStyle = color;
    g.lineWidth = 3;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const o of [-6, 4]) {
      g.beginPath();
      g.moveTo(o - 5, -8);
      g.lineTo(o + 3, 0);
      g.lineTo(o - 5, 8);
      g.stroke();
    }
    g.restore();
  };
  for (const route of map.routes) {
    const inX = route.airFrom[0] + route.inDir[0] * TILE * 2;
    const inY = route.airFrom[1] + route.inDir[1] * TILE * 2;
    chevron(Math.min(MAP_W - 10, Math.max(10, inX)), Math.min(MAP_H - 10, Math.max(10, inY)), route.inDir[0], route.inDir[1], 'rgba(120,255,140,0.75)');
    const outX = route.airTo[0] - route.outDir[0] * TILE * 2;
    const outY = route.airTo[1] - route.outDir[1] * TILE * 2;
    chevron(Math.min(MAP_W - 10, Math.max(10, outX)), Math.min(MAP_H - 10, Math.max(10, outY)), route.outDir[0], route.outDir[1], 'rgba(255,110,90,0.8)');
  }

  // rock footprints (the rocks themselves are 3D sprites)
  for (const rock of map.rocks) {
    const size = rock.s * TILE;
    g.fillStyle = 'rgba(20,16,8,0.35)';
    g.beginPath();
    g.ellipse(rock.c * TILE + size / 2 + 1, rock.r * TILE + size / 2 + 1, size * 0.5, size * 0.5, 0, 0, Math.PI * 2);
    g.fill();
    if (solidRocks) {
      g.fillStyle = '#8a8478';
      g.beginPath();
      g.arc(rock.c * TILE + size / 2, rock.r * TILE + size / 2, size * 0.48, 0, Math.PI * 2);
      g.fill();
    }
  }

  return canvas;
}
