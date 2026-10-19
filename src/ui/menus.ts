// Every screen outside the battlefield, drawn into #overlay.

import { getProfile, buyPerk, resetPerks, perkLevel, deleteCustomMap } from '../app/profile';
import { settings, updateSettings, type Settings } from '../app/settings';
import { join, host as hostRoom, type NetLink } from '../app/net';
import type { Replay } from '../app/share';
import { DIFFICULTIES, MODIFIERS, PERKS, type Difficulty, type GameConfig, type Modifier } from '../game/config';
import { TOTAL_WAVES } from '../game/defs';
import { rulesetFor } from '../game/rules';
import { ARMIES, ARSENALS, FACTIONS, type Faction } from '../game/ww2';
import { BATTLES, type Battle } from '../game/battles';
import { MAP_SIZES, dailySetup, mapCode, parseMapCode, randomMap, today, type MapSize, type RandomMapOptions } from '../game/mapgen';
import { MAPS, type MapDef } from '../game/maps';
import { PARTNER_ROLES } from '../game/partner';
import { Rng } from '../game/rng';

export interface MenuHost {
  start(cfg: GameConfig, link?: NetLink): void;
  resumeCurrent(): void;
  currentActive(): boolean;
  hasSave(): Promise<boolean>;
  continueSave(): void;
  watch(replay: Replay): void;
  editor(def?: MapDef): void;
  preview(def: MapDef, w: number, h: number): HTMLCanvasElement;
  click(): void;
}

const overlay = document.getElementById('overlay')!;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

let host: MenuHost;
/** Set while a co-op room is connected and the host is choosing what to play. */
let coopLink: NetLink | null = null;

export function initMenus(h: MenuHost): void {
  host = h;
  overlay.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('button')) host.click();
  });
}

function show(html: string): void {
  overlay.classList.remove('hidden');
  overlay.innerHTML = html;
}

export function hideMenus(): void {
  overlay.classList.add('hidden');
  overlay.innerHTML = '';
}

const on = (sel: string, fn: (el: HTMLElement) => void) => overlay.querySelectorAll<HTMLElement>(sel).forEach((el) => (el.onclick = () => fn(el)));

/** Draws a map's terrain into a canvas, letterboxed. */
function paintPreview(c: HTMLCanvasElement, def: MapDef): void {
  const src = host.preview(def, c.width, c.height);
  const k = Math.min(c.width / src.width, c.height / src.height);
  const g = c.getContext('2d')!;
  g.fillStyle = '#0c0e09';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(src, (c.width - src.width * k) / 2, (c.height - src.height * k) / 2, src.width * k, src.height * k);
}

// ---------------------------------------------------------------- main menu

export async function showMain(): Promise<void> {
  const p = getProfile();
  const saved = await host.hasSave();
  const active = host.currentActive();
  show(`
    <div class="card menu">
      <h1>WARZONE <span>TD</span></h1>
      <p>Hold the line for ${TOTAL_WAVES} waves. There is no road: your towers are the walls. Build a maze that makes ground units walk past as many guns as possible — but you can never fully block them.</p>
      <div class="menu-grid">
        ${active ? '<button data-go="resume" class="primary big">Resume game</button>' : ''}
        ${saved && !active ? '<button data-go="continue" class="primary big">Continue saved game</button>' : ''}
        <button data-go="maps" class="${active || saved ? '' : 'primary '}big">Campaign maps</button>
        <button data-go="ww2" class="big">WW2 Campaign</button>
        <button data-go="random">Random map</button>
        <button data-go="daily">Daily challenge</button>
        <button data-go="custom">Custom maps</button>
        <button data-go="editor">Map editor</button>
        <button data-go="coop">Co-op (2 players)</button>
        <button data-go="ai">Co-op with AI</button>
        <button data-go="research">Research <b class="medal">${p.medals} ★</b></button>
        <button data-go="scores">Leaderboard</button>
        <button data-go="replay">Watch a replay</button>
        <button data-go="settings">Settings</button>
      </div>
      <p class="foot">${p.wins} wins in ${p.games} games${coopLink ? ' · <b>co-op partner connected</b>' : ''}</p>
    </div>`);
  on('[data-go]', (el) => {
    const go = el.dataset.go!;
    if (go === 'resume') host.resumeCurrent();
    else if (go === 'continue') host.continueSave();
    else if (go === 'maps') showMaps();
    else if (go === 'ww2') showCampaign();
    else if (go === 'ai') showMaps(PARTNER_ROLES[1].share);
    else if (go === 'random') showRandom();
    else if (go === 'daily') showDaily();
    else if (go === 'custom') showCustom();
    else if (go === 'editor') host.editor();
    else if (go === 'coop') showCoop();
    else if (go === 'research') showResearch();
    else if (go === 'scores') showScores();
    else if (go === 'replay') showReplayInput();
    else if (go === 'settings') showSettings(() => showMain());
  });
}

