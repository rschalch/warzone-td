import { Application, Container, type Texture } from 'pixi.js';
import type { NetLink } from './app/net';
import { computeScore, getProfile, recordGame, saveCustomMap } from './app/profile';
import { Session, type SessionCommand } from './app/session';
import { onSettings, settings, updateSettings } from './app/settings';
import { copyText, mapLink, readHash, replayLink, type Replay } from './app/share';
import { idbGet, idbSet } from './app/storage';
import { sound } from './audio/sound';
import type { LoggedCommand } from './game/commands';
import { DIFFICULTIES, type GameConfig } from './game/config';
import { COLS, ENEMIES, MAP_H, MAP_W, ROWS, TILE, TOWERS, UNITS, WW2 } from './game/defs';
import { MAPS, buildMap, useMapSize, type MapDef } from './game/maps';
import { parseMapCode } from './game/mapgen';
import { PARTNER } from './game/partner';
import {
  Sim as SimClass,
  EV_ABILITY, EV_BOOM, EV_BUILD, EV_DENY, EV_HIT, EV_ITEM, EV_LEAK, EV_LEVEL, EV_NUKE, EV_SELL, EV_SHOT, EV_SIZE, EV_STATUS,
  AIR_Z, EV_DOWN, EV_ESHOT, EV_UPGRADE, EV_USHOT, EV_WAVE, EV_WRECK, heroAbilities, MAX_UNITS, type Sim, type Tower,
} from './game/sim';
import { BATTLES } from './game/battles';
import { atlasHas, buildAtlas, buildBackground, drawTerrain, refineBackground, setsFor, towerIcon, type Atlas } from './render/atlas';
import { makeProjection, type CameraMode, type Projection } from './render/projection';
import { GameRenderer } from './render/renderer';
import { blankMap, openEditor } from './ui/editor';
import { Hud } from './ui/hud';
import { hideMenus, initMenus, showMain, showRandom, showSettings, showSetup } from './ui/menus';
import { Minimap } from './ui/minimap';

let app: Application;
let atlas: Atlas;
let session: Session | null = null;
let link: NetLink | null = null;
let view: GameRenderer | null = null;
let background: Texture | null = null;
let cameraMode: CameraMode = loadCamera();
let projection: Projection = makeProjection(cameraMode);

const sim = (): Sim | null => session?.sim ?? null;

// camera: the projected-screen point at the middle of the canvas, and pixels per projected unit
const cam = new Container();
let camX = 0;
let camY = 0;
let zoom = 1;
let viewW = 960; // canvas size in CSS pixels
let viewH = 640;
let shake = 0;
const MAX_ZOOM = 3;
const PAN_SPEED = 900; // CSS px per second for the arrow keys
const keysHeld = new Set<string>();
let minimap: Minimap | null = null;

let lastSpeed = 1;
let placing = -1;
let selected: Tower | null = null;
let multi: Tower[] = [];
let heroSelected = false;
/** WW2: selected defender units, by uid. */
let unitSel: number[] = [];
/** Enemy being inspected (slot + uid, so a recycled slot isn't mistaken for it). */
let enemySel: { slot: number; uid: number } | null = null;
/** A superweapon, item or hero ability waiting for its target click. */
let targeting: { kind: 'super' | 'item' | 'ability' | 'mines'; index: number; r: number; color: number } | null = null;
let aimX = 0;
let aimY = 0;
let hoverCol = -9;
let hoverRow = -9;
let cellCol = -1;
let cellRow = -1;
let endShown = false;
let endlessFrom = 0; // wave at which the player chose to continue in endless mode
let slowmo = 0; // s of real time left in hit-stop slow motion
let wasClear = true;

// perf counters
let frames = 0;
let simTimeAcc = 0;
let renderTimeAcc = 0;
let perfT = 0;

const overlay = document.getElementById('overlay')!;
const stage = document.getElementById('stage')!;

const QUALITY = { low: 0.35, medium: 0.65, high: 1 };

// ---------------------------------------------------------------- commands

function issue(cmd: SessionCommand): void {
  if (!session) return;
  session.issue(cmd);
}

/** Feedback for our own commands once they have been applied (they may be delayed in co-op). */
function handleResults(): void {
  if (!session) return;
  for (const { cmd, ok } of session.results) {
    if (!ok && (cmd.t === 'place' || cmd.t === 'upgrade' || cmd.t === 'item' || cmd.t === 'heroAbility' || cmd.t === 'fire')) {
      sound.play('deny');
    }
    if (!ok && cmd.t === 'gate') flash('The gate can’t close: units in the way or it would seal the route');
    if (!ok && cmd.t === 'sell' && !session.sim.canSell) flash('Ironman: no selling');
    if (!ok && cmd.t === 'train') flash('Can’t train: not enough money or manpower (HQs and depots raise it), or already training');
    if (!ok && cmd.t === 'repair') flash('Can’t repair: not enough money, or units are standing in the rubble');
  }
  session.results.length = 0;
  // the AI partner talks over the radio
  const said = session.partner?.said;
  if (said?.length) {
    radio(said[said.length - 1]);
    said.length = 0;
  }
}

const hud = new Hud({
  pick: (t) => pick(t),
  upgrade: () => selected && issue({ t: 'upgrade', ids: [selected.id] }),
  sell: () => sellSelected(),
  upgradeAllOfType: () => {
    const s = sim();
    if (!s || !selected) return;
    upgradeCheapestFirst(s.towers.filter((t) => t.type === selected!.type));
  },
  mode: (m) => selected && issue({ t: 'mode', id: selected.id, mode: m }),
  gate: () => toggleGate(),
  repair: () => repairSelected(),
  train: (unit) => selected && issue({ t: 'train', id: selected.id, unit }),
  stance: (stance) => unitSel.length && issue({ t: 'unitStance', ids: unitSel, stance }),
  dig: () => unitSel.length && issue({ t: 'unitDig', ids: unitSel }),
  mines: () => startMines(),
  fire: () => startSuper(),
  next: () => issue({ t: 'wave' }),
  speed: (s) => setSpeed(s),
  menu: () => openMenu(),
  camera: () => toggleCamera(),
  settings: () => openSettings(),
  undo: () => issue({ t: 'undo' }),
  stress: () => {
    issue({ t: 'stress' });
    if (session?.speed === 0) setSpeed(1);
  },
  item: (i) => startItem(i),
  hero: () => selectHero(),
  ability: (a) => startAbility(a),
  multiUpgrade: () => upgradeCheapestFirst(multi),
  multiSell: () => {
    if (multi.length) issue({ t: 'sell', ids: multi.map((t) => t.id) });
    multi = [];
  },
  skipWave: () => session?.skipToWave((session.sim.wave || 0) + 1),
});

