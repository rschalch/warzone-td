import {
  CATEGORIES, COMBOS, RANKS, ENEMIES, TARGET_MODES, TOWERS, UNITS, WW2, hpScale,
  type EnemyDef, type TowerDef, type TowerLevel,
} from '../game/defs';
import { rulesetKey } from '../game/rules';
import { penVerdict } from '../game/ww2';
import { DIFFICULTIES } from '../game/config';
import { VET_KILLS, heroAbilities, penFalloff, HERO_MAX_LEVEL, ITEMS, STANCES, type Sim, type Tower, type TowerStats } from '../game/sim';
import { ABILITY_HELP, ABILITY_HELP_WW2, FOREST_HELP, HERO_HELP, HERO_HELP_WW2, ITEM_HELP, MOUNTAIN_HELP, RIVER_HELP, enemyHelp, towerHelp } from './codex';
import { T_MOUNT, T_TREE, T_WATER, WATER_SLOW } from '../game/maps';
import { settings, updateSettings } from '../app/settings';
import { sound } from '../audio/sound';

const SPEAKER = '<svg viewBox="0 0 16 16"><path d="M2 6h3l4-3v10L5 10H2z"/><path d="M11 5.5a3.5 3.5 0 0 1 0 5M12.5 3.5a6 6 0 0 1 0 9" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
const SPEAKER_OFF = '<svg viewBox="0 0 16 16"><path d="M2 6h3l4-3v10L5 10H2z"/><path d="M11 6l4 4M15 6l-4 4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';

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
  repair(): void;
  train(unit: number): void;
  stance(stance: number): void;
  dig(): void;
  mines(): void;
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
  /** WW2: slots of the selected defender units. */
  units: number[];
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
const num = (n: number) => (Math.abs(n - Math.round(n)) < 0.05 ? `${Math.round(n)}` : n.toFixed(1));
const pct = (f: number) => `${Math.round(f * 100)}%`;
/** Kinds whose damage figure is per second rather than per shot. */
const DPS_KINDS = new Set(['laser', 'flame', 'napalm', 'gas', 'gravity', 'spikes', 'hacker', 'orbital', 'blackhole']);
const AURA_KINDS = new Set(['jammer', 'radar', 'command', 'salvage', 'workshop']);

/** Stat rows for a tower level; `eff` overrides damage/range/rate with buffed values. */
function stats(def: TowerDef, lv: TowerLevel, eff?: TowerStats): [string, string][] {
  const rows: [string, string][] = [];
  const dmg = eff?.damage ?? lv.damage;
  const range = eff?.range ?? lv.range;
  const rate = eff?.rate ?? lv.rate;
  const role = def.role;
  if (lv.damage) rows.push([role === 'hacker' ? 'Hijacked DPS' : DPS_KINDS.has(role) ? 'DPS' : 'Damage', num(dmg)]);
  // (it falls off with range: more point-blank, less at the edge of the circle)
  if (lv.pen !== undefined) {
    if (lv.splash && role !== 'at') rows.push(['Penetration', `${lv.pen} mm, top`]);
    else rows.push(['Pen. close / far', `${Math.round(lv.pen * penFalloff(0))} / ${Math.round(lv.pen * penFalloff(1))} mm`]);
  }
  if (lv.range > 14) rows.push([AURA_KINDS.has(role) ? 'Radius' : 'Range', num(range)]);
  if (lv.rate && !lv.charge) rows.push([role === 'mine' ? 'Re-arm' : 'Rate', role === 'mine' ? `${num(1 / rate)}s` : `${num(rate)}/s`]);
  if (lv.salvo) rows.push(['Rockets', `${lv.salvo}`]);
  if (lv.supp) rows.push(['Suppression', `${pct(lv.supp)}/hit`]);
  if (lv.splash) rows.push(['Splash', `${lv.splash}`]);
  if (lv.chain) rows.push(['Chain', `${lv.chain}`]);
  if (lv.slow) rows.push([role === 'wire' ? 'Slows infantry' : 'Slow', pct(1 - lv.slow)]);
  if (lv.burn) rows.push(['Burn', `${lv.burn}/s`]);
  if (lv.shred) rows.push(['Armour shred', `${lv.shred}`]);
  if (lv.chill) rows.push(['Chill per hit', pct(lv.chill)]);
  if (lv.pull) rows.push(['Pull', `${lv.pull}px/s`]);
  if (lv.knock) rows.push(['Knockback', `${lv.knock}px`]);
  if (lv.duration) rows.push([role === 'hacker' ? 'Hack time' : 'Lasts', `${lv.duration}s`]);
  if (lv.buff) {
    const label = { radar: 'Range bonus', command: 'Fire-rate bonus', salvage: 'Bounty bonus', jammer: 'Extra damage taken', workshop: 'Repairs per s' }[role as string] ?? 'Bonus';
    rows.push([label, `+${pct(lv.buff)}`]);
  }
  if (lv.income) rows.push(['Per wave', `$${lv.income} + ${pct(lv.interest ?? 0)} (max $${lv.cap})`]);
  if (lv.charge) rows.push(['Recharge', `${lv.charge}s`]);
  if (lv.drones) rows.push(['Drones', `${lv.drones}`]);
  if (WW2 && lv.hp) rows.push(['Strength', `${lv.hp} HP`], ['Cover', fortName(lv.fort ?? 0)]);
  if (WW2 && def.camo && !eff) rows.push(['Camouflage', pct(def.camo)]);
  return rows;
}

