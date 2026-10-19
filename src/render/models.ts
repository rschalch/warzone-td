// 3D model definitions for sprite stacking.
//
// A model is a stack of top-down parts drawn in model space (facing +x, origin at the centre,
// world pixels). Each part is extruded from z0 to z1; `sliced` parts are redrawn per slice so
// their colour can change with height (coil windings, banding). atlas.ts bakes these into frames.
// The WW2 models are in models_ww2.ts; both draw with the kit in modelkit.ts.

import { TOWERS } from '../game/defs';
import { Rng } from '../game/rng';
import {
  DIRS, OUTLINE, P, TOWER_DECK, box, camo, circ, finish, grad, line, model, models, poly, rgrad, setModelSet, star, tread, wheel, type Ctx, type Part,
} from './modelkit';
import './models_ww2';

export { DIRS, TOWER_DECK, models, type Ctx, type Model, type ModelSet, type Part } from './modelkit';

// palettes
const OLIVE = ['#7f8f4a', '#5b6b34', '#3b4622'];
const SAND = ['#c9ad72', '#a8894e', '#6e5730'];
const RUST = ['#8a5a3c', '#6b4430', '#40281b'];

// ================================================================ enemies (facing +x)

model('infantry', 8, DIRS, [
  P(0, 3, (g) => {
    box(g, -1.6, -2.6, 3.4, 1.7, 0.8, '#262c1c');
    box(g, -0.4, 0.9, 3.4, 1.7, 0.8, '#262c1c');
  }),
  P(3, 7, (g) => {
    box(g, -4.2, -2.7, 2.6, 5.4, 1, '#4d4a2c'); // backpack
    g.beginPath();
    g.ellipse(0, 0, 2.6, 3.7, 0, 0, Math.PI * 2);
    finish(g, grad(g, -2, -3, 2, 3, [[0, OLIVE[0]], [1, OLIVE[2]]]));
    circ(g, 1.6, -2.6, 1.1, OLIVE[1]); // arms
    circ(g, 2.2, 1.4, 1.1, OLIVE[1]);
  }),
  P(5.5, 6.5, (g) => {
    box(g, 0.6, 0.2, 8, 1.1, 0.4, '#1d1d1b', null);
    box(g, 2.8, 1.1, 1.1, 1.8, 0.3, '#1d1d1b', null);
  }),
  P(7, 9.5, (g) => {
    circ(g, 0.3, 0, 2.5, rgrad(g, 0.3, 0, 2.5, [[0, '#93a35a'], [1, '#46542a']]));
    line(g, [-1.5, -1.6, 1.8, -1.9], 'rgba(255,255,255,0.15)', 0.5); // strap/highlight
  }),
]);

model('buggy', 14, DIRS, [
  P(0, 4.5, (g) => {
    for (const [x, y] of [[-9, -8.5], [4, -8.5], [-9, 5.3], [4, 5.3]]) wheel(g, x, y, 5.4, 3.2);
  }),
  P(2.5, 5.5, (g) => {
    const body = () => {
      g.beginPath();
      g.moveTo(-10.5, -5.6); g.lineTo(7, -5.6); g.lineTo(10.8, -3); g.lineTo(10.8, 3); g.lineTo(7, 5.6); g.lineTo(-10.5, 5.6);
      g.closePath();
    };
    body();
    finish(g, grad(g, -10, -6, 10, 6, [[0, SAND[0]], [1, SAND[2]]]));
    camo(g, body, ['rgba(110,80,40,0.35)', 'rgba(230,210,160,0.2)'], 3, 6, 4, 10);
    line(g, [3, -5.4, 3, 5.4], 'rgba(0,0,0,0.3)');
    circ(g, 10.2, -3.6, 0.9, '#fff2b0', null);
    circ(g, 10.2, 3.6, 0.9, '#fff2b0', null);
  }),
  P(5.5, 6.5, (g) => {
    box(g, -4.8, -4.4, 3.8, 3.6, 1, '#3d3220');
    box(g, -4.8, 0.8, 3.8, 3.6, 1, '#3d3220');
    circ(g, -9, 0, 2.4, '#1b1b19');
    circ(g, -9, 0, 1.1, '#555');
  }),
  // roll cage posts + top bars
  P(5.5, 9, (g) => {
    for (const [x, y] of [[-6, -5], [1.5, -5], [-6, 4.2], [1.5, 4.2]]) box(g, x, y, 0.8, 0.8, 0.2, '#2a2a28', null);
  }),
  P(9, 9.8, (g) => {
    g.beginPath();
    g.rect(-5.6, -4.6, 7.5, 9.2);
    g.moveTo(-5.6, -4.6); g.lineTo(1.9, 4.6);
    g.strokeStyle = '#2f2f2c';
    g.lineWidth = 0.9;
    g.stroke();
  }),
  P(7.5, 9, (g) => {
    box(g, -10, -0.6, 6.5, 1.2, 0.4, '#1d1d1b', null); // rear gun
    box(g, -6.4, -1.8, 1.4, 3.6, 0.4, '#3a3a36');
  }),
]);

model('apc', 16, DIRS, [
  P(0, 4, (g) => {
    for (const x of [-11, -5.4, 0.2, 5.8]) {
      wheel(g, x, -9.2, 4, 2.8);
      wheel(g, x, 6.4, 4, 2.8);
    }
  }),
  P(3, 9, (g) => {
    const hull = () => poly(g, [-12.5, -7.2, 8, -7.2, 12.5, -3.6, 12.5, 3.6, 8, 7.2, -12.5, 7.2], 'rgba(0,0,0,0)', null);
    poly(g, [-12.5, -7.2, 8, -7.2, 12.5, -3.6, 12.5, 3.6, 8, 7.2, -12.5, 7.2], grad(g, -12, -7, 12, 7, [[0, '#7c8670'], [1, '#454c3e']]));
    camo(g, hull, ['rgba(40,50,30,0.35)', 'rgba(150,160,130,0.2)'], 9, 8, 4, 13);
    line(g, [8, -7, 8, 7], 'rgba(0,0,0,0.35)');
    line(g, [-6, -7, -6, 7], 'rgba(0,0,0,0.2)');
    box(g, -11.5, -8, 6, 1.6, 0.4, '#3b4232'); // side storage
    box(g, -11.5, 6.4, 6, 1.6, 0.4, '#3b4232');
    circ(g, 11.6, -2.6, 0.7, '#ffeaa0', null);
    circ(g, 11.6, 2.6, 0.7, '#ffeaa0', null);
  }),
  P(9, 10, (g) => {
    circ(g, -8.5, -3.2, 1.9, '#5e6852');
    circ(g, -8.5, 3.2, 1.9, '#5e6852');
    line(g, [-10.2, -3.2, -6.8, -3.2], 'rgba(0,0,0,0.4)');
    line(g, [-10.2, 3.2, -6.8, 3.2], 'rgba(0,0,0,0.4)');
    for (let x = 2; x < 7; x += 1.2) line(g, [x, -3, x, 3], 'rgba(0,0,0,0.3)'); // engine grille
  }),
  P(9, 12.5, (g) => {
    poly(g, [-3.5, -3.6, 2.5, -3.6, 4.5, -1.6, 4.5, 1.6, 2.5, 3.6, -3.5, 3.6], grad(g, -3, -3, 4, 3, [[0, '#6e7a62'], [1, '#434a3a']]));
  }),
  P(10.5, 11.5, (g) => {
    box(g, 4, -0.55, 9, 1.1, 0.3, '#262824', null);
    box(g, 11.5, -0.85, 1.8, 1.7, 0.3, '#1a1c18', null);
  }),
  P(10, 17, (g) => circ(g, -11, 5.2, 0.35, '#1a1a1a', null)), // antenna
]);

