// WW2 models: Soviet infantry, vehicles, tanks and aircraft (facing +x), German emplacements (gun
// at the origin, aiming +x) and the sandbag/concrete bases they stand in. Same conventions as
// models.ts: stacked top-down parts, z in world pixels.

import { Rng } from '../game/rng';
import { DIRS, P, box, camo, circ, finish, grad, line, model, poly, rgrad, setModelSet, star, tread, wheel, type Ctx, type Part } from './modelkit';

// ---------------------------------------------------------------- palettes and faction styles

const SU = ['#7a8248', '#5a6132', '#3a3f1e']; // Soviet 4BO green
const KHAKI = ['#a89d6a', '#857a4d', '#5a5233']; // gymnastyorka
const FG = ['#808676', '#62675a', '#43473d']; // German field grey
const DG = ['#d8c48c', '#b9a168', '#867347']; // dunkelgelb
const DG_CAMO = ['rgba(80,95,45,0.55)', 'rgba(120,70,40,0.45)'];
const SKIN = '#d6a37a';
const RED = '#c42a1e';
const BLACK = '#1a1a18';
export { SU, KHAKI, FG, DG, DG_CAMO, SKIN, RED, BLACK };

export type Helmet = 'stahl' | 'm1' | 'ssh' | 'jp';

/**
 * How a faction's emplacements look: crew uniform and helmet, paint of guns and vehicles,
 * camouflage blotches, the national marking and the flag. Emplacement models are functions of it.
 */
export interface Style {
  uni: string[];
  helm: string;
  hk: Helmet;
  paint: string[];
  camo: string[];
  /** National marking centred on (x, y), r across. */
  mark: (g: Ctx, x: number, y: number, r: number) => void;
  /** Flag with its top-left corner at (x, y), 9×6. */
  flag: (g: Ctx, x: number, y: number) => void;
  /** Fighter on the airfield: body colours. */
  plane: string[];
}


// ---------------------------------------------------------------- soldiers

type Gear = 'rifle' | 'smg' | 'scoped' | 'mg' | 'tube' | 'ptrd' | 'bazooka' | 'lunge' | 'none';
export interface Soldier {
  tunic: string[];
  helmet: string;
  cap?: 'helmet' | 'pilotka' | 'hood' | 'fieldcap';
  hk?: Helmet;
  gear: Gear;
  pack?: 'roll' | 'medic' | 'satchel' | 'none';
}

/** A standing soldier walking towards +x, the same stack as the modern infantry. */
export function soldier(o: Soldier): Part[] {
  const parts: Part[] = [
    P(0, 3, (g) => {
      box(g, -1.6, -2.6, 3.4, 1.7, 0.8, '#2a261c');
      box(g, -0.4, 0.9, 3.4, 1.7, 0.8, '#2a261c');
    }),
    P(3, 7, (g) => {
      if (o.pack === 'roll') {
        // greatcoat roll over the shoulder
        g.beginPath();
        g.ellipse(-0.6, 0, 1.4, 3.9, 0, 0, Math.PI * 2);
        finish(g, '#6a6448');
      } else if (o.pack === 'medic') {
        box(g, -4.4, -2.6, 2.8, 5.2, 1, '#d8d4c4');
        line(g, [-3, -1.6, -3, 1.6], RED, 1);
        line(g, [-4.1, 0, -1.9, 0], RED, 1);
      } else if (o.pack === 'satchel') {
        box(g, -4.6, -3, 3.2, 6, 0.8, '#6a5030'); // satchel charges
        line(g, [-3, -3, -3, 3], '#3a2a18', 0.5);
      } else if (o.pack !== 'none') box(g, -4.2, -2.6, 2.6, 5.2, 1, '#57502f');
      g.beginPath();
      g.ellipse(0, 0, 2.6, 3.7, 0, 0, Math.PI * 2);
      finish(g, grad(g, -2, -3, 2, 3, [[0, o.tunic[0]], [1, o.tunic[2]]]));
      circ(g, 1.6, -2.6, 1.1, o.tunic[1]);
      circ(g, 2.2, 1.4, 1.1, o.tunic[1]);
      line(g, [-1.8, -2.6, 1.6, 2.8], 'rgba(40,30,20,0.6)', 0.6); // belt strap
    }),
  ];
  if (o.gear === 'rifle' || o.gear === 'scoped') {
    parts.push(P(5.5, 6.5, (g) => {
      box(g, -1, 0.6, 10.5, 1, 0.4, '#5a3c22', null); // wooden stock
      box(g, 5.5, 0.75, 5, 0.7, 0.3, BLACK, null);
      if (o.gear === 'scoped') box(g, 2.6, 0.1, 3.6, 0.9, 0.4, '#101010', null);
    }));
  } else if (o.gear === 'mg') {
    parts.push(P(5.5, 6.5, (g) => {
      box(g, -1, 0.4, 6, 1.4, 0.4, '#2e2e2a', null); // MG-42 receiver and stock
      box(g, 5, 0.55, 7, 1.1, 0.4, '#3a3a36', null); // perforated jacket
      for (let x = 5.6; x < 11.5; x += 1.1) circ(g, x, 1.1, 0.25, '#111', null);
      line(g, [1, 1.6, -0.5, 3.6], '#b08a40', 0.7); // belt
    }));
  } else if (o.gear === 'ptrd') {
    parts.push(P(5.5, 6.5, (g) => {
      box(g, -2, 0.4, 16, 1.1, 0.4, '#3a3a34', null); // the long PTRD anti-tank rifle
      box(g, -2, 0.2, 4, 1.5, 0.5, '#5a3c22', null);
      box(g, 13.5, 0.1, 2, 1.7, 0.3, '#1a1a18', null); // muzzle brake
    }));
  } else if (o.gear === 'lunge') {
    parts.push(P(5.5, 6.5, (g) => {
      box(g, -2, 0.5, 14, 0.8, 0.3, '#7a5a32', null); // the lunge mine's pole
      g.beginPath();
      g.moveTo(12, -0.8);
      g.lineTo(15, 0.9);
      g.lineTo(12, 2.6);
      g.closePath();
      g.fillStyle = '#3a3a30';
      g.fill(); // the shaped-charge cone
    }));
  } else if (o.gear === 'bazooka') {
    parts.push(P(7, 8.5, (g) => {
      box(g, -6, -2.4, 14, 1.6, 0.8, grad(g, 0, -2.4, 0, -0.8, [[0, '#7a7a52'], [1, '#3e3e28']]), null); // M1 bazooka
      box(g, 7.5, -2.8, 1.5, 2.4, 0.4, '#3a3a2a', null); // flared muzzle
    }));
  } else if (o.gear === 'tube') {
    parts.push(P(7, 8.5, (g) => {
      box(g, -6, -2.6, 15, 2, 0.9, grad(g, 0, -2.6, 0, -0.6, [[0, '#6a7052'], [1, '#383c2a']]), null); // Panzerschreck on the shoulder
      box(g, 0.5, -3.4, 3, 3.6, 0.4, '#4a4e3a', null); // blast shield
    }));
  } else if (o.gear === 'smg') {
    parts.push(P(5.5, 6.5, (g) => {
      box(g, 0.6, 0.2, 7, 1.2, 0.4, '#5a3c22', null);
      circ(g, 3.2, 1.8, 1.4, BLACK, null); // PPSh drum magazine
      box(g, 6.5, 0.45, 2.4, 0.7, 0.3, BLACK, null);
    }));
  }
  parts.push(P(7, 9.5, (g) => {
    if (o.cap === 'pilotka') {
      circ(g, 0.3, 0, 2.2, SKIN);
      g.beginPath();
      g.ellipse(-0.2, 0, 2.2, 1.5, 0, 0, Math.PI * 2);
      finish(g, o.helmet);
      star(g, 1.6, 0, 0.6, RED, null);
    } else if (o.cap === 'fieldcap') {
      // Japanese field cap with its neck flaps
      circ(g, 0.3, 0, 2.2, SKIN);
      box(g, -2.4, -1.8, 2.6, 3.6, 0.8, o.helmet);
      g.beginPath();
      g.ellipse(0, 0, 2.1, 1.7, 0, 0, Math.PI * 2);
      finish(g, o.helmet);
      star(g, 1.5, 0, 0.55, '#e8c840', null);
    } else if (o.cap === 'hood') {
      circ(g, 0.3, 0, 2.6, rgrad(g, 0.3, 0, 2.6, [[0, '#7a8a50'], [1, '#3e4a26']]));
    } else if (o.hk) {
      helmetTop(g, 0.3, 0, o.helmet, o.hk);
    } else {
      circ(g, 0.3, 0, 2.5, rgrad(g, 0.3, 0, 2.5, [[0, '#8d9a5c'], [1, o.helmet]]));
      line(g, [-1.5, -1.6, 1.8, -1.9], 'rgba(255,255,255,0.15)', 0.5);
    }
  }));
  return parts;
}

// ---------------------------------------------------------------- Soviet attackers (set 'su')

setModelSet('su');
model('su_rifle', 8, DIRS, soldier({ tunic: KHAKI, helmet: '#4e5a2e', gear: 'rifle', pack: 'roll' }));
model('su_smg', 8, DIRS, soldier({ tunic: ['#9c9568', '#7a7448', '#4f4a2e'], helmet: '#4e5a2e', gear: 'smg', pack: 'roll' }));
model('su_sniper', 8, DIRS, soldier({ tunic: ['#7d8a4e', '#5c6a34', '#3a4520'], helmet: '#4a5a2a', cap: 'hood', gear: 'scoped', pack: 'none' }));
model('su_sapper', 8, DIRS, soldier({ tunic: ['#8a8a6a', '#6a6a4c', '#46462f'], helmet: '#4e5a2e', gear: 'smg', pack: 'satchel' }));
model('su_medic', 8, DIRS, soldier({ tunic: KHAKI, helmet: '#6a6a40', cap: 'pilotka', gear: 'none', pack: 'medic' }));

setModelSet('ww2');

/** A crewman seen from above at (x,y) facing angle a: shoulders then helmet. */
export function crew(x: number, y: number, a: number, z0: number, tunic: string[], helmet = '#5e6452', hk: Helmet = 'stahl'): Part[] {
  const at = (g: Ctx, fn: () => void) => {
    g.save();
    g.translate(x, y);
    g.rotate(a);
    fn();
    g.restore();
  };
  return [
    P(z0, z0 + 4, (g) => at(g, () => {
      g.beginPath();
      g.ellipse(0, 0, 2.3, 3.3, 0, 0, Math.PI * 2);
      finish(g, grad(g, -2, -3, 2, 3, [[0, tunic[0]], [1, tunic[2]]]));
      circ(g, 1.6, -2.2, 1, tunic[1]);
      circ(g, 1.6, 2.2, 1, tunic[1]);
    })),
    P(z0 + 4, z0 + 6, (g) => at(g, () => helmetTop(g, 0.2, 0, helmet, hk))),
  ];
}

