import { BitmapFont, BitmapText, Container, Graphics, Particle, ParticleContainer, Sprite, Texture } from 'pixi.js';
import { palette, settings } from '../app/settings';
import { COLS, DT, ENEMIES, LOOK, MAP_H, MAP_W, ROWS, TILE, TOWERS, UNITS, WW2 } from '../game/defs';
import type { FlowField } from '../game/flow';
import {
  AIR_Z, ARC_HEIGHT, BOLT_NODES, EV_BOOM, EV_HIT, EV_KILL, EV_LEVEL, EV_SIZE, EV_STATUS, FX_GLOW, FX_RING, FX_SMOKE, FX_SPARK, MUZZLE_Z, P_ACID, P_AP, P_BULLET,
  MAX_UNITS, P_CRYO, P_FLAK, P_MISSILE, P_NUKE, P_SHELL, UNIT_PATH, Z_HOLE, Z_ORBITAL, type Sim, type Tower,
  ENEMY_ZONE, FLARE_R, MODE_AMBUSH, ST_AMBUSH,
} from '../game/sim';
import { DIRS, MODEL_TOP, SCENERY, dirFrame, scenery, type Atlas, type Scenery } from './atlas';
import { T_WATER } from '../game/maps';
import { models } from './models';
import type { Projection } from './projection';

/** A ParticleContainer with a pooled, compacted particle list rebuilt each frame. */
class ParticleLayer {
  readonly view: ParticleContainer;
  private readonly pool: Particle[] = [];
  private n = 0;

  constructor(private readonly fallback: Texture, additive = false) {
    this.view = new ParticleContainer({
      dynamicProperties: { position: true, rotation: true, vertex: true, uvs: true, color: true },
    });
    if (additive) this.view.blendMode = 'add';
  }

  begin(): void {
    this.n = 0;
  }

  /** Anchor defaults to the texture's own (baked models anchor at their ground point), else centre. */
  push(tex: Texture, x: number, y: number, rot: number, sx: number, sy: number, tint: number, alpha: number, ax = -1): void {
    let p = this.pool[this.n];
    if (!p) p = this.pool[this.n] = new Particle({ texture: this.fallback });
    this.n++;
    const a = ax < 0 ? tex.defaultAnchor : undefined;
    p.texture = tex;
    p.x = x;
    p.y = y;
    p.rotation = rot;
    p.scaleX = sx;
    p.scaleY = sy;
    p.anchorX = a ? a.x : ax < 0 ? 0.5 : ax;
    p.anchorY = a ? a.y : 0.5;
    p.tint = tint;
    p.alpha = alpha;
  }

  end(): void {
    const kids = this.view.particleChildren;
    kids.length = this.n;
    for (let k = 0; k < this.n; k++) kids[k] = this.pool[k];
    this.view.update();
  }

  get count(): number {
    return this.n;
  }
}

/** Painter's-algorithm ordering via counting sort on iso depth (x + y): O(n), no comparisons. */
class DepthSorter {
  private static readonly MIN = -128;
  private readonly buckets = Math.ceil((MAP_W + MAP_H + 256) / 2);
  private readonly counts = new Int32Array(this.buckets + 1);
  private keys = new Int32Array(8192);
  private codes = new Int32Array(8192);
  private out = new Int32Array(8192);
  n = 0;

  reset(): void {
    this.n = 0;
  }

  add(depth: number, code: number): void {
    if (this.n === this.keys.length) {
      const k = new Int32Array(this.n * 2);
      const c = new Int32Array(this.n * 2);
      k.set(this.keys);
      c.set(this.codes);
      this.keys = k;
      this.codes = c;
      this.out = new Int32Array(this.n * 2);
    }
    let b = ((depth - DepthSorter.MIN) / 2) | 0;
    if (b < 0) b = 0;
    else if (b >= this.buckets) b = this.buckets - 1;
    this.keys[this.n] = b;
    this.codes[this.n++] = code;
  }

  sort(): Int32Array {
    const counts = this.counts;
    counts.fill(0);
    for (let i = 0; i < this.n; i++) counts[this.keys[i] + 1]++;
    for (let b = 1; b <= this.buckets; b++) counts[b] += counts[b - 1];
    for (let i = 0; i < this.n; i++) this.out[counts[this.keys[i]]++] = this.codes[i];
    return this.out;
  }
}

// sort codes: object kind in the high bits, index in the low 16
const C_ROCK = 0 << 16;
const C_TOWER = 1 << 16;
const C_ENEMY = 2 << 16;
const C_DRONE = 3 << 16;
const C_HERO = 4 << 16;
const C_SCENERY = 5 << 16;
const C_UNIT = 6 << 16;
const C_GHOST = 7 << 16;
/** WW2 fog of war: s an attacker's last known position stays marked; how dark the unseen ground gets. */
const GHOST_T = 7;
const FOG_ALPHA = 105;

const STATUS_WORDS = [
  ['FROZEN', 0x9fe8ff], ['HACKED', 0x5aff8a], ['SHATTER!', 0xffb070], ['STUNNED', 0xfff07a], ['SWALLOWED', 0xc090ff],
  ['BOUNCED', 0xc8ccd0], ['TRACKED', 0xfff07a], ['AMMO RACK!', 0xff7a3a],
  ['SURRENDERED', 0xf0f0e0], ['FALLING BACK', 0xa8d8ff], ['OFFICER DOWN', 0xffd84a],
] as const;
const MAX_WRECKS = 220;
const MAX_SCORCH = 260;
const MAX_TEXTS = 70;
const WRECK_LIFE = 45;
const SCORCH_LIFE = 35;

/** Short-lived marks left on the battlefield (wrecks, scorch). */
interface Mark {
  x: number;
  y: number;
  a: number; // heading (wrecks) / size (scorch)
  kind: number;
  t: number; // s left
}

interface FloatText {
  text: BitmapText;
  x: number;
  y: number;
  z: number;
  t: number;
  life: number;
}

let fontReady = false;
function ensureFont(): void {
  if (fontReady) return;
  fontReady = true;
  BitmapFont.install({
    name: 'wz',
    style: { fontFamily: 'Arial, sans-serif', fontSize: 32, fontWeight: 'bold', fill: '#ffffff', stroke: { color: '#000000', width: 5 } },
    chars: [['0', '9'], ['A', 'Z'], ' +-$!.'],
    resolution: 2,
  });
}
const C_MASK = 0xffff;

export interface OverlayState {
  hoverCol: number; // top-left cell of the 2x2 footprint under the cursor
  hoverRow: number;
  cellCol: number; // cell directly under the cursor
  cellRow: number;
  placing: number; // tower type or -1
  selected: Tower | null;
  aiming: Tower | null; // superweapon waiting for a target
  aimX: number; // world point under the cursor
  aimY: number;
  /** Item or hero ability waiting for a target, with its blast radius. */
  targeting: { r: number; color: number } | null;
  heroSelected: boolean;
  multi: Tower[]; // box selection
  box: [number, number, number, number] | null; // selection rect being dragged, in projected screen space
  showAuras: boolean;
  enemy: number; // enemy slot being inspected, or -1
  /** WW2: selected defender units (slots). */
  units: number[];
}

/** Turret spin speeds (rad/s) for towers that rotate on their own. */
const SPIN: Record<string, number> = {
  tesla: 0.6, emp: 1.5, gravity: 2, repulsor: 1, jammer: 0.8, radar: 1.2, salvage: 0.3, orbital: 0.15, blackhole: 0.8,
};

const TWO_PI = Math.PI * 2;
const COIL_TIP_Z = MODEL_TOP.t_tesla - 3;

function lerpAngle(a: number, b: number, t: number): number {
  let d = (b - a) % TWO_PI;
  if (d > Math.PI) d -= TWO_PI;
  else if (d < -Math.PI) d += TWO_PI;
  return a + d * t;
}

const dirIndex = (angle: number) => ((Math.round((angle / TWO_PI) * DIRS) % DIRS) + DIRS) % DIRS;

export class GameRenderer {
  readonly root = new Container();
  private readonly atlas: Atlas;
  private readonly sim: Sim;
  private readonly p: Projection;
  private readonly iso: boolean;

  // ground plane: children draw in world coordinates through the iso matrix
  private readonly ground = new Container();
  private readonly decals: ParticleLayer;
  private readonly scorchLayer: ParticleLayer;
  private readonly wreckLayer: ParticleLayer;
  private readonly texts = new Container();
  private readonly textPool: FloatText[] = [];
  private readonly wrecks: Mark[] = [];
  private readonly scorch: Mark[] = [];
  private readonly heroFrames: Texture[];
  private readonly rubbleTex: Texture | null;
  private readonly unitFrames: Texture[][];
  private readonly unitTopTex: Texture[];
  private readonly unitTop: number[];
  private selUnits = new Set<number>();
  private routeLabel: BitmapText;
  private readonly boxG = new Graphics();
  /** Selection rectangle being dragged (projected screen space). */
  box: [number, number, number, number] | null = null;
  private readonly shadows: ParticleLayer;
  private readonly groundFx: ParticleLayer;
  private readonly overlay = new Graphics();
  // upright objects, screen space
  private readonly world: ParticleLayer;
  private readonly smoke: ParticleLayer;
  private readonly proj: ParticleLayer;
  private readonly air: ParticleLayer;
  private readonly glow: ParticleLayer;
  private readonly bars: ParticleLayer;
  private readonly beams = new Graphics();
  /** WW2: the night wash and the weather (rain, snow, fog haze) over the world, below the glows. */
  private readonly sky = new Graphics();
  private readonly weatherG = new Graphics();
  private readonly ghost = new Container();
  private readonly ghostBase = new Sprite();
  private readonly ghostTurret = new Sprite();

