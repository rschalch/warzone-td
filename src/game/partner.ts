// The AI partner for "Co-op with AI": a second commander sharing the bank. It only reads the simulation
// and answers with ordinary Commands (placements tagged `by: PARTNER`), which the session applies and
// logs like any player action, so replays and saves need nothing special. It reads the next wave to
// decide what the defence lacks (anti-air, radar, jammers, armour piercing, crowd control), builds
// where a tower covers most of the route or lengthens the maze, and upgrades its own towers.
// It never sells or touches the player's towers, and spends at most its share of the war chest.
// No randomness: the same game state always gives the same decision.

import type { Command } from './commands';
import { COLS, ENEMIES, TILE, TOWERS, towerIndex, type TowerKind } from './defs';
import type { Sim, Tower } from './sim';

/** Owner id of the partner's towers (the player's are 0). */
export const PARTNER = 1;

export const PARTNER_ROLES: { name: string; share: number; desc: string }[] = [
  { name: 'Support', share: 0.3, desc: 'spends up to 30% of the bank' },
  { name: 'Equal', share: 0.5, desc: 'spends up to half the bank' },
  { name: 'Lead', share: 0.7, desc: 'spends up to 70% of the bank' },
];

/** How often the partner thinks (ticks). A placement takes a few thinks (see Plan). */
export const PARTNER_EVERY = 5;
/** Ticks between fresh decisions when no placement is in progress. */
const DECIDE_EVERY = 20;

interface Threat {
  air: number; // fractions of the wave's total hp
  stealth: number;
  shielded: number; // shields and medics
  armored: number;
  swarm: number; // many light units
}

const IDX = (k: TowerKind) => towerIndex(k);

/** Spots given the full placement check (a path search each) per placement, and per think, so no
 *  single tick spends more than a few milliseconds on the partner (each check searches every route). */
const MAX_CHECKS = 14;
const CHECKS_PER_THINK = 6;

/** A placement being worked out over several thinks; dropped if a tower is built or sold meanwhile. */
interface Plan {
  type: number;
  version: number;
  cands: { c: number; r: number; cover: number }[];
  k: number;
  valid: number;
  before: number;
  best: { c: number; r: number } | null;
  bestScore: number;
}

/** Spots around a path cell for a 2×2 footprint (top-left corner offsets), nearest first. */
const RING = [[-2, -1], [1, -1], [-1, -2], [-1, 1], [-3, -1], [2, -1], [-1, -3], [-1, 2], [-3, -3], [2, 2], [-3, 2], [2, -3]];

export class Partner {
  /** Lines for the player; the UI drains this. */
  readonly said: string[] = [];
  private actions = 0;
  private spoken = new Set<string>();
  private greeted = false;
  private plan: Plan | null = null;

  constructor(private readonly share: number) {}

  private say(key: string, text: string): void {
    if (this.spoken.has(key)) return;
    this.spoken.add(key);
    this.said.push(text);
  }

  /** Money the partner may still spend: its share of everything invested plus the bank. */
  budget(sim: Sim): number {
    let mine = 0;
    let theirs = 0;
    for (const t of sim.towers) {
      if (t.owner === PARTNER) mine += t.spent;
      else theirs += t.spent;
    }
    return Math.min(sim.money, this.share * (mine + theirs + sim.money) - mine);
  }

  think(sim: Sim): Command | null {
    if (sim.gameOver || sim.victory) return null;
    if (!this.greeted) {
      this.greeted = true;
      this.said.push(`Ready when you are. I'll spend up to ${Math.round(this.share * 100)}% of the bank — my towers have a cyan ring.`);
    }
    const budget = this.budget(sim);
    if (this.plan && this.plan.version !== this.layout(sim)) this.plan = null;
    if (this.plan) {
      const cost = sim.cost(this.plan.type);
      if (cost > budget) return null;
      // spare money goes into upgrades while the placement is being worked out
      if (sim.ticks % DECIDE_EVERY === 0) {
        const own = sim.towers.filter((t) => t.owner === PARTNER);
        const up = own.length >= 8 ? this.bestUpgrade(sim, own, budget - cost) : null;
        if (up) return { t: 'upgrade', ids: [up.id] };
      }
      return this.continuePlan(sim);
    }
    if (budget < 8 || sim.ticks % DECIDE_EVERY) return null;
    const own = sim.towers.filter((t) => t.owner === PARTNER);
    const threat = this.threat(sim);

    // upgrade every third action once the partner has a real defence
    if (own.length >= 8 && this.actions % 3 === 2) {
      const up = this.bestUpgrade(sim, own, Infinity);
      if (up) {
        if (sim.upgradeCost(up) > budget) return null; // save up for it
        this.actions++;
        if (up.level + 1 === 4 || up.level + 1 === 9) this.say(`up${up.id}:${up.level}`, `Upgraded my ${TOWERS[up.type].short} to level ${up.level + 2}.`);
        return { t: 'upgrade', ids: [up.id] };
      }
    }

    const type = this.chooseType(sim, threat);
    if (type < 0) return null;
    if (sim.cost(type) > budget) return null; // save up for it
    this.plan = this.startPlan(sim, type);
    if (this.plan) return null; // placed over the next few thinks
    // nowhere useful to build it: put the money into an upgrade instead
    const up = this.bestUpgrade(sim, own, budget);
    if (!up) return null;
    this.actions++;
    return { t: 'upgrade', ids: [up.id] };
  }

