import { describe, it, expect } from "vitest";
import type { ServerMsg } from "@wc/protocol";
import { SimHost } from "../simhost";
import { createWorkerTransport, type WorkerLike } from "./worker";

function loopbackWorker(host: SimHost): WorkerLike {
  const w: WorkerLike = {
    onmessage: null,
    postMessage(m: unknown) { for (const out of host.handle(m as never)) queueMicrotask(() => w.onmessage?.({ data: out })); },
    terminate() {},
  };
  return w;
}
const collect = (host = new SimHost({ seed: 1, population: 20 })) => {
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
    if (got[0].t === "snapshot") { expect(got[0].chars.length).toBe(20); expect(got[0].w).toBe(60); }
  });
  it("advancing real time yields deltas", async () => {
    const { t, got, host } = collect();
    t.send({ t: "subscribe", viewport: { x: 0, y: 0, w: 60, h: 40, zoom: 3 } });
    const d = host.advanceReal(30);
    expect(d?.t).toBe("delta");
    expect(d!.tick).toBe(30);
  });
  it("a 300 s hidden-tab gap becomes one bounded coalesced delta", () => {
    const host = new SimHost({ seed: 1, population: 20 });
    host.handle({ t: "subscribe", viewport: { x: 0, y: 0, w: 60, h: 40, zoom: 3 } });
    const d = host.advanceReal(300)!;
    expect(d.t === "delta" && d.tick).toBe(300);
    const big = host.advanceReal(100_000)!;
    expect(big.tick - 300).toBeLessThanOrEqual(600);
  });
  it("dev commands: pause stops time, speed scales it, spawn adds characters, reset reseeds", () => {
    const host = new SimHost({ seed: 1, population: 10 });
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
    const host = new SimHost({ seed: 1, population: 5 });
    const out = host.handle({ t: "inspect", id: 2 });
    expect(out[0].t === "inspect" && out[0].lines.length).toBeGreaterThan(1);
    const none = host.handle({ t: "inspect", id: null });
    expect(none).toEqual([]);
    expect(host.inspectMsg()).toBeNull();
    host.handle({ t: "inspect", id: 1 });
    expect(host.inspectMsg()?.t).toBe("inspect");
  });
  it("works with zero characters", () => {
    const host = new SimHost({ seed: 1, population: 0 });
    const out = host.handle({ t: "subscribe", viewport: { x: 0, y: 0, w: 60, h: 40, zoom: 3 } });
    expect(out[0].t === "snapshot" && out[0].chars.length).toBe(0);
    expect(() => host.advanceReal(60)).not.toThrow();
  });
});
