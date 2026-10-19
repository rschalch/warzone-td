// The WW2 campaign: historical battles, each with its own hand-made map, sides, briefing, the
// arsenal of that time and place, and its own way to win or lose (hold for so many waves, keep an
// objective standing, wait for the weather to clear before the air force can help).

import { encodePaint, T_MOUNT, T_TREE, T_WATER, type MapDef } from './maps';
import { Rng } from './rng';
import type { ARole, Faction, Slot } from './ww2_kit';

export interface Battle {
  id: string;
  name: string;
  /** Where and when, for the card. */
  place: string;
  year: number;
  side: Faction;
  foe: Faction;
  /** The historical briefing. */
  brief: string;
  map: MapDef;
  /** Waves to hold to win. */
  waves: number;
  /** A structure that must not fall (if it is knocked out, the battle is lost). */
  objective?: { slot: Slot; col: number; row: number; name: string };
  /** Positions already dug in when the battle starts (free). */
  preset?: { slot: Slot; col: number; row: number; level?: number }[];
  /** What the defender didn't have here. */
  banned?: Slot[];
  /** The attacker's units of the period (roles mapped to other enemies of its army). */
  roster?: Partial<Record<ARole, number>>;
  /** The attacker's doctrine in this battle (replaces its usual one). */
  doctrine?: { inf?: number; armour?: number; air?: number };
  /** Attackers move at this fraction of their speed (mud, snow, the Russian winter). */
  foeSpeed?: number;
  /** Air support and super-weapons only from this wave (the weather clears). */
  airFrom?: number;
  /** Start money multiplier (time to prepare the defence). */
  money?: number;
}

// ---------------------------------------------------------------- a tiny terrain painter

class Painter {
  readonly cells: Uint8Array;
  readonly rocks: { c: number; r: number; s: number }[] = [];
  constructor(readonly cols: number, readonly rows: number, readonly rng = new Rng(1)) {
    this.cells = new Uint8Array(cols * rows);
  }

  private set(c: number, r: number, t: number): void {
    c = Math.round(c);
    r = Math.round(r);
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return;
    this.cells[r * this.cols + c] = t;
  }

  rect(c0: number, r0: number, c1: number, r1: number, t: number): this {
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) this.set(c, r, t);
    return this;
  }

  disc(cx: number, cy: number, rad: number, t: number, ragged = 0.25): this {
    for (let r = Math.floor(cy - rad - 2); r <= cy + rad + 2; r++) {
      for (let c = Math.floor(cx - rad - 2); c <= cx + rad + 2; c++) {
        if (Math.hypot(c + 0.5 - cx, r + 0.5 - cy) <= rad * (1 - ragged / 2 + this.rng.next() * ragged)) this.set(c, r, t);
      }
    }
    return this;
  }

  /** A meandering band from (c0,r0) to (c1,r1), `w` cells wide (a river, a ridge, a hedgerow). */
  band(c0: number, r0: number, c1: number, r1: number, w: number, t: number, wobble = 0, gaps: number[] = [], gapW = 3): this {
    const len = Math.max(1, Math.hypot(c1 - c0, r1 - r0));
    const nx = -(r1 - r0) / len;
    const ny = (c1 - c0) / len;
    const phase = this.rng.next() * Math.PI * 2;
    for (let s = 0; s <= len; s += 0.5) {
      const f = s / len;
      if (gaps.some((g) => Math.abs(f * len - g * len) < gapW / 2)) continue;
      const off = wobble * Math.sin(f * Math.PI * 3 + phase);
      const x = c0 + (c1 - c0) * f + nx * off;
      const y = r0 + (r1 - r0) * f + ny * off;
      for (let k = -w / 2; k <= w / 2; k += 0.5) this.set(x + nx * k, y + ny * k, t);
    }
    return this;
  }

  /** Scattered woods. */
  woods(n: number, c0: number, r0: number, c1: number, r1: number, size: [number, number]): this {
    for (let k = 0; k < n; k++) this.disc(this.rng.range(c0, c1), this.rng.range(r0, r1), this.rng.range(size[0], size[1]), T_TREE, 0.5);
    return this;
  }

  rock(c: number, r: number, s: number): this {
    this.rocks.push({ c, r, s });
    return this;
  }

  get paint(): string {
    return encodePaint(this.cells);
  }
}