  /** Changes when a tower is built or sold (not on upgrades), which is what invalidates a placement plan. */
  private layout(sim: Sim): number {
    return sim.towers.length * 1e6 + (sim.towers.length ? sim.towers[sim.towers.length - 1].id : 0);
  }

  /** Runs a few placement checks; places the tower once the best spot is known. */
  private continuePlan(sim: Sim): Command | null {
    const p = this.plan!;
    const def = TOWERS[p.type];
    const quick = def.kind === 'radar' || (def.hitsAir && !def.hitsGround) || def.walkable;
    const checks = Math.max(1, Math.floor(CHECKS_PER_THINK / sim.map.routes.length));
    for (let n = 0; n < checks && p.k < p.cands.length && p.k < MAX_CHECKS && p.valid < 5; n++) {
      const cd = p.cands[p.k++];
      if (sim.placeStatus(p.type, cd.c, cd.r) !== 'ok') continue;
      p.valid++;
      // coverage is all that matters for radars and anti-air; ground towers also weigh the maze
      const prev = quick ? null : sim.preview(p.type, cd.c, cd.r);
      const gain = prev ? Math.max(0, this.routeLength(sim, prev) - p.before) : 0;
      const score = cd.cover + gain * 1.5;
      if (score > p.bestScore) {
        p.bestScore = score;
        p.best = cd;
      }
      if (quick) p.k = p.cands.length;
    }
    if (p.k < p.cands.length && p.k < MAX_CHECKS && p.valid < 5) return null;
    this.plan = null;
    this.actions++;
    if (p.best) return { t: 'place', type: p.type, col: p.best.c, row: p.best.r, by: PARTNER };
    // nowhere it can go right now: an upgrade instead
    const up = this.bestUpgrade(sim, sim.towers.filter((t) => t.owner === PARTNER), this.budget(sim));
    return up ? { t: 'upgrade', ids: [up.id] } : null;
  }

  // ------------------------------------------------------------ reading the battle

  /** What the next wave (and the one after) is made of, by share of hit points. */
  private threat(sim: Sim): Threat {
    const th: Threat = { air: 0, stealth: 0, shielded: 0, armored: 0, swarm: 0 };
    let total = 0;
    for (const w of [sim.wave + 1, sim.wave + 2]) {
      for (const g of sim.waveGroups(w)) {
        const e = ENEMIES[g.kind];
        const hp = e.hp * g.count * (w === sim.wave + 1 ? 1 : 0.6);
        total += hp;
        if (e.air) th.air += hp;
        if (e.stealth) th.stealth += hp;
        if (e.shield || e.heal) th.shielded += hp;
        if (e.armor >= 3) th.armored += hp;
        if (e.hp < 60 && g.count >= 10) th.swarm += hp;
      }
    }
    if (total > 0) for (const k of Object.keys(th) as (keyof Threat)[]) th[k] /= total;
    return th;
  }

  private dps(t: Tower, air: boolean): number {
    const def = TOWERS[t.type];
    if (air ? !def.hitsAir : !def.hitsGround) return 0;
    const lv = def.levels[t.level];
    return lv.damage * Math.max(lv.rate, 1) * (air ? def.airMult : 1);
  }

  private count(sim: Sim, kind: TowerKind): number {
    let n = 0;
    for (const t of sim.towers) if (t.kind === kind) n++;
    return n;
  }

