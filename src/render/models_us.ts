// The Western Allies: US Army emplacements and units as the defender, and the vehicles and
// aircraft of its offensive (set 'us').

import { DIRS, P, box, circ, finish, grad, line, model, poly, rgrad, setModelSet, star, wheel, type Ctx, type Part } from './modelkit';
import {
  WD, airfield, atGun, barracks, crew, depot, flamerTeam, heavyAA, howitzer, hq, compound, makeBases, mgNest, mortarPit, motorpool, observer,
  officer, pillbox, plane, sniperPit, soldier, tracks, workshop, type Style,
} from './models_ww2';
import { dugIn } from './models_su';

setModelSet('us');

const OD = ['#76744c', '#5a5836', '#3c3a24']; // olive drab paint
const WOOL = ['#8a8460', '#6a6446', '#46422e']; // olive drab uniform
const STAR = '#f0f0e8';

/** The Allied white star, in a ring on aircraft and late-war vehicles. */
export function whiteStar(g: Ctx, x: number, y: number, r: number): void {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.strokeStyle = STAR;
  g.lineWidth = r * 0.18;
  g.stroke();
  star(g, x, y, r * 0.82, STAR, null);
}

export const US: Style = {
  uni: WOOL, helm: '#5a5a3a', hk: 'm1', paint: OD, camo: ['rgba(40,40,20,0.35)', 'rgba(110,100,60,0.25)'],
  mark: whiteStar, plane: ['#c8ccd0', '#9aa0a6', '#6a7076'],
  flag: (g, x, y) => {
    for (let k = 0; k < 6; k++) box(g, x, y + k, 9, 1, 0, k % 2 ? '#f0ece4' : '#b8282a', null);
    box(g, x, y, 4, 3.2, 0, '#2a3a7a', 'rgba(0,0,0,0.5)');
    for (let k = 0; k < 4; k++) circ(g, x + 0.8 + (k % 2) * 2.2, y + 0.8 + Math.floor(k / 2) * 1.5, 0.3, STAR, null);
  },
};
const S = US;

// ---------------------------------------------------------------- emplacements

model('us_w_mg', 18, DIRS, mgNest(S, 'm1919'));

/** M45 Quadmount: four .50 calibre Brownings in a power turret on a trailer. */
model('us_w_quad', 20, DIRS, [
  P(WD, WD + 2, (g) => {
    box(g, -12, -8, 20, 16, 1.2, grad(g, -12, -8, 8, 8, [[0, OD[1]], [1, OD[2]]])); // trailer bed
    for (const s of [-1, 1]) box(g, -4, s * 9 - 1.4, 6, 2.8, 1.2, '#1b1b19');
  }),
  P(WD + 2, WD + 7, (g) => {
    circ(g, 0, 0, 5.5, grad(g, -5, -5, 5, 5, [[0, OD[0]], [1, OD[2]]]));
    poly(g, [-2, -6, 3, -6, 4, -3, 4, 3, 3, 6, -2, 6], 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.4)'); // armour plates round the gunner
  }),
  P(WD + 5.5, WD + 7, (g) => {
    for (const y of [-4.6, -2.6, 2.6, 4.6]) box(g, 2, y - 0.5, 13, 1, 0.4, '#1c1c1a', null);
    box(g, -1, -5.5, 4, 11, 0.6, '#3a3a2c'); // ammo chests
  }),
  ...crew(-3, 0, 0, WD + 2, S.uni, S.helm, S.hk),
]);

model('us_w_bazooka', 17, DIRS, [
  ...crew(-1, -2.5, 0, WD, S.uni, S.helm, S.hk),
  ...crew(-3.5, 4, 0.5, WD - 1, S.uni, S.helm, S.hk),
  P(WD + 5, WD + 6.5, (g) => {
    box(g, -8, -3.4, 17, 1.8, 0.9, grad(g, 0, -3.4, 0, -1.6, [[0, '#7a7a52'], [1, '#3e3e28']])); // M9 bazooka
    box(g, 8.5, -3.8, 1.6, 2.6, 0.4, '#3a3a2a'); // flared muzzle
    circ(g, -8, -2.5, 0.9, '#1a1a18', null);
  }),
  P(WD, WD + 2, (g) => box(g, -8, 3, 5, 2, 0.5, '#4a4a30')), // rocket bag
]);
model('us_w_sniper', 14, DIRS, sniperPit(S));
model('us_w_flamer', 14, DIRS, flamerTeam(S));
model('us_w_57', 23, DIRS, atGun(S, { barrel: 20, shieldW: 8, brake: false, wheelY: 8.5 }));
model('us_w_90', 27, DIRS, heavyAA(S));

