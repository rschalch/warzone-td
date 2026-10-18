import { CanvasSource, ColorMatrixFilter, Container, Rectangle, RenderTexture, Sprite, Texture, TilingSprite, type Renderer } from 'pixi.js';
import { COLS, MAP_H, MAP_W, ROWS, TILE, TOWERS } from '../game/defs';
import { T_BUILD, T_GATE, T_MOUNT, T_ROCK, T_WATER, type GameMap } from '../game/maps';
import { Rng } from '../game/rng';
import { DIRS, models } from './models';
import { buildLandscape, type Landscape } from './landscape';
import { renderGround } from './terrainGL';

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

// Ground textures: CC0 photo materials from ambientCG (public/terrain), blended by the landscape below.
const TEX_NAMES = ['grass', 'drygrass', 'patchy', 'sand', 'gravel', 'mud', 'rock', 'snow'] as const;
type TexName = (typeof TEX_NAMES)[number];
interface GroundTex {
  img: ImageBitmap | null;
  tex: Texture | null; // the same image for the GPU path
  mean: string; // average colour, for small overviews where a texture would only shimmer
}
const FALLBACK: Record<TexName, string> = {
  grass: '#3d5226', drygrass: '#76703c', patchy: '#6a6e40', sand: '#b89a68', gravel: '#9c8664', mud: '#6c5e3e', rock: '#55534c', snow: '#d8dde2',
};
const groundTex = Object.fromEntries(TEX_NAMES.map((n) => [n, { img: null, tex: null, mean: FALLBACK[n] }])) as Record<TexName, GroundTex>;
/** Ground layers over the base grass, in painting order. */
const LAYERS: TexName[] = ['patchy', 'drygrass', 'sand', 'gravel', 'mud', 'rock', 'snow'];
const layerScale = (n: TexName) => (n === 'rock' ? 1.4 : 1);
const layerAngle = (i: number) => i * 23;
/** Photo grading towards the game's muted palette. */
const DESATURATE = 0.3;
const GRADE = 0xd6d2c4;
/** World px covered by one 512 px texture tile. */
const TEX_WORLD = 200;

/** Loads the ground textures (once, at boot). Terrain drawn before this, or offline without them, uses flat colours. */
export async function loadTerrainTextures(): Promise<void> {
  await Promise.all(TEX_NAMES.map(async (n) => {
    try {
      const res = await fetch(`./terrain/${n}.jpg`);
      const img = await createImageBitmap(await res.blob());
      const c = document.createElement('canvas');
      c.width = c.height = 1;
      const cg = c.getContext('2d', { willReadFrequently: true })!;
      cg.drawImage(img, 0, 0, 1, 1);
      const [r, g, b] = cg.getImageData(0, 0, 1, 1).data;
      groundTex[n] = { img, tex: Texture.from(img), mean: `rgb(${r},${g},${b})` };
    } catch {
      // keep the flat colour
    }
  }));
}

/** 3x3 box blur passes over a cell field (a few passes ≈ a gaussian): smooth slopes, wide transitions. */
function blurCells(src: ArrayLike<number>, passes: number): Float32Array {
  let a = Float32Array.from(src);
  let b = new Float32Array(a.length);
  for (let p = 0; p < passes; p++) {
    for (let r = 0; r < ROWS; r++) {
      const y0 = Math.max(0, r - 1);
      const y1 = Math.min(ROWS - 1, r + 1);
      for (let c = 0; c < COLS; c++) {
        const x0 = Math.max(0, c - 1);
        const x1 = Math.min(COLS - 1, c + 1);
        let sum = 0;
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) sum += a[y * COLS + x];
        b[r * COLS + c] = sum / ((y1 - y0 + 1) * (x1 - x0 + 1));
      }
    }
    [a, b] = [b, a];
  }
  return a;
}

/**
 * The whole ground as one landscape. An elevation field (rolling hills everywhere, rising over several
 * cells into the mountains, dipping into river valleys) and a moisture field (wet along the rivers, dry
 * towards the mountains and in broad random regions) decide how much of each ground texture shows at
 * every point: lush grass, patchy grass, dry grass and desert sand by moisture, then gravel, rock and
 * snow with height, mud on the river banks. The texture layers are composited through soft, noisy
 * masks, the water is painted over them, and one hillshade (overlay blend) lights everything.
 */
interface LandLayers {
  vary: HTMLCanvasElement; // where the base grass shows a second, turned copy (hides tiling)
  masks: HTMLCanvasElement[]; // per LAYERS entry: white, with how much of it shows as alpha
  wet: HTMLCanvasElement; // the water, painted
  dark: HTMLCanvasElement; // light as a multiply factor (shade, shadows)
  bright: HTMLCanvasElement; // and as a screen (sunlit slopes)
}

