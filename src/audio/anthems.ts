// WW2 faction music: real period tunes (all in the public domain) arranged for the live score in sound.ts —
// the melody over the string pad, field drums, ostinato, taikos and brass that rise with the fighting.
//
// Tunes are written as bars of "note:length" (length in 16ths, `r` a rest) and chords as symbols, one per
// bar or two (the second from the middle of the bar).

import type { Chord, Track, Voice } from './sound';

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function pitchClass(name: string): number {
  let pc = PC[name[0]];
  for (const c of name.slice(1)) pc += c === '#' ? 1 : c === 'b' ? -1 : 0;
  return (pc + 12) % 12;
}

/** "C#5" → MIDI. */
function midi(n: string): number {
  const m = /^([A-G][#b]?)(-?\d)$/.exec(n);
  if (!m) throw new Error(`bad note ${n}`);
  return 12 * (Number(m[2]) + 1) + pitchClass(m[1]);
}

const QUALITY: Record<string, number[]> = { '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], m7: [0, 3, 7, 10], dim: [0, 3, 6], '5': [0, 7] };

/** "F#m" → a bass note (an octave below the pad) and a close pad voicing around middle C. */
function chordOf(sym: string, key: number): { bass: number; pad: number[] } {
  const m = /^([A-G][#b]?)(.*)$/.exec(sym);
  if (!m || !QUALITY[m[2]]) throw new Error(`bad chord ${sym}`);
  const pc = (pitchClass(m[1]) + key + 12) % 12;
  let bass = 36 + pc;
  if (bass > 43) bass -= 12;
  const pad = QUALITY[m[2]].map((i) => 50 + ((pc + i - 2 + 24) % 12)).sort((a, b) => a - b);
  pad.push(pad.find((p) => p % 12 === pc)! + 12);
  return { bass, pad };
}

function chords(src: string, key: number): Chord[] {
  return src.split('|').map((bar) => {
    const [a, b] = bar.trim().split(/\s+/);
    return b ? { ...chordOf(a, key), half: chordOf(b, key) } : chordOf(a, key);
  });
}

function tune(src: string, key: number, steps: number): [number, number][][] {
  return src.split('|').map((bar, k) => {
    const notes = bar.trim().split(/\s+/).map((tok): [number, number] => {
      const [n, len] = tok.split(':');
      return [n === 'r' ? 0 : midi(n) + key, Number(len)];
    });
    const sum = notes.reduce((s, [, l]) => s + l, 0);
    if (sum !== steps) throw new Error(`bar ${k + 1} is ${sum} 16ths long, not ${steps}`);
    return notes;
  });
}

// ---------------------------------------------------------------- voices

const HORNS: Voice = { voices: 3, spread: 8, attack: 0.14, release: 0.8, gain: 0.06, cut: 600, peak: 1800, q: 0.8 };
const TRUMPET: Voice = { voices: 2, spread: 6, attack: 0.05, release: 0.3, gain: 0.05, cut: 900, peak: 3400, q: 1.1 };
const TROMBONES: Voice = { voices: 3, spread: 10, attack: 0.08, release: 0.4, gain: 0.07, cut: 400, peak: 2200, q: 1.2 };
const MEN: Voice = { voices: 4, spread: 14, attack: 0.12, release: 0.6, gain: 0.09, cut: 0, formants: [520, 920, 2450] };
const BALALAIKA: Voice = { voices: 2, spread: 7, attack: 0.003, release: 0.18, gain: 0.05, cut: 2600, q: 2 };
const FIFE: Voice = { wave: 'triangle', voices: 2, spread: 5, attack: 0.03, release: 0.12, gain: 0.1, cut: 4000 };
const SHAKUHACHI: Voice = { wave: 'triangle', voices: 2, spread: 9, attack: 0.18, release: 0.7, gain: 0.11, cut: 2200 };
const KOTO: Voice = { voices: 1, attack: 0.002, release: 1.1, gain: 0.06, cut: 2400, q: 2.5 };
const LOW_BRASS: Voice = { voices: 3, spread: 9, attack: 0.1, release: 0.5, gain: 0.05, cut: 450, peak: 2000, q: 1.1 };

// ---------------------------------------------------------------- percussion by metre

const COMMON = {
  ostinato: [0, 0, 0, 12, 0, 0, 12, 0, 0, 0, 0, 12, 0, 0, 7, 12], accent: [0, 3, 6, 8, 11, 14],
  drums: [[0, 8], [0, 4, 8, 12, 14], [0, 2, 4, 6, 8, 10, 12, 13, 14, 15]] as [number[], number[], number[]],
  snare: ['X.xxX.x.X.xxXrrr', 'fxxrXxxrfxxrXrrr'] as [string, string], kick: ['O---o---O---o---', 'O-o-O-o-O-o-O-o-'] as [string, string],
  brass: [[0, 4], [4, 2], [6, 2], [8, 8]] as [number, number][],
};
const TRIPLE = { // 3/4 and 6/8: 12 16ths a bar
  steps: 12, ostinato: [0, 0, 12, 0, 7, 0, 12, 0, 7, 0, 12, 7], accent: [0, 4, 8],
  drums: [[0], [0, 4, 8], [0, 2, 4, 6, 8, 10, 11]] as [number[], number[], number[]],
  snare: ['X.x.x.X.x.rr', 'fxrxXrxrXrrr'] as [string, string], kick: ['O---o---o---', 'O-o-O-o-O-oo'] as [string, string],
  brass: [[0, 4], [4, 2], [8, 4]] as [number, number][],
};
const NINE = { // 9/8: 18 16ths a bar, three dotted-quarter beats
  steps: 18, ostinato: [0, 12, 0, 12, 0, 12, 0, 12, 0, 12, 0, 12, 0, 12, 7, 12, 7, 12], accent: [0, 6, 12],
  drums: [[0, 12], [0, 6, 12, 15], [0, 3, 6, 9, 12, 15, 16, 17]] as [number[], number[], number[]],
  snare: ['X.xx.xX.xx.xX.xxrr', 'frxxrxXrxxrxfrxrrr'] as [string, string], kick: ['O-----o-----O-----', 'O--o--O--o--O--oOo'] as [string, string],
  brass: [[0, 6], [6, 6], [12, 6]] as [number, number][],
};

function piece(name: string, bpm: number, key: number, meter: typeof COMMON & { steps?: number }, notes: string, harmony: string,
  lead: Voice, more: Partial<Track> = {}): Track {
  const steps = meter.steps ?? 16;
  const bars = tune(notes, key, steps);
  const chordList = chords(harmony, key);
  if (bars.length !== chordList.length) throw new Error(`${name}: ${bars.length} bars of tune, ${chordList.length} of chords`);
  return { ...meter, name, bpm, steps, chords: chordList, melody: [], tune: bars, lead, loops: 3, ...more };
}

// ---------------------------------------------------------------- the tunes

/** Haydn, "Gott erhalte Franz den Kaiser" (1797): the melody of the Lied der Deutschen, as a horn chorale. */
const DEUTSCHLAND = piece('Das Lied der Deutschen (Haydn)', 74, 3, COMMON,
  `C5:6 D5:2 E5:4 D5:4 | F5:4 E5:4 D5:2 B4:2 C5:4 | A5:4 G5:4 F5:4 E5:4 | D5:6 E5:2 C5:8 |
   C5:6 D5:2 E5:4 D5:4 | F5:4 E5:4 D5:2 B4:2 C5:4 | A5:4 G5:4 F5:4 E5:4 | D5:6 E5:2 C5:8`,
  'C G | F G7 | F C | G7 C | C Em | F G7 | Dm Am | G7 C', HORNS, { leadShift: -12, battleLead: TROMBONES });

/** Wagner, "Walkürenritt" (1856): the brass theme over string trills. */
const VALKYRIES = piece('Walkürenritt (Wagner)', 108, 0, NINE,
  `B4:3 F#4:1 B4:2 D5:9 B4:3 | D5:3 B4:1 D5:2 F#5:9 D5:3 | F#5:3 D5:1 F#5:2 A5:9 A4:3 | D5:3 A4:1 D5:2 F#5:12 |
   E5:3 C#5:1 E5:2 G5:9 E5:3 | C#5:3 A4:1 C#5:2 E5:9 C#5:3 | B4:3 F#4:1 B4:2 D5:9 F#5:3 | F#5:12 F#4:6`,
  'Bm | Bm | D | D | A7 | A7 | Bm | F#', TROMBONES, { leadShift: -12, battleLead: HORNS, loops: 4 });

/** Degeyter, "L'Internationale" (1888): the anthem of the Soviet Union until 1944, for a men's choir. */
const INTERNATIONALE = piece('The Internationale (Degeyter)', 84, -2, COMMON,
  `C5:6 B4:2 D5:2 C5:2 G4:2 E4:2 | A4:8 F4:4 F4:4 | D5:6 C5:2 B4:2 A4:2 G4:2 F4:2 | E4:12 G4:4 |
   C5:6 B4:2 D5:2 C5:2 G4:2 E4:2 | A4:6 G4:2 F4:2 A4:2 D5:2 C5:2 | B4:4 D5:4 F5:4 B4:4 | C5:12 G4:4`,
  'C | F | G7 | C | C | F Dm | G7 | C', MEN, { leadShift: -12, battleLead: LOW_BRASS });

/** "Korobeiniki" (Russian folk song, Nekrasov 1861): a balalaika tremolo that the brass takes up. */
const KOROBEINIKI = piece('Korobeiniki (folk)', 126, 0, COMMON,
  `E5:4 B4:2 C5:2 D5:4 C5:2 B4:2 | A4:4 A4:2 C5:2 E5:4 D5:2 C5:2 | B4:6 C5:2 D5:4 E5:4 | C5:4 A4:4 A4:8 |
   r:2 D5:4 F5:2 A5:4 G5:2 F5:2 | E5:6 C5:2 E5:4 D5:2 C5:2 | B4:4 B4:2 C5:2 D5:4 E5:4 | C5:4 A4:4 A4:8`,
  'Am E | Am | E | Am | Dm | C | E | Am', BALALAIKA, { tremolo: true, battleLead: LOW_BRASS, loops: 4 });

/** Key, "The Star-Spangled Banner" (1814, to Smith's tune): trumpets. */
const BANNER = piece('The Star-Spangled Banner', 92, -2, TRIPLE,
  `C4:4 E4:4 G4:4 | C5:8 E5:3 D5:1 | C5:4 E4:4 F#4:4 | G4:8 G4:2 G4:2 |
   E5:6 D5:2 C5:4 | B4:8 A4:2 B4:2 | C5:4 C5:4 G4:4 | E4:4 C4:4 G4:3 E4:1`,
  'C | C | Am D7 | G | C | G | C | C G7', TRUMPET, { leadShift: 12, battleLead: LOW_BRASS });

/** "Yankee Doodle" (fife-and-drum march, 18th century). */
const YANKEE = piece('Yankee Doodle (fife and drum)', 116, 2, COMMON,
  `C5:2 C5:2 D5:2 E5:2 C5:2 E5:2 D5:2 G4:2 | C5:2 C5:2 D5:2 E5:2 C5:4 B4:4 | C5:2 C5:2 D5:2 E5:2 F5:2 E5:2 D5:2 C5:2 | B4:2 G4:2 A4:2 B4:2 C5:4 C5:4 |
   A4:3 B4:1 A4:2 G4:2 A4:2 B4:2 C5:4 | G4:3 A4:1 G4:2 F4:2 E4:4 G4:4 | A4:3 B4:1 A4:2 G4:2 A4:2 B4:2 C5:2 A4:2 | G4:2 C5:2 B4:2 D5:2 C5:4 C5:4`,
  'C G | C G | C G7 | G7 C | F C | G7 C | F Am | G7 C', FIFE, { leadShift: 12, battleLead: TRUMPET, loops: 4 });

/** Taki Rentarō, "Kōjō no Tsuki" (1901), on the shakuhachi. */
const KOJO = piece('Kōjō no Tsuki (Taki)', 64, 0, COMMON,
  `B4:4 B4:4 E5:4 F#5:4 | G5:4 F#5:4 E5:8 | C5:4 C5:4 B4:4 A4:4 | B4:16 |
   B4:4 B4:4 E5:4 F#5:4 | G5:4 F#5:4 E5:8 | C5:4 A4:4 B4:4 B4:4 | E4:16 |
   G5:4 G5:4 F#5:4 E5:4 | F#5:4 G5:4 F#5:8 | E5:4 E5:4 C5:4 A4:4 | B4:16 |
   B4:4 B4:4 E5:4 F#5:4 | G5:4 F#5:4 E5:8 | C5:4 A4:4 B4:4 B4:4 | E4:16`,
  'Em | Em | Am | Em | Em | Em | Am B | Em | C | D | Am | B | Em | Em | Am B | Em', SHAKUHACHI,
  { battleLead: HORNS, loops: 2 });

/** "Sakura Sakura" (Edo-period folk song), on the koto. */
const SAKURA = piece('Sakura Sakura (folk)', 76, 0, COMMON,
  `A4:4 A4:4 B4:8 | A4:4 A4:4 B4:8 | A4:4 B4:4 C5:4 B4:4 | A4:4 B4:2 A4:2 F4:8 | E4:4 C4:4 E4:4 F4:4 | E4:4 E4:2 C4:2 B3:8 |
   A4:4 B4:4 C5:4 B4:4 | A4:4 B4:2 A4:2 F4:8 | E4:4 C4:4 E4:4 F4:4 | E4:4 E4:2 C4:2 B3:8 |
   A4:4 A4:4 B4:8 | A4:4 A4:4 B4:8 | E4:4 F4:4 B4:2 A4:2 F4:4 | E4:16`,
  'Am | Am | Am | Dm | Am | E5 | Am | Dm | Am | E5 | Am | Am | Dm | E5', KOTO,
  { leadShift: 12, pluck: true, battleLead: SHAKUHACHI, loops: 2 });

/** The music of each WW2 faction (the side the player defends with). */
export const ANTHEMS: Record<string, Track[]> = {
  de: [DEUTSCHLAND, VALKYRIES],
  su: [INTERNATIONALE, KOROBEINIKI],
  us: [BANNER, YANKEE],
  jp: [KOJO, SAKURA],
};
