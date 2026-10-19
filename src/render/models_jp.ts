// Japan: Imperial Japanese Army emplacements and units as the defender, and the vehicles and
// aircraft of its attacks (set 'jp').

import { Rng } from '../game/rng';
import { DIRS, P, box, camo, circ, finish, grad, line, model, poly, rgrad, setModelSet, star, wheel, type Ctx, type Part } from './modelkit';
import {
  WD, airfield, atGun, barracks, crew, depot, flamerTeam, heavyAA, howitzer, hq, compound, lightAA, makeBases, mgNest, mortarPit, motorpool,
  observer, officer, plane, prone, sniperPit, soldier, tracks, workshop, type Style,
} from './models_ww2';
import { dugIn } from './models_su';

setModelSet('jp');

const KHAKI_JP = ['#a89a5a', '#86783e', '#5a4e28'];
const IJA = ['#8a7e52', '#6a5e38', '#463c22']; // khaki-brown vehicle paint
const IJA_CAMO = ['rgba(70,90,40,0.55)', 'rgba(120,80,40,0.45)'];
const RED = '#c42a1e';

/** The hinomaru: a red disc, ringed in white on aircraft. */
export function hinomaru(g: Ctx, x: number, y: number, r: number): void {
  circ(g, x, y, r, '#f0ece0', null);
  circ(g, x, y, r * 0.78, RED, null);
}

export const JP: Style = {
  uni: KHAKI_JP, helm: '#6a6640', hk: 'jp', paint: IJA, camo: IJA_CAMO,
  mark: hinomaru, plane: ['#c8c8b0', '#a0a088', '#6a6a58'],
  flag: (g, x, y) => {
    // the Rising Sun war flag: a red disc with sixteen rays
    box(g, x, y, 9, 6, 0.2, '#f0ece0', 'rgba(0,0,0,0.5)');
    for (let k = 0; k < 16; k += 2) {
      const a0 = (k / 16) * Math.PI * 2;
      const a1 = ((k + 1) / 16) * Math.PI * 2;
      poly(g, [x + 3.6, y + 3, x + 3.6 + Math.cos(a0) * 9, y + 3 + Math.sin(a0) * 9, x + 3.6 + Math.cos(a1) * 9, y + 3 + Math.sin(a1) * 9], RED, null);
    }
    box(g, x, y, 9, 6, 0.2, 'rgba(0,0,0,0)', 'rgba(0,0,0,0.5)');
    circ(g, x + 3.6, y + 3, 1.6, RED, null);
  },
};
const S = JP;

// ---------------------------------------------------------------- emplacements

model('jp_w_mg', 18, DIRS, mgNest(S, 'type92'));
model('jp_w_aa', 20, DIRS, lightAA(S));
model('jp_w_at', 17, DIRS, [
  P(WD, WD + 1.5, (g) => box(g, -8, 4, 5, 2, 0.5, '#4a4630')),
  ...prone(-2, -1, WD, S.uni, S.helm, S.hk),
  P(WD + 2.2, WD + 3.4, (g) => {
    // the Type 97 20 mm anti-tank rifle: heavy, with its box magazine on top
    line(g, [7, -1, 6, -3.5], '#2a2a26', 0.6);
    line(g, [7, -1, 6, 1.5], '#2a2a26', 0.6);
    box(g, -3, -1.7, 16, 1.4, 0.5, '#3a3a34', null);
    box(g, 1, -3.2, 2.6, 1.6, 0.3, '#2a2a26', null);
    box(g, 12.5, -2.1, 2, 2.2, 0.3, '#1a1a18', null);
  }),
  ...crew(-5, 5, 0.3, WD - 1, S.uni, S.helm, S.hk),
]);
model('jp_w_sniper', 14, DIRS, sniperPit(S));
model('jp_w_flamer', 14, DIRS, flamerTeam(S));
model('jp_w_47', 22, DIRS, atGun(S, { barrel: 16, shieldW: 7, brake: false, wheelY: 7.5 }));
model('jp_w_88', 27, DIRS, heavyAA(S));

