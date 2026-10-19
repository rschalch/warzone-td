import { MAP_H, MAP_W, TILE, TOWERS } from '../game/defs';
import type { GameMap } from '../game/maps';
import type { Sim } from '../game/sim';
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

  destroy(): void {
    this.canvas.remove();
  }
}