const back = '<button data-back>Back</button>';
const bindBack = (fn: () => void = () => showMain()) => on('[data-back]', fn);

// ---------------------------------------------------------------- campaign & custom maps

function mapCards(defs: MapDef[], extra: (i: number) => string = () => ''): string {
  return `<div class="maps">${defs.map((m, i) => `
    <button data-map="${i}"><canvas width="240" height="160"></canvas><b>${esc(m.name)}</b>
      <span class="size">${m.cols}×${m.rows} · ${m.routes.length} route${m.routes.length > 1 ? 's' : ''}</span>
      <span class="d">${esc(m.desc)}</span>${extra(i)}</button>`).join('')}</div>`;
}

function bindCards(defs: MapDef[], pick: (def: MapDef) => void): void {
  overlay.querySelectorAll<HTMLButtonElement>('[data-map]').forEach((b) => {
    const def = defs[Number(b.dataset.map)];
    paintPreview(b.querySelector('canvas')!, def);
    b.onclick = (e) => {
      if ((e.target as HTMLElement).closest('[data-del]')) return;
      pick(def);
    };
  });
}

/** Campaign map list; `partner` preselects an AI partner on the setup screen (Co-op with AI). */
export function showMaps(partner?: number): void {
  const title = partner ? 'Co-op with AI: choose a map' : 'Campaign maps';
  show(`<div class="card"><h2>${title}</h2>${mapCards(MAPS)}<div class="actions">${back}</div></div>`);
  bindCards(MAPS, (def) => showSetup(def, { partner }));
  bindBack();
}

// ---------------------------------------------------------------- WW2 campaign

/** The best result on a battle: "★★ Normal" for the hardest difficulty won, or the furthest wave. */
function battleRecord(b: Battle): string {
  const list = getProfile().scores[b.map.name] ?? [];
  const order: Difficulty[] = ['brutal', 'hard', 'normal', 'easy'];
  const won = order.find((d) => list.some((e) => e.win && e.difficulty === d));
  if (won) return `<span class="medal">${'★'.repeat(DIFFICULTIES[won].medals)} won on ${DIFFICULTIES[won].name}</span>`;
  const best = list.reduce((a, e) => Math.max(a, e.wave), 0);
  return best ? `best: wave ${best}/${b.waves}` : 'not yet fought';
}

export function showCampaign(): void {
  show(`<div class="card"><h2>WW2 Campaign</h2>
    <p class="d">The great battles of the war, each on its own ground, with the weapons of that time and place.</p>
    <div class="maps">${BATTLES.map((b, i) => `
      <button data-battle="${i}"><canvas width="240" height="160"></canvas><b>${esc(b.name)}</b>
        <span class="size">${esc(b.place)} · ${b.waves} waves</span>
        <span class="d">${FACTIONS[b.side].name} against ${FACTIONS[b.foe].name}${b.objective ? ` · keep ${esc(b.objective.name)}` : ''}</span>
        <span class="d">${battleRecord(b)}</span></button>`).join('')}</div>
    <div class="actions">${back}</div></div>`);
  overlay.querySelectorAll<HTMLButtonElement>('[data-battle]').forEach((el) => {
    const b = BATTLES[Number(el.dataset.battle)];
    paintPreview(el.querySelector('canvas')!, b.map);
    el.onclick = () => showBriefing(b);
  });
  bindBack();
}

