// Player settings, persisted and observable.

import { load, save } from './storage';

export interface Settings {
  master: number; // 0..1
  sfx: number;
  music: number;
  muted: boolean; // all sound and music off (the volumes are kept)
  quality: 'low' | 'medium' | 'high'; // particle budget
  colorblind: boolean;
  numbers: boolean; // floating damage / bounty numbers
  shake: boolean;
  wrecks: boolean;
}

const DEFAULTS: Settings = {
  master: 0.8,
  sfx: 0.8,
  music: 0.45,
  muted: false,
  quality: 'high',
  colorblind: false,
  numbers: true,
  shake: true,
  wrecks: true,
};

export const settings: Settings = load('settings', DEFAULTS);
const listeners: (() => void)[] = [];

export function onSettings(fn: () => void): void {
  listeners.push(fn);
}

export function updateSettings(patch: Partial<Settings>): void {
  Object.assign(settings, patch);
  save('settings', settings);
  for (const fn of listeners) fn();
}

/** Colours that change in colour-blind mode (blue/orange instead of green/red). */
export function palette() {
  return settings.colorblind
    ? { ok: 0x4aa8ff, bad: 0xff9a2a, hpHigh: 0x4aa8ff, hpMid: 0xf0e040, hpLow: 0xff7a1a }
    : { ok: 0x7dff8a, bad: 0xff5a5a, hpHigh: 0x5ad65a, hpMid: 0xe8c440, hpLow: 0xe85040 };
}
