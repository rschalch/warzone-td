// A running game: the simulation, its config and the log of every command applied so far.
//
// - local:  commands apply at once (between ticks) and are logged.
// - replay: commands come from a recorded log and apply at their recorded ticks.
// - coop:   lockstep. Commands are scheduled INPUT_DELAY ticks ahead and sent to the peer; a tick
//           only runs once both sides have finalised their commands for it. Both machines run the
//           same deterministic simulation, so only commands cross the network.
// A local game may also have an AI partner (config.partner): it thinks every PARTNER_EVERY ticks and
// its commands are applied and logged like the player's, so replaying the log needs no partner.

import type { Command, LoggedCommand } from '../game/commands';
import type { GameConfig } from '../game/config';
import { DT } from '../game/defs';
import { Partner, PARTNER_EVERY } from '../game/partner';
import { Sim } from '../game/sim';

export const MAX_STEPS_PER_FRAME = 16;
const INPUT_DELAY = 6; // ticks (100 ms at 1×)
const HASH_EVERY = 300;

/** What a co-op session needs from the network layer. */
export interface Link {
  send(msg: NetMsg): void;
  onMessage: ((msg: NetMsg) => void) | null;
  /** Player index: 0 host, 1 guest. Commands of the same tick apply host first. */
  readonly player: number;
}

export type NetMsg =
  | { m: 'frame'; upTo: number; cmds: LoggedCommand[] }
  | { m: 'hash'; tick: number; hash: number }
  | { m: 'start'; config: GameConfig }
  | { m: 'speed'; speed: number }
  | { m: 'chat'; text: string }
  | { m: 'bye' };

/** Commands that steer the session (pace) rather than the simulation; never logged or scheduled. */
export type SessionCommand = Command | { t: 'speed'; speed: number };

export class Session {
  readonly sim: Sim;
  readonly config: GameConfig;
  readonly log: LoggedCommand[] = [];
  speed = 1;
  /** Fraction of a tick left over, for render interpolation. */
  acc = 0;
  /** Time scale for slow-motion effects (local only, never affects the outcome). */
  timeScale = 1;
  desync = false;
  /** The AI partner (co-op with AI), in local games only. */
  readonly partner: Partner | null = null;
  stalled = false;
  /** Results of local commands applied since the last frame, for feedback (sound, messages). */
  readonly results: { cmd: SessionCommand; ok: boolean }[] = [];

  private replay: LoggedCommand[] | null = null;
  private replayAt = 0;
  // co-op
  private link: Link | null = null;
  private pending = new Map<number, { player: number; cmd: SessionCommand }[]>();
  private peerUpTo = -1;
  private sentUpTo = -1;
  private outbox: LoggedCommand[] = [];
  private hashes = new Map<number, number>();

  constructor(config: GameConfig, opts: { replay?: LoggedCommand[]; link?: Link; restore?: Record<string, unknown>; log?: LoggedCommand[] } = {}) {
    this.config = config;
    this.sim = opts.restore ? Sim.restore(opts.restore) : Sim.create(config);
    if (opts.log) this.log.push(...opts.log);
    if (opts.replay) this.replay = opts.replay;
    if (opts.link) {
      this.link = opts.link;
      this.link.onMessage = (msg) => this.receive(msg);
    }
    if (config.partner && !opts.replay && !opts.link) this.partner = new Partner(config.partner);
  }

  get mode(): 'local' | 'replay' | 'coop' {
    return this.replay ? 'replay' : this.link ? 'coop' : 'local';
  }

  get finished(): boolean {
    return this.sim.gameOver || (this.sim.victory && !this.sim.endless);
  }

  /** A command from this player. */
  issue(cmd: SessionCommand): void {
    if (cmd.t === 'speed') {
      // pace only: applies at once on both sides (a scheduled unpause could never come due)
      this.speed = cmd.speed;
      this.link?.send({ m: 'speed', speed: cmd.speed });
      return;
    }
    if (this.replay) return;
    if (this.link) {
      const tick = Math.max(this.sim.ticks + INPUT_DELAY, this.sentUpTo + 1);
      this.schedule(tick, this.link.player, cmd);
      this.outbox.push({ tick, cmd: cmd as Command });
      return;
    }
    this.apply(cmd, true);
  }

  private apply(cmd: SessionCommand, local: boolean): void {
    if (cmd.t === 'speed') return;
    const ok = this.sim.exec(cmd);
    if (ok) this.log.push({ tick: this.sim.ticks, cmd });
    if (local) this.results.push({ cmd, ok });
  }