function landLayers(map: GameMap, rng: Rng, res: number): LandLayers {
  const grid = map.grid;
  const water = depthOf(map, T_WATER);
  const mount = depthOf(map, T_MOUNT);
  const isM = Float32Array.from(grid, (t) => (t === T_MOUNT ? 1 : 0));
  const isW = Float32Array.from(grid, (t) => (t === T_WATER ? 1 : 0));
  const mSoft = blurCells(isM, 1);
  const mWide = blurCells(isM, 9); // the foothills: ~5 cells of rise around every massif
  const mHigh = blurCells(mount, 2);
  const wWide = blurCells(isW, 8); // wet ground along the rivers
  const sub = Math.max(2, Math.min(5, Math.round((TILE * res) / 8)));
  const W = COLS * sub;
  const H = ROWS * sub;
  const noise = lattice(rng);
  const fbm = (x: number, y: number) => noise(x, y) * 0.55 + noise(x * 2.1 + 17, y * 2.1) * 0.3 + noise(x * 4.3, y * 4.3 + 9) * 0.15;
  const bil = (f: ArrayLike<number>, u: number, v: number) => {
    u -= 0.5;
    v -= 0.5;
    const x0 = Math.max(0, Math.min(COLS - 1, Math.floor(u)));
    const y0 = Math.max(0, Math.min(ROWS - 1, Math.floor(v)));
    const x1 = Math.min(COLS - 1, x0 + 1);
    const y1 = Math.min(ROWS - 1, y0 + 1);
    const fx = Math.max(0, Math.min(1, u - x0));
    const fy = Math.max(0, Math.min(1, v - y0));
    const a = f[y0 * COLS + x0] + (f[y0 * COLS + x1] - f[y0 * COLS + x0]) * fx;
    const b = f[y1 * COLS + x0] + (f[y1 * COLS + x1] - f[y1 * COLS + x0]) * fx;
    return a + (b - a) * fy;
  };

  // pass 1: elevation (px), moisture, and the masks that must match the grid
  const elev = new Float32Array(W * H);
  const moist = new Float32Array(W * H);
  const inside = new Float32Array(W * H);
  const wMask = new Float32Array(W * H);
  const wDepth = new Float32Array(W * H);
  for (let Y = 0; Y < H; Y++) {
    const v = (Y + 0.5) / sub;
    for (let X = 0; X < W; X++) {
      const u = (X + 0.5) / sub;
      const k = Y * W + X;
      const mw = bil(mWide, u, v);
      const ww = bil(wWide, u, v);
      let e = 14 * fbm(u * 0.06, v * 0.06) + 24 * Math.pow(mw, 1.1) * (0.75 + 0.5 * noise(u * 0.2 + 7, v * 0.2)) - 9 * ww;
      const ms = bil(mSoft, u, v);
      if (ms > 0) {
        const m = ms + (fbm(u * 0.7, v * 0.7) - 0.5) * 0.3;
        const a = smooth(0.4, 0.6, m);
        if (a > 0) {
          const d = Math.max(0, bil(mHigh, u, v) - 0.6 + (m - 0.5) * 1.5);
          const ridge = 1 - Math.abs(2 * noise(u * 0.45 + 40, v * 0.45) - 1);
          e += a * (11 * Math.pow(d, 1.25) + 9 * ridge * Math.min(1, d * 0.7));
        }
        inside[k] = a;
      }
      if (ww > 0) {
        const w = bil(isW, u, v) + (fbm(u * 0.9 + 70, v * 0.9) - 0.5) * 0.22;
        wMask[k] = w;
        wDepth[k] = Math.max(0, bil(water, u, v) - 0.5 + (w - 0.5));
      }
      elev[k] = e;
      moist[k] = Math.min(1, Math.max(0, 0.15 + 0.85 * fbm(u * 0.035 + 500, v * 0.035) + 0.6 * ww - 0.35 * mw));
    }
  }

  // pass 2: how much of each texture shows (masks), the water, and the light
  const masks = LAYERS.map(() => new ImageData(W, H));
  const wet = new ImageData(W, H);
  const dark = new ImageData(W, H);
  const bright = new ImageData(W, H);
  const step = TILE / sub;
  const [lx, ly, lz] = [-0.55, -0.62, 0.56];
  const flat = 0.3 + 0.95 * lz;
  const shadowReach = Math.round(sub * 0.9);
  const put = (img: ImageData, k: number, a: number) => {
    const d = img.data;
    d[k * 4] = d[k * 4 + 1] = d[k * 4 + 2] = 255;
    d[k * 4 + 3] = a * 255;
  };
  for (let Y = 0; Y < H; Y++) {
    const v = (Y + 0.5) / sub;
    for (let X = 0; X < W; X++) {
      const u = (X + 0.5) / sub;
      const k = Y * W + X;
      const h = elev[k];
      // a little noise on every threshold so edges between grounds are ragged, not contour lines
      const jag = fbm(u * 0.5 + 21, v * 0.5) - 0.5;
      const mo = moist[k] + jag * 0.12;
      const hx = (elev[k + (X < W - 1 ? 1 : 0)] - elev[k - (X > 0 ? 1 : 0)]) / (2 * step);
      const hy = (elev[k + (Y < H - 1 ? W : 0)] - elev[k - (Y > 0 ? W : 0)]) / (2 * step);
      const slope = Math.hypot(hx, hy);
      const a = inside[k];
      put(masks[0], k, smooth(0.62, 0.48, mo) * (0.55 + 0.9 * Math.max(0, fbm(u * 0.25 + 3, v * 0.25) - 0.35)) + smooth(12, 22, h + jag * 8) * 0.6);
      put(masks[1], k, smooth(0.47, 0.33, mo));
      put(masks[2], k, smooth(0.3, 0.17, mo));
      put(masks[3], k, smooth(17, 30, h + jag * 10));
      put(masks[4], k, smooth(0.3, 0.42, wMask[k] + jag * 0.1) * smooth(0.56, 0.5, wMask[k]) + smooth(0.45, 0.8, bil(wWide, u, v)) * 0.35);
      // rock on the massif, thinner where it's gentle so the scree shows through
      put(masks[5], k, a * (0.6 + 0.4 * smooth(0.2, 0.9, slope)));
      // snow only on the highest, flatter ground, in patches
      put(masks[6], k, a * smooth(0, 16, h - 98 - 24 * fbm(u * 0.8 + 3, v * 0.8)) * smooth(1.4, 0.5, slope));

      // water: shallow green-brown at the edge, deep blue-green in the middle, foam on the line
      const w = wMask[k];
      if (w > 0.46) {
        const f = Math.min(1, wDepth[k] / 2.2);
        const ripple = (fbm(u * 3 + 5, v * 1.2) - 0.5) * 22;
        const foam = smooth(0.58, 0.5, w) * 0.45;
        const d = wet.data;
        d[k * 4] = 70 - 42 * f + ripple * 0.5 + (190 - 70) * foam;
        d[k * 4 + 1] = 112 - 44 * f + ripple + (210 - 112) * foam;
        d[k * 4 + 2] = 106 - 12 * f + ripple + (200 - 106) * foam;
        d[k * 4 + 3] = 255 * smooth(0.47, 0.53, w) * (0.82 + 0.18 * f);
      }

      // light: 1 is flat ground; below darkens (multiply), above brightens (screen)
      const lit = Math.max(0, (-hx * lx - hy * ly + lz) / Math.hypot(hx, hy, 1));
      let shade = (0.3 + 0.95 * lit) / flat;
      if (X >= shadowReach && Y >= shadowReach) {
        const up = elev[k - shadowReach * W - shadowReach];
        if (up > h + 6) shade *= 1 - Math.min(0.14, (up - h - 6) / 80);
      }
      // photo textures already carry contrast: keep the swing moderate, more of it on the mountains
      const f = Math.max(0.66, Math.min(1.6, 1 + (shade - 1) * (0.55 + 0.23 * inside[k])));
      const dk = 255 * Math.min(1, f);
      dark.data[k * 4] = dark.data[k * 4 + 1] = dark.data[k * 4 + 2] = dk;
      dark.data[k * 4 + 3] = 255;
      const br = 255 * Math.max(0, f - 1) * 0.35;
      bright.data[k * 4] = bright.data[k * 4 + 1] = bright.data[k * 4 + 2] = br;
      bright.data[k * 4 + 3] = 255;
    }
  }

  const toCanvas = (img: ImageData) => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    c.getContext('2d')!.putImageData(img, 0, 0);
    return c;
  };
  const vary = new ImageData(W, H);
  for (let k = 0; k < W * H; k++) put(vary, k, smooth(0.4, 0.65, fbm(((k % W) + 0.5) / sub * 0.12 + 9, (((k / W) | 0) + 0.5) / sub * 0.12)));
  return { vary: toCanvas(vary), masks: masks.map(toCanvas), wet: toCanvas(wet), dark: toCanvas(dark), bright: toCanvas(bright) };
}