const water = T_WATER;
const mount = T_MOUNT;
const tree = T_TREE;

// ---------------------------------------------------------------- the maps

function moscow(): MapDef {
  const p = new Painter(100, 64, new Rng(1941));
  p.band(58, 0, 64, 63, 3, water, 3); // the Moskva
  p.woods(14, 8, 4, 92, 60, [2, 4.5]); // birch woods
  return { name: 'Moscow, 1941', desc: 'Winter before Moscow.', seed: 1941, cols: 100, rows: 64,
    routes: [{ entry: { side: 'L', from: 30, to: 33 }, exit: { side: 'R', from: 30, to: 33 } }],
    rocks: 24, paint: p.paint, theme: 'snow' };
}

function stalingrad(): MapDef {
  const p = new Painter(96, 64, new Rng(1942));
  p.rect(84, 0, 89, 63, water); // the Volga, the last line
  // the ruined city: blocks of rubble along the streets
  for (let bx = 6; bx < 78; bx += 9) {
    for (let by = 3; by < 60; by += 8) {
      if (p.rng.next() < 0.25) continue;
      for (let k = 0; k < 5; k++) p.rock(bx + p.rng.int(5), by + p.rng.int(4), p.rng.next() < 0.5 ? 2 : 1);
    }
  }
  return { name: 'Stalingrad, 1942', desc: 'The ruined city on the Volga.', seed: 1942, cols: 96, rows: 64,
    routes: [{ entry: { side: 'L', from: 30, to: 33 }, exit: { side: 'R', from: 30, to: 33 } }],
    rocks: 0, rockList: p.rocks, paint: p.paint, theme: 'ruins' };
}

function alamein(): MapDef {
  const p = new Painter(104, 64, new Rng(1943));
  p.band(20, 22, 70, 18, 4, mount, 2, [0.45], 6); // Ruweisat Ridge
  p.band(40, 46, 96, 50, 3, mount, 2, [0.3, 0.75], 6);
  return { name: 'El Alamein, 1942', desc: 'The desert line between the sea and the Qattara Depression.', seed: 1943, cols: 104, rows: 64,
    routes: [{ entry: { side: 'L', from: 30, to: 33 }, exit: { side: 'R', from: 30, to: 33 } }],
    rocks: 20, paint: p.paint, theme: 'desert' };
}

function kursk(): MapDef {
  const p = new Painter(120, 72, new Rng(1944));
  p.woods(6, 10, 4, 110, 68, [1.5, 3]);
  p.band(70, 0, 74, 71, 2, water, 4); // the Psel
  return { name: 'Kursk, 1943', desc: 'Open steppe, two pincers, the greatest tank battle.', seed: 1944, cols: 120, rows: 72,
    routes: [
      { entry: { side: 'L', from: 12, to: 15 }, exit: { side: 'R', from: 34, to: 37 } },
      { entry: { side: 'L', from: 56, to: 59 }, exit: { side: 'R', from: 34, to: 37 } },
    ],
    rocks: 16, paint: p.paint, theme: 'steppe' };
}

function omaha(): MapDef {
  const p = new Painter(96, 72, new Rng(1945));
  p.rect(0, 62, 95, 71, water); // the Channel: they wade ashore
  p.band(0, 34, 95, 34, 5, mount, 1, [0.2, 0.52, 0.82], 7); // the bluffs, cut by the draws
  return { name: 'Omaha Beach, 1944', desc: 'The bluffs over the beach, the draws leading inland.', seed: 1945, cols: 96, rows: 72,
    routes: [
      { entry: { side: 'B', from: 18, to: 21 }, exit: { side: 'T', from: 30, to: 33 } },
      { entry: { side: 'B', from: 74, to: 77 }, exit: { side: 'T', from: 62, to: 65 } },
    ],
    rocks: 10, paint: p.paint, theme: 'temperate' };
}