/** Japanese tanks: riveted box hulls, the engine with its exhausts at the back, the turret set off-centre. */
export function nipponTank(o: { len: number; wid: number; tr: number; gun: number; kind: 'hago' | 'chiha' | 'chihe' | 'chinu'; seed: number }): Part[] {
  const L = o.len / 2;
  const W = o.wid / 2;
  return [
    P(0, 4.5, tracks(o.len, o.wid, o.wid * 0.25, o.kind === 'hago' ? 4 : 6)),
    P(4, 9, (g) => {
      const front = o.kind === 'chihe' || o.kind === 'chinu' ? 4 : 2;
      const pts = [-L, -W + 0.8, L - front, -W + 0.8, L, -W + 2.5, L, W - 2.5, L - front, W - 0.8, -L, W - 0.8];
      poly(g, pts, grad(g, -L, -W, L, W, [[0, IJA[0]], [1, IJA[2]]]));
      camo(g, () => poly(g, pts, 'rgba(0,0,0,0)', null), IJA_CAMO, o.seed, 7, 4, L);
      const rng = new Rng(o.seed);
      for (let k = 0; k < 14; k++) circ(g, rng.range(-L + 1, L - 1), rng.range(-W + 1.5, W - 1.5), 0.25, 'rgba(30,25,15,0.5)', null); // rivets
      box(g, -L + 0.5, -2.8, 4.5, 5.6, 0.5, '#3e3626'); // engine deck
      line(g, [-L + 1, W - 1.4, -L + 6, W - 1.4], '#2a2418', 1.1); // exhaust pipe
      box(g, L - 3, 1.5, 1.6, 1.4, 0.4, '#262014'); // bow MG
    }),
    P(9, o.kind === 'hago' ? 12 : 13.5, (g) => {
      const tx = o.kind === 'hago' ? -1.5 : 0;
      const ty = o.kind === 'hago' ? -1.2 : 0;
      g.beginPath();
      if (o.kind === 'chiha' || o.kind === 'hago') g.ellipse(tx, ty, o.tr, o.tr * 0.9, 0, 0, Math.PI * 2);
      else g.rect(tx - o.tr, ty - o.tr * 0.85, o.tr * 2, o.tr * 1.7);
      finish(g, rgrad(g, tx - 1, ty - 1, o.tr * 1.2, [[0, IJA[0]], [0.7, IJA[1]], [1, IJA[2]]]));
      if (o.kind === 'chiha') {
        // the horseshoe radio antenna round the turret top
        g.beginPath();
        g.arc(tx - 0.5, ty, o.tr + 1, Math.PI * 0.35, Math.PI * 1.65);
        g.strokeStyle = '#2a2418';
        g.lineWidth = 0.5;
        g.stroke();
      }
      box(g, tx - o.tr * 0.4, ty + o.tr * 0.25, 2.4, 1.4, 0.3, '#f0ece0', null); // white band
      star(g, tx - o.tr * 0.4 + 1.2, ty + o.tr * 0.25 + 0.7, 0.55, '#e8c840', null);
    }),
    P(10, 12, (g) => {
      const tx = o.kind === 'hago' ? -1.5 : 0;
      const ty = o.kind === 'hago' ? -1.2 : 0;
      box(g, tx + o.tr - 1, ty - 0.8, o.gun, 1.6, 0.6, grad(g, 0, ty - 0.8, 0, ty + 0.8, [[0, IJA[1]], [1, '#2e2818']]));
    }),
  ];
}
model('jp_w_chiha', 21, DIRS, dugIn(nipponTank({ len: 24, wid: 17, tr: 5.5, gun: 10, kind: 'chiha', seed: 61 }), 4));

/** A cave position dug into a coral ridge: rock, a log-framed embrasure and machine guns. */
model('jp_w_cave', 21, DIRS, [
  P(WD - 1, WD + 9, (g, z) => {
    const f = (z - WD + 1) / 10;
    const r = 15 * (1 - f * 0.55);
    const rng = new Rng(77);
    g.beginPath();
    for (let k = 0; k <= 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const rr = r * (0.85 + rng.next() * 0.3);
      if (k) g.lineTo(Math.cos(a) * rr - 2, Math.sin(a) * rr);
      else g.moveTo(Math.cos(a) * rr - 2, Math.sin(a) * rr);
    }
    g.closePath();
    finish(g, grad(g, -15, -15, 15, 15, [[0, '#c8c0a4'], [1, '#7a7260']]), f > 0.9 ? 'rgba(0,0,0,0.35)' : null);
  }, true),
  P(WD + 2, WD + 6, (g) => {
    box(g, 8, -6, 4, 12, 0.6, '#1a1612'); // dark embrasure
    for (const y of [-6.5, 5.5]) box(g, 7, y, 6, 1.2, 0.4, '#5a4026'); // log frame
    box(g, 10, -3, 6, 0.8, 0.3, '#2a2a26', null); // MG barrels
    box(g, 10, 2.2, 6, 0.8, 0.3, '#2a2a26', null);
  }),
  P(WD + 9, WD + 10, (g) => {
    const rng = new Rng(78);
    for (let k = 0; k < 9; k++) circ(g, rng.range(-9, 5), rng.range(-7, 7), rng.range(1.2, 2.6), k % 2 ? '#5a7a34' : '#6e8a40', null); // scrub
  }),
]);
model('jp_w_mortar', 15, DIRS, mortarPit(S));
model('jp_w_105', 26, DIRS, howitzer(S));