function showBriefing(b: Battle): void {
  let difficulty: Difficulty = lastDifficulty;
  let partner = 0;
  const render = () => {
    const extras = [
      b.objective ? `Keep <b>${esc(b.objective.name)}</b> standing: if it falls, the battle is lost.` : '',
      b.airFrom ? `The weather grounds your aircraft until wave ${b.airFrom}.` : '',
      b.banned?.length ? `Not available here: ${b.banned.map((sl) => rulesetFor({ side: b.side, foe: b.foe }).towers.find((t) => t.slot === sl)?.short).join(', ')}.` : '',
      b.preset?.length ? 'Some positions are already dug in.' : '',
    ].filter(Boolean).map((t) => `<li>${t}</li>`).join('');
    show(`
      <div class="card setup">
        <h2>${esc(b.name)} <span class="tag">${esc(b.place)}</span></h2>
        <div class="setup-row"><canvas width="300" height="200"></canvas>
          <div>
            <h3>${FACTIONS[b.side].name} against ${FACTIONS[b.foe].name}</h3>
            <p>${esc(b.brief)}</p>
            <ul class="d">${extras}<li>The attackers march on your ${b.objective ? esc(b.objective.name) : 'headquarters'}: if it falls, the battle is lost. Hold for ${b.waves} waves, or destroy the enemy's headquarters at their end of the map.</li></ul>
            <h3>Difficulty</h3>
            <div class="seg wide">${(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => `<button data-diff="${d}" class="${d === difficulty ? 'on' : ''}">${DIFFICULTIES[d].name}</button>`).join('')}</div>
            <p class="d">headquarters ×${DIFFICULTIES[difficulty].lives / 20} · enemy HP ×${DIFFICULTIES[difficulty].hp} · start money ×${DIFFICULTIES[difficulty].money} · ${DIFFICULTIES[difficulty].medals} ★ for a win${difficulty === 'easy' ? ' · the enemy never breaches walls' : ''}</p>
            ${coopLink ? '' : `<h3>AI partner</h3>
            <div class="seg wide"><button data-partner="0" class="${partner ? '' : 'on'}">Off</button>${PARTNER_ROLES.map((r) => `<button data-partner="${r.share}" class="${partner === r.share ? 'on' : ''}">${r.name}</button>`).join('')}</div>
            <p class="d">${partner ? `A second commander shares your bank and ${PARTNER_ROLES.find((r) => r.share === partner)!.desc}: it reads the next wave, digs in what the line lacks and keeps its own positions repaired.` : 'Fight alone, or bring in an AI commander to build alongside you.'}</p>`}
          </div>
        </div>
        <div class="actions"><button data-start class="primary">Deploy</button>${back}</div>
      </div>`);
    paintPreview(overlay.querySelector('canvas')!, b.map);
    on('[data-diff]', (el) => {
      difficulty = el.dataset.diff as Difficulty;
      render();
    });
    on('[data-partner]', (el) => {
      partner = Number(el.dataset.partner);
      render();
    });
    on('[data-start]', () => {
      lastDifficulty = difficulty;
      const perks: Record<string, number> = {};
      for (const p of PERKS) if (perkLevel(p.id)) perks[p.id] = perkLevel(p.id);
      const ww2 = { side: b.side, foe: b.foe, battle: b.id };
      const towers = rulesetFor(ww2).towers;
      const ai = partner && !coopLink ? partner : undefined;
      host.start({
        map: b.map,
        difficulty,
        modifiers: [],
        allowed: b.banned ? towers.map((_, i) => i).filter((i) => !b.banned!.includes(towers[i].slot as never)) : undefined,
        perks,
        seed: Math.floor(Math.random() * 1e9),
        ww2,
        partner: ai,
      });
    });
    bindBack(() => showCampaign());
  };
  render();
}

function showCustom(): void {
  const maps = getProfile().customMaps;
  show(`<div class="card"><h2>Custom maps</h2>
    ${maps.length ? mapCards(maps, (i) => `<span class="row-mini"><span data-edit="${i}" class="link">Edit</span> · <span data-del="${i}" class="link">Delete</span></span>`) : '<p>No custom maps yet. Make one in the map editor, or open a shared map link.</p>'}
    <div class="actions"><button data-new>New map</button>${back}</div></div>`);
  bindCards(maps, (def) => showSetup(def));
  overlay.querySelectorAll<HTMLElement>('[data-edit]').forEach((el) => (el.onclick = (e) => {
    e.stopPropagation();
    host.editor(maps[Number(el.dataset.edit)]);
  }));
  overlay.querySelectorAll<HTMLElement>('[data-del]').forEach((el) => (el.onclick = (e) => {
    e.stopPropagation();
    deleteCustomMap(maps[Number(el.dataset.del)].name);
    showCustom();
  }));
  on('[data-new]', () => host.editor());
  bindBack();
}