model('tank', 19, DIRS, [
  P(0, 5, (g) => {
    tread(g, -14.5, -11.5, 29, 5.6);
    tread(g, -14.5, 5.9, 29, 5.6);
  }),
  P(4.5, 5.5, (g) => {
    box(g, -12.5, -11.8, 25, 3.4, 0.8, '#4b5a2a'); // side skirts
    box(g, -12.5, 8.4, 25, 3.4, 0.8, '#4b5a2a');
    for (let x = -11; x < 12; x += 4.5) {
      circ(g, x, -10.1, 0.35, 'rgba(0,0,0,0.5)', null);
      circ(g, x, 10.1, 0.35, 'rgba(0,0,0,0.5)', null);
    }
  }),
  P(4.5, 8.5, (g) => {
    const pts = [-13.5, -8, 10, -8, 13.5, -5, 13.5, 5, 10, 8, -13.5, 8];
    poly(g, pts, grad(g, -13, -8, 13, 8, [[0, OLIVE[0]], [1, OLIVE[2]]]));
    camo(g, () => poly(g, pts, 'rgba(0,0,0,0)', null), ['rgba(40,45,20,0.45)', 'rgba(120,100,60,0.35)'], 21, 9, 5, 14);
    for (let x = -12.5; x < -7; x += 1.1) line(g, [x, -5.5, x, 5.5], 'rgba(0,0,0,0.35)'); // engine deck
    circ(g, 12.6, -6, 0.8, '#ffeaa0', null);
    circ(g, 12.6, 6, 0.8, '#ffeaa0', null);
  }),
  P(8.5, 12.5, (g) => {
    const pts = [-7.5, -6.2, 3, -6.8, 7.5, -3.2, 7.5, 3.2, 3, 6.8, -7.5, 6.2];
    box(g, -10, -4.2, 3.2, 8.4, 1, '#4a5826'); // bustle
    poly(g, pts, grad(g, -7, -6, 7, 6, [[0, '#8d9d55'], [1, '#46542a']]));
    camo(g, () => poly(g, pts, 'rgba(0,0,0,0)', null), ['rgba(40,45,20,0.45)', 'rgba(120,100,60,0.35)'], 7, 6, 3.5, 8);
    box(g, 4.5, -7.6, 2.4, 1.6, 0.4, '#2a2e20'); // smoke launchers
    box(g, 4.5, 6, 2.4, 1.6, 0.4, '#2a2e20');
  }),
  P(10, 11.5, (g) => {
    box(g, 6.5, -0.95, 15, 1.9, 0.6, grad(g, 0, -1, 0, 1, [[0, '#59663a'], [1, '#2e3520']]));
    box(g, 12, -1.4, 3.2, 2.8, 0.8, '#3a4426'); // fume extractor
    box(g, 20.5, -1.4, 2.2, 2.8, 0.4, '#20241a'); // muzzle brake
  }),
  P(12.5, 14, (g) => {
    circ(g, -2.8, -2.6, 2.2, rgrad(g, -2.8, -2.6, 2.2, [[0, '#9aa865'], [1, '#4b5a2c']]));
    line(g, [-4.4, -2.6, -1.2, -2.6], 'rgba(0,0,0,0.5)');
    box(g, -3.5, 2.2, 2.6, 2.2, 0.5, '#3f4a24');
  }),
]);

model('heli', 22, DIRS, [
  P(0, 1, (g) => {
    box(g, -7, -5.8, 15, 1, 0.5, '#1d1d1b', null);
    box(g, -7, 4.8, 15, 1, 0.5, '#1d1d1b', null);
    line(g, [-4, -5.3, -4, 5.3], '#1d1d1b', 0.8);
    line(g, [4, -5.3, 4, 5.3], '#1d1d1b', 0.8);
  }),
  P(2, 4, (g) => {
    poly(g, [-4, -2, -21, -0.9, -21, 0.9, -4, 2], grad(g, 0, -2, 0, 2, [[0, '#6e8250'], [1, '#3a462c']]));
    box(g, -2.8, -9.5, 4.4, 19, 1, '#4c5a3c'); // stub wings
  }),
  P(1.5, 4.5, (g) => {
    for (const y of [-9.8, 6.8]) {
      box(g, -4, y, 7.2, 3, 1.5, grad(g, 0, y, 0, y + 3, [[0, '#4a4e48'], [1, '#232622']]));
      for (const dy of [0.8, 2.2]) circ(g, 3, y + dy, 0.45, '#0e0e0e', null);
    }
  }),
  P(1, 7.5, (g) => {
    g.beginPath();
    g.ellipse(1.5, 0, 9.5, 3.6, 0, 0, Math.PI * 2);
    finish(g, grad(g, 0, -3.6, 0, 3.6, [[0, '#7f9458'], [0.5, '#5d7044'], [1, '#3a462c']]));
    box(g, 9, -0.45, 4.5, 0.9, 0.3, '#121212', null); // chin gun
  }),
  P(6, 9, (g) => {
    box(g, -6, -2.4, 7, 4.8, 2.2, grad(g, -6, -2, 1, 2, [[0, '#6c7e5a'], [1, '#3f4e36']]));
    circ(g, -6.2, -1.4, 0.8, '#151515', null);
    circ(g, -6.2, 1.4, 0.8, '#151515', null);
  }),
  P(6.5, 8.5, (g) => {
    for (const [x, rx] of [[3.8, 2.6], [8, 2.2]]) {
      g.beginPath();
      g.ellipse(x, 0, rx, 2, 0, 0, Math.PI * 2);
      finish(g, grad(g, x - rx, -2, x + rx, 2, [[0, '#d8f0fa'], [0.5, '#6aa6c4'], [1, '#2a4e62']]), 'rgba(20,30,20,0.7)');
    }
    line(g, [2.6, -1.2, 4.6, -1.4], 'rgba(255,255,255,0.7)', 0.5);
  }),
  P(3, 8, (g) => box(g, -21.5, -0.4, 3.2, 0.8, 0.3, '#2c3622')), // tail fin
  P(6, 6.8, (g) => box(g, -21, 1, 3.6, 0.5, 0.2, '#333', null)), // tail rotor
], false);

model('rotor', 23, 4, [
  P(0, 0.5, (g) => {
    g.fillStyle = 'rgba(40,40,40,0.05)';
    g.beginPath();
    g.arc(0, 0, 21, 0, Math.PI * 2);
    g.fill();
    for (let a = 0; a < 2; a++) {
      g.save();
      g.rotate(a * Math.PI);
      // blade with a motion-blur wedge trailing it
      g.fillStyle = 'rgba(30,30,30,0.1)';
      g.beginPath();
      g.moveTo(0, 0);
      g.arc(0, 0, 21, -0.55, 0);
      g.closePath();
      g.fill();
      box(g, 2, -0.9, 19, 1.8, 0.9, 'rgba(25,25,25,0.55)', null);
      g.restore();
    }
    circ(g, 0, 0, 1.8, '#222', null);
  }),
], false, false);

model('boss', 29, DIRS, [
  P(0, 7, (g) => {
    tread(g, -23, -20, 46, 8.5, 2.2);
    tread(g, -23, 11.5, 46, 8.5, 2.2);
  }),
  P(6, 7.5, (g) => {
    box(g, -21, -20.4, 42, 3.4, 1, RUST[2]);
    box(g, -21, 17, 42, 3.4, 1, RUST[2]);
    for (let x = -19; x < 20; x += 4) {
      circ(g, x, -18.7, 0.45, 'rgba(0,0,0,0.6)', null);
      circ(g, x, 18.7, 0.45, 'rgba(0,0,0,0.6)', null);
    }
  }),
  P(6, 13, (g) => {
    const pts = [-21, -13, 16, -13, 22, -7, 22, 7, 16, 13, -21, 13];
    poly(g, pts, grad(g, -20, -13, 20, 13, [[0, RUST[0]], [1, RUST[2]]]));
    camo(g, () => poly(g, pts, 'rgba(0,0,0,0)', null), ['rgba(30,15,10,0.35)', 'rgba(180,120,80,0.2)'], 41, 10, 6, 22);
    line(g, [16, -13, 16, 13], 'rgba(0,0,0,0.4)');
    line(g, [-12, -13, -12, 13], 'rgba(0,0,0,0.3)');
    for (let i = 0; i < 6; i++) box(g, 18.5, -6 + i * 2, 3, 2, 0, i % 2 ? '#1a1a1a' : '#e8c440', null); // hazard stripes
    for (let x = -20; x < -13; x += 1.2) line(g, [x, -9, x, 9], 'rgba(0,0,0,0.4)');
  }),
  P(13, 15.5, (g) => {
    for (const y of [-16, 10.5]) {
      box(g, -14, y, 12, 5.5, 1, grad(g, 0, y, 0, y + 5.5, [[0, '#6a6e66'], [1, '#33362f']]));
      for (const dx of [0, 3.6, 7.2]) circ(g, -12 + dx + 1.8, y + 2.75, 1.2, '#c33', 'rgba(0,0,0,0.6)');
    }
  }),
  P(13, 19, (g) => {
    const pts = [-12, -9.5, 6, -9.5, 12, -4.5, 12, 4.5, 6, 9.5, -12, 9.5];
    poly(g, pts, grad(g, -12, -9, 12, 9, [[0, '#9a6a4a'], [1, '#4a2e20']]));
    line(g, [-12, 0, 6, 0], 'rgba(0,0,0,0.25)');
  }),
  P(15, 17.5, (g) => {
    for (const y of [-5.4, 2.2]) {
      box(g, 10, y, 21, 3.2, 1, grad(g, 0, y, 0, y + 3.2, [[0, '#4a3426'], [1, '#22160f']]));
      box(g, 28, y - 0.6, 3.6, 4.4, 0.6, '#1a120c');
    }
  }),
  P(19, 21, (g) => {
    circ(g, -5, -4.2, 3, rgrad(g, -5, -4.2, 3, [[0, '#b07a54'], [1, '#5a3828']]));
    circ(g, -5, 4.2, 1.4, '#ff3030', 'rgba(0,0,0,0.6)');
    line(g, [-7.6, -4.2, -2.4, -4.2], 'rgba(0,0,0,0.5)');
  }),
]);

// ================================================================ rocks