/** A helmet seen from above: the Stahlhelm's flared skirt, the round M1 with its net, the SSh-40 dome, the Japanese Type 90 with its star. */
export function helmetTop(g: Ctx, x: number, y: number, helmet: string, hk: Helmet): void {
  if (hk === 'm1') {
    circ(g, x, y, 2.5, rgrad(g, x, y, 2.5, [[0, '#9aa070'], [0.7, helmet], [1, '#33361f']]));
    line(g, [x - 1.6, y - 1.2, x + 1.6, y + 1.2], 'rgba(30,30,20,0.45)', 0.4); // net
    line(g, [x - 1.6, y + 1.2, x + 1.6, y - 1.2], 'rgba(30,30,20,0.45)', 0.4);
  } else if (hk === 'ssh') {
    circ(g, x, y, 2.3, rgrad(g, x - 0.5, y - 0.5, 2.6, [[0, '#9aa266'], [0.6, helmet], [1, '#2e3418']]));
  } else if (hk === 'jp') {
    circ(g, x, y, 2.3, rgrad(g, x, y, 2.3, [[0, '#a8a070'], [0.7, helmet], [1, '#3a3820']]));
    star(g, x + 1.3, y, 0.6, '#e8c840', null);
  } else {
    // Stahlhelm: wide skirt with a flare
    circ(g, x, y, 2.4, rgrad(g, x, y, 2.4, [[0, '#8a9080'], [0.7, helmet], [1, '#2e3128']]));
  }
}

/** A soldier lying prone towards +x (snipers, MG gunners). */
export function prone(x: number, y: number, z0: number, tunic: string[], helmet: string, hk: Helmet = 'stahl'): Part[] {
  return [
    P(z0, z0 + 2, (g) => {
      box(g, x - 9, y - 2.4, 4.5, 1.6, 0.8, '#2a261c'); // legs, spread
      box(g, x - 9, y + 0.8, 4.5, 1.6, 0.8, '#2a261c');
    }),
    P(z0, z0 + 3, (g) => {
      g.beginPath();
      g.ellipse(x - 2, y, 4.2, 2.8, 0, 0, Math.PI * 2);
      finish(g, grad(g, x - 6, y - 3, x + 2, y + 3, [[0, tunic[0]], [1, tunic[2]]]));
      circ(g, x + 1.8, y - 2.4, 1, tunic[1]);
      circ(g, x + 1.8, y + 2.4, 1, tunic[1]);
    }),
    P(z0 + 2, z0 + 4, (g) => helmetTop(g, x + 2.6, y, helmet, hk)),
  ];
}

// ---------------------------------------------------------------- Soviet vehicles

setModelSet('su');
model('su_gaz', 13, DIRS, [
  P(0, 4, (g) => {
    for (const [x, y] of [[-8.5, -7.4], [3.8, -7.4], [-8.5, 4.6], [3.8, 4.6]]) wheel(g, x, y, 4.8, 2.8);
  }),
  P(2.5, 5.5, (g) => {
    const pts = [-10, -5, 4, -5, 10, -3.6, 10, 3.6, 4, 5, -10, 5];
    poly(g, pts, grad(g, -10, -5, 10, 5, [[0, SU[0]], [1, SU[2]]]));
    for (let x = 6; x < 9.6; x += 0.9) line(g, [x, -3, x, 3], 'rgba(0,0,0,0.3)'); // bonnet louvres
    circ(g, 9.4, -3, 0.8, '#fff2b0', null);
    circ(g, 9.4, 3, 0.8, '#fff2b0', null);
    box(g, -11.6, -2.2, 2, 4.4, 0.8, '#1b1b19'); // spare wheel
  }),
  P(5.5, 6.5, (g) => {
    box(g, -6.5, -4, 8, 8, 1, '#3a3826'); // open cab floor
    line(g, [3.2, -4.6, 3.2, 4.6], '#2c2c28', 0.9); // windscreen frame
  }),
  ...crew(-1.2, -2, 0, 5, KHAKI, '#4e5a2e'),
  ...crew(-5, 2, 0, 5, KHAKI, '#4e5a2e'),
]);

/** BM-13 on a Lend-Lease Studebaker: cab forward, the rocket rails angled up over the bed. */
model('su_katyusha', 17, DIRS, [
  P(0, 4, (g) => {
    for (const [x, y] of [[-12, -7.6], [-6.5, -7.6], [6, -7.6], [-12, 4.6], [-6.5, 4.6], [6, 4.6]]) wheel(g, x, y, 4.6, 3);
  }),
  P(4, 7, (g) => {
    box(g, -15, -5.4, 30, 10.8, 0.8, '#3a3a2c'); // chassis
    poly(g, [5, -5.2, 12, -5.2, 15, -3.6, 15, 3.6, 12, 5.2, 5, 5.2], grad(g, 5, -5, 15, 5, [[0, SU[0]], [1, SU[2]]])); // bonnet
    for (let x = 12.5; x < 14.6; x += 0.8) line(g, [x, -2.8, x, 2.8], 'rgba(0,0,0,0.3)');
  }),
  P(7, 11, (g) => {
    box(g, 0.5, -5.4, 5.5, 10.8, 1, grad(g, 0.5, -5, 6, 5, [[0, '#848c52'], [1, SU[2]]])); // cab
    box(g, 4.4, -4.4, 1.2, 8.8, 0.3, '#9ab0b8', null); // windscreen
  }),
  P(7, 12, (g) => {
    // the rail launcher, raised towards the front
    for (let k = 0; k < 8; k++) {
      const y = -4.4 + k * 1.25;
      box(g, -15, y, 15, 0.9, 0.2, grad(g, -15, y, 0, y + 0.9, [[0, '#5c6034'], [1, '#2e301a']]), null);
    }
  }, true),
  P(12, 13, (g) => {
    for (let k = 0; k < 8; k += 2) circ(g, -0.8, -4 + k * 1.25, 0.6, '#c8c0a0', null); // rocket noses
    line(g, [-8, -5, -8, 5], '#22241a', 0.6);
  }),
]);

model('su_ba64', 13, DIRS, [
  P(0, 4, (g) => {
    for (const [x, y] of [[-8, -7.6], [3.4, -7.6], [-8, 4.8], [3.4, 4.8]]) wheel(g, x, y, 5, 2.8);
  }),
  P(3, 9, (g) => {
    // faceted, steeply sloped hull
    const pts = [-10, -5.8, 2, -6, 10.5, -3, 10.5, 3, 2, 6, -10, 5.8];
    poly(g, pts, grad(g, -10, -6, 10, 6, [[0, SU[0]], [1, SU[2]]]));
    poly(g, [2, -6, 10.5, -3, 10.5, 3, 2, 6], 'rgba(255,255,220,0.12)', 'rgba(0,0,0,0.3)'); // sloped glacis
    box(g, 6, -1.2, 2.2, 2.4, 0.4, '#20221a'); // vision slit
  }),
  P(9, 12, (g) => {
    const pts = [-4, -3.4, 1.5, -3.6, 4, -2, 4, 2, 1.5, 3.6, -4, 3.4];
    poly(g, pts, grad(g, -4, -3, 4, 3, [[0, '#848c52'], [1, SU[2]]]));
    circ(g, -0.5, 0, 1.6, '#1a1c14', null); // open top
  }),
  P(10, 11, (g) => box(g, 3.5, -0.5, 6, 1, 0.3, BLACK, null)), // DT machine gun
]);

/** A track pair along x: belts, plus road-wheel hubs showing on the outer edge. */
export function tracks(len: number, wid: number, tw: number, wheels: number) {
  return (g: Ctx) => {
    tread(g, -len / 2, -wid / 2, len, tw, 1.6);
    tread(g, -len / 2, wid / 2 - tw, len, tw, 1.6);
    for (let k = 0; k < wheels; k++) {
      const x = -len / 2 + 2.5 + (k * (len - 5)) / Math.max(1, wheels - 1);
      circ(g, x, -wid / 2 + tw / 2, tw * 0.32, '#4a4c40', null);
      circ(g, x, wid / 2 - tw / 2, tw * 0.32, '#4a4c40', null);
    }
  };
}

/** Painted tactical markings: a white number on the turret side. */
export function tacNumber(g: Ctx, x: number, y: number, w: number) {
  for (let k = 0; k < 3; k++) box(g, x + k * w * 0.4, y, w * 0.28, w * 0.5, 0.2, 'rgba(235,235,225,0.85)', null);
}

model('su_t70', 15, DIRS, [
  P(0, 4.5, tracks(22, 15, 4, 5)),
  P(4, 8, (g) => {
    const pts = [-11, -5.6, 6, -5.6, 11.5, -3.2, 11.5, 3.2, 6, 5.6, -11, 5.6];
    poly(g, pts, grad(g, -11, -6, 11, 6, [[0, SU[0]], [1, SU[2]]]));
    poly(g, [6, -5.6, 11.5, -3.2, 11.5, 3.2, 6, 5.6], 'rgba(255,255,220,0.1)', 'rgba(0,0,0,0.3)');
    for (let x = -10; x < -5; x += 1) line(g, [x, -4, x, 4], 'rgba(0,0,0,0.3)');
  }),
  P(8, 11.5, (g) => {
    // small turret offset to the left
    const pts = [-4.5, -4.2, 2, -4.4, 4.5, -2, 4.5, 2.2, 2, 3.6, -4.5, 3.4];
    poly(g, pts, grad(g, -4, -4, 4, 4, [[0, '#868e54'], [1, SU[2]]]));
    circ(g, -1.6, -1.6, 1.3, '#4a5228');
  }),
  P(9, 10.2, (g) => box(g, 4, -0.7, 9, 1.4, 0.4, grad(g, 0, -0.7, 0, 0.7, [[0, '#5a6234'], [1, '#2e3218']]))),
]);

/** T-34: sloped hull, wide tracks, turret set forward. */
export function t34(big: boolean): Part[] {
  return [
    P(0, 5, tracks(30, 22, 5.5, 5)),
    P(4.5, 9, (g) => {
      const pts = [-14.5, -8.4, 8, -8.4, 15, -5, 15, 5, 8, 8.4, -14.5, 8.4];
      poly(g, pts, grad(g, -14, -8, 14, 8, [[0, SU[0]], [1, SU[2]]]));
      poly(g, [8, -8.4, 15, -5, 15, 5, 8, 8.4], 'rgba(255,255,220,0.12)', 'rgba(0,0,0,0.3)'); // 60° glacis
      camo(g, () => poly(g, pts, 'rgba(0,0,0,0)', null), ['rgba(40,45,20,0.3)', 'rgba(140,140,100,0.15)'], big ? 12 : 4, 6, 4, 14);
      // engine deck grille and the round fuel tanks on the rear sides
      box(g, -13.5, -3.2, 5.5, 6.4, 0.6, '#3f4524');
      for (let x = -13; x < -8.5; x += 0.9) line(g, [x, -2.8, x, 2.8], 'rgba(0,0,0,0.4)');
      for (const y of [-7.6, 6.1]) {
        box(g, -12, y, 5, 1.5, 0.7, '#4a5228');
        box(g, -5.5, y, 5, 1.5, 0.7, '#4a5228');
      }
      circ(g, 13.2, 3.6, 0.9, '#262a18'); // driver's hatch / hull MG
      box(g, 10, -2.4, 2.6, 2.2, 0.5, '#454c28');
    }),
    P(9, big ? 14 : 13, (g) => {
      // big: the 85 mm cast turret; small: the hexagonal "nut" of 1943
      const pts = big
        ? [-7.5, -6.6, 2, -7, 6.5, -4.8, 7, 0, 6.5, 4.8, 2, 7, -7.5, 6.6, -9, 0]
        : [-5.5, -6, 2.5, -6.4, 6.5, -3.4, 6.5, 3.4, 2.5, 6.4, -5.5, 6];
      const x0 = big ? -1 : 1.5;
      g.save();
      g.translate(x0, 0);
      poly(g, pts, grad(g, -6, -6, 6, 6, [[0, '#8a9358'], [1, '#41471f']]));
      circ(g, -3, -2.6, big ? 2.2 : 1.8, rgrad(g, -3, -2.6, 2, [[0, '#8a9358'], [1, '#3a4020']])); // cupola
      box(g, -3.2, 2, 2.6, 2.2, 0.6, '#454c26');
      tacNumber(g, -4, big ? -6.2 : -5.6, 3.4);
      g.restore();
    }),
    P(10.5, 12, (g) => {
      const x0 = big ? 5.5 : 7.5;
      const len = big ? 19 : 15;
      box(g, x0, -1, len, 2, 0.6, grad(g, 0, -1, 0, 1, [[0, '#626a3a'], [1, '#2e3218']]));
      if (big) box(g, x0 + len - 2.6, -1.4, 2.6, 2.8, 0.5, '#2a2e1a');
      box(g, x0 - 1, -1.8, 2.2, 3.6, 0.6, '#4a5228'); // mantlet
    }),
    P(13, 14.2, (g) => star(g, big ? -6.5 : -2.5, 0, 1.6, RED)),
  ];
}
model('su_t34', 19, DIRS, t34(false));
model('su_t3485', 21, DIRS, t34(true));

