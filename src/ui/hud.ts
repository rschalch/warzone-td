import {
  CATEGORIES, COMBOS, RANKS, EN_AEGIS, EN_BOSS, EN_GHOST, EN_HELI, EN_MEDIC, ENEMIES, TARGET_MODES, TOTAL_WAVES, TOWERS, hpScale,
  type TowerDef, type TowerLevel,
} from '../game/defs';
import { DIFFICULTIES } from '../game/config';
import { HERO_ABILITIES, HERO_MAX_LEVEL, ITEMS, type Sim, type Tower, type TowerStats } from '../game/sim';
import { ABILITY_HELP, ENEMY_HELP, HERO_HELP, ITEM_HELP, MOUNTAIN_HELP, RIVER_HELP, TOWER_HELP } from './codex';
import { T_MOUNT, T_WATER, WATER_SLOW } from '../game/maps';

/** Something to explain in the side panel (hovered button, or a target being aimed). */
export type Inspect = { kind: 'tower' | 'item' | 'ability' | 'hero' | 'super'; index: number };

export interface HudActions {
  pick(type: number): void;
  upgrade(): void;
  sell(): void;
  upgradeAllOfType(): void;
  mode(m: number): void;
  gate(): void;
  fire(): void;
  next(): void;
  speed(s: number): void;
  menu(): void;
  camera(): void;
  settings(): void;
  undo(): void;
  stress(): void;
  item(i: number): void;
  hero(): void;
  ability(a: number): void;
  multiUpgrade(): void;
  multiSell(): void;
  skipWave(): void;
}

