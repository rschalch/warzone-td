// Offline sample synthesis. Each sound effect is rendered once (in a worker, see sfx.worker.ts) as a few
// random variations, layering what makes real recordings sound real: a sharp transient, a filtered noise
// body, a pitch-dropping low thump, a brown-noise tail with flutter, debris crackle, saturation and
// baked-in outdoor echoes. DOM-free; randomness is cosmetic so Math.random is fine here.

export const SR = 44100;

type Buf = Float32Array;
type Shape = 'lp' | 'hp' | 'bp';

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const n = (s: number) => Math.max(1, Math.ceil(s * SR));

/** RBJ biquad; `bp` has a 0 dB peak. */
class Biquad {
  private b0 = 1; private b1 = 0; private b2 = 0; private a1 = 0; private a2 = 0;
  private x1 = 0; private x2 = 0; private y1 = 0; private y2 = 0;
  constructor(private shape: Shape, f: number, private q = 0.707) {
    this.set(f);
  }
  set(f: number): void {
    const w = (2 * Math.PI * Math.min(Math.max(f, 10), SR * 0.45)) / SR;
    const cs = Math.cos(w);
    const al = Math.sin(w) / (2 * this.q);
    const a0 = 1 + al;
    let b0: number, b1: number, b2: number;
    if (this.shape === 'lp') [b0, b1, b2] = [(1 - cs) / 2, 1 - cs, (1 - cs) / 2];
    else if (this.shape === 'hp') [b0, b1, b2] = [(1 + cs) / 2, -(1 + cs), (1 + cs) / 2];
    else [b0, b1, b2] = [al, 0, -al];
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0;
    this.a1 = (-2 * cs) / a0; this.a2 = (1 - al) / a0;
  }
  run(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

/** Attack (linear) then exponential decay with time constant `decay`. */
const ad = (t: number, attack: number, decay: number) => (t < attack ? t / attack : Math.exp(-(t - attack) / decay));

/** A slow random wobble in [0, 1], new target every 1/rate s, linearly interpolated. */
function wobble(rate: number): (i: number) => number {
  const per = Math.max(1, Math.round(SR / rate));
  let a = Math.random();
  let b = Math.random();
  return (i) => {
    const k = i % per;
    if (k === 0 && i > 0) { a = b; b = Math.random(); }
    return a + (b - a) * (k / per);
  };
}

interface NoiseOpts {
  color?: 'white' | 'pink' | 'brown';
  attack?: number;
  decay?: number;
  shape?: Shape;
  f0: number;
  f1?: number;
  /** Time constant of the f0 → f1 cutoff glide. */
  fTau?: number;
  q?: number;
  gain?: number;
  /** Random amplitude flutter: rate (Hz) and depth (0..1). */
  flutter?: [number, number];
  /** Custom amplitude envelope (replaces attack/decay). */
  env?: (t: number) => number;
}

function noise(dur: number, o: NoiseOpts): Buf {
  const out = new Float32Array(n(dur));
  const f = new Biquad(o.shape ?? 'lp', o.f0, o.q ?? 0.707);
  const f1 = o.f1 ?? o.f0;
  const fTau = o.fTau ?? dur / 3;
  const attack = o.attack ?? 0.001;
  const gain = o.gain ?? 1;
  const fl = o.flutter ? wobble(o.flutter[0]) : null;
  let b0 = 0, b1 = 0, b2 = 0, br = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    if ((i & 15) === 0 && f1 !== o.f0) f.set(f1 + (o.f0 - f1) * Math.exp(-t / fTau));
    let w = Math.random() * 2 - 1;
    if (o.color === 'pink') {
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      w = (b0 + b1 + b2 + w * 0.1848) * 0.25;
    } else if (o.color === 'brown') {
      br = (br + 0.02 * w) / 1.02;
      w = br * 3.5;
    }
    let a = o.env ? o.env(t) : ad(t, attack, o.decay ?? dur / 3);
    if (fl) a *= 1 - o.flutter![1] * fl(i);
    out[i] = f.run(w) * a * gain;
  }
  return out;
}

type Wave = 'sine' | 'saw' | 'square';

interface ToneOpts {
  wave?: Wave;
  f0?: number;
  f1?: number;
  fTau?: number;
  attack?: number;
  decay?: number;
  gain?: number;
  lp?: number;
  env?: (t: number) => number;
  /** Frequency as a function of time (replaces f0/f1). */
  freq?: (t: number) => number;
}

function tone(dur: number, o: ToneOpts): Buf {
  const out = new Float32Array(n(dur));
  const f0 = o.f0 ?? 440;
  const f1 = o.f1 ?? f0;
  const fTau = o.fTau ?? dur / 3;
  const lp = o.lp ? new Biquad('lp', o.lp) : null;
  const gain = o.gain ?? 1;
  let ph = Math.random();
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const fr = o.freq ? o.freq(t) : f1 + (f0 - f1) * Math.exp(-t / fTau);
    ph += fr / SR;
    ph -= Math.floor(ph);
    let v = o.wave === 'saw' ? 2 * ph - 1 : o.wave === 'square' ? (ph < 0.5 ? 1 : -1) : Math.sin(2 * Math.PI * ph);
    if (lp) v = lp.run(v);
    out[i] = v * (o.env ? o.env(t) : ad(t, o.attack ?? 0.001, o.decay ?? dur / 3)) * gain;
  }
  return out;
}

/** Struck metal / glass: inharmonic decaying partials [freq, amp, tau]. */
function ring(dur: number, partials: [number, number, number][], gain = 1): Buf {
  const out = new Float32Array(n(dur));
  for (const [f, a, tau] of partials) {
    const ph = Math.random() * 6.28;
    const w = (2 * Math.PI * f) / SR;
    for (let i = 0; i < out.length; i++) out[i] += Math.sin(ph + w * i) * a * gain * Math.exp(-i / SR / tau) * Math.min(1, i / 20);
  }
  return out;
}