// rocks and trees are in every atlas, whatever the era
setModelSet('scenery');
for (const [name, size, h] of [['rock1', 9, 9], ['rock2', 19, 16]] as const) {
  const rng = new Rng(size * 13);
  const chunks = Array.from({ length: size > 10 ? 4 : 2 }, (_, i) => ({
    x: i ? rng.range(-size, size) * 0.45 : 0,
    y: i ? rng.range(-size, size) * 0.45 : 0,
    r: i ? size * rng.range(0.4, 0.6) : size * 0.85,
    h: i ? h * rng.range(0.4, 0.7) : h,
    pts: Array.from({ length: 9 }, () => rng.range(0.72, 1)),
  }));
  // sliced so each chunk tapers toward its top
  model(name, size + 2, 1, chunks.map((c, ci) => P(0, c.h, (g, z) => {
    const k = 1 - 0.45 * Math.pow(Math.min(1, z / c.h), 1.6);
    g.beginPath();
    c.pts.forEach((f, i) => {
      const a = (i / c.pts.length) * Math.PI * 2;
      const px = c.x + Math.cos(a) * c.r * f * k;
      const py = c.y + Math.sin(a) * c.r * f * k;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    });
    g.closePath();
    finish(g, grad(g, c.x - c.r, c.y - c.r, c.x + c.r, c.y + c.r, [[0, '#a19e92'], [1, '#55534b']]), z < c.h - 1 ? null : OUTLINE);
    if (z >= c.h - 1) {
      const mr = new Rng(ci + size);
      for (let m = 0; m < 3; m++) circ(g, c.x + mr.range(-c.r, c.r) * 0.4 * k, c.y + mr.range(-c.r, c.r) * 0.4 * k, c.r * 0.16, 'rgba(90,120,50,0.4)', null);
    }
  }, true)));
}

// ================================================================ trees and bushes (scenery)

// Cartoon foliage in the Kingdom Rush manner: fluffy round canopies built from a few lumps, lit from
// the top left with a dark ink outline. Several variants each so forests don't repeat.
const leafy = (g: Ctx, lumps: { x: number; y: number; r: number }[], dark: string, mid: string, light: string, outline: boolean) => {
  g.beginPath();
  for (const l of lumps) {
    g.moveTo(l.x + l.r, l.y);
    g.arc(l.x, l.y, l.r, 0, Math.PI * 2);
  }
  finish(g, rgrad(g, 0, 0, Math.max(...lumps.map((l) => Math.hypot(l.x, l.y) + l.r)), [[0, light], [0.55, mid], [1, dark]]), outline ? OUTLINE : null, 0.7);
};
for (let v = 0; v < 3; v++) {
  const rng = new Rng(500 + v * 17);
  const size = 7 + v * 1.6;
  const greens = [['#2c5a1c', '#4c8a2c', '#86c24a'], ['#2a5420', '#3f7d2a', '#79b443'], ['#33601e', '#5a9632', '#9ccd56']][v];
  const layers = [0, 1, 2].map((k) => {
    const r = size * (1 - k * 0.22);
    return Array.from({ length: 5 }, (_, i) => {
      const a = (i / 5) * Math.PI * 2 + rng.range(-0.3, 0.3);
      return { x: Math.cos(a) * r * 0.45 - k * 0.6, y: Math.sin(a) * r * 0.45 - k * 0.6, r: r * rng.range(0.5, 0.62) };
    }).concat([{ x: -k * 0.6, y: -k * 0.6, r: r * 0.6 }]);
  });
  model(`tree${v}`, size + 3, 1, [
    P(0, 4, (g) => circ(g, 0, 0, 1.6, '#5a3c22')),
    ...layers.map((lumps, k) => P(4 + k * 3.5, 7 + k * 3.5, (g) => leafy(g, lumps, greens[0], greens[1], greens[2], true))),
  ]);
}
for (let v = 0; v < 2; v++) {
  const size = 6 + v * 1.5;
  // pines: stacked star-shaped tiers narrowing upwards
  model(`pine${v}`, size + 3, 1, [
    P(0, 3, (g) => circ(g, 0, 0, 1.3, '#4e3420')),
    ...[0, 1, 2, 3].map((k) => P(3 + k * 3, 6 + k * 3, (g) => {
      const r = size * (1 - k * 0.22);
      const pts: number[] = [];
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const rr = i % 2 ? r * 0.72 : r;
        pts.push(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      poly(g, pts, rgrad(g, 0, 0, r, [[0, '#5f9a3e'], [0.6, '#2f6a2c'], [1, '#1d4620']]), OUTLINE);
    })),
  ]);
}
for (let v = 0; v < 2; v++) {
  const rng = new Rng(900 + v);
  const lumps = Array.from({ length: 4 }, (_, i) => ({ x: Math.cos(i * 1.7) * 2.6, y: Math.sin(i * 1.7) * 2, r: rng.range(2.2, 3.2) }));
  model(`bush${v}`, 7, 1, [P(0, 3.5, (g) => leafy(g, lumps, '#2e5c1e', v ? '#5c9a34' : '#4f8c30', v ? '#a6d45e' : '#8cc650', true))]);
}
setModelSet('classic');

// ================================================================ towers

const D = TOWER_DECK;

// Tower bases change with the tower's level so upgrades show at a glance: the plating goes from
// concrete (1-3) to steel (4-6), dark armour with gold trim (7-9) and gold (10); rivets, armour skirts,
// corner lamps, vents and antenna masts accumulate; a rank badge (chevrons, then silver, then gold
// stars) sits on the front edge.

const PLATING = [
  { side: ['#a3a59a', '#5f6158'], top: ['#8a8c82', '#696b62'], ring: '#4c4e47', trim: null },
  { side: ['#8e9aaa', '#4a5262'], top: ['#7c8898', '#5a6474'], ring: '#3e4652', trim: null },
  { side: ['#5e6256', '#2c2e28'], top: ['#4e5248', '#383b33'], ring: '#2a2c26', trim: '#d8b450' },
  { side: ['#f0d478', '#8a6a1c'], top: ['#d8b85a', '#8a6a24'], ring: '#5a4410', trim: '#fff0b0' },
];


/** Rank insignia for level lv (0-based) on the front edge of a base. */
function rankBadge(g: Ctx, lv: number) {
  if (lv === 0) return;
  const y = 15.8;
  if (lv <= 3) {
    // 1-3 chevrons
    for (let k = 0; k < lv; k++) {
      const x = (k - (lv - 1) / 2) * 4.2;
      line(g, [x - 1.7, y + 0.9, x, y - 0.8, x + 1.7, y + 0.9], '#ffd84a', 1.1);
    }
  } else if (lv <= 6) {
    for (let k = 0; k < lv - 3; k++) star(g, (k - (lv - 4) / 2) * 4.4, y, 1.8, '#e8ecf0');
  } else if (lv <= 8) {
    for (let k = 0; k < lv - 5; k++) star(g, (k - (lv - 6) / 2) * 4.4, y, 1.9, '#ffd84a');
  } else {
    star(g, 0, y, 2.6, '#ffe070');
  }
}

// One base per level, shared by every tower type: each tower's colour comes from a separate
// corner-marking overlay ('basecorners') drawn on top with a tint.
const LEVELS = Math.max(...TOWERS.map((t) => t.levels.length));
{
  const c = '#ffc84a'; // warm lamp / glow colour
  for (let lv = 0; lv < LEVELS; lv++) {
    const m = PLATING[lv >= 9 ? 3 : lv >= 6 ? 2 : lv >= 3 ? 1 : 0];
    const parts: Part[] = [
      P(0, 2, (g) => box(g, -19.5, -19.5, 39, 39, 3, lv >= 6 ? '#2e3028' : '#4a4b44')),
    ];
    if (lv >= 2) {
      // armour skirt around the foot
      parts.push(P(0, 4, (g) => {
        box(g, -20.5, -20.5, 41, 41, 4, grad(g, -20, -20, 20, 20, [[0, m.side[0]], [1, m.side[1]]]));
        for (let k = -16; k <= 16; k += 8) {
          circ(g, k, -19.6, 0.6, 'rgba(0,0,0,0.45)', null);
          circ(g, -19.6, k, 0.6, 'rgba(0,0,0,0.45)', null);
        }
      }));
    }
    parts.push(P(2, D, (g) => {
      const pts = [-18, -14, -14, -18, 14, -18, 18, -14, 18, 14, 14, 18, -14, 18, -18, 14];
      poly(g, pts, grad(g, -18, -18, 18, 18, [[0, m.side[0]], [1, m.side[1]]]));
      if (m.trim) poly(g, pts, 'rgba(0,0,0,0)', m.trim);
      box(g, -13.5, -13.5, 27, 27, 2, grad(g, -13, -13, 13, 13, [[0, m.top[0]], [1, m.top[1]]]), 'rgba(0,0,0,0.35)');
      if (lv >= 3) {
        // steel plate seams
        line(g, [-13.5, 0, -10.5, 0], 'rgba(0,0,0,0.3)');
        line(g, [10.5, 0, 13.5, 0], 'rgba(0,0,0,0.3)');
        line(g, [0, -13.5, 0, -10.5], 'rgba(0,0,0,0.3)');
      } else {
        for (let k = -12; k <= 12; k += 6) line(g, [k, -13.5, k, 13.5], 'rgba(0,0,0,0.1)');
      }
      if (lv >= 9) circ(g, 0, 0, 12.2, rgrad(g, 0, 0, 12.2, [[0.7, c], [1, 'rgba(0,0,0,0)']]), null); // glowing ring
      circ(g, 0, 0, 10.5, m.ring, 'rgba(0,0,0,0.5)');
      circ(g, 0, 0, 9, lv >= 6 ? '#3a3c34' : '#5a5c54', null);
      if (lv >= 1) {
        // rivets along the top edge
        for (let k = -10; k <= 10; k += 5) {
          circ(g, k, -16, 0.55, 'rgba(20,20,16,0.7)', null);
          circ(g, -16, k, 0.55, 'rgba(20,20,16,0.7)', null);
        }
      }
      for (const [x, y] of [[-11.5, -11.5], [11.5, -11.5], [-11.5, 11.5], [11.5, 11.5]]) circ(g, x, y, 0.8, '#3a3b36', null);
      if (lv >= 5) {
        // side vents
        for (const y of [-6, -3, 0, 3, 6]) {
          box(g, 14.3, y - 0.6, 3, 1.2, 0.4, '#1a1c18', null);
          box(g, y - 0.6, 14.3, 1.2, 3, 0.4, '#1a1c18', null);
        }
      }
      if (lv >= 4) {
        // corner lamps in the tower's colour
        for (const [x, y] of [[-15.2, -15.2], [15.2, -15.2], [-15.2, 15.2], [15.2, 15.2]]) circ(g, x, y, 1.3, rgrad(g, x, y, 1.3, [[0, '#ffffff'], [0.4, c], [1, c]]), 'rgba(0,0,0,0.6)');
      }
      rankBadge(g, lv);
    }));
    if (lv >= 7) {
      // antenna masts at the back corners
      parts.push(P(D, D + 14, (g) => {
        circ(g, -15.5, -9, 0.6, '#2a2a28', null);
        circ(g, -9, -15.5, 0.6, '#2a2a28', null);
      }));
      parts.push(P(D + 14, D + 15, (g) => {
        circ(g, -15.5, -9, 1, '#ff4a3a', null);
        circ(g, -9, -15.5, 1, '#ff4a3a', null);
      }));
    }
    model(`basel${lv}`, 22, 1, parts);
  }
}

// the hazard corners that identify the tower type: white, tinted per tower at draw time
model('basecorners', 22, 1, [
  P(D - 0.5, D, (g) => {
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      poly(g, [sx * 18, sy * 14, sx * 14, sy * 18, sx * 10.5, sy * 18, sx * 18, sy * 10.5], '#ffffff', 'rgba(0,0,0,0.4)');
    }
  }),
], false, false);

