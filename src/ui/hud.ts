import { CATEGORIES, COMBOS, TARGET_MODES, TOTAL_WAVES, TOWERS, type TowerDef, type TowerLevel } from '../game/defs';
import type { Sim, Tower, TowerStats } from '../game/sim';

export interface HudActions {
  pick(type: number): void;
  upgrade(): void;
  sell(): void;
  mode(m: number): void;
  gate(): void;
  fire(): void;
  next(): void;
  speed(s: number): void;
  menu(): void;
  camera(): void;
  stress(): void;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');

const num = (n: number) => (Math.abs(n - Math.round(n)) < 0.05 ? `${Math.round(n)}` : n.toFixed(1));
const pct = (f: number) => `${Math.round(f * 100)}%`;
/** Kinds whose damage figure is per second rather than per shot. */
const DPS_KINDS = new Set(['laser', 'flame', 'napalm', 'gas', 'gravity', 'spikes', 'hacker', 'orbital', 'blackhole']);

/** Stat rows for a tower level; `eff` overrides damage/range/rate with buffed values. */
function stats(def: TowerDef, lv: TowerLevel, eff?: TowerStats): [string, string][] {
  const rows: [string, string][] = [];
  const dmg = eff?.damage ?? lv.damage;
  const range = eff?.range ?? lv.range;
  const rate = eff?.rate ?? lv.rate;
  if (lv.damage) rows.push([def.kind === 'hacker' ? 'Hijacked DPS' : DPS_KINDS.has(def.kind) ? 'DPS' : 'Damage', num(dmg)]);
  if (lv.range > 14) rows.push([def.kind === 'jammer' || def.kind === 'radar' || def.kind === 'command' || def.kind === 'salvage' ? 'Radius' : 'Range', num(range)]);
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

/** DOM HUD. Every write is diffed so per-frame updates cost almost nothing. */
export class Hud {
  private readonly money = $('money');
  private readonly lives = $('lives');
  private readonly wave = $('wave');
  private readonly kills = $('kills');
  private readonly next = $<HTMLButtonElement>('next');
  private readonly cameraBtn = $<HTMLButtonElement>('camera');
  private readonly info = $('info');
  private readonly perf = $('perf');
  private readonly perfText: HTMLSpanElement;
  private readonly buttons: HTMLButtonElement[] = []; // indexed by tower type
  private readonly tabs: HTMLButtonElement[] = [];
  private readonly speedBtns: HTMLButtonElement[];
  private cache = new Map<HTMLElement, string>();
  private infoKey = '';
  /** Index into CATEGORIES of the tab being shown. */
  cat = 0;

  constructor(act: HudActions) {
    const build = $('build');
    const tabs = $('tabs');
    CATEGORIES.forEach((c, k) => {
      const b = document.createElement('button');
      b.textContent = c.name;
      b.title = 'Q / E to switch';
      b.onclick = () => this.showCategory(k);
      tabs.appendChild(b);
      this.tabs.push(b);
    });
    TOWERS.forEach((t, i) => {
      const b = document.createElement('button');
      b.className = 'tb';
      const k = TOWERS.filter((o) => o.cat === t.cat).indexOf(t) + 1;
      b.innerHTML = `<span class="n">${t.short}</span><span class="c">$${t.levels[0].cost}</span><span class="k">${k}</span><span class="sw" style="background:${hex(t.color)}"></span>`;
      b.title = `${t.name} — ${t.desc}`;
      b.onclick = () => act.pick(i);
      build.appendChild(b);
      this.buttons.push(b);
    });
    this.showCategory(0);
    this.next.onclick = () => act.next();
    $('menu').onclick = () => act.menu();
    this.cameraBtn.onclick = () => act.camera();
    this.speedBtns = [...$('speed').querySelectorAll('button')] as HTMLButtonElement[];
    for (const b of this.speedBtns) b.onclick = () => act.speed(Number(b.dataset.speed));

    this.perfText = document.createElement('span');
    const stress = document.createElement('button');
    stress.textContent = 'Stress test';
    stress.title = 'Build a serpentine maze of maxed towers and spawn 3000 enemies';
    stress.onclick = () => act.stress();
    this.perf.append(this.perfText, stress);

    this.info.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest('button');
      if (!el) return;
      if (el.dataset.act === 'up') act.upgrade();
      else if (el.dataset.act === 'sell') act.sell();
      else if (el.dataset.act === 'gate') act.gate();
      else if (el.dataset.act === 'fire') act.fire();
      else if (el.dataset.mode) act.mode(Number(el.dataset.mode));
    });
  }

  showCategory(k: number): void {
    this.cat = (k + CATEGORIES.length) % CATEGORIES.length;
    const id = CATEGORIES[this.cat].id;
    this.tabs.forEach((b, i) => b.classList.toggle('on', i === this.cat));
    this.buttons.forEach((b, i) => (b.style.display = TOWERS[i].cat === id ? '' : 'none'));
  }

  /** Tower type for hotkey n (0-based) in the current tab, or -1. */
  typeAt(n: number): number {
    const id = CATEGORIES[this.cat].id;
    const types = TOWERS.map((t, i) => (t.cat === id ? i : -1)).filter((i) => i >= 0);
    return types[n] ?? -1;
  }

