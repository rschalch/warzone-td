import { COLS, ROWS } from './defs';

const SQRT2 = Math.SQRT2;
// 8-neighbourhood: dx, dy, cost
const NDX = [1, -1, 0, 0, 1, 1, -1, -1];
const NDY = [0, 0, 1, -1, 1, -1, 1, -1];
const NCOST = [1, 1, 1, 1, SQRT2, SQRT2, SQRT2, SQRT2];

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

  /** blocked[i] != 0 means impassable. Hot (every placement check runs it per route): heap inlined. */
  compute(blocked: Uint8Array): void {
    const dist = this.dist;
    const next = this.next;
    dist.fill(Infinity);
    next.fill(-1);
    const heap = this.heap;
    const key = this.heapKey;
    let size = 0;
    const goals = this.goals;
    for (let g = 0; g < goals.length; g++) {
      const i = goals[g];
      if (blocked[i]) continue;
      dist[i] = 0;
      // push(i, 0)
      let p = size++;
      while (p > 0) {
        const parent = (p - 1) >> 1;
        if (key[parent] <= 0) break;
        heap[p] = heap[parent];
        key[p] = key[parent];
        p = parent;
      }
      heap[p] = i;
      key[p] = 0;
    }
    while (size > 0) {
      const k = key[0];
      // pop()
      const i = heap[0];
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

      if (k > dist[i]) continue;
      const cx = i % COLS;
      const cy = (i / COLS) | 0;
      for (let n = 0; n < 8; n++) {
        const dx = NDX[n];
        const dy = NDY[n];
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
        const j = y * COLS + x;
        if (blocked[j]) continue;
        // diagonal moves may not squeeze between two blocked cells / clip a corner
        if (dx && dy && (blocked[cy * COLS + x] || blocked[y * COLS + cx])) continue;
        const nd = k + NCOST[n];
        if (nd < dist[j]) {
          dist[j] = nd;
          next[j] = i; // j steps toward i
          // push(j, nd)
          let q = size++;
          while (q > 0) {
            const parent = (q - 1) >> 1;
            if (key[parent] <= nd) break;
            heap[q] = heap[parent];
            key[q] = key[parent];
            q = parent;
          }
          heap[q] = j;
          key[q] = nd;
        }
      }
    }
  }

  copyFrom(o: FlowField): void {
    this.dist.set(o.dist);
    this.next.set(o.next);
  }
}
