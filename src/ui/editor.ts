// Map editor: paint rocks, rivers, mountains and forests, put entry/exit gates on the edges (paired in order:
// entry 1 → exit 1), then save, share as a link, or play. Rocks and mountains that would cut a route are
// dropped when the map is built, as in generated maps.

import { T_MOUNT, T_TREE, T_WATER, decodePaint, encodePaint, type Gate, type MapDef, type Side } from '../game/maps';

type Tool = 'rock1' | 'rock2' | 'river' | 'mountain' | 'forest' | 'erase' | 'entry' | 'exit';
const BRUSH = 1.6; // cells, radius of the river / mountain brush

const GATE_W = 4;
const SIZES = [[64, 44], [96, 64], [128, 84], [176, 112]] as const;

export interface EditorHost {
  play(def: MapDef): void;
  save(def: MapDef): void;
  share(def: MapDef): void;
  back(): void;
}

export function blankMap(cols = 96, rows = 64): MapDef {
  return {
    name: 'My Map',
    desc: 'A hand-made battlefield.',
    seed: 1,
    cols,
    rows,
    routes: [{ entry: { side: 'L', from: (rows >> 1) - 2, to: (rows >> 1) + 1 }, exit: { side: 'R', from: (rows >> 1) - 2, to: (rows >> 1) + 1 } }],
    rocks: 0,
    rockList: [],
  };
}

