// A heuristic player for difficulty tuning. Each second it either upgrades or builds where a tower
// covers the most of the current route (or lengthens it), mixing tower types by need.
//   npx vite build --ssr scripts/bot.ts --outDir .bench && node .bench/bot.js
// PARTNER=0.5 adds the AI partner (co-op with AI) with that bank share; SOLO=1 lets it play alone.
// WW2=1 plays the WW2 mode (Germany against the Soviet attack) with its own build order.

import type { Difficulty } from '../src/game/config';
import { COLS, TILE, TOTAL_WAVES, TOWERS, towerIndex } from '../src/game/defs';
import type { Faction } from '../src/game/ww2';
import { MAPS, type MapDef } from '../src/game/maps';
import { Partner, PARTNER_EVERY } from '../src/game/partner';
import { Sim } from '../src/game/sim';

const WW2 = !!process.env.WW2;
/** WW2 matchup: SIDE=de|su|us|jp defends against FOE. */
const SIDE = (process.env.SIDE ?? 'de') as Faction;
const FOE = (process.env.FOE ?? (SIDE === 'de' ? 'su' : SIDE === 'jp' ? 'us' : 'de')) as Faction;
/** The bot's build order names German towers; they stand for the arsenal slots every side fills. */
const SLOT_OF: Record<string, string> = {
  mg42: 'mg', flak38: 'lightaa', schreck: 'at', sniper: 'sniper', flamer: 'flamer', pak40: 'atgun', flak88: 'heavyaa', tiger: 'tank',
  bunker: 'bunker', mortar: 'mortar', lefh18: 'howitzer', nebel: 'rockets', depot: 'depot', observer: 'observer', hq: 'hq', workshop: 'workshop',
};
const slot = (k: string) => TOWERS.findIndex((t) => t.slot === SLOT_OF[k]);
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

/** Cells under the straight lines aircraft fly, entry to exit. */
function airCells(sim: Sim): number[] {
  const out: number[] = [];
  for (const r of sim.map.routes) {
    const [x0, y0] = r.airFrom;
    const [x1, y1] = r.airTo;
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / TILE);
    for (let k = 0; k <= n; k++) {
      const c = Math.floor((x0 + ((x1 - x0) * k) / n) / TILE);
      const row = Math.floor((y0 + ((y1 - y0) * k) / n) / TILE);
      if (c >= 0 && row >= 0 && c < COLS && row < sim.map.def.rows) out.push(row * COLS + c);
    }
  }
  return out;
}

function routeLength(sim: Sim, fields = sim.fields): number {
  return sim.map.routes.reduce((a, r, k) => a + fields[k].dist[r.entry[r.entry.length >> 1]], 0);
}

/** WW2 build order: MG-42s as the backbone, anti-tank guns against armour, flak against aircraft. */
function chooseWW2(sim: Sim, built: Map<number, number>): number {
  // the German names stand for the arsenal slots, so the same build order plays any side
  const W = (k: string) => slot(k);
  const n = (k: string) => built.get(W(k)) ?? 0;
  const total = [...built.values()].reduce((a, b) => a + b, 0);
  if (sim.wave >= 4 && n('flak38') + 2 * n('flak88') < 1 + total / 7) return W('flak38');
  if (sim.wave >= 2 && n('pak40') + 2 * n('tiger') + 2 * n('flak88') + n('schreck') < 1 + total / 4) {
    if (sim.wave >= 10 && sim.money >= 200) return total % 2 ? W('tiger') : W('flak88');
    return total % 3 === 0 ? W('schreck') : W('pak40');
  }
  if (n('lefh18') > n('observer')) return W('observer');
  if (sim.wave >= 5 && n('workshop') < total / 12) return W('workshop');
  if (sim.money >= 120 && total > 6) {
    const opts = ['mortar', 'lefh18', 'nebel', 'mg42', 'bunker'];
    return W(opts[total % opts.length]);
  }
  if (sim.money >= 40 && total % 3 === 2) return W('mortar');
  return W('mg42');
}

