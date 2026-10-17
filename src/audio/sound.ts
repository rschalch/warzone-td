// Procedural sound: every effect is synthesised with WebAudio (noise bursts, swept oscillators,
// filters), so the game ships no audio files. Sounds are throttled per type and capped in total,
// panned and attenuated by where they happen relative to the camera.

import { settings, onSettings } from '../app/settings';

type Spatial = (x: number, y: number) => [gain: number, pan: number];

const MAX_VOICES = 28;

/** Minimum gap between two plays of the same sound (s). */
const THROTTLE: Record<string, number> = {
  gun: 0.035, gatling: 0.03, bunker: 0.04, cannon: 0.06, missile: 0.07, laser: 0.12, tesla: 0.06, emp: 0.12,
  flame: 0.12, napalm: 0.1, acid: 0.06, gas: 0.1, sniper: 0.05, rail: 0.08, flak: 0.05, arty: 0.1, cryo: 0.06,
  gravity: 0.3, repulsor: 0.12, hacker: 0.2, blackhole: 0.4, orbital: 0.3, nukeLaunch: 0.3, hive: 0.1,
  boom: 0.035, bigboom: 0.08, nuke: 0.5, leak: 0.25, wave: 0.5, build: 0.04, sell: 0.05, upgrade: 0.05,
  deny: 0.15, click: 0.03, level: 0.3, item: 0.2, freeze: 0.08, shatter: 0.08, hack: 0.2, swallow: 0.1,
  stun: 0.2, airstrike: 0.5, rally: 0.5, coin: 0.05, victory: 1, defeat: 1,
};

