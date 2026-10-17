import { Application, Container, type Texture } from 'pixi.js';
import { CATEGORIES, DT, MAP_H, MAP_W, TILE, TOTAL_WAVES, TOWERS } from './game/defs';
import { MAPS, buildMap, useMapSize } from './game/maps';
import { Sim, type Tower } from './game/sim';
import { buildAtlas, buildBackground, drawTerrain, type Atlas } from './render/atlas';
import { makeProjection, type CameraMode, type Projection } from './render/projection';
import { GameRenderer } from './render/renderer';
import { Hud } from './ui/hud';
import { Minimap } from './ui/minimap';

const MAX_STEPS_PER_FRAME = 16;

let app: Application;
let atlas: Atlas;
let sim: Sim | null = null;
let view: GameRenderer | null = null;
let background: Texture | null = null;
let cameraMode: CameraMode = loadCamera();
let projection: Projection = makeProjection(cameraMode);
let mapIndex = 0;

// camera: the projected-screen point at the middle of the canvas, and pixels per projected unit
const cam = new Container();
let camX = 0;
let camY = 0;
let zoom = 1;
let viewW = 960; // canvas size in CSS pixels
let viewH = 640;
const MAX_ZOOM = 3;
const PAN_SPEED = 900; // CSS px per second for the arrow keys
const keysHeld = new Set<string>();
let minimap: Minimap | null = null;

let speed = 1;
let lastSpeed = 1;
let acc = 0;
let placing = -1;
let selected: Tower | null = null;
let aiming: Tower | null = null; // superweapon waiting for its target click
let aimX = 0;
let aimY = 0;
let hoverCol = -9;
let hoverRow = -9;
let cellCol = -1;
let cellRow = -1;
let endShown = false;

// perf counters
let frames = 0;
let frameTimeAcc = 0;
let simTimeAcc = 0;
let renderTimeAcc = 0;
let perfT = 0;

const overlay = document.getElementById('overlay')!;
const stage = document.getElementById('stage')!;

const hud = new Hud({
  pick: (t) => pick(t),
  upgrade: () => selected && sim?.upgrade(selected),
  sell: () => sellSelected(),
  mode: (m) => selected && (selected.mode = m),
  gate: () => toggleGate(),
  fire: () => startAiming(),
  next: () => sim?.startNextWave(),
  speed: (s) => setSpeed(s),
  menu: () => showMenu(),
  camera: () => toggleCamera(),
  stress: () => {
    if (!sim) return;
    sim.stress(3000);
    if (speed === 0) setSpeed(1);
  },
});

function pick(t: number): void {
  selected = null;
  aiming = null;
  placing = placing === t ? -1 : t;
  if (placing >= 0) hud.showCategory(CATEGORY_IDS.indexOf(TOWERS[placing].cat));
}

const CATEGORY_IDS = CATEGORIES.map((c) => c.id);

function toggleGate(): void {
  if (!sim || !selected || selected.kind !== 'gate') return;
  const r = sim.toggleGate(selected);
  if (r !== 'ok') flash(r === 'occupied' ? 'Units are standing in the gate' : 'Closing it would seal the route');
}

function startAiming(): void {
  if (!sim || !selected || !TOWERS[selected.type].manual) return;
  if (sim.chargeLevel(selected) < 1) return flash('Still charging');
  aiming = selected;
  placing = -1;
}

let flashTimer = 0;
/** A short message over the battlefield. */
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
  flashTimer = window.setTimeout(() => el!.classList.remove('show'), 1600);
}

function sellSelected(): void {
  if (!sim || !selected) return;
  sim.sell(selected);
  selected = null;
}

function setSpeed(s: number): void {
  if (s > 0) lastSpeed = s;
  speed = s;
}