model('su_kv1', 21, DIRS, [
  P(0, 5.5, tracks(31, 24, 6, 6)),
  P(5, 11, (g) => {
    // boxy, thick hull
    const pts = [-15, -9, 11, -9, 15.5, -6.5, 15.5, 6.5, 11, 9, -15, 9];
    poly(g, pts, grad(g, -15, -9, 15, 9, [[0, '#6e7646'], [1, '#353a1c']]));
    poly(g, [11, -9, 15.5, -6.5, 15.5, 6.5, 11, 9], 'rgba(255,255,220,0.1)', 'rgba(0,0,0,0.3)');
    for (let x = -14; x < -8; x += 1) line(g, [x, -4.5, x, 4.5], 'rgba(0,0,0,0.35)');
    for (let x = -12; x <= 12; x += 6) {
      circ(g, x, -8.2, 0.45, 'rgba(0,0,0,0.5)', null);
      circ(g, x, 8.2, 0.45, 'rgba(0,0,0,0.5)', null);
    }
  }),
  P(11, 17, (g) => {
    // the big welded turret with its rear bulge
    const pts = [-8.5, -7, 3, -7.2, 7.5, -5, 7.5, 5, 3, 7.2, -8.5, 7, -10, 3, -10, -3];
    poly(g, pts, grad(g, -9, -7, 7, 7, [[0, '#7e8650'], [1, '#383d1e']]));
    for (const [x, y] of [[-7, -5.6], [-7, 5.6], [5.5, -5.6], [5.5, 5.6]]) circ(g, x, y, 0.5, 'rgba(0,0,0,0.5)', null);
    circ(g, -4, -2.4, 2, '#4a5228');
    tacNumber(g, -6, -6.6, 3.4);
  }),
  P(12.5, 14, (g) => {
    box(g, 6.5, -1.1, 12, 2.2, 0.6, grad(g, 0, -1, 0, 1, [[0, '#5e6638'], [1, '#2e3218']]));
    box(g, 6, -2.4, 2.6, 4.8, 0.6, '#454c28');
  }),
  P(17, 18, (g) => star(g, -6, 2.4, 1.6, RED)),
]);

model('su_is2', 25, DIRS, [
  P(0, 6, tracks(38, 27, 6.5, 6)),
  P(5.5, 11, (g) => {
    // long hull with the stepped (later: straight) nose
    const pts = [-18.5, -10.2, 12, -10.2, 19, -6, 19, 6, 12, 10.2, -18.5, 10.2];
    poly(g, pts, grad(g, -18, -10, 18, 10, [[0, '#727a46'], [1, '#33381a']]));
    poly(g, [12, -10.2, 19, -6, 19, 6, 12, 10.2], 'rgba(255,255,220,0.13)', 'rgba(0,0,0,0.3)');
    box(g, -17.5, -4, 7, 8, 0.6, '#3c4220');
    for (let x = -17; x < -11; x += 0.9) line(g, [x, -3.6, x, 3.6], 'rgba(0,0,0,0.4)');
    for (const y of [-9.4, 7.7]) for (const x of [-15, -8]) box(g, x, y, 5.5, 1.7, 0.8, '#4a5228'); // fuel tanks
  }),
  P(11, 18.5, (g) => {
    // big rounded cast turret
    g.beginPath();
    g.ellipse(-2, 0, 10.5, 9, 0, 0, Math.PI * 2);
    finish(g, rgrad(g, -2, 0, 10.5, [[0, '#8a9258'], [0.7, '#5a6232'], [1, '#353a1c']]));
    circ(g, -5.5, -3.6, 2.6, rgrad(g, -5.5, -3.6, 2.6, [[0, '#8a9258'], [1, '#3a4020']]));
    box(g, -6, 2.5, 3, 2.6, 0.6, '#454c26');
    circ(g, -9.5, 4.5, 1.2, '#4a5228'); // DShK mount
    tacNumber(g, -7, -8.4, 3.8);
  }),
  P(13.5, 15.5, (g) => {
    // the very long 122 mm D-25T with its double-baffle brake
    box(g, 6.5, -1.3, 25, 2.6, 0.8, grad(g, 0, -1.3, 0, 1.3, [[0, '#626a3a'], [1, '#2a2e16']]));
    box(g, 28.5, -2, 3.2, 4, 0.6, '#262a16');
    box(g, 5.5, -3, 3.2, 6, 0.8, '#4a5228');
  }),
  P(18.5, 19.5, (g) => star(g, -3, 0, 2, RED)),
]);

/** Low-wing monoplane seen from above: wings across y, nose at +x, red stars on the wings. */
export function plane(o: {
  span: number; len: number; body: string[]; under?: string; armoured?: boolean; seats: number; german?: boolean;
  mark?: (g: Ctx, x: number, y: number, r: number) => void; spinner?: string; bomb?: boolean;
}): Part[] {
  const half = o.span / 2;
  return [
    P(2, 4, (g) => {
      // wings, slightly swept, with rounded tips
      g.beginPath();
      g.moveTo(3, -2.4);
      g.lineTo(-0.5, -half);
      g.quadraticCurveTo(-3.5, -half - 0.6, -4.8, -half + 1.5);
      g.lineTo(-4.5, -2.4);
      g.lineTo(-4.5, 2.4);
      g.lineTo(-4.8, half - 1.5);
      g.quadraticCurveTo(-3.5, half + 0.6, -0.5, half);
      g.lineTo(3, 2.4);
      g.closePath();
      finish(g, grad(g, 0, -half, 0, half, [[0, o.body[0]], [0.5, o.body[1]], [1, o.body[2]]]));
      line(g, [-1.5, -half + 2, -1.5, -3], 'rgba(0,0,0,0.25)'); // ailerons / flaps
      line(g, [-1.5, half - 2, -1.5, 3], 'rgba(0,0,0,0.25)');
      if (o.mark) {
        o.mark(g, -1.5, -half * 0.62, 2);
        o.mark(g, -1.5, half * 0.62, 2);
      } else if (o.german) {
        balkenkreuz(g, -1.5, -half * 0.62, 2);
        balkenkreuz(g, -1.5, half * 0.62, 2);
      } else {
        star(g, -1.5, -half * 0.62, 2, RED, 'rgba(255,255,255,0.7)');
        star(g, -1.5, half * 0.62, 2, RED, 'rgba(255,255,255,0.7)');
      }
    }),
    P(1.5, 5.5, (g) => {
      // fuselage and tailplane
      const L = o.len;
      poly(g, [-L + 2.5, -5, -L + 5, -5, -L + 6.5, -1, -L + 6.5, 1, -L + 5, 5, -L + 2.5, 5], grad(g, 0, -5, 0, 5, [[0, o.body[0]], [1, o.body[2]]]));
      g.beginPath();
      g.moveTo(L * 0.42, -1.6);
      g.quadraticCurveTo(L * 0.5, 0, L * 0.42, 1.6);
      g.lineTo(-L + 3, 0.9);
      g.lineTo(-L + 3, -0.9);
      g.closePath();
      finish(g, grad(g, 0, -2.4, 0, 2.4, [[0, o.body[0]], [0.5, o.body[1]], [1, o.body[2]]]));
      g.beginPath();
      g.ellipse(2, 0, L * 0.38, o.armoured ? 2.6 : 2.2, 0, 0, Math.PI * 2);
      finish(g, grad(g, 0, -2.6, 0, 2.6, [[0, o.body[0]], [0.5, o.body[1]], [1, o.body[2]]]));
      if (o.armoured) poly(g, [8, -2, 10.5, -1.4, 10.5, 1.4, 8, 2], '#4c5232', 'rgba(0,0,0,0.4)'); // armoured nose
      for (const s of [-1, 1]) box(g, 4, s * 1.6 - 0.25, 3, 0.5, 0.2, '#2a2a26', null); // exhausts
    }),
    P(0.5, 1.5, (g) => {
      if (o.bomb) box(g, -2, -1, 6, 2, 1, '#3a3a34'); // bomb under the belly
    }),
    P(5.5, 7, (g) => {
      // canopy
      const w = o.seats > 1 ? 6.5 : 3.6;
      g.beginPath();
      g.ellipse(-0.8 - (o.seats > 1 ? 1.2 : 0), 0, w / 2, 1.3, 0, 0, Math.PI * 2);
      finish(g, grad(g, -3, -1.3, 2, 1.3, [[0, '#dcecf0'], [0.5, '#6a8ea0'], [1, '#2a3e48']]), 'rgba(20,30,20,0.7)');
      if (o.seats > 1) line(g, [-2, -1.2, -2, 1.2], 'rgba(30,40,30,0.6)', 0.5);
    }),
    P(4, 4.5, (g) => {
      // spinning propeller disc
      g.beginPath();
      g.ellipse(o.len * 0.5 + 0.6, 0, 0.8, 5.5, 0, 0, Math.PI * 2);
      g.fillStyle = 'rgba(40,40,36,0.35)';
      g.fill();
      circ(g, o.len * 0.5 + 0.6, 0, 0.9, o.spinner ?? (o.german ? '#e8d040' : RED), null);
    }),
  ];
}
model('su_il2', 21, DIRS, plane({ span: 30, len: 20, body: ['#7f8a52', '#5c6634', '#3c4422'], armoured: true, seats: 2 }), false);
model('su_yak', 18, DIRS, plane({ span: 25, len: 18, body: ['#9aa2a6', '#6e787c', '#454c50'], seats: 1 }), false);

// ---------------------------------------------------------------- German emplacements

setModelSet('de');
//
// Emplacements stand in a 2×2 gun pit (the wbase models below). Their models start a little
// above the pit floor and aim along +x.

export const WD = 3;

/** Two-plate gun shield in the faction's paint, with a light top edge. */
export function shield(g: Ctx, x: number, w: number, d: number, paint = DG) {
  poly(g, [x, -w, x + d, -w * 0.4, x + d, w * 0.4, x, w], grad(g, x, -w, x + d, w, [[0, paint[0]], [1, paint[2]]]));
  line(g, [x + d, -w * 0.4, x + d, w * 0.4], 'rgba(0,0,0,0.4)');
}