/** M4 Sherman family: tall hull with a sloped glacis, sponsons, a rounded cast turret, white stars. */
export function sherman(o: { len: number; wid: number; tr: number; gun: number; brake?: boolean; heavy?: boolean; seed: number; paint?: string[] }): Part[] {
  const L = o.len / 2;
  const W = o.wid / 2;
  const pt = o.paint ?? OD;
  return [
    P(0, 5, tracks(o.len, o.wid, o.wid * 0.24, 5)),
    P(4.5, 10, (g) => {
      const pts = [-L, -W + 0.6, L - 7, -W + 0.6, L, -W + 3, L, W - 3, L - 7, W - 0.6, -L, W - 0.6];
      poly(g, pts, grad(g, -L, -W, L, W, [[0, pt[0]], [1, pt[2]]]));
      poly(g, [L - 7, -W + 0.6, L, -W + 3, L, W - 3, L - 7, W - 0.6], o.heavy ? 'rgba(255,255,230,0.18)' : 'rgba(255,255,230,0.1)', 'rgba(0,0,0,0.3)'); // glacis
      box(g, -L + 1, -3.4, 6, 6.8, 0.6, '#3e3c26'); // engine deck
      for (let x = -L + 1.5; x < -L + 6.5; x += 1) line(g, [x, -3, x, 3], 'rgba(0,0,0,0.35)');
      whiteStar(g, -L + 7, W - 2.2, 1.6);
      box(g, L - 3, -2.5, 1.8, 1.4, 0.4, '#262618'); // bow MG
    }),
    P(10, 15, (g) => {
      g.beginPath();
      g.ellipse(-0.5, 0, o.tr, o.tr * 0.9, 0, 0, Math.PI * 2);
      finish(g, rgrad(g, -1.5, -1, o.tr * 1.1, [[0, pt[0]], [0.7, pt[1]], [1, pt[2]]]));
      circ(g, -o.tr * 0.45, o.tr * 0.35, o.tr * 0.28, '#3a3a24'); // commander's hatch
      if (o.heavy) box(g, o.tr - 2, -3, 2.5, 6, 0.8, pt[1]); // thick mantlet
    }),
    P(11, 13, (g) => {
      box(g, o.tr - 1.5, -2, 2.5, 4, 0.8, '#5a5838'); // mantlet
      box(g, o.tr, -0.85, o.gun, 1.7, 0.6, grad(g, 0, -0.85, 0, 0.85, [[0, pt[1]], [1, '#2e2e1c']]));
      if (o.brake) box(g, o.tr + o.gun - 2, -1.3, 2.4, 2.6, 0.5, '#34341f');
    }),
  ];
}
model('us_w_sherman', 22, DIRS, dugIn(sherman({ len: 26, wid: 19, tr: 6.5, gun: 15, brake: true, seed: 5 }), 5));
model('us_w_bunker', 21, DIRS, pillbox(S));
model('us_w_mortar', 15, DIRS, mortarPit(S));
model('us_w_105', 26, DIRS, howitzer(S));

