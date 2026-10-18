// Procedural sound, no audio files. Effects are rendered once into sample banks by a worker (dsp.ts:
// layered transients, noise bodies, thumps, rumble tails, echoes) and played back with pitch jitter,
// panned and attenuated by where they happen relative to the camera, through a convolution reverb.
// The orchestral music (strings, brass, choir over taiko drums) is played live by oscillators.

import { settings, onSettings } from '../app/settings';
import { SR } from './dsp';

type Spatial = (x: number, y: number) => [gain: number, pan: number];

const MAX_VOICES = 32;

/** Minimum gap between two plays of the same sound (s). */
const THROTTLE: Record<string, number> = {
  gun: 0.04, gatling: 0.035, bunker: 0.05, cannon: 0.07, missile: 0.08, laser: 0.12, tesla: 0.08, emp: 0.15,
  flame: 0.15, napalm: 0.12, acid: 0.08, gas: 0.12, sniper: 0.06, rail: 0.1, flak: 0.06, arty: 0.12, cryo: 0.08,
  gravity: 0.3, repulsor: 0.15, hacker: 0.2, blackhole: 0.5, orbital: 0.4, nukeLaunch: 0.5, hive: 0.07,
  boom: 0.04, bigboom: 0.1, nuke: 0.5, leak: 0.8, wave: 1, build: 0.05, sell: 0.08, upgrade: 0.08,
  deny: 0.2, click: 0.03, level: 0.5, item: 0.2, freeze: 0.1, shatter: 0.08, hack: 0.2, swallow: 0.12,
  stun: 0.3, airstrike: 0.5, rally: 0.5, coin: 0.06, victory: 1, defeat: 1,
};

/** Mix level of each effect. */
const GAIN: Record<string, number> = {
  gun: 0.32, gatling: 0.26, bunker: 0.38, sniper: 0.6, flak: 0.42, cannon: 0.65, arty: 0.75,
  boom0: 0.4, boom1: 0.55, boom2: 0.7, bigboom: 0.85, nuke: 1,
  missile: 0.45, hive: 0.22, nukeLaunch: 0.8, laser: 0.22, tesla: 0.3, emp: 0.5, flame: 0.35, napalm: 0.4,
  gas: 0.35, acid: 0.3, cryo: 0.3, rail: 0.5, gravity: 0.5, repulsor: 0.45, hacker: 0.2, blackhole: 0.75,
  orbital: 0.8, leak: 0.38, build: 0.55, upgrade: 0.5, sell: 0.5, coin: 0.3, item: 0.45, deny: 0.35,
  click: 0.25, freeze: 0.35, shatter: 0.3, hack: 0.3, swallow: 0.45, stun: 0.6, airstrike: 0.7,
};

/** Reverb send per effect (distance adds more). */
const WET: Record<string, number> = { click: 0.03, deny: 0.05, coin: 0.15, build: 0.15, upgrade: 0.15, sell: 0.15, laser: 0.35, tesla: 0.3 };

/** Played live through the instrument synth rather than from a sample bank. */
const LIVE = new Set(['wave', 'level', 'rally', 'victory', 'defeat']);

// ---------------------------------------------------------------- the score
//
// D minor, 76 bpm, an 8-bar loop. Calm: string pad, sub, a lone violin line and a distant drum.
// As the fighting intensifies: spiccato low-string ostinato, taikos, snare, timpani, brass, choir.

const BPM = 76;
const STEP = 60 / BPM / 4;
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Per bar: bass note and pad voicing (MIDI). Dm Bb F C | Dm Bb Gm A */
const CHORDS: { bass: number; pad: number[] }[] = [
  { bass: 38, pad: [50, 53, 57, 62] },
  { bass: 34, pad: [50, 53, 58, 62] },
  { bass: 41, pad: [48, 53, 57, 60] },
  { bass: 36, pad: [48, 52, 55, 60] },
  { bass: 38, pad: [50, 53, 57, 62] },
  { bass: 34, pad: [50, 53, 58, 65] },
  { bass: 31, pad: [50, 55, 58, 62] },
  { bass: 33, pad: [49, 52, 57, 61] },
];
/** Violin line, two notes per bar. */
const MELODY = [[69, 69], [70, 65], [69, 72], [67, 64], [69, 74], [70, 74], [70, 67], [69, 73]];
/** Ostinato: semitones over the bass (an octave up), per 16th; accents fall 3+3+2. */
const OSTINATO = [0, 0, 0, 12, 0, 0, 12, 0, 0, 0, 0, 12, 0, 0, 7, 12];
const ACCENT = new Set([0, 3, 6, 8, 11, 14]);