  private pick(sim: Sim, kinds: TowerKind[]): number {
    const ok = kinds.map(IDX).filter((i) => i >= 0 && sim.allowed(i));
    return ok.length ? ok[this.actions % ok.length] : -1;
  }

  private chooseType(sim: Sim, th: Threat): number {
    let airDps = 0;
    let groundDps = 0;
    for (const t of sim.towers) {
      airDps += this.dps(t, true);
      groundDps += this.dps(t, false);
    }
    const allowed = (k: TowerKind) => IDX(k) >= 0 && sim.allowed(IDX(k));

    // stealth: radars until most of the route is watched
    if (th.stealth > 0.05 && allowed('radar') && this.radarCover(sim) < 0.6 && this.count(sim, 'radar') < 3 + 2 * sim.map.routes.length) {
      this.say(`stealth${sim.wave}`, 'Stealth units coming. Putting up a Radar.');
      return IDX('radar');
    }
    // air: keep anti-air in step with the share of helicopters
    if (th.air > 0.1 && airDps < (groundDps + airDps) * th.air * 1.1) {
      this.say(`air${sim.wave}`, 'Helicopters inbound. Building anti-air.');
      if (sim.wave >= 3 && allowed('flak') && this.count(sim, 'flak') <= this.count(sim, 'missile')) return IDX('flak');
      const t = this.pick(sim, ['missile', 'gun', 'flak']);
      if (t >= 0) return t;
    }
    // shields and medics: one jammer per route
    if (th.shielded > 0.12 && allowed('jammer') && this.count(sim, 'jammer') < sim.map.routes.length) {
      this.say(`jam${sim.wave}`, 'Shielded units ahead. A Jammer will strip their shields.');
      return IDX('jammer');
    }
    // early on: cheap guns that also build the maze
    const own = sim.towers.reduce((n, t) => n + (t.owner === PARTNER ? 1 : 0), 0);
    if (own < 5) return this.pick(sim, own % 3 === 2 ? ['cannon', 'gun'] : ['gun']);
    if (th.armored > 0.35) {
      this.say(`armor${sim.wave}`, 'Heavy armour next. Bringing lasers and cannons.');
      return this.pick(sim, ['laser', 'cannon', 'sniper', 'acid', 'laser']);
    }
    if (th.swarm > 0.4) return this.pick(sim, ['tesla', 'napalm', 'gas', 'flame', 'gun']);
    if (own > 14 && this.count(sim, 'command') < 1 && allowed('command')) return IDX('command');
    return this.pick(sim, ['gun', 'cannon', 'tesla', 'laser', 'napalm', 'gun', 'sniper', 'cryo']);
  }

  /** The own tower that has earned its keep the most per dollar, among the upgrades it can afford. */
  private bestUpgrade(sim: Sim, own: Tower[], budget: number): Tower | null {
    let best: Tower | null = null;
    let score = -1;
    for (const t of own) {
      const cost = sim.upgradeCost(t);
      if (cost <= 0 || cost > budget) continue;
      const s = (t.damage + 50) / t.spent;
      if (s > score) {
        score = s;
        best = t;
      }
    }
    return best;
  }

  // ------------------------------------------------------------ where to build

  /** Ground path cells of every route, entry to exit. */
  private pathCells(sim: Sim, routeOf?: number[]): number[] {
    const out: number[] = [];
    sim.map.routes.forEach((r, k) => {
      const f = sim.fields[k];
      let c = r.entry[r.entry.length >> 1];
      for (let g = 0; g < 4000 && c >= 0 && f.dist[c] > 0; g++) {
        out.push(c);
        routeOf?.push(k);
        c = f.next[c];
      }
    });
    return out;
  }