/** What the HUD needs to know about the player's interaction state. */
export interface UiState {
  placing: number;
  selected: Tower | null;
  multi: Tower[];
  heroSelected: boolean;
  speed: number;
  mode: 'local' | 'replay' | 'coop';
  banner: string;
  /** Item, ability or superweapon waiting for its target click. */
  aiming: Inspect | null;
  /** Enemy slot being inspected, or -1. */
  enemy: number;
  /** Terrain type of the cell under the cursor (T_* in maps.ts), or -1. */
  ground: number;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
const num = (n: number) => (Math.abs(n - Math.round(n)) < 0.05 ? `${Math.round(n)}` : n.toFixed(1));
const pct = (f: number) => `${Math.round(f * 100)}%`;
/** Kinds whose damage figure is per second rather than per shot. */
const DPS_KINDS = new Set(['laser', 'flame', 'napalm', 'gas', 'gravity', 'spikes', 'hacker', 'orbital', 'blackhole']);
const AURA_KINDS = new Set(['jammer', 'radar', 'command', 'salvage']);

/** Stat rows for a tower level; `eff` overrides damage/range/rate with buffed values. */
function stats(def: TowerDef, lv: TowerLevel, eff?: TowerStats): [string, string][] {
  const rows: [string, string][] = [];
  const dmg = eff?.damage ?? lv.damage;
  const range = eff?.range ?? lv.range;
  const rate = eff?.rate ?? lv.rate;
  if (lv.damage) rows.push([def.kind === 'hacker' ? 'Hijacked DPS' : DPS_KINDS.has(def.kind) ? 'DPS' : 'Damage', num(dmg)]);
  if (lv.range > 14) rows.push([AURA_KINDS.has(def.kind) ? 'Radius' : 'Range', num(range)]);
  if (lv.rate && !lv.charge) rows.push([def.kind === 'mine' ? 'Re-arm' : 'Rate', def.kind === 'mine' ? `${num(1 / rate)}s` : `${num(rate)}/s`]);
  if (lv.splash) rows.push(['Splash', `${lv.splash}`]);
  if (lv.chain) rows.push(['Chain', `${lv.chain}`]);
  if (lv.slow) rows.push(['Slow', pct(1 - lv.slow)]);
  if (lv.burn) rows.push(['Burn', `${lv.burn}/s`]);
  if (lv.shred) rows.push(['Armour shred', `${lv.shred}`]);
  if (lv.chill) rows.push(['Chill per hit', pct(lv.chill)]);
  if (lv.pull) rows.push(['Pull', `${lv.pull}px/s`]);
  if (lv.knock) rows.push(['Knockback', `${lv.knock}px`]);
  if (lv.duration) rows.push([def.kind === 'hacker' ? 'Hack time' : 'Lasts', `${lv.duration}s`]);
  if (lv.buff) {
    const label = { radar: 'Range bonus', command: 'Fire-rate bonus', salvage: 'Bounty bonus', jammer: 'Extra damage taken' }[def.kind as string] ?? 'Bonus';
    rows.push([label, `+${pct(lv.buff)}`]);
  }
  if (lv.income) rows.push(['Per wave', `$${lv.income} + ${pct(lv.interest ?? 0)} (max $${lv.cap})`]);
  if (lv.charge) rows.push(['Recharge', `${lv.charge}s`]);
  if (lv.drones) rows.push(['Drones', `${lv.drones}`]);
  return rows;
}

/** Counters for specific threats, shown in the wave preview. */
const THREAT_TIPS: Record<number, string> = {
  [EN_GHOST]: 'stealth — radar, or towers point-blank',
  [EN_AEGIS]: 'shields — jam them',
  [EN_MEDIC]: 'heals — focus it',
  [EN_HELI]: 'air — flies over the maze',
  [EN_BOSS]: 'boss',
};

/** DOM HUD. Every write is diffed so per-frame updates cost almost nothing. */
export class Hud {
  private readonly money = $('money');
  private readonly lives = $('lives');
  private readonly wave = $('wave');
  private readonly kills = $('kills');
  private readonly next = $<HTMLButtonElement>('next');
  private readonly cameraBtn = $<HTMLButtonElement>('camera');
  private readonly undoBtn = $<HTMLButtonElement>('undo');
  private readonly info = $('info');
  private readonly waveBox = $('wavebox');
  private readonly tactical = $('tactical');
  private readonly report = $('report');
  private readonly bannerEl = $('banner');
  private readonly perf = $('perf');
  private readonly perfText: HTMLSpanElement;
  private readonly buttons: HTMLButtonElement[] = []; // indexed by tower type
  private readonly speedBtns: HTMLButtonElement[];
  private readonly itemBtns: HTMLButtonElement[] = [];
  private readonly abilityBtns: HTMLButtonElement[] = [];
  private readonly heroBtn: HTMLButtonElement;
  private cache = new Map<HTMLElement, string>();
  private infoKey = '';
  private reportTimer = 0;
  /** Recent damage totals per tower, sampled once a second, for live DPS. */
  private dmgSamples = new Map<number, number[]>();
  private lastSample = 0;
  /** Button under the mouse: its description replaces the panel while hovered. */
  private hover: Inspect | null = null;
  constructor(act: HudActions) {
    // every tower at once, grouped by category; the first ten have number keys
    const build = $('build');
    for (const c of CATEGORIES) {
      const h = document.createElement('div');
      h.className = 'cat';
      h.textContent = c.name;
      build.appendChild(h);
      TOWERS.forEach((t, i) => {
        if (t.cat !== c.id) return;
        const b = document.createElement('button');
        b.className = 'tb';
        const key = i < 10 ? `<span class="k">${(i + 1) % 10}</span>` : '';
        b.innerHTML = `<span class="sw" style="background:${hex(t.color)}"></span><span class="ic"></span><span class="tx"><span class="n">${t.short}</span><span class="c">$${t.levels[0].cost}</span></span>${key}`;
        b.title = `${t.name} — ${t.desc}`;
        b.onclick = () => act.pick(i);
        this.hoverable(b, { kind: 'tower', index: i });
        build.appendChild(b);
        this.buttons[i] = b;
      });
    }
    this.next.onclick = () => act.next();
    $('menu').onclick = () => act.menu();
    $('gear').onclick = () => act.settings();
    this.undoBtn.onclick = () => act.undo();
    this.cameraBtn.onclick = () => act.camera();
    this.speedBtns = [...$('speed').querySelectorAll('button')] as HTMLButtonElement[];
    for (const b of this.speedBtns) b.onclick = () => act.speed(Number(b.dataset.speed));

    // tactical bar: hero + abilities, then items
    this.heroBtn = document.createElement('button');
    this.heroBtn.className = 'hero';
    this.heroBtn.title = 'Select your commander (H). Then click the ground to move.';
    this.heroBtn.onclick = () => act.hero();
    this.hoverable(this.heroBtn, { kind: 'hero', index: 0 });
    this.tactical.appendChild(this.heroBtn);
    HERO_ABILITIES.forEach((a, k) => {
      const b = document.createElement('button');
      b.className = 'ab';
      b.title = `${a.name} (${a.key}) — ${a.desc} Cooldown ${a.cd}s.`;
      b.onclick = () => act.ability(k);
      this.hoverable(b, { kind: 'ability', index: k });
      this.tactical.appendChild(b);
      this.abilityBtns.push(b);
    });
    const sep = document.createElement('span');
    sep.className = 'sep';
    this.tactical.appendChild(sep);
    ITEMS.forEach((it, k) => {
      const b = document.createElement('button');
      b.className = 'it';
      b.title = `${it.name} (${it.key}) — ${it.desc} Recharges one per wave.`;
      b.onclick = () => act.item(k);
      this.hoverable(b, { kind: 'item', index: k });
      this.tactical.appendChild(b);
      this.itemBtns.push(b);
    });

    this.perfText = document.createElement('span');
    const stress = document.createElement('button');
    stress.textContent = 'Stress test';
    stress.title = 'Build a serpentine maze of maxed towers and spawn 3000 enemies';
    stress.onclick = () => act.stress();
    this.perf.append(this.perfText, stress);

    this.info.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest('button');
      if (!el) return;
      const a = el.dataset.act;
      if (a === 'up') act.upgrade();
      else if (a === 'sell') act.sell();
      else if (a === 'uptype') act.upgradeAllOfType();
      else if (a === 'gate') act.gate();
      else if (a === 'fire') act.fire();
      else if (a === 'mup') act.multiUpgrade();
      else if (a === 'msell') act.multiSell();
      else if (el.dataset.ab) act.ability(Number(el.dataset.ab));
      else if (el.dataset.mode) act.mode(Number(el.dataset.mode));
    });
    this.bannerEl.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('[data-act="skip"]')) act.skipWave();
    });
  }

  /** Per-game setup: perk-adjusted prices and the towers this game allows. */
  configure(sim: Sim): void {
    this.buttons.forEach((b, i) => {
      b.querySelector('.c')!.textContent = `$${sim.cost(i)}`;
      b.classList.toggle('locked', !sim.allowed(i));
      b.disabled = !sim.allowed(i);
    });
    this.dmgSamples.clear();
    this.lastSample = 0;
    this.infoKey = '';
    this.cache.clear();
    this.report.classList.remove('show');
  }

  private hoverable(el: HTMLElement, what: Inspect): void {
    el.addEventListener('mouseenter', () => (this.hover = what));
    el.addEventListener('mouseleave', () => {
      if (this.hover === what) this.hover = null;
    });
  }

  /** Puts a picture of each tower on its button (needs the baked atlas). */
  setIcons(icon: (type: number) => HTMLCanvasElement): void {
    this.buttons.forEach((b, i) => b.querySelector('.ic')!.replaceChildren(icon(i)));
  }

  /** Keeps the picked tower's button in view (the palette can scroll on small screens). */
  reveal(type: number): void {
    this.buttons[type]?.scrollIntoView({ block: 'nearest' });
  }

  private set(el: HTMLElement, text: string, html = false): void {
    if (this.cache.get(el) === text) return;
    this.cache.set(el, text);
    if (html) el.innerHTML = text;
    else el.textContent = text;
  }

  update(sim: Sim, ui: UiState): void {
    this.set(this.money, `$${Math.floor(sim.money)}`);
    this.set(this.lives, `${sim.lives}`);
    this.lives.classList.toggle('low', sim.lives <= 5);
    this.set(this.wave, sim.endless ? `${sim.wave}` : `${sim.wave}/${TOTAL_WAVES}`);
    this.set(this.kills, `${sim.totalKills}`);

    let label: string;
    if (sim.wave === 0) label = 'Start wave 1';
    else if (!sim.canCallWave) label = 'Final wave';
    else if (sim.spawning) label = `Wave ${sim.wave + 1} early`;
    else label = `Wave ${sim.wave + 1} in ${Math.ceil(sim.nextWaveTimer)}s (+$${sim.earlyBonus})`;
    this.set(this.next, label);
    const replay = ui.mode === 'replay';
    this.next.disabled = !sim.canCallWave || replay;
    this.undoBtn.disabled = !sim.canUndo || replay;
    this.set(this.bannerEl, ui.banner, true);
    this.bannerEl.classList.toggle('show', !!ui.banner);

    for (let i = 0; i < this.buttons.length; i++) {
      const b = this.buttons[i];
      b.classList.toggle('on', ui.placing === i);
      b.classList.toggle('poor', sim.money < sim.cost(i));
    }
    for (const b of this.speedBtns) b.classList.toggle('on', Number(b.dataset.speed) === ui.speed);

    this.sampleDps(sim);
    this.updateWaveBox(sim);
    this.updateTactical(sim, ui);
    this.updateInfo(sim, ui);
  }

  private sampleDps(sim: Sim): void {
    if (sim.time - this.lastSample < 1) return;
    this.lastSample = sim.time;
    for (const t of sim.towers) {
      let arr = this.dmgSamples.get(t.id);
      if (!arr) this.dmgSamples.set(t.id, (arr = []));
      arr.push(t.damage);
      if (arr.length > 6) arr.shift();
    }
  }

  private dps(t: Tower): number {
    const arr = this.dmgSamples.get(t.id);
    if (!arr || arr.length < 2) return 0;
    return (arr[arr.length - 1] - arr[0]) / (arr.length - 1);
  }

  private updateWaveBox(sim: Sim): void {
    const n = sim.wave + 1;
    const key = `${n}:${sim.canCallWave}`;
    if (this.cache.get(this.waveBox) === key) return;
    this.cache.set(this.waveBox, key);
    if (!sim.canCallWave) {
      this.waveBox.innerHTML = '<div class="wt">Final wave underway</div>';
      return;
    }
    const counts = new Map<number, number>();
    for (const g of sim.waveGroups(n)) counts.set(g.kind, (counts.get(g.kind) ?? 0) + g.count);
    const hp = hpScale(n) * DIFFICULTIES[sim.config.difficulty].hp;
    const rows = [...counts].map(([k, c]) => `<div><b>${c}×</b> ${ENEMIES[k].name}${THREAT_TIPS[k] ? ` <span class="tip">${THREAT_TIPS[k]}</span>` : ''}</div>`).join('');
    this.waveBox.innerHTML = `<div class="wt">Next: wave ${n} <span class="hp">HP ×${hp.toFixed(1)}</span></div>${rows}`;
  }

  private updateTactical(sim: Sim, ui: UiState): void {
    const h = sim.hero;
    this.tactical.style.display = h ? '' : 'none';
    if (!h) return;
    this.set(this.heroBtn, `<b>Commander</b><span>Lv ${h.level}${h.level < HERO_MAX_LEVEL ? ` · ${Math.floor((h.xp / sim.heroNextXp(h.level)) * 100)}%` : ' · max'}</span><span class="k">H</span>`, true);
    this.heroBtn.classList.toggle('on', ui.heroSelected);
    HERO_ABILITIES.forEach((a, k) => {
      const cd = h.cd[k];
      this.set(this.abilityBtns[k], `<b>${a.name}</b><span>${cd > 0 ? `${Math.ceil(cd)}s` : 'ready'}</span><span class="k">${a.key}</span>`, true);
      this.abilityBtns[k].disabled = cd > 0 || ui.mode === 'replay';
    });
    ITEMS.forEach((it, k) => {
      this.set(this.itemBtns[k], `<b>${it.name}</b><span>×${sim.items[k]}</span><span class="k">${it.key}</span>`, true);
      this.itemBtns[k].disabled = sim.items[k] <= 0 || ui.mode === 'replay';
    });
  }

  /** End-of-wave summary: the towers that did the work, and leaks. */
  showReport(sim: Sim, wave: number, damage: Map<number, number>, leaked: number): void {
    const top = [...damage].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const total = [...damage.values()].reduce((a, b) => a + b, 0) || 1;
    const rows = top.map(([id, d]) => {
      const t = id === -1 ? null : sim.tower(id);
      const name = id === -1 ? 'Commander' : t ? `${TOWERS[t.type].short} L${t.level + 1}` : 'Sold tower';
      const color = t ? hex(TOWERS[t.type].color) : '#ffd84a';
      return `<div class="rr"><span class="sw" style="background:${color}"></span>${name}<span class="bar"><i style="width:${Math.round((d / total) * 100)}%"></i></span><b>${Math.round(d)}</b></div>`;
    }).join('');
    this.report.innerHTML = `<div class="wt">Wave ${wave} cleared</div>${rows || '<div class="d">No damage dealt.</div>'}<div class="d">${leaked ? `<span class="bad">${leaked} leaked</span>` : 'Nothing got through.'}</div>`;
    this.report.classList.add('show');
    clearTimeout(this.reportTimer);
    this.reportTimer = window.setTimeout(() => this.report.classList.remove('show'), 7000);
  }

  private updateInfo(sim: Sim, ui: UiState): void {
    const t = ui.selected;
    const what = this.hover ?? ui.aiming;
    let key: string;
    if (what) key = `i${what.kind}:${what.index}:${what === ui.aiming}:${sim.money >= (what.kind === 'tower' ? sim.cost(what.index) : 0)}:${sim.items.join()}:${sim.hero?.cd.map(Math.ceil).join()}`;
    else if (ui.enemy >= 0 && sim.eAlive[ui.enemy]) key = `e${ui.enemy}:${Math.ceil(sim.eHp[ui.enemy])}:${Math.ceil(sim.eShield[ui.enemy])}:${this.enemyStatus(sim, ui.enemy)}`;
    else if (ui.multi.length) key = `m${ui.multi.map((m) => m.id + ':' + m.level).join(',')}:${sim.money >= this.multiCost(sim, ui.multi)}`;
    else if (ui.heroSelected && sim.hero) key = `h${sim.hero.level}:${Math.floor(sim.hero.xp)}:${sim.hero.cd.map(Math.ceil).join(',')}`;
    else if (t) {
      const up = sim.upgradeCost(t);
      const extra = t.kind === 'depot' ? sim.depotIncome : TOWERS[t.type].manual ? Math.floor(sim.chargeLevel(t) * 100) : 0;
      key = `t${t.id}:${t.level}:${t.mode}:${t.kills}:${Math.floor(t.damage / 50)}:${up > 0 && sim.money >= up}:${t.open}:${sim.towerVersion}:${extra}:${Math.round(this.dps(t))}`;
    } else if (ui.placing >= 0) key = `p${ui.placing}:${sim.cost(ui.placing)}`;
    else if (ui.ground === T_WATER || ui.ground === T_MOUNT) key = `g${ui.ground}`;
    else key = 'none';
    if (key === this.infoKey) return;
    this.infoKey = key;
    const ro = ui.mode === 'replay' ? 'disabled' : '';

    if (what) {
      this.info.innerHTML = this.explain(sim, what, what === ui.aiming);
    } else if (ui.enemy >= 0 && sim.eAlive[ui.enemy]) {
      this.info.innerHTML = this.enemyPanel(sim, ui.enemy);
    } else if (ui.multi.length) {
      const cost = this.multiCost(sim, ui.multi);
      const value = ui.multi.reduce((a, m) => a + sim.sellValue(m), 0);
      const kinds = new Map<string, number>();
      for (const m of ui.multi) kinds.set(TOWERS[m.type].short, (kinds.get(TOWERS[m.type].short) ?? 0) + 1);
      this.info.innerHTML = `
        <div class="title">${ui.multi.length} towers<span class="lvl">selection</span></div>
        <div class="desc">${[...kinds].map(([k, n]) => `${n}× ${k}`).join(', ')}</div>
        <div class="row">
          <button data-act="mup" ${cost > 0 && !ro ? '' : 'disabled'}>${cost ? `Upgrade all $${cost}` : 'All maxed'}</button>
          <button data-act="msell" ${sim.canSell && !ro ? '' : 'disabled'}>Sell all $${value}</button>
        </div>
        <div class="desc" style="margin-top:8px">Shift-drag selects a group. Upgrading goes cheapest first, as far as your money reaches.</div>`;
    } else if (ui.heroSelected && sim.hero) {
      const h = sim.hero;
      const abil = HERO_ABILITIES.map((a, k) => `<button data-ab="${k}" ${h.cd[k] > 0 || ro ? 'disabled' : ''}>${a.name}${h.cd[k] > 0 ? ` ${Math.ceil(h.cd[k])}s` : ''}</button>`).join('');
      this.info.innerHTML = `
        <div class="title">Commander<span class="lvl">Lv ${h.level}/${HERO_MAX_LEVEL}</span></div>
        <div class="help">${HERO_HELP}</div>
        <table>
          <tr><td>Damage</td><td>${num(sim.heroDamage())}</td></tr>
          <tr><td>Range</td><td>${num(sim.heroRange())}</td></tr>
          <tr><td>XP</td><td>${h.level < HERO_MAX_LEVEL ? `${Math.floor(h.xp)} / ${sim.heroNextXp(h.level)}` : 'max'}</td></tr>
          <tr><td>Kills</td><td>${h.src.kills}</td></tr>
        </table>
        <div class="row abil">${abil}</div>
        <div class="desc" style="margin-top:8px">${HERO_ABILITIES.map((a) => `<b>${a.key}</b> ${a.name}: ${a.desc}`).join('<br>')}</div>`;
    } else if (t) {
      const def = TOWERS[t.type];
      const lv = def.levels[t.level];
      const up = sim.upgradeCost(t);
      const nextRows = up ? stats(def, def.levels[t.level + 1]) : [];
      const rows = stats(def, lv, sim.stats(t))
        .map(([k, v], i) => `<tr><td>${k}</td><td>${v}</td><td class="up">${nextRows[i] && nextRows[i][1] !== v ? '→ ' + nextRows[i][1] : ''}</td></tr>`)
        .join('');
      const modes = !def.targeted ? '' : `<div class="row modes">${TARGET_MODES.map((m, i) => `<button data-mode="${i}" class="${t.mode === i ? 'on' : ''}" ${ro}>${m}</button>`).join('')}</div>`;
      const combos = t.combos.map((name) => {
        const c = COMBOS.find((o) => o.name === name)!;
        return `<div class="combo"><b>${c.name}</b> ${c.desc}</div>`;
      }).join('');
      let special = '';
      if (def.kind === 'gate') special = `<div class="row"><button data-act="gate" class="primary" ${ro}>${t.open ? 'Close gate (G)' : 'Open gate (G)'}</button></div>`;
      if (def.manual) {
        const c = sim.chargeLevel(t);
        special = `<div class="row"><button data-act="fire" class="primary" ${c < 1 || ro ? 'disabled' : ''}>${c < 1 ? `Charging ${Math.floor(c * 100)}%` : 'Fire! (R)'}</button></div>`;
      }
      if (def.kind === 'depot') special = `<div class="desc">All depots pay <b>$${sim.depotIncome}</b> at the next wave.</div>`;
      const record = def.hitsGround || def.hitsAir ? `
          <tr><td>Live DPS</td><td>${Math.round(this.dps(t))}</td><td></td></tr>
          <tr><td>Kills</td><td>${t.kills}</td><td></td></tr>
          <tr><td>Damage dealt</td><td>${Math.floor(t.damage)}</td><td></td></tr>` : '';
      const sameType = sim.towers.filter((o) => o.type === t.type && sim.upgradeCost(o) > 0).length;
      const hits = [def.hitsGround && 'ground', def.hitsAir && 'air'].filter(Boolean).join(' + ');
      this.info.innerHTML = `
        <div class="title">${def.name}<span class="lvl">${def.levels.length > 1 ? `Lv ${t.level + 1}/${def.levels.length} · ${RANKS[t.level]}` : ''}</span></div>
        ${t.owner ? '<div class="desc partner">Built by your AI partner. It upgrades its own towers; you can still upgrade or sell it.</div>' : ''}
        <div class="help">${TOWER_HELP[def.kind]}</div>
        <table>${rows}${hits ? `<tr><td>Targets</td><td>${hits}</td><td></td></tr>` : ''}${record}</table>
        ${combos}
        ${special}
        ${modes}
        <div class="row">
          <button data-act="up" ${up && sim.money >= up && !ro ? '' : 'disabled'}>${up ? `Upgrade $${up}` : 'Max level'}</button>
          <button data-act="sell" ${sim.canSell && !ro ? '' : 'disabled'}>Sell $${sim.sellValue(t)}</button>
        </div>
        ${sameType > 1 ? `<div class="row"><button data-act="uptype" ${ro}>Upgrade every ${def.short} (${sameType})</button></div>` : ''}`;
    } else if (ui.placing >= 0) {
      const def = TOWERS[ui.placing];
      const rows = stats(def, def.levels[0]).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
      const hits = [def.hitsGround && 'ground', def.hitsAir && 'air'].filter(Boolean).join(' + ');
      const partners = COMBOS.filter((c) => c.a === def.kind || c.b === def.kind)
        .map((c) => `<div class="combo"><b>${c.name}</b> next to ${TOWERS.find((o) => o.kind === (c.a === def.kind ? c.b : c.a))!.short}: ${c.desc}</div>`).join('');
      const how = def.walkable ? 'Goes on the path itself: it never blocks the route.'
        : def.size === 1 ? 'A 1×1 wall. Click or drag to build.'
          : 'Click or drag on the field to build. Enemies path around your towers, but you can\'t fully block them.';
      this.info.innerHTML = `
        <div class="title">${def.name}<span class="lvl">$${sim.cost(ui.placing)}</span></div>
        <div class="help">${TOWER_HELP[def.kind]}</div>
        <table>${rows}${hits ? `<tr><td>Targets</td><td>${hits}</td></tr>` : ''}</table>
        ${partners}
        <div class="desc" style="margin-top:8px">${how}</div>`;
    } else if (ui.ground === T_WATER) {
      this.info.innerHTML = `<div class="title">River<span class="lvl">${Math.round(WATER_SLOW * 100)}% speed</span></div><div class="help">${RIVER_HELP}</div>`;
    } else if (ui.ground === T_MOUNT) {
      this.info.innerHTML = `<div class="title">Mountains<span class="lvl">impassable</span></div><div class="help">${MOUNTAIN_HELP}</div>`;
    } else {
      this.info.innerHTML = `<div class="desc">Pick a tower to build, or click anything on the battlefield — a tower, an enemy, your commander — to see what it does. Hover any button for a description. Shift-drag selects a group; hold <kbd>Tab</kbd> to see every aura.</div>`;
    }
  }

  /** Description of a hovered button or of the thing being aimed. */
  private explain(sim: Sim, w: Inspect, aiming: boolean): string {
    const aimNote = aiming ? '<div class="aim">Click on the battlefield to aim · <kbd>Esc</kbd> or right-click to cancel</div>' : '';
    if (w.kind === 'tower' || w.kind === 'super') {
      const tower = w.kind === 'super' ? sim.tower(w.index) : null;
      const type = tower ? tower.type : w.index;
      const def = TOWERS[type];
      const lv = def.levels[tower ? tower.level : 0];
      const rows = stats(def, lv).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
      const hits = [def.hitsGround && 'ground', def.hitsAir && 'air'].filter(Boolean).join(' + ');
      const partners = COMBOS.filter((c) => c.a === def.kind || c.b === def.kind)
        .map((c) => `<div class="combo"><b>${c.name}</b> next to ${TOWERS.find((o) => o.kind === (c.a === def.kind ? c.b : c.a))!.short}: ${c.desc}</div>`).join('');
      const price = tower ? `Lv ${tower.level + 1}` : `$${sim.cost(type)}`;
      const locked = !tower && !sim.allowed(type) ? '<div class="desc bad">Not available in this game.</div>' : '';
      return `<div class="title">${def.name}<span class="lvl">${price}</span></div>${aimNote}${locked}
        <div class="help">${TOWER_HELP[def.kind]}</div>
        <table>${rows}${hits ? `<tr><td>Targets</td><td>${hits}</td></tr>` : ''}</table>${partners}`;
    }
    if (w.kind === 'item') {
      const it = ITEMS[w.index];
      return `<div class="title">${it.name}<span class="lvl">×${sim.items[w.index]} · key ${it.key}</span></div>${aimNote}
        <div class="help">${ITEM_HELP[w.index]}</div>
        <div class="desc">Tactical item: one charge comes back at every new wave (up to ${sim.itemMax}).</div>`;
    }
    if (w.kind === 'ability') {
      const a = HERO_ABILITIES[w.index];
      const cd = sim.hero?.cd[w.index] ?? 0;
      return `<div class="title">${a.name}<span class="lvl">${cd > 0 ? `ready in ${Math.ceil(cd)}s` : 'ready'} · key ${a.key}</span></div>${aimNote}
        <div class="help">${ABILITY_HELP[w.index]}</div>
        <div class="desc">Commander ability · cooldown ${a.cd}s.</div>`;
    }
    const h = sim.hero;
    return `<div class="title">Commander<span class="lvl">${h ? `Lv ${h.level}` : ''} · key H</span></div><div class="help">${HERO_HELP}</div>`;
  }

  private enemyStatus(sim: Sim, i: number): string {
    const tags: string[] = [];
    if (sim.hidden(i)) tags.push('stealthed');
    if (sim.eFrozenT[i] > 0) tags.push('frozen');
    else if (sim.eChill[i] > 0.05) tags.push(`chilled ${Math.round(sim.eChill[i] * 100)}%`);
    if (sim.eStunT[i] > 0) tags.push('stunned');
    if (sim.eHackT[i] > 0) tags.push('hacked');
    if (sim.eBurnT[i] > 0) tags.push('burning');
    if (sim.eSlowT[i] > 0) tags.push('slowed');
    if (sim.eJam[i] > 0) tags.push('jammed');
    return tags.join(', ');
  }

  private enemyPanel(sim: Sim, i: number): string {
    const kind = sim.eKind[i];
    const def = ENEMIES[kind];
    const help = ENEMY_HELP[kind];
    const status = this.enemyStatus(sim, i);
    return `<div class="title">${def.name}<span class="lvl">${def.air ? 'air' : 'ground'}</span></div>
      <div class="help">${help.text}</div>
      <table>
        <tr><td>HP</td><td>${Math.ceil(sim.eHp[i])} / ${Math.ceil(sim.eMaxHp[i])}</td></tr>
        ${sim.eMaxShield[i] > 0 ? `<tr><td>Shield</td><td>${Math.ceil(sim.eShield[i])} / ${Math.ceil(sim.eMaxShield[i])}</td></tr>` : ''}
        <tr><td>Armour</td><td>${def.armor}</td></tr>
        <tr><td>Speed</td><td>${def.speed}</td></tr>
        <tr><td>Bounty</td><td>$${sim.eReward[i]}</td></tr>
        <tr><td>Lives if it leaks</td><td>${def.lives}</td></tr>
        ${status ? `<tr><td>Status</td><td>${status}</td></tr>` : ''}
      </table>
      <div class="combo"><b>Counter</b> ${help.counter}</div>`;
  }

  /** Cost of upgrading every tower in the selection by one level. */
  private multiCost(sim: Sim, list: Tower[]): number {
    return list.reduce((a, t) => a + sim.upgradeCost(t), 0);
  }

  camera(mode: 'top' | 'iso'): void {
    this.cameraBtn.textContent = mode === 'iso' ? 'View: Iso' : 'View: Top';
  }

  perfLine(html: string): void {
    this.set(this.perfText, html, true);
  }
}
