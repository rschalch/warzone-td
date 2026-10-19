import { CanvasSource, Container, Rectangle, RenderTexture, Sprite, Texture, type Renderer } from 'pixi.js';
import { COLS, MAP_H, MAP_W, ROWS, TILE, TOWERS } from '../game/defs';
import { T_BUILD, T_GATE, T_MOUNT, T_ROCK, T_TREE, T_WATER, type GameMap } from '../game/maps';
import { Rng } from '../game/rng';
import { DIRS, models, type ModelSet } from './models';
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
/** Baked model frames, kept across atlas rebuilds (a model set is only baked once). */
const baked = new Map<string, Entry>();
const bakedSets = new Set<ModelSet>();

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

/** WW2: the V-2 in flight. */
def('v2shell', 30, 10, (g) => {
  g.fillStyle = '#2a2a26';
  g.beginPath();
  g.moveTo(-14, -5); g.lineTo(-8, -1.8); g.lineTo(-8, 1.8); g.lineTo(-14, 5); g.closePath();
  g.fill();
  g.fillStyle = '#e8e6dc';
  rrect(g, -12, -2.6, 20, 5.2, 2.4);
  g.fill();
  g.fillStyle = '#1e1e1c';
  g.fillRect(-12, -2.6, 6, 2.6);
  g.fillRect(-6, 0, 6, 2.6);
  g.fillRect(0, -2.6, 4, 2.6);
  g.fillStyle = '#e8e6dc';
  g.beginPath();
  g.moveTo(8, -2.6); g.lineTo(14, 0); g.lineTo(8, 2.6); g.closePath();
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

// WW2 floor obstacles
def('d_wire', 40, 40, (g) => {
  // two rows of concertina coils between stakes
  g.fillStyle = 'rgba(70,58,40,0.35)';
  rrect(g, -19, -19, 38, 38, 4);
  g.fill();
  for (const y of [-8, 8]) {
    g.strokeStyle = 'rgba(30,28,24,0.55)';
    g.lineWidth = 1.6;
    for (let x = -17; x <= 17; x += 3.4) {
      g.beginPath();
      g.ellipse(x + 0.6, y + 0.8, 3.2, 6, 0, 0, Math.PI * 2);
      g.stroke();
    }
    g.strokeStyle = '#a8a8a0';
    g.lineWidth = 0.8;
    for (let x = -17; x <= 17; x += 3.4) {
      g.beginPath();
      g.ellipse(x, y, 3.2, 6, 0, 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = '#5a3c22';
    for (const x of [-18, 0, 18]) g.fillRect(x - 1, y - 1, 2, 2);
  }
});
def('d_teller', 20, 20, (g) => {
  g.fillStyle = 'rgba(80,62,40,0.6)';
  g.beginPath();
  g.arc(0, 0, 9, 0, Math.PI * 2);
  g.fill();
  const gr = g.createRadialGradient(-2, -2, 0.5, 0, 0, 6.5);
  gr.addColorStop(0, '#8a8a6a');
  gr.addColorStop(1, '#3e4030');
  g.fillStyle = gr;
  g.beginPath();
  g.arc(0, 0, 6.5, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.5)';
  g.lineWidth = 0.6;
  g.stroke();
  g.fillStyle = '#5a5c48';
  g.beginPath();
  g.arc(0, 0, 2.6, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  // loose earth over the edge
  g.fillStyle = 'rgba(110,90,60,0.7)';
  for (const [x, y, r] of [[-5, 4, 2], [4, -5, 1.6], [5, 4, 1.4]]) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
});
def('d_smine', 20, 20, (g) => {
  g.fillStyle = 'rgba(80,62,40,0.55)';
  g.beginPath();
  g.arc(0, 0, 7, 0, Math.PI * 2);
  g.fill();
  // just the three prongs of the igniter showing
  g.fillStyle = '#2a2a24';
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    g.beginPath();
    g.arc(Math.cos(a) * 1.4, Math.sin(a) * 1.4, 0.8, 0, Math.PI * 2);
    g.fill();
  }
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
  const e = baked.get(name) ?? entries.find((en) => en.name === name);
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
  const decal = t.decal ?? ICON_DECALS[t.kind];
  if (decal) {
    // lay the trap flat in the same 2:1 projection as the iso camera
    g.translate(size / 2, size / 2);
    g.scale(1, 0.55);
    g.rotate(Math.PI / 4);
    g.translate(-size / 2, -size / 2);
    fitEntry(g, decal, size, t.size === 1 ? 0.8 : 1);
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
async function bakeAll(sets: ModelSet[]): Promise<BakedFrame[]> {
  const names = Object.keys(models).filter((n) => sets.includes(models[n].set)).sort((a, b) => bakeCost(b) - bakeCost(a));
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

/** Has the atlas the models of this set? */
export const atlasHas = (set: ModelSet) => bakedSets.has(set);

/** Bakes the model sets not baked yet and packs everything into a fresh atlas texture. */
export async function buildAtlas(sets: ModelSet[] = ['classic']): Promise<Atlas> {
  const todo = sets.filter((s) => !bakedSets.has(s));
  for (const f of await bakeAll(todo)) {
    const { w, h, image } = f;
    baked.set(f.name, { name: f.name, w, h, draw: (g) => g.drawImage(image, -w / 2, -h / 2, w, h), anchor: f.anchor });
  }
  for (const s of todo) bakedSets.add(s);
  const all = [...entries, ...baked.values()];
  const pad = 2;
  const size = 1024;
  // shelf-pack first to know the height we need
  const frames: Record<string, Rectangle> = {};
  let x = pad;
  let y = pad;
  let rowH = 0;
  const sorted = [...all].sort((a, b) => b.h - a.h);
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
  for (const e of all) {
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

/** Flat colours by ground type: the terrain without WebGL2. */
function flatGround(g: CanvasRenderingContext2D, map: GameMap): void {
  const colours: Record<number, string> = { [T_WATER]: '#3a9ab4', [T_MOUNT]: '#9a8e78', [T_TREE]: '#3c6a24' };
  g.fillStyle = '#76a234';
  g.fillRect(0, 0, MAP_W, MAP_H);
  for (let i = 0; i < map.grid.length; i++) {
    const c = colours[map.grid[i]];
    if (!c) continue;
    g.fillStyle = c;
    g.fillRect((i % COLS) * TILE, ((i / COLS) | 0) * TILE, TILE, TILE);
  }
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

/** Scenery models, indexed by Scenery.k. */
export const SCENERY = ['tree0', 'tree1', 'tree2', 'pine0', 'pine1', 'bush0', 'bush1'];
export interface Scenery {
  x: number;
  y: number;
  k: number;
}

/**
 * Trees and bushes, only on ground that blocks anyway (so they never hide a tower spot): dense woods on
 * forest cells with bushes along their edges, and on the mountains leafy woods on the lower slopes,
 * pines higher up and bare rock on the tops. Deterministic per map.
 */
export function scenery(map: GameMap): Scenery[] {
  const depth = depthOf(map, T_MOUNT);
  const woods = depthOf(map, T_TREE);
  const rng = new Rng(map.def.seed * 31 + 9);
  const out: Scenery[] = [];
  for (let i = 0; i < woods.length; i++) {
    const d = woods[i];
    if (!d) continue;
    const c = i % COLS;
    const r = (i / COLS) | 0;
    for (let k = 0; k < 3; k++) {
      if (k === 2 && rng.next() < 0.5) continue;
      const kind = d === 1 && rng.next() < 0.3 ? 5 + rng.int(2) : rng.next() < 0.22 ? 3 + rng.int(2) : rng.int(3);
      out.push({ x: (c + rng.range(0.1, 0.9)) * TILE, y: (r + rng.range(0.1, 0.9)) * TILE, k: kind });
    }
  }
  for (let i = 0; i < depth.length; i++) {
    const d = depth[i];
    if (!d) continue;
    const c = i % COLS;
    const r = (i / COLS) | 0;
    const n = d <= 1 ? 3 : d === 2 ? 2 : d <= 4 ? 1 : 0;
    for (let k = 0; k < n; k++) {
      if (rng.next() < (d <= 2 ? 0.15 : 0.55)) continue;
      const kind = d <= 1 ? (rng.next() < 0.3 ? 5 + rng.int(2) : rng.int(3)) : d === 2 ? rng.int(3) + (rng.next() < 0.4 ? 3 - rng.int(3) + rng.int(2) : 0) : 3 + rng.int(2);
      out.push({ x: (c + rng.range(0.1, 0.9)) * TILE, y: (r + rng.range(0.1, 0.9)) * TILE, k: Math.min(SCENERY.length - 1, kind) });
    }
  }
  return out;
}

/** Landscapes are costly (erosion): one per map, shared by the battlefield and the minimap. */
const landscapes = new WeakMap<GameMap, Landscape>();
function landscapeOf(map: GameMap, sub: number): Landscape {
  let L = landscapes.get(map);
  if (!L || L.sub < sub) landscapes.set(map, (L = buildLandscape(map, sub)));
  return L;
}
/** Ground (from a landscape) plus the markings, rendered into one texture; null without WebGL2. */
function composeBackground(map: GameMap, renderer: Renderer, L: Landscape, res: number): Texture | null {
  const painted = renderGround(L, res);
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
  return new Texture({ source: new CanvasSource({ resource: drawTerrain(map, res), resolution: res }) });
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
    const painted = renderGround(landscapeOf(map, 1), res);
    if (painted) g.drawImage(painted, 0, 0, MAP_W, MAP_H);
    else flatGround(g, map);
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

  // overviews don't draw the tree sprites: dot the woods with little canopies instead
  if (solidRocks) {
    for (const t of scenery(map)) {
      g.fillStyle = t.k >= 5 ? '#4f8c30' : t.k >= 3 ? '#245226' : '#2f6a22';
      g.beginPath();
      g.arc(t.x, t.y, t.k >= 5 ? 4 : 6.5, 0, Math.PI * 2);
      g.fill();
    }
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
