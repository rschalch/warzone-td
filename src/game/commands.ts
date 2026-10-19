// Every player action is a Command applied by Sim.exec() between ticks. Because the simulation is
// deterministic, a seed plus the list of (tick, command) pairs reproduces a whole game: that is what
// replays, saved games and co-op lockstep are built on.

export type Command =
  /** `by` is set when the AI partner builds (it owns the tower; the player's undo skips it). */
  | { t: 'place'; type: number; col: number; row: number; by?: number }
  | { t: 'sell'; ids: number[] }
  | { t: 'upgrade'; ids: number[] }
  | { t: 'mode'; id: number; mode: number }
  | { t: 'gate'; id: number }
  /** WW2: patch up damaged emplacements or rebuild destroyed ones. */
  | { t: 'repair'; ids: number[] }
  | { t: 'fire'; id: number; x: number; y: number }
  | { t: 'wave' }
  | { t: 'undo' }
  | { t: 'item'; item: number; x: number; y: number }
  | { t: 'heroMove'; x: number; y: number }
  | { t: 'heroAbility'; ability: number; x: number; y: number }
  | { t: 'stress' };

export interface LoggedCommand {
  tick: number;
  cmd: Command;
}