// ---------------------------------------------------------------- game setup

let lastDifficulty: Difficulty = 'normal';

/** One line on where and when a WW2 matchup is fought. */
function matchup(side: Faction, foe: Faction): string {
  const key = `${side}-${foe}`;
  const where: Record<string, string> = {
    'de-su': '1941–45 on the Eastern Front: you hold the line as Germany against the Soviet offensive.',
    'su-de': '1941–43, Moscow to Kursk: you hold the line as the Soviet Union against the German assault.',
    'de-us': '1944 in Normandy: you hold the Atlantic Wall and the bocage against the Allied landings.',
    'us-de': '1944–45, the Bulge: you hold the line as the Western Allies against the German offensive.',
    'us-jp': '1942 on Guadalcanal: you hold the perimeter as the Allies against the Japanese night attacks.',
    'jp-us': '1945 on Iwo Jima: you hold the caves and bunkers as Japan against the American landings.',
  };
  return where[key] ?? `You hold the line as ${FACTIONS[side].name} against the ${FACTIONS[foe].adj} attack.`;
}
let lastEra: GameConfig['ww2'] = undefined;

/** Eight tower types for the Limited Arsenal modifier, always including a cheap wall. */
function limitedSet(seed: number, era: GameConfig['ww2']): number[] {
  const towers = rulesetFor(era).towers;
  const rng = new Rng(seed ^ 0x5bd1e995);
  const pool = towers.map((_, i) => i).filter((i) => towers[i].role !== 'gun');
  const picks = [towers.findIndex((t) => t.role === 'gun')];
  while (picks.length < 8) {
    const i = pool.splice(rng.int(pool.length), 1)[0];
    picks.push(i);
  }
  return picks.sort((a, b) => a - b);
}