export function openEditor(root: HTMLElement, start: MapDef, host: EditorHost): void {
  const def: MapDef = structuredClone(start);
  def.rockList ??= [];
  let cells = def.paint ? decodePaint(def.paint, def.cols * def.rows) : new Uint8Array(def.cols * def.rows);
  let tool: Tool = 'rock2';
  // gates being placed: entries and exits are matched up by index into routes
  const entries: Gate[] = def.routes.map((r) => r.entry);
  const exits: Gate[] = def.routes.map((r) => r.exit);

  root.innerHTML = `
    <div class="card editor">
      <div class="ed-top">
        <h2>Map editor</h2>
        <input id="ed-name" maxlength="28" value="${def.name.replace(/"/g, '&quot;')}">
        <select id="ed-size">${SIZES.map(([c, r]) => `<option value="${c}x${r}" ${c === def.cols && r === def.rows ? 'selected' : ''}>${c}×${r}</option>`).join('')}</select>
      </div>
      <div class="ed-tools">
        <button data-tool="rock2">Big rock</button>
        <button data-tool="rock1">Small rock</button>
        <button data-tool="river">River</button>
        <button data-tool="mountain">Mountain</button>
        <button data-tool="forest">Forest</button>
        <button data-tool="erase">Erase</button>
        <button data-tool="entry">Entry gate</button>
        <button data-tool="exit">Exit gate</button>
        <span class="ed-hint" id="ed-hint"></span>
      </div>
      <canvas id="ed-canvas"></canvas>
      <div class="actions">
        <button id="ed-play" class="primary">Play</button>
        <button id="ed-save">Save</button>
        <button id="ed-share">Copy share link</button>
        <button id="ed-clear">Clear terrain</button>
        <button id="ed-back">Back</button>
      </div>
    </div>`;
  const canvas = root.querySelector<HTMLCanvasElement>('#ed-canvas')!;
  const g = canvas.getContext('2d')!;
  const hint = root.querySelector<HTMLElement>('#ed-hint')!;
  let scale = 1;

  const layout = () => {
    const maxW = Math.min(980, window.innerWidth - 80);
    const maxH = window.innerHeight - 260;
    scale = Math.max(2, Math.floor(Math.min(maxW / def.cols, maxH / def.rows)));
    canvas.width = def.cols * scale;
    canvas.height = def.rows * scale;
  };

  const sync = () => {
    const n = Math.min(entries.length, exits.length);
    def.routes = Array.from({ length: n }, (_, k) => ({ entry: entries[k], exit: exits[k] }));
    def.rocks = def.rockList!.length;
    if (cells.some((t) => t)) def.paint = encodePaint(cells);
    else delete def.paint;
  };

  const gateCells = (gt: Gate): [number, number][] => {
    const out: [number, number][] = [];
    for (let k = gt.from; k <= gt.to; k++) {
      for (let d = 0; d < 2; d++) {
        if (gt.side === 'L') out.push([d, k]);
        else if (gt.side === 'R') out.push([def.cols - 1 - d, k]);
        else if (gt.side === 'T') out.push([k, d]);
        else out.push([k, def.rows - 1 - d]);
      }
    }
    return out;
  };

  const draw = () => {
    g.fillStyle = '#3b4728';
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.strokeStyle = 'rgba(0,0,0,0.12)';
    g.lineWidth = 1;
    for (let c = 0; c <= def.cols; c += 2) {
      g.beginPath();
      g.moveTo(c * scale + 0.5, 0);
      g.lineTo(c * scale + 0.5, canvas.height);
      g.stroke();
    }
    for (let r = 0; r <= def.rows; r += 2) {
      g.beginPath();
      g.moveTo(0, r * scale + 0.5);
      g.lineTo(canvas.width, r * scale + 0.5);
      g.stroke();
    }
    for (let i = 0; i < cells.length; i++) {
      if (!cells[i]) continue;
      g.fillStyle = cells[i] === T_WATER ? '#2f6a86' : cells[i] === T_TREE ? '#2c5a1c' : '#6e6454';
      g.fillRect((i % def.cols) * scale, Math.floor(i / def.cols) * scale, scale, scale);
    }
    for (const k of def.rockList!) {
      g.fillStyle = '#8a8478';
      g.fillRect(k.c * scale, k.r * scale, k.s * scale, k.s * scale);
    }
    const label = (gt: Gate, text: string, color: string) => {
      g.fillStyle = color;
      for (const [c, r] of gateCells(gt)) g.fillRect(c * scale, r * scale, scale, scale);
      const [c, r] = gateCells(gt)[GATE_W];
      g.fillStyle = '#fff';
      g.font = `bold ${Math.max(10, scale * 2)}px sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const ox = gt.side === 'L' ? 3 : gt.side === 'R' ? -3 : 0;
      const oy = gt.side === 'T' ? 3 : gt.side === 'B' ? -3 : 0;
      g.fillText(text, (c + 0.5 + ox) * scale, (r + 0.5 + oy) * scale);
    };
    entries.forEach((gt, k) => label(gt, `IN ${k + 1}`, '#3a9a4a'));
    exits.forEach((gt, k) => label(gt, `OUT ${k + 1}`, '#b0402a'));
    root.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === tool));
    const unpaired = entries.length !== exits.length;
    hint.textContent = unpaired
      ? `Every entry needs an exit (${entries.length} in, ${exits.length} out).`
      : tool === 'entry' || tool === 'exit' ? 'Click on an edge to add a gate; Erase removes one.'
        : `${def.rockList!.length} rocks · ${cells.filter((t) => t === T_WATER).length} water · ${cells.filter((t) => t === T_MOUNT).length} mountain · ${cells.filter((t) => t === T_TREE).length} forest cells · ${def.routes.length} route${def.routes.length === 1 ? '' : 's'}. Drag to paint.`;
  };

  const cellAt = (e: PointerEvent): [number, number] => {
    const r = canvas.getBoundingClientRect();
    return [Math.floor(((e.clientX - r.left) / r.width) * def.cols), Math.floor(((e.clientY - r.top) / r.height) * def.rows)];
  };

  const inGate = (c: number, r: number) => [...entries, ...exits].some((gt) => gateCells(gt).some(([x, y]) => x === c && y === r));

  const onTerrain = (c: number, r: number, s: number) => {
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) if (cells[(r + dy) * def.cols + c + dx]) return true;
    return false;
  };
  const brush = (c: number, r: number, t: number) => {
    for (let y = Math.floor(r - BRUSH); y <= r + BRUSH; y++) {
      for (let x = Math.floor(c - BRUSH); x <= c + BRUSH; x++) {
        if (x < 0 || y < 0 || x >= def.cols || y >= def.rows || Math.hypot(x - c, y - r) > BRUSH || inGate(x, y)) continue;
        cells[y * def.cols + x] = t;
      }
    }
    // rocks under fresh water or mountain are gone
    if (t) def.rockList = def.rockList!.filter((k) => !onTerrain(k.c, k.r, k.s));
  };

  const paint = (c: number, r: number) => {
    if (tool === 'river' || tool === 'mountain' || tool === 'forest') {
      brush(c, r, tool === 'river' ? T_WATER : tool === 'forest' ? T_TREE : T_MOUNT);
    } else if (tool === 'rock1' || tool === 'rock2') {
      const s = tool === 'rock2' ? 2 : 1;
      if (c < 2 || r < 1 || c + s > def.cols - 2 || r + s > def.rows - 1) return;
      const overlaps = def.rockList!.some((k) => c < k.c + k.s && c + s > k.c && r < k.r + k.s && r + s > k.r);
      if (overlaps) return;
      for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) if (inGate(c + dx, r + dy)) return;
      if (onTerrain(c, r, s)) return;
      def.rockList!.push({ c, r, s });
    } else if (tool === 'erase') {
      brush(c, r, 0);
      def.rockList = def.rockList!.filter((k) => !(c >= k.c && c < k.c + k.s && r >= k.r && r < k.r + k.s));
      for (const list of [entries, exits]) {
        const i = list.findIndex((gt) => gateCells(gt).some(([x, y]) => x === c && y === r));
        if (i >= 0) list.splice(i, 1);
      }
    }
    sync();
    draw();
  };

  const addGate = (c: number, r: number) => {
    // nearest edge decides the side
    const d = { L: c, R: def.cols - 1 - c, T: r, B: def.rows - 1 - r };
    const side = (Object.keys(d) as Side[]).reduce((a, b) => (d[b] < d[a] ? b : a));
    const along = side === 'L' || side === 'R' ? r : c;
    const len = side === 'L' || side === 'R' ? def.rows : def.cols;
    const from = Math.max(2, Math.min(len - 2 - GATE_W, along - 1));
    const gt: Gate = { side, from, to: from + GATE_W - 1 };
    const clash = [...entries, ...exits].some((o) => o.side === side && from <= o.to + 2 && gt.to >= o.from - 2);
    if (clash || entries.length + exits.length >= 6 + (tool === 'entry' ? 0 : 1)) return;
    // gates clear any rocks and terrain under them
    const under = gateCells(gt);
    def.rockList = def.rockList!.filter((k) => !under.some(([x, y]) => x >= k.c && x < k.c + k.s && y >= k.r && y < k.r + k.s));
    for (const [x, y] of under) cells[y * def.cols + x] = 0;
    (tool === 'entry' ? entries : exits).push(gt);
    sync();
    draw();
  };

  let down = false;
  canvas.addEventListener('pointerdown', (e) => {
    const [c, r] = cellAt(e);
    if (tool === 'entry' || tool === 'exit') return addGate(c, r);
    down = true;
    canvas.setPointerCapture(e.pointerId);
    paint(c, r);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (down) paint(...cellAt(e));
  });
  canvas.addEventListener('pointerup', () => (down = false));
  root.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((b) => (b.onclick = () => {
    tool = b.dataset.tool as Tool;
    draw();
  }));
  root.querySelector<HTMLInputElement>('#ed-name')!.oninput = (e) => (def.name = (e.target as HTMLInputElement).value.trim() || 'My Map');
  root.querySelector<HTMLSelectElement>('#ed-size')!.onchange = (e) => {
    const [c, r] = (e.target as HTMLSelectElement).value.split('x').map(Number);
    const fresh = blankMap(c, r);
    def.cols = c;
    def.rows = r;
    def.rockList = [];
    cells = new Uint8Array(c * r);
    entries.splice(0, entries.length, fresh.routes[0].entry);
    exits.splice(0, exits.length, fresh.routes[0].exit);
    sync();
    layout();
    draw();
  };
  const ready = (): MapDef | null => {
    sync();
    if (!def.routes.length || entries.length !== exits.length) {
      hint.textContent = 'Add at least one entry and one exit, and pair every entry with an exit.';
      return null;
    }
    return structuredClone(def);
  };
  root.querySelector<HTMLButtonElement>('#ed-play')!.onclick = () => {
    const d = ready();
    if (d) host.play(d);
  };
  root.querySelector<HTMLButtonElement>('#ed-save')!.onclick = () => {
    const d = ready();
    if (d) {
      host.save(d);
      hint.textContent = `Saved “${d.name}”. Find it under Custom maps.`;
    }
  };
  root.querySelector<HTMLButtonElement>('#ed-share')!.onclick = () => {
    const d = ready();
    if (d) host.share(d);
  };
  root.querySelector<HTMLButtonElement>('#ed-clear')!.onclick = () => {
    def.rockList = [];
    cells.fill(0);
    sync();
    draw();
  };
  root.querySelector<HTMLButtonElement>('#ed-back')!.onclick = () => host.back();
  sync();
  layout();
  draw();
}
