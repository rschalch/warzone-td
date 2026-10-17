// A heuristic player for difficulty tuning. Each second it either upgrades or builds where a tower
// covers the most of the current route (or lengthens it), mixing tower types by need.
//   npx vite build --ssr scripts/bot.ts --outDir .bench && node .bench/bot.js

import type { Difficulty } from '../src/game/config';
import { COLS, TILE, TOTAL_WAVES, TOWERS, towerIndex } from '../src/game/defs';
import { MAPS, type MapDef } from '../src/game/maps';
import { Sim } from '../src/game/sim';

const T = {
  gun: towerIndex('gun'), cannon: towerIndex('cannon'), missile: towerIndex('missile'), tesla: towerIndex('tesla'),
  laser: towerIndex('laser'), flak: towerIndex('flak'), radar: towerIndex('radar'), jammer: towerIndex('jammer'),
  napalm: towerIndex('napalm'), sniper: towerIndex('sniper'),
};

/** Cells on each route's current path, entry to exit. */
function pathCells(sim: Sim): number[] {
  const out: number[] = [];
  sim.map.routes.forEach((r, k) => {
    const f = sim.fields[k];
    let c = r.entry[r.entry.length >> 1];
    for (let g = 0; g < 4000 && c >= 0 && f.dist[c] > 0; g++) {
      out.push(c);
      c = f.next[c];
    }
  });
  return out;
}

function routeLength(sim: Sim, fields = sim.fields): number {
  return sim.map.routes.reduce((a, r, k) => a + fields[k].dist[r.entry[r.entry.length >> 1]], 0);
}

function chooseType(sim: Sim, built: Map<number, number>): number {
  const n = (t: number) => built.get(t) ?? 0;
  const total = [...built.values()].reduce((a, b) => a + b, 0);
  if (sim.wave >= 4 && n(T.missile) + n(T.flak) < 1 + total / 8) return sim.money >= sim.cost(T.flak) && n(T.flak) <= n(T.missile) ? T.flak : T.missile;
  if (sim.wave >= 6 && n(T.radar) < 1 + sim.map.routes.length - 1) return T.radar;
  if (sim.wave >= 9 && n(T.jammer) < 1) return T.jammer;
  if (sim.money >= 120 && total > 6) {
    const opts = [T.tesla, T.cannon, T.napalm, T.laser, T.sniper];
    return opts[total % opts.length];
  }
  if (sim.money >= 40 && total % 3 === 2) return T.cannon;
  return T.gun;
}

function decide(sim: Sim, built: Map<number, number>): void {
  // upgrade the busiest tower when it beats building
  const best = [...sim.towers].filter((t) => sim.upgradeCost(t) > 0).sort((a, b) => b.damage - a.damage)[0];
  if (best && sim.towers.length > 12 && sim.money >= sim.upgradeCost(best) && sim.upgradeCost(best) < 120) {
    sim.exec({ t: 'upgrade', ids: [best.id] });
    return;
  }
  const type = chooseType(sim, built);
  if (sim.money < sim.cost(type)) return;
  const path = pathCells(sim);
  if (!path.length) return;
  const r = Math.max(60, TOWERS[type].levels[0].range);
  const before = routeLength(sim);
  let bestScore = -1;
  let bestPos: [number, number] | null = null;
  const seen = new Set<number>();
  for (let k = 0; k < path.length; k += 2) {
    const pc = path[k] % COLS;
    const pr = (path[k] / COLS) | 0;
    for (const [dc, dr] of [[-2, -1], [1, -1], [-1, -2], [-1, 1], [-3, -1], [2, -1], [-1, -3], [-1, 2]]) {
      const c = pc + dc;
      const row = pr + dr;
      const key = row * COLS + c;
      if (seen.has(key)) continue;
      seen.add(key);
      if (sim.placeStatus(type, c, row) !== 'ok') continue;
      const x = (c + 1) * TILE;
      const y = (row + 1) * TILE;
      let cover = 0;
      for (const p of path) {
        const dx = ((p % COLS) + 0.5) * TILE - x;
        const dy = (((p / COLS) | 0) + 0.5) * TILE - y;
        if (dx * dx + dy * dy <= r * r) cover++;
      }
      const prev = sim.preview(type, c, row);
      const gain = prev ? routeLength(sim, prev) - before : 0;
      const score = cover + gain * 1.5;
      if (score > bestScore) {
        bestScore = score;
        bestPos = [c, row];
      }
    }
  }
  if (bestPos && sim.exec({ t: 'place', type, col: bestPos[0], row: bestPos[1] })) built.set(type, (built.get(type) ?? 0) + 1);
}

function play(map: MapDef, difficulty: Difficulty, seed: number): { wave: number; win: boolean; lives: number; towers: number } {
  const sim = Sim.create({ map, difficulty, modifiers: [], perks: {}, seed });
  const built = new Map<number, number>();
  const leaks = new Map<number, number>();
  sim.exec({ t: 'wave' });
  let lastWave = 0;
  for (let tick = 0; tick < 60 * 60 * 40 && !sim.gameOver && !sim.victory; tick++) {
    if (process.env.VERBOSE && sim.wave !== lastWave) {
      lastWave = sim.wave;
      const kinds = new Map<string, number>();
      for (const t of sim.towers) kinds.set(t.kind, (kinds.get(t.kind) ?? 0) + 1);
      console.log(`  w${sim.wave} t${(sim.time | 0)}s lives ${sim.lives} money ${sim.money | 0} towers ${[...kinds].map(([k, n]) => k + n).join(' ')} leaks ${JSON.stringify([...leaks])}`);
    }
    if (tick % 30 === 0) decide(sim, built);
    // use items when it gets busy, roughly like a player would
    if (tick % 120 === 0 && sim.liveCount > 25 && sim.items[0] > 0) {
      const i = sim.live[0];
      sim.exec({ t: 'item', item: 0, x: sim.eX[i], y: sim.eY[i] });
    }
    sim.step();
    for (let k = 0; k < sim.events.length; k += 5) {
      if (sim.events[k] === 3) leaks.set(sim.events[k + 3], (leaks.get(sim.events[k + 3]) ?? 0) + 1);
    }
    sim.events.length = 0;
  }
  if (process.env.VERBOSE) console.log('  leaks by kind', JSON.stringify([...leaks].map(([k, n]) => `${k}:${n}`)));
  return { wave: sim.wave, win: sim.victory, lives: sim.lives, towers: sim.towers.length };
}

const diffs = (process.env.DIFF ?? 'easy,normal,hard').split(',') as Difficulty[];
const maps = (process.env.MAPS ?? '0,1,2,3,4').split(',').map(Number);
for (const m of maps) {
  for (const d of diffs) {
    const t0 = Date.now();
    const r = play(MAPS[m], d, 42);
    console.log(`${MAPS[m].name.padEnd(14)} ${d.padEnd(7)} ${r.win ? 'WIN ' : 'lost'} wave ${String(r.wave).padStart(2)}/${TOTAL_WAVES} lives ${String(r.lives).padStart(2)} towers ${r.towers}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }
}