export function showSetup(map: MapDef, opts: { daily?: string; modifiers?: Modifier[]; seed?: number; partner?: number } = {}): void {
  let difficulty: Difficulty = opts.daily ? 'normal' : lastDifficulty;
  let era = opts.daily ? undefined : lastEra;
  // an AI partner is for solo games: not with a human partner, not in the (comparable) daily
  const canPartnerAt = () => !opts.daily && !coopLink;
  let partner = canPartnerAt() ? opts.partner ?? 0 : 0;
  const mods = new Set<Modifier>(opts.modifiers ?? []);
  const seed = opts.seed ?? Math.floor(Math.random() * 1e9);
  const render = () => {
    const canPartner = canPartnerAt();
    if (!canPartner) partner = 0;
    const sides: { id: Faction | 'modern'; ready: boolean }[] = [
      { id: 'modern', ready: true },
      ...(Object.keys(FACTIONS) as Faction[]).map((f) => ({ id: f, ready: !!ARSENALS[f] && FACTIONS[f].foes.some((o) => ARMIES[o]) })),
    ];
    const foes = era ? FACTIONS[era.side].foes.filter((o) => ARMIES[o]) : [];
    show(`
      <div class="card setup">
        <h2>${esc(map.name)}${opts.daily ? ` <span class="tag">Daily ${opts.daily}</span>` : ''}${coopLink ? ' <span class="tag">Co-op</span>' : ''}${partner ? ' <span class="tag">Co-op with AI</span>' : ''}</h2>
        <div class="setup-row"><canvas width="300" height="200"></canvas>
          <div>
            <h3>Era</h3>
            <div class="seg wide">${sides.map((f) => {
              const on = f.id === 'modern' ? !era : era?.side === f.id;
              const label = f.id === 'modern' ? 'Modern' : `WW2 · ${FACTIONS[f.id].name}`;
              return `<button data-era="${f.id}" class="${on ? 'on' : ''}" ${opts.daily || !f.ready ? 'disabled' : ''} title="${f.ready ? '' : 'Coming later'}">${label}</button>`;
            }).join('')}</div>
            ${foes.length > 1 ? `<h3>Against</h3><div class="seg wide">${foes.map((o) => `<button data-foe="${o}" class="${era?.foe === o ? 'on' : ''}">${FACTIONS[o].name}</button>`).join('')}</div>` : ''}
            <p class="d">${era ? `${matchup(era.side, era.foe)} Both sides have a headquarters: theirs at the entry, yours where the routes end. The attackers march on yours and the waves never stop: destroy theirs to win. Realistic armour: small arms bounce off tanks, anti-tank guns kill from the side.` : 'The original game: lasers, railguns and superweapons.'}</p>
            <h3>Difficulty</h3>
            <div class="seg wide">${(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => `<button data-diff="${d}" class="${d === difficulty ? 'on' : ''}" ${opts.daily ? 'disabled' : ''}>${DIFFICULTIES[d].name}</button>`).join('')}</div>
            <p class="d">${era ? `headquarters ×${DIFFICULTIES[difficulty].lives / 20}` : `${DIFFICULTIES[difficulty].lives} lives`} · enemy HP ×${DIFFICULTIES[difficulty].hp} · start money ×${DIFFICULTIES[difficulty].money} · ${DIFFICULTIES[difficulty].medals} ★ for a win</p>
            <h3>Challenges</h3>
            ${MODIFIERS.map((m) => `<label class="mod"><input type="checkbox" data-mod="${m.id}" ${mods.has(m.id) ? 'checked' : ''} ${opts.daily ? 'disabled' : ''}> <b>${m.name}</b> <span class="d">${m.desc} Score ×${m.score}.</span></label>`).join('')}
            ${mods.has('limited') ? `<p class="d">Arsenal: ${limitedSet(seed, era).map((i) => rulesetFor(era).towers[i].short).join(', ')}</p>` : ''}
            ${canPartner ? `<h3>AI partner</h3>
            <div class="seg wide"><button data-partner="0" class="${partner ? '' : 'on'}">Off</button>${PARTNER_ROLES.map((r) => `<button data-partner="${r.share}" class="${partner === r.share ? 'on' : ''}">${r.name}</button>`).join('')}</div>
            <p class="d">${partner ? `A second commander shares your bank and ${PARTNER_ROLES.find((r) => r.share === partner)!.desc}: it reads the next wave, builds what the defence lacks and upgrades its own towers. It never sells or touches yours.` : 'Play alone, or bring in an AI commander to build alongside you.'}</p>` : ''}
          </div>
        </div>
        <div class="actions"><button data-start class="primary">Deploy</button>${back}</div>
      </div>`);
    paintPreview(overlay.querySelector('canvas')!, map);
    on('[data-era]', (el) => {
      const id = el.dataset.era as Faction | 'modern';
      era = id === 'modern' ? undefined : { side: id, foe: FACTIONS[id].foes.find((o) => ARMIES[o])! };
      render();
    });
    on('[data-foe]', (el) => {
      if (era) era = { side: era.side, foe: el.dataset.foe as Faction };
      render();
    });
    on('[data-diff]', (el) => {
      difficulty = el.dataset.diff as Difficulty;
      render();
    });
    on('[data-partner]', (el) => {
      partner = Number(el.dataset.partner);
      render();
    });
    overlay.querySelectorAll<HTMLInputElement>('[data-mod]').forEach((el) => (el.onchange = () => {
      const id = el.dataset.mod as Modifier;
      if (el.checked) mods.add(id);
      else mods.delete(id);
      render();
    }));
    on('[data-start]', () => {
      if (!opts.daily) {
        lastDifficulty = difficulty;
        lastEra = era;
      }
      const perks: Record<string, number> = {};
      for (const p of PERKS) if (perkLevel(p.id)) perks[p.id] = perkLevel(p.id);
      const cfg: GameConfig = {
        map,
        difficulty,
        modifiers: [...mods],
        allowed: mods.has('limited') ? limitedSet(seed, era) : undefined,
        perks: opts.daily ? {} : perks, // the daily is the same for everyone
        seed,
        daily: opts.daily,
        partner: partner || undefined,
        ww2: era,
      };
      const link = coopLink ?? undefined;
      if (link) link.send({ m: 'start', config: cfg });
      coopLink = null;
      host.start(cfg, link);
    });
    bindBack();
  };
  render();
}

// ---------------------------------------------------------------- random maps & daily

let randomOpts: RandomMapOptions = { seed: Math.floor(Math.random() * 1e6), size: 'M', routes: 1, density: 2, terrain: 2 };