  /** Cells under the air lanes (straight lines from where aircraft appear to where they leave). */
  private airCells(sim: Sim, routeOf?: number[]): number[] {
    const out: number[] = [];
    for (const [k, r] of sim.map.routes.entries()) {
      const [x0, y0] = r.airFrom;
      const [x1, y1] = r.airTo;
      const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / TILE);
      for (let s = 0; s <= n; s++) {
        const c = Math.floor((x0 + ((x1 - x0) * s) / n) / TILE);
        const row = Math.floor((y0 + ((y1 - y0) * s) / n) / TILE);
        if (c >= 0 && row >= 0 && c < COLS && row * COLS + c < sim.blocked.length) {
          out.push(row * COLS + c);
          routeOf?.push(k);
        }
      }
    }
    return out;
  }

  /** Per route: 1 / (1 + towers that can hit some of its cells / 4). */
  private routeWeights(sim: Sim, target: number[], routeOf: number[], air: boolean): number[] {
    const n = sim.map.routes.length;
    if (n === 1) return [1];
    const guarded = new Array<number>(n).fill(0);
    for (const t of sim.towers) {
      const def = TOWERS[t.type];
      if (air ? !def.hitsAir : !def.hitsGround) continue;
      const r2 = def.levels[t.level].range ** 2;
      const hit = new Array<boolean>(n).fill(false);
      for (let q = 0; q < target.length; q += 3) {
        const k = routeOf[q];
        if (hit[k]) continue;
        const dx = ((target[q] % COLS) + 0.5) * TILE - t.x;
        const dy = (((target[q] / COLS) | 0) + 0.5) * TILE - t.y;
        if (dx * dx + dy * dy <= r2) hit[k] = true;
      }
      hit.forEach((h, k) => h && guarded[k]++);
    }
    return guarded.map((g) => 1 / (1 + g / 4));
  }

  private radarCover(sim: Sim): number {
    const path = this.pathCells(sim);
    if (!path.length) return 1;
    let seen = 0;
    for (const c of path) seen += sim.radarGrid[c];
    return seen / path.length;
  }

  private routeLength(sim: Sim, fields: readonly { dist: Float32Array }[] = sim.fields): number {
    return sim.map.routes.reduce((a, r, k) => a + fields[k].dist[r.entry[r.entry.length >> 1]], 0);
  }

  /** Scores every free spot near the route by coverage (cheap); the path checks come in continuePlan. */
  private startPlan(sim: Sim, type: number): Plan | null {
    const def = TOWERS[type];
    const airOnly = def.hitsAir && !def.hitsGround;
    const routeOf: number[] = [];
    const target = airOnly ? this.airCells(sim, routeOf) : this.pathCells(sim, routeOf);
    if (!target.length) return null;
    const range = Math.max(60, def.levels[0].range);
    const r2 = range * range;
    const radar = def.kind === 'radar';
    const half = (def.size * TILE) / 2;

    // pass 1: cheap coverage score for every free spot next to the route
    // centres of the cells worth covering (radars: only those no radar watches yet)
    // with several routes, the thinly defended ones count more, so no route is left open
    const weight = this.routeWeights(sim, target, routeOf, airOnly);
    const px: number[] = [];
    const py: number[] = [];
    const pw: number[] = [];
    target.forEach((p, q) => {
      if (radar && sim.radarGrid[p]) return;
      px.push(((p % COLS) + 0.5) * TILE);
      py.push((((p / COLS) | 0) + 0.5) * TILE);
      pw.push(weight[routeOf[q]]);
    });
    const cands: { c: number; r: number; cover: number }[] = [];
    const seen = new Set<number>();
    const step = target.length > 400 ? 3 : 2;
    for (let k = 0; k < target.length; k += step) {
      const pc = target[k] % COLS;
      const pr = (target[k] / COLS) | 0;
      for (const [dc, dr] of RING) {
        const c = pc + dc;
        const r = pr + dr;
        const key = r * COLS + c;
        if (seen.has(key)) continue;
        seen.add(key);
        if (!sim.footprintFree(type, c, r)) continue;
        const x = c * TILE + half;
        const y = r * TILE + half;
        let cover = 0;
        for (let q = 0; q < px.length; q++) {
          const dx = px[q] - x;
          const dy = py[q] - y;
          if (dx * dx + dy * dy <= r2) cover += pw[q];
        }
        // a radar only helps where guns can shoot what it reveals (and it extends their range)
        if (radar && cover > 0) {
          for (const t of sim.towers) {
            if (t.kind !== 'radar' && TOWERS[t.type].hitsGround && (t.x - x) ** 2 + (t.y - y) ** 2 <= r2) cover += 4;
          }
        }
        if (cover > 0) cands.push({ c, r, cover });
      }
    }
    if (!cands.length) return null;
    cands.sort((a, b) => b.cover - a.cover || a.r - b.r || a.c - b.c);
    return { type, version: this.layout(sim), cands, k: 0, valid: 0, before: this.routeLength(sim), best: null, bestScore: -1 };
  }
}