/** The Type 4 20 cm rocket launcher on a truck: four big rockets on rails. */
export const type4Truck: Part[] = [
  P(0, 4, (g) => {
    for (const [x, y] of [[-11, -7.4], [-5.5, -7.4], [6, -7.4], [-11, 4.4], [-5.5, 4.4], [6, 4.4]]) wheel(g, x, y, 4.4, 3);
  }),
  P(4, 7, (g) => {
    box(g, -14, -5.2, 28, 10.4, 0.8, '#3a3426');
    poly(g, [5, -5, 11, -5, 14, -3.4, 14, 3.4, 11, 5, 5, 5], grad(g, 5, -5, 14, 5, [[0, IJA[0]], [1, IJA[2]]]));
  }),
  P(7, 10.5, (g) => box(g, 0.5, -5.2, 5, 10.4, 1, grad(g, 0.5, -5, 5.5, 5, [[0, IJA[0]], [1, IJA[2]]]))),
  P(7, 11, (g) => {
    for (let k = 0; k < 4; k++) {
      const y = -4.2 + k * 2.8;
      box(g, -14, y, 13, 2, 0.9, grad(g, 0, y, 0, y + 2, [[0, '#7a7052'], [1, '#3a3420']]), null);
      circ(g, -0.5, y + 1, 1, '#c8b890', null);
    }
  }, true),
];
model('jp_type4', 17, DIRS, type4Truck);
model('jp_w_depot', 21, 1, depot(S));
model('jp_w_observer', 16, DIRS, observer(S));
model('jp_w_hq', 21, 1, hq(S));
model('jp_w_hq_base', 54, 1, compound(S));
model('jp_w_workshop', 21, 1, workshop(S));
model('jp_w_barracks', 21, 1, barracks(S));
model('jp_w_motorpool', 22, 1, motorpool(S));
model('jp_w_airfield', 23, 1, airfield(S));

/** A barricade of coconut logs. */
model('jp_logs', 11, 1, [
  P(0, 7, (g, z) => {
    const n = Math.floor(z / 2.3);
    for (let k = 0; k < 3; k++) {
      const y = -6 + k * 4 + (n % 2) * 1.5;
      box(g, -8, y, 16, 3, 1.5, grad(g, 0, y, 0, y + 3, [[0, '#8a6a42'], [1, '#4a3420']]), 'rgba(0,0,0,0.4)');
    }
  }, true),
]);

const VAL = { span: 30, len: 20, body: ['#c8c8b0', '#a0a088', '#6a6a58'], seats: 2, mark: hinomaru, spinner: '#3a3a30' };
model('jp_w_valfield', 23, 1, [
  P(WD - 1, WD, (g) => box(g, -19, -19, 38, 38, 2, '#8a8468')),
  ...plane(VAL).map((p) => ({ ...p, z0: p.z0 + WD, z1: p.z1 + WD })),
  P(WD, WD + 1.5, (g) => {
    for (const s of [-1, 1]) {
      g.beginPath();
      g.ellipse(3, s * 7, 2, 1.1, 0, 0, Math.PI * 2);
      finish(g, '#a0a088'); // fixed spatted gear
    }
  }),
  ...crew(10, 12, -0.5, WD, S.uni, S.helm, S.hk),
]);

