import { createWorld, step, seedPopulation, arrive, explain, Department, type World } from "@wc/sim-core";
import type { ClientMsg, ServerMsg, Move, StateChange } from "@wc/protocol";

export const MAX_CATCHUP_TICKS = 600;
export const MAX_SPEED = 600;

export class SimHost {
  world: World;
  speed = 1;
  paused = false;
  private acc = 0;
  private inspectId: number | null = null;
  private now: () => number; private budgetMs: number;
  constructor(private opts: { seed: number; population: number; now?: () => number; budgetMs?: number }) {
    this.now = opts.now ?? (() => performance.now()); this.budgetMs = opts.budgetMs ?? 50;
    this.world = this.build(opts.seed);
  }

  private build(seed: number): World {
    const w = createWorld(seed);
    seedPopulation(w, this.opts.population);
    w.recordEvents = true;
    return w;
  }

  private clockDelta(): Extract<ServerMsg, { t: "delta" }> {
    return { t: "delta", tick: this.world.tick, moves: [], states: [], clock: { speed: this.speed, paused: this.paused } };
  }

  inspectMsg(): ServerMsg | null {
    if (this.inspectId === null) return null;
    return { t: "inspect", id: this.inspectId, tick: this.world.tick, lines: explain(this.world, this.inspectId) };
  }

  snapshot(): ServerMsg {
    const w = this.world, c = w.chars, m = w.station.map;
    const chars = [];
    for (let id = 0; id < c.count; id++)
      chars.push({ id, name: c.name(id), dept: c.dept[id], rank: c.rank[id], x: c.x[id], y: c.y[id], state: c.state[id], job: c.job[id] });
    return { t: "snapshot", tick: w.tick, w: m.w, h: m.h, tiles: Array.from(m.tiles), furniture: w.station.furniture, rooms: w.station.rooms, chars };
  }

  handle(msg: ClientMsg): ServerMsg[] {
    if (msg.t === "subscribe") return [this.snapshot()];
    if (msg.t === "inspect") { this.inspectId = msg.id; const m = this.inspectMsg(); return m ? [m] : []; }
    const cmd = msg.cmd;
    switch (cmd.c) {
      case "pause": this.paused = !this.paused; return [this.clockDelta()];
      case "speed": this.speed = Math.min(MAX_SPEED, Math.max(0.1, cmd.mult)); return [this.clockDelta()];
      case "spawn":
        for (let i = 0; i < cmd.count; i++) arrive(this.world, (cmd.dept ?? Department.Service) as Department);
        return [this.snapshot()];
      case "reset":
        this.opts = { ...this.opts, seed: cmd.seed };
        this.world = this.build(cmd.seed); this.acc = 0;
        return [this.snapshot()];
    }
  }

  /** Advance by real seconds (scaled by speed), bounded per call. One coalesced delta or null. */
  advanceReal(seconds: number): Extract<ServerMsg, { t: "delta" }> | null {
    if (this.paused) return null;
    this.acc += seconds * this.speed;
    const n = Math.min(Math.floor(this.acc), MAX_CATCHUP_TICKS);
    this.acc = n === MAX_CATCHUP_TICKS ? 0 : this.acc - n;
    if (n <= 0) return null;
    const w = this.world, c = w.chars;
    const before = c.state.slice(0, c.count);
    const t0 = this.now();
    const open = new Map<number, { move: Move; last: number }>();
    const moves: Move[] = [];
    for (let i = 0; i < n; i++) {
      if (i > 0 && this.now() - t0 > this.budgetMs) { this.acc = 0; break; }
      step(w);
      for (const e of w.events) {
        if (e.type !== "moved") continue;
        const cur = open.get(e.id);
        if (cur && (cur.last === w.tick - 1 || cur.last === w.tick)) { cur.move.path.push(e.to); cur.last = w.tick; }
        else {
          const move: Move = { id: e.id, startTick: w.tick - 1, from: e.from, path: [e.to] };
          moves.push(move); open.set(e.id, { move, last: w.tick });
        }
      }
      w.events.length = 0;
    }
    const states: StateChange[] = [];
    for (let id = 0; id < before.length; id++) if (before[id] !== c.state[id]) states.push({ id, state: c.state[id] });
    return { t: "delta", tick: w.tick, moves, states, clock: { speed: this.speed, paused: this.paused } };
  }
}