/** Canvas compositing of the land layers, for small overviews (minimap, map previews): flat average colours. */
function paintLand(g: CanvasRenderingContext2D, land: LandLayers, res: number): void {
  const layer = document.createElement('canvas');
  layer.width = g.canvas.width;
  layer.height = g.canvas.height;
  const lg = layer.getContext('2d')!;
  lg.setTransform(res, 0, 0, res, 0, 0);
  g.imageSmoothingEnabled = true;
  g.fillStyle = groundTex.grass.mean;
  g.fillRect(0, 0, MAP_W, MAP_H);
  LAYERS.forEach((n, i) => {
    lg.globalCompositeOperation = 'source-over';
    lg.clearRect(0, 0, MAP_W, MAP_H);
    lg.fillStyle = groundTex[n].mean;
    lg.fillRect(0, 0, MAP_W, MAP_H);
    lg.globalCompositeOperation = 'destination-in';
    lg.drawImage(land.masks[i], 0, 0, MAP_W, MAP_H);
    g.drawImage(layer, 0, 0, MAP_W, MAP_H);
  });
  g.drawImage(land.wet, 0, 0, MAP_W, MAP_H);
  g.globalCompositeOperation = 'multiply';
  g.drawImage(land.dark, 0, 0, MAP_W, MAP_H);
  g.globalCompositeOperation = 'screen';
  g.drawImage(land.bright, 0, 0, MAP_W, MAP_H);
  g.globalCompositeOperation = 'saturation';
  g.globalAlpha = DESATURATE;
  g.fillStyle = '#808080';
  g.fillRect(0, 0, MAP_W, MAP_H);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = `#${GRADE.toString(16)}`;
  g.fillRect(0, 0, MAP_W, MAP_H);
  g.globalCompositeOperation = 'source-over';
}