interface Voice {
  wave?: OscillatorType;
  voices?: number;
  /** Detune spread across voices (cents). */
  spread?: number;
  attack: number;
  release: number;
  gain: number;
  /** Low-pass cutoff; with `peak`, it opens to `peak` over the attack then settles back. */
  cut: number;
  peak?: number;
  q?: number;
  /** Formant filters (choir) instead of the low-pass. */
  formants?: number[];
}

const STRINGS: Voice = { voices: 3, spread: 14, attack: 0.9, release: 1.6, gain: 0.05, cut: 900 };
const VIOLIN: Voice = { voices: 3, spread: 9, attack: 0.4, release: 1.2, gain: 0.04, cut: 3200 };
const SPICCATO: Voice = { voices: 2, spread: 8, attack: 0.006, release: 0.09, gain: 0.07, cut: 1400, q: 2 };
const BRASS: Voice = { voices: 3, spread: 7, attack: 0.09, release: 0.35, gain: 0.06, cut: 450, peak: 2600, q: 1.2 };
const CHOIR: Voice = { voices: 3, spread: 12, attack: 1.1, release: 1.8, gain: 0.07, cut: 0, formants: [750, 1150, 2600] };

export class Sound {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private sfxVerb!: GainNode;
  private musicBus!: GainNode;
  private banks = new Map<string, AudioBuffer[]>();
  private worker: Worker | null = null;
  private last = new Map<string, number>();
  private voices = 0;
  spatial: Spatial = () => [1, 0];
  // music
  private musicOn = false;
  private nextStep = 0;
  private step = 0;
  private timer = 0;
  private level = 0;
  /** 0 calm (menu/build) … 1 heavy fighting. */
  intensity = 0;

  constructor() {
    onSettings(() => this.applyVolumes());
    // browsers only start audio after a user gesture
    const unlock = () => {
      this.ensure();
      if (this.ctx?.state === 'suspended') void this.ctx.resume();
    };
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    // render the sample banks once startup (model baking) is out of the way
    setTimeout(() => this.renderBanks(), 1500);
  }

