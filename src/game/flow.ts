import { COLS, ROWS } from './defs';

const SQRT2 = Math.SQRT2;
// 8-neighbourhood: dx, dy, cost
const NB: [number, number, number][] = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, SQRT2], [1, -1, SQRT2], [-1, 1, SQRT2], [-1, -1, SQRT2],
];

/**
 * Distance field towards a set of goal cells (Dijkstra, octile moves, no corner cutting).
 * Every walkable cell knows its remaining distance and the neighbour to step to,
 * so moving thousands of units costs one array lookup each.
 */
export class FlowField {
  readonly dist = new Float32Array(COLS * ROWS);
  readonly next = new Int32Array(COLS * ROWS);
  private readonly heap = new Int32Array(COLS * ROWS * 8);
  private readonly heapKey = new Float32Array(COLS * ROWS * 8);

  constructor(readonly goals: number[]) {}

  /** blocked[i] != 0 means impassable. */
  compute(blocked: Uint8Array): void {
    const dist = this.dist;
    const next = this.next;
    dist.fill(Infinity);
    next.fill(-1);
    let size = 0;
    const heap = this.heap;
    const key = this.heapKey;
    const push = (i: number, k: number) => {
      let p = size++;
      while (p > 0) {
        const parent = (p - 1) >> 1;
        if (key[parent] <= k) break;
        heap[p] = heap[parent];
        key[p] = key[parent];
        p = parent;
      }
      heap[p] = i;
      key[p] = k;
    };
    const pop = (): number => {
      const top = heap[0];
      const li = heap[--size];
      const lk = key[size];
      let p = 0;
      for (;;) {
        let c = p * 2 + 1;
        if (c >= size) break;
        if (c + 1 < size && key[c + 1] < key[c]) c++;
        if (key[c] >= lk) break;
        heap[p] = heap[c];
        key[p] = key[c];
        p = c;
      }
      heap[p] = li;
      key[p] = lk;
      return top;
    };

    for (const g of this.goals) {
      if (blocked[g]) continue;
      dist[g] = 0;
      push(g, 0);
    }
    while (size > 0) {
      const k = key[0];
      const i = pop();
      if (k > dist[i]) continue;
      const cx = i % COLS;
      const cy = (i / COLS) | 0;
      for (let n = 0; n < 8; n++) {
        const [dx, dy, cost] = NB[n];
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
        const j = y * COLS + x;
        if (blocked[j]) continue;
        // diagonal moves may not squeeze between two blocked cells / clip a corner
        if (dx && dy && (blocked[cy * COLS + x] || blocked[y * COLS + cx])) continue;
        const nd = k + cost;
        if (nd < dist[j]) {
          dist[j] = nd;
          next[j] = i; // j steps toward i
          push(j, nd);
        }
      }
    }
  }

  copyFrom(o: FlowField): void {
    this.dist.set(o.dist);
    this.next.set(o.next);
  }
}