/** Upgrades towers one level each, cheapest first, as far as the money goes. */
function upgradeCheapestFirst(list: Tower[]): void {
  const s = sim();
  if (!s) return;
  let money = s.money;
  const ids: number[] = [];
  for (const t of [...list].sort((a, b) => s.upgradeCost(a) - s.upgradeCost(b))) {
    const c = s.upgradeCost(t);
    if (c > 0 && c <= money) {
      money -= c;
      ids.push(t.id);
    }
  }
  if (ids.length) issue({ t: 'upgrade', ids });
  else sound.play('deny');
}

function clearSelection(): void {
  selected = null;
  multi = [];
  heroSelected = false;
  unitSel = [];
  targeting = null;
  enemySel = null;
}

/** Slots of the selected units that are still alive. */
function unitSlots(s: Sim): number[] {
  const out: number[] = [];
  for (const id of unitSel) {
    const u = s.unitSlot(id);
    if (u >= 0) out.push(u);
  }
  return out;
}

/** WW2: our unit under the pointer (aircraft are drawn high up). */
function unitUnder(e: { clientX: number; clientY: number }): number {
  const s = sim();
  if (!s || !WW2) return -1;
  const [sx, sy] = canvasToScreen(...pointerToCanvas(e));
  let best = -1;
  let bestD = Infinity;
  for (let u = 0; u < MAX_UNITS; u++) {
    if (!s.uAlive[u]) continue;
    const ux = projection.x(s.uX[u], s.uY[u]);
    const uy = projection.y(s.uX[u], s.uY[u]) - (s.uAir[u] ? AIR_Z : 6) * projection.lift;
    const d = Math.hypot(ux - sx, uy - sy);
    if (d < UNITS[s.uKind[u]].radius + 7 && d < bestD) {
      bestD = d;
      best = u;
    }
  }
  return best;
}