/** WW2: what an emplacement's fortification is made of. */
function fortName(mm: number): string {
  const what = mm >= 90 ? 'tank armour' : mm >= 60 ? 'concrete' : mm >= 25 ? 'timber & earth' : mm >= 12 ? 'sandbags' : 'gun shield';
  return `${what} (${mm} mm)`;
}

/** WW2: what an attacker fires back with. */
function weaponLine(e: EnemyDef): string {
  const g = e.gun;
  if (!g) return 'unarmed';
  const what = { rifle: 'rifles', smg: 'submachine guns', mg: 'machine gun', tank: 'tank gun', rocket: 'rockets & bombs', katyusha: `${g.salvo} rockets per salvo`, satchel: 'satchel charges', kamikaze: 'dives in with its bomb' }[g.fx];
  return `${what} · ${g.pen} mm · range ${g.range}${g.halt ? ' · halts to fire' : ''}`;
}

/** Counters for specific threats, shown in the wave preview. */
function threatTip(e: EnemyDef): string {
  if (e.boss) return 'boss';
  if (e.stealth) return WW2 ? 'hidden — observation posts reveal' : 'stealth — radar, or towers point-blank';
  if (e.gun?.fx === 'kamikaze') return 'kamikaze — dives on your best emplacement';
  if (e.banzai) return 'banzai — ignores suppression';
  if (e.shield) return 'shields — jam them';
  if (e.heal) return 'heals — focus it';
  if (e.air) return WW2 ? (e.arm ? 'armoured aircraft — flak' : 'aircraft — flies over the maze') : 'air — flies over the maze';
  if (WW2 && e.spot && e.spot >= 200) return 'recon — spots hidden guns';
  if (WW2 && e.arm && e.arm[0] >= 40) return `armour ${e.arm[0]}/${e.arm[1]}/${e.arm[2]} mm`;
  return '';
}

/** WW2: which armoured enemies a weapon gets through, and from where. */
function penRows(lv: TowerLevel): string {
  if (!WW2 || !lv.pen || !lv.damage) return '';
  const words = { all: 'any side', side: 'side & rear', rear: 'rear only', none: 'no', soft: '' };
  const top = !!lv.splash;
  const cells = ENEMIES.filter((e) => e.arm && !e.air).map((e) => {
    const v = top ? (lv.pen! >= e.arm![3] ? 'all' : 'none') : penVerdict(lv.pen!, e.arm);
    return `<span class="${v === 'none' ? 'bad' : v === 'all' ? 'good' : ''}">${e.name.replace(/ (Heavy|Light) Tank| Armoured Car/, '')}: ${top && v === 'all' ? 'from above' : words[v]}</span>`;
  });
  return `<div class="desc pen"><b>Gets through</b> ${cells.join(' · ')}</div>`;
}

/** DOM HUD. Every write is diffed so per-frame updates cost almost nothing. */
export class Hud {
  private readonly money = $('money');
  private readonly lives = $('lives');
  private readonly livesLabel = this.lives.previousElementSibling as HTMLElement;
  private readonly wave = $('wave');
  private readonly kills = $('kills');
  private readonly next = $<HTMLButtonElement>('next');
  private readonly cameraBtn = $<HTMLButtonElement>('camera');
  private readonly undoBtn = $<HTMLButtonElement>('undo');
  private readonly muteBtn = $<HTMLButtonElement>('mute');
  private readonly musicVol = $<HTMLInputElement>('musicvol');
  private readonly trackName = $('trackname');
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
  private infoSubject = '';
  private reportTimer = 0;
  /** Recent damage totals per tower, sampled once a second, for live DPS. */
  private dmgSamples = new Map<number, number[]>();
  private lastSample = 0;
  /** Button under the mouse: its description replaces the panel while hovered. */
  private hover: Inspect | null = null;
  private palette: unknown = null;
  private iconFn: ((type: number) => HTMLCanvasElement) | null = null;

  /** Every tower of the current ruleset at once, grouped by category; the first ten have number keys. */
  private buildPalette(act: HudActions): void {
    if (this.palette === rulesetKey()) return;
    this.palette = rulesetKey();
    const build = $('build');
    build.replaceChildren();
    this.buttons.length = 0;
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
    if (this.iconFn) this.setIcons(this.iconFn);
    this.fitNames();
  }