model('t_gun', 21, DIRS, [
  P(D, D + 2, (g) => circ(g, 0, 0, 8.5, '#45463f')),
  P(D + 3, D + 6, (g) => {
    for (const y of [-10.2, 7.2]) {
      box(g, -5.5, y, 6.5, 3, 0.6, grad(g, 0, y, 0, y + 3, [[0, '#6e7840'], [1, '#3e4422']]));
      line(g, [-4.5, y + 1.5, 0, y + 1.5], 'rgba(220,200,90,0.6)', 0.6);
    }
  }),
  P(D + 2, D + 7, (g) => {
    poly(g, [-7, -7, 2.5, -8, 6.5, -5, 6.5, 5, 2.5, 8, -7, 7], grad(g, -7, -8, 6, 8, [[0, '#8c8b72'], [1, '#4c4b3c']]));
    line(g, [2.5, -7.8, 2.5, 7.8], 'rgba(0,0,0,0.35)');
  }),
  P(D + 4.3, D + 6, (g) => {
    for (const y of [-3.2, 3.2]) {
      box(g, 5, y - 1.3, 7, 2.6, 0.8, '#3c3c35');
      for (let x = 5.8; x < 11.5; x += 1.2) circ(g, x, y, 0.35, '#121210', null); // cooling jacket holes
      box(g, 11.5, y - 0.7, 8.5, 1.4, 0.4, '#232320');
      box(g, 19.2, y - 0.9, 1.4, 1.8, 0.3, '#151513', null);
    }
  }),
  P(D + 7, D + 8.5, (g) => {
    box(g, -5.2, -2.6, 5, 5.2, 1, '#9a9a80');
    circ(g, -2.7, 0, 1.2, '#d8c25a', 'rgba(0,0,0,0.5)');
  }),
]);

model('t_cannon', 24, DIRS, [
  P(D, D + 2, (g) => circ(g, 0, 0, 10, '#463a30')),
  P(D + 2, D + 9, (g) => {
    box(g, -12.5, -5, 4.5, 10, 2, '#4f3420'); // counterweight
    circ(g, 0, 0, 9.5, rgrad(g, 0, 0, 9.5, [[0, '#c48a5a'], [0.6, '#875a36'], [1, '#4f3420']]));
    g.beginPath();
    g.arc(0, 0, 6.5, -1.2, 1.2);
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 0.6;
    g.stroke();
  }),
  P(D + 4.5, D + 7.5, (g) => {
    box(g, 4, -2.9, 6.5, 5.8, 1, '#4d3c2f'); // recoil sleeve
    box(g, 9, -2, 13, 4, 1.4, grad(g, 0, -2, 0, 2, [[0, '#5a4636'], [1, '#2c221b']]));
    box(g, 21, -3.1, 4, 6.2, 0.6, '#231b15');
    line(g, [22.2, -3, 22.2, 3], 'rgba(255,255,255,0.15)');
    line(g, [23.6, -3, 23.6, 3], 'rgba(255,255,255,0.15)');
  }),
  P(D + 9, D + 10.5, (g) => {
    circ(g, -3, 3.6, 2.6, rgrad(g, -3, 3.6, 2.6, [[0, '#b07a50'], [1, '#5a3a22']]));
    box(g, -2.2, 2.8, 2.4, 1.6, 0.3, '#1a1a1a', null);
  }),
]);

model('t_missile', 22, DIRS, [
  P(D, D + 3, (g) => circ(g, 0, 0, 6.5, '#3d4046')),
  P(D + 3, D + 5, (g) => box(g, -4.5, -9.5, 9, 19, 1.5, '#4a4d54')),
  P(D + 5, D + 14, (g) => {
    box(g, -9.5, -8.5, 17.5, 17, 2, grad(g, -9, -8, 8, 8, [[0, '#e2e6ea'], [1, '#8a9098']]));
    box(g, -9.5, -8.5, 17.5, 1.8, 0.6, '#c33', null);
    box(g, -9.5, 6.7, 17.5, 1.8, 0.6, '#c33', null);
    for (let x = -8; x < -2; x += 1.4) line(g, [x, -6, x, 6], 'rgba(0,0,0,0.18)');
  }),
  ...[D + 6, D + 10.5].map((z) => P(z, z + 2.6, (g) => {
    for (const y of [-3.8, 3.8]) {
      poly(g, [7.5, y - 1.6, 10.5, y - 1.6, 13, y, 10.5, y + 1.6, 7.5, y + 1.6], '#f2f2f2');
      poly(g, [10.5, y - 1.6, 13, y, 10.5, y + 1.6], '#d33', null);
    }
  })),
  P(D + 14, D + 15, (g) => {
    box(g, -6, -4, 8, 8, 1, '#b8bdc4');
    poly(g, [-4, -2, -1, 0, -4, 2], '#e8c440', null);
  }),
]);

model('t_laser', 22, DIRS, [
  P(D, D + 3, (g) => circ(g, 0, 0, 8.5, '#4a3d45')),
  P(D + 3, D + 10, (g) => {
    box(g, -8.5, -6.5, 13, 13, 4.5, grad(g, -8, -6, 5, 6, [[0, '#b8a8b2'], [1, '#4a3d45']]));
    for (let x = -7; x < 3; x += 2) {
      box(g, x, -8, 1.1, 2, 0.3, '#2e262b', null);
      box(g, x, 6, 1.1, 2, 0.3, '#2e262b', null);
    }
  }),
  P(D + 5, D + 8, (g) => {
    box(g, 3, -2.1, 14, 4.2, 2, grad(g, 0, -2, 0, 2, [[0, '#5a4c54'], [1, '#241c21']]));
    for (const x of [6, 9.5, 13]) box(g, x, -2.7, 1.3, 5.4, 0.4, '#7a6a74');
    circ(g, 17, 0, 2.3, rgrad(g, 17, 0, 2.3, [[0, '#ffffff'], [0.4, '#ff6070'], [1, '#801822']]));
  }),
  P(D + 10, D + 12, (g) => {
    circ(g, -2, 0, 3.2, rgrad(g, -2, 0, 3.2, [[0, '#ffe0e4'], [0.5, '#ff4a5a'], [1, '#601018']]));
    g.beginPath();
    g.arc(-2, 0, 4.2, 0, Math.PI * 2);
    g.strokeStyle = 'rgba(255,90,100,0.5)';
    g.lineWidth = 0.6;
    g.stroke();
  }),
]);

model('t_tesla', 16, DIRS, [
  P(D, D + 3, (g) => {
    circ(g, 0, 0, 11, rgrad(g, 0, 0, 11, [[0, '#9aa6b0'], [1, '#3e4850']]));
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      circ(g, Math.cos(a) * 8, Math.sin(a) * 8, 1.6, '#d8dde0');
    }
  }),
  // copper windings with ceramic insulator rings every few units
  P(D + 3, D + 22, (g, z) => {
    const band = Math.floor((z - D - 3) / 1.5);
    if ((z - D - 3) % 6 < 1) circ(g, 0, 0, 7, '#e2e6e8');
    else circ(g, 0, 0, 5.4, band % 2 ? '#d48a38' : '#8a5420', 'rgba(0,0,0,0.3)');
  }, true),
  P(D + 22, D + 24, (g) => circ(g, 0, 0, 3, '#a0aab2')),
  P(D + 24, D + 31, (g) => circ(g, 0, 0, 6.5, rgrad(g, 0, 0, 6.5, [[0, '#ffffff'], [0.45, '#9fe0ff'], [1, '#2a7ab0']]))),
]);