/** mg42 emplacement (any faction's style). */
export type MgKind = 'mg42' | 'maxim' | 'm1919' | 'type92';
export function mgNest(S: Style, gun: MgKind = 'mg42'): Part[] {
  if (gun !== 'mg42') return mgNestOther(S, gun);
  return [
    P(WD, WD + 1.5, (g) => {
      // ammo boxes and spent belt
      box(g, -7, 4.5, 3.2, 2, 0.4, '#4a4c36');
      box(g, -3.6, 5, 3.2, 2, 0.4, '#4a4c36');
    }),
    ...prone(-1, -0.2, WD, S.uni, S.helm, S.hk),
    P(WD + 2, WD + 3.2, (g) => {
      // MG-42 on its tripod: perforated barrel jacket, butt, belt
      line(g, [3, 0, 0.5, -3.5], '#2a2a26', 0.7);
      line(g, [3, 0, 0.5, 3.5], '#2a2a26', 0.7);
      box(g, 1.2, -0.9, 3.5, 1.8, 0.5, '#2e2e2a');
      box(g, 4.5, -0.75, 7, 1.5, 0.5, '#3a3a36');
      for (let x = 5.2; x < 11; x += 1.1) circ(g, x, 0, 0.3, '#121210', null);
      box(g, 11.3, -0.45, 3.2, 0.9, 0.3, '#1c1c1a', null);
      line(g, [2.6, 0.9, 1, 3.6, -1.5, 4.6], '#b08a40', 0.8); // brass belt
    }),
    ...crew(-4.5, -5.5, 0.4, WD, S.uni, S.helm, S.hk),];
}

/** The Maxim on its wheeled Sokolov mount, the water-cooled Browning M1917/M1919, the Type 92 with its feed strips. */
function mgNestOther(S: Style, gun: MgKind): Part[] {
  const parts: Part[] = [
    P(WD, WD + 1.5, (g) => {
      box(g, -7, 4.5, 3.2, 2, 0.4, '#4a4c36'); // ammo boxes
      box(g, -3.6, 5, 3.2, 2, 0.4, '#4a4c36');
    }),
  ];
  if (gun === 'maxim') {
    parts.push(
      P(WD, WD + 3.5, (g) => {
        for (const s of [-1, 1]) box(g, -1.5, s * 4.4 - 1, 4, 2, 0.9, '#1b1b19'); // Sokolov wheels
        box(g, -5, -0.7, 6, 1.4, 0.4, '#3a3c2a'); // trail
      }),
      P(WD + 3, WD + 6.5, (g) => {
        poly(g, [3.5, -4, 4.5, -4, 4.5, 4, 3.5, 4], grad(g, 3.5, -4, 4.5, 4, [[0, S.paint[0]], [1, S.paint[2]]])); // shield
        box(g, -1, -1.6, 4.5, 3.2, 0.6, '#2e2e2a'); // receiver
        box(g, 3.5, -1.3, 7.5, 2.6, 1.2, grad(g, 0, -1.3, 0, 1.3, [[0, '#6a6c5a'], [1, '#2e3026']])); // fat water jacket
        box(g, 11, -0.4, 2.5, 0.8, 0.3, '#151513', null);
        circ(g, 5.5, -1.6, 0.7, '#4a4c40', null); // filler cap
      }),
      ...crew(-4, -1.5, 0, WD, S.uni, S.helm, S.hk),
      ...crew(-4, 5, 0.4, WD - 1, S.uni, S.helm, S.hk),
    );
  } else if (gun === 'm1919') {
    parts.push(
      ...prone(-1, -0.2, WD, S.uni, S.helm, S.hk),
      P(WD + 2, WD + 3.2, (g) => {
        line(g, [2.5, 0, 0, -3.5], '#2a2a26', 0.7); // low tripod
        line(g, [2.5, 0, 0, 3.5], '#2a2a26', 0.7);
        box(g, 1, -1.1, 4.5, 2.2, 0.5, '#2e2e2a');
        box(g, 5.2, -0.8, 6.5, 1.6, 0.6, '#3a3a36'); // perforated cooling jacket
        for (let x = 5.8; x < 11.2; x += 1.2) circ(g, x, 0, 0.35, '#121210', null);
        box(g, 11.6, -0.35, 2.5, 0.7, 0.3, '#1c1c1a', null);
        line(g, [2.8, 1.1, 1.4, 3.8, -1, 4.6], '#9a7a3a', 0.8);
      }),
      ...crew(-4.5, -5.5, 0.4, WD, S.uni, S.helm, S.hk),
    );
  } else {
    parts.push(
      ...prone(-1.5, -0.2, WD, S.uni, S.helm, S.hk),
      P(WD + 2, WD + 3.4, (g) => {
        line(g, [3, 0, 0, -3.8], '#2a2a26', 0.8); // tripod with carrying poles
        line(g, [3, 0, 0, 3.8], '#2a2a26', 0.8);
        line(g, [3, 0, -2.5, 0], '#2a2a26', 0.8);
        box(g, 1, -1, 4, 2, 0.5, '#2e2e2a');
        box(g, 5, -0.9, 6, 1.8, 0.4, '#3a3a36'); // finned barrel
        for (let x = 5.4; x < 10.8; x += 0.7) line(g, [x, -1.1, x, 1.1], 'rgba(0,0,0,0.45)', 0.35);
        box(g, 11, -0.4, 3, 0.8, 0.3, '#1c1c1a', null);
        box(g, 0.5, 1, 3.5, 1.2, 0.2, '#b08a40', null); // feed strip
      }),
      ...crew(-4.5, -5.5, 0.4, WD, S.uni, S.helm, S.hk),
    );
  }
  return parts;
}

/** flak38 emplacement (any faction's style). */
export function lightAA(S: Style): Part[] {
  return [
    P(WD, WD + 1.5, (g) => {
      // cruciform platform
      box(g, -13, -1.4, 26, 2.8, 0.6, '#4a4c40');
      box(g, -1.4, -13, 2.8, 26, 0.6, '#4a4c40');
      circ(g, 0, 0, 6.5, grad(g, -6, -6, 6, 6, [[0, '#6a6c5c'], [1, '#3e4036']]));
    }),
    P(WD + 1.5, WD + 6, (g) => {
      circ(g, 0, 0, 4, grad(g, -4, -4, 4, 4, [[0, S.uni[0]], [1, S.uni[2]]]));
      box(g, -6, -3, 4, 6, 1, '#55584c'); // gunner's seat
      shield(g, 3.5, 6.5, 1.6, S.paint);
    }),
    P(WD + 5, WD + 6.5, (g) => {
      box(g, 1, -1.1, 5, 2.2, 0.5, '#2e302a');
      box(g, 5.5, -0.6, 12, 1.2, 0.4, '#1e1e1c');
      box(g, 16.5, -0.9, 2, 1.8, 0.3, '#121210', null); // flash hider
      box(g, 2, 1.1, 2, 2.6, 0.3, '#3a3a34'); // magazine
    }),
    ...crew(-5, 0, 0, WD + 1.5, S.uni, S.helm, S.hk),];
}

/** schreck emplacement (any faction's style). */
export function atTeam(S: Style): Part[] {
  return [
    ...crew(-1, -2.5, 0, WD, S.uni, S.helm, S.hk),
    ...crew(-3.5, 4, 0.5, WD - 1, S.uni, S.helm, S.hk), // loader, crouched
    P(WD + 5, WD + 6.5, (g) => {
      // the 8.8 cm tube over the gunner's shoulder, with its blast shield
      box(g, -9, -3.6, 21, 2.2, 1, grad(g, 0, -3.6, 0, -1.4, [[0, '#7a7a5a'], [1, '#3e3e2c']]));
      box(g, 2, -5.2, 3.2, 5.4, 0.5, '#5a5c48');
      circ(g, -9, -2.5, 1.1, '#1a1a18', null);
    }),
    P(WD, WD + 2, (g) => {
      box(g, -8, 3, 4, 2, 0.5, '#4a4630'); // rocket case
      box(g, -6, 6, 6, 1.2, 0.5, '#6a5a3a'); // spare rocket
    }),];
}

/** sniper emplacement (any faction's style). */
export function sniperPit(_S: Style): Part[] {
  return [
    P(WD, WD + 1.2, (g) => {
      // ghillie: ragged foliage over the prone shape
      const rng = new Rng(7);
      for (let k = 0; k < 9; k++) circ(g, rng.range(-9, 2), rng.range(-3.5, 3.5), rng.range(1.2, 2.2), k % 2 ? '#5a6a34' : '#6e7a40', null);
    }),
    ...prone(0, 0, WD, ['#7a8a50', '#5c6a36', '#3e4a24'], '#4e5a32'),
    P(WD + 2.2, WD + 3, (g) => {
      box(g, -1, 1.2, 13, 0.9, 0.4, '#5a3c22', null);
      box(g, 7, 1.3, 6.5, 0.7, 0.3, BLACK, null);
      box(g, 2.5, 0.6, 4, 0.9, 0.4, '#101010', null); // scope
    }),];
}

/** flamer emplacement (any faction's style). */
export function flamerTeam(S: Style): Part[] {
  return [
    ...crew(0, 0, 0, WD, S.uni, S.helm, S.hk),
    P(WD + 2, WD + 6.5, (g) => {
      // fuel and pressure tanks on the back
      circ(g, -4.2, -1.6, 1.7, grad(g, -6, -3, -2, 0, [[0, '#7a7a5a'], [1, '#3a3a2a']]));
      circ(g, -4.2, 1.6, 1.7, grad(g, -6, 0, -2, 3, [[0, '#7a7a5a'], [1, '#3a3a2a']]));
      circ(g, -5.8, 0, 1, '#5a5a44');
    }),
    P(WD + 3.5, WD + 4.5, (g) => {
      box(g, 1, 1, 8, 1.1, 0.4, '#2e2e2a');
      circ(g, 9.2, 1.55, 0.7, '#ff9a3a', null); // pilot flame
      line(g, [-3.5, 2.2, 0, 2.6, 1.5, 1.6], '#1a1a18', 0.6);
    }),];
}

/** Split-trail anti-tank gun: trails, wheels, double shield, long barrel with a muzzle brake. */
export function atGun(S: Style, o: { barrel: number; shieldW: number; brake: boolean; wheelY: number }): Part[] {
  return [
    P(WD, WD + 1.5, (g) => {
      // split trails spread behind the gun
      poly(g, [-1, -1.5, -15, -9, -16, -7.5, -2, 0], grad(g, -16, -9, 0, 0, [[0, S.paint[1]], [1, S.paint[2]]]));
      poly(g, [-1, 1.5, -15, 9, -16, 7.5, -2, 0], grad(g, -16, 0, 0, 9, [[0, S.paint[1]], [1, S.paint[2]]]));
      box(g, -17, -9.5, 2.5, 2.5, 0.5, '#3a3628'); // spades
      box(g, -17, 7, 2.5, 2.5, 0.5, '#3a3628');
    }),
    P(WD, WD + 5, (g) => {
      for (const s of [-1, 1]) {
        box(g, -3, s * o.wheelY - 1.5, 6, 3, 1.2, '#1b1b19');
        circ(g, 0, s * o.wheelY, 1.1, S.paint[2], null);
      }
    }),
    P(WD + 2, WD + 7.5, (g) => {
      shield(g, 1, o.shieldW, 2, S.paint);
      camo(g, () => poly(g, [1, -o.shieldW, 3, -o.shieldW * 0.4, 3, o.shieldW * 0.4, 1, o.shieldW], 'rgba(0,0,0,0)', null), S.camo, 33, 4, 2.5, o.shieldW);
      box(g, -4, -2, 5, 4, 0.8, '#6a5c3a'); // cradle
    }),
    P(WD + 4.5, WD + 6, (g) => {
      box(g, 1, -1, o.barrel, 2, 0.6, grad(g, 0, -1, 0, 1, [[0, S.paint[1]], [1, '#5a4c30']]));
      if (o.brake) box(g, 1 + o.barrel - 2, -1.6, 3, 3.2, 0.5, '#4a4030');
    }),
    ...crew(-6, -4.5, 0.2, WD, S.uni, S.helm, S.hk),
    ...crew(-7, 4.5, -0.3, WD, S.uni, S.helm, S.hk),
  ];
}


