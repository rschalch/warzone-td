// Balance probe: every attacking tower, at each level, faces the same mixed wave walking past it
// along a straight lane. Reports damage dealt per dollar spent, relative to the Machine Gun.
//   npx vite build --ssr scripts/gauntlet.ts --outDir .bench && node .bench/gauntlet.js

import { TOWERS, ENEMIES } from '../src/game/defs';
import { MAPS } from '../src/game/maps';
import { Sim } from '../src/game/sim';

const WAVE = Number(process.env.WAVE ?? 12);
const MIX = (process.env.AIR ? [4] : [0, 0, 0, 1, 1, 2, 2, 3, 4, 7, 6, 8]);
const SPACING = Number(process.env.SPACING ?? 24); // ticks between spawns // infantry-heavy, some armour, air, shields, stealth, medic

function run(type: number, level: number): { dmg: number; cost: number } {
  const sim = Sim.create({ map: { ...MAPS[0], rocks: 0 }, difficulty: 'normal', modifiers: [], perks: {}, seed: 5 });
  sim.hero = null;
  const def = TOWERS[type];
  const row = def.walkable ? 31 : 27;
  const t = sim.place(type, 40, row, true)!;
  if (!t) throw new Error(`could not place ${def.kind}`);
  t.level = level;
  // a radar so stealth units are fair game for everyone
  sim.place(TOWERS.findIndex((d) => d.kind === 'radar'), 4, 4, true);
  let cost = 0;
  for (let l = 0; l <= level; l++) cost += def.levels[l].cost;
  if (def.manual) t.charge = 0;
  const kinds = [...MIX, ...MIX, ...MIX];
  let spawned = 0;
  for (let tick = 0; tick < 60 * 120; tick++) {
    if (tick % SPACING === 0 && spawned < kinds.length) {
      sim.spawnEnemy(kinds[spawned++], WAVE);
    }
    if (def.manual && t.charge <= 0) {
      // fire at the first unit to come within 60px of the tower's column
      for (let n = 0; n < sim.liveCount; n++) {
        const e = sim.live[n];
        if (sim.eAlive[e] && Math.abs(sim.eX[e] - t.x) < 60) {
          sim.fireSuper(t, sim.eX[e], sim.eY[e]);
          break;
        }
      }
    }
    sim.step();
    if (spawned >= kinds.length && sim.liveCount === 0) break;
  }
  return { dmg: t.damage, cost };
}

const rows: string[] = [];
const gun = run(0, 0);
const base = gun.dmg / gun.cost;
for (let i = 0; i < TOWERS.length; i++) {
  const d = TOWERS[i];
  if (!d.hitsGround && !d.hitsAir) continue;
  if (d.kind === 'hacker' || d.kind === 'emp') {
    // hacked units do the damage / EMP is mostly control: still report it
  }
  const vals = d.levels.map((_, l) => run(i, l));
  const rel = vals.map((v) => (v.dmg / v.cost / base).toFixed(2));
  rows.push(`${d.short.padEnd(11)} ${String(d.levels[0].cost).padStart(4)}  ${rel.map((r) => r.padStart(5)).join(' ')}   dmg ${vals.map((v) => Math.round(v.dmg)).join('/')}`);
}
const hp = MIX.reduce((a, k) => a + ENEMIES[k].hp, 0) * 3;
console.log(`wave ${WAVE}, ${MIX.length * 3} units, base hp ${hp}; value relative to Gun L1 (1.00 = ${base.toFixed(2)} dmg/$)`);
console.log('tower        cost     L1    L2    L3');
console.log(rows.join('\n'));
