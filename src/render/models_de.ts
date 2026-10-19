// The German army as the attacker: the vehicles and aircraft that only appear on the other side
// of the line (set 'de'; the tanks and infantry it shares with the German units are in models_ww2.ts).

import { DIRS, P, box, camo, circ, finish, grad, line, model, poly, setModelSet, tread, wheel } from './modelkit';
import { BLACK, DG, DG_CAMO, FG, balkenkreuz, crew, panzer, plane, soldier, tracks } from './models_ww2';

setModelSet('de');

model('de_assault', 8, DIRS, soldier({ tunic: ['#8a8e7c', '#686c5c', '#46493e'], helmet: '#5e6452', hk: 'stahl', gear: 'smg', pack: 'none' }));

/** Kübelwagen: the boxy little field car, open-topped. */
model('de_kubel', 12, DIRS, [
  P(0, 4, (g) => {
    for (const [x, y] of [[-8, -7], [3.6, -7], [-8, 4.3], [3.6, 4.3]]) wheel(g, x, y, 4.6, 2.7);
  }),
  P(2.5, 6, (g) => {
    const pts = [-10, -4.8, 7, -4.8, 10, -3, 10, 3, 7, 4.8, -10, 4.8];
    poly(g, pts, grad(g, -10, -5, 10, 5, [[0, DG[0]], [1, DG[2]]]));
    for (let x = -9; x < -5; x += 0.8) line(g, [x, -3, x, 3], 'rgba(0,0,0,0.3)'); // engine louvres at the rear
    box(g, 7.5, -3.6, 2, 2, 0.4, '#3a3a30');
  }),
  P(6, 7, (g) => {
    box(g, -6, -4, 9, 8, 1, '#4a4636'); // open cockpit
    line(g, [3.6, -4.6, 3.6, 4.6], '#2c2c28', 0.9);
  }),
  ...crew(-1, -2, 0, 5, FG),
  ...crew(-4.5, 2, 0, 5, FG),
]);

/** SdKfz 251 half-track: wheels in front, tracks behind, an open armoured box for the squad. */
model('de_251', 16, DIRS, [
  P(0, 4, (g) => {
    for (const s of [-1, 1]) wheel(g, 8, s * 6 - 1.4, 4.4, 2.8);
    tread(g, -14, -8.4, 17, 3.4, 1.4);
    tread(g, -14, 5, 17, 3.4, 1.4);
  }),
  P(3.5, 9, (g) => {
    const pts = [-14.5, -7, 4, -7, 9, -5.4, 13.5, -2.4, 13.5, 2.4, 9, 5.4, 4, 7, -14.5, 7];
    poly(g, pts, grad(g, -14, -7, 13, 7, [[0, DG[0]], [1, DG[2]]]));
    camo(g, () => poly(g, pts, 'rgba(0,0,0,0)', null), DG_CAMO, 251, 7, 3.5, 12);
    box(g, -12.5, -5.4, 14, 10.8, 0.8, '#3e3828'); // open troop compartment
    balkenkreuz(g, -6, 6.2, 1.5);
  }),
  P(9, 10.5, (g) => {
    box(g, 2, -2.6, 2.5, 5.2, 0.3, '#4a4636'); // gun shield
    box(g, 4, -0.4, 5.5, 0.8, 0.3, BLACK, null); // MG 42
  }),
  ...crew(-2, -2.5, 0, 6, FG),
  ...crew(-6, 2.5, 0, 6, FG),
  ...crew(-10, -2.5, 0, 6, FG),
]);

model('de_pz3', 16, DIRS, panzer({ len: 23, wid: 17, tr: 5.5, gun: 10, seed: 3 }));
model('de_kingtiger', 26, DIRS, panzer({ len: 36, wid: 26, tr: 8.5, gun: 23, slope: true, seed: 22 }));

/** The Ju 87 Stuka in flight: inverted gull wings, fixed spatted gear, a bomb under the belly. */
model('de_ju87', 22, DIRS, [
  ...plane({ span: 28, len: 20, body: ['#6a7458', '#4e5840', '#3a422e'], seats: 2, german: true, bomb: true }),
  P(0.5, 2, (g) => {
    for (const s of [-1, 1]) {
      g.beginPath();
      g.ellipse(3, s * 6.5, 2, 1.1, 0, 0, Math.PI * 2);
      finish(g, '#4e5840');
    }
  }),
  P(5.6, 6.2, (g) => box(g, 8.5, -2.6, 1.8, 5.2, 0.4, '#ffd84a', null)), // yellow nose band
], false);
model('de_bf109', 17, DIRS, plane({ span: 22, len: 17, body: ['#8a9496', '#626c70', '#3e4648'], seats: 1, german: true }), false);

/** Panzerwerfer 42 on a Maultier half-track: ten rocket tubes in two rows on the roof. */
model('de_pzwerfer', 15, DIRS, [
  P(0, 4, (g) => {
    for (const s of [-1, 1]) wheel(g, 8, s * 6 - 1.4, 4.4, 2.8);
    tracks(18, 15, 3.4, 4)(g);
  }),
  P(3.5, 9, (g) => {
    poly(g, [-12, -6.4, 4, -6.4, 9, -5, 12.5, -2.6, 12.5, 2.6, 9, 5, 4, 6.4, -12, 6.4], grad(g, -12, -6, 12, 6, [[0, DG[0]], [1, DG[2]]]));
    balkenkreuz(g, -6, 5.6, 1.4);
  }),
  P(9, 12, (g) => {
    for (let k = 0; k < 10; k++) {
      const x = -10 + (k % 5) * 2.4;
      const y = k < 5 ? -2 : 2;
      circ(g, x, y, 1.15, grad(g, x - 1, y - 1, x + 1, y + 1, [[0, '#7a6a44'], [1, '#3a3020']]));
      circ(g, x, y, 0.5, '#141410', null);
    }
  }),
]);


