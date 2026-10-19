// The Soviet Union as the defender: Red Army emplacements and units (set 'su', which also holds
// the Red Army's attackers in models_ww2.ts).

import { DIRS, P, box, circ, grad, line, model, setModelSet, star, type Ctx, type Part } from './modelkit';
import {
  KHAKI, RED, SU, WD, atGun, crew, depot, flamerTeam, heavyAA, hq, howitzer, lightAA, makeBases, mgNest, motorpool, observer,
  officer, pillbox, plane, prone, sniperPit, soldier, t34, workshop, barracks, airfield, mortarPit, type Style,
} from './models_ww2';

setModelSet('su');

const redStar = (g: Ctx, x: number, y: number, r: number) => star(g, x, y, r, RED, 'rgba(255,240,200,0.8)');

export const SU_STYLE: Style = {
  uni: KHAKI, helm: '#4e5a2e', hk: 'ssh', paint: SU, camo: ['rgba(50,60,25,0.5)', 'rgba(120,110,70,0.35)'],
  mark: redStar, plane: ['#9aa2a6', '#6e787c', '#454c50'],
  flag: (g, x, y) => {
    box(g, x, y, 9, 6, 0.2, RED, 'rgba(0,0,0,0.5)');
    star(g, x + 2, y + 1.6, 0.9, '#f0d040', null); // star over the hammer and sickle
    line(g, [x + 1.4, y + 4.2, x + 2.8, y + 2.8], '#f0d040', 0.5);
    line(g, [x + 1.2, y + 3, x + 2.6, y + 4.4], '#f0d040', 0.5);
  },
};
const S = SU_STYLE;

model('su_w_mg', 18, DIRS, mgNest(S, 'maxim'));
model('su_w_aa', 20, DIRS, lightAA(S));
model('su_w_ptrd', 17, DIRS, [
  P(WD, WD + 1.5, (g) => box(g, -8, 4, 5, 2, 0.5, '#4a4630')), // ammo box
  ...prone(-2, -1, WD, S.uni, S.helm, S.hk),
  P(WD + 2.2, WD + 3.2, (g) => {
    // the PTRD-41: a 2 m single-shot anti-tank rifle on its bipod
    line(g, [8, -1, 7, -3.5], '#2a2a26', 0.6);
    line(g, [8, -1, 7, 1.5], '#2a2a26', 0.6);
    box(g, -3, -1.6, 18, 1.2, 0.4, '#3a3a34', null);
    box(g, -3, -1.9, 4, 1.8, 0.6, '#5a3c22', null);
    box(g, 14.5, -2.1, 2.2, 2.2, 0.3, '#1a1a18', null); // muzzle brake
  }),
  ...crew(-5, 5, 0.3, WD - 1, S.uni, S.helm, S.hk),
]);
model('su_w_sniper', 14, DIRS, sniperPit(S));
model('su_w_flamer', 14, DIRS, flamerTeam(S));
model('su_w_zis3', 23, DIRS, atGun(S, { barrel: 19, shieldW: 7.5, brake: true, wheelY: 8 }));
model('su_w_52k', 27, DIRS, heavyAA(S));

/** A tank dug in hull-down: its model without the tracks, sunk into the pit. */
export function dugIn(parts: Part[], sink: number): Part[] {
  return parts.slice(1).map((p) => ({ ...p, z0: Math.max(WD, p.z0 - sink + WD), z1: Math.max(WD + 0.5, p.z1 - sink + WD) }));
}
model('su_w_t34', 22, DIRS, dugIn(t34(true), 4.5));
model('su_w_dot', 21, DIRS, pillbox(S));
model('su_w_mortar', 15, DIRS, mortarPit(S));
model('su_w_m30', 26, DIRS, howitzer(S));
model('su_w_depot', 21, 1, depot(S));
model('su_w_observer', 16, DIRS, observer(S));
model('su_w_hq', 21, 1, hq(S));
model('su_w_workshop', 21, 1, workshop(S));
model('su_w_barracks', 21, 1, barracks(S));
model('su_w_motorpool', 22, 1, motorpool(S));
model('su_w_airfield', 23, 1, airfield(S));

/** Czech hedgehogs: three welded rails that stop tanks. */
model('hedgehog', 11, 1, [0, 1, 2, 3].map((k) => {
  const x = k % 2 ? 4 : -4;
  const y = k < 2 ? -4 : 4;
  return P(0, 7, (g, z) => {
    const f = z / 7;
    const r = 3.6 * (1 - f) + 0.6;
    for (const a of [0, Math.PI / 3, (2 * Math.PI) / 3]) line(g, [x - Math.cos(a) * r, y - Math.sin(a) * r, x + Math.cos(a) * r, y + Math.sin(a) * r], f > 0.85 ? '#2a2a26' : '#4a4a44', 1.1);
  }, true);
}));