/** The T34 Calliope: sixty rocket tubes in a frame over a Sherman's turret. */
export const calliope: Part[] = [
  ...sherman({ len: 26, wid: 19, tr: 6, gun: 8, seed: 34 }),
  P(15, 21, (g) => {
    box(g, -9, -8.5, 18, 17, 0.8, 'rgba(0,0,0,0)', '#2a2a1c');
    for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) {
      const x = -7.5 + c * 3;
      const y = -7 + r * 2.8;
      circ(g, x, y, 1.15, grad(g, x - 1, y - 1, x + 1, y + 1, [[0, '#7a7a52'], [1, '#34341f']]));
      circ(g, x, y, 0.5, '#141410', null);
    }
  }),
];
model('us_calliope', 18, DIRS, calliope);
model('us_w_depot', 21, 1, depot(S));
model('us_w_observer', 16, DIRS, observer(S));
model('us_w_hq', 21, 1, hq(S));
model('us_w_hq_base', 54, 1, compound(S));
model('us_w_workshop', 21, 1, workshop(S));
model('us_w_barracks', 21, 1, barracks(S));
model('us_w_motorpool', 22, 1, motorpool(S));
model('us_w_airfield', 23, 1, airfield(S));

const P47 = { span: 30, len: 21, body: ['#6e6e46', '#56563a', '#3a3a26'], seats: 1, mark: whiteStar, spinner: '#e8e8e0' };
model('us_w_p47field', 23, 1, [
  P(WD - 1, WD, (g) => box(g, -19, -19, 38, 38, 2, '#7a7460')), // pierced-steel-plank strip
  P(WD, WD + 0.4, (g) => {
    for (let k = -18; k < 18; k += 3) line(g, [-18, k, 18, k], 'rgba(40,40,30,0.25)');
  }),
  ...plane(P47).map((p) => ({ ...p, z0: p.z0 + WD, z1: p.z1 + WD })),
  P(WD, WD + 2, (g) => {
    for (let k = 0; k < 4; k++) box(g, -14 + k * 3, 12, 2.2, 5, 0.8, '#5a5a44'); // HVAR rockets
  }),
  ...crew(10, 12, -0.5, WD, S.uni, S.helm, S.hk),
]);

/** Little Boy on its loading trailer in the pit under a B-29's open bomb bay. */
model('us_w_littleboy', 25, 1, [
  P(WD - 1, WD, (g) => box(g, -22, -22, 44, 44, 2, '#8a8678')), // concrete loading pit apron
  P(WD, WD + 3, (g) => {
    box(g, -6, -4, 12, 8, 0.6, '#3a3a30'); // trailer
    for (const [x, y] of [[-5, -4.6], [3, -4.6], [-5, 3.4], [3, 3.4]]) wheel(g, x, y, 2.6, 1.6);
  }),
  P(WD + 3, WD + 8, (g) => {
    // the bomb: a long dark-green cylinder with a box tail
    g.beginPath();
    g.ellipse(1, 0, 8.5, 3.6, 0, 0, Math.PI * 2);
    finish(g, grad(g, 0, -3.6, 0, 3.6, [[0, '#5a6a4a'], [0.5, '#3e4c34'], [1, '#26301e']]));
    box(g, -10.5, -3.4, 3.4, 6.8, 0.4, '#3a4430');
    line(g, [-3, -3.4, -3, 3.4], 'rgba(0,0,0,0.4)', 0.5);
  }),
  P(WD + 13, WD + 15, (g) => {
    // the B-29's fuselage and wing roots overhead, silver
    box(g, -22, -4, 44, 8, 3.5, grad(g, 0, -4, 0, 4, [[0, '#dce0e4'], [0.5, '#a8aeb4'], [1, '#70767c']]));
    box(g, -6, -22, 9, 44, 2, grad(g, -6, 0, 3, 0, [[0, '#c8ccd0'], [1, '#8a9096']]));
    box(g, -4, -3, 9, 6, 0.6, '#20242a'); // open bomb bay
    whiteStar(g, -2, -15, 2.4);
    whiteStar(g, -2, 15, 2.4);
  }),
  ...crew(9, 7, Math.PI, WD, S.uni, S.helm, S.hk),
  ...crew(-12, -8, 0.3, WD, S.uni, S.helm, S.hk),
]);