/** flak88 emplacement (any faction's style). */
export function heavyAA(S: Style): Part[] {
  return [
    P(WD, WD + 1.5, (g) => {
      // cruciform carriage with four outriggers and levelling jacks
      box(g, -18, -2, 36, 4, 0.8, grad(g, -18, -2, 18, 2, [[0, S.paint[1]], [1, S.paint[2]]]));
      box(g, -2, -18, 4, 36, 0.8, grad(g, -2, -18, 2, 18, [[0, S.paint[1]], [1, S.paint[2]]]));
      for (const [x, y] of [[-17, 0], [17, 0], [0, -17], [0, 17]]) circ(g, x, y, 1.8, '#3a3628');
    }),
    P(WD + 1.5, WD + 6, (g) => {
      circ(g, 0, 0, 5.5, grad(g, -5, -5, 5, 5, [[0, S.paint[0]], [1, S.paint[2]]]));
      shield(g, 3, 9, 2.2, S.paint);
      camo(g, () => circ(g, 0, 0, 5.5, 'rgba(0,0,0,0)', null), S.camo, 88, 3, 2.5, 5);
    }),
    P(WD + 5, WD + 8, (g) => {
      box(g, -9, -2, 14, 4, 1, grad(g, 0, -2, 0, 2, [[0, '#a89464'], [1, '#6a5a38']])); // recoil housing
      box(g, -11, -3, 4, 6, 0.8, '#6a5c3a'); // equilibrators
      box(g, 5, -1.1, 22, 2.2, 0.6, grad(g, 0, -1, 0, 1, [[0, S.paint[1]], [1, '#5a4c30']]));
      for (let k = 0; k < 4; k++) line(g, [-6 + k * 2.5, -2, -6 + k * 2.5, 2], 'rgba(0,0,0,0.25)');
    }),
    P(WD + 8, WD + 8.8, (g) => {
      // kill rings painted on the barrel
      for (let k = 0; k < 5; k++) line(g, [9 + k * 1.1, -1.1, 9 + k * 1.1, 1.1], 'rgba(245,245,240,0.85)', 0.5);
    }),
    ...crew(-8, -8, 0.6, WD + 1, S.uni, S.helm, S.hk),
    ...crew(-8, 8, -0.6, WD + 1, S.uni, S.helm, S.hk),];
}

model('w_tiger', 25, DIRS, [
  P(WD, WD + 2.5, (g) => {
    // the hull deck, flush with the earth of the pit
    box(g, -16, -10.5, 30, 21, 1.5, grad(g, -16, -10, 14, 10, [[0, DG[1]], [1, DG[2]]]));
    camo(g, () => box(g, -16, -10.5, 30, 21, 1.5, 'rgba(0,0,0,0)', null), DG_CAMO, 41, 9, 4.5, 15);
    for (let x = -15; x < -9; x += 1) line(g, [x, -6, x, 6], 'rgba(0,0,0,0.3)');
  }),
  P(WD + 2.5, WD + 9, (g) => {
    // horseshoe turret
    g.beginPath();
    g.moveTo(6, -8.5);
    g.lineTo(-4, -9);
    g.quadraticCurveTo(-11.5, -9, -11.5, 0);
    g.quadraticCurveTo(-11.5, 9, -4, 9);
    g.lineTo(6, 8.5);
    g.closePath();
    finish(g, grad(g, -11, -9, 6, 9, [[0, DG[0]], [1, DG[2]]]));
    camo(g, () => box(g, -11.5, -9, 17.5, 18, 6, 'rgba(0,0,0,0)', null), DG_CAMO, 17, 7, 3.5, 10);
    circ(g, -7, -4.4, 2.6, rgrad(g, -7, -4.4, 2.6, [[0, '#c8b47a'], [1, '#6e5e3a']])); // commander's cupola
    circ(g, -2, 4, 1.7, '#7a6a44');
    // Balkenkreuz on the turret side
    box(g, -4.5, 7.7, 4, 1.2, 0.2, '#f0f0e8', null);
    box(g, -3.3, 7.2, 1.6, 2.2, 0.2, '#f0f0e8', null);
    box(g, -4, 7.95, 3, 0.7, 0.1, BLACK, null);
    box(g, -2.85, 7.5, 0.7, 1.6, 0.1, BLACK, null);
    line(g, [6, -8.5, 6, 8.5], 'rgba(0,0,0,0.35)');
  }),
  P(WD + 5, WD + 7, (g) => {
    box(g, 5.5, -3.5, 3.5, 7, 1, '#9a8656'); // mantlet
    box(g, 8.5, -1.2, 21, 2.4, 0.7, grad(g, 0, -1.2, 0, 1.2, [[0, DG[1]], [1, '#5a4c30']]));
    box(g, 27.5, -1.8, 3.2, 3.6, 0.6, '#4a4030'); // muzzle brake
  }),
]);

/** bunker emplacement (any faction's style). */
export function pillbox(_S: Style): Part[] {
  return [
    P(WD, WD + 7, (g) => {
      // a Tobruk-style concrete pillbox: rounded block with two embrasures facing +x
      const pts = [-13, -11, 6, -11, 13, -5, 13, 5, 6, 11, -13, 11];
      poly(g, pts, grad(g, -13, -11, 13, 11, [[0, '#a8a69a'], [1, '#5e5c54']]));
      const rng = new Rng(3);
      for (let k = 0; k < 12; k++) circ(g, rng.range(-12, 11), rng.range(-10, 10), rng.range(0.4, 1.2), 'rgba(60,58,50,0.25)', null);
    }),
    P(WD + 3.5, WD + 5, (g) => {
      for (const y of [-4.5, 4.5]) {
        box(g, 9.5, y - 1.3, 3.8, 2.6, 0.5, '#151512');
        box(g, 11, y - 0.4, 6, 0.8, 0.3, '#2a2a26', null);
      }
    }),
    P(WD + 7, WD + 8.5, (g) => {
      // earth and turf thrown over the roof
      g.beginPath();
      g.ellipse(-2, 0, 9.5, 8.5, 0, 0, Math.PI * 2);
      finish(g, rgrad(g, -2, 0, 9.5, [[0, '#7c8a48'], [0.7, '#5c6a34'], [1, '#4a5228']]), 'rgba(0,0,0,0.3)');
      circ(g, -6, 0, 2.6, '#2a2a24'); // rear hatch
    }),];
}

/** mortar emplacement (any faction's style). */
export function mortarPit(S: Style): Part[] {
  return [
    P(WD, WD + 1, (g) => {
      box(g, -3, -3, 6, 6, 1, '#3a3c34'); // base plate
      box(g, -8, 4, 4, 3, 0.5, '#4a4630'); // bomb crates
      box(g, -8, -7, 4, 3, 0.5, '#4a4630');
    }),
    P(WD + 1, WD + 7, (g) => {
      // the tube leaning forward on its bipod
      line(g, [5, -3, 4, 0], '#2a2a26', 0.7);
      line(g, [5, 3, 4, 0], '#2a2a26', 0.7);
    }),
    P(WD + 1, WD + 9, (g, z) => {
      const k = (z - WD - 1) / 8;
      circ(g, k * 4.5, 0, 1.2, '#3a3c36');
    }, true),
    ...crew(-4, -4, 0.3, WD, S.uni, S.helm, S.hk),
    ...crew(-4.5, 5, -0.6, WD - 1, S.uni, S.helm, S.hk),];
}

/** lefh18 emplacement (any faction's style). */
export function howitzer(S: Style): Part[] {
  return [
    ...atGun(S, { barrel: 15, shieldW: 9.5, brake: true, wheelY: 9.5 }).slice(0, 3),
    P(WD + 4, WD + 7, (g) => {
      // short, thick howitzer barrel over a long recuperator
      box(g, -6, -1.8, 10, 3.6, 0.8, '#7a6a44');
      box(g, 2, -1.6, 15, 3.2, 1, grad(g, 0, -1.6, 0, 1.6, [[0, S.paint[1]], [1, '#5a4c30']]));
      box(g, 16, -2.1, 2.8, 4.2, 0.6, '#4a4030');
    }),
    ...crew(-7, -5, 0.2, WD, S.uni, S.helm, S.hk),
    ...crew(-8, 5, -0.4, WD, S.uni, S.helm, S.hk),
    ...crew(-12, 0, 0, WD, S.uni, S.helm, S.hk),];
}

/** nebel emplacement (any faction's style). */
export function rocketBattery(S: Style): Part[] {
  return [
    P(WD, WD + 4, (g) => {
      poly(g, [-2, -1.2, -15, -1, -15, 1, -2, 1.2], S.paint[2]); // single trail
      for (const s of [-1, 1]) box(g, -3, s * 8.5 - 1.5, 6, 3, 1.2, '#1b1b19');
      box(g, -2, -8, 4, 16, 0.6, '#5a4c30'); // axle
    }),
    P(WD + 3, WD + 8, (g) => {
      // six barrels in a hexagonal cluster
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
        const y = Math.sin(a) * 4;
        const zz = Math.cos(a) * 1.5;
        box(g, -6 + zz, y - 1.5, 17, 3, 1.4, grad(g, 0, y - 1.5, 0, y + 1.5, [[0, '#8a7a50'], [1, '#4a4030']]));
        circ(g, 11 + zz, y, 1.2, '#141410', null);
      }
      box(g, 2, -6, 1.2, 12, 0.4, '#3a3428'); // retaining band
    }),
    ...crew(-9, -6, 0.5, WD, S.uni, S.helm, S.hk),];
}

/** depot emplacement (any faction's style). */
export function depot(_S: Style): Part[] {
  return [
    P(WD - 1, WD + 3, (g) => {
      // fuel drums and crates under a tarpaulin
      for (const [x, y] of [[-10, -9], [-6, -9], [-10, -5], [-6, -5]]) circ(g, x, y, 1.9, grad(g, x - 2, y - 2, x + 2, y + 2, [[0, '#6a7052'], [1, '#383c2a']]));
      for (const [x, y, w, h] of [[2, -11, 8, 5], [2, -5, 8, 5], [-12, 2, 7, 6]]) {
        box(g, x, y, w, h, 0.6, grad(g, x, y, x + w, y + h, [[0, '#a08a5a'], [1, '#5c4c30']]));
        line(g, [x, y + h / 2, x + w, y + h / 2], 'rgba(0,0,0,0.3)');
      }
    }),
    P(WD, WD + 6, (g) => {
      g.beginPath();
      g.moveTo(-3, 0);
      g.lineTo(12, -1);
      g.lineTo(13, 12);
      g.lineTo(-2, 12);
      g.closePath();
      finish(g, grad(g, -3, 0, 13, 12, [[0, '#7a7e5a'], [1, '#4a4c34']]));
      line(g, [5, -0.5, 5.5, 12], 'rgba(0,0,0,0.3)');
    }),
    P(WD + 3, WD + 4.5, (g) => {
      for (const x of [-6, -3, 0]) box(g, x, 13, 2.2, 3.5, 0.5, '#5a5e3c'); // jerrycans
    }),];
}