model('t_emp', 18, DIRS, [
  P(D, D + 3, (g) => circ(g, 0, 0, 10.5, rgrad(g, 0, 0, 10.5, [[0, '#5a6a5e'], [1, '#2a3a2e']]))),
  P(D + 3, D + 9, (g) => {
    for (const [x, y] of [[-7, -7], [7, -7], [-7, 7], [7, 7]]) circ(g, x, y, 2.2, rgrad(g, x, y, 2.2, [[0, '#9af0b0'], [1, '#2e7044']]));
  }),
  P(D + 3, D + 8, (g) => circ(g, 0, 0, 2.6, '#5a6a5e')),
  P(D + 8, D + 10, (g) => {
    circ(g, 0, 0, 10, rgrad(g, 0, 0, 10, [[0, '#e6f7ea'], [0.6, '#6a9a78'], [1, '#2c4a36']]));
    for (const r of [7.5, 5]) {
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.strokeStyle = 'rgba(30,60,40,0.5)';
      g.lineWidth = 0.6;
      g.stroke();
    }
  }),
  P(D + 10, D + 13, (g) => circ(g, 0, 0, 2.4, rgrad(g, 0, 0, 2.4, [[0, '#ffffff'], [0.5, '#8cf0a8'], [1, '#2c7a44']]))),
]);


// ================================================================ new enemies

model('ghost', 14, DIRS, [
  P(0, 3.5, (g) => {
    for (const [x, y] of [[-9, -8], [4, -8], [-9, 5], [4, 5]]) wheel(g, x, y, 5, 3);
  }),
  // low, faceted stealth body
  P(2, 6, (g) => {
    const pts = [-11, -5.5, 4, -6, 12, -1.2, 12, 1.2, 4, 6, -11, 5.5];
    poly(g, pts, grad(g, -11, -6, 12, 6, [[0, '#4a4658'], [1, '#1c1a24']]));
    line(g, [-11, 0, 12, 0], 'rgba(160,140,220,0.25)', 0.5);
    line(g, [4, -6, -2, 0, 4, 6], 'rgba(0,0,0,0.4)');
    for (const y of [-4, 4]) line(g, [-10, y, -4, y * 0.6], 'rgba(150,120,255,0.5)', 0.6);
  }),
  P(6, 8, (g) => {
    poly(g, [-5, -3.5, 3, -3, 6, 0, 3, 3, -5, 3.5], grad(g, -5, -3, 6, 3, [[0, '#5a5470'], [1, '#26222f']]));
    poly(g, [0, -2.2, 4.8, 0, 0, 2.2], 'rgba(120,90,220,0.7)', null); // visor
  }),
]);

model('aegis', 18, DIRS, [
  P(0, 5, (g) => {
    tread(g, -13, -10, 26, 5);
    tread(g, -13, 5, 26, 5);
  }),
  P(4, 10, (g) => {
    const pts = [-13, -7.5, 9, -7.5, 13, -4, 13, 4, 9, 7.5, -13, 7.5];
    poly(g, pts, grad(g, -13, -7, 13, 7, [[0, '#7a8aa0'], [1, '#384658']]));
    line(g, [9, -7.5, 9, 7.5], 'rgba(0,0,0,0.35)');
    for (let x = -12; x < -6; x += 1.2) line(g, [x, -5, x, 5], 'rgba(0,0,0,0.3)');
    for (const y of [-6.2, 6.2]) box(g, -4, y - 0.6, 10, 1.2, 0.4, '#5ab4ff', null); // shield conduits
  }),
  // shield emitter: glowing dome on a ring
  P(10, 12, (g) => circ(g, -1, 0, 5.5, '#2e3a4a')),
  P(12, 15, (g) => {
    circ(g, -1, 0, 4.4, rgrad(g, -1, 0, 4.4, [[0, '#ffffff'], [0.4, '#8ad0ff'], [1, '#1e5a9a']]));
    for (let a = 0; a < 6; a++) circ(g, -1 + Math.cos(a) * 5, Math.sin(a) * 5, 0.6, '#9ad8ff', null);
  }),
  P(11, 12.5, (g) => box(g, 5, -0.7, 8, 1.4, 0.4, '#20262e')),
]);

model('medic', 16, DIRS, [
  P(0, 4, (g) => {
    for (const x of [-10, -3, 6]) {
      wheel(g, x, -8.6, 4.2, 2.8);
      wheel(g, x, 5.8, 4.2, 2.8);
    }
  }),
  P(3, 11, (g) => {
    box(g, -12.5, -7, 18, 14, 1.5, grad(g, -12, -7, 5, 7, [[0, '#f2f2ec'], [1, '#a8aaa2']]));
    box(g, 5.5, -6.2, 7, 12.4, 2, grad(g, 5, -6, 12, 6, [[0, '#d8dad2'], [1, '#8a8c84']]));
    box(g, 9, -5, 2.6, 10, 1, '#3a5a6a', null); // windscreen
  }),
  P(11, 12, (g) => {
    box(g, -7.5, -1.6, 9, 3.2, 0.3, '#d22', null); // red cross
    box(g, -4.6, -4.5, 3.2, 9, 0.3, '#d22', null);
    box(g, 4, -2.5, 1.6, 5, 0.6, '#3a8aff', null); // light bar
  }),
]);

model('drone', 9, DIRS, [
  P(0, 1.5, (g) => {
    for (const [x, y] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) {
      line(g, [0, 0, x, y], '#2a2e34', 1.2);
      circ(g, x, y, 3.4, 'rgba(40,40,40,0.15)', null);
      circ(g, x, y, 1, '#333a40', null);
    }
  }),
  P(1, 3.5, (g) => {
    box(g, -3, -2.4, 6, 4.8, 1.5, grad(g, -3, -2, 3, 2, [[0, '#9ad8f0'], [1, '#3a6a80']]));
    circ(g, 2.4, 0, 1, '#ff3a3a', null);
  }),
], false);

// ================================================================ walls

model('barricade', 11, 1, [
  P(0, 2, (g) => box(g, -9.5, -9.5, 19, 19, 1.5, '#55564e')),
  P(2, 9, (g) => {
    poly(g, [-8.5, -8.5, 8.5, -8.5, 8.5, 8.5, -8.5, 8.5], grad(g, -8, -8, 8, 8, [[0, '#b4b5aa'], [1, '#6e7066']]));
    for (let k = -8; k < 8; k += 4) poly(g, [k, -8.5, k + 2, -8.5, k + 4, -6.5, k + 4, -4.5], 'rgba(230,180,40,0.7)', null);
    line(g, [-8.5, 0, 8.5, 0], 'rgba(0,0,0,0.15)');
  }),
], true);

model('gate', 21, 1, [
  P(0, 2, (g) => box(g, -19.5, -19.5, 39, 39, 3, '#4a4b44')),
  P(2, 6, (g) => {
    box(g, -19, -19, 6, 38, 1.5, '#7a7c72'); // posts
    box(g, 13, -19, 6, 38, 1.5, '#7a7c72');
  }),
  P(2, 14, (g) => {
    box(g, -13, -16, 26, 32, 1, grad(g, -13, -16, 13, 16, [[0, '#a09060'], [1, '#5a5030']]));
    line(g, [0, -16, 0, 16], 'rgba(0,0,0,0.5)', 0.8);
    for (let y = -14; y < 16; y += 7) {
      poly(g, [-11, y, -4, y + 3, -11, y + 6], '#e0b040', null);
      poly(g, [11, y, 4, y + 3, 11, y + 6], '#e0b040', null);
    }
  }),
  P(14, 16, (g) => {
    for (const x of [-16, 16]) circ(g, x, -16, 2, rgrad(g, x, -16, 2, [[0, '#fff0a0'], [1, '#c08000']]));
  }),
]);

// ================================================================ new turrets

model('t_flame', 22, DIRS, [
  P(D, D + 2, (g) => circ(g, 0, 0, 8.5, '#3e3530')),
  P(D + 2, D + 8, (g) => {
    for (const y of [-6.5, 2]) box(g, -11, y, 8, 4.5, 2.2, grad(g, 0, y, 0, y + 4.5, [[0, '#e05030'], [1, '#701c10']])); // fuel tanks
    poly(g, [-4, -6, 4, -5, 7, -2.5, 7, 2.5, 4, 5, -4, 6], grad(g, -4, -6, 7, 6, [[0, '#7a6c60'], [1, '#3a3028']]));
  }),
  P(D + 4, D + 6.5, (g) => {
    box(g, 6, -1.5, 13, 3, 1.2, grad(g, 0, -1.5, 0, 1.5, [[0, '#5a5048'], [1, '#2a2420']]));
    box(g, 18, -2, 3, 4, 1, '#1a1612');
    circ(g, 20.5, 1.6, 0.8, '#4ab0ff', null); // pilot light
  }),
  P(D + 8, D + 9.5, (g) => {
    for (const y of [-4.25, 4.25]) circ(g, -7, y, 1, '#c8c0a8', null); // tank caps
    line(g, [-3, -4, 6, -1], '#2a2420', 0.8);
  }),
]);

