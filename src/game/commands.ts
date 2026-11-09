// Every player action is a Command applied by Sim.exec() between ticks. Because the simulation is
// deterministic, a seed plus the list of (tick, command) pairs reproduces a whole game: that is what
// replays, saved games and co-op lockstep are built on.

export type Command =
  /**
   * `by` is set when the AI partner builds (it owns the tower; the player's undo skips it); `p` is the
   * co-op player who built (1: the guest; set by the session), so each takes back only their own.
   */
  | { t: 'place'; type: number; col: number; row: number; by?: number; p?: number }
  | { t: 'sell'; ids: number[] }
  | { t: 'upgrade'; ids: number[] }
  | { t: 'mode'; id: number; mode: number }
  | { t: 'gate'; id: number }
  /** WW2: patch up damaged emplacements or rebuild destroyed ones. */
  | { t: 'repair'; ids: number[] }
  /** WW2 units: train one at a barracks / motor pool; move or set the stance of units (by uid). */
  | { t: 'train'; id: number; unit: number }
  | { t: 'unitMove'; ids: number[]; x: number; y: number }
  | { t: 'unitStance'; ids: number[]; stance: number }
  | { t: 'unitDig'; ids: number[] }
  | { t: 'unitMines'; ids: number[]; x: number; y: number }
  | { t: 'fire'; id: number; x: number; y: number }
  | { t: 'wave' }
  | { t: 'undo'; p?: number }
  /** Carry on after the win (endless waves). */
  | { t: 'endless' }
  | { t: 'item'; item: number; x: number; y: number }
  | { t: 'heroMove'; x: number; y: number }
  | { t: 'heroAbility'; ability: number; x: number; y: number }
  | { t: 'stress' };

export interface LoggedCommand {
  tick: number;
  cmd: Command;
}