  private readonly sorter = new DepthSorter();
  /** WW2 fog of war: the dark wash over ground nothing of ours sees, and the last known positions of attackers. */
  private readonly fogCanvas: HTMLCanvasElement | null = null;
  private readonly fogTex: Texture | null = null;
  private fogVersion = -1;
  private readonly lastSeen = new Map<number, { x: number; y: number; ang: number; kind: number; t: number }>();
  private readonly ghosts: { x: number; y: number; ang: number; kind: number; a: number }[] = [];
  private readonly aliveUids = new Set<number>();
  private readonly airSorter = new DepthSorter();
  // iso: one frame per heading; top: a single frame rotated at runtime
  private readonly enemyFrames: Texture[][];
  private readonly enemyTopTex: Texture[];
  private readonly enemyTop: number[];
  /** WW2: emplacement bases under the positions of the enemy's base. */
  private readonly enemyBaseTex: (Texture | null)[];
  private readonly turretFrames: Texture[][];
  private readonly turretTopTex: Texture[];
  /** Per tower type, per level (bases show the tower's rank). */
  private readonly baseTex: (Texture | null)[][];
  private readonly cornerTex: Texture;
  private readonly rockTex: Texture[];
  private readonly sceneryTex: Texture[];
  private readonly scenery: Scenery[];
  private readonly bg: Sprite;
  private readonly rotorTex: Texture[];
  private readonly projTex: Texture[];
  private readonly projTint: number[];
  private readonly projScale: number[];
  private readonly droneFrames: Texture[];
  private readonly fxTex: Texture[];
  private readonly fxTexW: number[];
  private jitter = 1;
  // visible rectangle in projected screen space, padded for tall sprites; everything else is culled
  private vx0 = -Infinity;
  private vy0 = -Infinity;
  private vx1 = Infinity;
  private vy1 = Infinity;

  constructor(sim: Sim, atlas: Atlas, background: Texture, projection: Projection) {
    this.sim = sim;
    this.atlas = atlas;
    this.p = projection;
    this.iso = projection.mode === 'iso';
    const px = atlas.px;
    this.decals = new ParticleLayer(px);
    this.scorchLayer = new ParticleLayer(px);
    this.wreckLayer = new ParticleLayer(px);
    ensureFont();
    this.routeLabel = new BitmapText({ text: '', style: { fontFamily: 'wz', fontSize: 15 } });
    this.routeLabel.anchor.set(0.5, 1);
    this.shadows = new ParticleLayer(px);
    this.groundFx = new ParticleLayer(px, true);
    this.world = new ParticleLayer(px);
    this.smoke = new ParticleLayer(px);
    this.proj = new ParticleLayer(px);
    this.air = new ParticleLayer(px);
    this.glow = new ParticleLayer(px, true);
    this.bars = new ParticleLayer(px);
    this.beams.blendMode = 'add';

    const frames = (name: string) => Array.from({ length: models[name].dirs }, (_, d) => atlas[`${name}_${d}`]);
    const view = this.iso ? '0' : 't';
    this.enemyFrames = ENEMIES.map((e) => frames(e.tex));
    this.enemyTopTex = ENEMIES.map((e) => atlas[`${e.tex}_t`]);
    this.enemyTop = ENEMIES.map((e) => MODEL_TOP[e.tex]);
    this.enemyBaseTex = ENEMIES.map((e) => (e.base ? atlas[`${e.base}_${view}`] : null));
    this.turretFrames = TOWERS.map((t) => (t.turret ? frames(t.turret) : []));
    this.turretTopTex = TOWERS.map((t) => (t.turret ? atlas[`${t.turret}_t`] : atlas.px));
    this.cornerTex = atlas[`basecorners_${view}`];
    // WW2 emplacements sit in sandbags and earthworks instead of steel plating
    const base = LOOK.base;
    this.baseTex = TOWERS.map((t) => {
      if (t.turret) return t.levels.map((_, lv) => atlas[`${base}${lv}_${view}`]);
      return [t.role === 'barricade' || t.role === 'gate' ? atlas[`${t.block ?? t.kind}_${view}`] : null];
    });
    // a city battle's rocks are ruined houses
    const rock = sim.map.def.theme === 'ruins' ? 'ruin' : 'rock';
    this.rockTex = [atlas[`${rock}1_${view}`], atlas[`${rock}2_${view}`]];
    this.sceneryTex = SCENERY.map((n) => atlas[`${n}_${view}`]);
    this.scenery = scenery(sim.map);
    this.rotorTex = this.iso ? [0, 1, 2, 3].map((d) => atlas[`rotor_${d}`]) : [atlas.rotor_t];
    this.droneFrames = this.iso ? frames('drone') : [atlas.drone_t];
    const hero = LOOK.hero;
    this.heroFrames = this.iso ? frames(hero) : [atlas[`${hero}_t`]];
    this.rubbleTex = WW2 ? atlas[`w_rubble_${view}`] : null;
    this.unitFrames = UNITS.map((u) => frames(u.tex));
    this.unitTopTex = UNITS.map((u) => atlas[`${u.tex}_t`]);
    this.unitTop = UNITS.map((u) => MODEL_TOP[u.tex] ?? 10);
    // indexed by projectile kind
    this.projTex = [atlas.bullet, atlas.shell, atlas.missile, atlas.shell, atlas.blob, atlas.canister, atlas.shell, atlas.shell, atlas.blob, atlas[LOOK.nuke] ?? atlas.nukeshell, atlas.bullet];
    this.projTint = [0xffffff, 0xffffff, 0xffffff, 0xff8a40, 0xb6f23e, 0xffffff, 0x5a5650, 0xd0c8b0, 0xbff4ff, 0xffffff, 0xffd060];
    this.projScale = [1, 1.1, 1, 1.1, 0.9, 1, 0.7, 1.6, 0.9, 1, 1.7];
    this.fxTex = [atlas.glow, atlas.smoke, atlas.spark, atlas.ring, atlas.px];
    this.fxTexW = this.fxTex.map((t) => t.width);

    this.ghost.addChild(this.ghostBase, this.ghostTurret);
    this.ghost.alpha = 0.7;

    const bg = (this.bg = new Sprite(background));
    bg.width = MAP_W;
    bg.height = MAP_H;
    this.ground.setFromMatrix(projection.groundMatrix());
    this.ground.addChild(bg, this.scorchLayer.view, this.decals.view);
    if (WW2) {
      // one pixel per cell, stretched smooth over the map
      this.fogCanvas = document.createElement('canvas');
      this.fogCanvas.width = COLS;
      this.fogCanvas.height = ROWS;
      this.fogTex = Texture.from(this.fogCanvas);
      const fog = new Sprite(this.fogTex);
      fog.width = MAP_W;
      fog.height = MAP_H;
      this.ground.addChild(fog);
    }
    this.ground.addChild(this.overlay, this.shadows.view, this.groundFx.view);

    this.root.addChild(
      this.ground,
      this.wreckLayer.view,
      this.world.view,
      this.ghost,
      this.smoke.view,
      this.proj.view,
      this.air.view,
      this.sky,
      this.weatherG,
      this.glow.view,
      this.beams,
      this.bars.view,
      this.texts,
      this.routeLabel,
      this.boxG,
    );
  }

  // ---------------------------------------------------------------- battlefield marks & floating text

  setBox(b: [number, number, number, number] | null): void {
    this.box = b;
  }

  /** Visual reactions to simulation events: wrecks, scorch marks and floating numbers. */
  consumeEvents(ev: readonly number[]): void {
    for (let k = 0; k < ev.length; k += EV_SIZE) {
      const type = ev[k];
      const x = ev[k + 1];
      const y = ev[k + 2];
      const a = ev[k + 3];
      const b = ev[k + 4];
      if (type === EV_KILL) {
        // (WW2: knocked-out tanks stay as hulks in the simulation, drawn from there)
        if (settings.wrecks && !ENEMIES[a].air && !ENEMIES[a].inf && !(WW2 && ENEMIES[a].arm)) this.addMark(this.wrecks, MAX_WRECKS, { x, y, a: Math.random() * TWO_PI, kind: a, t: WRECK_LIFE });
        if (settings.numbers && b > 0) this.floatText(`+$${b}`, x, y, 0xffd84a, 0.9, ENEMIES[a].air ? AIR_Z : 10);
      } else if (type === EV_BOOM) {
        if (settings.wrecks && a >= 0.8) this.addMark(this.scorch, MAX_SCORCH, { x, y, a, kind: 0, t: SCORCH_LIFE });
      } else if (type === EV_HIT && settings.numbers) {
        this.floatText(`${Math.round(a)}`, x, y, b ? 0xffb070 : 0xffffff, a >= 500 ? 1.4 : 1.05, 14);
      } else if (type === EV_STATUS && settings.numbers) {
        const [word, color] = STATUS_WORDS[a];
        // morale calls float above the bounty of the same kill
        this.floatText(word, x, y, color, 0.85, a >= 8 ? 30 : 16);
      } else if (type === EV_LEVEL) {
        this.floatText(`LEVEL ${a}!`, x, y, 0xffd84a, 1.3, 24);
      }
    }
  }

  private addMark(list: Mark[], max: number, m: Mark): void {
    if (list.length >= max) list.shift();
    list.push(m);
  }

  private floatText(str: string, x: number, y: number, color: number, scale: number, z: number): void {
    let f: FloatText | undefined;
    if (this.textPool.length >= MAX_TEXTS) {
      f = this.textPool.shift()!;
      this.textPool.push(f);
    } else {
      const text = new BitmapText({ text: '', style: { fontFamily: 'wz', fontSize: 13 } });
      text.anchor.set(0.5, 1);
      this.texts.addChild(text);
      f = { text, x: 0, y: 0, z: 0, t: 0, life: 0 };
      this.textPool.push(f);
    }
    f.text.text = str;
    f.text.tint = color;
    f.text.scale.set(scale);
    f.text.visible = true;
    f.x = x;
    f.y = y;
    f.z = z;
    f.t = 0;
    f.life = 1.1;
  }