/** Sparse random impulses through a band-pass: debris, sparks, ice. */
function crackle(dur: number, o: { rate: number; decay: number; f: number; q?: number; gain?: number; attack?: number }): Buf {
  const out = new Float32Array(n(dur));
  const f = new Biquad('bp', o.f, o.q ?? 1.5);
  const p = o.rate / SR;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const x = Math.random() < p ? (Math.random() * 2 - 1) * 6 : 0;
    out[i] = f.run(x) * ad(t, o.attack ?? 0.001, o.decay) * (o.gain ?? 1);
  }
  return out;
}

/** Random on/off gating (electric arcs, data bursts), with ~0.3 ms smoothing. */
function gate(len: number, onMs: [number, number], offMs: [number, number]): Buf {
  const out = new Float32Array(len);
  let on = true;
  let left = 0;
  let v = 0;
  for (let i = 0; i < len; i++) {
    if (left-- <= 0) {
      on = !on;
      const [a, b] = on ? onMs : offMs;
      left = Math.round((rnd(a, b) * SR) / 1000);
    }
    v += ((on ? 1 : 0) - v) * 0.15;
    out[i] = v;
  }
  return out;
}

// ---------------------------------------------------------------- mixing

function mix(len: number, ...layers: [Buf, number?, number?][]): Buf {
  const out = new Float32Array(n(len));
  for (const [b, at = 0, g = 1] of layers) {
    const o = Math.round(at * SR);
    const m = Math.min(b.length, out.length - o);
    for (let i = 0; i < m; i++) out[o + i] += b[i] * g;
  }
  return out;
}

function mul(a: Buf, b: Buf): Buf {
  for (let i = 0; i < a.length; i++) a[i] *= b[i] ?? 0;
  return a;
}

function sat(b: Buf, drive: number): Buf {
  let peak = 0;
  for (let i = 0; i < b.length; i++) peak = Math.max(peak, Math.abs(b[i]));
  const k = drive / (peak || 1);
  const norm = 1 / Math.tanh(drive);
  for (let i = 0; i < b.length; i++) b[i] = Math.tanh(b[i] * k) * norm;
  return b;
}

/** Baked outdoor reflections: delayed, darker copies [delay s, gain]. */
function echoes(b: Buf, taps: [number, number][], lp = 1200): Buf {
  const src = b.slice();
  for (const [d, g] of taps) {
    const f = new Biquad('lp', lp);
    const f2 = new Biquad('hp', 120);
    const o = Math.round(d * SR);
    for (let i = 0; i + o < b.length; i++) b[i + o] += f2.run(f.run(src[i])) * g;
  }
  return b;
}

function finish(b: Buf, peak = 0.95, fade = 0.05): Buf {
  const hp = new Biquad('hp', 28);
  let m = 0;
  for (let i = 0; i < b.length; i++) {
    b[i] = hp.run(b[i]);
    m = Math.max(m, Math.abs(b[i]));
  }
  const k = m > 0 ? peak / m : 0;
  const fl = Math.min(b.length, n(fade));
  for (let i = 0; i < b.length; i++) {
    const tail = b.length - i;
    b[i] *= k * (tail < fl ? tail / fl : 1);
  }
  return b;
}

const reverse = (b: Buf) => b.reverse();

// ---------------------------------------------------------------- recipes

interface Gun {
  dur: number; crack: number; body: number; bodyF: number; thumpF: number; thump: number;
  tail: number; tailLp: number; drive: number; echo: [number, number][]; mech?: number;
}

function firearm(g: Gun): Buf {
  const v = rnd(0.9, 1.1);
  return finish(echoes(sat(mix(g.dur,
    [noise(g.crack * 6, { decay: g.crack, shape: 'hp', f0: 1500 * v, gain: 1 })],
    [noise(g.body * 6, { decay: g.body, f0: g.bodyF * v, f1: 350, fTau: g.body, gain: 1.1 })],
    [tone(g.body * 8, { f0: g.thumpF * 2.2 * v, f1: g.thumpF * 0.6, fTau: 0.02, decay: g.body * 1.6, gain: g.thump })],
    [noise(g.tail * 5, { color: 'brown', attack: 0.008, decay: g.tail, f0: g.tailLp, gain: 0.5, flutter: [30, 0.5] }), 0.003],
    [g.mech ? ring(0.08, [[rnd(2200, 2800), 1, 0.012], [rnd(4100, 4700), 0.6, 0.008], [rnd(6100, 6900), 0.4, 0.006]]) : new Float32Array(1), 0.04, g.mech ?? 0],
  ), g.drive), g.echo));
}

function explosion(size: number, dur = 0.8 + size): Buf {
  const s = Math.sqrt(size) * rnd(0.9, 1.1);
  return finish(echoes(sat(mix(dur,
    [noise(0.05, { decay: 0.004 * s, shape: 'hp', f0: 900, gain: 0.8 })],
    [noise(0.6 * s, { decay: 0.07 * size, f0: 4500 / s, f1: 140, fTau: 0.08 * s, gain: 1.2 })],
    [tone(dur, { f0: 110 / s, f1: 32, fTau: 0.06 * s, decay: 0.13 * size, gain: 1.2 })],
    [noise(dur, { color: 'brown', attack: 0.015, decay: 0.3 * size, f0: 600 / s, f1: 250 / s, gain: 1.1, flutter: [14, 0.6] })],
    [crackle(dur, { rate: 70, decay: 0.22 * size, f: rnd(2200, 3600), gain: 0.35, attack: 0.04 }), 0.03],
  ), 2.6), [[0.25 * s, 0.25], [0.6 * s, 0.12]], 600));
}

function rocket(dur: number, f0: number, f1: number, roar: number, pop: number): Buf {
  return finish(sat(mix(dur,
    [tone(0.1, { f0: pop * 2.5, f1: pop, fTau: 0.02, decay: 0.03, gain: 0.8 })],
    [noise(0.05, { decay: 0.012, f0: 3000, gain: 0.7 })],
    [noise(dur, { attack: 0.04, decay: roar, shape: 'bp', f0, f1, fTau: roar, q: 0.9, gain: 1, flutter: [40, 0.35] }), 0.01],
    [noise(dur, { color: 'brown', attack: 0.02, decay: roar * 1.1, f0: 900, gain: 1.2, flutter: [35, 0.45] })],
  ), 1.6));
}