function chooseType(sim: Sim, built: Map<number, number>): number {
  if (WW2) return chooseWW2(sim, built);
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
  if (WW2) {
    // keep the line standing: rebuild rubble and patch up badly damaged emplacements first
    const hurt = sim.towers.filter((t) => sim.repairCost(t) > 0 && (t.wreck || t.hp < sim.maxHp(t) * 0.5)).sort((a, b) => Number(b.wreck) - Number(a.wreck) || b.spent - a.spent);
    let fixed = false;
    for (const t of hurt) if (sim.money >= sim.repairCost(t) && sim.exec({ t: 'repair', ids: [t.id] })) fixed = true;
    if (fixed) return;
    // one workshop per dozen emplacements once the enemy shoots back in earnest
    const shops = built.get(slot('workshop')) ?? 0;
    if (sim.wave >= 5 && shops < sim.towers.length / 12 && sim.money < sim.cost(slot('workshop'))) return;
  }
  // upgrade the busiest tower when it beats building
  const best = [...sim.towers].filter((t) => sim.upgradeCost(t) > 0).sort((a, b) => b.damage - a.damage)[0];
  const needs = WW2 && chooseWW2(sim, built) !== slot('mg42') && chooseWW2(sim, built) !== slot('mortar');
  if (best && !needs && sim.towers.length > 12 && sim.money >= sim.upgradeCost(best) && sim.upgradeCost(best) < 120) {
    sim.exec({ t: 'upgrade', ids: [best.id] });
    return;
  }
  const type = chooseType(sim, built);
  if (sim.money < sim.cost(type)) return;
  const aa = WW2 && (type === slot('flak38') || type === slot('flak88')) && sim.wave >= 4;
  const path = aa ? airCells(sim) : pathCells(sim);
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
  const sim = Sim.create({ map, difficulty, modifiers: [], perks: {}, seed, ww2: WW2 ? { side: SIDE, foe: FOE } : undefined });
  const built = new Map<number, number>();
  const share = Number(process.env.PARTNER ?? 0);
  const solo = !!process.env.SOLO;
  const partner = share || solo ? new Partner(solo ? 1 : share) : null;
  let thinkMs = 0;
  let thinkMax = 0;
  let thinks = 0;
  let slow = 0;
  const leaks = new Map<number, number>();
  sim.exec({ t: 'wave' });
  let lastWave = 0;
  for (let tick = 0; tick < 60 * 60 * 40 && !sim.gameOver && !sim.victory; tick++) {
    if (process.env.VERBOSE && sim.wave !== lastWave) {
      lastWave = sim.wave;
      const kinds = new Map<string, number>();
      for (const t of sim.towers) kinds.set(TOWERS[t.type].kind, (kinds.get(TOWERS[t.type].kind) ?? 0) + 1);
      console.log(`  w${sim.wave} t${(sim.time | 0)}s lives ${sim.lives} money ${sim.money | 0} wrecks ${sim.towers.filter((t) => t.wreck).length} hurt ${sim.towers.filter((t) => t.hp < sim.maxHp(t)).length} towers ${[...kinds].map(([k, n]) => k + n).join(' ')} leaks ${JSON.stringify([...leaks])}`);
    }
    if (tick % 30 === 0 && !solo) decide(sim, built);
    if (partner && tick % PARTNER_EVERY === 0) {
      const t0 = performance.now();
      const cmd = partner.think(sim);
      const ms = performance.now() - t0;
      thinkMs += ms;
      thinkMax = Math.max(thinkMax, ms);
      if (ms > 16) slow++;
      thinks++;
      if (cmd) sim.exec(cmd);
    }
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
  if (thinks && process.env.VERBOSE) console.log(`  partner think: avg ${(thinkMs / thinks).toFixed(2)} ms, max ${thinkMax.toFixed(1)} ms, ${slow} over 16 ms, of ${thinks}`);
  if (process.env.VERBOSE) console.log('  leaks by kind', JSON.stringify([...leaks].map(([k, n]) => `${k}:${n}`)));
  return { wave: sim.wave, win: sim.victory, lives: sim.lives, towers: sim.towers.length };
}

const diffs = (process.env.DIFF ?? 'easy,normal,hard').split(',') as Difficulty[];
const maps = (process.env.MAPS ?? '0,1,2,3,4').split(',').map(Number);
const seeds = Number(process.env.SEEDS ?? 1); // SEEDS=n plays each game n times with different seeds
for (const m of maps) {
  for (const d of diffs) {
    for (let k = 0; k < seeds; k++) {
      const t0 = Date.now();
      const r = play(MAPS[m], d, 42 + k);
      console.log(`${MAPS[m].name.padEnd(14)} ${d.padEnd(7)} ${r.win ? 'WIN ' : 'lost'} wave ${String(r.wave).padStart(2)}/${TOTAL_WAVES} lives ${String(r.lives).padStart(2)} towers ${r.towers}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    }
  }
}