  /** Real-time aging (not sim time): marks and texts keep fading while paused only slowly. */
  tick(dt: number): void {
    for (const list of [this.wrecks, this.scorch]) {
      let w = 0;
      for (const m of list) if ((m.t -= dt) > 0) list[w++] = m;
      list.length = w;
    }
    for (const f of this.textPool) {
      if (!f.text.visible) continue;
      f.t += dt;
      if (f.t >= f.life) {
        f.text.visible = false;
        continue;
      }
      const sx = this.p.x(f.x, f.y);
      const sy = this.p.y(f.x, f.y) - f.z * Math.max(this.p.lift, 0.3) - f.t * 26;
      f.text.position.set(sx, sy);
      f.text.alpha = Math.min(1, (f.life - f.t) * 3);
    }
  }

  private drawMarks(): void {
    const iso = this.iso;
    this.scorchLayer.begin();
    for (const m of this.scorch) {
      const a = Math.min(1, m.t / 6) * 0.4;
      const sc = (18 + m.a * 10) / 32;
      this.scorchLayer.push(this.fxTex[FX_GLOW], m.x, m.y, 0, sc, sc, 0x000000, a, 0.5);
    }
    this.scorchLayer.end();
    this.wreckLayer.begin();
    for (const m of this.wrecks) {
      const sx = this.p.x(m.x, m.y);
      const sy = this.p.y(m.x, m.y);
      if (!this.visible(sx, sy)) continue;
      const a = Math.min(1, m.t / 5) * 0.85;
      if (iso) this.wreckLayer.push(this.enemyFrames[m.kind][dirIndex(m.a) % this.enemyFrames[m.kind].length], sx, sy, 0, 0.95, 0.85, 0x2e2a26, a);
      else this.wreckLayer.push(this.enemyTopTex[m.kind], sx, sy, m.a, 0.95, 0.95, 0x2e2a26, a);
    }
    // WW2 hulks: burnt-out tanks that block or slow the way and give cover
    const s = this.sim;
    for (let h = 0; h < s.hkCount; h++) {
      const c = s.hkCell[h];
      const x = ((c % COLS) + 0.5) * TILE;
      const y = (((c / COLS) | 0) + 0.5) * TILE;
      const sx = this.p.x(x, y);
      const sy = this.p.y(x, y);
      if (!this.visible(sx, sy)) continue;
      const k = s.hkKind[h];
      const a = Math.min(1, s.hkT[h] / 4) * 0.95;
      const tint = s.hkBlock[h] ? 0x3a3430 : 0x4a443e;
      if (iso) this.wreckLayer.push(this.enemyFrames[k][dirIndex(s.hkAng[h]) % this.enemyFrames[k].length], sx, sy, 0, 0.95, 0.85, tint, a);
      else this.wreckLayer.push(this.enemyTopTex[k], sx, sy, s.hkAng[h], 0.95, 0.95, tint, a);
    }
    this.wreckLayer.end();
  }

  /** Visible area in projected screen coordinates (the camera's view). */
  setView(x0: number, y0: number, x1: number, y1: number): void {
    const pad = 90;
    this.vx0 = x0 - pad;
    this.vy0 = y0 - pad / 2;
    this.vx1 = x1 + pad;
    this.vy1 = y1 + pad * 1.5; // tall models stick up above their ground point
  }

  private visible(sx: number, sy: number): boolean {
    return sx > this.vx0 && sx < this.vx1 && sy > this.vy0 && sy < this.vy1;
  }

  /** The angle a turret faces: tracking turrets follow their target, some spin, some never turn. */
  private turretAngle(t: Tower, alpha: number, time: number): number {
    const aim = TOWERS[t.type].aim;
    if (aim === 'spin') return time * (SPIN[t.kind] ?? 1) + t.id;
    if (aim === 'static') return 0;
    return lerpAngle(t.prevAngle, t.angle, alpha);
  }

  /** Painter's order: iso sorts by x + y, top-down by y (things lower on screen overlap). */
  private depth(x: number, y: number): number {
    return this.iso ? x + y : y * 2;
  }

  /** Swaps the ground picture (the detailed terrain arrives after the game has started). */
  setBackground(t: Texture): void {
    this.bg.texture = t;
    this.bg.width = MAP_W;
    this.bg.height = MAP_H;
  }

  /** alpha: interpolation factor between the previous and current sim tick. */
  render(alpha: number, ov: OverlayState): void {
    const s = this.sim;
    const time = s.time + alpha * DT;
    this.smoke.begin();
    this.glow.begin();
    this.groundFx.begin();

    // ---- depth-sorted world objects (ground layer) and flying units (air layer)
    const sorter = this.sorter;
    const airSorter = this.airSorter;
    sorter.reset();
    airSorter.reset();
    const rocks = s.map.rocks;
    const p = this.p;
    for (let r = 0; r < rocks.length; r++) {
      const c = (rocks[r].c + rocks[r].s / 2) * TILE;
      const rr = (rocks[r].r + rocks[r].s / 2) * TILE;
      if (this.visible(p.x(c, rr), p.y(c, rr))) sorter.add(this.depth(c, rr), C_ROCK | r);
    }
    for (let k = 0; k < this.scenery.length; k++) {
      const sc = this.scenery[k];
      if (this.visible(p.x(sc.x, sc.y), p.y(sc.x, sc.y))) sorter.add(this.depth(sc.x, sc.y), C_SCENERY | k);
    }
    this.decals.begin();
    for (let t = 0; t < s.towers.length; t++) {
      const tw = s.towers[t];
      if (!this.visible(p.x(tw.x, tw.y), p.y(tw.x, tw.y))) continue;
      if (TOWERS[tw.type].walkable || tw.open) this.drawDecal(tw, time);
      else sorter.add(this.depth(tw.x, tw.y), C_TOWER | t);
    }
    if (WW2) {
      // foxholes, and scrapes for hull-down tanks, growing as they dig
      for (let u = 0; u < MAX_UNITS; u++) {
        const dig = s.uDig[u];
        if (!s.uAlive[u] || dig <= 0 || !this.visible(p.x(s.uX[u], s.uY[u]), p.y(s.uX[u], s.uY[u]))) continue;
        const d = UNITS[s.uKind[u]];
        const k = ((d.arm ? 1.5 : 1) * (0.4 + 0.6 * dig) * (d.radius * 2 + 14)) / 30;
        this.decals.push(this.atlas.d_foxhole, s.uX[u], s.uY[u], d.arm ? s.uAng[u] : 0, k, d.arm ? k * 0.75 : k, 0xffffff, 0.5 + 0.5 * dig, 0.5);
      }
    }
    this.decals.end();
    if (WW2) this.updateFog(time);
    for (let n = 0; n < s.liveCount; n++) {
      const i = s.live[n];
      if (!s.eAlive[i]) continue;
      const x = s.ePx[i] + (s.eX[i] - s.ePx[i]) * alpha;
      const y = s.ePy[i] + (s.eY[i] - s.ePy[i]) * alpha;
      if (WW2 && !s.seen(i)) continue; // in the fog: its last known position is marked instead
      if (!this.visible(p.x(x, y), p.y(x, y))) continue;
      (s.eAir[i] ? airSorter : sorter).add(this.depth(x, y), C_ENEMY | i);
    }
    for (let k = 0; k < this.ghosts.length; k++) {
      const gh = this.ghosts[k];
      if (this.visible(p.x(gh.x, gh.y), p.y(gh.x, gh.y))) sorter.add(this.depth(gh.x, gh.y), C_GHOST | k);
    }

    for (let u = 0; u < MAX_UNITS; u++) {
      if (!s.uAlive[u]) continue;
      const x = s.uPx[u] + (s.uX[u] - s.uPx[u]) * alpha;
      const y = s.uPy[u] + (s.uY[u] - s.uPy[u]) * alpha;
      if (this.visible(p.x(x, y), p.y(x, y))) (s.uAir[u] ? airSorter : sorter).add(this.depth(x, y), C_UNIT | u);
    }
    if (s.hero && s.hero.downT <= 0) {
      const h = s.hero;
      const x = h.px + (h.x - h.px) * alpha;
      const y = h.py + (h.y - h.py) * alpha;
      sorter.add(this.depth(x, y), C_HERO);
    }
    for (let d = 0; d < s.drones.length; d++) {
      const dr = s.drones[d];
      const x = dr.px + (dr.x - dr.px) * alpha;
      const y = dr.py + (dr.y - dr.py) * alpha;
      if (this.visible(p.x(x, y), p.y(x, y))) airSorter.add(this.depth(x, y), C_DRONE | d);
    }

    this.drawMarks();
    this.world.begin();
    this.air.begin();
    this.shadows.begin();
    this.bars.begin();
    const order = sorter.sort();
    for (let k = 0; k < sorter.n; k++) this.drawItem(order[k], alpha, time);
    const airOrder = airSorter.sort();
    for (let k = 0; k < airSorter.n; k++) this.drawItem(airOrder[k], alpha, time);
    this.drawZones(alpha);
    if (WW2) this.drawSky(time);
    this.world.end();
    this.air.end();
    this.shadows.end();

    // ---- projectiles
    this.proj.begin();
    for (let p = 0; p < s.pCount; p++) {
      const x = s.pPx[p] + (s.pX[p] - s.pPx[p]) * alpha;
      const y = s.pPy[p] + (s.pY[p] - s.pPy[p]) * alpha;
      if (!this.visible(this.p.x(x, y), this.p.y(x, y))) continue;
      const k = s.pKind[p];
      const tex = this.projTex[k];
      const sc = this.projScale[k];
      const arcH = ARC_HEIGHT[k];
      if (arcH !== undefined) {
        // ballistic arc
        const f = 1 - Math.max(0, s.pTtl[p] - alpha * DT) / s.pTtl0[p];
        const arc = Math.sin(f * Math.PI);
        const rot = k === P_NUKE ? this.p.angle(s.pVx[p], s.pVy[p]) : 0;
        if (this.iso) {
          const z = MUZZLE_Z * (1 - f) + arc * arcH;
          this.proj.push(tex, this.p.x(x, y), this.p.y(x, y) - z, rot, sc, sc, this.projTint[k], 1);
        } else {
          // from above, height reads as size
          const g = 1 + arc * Math.min(1.2, arcH / 65);
          this.proj.push(tex, x, y, rot, sc * g, sc * g, this.projTint[k], 1);
        }
      } else {
        const rot = this.p.angle(s.pVx[p], s.pVy[p]);
        const z = k === P_BULLET || k === P_MISSILE || k === P_FLAK ? s.missileZ(p) : 10;
        const sx = k === P_BULLET ? 1.4 : sc;
        this.proj.push(tex, this.p.x(x, y), this.p.y(x, y) - z * this.p.lift, rot, sx, sc, this.projTint[k], 1);
        if (k === P_ACID || k === P_CRYO || k === P_AP) this.glow.push(this.fxTex[FX_GLOW], this.p.x(x, y), this.p.y(x, y) - z * this.p.lift, 0, 0.25, 0.25, this.projTint[k], 0.6, 0.5);
      }
    }
    // WW2: Katyusha rockets on their arc
    for (let r = 0; r < s.rkCount; r++) {
      if (s.rkWait[r] > 0) continue;
      const f = Math.min(1, 1 - Math.max(0, s.rkT[r] - alpha * DT) / s.rkT0[r]);
      const x = s.rkSx[r] + (s.rkTx[r] - s.rkSx[r]) * f;
      const y = s.rkSy[r] + (s.rkTy[r] - s.rkSy[r]) * f;
      if (!this.visible(this.p.x(x, y), this.p.y(x, y))) continue;
      const arc = Math.sin(f * Math.PI);
      // the arc is steep: climbing, then diving onto the target (barrage shells: no rocket flame)
      const rot = this.p.angle(s.rkTx[r] - s.rkSx[r], s.rkTy[r] - s.rkSy[r]);
      const shell = s.rkShell[r] === 1;
      const tex = this.projTex[shell ? P_SHELL : P_MISSILE];
      if (this.iso) {
        const z = 8 + arc * (shell ? 200 : 130);
        this.proj.push(tex, this.p.x(x, y), this.p.y(x, y) - z, rot, 0.9, 0.9, 0xd8d0b0, 1);
        if (!shell) this.glow.push(this.fxTex[FX_GLOW], this.p.x(x, y), this.p.y(x, y) - z, 0, 0.3, 0.3, 0xffa040, 0.7, 0.5);
      } else {
        const g = 0.9 + arc * 1.1;
        this.proj.push(tex, x, y, rot, g, g, 0xd8d0b0, 1);
        if (!shell) this.glow.push(this.fxTex[FX_GLOW], x, y, 0, 0.3 * g, 0.3 * g, 0xffa040, 0.7, 0.5);
      }
    }
    this.proj.end();

    // ---- effects
    for (let f = 0; f < s.fCount; f++) {
      const t = 1 - s.fLife[f] / s.fMax[f];
      const x = s.fPx[f] + (s.fX[f] - s.fPx[f]) * alpha;
      const y = s.fPy[f] + (s.fY[f] - s.fPy[f]) * alpha;
      if (!this.visible(this.p.x(x, y), this.p.y(x, y))) continue;
      const tex = s.fTex[f];
      const size = s.fS0[f] + (s.fS1[f] - s.fS0[f]) * t;
      let a = s.fA0[f] * (1 - t);
      if (tex === FX_RING) {
        // lies flat on the ground
        const sc = size / this.fxTexW[tex];
        this.groundFx.push(this.fxTex[tex], x, y, 0, sc, sc, s.fColor[f], a, 0.5);
        continue;
      }
      let z = s.fZ[f];
      if (tex === FX_SMOKE) {
        a = s.fA0[f] * (1 - t) * Math.min(1, t * 6 + 0.3);
        z += t * 16; // smoke rises
      }
      const sx = this.p.x(x, y);
      const sy = this.p.y(x, y) - z * this.p.lift;
      const layer = s.fAdd[f] ? this.glow : this.smoke;
      if (tex === FX_SPARK) {
        const rot = this.p.angle(Math.cos(s.fRot[f]), Math.sin(s.fRot[f]));
        layer.push(this.fxTex[tex], sx, sy, rot, size / 4, size / 6, s.fColor[f], a, 0.5);
      } else {
        const sc = (size / this.fxTexW[tex]) * (this.iso ? 0.88 : 1);
        layer.push(this.fxTex[tex], sx, sy, tex === FX_GLOW ? 0 : s.fRot[f] + t, sc, sc, s.fColor[f], a, 0.5);
      }
    }
    this.drawBeams(alpha, time);
    this.smoke.end();
    this.glow.end();
    this.groundFx.end();
    this.bars.end();

    this.drawOverlay(ov);
  }