/** observer emplacement (any faction's style). */
export function observer(S: Style): Part[] {
  return [
    P(WD, WD + 1, (g) => box(g, -6, -5, 12, 10, 1, '#4a4630')), // log-lined dugout floor
    ...crew(-3, 0, 0, WD, S.uni, S.helm, S.hk),
    P(WD + 5, WD + 10, (g) => {
      // scissors periscope on its tripod: two tubes spread in a V
      line(g, [0, 0, 6, -4.5], '#3a3c34', 1.2);
      line(g, [0, 0, 6, 4.5], '#3a3c34', 1.2);
    }),
    P(WD + 10, WD + 11, (g) => {
      circ(g, 6, -4.5, 1, '#9ac0d0', null);
      circ(g, 6, 4.5, 1, '#9ac0d0', null);
    }),];
}

/** hq emplacement (any faction's style). */
export function hq(S: Style): Part[] {
  return [
    P(WD - 1, WD + 5, (g) => {
      // a dug-in command tent
      poly(g, [-12, -9, 6, -9, 9, 0, 6, 9, -12, 9], grad(g, -12, -9, 9, 9, [[0, '#8a8a68'], [1, '#4a4a36']]));
      line(g, [-12, 0, 9, 0], 'rgba(0,0,0,0.35)', 0.8);
    }),
    P(WD, WD + 4, (g) => {
      box(g, 9, 5, 7, 5, 0.6, '#6a4c2c'); // map table
      box(g, 9.8, 5.8, 5.4, 3.4, 0.3, '#e8e0c8', null);
      box(g, 9, -11, 6, 4, 0.6, '#4a4c40'); // field radio
    }),
    ...crew(14, -1, Math.PI, WD, S.uni, S.helm, S.hk),
    P(WD, WD + 22, (g) => circ(g, 12, -9, 0.4, '#1a1a18', null)), // radio mast
    P(WD, WD + 16, (g) => circ(g, -14, 12, 0.5, '#3a3020', null)), // flag pole
    P(WD + 16, WD + 17, (g) => {
      // war flag
      S.flag(g, -14, 12);
    }),];
}

export function swastika(g: Ctx, x: number, y: number, r: number) {
  // a cross whose arms each bend a quarter turn clockwise, stood on its corner
  const w = r * 0.34;
  g.save();
  g.translate(x, y);
  g.rotate(Math.PI / 4);
  g.fillStyle = BLACK;
  g.fillRect(-r, -w / 2, 2 * r, w);
  g.fillRect(-w / 2, -r, w, 2 * r);
  g.fillRect(-w / 2, -r, r + w / 2, w);
  g.fillRect(r - w, -w / 2, w, r + w / 2);
  g.fillRect(-r, r - w, r + w / 2, w);
  g.fillRect(-r, -r, w, r + w / 2);
  g.restore();
}

export function balkenkreuz(g: Ctx, x: number, y: number, r: number) {
  box(g, x - r, y - r * 0.32, 2 * r, r * 0.64, 0.1, '#f0f0e8', null);
  box(g, x - r * 0.32, y - r, r * 0.64, 2 * r, 0.1, '#f0f0e8', null);
  box(g, x - r * 0.85, y - r * 0.17, 1.7 * r, r * 0.34, 0.1, BLACK, null);
  box(g, x - r * 0.17, y - r * 0.85, r * 0.34, 1.7 * r, 0.1, BLACK, null);
}

model('w_stuka', 23, 1, [
  P(WD - 1, WD, (g) => box(g, -19, -19, 38, 38, 2, '#7a7460')), // hardstand
  P(WD + 2, WD + 4, (g) => {
    // inverted gull wings
    const half = 20;
    g.beginPath();
    g.moveTo(5, -2.5);
    g.lineTo(3, -half * 0.45);
    g.lineTo(2.5, -half);
    g.lineTo(-3.5, -half + 0.5);
    g.lineTo(-3, -half * 0.45);
    g.lineTo(-4, -2.5);
    g.lineTo(-4, 2.5);
    g.lineTo(-3, half * 0.45);
    g.lineTo(-3.5, half - 0.5);
    g.lineTo(2.5, half);
    g.lineTo(3, half * 0.45);
    g.lineTo(5, 2.5);
    g.closePath();
    finish(g, grad(g, 0, -half, 0, half, [[0, '#6a7458'], [0.5, '#4e5840'], [1, '#3a422e']]));
    line(g, [3, -half * 0.45, -3, -half * 0.45], 'rgba(0,0,0,0.3)');
    line(g, [3, half * 0.45, -3, half * 0.45], 'rgba(0,0,0,0.3)');
    balkenkreuz(g, -0.5, -half * 0.72, 2.6);
    balkenkreuz(g, -0.5, half * 0.72, 2.6);
  }),
  P(WD, WD + 3, (g) => {
    // spatted landing gear
    for (const s of [-1, 1]) {
      g.beginPath();
      g.ellipse(3.5, s * 7.5, 2.2, 1.2, 0, 0, Math.PI * 2);
      finish(g, '#4e5840');
    }
  }),
  P(WD + 2, WD + 6, (g) => {
    // fuselage and tailplane
    poly(g, [-14.5, -6, -12, -6, -10.5, -1, -10.5, 1, -12, 6, -14.5, 6], '#4e5840');
    g.beginPath();
    g.moveTo(10, -2);
    g.quadraticCurveTo(12, 0, 10, 2);
    g.lineTo(-14, 1);
    g.lineTo(-14, -1);
    g.closePath();
    finish(g, grad(g, 0, -2, 0, 2, [[0, '#76805e'], [0.5, '#56604a'], [1, '#3a422e']]));
    box(g, 9, -2.6, 2.5, 5.2, 0.6, '#ffd84a'); // yellow nose band
    g.beginPath();
    g.ellipse(0, 0, 4, 1.3, 0, 0, Math.PI * 2);
    finish(g, grad(g, -4, -1.3, 4, 1.3, [[0, '#dcecf0'], [0.5, '#6a8ea0'], [1, '#2a3e48']]), 'rgba(20,30,20,0.7)');
    box(g, -1, 4, 5, 1.4, 0.6, '#3a3a34'); // bomb on the crutch
  }),
  P(WD + 6, WD + 9, (g) => {
    // tail fin with the swastika
    box(g, -14.5, -0.5, 4.5, 1, 0.3, '#56604a');
  }),
  P(WD + 9, WD + 9.6, (g) => {
    box(g, -14.8, -1.6, 4.4, 3.2, 0.4, '#56604a', null);
    swastika(g, -12.6, 0, 1.2);
  }),
  P(WD + 4, WD + 4.5, (g) => {
    g.beginPath();
    g.ellipse(12, 0, 0.7, 5.5, 0, 0, Math.PI * 2);
    g.fillStyle = 'rgba(40,40,36,0.4)';
    g.fill();
  }),
]);

/** workshop emplacement (any faction's style). */
export function workshop(S: Style): Part[] {
  return [
    P(WD - 1, WD + 1, (g) => {
      box(g, -13, -12, 26, 24, 1.5, '#5a5440'); // packed-earth yard
      for (const [x, y] of [[-10, 8], [-6.5, 9]]) circ(g, x, y, 1.8, grad(g, x - 2, y - 2, x + 2, y + 2, [[0, '#6a7052'], [1, '#383c2a']]));
    }),
    P(WD + 1, WD + 7, (g) => {
      // an Opel Blitz with its bonnet open
      box(g, -11, -9, 15, 9, 1, grad(g, -11, -9, 4, 0, [[0, S.uni[0]], [1, S.uni[2]]]));
      box(g, 4, -8.5, 6, 8, 1, grad(g, 4, -8.5, 10, -0.5, [[0, '#757b6b'], [1, '#4a4e40']]));
      line(g, [-4, -9, -4, 0], 'rgba(0,0,0,0.35)');
    }),
    P(WD + 1, WD + 13, (g) => {
      // gantry crane lifting an engine
      line(g, [-2, 3, -2, 11], '#4a4030', 1.4);
      line(g, [10, 3, 10, 11], '#4a4030', 1.4);
    }),
    P(WD + 13, WD + 14, (g) => {
      line(g, [-2, 7, 10, 7], '#5a4c34', 1.6);
      line(g, [4, 7, 4, 9], '#222', 0.4);
    }),
    P(WD + 5, WD + 8, (g) => box(g, 1.5, 7.5, 5, 4, 0.8, '#3a3a36')), // engine block
    ...crew(-7, 4, 1.2, WD, S.uni, S.helm, S.hk),
    P(WD, WD + 1, (g) => {
      // tool chest
      box(g, 6, -12, 6, 2.6, 0.4, '#8a2a1e');
    }),];
}

setModelSet('ww2');
/** Rubble of a knocked-out emplacement: burst sandbags, splintered timber, a twisted barrel. */
model('w_rubble', 20, 1, (() => {
  const rng = new Rng(17);
  const bits = Array.from({ length: 22 }, () => ({
    x: rng.range(-15, 15), y: rng.range(-15, 15), w: rng.range(2.5, 6), h: rng.range(1.8, 3.6), a: rng.range(0, Math.PI), k: rng.int(3),
  }));
  return [
    P(0, 1, (g) => {
      g.beginPath();
      g.ellipse(0, 0, 18, 16, 0, 0, Math.PI * 2);
      g.fillStyle = 'rgba(30,26,22,0.75)'; // scorched ground
      g.fill();
    }),
    P(1, 4, (g) => {
      for (const b of bits) {
        g.save();
        g.translate(b.x, b.y);
        g.rotate(b.a);
        const col = b.k === 0 ? ['#a8946a', '#6a5a3e'] : b.k === 1 ? ['#8c8a82', '#56544e'] : ['#6a4a2a', '#3a2814'];
        box(g, -b.w / 2, -b.h / 2, b.w, b.h, b.k === 0 ? 1 : 0.3, grad(g, 0, -b.h / 2, 0, b.h / 2, [[0, col[0]], [1, col[1]]]));
        g.restore();
      }
    }),
    P(3, 5, (g) => {
      line(g, [-6, 4, 3, -1, 9, -6], '#2a2a26', 1.4); // bent barrel
      line(g, [-10, -6, -2, -10], '#4a3420', 1.2); // splintered beam
      for (const [x, y] of [[4, 6], [-8, 2], [10, 8]]) circ(g, x, y, 1.1, 'rgba(255,120,40,0.85)', null); // embers
    }),
  ];
})());
setModelSet('de');