function startGame(i: number): void {
  mapIndex = i;
  const map = buildMap(MAPS[i]);
  sim = new Sim(map);
  background?.destroy(true);
  background = buildBackground(map);
  projection = makeProjection(cameraMode);
  buildView();
  minimap?.destroy();
  minimap = new Minimap(stage, map, sim, (wx, wy) => lookAt(wx, wy));
  // open on the first entry, zoomed so the gates read clearly
  zoom = Math.max(minZoom(), 1);
  const [ax, ay] = map.routes[0].airFrom;
  lookAt(Math.min(MAP_W, Math.max(0, ax)), Math.min(MAP_H, Math.max(0, ay)));
  placing = -1;
  selected = null;
  aiming = null;
  acc = 0;
  endShown = false;
  setSpeed(1);
  overlay.classList.add('hidden');
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
  if (!sim || !background) return;
  view = new GameRenderer(sim, atlas, background, projection);
  cam.addChild(view.root);
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

// ---------------------------------------------------------------- camera

/** Zoomed out far enough to see the whole map. */
function minZoom(): number {
  return Math.min(1, Math.min(viewW / projection.width, viewH / projection.height) * 0.95);
}

/** Clamp so the map never leaves the screen, and push the transform to the scene. */
function applyCamera(): void {
  zoom = Math.min(MAX_ZOOM, Math.max(minZoom(), zoom));
  const clampAxis = (c: number, size: number, view: number) => {
    const half = view / 2 / zoom;
    return size <= half * 2 ? size / 2 : Math.min(size - half, Math.max(half, c));
  };
  camX = clampAxis(camX, projection.width, viewW);
  camY = clampAxis(camY, projection.height, viewH);
  cam.scale.set(zoom);
  cam.position.set(Math.round(viewW / 2 - camX * zoom), Math.round(viewH / 2 - camY * zoom));
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

const previews = new Map<number, HTMLCanvasElement>();

/** Low-res terrain for the map picker; borrows the map size, then restores the current one. */
function preview(i: number, w: number, h: number): HTMLCanvasElement {
  let src = previews.get(i);
  if (src) return src;
  const def = MAPS[i];
  src = drawTerrain(buildMap(def), Math.min(w / (def.cols * TILE), h / (def.rows * TILE)) * 2, true);
  if (sim) useMapSize(sim.map.def);
  previews.set(i, src);
  return src;
}

function showMenu(): void {
  setSpeed(0);
  overlay.classList.remove('hidden');
  overlay.innerHTML = `
    <div class="card">
      <h1>WARZONE <span>TD</span></h1>
      <p>Hold the line for ${TOTAL_WAVES} waves. There is no road: your towers are the walls. Build a maze that makes ground units walk past as many guns as possible — but you can never fully block them. Air units fly straight over.</p>
      <div class="maps">${MAPS.map((m, i) => `<button data-map="${i}"><canvas width="240" height="160"></canvas><b>${m.name}</b><span class="size">${m.cols}×${m.rows} · ${m.routes.length} route${m.routes.length > 1 ? 's' : ''}</span><span class="d">${m.desc}</span></button>`).join('')}</div>
      ${sim && !sim.gameOver && !sim.victory ? '<div class="actions"><button id="resume">Resume current game</button></div>' : ''}
    </div>`;
  overlay.querySelectorAll<HTMLButtonElement>('[data-map]').forEach((b) => {
    const i = Number(b.dataset.map);
    const c = b.querySelector('canvas')!;
    const src = preview(i, c.width, c.height);
    // letterbox: maps have different shapes
    const k = Math.min(c.width / src.width, c.height / src.height);
    const g = c.getContext('2d')!;
    g.fillStyle = '#0c0e09';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(src, (c.width - src.width * k) / 2, (c.height - src.height * k) / 2, src.width * k, src.height * k);
    b.onclick = () => startGame(i);
  });
  const resume = overlay.querySelector<HTMLButtonElement>('#resume');
  if (resume) resume.onclick = () => {
    overlay.classList.add('hidden');
    setSpeed(lastSpeed);
  };
}

function showEnd(win: boolean): void {
  endShown = true;
  overlay.classList.remove('hidden');
  overlay.innerHTML = `
    <div class="card" style="max-width:420px;text-align:center">
      <h1>${win ? 'VICTORY' : 'DEFEAT'}</h1>
      <p>${win ? `All ${TOTAL_WAVES} waves repelled` : `Overrun on wave ${sim!.wave}`} · ${sim!.totalKills} kills</p>
      <div class="actions" style="justify-content:center">
        ${win ? '<button id="endless" class="primary">Keep going (endless)</button>' : ''}
        <button id="retry" class="${win ? '' : 'primary'}">Play again</button>
        <button id="maps">Maps</button>
      </div>
    </div>`;
  overlay.querySelector<HTMLButtonElement>('#retry')!.onclick = () => startGame(mapIndex);
  overlay.querySelector<HTMLButtonElement>('#maps')!.onclick = () => showMenu();
  const endless = overlay.querySelector<HTMLButtonElement>('#endless');
  if (endless) endless.onclick = () => {
    sim!.endless = true;
    sim!.victory = false;
    endShown = false;
    overlay.classList.add('hidden');
  };
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

function pointerToCanvas(e: PointerEvent | WheelEvent): [number, number] {
  const rect = app.canvas.getBoundingClientRect();
  return [e.clientX - rect.left, e.clientY - rect.top];
}

/** Pointer -> projected screen space (before the camera). */
function pointerToScreen(e: PointerEvent): [number, number] {
  const [px, py] = pointerToCanvas(e);
  return [camX + (px - viewW / 2) / zoom, camY + (py - viewH / 2) / zoom];
}

function pointerToMap(e: PointerEvent): [number, number] {
  return projection.toWorld(...pointerToScreen(e));
}

function updateHover(e: PointerEvent): void {
  const [x, y] = pointerToMap(e);
  aimX = x;
  aimY = y;
  cellCol = Math.floor(x / TILE);
  cellRow = Math.floor(y / TILE);
  // footprint centred on the cursor
  const size = placing >= 0 ? TOWERS[placing].size : 2;
  hoverCol = size === 1 ? cellCol : Math.round(x / TILE - size / 2);
  hoverRow = size === 1 ? cellRow : Math.round(y / TILE - size / 2);
}

// a press becomes a pan once it moves this far; right-click without a drag still cancels
const DRAG_PX = 5;
let drag: { button: number; x: number; y: number; panning: boolean } | null = null;

function bindInput(): void {
  const c = app.canvas;
  c.addEventListener('pointermove', (e) => {
    if (drag) {
      const [px, py] = pointerToCanvas(e);
      // left button pans only when not building (left-drag paints walls)
      const canPan = drag.button !== 0 || placing < 0;
      if (canPan && (drag.panning || Math.hypot(px - drag.x, py - drag.y) > DRAG_PX)) {
        drag.panning = true;
        panBy(px - drag.x, py - drag.y);
        drag.x = px;
        drag.y = py;
      }
    }
    const [pc, pr] = [hoverCol, hoverRow];
    updateHover(e);
    if (sim && placing >= 0 && e.buttons & 1 && (pc !== hoverCol || pr !== hoverRow)) sim.place(placing, hoverCol, hoverRow);
  });
  c.addEventListener('wheel', (e) => {
    e.preventDefault();
    const [px, py] = pointerToCanvas(e);
    // trackpad pinch arrives as ctrl+wheel with small deltas
    const k = e.ctrlKey ? 0.01 : 0.0015;
    zoomAt(Math.exp(-e.deltaY * k), px, py);
  }, { passive: false });
  window.addEventListener('pointerup', (e) => {
    if (!drag || e.button !== drag.button) return;
    const { button, panning } = drag;
    drag = null;
    if (!sim || panning) return;
    if (button === 2) {
      placing = -1;
      selected = null;
      aiming = null;
    } else if (button === 0 && aiming) {
      updateHover(e);
      if (sim.fireSuper(aiming, aimX, aimY)) aiming = null;
    } else if (button === 0 && placing < 0) {
      // towers stand up off the ground: try the point on their deck first, then the ground
      updateHover(e);
      const [sx, sy] = pointerToScreen(e);
      const [dx, dy] = projection.toWorld(sx, sy + 12 * projection.lift);
      selected = sim.towerAtTile(Math.floor(dx / TILE), Math.floor(dy / TILE)) ?? sim.towerAtTile(cellCol, cellRow);
    }
  });
  c.addEventListener('pointerleave', () => {
    hoverCol = hoverRow = -9;
    cellCol = cellRow = -1;
  });
  c.addEventListener('contextmenu', (e) => e.preventDefault());
  c.addEventListener('pointerdown', (e) => {
    if (!sim) return;
    const [px, py] = pointerToCanvas(e);
    drag = { button: e.button, x: px, y: py, panning: false };
    if (e.button === 1) e.preventDefault(); // no autoscroll
    if (e.button === 0 && placing >= 0) {
      // the tower stays selected so walls can be laid quickly; drag to paint a line
      updateHover(e);
      sim.place(placing, hoverCol, hoverRow);
    }
  });
  window.addEventListener('keyup', (e) => keysHeld.delete(e.key));
  window.addEventListener('blur', () => keysHeld.clear());

  window.addEventListener('keydown', (e) => {
    if (!sim || !overlay.classList.contains('hidden')) return;
    const k = e.key.toLowerCase();
    if (k === 'q' || k === 'e') {
      hud.showCategory(hud.cat + (k === 'e' ? 1 : -1));
      return;
    }
    if (k >= '1' && k <= '9') {
      const type = hud.typeAt(Number(k) - 1);
      if (type >= 0) pick(type);
      return;
    }
    if (k === 'g') return toggleGate();
    if (k === 'r') return startAiming();
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
      selected = null;
      aiming = null;
    } else if (k === 'u' && selected) sim.upgrade(selected);
    else if (k === 's' && selected) sellSelected();
    else if (k === 't' && selected && TOWERS[selected.type].targeted) selected.mode = (selected.mode + 1) % 4;
    else if (k === 'n') sim.startNextWave();
    else if (k === ' ') {
      e.preventDefault();
      setSpeed(speed === 0 ? lastSpeed : 0);
    } else if (k === 'f') setSpeed(speed === 0 ? 1 : speed === 4 ? 1 : speed * 2);
    else if (k === 'v') toggleCamera();
  });
}

// ---------------------------------------------------------------- loop

function frame(): void {
  const t0 = performance.now();
  const dt = Math.min(0.1, app.ticker.deltaMS / 1000);
  if (keysHeld.size) {
    const d = PAN_SPEED * dt;
    panBy((keysHeld.has('ArrowLeft') ? d : 0) - (keysHeld.has('ArrowRight') ? d : 0),
      (keysHeld.has('ArrowUp') ? d : 0) - (keysHeld.has('ArrowDown') ? d : 0));
  }
  if (sim && view) {
    if (speed > 0 && !sim.gameOver && !(sim.victory && !sim.endless)) {
      acc += dt * speed;
      let steps = 0;
      while (acc >= DT && steps < MAX_STEPS_PER_FRAME) {
        sim.step();
        acc -= DT;
        steps++;
      }
      if (steps === MAX_STEPS_PER_FRAME) acc = 0; // can't keep up: drop time rather than spiral
    }
    const t1 = performance.now();
    simTimeAcc += t1 - t0;

    if (selected && !sim.towers.includes(selected)) selected = null;
    if (aiming && !sim.towers.includes(aiming)) aiming = null;
    view.render(speed > 0 ? acc / DT : 1, { hoverCol, hoverRow, cellCol, cellRow, placing, selected, aiming, aimX, aimY });
    hud.update(sim, placing, selected, speed);
    minimap?.update(viewQuad());
    renderTimeAcc += performance.now() - t1;

    if (!endShown && (sim.gameOver || (sim.victory && !sim.endless))) showEnd(sim.victory);
  }

  frames++;
  frameTimeAcc += performance.now() - t0;
  perfT += app.ticker.deltaMS;
  if (perfT >= 500 && sim && view) {
    const fps = (frames * 1000) / perfT;
    hud.perfLine(
      `FPS <b>${fps.toFixed(0)}</b> · sim <b>${(simTimeAcc / frames).toFixed(2)}ms</b> · ` +
      `cpu render <b>${(renderTimeAcc / frames).toFixed(2)}ms</b> · ` +
      `enemies <b>${sim.liveCount}</b> · projectiles <b>${sim.pCount}</b> · fx <b>${sim.fCount}</b> · ` +
      `towers <b>${sim.towers.length}</b> · sprites <b>${view.drawnParticles}</b> · ${app.renderer.name}`,
    );
    frames = 0;
    frameTimeAcc = simTimeAcc = renderTimeAcc = perfT = 0;
  }
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
  fit();
  new ResizeObserver(fit).observe(stage);
  bindInput();
  app.ticker.maxFPS = 0;
  app.ticker.add(frame);
  // expose for debugging/benchmarks in the console
  (window as unknown as { game: unknown }).game = {
    get sim() { return sim; },
    app,
    get camera() { return { x: camX, y: camY, zoom }; },
    look(wx: number, wy: number, z = zoom) {
      zoom = z;
      lookAt(wx, wy);
    },
  };
  hud.camera(projection.mode);
  showMenu();
}

boot();