/** Glints on the water and reeds along the banks. */
function drawWaterDetail(g: CanvasRenderingContext2D, map: GameMap, rng: Rng): void {
  const water = depthOf(map, T_WATER);
  g.lineCap = 'round';
  for (let i = 0; i < water.length; i++) {
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

/**
 * The battlefield's ground, rendered once on the GPU into a texture: photo textures tiled across the
 * map and layered through the landscape's masks, then water, light and grading; the grid, gates and
 * other markings (a transparent canvas) go on top.
 */
/** Landscapes are costly (erosion): one per map, shared by the battlefield and the minimap. */
const landscapes = new WeakMap<GameMap, Landscape>();
function landscapeOf(map: GameMap, sub: number): Landscape {
  let L = landscapes.get(map);
  if (!L || L.sub < sub) landscapes.set(map, (L = buildLandscape(map, sub)));
  return L;
}
const groundImages = () => TEX_NAMES.map((n) => groundTex[n].img);

/** Ground (from a landscape) plus the markings, rendered into one texture; null without WebGL2. */
function composeBackground(map: GameMap, renderer: Renderer, L: Landscape, res: number): Texture | null {
  const painted = renderGround(L, groundImages(), res);
  if (!painted) return null;
  const root = new Container();
  const ground = Texture.from(painted);
  const marks = Texture.from(drawTerrain(map, res, false, false));
  for (const t of [ground, marks]) {
    const sp = new Sprite(t);
    sp.width = MAP_W;
    sp.height = MAP_H;
    root.addChild(sp);
  }
  const target = RenderTexture.create({ width: MAP_W, height: MAP_H, resolution: res });
  renderer.render({ container: root, target });
  root.destroy({ children: true });
  ground.destroy(true);
  marks.destroy(true);
  return target;
}

const backgroundRes = () => Math.min(RES, Math.sqrt(TERRAIN_MAX_PX / (MAP_W * MAP_H)), 8192 / Math.max(MAP_W, MAP_H));
/** Samples per cell side of the detailed landscape. */
const detailSub = () => (COLS * ROWS > 9000 ? 3 : 4);

let landWorker: Worker | null = null;
let landJobs = 0;

/**
 * The detailed battlefield ground: the landscape is eroded in a worker, then painted. Resolves to
 * null if the map size changed meanwhile (another map was started) or WebGL2 is missing.
 */
export async function refineBackground(map: GameMap, renderer: Renderer): Promise<Texture | null> {
  const cols = COLS;
  const rows = ROWS;
  const sub = detailSub();
  const job = ++landJobs;
  let L: Landscape;
  try {
    landWorker ??= new Worker(new URL('./landscape.worker.ts', import.meta.url), { type: 'module' });
    const w = landWorker;
    L = await new Promise<Landscape>((resolve, reject) => {
      w.onmessage = (e: MessageEvent<Landscape>) => resolve(e.data);
      w.onerror = reject;
      w.postMessage({ cols, rows, grid: map.grid.slice(), seed: map.def.seed, sub });
    });
  } catch {
    L = buildLandscape(map, sub);
  }
  if (job !== landJobs || COLS !== cols || ROWS !== rows) return null;
  landscapes.set(map, L);
  return composeBackground(map, renderer, L, backgroundRes());
}

/** The battlefield ground for the first frames: the same landscape, coarse (cheap); see refineBackground(). */
export function buildBackground(map: GameMap, renderer: Renderer): Texture {
  const res = backgroundRes();
  const quick = composeBackground(map, renderer, landscapeOf(map, 1), res);
  if (quick) return quick;
  // no WebGL2: the canvas-and-Pixi layering
  const rng = new Rng(map.def.seed * 7 + 1);
  const land = landLayers(map, rng, res);
  const root = new Container();
  const temp: Texture[] = [];
  const full = (canvas: HTMLCanvasElement) => {
    const t = Texture.from(canvas);
    temp.push(t);
    const sp = new Sprite(t);
    sp.width = MAP_W;
    sp.height = MAP_H;
    return sp;
  };
  const ground = new Container();
  const tiled = (n: TexName, scale = 1, angle = 0) => {
    const t = groundTex[n];
    if (!t.tex) {
      const sp = new Sprite(Texture.WHITE);
      sp.width = MAP_W;
      sp.height = MAP_H;
      sp.tint = t.mean;
      return sp;
    }
    const k = (TEX_WORLD * scale) / t.tex.width;
    return new TilingSprite({ texture: t.tex, width: MAP_W, height: MAP_H, tileScale: { x: k, y: k }, tileRotation: (angle * Math.PI) / 180 });
  };
  const masked = (n: TexName, mask: HTMLCanvasElement, scale = 1, angle = 0) => {
    const m = full(mask);
    const layer = tiled(n, scale, angle);
    layer.mask = m;
    ground.addChild(m, layer);
  };
  ground.addChild(tiled('grass'));
  masked('grass', land.vary, 1.7, 37);
  LAYERS.forEach((n, i) => masked(n, land.masks[i], layerScale(n), layerAngle(i)));
  ground.addChild(full(land.wet));
  const dark = full(land.dark);
  dark.blendMode = 'multiply';
  const bright = full(land.bright);
  bright.blendMode = 'screen';
  ground.addChild(dark, bright);
  const grade = new ColorMatrixFilter();
  grade.saturate(-DESATURATE, false);
  ground.filters = [grade];
  const tint = new Sprite(Texture.WHITE);
  tint.width = MAP_W;
  tint.height = MAP_H;
  tint.tint = GRADE;
  tint.blendMode = 'multiply';
  root.addChild(ground, tint, full(drawTerrain(map, res, false, false)));
  const target = RenderTexture.create({ width: MAP_W, height: MAP_H, resolution: res });
  renderer.render({ container: root, target });
  root.destroy({ children: true });
  for (const t of temp) t.destroy(true);
  grade.destroy();
  return target;
}

/**
 * Terrain painted at `res` pixels per world pixel (low res for menu previews and the minimap).
 * `solidRocks` paints the rocks themselves, for overviews that don't draw the 3D sprites;
 * `ground: false` leaves out the ground and keeps only the markings (the GPU path draws the ground).
 */
export function drawTerrain(map: GameMap, res: number, solidRocks = false, ground = true): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(MAP_W * res);
  canvas.height = Math.ceil(MAP_H * res);
  const g = canvas.getContext('2d')!;
  g.scale(res, res);
  const rng = new Rng(map.def.seed * 7 + 1);

  if (ground) {
    // small overviews: the same landscape, cheaply (the battlefield's if it exists, else a coarse one)
    const painted = renderGround(landscapeOf(map, 1), groundImages(), res);
    if (painted) g.drawImage(painted, 0, 0, MAP_W, MAP_H);
    else paintLand(g, landLayers(map, rng, res), res);
  }
  if (res >= 0.5) drawWaterDetail(g, map, rng);

  // build grid on buildable ground only: faint cell lines, stronger every tower-width
  g.save();
  g.beginPath();
  for (let i = 0; i < map.grid.length; i++) if (map.grid[i] === T_BUILD || map.grid[i] === T_ROCK) g.rect((i % COLS) * TILE, ((i / COLS) | 0) * TILE, TILE, TILE);
  g.clip();
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
  g.restore();

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