/** A drum: pitched membrane thump + stick/skin noise + shell resonance. */
function drum(f0: number, f1: number, decay: number, skin: number, dur: number): Buf {
  return finish(sat(mix(dur,
    [tone(dur, { f0, f1, fTau: 0.03, decay, gain: 1 })],
    [noise(0.2, { decay: 0.02, f0: skin, gain: 0.5 })],
    [noise(dur, { color: 'brown', decay: decay * 0.7, f0: f1 * 4, gain: 0.5 })],
  ), 1.3), 0.95, 0.2);
}

export const RECIPES: Record<string, { variants: number; render: () => Buf }> = {
  gun: { variants: 4, render: () => firearm({ dur: 0.6, crack: 0.005, body: 0.025, bodyF: 6000, thumpF: 120, thump: 0.6, tail: 0.1, tailLp: 1400, drive: 2.5, echo: [[0.11, 0.16], [0.24, 0.07]], mech: 0.08 }) },
  gatling: { variants: 4, render: () => firearm({ dur: 0.3, crack: 0.003, body: 0.014, bodyF: 7000, thumpF: 150, thump: 0.45, tail: 0.05, tailLp: 1800, drive: 3, echo: [[0.09, 0.1]] }) },
  bunker: { variants: 3, render: () => firearm({ dur: 0.8, crack: 0.006, body: 0.04, bodyF: 4500, thumpF: 90, thump: 0.9, tail: 0.16, tailLp: 1100, drive: 3, echo: [[0.13, 0.2], [0.3, 0.08]], mech: 0.12 }) },
  sniper: { variants: 2, render: () => firearm({ dur: 1.6, crack: 0.008, body: 0.05, bodyF: 7000, thumpF: 100, thump: 0.8, tail: 0.25, tailLp: 1000, drive: 2, echo: [[0.21, 0.32], [0.47, 0.18], [0.85, 0.09]], mech: 0.1 }) },
  flak: { variants: 3, render: () => firearm({ dur: 1.0, crack: 0.004, body: 0.06, bodyF: 3000, thumpF: 70, thump: 1, tail: 0.25, tailLp: 700, drive: 2.5, echo: [[0.18, 0.2], [0.4, 0.1]], mech: 0.1 }) },
  cannon: { variants: 3, render: () => firearm({ dur: 2.0, crack: 0.006, body: 0.12, bodyF: 3500, thumpF: 55, thump: 1.2, tail: 0.5, tailLp: 600, drive: 3, echo: [[0.3, 0.3], [0.7, 0.15]], mech: 0.06 }) },
  arty: { variants: 2, render: () => firearm({ dur: 3.0, crack: 0.01, body: 0.18, bodyF: 2500, thumpF: 45, thump: 1.3, tail: 0.9, tailLp: 450, drive: 3, echo: [[0.4, 0.35], [0.9, 0.2], [1.5, 0.1]] }) },

  // ---- WW2 weapons
  /** MG-42: one short, sharp shot; fired ten times a second it becomes the famous tearing rip. */
  mg42: { variants: 4, render: () => firearm({ dur: 0.25, crack: 0.002, body: 0.008, bodyF: 8000, thumpF: 160, thump: 0.4, tail: 0.04, tailLp: 2000, drive: 3.5, echo: [[0.08, 0.08]] }) },
  flak38: { variants: 3, render: () => firearm({ dur: 0.6, crack: 0.004, body: 0.03, bodyF: 4500, thumpF: 90, thump: 0.8, tail: 0.12, tailLp: 1100, drive: 3, echo: [[0.12, 0.15], [0.28, 0.06]], mech: 0.06 }) },
  /** High-velocity anti-tank guns: a whip-crack, a deep punch and the breech clanging open. */
  pak40: { variants: 3, render: () => firearm({ dur: 2.2, crack: 0.004, body: 0.08, bodyF: 5000, thumpF: 60, thump: 1.3, tail: 0.6, tailLp: 700, drive: 3.2, echo: [[0.35, 0.3], [0.8, 0.15]], mech: 0.1 }) },
  flak88: { variants: 3, render: () => firearm({ dur: 2.8, crack: 0.005, body: 0.12, bodyF: 4000, thumpF: 48, thump: 1.4, tail: 0.8, tailLp: 550, drive: 3.2, echo: [[0.4, 0.35], [1.0, 0.18]], mech: 0.12 }) },
  tiger: { variants: 2, render: () => firearm({ dur: 2.8, crack: 0.005, body: 0.13, bodyF: 3600, thumpF: 44, thump: 1.5, tail: 0.85, tailLp: 520, drive: 3.4, echo: [[0.42, 0.33], [1.05, 0.16]], mech: 0.14 }) },
  schreck: { variants: 3, render: () => rocket(0.9, 800, 2200, 0.25, 70) },
  // ---- Soviet return fire
  /** Mosin-Nagant: a single flat crack from further off. */
  mosin: { variants: 3, render: () => firearm({ dur: 0.9, crack: 0.006, body: 0.03, bodyF: 6500, thumpF: 110, thump: 0.6, tail: 0.18, tailLp: 1200, drive: 2.2, echo: [[0.16, 0.2], [0.36, 0.08]], mech: 0.06 }) },
  /** PPSh-41 and the DT machine gun: fast, light bursts. */
  ppsh: { variants: 4, render: () => firearm({ dur: 0.22, crack: 0.002, body: 0.007, bodyF: 7000, thumpF: 180, thump: 0.3, tail: 0.04, tailLp: 2200, drive: 3, echo: [[0.07, 0.07]] }) },
  dt: { variants: 3, render: () => firearm({ dur: 0.3, crack: 0.003, body: 0.01, bodyF: 6000, thumpF: 140, thump: 0.45, tail: 0.06, tailLp: 1700, drive: 3, echo: [[0.09, 0.09]] }) },
  /** 76 mm F-34 / 85 mm tank guns: a heavy, lower bark than the German high-velocity guns. */
  f34: { variants: 3, render: () => firearm({ dur: 2.4, crack: 0.004, body: 0.11, bodyF: 3200, thumpF: 50, thump: 1.4, tail: 0.7, tailLp: 560, drive: 3.2, echo: [[0.38, 0.3], [0.9, 0.14]], mech: 0.12 }) },
  rs82: { variants: 2, render: () => rocket(1.1, 600, 1800, 0.3, 60) },
  /** Mortar: the hollow "thoonk" of a bomb leaving the tube. */
  mortar: {
    variants: 3,
    render: () => finish(echoes(mix(1.2,
      [tone(0.4, { f0: rnd(280, 320), f1: 110, fTau: 0.03, decay: 0.08, gain: 1 })],
      [noise(0.3, { decay: 0.03, f0: 2500, f1: 400, fTau: 0.03, gain: 0.6 })],
      [noise(1, { color: 'brown', decay: 0.25, f0: 500, gain: 0.5 })],
    ), [[0.2, 0.2], [0.5, 0.1]])),
  },
  /** Nebelwerfer: six rockets in quick succession, each a rising, moaning screech. */
  nebel: {
    variants: 2,
    render: () => {
      const layers: [Buf, number?, number?][] = [];
      for (let k = 0; k < 6; k++) {
        const f = rnd(420, 560);
        const scream = tone(1.4, {
          wave: 'saw', lp: 2600, gain: 0.5,
          freq: (t) => f + 900 * Math.min(1, t / 0.45) + 70 * Math.sin(2 * Math.PI * 7 * t),
          env: (t) => Math.min(1, t / 0.06) * Math.exp(-Math.max(0, t - 0.5) / 0.35),
        });
        layers.push([scream, k * 0.17 + rnd(0, 0.03)]);
        layers.push([noise(0.9, { attack: 0.01, decay: 0.3, shape: 'bp', f0: 900, f1: 2400, fTau: 0.3, q: 1.2, gain: 0.7, flutter: [30, 0.4] }), k * 0.17]);
      }
      layers.push([noise(2.5, { color: 'brown', attack: 0.05, decay: 0.8, f0: 700, gain: 0.8, flutter: [20, 0.4] })]);
      return finish(echoes(sat(mix(2.8, ...layers), 1.6), [[0.3, 0.2], [0.7, 0.1]]));
    },
  },
  /**
   * Katyusha ("Stalin's organ"): sixteen rockets rippling off the rails in under three seconds, each
   * a rushing roar with a howl that drops as it climbs away; together a long, organ-like moan.
   */
  katyusha: {
    variants: 2,
    render: () => {
      const layers: [Buf, number?, number?][] = [];
      for (let k = 0; k < 16; k++) {
        const at = k * 0.16 + rnd(0, 0.04);
        const f = rnd(300, 420);
        layers.push([tone(1.3, {
          wave: 'saw', lp: 1900, gain: 0.32,
          freq: (t) => f + 520 * Math.exp(-t / 0.5) + 40 * Math.sin(2 * Math.PI * 9 * t),
          env: (t) => Math.min(1, t / 0.04) * Math.exp(-t / 0.55),
        }), at]);
        layers.push([noise(1.1, { attack: 0.01, decay: 0.35, shape: 'bp', f0: 2600, f1: 700, fTau: 0.4, q: 1, gain: 0.8, flutter: [36, 0.45] }), at]);
        layers.push([tone(0.12, { f0: 140, f1: 60, fTau: 0.03, decay: 0.05, gain: 0.5 }), at]);
      }
      layers.push([noise(3.6, { color: 'brown', attack: 0.1, decay: 1.4, f0: 600, gain: 0.9, flutter: [22, 0.4] })]);
      return finish(echoes(sat(mix(4.2, ...layers), 1.5), [[0.35, 0.22], [0.8, 0.12]]));
    },
  },
  /** V-2 lift-off: ignition bang, then a long tearing roar that climbs and fades into the sky. */
  v2: {
    variants: 1,
    render: () => finish(sat(mix(5,
      [tone(0.3, { f0: 90, f1: 40, fTau: 0.08, decay: 0.12, gain: 1 })],
      [noise(4.6, { attack: 0.4, decay: 1.6, shape: 'bp', f0: 400, f1: 1600, fTau: 2.5, q: 0.7, gain: 1, flutter: [45, 0.5] }), 0.1],
      [noise(4.8, { color: 'brown', attack: 0.3, decay: 1.8, f0: 300, gain: 1.4, flutter: [30, 0.5] }), 0.05],
    ), 1.8)),
  },
  /** Ju 87 dive: the "Jericho trumpet" siren wailing up as it dives, over the engine. */
  stuka: {
    variants: 1,
    render: () => {
      const swell = (t: number) => Math.min(1, t / 0.4) * Math.exp(-Math.max(0, t - 2.2) / 0.3);
      return finish(sat(mix(3,
        [tone(2.8, { wave: 'saw', lp: 1800, gain: 0.55, freq: (t) => 420 + 380 * Math.min(1, t / 2.2) + 12 * Math.sin(2 * Math.PI * 23 * t), env: swell })],
        [tone(2.8, { wave: 'square', lp: 1400, gain: 0.25, freq: (t) => 630 + 570 * Math.min(1, t / 2.2), env: swell })],
        [noise(3, { color: 'brown', env: (t) => swell(t) * 0.9, f0: 400, gain: 1, flutter: [28, 0.5] })],
      ), 1.4));
    },
  },
  ricochet: {
    variants: 3,
    render: () => finish(mix(0.6,
      [noise(0.04, { decay: 0.004, shape: 'hp', f0: 3000, gain: 0.8 })],
      [tone(0.5, { f0: rnd(3000, 3800), f1: rnd(1400, 1900), fTau: 0.12, decay: 0.16, gain: 0.45 })],
    )),
  },

  boom0: { variants: 3, render: () => explosion(0.8) },
  boom1: { variants: 3, render: () => explosion(1.5) },
  boom2: { variants: 3, render: () => explosion(2.3) },
  bigboom: { variants: 3, render: () => explosion(3.4) },
  /** An emplacement blown apart: a long, heavy blast. */
  wreck: { variants: 2, render: () => explosion(4.2) },
  nuke: {
    variants: 1,
    render: () => finish(echoes(sat(mix(7,
      [explosion(5, 4)],
      [tone(5, { f0: 45, f1: 18, fTau: 1, attack: 0.05, decay: 1.6, gain: 1.4 })],
      [noise(7, { color: 'brown', attack: 0.3, decay: 2.2, f0: 400, f1: 150, gain: 1.6, flutter: [5, 0.7] }), 0.1],
      [crackle(5, { rate: 40, decay: 1.5, f: 1800, gain: 0.4, attack: 0.3 }), 0.4],
    ), 2), [[0.9, 0.3], [2.1, 0.18]], 400)),
  },

  missile: { variants: 3, render: () => rocket(1.2, 500, 2600, 0.35, 90) },
  hive: { variants: 4, render: () => rocket(0.5, 1500, 4200, 0.1, 180) },
  nukeLaunch: {
    variants: 1,
    render: () => finish(sat(mix(4,
      [tone(1, { f0: 90, f1: 30, fTau: 0.1, decay: 0.3, gain: 1 })],
      [noise(4, { color: 'brown', env: (t) => Math.min(1, t / 0.6) * Math.exp(-Math.max(0, t - 0.6) / 1.3), f0: 300, f1: 1400, fTau: 1.5, gain: 1.6, flutter: [25, 0.5] })],
      [noise(4, { env: (t) => Math.min(1, t / 0.8) * Math.exp(-Math.max(0, t - 0.8) / 1.1), shape: 'bp', f0: 200, f1: 1600, fTau: 1.2, q: 0.8, gain: 0.8 })],
    ), 1.8)),
  },

  laser: {
    variants: 3,
    render: () => {
      const f = rnd(1300, 1600);
      return finish(sat(mix(0.4,
        [tone(0.4, { wave: 'saw', f0: f, f1: f * 0.2, fTau: 0.06, decay: 0.09, lp: 3500, gain: 0.8, env: (t) => ad(t, 0.002, 0.09) * (0.6 + 0.4 * Math.sin(t * 2 * Math.PI * 95)) })],
        [tone(0.3, { f0: f * 2, f1: f * 0.5, fTau: 0.05, decay: 0.07, gain: 0.4 })],
        [noise(0.2, { decay: 0.05, shape: 'hp', f0: 4500, gain: 0.35 })],
      ), 2.2));
    },
  },
  tesla: {
    variants: 3,
    render: () => {
      const len = n(0.45);
      const g = gate(len, [0.4, 3], [0.3, 2.5]);
      return finish(sat(mix(0.45,
        [mul(noise(0.45, { decay: 0.16, shape: 'hp', f0: 1800, gain: 1 }), g)],
        [mul(tone(0.45, { wave: 'saw', f0: 120, decay: 0.18, lp: 3000, gain: 0.45 }), g)],
        [noise(0.05, { decay: 0.004, shape: 'hp', f0: 2000, gain: 0.9 })],
      ), 3));
    },
  },
  emp: {
    variants: 2,
    render: () => finish(sat(mix(1.1,
      [tone(1.1, { f0: 150, f1: 32, fTau: 0.1, decay: 0.3, gain: 1 })],
      [tone(0.6, { f0: 5000, f1: 700, fTau: 0.15, decay: 0.22, gain: 0.12 })],
      [crackle(1, { rate: 220, decay: 0.35, f: 4200, gain: 0.35 })],
      [noise(0.8, { decay: 0.25, f0: 700, f1: 200, gain: 0.7 })],
    ), 2)),
  },
  flame: {
    variants: 3,
    render: () => finish(sat(mix(0.75,
      [noise(0.75, { color: 'pink', attack: 0.05, decay: 0.28, f0: 1900, f1: 900, gain: 1.2, flutter: [14, 0.6] })],
      [noise(0.75, { color: 'brown', attack: 0.04, decay: 0.32, f0: 420, gain: 1, flutter: [9, 0.5] })],
      [noise(0.5, { attack: 0.02, decay: 0.15, shape: 'hp', f0: 5000, gain: 0.12 })],
      [crackle(0.7, { rate: 45, decay: 0.3, f: 2600, gain: 0.25 })],
    ), 1.5)),
  },
  napalm: {
    variants: 2,
    render: () => finish(sat(mix(0.8,
      [tone(0.25, { f0: 210, f1: 70, fTau: 0.02, decay: 0.05, gain: 0.9 })],
      [noise(0.1, { decay: 0.03, f0: 1500, gain: 0.6 })],
      [noise(0.7, { color: 'pink', attack: 0.06, decay: 0.22, f0: 1300, f1: 700, gain: 0.8, flutter: [16, 0.5] }), 0.03],
    ), 1.8)),
  },
  gas: {
    variants: 2,
    render: () => finish(sat(mix(0.8,
      [tone(0.25, { f0: 230, f1: 80, fTau: 0.02, decay: 0.05, gain: 0.9 })],
      [noise(0.1, { decay: 0.03, f0: 1500, gain: 0.6 })],
      [noise(0.7, { attack: 0.03, decay: 0.28, shape: 'bp', f0: 4500, f1: 3500, q: 0.7, gain: 0.5 }), 0.02],
    ), 1.6)),
  },
  acid: {
    variants: 3,
    render: () => {
      const bubbles: [Buf, number, number][] = [];
      for (let k = 0; k < 6; k++) {
        const f = rnd(350, 1000);
        bubbles.push([tone(0.05, { freq: (t) => f * (1 + t * 40), decay: 0.02, gain: 0.3 }), rnd(0.02, 0.2), 1]);
      }
      return finish(mix(0.45,
        [noise(0.2, { decay: 0.05, shape: 'bp', f0: 1300, q: 1, gain: 0.8, flutter: [60, 0.6] })],
        [noise(0.4, { attack: 0.04, decay: 0.15, shape: 'hp', f0: 4000, gain: 0.15 })],
        ...bubbles,
      ));
    },
  },
  cryo: {
    variants: 3,
    render: () => finish(mix(0.55,
      [noise(0.55, { attack: 0.01, decay: 0.18, shape: 'bp', f0: 6500, f1: 3500, q: 0.6, gain: 0.8 })],
      [crackle(0.5, { rate: 140, decay: 0.22, f: 7000, q: 3, gain: 0.4 })],
      [tone(0.15, { f0: 320, f1: 150, fTau: 0.03, decay: 0.03, gain: 0.3 })],
    )),
  },
  rail: {
    variants: 2,
    render: () => finish(echoes(sat(mix(1.1,
      [tone(0.13, { wave: 'saw', f0: 200, f1: 2600, fTau: 0.06, lp: 4000, env: (t) => Math.min(1, t / 0.12), decay: 1, gain: 0.25 })],
      [noise(0.1, { decay: 0.006, shape: 'hp', f0: 1500, gain: 1.2 }), 0.12],
      [noise(0.3, { decay: 0.04, f0: 6500, f1: 500, fTau: 0.04, gain: 1 }), 0.12],
      [tone(0.4, { f0: 160, f1: 50, fTau: 0.03, decay: 0.07, gain: 0.9 }), 0.12],
      [ring(0.5, [[1830, 1, 0.15], [2971, 0.7, 0.12], [4420, 0.5, 0.08]], 0.15), 0.12],
      [noise(0.4, { decay: 0.12, shape: 'hp', f0: 5000, gain: 0.25 }), 0.12],
    ), 2.2), [[0.32, 0.18], [0.6, 0.08]])),
  },
  gravity: {
    variants: 2,
    render: () => finish(mix(0.9,
      [tone(0.9, { freq: (t) => 60 * (1 + 0.08 * Math.sin(t * 40)) * (1 - t * 0.4), attack: 0.06, decay: 0.3, gain: 1 })],
      [noise(0.9, { color: 'brown', attack: 0.05, decay: 0.3, f0: 260, gain: 0.8 })],
      [tone(0.9, { f0: 140, decay: 0.3, attack: 0.05, gain: 0.25, env: (t) => ad(t, 0.05, 0.3) * (0.5 + 0.5 * Math.sin(t * 50)) })],
    )),
  },
  repulsor: {
    variants: 2,
    render: () => finish(sat(mix(0.6,
      [tone(0.6, { f0: 170, f1: 42, fTau: 0.05, decay: 0.12, gain: 1 })],
      [noise(0.4, { attack: 0.004, decay: 0.12, shape: 'bp', f0: 300, f1: 1600, fTau: 0.1, q: 0.8, gain: 0.7 })],
    ), 1.5)),
  },
  hacker: {
    variants: 3,
    render: () => {
      const len = n(0.35);
      const sh = new Float32Array(len);
      let v = 0;
      const hold = Math.round(SR / rnd(1800, 3000));
      for (let i = 0; i < len; i++) {
        if (i % hold === 0) v = Math.random() < 0.5 ? -1 : 1;
        sh[i] = v * ad(i / SR, 0.005, 0.12);
      }
      const f = new Biquad('bp', 2200, 0.8);
      for (let i = 0; i < len; i++) sh[i] = f.run(sh[i]);
      return finish(mix(0.35, [mul(sh, gate(len, [5, 25], [5, 20])), 0, 0.8]), 0.6);
    },
  },
  blackhole: {
    variants: 1,
    render: () => {
      const swell = (t: number) => (t < 1.4 ? Math.pow(t / 1.4, 2.5) : Math.max(0, 1 - (t - 1.4) / 0.04));
      return finish(sat(mix(2.6,
        [noise(1.5, { color: 'brown', env: swell, f0: 80, f1: 700, fTau: 0.7, gain: 1.4, flutter: [8, 0.4] })],
        [tone(1.5, { f0: 55, f1: 24, fTau: 0.8, env: swell, decay: 1, gain: 0.8 })],
        [reverse(noise(1.4, { decay: 0.4, shape: 'bp', f0: 1200, q: 0.8, gain: 0.5 }))],
        [tone(1, { f0: 90, f1: 28, fTau: 0.05, decay: 0.25, gain: 1.2 }), 1.44],
        [noise(1, { color: 'brown', decay: 0.4, f0: 300, gain: 0.8 }), 1.44],
      ), 1.8));
    },
  },
  orbital: {
    variants: 1,
    render: () => finish(echoes(sat(mix(2.8,
      [tone(0.56, { f0: 700, f1: 6000, fTau: 0.35, env: (t) => Math.min(1, t / 0.5) ** 2 * (t > 0.54 ? 0 : 1), decay: 1, gain: 0.25 })],
      [noise(0.1, { decay: 0.01, shape: 'hp', f0: 800, gain: 1.4 }), 0.55],
      [noise(2.2, { color: 'brown', decay: 0.7, f0: 700, f1: 250, gain: 1.4, flutter: [9, 0.6] }), 0.55],
      [tone(1.2, { f0: 80, f1: 25, fTau: 0.1, decay: 0.3, gain: 1.1 }), 0.55],
      [noise(1, { decay: 0.4, shape: 'hp', f0: 3000, gain: 0.25 }), 0.55],
    ), 2.4), [[1.0, 0.25], [1.6, 0.12]], 500)),
  },

  // ---- events and UI
  leak: {
    variants: 1,
    render: () => {
      const horn = () => tone(0.42, { wave: 'saw', freq: (t) => 220 + 160 * Math.min(1, t / 0.3), env: (t) => Math.min(1, t / 0.02) * (t > 0.38 ? Math.max(0, 1 - (t - 0.38) / 0.04) : 1), decay: 1, gain: 0.5 });
      const b = mix(1.0, [horn()], [horn(), 0.48]);
      const f = new Biquad('bp', 1000, 0.7);
      for (let i = 0; i < b.length; i++) b[i] = f.run(b[i]);
      return finish(sat(b, 4), 0.7);
    },
  },
  build: {
    variants: 3,
    render: () => finish(mix(0.8,
      [tone(0.4, { f0: 120, f1: 48, fTau: 0.03, decay: 0.08, gain: 1 })],
      [noise(0.3, { decay: 0.05, f0: 1300, gain: 0.6 })],
      [ring(0.6, [[rnd(360, 420), 1, 0.25], [rnd(990, 1080), 0.7, 0.15], [rnd(1650, 1780), 0.5, 0.1], [rnd(2550, 2750), 0.35, 0.07], [rnd(3800, 4100), 0.25, 0.05]], 0.3), 0.015],
      [ring(0.3, [[rnd(1900, 2300), 1, 0.05], [rnd(3300, 3700), 0.6, 0.04]], 0.15), rnd(0.12, 0.16)],
    )),
  },
  upgrade: {
    variants: 2,
    render: () => {
      const clicks: [Buf, number, number][] = [];
      for (let k = 0; k < 6; k++) clicks.push([noise(0.03, { decay: 0.004, shape: 'bp', f0: 3500, q: 2, gain: 1 }), k * 0.045, 0.5]);
      return finish(mix(0.9,
        ...clicks,
        [tone(0.4, { wave: 'saw', f0: 180, f1: 460, fTau: 0.2, lp: 1400, env: (t) => Math.min(1, t / 0.05) * (t > 0.3 ? Math.max(0, 1 - (t - 0.3) / 0.05) : 1), decay: 1, gain: 0.2 })],
        [tone(0.3, { f0: 140, f1: 60, fTau: 0.03, decay: 0.06, gain: 0.8 }), 0.33],
        [ring(0.5, [[rnd(500, 560), 1, 0.2], [rnd(1300, 1400), 0.6, 0.12], [rnd(2400, 2600), 0.4, 0.08]], 0.3), 0.33],
      ));
    },
  },
  sell: {
    variants: 2,
    render: () => finish(mix(0.8,
      [ring(0.3, [[rnd(1900, 2300), 1, 0.05], [rnd(3300, 3700), 0.6, 0.04]], 0.3)],
      [tone(0.4, { wave: 'saw', f0: 420, f1: 150, fTau: 0.15, lp: 1200, env: (t) => Math.min(1, t / 0.04) * Math.max(0, 1 - t / 0.35), decay: 1, gain: 0.2 }), 0.05],
      [tone(0.3, { f0: 110, f1: 50, fTau: 0.03, decay: 0.07, gain: 0.8 }), 0.38],
      [noise(0.2, { decay: 0.05, f0: 1000, gain: 0.5 }), 0.38],
    )),
  },
  coin: {
    variants: 2,
    render: () => finish(mix(0.45,
      [ring(0.3, [[rnd(4000, 4400), 1, 0.08], [rnd(5900, 6300), 0.6, 0.06], [rnd(8200, 8700), 0.4, 0.04]])],
      [ring(0.3, [[rnd(4300, 4700), 1, 0.1], [rnd(6200, 6600), 0.6, 0.07], [rnd(8800, 9300), 0.4, 0.05]]), 0.07],
    ), 0.5),
  },
  item: {
    variants: 1,
    render: () => finish(mix(0.6,
      [sat(noise(0.15, { attack: 0.002, decay: 0.06, shape: 'bp', f0: 2000, q: 3, gain: 1 }), 5), 0, 0.5],
      [tone(0.3, { f0: 130, f1: 60, fTau: 0.03, decay: 0.06, gain: 0.8 }), 0.12],
      [noise(0.2, { decay: 0.05, f0: 1500, gain: 0.5 }), 0.12],
    )),
  },
  deny: {
    variants: 1,
    render: () => finish(sat(mix(0.25, [tone(0.25, { wave: 'saw', f0: 95, lp: 900, env: (t) => Math.min(1, t / 0.005) * (t > 0.16 ? 0 : 1), decay: 1 })]), 3), 0.5),
  },
  click: {
    variants: 3,
    render: () => finish(mix(0.05,
      [noise(0.03, { decay: 0.0025, shape: 'bp', f0: rnd(3500, 4500), q: 1.5 })],
      [tone(0.03, { f0: 900, f1: 400, fTau: 0.004, decay: 0.006, gain: 0.3 })],
    ), 0.4, 0.01),
  },
  freeze: {
    variants: 2,
    render: () => finish(mix(0.55,
      [crackle(0.5, { rate: 320, decay: 0.3, f: 6500, q: 2, gain: 0.6 })],
      [tone(0.4, { wave: 'saw', f0: 90, lp: 400, decay: 0.2, gain: 0.2 })],
      [noise(0.4, { decay: 0.15, shape: 'hp', f0: 6000, gain: 0.25 })],
    ), 0.8),
  },
  shatter: {
    variants: 3,
    render: () => {
      const pings: [Buf, number, number][] = [];
      for (let k = 0; k < 14; k++) pings.push([ring(0.2, [[rnd(2500, 9000), 1, rnd(0.03, 0.12)]]), rnd(0, 0.12), rnd(0.1, 0.3)]);
      return finish(mix(0.4, [noise(0.1, { decay: 0.025, shape: 'hp', f0: 3000, gain: 0.6 })], ...pings), 0.7);
    },
  },
  hack: {
    variants: 2,
    render: () => {
      const len = n(0.35);
      return finish(mix(0.35,
        [mul(tone(0.35, { wave: 'square', f0: 1500, f1: 200, fTau: 0.12, lp: 3000, decay: 0.15, gain: 0.5 }), gate(len, [8, 30], [4, 15]))],
        [mul(noise(0.35, { decay: 0.12, shape: 'bp', f0: 1800, q: 1, gain: 0.6 }), gate(len, [2, 10], [3, 12]))],
      ), 0.6);
    },
  },
  swallow: {
    variants: 2,
    render: () => finish(mix(0.65,
      [noise(0.32, { color: 'brown', env: (t) => (t / 0.3) ** 2 * (t > 0.3 ? 0 : 1), f0: 150, f1: 900, fTau: 0.2, decay: 1, gain: 1.2 })],
      [tone(0.3, { f0: 100, f1: 35, fTau: 0.04, decay: 0.08, gain: 1 }), 0.3],
    )),
  },
  stun: {
    variants: 1,
    render: () => finish(echoes(mix(2.2,
      [noise(0.1, { decay: 0.006, shape: 'hp', f0: 1200, gain: 1.4 })],
      [noise(0.6, { decay: 0.08, f0: 6000, f1: 400, fTau: 0.05, gain: 1 })],
      [tone(0.5, { f0: 140, f1: 45, fTau: 0.03, decay: 0.1, gain: 0.8 })],
      [tone(2, { f0: 3800, attack: 0.05, decay: 0.9, gain: 0.07 }), 0.05],
    ), [[0.3, 0.2], [0.65, 0.1]])),
  },
  airstrike: {
    variants: 1,
    render: () => {
      const bell = (t: number) => Math.exp(-(((t - 1.7) / 0.55) ** 2));
      const fc = (t: number) => (t < 1.7 ? 700 + 1900 * (t / 1.7) ** 2 : 2600 - 2100 * Math.min(1, (t - 1.7) / 0.6));
      const jet = new Float32Array(n(3.5));
      const f = new Biquad('bp', 700, 0.9);
      for (let i = 0; i < jet.length; i++) {
        const t = i / SR;
        if ((i & 15) === 0) f.set(fc(t));
        jet[i] = f.run(Math.random() * 2 - 1) * bell(t);
      }
      return finish(mix(3.8,
        [sat(noise(0.18, { attack: 0.002, decay: 0.07, shape: 'bp', f0: 2000, q: 3 }), 5), 0, 0.35],
        [jet, 0.2, 1],
        [noise(3.5, { color: 'brown', env: bell, f0: 500, decay: 1, gain: 1.2, flutter: [20, 0.3] }), 0.2],
      ));
    },
  },

  // ---- music: drums for the soundtrack (tonal parts are played live by oscillators)
  m_taiko: { variants: 3, render: () => drum(rnd(105, 115), rnd(55, 60), 0.35, 1200, 1.4) },
  m_tom: { variants: 2, render: () => drum(rnd(170, 185), 105, 0.22, 1800, 0.9) },
  /** Orchestral bass drum (gran cassa): a deep, booming thud for the march. */
  m_kick: { variants: 3, render: () => drum(rnd(68, 74), rnd(40, 44), 0.42, 700, 1.3) },
  m_toml: { variants: 2, render: () => drum(rnd(125, 135), 78, 0.28, 1400, 0.9) },
  /** Military field snare: tight head, rattling wires. */
  m_field: {
    variants: 4,
    render: () => finish(sat(mix(0.4,
      [tone(0.12, { f0: 240, f1: 190, fTau: 0.015, decay: 0.03, gain: 0.6 })],
      [noise(0.02, { decay: 0.004, shape: 'hp', f0: 2500, gain: 1.2 })],
      [noise(0.4, { decay: rnd(0.09, 0.12), shape: 'bp', f0: rnd(4200, 5200), q: 0.7, gain: 0.9 })],
      [noise(0.25, { decay: 0.05, shape: 'bp', f0: 1800, q: 1, gain: 0.5 })],
    ), 1.8), 0.9, 0.05),
  },
  /** Anvil / metal clank for the heaviest moments. */
  m_anvil: {
    variants: 2,
    render: () => finish(mix(1.2,
      [ring(1.2, [[rnd(880, 940), 1, 0.35], [2410, 0.6, 0.22], [3970, 0.4, 0.15], [5820, 0.25, 0.1]])],
      [noise(0.05, { decay: 0.008, shape: 'hp', f0: 3000, gain: 1 })],
    ), 0.6, 0.02),
  },
  m_snare: {
    variants: 3,
    render: () => finish(mix(0.45,
      [tone(0.15, { f0: 200, f1: 175, fTau: 0.02, decay: 0.045, gain: 0.5 })],
      [noise(0.3, { decay: 0.08, shape: 'bp', f0: 3000, q: 0.6, gain: 1 })],
      [noise(0.45, { decay: 0.13, shape: 'hp', f0: 1500, gain: 0.35 })],
    ), 0.9, 0.1),
  },
  /** Timpani tuned to D2 (73.4 Hz); retuned by playback rate. */
  m_timp: {
    variants: 2,
    render: () => finish(mix(2.6,
      [ring(2.6, [[73.4, 1, 1.4], [110.4, 0.5, 0.9], [146.1, 0.35, 0.7], [179.3, 0.2, 0.45], [218.9, 0.12, 0.3]])],
      [tone(0.3, { f0: 90, f1: 73.4, fTau: 0.02, decay: 0.08, gain: 0.6 })],
      [noise(0.1, { decay: 0.015, f0: 1500, gain: 0.4 })],
    ), 0.95, 0.4),
  },
  /** Reverse cymbal: swells for exactly 12 sixteenths at 76 bpm into the next downbeat. */
  m_swell: {
    variants: 1,
    render: () => {
      const d = (12 * 60) / 76 / 4;
      const partials: [number, number, number][] = [];
      for (let k = 0; k < 14; k++) partials.push([rnd(3000, 9500), rnd(0.2, 0.6), rnd(0.6, 1.4)]);
      return finish(reverse(mix(d, [noise(d, { decay: 0.9, shape: 'hp', f0: 4000, gain: 1 })], [ring(d, partials, 0.15)])), 0.8, 0.005);
    },
  },
  /** Cinematic impact. */
  m_hit: {
    variants: 1,
    render: () => finish(sat(mix(3.2,
      [drum(90, 45, 0.5, 1000, 1.5)],
      [tone(3, { f0: 55, f1: 30, fTau: 0.3, decay: 1.1, gain: 1 })],
      [noise(3, { color: 'brown', decay: 1, f0: 320, gain: 0.8, flutter: [8, 0.4] })],
      [noise(0.3, { decay: 0.08, f0: 3000, gain: 0.5 })],
    ), 1.6), 0.95, 0.5),
  },
};