model('t_napalm', 22, DIRS, [
  P(D, D + 3, (g) => circ(g, 0, 0, 10, '#4a3a30')),
  P(D + 3, D + 8, (g) => {
    circ(g, -1, 0, 9, rgrad(g, -1, 0, 9, [[0, '#a87a5a'], [0.7, '#6a4630'], [1, '#3a2418']]));
    for (const y of [-9.5, 7.5]) box(g, -9, y, 6, 2.5, 1, '#c84020');
  }),
  P(D + 6, D + 12, (g) => {
    // short, fat mortar tube
    box(g, 1, -4, 11, 8, 3, grad(g, 0, -4, 0, 4, [[0, '#6a5444'], [1, '#2c2018']]));
    circ(g, 12, 0, 3.6, '#120c08', 'rgba(0,0,0,0.6)');
    for (const x of [4, 7.5]) box(g, x, -4.4, 1.2, 8.8, 0.3, '#e05030', null);
  }),
]);

model('t_acid', 22, DIRS, [
  P(D, D + 2, (g) => circ(g, 0, 0, 8.5, '#36402a')),
  P(D + 2, D + 9, (g) => {
    circ(g, -3, 0, 8, '#2a3420');
    circ(g, -3, 0, 6.8, rgrad(g, -3, 0, 6.8, [[0, '#e8ff9a'], [0.5, '#a6e22e'], [1, '#3a6a10']]));
  }),
  P(D + 9, D + 10.5, (g) => {
    for (let a = 0; a < 4; a++) circ(g, -3 + Math.cos(a * 1.6) * 3, Math.sin(a * 1.6) * 3, 0.9, 'rgba(255,255,255,0.6)', null); // bubbles
    g.beginPath();
    g.arc(-3, 0, 7.2, 0, Math.PI * 2);
    g.strokeStyle = '#59604a';
    g.lineWidth = 1.2;
    g.stroke();
  }),
  P(D + 4, D + 6.5, (g) => {
    box(g, 4, -1.6, 12, 3.2, 1.2, grad(g, 0, -1.6, 0, 1.6, [[0, '#5a6448'], [1, '#262c1c']]));
    poly(g, [15.5, -2.4, 19, -1, 19, 1, 15.5, 2.4], '#a6e22e');
  }),
]);

model('t_gas', 22, DIRS, [
  P(D, D + 2.5, (g) => circ(g, 0, 0, 9, '#3a4030')),
  P(D + 2.5, D + 9, (g) => {
    box(g, -9, -8, 13, 16, 2, grad(g, -9, -8, 4, 8, [[0, '#8a9a5a'], [1, '#3e4826']]));
    for (const [x, y] of [[-6.5, -5], [-6.5, 0], [-6.5, 5], [-2, -5], [-2, 5]]) circ(g, x, y, 1.8, rgrad(g, x, y, 1.8, [[0, '#e8e040'], [1, '#6a6010']])); // canisters
  }),
  P(D + 5, D + 10, (g) => {
    box(g, 2, -3.4, 13, 6.8, 2.4, grad(g, 0, -3.4, 0, 3.4, [[0, '#6a7448'], [1, '#2a3018']]));
    circ(g, 15, 0, 3, '#141810', 'rgba(0,0,0,0.6)');
  }),
  P(D + 9, D + 10, (g) => {
    // hazard trefoil
    circ(g, -2, 0, 2.6, '#e8d040', null);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      g.beginPath();
      g.moveTo(-2, 0);
      g.arc(-2, 0, 2.4, a, a + 0.9);
      g.closePath();
      g.fillStyle = '#1a1a10';
      g.fill();
    }
  }),
]);

model('t_sniper', 30, DIRS, [
  P(D, D + 3, (g) => {
    for (let a = 0; a < 8; a++) circ(g, Math.cos(a * 0.785) * 7.5, Math.sin(a * 0.785) * 7.5, 3, rgrad(g, Math.cos(a * 0.785) * 7.5, Math.sin(a * 0.785) * 7.5, 3, [[0, '#b0a070'], [1, '#6a5a38']])); // sandbags
  }),
  P(D + 3, D + 7, (g) => {
    poly(g, [-7, -4.5, 3, -4.5, 5, -2, 5, 2, 3, 4.5, -7, 4.5], grad(g, -7, -4, 5, 4, [[0, '#7a8a5a'], [1, '#3a4428']]));
    camo(g, () => poly(g, [-7, -4.5, 3, -4.5, 5, -2, 5, 2, 3, 4.5, -7, 4.5], 'rgba(0,0,0,0)', null), ['rgba(40,45,20,0.4)', 'rgba(140,120,70,0.35)'], 5, 5, 2.5, 6);
  }),
  P(D + 5, D + 6.5, (g) => {
    box(g, 4, -0.8, 24, 1.6, 0.6, '#1e201a'); // long barrel
    box(g, 26, -1.2, 3, 2.4, 0.4, '#121410'); // suppressor
    line(g, [12, -1, 15, -4.5], '#2a2c24', 0.8); // bipod
    line(g, [12, 1, 15, 4.5], '#2a2c24', 0.8);
  }),
  P(D + 7, D + 9, (g) => {
    box(g, -2, -1.4, 10, 2.8, 1.4, '#2a2c26'); // scope
    circ(g, 8, 0, 1.3, rgrad(g, 8, 0, 1.3, [[0, '#cfefff'], [1, '#1a4a6a']]));
  }),
]);

model('t_rail', 30, DIRS, [
  P(D, D + 3, (g) => circ(g, 0, 0, 9, '#2e3846')),
  P(D + 3, D + 9, (g) => {
    box(g, -11, -7, 11, 14, 2, grad(g, -11, -7, 0, 7, [[0, '#5a6a80'], [1, '#22283a']]));
    for (let x = -9; x < -1; x += 2.2) box(g, x, -5.5, 1.2, 11, 0.4, rgrad(g, x + 0.6, 0, 6, [[0, '#cfefff'], [1, '#2a7ac0']]), null); // capacitor cells
  }),
  P(D + 5, D + 8, (g) => {
    for (const y of [-3.6, 2]) box(g, -1, y, 28, 1.6, 0.4, grad(g, 0, y, 0, y + 1.6, [[0, '#a8b4c4'], [1, '#4a5466']])); // rails
    for (let x = 2; x < 25; x += 4) box(g, x, -2, 1.6, 4, 0.4, rgrad(g, x + 0.8, 0, 2, [[0, '#ffffff'], [1, '#3a9aff']]), null); // coils
  }),
  P(D + 8, D + 9.5, (g) => box(g, 0, -4, 6, 8, 1, '#3a4456')),
]);

model('t_gatling', 24, DIRS, [
  P(D, D + 2, (g) => circ(g, 0, 0, 9, '#45463f')),
  P(D + 2, D + 8, (g) => {
    poly(g, [-8, -6.5, 2, -7.5, 5, -4, 5, 4, 2, 7.5, -8, 6.5], grad(g, -8, -7, 5, 7, [[0, '#a09a80'], [1, '#4c4838']]));
    circ(g, -3, -8.5, 3.5, rgrad(g, -3, -8.5, 3.5, [[0, '#7a7a5a'], [1, '#3a3a28']])); // ammo drum
    line(g, [-3, -5, 4, -2], '#c8a040', 1); // belt
  }),
  P(D + 4, D + 7, (g) => {
    // barrel cluster: six barrels around a hub
    box(g, 4, -3, 4, 6, 1, '#3a3a34');
    for (const y of [-2.2, -1.1, 0, 1.1, 2.2]) box(g, 7, y - 0.45, 13, 0.9, 0.3, y === 0 ? '#3a3a34' : '#1e1e1a', null);
    box(g, 11, -3, 1.4, 6, 0.4, '#5a5a50');
    box(g, 18, -3, 1.4, 6, 0.4, '#5a5a50');
  }),
]);

model('t_flak', 24, DIRS, [
  P(D, D + 2, (g) => circ(g, 0, 0, 10, '#3e4450')),
  P(D + 2, D + 8, (g) => {
    poly(g, [-9, -8, 3, -8, 7, -4, 7, 4, 3, 8, -9, 8], grad(g, -9, -8, 7, 8, [[0, '#a0a8b8'], [1, '#4a5060']]));
    line(g, [3, -8, 3, 8], 'rgba(0,0,0,0.3)');
  }),
  P(D + 5, D + 7.5, (g) => {
    for (const y of [-5, -2, 2, 5]) {
      box(g, 5, y - 0.8, 14, 1.6, 0.5, '#24282e');
      box(g, 17.5, y - 1, 2.5, 2, 0.4, '#141619', null);
    }
  }),
  P(D + 8, D + 9.5, (g) => {
    box(g, -6, -3, 5, 6, 1, '#6a7484');
    circ(g, -3.5, 0, 1.2, '#ffd060', 'rgba(0,0,0,0.5)');
  }),
]);

