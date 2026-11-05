import { describe, it, expect } from "vitest";
import type { ServerMsg } from "@wc/protocol";
import { SimHost } from "../simhost";
import { createWorkerTransport, type WorkerLike } from "./worker";
import { STATION_W } from "@wc/sim-core";

function loopbackWorker(host: SimHost): WorkerLike {
  const w: WorkerLike = {
    onmessage: null,
    postMessage(m: unknown) { for (const out of host.handle(m as never)) queueMicrotask(() => w.onmessage?.({ data: out })); },
    terminate() {},
  };
  return w;
}
const collect = (host = new SimHost({ seed: 1, population: 20, budgetMs: Infinity })) => {
  const t = createWorkerTransport(loopbackWorker(host));
  const got: ServerMsg[] = [];
  t.onMessage((m) => got.push(m));
  return { t, got, host };
};

describe("worker transport", () => {
  it("subscribe yields a snapshot with the starter station and population", async () => {
    const { t, got } = collect();
    t.send({ t: "subscribe", viewport: { x: 0, y: 0, w: 60, h: 40, zoom: 3 } });
    await Promise.resolve();
    expect(got[0].t).toBe("snapshot");
    if (got[0].t === "snapshot") { expect(got[0].chars.length).toBe(20); expect(got[0].w).toBe(STATION_W); }
  });
  it("the snapshot carries the ship's deck as a chunk of its own, with its berth in the station map", async () => {
    const { t, got, host } = collect();
    t.send({ t: "subscribe", viewport: { x: 0, y: 0, w: 60, h: 40, zoom: 3 } });
    await Promise.resolve();
    const m = got[0]; if (m.t !== "snapshot") throw new Error("no snapshot");
    const sh = m.ship!, src = host.world.station.ship!;
    expect(sh).toBeTruthy();
    expect([sh.w, sh.h]).toEqual([36, 23]); expect(sh.tiles.length).toBe(36 * 23);
    expect(sh.berth).toEqual(src.berth);
    expect(sh.rooms.map((r) => r.name)).toEqual(["Cargo Ship"]); expect(sh.deco.length).toBe(src.deco!.length); expect(sh.floors.length).toBe(36 * 23);
  });
  it("the station the viewer bakes has the ship's berth left empty: the ship is drawn as a body of its own", async () => {
    const { t, got } = collect();
    t.send({ t: "subscribe", viewport: { x: 0, y: 0, w: 60, h: 40, zoom: 3 } });
    await Promise.resolve();
    const m = got[0]; if (m.t !== "snapshot") throw new Error("no snapshot");
    const b = m.ship!.berth;
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) expect(m.tiles[y * m.w + x], `${x},${y}`).toBe(0);
    const inside = (d: { x: number; y: number }) => d.x >= b.x && d.x < b.x + b.w && d.y >= b.y && d.y < b.y + b.h;
    expect(m.deco!.some(inside)).toBe(false); expect(m.furniture.some(inside)).toBe(false);
    expect(m.rooms.some((r) => r.name === "Cargo Ship")).toBe(false);
    expect(m.shipStatus).toEqual({ slip: 0, holding: false, aboard: 0 });
  });
  it("deltas carry the ship's schedule slip, and say when it is waiting for pilots", () => {
    const host = new SimHost({ seed: 1, population: 20, budgetMs: Infinity });
    host.handle({ t: "subscribe", viewport: { x: 0, y: 0, w: 60, h: 40, zoom: 3 } });
    const d = host.advanceReal(30)!;
    expect(d.shipStatus).toEqual({ slip: 0, holding: false, aboard: 0 });
  });
  it("advancing real time yields deltas", async () => {
    const { t, got, host } = collect();
    t.send({ t: "subscribe", viewport: { x: 0, y: 0, w: 60, h: 40, zoom: 3 } });
    const d = host.advanceReal(30);
    expect(d?.t).toBe("delta");
    expect(d!.tick).toBe(30);
  });
  it("a 300 s hidden-tab gap becomes one bounded coalesced delta", () => {
    const host = new SimHost({ seed: 1, population: 20, budgetMs: Infinity });
    host.handle({ t: "subscribe", viewport: { x: 0, y: 0, w: 60, h: 40, zoom: 3 } });
    const d = host.advanceReal(300)!;
    expect(d.t === "delta" && d.tick).toBe(300);
    const big = host.advanceReal(100_000)!;
    expect(big.tick - 300).toBeLessThanOrEqual(600);
  });
  it("dev commands: pause stops time, speed scales it, spawn adds characters, reset reseeds", () => {
    const host = new SimHost({ seed: 1, population: 10, budgetMs: Infinity });
    host.handle({ t: "subscribe", viewport: { x: 0, y: 0, w: 60, h: 40, zoom: 3 } });
    host.handle({ t: "devCmd", cmd: { c: "pause" } });
    expect(host.advanceReal(10)).toBeNull();
    host.handle({ t: "devCmd", cmd: { c: "pause" } }); // toggles
    host.handle({ t: "devCmd", cmd: { c: "speed", mult: 10 } });
    expect(host.advanceReal(2)!.tick).toBe(20);
    const out = host.handle({ t: "devCmd", cmd: { c: "spawn", count: 5 } });
    expect(out.some((m) => m.t === "snapshot" && m.chars.length === 15)).toBe(true);
    const re = host.handle({ t: "devCmd", cmd: { c: "reset", seed: 9 } });
    expect(re.some((m) => m.t === "snapshot" && m.tick === 0)).toBe(true);
  });
  it("inspect returns the explanation for a character and nothing for unknown ids", () => {
    const host = new SimHost({ seed: 1, population: 5, budgetMs: Infinity });
    const out = host.handle({ t: "inspect", id: 2 });
    expect(out[0].t === "inspect" && out[0].lines.length).toBeGreaterThan(1);
    const none = host.handle({ t: "inspect", id: null });
    expect(none).toEqual([]);
    expect(host.inspectMsg()).toBeNull();
    host.handle({ t: "inspect", id: 1 });
    expect(host.inspectMsg()?.t).toBe("inspect");
  });
  it("pause and speed commands are acknowledged with the new clock", () => {
    const host = new SimHost({ seed: 1, population: 5, budgetMs: Infinity });
    const p = host.handle({ t: "devCmd", cmd: { c: "pause" } });
    expect(p[0]).toMatchObject({ t: "delta", clock: { paused: true } });
    const s = host.handle({ t: "devCmd", cmd: { c: "speed", mult: 10 } });
    expect(s[0]).toMatchObject({ t: "delta", clock: { speed: 10, paused: true } });
  });
  it("a wall-time budget stops a slow catch-up early instead of locking the worker", () => {
    let now = 0;
    const host = new SimHost({ seed: 1, population: 5, now: () => (now += 20), budgetMs: 50 });
    const d = host.advanceReal(500)!;
    expect(d.tick).toBeLessThan(10);
    expect(d.tick).toBeGreaterThan(0);
    host.handle({ t: "devCmd", cmd: { c: "speed", mult: 1e9 } });
    expect(host.speed).toBeLessThanOrEqual(600);
  });
  it("works with zero characters", () => {
    const host = new SimHost({ seed: 1, population: 0, budgetMs: Infinity });
    const out = host.handle({ t: "subscribe", viewport: { x: 0, y: 0, w: 60, h: 40, zoom: 3 } });
    expect(out[0].t === "snapshot" && out[0].chars.length).toBe(0);
    expect(() => host.advanceReal(60)).not.toThrow();
  });
});

