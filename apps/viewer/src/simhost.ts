import { taskOf, profileOf, stationStats, createWorld, step, seedPopulation, arrive, explain, Department, type World } from "@wc/sim-core";
import type { ClientMsg, ServerMsg, Move, StateChange, TaskChange, StatsSnap } from "@wc/protocol";

export const MAX_CATCHUP_TICKS = 600;
export const MAX_SPEED = 600;

export class SimHost {
  world: World;
  speed = 1;
  paused = false;
  private acc = 0;
  private sentRev = 0;
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
    return { t: "delta", tick: this.world.tick, moves: [], states: [], clock: { speed: this.speed, paused: this.paused }, shipStatus: this.shipStatus() };
  }

  inspectMsg(): ServerMsg | null {
    if (this.inspectId === null) return null;
    return { t: "inspect", id: this.inspectId, tick: this.world.tick, lines: explain(this.world, this.inspectId), profile: profileOf(this.world, this.inspectId) };
  }

  /** The station as the viewer bakes it: the ship's berth left empty (the ship is drawn as a body of its own, from its chunk). */
  private stationView() {
    const w = this.world, m = w.station.map, st = w.station, b = st.ship?.berth;
    const tiles = Array.from(m.tiles), floors = st.floors ? Array.from(st.floors) : [];
    if (!b) return { tiles, floors, furniture: st.furniture, rooms: st.rooms, deco: st.deco ?? [] };
    const inside = (d: { x: number; y: number }) => d.x >= b.x && d.x < b.x + b.w && d.y >= b.y && d.y < b.y + b.h;
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) { tiles[y * m.w + x] = 0; if (floors.length) floors[y * m.w + x] = 0; }
    return { tiles, floors, furniture: st.furniture.filter((f) => !inside(f)), rooms: st.rooms.filter((r) => r.name !== "Cargo Ship"), deco: (st.deco ?? []).filter((d) => !inside(d)) };
  }
  private statsAt = -Infinity;
  /** station stats ride on a delta about every 30 sim ticks, not on every one */
  private powerStatus = "";
  /** a reactor status change (scram, restart) is sent at once rather than waiting for the cadence */
  private statsIfDue(): { stats?: StatsSnap } {
    const st = this.world.power.reactor.status, changed = st !== this.powerStatus;
    if (!changed && this.world.tick - this.statsAt < 30) return {};
    this.powerStatus = st; this.statsAt = this.world.tick; return { stats: stationStats(this.world) };
  }
  private shipStatus() { return { slip: this.world.ship.slip, holding: this.world.ship.holding, aboard: this.world.ship.crew.length }; }

  snapshot(): ServerMsg {
    const w = this.world, c = w.chars, m = w.station.map;
    const chars = [];
    for (let id = 0; id < c.count; id++)
      chars.push({ id, name: c.name(id), dept: c.dept[id], rank: c.rank[id], x: c.x[id], y: c.y[id], state: c.state[id], job: c.job[id], task: taskOf(w, id) });
    const sh = w.station.ship;
    const ship = sh ? { w: sh.map.w, h: sh.map.h, tiles: Array.from(sh.map.tiles), furniture: sh.furniture, rooms: sh.rooms, deco: sh.deco ?? [], floors: sh.floors ? Array.from(sh.floors) : [], berth: sh.berth } : undefined;
    const v = this.stationView();
    return { t: "snapshot", tick: w.tick, w: m.w, h: m.h, tiles: v.tiles, furniture: v.furniture, rooms: v.rooms, chars, deco: v.deco, floors: v.floors, ship, shipStatus: this.shipStatus(), stats: stationStats(w) };
  }

  /** Present only once per station growth: lets the viewer rebake and fade the new rooms in. */
  stationUpdate(): ServerMsg | null {
    if (this.world.stationRev === this.sentRev) return null;
    this.sentRev = this.world.stationRev;
    const w = this.world, m = w.station.map;
    const v = this.stationView();
    return { t: "station", tick: w.tick, w: m.w, h: m.h, tiles: v.tiles, furniture: v.furniture, rooms: v.rooms, deco: v.deco, floors: v.floors };
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
        this.world = this.build(cmd.seed); this.acc = 0; this.sentRev = 0;
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
    const before = c.state.slice(0, c.count), key = (t: { kind: number; began: number; total: number }) => `${t.kind}:${t.began}:${t.total}`;
    const beforeTask = Array.from({ length: c.count }, (_, id) => key(taskOf(w, id)));
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
    const tasks: TaskChange[] = [];
    for (let id = 0; id < beforeTask.length; id++) { const t = taskOf(w, id); if (beforeTask[id] !== key(t)) tasks.push({ id, task: t }); }
    return { t: "delta", tick: w.tick, moves, states, clock: { speed: this.speed, paused: this.paused }, shipStatus: this.shipStatus(), tasks, ...this.statsIfDue() };
  }
}