model('t_arty', 32, DIRS, [
  P(D, D + 3, (g) => {
    circ(g, 0, 0, 11, '#4a4436');
    line(g, [-6, -7, -14, -11], '#3a3428', 2); // trail spades
    line(g, [-6, 7, -14, 11], '#3a3428', 2);
  }),
  P(D + 3, D + 10, (g) => {
    poly(g, [-10, -7.5, 4, -8.5, 8, -5, 8, 5, 4, 8.5, -10, 7.5], grad(g, -10, -8, 8, 8, [[0, '#9a8a60'], [1, '#4a3e26']]));
    camo(g, () => poly(g, [-10, -7.5, 4, -8.5, 8, -5, 8, 5, 4, 8.5, -10, 7.5], 'rgba(0,0,0,0)', null), ['rgba(60,50,30,0.4)', 'rgba(150,130,90,0.3)'], 77, 6, 3.5, 9);
    box(g, -12, -3, 4, 6, 1, '#3a3224'); // breech
  }),
  P(D + 6, D + 9.5, (g) => {
    box(g, 6, -2.4, 6, 4.8, 1, '#4a4030'); // recoil cylinders
    box(g, 10, -1.6, 19, 3.2, 1.2, grad(g, 0, -1.6, 0, 1.6, [[0, '#6a5c40'], [1, '#2e2618']]));
    box(g, 27.5, -2.4, 3.5, 4.8, 0.6, '#221c12');
  }),
]);

model('t_cryo', 22, DIRS, [
  P(D, D + 2, (g) => circ(g, 0, 0, 9, '#3a4a54')),
  P(D + 2, D + 9, (g) => {
    circ(g, -2, 0, 8.5, rgrad(g, -2, 0, 8.5, [[0, '#f0fbff'], [0.6, '#9ac8dc'], [1, '#3a5a6a']]));
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      line(g, [-2 + Math.cos(ang) * 5, Math.sin(ang) * 5, -2 + Math.cos(ang) * 8.5, Math.sin(ang) * 8.5], 'rgba(40,80,100,0.5)', 0.6); // cooling fins
    }
  }),
  P(D + 4, D + 7, (g) => {
    box(g, 4, -2, 12, 4, 1.5, grad(g, 0, -2, 0, 2, [[0, '#8ab8cc'], [1, '#2a4a5a']]));
    poly(g, [15, -3, 19, 0, 15, 3], 'rgba(220,250,255,0.95)'); // ice crystal
  }),
  P(D + 9, D + 11, (g) => circ(g, -2, 0, 3, rgrad(g, -2, 0, 3, [[0, '#ffffff'], [1, '#6ad0ff']]))),
]);

model('t_gravity', 20, DIRS, [
  P(D, D + 3, (g) => circ(g, 0, 0, 11, rgrad(g, 0, 0, 11, [[0, '#4a3a6a'], [1, '#1e1630']]))),
  P(D + 3, D + 6, (g) => {
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      box(g, Math.cos(a) * 8 - 1.5, Math.sin(a) * 8 - 1.5, 3, 3, 0.8, '#6a5a8a');
    }
  }),
  P(D + 6, D + 8, (g) => {
    g.beginPath();
    g.ellipse(0, 0, 10, 10, 0, 0, Math.PI * 2);
    g.strokeStyle = '#8a60e0';
    g.lineWidth = 2;
    g.stroke();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      circ(g, Math.cos(a) * 10, Math.sin(a) * 10, 0.9, '#e0c8ff', null);
    }
  }),
  P(D + 7, D + 15, (g) => circ(g, 0, 0, 4.5, rgrad(g, 0, 0, 4.5, [[0, '#000000'], [0.7, '#1a0a30'], [1, '#a070ff']]))),
]);

model('t_repulsor', 20, DIRS, [
  P(D, D + 3, (g) => circ(g, 0, 0, 10.5, '#34505a')),
  P(D + 3, D + 5, (g) => {
    circ(g, 0, 0, 10, rgrad(g, 0, 0, 10, [[0, '#d0f6ff'], [0.5, '#5ac8e8'], [1, '#1a4a5a']]));
    for (const r of [7.5, 5, 2.5]) {
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.strokeStyle = 'rgba(10,40,50,0.55)';
      g.lineWidth = 0.7;
      g.stroke();
    }
  }),
  P(D + 5, D + 9, (g) => {
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.4;
      box(g, Math.cos(a) * 8 - 1, Math.sin(a) * 8 - 1, 2, 2, 0.5, '#9ae8ff');
    }
  }),
]);

model('t_hacker', 20, DIRS, [
  P(D, D + 2, (g) => circ(g, 0, 0, 9, '#2a3430')),
  P(D + 2, D + 7, (g) => {
    box(g, -9, -7, 12, 14, 1.5, grad(g, -9, -7, 3, 7, [[0, '#4a5a52'], [1, '#1c2420']]));
    box(g, -7.5, -5.5, 6, 4.5, 0.6, '#0a1a10', null);
    for (let y = -5; y < -1.5; y += 1) line(g, [-7, y, -7 + 1 + ((y * 7) % 4 + 4) % 4, y], '#3aff8a', 0.4); // code on screen
    for (let k = 0; k < 4; k++) box(g, -7.5 + k * 1.6, 1.5, 1, 4, 0.2, k % 2 ? '#3aff8a' : '#1a6a3a', null);
  }),
  P(D + 4, D + 10, (g) => {
    // directional antenna array
    box(g, 2, -0.8, 13, 1.6, 0.4, '#3a4440');
    for (let x = 4; x < 15; x += 2.6) box(g, x, -4, 0.8, 8, 0.2, '#8a9a90', null);
  }),
  P(D + 10, D + 11, (g) => circ(g, 14, 0, 1.2, rgrad(g, 14, 0, 1.2, [[0, '#ffffff'], [1, '#3aff8a']]))),
]);

model('t_jammer', 20, DIRS, [
  P(D, D + 3, (g) => circ(g, 0, 0, 10, '#3a2a40')),
  P(D + 3, D + 18, (g) => circ(g, 0, 0, 1.4, '#6a5a70')), // mast
  ...[D + 6, D + 11, D + 16].map((z, k) => P(z, z + 1, (g) => {
    for (let a = 0; a < 3; a++) {
      const ang = (a / 3) * Math.PI * 2 + k * 0.5;
      line(g, [0, 0, Math.cos(ang) * (9 - k * 2), Math.sin(ang) * (9 - k * 2)], '#8a7a90', 0.9);
      circ(g, Math.cos(ang) * (9 - k * 2), Math.sin(ang) * (9 - k * 2), 1.4, rgrad(g, Math.cos(ang) * (9 - k * 2), Math.sin(ang) * (9 - k * 2), 1.4, [[0, '#ffd0f4'], [1, '#c02a90']]));
    }
  })),
  P(D + 18, D + 21, (g) => circ(g, 0, 0, 2.6, rgrad(g, 0, 0, 2.6, [[0, '#ffffff'], [0.5, '#ff5ad0'], [1, '#6a1050']]))),
]);

model('t_depot', 21, 1, [
  P(D, D + 7, (g) => {
    for (const [x, y] of [[-12, -12], [-12, 0], [0, -12]]) {
      box(g, x, y, 10.5, 10.5, 1, grad(g, x, y, x + 10, y + 10, [[0, '#a88a5a'], [1, '#5a4428']]));
      line(g, [x, y, x + 10.5, y + 10.5], 'rgba(0,0,0,0.3)');
      line(g, [x + 10.5, y, x, y + 10.5], 'rgba(0,0,0,0.3)');
    }
  }),
  P(D, D + 9, (g) => {
    for (const [x, y] of [[5, 4], [10, 9], [5, 10]]) circ(g, x, y, 2.8, rgrad(g, x, y, 2.8, [[0, '#6a8aa0'], [1, '#2a3a48']])); // barrels
  }),
  P(D + 7, D + 8.5, (g) => {
    circ(g, -6.5, -6.5, 3.4, rgrad(g, -6.5, -6.5, 3.4, [[0, '#fff4b0'], [0.6, '#f0c040'], [1, '#8a6010']]));
    g.fillStyle = '#6a4800';
    g.font = 'bold 5px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('$', -6.5, -6.3);
  }),
]);

model('t_radar', 22, DIRS, [
  P(D, D + 3, (g) => circ(g, 0, 0, 8, '#2e4a46')),
  P(D + 3, D + 12, (g) => circ(g, 0, 0, 1.8, '#5a7a74')), // mast
  P(D + 12, D + 14, (g) => {
    // parabolic dish, long across the heading
    g.beginPath();
    g.ellipse(0, 0, 4, 13, 0, 0, Math.PI * 2);
    finish(g, grad(g, -4, -13, 4, 13, [[0, '#d0f0ea'], [1, '#4a7a72']]));
    line(g, [0, -12, 0, 12], 'rgba(0,0,0,0.25)');
    line(g, [0, 0, 6, 0], '#3a5a54', 0.9);
    circ(g, 6, 0, 1.2, '#40e0c0', null);
  }),
]);

model('t_command', 21, 1, [
  P(D, D + 6, (g) => {
    // sandbagged command bunker
    for (let a = 0; a < 12; a++) circ(g, Math.cos(a * 0.524) * 13, Math.sin(a * 0.524) * 13, 3.4, rgrad(g, Math.cos(a * 0.524) * 13, Math.sin(a * 0.524) * 13, 3.4, [[0, '#b0a070'], [1, '#6a5a38']]));
    box(g, -9, -9, 18, 18, 2, grad(g, -9, -9, 9, 9, [[0, '#6a7a52'], [1, '#33402a']]));
  }),
  P(D + 6, D + 8, (g) => {
    box(g, -6, -6, 12, 12, 1, '#4a5838');
    box(g, -3, -2, 6, 4, 0.5, '#1a2010', null); // map table
    line(g, [-2, -1, 2, 1], '#e85a4a', 0.5);
  }),
  P(D + 6, D + 22, (g) => {
    circ(g, 7, -7, 0.5, '#2a2a2a', null);
    circ(g, -7, 7, 0.4, '#2a2a2a', null);
  }),
  P(D + 18, D + 22, (g) => box(g, 7, -7, 6, 4, 0.2, grad(g, 7, -7, 13, -3, [[0, '#ff6a5a'], [1, '#a02a20']]), null)), // flag
]);