/** The Type 98 320 mm spigot mortar: a huge finned bomb on a spigot over a timber platform. */
model('jp_w_type98', 22, 1, [
  P(WD - 1, WD + 1, (g) => {
    box(g, -12, -12, 24, 24, 0.6, '#6a5236');
    for (let k = -12; k < 12; k += 3) line(g, [k, -12, k, 12], 'rgba(0,0,0,0.25)');
  }),
  P(WD + 1, WD + 4, (g) => box(g, -4, -4, 8, 8, 1, '#2e2e28')), // spigot base
  P(WD + 4, WD + 14, (g, z) => {
    // the bomb, standing on the spigot: fat body, tapering nose
    const f = (z - WD - 4) / 10;
    const r = f < 0.7 ? 5.5 : 5.5 * (1 - (f - 0.7) / 0.3) + 0.6;
    circ(g, 0, 0, r, grad(g, -r, -r, r, r, [[0, '#5a5a4a'], [1, '#2a2a22']]));
  }, true),
  P(WD + 4, WD + 6, (g) => {
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      poly(g, [Math.cos(a) * 4, Math.sin(a) * 4, Math.cos(a) * 8, Math.sin(a) * 8, Math.cos(a + 0.3) * 7, Math.sin(a + 0.3) * 7], '#3a3a30'); // tail fins
    }
  }),
  ...crew(-9, 8, 0.3, WD, S.uni, S.helm, S.hk),
  ...crew(9, -8, Math.PI, WD, S.uni, S.helm, S.hk),
]);

/** Japanese ranks: red collar tabs with yellow stars and stripes; the chrysanthemum at the top. */
function japaneseRank(g: Ctx, lv: number) {
  if (lv === 0) return;
  const y = 17.5;
  if (lv <= 8) {
    box(g, -5, y - 1.5, 10, 3, 0.4, RED, 'rgba(0,0,0,0.6)');
    if (lv >= 4) line(g, [-5, y, 5, y], '#e8c840', 0.6);
    if (lv >= 7) line(g, [-5, y - 0.9, 5, y - 0.9], '#e8c840', 0.5);
    const n = lv <= 3 ? lv : lv <= 6 ? lv - 3 : lv - 6;
    for (let k = 0; k < n; k++) star(g, (k - (n - 1) / 2) * 2.6, y, 0.8, '#e8c840', null);
  } else {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      circ(g, Math.cos(a) * 1.8, y + Math.sin(a) * 1.8, 0.8, '#f0c840', null);
    }
    circ(g, 0, y, 1.2, '#d8a830', null);
  }
}
makeBases('jpbase', japaneseRank);

model('jp_officer', 12, DIRS, officer({ coat: KHAKI_JP, tails: '#5a5030', cap: ['#8a7e48', '#4a4228'], band: RED, badge: '#e8c840', weapon: 'sword' }));

// ---------------------------------------------------------------- soldiers and vehicles

const JS = { tunic: KHAKI_JP, helmet: '#6a6640', hk: 'jp' as const };
model('jp_rifle', 8, DIRS, soldier({ ...JS, gear: 'rifle', pack: 'roll' }));
model('jp_banzai', 8, DIRS, soldier({ tunic: ['#b0a262', '#8e8046', '#60542c'], helmet: '#7a7044', cap: 'fieldcap', gear: 'rifle', pack: 'none' }));
model('jp_mg', 8, DIRS, soldier({ ...JS, gear: 'mg', pack: 'none' }));
model('jp_lunge', 8, DIRS, soldier({ ...JS, gear: 'lunge', pack: 'none' }));
model('jp_sniper', 8, DIRS, soldier({ tunic: ['#7a8a48', '#5a6a32', '#3a4620'], helmet: '#4a5a2a', cap: 'hood', gear: 'scoped', pack: 'none' }));
model('jp_engineer', 8, DIRS, soldier({ ...JS, gear: 'rifle', pack: 'satchel' }));
model('jp_medic', 8, DIRS, soldier({ ...JS, gear: 'none', pack: 'medic' }));

model('jp_kurogane', 12, DIRS, [
  P(0, 4, (g) => {
    for (const [x, y] of [[-7.5, -6.6], [4, -6.6], [-7.5, 4], [4, 4]]) wheel(g, x, y, 4.2, 2.6);
  }),
  P(2.5, 5.5, (g) => {
    poly(g, [-9.5, -4.4, 5, -4.4, 9.5, -3.2, 9.5, 3.2, 5, 4.4, -9.5, 4.4], grad(g, -9.5, -4.4, 9.5, 4.4, [[0, IJA[0]], [1, IJA[2]]]));
    box(g, 6.5, -2.4, 2.4, 4.8, 0.4, '#2a2418'); // radiator
  }),
  P(5.5, 6.5, (g) => box(g, -6.5, -3.6, 8, 7.2, 1, '#3a3426')),
  ...crew(-1, -1.8, 0, 5, KHAKI_JP, '#6a6640', 'jp'),
  ...crew(-4.5, 1.8, 0, 5, KHAKI_JP, '#6a6640', 'jp'),
]);