  private drawItem(code: number, alpha: number, time: number): void {
    const s = this.sim;
    const p = this.p;
    const idx = code & C_MASK;
    const kind = code & ~C_MASK;
    if (kind === C_ROCK) {
      const r = s.map.rocks[idx];
      const x = (r.c + r.s / 2) * TILE;
      const y = (r.r + r.s / 2) * TILE;
      if (!this.iso) this.shadows.push(this.rockTex[r.s - 1], x + 3, y + 4, 0, 1, 1, 0x000000, 0.35);
      this.world.push(this.rockTex[r.s - 1], p.x(x, y), p.y(x, y), 0, 1, 1, 0xffffff, 1);
      return;
    }
    if (kind === C_SCENERY) {
      const sc = this.scenery[idx];
      const tex = this.sceneryTex[sc.k];
      if (!this.iso) this.shadows.push(tex, sc.x + 3, sc.y + 4, 0, 1, 1, 0x000000, 0.3);
      this.world.push(tex, p.x(sc.x, sc.y), p.y(sc.x, sc.y), 0, 1, 1, 0xffffff, 1);
      return;
    }
    if (kind === C_TOWER) {
      const t = s.towers[idx];
      const def = TOWERS[t.type];
      const sx = p.x(t.x, t.y);
      const sy = p.y(t.x, t.y);
      if (t.wreck && this.rubbleTex) {
        // knocked out: a heap of rubble in place of the emplacement
        const sc = t.size / 2;
        if (!this.iso) this.shadows.push(this.rubbleTex, t.x + 2, t.y + 3, 0, sc, sc, 0x000000, 0.3);
        this.world.push(this.rubbleTex, sx, sy, (t.id % 4) * (this.iso ? 0 : Math.PI / 2), sc, sc, 0xffffff, 1);
        return;
      }
      const bases = this.baseTex[t.type];
      const base = bases[Math.min(t.level, bases.length - 1)]!;
      this.world.push(base, sx, sy, 0, 1, 1, 0xffffff, 1);
      // a battle's objective: a pulsing red ring, so it is never lost from sight
      if (t.id === s.objectiveId || t.base) this.groundFx.push(this.fxTex[FX_RING], t.x, t.y, time, (t.size * TILE * 1.6) / 128, (t.size * TILE * 1.6) / 128, 0xff5a3a, 0.55 + 0.3 * Math.sin(time * 3), 0.5);
      // the AI partner's towers stand in a cyan ring, like the commander's gold one
      if (t.owner) this.groundFx.push(this.fxTex[FX_RING], t.x, t.y, 0, (t.size * TILE * 1.25) / 128, (t.size * TILE * 1.25) / 128, 0x3ad8ff, 0.55, 0.5);
      if (def.turret && !WW2) this.world.push(this.cornerTex, sx, sy, 0, 1, 1, def.color, 1);
      if (t.level >= 9) {
        // legendary towers glow in their own colour
        this.glow.push(this.fxTex[FX_GLOW], sx, sy - 10 * p.lift, 0, 1.1, 1.1 * (this.iso ? 0.7 : 1), def.color, 0.22 + 0.08 * Math.sin(time * 3 + t.id), 0.5);
      }
      if (!this.iso) this.shadows.push(base, t.x + 3, t.y + 4, 0, 1, 1, 0x000000, 0.35);
      if (def.turret) {
        const a = this.turretAngle(t, alpha, time);
        // recoil kicks the turret back along its barrel
        const tx = t.x - Math.cos(a) * t.recoil * 3;
        const ty = t.y - Math.sin(a) * t.recoil * 3;
        const sc = 1 + t.level * 0.03;
        // WW2: a camouflaged emplacement the enemy hasn't found yet is drawn under a green veil
        const hid = WW2 && s.towerHidden(t);
        const tint = hid ? 0xb8d0a0 : 0xffffff;
        // under construction: the gun isn't in yet
        const ta = t.buildT > 0 ? 0.35 : hid ? 0.8 : 1;
        if (this.iso) {
          const fr = this.turretFrames[t.type];
          this.world.push(fr[dirIndex(a) % fr.length], p.x(tx, ty), p.y(tx, ty), 0, sc, sc, tint, ta);
        } else {
          const tex = this.turretTopTex[t.type];
          this.world.push(tex, tx + 2, ty + 3, a, sc, sc, 0x000000, 0.3);
          this.world.push(tex, tx, ty, a, sc, sc, tint, ta);
        }
      }
      const max = s.maxHp(t);
      if (t.buildT > 0) {
        // construction progress
        const f = 1 - t.buildT / t.build0;
        const w = t.size * TILE * 0.8;
        const by = sy - (this.iso ? 26 : t.size * TILE * 0.5 + 3);
        this.bars.push(this.atlas.px, sx - w / 2 - 1, by, 0, (w + 2) / 4, 1, 0x111111, 0.85, 0);
        this.bars.push(this.atlas.px, sx - w / 2, by, 0, (w * f) / 4, 0.5, 0xffb040, 1, 0);
      } else if (max && t.hp < max) {
        // WW2: damage taken; red when close to being knocked out
        const f = t.hp / max;
        const w = t.size * TILE * 0.8;
        const by = sy - (this.iso ? 26 : t.size * TILE * 0.5 + 3);
        this.bars.push(this.atlas.px, sx - w / 2 - 1, by, 0, (w + 2) / 4, 1, 0x111111, 0.85, 0);
        const pal = palette();
        this.bars.push(this.atlas.px, sx - w / 2, by, 0, (w * Math.max(0, f)) / 4, 0.5, f > 0.6 ? pal.hpHigh : f > 0.3 ? pal.hpMid : pal.hpLow, 1, 0);
      }
      if (WW2 && t.ammo < 0.999 && !t.wreck && (s.usesAmmo(t) || def.role === 'depot')) {
        // ammunition (a depot: its store), under the emplacement; red once empty
        const w = t.size * TILE * 0.7;
        const by = sy + (this.iso ? 14 : t.size * TILE * 0.5 + 3);
        this.bars.push(this.atlas.px, sx - w / 2 - 1, by, 0, (w + 2) / 4, 1.3, 0x111111, 0.85, 0);
        this.bars.push(this.atlas.px, sx - w / 2, by, 0, (w * Math.max(0.04, t.ammo)) / 4, 0.75, t.ammo <= 0 ? 0xff4a3a : t.ammo < 0.3 ? 0xffa030 : 0xd8c070, 1, 0);
      }
      if (def.manual) {
        // charge gauge; glows when ready to fire
        const c = s.chargeLevel(t);
        const by = sy + (this.iso ? 14 : 20);
        this.bars.push(this.atlas.px, sx - 15, by, 0, 7.5, 1.2, 0x111111, 0.85, 0);
        this.bars.push(this.atlas.px, sx - 14.5, by, 0, 7.25 * c, 0.7, c >= 1 ? 0xffe040 : 0xff6a3a, 1, 0);
        if (c >= 1) this.glow.push(this.fxTex[FX_GLOW], sx, sy - 12 * p.lift, 0, 0.8, 0.8, def.color, 0.35 + 0.25 * Math.sin(time * 5), 0.5);
      }
      return;
    }
    if (kind === C_HERO) {
      const h = s.hero!;
      const x = h.px + (h.x - h.px) * alpha;
      const y = h.py + (h.y - h.py) * alpha;
      const ang = lerpAngle(h.pang, h.ang, alpha);
      const sx = p.x(x, y);
      const sy = p.y(x, y);
      // gold halo so the commander is easy to find in a crowd
      this.groundFx.push(this.fxTex[FX_RING], x, y, time * 1.5, 26 / 128, 26 / 128, h.rallyT > 0 ? 0xffa030 : 0xffd84a, 0.75, 0.5);
      if (this.iso) this.world.push(this.heroFrames[dirIndex(ang)], sx, sy, 0, 1.15, 1.15, 0xffffff, 1);
      else {
        this.shadows.push(this.heroFrames[0], x + 1.5, y + 2, ang, 1.15, 1.15, 0x000000, 0.35);
        this.world.push(this.heroFrames[0], sx, sy, ang, 1.15, 1.15, 0xffffff, 1);
      }
      // level pips
      const by = sy - (this.iso ? 22 : 15);
      this.bars.push(this.atlas.px, sx - 12, by, 0, 6, 0.9, 0x111111, 0.8, 0);
      const need = s.heroNextXp(h.level);
      this.bars.push(this.atlas.px, sx - 11.5, by, 0, 5.75 * Math.min(1, h.xp / need), 0.5, 0xffd84a, 1, 0);
      if (WW2 && h.hp < s.heroMaxHp()) {
        const f = h.hp / s.heroMaxHp();
        const pal = palette();
        this.bars.push(this.atlas.px, sx - 12, by - 3, 0, 6, 0.9, 0x111111, 0.8, 0);
        this.bars.push(this.atlas.px, sx - 11.5, by - 3, 0, 5.75 * f, 0.5, f > 0.6 ? pal.hpHigh : f > 0.3 ? pal.hpMid : pal.hpLow, 1, 0);
      }
      return;
    }
    if (kind === C_UNIT) {
      this.drawUnit(idx, alpha, time);
      return;
    }
    if (kind === C_GHOST) {
      // last known position of an attacker now in the fog: a faint grey silhouette
      const gh = this.ghosts[idx];
      const sx = p.x(gh.x, gh.y);
      const sy = p.y(gh.x, gh.y);
      if (this.iso) this.world.push(this.enemyFrames[gh.kind][dirIndex(gh.ang)], sx, sy, 0, 1, 1, 0x8a96a8, gh.a);
      else this.world.push(this.enemyTopTex[gh.kind], sx, sy, gh.ang, 1, 1, 0x8a96a8, gh.a);
      return;
    }
    if (kind === C_DRONE) {
      const d = s.drones[idx];
      const x = d.px + (d.x - d.px) * alpha;
      const y = d.py + (d.y - d.py) * alpha;
      const ang = lerpAngle(d.pang, d.ang, alpha);
      const z = AIR_Z * 0.7 + Math.sin(time * 6 + idx) * 1.5;
      if (this.iso) {
        this.shadows.push(this.fxTex[FX_GLOW], x, y, 0, 0.22, 0.22, 0x000000, 0.4, 0.5);
        this.air.push(this.droneFrames[dirIndex(ang)], p.x(x, y), p.y(x, y) - z, 0, 1, 1, 0xffffff, 1);
      } else {
        this.shadows.push(this.droneFrames[0], x + z * 0.3, y + z * 0.45, ang, 0.9, 0.9, 0x000000, 0.35);
        this.air.push(this.droneFrames[0], x, y, ang, 1.05, 1.05, 0xffffff, 1);
      }
      return;
    }
    const i = idx;
    const x = s.ePx[i] + (s.eX[i] - s.ePx[i]) * alpha;
    const y = s.ePy[i] + (s.eY[i] - s.ePy[i]) * alpha;
    const type = s.eKind[i];
    const ang = lerpAngle(s.ePang[i], s.eAng[i], alpha);
    const tint = s.eFlash[i] > 0 ? 0xffb0a0 : s.eHackT[i] > 0 ? 0x8aff9a : s.eFrozenT[i] > 0 ? 0x9fe8ff
      : s.eChill[i] > 0.15 || s.eSlowT[i] > 0 ? 0xa8d8ff : s.eBurnT[i] > 0 ? 0xffc8a0 : 0xffffff;
    // stealth units are a faint shimmer until a radar picks them up
    const hidden = s.hidden(i);
    const ea = hidden ? 0.28 : 1;
    const r = ENEMIES[type].radius;
    const sx = p.x(x, y);
    let sy = p.y(x, y);
    const air = s.eAir[i] === 1;
    if (!air) {
      // wading: ripples spread from units in a river
      const c = (x / TILE) | 0;
      const row = (y / TILE) | 0;
      if (c >= 0 && row >= 0 && c < COLS && row < ROWS && s.map.grid[row * COLS + c] === T_WATER) {
        const k = (time * 1.4 + i * 0.37) % 1;
        const sc = (r * 2.2 * (0.8 + k)) / 128;
        this.groundFx.push(this.fxTex[FX_RING], x, y, 0, sc, sc, 0xd8f4ff, 0.45 * (1 - k), 0.5);
      }
    }
    const eb = this.enemyBaseTex[type];
    if (eb) {
      // a position of the enemy's base: dug in on its emplacement (see-through while it is being built)
      const building = s.eBuild[i] > 0;
      if (!this.iso) this.shadows.push(eb, x + 3, y + 4, 0, 1, 1, 0x000000, 0.35);
      this.world.push(eb, sx, sy, 0, 1, 1, 0xffffff, 1);
      if (ENEMIES[type].fixed === 'hq') this.groundFx.push(this.fxTex[FX_RING], x, y, time, (r * 3.2) / 128, (r * 3.2) / 128, 0xff5a3a, 0.55 + 0.3 * Math.sin(time * 3), 0.5);
      const fr = this.enemyFrames[type];
      const tex = this.iso ? fr[dirIndex(ang) % fr.length] : this.enemyTopTex[type];
      this.world.push(tex, sx, sy, this.iso ? 0 : ang, 1, 1, tint, building ? 0.35 : 1);
    } else if (this.iso) {
      const tex = this.enemyFrames[type][dirIndex(ang)];
      if (air) {
        // shadow on the ground, body at altitude with a gentle bob
        this.shadows.push(this.fxTex[FX_GLOW], x, y, 0, (r * 2.4) / 64, (r * 2.4) / 64, 0x000000, 0.45, 0.5);
        sy -= AIR_Z + Math.sin(time * 3 + i) * 2;
        this.air.push(tex, sx, sy, 0, 1, 1, tint, 1);
        if (ENEMIES[type].rotor) this.air.push(this.rotorTex[(time * 30 + i) & 3], sx, sy - this.enemyTop[type] + 1, 0, 1, 1, 0xffffff, 0.9);
      } else {
        this.world.push(tex, sx, sy, 0, 1, 1, tint, ea);
      }
    } else {
      const tex = this.enemyTopTex[type];
      if (air) {
        // high up: offset shadow, slightly larger body
        const bob = 1.08 + Math.sin(time * 3 + i) * 0.02;
        this.shadows.push(tex, x + AIR_Z * 0.3, y + AIR_Z * 0.45, ang, 0.9, 0.9, 0x000000, 0.35);
        this.air.push(tex, sx, sy, ang, bob, bob, tint, 1);
        if (ENEMIES[type].rotor) this.air.push(this.rotorTex[0], sx, sy, time * 30 + i, bob, bob, 0xffffff, 0.9);
      } else {
        if (!hidden) this.shadows.push(tex, x + 1.5, y + 2, ang, 1, 1, 0x000000, 0.35);
        this.world.push(tex, sx, sy, ang, 1, 1, tint, ea);
      }
    }
    if (hidden) return;
    const midY = sy - (this.iso ? this.enemyTop[type] * 0.5 : 0);
    if (s.eShield[i] > 0) {
      const f = s.eShield[i] / s.eMaxShield[i];
      const sc = (r * 2.8) / 128;
      this.glow.push(this.fxTex[FX_RING], sx, midY, 0, sc, sc * (this.iso ? 0.8 : 1), 0x5ab4ff, 0.25 + 0.45 * f, 0.5);
    }
    if (s.eFrozenT[i] > 0) this.glow.push(this.fxTex[FX_GLOW], sx, midY, 0, r / 22, r / 22, 0xbff4ff, 0.5, 0.5);
    const hp = s.eHp[i] / s.eMaxHp[i];
    const sh = s.eMaxShield[i] > 0 ? s.eShield[i] / s.eMaxShield[i] : 1;
    if (hp < 0.999 || sh < 0.999) {
      const w = r * 2 + 4;
      const by = sy - (this.iso ? this.enemyTop[type] + 6 : r + 7);
      this.bars.push(this.atlas.px, sx - w / 2 - 1, by, 0, (w + 2) / 4, 1, 0x111111, 0.85, 0);
      const pal = palette();
      const col = hp > 0.6 ? pal.hpHigh : hp > 0.3 ? pal.hpMid : pal.hpLow;
      this.bars.push(this.atlas.px, sx - w / 2, by, 0, (w * Math.max(0, hp)) / 4, 0.5, col, 1, 0);
      if (s.eMaxShield[i] > 0) this.bars.push(this.atlas.px, sx - w / 2, by - 2.5, 0, (w * sh) / 4, 0.4, 0x6ac8ff, 1, 0);
    }
  }