function bocage(): MapDef {
  const p = new Painter(104, 72, new Rng(1946));
  // hedgerows: earth banks overgrown with trees, every field boxed in, a gap here and there
  for (let c = 12; c < 100; c += 13) p.band(c, 0, c, 71, 1.5, tree, 0, [0.15 + ((c * 7) % 5) * 0.15, 0.7], 4);
  for (let r = 10; r < 70; r += 12) p.band(0, r, 103, r, 1.5, tree, 0, [0.1 + ((r * 3) % 7) * 0.1, 0.55, 0.9], 4);
  return { name: 'Normandy bocage, 1944', desc: 'Small fields boxed in by hedgerows.', seed: 1946, cols: 104, rows: 72,
    routes: [{ entry: { side: 'L', from: 34, to: 37 }, exit: { side: 'R', from: 34, to: 37 } }],
    rocks: 12, paint: p.paint, theme: 'temperate' };
}

function arnhem(): MapDef {
  const p = new Painter(96, 64, new Rng(1947));
  p.rect(0, 30, 95, 34, water); // the Rhine (the bridge is at the route)
  p.woods(5, 6, 4, 90, 26, [2, 3.5]);
  return { name: 'Arnhem, 1944', desc: 'The bridge too far, held by paratroopers.', seed: 1947, cols: 96, rows: 64,
    routes: [{ entry: { side: 'T', from: 46, to: 49 }, exit: { side: 'B', from: 46, to: 49 } }],
    rocks: 26, paint: p.paint, theme: 'temperate' };
}

function bastogne(): MapDef {
  const p = new Painter(112, 72, new Rng(1948));
  p.woods(22, 4, 4, 108, 68, [2.5, 5]); // the Ardennes
  return { name: 'Bastogne, 1944', desc: 'Encircled in the snow of the Ardennes.', seed: 1948, cols: 112, rows: 72,
    routes: [
      { entry: { side: 'L', from: 34, to: 37 }, exit: { side: 'R', from: 34, to: 37 } },
      { entry: { side: 'T', from: 30, to: 33 }, exit: { side: 'R', from: 34, to: 37 } },
      { entry: { side: 'B', from: 30, to: 33 }, exit: { side: 'R', from: 34, to: 37 } },
    ],
    rocks: 20, paint: p.paint, theme: 'snow' };
}

function guadalcanal(): MapDef {
  const p = new Painter(96, 64, new Rng(1949));
  p.woods(26, 4, 3, 80, 61, [2, 5]); // jungle
  p.band(46, 0, 50, 63, 2, water, 3); // the Tenaru
  return { name: 'Guadalcanal, 1942', desc: 'The jungle perimeter round Henderson Field.', seed: 1949, cols: 96, rows: 64,
    routes: [
      { entry: { side: 'L', from: 14, to: 17 }, exit: { side: 'R', from: 30, to: 33 } },
      { entry: { side: 'L', from: 46, to: 49 }, exit: { side: 'R', from: 30, to: 33 } },
    ],
    rocks: 12, paint: p.paint, theme: 'jungle' };
}

function iwojima(): MapDef {
  const p = new Painter(96, 72, new Rng(1950));
  p.rect(0, 64, 95, 71, water); // the landing beaches
  p.disc(12, 52, 9, mount, 0.2); // Mount Suribachi
  p.band(30, 26, 88, 22, 3, mount, 2, [0.35, 0.7], 6); // the ridges of the Motoyama plateau
  return { name: 'Iwo Jima, 1945', desc: 'Black volcanic sand, Mount Suribachi and the caves.', seed: 1950, cols: 96, rows: 72,
    routes: [{ entry: { side: 'B', from: 44, to: 47 }, exit: { side: 'T', from: 50, to: 53 } }],
    rocks: 30, paint: p.paint, theme: 'volcanic' };
}

function okinawa(): MapDef {
  const p = new Painter(104, 80, new Rng(1951));
  p.band(0, 22, 103, 24, 3, mount, 2, [0.25, 0.7], 6);
  p.band(0, 42, 103, 40, 3, mount, 2, [0.45, 0.85], 6);
  p.band(0, 60, 103, 62, 3, mount, 2, [0.15, 0.6], 6);
  return { name: 'Okinawa, 1945', desc: 'The Shuri Line: ridge after ridge.', seed: 1951, cols: 104, rows: 80,
    routes: [{ entry: { side: 'T', from: 50, to: 53 }, exit: { side: 'B', from: 50, to: 53 } }],
    rocks: 24, paint: p.paint, theme: 'temperate' };
}

