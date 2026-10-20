// Range probe: every weapon, a stationary target at 50/80/95/100% of the range it shows (the circle and
// the panel's Range row). Reports the weapons that never fire, or never hurt, at some distance.
//   WW2=1 SIDE=de FOE=su npm run probe      (ALL=1: every matchup; VERBOSE=1: every result)

import { COLS, ENEMIES, ROWS, TILE, TOWERS } from '../src/game/defs';
import { MAPS } from '../src/game/maps';
import { EV_SHOT, EV_SIZE, Sim } from '../src/game/sim';
import type { Faction } from '../src/game/ww2';

const FACTIONS: Faction[] = ['de', 'su', 'us', 'jp'];
const FRACS = [0.5, 0.8, 0.95, 1];
const SECONDS = 9;

type Matchup = { side: Faction; foe: Faction } | undefined;

function matchups(): Matchup[] {
  if (!process.env.WW2) return [undefined];
  if (!process.env.ALL) return [{ side: (process.env.SIDE ?? 'de') as Faction, foe: (process.env.FOE ?? 'su') as Faction }];
  const out: Matchup[] = [];
  for (const side of FACTIONS) for (const foe of FACTIONS) if (side !== foe) out.push({ side, foe });
  return out;
}

function create(ww2: Matchup): Sim {
  const sim = Sim.create({ map: { ...MAPS[0], rocks: 0, rivers: 0, mountains: 0, forests: 0 }, difficulty: 'normal', modifiers: [], perks: {}, seed: 3, ww2: ww2 && { side: ww2.side, foe: ww2.foe } });
  sim.hero = null;
  return sim;
}

/** Fires at all within SECONDS? Returns 'fire' (shot), 'hurt' (damage dealt), or 'none'. */
function probe(ww2: Matchup, type: number, kind: number, frac: number, facing: number, level = 0): { shot: boolean; hurt: boolean; t: number } {
  const sim = create(ww2);
  const def = TOWERS[type];
  const col = (COLS >> 1) - 1;
  const row = (ROWS >> 1) - 1;
  const t = sim.place(type, col, row, true);
  if (!t) throw new Error(`can't place ${def.kind}`);
  t.hp = 1e9;
  t.level = level;
  const range = sim.stats(t).range;
  // artillery fires at what an observer sees: give it one over the target
  if (def.role === 'arty') sim.place(TOWERS.findIndex((d) => d.role === 'radar'), Math.floor((t.x + range * frac) / TILE) - 1, row + 3, true);
  const e = sim.spawnEnemy(kind, 10);
  const air = ENEMIES[kind].air;
  // ground targets stand beside the tower, east of it (the open field of the lane)
  const x = t.x + range * frac;
  const y = t.y;
  sim.events.length = 0;
  for (let tick = 0; tick < SECONDS * 60; tick++) {
    if (!sim.eAlive[e]) return { shot: true, hurt: true, t: tick / 60 };
    sim.eX[e] = sim.ePx[e] = x;
    sim.eY[e] = sim.ePy[e] = y;
    sim.eAng[e] = sim.ePang[e] = facing; // 0: heading east (rear to us), PI: front, PI/2: side
    sim.eHp[e] = sim.eMaxHp[e];
    sim.eSpeed[e] = 0;
    void air;
    sim.step();
    for (let k = 0; k < sim.events.length; k += EV_SIZE) {
      if (sim.events[k] === EV_SHOT && sim.events[k + 1] === t.x && sim.events[k + 2] === t.y) {
        // fired: wait for the round to land (and a few more shots: a round can miss)
        for (let w = 0; w < 300 && sim.eAlive[e] && t.damage <= 0; w++) {
          sim.eX[e] = sim.ePx[e] = x;
          sim.eY[e] = sim.ePy[e] = y;
          sim.eSpeed[e] = 0;
          sim.step();
        }
        return { shot: true, hurt: t.damage > 0, t: tick / 60 };
      }
    }
    sim.events.length = 0;
  }
  return { shot: false, hurt: t.damage > 0, t: SECONDS };
}

const verbose = !!process.env.VERBOSE;
/** LEVELS=0,9: the upgrade levels to test (0-based). */
const LEVELS = (process.env.LEVELS ?? '0').split(',').map(Number);
let problems = 0;
for (const m of matchups()) {
  const head = create(m); // installs the ruleset
  void head;
  const enemies = ENEMIES.map((e, k) => ({ e, k })).filter(({ e }) => !e.fixed && !e.stealth && !e.heal);
  const soft = enemies.find(({ e }) => e.inf && !e.arm);
  const armoured = enemies.filter(({ e }) => e.arm && !e.air);
  const light = armoured.slice().sort((a, b) => a.e.arm![0] - b.e.arm![0])[0];
  const heavy = armoured.slice().sort((a, b) => b.e.arm![0] - a.e.arm![0])[0];
  const plane = enemies.find(({ e }) => e.air);
  const targets = [
    { name: 'soft', k: soft?.k, faces: [Math.PI] },
    { name: `light(${light?.e.name})`, k: light?.k, faces: [Math.PI, Math.PI / 2] },
    { name: `heavy(${heavy?.e.name})`, k: heavy?.k, faces: [Math.PI, Math.PI / 2] },
    { name: 'air', k: plane?.k, faces: [Math.PI] },
  ].filter((x) => x.k !== undefined) as { name: string; k: number; faces: number[] }[];
  console.log(`== ${m ? `${m.side} vs ${m.foe}` : 'classic'}`);
  for (let type = 0; type < TOWERS.length; type++) {
    const d = TOWERS[type];
    // (hackers take over vehicles only; drones fire from the hive's drones, not the tower)
    if (d.manual || !d.targeted || d.walkable || d.role === 'hacker' || d.role === 'hive') continue;
    for (const tg of targets) {
      const air = ENEMIES[tg.k].air;
      if (air ? !d.hitsAir : !d.hitsGround) continue;
      for (const face of tg.faces) {
        for (const level of LEVELS) {
        const res = FRACS.map((f) => probe(m, type, tg.k, f, face, level));
        const line = `${d.short.padEnd(12)} L${String(level + 1).padEnd(2)} ${tg.name.padEnd(26)} ${face === Math.PI ? 'front' : 'side '}  ` +
          res.map((r, j) => `${FRACS[j]}:${r.shot ? (r.hurt ? 'hit ' : 'miss') : '----'}${r.shot ? `@${r.t.toFixed(1)}` : '    '}`).join('  ');
        // trouble: doesn't fire at a soft target in range; an anti-tank gun (pen >= 40) that doesn't fire at a
        // tank (it fires even where it can't go through); a lighter weapon that fires at armour and bounces
        const soft = !ENEMIES[tg.k].arm;
        const at = !!process.env.WW2 && (d.levels[0].pen ?? 0) * (level ? 1.6 : 1) >= 40 && d.role !== 'arty';
        const bad = (soft || (at && !air) ? res.some((r) => !r.shot) : false) || (!at && res.some((r) => r.shot && !r.hurt));
        if (bad) problems++;
        if (bad || verbose) console.log((bad ? '! ' : '  ') + line);
        }
      }
    }
  }
}
console.log(`${problems} problem rows`);