  private set(el: HTMLElement, text: string, html = false): void {
    if (this.cache.get(el) === text) return;
    this.cache.set(el, text);
    if (html) el.innerHTML = text;
    else el.textContent = text;
  }

  update(sim: Sim, placing: number, selected: Tower | null, speed: number): void {
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
    this.next.disabled = !sim.canCallWave;

    for (let i = 0; i < this.buttons.length; i++) {
      const b = this.buttons[i];
      if (b.style.display === 'none') continue;
      b.classList.toggle('on', placing === i);
      b.classList.toggle('poor', sim.money < TOWERS[i].levels[0].cost);
    }
    for (const b of this.speedBtns) b.classList.toggle('on', Number(b.dataset.speed) === speed);

    this.updateInfo(sim, placing, selected);
  }

  private updateInfo(sim: Sim, placing: number, t: Tower | null): void {
    let key: string;
    if (t) {
      const up = sim.upgradeCost(t);
      const extra = t.kind === 'depot' ? sim.depotIncome : TOWERS[t.type].manual ? Math.floor(sim.chargeLevel(t) * 100) : 0;
      key = `t${t.id}:${t.level}:${t.mode}:${t.kills}:${Math.floor(t.damage / 50)}:${up > 0 && sim.money >= up}:${t.open}:${sim.towerVersion}:${extra}`;
    } else if (placing >= 0) key = `p${placing}`;
    else key = 'none';
    if (key === this.infoKey) return;
    this.infoKey = key;

    if (t) {
      const def = TOWERS[t.type];
      const lv = def.levels[t.level];
      const up = sim.upgradeCost(t);
      const nextRows = up ? stats(def, def.levels[t.level + 1]) : [];
      const rows = stats(def, lv, sim.stats(t))
        .map(([k, v], i) => `<tr><td>${k}</td><td>${v}</td><td class="up">${nextRows[i] && nextRows[i][1] !== v ? '→ ' + nextRows[i][1] : ''}</td></tr>`)
        .join('');
      const modes = !def.targeted ? '' : `<div class="row modes">${TARGET_MODES.map((m, i) => `<button data-mode="${i}" class="${t.mode === i ? 'on' : ''}">${m}</button>`).join('')}</div>`;
      const combos = t.combos.map((name) => {
        const c = COMBOS.find((o) => o.name === name)!;
        return `<div class="combo"><b>${c.name}</b> ${c.desc}</div>`;
      }).join('');
      let special = '';
      if (def.kind === 'gate') special = `<div class="row"><button data-act="gate" class="primary">${t.open ? 'Close gate (G)' : 'Open gate (G)'}</button></div>`;
      if (def.manual) {
        const c = sim.chargeLevel(t);
        special = `<div class="row"><button data-act="fire" class="primary" ${c < 1 ? 'disabled' : ''}>${c < 1 ? `Charging ${Math.floor(c * 100)}%` : 'Fire! (R)'}</button></div>`;
      }
      if (def.kind === 'depot') special = `<div class="desc">All depots pay <b>$${sim.depotIncome}</b> at the next wave.</div>`;
      const record = def.hitsGround || def.hitsAir ? `
          <tr><td>Kills</td><td>${t.kills}</td><td></td></tr>
          <tr><td>Damage dealt</td><td>${Math.floor(t.damage)}</td><td></td></tr>` : '';
      this.info.innerHTML = `
        <div class="title">${def.name}<span class="lvl">Lv ${t.level + 1}/${def.levels.length}</span></div>
        <div class="desc">${def.desc}</div>
        <table>${rows}${record}</table>
        ${combos}
        ${special}
        ${modes}
        <div class="row">
          <button data-act="up" ${up && sim.money >= up ? '' : 'disabled'}>${up ? `Upgrade $${up}` : 'Max level'}</button>
          <button data-act="sell">Sell $${sim.sellValue(t)}</button>
        </div>`;
    } else if (placing >= 0) {
      const def = TOWERS[placing];
      const rows = stats(def, def.levels[0]).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
      const hits = [def.hitsGround && 'ground', def.hitsAir && 'air'].filter(Boolean).join(' + ');
      const partners = COMBOS.filter((c) => c.a === def.kind || c.b === def.kind)
        .map((c) => `<div class="combo"><b>${c.name}</b> next to ${TOWERS.find((o) => o.kind === (c.a === def.kind ? c.b : c.a))!.short}: ${c.desc}</div>`).join('');
      const how = def.walkable ? 'Goes on the path itself: it never blocks the route.'
        : def.size === 1 ? 'A 1×1 wall. Click or drag to build.'
          : 'Click or drag on the field to build. Enemies path around your towers, but you can\'t fully block them.';
      this.info.innerHTML = `
        <div class="title">${def.name}<span class="lvl">$${def.levels[0].cost}</span></div>
        <div class="desc">${def.desc}</div>
        <table>${rows}${hits ? `<tr><td>Targets</td><td>${hits}</td></tr>` : ''}</table>
        ${partners}
        <div class="desc" style="margin-top:8px">${how}</div>`;
    } else {
      this.info.innerHTML = `<div class="desc">Pick a tower to build, or click one of your towers to upgrade it.</div>`;
    }
  }

  camera(mode: 'top' | 'iso'): void {
    this.cameraBtn.textContent = mode === 'iso' ? 'View: Iso' : 'View: Top';
  }

  perfLine(html: string): void {
    this.set(this.perfText, html, true);
  }
}