describe("tasks reach the viewer", () => {
  it("the snapshot gives every character a task, and deltas report only the changes", () => {
    const host = new SimHost({ seed: 7, population: 60, budgetMs: Infinity });
    const snap = host.handle({ t: "subscribe", viewport: { x: 0, y: 0, w: 60, h: 40, zoom: 3 } })[0];
    if (snap.t !== "snapshot") throw new Error("no snapshot");
    expect(snap.chars.every((c) => c.task && typeof c.task.kind === "number")).toBe(true);
    const seen = new Map<number, string>();
    let changes = 0, working = false;
    for (let i = 0; i < 60; i++) {
      const d = host.advanceReal(60); if (!d) continue;
      for (const tc of d.tasks ?? []) { const k = JSON.stringify(tc.task); expect(seen.get(tc.id)).not.toBe(k); seen.set(tc.id, k); changes++; if (tc.task.kind === 5 && tc.task.began >= 0) working = true; }
    }
    expect(changes).toBeGreaterThan(0); expect(working).toBe(true);
  });
  it("sends station stats with the snapshot and refreshes them on deltas about every 30 ticks", async () => {
    const host = new SimHost({ seed: 1, population: 20, budgetMs: Infinity });
    const snap = host.snapshot() as Extract<ServerMsg, { t: "snapshot" }>;
    expect(snap.stats?.rooms).toBeGreaterThan(0); expect(snap.stats?.needs.hunger).toBeGreaterThan(0);
    let withStats = 0, total = 0;
    for (let i = 0; i < 100; i++) { const d = host.advanceReal(1); if (d) { total++; if (d.stats) withStats++; } }
    expect(total).toBeGreaterThan(0); expect(withStats).toBeGreaterThanOrEqual(3); expect(withStats).toBeLessThan(total);   // about every 30 ticks, not every delta
  });
  it("carries the power block with the snapshot, and a reactor status change reaches the viewer at once", async () => {
    const host = new SimHost({ seed: 1, population: 20, budgetMs: Infinity });
    const snap = host.snapshot() as Extract<ServerMsg, { t: "snapshot" }>;
    expect(snap.stats?.power.status).toBe("running");
    host.advanceReal(1); host.advanceReal(1);                                         // the stats cadence is now mid-interval
    host.world.power.reactor.status = "scram";
    let seen = false;
    for (let i = 0; i < 3 && !seen; i++) { const d = host.advanceReal(1); if (d?.stats?.power.status === "scram") seen = true; }
    expect(seen).toBe(true);
  });
});
