// The player's long-term progress: research medals and perks, best scores, custom maps.

import { DIFFICULTIES, PERKS, scoreMultiplier, type Difficulty, type GameConfig, type Perks } from '../game/config';
import type { MapDef } from '../game/maps';
import { load, save } from './storage';

export interface ScoreEntry {
  score: number;
  wave: number;
  kills: number;
  win: boolean;
  difficulty: Difficulty;
  modifiers: string[];
  date: string;
}

interface Profile {
  medals: number;
  perks: Perks;
  /** Top scores per map name. */
  scores: Record<string, ScoreEntry[]>;
  /** Best daily-challenge score per date. */
  daily: Record<string, ScoreEntry>;
  customMaps: MapDef[];
  wins: number;
  games: number;
}

const profile: Profile = load('profile', { medals: 0, perks: {}, scores: {}, daily: {}, customMaps: [], wins: 0, games: 0 });

const persist = () => save('profile', profile);

export const getProfile = (): Readonly<Profile> => profile;

export function perkLevel(id: string): number {
  return profile.perks[id] ?? 0;
}

export function buyPerk(id: string): boolean {
  const def = PERKS.find((p) => p.id === id);
  const lv = perkLevel(id);
  if (!def || lv >= def.costs.length || profile.medals < def.costs[lv]) return false;
  profile.medals -= def.costs[lv];
  profile.perks[id] = lv + 1;
  persist();
  return true;
}

/** Refund every perk. */
export function resetPerks(): void {
  for (const def of PERKS) {
    for (let lv = 0; lv < perkLevel(def.id); lv++) profile.medals += def.costs[lv];
  }
  profile.perks = {};
  persist();
}

export function computeScore(cfg: GameConfig, wave: number, kills: number, lives: number, win: boolean): number {
  const base = wave * 100 + kills * 2 + lives * 25 + (win ? 2000 : 0);
  return Math.round(base * scoreMultiplier(cfg));
}

/**
 * Records a finished game: score tables, daily best, and medals (wins pay by difficulty; endless
 * runs pay one more per ten waves beyond the last). Returns the medals earned.
 */
export function recordGame(cfg: GameConfig, entry: ScoreEntry, endlessWaves: number, payWin = true): number {
  profile.games++;
  const key = cfg.map.name;
  const list = (profile.scores[key] ??= []);
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  list.length = Math.min(list.length, 10);
  if (cfg.daily) {
    const best = profile.daily[cfg.daily];
    if (!best || entry.score > best.score) profile.daily[cfg.daily] = entry;
  }
  let medals = 0;
  if (entry.win && payWin) {
    profile.wins++;
    medals += DIFFICULTIES[cfg.difficulty].medals + (cfg.modifiers.length ? 1 : 0);
  }
  medals += Math.floor(endlessWaves / 10);
  profile.medals += medals;
  persist();
  return medals;
}

export function saveCustomMap(def: MapDef): void {
  const i = profile.customMaps.findIndex((m) => m.name === def.name);
  if (i >= 0) profile.customMaps[i] = def;
  else profile.customMaps.push(def);
  persist();
}

export function deleteCustomMap(name: string): void {
  profile.customMaps = profile.customMaps.filter((m) => m.name !== name);
  persist();
}