  /** WW2: one of our units, in a ring that tells it apart from the enemy (bright when selected). */
  private drawUnit(u: number, alpha: number, time: number): void {
    const s = this.sim;
    const p = this.p;
    const d = UNITS[s.uKind[u]];
    const x = s.uPx[u] + (s.uX[u] - s.uPx[u]) * alpha;
    const y = s.uPy[u] + (s.uY[u] - s.uPy[u]) * alpha;
    const ang = lerpAngle(s.uPang[u], s.uAng[u], alpha);
    const sx = p.x(x, y);
    let sy = p.y(x, y);
    const sel = this.selUnits.has(u);
    // hidden from the enemy: drawn see-through for us
    const a = s.unitHidden(u) ? 0.55 : 1;
    if (s.uAir[u]) {
      if (this.iso) {
        this.shadows.push(this.fxTex[FX_GLOW], x, y, 0, (d.radius * 2.4) / 64, (d.radius * 2.4) / 64, 0x000000, 0.45, 0.5);
        sy -= AIR_Z + Math.sin(time * 3 + u) * 2;
        this.air.push(this.unitFrames[s.uKind[u]][dirIndex(ang)], sx, sy, 0, 1, 1, 0xffffff, 1);
      } else {
        this.shadows.push(this.unitTopTex[s.uKind[u]], x + AIR_Z * 0.3, y + AIR_Z * 0.45, ang, 0.9, 0.9, 0x000000, 0.35);
        this.air.push(this.unitTopTex[s.uKind[u]], sx, sy, ang, 1.08, 1.08, 0xffffff, 1);
      }
      if (sel) this.glow.push(this.fxTex[FX_RING], sx, sy, 0, (d.radius * 2.6) / 128, (d.radius * 2.6) / 128, 0x7ad8ff, 0.9, 0.5);
      return;
    }
    const ring = (d.radius * 2.4) / 128;
    this.groundFx.push(this.fxTex[FX_RING], x, y, sel ? time * 1.5 : 0, ring, ring, 0x7ad8ff, sel ? 0.9 : 0.35, 0.5);
    if (this.iso) this.world.push(this.unitFrames[s.uKind[u]][dirIndex(ang)], sx, sy, 0, 1, 1, 0xffffff, a);
    else {
      if (a === 1) this.shadows.push(this.unitTopTex[s.uKind[u]], x + 1.5, y + 2, ang, 1, 1, 0x000000, 0.35);
      this.world.push(this.unitTopTex[s.uKind[u]], sx, sy, ang, 1, 1, 0xffffff, a);
    }
    const f = s.uHp[u] / d.hp;
    const vet = s.unitVet(u);
    if (vet) {
      // rank chevrons above the unit
      const vy = sy - (this.iso ? this.unitTop[s.uKind[u]] + 10 : d.radius + 11);
      for (let n = 0; n < vet; n++) this.bars.push(this.atlas.pip, sx, vy - n * 3, 0, 1, 1, 0xffffff, 1, 0.5);
    }
    if (f < 0.999 || sel) {
      const w = d.radius * 2 + 4;
      const by = sy - (this.iso ? this.unitTop[s.uKind[u]] + 6 : d.radius + 7);
      this.bars.push(this.atlas.px, sx - w / 2 - 1, by, 0, (w + 2) / 4, 1, 0x111111, 0.85, 0);
      const pal = palette();
      this.bars.push(this.atlas.px, sx - w / 2, by, 0, (w * Math.max(0, f)) / 4, 0.5, f > 0.6 ? pal.hpHigh : f > 0.3 ? pal.hpMid : pal.hpLow, 1, 0);
    }
  }

