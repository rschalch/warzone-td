import { CanvasSource, Texture, Rectangle } from 'pixi.js';
import { COLS, MAP_H, MAP_W, ROWS, TILE } from '../game/defs';
import { T_GATE, type GameMap } from '../game/maps';
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
