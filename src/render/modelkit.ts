// The sprite-stacking model kit: the model registry and the drawing helpers shared by models.ts
// (modern) and models_ww2.ts.
//
// A model is a stack of top-down parts drawn in model space (facing +x, origin at the centre,
// world pixels). Each part is extruded from z0 to z1; `sliced` parts are redrawn per slice so
// their colour can change with height (coil windings, banding). atlas.ts bakes these into frames.

import { Rng } from '../game/rng';

export type Ctx = CanvasRenderingContext2D;

export interface Part {
  z0: number;
  z1: number;
  draw: (g: Ctx, z: number) => void;
  sliced?: boolean;
}

export interface Model {
  r: number; // footprint radius (frame size)
  parts: Part[];
  dirs: number; // iso headings to bake (1 = static)
  grounded: boolean; // bake a contact shadow
  outline: boolean; // dark silhouette edge (off for translucent things like rotor blur)
  set: ModelSet; // which models get baked together (WW2 ones only once a WW2 game starts)
}

export type ModelSet = 'classic' | 'ww2';
let currentSet: ModelSet = 'classic';
/** Models defined from now on belong to this set. */
export const setModelSet = (s: ModelSet) => (currentSet = s);

export const models: Record<string, Model> = {};
export const model = (name: string, r: number, dirs: number, parts: Part[], grounded = true, outline = true) =>
  (models[name] = { r, dirs, parts, grounded, outline, set: currentSet });
export const P = (z0: number, z1: number, draw: Part['draw'], sliced = false): Part => ({ z0, z1, draw, sliced });

export const DIRS = 16;
export const TOWER_DECK = 10; // z of a tower block's top; turrets start here

// ---------------------------------------------------------------- drawing helpers

export const OUTLINE = 'rgba(10,12,8,0.55)';

export function grad(g: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]): CanvasGradient {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  return gr;
}

export function rgrad(g: Ctx, x: number, y: number, r: number, stops: [number, string][]): CanvasGradient {
  const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.05, x, y, r);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  return gr;
}

export function finish(g: Ctx, fill: string | CanvasGradient, stroke: string | null = OUTLINE, lw = 0.6) {
  g.fillStyle = fill;
  g.fill();
  if (stroke) {
    g.strokeStyle = stroke;
    g.lineWidth = lw;
    g.stroke();
  }
}

export function box(g: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient, stroke: string | null = OUTLINE) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  finish(g, fill, stroke);
}

export function circ(g: Ctx, x: number, y: number, r: number, fill: string | CanvasGradient, stroke: string | null = OUTLINE) {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  finish(g, fill, stroke);
}

export function poly(g: Ctx, pts: number[], fill: string | CanvasGradient, stroke: string | null = OUTLINE) {
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
  finish(g, fill, stroke);
}

export function line(g: Ctx, pts: number[], color: string, lw = 0.5) {
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.strokeStyle = color;
  g.lineWidth = lw;
  g.stroke();
}

/** Lighter/darker blobs clipped to the current path — camouflage and weathering. */
export function camo(g: Ctx, path: () => void, colors: string[], seed: number, n: number, size: number, area: number) {
  const rng = new Rng(seed);
  g.save();
  path();
  g.clip();
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[i % colors.length];
    g.beginPath();
    g.ellipse(rng.range(-area, area), rng.range(-area, area), size * rng.range(0.5, 1), size * rng.range(0.3, 0.7), rng.next() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

/** A track belt: dark rubber with tread bars. */
export function tread(g: Ctx, x: number, y: number, w: number, h: number, step = 1.7) {
  box(g, x, y, w, h, Math.min(2, h / 2), grad(g, 0, y, 0, y + h, [[0, '#2a2a26'], [0.5, '#1a1a17'], [1, '#2a2a26']]));
  g.save();
  g.beginPath();
  g.roundRect(x, y, w, h, Math.min(2, h / 2));
  g.clip();
  for (let tx = x + 0.6; tx < x + w; tx += step) line(g, [tx, y, tx, y + h], 'rgba(90,90,80,0.55)', 0.6);
  g.restore();
}

export function wheel(g: Ctx, x: number, y: number, w: number, h: number) {
  box(g, x, y, w, h, 1, '#1b1b19');
  for (let tx = x + 0.7; tx < x + w; tx += 1.2) line(g, [tx, y + 0.2, tx, y + h - 0.2], 'rgba(80,80,70,0.6)', 0.4);
}

export function star(g: Ctx, x: number, y: number, r: number, fill: string, stroke: string | null = 'rgba(0,0,0,0.6)') {
  const pts: number[] = [];
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 ? r * 0.45 : r;
    pts.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  poly(g, pts, fill, stroke);
}