  /** Floor traps and open gates lie flat on the ground (world coordinates). */
  private drawDecal(t: Tower, time: number): void {
    const a = this.atlas;
    switch (t.kind) {
      case 'wire':
        this.decals.push(a.d_wire, t.x, t.y, 0, 1, 1, 0xffffff, 1, 0.5);
        break;
      case 'mine': {
        const decal = TOWERS[t.type].decal;
        this.decals.push(decal ? a[decal] : a.d_mine, t.x, t.y, 0, 1, 1, 0xffffff, 1, 0.5);
        if (decal) break;
        const armed = t.cd <= 0;
        // blinking arming light
        if (armed && Math.sin(time * 6 + t.id) > 0) this.decals.push(a.d_mine_light, t.x, t.y, 0, 1, 1, 0xffffff, 1, 0.5);
        break;
      }
      case 'tar':
        this.decals.push(a.d_tar, t.x, t.y, 0, 1, 1, 0xffffff, 0.95, 0.5);
        break;
      case 'spikes':
        this.decals.push(a.d_spikes, t.x, t.y, 0, 1, 1, 0xffffff, 1, 0.5);
        break;
      case 'gate':
        this.decals.push(a.d_gate_open, t.x, t.y, 0, 1, 1, 0xffffff, 1, 0.5);
        break;
    }
    // traps have no base to plate: their level shows as a row of dots, gold from level 7
    for (let n = 0; n < t.level; n++) {
      const x = t.x + (n - (t.level - 1) / 2) * 3.4;
      this.decals.push(a.px, x, t.y + t.size * 7, 0, 0.55, 0.55, n >= 6 ? 0xffd84a : 0xe8ecf0, 0.95);
    }
  }

  /** Singularities and orbital strikes (the fire/gas clouds are all particles). */
  private drawZones(alpha: number): void {
    const s = this.sim;
    for (const z of s.zones) {
      const x = z.px + (z.x - z.px) * alpha;
      const y = z.py + (z.y - z.py) * alpha;
      const sx = this.p.x(x, y);
      const sy = this.p.y(x, y);
      if (!this.visible(sx, sy)) continue;
      const life = Math.min(1, z.t / 0.3, (z.t0 - z.t) / 0.3);
      if (z.kind === Z_HOLE) {
        const r = z.r * (0.28 + 0.04 * Math.sin(s.time * 20)) * life;
        this.smoke.push(this.fxTex[FX_GLOW], sx, sy - 8 * this.p.lift, 0, r / 18, r / 18, 0x000000, 0.95, 0.5);
        this.glow.push(this.fxTex[FX_RING], sx, sy - 8 * this.p.lift, s.time * 3, (r * 2.4) / 128, (r * 2.4) / 128, 0xa060ff, 0.8, 0.5);
        this.groundFx.push(this.fxTex[FX_RING], x, y, 0, (z.r * 2) / 128, (z.r * 2) / 128, 0x8a40ff, 0.3 * life, 0.5);
      } else if (z.kind === Z_ORBITAL) {
        this.glow.push(this.fxTex[FX_GLOW], sx, sy, 0, z.r / 16, z.r / 16, 0xff3a6a, 0.9 * life, 0.5);
        this.groundFx.push(this.fxTex[FX_RING], x, y, -s.time * 4, (z.r * 2.2) / 128, (z.r * 2.2) / 128, 0xff6a8a, 0.6 * life, 0.5);
      }
    }
  }

