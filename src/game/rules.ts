// Picks the ruleset (towers, enemies, waves) a game is played with and installs it into the live
// bindings in defs.ts. Sim.create() calls it; so does anything that shows towers outside a game.

import { CLASSIC, RULESET, installRuleset, type Ruleset } from './defs';
import type { GameConfig } from './config';
import { ww2Ruleset, type Faction } from './ww2';

const cache = new Map<string, Ruleset>();

export function rulesetFor(ww2?: { side: Faction; foe: Faction; battle?: string }): Ruleset {
  if (!ww2) return CLASSIC;
  const key = `${ww2.side}:${ww2.foe}:${ww2.battle ?? ''}`;
  let r = cache.get(key);
  if (!r) cache.set(key, (r = ww2Ruleset(ww2.side, ww2.foe, ww2.battle)));
  return r;
}

let current = CLASSIC;

/** Installs the ruleset of a game config. Returns true if it changed. */
export function setRuleset(cfg: Pick<GameConfig, 'ww2'>): boolean {
  const r = rulesetFor(cfg.ww2);
  if (r === current && RULESET === r.id) return false;
  current = r;
  installRuleset(r);
  return true;
}

/** A key that changes whenever a different ruleset is installed (HUD rebuilds its palette). */
export const rulesetKey = () => current;