export function showRandom(code?: string): void {
  if (code) randomOpts = parseMapCode(code) ?? randomOpts;
  const o = randomOpts;
  const def = randomMap(o);
  show(`
    <div class="card setup">
      <h2>Random map</h2>
      <div class="setup-row"><canvas width="360" height="240"></canvas>
        <div>
          <h3>Size</h3>
          <div class="seg wide">${(Object.keys(MAP_SIZES) as MapSize[]).map((s) => `<button data-size="${s}" class="${s === o.size ? 'on' : ''}">${MAP_SIZES[s].name}</button>`).join('')}</div>
          <h3>Routes</h3>
          <div class="seg wide">${[1, 2, 3].map((n) => `<button data-routes="${n}" class="${n === o.routes ? 'on' : ''}">${n}</button>`).join('')}</div>
          <h3>Rocks</h3>
          <div class="seg wide">${['None', 'Few', 'Some', 'Many'].map((n, k) => `<button data-dens="${k}" class="${k === o.density ? 'on' : ''}">${n}</button>`).join('')}</div>
          <h3>Terrain</h3>
          <div class="seg wide">${['Flat', 'Hills', 'Rivers', 'Rugged'].map((n, k) => `<button data-terr="${k}" class="${k === o.terrain ? 'on' : ''}">${n}</button>`).join('')}</div>
          <h3>Map code</h3>
          <div class="row-mini"><input id="code" value="${mapCode(o)}" spellcheck="false"> <button data-reroll>New seed</button></div>
          <p class="d">Share the code: the same code always makes the same map.</p>
        </div>
      </div>
      <div class="actions"><button data-next class="primary">Next</button>${back}</div>
    </div>`);
  paintPreview(overlay.querySelector('canvas')!, def);
  on('[data-size]', (el) => showRandom(mapCode({ ...o, size: el.dataset.size as MapSize })));
  on('[data-routes]', (el) => showRandom(mapCode({ ...o, routes: Number(el.dataset.routes) })));
  on('[data-dens]', (el) => showRandom(mapCode({ ...o, density: Number(el.dataset.dens) })));
  on('[data-terr]', (el) => showRandom(mapCode({ ...o, terrain: Number(el.dataset.terr) })));
  on('[data-reroll]', () => showRandom(mapCode({ ...o, seed: Math.floor(Math.random() * 1e6) })));
  overlay.querySelector<HTMLInputElement>('#code')!.onchange = (e) => {
    const c = (e.target as HTMLInputElement).value;
    if (parseMapCode(c)) showRandom(c);
  };
  on('[data-next]', () => showSetup(def));
  bindBack();
}

function showDaily(): void {
  const date = today();
  const { opts, towerSeed } = dailySetup(date);
  const def = { ...randomMap(opts), name: `Daily ${date}` };
  const rng = new Rng(towerSeed);
  const modifier = MODIFIERS.filter((m) => m.id !== 'oneLife')[rng.int(MODIFIERS.length - 1)].id;
  const best = getProfile().daily[date];
  show(`
    <div class="card setup">
      <h2>Daily challenge <span class="tag">${date}</span></h2>
      <div class="setup-row"><canvas width="360" height="240"></canvas>
        <div>
          <p>Everyone gets the same map, the same seed and the same twist today. Normal difficulty, no research perks.</p>
          <p><b>Map</b> ${MAP_SIZES[opts.size].name} · ${opts.routes} route${opts.routes > 1 ? 's' : ''}</p>
          <p><b>Twist</b> ${MODIFIERS.find((m) => m.id === modifier)!.name} — ${MODIFIERS.find((m) => m.id === modifier)!.desc}</p>
          <p><b>Your best today</b> ${best ? `${best.score} (wave ${best.wave})` : 'not played yet'}</p>
        </div>
      </div>
      <div class="actions"><button data-next class="primary">Play</button>${back}</div>
    </div>`);
  paintPreview(overlay.querySelector('canvas')!, def);
  on('[data-next]', () => showSetup(def, { daily: date, modifiers: [modifier], seed: towerSeed }));
  bindBack();
}

// ---------------------------------------------------------------- research