function seelow(): MapDef {
  const p = new Painter(112, 68, new Rng(1952));
  p.band(18, 0, 22, 67, 3, water, 2); // the Oder
  p.band(58, 0, 62, 67, 4, mount, 2, [0.3, 0.7], 7); // the heights
  return { name: 'Seelow Heights, 1945', desc: 'The last line before Berlin.', seed: 1952, cols: 112, rows: 68,
    routes: [{ entry: { side: 'L', from: 32, to: 35 }, exit: { side: 'R', from: 32, to: 35 } }],
    rocks: 18, paint: p.paint, theme: 'temperate' };
}

// ---------------------------------------------------------------- the battles, in order

export const BATTLES: Battle[] = [
  {
    id: 'moscow', name: 'Moscow', place: 'Moscow, December 1941', year: 1941, side: 'su', foe: 'de', map: moscow(), waves: 20,
    brief: 'Operation Typhoon has brought the Wehrmacht to the gates of Moscow, and the winter has come early. The German columns are frozen and short of everything — but they keep coming. Hold until the Siberian divisions arrive.',
    foeSpeed: 0.85, roster: { medium2: 7, heavy: 7, boss: 9 }, banned: ['super'],
  },
  {
    id: 'stalingrad', name: 'Stalingrad', place: 'Stalingrad, autumn 1942', year: 1942, side: 'su', foe: 'de', map: stalingrad(), waves: 25,
    brief: '"There is no land beyond the Volga." Every ruined block is a fortress. The 6th Army throws its infantry and pioneers at the city; snipers hunt in the rubble. Keep Pavlov\'s House standing and hold the river bank.',
    objective: { slot: 'hq', col: 70, row: 26, name: 'Pavlov\'s House' }, roster: { medium2: 7, boss: 9 }, doctrine: { inf: 1.25, armour: 0.7 },
  },
  {
    id: 'alamein', name: 'El Alamein', place: 'El Alamein, July 1942', year: 1942, side: 'us', foe: 'de', map: alamein(), waves: 20,
    brief: 'Rommel\'s Afrika Korps races for Alexandria and the Suez Canal. Between the sea and the impassable Qattara Depression there is one line left to hold. The minefields are already laid.',
    roster: { medium2: 7, heavy: 7, boss: 9 }, banned: ['super'],
    preset: [
      ...[0, 1, 2, 3, 4, 5].map((k) => ({ slot: 'atmine' as Slot, col: 54 + (k % 3) * 2, row: 29 + Math.floor(k / 3) * 3 })),
      ...[0, 1, 2, 3].map((k) => ({ slot: 'apmine' as Slot, col: 60 + (k % 2) * 2, row: 30 + Math.floor(k / 2) * 2 })),
    ],
  },
  {
    id: 'kursk', name: 'Kursk', place: 'Prokhorovka, July 1943', year: 1943, side: 'su', foe: 'de', map: kursk(), waves: 30,
    brief: 'Operation Citadel: the Panthers and Tigers make their debut against the Kursk salient. The Red Army has had three months to dig belts of anti-tank guns and mines. Build a Pakfront deep enough to stop the greatest tank battle in history.',
    doctrine: { inf: 0.8, armour: 1.4 }, money: 1.4,
  },
  {
    id: 'omaha', name: 'Omaha Beach', place: 'Normandy, 6 June 1944', year: 1944, side: 'de', foe: 'us', map: omaha(), waves: 20,
    brief: 'D-Day. The Allied landing craft are coming in on the beach under your bluffs. The Atlantic Wall bunkers and hedgehogs are in place; the draws are the only ways up. Few tanks make it ashore — the infantry come in waves.',
    doctrine: { inf: 1.35, armour: 0.5, air: 1.4 },
    preset: [
      { slot: 'bunker', col: 16, row: 38, level: 2 }, { slot: 'bunker', col: 48, row: 38, level: 2 }, { slot: 'bunker', col: 78, row: 38, level: 2 },
      { slot: 'mg', col: 22, row: 38 }, { slot: 'mg', col: 72, row: 38 },
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((k) => ({ slot: 'teeth' as Slot, col: 10 + k * 10, row: 58 })),
    ],
  },
  {
    id: 'bocage', name: 'Normandy Bocage', place: 'Saint-Lô, July 1944', year: 1944, side: 'de', foe: 'us', map: bocage(), waves: 25,
    brief: 'Behind the beaches the Allies are stuck in the hedgerow country: every small field is a fortress. The enemy rules the sky — the fighter-bombers come every wave.',
    doctrine: { inf: 1.0, armour: 0.9, air: 1.7 },
  },
  {
    id: 'arnhem', name: 'Arnhem', place: 'Arnhem, September 1944', year: 1944, side: 'us', foe: 'de', map: arnhem(), waves: 15,
    brief: 'Market Garden: the paratroopers hold the north end of the bridge and wait for XXX Corps. They have no tanks and no heavy guns, and two SS Panzer divisions are refitting nearby. Keep the bridge until relieved.',
    objective: { slot: 'hq', col: 52, row: 36, name: 'Arnhem Bridge' }, banned: ['tank', 'motorpool', 'heavyaa', 'howitzer', 'rockets', 'super'], money: 1.3,
  },
  {
    id: 'bastogne', name: 'Bastogne', place: 'The Ardennes, December 1944', year: 1944, side: 'us', foe: 'de', map: bastogne(), waves: 25,
    brief: 'The Battle of the Bulge. The 101st Airborne is surrounded in Bastogne, attacked from every side by King Tigers in the snow. The sky is closed: no air support until the weather clears. "Nuts!"',
    objective: { slot: 'hq', col: 96, row: 33, name: '101st Airborne HQ' }, airFrom: 12,
  },
  {
    id: 'guadalcanal', name: 'Guadalcanal', place: 'Henderson Field, October 1942', year: 1942, side: 'us', foe: 'jp', map: guadalcanal(), waves: 20,
    brief: 'The Marines hold the perimeter round Henderson Field. At night the Japanese come out of the jungle in banzai charges. Lose the airfield and the island is lost.',
    objective: { slot: 'airfield', col: 84, row: 30, name: 'Henderson Field' }, doctrine: { inf: 1.6, armour: 0.4 }, banned: ['super'],
  },
  {
    id: 'iwojima', name: 'Iwo Jima', place: 'Iwo Jima, February 1945', year: 1945, side: 'jp', foe: 'us', map: iwojima(), waves: 25,
    brief: 'General Kuribayashi has dug the whole island into a fortress of caves and tunnels. The Marines will land on the black sand beach, where the loose volcanic ash bogs down men and vehicles; let them come inland before the caves open fire.',
    preset: [
      { slot: 'bunker', col: 30, row: 44, level: 1 }, { slot: 'bunker', col: 62, row: 44, level: 1 }, { slot: 'bunker', col: 46, row: 30, level: 1 },
      { slot: 'bunker', col: 38, row: 52, level: 1 }, { slot: 'bunker', col: 56, row: 52, level: 1 }, { slot: 'bunker', col: 46, row: 16, level: 1 },
    ],
    doctrine: { inf: 1.15, armour: 0.6 }, money: 1.5, foeSpeed: 0.85,
  },
  {
    id: 'okinawa', name: 'Okinawa', place: 'The Shuri Line, May 1945', year: 1945, side: 'jp', foe: 'us', map: okinawa(), waves: 25,
    brief: 'Ridge after ridge across southern Okinawa: the Shuri Line. The May rains have turned the ground to mud under the American tanks and flamethrowers; every ridge must cost them dearly.',
    doctrine: { inf: 0.9, armour: 0.6 }, money: 1.8, foeSpeed: 0.85,
  },
  {
    id: 'seelow', name: 'Seelow Heights', place: 'The Oder, April 1945', year: 1945, side: 'de', foe: 'su', map: seelow(), waves: 30,
    brief: 'The last defensive line before Berlin. Zhukov\'s fronts cross the Oder with a million men, thousands of Katyushas and the IS-2s. Hold the heights.',
    doctrine: { inf: 1.1, armour: 1.3 },
  },
];

export const battleById = (id?: string): Battle | undefined => (id ? BATTLES.find((b) => b.id === id) : undefined);