export class Sound {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private musicBus!: GainNode;
  private noise!: AudioBuffer;
  private last = new Map<string, number>();
  private voices = 0;
  spatial: Spatial = () => [1, 0];
  // music
  private musicOn = false;
  private nextStep = 0;
  private step = 0;
  private timer = 0;
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
  }

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const ctx = new AudioContext();
      this.ctx = ctx;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.ratio.value = 6;
      this.master = ctx.createGain();
      this.sfx = ctx.createGain();
      this.musicBus = ctx.createGain();
      this.sfx.connect(this.master);
      this.musicBus.connect(this.master);
      this.master.connect(comp).connect(ctx.destination);
      this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.applyVolumes();
      if (this.musicOn) this.startMusic();
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    this.master.gain.value = settings.master;
    this.sfx.gain.value = settings.sfx;
    this.musicBus.gain.value = settings.music * 0.5;
  }

  // ---------------------------------------------------------------- building blocks

  private out(gain: number, pan: number, dest: AudioNode = this.sfx): GainNode {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.value = gain;
    if (pan !== 0 && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(p).connect(dest);
    } else g.connect(dest);
    return g;
  }

  /** Filtered noise with an attack/decay envelope. */
  private noiseHit(dest: AudioNode, t: number, dur: number, type: BiquadFilterType, f0: number, f1: number, gain: number, q = 1): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.7 + Math.random() * 0.6;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.01, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
    this.track(src);
  }

  /** An oscillator sweeping f0 → f1 with an envelope. */
  private tone(dest: AudioNode, t: number, dur: number, type: OscillatorType, f0: number, f1: number, gain: number, attack = 0.005): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
    this.track(o);
  }

  private track(node: AudioScheduledSourceNode): void {
    this.voices++;
    node.onended = () => this.voices--;
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
    let [gain, pan] = x === undefined ? [1, 0] : this.spatial(x, y!);
    if (gain < 0.03) return;
    this.last.set(name, now);
    const t = now + 0.005;
    const o = this.out(gain, pan);
    switch (name) {
      case 'gun':
      case 'bunker':
        this.noiseHit(o, t, 0.05, 'bandpass', 2600, 1400, 0.35, 1.2);
        this.tone(o, t, 0.03, 'square', 900, 400, 0.06);
        break;
      case 'gatling':
        this.noiseHit(o, t, 0.035, 'bandpass', 3200, 1800, 0.28, 1.5);
        break;
      case 'hive':
        this.noiseHit(o, t, 0.03, 'highpass', 3500, 2500, 0.15);
        break;
      case 'cannon':
        this.noiseHit(o, t, 0.35, 'lowpass', 900, 120, 0.6);
        this.tone(o, t, 0.3, 'sine', 120, 40, 0.5);
        break;
      case 'arty':
        this.noiseHit(o, t, 0.7, 'lowpass', 700, 60, 0.75);
        this.tone(o, t, 0.6, 'sine', 90, 30, 0.6);
        break;
      case 'missile':
        this.noiseHit(o, t, 0.5, 'bandpass', 700, 2600, 0.3, 2);
        break;
      case 'laser':
        this.tone(o, t, 0.25, 'sawtooth', 880, 620, 0.06, 0.02);
        this.tone(o, t, 0.25, 'sine', 1760, 1240, 0.05, 0.02);
        break;
      case 'tesla':
        for (let k = 0; k < 6; k++) this.noiseHit(o, t + k * 0.022, 0.03, 'highpass', 3000, 5000, 0.3);
        this.tone(o, t, 0.15, 'sawtooth', 120, 90, 0.08);
        break;
      case 'emp':
        this.tone(o, t, 0.45, 'sine', 240, 50, 0.4);
        this.tone(o, t, 0.45, 'triangle', 480, 100, 0.12);
        break;
      case 'flame':
        this.noiseHit(o, t, 0.35, 'lowpass', 1400, 600, 0.3, 0.7);
        break;
      case 'napalm':
      case 'gas':
        this.tone(o, t, 0.15, 'sine', 200, 80, 0.4);
        this.noiseHit(o, t, 0.2, 'lowpass', 1000, 300, 0.25);
        break;
      case 'acid':
        this.tone(o, t, 0.12, 'sine', 700, 300, 0.18);
        this.noiseHit(o, t, 0.1, 'bandpass', 2000, 900, 0.1, 3);
        break;
      case 'cryo':
        this.tone(o, t, 0.12, 'sine', 1500, 900, 0.12);
        this.noiseHit(o, t, 0.15, 'highpass', 5000, 3000, 0.12);
        break;
      case 'sniper':
        this.noiseHit(o, t, 0.08, 'highpass', 1800, 900, 0.8);
        this.tone(o, t, 0.2, 'sine', 320, 90, 0.3);
        break;
      case 'rail':
        this.tone(o, t, 0.3, 'sawtooth', 180, 2400, 0.15, 0.04);
        this.noiseHit(o, t + 0.05, 0.2, 'highpass', 2500, 800, 0.5);
        break;
      case 'flak':
        this.noiseHit(o, t, 0.1, 'bandpass', 1300, 700, 0.45, 1.5);
        break;
      case 'gravity':
      case 'repulsor':
        this.tone(o, t, 0.35, 'sine', 110, 40, 0.45);
        this.noiseHit(o, t, 0.3, 'lowpass', 500, 120, 0.15);
        break;
      case 'hacker':
        [1200, 1600, 900, 2000].forEach((f, k) => this.tone(o, t + k * 0.05, 0.05, 'square', f, f, 0.06));
        break;
      case 'blackhole':
        this.tone(o, t, 1.8, 'sine', 70, 30, 0.6, 0.4);
        this.noiseHit(o, t, 1.6, 'lowpass', 300, 60, 0.3);
        break;
      case 'orbital':
        this.tone(o, t, 1.4, 'sawtooth', 600, 900, 0.12, 0.1);
        this.tone(o, t, 1.4, 'sine', 1200, 1800, 0.15, 0.1);
        this.noiseHit(o, t, 1.2, 'bandpass', 1500, 3000, 0.25, 2);
        break;
      case 'nukeLaunch':
        this.noiseHit(o, t, 1.6, 'lowpass', 300, 1800, 0.6);
        break;
      case 'boom': {
        const d = 0.25 + 0.15 * size;
        this.noiseHit(o, t, d, 'lowpass', 1600 / Math.sqrt(size), 90, Math.min(0.8, 0.35 + 0.15 * size));
        if (size > 1.5) this.tone(o, t, d, 'sine', 80, 30, 0.4);
        break;
      }
      case 'bigboom':
        this.noiseHit(o, t, 1.1, 'lowpass', 800, 50, 0.9);
        this.tone(o, t, 0.9, 'sine', 70, 25, 0.7);
        break;
      case 'nuke':
        this.noiseHit(o, t, 3.5, 'lowpass', 500, 30, 1);
        this.tone(o, t, 3, 'sine', 55, 20, 0.9, 0.05);
        this.noiseHit(o, t + 0.2, 2.5, 'bandpass', 900, 100, 0.4, 0.5);
        break;
      case 'leak':
        [880, 660, 880, 660].forEach((f, k) => this.tone(o, t + k * 0.12, 0.11, 'square', f, f, 0.12));
        break;
      case 'wave':
        this.tone(o, t, 1.1, 'sawtooth', 220, 230, 0.12, 0.2);
        this.tone(o, t, 1.1, 'sawtooth', 330, 345, 0.08, 0.2);
        this.tone(o, t, 1.1, 'sine', 110, 112, 0.25, 0.2);
        break;
      case 'build':
        this.tone(o, t, 0.12, 'sine', 160, 70, 0.4);
        this.noiseHit(o, t, 0.06, 'lowpass', 1200, 400, 0.25);
        break;
      case 'sell':
      case 'coin':
        this.tone(o, t, 0.08, 'triangle', 1320, 1320, 0.15);
        this.tone(o, t + 0.07, 0.14, 'triangle', 1760, 1760, 0.15);
        break;
      case 'upgrade':
        [523, 659, 784, 1046].forEach((f, k) => this.tone(o, t + k * 0.05, 0.12, 'triangle', f, f, 0.14));
        break;
      case 'level':
        [659, 784, 988, 1318].forEach((f, k) => this.tone(o, t + k * 0.07, 0.2, 'square', f, f, 0.08));
        break;
      case 'deny':
        this.tone(o, t, 0.14, 'square', 170, 150, 0.1);
        break;
      case 'click':
        this.tone(o, t, 0.03, 'square', 1800, 1200, 0.04);
        break;
      case 'item':
      case 'airstrike':
        this.noiseHit(o, t, 0.25, 'bandpass', 2000, 2000, 0.1, 8); // radio squelch
        this.tone(o, t + 0.2, 1.4, 'sawtooth', 90, 140, 0.12, 0.4); // jet / shells incoming
        break;
      case 'rally':
        [392, 523, 659].forEach((f, k) => this.tone(o, t + k * 0.12, 0.3, 'sawtooth', f, f, 0.08, 0.02));
        break;
      case 'freeze':
        this.tone(o, t, 0.25, 'sine', 2200, 3200, 0.12);
        break;
      case 'shatter':
        for (let k = 0; k < 4; k++) this.tone(o, t + k * 0.02, 0.1, 'triangle', 2500 + k * 700, 1800, 0.08);
        break;
      case 'hack':
        [400, 800, 600, 1200, 1000].forEach((f, k) => this.tone(o, t + k * 0.04, 0.04, 'square', f, f, 0.06));
        break;
      case 'swallow':
        this.tone(o, t, 0.4, 'sine', 400, 40, 0.3);
        break;
      case 'stun':
        this.noiseHit(o, t, 0.3, 'highpass', 4000, 1500, 0.4);
        this.tone(o, t, 0.6, 'sine', 3000, 2900, 0.06);
        break;
      case 'victory':
        [523, 659, 784, 1046, 784, 1046].forEach((f, k) => this.tone(o, t + k * 0.14, 0.3, 'triangle', f, f, 0.18));
        break;
      case 'defeat':
        [392, 349, 311, 262].forEach((f, k) => this.tone(o, t + k * 0.25, 0.45, 'sawtooth', f, f * 0.98, 0.1));
        break;
    }
  }

  // ---------------------------------------------------------------- music
  //
  // A sparse military groove scheduled with a look-ahead timer: kick and snare always, hats, toms
  // and a bass ostinato come in as the fighting intensifies, over a slowly shifting drone.

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
    if (!ctx || ctx.state !== 'running' || settings.music <= 0) {
      if (ctx) this.nextStep = ctx.currentTime + 0.1;
      return;
    }
    const stepDur = 60 / 96 / 4; // 16ths at 96 bpm
    const bus = this.musicBus;
    const notes = [55, 55, 65.4, 49]; // A, A, C, G — one per bar
    while (this.nextStep < ctx.currentTime + 0.2) {
      const t = this.nextStep;
      const s = this.step % 16;
      const bar = Math.floor(this.step / 16) % 4;
      const I = this.intensity;
      if (s === 0 || s === 10 || (I > 0.6 && s === 7)) {
        this.tone(bus, t, 0.25, 'sine', 120, 40, 0.5); // kick
      }
      if (s === 4 || s === 12) this.noiseHit(bus, t, 0.14, 'bandpass', 1800, 900, 0.2 + 0.1 * I, 0.8); // snare
      if (I > 0.25 && s % 2 === 0) this.noiseHit(bus, t, 0.03, 'highpass', 8000, 7000, 0.05 + 0.04 * I);
      if (I > 0.5 && (s === 14 || s === 15)) this.tone(bus, t, 0.15, 'sine', s === 14 ? 160 : 120, 70, 0.25); // toms
      if (I > 0.35 && (s === 0 || s === 3 || s === 6 || s === 8 || s === 11)) {
        this.tone(bus, t, stepDur * 1.8, 'sawtooth', notes[bar], notes[bar], 0.07 + 0.05 * I, 0.01); // bass
      }
      if (s === 0) {
        // drone: a fifth over the bar's root
        this.tone(bus, t, stepDur * 16, 'triangle', notes[bar] * 2, notes[bar] * 2, 0.05, 0.6);
        this.tone(bus, t, stepDur * 16, 'triangle', notes[bar] * 3, notes[bar] * 3, 0.03, 0.8);
      }
      this.step++;
      this.nextStep += stepDur;
    }
  }
}

export const sound = new Sound();