/** V-2 on its firing table, the Meillerwagen trailer lowered beside it, a fuel bowser behind. */
model('w_v2', 23, 1, [
  P(WD - 1, WD + 1, (g) => {
    box(g, -15, -15, 30, 30, 2, '#6a665a'); // concrete pad
    for (let k = -15; k < 15; k += 6) line(g, [k, -15, k, 15], 'rgba(0,0,0,0.15)');
    circ(g, 0, 0, 7, 'rgba(20,18,16,0.6)', null); // blast scorch
  }),
  P(WD + 1, WD + 4, (g) => {
    box(g, -12, 9, 18, 5, 1, grad(g, -12, 9, 6, 14, [[0, FG[0]], [1, FG[2]]])); // fuel bowser
    line(g, [-12, -9, 10, -9], '#3a3a32', 1.6); // Meillerwagen
    line(g, [-12, -6, 10, -6], '#3a3a32', 1.6);
  }),
  P(WD + 1, WD + 3, (g) => {
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      poly(g, [Math.cos(a) * 2, Math.sin(a) * 2, Math.cos(a) * 6.5, Math.sin(a) * 6.5, Math.cos(a + 0.35) * 5, Math.sin(a + 0.35) * 5], '#2a2a26'); // fins on the table
    }
  }),
  P(WD + 3, WD + 30, (g, z) => {
    // the rocket standing upright: black and white quarters, tapering to the warhead
    const f = (z - WD - 3) / 27;
    const r = f < 0.75 ? 3.4 : 3.4 * (1 - (f - 0.75) / 0.25) + 0.3;
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    finish(g, '#e8e6dc', null);
    for (let k = 0; k < 4; k += 2) {
      g.beginPath();
      g.moveTo(0, 0);
      g.arc(0, 0, r, (k * Math.PI) / 2 + (f > 0.4 ? Math.PI / 2 : 0), ((k + 1) * Math.PI) / 2 + (f > 0.4 ? Math.PI / 2 : 0));
      g.closePath();
      g.fillStyle = '#1e1e1c';
      g.fill();
    }
  }, true),
  ...crew(9, 3, 3, WD, FG),
  ...crew(-9, 2, 0.4, WD, FG),
]);

/** barracks emplacement (any faction's style). */
export function barracks(S: Style): Part[] {
  return [
    P(WD - 1, WD + 1, (g) => box(g, -15, -15, 30, 30, 1.5, '#5e5844')), // trodden earth
    P(WD + 1, WD + 9, (g) => {
      // a timber hut with a pitched felt roof
      box(g, -13, -10, 22, 14, 0.6, grad(g, -13, -10, 9, 4, [[0, '#4a4438'], [1, '#2a2620']]));
      line(g, [-13, -3, 9, -3], 'rgba(255,255,255,0.12)', 0.8);
      for (let x = -11; x < 9; x += 3) line(g, [x, -10, x, 4], 'rgba(0,0,0,0.25)', 0.4);
    }),
    P(WD + 1, WD + 3, (g) => {
      for (let k = 0; k < 4; k++) box(g, -12 + k * 5, 8, 4, 5, 1.2, grad(g, 0, 8, 0, 13, [[0, '#b8a47a'], [1, '#7a6a48']])); // sandbags
      line(g, [11, -12, 11, 12], '#3a2c1c', 1); // flagpole shadow
    }),
    P(WD + 3, WD + 16, (g) => line(g, [11, 6, 11, 6.2], '#4a3a24', 1.2), true),
    P(WD + 15, WD + 16, (g) => box(g, 11, 4, 6, 4, 0.2, '#c42a1e', null)), // pennant
    ...crew(-2, 9, 0, WD, S.uni, S.helm, S.hk),
    ...crew(4, 10, -0.6, WD, S.uni, S.helm, S.hk),];
}

/** motorpool emplacement (any faction's style). */
export function motorpool(_S: Style): Part[] {
  return [
    P(WD - 1, WD + 1, (g) => {
      box(g, -17, -17, 34, 34, 2, '#6a665a'); // concrete apron
      for (let k = -17; k < 17; k += 6) line(g, [-17, k, 17, k], 'rgba(0,0,0,0.15)');
    }),
    P(WD + 1, WD + 12, (g) => {
      // open-fronted hangar with a camouflage net roof
      box(g, -16, -15, 32, 3, 0.4, '#3a3a32');
      box(g, -16, -15, 3, 22, 0.4, '#3a3a32');
      box(g, 13, -15, 3, 22, 0.4, '#3a3a32');
    }),
    P(WD + 12, WD + 13, (g) => {
      box(g, -16, -15, 32, 22, 1, 'rgba(90,100,60,0.85)');
      camo(g, () => box(g, -16, -15, 32, 22, 1, 'rgba(0,0,0,0)', null), ['rgba(60,70,40,0.6)', 'rgba(130,120,70,0.5)'], 77, 10, 4, 16);
    }),
    P(WD + 1, WD + 4, (g) => {
      // a spare Maybach engine and a stack of road wheels
      box(g, -10, 10, 7, 5, 0.6, '#3a3a36');
      for (let k = 0; k < 3; k++) circ(g, 6 + k * 3.5, 12.5, 1.6, '#2a2a26');
    }),];
}

/** airfield emplacement (any faction's style). */
export function airfield(S: Style): Part[] {
  return [
    P(WD - 1, WD, (g) => {
      box(g, -19, -19, 38, 38, 2, '#7a7460'); // grass strip
      for (let k = -16; k < 16; k += 6) box(g, k, -1, 3, 2, 0.3, 'rgba(240,240,230,0.6)', null);
    }),
    P(WD, WD + 4, (g) => {
      // Fw 190 parked, wings spread, nose up
      g.save();
      g.rotate(-Math.PI / 2);
      box(g, -3, -11, 6, 22, 1.5, grad(g, -3, -11, 3, 11, [[0, S.plane[0]], [1, S.plane[2]]]));
      box(g, -10, -1.5, 14, 3, 1.4, grad(g, -10, -1.5, 4, 1.5, [[0, S.plane[1]], [1, S.plane[2]]]));
      circ(g, 4.4, 0, 1.6, '#e8d040', null);
      g.restore();
      S.mark(g, -6, -2, 1.6);
      S.mark(g, 6, -2, 1.6);
    }),
    P(WD, WD + 3, (g) => {
      box(g, 9, 10, 8, 6, 1, '#4a4c3a'); // fuel bowser
      for (const [x, y] of [[-14, 12], [-11, 14]]) circ(g, x, y, 1.6, '#3a3c2c');
    }),
    ...crew(-8, 8, 0.4, WD, S.uni, S.helm, S.hk),];
}


// ---------------------------------------------------------------- the German emplacements (set 'de')

setModelSet('de');
export const DE: Style = {
  uni: FG, helm: '#5e6452', hk: 'stahl', paint: DG, camo: DG_CAMO, mark: balkenkreuz, plane: ['#9aa0a0', '#6a7272', '#3e4646'],
  flag: (g, x, y) => {
    box(g, x, y, 9, 6, 0.2, RED, 'rgba(0,0,0,0.5)');
    circ(g, x + 4.5, y + 3, 2.1, '#f2f0e8', null);
    swastika(g, x + 4.5, y + 3, 1.4);
  },
};
model('w_mg42', 18, DIRS, mgNest(DE));
model('w_flak38', 20, DIRS, lightAA(DE));
model('w_schreck', 17, DIRS, atTeam(DE));
model('w_sniper', 14, DIRS, sniperPit(DE));
model('w_flamer', 14, DIRS, flamerTeam(DE));
model('w_flak88', 27, DIRS, heavyAA(DE));
model('w_bunker', 21, DIRS, pillbox(DE));
model('w_mortar', 15, DIRS, mortarPit(DE));
model('w_lefh18', 26, DIRS, howitzer(DE));
model('w_nebel', 21, DIRS, rocketBattery(DE));
model('w_depot', 21, 1, depot(DE));
model('w_observer', 16, DIRS, observer(DE));
model('w_hq', 21, 1, hq(DE));
model('w_workshop', 21, 1, workshop(DE));
model('w_barracks', 21, 1, barracks(DE));
model('w_motorpool', 22, 1, motorpool(DE));
model('w_airfield', 23, 1, airfield(DE));
model('w_pak40', 24, DIRS, atGun(DE, { barrel: 20, shieldW: 8, brake: true, wheelY: 8.5 }));

// ---------------------------------------------------------------- obstacles (shared)

setModelSet('ww2');

model('teeth', 11, 1, [0, 1, 2, 3].map((k) => {
  const x = k % 2 ? 4 : -4;
  const y = k < 2 ? -4 : 4;
  return P(0, 8, (g, z) => {
    const s = 3.6 * (1 - 0.62 * (z / 8));
    box(g, x - s, y - s, s * 2, s * 2, 0.4, grad(g, x - s, y - s, x + s, y + s, [[0, '#c4c0b2'], [1, '#76736a']]), z > 7 ? 'rgba(0,0,0,0.4)' : null);
  }, true);
}));

model('roadblock', 22, 1, [
  P(0, 4, (g) => {
    // sandbags and two trestles
    for (let k = -3; k <= 3; k++) box(g, k * 5 - 2.4, 9, 4.8, 3, 1.2, grad(g, 0, 9, 0, 12, [[0, '#b8a47a'], [1, '#7a6a48']]));
    for (const x of [-15, 15]) {
      line(g, [x - 2, -3, x + 2, 3], '#5a3c22', 1.2);
      line(g, [x + 2, -3, x - 2, 3], '#5a3c22', 1.2);
    }
  }),
  P(4, 6, (g) => {
    // striped barrier pole
    for (let k = 0; k < 8; k++) box(g, -18 + k * 4.5, -0.9, 4.5, 1.8, 0.3, k % 2 ? '#f0ece0' : '#c42a1e', null);
    poly(g, [-18, -0.9, 18, -0.9, 18, 0.9, -18, 0.9], 'rgba(0,0,0,0)', 'rgba(0,0,0,0.5)');
  }),
]);

// ---------------------------------------------------------------- the commander (WW2)

setModelSet('de');

/** A commander on foot: coat colour, cap, the weapon carried and its marking. */
export function officer(o: { coat: string[]; tails: string; cap: string[]; band?: string; badge: string; weapon: 'smg' | 'sword' | 'carbine' }): Part[] {
  return [
  P(0, 4, (g) => {
    box(g, -2.6, -4, 4.6, 2.6, 1.2, '#141412'); // boots
    box(g, -1.2, 1.4, 4.6, 2.6, 1.2, '#141412');
  }),
  P(4, 11, (g) => {
    poly(g, [-5.5, -4.4, -7.2, 0, -5.5, 4.4, -3, 3.4, -3, -3.4], o.tails); // greatcoat tails
    g.beginPath();
    g.ellipse(0, 0, 4, 5.2, 0, 0, Math.PI * 2);
    finish(g, grad(g, -4, -5, 4, 5, [[0, o.coat[0]], [1, o.coat[2]]]));
    line(g, [-2.5, -4, 2.5, 4], '#2a2014', 0.8); // cross strap
    circ(g, 2, -3.5, 0.9, '#c8c8c0', null); // binoculars
    circ(g, 2, -2, 0.9, '#c8c8c0', null);
  }),
  P(8, 9.5, (g) => {
    if (o.weapon === 'sword') {
      line(g, [-1, 3.6, 9, 4.6], '#d8d8d0', 0.7); // the officer's sword
      box(g, -2.4, 3, 2, 1.4, 0.3, '#3a2a14', null);
    } else {
      box(g, 1, 1.2, o.weapon === 'carbine' ? 9 : 8, 1.3, 0.5, o.weapon === 'carbine' ? '#5a3c22' : '#151515', null);
      box(g, 3, 2.3, 1, 2.4, 0.3, '#151515', null);
    }
  }),
  P(11, 14, (g) => {
    // peaked cap
    circ(g, 0.6, 0, 2.4, SKIN);
    g.beginPath();
    g.ellipse(0, 0, 3.1, 3, 0, 0, Math.PI * 2);
    finish(g, rgrad(g, 0, 0, 3.1, [[0, o.cap[0]], [1, o.cap[1]]]));
    if (o.band) {
      g.beginPath();
      g.ellipse(0, 0, 3.1, 3, 0, 0, Math.PI * 2);
      g.strokeStyle = o.band;
      g.lineWidth = 0.7;
      g.stroke();
    }
    poly(g, [1.8, -2, 4.2, -1.4, 4.2, 1.4, 1.8, 2], '#141412', null);
    circ(g, 1.6, 0, 0.6, o.badge, null);
  }),
  ];
}
model('w_officer', 12, DIRS, officer({ coat: FG, tails: '#3e4238', cap: ['#7c8272', '#3e4238'], badge: '#d8d0b0', weapon: 'smg' }));

