/**
 * Uniform grid rebuilt every tick with a counting sort: O(n) build,
 * zero allocations, cache-friendly queries.
 */
export class SpatialHash {
  readonly cell: number;
  readonly cols: number;
  readonly rows: number;
  private readonly start: Int32Array; // cell -> first index into items
  private readonly count: Int32Array;
  private readonly items: Int32Array;
  private readonly cellOf: Int32Array;

  constructor(width: number, height: number, cell: number, maxItems: number) {
    this.cell = cell;
    this.cols = Math.ceil(width / cell);
    this.rows = Math.ceil(height / cell);
    const n = this.cols * this.rows;
    this.start = new Int32Array(n + 1);
    this.count = new Int32Array(n);
    this.items = new Int32Array(maxItems);
    this.cellOf = new Int32Array(maxItems);
  }

  private cellIndex(x: number, y: number): number {
    let cx = (x / this.cell) | 0;
    let cy = (y / this.cell) | 0;
    if (cx < 0) cx = 0;
    else if (cx >= this.cols) cx = this.cols - 1;
    if (cy < 0) cy = 0;
    else if (cy >= this.rows) cy = this.rows - 1;
    return cy * this.cols + cx;
  }

  /** ids[0..n) are live slot indices; xs/ys are indexed by slot. */
  build(ids: Int32Array, n: number, xs: Float32Array, ys: Float32Array): void {
    const count = this.count;
    const start = this.start;
    count.fill(0);
    for (let k = 0; k < n; k++) {
      const i = ids[k];
      const c = this.cellIndex(xs[i], ys[i]);
      this.cellOf[k] = c;
      count[c]++;
    }
    let acc = 0;
    for (let c = 0; c < count.length; c++) {
      start[c] = acc;
      acc += count[c];
      count[c] = start[c];
    }
    start[count.length] = acc;
    for (let k = 0; k < n; k++) {
      this.items[count[this.cellOf[k]]++] = ids[k];
    }
  }

  /** Writes candidate slot indices whose cell overlaps the circle into out; returns count. */
  query(x: number, y: number, r: number, out: Int32Array): number {
    const cs = this.cell;
    let x0 = ((x - r) / cs) | 0;
    let x1 = ((x + r) / cs) | 0;
    let y0 = ((y - r) / cs) | 0;
    let y1 = ((y + r) / cs) | 0;
    if (x0 < 0) x0 = 0;
    if (y0 < 0) y0 = 0;
    if (x1 >= this.cols) x1 = this.cols - 1;
    if (y1 >= this.rows) y1 = this.rows - 1;
    let n = 0;
    const start = this.start;
    const items = this.items;
    for (let cy = y0; cy <= y1; cy++) {
      const row = cy * this.cols;
      for (let cx = x0; cx <= x1; cx++) {
        const c = row + cx;
        for (let k = start[c], e = start[c + 1]; k < e; k++) out[n++] = items[k];
      }
    }
    return n;
  }
}
