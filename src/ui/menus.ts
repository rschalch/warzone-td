// Every screen outside the battlefield, drawn into #overlay.

import { getProfile, buyPerk, resetPerks, perkLevel, deleteCustomMap } from '../app/profile';
import { settings, updateSettings, type Settings } from '../app/settings';
import { join, host as hostRoom, type NetLink } from '../app/net';
import type { Replay } from '../app/share';
import { DIFFICULTIES, MODIFIERS, PERKS, type Difficulty, type GameConfig, type Modifier } from '../game/config';
import { TOTAL_WAVES, TOWERS } from '../game/defs';
import { MAP_SIZES, dailySetup, mapCode, parseMapCode, randomMap, today, type MapSize, type RandomMapOptions } from '../game/mapgen';
import { MAPS, type MapDef } from '../game/maps';
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
        <button data-go="random">Random map</button>
        <button data-go="daily">Daily challenge</button>
        <button data-go="custom">Custom maps</button>
        <button data-go="editor">Map editor</button>
        <button data-go="coop">Co-op (2 players)</button>
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

export function showMaps(): void {
  show(`<div class="card"><h2>Campaign maps</h2>${mapCards(MAPS)}<div class="actions">${back}</div></div>`);
  bindCards(MAPS, (def) => showSetup(def));
  bindBack();
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

/** Eight tower types for the Limited Arsenal modifier, always including a cheap wall. */
function limitedSet(seed: number): number[] {
  const rng = new Rng(seed ^ 0x5bd1e995);
  const pool = TOWERS.map((_, i) => i).filter((i) => TOWERS[i].kind !== 'gun');
  const picks = [TOWERS.findIndex((t) => t.kind === 'gun')];
  while (picks.length < 8) {
    const i = pool.splice(rng.int(pool.length), 1)[0];
    picks.push(i);
  }
  return picks.sort((a, b) => a - b);
}

export function showSetup(map: MapDef, opts: { daily?: string; modifiers?: Modifier[]; seed?: number } = {}): void {
  let difficulty: Difficulty = opts.daily ? 'normal' : lastDifficulty;
  const mods = new Set<Modifier>(opts.modifiers ?? []);
  const seed = opts.seed ?? Math.floor(Math.random() * 1e9);
  const render = () => {
    show(`
      <div class="card setup">
        <h2>${esc(map.name)}${opts.daily ? ` <span class="tag">Daily ${opts.daily}</span>` : ''}${coopLink ? ' <span class="tag">Co-op</span>' : ''}</h2>
        <div class="setup-row"><canvas width="300" height="200"></canvas>
          <div>
            <h3>Difficulty</h3>
            <div class="seg wide">${(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => `<button data-diff="${d}" class="${d === difficulty ? 'on' : ''}" ${opts.daily ? 'disabled' : ''}>${DIFFICULTIES[d].name}</button>`).join('')}</div>
            <p class="d">${DIFFICULTIES[difficulty].lives} lives · enemy HP ×${DIFFICULTIES[difficulty].hp} · start money ×${DIFFICULTIES[difficulty].money} · ${DIFFICULTIES[difficulty].medals} ★ for a win</p>
            <h3>Challenges</h3>
            ${MODIFIERS.map((m) => `<label class="mod"><input type="checkbox" data-mod="${m.id}" ${mods.has(m.id) ? 'checked' : ''} ${opts.daily ? 'disabled' : ''}> <b>${m.name}</b> <span class="d">${m.desc} Score ×${m.score}.</span></label>`).join('')}
            ${mods.has('limited') ? `<p class="d">Arsenal: ${limitedSet(seed).map((i) => TOWERS[i].short).join(', ')}</p>` : ''}
          </div>
        </div>
        <div class="actions"><button data-start class="primary">Deploy</button>${back}</div>
      </div>`);
    paintPreview(overlay.querySelector('canvas')!, map);
    on('[data-diff]', (el) => {
      difficulty = el.dataset.diff as Difficulty;
      render();
    });
    overlay.querySelectorAll<HTMLInputElement>('[data-mod]').forEach((el) => (el.onchange = () => {
      const id = el.dataset.mod as Modifier;
      if (el.checked) mods.add(id);
      else mods.delete(id);
      render();
    }));
    on('[data-start]', () => {
      if (!opts.daily) lastDifficulty = difficulty;
      const perks: Record<string, number> = {};
      for (const p of PERKS) if (perkLevel(p.id)) perks[p.id] = perkLevel(p.id);
      const cfg: GameConfig = {
        map,
        difficulty,
        modifiers: [...mods],
        allowed: mods.has('limited') ? limitedSet(seed) : undefined,
        perks: opts.daily ? {} : perks, // the daily is the same for everyone
        seed,
        daily: opts.daily,
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

let randomOpts: RandomMapOptions = { seed: Math.floor(Math.random() * 1e6), size: 'M', routes: 1, density: 2 };

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