/** Sumida Type 2593: a six-wheeled armoured car with a small turret. */
model('jp_sumida', 15, DIRS, [
  P(0, 4, (g) => {
    for (const x of [-9, -3, 6.5]) for (const s of [-1, 1]) wheel(g, x, s * 6.8 - 1.4, 4.4, 2.8);
  }),
  P(3.5, 9, (g) => {
    const pts = [-12, -5.6, 6, -5.6, 12, -3, 12, 3, 6, 5.6, -12, 5.6];
    poly(g, pts, grad(g, -12, -6, 12, 6, [[0, IJA[0]], [1, IJA[2]]]));
    camo(g, () => poly(g, pts, 'rgba(0,0,0,0)', null), IJA_CAMO, 92, 6, 3.5, 11);
  }),
  P(9, 12, (g) => {
    circ(g, -2, 0, 3.8, grad(g, -5, -3, 2, 3, [[0, IJA[0]], [1, IJA[2]]]));
    box(g, 1.5, -0.4, 5, 0.8, 0.3, '#1a1a18', null);
  }),
]);
model('jp_hago', 14, DIRS, nipponTank({ len: 20, wid: 15, tr: 4.5, gun: 8, kind: 'hago', seed: 95 }));
model('jp_chiha', 17, DIRS, nipponTank({ len: 24, wid: 17, tr: 5.5, gun: 8, kind: 'chiha', seed: 97 }));
model('jp_chihe', 18, DIRS, nipponTank({ len: 25, wid: 18, tr: 5.8, gun: 12, kind: 'chihe', seed: 101 }));
model('jp_chinu', 19, DIRS, nipponTank({ len: 27, wid: 19, tr: 6.5, gun: 14, kind: 'chinu', seed: 103 }));

/** The O-I: a 120-tonne super-heavy prototype with a main turret and two small ones. */
model('jp_oi', 30, DIRS, [
  P(0, 6, tracks(44, 30, 7, 8)),
  P(5.5, 12, (g) => {
    const pts = [-22, -14, 16, -14, 22, -9, 22, 9, 16, 14, -22, 14];
    poly(g, pts, grad(g, -22, -14, 22, 14, [[0, IJA[0]], [1, IJA[2]]]));
    camo(g, () => poly(g, pts, 'rgba(0,0,0,0)', null), IJA_CAMO, 111, 12, 6, 20);
    const rng = new Rng(112);
    for (let k = 0; k < 30; k++) circ(g, rng.range(-21, 21), rng.range(-13, 13), 0.3, 'rgba(30,25,15,0.5)', null);
    box(g, -21, -5, 7, 10, 0.6, '#3e3626');
  }),
  P(12, 15, (g) => {
    for (const [x, y] of [[12, -8], [12, 8]]) {
      circ(g, x, y, 3.2, grad(g, x - 3, y - 3, x + 3, y + 3, [[0, IJA[0]], [1, IJA[2]]])); // sub-turrets
      box(g, x + 2.5, y - 0.4, 5, 0.8, 0.3, '#1a1a18', null);
    }
  }),
  P(12, 19, (g) => {
    box(g, -10, -8.5, 17, 17, 2, rgrad(g, -2, -2, 13, [[0, IJA[0]], [0.7, IJA[1]], [1, IJA[2]]]));
    box(g, -8, 4, 3, 2, 0.3, '#f0ece0', null);
    star(g, -6.5, 5, 0.8, '#e8c840', null);
  }),
  P(14, 16.5, (g) => box(g, 6, -1.3, 20, 2.6, 0.8, grad(g, 0, -1.3, 0, 1.3, [[0, IJA[1]], [1, '#2e2818']]))),
]);

model('jp_zero', 18, DIRS, plane({ span: 25, len: 17, body: ['#c8c8b0', '#a0a088', '#6a6a58'], seats: 1, mark: hinomaru, spinner: '#3a3a30' }), false);
model('jp_kamikaze', 18, DIRS, plane({ span: 25, len: 17, body: ['#6e7a52', '#566040', '#3a422c'], seats: 1, mark: hinomaru, spinner: '#3a3a30', bomb: true }), false);
