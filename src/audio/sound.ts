// Procedural sound, no audio files. Effects are rendered once into sample banks by a worker (dsp.ts:
// layered transients, noise bodies, thumps, rumble tails, echoes) and played back with pitch jitter,
// panned and attenuated by where they happen relative to the camera, through a convolution reverb.
// The orchestral music (strings, brass, choir over taiko drums) is played live by oscillators.

import { ANTHEMS } from './anthems';
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
  stun: 0.3, airstrike: 0.5, recon: 0.45, rally: 0.5, coin: 0.06, victory: 1, defeat: 1,
  mg42: 0.03, flak38: 0.06, pak40: 0.1, flak88: 0.12, tiger: 0.12, schreck: 0.1, mortar: 0.08, nebel: 0.6, stuka: 1, ricochet: 0.07,
  mosin: 0.05, ppsh: 0.04, dt: 0.04, f34: 0.1, rs82: 0.15, wreck: 0.15, katyusha: 1.5, v2: 2, maxim: 0.04, ptrd: 0.08, m1919: 0.035, type92: 0.06, bazooka: 0.1,
};

/** Mix level of each effect. */
const GAIN: Record<string, number> = {
  gun: 0.32, gatling: 0.26, bunker: 0.38, sniper: 0.6, flak: 0.42, cannon: 0.65, arty: 0.75,
  boom0: 0.4, boom1: 0.55, boom2: 0.7, bigboom: 0.85, nuke: 1,
  missile: 0.45, hive: 0.22, nukeLaunch: 0.8, laser: 0.22, tesla: 0.3, emp: 0.5, flame: 0.35, napalm: 0.4,
  gas: 0.35, acid: 0.3, cryo: 0.3, rail: 0.5, gravity: 0.5, repulsor: 0.45, hacker: 0.2, blackhole: 0.75,
  orbital: 0.8, leak: 0.38, build: 0.55, upgrade: 0.5, sell: 0.5, coin: 0.3, item: 0.45, deny: 0.35,
  click: 0.25, freeze: 0.35, shatter: 0.3, hack: 0.3, swallow: 0.45, stun: 0.6, airstrike: 0.7,
  mg42: 0.26, flak38: 0.4, pak40: 0.7, flak88: 0.8, tiger: 0.8, schreck: 0.5, mortar: 0.5, nebel: 0.7, stuka: 0.75, ricochet: 0.25,
  mosin: 0.3, ppsh: 0.22, dt: 0.24, f34: 0.72, rs82: 0.5, wreck: 0.9, katyusha: 0.8, v2: 0.9, maxim: 0.3, ptrd: 0.55, m1919: 0.28, type92: 0.34, bazooka: 0.5,
};

/** Reverb send per effect (distance adds more). */
const WET: Record<string, number> = { click: 0.03, deny: 0.05, coin: 0.15, build: 0.15, upgrade: 0.15, sell: 0.15, laser: 0.35, tesla: 0.3 };

/** Played live through the instrument synth rather than from a sample bank. */
const LIVE = new Set(['wave', 'level', 'rally', 'victory', 'defeat']);