  private drawBeams(alpha: number, time: number): void {
    const s = this.sim;
    const g = this.beams;
    g.clear();
    for (const t of s.towers) {
      if (t.beam < 0 || !s.eAlive[t.beam]) continue;
      const i = t.beam;
      const ex = s.ePx[i] + (s.eX[i] - s.ePx[i]) * alpha;
      const ey = s.ePy[i] + (s.eY[i] - s.ePy[i]) * alpha;
      const a = lerpAngle(t.prevAngle, t.angle, alpha);
      const mx = t.x + Math.cos(a) * 15;
      const my = t.y + Math.sin(a) * 15;
      const lift = this.p.lift;
      const x0 = this.p.x(mx, my);
      const y0 = this.p.y(mx, my) - MUZZLE_Z * lift;
      const x1 = this.p.x(ex, ey);
      const y1 = this.p.y(ex, ey) - (s.eAir[i] ? AIR_Z + 6 : 6) * lift;
      const w = 1 + t.level * 0.6;
      const flick = 0.75 + 0.25 * Math.sin(time * 60 + t.id);
      g.moveTo(x0, y0).lineTo(x1, y1).stroke({ width: 6 * w, color: 0xff2030, alpha: 0.25 * flick });
      g.moveTo(x0, y0).lineTo(x1, y1).stroke({ width: 2 * w, color: 0xff6070, alpha: 0.8 });
      g.moveTo(x0, y0).lineTo(x1, y1).stroke({ width: 0.8 * w, color: 0xffffff, alpha: 0.9 });
      this.glow.push(this.fxTex[FX_GLOW], x1, y1, 0, 0.35 * w, 0.35 * w, 0xff5060, 0.8 * flick, 0.5);
      this.glow.push(this.fxTex[FX_GLOW], x0, y0, 0, 0.22 * w, 0.22 * w, 0xff8090, 0.9, 0.5);
    }
    // jittered lightning: the first node is the coil's tip, the rest are struck units
    let seed = (this.jitter = (this.jitter * 1103515245 + 12345) & 0x7fffffff);
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) - 0.5;
    for (let b = 0; b < s.bCount; b++) {
      const base = b * BOLT_NODES * 2;
      const n = s.bN[b];
      const life = Math.min(1, s.bLife[b] / 0.16);
      for (let pass = 0; pass < 2; pass++) {
        let px = this.p.x(s.bPts[base], s.bPts[base + 1]);
        let py = this.p.y(s.bPts[base], s.bPts[base + 1]) - COIL_TIP_Z * this.p.lift;
        g.moveTo(px, py);
        for (let k = 1; k < n; k++) {
          const wx = s.bPts[base + k * 2];
          const wy = s.bPts[base + k * 2 + 1];
          const qx = this.p.x(wx, wy);
          const qy = this.p.y(wx, wy) - 8 * this.p.lift;
          const nx = -(qy - py);
          const ny = qx - px;
          for (let j = 1; j <= 4; j++) {
            const f = j / 4;
            const off = j === 4 ? 0 : rnd() * 0.35;
            g.lineTo(px + (qx - px) * f + nx * off, py + (qy - py) * f + ny * off);
          }
          px = qx;
          py = qy;
        }
        g.stroke(pass === 0
          ? { width: 6, color: 0x3aa0ff, alpha: 0.35 * life }
          : { width: 1.6, color: 0xe8f6ff, alpha: life });
      }
    }
    // tracers, rail trails, hacker links, orbital beams
    const lift = this.p.lift;
    for (const k of s.streaks) {
      const f = k.life / k.life0;
      const x0 = this.p.x(k.x0, k.y0);
      const y0 = this.p.y(k.x0, k.y0) - k.z0 * lift;
      const x1 = this.p.x(k.x1, k.y1);
      const y1 = this.p.y(k.x1, k.y1) - k.z1 * lift;
      if (Math.abs(x1 - x0) + Math.abs(y1 - y0) < 0.5) {
        // a vertical beam seen from straight above is a disc
        this.glow.push(this.fxTex[FX_GLOW], x1, y1, 0, k.width / 12, k.width / 12, k.color, 0.7 * f, 0.5);
        continue;
      }
      g.moveTo(x0, y0).lineTo(x1, y1).stroke({ width: k.width * 3, color: k.color, alpha: 0.25 * f });
      g.moveTo(x0, y0).lineTo(x1, y1).stroke({ width: Math.max(0.8, k.width * 0.6), color: 0xffffff, alpha: 0.9 * f });
    }
  }

  /** Follows a flow field from the middle of each route's entry to its exit (ground plane). */
  private drawRoutes(fields: readonly FlowField[], color: number, alpha: number): void {
    const g = this.overlay;
    this.sim.map.routes.forEach((route, k) => {
      const f = fields[k];
      let cell = route.entry[route.entry.length >> 1];
      g.moveTo(route.airFrom[0], route.airFrom[1]);
      for (let guard = 0; guard < COLS * ROWS && cell >= 0; guard++) {
        g.lineTo(((cell % COLS) + 0.5) * TILE, (((cell / COLS) | 0) + 0.5) * TILE);
        if (f.dist[cell] === 0) break;
        cell = f.next[cell];
      }
      g.lineTo(route.airTo[0], route.airTo[1]);
      g.stroke({ width: 2.5, color, alpha, cap: 'round', join: 'round' });
    });
  }

  private drawOverlay(ov: OverlayState): void {
    const g = this.overlay;
    const s = this.sim;
    const pal = palette();
    g.clear();
    this.routeLabel.visible = false;
    // incoming airstrike / barrage shells
    for (const st of s.pendingStrikes) {
      const pulse = 0.5 + 0.5 * Math.sin(s.time * 20);
      g.circle(st.x, st.y, 26).stroke({ width: 2, color: 0xff3a2a, alpha: 0.4 + 0.5 * pulse });
    }
    if (ov.showAuras) {
      // every aura at once: what's covered by radar, jammers, command posts…
      for (const t of s.towers) {
        const def = TOWERS[t.type];
        if (def.targeted || def.cat === 'maze' || def.manual) continue;
        const r = s.stats(t).range;
        if (r > 14) g.circle(t.x, t.y, r).fill({ color: def.color, alpha: 0.08 }).stroke({ width: 1.5, color: def.color, alpha: 0.6 });
      }
    }
    for (const t of ov.multi) {
      const box = TILE * t.size;
      g.rect(t.col * TILE - 1, t.row * TILE - 1, box + 2, box + 2).stroke({ width: 2, color: 0xffe28a, alpha: 0.9 });
    }
    this.boxG.clear();
    if (ov.box) {
      const [x0, y0, x1, y1] = ov.box;
      this.boxG.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)).fill({ color: 0xffe28a, alpha: 0.08 }).stroke({ width: 1.5, color: 0xffe28a, alpha: 0.8 });
    }
    this.selUnits = new Set(ov.units);
    for (const u of ov.units) {
      if (!s.uAlive[u]) continue;
      const d = UNITS[s.uKind[u]];
      if (d.gun) g.circle(s.uX[u], s.uY[u], d.gun.range).stroke({ width: 1.5, color: 0x7ad8ff, alpha: 0.35 });
      if (d.gun && s.uStance[u] === ST_AMBUSH) g.circle(s.uX[u], s.uY[u], d.gun.range * 0.6).stroke({ width: 1.5, color: 0xffc04a, alpha: 0.6 });
      if (s.uAir[u]) {
        g.circle(s.uPostX[u], s.uPostY[u], 70).stroke({ width: 1.5, color: 0x7ad8ff, alpha: 0.5 });
        continue;
      }
      const n = s.uPathLen[u];
      if (s.uPathI[u] < n) {
        g.moveTo(s.uX[u], s.uY[u]);
        for (let k = s.uPathI[u]; k < n; k++) {
          const c = s.uPath[u * UNIT_PATH + k];
          g.lineTo(((c % COLS) + 0.5) * TILE, (((c / COLS) | 0) + 0.5) * TILE);
        }
        g.stroke({ width: 1.5, color: 0x7ad8ff, alpha: 0.5 });
      }
    }
    if (ov.heroSelected && s.hero) {
      const h = s.hero;
      g.circle(h.x, h.y, s.heroRange()).fill({ color: 0xffd84a, alpha: 0.05 }).stroke({ width: 2, color: 0xffd84a, alpha: 0.6 });
      if (h.path.length) {
        const last = h.path[h.path.length - 1];
        g.moveTo(h.x, h.y);
        for (const c of h.path) g.lineTo(((c % COLS) + 0.5) * TILE, (((c / COLS) | 0) + 0.5) * TILE);
        g.stroke({ width: 2, color: 0xffd84a, alpha: 0.5 });
        g.circle(((last % COLS) + 0.5) * TILE, (((last / COLS) | 0) + 0.5) * TILE, 6).stroke({ width: 2, color: 0xffd84a, alpha: 0.9 });
      }
    }
    if (ov.targeting) {
      const { r, color } = ov.targeting;
      g.circle(ov.aimX, ov.aimY, r).fill({ color, alpha: 0.12 }).stroke({ width: 2, color, alpha: 0.9 });
      g.moveTo(ov.aimX - 10, ov.aimY).lineTo(ov.aimX + 10, ov.aimY).moveTo(ov.aimX, ov.aimY - 10).lineTo(ov.aimX, ov.aimY + 10)
        .stroke({ width: 2, color, alpha: 0.95 });
      return;
    }
    if (ov.enemy >= 0 && s.eAlive[ov.enemy]) {
      const i = ov.enemy;
      const r = ENEMIES[s.eKind[i]].radius + 5;
      g.circle(s.eX[i], s.eY[i], r).stroke({ width: 2, color: 0xff6a5a, alpha: 0.6 + 0.3 * Math.sin(s.time * 8) });
    }
    const sel = ov.selected;
    if (sel) {
      const r = s.stats(sel).range;
      if (r > 0) g.circle(sel.x, sel.y, r).fill({ color: 0xffffff, alpha: 0.07 }).stroke({ width: 2, color: 0xffffff, alpha: 0.55 });
      // an ambush holds fire outside the inner ring (unless it gets a flank shot)
      if (sel.mode === MODE_AMBUSH && WW2) g.circle(sel.x, sel.y, r * 0.6).stroke({ width: 1.5, color: 0xffc04a, alpha: 0.7 });
      if (sel.kind === 'arty') {
        // artillery fires at what it sees itself and what the observation posts see
        g.circle(sel.x, sel.y, 140).stroke({ width: 1.5, color: 0x7ad8ff, alpha: 0.6 });
        for (const o of s.towers) if (o.kind === 'radar' && !o.wreck) g.circle(o.x, o.y, s.stats(o).range).fill({ color: 0x7ad8ff, alpha: 0.06 }).stroke({ width: 1.5, color: 0x7ad8ff, alpha: 0.6 });
      }
      const box = TILE * sel.size;
      g.rect(sel.col * TILE - 1, sel.row * TILE - 1, box + 2, box + 2).stroke({ width: 2.5, color: 0xffe28a, alpha: 0.95 });
    }
    this.ghost.visible = false;
    if (ov.aiming) {
      // superweapon reticle
      const lv = TOWERS[ov.aiming.type].levels[ov.aiming.level];
      const r = ov.aiming.kind === 'orbital' ? 200 : lv.splash ?? 100;
      g.circle(ov.aimX, ov.aimY, r).fill({ color: 0xff3a3a, alpha: 0.1 }).stroke({ width: 2, color: 0xff5a5a, alpha: 0.9 });
      g.moveTo(ov.aimX - 14, ov.aimY).lineTo(ov.aimX + 14, ov.aimY).moveTo(ov.aimX, ov.aimY - 14).lineTo(ov.aimX, ov.aimY + 14)
        .stroke({ width: 2, color: 0xff8a8a, alpha: 0.95 });
      return;
    }
    if (ov.placing >= 0 && ov.hoverCol > -2) {
      const def = TOWERS[ov.placing];
      const box = TILE * def.size;
      // WW2: the enemy's base, where nothing can be built
      if (WW2) {
        for (let k = 0; k < s.gKind.length; k++) {
          if (s.gKind[k] >= 0) g.circle(s.gX[k], s.gY[k], ENEMY_ZONE).fill({ color: 0xff3a3a, alpha: 0.05 }).stroke({ width: 1.5, color: 0xff5a5a, alpha: 0.35 });
        }
      }
      const status = s.placeStatus(ov.placing, ov.hoverCol, ov.hoverRow);
      const ok = status === 'ok' && s.money >= def.levels[0].cost;
      const preview = s.preview(ov.placing, ov.hoverCol, ov.hoverRow);
      const x = ov.hoverCol * TILE + box / 2;
      const y = ov.hoverRow * TILE + box / 2;
      if (!def.walkable) {
        this.drawRoutes(s.fields, 0xffffff, preview ? 0.2 : 0.45);
        if (preview) {
          this.drawRoutes(preview, ok ? pal.ok : 0xffc04a, 0.8);
          // how much longer the walk gets
          let before = 0;
          let after = 0;
          s.map.routes.forEach((route, k) => {
            const e = route.entry[route.entry.length >> 1];
            before += s.fields[k].dist[e];
            after += preview[k].dist[e];
          });
          const d = Math.round(after - before);
          this.routeLabel.text = d > 0 ? `+${d} TILES` : d < 0 ? `${d} TILES` : 'SAME ROUTE';
          this.routeLabel.tint = d > 0 ? pal.ok : d < 0 ? 0xffc04a : 0xcccccc;
          this.routeLabel.position.set(this.p.x(x, y), this.p.y(x, y) - (this.iso ? 46 : 28));
          this.routeLabel.visible = true;
        }
      }
      const r = def.levels[0].range;
      const col = ok ? pal.ok : pal.bad;
      if (r > 14) g.circle(x, y, r).fill({ color: col, alpha: 0.07 }).stroke({ width: 2, color: col, alpha: 0.55 });
      g.rect(ov.hoverCol * TILE, ov.hoverRow * TILE, box, box).fill({ color: col, alpha: 0.3 });
      if (status === 'blocked') {
        g.moveTo(x - 10, y - 10).lineTo(x + 10, y + 10).moveTo(x + 10, y - 10).lineTo(x - 10, y + 10)
          .stroke({ width: 4, color: 0xff3a3a, alpha: 0.95 });
      } else if (status !== 'invalid' && this.baseTex[ov.placing][0]) {
        this.ghost.visible = true;
        const base = this.baseTex[ov.placing][0]!;
        const turret = !def.turret ? this.atlas.px
          : this.iso ? this.atlas[dirFrame(def.turret, -Math.PI * 0.75, models[def.turret].dirs)] : this.turretTopTex[ov.placing];
        this.ghostBase.texture = base;
        this.ghostTurret.texture = turret;
        this.ghostTurret.visible = !!def.turret;
        this.ghostTurret.rotation = this.iso || def.aim === 'static' ? 0 : -Math.PI / 2;
        this.ghostBase.anchor.set(base.defaultAnchor!.x, base.defaultAnchor!.y);
        if (def.turret) this.ghostTurret.anchor.set(turret.defaultAnchor!.x, turret.defaultAnchor!.y);
        this.ghost.position.set(this.p.x(x, y), this.p.y(x, y));
        this.ghostBase.tint = this.ghostTurret.tint = ok ? 0xffffff : 0xff8080;
      }
    } else if (ov.cellCol >= 0 && !sel) {
      const t = s.towerAtTile(ov.cellCol, ov.cellRow);
      if (t) {
        const r = s.stats(t).range;
        if (r > 14) g.circle(t.x, t.y, r).stroke({ width: 1.5, color: 0xffffff, alpha: 0.35 });
      }
    }
  }

  /**
   * WW2 night and weather, drawn over the visible part of the world: a dark blue wash at night (flares
   * and muzzle flashes glow through it), a grey haze in fog, rain streaks or falling snow. Cosmetic.
   */
  private drawSky(time: number): void {
    const s = this.sim;
    const g = this.sky;
    const w = this.weatherG;
    g.clear();
    w.clear();
    const x0 = Number.isFinite(this.vx0) ? this.vx0 : 0;
    const y0 = Number.isFinite(this.vy0) ? this.vy0 : 0;
    const x1 = Number.isFinite(this.vx1) ? this.vx1 : MAP_W;
    const y1 = Number.isFinite(this.vy1) ? this.vy1 : MAP_H;
    const night = s.night;
    if (night > 0) g.rect(x0, y0, x1 - x0, y1 - y0).fill({ color: 0x08122e, alpha: 0.5 * night });
    if (s.weather === 'fog') g.rect(x0, y0, x1 - x0, y1 - y0).fill({ color: 0xc8ccd0, alpha: 0.22 * (1 - 0.5 * night) });
    else if (s.weather === 'rain') g.rect(x0, y0, x1 - x0, y1 - y0).fill({ color: 0x1a2430, alpha: 0.1 });
    // flares: a pool of white light under each, swinging gently on its parachute
    for (let f = 0; f < s.flCount; f++) {
      const fx = this.p.x(s.flX[f], s.flY[f]) + Math.sin(time * 1.3 + f) * 4;
      const fy = this.p.y(s.flX[f], s.flY[f]);
      const life = Math.min(1, s.flT[f] / 2);
      const k = (FLARE_R * 2.2) / 64;
      this.glow.push(this.fxTex[FX_GLOW], fx, fy, 0, k, k * (this.iso ? 0.6 : 1), 0xfff4d8, (0.32 + 0.04 * Math.sin(time * 17 + f)) * life, 0.5);
      this.glow.push(this.fxTex[FX_GLOW], fx, fy - 40 * this.p.lift - (1 - s.flT[f] / 12) * 20, 0, 0.4, 0.4, 0xffffff, 0.95 * life, 0.5);
    }
    if (s.weather === 'rain' || s.weather === 'snow') {
      // a field of streaks or flakes fixed to the view, drifting down
      const snow = s.weather === 'snow';
      const n = snow ? 160 : 140;
      const W = x1 - x0;
      const H = y1 - y0;
      for (let k = 0; k < n; k++) {
        const seed = k * 7919;
        const px = x0 + ((seed % 997) / 997) * W + (snow ? Math.sin(time * 0.8 + k) * 12 : -time * 60);
        const py = y0 + ((((seed % 613) / 613) * H + time * (snow ? 45 : 520) * (0.7 + (k % 5) * 0.08)) % H);
        const x = x0 + ((((px - x0) % W) + W) % W);
        if (snow) w.circle(x, py, 1.1 + (k % 3) * 0.4).fill({ color: 0xffffff, alpha: 0.75 });
        else w.moveTo(x, py).lineTo(x - 3, py + 14);
      }
      if (!snow) w.stroke({ width: 1, color: 0xa8c0d8, alpha: 0.35 });
    }
  }

  /**
   * WW2 fog of war: redraws the wash over unseen ground when the sim's sight changes, and keeps the
   * last known positions of attackers that slipped into it (fading out).
   */
  private updateFog(time: number): void {
    const s = this.sim;
    if (this.fogCanvas && this.fogTex && this.fogVersion !== s.sightVersion) {
      this.fogVersion = s.sightVersion;
      const g = this.fogCanvas.getContext('2d')!;
      const img = g.createImageData(COLS, ROWS);
      const d = img.data;
      for (let c = 0; c < COLS * ROWS; c++) {
        d[c * 4] = 12;
        d[c * 4 + 1] = 18;
        d[c * 4 + 2] = 28;
        d[c * 4 + 3] = s.seenGrid[c] ? 0 : FOG_ALPHA;
      }
      g.putImageData(img, 0, 0);
      this.fogTex.source.update();
    }
    const alive = this.aliveUids;
    alive.clear();
    for (let n = 0; n < s.liveCount; n++) {
      const i = s.live[n];
      if (!s.eAlive[i] || s.eGar[i] >= 0) continue;
      alive.add(s.eUid[i]);
      if (!s.seen(i)) continue;
      const m = this.lastSeen.get(s.eUid[i]);
      if (m) {
        m.x = s.eX[i];
        m.y = s.eY[i];
        m.ang = s.eAng[i];
        m.t = time;
      } else this.lastSeen.set(s.eUid[i], { x: s.eX[i], y: s.eY[i], ang: s.eAng[i], kind: s.eKind[i], t: time });
    }
    this.ghosts.length = 0;
    for (const [uid, m] of this.lastSeen) {
      const age = time - m.t;
      // dead, or long gone: forget it
      if (!alive.has(uid) || age > GHOST_T || age < 0) this.lastSeen.delete(uid);
      else if (age > 0) this.ghosts.push({ x: m.x, y: m.y, ang: m.ang, kind: m.kind, a: 0.45 * (1 - age / GHOST_T) });
    }
  }

  get drawnParticles(): number {
    return this.scorchLayer.count + this.wreckLayer.count + this.decals.count + this.world.count + this.smoke.count + this.proj.count + this.shadows.count + this.air.count +
      this.glow.count + this.bars.count + this.groundFx.count;
  }
}