function showResearch(): void {
  const p = getProfile();
  show(`
    <div class="card">
      <h2>Research <span class="medal">${p.medals} ★</span></h2>
      <p>Medals come from victories (more on harder difficulties and with challenges) and from every ten waves survived in endless mode. Perks apply to every new game except the daily challenge.</p>
      <div class="perks">${PERKS.map((d) => {
        const lv = perkLevel(d.id);
        const maxed = lv >= d.costs.length;
        return `<div class="perk"><b>${d.name}</b><span class="pips">${d.costs.map((_, k) => `<i class="${k < lv ? 'on' : ''}"></i>`).join('')}</span>
          <span class="d">${d.desc}</span>
          <button data-buy="${d.id}" ${maxed || p.medals < d.costs[lv] ? 'disabled' : ''}>${maxed ? 'Maxed' : `Research ${d.costs[lv]} ★`}</button></div>`;
      }).join('')}</div>
      <div class="actions"><button data-reset>Refund all</button>${back}</div>
    </div>`);
  on('[data-buy]', (el) => {
    buyPerk(el.dataset.buy!);
    showResearch();
  });
  on('[data-reset]', () => {
    resetPerks();
    showResearch();
  });
  bindBack();
}

// ---------------------------------------------------------------- leaderboard

function showScores(): void {
  const p = getProfile();
  const names = Object.keys(p.scores);
  const daily = Object.entries(p.daily).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 7);
  show(`
    <div class="card">
      <h2>Leaderboard</h2>
      ${names.length ? names.map((n) => `
        <h3>${esc(n)}</h3>
        <table class="scores"><tr><th>#</th><th>Score</th><th>Wave</th><th>Kills</th><th>Difficulty</th><th>Challenges</th><th>Date</th></tr>
        ${p.scores[n].map((s, k) => `<tr class="${s.win ? 'win' : ''}"><td>${k + 1}</td><td>${s.score}</td><td>${s.wave}</td><td>${s.kills}</td><td>${DIFFICULTIES[s.difficulty].name}</td><td>${s.modifiers.map((m) => MODIFIERS.find((x) => x.id === m)?.name ?? m).join(', ') || '—'}</td><td>${s.date}</td></tr>`).join('')}
        </table>`).join('') : '<p>No games finished yet.</p>'}
      ${daily.length ? `<h3>Daily challenges</h3><table class="scores"><tr><th>Date</th><th>Score</th><th>Wave</th></tr>${daily.map(([d, s]) => `<tr><td>${d}</td><td>${s.score}</td><td>${s.wave}</td></tr>`).join('')}</table>` : ''}
      <p class="d">Scores are kept in this browser.</p>
      <div class="actions">${back}</div>
    </div>`);
  bindBack();
}

// ---------------------------------------------------------------- replays

function showReplayInput(): void {
  show(`
    <div class="card" style="max-width:560px">
      <h2>Watch a replay</h2>
      <p>Paste a replay link. You get one from the end-of-game screen ("Copy replay link").</p>
      <input id="rl" placeholder="https://…#replay=…" style="width:100%">
      <p class="d" id="rerr"></p>
      <div class="actions"><button data-watch class="primary">Watch</button>${back}</div>
    </div>`);
  on('[data-watch]', async () => {
    const v = overlay.querySelector<HTMLInputElement>('#rl')!.value.trim();
    const hashAt = v.indexOf('#');
    if (hashAt < 0) return void (overlay.querySelector('#rerr')!.textContent = 'That is not a replay link.');
    location.hash = v.slice(hashAt);
  });
  bindBack();
}

// ---------------------------------------------------------------- co-op