// ---------------------------------------------------------------- emplacement bases (one per level)
//
// Levels 1-3: a sandbagged gun pit, one more course of bags per level. 4-6: logs and an earth berm
// under a camouflage net. 7-9: a concrete apron with sandbags on top. 10: a fortified concrete
// position with the Knight's Cross on the front. German rank chevrons/pips sit on the front edge.

const BAG = ['#c4b082', '#a08a5c', '#6e5c3a'];

export function sandbagRing(g: Ctx, r: number, rng: Rng, dark = 0) {
  const n = Math.round(r * 1.25);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + rng.range(-0.04, 0.04);
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    g.save();
    g.translate(x, y);
    g.rotate(a + Math.PI / 2);
    box(g, -2.6, -1.5, 5.2, 3, 1.4, grad(g, -2.6, -1.5, 2.6, 1.5, [[0, dark ? '#a8a48e' : BAG[0]], [1, dark ? '#6e6a5c' : BAG[2]]]), 'rgba(40,30,20,0.55)');
    g.restore();
  }
}

function germanRank(g: Ctx, lv: number) {
  if (lv === 0) return;
  const y = 17.5;
  if (lv <= 3) {
    // Gefreiter chevrons, pointing down
    for (let k = 0; k < lv; k++) line(g, [-2, y - 1.2 + k * 1.3, 0, y + 0.2 + k * 1.3, 2, y - 1.2 + k * 1.3], '#e8e8e0', 0.9);
  } else if (lv <= 8) {
    // shoulder board with pips: silver for officers (4-6), gold for staff officers (7-9)
    const n = lv <= 6 ? lv - 3 : lv - 6;
    box(g, -5, y - 1.4, 10, 2.8, 1.2, lv <= 6 ? '#b8bcc0' : '#d8b450', 'rgba(0,0,0,0.6)');
    for (let k = 0; k < n; k++) circ(g, (k - (n - 1) / 2) * 2.6, y, 0.8, lv <= 6 ? '#ffd84a' : '#e8ecf0', 'rgba(0,0,0,0.5)');
  } else {
    // the Knight's Cross
    poly(g, [0, y - 3, 1, y - 1, 3, y, 1, y + 1, 0, y + 3, -1, y + 1, -3, y, -1, y - 1], BLACK, '#e8e8e0');
  }
}

/** The ten emplacement bases of a faction: its rank insignia sit on the front edge. */
export function makeBases(prefix: string, rank: (g: Ctx, lv: number) => void): void {
for (let lv = 0; lv < 10; lv++) {
  const rng = new Rng(4000 + lv);
  const parts: Part[] = [
    // the pit: dark earth floor
    P(0, 1, (g) => {
      circ(g, 0, 0, 19, rgrad(g, 0, 0, 19, [[0, '#4a3e2c'], [0.75, '#5e4e36'], [1, '#6e6040']]), 'rgba(0,0,0,0.3)');
    }),
  ];
  if (lv >= 6) {
    parts.push(P(0, 3, (g) => {
      // concrete apron
      poly(g, [-19, -15, -15, -19, 15, -19, 19, -15, 19, 15, 15, 19, -15, 19, -19, 15], grad(g, -19, -19, 19, 19, [[0, '#b4b2a6'], [1, '#6a6860']]));
      for (let k = -12; k <= 12; k += 8) line(g, [k, -19, k, -16], 'rgba(0,0,0,0.25)');
      circ(g, 0, 0, 13.5, '#4e4232', 'rgba(0,0,0,0.4)');
    }));
  }
  if (lv >= 3 && lv < 6) {
    parts.push(P(0, 2.5, (g) => {
      // earth berm and logs
      circ(g, 0, 0, 19.5, rgrad(g, 0, 0, 19.5, [[0.6, '#5e4e36'], [0.85, '#7a6a46'], [1, '#5a4a30']]), 'rgba(0,0,0,0.3)');
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + 0.2;
        g.save();
        g.rotate(a);
        box(g, 12.5, -3.2, 2, 6.4, 1, grad(g, 12.5, 0, 14.5, 0, [[0, '#7a5a36'], [1, '#4a3420']]), 'rgba(0,0,0,0.5)');
        g.restore();
      }
    }));
  }
  const courses = lv < 3 ? lv + 1 : lv < 6 ? 2 : lv < 9 ? 2 : 3;
  const z0 = lv >= 6 ? 3 : lv >= 3 ? 2.5 : 1;
  for (let c = 0; c < courses; c++) {
    const r = 16.2 - c * 0.6;
    parts.push(P(z0 + c * 2.2, z0 + (c + 1) * 2.2, (g) => sandbagRing(g, r, rng, lv >= 6 ? 1 : 0)));
  }
  const top = z0 + courses * 2.2;
  if (lv >= 3 && lv < 9) {
    // camouflage net draped over part of the rim
    parts.push(P(top, top + 0.5, (g) => {
      for (let k = 0; k < 7 + lv; k++) {
        const a = rng.range(0, Math.PI * 2);
        const r = rng.range(13, 18);
        circ(g, Math.cos(a) * r, Math.sin(a) * r, rng.range(1.5, 3), k % 2 ? 'rgba(80,96,48,0.85)' : 'rgba(110,104,60,0.85)', null);
      }
    }));
  }
  if (lv >= 9) {
    parts.push(P(top, top + 1, (g) => {
      // steel rim with gold trim
      g.beginPath();
      g.arc(0, 0, 15.5, 0, Math.PI * 2);
      g.strokeStyle = '#d8b450';
      g.lineWidth = 1;
      g.stroke();
    }));
  }
  parts.push(P(top - 0.5, top, (g) => rank(g, lv)));
  model(`${prefix}${lv}`, 22, 1, parts);
}
}
makeBases('wbase', germanRank);

// ---------------------------------------------------------------- German units (mobile, facing +x)

const HELM = '#5e6452';
model('de_rifle', 8, DIRS, soldier({ tunic: FG, helmet: HELM, gear: 'rifle', pack: 'roll' }));
model('de_mg', 8, DIRS, soldier({ tunic: FG, helmet: HELM, gear: 'mg', pack: 'none' }));
model('de_schreck', 8, DIRS, soldier({ tunic: FG, helmet: HELM, gear: 'tube', pack: 'none' }));
model('de_sniper', 8, DIRS, soldier({ tunic: ['#8a8a52', '#5e6a38', '#3e4422'], helmet: '#4e5a2e', cap: 'hood', gear: 'scoped', pack: 'none' }));
model('de_pioneer', 8, DIRS, soldier({ tunic: ['#7a7a6a', '#5a5a4c', '#3a3a30'], helmet: HELM, gear: 'rifle', pack: 'roll' }));
model('de_medic', 8, DIRS, soldier({ tunic: FG, helmet: HELM, gear: 'none', pack: 'medic' }));

/** A German tank: box hull, side skirts, a turret set mid-hull and a long gun. */
export function panzer(o: { len: number; wid: number; tr: number; gun: number; slope?: boolean; skirts?: boolean; seed: number }): Part[] {
  const L = o.len / 2;
  const W = o.wid / 2;
  return [
    P(0, 5, tracks(o.len, o.wid, o.wid * 0.24, 6)),
    P(4.5, 9, (g) => {
      const pts = o.slope ? [-L, -W + 1, L - 6, -W + 1, L, -W + 3.5, L, W - 3.5, L - 6, W - 1, -L, W - 1] : [-L, -W + 1, L - 1.5, -W + 1, L, -W + 2.5, L, W - 2.5, L - 1.5, W - 1, -L, W - 1];
      poly(g, pts, grad(g, -L, -W, L, W, [[0, DG[0]], [1, DG[2]]]));
      camo(g, () => poly(g, pts, 'rgba(0,0,0,0)', null), DG_CAMO, o.seed, 8, 4, L);
      if (o.slope) poly(g, [L - 6, -W + 1, L, -W + 3.5, L, W - 3.5, L - 6, W - 1], 'rgba(255,255,220,0.12)', 'rgba(0,0,0,0.3)');
      box(g, -L + 1, -3.5, 6, 7, 0.6, '#5a4c30'); // engine deck
      for (let x = -L + 1.5; x < -L + 6.5; x += 1) line(g, [x, -3, x, 3], 'rgba(0,0,0,0.35)');
      if (o.skirts) for (const y of [-W, W - 1.6]) box(g, -L + 2, y, o.len - 4, 1.6, 0.3, grad(g, 0, y, 0, y + 1.6, [[0, DG[1]], [1, DG[2]]]));
      balkenkreuz(g, -L + 8, W - 2.6, 1.6);
    }),
    P(9, 14, (g) => {
      g.beginPath();
      g.ellipse(-1, 0, o.tr, o.tr * 0.85, 0, 0, Math.PI * 2);
      finish(g, grad(g, -o.tr, -o.tr, o.tr, o.tr, [[0, DG[0]], [1, DG[2]]]));
      camo(g, () => circ(g, -1, 0, o.tr * 0.85, 'rgba(0,0,0,0)', null), DG_CAMO, o.seed + 3, 4, 2.5, o.tr);
      circ(g, -o.tr * 0.55, -o.tr * 0.35, o.tr * 0.3, rgrad(g, -o.tr * 0.55, -o.tr * 0.35, o.tr * 0.3, [[0, '#c8b47a'], [1, '#6e5e3a']])); // cupola
    }),
    P(10.5, 12.5, (g) => {
      box(g, o.tr - 2.5, -2.2, 3, 4.4, 0.8, '#8a7650'); // mantlet
      box(g, o.tr, -0.9, o.gun, 1.8, 0.6, grad(g, 0, -0.9, 0, 0.9, [[0, DG[1]], [1, '#5a4c30']]));
      box(g, o.tr + o.gun - 2, -1.4, 2.6, 2.8, 0.5, '#4a4030'); // muzzle brake
    }),
  ];
}
model('de_pz4', 18, DIRS, panzer({ len: 26, wid: 19, tr: 6, gun: 15, skirts: true, seed: 4 }));
model('de_panther', 22, DIRS, panzer({ len: 30, wid: 22, tr: 6.5, gun: 19, slope: true, skirts: true, seed: 9 }));
model('de_tiger', 22, DIRS, panzer({ len: 30, wid: 24, tr: 8, gun: 17, seed: 14 }));
model('de_fw190', 18, DIRS, plane({ span: 24, len: 17, body: ['#9aa0a0', '#6a7272', '#3e4646'], seats: 1, german: true }), false);

setModelSet('classic');