  private schedule(tick: number, player: number, cmd: SessionCommand): void {
    let list = this.pending.get(tick);
    if (!list) this.pending.set(tick, (list = []));
    list.push({ player, cmd });
  }

  private receive(msg: NetMsg): void {
    if (msg.m === 'frame') {
      const peer = 1 - this.link!.player;
      for (const c of msg.cmds) this.schedule(c.tick, peer, c.cmd);
      this.peerUpTo = Math.max(this.peerUpTo, msg.upTo);
    } else if (msg.m === 'speed') {
      this.speed = msg.speed;
    } else if (msg.m === 'hash') {
      const mine = this.hashes.get(msg.tick);
      if (mine !== undefined && mine !== msg.hash) this.desync = true;
      this.hashes.set(-msg.tick - 1, msg.hash);
    }
  }

  /** Runs the commands due at the current tick, then one tick. Returns false when it must wait. */
  private stepOnce(): boolean {
    const sim = this.sim;
    if (this.replay) {
      while (this.replayAt < this.replay.length && this.replay[this.replayAt].tick <= sim.ticks) {
        const c = this.replay[this.replayAt++];
        if (c.tick === sim.ticks) this.apply(c.cmd, false);
      }
    } else if (this.link) {
      if (this.peerUpTo < sim.ticks) return false;
      const due = this.pending.get(sim.ticks);
      if (due) {
        this.pending.delete(sim.ticks);
        // deterministic order on both machines: host first, then guest, each in issue order
        due.sort((a, b) => a.player - b.player);
        for (const d of due) this.apply(d.cmd, d.player === this.link.player);
      }
    } else if (this.partner && sim.ticks % PARTNER_EVERY === 0) {
      const cmd = this.partner.think(sim);
      if (cmd) this.apply(cmd, false);
    }
    if (this.finished) return true;
    sim.step();
    if (this.link && sim.ticks % HASH_EVERY === 0) {
      const h = sim.stateHash();
      this.hashes.set(sim.ticks, h);
      const theirs = this.hashes.get(-sim.ticks - 1);
      if (theirs !== undefined && theirs !== h) this.desync = true;
      this.link.send({ m: 'hash', tick: sim.ticks, hash: h });
    }
    return true;
  }

  /** Advances by dt seconds of real time; returns the number of ticks run. */
  advance(dt: number): number {
    let steps = 0;
    this.stalled = false;
    if (this.speed > 0 && !this.finished) {
      this.acc += dt * this.speed * this.timeScale;
      while (this.acc >= DT && steps < MAX_STEPS_PER_FRAME) {
        if (!this.stepOnce()) {
          // waiting for the peer: keep at most a little time in hand
          this.stalled = true;
          this.acc = Math.min(this.acc, DT * 2);
          break;
        }
        this.acc -= DT;
        steps++;
      }
      if (steps === MAX_STEPS_PER_FRAME) this.acc = 0; // can't keep up: drop time rather than spiral
    }
    if (this.link) this.flush();
    return steps;
  }

  /** Tells the peer which ticks are final on our side, with any commands for them. */
  private flush(): void {
    const upTo = this.sim.ticks + INPUT_DELAY - 1;
    if (upTo <= this.sentUpTo && !this.outbox.length) return;
    this.sentUpTo = Math.max(this.sentUpTo, upTo);
    this.link!.send({ m: 'frame', upTo: this.sentUpTo, cmds: this.outbox });
    this.outbox = [];
  }

  /** Skip ahead (replays): runs ticks without rendering until the given wave starts. */
  skipToWave(wave: number, budgetMs = 1500): void {
    const t0 = performance.now();
    while (this.sim.wave < wave && !this.finished && performance.now() - t0 < budgetMs) {
      if (!this.stepOnce()) break;
    }
    this.acc = 0;
  }

  /** The partner left: carry on alone. */
  dropLink(): void {
    if (!this.link) return;
    // apply everything already scheduled so nothing we issued is lost
    for (const [tick, list] of [...this.pending].sort((a, b) => a[0] - b[0])) {
      if (tick < this.sim.ticks) continue;
      for (const d of list) if (d.player === this.link.player) this.apply(d.cmd, true);
    }
    this.pending.clear();
    this.link.onMessage = null;
    this.link = null;
  }

  get replayLength(): number {
    return this.replay ? (this.replay.length ? this.replay[this.replay.length - 1].tick : 0) : 0;
  }
}