// ---------------------------------------------------------------- the score
//
// Six cinematic pieces played one after another, each an 8-bar loop in a minor key repeated a few
// times. A field-drum march (snare cadence + bass drum) always plays under a string pad, sub and a
// lead line. As the fighting intensifies: low-string ostinato, taikos, tom fills, timpani, brass,
// choir, anvil.

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export interface Voice {
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
const HORN: Voice = { voices: 2, spread: 6, attack: 0.3, release: 1, gain: 0.045, cut: 500, peak: 1500, q: 0.8 };
const CELLO: Voice = { voices: 3, spread: 10, attack: 0.35, release: 1.2, gain: 0.05, cut: 1600 };

export interface Track {
  bpm: number;
  /** Per bar: bass note and pad voicing (MIDI). */
  chords: Chord[];
  /** The lead line, two notes per bar, and who plays it (with an octave shift). */
  melody: number[][];
  lead: Voice;
  leadShift?: number;
  /** Ostinato: semitones over the bass (an octave up), per 16th, and its accented steps. */
  ostinato: number[];
  accent: number[];
  /** Taiko steps at medium / high / full intensity. */
  drums: [number[], number[], number[]];
  /** Field drums per 16th, [calm, battle]. Snare: X accent, x normal, . ghost, r roll (two 32nds),
   *  f flam, - rest. Bass drum: O strong, o soft, - rest. */
  snare: [string, string];
  kick: [string, string];
  /** Brass stabs: [step, length in 16ths]. */
  brass: [number, number][];
  /** Times through the bars before the next piece. */
  loops: number;
  /** 16ths per bar (default 16: 4/4; 12 for 3/4 and 6/8, 18 for 9/8). Patterns above are this long. */
  steps?: number;
  /** A real tune instead of `melody`: per bar, [MIDI (0 = rest), length in 16ths] (see anthems.ts). */
  tune?: [number, number][][];
  /** How the tune is played: plucked (koto), with tremolo (balalaika), and who doubles it in battle. */
  pluck?: boolean;
  tremolo?: boolean;
  battleLead?: Voice;
  /** The piece's name, for the settings and the HUD. */
  name?: string;
}

const ch = (bass: number, ...pad: number[]) => ({ bass, pad });

export interface Chord {
  bass: number;
  pad: number[];
  /** A second chord from the middle of the bar. */
  half?: { bass: number; pad: number[] };
}

const TRACKS: Track[] = [
  { // Last Stand: D minor, Dm Bb F C | Dm Bb Gm A
    name: 'Last Stand',
    bpm: 84,
    chords: [ch(38, 50, 53, 57, 62), ch(34, 50, 53, 58, 62), ch(41, 48, 53, 57, 60), ch(36, 48, 52, 55, 60),
      ch(38, 50, 53, 57, 62), ch(34, 50, 53, 58, 65), ch(31, 50, 55, 58, 62), ch(33, 49, 52, 57, 61)],
    melody: [[69, 69], [70, 65], [69, 72], [67, 64], [69, 74], [70, 74], [70, 67], [69, 73]], lead: VIOLIN,
    ostinato: [0, 0, 0, 12, 0, 0, 12, 0, 0, 0, 0, 12, 0, 0, 7, 12], accent: [0, 3, 6, 8, 11, 14],
    drums: [[0, 6, 10], [0, 3, 6, 10, 12, 14], [0, 3, 6, 8, 10, 12, 14, 15]],
    snare: ['X..x..x.X..x.rr.', 'f.xrX.xrf.xrXrrr'], kick: ['O-------o-------', 'O--o--O-O--o-O-o'],
    brass: [[0, 5], [6, 1.5], [8, 7]], loops: 4,
  },
  { // Iron Rain: E minor, driving, Em C G D | Em C Am B
    name: 'Iron Rain',
    bpm: 98,
    chords: [ch(40, 52, 55, 59, 64), ch(36, 52, 55, 60, 64), ch(43, 50, 55, 59, 62), ch(38, 50, 54, 57, 62),
      ch(40, 52, 55, 59, 64), ch(36, 52, 55, 60, 67), ch(33, 52, 57, 60, 64), ch(35, 51, 54, 59, 63)],
    melody: [[71, 67], [72, 76], [74, 71], [69, 74], [71, 79], [76, 72], [72, 69], [71, 75]], lead: VIOLIN,
    ostinato: [0, 0, 12, 0, 0, 12, 0, 7, 0, 0, 12, 0, 0, 12, 7, 12], accent: [0, 4, 8, 12],
    drums: [[0, 8], [0, 4, 8, 10, 12], [0, 2, 4, 7, 8, 10, 12, 14, 15]],
    snare: ['X.x.x.x.X.x.xrx.', 'XrxrXrxrXrxrXrrr'], kick: ['O---o---O---o---', 'O-o-O-o-O-o-O-oo'],
    brass: [[0, 3], [4, 3], [8, 3], [12, 4]], loops: 4,
  },
  { // Ashes: C minor, slow and mournful, cello lead, Cm Ab Eb Bb | Cm Ab Fm G
    name: 'Ashes',
    bpm: 70,
    chords: [ch(36, 48, 51, 55, 60), ch(32, 48, 51, 56, 60), ch(39, 51, 55, 58, 63), ch(34, 50, 53, 58, 62),
      ch(36, 48, 51, 55, 60), ch(32, 48, 51, 56, 63), ch(41, 48, 53, 56, 60), ch(31, 50, 55, 59, 62)],
    melody: [[67, 63], [68, 72], [70, 67], [65, 70], [72, 75], [75, 72], [72, 68], [71, 74]], lead: CELLO, leadShift: -12,
    ostinato: [0, 0, 7, 0, 12, 0, 7, 0, 0, 0, 7, 0, 12, 0, 7, 0], accent: [0, 4, 8, 12],
    drums: [[0], [0, 10], [0, 6, 10, 14]],
    snare: ['X-----.-x-----r-', 'X..xX..xf..xXrrr'], kick: ['O-------O-------', 'O-----o-O-----o-'],
    brass: [[0, 8], [8, 8]], loops: 3,
  },
  { // Blitz: A minor, fast and aggressive, Am F C G | Am F E E
    name: 'Blitz',
    bpm: 112,
    chords: [ch(33, 52, 57, 60, 64), ch(41, 53, 57, 60, 65), ch(36, 52, 55, 60, 64), ch(43, 50, 55, 59, 62),
      ch(33, 52, 57, 60, 64), ch(41, 53, 57, 60, 65), ch(40, 52, 56, 59, 64), ch(40, 52, 56, 59, 62)],
    melody: [[76, 72], [77, 81], [79, 76], [74, 79], [81, 76], [77, 72], [76, 71], [68, 64]], lead: VIOLIN,
    ostinato: [0, 12, 0, 12, 0, 12, 0, 12, 0, 12, 0, 12, 7, 12, 7, 12], accent: [0, 3, 6, 10, 12],
    drums: [[0, 6, 8, 14], [0, 3, 6, 8, 11, 14], [0, 2, 3, 6, 8, 10, 11, 12, 14, 15]],
    snare: ['X.xxX.x.X.xxXrx.', 'fxrxXrxrfxrxXrrr'], kick: ['O--o--O---o-O---', 'O-oO-oO-O-oO-ooo'],
    brass: [[0, 2], [3, 2], [6, 2], [10, 6]], loops: 5,
  },
  { // Frontline: G minor, march with a horn lead, Gm Eb Bb F | Gm Cm D D
    name: 'Frontline',
    bpm: 90,
    chords: [ch(43, 50, 55, 58, 62), ch(39, 51, 55, 58, 63), ch(34, 50, 53, 58, 62), ch(41, 48, 53, 57, 60),
      ch(43, 50, 55, 58, 62), ch(36, 51, 55, 60, 63), ch(38, 50, 54, 57, 62), ch(38, 50, 54, 57, 60)],
    melody: [[70, 74], [75, 70], [74, 77], [72, 69], [67, 70], [72, 75], [74, 69], [66, 62]], lead: HORN, leadShift: -12,
    ostinato: [0, 0, 0, 0, 12, 0, 0, 0, 0, 0, 0, 0, 12, 0, 7, 0], accent: [0, 4, 8, 12],
    drums: [[0, 8], [0, 4, 8, 12, 14], [0, 2, 4, 6, 8, 10, 12, 13, 14, 15]],
    snare: ['X.xxX.x.X.xxXrrr', 'fxxrXxxrfxxrXrrr'], kick: ['O---o---O---o---', 'O-o-O-o-O-o-O-o-'],
    brass: [[0, 4], [4, 2], [6, 2], [8, 8]], loops: 4,
  },
  { // Eclipse: F# minor, epic and wide, choir lead, F#m D A E | F#m D Bm C#
    name: 'Eclipse',
    bpm: 78,
    chords: [ch(42, 54, 57, 61, 66), ch(38, 54, 57, 62, 66), ch(33, 52, 57, 61, 64), ch(40, 52, 56, 59, 64),
      ch(42, 54, 57, 61, 66), ch(38, 54, 57, 62, 69), ch(35, 50, 54, 59, 62), ch(37, 49, 53, 56, 61)],
    melody: [[73, 69], [74, 78], [76, 73], [71, 76], [78, 73], [74, 69], [71, 74], [73, 77]], lead: { ...CHOIR, attack: 0.5, gain: 0.08 }, leadShift: -12,
    ostinato: [0, 7, 12, 7, 0, 7, 12, 7, 0, 7, 12, 7, 0, 7, 12, 15], accent: [0, 4, 8, 12],
    drums: [[0, 10], [0, 6, 10, 12], [0, 3, 6, 10, 12, 14, 15]],
    snare: ['X..x..X...x.Xrr.', 'XrxrX.xrXrxrXrrr'], kick: ['O-----o-O-------', 'O--oO--oO--oO-oo'],
    brass: [[0, 6], [6, 2], [8, 8]], loops: 3,
  },
];

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
  /** The current piece; remembered so the next visit carries on with the following one. */
  private track = this.savedTrack();
  /** 0 calm (menu/build) … 1 heavy fighting. */
  intensity = 0;
  /** The pieces in turn: the score, or a WW2 faction's tunes. */
  private playlist: Track[] = TRACKS;
  private faction = '';

  /** WW2: the recordings of the faction's music (public/music), played instead of the score; empty while none. */
  private records: Recording[] = [];
  private record = 0;
  private recordFails = 0;
  private player: HTMLAudioElement | null = null;

  /**
   * WW2: play the music of the faction the player defends with (none: the score). Its recordings
   * if they load; the synth arrangements of its tunes otherwise (offline).
   */
  setFaction(f?: string): void {
    if ((f ?? '') === this.faction) return;
    this.faction = f ?? '';
    this.playlist = (f && ANTHEMS[f]) || TRACKS;
    this.track = this.playlist === TRACKS ? this.savedTrack() : 0;
    this.step = 0;
    this.records = [];
    this.player?.pause();
    this.player?.removeAttribute('src');
    if (f) void this.loadRecords(f);
  }

  private async loadRecords(f: string): Promise<void> {
    try {
      credits ??= fetch('music/credits.json').then((r) => (r.ok ? r.json() : {}));
      const list = (await credits)[f] ?? [];
      if (this.faction !== f || !list.length) return;
      this.records = list;
      this.recordFails = 0;
      this.record = (Number(localStorage.getItem(`wz-record-${f}`)) || 0) % list.length;
      this.playRecord();
    } catch {
      // offline: the synth arrangements play
    }
  }

  /** Starts the current recording (once audio is unlocked and music is on). */
  private playRecord(): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicOn || !this.records.length) return;
    if (!this.player) {
      const a = new Audio();
      a.preload = 'auto';
      // one after another, with a breath in between
      a.addEventListener('ended', () => this.nextRecord(1.5));
      a.addEventListener('error', () => {
        if (!a.getAttribute('src')) return;
        if (++this.recordFails >= this.records.length) this.records = []; // none load: back to the synth
        else this.nextRecord(0.5);
      });
      ctx.createMediaElementSource(a).connect(this.musicBus);
      this.player = a;
    }
    const r = this.records[this.record];
    if (!this.player.getAttribute('src')?.endsWith(r.file)) this.player.src = `music/${r.file}`;
    void this.player.play().catch(() => undefined);
  }

  private nextRecord(delay: number): void {
    const f = this.faction;
    if (!this.records.length) return;
    this.record = (this.record + 1) % this.records.length;
    this.remember();
    this.player?.removeAttribute('src');
    setTimeout(() => this.faction === f && this.playRecord(), delay * 1000);
  }

  /** Remembers the piece playing, so the next visit carries on from the following one. */
  private remember(): void {
    try {
      if (this.records.length) localStorage.setItem(`wz-record-${this.faction}`, String(this.record));
      else if (this.playlist === TRACKS) localStorage.setItem('wz-track', String(this.track));
    } catch {
      /* private mode */
    }
  }

  /** Skips to the next (1) or previous (-1) piece now: a recording, or the score's next tune. */
  skipTrack(dir: 1 | -1): void {
    if (this.records.length) {
      const n = this.records.length;
      this.record = (this.record + dir + n) % n;
      this.remember();
      this.player?.removeAttribute('src');
      this.playRecord();
      return;
    }
    const n = this.playlist.length;
    this.track = (this.track + dir + n) % n;
    this.step = 0;
    this.remember();
  }

  nextTrack(): void {
    this.skipTrack(1);
  }

  prevTrack(): void {
    this.skipTrack(-1);
  }

  private savedTrack(): number {
    try {
      return (Number(localStorage.getItem('wz-track')) || 0) % TRACKS.length;
    } catch {
      return 0;
    }
  }

  /** The piece playing now (for the HUD). */
  get trackName(): string {
    if (this.records.length) return this.records[this.record].name;
    return this.playlist[this.track]?.name ?? '';
  }

  constructor() {
    onSettings(() => this.applyVolumes());
    // browsers only start audio after a user gesture
    // (and again whenever the system suspended or interrupted it: device changes, sleep, other apps)
    const unlock = () => {
      this.ensure();
      this.wake();
    };
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && this.wake());
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

  private wake(): void {
    const st = this.ctx?.state as string | undefined;
    if (st && st !== 'running' && st !== 'closed') void this.ctx!.resume().catch(() => undefined);
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
      if (this.musicOn) {
        this.startMusic();
        this.playRecord();
      }
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
    this.master.gain.value = settings.muted ? 0 : settings.master;
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
    if (on) {
      this.startMusic();
      this.playRecord();
    } else {
      this.stopMusic();
      this.player?.pause();
    }
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

  /** The march: snare cadence and bass drum at every intensity, tom fills and rolls into each phrase. */
  private fieldDrums(bus: AudioNode, tr: Track, t: number, STEP: number, s: number, bar: number, I: number): void {
    const battle = I > 0.6 ? 1 : 0;
    const vol = 0.55 + 0.45 * I;
    // the last beats of every 4th bar: a tom fill (calm) or a crescendo snare roll (battle)
    const n = tr.steps ?? 16;
    const last = tr.chords.length - 1;
    const fill = bar % 4 === 3 && s >= n - 4;
    if (fill && I > 0.35 && !(battle && bar === last)) {
      this.sample(bus, s < n - 2 ? 'm_tom' : 'm_toml', t, (0.4 + 0.05 * (s - n + 4)) * vol, 1, false);
      if (I > 0.6) this.sample(bus, s < n - 2 ? 'm_tom' : 'm_toml', t + STEP / 2, 0.3 * vol, 1, false);
    } else if (battle && bar === last && s >= n / 2) {
      const g = (0.12 + (s - n / 2) * 0.4 / n) * vol;
      this.sample(bus, 'm_field', t, g, 1, false);
      this.sample(bus, 'm_field', t + STEP / 2, g, 1, false);
    } else {
      const c = tr.snare[battle][s];
      if (c === 'X') this.sample(bus, 'm_field', t, 0.55 * vol, 1, false);
      else if (c === 'x') this.sample(bus, 'm_field', t, 0.32 * vol, 1, false);
      else if (c === '.') this.sample(bus, 'm_field', t, 0.1 * vol, 1, false);
      else if (c === 'r') {
        this.sample(bus, 'm_field', t, 0.24 * vol, 1, false);
        this.sample(bus, 'm_field', t + STEP / 2, 0.2 * vol, 1, false);
      } else if (c === 'f') {
        this.sample(bus, 'm_field', t - 0.025, 0.14 * vol, 1, false);
        this.sample(bus, 'm_field', t, 0.55 * vol, 1, false);
      }
    }
    const k = tr.kick[battle][s];
    if (k !== '-') this.sample(bus, 'm_kick', t, (k === 'O' ? 0.85 : 0.5) * vol, 1, false);
  }

  /** A real tune: the notes starting on this 16th, doubled by the brass (an octave down) as the fighting grows. */
  private tuneStep(bus: AudioNode, tr: Track, t: number, STEP: number, s: number, bar: number, I: number): void {
    let at = 0;
    for (const [m, len] of tr.tune![bar]) {
      if (at === s && m > 0) {
        const pitch = m + (tr.leadShift ?? 0);
        const dur = len * STEP;
        if (tr.tremolo && len >= 4) {
          for (let k = 0; k < len; k++) this.note(bus, t + k * STEP, STEP * 0.6, pitch, tr.lead, k === 0 ? 1.2 : 0.75);
        } else this.note(bus, t, tr.pluck ? Math.min(0.08, dur) : dur * 0.92, pitch, tr.lead);
        if (I > 0.55 && tr.battleLead) this.note(bus, t, dur * 0.9, m - 12, tr.battleLead, Math.min(0.9, (I - 0.55) * 2.5));
      }
      at += len;
      if (at > s) break;
    }
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || settings.music <= 0 || !this.banks.has('m_taiko')) {
      if (ctx) this.nextStep = ctx.currentTime + 0.1;
      return;
    }
    // a recording is playing instead
    if (this.records.length) {
      this.nextStep = ctx.currentTime + 0.1;
      return;
    }
    const bus = this.musicIn;
    // after a stall (busy main thread, throttled timer) carry on from now instead of firing every missed note at once
    if (this.nextStep < ctx.currentTime - 0.1) this.nextStep = ctx.currentTime + 0.05;
    while (this.nextStep < ctx.currentTime + 0.25) {
      const tr = this.playlist[this.track];
      const STEP = 60 / tr.bpm / 4;
      const n = tr.steps ?? 16;
      const bars = tr.chords.length;
      const t = this.nextStep;
      const s = this.step % n;
      const bar = Math.floor(this.step / n) % bars;
      // intensity follows the battle over a few seconds, so layers don't flicker in and out
      this.level += (this.intensity - this.level) * 0.03;
      const I = this.level;
      const whole = tr.chords[bar];
      const second = whole.half && s >= n / 2;
      const ch = second ? whole.half! : whole;

      if (s === 0 || (whole.half && s === n / 2)) {
        const dur = STEP * (whole.half ? n / 2 : n) - 0.2;
        for (const m of ch.pad) this.note(bus, t, dur, m, { ...STRINGS, cut: 700 + 1600 * I });
        this.note(bus, t, dur, ch.bass, { wave: 'sine', attack: 0.4, release: 1, gain: 0.16, cut: 400 });
        this.note(bus, t, dur, ch.bass + 12, { ...STRINGS, gain: 0.045 + 0.03 * I });
        if (I > 0.75) for (const m of ch.pad) this.note(bus, t, dur - 0.1, m + 12, CHOIR, Math.min(1, (I - 0.75) * 5));
        if (s === 0 && I > 0.4 && bar % 4 === 0) this.sample(bus, 'm_timp', t, 0.7, mtof(ch.bass + 12) / 73.4, false);
        if (s === 0 && I > 0.7 && bar === 0) this.sample(bus, 'm_hit', t, 0.6, 1, false);
      }
      if (tr.tune) this.tuneStep(bus, tr, t, STEP, s, bar, I);
      // the lead line fades out once the brass takes over
      else if ((s === 0 || s === 8) && I < 0.85) {
        this.note(bus, t, STEP * 7.5, tr.melody[bar][s === 0 ? 0 : 1] + (tr.leadShift ?? 0), tr.lead, 1 - Math.max(0, I - 0.55) * 3);
      }

      if (I > 0.2) {
        const sixteenths = I > 0.5;
        if (sixteenths || s % 2 === 0) {
          const amt = Math.min(1, (I - 0.2) * 3) * (tr.accent.includes(s) ? 1.4 : 0.8);
          this.note(bus, t, STEP * 0.5, ch.bass + 12 + tr.ostinato[s], { ...SPICCATO, cut: 900 + 2200 * I }, amt);
        }
      }
      this.fieldDrums(bus, tr, t, STEP, s, bar, I);
      if (I > 0.25) {
        const hits = tr.drums[I > 0.8 ? 2 : I > 0.55 ? 1 : 0];
        if (hits.includes(s)) this.sample(bus, s === 0 || s === hits[1] ? 'm_taiko' : s >= 14 ? 'm_tom' : 'm_taiko', t, (s === 0 ? 0.9 : 0.6) * Math.min(1, 0.5 + I), 1, false);
      }
      if (I > 0.5 && (s === n / 4 || s === (3 * n) / 4)) this.sample(bus, 'm_snare', t, 0.3, 1, false);
      if (I > 0.8 && bar % 2 === 1 && s === (3 * n) / 4) this.sample(bus, 'm_anvil', t, 0.22, 1, false);
      if (I > 0.6) {
        const brass = Math.min(1, (I - 0.6) * 4);
        for (const [at, len] of tr.brass) {
          if (s === at) for (const m of [ch.bass + 24, ch.bass + 31, ch.bass + 36]) this.note(bus, t, STEP * len, m, BRASS, at === 0 ? brass : brass * 0.85);
        }
      }
      // into the next loop: a cymbal swell (rendered for 76 bpm) and a timpani roll on the last bass note
      if (I > 0.5 && bar === bars - 1 && s === n / 4) this.sample(bus, 'm_swell', t, 0.5, tr.bpm / 76, false);
      if (I > 0.5 && bar === bars - 1 && s >= n / 2) this.sample(bus, 'm_timp', t, 0.2 + (s - n / 2) * 0.5 / n, mtof(ch.bass + 12) / 73.4, false);

      this.step++;
      this.nextStep += STEP;
      // pieces play in order; each starts over from its first bar
      if (this.step >= n * bars * tr.loops) {
        this.step = 0;
        this.track = (this.track + 1) % this.playlist.length;
        this.remember();
      }
    }
  }
}

/** A WW2 recording, as listed in public/music/credits.json (written by scripts/fetch-music.mjs). */
interface Recording {
  file: string;
  name: string;
}
let credits: Promise<Record<string, Recording[]>> | undefined;

export const sound = new Sound();
