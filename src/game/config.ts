// Everything that defines a game before the first command: map, difficulty, challenge modifiers,
// research perks and the random seed. Together with the command log it reproduces a game exactly.

import type { MapDef } from './maps';
import type { Faction } from './ww2';

export type Difficulty = 'easy' | 'normal' | 'hard' | 'brutal';

export interface DifficultyDef {
  name: string;
  hp: number; // enemy hp multiplier
  money: number; // starting money multiplier
  lives: number;
  medals: number; // research medals for a win
  score: number; // score multiplier
}

export const DIFFICULTIES: Record<Difficulty, DifficultyDef> = {
  easy: { name: 'Easy', hp: 0.75, money: 1.5, lives: 30, medals: 1, score: 0.6 },
  normal: { name: 'Normal', hp: 1, money: 1, lives: 20, medals: 2, score: 1 },
  hard: { name: 'Hard', hp: 1.3, money: 0.85, lives: 15, medals: 3, score: 1.5 },
  brutal: { name: 'Brutal', hp: 1.7, money: 0.7, lives: 10, medals: 5, score: 2.2 },
};

export type Modifier = 'noBarricades' | 'limited' | 'airRaid' | 'ironman' | 'oneLife';

export const MODIFIERS: { id: Modifier; name: string; desc: string; score: number }[] = [
  { id: 'noBarricades', name: 'No Barricades', desc: 'Barricades and gates are off the table: every wall has to be a real tower.', score: 1.15 },
  { id: 'limited', name: 'Limited Arsenal', desc: 'Only eight random tower types are available.', score: 1.3 },
  { id: 'airRaid', name: 'Air Raid', desc: 'Every wave flies. Mazes are useless; bring anti-air.', score: 1.25 },
  { id: 'ironman', name: 'Ironman', desc: 'No selling (undo still works for a few seconds).', score: 1.2 },
  { id: 'oneLife', name: 'Glass Cannon', desc: 'A single leak ends the game.', score: 1.6 },
];

/** Research perks bought with medals between games. */
export interface PerkDef {
  id: string;
  name: string;
  desc: string;
  costs: number[]; // medals per level
}

export const PERKS: PerkDef[] = [
  { id: 'logistics', name: 'Logistics', desc: '+$50 starting money per level.', costs: [1, 2, 4] },
  { id: 'fortify', name: 'Fortification', desc: '+5 lives per level.', costs: [1, 3] },
  { id: 'ballistics', name: 'Ballistics', desc: '+5% damage for every tower per level.', costs: [2, 4, 7] },
  { id: 'engineering', name: 'Engineering', desc: '-10% cost of Maze towers per level.', costs: [1, 3] },
  { id: 'salvage', name: 'Salvage Rights', desc: '+10% refund when selling per level.', costs: [1, 3] },
  { id: 'bounty', name: 'War Bonds', desc: '+10% kill bounty per level.', costs: [2, 5] },
  { id: 'veteran', name: 'Veteran Commander', desc: 'Your hero starts 2 levels higher per level.', costs: [2, 4] },
  { id: 'airpower', name: 'Air Support', desc: '+1 charge for every tactical item per level.', costs: [2, 5] },
];

export type Perks = Record<string, number>;

export interface GameConfig {
  map: MapDef;
  difficulty: Difficulty;
  modifiers: Modifier[];
  /** Tower types the player may build; undefined means all. */
  allowed?: number[];
  perks: Perks;
  seed: number;
  /** Set for the daily challenge (YYYY-MM-DD). */
  daily?: string;
  /** Co-op with AI: the share of the bank the AI partner may spend (see partner.ts). */
  partner?: number;
  /** WW2 mode: the side you play and the one attacking you. Absent: the classic (modern) game. */
  ww2?: { side: Faction; foe: Faction; battle?: string };
}

export const perk = (cfg: GameConfig, id: string) => cfg.perks[id] ?? 0;

export function scoreMultiplier(cfg: GameConfig): number {
  let m = DIFFICULTIES[cfg.difficulty].score;
  for (const id of cfg.modifiers) m *= MODIFIERS.find((x) => x.id === id)!.score;
  return m;
}