  private renderBanks(): void {
    if (this.worker) return;
    try {
      this.worker = new Worker(new URL('./sfx.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      return;
    }
    this.worker.onmessage = (e: MessageEvent<{ name: string; data: Float32Array[] }>) => {
      this.banks.set(e.data.name, e.data.data.map((d) => {
        const b = new AudioBuffer({ length: d.length, sampleRate: SR, numberOfChannels: 1 });
        b.copyToChannel(d as Float32Array<ArrayBuffer>, 0);
        return b;
      }));
    };
    this.worker.postMessage(0);
  }

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    this.renderBanks();
    try {
      const ctx = new AudioContext();
      this.ctx = ctx;
      // glue compression, then a brick-wall limiter
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.ratio.value = 4;
      comp.attack.value = 0.004;
      comp.release.value = 0.25;
      const lim = ctx.createDynamicsCompressor();
      lim.threshold.value = -3;
      lim.knee.value = 0;
      lim.ratio.value = 20;
      lim.attack.value = 0.001;
      lim.release.value = 0.1;
      this.master = ctx.createGain();
      this.sfx = ctx.createGain();
      this.musicBus = ctx.createGain();
      this.sfx.connect(this.master);
      this.musicBus.connect(this.master);
      this.master.connect(comp).connect(lim).connect(ctx.destination);
      // reverbs: a short open-air one for effects, a long hall for the score
      this.sfxVerb = ctx.createGain();
      const v1 = ctx.createConvolver();
      v1.buffer = this.impulse(1.8, 2600);
      this.sfxVerb.connect(v1).connect(this.sfx);
      const mv = ctx.createGain();
      mv.gain.value = 0.55;
      const v2 = ctx.createConvolver();
      v2.buffer = this.impulse(3.8, 4500);
      this.musicIn = ctx.createGain();
      this.musicIn.connect(this.musicBus);
      this.musicIn.connect(mv).connect(v2).connect(this.musicBus);
      this.applyVolumes();
      if (this.musicOn) this.startMusic();
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  private musicIn!: GainNode;

  /** Stereo reverb impulse: sparse early reflections, then decaying noise that darkens over time. */
  private impulse(dur: number, bright: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.round(dur * ctx.sampleRate);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / ctx.sampleRate;
        const cutoff = bright * Math.exp(-t * 2.2) + 300;
        const a = 1 - Math.exp((-2 * Math.PI * cutoff) / ctx.sampleRate);
        lp += ((Math.random() * 2 - 1) - lp) * a;
        d[i] = lp * Math.exp((-t * 6.9) / dur) * Math.min(1, t / 0.012);
      }
      for (let k = 0; k < 8; k++) {
        const i = Math.round((0.008 + Math.random() * 0.07) * ctx.sampleRate);
        d[i] += (Math.random() < 0.5 ? -1 : 1) * (0.5 - k * 0.04);
      }
    }
    return buf;
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    this.master.gain.value = settings.master;
    this.sfx.gain.value = settings.sfx;
    this.musicBus.gain.value = settings.music * 0.8;
  }

  // ---------------------------------------------------------------- building blocks

  /** A panned output with a reverb send. */
  private out(gain: number, pan: number, wet: number): GainNode {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.value = gain;
    if (pan !== 0 && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan * 0.8));
      g.connect(p).connect(this.sfx);
    } else g.connect(this.sfx);
    if (wet > 0) {
      const s = ctx.createGain();
      s.gain.value = wet;
      g.connect(s).connect(this.sfxVerb);
    }
    return g;
  }

  /** Plays a random variation of a sample bank. Returns false if it is not rendered yet. */
  private sample(dest: AudioNode, bank: string, t: number, gain = 1, rate = 1, track = true): boolean {
    const b = this.banks.get(bank);
    if (!b) return false;
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = b[Math.floor(Math.random() * b.length)];
    src.playbackRate.value = rate;
    let node: AudioNode = src;
    if (gain !== 1) {
      const g = ctx.createGain();
      g.gain.value = gain;
      node = src.connect(g);
    }
    node.connect(dest);
    src.start(t);
    if (track) {
      this.voices++;
      src.onended = () => this.voices--;
    }
    return true;
  }

  /** One instrument note: detuned oscillators through a filter and an ADSR-ish envelope. */
  private note(dest: AudioNode, t: number, dur: number, midi: number, v: Voice, gain = 1): void {
    const ctx = this.ctx!;
    const f = mtof(midi);
    const g = ctx.createGain();
    const peak = v.gain * gain;
    const a = Math.min(v.attack, dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + dur);
    g.gain.linearRampToValueAtTime(0, t + dur + v.release);
    g.connect(dest);
    let input: AudioNode;
    if (v.formants) {
      input = ctx.createGain();
      for (const [k, fr] of v.formants.entries()) {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = fr;
        bp.Q.value = 6;
        const fg = ctx.createGain();
        fg.gain.value = [3, 2.2, 0.8][k] ?? 1;
        input.connect(bp).connect(fg).connect(g);
      }
    } else {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = v.q ?? 0.6;
      lp.frequency.setValueAtTime(v.cut, t);
      if (v.peak) {
        lp.frequency.linearRampToValueAtTime(v.peak, t + a * 1.5);
        lp.frequency.linearRampToValueAtTime(v.cut * 1.8, t + a * 1.5 + 0.4);
      }
      lp.connect(g);
      input = lp;
    }
    const n = v.voices ?? 1;
    const end = t + dur + v.release + 0.05;
    for (let k = 0; k < n; k++) {
      const o = ctx.createOscillator();
      o.type = v.wave ?? 'sawtooth';
      o.frequency.value = f;
      o.detune.value = (n > 1 ? (v.spread ?? 0) * ((2 * k) / (n - 1) - 1) : 0) + (Math.random() - 0.5) * 4;
      o.connect(input);
      o.start(t + Math.random() * 0.01);
      o.stop(end);
    }
  }

  // ---------------------------------------------------------------- effects

  /** Plays a named effect; with a world position it is panned and attenuated by the camera. */
  play(name: string, x?: number, y?: number, size = 1): void {
    const ctx = this.ensure();
    if (!ctx || ctx.state !== 'running' || settings.master * settings.sfx <= 0) return;
    const now = ctx.currentTime;
    const gap = THROTTLE[name] ?? 0.05;
    if (now - (this.last.get(name) ?? -1) < gap) return;
    const big = name === 'nuke' || name === 'victory' || name === 'defeat' || name === 'wave' || name === 'leak';
    if (this.voices > MAX_VOICES && !big) return;
    const [gain, pan] = x === undefined ? [1, 0] : this.spatial(x, y!);
    if (gain < 0.03) return;
    this.last.set(name, now);
    const t = now + 0.005;
    if (LIVE.has(name)) {
      this.live(name, t, this.out(1, 0, 0.5));
      return;
    }
    const bank = name === 'boom' ? (size < 1.1 ? 'boom0' : size < 1.9 ? 'boom1' : 'boom2') : name;
    if (!this.banks.has(bank)) return;
    const wet = (WET[name] ?? 0.22) + (1 - gain) * 0.45;
    // far sounds are quieter but keep more of their reverb, like real distance
    this.sample(this.out(gain * (GAIN[bank] ?? 0.5), pan, wet), bank, t, 1, 0.94 + Math.random() * 0.12);
  }

  /** Musical stingers played on the instrument synth. */
  private live(name: string, t: number, o: AudioNode): void {
    switch (name) {
      case 'wave': // a low brass "braaam" over a cinematic impact
        this.sample(o, 'm_hit', t, 0.9);
        for (const m of [26, 38, 45, 50]) this.note(o, t, 1.4, m, { ...BRASS, voices: 4, spread: 16, attack: 0.25, release: 1.2, cut: 200, peak: 1600 }, 2);
        break;
      case 'level': // short heroic fanfare
        [62, 66, 69, 74].forEach((m, k) => this.note(o, t + k * 0.11, k === 3 ? 0.7 : 0.1, m, BRASS, 1.6));
        for (const m of [50, 57]) this.note(o, t + 0.33, 0.7, m, BRASS, 1.4);
        this.sample(o, 'm_timp', t + 0.33, 0.8);
        break;
      case 'rally': // bugle call
        [67, 72, 76, 79].forEach((m, k) => this.note(o, t + k * 0.16, k === 3 ? 0.6 : 0.12, m, { ...BRASS, voices: 2, cut: 700, peak: 3000 }, 1.8));
        break;
      case 'victory':
        this.sample(o, 'm_hit', t, 0.8);
        this.sample(o, 'm_timp', t, 1);
        [62, 66, 69, 74].forEach((m, k) => this.note(o, t + k * 0.28, 0.4, m, BRASS, 1.6));
        for (const m of [38, 50, 57, 62, 66, 69, 74, 78]) {
          this.note(o, t + 1.1, 2.6, m, STRINGS, 1.6);
          if (m < 70) this.note(o, t + 1.1, 2.4, m, BRASS, 1.1);
        }
        this.sample(o, 'm_timp', t + 1.1, 1);
        break;
      case 'defeat': // slow, dark descent in the low strings
        [[38, 50, 53, 57], [34, 50, 53, 58], [31, 46, 50, 55], [26, 38, 45, 50]].forEach((ch, k) => {
          for (const m of ch) this.note(o, t + k * 1.1, 1.1, m, { ...STRINGS, attack: 0.3, cut: 600 }, 1.8);
          this.sample(o, 'm_taiko', t + k * 1.1, 0.7, 0.8);
        });
        break;
    }
  }

  // ---------------------------------------------------------------- music

  setMusic(on: boolean): void {
    this.musicOn = on;
    if (on) this.startMusic();
    else this.stopMusic();
  }

  private startMusic(): void {
    const ctx = this.ctx;
    if (!ctx || this.timer) return;
    this.nextStep = ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 50);
  }

  private stopMusic(): void {
    clearInterval(this.timer);
    this.timer = 0;
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || settings.music <= 0 || !this.banks.has('m_taiko')) {
      if (ctx) this.nextStep = ctx.currentTime + 0.1;
      return;
    }
    const bus = this.musicIn;
    while (this.nextStep < ctx.currentTime + 0.25) {
      const t = this.nextStep;
      const s = this.step % 16;
      const bar = Math.floor(this.step / 16) % 8;
      // intensity follows the battle over a few seconds, so layers don't flicker in and out
      this.level += (this.intensity - this.level) * 0.03;
      const I = this.level;
      const ch = CHORDS[bar];
      const barDur = STEP * 16;

      if (s === 0) {
        for (const m of ch.pad) this.note(bus, t, barDur - 0.2, m, { ...STRINGS, cut: 700 + 1600 * I });
        this.note(bus, t, barDur - 0.2, ch.bass, { wave: 'sine', attack: 0.4, release: 1, gain: 0.16, cut: 400 });
        this.note(bus, t, barDur - 0.2, ch.bass + 12, { ...STRINGS, gain: 0.045 + 0.03 * I });
        if (I > 0.75) for (const m of ch.pad) this.note(bus, t, barDur - 0.3, m + 12, CHOIR, Math.min(1, (I - 0.75) * 5));
        if (I > 0.4 && bar % 4 === 0) this.sample(bus, 'm_timp', t, 0.7, mtof(ch.bass + 12) / 73.4, false);
        if (I > 0.7 && bar === 0) this.sample(bus, 'm_hit', t, 0.6, 1, false);
        if (I < 0.3 && bar % 2 === 0) this.sample(bus, 'm_taiko', t, 0.35, 0.85, false);
      }
      // the violin line fades out once the brass takes over
      if ((s === 0 || s === 8) && I < 0.85) this.note(bus, t, STEP * 7.5, MELODY[bar][s === 0 ? 0 : 1], VIOLIN, 1 - Math.max(0, I - 0.55) * 3);

      if (I > 0.2) {
        const sixteenths = I > 0.5;
        if (sixteenths || s % 2 === 0) {
          const amt = Math.min(1, (I - 0.2) * 3) * (ACCENT.has(s) ? 1.4 : 0.8);
          this.note(bus, t, STEP * 0.5, ch.bass + 12 + OSTINATO[s], { ...SPICCATO, cut: 900 + 2200 * I }, amt);
        }
      }
      if (I > 0.3) {
        const hits = I > 0.8 ? [0, 3, 6, 8, 10, 12, 14, 15] : I > 0.55 ? [0, 3, 6, 10, 12, 14] : [0, 6, 10];
        if (hits.includes(s)) this.sample(bus, s === 0 || s === 6 ? 'm_taiko' : s >= 14 ? 'm_tom' : 'm_taiko', t, (s === 0 ? 0.9 : 0.6) * Math.min(1, 0.5 + I), 1, false);
      }
      if (I > 0.5) {
        if (s === 4 || s === 12) this.sample(bus, 'm_snare', t, 0.45, 1, false);
        else if (I > 0.7 && (s === 13 || s === 15 || (bar === 7 && s > 8))) this.sample(bus, 'm_snare', t, 0.12 + (bar === 7 ? (s - 8) * 0.04 : 0), 1, false);
      }
      if (I > 0.6) {
        const brass = Math.min(1, (I - 0.6) * 4);
        const power = [ch.bass + 24, ch.bass + 31, ch.bass + 36];
        if (s === 0) for (const m of power) this.note(bus, t, STEP * 5, m, BRASS, brass);
        if (s === 6) for (const m of power) this.note(bus, t, STEP * 1.5, m, BRASS, brass * 0.8);
        if (s === 8) for (const m of power) this.note(bus, t, STEP * 7, m, BRASS, brass);
      }
      if (I > 0.5 && bar === 7 && s === 4) this.sample(bus, 'm_swell', t, 0.5, 1, false);
      if (I > 0.5 && bar === 7 && s >= 8) this.sample(bus, 'm_timp', t, 0.2 + (s - 8) * 0.06, mtof(45) / 73.4, false);

      this.step++;
      this.nextStep += STEP;
    }
  }
}

export const sound = new Sound();