function showCoop(): void {
  show(`
    <div class="card" style="max-width:600px">
      <h2>Co-op</h2>
      <p>Two players defend the same map with a shared bank. One hosts and gets a room code; the other joins with it. The connection is direct between your browsers.</p>
      <div class="actions"><button data-host class="primary">Host a game</button></div>
      <h3>Join</h3>
      <div class="row-mini"><input id="code" placeholder="ROOM CODE" maxlength="6" style="text-transform:uppercase"> <button data-join>Join</button></div>
      <p class="d" id="status"></p>
      <div class="actions">${back}</div>
    </div>`);
  const status = overlay.querySelector<HTMLElement>('#status')!;
  let cancel: (() => void) | null = null;
  on('[data-host]', async () => {
    status.textContent = 'Opening a room…';
    try {
      const room = await hostRoom();
      cancel = room.cancel;
      status.innerHTML = `Room code: <b class="code">${room.code}</b> — waiting for your partner to join…`;
      const link = await room.connected;
      coopLink = link;
      link.onClose = () => (coopLink = null);
      showMaps();
      overlay.querySelector('h2')!.textContent = 'Co-op: choose a map';
    } catch (e) {
      status.textContent = `Could not open a room: ${(e as Error).message}`;
    }
  });
  on('[data-join]', async () => {
    const code = overlay.querySelector<HTMLInputElement>('#code')!.value;
    status.textContent = 'Connecting…';
    try {
      const link = await join(code);
      status.textContent = 'Connected! Waiting for the host to pick a map…';
      const wait = (msgs: ReturnType<NetLink['drain']>) => {
        const start = msgs.find((m) => m.m === 'start');
        if (start && start.m === 'start') {
          link.onMessage = null;
          host.start(start.config, link);
          return true;
        }
        return false;
      };
      if (!wait(link.drain())) link.onMessage = (m) => wait([m]);
      link.onClose = () => (status.textContent = 'The host left.');
    } catch (e) {
      status.textContent = `${(e as Error).message}`;
    }
  });
  bindBack(() => {
    cancel?.();
    showMain();
  });
}

// ---------------------------------------------------------------- settings

export function showSettings(done: () => void): void {
  const slider = (key: keyof Settings, label: string) =>
    `<label class="set"><span>${label}</span><input type="range" min="0" max="1" step="0.05" data-set="${key}" value="${settings[key]}"></label>`;
  const toggle = (key: keyof Settings, label: string) =>
    `<label class="set"><span>${label}</span><input type="checkbox" data-set="${key}" ${settings[key] ? 'checked' : ''}></label>`;
  show(`
    <div class="card" style="max-width:620px">
      <h2>Settings</h2>
      <div class="settings">
        ${slider('master', 'Master volume')}
        ${slider('sfx', 'Effects volume')}
        ${slider('music', 'Music volume')}
        <label class="set"><span>Effects quality</span><select data-set="quality">${['low', 'medium', 'high'].map((q) => `<option ${settings.quality === q ? 'selected' : ''}>${q}</option>`).join('')}</select></label>
        ${toggle('shake', 'Screen shake')}
        ${toggle('numbers', 'Floating damage and bounty numbers')}
        ${toggle('wrecks', 'Wrecks and scorch marks')}
        ${toggle('colorblind', 'Colour-blind friendly colours')}
      </div>
      <h3>Controls</h3>
      <table class="keys">
        <tr><td>1–9, 0 · Q / E</td><td>First ten towers · previous / next tower</td></tr>
        <tr><td>Click / drag</td><td>Build (drag paints walls) · select</td></tr>
        <tr><td>Shift-drag</td><td>Select a group of towers</td></tr>
        <tr><td>Esc / right-click</td><td>Cancel</td></tr>
        <tr><td>U · S · T</td><td>Upgrade · sell · targeting mode</td></tr>
        <tr><td>Ctrl+Z</td><td>Undo the last build (5 s, full refund)</td></tr>
        <tr><td>G · R</td><td>Open/close gate · fire superweapon</td></tr>
        <tr><td>H · [ ] \\</td><td>Select commander · airstrike, rally, stun grenade</td></tr>
        <tr><td>Z X C</td><td>Barrage · mine drop · supply crate</td></tr>
        <tr><td>N · Space · F</td><td>Next wave · pause · speed</td></tr>
        <tr><td>Hold Tab</td><td>Show every aura</td></tr>
        <tr><td>Drag · arrows · wheel</td><td>Pan · pan · zoom (Home: whole map)</td></tr>
        <tr><td>V</td><td>Top / isometric camera</td></tr>
        <tr><td>Touch</td><td>Tap to build/select · drag to pan · pinch to zoom</td></tr>
      </table>
      <div class="actions"><button data-back class="primary">Done</button></div>
    </div>`);
  overlay.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-set]').forEach((el) => {
    el.oninput = el.onchange = () => {
      const key = el.dataset.set as keyof Settings;
      const v = el instanceof HTMLInputElement ? (el.type === 'checkbox' ? el.checked : Number(el.value)) : el.value;
      updateSettings({ [key]: v } as Partial<Settings>);
    };
  });
  bindBack(done);
}

/** The co-op link waiting for a map choice, so the host's setup screen can hand it over. */
export function pendingCoop(): NetLink | null {
  return coopLink;
}
