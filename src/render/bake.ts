// Model baking, shared by the main thread and the bake workers (see bake.worker.ts).

import { MODEL_TOP, models, type Part } from './models';

export const RES = 2; // atlas pixels per logical pixel (crisp on HiDPI)

// ---------------------------------------------------------------- model baking
//
// Each model is baked twice:
//  - iso: `${name}_${d}` for d in [0, dirs): parts drawn in 2:1 projection, stacked slice by slice.
//    Side slices get a left-lit/right-shaded gradient, tops get a fixed top-left light, then the
//    whole frame gets a dark outline and (for ground units) a soft contact shadow.
//  - top: `${name}_t`, a single frame facing +x that the renderer rotates; parts are layered with
//    small drop shadows so height still reads from above.

// OffscreenCanvas so the same code runs in workers; CPU-backed because baking does thousands of
// small draws from a reused scratch canvas, which GPU-backed canvases turn into a flush per draw.
type Canvas = OffscreenCanvas;
type Ctx2D = OffscreenCanvasRenderingContext2D;
const CPU: CanvasRenderingContext2DSettings = { willReadFrequently: true };
const tmp = new OffscreenCanvas(1, 1);
const tctx = tmp.getContext('2d', CPU) as Ctx2D;

function makeCanvas(w: number, h: number): [Canvas, Ctx2D] {
  const c = new OffscreenCanvas(Math.ceil(w * RES), Math.ceil(h * RES));
  return [c, c.getContext('2d', CPU) as Ctx2D];
}

/** Draws one part (at slice height z) into the shared scratch canvas, shaded as a side or a top. */
function renderPart(part: Part, z: number, heading: number, iso: boolean, w: number, h: number, side: boolean): Canvas {
  const cw = Math.ceil(w * RES);
  const ch = Math.ceil(h * RES);
  const g = tctx;
  if (tmp.width !== cw || tmp.height !== ch) {
    tmp.width = cw;
    tmp.height = ch;
  } else {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cw, ch);
  }
  g.setTransform(RES, 0, 0, RES, 0, 0);
  g.translate(w / 2, h / 2);
  if (iso) {
    g.scale(1, 0.5);
    g.rotate(Math.PI / 4 + heading);
  }
  part.draw(g as unknown as CanvasRenderingContext2D, z);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  if (side) {
    const gr = g.createLinearGradient(0, 0, tmp.width, 0);
    gr.addColorStop(0, 'rgba(0,0,0,0.28)');
    gr.addColorStop(1, 'rgba(0,0,0,0.62)');
    g.fillStyle = gr;
  } else {
    const gr = g.createLinearGradient(0, 0, tmp.width, tmp.height);
    gr.addColorStop(0, 'rgba(255,255,240,0.14)');
    gr.addColorStop(1, 'rgba(0,0,0,0.16)');
    g.fillStyle = gr;
  }
  g.fillRect(0, 0, tmp.width, tmp.height);
  g.globalCompositeOperation = 'source-over';
  return tmp;
}

/** Adds a dark outline around everything already drawn in `src`, on top of an optional shadow layer. */
function outlined(src: Canvas, under?: (g: Ctx2D) => void, edge = true): Canvas {
  const [sil, sg] = makeCanvas(src.width / RES, src.height / RES);
  sg.drawImage(src, 0, 0);
  sg.globalCompositeOperation = 'source-in';
  sg.fillStyle = 'rgba(12,14,9,0.75)';
  sg.fillRect(0, 0, sil.width, sil.height);
  const [out, og] = makeCanvas(src.width / RES, src.height / RES);
  if (under) {
    og.save();
    og.scale(RES, RES);
    under(og);
    og.restore();
  }
  const o = RES * 0.55;
  if (edge) for (const [dx, dy] of [[-o, 0], [o, 0], [0, -o], [0, o], [-o, -o], [o, -o], [-o, o], [o, o]]) og.drawImage(sil, dx, dy);
  og.drawImage(src, 0, 0);
  return out;
}

export interface BakedFrame {
  name: string;
  w: number;
  h: number;
  anchor: [number, number];
  image: Canvas | ImageBitmap;
}

/** Bakes all frames of one model. */
export function bakeModel(name: string): BakedFrame[] {
  const out: BakedFrame[] = [];
  {
    const m = models[name];
    const top = MODEL_TOP[name];
    const parts = [...m.parts].sort((a, b) => a.z0 - b.z0);

    // ---- iso frames
    const w = Math.ceil(m.r * 2) + 4;
    const footH = Math.ceil(m.r) + 4;
    const h = footH + Math.ceil(top) + 2;
    const groundY = h - footH / 2;
    for (let d = 0; d < m.dirs; d++) {
      const heading = (d / m.dirs) * Math.PI * 2;
      const [frame, fg] = makeCanvas(w, h);
      fg.scale(RES, RES);
      const oy = groundY - footH / 2;
      for (const part of parts) {
        if (part.sliced) {
          for (let z = part.z0; z < part.z1; z += 0.5) fg.drawImage(renderPart(part, z, heading, true, w, footH, true), 0, oy - z, w, footH);
        } else if (part.z1 > part.z0) {
          const side = renderPart(part, part.z0, heading, true, w, footH, true);
          for (let z = part.z0; z < part.z1; z += 0.5) fg.drawImage(side, 0, oy - z, w, footH);
        }
        fg.drawImage(renderPart(part, part.z1 - 0.5, heading, true, w, footH, false), 0, oy - part.z1, w, footH);
      }
      const baked = outlined(frame, m.grounded ? (g) => {
        const gr = g.createRadialGradient(w / 2, groundY, 0, w / 2, groundY, m.r * 0.95);
        gr.addColorStop(0, 'rgba(0,0,0,0.42)');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr;
        g.save();
        g.translate(w / 2, groundY);
        g.scale(1, 0.5);
        g.translate(-w / 2, -groundY);
        g.fillRect(0, groundY - m.r, w, m.r * 2);
        g.restore();
      } : undefined, m.outline);
      out.push({ name: `${name}_${d}`, w, h, anchor: [0.5, groundY / h], image: baked });
    }

    // ---- top-down frame
    const s = Math.ceil(m.r * 2) + 4;
    const [frame, fg] = makeCanvas(s, s);
    fg.scale(RES, RES);
    for (const part of parts) {
      const lift = Math.min(1.6, (part.z1 - part.z0) * 0.12 + 0.3);
      // tapered (sliced) parts: show the wider base under the top
      if (part.sliced) fg.drawImage(renderPart(part, part.z0, 0, false, s, s, true), 0, 0, s, s);
      const shadow = renderPart(part, part.z1 - 0.5, 0, false, s, s, true);
      fg.globalAlpha = 0.6;
      fg.drawImage(shadow, lift, lift, s, s);
      fg.globalAlpha = 1;
      fg.drawImage(renderPart(part, part.z1 - 0.5, 0, false, s, s, false), 0, 0, s, s);
    }
    const baked = outlined(frame, undefined, m.outline);
    out.push({ name: `${name}_t`, w: s, h: s, anchor: [0.5, 0.5], image: baked });
  }
  return out;
}

/** Rough relative cost of baking a model, for splitting work between workers. */
export function bakeCost(name: string): number {
  const m = models[name];
  let slices = 0;
  for (const p of m.parts) slices += p.sliced ? (p.z1 - p.z0) * 2 : 1;
  return m.dirs * (slices + m.parts.length) * m.r;
}