/** The enemy under the pointer, if any (aircraft are drawn high up, so test where they appear). */
function enemyUnder(e: { clientX: number; clientY: number }): number {
  const s = sim();
  if (!s) return -1;
  const [sx, sy] = canvasToScreen(...pointerToCanvas(e));
  let best = -1;
  let bestD = Infinity;
  for (let n = 0; n < s.liveCount; n++) {
    const i = s.live[n];
    if (!s.eAlive[i] || s.hidden(i) || !s.seen(i)) continue;
    const ex = projection.x(s.eX[i], s.eY[i]);
    const ey = projection.y(s.eX[i], s.eY[i]) - (s.eAir[i] ? AIR_Z : 6) * projection.lift;
    const d = Math.hypot(ex - sx, ey - sy);
    if (d < ENEMIES[s.eKind[i]].radius + 8 && d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

function pick(t: number): void {
  const s = sim();
  if (!s || session!.mode === 'replay') return;
  if (!s.allowed(t)) return flash('Not available in this game');
  clearSelection();
  placing = placing === t ? -1 : t;
  if (placing >= 0) hud.reveal(placing);
}

/** Q/E: the previous/next tower in the palette that this game allows. */
function stepTower(dir: number): void {
  const s = sim();
  if (!s) return;
  let t = placing < 0 ? (dir > 0 ? -1 : 0) : placing;
  for (let n = 0; n < TOWERS.length; n++) {
    t = (t + dir + TOWERS.length) % TOWERS.length;
    if (s.allowed(t)) {
      if (placing !== t) pick(t);
      return;
    }
  }
}

function toggleGate(): void {
  if (selected?.kind === 'gate') issue({ t: 'gate', id: selected.id });
}

/** WW2: repair or rebuild the selected emplacement(s). */
function repairSelected(): void {
  const s = sim();
  if (!s) return;
  const list = (multi.length ? multi : selected ? [selected] : []).filter((t) => s.repairCost(t) > 0);
  if (list.length) issue({ t: 'repair', ids: list.map((t) => t.id) });
}

function startSuper(): void {
  const s = sim();
  if (!s || !selected || !TOWERS[selected.type].manual) return;
  if (s.chargeLevel(selected) < 1) return flash('Still charging');
  const lv = TOWERS[selected.type].levels[selected.level];
  targeting = { kind: 'super', index: selected.id, r: selected.kind === 'orbital' ? 200 : lv.splash ?? 100, color: 0xff5a5a };
  placing = -1;
}

function startItem(i: number): void {
  const s = sim();
  if (!s || session!.mode === 'replay') return;
  if (s.items[i] <= 0) return flash('No charges left — one comes back each wave');
  if (i === 2) {
    // supply crate needs no target
    issue({ t: 'item', item: 2, x: aimX, y: aimY });
    return;
  }
  placing = -1;
  targeting = { kind: 'item', index: i, r: i === 0 ? 90 : 70, color: i === 0 ? 0xff7a3a : 0xffd84a };
}

function selectHero(): void {
  const s = sim();
  if (!s?.hero) return;
  const was = heroSelected;
  clearSelection();
  placing = -1;
  heroSelected = true;
  if (was) lookAt(s.hero.x, s.hero.y); // second press: centre on the commander
}

function startAbility(a: number): void {
  const s = sim();
  if (!s?.hero || session!.mode === 'replay') return;
  if (s.hero.cd[a] > 0) return flash(`${heroAbilities()[a].name} ready in ${Math.ceil(s.hero.cd[a])}s`);
  if (a === 1) {
    issue({ t: 'heroAbility', ability: 1, x: s.hero.x, y: s.hero.y });
    return;
  }
  placing = -1;
  targeting = { kind: 'ability', index: a, r: a === 0 ? 90 : 70, color: a === 0 ? 0xff7a3a : 0xfff07a };
}

/** WW2: the selected engineers wait for a point to mine. */
function startMines(): void {
  const s = sim();
  if (!s || session!.mode === 'replay') return;
  const eng = unitSel.filter((id) => {
    const u = s.unitSlot(id);
    return u >= 0 && UNITS[s.uKind[u]].repair;
  });
  if (!eng.length) return flash('Select engineers to lay mines');
  placing = -1;
  targeting = { kind: 'mines', index: 0, r: 24 + 8 * Math.min(eng.length, 9), color: 0xc8a060 };
}

/** Fires whatever is waiting for a target at (x, y). */
function fireTargeting(x: number, y: number): void {
  if (!targeting) return;
  const t = targeting;
  if (t.kind === 'super') issue({ t: 'fire', id: t.index, x, y });
  else if (t.kind === 'item') issue({ t: 'item', item: t.index, x, y });
  else if (t.kind === 'mines') issue({ t: 'unitMines', ids: unitSel, x, y });
  else issue({ t: 'heroAbility', ability: t.index, x, y });
  targeting = null;
}

let flashTimer = 0;
/** A short message over the battlefield. */
let radioTimer = 0;

/** A line from the AI partner, shown under the banner for a few seconds. */
function radio(text: string): void {
  let el = document.getElementById('radio');
  if (!el) {
    el = document.createElement('div');
    el.id = 'radio';
    stage.appendChild(el);
  }
  el.innerHTML = '<b>Partner:</b> ';
  el.append(text);
  el.classList.add('show');
  sound.play('click');
  clearTimeout(radioTimer);
  radioTimer = window.setTimeout(() => el!.classList.remove('show'), 4500);
}

function flash(text: string): void {
  let el = document.getElementById('flash');
  if (!el) {
    el = document.createElement('div');
    el.id = 'flash';
    stage.appendChild(el);
  }
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(flashTimer);
  flashTimer = window.setTimeout(() => el!.classList.remove('show'), 1800);
}

function sellSelected(): void {
  if (!selected) return;
  issue({ t: 'sell', ids: [selected.id] });
  selected = null;
}

function setSpeed(s: number): void {
  if (!session) return;
  if (s > 0) lastSpeed = s;
  session.issue({ t: 'speed', speed: s });
}

// ---------------------------------------------------------------- game lifecycle

interface StartOpts {
  link?: NetLink;
  replay?: Replay;
  restore?: Record<string, unknown>;
  log?: LoggedCommand[];
}

function startGame(cfg: GameConfig, opts: StartOpts = {}): void {
  const sets = setsFor(cfg.ww2);
  if (!atlasHas(sets)) {
    // each era's and faction's models are baked the first time they are needed, keeping the boot fast
    flash(cfg.ww2 ? 'Loading WW2 models…' : 'Loading models…');
    const old = atlas;
    void buildAtlas(sets).then((a) => {
      atlas = a;
      startGame(cfg, opts);
      old.px.source.destroy();
    });
    return;
  }
  link?.close();
  link = opts.link ?? null;
  session = new Session(cfg, { link: opts.link, replay: opts.replay?.log, restore: opts.restore, log: opts.log });
  const s = session.sim;
  s.fxScale = QUALITY[settings.quality];
  background?.destroy(true);
  background = buildBackground(s.map, app.renderer);
  projection = makeProjection(cameraMode);
  buildView();
  // the detailed (eroded) terrain is built in a worker and swapped in when ready
  const game = session;
  void refineBackground(s.map, app.renderer).then((tex) => {
    if (!tex) return;
    if (session !== game || !view) return tex.destroy(true);
    view.setBackground(tex);
    background?.destroy(true);
    background = tex;
  });
  minimap?.destroy();
  minimap = new Minimap(stage, s.map, s, (wx, wy) => lookAt(wx, wy));
  hud.configure(s);
  // open on the first entry, zoomed so the gates read clearly
  zoom = Math.max(minZoom(), 1);
  const [ax, ay] = s.map.routes[0].airFrom;
  lookAt(Math.min(MAP_W, Math.max(0, ax)), Math.min(MAP_H, Math.max(0, ay)));
  placing = -1;
  clearSelection();
  endShown = false;
  endlessFrom = 0;
  wasClear = true;
  lastSpeed = 1;
  session.speed = opts.restore ? 0 : 1;
  if (link) {
    link.onClose = () => {
      session?.dropLink();
      link = null;
      flash('Your partner left — carrying on solo');
    };
  }
  hideMenus();
  sound.setFaction(cfg.ww2?.side);
  sound.setMusic(true);
  if (opts.restore) flash('Game restored — paused. Press Space to continue.');
}

function openMenu(): void {
  if (session && session.mode !== 'coop') session.speed = 0;
  void showMain();
}

function openSettings(): void {
  if (session && session.mode !== 'coop') session.speed = 0;
  showSettings(() => (session && !session.finished ? resume() : void showMain()));
}

function resume(): void {
  hideMenus();
  if (session && session.mode !== 'coop') session.speed = lastSpeed;
}

function loadCamera(): CameraMode {
  try {
    return localStorage.getItem('wztd.camera') === 'iso' ? 'iso' : 'top';
  } catch {
    return 'top';
  }
}

function buildView(): void {
  if (view) {
    cam.removeChild(view.root);
    view.root.destroy({ children: true });
    view = null;
  }
  fit();
  if (!session || !background) return;
  view = new GameRenderer(session.sim, atlas, background, projection);
  cam.addChild(view.root);
  applyCamera();
}

function toggleCamera(): void {
  // keep looking at the same spot on the ground
  const [wx, wy] = projection.toWorld(camX, camY);
  cameraMode = cameraMode === 'top' ? 'iso' : 'top';
  projection = makeProjection(cameraMode);
  try {
    localStorage.setItem('wztd.camera', cameraMode);
  } catch {
    // storage unavailable: the choice just won't persist
  }
  hud.camera(cameraMode);
  buildView();
  lookAt(wx, wy);
}

// ---------------------------------------------------------------- saving

let saving = false;

/** Saves the running solo game (snapshot + log) so it can be continued after a reload. */
async function saveGame(): Promise<void> {
  if (!session || session.mode !== 'local' || session.finished || saving || session.sim.wave === 0) return;
  saving = true;
  await idbSet('save', { config: session.config, snapshot: session.sim.snapshot(), log: session.log, wave: session.sim.wave, at: Date.now() });
  saving = false;
}

interface SaveData {
  config: GameConfig;
  snapshot: Record<string, unknown>;
  log: LoggedCommand[];
  wave: number;
}

// ---------------------------------------------------------------- end of game

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** "Pavlov's House has fallen" when a battle was lost with its objective. */
function objectiveLost(s: Sim): string | null {
  const o = s.battle?.objective;
  if (o && s.objectiveId) {
    const t = s.tower(s.objectiveId);
    if (t?.wreck) return `${o.name} has fallen (wave ${s.wave})`;
  }
  return s.towers.some((t) => t.base > 0 && t.wreck) ? `Your headquarters has fallen (wave ${s.wave})` : null;
}

/** How a WW2 game was won: their headquarters taken, or held until the end. */
function winLine(s: Sim): string {
  if (s.config.ww2 && s.enemyHqHealth <= 0) return `The enemy headquarters is destroyed (wave ${s.wave})`;
  return `${s.battle ? `${s.battle.name} held! ` : ''}All ${s.totalWaves} waves repelled`;
}

async function showEnd(win: boolean): Promise<void> {
  endShown = true;
  const s = session!.sim;
  const cfg = session!.config;
  const replayMode = session!.mode === 'replay';
  sound.play(win ? 'victory' : 'defeat');
  const finalWin = win || endlessFrom > 0;
  const score = computeScore(cfg, s.wave, s.totalKills, cfg.ww2 ? s.lives / 5 : s.lives, finalWin);
  let medals = 0;
  if (!replayMode) {
    const entry = { score, wave: s.wave, kills: s.totalKills, win: finalWin, difficulty: cfg.difficulty, modifiers: cfg.modifiers, date: new Date().toISOString().slice(0, 10) };
    medals = recordGame(cfg, entry, endlessFrom ? s.wave - s.totalWaves : 0, !endlessFrom);
    void idbSet('save', undefined);
  }
  const board = getProfile().scores[cfg.map.name] ?? [];
  const rank = board.findIndex((e) => e.score === score) + 1;
  overlay.classList.remove('hidden');
  overlay.innerHTML = `
    <div class="card" style="max-width:460px;text-align:center">
      <h1>${replayMode ? 'REPLAY ENDED' : win ? 'VICTORY' : endlessFrom ? 'OVERRUN' : 'DEFEAT'}</h1>
      ${s.battle ? `<h2>${esc(s.battle.name)}</h2>` : ''}
      <p>${win ? winLine(s) : objectiveLost(s) ?? `Wave ${s.wave}`} · ${s.totalKills} kills · ${DIFFICULTIES[cfg.difficulty].name}</p>
      <p class="score">Score <b>${score}</b>${rank && !replayMode ? ` · #${rank} on this map` : ''}</p>
      ${medals ? `<p class="medal">+${medals} ★ research medals</p>` : ''}
      <div class="actions" style="justify-content:center;flex-wrap:wrap">
        ${win && !replayMode ? '<button id="endless" class="primary">Keep going (endless)</button>' : ''}
        ${!replayMode ? '<button id="share">Copy replay link</button>' : ''}
        <button id="retry" class="${win ? '' : 'primary'}">${replayMode ? 'Watch again' : 'Play again'}</button>
        <button id="maps">Menu</button>
      </div>
      <p class="d" id="endmsg"></p>
    </div>`;
  const replay: Replay = { v: 1, config: cfg, log: session!.log, result: { wave: s.wave, score, win: finalWin } };
  overlay.querySelector<HTMLButtonElement>('#retry')!.onclick = () => (replayMode ? startGame(cfg, { replay: replayFrom }) : startGame({ ...cfg, seed: cfg.daily ? cfg.seed : Math.floor(Math.random() * 1e9) }));
  overlay.querySelector<HTMLButtonElement>('#maps')!.onclick = () => void showMain();
  const share = overlay.querySelector<HTMLButtonElement>('#share');
  if (share) share.onclick = async () => {
    const url = await replayLink(replay);
    const ok = await copyText(url);
    overlay.querySelector('#endmsg')!.textContent = ok ? `Copied (${Math.round(url.length / 1024)} KB link).` : url;
  };
  const endless = overlay.querySelector<HTMLButtonElement>('#endless');
  if (endless) endless.onclick = () => {
    s.endless = true;
    s.victory = false;
    endlessFrom = s.wave;
    endShown = false;
    hideMenus();
  };
}

let replayFrom: Replay | undefined;

// ---------------------------------------------------------------- camera

/** Zoomed out far enough to see the whole map. */
function minZoom(): number {
  return Math.min(1, Math.min(viewW / projection.width, viewH / projection.height) * 0.95);
}

/** Clamp so the map never leaves the screen, and push the transform to the scene. */
function applyCamera(): void {
  zoom = Math.min(MAX_ZOOM, Math.max(minZoom(), zoom));
  const clampAxis = (c: number, size: number, v: number) => {
    const half = v / 2 / zoom;
    return size <= half * 2 ? size / 2 : Math.min(size - half, Math.max(half, c));
  };
  camX = clampAxis(camX, projection.width, viewW);
  camY = clampAxis(camY, projection.height, viewH);
  const sx = shake > 0.2 ? (Math.random() - 0.5) * shake : 0;
  const sy = shake > 0.2 ? (Math.random() - 0.5) * shake : 0;
  cam.scale.set(zoom);
  cam.position.set(Math.round(viewW / 2 - camX * zoom + sx), Math.round(viewH / 2 - camY * zoom + sy));
  const hw = viewW / 2 / zoom;
  const hh = viewH / 2 / zoom;
  view?.setView(camX - hw, camY - hh, camX + hw, camY + hh);
}

function lookAt(wx: number, wy: number): void {
  camX = projection.x(wx, wy);
  camY = projection.y(wx, wy);
  applyCamera();
}

/** Zoom by `factor`, keeping the point under canvas pixel (px, py) fixed. */
function zoomAt(factor: number, px: number, py: number): void {
  const bx = camX + (px - viewW / 2) / zoom;
  const by = camY + (py - viewH / 2) / zoom;
  zoom = Math.min(MAX_ZOOM, Math.max(minZoom(), zoom * factor));
  camX = bx - (px - viewW / 2) / zoom;
  camY = by - (py - viewH / 2) / zoom;
  applyCamera();
}

function panBy(dx: number, dy: number): void {
  camX -= dx / zoom;
  camY -= dy / zoom;
  applyCamera();
}

/** World quad currently on screen (for the minimap). */
function viewQuad(): [number, number][] {
  const hw = viewW / 2 / zoom;
  const hh = viewH / 2 / zoom;
  return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([dx, dy]) => projection.toWorld(camX + dx, camY + dy));
}

/** Volume and stereo pan for a sound at a world point, from where it is on screen. */
function spatial(x: number, y: number): [number, number] {
  const sx = (projection.x(x, y) - camX) * zoom + viewW / 2;
  const sy = (projection.y(x, y) - camY) * zoom + viewH / 2;
  const ox = Math.max(0, -sx, sx - viewW);
  const oy = Math.max(0, -sy, sy - viewH);
  const off = Math.hypot(ox, oy) / Math.max(viewW, viewH);
  const gain = Math.max(0, 1 - off * 2) * (0.55 + 0.45 * Math.min(1, zoom));
  return [gain, Math.max(-0.8, Math.min(0.8, (sx - viewW / 2) / (viewW / 2) * 0.7))];
}

const previews = new Map<string, HTMLCanvasElement>();

/** Low-res terrain for map pickers; borrows the map size, then restores the current one. */
function preview(def: MapDef, w: number, h: number): HTMLCanvasElement {
  const key = JSON.stringify([def.name, def.seed, def.cols, def.rows, def.routes, def.rocks, def.rockList?.length, def.rivers, def.mountains, def.forests, def.paint?.length]);
  let src = previews.get(key);
  if (src) return src;
  src = drawTerrain(buildMap(def), Math.min(w / (def.cols * TILE), h / (def.rows * TILE)) * 2, true);
  if (session) useMapSize(session.sim.map.def);
  previews.set(key, src);
  return src;
}

// ---------------------------------------------------------------- layout

/** The canvas fills the stage; the camera decides what part of the map it shows. */
function fit(): void {
  const r = stage.getBoundingClientRect();
  viewW = Math.max(200, Math.floor(r.width));
  viewH = Math.max(150, Math.floor(r.height));
  const res = Math.min(2, window.devicePixelRatio || 1);
  if (app.renderer.width !== viewW || app.renderer.height !== viewH || Math.abs(app.renderer.resolution - res) > 0.01) {
    app.renderer.resize(viewW, viewH, res);
  }
  applyCamera();
}

// ---------------------------------------------------------------- input

function pointerToCanvas(e: { clientX: number; clientY: number }): [number, number] {
  const rect = app.canvas.getBoundingClientRect();
  return [e.clientX - rect.left, e.clientY - rect.top];
}

/** Canvas pixel -> projected screen space (before the camera). */
function canvasToScreen(px: number, py: number): [number, number] {
  return [camX + (px - viewW / 2) / zoom, camY + (py - viewH / 2) / zoom];
}

function updateHover(e: { clientX: number; clientY: number }): void {
  const [x, y] = projection.toWorld(...canvasToScreen(...pointerToCanvas(e)));
  aimX = x;
  aimY = y;
  cellCol = Math.floor(x / TILE);
  cellRow = Math.floor(y / TILE);
  // footprint centred on the cursor
  const size = placing >= 0 ? TOWERS[placing].size : 2;
  hoverCol = size === 1 ? cellCol : Math.round(x / TILE - size / 2);
  hoverRow = size === 1 ? cellRow : Math.round(y / TILE - size / 2);
}

/** A click on the battlefield (mouse release or touch tap) that wasn't a drag. */
/** The tower under the pointer: towers stand up off the ground, so try their deck, then the ground. */
function towerUnder(e: { clientX: number; clientY: number }): Tower | null {
  const s = sim();
  if (!s) return null;
  const [sx, sy] = canvasToScreen(...pointerToCanvas(e));
  const [dx, dy] = projection.toWorld(sx, sy + 12 * projection.lift);
  const [gx, gy] = projection.toWorld(sx, sy);
  return s.towerAtTile(Math.floor(dx / TILE), Math.floor(dy / TILE)) ?? s.towerAtTile(Math.floor(gx / TILE), Math.floor(gy / TILE));
}

/** Clicking an existing tower while a build tool is active selects it instead (and drops the tool). */
function selectInstead(e: { clientX: number; clientY: number }): boolean {
  const t = towerUnder(e);
  if (!t) return false;
  placing = -1;
  clearSelection();
  selected = t;
  return true;
}

function clickAt(e: { clientX: number; clientY: number }): void {
  const s = sim();
  if (!s) return;
  updateHover(e);
  if (targeting) return fireTargeting(aimX, aimY);
  if (placing >= 0) {
    if (!selectInstead(e)) issue({ t: 'place', type: placing, col: hoverCol, row: hoverRow });
    return;
  }
  // the commander first, then towers
  const [sx, sy] = canvasToScreen(...pointerToCanvas(e));
  if (s.hero) {
    const hx = projection.x(s.hero.x, s.hero.y);
    const hy = projection.y(s.hero.x, s.hero.y) - 8 * projection.lift;
    if (Math.hypot(hx - sx, hy - sy) < 14) return selectHero();
  }
  const mine = unitUnder(e);
  if (mine >= 0) {
    const id = s.uUid[mine];
    const add = (e as { shiftKey?: boolean }).shiftKey && unitSel.length > 0;
    const keep = add ? unitSel.filter((x) => x !== id) : [];
    clearSelection();
    unitSel = add && keep.length < unitSel.length ? keep : [...keep, id];
    return;
  }
  if (unitSel.length && session!.mode !== 'replay' && !towerUnder(e)) {
    // an order: the selected units walk there (onto an enemy: they go after it)
    issue({ t: 'unitMove', ids: unitSel, x: aimX, y: aimY });
    return;
  }
  const foe = enemyUnder(e);
  if (foe >= 0) {
    clearSelection();
    enemySel = { slot: foe, uid: s.eUid[foe] };
    return;
  }
  const t = towerUnder(e);
  if (heroSelected && !t && session!.mode !== 'replay') {
    issue({ t: 'heroMove', x: aimX, y: aimY });
    return;
  }
  clearSelection();
  selected = t;
}

// a press becomes a pan once it moves this far; right-click without a drag still cancels
const DRAG_PX = 6;
let drag: { button: number; x: number; y: number; panning: boolean; box: boolean; touch: boolean; painted: boolean } | null = null;
const touches = new Map<number, [number, number]>();
let pinch: { d: number; mx: number; my: number } | null = null;

function boxSelect(x0: number, y0: number, x1: number, y1: number): void {
  const s = sim();
  if (!s) return;
  const [ax, ay] = canvasToScreen(Math.min(x0, x1), Math.min(y0, y1));
  const [bx, by] = canvasToScreen(Math.max(x0, x1), Math.max(y0, y1));
  // units in the box take precedence over towers
  const units: number[] = [];
  for (let u = 0; u < MAX_UNITS; u++) {
    if (!s.uAlive[u]) continue;
    const px = projection.x(s.uX[u], s.uY[u]);
    const py = projection.y(s.uX[u], s.uY[u]);
    if (px >= ax && px <= bx && py >= ay && py <= by) units.push(s.uUid[u]);
  }
  if (units.length) {
    clearSelection();
    unitSel = units;
    return;
  }
  multi = s.towers.filter((t) => {
    const px = projection.x(t.x, t.y);
    const py = projection.y(t.x, t.y);
    return px >= ax && px <= bx && py >= ay && py <= by;
  });
  selected = null;
  heroSelected = false;
  if (multi.length === 1) {
    selected = multi[0];
    multi = [];
  }
}

function bindInput(): void {
  const c = app.canvas;
  c.addEventListener('pointerdown', (e) => {
    if (!session) return;
    const [px, py] = pointerToCanvas(e);
    const touch = e.pointerType === 'touch';
    if (touch) {
      touches.set(e.pointerId, [px, py]);
      if (touches.size === 2) {
        // second finger: pinch/pan, and whatever the first finger started is cancelled
        const [[ax, ay], [bx, by]] = [...touches.values()];
        pinch = { d: Math.hypot(bx - ax, by - ay), mx: (ax + bx) / 2, my: (ay + by) / 2 };
        drag = null;
        return;
      }
    }
    c.setPointerCapture(e.pointerId);
    drag = { button: e.button, x: px, y: py, panning: false, box: e.shiftKey && e.button === 0 && placing < 0, touch, painted: false };
    if (e.button === 1) e.preventDefault(); // no autoscroll
    updateHover(e);
    if (e.button === 0 && !touch && placing >= 0 && !targeting && session.mode !== 'replay') {
      // pressing on an existing tower selects it; otherwise build, and dragging paints a line
      // (the tower type stays selected so walls can be laid quickly)
      if (!selectInstead(e)) issue({ t: 'place', type: placing, col: hoverCol, row: hoverRow });
      drag.painted = true;
    }
  });
  c.addEventListener('pointermove', (e) => {
    const [px, py] = pointerToCanvas(e);
    if (e.pointerType === 'touch' && touches.has(e.pointerId)) {
      touches.set(e.pointerId, [px, py]);
      if (pinch && touches.size >= 2) {
        const [[ax, ay], [bx, by]] = [...touches.values()];
        const d = Math.hypot(bx - ax, by - ay);
        const mx = (ax + bx) / 2;
        const my = (ay + by) / 2;
        panBy(mx - pinch.mx, my - pinch.my);
        zoomAt(d / (pinch.d || d), mx, my);
        pinch = { d, mx, my };
        return;
      }
    }
    const [pc, pr] = [hoverCol, hoverRow];
    updateHover(e);
    if (!drag) return;
    const moved = Math.hypot(px - drag.x, py - drag.y) > DRAG_PX;
    if (drag.box) {
      if (moved) view?.setBox([...canvasToScreen(drag.x, drag.y), ...canvasToScreen(px, py)] as [number, number, number, number]);
      return;
    }
    const painting = drag.button === 0 && placing >= 0 && !targeting;
    if (painting) {
      if ((moved || drag.painted) && (pc !== hoverCol || pr !== hoverRow || !drag.painted) && session?.mode !== 'replay') {
        issue({ t: 'place', type: placing, col: hoverCol, row: hoverRow });
        drag.painted = true;
      }
      return;
    }
    if (drag.panning || moved) {
      drag.panning = true;
      panBy(px - drag.x, py - drag.y);
      drag.x = px;
      drag.y = py;
    }
  });
  const up = (e: PointerEvent) => {
    touches.delete(e.pointerId);
    if (touches.size < 2) pinch = null;
    if (!drag || (e.button !== drag.button && !drag.touch)) return;
    const d = drag;
    drag = null;
    if (!session) return;
    const [px, py] = pointerToCanvas(e);
    if (d.box) {
      view?.setBox(null);
      if (Math.hypot(px - d.x, py - d.y) > DRAG_PX) boxSelect(d.x, d.y, px, py);
      else clickAt(e);
      return;
    }
    if (d.panning || d.painted) return;
    if (d.button === 2) {
      placing = -1;
      clearSelection();
    } else if (d.button === 0) clickAt(e);
  };
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', (e) => {
    touches.delete(e.pointerId);
    pinch = null;
    drag = null;
  });
  c.addEventListener('wheel', (e) => {
    e.preventDefault();
    const [px, py] = pointerToCanvas(e);
    // trackpad pinch arrives as ctrl+wheel with small deltas
    const k = e.ctrlKey ? 0.01 : 0.0015;
    zoomAt(Math.exp(-e.deltaY * k), px, py);
  }, { passive: false });
  c.addEventListener('pointerleave', () => {
    hoverCol = hoverRow = -9;
    cellCol = cellRow = -1;
  });
  c.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('keyup', (e) => keysHeld.delete(e.key));
  window.addEventListener('blur', () => keysHeld.clear());

  window.addEventListener('keydown', (e) => {
    const s = sim();
    if (!s || !overlay.classList.contains('hidden')) return;
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') {
      e.preventDefault();
      issue({ t: 'undo' });
      return;
    }
    if (k === 'tab') {
      e.preventDefault();
      keysHeld.add('Tab');
      return;
    }
    if (k === 'q' || k === 'e') return stepTower(k === 'e' ? 1 : -1);
    if (k >= '0' && k <= '9') return pick(k === '0' ? 9 : Number(k) - 1);
    if (k === 'g') return toggleGate();
    if (k === 'k') return updateSettings({ muted: !settings.muted });
    if (k === ',' || k === '.') return k === '.' ? sound.nextTrack() : sound.prevTrack();
    if (k === 'b' && WW2) return repairSelected();
    if (k === 'd' && WW2 && unitSel.length) return void issue({ t: 'unitDig', ids: unitSel });
    if (k === 'm' && WW2 && unitSel.length) return startMines();
    if (k === 'r') return startSuper();
    if (k === 'h') return selectHero();
    if (k === 'z') return startItem(0);
    if (k === 'x') return startItem(1);
    if (k === 'c') return startItem(2);
    if (k === '[') return startAbility(0);
    if (k === ']') return startAbility(1);
    if (k === '\\') return startAbility(2);
    if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      keysHeld.add(e.key);
      return;
    }
    if (k === '=' || k === '+') zoomAt(1.25, viewW / 2, viewH / 2);
    else if (k === '-') zoomAt(0.8, viewW / 2, viewH / 2);
    else if (k === 'home') {
      zoom = minZoom();
      lookAt(MAP_W / 2, MAP_H / 2);
    } else if (k === 'escape') {
      placing = -1;
      clearSelection();
    } else if (k === 'u') {
      if (multi.length) upgradeCheapestFirst(multi);
      else if (selected) issue({ t: 'upgrade', ids: [selected.id] });
    } else if (k === 's') {
      if (multi.length) issue({ t: 'sell', ids: multi.map((t) => t.id) });
      else sellSelected();
      multi = [];
    } else if (k === 't' && selected && TOWERS[selected.type].targeted) issue({ t: 'mode', id: selected.id, mode: (selected.mode + 1) % 4 });
    else if (k === 'n') issue({ t: 'wave' });
    else if (k === ' ') {
      e.preventDefault();
      setSpeed(session!.speed === 0 ? lastSpeed : 0);
    } else if (k === 'f') setSpeed(session!.speed === 0 ? 1 : session!.speed === 4 ? 1 : session!.speed * 2);
    else if (k === 'v') toggleCamera();
  });
}

// ---------------------------------------------------------------- events: sound and screen effects

const SHOT_SOUND: Record<string, string> = {
  nuke: 'nukeLaunch', mine: '',
};
const STATUS_SOUND = ['freeze', 'hack', 'shatter', 'stun', 'swallow', 'ricochet', 'stun', 'boom', '', '', ''];
/** WW2: the attackers' weapons, by ENEMY_FX index. */
const ENEMY_SOUND = ['mosin', 'ppsh', 'dt', 'f34', 'rs82', 'katyusha', '', '', 'stuka'];

function handleEvents(s: Sim): void {
  const ev = s.events;
  for (let k = 0; k < ev.length; k += EV_SIZE) {
    const type = ev[k];
    const x = ev[k + 1];
    const y = ev[k + 2];
    const a = ev[k + 3];
    switch (type) {
      case EV_SHOT: {
        const def = TOWERS[a];
        const name = def.sfx ?? SHOT_SOUND[def.kind] ?? def.kind;
        if (name) sound.play(name, x, y);
        break;
      }
      case EV_BOOM: {
        sound.play(a > 2.5 ? 'bigboom' : 'boom', x, y, a);
        if (settings.shake && a >= 1.4) {
          const [g] = spatial(x, y);
          shake = Math.min(18, shake + a * 1.6 * g);
        }
        break;
      }
      case EV_LEAK:
        sound.play('leak');
        break;
      case EV_BUILD:
        sound.play('build', x, y);
        break;
      case EV_SELL:
        sound.play('sell', x, y);
        break;
      case EV_UPGRADE:
        sound.play('upgrade', x, y);
        break;
      case EV_WAVE:
        sound.play('wave');
        void saveGame();
        break;
      case EV_STATUS:
        if (STATUS_SOUND[a]) sound.play(STATUS_SOUND[a], x, y);
        break;
      case EV_HIT:
        if (ev[k + 4]) sound.play('shatter', x, y);
        break;
      case EV_NUKE:
        sound.play('nuke');
        if (settings.shake) shake = 24;
        slowmo = 0.8;
        break;
      case EV_LEVEL:
        sound.play('level');
        break;
      case EV_ITEM:
        sound.play(a === 2 ? 'coin' : 'item');
        break;
      case EV_ABILITY:
        sound.play((WW2 ? ['arty', 'rally', 'recon'] : ['airstrike', 'rally', 'stun'])[a]);
        break;
      case EV_DENY:
        sound.play('deny');
        break;
      case EV_ESHOT:
        if (a === 7) {
          // artillery preparation: the guns behind the enemy lines open up
          sound.play('arty');
          flash('Artillery barrage on your known positions!');
        } else if (ENEMY_SOUND[a]) sound.play(ENEMY_SOUND[a], x, y);
        break;
      case EV_USHOT: {
        const sfx = UNITS[a]?.gun?.sfx;
        if (sfx) sound.play(sfx, x, y);
        break;
      }
      case EV_WRECK:
        sound.play('wreck', x, y);
        if (settings.shake) {
          const [g] = spatial(x, y);
          shake = Math.min(18, shake + 6 * g);
        }
        break;
      case EV_DOWN:
        sound.play('deny');
        flash('The commander is wounded: back in 20 s');
        break;
    }
  }
  view?.consumeEvents(ev);
  ev.length = 0;
}

// ---------------------------------------------------------------- loop

function banner(): string {
  if (!session) return '';
  if (session.mode === 'replay') {
    return `<b>REPLAY</b> · wave ${session.sim.wave} · <button data-act="skip">Skip to next wave</button>`;
  }
  if (session.mode === 'coop') {
    if (session.desync) return '<b class="bad">Out of sync with your partner</b> — the games have diverged; restart to play together again.';
    if (session.stalled) return '<b>CO-OP</b> · waiting for your partner…';
    return '<b>CO-OP</b> · shared bank, both players build';
  }
  if (session.partner) {
    const s = session.sim;
    let mine = 0;
    let n = 0;
    for (const t of s.towers) if (t.owner === PARTNER) (mine += t.spent), n++;
    return `<b>CO-OP WITH AI</b> · partner: ${n} tower${n === 1 ? '' : 's'}, $${mine} invested, $${Math.max(0, Math.floor(session.partner.budget(s)))} to spend`;
  }
  return '';
}

function frame(): void {
  const t0 = performance.now();
  const realDt = Math.min(0.1, app.ticker.deltaMS / 1000);
  if (keysHeld.size) {
    const d = PAN_SPEED * realDt;
    panBy((keysHeld.has('ArrowLeft') ? d : 0) - (keysHeld.has('ArrowRight') ? d : 0),
      (keysHeld.has('ArrowUp') ? d : 0) - (keysHeld.has('ArrowDown') ? d : 0));
  }
  if (shake > 0) {
    shake = Math.max(0, shake - realDt * 40);
    applyCamera();
  }
  if (session && view) {
    const s = session.sim;
    if (slowmo > 0) slowmo -= realDt;
    session.timeScale = slowmo > 0 ? 0.3 : 1;
    session.advance(realDt);
    const t1 = performance.now();
    simTimeAcc += t1 - t0;
    handleResults();
    handleEvents(s);

    // the field just emptied: report on the wave(s) since the last report
    const clear = s.fieldClear;
    if (clear && !wasClear && s.wave > 0 && session.mode !== 'replay') {
      const r = s.takeReport();
      hud.showReport(s, s.wave, r.damage, r.leaked);
    }
    wasClear = clear;

    if (selected && !s.towers.includes(selected)) selected = null;
    if (multi.length) multi = multi.filter((t) => s.towers.includes(t));
    if (targeting?.kind === 'super' && !s.tower(targeting.index)) targeting = null;
    if (enemySel && (!s.eAlive[enemySel.slot] || s.eUid[enemySel.slot] !== enemySel.uid)) enemySel = null;
    const enemy = enemySel ? enemySel.slot : -1;
    const units = unitSlots(s);
    if (units.length < unitSel.length) unitSel = units.map((u) => s.uUid[u]);
    view.tick(realDt);
    view.render(session.speed > 0 ? session.acc / (1 / 60) : 1, {
      hoverCol, hoverRow, cellCol, cellRow, placing, selected, aiming: null, aimX, aimY,
      targeting: targeting ? { r: targeting.r, color: targeting.color } : null,
      heroSelected, multi, box: view.box, showAuras: keysHeld.has('Tab'), enemy, units,
    });
    hud.update(s, {
      placing, selected, multi, heroSelected, speed: session.speed, mode: session.mode, banner: banner(), enemy, units,
      ground: cellCol >= 0 && cellRow >= 0 && cellCol < COLS && cellRow < ROWS ? s.map.grid[cellRow * COLS + cellCol] : -1,
      aiming: targeting && targeting.kind !== 'mines' ? { kind: targeting.kind, index: targeting.index } : null,
    });
    minimap?.update(viewQuad());
    renderTimeAcc += performance.now() - t1;
    // never below a marching pulse: between waves the drums keep the war going
    sound.intensity = Math.min(1, s.spawning ? 0.55 + s.liveCount / 150 : 0.32 + s.liveCount / 60);

    if (!endShown && session.finished) void showEnd(s.victory);
  }

  frames++;
  perfT += app.ticker.deltaMS;
  const s = sim();
  if (perfT >= 500 && s && view) {
    const fps = (frames * 1000) / perfT;
    hud.perfLine(
      `FPS <b>${fps.toFixed(0)}</b> · sim <b>${(simTimeAcc / frames).toFixed(2)}ms</b> · ` +
      `cpu render <b>${(renderTimeAcc / frames).toFixed(2)}ms</b> · ` +
      `enemies <b>${s.liveCount}</b> · projectiles <b>${s.pCount}</b> · fx <b>${s.fCount}</b> · ` +
      `towers <b>${s.towers.length}</b> · sprites <b>${view.drawnParticles}</b> · ${app.renderer.name}`,
    );
    frames = 0;
    simTimeAcc = renderTimeAcc = perfT = 0;
  }
}

// ---------------------------------------------------------------- boot

function editor(def?: MapDef): void {
  if (session && session.mode !== 'coop') session.speed = 0;
  overlay.classList.remove('hidden');
  openEditor(overlay, def ?? blankMap(), {
    play: (d) => showSetup(d),
    save: (d) => saveCustomMap(d),
    share: async (d) => {
      const ok = await copyText(await mapLink(d));
      flash(ok ? 'Map link copied' : 'Could not copy the link');
    },
    back: () => void showMain(),
  });
}

/** Acts on a #replay= / #map= / #rmap= link. Returns false when the URL carries none. */
async function openFromHash(): Promise<boolean> {
  const hash = await readHash();
  if (!hash) return false;
  history.replaceState(null, '', location.pathname + location.search);
  if (hash.replay) {
    replayFrom = hash.replay;
    startGame(hash.replay.config, { replay: hash.replay });
  } else if (hash.map) {
    saveCustomMap(hash.map);
    showSetup(hash.map);
  } else if (hash.rmap && parseMapCode(hash.rmap)) {
    showRandom(hash.rmap);
  } else return false;
  return true;
}

async function boot(): Promise<void> {
  app = new Application();
  await app.init({
    width: viewW,
    height: viewH,
    background: '#0c0e09',
    antialias: true,
    preference: 'webgl',
    resolution: window.devicePixelRatio || 1,
    powerPreference: 'high-performance',
  });
  stage.appendChild(app.canvas);
  app.stage.addChild(cam);
  atlas = await buildAtlas();
  hud.setIcons((type) => towerIcon(type));
  fit();
  new ResizeObserver(fit).observe(stage);
  bindInput();
  sound.spatial = spatial;
  onSettings(() => {
    if (session) session.sim.fxScale = QUALITY[settings.quality];
  });
  initMenus({
    start: (cfg, l) => startGame(cfg, { link: l }),
    resumeCurrent: () => resume(),
    currentActive: () => !!session && !session.finished,
    hasSave: async () => !!(await idbGet<SaveData>('save')),
    continueSave: async () => {
      const save = await idbGet<SaveData>('save');
      if (save) startGame(save.config, { restore: save.snapshot, log: save.log });
    },
    watch: (r) => {
      replayFrom = r;
      startGame(r.config, { replay: r });
    },
    editor,
    preview,
    click: () => sound.play('click'),
  });
  app.ticker.maxFPS = 0;
  app.ticker.add(frame);
  // save on the way out (tab closed, switched away, app backgrounded)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void saveGame();
  });
  // expose for debugging/benchmarks in the console
  (window as unknown as { game: unknown }).game = {
    get sim() { return sim(); },
    get session() { return session; },
    app,
    get camera() { return { x: camX, y: camY, zoom }; },
    look(wx: number, wy: number, z = zoom) {
      zoom = z;
      lookAt(wx, wy);
    },
    start: (cfg: GameConfig) => startGame(cfg),
    /** Selects a tower (or nothing), as a click on it would. */
    select(t: Tower | null) {
      selected = t;
      multi = [];
      unitSel = [];
      heroSelected = false;
      placing = -1;
    },
    /** Selects defender units by slot. */
    selectUnits(slots: number[]) {
      selected = null;
      unitSel = slots;
    },
    Session,
    Sim: SimClass,
    /** Tower type and unit kind by name, for scripted checks. */
    towerIndex: (kind: string) => TOWERS.findIndex((t) => t.kind === kind),
    towerDef: (type: number) => TOWERS[type],
    get COLS() {
      return COLS;
    },
    BATTLES,
    enemyDef: (kind: number) => ENEMIES[kind],
    MAPS,
    unitIndex: (kind: string) => UNITS.findIndex((u) => u.kind === kind),
    quick: (map = 0, difficulty: GameConfig['difficulty'] = 'normal', ww2 = false) =>
      startGame({ map: MAPS[map], difficulty, modifiers: [], perks: {}, seed: 1234, ww2: ww2 ? { side: 'de', foe: 'su' } : undefined }),
  };
  hud.camera(projection.mode);

  // opened from a shared link (now, or later by following another one)?
  if (!(await openFromHash())) void showMain();
  window.addEventListener('hashchange', () => void openFromHash());

  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // offline play just won't be available
    });
  }
}

boot();