/** US ranks: chevrons for the soldiers, then bars, the oak leaf, the eagle and the general's star. */
function usRank(g: Ctx, lv: number) {
  if (lv === 0) return;
  const y = 17.5;
  if (lv <= 3) {
    for (let k = 0; k < lv; k++) line(g, [-2.2, y + 0.6 - k * 1.3, 0, y - 1 - k * 1.3, 2.2, y + 0.6 - k * 1.3], '#e0c060', 0.9); // chevrons point up
  } else if (lv <= 6) {
    const n = lv - 3;
    for (let k = 0; k < Math.min(n, 2); k++) box(g, -1.6 + k * 2.2 - (n > 1 ? 1.1 : 0), y - 1.6, 1.2, 3.2, 0.2, lv === 4 ? '#d8b450' : '#e8ecf0', 'rgba(0,0,0,0.5)'); // bars
    if (n === 3) circ(g, 0, y, 1.6, '#d8b450', 'rgba(0,0,0,0.5)'); // major's oak leaf
  } else if (lv <= 8) {
    poly(g, [-3, y, 0, y - 2, 3, y, 0, y + 1.5], '#e8ecf0', 'rgba(0,0,0,0.5)'); // eagle
  } else {
    star(g, 0, y, 2.4, '#e8ecf0', 'rgba(0,0,0,0.5)');
  }
}
makeBases('usbase', usRank);

model('us_officer', 12, DIRS, officer({ coat: ['#8a7a5a', '#6a5c42', '#463c2a'], tails: '#4a4030', cap: ['#8a8060', '#4a4430'], badge: '#d8b450', weapon: 'carbine' }));

// ---------------------------------------------------------------- soldiers and vehicles

model('us_rifle', 8, DIRS, soldier({ tunic: WOOL, helmet: '#5a5a3a', hk: 'm1', gear: 'rifle', pack: 'roll' }));
model('us_ranger', 8, DIRS, soldier({ tunic: ['#7a7a56', '#5c5c3e', '#3e3e28'], helmet: '#5a5a3a', hk: 'm1', gear: 'smg', pack: 'none' }));
model('us_mg', 8, DIRS, soldier({ tunic: WOOL, helmet: '#5a5a3a', hk: 'm1', gear: 'mg', pack: 'none' }));
model('us_bazooka', 8, DIRS, soldier({ tunic: WOOL, helmet: '#5a5a3a', hk: 'm1', gear: 'bazooka', pack: 'none' }));
model('us_sniper', 8, DIRS, soldier({ tunic: ['#7a7a52', '#5a5a3a', '#3c3c26'], helmet: '#4e4e30', hk: 'm1', gear: 'scoped', pack: 'none' }));
model('us_engineer', 8, DIRS, soldier({ tunic: WOOL, helmet: '#5a5a3a', hk: 'm1', gear: 'rifle', pack: 'satchel' }));
model('us_medic', 8, DIRS, soldier({ tunic: WOOL, helmet: '#e8e4d8', hk: 'm1', gear: 'none', pack: 'medic' }));

model('us_jeep', 12, DIRS, [
  P(0, 4, (g) => {
    for (const [x, y] of [[-7.5, -6.8], [4, -6.8], [-7.5, 4.2], [4, 4.2]]) wheel(g, x, y, 4.4, 2.6);
  }),
  P(2.5, 5.5, (g) => {
    const pts = [-9.5, -4.6, 5, -4.6, 9.5, -3.4, 9.5, 3.4, 5, 4.6, -9.5, 4.6];
    poly(g, pts, grad(g, -9.5, -4.6, 9.5, 4.6, [[0, OD[0]], [1, OD[2]]]));
    for (let x = 7; x < 9.2; x += 0.7) line(g, [x, -2.6, x, 2.6], 'rgba(0,0,0,0.3)'); // grille slots
    whiteStar(g, 6.5, 0, 1.6);
  }),
  P(5.5, 6.5, (g) => {
    box(g, -6.5, -3.8, 8, 7.6, 1, '#3a3a26');
    line(g, [2.8, -4.4, 2.8, 4.4], '#2c2c20', 0.9);
  }),
  ...crew(-1, -2, 0, 5, WOOL, '#5a5a3a', 'm1'),
  ...crew(-4.5, 2, 0, 5, WOOL, '#5a5a3a', 'm1'),
]);