  /** Squeezes each tower name under its icon to the tile's width (they show when the sidebar has the height). */
  private fitNames(): void {
    requestAnimationFrame(() => {
      for (const b of this.buttons) {
        const n = b?.querySelector<HTMLElement>('.n');
        if (!n || !n.offsetWidth) continue;
        n.style.transform = '';
        const room = b.clientWidth - 6;
        n.style.transform = n.offsetWidth > room ? `scaleX(${(room / n.offsetWidth).toFixed(3)})` : '';
      }
    });
  }

  constructor(private readonly act: HudActions) {
    this.buildPalette(act);
    window.addEventListener('resize', () => this.fitNames());
    this.next.onclick = () => act.next();
    $('menu').onclick = () => act.menu();
    $('gear').onclick = () => act.settings();
    this.undoBtn.onclick = () => act.undo();
    this.cameraBtn.onclick = () => act.camera();
    this.speedBtns = [...$('speed').querySelectorAll('button')] as HTMLButtonElement[];
    for (const b of this.speedBtns) b.onclick = () => act.speed(Number(b.dataset.speed));
    // sound: the same settings as the settings screen, so both stay in step and are remembered
    this.muteBtn.onclick = () => updateSettings({ muted: !settings.muted });
    $('prevtrack').onclick = () => sound.prevTrack();
    $('nexttrack').onclick = () => sound.nextTrack();
    this.musicVol.oninput = () => updateSettings({ music: Number(this.musicVol.value), muted: false });
    this.musicVol.onchange = () => this.musicVol.blur(); // hand the keys back to the game

    // tactical bar: hero + abilities, then items
    this.heroBtn = document.createElement('button');
    this.heroBtn.className = 'hero';
    this.heroBtn.title = 'Select your commander (H). Then click the ground to move.';
    this.heroBtn.onclick = () => act.hero();
    this.hoverable(this.heroBtn, { kind: 'hero', index: 0 });
    this.tactical.appendChild(this.heroBtn);
    heroAbilities().forEach((a, k) => {
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
      else if (a === 'repair') act.repair();
      else if (el.dataset.train) act.train(Number(el.dataset.train));
      else if (el.dataset.stance) act.stance(Number(el.dataset.stance));
      else if (a === 'dig') act.dig();
      else if (a === 'mines') act.mines();
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
    this.buildPalette(this.act);
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
    this.fitNames();
  }

  private hoverable(el: HTMLElement, what: Inspect): void {
    el.addEventListener('mouseenter', () => (this.hover = what));
    el.addEventListener('mouseleave', () => {
      if (this.hover === what) this.hover = null;
    });
  }

  /** Puts a picture of each tower on its button (needs the baked atlas). */
  setIcons(icon: (type: number) => HTMLCanvasElement): void {
    this.iconFn = icon;
    this.buttons.forEach((b, i) => b.querySelector('.ic')!.replaceChildren(icon(i)));
  }

  /** Keeps the picked tower's button in view (the palette can scroll on small screens). */
  reveal(type: number): void {
    this.buttons[type]?.scrollIntoView({ block: 'nearest' });
  }

  /** The top bar's sound controls follow the settings (changed here, by a key, or in the settings screen). */
  private updateAudio(): void {
    const muted = settings.muted;
    this.set(this.muteBtn, muted ? SPEAKER_OFF : SPEAKER, true);
    this.muteBtn.classList.toggle('off', muted);
    this.muteBtn.title = muted ? 'Sound off — click to turn it back on (K)' : 'Mute sound and music (K)';
    if (document.activeElement !== this.musicVol && Number(this.musicVol.value) !== settings.music) this.musicVol.value = String(settings.music);
    const name = sound.trackName;
    this.set(this.trackName, name ? `♪ ${name}` : '♪ Music');
    this.musicVol.parentElement!.title = `${name ? `Now playing: ${name}. ` : ''}Music volume ${Math.round(settings.music * 100)}%`;
  }

  private set(el: HTMLElement, text: string, html = false): void {
    if (this.cache.get(el) === text) return;
    this.cache.set(el, text);
    if (html) el.innerHTML = text;
    else el.textContent = text;
  }

  update(sim: Sim, ui: UiState): void {
    this.set(this.money, `$${Math.floor(sim.money)}`);
    // WW2: our headquarters' state (and the enemy's) in place of lives
    this.set(this.lives, WW2 ? `${sim.lives}%<small> · enemy ${Math.ceil(100 * sim.enemyHqHealth)}%</small>` : `${sim.lives}`, WW2);
    this.lives.classList.toggle('low', WW2 ? sim.lives <= 30 : sim.lives <= 5);
    this.livesLabel.textContent = WW2 ? 'HQ' : 'Lives';
    this.set(this.wave, sim.endless || sim.siege ? `${sim.wave}` : `${sim.wave}/${sim.totalWaves}`);
    this.set(this.kills, `${sim.totalKills}`);
    this.updateAudio();

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
      if (sim.battle?.airFrom) {
        // a battle's weather keeps the aircraft grounded for a while
        const grounded = sim.airLocked(i);
        b.classList.toggle('locked', grounded || !sim.allowed(i));
        b.title = grounded ? `Grounded by the weather until wave ${sim.battle.airFrom}` : '';
      }
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
    const rows = [...counts].map(([k, c]) => {
      const tip = threatTip(ENEMIES[k]);
      return `<div><b>${c}×</b> ${ENEMIES[k].name}${tip ? ` <span class="tip">${tip}</span>` : ''}</div>`;
    }).join('');
    this.waveBox.innerHTML = `<div class="wt">Next: wave ${n} <span class="hp">HP ×${hp.toFixed(1)}</span></div>${rows}`;
  }

  private updateTactical(sim: Sim, ui: UiState): void {
    const h = sim.hero;
    this.tactical.style.display = h ? '' : 'none';
    if (!h) return;
    const state = h.downT > 0 ? `wounded ${Math.ceil(h.downT)}s` : h.level < HERO_MAX_LEVEL ? `${Math.floor((h.xp / sim.heroNextXp(h.level)) * 100)}%` : 'max';
    this.set(this.heroBtn, `<b>Commander</b><span>Lv ${h.level} · ${state}</span><span class="k">H</span>`, true);
    this.heroBtn.classList.toggle('on', ui.heroSelected);
    heroAbilities().forEach((a, k) => {
      const cd = h.cd[k];
      this.abilityBtns[k].title = `${a.name} (${a.key}) — ${a.desc} Cooldown ${a.cd}s.`;
      this.set(this.abilityBtns[k], `<b>${a.name}</b><span>${cd > 0 ? `${Math.ceil(cd)}s` : 'ready'}</span><span class="k">${a.key}</span>`, true);
      this.abilityBtns[k].disabled = cd > 0 || h.downT > 0 || ui.mode === 'replay';
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
      const name = id === -1 ? 'Commander' : id === -2 ? 'Units' : t ? `${TOWERS[t.type].short} L${t.level + 1}` : 'Sold tower';
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
    else if (ui.units.length) key = `u${ui.units.map((u) => `${u}:${Math.ceil(sim.uHp[u])}:${sim.uStance[u]}:${sim.uKills[u]}:${sim.unitHidden(u)}`).join(',')}`;
    else if (ui.enemy >= 0 && sim.eAlive[ui.enemy]) key = `e${ui.enemy}:${Math.ceil(sim.eHp[ui.enemy])}:${Math.ceil(sim.eShield[ui.enemy])}:${this.enemyStatus(sim, ui.enemy)}`;
    else if (ui.multi.length) key = `m${ui.multi.map((m) => m.id + ':' + m.level).join(',')}:${sim.money >= this.multiCost(sim, ui.multi)}`;
    else if (ui.heroSelected && sim.hero) key = `h${sim.hero.level}:${Math.floor(sim.hero.xp)}:${sim.hero.cd.map(Math.ceil).join(',')}:${Math.ceil(sim.hero.hp)}:${Math.ceil(sim.hero.downT)}`;
    else if (t) {
      const up = sim.upgradeCost(t);
      const extra = t.kind === 'depot' ? sim.depotIncome : TOWERS[t.type].manual ? Math.floor(sim.chargeLevel(t) * 100) : 0;
      const fix = sim.repairCost(t);
      const tr = t.trainKind >= 0 ? `${t.trainKind}:${Math.ceil(t.trainT)}` : UNITS.map((_, k) => sim.trainBlock(t, k)).join();
      key = `c${sim.towerHidden(t)}${t.knownT > 0}:tr${tr}:${sim.manpowerUsed}/${sim.manpowerCap}:t${t.id}:${t.level}:${t.mode}:${t.kills}:${Math.floor(t.damage / 50)}:${up > 0 && sim.money >= up}:${t.open}:${sim.towerVersion}:${extra}:${Math.round(this.dps(t))}:${Math.ceil(t.hp)}:${fix}:${sim.money >= fix}:${t.supp > 0.3}:${Math.ceil(t.buildT)}:${t.wreck}:${sim.fireStatus(t)}`;
    } else if (ui.placing >= 0) key = `p${ui.placing}:${sim.cost(ui.placing)}`;
    else if (ui.ground === T_WATER || ui.ground === T_MOUNT || ui.ground === T_TREE) key = `g${ui.ground}`;
    else key = 'none';
    if (key === this.infoKey) return;
    this.infoKey = key;
    // something else selected: start its panel at the top, where its buttons are
    const subject = what ? `i${what.kind}:${what.index}` : ui.units.length ? `u${ui.units.join()}` : ui.enemy >= 0 ? `e${ui.enemy}`
      : ui.multi.length ? 'm' : ui.heroSelected ? 'h' : t ? `t${t.id}` : ui.placing >= 0 ? `p${ui.placing}` : 'n';
    if (subject !== this.infoSubject) {
      this.infoSubject = subject;
      this.info.scrollTop = 0;
    }
    const ro = ui.mode === 'replay' ? 'disabled' : '';

    if (what) {
      this.info.innerHTML = this.explain(sim, what, what === ui.aiming);
    } else if (ui.units.length) {
      this.info.innerHTML = this.unitPanel(sim, ui.units, ro);
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
      const abil = heroAbilities().map((a, k) => `<button data-ab="${k}" ${h.cd[k] > 0 || ro ? 'disabled' : ''}>${a.name}${h.cd[k] > 0 ? ` ${Math.ceil(h.cd[k])}s` : ''}</button>`).join('');
      this.info.innerHTML = `
        <div class="title">Commander<span class="lvl">Lv ${h.level}/${HERO_MAX_LEVEL}</span></div>
        <div class="row abil">${abil}</div>
        <table>
          ${WW2 ? `<tr><td>Health</td><td>${h.downT > 0 ? `<span class="bad">wounded — back in ${Math.ceil(h.downT)}s</span>` : `${Math.ceil(h.hp)} / ${sim.heroMaxHp()}`}</td></tr>` : ''}
          <tr><td>Damage</td><td>${num(sim.heroDamage())}</td></tr>
          <tr><td>Range</td><td>${num(sim.heroRange())}</td></tr>
          <tr><td>XP</td><td>${h.level < HERO_MAX_LEVEL ? `${Math.floor(h.xp)} / ${sim.heroNextXp(h.level)}` : 'max'}</td></tr>
          <tr><td>Kills</td><td>${h.src.kills}</td></tr>
        </table>
        <div class="help">${WW2 ? HERO_HELP_WW2 : HERO_HELP}</div>
        <div class="desc" style="margin-top:8px">${heroAbilities().map((a) => `<b>${a.key}</b> ${a.name}: ${a.desc}`).join('<br>')}</div>`;
    } else if (t) {
      const def = TOWERS[t.type];
      const lv = def.levels[t.level];
      const up = sim.upgradeCost(t);
      const nextRows = up ? stats(def, def.levels[t.level + 1]) : [];
      const rows = stats(def, lv, sim.stats(t))
        .map(([k, v], i) => `<tr><td>${k}</td><td>${v}</td><td class="up">${nextRows[i] && nextRows[i][1] !== v ? '→ ' + nextRows[i][1].replace(/ (mm|HP)$/, '') : ''}</td></tr>`)
        .join('');
      // WW2: camouflaged guns can also wait in ambush
      const modeNames: string[] = [...TARGET_MODES, ...(WW2 && def.camo ? ['Ambush'] : [])];
      const modes = !def.targeted ? '' : `<div class="row modes">${modeNames.map((m, i) => `<button data-mode="${i}" class="${t.mode === i ? 'on' : ''}" ${ro}${m === 'Ambush' ? ' title="Hold fire until a tank shows its flank or comes point-blank; the first shot hits 50% harder"' : ''}>${m}</button>`).join('')}</div>`;
      const camo = sim.camoOf(t);
      const camoRow = WW2 && camo ? `<tr><td>Camouflage</td><td>${pct(camo)} · ${t.seenT > 0 ? 'revealed by its fire' : t.knownT > 0 ? '<span class="bad">spotted</span>' : 'hidden'}</td><td></td></tr>` : '';
      const combos = t.combos.map((name) => {
        const c = COMBOS.find((o) => o.name === name)!;
        return `<div class="combo"><b>${c.name}</b> ${c.desc}</div>`;
      }).join('');
      // the controls a tower type has (always in the same place for it), then notes that come and go
      let actions = '';
      if (def.role === 'gate') actions = `<div class="row"><button data-act="gate" class="primary" ${ro}>${t.open ? 'Close gate (G)' : 'Open gate (G)'}</button></div>`;
      if (def.manual) {
        const c = sim.chargeLevel(t);
        actions = `<div class="row"><button data-act="fire" class="primary" ${c < 1 || ro || t.wreck ? 'disabled' : ''}>${c < 1 ? `Charging ${Math.floor(c * 100)}%` : 'Fire! (R)'}</button></div>`;
      }
      if (def.role === 'barracks' || def.role === 'motorpool') actions = this.trainPanel(sim, t, ro || (t.wreck ? 'disabled' : ''));
      let special = '';
      if (def.role === 'depot') special = `<div class="desc">All depots pay <b>$${sim.depotIncome}</b> at the next wave.</div>`;
      const max = sim.maxHp(t);
      const fix = sim.repairCost(t);
      let condition = '';
      if (max) {
        const f = t.hp / max;
        condition = `<tr><td>Condition</td><td>${t.buildT > 0 ? `being built ${Math.floor(100 * (1 - t.buildT / t.build0))}%` : t.wreck ? '<span class="bad">destroyed</span>' : `<span class="${f < 0.35 ? 'bad' : ''}">${Math.ceil(t.hp)} / ${max}</span>${t.supp > 0.3 ? ' · crew pinned' : ''}`}</td><td></td></tr>`;
      }
      if (t.id === sim.objectiveId) special += `<div class="desc bad"><b>Objective: ${sim.battle?.objective?.name}.</b> If it falls, the battle is lost.</div>`;
      else if (t.base) special += `<div class="desc bad"><b>Your headquarters.</b> The attackers march on it; if it falls, the battle is lost. Its garrison machine-guns anything close; upgrade it for more concrete.</div>`;
      if (t.buildT > 0) special += `<div class="desc">Under construction: ready in <b>${Math.ceil(t.buildT)} s</b>. It can't fire until then.</div>`;
      const holding = sim.fireStatus(t);
      if (holding) special += `<div class="desc hold">${holding}</div>`;
      if (t.wreck) {
        special = `<div class="desc bad">Knocked out: the rubble slows the enemy but doesn't block them. Rebuild it as it was, or clear it.</div>`;
      }
      // WW2: always there (greyed out when there is nothing to fix), so the buttons never move
      const repair = max ? `<button data-act="repair" class="${fix ? 'primary' : ''}" title="B" ${fix && sim.money >= fix && !ro ? '' : 'disabled'}>${t.wreck ? 'Rebuild' : 'Repair'}${fix ? ` $${fix}` : ''}</button>` : '';
      const record = def.hitsGround || def.hitsAir ? `
          <tr><td>Live DPS</td><td>${Math.round(this.dps(t))}</td><td></td></tr>
          <tr><td>Kills</td><td>${t.kills}</td><td></td></tr>
          <tr><td>Damage dealt</td><td>${Math.floor(t.damage)}</td><td></td></tr>` : '';
      const sameType = sim.towers.filter((o) => o.type === t.type && sim.upgradeCost(o) > 0).length;
      const hits = [def.hitsGround && 'ground', def.hitsAir && 'air'].filter(Boolean).join(' + ');
      this.info.innerHTML = `
        <div class="title">${def.name}<span class="lvl">${def.levels.length > 1 ? `Lv ${t.level + 1}/${def.levels.length} · ${RANKS[t.level]}` : ''}</span></div>
        <div class="row">
          <button data-act="up" ${up && sim.money >= up && !ro && !t.wreck ? '' : 'disabled'}>${up ? `Upgrade $${up}` : 'Max level'}</button>
          ${repair}
          <button data-act="sell" ${sim.canSell && !ro && t.id !== sim.objectiveId && !t.base ? '' : 'disabled'}>${t.wreck ? 'Clear' : 'Sell'} $${sim.sellValue(t)}</button>
        </div>
        ${def.levels.length > 1 ? `<div class="row"><button data-act="uptype" ${sameType > 1 && !ro ? '' : 'disabled'}>Upgrade every ${def.short}${sameType > 1 ? ` (${sameType})` : ''}</button></div>` : ''}
        ${modes}
        ${actions}
        ${t.owner ? '<div class="desc partner">Built by your AI partner. It upgrades its own towers; you can still upgrade or sell it.</div>' : ''}
        ${special}
        <table>${condition}${camoRow}${rows}${hits ? `<tr><td>Targets</td><td>${hits}</td><td></td></tr>` : ''}${record}</table>
        ${penRows(lv)}
        ${combos}
        <div class="help">${towerHelp(def)}</div>`;
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
        <div class="help">${towerHelp(def)}</div>
        <table>${rows}${hits ? `<tr><td>Targets</td><td>${hits}</td></tr>` : ''}</table>
        ${penRows(def.levels[0])}
        ${partners}
        <div class="desc" style="margin-top:8px">${how}</div>`;
    } else if (ui.ground === T_WATER) {
      this.info.innerHTML = `<div class="title">River<span class="lvl">${Math.round(WATER_SLOW * 100)}% speed</span></div><div class="help">${RIVER_HELP}</div>`;
    } else if (ui.ground === T_TREE) {
      this.info.innerHTML = `<div class="title">Forest<span class="lvl">impassable</span></div><div class="help">${FOREST_HELP}</div>`;
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
        <div class="help">${towerHelp(def)}</div>
        <table>${rows}${hits ? `<tr><td>Targets</td><td>${hits}</td></tr>` : ''}</table>${penRows(lv)}${partners}`;
    }
    if (w.kind === 'item') {
      const it = ITEMS[w.index];
      return `<div class="title">${it.name}<span class="lvl">×${sim.items[w.index]} · key ${it.key}</span></div>${aimNote}
        <div class="help">${ITEM_HELP[w.index]}</div>
        <div class="desc">Tactical item: one charge comes back at every new wave (up to ${sim.itemMax}).</div>`;
    }
    if (w.kind === 'ability') {
      const a = heroAbilities()[w.index];
      const cd = sim.hero?.cd[w.index] ?? 0;
      return `<div class="title">${a.name}<span class="lvl">${cd > 0 ? `ready in ${Math.ceil(cd)}s` : 'ready'} · key ${a.key}</span></div>${aimNote}
        <div class="help">${(WW2 ? ABILITY_HELP_WW2 : ABILITY_HELP)[w.index]}</div>
        <div class="desc">Commander ability · cooldown ${a.cd}s.</div>`;
    }
    const h = sim.hero;
    return `<div class="title">Commander<span class="lvl">${h ? `Lv ${h.level}` : ''} · key H</span></div><div class="help">${WW2 ? HERO_HELP_WW2 : HERO_HELP}</div>`;
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
    if (sim.eSupp[i] > 0.05) tags.push(`suppressed ${Math.round(sim.eSupp[i] * 100)}%`);
    if (sim.eWall[i] > 0) tags.push('breaking through a wall');
    else if (sim.eBreach[i]) tags.push('going for a breach');
    if (sim.eSmoked[i]) tags.push('in smoke');
    if (sim.eAimT[i] > 0) tags.push('halted, aiming');
    return tags.join(', ');
  }

  private enemyPanel(sim: Sim, i: number): string {
    const kind = sim.eKind[i];
    const def = ENEMIES[kind];
    const help = enemyHelp(kind);
    const status = this.enemyStatus(sim, i);
    return `<div class="title">${def.name}<span class="lvl">${def.air ? 'air' : 'ground'}</span></div>
      <div class="help">${help.text}</div>
      <table>
        <tr><td>HP</td><td>${Math.ceil(sim.eHp[i])} / ${Math.ceil(sim.eMaxHp[i])}</td></tr>
        ${sim.eMaxShield[i] > 0 ? `<tr><td>Shield</td><td>${Math.ceil(sim.eShield[i])} / ${Math.ceil(sim.eMaxShield[i])}</td></tr>` : ''}
        <tr><td>Armour</td><td>${WW2 ? (def.arm ? `${def.arm[0]} front · ${def.arm[1]} side · ${def.arm[2]} rear · ${def.arm[3]} top (mm)` : 'none') : def.armor}</td></tr>
        ${WW2 ? `<tr><td>Weapon</td><td>${weaponLine(def)}</td></tr>` : ''}
        ${def.fixed ? (sim.eBuild[i] > 0 ? `<tr><td>Status</td><td>being built (${Math.ceil(sim.eBuild[i])} s)</td></tr>` : '') : `<tr><td>Speed</td><td>${def.speed}</td></tr>`}
        <tr><td>Bounty</td><td>$${sim.eReward[i]}</td></tr>
        ${WW2 ? '' : `<tr><td>Lives if it leaks</td><td>${def.lives}</td></tr>`}
        ${status ? `<tr><td>Status</td><td>${status}</td></tr>` : ''}
      </table>
      <div class="combo"><b>Counter</b> ${help.counter}</div>`;
  }

  /** WW2: what a barracks or motor pool can train, and the manpower it takes. */
  private trainPanel(sim: Sim, t: Tower, ro: string): string {
    const why = { manpower: 'no manpower', money: '', busy: '', invalid: '' } as Record<string, string>;
    const rows = UNITS.map((d, k) => {
      if (d.from !== t.kind) return '';
      const block = sim.trainBlock(t, k);
      // two lines each, the same for every unit: the name, then the price and the men it takes (or why not)
      const men = `${d.manpower} ${d.manpower > 1 ? 'men' : 'man'}`;
      return `<button data-train="${k}" title="${d.name}: ${d.desc} ($${d.cost}, ${men})" ${block || ro ? 'disabled' : ''}><b>${d.short}</b><small>${why[block] ? `<span class="bad">${why[block]}</span>` : `$${d.cost} · ${men}`}</small></button>`;
    }).join('');
    const now = t.trainKind >= 0 ? `<div class="desc">Training <b>${UNITS[t.trainKind].name}</b>: ready in ${Math.ceil(t.trainT)}s</div>` : '';
    return `<div class="row train">${rows}</div>${now}<div class="desc">Manpower ${sim.manpowerUsed} / ${sim.manpowerCap} — each HQ adds 4, each depot 2.</div>`;
  }

  /** WW2: the selected units: health, stance, record. */
  private unitPanel(sim: Sim, units: number[], ro: string): string {
    const kinds = new Map<string, number>();
    for (const u of units) kinds.set(UNITS[sim.uKind[u]].short, (kinds.get(UNITS[sim.uKind[u]].short) ?? 0) + 1);
    const one = units.length === 1 ? units[0] : -1;
    const d = UNITS[sim.uKind[units[0]]];
    const stance = units.every((u) => sim.uStance[u] === sim.uStance[units[0]]) ? sim.uStance[units[0]] : -1;
    const air = units.every((u) => sim.uAir[u]);
    const fighters = units.filter((u) => UNITS[sim.uKind[u]].gun && !sim.uAir[u]);
    const dugAll = fighters.length > 0 && fighters.every((u) => sim.uDig[u] > 0);
    const digging = fighters.some((u) => sim.uDig[u] > 0 && sim.uDig[u] < 1);
    const engineers = units.some((u) => UNITS[sim.uKind[u]].repair);
    const orders = [
      fighters.length ? `<button data-act="dig" class="${dugAll ? 'on' : ''}" title="Foxholes for soldiers (half damage and suppression), hull-down for tanks (only the front armour shows). Dug-in units are hidden while they hold fire and can't move; any move order climbs out. Takes ${4}s." ${ro}>${dugAll ? (digging ? 'Digging…' : 'Dug in') : 'Dig in'} <span class="k">D</span></button>` : '',
      engineers ? `<button data-act="mines" title="Each selected engineer buries an anti-tank mine around the point you click (paid as one built there)." ${ro}>Lay mines <span class="k">M</span></button>` : '',
    ].join('');
    const buttons = air ? '' : `<div class="row modes">${STANCES.map((st, k) => `<button data-stance="${k}" title="${st.desc}" class="${stance === k ? 'on' : ''}" ${ro}>${st.name}</button>`).join('')}</div>${orders ? `<div class="row modes">${orders}</div>` : ''}`;
    let body: string;
    if (one >= 0) {
      const g = d.gun;
      body = `<table>
          <tr><td>Health</td><td>${Math.ceil(sim.uHp[one])} / ${d.hp}</td></tr>
          ${d.arm ? `<tr><td>Armour</td><td>${d.arm[0]} front · ${d.arm[1]} side · ${d.arm[2]} rear (mm)</td></tr>` : ''}
          ${g ? `<tr><td>Weapon</td><td>${num(g.dmg)} dmg · ${g.pen} mm · range ${g.range}${g.still ? ' · stops to fire' : ''}</td></tr>` : ''}
          ${d.repair ? `<tr><td>Repairs</td><td>${d.repair} HP/s</td></tr>` : ''}
          ${d.heal ? `<tr><td>Heals</td><td>${d.heal} HP/s</td></tr>` : ''}
          ${sim.uAir[one] ? `<tr><td>Patrol</td><td>${Math.ceil(sim.uLife[one])}s left</td></tr>` : ''}
          <tr><td>Kills</td><td>${sim.uKills[one]}${vetLine(sim, one)}</td></tr>
          ${sim.uDig[one] > 0 ? `<tr><td>Cover</td><td>${sim.uDig[one] >= 1 ? (d.arm ? 'hull-down' : 'in a foxhole') : `digging in ${Math.round(sim.uDig[one] * 100)}%`}</td></tr>` : ''}
          ${sim.uLay[one] >= 0 ? '<tr><td>Task</td><td>laying a mine</td></tr>' : ''}
          ${sim.unitHidden(one) ? '<tr><td>Status</td><td>hidden from the enemy</td></tr>' : ''}
        </table>
        <div class="help">${d.desc}</div>`;
    } else body = `<div class="desc">${[...kinds].map(([k, n]) => `${n}× ${k}`).join(', ')}</div>`;
    return `<div class="title">${one >= 0 ? d.name : `${units.length} units`}<span class="lvl">${air ? 'aircraft' : 'unit'}</span></div>
      ${buttons}${body}
      <div class="desc" style="margin-top:8px">${air ? 'Fighters patrol where they were sent until they run low on fuel.' : 'Click the ground to send them there; they guard that spot. Shift-click adds a unit; shift-drag selects a group.'}</div>`;
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

/** Veterancy: the rank's stars, and how many kills to the next one. */
function vetLine(sim: Sim, u: number): string {
  const v = sim.unitVet(u);
  const stars = v ? ` · <b style="color:#ffd34a">${'★'.repeat(v)}</b> ${['', 'Veteran', 'Hardened', 'Elite'][v]}` : '';
  const next = v < 3 ? ` (${VET_KILLS[v] - sim.uKills[u]} to ${['Veteran', 'Hardened', 'Elite'][v]})` : '';
  return stars + next;
}
