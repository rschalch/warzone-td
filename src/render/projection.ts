import { Matrix } from 'pixi.js';
import { MAP_H, MAP_W } from '../game/defs';

/**
 * Maps the flat sim world onto the screen. The sim never knows which camera is in use.
 * - top: the classic straight-down view; heights are ignored and sprites rotate at runtime.
 * - iso: 2:1 isometric (rotate 45°, squash y by half); heights lift things up the screen and
 *   models use pre-baked headings.
 */
export interface Projection {
  readonly mode: 'top' | 'iso';
  readonly width: number;
  readonly height: number;
  /** Screen pixels per unit of height. */
  readonly lift: number;
  x(wx: number, wy: number): number;
  y(wx: number, wy: number): number;
  /** Screen point -> world point on the ground. */
  toWorld(sx: number, sy: number): [number, number];
  /** Transform for containers whose children draw in world coordinates on the ground. */
  groundMatrix(): Matrix;
  /** Screen-space angle of a world direction. */
  angle(dx: number, dy: number): number;
}

export type CameraMode = Projection['mode'];

const K = Math.SQRT1_2;
const HEADROOM = 70; // for tall sprites at the far corner

/** Built for the current map size (see setMapSize). */
export function makeProjection(mode: CameraMode): Projection {
  if (mode === 'top') {
    return {
      mode,
      width: MAP_W,
      height: MAP_H,
      lift: 0,
      x: (wx) => wx,
      y: (_wx, wy) => wy,
      toWorld: (sx, sy) => [sx, sy],
      groundMatrix: () => new Matrix(),
      angle: (dx, dy) => Math.atan2(dy, dx),
    };
  }
  const OX = MAP_H * K;
  const OY = HEADROOM;
  return {
    mode,
    width: Math.ceil((MAP_W + MAP_H) * K),
    height: Math.ceil(((MAP_W + MAP_H) * K) / 2) + HEADROOM + 24,
    lift: 1,
    x: (wx, wy) => OX + (wx - wy) * K,
    y: (wx, wy) => OY + (wx + wy) * K * 0.5,
    toWorld(sx, sy) {
      const a = (sx - OX) / K; // x - y
      const b = (2 * (sy - OY)) / K; // x + y
      return [(a + b) / 2, (b - a) / 2];
    },
    groundMatrix: () => new Matrix(K, K * 0.5, -K, K * 0.5, OX, OY),
    angle: (dx, dy) => Math.atan2((dx + dy) * 0.5, dx - dy),
  };
}