model('su_w_il2field', 23, 1, [
  P(WD - 1, WD, (g) => box(g, -19, -19, 38, 38, 2, '#6e6a58')), // grass strip
  ...plane({ span: 30, len: 20, body: ['#7f8a52', '#5c6634', '#3c4422'], armoured: true, seats: 2 }).map((p) => ({ ...p, z0: p.z0 + WD, z1: p.z1 + WD })),
  P(WD, WD + 2, (g) => {
    for (let k = 0; k < 4; k++) box(g, -14 + k * 3, 12, 2.2, 4, 0.8, '#5a5a44'); // rockets laid out for loading
  }),
  ...crew(10, 12, -0.5, WD, S.uni, S.helm, S.hk),
]);

/** The B-4 203 mm howitzer on its tracked carriage: the "Stalin's sledgehammer". */
model('su_w_b4', 26, 1, [
  P(WD, WD + 4, (g) => {
    for (const y of [-9, 9]) {
      box(g, -14, y - 3, 22, 6, 1.5, '#262622');
      for (let x = -12; x < 8; x += 2.4) line(g, [x, y - 3, x, y + 3], 'rgba(255,255,255,0.08)');
    }
  }),
  P(WD + 3, WD + 8, (g) => {
    box(g, -10, -6, 16, 12, 1, grad(g, -10, -6, 6, 6, [[0, SU[0]], [1, SU[2]]]));
    box(g, -12, -3, 4, 6, 0.8, '#3a3e22'); // breech
  }),
  P(WD + 6, WD + 11, (g, z) => {
    // the barrel raised for a long shot: drawn rising towards the muzzle
    const f = (z - WD - 6) / 5;
    box(g, -6 + f * 18, -1.8, 6, 3.6, 1.2, grad(g, 0, -1.8, 0, 1.8, [[0, '#6e7646'], [1, '#2e3218']]));
  }, true),
  P(WD + 11, WD + 12, (g) => circ(g, 15, 0, 1.6, '#141410', null)),
  ...crew(-14, 8, 0.4, WD, S.uni, S.helm, S.hk),
  ...crew(-14, -8, -0.4, WD, S.uni, S.helm, S.hk),
  ...crew(4, 10, 0, WD, S.uni, S.helm, S.hk),
]);

/** Soviet ranks: red stripes for the soldiers, stars for the officers, the gold star of a Hero of the Soviet Union. */
function sovietRank(g: Ctx, lv: number) {
  if (lv === 0) return;
  const y = 17.5;
  if (lv <= 3) {
    box(g, -4, y - 1.4, 8, 2.8, 1, '#7a8248', 'rgba(0,0,0,0.6)');
    for (let k = 0; k < lv; k++) line(g, [-4, y - 0.8 + k * 0.8, 4, y - 0.8 + k * 0.8], RED, 0.5);
  } else if (lv <= 8) {
    const n = lv <= 6 ? lv - 3 : lv - 6;
    box(g, -5, y - 1.4, 10, 2.8, 1.2, lv <= 6 ? '#c8b060' : '#d8b450', 'rgba(0,0,0,0.6)');
    for (let k = 0; k < n; k++) star(g, (k - (n - 1) / 2) * 2.8, y, lv <= 6 ? 0.8 : 1.1, lv <= 6 ? '#e8ecf0' : RED, null);
  } else {
    star(g, 0, y, 2.6, '#f0c840', 'rgba(0,0,0,0.6)');
  }
}
makeBases('subase', sovietRank);

model('su_officer', 12, DIRS, officer({ coat: ['#8a8a62', '#6a6a48', '#46462e'], tails: '#4a4a34', cap: ['#7a7a52', '#3e4228'], band: RED, badge: RED, weapon: 'smg' }));

// ---------------------------------------------------------------- Soviet units (the attackers' infantry models serve too)

model('su_mgteam', 8, DIRS, soldier({ tunic: KHAKI, helmet: '#4e5a2e', hk: 'ssh', gear: 'mg', pack: 'none' }));
model('su_ptrdteam', 8, DIRS, soldier({ tunic: KHAKI, helmet: '#4e5a2e', hk: 'ssh', gear: 'ptrd', pack: 'none' }));
