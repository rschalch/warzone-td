import { MAP_H, MAP_W, TILE, TOWERS, WW2 } from '../game/defs';
import type { GameMap } from '../game/maps';
import { ENEMY_ZONE, type Sim } from '../game/sim';
import { drawTerrain } from '../render/atlas';

const MAX_W = 220;
const MAX_H = 170;
const REDRAW_MS = 100;

const css = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/** Top-down overview of the whole map in a 2D canvas: towers, enemies and the camera's view. */
export class Minimap {
  private readonly canvas = document.createElement('canvas');
  private readonly g: CanvasRenderingContext2D;
  private readonly terrain: HTMLCanvasElement;
  private readonly k: number; // minimap px per world px
  private readonly w: number;
  private readonly h: number;
  private last = -Infinity;
  /** WW2: the enemy's ground (the zone round the positions they hold) and its edge, the front line; redrawn when it moves. */
  private front: HTMLCanvasElement | null = null;
  private frontVersion = -1;

  constructor(host: HTMLElement, map: GameMap, private readonly sim: Sim, private readonly jump: (wx: number, wy: number) => void) {
    this.k = Math.min(MAX_W / MAP_W, MAX_H / MAP_H);
    this.w = Math.round(MAP_W * this.k);
    this.h = Math.round(MAP_H * this.k);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.className = 'minimap';
    this.canvas.width = this.w * dpr;
    this.canvas.height = this.h * dpr;
    this.canvas.style.width = `${this.w}px`;
    this.canvas.style.height = `${this.h}px`;
    this.g = this.canvas.getContext('2d')!;
    this.g.scale(dpr, dpr);
    this.terrain = drawTerrain(map, this.k * dpr, true);
    host.appendChild(this.canvas);

    const go = (e: PointerEvent) => {
      const r = this.canvas.getBoundingClientRect();
      this.jump(((e.clientX - r.left) / r.width) * MAP_W, ((e.clientY - r.top) / r.height) * MAP_H);
      this.last = -Infinity;
    };
    this.canvas.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.canvas.setPointerCapture(e.pointerId);
      go(e);
    });
    this.canvas.addEventListener('pointermove', (e) => e.buttons & 1 && go(e));
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** quad: the camera's view as four world points. Redraws at most every REDRAW_MS. */
  update(quad: [number, number][]): void {
    const now = performance.now();
    if (now - this.last < REDRAW_MS) return;
    this.last = now;
    const { g, k, sim: s } = this;
    g.drawImage(this.terrain, 0, 0, this.w, this.h);
    if (WW2) g.drawImage(this.frontLine(), 0, 0, this.w, this.h);

    for (const t of s.towers) {
      g.fillStyle = css(TOWERS[t.type].color);
      g.fillRect(t.col * TILE * k, t.row * TILE * k, t.size * TILE * k, t.size * TILE * k);
    }
    g.fillStyle = '#ff4030';
    for (let n = 0; n < s.liveCount; n++) {
      const i = s.live[n];
      if (!s.eAlive[i] || s.eAir[i] || s.hidden(i) || !s.seen(i)) continue;
      g.fillRect(s.eX[i] * k - 1, s.eY[i] * k - 1, 2.5, 2.5);
    }
    g.fillStyle = '#ffe28a';
    for (let n = 0; n < s.liveCount; n++) {
      const i = s.live[n];
      if (!s.eAlive[i] || !s.eAir[i]) continue;
      g.fillRect(s.eX[i] * k - 1, s.eY[i] * k - 1, 2.5, 2.5);
    }

    g.beginPath();
    quad.forEach(([x, y], n) => (n ? g.lineTo(x * k, y * k) : g.moveTo(x * k, y * k)));
    g.closePath();
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = 1.5;
    g.stroke();
  }

  /** Their ground in a red tint, edged by the front line (a ring round the union of their positions' zones). */
  private frontLine(): HTMLCanvasElement {
    const s = this.sim;
    if (this.front && this.frontVersion === s.frontVersion) return this.front;
    this.frontVersion = s.frontVersion;
    const w = this.terrain.width;
    const h = this.terrain.height;
    const k = w / MAP_W;
    const make = () => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return c;
    };
    const zone = (c: HTMLCanvasElement, r: number, color: string) => {
      const g = c.getContext('2d')!;
      g.fillStyle = color;
      for (let i = 0; i < s.gKind.length; i++) {
        if (s.gKind[i] < 0) continue;
        g.beginPath();
        g.arc(s.gX[i] * k, s.gY[i] * k, r * k, 0, Math.PI * 2);
        g.fill();
      }
      return g;
    };
    this.front ??= make();
    const out = this.front.getContext('2d')!;
    out.clearRect(0, 0, w, h);
    // the edge: their ground, less the same shrunk by the line's width
    const edge = make();
    const eg = zone(edge, ENEMY_ZONE, '#ff5a3a');
    eg.globalCompositeOperation = 'destination-out';
    zone(edge, ENEMY_ZONE - 3 / k, '#000');
    const fill = make();
    zone(fill, ENEMY_ZONE, '#c8281a');
    out.globalAlpha = 0.22;
    out.drawImage(fill, 0, 0);
    out.globalAlpha = 0.95;
    out.drawImage(edge, 0, 0);
    out.globalAlpha = 1;
    return this.front;
  }

  destroy(): void {
    this.canvas.remove();
  }
}