model('t_salvage', 26, DIRS, [
  P(D, D + 4, (g) => {
    for (const [x, y, r] of [[-8, -8, 4], [-9, 6, 3.4], [6, 9, 3.6]]) circ(g, x, y, r, rgrad(g, x, y, r, [[0, '#9a8a7a'], [1, '#4a3e34']])); // scrap heaps
    circ(g, 0, 0, 6, '#5a5040');
  }),
  P(D + 4, D + 10, (g) => box(g, -3, -3, 6, 6, 1, grad(g, -3, -3, 3, 3, [[0, '#e0b040'], [1, '#806010']]))), // crane cab
  P(D + 10, D + 12, (g) => {
    box(g, -6, -1.2, 26, 2.4, 0.5, '#c09030'); // boom
    for (let x = -4; x < 20; x += 3) line(g, [x, -1.2, x + 1.5, 1.2], 'rgba(0,0,0,0.35)');
    circ(g, 20, 0, 3.6, rgrad(g, 20, 0, 3.6, [[0, '#9aa0a8'], [1, '#3a3e44']])); // magnet
  }),
]);

model('t_bunker', 23, DIRS, [
  P(D - 6, D + 2, (g) => {
    for (let a = 0; a < 14; a++) circ(g, Math.cos(a * 0.449) * 14, Math.sin(a * 0.449) * 14, 3.6, rgrad(g, Math.cos(a * 0.449) * 14, Math.sin(a * 0.449) * 14, 3.6, [[0, '#b8a878'], [1, '#6a5a38']]));
  }),
  P(D - 6, D + 4, (g) => {
    g.beginPath();
    g.arc(0, 0, 11, 0, Math.PI * 2);
    finish(g, rgrad(g, 0, 0, 11, [[0, '#8a9070'], [0.7, '#5a6046'], [1, '#33382a']]));
  }),
  P(D + 1, D + 3, (g) => {
    for (const y of [-4, 4]) {
      box(g, 8, y - 1.6, 4, 3.2, 0.5, '#101010', null); // firing slits
      box(g, 10, y - 0.5, 9, 1, 0.3, '#1a1a18', null);
    }
  }),
  P(D + 4, D + 5, (g) => box(g, -4, -3, 6, 6, 1, '#4a503a')),
]);

model('t_orbital', 22, DIRS, [
  P(D, D + 3, (g) => circ(g, 0, 0, 10, '#4a3a44')),
  P(D + 3, D + 8, (g) => circ(g, 0, 0, 3, '#6a5a64')),
  P(D + 8, D + 10, (g) => {
    // big uplink dish facing the sky
    circ(g, 0, 0, 11, rgrad(g, 0, 0, 11, [[0, '#ffffff'], [0.5, '#d0c0c8'], [1, '#6a5a64']]));
    for (const r of [8, 5]) {
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.strokeStyle = 'rgba(80,40,60,0.4)';
      g.lineWidth = 0.6;
      g.stroke();
    }
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      line(g, [Math.cos(a) * 10, Math.sin(a) * 10, 0, 0], '#5a4a54', 0.7);
    }
  }),
  P(D + 10, D + 16, (g) => circ(g, 0, 0, 1.6, rgrad(g, 0, 0, 1.6, [[0, '#ffffff'], [1, '#ff3a6a']]))),
]);

model('t_nuke', 21, 1, [
  P(D - 1, D + 1, (g) => {
    box(g, -17, -17, 34, 34, 2, '#3a3c36');
    for (let k = -17; k < 17; k += 5) poly(g, [k, -17, k + 2.5, -17, k + 5.5, -14, k + 3, -14], '#e8c440', null);
    for (let k = -17; k < 17; k += 5) poly(g, [k, 17, k + 2.5, 17, k + 5.5, 14, k + 3, 14], '#e8c440', null);
  }),
  P(D + 1, D + 3, (g) => {
    // open silo doors with the warhead showing
    box(g, -12, -12, 9, 24, 1, grad(g, -12, -12, -3, 12, [[0, '#7a7c74'], [1, '#3a3c36']]));
    box(g, 3, -12, 9, 24, 1, grad(g, 3, -12, 12, 12, [[0, '#7a7c74'], [1, '#3a3c36']]));
    circ(g, 0, 0, 5, '#0e0e0c', null);
  }),
  P(D + 1, D + 6, (g) => {
    circ(g, 0, 0, 3.6, rgrad(g, 0, 0, 3.6, [[0, '#ffffff'], [0.4, '#e8e8e0'], [1, '#8a8a80']]));
    circ(g, 0, 0, 1.6, '#d33', null);
  }),
]);

model('t_hive', 21, 1, [
  P(D, D + 8, (g) => {
    const hex = (cx: number, cy: number, r: number) => poly(g, Array.from({ length: 12 }, (_, k) => (k % 2 ? cy + Math.sin((k >> 1) * Math.PI / 3) * r : cx + Math.cos((k >> 1) * Math.PI / 3) * r)), grad(g, cx - r, cy - r, cx + r, cy + r, [[0, '#7aa8c0'], [1, '#2a4a5a']]));
    for (const [x, y] of [[0, 0], [-10, -6], [10, -6], [-10, 6], [10, 6], [0, -12], [0, 12]]) hex(x, y, 6);
  }),
  P(D + 8, D + 9, (g) => {
    for (const [x, y] of [[0, 0], [-10, -6], [10, -6], [-10, 6], [10, 6], [0, -12], [0, 12]]) circ(g, x, y, 2.6, x === 0 && y === 0 ? rgrad(g, 0, 0, 2.6, [[0, '#ffffff'], [1, '#50d0ff']]) : '#10181c', null);
  }),
]);

model('t_blackhole', 22, DIRS, [
  P(D, D + 3, (g) => circ(g, 0, 0, 11, rgrad(g, 0, 0, 11, [[0, '#3a2a5a'], [1, '#140c22']]))),
  P(D + 3, D + 14, (g) => {
    // three projector prongs
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      const x = Math.cos(a) * 8;
      const y = Math.sin(a) * 8;
      circ(g, x, y, 2.2, grad(g, x - 2, y - 2, x + 2, y + 2, [[0, '#9a8ab0'], [1, '#3a2e4a']]));
    }
  }),
  P(D + 14, D + 15.5, (g) => {
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      circ(g, Math.cos(a) * 7, Math.sin(a) * 7, 1.4, rgrad(g, Math.cos(a) * 7, Math.sin(a) * 7, 1.4, [[0, '#ffffff'], [1, '#a050ff']]));
    }
  }),
  P(D + 9, D + 16, (g) => {
    circ(g, 0, 0, 4.2, rgrad(g, 0, 0, 4.2, [[0, '#000000'], [0.75, '#0a0414'], [1, '#c080ff']]));
  }),
]);


// ================================================================ hero commander

model('hero', 12, DIRS, [
  P(0, 4, (g) => {
    box(g, -2.6, -4, 4.6, 2.6, 1.2, '#1c1c1a'); // boots
    box(g, -1.2, 1.4, 4.6, 2.6, 1.2, '#1c1c1a');
  }),
  P(4, 11, (g) => {
    poly(g, [-5.5, -4.2, -7, 0, -5.5, 4.2, -3, 3.2, -3, -3.2], '#5a1a14'); // cape
    g.beginPath();
    g.ellipse(0, 0, 4, 5.2, 0, 0, Math.PI * 2);
    finish(g, grad(g, -4, -5, 4, 5, [[0, '#4a4c50'], [1, '#1c1d20']])); // armoured torso
    for (const y of [-4.4, 4.4]) circ(g, 0.5, y, 2, rgrad(g, 0.5, y, 2, [[0, '#f0d070'], [1, '#8a6a10']])); // pauldrons
    line(g, [-2, 0, 3, 0], 'rgba(240,200,90,0.7)', 0.8);
  }),
  P(8, 9.5, (g) => {
    box(g, 1, 1.2, 11, 1.5, 0.5, '#151515', null); // rifle
    box(g, 4, 0.9, 3, 2.1, 0.5, '#2a2a2a', null);
    box(g, 10.5, 1.3, 1.8, 1.2, 0.3, '#ffd84a', null);
  }),
  P(11, 14, (g) => {
    circ(g, 0.4, 0, 3, rgrad(g, 0.4, 0, 3, [[0, '#6a6c70'], [1, '#202124']])); // helmet
    box(g, 1.8, -1.6, 1.6, 3.2, 0.6, 'rgba(255,200,60,0.9)', null); // visor
  }),
]);

/** Highest z of each model (health bars, muzzle and coil heights). */
export const MODEL_TOP: Record<string, number> = {};
for (const name in models) MODEL_TOP[name] = Math.max(...models[name].parts.map((p) => p.z1));