/** M8 Greyhound: six wheels, a low hull and an open-topped turret with a 37 mm. */
model('us_m8', 15, DIRS, [
  P(0, 4, (g) => {
    for (const x of [-9, -2.5, 6]) for (const s of [-1, 1]) wheel(g, x, s * 7 - 1.4, 4.4, 2.8);
  }),
  P(3.5, 8, (g) => {
    const pts = [-12, -6, 6, -6, 12, -3, 12, 3, 6, 6, -12, 6];
    poly(g, pts, grad(g, -12, -6, 12, 6, [[0, OD[0]], [1, OD[2]]]));
    whiteStar(g, -5, 0, 2);
  }),
  P(8, 11, (g) => {
    circ(g, 0, 0, 4.6, grad(g, -4, -4, 4, 4, [[0, OD[0]], [1, OD[2]]]));
    circ(g, -0.6, 0, 3, '#24241a', null); // open top
    box(g, 4, -0.6, 7, 1.2, 0.4, '#2a2a1c', null);
  }),
]);

/** M5 Stuart: small and fast, a 37 mm gun in a little turret. */
model('us_stuart', 15, DIRS, [
  P(0, 4.5, tracks(21, 16, 3.8, 4)),
  P(4, 9, (g) => {
    const pts = [-10.5, -7.2, 5, -7.2, 10.5, -4.4, 10.5, 4.4, 5, 7.2, -10.5, 7.2];
    poly(g, pts, grad(g, -10, -7, 10, 7, [[0, OD[0]], [1, OD[2]]]));
    whiteStar(g, -4, 5.4, 1.4);
  }),
  P(9, 12.5, (g) => {
    box(g, -4, -4, 8, 8, 1.6, grad(g, -4, -4, 4, 4, [[0, OD[0]], [1, OD[2]]]));
    box(g, 4, -0.6, 7, 1.2, 0.4, '#2a2a1c', null);
  }),
]);
model('us_sherman', 19, DIRS, sherman({ len: 26, wid: 19, tr: 6, gun: 11, seed: 6 }));
model('us_easy8', 20, DIRS, sherman({ len: 27, wid: 20, tr: 6.5, gun: 16, brake: true, seed: 7 }));
model('us_jumbo', 20, DIRS, sherman({ len: 27, wid: 21, tr: 7, gun: 12, heavy: true, seed: 8 }));

/** M26 Pershing: a long, low hull and the big 90 mm gun. */
model('us_pershing', 24, DIRS, [
  P(0, 5, tracks(32, 23, 5.6, 6)),
  P(4.5, 9, (g) => {
    const pts = [-16, -10.5, 9, -10.5, 16, -6, 16, 6, 9, 10.5, -16, 10.5];
    poly(g, pts, grad(g, -16, -10, 16, 10, [[0, OD[0]], [1, OD[2]]]));
    poly(g, [9, -10.5, 16, -6, 16, 6, 9, 10.5], 'rgba(255,255,230,0.12)', 'rgba(0,0,0,0.3)');
    box(g, -15, -4, 7, 8, 0.6, '#3e3c26');
    whiteStar(g, -6, 8.5, 1.8);
  }),
  P(9, 14.5, (g) => {
    poly(g, [-9, -7, 3, -7.5, 7, -4, 7, 4, 3, 7.5, -9, 7], rgrad(g, -2, -1, 9, [[0, OD[0]], [0.7, OD[1]], [1, OD[2]]]));
    circ(g, -5, 3.5, 2, '#3a3a24');
  }),
  P(10.5, 12.5, (g) => {
    box(g, 6, -2.4, 3, 4.8, 0.8, '#5a5838');
    box(g, 8, -1, 22, 2, 0.6, grad(g, 0, -1, 0, 1, [[0, OD[1]], [1, '#2e2e1c']]));
    box(g, 28, -1.6, 3, 3.2, 0.5, '#34341f'); // double-baffle muzzle brake
  }),
]);

model('us_p47', 21, DIRS, plane({ ...P47, bomb: true }), false);
model('us_p51', 18, DIRS, plane({ span: 24, len: 18, body: ['#c8ccd0', '#9aa0a6', '#6a7076'], seats: 1, mark: whiteStar, spinner: '#e8d040' }), false);


